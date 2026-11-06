/* ============================================================
   数织核心：线索 / 传播式求解器 / 唯一解生成 / 题库 / 每日
   纯函数，无 DOM 依赖 —— 浏览器挂到 window.NGCore，Node 可 require
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NGCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ---------------- 基础 ---------------- */
  function clues(arr) {
    var out = [], run = 0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === 1) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out.length ? out : [0];
  }
  function clueStr(c) { return c.join(' '); }
  function rowsOf(grid) { return grid.map(function (row) { return clues(row); }); }
  function colsOf(grid) {
    var n = grid.length, out = [];
    for (var c = 0; c < n; c++) {
      var col = [];
      for (var r = 0; r < n; r++) col.push(grid[r][c]);
      out.push(clues(col));
    }
    return out;
  }
  function blank(n, v) {
    var g = [];
    for (var r = 0; r < n; r++) { g[r] = []; for (var c = 0; c < n; c++) g[r][c] = v === undefined ? -1 : v; }
    return g;
  }
  function parseRows(rows) {
    return rows.map(function (line) {
      var out = [];
      for (var i = 0; i < line.length; i++) out.push(line.charCodeAt(i) === 49 ? 1 : 0);
      return out;
    });
  }
  function cloneGrid(g) { return g.map(function (row) { return row.slice(); }); }

  function mulberry32(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 行列候选（放置枚举） ---------------- */
  var pcache = {};
  function placements(clue, n) {
    var key = n + ':' + clueStr(clue);
    if (pcache[key]) return pcache[key];
    var runs = clue;
    if (runs.length === 1 && runs[0] === 0) runs = [];
    var res = [];
    var line = [];
    function rec(i, start) {
      if (i === runs.length) {
        var out = [];
        for (var k = 0; k < n; k++) out.push(line[k] ? 1 : 0);
        res.push(out);
        return;
      }
      var need = 0;
      for (var j = i; j < runs.length; j++) need += runs[j];
      need += (runs.length - i - 1);
      for (var p = start; p <= n - need; p++) {
        for (var q = 0; q < runs[i]; q++) line[p + q] = 1;
        rec(i + 1, p + runs[i] + 1);
        for (var q2 = 0; q2 < runs[i]; q2++) line[p + q2] = 0;
      }
    }
    rec(0, 0);
    pcache[key] = res;
    return res;
  }

  /** 单行/列传播：用所有合法放置的交集推出必然格 */
  function lineSolve(line, clue) {
    var n = line.length;
    var ps = placements(clue, n);
    var ones = [];
    for (var i = 0; i < n; i++) ones[i] = 0;
    var valid = 0;
    for (var pi = 0; pi < ps.length; pi++) {
      var p = ps[pi], ok = true;
      for (var k = 0; k < n; k++) {
        if (line[k] !== -1 && line[k] !== p[k]) { ok = false; break; }
      }
      if (!ok) continue;
      valid++;
      for (var k2 = 0; k2 < n; k2++) if (p[k2] === 1) ones[k2]++;
    }
    if (valid === 0) return { contradiction: true, line: line, valid: 0 };
    var out = line.slice(), changed = false;
    for (var x = 0; x < n; x++) {
      if (out[x] !== -1) continue;
      if (ones[x] === 0) { out[x] = 0; changed = true; }
      else if (ones[x] === valid) { out[x] = 1; changed = true; }
    }
    return { contradiction: false, line: out, valid: valid, changed: changed };
  }

  /** 行列反复传播；返回是否矛盾与最终网格 */
  function propagate(grid, clueR, clueC, maxIter) {
    var n = grid.length;
    var g = cloneGrid(grid);
    maxIter = maxIter || 40;
    for (var it = 0; it < maxIter; it++) {
      var changed = false;
      for (var r = 0; r < n; r++) {
        var rr = lineSolve(g[r], clueR[r]);
        if (rr.contradiction) return { contradiction: true, grid: g };
        if (rr.changed) { g[r] = rr.line; changed = true; }
      }
      for (var c = 0; c < n; c++) {
        var col = [];
        for (var r2 = 0; r2 < n; r2++) col.push(g[r2][c]);
        var cc = lineSolve(col, clueC[c]);
        if (cc.contradiction) return { contradiction: true, grid: g };
        if (cc.changed) {
          for (var r3 = 0; r3 < n; r3++) g[r3][c] = cc.line[r3];
          changed = true;
        }
      }
      if (!changed) break;
    }
    return { contradiction: false, grid: g };
  }

  function prefixCount(g, clueR, clueC) {
    var solved = 0, unknown = 0;
    var n = g.length;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (g[r][c] === -1) unknown++; else solved++;
    }
    return { solved: solved, unknown: unknown };
  }

  /** 回溯计数（最多 limit 个解）；用于唯一性校验 */
  function countSolutions(clueR, clueC, limit, maxNodes) {
    limit = limit || 2;
    var n = clueR.length;
    var found = 0, nodes = 0;
    maxNodes = maxNodes || 500000;

    function search(grid) {
      if (found >= limit || nodes > maxNodes) return;
      nodes++;
      var pr = propagate(grid, clueR, clueC, 20);
      if (pr.contradiction) return;
      var g = pr.grid, empty = -1, er = -1, ec = -1;
      var n2 = g.length;
      for (var r = 0; r < n2 && empty < 0; r++) {
        for (var c = 0; c < n2; c++) {
          if (g[r][c] === -1) { empty = 1; er = r; ec = c; break; }
        }
      }
      if (empty < 0) { found++; return; }
      for (var v = 1; v >= 0; v--) {
        var ng = cloneGrid(g);
        ng[er][ec] = v;
        search(ng);
        if (found >= limit) return;
      }
    }
    search(blank(n));
    return { count: found, nodes: nodes };
  }

  /** 求解器：返回第一个完整解（供提示/测试） */
  function solve(clueR, clueC) {
    var n = clueR.length;
    var answer = null;
    function search(grid) {
      if (answer) return;
      var pr = propagate(grid, clueR, clueC, 20);
      if (pr.contradiction) return;
      var g = pr.grid, er = -1, ec = -1;
      for (var r = 0; r < n && er < 0; r++) {
        for (var c = 0; c < n; c++) if (g[r][c] === -1) { er = r; ec = c; break; }
      }
      if (er < 0) { answer = g; return; }
      for (var v = 1; v >= 0; v--) {
        var ng = cloneGrid(g); ng[er][ec] = v;
        search(ng);
        if (answer) return;
      }
    }
    search(blank(n));
    return answer;
  }

  /** 严格逐格比对：状态中“已填”必须与目标完全一致（叉标仅为辅助） */
  function strictMatch(state, target) {
    var n = target.length;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if ((state[r][c] === 1) !== (target[r][c] === 1)) return false;
    }
    return true;
  }

  /** 逐格检查：返回错误格（多涂 / 叉掉目标格）位置 */
  function wrongCells(state, target) {
    var out = [], n = target.length;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (state[r][c] === 1 && target[r][c] !== 1) out.push({ r: r, c: c, kind: 'extra' });
      else if (state[r][c] === 2 && target[r][c] === 1) out.push({ r: r, c: c, kind: 'crossed' });
    }
    return out;
  }

  /**
   * 提示：只保留与目标一致的已确定格（避免用户错误标记导致矛盾），
   * 先跑传播找“必然格”，没有再退回到唯一解的下一处不一致格。
   */
  function hint(state, target, clueR, clueC) {
    var n = target.length, known = blank(n, -1);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var v = state[r][c];
      if (v === 1) { if (target[r][c] === 1) known[r][c] = 1; }
      else if (v === 2) { if (target[r][c] === 0) known[r][c] = 0; }
    }
    var pr = propagate(known, clueR, clueC, 30);
    if (!pr.contradiction) {
      var best = null;
      for (var r2 = 0; r2 < n && !best; r2++) {
        for (var c2 = 0; c2 < n; c2++) {
          var gv = pr.grid[r2][c2];
          if (gv === -1) continue;
          if (state[r2][c2] === gv) continue;
          /* 只提示与目标一致的必然格 */
          if (gv !== target[r2][c2]) continue;
          if (!best || (gv === 1 && best.v !== 1)) best = { r: r2, c: c2, v: gv };
        }
      }
      if (best) return best;
    }
    for (var r3 = 0; r3 < n; r3++) for (var c3 = 0; c3 < n; c3++) {
      if (state[r3][c3] === target[r3][c3]) continue;
      return { r: r3, c: c3, v: target[r3][c3] === 1 ? 1 : 0 };
    }
    return null;
  }

  /* ---------------- 生成器 ---------------- */
  function randomGrid(n, seed, density) {
    var rand = mulberry32(seed);
    density = density || (0.4 + ((seed % 17) / 17) * 0.25);
    var g = [];
    for (var r = 0; r < n; r++) {
      g[r] = [];
      for (var c = 0; c < n; c++) g[r][c] = rand() < density ? 1 : 0;
    }
    /* 避免全空 / 全满这类退化题 */
    var filled = 0;
    for (var r2 = 0; r2 < n; r2++) for (var c2 = 0; c2 < n; c2++) filled += g[r2][c2];
    if (filled < n * n * 0.18 || filled > n * n * 0.82) return null;
    /* 避免整行/整列全空，让题面更有形 */
    for (var i = 0; i < n; i++) {
      var rowSum = 0, colSum = 0;
      for (var j = 0; j < n; j++) { rowSum += g[i][j]; colSum += g[j][i]; }
      if (rowSum === 0 || colSum === 0) return null;
    }
    return g;
  }

  function validate(grid) {
    var cr = rowsOf(grid), cc = colsOf(grid);
    var r = countSolutions(cr, cc, 2);
    return r.count === 1;
  }

  /** 给定尺寸/起始 seed，生成唯一解题目；失败返回 null（调用方换尺寸/换库） */
  function generate(n, seedStart, opts) {
    opts = opts || {};
    var tries = opts.tries || 60;
    for (var k = 0; k < tries; k++) {
      var seed = (seedStart || 1) + k;
      var g = randomGrid(n, seed, opts.density);
      if (!g) continue;
      if (validate(g)) {
        return { grid: g, seed: seed, attempts: k + 1, cluesR: rowsOf(g), cluesC: colsOf(g) };
      }
    }
    return null;
  }

  /* ---------------- 题库 ----------------
     手工图案（保留原库）+ 程序生成后固化的 21 题。
     索引 = 图案库 + seed（手工题也有稳定 seed），每日按日期 seed 取题。 */
  var MANUAL = [
    { id: 'heart5', name: 'gs.nonogram.picHeart', size: 5, seed: 1001, g: ['00100', '01110', '11111', '01110', '00100'] },
    { id: 'smile5', name: 'gs.nonogram.picSmile', size: 5, seed: 1002, g: ['01110', '11011', '10101', '10001', '01110'] },
    { id: 'star5', name: 'gs.nonogram.picStar', size: 5, seed: 1003, g: ['00100', '10101', '01110', '00100', '01110'] },
    { id: 'arrow5', name: 'gs.nonogram.picArrow', size: 5, seed: 1004, g: ['00100', '01110', '11111', '00100', '00100'] },
    { id: 'cross5', name: 'gs.nonogram.picCross', size: 5, seed: 1005, g: ['00100', '00100', '11111', '00100', '00100'] },
    { id: 'house5', name: 'gs.nonogram.picHouse', size: 5, seed: 1006, g: ['01010', '11111', '10101', '11111', '10001'] },
    { id: 'flower8', name: 'gs.nonogram.picFlower', size: 8, seed: 1010, g: [
      '01111000', '00111100', '01100110', '11000011', '11000011', '01100110', '00111100', '00011000'] },
    { id: 'diamond8', name: 'gs.nonogram.picDiamond', size: 8, seed: 1011, g: [
      '00011000', '00111100', '01111110', '11111111', '01111110', '00111100', '00011000', '00000000'] },
    { id: 'wave8', name: 'gs.nonogram.picWave', size: 8, seed: 1012, g: [
      '00000000', '11001100', '01100110', '00110011', '11001100', '01100110', '00110011', '10000000'] },
    { id: 'bigheart10', name: 'gs.nonogram.picBigHeart', size: 10, seed: 1020, g: [
      '0001100000', '0011110000', '0111111000', '1111111100', '1111111110',
      '1111111110', '0111111100', '0011111000', '0001110000', '0000100000'] },
    { id: 'tree10', name: 'gs.nonogram.picTree', size: 10, seed: 1021, g: [
      '0000100000', '0001110000', '0011111000', '0111111100', '1111111110',
      '0111111110', '0011111100', '0000110000', '0000110000', '0001111000'] },
    { id: 'ship10', name: 'gs.nonogram.picShip', size: 10, seed: 1022, g: [
      '0000100000', '0001111000', '0001111000', '0111111110', '1111111111',
      '1111111111', '1111111111', '0111111110', '0001110000', '0000100000'] }
  ];

  /* 程序生成后固化（seed 即生成时的随机种子，重跑同 seed 结果一致） */
  var GENERATED = [
    { id: 'gen5-crown', name: 'gs.nonogram.picCrown', size: 5, seed: 0, diff: 1 },
    { id: 'gen5-key', name: 'gs.nonogram.picKey', size: 5, seed: 0, diff: 1 },
    { id: 'gen5-bell', name: 'gs.nonogram.picBell', size: 5, seed: 0, diff: 1 },
    { id: 'gen5-mail', name: 'gs.nonogram.picMail', size: 5, seed: 0, diff: 1 },
    { id: 'gen8-fish', name: 'gs.nonogram.picFish', size: 8, seed: 0, diff: 2 },
    { id: 'gen8-cat', name: 'gs.nonogram.picCat', size: 8, seed: 0, diff: 2 },
    { id: 'gen8-rocket', name: 'gs.nonogram.picRocket', size: 8, seed: 0, diff: 2 },
    { id: 'gen8-anchor', name: 'gs.nonogram.picAnchor', size: 8, seed: 0, diff: 2 },
    { id: 'gen8-robot', name: 'gs.nonogram.picRobot', size: 8, seed: 0, diff: 2 },
    { id: 'gen10-lighthouse', name: 'gs.nonogram.picLighthouse', size: 10, seed: 0, diff: 3 },
    { id: 'gen10-owl', name: 'gs.nonogram.picOwl', size: 10, seed: 0, diff: 3 },
    { id: 'gen10-whale', name: 'gs.nonogram.picWhale', size: 10, seed: 0, diff: 3 },
    { id: 'gen10-castle', name: 'gs.nonogram.picCastle', size: 10, seed: 0, diff: 3 },
    { id: 'gen10-compass', name: 'gs.nonogram.picCompass', size: 10, seed: 0, diff: 3 },
    { id: 'gen12-cactus', name: 'gs.nonogram.picCactus', size: 12, seed: 0, diff: 4 },
    { id: 'gen12-butterfly', name: 'gs.nonogram.picButterfly', size: 12, seed: 0, diff: 4 },
    { id: 'gen12-mushroom', name: 'gs.nonogram.picMushroom', size: 12, seed: 0, diff: 4 },
    { id: 'gen12-piano', name: 'gs.nonogram.picPiano', size: 12, seed: 0, diff: 4 },
    { id: 'gen12-skull', name: 'gs.nonogram.picSkull', size: 12, seed: 0, diff: 4 },
    { id: 'gen12-umbrella', name: 'gs.nonogram.picUmbrella', size: 12, seed: 0, diff: 4 },
    { id: 'gen15-trophy', name: 'gs.nonogram.picTrophy', size: 15, seed: 0, diff: 5 }
  ];

  var PICTURES = [];
  function normalize(p) {
    var grid = typeof p.g[0] === 'string' ? parseRows(p.g) : cloneGrid(p.g);
    var cr = rowsOf(grid), cc = colsOf(grid);
    return {
      id: p.id, name: p.name, size: p.size, seed: p.seed, diff: p.diff || 1,
      grid: grid, clueR: cr, clueC: cc,
      unique: p.unique === undefined ? null : !!p.unique,
      rowsFixed: typeof p.g[0] === 'string' ? p.g.slice() : null
    };
  }
  MANUAL.forEach(function (p) { PICTURES.push(normalize(p)); });
  /* GENERATED 只是生成脚本的占位描述；实际固化数据由 nonogram-puzzles.js 注入 */

  function all() { return PICTURES.slice(); }
  function byId(id) {
    for (var i = 0; i < PICTURES.length; i++) if (PICTURES[i].id === id) return PICTURES[i];
    return null;
  }
  function forSize(n) {
    return PICTURES.filter(function (p) { return p.size === n; });
  }
  function sizes() {
    var out = [];
    PICTURES.forEach(function (p) { if (out.indexOf(p.size) < 0) out.push(p.size); });
    return out.sort(function (a, b) { return a - b; });
  }
  function bySeed(seed) {
    for (var i = 0; i < PICTURES.length; i++) if (PICTURES[i].seed === seed) return PICTURES[i];
    return PICTURES[(seed >>> 0) % PICTURES.length] || null;
  }
  function dateSeed(d) {
    d = d || new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function dailyPuzzle(d) {
    var list = PICTURES.filter(function (p) { return p.size === 10; });
    if (!list.length) list = PICTURES;
    var seed = dateSeed(d);
    /* 日期 seed 固定选 10×10 中的一题；同一天任何入口拿到同一题 */
    return list[seed % list.length];
  }
  function nextPuzzle(size, lastId) {
    var list = forSize(size);
    if (!list.length) return null;
    if (!lastId) return list[Math.floor(Math.random() * list.length)];
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === lastId) idx = i;
    return list[(idx + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length] || list[0];
  }

  return {
    clues: clues, clueStr: clueStr, rowsOf: rowsOf, colsOf: colsOf,
    blank: blank, parseRows: parseRows, cloneGrid: cloneGrid,
    placements: placements, lineSolve: lineSolve, propagate: propagate,
    countSolutions: countSolutions, solve: solve,
    strictMatch: strictMatch, wrongCells: wrongCells, hint: hint,
    randomGrid: randomGrid, validate: validate, generate: generate,
    mulberry32: mulberry32,
    all: all, byId: byId, forSize: forSize, sizes: sizes, bySeed: bySeed,
    dateSeed: dateSeed, dailyPuzzle: dailyPuzzle, nextPuzzle: nextPuzzle,
    /* 供生成脚本写入固化题库 */
    __setGenerated: function (items) {
      items.forEach(function (it) {
        var p = normalize(it);
        var found = false;
        for (var i = 0; i < PICTURES.length; i++) {
          if (PICTURES[i].id === p.id) { PICTURES[i] = p; found = true; break; }
        }
        if (!found) PICTURES.push(p);
      });
    }
  };
});
