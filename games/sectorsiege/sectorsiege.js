/* ============================================================
   拉线占领 GALCON · 派兵占地（即时战略 · 密码战线）
   战役 8 关（固定布局）+ 随机对战 + 每日一题，
   派系主动技能（空袭/增援/急行军）+ 星核科技树（6 节点 3 层）。
   核心逻辑用 ==GAL-CORE-START== / ==GAL-CORE-END== 标记包裹，供 Node harness 提取。
   ============================================================ */

(function () {
  /* ==GAL-CORE-START== */
  var G_DIFF = {
    1: { rows: 10, cols: 10, aiCount: 2, aiRate: 0.7, maxTroops: 40, threshold: 8 },
    2: { rows: 12, cols: 12, aiCount: 3, aiRate: 0.85, maxTroops: 60, threshold: 10 },
    3: { rows: 14, cols: 14, aiCount: 4, aiRate: 1.0, maxTroops: 80, threshold: 12 }
  };
  var G_PROD = { plain: 1, mine: 2, fort: 3 };
  var G_TICK_MS = 900; // 产兵 tick（毫秒）

  /* 战役关卡：固定尺寸/固定种子/固定据点坐标（非纯随机地图） */
  var G_CAMPAIGN = [
    { id: 1, name: 'gs.sectorsiege.c1n', rows: 8, cols: 8, diff: 1, seed: 8811,
      px: 0, py: 0, ex: 6, ey: 6, startP: 12, startE: 10, aiRate: 0.5, threshold: 7,
      mines: [[3, 4]], forts: [], goal: { type: 'conquer' }, limit: 150, star3: 45, star2: 70 },
    { id: 2, name: 'gs.sectorsiege.c2n', rows: 9, cols: 9, diff: 1, seed: 8822,
      px: 0, py: 0, ex: 7, ey: 7, startP: 12, startE: 11, aiRate: 0.6, threshold: 7,
      mines: [[2, 6], [6, 2]], forts: [], goal: { type: 'time', sec: 60 }, limit: 60, star3: 40, star2: 55 },
    { id: 3, name: 'gs.sectorsiege.c3n', rows: 9, cols: 9, diff: 2, seed: 8833,
      px: 0, py: 0, ex: 7, ey: 7, startP: 13, startE: 12, aiRate: 0.62, threshold: 8,
      mines: [[2, 2], [6, 6]], forts: [], goal: { type: 'hold', sec: 20 }, limit: 120, star3: 35, star2: 55 },
    { id: 4, name: 'gs.sectorsiege.c4n', rows: 10, cols: 10, diff: 2, seed: 8844,
      px: 0, py: 0, ex: 8, ey: 8, startP: 13, startE: 12, aiRate: 0.7, threshold: 8,
      mines: [[2, 7], [7, 2]], forts: [[4, 4]], goal: { type: 'conquer' }, limit: 180, star3: 60, star2: 90 },
    { id: 5, name: 'gs.sectorsiege.c5n', rows: 10, cols: 10, diff: 2, seed: 8855,
      px: 0, py: 0, ex: 8, ey: 8, startP: 14, startE: 14, aiRate: 0.75, threshold: 9,
      mines: [[2, 5], [5, 2], [6, 7]], forts: [[3, 3]], goal: { type: 'time', sec: 75 }, limit: 75, star3: 55, star2: 75 },
    { id: 6, name: 'gs.sectorsiege.c6n', rows: 11, cols: 11, diff: 2, seed: 8866,
      px: 0, py: 0, ex: 9, ey: 9, startP: 14, startE: 14, aiRate: 0.8, threshold: 9,
      mines: [[2, 2], [8, 8], [2, 8]], forts: [[3, 7]], goal: { type: 'hold', sec: 25 }, limit: 150, star3: 45, star2: 70 },
    { id: 7, name: 'gs.sectorsiege.c7n', rows: 12, cols: 12, diff: 3, seed: 8877,
      px: 0, py: 0, ex: 10, ey: 10, startP: 15, startE: 15, aiRate: 0.85, threshold: 10,
      mines: [[3, 8], [8, 3], [4, 4]], forts: [[6, 6]], goal: { type: 'conquer' }, limit: 240, star3: 80, star2: 120 },
    { id: 8, name: 'gs.sectorsiege.c8n', rows: 12, cols: 12, diff: 3, seed: 8888,
      px: 0, py: 0, ex: 10, ey: 10, startP: 16, startE: 16, aiRate: 0.95, threshold: 11,
      mines: [[2, 9], [9, 2], [5, 5]], forts: [[3, 3], [8, 8]], goal: { type: 'time', sec: 90 }, limit: 90, star3: 70, star2: 100 }
  ];

  function G_mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function G_pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }

  /** 随机地图：{ grid: [{owner, troops, type}], rows, cols } */
  function G_genMap(diffIdx, seed) {
    var conf = G_DIFF[diffIdx];
    var rnd = G_mulberry32(seed || (Date.now() % 2147483647));
    var R = conf.rows, C = conf.cols;
    var grid = [];
    for (var r = 0; r < R; r++) {
      var row = [];
      for (var c = 0; c < C; c++) {
        var roll = rnd();
        var type = roll < 0.75 ? 'plain' : (roll < 0.92 ? 'mine' : 'fort');
        row.push({ owner: 0, troops: 1 + Math.floor(rnd() * 6), type: type });
      }
      grid.push(row);
    }
    var factions = 1 + conf.aiCount;
    var px = Math.floor(C * 0.15), py = Math.floor(R * 0.2);
    claimBlock(grid, R, C, 1, py, px, 2, 2, 8 + Math.floor(rnd() * 4));
    var used = [[py, px]];
    for (var f = 0; f < conf.aiCount; f++) {
      var tries = 0, placed = false;
      while (!placed && tries++ < 200) {
        var ay = 1 + Math.floor(rnd() * (R - 2)), ax = 1 + Math.floor(rnd() * (C - 2));
        var far = true;
        for (var u = 0; u < used.length; u++) {
          if (Math.abs(ay - used[u][0]) < 3 && Math.abs(ax - used[u][1]) < 3) { far = false; break; }
        }
        if (!far) continue;
        claimBlock(grid, R, C, 2 + f, ay, ax, 2, 2, 8 + Math.floor(rnd() * 4));
        used.push([ay, ax]);
        placed = true;
      }
    }
    return { grid: grid, rows: R, cols: C, diff: diffIdx };
  }

  function claimBlock(grid, R, C, owner, y0, x0, h, w, troops) {
    for (var r = y0; r < y0 + h && r < R; r++) {
      for (var c = x0; c < x0 + w && c < C; c++) {
        grid[r][c].owner = owner;
        grid[r][c].troops = troops;
      }
    }
  }

  /** 中立站固定兵力（由关卡种子与坐标哈希决定，保证地图可复现） */
  function G_neutralTroops(lvl, r, c) {
    var h = (r * 73856093) ^ (c * 19349663) ^ (lvl.seed * 83492791);
    h = (h >>> 0) % 5;
    return 2 + h + Math.min(2, Math.floor(lvl.id / 3));
  }

  /** 战役固定地图：玩家左上 2×2、敌方右下 2×2，矿/要塞坐标由关卡写死 */
  function G_levelMap(lvl) {
    var R = lvl.rows, C = lvl.cols;
    var grid = [];
    for (var r = 0; r < R; r++) {
      var row = [];
      for (var c = 0; c < C; c++) {
        row.push({ owner: 0, troops: G_neutralTroops(lvl, r, c), type: 'plain' });
      }
      grid.push(row);
    }
    for (var mi = 0; mi < lvl.mines.length; mi++) {
      var mp = lvl.mines[mi];
      grid[mp[0]][mp[1]].type = 'mine';
    }
    for (var fi = 0; fi < lvl.forts.length; fi++) {
      var fp = lvl.forts[fi];
      grid[fp[0]][fp[1]].type = 'fort';
    }
    claimBlock(grid, R, C, 1, lvl.py, lvl.px, 2, 2, lvl.startP);
    claimBlock(grid, R, C, 2, lvl.ey, lvl.ex, 2, 2, lvl.startE);
    return {
      grid: grid, rows: R, cols: C, diff: lvl.diff,
      aiRate: lvl.aiRate, threshold: lvl.threshold,
      maxTroops: 42 + lvl.id * 3, level: lvl.id
    };
  }

  function G_cell(m, r, c) { return m.grid[r][c]; }

  /** 产兵 tick：已占领格按类型产兵；mods.prod 让产兵速度真实提升 */
  function G_produce(m, mods) {
    var conf = G_DIFF[m.diff];
    var max = m.maxTroops || conf.maxTroops;
    var mul = (mods && mods.prod) || 1;
    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++) {
        var cell = m.grid[r][c];
        if (cell.owner === 0) continue;
        var add = G_PROD[cell.type] * mul;
        var acc = (cell.pf || 0) + add;
        var gain = Math.floor(acc);
        cell.pf = acc - gain;
        if (gain > 0) cell.troops = Math.min(max, cell.troops + gain);
      }
    }
  }

  function G_send(m, fromR, fromC, toR, toC, count, moving) {
    var src = G_cell(m, fromR, fromC);
    if (src.owner === 0) return null;
    if (fromR === toR && fromC === toC) return null;
    if (count <= 0) return null;
    if (src.troops < count) count = src.troops;
    if (count <= 0) return null;
    src.troops -= count;
    var grp = { fr: fromR, fc: fromC, tr: toR, tc: toC, owner: src.owner, count: count, progress: 0 };
    moving.push(grp);
    return grp;
  }

  /** 移动群推进（speedMul 受科技/急行军影响）+ 到达结算 */
  function G_stepMoving(m, moving, speedMul) {
    var step = 0.06 * (speedMul || 1);
    for (var i = moving.length - 1; i >= 0; i--) {
      var g = moving[i];
      g.progress += step;
      if (g.progress >= 1) {
        moving.splice(i, 1);
        G_arrive(m, g, speedMul);
      }
    }
  }
  function G_arrive(m, g) {
    var t = G_cell(m, g.tr, g.tc);
    var max = m.maxTroops || G_DIFF[m.diff].maxTroops;
    if (t.owner === g.owner) {
      t.troops = Math.min(max, t.troops + g.count);
    } else if (g.count > t.troops) {
      var keep = (g.owner === 1 && m._keep) ? m._keep : 0;
      t.owner = g.owner;
      t.troops = Math.min(max, g.count - t.troops + keep);
    } else {
      t.troops -= g.count;
    }
  }

  /** AI：每派系选最强两格集火同一目标，优先中立/弱敌 */
  function G_aiThink(m, moving, rnd) {
    var conf = G_DIFF[m.diff];
    var aiRate = typeof m.aiRate === 'number' ? m.aiRate : conf.aiRate;
    var threshold = typeof m.threshold === 'number' ? m.threshold : conf.threshold;
    var dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    var factions = {};
    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++) {
        var o = m.grid[r][c].owner;
        if (o > 1) (factions[o] = factions[o] || []).push({ r: r, c: c, cell: m.grid[r][c] });
      }
    }
    for (var f in factions) {
      if (rnd() > aiRate) continue;
      var cells = factions[f];
      cells.sort(function (a, b) { return b.cell.troops - a.cell.troops; });
      var best = cells[0];
      var best2 = cells.length > 1 ? cells[1] : null;
      var sendA = Math.floor(best.cell.troops * 0.65);
      var sendB = best2 ? Math.floor(best2.cell.troops * 0.65) : 0;
      if (sendA + sendB < threshold) continue;
      var winTargets = [];
      var probe = [best, best2].filter(Boolean);
      for (var pi = 0; pi < probe.length; pi++) {
        for (var d = 0; d < 4; d++) {
          var nr = probe[pi].r + dirs[d][0], nc = probe[pi].c + dirs[d][1];
          if (nr < 0 || nc < 0 || nr >= m.rows || nc >= m.cols) continue;
          var t = m.grid[nr][nc];
          if (t.owner === best.cell.owner) continue;
          if (sendA + sendB <= t.troops) continue;
          winTargets.push({ r: nr, c: nc, t: t });
        }
      }
      if (!winTargets.length) continue;
      winTargets.sort(function (a, b) {
        var sa = a.t.owner === 0 ? 0 : 1;
        var sb = b.t.owner === 0 ? 0 : 1;
        return sa - sb;
      });
      var pick = winTargets[0];
      G_send(m, best.r, best.c, pick.r, pick.c, sendA, moving);
      if (best2) G_send(m, best2.r, best2.c, pick.r, pick.c, sendB, moving);
    }
  }

  function G_winner(m) {
    var owners = {};
    var any = false;
    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++) {
        var o = m.grid[r][c].owner;
        if (o !== 0) { owners[o] = (owners[o] || 0) + 1; any = true; }
      }
    }
    if (!any) return 0;
    var keys = Object.keys(owners);
    if (keys.length === 1) return parseInt(keys[0], 10);
    return 0;
  }

  function G_initialMoving(m, moving, seed) {
    var rnd = G_mulberry32((seed || 1) + 77);
    var dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++) {
        var cell = m.grid[r][c];
        if (cell.owner === 0 || cell.troops < 6) continue;
        if (rnd() < 0.5) continue;
        for (var d = 0; d < 4; d++) {
          var nr = r + dirs[d][0], nc = c + dirs[d][1];
          if (nr < 0 || nc < 0 || nr >= m.rows || nc >= m.cols) continue;
          if (m.grid[nr][nc].owner !== 0) continue;
          G_send(m, r, c, nr, nc, Math.floor(cell.troops * 0.5), moving);
          break;
        }
      }
    }
  }
  /* ==GAL-CORE-END== */

  /* ================= 常量 / 存档 ================= */
  var STARS_KEY = 'arcade_sectorsiege_stars_v1';
  var TECH_KEY = 'arcade_sectorsiege_tech_v1';
  var COLORS = { 0: '#3a4152', 1: '#00f0ff', 2: '#ff2d95', 3: '#ffe600', 4: '#39ff14', 5: '#b967ff' };
  var SKILLS = [
    { id: 'airstrike', key: '1', cd: 16000, target: true, name: 'gs.sectorsiege.skillAirstrike', desc: 'gs.sectorsiege.skillAirstrikeD' },
    { id: 'reinforce', key: '2', cd: 22000, target: false, name: 'gs.sectorsiege.skillReinforce', desc: 'gs.sectorsiege.skillReinforceD' },
    { id: 'march', key: '3', cd: 20000, target: false, name: 'gs.sectorsiege.skillMarch', desc: 'gs.sectorsiege.skillMarchD' }
  ];
  var TECH_NODES = [
    { id: 'prod', layer: 1, cost: 2, name: 'gs.sectorsiege.techProdN', desc: 'gs.sectorsiege.techProdD' },
    { id: 'init', layer: 1, cost: 2, name: 'gs.sectorsiege.techInitN', desc: 'gs.sectorsiege.techInitD' },
    { id: 'speed', layer: 2, cost: 3, name: 'gs.sectorsiege.techSpeedN', desc: 'gs.sectorsiege.techSpeedD' },
    { id: 'cd', layer: 2, cost: 3, name: 'gs.sectorsiege.techCdN', desc: 'gs.sectorsiege.techCdD' },
    { id: 'keep', layer: 3, cost: 4, name: 'gs.sectorsiege.techKeepN', desc: 'gs.sectorsiege.techKeepD' },
    { id: 'time', layer: 3, cost: 4, name: 'gs.sectorsiege.techTimeN', desc: 'gs.sectorsiege.techTimeD' }
  ];
  var DIFF_INFO = [
    { t: T('gs.sectorsiege.diffEasy'), d: T('gs.sectorsiege.diffEasyD') },
    { t: T('gs.sectorsiege.diffNormal'), d: T('gs.sectorsiege.diffNormalD') },
    { t: T('gs.sectorsiege.diffHard'), d: T('gs.sectorsiege.diffHardD') }
  ];

  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  var savedStars = readJSON(STARS_KEY, {});
  if (!savedStars || typeof savedStars !== 'object') savedStars = {};
  var unlockedTech = readJSON(TECH_KEY, []);
  if (!Array.isArray(unlockedTech)) unlockedTech = [];
  var mods = { prod: 1, init: 0, speed: 1, cd: 1, keep: 0, time: 0 };

  function hasTech(id) { return unlockedTech.indexOf(id) >= 0; }
  function layerHas(layer) {
    for (var i = 0; i < TECH_NODES.length; i++) {
      if (TECH_NODES[i].layer === layer && hasTech(TECH_NODES[i].id)) return true;
    }
    return false;
  }
  function layerOpen(layer) {
    if (layer <= 1) return true;
    return layerHas(layer - 1);
  }
  function totalStars() {
    var s = 0;
    for (var k in savedStars) {
      if (Object.prototype.hasOwnProperty.call(savedStars, k)) {
        var n = Number(savedStars[k]);
        if (n > 0) s += Math.min(3, n);
      }
    }
    return s;
  }
  function spentStars() {
    var s = 0;
    for (var i = 0; i < TECH_NODES.length; i++) {
      if (hasTech(TECH_NODES[i].id)) s += TECH_NODES[i].cost;
    }
    return s;
  }
  function availableStars() { return Math.max(0, totalStars() - spentStars()); }
  function recalcMods() {
    mods = {
      prod: hasTech('prod') ? 1.1 : 1,
      init: hasTech('init') ? 2 : 0,
      speed: hasTech('speed') ? 1.15 : 1,
      cd: hasTech('cd') ? 0.85 : 1,
      keep: hasTech('keep') ? 1 : 0,
      time: hasTech('time') ? 5 : 0
    };
  }
  function levelStars(idx) { return Math.min(3, Number(savedStars[String(idx + 1)] || 0)); }
  function levelUnlocked(idx) {
    if (idx <= 0) return true;
    return levelStars(idx - 1) > 0;
  }
  function saveLevelStars(idx, stars) {
    var key = String(idx + 1);
    var prev = Number(savedStars[key] || 0);
    if (stars > prev) {
      savedStars[key] = stars;
      try { localStorage.setItem(STARS_KEY, JSON.stringify(savedStars)); } catch (e) {}
    }
  }
  recalcMods();

  /* ================= 样式（自绘 UI，index.html 只 bump 版本） ================= */
  (function injectStyle() {
    if (document.getElementById('gl-flagship-style')) return;
    var css = [
      '.gl-wrap{box-sizing:border-box;margin:0 auto;}',
      '.gl-progress{display:block;margin:6px auto 10px;font-size:11px;color:var(--neon-yellow);border:1px dashed rgba(255,230,0,.38);border-radius:999px;padding:5px 12px;max-width:460px;}',
      '.gl-modehead{font-family:var(--font-pixel);font-size:11px;color:var(--neon-purple);letter-spacing:1px;margin:12px 0 6px;}',
      '.gl-levels{display:flex;flex-direction:column;gap:8px;max-width:480px;margin:0 auto 10px;}',
      '.gl-lvl{display:flex;align-items:center;gap:10px;width:100%;min-height:64px;padding:8px 11px;border:2px solid rgba(0,240,255,.35);border-radius:10px;background:linear-gradient(135deg,rgba(0,240,255,.09),rgba(255,45,149,.045));color:var(--text-main);cursor:pointer;text-align:left;font-family:inherit;transition:border-color .15s,box-shadow .15s,transform .12s;}',
      '.gl-lvl:hover{border-color:var(--neon-cyan);box-shadow:0 0 16px rgba(0,240,255,.35);}',
      '.gl-lvl:active{transform:scale(.985);}',
      '.gl-lvl.locked{opacity:.45;border-color:rgba(255,255,255,.16);background:rgba(255,255,255,.04);cursor:not-allowed;}',
      '.gl-lvl-num{font-family:var(--font-pixel);font-size:16px;color:var(--neon-cyan);min-width:30px;text-align:center;}',
      '.gl-lvl-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}',
      '.gl-lvl-t{font-family:var(--font-pixel);font-size:11px;color:var(--neon-yellow);text-shadow:0 0 6px rgba(255,230,0,.4);}',
      '.gl-lvl-d{font-size:11px;color:var(--text-dim);line-height:1.5;}',
      '.gl-lvl-stars{font-size:15px;letter-spacing:1px;color:var(--neon-yellow);white-space:nowrap;text-shadow:0 0 8px rgba(255,230,0,.45);}',
      '.gl-lvl.locked .gl-lvl-stars{color:var(--text-dim);text-shadow:none;}',
      '.gl-pick-row{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:8px 0 4px;}',
      '.gl-goal{display:flex;align-items:center;gap:8px;text-align:left;font-size:11px;color:var(--text-dim);margin:6px 2px 0;padding:7px 9px;border:1px solid rgba(255,230,0,.22);border-radius:8px;background:rgba(255,230,0,.035);}',
      '.gl-goal-text{flex:1;min-width:0;color:var(--neon-yellow);line-height:1.5;}',
      '.gl-goalbar{flex:0 0 88px;height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;}',
      '.gl-goalbar b{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--neon-cyan),var(--neon-green));transition:width .24s;}',
      '.gl-skills{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 4px;}',
      '.gl-skill{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:58px;padding:5px 4px;border:2px solid rgba(0,240,255,.48);border-radius:10px;background:linear-gradient(160deg,rgba(0,240,255,.12),rgba(185,103,255,.07));color:var(--neon-cyan);font-family:var(--font-pixel);cursor:pointer;overflow:hidden;transition:border-color .15s,box-shadow .15s;}',
      '.gl-skill:active{transform:scale(.97);}',
      '.gl-skill.aiming{border-color:var(--neon-yellow);box-shadow:0 0 18px rgba(255,230,0,.65);color:var(--neon-yellow);}',
      '.gl-skill.cooling{border-color:rgba(255,255,255,.18);color:#5c647c;}',
      '.gl-skill-ico{position:relative;display:block;width:20px;height:20px;color:inherit;}',
      '.gl-skill-name{font-size:10px;letter-spacing:.5px;line-height:1.2;}',
      '.gl-skill-key{position:absolute;top:3px;right:5px;font-size:9px;color:var(--text-dim);}',
      '.gl-skill-cd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(4,6,14,.8);color:var(--neon-yellow);font-size:15px;letter-spacing:1px;}',
      '.gl-skill.cooling .gl-skill-cd{display:flex;}',
      '.ico-airstrike{background:linear-gradient(currentColor,currentColor) center/2px 100% no-repeat,linear-gradient(currentColor,currentColor) center/100% 2px no-repeat,radial-gradient(circle,transparent 55%,currentColor 56% 68%,transparent 69%);}',
      '.ico-reinforce{background:linear-gradient(currentColor,currentColor) center/4px 100% no-repeat,linear-gradient(currentColor,currentColor) center/100% 4px no-repeat;}',
      '.ico-march::before,.ico-march::after{content:"";position:absolute;width:8px;height:8px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg);}',
      '.ico-march::before{left:2px;top:5px;}',
      '.ico-march::after{left:9px;top:5px;}',
      '.gl-emblem{position:relative;width:74px;height:74px;margin:0 auto 8px;border-radius:50%;border:2px solid rgba(0,240,255,.4);background:radial-gradient(circle,rgba(0,240,255,.14),rgba(3,4,10,.2));box-shadow:0 0 24px rgba(0,240,255,.28),inset 0 0 18px rgba(0,0,0,.5);}',
      '.gl-emblem::before{content:"";position:absolute;inset:13px;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);background:linear-gradient(160deg,var(--neon-cyan),var(--neon-green));animation:glEmblemIn .55s cubic-bezier(.2,.9,.3,1.4);}',
      '.gl-emblem.lose{border-color:rgba(255,45,149,.55);box-shadow:0 0 24px rgba(255,45,149,.3),inset 0 0 18px rgba(0,0,0,.5);}',
      '.gl-emblem.lose::before{clip-path:none;inset:16px;background:linear-gradient(45deg,transparent 44%,var(--neon-pink) 45% 55%,transparent 56%),linear-gradient(-45deg,transparent 44%,var(--neon-pink) 45% 55%,transparent 56%);}',
      '@keyframes glEmblemIn{0%{transform:scale(.2) rotate(-30deg);opacity:0;}70%{transform:scale(1.12) rotate(6deg);opacity:1;}100%{transform:scale(1) rotate(0);}}',
      '.gl-stars{display:flex;justify-content:center;gap:8px;margin:8px 0 2px;font-size:24px;line-height:1;color:#4a5370;letter-spacing:1px;}',
      '.gl-stars .on{color:var(--neon-yellow);text-shadow:0 0 14px rgba(255,230,0,.85);animation:glStarPop .4s cubic-bezier(.2,.9,.3,1.4) both;}',
      '@keyframes glStarPop{0%{transform:scale(.3);opacity:0;}70%{transform:scale(1.25);opacity:1;}100%{transform:scale(1);}}',
      '.gl-ov-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 2px;}',
      '.gl-stat{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 4px;font-size:10px;color:var(--text-dim);}',
      '.gl-stat b{display:block;font-family:var(--font-pixel);font-size:12px;color:var(--neon-yellow);margin-top:3px;}',
      '.gl-tech{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:14px;background:radial-gradient(circle at 50% 35%,rgba(10,16,32,.93),rgba(3,4,10,.98));animation:glFade .2s ease-out;}',
      '.gl-tech-card{width:min(460px,96vw);max-height:88vh;display:flex;flex-direction:column;background:linear-gradient(160deg,rgba(18,26,48,.99),rgba(8,11,22,.99));border:1px solid rgba(0,240,255,.38);border-radius:14px;padding:13px;box-shadow:0 0 34px rgba(0,240,255,.22);}',
      '.gl-tech-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '.gl-tech-head h2{font-family:var(--font-pixel);font-size:12px;color:var(--neon-cyan);letter-spacing:1px;text-align:left;}',
      '.gl-tech-close{width:44px;height:44px;flex:none;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:transparent;color:var(--text-main);font-size:22px;line-height:1;cursor:pointer;}',
      '.gl-tech-meta{font-size:11px;color:var(--neon-yellow);margin:6px 0 9px;text-align:left;line-height:1.5;}',
      '.gl-tech-list{overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:9px;padding-right:2px;}',
      '.gl-layer{display:flex;flex-direction:column;gap:6px;}',
      '.gl-layer-t{font-size:10px;color:var(--text-dim);letter-spacing:1px;text-align:left;margin:2px 0;}',
      '.gl-node{display:flex;flex-direction:column;gap:3px;width:100%;min-height:56px;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.035);color:var(--text-main);text-align:left;font-family:inherit;cursor:pointer;transition:border-color .15s,box-shadow .15s;}',
      '.gl-node.unlocked{border-color:rgba(57,255,20,.6);background:linear-gradient(135deg,rgba(57,255,20,.11),rgba(0,240,255,.05));cursor:default;}',
      '.gl-node.available{border-color:rgba(255,230,0,.7);box-shadow:0 0 14px rgba(255,230,0,.22);}',
      '.gl-node.locked{opacity:.52;}',
      '.gl-node-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--font-pixel);font-size:10px;color:var(--neon-cyan);}',
      '.gl-node.unlocked .gl-node-head{color:var(--neon-green);}',
      '.gl-node.available .gl-node-head{color:var(--neon-yellow);}',
      '.gl-node-cost{font-size:10px;color:var(--neon-yellow);white-space:nowrap;}',
      '.gl-node-d{font-size:11px;color:var(--text-dim);line-height:1.5;}',
      '.gl-node-state{font-size:10px;color:var(--neon-green);margin-top:1px;}',
      '.gl-node.available .gl-node-state{color:var(--neon-yellow);}',
      '.gl-node.locked .gl-node-state{color:var(--text-dim);}',
      '@media (max-width:420px){',
      '  .gl-wrap{padding:10px 8px 18px;}',
      '  .gl-lvl{min-height:60px;padding:7px 9px;gap:8px;}',
      '  .gl-lvl-num{min-width:24px;font-size:14px;}',
      '  .gl-lvl-t{font-size:10px;} .gl-lvl-d{font-size:10px;}',
      '  .gl-lvl-stars{font-size:12px;}',
      '  .gl-goal{font-size:10px;} .gl-goalbar{flex-basis:60px;}',
      '  .gl-skill{min-height:56px;} .gl-skill-name{font-size:9px;}',
      '  .gl-skill-key{top:2px;right:4px;}',
      '  .gl-tech-card{padding:10px;} .gl-tech-head h2{font-size:10px;}',
      '  .gl-ov-stats{grid-template-columns:1fr 1fr 1fr;}',
      '}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'gl-flagship-style';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  /* ================= UI 结构 ================= */
  var root = document.getElementById('game-root');
  if (!root) return;

  function skillButtonsHtml() {
    return SKILLS.map(function (sk) {
      return '<button class="gl-skill" type="button" data-skill="' + sk.id + '" aria-label="' +
        T(sk.name) + ' · ' + T(sk.desc) + '">' +
        '<span class="gl-skill-ico ico-' + sk.id + '"></span>' +
        '<span class="gl-skill-name">' + T(sk.name) + '</span>' +
        '<span class="gl-skill-key">' + sk.key + '</span>' +
        '<span class="gl-skill-cd" data-cd="' + sk.id + '"></span>' +
        '</button>';
    }).join('');
  }

  root.innerHTML =
    '<div class="gl-wrap">' +
    '  <div class="gl-pick hidden" id="gl-pick">' +
    '    <div class="gl-pick-t">' + T('gs.sectorsiege.pickT') + '</div>' +
    '    <div class="gl-pick-d">' + T('gs.sectorsiege.pickD') + '</div>' +
    '    <div class="gl-progress" id="gl-progress"></div>' +
    '    <div class="gl-levels" id="gl-levels"></div>' +
    '    <div class="gl-modehead">' + T('gs.sectorsiege.randomT') + '</div>' +
    '    <div class="gl-pick-btns">' +
    DIFF_INFO.map(function (d, i) {
      return '<button class="btn mode-btn" data-i="' + i + '">' + d.t + '<small>' + d.d + '</small></button>';
    }).join('') +
    '    </div>' +
    '    <div class="gl-pick-row">' +
    '      <button class="btn mode-btn" id="gl-pick-daily">' + T('gs.sectorsiege.pickDaily') + '</button>' +
    '      <button class="btn purple" id="gl-tech-btn">' + T('gs.sectorsiege.techBtn') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <div id="gl-game" style="display:none">' +
    '    <div class="gl-info"><span id="gl-lev"></span><span id="gl-hud"></span></div>' +
    '    <div class="gl-goal"><span class="gl-goal-text" id="gl-goal-text"></span><i class="gl-goalbar"><b id="gl-goal-fill"></b></i></div>' +
    '    <canvas id="gl-cv"></canvas>' +
    '    <div class="gl-skills">' + skillButtonsHtml() + '</div>' +
    '    <div class="gl-controls">' +
    '      <button class="btn" id="gl-pause">' + T('gs.sectorsiege.pauseBtn') + '</button>' +
    '      <button class="btn" id="gl-ratio">' + T('gs.sectorsiege.sendHalf') + '</button>' +
    '      <button class="btn" id="gl-new">' + T('gs.sectorsiege.newBtn') + '</button>' +
    '      <button class="btn purple" id="gl-tech-game">' + T('gs.sectorsiege.techBtn') + '</button>' +
    '    </div>' +
    '    <div class="gl-msg" id="gl-msg"></div>' +
    '  </div>' +
    '  <div class="gl-overlay hidden" id="gl-overlay">' +
    '    <div class="gl-ov-card">' +
    '      <div class="gl-emblem" id="gl-ov-icon"></div>' +
    '      <h2 id="gl-ov-title"></h2>' +
    '      <p id="gl-ov-text"></p>' +
    '      <div class="gl-stars" id="gl-ov-stars"></div>' +
    '      <div class="gl-ov-stats" id="gl-ov-stats"></div>' +
    '      <div class="gl-ov-btns">' +
    '        <button class="btn green" id="gl-ov-btn"></button>' +
    '        <button class="btn purple" id="gl-ov-alt"></button>' +
    '        <button class="btn" id="gl-ov-third"></button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="gl-tech hidden" id="gl-tech">' +
    '    <div class="gl-tech-card">' +
    '      <div class="gl-tech-head"><h2>' + T('gs.sectorsiege.techT') + '</h2>' +
    '        <button class="gl-tech-close" id="gl-tech-close" type="button" aria-label="' + T('gs.sectorsiege.techClose') + '">×</button>' +
    '      </div>' +
    '      <div class="gl-tech-meta" id="gl-tech-meta"></div>' +
    '      <div class="gl-tech-list" id="gl-tech-list"></div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var pickEl = document.getElementById('gl-pick');
  var gameEl = document.getElementById('gl-game');
  var levEl = document.getElementById('gl-lev');
  var hudEl = document.getElementById('gl-hud');
  var msgEl = document.getElementById('gl-msg');
  var overlayEl = document.getElementById('gl-overlay');
  var ovTitle = document.getElementById('gl-ov-title');
  var ovText = document.getElementById('gl-ov-text');
  var ovBtn = document.getElementById('gl-ov-btn');
  var ovAlt = document.getElementById('gl-ov-alt');
  var ovThird = document.getElementById('gl-ov-third');
  var ovIcon = document.getElementById('gl-ov-icon');
  var ovStars = document.getElementById('gl-ov-stars');
  var ovStats = document.getElementById('gl-ov-stats');
  var canvas = document.getElementById('gl-cv');
  var ctx = canvas.getContext('2d');
  var ratioBtn = document.getElementById('gl-ratio');
  var pauseBtn = document.getElementById('gl-pause');
  var goalTextEl = document.getElementById('gl-goal-text');
  var goalFillEl = document.getElementById('gl-goal-fill');
  var levelListEl = document.getElementById('gl-levels');
  var progressEl = document.getElementById('gl-progress');
  var techEl = document.getElementById('gl-tech');
  var techListEl = document.getElementById('gl-tech-list');
  var techMetaEl = document.getElementById('gl-tech-meta');
  var skillBtns = {}, skillCdEls = {};
  var skNodeList = root.querySelectorAll('[data-skill]');
  for (var si = 0; si < skNodeList.length; si++) {
    skillBtns[skNodeList[si].getAttribute('data-skill')] = skNodeList[si];
    skillCdEls[skNodeList[si].getAttribute('data-skill')] = skNodeList[si].querySelector('.gl-skill-cd');
  }
  Object.keys(skillBtns).forEach(function (id) {
    skillBtns[id].addEventListener('click', function () { useSkill(id); });
  });

  var state = null, m = null, moving = [];
  var loopApi = null;
  var cellPx = 40, LW = 400, LH = 400, DPR = 1;
  var drag = null, hoverCell = null;
  var ratio = 0.5;
  var produceAcc = 0, aiAcc = 0, saveAcc = 0;
  var paused = false, techOpen = false, techPausedGame = false;
  var skillReadyAt = { airstrike: 0, reinforce: 0, march: 0 };
  var aimSkill = null;
  var marchUntil = 0;
  var particles = [], floats = [], flashes = {}, rings = [], shake = 0;
  var kbdR = -1, kbdC = -1, kbdSel = null;

  /* ================= 工具 ================= */
  function todaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function starString(n) {
    var s = '';
    for (var i = 0; i < 3; i++) s += i < n ? '★' : '☆';
    return s;
  }
  function goalTextFor(lvl) {
    var g = lvl.goal;
    if (g.type === 'time') return T('gs.sectorsiege.goalTime').replace('{s}', g.sec + mods.time);
    if (g.type === 'hold') return T('gs.sectorsiege.goalHold').replace('{s}', g.sec);
    return T('gs.sectorsiege.goalConquer');
  }
  function computeStars(lvl, sec) {
    if (sec <= lvl.star3) return 3;
    if (sec <= lvl.star2) return 2;
    return 1;
  }
  function countOwner(o) {
    var n = 0;
    if (!m) return 0;
    for (var r = 0; r < m.rows; r++) for (var c = 0; c < m.cols; c++) if (m.grid[r][c].owner === o) n++;
    return n;
  }
  function enemyCells() {
    if (!m) return 0;
    return m.rows * m.cols - countOwner(0) - countOwner(1);
  }
  function prepareCells(mm) {
    for (var r = 0; r < mm.rows; r++) {
      for (var c = 0; c < mm.cols; c++) {
        var cell = mm.grid[r][c];
        cell.dv = cell.troops;
        cell.pf = 0;
      }
    }
  }
  function applyInitTroops(mm) {
    if (!mods.init) return;
    var max = mm.maxTroops || (G_DIFF[mm.diff] && G_DIFF[mm.diff].maxTroops) || 99;
    for (var r = 0; r < mm.rows; r++) {
      for (var c = 0; c < mm.cols; c++) {
        var cell = mm.grid[r][c];
        if (cell.owner === 1) cell.troops = Math.min(max, cell.troops + mods.init);
      }
    }
  }
  function resetEffects() {
    particles = []; floats = []; flashes = {}; rings = []; shake = 0;
    drag = null; hoverCell = null; kbdSel = null;
  }
  function burstAt(x, y, color, count, speed) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2, sp = (speed || 2) * (0.5 + Math.random());
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color: color, size: 1.4 + Math.random() * 2.4 });
    }
  }
  function addRing(x, y, color, radius) {
    rings.push({ x: x, y: y, r: radius || 3, life: 1, color: color });
  }
  function addFloat(x, y, text, color) {
    floats.push({ x: x, y: y, y0: y, text: text, life: 1, color: color });
  }
  function setMsg(text, color) {
    msgEl.textContent = text;
    msgEl.style.color = color || '';
  }

  /* ================= 关卡选择 / 科技树渲染 ================= */
  function renderLevels() {
    var html = '';
    for (var i = 0; i < G_CAMPAIGN.length; i++) {
      var lvl = G_CAMPAIGN[i];
      var unlocked = levelUnlocked(i);
      var stars = levelStars(i);
      html += '<button class="gl-lvl' + (unlocked ? '' : ' locked') + '" data-lvl="' + i + '"' + (unlocked ? '' : ' disabled') + '>' +
        '<span class="gl-lvl-num">' + (i + 1) + '</span>' +
        '<span class="gl-lvl-body"><span class="gl-lvl-t">' + T(lvl.name) + '</span>' +
        '<span class="gl-lvl-d">' + goalTextFor(lvl) + '</span></span>' +
        '<span class="gl-lvl-stars">' + (unlocked ? starString(stars) : starString(0)) + '</span>' +
        '</button>';
    }
    levelListEl.innerHTML = html;
  }
  function renderProgress() {
    var cleared = 0;
    for (var i = 0; i < G_CAMPAIGN.length; i++) if (levelStars(i) > 0) cleared++;
    progressEl.textContent = T('gs.sectorsiege.progressFmt')
      .replace('{a}', cleared).replace('{b}', G_CAMPAIGN.length)
      .replace('{s}', totalStars()).replace('{t}', G_CAMPAIGN.length * 3);
  }
  function renderTech() {
    var html = '';
    for (var layer = 1; layer <= 3; layer++) {
      html += '<div class="gl-layer"><div class="gl-layer-t">' + T('gs.sectorsiege.techLayer').replace('{n}', layer) + '</div>';
      for (var i = 0; i < TECH_NODES.length; i++) {
        var node = TECH_NODES[i];
        if (node.layer !== layer) continue;
        var unlocked = hasTech(node.id);
        var open = layerOpen(node.layer);
        var afford = availableStars() >= node.cost;
        var cls = unlocked ? 'unlocked' : (open && afford ? 'available' : 'locked');
        var stateTxt = unlocked ? T('gs.sectorsiege.techUnlocked')
          : (!open ? T('gs.sectorsiege.techNeedPrev') : (afford ? T('gs.sectorsiege.techAvailable') : T('gs.sectorsiege.techNeedStars')));
        html += '<button class="gl-node ' + cls + '" data-node="' + node.id + '" type="button"' + (unlocked ? ' disabled' : '') + '>' +
          '<span class="gl-node-head"><span>' + T(node.name) + '</span>' +
          '<span class="gl-node-cost">' + T('gs.sectorsiege.techCost').replace('{n}', node.cost) + '</span></span>' +
          '<span class="gl-node-d">' + T(node.desc) + '</span>' +
          '<span class="gl-node-state">' + stateTxt + '</span>' +
          '</button>';
      }
      html += '</div>';
    }
    techListEl.innerHTML = html;
    techMetaEl.textContent = T('gs.sectorsiege.techMeta')
      .replace('{a}', availableStars()).replace('{e}', totalStars());
  }
  function unlockTech(id) {
    var node = null;
    for (var i = 0; i < TECH_NODES.length; i++) if (TECH_NODES[i].id === id) node = TECH_NODES[i];
    if (!node || hasTech(id)) return;
    if (!layerOpen(node.layer)) return;
    if (availableStars() < node.cost) return;
    unlockedTech.push(id);
    try { localStorage.setItem(TECH_KEY, JSON.stringify(unlockedTech)); } catch (e) {}
    recalcMods();
    renderTech();
    renderLevels();
    renderProgress();
    if (Arcade.audio) Arcade.audio.play('coin');
  }
  function openTech() {
    if (techOpen) return;
    techOpen = true;
    renderTech();
    techEl.classList.remove('hidden');
    if (state && !state.over && !paused) { techPausedGame = true; setPaused(true); }
    else techPausedGame = false;
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function closeTech() {
    if (!techOpen) return;
    techOpen = false;
    techEl.classList.add('hidden');
    if (techPausedGame) { techPausedGame = false; setPaused(false); }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ================= 开局 ================= */
  function resizeCanvas() {
    if (!m) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var avail = Math.min(window.innerWidth * 0.94, 640);
    cellPx = Math.max(22, Math.min(46, Math.floor(avail / Math.max(m.rows, m.cols))));
    LW = m.cols * cellPx;
    LH = m.rows * cellPx;
    canvas.width = LW * DPR;
    canvas.height = LH * DPR;
    canvas.style.aspectRatio = LW + ' / ' + LH;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function resetMatchControls() {
    paused = false;
    aimSkill = null;
    marchUntil = 0;
    skillReadyAt = { airstrike: 0, reinforce: 0, march: 0 };
    produceAcc = 0; aiAcc = 0; saveAcc = 0;
    kbdSel = null;
    kbdR = -1; kbdC = -1;
    for (var kr = 0; kr < m.rows && kbdR < 0; kr++) {
      for (var kc = 0; kc < m.cols; kc++) {
        if (m.grid[kr][kc].owner === 1) { kbdR = kr; kbdC = kc; break; }
      }
    }
    ratio = 0.5;
    ratioBtn.textContent = T('gs.sectorsiege.sendHalf');
    setMsg('');
    pauseBtn.textContent = T('gs.sectorsiege.pauseBtn');
  }

  function setupMatch(tagText, goalLabel) {
    resetMatchControls();
    pickEl.classList.add('hidden');
    gameEl.style.display = '';
    overlayEl.classList.add('hidden');
    levEl.textContent = tagText;
    goalTextEl.textContent = goalLabel || '';
    resizeCanvas();
    if (loopApi) { loopApi.stop(); loopApi = null; }
    loopApi = Arcade.loop.start(update, draw, 16);
    updateHud();
    updateSkillUi();
    if (Arcade.audio) Arcade.audio.play('ui');
    if (Arcade.savegame) { Arcade.savegame.clear(); saveNow(); }
  }

  function startLevel(idx) {
    var lvl = G_CAMPAIGN[idx];
    if (!lvl || !levelUnlocked(idx)) return;
    var bonus = mods.time;
    m = G_levelMap(lvl);
    m._keep = mods.keep;
    prepareCells(m);
    applyInitTroops(m);
    moving = [];
    resetEffects();
    state = {
      mode: 'campaign', diff: lvl.diff, daily: false, levelIdx: idx, seed: lvl.seed,
      start: Date.now(), elapsed: 0, over: false,
      goal: {
        type: lvl.goal.type,
        sec: lvl.goal.type === 'time' ? lvl.goal.sec + bonus : (lvl.goal.sec || 0),
        holdMs: (lvl.goal.sec || 0) * 1000,
        obj: lvl.goal.type === 'hold' ? [Math.floor(lvl.rows / 2), Math.floor(lvl.cols / 2)] : null
      },
      timeLimitMs: (lvl.goal.type === 'time' ? lvl.goal.sec + bonus : lvl.limit + bonus) * 1000,
      holdMs: 0, stars: 0, submitted: false, reason: null,
      startEnemy: 4
    };
    var tag = T('gs.sectorsiege.levelTag').replace('{n}', idx + 1).replace('{name}', T(lvl.name));
    setupMatch(tag, goalTextFor(lvl));
  }

  function startGame(diffIdx, daily) {
    var seed = daily ? todaySeed() : (Date.now() % 2147483647);
    m = G_genMap(diffIdx, seed);
    m._keep = mods.keep;
    prepareCells(m);
    applyInitTroops(m);
    moving = [];
    G_initialMoving(m, moving, seed);
    resetEffects();
    state = {
      mode: daily ? 'daily' : 'random', diff: diffIdx, daily: !!daily, levelIdx: -1, seed: seed,
      start: Date.now(), elapsed: 0, over: false,
      goal: { type: 'unify', sec: 0, holdMs: 0, obj: null },
      timeLimitMs: 0, holdMs: 0, stars: 0, submitted: false, reason: null,
      startEnemy: enemyCells()
    };
    var tag = (daily ? T('gs.sectorsiege.dailyLev') : '') +
      T('gs.sectorsiege.levFmt').replace('{t}', DIFF_INFO[diffIdx - 1].t).replace('{r}', m.rows).replace('{c}', m.cols);
    setupMatch(tag, T('gs.sectorsiege.goalUnify'));
  }

  /* ================= 暂停 ================= */
  function setPaused(v) {
    if (!state || state.over) return;
    if (v === paused) {
      pauseBtn.textContent = paused ? T('gs.sectorsiege.resumeBtn') : T('gs.sectorsiege.pauseBtn');
      return;
    }
    paused = !!v;
    if (loopApi) { if (paused) loopApi.pause(); else loopApi.resume(); }
    pauseBtn.textContent = paused ? T('gs.sectorsiege.resumeBtn') : T('gs.sectorsiege.pauseBtn');
    if (paused) {
      setMsg(T('shell.paused'), 'var(--neon-yellow)');
    } else if (msgEl.textContent === T('shell.paused')) {
      setMsg('');
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ================= 技能 ================= */
  function skillById(id) {
    for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i];
    return null;
  }
  function updateSkillUi() {
    if (!state) return;
    for (var i = 0; i < SKILLS.length; i++) {
      var sk = SKILLS[i];
      var btn = skillBtns[sk.id];
      if (!btn) continue;
      var remMs = skillReadyAt[sk.id] - state.elapsed;
      var rem = remMs > 0 ? Math.ceil(remMs / 1000) : 0;
      if (rem > 0) btn.classList.add('cooling'); else btn.classList.remove('cooling');
      var cdEl = skillCdEls[sk.id];
      if (cdEl) cdEl.textContent = rem > 0 ? rem + 's' : '';
      if (aimSkill === sk.id) btn.classList.add('aiming'); else btn.classList.remove('aiming');
    }
  }
  function useSkill(id) {
    if (!m || !state || state.over) return;
    var sk = skillById(id);
    if (!sk) return;
    if (paused) { setMsg(T('shell.paused'), 'var(--neon-yellow)'); return; }
    if (state.elapsed < skillReadyAt[id]) {
      setMsg(T('gs.sectorsiege.skillCoolMsg'), 'var(--neon-pink)');
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    if (sk.target) {
      aimSkill = id;
      setMsg(T('gs.sectorsiege.skillAim'), 'var(--neon-yellow)');
      if (Arcade.audio) Arcade.audio.play('select');
      updateSkillUi();
      return;
    }
    applySkill(id, null);
  }
  function applySkill(id, cell) {
    if (!m || !state || state.over) return;
    var sk = skillById(id);
    if (!sk) return;
    if (sk.target && !cell) return;
    var cd = Math.round(sk.cd * mods.cd);
    skillReadyAt[id] = state.elapsed + cd;
    aimSkill = null;
    var max = m.maxTroops || G_DIFF[m.diff].maxTroops;
    if (id === 'airstrike') {
      var t = m.grid[cell.r][cell.c];
      var before = t.troops;
      t.troops = Math.max(0, before - 10);
      var cut = before - t.troops;
      var x = (cell.c + 0.5) * cellPx, y = (cell.r + 0.5) * cellPx;
      burstAt(x, y, '#ff9f1c', 26, 2.6);
      burstAt(x, y, '#ff2d95', 14, 1.6);
      addRing(x, y, '#ff9f1c', 4);
      shake = 11;
      addFloat(x, y - cellPx * 0.3, T('gs.sectorsiege.skillAirstrikeFx').replace('{n}', cut), '#ff9f1c');
      setMsg(T('gs.sectorsiege.skillAirstrikeFx').replace('{n}', cut), 'var(--neon-orange)');
      if (Arcade.audio) Arcade.audio.play('match');
    } else if (id === 'reinforce') {
      var n = 0;
      for (var r = 0; r < m.rows; r++) {
        for (var c = 0; c < m.cols; c++) {
          var rc = m.grid[r][c];
          if (rc.owner === 1) {
            rc.troops = Math.min(max, rc.troops + 3);
            n++;
            if (n <= 12) addFloat((c + 0.5) * cellPx, (r + 0.5) * cellPx, '+3', '#39ff14');
          }
        }
      }
      addRing(LW / 2, LH / 2, '#39ff14', 8);
      setMsg(T('gs.sectorsiege.skillReinforceFx').replace('{n}', 3), 'var(--neon-green)');
      if (Arcade.audio) Arcade.audio.play('coin');
      if (Arcade.juice) Arcade.juice.select();
    } else if (id === 'march') {
      marchUntil = state.elapsed + 8000;
      addRing(LW / 2, LH / 2, '#00f0ff', 6);
      addFloat(LW / 2, LH * 0.45, T('gs.sectorsiege.skillMarchFx'), '#00f0ff');
      setMsg(T('gs.sectorsiege.skillMarchFx'), 'var(--neon-cyan)');
      if (Arcade.audio) Arcade.audio.play('ui');
    }
    updateSkillUi();
  }

  /* ================= 输入 ================= */
  function cellAt(px, py) {
    if (!m) return null;
    var rect = canvas.getBoundingClientRect();
    var x = (px - rect.left) * (LW / rect.width);
    var y = (py - rect.top) * (LH / rect.height);
    var c = Math.floor(x / cellPx), r = Math.floor(y / cellPx);
    if (r < 0 || c < 0 || r >= m.rows || c >= m.cols) return null;
    return { r: r, c: c };
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!m || state.over) return;
    var cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    if (aimSkill) {
      applySkill(aimSkill, cell);
      updateSkillUi();
      e.preventDefault();
      return;
    }
    if (paused) return;
    var owner = m.grid[cell.r][cell.c].owner;
    if (owner === 1) {
      drag = { r: cell.r, c: cell.c, x: e.clientX, y: e.clientY };
      hoverCell = cell;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (m) hoverCell = cellAt(e.clientX, e.clientY);
    if (drag) { drag.x = e.clientX; drag.y = e.clientY; }
  });
  canvas.addEventListener('pointerleave', function () {
    if (!drag) hoverCell = null;
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!drag) return;
    var from = { r: drag.r, c: drag.c };
    var cell = cellAt(e.clientX, e.clientY);
    drag = null;
    if (!cell) return;
    if (from.r === cell.r && from.c === cell.c) return;
    var src = m.grid[from.r][from.c];
    var count = Math.floor(src.troops * ratio);
    var g = G_send(m, from.r, from.c, cell.r, cell.c, count, moving);
    if (g) {
      if (Arcade.audio) Arcade.audio.play('coin');
      if (Arcade.juice) Arcade.juice.select();
      setMsg(T('gs.sectorsiege.msgSend').replace('{n}', g.count).replace('{r}', cell.r + 1).replace('{c}', cell.c + 1));
      addFloat((from.c + 0.5) * cellPx, (from.r + 0.5) * cellPx, '−' + g.count, '#a9f6ff');
      saveNow();
    } else {
      if (Arcade.audio) Arcade.audio.play('error');
    }
  });

  ratioBtn.addEventListener('click', function () {
    ratio = ratio === 0.5 ? 1 : 0.5;
    ratioBtn.textContent = ratio === 0.5 ? T('gs.sectorsiege.sendHalf') : T('gs.sectorsiege.sendAll');
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  pauseBtn.addEventListener('click', function () {
    if (!state || state.over) return;
    setPaused(!paused);
  });
  document.getElementById('gl-new').addEventListener('click', function () {
    showPick();
  });
  document.getElementById('gl-tech-btn').addEventListener('click', openTech);
  document.getElementById('gl-tech-game').addEventListener('click', openTech);
  document.getElementById('gl-tech-close').addEventListener('click', closeTech);
  techListEl.addEventListener('click', function (e) {
    var node = e.target && e.target.closest ? e.target.closest('[data-node]') : null;
    if (node) unlockTech(node.getAttribute('data-node'));
  });
  levelListEl.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-lvl]') : null;
    if (!b) return;
    var idx = parseInt(b.getAttribute('data-lvl'), 10);
    if (levelUnlocked(idx)) startLevel(idx);
  });

  /* P 键暂停（实时类统一约定） */
  document.addEventListener('keydown', function (e) {
    if (!m || !state || state.over) return;
    if (e.key === 'p' || e.key === 'P') {
      if (techOpen) return;
      setPaused(!paused);
    }
  });

  /* 键盘：方向键光标，Enter 派兵/确认空袭，空格比例，1/2/3 技能，Esc 取消 */
  document.addEventListener('keydown', function (e) {
    if (!m || !state || state.over) return;
    var k = e.key;
    if (techOpen) return;
    if (k === '1' || k === '2' || k === '3') {
      e.preventDefault();
      useSkill(SKILLS[parseInt(k, 10) - 1].id);
      return;
    }
    if (aimSkill) {
      if (k === 'Enter') {
        e.preventDefault();
        if (kbdR >= 0) { applySkill(aimSkill, { r: kbdR, c: kbdC }); updateSkillUi(); }
        return;
      }
      if (k === 'Escape') {
        aimSkill = null;
        setMsg('');
        updateSkillUi();
        return;
      }
    }
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      if (kbdR < 0) { kbdR = m.rows - 1; kbdC = 0; }
      kbdR += (k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0);
      kbdC += (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0);
      kbdR = Math.max(0, Math.min(m.rows - 1, kbdR));
      kbdC = Math.max(0, Math.min(m.cols - 1, kbdC));
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (kbdR < 0) { kbdR = m.rows - 1; kbdC = 0; return; }
      if (!kbdSel) {
        if (m.grid[kbdR][kbdC].owner !== 1) {
          setMsg(T('gs.sectorsiege.kbdNeedOwn'), 'var(--neon-yellow)');
          if (Arcade.audio) Arcade.audio.play('error');
          return;
        }
        kbdSel = { r: kbdR, c: kbdC };
        setMsg(T('gs.sectorsiege.kbdPicked').replace('{r}', kbdR + 1).replace('{c}', kbdC + 1), 'var(--neon-cyan)');
        if (Arcade.audio) Arcade.audio.play('select');
        return;
      }
      if (kbdSel.r === kbdR && kbdSel.c === kbdC) { kbdSel = null; return; }
      var srcK = m.grid[kbdSel.r][kbdSel.c];
      var cntK = Math.floor(srcK.troops * ratio);
      var gK = G_send(m, kbdSel.r, kbdSel.c, kbdR, kbdC, cntK, moving);
      if (gK) {
        if (Arcade.audio) Arcade.audio.play('coin');
        setMsg(T('gs.sectorsiege.msgSend').replace('{n}', gK.count).replace('{r}', kbdR + 1).replace('{c}', kbdC + 1));
        addFloat((kbdSel.c + 0.5) * cellPx, (kbdSel.r + 0.5) * cellPx, '−' + gK.count, '#a9f6ff');
        saveNow();
      } else {
        if (Arcade.audio) Arcade.audio.play('error');
      }
      kbdSel = null;
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      ratio = ratio === 0.5 ? 1 : 0.5;
      ratioBtn.textContent = ratio === 0.5 ? T('gs.sectorsiege.sendHalf') : T('gs.sectorsiege.sendAll');
      return;
    }
    if (k === 'Escape') {
      kbdSel = null; aimSkill = null; setMsg(''); updateSkillUi();
    }
  });

  window.addEventListener('resize', function () {
    if (m) resizeCanvas();
  });

  /* ================= 循环 ================= */
  function update() {
    if (!m || !state) return;
    if (paused) return;

    if (!state.over) {
      state.elapsed += 16;

      produceAcc += 16;
      if (produceAcc >= G_TICK_MS) {
        produceAcc = 0;
        G_produce(m, { prod: mods.prod });
      }
      aiAcc += 16;
      if (aiAcc >= 240) {
        aiAcc = 0;
        G_aiThink(m, moving, G_mulberry32(Date.now() % 2147483647));
      }

      var speedMul = mods.speed * (state.elapsed < marchUntil ? 2 : 1);
      var prev = [];
      for (var r0 = 0; r0 < m.rows; r0++) for (var c0 = 0; c0 < m.cols; c0++) prev.push(m.grid[r0][c0].owner);
      G_stepMoving(m, moving, speedMul);
      for (var r1 = 0; r1 < m.rows; r1++) {
        for (var c1 = 0; c1 < m.cols; c1++) {
          var o = m.grid[r1][c1].owner, po = prev[r1 * m.cols + c1];
          if (o !== po) onCapture(r1, c1, po, o);
        }
      }

      updateSkillUi();
      if (state.mode === 'campaign') checkCampaignGoal();
      else checkRandomGoal();
      updateHud();

      saveAcc += 16;
      if (saveAcc >= 2000) { saveAcc = 0; saveNow(); }
    }
    updateEffects();
  }

  function checkCampaignGoal() {
    var g = state.goal;
    if (g.type === 'hold' && g.obj) {
      var oc = m.grid[g.obj[0]][g.obj[1]];
      if (oc.owner === 1) state.holdMs += 16;
      else state.holdMs = 0;
      if (state.holdMs >= g.holdMs) { endGame(1); return; }
    }
    if (enemyCells() === 0 && countOwner(1) > 0) { endGame(1); return; }
    if (countOwner(1) === 0) { endGame(-1, 'wiped'); return; }
    if (state.timeLimitMs && state.elapsed >= state.timeLimitMs) {
      endGame(-1, 'timeout');
    }
  }
  function checkRandomGoal() {
    var w = G_winner(m);
    if (w !== 0) endGame(w, w === 1 ? null : 'wiped');
    else if (countOwner(1) === 0) endGame(-1, 'wiped');
  }

  function updateEffects() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * 0.5; p.y += p.vy * 0.5; p.vy += 0.045; p.life -= 0.035;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var f = floats.length - 1; f >= 0; f--) {
      floats[f].life -= 0.022;
      if (floats[f].life <= 0) floats.splice(f, 1);
    }
    for (var key in flashes) {
      flashes[key] -= 0.055;
      if (flashes[key] <= 0) delete flashes[key];
    }
    for (var ri = rings.length - 1; ri >= 0; ri--) {
      var rg = rings[ri];
      rg.r += Math.max(1.2, cellPx * 0.09);
      rg.life -= 0.045;
      if (rg.life <= 0) rings.splice(ri, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - 0.6);
  }

  function onCapture(r, c, from, to) {
    var x = (c + 0.5) * cellPx, y = (r + 0.5) * cellPx;
    flashes[r + ',' + c] = 1;
    var col = COLORS[to] || '#fff';
    burstAt(x, y, col, 14, 2.2);
    addRing(x, y, col, Math.max(3, cellPx * 0.18));
    if (to === 1) {
      shake = 6;
      if (Arcade.audio) Arcade.audio.play('match');
      addFloat(x, y, T('gs.sectorsiege.fxTake'), '#00f0ff');
    } else if (from === 1) {
      shake = 8;
      if (Arcade.audio) Arcade.audio.play('error');
      addFloat(x, y, T('gs.sectorsiege.fxLost'), '#ff2d95');
    } else if (to > 1) {
      if (Arcade.audio) Arcade.audio.play('select');
    }
  }

  function updateHud() {
    if (!state || !m) return;
    var playerCells = countOwner(1);
    var enemy = enemyCells();
    var sec = Math.floor(state.elapsed / 1000);
    hudEl.textContent = T('gs.sectorsiege.hud').replace('{n}', playerCells).replace('{m}', enemy).replace('{s}', sec);
    var g = state.goal, label = '', pct = 0;
    if (state.mode === 'campaign') {
      if (g.type === 'hold') {
        var target = Math.round(g.holdMs / 1000);
        label = T('gs.sectorsiege.goalHold').replace('{s}', target) + ' · ' +
          T('gs.sectorsiege.holdProgress').replace('{n}', (state.holdMs / 1000).toFixed(1)).replace('{m}', target);
        pct = state.holdMs / Math.max(1, g.holdMs);
      } else if (g.type === 'time') {
        var left = Math.max(0, Math.ceil((state.timeLimitMs - state.elapsed) / 1000));
        label = T('gs.sectorsiege.goalTime').replace('{s}', Math.round(g.sec)) + ' · ' +
          T('gs.sectorsiege.timeLeft').replace('{n}', left);
        pct = state.timeLimitMs ? state.elapsed / state.timeLimitMs : 0;
      } else {
        label = T('gs.sectorsiege.goalConquer') + ' · ' + T('gs.sectorsiege.remainingEnemy').replace('{n}', enemy);
        pct = state.startEnemy ? (state.startEnemy - enemy) / state.startEnemy : 0;
      }
    } else {
      label = T('gs.sectorsiege.goalUnify') + ' · ' + T('gs.sectorsiege.remainingEnemy').replace('{n}', enemy);
      pct = state.startEnemy ? (state.startEnemy - enemy) / state.startEnemy : 0;
    }
    goalTextEl.textContent = label;
    goalFillEl.style.width = Math.max(0, Math.min(100, pct * 100)) + '%';
  }

  /* ================= 结算 ================= */
  function clearOverlayActions() {
    ovBtn.onclick = null; ovAlt.onclick = null; ovThird.onclick = null;
    ovThird.classList.add('hidden');
  }
  function renderResultStars(n) {
    var html = '';
    for (var i = 0; i < 3; i++) {
      html += '<span class="' + (i < n ? 'on' : '') + '" style="animation-delay:' + (i * 90) + 'ms">' +
        (i < n ? '★' : '☆') + '</span>';
    }
    ovStars.innerHTML = html;
  }
  function endGame(w, reason) {
    if (!state || !m || state.over) return;
    state.over = true;
    paused = false;
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    if (Arcade.savegame) Arcade.savegame.clear();

    var sec = Math.floor(state.elapsed / 1000);
    var campaign = state.mode === 'campaign';
    var lvl = campaign ? G_CAMPAIGN[state.levelIdx] : null;
    var idx = state.levelIdx;
    var stars = 0;
    var diffAtEnd = state.diff;
    var dailyAtEnd = state.daily;

    clearOverlayActions();
    ovStars.innerHTML = '';
    ovStats.innerHTML = '';
    shake = w === 1 ? 13 : 10;
    for (var bi = 0; bi < 40; bi++) {
      burstAt(Math.random() * LW, Math.random() * LH, w === 1 ? '#00f0ff' : '#ff2d95', 1, 2.6);
    }
    if (Arcade.fx) Arcade.fx.centerBurst(w === 1 ? '#00f0ff' : '#ff2d95', 30);

    if (w === 1) {
      ovIcon.className = 'gl-emblem win';
      ovTitle.className = 'win';
      ovTitle.textContent = T('gs.sectorsiege.winT');
      if (campaign) {
        stars = computeStars(lvl, sec);
        state.stars = stars;
        saveLevelStars(idx, stars);
        ovText.innerHTML = T('gs.sectorsiege.campaignWinD')
          .replace('{n}', idx + 1).replace('{name}', T(lvl.name)).replace('{s}', sec);
        renderResultStars(stars);
      } else {
        ovText.innerHTML = T('gs.sectorsiege.winD').replace('{s}', sec);
        if (state.daily && Arcade.daily) Arcade.daily.markSolved('sectorsiege', sec);
      }
      if (Arcade.audio) Arcade.audio.play('win');
      if (Arcade.juice) Arcade.juice.win();
      if (Arcade.shell) Arcade.shell.submitScore(sec);
    } else {
      ovIcon.className = 'gl-emblem lose';
      ovTitle.className = '';
      if (reason === 'timeout') {
        ovTitle.textContent = T('gs.sectorsiege.timeoutT');
        ovText.innerHTML = campaign
          ? T('gs.sectorsiege.timeoutD').replace('{n}', idx + 1).replace('{name}', T(lvl.name))
          : T('gs.sectorsiege.losePlayer');
      } else {
        ovTitle.textContent = T('gs.sectorsiege.loseT');
        ovText.innerHTML = (w === -1 || campaign)
          ? T('gs.sectorsiege.losePlayer')
          : T('gs.sectorsiege.loseEnemy');
      }
      if (campaign) renderResultStars(0);
      if (Arcade.audio) Arcade.audio.play('lose');
      if (Arcade.juice) Arcade.juice.lose();
    }

    var best = (Arcade.storage && Arcade.storage.getBest) ? Arcade.storage.getBest('sectorsiege') : null;
    var bestStars = campaign ? levelStars(idx) : 0;
    ovStats.innerHTML =
      '<div class="gl-stat">' + T('gs.sectorsiege.statTime') + '<b>' + sec + 's</b></div>' +
      '<div class="gl-stat">' + T('gs.sectorsiege.statBest') + '<b>' + (best === null ? '--' : best + 's') + '</b></div>' +
      '<div class="gl-stat">' + T('gs.sectorsiege.statStars') + '<b>' + (campaign ? bestStars + '/3' : '--') + '</b></div>';

    if (campaign) {
      if (w === 1) {
        if (idx + 1 < G_CAMPAIGN.length) {
          ovBtn.textContent = T('gs.sectorsiege.nextLevel');
          ovBtn.onclick = function () { overlayEl.classList.add('hidden'); startLevel(idx + 1); };
        } else {
          ovBtn.textContent = T('gs.sectorsiege.backToPick');
          ovBtn.onclick = function () { overlayEl.classList.add('hidden'); showPick(); };
        }
        ovAlt.textContent = T('gs.sectorsiege.retry');
        ovAlt.onclick = function () { overlayEl.classList.add('hidden'); startLevel(idx); };
        ovThird.textContent = T('gs.sectorsiege.backToPick');
        ovThird.classList.remove('hidden');
        ovThird.onclick = function () { overlayEl.classList.add('hidden'); showPick(); };
      } else {
        ovBtn.textContent = T('gs.sectorsiege.retry');
        ovBtn.onclick = function () { overlayEl.classList.add('hidden'); startLevel(idx); };
        ovAlt.textContent = T('gs.sectorsiege.backToPick');
        ovAlt.onclick = function () { overlayEl.classList.add('hidden'); showPick(); };
      }
    } else {
      ovBtn.textContent = T('gs.sectorsiege.againSame');
      ovBtn.onclick = function () { overlayEl.classList.add('hidden'); startGame(diffAtEnd, dailyAtEnd); };
      ovAlt.textContent = T('gs.sectorsiege.changeDiff');
      ovAlt.onclick = function () { overlayEl.classList.add('hidden'); showPick(); };
    }
    overlayEl.classList.remove('hidden');
  }

  function showPick() {
    paused = false;
    if (loopApi) { loopApi.stop(); loopApi = null; }
    if (Arcade.savegame) Arcade.savegame.clear();
    state = null; m = null; drag = null; aimSkill = null; hoverCell = null;
    resetEffects();
    overlayEl.classList.add('hidden');
    techEl.classList.add('hidden');
    techOpen = false; techPausedGame = false;
    gameEl.style.display = 'none';
    pickEl.classList.remove('hidden');
    renderLevels();
    renderProgress();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ================= 断点续玩（随机/每日） ================= */
  function saveNow() {
    if (Arcade.savegame && m && state && !state.over && state.mode !== 'campaign') Arcade.savegame.write();
  }
  if (Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'sectorsiege',
      collect: function () {
        if (!m || !state || state.over || state.mode === 'campaign') return null;
        return {
          mode: state.mode, diff: state.diff, daily: state.daily, seed: state.seed,
          elapsed: Math.floor(state.elapsed / 1000),
          grid: m.grid.map(function (row) {
            return row.map(function (c) { return [c.owner, c.troops, c.type === 'mine' ? 1 : (c.type === 'fort' ? 2 : 0)]; });
          }),
          moving: moving.map(function (g) { return [g.fr, g.fc, g.tr, g.tc, g.owner, g.count, g.progress]; })
        };
      },
      apply: function (s) {
        if (!s || !s.grid || typeof s.diff !== 'number') return false;
        var conf = G_DIFF[s.diff];
        if (!conf) return false;
        if (s.grid.length !== conf.rows) return false;
        for (var i = 0; i < conf.rows; i++) if (!s.grid[i] || s.grid[i].length !== conf.cols) return false;

        m = G_genMap(s.diff, Number(s.seed) || 1);
        m._keep = mods.keep;
        for (var r = 0; r < conf.rows; r++) {
          for (var c = 0; c < conf.cols; c++) {
            var t = s.grid[r][c] || [0, 1, 0];
            m.grid[r][c].owner = Number(t[0]) || 0;
            m.grid[r][c].troops = Number(t[1]) || 0;
            m.grid[r][c].type = t[2] === 1 ? 'mine' : (t[2] === 2 ? 'fort' : 'plain');
          }
        }
        prepareCells(m);
        moving = (s.moving || []).map(function (a) {
          return { fr: a[0], fc: a[1], tr: a[2], tc: a[3], owner: a[4], count: a[5], progress: Number(a[6]) || 0 };
        });
        state = {
          mode: s.mode === 'daily' ? 'daily' : 'random', diff: s.diff, daily: !!s.daily,
          levelIdx: -1, seed: Number(s.seed) || 1,
          start: Date.now(), elapsed: (Number(s.elapsed) || 0) * 1000, over: false,
          goal: { type: 'unify', sec: 0, holdMs: 0, obj: null },
          timeLimitMs: 0, holdMs: 0, stars: 0, submitted: false, reason: null,
          startEnemy: enemyCells()
        };
        resetEffects();
        var tag = (state.daily ? T('gs.sectorsiege.dailyLev') : '') +
          T('gs.sectorsiege.levFmt').replace('{t}', DIFF_INFO[s.diff - 1].t).replace('{r}', m.rows).replace('{c}', m.cols);
        setupMatch(tag, T('gs.sectorsiege.goalUnify'));
        return true;
      }
    });
  }

  /* ================= 绘制 ================= */
  function shade(hex, f) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    if (!m) return;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.clearRect(-16, -16, LW + 32, LH + 32);
    var bg = ctx.createLinearGradient(0, 0, LW, LH);
    bg.addColorStop(0, '#0a0f1e');
    bg.addColorStop(0.5, '#0d1429');
    bg.addColorStop(1, '#070a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LW, LH);

    // 细网格光纹
    ctx.strokeStyle = 'rgba(0,240,255,0.035)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= LW; gx += cellPx * 2) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, LH); ctx.stroke();
    }
    for (var gy = 0; gy <= LH; gy += cellPx * 2) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(LW, gy); ctx.stroke();
    }

    var pad = Math.max(1.5, cellPx * 0.055);
    var rad = Math.max(3, cellPx * 0.17);

    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++) {
        var cell = m.grid[r][c];
        if (typeof cell.dv !== 'number') cell.dv = cell.troops;
        cell.dv += (cell.troops - cell.dv) * 0.2;
        if (Math.abs(cell.troops - cell.dv) < 0.02) cell.dv = cell.troops;
        /* 兵数变化时数字弹一下，和粒子/浮字同一套缓动 */
        if (typeof cell.lastTroops !== 'number') cell.lastTroops = cell.troops;
        if (cell.troops !== cell.lastTroops) { cell.pop = 1; cell.lastTroops = cell.troops; }
        if (cell.pop > 0) cell.pop = Math.max(0, cell.pop - 0.085);

        var x = c * cellPx + pad, y = r * cellPx + pad, s = cellPx - pad * 2;
        var col = COLORS[cell.owner] || '#3a4152';
        var gg = ctx.createLinearGradient(x, y, x, y + s);
        if (cell.owner === 0) {
          gg.addColorStop(0, 'rgba(58,65,82,0.42)');
          gg.addColorStop(1, 'rgba(26,31,44,0.5)');
        } else {
          gg.addColorStop(0, shade(col, 1.18));
          gg.addColorStop(0.55, col);
          gg.addColorStop(1, shade(col, 0.55));
        }
        ctx.fillStyle = gg;
        roundRect(x, y, s, s, rad);
        ctx.fill();

        if (cell.owner > 0) {
          ctx.strokeStyle = shade(col, 1.4);
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.85;
          ctx.shadowColor = col;
          ctx.shadowBlur = cellPx * 0.35;
          roundRect(x, y, s, s, rad);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          roundRect(x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.34, rad * 0.8);
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          roundRect(x, y, s, s, rad);
          ctx.stroke();
        }

        // 资源类型图标（自绘）
        if (cell.type === 'mine') {
          var cx = x + s * 0.24, cy = y + s * 0.26, rr2 = s * 0.1;
          ctx.fillStyle = '#ffd24a';
          ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(cx, cy - rr2); ctx.lineTo(cx + rr2, cy); ctx.lineTo(cx, cy + rr2); ctx.lineTo(cx - rr2, cy);
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
        } else if (cell.type === 'fort') {
          var sx = x + s * 0.24, sy = y + s * 0.17, w2 = s * 0.16;
          ctx.fillStyle = '#ff6b9d';
          ctx.shadowColor = '#ff6b9d'; ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(sx, sy); ctx.lineTo(sx + w2, sy + w2 * 0.5);
          ctx.lineTo(sx + w2, sy + w2 * 1.3); ctx.lineTo(sx, sy + w2 * 1.9);
          ctx.lineTo(sx - w2, sy + w2 * 1.3); ctx.lineTo(sx - w2, sy + w2 * 0.5);
          ctx.closePath(); ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 兵数（缓动）
        var fs = Math.max(9, cellPx * 0.36);
        ctx.font = 'bold ' + fs + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = cell.owner === 0 ? '#9aa4b8' : '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 4;
        var numScale = 1 + 0.45 * (cell.pop || 0);
        ctx.save();
        ctx.translate(x + s / 2, y + s * 0.66);
        ctx.scale(numScale, numScale);
        ctx.fillText(Math.round(cell.dv), 0, 0);
        ctx.restore();
        ctx.shadowBlur = 0;

        var fl = flashes[r + ',' + c];
        if (fl) {
          ctx.globalAlpha = Math.max(0, Math.min(1, fl)) * 0.6;
          ctx.fillStyle = '#ffffff';
          roundRect(x, y, s, s, rad);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.textBaseline = 'alphabetic';

    // 核心（守点关）
    if (state && state.goal && state.goal.obj) {
      var oc = state.goal.obj;
      var ox = (oc[1] + 0.5) * cellPx, oy = (oc[0] + 0.5) * cellPx;
      var ocell = m.grid[oc[0]][oc[1]];
      var ocol = ocell.owner === 1 ? '#39ff14' : (ocell.owner > 1 ? '#ff2d95' : '#ffe600');
      var pulse = 0.5 + 0.5 * Math.sin((state.elapsed || 0) / 280);
      ctx.strokeStyle = ocol;
      ctx.globalAlpha = 0.55 + pulse * 0.3;
      ctx.lineWidth = Math.max(1.5, cellPx * 0.055);
      ctx.beginPath(); ctx.arc(ox, oy, cellPx * (0.34 + pulse * 0.06), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([Math.max(3, cellPx * 0.12), Math.max(3, cellPx * 0.1)]);
      ctx.beginPath(); ctx.arc(ox, oy, cellPx * 0.46, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = 'bold ' + Math.max(7, cellPx * 0.2) + 'px monospace';
      ctx.fillStyle = ocol;
      ctx.textAlign = 'center';
      ctx.fillText(T('gs.sectorsiege.coreTag'), ox, (oc[0] + 1) * cellPx - cellPx * 0.1);
      if (state.mode === 'campaign' && state.goal.holdMs > 0) {
        var prog = Math.min(1, state.holdMs / state.goal.holdMs);
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = Math.max(2, cellPx * 0.08);
        ctx.beginPath();
        ctx.arc(ox, oy, cellPx * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
        ctx.stroke();
      }
    }

    // 移动群（带拖尾）
    moving.forEach(function (g2) {
      var x1 = (g2.fc + 0.5) * cellPx, y1 = (g2.fr + 0.5) * cellPx;
      var x2 = (g2.tc + 0.5) * cellPx, y2 = (g2.tr + 0.5) * cellPx;
      var px = x1 + (x2 - x1) * g2.progress;
      var py = y1 + (y2 - y1) * g2.progress;
      var cc = COLORS[g2.owner] || '#fff';

      for (var tj = 4; tj >= 1; tj--) {
        var tp = g2.progress - tj * 0.045;
        if (tp < 0) continue;
        var tx = x1 + (x2 - x1) * tp, ty = y1 + (y2 - y1) * tp;
        ctx.globalAlpha = 0.055 * (5 - tj);
        ctx.fillStyle = cc;
        ctx.beginPath(); ctx.arc(tx, ty, Math.max(2, cellPx * (0.15 - tj * 0.02)), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = cc;
      ctx.lineWidth = Math.max(1.5, cellPx * 0.06);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(px, py); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowColor = cc; ctx.shadowBlur = 12;
      var bg2 = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, Math.max(4, cellPx * 0.16));
      bg2.addColorStop(0, '#ffffff');
      bg2.addColorStop(0.4, cc);
      bg2.addColorStop(1, shade(cc, 0.5));
      ctx.fillStyle = bg2;
      ctx.beginPath(); ctx.arc(px, py, Math.max(4, cellPx * 0.15), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.max(8, cellPx * 0.24) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(g2.count, px, py - cellPx * 0.2);
    });

    // 键盘光标
    if (kbdR >= 0 && kbdR < m.rows && kbdC >= 0 && kbdC < m.cols) {
      var kx = kbdC * cellPx, ky = kbdR * cellPx;
      ctx.strokeStyle = kbdSel ? '#ffe600' : '#00f0ff';
      ctx.lineWidth = Math.max(2, cellPx * 0.07);
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.setLineDash([cellPx * 0.18, cellPx * 0.12]);
      ctx.strokeRect(kx + 2, ky + 2, cellPx - 4, cellPx - 4);
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    // 拖线
    if (drag) {
      var rect = canvas.getBoundingClientRect();
      var x0 = (drag.c + 0.5) * cellPx, y0 = (drag.r + 0.5) * cellPx;
      var dx = (drag.x - rect.left) * (LW / rect.width);
      var dy = (drag.y - rect.top) * (LH / rect.height);
      ctx.strokeStyle = '#00f0ff';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = Math.max(2, cellPx * 0.08);
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 12;
      ctx.setLineDash([cellPx * 0.22, cellPx * 0.16]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(dx, dy, Math.max(3, cellPx * 0.1), 0, Math.PI * 2); ctx.fillStyle = '#00f0ff'; ctx.fill();
      ctx.globalAlpha = 1;
      var hc = cellAt(drag.x, drag.y);
      if (hc) {
        var tcell = m.grid[hc.r][hc.c];
        ctx.strokeStyle = tcell.owner === 0 ? '#ffe600' : '#ffffff';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        roundRect(hc.c * cellPx + 1, hc.r * cellPx + 1, cellPx - 2, cellPx - 2, rad);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 空袭瞄准框
    if (aimSkill) {
      var hcc = hoverCell || (kbdR >= 0 ? { r: kbdR, c: kbdC } : null);
      if (hcc && hcc.r < m.rows && hcc.c < m.cols) {
        var ax = hcc.c * cellPx, ay = hcc.r * cellPx;
        var ap = 0.55 + 0.45 * Math.sin((state.elapsed || 0) / 160);
        ctx.strokeStyle = '#ff9f1c';
        ctx.globalAlpha = ap;
        ctx.lineWidth = Math.max(2, cellPx * 0.07);
        roundRect(ax + 1, ay + 1, cellPx - 2, cellPx - 2, rad);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax + cellPx * 0.28, ay + cellPx * 0.5); ctx.lineTo(ax + cellPx * 0.72, ay + cellPx * 0.5);
        ctx.moveTo(ax + cellPx * 0.5, ay + cellPx * 0.28); ctx.lineTo(ax + cellPx * 0.5, ay + cellPx * 0.72);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 占领脉冲
    rings.forEach(function (rg) {
      ctx.globalAlpha = Math.max(0, rg.life) * 0.75;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = Math.max(1.5, cellPx * 0.05);
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // 粒子
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // 浮字
    floats.forEach(function (f) {
      var pr = 1 - f.life;
      var rise = 30 * easeOutCubic(pr);
      var pop = 0.7 + 0.3 * easeOutBack(Math.min(1, pr * 3));
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.font = 'bold ' + Math.max(10, cellPx * 0.34) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 4;
      ctx.save();
      ctx.translate(f.x, (f.y0 === undefined ? f.y : f.y0) - rise);
      ctx.scale(pop, pop);
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /* ================= 启动 ================= */
  var pickBtns = pickEl.querySelectorAll('button[data-i]');
  for (var i = 0; i < pickBtns.length; i++) {
    pickBtns[i].addEventListener('click', function () {
      startGame(parseInt(this.dataset.i, 10) + 1, false);
    });
  }
  document.getElementById('gl-pick-daily').addEventListener('click', function () {
    startGame(2, true);
  });

  renderLevels();
  renderProgress();
  updateSkillUi();

  var resumed = false;
  if (Arcade.savegame) resumed = Arcade.savegame.resume();
  if (!resumed) pickEl.classList.remove('hidden');

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.sectorsiege.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    var mode = state && state.mode;
    var idx = state && state.levelIdx;
    var diff = state && state.diff;
    var daily = state && state.daily;
    overlayEl.classList.add('hidden');
    if (mode === 'campaign') { startLevel(idx); return; }
    if (mode) { startGame(diff || 2, !!daily); return; }
    showPick();
  };

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.sectorsiege.tut1t'), d: T('gs.sectorsiege.tut1') },
    { t: T('gs.sectorsiege.tut2t'), d: T('gs.sectorsiege.tut2') },
    { t: T('gs.sectorsiege.tut3t'), d: T('gs.sectorsiege.tut3') },
    { t: T('gs.sectorsiege.tut4t'), d: T('gs.sectorsiege.tut4') }
  ];

  /* QA 钩子：仅 ?qa=1 时挂载 */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) {
    window.__qa = {
      state: function () {
        if (!state) return null;
        return {
          mode: state.mode, levelIdx: state.levelIdx, over: state.over,
          elapsed: state.elapsed, paused: paused, stars: state.stars,
          holdMs: state.holdMs, enemy: enemyCells(),
          goal: { type: state.goal.type, sec: state.goal.sec, holdMs: state.goal.holdMs, obj: state.goal.obj },
          timeLimitMs: state.timeLimitMs,
          timeLeft: state.timeLimitMs ? Math.max(0, state.timeLimitMs - state.elapsed) : 0,
          rows: m ? m.rows : 0, cols: m ? m.cols : 0,
          cells: m ? m.grid.map(function (row) {
            return row.map(function (c) { return { owner: c.owner, troops: Math.round(c.troops * 10) / 10, type: c.type }; });
          }) : [],
          moving: moving.map(function (g) { return { fr: g.fr, fc: g.fc, tr: g.tr, tc: g.tc, owner: g.owner, count: g.count, progress: g.progress }; }),
          marchMsLeft: Math.max(0, marchUntil - state.elapsed),
          skills: { airstrike: skillReadyAt.airstrike, reinforce: skillReadyAt.reinforce, march: skillReadyAt.march },
          mods: { prod: mods.prod, init: mods.init, speed: mods.speed, cd: mods.cd, keep: mods.keep, time: mods.time },
          tech: { unlocked: unlockedTech.slice(), available: availableStars(), total: totalStars() }
        };
      },
      level: function (idx) { startLevel(idx); return true; },
      send: function (fr, fc, tr, tc, ratio) {
        if (!m || !state || state.over) return null;
        var src = m.grid[fr][fc];
        if (src.owner !== 1) return null;
        var cnt = Math.floor(src.troops * (ratio == null ? 0.7 : ratio));
        return G_send(m, fr, fc, tr, tc, cnt, moving);
      },
      skill: function (id, r, c) {
        if (!m || !state || state.over) return false;
        if (skilReadyBlocked(id)) return false;
        applySkill(id, (r != null && c != null) ? { r: r, c: c } : null);
        return true;
      },
      unlock: function (id) { unlockTech(id); recalcMods(); return mods; },
      forceWin: function () {
        if (!m || !state || state.over) return false;
        endGame(1, 'qa');
        return true;
      },
      forceLose: function () {
        if (!m || !state || state.over) return false;
        endGame(-1, 'qa');
        return true;
      }
    };
    function skilReadyBlocked(id) { return !SKILLS.length || state.elapsed < (skillReadyAt[id] || 0); }
  }
})();
