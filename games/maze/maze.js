/* 迷宫 Maze (DFS 程序化无限层 · 远征 / 无尽 / 每日挑战)
   —— 旗舰级重制（在 4 关版本上增量升级）
   视觉：烘焙地板/渐变墙体 + 辉光传送门 + 发光玩家 + 粒子拖尾 + 呼吸迷雾
   机制：程序化 DFS 层、尺寸/陷阱/游荡幽灵递增、宝石钥匙计分、生命值、
         远征 8 层胜利结算、无尽无限层、每日固定种子、断点续玩
   核心标记：GAME_TUTORIAL_STEPS / window.GAME_RESTART / IIFE 均保留。 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.maze.tut1t'), d: T('gs.maze.tut1') },
  { t: T('gs.maze.tut2t'), d: T('gs.maze.tut2') },
  { t: T('gs.maze.tut3t'), d: T('gs.maze.tut3') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var BOARD = 360;
  var STEP_MS = 16;      // 逻辑步长（Arcade.loop 与 16ms 对齐）
  var MOVE_MS = 120;     // 单步补间（≥100ms 缓动）
  var BEST_KEY = (window.Arcade && Arcade.shell && Arcade.shell.gameId) || 'maze';
  /* 新计分模型为「越高越好」：总分含宝石/钥匙/剩余时间奖励 */
  if (window.Arcade && Arcade.shell && Arcade.shell.setBestMode) Arcade.shell.setBestMode('max');

  var EXPEDITION_FLOORS = 8;   // 远征固定 8 层
  var DAILY_FLOORS = 5;        // 每日挑战 5 层固定种子
  var MODES = ['expedition', 'endless', 'daily'];
  var MODE_T = {
    expedition: 'gs.maze.modeExpedition',
    endless: 'gs.maze.modeEndless',
    daily: 'gs.maze.modeDaily'
  };
  var MODE_D = {
    expedition: 'gs.maze.modeExpeditionD',
    endless: 'gs.maze.modeEndlessD',
    daily: 'gs.maze.modeDailyD'
  };
  var FLOOR_COLORS = ['#00f0ff', '#ff2d95', '#39ff14', '#ffe600', '#9d7bff', '#ff8a3d', '#2df2c4', '#ff5f6d'];
  var DIFFS = [
    { timeMul: 1.30, trapMul: 0.60 },
    { timeMul: 1.00, trapMul: 1.00 },
    { timeMul: 0.80, trapMul: 1.35 }
  ];
  var DIFF_KEY = ['diffEasy', 'diffNormal', 'diffHard'];
  var DIFF_DESC = ['diffEasyD', 'diffNormalD', 'diffHardD'];

  /* ================= 主题皮肤（独立持久化；不影响种子 / 难度 / 计分） ================= */
  var THEME_KEY = 'arcade_maze_theme';
  var THEMES = [
    { id: 'neon', name: 'gs.maze.themeNeon', accent: '#00f0ff', accent2: '#ff2d95',
      floors: FLOOR_COLORS.slice(),
      bg: ['#080d1a', '#060a13', '#0d1020'], bgSolid: '#070b14',
      player: '#00f0ff', enemy: '#ff2d95', hunter: '#ff2d55',
      gem: '#ffe600', key: '#00f0ff', door: '#ffe600', fog: '4,7,15' },
    { id: 'aurora', name: 'gs.maze.themeAurora', accent: '#39ffd0', accent2: '#8a7dff',
      floors: ['#5ffbf1', '#7cff9e', '#8a7dff', '#c6ff6b', '#4de3ff', '#b0ffe0', '#6fa8ff', '#9dffe8'],
      bg: ['#04121a', '#030f16', '#061a24'], bgSolid: '#04141d',
      player: '#7ffcff', enemy: '#8a7dff', hunter: '#ff4d6d',
      gem: '#c6ff6b', key: '#9dffe8', door: '#5ffbf1', fog: '4,12,20' },
    { id: 'ember', name: 'gs.maze.themeEmber', accent: '#ff8a3d', accent2: '#ff2d55',
      floors: ['#ff8a3d', '#ff3d3d', '#ffb347', '#ff6b00', '#ff2d55', '#ffd166', '#ff7a5c', '#ffae42'],
      bg: ['#180a06', '#120705', '#210c07'], bgSolid: '#160a06',
      player: '#ffd38a', enemy: '#ff2d55', hunter: '#ff3860',
      gem: '#ffcf4d', key: '#ffd166', door: '#ffb347', fog: '14,6,4' }
  ];
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }
  function loadTheme() {
    try { return themeById(localStorage.getItem(THEME_KEY)); } catch (e) { return THEMES[0]; }
  }
  var activeTheme = loadTheme();

  /* 追猎者：按模式与层数出现；速度明显慢于玩家，可用绕路与未开门反制 */
  function hunterCount(floor, mode) {
    if (mode === 'daily') return floor >= 4 ? 1 : 0;
    if (mode === 'expedition') return floor >= 4 ? (floor >= 7 ? 2 : 1) : 0;
    return floor >= 3 ? Math.min(1 + Math.floor((floor - 3) / 3), 3) : 0;
  }
  function hunterSpeed(floor, mode) {
    var base;
    if (mode === 'daily') base = 1.45 - floor * 0.04;
    else if (mode === 'expedition') base = 1.05 - floor * 0.035;
    else base = 1.00 - Math.min(floor, 12) * 0.03;
    return Math.max(0.6, base);
  }

  /* 程序化层配置：尺寸封顶 25（保证格子仍可点按），压力持续上升 */
  function floorConf(floor) {
    var size = Math.min(9 + (floor - 1) * 2, 25);
    var keys = floor >= 2 ? Math.min(1 + Math.floor((floor - 1) / 2), 3) : 0;
    return {
      size: size,
      time: 50 + size * 2 + floor * 4,
      gems: 3 + Math.min(floor, 7),
      keys: keys,
      doors: keys,
      traps: Math.min(2 + Math.floor(floor * 1.25), 14),
      enemies: floor >= 2 ? Math.min(1 + Math.floor((floor - 2) / 2), 5) : 0,
      color: FLOOR_COLORS[(floor - 1) % FLOOR_COLORS.length],
      floor: floor
    };
  }
  function floorLimit(mode) {
    if (mode === 'expedition') return EXPEDITION_FLOORS;
    if (mode === 'daily') return DAILY_FLOORS;
    return 0; // 无尽
  }
  /* 每日挑战时限放宽（仅每日，远征/无尽不变）：每层 +20 秒；
     第 4/5 层陷阱在唯一必经路上（各 30 秒）+ 猎手绕行，再补 +20 秒 */
  function floorTimeLeft(floor, diff, mode) {
    var base = floorConf(floor).time * ((diff || DIFFS[1]).timeMul);
    if (mode !== 'daily') return base;
    return base + 20 + (floor >= 4 ? 20 : 0);
  }
  function modeName(mode) { return T(MODE_T[mode] || MODE_T.expedition); }

  var DIRS = {
    up: { dr: -1, dc: 0 }, down: { dr: 1, dc: 0 },
    left: { dr: 0, dc: -1 }, right: { dr: 0, dc: 1 }
  };
  var KEYDIR = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };

  var QA_MODE = /(?:^|[?&])qa=1(?:&|$)/.test(window.location.search);
  function sfx(name) { if (window.Arcade && Arcade.audio) Arcade.audio.play(name); }
  /* QA 自动化无真实用户手势，浏览器会拦截 vibrate 并在控制台报错；
     qa 会话里静音音频（不动共享代码，正常访问完全不受影响） */
  if (QA_MODE && window.Arcade && Arcade.audio) Arcade.audio.play = function () {};
  function bestScore() {
    try { return (window.Arcade && Arcade.storage) ? Arcade.storage.getBest(BEST_KEY) : null; }
    catch (e) { return null; }
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function rr(g, x, y, w, h, r) {
    if (window.GK) { GK.roundRect(g, x, y, w, h, r); return; }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ================= 可复现随机种子 ================= */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function dailyDate() {
    if (window.Arcade && Arcade.daily && Arcade.daily.dayStr) return Arcade.daily.dayStr();
    var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function dailySeed() { return hashStr('maze-daily-' + dailyDate()); }
  function deriveSeed(runSeed, floor) { return hashStr(String(runSeed) + ':' + floor); }
  function seedHex(n) { return '#' + ('00000000' + (n >>> 0).toString(16)).slice(-8).toUpperCase(); }

  /* ================= UI 骨架 ================= */
  function modeCard(mode, badge) {
    return '<button class="mz-mode" data-mode="' + mode + '">' +
      '<span class="mz-mode-main"><b>' + T(MODE_T[mode]) + '</b><small>' + T(MODE_D[mode]) +
      (mode === 'daily' ? '<span class="mz-daily-meta" id="mz-daily-meta"></span>' : '') +
      '</small></span>' +
      '<span class="mz-mode-badge">' + badge + '</span></button>';
  }
  var diffHtml = DIFFS.map(function (d, i) {
    return '<button class="mz-diffchip' + (i === 1 ? ' on' : '') + '" data-d="' + i + '" title="' + T('gs.maze.' + DIFF_DESC[i]) + '">' +
      T('gs.maze.' + DIFF_KEY[i]) + '</button>';
  }).join('');
  var themeHtml = THEMES.map(function (t) {
    return '<button class="mz-themechip' + (t.id === activeTheme.id ? ' on' : '') + '" data-t="' + t.id + '">' + T(t.name) + '</button>';
  }).join('');

  root.innerHTML =
    '<div class="mz-wrap">' +
    '  <div class="mz-pick" id="mz-pick">' +
    '    <div class="mz-pick-t">' + T('gs.maze.pickT') + '</div>' +
    '    <div class="mz-pick-d">' + T('gs.maze.pickD') + '</div>' +
    '    <div class="mz-modes">' + modeCard('expedition', '8') + modeCard('endless', '∞') + modeCard('daily', 'D') + '</div>' +
    '    <div class="mz-diffrow"><span class="mz-diffrow-t">' + T('gs.maze.diffLabel') + '</span>' + diffHtml + '</div>' +
    '    <div class="mz-themerow"><span class="mz-themerow-t">' + T('gs.maze.themeLabel') + '</span><div class="mz-themes">' + themeHtml + '</div></div>' +
    '    <div class="mz-pick-best" id="mz-pick-best"></div>' +
    '  </div>' +
    '  <div class="mz-game mz-hidden" id="mz-game">' +
    '    <div class="mz-hud">' +
    '      <span class="mz-pill mode"><span id="mz-mode">' + T(MODE_T.expedition) + '</span></span>' +
    '      <span class="mz-pill"><span>' + T('gs.maze.floor') + '</span><b id="mz-level">1/8</b></span>' +
    '      <span class="mz-pill" id="mz-time-pill"><span>' + T('gs.maze.time') + '</span><b id="mz-time">--:--</b></span>' +
    '      <span class="mz-pill" id="mz-life-pill"><span>' + T('gs.maze.life') + '</span><b id="mz-life">3</b></span>' +
    '      <span class="mz-pill mz-hidden" id="mz-hunt-pill"><span>' + T('gs.maze.hunterHud') + '</span><b id="mz-hunt">0</b></span>' +
    '      <span class="mz-pill"><span>' + T('gs.maze.steps') + '</span><b id="mz-steps">0</b></span>' +
    '      <span class="mz-pill"><span>' + T('gs.maze.gems') + '</span><b id="mz-gems">0</b></span>' +
    '      <span class="mz-pill"><span>' + T('gs.maze.keys') + '</span><b id="mz-keys">0</b></span>' +
    '      <span class="mz-pill hot"><span>' + T('gs.maze.score') + '</span><b id="mz-score">0</b></span>' +
    '    </div>' +
    '    <div class="mz-stage" id="mz-stage">' +
    '      <canvas class="mz-canvas" id="mz-cv" width="360" height="360"></canvas>' +
    '      <div class="mz-banner" id="mz-banner"></div>' +
    '      <div class="mz-overlay mz-hidden" id="mz-overlay"></div>' +
    '    </div>' +
    '    <div class="mz-controls">' +
    '      <div class="mz-dpad">' +
    '        <i class="mz-sp"></i><button data-d="up" aria-label="up">▲</button><i class="mz-sp"></i>' +
    '        <button data-d="left" aria-label="left">◀</button><button data-d="down" aria-label="down">▼</button><button data-d="right" aria-label="right">▶</button>' +
    '      </div>' +
    '      <div class="mz-side">' +
    '        <button class="mz-mini" id="mz-fog"></button>' +
    '        <button class="mz-mini" id="mz-back">' + T('gs.maze.changeMode') + '</button>' +
    '      </div>' +
    '    </div>' +
    '    <div class="mz-msg" id="mz-msg"></div>' +
    '  </div>' +
    '</div>';

  var pickEl = root.querySelector('#mz-pick');
  var gameEl = root.querySelector('#mz-game');
  var stageEl = root.querySelector('#mz-stage');
  var canvas = root.querySelector('#mz-cv');
  var bannerEl = root.querySelector('#mz-banner');
  var overlayEl = root.querySelector('#mz-overlay');
  var msgEl = root.querySelector('#mz-msg');
  var levelEl = root.querySelector('#mz-level');
  var modeEl = root.querySelector('#mz-mode');
  var lifeEl = root.querySelector('#mz-life');
  var lifePill = root.querySelector('#mz-life-pill');
  var huntEl = root.querySelector('#mz-hunt');
  var huntPill = root.querySelector('#mz-hunt-pill');
  var timeEl = root.querySelector('#mz-time');
  var timePill = root.querySelector('#mz-time-pill');
  var stepsEl = root.querySelector('#mz-steps');
  var gemsEl = root.querySelector('#mz-gems');
  var keysEl = root.querySelector('#mz-keys');
  var scoreEl = root.querySelector('#mz-score');
  var pickBestEl = root.querySelector('#mz-pick-best');
  var fogBtn = root.querySelector('#mz-fog');

  var ctx;
  if (window.GK) {
    ctx = GK.setup(canvas, BOARD, BOARD).ctx;
  } else {
    ctx = canvas.getContext('2d');
    if (window.Arcade && Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = BOARD + 'px';

  var state = {
    phase: 'menu', diff: 1, mode: 'expedition', floor: 1, clearedFloors: 0,
    runSeed: dailySeed(), totalScore: 0, totalSteps: 0, totalGems: 0, totalKeys: 0,
    elapsed: 0, submitted: false, won: false, fog: false, board: null,
    hp: 3, invuln: 0, failReason: '', theme: activeTheme
  };
  var held = {}, dirQueue = [];
  var transitionTimer = null, bannerTimer = null, msgTimer = null;
  var loopApi = null;

  function applyTheme(t) {
    t = t || THEMES[0];
    var wrap = root.querySelector('.mz-wrap');
    if (!wrap || !wrap.style) return;
    var v = {
      '--mz-a': t.accent, '--mz-b': t.accent2,
      '--mz-a-soft': rgba(t.accent, 0.10), '--mz-b-soft': rgba(t.accent2, 0.07),
      '--mz-a-soft2': rgba(t.accent, 0.16), '--mz-b-soft2': rgba(t.accent2, 0.10),
      '--mz-a-line': rgba(t.accent, 0.30), '--mz-a-line2': rgba(t.accent, 0.68),
      '--mz-glow': rgba(t.accent, 0.18), '--mz-glow-b': rgba(t.accent2, 0.55),
      '--mz-bg': t.bgSolid
    };
    for (var k in v) wrap.style.setProperty(k, v[k]);
    wrap.setAttribute('data-mz-theme', t.id);
  }
  function setTheme(id, persist) {
    var t = themeById(id);
    state.theme = t;
    applyTheme(t);
    var tb = root.querySelectorAll('.mz-themechip');
    for (var i = 0; i < tb.length; i++) tb[i].classList.toggle('on', tb[i].getAttribute('data-t') === t.id);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, t.id); } catch (e) {}
      sfx('ui');
    }
  }
  applyTheme(state.theme);

  function clearTimers() {
    if (transitionTimer) { clearTimeout(transitionTimer); transitionTimer = null; }
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
    if (msgTimer) { clearTimeout(msgTimer); msgTimer = null; }
  }
  function flashMsg(text, color, ms) {
    msgEl.textContent = text;
    msgEl.style.color = color || 'var(--neon-pink)';
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { msgEl.textContent = ''; }, ms || 1800);
  }
  function showBanner(main, sub, color, ms) {
    bannerEl.style.color = color || 'var(--neon-cyan)';
    bannerEl.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bannerEl.classList.remove('show'); }, ms || 1400);
  }
  function clientAt(x, y) {
    if (window.GK && GK.toClient) return GK.toClient(canvas, x, y);
    var r = canvas.getBoundingClientRect();
    return { x: r.left + x * (r.width / BOARD), y: r.top + y * (r.height / BOARD) };
  }
  function juice(name, x, y, color) {
    if (!window.Arcade || !Arcade.juice) return;
    var p = clientAt(x, y);
    if (name === 'coin') Arcade.juice.coin(p.x, p.y, color);
    else if (name === 'merge') Arcade.juice.merge(p.x, p.y, color);
    else if (name === 'clear') Arcade.juice.clear(p.x, p.y, color, 12);
  }
  function setText(el, v) {
    if (!el) return;
    if (el.__v !== v) { el.__v = v; el.textContent = v; }
  }

  function refreshPickBest() {
    var b = bestScore();
    pickBestEl.innerHTML = T('gs.maze.best') + ' <b>' + (b === null ? '----' : b) + '</b>';
    var meta = root.querySelector('#mz-daily-meta');
    if (meta) {
      var solved = (window.Arcade && Arcade.daily) ? Arcade.daily.isSolved('maze') : false;
      var st = (window.Arcade && Arcade.daily) ? Arcade.daily.solvedTime('maze') : null;
      meta.textContent = dailyDate() + ' · ' + T('gs.maze.seed') + ' ' + seedHex(dailySeed()) +
        ' · ' + (solved ? T('gs.maze.dailyDone').replace('{n}', String(st)) : T('gs.maze.dailyPending'));
    }
  }

  /* ================= 迷宫生成 / 关卡装配 ================= */
  function genMaze(size, rnd) {
    rnd = rnd || Math.random;
    var walls = [], visited = [], r, c, i;
    for (r = 0; r < size; r++) {
      walls[r] = []; visited[r] = [];
      for (c = 0; c < size; c++) {
        walls[r][c] = { N: true, E: true, S: true, W: true };
        visited[r][c] = false;
      }
    }
    var dirs = [[-1, 0, 'N', 'S'], [1, 0, 'S', 'N'], [0, -1, 'W', 'E'], [0, 1, 'E', 'W']];
    var stack = [[0, 0]];
    visited[0][0] = true;
    while (stack.length) {
      var cur = stack[stack.length - 1];
      var opts = [];
      for (i = 0; i < 4; i++) {
        var nr = cur[0] + dirs[i][0], nc = cur[1] + dirs[i][1];
        if (nr >= 0 && nc >= 0 && nr < size && nc < size && !visited[nr][nc]) opts.push(dirs[i]);
      }
      if (!opts.length) { stack.pop(); continue; }
      var d = opts[Math.floor(rnd() * opts.length)];
      var nr2 = cur[0] + d[0], nc2 = cur[1] + d[1];
      walls[cur[0]][cur[1]][d[2]] = false;
      walls[nr2][nc2][d[3]] = false;
      visited[nr2][nc2] = true;
      stack.push([nr2, nc2]);
    }
    /* 编织：少量打开死胡同，形成环路，增加路径选择 */
    for (r = 1; r < size - 1; r++) {
      for (c = 1; c < size - 1; c++) {
        var w = walls[r][c];
        var open = (!w.N ? 1 : 0) + (!w.E ? 1 : 0) + (!w.S ? 1 : 0) + (!w.W ? 1 : 0);
        if (open !== 1 || rnd() > 0.16) continue;
        var cand = [];
        if (w.N) cand.push([-1, 0, 'N', 'S']);
        if (w.S) cand.push([1, 0, 'S', 'N']);
        if (w.W) cand.push([0, -1, 'W', 'E']);
        if (w.E) cand.push([0, 1, 'E', 'W']);
        if (!cand.length) continue;
        var dd = cand[Math.floor(rnd() * cand.length)];
        var br = r + dd[0], bc = c + dd[1];
        if (br <= 0 || bc <= 0 || br >= size - 1 || bc >= size - 1) continue;
        walls[r][c][dd[2]] = false;
        walls[br][bc][dd[3]] = false;
      }
    }
    return walls;
  }

  function hasPassage(w, r, c, dr, dc) {
    if (dr === -1) return !w[r][c].N;
    if (dr === 1) return !w[r][c].S;
    if (dc === -1) return !w[r][c].W;
    return !w[r][c].E;
  }
  function edgeKey(r, c, dr, dc) {
    if (dr === 0) return (dc === 1 ? r + ',' + c + ',E' : r + ',' + (c - 1) + ',E');
    return (dr === 1 ? r + ',' + c + ',S' : (r - 1) + ',' + c + ',S');
  }
  function doorAt(b, r, c, dr, dc) { return b.doors[edgeKey(r, c, dr, dc)]; }

  function bfsDist(size, w, sr, sc, doors) {
    var dist = [], q = [[sr, sc]], r, c;
    for (r = 0; r < size; r++) { dist[r] = []; for (c = 0; c < size; c++) dist[r][c] = -1; }
    dist[sr][sc] = 0;
    var steps = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (q.length) {
      var cur = q.shift();
      for (var i = 0; i < 4; i++) {
        var dr = steps[i][0], dc = steps[i][1];
        var nr = cur[0] + dr, nc = cur[1] + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        if (!hasPassage(w, cur[0], cur[1], dr, dc)) continue;
        if (doors && doors[edgeKey(cur[0], cur[1], dr, dc)]) continue;
        if (dist[nr][nc] >= 0) continue;
        dist[nr][nc] = dist[cur[0]][cur[1]] + 1;
        q.push([nr, nc]);
      }
    }
    return dist;
  }

  function shuffle(a, rnd) {
    rnd = rnd || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function makeBoard(floor, diffIdx, seed) {
    var conf = floorConf(floor);
    var theme = state.theme || THEMES[0];
    conf.color = theme.floors[(floor - 1) % theme.floors.length];
    var diff = DIFFS[diffIdx] || DIFFS[1];
    var rnd = mulberry32(seed >>> 0);
    var size = conf.size;
    var cell = BOARD / size;
    var walls = genMaze(size, rnd);
    /* 出口收敛为单入口，保证一扇门即可守住终点；
       若北侧只是封闭小口袋，则改封北、保留西侧与主迷宫连通，避免出口不可达 */
    var er = size - 1, ec = size - 1;
    if (hasPassage(walls, er, ec, -1, 0) && hasPassage(walls, er, ec, 0, -1)) {
      walls[er][ec].W = true;
      walls[er][ec - 1].E = true;
      var exitReach = bfsDist(size, walls, er - 1, ec, null);
      if (exitReach[0][0] < 0) {
        walls[er][ec].W = false;
        walls[er][ec - 1].E = false;
        walls[er][ec].N = true;
        walls[er - 1][ec].S = true;
      }
    }
    var doors = {};
    var occupied = {};
    occupied['0,0'] = true;
    occupied[(size - 1) + ',' + (size - 1)] = true;

    /* 门：优先封锁出口所在格，再随机补充；起点相邻边始终避开 */
    var edges = [], exitEdges = [], r, c;
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        if (c + 1 < size && hasPassage(walls, r, c, 0, 1) && !(r === 0 && c === 0)) edges.push([r, c, 0, 1]);
        if (r + 1 < size && hasPassage(walls, r, c, 1, 0) && !(r === size - 2 && c === size - 1)) edges.push([r, c, 1, 0]);
      }
    }
    if (hasPassage(walls, size - 1, size - 1, -1, 0)) exitEdges.push([size - 2, size - 1, 1, 0]);
    if (hasPassage(walls, size - 1, size - 1, 0, -1)) exitEdges.push([size - 1, size - 2, 0, 1]);
    var exitDoorKey = null;
    if (conf.doors > 0 && exitEdges.length) {
      var ex = exitEdges[Math.floor(rnd() * exitEdges.length)];
      exitDoorKey = edgeKey(ex[0], ex[1], ex[2], ex[3]);
      edges = edges.filter(function (ed) { return edgeKey(ed[0], ed[1], ed[2], ed[3]) !== exitDoorKey; });
      shuffle(edges, rnd);
      edges.unshift(ex);
    } else {
      shuffle(edges, rnd);
    }
    var needDoors = Math.min(conf.doors, edges.length);
    for (var i = 0; i < edges.length && Object.keys(doors).length < needDoors; i++) {
      var e = edges[i];
      var nr = e[0] + e[2], nc = e[1] + e[3];
      if (e[0] === 0 && e[1] === 0) continue;
      var key = edgeKey(e[0], e[1], e[2], e[3]);
      if (key !== exitDoorKey && nr === size - 1 && nc === size - 1) continue;
      var vertical = e[2] === 0;
      doors[key] = {
        key: key, r: e[0], c: e[1], dr: e[2], dc: e[3], open: false, flash: 0,
        x: vertical ? (e[1] + 1) * cell : (e[1] + 0.5) * cell,
        y: vertical ? (e[0] + 0.5) * cell : (e[0] + 1) * cell,
        vertical: vertical, len: cell * 0.82
      };
    }

    /* 起点可达域（把未开启的门视为墙） */
    var reach = bfsDist(size, walls, 0, 0, doors);
    var startComp = [];
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) if (reach[r][c] >= 0) startComp.push([r, c, reach[r][c]]);
    }
    var allDist = bfsDist(size, walls, 0, 0, null);

    var items = [];
    /* 钥匙一定在起点可达域内（不穿门就能拿到） */
    var keyCands = shuffle(startComp.filter(function (p) {
      return p[2] >= 2 && !occupied[p[0] + ',' + p[1]] && !(p[0] === size - 1 && p[1] === size - 1);
    }), rnd);
    var keyCount = Math.min(conf.keys, keyCands.length);
    for (i = 0; i < keyCount; i++) {
      var kp = keyCands[i];
      items.push({ type: 'key', r: kp[0], c: kp[1], done: false, ph: rnd() * 6.28 });
      occupied[kp[0] + ',' + kp[1]] = true;
    }
    /* 兜底：钥匙数量少于门数量时移除多余的门，避免死锁 */
    var doorKeys = Object.keys(doors);
    while (doorKeys.length > keyCount) {
      delete doors[doorKeys.pop()];
    }

    /* 宝石：全图可达格，避开起点/终点/已占用 */
    var gemCands = shuffle(startComp.filter(function (p) {
      return allDist[p[0]] && allDist[p[0]][p[1]] >= 2 &&
        !occupied[p[0] + ',' + p[1]] && !(p[0] === size - 1 && p[1] === size - 1);
    }), rnd);
    for (i = 0; i < gemCands.length && i < conf.gems; i++) {
      var gp = gemCands[i];
      items.push({ type: 'gem', r: gp[0], c: gp[1], done: false, ph: rnd() * 6.28 });
      occupied[gp[0] + ',' + gp[1]] = true;
    }

    /* 陷阱：远处空位，扣时间 */
    var trapCands = shuffle(startComp.filter(function (p) {
      return allDist[p[0]] && allDist[p[0]][p[1]] >= 3 && !occupied[p[0] + ',' + p[1]];
    }), rnd);
    var traps = [];
    var trapCount = clamp(Math.round(conf.traps * diff.trapMul), 0, trapCands.length);
    for (i = 0; i < trapCount; i++) {
      var tp = trapCands[i];
      traps.push({ r: tp[0], c: tp[1], armed: true, flash: 0 });
      occupied[tp[0] + ',' + tp[1]] = true;
    }

    /* 游荡幽灵：在远离起点的通路格巡逻，接触扣生命/时间 */
    var enemyCands = shuffle(startComp.filter(function (p) {
      return allDist[p[0]] && allDist[p[0]][p[1]] >= 5 && !occupied[p[0] + ',' + p[1]];
    }), rnd);
    var enemies = [];
    var enemyCount = Math.min(conf.enemies, enemyCands.length);
    var enemySpeed = Math.max(0.30, 0.78 - floor * 0.045);
    /* 每日挑战第 4/5 层改为「仅猎手」：猎手已提供追击压力，
       去掉游荡幽灵的随机接触，避免 5 层固定种子被随机夹击导致不可通关 */
    if (state.mode === 'daily' && floor >= 4) {
      enemyCount = 0;
    }
    for (i = 0; i < enemyCount; i++) {
      var ep = enemyCands[i];
      enemies.push({
        r: ep[0], c: ep[1], fr: ep[0], fc: ep[1], mt: 1,
        dir: { dr: 0, dc: 0 }, cd: rnd() * enemySpeed,
        speed: enemySpeed, ph: rnd() * 6.28, kind: 'ghost'
      });
      occupied[ep[0] + ',' + ep[1]] = true;
    }

    /* 猎手：在更高层出现，按 BFS 追向玩家；锁着的门会挡住它们 */
    var hunterTotal = hunterCount(floor, state.mode);
    var hSpeed = hunterSpeed(floor, state.mode);
    var hunterCands = shuffle(startComp.filter(function (p) {
      return allDist[p[0]] && allDist[p[0]][p[1]] >= 6 && !occupied[p[0] + ',' + p[1]];
    }), rnd);
    var huntersAdded = 0;
    for (i = 0; i < hunterTotal && i < hunterCands.length; i++) {
      var hc = hunterCands[i];
      enemies.push({
        r: hc[0], c: hc[1], fr: hc[0], fc: hc[1], mt: 1,
        dir: { dr: 0, dc: 0 }, cd: rnd() * hSpeed,
        speed: hSpeed, ph: rnd() * 6.28, kind: 'hunter'
      });
      occupied[hc[0] + ',' + hc[1]] = true;
      huntersAdded++;
    }

    var player = {
      r: 0, c: 0, sr: 0, sc: 0, px: 0, py: 0,
      dir: { dr: 0, dc: 1 }, moving: false, moveT: 1
    };
    var dust = [];
    for (i = 0; i < 34; i++) {
      dust.push({
        x: rnd() * BOARD, y: rnd() * BOARD,
        vx: (rnd() - 0.5) * 0.16, vy: -0.04 - rnd() * 0.12,
        size: 0.7 + rnd() * 1.6, a: 0.12 + rnd() * 0.28
      });
    }

    var b = {
      size: size, cell: cell, walls: walls, doors: doors,
      items: items, traps: traps, enemies: enemies, player: player,
      exit: { r: size - 1, c: size - 1 },
      floor: floor, seed: seed >>> 0,
      timeLeft: floorTimeLeft(floor, diff, state.mode),
      elapsed: 0, steps: 0, gems: 0, keys: 0, keyTotal: keyCount,
      particles: [], trail: [], dust: dust, rings: [],
      bump: null, bumpCd: 0, shake: 0, flash: 0,
      levelScore: 0, conf: conf, color: conf.color, theme: theme,
      hunters: huntersAdded, hunterNear: 99, huntWarnCd: 0, bake: null
    };
    bakeBoard(b);
    return b;
  }

  /* ================= 静态场景烘焙（地板 + 墙体） ================= */
  function bakeBoard(b) {
    var dpr = 2;
    var cvs = document.createElement('canvas');
    cvs.width = Math.round(BOARD * dpr);
    cvs.height = Math.round(BOARD * dpr);
    var g = cvs.getContext('2d');
    g.scale(dpr, dpr);
    var size = b.size, cell = b.cell, accent = b.color, r, c;
    var th = b.theme || THEMES[0];

    var bg = g.createLinearGradient(0, 0, BOARD, BOARD);
    bg.addColorStop(0, th.bg[0]);
    bg.addColorStop(0.5, th.bg[1]);
    bg.addColorStop(1, th.bg[2]);
    g.fillStyle = bg;
    g.fillRect(0, 0, BOARD, BOARD);
    var glow = g.createRadialGradient(BOARD * 0.18, BOARD * 0.12, 8, BOARD * 0.18, BOARD * 0.12, BOARD * 0.85);
    glow.addColorStop(0, rgba(accent, 0.13));
    glow.addColorStop(1, rgba(accent, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, BOARD, BOARD);

    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        var x = c * cell, y = r * cell;
        var cg = g.createLinearGradient(x, y, x + cell, y + cell);
        cg.addColorStop(0, ((r + c) & 1) ? 'rgba(255,255,255,0.030)' : 'rgba(255,255,255,0.014)');
        cg.addColorStop(1, 'rgba(0,0,0,0.10)');
        g.fillStyle = cg;
        rr(g, x + 1.4, y + 1.4, cell - 2.8, cell - 2.8, 3);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.035)';
        g.lineWidth = 1;
        g.strokeRect(x, y, cell, cell);
        /* 固定纹理微尘点（每格 3 个，确定性伪随机） */
        for (var s = 0; s < 3; s++) {
          var sx = x + ((((r * 7 + c * 13 + s * 29) % 23) + 2) / 27) * cell;
          var sy = y + ((((r * 11 + c * 5 + s * 41) % 19) + 2) / 23) * cell;
          g.fillStyle = rgba(accent, 0.055);
          g.beginPath();
          g.arc(sx, sy, 0.7 + (s % 2) * 0.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    }

    function paintEdge(x1, y1, x2, y2, horiz) {
      g.lineCap = 'butt';
      /* 外辉光 */
      g.save();
      g.shadowColor = accent;
      g.shadowBlur = cell * 0.55;
      g.strokeStyle = rgba(accent, 0.32);
      g.lineWidth = cell * 0.30;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.restore();
      /* 渐变主体 */
      var grad;
      if (horiz) grad = g.createLinearGradient(0, y1 - cell * 0.16, 0, y1 + cell * 0.16);
      else grad = g.createLinearGradient(x1 - cell * 0.16, 0, x1 + cell * 0.16, 0);
      grad.addColorStop(0, '#f4feff');
      grad.addColorStop(0.42, accent);
      grad.addColorStop(1, '#07101c');
      g.strokeStyle = grad;
      g.lineWidth = cell * 0.22;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      /* 内侧阴影 */
      var ox = horiz ? 0 : cell * 0.065, oy = horiz ? cell * 0.065 : 0;
      g.strokeStyle = 'rgba(0,0,0,0.48)';
      g.lineWidth = cell * 0.09;
      g.beginPath(); g.moveTo(x1 + ox, y1 + oy); g.lineTo(x2 + ox, y2 + oy); g.stroke();
      /* 高光边 */
      var hx = horiz ? 0 : -cell * 0.045, hy = horiz ? -cell * 0.045 : 0;
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x1 + hx, y1 + hy); g.lineTo(x2 + hx, y2 + hy); g.stroke();
    }

    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        var w = b.walls[r][c];
        if (w.N) paintEdge(c * cell, r * cell, (c + 1) * cell, r * cell, true);
        if (w.W) paintEdge(c * cell, r * cell, c * cell, (r + 1) * cell, false);
        if (r === size - 1 && w.S) paintEdge(c * cell, (r + 1) * cell, (c + 1) * cell, (r + 1) * cell, true);
        if (c === size - 1 && w.E) paintEdge((c + 1) * cell, r * cell, (c + 1) * cell, (r + 1) * cell, false);
      }
    }
    /* 四角暗角 */
    var vg = g.createRadialGradient(BOARD / 2, BOARD / 2, BOARD * 0.28, BOARD / 2, BOARD / 2, BOARD * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.34)');
    g.fillStyle = vg;
    g.fillRect(0, 0, BOARD, BOARD);
    b.bake = cvs;
  }

  /* ================= 输入 ================= */
  function setHeld(name, on) {
    if (on) {
      if (!held[name]) {
        held[name] = true;
        dirQueue = dirQueue.filter(function (x) { return x !== name; });
        dirQueue.unshift(name);
      }
    } else {
      held[name] = false;
      dirQueue = dirQueue.filter(function (x) { return x !== name; });
    }
  }
  function heldDir() { return dirQueue.length ? dirQueue[0] : null; }

  var dpadBtns = root.querySelectorAll('.mz-dpad button');
  for (var di = 0; di < dpadBtns.length; di++) {
    (function (btn) {
      var d = btn.getAttribute('data-d');
      btn.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        setHeld(d, true);
        tryStep();
      });
      btn.addEventListener('pointerup', function () { setHeld(d, false); });
      btn.addEventListener('pointerleave', function () { setHeld(d, false); });
      btn.addEventListener('pointercancel', function () { setHeld(d, false); });
    })(dpadBtns[di]);
  }

  document.addEventListener('keydown', function (e) {
    var d = KEYDIR[e.code || e.key];
    if (!d) return;
    e.preventDefault();
    if (document.querySelector('.tut-overlay')) return;
    if (state.phase !== 'playing') return;
    setHeld(d, true);
    tryStep();
  });
  document.addEventListener('keyup', function (e) {
    var d = KEYDIR[e.code || e.key];
    if (!d) return;
    setHeld(d, false);
  });
  window.addEventListener('blur', function () {
    held = {}; dirQueue = [];
  });

  if (window.Arcade && Arcade.input && Arcade.input.onSwipe) {
    Arcade.input.onSwipe(canvas, function (dir) {
      if (state.phase !== 'playing') return;
      stepDir(dir);
    }, 26);
  }

  /* 画布点击方向：轻点某方向 → 朝该方向走一步（滑动仍走 onSwipe） */
  var tapStart = null;
  canvas.addEventListener('pointerdown', function (ev) {
    if (state.phase !== 'playing') return;
    tapStart = { x: ev.clientX, y: ev.clientY };
  });
  canvas.addEventListener('pointerup', function (ev) {
    if (!tapStart || state.phase !== 'playing') { tapStart = null; return; }
    var dx = ev.clientX - tapStart.x, dy = ev.clientY - tapStart.y;
    tapStart = null;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return; // 视为滑动
    var b = state.board;
    if (!b) return;
    var pt = (window.GK && GK.pointer) ? GK.pointer(canvas, ev) : { x: 0, y: 0 };
    var cx = (b.player.px + 0.5) * b.cell, cy = (b.player.py + 0.5) * b.cell;
    var rx = pt.x - cx, ry = pt.y - cy;
    if (Math.abs(rx) < 4 && Math.abs(ry) < 4) return;
    stepDir(Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? 'right' : 'left') : (ry > 0 ? 'down' : 'up'));
  });

  var modeBtns = root.querySelectorAll('.mz-mode');
  for (var mb = 0; mb < modeBtns.length; mb++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        startRun(btn.getAttribute('data-mode'));
      });
    })(modeBtns[mb]);
  }
  var diffBtns = root.querySelectorAll('.mz-diffchip');
  for (var db = 0; db < diffBtns.length; db++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        state.diff = parseInt(btn.getAttribute('data-d'), 10) || 0;
        for (var x = 0; x < diffBtns.length; x++) diffBtns[x].classList.toggle('on', x === state.diff);
        sfx('ui');
      });
    })(diffBtns[db]);
  }
  var themeBtns = root.querySelectorAll('.mz-themechip');
  for (var tb = 0; tb < themeBtns.length; tb++) {
    (function (btn) {
      btn.addEventListener('click', function () { setTheme(btn.getAttribute('data-t'), true); });
    })(themeBtns[tb]);
  }
  fogBtn.addEventListener('click', function () {
    state.fog = !state.fog;
    fogBtn.textContent = T(state.fog ? 'gs.maze.fogOn' : 'gs.maze.fogOff');
    sfx('ui');
  });
  root.querySelector('#mz-back').addEventListener('click', function () { openPicker(); });

  /* ================= 流程 ================= */
  function updateHud() {
    var b = state.board;
    if (!b) return;
    var limit = floorLimit(state.mode);
    setText(modeEl, modeName(state.mode));
    setText(levelEl, state.floor + '/' + (limit || '∞'));
    setText(timeEl, fmtClock(b.timeLeft));
    setText(lifeEl, String(Math.max(0, state.hp)));
    setText(stepsEl, String(state.totalSteps));
    setText(gemsEl, String(state.totalGems));
    setText(keysEl, b.keyTotal ? (b.keys + '/' + b.keyTotal) : '0');
    setText(scoreEl, String(state.totalScore));
    if (b.timeLeft <= 15) timePill.classList.add('danger');
    else timePill.classList.remove('danger');
    if (lifePill) lifePill.classList.toggle('danger', state.hp <= 1);
    if (huntPill) {
      var hunterNum = 0;
      for (var i = 0; i < b.enemies.length; i++) if (b.enemies[i].kind === 'hunter') hunterNum++;
      huntPill.classList.toggle('mz-hidden', hunterNum === 0);
      huntPill.classList.toggle('danger', hunterNum > 0 && b.hunterNear <= 2);
      if (huntEl) setText(huntEl, String(hunterNum));
    }
  }

  function initLevel() {
    state.phase = 'playing';
    state.board = makeBoard(state.floor, state.diff, deriveSeed(state.runSeed, state.floor));
    /* 每日最终层小补给：进入第 5 层恢复 1 点生命（仅每日，上限 3） */
    if (state.mode === 'daily' && state.floor === 5) state.hp = Math.min(3, state.hp + 1);
    held = {}; dirQueue = [];
    state.invuln = 0;
    if (msgTimer) { clearTimeout(msgTimer); msgTimer = null; }
    overlayEl.classList.add('mz-hidden');
    overlayEl.innerHTML = '';
    msgEl.textContent = '';
    var conf = state.board.conf;
    updateHud();
    showBanner(
      T('gs.maze.floorStart').replace('{n}', state.floor),
      modeName(state.mode) + ' · ' + conf.size + '×' + conf.size,
      conf.color, 1300
    );
    if (state.board.hunters > 0) {
      flashMsg(T('gs.maze.hunterSpawn').replace('{n}', state.board.hunters), 'var(--neon-pink)', 2400);
    }
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
  }

  function startRun(mode, diffIdx) {
    if (MODES.indexOf(mode) < 0) mode = 'expedition';
    clearTimers();
    state.mode = mode;
    state.diff = (diffIdx === undefined) ? state.diff : diffIdx;
    if (state.diff < 0 || state.diff > 2) state.diff = 1;
    if (mode === 'daily') state.diff = 1; // 每日统一标准难度，保证同日同迷宫同压力
    var chips = root.querySelectorAll('.mz-diffchip');
    for (var ci = 0; ci < chips.length; ci++) chips[ci].classList.toggle('on', ci === state.diff);
    state.runSeed = (mode === 'daily') ? dailySeed() : (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0);
    state.floor = 1;
    state.clearedFloors = 0;
    state.totalScore = 0;
    state.totalSteps = 0;
    state.totalGems = 0;
    state.totalKeys = 0;
    state.elapsed = 0;
    state.submitted = false;
    state.won = false;
    state.failReason = '';
    state.hp = 3;
    state.invuln = 0;
    state.phase = 'playing';
    state.board = null;
    pickEl.classList.add('mz-hidden');
    gameEl.classList.remove('mz-hidden');
    fogBtn.textContent = T(state.fog ? 'gs.maze.fogOn' : 'gs.maze.fogOff');
    initLevel();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    sfx('ui');
  }

  function openPicker() {
    clearTimers();
    state.phase = 'menu';
    state.board = null;
    held = {}; dirQueue = [];
    overlayEl.classList.add('mz-hidden');
    overlayEl.innerHTML = '';
    gameEl.classList.add('mz-hidden');
    pickEl.classList.remove('mz-hidden');
    var chips = root.querySelectorAll('.mz-diffchip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('on', i === state.diff);
    if (window.Arcade && Arcade.savegame) { Arcade.savegame.clear(); }
    refreshPickBest();
  }

  /* ================= 移动 / 交互 ================= */
  function addParticles(b, x, y, color, count, spread) {
    spread = spread || 2.2;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 0.6 + Math.random() * spread;
      b.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5,
        life: 1, decay: 0.026 + Math.random() * 0.02,
        size: 1 + Math.random() * 2.2, color: color
      });
    }
  }

  function spawnFootstep(b, r, c) {
    var x = (c + 0.5) * b.cell, y = (r + 0.5) * b.cell;
    b.trail.unshift({ x: x, y: y, life: 1 });
    if (b.trail.length > 16) b.trail.pop();
    for (var i = 0; i < 5; i++) {
      b.particles.push({
        x: x + (Math.random() - 0.5) * b.cell * 0.5,
        y: y + (Math.random() - 0.5) * b.cell * 0.5,
        vx: (Math.random() - 0.5) * 0.7, vy: (Math.random() - 0.5) * 0.5 - 0.2,
        life: 1, decay: 0.03, size: 0.8 + Math.random() * 1.4,
        color: rgba(b.color, 0.6)
      });
    }
  }

  function bumpWall(b, dr, dc) {
    var p = b.player, cell = b.cell;
    var cx = (p.c + 0.5) * cell, cy = (p.r + 0.5) * cell;
    b.bump = { x1: cx, y1: cy, x2: cx + dc * cell * 0.54, y2: cy + dr * cell * 0.54, t: 0.42 };
    b.shake = Math.max(b.shake, 4);
    b.bumpCd = 0.14;
    sfx('back');
  }

  function tryDoor(b, r, c, dr, dc) {
    var d = doorAt(b, r, c, dr, dc);
    if (!d || d.open) return true;
    if (b.keys <= 0) {
      d.flash = 0.8;
      bumpWall(b, dr, dc);
      flashMsg(T('gs.maze.doorLocked'), 'var(--neon-yellow)');
      return false;
    }
    b.keys--;
    d.open = true;
    d.flash = 0.9;
    addParticles(b, d.x, d.y, '#ffe600', 12, 2.6);
    juice('merge', d.x, d.y, 'var(--neon-yellow)');
    flashMsg(T('gs.maze.doorOpened'), 'var(--neon-cyan)');
    return true;
  }

  function enemyPassable(b, r, c, dr, dc) {
    if (!hasPassage(b.walls, r, c, dr, dc)) return false;
    var d = doorAt(b, r, c, dr, dc);
    return !d || d.open;
  }
  function hunterDistMap(b) {
    var size = b.size, dist = [], q = [[b.player.r, b.player.c]], r, c;
    for (r = 0; r < size; r++) { dist[r] = []; for (c = 0; c < size; c++) dist[r][c] = -1; }
    dist[b.player.r][b.player.c] = 0;
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (q.length) {
      var cur = q.shift();
      for (var i = 0; i < 4; i++) {
        var dr = dirs[i][0], dc = dirs[i][1];
        var nr = cur[0] + dr, nc = cur[1] + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        if (!enemyPassable(b, cur[0], cur[1], dr, dc)) continue;
        if (dist[nr][nc] >= 0) continue;
        dist[nr][nc] = dist[cur[0]][cur[1]] + 1;
        q.push([nr, nc]);
      }
    }
    return dist;
  }
  function wanderEnemy(b, e) {
    var opts = [], dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var i = 0; i < 4; i++) {
      var dr = dirs[i][0], dc = dirs[i][1];
      if (enemyPassable(b, e.r, e.c, dr, dc)) opts.push([dr, dc]);
    }
    var forward = opts.filter(function (o) { return !(e.dir && o[0] === -e.dir.dr && o[1] === -e.dir.dc); });
    var src = (forward.length && Math.random() < 0.86) ? forward : opts;
    if (!src.length) return;
    var d = src[Math.floor(Math.random() * src.length)];
    e.fr = e.r; e.fc = e.c; e.r += d[0]; e.c += d[1];
    e.mt = 0; e.dir = { dr: d[0], dc: d[1] };
  }
  /* 追猎者：按玩家最短路径逐格逼近；若被锁门隔开则退回游荡（可被玩家甩开） */
  function moveHunter(b, e) {
    var dist = hunterDistMap(b);
    var opts = [], dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var i = 0; i < 4; i++) {
      var dr = dirs[i][0], dc = dirs[i][1];
      if (enemyPassable(b, e.r, e.c, dr, dc)) opts.push([dr, dc]);
    }
    var best = null, bd = 9999;
    for (var j = 0; j < opts.length; j++) {
      var nr = e.r + opts[j][0], nc = e.c + opts[j][1];
      var d = dist[nr] && dist[nr][nc];
      if (d >= 0 && d < bd) { bd = d; best = opts[j]; }
    }
    if (!best) { e.lunge = 0; wanderEnemy(b, e); return; }
    /* 扑击预警：第一次贴近玩家时先蓄力一整拍（红光警示），玩家可走位脱离；
       若玩家原地不动，下一次才会真正扑到玩家身上。 */
    if (best[0] + e.r === b.player.r && best[1] + e.c === b.player.c) {
      if (!e.lunge) {
        e.lunge = 0.45;
        e.lungeR = b.player.r; e.lungeC = b.player.c; e.lungeSteps = b.steps;
        return;
      }
    } else {
      e.lunge = 0;
    }
    e.fr = e.r; e.fc = e.c; e.r += best[0]; e.c += best[1];
    e.mt = 0; e.dir = { dr: best[0], dc: best[1] };
  }
  function moveEnemy(b, e) {
    if (e.kind === 'hunter') moveHunter(b, e);
    else wanderEnemy(b, e);
  }
  function updateEnemies(b) {
    for (var i = 0; i < b.enemies.length; i++) {
      var e = b.enemies[i];
      if (e.mt < 1) {
        e.mt += STEP_MS / 220;
        if (e.mt >= 1) { e.mt = 1; e.fr = e.r; e.fc = e.c; }
      } else {
        if (e.kind === 'hunter' && e.lunge > 0) {
          /* 蓄力 0.45s 后扑向蓄力时锁定的格子；玩家移动过则扑空 */
          e.lunge -= STEP_MS / 1000;
          if (e.lunge <= 0) {
            e.lunge = 0;
            if (e.lungeSteps === b.steps && Math.abs(e.r - e.lungeR) + Math.abs(e.c - e.lungeC) === 1) {
              e.fr = e.r; e.fc = e.c;
              e.r = e.lungeR; e.c = e.lungeC;
              e.mt = 0; e.dir = { dr: 0, dc: 0 };
            }
            e.cd = e.speed;
          }
          continue;
        }
        e.cd -= STEP_MS / 1000;
        if (e.cd <= 0) { moveEnemy(b, e); e.cd = e.speed; }
      }
    }
  }

  function hitByEnemy(b, e) {
    if (state.phase !== 'playing' || state.invuln > 0 || !b) return;
    state.invuln = 1.4;
    state.hp--;
    b.timeLeft = Math.max(0, b.timeLeft - 4);
    b.shake = Math.max(b.shake, 12);
    b.flash = Math.max(b.flash, 0.92);
    var x = (b.player.c + 0.5) * b.cell, y = (b.player.r + 0.5) * b.cell;
    addParticles(b, x, y, '#ff2d95', 22, 3.8);
    sfx('error');
    var hitKey = (e && e.kind === 'hunter') ? 'gs.maze.hunterHit' : 'gs.maze.enemyHit';
    flashMsg(T(hitKey).replace('{n}', 4), 'var(--neon-pink)', 1500);
    updateHud();
    if (state.hp <= 0) finishRun(false, 'dead');
  }
  function checkEnemyContact(b) {
    if (state.phase !== 'playing') return;
    for (var i = 0; i < b.enemies.length; i++) {
      var e = b.enemies[i];
      if (e.r === b.player.r && e.c === b.player.c) { hitByEnemy(b, e); return; }
    }
  }

  function stepDir(name) {
    var d = DIRS[name], b = state.board;
    if (!d || !b || state.phase !== 'playing' || b.bumpCd > 0) return false;
    var p = b.player;
    if (p.moving) return false;
    var dr = d.dr, dc = d.dc, nr = p.r + dr, nc = p.c + dc;
    if (nr < 0 || nc < 0 || nr >= b.size || nc >= b.size || !hasPassage(b.walls, p.r, p.c, dr, dc)) {
      bumpWall(b, dr, dc);
      return false;
    }
    if (!tryDoor(b, p.r, p.c, dr, dc)) return false;
    p.sr = p.r; p.sc = p.c;
    p.r = nr; p.c = nc;
    p.moving = true; p.moveT = 0;
    p.dir = { dr: dr, dc: dc };
    b.steps++;
    state.totalSteps++;
    spawnFootstep(b, p.sr, p.sc);
    sfx('move');
    return true;
  }

  function tryStep() {
    if (state.phase !== 'playing' || !state.board) return;
    var d = heldDir();
    if (d) stepDir(d);
  }

  function collectAt(b, r, c) {
    for (var i = 0; i < b.items.length; i++) {
      var it = b.items[i];
      if (it.done || it.r !== r || it.c !== c) continue;
      it.done = true;
      var x = (c + 0.5) * b.cell, y = (r + 0.5) * b.cell;
      if (it.type === 'gem') {
        state.totalScore += 100;
        state.totalGems++;
        b.gems++;
        addParticles(b, x, y, '#ffe600', 16, 3);
        juice('coin', x, y, 'var(--neon-yellow)');
        flashMsg(T('gs.maze.gemGot').replace('{n}', 100), 'var(--neon-yellow)', 1200);
      } else {
        state.totalScore += 150;
        state.totalKeys++;
        b.keys++;
        addParticles(b, x, y, '#00f0ff', 14, 2.6);
        juice('merge', x, y, 'var(--neon-cyan)');
        flashMsg(T('gs.maze.keyGot').replace('{n}', 150), 'var(--neon-cyan)', 1200);
      }
      return;
    }
  }

  function trapAt(b, r, c) {
    for (var i = 0; i < b.traps.length; i++) {
      var tr = b.traps[i];
      if (!tr.armed || tr.r !== r || tr.c !== c) continue;
      tr.armed = false;
      tr.flash = 1;
      var penalty = 6;
      b.timeLeft -= penalty;
      b.steps += 2;
      state.totalSteps += 2;
      b.shake = Math.max(b.shake, 7);
      b.flash = Math.max(b.flash, 0.7);
      var x = (c + 0.5) * b.cell, y = (r + 0.5) * b.cell;
      addParticles(b, x, y, '#ff2d95', 18, 3.4);
      sfx('error');
      flashMsg(T('gs.maze.trapHit').replace('{n}', penalty), 'var(--neon-pink)', 1500);
      return;
    }
  }

  function arrive(b) {
    collectAt(b, b.player.r, b.player.c);
    trapAt(b, b.player.r, b.player.c);
    checkEnemyContact(b);
    if (state.phase === 'playing' && b.player.r === b.exit.r && b.player.c === b.exit.c) clearLevel();
  }

  function clearLevel(instant) {
    var b = state.board;
    if (state.phase !== 'playing' || !b) return;
    state.phase = 'transition';
    var bonus = 200 + state.floor * 40 + Math.floor(b.timeLeft) * 10 + Math.max(0, 80 - b.steps) * 2;
    state.totalScore += bonus;
    state.clearedFloors++;
    b.levelScore = bonus;
    sfx('clear');
    var cx = (b.exit.c + 0.5) * b.cell, cy = (b.exit.r + 0.5) * b.cell;
    for (var i = 0; i < 3; i++) {
      b.rings.push({ x: cx, y: cy, r: b.cell * (0.35 + i * 0.16), life: 1, delay: i * 0.14, color: b.color });
    }
    b.flash = Math.max(b.flash, 0.9);
    updateHud();
    var limit = floorLimit(state.mode);
    var finished = limit && state.clearedFloors >= limit;
    showBanner(T('gs.maze.levelClear'), T('gs.maze.bonus').replace('{n}', bonus), b.color, 1350);
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
    if (finished) {
      if (instant) { finishRun(true); return; }
      transitionTimer = setTimeout(function () { transitionTimer = null; finishRun(true); }, 1400);
      return;
    }
    var next = state.floor + 1;
    if (instant) { state.floor = next; initLevel(); return; }
    transitionTimer = setTimeout(function () {
      transitionTimer = null;
      state.floor = next;
      initLevel();
    }, 1500);
  }

  /* ================= 结算 ================= */
  function finishRun(win, reason) {
    if (state.phase === 'over') return;
    state.phase = 'over';
    state.won = !!win;
    if (!win) state.failReason = reason || 'time';
    clearTimers();
    var dailyMarked = false;
    if (win && state.mode === 'daily' && window.Arcade && Arcade.daily) {
      dailyMarked = !!Arcade.daily.markSolved('maze', Math.max(1, Math.floor(state.elapsed)));
    }
    var prevBest = bestScore();
    var rawBest = prevBest === null ? -1 : prevBest;
    var isNew = false;
    if (!state.submitted) {
      state.submitted = true;
      if (window.Arcade && Arcade.shell && Arcade.shell.submitScore) {
        isNew = !!Arcade.shell.submitScore(state.totalScore); // max 语义由 setBestMode('max') 保证
      } else if (window.Arcade && Arcade.storage) {
        isNew = !!Arcade.storage.submitBest(BEST_KEY, state.totalScore, 'max');
      }
    }
    var bestAfter = bestScore();
    if (bestAfter === null) bestAfter = Math.max(0, state.totalScore, rawBest);
    else bestAfter = Math.max(bestAfter, state.totalScore, rawBest);
    if (win) {
      sfx('win');
      if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
    } else {
      if (window.Arcade && Arcade.juice) Arcade.juice.lose();
      else sfx('lose');
      if (Arcade.fx) Arcade.fx.shake(stageEl);
    }
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
    showResult(win, isNew, bestAfter, dailyMarked);
  }

  function showResult(win, isNew, best, dailyMarked) {
    var dead = !win && state.failReason === 'dead';
    var title = win ? T(state.mode === 'daily' ? 'gs.maze.dailyClear' : 'gs.maze.allClear')
      : (dead ? T('gs.maze.dead') : T('gs.maze.timeUp'));
    var sub;
    if (win) {
      sub = T(state.mode === 'daily' ? 'gs.maze.dailyClearSub' : 'gs.maze.allClearSub')
        .replace('{f}', String(state.clearedFloors)).replace('{t}', fmtClock(state.elapsed));
    } else if (dead) {
      sub = T('gs.maze.deadSub').replace('{n}', String(state.floor));
    } else {
      sub = T('gs.maze.timeUpSub').replace('{n}', String(state.floor));
    }
    if (dailyMarked) {
      sub += '<br>' + T('gs.maze.dailySaved').replace('{n}', String(Math.max(1, Math.floor(state.elapsed))));
    }
    var limit = floorLimit(state.mode);
    var shownFloor = win ? state.clearedFloors : state.floor;
    var rows = [
      [T('gs.maze.modeLabel'), modeName(state.mode), ''],
      [T('gs.maze.floor'), String(shownFloor) + (limit ? '/' + limit : ''), ''],
      [T('gs.maze.usedTime'), fmtClock(state.elapsed), ''],
      [T('gs.maze.steps'), String(state.totalSteps), ''],
      [T('gs.maze.gems'), String(state.totalGems), ''],
      [T('gs.maze.keys'), String(state.totalKeys), ''],
      [T('gs.maze.score'), String(state.totalScore), 'score'],
      [T('gs.maze.best'), String(best), '']
    ];
    var stats = rows.map(function (row) {
      return '<div class="mz-stat ' + row[2] + '">' + row[0] + '<b>' + row[1] + '</b></div>';
    }).join('');
    overlayEl.innerHTML =
      '<div class="mz-card">' +
      '  <h2 class="' + (win ? 'win' : '') + '">' + title + '</h2>' +
      '  <p class="mz-sub">' + sub + '</p>' +
      '  <div class="mz-stats">' + stats + '</div>' +
      '  <div class="mz-newrec' + (isNew ? ' on' : '') + '">' + T('gs.maze.newRecord') + '</div>' +
      '  <div class="mz-actions">' +
      '    <button class="btn green" id="mz-again">' + T('gs.maze.again') + '</button>' +
      '    <button class="btn purple" id="mz-change">' + T('gs.maze.changeMode') + '</button>' +
      '  </div>' +
      '</div>';
    overlayEl.classList.remove('mz-hidden');
    var again = root.querySelector('#mz-again');
    var change = root.querySelector('#mz-change');
    if (again) again.addEventListener('click', function () { startRun(state.mode, state.diff); });
    if (change) change.addEventListener('click', function () { openPicker(); });
  }

  window.GAME_RESTART = function () {
    clearTimers();
    if (state.phase === 'menu') { refreshPickBest(); return; }
    startRun(state.mode, state.diff);
  };

  /* 调试钩子：仅 ?qa=1 时挂载，正常访问不暴露可篡改状态的入口 */
  if (QA_MODE) window.__qa = {
    state: function () {
      var b = state.board;
      return { phase: state.phase, mode: state.mode, floor: state.floor,
        limit: floorLimit(state.mode), cleared: state.clearedFloors,
        level: state.floor, score: state.totalScore,
        won: state.won, submitted: state.submitted, fog: state.fog,
        hp: state.hp, invuln: state.invuln, failReason: state.failReason,
        runSeed: state.runSeed, elapsed: state.elapsed,
        keys: b ? b.keys : 0, keyTotal: b ? b.keyTotal : 0,
        gems: b ? b.gems : 0, timeLeft: b ? b.timeLeft : 0,
        timeLeftMs: b ? b.timeLeft * 1000 : 0,
        steps: b ? b.steps : 0, player: b ? { r: b.player.r, c: b.player.c, moving: b.player.moving } : null,
        exit: b ? b.exit : null,
        theme: state.theme ? state.theme.id : null,
        hunters: b ? b.hunters : 0,
        hunterNear: b ? b.hunterNear : 99,
        enemies: b ? b.enemies.map(function (e) { return { r: e.r, c: e.c, kind: e.kind || 'ghost', cd: e.cd, speed: e.speed, lunge: +(e.lunge || 0) }; }) : [],
        doors: b ? Object.keys(b.doors).map(function (k) {
          var d = b.doors[k];
          return { r: d.r, c: d.c, dr: d.dr, dc: d.dc, open: d.open };
        }) : [] };
    },
    layout: function () {
      var b = state.board;
      if (!b) return null;
      var cells = [], r, c;
      for (r = 0; r < b.size; r++) {
        cells[r] = [];
        for (c = 0; c < b.size; c++) {
          var w = b.walls[r][c];
          cells[r][c] = (w.N ? 1 : 0) | (w.E ? 2 : 0) | (w.S ? 4 : 0) | (w.W ? 8 : 0);
        }
      }
      return {
        size: b.size, exit: { r: b.exit.r, c: b.exit.c },
        player: { r: b.player.r, c: b.player.c },
        cells: cells, keys: b.keys, keyTotal: b.keyTotal,
        items: b.items.map(function (it) { return { type: it.type, r: it.r, c: it.c, done: it.done }; }),
        traps: b.traps.map(function (tr) { return { r: tr.r, c: tr.c, armed: tr.armed }; }),
        doors: Object.keys(b.doors).map(function (k) {
          var d = b.doors[k];
          return { r: d.r, c: d.c, dr: d.dr, dc: d.dc, open: d.open };
        }),
        enemies: b.enemies.map(function (e) {
          return { kind: e.kind || 'ghost', r: e.r, c: e.c, cd: e.cd, speed: e.speed, lunge: +(e.lunge || 0), lungeR: e.lungeR, lungeC: e.lungeC };
        })
      };
    },
    theme: function () {
      var stored = null;
      try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
      return { id: state.theme ? state.theme.id : null, stored: stored };
    },
    setTheme: function (id) { setTheme(id, true); return state.theme.id; },
    startMode: function (mode) {
      if (MODES.indexOf(mode) < 0) return false;
      startRun(mode);
      return true;
    },
    setFloor: function (n) {
      n = Math.max(1, parseInt(n, 10) || 1);
      if (!state.board || state.phase === 'menu' || state.phase === 'over') startRun(state.mode || 'expedition');
      state.floor = n;
      state.clearedFloors = n - 1;
      initLevel();
      return true;
    },
    goto: function (r, c) {
      var b = state.board;
      if (!b || state.phase !== 'playing') return false;
      b.player.r = r; b.player.c = c; b.player.moving = false;
      b.player.px = c; b.player.py = r;
      arrive(b); return true;
    },
    gotoItem: function (type) {
      var b = state.board;
      if (!b) return false;
      for (var i = 0; i < b.items.length; i++) {
        var it = b.items[i];
        if (!it.done && it.type === type) return window.__qa.goto(it.r, it.c);
      }
      return false;
    },
    gotoExit: function () {
      var b = state.board;
      return b ? window.__qa.goto(b.exit.r, b.exit.c) : false;
    },
    winFloor: function () {
      if (state.phase !== 'playing') return false;
      clearLevel(true);
      return true;
    },
    forceWin: function () {
      if (state.phase === 'menu') startRun('expedition');
      finishRun(true);
      return true;
    },
    forceLose: function () {
      if (state.phase === 'menu') startRun('expedition');
      finishRun(false, 'time');
      return true;
    },
    step: function (dir) { return stepDir(dir); },
    /* 毫秒入口，便于长局快速触发超时 */
    setTime: function (ms) {
      if (!state.board) return false;
      state.board.timeLeft = Math.max(0, Number(ms) || 0) / 1000;
      return true;
    },
    seedInfo: function () {
      return { mode: state.mode, date: dailyDate(), seed: dailySeed(), dailySeed: dailySeed(),
        runSeed: state.runSeed,
        floorSeed: deriveSeed(state.runSeed, state.floor),
        floor: state.floor, limit: floorLimit(state.mode) };
    },
    floors: function () {
      return { mode: state.mode, current: state.floor, limit: floorLimit(state.mode),
        cleared: state.clearedFloors, size: floorConf(state.floor).size,
        enemies: floorConf(state.floor).enemies,
        hunters: hunterCount(state.floor, state.mode), score: state.totalScore };
    }
  };

  /* ================= 更新 ================= */
  function updateDust(b) {
    for (var i = 0; i < b.dust.length; i++) {
      var d = b.dust[i];
      d.x += d.vx;
      d.y += d.vy;
      if (d.y < -4) { d.y = BOARD + 4; d.x = Math.random() * BOARD; }
      if (d.x < -4) d.x = BOARD + 4;
      else if (d.x > BOARD + 4) d.x = -4;
    }
  }
  function updateParticles(b) {
    for (var i = b.particles.length - 1; i >= 0; i--) {
      var p = b.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.life -= p.decay;
      if (p.life <= 0) b.particles.splice(i, 1);
    }
    for (var j = b.trail.length - 1; j >= 0; j--) {
      b.trail[j].life -= 0.024;
      if (b.trail[j].life <= 0) b.trail.splice(j, 1);
    }
  }
  function updateRings(b) {
    for (var i = b.rings.length - 1; i >= 0; i--) {
      var r = b.rings[i];
      if (r.delay > 0) { r.delay -= STEP_MS / 1000; continue; }
      r.r += b.cell * 0.045;
      r.life -= 0.028;
      if (r.life <= 0) b.rings.splice(i, 1);
    }
  }

  function update() {
    var b = state.board;
    if (!b) return;
    updateDust(b);
    updateParticles(b);
    updateRings(b);
    if (b.shake > 0) b.shake = Math.max(0, b.shake - 0.55);
    if (b.flash > 0) b.flash = Math.max(0, b.flash - 0.03);
    if (b.bump) { b.bump.t -= 0.022; if (b.bump.t <= 0) b.bump = null; }
    for (var k in b.doors) { if (b.doors[k].flash > 0) b.doors[k].flash = Math.max(0, b.doors[k].flash - 0.035); }
    for (var ti = 0; ti < b.traps.length; ti++) {
      if (b.traps[ti].flash > 0) b.traps[ti].flash = Math.max(0, b.traps[ti].flash - 0.03);
    }

    var p = b.player;
    if (state.phase === 'playing') {
      b.timeLeft -= STEP_MS / 1000;
      b.elapsed += STEP_MS / 1000;
      state.elapsed += STEP_MS / 1000;
      if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - STEP_MS / 1000);
      if (b.bumpCd > 0) b.bumpCd = Math.max(0, b.bumpCd - STEP_MS / 1000);
      updateEnemies(b);
      checkEnemyContact(b);
      if (state.phase !== 'playing') { updateHud(); return; }
      var hNear = 99;
      for (var hi = 0; hi < b.enemies.length; hi++) {
        var he = b.enemies[hi];
        if (he.kind !== 'hunter') continue;
        var hd = Math.max(Math.abs(he.r - b.player.r), Math.abs(he.c - b.player.c));
        if (hd < hNear) hNear = hd;
      }
      b.hunterNear = hNear;
      b.huntWarnCd = Math.max(0, (b.huntWarnCd || 0) - STEP_MS / 1000);
      if (hNear <= 2 && b.huntWarnCd <= 0) {
        flashMsg(T('gs.maze.hunterNear'), 'var(--neon-pink)', 1500);
        b.huntWarnCd = 4;
      }
      if (b.timeLeft <= 0) {
        b.timeLeft = 0;
        updateHud();
        finishRun(false, 'time');
        return;
      }
    }

    if (p.moving) {
      p.moveT += STEP_MS / MOVE_MS;
      if (p.moveT >= 1) {
        p.moveT = 1;
        p.moving = false;
        p.px = p.c;
        p.py = p.r;
        arrive(b);
      } else {
        var e = window.GK ? GK.easeOutCubic(p.moveT) : p.moveT;
        p.px = p.sc + (p.c - p.sc) * e;
        p.py = p.sr + (p.r - p.sr) * e;
      }
    } else {
      p.px = p.c;
      p.py = p.r;
    }

    if (state.phase === 'playing' && !p.moving) {
      var hd = heldDir();
      if (hd && b.bumpCd <= 0) stepDir(hd);
    }
    updateHud();
  }

  /* ================= 绘制（动态层） ================= */
  function drawDust(b, t) {
    for (var i = 0; i < b.dust.length; i++) {
      var d = b.dust[i];
      ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 0.9 + i));
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawDoors(b, t) {
    var th = b.theme || THEMES[0];
    for (var k in b.doors) {
      var d = b.doors[k];
      if (!d) continue;
      ctx.save();
      if (d.open) {
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 3 + d.x);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([b.cell * 0.16, b.cell * 0.14]);
        ctx.beginPath();
        if (d.vertical) { ctx.moveTo(d.x, d.y - d.len / 2); ctx.lineTo(d.x, d.y + d.len / 2); }
        else { ctx.moveTo(d.x - d.len / 2, d.y); ctx.lineTo(d.x + d.len / 2, d.y); }
        ctx.stroke();
        ctx.restore();
        continue;
      }
      var pulse = 0.65 + 0.35 * Math.sin(t * 3.4 + d.x + d.y);
      var grad;
      if (d.vertical) grad = ctx.createLinearGradient(d.x, d.y - d.len / 2, d.x, d.y + d.len / 2);
      else grad = ctx.createLinearGradient(d.x - d.len / 2, d.y, d.x + d.len / 2, d.y);
      grad.addColorStop(0, '#fff8e8');
      grad.addColorStop(0.5, th.door);
      grad.addColorStop(1, '#5a3a00');
      ctx.shadowColor = th.door;
      ctx.shadowBlur = 10 + pulse * 10;

      ctx.strokeStyle = grad;
      ctx.lineWidth = b.cell * 0.24;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (d.vertical) { ctx.moveTo(d.x, d.y - d.len / 2); ctx.lineTo(d.x, d.y + d.len / 2); }
      else { ctx.moveTo(d.x - d.len / 2, d.y); ctx.lineTo(d.x + d.len / 2, d.y); }
      ctx.stroke();
      ctx.shadowBlur = 0;
      /* 锁扣 */
      ctx.translate(d.x, d.y);
      if (!d.vertical) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = 'rgba(12,14,26,0.9)';
      rr(ctx, -b.cell * 0.13, -b.cell * 0.13, b.cell * 0.26, b.cell * 0.26, 3);
      ctx.fill();
      ctx.strokeStyle = rgba(th.door, 0.55 + pulse * 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = th.door;

      ctx.beginPath(); ctx.arc(0, -1.5, b.cell * 0.055, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-1, 1, 2, b.cell * 0.09);
      if (d.flash > 0) {
        ctx.globalAlpha = d.flash;
        ctx.fillStyle = '#ffffff';
        rr(ctx, -b.cell * 0.18, -b.cell * 0.18, b.cell * 0.36, b.cell * 0.36, 4);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTraps(b, t) {
    for (var i = 0; i < b.traps.length; i++) {
      var tr = b.traps[i];
      var cx = (tr.c + 0.5) * b.cell, cy = (tr.r + 0.5) * b.cell;
      ctx.save();
      if (tr.armed) {
        var pulse = 0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.7);
        ctx.shadowColor = '#ff2d95';
        ctx.shadowBlur = 6 + pulse * 6;
        ctx.fillStyle = 'rgba(255,45,149,0.16)';
        ctx.beginPath(); ctx.arc(cx, cy, b.cell * 0.34, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        for (var s = 0; s < 4; s++) {
          var ang = s * Math.PI / 2 + Math.PI / 4;
          var px = cx + Math.cos(ang) * b.cell * 0.12;
          var py = cy + Math.sin(ang) * b.cell * 0.12;
          var sg = ctx.createLinearGradient(px, py - b.cell * 0.12, px, py + b.cell * 0.12);
          sg.addColorStop(0, '#ff9abf');
          sg.addColorStop(1, '#6d1038');
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.moveTo(px, py - b.cell * 0.15);
          ctx.lineTo(px + b.cell * 0.08, py + b.cell * 0.13);
          ctx.lineTo(px - b.cell * 0.08, py + b.cell * 0.13);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(10,10,16,0.65)';
        ctx.beginPath(); ctx.arc(cx, cy, b.cell * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,45,149,' + (0.2 + tr.flash * 0.7) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(cx, cy, b.cell * 0.2, 0, Math.PI * 2); ctx.stroke();
      }
      if (tr.flash > 0) {
        ctx.globalAlpha = tr.flash * 0.7;
        ctx.fillStyle = '#ff2d95';
        ctx.beginPath(); ctx.arc(cx, cy, b.cell * (0.3 + (1 - tr.flash) * 0.2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawHunter(b, e, t, x, y, cell) {
    var th = b.theme || THEMES[0];
    var dist = Math.max(Math.abs(e.r - b.player.r), Math.abs(e.c - b.player.c));
    var near = dist <= 3;
    var pulse = 0.55 + 0.45 * Math.sin(t * 5.2 + e.ph);
    var lunge = !!e.lunge;
    var jx = near ? Math.sin(t * 26 + e.ph) * cell * 0.035 : 0;
    var jy = near ? Math.cos(t * 22 + e.ph * 1.3) * cell * 0.03 : 0;
    var hc = th.hunter;
    ctx.save();
    ctx.translate(x + jx, y + jy);
    /* 红色警报辉光 */
    var rg = ctx.createRadialGradient(0, 0, 1, 0, 0, cell * 0.8);
    rg.addColorStop(0, rgba(hc, lunge ? 0.68 : (near ? 0.55 : 0.32)));
    rg.addColorStop(0.55, rgba(hc, lunge ? 0.28 : 0.16));
    rg.addColorStop(1, rgba(hc, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, cell * 0.8, 0, Math.PI * 2); ctx.fill();
    /* 双重警示圈（接近时更亮；蓄力扑击时闪红） */
    ctx.shadowColor = hc;
    ctx.shadowBlur = lunge ? 24 : (near ? 16 : 9);
    ctx.strokeStyle = rgba(hc, lunge ? (0.65 + 0.35 * Math.abs(Math.sin(t * 9))) : (near ? 0.95 : 0.6));
    ctx.lineWidth = lunge ? 3 : (near ? 2.2 : 1.4);
    ctx.setLineDash([cell * 0.14, cell * 0.1]);
    ctx.lineDashOffset = -t * cell * 0.5;
    ctx.beginPath(); ctx.arc(0, 0, cell * 0.43, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(hc, 0.35 + pulse * 0.35);
    ctx.lineWidth = 1;
    ctx.lineDashOffset = t * cell * 0.36;
    ctx.beginPath(); ctx.arc(0, 0, cell * 0.58, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    /* 尖角核心 */
    var core = ctx.createRadialGradient(-cell * 0.05, -cell * 0.06, 1, 0, 0, cell * 0.27);
    core.addColorStop(0, '#fff0e8');
    core.addColorStop(0.32, hc);
    core.addColorStop(0.82, '#4a0615');
    core.addColorStop(1, '#180208');
    ctx.fillStyle = core;
    ctx.shadowColor = hc;
    ctx.shadowBlur = near ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(0, -cell * 0.27);
    ctx.lineTo(cell * 0.2, 0);
    ctx.lineTo(0, cell * 0.27);
    ctx.lineTo(-cell * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    /* 朝玩家的红眼 */
    var ang = Math.atan2(b.player.r - e.r, b.player.c - e.c);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,245,245,0.96)';
    ctx.beginPath(); ctx.ellipse(cell * 0.09, 0, cell * 0.075, cell * 0.038, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff1e3c';
    ctx.beginPath(); ctx.arc(cell * 0.12, 0, cell * 0.034, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    /* 接近时在猎手外围画扩张警示环 */
    if (near || lunge) {
      ctx.save();
      ctx.globalAlpha = lunge ? 0.85 : 0.5;
      ctx.strokeStyle = hc;
      ctx.lineWidth = lunge ? 2.2 : 1.5;
      var rr5 = cell * (0.5 + 0.16 * ((t * (lunge ? 3.2 : 1.6) + e.ph) % 1));
      ctx.beginPath(); ctx.arc(x, y, rr5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    /* 扑击蓄力：头顶红色感叹号预警 */
    if (lunge) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 10);
      ctx.fillStyle = '#ff4d6d';
      ctx.shadowColor = '#ff2d55';
      ctx.shadowBlur = 12;
      ctx.font = 'bold ' + Math.round(cell * 0.5) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - cell * 0.5);
      ctx.restore();
    }
  }

  function drawEnemies(b, t) {
    var th = b.theme || THEMES[0];
    for (var i = 0; i < b.enemies.length; i++) {
      var e = b.enemies[i];
      var k = (window.GK ? GK.easeOutCubic(e.mt) : e.mt);
      var gx = e.fc + (e.c - e.fc) * k, gy = e.fr + (e.r - e.fr) * k;
      var x = (gx + 0.5) * b.cell, y = (gy + 0.5) * b.cell;
      var cell = b.cell;
      if (e.kind === 'hunter') { drawHunter(b, e, t, x, y, cell); continue; }
      var pulse = 0.55 + 0.45 * Math.sin(t * 3.6 + e.ph);
      ctx.save();
      /* 地面暗影 */
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath(); ctx.ellipse(x, y + cell * 0.2, cell * 0.28, cell * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      /* 外层辉光 */
      var rg = ctx.createRadialGradient(x, y, 1, x, y, cell * 0.62);
      rg.addColorStop(0, rgba(th.enemy, 0.34));
      rg.addColorStop(1, rgba(th.enemy, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, cell * 0.62, 0, Math.PI * 2); ctx.fill();
      /* 旋转碎片环 */
      ctx.translate(x, y);
      ctx.rotate(t * 0.9 + e.ph);
      ctx.strokeStyle = rgba(th.enemy, 0.35 + pulse * 0.4);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([cell * 0.1, cell * 0.12]);
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.34, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(-(t * 0.9 + e.ph));
      /* 核心球体 */
      var core = ctx.createRadialGradient(-cell * 0.05, -cell * 0.06, 1, 0, 0, cell * 0.24);
      core.addColorStop(0, '#ffd9ec');
      core.addColorStop(0.35, th.enemy);
      core.addColorStop(0.85, '#4a0b28');
      core.addColorStop(1, '#12030b');
      ctx.fillStyle = core;
      ctx.shadowColor = th.enemy;
      ctx.shadowBlur = 10 + pulse * 8;
      ctx.beginPath(); ctx.arc(0, 0, cell * 0.21 * (0.94 + pulse * 0.1), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      /* 几何眼缝（朝行进方向） */
      var ang = (e.dir && (e.dir.dr || e.dir.dc)) ? Math.atan2(e.dir.dr, e.dir.dc) : 0;
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,246,252,0.92)';
      ctx.beginPath();
      ctx.moveTo(cell * 0.06, -cell * 0.055);
      ctx.lineTo(cell * 0.17, 0);
      ctx.lineTo(cell * 0.06, cell * 0.055);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawItems(b, t) {
    var th = b.theme || THEMES[0];
    for (var i = 0; i < b.items.length; i++) {
      var it = b.items[i];
      if (it.done) continue;
      var cx = (it.c + 0.5) * b.cell, cy = (it.r + 0.5) * b.cell + Math.sin(t * 1.9 + it.ph) * b.cell * 0.09;
      ctx.save();
      ctx.translate(cx, cy);
      if (it.type === 'gem') {
        ctx.shadowColor = th.gem;
        ctx.shadowBlur = 14;
        var gg = ctx.createLinearGradient(0, -b.cell * 0.24, 0, b.cell * 0.24);
        gg.addColorStop(0, '#ffffff');
        gg.addColorStop(0.45, th.gem);
        gg.addColorStop(1, '#5a4600');
        ctx.fillStyle = gg;
        var rr2 = b.cell * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, -rr2 * 1.25);
        ctx.lineTo(rr2, 0);
        ctx.lineTo(0, rr2 * 1.25);
        ctx.lineTo(-rr2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1;
        ctx.stroke();
        /* 闪光十字 */
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5 + it.ph);
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-b.cell * 0.3, 0); ctx.lineTo(b.cell * 0.3, 0);
        ctx.moveTo(0, -b.cell * 0.3); ctx.lineTo(0, b.cell * 0.3);
        ctx.stroke();
      } else {
        ctx.rotate(Math.sin(t * 1.4 + it.ph) * 0.18);
        ctx.shadowColor = th.key;
        ctx.shadowBlur = 14;
        var kg = ctx.createLinearGradient(0, -b.cell * 0.3, 0, b.cell * 0.3);
        kg.addColorStop(0, '#ffffff');
        kg.addColorStop(0.5, th.key);
        kg.addColorStop(1, '#3a4a00');
        ctx.strokeStyle = kg;
        ctx.fillStyle = kg;
        var r3 = b.cell * 0.11;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -b.cell * 0.15, r3, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -b.cell * 0.04);
        ctx.lineTo(0, b.cell * 0.26);
        ctx.moveTo(0, b.cell * 0.16);
        ctx.lineTo(b.cell * 0.12, b.cell * 0.16);
        ctx.moveTo(0, b.cell * 0.24);
        ctx.lineTo(b.cell * 0.1, b.cell * 0.24);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -b.cell * 0.15, r3 * 0.55, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawExit(b, t) {
    var cx = (b.exit.c + 0.5) * b.cell, cy = (b.exit.r + 0.5) * b.cell;
    var cell = b.cell;
    var pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
    ctx.save();
    /* 光柱 */
    var pg = ctx.createLinearGradient(cx, cy - cell * 1.9, cx, cy + cell * 0.1);
    pg.addColorStop(0, rgba(b.color, 0));
    pg.addColorStop(0.55, rgba(b.color, 0.16));
    pg.addColorStop(1, rgba(b.color, 0.42));
    ctx.fillStyle = pg;
    ctx.fillRect(cx - cell * 0.42, cy - cell * 1.9, cell * 0.84, cell * 1.95);
    /* 地面光晕 */
    var rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, cell * 0.95);
    rg.addColorStop(0, 'rgba(255,255,255,0.85)');
    rg.addColorStop(0.32, rgba(b.color, 0.55));
    rg.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.95, 0, Math.PI * 2); ctx.fill();
    /* 旋转双环 */
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12 + pulse * 10;
    ctx.strokeStyle = rgba(b.color, 0.9);
    ctx.lineWidth = 2;
    ctx.setLineDash([cell * 0.17, cell * 0.13]);
    ctx.lineDashOffset = -t * cell * 0.35;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.4, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.55);
    ctx.lineDashOffset = t * cell * 0.28;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.27, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    /* 核心 */
    var core = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, cell * 0.2);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.5, b.color);
    core.addColorStop(1, 'rgba(10,20,35,0.15)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.2 * (0.92 + pulse * 0.14), 0, Math.PI * 2); ctx.fill();
    /* 四向星芒 */
    ctx.globalAlpha = 0.55 + pulse * 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    var rr4 = cell * (0.32 + pulse * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - rr4, cy); ctx.lineTo(cx + rr4, cy);
    ctx.moveTo(cx, cy - rr4); ctx.lineTo(cx, cy + rr4);
    ctx.stroke();
    ctx.restore();
  }

  function drawTrail(b) {
    for (var i = 0; i < b.trail.length; i++) {
      var tr = b.trail[i];
      if (tr.life <= 0) continue;
      ctx.globalAlpha = tr.life * 0.28;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, b.cell * 0.18 * (0.6 + tr.life * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(b, t) {
    var p = b.player;
    var cell = b.cell;
    var cx = (p.px + 0.5) * cell, cy = (p.py + 0.5) * cell;
    var ang = Math.atan2(p.dir.dr, p.dir.dc);
    var pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
    var pop = p.moving ? 1.08 : 1;
    ctx.save();
    if (state.invuln > 0) ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 16));
    /* 地面阴影 */
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(cx, cy + cell * 0.18, cell * 0.3, cell * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    /* 方向光锥 */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    var lg = ctx.createLinearGradient(0, 0, cell * 1.5, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0.22)');
    lg.addColorStop(0.55, rgba(b.color, 0.12));
    lg.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, -cell * 0.16);
    ctx.lineTo(cell * 1.5, -cell * 0.52);
    ctx.lineTo(cell * 1.5, cell * 0.52);
    ctx.lineTo(0, cell * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    /* 光晕 */
    var ag = ctx.createRadialGradient(cx, cy, 1, cx, cy, cell * 0.72);
    ag.addColorStop(0, rgba('#ffffff', 0.5));
    ag.addColorStop(0.4, rgba(b.color, 0.28));
    ag.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.72, 0, Math.PI * 2); ctx.fill();
    /* 身体 */
    var bg = ctx.createRadialGradient(cx - cell * 0.08, cy - cell * 0.1, 1, cx, cy, cell * 0.34 * pop);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.35, '#d6fff2');
    bg.addColorStop(0.75, b.color);
    bg.addColorStop(1, '#06202c');
    ctx.fillStyle = bg;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.28 * pop, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 + pulse * 0.4) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.3 * pop, 0, Math.PI * 2); ctx.stroke();
    /* 朝向箭头 */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(cell * 0.22 * pop, 0);
    ctx.lineTo(cell * 0.1, -cell * 0.07);
    ctx.lineTo(cell * 0.1, cell * 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawParticles(b) {
    for (var i = 0; i < b.particles.length; i++) {
      var p = b.particles[i];
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + p.life * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBump(b) {
    if (!b.bump) return;
    var a = Math.max(0, b.bump.t / 0.42);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.bump.x1, b.bump.y1);
    ctx.lineTo(b.bump.x2, b.bump.y2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.35;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  }

  function drawRings(b) {
    for (var i = 0; i < b.rings.length; i++) {
      var r = b.rings[i];
      if (r.delay > 0 || r.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, r.life) * 0.7;
      ctx.strokeStyle = r.color;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawFog(b) {
    var th = b.theme || THEMES[0];
    var cell = b.cell;
    var cx = (b.player.px + 0.5) * cell, cy = (b.player.py + 0.5) * cell;
    var R = cell * 3.5;
    var fg = ctx.createRadialGradient(cx, cy, cell * 0.55, cx, cy, R);
    fg.addColorStop(0, 'rgba(' + th.fog + ',0)');
    fg.addColorStop(0.55, 'rgba(' + th.fog + ',0.28)');
    fg.addColorStop(0.86, 'rgba(' + th.fog + ',0.86)');
    fg.addColorStop(1, 'rgba(' + th.fog + ',0.97)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, BOARD, BOARD);
    ctx.strokeStyle = rgba(th.accent, 0.22);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2); ctx.stroke();
  }

  function draw() {
    var b = state.board;
    ctx.clearRect(0, 0, BOARD, BOARD);
    if (!b) return;
    var t = performance.now() / 1000;
    var sx = 0, sy = 0;
    if (b.shake > 0) {
      sx = (Math.random() - 0.5) * b.shake;
      sy = (Math.random() - 0.5) * b.shake;
    }
    ctx.save();
    ctx.translate(sx, sy);
    ctx.drawImage(b.bake, 0, 0, BOARD, BOARD);
    drawDust(b, t);
    drawDoors(b, t);
    drawTraps(b, t);
    drawEnemies(b, t);
    drawItems(b, t);
    drawExit(b, t);
    drawTrail(b);
    drawPlayer(b, t);
    drawParticles(b);
    drawBump(b);
    drawRings(b);
    if (state.fog) drawFog(b);
    if (b.flash > 0) {
      ctx.fillStyle = 'rgba(255,248,210,' + (b.flash * 0.34) + ')';
      ctx.fillRect(0, 0, BOARD, BOARD);
    }
    ctx.restore();
  }

  /* ================= 断点续玩（arcade_save_maze） ================= */
  function snapshot() {
    if (!state.board || !state.mode) return null;
    if (state.phase === 'menu' || state.phase === 'over') return null;
    var b = state.board;
    var advance = state.phase === 'transition';
    var floor = advance ? state.floor + 1 : state.floor;
    var diff = DIFFS[state.diff] || DIFFS[1];
    var itemsDone = [], i, k;
    for (i = 0; i < b.items.length; i++) if (b.items[i].done) itemsDone.push(i);
    var doorsOpen = [];
    for (k in b.doors) if (b.doors[k].open) doorsOpen.push(k);
    var traps = [];
    for (i = 0; i < b.traps.length; i++) traps.push(b.traps[i].armed ? 1 : 0);
    return {
      v: 2, mode: state.mode, diff: state.diff, floor: floor, advance: advance,
      runSeed: state.runSeed, score: state.totalScore, steps: state.totalSteps,
      gems: state.totalGems, keys: state.totalKeys, cleared: state.clearedFloors,
      hp: state.hp, fog: state.fog, elapsed: state.elapsed,
      timeLeft: advance ? floorTimeLeft(floor, diff, state.mode) : b.timeLeft,
      keysLeft: b.keys,
      pos: advance ? { r: 0, c: 0 } : { r: b.player.r, c: b.player.c },
      itemsDone: itemsDone, doorsOpen: doorsOpen, traps: traps
    };
  }

  function applySave(s) {
    if (!s || MODES.indexOf(s.mode) < 0) return false;
    var diff = parseInt(s.diff, 10);
    if (diff < 0 || diff > 2) diff = 1;
    var floor = Math.max(1, parseInt(s.floor, 10) || 1);
    if (!isFinite(Number(s.score))) return false;
    clearTimers();
    state.mode = s.mode;
    state.diff = diff;
    state.runSeed = Number(s.runSeed) >>> 0;
    state.floor = floor;
    state.clearedFloors = Math.max(0, Number(s.cleared) || (floor - 1));
    state.totalScore = Math.max(0, Number(s.score) || 0);
    state.totalSteps = Math.max(0, Number(s.steps) || 0);
    state.totalGems = Math.max(0, Number(s.gems) || 0);
    state.totalKeys = Math.max(0, Number(s.keys) || 0);
    state.elapsed = Math.max(0, Number(s.elapsed) || 0);
    state.hp = clamp(Number(s.hp) || 3, 1, 3);
    state.fog = !!s.fog;
    state.invuln = 0;
    state.submitted = false;
    state.won = false;
    state.failReason = '';
    state.board = makeBoard(floor, diff, deriveSeed(state.runSeed, floor));
    var b = state.board, i;
    if (!s.advance) {
      if (Array.isArray(s.itemsDone)) {
        for (i = 0; i < s.itemsDone.length; i++) {
          var it = b.items[s.itemsDone[i]];
          if (it && !it.done) {
            it.done = true;
            if (it.type === 'gem') b.gems++; else b.keys++;
          }
        }
      }
      if (Array.isArray(s.doorsOpen)) {
        for (i = 0; i < s.doorsOpen.length; i++) {
          if (b.doors[s.doorsOpen[i]]) b.doors[s.doorsOpen[i]].open = true;
        }
      }
      if (Array.isArray(s.traps)) {
        for (i = 0; i < b.traps.length && i < s.traps.length; i++) b.traps[i].armed = !!s.traps[i];
      }
      b.keys = clamp(Number(s.keysLeft) || 0, 0, b.keyTotal);
      var pr = clamp(parseInt(s.pos && s.pos.r, 10) || 0, 0, b.size - 1);
      var pc = clamp(parseInt(s.pos && s.pos.c, 10) || 0, 0, b.size - 1);
      b.player.r = pr; b.player.c = pc; b.player.px = pc; b.player.py = pr;
      b.player.moving = false; b.player.moveT = 1;
      b.timeLeft = clamp(Number(s.timeLeft) || 0, 0, 1e9);
      state.clearedFloors = Math.max(0, Number(s.cleared) || (floor - 1));
    }
    state.phase = 'playing';
    pickEl.classList.add('mz-hidden');
    gameEl.classList.remove('mz-hidden');
    overlayEl.classList.add('mz-hidden');
    overlayEl.innerHTML = '';
    fogBtn.textContent = T(state.fog ? 'gs.maze.fogOn' : 'gs.maze.fogOff');
    updateHud();
    showBanner(T('gs.maze.resumedRun').replace('{n}', floor), modeName(state.mode), b.color, 1400);
    return true;
  }

  /* ================= 启动 ================= */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px;max-width:420px;width:100%;box-sizing:border-box';
  hd.innerHTML = T('gs.maze.helpText');
  root.appendChild(hd);

  fogBtn.textContent = T(state.fog ? 'gs.maze.fogOn' : 'gs.maze.fogOff');
  refreshPickBest();
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({ id: BEST_KEY, collect: snapshot, apply: applySave });
    Arcade.savegame.resume();
  }
  if (window.Arcade && Arcade.loop) loopApi = Arcade.loop.start(update, draw, STEP_MS);
})();
