/* ============================================================
   攻城棋 Siege · 旗舰版
   - 每局随机地形（3 模板 + 种子随机 + 180° 对称保证公平）
   - 三档 AI：随机 / 2 层反击预判 / αβ 3 层限时搜索
   - 音效、棋子缓动、攻击弹道、受击闪红、占领旗帜
   - 完整闭环：菜单→对局→胜负→结算→重开/换难度
   规则：每回合 1 个行动点（移动或攻击）；士兵前后左右 1 格移动、
        斜前 1 格攻击，站高地时斜前 2 格（中间必须为空）；
        王向 8 方向移动/攻击 1 格；士兵到达底线加冕为王；
        踏上据点即占领（+3），可被对方反夺；消灭对方全部王获胜。
   ============================================================ */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.siege.tut1t'), d: T('gs.siege.tut1') },
  { t: T('gs.siege.tut2t'), d: T('gs.siege.tut2') },
  { t: T('gs.siege.tut3t'), d: T('gs.siege.tut3') },
  { t: T('gs.siege.tut4t'), d: T('gs.siege.tut4') },
  { t: T('gs.siege.tut5t'), d: T('gs.siege.tut5') },
  { t: T('gs.siege.tut6t'), d: T('gs.siege.tut6') }
];

(function () {
  'use strict';
  var root = document.getElementById('game-root');
  if (!root) return;

  var N = 8, W = 480, H = 480, PAD = 16;
  var CS = (W - PAD * 2) / N;
  var BLUE = 'blue', RED = 'red';
  var DIR8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var WIN_VALUE = 90000;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
  function center(r, c) { return { x: PAD + c * CS + CS / 2, y: PAD + r * CS + CS / 2 }; }
  function otherColor(c) { return c === BLUE ? RED : BLUE; }
  function clampCell(v) { return clamp(v, 0, N - 1); }

  /* ---------------- 地形生成（严格 180° 对称随机） ---------------- */
  var TEMPLATES = ['plain', 'river', 'fortress'];

  /* 每次落笔都镜像到 (N-1-r, N-1-c)，从生成阶段保证绝对公平 */
  function setSym(terrain, r, c, type) {
    if (inB(r, c)) terrain[r][c] = type;
    var mr = N - 1 - r, mc = N - 1 - c;
    if (inB(mr, mc)) terrain[mr][mc] = type;
  }

  function clampCell(v) { return v < 0 ? 0 : (v >= N ? N - 1 : v); }

  /* 随机镜像斑块：中心 + 邻格，制造自然的山丘/岩石群 */
  function stampSym(terrain, r, c, type, rnd) {
    setSym(terrain, r, c, type);
    var spread = Math.floor(rnd() * 3);
    if (spread > 0) setSym(terrain, clampCell(r + (rnd() < 0.5 ? 1 : -1)), c, type);
    if (spread > 1) setSym(terrain, r, clampCell(c + (rnd() < 0.5 ? 1 : -1)), type);
    if (spread > 2) setSym(terrain, clampCell(r + (rnd() < 0.5 ? 1 : -1)), clampCell(c + (rnd() < 0.5 ? 1 : -1)), type);
  }

  function buildTerrain(template, rnd) {
    var t = [], r, c;
    for (r = 0; r < N; r++) { t[r] = []; for (c = 0; c < N; c++) t[r][c] = 'grass'; }
    if (template === 'plain') {
      var hills = 3 + Math.floor(rnd() * 4);
      for (var i = 0; i < hills; i++) {
        stampSym(t, 1 + Math.floor(rnd() * 6), Math.floor(rnd() * N), 'hill', rnd);
      }
      var rocks = 2 + Math.floor(rnd() * 3);
      for (var j = 0; j < rocks; j++) {
        stampSym(t, 2 + Math.floor(rnd() * 4), Math.floor(rnd() * N), 'rock', rnd);
      }
    } else if (template === 'river') {
      /* 横向水带本身关于中线对称；渡口按左半区随机后镜像 */
      for (c = 0; c < N; c++) { t[3][c] = 'water'; t[4][c] = 'water'; }
      var leftFords = [];
      var fordCount = 1 + Math.floor(rnd() * 2);
      for (var f = 0; f < fordCount; f++) leftFords.push(Math.floor(rnd() * (N / 2)));
      for (var fi = 0; fi < leftFords.length; fi++) {
        /* 上下两行同时开渡口，镜像后同一列可通行 */
        setSym(t, 3, leftFords[fi], 'grass');
        setSym(t, 4, leftFords[fi], 'grass');
      }
      for (var hi = 0; hi < 3 + Math.floor(rnd() * 4); hi++) {
        stampSym(t, [1, 2, 5, 6][Math.floor(rnd() * 4)], Math.floor(rnd() * N), 'hill', rnd);
      }
    } else {
      for (c = 0; c < N; c++) { t[3][c] = 'rock'; t[4][c] = 'rock'; }
      /* 城门随机选 1~2 个，镜像后形成对应缺口 */
      var leftGates = [];
      var gateCount = 1 + Math.floor(rnd() * 2);
      for (var g = 0; g < gateCount; g++) leftGates.push(Math.floor(rnd() * 3));
      for (var gi = 0; gi < leftGates.length; gi++) {
        setSym(t, 3, leftGates[gi], 'grass');
        setSym(t, 4, leftGates[gi], 'grass');
      }
      /* 中央保证一条通道 */
      setSym(t, 3, 3, 'grass'); setSym(t, 3, 4, 'grass');
      for (var ri = 0; ri < 1 + Math.floor(rnd() * 3); ri++) {
        stampSym(t, [2, 5][Math.floor(rnd() * 2)], Math.floor(rnd() * N), 'rock', rnd);
      }
      for (var hi2 = 0; hi2 < 2 + Math.floor(rnd() * 3); hi2++) {
        stampSym(t, [2, 5][Math.floor(rnd() * 2)], Math.floor(rnd() * N), 'hill', rnd);
      }
    }
    /* 出生带保持可通行（整行清除，行 0↔7、1↔6 天然镜像） */
    for (c = 0; c < N; c++) {
      t[0][c] = 'grass'; t[7][c] = 'grass';
      t[1][c] = t[1][c] === 'water' || t[1][c] === 'rock' ? 'grass' : t[1][c];
      t[6][c] = t[6][c] === 'water' || t[6][c] === 'rock' ? 'grass' : t[6][c];
    }
    return t;
  }

  function isSymmetric(terrain) {
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        if (terrain[r][c] !== terrain[N - 1 - r][N - 1 - c]) return false;
      }
    }
    return true;
  }

  function makeFlags(terrain) {
    var cells = [[3, 3], [3, 4], [4, 3], [4, 4]];
    var flags = [];
    cells.forEach(function (p) {
      terrain[p[0]][p[1]] = 'grass';
      terrain[N - 1 - p[0]][N - 1 - p[1]] = 'grass';
      flags.push({ r: p[0], c: p[1], owner: null });
    });
    return flags;
  }

  function passable(terrain, r, c) {
    if (!inB(r, c)) return false;
    var t = terrain[r][c];
    return t === 'grass' || t === 'hill';
  }

  function verifyMap(terrain, flags) {
    var seen = [], r, c;
    for (r = 0; r < N; r++) { seen[r] = []; for (c = 0; c < N; c++) seen[r][c] = false; }
    var queue = [[7, 3]], qi = 0;
    seen[7][3] = true;
    while (qi < queue.length) {
      var p = queue[qi++];
      for (var d = 0; d < 4; d++) {
        var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]][d];
        var nr = p[0] + dirs[0], nc = p[1] + dirs[1];
        if (!inB(nr, nc) || seen[nr][nc] || !passable(terrain, nr, nc)) continue;
        seen[nr][nc] = true; queue.push([nr, nc]);
      }
    }
    if (!seen[0][4] || !seen[0][3]) return false;
    for (var i = 0; i < flags.length; i++) if (!seen[flags[i].r][flags[i].c]) return false;
    return true;
  }

  /* baseSeed 用于战役固定关卡；不传则每局全新随机 */
  function generateMap(baseSeed) {
    for (var attempt = 0; attempt < 40; attempt++) {
      var seed = (baseSeed != null ? baseSeed : (Date.now() ^ Math.floor(Math.random() * 0x7fffffff))) + attempt * 7919;
      var rnd = mulberry32(seed);
      /* 战役关卡允许指定地形主题 */
      var template = (baseSeed != null && mapThemeOverride) ? mapThemeOverride : TEMPLATES[Math.floor(rnd() * TEMPLATES.length)];
      var terrain = buildTerrain(template, rnd);
      var flags = makeFlags(terrain);
      if (!isSymmetric(terrain)) continue;
      if (!verifyMap(terrain, flags)) continue;
      return { terrain: terrain, flags: flags, template: template, seed: seed };
    }
    var ft = [], fr, fc;
    for (fr = 0; fr < N; fr++) { ft[fr] = []; for (fc = 0; fc < N; fc++) ft[fr][fc] = 'grass'; }
    return { terrain: ft, flags: makeFlags(ft), template: 'plain', seed: 1 };
  }
  var mapThemeOverride = null;

  /* ---------------- 状态 ---------------- */
  var game = null, phase = 'menu', difficulty = 'normal', diffUI = 'normal';
  var selectedId = null, legal = [], cursor = { r: 7, c: 3 }, keyboardMode = false;
  var busy = false, paused = false;
  var unitAnims = {}, hitFx = null, shotFx = null, flagFx = null, promoFx = null;
  var particles = [], thinking = false, message = '';
  var loopApi = null, unitIdSeq = 1;
  var mapPreview = null;
  var gameToken = 0;
  var spellMode = null;
  var skipStreak = { blue: 0, red: 0 };
  var campaignOn = false, missionIdx = -1, campaignSlow = false;
  var CAMPAIGN_KEY = 'arcade_siege_campaign_v1';

  /* ---------------- DOM ---------------- */
  var wrap = document.createElement('div');
  wrap.className = 'sg-wrap';
  wrap.innerHTML =
    '<div class="sg-head">' +
    '  <div class="sg-turn" id="sg-turn"></div>' +
    '  <div class="sg-hud" id="sg-hud"></div>' +
    '  <button class="sg-btn" id="sg-pause">' + T('gs.siege.pauseBtn') + '</button>' +
    '</div>' +
    '<canvas id="sg-canvas" class="sg-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '<div class="sg-msg" id="sg-msg"></div>' +
    '<div class="sg-spells" id="sg-spells">' +
    '  <button class="sg-spell" data-s="bolt"><i class="sg-ic sg-ic-bolt"></i><span>' + T('gs.siege.spellBolt') + '</span><b id="sp-bolt">1</b></button>' +
    '  <button class="sg-spell" data-s="shield"><i class="sg-ic sg-ic-shield"></i><span>' + T('gs.siege.spellShield') + '</span><b id="sp-shield">1</b></button>' +
    '  <button class="sg-spell" data-s="rally"><i class="sg-ic sg-ic-rally"></i><span>' + T('gs.siege.spellRally') + '</span><b id="sp-rally">1</b></button>' +
    '</div>' +
    '<div class="sg-actions">' +
    '  <span class="sg-tip" id="sg-tip"></span>' +
    '  <button class="sg-btn" id="sg-restart">' + T('gs.siege.restartBtn') + '</button>' +
    '  <button class="sg-btn" id="sg-campaign-btn">' + T('gs.siege.campaignBtn') + '</button>' +
    '  <button class="sg-btn" id="sg-diff">' + T('gs.siege.changeDiff') + '</button>' +
    '</div>' +
    '<p class="help-text">' + T('gs.siege.help') + '</p>' +
    '<div class="sg-overlay hidden" id="sg-menu">' +
    '  <div class="sg-panel">' +
    '    <div class="sg-title">' + T('gs.siege.menuTitle') + '</div>' +
    '    <p class="sg-sub">' + T('gs.siege.menuSub') + '</p>' +
    '    <div class="sg-diffs" id="sg-diffs"></div>' +
    '    <button class="btn green" id="sg-start">' + T('gs.siege.startBtn') + '</button>' +
    '    <button class="btn yellow" id="sg-campaign-open" style="margin-top:10px">' + T('gs.siege.campaignBtn') + '</button>' +
    '  </div>' +
    '</div>' +
    '<div class="sg-overlay hidden" id="sg-campaign">' +
    '  <div class="sg-panel">' +
    '    <div class="sg-title">' + T('gs.siege.campaignTitle') + '</div>' +
    '    <p class="sg-sub" id="sg-campaign-sub"></p>' +
    '    <div class="sg-missions" id="sg-missions"></div>' +
    '    <div class="sg-res-btns" style="margin-top:14px"><button class="btn" id="sg-campaign-close">' + T('gs.siege.closeBtn') + '</button></div>' +
    '  </div>' +
    '</div>' +
    '<div class="sg-overlay hidden" id="sg-result">' +
    '  <div class="sg-panel">' +
    '    <div class="sg-title" id="sg-res-title"></div>' +
    '    <div class="sg-res-stats" id="sg-res-stats"></div>' +
    '    <div class="sg-res-btns" id="sg-res-btns"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="sg-overlay hidden" id="sg-pause-ov">' +
    '  <div class="sg-panel">' +
    '    <div class="sg-title">' + T('gs.siege.pausedTitle') + '</div>' +
    '    <div class="sg-res-btns">' +
    '      <button class="btn green" id="sg-resume">' + T('gs.siege.resumeBtn') + '</button>' +
    '      <button class="btn" id="sg-pause-restart">' + T('gs.siege.restartBtn') + '</button>' +
    '      <button class="btn" id="sg-pause-diff">' + T('gs.siege.changeDiff') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#sg-canvas');
  var gk = GK.setup(canvas, W, H);
  var ctx = gk.ctx;
  var turnEl = wrap.querySelector('#sg-turn');
  var hudEl = wrap.querySelector('#sg-hud');
  var msgEl = wrap.querySelector('#sg-msg');
  var pauseBtn = wrap.querySelector('#sg-pause');
  var restartBtn = wrap.querySelector('#sg-restart');
  var diffBtn = wrap.querySelector('#sg-diff');
  var tipEl = wrap.querySelector('#sg-tip');
  var menuOv = wrap.querySelector('#sg-menu');
  var diffsEl = wrap.querySelector('#sg-diffs');
  var startBtn = wrap.querySelector('#sg-start');
  var resultOv = wrap.querySelector('#sg-result');
  var resTitle = wrap.querySelector('#sg-res-title');
  var resStats = wrap.querySelector('#sg-res-stats');
  var resBtns = wrap.querySelector('#sg-res-btns');
  var pauseOv = wrap.querySelector('#sg-pause-ov');
  var resumeBtn = wrap.querySelector('#sg-resume');
  var pauseRestartBtn = wrap.querySelector('#sg-pause-restart');
  var pauseDiffBtn = wrap.querySelector('#sg-pause-diff');
  var spellsEl = wrap.querySelector('#sg-spells');
  var campaignBtn = wrap.querySelector('#sg-campaign-btn');
  var campaignOpenBtn = wrap.querySelector('#sg-campaign-open');
  var campaignOv = wrap.querySelector('#sg-campaign');
  var campaignSub = wrap.querySelector('#sg-campaign-sub');
  var missionsEl = wrap.querySelector('#sg-missions');
  var campaignClose = wrap.querySelector('#sg-campaign-close');
  var spellCnt = {
    bolt: wrap.querySelector('#sp-bolt'),
    shield: wrap.querySelector('#sp-shield'),
    rally: wrap.querySelector('#sp-rally')
  };

  /* ---------------- 难度 UI ---------------- */
  var DIFFS = [
    { id: 'easy', nameKey: 'gs.siege.diffEasy', descKey: 'gs.siege.diffEasyDesc' },
    { id: 'normal', nameKey: 'gs.siege.diffNormal', descKey: 'gs.siege.diffNormalDesc' },
    { id: 'hard', nameKey: 'gs.siege.diffHard', descKey: 'gs.siege.diffHardDesc' }
  ];
  function buildDiffs() {
    diffsEl.innerHTML = '';
    DIFFS.forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'sg-diff' + (diffUI === d.id ? ' active' : '');
      b.innerHTML = '<strong>' + T(d.nameKey) + '</strong><span>' + T(d.descKey) + '</span>';
      b.addEventListener('click', function () {
        diffUI = d.id;
        buildDiffs();
        if (Arcade.audio) Arcade.audio.play('ui');
      });
      diffsEl.appendChild(b);
    });
  }
  buildDiffs();

  /* ---------------- 战役 ---------------- */
  var MISSIONS = [
    { nameKey: 'gs.siege.m1', diff: 'easy', seed: 10101, theme: 'plain', limit: 40, layout: 'standard' },
    { nameKey: 'gs.siege.m2', diff: 'easy', seed: 20202, theme: 'river', limit: 40, layout: 'standard' },
    { nameKey: 'gs.siege.m3', diff: 'normal', seed: 30303, theme: 'fortress', limit: 60, layout: 'standard' },
    { nameKey: 'gs.siege.m4', diff: 'normal', seed: 40404, theme: 'plain', limit: 60, layout: 'archers' },
    { nameKey: 'gs.siege.m5', diff: 'normal', seed: 50505, theme: 'river', limit: 72, layout: 'archers' },
    { nameKey: 'gs.siege.m6', diff: 'hard', seed: 60606, theme: 'fortress', limit: 65, layout: 'archers' },
    { nameKey: 'gs.siege.m7', diff: 'hard', seed: 70707, theme: 'plain', limit: 65, layout: 'elite' },
    { nameKey: 'gs.siege.m8', diff: 'hard', seed: 80808, theme: 'river', limit: 60, layout: 'elite' }
  ];
  function loadCampaign() {
    try { var v = parseInt(localStorage.getItem(CAMPAIGN_KEY) || '0', 10); return isFinite(v) ? Math.max(0, Math.min(MISSIONS.length, v)) : 0; } catch (e) { return 0; }
  }
  function saveCampaign(n) {
    try { localStorage.setItem(CAMPAIGN_KEY, String(n)); } catch (e) {}
  }
  var campaignDone = loadCampaign();

  /* ---------------- 对局创建 ---------------- */
  function makeUnits(layout) {
    unitIdSeq = 1;
    var arr = [];
    /* 红方坐标 → 蓝方 (7-r, 7-c) 完全镜像，保证开局公平 */
    function pair(type, r, c, extra) {
      arr.push({ id: unitIdSeq++, color: RED, type: type, r: r, c: c, shield: false, extra: !!extra });
      arr.push({ id: unitIdSeq++, color: BLUE, type: type, r: N - 1 - r, c: N - 1 - c, shield: false, extra: !!extra });
    }
    pair('king', 0, 4);
    if (layout === 'archers') {
      pair('soldier', 0, 3); pair('soldier', 0, 5);
      pair('archer', 0, 1); pair('archer', 0, 2); pair('archer', 0, 6); pair('archer', 0, 7);
    } else if (layout === 'elite') {
      pair('soldier', 1, 2); pair('soldier', 1, 5);
      pair('archer', 0, 1); pair('archer', 0, 3); pair('archer', 0, 5); pair('archer', 0, 7);
    } else {
      pair('soldier', 0, 1); pair('soldier', 0, 3); pair('soldier', 0, 5);
      pair('archer', 0, 6);
      pair('soldier', 1, 7);
    }
    return arr;
  }

  function newGame(diff, opts) {
    opts = opts || {};
    difficulty = diff || diffUI || 'normal';
    campaignOn = !!opts.mission;
    missionIdx = opts.mission ? opts.mission.idx : -1;
    campaignSlow = campaignOn && (difficulty === 'hard');
    gameToken++;
    mapThemeOverride = opts.theme || null;
    var map = generateMap(opts.seed);
    mapThemeOverride = null;
    var units = makeUnits(opts.layout || 'standard');
    game = {
      terrain: map.terrain,
      template: map.template,
      seed: map.seed,
      units: units,
      flags: map.flags.map(function (f) { return { r: f.r, c: f.c, owner: null }; }),
      turn: BLUE,
      ply: 0,
      score: { blue: 0, red: 0 },
      winner: null,
      limit: opts.limit || 0,
      mission: opts.mission ? opts.mission.idx : -1,
      spells: { blue: { bolt: 1, shield: 1, rally: 1 }, red: { bolt: 0, shield: 0, rally: 0 } }
    };
    phase = 'playing'; selectedId = null; legal = []; busy = false; paused = false;
    spellMode = null;
    skipStreak = { blue: 0, red: 0 };
    unitAnims = {}; hitFx = null; shotFx = null; flagFx = null; promoFx = null;
    particles = []; thinking = false; message = '';
    keyboardMode = false;
    mapPreview = map;
    cursor = { r: 7, c: 3 };
    hideOverlays();
    updateHud();
    if (Arcade.audio) Arcade.audio.play('ui');
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    var token = gameToken;
    setTimeout(function () {
      if (token === gameToken && phase === 'playing' && !game.winner) {
        toast(campaignOn ? T('gs.siege.msgMission').replace('{n}', String(missionIdx + 1)) : T('gs.siege.msgStart'), true);
      }
    }, 100);
  }

  function startMission(idx) {
    var m = MISSIONS[idx];
    if (!m) return;
    diffUI = m.diff;
    buildDiffs();
    mapThemeOverride = m.theme;
    newGame(m.diff, { seed: m.seed, theme: m.theme, limit: m.limit, layout: m.layout, mission: { idx: idx } });
  }

  function enterMenu() {
    phase = 'menu';
    paused = false; busy = false; thinking = false;
    campaignOn = false; missionIdx = -1; spellMode = null;
    hideOverlays();
    menuOv.classList.remove('hidden');
    mapPreview = generateMap();
    updateHud();
  }

  /* ---------------- 规则 ---------------- */
  function unitAt(g, r, c, exceptId) {
    for (var i = 0; i < g.units.length; i++) {
      var u = g.units[i];
      if (u.id === exceptId) continue;
      if (u.r === r && u.c === c) return u;
    }
    return null;
  }
  function terrainAt(g, r, c) { return g.terrain[r][c]; }
  function isHill(g, r, c) { return g.terrain[r][c] === 'hill'; }

  function actionsForUnit(g, u) {
    var out = [];
    var opp = otherColor(u.color);
    if (u.type === 'king') {
      for (var i = 0; i < 8; i++) {
        var nr = u.r + DIR8[i][0], nc = u.c + DIR8[i][1];
        if (!inB(nr, nc) || !passable(g.terrain, nr, nc)) continue;
        var t = unitAt(g, nr, nc);
        if (t) {
          if (t.color === opp) out.push({ kind: 'attack', unitId: u.id, from: { r: u.r, c: u.c }, to: { r: nr, c: nc }, targetId: t.id });
        } else {
          out.push({ kind: 'move', unitId: u.id, from: { r: u.r, c: u.c }, to: { r: nr, c: nc } });
        }
      }
      return out;
    }
    var f = u.color === BLUE ? -1 : 1;
    var moves = [[f, 0], [0, -1], [0, 1]];
    for (var mi = 0; mi < moves.length; mi++) {
      var mr = u.r + moves[mi][0], mc = u.c + moves[mi][1];
      if (!inB(mr, mc) || !passable(g.terrain, mr, mc)) continue;
      if (unitAt(g, mr, mc)) continue;
      out.push({ kind: 'move', unitId: u.id, from: { r: u.r, c: u.c }, to: { r: mr, c: mc } });
    }
    /* 弓手：直线远程，射程 2（高地 3），中间格必须为空；近身不能攻击 */
    if (u.type === 'archer') {
      var reach = isHill(g, u.r, u.c) ? 3 : 2;
      for (var ad = 2; ad <= reach; ad++) {
        var arow = u.r + f * ad, acol = u.c;
        if (!inB(arow, acol)) continue;
        var blocked = false;
        for (var step = 1; step < ad; step++) {
          var sr = u.r + f * step;
          if (!passable(g.terrain, sr, acol) || unitAt(g, sr, acol)) { blocked = true; break; }
        }
        if (blocked) continue;
        var at = unitAt(g, arow, acol);
        if (at && at.color === opp) {
          out.push({ kind: 'attack', unitId: u.id, from: { r: u.r, c: u.c }, to: { r: arow, c: acol }, targetId: at.id });
        }
      }
      return out;
    }
    var ranges = [1];
    if (isHill(g, u.r, u.c)) ranges.push(2);
    for (var ri = 0; ri < ranges.length; ri++) {
      var dist = ranges[ri];
      for (var s = -1; s <= 1; s += 2) {
        var ar = u.r + f * dist, ac = u.c + s * dist;
        if (!inB(ar, ac) || !passable(g.terrain, ar, ac)) continue;
        if (dist === 2) {
          var midR = u.r + f, midC = u.c + s;
          if (!inB(midR, midC) || !passable(g.terrain, midR, midC)) continue;
          if (unitAt(g, midR, midC)) continue;
        }
        var target = unitAt(g, ar, ac);
        if (target && target.color === opp) {
          out.push({ kind: 'attack', unitId: u.id, from: { r: u.r, c: u.c }, to: { r: ar, c: ac }, targetId: target.id });
        }
      }
    }
    return out;
  }

  function generateActions(g, color) {
    var out = [];
    for (var i = 0; i < g.units.length; i++) {
      if (g.units[i].color !== color) continue;
      out = out.concat(actionsForUnit(g, g.units[i]));
    }
    return out;
  }

  function cloneState(g) {
    return {
      terrain: g.terrain,
      template: g.template,
      seed: g.seed,
      units: g.units.map(function (u) { return { id: u.id, color: u.color, type: u.type, r: u.r, c: u.c, shield: !!u.shield }; }),
      flags: g.flags.map(function (f) { return { r: f.r, c: f.c, owner: f.owner }; }),
      turn: g.turn,
      ply: g.ply,
      score: { blue: g.score.blue, red: g.score.red },
      winner: g.winner,
      limit: g.limit,
      mission: g.mission,
      spells: (function () {
        var sb = (g.spells && g.spells.blue) || {}, sr = (g.spells && g.spells.red) || {};
        return {
          blue: { bolt: sb.bolt || 0, shield: sb.shield || 0, rally: sb.rally || 0 },
          red: { bolt: sr.bolt || 0, shield: sr.shield || 0, rally: sr.rally || 0 }
        };
      })()
    };
  }

  function applyAction(g0, action) {
    var g = cloneState(g0);
    var effects = { promote: false, flag: false, capture: null, winner: null };
    var u = null, i;
    for (i = 0; i < g.units.length; i++) if (g.units[i].id === action.unitId) { u = g.units[i]; break; }
    if (!u) return { state: g, effects: effects };
    if (action.kind === 'move') {
      u.r = action.to.r; u.c = action.to.c;
      if (u.type === 'soldier') {
        var back = u.color === BLUE ? 0 : 7;
        if (u.r === back) { u.type = 'king'; effects.promote = true; }
      }
      for (i = 0; i < g.flags.length; i++) {
        var fl = g.flags[i];
        if (fl.r === u.r && fl.c === u.c && fl.owner !== u.color) {
          fl.owner = u.color;
          g.score[u.color] += 3;
          effects.flag = true;
        }
      }
    } else {
      var target = null;
      for (i = 0; i < g.units.length; i++) if (g.units[i].id === action.targetId) { target = g.units[i]; break; }
      if (target) {
        if (target.shield) {
          /* 护盾抵挡一次攻击 */
          target.shield = false;
          g.score[u.color] += 1;
          effects.shielded = { type: target.type, color: target.color, r: target.r, c: target.c };
        } else {
          var gain = target.type === 'king' ? 10 : 1;
          g.score[u.color] += gain;
          effects.capture = { type: target.type, color: target.color, r: target.r, c: target.c, gain: gain };
          g.units = g.units.filter(function (x) { return x.id !== target.id; });
          if (target.type === 'king') {
            var kingsLeft = g.units.filter(function (x) { return x.color === target.color && x.type === 'king'; }).length;
            if (kingsLeft === 0) { g.winner = u.color; effects.winner = u.color; }
          }
        }
      }
    }
    g.turn = otherColor(u.color);
    g.ply++;
    return { state: g, effects: effects };
  }

  /* ---------------- 评估 ---------------- */
  var EVAL_WEIGHTS = {
    easy: { kingAttack: 120, kingNear: 1.8, kingThreat: 24, kingThreatNear: 3.5, lateMul: 1.4 },
    normal: { kingAttack: 200, kingNear: 3.2, kingThreat: 34, kingThreatNear: 4.5, lateMul: 2.0 },
    hard: { kingAttack: 220, kingNear: 3.4, kingThreat: 42, kingThreatNear: 6, lateMul: 2.1 }
  };
  var evalTier = 'normal';

  function chebDist(a, b) { return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)); }

  /* 到王的可达步数（只看地形，忽略单位阻挡），不可达返回 99 */
  function kingReachMap(g, kr, kc) {
    var dist = [], r, c;
    for (r = 0; r < N; r++) { dist[r] = []; for (c = 0; c < N; c++) dist[r][c] = 99; }
    if (!inB(kr, kc) || !passable(g.terrain, kr, kc)) return dist;
    dist[kr][kc] = 0;
    var queue = [[kr, kc]], qi = 0;
    while (qi < queue.length) {
      var p = queue[qi++];
      var nd = dist[p[0]][p[1]] + 1;
      for (var d = 0; d < 4; d++) {
        var nr = p[0] + [1, -1, 0, 0][d], nc = p[1] + [0, 0, 1, -1][d];
        if (!inB(nr, nc) || dist[nr][nc] < 99 || !passable(g.terrain, nr, nc)) continue;
        dist[nr][nc] = nd; queue.push([nr, nc]);
      }
    }
    return dist;
  }

  function evalState(g, aiColor) {
    if (g.winner) {
      if (g.winner === 'draw') return 0;
      return g.winner === aiColor ? WIN_VALUE : -WIN_VALUE;
    }
    var opp = otherColor(aiColor);
    var w = EVAL_WEIGHTS[evalTier] || EVAL_WEIGHTS.normal;
    var rounds = Math.floor(g.ply / 2);
    /* 残局：双方总兵力锐减，或回合达到上限的一定比例；三档统一提前进入攻王模式，留足收尾回合。
       短回合关卡（每边 40 回合的第 1/2 关）提前到 30%，避免追着随机走位的敌王耗到上限 */
    var lateRatio = (g.limit && g.limit <= 45) ? 0.3 : 0.42;
    var late = g.units.length <= 11 || rounds >= (g.limit ? Math.ceil(g.limit * lateRatio) : 80);
    var lateMul = late ? w.lateMul : 1;
    var v = 0, i, j;
    for (i = 0; i < g.units.length; i++) {
      var u = g.units[i];
      var sign = u.color === aiColor ? 1 : -1;
      var base = u.type === 'king' ? 108 : (u.type === 'archer' ? 14 : 10);
      v += sign * base;
      if (u.type !== 'king') {
        var prog = u.color === BLUE ? (7 - u.r) : u.r;
        v += sign * prog * 1.5;
        /* 升王威胁：逼近对方底线即可升为第二/第三个王，必须在升王前拦截 */
        var promoDist = u.color === BLUE ? u.r : (N - 1 - u.r);
        if (promoDist <= 3) v += sign * (4 - promoDist) * 8;
      }
      if (isHill(g, u.r, u.c)) v += sign * 4;
    }
    for (i = 0; i < g.flags.length; i++) {
      var f = g.flags[i];
      if (f.owner === aiColor) v += 7;
      else if (f.owner === opp) v -= 7;
    }

    var aiKings = [], oppKings = [];
    for (i = 0; i < g.units.length; i++) {
      if (g.units[i].type !== 'king') continue;
      if (g.units[i].color === aiColor) aiKings.push(g.units[i]);
      else oppKings.push(g.units[i]);
    }

    /* 攻王：能直接攻击敌王（含弓手同列射程覆盖）权重最高；护盾王首击只破盾，价值打折 */
    var actCnt = {};
    for (i = 0; i < g.units.length; i++) {
      var e = g.units[i];
      var eActs = actionsForUnit(g, e);
      actCnt[e.id] = eActs.length;
      for (j = 0; j < eActs.length; j++) {
        if (eActs[j].kind !== 'attack') continue;
        var tgt = unitAt(g, eActs[j].to.r, eActs[j].to.c);
        if (!tgt) continue;
        if (e.color === aiColor) {
          if (tgt.type !== 'king') continue;
          v += w.kingAttack * (tgt.shield ? 0.55 : 1) * lateMul;
        } else if (tgt.color === aiColor) {
          if (tgt.type === 'king') v -= w.kingThreat * (tgt.shield ? 0.55 : 1) * (late ? 1.2 : 1);
          /* 己方弓手被敌单位瞄准：弓手是破王的关键火力，尽量别白送 */
          else if (tgt.type === 'archer') v -= 10;
        }
      }
    }

    /* 死角惩罚：无任何合法动作的单位（被墙/自己人堵死）等于废子，评估时提前规避 */
    for (i = 0; i < g.units.length; i++) {
      var su = g.units[i];
      if (actCnt[su.id] === 0) v += (su.color === aiColor ? -8 : 8);
    }

    /* 敌王价值：己方单位越接近敌王、且地形可达，评分越高；残局加权更明显 */
    for (var k = 0; k < oppKings.length; k++) {
      var reach = kingReachMap(g, oppKings[k].r, oppKings[k].c);
      for (i = 0; i < g.units.length; i++) {
        var au = g.units[i];
        if (au.color !== aiColor) continue;
        if (au.type === 'king') {
          var kd0 = chebDist(au, oppKings[k]);
          /* 王不能裸身贴脸：无盾时下回合会被对方王反杀，搜索/反击预判已能识别，
             这里只做轻量提示，避免两王过度保守导致对峙拖到回合耗尽 */
          if (kd0 <= 1 && !au.shield) v -= w.kingAttack * 0.35;
          /* 有盾的王可以强行贴脸换王：贴脸一次挨打破盾，下回合直接斩王 */
          if (kd0 <= 2 && au.shield) v += w.kingAttack * 1.1 * lateMul;
          else if (kd0 <= 4 && au.shield) v += w.kingAttack * 0.45 * lateMul;
          /* 残局允许己王参与追杀：靠近敌王的己王加分，避免双王对峙拖到耗尽 */
          if (late) {
            if (kd0 <= 6) v += w.kingNear * (7 - kd0) * lateMul * 1.0;
          }
          continue;
        }
        var reachD = reach[au.r][au.c];
        var d = reachD < 99 ? reachD : chebDist(au, oppKings[k]) + 3;
        /* 距离梯度全程生效：离敌王越远扣分越多，避免双方在山丘上原地对峙 */
        var over = d - 6;
        if (over > 0) v -= Math.min(24, over * 5) * (late ? lateMul : 1);
        if (d >= 7) continue;
        v += w.kingNear * (7 - d) * lateMul;
        /* 弓手面对可移动的王：奖励进入同列火力位（距王 2~3 行），并避免越过攻击面变成废子 */
        if (au.type === 'archer') {
          var ahead = au.color === BLUE ? (au.r - oppKings[k].r) : (oppKings[k].r - au.r);
          if (ahead >= 2 && ahead <= 3) {
            if (au.c === oppKings[k].c) v += w.kingAttack * 0.35 * lateMul;
            else v += w.kingNear * Math.max(0, 2 - Math.abs(au.c - oppKings[k].c)) * 0.6 * lateMul;
          }
          /* 火力位引导：奖励向"敌王前方 2~3 行、同列"的射击位靠拢，
             避免弓手总差一步、永远对不上会跑的王 */
          var fd = 99, offs = au.color === BLUE ? [2, 3] : [-2, -3];
          for (var oi = 0; oi < offs.length; oi++) {
            var fr = oppKings[k].r + offs[oi];
            if (fr < 0 || fr >= N) continue;
            var mdist = Math.abs(au.r - fr) + Math.abs(au.c - oppKings[k].c);
            if (mdist < fd) fd = mdist;
          }
          if (fd < 99 && fd > 0) v += w.kingAttack * 0.2 * Math.max(0, 1 - fd / 7) * lateMul;
          if (au.color === BLUE ? au.r <= 1 : au.r >= N - 2) v -= 30;
        }
        /* 士兵进入敌王前一行的斜向格 = 可直接斩王的攻击位，提前抢占 */
        if (au.type === 'soldier') {
          var df = au.color === BLUE ? (au.r - oppKings[k].r) : (oppKings[k].r - au.r);
          if (df === 1 && Math.abs(au.c - oppKings[k].c) === 1) v += w.kingAttack * 0.6 * lateMul;
        }
        /* 收口：残局里贴到敌王邻格（哪怕这一手打不到）能封住逃跑格，
           逼它下一手撞进火力位；等级越高越积极，避免王对王永远追不上 */
        if (late && chebDist(au, oppKings[k]) <= 1) v += w.kingAttack * 0.3 * lateMul;
      }
    }

    /* 护王：敌单位靠近己王 / 可攻击己王时扣分，护盾可抵挡一次
       普通/简单档的防守更松（更容易被逼出掩体），保证战役关卡可稳定打下 */
    var defendMul = evalTier === 'hard' ? 1 : 0.2;
    for (i = 0; i < g.units.length; i++) {
      var en = g.units[i];
      if (en.color === aiColor) continue;
      for (var ak = 0; ak < aiKings.length; ak++) {
        var kd = chebDist(en, aiKings[ak]);
        if (kd <= 2) v -= w.kingThreatNear * defendMul * (3 - kd) * (aiKings[ak].shield ? 0.6 : 1);
      }
    }
    return v;
  }

  /* ---------------- AI ---------------- */
  function orderActions(acts) {
    acts.sort(function (a, b) {
      var sa = (a.kind === 'attack' ? 1000 : 0) + (a.promote ? 80 : 0);
      var sb = (b.kind === 'attack' ? 1000 : 0) + (b.promote ? 80 : 0);
      return sb - sa;
    });
    return acts;
  }

  var searchDeadline = 0, searchAbort = false, searchNodes = 0;
  var SEARCH_NODE_LIMIT = 30000;
  var lastSearchDepth = 0, lastSearchMs = 0;
  function search(g, depth, alpha, beta, aiColor) {
    searchNodes++;
    if (Date.now() > searchDeadline || searchNodes > SEARCH_NODE_LIMIT) { searchAbort = true; }
    if (searchAbort) return evalState(g, aiColor);
    if (g.winner) {
      if (g.winner === 'draw') return 0;
      return g.winner === aiColor ? WIN_VALUE + depth : -WIN_VALUE - depth;
    }
    if (depth <= 0) return evalState(g, aiColor);
    var acts = orderActions(generateActions(g, g.turn));
    if (!acts.length) return evalState(g, aiColor);
    var maximizing = g.turn === aiColor;
    var best = maximizing ? -Infinity : Infinity;
    for (var i = 0; i < acts.length; i++) {
      var next = applyAction(g, acts[i]).state;
      var val = search(next, depth - 1, alpha, beta, aiColor);
      if (searchAbort) return evalState(g, aiColor);
      if (maximizing) {
        if (val > best) best = val;
        if (best > alpha) alpha = best;
      } else {
        if (val < best) best = val;
        if (best < beta) beta = best;
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseEasy(acts) {
    if (Math.random() < 0.3) {
      var caps = acts.filter(function (a) { return a.kind === 'attack'; });
      if (caps.length) return caps[Math.floor(Math.random() * caps.length)];
    }
    return acts[Math.floor(Math.random() * acts.length)];
  }

  function chooseNormal(acts, st) {
    var state = st || game;
    var me = state.turn;
    /* 普通档保留少量失误（5%），手感与困难档可区分，又不至于把斩王拖成回合耗尽 */
    if (Math.random() < 0.05) return acts[Math.floor(Math.random() * acts.length)];
    var best = acts[0], bestVal = -Infinity;
    for (var i = 0; i < acts.length; i++) {
      var res = applyAction(state, acts[i]);
      var val = evalState(res.state, me);
      /* 对手最强反击：2 层预判 */
      var replies = generateActions(res.state, otherColor(me));
      var worst = 0;
      for (var j = 0; j < replies.length; j++) {
        if (replies[j].kind !== 'attack') continue;
        var target = null;
        for (var k = 0; k < res.state.units.length; k++) if (res.state.units[k].id === replies[j].targetId) target = res.state.units[k];
        if (!target) continue;
        var gain = target.type === 'king' ? 100 : 10;
        if (gain > worst) worst = gain;
      }
      val -= worst * 0.55;
      if (res.state.winner === me) val += WIN_VALUE;
      if (val > bestVal) { bestVal = val; best = acts[i]; }
    }
    return best;
  }

  function chooseHard(acts, st) {
    var state = st || game;
    var me = state.turn;
    var startedAt = Date.now();
    searchDeadline = startedAt + 300;
    searchAbort = false; searchNodes = 0;
    lastSearchDepth = 0; lastSearchMs = 0;
    var best = acts[0], bestVal = -Infinity;
    var ordered = orderActions(acts.slice()).slice(0, 18);
    for (var depth = 2; depth <= 4; depth++) {
      var localBest = best, localVal = -Infinity;
      searchAbort = false;
      for (var i = 0; i < ordered.length; i++) {
        var next = applyAction(state, ordered[i]).state;
        var val = search(next, depth - 1, -Infinity, Infinity, me);
        if (val > localVal) { localVal = val; localBest = ordered[i]; }
        if (searchAbort) break;
      }
      if (!searchAbort) { best = localBest; bestVal = localVal; lastSearchDepth = depth; }
      if (searchAbort) break;
    }
    lastSearchMs = Date.now() - startedAt;
    return best;
  }

  /* 斩王必胜手：能直接攻击无盾敌王，或有盾王能一步贴到敌王（对方破盾后下回合必被斩） */
  function findKingStrike(st, acts, me) {
    var i, k;
    var oppKings = [];
    for (i = 0; i < st.units.length; i++) if (st.units[i].type === 'king' && st.units[i].color !== me) oppKings.push(st.units[i]);
    if (!oppKings.length) return null;
    for (i = 0; i < acts.length; i++) {
      if (acts[i].kind !== 'attack') continue;
      var t = unitAt(st, acts[i].to.r, acts[i].to.c);
      if (t && t.type === 'king' && !t.shield) return acts[i];
    }
    for (i = 0; i < acts.length; i++) {
      if (acts[i].kind !== 'move') continue;
      var mover = null;
      for (k = 0; k < st.units.length; k++) if (st.units[k].id === acts[i].unitId) { mover = st.units[k]; break; }
      if (!mover || mover.type !== 'king' || !mover.shield) continue;
      for (k = 0; k < oppKings.length; k++) {
        if (chebDist({ r: acts[i].to.r, c: acts[i].to.c }, oppKings[k]) <= 1) return acts[i];
      }
    }
    /* 口袋地形：有盾王距敌王 2 步、但相邻格被 rock/水堵死时，绕行需要 2~3 步。
       用 BFS 找 ≤3 步的贴身路线并走首步，避免双王隔着石头干等到回合耗尽。
       只在进入残局（兵力锐减或回合过半）后启用，避免开局把王提前送上前线 */
    var rounds = Math.floor(st.ply / 2);
    var pocket = st.units.length <= 12 || (st.limit && rounds >= Math.ceil(st.limit * 0.5));
    if (!pocket) return null;
    for (k = 0; k < oppKings.length; k++) {
      var step = kingWrapStep(st, acts, me, oppKings[k]);
      if (step) return step;
    }
    return null;
  }

  /* BFS：己方有盾王绕行到敌王贴身位（≤3 步），返回首步对应的 move 行动 */
  function kingWrapStep(st, acts, me, ek) {
    var myKings = [], i, d;
    for (i = 0; i < st.units.length; i++) {
      if (st.units[i].type === 'king' && st.units[i].color === me && st.units[i].shield) myKings.push(st.units[i]);
    }
    for (var mi = 0; mi < myKings.length; mi++) {
      var start = myKings[mi];
      if (chebDist(start, ek) <= 1) continue;
      var seen = {}, prev = {}, q = [[start.r, start.c, 0]], found = null;
      seen[start.r + ',' + start.c] = true;
      var qi = 0;
      while (qi < q.length && !found) {
        var cur = q[qi++];
        if (cur[2] >= 3) continue;
        for (d = 0; d < 8; d++) {
          var nr = cur[0] + DIR8[d][0], nc = cur[1] + DIR8[d][1];
          if (!inB(nr, nc) || !passable(st.terrain, nr, nc)) continue;
          if (unitAt(st, nr, nc)) continue;
          var key = nr + ',' + nc;
          if (seen[key]) continue;
          seen[key] = true;
          prev[key] = cur[0] + ',' + cur[1];
          if (chebDist({ r: nr, c: nc }, ek) <= 1) { found = key; break; }
          q.push([nr, nc, cur[2] + 1]);
        }
      }
      if (!found) continue;
      /* 回溯到起点，取第一步 */
      var fr = found, back;
      while (prev[fr] !== start.r + ',' + start.c) {
        back = prev[fr];
        if (!back) break;
        fr = back;
      }
      var pr = parseInt(fr.split(',')[0], 10), pc = parseInt(fr.split(',')[1], 10);
      for (i = 0; i < acts.length; i++) {
        if (acts[i].kind !== 'move' || acts[i].unitId !== start.id) continue;
        if (acts[i].to.r === pr && acts[i].to.c === pc) return acts[i];
      }
    }
    return null;
  }

  function chooseDiff(st, acts, diff) {
    if (!acts.length) return null;
    /* 评估权重跟随当前执子档位：easy 仍随机、normal 轻量攻王、hard 搜索且残局加权更强 */
    evalTier = diff || 'normal';
    if (diff === 'easy') return chooseEasy(acts);
    var strike = findKingStrike(st, acts, st.turn);
    if (strike) return strike;
    if (diff === 'normal') return chooseNormal(acts, st);
    return chooseHard(acts, st);
  }

  function chooseAI() {
    var acts = orderActions(generateActions(game, RED));
    if (!acts.length) return null;
    return chooseDiff(game, acts, difficulty);
  }

  var aiGuardTimer = null;
  function scheduleAI() {
    if (phase !== 'playing' || !game || game.winner || game.turn !== RED) return;
    if (paused) { setTimeout(scheduleAI, 300); return; }
    var token = gameToken;
    busy = true; thinking = true; updateHud();
    clearTimeout(aiGuardTimer);
    /* 看门狗：AI 超过 2.2s 仍未落子则强制跳过，绝不允许卡死 */
    aiGuardTimer = setTimeout(function () {
      if (token === gameToken && busy && thinking) {
        thinking = false; busy = false;
        skipNoActions(RED, token);
      }
    }, 2200);
    setTimeout(function () {
      if (token !== gameToken || !thinking) return;
      if (phase !== 'playing' || !game || game.winner) { busy = false; thinking = false; clearTimeout(aiGuardTimer); return; }
      if (paused) { clearTimeout(aiGuardTimer); setTimeout(scheduleAI, 300); return; }
      var act = null;
      try { act = chooseAI(); } catch (e) { act = null; }
      if (!act) {
        /* 兜底：任意合法行动 */
        var acts = orderActions(generateActions(game, RED));
        if (acts.length) act = acts[Math.floor(Math.random() * acts.length)];
      }
      thinking = false;
      clearTimeout(aiGuardTimer);
      if (!act) { skipNoActions(RED, token); return; }
      performAction(act, true);
    }, campaignSlow ? 200 : (difficulty === 'hard' ? 130 : 90));
  }

  /* 无子可动 / AI 超时统一走这里：轮转 + 死锁检测 */
  var aiSkipCount = 0;
  function skipNoActions(color, token) {
    if (token !== gameToken || !game || game.winner) return;
    thinking = false;
    aiSkipCount++;
    skipStreak[color === RED ? 'red' : 'blue']++;
    game.turn = otherColor(color);
    game.ply++;
    busy = true;
    updateHud();
    toast(color === RED ? T('gs.siege.msgSkip') : T('gs.siege.msgSkipBlue'), false);
    if (aiSkipCount >= 6) {
      /* 双方连续无子可动 → 判和，避免无限轮转 */
      game.winner = 'draw';
      setTimeout(function () { if (token === gameToken) endGame(); }, 400);
      return;
    }
    setTimeout(function () {
      if (token !== gameToken) return;
      busy = false;
      finishAction(token);
    }, 340);
  }

  /* ---------------- 执行与动画 ---------------- */
  function cellTextPos(r, c) {
    var p = center(r, c);
    return { x: p.x, y: p.y };
  }

  function performAction(action, isAI) {
    if (!game || game.winner) return;
    var before = null, targetBefore = null, i;
    for (i = 0; i < game.units.length; i++) if (game.units[i].id === action.unitId) { before = { r: game.units[i].r, c: game.units[i].c, type: game.units[i].type, color: game.units[i].color }; break; }
    if (action.kind === 'attack') {
      for (i = 0; i < game.units.length; i++) if (game.units[i].id === action.targetId) { targetBefore = { r: game.units[i].r, c: game.units[i].c, type: game.units[i].type, color: game.units[i].color, shield: !!game.units[i].shield }; break; }
    }
    var res = applyAction(game, action);
    game = res.state;
    aiSkipCount = 0;
    skipStreak = { blue: 0, red: 0 };
    selectedId = null; legal = []; spellMode = null;
    var now = Date.now();
    unitAnims = {};
    if (before && action.kind === 'move') {
      unitAnims[action.unitId] = { fromR: before.r, fromC: before.c, toR: action.to.r, toC: action.to.c, t0: now, dur: 200 };
    }
    if (action.kind === 'attack' && targetBefore) {
      hitFx = { r: targetBefore.r, c: targetBefore.c, color: targetBefore.color, t0: now, dur: 320 };
      shotFx = { fromR: before ? before.r : action.from.r, fromC: before ? before.c : action.from.c, toR: targetBefore.r, toC: targetBefore.c, t0: now, dur: 190, unitId: action.unitId };
      var tp = center(targetBefore.r, targetBefore.c);
      for (var pi = 0; pi < 18; pi++) {
        var ang = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 3.6;
        particles.push({ x: tp.x, y: tp.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.6, life: 1, color: targetBefore.color === BLUE ? '#5df6ff' : '#ff7ab6', size: 1.5 + Math.random() * 2.5 });
      }
      if (Arcade.audio) Arcade.audio.play(targetBefore.type === 'king' ? 'coin' : 'match');
      if (Arcade.fx) Arcade.fx.shake(canvas);
    } else {
      if (Arcade.audio) Arcade.audio.play('move');
    }
    if (res.effects.promote) {
      promoFx = { r: action.to.r, c: action.to.c, t0: now };
      if (Arcade.audio) Arcade.audio.play('coin');
    }
    if (res.effects.flag) {
      flagFx = { r: action.to.r, c: action.to.c, t0: now };
      if (Arcade.audio) Arcade.audio.play('coin');
    }
    if (res.effects.capture) {
      var capName = res.effects.capture.type === 'king' ? T('gs.siege.unitKing')
        : (res.effects.capture.type === 'archer' ? T('gs.siege.unitArcher') : T('gs.siege.unitSoldier'));
      var capMsg = (isAI ? T('gs.siege.enemyCaptured') : T('gs.siege.youCaptured')).replace('{n}', capName);
      toast(capMsg, !isAI);
    } else if (res.effects.shielded) {
      toast(T('gs.siege.shieldBlocked'), true);
    } else if (res.effects.flag) {
      toast(T('gs.siege.flagClaimed'), true);
    } else if (res.effects.promote) {
      toast(T('gs.siege.promoted'), true);
    } else {
      message = '';
    }
    busy = true; thinking = false;
    updateHud();
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
    var delay = res.effects.capture ? 360 : 280;
    var token = gameToken;
    setTimeout(function () { if (token === gameToken) finishAction(token); }, delay);
  }

  function finishAction(token) {
    if (token !== gameToken) return;
    if (paused) { setTimeout(function () { finishAction(token); }, 200); return; }
    busy = false;
    updateHud();
    if (!game) return;
    if (game.winner) { endGame(); return; }
    /* 战役回合上限：超出即判负 */
    if (game.limit && Math.floor(game.ply / 2) >= game.limit) {
      toast(T('gs.siege.msgTimeout'), false);
      game.winner = RED;
      updateHud();
      setTimeout(function () { if (token === gameToken) endGame(); }, 420);
      return;
    }
    var actor = game.turn;
    var acts = generateActions(game, actor);
    if (!acts.length) { skipNoActions(actor, token); return; }
    if (actor === RED) scheduleAI();
    /* 玩家回合：等待输入（若开着法术提示则保留） */
  }

  function endGame() {
    if (!game || !game.winner) return;
    phase = 'over';
    busy = false; thinking = false; selectedId = null; legal = [];
    var win = game.winner === BLUE;
    var draw = game.winner === 'draw';
    if (Arcade.audio) Arcade.audio.play(win ? 'win' : 'lose');
    if (Arcade.juice) {
      if (win) { var p = center(3, 3); Arcade.juice.win(GK.toClient(canvas, p.x, p.y).x, GK.toClient(canvas, p.x, p.y).y); }
      else Arcade.juice.lose();
    }
    if (Arcade.shell) Arcade.shell.submitScore(game.score.blue);
    if (window.Arcade && Arcade.savegame) Arcade.savegame.clear();
    if (win && campaignOn && missionIdx >= 0) {
      if (campaignDone < missionIdx + 1) { campaignDone = missionIdx + 1; saveCampaign(campaignDone); }
    }
    updateHud();
    var token = gameToken;
    setTimeout(function () { if (token === gameToken) showResult(); }, 550);
  }

  function showResult() {
    pauseAll();
    resultOv.classList.remove('hidden');
    var win = game.winner === BLUE;
    var draw = game.winner === 'draw';
    var rounds = Math.ceil(game.ply / 2);
    var timeout = !win && !draw && game.limit > 0 && rounds >= game.limit;
    resTitle.textContent = draw ? T('gs.siege.resultDraw')
      : (win ? T('gs.siege.resultWin') : (timeout ? T('gs.siege.resultTimeout') : T('gs.siege.resultLose')));
    resTitle.className = 'sg-title ' + (win ? 'win' : (draw ? '' : 'fail'));
    var flagsHeld = 0;
    for (var i = 0; i < game.flags.length; i++) if (game.flags[i].owner === BLUE) flagsHeld++;
    var allDone = campaignOn && win && missionIdx === MISSIONS.length - 1;
    resStats.innerHTML =
      (campaignOn ? '<span>' + T('gs.siege.resMission') + ' <b>' + (missionIdx + 1) + ' · ' + T(MISSIONS[missionIdx] ? MISSIONS[missionIdx].nameKey : 'gs.siege.m1') + '</b></span>' : '') +
      '<span>' + T('gs.siege.resRounds') + ' <b>' + rounds + (game.limit ? ' / ' + game.limit : '') + '</b></span>' +
      (timeout ? '<span>' + T('gs.siege.resTimeout') + '</span>' : '') +
      '<span>' + T('gs.siege.resFlags') + ' <b>' + flagsHeld + ' / ' + game.flags.length + '</b></span>' +
      '<span>' + T('gs.siege.resScore') + ' <b>' + game.score.blue + '</b></span>' +
      '<span>' + T('gs.siege.resEnemyScore') + ' <b>' + game.score.red + '</b></span>' +
      (allDone ? '<span><b>' + T('gs.siege.resCampaignDone') + '</b></span>' : '');
    resBtns.innerHTML = '';
    if (campaignOn && win && missionIdx + 1 < MISSIONS.length) {
      var nextIdx = missionIdx + 1;
      addResBtn('btn green', T('gs.siege.nextMission'), function () {
        if (nextIdx <= campaignDone) startMission(nextIdx);
        else openCampaign();
      });
      addResBtn('btn', T('gs.siege.retryMission'), function () { startMission(missionIdx); });
      addResBtn('btn', T('gs.siege.campaignBtn'), function () { openCampaign(); });
    } else if (campaignOn) {
      addResBtn('btn green', T('gs.siege.retryMission'), function () { startMission(missionIdx); });
      addResBtn('btn', T('gs.siege.campaignBtn'), function () { openCampaign(); });
    } else {
      addResBtn('btn green', T('gs.siege.playAgain'), function () { newGame(difficulty); });
      addResBtn('btn', T('gs.siege.changeDiff'), function () { hideOverlays(); diffUI = difficulty; buildDiffs(); enterMenu(); });
    }
  }

  function addResBtn(cls, label, fn) {
    var b = document.createElement('button');
    b.className = cls; b.textContent = label;
    b.addEventListener('click', function () {
      hideOverlays();
      if (Arcade.audio) Arcade.audio.play('ui');
      fn();
    });
    resBtns.appendChild(b);
  }

  /* ---------------- 战役地图 ---------------- */
  function openCampaign() {
    menuOv.classList.add('hidden');
    resultOv.classList.add('hidden');
    pauseOv.classList.add('hidden');
    if (phase === 'playing' || phase === 'over' || phase === 'paused') pauseAll();
    else paused = false;
    campaignOv.classList.remove('hidden');
    renderCampaign();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function renderCampaign() {
    campaignDone = loadCampaign();
    if (campaignDone >= MISSIONS.length) {
      campaignSub.textContent = T('gs.siege.campaignAllDoneSub');
      campaignSub.style.color = 'var(--neon-green)';
    } else {
      campaignSub.textContent = T('gs.siege.campaignSub').replace('{n}', String(campaignDone)).replace('{t}', String(MISSIONS.length));
      campaignSub.style.color = '';
    }
    missionsEl.innerHTML = '';
    MISSIONS.forEach(function (m, idx) {
      var unlocked = idx <= campaignDone;
      var done = idx < campaignDone;
      var b = document.createElement('button');
      b.className = 'sg-mission' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
      b.disabled = !unlocked;
      b.innerHTML = '<b>' + (idx + 1) + '</b><span>' + T(m.nameKey) + '</span><em>' +
        T('gs.siege.diff' + m.diff.charAt(0).toUpperCase() + m.diff.slice(1)) + ' · ' + m.limit + '</em>';
      b.addEventListener('click', function () {
        if (!unlocked) { toast(T('gs.siege.missionLocked'), false); return; }
        campaignOv.classList.add('hidden');
        resumeAll();
        startMission(idx);
      });
      missionsEl.appendChild(b);
    });
  }

  function closeCampaign() {
    campaignOv.classList.add('hidden');
    if (phase === 'menu') { enterMenu(); return; }
    if (phase === 'over' && game) { showResult(); return; }
    if (phase === 'playing') { resumeAll(); }
  }

  /* ---------------- 法术 ---------------- */
  function spellReady() {
    return phase === 'playing' && !paused && !busy && game && !game.winner && game.turn === BLUE && game.spells;
  }

  function setSpellMode(mode) {
    if (!spellReady()) return;
    if (!game.spells.blue[mode]) { toast(T('gs.siege.noSpell'), false); return; }
    spellMode = (spellMode === mode) ? null : mode;
    if (spellMode === 'bolt') toast(T('gs.siege.aimBolt'), true);
    else if (spellMode === 'shield') toast(T('gs.siege.aimShield'), true);
    else if (spellMode === 'rally') toast(T('gs.siege.aimRally'), true);
    else { message = ''; msgEl.textContent = ''; }
    if (Arcade.audio) Arcade.audio.play('ui');
    updateHud();
  }

  /* 纯状态结算：实际对局与 QA 模拟共用，保证规则只有一份实现 */
  function applySpellToState(g0, mode, r, c) {
    if (!g0 || !g0.spells || !g0.spells.blue || !g0.spells.blue[mode]) return { ok: false, reason: 'empty' };
    var g = cloneState(g0);
    var u = unitAt(g, r, c);
    var info = { mode: mode, unitId: 0 };
    if (mode === 'bolt') {
      if (!u || u.color !== RED || u.type === 'king') return { ok: false, reason: 'badTarget' };
      g.score.blue += u.type === 'archer' ? 2 : 1;
      g.units = g.units.filter(function (x) { return x.id !== u.id; });
      info.kind = 'bolt';
      info.target = { type: u.type, r: r, c: c };
    } else if (mode === 'shield') {
      if (!u || u.color !== BLUE || u.shield) return { ok: false, reason: 'badTarget' };
      u.shield = true;
      info.kind = 'shield';
      info.target = { type: u.type, r: r, c: c };
    } else if (mode === 'rally') {
      if (u || !passable(g.terrain, r, c) || (r !== 7 && r !== 6)) return { ok: false, reason: 'badTarget' };
      var nid = 1;
      for (var i = 0; i < g.units.length; i++) if (g.units[i].id > nid) nid = g.units[i].id;
      nid++;
      g.units.push({ id: nid, color: BLUE, type: 'soldier', r: r, c: c, shield: false });
      info.kind = 'rally';
      info.at = { r: r, c: c };
      info.unitId = nid;
    } else {
      return { ok: false, reason: 'badTarget' };
    }
    g.spells.blue[mode]--;
    if (g.spells.blue[mode] < 0) g.spells.blue[mode] = 0;
    g.turn = RED;
    g.ply++;
    return { ok: true, state: g, info: info };
  }

  function consumeSpellAction() {
    spellMode = null; selectedId = null; legal = [];
    busy = true; updateHud();
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
    var token = gameToken;
    setTimeout(function () { if (token === gameToken) finishAction(token); }, 420);
  }

  function castSpellAt(r, c) {
    if (!spellReady() || !spellMode) return false;
    var mode = spellMode;
    var res = applySpellToState(game, mode, r, c);
    var p, i, ang, sp;
    if (!res.ok) {
      toast(res.reason === 'empty' ? T('gs.siege.noSpell')
        : (mode === 'bolt' ? T('gs.siege.aimBoltBad') : mode === 'shield' ? T('gs.siege.aimShieldBad') : T('gs.siege.aimRallyBad')), false);
      return true;
    }
    game = res.state;
    if (res.info.unitId >= unitIdSeq) unitIdSeq = res.info.unitId + 1;
    if (res.info.kind === 'bolt') {
      p = center(r, c);
      for (i = 0; i < 26; i++) {
        ang = Math.random() * Math.PI * 2; sp = 1 + Math.random() * 4.2;
        particles.push({ x: p.x, y: p.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, color: '#9b6bff', size: 1.4 + Math.random() * 2.6 });
      }
      hitFx = { r: r, c: c, color: RED, t0: Date.now(), dur: 380 };
      if (Arcade.audio) Arcade.audio.play('match');
      if (Arcade.fx) Arcade.fx.shake(canvas);
      toast(T('gs.siege.castBolt'), true);
    } else if (res.info.kind === 'shield') {
      p = center(r, c);
      particles.push({ x: p.x, y: p.y, vx: 0, vy: -0.6, life: 1, color: '#39ff14', size: 3 });
      if (Arcade.audio) Arcade.audio.play('coin');
      toast(T('gs.siege.castShield'), true);
    } else if (res.info.kind === 'rally') {
      p = center(r, c);
      for (i = 0; i < 16; i++) {
        ang = Math.random() * Math.PI * 2;
        particles.push({ x: p.x, y: p.y, vx: Math.cos(ang) * 2, vy: Math.sin(ang) * 2, life: 1, color: '#00f0ff', size: 1.4 + Math.random() * 2 });
      }
      if (Arcade.audio) Arcade.audio.play('coin');
      toast(T('gs.siege.castRally'), true);
    }
    consumeSpellAction();
    return true;
  }

  function updateSpellBar() {
    var on = !!game && phase === 'playing' && game.spells;
    spellsEl.classList.toggle('disabled', !on);
    ['bolt', 'shield', 'rally'].forEach(function (k) {
      var el = spellCnt[k];
      if (!el) return;
      var n = on ? game.spells.blue[k] : 0;
      el.textContent = String(n);
      var btn = el.parentNode;
      btn.classList.toggle('empty', n <= 0);
      btn.classList.toggle('armed', spellMode === k);
      btn.disabled = !on || n <= 0;
    });
  }

  /* ---------------- 暂停 / 遮罩 ---------------- */
  function pauseAll() {
    if (!paused) { paused = true; if (loopApi) loopApi.pause(); }
  }
  function resumeAll() {
    paused = false;
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }
  function togglePause() {
    if (phase !== 'playing') return;
    if (!paused) {
      pauseAll();
      pauseOv.classList.remove('hidden');
    } else {
      pauseOv.classList.add('hidden');
      resumeAll();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function hideOverlays() {
    menuOv.classList.add('hidden');
    resultOv.classList.add('hidden');
    pauseOv.classList.add('hidden');
    campaignOv.classList.add('hidden');
    resumeAll();
  }

  function toast(text, ok) {
    message = text;
    msgEl.textContent = text;
    msgEl.style.color = ok ? 'var(--neon-green)' : 'var(--neon-pink)';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      if (msgEl.textContent === text) { msgEl.textContent = ''; message = ''; }
    }, 2600);
  }

  /* ---------------- HUD ---------------- */
  function templateName(g) {
    if (!g) return '';
    if (g.template === 'river') return T('gs.siege.mapRiver');
    if (g.template === 'fortress') return T('gs.siege.mapFortress');
    return T('gs.siege.mapPlain');
  }
  function updateHud() {
    updateSpellBar();
    if (!game || phase === 'menu') {
      turnEl.textContent = T('gs.siege.menuTitle');
      hudEl.innerHTML = '<span>' + T('gs.siege.hudHint') + '</span>';
      return;
    }
    var flagsB = 0, flagsR = 0;
    game.flags.forEach(function (f) { if (f.owner === BLUE) flagsB++; else if (f.owner === RED) flagsR++; });
    turnEl.textContent = thinking ? T('gs.siege.thinking') : (game.turn === BLUE ? T('gs.siege.turnBlue') : T('gs.siege.turnRed'));
    turnEl.className = 'sg-turn ' + (game.turn === BLUE ? 'blue' : 'red');
    hudEl.innerHTML =
      (campaignOn ? '<span>' + T('gs.siege.hudMission') + ' <b>' + (missionIdx + 1) + '/' + MISSIONS.length + '</b></span>' : '') +
      '<span>' + T('gs.siege.hudRound') + ' <b>' + Math.ceil(game.ply / 2) + (game.limit ? '/' + game.limit : '') + '</b></span>' +
      '<span>' + T('gs.siege.hudScore') + ' <b>' + game.score.blue + '</b></span>' +
      '<span>' + T('gs.siege.hudFlags') + ' <b>' + flagsB + ':' + flagsR + '</b></span>' +
      '<span>' + T('gs.siege.hudDiff') + ' <b>' + T('gs.siege.diff' + (difficulty.charAt(0).toUpperCase() + difficulty.slice(1))) + '</b></span>' +
      '<span>' + T('gs.siege.hudMap') + ' <b>' + templateName(game) + '</b></span>';
  }

  /* ---------------- 交互 ---------------- */
  function setSelection(id) {
    selectedId = id;
    legal = [];
    if (!id) return;
    var u = null;
    for (var i = 0; i < game.units.length; i++) if (game.units[i].id === id) { u = game.units[i]; break; }
    if (!u || u.color !== BLUE) { selectedId = null; return; }
    legal = actionsForUnit(game, u);
  }

  function handleCell(r, c) {
    if (phase !== 'playing' || paused || busy || game.turn !== BLUE || game.winner) return;
    if (spellMode) { castSpellAt(r, c); return; }
    if (selectedId) {
      for (var i = 0; i < legal.length; i++) {
        if (legal[i].to.r === r && legal[i].to.c === c) {
          if (Arcade.audio) Arcade.audio.play('ui');
          performAction(legal[i], false);
          return;
        }
      }
    }
    var u = unitAt(game, r, c);
    if (u && u.color === BLUE) {
      setSelection(u.id);
      if (Arcade.audio) Arcade.audio.play('ui');
      keyboardMode = false;
      updateHud();
      return;
    }
    selectedId = null; legal = [];
    updateHud();
  }

  function boardCellFromEvent(ev) {
    var p = GK.pointer(canvas, ev);
    var c = Math.floor((p.x - PAD) / CS);
    var r = Math.floor((p.y - PAD) / CS);
    if (!inB(r, c)) return null;
    return { r: r, c: c };
  }

  canvas.addEventListener('pointerdown', function (ev) {
    if (phase !== 'playing' || paused || busy) return;
    ev.preventDefault();
    var cell = boardCellFromEvent(ev);
    if (!cell) return;
    keyboardMode = false;
    cursor = { r: cell.r, c: cell.c };
    handleCell(cell.r, cell.c);
  });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (e.code === 'Escape' && phase === 'playing' && !paused) {
        if (spellMode) { spellMode = null; msgEl.textContent = ''; message = ''; updateHud(); return; }
        if (selectedId) { selectedId = null; legal = []; updateHud(); return; }
      }
      e.preventDefault(); togglePause(); return;
    }
    if (phase === 'playing' && !paused) {
      if (e.code === 'Digit1') { e.preventDefault(); setSpellMode('bolt'); return; }
      if (e.code === 'Digit2') { e.preventDefault(); setSpellMode('shield'); return; }
      if (e.code === 'Digit3') { e.preventDefault(); setSpellMode('rally'); return; }
    }
    if (phase !== 'playing' || paused || busy) return;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault(); keyboardMode = true;
      if (e.code === 'ArrowUp') cursor.r = clampCell(cursor.r - 1);
      else if (e.code === 'ArrowDown') cursor.r = clampCell(cursor.r + 1);
      else if (e.code === 'ArrowLeft') cursor.c = clampCell(cursor.c - 1);
      else cursor.c = clampCell(cursor.c + 1);
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (!keyboardMode) return;
      e.preventDefault();
      handleCell(cursor.r, cursor.c);
    }
  });

  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', function () {
    if (campaignOn && missionIdx >= 0) startMission(missionIdx);
    else newGame(difficulty);
  });
  diffBtn.addEventListener('click', function () { diffUI = difficulty; buildDiffs(); enterMenu(); });
  startBtn.addEventListener('click', function () { newGame(diffUI); });
  campaignBtn.addEventListener('click', openCampaign);
  campaignOpenBtn.addEventListener('click', openCampaign);
  campaignClose.addEventListener('click', closeCampaign);
  spellsEl.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('.sg-spell') : null;
    if (!b) return;
    setSpellMode(b.getAttribute('data-s'));
  });
  resumeBtn.addEventListener('click', function () { pauseOv.classList.add('hidden'); resumeAll(); });
  pauseRestartBtn.addEventListener('click', function () { pauseOv.classList.add('hidden'); if (campaignOn && missionIdx >= 0) startMission(missionIdx); else newGame(difficulty); });
  pauseDiffBtn.addEventListener('click', function () { pauseOv.classList.add('hidden'); diffUI = difficulty; buildDiffs(); enterMenu(); });

  window.GAME_RESTART = function () {
    if (phase === 'playing' || phase === 'paused') newGame(difficulty);
    else enterMenu();
  };

  /* ---------------- 绘制 ---------------- */
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  function drawBackdrop(now) {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070b17');
    bg.addColorStop(0.55, '#0a1020');
    bg.addColorStop(1, '#0d0917');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    var rad = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
    rad.addColorStop(0, 'rgba(120,60,220,0.09)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);
    /* 边框光 */
    ctx.strokeStyle = 'rgba(0,240,255,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD - 2, PAD - 2, W - PAD * 2 + 4, H - PAD * 2 + 4);
  }

  function drawTile(r, c, now) {
    var g = game || { terrain: mapPreview ? mapPreview.terrain : null };
    var terrain = g.terrain ? g.terrain[r][c] : 'grass';
    var x = PAD + c * CS, y = PAD + r * CS;
    if (terrain === 'grass') {
      var gg = ctx.createLinearGradient(x, y, x, y + CS);
      gg.addColorStop(0, (r + c) % 2 ? '#14251d' : '#16291f');
      gg.addColorStop(1, '#0b1712');
      ctx.fillStyle = gg;
      ctx.fillRect(x, y, CS, CS);
      ctx.strokeStyle = 'rgba(90,160,120,0.06)';
      ctx.strokeRect(x + 0.5, y + 0.5, CS - 1, CS - 1);
    } else if (terrain === 'hill') {
      var hg = ctx.createLinearGradient(x, y, x, y + CS);
      hg.addColorStop(0, '#3d4a24');
      hg.addColorStop(1, '#1c2814');
      ctx.fillStyle = hg;
      ctx.fillRect(x, y, CS, CS);
      ctx.strokeStyle = 'rgba(190,230,120,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + CS / 2, y + CS * 0.72, CS * 0.32, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(170,210,100,0.16)';
      ctx.beginPath();
      ctx.arc(x + CS / 2, y + CS * 0.74, CS * 0.18, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,210,0.06)';
      ctx.fillRect(x + 3, y + 3, CS - 6, 2);
    } else if (terrain === 'water') {
      var wg = ctx.createLinearGradient(x, y, x, y + CS);
      wg.addColorStop(0, '#0c3550');
      wg.addColorStop(0.5, '#0a2439');
      wg.addColorStop(1, '#06141f');
      ctx.fillStyle = wg;
      ctx.fillRect(x, y, CS, CS);
      ctx.strokeStyle = 'rgba(80,190,255,0.22)';
      ctx.lineWidth = 1;
      for (var w = 0; w < 3; w++) {
        var yy = y + 12 + w * 15;
        var off = Math.sin(now / 420 + r * 1.5 + c + w) * 4;
        ctx.beginPath();
        ctx.moveTo(x + 4 + off, yy);
        ctx.lineTo(x + CS - 4 + off, yy);
        ctx.stroke();
      }
    } else {
      var rg = ctx.createLinearGradient(x, y, x + CS, y + CS);
      rg.addColorStop(0, '#4a4f5e');
      rg.addColorStop(0.5, '#30343f');
      rg.addColorStop(1, '#171a23');
      ctx.fillStyle = rg;
      ctx.fillRect(x, y, CS, CS);
      ctx.strokeStyle = 'rgba(10,10,16,0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 14); ctx.lineTo(x + CS * 0.55, y + CS * 0.45);
      ctx.lineTo(x + CS * 0.4, y + CS - 9);
      ctx.moveTo(x + CS * 0.55, y + CS * 0.45); ctx.lineTo(x + CS - 8, y + CS * 0.6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 3, y + 3, CS - 6, 2);
    }
  }

  function drawFlags(now) {
    if (!game) return;
    for (var i = 0; i < game.flags.length; i++) {
      var f = game.flags[i];
      var p = center(f.r, f.c);
      var owner = f.owner;
      var col = owner === BLUE ? '#00f0ff' : owner === RED ? '#ff2d95' : '#c8d6e5';
      ctx.save();
      ctx.strokeStyle = 'rgba(220,235,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - 10, p.y + 14); ctx.lineTo(p.x - 10, p.y - 12); ctx.stroke();
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y - 12);
      ctx.quadraticCurveTo(p.x + 6 + Math.sin(now / 260 + i) * 4, p.y - 8, p.x + 12, p.y - 2);
      ctx.quadraticCurveTo(p.x + 3, p.y - 1, p.x - 9, p.y - 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      if (owner) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '8px monospace'; ctx.textAlign = 'center';
        ctx.fillText(owner === BLUE ? 'B' : 'R', p.x + 1, p.y - 6);
      }
    }
  }

  function unitPos(u, now) {
    var a = unitAnims[u.id];
    if (!a) return center(u.r, u.c);
    var t = Math.min(1, (now - a.t0) / a.dur);
    var e = easeOut(t);
    var pa = center(a.fromR, a.fromC), pb = center(a.toR, a.toC);
    return { x: pa.x + (pb.x - pa.x) * e, y: pa.y + (pb.y - pa.y) * e, t: t };
  }

  function drawUnit(u, now) {
    var p = unitPos(u, now);
    /* 攻击冲刺：出手瞬间向目标方向前探再回弹 */
    var lunge = 0;
    if (shotFx && shotFx.unitId === u.id) {
      var st = (now - shotFx.t0) / shotFx.dur;
      if (st > 0 && st < 1) lunge = Math.sin(Math.PI * st) * 0.3;
    }
    if (lunge > 0) {
      var tc = center(shotFx.toR, shotFx.toC);
      p = { x: p.x + (tc.x - p.x) * lunge, y: p.y + (tc.y - p.y) * lunge };
    }
    var isSel = u.id === selectedId;
    var onHill = game && isHill(game, u.r, u.c);
    var y = p.y - (onHill ? 3 : 0) + Math.sin(now / 300 + u.id) * 0.7;
    var col = u.color === BLUE ? '#00e5ff' : '#ff4d9a';
    var dark = u.color === BLUE ? '#04526b' : '#6b0f38';
    /* 阴影 */
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 17, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (isSel) {
      ctx.save();
      ctx.strokeStyle = '#ffe600';
      ctx.shadowColor = 'rgba(255,230,0,0.9)';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, y + 2, CS * 0.4 + Math.sin(now / 180) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (u.shield) {
      ctx.save();
      var sp = 0.5 + 0.5 * Math.sin(now / 200 + u.id);
      ctx.strokeStyle = 'rgba(57,255,20,' + (0.55 + 0.3 * sp) + ')';
      ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, y + 2, CS * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.14 + 0.08 * sp;
      ctx.fillStyle = '#39ff14';
      ctx.beginPath(); ctx.arc(p.x, y + 2, CS * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = isSel ? 18 : 9;
    var bodyGrad = ctx.createLinearGradient(p.x, y - 18, p.x, y + 16);
    bodyGrad.addColorStop(0, col); bodyGrad.addColorStop(0.55, dark); bodyGrad.addColorStop(1, '#050b12');
    ctx.fillStyle = bodyGrad;
    if (u.type === 'king') {
      /* 王冠 */
      ctx.beginPath();
      ctx.moveTo(p.x - 13, y - 14);
      ctx.lineTo(p.x - 8, y - 22);
      ctx.lineTo(p.x - 3, y - 15);
      ctx.lineTo(p.x, y - 24);
      ctx.lineTo(p.x + 3, y - 15);
      ctx.lineTo(p.x + 8, y - 22);
      ctx.lineTo(p.x + 13, y - 14);
      ctx.closePath();
      ctx.fillStyle = '#ffe600';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.stroke();
      /* 身体 */
      ctx.fillStyle = bodyGrad;
      GK.roundRect(ctx, p.x - 12, y - 10, 24, 28, 6);
      ctx.fill();
    } else if (u.type === 'archer') {
      /* 弓手：尖兜帽 + 长弓 */
      GK.roundRect(ctx, p.x - 11, y - 10, 22, 27, 7);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(p.x - 10, y - 6);
      ctx.lineTo(p.x, y - 22);
      ctx.lineTo(p.x + 10, y - 6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x - 10, y - 6); ctx.lineTo(p.x + 10, y - 6); ctx.stroke();
      /* 长弓（弯月弧 + 弦） */
      ctx.strokeStyle = 'rgba(255,240,170,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + 11, y + 2, 11, -Math.PI * 0.62, Math.PI * 0.62);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + 14.6, y - 8.5);
      ctx.lineTo(p.x + 14.6, y + 12.5);
      ctx.stroke();
    } else {
      /* 士兵圆盾身体 */
      GK.roundRect(ctx, p.x - 11, y - 10, 22, 27, 7);
      ctx.fill();
      /* 头盔 */
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.arc(p.x, y - 9, 9, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(p.x - 9, y - 2, 18, 3);
    }
    ctx.restore();
    /* 眼睛 */
    ctx.fillStyle = '#effcff';
    ctx.beginPath();
    ctx.arc(p.x - 4, y - 1, 1.6, 0, Math.PI * 2);
    ctx.arc(p.x + 4, y - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLegal(now) {
    if (!selectedId || !game) return;
    for (var i = 0; i < legal.length; i++) {
      var a = legal[i];
      var p = center(a.to.r, a.to.c);
      var pulse = 0.5 + 0.5 * Math.sin(now / 160 + i);
      if (a.kind === 'move') {
        ctx.fillStyle = 'rgba(57,255,20,' + (0.25 + 0.25 * pulse) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, 7 + pulse * 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(57,255,20,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 11 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,45,149,' + (0.55 + 0.3 * pulse) + ')';
        ctx.shadowColor = 'rgba(255,45,149,0.9)'; ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 13 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6);
        ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawFx(now) {
    if (shotFx) {
      var t = (now - shotFx.t0) / shotFx.dur;
      if (t >= 1) shotFx = null;
      else {
        var a = center(shotFx.fromR, shotFx.fromC), b = center(shotFx.toR, shotFx.toC);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,240,150,' + (0.9 * (1 - t)) + ')';
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (hitFx) {
      var ht = (now - hitFx.t0) / hitFx.dur;
      if (ht >= 1) hitFx = null;
      else {
        var hp = center(hitFx.r, hitFx.c);
        ctx.save();
        /* 受击格闪红 */
        ctx.globalAlpha = Math.max(0, 0.45 * (1 - ht));
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(hp.x - CS / 2, hp.y - CS / 2, CS, CS);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - ht);
        ctx.fillStyle = hitFx.color === BLUE ? '#5df6ff' : '#ff2d95';
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 10 + ht * 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 14 + ht * 22, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    if (flagFx) {
      var ft = (now - flagFx.t0) / 700;
      if (ft >= 1) flagFx = null;
      else {
        var fp = center(flagFx.r, flagFx.c);
        ctx.save();
        ctx.globalAlpha = 1 - ft;
        ctx.fillStyle = '#ffe600';
        ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText('+3', fp.x, fp.y - 18 - ft * 18);
        ctx.restore();
      }
    }
    if (promoFx) {
      var pt = (now - promoFx.t0) / 900;
      if (pt >= 1) promoFx = null;
      else {
        var pp = center(promoFx.r, promoFx.c);
        ctx.save();
        ctx.globalAlpha = 1 - pt;
        ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pp.x, pp.y, 12 + pt * 24, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawKeyboardCursor() {
    if (!keyboardMode) return;
    var p = center(cursor.r, cursor.c);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,0,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(p.x - CS / 2 + 2, p.y - CS / 2 + 2, CS - 4, CS - 4);
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* 法术瞄准高亮：让触控玩家清楚哪些格子可用 */
  function drawSpellTargets(now) {
    if (!spellMode || !game || phase !== 'playing') return;
    var pulse = 0.5 + 0.5 * Math.sin(now / 180);
    var r, c, p;
    if (spellMode === 'rally') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,240,255,' + (0.3 + 0.3 * pulse) + ')';
      ctx.lineWidth = 1.5;
      for (r = 6; r <= 7; r++) {
        for (c = 0; c < N; c++) {
          if (!passable(game.terrain, r, c) || unitAt(game, r, c)) continue;
          p = center(r, c);
          ctx.strokeRect(p.x - CS / 2 + 3, p.y - CS / 2 + 3, CS - 6, CS - 6);
        }
      }
      ctx.restore();
      return;
    }
    for (var i = 0; i < game.units.length; i++) {
      var u = game.units[i];
      var ok = spellMode === 'bolt' ? (u.color === RED && u.type !== 'king') : (u.color === BLUE && !u.shield);
      if (!ok) continue;
      p = center(u.r, u.c);
      ctx.save();
      ctx.strokeStyle = spellMode === 'bolt' ? 'rgba(155,107,255,' + (0.5 + 0.4 * pulse) + ')' : 'rgba(57,255,20,' + (0.5 + 0.4 * pulse) + ')';
      ctx.shadowColor = spellMode === 'bolt' ? '#9b6bff' : '#39ff14';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, CS * 0.46, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function draw(now) {
    now = now || Date.now();
    drawBackdrop(now);
    if (game) {
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) drawTile(r, c, now);
      drawFlags(now);
      drawSpellTargets(now);
      drawLegal(now);
      for (var i = 0; i < game.units.length; i++) drawUnit(game.units[i], now);
      drawFx(now);
      drawParticles();
      drawKeyboardCursor();
      if (thinking) {
        ctx.fillStyle = 'rgba(255,90,150,0.9)';
        ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(T('gs.siege.thinking'), W / 2, H - 6);
      }
    } else if (mapPreview) {
      for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) drawTile(r2, c2, now);
    }
  }

  /* ---------------- 更新 ---------------- */
  function update() {
    if (paused) return;
    var now = Date.now();
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.02;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (message && msgEl.textContent !== message) msgEl.textContent = message;
    if (game && now - lastHudTick > 500) { lastHudTick = now; updateHud(); }
  }
  var lastHudTick = 0;

  /* ---------------- 断点续玩（沿用 arcade_save_siege 键） ---------------- */
  function collectSave() {
    if (!game || phase !== 'playing' || game.winner) return null;
    return {
      terrain: game.terrain,
      template: game.template,
      seed: game.seed,
      units: game.units.map(function (u) { return { id: u.id, color: u.color, type: u.type, r: u.r, c: u.c, shield: !!u.shield }; }),
      flags: game.flags,
      turn: game.turn,
      ply: game.ply,
      score: game.score,
      limit: game.limit,
      spells: game.spells,
      difficulty: difficulty,
      campaignOn: campaignOn,
      missionIdx: missionIdx
    };
  }

  function applySave(s) {
    if (!s || !Array.isArray(s.terrain) || s.terrain.length !== N) return false;
    for (var r = 0; r < N; r++) if (!Array.isArray(s.terrain[r]) || s.terrain[r].length !== N) return false;
    if (!Array.isArray(s.units) || !s.units.length) return false;
    if (s.turn !== BLUE && s.turn !== RED) return false;
    var okUnits = true;
    s.units.forEach(function (u) {
      if (!u || (u.color !== BLUE && u.color !== RED)) okUnits = false;
      if (u.type !== 'king' && u.type !== 'soldier' && u.type !== 'archer') okUnits = false;
      if (!inB(u.r, u.c)) okUnits = false;
    });
    if (!okUnits) return false;
    difficulty = (s.difficulty === 'easy' || s.difficulty === 'normal' || s.difficulty === 'hard') ? s.difficulty : 'normal';
    diffUI = difficulty;
    campaignOn = !!s.campaignOn;
    missionIdx = campaignOn ? (Number(s.missionIdx) || 0) : -1;
    game = {
      terrain: s.terrain,
      template: s.template || 'plain',
      seed: s.seed,
      units: s.units.map(function (u) { return { id: u.id, color: u.color, type: u.type, r: u.r, c: u.c, shield: !!u.shield }; }),
      flags: (Array.isArray(s.flags) ? s.flags : []).map(function (f) { return { r: f.r, c: f.c, owner: f.owner || null }; }),
      turn: s.turn,
      ply: Number(s.ply) || 0,
      score: { blue: (s.score && Number(s.score.blue)) || 0, red: (s.score && Number(s.score.red)) || 0 },
      winner: null,
      limit: Number(s.limit) || 0,
      mission: campaignOn ? missionIdx : -1,
      spells: s.spells && s.spells.blue ? s.spells : { blue: { bolt: 1, shield: 1, rally: 1 }, red: { bolt: 0, shield: 0, rally: 0 } }
    };
    unitIdSeq = 1 + Math.max.apply(null, game.units.map(function (u) { return u.id || 0; }));
    phase = 'playing'; paused = false; busy = false; thinking = false;
    selectedId = null; legal = []; spellMode = null;
    skipStreak = { blue: 0, red: 0 }; aiSkipCount = 0;
    unitAnims = {}; hitFx = null; shotFx = null; flagFx = null; promoFx = null;
    particles = []; message = '';
    hideOverlays();
    buildDiffs();
    mapPreview = { terrain: game.terrain, flags: game.flags, template: game.template, seed: game.seed };
    updateHud();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    if (game.turn === RED) scheduleAI();
    return true;
  }

  /* ---------------- 启动 ---------------- */
  buildDiffs();
  mapPreview = generateMap();
  enterMenu();
  loopApi = Arcade.loop.start(update, draw, 16);
  draw();

  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({ id: 'siege', collect: collectSave, apply: applySave });
    try { Arcade.savegame.resume(); } catch (e) {}
  }

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.siege.helpText');
  root.appendChild(hd);

  /* ---------------- QA 钩子（仅 ?qa=1，正常访问不暴露） ---------------- */
  if (/[?&]qa=1/.test(location.search)) {
    function qaMakeState(seed, layout, limit, theme) {
      mapThemeOverride = theme || null;
      var map = generateMap(seed);
      mapThemeOverride = null;
      var units = makeUnits(layout || 'standard');
      return {
        terrain: map.terrain, template: map.template, seed: map.seed,
        units: units,
        flags: map.flags.map(function (f) { return { r: f.r, c: f.c, owner: null }; }),
        turn: BLUE, ply: 0, score: { blue: 0, red: 0 }, winner: null,
        limit: limit || 0, mission: -1,
        spells: { blue: { bolt: 1, shield: 1, rally: 1 }, red: { bolt: 0, shield: 0, rally: 0 } }
      };
    }

    function qaCheb(a, b) { return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)); }

    /* 蓝方模拟策略（仅 QA 使用）：优先清理弓手，其次护盾国王，最后补援军 */
    function qaBlueSpellPlan(st) {
      var sp = st.spells && st.spells.blue;
      if (!sp) return null;
      var reds = st.units.filter(function (u) { return u.color === RED; });
      var blues = st.units.filter(function (u) { return u.color === BLUE; });
      var redKings = [], i, kk;
      for (i = 0; i < reds.length; i++) if (reds[i].type === 'king') redKings.push(reds[i]);
      /* 选离敌王最近的己王：升王后可能有两个王，必须让"站位最好"的那个上盾/换王 */
      var bking = null, bd = 99;
      for (i = 0; i < blues.length; i++) {
        if (blues[i].type !== 'king') continue;
        var dk = 99;
        for (kk = 0; kk < redKings.length; kk++) dk = Math.min(dk, qaCheb(blues[i], redKings[kk]));
        if (dk < bd) { bd = dk; bking = blues[i]; }
      }
      if (sp.bolt > 0) {
        for (i = 0; i < reds.length; i++) if (reds[i].type === 'archer') return { mode: 'bolt', r: reds[i].r, c: reds[i].c };
        if (bking) {
          for (i = 0; i < reds.length; i++) {
            if (reds[i].type !== 'king' && qaCheb(reds[i], bking) <= 1) return { mode: 'bolt', r: reds[i].r, c: reds[i].c };
          }
        }
      }
      if (sp.shield > 0 && bking && !bking.shield) {
        var rk = null, rdist = 99;
        for (kk = 0; kk < redKings.length; kk++) {
          var dkr = qaCheb(bking, redKings[kk]);
          if (dkr < rdist) { rdist = dkr; rk = redKings[kk]; }
        }
        /* 护盾是换王的关键手牌：只在己王逼近敌王（或临近回合上限）时才上盾。
           被远程瞄准先靠走位躲开，不轻易把盾浪费在非斩王场合 */
        if (rk && (rdist <= 3 || (st.limit && Math.floor(st.ply / 2) >= st.limit - 12))) return { mode: 'shield', r: bking.r, c: bking.c };
      }
      if (sp.rally > 0 && st.ply >= 8 && blues.length <= reds.length) {
        for (var c = 0; c < N; c++) {
          if (!unitAt(st, 7, c) && passable(st.terrain, 7, c)) return { mode: 'rally', r: 7, c: c };
        }
        for (var c2 = 0; c2 < N; c2++) {
          if (!unitAt(st, 6, c2) && passable(st.terrain, 6, c2)) return { mode: 'rally', r: 6, c: c2 };
        }
      }
      return null;
    }

    function qaSimulate(st0, opts) {
      opts = opts || {};
      var st = cloneState(st0);
      var blueDiff = opts.blueDiff || 'normal';
      var redDiff = opts.redDiff || 'normal';
      var maxPlies = opts.maxPlies || 240;
      var rec = {
        seed: st0.seed, template: st0.template, symmetric: isSymmetric(st0.terrain),
        plies: 0, rounds: 0, blueMoves: 0, redMoves: 0,
        spells: { bolt: 0, shield: 0, rally: 0 },
        archerShotsBlue: 0, archerShotsRed: 0, archerMoves: 0,
        shieldBlocks: 0, captures: 0, skips: 0,
        thinkMs: 0, thinkN: 0, limitHit: false, drawBySkip: false,
        winner: null, evalRed: 0, score: null, captureWin: null, capturePly: 0
      };
      var skips = 0, i;
      while (rec.plies < maxPlies && !st.winner) {
        if (st.limit && Math.floor(st.ply / 2) >= st.limit) { st.winner = RED; rec.limitHit = true; break; }
        var actor = st.turn;
        if (actor === BLUE && opts.useSpells) {
          var plan = qaBlueSpellPlan(st);
          if (plan) {
            var sr = applySpellToState(st, plan.mode, plan.r, plan.c);
            if (sr.ok) { st = sr.state; rec.plies++; rec.spells[plan.mode]++; continue; }
          }
        }
        var acts = generateActions(st, actor);
        if (!acts.length) {
          skips++;
          if (skips >= 6) { st.winner = 'draw'; rec.drawBySkip = true; break; }
          st.turn = otherColor(actor); st.ply++; rec.plies++; rec.skips++;
          continue;
        }
        skips = 0;
        var t0 = Date.now();
        searchNodes = 0;
        var act = chooseDiff(st, orderActions(acts), actor === BLUE ? blueDiff : redDiff);
        rec.thinkMs += Date.now() - t0;
        if ((actor === BLUE ? blueDiff : redDiff) === 'hard') rec.thinkN += searchNodes;
        if (!act) break;
        var mover = null;
        for (i = 0; i < st.units.length; i++) if (st.units[i].id === act.unitId) { mover = st.units[i]; break; }
        var res = applyAction(st, act);
        if (mover && mover.type === 'archer') {
          if (act.kind === 'attack') { if (mover.color === BLUE) rec.archerShotsBlue++; else rec.archerShotsRed++; }
          else rec.archerMoves++;
        }
        if (res.effects.capture) rec.captures++;
        if (res.effects.winner) { rec.captureWin = res.effects.winner; rec.capturePly = st.ply; }
        if (res.effects.shielded) rec.shieldBlocks++;
        st = res.state;
        if (actor === BLUE) rec.blueMoves++; else rec.redMoves++;
        rec.plies++;
      }
      if (!st.winner) st.winner = 'draw';
      rec.rounds = Math.ceil(st.ply / 2);
      rec.winner = st.winner;
      rec.evalRed = evalState(st, RED);
      rec.score = { blue: st.score.blue, red: st.score.red };
      rec.state = st;
      return rec;
    }

    function qaAutoPlay(idx, maxPlies, blueDiff) {
      if (idx >= 0 && idx < MISSIONS.length) startMission(idx);
      if (!game) return null;
      var rec = qaSimulate(game, { blueDiff: blueDiff || 'hard', redDiff: difficulty, maxPlies: maxPlies || 200, useSpells: true });
      var st = rec.state; delete rec.state;
      rec.mission = missionIdx;
      rec.difficulty = difficulty;
      game = st;
      busy = false; thinking = false; selectedId = null; legal = []; spellMode = null;
      phase = 'playing';
      if (game.winner) endGame();
      rec.campaignDone = campaignDone;
      return rec;
    }

    window.__qa = {
      state: function () {
        if (!game) return { phase: phase, game: null };
        return {
          phase: phase, turn: game.turn, ply: game.ply, winner: game.winner,
          score: game.score, limit: game.limit, mission: game.mission,
          seed: game.seed, template: game.template,
          campaignOn: campaignOn, spells: game.spells, busy: busy, thinking: thinking,
          symmetric: isSymmetric(game.terrain),
          units: game.units.map(function (u) { return { id: u.id, color: u.color, type: u.type, r: u.r, c: u.c, shield: !!u.shield }; }),
          flags: game.flags.map(function (f) { return { r: f.r, c: f.c, owner: f.owner }; })
        };
      },
      start: function (diff, opts) { newGame(diff || 'easy', opts || {}); },
      mission: function (i) { startMission(i || 0); },
      openCampaign: openCampaign,
      spell: function (mode, r, c) { spellMode = mode; return castSpellAt(r, c); },
      finish: function (winner) {
        if (!game) return;
        game.winner = winner || BLUE;
        endGame();
      },
      stepBlue: function () {
        if (!game || game.winner || busy || game.turn !== BLUE) return false;
        var acts = orderActions(generateActions(game, BLUE));
        if (!acts.length) { skipNoActions(BLUE, gameToken); return true; }
        performAction(acts[Math.floor(Math.random() * acts.length)], false);
        return true;
      },
      autoPlay: qaAutoPlay,
      simulate: function (diffBlue, diffRed, seed, layout, limit, theme, maxPlies, useSpells) {
        var st = qaMakeState(seed, layout, limit, theme);
        var rec = qaSimulate(st, {
          blueDiff: diffBlue || 'normal', redDiff: diffRed || 'normal',
          maxPlies: maxPlies || 240, useSpells: !!useSpells
        });
        delete rec.state;
        return rec;
      },
      makeState: qaMakeState,
      apply: applyAction,
      applySpell: applySpellToState,
      actions: function (st, color) { return generateActions(st, color || st.turn); },
      eval: function (st, color) { return evalState(st, color || RED); },
      pick: function (st, diff) { return chooseDiff(st, orderActions(generateActions(st, st.turn)), diff || 'normal'); },
      lastSearch: function () { return { depth: lastSearchDepth, nodes: searchNodes, ms: lastSearchMs }; },
      rawState: function () { return game ? cloneState(game) : null; },
      units: function (st) { return st.units.map(function (u) { return { id: u.id, color: u.color, type: u.type, r: u.r, c: u.c, shield: !!u.shield }; }); },
      missionState: function () {
        return {
          campaignDone: campaignDone,
          phase: phase, current: missionIdx, campaignOn: campaignOn,
          missions: MISSIONS.map(function (m, i) {
            return { idx: i, name: T(m.nameKey), diff: m.diff, limit: m.limit, layout: m.layout, seed: m.seed, unlocked: i <= campaignDone, done: i < campaignDone };
          }),
          result: {
            open: !resultOv.classList.contains('hidden'),
            title: resTitle.textContent,
            stats: resStats.textContent.replace(/\s+/g, ' ').trim(),
            buttons: Array.prototype.map.call(resBtns.querySelectorAll('button'), function (b) { return b.textContent; })
          },
          campaignOpen: !campaignOv.classList.contains('hidden'),
          campaignSub: campaignSub.textContent,
          spellBar: Array.prototype.map.call(spellsEl.querySelectorAll('.sg-spell'), function (b) {
            return { mode: b.getAttribute('data-s'), count: b.querySelector('b').textContent, disabled: b.disabled, empty: b.classList.contains('empty') };
          })
        };
      },
      unlockAll: function () { campaignDone = MISSIONS.length; saveCampaign(campaignDone); renderCampaign(); },
      setCampaignDone: function (n) { campaignDone = Math.max(0, Math.min(MISSIONS.length, n || 0)); saveCampaign(campaignDone); renderCampaign(); return campaignDone; },
      campaignDone: function () { return campaignDone; },
      saveNow: function () { return window.Arcade && Arcade.savegame ? Arcade.savegame.write() : false; },
      loadSave: function () { return window.Arcade && Arcade.savegame ? Arcade.savegame.resume() : false; },
      saved: function () {
        try { return JSON.parse(localStorage.getItem('arcade_save_siege') || 'null'); } catch (e) { return null; }
      }
    };
  }

})();
