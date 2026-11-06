/* ============================================================
   桥梁 2D 桁架物理（纯函数，Node 可 require）
   - 节点 + 杆件，全局刚度矩阵 + 位移法
   - 杆件轴力（拉正 / 压负）、应力 = |N|/A
   - 缆索仅受拉：受压退出刚度矩阵并标记松弛
   - 奇异矩阵 / 机构 → unstable
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BridgePhysics = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var MATERIALS = {
    wood: {
      id: 'wood', name: 'materialWood', E: 1000, A: 10, strength: 60,
      density: 0.02, cost: 0.05, tensionOnly: false, color: '#c8873c'
    },
    steel: {
      id: 'steel', name: 'materialSteel', E: 4000, A: 8, strength: 500,
      density: 0.06, cost: 0.10, tensionOnly: false, color: '#7ec8ff'
    },
    cable: {
      id: 'cable', name: 'materialCable', E: 600, A: 3, strength: 800,
      density: 0.02, cost: 0.07, tensionOnly: true, color: '#ffd34d'
    }
  };

  function mat(m) {
    if (!m) return MATERIALS.wood;
    if (typeof m === 'string') return MATERIALS[m] || MATERIALS.wood;
    return m;
  }
  function lengthOf(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function memberCost(member, nodes) {
    var m = mat(member.mat);
    return lengthOf(nodes[member.a], nodes[member.b]) * m.cost;
  }

  /* 高斯消元（部分主元）；奇异返回 null */
  function solveLinear(A, b, n) {
    var M = A, rhs = b;
    var maxDiag = 0;
    for (var i = 0; i < n; i++) maxDiag = Math.max(maxDiag, Math.abs(M[i * n + i]));
    var tol = Math.max(1e-10, maxDiag * 1e-9);
    for (var col = 0; col < n; col++) {
      var pivot = col, best = Math.abs(M[col * n + col]);
      for (var r = col + 1; r < n; r++) {
        var v = Math.abs(M[r * n + col]);
        if (v > best) { best = v; pivot = r; }
      }
      if (best < tol) return null; /* 机构 / 奇异 */
      if (pivot !== col) {
        for (var c = 0; c < n; c++) {
          var tmp = M[col * n + c]; M[col * n + c] = M[pivot * n + c]; M[pivot * n + c] = tmp;
        }
        var tb = rhs[col]; rhs[col] = rhs[pivot]; rhs[pivot] = tb;
      }
      var p = M[col * n + col];
      for (var r2 = col + 1; r2 < n; r2++) {
        var f = M[r2 * n + col] / p;
        if (f === 0) continue;
        for (var c2 = col; c2 < n; c2++) M[r2 * n + c2] -= f * M[col * n + c2];
        rhs[r2] -= f * rhs[col];
      }
    }
    var x = new Array(n);
    for (var i2 = n - 1; i2 >= 0; i2--) {
      var s = rhs[i2];
      for (var c3 = i2 + 1; c3 < n; c3++) s -= M[i2 * n + c3] * x[c3];
      x[i2] = s / M[i2 * n + i2];
    }
    return x;
  }

  /**
   * problem = {
   *   nodes: [{x,y,fixed}],
   *   members: [{a,b,mat,broken}],   // a/b 是 nodes 下标
   *   loads: [{node,fx,fy}],         // y 向下为正
   *   selfWeight: true
   * }
   */
  function solve(problem) {
    var nodes = problem.nodes || [];
    var members = problem.members || [];
    var loads = problem.loads || [];
    var N = nodes.length;
    var freeIdx = [], dofBase = [];
    for (var i = 0; i < N; i++) {
      dofBase[i] = -1;
      if (!nodes[i].fixed) { dofBase[i] = freeIdx.length * 2; freeIdx.push(i); }
    }
    var nd = freeIdx.length * 2;
    var slack = {}, last = null;

    for (var iter = 0; iter < 6; iter++) {
      var active = [];
      for (var mi = 0; mi < members.length; mi++) {
        var mm = members[mi];
        if (mm.broken) continue;
        if (slack[mi]) continue;
        active.push(mi);
      }

      var K = new Float64Array(nd * nd);
      var F = new Float64Array(nd);
      /* 外力 */
      for (var li = 0; li < loads.length; li++) {
        var ld = loads[li], db = dofBase[ld.node];
        if (db < 0) continue;
        F[db] += ld.fx || 0;
        F[db + 1] += ld.fy || 0;
      }
      /* 自重：非断裂杆件（含松弛缆索）重量均分到两端 */
      var selfW = problem.selfWeight !== false;
      for (var mj = 0; mj < members.length; mj++) {
        var mw = members[mj];
        if (mw.broken) continue;
        var matw = mat(mw.mat);
        var Lw = lengthOf(nodes[mw.a], nodes[mw.b]);
        if (selfW) {
          var w = matw.density * matw.A * Lw / 2;
          var da = dofBase[mw.a], db2 = dofBase[mw.b];
          if (da >= 0) F[da + 1] += w;
          if (db2 >= 0) F[db2 + 1] += w;
        }
      }

      for (var ai = 0; ai < active.length; ai++) {
        var mk = members[active[ai]];
        var ma = mat(mk.mat);
        var a = nodes[mk.a], b = nodes[mk.b];
        var dx = b.x - a.x, dy = b.y - a.y;
        var L = Math.sqrt(dx * dx + dy * dy);
        if (L < 1e-9) continue;
        var c = dx / L, s = dy / L;
        var k = ma.E * ma.A / L;
        var ia = dofBase[mk.a], ib = dofBase[mk.b];
        var kk = [[c * c, c * s], [c * s, s * s]];
        var pairs = [];
        if (ia >= 0) pairs.push([ia, ia]);
        if (ia >= 0 && ib >= 0) { pairs.push([ia, ib]); pairs.push([ib, ia]); }
        if (ib >= 0) pairs.push([ib, ib]);
        for (var pi = 0; pi < pairs.length; pi++) {
          var oi = pairs[pi][0], oj = pairs[pi][1];
          var block = (oi === oj) ? 1 : -1;
          for (var ri = 0; ri < 2; ri++) {
            for (var ci = 0; ci < 2; ci++) {
              K[(oi + ri) * nd + (oj + ci)] += block * k * kk[ri][ci];
            }
          }
        }
      }

      var u = solveLinear(K, F, nd);
      if (!u) return {
        unstable: true, nodes: nodes, members: members,
        slack: Object.keys(slack).map(Number),
        ux: [], uy: [], force: [], stress: [], ratio: [],
        maxDisp: 0, maxDeflection: 0, iter: iter
      };
      var ux = [], uy = [];
      for (var ni = 0; ni < N; ni++) {
        var db3 = dofBase[ni];
        ux[ni] = db3 >= 0 ? u[db3] : 0;
        uy[ni] = db3 >= 0 ? u[db3 + 1] : 0;
      }

      /* 杆件轴力 */
      var force = [], stress = [], ratio = [], maxDisp = 0, maxDefl = 0;
      for (var ni2 = 0; ni2 < N; ni2++) {
        var d = Math.sqrt(ux[ni2] * ux[ni2] + uy[ni2] * uy[ni2]);
        if (d > maxDisp) maxDisp = d;
        if (Math.abs(uy[ni2]) > maxDefl) maxDefl = Math.abs(uy[ni2]);
      }
      var newlySlack = false;
      for (var mi2 = 0; mi2 < members.length; mi2++) {
        var m2 = members[mi2];
        if (m2.broken || slack[mi2]) { force[mi2] = 0; stress[mi2] = 0; ratio[mi2] = 0; continue; }
        var mat2 = mat(m2.mat);
        var an = nodes[m2.a], bn = nodes[m2.b];
        var dx2 = bn.x - an.x, dy2 = bn.y - an.y;
        var L2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (L2 < 1e-9) { force[mi2] = 0; stress[mi2] = 0; ratio[mi2] = 0; continue; }
        var c2 = dx2 / L2, s2 = dy2 / L2;
        var ext = (ux[m2.b] - ux[m2.a]) * c2 + (uy[m2.b] - uy[m2.a]) * s2;
        var nn = (mat2.E * mat2.A / L2) * ext;
        force[mi2] = nn;
        stress[mi2] = nn / mat2.A;
        if (mat2.tensionOnly && nn < -1e-6) {
          /* 受压缆索 → 松弛，退出刚度矩阵重解 */
          slack[mi2] = true;
          newlySlack = true;
          force[mi2] = 0; stress[mi2] = 0; ratio[mi2] = 0;
        } else {
          ratio[mi2] = mat2.tensionOnly ? Math.max(0, nn) / (mat2.A * mat2.strength)
                                       : Math.abs(nn) / (mat2.A * mat2.strength);
        }
      }
      last = { ux: ux, uy: uy, force: force, stress: stress, ratio: ratio, maxDisp: maxDisp, maxDeflection: maxDefl, iter: iter, slack: Object.keys(slack).map(Number) };
      if (!newlySlack) break;
    }

    return {
      unstable: false,
      nodes: nodes,
      members: members,
      ux: last.ux, uy: last.uy,
      force: last.force, stress: last.stress, ratio: last.ratio,
      maxDisp: last.maxDisp, maxDeflection: last.maxDeflection,
      slack: last.slack,
      iter: last.iter
    };
  }

  /** 以“二分位置”把车辆重量分给所在梁的两端节点 */
  function distributeLoad(loads, nodeA, nodeB, weight, t) {
    t = Math.max(0, Math.min(1, t));
    var fa = weight * (1 - t), fb = weight * t;
    loads.push({ node: nodeA, fx: 0, fy: fa });
    loads.push({ node: nodeB, fx: 0, fy: fb });
    return loads;
  }

  return {
    MATERIALS: MATERIALS, mat: mat, lengthOf: lengthOf, memberCost: memberCost,
    solve: solve, distributeLoad: distributeLoad
  };
});
