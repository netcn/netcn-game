/* ============================================================
   数回 Slitherlink · 经典逻辑谜题（旗舰级）
   规则：把格点连成一个闭合环；格子里的数字 = 它周围被画线的边数；
         所有线必须形成一条单一闭合环（无分支、无断头）。
   质量核心：
     - 程序化生成：双路径法随机生成简单闭合环（可靠不自交）
     - 挖洞后必须「唯一解」：带约束传播的回溯求解器验证
       （数字约束 + 格点度数 + 单环连通性），生成不到唯一解自动重试
   记分：min 模式，操作步数越少越好
   ============================================================ */

(function () {
  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.slitherlink.tut1t'), d: T('gs.slitherlink.tut1') },
    { t: T('gs.slitherlink.tut2t'), d: T('gs.slitherlink.tut2') },
    { t: T('gs.slitherlink.tut3t'), d: T('gs.slitherlink.tut3') }
  ];
  /* ================= 纯逻辑：生成与求解 ================= */

  /** 生成一个简单闭合环（双路径法）
      rows/cols：格子数；环经过格点坐标集合（不包含起点重复，视为闭合）
      rng 可选：确定性随机源（每日一题用） */
  function genLoop(rows, cols, rng) {
    rng = rng || Math.random;
    var GN = rows + 1, GM = cols + 1; // 格点网格
    for (var attempt = 0; attempt < 300; attempt++) {
      // 随机选 A、B 两个格点（曼哈顿距离 >= 4）
      var ax = Math.floor(rng() * GM), ay = Math.floor(rng() * GN);
      var bx = Math.floor(rng() * GM), by = Math.floor(rng() * GN);
      if (Math.abs(ax - bx) + Math.abs(ay - by) < 4) continue;
      var p1 = randPath(ax, ay, bx, by, GN, GM, null, rng);
      if (!p1) continue;
      // 占用 p1 的内部点（排除端点）后再找第二条 B→A 的反向路径（两路合拢成环）
      var blocked = {};
      for (var i = 1; i < p1.length - 1; i++) blocked[p1[i].y * 100 + p1[i].x] = true;
      var p2 = randPath(bx, by, ax, ay, GN, GM, blocked, rng);
      if (!p2) continue;
      // 环 = p1(A→B) + p2(B→A)，p2 去掉起点 B（与 p1 终点重合）
      // 注意：p2 终点 A 与 p1 起点 A 重合，边数为 all.length - 1，不能用 (j+1)%len 否则产生自环边
      var all = p1.concat(p2.slice(1));
      var edges = {};
      var ok = true;
      for (var j = 0; j < all.length - 1; j++) {
        var a = all[j], b = all[j + 1];
        var key = edgeKey(a.x, a.y, b.x, b.y);
        if (edges[key]) { ok = false; break; }
        edges[key] = true;
      }
      if (!ok || Object.keys(edges).length < 8) continue;
      return { edges: edges, path: all };
    }
    return null;
  }

  function edgeKey(x1, y1, x2, y2) {
    if (x1 > x2 || (x1 === x2 && y1 > y2)) { var t = x1; x1 = x2; x2 = t; t = y1; y1 = y2; y2 = t; }
    return x1 + ',' + y1 + '-' + x2 + ',' + y2;
  }

  /** 随机 A→B 不自交路径（随机化 BFS 生成树，树路径天然无环；blocked 为不可经过点集） */
  function randPath(ax, ay, bx, by, GN, GM, blocked, rng) {
    rng = rng || Math.random;
    for (var attempt = 0; attempt < 30; attempt++) {
      var parent = {};
      var seen = {};
      seen[ay * 100 + ax] = true;
      var queue = [[ax, ay]];
      var found = false;
      var guard = 0;
      while (queue.length && guard++ < 5000) {
        // 随机化 BFS 顺序（随机取队中任意元素）
        var idx = Math.floor(rng() * queue.length);
        var cur = queue[idx];
        queue.splice(idx, 1);
        if (cur[0] === bx && cur[1] === by) { found = true; break; }
        var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        for (var i = dirs.length - 1; i > 0; i--) { var j2 = Math.floor(rng() * (i + 1)); var t2 = dirs[i]; dirs[i] = dirs[j2]; dirs[j2] = t2; }
        for (var d = 0; d < dirs.length; d++) {
          var nx = cur[0] + dirs[d][0], ny = cur[1] + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= GM || ny >= GN) continue;
          if (blocked && blocked[ny * 100 + nx]) continue;
          var k = ny * 100 + nx;
          if (seen[k]) continue;
          seen[k] = true;
          parent[k] = [cur[0], cur[1]];
          queue.push([nx, ny]);
        }
      }
      if (!found) continue;
      // 回溯路径
      var path = [];
      var c = [bx, by];
      while (true) {
        path.unshift({ x: c[0], y: c[1] });
        if (c[0] === ax && c[1] === ay) break;
        c = parent[c[1] * 100 + c[0]];
        if (!c) { path = null; break; }
      }
      if (path) return path;
    }
    return null;
  }

  /** 由环生成数字板（返回 rows x cols 的数字，-1 表示挖空） */
  function numbersFromLoop(loop, rows, cols) {
    var nums = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        var n = 0;
        // 四边：上 (r,c)-(r,c+1) 下 (r+1,c)-(r+1,c+1) 左 (r,c)-(r+1,c) 右 (r,c+1)-(r+1,c+1)
        if (loop.edges[edgeKey(c, r, c + 1, r)]) n++;
        if (loop.edges[edgeKey(c, r + 1, c + 1, r + 1)]) n++;
        if (loop.edges[edgeKey(c, r, c, r + 1)]) n++;
        if (loop.edges[edgeKey(c + 1, r, c + 1, r + 1)]) n++;
        row.push(n);
      }
      nums.push(row);
    }
    return nums;
  }

  /** 挖洞：贪心最小化线索——逐个格子尝试移除，若仍唯一解则保留移除（含 0 数字）
      keepRatio: 目标保留比例下限；budgetMs: 挖洞总时间预算（超时即停，已挖的都是合法唯一解）
      loop: 目标环（加速验证：找到的解≠目标环立即判多解） */
  function carve(nums, keepRatio, budgetMs, loop, rng) {
    rng = rng || Math.random;
    var rows = nums.length, cols = nums[0].length;
    var clues = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(nums[r][c]);
      clues.push(row);
    }
    // 随机顺序尝试挖掉数字，保持唯一解
    var order = [];
    for (var i = 0; i < rows * cols; i++) order.push(i);
    for (var j = order.length - 1; j > 0; j--) { var k2 = Math.floor(rng() * (j + 1)); var t2 = order[j]; order[j] = order[k2]; order[k2] = t2; }
    var total = rows * cols;
    var removed = 0;
    var targetRemove = Math.floor(total * (1 - keepRatio));
    var deadline = budgetMs ? Date.now() + budgetMs : 0;
    var perSolve = Math.max(80, (budgetMs || 600) / (targetRemove + 1));
    for (var idx = 0; idx < order.length; idx++) {
      if (removed >= targetRemove) break;
      if (deadline && Date.now() > deadline) break; // 时间预算耗尽，保留当前合法题
      var r2 = Math.floor(order[idx] / cols), c2 = order[idx] % cols;
      var old = clues[r2][c2];
      clues[r2][c2] = -1;
      var res = countSolutions(clues, loop, 2, perSolve);
      if (res.limit || res.count !== 1) {
        clues[r2][c2] = old; // 恢复
      } else {
        removed++;
      }
    }
    return clues;
  }

  /* ---------- 求解器 ---------- */
  /** 构造边变量数组，返回 {edges: [{h:bool,v:bool,x1,y1,x2,y2}], neighbors...}
      rows x cols 格子；边索引：水平 H[r][c] r∈[0..rows] c∈[0..cols-1]；垂直 V[r][c] r∈[0..rows-1] c∈[0..cols] */
  function buildEdges(rows, cols) {
    var list = [];
    var H = [], V = [];
    for (var r = 0; r <= rows; r++) { H[r] = []; for (var c = 0; c < cols; c++) { var e = { v: 0, key: edgeKey(c, r, c + 1, r), r1: r, c1: c, r2: r, c2: c + 1, h: true }; H[r][c] = e; list.push(e); } }
    for (var r2 = 0; r2 < rows; r2++) { V[r2] = []; for (var c2 = 0; c2 <= cols; c2++) { var e2 = { v: 0, key: edgeKey(c2, r2, c2, r2 + 1), r1: r2, c1: c2, r2: r2 + 1, c2: c2, h: false }; V[r2][c2] = e2; list.push(e2); } }
    return { list: list, H: H, V: V };
  }

  /** 求解：返回解数量（最多找 limit 个），并验证是否为单一闭合环
      loop 可选：生成器场景传入目标环，找到的解若 ≠ 目标环则直接判多解（大幅提速）
      budgetMs 可选：搜索时间预算（毫秒），超时抛 'timeout' 由调用方处理 */
  function countSolutions(clues, loop, limit, budgetMs) {
    var rows = clues.length, cols = clues[0].length;
    var B = buildEdges(rows, cols);
    var state = {}; // key -> -1 未定 / 0 不画 / 1 画
    B.list.forEach(function (e) { state[e.key] = -1; });
    var solution = null;
    var count = 0;
    var nodes = 0;
    var MAX_NODES = rows * cols * 9000;
    var deadline = budgetMs ? Date.now() + budgetMs : 0;

    // 数字格子周围四边 key
    function cellEdges(r, c) {
      return [
        B.H[r][c].key, B.H[r + 1][c].key,
        B.V[r][c].key, B.V[r][c + 1].key
      ];
    }

    /** 约束传播；返回 {ok, touched}——touched 为本次传播改动过的边 key 列表（供回溯撤销） */
    function propagate() {
      var touched = [];
      function set(k, v) {
        if (state[k] !== v) { state[k] = v; touched.push(k); return true; }
        return false;
      }
      var changed = true;
      while (changed) {
        changed = false;
        // 数字约束
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var num = clues[r][c];
            if (num < 0) continue;
            var ks = cellEdges(r, c);
            var on = 0, und = 0, undK = [];
            for (var i = 0; i < 4; i++) {
              var s = state[ks[i]];
              if (s === 1) on++;
              else if (s === -1) { und++; undK.push(ks[i]); }
            }
            if (on > num) return { ok: false, touched: touched };
            if (on === num) { for (var j = 0; j < undK.length; j++) { if (set(undK[j], 0)) changed = true; } }
            else if (on + und === num) { for (var j2 = 0; j2 < undK.length; j2++) { if (set(undK[j2], 1)) changed = true; } }
          }
        }
        // 格点度数：每个格点最多 2 条线；已有 2 条则其余相邻边排除
        for (var gy = 0; gy <= rows; gy++) {
          for (var gx = 0; gx <= cols; gx++) {
            var keys = [];
            if (gy > 0) keys.push(B.V[gy - 1][gx].key);
            if (gy < rows) keys.push(B.V[gy][gx].key);
            if (gx > 0) keys.push(B.H[gy][gx - 1].key);
            if (gx < cols) keys.push(B.H[gy][gx].key);
            var on2 = 0, und2 = [];
            for (var k = 0; k < keys.length; k++) {
              var st = state[keys[k]];
              if (st === 1) on2++;
              else if (st === -1) und2.push(keys[k]);
            }
            if (on2 > 2) return { ok: false, touched: touched };
            if (on2 === 2) { for (var m = 0; m < und2.length; m++) { if (set(und2[m], 0)) changed = true; } }
            // 度数 1 且只剩 1 条未定边：该边必须画（凑成度数 2）
            else if (on2 === 1 && und2.length === 1) { if (set(und2[0], 1)) changed = true; }
            // 度数 1 且无未定边：断头，剪枝
            else if (on2 === 1 && und2.length === 0) return { ok: false, touched: touched };
            // 度数 0 且只有 1 条未定边：可画可不画（不强制）
          }
        }
      }
      return { ok: true, touched: touched };
    }

    function isSolved() {
      // 所有约束满足 + 单一闭合环
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var num = clues[r][c];
          if (num < 0) continue;
          var ks = cellEdges(r, c);
          var on = 0;
          for (var i = 0; i < 4; i++) if (state[ks[i]] === 1) on++;
          if (on !== num) return false;
        }
      }
      // 度数检查
      var edgeOn = [];
      for (var e2 = 0; e2 < B.list.length; e2++) if (state[B.list[e2].key] === 1) edgeOn.push(B.list[e2]);
      if (edgeOn.length === 0) return false;
      for (var gy2 = 0; gy2 <= rows; gy2++) {
        for (var gx2 = 0; gx2 <= cols; gx2++) {
          var kk = [];
          if (gy2 > 0) kk.push(B.V[gy2 - 1][gx2].key);
          if (gy2 < rows) kk.push(B.V[gy2][gx2].key);
          if (gx2 > 0) kk.push(B.H[gy2][gx2 - 1].key);
          if (gx2 < cols) kk.push(B.H[gy2][gx2].key);
          var onn = 0;
          for (var q = 0; q < kk.length; q++) if (state[kk[q]] === 1) onn++;
          if (onn !== 0 && onn !== 2) return false;
        }
      }
      // 单环连通：从任一边起点遍历，走遍所有边
      var start = edgeOn[0];
      var visited = {};
      var curR = start.r1, curC = start.c1, fromR = start.r2, fromC = start.c2;
      var steps = 0;
      while (steps <= edgeOn.length + 1) {
        visited[edgeKey(curC, curR, fromC, fromR)] = true;
        // 当前格点 (curR,curC)，找下一条边（非来自方向）
        var nexts = [];
        if (curR > 0) nexts.push({ e: B.V[curR - 1][curC], nr: curR - 1, nc: curC });
        if (curR < rows) nexts.push({ e: B.V[curR][curC], nr: curR + 1, nc: curC });
        if (curC > 0) nexts.push({ e: B.H[curR][curC - 1], nr: curR, nc: curC - 1 });
        if (curC < cols) nexts.push({ e: B.H[curR][curC], nr: curR, nc: curC + 1 });
        var found2 = null;
        for (var n = 0; n < nexts.length; n++) {
          if (state[nexts[n].e.key] !== 1) continue;
          if (nexts[n].nr === fromR && nexts[n].nc === fromC) continue;
          found2 = nexts[n]; break;
        }
        if (!found2) return false;
        fromR = curR; fromC = curC;
        curR = found2.nr; curC = found2.nc;
        steps++;
        if (curR === start.r1 && curC === start.c1 && fromR === start.r2 && fromC === start.c2) break;
      }
      if (curR !== start.r1 || curC !== start.c1) return false;
      return visited ? Object.keys(visited).length >= edgeOn.length : false;
    }

    function solve() {
      nodes++;
      if (deadline && Date.now() > deadline) throw new Error('timeout');
      if (nodes > MAX_NODES) throw new Error('nodeLimit');
      if (count >= limit) return;
      var pr = propagate();
      if (!pr.ok) return;
      // MRV 启发：选未定边中「邻接有数字格子数最多」的边（约束最强优先），
      // 再按邻接数字值小优先（数字 0/1 约束强）
      var undK = null, bestScore = -1;
      for (var i = 0; i < B.list.length; i++) {
        var e = B.list[i];
        if (state[e.key] !== -1) continue;
        var s = 0;
        // 水平边 (c,r)-(c+1,r) 邻接上方格子 (c,r-1) 与下方格子 (c,r)
        if (e.h) {
          var r1 = e.r1, c1 = e.c1;
          if (r1 > 0 && clues[r1 - 1][c1] >= 0) s += 2 - clues[r1 - 1][c1] * 0.5;
          if (r1 < rows && clues[r1][c1] >= 0) s += 2 - clues[r1][c1] * 0.5;
        } else {
          // 垂直边 (c,r)-(c,r+1) 邻接左格子 (c-1,r) 与右格子 (c,r)
          var r2 = e.r1, c2 = e.c1;
          if (c2 > 0 && clues[r2][c2 - 1] >= 0) s += 2 - clues[r2][c2 - 1] * 0.5;
          if (c2 < cols && clues[r2][c2] >= 0) s += 2 - clues[r2][c2] * 0.5;
        }
        if (s > bestScore) { bestScore = s; undK = e.key; }
      }
      if (!undK) {
        if (isSolved()) {
          // 生成器场景：解必须与目标环一致，否则立即判定多解（不再找第 2 个解）
          if (loop) {
            var mismatch = false;
            for (var mi = 0; mi < B.list.length; mi++) {
              var mk = B.list[mi].key;
              var want = loop.edges[mk] ? 1 : 0;
              if (state[mk] !== want) { mismatch = true; break; }
            }
            if (mismatch) { count = limit; return; } // 有解但不是目标环 → 非唯一目标解，立即终止
          }
          count++;
          if (!solution) { solution = {}; for (var k2 in state) solution[k2] = state[k2]; }
        }
        return;
      }
      // 分支：画 / 不画。用快照回溯（state 很小，深拷贝开销可忽略，绝对正确）
      var snapshot = {};
      for (var sk in state) snapshot[sk] = state[sk];
      state[undK] = 1; solve();
      for (var sk2 in snapshot) state[sk2] = snapshot[sk2];
      state[undK] = 0; solve();
      for (var sk3 in snapshot) state[sk3] = snapshot[sk3];
    }

    try { solve(); } catch (e) {
      if (e.message === 'timeout') return { count: count, limit: true, timeout: true };
      if (e.message !== 'nodeLimit') throw e;
      return { count: count, limit: true };
    }
    return { count: count, limit: false, solution: solution };
  }

  /** 生成一局：返回 {rows, cols, clues, solution(边 key->1)} */
  function generate(rows, cols, keepRatio, budgetMs, rng) {
    rng = rng || Math.random;
    for (var attempt = 0; attempt < 100; attempt++) {
      var loop = genLoop(rows, cols, rng);
      if (!loop) continue;
      var nums = numbersFromLoop(loop, rows, cols);
      var clues = carve(nums, keepRatio, budgetMs, loop, rng);
      var res = countSolutions(clues, loop, 2, Math.max(200, (budgetMs || 0) / 2));
      if (res.limit || res.count !== 1) continue;
      var sol = {};
      for (var k in loop.edges) sol[k] = 1;
      return { rows: rows, cols: cols, clues: clues, solution: sol };
    }
    return null;
  }

  /* mulberry32：确定性 PRNG（每日一题用） */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function todaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /* ================= UI ================= */
  var DIFFS = [
    { name: 'gs.slitherlink.easy', rows: 5, cols: 5, keep: 0.6, budget: 600 },
    { name: 'gs.slitherlink.mid', rows: 7, cols: 7, keep: 0.5, budget: 1500 },
    { name: 'gs.slitherlink.hard', rows: 9, cols: 9, keep: 0.55, budget: 4000 }
  ];
  var diffIdx = 0;

  /* 教学关：三节小盘递进 */
  var TUT_CFG = [
    { rows: 4, cols: 4, keep: 0.55, budget: 500, tip: 'gs.slitherlink.tutTip1' },
    { rows: 5, cols: 4, keep: 0.5, budget: 650, tip: 'gs.slitherlink.tutTip2' },
    { rows: 5, cols: 5, keep: 0.48, budget: 800, tip: 'gs.slitherlink.tutTip3' }
  ];
  /* 关卡包：12 关，三档盘面递增 */
  var PACK_KEY = 'arcade_slitherlink_pack_v1';
  var PACK_LEVELS = 12;
  function packDef(i) {
    var stage = Math.floor(i / 4);
    var size = [5, 6, 7][stage];
    return { rows: size, cols: size, keep: [0.55, 0.5, 0.46][stage], budget: 900, seed: 4100 + i * 97 };
  }
  function loadPackProgress() {
    try { var v = parseInt(localStorage.getItem(PACK_KEY) || '0', 10); return isFinite(v) ? Math.max(0, Math.min(PACK_LEVELS, v)) : 0; } catch (e) { return 0; }
  }
  function savePackProgress(n) {
    try { localStorage.setItem(PACK_KEY, String(n)); } catch (e) {}
  }
  var packProgress = loadPackProgress();

  /* ============================================================
     长期目标持久化（新键，不覆盖旧 pack 进度键）：
       arcade_slitherlink_meta_v1 = 每关星级 / 提示次数 / 本机纪录 / 成就
     ============================================================ */
  var META_KEY = 'arcade_slitherlink_meta_v1';
  var META_VER = 1;
  var HINT_MAX = 5;
  var RECORD_KEEP = 5;
  var ACH = [
    { id: 'first', name: 'gs.slitherlink.ach.first.n', desc: 'gs.slitherlink.ach.first.d' },
    { id: 'chain', name: 'gs.slitherlink.ach.chain.n', desc: 'gs.slitherlink.ach.chain.d' },
    { id: 'nohint', name: 'gs.slitherlink.ach.nohint.n', desc: 'gs.slitherlink.ach.nohint.d' },
    { id: 'stars20', name: 'gs.slitherlink.ach.stars20.n', desc: 'gs.slitherlink.ach.stars20.d' },
    { id: 'tut', name: 'gs.slitherlink.ach.tut.n', desc: 'gs.slitherlink.ach.tut.d' },
    { id: 'big', name: 'gs.slitherlink.ach.big.n', desc: 'gs.slitherlink.ach.big.d' },
    { id: 'all', name: 'gs.slitherlink.ach.all.n', desc: 'gs.slitherlink.ach.all.d' },
    { id: 'fast', name: 'gs.slitherlink.ach.fast.n', desc: 'gs.slitherlink.ach.fast.d' }
  ];
  function blankMeta() {
    return { v: META_VER, levels: {}, times: {}, ach: [], tut: [false, false, false], chain: 0, chainLevel: -1, zeroHints: [], clears: 0 };
  }
  function numOrNull(v) {
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : null;
  }
  function clampInt(v, lo, hi) {
    var n = Math.floor(Number(v));
    if (!isFinite(n)) n = lo;
    return Math.max(lo, Math.min(hi, n));
  }
  function loadMeta() {
    var base = blankMeta(), raw = null;
    try { raw = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return base;
    if (raw.levels && typeof raw.levels === 'object') {
      for (var k in raw.levels) {
        var lv = Number(k);
        if (!(lv >= 0 && lv < PACK_LEVELS)) continue;
        var r = raw.levels[k];
        if (!r || typeof r !== 'object') continue;
        base.levels[lv] = {
          stars: clampInt(r.stars, 0, 3),
          bestMs: numOrNull(r.bestMs),
          bestMoves: clampInt(r.bestMoves, 0, 99999),
          hints: clampInt(r.hints, 0, 9999),
          clears: clampInt(r.clears, 0, 9999),
          lastStars: clampInt(r.lastStars, 0, 3)
        };
      }
    }
    if (raw.times && typeof raw.times === 'object') {
      for (var tk in raw.times) {
        var tl = Number(tk);
        if (!(tl >= 0 && tl < PACK_LEVELS) || !Array.isArray(raw.times[tk])) continue;
        var rows = [];
        for (var ti = 0; ti < raw.times[tk].length && rows.length < RECORD_KEEP; ti++) {
          var it = raw.times[tk][ti];
          if (!it || typeof it !== 'object') continue;
          var tms = Number(it.ms);
          if (!isFinite(tms) || tms <= 0) continue;
          rows.push({
            ms: tms,
            stars: clampInt(it.stars, 0, 3),
            hints: clampInt(it.hints, 0, 999),
            moves: clampInt(it.moves, 0, 99999),
            ts: Number(it.ts) || 0
          });
        }
        rows.sort(function (a, b) { return a.ms - b.ms; });
        base.times[tl] = rows;
      }
    }
    if (Array.isArray(raw.ach)) {
      for (var ai = 0; ai < raw.ach.length; ai++) {
        var aid = raw.ach[ai];
        for (var aj = 0; aj < ACH.length; aj++) {
          if (ACH[aj].id === aid && base.ach.indexOf(aid) < 0) base.ach.push(aid);
        }
      }
    }
    if (Array.isArray(raw.tut)) base.tut = [!!raw.tut[0], !!raw.tut[1], !!raw.tut[2]];
    base.chain = clampInt(raw.chain, 0, 999);
    base.chainLevel = isFinite(Number(raw.chainLevel)) ? Math.floor(Number(raw.chainLevel)) : -1;
    if (Array.isArray(raw.zeroHints)) {
      for (var zi = 0; zi < raw.zeroHints.length; zi++) {
        var zl = Number(raw.zeroHints[zi]);
        if (zl >= 0 && zl < PACK_LEVELS && base.zeroHints.indexOf(zl) < 0) base.zeroHints.push(zl);
      }
    }
    base.clears = clampInt(raw.clears, 0, 99999);
    return base;
  }
  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  }
  function metaLevel(i) {
    if (!meta.levels[i]) {
      meta.levels[i] = { stars: 0, bestMs: null, bestMoves: 0, hints: 0, clears: 0, lastStars: 0 };
    }
    return meta.levels[i];
  }
  function totalStars() {
    var n = 0;
    for (var i = 0; i < PACK_LEVELS; i++) n += meta.levels[i] ? (meta.levels[i].stars || 0) : 0;
    return n;
  }
  function metaClearedCount() {
    var n = 0;
    for (var i = 0; i < PACK_LEVELS; i++) if (meta.levels[i] && meta.levels[i].clears > 0) n++;
    return n;
  }
  function fmtTime(ms) {
    var sec = Math.max(0, Math.floor(Number(ms) / 1000));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function starsHtml(n, size) {
    var cls = size ? ' ' + size : '';
    var out = '<span class="sl-stars-row" role="img" aria-label="' + T('gs.slitherlink.starAria').replace('{n}', n) + '">';
    for (var i = 0; i < 3; i++) out += '<i class="sl-star' + (i < n ? ' on' : '') + cls + '"></i>';
    return out + '</span>';
  }
  var meta = loadMeta();

  var root = document.getElementById('game-root');
  var topHtml =
    '<div class="sl-top">' +
    '  <span>' + T('gs.slitherlink.diff') + ' <span class="stat-value" id="sl-diff"></span></span>' +
    '  <span>' + T('gs.slitherlink.steps') + ' <span class="stat-value" id="sl-steps">0</span></span>' +
    '  <span>' + T('gs.slitherlink.lines').replace('{n}', '<span class="stat-value" id="sl-ok">0</span>') + '</span>' +
    '  <span>' + T('gs.slitherlink.time') + ' <span class="stat-value" id="sl-time">00:00</span></span>' +
    '  <span>' + T('gs.slitherlink.hintsLabel') + ' <span class="stat-value" id="sl-hint-count">0</span></span>' +
    '  <span>' + T('gs.slitherlink.starsLabel') + ' <span class="stat-value" id="sl-star-total">0</span></span>' +
    '</div>' +
    '<div class="mode-row" id="sl-diffs"></div>';
  var msgHtml = '<div class="sl-msg" id="sl-msg" aria-live="polite"></div>';
  var boardHtml = '<div class="sl-stage" id="sl-stage"><div class="sl-board" id="sl-board"></div><canvas class="sl-fx" id="sl-fx"></canvas></div>';
  var ctrlHtml =
    '<div class="game-controls">' +
    '  <button class="btn green" id="sl-check">' + T('gs.slitherlink.check') + '</button>' +
    '  <button class="btn yellow" id="sl-hint">' + T('gs.slitherlink.hintBtn').replace('{n}', '0/' + HINT_MAX) + '</button>' +
    '  <button class="btn" id="sl-tut">' + T('gs.slitherlink.tutBtn') + '</button>' +
    '  <button class="btn purple" id="sl-pack">' + T('gs.slitherlink.packBtn') + '</button>' +
    '  <button class="btn purple" id="sl-ach-btn">' + T('gs.slitherlink.achBtn') + '</button>' +
    '  <button class="btn yellow" id="sl-new">' + T('gs.slitherlink.newPuzzle') + '</button>' +
    '  <button class="btn pink" id="sl-daily">' + T('gs.slitherlink.daily') + '</button>' +
    '</div>' +
    '<div class="sl-pack hidden" id="sl-pack-ov">' +
    '  <div class="sl-pack-card">' +
    '    <div class="sl-pack-head"><span>' + T('gs.slitherlink.packTitle') + '</span><button class="sl-pack-close" id="sl-pack-close" aria-label="close">✕</button></div>' +
    '    <div class="sl-pack-summary" id="sl-pack-sum"></div>' +
    '    <div class="sl-pack-grid" id="sl-pack-grid"></div>' +
    '    <button class="sl-pack-ach" id="sl-pack-ach">' + T('gs.slitherlink.packAch') + '</button>' +
    '    <div class="sl-pack-tip">' + T('gs.slitherlink.packTip') + '</div>' +
    '  </div>' +
    '</div>';
  var ovHtml =
    '<div class="sl-overlay hidden" id="sl-overlay">' +
    '  <div class="sl-ov-card">' +
    '    <div class="sl-ov-title" id="sl-ov-title"></div>' +
    '    <div class="sl-ov-sub" id="sl-ov-sub"></div>' +
    '    <button class="btn green" id="sl-ov-new"></button>' +
    '  </div>' +
    '</div>';
  var achHtml =
    '<div class="sl-ach hidden" id="sl-ach-ov">' +
    '  <div class="sl-ach-card">' +
    '    <div class="sl-pack-head"><span>' + T('gs.slitherlink.achTitle') + '</span><button class="sl-pack-close" id="sl-ach-close" aria-label="close">✕</button></div>' +
    '    <div class="sl-ach-sum" id="sl-ach-sum"></div>' +
    '    <div class="sl-ach-list" id="sl-ach-list"></div>' +
    '    <div class="sl-rec-wrap">' +
    '      <div class="sl-rec-title" id="sl-rec-title"></div>' +
    '      <div class="sl-rec-sub" id="sl-rec-sub"></div>' +
    '      <div class="sl-rec-list" id="sl-rec-list"></div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div id="sl-ach-pop" aria-live="polite"></div>';
  root.innerHTML = topHtml + msgHtml + boardHtml + ctrlHtml + ovHtml + achHtml;

  var stageEl = document.getElementById('sl-stage');
  var boardEl = document.getElementById('sl-board');
  var fxCanvas = document.getElementById('sl-fx');
  var msgEl = document.getElementById('sl-msg');
  var stepsEl = document.getElementById('sl-steps');
  var okEl = document.getElementById('sl-ok');
  var diffEl = document.getElementById('sl-diff');
  var diffRow = document.getElementById('sl-diffs');
  var timeEl = document.getElementById('sl-time');
  var hintCountEl = document.getElementById('sl-hint-count');
  var starTotalEl = document.getElementById('sl-star-total');
  var checkBtn = document.getElementById('sl-check');
  var hintBtn = document.getElementById('sl-hint');
  var newBtn = document.getElementById('sl-new');
  var dailyBtn = document.getElementById('sl-daily');
  var overlayEl = document.getElementById('sl-overlay');
  var ovTitleEl = document.getElementById('sl-ov-title');
  var ovSubEl = document.getElementById('sl-ov-sub');
  var ovNewBtn = document.getElementById('sl-ov-new');
  var tutBtn = document.getElementById('sl-tut');
  var packBtn = document.getElementById('sl-pack');
  var packEl = document.getElementById('sl-pack-ov');
  var packGridEl = document.getElementById('sl-pack-grid');
  var packSumEl = document.getElementById('sl-pack-sum');
  var packCloseBtn = document.getElementById('sl-pack-close');
  var packAchBtn = document.getElementById('sl-pack-ach');
  var achBtn = document.getElementById('sl-ach-btn');
  var achEl = document.getElementById('sl-ach-ov');
  var achCloseBtn = document.getElementById('sl-ach-close');
  var achSumEl = document.getElementById('sl-ach-sum');
  var achListEl = document.getElementById('sl-ach-list');
  var recTitleEl = document.getElementById('sl-rec-title');
  var recSubEl = document.getElementById('sl-rec-sub');
  var recListEl = document.getElementById('sl-rec-list');
  var achPopEl = document.getElementById('sl-ach-pop');

  var puzzle = null;
  var edgeState = {};   // key -> 0 未画 / 1 画 / -1 ✕
  var steps = 0;
  var isDaily = false;  // 当前是否每日一题（解完计入每日挑战）
  var solved = false;   // 是否已判定完成（通关后清档）
  var tutorialOn = false, tutorialStep = 0;
  var packOn = false, packLevel = 0;
  var edgeEls = {};     // edge key -> DOM
  var gridCell = 20, gridOX = 0, gridOY = 0;
  var dragging = false, dragMoved = false, dragKey = null, dragValue = 1, lastKey = null;
  var attemptStartMs = Date.now();
  var runHints = 0;
  var hintTier = 0;
  var timerInt = null;
  var winOverlayTimer = 0;
  var fxRaf = 0;
  var fxW = 0, fxH = 0;


  /* 断点续玩（共享模块，仅存本机） */
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'slitherlink',
      collect: function () {
        if (solved || !puzzle) return null;
        return { puzzle: puzzle, edgeState: edgeState, steps: steps, isDaily: isDaily, diffIdx: diffIdx,
          tutorialOn: tutorialOn, tutorialStep: tutorialStep, packOn: packOn, packLevel: packLevel,
          runHints: runHints, hintTier: hintTier, attemptStartMs: attemptStartMs,
          day: (window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : '' };
      },
      apply: function (s) {
        if (!s || !s.puzzle || !Array.isArray(s.puzzle.clues) || typeof s.puzzle.rows !== 'number' || !s.puzzle.solution || typeof s.puzzle.solution !== 'object') return false;
        if (!s.edgeState || typeof s.edgeState !== 'object') return false;
        /* 每日题跨天失效 */
        if (s.isDaily && s.day !== ((window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : '')) return false;
        puzzle = s.puzzle;
        edgeState = s.edgeState;
        steps = Math.max(0, Number(s.steps) || 0);
        isDaily = !!s.isDaily;
        tutorialOn = !!s.tutorialOn;
        tutorialStep = Number(s.tutorialStep) >= 0 && Number(s.tutorialStep) < TUT_CFG.length ? Number(s.tutorialStep) : 0;
        packOn = !!s.packOn;
        packLevel = Number(s.packLevel) >= 0 && Number(s.packLevel) < PACK_LEVELS ? Number(s.packLevel) : 0;
        diffIdx = Number(s.diffIdx) >= 0 && Number(s.diffIdx) < DIFFS.length ? Number(s.diffIdx) : 0;
        runHints = clampInt(s.runHints, 0, HINT_MAX);
        hintTier = clampInt(s.hintTier, 0, 3);
        var savedStart = Number(s.attemptStartMs);
        attemptStartMs = (isFinite(savedStart) && savedStart > 0 && savedStart <= Date.now()) ? savedStart : Date.now();
        solved = false;
        syncDiffChips();
        diffEl.textContent = currentLabel();
        stepsEl.textContent = String(steps);
        updateMetaHud();
        startTimer();
        var d2 = new Date();
        var dstr = d2.getFullYear() + '-' + (d2.getMonth() + 1) + '-' + d2.getDate();
        msgEl.textContent = isDaily
          ? T('gs.slitherlink.dailyMsg').replace('{d}', dstr).replace('{n}', T(DIFFS[diffIdx].name))
          : (tutorialOn ? T(TUT_CFG[tutorialStep].tip)
          : (packOn ? T('gs.slitherlink.packResume').replace('{n}', packLevel + 1)
          : T('gs.slitherlink.startMsg').replace('{n}', T(DIFFS[diffIdx].name))));
        buildBoard();
        return true;
      }
    });
  }

  function currentLabel() {
    if (tutorialOn) return T('gs.slitherlink.tutPre').replace('{n}', tutorialStep + 1);
    if (packOn) return T('gs.slitherlink.packPre').replace('{n}', packLevel + 1);
    return isDaily ? T('gs.slitherlink.dailyPre').replace('{n}', T(DIFFS[diffIdx].name)) : T(DIFFS[diffIdx].name);
  }
  function syncDiffChips() {
    var bs = diffRow.querySelectorAll('.mode-btn');
    for (var bi = 0; bi < bs.length; bi++) bs[bi].classList.toggle('selected', bi === diffIdx && !tutorialOn && !packOn);
  }
  function resetRound() {
    edgeState = {};
    steps = 0;
    stepsEl.textContent = '0';
    solved = false;
    clearSave();
  }

  /* ============================================================
     计时 / 提示次数 / 星级 HUD
     ============================================================ */
  function beginAttempt() {
    attemptStartMs = Date.now();
    runHints = 0;
    hintTier = 0;
    updateHintHud();
    updateMetaHud();
    renderPackPanel();
    startTimer();
  }
  function startTimer() {
    if (timerInt) clearInterval(timerInt);
    updateTimer();
    timerInt = setInterval(updateTimer, 1000);
  }
  function stopTimer() {
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
  }
  function updateTimer() {
    if (!timeEl) return;
    if (!puzzle || solved) return;
    timeEl.textContent = fmtTime(elapsedMs());
  }
  function elapsedMs() { return Math.max(0, Date.now() - attemptStartMs); }
  function updateHintHud() {
    if (hintCountEl) hintCountEl.textContent = String(runHints);
    if (hintBtn) hintBtn.textContent = T('gs.slitherlink.hintBtn').replace('{n}', runHints + '/' + HINT_MAX);
  }
  function updateMetaHud() {
    if (starTotalEl) starTotalEl.textContent = totalStars() + '/' + (PACK_LEVELS * 3);
  }
  function setMsg(text) { if (msgEl) msgEl.textContent = text; }

  /* ============================================================
     提示分级：文字线索 → 高亮目标边 → 直接落笔
     ============================================================ */
  function parseEdgeKey(key) {
    var m = /^(\d+),(\d+)-(\d+),(\d+)$/.exec(key || '');
    return m ? { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] } : null;
  }
  function clueCellsForEdge(key) {
    var e = parseEdgeKey(key);
    if (!e || !puzzle) return [];
    var out = [];
    if (e.y1 === e.y2) {
      out.push([e.y1 - 1, e.x1]);
      out.push([e.y1, e.x1]);
    } else {
      out.push([e.y1, e.x1 - 1]);
      out.push([e.y1, e.x1]);
    }
    return out.filter(function (rc) {
      return rc[0] >= 0 && rc[0] < puzzle.rows && rc[1] >= 0 && rc[1] < puzzle.cols;
    });
  }
  function drawnAroundCell(r, c) {
    var n = 0;
    var es = [
      edgeKey(c, r, c + 1, r),
      edgeKey(c, r + 1, c + 1, r + 1),
      edgeKey(c, r, c, r + 1),
      edgeKey(c + 1, r, c + 1, r + 1)
    ];
    for (var i = 0; i < es.length; i++) if (edgeState[es[i]] === 1) n++;
    return n;
  }
  function findMissingEdges() {
    var a = [];
    if (!puzzle) return a;
    for (var k in puzzle.solution) if (edgeState[k] !== 1) a.push(k);
    return a;
  }
  function findExtraEdges() {
    var a = [];
    if (!puzzle) return a;
    for (var k in edgeState) if (edgeState[k] === 1 && !puzzle.solution[k]) a.push(k);
    return a;
  }
  function pickHintEdge(list) {
    var best = list[0], bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var k = list[i], score = 0, cells = clueCellsForEdge(k);
      for (var j = 0; j < cells.length; j++) {
        var r = cells[j][0], c = cells[j][1], num = puzzle.clues[r][c];
        if (num >= 0) {
          var need = num - drawnAroundCell(r, c);
          if (need > 0) score += 5 + need;
        }
      }
      if (score > bestScore) { bestScore = score; best = k; }
    }
    return best;
  }
  function textClueFor(key, missingCount) {
    var cells = clueCellsForEdge(key);
    for (var i = 0; i < cells.length; i++) {
      var r = cells[i][0], c = cells[i][1], v = puzzle.clues[r][c];
      if (v >= 0) {
        var drawn = drawnAroundCell(r, c), need = v - drawn;
        if (need > 0) {
          return T('gs.slitherlink.hintClue').replace('{r}', r + 1).replace('{c}', c + 1)
            .replace('{v}', v).replace('{drawn}', drawn).replace('{need}', need);
        }
      }
    }
    return T('gs.slitherlink.hintClueGeneric').replace('{n}', missingCount);
  }
  function hint() {
    var out = { ok: false, tier: hintTier, hints: runHints, key: null, reason: '' };
    if (!puzzle) {
      setMsg(T('gs.slitherlink.hintNoPuzzle'));
      if (Arcade.audio) Arcade.audio.play('error');
      out.reason = 'no-puzzle';
      return out;
    }
    if (solved) {
      setMsg(T('gs.slitherlink.hintSolved'));
      if (Arcade.audio) Arcade.audio.play('ui');
      out.reason = 'solved';
      return out;
    }
    if (runHints >= HINT_MAX) {
      setMsg(T('gs.slitherlink.hintExhausted').replace('{n}', runHints).replace('{m}', HINT_MAX));
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(msgEl);
      out.reason = 'exhausted';
      return out;
    }
    var missing = findMissingEdges(), extra = findExtraEdges();
    if (!missing.length && !extra.length) {
      check();
      if (!solved) {
        setMsg(T('gs.slitherlink.hintDone'));
        if (Arcade.audio) Arcade.audio.play('error');
      }
      out.reason = 'none';
      return out;
    }

    runHints++;
    hintTier = Math.min(3, hintTier + 1);
    if (packOn) {
      var rec = metaLevel(packLevel);
      rec.hints = (rec.hints || 0) + 1;
      saveMeta();
    }
    updateHintHud();
    clearMarks();

    var target = missing.length ? pickHintEdge(missing) : extra[0];
    out.ok = true;
    out.key = target;
    out.tier = hintTier;
    out.hints = runHints;

    if (hintTier === 1) {
      setMsg(missing.length ? textClueFor(target, missing.length)
        : T('gs.slitherlink.hintClueGeneric').replace('{n}', 0));
      out.reason = 'clue';
    } else if (hintTier === 2) {
      var node = edgeEls[target];
      if (node) node.classList.add(missing.length ? 'need' : 'err');
      setMsg(missing.length ? T('gs.slitherlink.hintHighlight') : T('gs.slitherlink.hintExclude'));
      if (Arcade.audio) Arcade.audio.play('ui');
      out.reason = 'highlight';
    } else {
      if (missing.length) {
        applyEdge(target, 1);
        setMsg(T('gs.slitherlink.hintDirect'));
      } else {
        applyEdge(target, -1);
        setMsg(T('gs.slitherlink.hintDirectExclude'));
      }
      out.reason = 'draw';
    }
    writeSave();
    return out;
  }

  /* ============================================================
     星级 / 本机纪录 / 成就
     ============================================================ */
  function computeStars(ms, hints, def) {
    if (!def) return 0;
    var t3 = (def.rows * def.cols) * 2.2 + 30;   // 秒
    var t2 = t3 * 1.7;
    if (hints <= 0) return ms <= t3 * 1000 ? 3 : 2;
    if (hints === 1) return ms <= t2 * 1000 ? 2 : 1;
    return 1;
  }
  function recordPackResult(stars, ms) {
    var lv = packLevel;
    var rec = metaLevel(lv);
    var prevBest = rec.bestMs;
    var newBest = (!prevBest || ms < prevBest);
    if (stars >= (rec.stars || 0) && newBest) {
      rec.bestMs = ms;
      rec.bestMoves = steps;
    }
    rec.stars = Math.max(rec.stars || 0, stars);
    rec.lastStars = stars;
    rec.clears = (rec.clears || 0) + 1;
    var arr = meta.times[lv] || [];
    arr.push({ ms: ms, stars: stars, hints: runHints, moves: steps, ts: Date.now() });
    arr.sort(function (a, b) { return a.ms - b.ms; });
    meta.times[lv] = arr.slice(0, RECORD_KEEP);
    if (runHints === 0 && meta.zeroHints.indexOf(lv) < 0) meta.zeroHints.push(lv);
    if (stars === 3) {
      if (meta.chainLevel === lv - 1) meta.chain = (meta.chain || 0) + 1;
      else meta.chain = 1;
      meta.chainLevel = lv;
    } else {
      meta.chain = 0;
      meta.chainLevel = -1;
    }
    return newBest;
  }
  function hasAch(id) { return meta.ach.indexOf(id) >= 0; }
  function unlockList(ids) {
    var fresh = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], known = false;
      for (var j = 0; j < ACH.length; j++) if (ACH[j].id === id) known = true;
      if (known && !hasAch(id)) { meta.ach.push(id); fresh.push(id); }
    }
    if (fresh.length) {
      saveMeta();
      notifyAchievements(fresh);
      updateMetaHud();
      if (achEl && !achEl.classList.contains('hidden')) renderAchPanel();
    }
    return fresh;
  }
  function checkAchievements(mode, stars, ms) {
    var ids = [];
    if ((meta.clears || 0) >= 1) ids.push('first');
    if (puzzle && (puzzle.rows >= 9 || (mode === 'pack' && puzzle.rows >= 7))) ids.push('big');
    if (mode === 'tutorial') {
      meta.tut[tutorialStep] = true;
      if (meta.tut[0] && meta.tut[1] && meta.tut[2]) ids.push('tut');
    }
    if (mode === 'pack') {
      if (meta.chain >= 3) ids.push('chain');
      if (meta.zeroHints.length >= 5) ids.push('nohint');
      if (totalStars() >= 20) ids.push('stars20');
      if (packProgress >= PACK_LEVELS) ids.push('all');
      if (ms <= 45000) ids.push('fast');
    }
    return unlockList(ids);
  }
  function showAchToast(id) {
    var def = null;
    for (var i = 0; i < ACH.length; i++) if (ACH[i].id === id) def = ACH[i];
    if (!def || !achPopEl) return;
    var item = document.createElement('div');
    item.className = 'sl-ach-pop-item';
    item.innerHTML = '<span class="sl-medal"><i class="sl-star on mid"></i></span>' +
      '<span class="sl-ach-pop-txt"><b>' + T('gs.slitherlink.achUnlocked').replace('{n}', T(def.name)) + '</b>' +
      '<small>' + T(def.desc) + '</small></span>';
    achPopEl.appendChild(item);
    setTimeout(function () { item.classList.add('out'); }, 2800);
    setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 3300);
    if (Arcade.fx) {
      Arcade.fx.flash('var(--neon-yellow)');
      setTimeout(function () { Arcade.fx.centerBurst('var(--neon-yellow)', 18); }, 120);
    }
  }
  function notifyAchievements(fresh) {
    if (!fresh.length) return;
    for (var i = 0; i < fresh.length; i++) {
      (function (id, delay) { setTimeout(function () { showAchToast(id); }, delay); })(fresh[i], i * 460);
    }
    if (Arcade.audio) {
      Arcade.audio.play('record');
      setTimeout(function () { if (Arcade.audio) Arcade.audio.play('win'); }, 500);
    }
  }

  /* ============================================================
     面板渲染：关卡包进度 / 成就 / 本机最佳用时
     ============================================================ */
  function renderPackPanel() {
    if (!packGridEl) return;
    var cleared = Math.max(metaClearedCount(), Math.min(PACK_LEVELS, packProgress));
    if (packSumEl) {
      packSumEl.textContent = T('gs.slitherlink.packSummary')
        .replace('{c}', cleared).replace('{t}', PACK_LEVELS)
        .replace('{s}', totalStars()).replace('{m}', PACK_LEVELS * 3);
    }
    packGridEl.innerHTML = '';
    for (var i = 0; i < PACK_LEVELS; i++) {
      var def = packDef(i);
      var unlocked = i <= packProgress;
      var rec = meta.levels[i];
      var stars = rec ? (rec.stars || 0) : 0;
      var hintN = rec ? (rec.hints || 0) : 0;
      var status = unlocked
        ? (rec && rec.clears > 0 ? T('gs.slitherlink.packHints').replace('{n}', hintN) : (i < packProgress ? T('gs.slitherlink.packDone') : T('gs.slitherlink.packNoStar')))
        : T('gs.slitherlink.packLocked');
      var b = document.createElement('button');
      b.className = 'sl-pack-lv' + (unlocked ? '' : ' locked') + (i < packProgress ? ' done' : '') + (packOn && i === packLevel ? ' active' : '');
      b.innerHTML = '<b>' + (i + 1) + '</b><span>' + def.rows + '×' + def.cols + '</span>' +
        starsHtml(stars) + '<em>' + status + '</em>';
      b.setAttribute('aria-label', T('gs.slitherlink.levelPre').replace('{n}', i + 1) + ', ' + T('gs.slitherlink.starAria').replace('{n}', stars));
      if (unlocked) {
        (function (lv) {
          b.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); startPackLevel(lv); });
        })(i);
      } else {
        b.addEventListener('click', function () {
          if (Arcade.audio) Arcade.audio.play('error');
          msgEl.textContent = T('gs.slitherlink.packNeed');
        });
      }
      packGridEl.appendChild(b);
    }
  }
  function renderAchPanel() {
    if (!achListEl) return;
    if (achSumEl) {
      achSumEl.innerHTML = '<b>' + T('gs.slitherlink.achProgress').replace('{n}', meta.ach.length).replace('{m}', ACH.length) + '</b>' +
        ' · ' + T('gs.slitherlink.packSummary').replace('{c}', Math.max(metaClearedCount(), Math.min(PACK_LEVELS, packProgress)))
          .replace('{t}', PACK_LEVELS).replace('{s}', totalStars()).replace('{m}', PACK_LEVELS * 3);
    }
    achListEl.innerHTML = '';
    for (var i = 0; i < ACH.length; i++) {
      var def = ACH[i], got = hasAch(def.id);
      var item = document.createElement('div');
      item.className = 'sl-ach-item' + (got ? ' got' : '');
      item.style.animationDelay = (i * 0.035) + 's';
      item.innerHTML = '<span class="sl-medal"><i class="sl-star' + (got ? ' on' : '') + ' mid"></i></span>' +
        '<span class="sl-ach-body"><b>' + T(def.name) + '</b><small>' + (got ? T(def.desc) : T('gs.slitherlink.achLocked')) + '</small></span>';
      achListEl.appendChild(item);
    }
    if (recTitleEl) recTitleEl.textContent = T('gs.slitherlink.recordsTitle');
    if (recSubEl) recSubEl.textContent = T('gs.slitherlink.recordsTop').replace('{n}', RECORD_KEEP);
    if (!recListEl) return;
    recListEl.innerHTML = '';
    var levels = [];
    for (var tk in meta.times) {
      var lv = Number(tk);
      if (meta.times[tk] && meta.times[tk].length) levels.push(lv);
    }
    levels.sort(function (a, b) { return a - b; });
    if (!levels.length) {
      recListEl.innerHTML = '<div class="sl-rec-empty">' + T('gs.slitherlink.recordEmpty') + '</div>';
      return;
    }
    for (var li = 0; li < levels.length; li++) {
      var level = levels[li], rows = meta.times[level], rec = meta.levels[level];
      var wrap = document.createElement('div');
      wrap.className = 'sl-rec-lv';
      var head = '<b>' + T('gs.slitherlink.levelPre').replace('{n}', level + 1) + ' · ' + starsHtml(rec ? rec.stars : 0) + '</b>';
      var list = '<ol>';
      for (var ri = 0; ri < rows.length; ri++) {
        var it = rows[ri];
        list += '<li><b>' + (ri + 1) + '. ' + fmtTime(it.ms) + '</b><span>' + starsHtml(it.stars) + ' · ' +
          T('gs.slitherlink.recordHints').replace('{n}', it.hints) + '</span></li>';
      }
      list += '</ol>';
      wrap.innerHTML = head + list;
      recListEl.appendChild(wrap);
    }
  }
  function openAch() {
    if (!achEl) return;
    renderAchPanel();
    achEl.classList.remove('hidden');
  }
  function closeAch() { if (achEl) achEl.classList.add('hidden'); }

  function startPuzzle() {
    clearSave();
    solved = false;
    isDaily = false;
    tutorialOn = false;
    packOn = false;
    var D = DIFFS[diffIdx];
    diffEl.textContent = currentLabel();
    syncDiffChips();
    puzzle = generate(D.rows, D.cols, D.keep, D.budget);
    if (!puzzle) { msgEl.textContent = T('gs.slitherlink.genFail'); return; }
    edgeState = {};
    steps = 0;
    stepsEl.textContent = '0';
    msgEl.textContent = T('gs.slitherlink.startMsg').replace('{n}', T(D.name));
    beginAttempt();
    buildBoard();
  }

  function startTutorial(step) {
    clearSave();
    tutorialOn = true;
    tutorialStep = step;
    packOn = false;
    isDaily = false;
    solved = false;
    var cfg = TUT_CFG[step];
    diffEl.textContent = currentLabel();
    syncDiffChips();
    msgEl.textContent = T(cfg.tip);
    puzzle = generate(cfg.rows, cfg.cols, cfg.keep, cfg.budget);
    if (!puzzle) {
      tutorialOn = false;
      msgEl.textContent = T('gs.slitherlink.genFail');
      startPuzzle();
      return;
    }
    edgeState = {};
    steps = 0;
    stepsEl.textContent = '0';
    if (overlayEl) overlayEl.classList.add('hidden');
    beginAttempt();
    buildBoard();
  }

  function startPackLevel(i) {
    clearSave();
    packOn = true;
    packLevel = Math.max(0, Math.min(PACK_LEVELS - 1, i));
    tutorialOn = false;
    isDaily = false;
    solved = false;
    var def = packDef(packLevel);
    diffEl.textContent = currentLabel();
    syncDiffChips();
    msgEl.textContent = T('gs.slitherlink.packStart').replace('{n}', packLevel + 1);
    puzzle = generate(def.rows, def.cols, def.keep, def.budget, mulberry32(def.seed));
    if (!puzzle) {
      msgEl.textContent = T('gs.slitherlink.genFail');
      packOn = false;
      startPuzzle();
      return;
    }
    edgeState = {};
    steps = 0;
    stepsEl.textContent = '0';
    if (overlayEl) overlayEl.classList.add('hidden');
    if (packEl) packEl.classList.add('hidden');
    beginAttempt();
    buildBoard();
    renderPackPanel();
  }

  function openPack() {
    if (!packEl || !packGridEl) return;
    renderPackPanel();
    packEl.classList.remove('hidden');
  }
  function closePack() { if (packEl) packEl.classList.add('hidden'); }

  function buildBoard() {
    var rows = puzzle.rows, cols = puzzle.cols;
    // grid: 2*rows+1 行 x 2*cols+1 列
    // 响应式格宽：320px 屏不溢出；拖拽画线时可整格吸附
    var maxW = Math.min(640, (window.innerWidth || 375) - 40);
    gridCell = Math.max(12, Math.min(28, Math.floor((maxW - 22) / (2 * cols + 1))));
    boardEl.style.gridTemplateColumns = 'repeat(' + (2 * cols + 1) + ', ' + gridCell + 'px)';
    boardEl.style.gridTemplateRows = 'repeat(' + (2 * rows + 1) + ', ' + gridCell + 'px)';
    boardEl.innerHTML = '';
    edgeEls = {};
    boardEl.classList.remove('solved');
    if (winOverlayTimer) { clearTimeout(winOverlayTimer); winOverlayTimer = 0; }
    stopLoopFx();
    if (overlayEl) overlayEl.classList.add('hidden');
    var dotSize = Math.max(5, Math.min(10, Math.round(gridCell * 0.34)));
    var cellFont = Math.max(10, Math.min(22, Math.round(gridCell * 0.8)));
    for (var gy = 0; gy <= 2 * rows; gy++) {
      for (var gx = 0; gx <= 2 * cols; gx++) {
        var node = document.createElement('div');
        if (gy % 2 === 0 && gx % 2 === 0) {
          node.className = 'sl-dot';
          node.style.width = dotSize + 'px'; node.style.height = dotSize + 'px';
          node.style.borderRadius = '50%';
          node.style.margin = 'auto';
          node.style.background = 'radial-gradient(circle at 35% 30%, #e8f2ff, rgba(130,145,205,.75) 55%, rgba(60,70,120,.7))';
          node.style.boxShadow = '0 0 ' + Math.max(3, dotSize / 2) + 'px rgba(0,240,255,.45)';
        } else if (gy % 2 === 0) {
          // 水平边
          var r = gy / 2, c = (gx - 1) / 2;
          var key = edgeKey(c, r, c + 1, r);
          node.className = 'sl-edge h';
          node.innerHTML = '<span class="bar"></span>';
          node.dataset.key = key;
          bindEdge(node, key);
        } else if (gx % 2 === 0) {
          // 垂直边
          var r2 = (gy - 1) / 2, c2 = gx / 2;
          var key2 = edgeKey(c2, r2, c2, r2 + 1);
          node.className = 'sl-edge v';
          node.innerHTML = '<span class="bar"></span>';
          node.dataset.key = key2;
          bindEdge(node, key2);
        } else {
          // 数字格
          var rr = (gy - 1) / 2, cc = (gx - 1) / 2;
          var n = puzzle.clues[rr][cc];
          node.className = 'sl-cell' + (n === 0 ? ' zero' : '');
          node.dataset.r = rr;
          node.dataset.c = cc;
          node.dataset.num = n;
          node.style.fontSize = cellFont + 'px';
          if (n >= 0) node.textContent = n;
        }
        boardEl.appendChild(node);
      }
    }
    refreshEdges();
    setTimeout(resizeFx, 0);
  }

  /* ============================================================
     Canvas 叠加特效：闭环跑光 + 粒子 + 冲击环
     ============================================================ */
  function resizeFx() {
    if (!fxCanvas || !boardEl) return;
    var w = boardEl.offsetWidth || boardEl.clientWidth;
    var h = boardEl.offsetHeight || boardEl.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    fxW = w; fxH = h;
    fxCanvas.width = Math.floor(w * dpr);
    fxCanvas.height = Math.floor(h * dpr);
    var ctx = fxCanvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', function () { resizeFx(); });
  function edgeEndpoints(key) {
    var e = parseEdgeKey(key);
    if (!e) return null;
    var pad = 10 + (boardEl.clientLeft || 0);
    if (e.y1 === e.y2) {
      var yh = pad + (2 * e.y1 + 0.5) * gridCell;
      return {
        a: { x: pad + (2 * e.x1 + 1) * gridCell, y: yh },
        b: { x: pad + (2 * e.x2) * gridCell, y: yh }
      };
    }
    var xv = pad + (2 * e.x1 + 0.5) * gridCell;
    return {
      a: { x: xv, y: pad + (2 * e.y1 + 1) * gridCell },
      b: { x: xv, y: pad + (2 * e.y2) * gridCell }
    };
  }
  function orderedLoopPoints() {
    if (!puzzle) return [];
    var keys = Object.keys(puzzle.solution);
    if (!keys.length) return [];
    var parsed = {}, adj = {};
    for (var i = 0; i < keys.length; i++) {
      var e = parseEdgeKey(keys[i]);
      if (!e) continue;
      parsed[keys[i]] = e;
      var a = e.x1 + ',' + e.y1, b = e.x2 + ',' + e.y2;
      (adj[a] = adj[a] || []).push(keys[i]);
      (adj[b] = adj[b] || []).push(keys[i]);
    }
    var first = keys[0];
    if (!parsed[first]) return [];
    var cur = first, curV = parsed[first].x1 + ',' + parsed[first].y1;
    var start = curV, seen = {}, pts = [];
    for (var guard = 0; guard < keys.length + 2; guard++) {
      var ce = parsed[cur];
      if (!ce) break;
      var ep = edgeEndpoints(cur);
      if (!ep) break;
      var va = ce.x1 + ',' + ce.y1, vb = ce.x2 + ',' + ce.y2;
      if (curV === va) { pts.push(ep.a, ep.b); curV = vb; }
      else { pts.push(ep.b, ep.a); curV = va; }
      seen[cur] = true;
      if (curV === start) break;
      var cands = (adj[curV] || []).filter(function (k) { return !seen[k]; });
      if (!cands.length) break;
      cur = cands[0];
    }
    return pts;
  }
  var fxToken = 0;
  function stopLoopFx() {
    fxToken++;
    if (fxRaf) { cancelAnimationFrame(fxRaf); fxRaf = 0; }
    if (fxCanvas && fxW && fxH) {
      var ctx0 = fxCanvas.getContext('2d');
      if (ctx0) ctx0.clearRect(0, 0, fxW, fxH);
    }
  }
  function playLoopFx() {
    if (!fxCanvas || !resizeFx) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    resizeFx();
    var ctx = fxCanvas.getContext('2d');
    if (!ctx || !fxW || !fxH) return;
    var pts = orderedLoopPoints();
    if (pts.length < 2) return;
    fxToken++;
    var token = fxToken;
    if (fxRaf) { cancelAnimationFrame(fxRaf); fxRaf = 0; }
    var segs = [];
    var total = 0;
    for (var si = 0; si < pts.length - 1; si++) {
      var p1 = pts[si], p2 = pts[si + 1];
      var len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (len < 0.5) continue;
      segs.push({ a: p1, b: p2, len: len, at: total });
      total += len;
    }
    if (!total) return;
    var t0 = performance.now(), dur = 1450;
    var particles = [];
    function pointAt(length) {
      for (var i2 = 0; i2 < segs.length; i2++) {
        var s = segs[i2];
        if (length <= s.at + s.len) {
          var f = (length - s.at) / s.len;
          return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
        }
      }
      return { x: segs[segs.length - 1].b.x, y: segs[segs.length - 1].b.y };
    }
    function lineTo(ctx2, pts2, upto) {
      ctx2.beginPath();
      ctx2.moveTo(pts2[0].x, pts2[0].y);
      var walked = 0;
      for (var li = 1; li < pts2.length; li++) {
        var lseg = Math.hypot(pts2[li].x - pts2[li - 1].x, pts2[li].y - pts2[li - 1].y);
        if (walked + lseg > upto && upto > 0) {
          var f2 = (upto - walked) / lseg;
          ctx2.lineTo(pts2[li - 1].x + (pts2[li].x - pts2[li - 1].x) * f2, pts2[li - 1].y + (pts2[li].y - pts2[li - 1].y) * f2);
          break;
        }
        ctx2.lineTo(pts2[li].x, pts2[li].y);
        walked += lseg;
      }
      ctx2.stroke();
    }
    function frame(now) {
      if (token !== fxToken) return;
      var prog = Math.min(1, (now - t0) / dur);
      ctx.clearRect(0, 0, fxW, fxH);
      // 底层回路微光
      ctx.save();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(57,255,20,.14)';
      ctx.shadowColor = 'rgba(0,240,255,.55)';
      ctx.shadowBlur = 10;
      lineTo(ctx, pts, total);
      ctx.restore();
      // 跑光轨迹
      var headLen = total * prog;
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(125,255,232,.9)';
      ctx.shadowColor = 'rgba(0,240,255,1)';
      ctx.shadowBlur = 14;
      lineTo(ctx, pts, headLen);
      ctx.restore();
      var head = pointAt(headLen);
      // 光点
      var g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 12);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(.4, 'rgba(141,255,233,.95)');
      g.addColorStop(1, 'rgba(0,240,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(head.x, head.y, 12, 0, Math.PI * 2); ctx.fill();
      // 粒子
      if (prog < .96) {
        for (var pi = 0; pi < 3; pi++) {
          particles.push({
            x: head.x, y: head.y,
            vx: (Math.random() - .5) * 2.2, vy: (Math.random() - .5) * 2.2,
            life: .55 + Math.random() * .35, age: 0,
            size: 1 + Math.random() * 2.2
          });
        }
      }
      for (var pj = particles.length - 1; pj >= 0; pj--) {
        var pa = particles[pj];
        pa.age += 1 / 60;
        if (pa.age >= pa.life) { particles.splice(pj, 1); continue; }
        pa.x += pa.vx; pa.y += pa.vy; pa.vx *= .96; pa.vy *= .96;
        var alpha = 1 - pa.age / pa.life;
        ctx.fillStyle = 'rgba(' + (pj % 3 === 0 ? '255,230,0' : '0,240,255') + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.size, 0, Math.PI * 2); ctx.fill();
      }
      // 冲击环
      if (prog > .84) {
        var q = (prog - .84) / .16;
        var rad = Math.max(fxW, fxH) * .1 + q * Math.max(fxW, fxH) * .48;
        ctx.save();
        ctx.lineWidth = 3 * (1 - q) + .5;
        ctx.strokeStyle = 'rgba(57,255,20,' + (0.75 * (1 - q)).toFixed(3) + ')';
        ctx.shadowColor = 'rgba(57,255,20,.9)';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(fxW / 2, fxH / 2, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (prog < 1) fxRaf = requestAnimationFrame(frame);
      else {
        fxRaf = 0;
        setTimeout(function () {
          if (token === fxToken && fxRaf === 0) ctx.clearRect(0, 0, fxW, fxH);
        }, 900);
      }
    }
    fxRaf = requestAnimationFrame(frame);
  }


  function bindEdge(node, key) {
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', T('gs.slitherlink.edgeAria'));
    edgeEls[key] = node;
    /* 键盘 / 读屏激活（detail=0）；鼠标与触控走棋盘级拖拽逻辑 */
    node.addEventListener('click', function (e) {
      if (e.detail === 0) { e.preventDefault(); cycleEdge(key); }
    });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleEdge(key); }
    });
  }

  /* 命中吸附：整格内任意位置都映射到最近的一条边，有效触控区 ≥ 1 格 */
  function boardOrigin() {
    var rect = boardEl.getBoundingClientRect();
    gridOX = rect.left + (boardEl.clientLeft || 0) + 10;
    gridOY = rect.top + (boardEl.clientTop || 0) + 10;
  }
  function edgeAtPoint(clientX, clientY) {
    if (!puzzle) return null;
    var rows = puzzle.rows, cols = puzzle.cols;
    boardOrigin();
    var ix = Math.floor((clientX - gridOX) / gridCell);
    var iy = Math.floor((clientY - gridOY) / gridCell);
    if (ix < 0 || iy < 0 || ix > 2 * cols || iy > 2 * rows) return null;
    /* 落在格点或数字格中央时，按最近一侧吸附到边 */
    if ((ix % 2) === (iy % 2)) {
      var cx = gridOX + ix * gridCell + gridCell / 2;
      var cy = gridOY + iy * gridCell + gridCell / 2;
      var dx = clientX - cx, dy = clientY - cy;
      if (Math.abs(dy) <= Math.abs(dx)) iy += (dy < 0 ? -1 : 1);
      else ix += (dx < 0 ? -1 : 1);
    }
    if (ix < 0 || iy < 0 || ix > 2 * cols || iy > 2 * rows) return null;
    if (iy % 2 === 0 && ix % 2 === 1) {
      var c1 = (ix - 1) / 2, r1 = iy / 2;
      return { key: edgeKey(c1, r1, c1 + 1, r1) };
    }
    if (iy % 2 === 1 && ix % 2 === 0) {
      var c2 = ix / 2, r2 = (iy - 1) / 2;
      return { key: edgeKey(c2, r2, c2, r2 + 1) };
    }
    return null;
  }
  function pulseEdge(key, on) {
    var node = edgeEls[key];
    if (!node || !Arcade.fx) return;
    var rc = node.getBoundingClientRect();
    Arcade.fx.burst(rc.left + rc.width / 2, rc.top + rc.height / 2,
      on ? 'var(--neon-cyan)' : 'var(--neon-pink)', on ? 5 : 3);
  }
  function applyEdge(key, val) {
    if (solved || !key) return false;
    if (edgeState[key] === val) return false;
    edgeState[key] = val;
    steps++;
    stepsEl.textContent = steps;
    clearMarks();
    refreshEdges();
    if (Arcade.audio) Arcade.audio.play(val === 1 ? 'merge' : (val === -1 ? 'drop' : 'ui'));
    pulseEdge(key, val === 1);
    writeSave();
    return true;
  }
  function cycleEdge(key) {
    if (solved) return;
    var cur = edgeState[key];
    applyEdge(key, cur === 1 ? -1 : (cur === -1 ? 0 : 1));
  }

  /* 拖拽画线：按下确定绘制值，移动经过的边连续应用 */
  boardEl.addEventListener('pointerdown', function (e) {
    if (solved) return;
    var hit = edgeAtPoint(e.clientX, e.clientY);
    if (!hit) return;
    dragging = true;
    dragMoved = false;
    dragKey = hit.key;
    lastKey = null;
    dragValue = edgeState[hit.key] === 1 ? 0 : 1;
    if (e.cancelable) e.preventDefault();
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var hit = edgeAtPoint(e.clientX, e.clientY);
    if (!hit) return;
    if (!dragMoved) {
      if (hit.key === dragKey) return;
      dragMoved = true;
      applyEdge(dragKey, dragValue);
    }
    if (hit.key !== lastKey) {
      lastKey = hit.key;
      applyEdge(hit.key, dragValue);
    }
    if (e.cancelable) e.preventDefault();
  });
  function endDrag() {
    if (!dragging) return;
    var key = dragKey, moved = dragMoved;
    dragging = false;
    dragMoved = false;
    dragKey = null;
    lastKey = null;
    if (!moved && key) cycleEdge(key); // 轻点仍按 画线 → ✕ → 取消 循环
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', function () {
    dragging = false; dragMoved = false; dragKey = null; lastKey = null;
  });

  function refreshEdges() {
    var els = boardEl.querySelectorAll('.sl-edge');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].dataset.key;
      els[i].classList.toggle('on', edgeState[k] === 1);
      els[i].classList.toggle('x', edgeState[k] === -1);
    }
    var cells = boardEl.querySelectorAll('.sl-cell');
    for (var ci = 0; ci < cells.length; ci++) {
      var num = Number(cells[ci].dataset.num);
      if (!(num >= 0)) continue;
      var drawn = drawnAroundCell(Number(cells[ci].dataset.r), Number(cells[ci].dataset.c));
      cells[ci].classList.toggle('full', drawn === num);
      cells[ci].classList.toggle('over', drawn > num);
    }
    okEl.textContent = countOn();
  }

  function countOn() {
    var n = 0;
    for (var k in edgeState) if (edgeState[k] === 1) n++;
    return n;
  }

  function clearMarks() {
    var ms = boardEl.querySelectorAll('.sl-edge.err, .sl-edge.need');
    for (var i = 0; i < ms.length; i++) ms[i].classList.remove('err', 'need');
  }

  /* 错误线段提示：多画的线闪红 */
  function markErrors() {
    var els = boardEl.querySelectorAll('.sl-edge');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].dataset.key;
      var want = puzzle.solution[k] === 1;
      var have = edgeState[k] === 1;
      els[i].classList.toggle('err', have && !want);
    }
  }

  function check() {
    if (!puzzle || solved) return;
    var wrong = 0;
    var solCount = 0;
    for (var k2 in puzzle.solution) solCount++;
    // 只把「多画的线」计入错误；漏画以剩余条数提示，避免直接剧透答案
    for (var k in edgeState) {
      if (edgeState[k] === 1 && !puzzle.solution[k]) wrong++;
    }
    var onCount = countOn();
    if (wrong === 0 && onCount === solCount) {
      solved = true;
      stopTimer();
      var result = completeWin();
      msgEl.textContent = T('gs.slitherlink.win').replace('{n}', steps);
      if (Arcade.juice) Arcade.juice.win();
      if (Arcade.shell) Arcade.shell.submitScore(steps);
      if (Arcade.daily && isDaily) Arcade.daily.markSolved('slitherlink', steps); // 步数非秒：大厅显示口径待统一
      boardEl.classList.add('solved');
      clearMarks();
      playLoopFx();
      if (Arcade.fx) {
        Arcade.fx.flash('var(--neon-green)');
        setTimeout(function () { Arcade.fx.centerBurst('var(--neon-cyan)', 26); }, 240);
        setTimeout(function () { Arcade.fx.centerBurst('var(--neon-green)', 22); }, 580);
      }
      winOverlay(result);
      winOverlayTimer = setTimeout(function () {
        winOverlayTimer = 0;
        if (!solved) return;
        if (packEl && !packEl.classList.contains('hidden')) return;
        if (achEl && !achEl.classList.contains('hidden')) return;
        if (overlayEl) overlayEl.classList.remove('hidden');
      }, 1200);
    } else if (wrong === 0) {
      msgEl.textContent = T('gs.slitherlink.remain').replace('{n}', solCount - onCount);
      if (Arcade.audio) Arcade.audio.play('ui');
    } else {
      msgEl.textContent = T('gs.slitherlink.wrong').replace('{n}', wrong);
      if (Arcade.audio) Arcade.audio.play('error');
      markErrors();
      if (Arcade.fx) Arcade.fx.shake(boardEl);
    }
    writeSave();
  }

  /* 结算：计时 / 星级 / 关卡进度 / 本机纪录 / 成就（全部一次落盘） */
  function completeWin() {
    var ms = elapsedMs();
    stopTimer();
    var mode = tutorialOn ? 'tutorial' : (packOn ? 'pack' : (isDaily ? 'daily' : 'normal'));
    var stars = 0, newBest = false;
    if (packOn) {
      stars = computeStars(ms, runHints, packDef(packLevel));
      newBest = recordPackResult(stars, ms);
      packProgress = Math.max(packProgress, Math.min(PACK_LEVELS, packLevel + 1));
      savePackProgress(packProgress);
    }
    meta.clears = (meta.clears || 0) + 1;
    checkAchievements(mode, stars, ms);
    saveMeta();
    updateMetaHud();
    updateHintHud();
    if (packOn) renderPackPanel();
    if (achEl && !achEl.classList.contains('hidden')) renderAchPanel();
    return { mode: mode, stars: stars, ms: ms, hints: runHints, newBest: newBest, level: packLevel };
  }

  function winOverlay(result) {
    if (!ovTitleEl || !ovSubEl || !ovNewBtn) return;
    var res = result || { ms: elapsedMs(), hints: runHints, stars: 0, newBest: false };
    var timeRow = '<div class="sl-ov-row">' + T('gs.slitherlink.ovTime').replace('{t}', fmtTime(res.ms)) + ' · ' +
      (res.hints ? T('gs.slitherlink.ovHints').replace('{n}', res.hints) : T('gs.slitherlink.ovHintNone')) + '</div>';
    if (tutorialOn) {
      ovTitleEl.textContent = T('gs.slitherlink.tutWin').replace('{n}', tutorialStep + 1);
      ovSubEl.innerHTML = '<div class="sl-ov-row">' + T('gs.slitherlink.ovSteps') + ' <b>' + steps + '</b></div>' + timeRow;
      ovNewBtn.textContent = tutorialStep < TUT_CFG.length - 1 ? T('gs.slitherlink.nextLesson') : T('gs.slitherlink.tutFinish');
    } else if (packOn) {
      ovTitleEl.textContent = T('gs.slitherlink.packWin').replace('{n}', packLevel + 1);
      ovSubEl.innerHTML = '<div class="sl-ov-stars">' + starsHtml(res.stars, 'big') + '</div>' +
        '<div class="sl-ov-row">' + T('gs.slitherlink.ovSteps') + ' <b>' + steps + '</b></div>' + timeRow +
        '<div class="sl-ov-row">' + T('gs.slitherlink.packUnlock').replace('{n}', Math.min(PACK_LEVELS, packProgress + 1)) + '</div>' +
        (res.newBest ? '<div class="sl-ov-best">' + T('gs.slitherlink.ovNewBest') + '</div>' : '');
      ovNewBtn.textContent = packLevel < PACK_LEVELS - 1 ? T('gs.slitherlink.nextLevel') : T('gs.slitherlink.backPack');
    } else {
      ovTitleEl.textContent = isDaily ? T('gs.slitherlink.dailyWinTitle') : T('gs.slitherlink.winTitle');
      ovSubEl.innerHTML = '<div class="sl-ov-row">' + T('gs.slitherlink.ovSteps') + ' <b>' + steps + '</b></div>' + timeRow;
      ovNewBtn.textContent = T('gs.slitherlink.again');
    }
  }
  function nextAfterWin() {
    if (tutorialOn) {
      if (tutorialStep < TUT_CFG.length - 1) startTutorial(tutorialStep + 1);
      else { tutorialOn = false; openPack(); }
    } else if (packOn) {
      if (packLevel < PACK_LEVELS - 1) startPackLevel(packLevel + 1);
      else openPack();
    } else startPuzzle();
  }

  checkBtn.addEventListener('click', function () { check(); if (Arcade.audio) Arcade.audio.play('ui'); });
  if (hintBtn) hintBtn.addEventListener('click', function () { hint(); });
  newBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); startPuzzle(); });
  if (ovNewBtn) ovNewBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); nextAfterWin(); });
  if (tutBtn) tutBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); startTutorial(tutorialOn ? Math.min(TUT_CFG.length - 1, tutorialStep + 1) : 0); });
  if (packBtn) packBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); openPack(); });
  if (packCloseBtn) packCloseBtn.addEventListener('click', closePack);
  if (packEl) packEl.addEventListener('click', function (e) { if (e.target === packEl) closePack(); });
  if (packAchBtn) packAchBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); openAch(); });
  if (achBtn) achBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); openAch(); });
  if (achCloseBtn) achCloseBtn.addEventListener('click', closeAch);
  if (achEl) achEl.addEventListener('click', function (e) { if (e.target === achEl) closeAch(); });

  /* 键盘：H 提示；Esc 关闭面板；方向键在边之间移动焦点 */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'Escape') {
      if (achEl && !achEl.classList.contains('hidden')) { closeAch(); e.preventDefault(); return; }
      if (packEl && !packEl.classList.contains('hidden')) { closePack(); e.preventDefault(); return; }
    }
    if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if ((overlayEl && !overlayEl.classList.contains('hidden')) ||
          (packEl && !packEl.classList.contains('hidden')) ||
          (achEl && !achEl.classList.contains('hidden'))) return;
      e.preventDefault();
      hint();
    }
  });
  boardEl.addEventListener('keydown', function (e) {
    var keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (keys.indexOf(e.key) < 0) return;
    var t = e.target;
    if (!t.classList || !t.classList.contains('sl-edge')) return;
    e.preventDefault();
    var rect = t.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    var best = null, bestScore = Infinity;
    for (var k in edgeEls) {
      var n = edgeEls[k];
      if (n === t) continue;
      var r = n.getBoundingClientRect();
      var dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      var primary, secondary;
      if (e.key === 'ArrowLeft') { if (dx >= -2) continue; primary = -dx; secondary = Math.abs(dy); }
      else if (e.key === 'ArrowRight') { if (dx <= 2) continue; primary = dx; secondary = Math.abs(dy); }
      else if (e.key === 'ArrowUp') { if (dy >= -2) continue; primary = -dy; secondary = Math.abs(dx); }
      else { if (dy <= 2) continue; primary = dy; secondary = Math.abs(dx); }
      var score = primary * 3 + secondary;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (best) best.focus();
  });

  /* 每日一题：日期种子确定性生成（同一天同一题） */
  function startDaily() {
    clearSave();
    solved = false;
    isDaily = true;
    tutorialOn = false;
    packOn = false;
    var rng = mulberry32(todaySeed());
    var D = DIFFS[Math.floor(rng() * DIFFS.length)];
    diffEl.textContent = T('gs.slitherlink.dailyPre').replace('{n}', T(D.name));
    // 难度 chips 同步
    var bs = diffRow.querySelectorAll('.mode-btn');
    for (var bi = 0; bi < bs.length; bi++) bs[bi].classList.toggle('selected', bi === DIFFS.indexOf(D));
    puzzle = generate(D.rows, D.cols, D.keep, D.budget, rng);
    if (!puzzle) { msgEl.textContent = T('gs.slitherlink.genFail'); return; }
    edgeState = {};
    steps = 0;
    stepsEl.textContent = '0';
    var d2 = new Date();
    msgEl.textContent = T('gs.slitherlink.dailyMsg').replace('{d}', d2.getFullYear() + '-' + (d2.getMonth() + 1) + '-' + d2.getDate()).replace('{n}', T(D.name));
    beginAttempt();
    buildBoard();
  }
  dailyBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); startDaily(); });

  // 难度选择
  DIFFS.forEach(function (d, i) {
    var b = document.createElement('button');
    b.className = 'mode-btn' + (i === diffIdx ? ' selected' : '');
    b.textContent = T(d.name);
    b.addEventListener('click', function () {
      diffIdx = i;
      diffRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
      b.classList.add('selected');
      startPuzzle();
      if (Arcade.audio) Arcade.audio.play('ui');
    });
    diffRow.appendChild(b);
  });

  if (!tryResume()) startPuzzle();

    /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.slitherlink.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = startPuzzle;

  /* 调试钩子：仅 ?qa=1 时挂载，正常访问不暴露可篡改状态的入口 */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) window.__qa = {
    state: function () {
      var lvStars = {};
      for (var i = 0; i < PACK_LEVELS; i++) {
        if (meta.levels[i]) lvStars[i] = {
          stars: meta.levels[i].stars,
          hints: meta.levels[i].hints,
          clears: meta.levels[i].clears,
          bestMs: meta.levels[i].bestMs,
          bestMoves: meta.levels[i].bestMoves
        };
      }
      return {
        solved: solved, steps: steps, on: countOn(), packOn: packOn, packLevel: packLevel,
        tutorialOn: tutorialOn, tutorialStep: tutorialStep, packProgress: packProgress,
        rows: puzzle ? puzzle.rows : 0, cols: puzzle ? puzzle.cols : 0,
        gridCell: gridCell, boardW: boardEl ? boardEl.offsetWidth : 0,
        runHints: runHints, hintTier: hintTier, hintMax: HINT_MAX,
        elapsedMs: elapsedMs(), starTotal: totalStars(), maxStars: PACK_LEVELS * 3,
        levelStars: lvStars, achievements: meta.ach.slice(), achTotal: ACH.length,
        metaVersion: meta.v, cleared: metaClearedCount(), chain: meta.chain, zeroHintLevels: meta.zeroHints.slice()
      };
    },
    solve: function () {
      if (!puzzle) return false;
      edgeState = {};
      for (var k in puzzle.solution) edgeState[k] = 1;
      refreshEdges();
      check();
      return solved;
    },
    stars: function (level) {
      if (typeof level === 'number') {
        var lv = metaLevel(level);
        return { level: level, stars: lv.stars, hints: lv.hints, clears: lv.clears, bestMs: lv.bestMs, times: (meta.times[level] || []).slice() };
      }
      return { total: totalStars(), max: PACK_LEVELS * 3, levels: meta.levels, times: meta.times };
    },
    meta: function () { return JSON.parse(JSON.stringify(meta)); },
    achievements: function () { return { unlocked: meta.ach.slice(), total: ACH.length, ids: ACH.map(function (a) { return a.id; }) }; },
    hint: hint,
    startPack: startPackLevel,
    startLesson: startTutorial,
    openPack: openPack,
    openAch: openAch,
    closeAch: closeAch,
    closeOverlays: function () { closePack(); closeAch(); if (overlayEl) overlayEl.classList.add('hidden'); },
    tutorial: startTutorial,
    restart: startPuzzle,
    save: function () { saveMeta(); writeSave(); return JSON.parse(JSON.stringify(meta)); },
    load: function () {
      meta = loadMeta();
      updateMetaHud();
      updateHintHud();
      if (packEl && !packEl.classList.contains('hidden')) renderPackPanel();
      if (achEl && !achEl.classList.contains('hidden')) renderAchPanel();
      return JSON.parse(JSON.stringify(meta));
    },
    metaRaw: function () { return localStorage.getItem(META_KEY); },
    packRaw: function () { return localStorage.getItem(PACK_KEY); }
  };

})();
