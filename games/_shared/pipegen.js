/* ============================================================
   PipeGen · circuit / pipe 共用的可解旋转连通棋盘生成器
   ------------------------------------------------------------
   设计：先在网格中生长一棵随机生成树（横跨左→右），把树边映射成
   每格的开口集合（1~4 口，含 X 形四口），再按难度加支线/环路，
   最后随机打乱旋转。因生成树本身保证源→汇路径存在，题面必可解。
   连接判定用 BFS：从源口出发，逐格按实际开口对接、要求邻居反向开口。
   纯函数无 DOM 依赖，可供 Node 测试。
   ============================================================ */
window.PipeGen = (function () {
  /* 开口位序：0 上 / 1 右 / 2 下 / 3 左（与各游戏 delta 一致） */
  var BASE = { O: [0, 0, 0, 0], S: [1, 0, 0, 0], I: [1, 0, 1, 0], L: [1, 1, 0, 0], T: [1, 1, 1, 0], X: [1, 1, 1, 1] };
  var TYPE_BY_OPEN = ['O', 'S', 'L', 'T', 'X'];
  var DIR = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clone(cell) { return { type: cell.type, rot: cell.rot, fixed: !!cell.fixed }; }
  function opp(d) { return (d + 2) % 4; }
  function idxOf(cols, r, c) { return r * cols + c; }

  /** 形状基准开口按 rot 顺时针旋转得到的 4 位开口 */
  function rotMask(type, rot) {
    var b = BASE[type] || BASE.I, m = [0, 0, 0, 0];
    rot = ((rot % 4) + 4) % 4;
    for (var i = 0; i < 4; i++) m[(i + rot) % 4] = b[i];
    return m;
  }

  /** 开口集合 → 规范形状 + 规范旋转（同开口集合只有一个规范朝向） */
  function shapeFor(mask) {
    var n = 0;
    for (var i = 0; i < 4; i++) if (mask[i]) n++;
    var type = TYPE_BY_OPEN[n] || 'I';
    if (n === 0) return { type: 'O', rot: 0, count: 0 };
    if (n === 2) {
      // 两个开口：对开为直管 I，相邻为弯管 L
      type = (mask[0] && mask[2]) || (mask[1] && mask[3]) ? 'I' : 'L';
    }
    for (var r = 0; r < 4; r++) {
      var m = rotMask(type, r);
      if (m[0] === mask[0] && m[1] === mask[1] && m[2] === mask[2] && m[3] === mask[3]) {
        return { type: type, rot: r, count: n };
      }
    }
    return { type: type, rot: 0, count: n };
  }

  /** 两朝向之间最少顺时针转动次数（同开口集合视为等价） */
  function turnsTo(type, from, to) {
    var a = rotMask(type, from), b = rotMask(type, to), best = 4;
    for (var r = 0; r < 4; r++) {
      var m = rotMask(type, r);
      if (m[0] === b[0] && m[1] === b[1] && m[2] === b[2] && m[3] === b[3]) {
        best = Math.min(best, (r - from + 4) % 4);
      }
    }
    return best;
  }

  /** 纯函数：旋转一格（返回新对象；固定格原样返回） */
  function rotate(cell, steps) {
    var n = clone(cell);
    if (n.fixed) return n;
    n.rot = ((n.rot + (steps == null ? 1 : steps)) % 4 + 4) % 4;
    return n;
  }

  /** 旋转整块棋盘副本（rot 数组按 cells 顺序） */
  function withRots(board, rots) {
    return {
      cols: board.cols, rows: board.rows, sources: board.sources, sinks: board.sinks,
      cells: board.cells.map(function (c, i) {
        return { type: c.type, rot: rots && rots[i] != null ? rots[i] : c.rot, fixed: !!c.fixed };
      })
    };
  }

  /* ---------- 连通判定：从全部源口 BFS 到汇 ---------- */
  function derive(board) {
    var cols = board.cols, rows = board.rows, cells = board.cells;
    var seen = new Uint8Array(cols * rows);
    var parents = new Int32Array(cols * rows);
    for (var pi = 0; pi < parents.length; pi++) parents[pi] = -1;
    var queue = [];
    var sources = board.sources || [], sinks = board.sinks || [];
    sources.forEach(function (s) {
      var i = typeof s === 'number' ? s : idxOf(cols, s.r, s.c);
      if (!seen[i]) { seen[i] = 1; queue.push(i); }
    });
    var order = queue.slice();
    while (queue.length) {
      var cur = queue.shift();
      var cr = Math.floor(cur / cols), cc = cur % cols;
      var m = rotMask(cells[cur].type, cells[cur].rot);
      for (var d = 0; d < 4; d++) {
        if (!m[d]) continue;
        var dd = DIR[d], nr = cr + dd[0], nc = cc + dd[1];
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        var ni = idxOf(cols, nr, nc);
        if (seen[ni]) continue;
        var nm = rotMask(cells[ni].type, cells[ni].rot);
        if (!nm[opp(d)]) continue;
        seen[ni] = 1; parents[ni] = cur; queue.push(ni); order.push(ni);
      }
    }
    var connectedSinks = [];
    sinks.forEach(function (s) {
      var i = typeof s === 'number' ? s : idxOf(cols, s.r, s.c);
      if (seen[i]) connectedSinks.push(i);
    });
    return {
      ok: connectedSinks.length === sinks.length && sinks.length > 0,
      reached: order, seen: seen, parents: parents, connectedSinks: connectedSinks
    };
  }

  /** 体积小：给 UI 用的“已通电但接不到汇”的断流提示（存在源通路却未达汇） */
  function stalled(board) {
    var d = derive(board);
    return !d.ok && d.reached.length > (board.sources || []).length;
  }

  function makeBoard(cols, rows, difficulty, seed) {
    cols = Math.max(3, cols | 0 || 5);
    rows = Math.max(3, rows | 0 || 5);
    var conf = typeof difficulty === 'object' && difficulty ? difficulty : {};
    var dif = typeof difficulty === 'number' ? difficulty : (conf.level || 5);
    var rng = mulberry32(seed != null ? seed : (Math.random() * 2147483647) | 0);
    var total = cols * rows;
    var minCells = Math.min(total, conf.minCells || Math.max(10, Math.round(total * 0.62)));
    var maxCells = Math.min(total, Math.max(minCells, conf.maxCells || Math.round(total * (0.72 + Math.min(dif, 12) * 0.018))));
    var stubs = conf.stubs != null ? conf.stubs : (1 + Math.floor(dif / 4));
    var loops = conf.loops != null ? conf.loops : (1 + Math.floor(dif / 5));

    function pickStart() {
      // 左侧列任一格作为根，偏向中间，避免开局贴边太死板
      var c = 0, r = Math.floor(rng() * rows);
      if (rng() < 0.35) r = Math.floor(rows / 2) + (rng() < 0.5 ? -1 : 1);
      r = Math.max(0, Math.min(rows - 1, r));
      return idxOf(cols, r, c);
    }

    var tree = null, src = -1, sinks = [];
    for (var attempt = 0; attempt < 120 && !tree; attempt++) {
      var visited = new Uint8Array(total);
      var parent = new Int32Array(total);
      for (var z = 0; z < parent.length; z++) parent[z] = -1;
      var edges = [];
      var start = pickStart();
      visited[start] = 1;
      var frontier = [];
      function pushEdges(i) {
        var r = Math.floor(i / cols), c = i % cols;
        for (var d = 0; d < 4; d++) {
          var nr = r + DIR[d][0], nc = c + DIR[d][1];
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          var ni = idxOf(cols, nr, nc);
          if (!visited[ni]) frontier.push({ a: i, b: ni, d: d });
        }
      }
      pushEdges(start);
      var count = 1;
      var target = minCells + Math.floor(rng() * Math.max(1, maxCells - minCells + 1));
      while (frontier.length && count < target) {
        var pick = Math.floor(rng() * frontier.length);
        var e = frontier[pick];
        frontier[pick] = frontier[frontier.length - 1];
        frontier.pop();
        if (visited[e.b]) continue;
        visited[e.b] = 1;
        parent[e.b] = e.a;
        edges.push({ a: e.a, b: e.b, d: e.d });
        count++;
        pushEdges(e.b);
      }
      if (count < minCells) continue;
      // 右侧汇：优先右列上的树叶；没有则退而求其次取最右列任意节点
      var leftLeaves = [], rightLeaves = [];
      for (var i = 0; i < total; i++) {
        if (!visited[i]) continue;
        var r = Math.floor(i / cols), c = i % cols;
        var deg = 0;
        for (var k = 0; k < edges.length; k++) if (edges[k].a === i || edges[k].b === i) deg++;
        if (deg === 1) {
          if (c === 0) leftLeaves.push(i);
          if (c === cols - 1) rightLeaves.push(i);
        }
      }
      var needSinks = Math.max(1, conf.sinks || 1);
      if (!leftLeaves.length || rightLeaves.length < needSinks) continue;
      src = leftLeaves[Math.floor(rng() * leftLeaves.length)];
      // 右列树叶作为汇（灯泡/出水口），数量按配置
      var wantSinks = needSinks;
      for (var rs = rightLeaves.length - 1; rs > 0; rs--) {
        var rj = Math.floor(rng() * (rs + 1));
        var rt = rightLeaves[rs]; rightLeaves[rs] = rightLeaves[rj]; rightLeaves[rj] = rt;
      }
      sinks = rightLeaves.slice(0, wantSinks);
      tree = { visited: visited, edges: edges, start: start, count: count };
    }
    if (!tree) return makeFallbackBoard(cols, rows, dif, seed, conf.sinks || 1);
    var sinkSet = {};
    sinks.forEach(function (s) { sinkSet[s] = true; });

    var mask = new Array(total);
    for (var mi = 0; mi < total; mi++) mask[mi] = [0, 0, 0, 0];
    function addEdge(a, b) {
      var ar = Math.floor(a / cols), ac = a % cols;
      var br = Math.floor(b / cols), bc = b % cols;
      var d = (br - ar === -1) ? 0 : (bc - ac === 1) ? 1 : (br - ar === 1) ? 2 : 3;
      mask[a][d] = 1;
      mask[b][opp(d)] = 1;
    }
    tree.edges.forEach(function (e) { addEdge(e.a, e.b); });

    var edgeKey = {};

    function edgeTaken(a, b) {
      var lo = Math.min(a, b), hi = Math.max(a, b);
      var key = lo + ':' + hi;
      if (edgeKey[key]) return true;
      for (var i = 0; i < tree.edges.length; i++) {
        var e = tree.edges[i];
        if ((e.a === lo && e.b === hi) || (e.a === hi && e.b === lo)) return true;
      }
      return false;
    }
    function addExtra(a, b) {
      if (a < 0 || b < 0) return false;
      if (a === src || b === src || sinkSet[a] || sinkSet[b]) return false; // 保源/汇单口可锁定
      if (edgeTaken(a, b)) return false;
      var ar = Math.floor(a / cols), ac = a % cols;
      var br = Math.floor(b / cols), bc = b % cols;
      if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return false;
      addEdge(a, b);
      edgeKey[Math.min(a, b) + ':' + Math.max(a, b)] = 1;
      return true;
    }

    // 环路（把已连通的两个相邻格再连一条）→ 制造 T / X 口
    var nodes = [];
    for (var ni = 0; ni < total; ni++) if (tree.visited[ni]) nodes.push(ni);
    for (var li = 0; li < loops; li++) {
      var tries = 0;
      while (tries++ < 60) {
        var node = nodes[Math.floor(rng() * nodes.length)];
        var nr = Math.floor(node / cols), nc = node % cols;
        var nd = Math.floor(rng() * 4);
        var tri = nr + DIR[nd][0], tci = nc + DIR[nd][1];
        if (tri < 0 || tci < 0 || tri >= rows || tci >= cols) continue;
        var ti = idxOf(cols, tri, tci);
        if (!tree.visited[ti]) continue;
        if (addExtra(node, ti)) break;
      }
    }
    // 支线 / 死路（从树中格向空格伸一格）
    for (var si = 0; si < stubs; si++) {
      var tries2 = 0;
      while (tries2++ < 80) {
        var node2 = nodes[Math.floor(rng() * nodes.length)];
        if (node2 === src || sinkSet[node2]) continue; // 源/汇收口后不可再挂支线
        var r2 = Math.floor(node2 / cols), c2 = node2 % cols;
        var d2 = Math.floor(rng() * 4);
        var tr = r2 + DIR[d2][0], tc = c2 + DIR[d2][1];
        if (tr < 0 || tc < 0 || tr >= rows || tc >= cols) continue;
        var cellIdx = idxOf(cols, tr, tc);
        if (tree.visited[cellIdx] || mask[cellIdx][0] || mask[cellIdx][1] || mask[cellIdx][2] || mask[cellIdx][3]) continue;
        mask[node2][d2] = 1;
        mask[cellIdx][opp(d2)] = 1;
        tree.visited[cellIdx] = 1;
        nodes.push(cellIdx);
        break;
      }
    }

    // 源 / 各汇收口为单开口（开口指向生成树中的唯一邻格）
    function pruneTerminal(node) {
      var keep = -1;
      tree.edges.forEach(function (e) {
        if (e.a === node || e.b === node) keep = (e.a === node ? e.b : e.a);
      });
      if (keep < 0) return;
      var nr = Math.floor(node / cols), nc = node % cols, kr = Math.floor(keep / cols), kc = keep % cols;
      var d = (kr - nr === -1) ? 0 : (kc - nc === 1) ? 1 : (kr - nr === 1) ? 2 : 3;
      mask[node] = [0, 0, 0, 0]; mask[node][d] = 1;
    }
    pruneTerminal(src);
    sinks.forEach(pruneTerminal);

    var cells = mask.map(function (m) {
      var sf = shapeFor(m);
      return { type: sf.type, rot: sf.rot, fixed: false, openCount: sf.count };
    });
    cells[src].fixed = true;
    sinks.forEach(function (s) { cells[s].fixed = true; });
    var solutionRot = cells.map(function (c) { return c.rot; });
    var solutionBoard = withRots({ cols: cols, rows: rows, cells: cells, sources: [src], sinks: sinks }, solutionRot);
    var check = derive(solutionBoard);
    if (!check.ok) return makeFallbackBoard(cols, rows, dif, seed);

    // 打乱：除源/汇外随机旋转，并保证开局不是已解
    for (var ci = 0; ci < cells.length; ci++) {
      if (cells[ci].fixed) continue;
      if (cells[ci].type === 'I' && rng() < 0.22) continue;
      cells[ci].rot = Math.floor(rng() * 4);
    }
    function snapshot() {
      return withRots({ cols: cols, rows: rows, cells: cells, sources: [src], sinks: sinks }, cells.map(function (c) { return c.rot; }));
    }
    // 保证开局不是已解：逐次尝试，直到任意一次转动能断开源→汇
    var guard = 0;
    while (derive(snapshot()).ok && guard++ < 40) {
      var nonFixed = [];
      for (var fi = 0; fi < cells.length; fi++) if (!cells[fi].fixed) nonFixed.push(fi);
      if (!nonFixed.length) break;
      // 先找“一击即断”的格，保持题面离解只差若干步；找不到则随机转一格
      var broke = -1;
      var probeOrder = nonFixed.slice();
      for (var pi2 = probeOrder.length - 1; pi2 > 0; pi2--) {
        var pj = Math.floor(rng() * (pi2 + 1));
        var pt = probeOrder[pi2]; probeOrder[pi2] = probeOrder[pj]; probeOrder[pj] = pt;
      }
      for (var bi = 0; bi < probeOrder.length && broke < 0; bi++) {
        var ci2 = probeOrder[bi], oldRot = cells[ci2].rot;
        cells[ci2].rot = (oldRot + 1) % 4;
        if (!derive(snapshot()).ok) broke = ci2;
        else cells[ci2].rot = oldRot;
      }
      if (broke < 0) {
        var randomIdx = nonFixed[Math.floor(rng() * nonFixed.length)];
        cells[randomIdx].rot = (cells[randomIdx].rot + 1) % 4;
      }
    }

    // 最少步数（从乱序回到生成解的最短转动数，作为关卡难度基准）
    var minMoves = 0;
    for (var mm = 0; mm < cells.length; mm++) {
      if (!cells[mm].fixed) minMoves += turnsTo(cells[mm].type, cells[mm].rot, solutionRot[mm]);
    }

    var board = {
      cols: cols, rows: rows,
      cells: cells,
      sources: [src],
      sinks: sinks.slice(),
      solutionRot: solutionRot,
      minMoves: minMoves
    };
    board.sourcePos = { r: Math.floor(src / cols), c: src % cols };
    board.sinkPos = { r: Math.floor(sinks[0] / cols), c: sinks[0] % cols };
    board.sinksPos = sinks.map(function (s) { return { r: Math.floor(s / cols), c: s % cols }; });
    return board;
  }

  /** 极端兜底：多行直连 + 内部竖井，保证源与每个汇都必然连通 */
  function makeFallbackBoard(cols, rows, dif, seed, sinkCount) {
    var rng = mulberry32(seed != null ? seed : 1);
    var total = cols * rows;
    var mask = new Array(total), i;
    for (i = 0; i < total; i++) mask[i] = [0, 0, 0, 0];
    function add(a, b) {
      var ar = Math.floor(a / cols), ac = a % cols;
      var br = Math.floor(b / cols), bc = b % cols;
      var d = (br - ar === -1) ? 0 : (bc - ac === 1) ? 1 : (br - ar === 1) ? 2 : 3;
      mask[a][d] = 1; mask[b][opp(d)] = 1;
    }
    var sr = Math.floor(rows / 2);
    var src = idxOf(cols, sr, 0);
    var sinkCount2 = Math.max(1, Math.min(sinkCount || 1, rows));
    // 主行 0..cols-2 连通，右侧倒数第二列做竖直主干
    for (var cc = 0; cc < cols - 2; cc++) add(idxOf(cols, sr, cc), idxOf(cols, sr, cc + 1));
    for (var vr = 0; vr < rows - 1; vr++) add(idxOf(cols, vr, cols - 2), idxOf(cols, vr + 1, cols - 2));
    var rowList = [sr];
    while (rowList.length < sinkCount2) {
      var tr0 = Math.floor(rng() * rows);
      if (rowList.indexOf(tr0) < 0) rowList.push(tr0);
    }
    var sinks = rowList.map(function (r) {
      add(idxOf(cols, r, cols - 2), idxOf(cols, r, cols - 1));
      return idxOf(cols, r, cols - 1);
    });
    mask[src] = [0, 0, 0, 0]; mask[src][1] = 1;
    sinks.forEach(function (s) { mask[s] = [0, 0, 0, 0]; mask[s][3] = 1; });
    // 死路支线：给主行制造 T / X 口
    var stubs = 2 + Math.floor(dif / 3);
    for (var s2 = 0; s2 < stubs; s2++) {
      var c3 = 1 + Math.floor(rng() * Math.max(1, cols - 2));
      if (c3 > cols - 2) c3 = cols - 2;
      var dir = rng() < 0.5 ? 0 : 2;
      var nr = sr + (dir === 0 ? -1 : 1);
      if (nr < 0 || nr >= rows) dir = dir === 0 ? 2 : 0;
      nr = sr + (dir === 0 ? -1 : 1);
      if (nr < 0 || nr >= rows) continue;
      add(idxOf(cols, sr, c3), idxOf(cols, nr, c3));
    }
    var cells = mask.map(function (m) { var sf = shapeFor(m); return { type: sf.type, rot: sf.rot, fixed: false, openCount: sf.count }; });
    cells[src].fixed = true; sinks.forEach(function (s) { cells[s].fixed = true; });
    var solutionRot = cells.map(function (c) { return c.rot; });
    for (var ci = 0; ci < cells.length; ci++) if (!cells[ci].fixed) cells[ci].rot = Math.floor(rng() * 4);
    var board = { cols: cols, rows: rows, cells: cells, sources: [src], sinks: sinks, solutionRot: solutionRot, minMoves: 0,
      __fallback: true,
      sourcePos: { r: sr, c: 0 }, sinkPos: { r: sr, c: cols - 1 },
      sinksPos: sinks.map(function (s) { return { r: Math.floor(s / cols), c: cols - 1 }; }) };
    return board;
  }

  return {
    BASE: BASE, DIR: DIR,
    rotMask: rotMask, shapeFor: shapeFor, turnsTo: turnsTo,
    rotate: rotate, withRots: withRots,
    derive: derive, stalled: stalled,
    makeBoard: makeBoard,
    mulberry32: mulberry32
  };
})();
