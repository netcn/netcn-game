/* ============================================================
   俄罗斯方块 · 旗舰版
   · 7-bag 随机（可复现种子）+ 5 段 NEXT + HOLD
   · 500ms 锁定延迟（移动/旋转可重置，最多 15 次）
   · DAS 170ms / ARR 33ms / 软降长按 / 硬降
   · 单/双/三/四消 + COMBO + B2B + T-Spin
   · 经典无尽 / VS AI（垃圾行对战）/ 8 关战役
   · 自绘霓虹方块、消行粒子、屏震、Ghost
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  var QA = /[?&]qa=1/.test(location.search);

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.blocks.tut1t'), d: T('gs.blocks.tut1') },
    { t: T('gs.blocks.tut2t'), d: T('gs.blocks.tut2') },
    { t: T('gs.blocks.tut3t'), d: T('gs.blocks.tut3') }
  ];

  var COLS = 10, ROWS = 20, CELL = 20;
  var BW = COLS * CELL, BH = ROWS * CELL;
  var CELL_VS = 8, VSW = COLS * CELL_VS, VSH = ROWS * CELL_VS;
  var NEXTW = 58, NEXT_H_ITEM = 46;

  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    T: [[0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    S: [[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    Z: [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    L: [[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
  };
  var COLORS = {
    I: '#00f0ff', O: '#ffe600', T: '#b967ff', S: '#39ff14',
    Z: '#ff2d95', J: '#2d7dff', L: '#ff9f1c', X: '#5a6072'
  };
  var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  var LINE_SCORE = [0, 100, 300, 500, 800];
  var GARBAGE_OUT = [0, 1, 3, 5, 8];
  var LOCK_MS = 500, MAX_LOCK_RESETS = 15;
  var DAS_MS = 170, ARR_MS = 33, SOFT_MS = 30;
  var STEP_MS = 16;

  var CAMPAIGN = [
    { obj: 'lines', target: 10, time: 120 },
    { obj: 'lines', target: 40, time: 110 },
    { obj: 'pieces', target: 8, limit: 24, time: 180 },
    { obj: 'survive', seconds: 60, waveEvery: 5000, waveRows: 1 },
    { obj: 'score', target: 6000, time: 180 },
    { obj: 'tspin', target: 2, time: 150 },
    { obj: 'survive', seconds: 90, waveEvery: 4200, waveRows: 2, minLines: 10 },
    { obj: 'lines', target: 30, time: 150 }
  ];

  var LS_VS_BEST = 'blocks_vs_best';
  var LS_CAMPAIGN_BEST = 'blocks_campaign_best';
  var LS_CAMPAIGN_UNLOCK = 'blocks_campaign_unlock';
  var LS_CAMPAIGN_LEVEL_BEST = 'blocks_campaign_level';

  root.innerHTML =
    '<div class="blocks-wrap" id="wrap">' +
    '  <div class="blocks-tabs" id="tabs">' +
    '    <button class="blocks-tab active" data-mode="endless">' + T('gs.blocks.modeClassic') + '</button>' +
    '    <button class="blocks-tab" data-mode="vs">' + T('gs.blocks.modeVs') + '</button>' +
    '    <button class="blocks-tab" data-mode="campaign">' + T('gs.blocks.modeCampaign') + '</button>' +
    '  </div>' +
    '  <div class="blocks-hud">' +
    '    <span>' + T('gs.blocks.score') + ' <b id="score">0</b></span>' +
    '    <span>' + T('gs.blocks.level') + ' <b id="level">1</b></span>' +
    '    <span>' + T('gs.blocks.lines') + ' <b id="lines">0</b></span>' +
    '  </div>' +
    '  <div class="blocks-obj" id="objective"></div>' +
    '  <div class="blocks-layout" id="layout">' +
    '    <div class="blocks-stage">' +
    '      <canvas id="board" class="blocks-board" aria-label="俄罗斯方块棋盘"></canvas>' +
    '    </div>' +
    '    <div class="blocks-vs" id="vs-panel">' +
    '      <div class="blocks-vs-label">' + T('gs.blocks.vsOpponent') + '</div>' +
    '      <canvas id="vs-board" width="80" height="160"></canvas>' +
    '      <div class="blocks-ai-lines" id="ai-lines">--</div>' +
    '    </div>' +
    '    <div class="blocks-side">' +
    '      <div class="blocks-next-label">HOLD</div>' +
    '      <canvas id="hold" width="58" height="58"></canvas>' +
    '      <div class="blocks-next-label">NEXT</div>' +
    '      <canvas id="next" width="58" height="250"></canvas>' +
    '    </div>' +
    '  </div>' +
    '  <div class="blocks-quick">' +
    '    <button class="btn" id="pause-btn">' + T('gs.blocks.pause') + '</button>' +
    '    <button class="btn purple" id="restart-btn">' + T('gs.blocks.restart') + '</button>' +
    '  </div>' +
    '  <div class="blocks-touch" id="touch-controls">' +
    '    <button class="btn" data-act="left" aria-label="' + T('gs.blocks.ariaLeft') + '">← ' + T('gs.blocks.ariaLeft') + '</button>' +
    '    <button class="btn" data-act="right" aria-label="' + T('gs.blocks.ariaRight') + '">' + T('gs.blocks.ariaRight') + ' →</button>' +
    '    <button class="btn" data-act="down" aria-label="' + T('gs.blocks.ariaSoftDrop') + '">↓ ' + T('gs.blocks.ariaSoftDrop') + '</button>' +
    '    <button class="btn purple" data-act="rotate" aria-label="' + T('gs.blocks.ariaRotate') + '">⟳ ' + T('gs.blocks.ariaRotate') + '</button>' +
    '    <button class="btn yellow" data-act="drop" aria-label="' + T('gs.blocks.ariaHardDrop') + '">⇓ ' + T('gs.blocks.ariaHardDrop') + '</button>' +
    '    <button class="btn teal" data-act="hold" aria-label="' + T('gs.blocks.ariaHold') + '">⇄ ' + T('gs.blocks.ariaHold') + '</button>' +
    '  </div>' +
    '  <div class="blocks-banner" id="banner"></div>' +
    '  <div class="blocks-screen hidden" id="screen">' +
    '    <div class="blocks-screen-title" id="scr-title"></div>' +
    '    <div class="blocks-screen-sub" id="scr-sub"></div>' +
    '    <div class="blocks-screen-stats" id="scr-stats"></div>' +
    '    <div class="blocks-levels hidden" id="scr-levels"></div>' +
    '    <div class="blocks-btnrow" id="scr-btns"></div>' +
    '  </div>' +
    '</div>' +
    '<p class="help-text" id="help-line">' + T('gs.blocks.help') + '</p>';

  var canvas = document.getElementById('board');
  var vsCanvas = document.getElementById('vs-board');
  var nextCanvas = document.getElementById('next');
  var holdCanvas = document.getElementById('hold');
  var ctx, vctx, nctx, hctx;
  var scoreEl = document.getElementById('score');
  var levelEl = document.getElementById('level');
  var linesEl = document.getElementById('lines');
  var objectiveEl = document.getElementById('objective');
  var aiLinesEl = document.getElementById('ai-lines');
  var layoutEl = document.getElementById('layout');
  var tabsEl = document.getElementById('tabs');
  var touchEl = document.getElementById('touch-controls');
  var screenEl = document.getElementById('screen');
  var scrTitle = document.getElementById('scr-title');
  var scrSub = document.getElementById('scr-sub');
  var scrStats = document.getElementById('scr-stats');
  var scrLevels = document.getElementById('scr-levels');
  var scrBtns = document.getElementById('scr-btns');
  var bannerEl = document.getElementById('banner');
  var bannerTimer = null;

  function setupCanvas(c, w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var cx = c.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return cx;
  }
  ctx = setupCanvas(canvas, BW, BH);
  vctx = setupCanvas(vsCanvas, VSW, VSH);
  nctx = setupCanvas(nextCanvas, NEXTW, NEXT_H_ITEM * 5 + 4);
  hctx = setupCanvas(holdCanvas, 58, 56);

  var gameLoop = null;
  var g = null;
  var mode = 'endless';
  var paused = false;
  var lastFrameTime = 0;
  var uiDirty = true;
  var pendingRestore = null;
  var resultKind = null;

  /* ---------------- 工具 ---------------- */
  function emptyRow() {
    var row = [];
    for (var c = 0; c < COLS; c++) row.push(0);
    return row;
  }
  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) b.push(emptyRow());
    return b;
  }
  function cloneBoard(b) {
    return b.map(function (row) { return row.slice(); });
  }
  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      s = Math.imul(s ^ (s >>> 15), 1 | s);
      s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s;
      return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(n, m) {
    return n + Math.floor(Math.random() * (m - n + 1));
  }
  function readNum(key, dflt) {
    try {
      var v = localStorage.getItem(key);
      if (v === null || v === '') return dflt;
      var n = Number(v);
      return isFinite(n) ? n : dflt;
    } catch (e) { return dflt; }
  }
  function writeNum(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) {}
  }
  function getJSON(key, dflt) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return dflt;
      var v = JSON.parse(raw);
      return v == null ? dflt : v;
    } catch (e) { return dflt; }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function dropStep(level) {
    return Math.max(60, Math.round(720 * Math.pow(0.86, level - 1)));
  }
  function levelFor(lines, base) {
    return (base || 1) + Math.floor(lines / 10);
  }

  function rotateMatrix(m) {
    var out = [];
    for (var r = 0; r < 4; r++) {
      var row = [];
      for (var c = 0; c < 4; c++) row.push(m[3 - c][r]);
      out.push(row);
    }
    return out;
  }
  function matrixFor(type, rot) {
    var m = SHAPES[type];
    for (var i = 0; i < (rot % 4); i++) m = rotateMatrix(m);
    return m;
  }

  /* ---------------- 局面与 7-bag ---------------- */
  function fillQueue() {
    while (g.queue.length < 7) {
      var bag = TYPES.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(nextRand() * (i + 1));
        var tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
      }
      for (var k = 0; k < bag.length; k++) g.queue.push(bag[k]);
    }
  }
  function nextRand() {
    g.rngState = (g.rngState + 0x6D2B79F5) >>> 0;
    var t = g.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function newSeed() {
    return (Date.now() % 2147483647) ^ Math.floor(Math.random() * 0x7fffffff);
  }

  function newGame(m, opts) {
    opts = opts || {};
    var levelStart = opts.level || 1;
    g = {
      mode: m,
      board: emptyBoard(),
      queue: [],
      hold: null,
      canHold: true,
      cur: null,
      score: 0,
      lines: 0,
      level: levelStart,
      combo: 0,
      b2b: false,
      tspins: 0,
      pieces: 0,
      elapsed: 0,
      over: false,
      result: null,
      paused: false,
      lockAcc: 0,
      lockResets: 0,
      gravityAcc: 0,
      softHeld: false,
      softAcc: 0,
      dasDir: 0,
      dasElapsed: 0,
      arrAcc: 0,
      rngState: opts.seed != null ? opts.seed >>> 0 : newSeed() >>> 0,
      incomingCount: 0,
      incomingTimer: 0,
      garbageFlash: 0,
      particles: [],
      shake: 0,
      levelFx: 0,
      clearAnim: null,
      campaignIndex: opts.campaignIndex != null ? opts.campaignIndex : 0,
      campaignTotal: opts.campaignTotal || 0,
      campaignProgress: 0,
      campaignDone: false,
      waveTimer: 0,
      ai: null,
      bannerLabel: ''
    };
    fillQueue();
    if (m === 'vs') createAI();
    syncModeUI();
    spawn();
    drawNext();
    drawHold();
    updateHud();
    updateObjectiveHud();
    hideScreen();
    resultKind = null;
    paused = false;
    lastFrameTime = 0;
    if (gameLoop && !gameLoop.isRunning()) gameLoop.resume();
    if (g.mode === 'campaign') applyCampaignWaveTimer();
  }

  function createAI() {
    g.ai = {
      board: emptyBoard(),
      queue: [],
      hold: null,
      cur: null,
      lines: 0,
      pieces: 0,
      timer: 0,
      interval: 320,
      incomingCount: 0,
      incomingTimer: 0,
      over: false,
      flash: 0
    };
    aiFillQueue();
    aiSpawn();
  }
  function aiFillQueue() {
    while (g.ai.queue.length < 5) {
      var bag = TYPES.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      for (var k = 0; k < bag.length; k++) g.ai.queue.push(bag[k]);
    }
  }
  function aiSpawn() {
    aiFillQueue();
    var type = g.ai.queue.shift();
    g.ai.cur = { type: type, x: 3, y: 0, rot: 0, m: SHAPES[type].map(function (r) { return r.slice(); }) };
    g.ai.pieces++;
    if (aiCollides(g.ai.cur.m, g.ai.cur.x, g.ai.cur.y)) {
      g.ai.cur = null;
      aiTopOut();
    }
  }

  function syncModeUI() {
    var tabs = tabsEl.getElementsByTagName('button');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = 'blocks-tab' + (tabs[i].getAttribute('data-mode') === mode ? ' active' : '');
    }
    if (mode === 'vs') layoutEl.classList.add('vs');
    else layoutEl.classList.remove('vs');
  }

  function collides(m, px, py, board) {
    var b = board || g.board;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (!m[r][c]) continue;
        var bx = px + c, by = py + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && b[by][bx]) return true;
      }
    }
    return false;
  }
  function aiCollides(m, px, py) { return collides(m, px, py, g.ai.board); }

  function spawn() {
    if (!g.queue.length) fillQueue();
    var type = g.queue.shift();
    fillQueue();
    g.cur = {
      type: type, x: 3, y: 0, rot: 0,
      m: SHAPES[type].map(function (r) { return r.slice(); }),
      lastRotate: false
    };
    g.pieces++;
    g.lockAcc = 0;
    g.lockResets = 0;
    g.canHold = true;
    g.softAcc = 0;
    drawNext();
    drawHold();
    updateHud();
    if (collides(g.cur.m, g.cur.x, g.cur.y)) {
      g.cur = null;
      gameOver('topout');
    }
  }

  function grounded() {
    if (!g.cur) return false;
    return collides(g.cur.m, g.cur.x, g.cur.y + 1);
  }
  function resetLock() {
    if (!g.cur || !grounded()) return;
    if (g.lockResets >= MAX_LOCK_RESETS) return;
    g.lockAcc = 0;
    g.lockResets++;
  }

  function tryShift(dx) {
    if (!g.cur || g.over || g.clearAnim) return false;
    if (collides(g.cur.m, g.cur.x + dx, g.cur.y)) return false;
    g.cur.x += dx;
    g.cur.lastRotate = false;
    resetLock();
    return true;
  }

  function tryRotate(dir) {
    if (!g.cur || g.over || g.clearAnim) return false;
    var m = rotateMatrix(g.cur.m);
    if (dir < 0) { m = rotateMatrix(rotateMatrix(rotateMatrix(g.cur.m))); }
    var kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];
    for (var i = 0; i < kicks.length; i++) {
      var nx = g.cur.x + kicks[i][0];
      var ny = g.cur.y + kicks[i][1];
      if (!collides(m, nx, ny)) {
        g.cur.m = m;
        g.cur.x = nx;
        g.cur.y = ny;
        g.cur.rot = (g.cur.rot + (dir < 0 ? 3 : 1)) % 4;
        g.cur.lastRotate = true;
        resetLock();
        if (Arcade.audio) Arcade.audio.play('rotate');
        return true;
      }
    }
    return false;
  }

  function softDropStep() {
    if (!g.cur || g.over || g.clearAnim) return false;
    if (collides(g.cur.m, g.cur.x, g.cur.y + 1)) return false;
    g.cur.y++;
    g.cur.lastRotate = false;
    g.score += 1;
    resetLock();
    updateHud();
    return true;
  }

  function hardDrop() {
    if (!g.cur || g.over || g.clearAnim) return;
    var dist = 0;
    while (!collides(g.cur.m, g.cur.x, g.cur.y + 1)) { g.cur.y++; dist++; }
    if (dist > 0) { g.score += dist * 2; updateHud(); }
    g.shake = Math.max(g.shake, 2.5);
    if (Arcade.audio) Arcade.audio.play('drop');
    lockPiece();
    writeSave();
  }

  function holdSwap() {
    if (!g.cur || g.over || g.clearAnim || !g.canHold) return;
    var t = g.cur.type;
    if (g.hold === null) {
      g.hold = t;
      spawn();
      if (!g.cur) { writeSave(); return; }
      if (g.pieces > 0) g.pieces--;
    } else {
      var h = g.hold;
      g.hold = t;
      g.cur = {
        type: h, x: 3, y: 0, rot: 0,
        m: SHAPES[h].map(function (r) { return r.slice(); }),
        lastRotate: false
      };
      g.lockAcc = 0;
      g.lockResets = 0;
      g.canHold = true;
    }
    g.canHold = false;
    drawHold();
    drawNext();
    updateHud();
    if (Arcade.audio) Arcade.audio.play('rotate');
    if (collides(g.cur.m, g.cur.x, g.cur.y)) {
      g.cur = null;
      gameOver('topout');
    }
    writeSave();
  }

  /* ---------------- 锁定 / 消行 / 计分 ---------------- */
  function lockPiece() {
    if (!g.cur || g.over) return;
    var cur = g.cur;
    var topOut = false;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (!cur.m[r][c]) continue;
        var bx = cur.x + c, by = cur.y + r;
        if (by < 0) { topOut = true; continue; }
        g.board[by][bx] = cur.type;
      }
    }
    if (topOut) {
      g.cur = null;
      gameOver('topout');
      return;
    }

    var tspin = false, cornerCount = 0;
    if (cur.type === 'T' && cur.lastRotate) {
      var cx = cur.x + 1, cy = cur.y + 1;
      var corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (var ci = 0; ci < 4; ci++) {
        var qx = cx + corners[ci][0], qy = cy + corners[ci][1];
        if (qx < 0 || qx >= COLS || qy < 0 || qy >= ROWS || g.board[qy][qx]) cornerCount++;
      }
      tspin = cornerCount >= 3;
    }

    var full = [];
    for (var rr = 0; rr < ROWS; rr++) {
      var isFull = true;
      for (var cc = 0; cc < COLS; cc++) {
        if (!g.board[rr][cc]) { isFull = false; break; }
      }
      if (isFull) full.push(rr);
    }
    g.cur = null;
    g.lockAcc = 0;
    g.lockResets = 0;

    if (full.length || tspin) {
      scoreClear(full, tspin);
    } else {
      g.combo = 0;
      spawn();
      checkCampaign();
    }

    if (full.length) {
      g.clearAnim = { rows: full, t: 0, dur: 560, count: full.length };
      spawnParticles(full);
      if (full.length >= 4) {
        g.shake = 9;
        if (Arcade.fx) { Arcade.fx.flash('var(--neon-cyan)'); Arcade.fx.shake(canvas); }
      } else {
        g.shake = Math.max(g.shake, 3);
        if (Arcade.audio) Arcade.audio.play('clear');
      }
    } else if (tspin) {
      if (Arcade.fx) Arcade.fx.flash('var(--neon-purple)');
      spawn();
      checkCampaign();
    }
    if (g.mode === 'vs' && full.length + (tspin ? 1 : 0) > 0) {
      var send = GARBAGE_OUT[Math.min(4, full.length)] + (tspin ? 1 : 0);
      if (send > 0) sendGarbageToAI(send);
    }
    updateHud();
    updateObjectiveHud();
    writeSave();
  }

  function scoreClear(full, tspin) {
    var cleared = full.length;
    var isBig = tspin || cleared === 4;
    var base = LINE_SCORE[cleared] * g.level;
    if (tspin) base += 320 * g.level;
    if (g.b2b && isBig) base = Math.floor(base * 1.5);
    g.combo++;
    g.lines += cleared;
    if (tspin) g.tspins++;
    var comboBonus = g.combo >= 2 ? (g.combo - 1) * 50 * g.level : 0;
    g.score += base + comboBonus;
    if (isBig) g.b2b = true;
    else if (cleared > 0) g.b2b = false;
    if (g.mode === 'vs') g.sentRows = (g.sentRows || 0) + GARBAGE_OUT[Math.min(4, cleared)] + (tspin ? 1 : 0);

    var newLevel = 1 + Math.floor(g.lines / 10);
    if (newLevel > g.level) {
      g.level = newLevel;
      g.levelFx = 1;
      if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
    } else if (g.level > newLevel) {
      /* 战役可继承起始等级，但不再回落 */
    }

    var label = '';
    var color = 'var(--neon-yellow)';
    if (tspin) {
      label = T('gs.blocks.tspin') + (cleared ? ' · ' + T('gs.blocks.clearFmt').replace('{n}', cleared) : '');
      color = 'var(--neon-purple)';
    } else if (cleared === 4) {
      label = T('gs.blocks.tetris');
      color = 'var(--neon-cyan)';
      if (g.b2b && g.combo > 1) label += ' · B2B';
    } else {
      label = T('gs.blocks.clearFmt').replace('{n}', cleared);
    }
    if (g.combo >= 2) label += ' · ' + T('gs.blocks.comboTag').replace('{n}', g.combo);
    if (g.levelFx > 0) label += ' · ' + T('gs.blocks.levelUp').replace('{n}', g.level);
    showBanner(label, color, cleared >= 4 || tspin ? 1900 : 1300);
    if (Arcade.audio) Arcade.audio.play(cleared >= 4 ? 'record' : 'match');
    if (Arcade.fx) Arcade.fx.shake(canvas);
  }

  function spawnParticles(rows) {
    for (var i = 0; i < rows.length; i++) {
      var ry = rows[i];
      for (var c = 0; c < COLS; c++) {
        var type = g.board[ry][c];
        var col = COLORS[type] || '#ffffff';
        for (var n = 0; n < 2; n++) {
          g.particles.push({
            x: c * CELL + CELL / 2,
            y: ry * CELL + CELL / 2,
            vx: (Math.random() - 0.5) * 180,
            vy: -40 - Math.random() * 160,
            life: 1,
            size: 1.5 + Math.random() * 2.6,
            color: col
          });
        }
      }
    }
  }

  function finishClear() {
    var rows = g.clearAnim.rows;
    var before = g.clearAnim.count;
    g.board = g.board.filter(function (_, idx) { return rows.indexOf(idx) === -1; });
    while (g.board.length < ROWS) g.board.unshift(emptyRow());
    g.clearAnim = null;
    if (before >= 2) {
      /* 多行消除的二次屏震 */
      g.shake = Math.max(g.shake, before * 1.4);
    }
    spawn();
    checkCampaign();
    writeSave();
  }

  /* ---------------- 垃圾行 ---------------- */
  function sentRowsCount(cleared) { return GARBAGE_OUT[Math.min(4, cleared)] || 0; }

  function sendGarbageToAI(n) {
    if (!g.ai) return;
    g.ai.incomingCount += n;
    g.ai.incomingTimer = 900;
  }
  function sendGarbageToPlayer(n) {
    g.incomingCount += n;
    g.incomingTimer = 900;
    showBanner(T('gs.blocks.garbageWarn').replace('{n}', n), 'var(--neon-pink)', 1300);
  }

  function insertGarbage(board, count) {
    for (var i = 0; i < count; i++) {
      var occupied = false;
      for (var c = 0; c < COLS; c++) { if (board[0][c]) { occupied = true; break; } }
      if (occupied) return false;
      board.shift();
      var row = emptyRow();
      var hole = Math.floor(Math.random() * COLS);
      for (var cc = 0; cc < COLS; cc++) row[cc] = cc === hole ? 0 : 'X';
      board.push(row);
    }
    return true;
  }

  /* ---------------- 战役 ---------------- */
  function campaignCfg() { return CAMPAIGN[g.campaignIndex] || CAMPAIGN[0]; }

  function objectiveText(cfg) {
    if (cfg.obj === 'lines') return T('gs.blocks.objLines').replace('{n}', cfg.target);
    if (cfg.obj === 'pieces') return T('gs.blocks.objPieces').replace('{n}', cfg.target).replace('{p}', cfg.limit);
    if (cfg.obj === 'score') return T('gs.blocks.objScore').replace('{s}', cfg.target);
    if (cfg.obj === 'tspin') return T('gs.blocks.objTspin').replace('{n}', cfg.target);
    if (cfg.obj === 'survive') {
      var base = T('gs.blocks.objSurvive').replace('{s}', cfg.seconds);
      if (cfg.minLines) base += ' · ' + T('gs.blocks.objLines').replace('{n}', cfg.minLines);
      return base;
    }
    return '';
  }

  function campaignTargetMet(cfg) {
    if (cfg.obj === 'lines' || cfg.obj === 'pieces') return g.lines >= cfg.target;
    if (cfg.obj === 'score') return g.score >= cfg.target;
    if (cfg.obj === 'tspin') return g.tspins >= cfg.target;
    if (cfg.obj === 'survive') {
      var timeOk = g.elapsed >= cfg.seconds * 1000;
      var linesOk = !cfg.minLines || g.lines >= cfg.minLines;
      return timeOk && linesOk;
    }
    return false;
  }

  function checkCampaign() {
    if (g.mode !== 'campaign' || g.over) return;
    var cfg = campaignCfg();
    g.campaignProgress = campaignTargetMet(cfg) ? 1 : 0;
    if (campaignTargetMet(cfg)) {
      campaignSuccess();
      return;
    }
    if (cfg.obj === 'survive') {
      if (g.elapsed >= cfg.seconds * 1000 && cfg.minLines && g.lines < cfg.minLines) {
        campaignFail('lines');
      }
      return;
    }
    if (cfg.time && g.elapsed >= cfg.time * 1000) {
      campaignFail('timeout');
      return;
    }
    if (cfg.limit && g.pieces >= cfg.limit && g.lines < cfg.target) {
      campaignFail('pieces');
    }
  }

  function campaignSuccess() {
    if (g.over) return;
    g.over = true;
    g.campaignTotal += g.score;
    var bestMap = getJSON(LS_CAMPAIGN_LEVEL_BEST, {});
    if (!bestMap[g.campaignIndex] || g.score > bestMap[g.campaignIndex]) {
      bestMap[g.campaignIndex] = g.score;
      setJSON(LS_CAMPAIGN_LEVEL_BEST, bestMap);
    }
    var isFinal = g.campaignIndex >= CAMPAIGN.length - 1;
    if (isFinal) {
      var best = readNum(LS_CAMPAIGN_BEST, -1);
      var isNew = g.campaignTotal > 0 && g.campaignTotal > best;
      if (isNew) writeNum(LS_CAMPAIGN_BEST, g.campaignTotal);
      if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
      if (Arcade.audio) Arcade.audio.play('win');
      showScreen({
        title: T('gs.blocks.campaignClear'),
        sub: T('gs.blocks.campaignClearSub'),
        stats: [
          '<div>' + T('gs.blocks.totalScore') + ' <b>' + g.campaignTotal + '</b></div>',
          '<div>' + T('gs.blocks.campaignBest') + ' <b>' + (g.campaignTotal > best ? g.campaignTotal : best) + '</b></div>',
          '<div>' + T('gs.blocks.lines') + ' <b>' + g.lines + '</b></div>'
        ].join('') + (isNew ? '<div class="blocks-new">' + T('gs.blocks.newRecord') + '</div>' : ''),
        buttons: [
          { label: T('gs.blocks.restartCampaign'), cls: 'green', fn: function () { startCampaign(0, 0); } },
          { label: T('gs.blocks.backCampaign'), cls: 'purple', fn: openLevelSelect }
        ]
      });
    } else {
      if (Arcade.fx) Arcade.fx.flash('var(--neon-green)');
      if (Arcade.audio) Arcade.audio.play('win');
      showScreen({
        title: T('gs.blocks.levelClear'),
        sub: objectiveText(campaignCfg()),
        stats: [
          '<div>' + T('gs.blocks.score') + ' <b>' + g.score + '</b></div>',
          '<div>' + T('gs.blocks.lines') + ' <b>' + g.lines + '</b></div>',
          '<div>' + T('gs.blocks.timeUsed') + ' <b>' + fmtTime(g.elapsed) + '</b></div>'
        ].join(''),
        buttons: [
          { label: T('gs.blocks.nextLevel'), cls: 'green', fn: function () { startCampaign(g.campaignIndex + 1, g.campaignTotal); } },
          { label: T('gs.blocks.backCampaign'), cls: 'purple', fn: openLevelSelect }
        ]
      });
    }
    Arcade.savegame.clear();
  }

  function campaignFail(reason) {
    if (g.over) return;
    g.over = true;
    g.cur = null;
    if (Arcade.audio) Arcade.audio.play('lose');
    var reasonText = reason === 'timeout' ? T('gs.blocks.failTimeout')
      : reason === 'pieces' ? T('gs.blocks.failPieces')
        : T('gs.blocks.failTopout');
    showScreen({
      title: T('gs.blocks.levelFail'),
      sub: reasonText,
      stats: [
        '<div>' + T('gs.blocks.goalLabel') + ' <b>' + objectiveText(campaignCfg()) + '</b></div>',
        '<div>' + T('gs.blocks.lines') + ' <b>' + g.lines + '</b></div>',
        '<div>' + T('gs.blocks.timeUsed') + ' <b>' + fmtTime(g.elapsed) + '</b></div>'
      ].join(''),
      buttons: [
        { label: T('gs.blocks.retryLevel'), cls: 'green', fn: function () { startCampaign(g.campaignIndex, g.campaignTotal - 0); } },
        { label: T('gs.blocks.backCampaign'), cls: 'purple', fn: openLevelSelect }
      ]
    });
    Arcade.savegame.clear();
  }

  /* ---------------- VS AI ---------------- */
  function aiEvaluate(board) {
    var heights = [], holes = 0, agg = 0, bump = 0, cleared = 0;
    for (var c = 0; c < COLS; c++) {
      var h = 0;
      for (var r = 0; r < ROWS; r++) {
        if (board[r][c]) { h = ROWS - r; break; }
      }
      heights.push(h);
      agg += h;
      for (var rr = ROWS - h; rr < ROWS; rr++) {
        if (!board[rr][c] && rr < ROWS - 0) holes++;
      }
    }
    for (var i = 1; i < COLS; i++) bump += Math.abs(heights[i] - heights[i - 1]);
    return { hole: holes, agg: agg, bump: bump };
  }

  function aiBestMove() {
    var best = null, bestScore = -99999;
    var type = g.ai.cur.type;
    for (var rot = 0; rot < 4; rot++) {
      var m = matrixFor(type, rot);
      for (var x = -2; x < COLS; x++) {
        if (collides(m, x, 0, g.ai.board)) continue;
        var y = 0;
        while (!collides(m, x, y + 1, g.ai.board)) y++;
        var sim = cloneBoard(g.ai.board);
        var ok = true;
        for (var r = 0; r < 4; r++) {
          for (var c = 0; c < 4; c++) {
            if (!m[r][c]) continue;
            var bx = x + c, by = y + r;
            if (bx < 0 || bx >= COLS || by >= ROWS) { ok = false; break; }
            sim[by][bx] = type;
          }
          if (!ok) break;
        }
        if (!ok) continue;
        var lines = 0;
        for (var rr = 0; rr < ROWS; rr++) {
          var fullRow = true;
          for (var cc = 0; cc < COLS; cc++) if (!sim[rr][cc]) { fullRow = false; break; }
          if (fullRow) lines++;
        }
        if (lines) {
          sim = sim.filter(function (_, idx) {
            var isFull = true;
            for (var c2 = 0; c2 < COLS; c2++) if (!sim[idx][c2]) { isFull = false; break; }
            return !isFull;
          });
          while (sim.length < ROWS) sim.unshift(emptyRow());
        }
        var ev = aiEvaluate(sim);
        var sc = lines * 6.5 - ev.hole * 2.4 - ev.agg * 0.32 - ev.bump * 0.5 + Math.random() * 0.6;
        if (sc > bestScore) { bestScore = sc; best = { m: m, x: x, y: y, rot: rot }; }
      }
    }
    return best;
  }

  function aiStep() {
    if (!g.ai || g.ai.over || g.over) return;
    if (!g.ai.cur) { aiSpawn(); if (!g.ai.cur) return; }
    var mv = aiBestMove();
    if (!mv) { aiTopOut(); return; }
    g.ai.cur.m = mv.m;
    g.ai.cur.x = mv.x;
    g.ai.cur.y = mv.y;
    g.ai.cur.rot = mv.rot;
    var type = g.ai.cur.type;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (mv.m[r][c] && mv.y + r >= 0) g.ai.board[mv.y + r][mv.x + c] = type;
      }
    }
    var cleared = 0;
    for (var rr = 0; rr < ROWS; rr++) {
      var full = true;
      for (var cc = 0; cc < COLS; cc++) if (!g.ai.board[rr][cc]) { full = false; break; }
      if (full) cleared++;
    }
    if (cleared) {
      g.ai.board = g.ai.board.filter(function (row) {
        var full = true;
        for (var c2 = 0; c2 < COLS; c2++) if (!row[c2]) { full = false; break; }
        return !full;
      });
      while (g.ai.board.length < ROWS) g.ai.board.unshift(emptyRow());
      g.ai.lines += cleared;
      g.ai.flash = 1;
      sendGarbageToPlayer(GARBAGE_OUT[Math.min(4, cleared)]);
    }
    g.ai.cur = null;
    aiSpawn();
  }

  function updateAI(dt) {
    if (!g.ai || g.ai.over || g.over) return;
    if (g.ai.incomingCount > 0) {
      g.ai.incomingTimer -= dt;
      if (g.ai.incomingTimer <= 0) {
        var cnt = g.ai.incomingCount;
        g.ai.incomingCount = 0;
        if (!insertGarbage(g.ai.board, cnt)) { aiTopOut(); return; }
        g.ai.flash = 1;
      }
    }
    g.ai.timer += dt;
    if (g.ai.timer >= g.ai.interval) {
      g.ai.timer = 0;
      aiStep();
    }
    if (g.ai.flash > 0) g.ai.flash -= dt / 500;
  }

  function aiTopOut() {
    if (!g.ai || g.ai.over) return;
    g.ai.over = true;
    g.ai.cur = null;
    if (!g.over) endMatch(true);
  }

  function endMatch(playerWon) {
    if (!g || g.over) return;
    g.over = true;
    g.cur = null;
    g.result = playerWon ? 'win' : 'lose';
    var best = readNum(LS_VS_BEST, -1);
    var isNew = g.score > 0 && g.score > best;
    if (isNew) writeNum(LS_VS_BEST, g.score);
    if (Arcade.audio) Arcade.audio.play(playerWon ? 'win' : 'lose');
    if (Arcade.fx) Arcade.fx.flash(playerWon ? 'var(--neon-green)' : 'var(--neon-pink)');
    showScreen({
      title: playerWon ? T('gs.blocks.vsWin') : T('gs.blocks.vsLose'),
      sub: playerWon ? T('gs.blocks.vsWinSub') : T('gs.blocks.vsLoseSub'),
      stats: [
        '<div>' + T('gs.blocks.score') + ' <b>' + g.score + '</b></div>',
        '<div>' + T('gs.blocks.vsSent') + ' <b>' + (g.sentRows || 0) + '</b></div>',
        '<div>' + T('gs.blocks.vsBest') + ' <b>' + (isNew ? g.score : (best >= 0 ? best : 0)) + '</b></div>'
      ].join('') + (isNew ? '<div class="blocks-new">' + T('gs.blocks.newRecord') + '</div>' : ''),
      buttons: [
        { label: T('gs.blocks.vsAgain'), cls: 'green', fn: function () { startVs(); } },
        { label: T('gs.blocks.backCampaign'), cls: 'purple', fn: openLevelSelect }
      ]
    });
    Arcade.savegame.clear();
  }

  function gameOver(reason) {
    if (!g || g.over) return;
    if (g.mode === 'vs') { endMatch(false); return; }
    if (g.mode === 'campaign') { campaignFail(reason || 'topout'); return; }
    g.over = true;
    g.cur = null;
    if (Arcade.audio) Arcade.audio.play('lose');
    var best = 0;
    if (Arcade.storage) best = Arcade.storage.getBest('blocks') || 0;
    var isNew = false;
    if (g.score > 0 && Arcade.shell) isNew = !!Arcade.shell.submitScore(g.score);
    if (Arcade.storage) best = Arcade.storage.getBest('blocks') || 0;
    showScreen({
      title: T('gs.blocks.gameOver'),
      sub: T('gs.blocks.endlessSub'),
      stats: [
        '<div>' + T('gs.blocks.score') + ' <b>' + g.score + '</b></div>',
        '<div>' + T('gs.blocks.lines') + ' <b>' + g.lines + '</b></div>',
        '<div>' + T('gs.blocks.level') + ' <b>' + g.level + '</b></div>',
        '<div>' + T('gs.blocks.bestLabel') + ' <b>' + best + '</b></div>'
      ].join('') + (isNew ? '<div class="blocks-new">' + T('gs.blocks.newRecord') + '</div>' : ''),
      buttons: [
        { label: T('gs.blocks.restart'), cls: 'green', fn: function () { startEndless(); } },
        { label: T('gs.blocks.backCampaign'), cls: 'purple', fn: openLevelSelect }
      ]
    });
    Arcade.savegame.clear();
  }

  /* ---------------- HUD / 屏幕 ---------------- */
  function fmtTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60), s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function showBanner(label, color, ms) {
    if (!label) return;
    bannerEl.textContent = label;
    bannerEl.style.color = color || 'var(--neon-yellow)';
    bannerEl.style.borderColor = color || 'var(--neon-yellow)';
    bannerEl.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bannerEl.classList.remove('show'); }, ms || 1300);
  }
  function updateHud() {
    if (!g) return;
    scoreEl.textContent = Math.floor(g.score);
    levelEl.textContent = g.level;
    linesEl.textContent = g.lines;
    if (aiLinesEl) aiLinesEl.textContent = g.ai ? (g.ai.lines + 'L') : '--';
  }
  function updateObjectiveHud() {
    if (!g) { objectiveEl.textContent = ''; return; }
    if (g.mode === 'endless') {
      objectiveEl.textContent = T('gs.blocks.modeHintEndless');
    } else if (g.mode === 'vs') {
      objectiveEl.textContent = T('gs.blocks.modeHintVs').replace('{n}', g.sentRows || 0);
    } else {
      var cfg = campaignCfg();
      var txt = T('gs.blocks.goalLabel') + ' ' + objectiveText(cfg) + ' · ';
      if (cfg.obj === 'survive') {
        txt += T('gs.blocks.surviveFmt')
          .replace('{a}', Math.floor(Math.min(g.elapsed, cfg.seconds * 1000) / 1000))
          .replace('{b}', cfg.seconds);
        if (cfg.minLines) txt += ' · ' + T('gs.blocks.progressFmt').replace('{a}', g.lines).replace('{b}', cfg.minLines);
      } else {
        var cur = cfg.obj === 'score' ? Math.floor(g.score) : cfg.obj === 'tspin' ? g.tspins : g.lines;
        txt += T('gs.blocks.progressFmt').replace('{a}', cur).replace('{b}', cfg.target);
        if (cfg.time) txt += ' · ' + T('gs.blocks.timeLeft').replace('{t}', fmtTime(cfg.time * 1000 - g.elapsed));
        if (cfg.limit) txt += ' · ' + T('gs.blocks.piecesLeft').replace('{n}', Math.max(0, cfg.limit - g.pieces));
      }
      objectiveEl.textContent = txt;
    }
  }

  var screenKind = null;
  function showScreen(o) {
    screenKind = o.kind || 'info';
    paused = true;
    scrTitle.textContent = o.title || '';
    scrSub.innerHTML = o.sub || '';
    scrStats.innerHTML = o.stats || '';
    scrBtns.innerHTML = '';
    (o.buttons || []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.label;
      btn.addEventListener('click', b.fn);
      scrBtns.appendChild(btn);
    });
    if (o.levels) {
      scrLevels.className = 'blocks-levels';
      scrLevels.innerHTML = o.levels.html;
      var lvBtns = scrLevels.getElementsByTagName('button');
      for (var i = 0; i < lvBtns.length; i++) {
        lvBtns[i].addEventListener('click', function () {
          startCampaign(parseInt(this.getAttribute('data-lv'), 10), 0);
        });
      }
    } else {
      scrLevels.className = 'blocks-levels hidden';
      scrLevels.innerHTML = '';
    }
    screenEl.classList.remove('hidden');
  }
  function hideScreen() {
    screenKind = null;
    screenEl.classList.add('hidden');
  }

  function openLevelSelect() {
    mode = 'campaign';
    if (g) syncModeUI();
    var done = getJSON(LS_CAMPAIGN_LEVEL_BEST, {});
    var vsBest = readNum(LS_VS_BEST, -1);
    var bestCampaign = readNum(LS_CAMPAIGN_BEST, -1);
    var html = '';
    for (var i = 0; i < CAMPAIGN.length; i++) {
      html += '<button class="blocks-lv' + (done[i] ? ' done' : '') + '" data-lv="' + i + '">' +
        '<b>' + T('gs.blocks.levelN').replace('{n}', i + 1) + '</b>' +
        objectiveText(CAMPAIGN[i]) +
        (done[i] ? '<br>' + T('gs.blocks.levelBestTag') + ' ' + done[i] : '') +
        '</button>';
    }
    var statLines = [];
    if (vsBest >= 0) statLines.push(T('gs.blocks.vsBest') + ' <b>' + vsBest + '</b>');
    if (bestCampaign >= 0) statLines.push(T('gs.blocks.campaignBest') + ' <b>' + bestCampaign + '</b>');
    showScreen({
      kind: 'menu',
      title: T('gs.blocks.campaignTitle'),
      sub: T('gs.blocks.campaignSub') + (statLines.length ? '<br>' + statLines.join(' · ') : ''),
      stats: '',
      levels: { html: html },
      buttons: [
        { label: T('gs.blocks.modeClassic'), cls: 'teal', fn: startEndless },
        { label: T('gs.blocks.modeVs'), cls: 'pink', fn: startVs }
      ]
    });
  }

  function showPause() {
    showScreen({
      kind: 'pause',
      title: T('gs.blocks.paused'),
      sub: T('gs.blocks.pausedSub'),
      stats: [
        '<div>' + T('gs.blocks.score') + ' <b>' + (g ? Math.floor(g.score) : 0) + '</b></div>',
        '<div>' + T('gs.blocks.lines') + ' <b>' + (g ? g.lines : 0) + '</b></div>'
      ].join(''),
      buttons: [
        { label: T('gs.blocks.resume'), cls: 'green', fn: resumeGame },
        { label: T('gs.blocks.restart'), cls: 'yellow', fn: restartCurrent },
        { label: T('gs.blocks.backCampaign'), cls: 'purple', fn: openLevelSelect }
      ]
    });
  }
  function resumeGame() {
    hideScreen();
    paused = false;
  }
  function restartCurrent() {
    if (mode === 'vs') startVs();
    else if (mode === 'campaign') startCampaign(g ? g.campaignIndex : 0, g ? g.campaignTotal : 0);
    else startEndless();
  }

  function startEndless() {
    mode = 'endless';
    newGame('endless');
    writeSave();
  }
  function startVs() {
    mode = 'vs';
    newGame('vs');
    writeSave();
  }
  function startCampaign(index, total) {
    mode = 'campaign';
    var idx = Math.max(0, Math.min(CAMPAIGN.length - 1, Number(index) || 0));
    newGame('campaign', { campaignIndex: idx, campaignTotal: total || 0 });
    writeSave();
  }

  function applyCampaignWaveTimer() {
    if (!g || g.mode !== 'campaign') return;
    var cfg = campaignCfg();
    g.waveTimer = cfg.obj === 'survive' ? cfg.waveEvery : 0;
    updateObjectiveHud();
  }

  /* ---------------- 存档 ---------------- */
  function collectSave() {
    if (!g || g.over || screenKind === 'menu') return null;
    var s = {
      v: 2,
      mode: g.mode,
      board: g.board,
      queue: g.queue.slice(),
      hold: g.hold,
      canHold: g.canHold,
      score: g.score,
      lines: g.lines,
      level: g.level,
      combo: g.combo,
      b2b: g.b2b,
      tspins: g.tspins,
      pieces: g.pieces,
      elapsed: g.elapsed,
      rngState: g.rngState,
      lockAcc: g.lockAcc,
      lockResets: g.lockResets,
      incomingCount: g.incomingCount,
      incomingTimer: g.incomingTimer,
      sentRows: g.sentRows || 0,
      clearRows: g.clearAnim ? g.clearAnim.rows.slice() : null,
      cur: g.cur ? {
        type: g.cur.type, x: g.cur.x, y: g.cur.y,
        rot: g.cur.rot, lastRotate: g.cur.lastRotate
      } : null,
      campaignIndex: g.campaignIndex,
      campaignTotal: g.campaignTotal,
      waveTimer: g.waveTimer,
      paused: paused
    };
    if (g.mode === 'vs' && g.ai) {
      s.ai = {
        board: g.ai.board,
        queue: g.ai.queue.slice(),
        lines: g.ai.lines,
        pieces: g.ai.pieces,
        incomingCount: g.ai.incomingCount,
        incomingTimer: g.ai.incomingTimer,
        timer: g.ai.timer,
        interval: g.ai.interval
      };
    }
    return s;
  }
  function writeSave() {
    if (Arcade.savegame) Arcade.savegame.write();
  }

  function validBoard(b) {
    if (!Array.isArray(b) || b.length !== ROWS) return false;
    for (var r = 0; r < ROWS; r++) {
      var row = b[r];
      if (!Array.isArray(row) || row.length < COLS) return false;
      for (var c = 0; c < COLS; c++) {
        var v = row[c];
        if (v === 0 || v === '0' || v === null) continue;
        if (typeof v === 'number') {
          if (v < 1 || v > 8) return false;
          continue;
        }
        if (typeof v !== 'string' || (TYPES.indexOf(v) < 0 && v !== 'X')) return false;
      }
    }
    return true;
  }
  function normalizeCell(v) {
    if (v === null || v === '0' || v === 0) return 0;
    if (typeof v === 'number') {
      if (v >= 1 && v <= 7) return TYPES[v - 1];
      if (v === 8) return 'X';
      return 0;
    }
    if (TYPES.indexOf(v) >= 0 || v === 'X') return v;
    return 0;
  }
  function normalizeBoard(b) {
    return b.map(function (row) { return row.slice(0, COLS).map(normalizeCell); });
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    var m = s.mode;
    if (m !== 'endless' && m !== 'vs' && m !== 'campaign') m = 'endless';
    var rawBoard = validBoard(s.board) ? s.board : (validBoard(s.grid) ? s.grid : null);
    if (!rawBoard) return false;
    var q = Array.isArray(s.queue) ? s.queue.filter(function (t) { return TYPES.indexOf(t) >= 0; }) : [];
    g = {
      mode: m,
      board: normalizeBoard(rawBoard),
      queue: q,
      hold: TYPES.indexOf(s.hold) >= 0 ? s.hold : null,
      canHold: s.canHold !== false,
      cur: null,
      score: Math.max(0, Number(s.score) || 0),
      lines: Math.max(0, Number(s.lines) || 0),
      level: Math.max(1, Number(s.level) || 1),
      combo: Math.max(0, Number(s.combo) || 0),
      b2b: !!s.b2b,
      tspins: Math.max(0, Number(s.tspins) || 0),
      pieces: Math.max(0, Number(s.pieces) || 0),
      elapsed: Math.max(0, Number(s.elapsed) || 0),
      over: false,
      result: null,
      paused: true,
      lockAcc: Math.max(0, Number(s.lockAcc) || 0),
      lockResets: Math.max(0, Number(s.lockResets) || 0),
      gravityAcc: 0,
      softHeld: false,
      softAcc: 0,
      dasDir: 0,
      dasElapsed: 0,
      arrAcc: 0,
      rngState: Number(s.rngState) || newSeed(),
      incomingCount: Math.max(0, Number(s.incomingCount) || 0),
      incomingTimer: Math.max(0, Number(s.incomingTimer) || 0),
      garbageFlash: 0,
      particles: [],
      shake: 0,
      levelFx: 0,
      clearAnim: null,
      campaignIndex: Math.min(CAMPAIGN.length - 1, Math.max(0, Number(s.campaignIndex) || 0)),
      campaignTotal: Math.max(0, Number(s.campaignTotal) || 0),
      campaignProgress: 0,
      campaignDone: false,
      waveTimer: Math.max(0, Number(s.waveTimer) || 0),
      ai: null,
      sentRows: Math.max(0, Number(s.sentRows) || 0),
      bannerLabel: ''
    };
    mode = m;
    fillQueue();
    if (m === 'vs') {
      createAI();
      if (s.ai && validBoard(s.ai.board)) {
        g.ai.board = normalizeBoard(s.ai.board);
        g.ai.lines = Math.max(0, Number(s.ai.lines) || 0);
        g.ai.pieces = Math.max(0, Number(s.ai.pieces) || 0);
        g.ai.incomingCount = Math.max(0, Number(s.ai.incomingCount) || 0);
        g.ai.incomingTimer = Math.max(0, Number(s.ai.incomingTimer) || 0);
        g.ai.timer = Math.max(0, Number(s.ai.timer) || 0);
        if (s.ai.interval) g.ai.interval = Math.max(120, Number(s.ai.interval));
        var aq = Array.isArray(s.ai.queue) ? s.ai.queue.filter(function (t) { return TYPES.indexOf(t) >= 0; }) : [];
        g.ai.queue = aq;
        aiFillQueue();
      }
    }
    if (m === 'campaign') applyCampaignWaveTimer();
    if (s.clearRows && s.clearRows.length) {
      var validClear = s.clearRows.filter(function (n) { return typeof n === 'number' && n >= 0 && n < ROWS; });
      if (validClear.length) {
        g.clearAnim = { rows: validClear, t: 0, dur: 560, count: validClear.length };
      }
    } else if (s.cur && SHAPES[s.cur.type]) {
      var rot = Math.max(0, Math.min(3, Number(s.cur.rot) || 0));
      g.cur = {
        type: s.cur.type, x: Number(s.cur.x) || 3, y: Number(s.cur.y) || 0,
        rot: rot, m: matrixFor(s.cur.type, rot),
        lastRotate: !!s.cur.lastRotate
      };
      if (collides(g.cur.m, g.cur.x, g.cur.y)) g.cur = null;
    }
    if (!g.cur && !g.clearAnim) {
      var before = g.pieces;
      spawn();
      g.pieces = before;
    }
    syncModeUI();
    drawNext();
    drawHold();
    updateHud();
    updateObjectiveHud();
    paused = true;
    showScreen({
      kind: 'resume',
      title: T('gs.blocks.resumed'),
      sub: m === 'campaign' ? T('gs.blocks.goalLabel') + ' ' + objectiveText(campaignCfg()) : T('gs.blocks.resumedSub'),
      stats: '<div>' + T('gs.blocks.score') + ' <b>' + Math.floor(g.score) + '</b> · ' +
        T('gs.blocks.lines') + ' <b>' + g.lines + '</b></div>',
      buttons: [
        { label: T('gs.blocks.resume'), cls: 'green', fn: resumeGame },
        { label: T('gs.blocks.restart'), cls: 'yellow', fn: restartCurrent },
        { label: T('gs.blocks.backCampaign'), cls: 'purple', fn: openLevelSelect }
      ]
    });
    return true;
  }

  /* ---------------- 主循环 ---------------- */
  function updateStep() {
    if (!g || g.over || paused) return;
    var dt = STEP_MS;
    g.elapsed += dt;

    if (g.clearAnim) {
      g.clearAnim.t += dt;
      updateParticles(dt);
      if (g.shake > 0) g.shake = Math.max(0, g.shake - dt / 70);
      if (g.clearAnim.t >= g.clearAnim.dur) finishClear();
      return;
    }
    if (!g.cur) return;

    if (g.mode === 'campaign') {
      var cfg = campaignCfg();
      if (cfg.obj === 'survive') {
        g.waveTimer -= dt;
        if (g.waveTimer <= 0) {
          g.waveTimer = cfg.waveEvery;
          sendGarbageToPlayer(cfg.waveRows);
        }
      }
      if (!g.checkAcc) g.checkAcc = 0;
      g.checkAcc += dt;
      if (g.checkAcc >= 300) {
        g.checkAcc = 0;
        checkCampaign();
        updateObjectiveHud();
        if (g.over) return;
      }
    }

    if (g.incomingCount > 0) {
      g.incomingTimer -= dt;
      if (g.incomingTimer <= 0) {
        var cnt = g.incomingCount;
        g.incomingCount = 0;
        if (!insertGarbage(g.board, cnt)) { gameOver('topout'); return; }
        g.shake = Math.max(g.shake, 5);
        g.garbageFlash = 1;
        if (Arcade.audio) Arcade.audio.play('garbage');
      }
    }

    if (g.softHeld) {
      g.softAcc += dt;
      while (g.softAcc >= SOFT_MS) {
        g.softAcc -= SOFT_MS;
        if (!softDropStep()) break;
      }
    }

    var gs = dropStep(g.level);
    g.gravityAcc += dt;
    var guard = 0;
    while (g.gravityAcc >= gs && guard < 20) {
      g.gravityAcc -= gs; guard++;
      if (!collides(g.cur.m, g.cur.x, g.cur.y + 1)) g.cur.y++;
      else break;
    }

    if (g.dasDir !== 0) {
      g.dasElapsed += dt;
      if (g.dasElapsed >= DAS_MS) {
        g.arrAcc += dt;
        while (g.arrAcc >= ARR_MS) {
          g.arrAcc -= ARR_MS;
          if (!tryShift(g.dasDir)) break;
        }
      }
    }

    if (g.cur && grounded()) {
      g.lockAcc += dt;
      if (g.lockAcc >= LOCK_MS) { lockPiece(); }
    } else if (g.cur) {
      g.lockAcc = 0;
    }

    if (g.mode === 'vs') updateAI(dt);
    updateParticles(dt);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt / 70);
    if (g.levelFx > 0) g.levelFx = Math.max(0, g.levelFx - dt / 900);
    if (g.garbageFlash > 0) g.garbageFlash = Math.max(0, g.garbageFlash - dt / 700);
    updateHud();
  }

  function updateParticles(dt) {
    if (!g || !g.particles.length) return;
    var step = dt / 1000;
    for (var i = g.particles.length - 1; i >= 0; i--) {
      var p = g.particles[i];
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 320 * step;
      p.life -= step * 1.6;
      if (p.life <= 0) g.particles.splice(i, 1);
    }
  }

  /* ---------------- 绘制 ---------------- */
  function shade(hex, amt) {
    if (hex.charAt(0) !== '#') return hex;
    var r = parseInt(hex.substr(1, 2), 16);
    var gg = parseInt(hex.substr(3, 2), 16);
    var b = parseInt(hex.substr(5, 2), 16);
    var f = amt < 0 ? 0 : 255;
    var p = Math.abs(amt);
    r = Math.round((f - r) * p + r);
    gg = Math.round((f - gg) * p + gg);
    b = Math.round((f - b) * p + b);
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }

  function drawCell(c, px, py, size, type, alpha, ghost) {
    var col = COLORS[type] || '#8890a0';
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;
    var inset = size > 12 ? 1.4 : 1;
    var x = px + inset, y = py + inset, s = size - inset * 2;
    if (ghost) {
      c.globalAlpha = 0.22;
      c.fillStyle = col;
      c.fillRect(x, y, s, s);
      c.globalAlpha = 0.6;
      c.strokeStyle = col;
      c.lineWidth = 1;
      c.strokeRect(x, y, s, s);
      c.restore();
      return;
    }
    var grd = c.createLinearGradient(x, y, x + s, y + s);
    grd.addColorStop(0, shade(col, 0.34));
    grd.addColorStop(0.55, col);
    grd.addColorStop(1, shade(col, -0.42));
    c.fillStyle = grd;
    c.fillRect(x, y, s, s);
    c.strokeStyle = col;
    c.lineWidth = size > 12 ? 1.5 : 1;
    c.shadowColor = col;
    c.shadowBlur = size > 12 ? 6 : 3;
    c.strokeRect(x, y, s, s);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,.30)';
    c.fillRect(x + s * 0.14, y + s * 0.14, s * 0.5, Math.max(1, s * 0.11));
    c.fillStyle = 'rgba(0,0,0,.20)';
    c.fillRect(x + s * 0.14, y + s - Math.max(2, s * 0.16), s * 0.72, Math.max(1, s * 0.08));
    c.restore();
  }

  function drawGrid(c, w, h, cell, color) {
    c.save();
    c.strokeStyle = color || 'rgba(120,160,220,.10)';
    c.lineWidth = 1;
    for (var x = cell; x < w; x += cell) {
      c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); c.stroke();
    }
    for (var y = cell; y < h; y += cell) {
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke();
    }
    c.restore();
  }

  function pieceCells(m) {
    var cells = [];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (m[r][c]) cells.push([c, r]);
    return cells;
  }

  function drawBoard() {
    if (!g) {
      ctx.clearRect(0, 0, BW, BH);
      ctx.fillStyle = '#07070d';
      ctx.fillRect(0, 0, BW, BH);
      drawGrid(ctx, BW, BH, CELL);
      return;
    }
    var shake = g.shake > 0 ? g.shake : 0;
    var sx = (Math.random() - 0.5) * shake;
    var sy = (Math.random() - 0.5) * shake;
    ctx.clearRect(0, 0, BW, BH);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#07070d';
    ctx.fillRect(-2, -2, BW + 4, BH + 4);
    drawGrid(ctx, BW, BH, CELL);

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var v = g.board[r][c];
        if (v) drawCell(ctx, c * CELL, r * CELL, CELL, v, 1, false);
      }
    }

    if (g.cur && !g.clearAnim) {
      var gy = g.cur.y;
      while (!collides(g.cur.m, g.cur.x, gy + 1)) gy++;
      var cells = pieceCells(g.cur.m);
      for (var i = 0; i < cells.length; i++) {
        var gx = (g.cur.x + cells[i][0]) * CELL;
        var gyy = (gy + cells[i][1]) * CELL;
        if (gy + cells[i][1] >= 0) drawCell(ctx, gx, gyy, CELL, g.cur.type, 1, true);
      }
      for (var j = 0; j < cells.length; j++) {
        var cx = (g.cur.x + cells[j][0]) * CELL;
        var cy = (g.cur.y + cells[j][1]) * CELL;
        if (g.cur.y + cells[j][1] >= 0) drawCell(ctx, cx, cy, CELL, g.cur.type, 1, false);
      }
    }

    if (g.clearAnim) {
      var flash = Math.sin(Math.PI * Math.min(1, g.clearAnim.t / g.clearAnim.dur));
      for (var k = 0; k < g.clearAnim.rows.length; k++) {
        var ry = g.clearAnim.rows[k];
        ctx.globalAlpha = 0.25 + flash * 0.75;
        var lg = ctx.createLinearGradient(0, ry * CELL, BW, ry * CELL);
        lg.addColorStop(0, 'rgba(255,255,255,.2)');
        lg.addColorStop(0.5, '#ffffff');
        lg.addColorStop(1, 'rgba(255,255,255,.2)');
        ctx.fillStyle = lg;
        ctx.fillRect(0, ry * CELL, BW, CELL);
      }
      ctx.globalAlpha = 1;
    }

    if (g.incomingCount > 0 && !g.clearAnim) {
      var warnRows = Math.min(g.incomingCount, 8);
      var pulse = 0.16 + 0.18 * (0.5 + 0.5 * Math.sin(Date.now() / 130));
      ctx.fillStyle = 'rgba(255,45,149,' + pulse.toFixed(3) + ')';
      ctx.fillRect(0, BH - warnRows * CELL, BW, warnRows * CELL);
      ctx.strokeStyle = 'rgba(255,45,149,.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(1, BH - warnRows * CELL + 1, BW - 2, warnRows * CELL - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff8fc4';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GARBAGE ' + g.incomingCount, BW / 2, BH - warnRows * CELL - 4);
      ctx.textAlign = 'left';
    }

    for (var p = 0; p < g.particles.length; p++) {
      var pt = g.particles[p];
      if (pt.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 5;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (g.levelFx > 0) {
      ctx.globalAlpha = g.levelFx * 0.8;
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(1, 1, BW - 2, BH - 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawVsBoard() {
    if (!g || !g.ai) return;
    vctx.clearRect(0, 0, VSW, VSH);
    vctx.fillStyle = '#07070d';
    vctx.fillRect(0, 0, VSW, VSH);
    drawGrid(vctx, VSW, VSH, CELL_VS, 'rgba(255,45,149,.08)');
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (g.ai.board[r][c]) drawCell(vctx, c * CELL_VS, r * CELL_VS, CELL_VS, g.ai.board[r][c], 1, false);
      }
    }
    if (g.ai.incomingCount > 0) {
      var wr = Math.min(g.ai.incomingCount, 8);
      vctx.fillStyle = 'rgba(255,45,149,.22)';
      vctx.fillRect(0, VSH - wr * CELL_VS, VSW, wr * CELL_VS);
    }
    if (g.ai.flash > 0) {
      vctx.globalAlpha = Math.max(0, g.ai.flash) * 0.28;
      vctx.fillStyle = '#ff2d95';
      vctx.fillRect(0, 0, VSW, VSH);
      vctx.globalAlpha = 1;
    }
  }

  function drawMiniPiece(c, type, left, top, w, h, cellSize, alpha) {
    var m = matrixFor(type, 0);
    var cells = pieceCells(m);
    var minX = 4, maxX = -1, minY = 4, maxY = -1;
    for (var i = 0; i < cells.length; i++) {
      minX = Math.min(minX, cells[i][0]); maxX = Math.max(maxX, cells[i][0]);
      minY = Math.min(minY, cells[i][1]); maxY = Math.max(maxY, cells[i][1]);
    }
    var pw = (maxX - minX + 1) * cellSize;
    var ph = (maxY - minY + 1) * cellSize;
    var ox = left + (w - pw) / 2 - minX * cellSize;
    var oy = top + (h - ph) / 2 - minY * cellSize;
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;
    for (var j = 0; j < cells.length; j++) {
      drawCell(c, ox + cells[j][0] * cellSize, oy + cells[j][1] * cellSize, cellSize, type, alpha == null ? 1 : alpha, false);
    }
    c.restore();
  }

  function drawNext() {
    nctx.clearRect(0, 0, NEXTW, NEXT_H_ITEM * 5 + 4);
    if (!g) return;
    for (var i = 0; i < 5; i++) {
      var t = g.queue[i];
      if (!t) continue;
      nctx.save();
      nctx.strokeStyle = 'rgba(185,103,255,.14)';
      nctx.strokeRect(0.5, i * NEXT_H_ITEM + 0.5, NEXTW - 1, NEXT_H_ITEM - 1);
      nctx.restore();
      drawMiniPiece(nctx, t, 0, i * NEXT_H_ITEM + 2, NEXTW, NEXT_H_ITEM - 4, 9, i === 0 ? 1 : 0.55);
    }
  }

  function drawHold() {
    hctx.clearRect(0, 0, 58, 56);
    if (!g || !g.hold) return;
    drawMiniPiece(hctx, g.hold, 0, 0, 58, 56, 12, g.canHold ? 1 : 0.45);
  }

  function draw() {
    drawBoard();
    if (g && g.mode === 'vs') drawVsBoard();
    else if (vctx) vctx.clearRect(0, 0, VSW, VSH);
  }

  /* ---------------- 输入 ---------------- */
  var dirHeld = { left: 0, right: 0 };
  var activePointers = {};

  function isPlaying() { return !!g && !g.over && !paused && !screenKind; }

  function pressDir(dir) {
    if (!g) return;
    if (dir === -1) dirHeld.left++;
    else dirHeld.right++;
    g.dasDir = dir;
    g.dasElapsed = 0;
    g.arrAcc = 0;
    tryShift(dir);
  }
  function releaseDir(dir) {
    if (!g) return;
    if (dir === -1) dirHeld.left = Math.max(0, dirHeld.left - 1);
    else dirHeld.right = Math.max(0, dirHeld.right - 1);
    if (g.dasDir !== dir) return;
    if (dirHeld.left > 0) { g.dasDir = -1; g.dasElapsed = 0; g.arrAcc = 0; }
    else if (dirHeld.right > 0) { g.dasDir = 1; g.dasElapsed = 0; g.arrAcc = 0; }
    else g.dasDir = 0;
  }

  function togglePause() {
    if (!g) { startEndless(); return; }
    if (screenKind === 'pause' || screenKind === 'resume') { resumeGame(); return; }
    if (screenKind) return;
    if (g.over) { restartCurrent(); return; }
    paused = true;
    writeSave();
    showPause();
  }

  function onKeyDown(e) {
    var code = e.code;
    if (code === 'KeyP' || code === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }
    if (code === 'Enter' && screenKind) {
      var first = scrBtns.querySelector('button');
      if (first) { e.preventDefault(); first.click(); }
      return;
    }
    if (!isPlaying()) return;
    var handled = true;
    if (code === 'ArrowLeft' || code === 'KeyA') {
      if (!e.repeat) pressDir(-1);
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      if (!e.repeat) pressDir(1);
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      if (!e.repeat) { g.softHeld = true; g.softAcc = 0; softDropStep(); }
    } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyX') {
      if (!e.repeat) tryRotate(1);
    } else if (code === 'KeyZ') {
      if (!e.repeat) tryRotate(-1);
    } else if (code === 'Space') {
      if (!e.repeat) hardDrop();
    } else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') {
      if (!e.repeat) holdSwap();
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  }
  function onKeyUp(e) {
    var code = e.code;
    if (code === 'ArrowLeft' || code === 'KeyA') releaseDir(-1);
    else if (code === 'ArrowRight' || code === 'KeyD') releaseDir(1);
    else if (code === 'ArrowDown' || code === 'KeyS') { if (g) g.softHeld = false; }
  }

  function touchAction(act) {
    if (!isPlaying()) return;
    if (act === 'left') pressDir(-1);
    else if (act === 'right') pressDir(1);
    else if (act === 'down') { g.softHeld = true; g.softAcc = 0; softDropStep(); }
    else if (act === 'rotate') tryRotate(1);
    else if (act === 'drop') hardDrop();
    else if (act === 'hold') holdSwap();
  }
  function touchRelease(act) {
    if (act === 'left') releaseDir(-1);
    else if (act === 'right') releaseDir(1);
    else if (act === 'down' && g) g.softHeld = false;
  }

  function setupInput() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    var btns = touchEl.querySelectorAll('[data-act]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (!isPlaying()) return;
          var act = btn.getAttribute('data-act');
          activePointers[e.pointerId] = { act: act, btn: btn };
          btn.classList.add('held');
          touchAction(act);
        });
        btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      })(btns[i]);
    }
    function endPointer(e) {
      var rec = activePointers[e.pointerId];
      if (!rec) return;
      delete activePointers[e.pointerId];
      rec.btn.classList.remove('held');
      touchRelease(rec.act);
    }
    document.addEventListener('pointerup', endPointer);
    document.addEventListener('pointercancel', endPointer);

    tabsEl.addEventListener('click', function (e) {
      var b = e.target;
      while (b && b !== tabsEl && !b.getAttribute) b = b.parentNode;
      if (!b || !b.getAttribute) return;
      var m = b.getAttribute('data-mode');
      if (!m) return;
      if (m === 'endless') startEndless();
      else if (m === 'vs') startVs();
      else if (m === 'campaign') openLevelSelect();
    });
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('restart-btn').addEventListener('click', restartCurrent);

    if ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0) {
      touchEl.style.display = 'grid';
    }
  }

  /* ---------------- 启动 / QA ---------------- */
  function setupSave() {
    if (!Arcade.savegame) return;
    Arcade.savegame.setup({
      id: 'blocks',
      collect: collectSave,
      apply: applySave
    });
  }

  function init() {
    setupInput();
    setupSave();
    gameLoop = Arcade.loop.start(updateStep, draw, STEP_MS);
    var resumed = false;
    if (Arcade.savegame) resumed = Arcade.savegame.resume();
    if (!resumed) startEndless();
  }

  if (QA) {
    window.__QA = {
      state: function () {
        if (!g) return null;
        return {
          mode: g.mode, score: g.score, lines: g.lines, level: g.level,
          combo: g.combo, b2b: g.b2b, tspins: g.tspins, pieces: g.pieces,
          elapsed: g.elapsed, paused: paused, over: g.over, screenKind: screenKind,
          queue: g.queue.slice(), hold: g.hold,
          incoming: g.incomingCount, campaignIndex: g.campaignIndex,
          aiLines: g.ai ? g.ai.lines : 0, aiOver: g.ai ? g.ai.over : null,
          clearAnim: !!g.clearAnim,
          cur: g.cur ? { type: g.cur.type, x: g.cur.x, y: g.cur.y, rot: g.cur.rot } : null,
          lockAcc: g.lockAcc, lockResets: g.lockResets,
          dasDir: g.dasDir, dasElapsed: g.dasElapsed
        };
      },
      start: function (m) {
        if (m === 'vs') startVs();
        else if (m === 'campaign') startCampaign(0, 0);
        else startEndless();
      },
      level: function (i) { startCampaign(i || 0, 0); },
      tick: function (ms) {
        var n = Math.min(800, Math.max(0, Math.round((ms || 1000) / STEP_MS)));
        for (var i = 0; i < n; i++) {
          if (!g || g.over) break;
          updateStep();
          draw();
        }
        updateHud();
        updateObjectiveHud();
      },
      tetris: function () {
        if (!g) return false;
        for (var r = ROWS - 4; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) g.board[r][c] = c === 9 ? 0 : 'J';
        }
        g.clearAnim = null;
        g.cur = { type: 'I', x: 7, y: 0, rot: 1, m: matrixFor('I', 1), lastRotate: true };
        g.lockAcc = 0;
        hardDrop();
        return true;
      },
      topout: function () { if (g) { g.cur = null; gameOver('topout'); } },
      winVs: function () { if (g && g.ai) aiTopOut(); },
      complete: function () {
        if (!g || g.mode !== 'campaign') return;
        var cfg = campaignCfg();
        if (cfg.obj === 'survive') {
          g.elapsed = cfg.seconds * 1000;
          g.lines = Math.max(g.lines, cfg.minLines || 0);
        } else if (cfg.obj === 'score') g.score = Math.max(g.score, cfg.target);
        else if (cfg.obj === 'tspin') g.tspins = Math.max(g.tspins, cfg.target);
        else g.lines = Math.max(g.lines, cfg.target);
        checkCampaign();
      },
      garbage: function (n) { if (g) sendGarbageToPlayer(n || 2); },
      drop: function () { if (g) hardDrop(); },
      hold: function () { if (g) holdSwap(); },
      move: function (d) { if (g) tryShift(d); },
      rotate: function () { if (g) tryRotate(1); },
      setPiece: function (type, x, y, rot) {
        if (!g) return false;
        if (TYPES.indexOf(type) < 0) type = 'T';
        var r = Math.max(0, Math.min(3, Number(rot) || 0));
        g.cur = {
          type: type, x: Number(x) || 0, y: Number(y) || 0, rot: r,
          m: matrixFor(type, r), lastRotate: false
        };
        g.lockAcc = 0;
        g.lockResets = 0;
        drawNext();
        draw();
        return true;
      },
      board: function () { return g ? cloneBoard(g.board) : null; },
      aiBoard: function () { return g && g.ai ? cloneBoard(g.ai.board) : null; }
    };
  }

  init();

})();
