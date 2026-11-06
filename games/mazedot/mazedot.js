/* ============================================================
   迷宫吃豆 Maze Dot · 5 关递进（旗舰级）
   网格坐标 + 格内插值移动：pac / 幽灵都只在格心转向，逐格检查墙体
   四种幽灵人格 · 4 张迷宫轮换 · 限时水果 · 3 条命 · 屏震/粒子/缓动
   ============================================================ */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.mazedot.tut1t'), d: T('gs.mazedot.tut1') },
  { t: T('gs.mazedot.tut2t'), d: T('gs.mazedot.tut2') },
  { t: T('gs.mazedot.tut3t'), d: T('gs.mazedot.tut3') },
  { t: T('gs.mazedot.tut4t'), d: T('gs.mazedot.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  var COLS = 15, ROWS = 15, CELL = 30;
  var W = COLS * CELL, H = ROWS * CELL;
  var PAC_CPS = 7.4;            // 每秒格数
  var HOUSE = { c: 7, r: 7 };
  var GHOST_HOME = [[7, 7], [6, 7], [8, 7], [7, 6], [7, 8]];
  var DIRS = {
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }
  };
  var OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };
  var PI2 = Math.PI * 2;
  var EATEN_TIME = 0.8;

  /* 手绘迷宫：1=墙 2=豆子 3=大力丸 0=空
     4 张布局按关轮换（1-4 关各不相同，第 5 关起循环并提速） */
  var MAPS = [
    /* A · 经典对称（原布局保留） */
    [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,1,2,1,2,1,2,1,2,1,1,2,1],
      [1,3,1,0,2,0,2,1,2,0,2,0,1,3,1],
      [1,2,1,1,2,2,2,2,2,2,2,1,1,2,1],
      [1,2,2,2,2,1,1,0,1,1,2,2,2,2,1],
      [1,2,1,0,2,0,2,2,2,0,2,0,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,0,2,0,2,2,2,0,2,0,1,2,1],
      [1,2,2,2,2,1,1,0,1,1,2,2,2,2,1],
      [1,2,1,1,2,2,2,2,2,2,2,1,1,2,1],
      [1,3,1,0,2,0,2,1,2,0,2,0,1,3,1],
      [1,2,1,1,2,1,2,1,2,1,2,1,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    /* B · 竖向长廊 + 开放广场 */
    [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,2,1,2,1,2,1,2,1,2,1,2,1],
      [1,3,1,0,2,0,1,2,1,0,2,0,1,3,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,2,1,0,1,2,2,2,1,0,1,2,2,1],
      [1,2,1,0,2,0,2,2,2,0,2,0,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,0,2,0,2,2,2,0,2,0,1,2,1],
      [1,2,2,1,0,1,2,2,2,1,0,1,2,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,3,1,0,2,0,1,2,1,0,2,0,1,3,1],
      [1,2,1,2,1,2,1,2,1,2,1,2,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    /* C · 四象限房间 + 中央回廊 */
    [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,1,2,2,1,1,1,2,2,1,1,2,1],
      [1,3,1,1,2,2,2,1,2,2,2,1,1,3,1],
      [1,2,1,1,1,2,1,1,1,2,1,1,1,2,1],
      [1,2,2,1,1,1,0,1,0,1,1,1,2,2,1],
      [1,2,1,0,1,0,2,2,2,0,1,0,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,0,1,0,2,2,2,0,1,0,1,2,1],
      [1,2,2,1,1,1,0,1,0,1,1,1,2,2,1],
      [1,2,1,1,1,2,1,1,1,2,1,1,1,2,1],
      [1,3,1,1,2,2,2,1,2,2,2,1,1,3,1],
      [1,2,1,1,2,2,1,1,1,2,2,1,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    /* D · 同心横墙 + 侧廊 */
    [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,2,2,1,2,2,2,1,2,2,1,2,1],
      [1,3,1,1,1,1,1,1,1,1,1,1,1,3,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,2,1,1,2,2,1,2,2,1,1,2,2,1],
      [1,2,1,1,0,2,1,2,1,2,0,1,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,1,0,2,1,2,1,2,0,1,1,2,1],
      [1,2,2,1,1,2,2,1,2,2,1,1,2,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,3,1,1,1,1,1,1,1,1,1,1,1,3,1],
      [1,2,1,2,2,1,2,2,2,1,2,2,1,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ]
  ];

  /* 幽灵人格：追击 / 伏击 / 游荡 / 害羞（第 5 关增援一只追击者） */
  var GHOST_TYPES = [
    { type: 'chaser', color: '#ff2d95', speed: 1.00 },
    { type: 'ambusher', color: '#00f0ff', speed: 0.94 },
    { type: 'wanderer', color: '#ff9e2d', speed: 0.86 },
    { type: 'shy', color: '#39ff14', speed: 0.92 },
    { type: 'chaser', color: '#b967ff', speed: 1.04 }
  ];

  /* 水果候选点：鬼巢附近（生成时再按当前迷宫过滤墙体） */
  var FRUIT_SPOTS = [
    [7, 5], [5, 7], [9, 7], [7, 9],
    [6, 6], [8, 6], [6, 8], [8, 8], [7, 7]
  ];

  var wrap = document.createElement('div');
  wrap.className = 'pm-wrap';
  wrap.innerHTML =
    '<div class="pm-stage">' +
    '  <canvas class="pm-canvas" id="pm-canvas" aria-label="' + T('gs.mazedot.aria') + '"></canvas>' +
    '  <div class="pm-ov hidden" id="pm-ov">' +
    '    <div class="pm-ov-title" id="pm-ov-title"></div>' +
    '    <div class="pm-ov-body" id="pm-ov-body"></div>' +
    '    <div class="pm-ov-btns" id="pm-ov-btns"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="pm-top">' +
    '  <span>' + T('gs.mazedot.score') + ' <span id="pm-score">0</span></span>' +
    '  <span>' + T('gs.mazedot.levelLabel') + ' <span id="pm-level">1</span></span>' +
    '  <span>' + T('gs.mazedot.dots') + ' <span id="pm-dots">0</span></span>' +
    '  <span class="pm-lives">' + T('gs.mazedot.lives') + ' <span id="pm-lives">3</span></span>' +
    '  <span class="pm-fear">' + T('gs.mazedot.fear') + ' <span id="pm-fear">0</span>s</span>' +
    '</div>' +
    '<div class="pm-combo" id="pm-combo"></div>' +
    '<div class="pm-msg" id="pm-msg">' + T('gs.mazedot.help') + '</div>' +
    '<div id="pm-dpad"></div>' +
    '<div class="game-controls">' +
    '  <button id="pm-pause" class="btn green">' + T('gs.mazedot.pauseBtn') + '</button>' +
    '  <button id="pm-restart" class="btn purple">' + T('gs.mazedot.restart') + '</button>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#pm-canvas');
  var info = GK.setup(canvas, W, H);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = info.ctx;

  var scoreEl = wrap.querySelector('#pm-score');
  var levelEl = wrap.querySelector('#pm-level');
  var dotsEl = wrap.querySelector('#pm-dots');
  var livesEl = wrap.querySelector('#pm-lives');
  var fearEl = wrap.querySelector('#pm-fear');
  var comboEl = wrap.querySelector('#pm-combo');
  var msg = wrap.querySelector('#pm-msg');
  var restartBtn = wrap.querySelector('#pm-restart');
  var pauseBtn = wrap.querySelector('#pm-pause');
  var ov = wrap.querySelector('#pm-ov');
  var ovTitle = wrap.querySelector('#pm-ov-title');
  var ovBody = wrap.querySelector('#pm-ov-body');
  var ovBtns = wrap.querySelector('#pm-ov-btns');

  var grid, curMap, pac, ghosts, score, dotsLeft, dotsTotal, level, combo, fearLeft, lives;
  var fruits, sparks, floats, fruitStage;
  var state = 'ready'; // ready | play | pause | clear | dead | win
  var clock = 0;
  var shakeMag = 0, shakeT = 0, shakeDur = 1;

  /* ---------- 工具 ---------- */
  function setTxt(el, v) {
    if (!el) return;
    v = String(v);
    if (el.__v !== v) { el.__v = v; el.textContent = v; }
  }
  function neighbor(c, r, dir) {
    var d = DIRS[dir];
    return { c: c + d.x, r: r + d.y };
  }
  function canEnter(c, r, dir) {
    var n = neighbor(c, r, dir);
    return n.c >= 0 && n.r >= 0 && n.c < COLS && n.r < ROWS && grid[n.r][n.c] !== 1;
  }
  /** 出生点运行时校验：优先使用既定格；若那里是墙则扫描合法格 */
  function resolveSpawn(map, prefC, prefR) {
    if (map[prefR] && map[prefR][prefC] !== 1) return { c: prefC, r: prefR };
    var best = null, bestD = 1e9;
    for (var r = ROWS - 2; r >= 1; r--) {
      for (var c = 1; c < COLS - 1; c++) {
        if (map[r][c] === 1) continue;
        var d = Math.abs(c - (COLS - 1) / 2) + (ROWS - r) * 4;
        if (d < bestD) { bestD = d; best = { c: c, r: r }; }
      }
    }
    return best || { c: 1, r: 1 };
  }
  function entityPos(e) {
    var d = DIRS[e.dir];
    return {
      x: (e.cx + d.x * e.t + 0.5) * CELL,
      y: (e.cy + d.y * e.t + 0.5) * CELL
    };
  }
  function pacPos() { return entityPos(pac); }
  function distGrid(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }

  /* ---------- 关卡 ---------- */
  function buildLevel(isFirst) {
    curMap = MAPS[(level - 1) % MAPS.length];
    grid = [];
    dotsLeft = 0;
    for (var r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (var c = 0; c < COLS; c++) {
        grid[r][c] = curMap[r][c];
        if (curMap[r][c] === 2 || curMap[r][c] === 3) dotsLeft++;
      }
    }
    var sp = resolveSpawn(curMap, 7, 13);
    if (grid[sp.r][sp.c] === 2 || grid[sp.r][sp.c] === 3) { // 出生格豆子直接吃掉，避免刷分
      grid[sp.r][sp.c] = 0;
      dotsLeft--;
    }
    pac = { cx: sp.c, cy: sp.r, dir: 'left', t: 0, next: null, inv: 0 };
    if (!canEnter(pac.cx, pac.cy, pac.dir)) pac.dir = canEnter(pac.cx, pac.cy, 'right') ? 'right' : 'up';
    dotsTotal = dotsLeft;
    fruits = [];
    sparks = [];
    floats = [];
    fruitStage = 0;
    combo = 0;
    fearLeft = 0;
    makeGhosts();
    if (isFirst) score = 0;
    setTxt(levelEl, level);
    setTxt(dotsEl, dotsLeft);
    setTxt(comboEl, '');
    updateLives();
  }

  function makeGhosts() {
    ghosts = [];
    var count = 4 + (level >= 5 ? 1 : 0);
    var baseCps = Math.min(5.9 + level * 0.33, PAC_CPS - 0.55);
    for (var i = 0; i < count; i++) {
      var cfg = GHOST_TYPES[i % GHOST_TYPES.length];
      var home = GHOST_HOME[i % GHOST_HOME.length];
      var hs = resolveSpawn(curMap, home[0], home[1]);
      var g = {
        cx: hs.c, cy: hs.r, t: 0,
        dir: i === 0 ? 'up' : (i % 2 ? 'left' : 'right'),
        cps: Math.min(baseCps * cfg.speed, PAC_CPS - 0.3),
        type: cfg.type,
        color: cfg.color,
        phase: i * 1.27,
        scared: 0, state: 'normal', eatenT: 0
      };
      if (!canEnter(g.cx, g.cy, g.dir)) {
        g.dir = canEnter(g.cx, g.cy, 'up') ? 'up' : (canEnter(g.cx, g.cy, 'down') ? 'down' : 'left');
      }
      ghosts.push(g);
    }
  }

  /* ---------- 移动：格坐标 + 格内进度 ---------- */
  function pacAdvance(dt) {
    // 反向可在任意时刻生效（位置连续）
    if (pac.next && pac.next === OPP[pac.dir]) {
      if (pac.t > 0) {
        var nn = neighbor(pac.cx, pac.cy, pac.dir);
        if (grid[nn.r] && grid[nn.r][nn.c] !== 1) {
          pac.cx = nn.c; pac.cy = nn.r;
          pac.t = 1 - pac.t;
          pac.dir = pac.next;
          pac.next = null;
        }
      } else {
        pac.dir = pac.next;
        pac.next = null;
      }
    }
    var step = PAC_CPS * dt;
    var guard = 0;
    while (step > 0 && guard++ < 8) {
      if (!canEnter(pac.cx, pac.cy, pac.dir)) {
        if (pac.next && canEnter(pac.cx, pac.cy, pac.next)) {
          pac.dir = pac.next;
          pac.next = null;
        } else {
          pac.t = 0;
          break;
        }
      }
      var rem = 1 - pac.t;
      if (step < rem) { pac.t += step; step = 0; break; }
      step -= rem;
      var n = neighbor(pac.cx, pac.cy, pac.dir);
      pac.cx = n.c; pac.cy = n.r; pac.t = 0;
      eatAt(pac.cx, pac.cy);
      if (state !== 'play') return;
      if (pac.next && canEnter(pac.cx, pac.cy, pac.next)) {
        pac.dir = pac.next;
        pac.next = null;
      }
    }
  }

  function ghostTarget(g) {
    var d = DIRS[pac.dir];
    if (g.type === 'ambusher') return { c: pac.cx + d.x * 4, r: pac.cy + d.y * 4 };
    return { c: pac.cx, r: pac.cy };
  }

  function chooseGhostDir(g) {
    var opts = [];
    var order = ['up', 'left', 'down', 'right'];
    for (var i = 0; i < order.length; i++) {
      var d = order[i];
      if (d === OPP[g.dir]) continue;
      if (canEnter(g.cx, g.cy, d)) opts.push(d);
    }
    if (!opts.length) { // 死胡同：允许回头
      if (canEnter(g.cx, g.cy, OPP[g.dir])) opts.push(OPP[g.dir]);
      else return;
    }
    // 恐惧状态：完全随机逃跑
    if (g.scared > 0 || g.type === 'wanderer') {
      g.dir = opts[Math.floor(Math.random() * opts.length)];
      return;
    }
    var far = g.type === 'shy' && distGrid(g.cx, g.cy, pac.cx, pac.cy) < 6;
    var target = ghostTarget(g);
    var best = opts[0], bd = 1e9;
    for (var j = 0; j < opts.length; j++) {
      var n = neighbor(g.cx, g.cy, opts[j]);
      var dd = (n.c - target.c) * (n.c - target.c) + (n.r - target.r) * (n.r - target.r);
      if (far) dd = -dd; // 害羞者近距离逃跑：最大化距离
      if (dd < bd - 0.01) { bd = dd; best = opts[j]; }
      else if (Math.abs(dd - bd) < 0.01 && Math.random() < 0.5) best = opts[j];
    }
    g.dir = best;
  }

  function ghostAdvance(g, dt) {
    if (g.state === 'eaten') {
      g.eatenT += dt;
      if (g.eatenT >= EATEN_TIME) {
        var hs = resolveSpawn(curMap, HOUSE.c, HOUSE.r);
        g.cx = hs.c; g.cy = hs.r; g.t = 0;
        g.dir = canEnter(g.cx, g.cy, 'up') ? 'up' : 'down';
        g.state = 'normal'; g.scared = 0; g.eatenT = 0;
      }
      return;
    }
    if (g.scared > 0) {
      g.scared -= dt;
      if (g.scared <= 0) g.scared = 0;
    }
    var step = g.cps * (g.scared > 0 ? 0.58 : 1) * dt;
    var guard = 0;
    if (g.t === 0) chooseGhostDir(g);
    while (step > 0 && guard++ < 8) {
      if (!canEnter(g.cx, g.cy, g.dir)) {
        chooseGhostDir(g);
        if (!canEnter(g.cx, g.cy, g.dir)) break;
      }
      var rem = 1 - g.t;
      if (step < rem) { g.t += step; step = 0; break; }
      step -= rem;
      var n = neighbor(g.cx, g.cy, g.dir);
      g.cx = n.c; g.cy = n.r; g.t = 0;
      chooseGhostDir(g);
    }
  }

  /* ---------- 吃豆 / 水果 ---------- */
  function eatAt(c, r) {
    var v = grid[r][c];
    if (v !== 2 && v !== 3) return;
    grid[r][c] = 0;
    dotsLeft--;
    var px0 = (c + 0.5) * CELL, py0 = (r + 0.5) * CELL;
    if (v === 2) {
      score += 1;
      GK.burst(canvas, px0, py0, 'rgba(255,217,232,0.9)', 4);
      if (Arcade.audio) Arcade.audio.play('type');
    } else {
      score += 10;
      combo = 0;
      setTxt(comboEl, '');
      fearLeft = 6.0;
      for (var i = 0; i < ghosts.length; i++) if (ghosts[i].state === 'normal') ghosts[i].scared = 6.0;
      GK.burst(canvas, px0, py0, '#ffe600', 16);
      spark(px0, py0, '#ffe600', 12, 80);
      if (Arcade.audio) Arcade.audio.play('clear');
      msg.textContent = T('gs.mazedot.powerUp');
      msg.style.color = 'var(--neon-yellow)';
    }
    setTxt(scoreEl, score);
    setTxt(dotsEl, dotsLeft);
    maybeSpawnFruit();
    if (dotsLeft <= 0 && state === 'play') levelCleared();
  }

  function maybeSpawnFruit() {
    if (!dotsTotal) return;
    var frac = (dotsTotal - dotsLeft) / dotsTotal;
    if (fruitStage === 0 && frac >= 0.30) { spawnFruit(false); fruitStage = 1; }
    else if (fruitStage === 1 && frac >= 0.60) { spawnFruit(true); fruitStage = 2; }
  }

  function spawnFruit(big) {
    var spots = [];
    for (var i = 0; i < FRUIT_SPOTS.length; i++) {
      var c = FRUIT_SPOTS[i][0], r = FRUIT_SPOTS[i][1];
      if (curMap[r][c] === 1) continue;
      if (pac && pac.cx === c && pac.cy === r) continue;
      var taken = false;
      for (var j = 0; j < fruits.length; j++) {
        if (fruits[j].c === c && fruits[j].r === r) taken = true;
      }
      if (!taken) spots.push({ c: c, r: r });
    }
    var pick = spots.length ? GK.choice(spots) : { c: HOUSE.c, r: HOUSE.r };
    var type = big ? 'orange' : ((level % 2) ? 'strawberry' : 'cherry');
    fruits.push({
      c: pick.c, r: pick.r, type: type, big: !!big,
      value: big ? 300 : 100, life: 8, age: 0
    });
    msg.textContent = T(big ? 'gs.mazedot.fruitBigSpawn' : 'gs.mazedot.fruitSpawn');
    msg.style.color = 'var(--neon-yellow)';
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function updateFruits(dt) {
    var p = pacPos();
    for (var i = fruits.length - 1; i >= 0; i--) {
      var f = fruits[i];
      f.age += dt;
      var fx = (f.c + 0.5) * CELL, fy = (f.r + 0.5) * CELL;
      if (Math.abs(fx - p.x) < 19 && Math.abs(fy - p.y) < 19) {
        collectFruit(f, fx, fy);
        fruits.splice(i, 1);
        continue;
      }
      if (f.age >= f.life) {
        spark(fx, fy, '#a9e7ff', 6, 40);
        fruits.splice(i, 1);
      }
    }
  }

  function collectFruit(f, fx, fy) {
    score += f.value;
    setTxt(scoreEl, score);
    var color = f.big ? '#ffb347' : '#ff5f7e';
    addFloat(fx, fy - 12, '+' + f.value, color, f.big);
    spark(fx, fy, color, f.big ? 22 : 12, f.big ? 130 : 80);
    GK.burst(canvas, fx, fy, color, f.big ? 20 : 10);
    if (Arcade.audio) Arcade.audio.play(f.big ? 'record' : 'coin');
    if (f.big) {
      Arcade.fx.flash('var(--neon-yellow)');
      bump(5, 0.25);
    }
    msg.textContent = T(f.big ? 'gs.mazedot.fruitBigGain' : 'gs.mazedot.fruitGain').replace('{n}', f.value);
    msg.style.color = 'var(--neon-yellow)';
  }

  function addFloat(x, y, text, color, big) {
    floats.push({ x: x, y: y, text: text, color: color, life: 1.1, big: !!big });
  }
  function spark(x, y, color, count, power) {
    if (Arcade.settings && Arcade.settings.get().reducedMotion) return;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * PI2;
      var sp = power * (0.35 + Math.random() * 0.85);
      sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        color: color,
        size: 1.4 + Math.random() * 2.4
      });
    }
  }
  function bump(mag, dur) {
    if (Arcade.settings && Arcade.settings.get().reducedMotion) return;
    shakeMag = mag;
    shakeT = dur;
    shakeDur = dur;
  }
  function updateEffects(dt) {
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.life -= dt * 1.9;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 70 * dt;
    }
    for (var j = floats.length - 1; j >= 0; j--) {
      var f = floats[j];
      f.life -= dt * 1.05;
      f.y -= 24 * dt;
      if (f.life <= 0) floats.splice(j, 1);
    }
  }

  /* ---------- 交互 / 状态 ---------- */
  function move(dir) {
    if (state !== 'play') return;
    pac.next = dir;
  }
  function handleAction() {
    if (state === 'ready') { newGame(); return; }
    if (state === 'clear') { nextLevel(); return; }
    if (state === 'dead' || state === 'win') { newGame(); return; }
    togglePause();
  }

  function togglePause(force) {
    var toPause = (typeof force === 'boolean') ? force : (state === 'play');
    if (toPause && state === 'play') {
      state = 'pause';
      syncPauseBtn();
      openOverlay(T('gs.mazedot.pauseT'), T('gs.mazedot.pauseD'), [
        { label: T('gs.mazedot.resumeBtn'), cls: 'green', action: function () { togglePause(false); } }
      ]);
      if (Arcade.audio) Arcade.audio.play('ui');
    } else if (!toPause && state === 'pause') {
      state = 'play';
      closeOverlay();
      syncPauseBtn();
      if (Arcade.audio) Arcade.audio.play('ui');
    }
  }

  function syncPauseBtn() {
    pauseBtn.textContent = (state === 'pause')
      ? T('gs.mazedot.resumeBtn')
      : T('gs.mazedot.pauseBtn');
  }

  function openOverlay(title, bodyHtml, buttons) {
    ovTitle.textContent = title;
    ovBody.innerHTML = bodyHtml;
    ovBtns.innerHTML = '';
    buttons.forEach(function (b) {
      if (b.href) {
        var a = document.createElement('a');
        a.className = 'btn ' + (b.cls || '');
        a.href = b.href;
        a.textContent = b.label;
        ovBtns.appendChild(a);
      } else {
        var btn = document.createElement('button');
        btn.className = 'btn ' + (b.cls || '');
        btn.textContent = b.label;
        btn.addEventListener('click', b.action);
        ovBtns.appendChild(btn);
      }
    });
    ov.classList.remove('hidden');
  }
  function closeOverlay() { ov.classList.add('hidden'); }

  function bestValue() {
    var b = Arcade.storage ? Arcade.storage.getBest('mazedot') : null;
    return b === null ? '—' : String(b);
  }

  function updateLives() { setTxt(livesEl, lives); }

  function levelCleared() {
    if (level >= 5) { gameWin(); return; }
    state = 'clear';
    syncPauseBtn();
    Arcade.juice.win();
    Arcade.fx.flash('var(--neon-green)');
    msg.textContent = T('gs.mazedot.levelClear').replace('{n}', level);
    openOverlay(
      T('gs.mazedot.levelClearT').replace('{n}', level),
      T('gs.mazedot.levelClearD').replace('{s}', score),
      [
        { label: T('gs.mazedot.nextLevel'), cls: 'green', action: nextLevel },
        { label: T('gs.mazedot.toLobby'), href: '../../index.html' }
      ]
    );
  }

  function nextLevel() {
    level++;
    closeOverlay();
    state = 'play';
    buildLevel(false);
    syncPauseBtn();
    msg.textContent = T('gs.mazedot.levelUp').replace('{n}', level) + (level >= 5 ? T('gs.mazedot.mirrorGhost') : '');
    msg.style.color = 'var(--neon-yellow)';
    setTxt(levelEl, level);
    setTxt(scoreEl, score);
    setTxt(fearEl, 0);
    if (Arcade.audio) Arcade.audio.play('clear');
  }

  function gameWin() {
    state = 'win';
    syncPauseBtn();
    score += 100;
    setTxt(scoreEl, score);
    Arcade.juice.win();
    var isNew = Arcade.shell.submitScore(score);
    openOverlay(
      T('gs.mazedot.winT'),
      T('gs.mazedot.winD').replace('{s}', score) +
        '<div class="pm-ov-note">' + T('gs.mazedot.resultLine').replace('{s}', score).replace('{l}', level).replace('{b}', bestValue()) + (isNew ? ' · ' + T('gs.mazedot.newRecord') : '') + '</div>',
      [
        { label: T('gs.mazedot.again'), cls: 'green', action: newGame },
        { label: T('gs.mazedot.toLobby'), href: '../../index.html' }
      ]
    );
    msg.textContent = T('gs.mazedot.win').replace('{n}', score);
    msg.style.color = 'var(--neon-green)';
  }

  function gameOver() {
    state = 'dead';
    syncPauseBtn();
    Arcade.juice.lose();
    var pp = pacPos();
    GK.burst(canvas, pp.x, pp.y, '#ff2d95', 24);
    spark(pp.x, pp.y, '#ff2d95', 20, 120);
    bump(9, 0.45);
    var isNew = Arcade.shell.submitScore(score);
    openOverlay(
      T('gs.mazedot.deadT'),
      T('gs.mazedot.deadD').replace('{s}', score) +
        '<div class="pm-ov-note">' + T('gs.mazedot.resultLine').replace('{s}', score).replace('{l}', level).replace('{b}', bestValue()) + (isNew ? ' · ' + T('gs.mazedot.newRecord') : '') + '</div>',
      [
        { label: T('gs.mazedot.restart'), cls: 'green', action: newGame },
        { label: T('gs.mazedot.toLobby'), href: '../../index.html' }
      ]
    );
    msg.textContent = T('gs.mazedot.dead').replace('{n}', score);
    msg.style.color = 'var(--neon-pink)';
  }

  function newGame() {
    level = 1;
    score = 0;
    lives = 3;
    state = 'play';
    closeOverlay();
    buildLevel(true);
    syncPauseBtn();
    msg.textContent = T('gs.mazedot.help');
    msg.style.color = '';
    setTxt(scoreEl, score);
    setTxt(levelEl, level);
    setTxt(fearEl, 0);
    setTxt(comboEl, '');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function pacCaught() {
    lives--;
    updateLives();
    var pp = pacPos();
    GK.burst(canvas, pp.x, pp.y, '#ff2d95', 20);
    spark(pp.x, pp.y, '#ff2d95', 16, 110);
    bump(8, 0.4);
    Arcade.fx.flash('var(--neon-pink)');
    if (Arcade.audio) Arcade.audio.play('error');
    combo = 0;
    setTxt(comboEl, '');
    fearLeft = 0;
    setTxt(fearEl, 0);
    if (lives <= 0) { gameOver(); return; }
    // 幽灵回巢重置，吃豆进度保留
    makeGhosts();
    pac.inv = 1.2;
    pac.next = null;
    msg.textContent = T('gs.mazedot.caught').replace('{n}', lives);
    msg.style.color = 'var(--neon-pink)';
    setTxt(scoreEl, score);
  }

  function eatGhost(g, gp) {
    var pts = Math.min(400, 50 * Math.pow(2, Math.min(combo, 3)));
    score += pts;
    combo++;
    g.state = 'eaten';
    g.eatenT = 0;
    g.scared = 0;
    GK.burst(canvas, gp.x, gp.y, '#00f0ff', 14);
    spark(gp.x, gp.y, '#00f0ff', 14, 90);
    addFloat(gp.x, gp.y - 10, '+' + pts, '#00f0ff', true);
    bump(3, 0.18);
    if (Arcade.audio) Arcade.audio.play('coin');
    msg.textContent = T('gs.mazedot.ghostEat').replace('{n}', pts) +
      (combo > 1 ? T('gs.mazedot.combo').replace('{n}', combo) : '');
    msg.style.color = 'var(--neon-cyan)';
    setTxt(scoreEl, score);
    setTxt(comboEl, combo > 1 ? T('gs.mazedot.comboLine').replace('{n}', combo) : '');
  }

  /* ---------- 每帧逻辑 ---------- */
  function update(nSteps) {
    var dt = 0.016 * (nSteps || 1);
    clock += 16 * (nSteps || 1);
    updateEffects(dt);
    if (state !== 'play') return;

    if (pac.inv > 0) pac.inv = Math.max(0, pac.inv - dt);
    pacAdvance(dt);
    if (state !== 'play') return;

    if (fearLeft > 0) fearLeft = Math.max(0, fearLeft - dt);
    var maxScared = 0;
    for (var i = 0; i < ghosts.length; i++) {
      ghostAdvance(ghosts[i], dt);
      if (ghosts[i].scared > maxScared) maxScared = ghosts[i].scared;
    }

    var caught = false;
    var p = pacPos();
    for (var k = 0; k < ghosts.length; k++) {
      var g = ghosts[k];
      if (g.state !== 'normal') continue;
      var gp = entityPos(g);
      if (Math.abs(gp.x - p.x) < 19 && Math.abs(gp.y - p.y) < 19) {
        if (g.scared > 0) eatGhost(g, gp);
        else if (pac.inv <= 0) caught = true;
      }
    }

    updateFruits(dt);
    setTxt(fearEl, Math.ceil(Math.max(maxScared, fearLeft)));
    if (caught) pacCaught();
  }

  /* ---------- 渲染 ---------- */
  var THUMB = null;
  function render() {
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, 'rgba(20,30,80,0.35)');
    bg.addColorStop(0.55, 'rgba(6,8,24,0.2)');
    bg.addColorStop(1, 'rgba(60,20,80,0.25)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var shx = 0, shy = 0;
    if (shakeT > 0) {
      var k = shakeT / shakeDur;
      shx = (Math.random() - 0.5) * 2 * shakeMag * k;
      shy = (Math.random() - 0.5) * 2 * shakeMag * k;
    }
    ctx.save();
    ctx.translate(shx, shy);

    // 迷宫墙体
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (grid[r][c] === 1) drawWall(c, r);
      }
    }
    // 迷宫外框辉光
    ctx.save();
    ctx.strokeStyle = 'rgba(0,180,255,0.55)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00b4ff';
    ctx.shadowBlur = 10;
    GK.roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 10);
    ctx.stroke();
    ctx.restore();

    drawHouse();

    // 豆子
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var c2 = 0; c2 < COLS; c2++) {
        var v = grid[r2][c2];
        if (v === 2) {
          ctx.fillStyle = '#ffd9e8';
          ctx.beginPath();
          ctx.arc((c2 + 0.5) * CELL, (r2 + 0.5) * CELL, 3.2, 0, PI2);
          ctx.fill();
        } else if (v === 3) {
          var pu = 1 + Math.sin(clock / 160) * 0.22;
          ctx.save();
          ctx.shadowColor = '#ffe600';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#ffe600';
          ctx.beginPath();
          ctx.arc((c2 + 0.5) * CELL, (r2 + 0.5) * CELL, 7.5 * pu, 0, PI2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#fff6c4';
          ctx.beginPath();
          ctx.arc((c2 + 0.5) * CELL, (r2 + 0.5) * CELL, 3 * pu, 0, PI2);
          ctx.fill();
        }
      }
    }

    // 限时水果
    for (var fi = 0; fi < fruits.length; fi++) drawFruit(fruits[fi]);

    // 幽灵
    for (var gi = 0; gi < ghosts.length; gi++) drawGhost(ghosts[gi]);

    // 玩家
    if (state !== 'dead') drawPac();

    // 画布粒子
    for (var si = 0; si < sparks.length; si++) {
      var s = sparks[si];
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.life);
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, PI2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 飘分（不随屏震抖动，保证可读）
    for (var ti = 0; ti < floats.length; ti++) drawFloat(floats[ti]);

    // 暗角
    if (!THUMB) {
      THUMB = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
      THUMB.addColorStop(0, 'rgba(0,0,0,0)');
      THUMB.addColorStop(1, 'rgba(0,0,10,0.7)');
    }
    ctx.fillStyle = THUMB;
    ctx.fillRect(0, 0, W, H);
  }

  function drawWall(c, r) {
    var x = c * CELL, y = r * CELL;
    ctx.fillStyle = '#12204a';
    GK.roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,140,255,0.55)';
    ctx.lineWidth = 1.5;
    GK.roundRect(ctx, x + 2.5, y + 2.5, CELL - 5, CELL - 5, 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,200,255,0.10)';
    GK.roundRect(ctx, x + 6, y + 6, CELL - 12, (CELL - 12) * 0.4, 5);
    ctx.fill();
  }

  function drawHouse() {
    var x = (HOUSE.c + 0.5) * CELL, y = (HOUSE.r + 0.5) * CELL;
    var gl = ctx.createRadialGradient(x, y, 2, x, y, CELL * 1.5);
    gl.addColorStop(0, 'rgba(0,120,255,0.20)');
    gl.addColorStop(1, 'rgba(0,120,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(x, y, CELL * 1.5, 0, PI2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,190,255,0.28)';
    ctx.lineWidth = 1.4;
    GK.roundRect(ctx, x - CELL * 0.9, y - CELL * 0.9, CELL * 1.8, CELL * 1.8, 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - CELL * 0.3, y - CELL * 0.9);
    ctx.lineTo(x - CELL * 0.3, y - CELL * 0.45);
    ctx.stroke();
  }

  function drawFloat(f) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    ctx.font = (f.big ? 'bold 14px ' : 'bold 12px ') + 'monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  /* ---------- 水果手绘 ---------- */
  function drawFruit(f) {
    var cx = (f.c + 0.5) * CELL;
    var cy = (f.r + 0.5) * CELL + Math.sin(clock / 130 + f.r) * 1.5;
    var k = Math.min(1, f.age / 0.35);
    var pop = k < 1 ? GK.easeOutBack(k) : 1;
    var remain = Math.max(0, 1 - f.age / f.life);
    var alpha = f.age > f.life - 1.2 ? Math.max(0, (f.life - f.age) / 1.2) : 1;
    var base = f.big ? 1.15 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    // 计时环
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14.5, 0, PI2);
    ctx.stroke();
    ctx.strokeStyle = f.big ? '#ffb347' : '#ff5f7e';
    ctx.beginPath();
    ctx.arc(0, 0, 14.5, -Math.PI / 2, -Math.PI / 2 + PI2 * remain);
    ctx.stroke();
    ctx.scale(base * pop, base * pop);
    drawFruitArt(f.type);
    ctx.restore();
  }

  function drawFruitArt(type) {
    if (type === 'cherry') {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#7ef29a';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-1, -1); ctx.quadraticCurveTo(-5, -9, -8, -13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1, -1); ctx.quadraticCurveTo(5, -8, 8, -12); ctx.stroke();
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.moveTo(8, -12);
      ctx.quadraticCurveTo(13, -13, 13, -8);
      ctx.quadraticCurveTo(10, -9, 8, -12);
      ctx.closePath();
      ctx.fill();
      cherryBall(-5, 4, 5.2);
      cherryBall(5, 6, 4.6);
    } else if (type === 'strawberry') {
      var sg = ctx.createRadialGradient(-2, -2, 1, 0, 2, 11);
      sg.addColorStop(0, '#ffb3c1');
      sg.addColorStop(0.5, '#ff2d55');
      sg.addColorStop(1, '#9c0027');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(0, 11);
      ctx.bezierCurveTo(-9.5, 6, -8.5, -3, 0, -7);
      ctx.bezierCurveTo(8.5, -3, 9.5, 6, 0, 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#39ff14';
      for (var li = -1; li <= 1; li++) {
        ctx.beginPath();
        ctx.moveTo(li * 3.4, -6);
        ctx.lineTo(li * 5.6, -11);
        ctx.lineTo(li * 1.6, -7.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffe8a3';
      var seeds = [[-4, 1], [4, 1], [0, 4], [-3, 6], [3, 6]];
      for (var si = 0; si < seeds.length; si++) {
        ctx.beginPath();
        ctx.arc(seeds[si][0], seeds[si][1], 0.9, 0, PI2);
        ctx.fill();
      }
    } else {
      var og = ctx.createRadialGradient(-3, -4, 1, 0, 0, 10);
      og.addColorStop(0, '#ffe7a3');
      og.addColorStop(0.45, '#ffb347');
      og.addColorStop(1, '#c25a00');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(0, 1, 8.8, 0, PI2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,200,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 1, 6.2, -0.9, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 1, 6.2, 1.1, 2.5);
      ctx.stroke();
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.moveTo(-1, -7.4);
      ctx.quadraticCurveTo(-6, -9, -6, -12);
      ctx.quadraticCurveTo(-1, -11, 0, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7a5a20';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0.8, -11); ctx.stroke();
    }
  }

  function cherryBall(x, y, r) {
    var g = ctx.createRadialGradient(x - 2, y - 2, 0.4, x, y, r);
    g.addColorStop(0, '#ffb3c2');
    g.addColorStop(0.5, '#ff2d55');
    g.addColorStop(1, '#8e0024');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.24, 0, PI2);
    ctx.fill();
  }

  /* ---------- 幽灵手绘：4 种人格外形/眼睛 ---------- */
  function ghostBodyPath(R, wob) {
    ctx.beginPath();
    ctx.arc(0, -2, R, Math.PI, 0);
    ctx.lineTo(R, R * 0.72);
    var seg = (R * 2) / 3;
    for (var i = 2; i >= 0; i--) {
      var x0 = -R + seg * i;
      ctx.quadraticCurveTo(x0 + seg * 0.5, R * 0.72 + (i % 2 ? -2.4 : 2.4) + wob, x0, R * 0.72);
    }
    ctx.closePath();
  }

  function ghostLook(g, gp) {
    var p = pacPos();
    var dx = p.x - gp.x, dy = p.y - gp.y;
    if (g.type === 'wanderer') {
      return { x: Math.sin(clock / 230 + g.phase) * 0.9, y: Math.cos(clock / 170 + g.phase) * 0.7 };
    }
    if (g.type === 'shy' && distGrid(g.cx, g.cy, pac.cx, pac.cy) < 6) {
      dx = -dx; dy = -dy;
    }
    if (g.type === 'ambusher') {
      var d = DIRS[pac.dir];
      dx += d.x * CELL * 4;
      dy += d.y * CELL * 4;
    }
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  function drawGhost(g) {
    var gp = entityPos(g);
    var R = 11;
    if (g.state === 'eaten') {
      var k = Math.min(1, g.eatenT / EATEN_TIME);
      var t = GK.easeOutCubic(k);
      var hx = (HOUSE.c + 0.5) * CELL, hy = (HOUSE.r + 0.5) * CELL;
      var ex = gp.x + (hx - gp.x) * t;
      var ey = gp.y + (hy - gp.y) * t;
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.35;
      ctx.shadowColor = '#bff6ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(225,250,255,0.95)';
      ctx.beginPath(); ctx.arc(ex - 4, ey - 1, 3.3, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 4, ey - 1, 3.3, 0, PI2); ctx.fill();
      ctx.fillStyle = '#0a0a12';
      ctx.beginPath(); ctx.arc(ex - 4, ey - 1, 1.5, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 4, ey - 1, 1.5, 0, PI2); ctx.fill();
      ctx.restore();
      return;
    }
    var scared = g.scared > 0;
    var blinkFast = scared && g.scared < 2.2;
    var flash = scared && (Math.floor(clock / (blinkFast ? 90 : 170)) % 2 === 0);
    var body = scared ? (flash ? '#eaf6ff' : '#3a63ff') : g.color;
    var wob = Math.sin(clock / 120 + g.phase) * 1.2;
    var look = ghostLook(g, gp);

    ctx.save();
    ctx.translate(gp.x, gp.y);
    ctx.shadowColor = scared ? '#88aaff' : g.color;
    ctx.shadowBlur = 12;
    var grad = ctx.createRadialGradient(-3, -5, 1, 0, 0, R + 3);
    grad.addColorStop(0, scared ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)');
    grad.addColorStop(0.45, body);
    grad.addColorStop(1, body);
    ctx.fillStyle = grad;
    ghostBodyPath(R, wob);
    ctx.fill();

    if (!scared) {
      // 人格冠饰（纯 Canvas 图形）
      if (g.type === 'chaser') {
        ctx.fillStyle = g.color;
        ctx.beginPath(); ctx.moveTo(-6, -R + 1); ctx.lineTo(-9, -R - 5); ctx.lineTo(-2.4, -R + 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6, -R + 1); ctx.lineTo(9, -R - 5); ctx.lineTo(2.4, -R + 1); ctx.closePath(); ctx.fill();
      } else if (g.type === 'ambusher') {
        ctx.strokeStyle = '#dffcff';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, -R - 1); ctx.lineTo(0, -R - 7); ctx.stroke();
        ctx.fillStyle = '#dffcff';
        ctx.beginPath(); ctx.arc(0, -R - 8, 2.1, 0, PI2); ctx.fill();
      } else if (g.type === 'wanderer') {
        ctx.strokeStyle = '#ffe0b0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -R - 1);
        ctx.quadraticCurveTo(4, -R - 5, 1, -R - 8);
        ctx.stroke();
        ctx.fillStyle = '#ffe0b0';
        ctx.beginPath(); ctx.arc(1, -R - 9, 2, 0, PI2); ctx.fill();
      } else if (g.type === 'shy') {
        ctx.fillStyle = '#ff9ec7';
        ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(-6, -R - 5); ctx.lineTo(-6, -R + 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(6, -R - 5); ctx.lineTo(6, -R + 1); ctx.closePath(); ctx.fill();
      }
    }

    if (scared) {
      ctx.fillStyle = '#0a0a12';
      ctx.beginPath(); ctx.arc(-4, -2, 1.8, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -2, 1.8, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#0a0a12';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-5, 4.5);
      for (var k2 = 0; k2 < 4; k2++) ctx.lineTo(-3.5 + k2 * 2.2, 4.5 + (k2 % 2 ? -1.4 : 1.4));
      ctx.stroke();
    } else if (g.type === 'chaser') {
      // 锐利窄眼 + 怒眉
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      for (var e1 = -1; e1 <= 1; e1 += 2) {
        ctx.save();
        ctx.translate(e1 * 4, -2);
        ctx.scale(1, 0.66);
        ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, PI2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#3a0012';
      ctx.beginPath(); ctx.arc(-4 + look.x * 1.5, -2 + look.y * 1.5, 1.6, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(4 + look.x * 1.5, -2 + look.y * 1.5, 1.6, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#3a0012';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-2, -4.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, -7); ctx.lineTo(2, -4.6); ctx.stroke();
    } else if (g.type === 'ambusher') {
      // 瞄准镜面罩
      ctx.fillStyle = 'rgba(0,240,255,0.26)';
      GK.roundRect(ctx, -8, -6.2, 16, 7.4, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,255,255,0.7)';
      ctx.lineWidth = 1;
      GK.roundRect(ctx, -8, -6.2, 16, 7.4, 3);
      ctx.stroke();
      ctx.fillStyle = '#eaffff';
      ctx.beginPath(); ctx.arc(-3.6 + look.x * 1.2, -2.4 + look.y * 1.2, 1.5, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.6 + look.x * 1.2, -2.4 + look.y * 1.2, 1.5, 0, PI2); ctx.fill();
    } else if (g.type === 'wanderer') {
      // 半睁睡眼
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.beginPath(); ctx.arc(-4, -2, 3.3, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -2, 3.3, 0, PI2); ctx.fill();
      ctx.fillStyle = g.color;
      ctx.fillRect(-8, -5.4, 16, 3.3);
      ctx.fillStyle = '#2a1400';
      ctx.beginPath(); ctx.arc(-4 + look.x * 1.1, -1.2, 1.4, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(4 + look.x * 1.1, -1.2, 1.4, 0, PI2); ctx.fill();
    } else if (g.type === 'shy') {
      // 大眼 + 腮红 + 小嘴
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.beginPath(); ctx.arc(-4.2, -2.2, 4.1, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(4.2, -2.2, 4.1, 0, PI2); ctx.fill();
      ctx.fillStyle = '#0a0a12';
      ctx.beginPath(); ctx.arc(-4.2 + look.x * 1.7, -2.2 + look.y * 1.7, 1.9, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(4.2 + look.x * 1.7, -2.2 + look.y * 1.7, 1.9, 0, PI2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-5.2 + look.x * 1.7, -3.1 + look.y * 1.7, 0.6, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.2 + look.x * 1.7, -3.1 + look.y * 1.7, 0.6, 0, PI2); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,170,0.5)';
      ctx.beginPath(); ctx.arc(-7.2, 4.2, 2, 0, PI2); ctx.fill();
      ctx.beginPath(); ctx.arc(7.2, 4.2, 2, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#123400';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 4.4, 1.9, 0.25, Math.PI - 0.25); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 玩家 ---------- */
  function drawPac() {
    var p = pacPos();
    var d = DIRS[pac.dir];
    var ang = Math.atan2(d.y, d.x);
    var mouth = 0.10 + Math.abs(Math.sin(clock / 85)) * 0.38;
    if (state === 'pause' || state === 'clear') mouth = 0.42;
    var inv = pac.inv > 0;
    ctx.save();
    if (inv && Math.floor(clock / 90) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16;
    var g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 13);
    g.addColorStop(0, '#e8ffff');
    g.addColorStop(0.45, '#00f0ff');
    g.addColorStop(1, '#0072a0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 12, mouth, PI2 - mouth);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 眼睛（世界坐标，避免跟着嘴旋转）
    ctx.save();
    if (inv && Math.floor(clock / 90) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#031018';
    var ox = -d.y * 3.6, oy = d.x * 3.6;
    ctx.beginPath(); ctx.arc(p.x + ox + d.x * 2, p.y + oy - 2 + d.y * 2, 1.7, 0, PI2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x - ox + d.x * 2, p.y - oy - 2 + d.y * 2, 1.7, 0, PI2); ctx.fill();
    ctx.restore();

    // 光尾
    ctx.fillStyle = 'rgba(0,240,255,0.18)';
    ctx.beginPath(); ctx.arc(p.x - d.x * 9, p.y - d.y * 9, 5, 0, PI2); ctx.fill();

    // 无敌护盾
    if (inv) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,240,255,' + (0.35 + 0.3 * Math.abs(Math.sin(clock / 120))) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 15.5, 0, PI2); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- 控制 ---------- */
  Arcade.input.onKeys({
    left: function () { move('left'); },
    right: function () { move('right'); },
    up: function () { move('up'); },
    down: function () { move('down'); },
    action: handleAction
  });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyP') { e.preventDefault(); togglePause(); }
  });
  Arcade.input.onSwipe(canvas, move);
  if (Arcade.input.isTouch()) {
    var dpad = Arcade.input.createDPad(wrap.querySelector('#pm-dpad'), function (dir, pressed) { if (pressed) move(dir); });
    dpad.className += ' pm-dpad';
  }

  pauseBtn.addEventListener('click', function () { togglePause(); });
  restartBtn.addEventListener('click', function () { newGame(); });

  window.GAME_RESTART = newGame;

  /* ---------- 首屏 ---------- */
  level = 1;
  score = 0;
  lives = 3;
  state = 'ready';
  buildLevel(true);
  openOverlay(T('gs.mazedot.startT'), T('gs.mazedot.startD'), [
    { label: T('gs.mazedot.startBtn'), cls: 'green', action: newGame }
  ]);
  syncPauseBtn();
  setTxt(scoreEl, 0);
  setTxt(levelEl, 1);
  setTxt(dotsEl, dotsLeft);
  setTxt(fearEl, 0);

  Arcade.loop.start(update, render, 16);

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.mazedot.helpText');
  root.appendChild(hd);
})();
