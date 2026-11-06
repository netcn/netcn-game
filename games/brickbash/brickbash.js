/* ============================================================
   打砖块 · Brick Bash（旗舰版）
   难度选择 → 多关递进 → 清关动画 / 胜利或失败结算 → 重开 / 换难度
   机制：Boss 战、移动砖 / 钢砖、道具树（加宽 / 多球 / 慢速 / 激光 / 护盾）、连击、随关卡加速
   视觉：渐变挡板 / 径向渐变球 + 拖尾 / 血量砖块 / 碎屑粒子 / 星空网格
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var W = 400, H = 520;
  var BALL_R = 6;
  var PADDLE_Y = H - 40;
  var PADDLE_H = 12;
  var BASE_PADDLE_W = 78;
  var KEY_SPEED = 7;
  var MAX_BOUNCE = Math.PI / 3;      /* 挡板边缘最大 60° */
  var MAX_BALLS = 8;
  var BRICK_TOP = 54;
  var BRICK_H = 18;
  var BRICK_MX = 12;
  var BRICK_GAP = 5;
  var CLEAR_FRAMES = 132;
  var GAME_ID = document.body.getAttribute('data-game-id') || 'brickbash';

  var DIFFS = [
    { key: 'Easy', levels: 3, rows: 4, cols: 7, speed: 4.2, lives: 3, drop: 0.17, bonus: 90, bossHp: 8,
      patterns: ['full', 'pyramid', 'checker'] },
    { key: 'Normal', levels: 4, rows: 5, cols: 8, speed: 4.7, lives: 3, drop: 0.14, bonus: 120, bossHp: 12,
      patterns: ['full', 'diamond', 'pyramid', 'checker'] },
    { key: 'Hard', levels: 5, rows: 6, cols: 9, speed: 5.1, lives: 2, drop: 0.12, bonus: 160, bossHp: 16,
      patterns: ['full', 'pyramid', 'checker', 'diamond', 'fortress'] }
  ];

  /* hp → 渐变 / 描边配色 */
  var PALETTE = [
    { main: '#00f0ff', light: '#b9fbff', dark: '#045865', edge: '#8ff9ff' },
    { main: '#ff2d95', light: '#ffb3d8', dark: '#6d0a3f', edge: '#ff9dd3' },
    { main: '#ffe600', light: '#fff7ad', dark: '#6b5f00', edge: '#fff59a' }
  ];

  /* 道具树：类型 → 颜色 / 掉落字母 / 稀有度权重 */
  var PU_STYLE = {
    wide: { color: '#00f0ff', letter: 'W' },
    multi: { color: '#ff2d95', letter: 'M' },
    slow: { color: '#39ff14', letter: 'S' },
    laser: { color: '#ffe600', letter: 'L' },
    shield: { color: '#8f7dff', letter: 'G' }
  };
  var PU_TREE = [
    { type: 'wide', weight: 30 },
    { type: 'multi', weight: 22 },
    { type: 'slow', weight: 20 },
    { type: 'laser', weight: 18 },
    { type: 'shield', weight: 10 }
  ];
  var BOSS_Y = 240;
  var BOSS_H = 30;
  var BOSS_W = 150;

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.brickbash.tut1t'), d: T('gs.brickbash.tut1') },
    { t: T('gs.brickbash.tut2t'), d: T('gs.brickbash.tut2') },
    { t: T('gs.brickbash.tut3t'), d: T('gs.brickbash.tut3') }
  ];

  var diffHtml = '';
  DIFFS.forEach(function (d, i) {
    diffHtml +=
      '<button class="btn mode-btn bb-diff-btn" data-d="' + i + '">' +
      '<b>' + T('gs.brickbash.diff' + d.key) + '</b>' +
      '<small>' + T('gs.brickbash.diff' + d.key + 'D') + '</small>' +
      '</button>';
  });

  root.innerHTML =
    '<div class="bb-wrap">' +
    '  <div class="bb-pick" id="bb-pick">' +
    '    <div class="bb-pick-t">' + T('gs.brickbash.pickTitle') + '</div>' +
    '    <div class="bb-pick-d">' + T('gs.brickbash.pickDesc') + '</div>' +
    '    <div class="bb-pick-btns">' + diffHtml + '</div>' +
    '  </div>' +
    '  <div class="bb-game hidden" id="bb-game">' +
    '    <div class="bb-hud">' +
    '      <span class="bb-stat"><i>' + T('gs.brickbash.hudScore') + '</i><b id="score">0</b></span>' +
    '      <span class="bb-stat"><i>' + T('gs.brickbash.hudLives') + '</i><b id="lives" class="bb-lives"></b></span>' +
    '      <span class="bb-stat"><i>' + T('gs.brickbash.hudLevel') + '</i><b id="level">1/3</b></span>' +
    '      <span class="bb-stat bb-shield-stat"><i>' + T('gs.brickbash.hudShield') + '</i><b id="shield-ind" class="off">' + T('gs.brickbash.shieldOff') + '</b></span>' +
    '      <span class="bb-stat bb-combo off" id="combo-wrap"><i>' + T('gs.brickbash.hudCombo') + '</i><b id="combo">—</b></span>' +
    '    </div>' +
    '    <div class="game-message" id="msg">' + T('gs.brickbash.msgStart') + '</div>' +
    '    <div class="brickbash-stage" id="bb-stage">' +
    '      <canvas id="cv" class="game-canvas bb-canvas"></canvas>' +
    '      <div class="bb-banner" id="bb-banner" aria-live="polite"></div>' +
    '      <div class="bb-pause hidden" id="bb-pause">' +
    '        <div class="bb-card bb-card-sm">' +
    '          <div class="bb-card-title">' + T('gs.brickbash.pauseTitle') + '</div>' +
    '          <div class="bb-card-sub">' + T('gs.brickbash.pauseHint') + '</div>' +
    '          <button class="btn green" id="resume-btn">' + T('gs.brickbash.resume') + '</button>' +
    '          <button class="btn" id="pause-restart-btn">' + T('gs.brickbash.btnRestart') + '</button>' +
    '        </div>' +
    '      </div>' +
    '      <div class="game-overlay bb-result" id="overlay" hidden>' +
    '        <div class="bb-card">' +
    '          <div class="ov-title" id="ov-title">' + T('gs.brickbash.ovTitle') + '</div>' +
    '          <div class="bb-final-score"><b id="final-score">0</b><small>' + T('gs.brickbash.hudScore') + '</small></div>' +
    '          <div class="bb-result-grid">' +
    '            <div><span>' + T('gs.brickbash.finalLevel') + '</span><b id="final-level">1/3</b></div>' +
    '            <div><span>' + T('gs.brickbash.hudBest') + '</span><b id="best">0</b></div>' +
    '          </div>' +
    '          <div class="ov-record" id="ov-record"></div>' +
    '          <button id="restart-btn" class="btn green">' + T('gs.brickbash.btnRestart') + '</button>' +
    '          <button id="change-btn" class="btn purple">' + T('gs.brickbash.btnChangeDiff') + '</button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="bb-controls">' +
    '      <button id="pause-btn" class="btn" aria-label="' + T('gs.brickbash.pause') + '">' + T('gs.brickbash.pause') + '</button>' +
    '      <button id="launch-btn" class="btn yellow">' + T('gs.brickbash.btnLaunch') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<p class="help-text">' + T('gs.brickbash.help') + '</p>';

  var cv = document.getElementById('cv');
  var ctx;
  if (window.GK) {
    ctx = GK.setup(cv, W, H).ctx;
  } else {
    cv.width = W;
    cv.height = H;
    ctx = cv.getContext('2d');
    if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(cv);
  }
  cv.style.width = '100%';
  cv.style.height = 'auto';
  cv.style.maxWidth = '100%';

  var pickEl = document.getElementById('bb-pick');
  var gameEl = document.getElementById('bb-game');
  var stageEl = document.getElementById('bb-stage');
  var bannerEl = document.getElementById('bb-banner');
  var pauseEl = document.getElementById('bb-pause');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ov-title');
  var finalScoreEl = document.getElementById('final-score');
  var finalLevelEl = document.getElementById('final-level');
  var bestEl = document.getElementById('best');
  var recordEl = document.getElementById('ov-record');
  var scoreEl = document.getElementById('score');
  var livesEl = document.getElementById('lives');
  var levelEl = document.getElementById('level');
  var comboEl = document.getElementById('combo');
  var comboWrap = document.getElementById('combo-wrap');
  var shieldInd = document.getElementById('shield-ind');
  var msgEl = document.getElementById('msg');

  var state = null;
  var loopApi = null;
  var bannerTimer = null;
  var keys = { left: false, right: false };
  var paddle = { x: W / 2, w: BASE_PADDLE_W, h: PADDLE_H, y: PADDLE_Y, baseW: BASE_PADDLE_W };

  /* 背景星空（只生成一次，重开不重建） */
  var stars = [];
  for (var si = 0; si < 56; si++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      spd: 0.6 + Math.random() * 1.6
    });
  }

  /* ---------- 小工具 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function audio(name) { if (window.Arcade && Arcade.audio) Arcade.audio.play(name); }
  function shake() { if (window.Arcade && Arcade.fx && stageEl) Arcade.fx.shake(stageEl); }
  function fxAt(x, y, color, count) {
    if (window.GK && GK.burst) GK.burst(cv, x, y, color, count);
    else if (window.Arcade && Arcade.fx) {
      var r = cv.getBoundingClientRect();
      Arcade.fx.burst(r.left + x * (r.width / W), r.top + y * (r.height / H), color, count);
    }
  }
  function bestScore() {
    try {
      if (window.Arcade && Arcade.storage && Arcade.storage.getBest) {
        var v = Arcade.storage.getBest(GAME_ID);
        return v === null || isNaN(Number(v)) ? 0 : Number(v);
      }
    } catch (e) {}
    return 0;
  }
  function setMsg(text, color) {
    if (!msgEl) return;
    msgEl.innerHTML = text || '';
    msgEl.style.color = color || '';
  }
  function roundRect(x, y, w, h, r) {
    if (window.GK) { GK.roundRect(ctx, x, y, w, h, r); return; }
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function pointerPos(ev) {
    if (window.GK && GK.pointer) return GK.pointer(cv, ev);
    var r = cv.getBoundingClientRect();
    var t = (ev.touches && ev.touches[0]) || ev;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }
  function showBanner(main, sub, color, ms) {
    if (!bannerEl) return;
    bannerEl.style.color = color || 'var(--neon-yellow)';
    bannerEl.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bannerEl.classList.remove('show'); }, ms || 1800);
  }
  function clearBanner() {
    if (bannerEl) bannerEl.classList.remove('show');
    clearTimeout(bannerTimer);
  }

  function updateHud() {
    if (!state) return;
    scoreEl.textContent = String(state.score);
    var hearts = '';
    var maxLives = state.conf.lives;
    for (var i = 0; i < maxLives; i++) {
      hearts += '<i class="bb-heart ' + (i < state.lives ? 'on' : 'off') + '"></i>';
    }
    livesEl.innerHTML = hearts;
    levelEl.textContent = state.level + '/' + state.conf.levels;
    if (shieldInd) {
      shieldInd.textContent = state.shield ? T('gs.brickbash.shieldOn') : T('gs.brickbash.shieldOff');
      shieldInd.classList.toggle('on', !!state.shield);
      shieldInd.classList.toggle('off', !state.shield);
    }
    var mult = comboMult();
    if (comboEl) comboEl.textContent = state.combo >= 2 ? '×' + mult : '—';
    if (comboWrap) {
      if (state.combo >= 2) comboWrap.classList.remove('off');
      else comboWrap.classList.add('off');
    }
  }
  function comboMult() {
    if (!state) return 1;
    return Math.min(5, 1 + Math.floor(Math.max(0, state.combo - 1) / 4));
  }

  /* ---------- 关卡数据 ---------- */
  function maskBrick(pattern, r, c, rows, cols) {
    if (pattern === 'pyramid') {
      var inset = Math.floor(r * (cols - 3) / (2 * rows));
      return c >= inset && c < cols - inset;
    }
    if (pattern === 'checker') return ((r + c) % 2 === 0) || r === 0;
    if (pattern === 'diamond') {
      var cr = (rows - 1) / 2, cc = (cols - 1) / 2;
      return Math.abs(c - cc) / (cc || 1) + Math.abs(r - cr) / (cr || 1) <= 1.05;
    }
    if (pattern === 'fortress') {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) return true;
      return (r + c) % 2 === 0;
    }
    return true;
  }

  function brickHp(r, c, level, diff) {
    var hp = 1;
    if (level >= 2 && r === 0) hp++;
    if (level >= 3 && r === 1) hp++;
    if (diff === 2 && level >= 4 && (r + c) % 4 === 0) hp++;
    return Math.min(3, hp);
  }

  function buildBricks() {
    var conf = state.conf;
    var pattern = conf.patterns[state.level - 1] || 'full';
    var rows = Math.min(7, conf.rows + (state.level >= 3 ? 1 : 0));
    var cols = conf.cols;
    var bw = (W - BRICK_MX * 2 - BRICK_GAP * (cols - 1)) / cols;
    var bricks = [];
    var alive = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (!maskBrick(pattern, r, c, rows, cols)) continue;
        var steel = state.level >= 3 && ((r * 5 + c * 3) % 11 === 4);
        var hp = steel ? 0 : brickHp(r, c, state.level, state.diff);
        var bx = BRICK_MX + c * (bw + BRICK_GAP);
        var moving = !steel && state.level >= 2 && ((r * cols + c) % 6 === 1);
        bricks.push({
          x: bx,
          baseX: bx,
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: bw,
          h: BRICK_H,
          hp: hp,
          maxHp: hp,
          steel: steel,
          move: moving,
          amp: moving ? 5 + (r % 3) * 1.5 : 0,
          mSpeed: moving ? 0.018 + (c % 3) * 0.006 : 0,
          mPhase: moving ? r * 1.3 + c * 0.7 : 0,
          flash: 0,
          dead: false,
          color: steel ? '#cbd6ea' : PALETTE[Math.max(0, hp - 1)].main
        });
        if (!steel) alive++;
      }
    }
    state.bricks = bricks;
    state.alive = alive;
    state.boss = null;
    if (state.level === conf.levels) {
      var bhp = conf.bossHp || 8;
      state.boss = {
        x: W / 2 - BOSS_W / 2,
        y: BOSS_Y,
        w: BOSS_W,
        h: BOSS_H,
        hp: bhp,
        maxHp: bhp,
        vx: (Math.random() < 0.5 ? -1 : 1) * (1.0 + state.diff * 0.35),
        flash: 0,
        dead: false,
        hzT: 90,
        phase: Math.random() * 6
      };
    }
  }

  function stuckBall() {
    return {
      x: paddle.x,
      y: paddle.y - BALL_R - 2,
      vx: 0, vy: 0,
      r: BALL_R,
      stuck: true,
      lost: false,
      trail: []
    };
  }

  function ballSpeed() {
    return Math.min(8.2, state.conf.speed + (state.level - 1) * 0.5);
  }

  function setupLevel() {
    paddle.w = BASE_PADDLE_W;
    paddle.x = W / 2;
    state.combo = 0;
    state.comboT = 0;
    state.wideT = 0;
    state.slowT = 0;
    state.laserT = 0;
    state.laserCd = 0;
    state.shield = false;
    state.beams = [];
    state.hazards = [];
    state.powerups = [];
    state.particles = [];
    state.shocks = [];
    state.balls = [stuckBall()];
    state.clearing = false;
    state.clearT = 0;
    buildBricks();
    updateHud();
  }

  function startGame(diffIdx) {
    var conf = DIFFS[diffIdx] || DIFFS[0];
    state = {
      diff: diffIdx,
      conf: conf,
      level: 1,
      score: 0,
      lives: conf.lives,
      combo: 0,
      comboT: 0,
      frame: 0,
      paused: false,
      over: false,
      won: false,
      submitted: false,
      clearing: false,
      clearT: 0,
      wideT: 0,
      slowT: 0,
      laserT: 0,
      laserCd: 0,
      shield: false,
      beams: [],
      hazards: [],
      boss: null,
      bricks: [],
      balls: [],
      powerups: [],
      particles: [],
      shocks: [],
      alive: 0
    };
    paddle = { x: W / 2, w: BASE_PADDLE_W, h: PADDLE_H, y: PADDLE_Y, baseW: BASE_PADDLE_W };
    keys.left = false;
    keys.right = false;
    pickEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    overlay.hidden = true;
    pauseEl.classList.add('hidden');
    clearBanner();
    setupLevel();
    setMsg(T('gs.brickbash.levelStart').replace('{n}', 1) + ' · ' + T('gs.brickbash.msgStart'), '');
    if (state.boss) showBanner(T('gs.brickbash.bossTitle'), T('gs.brickbash.bossHint'), 'var(--neon-pink)', 1800);
    else showBanner(T('gs.brickbash.levelStart').replace('{n}', 1), T('gs.brickbash.msgStart'), 'var(--neon-cyan)', 1500);
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    audio('ui');
  }

  function openPicker() {
    state = null;
    pickEl.classList.remove('hidden');
    gameEl.classList.add('hidden');
    overlay.hidden = true;
    pauseEl.classList.add('hidden');
    clearBanner();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  /* ---------- 输入 ---------- */
  function setPaddleX(x) {
    paddle.x = clamp(x, paddle.w / 2, W - paddle.w / 2);
    syncStuck();
  }
  function syncStuck() {
    if (!state) return;
    for (var i = 0; i < state.balls.length; i++) {
      var b = state.balls[i];
      if (b.stuck) {
        b.x = paddle.x;
        b.y = paddle.y - b.r - 2;
      }
    }
  }

  function launch() {
    if (!state || state.over || state.paused || state.clearing) return false;
    var launched = false;
    for (var i = 0; i < state.balls.length; i++) {
      var b = state.balls[i];
      if (!b.stuck) continue;
      var a = (Math.random() - 0.5) * 0.7;
      var sp = ballSpeed();
      b.vx = Math.sin(a) * sp;
      b.vy = -Math.cos(a) * sp;
      b.stuck = false;
      b.trail = [];
      launched = true;
      spawnParticles(b.x, b.y, '#00f0ff', 8);
      audio('drop');
    }
    if (launched) setMsg('');
    return launched;
  }

  function togglePause(force) {
    if (!state || state.over) return;
    var p = (force === undefined) ? !state.paused : !!force;
    if (p === state.paused) return;
    state.paused = p;
    if (pauseEl) pauseEl.classList.toggle('hidden', !p);
    if (p) {
      setMsg(T('gs.brickbash.paused'), 'var(--neon-yellow)');
    } else {
      var anyStuck = false;
      for (var i = 0; i < state.balls.length; i++) if (state.balls[i].stuck) anyStuck = true;
      setMsg(state.clearing ? '' : (anyStuck ? T('gs.brickbash.msgStart') : ''));
    }
    audio('ui');
  }

  function onAction() {
    if (!state || state.over) return;
    if (state.paused) { togglePause(false); return; }
    if (state.clearing) return;
    var anyStuck = false;
    for (var i = 0; i < state.balls.length; i++) if (state.balls[i].stuck) anyStuck = true;
    if (anyStuck) launch();
    else togglePause(true);
  }

  cv.addEventListener('pointermove', function (e) {
    if (!state || state.over || state.paused || state.clearing) return;
    var pos = pointerPos(e);
    setPaddleX(pos.x);
  });
  cv.addEventListener('pointerdown', function (e) {
    if (!state || state.over) return;
    e.preventDefault();
    if (state.paused) { togglePause(false); return; }
    if (state.clearing) return;
    var pos = pointerPos(e);
    setPaddleX(pos.x);
  });
  cv.addEventListener('pointerup', function () {
    if (!state || state.over || state.paused || state.clearing) return;
    launch();
  });

  window.addEventListener('keydown', function (e) {
    if (!state) return;
    var code = e.code;
    if (code === 'Space' || code === 'Enter') {
      if (state.over) return;
    }
    if (code === 'ArrowLeft' || code === 'KeyA') { keys.left = true; e.preventDefault(); return; }
    if (code === 'ArrowRight' || code === 'KeyD') { keys.right = true; e.preventDefault(); return; }
    if (code === 'Space' || code === 'Enter') {
      if (e.repeat) return;
      e.preventDefault();
      onAction();
      return;
    }
    if (code === 'KeyP') { e.preventDefault(); togglePause(); }
  });
  window.addEventListener('keyup', function (e) {
    var code = e.code;
    if (code === 'ArrowLeft' || code === 'KeyA') keys.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') keys.right = false;
  });
  window.addEventListener('blur', function () {
    keys.left = false;
    keys.right = false;
  });

  var diffBtns = pickEl.querySelectorAll('button[data-d]');
  for (var bi = 0; bi < diffBtns.length; bi++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        startGame(parseInt(btn.getAttribute('data-d'), 10));
      });
    })(diffBtns[bi]);
  }
  document.getElementById('restart-btn').addEventListener('click', function () {
    startGame(state ? state.diff : 0);
  });
  document.getElementById('change-btn').addEventListener('click', openPicker);
  document.getElementById('resume-btn').addEventListener('click', function () { togglePause(false); });
  document.getElementById('pause-restart-btn').addEventListener('click', function () {
    startGame(state ? state.diff : 0);
  });
  document.getElementById('pause-btn').addEventListener('click', function () { togglePause(); });
  document.getElementById('launch-btn').addEventListener('click', function () {
    if (!state || state.over || state.paused || state.clearing) return;
    launch();
  });

  /* ---------- 物理 / 逻辑 ---------- */
  function spawnParticles(x, y, color, count) {
    if (!state) return;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 0.8 + Math.random() * 3.2;
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.5,
        life: 1,
        decay: 0.018 + Math.random() * 0.018,
        size: 1.4 + Math.random() * 2.4,
        color: color
      });
    }
    if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
  }
  function addShock(x, y, color, maxR) {
    if (!state) return;
    state.shocks.push({ x: x, y: y, r: 4, maxR: maxR || 60, life: 1, color: color || '#00f0ff' });
  }

  function updateParticles() {
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.vx *= 0.985;
      p.life -= p.decay;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (var s = state.shocks.length - 1; s >= 0; s--) {
      var sh = state.shocks[s];
      sh.r += (sh.maxR - sh.r) * 0.11 + 0.8;
      sh.life -= 0.035;
      if (sh.life <= 0) state.shocks.splice(s, 1);
    }
    for (var b = 0; b < state.bricks.length; b++) {
      if (state.bricks[b].flash > 0) state.bricks[b].flash--;
    }
  }

  function dropPowerup(x, y) {
    var total = 0, i, acc = 0, type = PU_TREE[0].type;
    for (i = 0; i < PU_TREE.length; i++) total += PU_TREE[i].weight;
    var roll = Math.random() * total;
    for (i = 0; i < PU_TREE.length; i++) {
      acc += PU_TREE[i].weight;
      if (roll < acc) { type = PU_TREE[i].type; break; }
    }
    state.powerups.push({ x: x, y: y, w: 22, h: 18, vy: 1.7, type: type, dead: false, phase: Math.random() * 6 });
  }

  function catchPowerup(it) {
    it.dead = true;
    state.score += 30;
    var style = PU_STYLE[it.type] || PU_STYLE.wide;
    var col = style.color;
    if (it.type === 'wide') {
      state.wideT = 720;
      paddle.w = BASE_PADDLE_W * 1.65;
      setPaddleX(paddle.x);
      setMsg(T('gs.brickbash.puWide'), col);
    } else if (it.type === 'multi') {
      var src = null;
      for (var i = 0; i < state.balls.length; i++) {
        if (!state.balls[i].stuck && !state.balls[i].lost) { src = state.balls[i]; break; }
      }
      if (!src && state.balls.length) {
        src = state.balls[0];
        src.stuck = false;
        var sp0 = ballSpeed();
        src.vx = 0;
        src.vy = -sp0;
      }
      if (src) {
        var ang = Math.atan2(src.vy, src.vx);
        var sp = Math.sqrt(src.vx * src.vx + src.vy * src.vy) || ballSpeed();
        addBall(src.x, src.y, Math.cos(ang + 0.46) * sp, Math.sin(ang + 0.46) * sp);
        addBall(src.x, src.y, Math.cos(ang - 0.46) * sp, Math.sin(ang - 0.46) * sp);
      }
      setMsg(T('gs.brickbash.puMulti'), col);
    } else if (it.type === 'laser') {
      state.laserT = 480;
      state.laserCd = 0;
      setMsg(T('gs.brickbash.puLaser'), col);
    } else if (it.type === 'shield') {
      state.shield = true;
      setMsg(T('gs.brickbash.puShield'), col);
    } else {
      state.slowT = 600;
      setMsg(T('gs.brickbash.puSlow'), col);
    }
    spawnParticles(it.x, it.y, col, 14);
    addShock(it.x, it.y, col, 46);
    fxAt(it.x, it.y, col, 10);
    audio('coin');
    updateHud();
  }

  function addBall(x, y, vx, vy) {
    if (!state || state.balls.length >= MAX_BALLS) return;
    state.balls.push({ x: x, y: y, vx: vx, vy: vy, r: BALL_R, stuck: false, lost: false, trail: [] });
  }

  function updatePowerups() {
    for (var i = state.powerups.length - 1; i >= 0; i--) {
      var it = state.powerups[i];
      if (it.dead) { state.powerups.splice(i, 1); continue; }
      it.y += it.vy;
      if (it.y + it.h / 2 >= paddle.y && it.y - it.h / 2 <= paddle.y + paddle.h &&
          Math.abs(it.x - paddle.x) <= paddle.w / 2 + it.w / 2) {
        catchPowerup(it);
        state.powerups.splice(i, 1);
        continue;
      }
      if (it.y > H + 16) state.powerups.splice(i, 1);
    }
  }

  function hitBrick(b, ball) {
    b.hp--;
    b.flash = 8;
    state.combo++;
    state.comboT = 110;
    var mult = comboMult();
    var gain = (b.maxHp >= 3 ? 18 : (b.maxHp === 2 ? 14 : 10)) * mult;
    state.score += gain;
    if (b.hp <= 0) {
      b.dead = true;
      state.alive--;
      state.score += 5 * state.level;
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 12);
      addShock(b.x + b.w / 2, b.y + b.h / 2, b.color, 38);
      fxAt(b.x + b.w / 2, b.y + b.h / 2, b.color, 6);
      audio('match');
      if (state.alive > 0 && Math.random() < state.conf.drop + (state.level >= 3 ? 0.02 : 0)) {
        dropPowerup(b.x + b.w / 2, b.y + b.h / 2);
      }
      if (state.alive <= 0) maybeLevelClear(b.x + b.w / 2, b.y + b.h / 2);
    } else {
      spawnParticles(ball.x, ball.y, b.color, 6);
      audio('type');
    }
    updateHud();
  }

  function collideBrick(ball) {
    for (var i = 0; i < state.bricks.length; i++) {
      var b = state.bricks[i];
      if (b.dead) continue;
      if (ball.x + ball.r <= b.x || ball.x - ball.r >= b.x + b.w) continue;
      if (ball.y + ball.r <= b.y || ball.y - ball.r >= b.y + b.h) continue;
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      var overlapX = (ball.r + b.w / 2) - Math.abs(ball.x - cx);
      var overlapY = (ball.r + b.h / 2) - Math.abs(ball.y - cy);
      if (overlapX < overlapY) {
        ball.x = ball.x < cx ? b.x - ball.r : b.x + b.w + ball.r;
        ball.vx = -ball.vx;
      } else {
        ball.y = ball.y < cy ? b.y - ball.r : b.y + b.h + ball.r;
        ball.vy = -ball.vy;
      }
      if (b.steel) {
        b.flash = 6;
        spawnParticles(ball.x, ball.y, '#e6f3ff', 7);
        addShock(ball.x, ball.y, '#b9fbff', 30);
        audio('move');
        return true;
      }
      hitBrick(b, ball);
      return true;
    }
    return false;
  }

  function collideBoss(ball) {
    var b = state.boss;
    if (!b || b.dead) return false;
    if (ball.x + ball.r <= b.x || ball.x - ball.r >= b.x + b.w) return false;
    if (ball.y + ball.r <= b.y || ball.y - ball.r >= b.y + b.h) return false;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var overlapX = (ball.r + b.w / 2) - Math.abs(ball.x - cx);
    var overlapY = (ball.r + b.h / 2) - Math.abs(ball.y - cy);
    if (overlapX < overlapY) {
      ball.x = ball.x < cx ? b.x - ball.r : b.x + b.w + ball.r;
      ball.vx = -ball.vx;
    } else {
      ball.y = ball.y < cy ? b.y - ball.r : b.y + b.h + ball.r;
      ball.vy = -ball.vy;
    }
    damageBoss(1, ball.x, ball.y);
    return true;
  }

  function damageBoss(n, px, py) {
    var b = state && state.boss;
    if (!b || b.dead) return false;
    var dmg = Math.max(1, Math.floor(n || 1));
    b.hp -= dmg;
    b.flash = 14;
    state.score += 25 * dmg;
    spawnParticles(px || b.x + b.w / 2, py || b.y + b.h / 2, '#ff2d95', 10);
    addShock(px || b.x + b.w / 2, py || b.y + b.h / 2, '#ff2d95', 42);
    audio('type');
    if (b.hp <= 0) {
      b.hp = 0;
      b.dead = true;
      bossDeath();
    }
    updateHud();
    return true;
  }

  function bossDeath() {
    var b = state.boss;
    if (!b) return;
    var bonus = state.conf.bonus * 4;
    state.score += bonus;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    spawnParticles(cx, cy, '#ffe600', 46);
    spawnParticles(cx, cy, '#ff2d95', 34);
    addShock(cx, cy, '#ffe600', 150);
    addShock(cx, cy, '#ff2d95', 110);
    fxAt(cx, cy, '#ffe600', 22);
    if (window.Arcade && Arcade.fx) {
      Arcade.fx.centerBurst('var(--neon-pink)', 18);
      Arcade.fx.flash('rgba(255,45,149,0.4)');
    }
    showBanner(T('gs.brickbash.bossDown'), T('gs.brickbash.bossBonus').replace('{n}', bonus), 'var(--neon-pink)', 1900);
    audio('clear');
    shake();
    updateHud();
    maybeLevelClear(cx, cy);
  }

  function collidePaddle(ball) {
    if (ball.vy <= 0) return false;
    if (ball.y + ball.r < paddle.y) return false;
    if (ball.y - ball.r > paddle.y + paddle.h) return false;
    if (Math.abs(ball.x - paddle.x) > paddle.w / 2 + ball.r) return false;
    var p = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
    var angle = p * MAX_BOUNCE;
    var sp = ballSpeed();
    ball.vx = Math.sin(angle) * sp;
    ball.vy = -Math.cos(angle) * sp;
    ball.y = paddle.y - ball.r;
    spawnParticles(ball.x, paddle.y, '#00f0ff', 5);
    audio('move');
    return true;
  }

  function collideWalls(ball) {
    if (ball.x < ball.r) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
      if (state.frame % 5 === 0) audio('move');
    } else if (ball.x > W - ball.r) {
      ball.x = W - ball.r;
      ball.vx = -Math.abs(ball.vx);
      if (state.frame % 5 === 0) audio('move');
    }
    if (ball.y < ball.r) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
      if (state.frame % 5 === 0) audio('move');
    }
  }

  function updateBall(ball) {
    if (ball.stuck || ball.lost) return;
    var slow = state.slowT > 0 ? 0.72 : 1;
    var steps = 3;
    for (var s = 0; s < steps; s++) {
      ball.x += ball.vx * slow / steps;
      ball.y += ball.vy * slow / steps;
      collideWalls(ball);
      collidePaddle(ball);
      if (collideBrick(ball)) break;
      if (collideBoss(ball)) break;
      if (state.clearing) return;
      if (ball.y - ball.r > H) {
        if (state.shield) {
          state.shield = false;
          ball.x = paddle.x;
          ball.y = paddle.y - ball.r - 2;
          ball.vx = (Math.random() - 0.5) * 2;
          ball.vy = -ballSpeed();
          ball.trail = [];
          spawnParticles(ball.x, paddle.y, '#8f7dff', 18);
          addShock(ball.x, paddle.y, '#8f7dff', 66);
          setMsg(T('gs.brickbash.shieldBreak'), '#8f7dff');
          audio('coin');
          updateHud();
          return;
        }
        ball.lost = true;
        return;
      }
    }
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 11) ball.trail.shift();
  }

  function updateBalls() {
    for (var i = 0; i < state.balls.length; i++) updateBall(state.balls[i]);
    var keep = [];
    for (var j = 0; j < state.balls.length; j++) {
      if (!state.balls[j].lost) keep.push(state.balls[j]);
    }
    state.balls = keep;
    if (state.balls.length === 0 && !state.clearing && !state.over) loseLife();
  }

  function resetToServe() {
    state.balls = [stuckBall()];
    state.combo = 0;
    state.comboT = 0;
    updateHud();
  }

  function loseLife() {
    if (!state || state.clearing || state.over) return;
    state.lives--;
    state.wideT = 0;
    state.slowT = 0;
    state.laserT = 0;
    state.laserCd = 0;
    state.shield = false;
    state.hazards = [];
    paddle.w = BASE_PADDLE_W;
    setPaddleX(paddle.x);
    state.powerups = [];
    spawnParticles(paddle.x, paddle.y + 8, '#ff2d95', 24);
    aggregateShock(paddle.x, paddle.y, '#ff2d95');
    state.combo = 0;
    state.comboT = 0;
    if (state.lives <= 0) {
      state.lives = 0;
      updateHud();
      if (window.Arcade && Arcade.juice) Arcade.juice.lose();
      else { audio('lose'); shake(); }
      shake();
      endGame(false);
      return;
    }
    updateHud();
    resetToServe();
    setMsg(T('gs.brickbash.livesLeft').replace('{n}', state.lives), 'var(--neon-pink)');
    audio('lose');
    shake();
  }

  function aggregateShock(x, y, color) {
    addShock(x, y, color, 80);
  }

  function maybeLevelClear(x, y) {
    if (!state || state.clearing) return;
    if (state.alive > 0) return;
    if (state.boss && !state.boss.dead) return;
    beginLevelClear(x, y);
  }

  function updateBricksMove() {
    for (var i = 0; i < state.bricks.length; i++) {
      var b = state.bricks[i];
      if (!b.move || b.dead) continue;
      b.x = b.baseX + Math.sin(state.frame * b.mSpeed + b.mPhase) * b.amp;
    }
  }

  function updateBoss(dt) {
    var b = state.boss;
    if (!b || b.dead) return;
    var f = dt || 1;
    b.x += b.vx * f;
    if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx); }
    else if (b.x + b.w > W - 10) { b.x = W - 10 - b.w; b.vx = -Math.abs(b.vx); }
    if (b.flash > 0) b.flash -= f;
    b.hzT -= f;
    if (b.hzT <= 0) {
      b.hzT = 120 + Math.random() * 60;
      var hx = b.x + b.w / 2 + (Math.random() - 0.5) * b.w * 0.5;
      var vx = clamp((paddle.x - hx) * 0.008, -1.3, 1.3);
      state.hazards.push({ x: hx, y: b.y + b.h, r: 7, vx: vx, vy: 3.2 + Math.random() * 0.7, phase: Math.random() * 6 });
      addShock(hx, b.y + b.h, '#ff5cf0', 18);
      audio('type');
    }
  }

  function updateHazards() {
    for (var i = state.hazards.length - 1; i >= 0; i--) {
      var h = state.hazards[i];
      h.x += h.vx;
      h.y += h.vy;
      if (h.y + h.r >= paddle.y && h.y - h.r <= paddle.y + paddle.h &&
          Math.abs(h.x - paddle.x) <= paddle.w / 2 + h.r) {
        state.hazards.splice(i, 1);
        hazardHit(h.x, paddle.y);
        continue;
      }
      if (h.y - h.r > H) state.hazards.splice(i, 1);
    }
  }

  function hazardHit(x, y) {
    if (!state || state.over || state.clearing) return;
    state.lives--;
    state.combo = 0;
    state.comboT = 0;
    spawnParticles(x, y, '#ff5cf0', 22);
    addShock(x, y, '#ff5cf0', 76);
    audio('lose');
    shake();
    if (state.lives <= 0) {
      state.lives = 0;
      updateHud();
      endGame(false);
      return;
    }
    updateHud();
    setMsg(T('gs.brickbash.hazardHit').replace('{n}', state.lives), 'var(--neon-pink)');
  }

  function laserDestroy(b) {
    if (!b || b.dead) return;
    b.hp = 0;
    b.dead = true;
    if (!b.steel) state.alive--;
    state.score += 10 + state.level * 5;
    spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#ffe600', 12);
    addShock(b.x + b.w / 2, b.y + b.h / 2, '#ffe600', 40);
    audio('match');
    if (state.alive <= 0) maybeLevelClear(b.x + b.w / 2, b.y + b.h / 2);
  }

  function updateLaser(dt) {
    if (!state || state.laserT <= 0) return;
    var f = dt || 1;
    state.laserT -= f;
    for (var i = state.beams.length - 1; i >= 0; i--) {
      state.beams[i].life -= 0.05 * f;
      if (state.beams[i].life <= 0) state.beams.splice(i, 1);
    }
    state.laserCd -= f;
    if (state.laserCd > 0) return;
    state.laserCd = 42;
    var sides = [paddle.x - paddle.w / 2 + 4, paddle.x + paddle.w / 2 - 4];
    for (var s = 0; s < sides.length; s++) {
      var sx = sides[s];
      var target = null;
      for (var k = 0; k < state.bricks.length; k++) {
        var b = state.bricks[k];
        if (b.dead || b.steel) continue;
        if (sx < b.x || sx > b.x + b.w) continue;
        if (!target || b.y > target.y) target = b;
      }
      state.beams.push({ x: sx, y0: paddle.y, y1: target ? target.y + target.h : 0, life: 1 });
      if (target) laserDestroy(target);
    }
    if (state.laserT <= 0) state.laserT = 0;
  }

  function beginLevelClear(x, y) {
    if (!state || state.clearing) return;
    state.clearing = true;
    state.clearT = CLEAR_FRAMES;
    state.powerups = [];
    state.hazards = [];
    setMsg('');
    var bonus = state.conf.bonus * state.level;
    state.score += bonus;
    updateHud();
    showBanner(T('gs.brickbash.levelClear'), T('gs.brickbash.levelClearBonus').replace('{n}', bonus), 'var(--neon-yellow)', 1700);
    spawnParticles(x || W / 2, y || H / 2, '#ffe600', 26);
    addShock(x || W / 2, y || H / 2, '#ffe600', 110);
    addShock(x || W / 2, y || H / 2, '#00f0ff', 80);
    if (window.Arcade && Arcade.fx) {
      Arcade.fx.centerBurst('var(--neon-yellow)', 16);
      Arcade.fx.flash('rgba(255,230,0,0.35)');
    }
    audio('clear');
    shake();
  }

  function victory() {
    var bonus = state.conf.bonus * 2;
    state.score += bonus;
    updateHud();
    spawnParticles(W / 2, H / 2, '#ffe600', 40);
    addShock(W / 2, H / 2, '#ffe600', 140);
    endGame(true);
  }

  function endGame(win) {
    if (!state) return;
    state.over = true;
    state.won = !!win;
    state.paused = false;
    if (pauseEl) pauseEl.classList.add('hidden');
    var isNew = false;
    if (!state.submitted) {
      state.submitted = true;
      try {
        if (window.Arcade && Arcade.shell && Arcade.shell.submitScore) {
          isNew = !!Arcade.shell.submitScore(state.score);
        }
      } catch (e) {}
    }
    ovTitle.textContent = win ? T('gs.brickbash.ovWinTitle') : T('gs.brickbash.ovTitle');
    ovTitle.className = 'ov-title' + (win ? ' win' : '');
    finalScoreEl.textContent = String(state.score);
    finalLevelEl.textContent = state.level + '/' + state.conf.levels;
    bestEl.textContent = String(bestScore());
    recordEl.textContent = isNew ? T('gs.brickbash.newRecord') : '';
    overlay.hidden = false;
    setMsg('');
    clearBanner();
    if (win) {
      if (window.Arcade && Arcade.juice) Arcade.juice.win();
      else audio('win');
    }
  }

  function update(dt) {
    if (!state) return;
    state.frame += (dt || 1);
    if (state.paused || state.over) return;
    updateParticles();

    if (state.clearing) {
      state.clearT -= (dt || 1);
      if (state.clearT > 0 && state.frame % 9 === 0) {
        spawnParticles(W / 2 + (Math.random() - 0.5) * 260, H * 0.42 + (Math.random() - 0.5) * 120, '#ffe600', 3);
      }
      if (state.clearT <= 0) {
        state.clearing = false;
        if (state.level < state.conf.levels) {
          state.level++;
          setupLevel();
          setMsg(T('gs.brickbash.levelStart').replace('{n}', state.level) + ' · ' + T('gs.brickbash.msgStart'), '');
          if (state.boss) showBanner(T('gs.brickbash.bossTitle'), T('gs.brickbash.bossHint'), 'var(--neon-pink)', 1800);
          else showBanner(T('gs.brickbash.levelStart').replace('{n}', state.level), T('gs.brickbash.msgStart'), 'var(--neon-cyan)', 1500);
        } else {
          victory();
        }
      }
      return;
    }

    if (state.wideT > 0) {
      state.wideT -= (dt || 1);
      if (state.wideT <= 0) {
        state.wideT = 0;
        paddle.w = BASE_PADDLE_W;
        setPaddleX(paddle.x);
      }
    }
    if (state.slowT > 0) state.slowT -= (dt || 1);
    if (state.comboT > 0) {
      state.comboT -= (dt || 1);
      if (state.comboT <= 0) {
        state.comboT = 0;
        if (state.combo > 0) { state.combo = 0; updateHud(); }
      }
    }

    if (keys.left) setPaddleX(paddle.x - KEY_SPEED);
    if (keys.right) setPaddleX(paddle.x + KEY_SPEED);
    updateBricksMove();
    updateBoss(dt);
    updateLaser(dt);
    syncStuck();
    updateBalls();
    if (state.over || state.clearing) return;
    updateHazards();
    updatePowerups();
  }

  /* ---------- 绘制 ---------- */
  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1020');
    g.addColorStop(0.55, '#070812');
    g.addColorStop(1, '#130a1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var t = performance.now ? performance.now() : Date.now();
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(t / 900 * s.spd + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 5 === 0 ? '#ff9dd3' : '#b9fbff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(0,240,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (var y = 0; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    var topGlow = ctx.createLinearGradient(0, 0, W, 0);
    topGlow.addColorStop(0, 'rgba(255,45,149,0)');
    topGlow.addColorStop(0.5, 'rgba(0,240,255,0.55)');
    topGlow.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, 2);

    var vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBricks() {
    for (var i = 0; i < state.bricks.length; i++) {
      var b = state.bricks[i];
      if (b.dead) continue;
      if (b.steel) {
        var mg = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        mg.addColorStop(0, '#f4f7ff');
        mg.addColorStop(0.35, '#aab8cf');
        mg.addColorStop(0.72, '#5b6a85');
        mg.addColorStop(1, '#2b3346');
        ctx.fillStyle = mg;
        roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(223,233,255,0.85)';
        ctx.lineWidth = 1.2;
        roundRect(b.x + 0.7, b.y + 0.7, b.w - 1.4, b.h - 1.4, 3.4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(20,28,44,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var hx = b.x + 5; hx < b.x + b.w - 3; hx += 7) {
          ctx.moveTo(hx, b.y + 2.5);
          ctx.lineTo(hx + 4, b.y + b.h - 2.5);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(b.x + 4, b.y + 4, 1.4, 0, Math.PI * 2);
        ctx.arc(b.x + b.w - 4, b.y + 4, 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (b.flash > 0) {
          ctx.globalAlpha = Math.min(0.9, b.flash / 8);
          ctx.fillStyle = '#ffffff';
          roundRect(b.x, b.y, b.w, b.h, 4);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        continue;
      }
      var pal = PALETTE[b.maxHp - 1] || PALETTE[0];
      var grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      grad.addColorStop(0, pal.light);
      grad.addColorStop(0.32, pal.main);
      grad.addColorStop(1, pal.dark);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = grad;
      roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = 1.4;
      roundRect(b.x + 0.7, b.y + 0.7, b.w - 1.4, b.h - 1.4, 3.4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.26)';
      ctx.fillRect(b.x + 3, b.y + 2.4, b.w - 6, 2);
      if (b.move) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(b.x + 3, b.y + b.h / 2);
        ctx.lineTo(b.x + 6, b.y + b.h / 2 - 2);
        ctx.lineTo(b.x + 6, b.y + b.h / 2 + 2);
        ctx.closePath();
        ctx.fill();
      }
      if (b.maxHp > 1) {
        for (var p = 0; p < b.maxHp; p++) {
          ctx.fillStyle = p < b.hp ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.16)';
          ctx.beginPath();
          ctx.arc(b.x + b.w - 6 - p * 5, b.y + b.h - 5, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (b.flash > 0) {
        ctx.globalAlpha = Math.min(0.9, b.flash / 9);
        ctx.fillStyle = '#ffffff';
        roundRect(b.x, b.y, b.w, b.h, 4);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawParticles() {
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShocks() {
    for (var i = 0; i < state.shocks.length; i++) {
      var s = state.shocks[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life) * 0.8;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPaddle() {
    var x = paddle.x - paddle.w / 2;
    var wide = state && state.wideT > 0;
    var glow = wide ? '#ff2d95' : '#00f0ff';
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16;
    var pg = ctx.createLinearGradient(x, paddle.y, x, paddle.y + paddle.h);
    pg.addColorStop(0, '#e8ffff');
    pg.addColorStop(0.28, wide ? '#ff9dd3' : '#8ff9ff');
    pg.addColorStop(0.62, wide ? '#ff2d95' : '#00f0ff');
    pg.addColorStop(1, wide ? '#6d0a3f' : '#045865');
    ctx.fillStyle = pg;
    roundRect(x, paddle.y, paddle.w, paddle.h, paddle.h / 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + 8, paddle.y + 2.4, Math.max(8, paddle.w - 16), 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 1;
    roundRect(x + 0.5, paddle.y + 0.5, paddle.w - 1, paddle.h - 1, paddle.h / 2);
    ctx.stroke();
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x + 4, paddle.y + paddle.h / 2, 3, 0, Math.PI * 2);
    ctx.arc(x + paddle.w - 4, paddle.y + paddle.h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBall(b) {
    var n = b.trail.length;
    for (var i = 0; i < n; i++) {
      var tp = b.trail[i];
      var k = (i + 1) / (n + 1);
      ctx.globalAlpha = k * 0.28;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, b.r * (0.35 + 0.55 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    var rg = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, b.r * 1.8);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.38, '#e8ffff');
    rg.addColorStop(0.82, 'rgba(111,247,255,0.9)');
    rg.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.68, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPowerup(it) {
    var style = PU_STYLE[it.type] || PU_STYLE.wide;
    var col = style.color;
    var letter = style.letter;
    var pulse = 1 + Math.sin(performance.now() / 220 + it.phase) * 0.08;
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(4,6,14,0.9)';
    roundRect(-11, -9, 22, 18, 7);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    roundRect(-11, -9, 22, 18, 7);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 1);
    ctx.restore();
  }

  function drawBoss() {
    var b = state.boss;
    if (!b || b.dead) return;
    var bob = Math.sin((performance.now ? performance.now() : Date.now()) / 520 + b.phase) * 2;
    var y = b.y + bob;
    ctx.save();
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 18;
    var g = ctx.createLinearGradient(b.x, y, b.x, y + b.h);
    g.addColorStop(0, '#ffc4e0');
    g.addColorStop(0.3, '#ff2d95');
    g.addColorStop(0.72, '#b3125f');
    g.addColorStop(1, '#4c0629');
    ctx.fillStyle = g;
    roundRect(b.x, y, b.w, b.h, 9);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,220,240,0.9)';
    ctx.lineWidth = 1.5;
    roundRect(b.x + 0.7, y + 0.7, b.w - 1.4, b.h - 1.4, 8.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(b.x + 8, y + 3, b.w - 16, 2);
    var eyeY = y + b.h * 0.42;
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.3, eyeY, 4.5, 0, Math.PI * 2);
    ctx.arc(b.x + b.w * 0.7, eyeY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w * 0.36, y + b.h * 0.74);
    ctx.lineTo(b.x + b.w * 0.64, y + b.h * 0.74);
    ctx.stroke();
    if (b.flash > 0) {
      ctx.globalAlpha = Math.min(0.9, b.flash / 14);
      ctx.fillStyle = '#ffffff';
      roundRect(b.x, y, b.w, b.h, 9);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawBossBar() {
    if (!state || !state.boss) return;
    var b = state.boss;
    ctx.save();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText('BOSS', 12, 15);
    var bx = 46, bw = W - bx - 12, by = 10, bh = 9;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(bx, by, bw, bh, 4);
    ctx.fill();
    var ratio = b.dead ? 0 : Math.max(0, b.hp / b.maxHp);
    if (ratio > 0) {
      var g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ff2d95');
      g.addColorStop(1, '#ffe600');
      ctx.fillStyle = g;
      roundRect(bx, by, bw * ratio, bh, 4);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 4);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(b.hp + '/' + b.maxHp, W - 14, 15);
    ctx.restore();
  }

  function drawHazards() {
    for (var i = 0; i < state.hazards.length; i++) {
      var h = state.hazards[i];
      var p = Math.sin(performance.now() / 180 + h.phase) * 0.12 + 1;
      ctx.save();
      ctx.shadowColor = '#ff5cf0';
      ctx.shadowBlur = 16;
      var rg = ctx.createRadialGradient(h.x - 2, h.y - 2, 1, h.x, h.y, h.r * 1.7);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.34, '#ffd1f7');
      rg.addColorStop(0.78, 'rgba(255,92,240,0.85)');
      rg.addColorStop(1, 'rgba(255,92,240,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * 1.7 * p, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBeams() {
    for (var i = 0; i < state.beams.length; i++) {
      var bm = state.beams[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, bm.life);
      var g = ctx.createLinearGradient(0, bm.y0, 0, bm.y1);
      g.addColorStop(0, 'rgba(255,230,0,0.95)');
      g.addColorStop(1, 'rgba(255,230,0,0.15)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(bm.x, bm.y0);
      ctx.lineTo(bm.x, bm.y1);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawShield() {
    if (!state || !state.shield) return;
    var t = performance.now ? performance.now() : Date.now();
    var a = 0.35 + 0.18 * Math.sin(t / 240);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#8f7dff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#8f7dff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(paddle.x, paddle.y + 26, paddle.w * 0.62, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#8f7dff';
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    if (!state) return;
    drawBossBar();
    drawBricks();
    drawBoss();
    drawHazards();
    for (var i = 0; i < state.powerups.length; i++) {
      if (!state.powerups[i].dead) drawPowerup(state.powerups[i]);
    }
    drawParticles();
    drawShocks();
    drawBeams();
    drawPaddle();
    drawShield();
    for (var b = 0; b < state.balls.length; b++) {
      if (!state.balls[b].lost) drawBall(state.balls[b]);
    }
    if (state.balls.length && state.balls[0].stuck && !state.over && !state.clearing) {
      var pulse = 0.55 + 0.45 * Math.sin((performance.now ? performance.now() : Date.now()) / 260);
      ctx.globalAlpha = 0.55 + pulse * 0.4;
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.moveTo(state.balls[0].x, state.balls[0].y - 13);
      ctx.lineTo(state.balls[0].x - 5, state.balls[0].y - 22);
      ctx.lineTo(state.balls[0].x + 5, state.balls[0].y - 22);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (state.clearing) {
      var flash = Math.max(0, state.clearT / CLEAR_FRAMES) * 0.12;
      ctx.fillStyle = 'rgba(255,230,0,' + flash + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (state.slowT > 0) {
      ctx.fillStyle = 'rgba(57,255,20,0.045)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* helpText（沿用原页面结构） */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.brickbash.helpText');
  root.appendChild(hd);

  /* ---------- 无头验收接口（仅 ?qa=1） ---------- */
  function qaSnapshot() {
    var bricks = state ? state.bricks : [];
    var aliveN = 0, steelN = 0, moveN = 0;
    for (var i = 0; i < bricks.length; i++) {
      if (bricks[i].steel) steelN++;
      else if (!bricks[i].dead) aliveN++;
      if (bricks[i].move) moveN++;
    }
    return {
      diff: state ? state.diff : -1,
      level: state ? state.level : 0,
      levels: state ? state.conf.levels : 0,
      score: state ? state.score : 0,
      lives: state ? state.lives : 0,
      over: state ? !!state.over : false,
      won: state ? !!state.won : false,
      paused: state ? !!state.paused : false,
      clearing: state ? !!state.clearing : false,
      alive: aliveN,
      brickCount: aliveN,
      steelCount: steelN,
      movingCount: moveN,
      balls: state ? state.balls.length : 0,
      shield: state ? !!state.shield : false,
      laserT: state ? Math.round(state.laserT) : 0,
      bossHp: state && state.boss ? state.boss.hp : 0,
      bossMaxHp: state && state.boss ? state.boss.maxHp : 0,
      bossDead: state && state.boss ? !!state.boss.dead : true,
      bossFlash: state && state.boss ? state.boss.flash : 0,
      beams: state ? state.beams.length : 0,
      hazards: state ? state.hazards.length : 0
    };
  }

  var QA_ON = false;
  try { QA_ON = /(?:\?|&)qa=1(?:&|$)/.test(location.search); } catch (e) {}
  if (QA_ON) {
    window.__qa = {
      start: function (diffIdx) { startGame(typeof diffIdx === 'number' ? diffIdx : 0); return qaSnapshot(); },
      get state() { return qaSnapshot(); },
      info: qaSnapshot,
      launch: function () { return launch(); },
      damageBoss: function (n) { return damageBoss(typeof n === 'number' ? n : 1); },
      spawnPowerup: function (type) {
        if (!state || !PU_STYLE[type]) return false;
        state.powerups.push({
          x: W / 2, y: paddle.y - 90, w: 22, h: 18, vy: 2.4,
          type: type, dead: false, phase: 0
        });
        return true;
      },
      killAllBricks: function () {
        if (!state) return false;
        for (var i = 0; i < state.bricks.length; i++) {
          var b = state.bricks[i];
          if (b.steel || b.dead) continue;
          b.hp = 0;
          b.dead = true;
        }
        state.alive = 0;
        updateHud();
        maybeLevelClear(W / 2, H * 0.42);
        return true;
      },
      goLevel: function (n) {
        if (!state) return false;
        state.level = clamp(parseInt(n, 10) || 1, 1, state.conf.levels);
        setupLevel();
        return qaSnapshot();
      },
      win: function () { if (state && !state.over) victory(); return qaSnapshot(); },
      lose: function () {
        if (state && !state.over) { state.lives = 0; updateHud(); endGame(false); }
        return qaSnapshot();
      }
    };
  }

  window.GAME_RESTART = function () {
    if (state) startGame(state.diff);
    else openPicker();
  };

  openPicker();
  loopApi = Arcade.loop.start(update, render, 16);
})();
