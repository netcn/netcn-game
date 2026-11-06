/* ============================================================
   切绳救星 · 绳索物理（Verlet 积分 + 距离约束）
   - 固定子步长、多次约束迭代、多锚点共享目标节点
   - 切割判定（点选 / 划线），绳索张力分级
   - 危险物碰撞、安全网救援、失败判定
   纯逻辑，无 DOM 依赖，可在 Node 下单测
   ============================================================ */
(function (root) {
  'use strict';

  var GRAV = 520;
  var TARGET_R = 13;
  var ITERATIONS = 7;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function makeNode(x, y, im, kind) {
    return { x: x, y: y, ox: x, oy: y, im: im, kind: kind || 'free' };
  }

  function create(level) {
    var world = {
      level: level,
      time: 0,
      realTime: 0,
      freezeT: 0,
      targets: [],
      nodes: [],
      strands: [],
      hooks: [],
      gems: level.gems.map(function (g) { return { x: g.x, y: g.y, r: g.r, got: false }; }),
      rescued: 0,
      lost: 0,
      gemCount: 0,
      failReason: '',
      sawPos: [],
      pendPos: [],
      lastCutPoint: null
    };

    level.targets.forEach(function (td) {
      var node = makeNode(td.x, td.y, 0.5, 'target');
      world.nodes.push(node);
      var t = {
        id: td.id, node: node, r: TARGET_R,
        rescued: false, lost: false,
        trail: [], spark: 0
      };
      world.targets.push(t);

      td.strands.forEach(function (sd) {
        var links = clamp(Math.round(sd.len / 22), 4, 11);
        var nodes = [makeNode(sd.ax, sd.ay, 0, 'anchor')];
        for (var i = 1; i < links; i++) {
          var f = i / links;
          nodes.push(makeNode(sd.ax + (td.x - sd.ax) * f, sd.ay + (td.y - sd.ay) * f, 1, 'rope'));
        }
        var segs = [];
        var segLen = sd.len / links;
        for (var k = 0; k < links - 1; k++) {
          segs.push({ a: nodes[k], b: nodes[k + 1], len: segLen, alive: true });
        }
        segs.push({ a: nodes[links - 1], b: node, len: segLen, alive: true });
        var strand = {
          index: world.strands.length,
          targetId: td.id,
          anchor: { x: sd.ax, y: sd.ay },
          nodes: nodes,
          links: segs,
          alive: true,
          cutPoint: null,
          tension: 0
        };
        nodes.forEach(function (n) { world.nodes.push(n); });
        world.strands.push(strand);
      });
    });

    world.sawPos = level.saws.map(function (s) { return { x: s.x, y: s.y }; });
    world.pendPos = level.pendulums.map(function (p) { return { x: p.px, y: p.py + p.len }; });
    updateHazards(world);
    return world;
  }

  function updateHazards(world) {
    var L = world.level, t = world.time;
    for (var i = 0; i < L.saws.length; i++) {
      var s = L.saws[i];
      var o = Math.sin(t * s.spd + s.phase) * s.amp;
      world.sawPos[i].x = s.axis === 'x' ? s.x + o : s.x;
      world.sawPos[i].y = s.axis === 'x' ? s.y : s.y + o;
    }
    for (var j = 0; j < L.pendulums.length; j++) {
      var p = L.pendulums[j];
      var a = Math.sin(t * p.spd + p.phase) * p.amp;
      world.pendPos[j].x = p.px + Math.sin(a) * p.len;
      world.pendPos[j].y = p.py + Math.cos(a) * p.len;
    }
  }

  function liveStrands(world, targetId) {
    var out = [];
    for (var i = 0; i < world.strands.length; i++) {
      var s = world.strands[i];
      if (s.targetId === targetId && s.alive) out.push(s);
    }
    return out;
  }

  function isAttached(world, targetId) {
    return liveStrands(world, targetId).length > 0;
  }

  function integrate(world, dt, node) {
    if (node.im === 0 || node.kind === 'anchor') return;
    var vx = (node.x - node.ox) * 0.9995;
    var vy = (node.y - node.oy) * 0.9995;
    node.ox = node.x; node.oy = node.y;
    node.x += vx;
    node.y += vy + GRAV * dt * dt;
  }

  function solveLink(world, link) {
    if (!link.alive) return;
    var a = link.a, b = link.b;
    if (a.im === 0 && b.im === 0) return;
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    var diff = (dist - link.len) / dist;
    var wa = a.im / (a.im + b.im);
    var wb = b.im / (a.im + b.im);
    a.x += dx * diff * wa;
    a.y += dy * diff * wa;
    b.x -= dx * diff * wb;
    b.y -= dy * diff * wb;
  }

  function solveHooks(world) {
    for (var i = 0; i < world.hooks.length; i++) {
      var h = world.hooks[i];
      if (h.t <= 0) continue;
      var tgt = null;
      for (var j = 0; j < world.targets.length; j++) {
        if (world.targets[j].id === h.targetId) { tgt = world.targets[j]; break; }
      }
      if (!tgt || tgt.rescued || tgt.lost) continue;
      var n = tgt.node;
      var dx = n.x - h.x, dy = n.y - h.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      var diff = (dist - h.len) / dist;
      n.x -= dx * diff;
      n.y -= dy * diff;
      h.hx = n.x; h.hy = n.y;
    }
  }

  function substep(world, dt) {
    var i, n;
    for (i = 0; i < world.nodes.length; i++) {
      n = world.nodes[i];
      if (n.kind === 'target') {
        var tgt = findTargetByNode(world, n);
        if (!tgt || tgt.rescued || tgt.lost) continue;
      }
      integrate(world, dt, n);
    }
    for (var it = 0; it < ITERATIONS; it++) {
      for (i = 0; i < world.strands.length; i++) {
        var s = world.strands[i];
        if (!s.alive) continue;
        for (var k = 0; k < s.links.length; k++) solveLink(world, s.links[k]);
      }
      solveHooks(world);
    }
    /* 张力：链路伸长比 + 目标动态速度（用于绷紧/松弛着色） */
    for (i = 0; i < world.strands.length; i++) {
      s = world.strands[i];
      if (!s.alive) continue;
      var maxErr = 0;
      for (k = 0; k < s.links.length; k++) {
        var lk = s.links[k];
        if (!lk.alive) continue;
        var d = Math.hypot(lk.b.x - lk.a.x, lk.b.y - lk.a.y);
        maxErr = Math.max(maxErr, Math.abs(d - lk.len) / lk.len);
      }
      var tgNode = world.targets[s.targetId].node;
      var speed = Math.hypot(tgNode.x - tgNode.ox, tgNode.y - tgNode.oy) / Math.max(0.0001, dt);
      s.tension = clamp(maxErr * 4 + speed / 320, 0, 1);
    }
  }

  function findTargetByNode(world, node) {
    for (var i = 0; i < world.targets.length; i++) {
      if (world.targets[i].node === node) return world.targets[i];
    }
    return null;
  }

  /** 固定子步长推进；timeScale 用于冻结道具 */
  function step(world, dtReal, timeScale) {
    if (world.failReason || !world.level) return;
    var scale = world.freezeT > 0 ? 0.35 : (timeScale == null ? 1 : timeScale);
    if (world.freezeT > 0) world.freezeT = Math.max(0, world.freezeT - dtReal);
    world.realTime += dtReal;
    world.time += dtReal * scale;

    var sub = Math.max(2, Math.min(5, Math.ceil(dtReal / 0.006)));
    var dt = dtReal * scale / sub;
    for (var i = 0; i < sub; i++) {
      substep(world, dt);
      /* 每个子步后立即结算自由目标的碰撞，避免穿透 */
      checkTargets(world);
      if (world.failReason) return;
    }
    updateHazards(world);

    /* 挂钩倒计时（按真实时间） */
    for (var h = world.hooks.length - 1; h >= 0; h--) {
      world.hooks[h].t -= dtReal;
      if (world.hooks[h].t <= 0) world.hooks.splice(h, 1);
    }

    /* 轨迹点（渲染拖尾） */
    for (var t = 0; t < world.targets.length; t++) {
      var tg = world.targets[t];
      if (tg.rescued || tg.lost) continue;
      if (!isAttached(world, tg.id) || tg.spark > 0) {
        tg.trail.push({ x: tg.node.x, y: tg.node.y, a: 1 });
        if (tg.trail.length > 18) tg.trail.shift();
      }
      for (var q = 0; q < tg.trail.length; q++) tg.trail[q].a *= 0.94;
    }
  }

  function hazardKill(world, x, y, r) {
    var L = world.level;
    for (var i = 0; i < L.saws.length; i++) {
      var sp = world.sawPos[i], s = L.saws[i];
      if (Math.hypot(x - sp.x, y - sp.y) < s.r + r) return 'saw';
    }
    for (var j = 0; j < world.pendPos.length; j++) {
      var pp = world.pendPos[j], p = L.pendulums[j];
      if (Math.hypot(x - pp.x, y - pp.y) < p.r + r) return 'pendulum';
    }
    for (var k = 0; k < L.magmas.length; k++) {
      var m = L.magmas[k];
      if (x > m.x && x < m.x + m.w && y > m.y && y < m.y + m.h) return 'magma';
    }
    return '';
  }

  function checkTargets(world) {
    var net = world.level.net;
    for (var i = 0; i < world.targets.length; i++) {
      var t = world.targets[i];
      if (t.rescued || t.lost) continue;
      var n = t.node;
      /* 宝石收集（自由/悬挂目标都可触发） */
      for (var g = 0; g < world.gems.length; g++) {
        var gem = world.gems[g];
        if (!gem.got && Math.hypot(n.x - gem.x, n.y - gem.y) < gem.r + t.r + 2) {
          gem.got = true; world.gemCount++;
        }
      }
      if (isAttached(world, t.id)) continue;
      var kill = hazardKill(world, n.x, n.y, t.r);
      if (kill) { loseTarget(world, t, kill); continue; }
      if (n.x < -20 || n.x > 560) { loseTarget(world, t, 'out'); continue; }
      if (n.y >= net.y - 6) {
        if (Math.abs(n.x - net.x) <= net.half + t.r - 2) {
          t.rescued = true;
          t.node.x = net.x + clamp(n.x - net.x, -net.half + 8, net.half - 8);
          t.node.y = net.y - 8;
          world.rescued++;
        } else {
          loseTarget(world, t, 'spike');
        }
        continue;
      }
      if (n.y > 470) loseTarget(world, t, 'out');
    }
  }

  function loseTarget(world, t, reason) {
    t.lost = true;
    world.lost++;
    if (!world.failReason) world.failReason = reason;
  }

  function fail(world, reason) {
    if (!world.failReason) world.failReason = reason || 'time';
  }

  /* ---------- 切割 ---------- */
  function pointsOf(strand) {
    var pts = [];
    for (var i = 0; i < strand.nodes.length; i++) pts.push(strand.nodes[i]);
    return pts;
  }

  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  function nearest(world, x, y, tol) {
    var best = null;
    for (var i = 0; i < world.strands.length; i++) {
      var s = world.strands[i];
      if (!s.alive) continue;
      var tgt = world.targets[s.targetId];
      if (tgt.rescued || tgt.lost) continue;
      var pts = s.nodes.concat([tgt.node]);
      for (var k = 0; k < pts.length - 1; k++) {
        var ax = pts[k].x, ay = pts[k].y, bx = pts[k + 1].x, by = pts[k + 1].y;
        var d = segDist(x, y, ax, ay, bx, by);
        if (d <= (tol || 16) && (!best || d < best.dist)) {
          best = {
            strand: s.index, dist: d, seg: k,
            x: (ax + bx) / 2, y: (ay + by) / 2
          };
        }
      }
    }
    return best;
  }

  function side(p1x, p1y, p2x, p2y, px, py) {
    return (p2x - p1x) * (py - p1y) - (p2y - p1y) * (px - p1x);
  }
  function cross(ax, ay, bx, by, cx, cy, dx, dy) {
    var d1 = side(ax, ay, bx, by, cx, cy);
    var d2 = side(ax, ay, bx, by, dx, dy);
    var d3 = side(cx, cy, dx, dy, ax, ay);
    var d4 = side(cx, cy, dx, dy, bx, by);
    return d1 * d2 <= 0 && d3 * d4 <= 0;
  }

  /** 划线命中的全部绳段（按距离排序） */
  function lineHits(world, ax, ay, bx, by, tol) {
    var hits = [];
    for (var i = 0; i < world.strands.length; i++) {
      var s = world.strands[i];
      if (!s.alive) continue;
      var tgt = world.targets[s.targetId];
      if (tgt.rescued || tgt.lost) continue;
      var pts = s.nodes.concat([tgt.node]);
      for (var k = 0; k < pts.length - 1; k++) {
        var p1 = pts[k], p2 = pts[k + 1];
        if (cross(ax, ay, bx, by, p1.x, p1.y, p2.x, p2.y)) {
          hits.push({ strand: s.index, seg: k, dist: 0, x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
          break;
        }
        if (tol && segDist(p1.x, p1.y, ax, ay, bx, by) < tol) {
          hits.push({ strand: s.index, seg: k, dist: 0, x: p1.x, y: p1.y });
          break;
        }
      }
    }
    return hits;
  }

  function cut(world, index) {
    var s = world.strands[index];
    if (!s || !s.alive) return null;
    s.alive = false;
    for (var k = 0; k < s.links.length; k++) s.links[k].alive = false;
    var pts = s.nodes.concat([world.targets[s.targetId].node]);
    var mid = Math.floor(pts.length / 2);
    s.cutPoint = { x: (pts[mid - 1].x + pts[mid].x) / 2, y: (pts[mid - 1].y + pts[mid].y) / 2 };
    world.lastCutPoint = s.cutPoint;
    return world.targets[s.targetId];
  }

  function cutAt(world, x, y, tol) {
    var hit = nearest(world, x, y, tol);
    if (!hit) return null;
    return { strand: cut(world, hit.strand), point: hit };
  }

  /* ---------- 存档快照 ---------- */
  function snapshot(world) {
    return {
      time: world.time,
      realTime: world.realTime,
      rescued: world.rescued,
      nodeState: world.nodes.map(function (n) {
        return [Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10,
          Math.round(n.ox * 10) / 10, Math.round(n.oy * 10) / 10];
      }),
      targetState: world.targets.map(function (t) {
        return [t.rescued ? 1 : 0, t.lost ? 1 : 0, t.trail.length];
      }),
      strandState: world.strands.map(function (s) { return s.alive ? 1 : 0; }),
      gems: world.gems.map(function (g) { return g.got ? 1 : 0; }),
      failReason: world.failReason
    };
  }

  function restore(world, snap) {
    if (!snap || !snap.nodeState || snap.nodeState.length !== world.nodes.length) return false;
    for (var i = 0; i < world.nodes.length; i++) {
      var a = snap.nodeState[i];
      if (!a || a.length < 4) return false;
      world.nodes[i].x = a[0]; world.nodes[i].y = a[1];
      world.nodes[i].ox = a[2]; world.nodes[i].oy = a[3];
    }
    for (var s = 0; s < world.strands.length; s++) {
      var alive = snap.strandState && snap.strandState[s] ? true : false;
      world.strands[s].alive = alive;
      for (var k = 0; k < world.strands[s].links.length; k++) {
        world.strands[s].links[k].alive = alive ? true : false;
      }
    }
    for (var t = 0; t < world.targets.length; t++) {
      var ts = snap.targetState && snap.targetState[t];
      if (!ts) continue;
      world.targets[t].rescued = !!ts[0];
      world.targets[t].lost = !!ts[1];
    }
    if (snap.gems) {
      for (var g = 0; g < world.gems.length; g++) world.gems[g].got = !!snap.gems[g];
    }
    world.time = snap.time || 0;
    world.realTime = snap.realTime || 0;
    world.rescued = snap.rescued || 0;
    world.failReason = snap.failReason || '';
    updateHazards(world);
    return true;
  }

  function offset(x, y) { return { x: x, y: y }; }

  var RopePhysics = {
    GRAV: GRAV,
    TARGET_R: TARGET_R,
    ITERATIONS: ITERATIONS,
    create: create,
    step: step,
    substep: substep,
    updateHazards: updateHazards,
    liveStrands: liveStrands,
    isAttached: isAttached,
    nearest: nearest,
    lineHits: lineHits,
    cut: cut,
    cutAt: cutAt,
    fail: fail,
    snapshot: snapshot,
    restore: restore,
    loseTarget: loseTarget,
    /* 测试辅助：直接判定一次（不推进物理） */
    tickCheck: checkTargets
  };

  root.RopePhysics = RopePhysics;
  if (typeof module !== 'undefined' && module.exports) module.exports = RopePhysics;
})(typeof window !== 'undefined' ? window : globalThis);
