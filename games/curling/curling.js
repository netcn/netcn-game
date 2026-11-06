/* ============================================================
   冰壶 Curling · 物理瞄准策略旗舰（P2 品类旗舰）
   真实圆盘物理：摩擦衰减 + 轻度 curl 弧线、壶与壶圆碰撞（动量交换）、
   出界判定、静置判定、刷冰加速、三档 AI、8 端大本营计分 / 混双 2 壶赛制。
   视觉：冰面渐变/划痕/反光、红蓝大本营与网格、花岗岩壶 3D、影子、轨迹、
        扫冰粒子、碰撞冰屑/火花、震屏、记分板与结算面板。
   记分：总分（max 模式），对局结束仅提交一次成绩。
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.curling.tut1t'), d: T('gs.curling.tut1') },
  { t: T('gs.curling.tut2t'), d: T('gs.curling.tut2') },
  { t: T('gs.curling.tut3t'), d: T('gs.curling.tut3') },
  { t: T('gs.curling.tut4t'), d: T('gs.curling.tut4') },
  { t: T('gs.curling.tut5t'), d: T('gs.curling.tut5') },
  { t: T('gs.curling.tut6t'), d: T('gs.curling.tut6') }
];

(function () {
  /* ==CURL-CORE-START== */
  var CRCORE = (function () {
    var EPS = 1e-6;
    /* 滑行一步：摩擦减速 + 旋转带来的横向弧度；角度约定 0=正上、顺时针（方向向量 (sin a, -cos a)） */
    function slide(s, friction, dt) {
      dt = dt || 1;
      var v = Math.max(0, s.v - friction * dt);
      var a = s.a;
      if (s.spin) a += s.spin * 0.0008 * dt * Math.min(1, Math.abs(s.v) / 2.4);
      return {
        x: s.x + Math.sin(a) * v * dt,
        y: s.y - Math.cos(a) * v * dt,
        v: v, a: a, me: s.me, moving: v > 0.05, swept: s.swept || 0
      };
    }
    /* 壶与壶圆碰撞：等质量、法向动量交换（含轻微能量损失）+ 位置分离 */
    function collide(a, b, radius) {
      var R = radius || 23;
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d >= R) return { hit: false };
      var nx, ny;
      if (d < EPS) { nx = 1; ny = 0; d = EPS; } else { nx = dx / d; ny = dy / d; }
      var overlap = R - d;
      a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;

      var vax = Math.sin(a.a) * a.v, vay = -Math.cos(a.a) * a.v;
      var vbx = Math.sin(b.a) * b.v, vby = -Math.cos(b.a) * b.v;
      var van = vax * nx + vay * ny;
      var vbn = vbx * nx + vby * ny;
      if (van - vbn <= 0) return { hit: false };
      var e = 0.94;
      var mean = (van + vbn) * 0.5;
      var va2n = mean - e * (van - vbn) * 0.5;
      var vb2n = mean + e * (van - vbn) * 0.5;

      var vax2 = vax + (va2n - van) * nx;
      var vay2 = vay + (va2n - van) * ny;
      var vbx2 = vbx + (vb2n - vbn) * nx;
      var vby2 = vby + (vb2n - vbn) * ny;

      a.v = Math.sqrt(vax2 * vax2 + vay2 * vay2);
      b.v = Math.sqrt(vbx2 * vbx2 + vby2 * vby2);
      if (a.v > 0.05) a.a = Math.atan2(vax2, -vay2); else a.v = 0;
      if (b.v > 0.05) b.a = Math.atan2(vbx2, -vby2); else b.v = 0;
      a.moving = a.v > 0.05;
      b.moving = b.v > 0.05;
      return { hit: true, impact: van - vbn, x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
    }
    /* 一局得分：只计算大本营内的壶；领先方每有一壶比对方最近壶更近圆心 +1 */
    function endScore(rocks, cx, cy, me, houseR) {
      var lim = houseR || Infinity;
      var mine = [], theirs = [];
      rocks.forEach(function (r) {
        if (r.dead) return;
        var d = Math.sqrt((r.x - cx) * (r.x - cx) + (r.y - cy) * (r.y - cy));
        if (d > lim) return;
        if (r.me === me) mine.push(d); else theirs.push(d);
      });
      if (!mine.length) return 0;
      mine.sort(function (a, b) { return a - b; });
      if (!theirs.length) return mine.length;
      theirs.sort(function (a, b) { return a - b; });
      var best = mine[0], theirBest = theirs[0];
      if (best >= theirBest) return 0;
      var n = 0;
      for (var i = 0; i < mine.length; i++) if (mine[i] < theirBest) n++;
      return n;
    }
    /* 给定停止距离所需初速度（用于 AI 估力） */
    function stopSpeed(distance, friction) {
      return Math.sqrt(2 * Math.max(0, friction) * Math.max(0, distance));
    }
    return { slide: slide, collide: collide, endScore: endScore, stopSpeed: stopSpeed };
  })();
  /* ==CURL-CORE-END== */

  var slide = CRCORE.slide, collide = CRCORE.collide, endScore = CRCORE.endScore, stopSpeed = CRCORE.stopSpeed;

  var root = document.getElementById('game-root');
  if (!root) return;

  /* ---------- 场地参数 ---------- */
  var W = 360, H = 480;
  var SHEET = { l: 18, r: 342, t: 10, b: 470 };
  var CX = 180, CY = 148, HOUSE_R = 56;
  var ROCK_R = 11.5, LAUNCH_X = 180, LAUNCH_Y = 452;
  var FRICTION = 0.044, BASE_V = 2.4, SPAN_V = 4.4;
  var ENDS = 8, PER_SIDE = 4, TOTAL = PER_SIDE * 2;
  var GAME_ID = ((window.Arcade && Arcade.shell && Arcade.shell.gameId) ||
    (document.body && document.body.getAttribute('data-game-id')) || 'curling');
  /* ?qa=1 调试通道：正常访问不暴露 __qa，也不启用加速/静音 */
  var QA_ON = /(?:^|[?&])qa=1(?:&|$)/.test(window.location.search);
  var qaFast = false, qaMute = false;

  /* 冰面变化：每局每端随机一种，影响摩擦力与弧度，并改变冰面视觉 */
  var ICE_KINDS = [
    { key: 'normal', fr: 1.00, curl: 1.00, label: 'gs.curling.iceNormal' },
    { key: 'fast', fr: 0.80, curl: 0.72, label: 'gs.curling.iceFast' },
    { key: 'rough', fr: 1.22, curl: 1.14, label: 'gs.curling.iceRough' },
    { key: 'curl', fr: 1.02, curl: 1.55, label: 'gs.curling.iceCurl' }
  ];
  var FORMATS = {
    standard: { perSide: 4, preplace: 0 },
    mixed: { perSide: 2, preplace: 1 }
  };
  var ICE_UI = { normal: '#b967ff', fast: '#7ef9ff', rough: '#e6f0ff', curl: '#c48bff' };

  var DIFFS = {
    easy:   { aimErr: 0.10,  powErr: 0.16, takeout: 0.10, delay: 100, spin: 0.55 },
    normal: { aimErr: 0.045, powErr: 0.075, takeout: 0.38, delay: 68,  spin: 0.80 },
    hard:   { aimErr: 0.014, powErr: 0.028, takeout: 0.70, delay: 46,  spin: 0.90 }
  };

  /* ---------- DOM ---------- */
  var html =
    '<div class="crl-hud">' +
    '  <div class="crl-cell"><span class="crl-k">' + T('gs.curling.endLabel') + '</span><b id="crl-end">1</b><span class="crl-colon">/8</span></div>' +
    '  <div class="crl-cell crl-score"><span class="crl-k me">' + T('gs.curling.you') + '</span><b id="crl-mine">0</b><span class="crl-colon">:</span><b id="crl-their">0</b><span class="crl-k ai">' + T('gs.curling.ai') + '</span></div>' +
    '  <div class="crl-cell"><span class="crl-k">' + T('gs.curling.best') + '</span><b id="crl-best">----</b></div>' +
    '</div>' +
    '<div class="mode-row" id="crl-diffs">' +
    '  <button class="btn mode-btn" data-d="easy">' + T('gs.curling.dEasy') + '</button>' +
    '  <button class="btn mode-btn selected" data-d="normal">' + T('gs.curling.dNormal') + '</button>' +
    '  <button class="btn mode-btn" data-d="hard">' + T('gs.curling.dHard') + '</button>' +
    '</div>' +
    '<div class="mode-row crl-formats" id="crl-formats">' +
    '  <button class="btn mode-btn selected" data-f="standard">' + T('gs.curling.fmtStandard') + '</button>' +
    '  <button class="btn mode-btn" data-f="mixed">' + T('gs.curling.fmtMixed') + '</button>' +
    '</div>' +
    '<div class="crl-stage" id="crl-stage">' +
    '  <canvas class="crl-canvas" id="crl-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '  <div class="crl-msg" id="crl-msg"></div>' +
    '  <div class="crl-overlay" id="crl-overlay">' +
    '    <div class="crl-card" id="crl-card">' +
    '      <div class="crl-ov-title" id="crl-ov-title"></div>' +
    '      <div class="crl-ov-sub" id="crl-ov-sub"></div>' +
    '      <div class="crl-ov-stats" id="crl-ov-stats"></div>' +
    '      <button class="btn green" id="crl-again">' + T('gs.curling.again') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="crl-status">' +
    '  <b id="crl-turn">' + T('gs.curling.turnMe') + '</b>' +
    '  <span id="crl-left">' + T('gs.curling.stonesLeft').replace('{n}', String(TOTAL)) + '</span>' +
    '  <span class="crl-ice-tag"><i class="crl-ic crl-ic-ice"></i><b id="crl-ice">' + T('gs.curling.iceNormal') + '</b></span>' +
    '  <span class="crl-meters"><i class="crl-ic crl-ic-target"></i><b id="crl-anglbl">0°</b><span class="crl-dot">·</span><i class="crl-ic crl-ic-volt"></i><b id="crl-powlbl">64</b></span>' +
    '</div>' +
    '<div class="crl-controls">' +
    '  <div class="game-controls">' +
    '    <button class="btn green" id="crl-throw"><i class="crl-ic crl-ic-rock"></i>' + T('gs.curling.throw') + '</button>' +
    '    <button class="btn yellow" id="crl-sweep"><i class="crl-ic crl-ic-broom"></i>' + T('gs.curling.sweep').replace('{n}', '<span id="crl-sweepn">3</span>') + '</button>' +
    '    <button class="btn purple" id="crl-curl"><i class="crl-ic crl-ic-spin"></i>' + T('gs.curling.curlRight') + '</button>' +
    '  </div>' +
    '</div>' +
    '<div class="crl-ends" id="crl-ends"></div>';
  root.innerHTML = html;

  var canvas = document.getElementById('crl-canvas');
  var stageEl = document.getElementById('crl-stage');
  var ctx;
  if (window.GK) {
    ctx = GK.setup(canvas, W, H).ctx;
  } else {
    ctx = canvas.getContext('2d');
    if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = W + 'px';
  canvas.title = T('gs.curling.aimHint');

  var msgEl = document.getElementById('crl-msg');
  var overlayEl = document.getElementById('crl-overlay');
  var cardEl = document.getElementById('crl-card');
  var ovTitle = document.getElementById('crl-ov-title');
  var ovSub = document.getElementById('crl-ov-sub');
  var ovStats = document.getElementById('crl-ov-stats');
  var againBtn = document.getElementById('crl-again');
  var endEl = document.getElementById('crl-end');
  var mineEl = document.getElementById('crl-mine');
  var theirEl = document.getElementById('crl-their');
  var bestEl = document.getElementById('crl-best');
  var turnEl = document.getElementById('crl-turn');
  var leftEl = document.getElementById('crl-left');
  var angLbl = document.getElementById('crl-anglbl');
  var powLbl = document.getElementById('crl-powlbl');
  var throwBtn = document.getElementById('crl-throw');
  var sweepBtn = document.getElementById('crl-sweep');
  var sweepN = document.getElementById('crl-sweepn');
  var curlBtn = document.getElementById('crl-curl');
  var endsEl = document.getElementById('crl-ends');
  var diffRow = document.getElementById('crl-diffs');
  var formatRow = document.getElementById('crl-formats');
  var iceEl = document.getElementById('crl-ice');

  /* ---------- 状态 ---------- */
  var diff = 'normal', D = DIFFS[diff];
  var format = 'standard';
  var stones = [], particles = [], floats = [];
  var endIndex = 0, throwsDone = 0, endFirst = 'me';
  var scoreMine = 0, scoreAI = 0, endScores = [null, null, null, null, null, null, null, null];
  var iceKinds = [], matchSeed = 1;
  var turn = 'me', activeStone = null, phase = 'play';
  var sweepLeft = 3, spinDir = 1;
  var aimAngle = 0, aimPower = 0.64, aiming = false, drag = null;
  var aiDelay = 0, interWait = 0, msgT = 0;
  var paused = false, over = false, submitted = false;
  var shakeFrames = 0, collideCd = 0, slideSoundCd = 0, sweepFxCd = 0, collisions = 0, outHold = 0;
  var bestShown = null;
  var loopApi = null;

  /* ---------- 工具 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fmt(k, o) {
    var s = T(k);
    for (var p in o) s = s.split('{' + p + '}').join(String(o[p]));
    return s;
  }
  function audio(name) { if (qaMute) return; if (Arcade.audio) Arcade.audio.play(name); }
  function bestValue() {
    try { if (Arcade.storage) return Arcade.storage.getBest(GAME_ID); } catch (e) {}
    return null;
  }
  function updateBestLabel() {
    bestShown = bestValue();
    if (bestEl) bestEl.textContent = bestShown === null ? '----' : String(bestShown);
  }
  function fxBurst(x, y, color, count, power) {
    /* 自绘 Canvas 粒子，不向共享 fx 层堆 DOM 粒子（避免结算面板被遮挡） */
    spawnBurst(x, y, color, count, power || 1);
  }
  function showMsg(text, color, frames) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = color || '';
    msgT = text ? (frames || 90) : 0;
  }
  function pointerPos(ev) {
    if (window.GK && GK.pointer) return GK.pointer(canvas, ev);
    var r = canvas.getBoundingClientRect();
    var t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }

  /* ---------- 冰面 / 赛制 ---------- */
  function iceInfo() { return ICE_KINDS[iceKinds[endIndex] || 0] || ICE_KINDS[0]; }
  function iceMul() { return iceInfo().fr; }
  function curlMul() { return iceInfo().curl; }
  function rollIce() {
    /* 8 端由两组四种冰面轮换：每 4 端必覆盖全部 4 种，且相邻端不重复，
       保证「逐端变化」既可见又不会连续两端口感相同 */
    iceKinds = [];
    for (var block = 0; block < 2; block++) {
      var arr = [0, 1, 2, 3];
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      if (iceKinds.length && arr[0] === iceKinds[iceKinds.length - 1]) {
        var t2 = arr[0]; arr[0] = arr[1]; arr[1] = t2;
      }
      for (var k = 0; k < arr.length; k++) iceKinds.push(arr[k]);
    }
  }
  function makeStone(x, y, me) {
    return { x: x, y: y, v: 0, a: 0, me: !!me, spin: 0,
      moving: false, swept: 0, trail: [], trailFade: 1,
      seed: Math.random() * 997, dead: false, tick: 0, placed: true };
  }
  function saveNow() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
  }

  /* ---------- 粒子 / 浮字 ---------- */
  function spawnBurst(x, y, color, count, power) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (0.6 + Math.random() * 2.2) * (power || 1);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, decay: 0.018 + Math.random() * 0.025,
        size: 1.4 + Math.random() * 2.4, color: color, g: 0.02
      });
    }
  }
  function spawnSweep(st, count) {
    var a = st.a;
    var backX = Math.sin(a), backY = -Math.cos(a);
    for (var i = 0; i < count; i++) {
      particles.push({
        x: st.x + backX * (4 + Math.random() * 10) + (Math.random() - 0.5) * 12,
        y: st.y + backY * (4 + Math.random() * 10) + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -0.4 - Math.random() * 1.2,
        life: 0.8, decay: 0.03 + Math.random() * 0.03,
        size: 1 + Math.random() * 1.6,
        color: Math.random() < 0.5 ? 'rgba(235,252,255,0.95)' : 'rgba(150,230,255,0.9)',
        g: -0.01
      });
    }
  }
  function spawnChips(x, y, color, count, power) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 1 + Math.random() * 3 * (power || 1);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, decay: 0.022 + Math.random() * 0.03,
        size: 1 + Math.random() * 2,
        color: color, g: 0.07
      });
    }
  }
  function floatText(x, y, txt, color) {
    floats.push({ x: x, y: y, text: txt, color: color || '#ffe600', life: 1 });
  }
  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.98; p.vy = p.vy * 0.98 + p.g;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var f = floats.length - 1; f >= 0; f--) {
      var t = floats[f];
      t.y -= 0.55; t.life -= 0.018;
      if (t.life <= 0) floats.splice(f, 1);
    }
  }

  /* ---------- 对局流程 ---------- */
  function allSettled() {
    for (var i = 0; i < stones.length; i++) if (stones[i].moving && !stones[i].dead) return false;
    return true;
  }
  function isAnyMoving() {
    for (var i = 0; i < stones.length; i++) if (stones[i].moving && !stones[i].dead) return true;
    return false;
  }
  function canThrow() {
    return !over && !paused && phase === 'play' && turn === 'me' && !activeStone &&
      throwsDone < TOTAL && allSettled();
  }
  function otherSide(s) { return s === 'me' ? 'ai' : 'me'; }

  function startEnd() {
    stones = [];
    particles = [];
    floats = [];
    throwsDone = 0;
    activeStone = null;
    sweepLeft = 3;
    aiming = false;
    drag = null;
    interWait = 0;
    outHold = 0;
    phase = 'play';
    endFirst = (endIndex % 2 === 0) ? 'me' : 'ai';
    turn = endFirst;
    aiDelay = turn === 'ai' ? (qaFast ? 0 : D.delay) : 0;
    /* 混双：每端先在营内各预置一壶，再各投 2 壶 */
    var fm = FORMATS[format] || FORMATS.standard;
    if (fm.preplace) {
      stones.push(makeStone(CX - 22, CY + 13, true));
      stones.push(makeStone(CX + 22, CY + 13, false));
    }
    var startMsg = fmt('gs.curling.endStart', { n: endIndex + 1 }) + ' · ' + T(iceInfo().label);
    if (endIndex === 0) startMsg += ' · ' + T('gs.curling.aimHint');
    showMsg(startMsg, 'var(--neon-cyan)', 130);
    renderEnds();
    updateHud();
    saveNow();
  }

  function newMatch(nextDiff) {
    if (nextDiff) diff = nextDiff;
    D = DIFFS[diff] || DIFFS.normal;
    if (!FORMATS[format]) format = 'standard';
    var fm = FORMATS[format] || FORMATS.standard;
    PER_SIDE = fm.perSide;
    TOTAL = PER_SIDE * 2;
    endIndex = 0;
    scoreMine = 0; scoreAI = 0;
    endScores = [null, null, null, null, null, null, null, null];
    over = false; submitted = false; paused = false;
    aimAngle = 0; aimPower = 0.64; aiming = false; drag = null;
    aiDelay = 0; interWait = 0; msgT = 0;
    shakeFrames = 0; collideCd = 0; slideSoundCd = 0; sweepFxCd = 0; collisions = 0; outHold = 0;
    matchSeed = Date.now();
    rollIce();
    if (overlayEl) overlayEl.classList.remove('show');
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
    updateBestLabel();
    startEnd();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  function launch(angle, power, isMe, spin) {
    if (activeStone || over || phase !== 'play') return false;
    var st = {
      x: LAUNCH_X, y: LAUNCH_Y,
      v: BASE_V + clamp(power, 0, 1) * SPAN_V,
      a: angle, me: !!isMe, spin: (spin || 0) * curlMul(),
      moving: true, swept: 0, trail: [], trailFade: 1,
      seed: Math.random() * 997, dead: false, tick: 0, placed: false
    };
    stones.push(st);
    activeStone = st;
    aiming = false; drag = null;
    audio('drop');
    spawnBurst(LAUNCH_X, LAUNCH_Y, isMe ? 'rgba(255,45,149,0.9)' : 'rgba(0,240,255,0.9)', 5, 1.2);
    if (isMe) showMsg('', '', 0);
    updateHud();
    return true;
  }

  /* ---------- AI ---------- */
  function closestInHouse(me, houseR) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < stones.length; i++) {
      var st = stones[i];
      if (st.dead || st.me !== me) continue;
      var d = Math.sqrt((st.x - CX) * (st.x - CX) + (st.y - CY) * (st.y - CY));
      if (d <= houseR && d < bestD) { bestD = d; best = st; }
    }
    return best ? { stone: best, d: bestD } : null;
  }

  function aiThrow() {
    if (over || phase !== 'play' || turn !== 'ai' || activeStone) return;
    var opp = closestInHouse(true, HOUSE_R + 4);
    var mine = closestInHouse(false, HOUSE_R + 4);
    var target, takeout = false;

    if (opp && (Math.random() < D.takeout || !mine || opp.d < mine.d - 6)) {
      target = { x: opp.stone.x, y: opp.stone.y };
      takeout = true;
    } else {
      var ox = (Math.random() - 0.5) * 22;
      var oy = 12 + (Math.random() - 0.5) * 18;
      target = { x: CX + ox, y: CY + oy };
    }

    var dx = target.x - LAUNCH_X, dy = target.y - LAUNCH_Y;
    var angle = Math.atan2(dx, -dy);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var vr = stopSpeed(Math.max(40, dist - 8), FRICTION * iceMul()) + (takeout ? 1.35 : 0.16);
    var pow = clamp((vr - BASE_V) / SPAN_V + (Math.random() - 0.5) * 2 * D.powErr, 0.10, 1);
    var spin = (Math.random() < 0.5 ? -1 : 1) * D.spin;
    angle -= spin * curlMul() * 0.055; // 轻微补偿旋转弧线，让瞄准更接近目标
    angle += (Math.random() - 0.5) * 2 * D.aimErr;
    launch(angle, pow, false, spin);
  }

  /* ---------- 物理更新 ---------- */
  function markOut(st) {
    if (st.dead) return true;
    if (st.x < SHEET.l || st.x > SHEET.r || st.y < SHEET.t || st.y > SHEET.b) {
      st.dead = true; st.moving = false; st.v = 0;
      spawnBurst(st.x, st.y, 'rgba(210,245,255,0.95)', 10, 1.6);
      audio('error');
      outHold = 80; /* 让「出界」提示先停留，不被随后的回合提示立刻覆盖 */
      if (st === activeStone) showMsg(T('gs.curling.out'), 'var(--neon-pink)', 80);
      return true;
    }
    return false;
  }

  function moveStone(st) {
    var swept = st.swept > 0;
    var res = slide(st, FRICTION * iceMul() * (swept ? 0.62 : 1), 1);
    st.x = res.x; st.y = res.y; st.v = res.v; st.a = res.a;
    if (st.swept > 0) st.swept--;

    if (markOut(st)) return;

    st.moving = st.v > 0.06;
    if (!st.moving) { st.v = 0; return; }
    st.trailFade = 1;
    st.tick++;
    if (st.tick % 3 === 0) {
      st.trail.push({ x: st.x, y: st.y });
      if (st.trail.length > 24) st.trail.shift();
    }
    if (swept && sweepFxCd <= 0) { spawnSweep(st, 4); sweepFxCd = 3; }
  }

  function collideAll() {
    for (var i = 0; i < stones.length; i++) {
      for (var j = i + 1; j < stones.length; j++) {
        var a = stones[i], b = stones[j];
        if (a.dead || b.dead) continue;
        if (!a.moving && !b.moving) continue;
        var r = collide(a, b, ROCK_R * 2);
        if (!r || !r.hit || r.impact <= 0.12) continue;
        collisions++;
        markOut(a);
        markOut(b);
        var strong = r.impact > 1.7;
        spawnChips(r.x, r.y, strong ? '#ffe600' : '#cdefff', strong ? 12 : 7, strong ? 1.5 : 0.9);
        if (strong) {
          spawnBurst(r.x, r.y, 'rgba(255,230,0,0.9)', 6, 1.5);
          shakeFrames = Math.max(shakeFrames, 7);
          if (Arcade.fx) Arcade.fx.shake(stageEl);
        }
        if (collideCd <= 0) {
          audio(strong ? 'drop' : 'rotate');
          collideCd = 9;
        }
        if (strong) fxBurst(r.x, r.y, '#ffd36a', 7, 0.8);
      }
    }
  }

  function pruneStones() {
    for (var i = stones.length - 1; i >= 0; i--) {
      if (stones[i].dead) stones.splice(i, 1);
    }
  }

  function onThrowDone() {
    throwsDone++;
    if (throwsDone >= TOTAL) { scoreEnd(); return; }
    turn = (throwsDone % 2 === 0) ? endFirst : otherSide(endFirst);
    aiDelay = turn === 'ai' ? (qaFast ? 0 : D.delay) : 0;
    if (outHold <= 0) {
      if (turn === 'me') showMsg(T('gs.curling.turnMe'), 'var(--neon-cyan)', 50);
      else showMsg(T('gs.curling.turnAI'), 'var(--neon-yellow)', 50);
    } else {
      msgT = Math.max(msgT, outHold);
    }
    updateHud();
    saveNow();
  }

  function scoreEnd() {
    if (phase !== 'play') return;
    phase = 'between';
    var m = endScore(stones, CX, CY, true, HOUSE_R);
    var a = endScore(stones, CX, CY, false, HOUSE_R);
    scoreMine += m;
    scoreAI += a;
    endScores[endIndex] = { m: m, a: a };
    if (m > 0) {
      audio('coin');
      floatText(CX, CY - 22, '+' + m, '#ffe600');
      spawnBurst(CX, CY, 'rgba(255,230,0,0.95)', 14, 1.8);
      if (Arcade.fx) Arcade.fx.shake(stageEl);
    } else if (a > 0) {
      audio('rotate');
      spawnBurst(CX, CY, 'rgba(0,240,255,0.8)', 8, 1.2);
    } else {
      audio('ui');
    }
    showMsg(fmt('gs.curling.endResult', { n: endIndex + 1, m: m, a: a }),
      m > 0 ? 'var(--neon-green)' : (a > 0 ? 'var(--neon-pink)' : 'var(--text-dim)'), 120);
    interWait = 120;
    renderEnds();
    updateHud();
    saveNow();
  }

  function nextEnd() {
    if (endIndex >= ENDS - 1) { finishMatch(); return; }
    endIndex++;
    startEnd();
  }

  function finishMatch() {
    if (over) return;
    over = true;
    phase = 'over';
    activeStone = null;
    aiming = false;
    drag = null;
    if (window.Arcade && Arcade.savegame) Arcade.savegame.clear();
    dropSlot(format);
    var win = scoreMine > scoreAI;
    var draw = scoreMine === scoreAI;

    var isNew = false;
    if (!submitted) {
      submitted = true;
      try {
        if (Arcade.shell && Arcade.shell.submitScore) isNew = !!Arcade.shell.submitScore(scoreMine);
        else if (Arcade.storage) isNew = Arcade.storage.submitBest(GAME_ID, scoreMine, 'max');
      } catch (e) {}
    }
    updateBestLabel();

    if (win) {
      ovTitle.textContent = T('gs.curling.win').replace('{n}', String(scoreMine)).replace('{m}', String(scoreAI));
      audio('win');
    } else if (!draw) {
      ovTitle.textContent = T('gs.curling.lose').replace('{n}', String(scoreAI)).replace('{m}', String(scoreMine));
      audio('lose');
      if (Arcade.fx) Arcade.fx.shake(stageEl);
    } else {
      ovTitle.textContent = T('gs.curling.draw');
      audio('coin');
    }
    cardEl.classList.remove('win', 'lose');
    if (win) cardEl.classList.add('win');
    else if (!draw) cardEl.classList.add('lose');

    ovSub.innerHTML = fmt('gs.curling.resultScore', { n: scoreMine, m: scoreAI });
    ovStats.innerHTML = fmt('gs.curling.bestScore', { n: bestShown === null ? '----' : bestShown }) +
      (isNew ? '<br><span class="crl-newbest">' + T('gs.curling.newBest') + '</span>' : '');
    againBtn.textContent = T('gs.curling.again');
    overlayEl.classList.add('show');
    updateHud();
  }

  /* ---------- 输入 ---------- */
  function setAimFromPoint(p) {
    var dx = p.x - LAUNCH_X, dy = p.y - LAUNCH_Y;
    if (dy > -10) return false;
    var deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    aimAngle = clamp(deg, -40, 40);
    var dist = Math.sqrt(dx * dx + dy * dy);
    aimPower = clamp((dist - 24) / 440, 0.04, 1);
    updateHud();
    return true;
  }

  function throwHuman() {
    if (!canThrow()) return;
    launch(aimAngle * Math.PI / 180, aimPower, true, spinDir * 0.85);
  }

  function doSweep() {
    if (over || paused || !activeStone || !activeStone.moving || !activeStone.me || sweepLeft <= 0) return false;
    sweepLeft--;
    activeStone.swept = 30;
    sweepFxCd = 0;
    audio('move');
    spawnSweep(activeStone, 8);
    updateHud();
    return true;
  }

  function updateHud() {
    if (endEl) endEl.textContent = String(Math.min(ENDS, endIndex + 1));
    if (mineEl) mineEl.textContent = String(scoreMine);
    if (theirEl) theirEl.textContent = String(scoreAI);
    if (turnEl) {
      if (over) {
        turnEl.textContent = T('gs.curling.matchOver');
        turnEl.style.color = 'var(--neon-cyan)';
      } else {
        turnEl.textContent = turn === 'me' ? T('gs.curling.turnMe') : T('gs.curling.turnAI');
        turnEl.style.color = '';
      }
    }
    if (leftEl) leftEl.textContent = fmt('gs.curling.stonesLeft', { n: Math.max(0, TOTAL - throwsDone) });
    if (angLbl) angLbl.textContent = Math.round(aimAngle) + '°';
    if (powLbl) powLbl.textContent = String(Math.round(aimPower * 100));
    if (sweepN) sweepN.textContent = String(Math.max(0, sweepLeft));
    if (iceEl) {
      iceEl.textContent = phase === 'over' ? '—' : T(iceInfo().label);
      iceEl.style.color = phase === 'over' ? '' : (ICE_UI[iceInfo().key] || '');
    }
    if (throwBtn) throwBtn.disabled = !canThrow();
    if (sweepBtn) {
      sweepBtn.disabled = !(phase === 'play' && !over && !paused && activeStone &&
        activeStone.moving && activeStone.me && sweepLeft > 0);
    }
    if (curlBtn) {
      curlBtn.textContent = spinDir < 0 ? T('gs.curling.curlLeft') : T('gs.curling.curlRight');
      curlBtn.classList.toggle('left', spinDir < 0);
    }
  }

  function renderEnds() {
    if (!endsEl) return;
    var html2 = '';
    for (var i = 0; i < ENDS; i++) {
      var rec = endScores[i];
      var cls = 'crl-endbox' + (rec ? ' done' : '') + (i === endIndex && !over ? ' active' : '');
      html2 += '<div class="' + cls + '"><i>E' + (i + 1) + '</i><b>' +
        (rec ? rec.m : '·') + '</b><span>' + (rec ? rec.a : '·') + '</span></div>';
    }
    endsEl.innerHTML = html2;
  }

  function togglePause() {
    if (over || phase === 'over') return;
    paused = !paused;
    if (paused) {
      aiming = false; drag = null;
      if (loopApi) loopApi.pause();
      showMsg(T('gs.curling.paused'), 'var(--neon-yellow)', 999);
    } else {
      if (loopApi) loopApi.resume();
      showMsg('', '', 0);
    }
    audio('ui');
    updateHud();
  }

  /* ---------- 输入事件 ---------- */
  throwBtn.addEventListener('click', throwHuman);
  sweepBtn.addEventListener('click', doSweep);
  curlBtn.addEventListener('click', function () {
    spinDir = spinDir < 0 ? 1 : -1;
    audio('ui');
    updateHud();
  });

  canvas.addEventListener('pointerdown', function (e) {
    if (!canThrow()) return;
    if (!setAimFromPoint(pointerPos(e))) return;
    aiming = true;
    drag = { moved: false };
    if (e.cancelable) e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!aiming) return;
    if (setAimFromPoint(pointerPos(e)) && drag) drag.moved = true;
    if (e.cancelable) e.preventDefault();
  });
  window.addEventListener('pointerup', function () {
    if (!aiming) return;
    aiming = false;
    drag = null;
    throwHuman();
  });
  window.addEventListener('pointercancel', function () {
    aiming = false;
    drag = null;
  });
  window.addEventListener('blur', function () {
    aiming = false;
    drag = null;
  });

  diffRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      diffRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
      b.classList.add('selected');
      newMatch(b.getAttribute('data-d'));
      audio('ui');
    });
  });

  formatRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = b.getAttribute('data-f');
      if (next === format) return;
      formatRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
      b.classList.add('selected');
      format = next;
      var restored = false;
      var slot = readSlot(format);
      if (slot && slot.format === format) restored = applySave(slot);
      if (restored) {
        if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
      } else if (slot) dropSlot(format);
      if (!restored) newMatch();
      if (restored) showMsg(T('gs.curling.formatResumed'), 'var(--neon-cyan)', 110);
      else if (format === 'mixed') showMsg(T('gs.curling.mixedHint'), 'var(--neon-purple)', 140);
      audio('ui');
    });
  });

  document.addEventListener('keydown', function (e) {
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' ||
        (e.target && e.target.isContentEditable)) return;
    if (document.querySelector('.tut-overlay')) return;

    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (over || paused) return;

    if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
      e.preventDefault();
      aimAngle = clamp(aimAngle - 1.5, -40, 40);
      updateHud();
      return;
    }
    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
      e.preventDefault();
      aimAngle = clamp(aimAngle + 1.5, -40, 40);
      updateHud();
      return;
    }
    if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
      e.preventDefault();
      aimPower = clamp(aimPower + 0.05, 0.04, 1);
      updateHud();
      return;
    }
    if (e.key === 'ArrowDown' || e.code === 'ArrowDown') {
      e.preventDefault();
      aimPower = clamp(aimPower - 0.05, 0.04, 1);
      updateHud();
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) throwHuman();
      return;
    }
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      doSweep();
    }
  });

  againBtn.addEventListener('click', function () {
    audio('ui');
    newMatch();
  });

  /* ---------- 更新 ---------- */
  function update() {
    if (paused) return;
    if (shakeFrames > 0) shakeFrames--;
    if (collideCd > 0) collideCd--;
    if (slideSoundCd > 0) slideSoundCd--;
    if (sweepFxCd > 0) sweepFxCd--;
    if (outHold > 0) outHold--;

    updateParticles();
    if (msgT > 0) {
      msgT--;
      if (msgT === 0) { msgEl.textContent = ''; msgEl.style.color = ''; }
    }

    if (over) { updateHud(); return; }

    if (phase === 'between') {
      if (interWait > 0) {
        interWait -= qaFast ? 30 : 1;
        if (interWait <= 0) {
          interWait = 0;
          if (!over) nextEnd();
        }
      }
      updateHud();
      return;
    }

    if (turn === 'ai' && !activeStone && throwsDone < TOTAL && allSettled()) {
      aiDelay -= qaFast ? 30 : 1;
      if (aiDelay <= 0) aiThrow();
    }

    if (isAnyMoving()) {
      for (var i = 0; i < stones.length; i++) {
        if (stones[i].moving && !stones[i].dead) moveStone(stones[i]);
      }
      collideAll();
      pruneStones();
      if (slideSoundCd <= 0 && isAnyMoving()) {
        audio('type');
        slideSoundCd = 42;
      }
    }

    if (!isAnyMoving()) {
      for (var j = stones.length - 1; j >= 0; j--) {
        if (!stones[j].moving) {
          stones[j].trailFade = Math.max(0, (stones[j].trailFade || 0) - 0.012);
          if (stones[j].trailFade <= 0) stones[j].trail = [];
        }
      }
      if (activeStone) {
        activeStone = null;
        onThrowDone();
      }
    }

    updateHud();
  }

  /* ---------- 绘制 ---------- */
  var SCRATCHES = (function () {
    var arr = [], s = 20240517;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < 78; i++) {
      var ang = -Math.PI / 2 + (rnd() - 0.5) * 0.7;
      arr.push({
        x: rnd() * W,
        y: SHEET.t + rnd() * (SHEET.b - SHEET.t),
        len: 5 + rnd() * 30,
        ang: ang,
        alpha: 0.035 + rnd() * 0.085,
        w: 0.5 + rnd() * 1.1
      });
    }
    return arr;
  })();

  function drawIce() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c6c88');
    g.addColorStop(0.42, '#1b4a63');
    g.addColorStop(0.72, '#123648');
    g.addColorStop(1, '#0a2233');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var glow = ctx.createRadialGradient(CX, CY, 6, CX, CY, 205);
    glow.addColorStop(0, 'rgba(160,235,255,0.22)');
    glow.addColorStop(0.45, 'rgba(90,190,225,0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 反光带
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(-0.34);
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    ctx.fillRect(-W, -120, W * 2, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(-W, -46, W * 2, 18);
    ctx.restore();

    // 细划痕纹理
    for (var i = 0; i < SCRATCHES.length; i++) {
      var s = SCRATCHES[i];
      ctx.strokeStyle = 'rgba(220,248,255,' + s.alpha + ')';
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(s.ang) * s.len, s.y + Math.sin(s.ang) * s.len);
      ctx.stroke();
    }

    /* 冰面变化视觉层：快冰 / 糙冰 / 旋冰 */
    var kind = phase === 'over' ? 'normal' : iceInfo().key;
    if (kind === 'fast') {
      var fg = ctx.createLinearGradient(0, 0, 0, H);
      fg.addColorStop(0, 'rgba(120,240,255,0.10)');
      fg.addColorStop(1, 'rgba(0,180,230,0.02)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.strokeStyle = 'rgba(190,250,255,0.16)';
      ctx.lineWidth = 1.4;
      for (var fi = 0; fi < 9; fi++) {
        var fy = 40 + fi * 56, fx = 20 + (fi * 67) % (W - 40);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + 46, fy - 12);
        ctx.stroke();
      }
      ctx.restore();
    } else if (kind === 'rough') {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (var ri = 0; ri < 26; ri++) {
        var rx = 14 + (ri * 53) % (W - 28);
        var ry = 30 + (ri * 79) % (H - 60);
        var rr = 1.2 + (ri % 3) * 0.7;
        ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#dfe9ff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (kind === 'curl') {
      var cg = ctx.createRadialGradient(CX, CY, 40, CX, CY, 360);
      cg.addColorStop(0, 'rgba(185,103,255,0.10)');
      cg.addColorStop(1, 'rgba(90,30,160,0.02)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.strokeStyle = 'rgba(200,150,255,0.14)';
      ctx.lineWidth = 2;
      for (var ci = 0; ci < 4; ci++) {
        ctx.beginPath();
        ctx.arc(CX, CY, 74 + ci * 46, -0.6 + ci * 0.4, 1.5 + ci * 0.4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 边缘暗角
    var vig = ctx.createRadialGradient(CX, H * 0.46, 130, CX, H * 0.46, 390);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.72, 'rgba(0,0,0,0.10)');
    vig.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawRink() {
    ctx.save();
    ctx.strokeStyle = 'rgba(170,228,255,0.34)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(SHEET.l, SHEET.t, SHEET.r - SHEET.l, SHEET.b - SHEET.t);

    ctx.strokeStyle = 'rgba(190,238,255,0.14)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(SHEET.l, CY);
    ctx.lineTo(SHEET.r, CY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 前置线 / 投掷线
    ctx.strokeStyle = 'rgba(220,248,255,0.17)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(SHEET.l + 2, 386); ctx.lineTo(SHEET.r - 2, 386); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,248,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(SHEET.l + 2, 424); ctx.lineTo(SHEET.r - 2, 424); ctx.stroke();

    // 起踏器
    ctx.fillStyle = 'rgba(7,18,26,0.85)';
    ctx.fillRect(LAUNCH_X - 9, LAUNCH_Y + 14, 7, 8);
    ctx.fillStyle = 'rgba(180,230,250,0.35)';
    ctx.fillRect(LAUNCH_X - 9, LAUNCH_Y + 14, 7, 1.5);
    ctx.fillStyle = 'rgba(7,18,26,0.85)';
    ctx.fillRect(LAUNCH_X + 2, LAUNCH_Y + 14, 7, 8);
    ctx.fillStyle = 'rgba(180,230,250,0.35)';
    ctx.fillRect(LAUNCH_X + 2, LAUNCH_Y + 14, 7, 1.5);
    ctx.restore();
  }

  function drawHouse() {
    var rings = [
      { r: 56, c: 'rgba(198,52,60,0.94)' },
      { r: 44, c: 'rgba(240,249,255,0.95)' },
      { r: 32, c: 'rgba(45,103,208,0.95)' },
      { r: 21, c: 'rgba(244,250,255,0.97)' },
      { r: 10, c: 'rgba(198,52,60,0.97)' }
    ];
    ctx.save();
    ctx.shadowColor = 'rgba(120,220,255,0.45)';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(220,248,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(CX, CY, 57, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    for (var i = 0; i < rings.length; i++) {
      ctx.fillStyle = rings[i].c;
      ctx.beginPath();
      ctx.arc(CX, CY, rings[i].r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 网格
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, 56, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (var gx = CX - 56; gx <= CX + 56; gx += 14) {
      ctx.beginPath(); ctx.moveTo(gx, CY - 56); ctx.lineTo(gx, CY + 56); ctx.stroke();
    }
    for (var gy = CY - 56; gy <= CY + 56; gy += 14) {
      ctx.beginPath(); ctx.moveTo(CX - 56, gy); ctx.lineTo(CX + 56, gy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (var k = 0; k < 8; k++) {
      var a = k * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(a) * 56, CY + Math.sin(a) * 56);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    for (var r2 = 0; r2 < rings.length; r2++) {
      ctx.beginPath(); ctx.arc(CX, CY, rings[r2].r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(CX, CY, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawTrails() {
    for (var i = 0; i < stones.length; i++) {
      var st = stones[i];
      if (st.dead || !st.trail || st.trail.length < 2 || st.trailFade <= 0) continue;
      ctx.save();
      ctx.lineCap = 'round';
      for (var k = 1; k < st.trail.length; k++) {
        var t = k / (st.trail.length - 1);
        ctx.strokeStyle = 'rgba(214,246,255,' + (0.26 * st.trailFade * t) + ')';
        ctx.lineWidth = 1.2 + t * 2.6;
        ctx.beginPath();
        ctx.moveTo(st.trail[k - 1].x, st.trail[k - 1].y);
        ctx.lineTo(st.trail[k].x, st.trail[k].y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawStone(st) {
    var accent = st.me ? '#ff2d95' : '#00f0ff';
    ctx.save();
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(st.x + 2.6, st.y + 4.2, ROCK_R * 1.06, ROCK_R * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    if (st.moving) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 9;
    }
    // 花岗岩体
    var body = ctx.createRadialGradient(st.x - 4, st.y - 4.5, 1, st.x, st.y, ROCK_R);
    body.addColorStop(0, '#fbfdff');
    body.addColorStop(0.26, '#cbd5de');
    body.addColorStop(0.62, '#7b8794');
    body.addColorStop(0.9, '#46515d');
    body.addColorStop(1, '#2c3540');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(st.x, st.y, ROCK_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 外缘
    ctx.strokeStyle = 'rgba(238,248,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(st.x, st.y, ROCK_R - 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // 花岗岩斑点（固定 seed，不闪烁）
    var seed = st.seed || 1;
    ctx.fillStyle = 'rgba(48,60,72,0.30)';
    for (var i = 0; i < 5; i++) {
      var a = seed + i * 1.73;
      var rr = ROCK_R * (0.22 + ((seed + i * 37) % 10) / 16);
      ctx.beginPath();
      ctx.arc(st.x + Math.cos(a) * rr, st.y + Math.sin(a) * rr * 0.9, 0.8 + (i % 2) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 顶面（3D 高光）
    var top = ctx.createRadialGradient(st.x - 3, st.y - 4.5, 1, st.x, st.y - 1.5, 8.2);
    top.addColorStop(0, 'rgba(255,255,255,0.98)');
    top.addColorStop(0.45, 'rgba(219,230,239,0.95)');
    top.addColorStop(1, 'rgba(140,154,167,0.9)');
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.arc(st.x, st.y - 1.5, 8.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(st.x, st.y - 1.5, 8.1, 0, Math.PI * 2);
    ctx.stroke();

    // 把手
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(st.x, st.y - 1.5, 4.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(st.x - 1.4, st.y - 3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    if (st.moving) {
      ctx.strokeStyle = st.me ? 'rgba(255,45,149,0.35)' : 'rgba(0,240,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(st.x, st.y, ROCK_R + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function predictPath() {
    var p = {
      x: LAUNCH_X, y: LAUNCH_Y,
      v: BASE_V + aimPower * SPAN_V,
      a: aimAngle * Math.PI / 180,
      spin: spinDir * 0.85 * curlMul()
    };
    var pts = [];
    for (var i = 0; i < 170; i++) {
      var r = slide(p, FRICTION * iceMul(), 1);
      p.x = r.x; p.y = r.y; p.v = r.v; p.a = r.a;
      if (i % 5 === 0) pts.push({ x: p.x, y: p.y });
      if (p.v <= 0.06) break;
      if (p.x < SHEET.l || p.x > SHEET.r || p.y < SHEET.t || p.y > SHEET.b) break;
    }
    return pts;
  }

  function drawAim() {
    if (!canThrow()) return;
    var ang = aimAngle * Math.PI / 180;
    var pts = predictPath();

    ctx.save();
    ctx.strokeStyle = 'rgba(160,238,255,0.52)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -(performance.now() / 90) % 10;
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 落点标记
    if (pts.length) {
      var last = pts[pts.length - 1];
      ctx.strokeStyle = 'rgba(255,230,0,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(last.x, last.y, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(last.x - 7, last.y); ctx.lineTo(last.x + 7, last.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(last.x, last.y - 7); ctx.lineTo(last.x, last.y + 7); ctx.stroke();
    }

    // 方向箭头
    var len = 46 + aimPower * 176;
    var ex = LAUNCH_X + Math.sin(ang) * len;
    var ey = LAUNCH_Y - Math.cos(ang) * len;
    var grad = ctx.createLinearGradient(LAUNCH_X, LAUNCH_Y, ex, ey);
    grad.addColorStop(0, 'rgba(0,240,255,0.95)');
    grad.addColorStop(0.55, 'rgba(120,160,255,0.95)');
    grad.addColorStop(1, 'rgba(255,45,149,0.98)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(LAUNCH_X, LAUNCH_Y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // 箭头头部
    var ah = 11;
    var lx = ex - Math.sin(ang) * ah, ly = ey + Math.cos(ang) * ah;
    var px = Math.cos(ang) * ah * 0.55, py = Math.sin(ang) * ah * 0.55;
    ctx.fillStyle = '#ff2d95';
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(lx + px, ly + py);
    ctx.lineTo(lx - px, ly - py);
    ctx.closePath();
    ctx.fill();

    // 力度环
    ctx.strokeStyle = 'rgba(0,240,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(LAUNCH_X, LAUNCH_Y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = aimPower > 0.82 ? 'rgba(255,45,149,0.95)' : 'rgba(255,230,0,0.9)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(LAUNCH_X, LAUNCH_Y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * aimPower);
    ctx.stroke();

    // 投掷预览壶
    ctx.globalAlpha = 0.9;
    drawStone({ x: LAUNCH_X, y: LAUNCH_Y, me: true, seed: 42, moving: false });
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + p.life * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px monospace';
    for (var i = 0; i < floats.length; i++) {
      var f = floats[i];
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a2233';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shakeFrames > 0) {
      var amp = Math.min(6, shakeFrames * 0.85);
      ctx.translate((Math.random() - 0.5) * amp * 2, (Math.random() - 0.5) * amp * 2);
    }
    drawIce();
    drawRink();
    drawHouse();
    drawTrails();
    for (var i = 0; i < stones.length; i++) {
      if (!stones[i].dead) drawStone(stones[i]);
    }
    drawAim();
    drawParticles();
    drawFloats();
    ctx.restore();
  }

  /* ---------- 帮助文案 ---------- */
  var hd = document.createElement('div');
  hd.className = 'crl-help';
  hd.innerHTML = T('gs.curling.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    newMatch();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    audio('ui');
  };

  /* 调试钩子：仅 ?qa=1 时挂载，正常访问不暴露可篡改状态的入口 */
  if (QA_ON) {
    var qaState = function () {
      var fm = FORMATS[format] || FORMATS.standard;
      return { phase: phase, end: endIndex + 1, ends: ENDS,
        perSide: PER_SIDE, total: TOTAL, format: format, preplace: fm.preplace, diff: diff,
        scoreMine: scoreMine, scoreAI: scoreAI, turn: turn, endFirst: endFirst,
        throwsDone: throwsDone, ice: iceInfo().key, iceLabel: T(iceInfo().label), iceKinds: iceKinds.slice(),
        sweepLeft: sweepLeft, spinDir: spinDir, aimAngle: aimAngle, aimPower: aimPower,
        stones: stones.length, active: !!activeStone,
        activeSwept: activeStone ? activeStone.swept : 0,
        over: over, submitted: submitted, paused: paused, interWait: interWait,
        collisions: collisions, particles: particles.length, floats: floats.length, shake: shakeFrames,
        msg: msgEl ? msgEl.textContent : '', best: bestShown,
        overlay: !!(overlayEl && overlayEl.classList.contains('show')),
        overlayTitle: ovTitle ? ovTitle.textContent : '',
        overlaySub: ovSub ? ovSub.textContent : '',
        overlayStats: ovStats ? ovStats.innerHTML : '',
        stonePos: stones.map(function (s) {
          return { x: s.x, y: s.y, me: s.me, moving: s.moving, placed: !!s.placed, dead: !!s.dead };
        }),
        endScores: endScores.slice() };
    };
    window.__qa = {
      state: qaState,
      start: function (fmt, d) {
        format = fmt === 'mixed' ? 'mixed' : 'standard';
        formatRow.querySelectorAll('.mode-btn').forEach(function (b) { b.classList.toggle('selected', b.getAttribute('data-f') === format); });
        newMatch(d || diff);
        return qaState();
      },
      saveNow: function () { return window.Arcade && Arcade.savegame ? Arcade.savegame.write() : false; },
      loadSave: function () { return window.Arcade && Arcade.savegame ? Arcade.savegame.resume() : false; },
      clearSave: function () { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); },
      saved: function () { try { return JSON.parse(localStorage.getItem('arcade_save_curling') || 'null'); } catch (e) { return null; } },
      /* 真实模拟推进（不是 forceFinish）：同步跑 update，完成投壶/刷冰/碰撞/端切换 */
      step: function (n) {
        n = Math.max(0, Math.min(20000, Math.floor(Number(n) || 0)));
        for (var i = 0; i < n; i++) update();
        return qaState();
      },
      run: function (max) {
        max = Math.max(1, Math.min(20000, Math.floor(Number(max) || 4000)));
        var i = 0;
        for (; i < max; i++) {
          if (over || paused) break;
          update();
          if (canThrow()) break;
        }
        return { ticks: i, canThrow: canThrow(), state: qaState() };
      },
      fast: function (on) { qaFast = !!on; return qaFast; },
      mute: function (on) { qaMute = !!on; return qaMute; },
      canThrow: function () { return canThrow(); },
      spin: function (v) { spinDir = (Number(v) < 0) ? -1 : 1; updateHud(); return spinDir; },
      sweep: function () { return doSweep(); },
      pause: function (v) {
        var want = (typeof v === 'undefined') ? !paused : !!v;
        if (want !== paused) togglePause();
        return paused;
      },
      forceIce: function (i) {
        var n = Number(i);
        if (!isFinite(n) || n < 0 || n >= ICE_KINDS.length) return null;
        if (!iceKinds.length) rollIce();
        iceKinds[endIndex] = Math.floor(n);
        updateHud();
        return iceInfo().key;
      },
      predict: function (power, angle, spin) {
        var pw = (typeof power === 'number') ? clamp(power, 0.04, 1) : aimPower;
        var ang = (typeof angle === 'number') ? angle : aimAngle;
        var sp = (typeof spin === 'number') ? spin : spinDir;
        var p = {
          x: LAUNCH_X, y: LAUNCH_Y,
          v: BASE_V + pw * SPAN_V,
          a: ang * Math.PI / 180,
          spin: sp * 0.85 * curlMul()
        };
        var n = 0;
        for (var i = 0; i < 170; i++) {
          var r = slide(p, FRICTION * iceMul(), 1);
          p.x = r.x; p.y = r.y; p.v = r.v; p.a = r.a;
          n++;
          if (p.v <= 0.06) break;
          if (p.x < SHEET.l || p.x > SHEET.r || p.y < SHEET.t || p.y > SHEET.b) break;
        }
        return { ice: iceInfo().key, points: n, stop: { x: p.x, y: p.y }, travel: LAUNCH_Y - p.y };
      },
      forceFinish: function (m, a) {
        scoreMine = Number(m) || 0; scoreAI = Number(a) || 0;
        finishMatch();
        return true;
      },
      nextEndNow: function () { if (phase === 'between') { interWait = 1; return true; } return false; },
      throwNow: function (angle, power) {
        if (!canThrow()) return false;
        if (typeof angle === 'number') aimAngle = clamp(angle, -40, 40);
        if (typeof power === 'number') aimPower = clamp(power, 0.04, 1);
        throwHuman();
        return true;
      },
      collideTest: function () {
        if (phase !== 'play') return null;
        var base = { v: 0, a: 0, spin: 0, swept: 0, trail: [], trailFade: 1,
          seed: 0, dead: false, tick: 0 };
        var a = { x: CX - 10, y: CY, v: 0, a: 0, me: true, moving: false };
        var b = { x: CX + 10, y: CY, v: 3.2, a: 0, me: false, moving: true };
        for (var k in base) { a[k] = base[k]; b[k] = base[k]; }
        b.v = 3.2;
        b.a = -Math.PI / 2;
        stones.push(a); stones.push(b);
        collideAll();
        return { particles: particles.length, shake: shakeFrames, stones: stones.length };
      },
      setHouse: function (mineCount, aiCount) {
        if (phase !== 'play') return false;
        stones.length = 0;
        activeStone = null;
        for (var i = 0; i < (mineCount || 0); i++) {
          stones.push({ x: CX + i * 6, y: CY + i * 6, v: 0, a: 0, me: true,
            spin: 0, moving: false, swept: 0, trail: [], trailFade: 1,
            seed: 0, dead: false, tick: 0 });
        }
        for (var j = 0; j < (aiCount || 0); j++) {
          stones.push({ x: CX + 30 + j * 5, y: CY + 30, v: 0, a: 0, me: false,
            spin: 0, moving: false, swept: 0, trail: [], trailFade: 1,
            seed: 0, dead: false, tick: 0 });
        }
        scoreEnd(); return true;
      },
      aiThrow: function () { aiThrow(); },
      skipWait: function () { interWait = 1; },
      launch: function (angle, power, isMe, spin) { return launch(angle, power, isMe, spin); }
    };
  }

  /* ---------- 断点续玩（键 arcade_save_curling） ----------
     主存档始终为「当前赛制」；另按赛制各留一份镜像槽，
     切赛制时先归档，切回时恢复该赛制自己的进度，避免串档。 */
  function slotKey(f) { return 'arcade_save_curling__' + (f === 'mixed' ? 'mixed' : 'standard'); }
  function readSlot(f) {
    try {
      var raw = localStorage.getItem(slotKey(f));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeSlot(obj) {
    if (!obj || !obj.format) return;
    try { localStorage.setItem(slotKey(obj.format), JSON.stringify(obj)); } catch (e) {}
  }
  function dropSlot(f) {
    try { localStorage.removeItem(slotKey(f)); } catch (e) {}
  }

  function collectSave() {
    if (!window.Arcade || over || phase === 'over' || activeStone || !allSettled()) return null;
    var fm = FORMATS[format];
    if (!fm) return null;
    if (phase === 'play' && throwsDone >= TOTAL) return null; /* 防死锁：投满但未结算的脏状态不存 */
    if (!Array.isArray(iceKinds) || iceKinds.length < ENDS) return null;
    var out = {
      v: 2,
      format: format, diff: diff, endIndex: endIndex, throwsDone: throwsDone,
      endFirst: endFirst, turn: turn, scoreMine: scoreMine, scoreAI: scoreAI,
      endScores: endScores.slice(0, ENDS), iceKinds: iceKinds.slice(0, ENDS),
      sweepLeft: sweepLeft, spinDir: spinDir, aimAngle: aimAngle, aimPower: aimPower,
      phase: phase === 'between' ? 'between' : 'play',
      stones: stones.filter(function (s) { return !s.dead; }).map(function (s) {
        return { x: s.x, y: s.y, me: !!s.me, seed: s.seed, placed: !!s.placed };
      })
    };
    writeSlot(out);
    return out;
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    if (!(typeof s.endIndex === 'number' && s.endIndex >= 0 && s.endIndex < ENDS)) return false;
    if (!Array.isArray(s.stones) || !Array.isArray(s.endScores) || !Array.isArray(s.iceKinds)) return false;
    if (s.phase === 'over') return false;

    /* 赛制校验：只接受 standard / mixed；缺字段的旧档按标准赛，但旧档若投掷数超标准上限则拒绝 */
    var fmt = s.format;
    if (fmt !== 'standard' && fmt !== 'mixed') {
      if (fmt !== undefined && fmt !== null && fmt !== '') return false;
      fmt = 'standard';
    }
    var fm = FORMATS[fmt];
    var total = fm.perSide * 2, pre = fm.preplace;

    var throwsN = Number(s.throwsDone);
    if (!isFinite(throwsN) || throwsN < 0) return false;
    throwsN = Math.floor(throwsN);
    var phaseN = s.phase === 'between' ? 'between' : 'play';
    if (phaseN === 'play' && throwsN >= total) return false; /* 防死锁：本端已无壶可投却仍在 play */
    if (phaseN === 'between' && throwsN !== total) return false;
    if (phaseN === 'between' && s.endIndex >= ENDS - 1 && !s.endScores[ENDS - 1]) return false;

    /* 壶坐标 / 数量校验（避免跨赛制数组错位或 NaN） */
    var stoneList = [], placedMe = 0, placedAi = 0;
    for (var si = 0; si < s.stones.length; si++) {
      var raw = s.stones[si];
      if (!raw || typeof raw.x !== 'number' || typeof raw.y !== 'number' ||
          !isFinite(raw.x) || !isFinite(raw.y)) return false;
      if (raw.x < SHEET.l - 2 || raw.x > SHEET.r + 2 ||
          raw.y < SHEET.t - 2 || raw.y > SHEET.b + 2) return false;
      if (raw.placed) { if (raw.me) placedMe++; else placedAi++; }
      stoneList.push({
        x: raw.x, y: raw.y, v: 0, a: 0, me: !!raw.me, spin: 0,
        moving: false, swept: 0, trail: [], trailFade: 1,
        seed: (typeof raw.seed === 'number' && isFinite(raw.seed)) ? raw.seed : 0,
        dead: false, tick: 0, placed: !!raw.placed
      });
    }
    if (placedMe > pre || placedAi > pre) return false; /* 每方预置壶数量不能超过赛制上限 */
    if (stoneList.length > pre * 2 + throwsN) return false;

    /* 比分校验：endScores 必须与累计比分一致，future ends 一律清空 */
    var scores = [null, null, null, null, null, null, null, null];
    var sumM = 0, sumA = 0;
    for (var i = 0; i < ENDS; i++) {
      var rec = s.endScores[i];
      if (i <= s.endIndex) {
        if (rec && typeof rec.m === 'number' && typeof rec.a === 'number' &&
            isFinite(rec.m) && isFinite(rec.a) && rec.m >= 0 && rec.a >= 0) {
          scores[i] = { m: Math.floor(rec.m), a: Math.floor(rec.a) };
          sumM += scores[i].m; sumA += scores[i].a;
        } else if (i === s.endIndex && phaseN === 'between') {
          return false;
        }
      }
    }
    if (phaseN === 'play' && scores[s.endIndex]) return false;
    if (sumM !== Number(s.scoreMine) || sumA !== Number(s.scoreAI)) return false;

    /* 冰面序列：必须逐端完整，异常值视为坏档 */
    var kinds = [];
    for (var k = 0; k < ENDS; k++) {
      var ik = s.iceKinds[k];
      if (typeof ik !== 'number' || !isFinite(ik) || ik < 0 || ik >= ICE_KINDS.length) return false;
      kinds.push(Math.floor(ik));
    }

    /* 落盘状态写入 */
    format = fmt;
    PER_SIDE = fm.perSide; TOTAL = total;
    diff = (s.diff === 'easy' || s.diff === 'normal' || s.diff === 'hard') ? s.diff : 'normal';
    D = DIFFS[diff] || DIFFS.normal;
    endIndex = s.endIndex;
    throwsDone = throwsN;
    endFirst = (endIndex % 2 === 0) ? 'me' : 'ai';
    /* 先手与投掷数推导回合，绝不直接信存档里的 turn，避免双方都等待的死锁 */
    turn = (throwsN % 2 === 0) ? endFirst : otherSide(endFirst);
    scoreMine = sumM; scoreAI = sumA;
    endScores = scores;
    iceKinds = kinds;
    sweepLeft = isFinite(Number(s.sweepLeft)) ? clamp(Math.floor(Number(s.sweepLeft)), 0, 3) : 3;
    spinDir = s.spinDir < 0 ? -1 : 1;
    aimAngle = isFinite(Number(s.aimAngle)) ? clamp(Number(s.aimAngle), -40, 40) : 0;
    aimPower = isFinite(Number(s.aimPower)) ? clamp(Number(s.aimPower), 0.04, 1) : 0.64;
    stones = stoneList;
    particles = []; floats = [];
    activeStone = null; aiming = false; drag = null;
    over = false; submitted = false; paused = false;
    phase = phaseN;
    aiDelay = turn === 'ai' ? (qaFast ? 0 : D.delay) : 0;
    interWait = phaseN === 'between' ? (endIndex >= ENDS - 1 ? 1 : 100) : 0;
    shakeFrames = 0; collideCd = 0; slideSoundCd = 0; sweepFxCd = 0; collisions = 0; outHold = 0;
    matchSeed = Date.now();
    if (overlayEl) overlayEl.classList.remove('show');
    /* 同步难度/赛制按钮状态 */
    diffRow.querySelectorAll('.mode-btn').forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-d') === diff);
    });
    formatRow.querySelectorAll('.mode-btn').forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-f') === format);
    });
    updateBestLabel();
    renderEnds();
    updateHud();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    return true;
  }

  /* ---------- 初始化 ---------- */
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({ id: 'curling', collect: collectSave, apply: applySave, msg: 'gs.curling.resumedToast' });
    updateBestLabel();
    var resumed = false;
    try { resumed = Arcade.savegame.resume(); } catch (e) {}
    if (!resumed) newMatch();
  } else {
    newMatch();
  }
  loopApi = Arcade.loop.start(update, draw, 16);

})();
