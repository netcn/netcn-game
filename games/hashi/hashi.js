/* ============================================================
   岛屿连线 Hashi（Hashiwokakero）· 经典逻辑谜题（旗舰级）
   规则：把数字岛用桥连起来——桥只能水平/垂直、不交叉、
         每对岛最多 2 座桥、每个岛的桥数=岛数字、全图连通。
   质量核心：
     - 程序化生成：生长法连树（保证不交叉+连通）→ 随机双桥加深
     - 求解器验证唯一解（数字约束 + 连通性），不唯一自动重试
   记分：min 模式，操作步数越少越好
   本轮：关卡星级 / 成就 / 本机最佳榜 / 三级提示计数 / 旗舰视觉
   ============================================================ */

(function () {
  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.hashi.tut1t'), d: T('gs.hashi.tut1') },
    { t: T('gs.hashi.tut2t'), d: T('gs.hashi.tut2') },
    { t: T('gs.hashi.tut3t'), d: T('gs.hashi.tut3') }
  ];

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ================= 纯逻辑：生成与求解 ================= */

  /** 生成一局。GRID: 网格大小；targetIslands: 目标岛数
      返回 { islands: [{x,y,n}], rows, cols, solution: { 'x1,y1-x2,y2': 1|2 } } */
  function generate(GRID, targetIslands, rng) {
    rng = rng || Math.random;
    for (var attempt = 0; attempt < 400; attempt++) {
      var islands = placeIslands(GRID, targetIslands, rng);
      if (!islands) continue;
      var tree = growTree(islands, GRID, rng);
      if (!tree) continue;
      // 随机升级部分边为双桥
      var edges = tree.slice();
      var upgraded = {};
      var upCount = Math.floor(edges.length * 0.25) + 1;
      for (var i = 0; i < upCount && edges.length; i++) {
        var e = edges[Math.floor(rng() * edges.length)];
        upgraded[bridgeKey(e[0], e[1])] = 2;
        // 避免同一岛过度升级：简单去重边
        edges = edges.filter(function (x) { return bridgeKey(x[0], x[1]) !== bridgeKey(e[0], e[1]); });
      }
      // 桥数 -> 岛数字
      var deg = {};
      islands.forEach(function (isl) { deg[isl.id] = 0; });
      tree.forEach(function (e) {
        var w = upgraded[bridgeKey(e[0], e[1])] || 1;
        deg[e[0].id] += w; deg[e[1].id] += w;
      });
      // 数字上限 8（Hashi 规则），超了跳过
      var ok = true;
      islands.forEach(function (isl) { if (deg[isl.id] > 8 || deg[isl.id] < 1) ok = false; });
      if (!ok) continue;
      islands.forEach(function (isl) { isl.n = deg[isl.id]; });
      // 求解唯一解验证
      var res = countSolutions(islands, 2);
      if (res.count === 1) {
        var sol = {};
        tree.forEach(function (e) { sol[bridgeKey(e[0], e[1])] = upgraded[bridgeKey(e[0], e[1])] || 1; });
        return { islands: islands, rows: GRID, cols: GRID, solution: sol };
      }
    }
    return null;
  }

  /** 桥键：两端坐标字典序归一化（保证 a→b / b→a 均是同一 key） */
  function bridgeKey(a, b) {
    var ka = a.x + ',' + a.y, kb = b.x + ',' + b.y;
    return ka < kb ? ka + '-' + kb : kb + '-' + ka;
  }
  function normKey(k) {
    var parts = String(k).split('-');
    if (parts.length !== 2) return k;
    return parts[0] < parts[1] ? parts[0] + '-' + parts[1] : parts[1] + '-' + parts[0];
  }

  /** 随机放岛：格点位置、保证两岛不同格 */
  function placeIslands(GRID, target, rng) {
    rng = rng || Math.random;
    var pts = [];
    var guard = 0;
    while (pts.length < target && guard++ < 500) {
      var x = 1 + Math.floor(rng() * (GRID - 2));
      var y = 1 + Math.floor(rng() * (GRID - 2));
      var dup = false;
      for (var i = 0; i < pts.length; i++) if (pts[i].x === x && pts[i].y === y) { dup = true; break; }
      if (dup) continue;
      pts.push({ x: x, y: y });
    }
    if (pts.length < target) return null;
    var islands = pts.map(function (p, idx) {
      return { id: idx, x: p.x, y: p.y, n: 0 };
    });
    return islands;
  }

  /** 生长法：从第一个岛出发，逐步把未连岛通过「直线可达且中间无岛」的桥连入
      保证：桥不交叉（中间无岛阻挡）+ 全连通 + 无重复边
      鲁棒：若随机选的 rest 岛无法连接，换一个 rest 岛尝试 */
  function growTree(islands, GRID, rng) {
    rng = rng || Math.random;
    var connected = [islands[0]];
    var rest = islands.slice(1);
    var edges = [];
    var guard = 0;
    while (rest.length && guard++ < 400) {
      // 找一个「能从已连集连入」的 rest 岛（优先随机）
      var shuffled = rest.slice();
      for (var s = shuffled.length - 1; s > 0; s--) {
        var si = Math.floor(rng() * (s + 1));
        var t = shuffled[s]; shuffled[s] = shuffled[si]; shuffled[si] = t;
      }
      var target = null, pick = null;
      for (var ri = 0; ri < shuffled.length; ri++) {
        var cand = shuffled[ri];
        var candidates = [];
        for (var i = 0; i < connected.length; i++) {
          var c = connected[i];
          if (c.x === cand.x || c.y === cand.y) {
            if (clearPath(c, cand, islands) && !edges.some(function (e) {
              return islandSegsCross(e[0], e[1], c, cand); // 新增桥不得与已有桥交叉
            })) candidates.push(c);
          }
        }
        if (candidates.length) { target = cand; pick = candidates[Math.floor(rng() * candidates.length)]; break; }
      }
      if (!target) return null; // 没有任何 rest 岛可连（布局问题）
      edges.push([pick, target]);
      connected.push(target);
      rest.splice(rest.indexOf(target), 1);
    }
    if (rest.length) return null;
    return edges;
  }

  /** 两点之间（同行或同列）是否无其他岛阻挡 */
  function clearPath(a, b, islands) {
    if (a.x === b.x) {
      var lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
      for (var i = 0; i < islands.length; i++) {
        var isl = islands[i];
        if (isl.x === a.x && isl.y > lo && isl.y < hi) return false;
      }
    } else {
      var lo2 = Math.min(a.x, b.x), hi2 = Math.max(a.x, b.x);
      for (var j = 0; j < islands.length; j++) {
        var isl2 = islands[j];
        if (isl2.y === a.y && isl2.x > lo2 && isl2.x < hi2) return false;
      }
    }
    return true;
  }

  /** 两条桥是否几何交叉（一条水平一条垂直、交叉点严格在两条线段内部） */
  function segsCross(a1, a2, b1, b2) {
    var aHoriz = a1[1] === a2[1], aVert = a1[0] === a2[0];
    var bHoriz = b1[1] === b2[1], bVert = b1[0] === b2[0];
    if (!((aHoriz && bVert) || (aVert && bHoriz))) return false;
    var hy = aHoriz ? a1[1] : b1[1];
    var vx = aHoriz ? b1[0] : a1[0];
    var hx1 = aHoriz ? Math.min(a1[0], a2[0]) : Math.min(b1[0], b2[0]);
    var hx2 = aHoriz ? Math.max(a1[0], a2[0]) : Math.max(b1[0], b2[0]);
    var vy1 = aHoriz ? Math.min(b1[1], b2[1]) : Math.min(a1[1], a2[1]);
    var vy2 = aHoriz ? Math.max(b1[1], b2[1]) : Math.max(a1[1], a2[1]);
    return vx > hx1 && vx < hx2 && hy > vy1 && hy < vy2;
  }
  function islandSegsCross(ia1, ia2, ib1, ib2) {
    return segsCross([ia1.x, ia1.y], [ia2.x, ia2.y], [ib1.x, ib1.y], [ib2.x, ib2.y]);
  }

  /** 候选桥：同行/同列且中间无岛的岛对（0/1/2 桥可选） */
  function candidateBridges(islands) {
    var res = [];
    for (var i = 0; i < islands.length; i++) {
      for (var j = i + 1; j < islands.length; j++) {
        var a = islands[i], b = islands[j];
        if ((a.x === b.x || a.y === b.y) && clearPath(a, b, islands)) {
          res.push([a, b]);
        }
      }
    }
    return res;
  }

  /** 求解：每个桥变量 0/1/2，数字约束 + 连通性，计数解 */
  function countSolutions(islands, limit) {
    var bridges = candidateBridges(islands);
    var bIndex = {};
    bridges.forEach(function (b, idx) { bIndex[bridgeKey(b[0], b[1])] = idx; });
    var bvals = new Array(bridges.length).fill(0);
    var count = 0;
    var nodes = 0;
    var MAX = 200000;

    function isSolved() {
      // 数字约束
      var deg = {};
      islands.forEach(function (isl) { deg[isl.id] = 0; });
      for (var i = 0; i < bridges.length; i++) {
        var w = bvals[i];
        if (w) { deg[bridges[i][0].id] += w; deg[bridges[i][1].id] += w; }
      }
      for (var k = 0; k < islands.length; k++) {
        if (deg[islands[k].id] !== islands[k].n) return false;
      }
      // 连通性：BFS 沿桥>0
      var seen = {};
      var queue = [islands[0].id];
      seen[islands[0].id] = true;
      var conn = [];
      var ci;
      for (ci = 0; ci < islands.length; ci++) conn.push([]);
      bridges.forEach(function (b, idx) {
        if (bvals[idx] > 0) { conn[b[0].id].push(b[1].id); conn[b[1].id].push(b[0].id); }
      });
      while (queue.length) {
        var cur = queue.pop();
        for (var nb of conn[cur] || []) {
          if (!seen[nb]) { seen[nb] = true; queue.push(nb); }
        }
      }
      if (Object.keys(seen).length !== islands.length) return false;
      // 交叉检查：解中任何两条桥不得几何交叉
      var act = [];
      bridges.forEach(function (b, idx) { if (bvals[idx] > 0) act.push(b); });
      for (var i2 = 0; i2 < act.length; i2++) for (var j2 = i2 + 1; j2 < act.length; j2++) {
        if (islandSegsCross(act[i2][0], act[i2][1], act[j2][0], act[j2][1])) return false;
      }
      return true;
    }

    /** 确定性回溯：从 startIdx 开始找未定桥，每层推进，避免重复选择导致的无限递归 */
    function solve(startIdx) {
      nodes++;
      if (nodes > MAX) throw new Error('nodeLimit');
      if (count >= limit) return;
      var idx = -1;
      for (var i = startIdx; i < bridges.length; i++) {
        if (bvals[i] === 0) { idx = i; break; }
      }
      if (idx < 0) {
        if (isSolved()) count++;
        return;
      }
      // 剪枝：桥两端岛的剩余需求
      var b = bridges[idx];
      var degNow = {};
      islands.forEach(function (isl) { degNow[isl.id] = 0; });
      for (var q = 0; q < bridges.length; q++) {
        if (bvals[q] && q !== idx) {
          degNow[bridges[q][0].id] += bvals[q];
          degNow[bridges[q][1].id] += bvals[q];
        }
      }
      var remA = islands[b[0].id].n - degNow[b[0].id];
      var remB = islands[b[1].id].n - degNow[b[1].id];
      // 全局剩余需求剪枝：任一岛剩余需求超出其可连桥数则剪
      for (var ia = 0; ia < islands.length; ia++) {
        var rem = islands[ia].n - degNow[ia];
        if (rem < 0) return;
        // 该岛未定候选桥数上限（含当前 idx 的 2 容量）
        var avail = 0;
        for (var q2 = 0; q2 < bridges.length; q2++) {
          if (q2 === idx) { if (bridges[q2][0].id === ia || bridges[q2][1].id === ia) avail += 2; continue; }
          if (bvals[q2] !== 0) continue;
          if (bridges[q2][0].id === ia || bridges[q2][1].id === ia) avail += 2;
        }
        if (rem > avail) return;
      }
      var maxFor = Math.min(2, remA, remB);
      if (maxFor < 0) return;
      // 该桥可选 0/1/2（minFor=0），靠全局剩余需求剪枝保证可解性
      for (var v = maxFor; v >= 0; v--) {
        bvals[idx] = v;
        solve(idx + 1);
        bvals[idx] = 0;
        if (count >= limit) return;
      }
    }

    try { solve(0); } catch (e) {
      if (e.message !== 'nodeLimit') throw e;
      return { count: count, limit: true };
    }
    return { count: count, limit: false };
  }

  /* ================= 关卡 / 存档 / 成就 ================= */
  var DIFFS = [
    { name: 'gs.hashi.easy', grid: 7, islands: 7 },
    { name: 'gs.hashi.mid', grid: 9, islands: 9 },
    { name: 'gs.hashi.hard', grid: 11, islands: 11 },
    { name: 'gs.hashi.expert', grid: 13, islands: 12 }
  ];
  var diffIdx = 0;

  /* 关卡包：12 关，盘面与岛数递进；进度存本机（旧键保持兼容） */
  var PACK_KEY = 'arcade_hashi_pack_v1';
  var META_KEY = 'arcade_hashi_meta_v1';
  var PACK_LEVELS = 12;
  var STAR_TOTAL = PACK_LEVELS * 3;
  function packDef(i) {
    var sizes = [7, 7, 9, 9, 11, 11, 13, 13, 11, 11, 13, 13];
    var isls = [7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14];
    return { grid: sizes[i], islands: isls[i], seed: 8000 + i * 131 };
  }
  function loadPackProgress() {
    try { var v = parseInt(localStorage.getItem(PACK_KEY) || '0', 10); return isFinite(v) ? Math.max(0, Math.min(PACK_LEVELS, v)) : 0; } catch (e) { return 0; }
  }
  function savePackProgress(n) {
    try { localStorage.setItem(PACK_KEY, String(n)); } catch (e) {}
  }

  var ACH = [
    { id: 'first_win', name: 'gs.hashi.achFirst', desc: 'gs.hashi.achFirstD' },
    { id: 'streak3', name: 'gs.hashi.achStreak', desc: 'gs.hashi.achStreakD' },
    { id: 'zero5', name: 'gs.hashi.achZero5', desc: 'gs.hashi.achZero5D' },
    { id: 'stars20', name: 'gs.hashi.achStars20', desc: 'gs.hashi.achStars20D' },
    { id: 'big', name: 'gs.hashi.achBig', desc: 'gs.hashi.achBigD' },
    { id: 'all', name: 'gs.hashi.achAll', desc: 'gs.hashi.achAllD' },
    { id: 'stars36', name: 'gs.hashi.achStars36', desc: 'gs.hashi.achStars36D' }
  ];
  function achKnown(id) {
    for (var i = 0; i < ACH.length; i++) if (ACH[i].id === id) return ACH[i];
    return null;
  }

  function clampInt(v, a, b) {
    v = Number(v);
    if (!isFinite(v)) return a;
    return Math.max(a, Math.min(b, Math.floor(v)));
  }
  function loadMeta() {
    var base = { stars: {}, best: {}, ach: {}, cleared: {}, wins: 0, bigWin: false };
    try {
      var raw = localStorage.getItem(META_KEY);
      if (!raw) return base;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return base;
      var k;
      if (o.stars && typeof o.stars === 'object') {
        for (k in o.stars) {
          if (!Object.prototype.hasOwnProperty.call(o.stars, k)) continue;
          var lv = parseInt(k, 10);
          if (!(lv >= 1 && lv <= PACK_LEVELS)) continue;
          var s = o.stars[k] || {};
          base.stars[k] = {
            stars: clampInt(s.stars, 0, 3),
            hintsBest: clampInt(s.hintsBest, 0, 999),
            bestMs: Math.max(0, Number(s.bestMs) || 0),
            zeroHint: !!s.zeroHint
          };
        }
      }
      if (o.best && typeof o.best === 'object') {
        for (k in o.best) {
          if (!Object.prototype.hasOwnProperty.call(o.best, k)) continue;
          var lv2 = parseInt(k, 10);
          if (!(lv2 >= 1 && lv2 <= PACK_LEVELS)) continue;
          var arr = o.best[k];
          if (!Array.isArray(arr)) continue;
          var clean = [];
          for (var i = 0; i < arr.length; i++) {
            var e = arr[i];
            if (!e || typeof e !== 'object') continue;
            var ms = Number(e.ms);
            if (!isFinite(ms) || ms < 0) continue;
            clean.push({ ms: Math.round(ms), steps: clampInt(e.steps, 0, 9999), hints: clampInt(e.hints, 0, 9999), at: Number(e.at) || 0 });
          }
          clean.sort(function (a, b) { return a.ms - b.ms; });
          base.best[k] = clean.slice(0, 5);
        }
      }
      if (o.ach && typeof o.ach === 'object') {
        for (k in o.ach) {
          if (Object.prototype.hasOwnProperty.call(o.ach, k) && achKnown(k)) base.ach[k] = Number(o.ach[k]) || Date.now();
        }
      }
      if (o.cleared && typeof o.cleared === 'object') {
        for (k in o.cleared) {
          if (!Object.prototype.hasOwnProperty.call(o.cleared, k)) continue;
          var lv3 = parseInt(k, 10);
          if (lv3 >= 1 && lv3 <= PACK_LEVELS && o.cleared[k]) base.cleared[k] = true;
        }
      }
      base.wins = clampInt(o.wins, 0, 999999);
      base.bigWin = !!o.bigWin;
    } catch (e) {}
    return base;
  }
  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  }

  function totalStars() {
    var n = 0;
    for (var i = 1; i <= PACK_LEVELS; i++) {
      var s = meta.stars[i];
      if (s) n += clampInt(s.stars, 0, 3);
    }
    return n;
  }
  function clearedCount() {
    var n = 0;
    for (var i = 1; i <= PACK_LEVELS; i++) if (meta.cleared[i]) n++;
    return n;
  }
  function zeroHintLevels() {
    var n = 0;
    for (var i = 1; i <= PACK_LEVELS; i++) if (meta.stars[i] && meta.stars[i].zeroHint) n++;
    return n;
  }
  function maxThreeStarStreak() {
    var run = 0, best = 0;
    for (var i = 1; i <= PACK_LEVELS; i++) {
      if (meta.stars[i] && meta.stars[i].stars >= 3) { run++; if (run > best) best = run; }
      else run = 0;
    }
    return best;
  }
  function unlockedAchCount() {
    var n = 0;
    for (var i = 0; i < ACH.length; i++) if (meta.ach[ACH[i].id]) n++;
    return n;
  }
  function evaluateAchievements() {
    var newly = [];
    function unlock(id) {
      if (!meta.ach[id]) { meta.ach[id] = Date.now(); newly.push(id); }
    }
    if ((meta.wins || 0) > 0) unlock('first_win');
    if (maxThreeStarStreak() >= 3) unlock('streak3');
    if (zeroHintLevels() >= 5) unlock('zero5');
    if (totalStars() >= 20) unlock('stars20');
    if (meta.bigWin) unlock('big');
    if (clearedCount() >= PACK_LEVELS) unlock('all');
    if (totalStars() >= STAR_TOTAL) unlock('stars36');
    return newly;
  }

  var packProgress = loadPackProgress();
  var meta = loadMeta();
  /* 兼容：旧 pack 存档可能仍在，meta 通关记录更完整时取较大值 */
  (function syncPackProgressFromMeta() {
    var p = packProgress, changed = false;
    for (var i = 1; i <= PACK_LEVELS; i++) {
      if (meta.cleared[i] && i > p) { p = i; changed = true; }
    }
    if (changed) { packProgress = Math.min(PACK_LEVELS, p); savePackProgress(packProgress); }
  })();

  /* mulberry32 + 日期种子（每日一题） */
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

  /* ================= DOM ================= */
  var root = document.getElementById('game-root');
  var html =
    '<div class="hs-top">' +
    '  <span>' + T('gs.hashi.diff') + ' <span class="stat-value" id="hs-diff"></span></span>' +
    '  <span>' + T('gs.hashi.time') + ' <span class="stat-value" id="hs-time">0:00</span></span>' +
    '  <span>' + T('gs.hashi.steps') + ' <span class="stat-value" id="hs-steps">0</span></span>' +
    '  <span>' + T('gs.hashi.done').replace('{n}', '<span class="stat-value" id="hs-done">0</span>') + '</span>' +
    '</div>' +
    '<div class="mode-row" id="hs-diffs"></div>' +
    '<div class="hs-msg" id="hs-msg" aria-live="polite"></div>' +
    '<div class="hs-stage">' +
    '  <canvas class="hs-canvas" id="hs-canvas" width="440" height="440" tabindex="0"></canvas>' +
    '  <div class="hs-overlay hidden" id="hs-overlay">' +
    '    <div class="hs-ov-title" id="hs-ov-title"></div>' +
    '    <div class="hs-ov-sub" id="hs-ov-sub"></div>' +
    '    <div class="game-controls"><button class="btn green" id="hs-ov-btn"></button></div>' +
    '  </div>' +
    '</div>' +
    '<div class="game-controls">' +
    '  <button class="btn purple" id="hs-hint">' + T('gs.hashi.hintBtn') + '</button>' +
    '  <button class="btn" id="hs-pack">' + T('gs.hashi.packBtn') + '</button>' +
    '  <button class="btn cyan" id="hs-meta">' + T('gs.hashi.achBtn') + '</button>' +
    '  <button class="btn yellow" id="hs-new">' + T('gs.hashi.newPuzzle') + '</button>' +
    '  <button class="btn green" id="hs-daily">' + T('gs.hashi.daily') + '</button>' +
    '</div>' +
    '<div class="hs-pack hidden" id="hs-pack-ov" role="dialog" aria-modal="true" aria-label="' + T('gs.hashi.packTitle') + '">' +
    '  <div class="hs-pack-card">' +
    '    <div class="hs-pack-head"><span>' + T('gs.hashi.packTitle') + '</span><button class="hs-pack-close" id="hs-pack-close" aria-label="' + T('gs.hashi.panelClose') + '">×</button></div>' +
    '    <div class="hs-pack-sum" id="hs-pack-sum"></div>' +
    '    <div class="hs-pack-grid" id="hs-pack-grid"></div>' +
    '    <div class="hs-pack-tip">' + T('gs.hashi.packTip') + '<br>' + T('gs.hashi.starRule') + '</div>' +
    '  </div>' +
    '</div>' +
    '<div class="hs-pack hidden" id="hs-meta-ov" role="dialog" aria-modal="true" aria-label="' + T('gs.hashi.achTitle') + '">' +
    '  <div class="hs-meta-card">' +
    '    <div class="hs-pack-head"><span>' + T('gs.hashi.achTitle') + '</span><button class="hs-pack-close" id="hs-meta-close" aria-label="' + T('gs.hashi.panelClose') + '">×</button></div>' +
    '    <div class="hs-meta-sum" id="hs-meta-sum"></div>' +
    '    <div class="hs-meta-body">' +
    '      <div class="hs-ach-list" id="hs-ach-list"></div>' +
    '      <div class="hs-sec-title">' + T('gs.hashi.metaRecords') + '</div>' +
    '      <div class="hs-meta-records" id="hs-meta-records"></div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  root.innerHTML = html;

  var canvas = document.getElementById('hs-canvas');
  var ctx = canvas.getContext('2d');
  // 逻辑尺寸取自原始 width 属性（hiDPI 只放大后备缓冲，不改属性）
  var LW = parseInt(canvas.getAttribute('width'), 10) || 440;
  var LH = parseInt(canvas.getAttribute('height'), 10) || 440;
  if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  // hiDPI 会写入固定 px 的 inline 尺寸，与响应式 width:100% 冲突导致画面被横向压缩；
  // 这里覆盖为等比自适应（1:1），保证逻辑 440×440 与显示矩形一致
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.aspectRatio = '1 / 1';
  canvas.style.display = 'block';
  canvas.setAttribute('aria-label', T('gs.hashi.boardLabel'));
  var diffEl = document.getElementById('hs-diff');
  var timeEl = document.getElementById('hs-time');
  var stepsEl = document.getElementById('hs-steps');
  var doneEl = document.getElementById('hs-done');
  var msgEl = document.getElementById('hs-msg');
  var diffRow = document.getElementById('hs-diffs');
  var overlayEl = document.getElementById('hs-overlay');
  var ovTitle = document.getElementById('hs-ov-title');
  var ovSub = document.getElementById('hs-ov-sub');
  var ovBtn = document.getElementById('hs-ov-btn');
  var hintBtn = document.getElementById('hs-hint');
  var newBtn = document.getElementById('hs-new');
  var dailyBtn = document.getElementById('hs-daily');
  var packBtn = document.getElementById('hs-pack');
  var metaBtn = document.getElementById('hs-meta');
  var packEl = document.getElementById('hs-pack-ov');
  var packGridEl = document.getElementById('hs-pack-grid');
  var packSumEl = document.getElementById('hs-pack-sum');
  var packCloseBtn = document.getElementById('hs-pack-close');
  var metaEl = document.getElementById('hs-meta-ov');
  var metaSumEl = document.getElementById('hs-meta-sum');
  var achListEl = document.getElementById('hs-ach-list');
  var recordsEl = document.getElementById('hs-meta-records');
  var metaCloseBtn = document.getElementById('hs-meta-close');

  /* ================= 运行状态 ================= */
  var puzzle = null;
  var drawn = {};        // bridgeKey -> 1/2（归一化键）
  var selIsland = null;
  var curIsland = null;  // 键盘光标
  var steps = 0;
  var isDaily = false;
  var packOn = false, packLevel = 0;
  var hintKey = null, hintLevel = 0, hintWant = 0;
  var bridgeAnim = null;
  var winFx = null, winTimer = 0, wonFlag = false;

  /* 计时 / 提示计数（每关独立，存档可续） */
  var levelHints = 0;
  var levelElapsed = 0;        // 已累计毫秒
  var levelRunStart = null;    // 当前运行起点（暂停时为 null）

  function levelElapsedMs() {
    return levelElapsed + (levelRunStart != null ? performance.now() - levelRunStart : 0);
  }
  function pauseClock() {
    if (levelRunStart != null) {
      levelElapsed += performance.now() - levelRunStart;
      levelRunStart = null;
    }
  }
  function resumeClock() {
    if (levelRunStart == null) levelRunStart = performance.now();
  }
  function fmtTime(ms) {
    var sec = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function refreshTimer() {
    if (!timeEl) return;
    timeEl.textContent = fmtTime(levelElapsedMs());
  }

  function starSpans(n, cls) {
    var out = '<span class="hs-stars' + (cls ? ' ' + cls : '') + '" aria-label="' + n + '/3">';
    for (var i = 0; i < 3; i++) out += '<i class="hs-star' + (i < n ? ' on' : '') + '"></i>';
    return out + '</span>';
  }

  /* 星级：三星=零提示且用时达标；两星=提示≤3 且用时≤2.5 倍达标线 */
  function parMsFor(idx) {
    var def = packDef(idx);
    return (25 + def.grid * 7 + def.islands * 5) * 1000;
  }
  function calcStars(hints, ms, idx) {
    var par = parMsFor(idx);
    if (hints === 0 && ms <= par) return 3;
    if (hints <= 3 && ms <= par * 2.5) return 2;
    return 1;
  }

  /* ================= 断点续玩 ================= */
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }

  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'hashi',
      collect: function () {
        if (!puzzle || wonFlag || !overlayEl.classList.contains('hidden')) return null;
        return {
          puzzle: puzzle, drawn: drawn, steps: steps, isDaily: isDaily, diffIdx: diffIdx,
          packOn: packOn, packLevel: packLevel,
          hintCount: levelHints,
          hintKey: (hintLevel >= 1 && hintLevel <= 2) ? hintKey : null,
          hintLevel: (hintLevel >= 1 && hintLevel <= 2) ? hintLevel : 0,
          hintWant: hintWant,
          elapsedMs: Math.round(levelElapsedMs()),
          day: (window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : ''
        };
      },
      apply: function (s) {
        if (!s || !s.puzzle || !Array.isArray(s.puzzle.islands) || typeof s.puzzle.rows !== 'number' || !s.puzzle.solution || typeof s.puzzle.solution !== 'object') return false;
        if (!s.drawn || typeof s.drawn !== 'object') return false;
        /* 每日题跨天失效 */
        if (s.isDaily && s.day !== ((window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : '')) return false;
        /* 旧存档桥键可能未归一化，这里统一重建 */
        var nd = {};
        for (var dk in s.drawn) {
          if (!Object.prototype.hasOwnProperty.call(s.drawn, dk)) continue;
          nd[normKey(dk)] = s.drawn[dk];
        }
        var ns = {};
        for (var sk in s.puzzle.solution) {
          if (!Object.prototype.hasOwnProperty.call(s.puzzle.solution, sk)) continue;
          ns[normKey(sk)] = s.puzzle.solution[sk];
        }
        s.puzzle.solution = ns;
        puzzle = s.puzzle;
        drawn = nd;
        steps = Math.max(0, Number(s.steps) || 0);
        isDaily = !!s.isDaily;
        diffIdx = Number(s.diffIdx) >= 0 && Number(s.diffIdx) < DIFFS.length ? Number(s.diffIdx) : 0;
        packOn = !!s.packOn;
        packLevel = Number(s.packLevel) >= 0 && Number(s.packLevel) < PACK_LEVELS ? Number(s.packLevel) : 0;
        selIsland = null; curIsland = null;
        wonFlag = false; winFx = null;
        /* 提示进度也随存档恢复：计数/星级与续玩状态保持一致 */
        if (typeof s.hintKey === 'string' && s.hintKey.indexOf('-') > 0 && Number(s.hintLevel) >= 1 && Number(s.hintLevel) <= 2) {
          hintKey = s.hintKey;
          hintLevel = Number(s.hintLevel);
          hintWant = Number(s.hintWant) || 0;
        } else {
          hintKey = null; hintLevel = 0; hintWant = 0;
        }
        levelHints = clampInt(s.hintCount, 0, 9999);
        levelElapsed = Math.max(0, Number(s.elapsedMs) || 0);
        levelRunStart = performance.now();
        diffEl.textContent = currentLabel();
        stepsEl.textContent = String(steps);
        refreshTimer();
        overlayEl.classList.add('hidden');
        var bs = diffRow.querySelectorAll('.mode-btn');
        for (var bi = 0; bi < bs.length; bi++) bs[bi].classList.toggle('selected', bi === diffIdx && !packOn);
        var d2 = new Date();
        var dstr = d2.getFullYear() + '-' + (d2.getMonth() + 1) + '-' + d2.getDate();
        msgEl.textContent = isDaily ? T('gs.hashi.dailyMsg').replace('{d}', dstr).replace('{n}', T(DIFFS[diffIdx].name))
          : (packOn ? T('gs.hashi.packResume').replace('{n}', packLevel + 1)
          : T('gs.hashi.startMsg').replace('{n}', T(DIFFS[diffIdx].name)));
        kick();
        return true;
      }
    });
  }

  function currentLabel() {
    if (packOn) return T('gs.hashi.packPre').replace('{n}', packLevel + 1);
    return isDaily ? T('gs.hashi.dailyPre').replace('{n}', T(DIFFS[diffIdx].name)) : T(DIFFS[diffIdx].name);
  }
  function syncDiffChips() {
    var bs = diffRow.querySelectorAll('.mode-btn');
    for (var bi = 0; bi < bs.length; bi++) bs[bi].classList.toggle('selected', bi === diffIdx && !packOn);
  }

  function resetRound() {
    if (winTimer) { clearTimeout(winTimer); winTimer = 0; }
    wonFlag = false;
    winFx = null;
    bridgeAnim = null;
    selIsland = null;
    curIsland = null;
    hintKey = null; hintLevel = 0; hintWant = 0;
    levelHints = 0;
    levelElapsed = 0;
    levelRunStart = performance.now();
    overlayEl.classList.add('hidden');
    refreshTimer();
  }

  function startPuzzle() {
    clearSave();
    isDaily = false;
    packOn = false;
    resetRound();
    var D = DIFFS[diffIdx];
    diffEl.textContent = currentLabel();
    syncDiffChips();
    puzzle = generate(D.grid, D.islands);
    if (!puzzle) { msgEl.textContent = T('gs.hashi.genFail'); return; }
    drawn = {};
    steps = 0;
    stepsEl.textContent = '0';
    msgEl.textContent = T('gs.hashi.startMsg').replace('{n}', T(D.name));
    render();
  }

  function startPackLevel(i) {
    clearSave();
    packOn = true;
    packLevel = Math.max(0, Math.min(PACK_LEVELS - 1, i));
    isDaily = false;
    resetRound();
    var def = packDef(packLevel);
    diffEl.textContent = currentLabel();
    syncDiffChips();
    msgEl.textContent = T('gs.hashi.packStart').replace('{n}', packLevel + 1);
    puzzle = generate(def.grid, def.islands, mulberry32(def.seed));
    if (!puzzle) {
      msgEl.textContent = T('gs.hashi.genFail');
      packOn = false;
      startPuzzle();
      return;
    }
    drawn = {};
    steps = 0;
    stepsEl.textContent = '0';
    if (packEl) packEl.classList.add('hidden');
    render();
    writeSave();
  }

  /* 每日一题：日期种子确定性生成 */
  function startDaily() {
    clearSave();
    isDaily = true;
    packOn = false;
    resetRound();
    var rng = mulberry32(todaySeed());
    var D = DIFFS[Math.floor(rng() * DIFFS.length)];
    diffEl.textContent = T('gs.hashi.dailyPre').replace('{n}', T(D.name));
    var bs = diffRow.querySelectorAll('.mode-btn');
    for (var bi = 0; bi < bs.length; bi++) bs[bi].classList.toggle('selected', bi === DIFFS.indexOf(D));
    puzzle = generate(D.grid, D.islands, rng);
    if (!puzzle) { msgEl.textContent = T('gs.hashi.genFail'); return; }
    drawn = {};
    steps = 0;
    stepsEl.textContent = '0';
    var d2 = new Date();
    msgEl.textContent = T('gs.hashi.dailyMsg').replace('{d}', d2.getFullYear() + '-' + (d2.getMonth() + 1) + '-' + d2.getDate()).replace('{n}', T(D.name));
    render();
    writeSave();
  }

  /* ================= 面板 ================= */
  function openPack() {
    if (!packEl || !packGridEl) return;
    if (metaEl) metaEl.classList.add('hidden');
    packGridEl.innerHTML = '';
    if (packSumEl) {
      packSumEl.textContent = T('gs.hashi.packStars').replace('{n}', totalStars()).replace('{m}', STAR_TOTAL)
        + ' · ' + T('gs.hashi.packCleared').replace('{n}', clearedCount()).replace('{m}', PACK_LEVELS);
    }
    for (var i = 0; i < PACK_LEVELS; i++) {
      var def = packDef(i);
      var unlocked = i <= packProgress;
      var rec = meta.stars[i + 1] || null;
      var best = (meta.best[i + 1] && meta.best[i + 1][0]) || null;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hs-pack-lv' + (unlocked ? '' : ' locked') + (packOn && i === packLevel ? ' active' : '');
      b.style.animationDelay = (i * 28) + 'ms';
      b.innerHTML = '<b>' + (i + 1) + '</b>' +
        '<span>' + def.grid + '×' + def.grid + ' · ' + def.islands + '</span>' +
        starSpans(rec ? rec.stars : 0, 'xs') +
        '<em>' + (unlocked ? (best ? fmtTime(best.ms) : T('gs.hashi.packNoBest')) : T('gs.hashi.packLocked')) + '</em>';
      if (unlocked) {
        (function (lv) {
          b.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); startPackLevel(lv); });
        })(i);
      } else {
        b.addEventListener('click', function () {
          if (Arcade.audio) Arcade.audio.play('error');
          msgEl.textContent = T('gs.hashi.packNeed');
        });
      }
      packGridEl.appendChild(b);
    }
    packEl.classList.remove('hidden');
  }
  function closePack() { if (packEl) packEl.classList.add('hidden'); }

  function openMeta() {
    if (!metaEl) return;
    if (packEl) packEl.classList.add('hidden');
    if (metaSumEl) {
      metaSumEl.textContent = T('gs.hashi.achProgress').replace('{n}', unlockedAchCount()).replace('{m}', ACH.length)
        + ' · ' + T('gs.hashi.packStars').replace('{n}', totalStars()).replace('{m}', STAR_TOTAL)
        + ' · ' + T('gs.hashi.packCleared').replace('{n}', clearedCount()).replace('{m}', PACK_LEVELS);
    }
    if (achListEl) {
      var h = '';
      for (var i = 0; i < ACH.length; i++) {
        var a = ACH[i];
        var on = !!meta.ach[a.id];
        h += '<div class="hs-ach ' + (on ? 'on' : 'off') + '" style="animation-delay:' + (i * 28) + 'ms">' +
          '<span class="hs-ach-badge"></span>' +
          '<div class="hs-ach-txt"><b>' + T(a.name) + '</b><span>' + T(a.desc) + '</span></div>' +
          '<em>' + (on ? T('gs.hashi.achUnlocked') : T('gs.hashi.achLocked')) + '</em>' +
          '</div>';
      }
      achListEl.innerHTML = h;
    }
    if (recordsEl) {
      var rh = '';
      for (var lv = 1; lv <= PACK_LEVELS; lv++) {
        var list = meta.best[lv];
        if (!list || !list.length) continue;
        var rec2 = meta.stars[lv];
        rh += '<div class="hs-rec-block"><div class="hs-rec-head"><span>L' + lv + '</span>' + starSpans(rec2 ? rec2.stars : 0, 'xs') + '</div>';
        for (var r = 0; r < list.length; r++) {
          var it = list[r];
          rh += '<div class="hs-rec-row"><span>' + T('gs.hashi.metaRecordLine')
            .replace('{r}', r + 1).replace('{t}', fmtTime(it.ms)).replace('{s}', it.steps).replace('{h}', it.hints) + '</span></div>';
        }
        rh += '</div>';
      }
      recordsEl.innerHTML = rh || '<div class="hs-meta-empty">' + T('gs.hashi.metaNoRecord') + '</div>';
    }
    metaEl.classList.remove('hidden');
  }
  function closeMeta() { if (metaEl) metaEl.classList.add('hidden'); }

  /* ================= 完成判定 ================= */
  function findIslandId(key) {
    var parts = key.split(',');
    var x = +parts[0], y = +parts[1];
    for (var i = 0; i < puzzle.islands.length; i++) {
      if (puzzle.islands[i].x === x && puzzle.islands[i].y === y) return puzzle.islands[i].id;
    }
    return -1;
  }
  function computeDeg() {
    var deg = {};
    puzzle.islands.forEach(function (isl) { deg[isl.id] = 0; });
    for (var k in drawn) {
      if (!Object.prototype.hasOwnProperty.call(drawn, k)) continue;
      var w = drawn[k];
      if (!w) continue;
      var parts = k.split('-');
      var ia = findIslandId(parts[0]), ib = findIslandId(parts[1]);
      if (ia >= 0) deg[ia] += w;
      if (ib >= 0) deg[ib] += w;
    }
    return deg;
  }
  function evaluateBoard() {
    var deg = computeDeg();
    var i;
    for (i = 0; i < puzzle.islands.length; i++) {
      if (deg[puzzle.islands[i].id] !== puzzle.islands[i].n) return { ok: false, reason: 'degree' };
    }
    // 连通性
    var seen = {};
    var queue = [puzzle.islands[0].id];
    seen[puzzle.islands[0].id] = true;
    var keys = Object.keys(drawn).filter(function (k) { return drawn[k]; });
    while (queue.length) {
      var cur = queue.pop();
      for (var ki = 0; ki < keys.length; ki++) {
        var parts = keys[ki].split('-');
        var ia = findIslandId(parts[0]), ib = findIslandId(parts[1]);
        if (ia === cur && !seen[ib]) { seen[ib] = true; queue.push(ib); }
        if (ib === cur && !seen[ia]) { seen[ia] = true; queue.push(ia); }
      }
    }
    if (Object.keys(seen).length !== puzzle.islands.length) return { ok: false, reason: 'notConnected' };
    // 交叉
    for (var di = 0; di < keys.length; di++) {
      for (var dj = di + 1; dj < keys.length; dj++) {
        var p1 = keys[di].split('-')[0].split(',').map(Number);
        var p2 = keys[di].split('-')[1].split(',').map(Number);
        var q1 = keys[dj].split('-')[0].split(',').map(Number);
        var q2 = keys[dj].split('-')[1].split(',').map(Number);
        if (segsCross(p1, p2, q1, q2)) return { ok: false, reason: 'cross' };
      }
    }
    return { ok: true, reason: 'ok' };
  }
  function checkComplete() {
    if (!puzzle || wonFlag) return false;
    var st = evaluateBoard();
    if (!st.ok) {
      if (st.reason === 'notConnected') msgEl.textContent = T('gs.hashi.notConnected');
      else if (st.reason === 'cross') msgEl.textContent = T('gs.hashi.cross');
      return false;
    }
    winGame();
    return true;
  }

  function buildWinSequence() {
    var seq = [];
    if (!puzzle) return seq;
    var seen = {};
    var startId = puzzle.islands[0].id;
    var q = [startId];
    var visited = {};
    visited[startId] = true;
    var keys = Object.keys(puzzle.solution).filter(function (k) { return puzzle.solution[k]; });
    while (q.length) {
      var cur = q.shift();
      seq.push(cur);
      for (var i = 0; i < keys.length; i++) {
        var parts = keys[i].split('-');
        var ia = findIslandId(parts[0]), ib = findIslandId(parts[1]);
        var nb = ia === cur ? ib : (ib === cur ? ia : -1);
        if (nb >= 0 && !visited[nb]) { visited[nb] = true; q.push(nb); }
      }
    }
    return seq;
  }

  function startWinFx() {
    winFx = { start: performance.now(), seq: buildWinSequence() };
    kick();
  }

  function winGame() {
    wonFlag = true;
    pauseClock();
    clearSave();
    var ms = levelElapsedMs();
    var usedHints = levelHints;
    var newRecord = false;
    var stars = 0;
    hintKey = null; hintLevel = 0; hintWant = 0;

    if (packOn) {
      var lv = packLevel + 1;
      stars = calcStars(usedHints, ms, packLevel);
      var rec = meta.stars[lv];
      var prevBest = rec && rec.bestMs ? rec.bestMs : 0;
      meta.stars[lv] = {
        stars: Math.max(rec ? rec.stars : 0, stars),
        hintsBest: Math.min(rec ? rec.hintsBest : 999, usedHints),
        bestMs: prevBest > 0 ? Math.min(prevBest, Math.round(ms)) : Math.round(ms),
        zeroHint: !!(rec && rec.zeroHint) || usedHints === 0
      };
      meta.cleared[lv] = true;
      var list = meta.best[lv] || [];
      newRecord = !list.length || ms < list[0].ms;
      list.push({ ms: Math.round(ms), steps: steps, hints: usedHints, at: Date.now() });
      list.sort(function (a, b) { return a.ms - b.ms; });
      meta.best[lv] = list.slice(0, 5);
      packProgress = Math.max(packProgress, Math.min(PACK_LEVELS, packLevel + 1));
      savePackProgress(packProgress);
    }
    if (puzzle.rows === 13) meta.bigWin = true;
    meta.wins = (meta.wins || 0) + 1;
    saveMeta();
    var newly = evaluateAchievements();
    if (newly.length) {
      saveMeta();
      announceAchievements(newly);
    }

    // 完成特效 + 结算内容（延迟展示，先看全岛跑光）
    startWinFx();
    if (Arcade.juice) Arcade.juice.win();
    if (Arcade.fx) {
      Arcade.fx.flash('var(--neon-green)');
      setTimeout(function () { Arcade.fx.centerBurst('var(--neon-cyan)', 24); }, 260);
      setTimeout(function () { Arcade.fx.centerBurst('var(--neon-yellow)', 20); }, 620);
    }

    if (packOn) {
      ovTitle.textContent = T('gs.hashi.packWin').replace('{n}', packLevel + 1);
      ovSub.innerHTML = starSpans(stars, 'lg') +
        '<div class="hs-win-line">' + T('gs.hashi.winLine')
          .replace('{t}', fmtTime(ms)).replace('{h}', usedHints).replace('{s}', steps) + '</div>' +
        (newRecord ? '<div class="hs-newrec">' + T('gs.hashi.newRecord') + '</div>' : '') +
        '<div class="hs-win-line">' + T('gs.hashi.packUnlock').replace('{n}', Math.min(PACK_LEVELS, packProgress + 1)) + '</div>';
      if (packLevel < PACK_LEVELS - 1) {
        ovBtn.textContent = T('gs.hashi.nextLevel');
        ovBtn.onclick = function () { startPackLevel(packLevel + 1); };
      } else {
        ovBtn.textContent = T('gs.hashi.backPack');
        ovBtn.onclick = function () { overlayEl.classList.add('hidden'); openPack(); };
      }
    } else {
      ovTitle.textContent = T('gs.hashi.winT');
      ovSub.innerHTML = '<div class="hs-win-line">' + T('gs.hashi.winLine')
        .replace('{t}', fmtTime(ms)).replace('{h}', usedHints).replace('{s}', steps) + '</div>';
      ovBtn.textContent = T('gs.hashi.again');
      ovBtn.onclick = startPuzzle;
    }

    if (winTimer) clearTimeout(winTimer);
    winTimer = setTimeout(function () {
      winTimer = 0;
      overlayEl.classList.remove('hidden');
    }, reduceMotion ? 150 : 900);

    if (Arcade.shell) Arcade.shell.submitScore(steps);
    if (Arcade.daily && isDaily) Arcade.daily.markSolved('hashi', steps);
    kick();
  }

  /* ================= 提示（三级递进，场景一致） ================= */
  function findBadBridge() {
    if (!puzzle || !puzzle.solution) return null;
    var k;
    // 先找出玩家多画/画错的桥（含解里不存在的桥）
    for (k in drawn) {
      if (!Object.prototype.hasOwnProperty.call(drawn, k)) continue;
      if (!drawn[k]) continue;
      if (!Object.prototype.hasOwnProperty.call(puzzle.solution, k) || drawn[k] !== puzzle.solution[k]) {
        return { key: k, want: puzzle.solution[k] || 0 };
      }
    }
    // 再找解里尚未画对的桥
    for (k in puzzle.solution) {
      if (!Object.prototype.hasOwnProperty.call(puzzle.solution, k)) continue;
      if ((drawn[k] || 0) !== puzzle.solution[k]) return { key: k, want: puzzle.solution[k] };
    }
    return null;
  }
  function islandLabel(id) {
    for (var i = 0; i < puzzle.islands.length; i++) {
      var isl = puzzle.islands[i];
      if (isl.id === id) return { x: isl.x + 1, y: isl.y + 1, n: isl.n, index: i + 1 };
    }
    return { x: 0, y: 0, n: 0, index: 0 };
  }
  function giveHint() {
    if (!puzzle) {
      msgEl.textContent = T('gs.hashi.hintNoPuzzle');
      return { ok: false, reason: 'nopuzzle' };
    }
    if (wonFlag) return { ok: false, reason: 'done' };
    var bad = findBadBridge();
    if (!bad) {
      hintKey = null; hintLevel = 0; hintWant = 0;
      // 兜底：给出可行动的解释，绝不静默失败
      var st = evaluateBoard();
      if (st.ok) msgEl.textContent = T('gs.hashi.allRight');
      else if (st.reason === 'notConnected') msgEl.textContent = T('gs.hashi.notConnected');
      else if (st.reason === 'cross') msgEl.textContent = T('gs.hashi.cross');
      else msgEl.textContent = T('gs.hashi.hintFallback');
      if (Arcade.audio) Arcade.audio.play('error');
      render();
      return { ok: false, reason: st.reason };
    }
    /* 场景无关：普通 / 每日 / 关卡包共用同一套三级提示 */
    levelHints++;
    if (!hintKey || hintKey !== bad.key || hintLevel >= 3 || (drawn[hintKey] || 0) === hintWant) {
      hintKey = bad.key; hintWant = bad.want; hintLevel = 1;
    } else {
      hintLevel++;
    }
    var parts = hintKey.split('-');
    if (parts.length !== 2) {
      hintKey = null; hintLevel = 0;
      msgEl.textContent = T('gs.hashi.hintFallback');
      return { ok: false, reason: 'badkey' };
    }
    var a = parts[0].split(',').map(Number), b = parts[1].split(',').map(Number);
    var idA = findIslandId(parts[0]);
    var la = islandLabel(idA);
    var dir = 'gs.hashi.dirE';
    if (b[0] < a[0]) dir = 'gs.hashi.dirW';
    else if (b[1] > a[1]) dir = 'gs.hashi.dirS';
    else if (b[1] < a[1]) dir = 'gs.hashi.dirN';
    var want = hintWant;
    if (hintLevel === 1) {
      msgEl.textContent = T('gs.hashi.hintTip1')
        .replace('{row}', la.y).replace('{col}', la.x).replace('{n}', la.n)
        .replace('{dir}', T(dir)).replace('{w}', want > 0 ? want : T('gs.hashi.removeW'))
        + ' ' + T('gs.hashi.hintUsed').replace('{n}', levelHints);
      writeSave();
    } else if (hintLevel === 2) {
      msgEl.textContent = T('gs.hashi.hintTip2').replace('{w}', want > 0 ? want : T('gs.hashi.removeW'))
        + ' ' + T('gs.hashi.hintUsed').replace('{n}', levelHints);
      writeSave();
    } else {
      var have = drawn[hintKey] || 0;
      msgEl.textContent = T('gs.hashi.hintTip3');
      animateBridge(hintKey, have, want);
      if (want) drawn[hintKey] = want; else delete drawn[hintKey];
      steps++;
      stepsEl.textContent = steps;
      hintKey = null; hintLevel = 0; hintWant = 0;
      if (Arcade.audio) Arcade.audio.play('coin');
      writeSave();
      checkComplete();
      render();
      return { ok: true, level: 3, hints: levelHints };
    }
    if (Arcade.audio) Arcade.audio.play('coin');
    kick();
    return { ok: true, level: hintLevel, key: hintKey, hints: levelHints };
  }

  /* ================= 交互 ================= */
  function animateBridge(key, prev, next) {
    bridgeAnim = { key: key, prev: prev, next: next, start: performance.now() };
    kick();
  }

  function tapIsland(isl) {
    if (wonFlag) return false;
    if (!selIsland) {
      selIsland = isl;
      curIsland = isl;
      msgEl.textContent = T('gs.hashi.selected').replace('{n}', isl.n);
      if (Arcade.audio) Arcade.audio.play('select');
      kick();
      return true;
    }
    if (selIsland.id === isl.id) {
      selIsland = null;
      kick();
      return true;
    }
    var a = selIsland, b = isl;
    if ((a.x === b.x || a.y === b.y) && clearPath(a, b, puzzle.islands)) {
      var key = bridgeKey(a, b);
      var cur = drawn[key] || 0;
      var next = (cur + 1) % 3;
      if (next) drawn[key] = next; else delete drawn[key];
      hintKey = null; hintLevel = 0; hintWant = 0;
      steps++;
      stepsEl.textContent = steps;
      animateBridge(key, cur, next);
      if (Arcade.audio) Arcade.audio.play(next ? (next === 2 ? 'merge' : 'match') : 'drop');
      selIsland = null;
      writeSave();
      checkComplete();
      kick();
      return true;
    }
    msgEl.textContent = T('gs.hashi.cantBridge');
    if (Arcade.audio) Arcade.audio.play('error');
    return false;
  }

  /* 点击：选岛 → 点同行/同列岛循环 0→1→2→0 */
  function hitTest(px, py2, scale) {
    var pad = 30;
    var cell = (LW - pad * 2) / (puzzle.rows - 1);
    var best = null, bestD = 1e9;
    // 命中半径按画布缩放等比放大，保证小屏触控 ≥44px；
    // 大盘（13×13）岛间距更小，半径同时随逻辑格距放大（≥1.6 格），避免两岛中点出现吸附空档
    var r = Math.max(26 * (scale || 1), cell * 1.6);
    puzzle.islands.forEach(function (isl) {
      var d = Math.abs(px - (pad + isl.x * cell)) + Math.abs(py2 - (pad + isl.y * cell));
      if (d < r && d < bestD) { bestD = d; best = isl; }
    });
    return best;
  }

  canvas.addEventListener('click', function (e) {
    if (!puzzle) return;
    var rect = canvas.getBoundingClientRect();
    // 横纵分别映射：显示矩形与逻辑尺寸未必严格等比（安全兜底）
    var sx = LW / (rect.width || 1);
    var sy = LH / (rect.height || 1);
    var cx = (e.clientX - rect.left) * sx;
    var cy = (e.clientY - rect.top) * sy;
    var isl = hitTest(cx, cy, (sx + sy) / 2);
    if (!isl) return;
    tapIsland(isl);
  });

  /* 键盘：方向键选岛，回车/空格架桥，H 提示，R 换题，Esc 取消 */
  function moveCursor(dx, dy) {
    if (!puzzle) return;
    var from = curIsland || selIsland || puzzle.islands[0];
    var best = null, bestScore = 1e9;
    puzzle.islands.forEach(function (isl) {
      if (isl.id === from.id) return;
      var vx = isl.x - from.x, vy = isl.y - from.y;
      var proj = vx * dx + vy * dy;
      if (proj <= 0) return;
      var side = Math.abs(vx * dy - vy * dx);
      var score = Math.hypot(vx, vy) + side * 2.2;
      if (score < bestScore) { bestScore = score; best = isl; }
    });
    if (best) { curIsland = best; kick(); }
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    var modalOpen = (packEl && !packEl.classList.contains('hidden')) || (metaEl && !metaEl.classList.contains('hidden'));
    if (e.key === 'Escape') {
      if (modalOpen) { closePack(); closeMeta(); e.preventDefault(); return; }
      if (!overlayEl.classList.contains('hidden')) { overlayEl.classList.add('hidden'); e.preventDefault(); return; }
      selIsland = null; curIsland = null; kick();
      return;
    }
    if (modalOpen) return;
    if (!overlayEl.classList.contains('hidden')) {
      if ((e.key === 'Enter' || e.key === ' ') && tag !== 'button') { if (ovBtn) ovBtn.click(); e.preventDefault(); }
      return;
    }
    if (!puzzle) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (tag === 'button') return; // 保留按钮默认行为
      e.preventDefault();
      if (e.key === 'ArrowLeft') moveCursor(-1, 0);
      else if (e.key === 'ArrowRight') moveCursor(1, 0);
      else if (e.key === 'ArrowUp') moveCursor(0, -1);
      else moveCursor(0, 1);
      return;
    }
    if (tag === 'button' || tag === 'a') return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.repeat) return;
      e.preventDefault();
      var isl = curIsland || selIsland || puzzle.islands[0];
      curIsland = isl;
      tapIsland(isl);
      return;
    }
    var low = e.key.toLowerCase();
    if (low === 'h' || e.key === '?') { e.preventDefault(); giveHint(); }
    else if (low === 'r') { e.preventDefault(); startPuzzle(); }
  });

  window.addEventListener('resize', function () { kick(); });

  /* ================= 成就提示 ================= */
  function announceAchievements(ids) {
    if (!ids || !ids.length) return;
    for (var i = 0; i < ids.length; i++) {
      (function (id, idx) {
        setTimeout(function () { showAchToast(id); }, idx * 950);
      })(ids[i], i);
    }
  }
  function showAchToast(id) {
    var a = achKnown(id);
    if (!a) return;
    var el = document.createElement('div');
    el.className = 'hs-ach-toast';
    el.innerHTML = '<span class="hs-ach-badge"></span>' +
      '<div><div class="t1">' + T('gs.hashi.achToast') + '</div><div class="t2">' + T(a.name) + '</div></div>';
    document.body.appendChild(el);
    if (Arcade.fx) Arcade.fx.centerBurst('var(--neon-yellow)', 18);
    if (Arcade.audio) Arcade.audio.play('win');
    setTimeout(function () { if (el.parentNode) el.classList.add('out'); }, 2500);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3100);
  }

  /* ================= 渲染（自绘 Canvas，无 emoji 美术） ================= */
  var rafId = 0, lastFrame = 0;

  function kick() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
  function frame(ts) {
    rafId = 0;
    if (document.hidden) return;
    var now = performance.now();
    if (bridgeAnim && now - bridgeAnim.start > 460) bridgeAnim = null;
    if (winFx && now - winFx.start > 3400) winFx = null;
    var active = !!bridgeAnim || !!winFx || !!selIsland || hintLevel === 2;
    var gap = active ? 16 : 40;
    if (!lastFrame || ts - lastFrame >= gap) {
      lastFrame = ts;
      render();
    }
    rafId = requestAnimationFrame(frame);
  }

  /* 星尘（背景细点，固定种子） */
  var dust = (function () {
    var rnd = mulberry32(20261104);
    var arr = [];
    for (var i = 0; i < 22; i++) {
      arr.push({ x: rnd() * LW, y: rnd() * LH, r: 0.6 + rnd() * 1.3, ph: rnd() * 6.28 });
    }
    return arr;
  })();

  function drawSea(now, w, h) {
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#07132b');
    bg.addColorStop(0.45, '#050b1d');
    bg.addColorStop(1, '#03040d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var fog1 = ctx.createRadialGradient(w * 0.16, h * 0.13, 4, w * 0.16, h * 0.13, w * 0.62);
    fog1.addColorStop(0, 'rgba(0,240,255,.18)');
    fog1.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = fog1; ctx.fillRect(0, 0, w, h);

    var fog2 = ctx.createRadialGradient(w * 0.88, h * 0.92, 4, w * 0.88, h * 0.92, w * 0.55);
    fog2.addColorStop(0, 'rgba(185,103,255,.16)');
    fog2.addColorStop(1, 'rgba(185,103,255,0)');
    ctx.fillStyle = fog2; ctx.fillRect(0, 0, w, h);

    /* 海面波纹：低透明度正弦曲线，缓慢漂移 */
    var t = reduceMotion ? 0 : now / 2600;
    ctx.save();
    ctx.lineWidth = 1.15;
    for (var i = 0; i < 5; i++) {
      var yy = h * (0.12 + i * 0.185) + Math.sin(t + i * 0.9) * 5;
      ctx.beginPath();
      for (var x = -10; x <= w + 10; x += 18) {
        var yw = yy + Math.sin(x / 62 + t * 1.7 + i) * 4.5;
        if (x === -10) ctx.moveTo(x, yw); else ctx.lineTo(x, yw);
      }
      ctx.strokeStyle = 'rgba(0,214,255,' + (0.045 + i * 0.009) + ')';
      ctx.stroke();
    }
    ctx.restore();

    /* 星尘 */
    for (var d = 0; d < dust.length; d++) {
      var a = 0.10 + 0.10 * Math.sin(now / 900 + dust[d].ph);
      ctx.fillStyle = 'rgba(170,235,255,' + Math.max(0.03, a) + ')';
      ctx.beginPath();
      ctx.arc(dust[d].x, dust[d].y, dust[d].r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBridge(x1, y1, x2, y2, wgt, key, now) {
    if (!wgt) return;
    var prog = 1, alpha = 1, removing = false;
    if (bridgeAnim && bridgeAnim.key === key) {
      var raw = Math.min(1, (now - bridgeAnim.start) / 340);
      if (bridgeAnim.next === 0 && bridgeAnim.prev > 0) {
        removing = true;
        prog = 1 - (1 - Math.pow(1 - raw, 3));
        alpha = 1 - raw * 0.55;
      } else if (raw < 1) {
        var t = raw;
        prog = 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); // easeOutBack 弹性
        if (prog > 1.06) prog = 1.06;
        if (prog < 0) prog = 0;
        alpha = 0.35 + 0.65 * Math.max(0, Math.min(1, raw * 1.8));
      }
    }
    var horiz = Math.abs(x1 - x2) > Math.abs(y1 - y2);
    var offs = wgt === 2 ? [-3.6, 3.6] : [0];
    ctx.save();
    for (var i = 0; i < offs.length; i++) {
      var off = offs[i];
      var ex = x1 + (x2 - x1) * prog;
      var ey = y1 + (y2 - y1) * prog;
      /* 第二根桥延迟生长（双桥落笔错位） */
      var p2 = prog;
      if (wgt === 2 && prog < 1) {
        if (i === 0) p2 = Math.min(1, prog * 1.7); else p2 = Math.max(0, prog * 1.35 - 0.35);
        ex = x1 + (x2 - x1) * p2; ey = y1 + (y2 - y1) * p2;
      }
      if (p2 <= 0 && removing) continue;
      ctx.globalAlpha = alpha;

      /* 桥面暗底 */
      ctx.strokeStyle = 'rgba(1,10,18,.9)';
      ctx.lineWidth = 6.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (horiz) { ctx.moveTo(x1, y1 + off); ctx.lineTo(ex, ey + off); }
      else { ctx.moveTo(x1 + off, y1); ctx.lineTo(ex + off, ey); }
      ctx.stroke();

      /* 霓虹桥身 */
      var grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, '#35d8ff');
      grad.addColorStop(0.5, '#9ffcff');
      grad.addColorStop(1, '#c58bff');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = 'rgba(0,240,255,.9)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      if (horiz) { ctx.moveTo(x1, y1 + off); ctx.lineTo(ex, ey + off); }
      else { ctx.moveTo(x1 + off, y1); ctx.lineTo(ex + off, ey); }
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* 高光细线（向光源侧偏移） */
      ctx.strokeStyle = 'rgba(235,255,255,.85)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      if (horiz) { ctx.moveTo(x1, y1 + off - 1.2); ctx.lineTo(ex, ey + off - 1.2); }
      else { ctx.moveTo(x1 + off - 1.2, y1); ctx.lineTo(ex + off - 1.2, ey); }
      ctx.stroke();
    }
    /* 端点节点 */
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(190,255,255,.95)';
    ctx.beginPath(); ctx.arc(x1, y1, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(210,190,255,.85)';
    ctx.beginPath(); ctx.arc(x2, y2, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function render() {
    if (!puzzle) return;
    var now = reduceMotion ? 0 : performance.now();
    var w = LW, h = LH, pad = 30;
    var cell = (w - pad * 2) / (puzzle.rows - 1);
    function px(x) { return pad + x * cell; }
    function py(y) { return pad + y * cell; }

    ctx.clearRect(0, 0, w, h);
    drawSea(now, w, h);

    /* 交点微光 */
    ctx.fillStyle = 'rgba(150,210,255,.13)';
    for (var gy = 0; gy < puzzle.rows; gy++) {
      for (var gx = 0; gx < puzzle.cols; gx++) {
        ctx.beginPath(); ctx.arc(px(gx), py(gy), 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    var deg = computeDeg();
    var done = 0;
    var k;
    for (k in drawn) {
      if (!Object.prototype.hasOwnProperty.call(drawn, k)) continue;
      if (!drawn[k]) continue;
      done++;
      var parts = k.split('-');
      var a = parts[0].split(',').map(Number), b = parts[1].split(',').map(Number);
      drawBridge(px(a[0]), py(a[1]), px(b[0]), py(b[1]), drawn[k], k, now);
    }
    doneEl.textContent = done;

    var hintEnds = {};
    if (hintKey && hintLevel >= 2) {
      var hp = hintKey.split('-');
      if (hp.length === 2) { hintEnds[hp[0]] = true; hintEnds[hp[1]] = true; }
    }

    /* 提示虚线 + 箭头 */
    if (hintKey && hintLevel >= 2 && hintWant > 0) {
      var hp2 = hintKey.split('-');
      var ha = hp2[0].split(',').map(Number), hb = hp2[1].split(',').map(Number);
      var x1 = px(ha[0]), y1 = py(ha[1]), x2 = px(hb[0]), y2 = py(hb[1]);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,230,0,.92)';
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 6]);
      ctx.lineDashOffset = -now / 26;
      ctx.shadowColor = 'rgba(255,230,0,.8)';
      ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      var ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,230,0,.95)';
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 11 * Math.cos(ang - 0.42), y2 - 11 * Math.sin(ang - 0.42));
      ctx.lineTo(x2 - 11 * Math.cos(ang + 0.42), y2 - 11 * Math.sin(ang + 0.42));
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    /* 岛屿（浮雕 + 数字脉冲） */
    var rad = Math.max(11, Math.min(21, cell * 0.44));
    var fs = Math.max(9, Math.min(15, Math.round(cell * 0.50)));
    var winBoost = 0;
    if (winFx) {
      var ageW = (now - winFx.start) / 1000;
      winBoost = ageW < 1.6 ? (1 - ageW / 1.6) : 0;
    }
    var pulseT = now / 600;

    for (var ii = 0; ii < puzzle.islands.length; ii++) {
      var isl = puzzle.islands[ii];
      var x = px(isl.x), y = py(isl.y);
      var got = deg[isl.id] || 0;
      var over = got > isl.n;
      var sat = got === isl.n && !over;
      var isSel = !!(selIsland && selIsland.id === isl.id);
      var isCur = !!(curIsland && curIsland.id === isl.id);
      var isHint = !!(hintEnds[islandCoordKey(isl)]);
      var pulse = sat ? 0.5 + 0.5 * Math.sin(pulseT * 4.4 + isl.id) : 0;

      ctx.save();
      /* 接触阴影 */
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath();
      ctx.ellipse(x + 2.5, y + rad * 0.62, rad * 0.96, rad * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();

      /* 底座 */
      ctx.fillStyle = '#02050b';
      ctx.beginPath(); ctx.arc(x, y, rad + 2.2, 0, Math.PI * 2); ctx.fill();

      /* 球体浮雕渐变 */
      var body = ctx.createRadialGradient(x - rad * 0.42, y - rad * 0.46, rad * 0.12, x + rad * 0.1, y + rad * 0.2, rad * 1.12);
      if (over) { body.addColorStop(0, '#ff7fb5'); body.addColorStop(0.42, '#8d1746'); body.addColorStop(1, '#1a0410'); }
      else if (sat) { body.addColorStop(0, '#a8ffc0'); body.addColorStop(0.4, '#1d7a46'); body.addColorStop(1, '#03150b'); }
      else { body.addColorStop(0, '#9feaff'); body.addColorStop(0.4, '#1b5b74'); body.addColorStop(1, '#041019'); }
      if (winBoost > 0) {
        body.addColorStop(0, 'rgba(255,255,255,' + (0.35 + winBoost * 0.4) + ')');
      }
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();

      /* 顶部高光弧 */
      ctx.strokeStyle = 'rgba(255,255,255,.34)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, rad - 1.3, Math.PI * 1.06, Math.PI * 1.62);
      ctx.stroke();
      /* 底部反光 */
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, rad - 1, Math.PI * 0.1, Math.PI * 0.55);
      ctx.stroke();

      /* 需求进度环 */
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,.13)';
      ctx.beginPath(); ctx.arc(x, y, rad + 5, 0, Math.PI * 2); ctx.stroke();
      var frac = isl.n > 0 ? Math.min(1, got / isl.n) : 0;
      if (frac > 0) {
        ctx.strokeStyle = over ? '#ff2d95' : (sat ? '#39ff14' : '#00f0ff');
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = sat ? 10 + pulse * 8 : 8;
        ctx.lineWidth = sat ? 3 + pulse * 0.8 : 3;
        ctx.beginPath();
        ctx.arc(x, y, rad + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      /* 选中/键盘光标/提示端点 */
      if (isSel) {
        var sp = 0.5 + 0.5 * Math.sin(now / 250);
        ctx.fillStyle = 'rgba(255,230,0,' + (0.07 + sp * 0.1) + ')';
        ctx.beginPath(); ctx.arc(x, y, rad + 9 + sp * 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,0,' + (0.55 + sp * 0.45) + ')';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -now / 24;
        ctx.beginPath(); ctx.arc(x, y, rad + 8 + sp * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (isCur) {
        ctx.strokeStyle = 'rgba(185,103,255,.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -now / 30;
        ctx.beginPath(); ctx.arc(x, y, rad + 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        /* 十字光标刻度 */
        ctx.strokeStyle = 'rgba(185,103,255,.6)';
        ctx.lineWidth = 1.4;
        var cr = rad + 11;
        ctx.beginPath();
        ctx.moveTo(x - cr, y); ctx.lineTo(x - cr + 4, y);
        ctx.moveTo(x + cr - 4, y); ctx.lineTo(x + cr, y);
        ctx.moveTo(x, y - cr); ctx.lineTo(x, y - cr + 4);
        ctx.moveTo(x, y + cr - 4); ctx.lineTo(x, y + cr);
        ctx.stroke();
      }
      if (isHint) {
        var hpulse = 0.5 + 0.5 * Math.sin(pulseT * 3.2);
        ctx.strokeStyle = 'rgba(255,230,0,' + (0.5 + hpulse * 0.45) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, rad + 10 + hpulse * 3, 0, Math.PI * 2); ctx.stroke();
      }

      /* 数字（满足时饱和脉冲） */
      ctx.save();
      ctx.translate(x, y + 1);
      var ns = sat ? 1 + 0.065 * pulse : (isSel ? 1.04 : 1);
      ctx.scale(ns, ns);
      ctx.font = 'bold ' + fs + 'px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = over ? '#ffd2e4' : (sat ? '#eafff0' : '#d7feff');
      ctx.shadowColor = over ? '#ff2d95' : (sat ? '#39ff14' : '#00f0ff');
      ctx.shadowBlur = sat ? 8 + pulse * 10 : 7;
      ctx.fillText(String(isl.n), 0, 0);
      ctx.restore();

      ctx.restore();
    }

    /* 完成：全岛跑光 + 粒子 */
    if (winFx) {
      var age = (now - winFx.start) / 1000;
      for (var wi = 0; wi < winFx.seq.length; wi++) {
        var id = winFx.seq[wi];
        var isl2 = islandById(id);
        if (!isl2) continue;
        var x2 = px(isl2.x), y2 = py(isl2.y);
        var p = (age - wi * 0.085) / 0.6;
        if (p < 0) continue;
        if (p < 1) {
          ctx.save();
          ctx.strokeStyle = 'rgba(120,255,220,' + (0.8 * (1 - p)) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x2, y2, rad + p * rad * 2.6, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,' + (0.45 * (1 - p)) + ')';
          ctx.beginPath(); ctx.arc(x2, y2, rad * (1 - p * 0.5), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (p >= 0 && p < 1.6) {
          for (var pj = 0; pj < 5; pj++) {
            var ang2 = (pj / 5) * Math.PI * 2 + isl2.id * 0.7;
            var dd = p * rad * 3.1;
            var pa = Math.max(0, 1 - p / 1.6);
            ctx.fillStyle = pj % 2 ? 'rgba(255,230,0,' + (pa * 0.9) + ')' : 'rgba(140,255,230,' + (pa * 0.9) + ')';
            ctx.beginPath();
            ctx.arc(x2 + Math.cos(ang2) * dd, y2 + Math.sin(ang2) * dd - p * 8, 1.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function islandCoordKey(isl) { return isl.x + ',' + isl.y; }
  function islandById(id) {
    if (!puzzle) return null;
    for (var i = 0; i < puzzle.islands.length; i++) if (puzzle.islands[i].id === id) return puzzle.islands[i];
    return null;
  }

  /* ================= 事件绑定 ================= */
  hintBtn.addEventListener('click', function () { giveHint(); });
  newBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); startPuzzle(); });
  if (packBtn) packBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); openPack(); });
  if (packCloseBtn) packCloseBtn.addEventListener('click', closePack);
  if (metaBtn) metaBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); openMeta(); });
  if (metaCloseBtn) metaCloseBtn.addEventListener('click', closeMeta);
  if (packEl) packEl.addEventListener('click', function (e) { if (e.target === packEl) closePack(); });
  if (metaEl) metaEl.addEventListener('click', function (e) { if (e.target === metaEl) closeMeta(); });

  dailyBtn.addEventListener('click', function () { if (Arcade.audio) Arcade.audio.play('ui'); startDaily(); });

  DIFFS.forEach(function (d, i) {
    var b = document.createElement('button');
    b.type = 'button';
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

  /* 计时器刷新（仅 UI） */
  setInterval(function () {
    if (puzzle && !wonFlag && overlayEl.classList.contains('hidden')) refreshTimer();
  }, 500);

  /* 页面前后台：暂停/恢复计时（存档由 savegame 负责） */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseClock();
    else if (puzzle && !wonFlag && overlayEl.classList.contains('hidden')) {
      resumeClock();
      refreshTimer();
      kick();
    }
  });

  if (!tryResume()) startPuzzle();
  else if (!levelRunStart) levelRunStart = performance.now();
  kick();

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.hashi.helpText') + '<span class="hs-kb">' + T('gs.hashi.kbHint') + '</span>';
  root.appendChild(hd);

  window.GAME_RESTART = startPuzzle;

  /* 调试钩子：仅 ?qa=1 时挂载，正常访问不暴露可篡改状态的入口 */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) {
    window.__qa = {
      state: function () {
        var done = 0;
        for (var k in drawn) if (drawn[k]) done++;
        return {
          steps: steps, packOn: packOn, packLevel: packLevel, packProgress: packProgress,
          islands: puzzle ? puzzle.islands.length : 0, grid: puzzle ? puzzle.rows : 0,
          bridges: done, weights: JSON.parse(JSON.stringify(drawn)), solved: wonFlag, overlay: !overlayEl.classList.contains('hidden'),
          won: wonFlag, selected: selIsland ? selIsland.id : -1,
          cursor: curIsland ? curIsland.id : -1,
          hintCount: levelHints, hintLevel: hintLevel, hintKey: hintKey,
          elapsedMs: Math.round(levelElapsedMs()),
          starsLevel: meta.stars[packLevel + 1] ? meta.stars[packLevel + 1].stars : 0,
          totalStars: totalStars(), achievements: unlockedAchCount(),
          message: msgEl.textContent
        };
      },
      meta: function () { return JSON.parse(JSON.stringify(meta)); },
      reloadMeta: function () { meta = loadMeta(); return JSON.parse(JSON.stringify(meta)); },
      starsFor: function (i) { return calcStars(levelHints, levelElapsedMs(), i); },
      solve: function () {
        if (!puzzle) return false;
        drawn = {};
        for (var k in puzzle.solution) drawn[k] = puzzle.solution[k];
        render();
        checkComplete();
        return wonFlag;
      },
      hint: giveHint,
      startPack: startPackLevel,
      startPuzzle: startPuzzle,
      startDaily: startDaily,
      openPack: openPack,
      openMeta: openMeta,
      closeMeta: closeMeta,
      restart: startPuzzle,
      pair: function () {
        if (!puzzle) return null;
        for (var i = 0; i < puzzle.islands.length; i++) {
          for (var j = i + 1; j < puzzle.islands.length; j++) {
            var a = puzzle.islands[i], b = puzzle.islands[j];
            if ((a.x === b.x || a.y === b.y) && clearPath(a, b, puzzle.islands)) {
              return [i, j, bridgeKey(a, b)];
            }
          }
        }
        return null;
      },
      islandPoint: function (i) {
        if (!puzzle || !puzzle.islands[i]) return null;
        var isl = puzzle.islands[i];
        var rect = canvas.getBoundingClientRect();
        var pad = 30;
        var cell = (LW - pad * 2) / (puzzle.rows - 1);
        var lx = pad + isl.x * cell, ly = pad + isl.y * cell;
        return { x: rect.left + lx * (rect.width / LW), y: rect.top + ly * (rect.height / LH), id: isl.id };
      },
      tapIsland: function (i) {
        var pt = this.islandPoint(i);
        if (!pt) return false;
        var el = document.elementFromPoint(pt.x, pt.y);
        if (!el || (el !== canvas && !canvas.contains(el))) return false;
        canvas.dispatchEvent(new MouseEvent('click', { clientX: pt.x, clientY: pt.y, bubbles: true }));
        return true;
      }
    };
  }

})();
