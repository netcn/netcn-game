/* ============================================================
   消消乐 · 旗舰版
   Canvas 宝石绘制 + 粒子/冲击环 + 缓动状态机 + 特殊宝石 + 三档难度
   核心匹配逻辑保留：findMatches / wouldMatch / hasValidMove / freshBoard / reshuffle
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var DEFAULT_MSG = T('gs.match3.msgStart');

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.match3.tut1t'), d: T('gs.match3.tut1') },
    { t: T('gs.match3.tut2t'), d: T('gs.match3.tut2') },
    { t: T('gs.match3.tut3t'), d: T('gs.match3.tut3') }
  ];

  /* ---------- 关卡（地图 12 关 / 三种目标） ---------- */
  var LEVELS = [
    { rows: 7, cols: 7, types: 5, moves: 24, kind: 'score', target: 600 },
    { rows: 7, cols: 7, types: 5, moves: 24, kind: 'collect', collect: [[0, 12], [1, 12]] },
    { rows: 8, cols: 8, types: 6, moves: 26, kind: 'score', target: 1000, ice: 6 },
    { rows: 8, cols: 8, types: 6, moves: 26, kind: 'ice', ice: 8 },
    { rows: 8, cols: 8, types: 6, moves: 26, kind: 'collect', collect: [[2, 14], [4, 12]] },
    { rows: 8, cols: 8, types: 6, moves: 24, kind: 'score', target: 1600, ice: 8 },
    { rows: 9, cols: 9, types: 6, moves: 28, kind: 'ice', ice: 12 },
    { rows: 9, cols: 9, types: 6, moves: 28, kind: 'collect', collect: [[0, 14], [3, 14], [5, 12]] },
    { rows: 9, cols: 9, types: 6, moves: 26, kind: 'score', target: 2400, ice: 10 },
    { rows: 9, cols: 9, types: 6, moves: 28, kind: 'ice', ice: 18 },
    { rows: 9, cols: 9, types: 6, moves: 30, kind: 'collect', collect: [[1, 16], [2, 16], [4, 16]] },
    { rows: 9, cols: 9, types: 6, moves: 26, kind: 'score', target: 3600, ice: 14 }
  ];
  var PROGRESS_KEY = 'arcade_match3_progress_v1';
  var STARS_KEY = 'arcade_match3_stars_v1';
  var DAILY_KEY = 'arcade_match3_daily_v1';
  function loadProgress() {
    try { var v = parseInt(localStorage.getItem(PROGRESS_KEY) || '0', 10); return isFinite(v) ? Math.max(0, Math.min(LEVELS.length, v)) : 0; } catch (e) { return 0; }
  }
  function saveProgress(n) {
    try { localStorage.setItem(PROGRESS_KEY, String(n)); } catch (e) {}
  }
  var progress = loadProgress();

  /* ---------- 每日关：日期种子（浏览器本地时区，本地 0 点换题） ---------- */
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function localDayKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function todayKey() { return localDayKey(new Date()); }
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function dailyDef(day) {
    var seed = hashSeed(day);
    var rng = mulberry32(seed);
    var tier = Math.floor(rng() * 3);
    var rows = 7 + tier, cols = 7 + tier;
    var types = tier === 0 ? (rng() < 0.55 ? 5 : 6) : 6;
    var kinds = ['score', 'collect', 'ice'];
    var kind = kinds[Math.floor(rng() * kinds.length)];
    var moves = 22 + tier * 2 + Math.floor(rng() * 5);
    var target = 0, ice = 0, collect = [];
    if (kind === 'score') {
      target = 600 + tier * 700 + Math.floor(rng() * 5) * 100;
    } else if (kind === 'ice') {
      ice = 6 + tier * 4 + Math.floor(rng() * 5);
    } else {
      var t1 = Math.floor(rng() * types);
      var t2 = (t1 + 1 + Math.floor(rng() * (types - 1))) % types;
      collect = [
        [t1, 10 + tier * 2 + Math.floor(rng() * 3)],
        [t2, 9 + tier * 2 + Math.floor(rng() * 3)]
      ];
    }
    if (kind === 'score' && tier > 0 && rng() < 0.42) ice = 4 + tier * 2;
    return {
      day: day, seed: seed, tier: tier, rows: rows, cols: cols, types: types,
      moves: moves, kind: kind, target: target, ice: ice, collect: collect
    };
  }
  function loadDailyRecord() {
    var day = todayKey();
    var out = { day: day, best: 0, done: false };
    var reset = true;
    try {
      var raw = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
      if (raw && raw.day === day) {
        out.best = Math.max(0, parseInt(raw.best, 10) || 0);
        out.done = !!raw.done;
        reset = false;
      }
    } catch (e) {}
    if (reset) {
      try { localStorage.setItem(DAILY_KEY, JSON.stringify(out)); } catch (e) {}
    }
    return out;
  }
  function saveDailyRecord() {
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(dailyRecord)); } catch (e) {}
  }
  var dailyRecord = loadDailyRecord();
  function refreshDailyRecord() { dailyRecord = loadDailyRecord(); }

  /* ---------- 星级记录（每关 { stars, best }） ---------- */
  function blankStars() {
    var a = [];
    for (var i = 0; i < LEVELS.length; i++) a.push({ stars: 0, best: 0 });
    return a;
  }
  function loadStars() {
    var a = blankStars();
    try {
      var raw = JSON.parse(localStorage.getItem(STARS_KEY) || 'null');
      if (raw && typeof raw.length === 'number') {
        for (var i = 0; i < LEVELS.length && i < raw.length; i++) {
          var o = raw[i] || {};
          var s = parseInt(o.stars, 10);
          var b = parseInt(o.best, 10);
          a[i].stars = isFinite(s) ? Math.max(0, Math.min(3, s)) : 0;
          a[i].best = isFinite(b) ? Math.max(0, b) : 0;
        }
      }
    } catch (e) {}
    return a;
  }
  function saveStars() {
    try { localStorage.setItem(STARS_KEY, JSON.stringify(starRecords)); } catch (e) {}
  }
  var starRecords = loadStars();
  /* 老存档只有进度、没有星级：已通关关卡补记 1 星 */
  for (var pri = 0; pri < progress && pri < LEVELS.length; pri++) {
    if (starRecords[pri].stars < 1) starRecords[pri].stars = 1;
  }
  if (progress > 0) saveStars();
  function totalStars() {
    var n = 0;
    for (var i = 0; i < starRecords.length; i++) n += starRecords[i].stars;
    return n;
  }

  var CELL = 60, PAD = 8;
  var SWAP_MS = 220, CLEAR_MS = 260, FALL_MS = 420, STAGGER = 26, SHUFFLE_MS = 520;
  var SCORE_PER_GEM = 10, SPECIAL_BONUS = 40;
  var BEST_KEY = (window.Arcade && Arcade.shell && Arcade.shell.gameId) || 'match3';

  var GEM_STYLES = [
    { main: '#ff2d95', light: '#ffc7e4', dark: '#5c0030' },  // 菱形 · 玫红
    { main: '#00f0ff', light: '#d6fbff', dark: '#00505c' },  // 圆 · 青
    { main: '#39ff14', light: '#ddffd8', dark: '#0b5c03' },  // 六角 · 绿
    { main: '#ffe600', light: '#fffbd0', dark: '#6b6000' },  // 星 · 黄
    { main: '#b967ff', light: '#f0d9ff', dark: '#3f1170' },  // 水滴 · 紫
    { main: '#ff9f1c', light: '#ffe4bd', dark: '#6b3a00' }   // 八角 · 橙
  ];

  /* ---------- 棋盘状态 ---------- */
  var ROWS = 8, COLS = 8, TYPES = 6;
  var W = 0, H = 0, CW = 0, CH = 0;
  var ctx = null;
  var canvas = null;
  var state = null;
  var loopApi = null;
  var drag = null;

  /* ---------- 页面骨架 ---------- */
  root.innerHTML =
    '<div class="m3-stage" id="m3-stage">' +
    '  <div class="game-message" id="msg">' + DEFAULT_MSG + '</div>' +
    '  <div class="m3-objbar" id="m3-obj"></div>' +
    '  <div class="m3-board-wrap" id="m3-wrap">' +
    '    <canvas id="board" class="m3-canvas"></canvas>' +
    '  </div>' +
    '  <div class="m3-progress"><i id="m3-progress"></i></div>' +
    '  <div class="game-stats m3-hud">' +
    '    <span>' + T('gs.match3.score') + ' <span class="stat-value" id="score">0</span></span>' +
    '    <span>' + T('gs.match3.movesLeft') + ' <span class="stat-value" id="moves">0</span></span>' +
    '    <span>' + T('gs.match3.best') + ' <span class="stat-value" id="hud-best">0</span></span>' +
    '  </div>' +
    '  <div class="m3-boosters" id="m3-boosters">' +
    '    <button class="m3-boost" data-b="hammer"><i class="m3-ic ic-hammer"></i><span>' + T('gs.match3.boosterHammer') + '</span><b id="cnt-hammer">1</b></button>' +
    '    <button class="m3-boost" data-b="bomb"><i class="m3-ic ic-bomb"></i><span>' + T('gs.match3.boosterBomb') + '</span><b id="cnt-bomb">1</b></button>' +
    '    <button class="m3-boost" data-b="shuffle"><i class="m3-ic ic-shuffle"></i><span>' + T('gs.match3.boosterShuffle') + '</span><b id="cnt-shuffle">1</b></button>' +
    '  </div>' +
    '  <div class="game-controls">' +
    '    <button id="restart-btn" class="btn purple">' + T('gs.match3.restart') + '</button>' +
    '    <button id="m3-map-btn" class="btn">' + T('gs.match3.levelMap') + '</button>' +
    '  </div>' +
    '</div>' +
    '<div class="m3-overlay hidden" id="m3-pick">' +
    '  <div class="m3-card">' +
    '    <div class="m3-kicker">LEVEL · MAP</div>' +
    '    <h2 class="m3-title">' + T('gs.match3.mapTitle') + '</h2>' +
    '    <p class="m3-sub">' + T('gs.match3.pickHint') + '</p>' +
    '    <div class="m3-daily" id="m3-daily">' +
    '      <span class="m3-daily-art" aria-hidden="true"></span>' +
    '      <div class="m3-daily-txt">' +
    '        <div class="m3-daily-k">DAILY <b id="m3-daily-day">--</b></div>' +
    '        <div class="m3-daily-name">' + T('gs.match3.daily') + '</div>' +
    '        <div class="m3-daily-meta" id="m3-daily-meta"></div>' +
    '      </div>' +
    '      <button class="btn yellow m3-daily-btn" id="m3-daily-play">' + T('gs.match3.dailyPlay') + '</button>' +
    '    </div>' +
    '    <div class="m3-map" id="m3-map"></div>' +
    '    <div class="m3-map-legend" id="m3-map-legend"></div>' +
    '    <div class="m3-stars-total" id="m3-stars-total"></div>' +
    '    <div class="m3-best-line" id="m3-pick-best"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="m3-overlay hidden" id="m3-result">' +
    '  <div class="m3-card">' +
    '    <h2 class="m3-title" id="m3-res-title"></h2>' +
    '    <p class="m3-sub" id="m3-res-sub"></p>' +
    '    <div class="m3-result-grid">' +
    '      <span>' + T('gs.match3.resultScore') + '</span><b id="m3-res-score">0</b>' +
    '      <span>' + T('gs.match3.maxChain') + '</span><b id="m3-res-chain">0</b>' +
    '      <span>' + T('gs.match3.best') + '</span><b id="m3-res-best">0</b>' +
    '    </div>' +
    '    <div class="m3-new hidden" id="m3-res-new">' + T('gs.match3.newRecord') + '</div>' +
    '    <div class="m3-actions">' +
    '      <button class="btn green" id="m3-again">' + T('gs.match3.again') + '</button>' +
    '      <button class="btn yellow" id="m3-next">' + T('gs.match3.nextLevel') + '</button>' +
    '      <button class="btn purple" id="m3-change">' + T('gs.match3.levelMap') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="m3-overlay hidden" id="m3-review">' +
    '  <div class="m3-card m3-rv-card">' +
    '    <div class="m3-kicker">LEVEL · REVIEW</div>' +
    '    <h2 class="m3-title" id="m3-rv-title"></h2>' +
    '    <div class="m3-rv-stars" id="m3-rv-stars"></div>' +
    '    <div class="m3-result-grid">' +
    '      <span>' + T('gs.match3.stars') + '</span><b id="m3-rv-starnum">0/3</b>' +
    '      <span>' + T('gs.match3.best') + '</span><b id="m3-rv-best">----</b>' +
    '      <span>' + T('gs.match3.objective') + '</span><b id="m3-rv-goal">--</b>' +
    '    </div>' +
    '    <div class="m3-actions">' +
    '      <button class="btn green" id="m3-rv-play">' + T('gs.match3.replay') + '</button>' +
    '      <button class="btn" id="m3-rv-back">' + T('gs.match3.backMap') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var msgEl = document.getElementById('msg');
  var wrapEl = document.getElementById('m3-wrap');
  var progressEl = document.getElementById('m3-progress');
  var scoreEl = document.getElementById('score');
  var movesEl = document.getElementById('moves');
  var objEl = document.getElementById('m3-obj');
  var hudBestEl = document.getElementById('hud-best');
  var restartBtn = document.getElementById('restart-btn');
  var mapBtn = document.getElementById('m3-map-btn');
  var boostersEl = document.getElementById('m3-boosters');
  var pickEl = document.getElementById('m3-pick');
  var mapEl = document.getElementById('m3-map');
  var mapLegendEl = document.getElementById('m3-map-legend');
  var pickBestEl = document.getElementById('m3-pick-best');
  var resultEl = document.getElementById('m3-result');
  var resTitleEl = document.getElementById('m3-res-title');
  var resSubEl = document.getElementById('m3-res-sub');
  var resScoreEl = document.getElementById('m3-res-score');
  var resChainEl = document.getElementById('m3-res-chain');
  var resBestEl = document.getElementById('m3-res-best');
  var resNewEl = document.getElementById('m3-res-new');
  var nextBtn = document.getElementById('m3-next');
  var againBtn = document.getElementById('m3-again');
  var dailyDayEl = document.getElementById('m3-daily-day');
  var dailyMetaEl = document.getElementById('m3-daily-meta');
  var dailyPlayBtn = document.getElementById('m3-daily-play');
  var starsTotalEl = document.getElementById('m3-stars-total');
  var reviewEl = document.getElementById('m3-review');
  var reviewTitleEl = document.getElementById('m3-rv-title');
  var reviewStarsEl = document.getElementById('m3-rv-stars');
  var reviewStarNumEl = document.getElementById('m3-rv-starnum');
  var reviewBestEl = document.getElementById('m3-rv-best');
  var reviewGoalEl = document.getElementById('m3-rv-goal');
  canvas = document.getElementById('board');

  /* ---------- 基础工具 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function idx(r, c) { return r * COLS + c; }
  /* 每日关用日期种子生成初始棋盘，开局后恢复随机补充 */
  var activeRng = null;
  function randType() { return Math.floor((activeRng ? activeRng() : Math.random()) * TYPES); }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function audio(name) { if (window.Arcade && Arcade.audio) Arcade.audio.play(name); }
  function bestScore() {
    try { return (Arcade.storage && Arcade.storage.getBest(BEST_KEY)); } catch (e) { return null; }
  }
  function makeGem(type, special) {
    return { type: type, special: special || null, ox: 0, oy: 0, scale: 1, alpha: 1, fallFrom: 0, fallCol: 0 };
  }
  function swap(b, i, j) { var t = b[i]; b[i] = b[j]; b[j] = t; }
  function cellCenter(i) {
    return {
      x: PAD + ((i % COLS) + 0.5) * CW,
      y: PAD + (Math.floor(i / COLS) + 0.5) * CH
    };
  }
  function rr(c, x, y, w, h, rad) {
    var r = Math.min(rad, Math.min(w, h) / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function easeOutCubic(t) { t = 1 - t; return 1 - t * t * t; }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function easeOutBounce(t) {
    var n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  }

  /* ---------- 核心匹配（沿用原实现思路） ---------- */
  function typeAt(g) { return g ? g.type : -1; }

  function generateBoard() {
    var b = new Array(ROWS * COLS);
    for (var i = 0; i < b.length; i++) {
      var r = Math.floor(i / COLS);
      var c = i % COLS;
      var t, guard = 0;
      do {
        t = randType();
        guard++;
      } while (guard < 60 && (
        (c >= 2 && typeAt(b[i - 1]) === t && typeAt(b[i - 2]) === t) ||
        (r >= 2 && typeAt(b[i - COLS]) === t && typeAt(b[i - COLS * 2]) === t)
      ));
      b[i] = makeGem(t);
    }
    return b;
  }

  function findMatchGroups(b) {
    var groups = [];
    var r, c2, run, cells;
    for (r = 0; r < ROWS; r++) {
      run = 1;
      cells = [idx(r, 0)];
      for (c2 = 1; c2 <= COLS; c2++) {
        var cur = c2 < COLS ? b[idx(r, c2)] : null;
        var prev = b[idx(r, c2 - 1)];
        var same = c2 < COLS && cur && prev && cur.type === prev.type && cur.type >= 0;
        if (same) {
          run++;
          cells.push(idx(r, c2));
        } else {
          if (run >= 3) {
            groups.push({ dir: 'h', len: run, cells: cells.slice(), type: prev ? prev.type : -1 });
          }
          run = 1;
          cells = c2 < COLS ? [idx(r, c2)] : [];
        }
      }
    }
    for (c2 = 0; c2 < COLS; c2++) {
      run = 1;
      cells = [idx(0, c2)];
      for (r = 1; r <= ROWS; r++) {
        var cur2 = r < ROWS ? b[idx(r, c2)] : null;
        var prev2 = b[idx(r - 1, c2)];
        var same2 = r < ROWS && cur2 && prev2 && cur2.type === prev2.type && cur2.type >= 0;
        if (same2) {
          run++;
          cells.push(idx(r, c2));
        } else {
          if (run >= 3) {
            groups.push({ dir: 'v', len: run, cells: cells.slice(), type: prev2 ? prev2.type : -1 });
          }
          run = 1;
          cells = r < ROWS ? [idx(r, c2)] : [];
        }
      }
    }
    return groups;
  }

  function findMatches(b) {
    var groups = findMatchGroups(b);
    if (!groups.length) return null;
    var mark = new Array(b.length);
    for (var i = 0; i < groups.length; i++) {
      var gc = groups[i].cells;
      for (var j = 0; j < gc.length; j++) mark[gc[j]] = true;
    }
    return mark;
  }

  function wouldMatch(b, i, j) {
    swap(b, i, j);
    var m = findMatches(b) !== null;
    swap(b, i, j);
    return m;
  }

  function canSwap(b, i, j) {
    if (i < 0 || j < 0 || i >= b.length || j >= b.length) return false;
    var ra = Math.floor(i / COLS), ca = i % COLS;
    var rb = Math.floor(j / COLS), cb = j % COLS;
    if (Math.abs(ra - rb) + Math.abs(ca - cb) !== 1) return false;
    if (!b[i] || !b[j]) return false;
    if (b[i].special === 'rainbow' || b[j].special === 'rainbow') return true;
    return wouldMatch(b, i, j);
  }

  function hasValidMove(b) {
    for (var i = 0; i < b.length; i++) {
      var r = Math.floor(i / COLS);
      var c = i % COLS;
      if (c < COLS - 1 && canSwap(b, i, i + 1)) return true;
      if (r < ROWS - 1 && canSwap(b, i, i + COLS)) return true;
    }
    return false;
  }

  function freshBoard() {
    var b, guard = 0;
    do {
      b = generateBoard();
      guard++;
    } while ((!hasValidMove(b) || findMatches(b)) && guard < 80);
    return b;
  }

  function findHint(b) {
    var list = [];
    for (var i = 0; i < b.length; i++) {
      var r = Math.floor(i / COLS);
      var c = i % COLS;
      if (c < COLS - 1 && canSwap(b, i, i + 1)) list.push([i, i + 1]);
      if (r < ROWS - 1 && canSwap(b, i, i + COLS)) list.push([i, i + COLS]);
    }
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function reshuffleBoard() {
    var b = state.board.slice();
    var guard = 0;
    while (guard < 80) {
      for (var i = b.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        swap(b, i, j);
      }
      if (!findMatches(b) && hasValidMove(b)) break;
      guard++;
    }
    if (guard >= 80) b = freshBoard();
    for (var k = 0; k < b.length; k++) {
      var g = b[k];
      if (!g) continue;
      g.ox = 0; g.oy = 0; g.scale = 1; g.alpha = 1;
      g.fallFrom = 0; g.fallCol = k % COLS;
    }
    state.board = b;
  }

  /* ---------- 画布 / HiDPI ---------- */
  function setupCanvas() {
    var lw = COLS * CELL;
    var lh = ROWS * CELL;
    if (window.GK && GK.setup) {
      var info = GK.setup(canvas, lw, lh);
      ctx = info.ctx; W = info.w; H = info.h;
    } else {
      canvas.width = lw; canvas.height = lh;
      ctx = canvas.getContext('2d');
      W = lw; H = lh;
    }
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxWidth = W + 'px';
    PAD = 8;
    CW = (W - PAD * 2) / COLS;
    CH = (H - PAD * 2) / ROWS;
  }

  function cellIndexFromPoint(x, y) {
    var c = Math.floor((x - PAD) / CW);
    var r = Math.floor((y - PAD) / CH);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return -1;
    return idx(r, c);
  }

  /* ---------- HUD / 目标 ---------- */
  function objectiveDone() {
    if (!state) return false;
    var o = state.objective;
    if (!o) return false;
    if (o.kind === 'score') return state.score >= o.target;
    if (o.kind === 'ice') return o.iceLeft <= 0;
    if (o.kind === 'collect') {
      for (var i = 0; i < o.collect.length; i++) if (o.collect[i].got < o.collect[i].need) return false;
      return true;
    }
    return false;
  }
  function objectiveRatio() {
    var o = state.objective;
    if (o.kind === 'score') return o.target ? state.score / o.target : 0;
    if (o.kind === 'ice') return o.iceTotal ? (o.iceTotal - o.iceLeft) / o.iceTotal : 1;
    if (o.kind === 'collect') {
      var got = 0, need = 0;
      for (var i = 0; i < o.collect.length; i++) { got += Math.min(o.collect[i].got, o.collect[i].need); need += o.collect[i].need; }
      return need ? got / need : 1;
    }
    return 0;
  }
  function objectiveHtml() {
    var o = state.objective;
    if (o.kind === 'score') return T('gs.match3.objScore').replace('{n}', o.target);
    if (o.kind === 'ice') return T('gs.match3.objIce').replace('{a}', o.iceTotal - o.iceLeft).replace('{b}', o.iceTotal);
    var html = T('gs.match3.objCollect') + ' ';
    for (var i = 0; i < o.collect.length; i++) {
      var t = o.collect[i];
      var col = GEM_STYLES[t.type] ? GEM_STYLES[t.type].main : '#00f0ff';
      html += (i > 0 ? ' ' : '') + '<span class="m3-chip"><i style="background:' + col + ';box-shadow:0 0 8px ' + col + '"></i>' +
        Math.min(t.got, t.need) + '/' + t.need + '</span>';
    }
    return html;
  }
  function updateBoosterUi() {
    if (!state || !boostersEl) return;
    var keys = ['hammer', 'bomb', 'shuffle'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var el = boostersEl.querySelector('[data-b="' + k + '"]');
      if (!el) continue;
      var cnt = state.boosters[k] || 0;
      var badge = el.querySelector('b');
      if (badge) badge.textContent = cnt;
      el.classList.toggle('armed', state.boosterMode === k);
      el.classList.toggle('empty', cnt <= 0);
      el.disabled = cnt <= 0 || state.phase !== 'idle' || state.over;
    }
  }
  function currentBest() {
    return state && state.mode === 'daily' ? dailyRecord.best : bestScore();
  }
  function updateHud() {
    if (!state) return;
    scoreEl.textContent = String(state.score);
    movesEl.textContent = String(Math.max(0, state.movesLeft));
    var best = currentBest();
    hudBestEl.textContent = (best === null || best === 0) ? '----' : String(best);
    progressEl.style.width = Math.min(100, objectiveRatio() * 100).toFixed(1) + '%';
    objEl.innerHTML = '<span class="m3-obj-k">' + T('gs.match3.objective') + '</span>' + objectiveHtml();
    updateBoosterUi();
  }

  function starsHtml(n, cls) {
    var out = '<span class="m3-stars' + (cls ? ' ' + cls : '') + '">';
    for (var i = 0; i < 3; i++) {
      out += '<i class="m3-star' + (i < n ? ' on' : '') + '" style="animation-delay:' + (i * 70) + 'ms"></i>';
    }
    return out + '</span>';
  }

  function updatePickerBest() {
    var best = bestScore();
    pickBestEl.textContent = T('gs.match3.best') + ' ' + (best === null ? '----' : best);
    if (starsTotalEl) {
      starsTotalEl.textContent = T('gs.match3.starsTotal')
        .replace('{n}', String(totalStars()))
        .replace('{m}', String(LEVELS.length * 3));
    }
  }

  /* ---------- 关卡地图 ---------- */
  function objectiveShort(d) {
    if (d.kind === 'score') return T('gs.match3.shortScore').replace('{n}', d.target);
    if (d.kind === 'ice') return T('gs.match3.shortIce').replace('{n}', d.ice || 0);
    return T('gs.match3.shortCollect');
  }
  function renderDailyEntry() {
    refreshDailyRecord();
    if (!dailyDayEl) return;
    var d = dailyDef(dailyRecord.day);
    dailyDayEl.textContent = dailyRecord.day.slice(5);
    dailyDayEl.title = dailyRecord.day;
    dailyMetaEl.innerHTML =
      '<span>' + d.rows + '×' + d.cols + ' · ' + objectiveShort(d) + '</span> ' +
      '<span>' + (dailyRecord.done ? T('gs.match3.dailyDoneTag') : '') +
      T('gs.match3.best') + ' ' + (dailyRecord.best > 0 ? dailyRecord.best : '----') + '</span>';
    dailyPlayBtn.textContent = dailyRecord.done ? T('gs.match3.dailyAgain') : T('gs.match3.dailyPlay');
  }
  function renderLevelMap() {
    if (!mapEl) return;
    mapEl.innerHTML = '';
    for (var i = 0; i < LEVELS.length; i++) {
      var d = LEVELS[i];
      var unlocked = i <= progress;
      var done = i < progress;
      var rec = starRecords[i] || { stars: 0, best: 0 };
      var b = document.createElement('button');
      b.className = 'm3-lv' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
      b.innerHTML = '<b>' + (i + 1) + '</b><span>' + objectiveShort(d) + '</span>' +
        starsHtml(rec.stars, 'm3-lv-stars') +
        '<em>' + (done ? T('gs.match3.lvDone') : (unlocked ? T('gs.match3.lvPlay') : T('gs.match3.lvLock'))) + '</em>';
      if (done) {
        (function (lv) { b.addEventListener('click', function () { openReview(lv); }); })(i);
      } else if (unlocked) {
        (function (lv) { b.addEventListener('click', function () { startLevel(lv); }); })(i);
      } else {
        b.addEventListener('click', function () {
          audio('error');
          msgEl.textContent = T('gs.match3.lvNeed');
          msgEl.style.color = 'var(--neon-pink)';
        });
      }
      mapEl.appendChild(b);
    }
    if (mapLegendEl) mapLegendEl.innerHTML = T('gs.match3.mapLegend');
  }
  function openPicker() {
    if (loopApi) { loopApi.stop(); loopApi = null; }
    state = null;
    drag = null;
    resultEl.classList.add('hidden');
    reviewEl.classList.add('hidden');
    pickEl.classList.remove('hidden');
    renderDailyEntry();
    renderLevelMap();
    updatePickerBest();
  }

  /* ---------- 关卡回看 ---------- */
  var reviewLevel = -1;
  function openReview(lv) {
    if (lv < 0 || lv >= LEVELS.length || lv >= progress) return false;
    if (loopApi) { loopApi.stop(); loopApi = null; }
    state = null;
    drag = null;
    reviewLevel = lv;
    var rec = starRecords[lv] || { stars: 0, best: 0 };
    reviewTitleEl.textContent = T('gs.match3.reviewTitle').replace('{n}', lv + 1);
    reviewStarsEl.innerHTML = starsHtml(rec.stars, 'm3-rv-starline');
    reviewStarNumEl.textContent = rec.stars + '/3';
    reviewBestEl.textContent = rec.best > 0 ? String(rec.best) : '----';
    reviewGoalEl.textContent = objectiveShort(LEVELS[lv]);
    pickEl.classList.add('hidden');
    resultEl.classList.add('hidden');
    reviewEl.classList.remove('hidden');
    audio('ui');
    return true;
  }
  function closeReview() {
    reviewEl.classList.add('hidden');
    openPicker();
  }

  /* ---------- 开局 / 关卡 ---------- */
  function placeIce(d, seed) {
    state.ice = new Array(ROWS * COLS);
    for (var k = 0; k < state.ice.length; k++) state.ice[k] = 0;
    var want = d.ice || 0;
    var rng = mulberry32(seed || (3200 + state.level * 37));
    var guard = 0;
    while (want > 0 && guard < 400) {
      var i = Math.floor(rng() * ROWS * COLS);
      if (!state.ice[i]) { state.ice[i] = 1; want--; }
      guard++;
    }
  }
  function startBoard(d, levelIdx, mode, seed) {
    var daily = mode === 'daily';
    var li = daily ? -1 : Math.max(0, Math.min(LEVELS.length - 1, Number(levelIdx) || 0));
    ROWS = d.rows; COLS = d.cols; TYPES = d.types;
    if (loopApi) { loopApi.stop(); loopApi = null; }

    /* 每日关：初始棋盘也由日期种子生成，保证全球同题 */
    activeRng = daily ? mulberry32((seed || 0) + 17) : null;
    state = {
      level: li,
      mode: daily ? 'daily' : 'level',
      dailyDay: daily ? d.day : null,
      seed: seed || 0,
      target: d.target || 0,
      maxMoves: d.moves,
      movesLeft: d.moves,
      score: 0,
      chain: 0,
      maxChain: 0,
      board: freshBoard(),
      phase: 'falling',
      anim: { kind: 'fall', t: 0 },
      selected: -1,
      cursor: { r: Math.floor(d.rows / 2), c: Math.floor(d.cols / 2) },
      cursorOn: false,
      hint: null,
      idleT: 0,
      lastSwap: null,
      settleT: 0,
      particles: [],
      shocks: [],
      beams: [],
      flash: 0,
      over: false,
      submitted: false,
      newRecord: false,
      ice: [],
      iceLeft: d.ice || 0,
      boosterMode: null,
      boosterUsed: false,
      boosters: { hammer: 1, bomb: 1, shuffle: 1 },
      objective: {
        kind: d.kind,
        target: d.target || 0,
        iceTotal: d.ice || 0,
        iceLeft: d.ice || 0,
        collect: (d.collect || []).map(function (p) { return { type: p[0], need: p[1], got: 0 }; })
      }
    };
    activeRng = null;
    placeIce(d, seed);
    drag = null;
    state.board.forEach(function (g, i) {
      var r = Math.floor(i / COLS);
      g.fallFrom = -(r + 1 + Math.random() * 0.7);
      g.fallCol = i % COLS;
      g.oy = g.fallFrom;
    });

    setupCanvas();
    pickEl.classList.add('hidden');
    resultEl.classList.add('hidden');
    reviewEl.classList.add('hidden');
    againBtn.textContent = daily ? T('gs.match3.dailyAgain') : T('gs.match3.again');
    msgEl.textContent = daily
      ? T('gs.match3.dailyStart').replace('{d}', d.day)
      : T('gs.match3.levelStart').replace('{n}', li + 1);
    msgEl.style.color = 'var(--neon-cyan)';
    updateHud();

    loopApi = Arcade.loop.start(update, draw, 16);
  }
  function startLevel(levelIdx) {
    var li = Math.max(0, Math.min(LEVELS.length - 1, Number(levelIdx) || 0));
    startBoard(LEVELS[li], li, 'level', 3200 + li * 37);
  }
  function startDaily() {
    refreshDailyRecord();
    /* 种子 / 显示 / 记录统一取刷新后的本地日键，避免跨 0 点两次取时不一致 */
    var day = dailyRecord.day;
    startBoard(dailyDef(day), -1, 'daily', hashSeed(day));
  }

  /* ---------- 棋盘动画 ---------- */
  function resetGemOffset(i) {
    var g = state.board[i];
    if (g) { g.ox = 0; g.oy = 0; }
  }

  function resetAllGemVisuals() {
    for (var i = 0; i < state.board.length; i++) {
      var g = state.board[i];
      if (!g) continue;
      g.ox = 0; g.oy = 0; g.scale = 1; g.alpha = 1;
      g.fallFrom = 0;
    }
  }

  function explodeCell(i, color, special) {
    var cc = cellCenter(i);
    var n = special ? 16 : 9;
    for (var k = 0; k < n; k++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 1.2 + Math.random() * 4.4;
      state.particles.push({
        x: cc.x, y: cc.y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.1,
        life: 1, size: 2 + Math.random() * 4.5,
        color: color, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.5
      });
    }
    state.shocks.push({
      x: cc.x, y: cc.y, r: Math.min(CW, CH) * 0.12,
      maxR: Math.min(CW, CH) * (special ? 1.5 : 0.95),
      life: 1, color: color
    });
    if (window.GK && GK.burst) GK.burst(canvas, cc.x, cc.y, color, special ? 8 : 3);
  }

  function pickColorNear(i) {
    var r = Math.floor(i / COLS), c = i % COLS;
    var dirs = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]];
    for (var k = 0; k < dirs.length; k++) {
      var nr = r + dirs[k][0], nc = c + dirs[k][1];
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
      var g = state.board[idx(nr, nc)];
      if (g && g.type >= 0) return g.type;
    }
    return randType();
  }

  function pickAnchor(group) {
    if (state.lastSwap) {
      for (var i = 0; i < group.cells.length; i++) {
        if (group.cells[i] === state.lastSwap[0] || group.cells[i] === state.lastSwap[1]) return group.cells[i];
      }
    }
    return group.cells[Math.floor(group.cells.length / 2)];
  }

  /* 开始一次消除：展开直线炸弹/彩虹，计分并进入 clear 动画 */
  function startClear(chain, baseCells, groups, isRainbow) {
    if (!state || state.over) return;
    state.chain = chain;
    if (chain > state.maxChain) state.maxChain = chain;

    var queue = [];
    var seen = {};
    var gi, gj;
    if (groups) {
      for (gi = 0; gi < groups.length; gi++) {
        for (gj = 0; gj < groups[gi].cells.length; gj++) queue.push(groups[gi].cells[gj]);
      }
    } else if (baseCells) {
      for (gi = 0; gi < baseCells.length; gi++) queue.push(baseCells[gi]);
    }

    var lineEffects = [];
    var rainbowHit = false;
    while (queue.length) {
      var i = queue.pop();
      if (seen[i]) continue;
      seen[i] = true;
      var g = state.board[i];
      if (!g) continue;
      if (g.special === 'lineH' || g.special === 'lineV') {
        var rr0 = Math.floor(i / COLS), cc0 = i % COLS;
        var k2;
        if (g.special === 'lineH') {
          for (k2 = 0; k2 < COLS; k2++) queue.push(idx(rr0, k2));
        } else {
          for (k2 = 0; k2 < ROWS; k2++) queue.push(idx(k2, cc0));
        }
        lineEffects.push({
          i: i,
          dir: g.special === 'lineH' ? 'h' : 'v',
          life: 1,
          color: GEM_STYLES[g.type] ? GEM_STYLES[g.type].main : '#00f0ff'
        });
      } else if (g.special === 'rainbow') {
        var t = pickColorNear(i);
        for (var z = 0; z < state.board.length; z++) {
          if (state.board[z] && state.board[z].type === t) queue.push(z);
        }
        rainbowHit = true;
      } else if (g.special === 'bomb') {
        var br = Math.floor(i / COLS), bc = i % COLS;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            var nr = br + dr, nc2 = bc + dc;
            if (nr >= 0 && nc2 >= 0 && nr < ROWS && nc2 < COLS) queue.push(idx(nr, nc2));
          }
        }
        state.shocks.push({
          x: cellCenter(i).x, y: cellCenter(i).y, r: Math.min(CW, CH) * 0.2,
          maxR: Math.min(CW, CH) * 2.4, life: 1, color: '#ffe600'
        });
      }
    }

    var cells = [];
    for (var key in seen) if (seen.hasOwnProperty(key)) cells.push(Number(key));

    var pending = [];
    var usedGroups = {};
    var crossCells = {};
    var hasBombSpec = false;
    if (groups) {
      /* L / T 形：横向组与纵向组相交 → 生成十字炸弹 */
      for (gi = 0; gi < groups.length; gi++) {
        var gh = groups[gi];
        if (gh.dir !== 'h' || gh.len < 3) continue;
        for (gj = 0; gj < groups.length; gj++) {
          var gv = groups[gj];
          if (gv.dir !== 'v' || gv.len < 3 || gv.type !== gh.type) continue;
          var shared = -1;
          for (var ai = 0; ai < gh.cells.length; ai++) {
            if (gv.cells.indexOf(gh.cells[ai]) >= 0) { shared = gh.cells[ai]; break; }
          }
          if (shared < 0) continue;
          usedGroups[gi] = true; usedGroups[gj] = true;
          if (!crossCells[shared]) {
            crossCells[shared] = true;
            pending.push({ i: shared, type: gh.type, special: 'bomb' });
            hasBombSpec = true;
          }
        }
      }
      for (gi = 0; gi < groups.length; gi++) {
        var grp = groups[gi];
        if (usedGroups[gi] || grp.len < 4) continue;
        var anchor = pickAnchor(grp);
        var spec = grp.len >= 5 ? 'rainbow' : (grp.dir === 'h' ? 'lineH' : 'lineV');
        pending.push({
          i: anchor,
          type: spec === 'rainbow' ? -1 : grp.type,
          special: spec
        });
      }
    }

    state.score += cells.length * SCORE_PER_GEM * chain + pending.length * SPECIAL_BONUS * chain;

    var hasRainbowSpec = isRainbow || rainbowHit;
    var hasLineSpec = lineEffects.length > 0;
    var pi;
    for (pi = 0; pi < pending.length; pi++) {
      if (pending[pi].special === 'rainbow') hasRainbowSpec = true;
      else if (pending[pi].special === 'bomb') hasBombSpec = true;
      else hasLineSpec = true;
    }

    /* 冰层：消除落在冰格上时破冰；收集目标同步计数 */
    var obj = state.objective;
    var iceBroke = 0;
    for (var ci = 0; ci < cells.length; ci++) {
      var cg = state.board[cells[ci]];
      if (!cg) continue;
      if (state.ice && state.ice[cells[ci]]) {
        state.ice[cells[ci]] = 0;
        obj.iceLeft = Math.max(0, obj.iceLeft - 1);
        iceBroke++;
        state.score += 6;
        explodeCell(cells[ci], '#dff6ff', true);
      }
      for (var oi = 0; oi < obj.collect.length; oi++) {
        if (cg.type === obj.collect[oi].type && obj.collect[oi].got < obj.collect[oi].need) obj.collect[oi].got++;
      }
      var col = cg.special === 'rainbow' ? '#ffffff' : GEM_STYLES[cg.type].main;
      explodeCell(cells[ci], col, !!(cg && cg.special));
      cg.clearing = true;
    }
    state.beams = state.beams.concat(lineEffects);
    updateHud();

    if (chain >= 2) {
      msgEl.textContent = T('gs.match3.chain').replace('{n}', chain);
      msgEl.style.color = 'var(--neon-yellow)';
      state.flash = Math.min(1, 0.3 + chain * 0.14);
      if (Arcade.fx) {
        Arcade.fx.flash(chain >= 3 ? 'var(--neon-yellow)' : 'var(--neon-cyan)');
        Arcade.fx.shake(wrapEl);
      }
      audio('clear');
    } else {
      if (hasBombSpec) {
        msgEl.textContent = T('gs.match3.specialBomb');
        msgEl.style.color = 'var(--neon-yellow)';
      } else if (hasRainbowSpec) {
        msgEl.textContent = T('gs.match3.specialRainbow');
        msgEl.style.color = 'var(--neon-pink)';
      } else if (hasLineSpec) {
        msgEl.textContent = T('gs.match3.specialLine');
        msgEl.style.color = 'var(--neon-cyan)';
      } else {
        msgEl.textContent = '';
        msgEl.style.color = '';
      }
      audio(hasLineSpec || hasRainbowSpec ? 'merge' : 'match');
    }

    state.phase = 'clearing';
    state.anim = {
      kind: 'clear', t: 0, dur: CLEAR_MS,
      cells: cells, pending: pending
    };
  }

  function finishClear(anim) {
    var pendingMap = {};
    for (var p = 0; p < anim.pending.length; p++) pendingMap[anim.pending[p].i] = anim.pending[p];
    for (var i = 0; i < anim.cells.length; i++) state.board[anim.cells[i]] = null;
    for (var key in pendingMap) {
      if (!pendingMap.hasOwnProperty(key)) continue;
      var spec = pendingMap[key];
      state.board[Number(key)] = makeGem(spec.type, spec.special);
    }
    state.lastSwap = null;
    state.anim = null;
    applyGravity();
    state.phase = 'falling';
    state.anim = { kind: 'fall', t: 0 };
    audio('drop');
  }

  function applyGravity() {
    for (var c = 0; c < COLS; c++) {
      var write = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r--) {
        var g = state.board[idx(r, c)];
        if (g) {
          if (write !== r) {
            state.board[idx(write, c)] = g;
            state.board[idx(r, c)] = null;
            g.fallFrom = r - write;
            g.fallCol = c;
            g.oy = g.fallFrom;
          }
          write--;
        }
      }
      for (var r2 = write; r2 >= 0; r2--) {
        var ng = makeGem(randType());
        state.board[idx(r2, c)] = ng;
        ng.fallFrom = -(r2 + 1 + Math.random() * 0.7);
        ng.fallCol = c;
        ng.oy = ng.fallFrom;
      }
    }
  }

  function updateSwap() {
    var anim = state.anim;
    var p = Math.min(1, anim.t / anim.dur);
    var e;
    if (anim.ok) {
      e = easeOutCubic(p);
    } else {
      e = p < 0.5 ? easeOutQuad(p * 2) : 1 - easeOutQuad((p - 0.5) * 2);
    }
    var a = anim.a, b = anim.b;
    var ar = Math.floor(a / COLS), ac = a % COLS;
    var br = Math.floor(b / COLS), bc = b % COLS;
    var ga = state.board[a], gb = state.board[b];
    if (ga) { ga.ox = (bc - ac) * e; ga.oy = (br - ar) * e; }
    if (gb) { gb.ox = (ac - bc) * e; gb.oy = (ar - br) * e; }

    if (p >= 1) {
      if (anim.ok) {
        swap(state.board, a, b);
        resetGemOffset(a);
        resetGemOffset(b);
        state.anim = null;
        if (anim.rainbow) {
          var cells = [];
          var rType = anim.rType;
          state.board.forEach(function (g2, i2) {
            if (rType < 0 || (g2 && g2.type === rType)) cells.push(i2);
          });
          if (anim.rainbowAt >= 0 && cells.indexOf(anim.rainbowAt) < 0) cells.push(anim.rainbowAt);
          startClear(1, cells, null, true);
        } else {
          var groups = findMatchGroups(state.board);
          if (groups.length) startClear(1, null, groups, false);
          else {
            state.phase = 'idle';
            state.idleT = 0;
          }
        }
      } else {
        resetGemOffset(a);
        resetGemOffset(b);
        state.anim = null;
        state.phase = 'idle';
        state.idleT = 0;
      }
    }
  }

  function updateClear() {
    var anim = state.anim;
    var p = Math.min(1, anim.t / anim.dur);
    for (var i = 0; i < anim.cells.length; i++) {
      var g = state.board[anim.cells[i]];
      if (!g) continue;
      g.scale = Math.max(0, 1 - p);
      g.alpha = Math.max(0, 1 - p);
    }
    if (p >= 1) finishClear(anim);
  }

  function updateFall() {
    var anim = state.anim;
    var maxT = FALL_MS + STAGGER * (COLS - 1);
    for (var i = 0; i < state.board.length; i++) {
      var g = state.board[i];
      if (!g) continue;
      if (g.fallFrom) {
        var delay = (g.fallCol || 0) * STAGGER;
        var p = clamp((anim.t - delay) / FALL_MS, 0, 1);
        g.oy = g.fallFrom * (1 - easeOutBounce(p));
      } else {
        g.oy = 0;
      }
    }
    if (anim.t >= maxT) {
      resetAllGemVisuals();
      state.anim = null;
      state.phase = 'settle';
      state.settleT = 90;
    }
  }

  function resolveAfterFall() {
    if (!state || state.over) return;
    var groups = findMatchGroups(state.board);
    if (groups.length) {
      startClear(state.chain + 1, null, groups, false);
    } else {
      endTurn();
    }
  }

  function updateShuffle() {
    var anim = state.anim;
    var p = Math.min(1, anim.t / anim.dur);
    var alpha = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
    for (var i = 0; i < state.board.length; i++) {
      var g = state.board[i];
      if (!g) continue;
      g.alpha = alpha;
      g.scale = 0.86 + alpha * 0.14;
    }
    if (!anim.done && p >= 0.5) {
      reshuffleBoard();
      anim.done = true;
    }
    if (p >= 1) {
      resetAllGemVisuals();
      state.anim = null;
      state.phase = 'idle';
      state.idleT = 0;
      msgEl.textContent = T('gs.match3.reshuffled');
      msgEl.style.color = 'var(--neon-cyan)';
      audio('merge');
    }
  }

  function startShuffle(manual) {
    state.phase = 'shuffling';
    state.anim = { kind: 'shuffle', t: 0, dur: SHUFFLE_MS, done: false };
    state.hint = null;
    state.selected = -1;
    state.boosterMode = null;
    msgEl.textContent = manual ? T('gs.match3.shuffledBooster') : T('gs.match3.deadlock');
    msgEl.style.color = 'var(--neon-yellow)';
    audio(manual ? 'coin' : 'error');
    updateBoosterUi();
  }

  function endTurn() {
    if (!state || state.over) return;
    state.phase = 'idle';
    state.selected = -1;
    state.lastSwap = null;
    state.chain = 0;
    state.idleT = 0;
    state.hint = null;

    if (objectiveDone()) { finishGame(true); return; }
    if (state.movesLeft <= 0) { finishGame(false); return; }
    if (!hasValidMove(state.board)) { startShuffle(); return; }
    msgEl.textContent = '';
    msgEl.style.color = '';
    updateHud();
  }

  function starRating() {
    if (!state) return 0;
    var o = state.objective;
    var ratio = state.maxMoves ? Math.max(0, state.movesLeft) / state.maxMoves : 0;
    var scoreOk = o.kind === 'score' ? (o.target ? state.score >= o.target * 1.3 : true) : true;
    var stars = 1;
    if (ratio >= 0.12 || (o.kind === 'score' && o.target && state.score >= o.target * 1.25)) stars = 2;
    if (ratio >= 0.30 && !state.boosterUsed && scoreOk) stars = 3;
    return stars;
  }

  function finishGame(win) {
    if (!state || state.over) return;
    state.over = true;
    state.phase = 'over';
    state.selected = -1;
    state.hint = null;
    state.anim = null;

    var daily = state.mode === 'daily';
    if (!state.submitted) {
      state.submitted = true;
      var isNew = false;
      if (daily) {
        var prevBest = dailyRecord.best;
        dailyRecord.best = Math.max(dailyRecord.best, state.score);
        if (win) dailyRecord.done = true;
        saveDailyRecord();
        isNew = state.score > prevBest;
      } else {
        try {
          if (window.Arcade && Arcade.shell && Arcade.shell.submitScore) isNew = Arcade.shell.submitScore(state.score);
        } catch (e) {}
      }
      state.newRecord = !!isNew;
    }

    var best = daily ? dailyRecord.best : bestScore();
    var o = state.objective;
    var isScore = o.kind === 'score';
    if (!daily) {
      var rec = starRecords[state.level];
      rec.best = Math.max(rec.best, state.score);
      if (win) {
        rec.stars = Math.max(rec.stars, starRating());
        progress = Math.max(progress, Math.min(LEVELS.length, state.level + 1));
        saveProgress(progress);
      }
      saveStars();
    }
    resTitleEl.textContent = win
      ? (daily ? T('gs.match3.dailyWin') : T('gs.match3.win'))
      : (daily ? T('gs.match3.dailyLose') : T('gs.match3.lose'));
    resTitleEl.className = 'm3-title' + (win ? ' win' : '');
    resSubEl.textContent = daily
      ? (win ? T('gs.match3.dailyWinSub').replace('{m}', Math.max(0, state.movesLeft))
        : T('gs.match3.dailyLoseSub'))
      : (win
        ? (isScore ? T('gs.match3.winSub').replace('{m}', Math.max(0, state.movesLeft))
          : T('gs.match3.winGoal').replace('{n}', state.level + 1).replace('{m}', Math.max(0, state.movesLeft)))
        : (isScore ? T('gs.match3.loseSub').replace('{t}', o.target)
          : T('gs.match3.loseGoal').replace('{n}', state.level + 1)));
    resScoreEl.textContent = String(state.score);
    resChainEl.textContent = '×' + state.maxChain;
    resBestEl.textContent = String(best === null ? state.score : best);
    resNewEl.classList.toggle('hidden', !state.newRecord);
    if (nextBtn) nextBtn.classList.toggle('hidden', !(win && !daily && state.level < LEVELS.length - 1));
    resultEl.classList.remove('hidden');

    if (win) {
      audio('win');
      if (Arcade.fx) {
        Arcade.fx.centerBurst('var(--neon-yellow)', 24);
        Arcade.fx.flash('var(--neon-yellow)');
      }
    } else {
      audio('lose');
    }
    updateHud();
  }

  /* ---------- 输入 ---------- */
  function isValidCell(i) {
    return i >= 0 && state.board && state.board[i];
  }

  /* ---------- 助推器 ---------- */
  function useBooster(kind) {
    if (!state || state.over || state.phase !== 'idle') { audio('error'); return; }
    if (!state.boosters[kind]) { msgEl.textContent = T('gs.match3.noBooster'); msgEl.style.color = 'var(--neon-pink)'; audio('error'); return; }
    if (kind === 'shuffle') {
      state.boosters.shuffle--;
      state.boosterUsed = true;
      startShuffle(true);
      updateBoosterUi();
      return;
    }
    state.boosterMode = state.boosterMode === kind ? null : kind;
    state.selected = -1;
    state.hint = null;
    msgEl.textContent = state.boosterMode
      ? T(kind === 'hammer' ? 'gs.match3.boosterHintHammer' : 'gs.match3.boosterHintBomb')
      : '';
    msgEl.style.color = 'var(--neon-yellow)';
    audio('ui');
    updateBoosterUi();
  }
  function applyBoosterAt(i, kind) {
    if (!state || state.over || state.phase !== 'idle' || !isValidCell(i)) return;
    if (!state.boosters[kind]) { state.boosterMode = null; updateBoosterUi(); return; }
    state.boosters[kind]--;
    state.boosterUsed = true;
    state.boosterMode = null;
    var cells = [i];
    if (kind === 'bomb') {
      var r0 = Math.floor(i / COLS), c0 = i % COLS;
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          var nr = r0 + dr, nc = c0 + dc;
          if (nr >= 0 && nc >= 0 && nr < ROWS && nc < COLS) cells.push(idx(nr, nc));
        }
      }
    }
    state.selected = -1;
    state.hint = null;
    msgEl.textContent = T(kind === 'hammer' ? 'gs.match3.boosterUsedHammer' : 'gs.match3.boosterUsedBomb');
    msgEl.style.color = 'var(--neon-cyan)';
    audio('merge');
    updateHud();
    startClear(1, cells, null, false);
  }

  function tapCell(i) {
    if (!state || state.over || state.phase !== 'idle') return;
    if (!isValidCell(i)) return;
    state.idleT = 0;
    state.hint = null;
    state.cursorOn = false;

    if (state.boosterMode) {
      applyBoosterAt(i, state.boosterMode);
      return;
    }

    if (state.selected < 0) {
      state.selected = i;
      audio('ui');
      return;
    }
    if (state.selected === i) {
      state.selected = -1;
      audio('back');
      return;
    }
    var ar = Math.floor(state.selected / COLS), ac = state.selected % COLS;
    var br = Math.floor(i / COLS), bc = i % COLS;
    if (Math.abs(ar - br) + Math.abs(ac - bc) === 1) {
      attemptSwap(state.selected, i);
      return;
    }
    state.selected = i;
    audio('ui');
  }

  function attemptSwap(a, b) {
    if (!state || state.over || state.phase !== 'idle') return;
    if (a < 0 || b < 0 || a === b) return;
    var ar = Math.floor(a / COLS), ac = a % COLS;
    var br = Math.floor(b / COLS), bc = b % COLS;
    if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) {
      state.selected = b;
      return;
    }
    var ga = state.board[a], gb = state.board[b];
    if (!ga || !gb) return;

    var isRainbow = ga.special === 'rainbow' || gb.special === 'rainbow';
    var valid = isRainbow || wouldMatch(state.board, a, b);

    state.selected = -1;
    state.hint = null;
    state.idleT = 0;
    state.cursorOn = false;

    if (!valid) {
      msgEl.textContent = T('gs.match3.invalid');
      msgEl.style.color = 'var(--neon-pink)';
      audio('error');
      state.phase = 'swapping';
      state.anim = { kind: 'swap', t: 0, dur: SWAP_MS, a: a, b: b, ok: false };
      return;
    }

    state.movesLeft--;
    updateHud();
    msgEl.textContent = '';
    msgEl.style.color = '';
    state.lastSwap = [a, b];

    var rainbowAt = -1, rType = -1;
    if (isRainbow) {
      if (ga.special === 'rainbow' && gb.special === 'rainbow') {
        rainbowAt = -1; rType = -1;
      } else if (ga.special === 'rainbow') {
        rainbowAt = b; rType = gb.type;
      } else {
        rainbowAt = a; rType = ga.type;
      }
    }

    state.phase = 'swapping';
    state.anim = {
      kind: 'swap', t: 0, dur: SWAP_MS, a: a, b: b, ok: true,
      rainbow: isRainbow, rainbowAt: rainbowAt, rType: rType
    };
    audio(isRainbow ? 'merge' : 'move');
  }

  function onPointerDown(e) {
    if (!state || state.over || state.phase !== 'idle') return;
    var p = window.GK && GK.pointer ? GK.pointer(canvas, e) : null;
    if (!p) return;
    var i = cellIndexFromPoint(p.x, p.y);
    if (i < 0) return;
    drag = { i: i, x: p.x, y: p.y };
    state.cursorOn = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function onPointerUp(e) {
    if (!drag) return;
    var start = drag.i;
    var sx = drag.x, sy = drag.y;
    drag = null;
    if (!state || state.over || state.phase !== 'idle') return;
    var p = window.GK && GK.pointer ? GK.pointer(canvas, e) : null;
    if (!p) return;
    var dx = p.x - sx, dy = p.y - sy;
    var threshold = Math.min(CW, CH) * 0.32;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > threshold) {
      var tr = 0, tc = 0;
      if (Math.abs(dx) > Math.abs(dy)) tc = dx > 0 ? 1 : -1;
      else tr = dy > 0 ? 1 : -1;
      var r = Math.floor(start / COLS) + tr;
      var c = start % COLS + tc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        state.selected = -1;
        attemptSwap(start, idx(r, c));
      }
    } else {
      tapCell(start);
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!reviewEl.classList.contains('hidden')) { e.preventDefault(); closeReview(); }
      return;
    }
    if (!state || state.over || state.phase !== 'idle') return;
    if (!pickEl.classList.contains('hidden') || !resultEl.classList.contains('hidden') || !reviewEl.classList.contains('hidden')) return;
    if (document.querySelector('.tut-overlay')) return;

    var dr = 0, dc = 0;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dr = -1;
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dr = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dc = -1;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dc = 1;

    if (dr || dc) {
      e.preventDefault();
      state.cursor.r = clamp(state.cursor.r + dr, 0, ROWS - 1);
      state.cursor.c = clamp(state.cursor.c + dc, 0, COLS - 1);
      state.cursorOn = true;
      state.idleT = 0;
      state.hint = null;
      audio('ui');
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
      e.preventDefault();
      tapCell(idx(state.cursor.r, state.cursor.c));
      if (state) state.cursorOn = true;
    }
  });

  /* ---------- 主循环 ---------- */
  function update() {
    if (!state) return;
    updateFx();
    if (state.flash > 0) state.flash = Math.max(0, state.flash - 0.045);
    if (state.phase === 'over') return;
    if (state.anim) state.anim.t += 16;

    if (state.phase === 'swapping') updateSwap();
    else if (state.phase === 'clearing') updateClear();
    else if (state.phase === 'falling') updateFall();
    else if (state.phase === 'settle') {
      state.settleT -= 16;
      if (state.settleT <= 0) resolveAfterFall();
    } else if (state.phase === 'shuffling') updateShuffle();
    else if (state.phase === 'idle') {
      state.idleT += 16;
      if (state.idleT > 5000 && !state.hint) {
        state.hint = findHint(state.board);
        if (state.hint) {
          msgEl.textContent = T('gs.match3.hint');
          msgEl.style.color = 'var(--neon-cyan)';
        }
      }
    }
  }

  function updateFx() {
    var i;
    for (i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.vy += 0.17;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.rot += p.vr;
      p.x = clamp(p.x, PAD, W - PAD);
      p.y = clamp(p.y, PAD, H - PAD);
      p.life -= 0.027;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (i = state.shocks.length - 1; i >= 0; i--) {
      var sh = state.shocks[i];
      sh.r += Math.max(2, sh.maxR * 0.055);
      sh.life -= 0.052;
      if (sh.life <= 0) state.shocks.splice(i, 1);
    }
    for (i = state.beams.length - 1; i >= 0; i--) {
      state.beams[i].life -= 0.055;
      if (state.beams[i].life <= 0) state.beams.splice(i, 1);
    }
  }

  /* ---------- 绘制 ---------- */
  function shapePath(type, r) {
    ctx.beginPath();
    var i, a;
    if (type === 1) {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else if (type === 0) {
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.78, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.78, 0);
      ctx.closePath();
    } else if (type === 2) {
      for (i = 0; i < 6; i++) {
        a = -Math.PI / 2 + i * Math.PI / 3;
        var hx = Math.cos(a) * r, hy = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
    } else if (type === 3) {
      for (i = 0; i < 10; i++) {
        a = -Math.PI / 2 + i * Math.PI / 5;
        var sr = i % 2 === 0 ? r : r * 0.45;
        var sx = Math.cos(a) * sr, sy = Math.sin(a) * sr;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
    } else if (type === 4) {
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.82, -r * 0.1, r * 0.86, r * 0.5, 0, r * 0.94);
      ctx.bezierCurveTo(-r * 0.86, r * 0.5, -r * 0.82, -r * 0.1, 0, -r);
      ctx.closePath();
    } else {
      for (i = 0; i < 8; i++) {
        a = Math.PI / 8 + i * Math.PI / 4;
        var ox = Math.cos(a) * r, oy = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
      }
      ctx.closePath();
    }
  }

  function drawNormalGem(type, r, special) {
    var style = GEM_STYLES[type] || GEM_STYLES[0];
    ctx.shadowColor = style.main;
    ctx.shadowBlur = r * 0.55;
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.15);
    g.addColorStop(0, style.light);
    g.addColorStop(0.45, style.main);
    g.addColorStop(1, style.dark);
    shapePath(type, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    shapePath(type, r);
    ctx.clip();
    var lg = ctx.createLinearGradient(0, -r, 0, r);
    lg.addColorStop(0, 'rgba(255,255,255,0.32)');
    lg.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    lg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = lg;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    var ig = ctx.createRadialGradient(0, r * 0.1, r * 0.18, 0, 0, r * 1.1);
    ig.addColorStop(0, 'rgba(0,0,0,0)');
    ig.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = ig;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.38, r * 0.26, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    if (special === 'lineH' || special === 'lineV') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      var step = r * 0.62;
      if (special === 'lineH') {
        for (var yy = -r * 0.9; yy <= r * 0.9; yy += step) ctx.fillRect(-r, yy - r * 0.09, r * 2, r * 0.18);
      } else {
        for (var xx = -r * 0.9; xx <= r * 0.9; xx += step) ctx.fillRect(xx - r * 0.09, -r, r * 0.18, r * 2);
      }
    }
    ctx.restore();

    shapePath(type, r);
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();

    if (special === 'lineH' || special === 'lineV') {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = r * 0.5;
      shapePath(type, r);
      ctx.lineWidth = Math.max(1.4, r * 0.09);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.stroke();
      ctx.restore();
    }

    /* 十字炸弹：白色四向尖刺 + 旋转外环 */
    if (special === 'bomb') {
      ctx.save();
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = r * 0.8;
      ctx.strokeStyle = 'rgba(255,230,0,0.95)';
      ctx.lineWidth = Math.max(1.2, r * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (var bi = 0; bi < 4; bi++) {
        ctx.save();
        ctx.rotate(bi * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.02);
        ctx.lineTo(r * 0.11, 0);
        ctx.lineTo(0, r * 0.2);
        ctx.lineTo(-r * 0.11, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRainbowGem(r) {
    var lg = ctx.createLinearGradient(-r, -r, r, r);
    lg.addColorStop(0, '#ff2d95');
    lg.addColorStop(0.18, '#ff9f1c');
    lg.addColorStop(0.36, '#ffe600');
    lg.addColorStop(0.54, '#39ff14');
    lg.addColorStop(0.72, '#00f0ff');
    lg.addColorStop(0.9, '#b967ff');
    lg.addColorStop(1, '#ff2d95');
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = r * 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    var wrap = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.03, 0, 0, r * 1.2);
    wrap.addColorStop(0, 'rgba(255,255,255,0.92)');
    wrap.addColorStop(0.4, 'rgba(255,255,255,0.1)');
    wrap.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = wrap;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.4, r * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2 + Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(r * 0.08, 0);
      ctx.lineTo(0, r * 0.55);
      ctx.lineTo(-r * 0.08, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGem(gem, i) {
    if (!gem || gem.alpha <= 0.01 || gem.scale <= 0.01) return;
    var cc = cellCenter(i);
    var x = cc.x + gem.ox * CW;
    var y = cc.y + gem.oy * CH;
    var r = Math.min(CW, CH) * 0.36 * gem.scale;
    if (state.selected === i && state.phase === 'idle') {
      r *= 1.06 + Math.sin(nowMs() / 220) * 0.035;
    }
    if (r < 1) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, gem.alpha));
    ctx.translate(x, y);
    if (gem.special === 'rainbow') drawRainbowGem(r);
    else drawNormalGem(gem.type, r, gem.special);
    ctx.restore();
  }

  function drawCellGlow(i, color, scale) {
    var cc = cellCenter(i);
    var r = Math.min(CW, CH) * (scale || 0.46);
    var pulse = 0.55 + 0.35 * Math.sin(nowMs() / 190);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    rr(ctx, cc.x - r, cc.y - r, r * 2, r * 2, 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoardBg() {
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0a18');
    bg.addColorStop(0.55, '#101024');
    bg.addColorStop(1, '#090912');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var rad = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, W * 0.75);
    rad.addColorStop(0, 'rgba(0,240,255,0.07)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = PAD + c * CW;
        var y = PAD + r * CH;
        ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.026)' : 'rgba(0,240,255,0.036)';
        rr(ctx, x + 1, y + 1, CW - 2, CH - 2, Math.min(CW, CH) * 0.16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,240,255,0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* 冰层：半透明霜面 + 裂纹 + 冰棱边角（宝石绘制在其上） */
    if (state.ice) {
      for (var ii = 0; ii < state.ice.length; ii++) {
        if (!state.ice[ii]) continue;
        var ir = Math.floor(ii / COLS), ic = ii % COLS;
        var ix = PAD + ic * CW, iy = PAD + ir * CH;
        ctx.save();
        var frost = ctx.createLinearGradient(ix, iy, ix + CW, iy + CH);
        frost.addColorStop(0, 'rgba(200,240,255,0.30)');
        frost.addColorStop(0.5, 'rgba(120,200,255,0.16)');
        frost.addColorStop(1, 'rgba(220,250,255,0.30)');
        ctx.fillStyle = frost;
        rr(ctx, ix + 2, iy + 2, CW - 4, CH - 4, Math.min(CW, CH) * 0.18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(210,245,255,0.75)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ix + CW * 0.22, iy + CH * 0.3);
        ctx.lineTo(ix + CW * 0.44, iy + CH * 0.55);
        ctx.lineTo(ix + CW * 0.36, iy + CH * 0.8);
        ctx.moveTo(ix + CW * 0.62, iy + CH * 0.2);
        ctx.lineTo(ix + CW * 0.76, iy + CH * 0.48);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawBeams() {
    for (var i = 0; i < state.beams.length; i++) {
      var b = state.beams[i];
      var cc = cellCenter(b.i);
      var alpha = Math.max(0, b.life);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      if (b.dir === 'h') {
        ctx.moveTo(PAD, cc.y);
        ctx.lineTo(W - PAD, cc.y);
      } else {
        ctx.moveTo(cc.x, PAD);
        ctx.lineTo(cc.x, H - PAD);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawParticles() {
    /* 绘制钳制：粒子与冲击波只在棋盘内出现，坐标也钳到画布边界 */
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD, PAD, W - PAD * 2, H - PAD * 2);
    ctx.clip();
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      if (p.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.translate(clamp(p.x, PAD, W - PAD), clamp(p.y, PAD, H - PAD));
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    for (var s = 0; s < state.shocks.length; s++) {
      var sh = state.shocks[s];
      if (sh.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, sh.life) * 0.8;
      ctx.strokeStyle = sh.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(clamp(sh.x, PAD, W - PAD), clamp(sh.y, PAD, H - PAD), Math.min(sh.r, W), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCursor() {
    var i = idx(state.cursor.r, state.cursor.c);
    var cc = cellCenter(i);
    var r = Math.min(CW, CH) * 0.47;
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -(nowMs() / 55) % 9;
    rr(ctx, cc.x - r, cc.y - r, r * 2, r * 2, 10);
    ctx.stroke();
    ctx.restore();
  }

  function drawIdleBackdrop() {
    if (!W || !H) return;
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a0a18');
    bg.addColorStop(1, '#090912');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (!state) { drawIdleBackdrop(); return; }

    drawBoardBg();

    if (state.hint) {
      drawCellGlow(state.hint[0], '#00f0ff');
      drawCellGlow(state.hint[1], '#00f0ff');
    }
    if (state.selected >= 0) drawCellGlow(state.selected, '#ffe600');

    for (var i = 0; i < state.board.length; i++) drawGem(state.board[i], i);

    drawBeams();
    drawParticles();

    if (state.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.3, state.flash * 0.26) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (state.cursorOn && state.phase === 'idle') drawCursor();
    if (state.boosterMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,230,0,.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -(nowMs() / 40) % 16;
      rr(ctx, PAD - 4, PAD - 4, W - PAD * 2 + 8, H - PAD * 2 + 8, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- 事件绑定 ---------- */
  function replayCurrent() {
    if (!state) { openPicker(); return; }
    if (state.mode === 'daily') startDaily();
    else startLevel(state.level);
  }
  restartBtn.addEventListener('click', replayCurrent);
  if (mapBtn) mapBtn.addEventListener('click', function () { audio('ui'); openPicker(); });
  againBtn.addEventListener('click', replayCurrent);
  document.getElementById('m3-change').addEventListener('click', openPicker);
  if (nextBtn) nextBtn.addEventListener('click', function () {
    if (state && state.mode !== 'daily' && state.level < LEVELS.length - 1) startLevel(state.level + 1);
  });
  if (dailyPlayBtn) dailyPlayBtn.addEventListener('click', function () { audio('ui'); startDaily(); });
  document.getElementById('m3-rv-play').addEventListener('click', function () {
    if (reviewLevel >= 0) startLevel(reviewLevel);
  });
  document.getElementById('m3-rv-back').addEventListener('click', closeReview);
  if (boostersEl) {
    boostersEl.addEventListener('click', function (e) {
      var b = e.target.closest('.m3-boost');
      if (!b) return;
      useBooster(b.getAttribute('data-b'));
    });
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', function () { drag = null; });

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.match3.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    if (state) {
      if (state.mode === 'daily') startDaily();
      else startLevel(state.level);
    } else openPicker();
  };

  /* 调试钩子：仅 ?qa=1 时挂载，正常访问不暴露可篡改状态的入口 */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) window.__qa = {
    state: function () {
      if (!state) return null;
      var specials = 0, bombs = 0;
      for (var i = 0; i < state.board.length; i++) {
        if (state.board[i] && state.board[i].special) specials++;
        if (state.board[i] && state.board[i].special === 'bomb') bombs++;
      }
      var o = state.objective;
      return { score: state.score, target: o.target, movesLeft: state.movesLeft,
        maxMoves: state.maxMoves, level: state.level, mode: state.mode,
        objective: o.kind,
        collect: o.collect.map(function (x) { return x.got + '/' + x.need; }),
        iceLeft: o.iceLeft, iceTotal: o.iceTotal,
        boosters: { hammer: state.boosters.hammer, bomb: state.boosters.bomb, shuffle: state.boosters.shuffle },
        boosterUsed: state.boosterUsed,
        cursor: state.cursor, cursorOn: state.cursorOn, selected: state.selected,
        progress: progress,
        totalStars: totalStars(),
        dailyBest: dailyRecord.best, dailyDone: dailyRecord.done,
        phase: state.phase, over: state.over, chain: state.chain,
        maxChain: state.maxChain, specials: specials, bombs: bombs,
        particles: state.particles.length, type: state.board.map(function (g) { return g ? g.type : -1; }) };
    },
    findSwap: function () {
      if (!state) return null;
      var b = state.board;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var i = idx(r, c);
          var nb = [];
          if (c + 1 < COLS) nb.push(i + 1);
          if (r + 1 < ROWS) nb.push(i + COLS);
          for (var k = 0; k < nb.length; k++) {
            var j = nb[k];
            if (canSwap(b, i, j)) return { a: i, b: j };
          }
        }
      }
      return null;
    },
    swap: function (a, b) { attemptSwap(a, b); },
    setMoves: function (n) { if (state) { state.movesLeft = n; updateHud(); } },
    setScore: function (n) { if (state) { state.score = n; updateHud(); } },
    forceMatch: function (len, type) {
      if (!state || state.phase !== 'idle') return false;
      var t = (typeof type === 'number') ? type : 1;
      for (var c = 0; c < len; c++) state.board[idx(0, c)] = makeGem(t);
      startClear(1, null, findMatchGroups(state.board), false);
      return true;
    },
    forceL: function (type) {
      if (!state || state.phase !== 'idle') return false;
      var t = (typeof type === 'number') ? type : 1;
      state.board[idx(1, 1)] = makeGem(t);
      state.board[idx(1, 0)] = makeGem(t);
      state.board[idx(1, 2)] = makeGem(t);
      state.board[idx(0, 1)] = makeGem(t);
      state.board[idx(2, 1)] = makeGem(t);
      startClear(1, null, findMatchGroups(state.board), false);
      return true;
    },
    startLevel: startLevel,
    useBooster: useBooster,
    applyBooster: applyBoosterAt,
    tap: tapCell,
    forceWin: function () {
      if (!state) return false;
      var o = state.objective;
      if (o.kind === 'score') state.score = Math.max(state.score, o.target);
      if (o.kind === 'ice') o.iceLeft = 0;
      for (var i = 0; i < o.collect.length; i++) o.collect[i].got = o.collect[i].need;
      finishGame(true);
      return true;
    },
    setObjectiveDone: function () {
      if (!state) return false;
      var o = state.objective;
      if (o.kind === 'score') state.score = o.target;
      if (o.kind === 'ice') o.iceLeft = 0;
      for (var i = 0; i < o.collect.length; i++) o.collect[i].got = o.collect[i].need;
      updateHud();
      return true;
    },
    daily: function () {
      refreshDailyRecord();
      var d = dailyDef(dailyRecord.day);
      return {
        day: dailyRecord.day,
        localDay: dailyRecord.day,
        def: { day: d.day, tier: d.tier, kind: d.kind, rows: d.rows, cols: d.cols,
          types: d.types, moves: d.moves, target: d.target, ice: d.ice,
          collect: d.collect.map(function (p) { return p[0] + ':' + p[1]; }) },
        record: { day: dailyRecord.day, best: dailyRecord.best, done: dailyRecord.done },
        storage: (function () { try { return localStorage.getItem(DAILY_KEY); } catch (e) { return null; } })(),
        mode: state ? state.mode : null
      };
    },
    dailyFor: function (day) {
      var d = dailyDef(day);
      return { day: d.day, tier: d.tier, kind: d.kind, rows: d.rows, cols: d.cols,
        moves: d.moves, target: d.target, ice: d.ice,
        collect: d.collect.map(function (p) { return p[0] + ':' + p[1]; }) };
    },
    startDaily: function () { startDaily(); return true; },
    stars: function () {
      return starRecords.map(function (r) { return { stars: r.stars, best: r.best }; });
    },
    totalStars: totalStars,
    openReview: function (lv) { return openReview(lv); },
    closeReview: function () { closeReview(); return true; },
    reviewOpen: function () { return !reviewEl.classList.contains('hidden'); },
    reviewInfo: function () {
      if (reviewLevel < 0) return null;
      var rec = starRecords[reviewLevel] || { stars: 0, best: 0 };
      return { level: reviewLevel, title: reviewTitleEl.textContent,
        starnum: reviewStarNumEl.textContent, best: reviewBestEl.textContent,
        goal: reviewGoalEl.textContent, starsOn: reviewStarsEl.querySelectorAll('.m3-star.on').length };
    },
    mapInfo: function () {
      var levels = [];
      var btns = mapEl ? mapEl.querySelectorAll('.m3-lv') : [];
      for (var i = 0; i < btns.length; i++) {
        levels.push({
          level: i,
          done: btns[i].classList.contains('done'),
          locked: btns[i].classList.contains('locked'),
          starsOn: btns[i].querySelectorAll('.m3-star.on').length
        });
      }
      return { progress: progress, totalStars: totalStars(), levels: levels,
        dailyMeta: dailyMetaEl ? dailyMetaEl.textContent : '',
        starsTotalText: starsTotalEl ? starsTotalEl.textContent : '' };
    },
    closeOverlay: function () { openPicker(); },
    bounds: function () {
      var list = state ? state.particles.map(function (p) { return { x: p.x, y: p.y }; }) : [];
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      var inside = true;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (p.x < PAD || p.x > W - PAD || p.y < PAD || p.y > H - PAD) inside = false;
      }
      return { w: W, h: H, pad: PAD, count: list.length,
        minX: list.length ? minX : null, minY: list.length ? minY : null,
        maxX: list.length ? maxX : null, maxY: list.length ? maxY : null,
        inside: inside, particles: list };
    }
  };

  openPicker();
})();
