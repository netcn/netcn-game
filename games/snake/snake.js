/* ============================================================
   贪吃蛇 · 旗舰重制
   20x20 网格；9 种模式：经典/穿墙/障碍/加速/冲刺 60s/传送门/猎手/关卡/双人
   - 冲刺计时改为「游戏内累计时间」（update 按 stepMs 累加），暂停/切后台冻结
   - placeFood 扫描空格，满盘进入「满盘胜利」结算，绝不阻塞主线程
   - 传送门成对旋转光环；每 5 个食物重排/新增；猎手 BFS 追踪并做可行空格检查
   - 双人本地 2P：P1 方向键 / P2 WASD，双 HUD；触屏左右两套 44px 虚拟方向键
   - 关卡模式 6 张确定性墙体地图，连通性校验；存档 arcade_save_snake
   ============================================================ */

(function () {
  'use strict';

  var QA = /(?:^|[?&])qa=1(?:&|$)/.test(location.search);
  var root = document.getElementById('game-root');

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.snake.tut1t'), d: T('gs.snake.tut1') },
    { t: T('gs.snake.tut2t'), d: T('gs.snake.tut2') },
    { t: T('gs.snake.tut3t'), d: T('gs.snake.tut3') }
  ];

  var GRID = 20;
  var CELL = 20;
  var STEP_START = 130;
  var STEP_MIN = 70;
  var STEP_DELTA = 3;
  var SPRINT_MS = 60000;
  var LEVEL_TARGETS = [5, 6, 7, 8, 9, 10];

  var MODES = {
    classic:  { name: 'gs.snake.modeClassic',  wrap: false, obstacle: false, autoAccel: false, sprint: false, duelmode: false, levelMode: false },
    wrap:     { name: 'gs.snake.modeWrap',     wrap: true,  obstacle: false, autoAccel: false, sprint: false, duelmode: false, levelMode: false },
    obstacle: { name: 'gs.snake.modeObstacle', wrap: false, obstacle: true,  autoAccel: false, sprint: false, duelmode: false, levelMode: false },
    speed:    { name: 'gs.snake.modeSpeed',    wrap: false, obstacle: false, autoAccel: true,  sprint: false, duelmode: false, levelMode: false },
    sprint:   { name: 'gs.snake.modeSprint',   wrap: true,  obstacle: false, autoAccel: false, sprint: true,  duelmode: false, levelMode: false },
    portal:   { name: 'gs.snake.modePortal',   wrap: false, obstacle: false, autoAccel: false, sprint: false, duelmode: false, levelMode: false, portalMode: true },
    hunter:   { name: 'gs.snake.modeHunter',   wrap: false, obstacle: false, autoAccel: false, sprint: false, duelmode: false, levelMode: false, hunterMode: true },
    level:    { name: 'gs.snake.modeLevel',    wrap: false, obstacle: false, autoAccel: false, sprint: false, duelmode: false, levelMode: true },
    duo:      { name: 'gs.snake.modeDuo',      wrap: false, obstacle: false, autoAccel: false, sprint: false, duelmode: true,  levelMode: false }
  };
  var DIFFS = {
    easy:   { name: 'gs.snake.dEasy',   start: 150, obs: 4,  accel: 0.35, hunterEvery: 4 },
    normal: { name: 'gs.snake.dNormal', start: 120, obs: 9,  accel: 0.60, hunterEvery: 3 },
    hard:   { name: 'gs.snake.dHard',   start: 90,  obs: 15, accel: 0.95, hunterEvery: 2 }
  };
  var SNAKE_COLORS = [
    { head: '#d6ffcc', body: 'hsl(115,100%,', glow: '#39ff14' },
    { head: '#f1d6ff', body: 'hsl(282,100%,', glow: '#d05bff' }
  ];

  root.innerHTML =
    '<div class="snake-menu" id="menu">' +
    '  <div class="snake-menu-title">' + T('gs.snake.chooseMode') + '</div>' +
    '  <div class="snake-mode-row" id="mode-row">' +
    '    <button class="mode-btn selected" data-mode="classic">' + T('gs.snake.modeClassic') + '</button>' +
    '    <button class="mode-btn" data-mode="wrap">' + T('gs.snake.modeWrap') + '</button>' +
    '    <button class="mode-btn" data-mode="obstacle">' + T('gs.snake.modeObstacle') + '</button>' +
    '    <button class="mode-btn" data-mode="speed">' + T('gs.snake.modeSpeed') + '</button>' +
    '    <button class="mode-btn" data-mode="sprint">' + T('gs.snake.modeSprintBtn') + '</button>' +
    '    <button class="mode-btn" data-mode="portal">' + T('gs.snake.modePortal') + '</button>' +
    '    <button class="mode-btn" data-mode="hunter">' + T('gs.snake.modeHunter') + '</button>' +
    '    <button class="mode-btn" data-mode="level">' + T('gs.snake.modeLevel') + '</button>' +
    '    <button class="mode-btn" data-mode="duo">' + T('gs.snake.modeDuo') + '</button>' +
    '  </div>' +
    '  <div class="snake-menu-title">' + T('gs.snake.chooseDiff') + '</div>' +
    '  <div class="snake-mode-row" id="diff-row">' +
    '    <button class="mode-btn" data-diff="easy">' + T('gs.snake.dEasy') + '</button>' +
    '    <button class="mode-btn selected" data-diff="normal">' + T('gs.snake.dNormal') + '</button>' +
    '    <button class="mode-btn" data-diff="hard">' + T('gs.snake.dHard') + '</button>' +
    '  </div>' +
    '  <button class="btn green" id="start-btn">' + T('gs.snake.start') + '</button>' +
    '  <div class="snake-duo-tip hidden" id="duo-tip">' + T('gs.snake.duoHelp') + '</div>' +
    '  <div class="game-message" id="msg"></div>' +
    '</div>' +
    '<div class="snake-stage hidden" id="stage">' +
    '  <canvas id="board" class="game-canvas" width="400" height="400"></canvas>' +
    '  <div class="snake-bubble" id="bubble"></div>' +
    '  <div class="snake-overlay hidden" id="pause-overlay">' +
    '    <div class="snake-overlay-title" id="pause-title">' + T('gs.snake.pauseTitle') + '</div>' +
    '    <button id="resume-btn" class="btn green">' + T('gs.snake.resume') + '</button>' +
    '    <button id="pause-menu-btn" class="btn">' + T('gs.snake.changeMode') + '</button>' +
    '  </div>' +
    '  <div class="snake-overlay hidden" id="overlay">' +
    '    <div class="snake-overlay-title" id="ov-title">' + T('gs.snake.gameOver') + '</div>' +
    '    <div class="snake-overlay-cause" id="ov-cause"></div>' +
    '    <div class="snake-overlay-score">' + T('gs.snake.score') + ' <span id="final-score">0</span></div>' +
    '    <div class="snake-overlay-best">' + T('gs.snake.best') + ' <b id="ov-best">0</b></div>' +
    '    <button id="restart-btn" class="btn green">' + T('gs.snake.restart') + '</button>' +
    '    <button id="menu-btn" class="btn">' + T('gs.snake.changeMode') + '</button>' +
    '  </div>' +
    '</div>' +
    '<div class="game-stats hidden" id="stats">' +
    '  <span>' + T('gs.snake.score') + ' <span class="stat-value" id="score">0</span></span>' +
    '  <span>' + T('gs.snake.length') + ' <span class="stat-value" id="len">3</span></span>' +
    '  <span>' + T('gs.snake.level') + ' <span class="stat-value" id="level">1</span></span>' +
    '  <span id="target-wrap" class="hidden">' + T('gs.snake.hudTarget') + ' <span class="stat-value" id="target-val">0/5</span></span>' +
    '  <span id="sprint-time" class="hidden"><span class="stat-value" id="sprint-val">60</span>s</span>' +
    '</div>' +
    '<div class="duo-hud hidden" id="duo-hud">' +
    '  <div class="duo-side p1"><b>P1</b><span>' + T('gs.snake.score') + '</span><em id="p1-score">0</em><span>' + T('gs.snake.length') + '</span><em id="p1-len">3</em></div>' +
    '  <div class="duo-side p2"><b>P2</b><span>' + T('gs.snake.score') + '</span><em id="p2-score">0</em><span>' + T('gs.snake.length') + '</span><em id="p2-len">3</em></div>' +
    '</div>' +
    '<div class="snake-ctrl hidden" id="ctrl">' +
    '  <button class="btn" id="pause-btn">' + T('gs.snake.pause') + '</button>' +
    '</div>' +
    '<div id="dpad-holder"></div>' +
    '<div class="duo-pads hidden" id="duo-pads">' +
    '  <div class="duo-pad p1" id="duo-pad-p1" aria-label="P1"></div>' +
    '  <div class="duo-pad p2" id="duo-pad-p2" aria-label="P2"></div>' +
    '</div>' +
    '<p class="help-text hidden" id="help">' + T('gs.snake.help') + '</p>';

  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  var msgEl = document.getElementById('msg');
  var scoreEl = document.getElementById('score');
  var lenEl = document.getElementById('len');
  var levelEl = document.getElementById('level');
  var targetWrap = document.getElementById('target-wrap');
  var targetValEl = document.getElementById('target-val');
  var overlayEl = document.getElementById('overlay');
  var finalScoreEl = document.getElementById('final-score');
  var restartBtn = document.getElementById('restart-btn');
  var menuBtn = document.getElementById('menu-btn');
  var menuEl = document.getElementById('menu');
  var stageEl = document.getElementById('stage');
  var statsEl = document.getElementById('stats');
  var duoHud = document.getElementById('duo-hud');
  var p1ScoreEl = document.getElementById('p1-score');
  var p1LenEl = document.getElementById('p1-len');
  var p2ScoreEl = document.getElementById('p2-score');
  var p2LenEl = document.getElementById('p2-len');
  var helpEl = document.getElementById('help');
  var startBtn = document.getElementById('start-btn');
  var modeRow = document.getElementById('mode-row');
  var diffRow = document.getElementById('diff-row');
  var bubbleEl = document.getElementById('bubble');
  var ovTitleEl = document.getElementById('ov-title');
  var ovCauseEl = document.getElementById('ov-cause');
  var ovBestEl = document.getElementById('ov-best');
  var pauseOverlay = document.getElementById('pause-overlay');
  var resumeBtn = document.getElementById('resume-btn');
  var pauseMenuBtn = document.getElementById('pause-menu-btn');
  var ctrlEl = document.getElementById('ctrl');
  var pauseBtn = document.getElementById('pause-btn');
  var duoPads = document.getElementById('duo-pads');
  var dpadHolder = document.getElementById('dpad-holder');
  var sprintWrap = document.getElementById('sprint-time');
  var sprintValEl = document.getElementById('sprint-val');

  var snakes = [[], []];
  var dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }];
  var dirQueues = [[], []];
  var scores = [0, 0];
  var food = null;
  var obstacles = [];
  var portals = [];
  var hunters = [];
  var levelWalls = [];
  var mode = null;
  var difficulty = 'normal';
  var selectedMode = 'classic';
  var selectedDiff = 'normal';
  var menuActive = true;
  var started = false;
  var gameOver = false;
  var paused = false;
  var gameLoop = null;
  var stepMs = STEP_START;
  var level = 1;
  var foodCount = 0;
  var sprintElapsed = 0;
  var gameElapsed = 0;
  var hunterTick = 0;
  var levelFlash = 0;
  var deathFlash = 0;
  var bubbleTimer = null;
  var portalHue = 0;
  var suppressSave = false;

  /* ---------------- 工具 ---------------- */
  function liveSnakeCount() { return mode && mode.duelmode ? 2 : 1; }
  function isWall(x, y) {
    return !!(levelWalls[y] && levelWalls[y][x]);
  }
  function isObstacle(x, y) {
    for (var i = 0; i < obstacles.length; i++) {
      if (obstacles[i].x === x && obstacles[i].y === y) return true;
    }
    return false;
  }
  function isPortalCell(x, y) {
    for (var i = 0; i < portals.length; i++) {
      if (portals[i].a.x === x && portals[i].a.y === y) return true;
      if (portals[i].b.x === x && portals[i].b.y === y) return true;
    }
    return false;
  }
  function portalPartner(x, y) {
    for (var i = 0; i < portals.length; i++) {
      var p = portals[i];
      if (p.a.x === x && p.a.y === y) return p.b;
      if (p.b.x === x && p.b.y === y) return p.a;
    }
    return null;
  }
  function hunterAt(x, y) {
    for (var i = 0; i < hunters.length; i++) {
      if (hunters[i].x === x && hunters[i].y === y) return i;
    }
    return -1;
  }
  function bodyAt(x, y) {
    for (var s = 0; s < snakes.length; s++) {
      for (var i = 0; i < snakes[s].length; i++) {
        if (snakes[s][i].x === x && snakes[s][i].y === y) return true;
      }
    }
    return false;
  }
  function inBounds(x, y) { return x >= 0 && x < GRID && y >= 0 && y < GRID; }
  function keyOf(x, y) { return y * GRID + x; }

  function randCellIn(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ---------------- 关卡地图：确定性 + 连通性校验 ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildLevelWalls(idx) {
    var rng = mulberry32(0x5EEB000 + idx * 7919);
    var g = [];
    for (var y = 0; y < GRID; y++) {
      g[y] = [];
      for (var x = 0; x < GRID; x++) g[y][x] = 0;
    }
    function clearStart() {
      for (var yy = 8; yy <= 12; yy++) {
        for (var xx = 1; xx <= 14; xx++) g[yy][xx] = 0;
      }
    }
    var i, j, r, c;
    switch (idx % 6) {
      case 0: /* 对称竖栅栏 */
        for (c = 0; c < 3; c++) {
          var col = 4 + c * 5;
          for (r = 1; r < 19; r++) if ((r + c * 2) % 6 !== 0) g[r][col] = 1;
          for (r = 1; r < 19; r++) if ((r + c * 2) % 6 !== 0) g[r][19 - col] = 1;
        }
        break;
      case 1: /* 对称墩柱 */
        for (r = 2; r < 18; r += 3) {
          for (c = 2; c < 18; c += 3) {
            if (rng() < 0.55) {
              g[r][c] = 1;
              if (rng() < 0.7) g[19 - r][19 - c] = 1;
            }
          }
        }
        break;
      case 2: /* 蛇形迷宫横墙 */
        for (r = 3; r <= 15; r += 4) {
          var gap = 3 + Math.floor(rng() * 12);
          for (c = 1; c < 19; c++) if (c !== gap && c !== gap + 1) g[r][c] = 1;
        }
        break;
      case 3: /* 菱形环，带开口 */
        for (r = 0; r < GRID; r++) {
          for (c = 0; c < GRID; c++) {
            var d = Math.abs(c - 9.5) + Math.abs(r - 9.5);
            if (d > 6.4 && d < 7.6 && (c + r) % 7 > 2) g[r][c] = 1;
          }
        }
        break;
      case 4: /* 棋盘方块 */
        for (r = 1; r < 19; r++) {
          for (c = 1; c < 19; c++) {
            if ((Math.floor(r / 2) + Math.floor(c / 2)) % 3 === 0 && (r % 2 === 0 || c % 2 === 0)) g[r][c] = 1;
          }
        }
        break;
      default: /* 螺旋走廊 */
        for (i = 2; i < 18; i++) {
          g[2][i] = 1;
          g[17][i] = 1;
          g[i][2] = 1;
          g[i][17] = 1;
        }
        g[2][16] = 0; g[17][3] = 0; g[15][2] = 0; g[4][17] = 0;
        for (i = 5; i < 15; i++) {
          g[6][i] = 1;
          g[13][i] = 1;
          g[i][6] = 1;
          g[i][13] = 1;
        }
        g[6][12] = 0; g[13][7] = 0; g[11][6] = 0; g[8][13] = 0;
        break;
    }
    clearStart();
    /* 连通性校验：从蛇初始头部出发覆盖不到 120 格时，确定性拆墙 */
    for (var attempt = 0; attempt < 60; attempt++) {
      var reach = reachableCount(9, 10, g);
      if (reach >= 120) break;
      var walls = [];
      for (r = 1; r < GRID - 1; r++) {
        for (c = 1; c < GRID - 1; c++) {
          if (g[r][c] && !(r >= 8 && r <= 12 && c >= 1 && c <= 14)) walls.push([r, c]);
        }
      }
      for (var w = 0; w < Math.min(8, walls.length); w++) {
        if (rng() < 0.5) {
          var pick = Math.floor(rng() * walls.length);
          g[walls[pick][0]][walls[pick][1]] = 0;
          walls.splice(pick, 1);
        }
      }
    }
    return g;
  }

  function reachableCount(sx, sy, g) {
    var seen = {};
    var q = [[sx, sy]];
    seen[keyOf(sx, sy)] = 1;
    var n = 0;
    while (q.length) {
      var cur = q.pop();
      n++;
      var x = cur[0], y = cur[1];
      var nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (var k = 0; k < 4; k++) {
        var nx = nb[k][0], ny = nb[k][1];
        if (!inBounds(nx, ny)) continue;
        if (g[ny][nx]) continue;
        if (seen[keyOf(nx, ny)]) continue;
        seen[keyOf(nx, ny)] = 1;
        q.push([nx, ny]);
      }
    }
    return n;
  }

  /* 可达区域（避开墙/障碍/猎手） */
  function reachMap(sx, sy) {
    var seen = {};
    var q = [[sx, sy]];
    seen[keyOf(sx, sy)] = 1;
    while (q.length) {
      var cur = q.pop();
      var nb = [[cur[0] + 1, cur[1]], [cur[0] - 1, cur[1]], [cur[0], cur[1] + 1], [cur[0], cur[1] - 1]];
      for (var k = 0; k < 4; k++) {
        var nx = nb[k][0], ny = nb[k][1];
        if (!inBounds(nx, ny)) continue;
        if (isWall(nx, ny) || isObstacle(nx, ny) || hunterAt(nx, ny) >= 0) continue;
        if (seen[keyOf(nx, ny)]) continue;
        seen[keyOf(nx, ny)] = 1;
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  /* ---------------- 食物：扫描空格，满盘直接结算 ---------------- */
  function placeFood() {
    food = null;
    var free = [];
    var x, y;
    for (y = 0; y < GRID; y++) {
      for (x = 0; x < GRID; x++) {
        if (isWall(x, y) || isObstacle(x, y)) continue;
        if (isPortalCell(x, y)) continue;
        if (hunterAt(x, y) >= 0) continue;
        if (bodyAt(x, y)) continue;
        free.push({ x: x, y: y });
      }
    }
    if (!free.length) { boardFull(); return; }

    var pool = free;
    if (mode && (mode.levelMode || portals.length || hunters.length)) {
      var heads = snakes[0].length ? snakes[0][0] : null;
      if (heads) {
        var reach = reachMap(heads.x, heads.y);
        pool = free.filter(function (c) { return reach[keyOf(c.x, c.y)]; });
        if (!pool.length) pool = free;
      }
    }
    food = randCellIn(pool);
  }

  function boardFull() {
    if (mode && mode.duelmode) {
      endDuo('full', [false, false]);
    } else {
      endGame('full');
    }
  }

  /* ---------------- 障碍 / 传送门 / 猎手 ---------------- */
  function placeObstacles(n) {
    obstacles = [];
    var tries = 0;
    while (obstacles.length < n && tries < 900) {
      tries++;
      var x = Math.floor(Math.random() * GRID);
      var y = Math.floor(Math.random() * GRID);
      if (Math.abs(x - 9) <= 2 && Math.abs(y - 10) <= 2) continue;
      if (bodyAt(x, y) || isObstacle(x, y) || isWall(x, y)) continue;
      obstacles.push({ x: x, y: y });
    }
  }

  function setupPortals(wanted) {
    portals = [];
    portalHue = (portalHue + 57) % 360;
    if (!wanted) return;
    for (var p = 0; p < wanted; p++) {
      var free = [];
      for (var y = 0; y < GRID; y++) {
        for (var x = 0; x < GRID; x++) {
          if (isWall(x, y) || isObstacle(x, y)) continue;
          if (hunterAt(x, y) >= 0 || bodyAt(x, y)) continue;
          if (isPortalCell(x, y)) continue;
          if (food && food.x === x && food.y === y) continue;
          free.push({ x: x, y: y });
        }
      }
      var made = false;
      for (var t = 0; t < 40 && !made && free.length >= 2; t++) {
        var a = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        var b = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 3) { free.push(a, b); continue; }
        portals.push({ a: a, b: b, phase: Math.random() * Math.PI * 2 });
        made = true;
      }
    }
  }

  function wantedPortals() {
    if (!mode) return 0;
    if (mode.portalMode) return Math.min(2, 1 + Math.floor(foodCount / 5));
    if (mode.levelMode) return level >= 3 ? 1 : 0;
    if (mode.hunterMode || mode.duelmode) return 0;
    return level >= 3 ? 1 : 0;
  }

  function setupHunters() {
    hunters = [];
    if (!mode) return;
    var count = 0;
    if (mode.hunterMode) count = difficulty === 'hard' ? 2 : 1;
    else if (mode.levelMode && level >= 5) count = 1;
    for (var i = 0; i < count; i++) {
      var head = snakes[0][0];
      var reach = reachMap(head.x, head.y);
      var cands = [];
      for (var y = 0; y < GRID; y++) {
        for (var x = 0; x < GRID; x++) {
          if (isWall(x, y) || isObstacle(x, y) || isPortalCell(x, y)) continue;
          if (bodyAt(x, y) || hunterAt(x, y) >= 0) continue;
          if (Math.abs(x - head.x) + Math.abs(y - head.y) < 9) continue;
          if (!reach[keyOf(x, y)]) continue;
          cands.push({ x: x, y: y });
        }
      }
      if (!cands.length) break;
      var pick = randCellIn(cands);
      hunters.push({ x: pick.x, y: pick.y, phase: Math.random() * Math.PI * 2, warn: 0 });
    }
  }

  /* 猎手安全移动：不把蛇周围可活动空间堵死 */
  function hunterSafeMove(h, nx, ny) {
    if (!inBounds(nx, ny)) return false;
    if (isWall(nx, ny) || isObstacle(nx, ny) || isPortalCell(nx, ny)) return false;
    if (hunterAt(nx, ny) >= 0) return false;
    var head = snakes[0][0];
    if (nx === head.x && ny === head.y) return true; /* 直接扑杀，游戏随即结束 */
    var seen = {};
    var q = [[head.x, head.y]];
    seen[keyOf(head.x, head.y)] = 1;
    var freeCount = 0;
    while (q.length) {
      var cur = q.pop();
      freeCount++;
      var nb = [[cur[0] + 1, cur[1]], [cur[0] - 1, cur[1]], [cur[0], cur[1] + 1], [cur[0], cur[1] - 1]];
      for (var k = 0; k < 4; k++) {
        var x = nb[k][0], y = nb[k][1];
        if (!inBounds(x, y)) continue;
        if (isWall(x, y) || isObstacle(x, y) || isPortalCell(x, y)) continue;
        if (hunterAt(x, y) >= 0 && !(x === h.x && y === h.y)) continue;
        if (x === nx && y === ny) continue;
        if (bodyAt(x, y)) continue;
        if (seen[keyOf(x, y)]) continue;
        seen[keyOf(x, y)] = 1;
        q.push([x, y]);
      }
    }
    return freeCount >= 12;
  }

  /* BFS 找猎手的下一步（绕墙/障碍/蛇身，目标蛇头） */
  function hunterNextStep(h) {
    var target = snakes[0][0];
    var start = keyOf(h.x, h.y);
    var prev = {};
    prev[start] = -1;
    var q = [[h.x, h.y]];
    var found = false;
    var endKey = -1;
    while (q.length) {
      var cur = q.shift();
      var nb = [[cur[0] + 1, cur[1]], [cur[0] - 1, cur[1]], [cur[0], cur[1] + 1], [cur[0], cur[1] - 1]];
      for (var k = 0; k < 4; k++) {
        var x = nb[k][0], y = nb[k][1];
        if (!inBounds(x, y)) continue;
        if (x === target.x && y === target.y) {
          prev[keyOf(x, y)] = keyOf(cur[0], cur[1]);
          endKey = keyOf(x, y);
          found = true;
          q.length = 0;
          break;
        }
        if (isWall(x, y) || isObstacle(x, y) || isPortalCell(x, y)) continue;
        if (hunterAt(x, y) >= 0) continue;
        if (bodyAt(x, y)) continue;
        if (prev[keyOf(x, y)] !== undefined) continue;
        prev[keyOf(x, y)] = keyOf(cur[0], cur[1]);
        q.push([x, y]);
      }
    }
    if (!found) return null;
    var curKey = endKey;
    while (prev[curKey] !== -1 && prev[curKey] !== start) curKey = prev[curKey];
    if (prev[curKey] === -1) curKey = endKey;
    return { x: curKey % GRID, y: Math.floor(curKey / GRID) };
  }

  function moveHunters() {
    var deaths = [];
    for (var i = 0; i < hunters.length && !gameOver; i++) {
      var h = hunters[i];
      var next = hunterNextStep(h);
      if (!next) { h.warn = 0; continue; }
      if (!hunterSafeMove(h, next.x, next.y)) { h.warn = 0; continue; }
      h.x = next.x;
      h.y = next.y;
      var head = snakes[0][0];
      if (h.x === head.x && h.y === head.y) {
        deaths.push(0);
      }
      if (mode.duelmode) {
        for (var s = 1; s < snakes.length; s++) {
          var sh = snakes[s][0];
          if (sh && h.x === sh.x && h.y === sh.y) deaths.push(s);
        }
      }
    }
    if (deaths.length) {
      if (mode.duelmode) {
        var flags = [false, false];
        for (var d = 0; d < deaths.length; d++) flags[deaths[d]] = true;
        endDuo('hunter', flags);
      } else {
        endGame('hunter');
      }
    }
  }

  /* ---------------- 初始化 ---------------- */
  function hideOverlays() {
    overlayEl.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    bubbleEl.classList.remove('show');
  }

  function init() {
    hideOverlays();
    gameOver = false;
    paused = false;
    foodCount = 0;
    scores = [0, 0];
    sprintElapsed = 0;
    gameElapsed = 0;
    hunterTick = 0;
    levelFlash = 0;
    deathFlash = 0;
    update.lastWarn = false;
    portals = [];
    hunters = [];
    obstacles = [];
    levelWalls = [];
    dirQueues = [[], []];
    var d = DIFFS[difficulty];
    stepMs = mode.autoAccel ? Math.round(d.start * 1.8) : d.start;

    if (mode.duelmode) {
      snakes[0] = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
      snakes[1] = [{ x: 14, y: 10 }, { x: 15, y: 10 }, { x: 16, y: 10 }];
      dirs[0] = { x: 1, y: 0 };
      dirs[1] = { x: -1, y: 0 };
    } else {
      snakes[0] = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
      snakes[1] = [];
      dirs[0] = { x: 1, y: 0 };
    }

    if (mode.levelMode) {
      level = 1;
      levelWalls = buildLevelWalls(level);
    } else {
      level = 1;
      levelWalls = [];
    }
    if (mode.obstacle) placeObstacles(d.obs);

    setupHunters();
    setupPortals(wantedPortals());
    placeFood();

    if (!gameOver) writeSave();
    updateHUD();
    msgEl.textContent = modeHint();
    if (mode.sprint) showBubble(T('gs.snake.sprintMsg'), 'var(--neon-cyan)', 1800);
    if (hunters.length) showBubble(T('gs.snake.hunterAppear'), '#ff5e5e', 1800);
    if (portals.length) showBubble(T('gs.snake.portalAppear'), '#b967ff', 1500);
  }

  function modeHint() {
    if (!mode) return '';
    if (mode.levelMode) return T('gs.snake.levelStartFmt').replace('{n}', level).replace('{t}', LEVEL_TARGETS[level - 1]) + ' · ' + T('gs.snake.pauseHint');
    if (mode.duelmode) return T('gs.snake.duoP1Hint') + ' / ' + T('gs.snake.duoP2Hint');
    return T(mode.name) + ' · ' + T(DIFFS[difficulty].name) + ' · ' + T('gs.snake.pauseHint');
  }

  /* ---------------- HUD ---------------- */
  function updateHUD() {
    var p1 = snakes[0] || [];
    var p2 = snakes[1] || [];
    scoreEl.textContent = String(scores[0]);
    lenEl.textContent = String(p1.length);
    levelEl.textContent = String(level);
    var target = mode && mode.levelMode ? LEVEL_TARGETS[level - 1] : 0;
    targetWrap.classList.toggle('hidden', !target);
    if (target) targetValEl.textContent = foodCount + '/' + target;
    sprintWrap.classList.toggle('hidden', !(mode && mode.sprint));
    if (mode && mode.sprint) sprintValEl.textContent = String(Math.max(0, 60 - Math.floor(sprintElapsed / 1000)));

    var duo = !!(mode && mode.duelmode);
    statsEl.classList.toggle('hidden', duo);
    duoHud.classList.toggle('hidden', !duo);
    ctrlEl.classList.toggle('hidden', false);
    if (duo) {
      p1ScoreEl.textContent = String(scores[0]);
      p1LenEl.textContent = String(p1.length);
      p2ScoreEl.textContent = String(scores[1]);
      p2LenEl.textContent = String(p2.length);
    }
    var touch = Arcade.input && Arcade.input.isTouch && Arcade.input.isTouch();
    duoPads.classList.toggle('hidden', !(duo && touch));
    dpadHolder.classList.toggle('hidden', !!(duo && touch));
  }

  /* ---------------- 方向输入 ---------------- */
  function queueDir(idx, nx, ny) {
    if (gameOver || paused || menuActive || !snakes[idx] || !snakes[idx].length) return;
    if (idx === 1 && !mode.duelmode) return;
    var q = dirQueues[idx];
    var last = q.length ? q[q.length - 1] : dirs[idx];
    if ((last.x === nx && last.y === ny) || (last.x === -nx && last.y === -ny)) return;
    if (q.length < 3) q.push({ x: nx, y: ny });
  }

  function dirByName(idx, name) {
    if (name === 'up') queueDir(idx, 0, -1);
    else if (name === 'down') queueDir(idx, 0, 1);
    else if (name === 'left') queueDir(idx, -1, 0);
    else if (name === 'right') queueDir(idx, 1, 0);
  }

  /* ---------------- 移动 ---------------- */
  function planMove(idx) {
    var sn = snakes[idx];
    var q = dirQueues[idx];
    var dir = q.length ? q.shift() : dirs[idx];
    dirs[idx] = dir;
    var head = { x: sn[0].x + dir.x, y: sn[0].y + dir.y };
    if (mode.wrap) {
      head.x = (head.x + GRID) % GRID;
      head.y = (head.y + GRID) % GRID;
    } else if (!inBounds(head.x, head.y)) {
      return { fail: 'wall' };
    }
    if (isWall(head.x, head.y)) return { fail: 'wall' };
    if (isObstacle(head.x, head.y)) return { fail: 'obstacle' };
    var partner = portalPartner(head.x, head.y);
    var teleported = false;
    if (partner) {
      head = { x: partner.x, y: partner.y };
      teleported = true;
      if (isWall(head.x, head.y)) return { fail: 'wall' };
      if (isObstacle(head.x, head.y)) return { fail: 'obstacle' };
    }
    if (hunterAt(head.x, head.y) >= 0) return { fail: 'hunter' };

    var eating = !!(food && head.x === food.x && head.y === food.y);
    var limit = eating ? sn.length : sn.length - 1;
    for (var i = 0; i < limit; i++) {
      if (sn[i].x === head.x && sn[i].y === head.y) return { fail: 'self' };
    }
    for (var s = 0; s < snakes.length; s++) {
      if (s === idx) continue;
      for (var j = 0; j < snakes[s].length; j++) {
        if (snakes[s][j].x === head.x && snakes[s][j].y === head.y) return { fail: 'duo' };
      }
    }
    return { head: head, eating: eating, teleported: teleported };
  }

  function applyMove(idx, res) {
    var sn = snakes[idx];
    sn.unshift(res.head);
    if (res.eating) {
      scores[idx] += 10;
      eatFx(res.head, idx);
    } else {
      sn.pop();
    }
  }

  function afterEat() {
    foodCount++;
    if (mode.levelMode) {
      var target = LEVEL_TARGETS[level - 1];
      if (foodCount >= target) {
        advanceLevel();
        return;
      }
    } else if (foodCount % 5 === 0) {
      level++;
      levelFlash = 1;
      showBubble(T('gs.snake.levelUp').replace('{n}', level), 'var(--neon-yellow)', 5500);
      refreshSpecial();
    }
    placeFood();
  }

  function refreshSpecial() {
    if (mode.duelmode) return;
    var wanted = wantedPortals();
    if (mode.portalMode || wanted !== portals.length) {
      setupPortals(wanted);
      if (portals.length) showBubble(T('gs.snake.portalShift'), '#b967ff', 1600);
    }
  }

  function updateSolo() {
    var res = planMove(0);
    if (res.fail) { endGame(res.fail); return; }
    applyMove(0, res);
    if (res.eating) {
      updateHUD();
      afterEat();
    }
    if (!gameOver) updateHUD();
  }

  function updateDuo() {
    var a = planMove(0);
    var b = planMove(1);
    var flags = [false, false];
    var reason = null;
    if (a.fail) { flags[0] = true; reason = a.fail; }
    if (b.fail) { flags[1] = true; reason = reason || b.fail; }
    if (!a.fail && !b.fail && a.head.x === b.head.x && a.head.y === b.head.y) {
      flags = [true, true];
      reason = 'duo';
    }
    if (flags[0] || flags[1]) { endDuo(reason, flags); return; }

    applyMove(0, a);
    applyMove(1, b);
    if (a.eating || b.eating) {
      updateHUD();
      afterEat();
    }
    if (!gameOver) updateHUD();
  }

  function advanceLevel() {
    level++;
    if (level > 6) {
      scoreAllClear();
      return;
    }
    foodCount = 0;
    dirQueues = [[], []];
    snakes[0] = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    dirs[0] = { x: 1, y: 0 };
    levelWalls = buildLevelWalls(level);
    portals = [];
    hunters = [];
    setupHunters();
    setupPortals(wantedPortals());
    placeFood();
    levelFlash = 1;
    stepMs = DIFFS[difficulty].start;
    if (gameLoop) gameLoop.setStep(stepMs);
    updateHUD();
    showBubble(T('gs.snake.levelClearFmt').replace('{n}', level - 1) + ' · ' + T('gs.snake.levelStartFmt').replace('{n}', level).replace('{t}', LEVEL_TARGETS[level - 1]), 'var(--neon-yellow)', 2200);
    if (hunters.length) showBubble(T('gs.snake.hunterAppear'), '#ff5e5e', 1500);
    writeSave();
  }

  /* ---------------- 游戏循环 ---------------- */
  function update() {
    if (gameOver || paused || menuActive) return;
    gameElapsed += stepMs;

    if (mode.sprint) {
      sprintElapsed += stepMs;
      var left = 60 - Math.floor(sprintElapsed / 1000);
      sprintValEl.textContent = String(Math.max(0, left));
      if (left <= 0) {
        scores[0] += 30;
        endGame('sprint');
        return;
      }
      if (left <= 10) {
        msgEl.textContent = T('gs.snake.sprintLeft').replace('{n}', left).replace('{s}', scores[0]) + ' · ' + T('gs.snake.pauseHint');
      }
      if (left <= 10 && !update.lastWarn) {
        update.lastWarn = true;
        showBubble(T('gs.snake.sprintWarn').replace('{n}', left), 'var(--neon-pink)', 1600);
        if (Arcade.audio) Arcade.audio.play('ui');
      }
    }

    if (mode.duelmode) updateDuo(); else updateSolo();
    if (gameOver) return;

    if (hunters.length) {
      hunterTick++;
      var every = DIFFS[difficulty].hunterEvery;
      if (hunterTick >= every) {
        hunterTick = 0;
        moveHunters();
        if (gameOver) return;
        if (hunters.length) updateHUD();
      }
    }

    if (mode.autoAccel) {
      stepMs = Math.max(STEP_MIN, stepMs - DIFFS[difficulty].accel);
      if (gameLoop) gameLoop.setStep(stepMs);
    }
  }

  function eatFx(cell, idx) {
    var r = canvas.getBoundingClientRect();
    var p = cellPixel(cell);
    var x = r.left + p.x * (r.width / (GRID * CELL));
    var y = r.top + p.y * (r.height / (GRID * CELL));
    if (Arcade.juice && Arcade.juice.coin) Arcade.juice.coin(x, y, idx === 1 ? '#d05bff' : '#ff2d95');
    else if (Arcade.fx) Arcade.fx.burst(x, y, '#ff2d95', 16);
    if (Arcade.fx && Arcade.fx.shake) Arcade.fx.shake(stageEl);
  }

  function cellPixel(cell) {
    return { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 };
  }

  /* ---------------- 结算 ---------------- */
  function updateBestLine() {
    /* 双人对战为本地 PvP，不写排行榜，避免双人合计分污染单人榜单 */
    var isNew = (!mode || !mode.duelmode) && Arcade.shell ? Arcade.shell.submitScore(scores[0]) : false;
    if (ovBestEl) {
      var best = 0;
      try { best = (Arcade.storage && Arcade.storage.getBest('snake')) || 0; } catch (e) { best = 0; }
      ovBestEl.textContent = String(Math.max(best, scores[0], scores[1], mode && mode.duelmode ? scores[0] + scores[1] : 0)) + (isNew ? ' · ' + T('gs.snake.newRecord') : '');
    }
  }

  function deathFx() {
    deathFlash = 1;
    if (Arcade.fx) {
      Arcade.fx.flash('#ff2d95');
      Arcade.fx.shake(stageEl);
    }
    var r = canvas.getBoundingClientRect();
    for (var s = 0; s < snakes.length; s++) {
      for (var i = 0; i < snakes[s].length; i += 3) {
        var p = cellPixel(snakes[s][i]);
        var x = r.left + p.x * (r.width / (GRID * CELL));
        var y = r.top + p.y * (r.height / (GRID * CELL));
        if (Arcade.fx) Arcade.fx.burst(x, y, s === 1 ? '#d05bff' : '#39ff14', 3);
      }
    }
  }

  function causeText(reason) {
    if (reason === 'wall') return T('gs.snake.deathWall');
    if (reason === 'obstacle') return T('gs.snake.deathObs');
    if (reason === 'self') return T('gs.snake.deathSelf');
    if (reason === 'hunter') return T('gs.snake.deathHunter');
    if (reason === 'duo') return T('gs.snake.duoCrash');
    return '';
  }

  function endGame(reason) {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    if (gameLoop) gameLoop.pause();
    pauseOverlay.classList.add('hidden');

    var win = reason === 'sprint' || reason === 'full';
    if (reason === 'sprint' || reason === 'full') {
      if (reason === 'sprint') scores[0] += 0;
    }
    finalScoreEl.textContent = String(scores[0]);
    ovTitleEl.textContent = reason === 'sprint' ? T('gs.snake.sprintDone')
      : (reason === 'full' ? T('gs.snake.fullWin') : T('gs.snake.gameOver'));
    var cause = causeText(reason);
    if (reason === 'full') cause = T('gs.snake.fullWinCause').replace('{n}', snakes[0].length);
    else if (reason === 'sprint') cause = T('gs.snake.sprintEnd').replace('{s}', scores[0]);
    if (!win && mode.levelMode) cause = T('gs.snake.levelFailFmt').replace('{n}', level) + (cause ? ' · ' + cause : '');
    else if (!win && cause) cause += ' · ' + T('gs.snake.levelReached').replace('{n}', level);
    ovCauseEl.textContent = cause;
    overlayEl.classList.remove('hidden');
    updateBestLine();
    Arcade.savegame.clear();
    if (win) {
      if (Arcade.juice) Arcade.juice.win();
    } else {
      deathFx();
      if (Arcade.juice) Arcade.juice.lose();
    }
  }

  function endDuo(reason, flags) {
    if (gameOver) return;
    gameOver = true;
    paused = false;
    if (gameLoop) gameLoop.pause();
    flags = flags || [false, false];
    var dead1 = !!flags[0], dead2 = !!flags[1];
    var p1 = scores[0], p2 = scores[1];
    var winner;
    if (dead1 && dead2) winner = T('gs.snake.duoDraw');
    else if (dead1) winner = T('gs.snake.duoWinnerP2');
    else if (dead2) winner = T('gs.snake.duoWinnerP1');
    else winner = p1 > p2 ? T('gs.snake.duoWinnerP1') : (p2 > p1 ? T('gs.snake.duoWinnerP2') : T('gs.snake.duoDraw'));
    finalScoreEl.textContent = String(p1 + p2);
    ovTitleEl.textContent = T('gs.snake.duoResult');
    var lines = winner + ' · ' + T('gs.snake.duoScoreFmt').replace('{a}', p1).replace('{b}', p2);
    if (reason === 'full') lines += ' · ' + T('gs.snake.fullWin');
    else if (reason === 'duo') {
      lines += ' · ' + (dead1 && dead2 ? T('gs.snake.duoCrash')
        : (dead1 ? T('gs.snake.duoP1Hit') : T('gs.snake.duoP2Hit')));
    } else if (reason) lines += ' · ' + causeText(reason);
    ovCauseEl.textContent = lines;
    overlayEl.classList.remove('hidden');
    updateBestLine();
    Arcade.savegame.clear();
    deathFx();
    if (Arcade.juice) Arcade.juice.lose();
  }

  function scoreAllClear() {
    if (gameOver) return;
    gameOver = true;
    if (gameLoop) gameLoop.pause();
    finalScoreEl.textContent = String(scores[0]);
    ovTitleEl.textContent = T('gs.snake.allLevelsWin');
    ovCauseEl.textContent = T('gs.snake.levelReached').replace('{n}', 6) + ' · ' + T('gs.snake.score') + ' ' + scores[0];
    overlayEl.classList.remove('hidden');
    updateBestLine();
    Arcade.savegame.clear();
    if (Arcade.juice) Arcade.juice.win();
  }

  /* ---------------- 渲染 ---------------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPortalPair(p, i, now) {
    var cells = [p.a, p.b];
    var hue = (portalHue + i * 70) % 360;
    for (var k = 0; k < 2; k++) {
      var c = cells[k];
      var cx = c.x * CELL + CELL / 2;
      var cy = c.y * CELL + CELL / 2;
      var phase = now / 700 + p.phase + k * Math.PI;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phase);
      ctx.strokeStyle = 'hsla(' + hue + ',100%,68%,0.95)';
      ctx.shadowColor = 'hsl(' + hue + ',100%,62%)';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.33, 0.2, Math.PI * 1.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.22, Math.PI, Math.PI * 2.1);
      ctx.stroke();
      ctx.rotate(-phase * 2);
      ctx.fillStyle = 'hsla(' + hue + ',100%,78%,' + (0.28 + Math.sin(now / 260 + i) * 0.10) + ')';
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHunter(h, now, i) {
    var cx = h.x * CELL + CELL / 2;
    var cy = h.y * CELL + CELL / 2;
    var pulse = 0.5 + Math.sin(now / 180 + h.phase) * 0.5;
    ctx.save();
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 16 + pulse * 10;
    var grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, CELL * 0.72);
    grad.addColorStop(0, '#ff8bc4');
    grad.addColorStop(0.45, '#d0146c');
    grad.addColorStop(1, 'rgba(80,0,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,45,149,' + (0.45 + pulse * 0.4) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.5 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2a0016';
    roundRect(cx - 6, cy - 6, 12, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 1, 1.8, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    if (h.warn > 0) {
      ctx.strokeStyle = 'rgba(255,230,0,' + h.warn + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    var now = performance.now();
    var BW = GRID * CELL;
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, BW, BW);

    ctx.strokeStyle = 'rgba(0,240,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gi = 1; gi < GRID; gi++) {
      ctx.moveTo(gi * CELL + 0.5, 0);
      ctx.lineTo(gi * CELL + 0.5, BW);
      ctx.moveTo(0, gi * CELL + 0.5);
      ctx.lineTo(BW, gi * CELL + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,230,0,' + (0.25 + levelFlash * 0.75) + ')';
    ctx.lineWidth = 2 + levelFlash * 3;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, BW - ctx.lineWidth, BW - ctx.lineWidth);
    if (levelFlash > 0) levelFlash *= 0.9;

    var x, y, i;
    for (y = 0; y < GRID; y++) {
      for (x = 0; x < GRID; x++) {
        if (isWall(x, y)) {
          ctx.save();
          ctx.fillStyle = '#1b2436';
          ctx.strokeStyle = 'rgba(0,240,255,0.35)';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 4;
          roundRect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3, 3);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    for (i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      ctx.save();
      ctx.fillStyle = '#3a3a5a';
      ctx.shadowColor = '#5a5a8a';
      ctx.shadowBlur = 4;
      roundRect(o.x * CELL + 2, o.y * CELL + 2, CELL - 4, CELL - 4, 4);
      ctx.fill();
      ctx.restore();
    }

    for (i = 0; i < portals.length; i++) drawPortalPair(portals[i], i, now);

    if (food) {
      var pulse = 1 + Math.sin(now / 180) * 0.15;
      var fx = food.x * CELL + CELL / 2;
      var fy = food.y * CELL + CELL / 2;
      ctx.save();
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff2d95';
      ctx.beginPath();
      ctx.arc(fx, fy, (CELL / 2 - 4) * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(fx - 2, fy - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (i = 0; i < hunters.length; i++) drawHunter(hunters[i], now, i);

    for (var s = 0; s < snakes.length; s++) {
      var sn = snakes[s];
      var col = SNAKE_COLORS[s];
      for (var j = sn.length - 1; j >= 0; j--) {
        var seg = sn[j];
        var t = sn.length <= 1 ? 0 : j / (sn.length - 1);
        var light = Math.round(62 - t * 40);
        ctx.save();
        ctx.shadowColor = col.glow;
        ctx.shadowBlur = j === 0 ? 18 : (s === 1 ? 10 : 10);
        ctx.fillStyle = j === 0 ? col.head : (col.body + light + '%)');
        roundRect(seg.x * CELL + 1.5, seg.y * CELL + 1.5, CELL - 3, CELL - 3, 5);
        ctx.fill();
        if (j === 0) {
          ctx.fillStyle = '#0a0a12';
          var hx = seg.x * CELL + CELL / 2, hy = seg.y * CELL + CELL / 2;
          ctx.beginPath();
          ctx.arc(hx - 3, hy, 1.8, 0, Math.PI * 2);
          ctx.arc(hx + 3, hy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    if (deathFlash > 0) {
      ctx.fillStyle = 'rgba(255,45,149,' + (deathFlash * 0.35) + ')';
      ctx.fillRect(0, 0, BW, BW);
      deathFlash *= 0.88;
    }
  }

  /* ---------------- 暂停 ---------------- */
  function togglePause() {
    if (menuActive || gameOver || !started) return;
    paused = !paused;
    if (paused) {
      if (gameLoop) gameLoop.pause();
      pauseTitleUpdate();
      pauseOverlay.classList.remove('hidden');
      if (pauseBtn) pauseBtn.textContent = T('gs.snake.resume');
      writeSave();
    } else {
      pauseOverlay.classList.add('hidden');
      if (pauseBtn) pauseBtn.textContent = T('gs.snake.pause');
      if (gameLoop) gameLoop.resume();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function pauseTitleUpdate() {
    var pt = document.getElementById('pause-title');
    if (pt) pt.textContent = T('gs.snake.pauseTitle') + (mode && mode.sprint ? ' · ' + String(Math.max(0, 60 - Math.floor(sprintElapsed / 1000))) + 's' : '');
  }

  /* ---------------- 气泡 ---------------- */
  function showBubble(text, color, ms) {
    if (!bubbleEl) return;
    bubbleEl.textContent = text;
    bubbleEl.style.color = color || 'var(--neon-yellow)';
    bubbleEl.classList.remove('show');
    void bubbleEl.offsetWidth;
    bubbleEl.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubbleEl.classList.remove('show'); }, ms || 1400);
  }

  /* ---------------- 存档 ---------------- */
  function snapshot() {
    if (!started || menuActive || gameOver || !mode) return null;
    return {
      v: 3,
      mode: selectedMode,
      diff: selectedDiff,
      level: level,
      foodCount: foodCount,
      scores: [scores[0], scores[1]],
      stepMs: stepMs,
      gameElapsed: gameElapsed,
      sprintElapsed: sprintElapsed,
      snakes: snakes,
      dirs: dirs,
      food: food,
      obstacles: obstacles,
      portals: portals,
      hunters: hunters
    };
  }

  function writeSave() {
    if (suppressSave) return;
    if (Arcade.savegame) Arcade.savegame.write();
  }

  function validSave(s) {
    if (!s || typeof s !== 'object') return false;
    if (!MODES[s.mode] || !DIFFS[s.diff]) return false;
    return true;
  }

  function sanitizeCells(arr) {
    if (!Array.isArray(arr)) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (!c || typeof c.x !== 'number' || typeof c.y !== 'number') continue;
      if (!inBounds(c.x, c.y)) continue;
      out.push({ x: c.x, y: c.y });
    }
    return out.length ? out : null;
  }

  function restoreGame(s) {
    selectedMode = s.mode;
    selectedDiff = s.diff;
    mode = MODES[selectedMode];
    difficulty = selectedDiff;
    menuEl.classList.add('hidden');
    stageEl.classList.remove('hidden');
    statsEl.classList.remove('hidden');
    helpEl.classList.remove('hidden');
    menuActive = false;
    started = true;
    suppressSave = true;
    init();
    suppressSave = false;

    level = Math.max(1, Math.min(6, s.level || 1));
    foodCount = Math.max(0, s.foodCount || 0);
    if (Array.isArray(s.scores) && s.scores.length) scores = [Number(s.scores[0]) || 0, Number(s.scores[1]) || 0];
    stepMs = (typeof s.stepMs === 'number' && s.stepMs >= STEP_MIN) ? s.stepMs : DIFFS[difficulty].start;
    gameElapsed = Number(s.gameElapsed) || 0;
    sprintElapsed = Number(s.sprintElapsed) || 0;

    if (mode.levelMode) {
      levelWalls = buildLevelWalls(level);
    } else {
      levelWalls = [];
    }

    var savedSnakes = Array.isArray(s.snakes) ? s.snakes : null;
    if (savedSnakes && Array.isArray(savedSnakes[0])) {
      var a = sanitizeCells(savedSnakes[0]);
      var b = Array.isArray(savedSnakes[1]) ? sanitizeCells(savedSnakes[1]) : null;
      if (a) snakes[0] = a;
      if (b) snakes[1] = b;
    }
    if (Array.isArray(s.dirs) && s.dirs[0] && typeof s.dirs[0].x === 'number') {
      dirs[0] = { x: s.dirs[0].x, y: s.dirs[0].y };
      if (s.dirs[1] && typeof s.dirs[1].x === 'number') dirs[1] = { x: s.dirs[1].x, y: s.dirs[1].y };
    }
    if (Array.isArray(s.obstacles)) obstacles = sanitizeCells(s.obstacles) || [];
    if (Array.isArray(s.portals)) {
      portals = [];
      for (var i = 0; i < s.portals.length; i++) {
        var p = s.portals[i];
        if (!p || !p.a || !p.b) continue;
        if (!inBounds(p.a.x, p.a.y) || !inBounds(p.b.x, p.b.y)) continue;
        portals.push({ a: { x: p.a.x, y: p.a.y }, b: { x: p.b.x, y: p.b.y }, phase: Number(p.phase) || 0 });
      }
    }
    if (Array.isArray(s.hunters)) {
      hunters = [];
      for (var hh = 0; hh < s.hunters.length; hh++) {
        var h = s.hunters[hh];
        if (!h || !inBounds(h.x, h.y)) continue;
        hunters.push({ x: h.x, y: h.y, phase: Number(h.phase) || 0, warn: 0 });
      }
    }
    food = (s.food && inBounds(s.food.x, s.food.y)) ? { x: s.food.x, y: s.food.y } : null;
    if (!food && snakes[0].length) placeFood();
    overlayEl.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    updateHUD();
    if (gameLoop) { gameLoop.setStep(stepMs); gameLoop.resume(); }
    else gameLoop = Arcade.loop.start(update, render, stepMs);
    msgEl.textContent = modeHint();
  }

  /* ---------------- 启动 / 重开 ---------------- */
  function startLoop() {
    if (gameLoop) {
      gameLoop.setStep(stepMs);
      gameLoop.resume();
    } else {
      gameLoop = Arcade.loop.start(update, render, stepMs);
    }
  }

  function startGame(restore) {
    mode = MODES[selectedMode];
    difficulty = selectedDiff;
    menuEl.classList.add('hidden');
    stageEl.classList.remove('hidden');
    statsEl.classList.remove('hidden');
    helpEl.classList.remove('hidden');
    menuActive = false;
    started = true;
    if (restore) { restoreGame(restore); return; }
    init();
    startLoop();
  }

  function restartRound() {
    if (!mode) return;
    menuActive = false;
    init();
    if (gameLoop) { gameLoop.setStep(stepMs); gameLoop.resume(); }
    else startLoop();
  }

  function backToMenu() {
    if (gameLoop) gameLoop.pause();
    started = false;
    menuActive = true;
    gameOver = false;
    paused = false;
    stageEl.classList.add('hidden');
    statsEl.classList.add('hidden');
    duoHud.classList.add('hidden');
    ctrlEl.classList.add('hidden');
    duoPads.classList.add('hidden');
    dpadHolder.classList.remove('hidden');
    helpEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    menuEl.classList.remove('hidden');
    Arcade.savegame.clear();
    msgEl.textContent = '';
  }

  /* ---------------- 菜单交互 ---------------- */
  function highlight(row, attr, val) {
    var btns = row.getElementsByTagName('button');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute(attr) === val) btns[i].classList.add('selected');
      else btns[i].classList.remove('selected');
    }
  }

  modeRow.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    selectedMode = b.getAttribute('data-mode');
    highlight(modeRow, 'data-mode', selectedMode);
    var tip = document.getElementById('duo-tip');
    if (tip) tip.classList.toggle('hidden', selectedMode !== 'duo');
  });
  diffRow.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    selectedDiff = b.getAttribute('data-diff');
    highlight(diffRow, 'data-diff', selectedDiff);
  });
  startBtn.addEventListener('click', function () { startGame(false); });
  menuBtn.addEventListener('click', backToMenu);
  pauseMenuBtn.addEventListener('click', backToMenu);
  resumeBtn.addEventListener('click', togglePause);
  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', function () {
    restartRound();
  });

  /* ---------------- 键盘（单人对战共用一套监听，避免双触发） ---------------- */
  window.addEventListener('keydown', function (e) {
    var code = e.code;
    if (code === 'Space' || code === 'Enter') {
      if (!menuActive) { e.preventDefault(); togglePause(); }
      return;
    }
    var nx = 0, ny = 0, isArrow = false, isWasd = false;
    if (code === 'ArrowUp') { ny = -1; isArrow = true; }
    else if (code === 'ArrowDown') { ny = 1; isArrow = true; }
    else if (code === 'ArrowLeft') { nx = -1; isArrow = true; }
    else if (code === 'ArrowRight') { nx = 1; isArrow = true; }
    else if (code === 'KeyW') { ny = -1; isWasd = true; }
    else if (code === 'KeyS') { ny = 1; isWasd = true; }
    else if (code === 'KeyA') { nx = -1; isWasd = true; }
    else if (code === 'KeyD') { nx = 1; isWasd = true; }
    else return;
    if (menuActive || gameOver) return;
    e.preventDefault();
    if (mode && mode.duelmode) {
      queueDir(isArrow ? 0 : 1, nx, ny);
    } else {
      queueDir(0, nx, ny);
    }
  });

  Arcade.input.onSwipe(canvas, function (name) {
    if (mode && mode.duelmode) return;
    dirByName(0, name);
  });

  if (Arcade.input.isTouch()) {
    Arcade.input.createDPad(dpadHolder, function (dir, pressed) {
      if (pressed && !(mode && mode.duelmode)) dirByName(0, dir);
    });
  }

  function buildDuoPads() {
    var pads = [{ el: document.getElementById('duo-pad-p1'), idx: 0 }, { el: document.getElementById('duo-pad-p2'), idx: 1 }];
    pads.forEach(function (p) {
      var dirsDef = [['up', '▲'], ['left', '◀'], ['down', '▼'], ['right', '▶']];
      p.el.innerHTML = dirsDef.map(function (d) {
        return '<button class="duo-dbtn duo-' + d[0] + '" data-dir="' + d[0] + '" aria-label="' + d[0] + '">' + d[1] + '</button>';
      }).join('');
      p.el.addEventListener('pointerdown', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        e.preventDefault();
        dirByName(p.idx, b.getAttribute('data-dir'));
      });
      p.el.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        dirByName(p.idx, b.getAttribute('data-dir'));
      });
    });
  }
  buildDuoPads();

  /* ---------------- 存档接线 ---------------- */
  var pendingRestore = null;
  Arcade.savegame.setup({
    id: 'snake',
    collect: snapshot,
    apply: function (s) {
      if (!validSave(s)) return false;
      pendingRestore = s;
      return true;
    }
  });
  Arcade.savegame.resume();
  if (pendingRestore) restoreGame(pendingRestore);

  /* ---------------- 菜单初始状态 ---------------- */
  selectedMode = 'classic';
  selectedDiff = 'normal';
  if (modeRow.getElementsByTagName('button').length) highlight(modeRow, 'data-mode', selectedMode);
  highlight(diffRow, 'data-diff', selectedDiff);
  menuActive = true;

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.snake.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    if (!mode) startGame(false); else restartRound();
  };

  /* ---------------- 仅 ?qa=1 暴露的内部钩子 ---------------- */
  if (QA) {
    window.__QA = {
      state: function () {
        return {
          mode: selectedMode, diff: difficulty, level: level, foodCount: foodCount,
          scores: scores.slice(), lengths: [snakes[0].length, snakes[1].length],
          portals: portals.length, hunters: hunters.length, obstacles: obstacles.length,
          gameOver: gameOver, paused: paused, started: started, menuActive: menuActive,
          sprintElapsed: sprintElapsed, stepMs: stepMs,
          food: food ? { x: food.x, y: food.y } : null
        };
      },
      start: function (m, d) {
        if (m && MODES[m]) selectedMode = m;
        if (d && DIFFS[d]) selectedDiff = d;
        startGame(false);
        return this.state();
      },
      endGame: function (reason) { endGame(reason || 'wall'); },
      advance: function () { advanceLevel(); return this.state(); },
      hunterKillTest: function () {
        if (!hunters.length) return { ok: false, reason: 'no-hunter' };
        var h = hunters[0];
        var cand = [
          [{ x: h.x - 1, y: h.y }, { x: 1, y: 0 }],
          [{ x: h.x + 1, y: h.y }, { x: -1, y: 0 }],
          [{ x: h.x, y: h.y - 1 }, { x: 0, y: 1 }],
          [{ x: h.x, y: h.y + 1 }, { x: 0, y: -1 }]
        ];
        var pick = null;
        for (var i = 0; i < cand.length; i++) {
          var c = cand[i][0];
          if (!inBounds(c.x, c.y) || isWall(c.x, c.y) || isObstacle(c.x, c.y) || isPortalCell(c.x, c.y)) continue;
          pick = cand[i];
          break;
        }
        if (!pick) return { ok: false, reason: 'no-entry' };
        snakes[0] = [pick[0]];
        dirs[0] = pick[1];
        dirQueues[0] = [];
        update();
        return { ok: gameOver, title: ovTitleEl.textContent, cause: ovCauseEl.textContent };
      },
      endDuo: function (reason) { endDuo(reason || 'duo', [false, false]); },
      teleportTest: function () {
        if (!portals.length) return { ok: false, reason: 'no-portal' };
        var p = portals[0];
        var cand = [
          [{ x: p.a.x - 1, y: p.a.y }, { x: 1, y: 0 }],
          [{ x: p.a.x + 1, y: p.a.y }, { x: -1, y: 0 }],
          [{ x: p.a.x, y: p.a.y - 1 }, { x: 0, y: 1 }],
          [{ x: p.a.x, y: p.a.y + 1 }, { x: 0, y: -1 }]
        ];
        var pick = null;
        for (var i = 0; i < cand.length; i++) {
          var c = cand[i][0];
          if (!inBounds(c.x, c.y) || isWall(c.x, c.y) || isObstacle(c.x, c.y) || hunterAt(c.x, c.y) >= 0) continue;
          pick = cand[i];
          break;
        }
        if (!pick) return { ok: false, reason: 'no-entry' };
        snakes[0] = [pick[0]];
        dirs[0] = pick[1];
        dirQueues[0] = [];
        update();
        return { ok: !!(snakes[0][0] && snakes[0][0].x === p.b.x && snakes[0][0].y === p.b.y),
          from: p.a, to: p.b, head: snakes[0][0] };
      },
      mapInfo: function (idx) {
        var g = buildLevelWalls(idx || level || 1);
        var walls = 0;
        for (var y = 0; y < GRID; y++) {
          for (var x = 0; x < GRID; x++) if (g[y][x]) walls++;
        }
        return { level: idx || level || 1, walls: walls, reachable: reachableCount(9, 10, g) };
      },
      fillBoard: function () {
        snakes[1] = [];
        var cells = [];
        for (var y = 0; y < GRID; y++) for (var x = 0; x < GRID; x++) cells.push({ x: x, y: y });
        snakes[0] = cells;
        food = null;
        placeFood();
        return this.state();
      },
      refeed: function () { placeFood(); return this.state(); },
      setFood: function (x, y) { if (inBounds(x, y)) food = { x: x, y: y }; return this.state(); },
      dir: function (idx, name) { dirByName(idx || 0, name); },
      togglePause: togglePause,
      save: function () { writeSave(); return true; },
      version: 3
    };
  }

})();
