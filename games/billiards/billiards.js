/* ============================================================
   台球 Billiards · 旗舰重制（标准 8 球规则）
   - 开球 → 首次合法进球定组 → 清台 → 8 号球胜负
   - 犯规：空杆 / 先碰错组 / 白球落袋 / 无碰库 / 8 号提前落袋
   - 犯规后自由球，白球摆放带碰撞检测与螺旋找位
   - 加塞（9 热点）：上塞跟进、下塞回缩、左右塞改变分离与反弹角
   - 人机 2 档难度 / 双人本地轮流；AI 计算幽灵球与简单反弹
   - 固定步长 + 4 子步物理；摩擦、库边损耗、等质量弹性碰撞、6 袋检测
   - 全 Canvas/CSS 自绘；结算仅单人模式提交最高分
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.billiards.tut1t'), d: T('gs.billiards.tut1') },
  { t: T('gs.billiards.tut2t'), d: T('gs.billiards.tut2') },
  { t: T('gs.billiards.tut3t'), d: T('gs.billiards.tut3') }
];

(function () {
  'use strict';

  var W = 640, H = 350, LEFT = 30, RIGHT = 610, TOP = 26, BOT = 324;
  var R = 9.1, PR = 17, SUB = 4;
  var HEAD_X = LEFT + (RIGHT - LEFT) * 0.26;
  var FOOT_X = LEFT + (RIGHT - LEFT) * 0.72;
  var POCKETS = [
    { x: LEFT, y: TOP }, { x: W / 2, y: TOP - 2 }, { x: RIGHT, y: TOP },
    { x: LEFT, y: BOT }, { x: W / 2, y: BOT + 2 }, { x: RIGHT, y: BOT }
  ];
  var NUM_COLORS = { 1: '#ffd400', 2: '#1560ff', 3: '#ff2d2d', 4: '#8b2dff', 5: '#ff7a00', 6: '#0fd46a', 7: '#a1272f', 8: '#111116' };

  /* ---------- DOM ---------- */
  var root = document.getElementById('game-root');

  function t(k) { return T(k); }
  function fmt(k, o) {
    var s = t(k);
    for (var p in o) s = s.replace('{' + p + '}', o[p]);
    return s;
  }

  var spinDirs = [
    { sx: -1, sy: 1, key: 'spinTopLeft' },
    { sx: 0, sy: 1, key: 'spinTop' },
    { sx: 1, sy: 1, key: 'spinTopRight' },
    { sx: -1, sy: 0, key: 'spinLeft' },
    { sx: 0, sy: 0, key: 'spinReset' },
    { sx: 1, sy: 0, key: 'spinRight' },
    { sx: -1, sy: -1, key: 'spinBottomLeft' },
    { sx: 0, sy: -1, key: 'spinBottom' },
    { sx: 1, sy: -1, key: 'spinBottomRight' }
  ];

  var wrap = document.createElement('div');
  wrap.className = 'bl-wrap';
  var spinHtml = '';
  spinDirs.forEach(function (d, i) {
    spinHtml += '<button type="button" data-sx="' + d.sx + '" data-sy="' + d.sy + '" aria-label="' + t('gs.billiards.' + d.key) + '"></button>';
  });
  wrap.innerHTML =
    '<div class="bl-hud">' +
      '<span class="bl-side p1" id="bl-side0"><i></i><b id="bl-name0"></b><em id="bl-grp0"></em></span>' +
      '<span class="bl-side p2" id="bl-side1"><i></i><b id="bl-name1"></b><em id="bl-grp1"></em></span>' +
      '<span class="bl-stat"><span id="bl-score-lbl"></span><b id="bl-score">0</b></span>' +
      '<span class="bl-stat"><span id="bl-foul-lbl"></span><b id="bl-fouls">0</b></span>' +
      '<span class="bl-stat"><span id="bl-left-lbl"></span><b id="bl-left">15</b></span>' +
      '<span class="bl-stat best"><span id="bl-best-lbl"></span><b id="bl-best">----</b></span>' +
    '</div>' +
    '<div class="bl-stage">' +
      '<canvas class="bl-canvas" id="bl-canvas" aria-label="' + t('gs.billiards.menuTitle') + '"></canvas>' +
      '<div class="bl-foul" id="bl-foul"></div>' +
    '</div>' +
    '<div class="bl-status" id="bl-msg"></div>' +
    '<div class="bl-deck">' +
      '<div class="bl-spinwrap">' +
        '<div class="bl-spinlabel"><span>' + t('gs.billiards.spinTitle') + '</span><b id="bl-spin-name"></b></div>' +
        '<div class="bl-spinpad" id="bl-spinpad">' + spinHtml + '</div>' +
      '</div>' +
      '<div class="bl-powercol">' +
        '<div class="bl-aimrow">' +
          '<button type="button" class="btn" id="bl-aim-l">' + t('gs.billiards.aimLeft') + '</button>' +
          '<button type="button" class="btn" id="bl-aim-r">' + t('gs.billiards.aimRight') + '</button>' +
        '</div>' +
        '<div class="bl-powerbar" id="bl-powerbar" role="slider" aria-valuemin="5" aria-valuemax="100" aria-valuenow="60" tabindex="0" aria-label="' + t('gs.billiards.powerLabel') + '">' +
          '<div class="bl-powerfill" id="bl-powerfill"></div>' +
          '<div class="bl-powertext" id="bl-powertext"></div>' +
        '</div>' +
        '<button type="button" class="btn green bl-shoot" id="bl-shoot">' + t('gs.billiards.shoot') + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="bl-actions">' +
      '<button type="button" class="btn purple" id="bl-pause">' + t('gs.billiards.pause') + '</button>' +
      '<button type="button" class="btn pink" id="bl-restart">' + t('gs.billiards.restart') + '</button>' +
      '<button type="button" class="btn" id="bl-menu-btn">' + t('gs.billiards.backMenu') + '</button>' +
    '</div>' +
    '<div class="bl-panel" id="bl-panel" hidden></div>' +
    '<div class="bl-help" id="bl-help">' + t('gs.billiards.helpText') + '</div>';

  root.appendChild(wrap);

  var canvas = wrap.querySelector('#bl-canvas');
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var msgEl = wrap.querySelector('#bl-msg');
  var foulEl = wrap.querySelector('#bl-foul');
  var panel = wrap.querySelector('#bl-panel');
  var spinPad = wrap.querySelector('#bl-spinpad');
  var spinBtns = [].slice.call(spinPad.querySelectorAll('button'));
  var spinName = wrap.querySelector('#bl-spin-name');
  var powerBar = wrap.querySelector('#bl-powerbar');
  var powerFill = wrap.querySelector('#bl-powerfill');
  var powerText = wrap.querySelector('#bl-powertext');
  var shootBtn = wrap.querySelector('#bl-shoot');
  var pauseBtn = wrap.querySelector('#bl-pause');
  var restartBtn = wrap.querySelector('#bl-restart');
  var menuBtn = wrap.querySelector('#bl-menu-btn');
  var aimL = wrap.querySelector('#bl-aim-l'), aimR = wrap.querySelector('#bl-aim-r');
  var sideEls = [wrap.querySelector('#bl-side0'), wrap.querySelector('#bl-side1')];
  var nameEls = [wrap.querySelector('#bl-name0'), wrap.querySelector('#bl-name1')];
  var grpEls = [wrap.querySelector('#bl-grp0'), wrap.querySelector('#bl-grp1')];
  var scoreEl = wrap.querySelector('#bl-score'), foulEls = wrap.querySelector('#bl-fouls');
  var leftEl = wrap.querySelector('#bl-left'), bestEl = wrap.querySelector('#bl-best');
  wrap.querySelector('#bl-score-lbl').textContent = t('gs.billiards.hudScore');
  wrap.querySelector('#bl-foul-lbl').textContent = t('gs.billiards.hudFouls');
  wrap.querySelector('#bl-left-lbl').textContent = t('gs.billiards.hudLeft');
  wrap.querySelector('#bl-best-lbl').textContent = t('gs.billiards.hudBest');

  /* ---------- 状态 ---------- */
  var state = 'menu', phase = 'menu', paused = false;
  var mode = 'single', difficulty = 'normal';
  var menuMode = 'single', menuDiff = 'normal';
  var scores = [0, 0], fouls = [0, 0];
  var groups = [null, null], openTable = true, current = 0;
  var bonusGiven = [false, false];
  var submitted = false, lastReason = '';
  var aimAngle = 0, power = 60, charging = false;
  var spin = { x: 0, y: 0 };
  var cue = null, balls = [];
  var shot = null, tick = 0;
  var aiWait = 0, aiBallInHand = false;
  var placing = false, aimDrag = false, placeOffset = { x: 0, y: 0 };
  var previewOverlap = false;
  var foulTimer = 0;
  var particles = [], floats = [], rings = [];
  var shake = 0, potFlash = 0;

  /* ---------- 工具 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function hypot(x, y) { return Math.sqrt(x * x + y * y); }
  function dist(ax, ay, bx, by) { return hypot(ax - bx, ay - by); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function best() { try { return Arcade.storage.getBest('billiards'); } catch (e) { return null; } }
  function isHuman(i) { return mode === 'local' || i === 0; }
  function suitOf(num) { if (num === 8) return 'eight'; return num < 8 ? 'solid' : 'stripe'; }
  function otherGroup(g) { return g === 'solid' ? 'stripe' : 'solid'; }
  function groupName(g) {
    if (g === 'solid') return t('gs.billiards.groupSolid');
    if (g === 'stripe') return t('gs.billiards.groupStripe');
    return t('gs.billiards.groupOpen');
  }
  function playerName(i) {
    if (mode === 'local') return t(i === 0 ? 'gs.billiards.playerP1' : 'gs.billiards.playerP2');
    return t(i === 0 ? 'gs.billiards.playerYou' : 'gs.billiards.playerAi');
  }
  function groupRemaining(g) {
    if (!g) return 0;
    var n = 0;
    for (var i = 0; i < balls.length; i++) if (!balls[i].potted && suitOf(balls[i].num) === g) n++;
    return n;
  }
  function objectOnTable() {
    var n = 0;
    for (var i = 0; i < balls.length; i++) if (!balls[i].potted) n++;
    return n;
  }
  function eightOnTable() {
    for (var i = 0; i < balls.length; i++) if (!balls[i].potted && balls[i].num === 8) return true;
    return false;
  }
  function remainingFor(i) {
    if (!openTable && groups[i]) {
      var rem = groupRemaining(groups[i]);
      return rem > 0 ? rem : (eightOnTable() ? 1 : 0);
    }
    return objectOnTable();
  }

  /* ---------- 摆球 ---------- */
  function makeObject(num) {
    return {
      x: 0, y: 0, vx: 0, vy: 0, r: R, num: num,
      color: NUM_COLORS[num > 8 ? num - 8 : num],
      stripe: num > 8, potted: false, cue: false
    };
  }

  function rack() {
    balls = [];
    cue = { x: HEAD_X, y: H / 2, vx: 0, vy: 0, r: R, num: 0, color: '#ffffff', cue: true, inPlay: true, rot: 0, spinActive: 0, spin: { x: 0, y: 0 } };
    var order = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    var gap = 2 * R + 0.7;
    var positions = [];
    for (var col = 0; col < 5; col++) {
      for (var row = 0; row <= col; row++) {
        positions.push({ x: FOOT_X + col * gap * 0.866, y: H / 2 + (row - col / 2) * gap });
      }
    }
    var k = 0;
    for (var p = 0; p < positions.length; p++) {
      var num = p === 4 ? 8 : order[k++];
      var b = makeObject(num);
      b.x = positions[p].x; b.y = positions[p].y;
      balls.push(b);
    }
    shot = null; phase = 'aim'; placing = false; aimDrag = false; charging = false;
    particles = []; floats = []; rings = []; shake = 0; potFlash = 0; foulTimer = 0;
    cue.spin = { x: spin.x, y: spin.y };
    foulEl.classList.remove('show');
  }

  /* ---------- 开局 / 菜单 / 面板 ---------- */
  function startGame(m, d) {
    mode = m; difficulty = d;
    menuMode = m; menuDiff = d;
    scores = [0, 0]; fouls = [0, 0]; groups = [null, null]; openTable = true;
    current = 0; bonusGiven = [false, false]; submitted = false; lastReason = '';
    state = 'play'; paused = false; charging = false;
    aimAngle = 0; power = 60; spin = { x: 0, y: 0 };
    aiWait = 0; aiBallInHand = false; shake = 0; potFlash = 0;
    rack();
    hidePanel();
    refreshHud(); updatePowerUI(); updateSpinUI();
    setMsg(t('gs.billiards.breakMsg'), 'is-info');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function restartGame() {
    if (state === 'menu') startGame(menuMode, menuDiff);
    else startGame(mode, difficulty);
  }

  function showMenu() {
    state = 'menu'; phase = 'menu'; paused = false; charging = false;
    scores = [0, 0]; fouls = [0, 0]; groups = [null, null]; openTable = true; current = 0;
    bonusGiven = [false, false]; submitted = false; lastReason = '';
    rack();
    aimAngle = 0; power = 60; spin = { x: 0, y: 0 };
    buildMenuPanel();
    refreshHud(); updatePowerUI(); updateSpinUI();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function showPanel(html) {
    panel.innerHTML = html;
    panel.hidden = false;
    wrap.classList.add('is-panel');
  }
  function hidePanel() {
    panel.hidden = true;
    panel.innerHTML = '';
    wrap.classList.remove('is-panel');
  }

  function buildMenuPanel() {
    var b = best();
    var bestTxt = b === null ? '----' : b;
    var html =
      '<h2>' + t('gs.billiards.menuTitle') + '</h2>' +
      '<p class="bl-sub">' + t('gs.billiards.menuSub') + '</p>' +
      '<div class="bl-rules"><b style="color:var(--neon-purple)">' + t('gs.billiards.rulesTitle') + '</b><br>' + t('gs.billiards.rulesText') + '<br><span style="color:var(--neon-cyan)">' + t('gs.billiards.rulesScore') + '</span></div>' +
      '<p class="bl-seglabel">' + t('gs.billiards.modeLabel') + '</p>' +
      '<div class="bl-seg" id="bl-mode-seg">' +
        '<button type="button" data-mode="single" class="' + (menuMode === 'single' ? 'is-on' : '') + '">' + t('gs.billiards.modeSingle') + '</button>' +
        '<button type="button" data-mode="local" class="' + (menuMode === 'local' ? 'is-on' : '') + '">' + t('gs.billiards.modeLocal') + '</button>' +
      '</div>' +
      '<p class="bl-seglabel">' + t('gs.billiards.diffLabel') + '</p>' +
      '<div class="bl-seg" id="bl-diff-seg">' +
        '<button type="button" data-diff="normal" class="' + (menuDiff === 'normal' ? 'is-on' : '') + '"' + (menuMode === 'local' ? ' disabled' : '') + '>' + t('gs.billiards.diffNormal') + '</button>' +
        '<button type="button" data-diff="hard" class="' + (menuDiff === 'hard' ? 'is-on' : '') + '"' + (menuMode === 'local' ? ' disabled' : '') + '>' + t('gs.billiards.diffHard') + '</button>' +
      '</div>' +
      '<div class="bl-bestline">' + t('gs.billiards.menuBest') + ' <b>' + bestTxt + '</b></div>' +
      '<button type="button" class="btn green" id="bl-start">' + t('gs.billiards.startBtn') + '</button>' +
      '<div class="bl-note">' + t('gs.billiards.menuHint') + '</div>';
    showPanel(html);
    var modeSeg = panel.querySelector('#bl-mode-seg');
    modeSeg.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-mode]') : null;
      if (!btn) return;
      menuMode = btn.getAttribute('data-mode');
      if (Arcade.audio) Arcade.audio.play('ui');
      buildMenuPanel();
    });
    var diffSeg = panel.querySelector('#bl-diff-seg');
    diffSeg.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-diff]') : null;
      if (!btn || btn.disabled) return;
      menuDiff = btn.getAttribute('data-diff');
      if (Arcade.audio) Arcade.audio.play('ui');
      buildMenuPanel();
    });
    panel.querySelector('#bl-start').addEventListener('click', function () { startGame(menuMode, menuDiff); });
  }

  function buildPausePanel() {
    var html =
      '<h2>' + t('gs.billiards.pausedMsg') + '</h2>' +
      '<div class="bl-stats">' +
        t('gs.billiards.settleScore') + ': <b>' + scores[0] + ' : ' + scores[1] + '</b><br>' +
        t('gs.billiards.settleFouls') + ': <b>' + fouls[0] + ' / ' + fouls[1] + '</b>' +
      '</div>' +
      '<button type="button" class="btn green" id="bl-resume">' + t('gs.billiards.resume') + '</button>' +
      '<button type="button" class="btn pink" id="bl-pause-restart">' + t('gs.billiards.restart') + '</button>' +
      '<button type="button" class="btn purple" id="bl-pause-menu">' + t('gs.billiards.backMenu') + '</button>';
    showPanel(html);
    panel.querySelector('#bl-resume').addEventListener('click', function () { togglePause(); });
    panel.querySelector('#bl-pause-restart').addEventListener('click', function () { paused = false; restartGame(); });
    panel.querySelector('#bl-pause-menu').addEventListener('click', function () { paused = false; showMenu(); });
  }

  function endGame(winner, reason) {
    state = 'settle'; phase = 'settle'; paused = false; charging = false;
    lastReason = reason;
    if (cue) { cue.vx = 0; cue.vy = 0; }
    var isNew = false;
    var submittedNote = '';
    if (mode === 'single') {
      if (scores[0] > 0) {
        try { isNew = Arcade.shell.submitScore(scores[0]); } catch (e) {}
        submitted = true;
        submittedNote = t('gs.billiards.submitNote');
      } else {
        submittedNote = t('gs.billiards.zeroNote');
      }
    } else {
      submittedNote = t('gs.billiards.localNote');
    }
    if (Arcade.audio) Arcade.audio.play(winner === 0 && mode === 'single' ? 'win' : 'lose');
    var title = mode === 'single'
      ? (winner === 0 ? t('gs.billiards.winYou') : t('gs.billiards.winAi'))
      : (winner === 0 ? t('gs.billiards.winP1') : t('gs.billiards.winP2'));
    var sub = reason === 'eight' ? t('gs.billiards.eightWin') :
      reason === 'eightscratch' ? t('gs.billiards.eightScratch') : t('gs.billiards.earlyEight');
    var bestV = best();
    var bestTxt = bestV === null ? '----' : bestV;
    var rem0 = remainingFor(0), rem1 = remainingFor(1);
    var html =
      '<h2>' + title + '</h2>' +
      '<p class="bl-sub">' + sub + '</p>' +
      '<div class="bl-stats">' +
        t('gs.billiards.settleScore') + ': <b>' + playerName(0) + ' ' + scores[0] + ' : ' + scores[1] + ' ' + playerName(1) + '</b><br>' +
        t('gs.billiards.settleFouls') + ': <b>' + playerName(0) + ' ' + fouls[0] + ' · ' + playerName(1) + ' ' + fouls[1] + '</b><br>' +
        t('gs.billiards.settleRemain') + ': <b>' + playerName(0) + ' ' + rem0 + ' · ' + playerName(1) + ' ' + rem1 + ' · ' + fmt('gs.billiards.tableLeft', { n: objectOnTable() }) + '</b>' +
      '</div>' +
      '<div class="bl-bestline">' + t('gs.billiards.settleBest') + ' <b>' + bestTxt + '</b>' + (isNew ? ' · <span style="color:var(--neon-pink)">' + t('gs.billiards.newBest') + '</span>' : '') + '</div>' +
      '<button type="button" class="btn green" id="bl-again">' + t('gs.billiards.replay') + '</button>' +
      (mode === 'single' ? '<button type="button" class="btn yellow" id="bl-diff-again">' + t('gs.billiards.changeDiff') + '</button>' : '') +
      '<button type="button" class="btn purple" id="bl-mode-again">' + t('gs.billiards.changeMode') + '</button>' +
      '<button type="button" class="btn" id="bl-settle-menu">' + t('gs.billiards.backMenu') + '</button>' +
      '<div class="bl-note' + (mode === 'local' || scores[0] <= 0 ? ' warn' : '') + '">' + submittedNote + '</div>';
    showPanel(html);
    refreshHud();
    panel.querySelector('#bl-again').addEventListener('click', function () { startGame(mode, difficulty); });
    var diffBtn = panel.querySelector('#bl-diff-again');
    if (diffBtn) diffBtn.addEventListener('click', function () {
      difficulty = difficulty === 'hard' ? 'normal' : 'hard';
      startGame(mode, difficulty);
    });
    panel.querySelector('#bl-mode-again').addEventListener('click', function () {
      mode = mode === 'single' ? 'local' : 'single';
      startGame(mode, difficulty);
    });
    panel.querySelector('#bl-settle-menu').addEventListener('click', function () { showMenu(); });
  }

  /* ---------- HUD / 消息 ---------- */
  function setMsg(text, tone) {
    msgEl.textContent = text;
    msgEl.className = 'bl-status' + (tone ? ' ' + tone : '');
  }
  function showFoulBanner(text) {
    foulEl.textContent = text;
    foulEl.classList.add('show');
    foulTimer = 100;
  }
  function refreshHud() {
    nameEls[0].textContent = playerName(0);
    nameEls[1].textContent = playerName(1);
    grpEls[0].textContent = groupName(groups[0]);
    grpEls[1].textContent = groupName(groups[1]);
    sideEls[0].classList.toggle('active', current === 0);
    sideEls[1].classList.toggle('active', current === 1);
    scoreEl.textContent = scores[current];
    foulEls.textContent = fouls[current];
    leftEl.textContent = remainingFor(current);
    var b = best();
    bestEl.textContent = b === null ? '----' : b;
    pauseBtn.textContent = paused ? t('gs.billiards.resume') : t('gs.billiards.pause');
    var canShoot = state === 'play' && !paused && phase === 'aim' && isHuman(current);
    shootBtn.disabled = !canShoot;
    aimL.disabled = !canShoot;
    aimR.disabled = !canShoot;
    shootBtn.style.opacity = canShoot ? '' : '.4';
  }
  function updatePowerUI() {
    powerFill.style.width = power + '%';
    powerText.innerHTML = t('gs.billiards.powerLabel') + ' <b>' + Math.round(power) + '%</b>';
    shootBtn.textContent = t('gs.billiards.shoot') + ' ' + Math.round(power) + '%';
    powerBar.setAttribute('aria-valuenow', String(Math.round(power)));
  }
  function updateSpinUI() {
    spinBtns.forEach(function (btn) {
      var sx = Number(btn.getAttribute('data-sx')), sy = Number(btn.getAttribute('data-sy'));
      btn.classList.toggle('is-on', sx === spin.x && sy === spin.y);
    });
    var label = t('gs.billiards.spinReset');
    for (var i = 0; i < spinDirs.length; i++) {
      if (spinDirs[i].sx === spin.x && spinDirs[i].sy === spin.y) {
        label = t('gs.billiards.' + spinDirs[i].key);
        break;
      }
    }
    spinName.textContent = label;
    if (cue && cue.inPlay) cue.spin = { x: spin.x, y: spin.y };
  }
  function setPowerFromClient(clientX) {
    var rect = powerBar.getBoundingClientRect();
    if (!rect.width) return;
    setPower(((clientX - rect.left) / rect.width) * 100);
  }
  function setPower(v) {
    power = clamp(v, 5, 100);
    updatePowerUI();
  }
  function setSpin(sx, sy) {
    spin = { x: sx, y: sy };
    updateSpinUI();
  }
  function cycleSpin() {
    var idx = 0;
    for (var i = 0; i < spinDirs.length; i++) {
      if (spinDirs[i].sx === spin.x && spinDirs[i].sy === spin.y) { idx = i; break; }
    }
    var next = spinDirs[(idx + 1) % spinDirs.length];
    setSpin(next.sx, next.sy);
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------- 物理 ---------- */
  function activeBalls() {
    var arr = [];
    for (var i = 0; i < balls.length; i++) if (!balls[i].potted) arr.push(balls[i]);
    if (cue && cue.inPlay) arr.push(cue);
    return arr;
  }
  function allStopped() {
    if (cue && cue.inPlay && (Math.abs(cue.vx) > 0.06 || Math.abs(cue.vy) > 0.06)) return false;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.potted && (Math.abs(b.vx) > 0.06 || Math.abs(b.vy) > 0.06)) return false;
    }
    return true;
  }

  function inRailMouth(x) {
    return Math.abs(x - W / 2) < PR * 0.65 ||
      Math.abs(x - LEFT) < PR * 0.94 || Math.abs(x - RIGHT) < PR * 0.94;
  }

  function markRail() {
    if (shot && shot.contacted) shot.cushion = true;
  }

  function railCollide(b) {
    if (!b || (b.cue && !b.inPlay) || (b.potted)) return;
    var hit = false;
    var r = b.r;
    var mouth = inRailMouth(b.x);
    if (b.y < TOP + r) {
      if (!mouth) {
        b.y = TOP + r;
        if (b.vy < 0) { b.vy = -b.vy * 0.86; hit = true; }
      }
    } else if (b.y > BOT - r) {
      if (!mouth) {
        b.y = BOT - r;
        if (b.vy > 0) { b.vy = -b.vy * 0.86; hit = true; }
      }
    }
    if (b.x < LEFT + r) {
      b.x = LEFT + r;
      if (b.vx < 0) { b.vx = -b.vx * 0.86; hit = true; }
    } else if (b.x > RIGHT - r) {
      b.x = RIGHT - r;
      if (b.vx > 0) { b.vx = -b.vx * 0.86; hit = true; }
    }
    if (hit) {
      markRail();
      if (b.cue && b.spinActive > 0) {
        var impact = hypot(b.vx, b.vy);
        if (b.x <= LEFT + r || b.x >= RIGHT - r) b.vy += impact * 0.22 * b.spin.x;
        else b.vx += impact * 0.22 * b.spin.x;
        b.spinActive = Math.max(0, b.spinActive - 0.18);
      }
    }
  }

  function potBall(b, pk) {
    if (!shot) return;
    if (b.cue) {
      b.inPlay = false; b.vx = 0; b.vy = 0;
      shot.cuePotted = true;
      shake = Math.max(shake, 7);
      if (Arcade.audio) Arcade.audio.play('error');
      rings.push({ x: POCKETS[pk].x, y: POCKETS[pk].y, r: PR, life: 1, color: '#ff2d95' });
    } else {
      b.potted = true; b.vx = 0; b.vy = 0;
      shot.potted.push(b.num);
      potFlash = 1;
      burst(POCKETS[pk].x, POCKETS[pk].y, b.cue ? '#ffffff' : b.color, 16, 4);
      rings.push({ x: POCKETS[pk].x, y: POCKETS[pk].y, r: PR * 0.8, life: 1, color: b.color });
      floatText(POCKETS[pk].x, POCKETS[pk].y - 12, '+1', b.color);
      if (Arcade.audio) Arcade.audio.play('coin');
    }
    refreshHud();
  }

  function pocketCheck() {
    var list = activeBalls();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.potted) continue;
      if (b.cue && !b.inPlay) continue;
      for (var p = 0; p < POCKETS.length; p++) {
        var dx = b.x - POCKETS[p].x, dy = b.y - POCKETS[p].y;
        var rad = (p % 2 === 0) ? PR * 1.12 : PR * 0.92;
        if (dx * dx + dy * dy < rad * rad) { potBall(b, p); break; }
      }
    }
  }

  function collideBalls() {
    var list = activeBalls();
    for (var a = 0; a < list.length; a++) {
      for (var c = a + 1; c < list.length; c++) {
        var A = list[a], B = list[c];
        if ((A.cue && !A.inPlay) || (B.cue && !B.inPlay)) continue;
        var dx = B.x - A.x, dy = B.y - A.y, d = hypot(dx, dy);
        var min = A.r + B.r;
        if (d > 0 && d < min) {
          var nx = dx / d, ny = dy / d, overlap = (min - d) / 2;
          A.x -= nx * overlap; A.y -= ny * overlap;
          B.x += nx * overlap; B.y += ny * overlap;
          var avn = A.vx * nx + A.vy * ny;
          var bvn = B.vx * nx + B.vy * ny;
          var rel = avn - bvn;
          if (rel > 0) {
            var j = rel * 0.98;
            A.vx -= nx * j; A.vy -= ny * j;
            B.vx += nx * j; B.vy += ny * j;
            if (shot && (A.cue || B.cue)) {
              var other = A.cue ? B : A;
              if (!shot.contacted) {
                shot.contacted = true;
                shot.firstHit = other.num;
                applyCueSpin();
              }
            }
          }
        }
      }
    }
  }

  function applyCueSpin() {
    if (!shot || !cue) return;
    var sx = cue.spin.x, sy = cue.spin.y;
    if (!sx && !sy) return;
    var base = Math.max(hypot(cue.vx, cue.vy), shot.speed * 0.42);
    if (sy) {
      cue.vx += shot.dirx * base * 0.34 * sy;
      cue.vy += shot.diry * base * 0.34 * sy;
    }
    if (sx) {
      cue.vx += -shot.diry * base * 0.24 * sx;
      cue.vy += shot.dirx * base * 0.24 * sx;
    }
    var ns = hypot(cue.vx, cue.vy);
    if (ns > 22) { cue.vx = cue.vx / ns * 22; cue.vy = cue.vy / ns * 22; }
    cue.spinActive = 0.9;
  }

  function physics() {
    for (var s = 0; s < SUB; s++) {
      var list = activeBalls();
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        b.x += b.vx / SUB;
        b.y += b.vy / SUB;
      }
      collideBalls();
      for (var r = 0; r < list.length; r++) railCollide(list[r]);
      pocketCheck();
    }
    var list2 = activeBalls();
    for (var f = 0; f < list2.length; f++) {
      var bb = list2[f];
      if (bb.cue && !bb.inPlay) continue;
      var sp = hypot(bb.vx, bb.vy);
      if (sp < 0.09) { bb.vx = 0; bb.vy = 0; }
      else {
        bb.vx *= 0.982; bb.vy *= 0.982;
        if (sp < 0.35) { bb.vx *= 0.93; bb.vy *= 0.93; }
      }
    }
    if (cue) {
      cue.rot += hypot(cue.vx, cue.vy) * 0.1;
      if (cue.spinActive > 0) cue.spinActive = Math.max(0, cue.spinActive - 0.02);
    }
  }

  /* ---------- 规则结算 ---------- */
  function foulText(reasons) {
    var map = { scratch: 'foulScratch', nohit: 'foulNoHit', wrongfirst: 'foulWrongFirst', noraill: 'foulNoRail' };
    var parts = [];
    for (var i = 0; i < reasons.length; i++) parts.push(t('gs.billiards.' + map[reasons[i]]));
    return t('gs.billiards.foulTitle') + ' · ' + parts.join(' / ');
  }

  function headSpotFree() {
    return findFreeSpot(HEAD_X, H / 2);
  }

  function handleFoul(reasons, s) {
    fouls[current]++;
    scores[current] = Math.max(0, scores[current] - 1);
    var text = foulText(reasons);
    showFoulBanner(text + ' · ' + t('gs.billiards.foulPenalty'));
    if (Arcade.audio) Arcade.audio.play('error');
    var next = 1 - current;
    current = next;
    cue.inPlay = true; cue.vx = 0; cue.vy = 0; cue.spinActive = 0;
    var spot = headSpotFree();
    cue.x = spot.x; cue.y = spot.y;
    spin = { x: 0, y: 0 }; updateSpinUI();
    if (isHuman(next)) {
      phase = 'ballinhand';
      setMsg(text + '\n' + t('gs.billiards.foulPoint') + ' · ' + t('gs.billiards.ballInHand'), 'is-foul');
    } else {
      scheduleAi(true, text + '\n' + t('gs.billiards.foulPoint'));
    }
    refreshHud();
  }

  function resolveShot() {
    var s = shot;
    shot = null;
    if (!s) { phase = 'aim'; return; }

    var reasons = [];
    if (s.cuePotted) reasons.push('scratch');
    if (!s.contacted) reasons.push('nohit');
    if (s.contacted && !openTable && groups[current]) {
      if (s.ownBefore > 0) {
        if (s.firstHit === null || suitOf(s.firstHit) !== groups[current]) reasons.push('wrongfirst');
      } else if (s.firstHit !== 8) {
        reasons.push('wrongfirst');
      }
    }
    if (s.contacted && !s.cushion && s.potted.length === 0) reasons.push('noraill');

    var eightPotted = s.potted.indexOf(8) >= 0;
    if (eightPotted) {
      var win = s.eightEligible && !s.cuePotted && s.firstHit === 8;
      if (win) scores[current] += 3;
      var winner = win ? current : 1 - current;
      endGame(winner, win ? 'eight' : (s.cuePotted ? 'eightscratch' : 'earlyeight'));
      return;
    }

    if (reasons.length) { handleFoul(reasons, s); return; }

    var non8 = [];
    for (var i = 0; i < s.potted.length; i++) if (s.potted[i] !== 8) non8.push(s.potted[i]);
    if (non8.length) scores[current] += non8.length;

    var assigned = false;
    if (openTable && non8.length) {
      var first = non8[0];
      groups[current] = suitOf(first);
      groups[1 - current] = otherGroup(groups[current]);
      openTable = false;
      assigned = true;
    }
    var ownGroup = groups[current];
    var ownPotted = ownGroup ? non8.some(function (n) { return suitOf(n) === ownGroup; }) : false;
    var clearedNow = false;
    if (ownGroup && groupRemaining(ownGroup) === 0 && !bonusGiven[current]) {
      scores[current] += 5;
      bonusGiven[current] = true;
      clearedNow = true;
    }

    var lines = [];
    if (non8.length) lines.push(fmt('gs.billiards.potPoints', { n: non8.length }));
    if (assigned) lines.push(fmt('gs.billiards.groupedMsg', { name: playerName(current), group: groupName(groups[current]) }));
    if (clearedNow) lines.push(t('gs.billiards.groupCleared'));

    var continueTurn = !openTable && (assigned || ownPotted);
    if (continueTurn) {
      if (!isHuman(current)) {
        scheduleAi(false, lines.join('\n'));
      } else {
        phase = 'aim';
        if (!lines.length) lines.push(t('gs.billiards.continueMsg'));
        setMsg(lines.join('\n'), assigned ? 'is-info' : '');
      }
    } else {
      if (!non8.length) lines.push(t('gs.billiards.turnSwitch'));
      var next = 1 - current;
      current = next;
      if (isHuman(next)) {
        phase = 'aim';
        lines.push(fmt('gs.billiards.turnMsg', { name: playerName(next) }));
        setMsg(lines.join('\n'), 'is-info');
      } else {
        scheduleAi(false, lines.join('\n'));
      }
    }
    refreshHud();
  }

  function scheduleAi(ballInHand, prefix) {
    phase = 'thinking';
    aiBallInHand = !!ballInHand;
    aiWait = difficulty === 'hard' ? rand(600, 1000) : rand(900, 1400);
    var text = (prefix ? prefix + '\n' : '') + t('gs.billiards.aiThinking');
    setMsg(text, ballInHand ? 'is-foul' : 'is-info');
    refreshHud();
  }

  /* ---------- 自由球摆放 ---------- */
  function overlapsAt(x, y) {
    if (x < LEFT + R + 1 || x > RIGHT - R - 1 || y < TOP + R + 1 || y > BOT - R - 1) return true;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (b.potted) continue;
      if (dist(x, y, b.x, b.y) < 2 * R + 1.2) return true;
    }
    for (var p = 0; p < POCKETS.length; p++) {
      if (dist(x, y, POCKETS[p].x, POCKETS[p].y) < PR + R) return true;
    }
    return false;
  }

  function findFreeSpot(x, y) {
    x = clamp(x, LEFT + R + 2, RIGHT - R - 2);
    y = clamp(y, TOP + R + 2, BOT - R - 2);
    if (!overlapsAt(x, y)) return { x: x, y: y };
    for (var rad = 4; rad <= 260; rad += 4) {
      var steps = Math.max(12, Math.floor(rad / 5));
      for (var k = 0; k < steps; k++) {
        var a = (k / steps) * Math.PI * 2;
        var nx = clamp(x + Math.cos(a) * rad, LEFT + R + 2, RIGHT - R - 2);
        var ny = clamp(y + Math.sin(a) * rad, TOP + R + 2, BOT - R - 2);
        if (!overlapsAt(nx, ny)) return { x: nx, y: ny };
      }
    }
    for (var gy = TOP + R + 4; gy <= BOT - R - 4; gy += 10) {
      for (var gx = LEFT + R + 4; gx <= RIGHT - R - 4; gx += 10) {
        if (!overlapsAt(gx, gy)) return { x: gx, y: gy };
      }
    }
    return { x: clamp(x, LEFT + R + 2, RIGHT - R - 2), y: clamp(y, TOP + R + 2, BOT - R - 2) };
  }

  /* ---------- AI ---------- */
  function aiTargets() {
    var out = [];
    if (openTable) {
      for (var i = 0; i < balls.length; i++) {
        if (!balls[i].potted && balls[i].num !== 8) out.push(balls[i]);
      }
      if (!out.length) for (var j = 0; j < balls.length; j++) if (!balls[j].potted) out.push(balls[j]);
      return out;
    }
    var g = groups[current];
    if (g) {
      for (var k = 0; k < balls.length; k++) {
        if (!balls[k].potted && suitOf(balls[k].num) === g) out.push(balls[k]);
      }
      if (!out.length) for (var m = 0; m < balls.length; m++) if (!balls[m].potted && balls[m].num === 8) out.push(balls[m]);
      return out;
    }
    return out;
  }

  function pathClear(x1, y1, x2, y2, ignore1, ignore2, skipCue) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1) return true;
    var lim = (2 * R) * 0.93;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (b.potted || b === ignore1 || b === ignore2) continue;
      var t = ((b.x - x1) * dx + (b.y - y1) * dy) / len2;
      if (t < 0 || t > 1) continue;
      var px = x1 + dx * t, py = y1 + dy * t;
      if (dist(b.x, b.y, px, py) < lim) return false;
    }
    if (!skipCue && cue && cue.inPlay) {
      var t2 = ((cue.x - x1) * dx + (cue.y - y1) * dy) / len2;
      if (t2 >= 0 && t2 <= 1) {
        var qx = x1 + dx * t2, qy = y1 + dy * t2;
        if (dist(cue.x, cue.y, qx, qy) < lim) return false;
      }
    }
    return true;
  }

  function mirroredPocket(p, rail) {
    if (rail === 'top') return { x: p.x, y: 2 * TOP - p.y };
    if (rail === 'bottom') return { x: p.x, y: 2 * BOT - p.y };
    if (rail === 'left') return { x: 2 * LEFT - p.x, y: p.y };
    return { x: 2 * RIGHT - p.x, y: p.y };
  }

  function planBestShot() {
    var targets = aiTargets();
    var bestPlan = null;
    for (var i = 0; i < targets.length; i++) {
      var tgt = targets[i];
      for (var p = 0; p < POCKETS.length; p++) {
        var pk = POCKETS[p];
        var ux = pk.x - tgt.x, uy = pk.y - tgt.y;
        var pd = hypot(ux, uy);
        if (pd < 1) continue;
        ux /= pd; uy /= pd;
        var gx = tgt.x - ux * 2 * R, gy = tgt.y - uy * 2 * R;
        if (gx < LEFT + R || gx > RIGHT - R || gy < TOP + R || gy > BOT - R) continue;
        var cdx = gx - cue.x, cdy = gy - cue.y;
        var cd = hypot(cdx, cdy);
        if (cd < R * 1.2) continue;
        var cut = (cdx * ux + cdy * uy) / cd;
        if (cut < 0.3) continue;
        if (!pathClear(cue.x, cue.y, gx, gy, tgt, null, true)) continue;
        if (!pathClear(tgt.x, tgt.y, pk.x, pk.y, tgt, cue, true)) continue;
        var score = cut * cut * 700 / (700 + cd + pd);
        if (!bestPlan || score > bestPlan.score) {
          bestPlan = { angle: Math.atan2(gy - cue.y, gx - cue.x), power: clamp(30 + cd * 0.09 + pd * 0.09, 32, 96), score: score, target: tgt.num, pocket: p, bank: false };
        }
      }
    }
    if (bestPlan && bestPlan.score > 0.32) return bestPlan;

    var rails = ['top', 'bottom', 'left', 'right'];
    for (var i2 = 0; i2 < targets.length; i2++) {
      var tgt2 = targets[i2];
      for (var p2 = 0; p2 < POCKETS.length; p2++) {
        var pk2 = POCKETS[p2];
        for (var r2 = 0; r2 < rails.length; r2++) {
          var mp = mirroredPocket(pk2, rails[r2]);
          var ux2 = mp.x - tgt2.x, uy2 = mp.y - tgt2.y;
          var pd2 = hypot(ux2, uy2);
          if (pd2 < 1) continue;
          ux2 /= pd2; uy2 /= pd2;
          var gx2 = tgt2.x - ux2 * 2 * R, gy2 = tgt2.y - uy2 * 2 * R;
          if (gx2 < LEFT + R || gx2 > RIGHT - R || gy2 < TOP + R || gy2 > BOT - R) continue;
          var cdx2 = gx2 - cue.x, cdy2 = gy2 - cue.y;
          var cd2 = hypot(cdx2, cdy2);
          if (cd2 < R * 1.2) continue;
          var cut2 = (cdx2 * ux2 + cdy2 * uy2) / cd2;
          if (cut2 < 0.34) continue;
          if (!pathClear(cue.x, cue.y, gx2, gy2, tgt2, null, true)) continue;
          if (!pathClear(tgt2.x, tgt2.y, mp.x, mp.y, tgt2, null, true)) continue;
          var score2 = cut2 * cut2 * 700 / (700 + cd2 + pd2) * 0.68;
          if (!bestPlan || score2 > bestPlan.score) {
            bestPlan = { angle: Math.atan2(gy2 - cue.y, gx2 - cue.x), power: clamp(36 + cd2 * 0.1 + pd2 * 0.1, 38, 99), score: score2, target: tgt2.num, pocket: p2, bank: true };
          }
        }
      }
    }
    return bestPlan;
  }

  function aiPlaceCue() {
    var saved = { x: cue.x, y: cue.y };
    var bestSpot = null;
    for (var x = LEFT + R + 6; x <= RIGHT - R - 6; x += 38) {
      for (var y = TOP + R + 6; y <= BOT - R - 6; y += 34) {
        if (overlapsAt(x, y)) continue;
        cue.x = x; cue.y = y;
        var p = planBestShot();
        if (p && (!bestSpot || p.score > bestSpot.score)) bestSpot = { x: x, y: y, score: p.score };
      }
    }
    cue.x = saved.x; cue.y = saved.y;
    if (bestSpot) { cue.x = bestSpot.x; cue.y = bestSpot.y; }
    else { var spot = headSpotFree(); cue.x = spot.x; cue.y = spot.y; }
    cue.vx = 0; cue.vy = 0; cue.spinActive = 0;
  }

  function fallbackAi() {
    var list = aiTargets();
    if (!list.length) {
      for (var i = 0; i < balls.length; i++) if (!balls[i].potted) list.push(balls[i]);
    }
    if (!list.length) return null;
    var bestBall = null, bestD = 1e9;
    for (var j = 0; j < list.length; j++) {
      var d = dist(cue.x, cue.y, list[j].x, list[j].y);
      if (d < bestD) { bestD = d; bestBall = list[j]; }
    }
    return { angle: Math.atan2(bestBall.y - cue.y, bestBall.x - cue.x), power: 44 };
  }

  function aiAct() {
    if (state !== 'play' || paused || phase !== 'thinking') return;
    if (aiBallInHand) { aiPlaceCue(); aiBallInHand = false; }
    var plan = planBestShot();
    var sx = 0, sy = 0, angle = 0, pwr = 44;
    if (plan) {
      angle = plan.angle;
      pwr = plan.power;
      if (difficulty === 'hard' && Math.random() < 0.4) {
        sx = (Math.random() - 0.5) * 0.7;
        sy = (Math.random() - 0.5) * 0.8;
      }
    } else {
      var fb = fallbackAi();
      if (!fb) { phase = 'aim'; return; }
      angle = fb.angle; pwr = fb.power;
      setMsg(t('gs.billiards.aiNoShot') + '\n' + t('gs.billiards.aiThinking'), 'is-info');
    }
    var noise = difficulty === 'hard' ? 0.012 : 0.04;
    aimAngle = angle + (Math.random() - 0.5) * noise * 2;
    power = clamp(pwr + (Math.random() - 0.5) * 6, 30, 100);
    updatePowerUI();
    launch(true, sx, sy);
    setMsg(t('gs.billiards.aiShot'), 'is-info');
  }

  /* ---------- 击球 ---------- */
  function canHumanControl() {
    return state === 'play' && !paused && isHuman(current) && (phase === 'aim' || phase === 'ballinhand');
  }

  function launch(byAI, spinX, spinY) {
    if (!cue || !cue.inPlay) return;
    var sx = spinX || 0, sy = spinY || 0;
    var speed = 6 + (power / 100) * 14;
    shot = {
      contacted: false, firstHit: null, potted: [], cushion: false, cuePotted: false,
      eightEligible: !openTable && !!groups[current] && groupRemaining(groups[current]) === 0,
      ownBefore: groups[current] ? groupRemaining(groups[current]) : 0,
      dirx: Math.cos(aimAngle), diry: Math.sin(aimAngle), speed: speed
    };
    cue.vx = shot.dirx * speed;
    cue.vy = shot.diry * speed;
    cue.spin = { x: sx, y: sy };
    cue.spinActive = 0;
    cue.inPlay = true;
    phase = 'shooting';
    charging = false;
    burst(cue.x, cue.y, '#7ef9ff', 8, 2.5);
    if (Arcade.audio) Arcade.audio.play('drop');
    refreshHud();
    setMsg(byAI ? t('gs.billiards.aiShot') : t('gs.billiards.rolling'), 'is-info');
  }

  /* ---------- 粒子 / 特效 ---------- */
  function burst(x, y, color, n, pow) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, sp = Math.random() * (pow || 3) + 0.5;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, color: color, size: 1.5 + Math.random() * 2.5 });
    }
  }
  function floatText(x, y, txt, color) { floats.push({ x: x, y: y, text: txt, color: color || '#ffe600', life: 1 }); }

  function updateEffects() {
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pt = particles[pi];
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life -= 0.022;
      if (pt.life <= 0) particles.splice(pi, 1);
    }
    for (var fi = floats.length - 1; fi >= 0; fi--) {
      var ft = floats[fi]; ft.y -= 0.6; ft.life -= 0.016;
      if (ft.life <= 0) floats.splice(fi, 1);
    }
    for (var ri = rings.length - 1; ri >= 0; ri--) {
      var rg = rings[ri]; rg.r += 2.2; rg.life -= 0.05;
      if (rg.life <= 0) rings.splice(ri, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - 0.45);
    if (potFlash > 0) potFlash = Math.max(0, potFlash - 0.04);
    if (foulTimer > 0) {
      foulTimer--;
      if (foulTimer <= 0) foulEl.classList.remove('show');
    }
  }

  /* ---------- 绘制 ---------- */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  var speckles = [];
  (function () {
    for (var i = 0; i < 170; i++) {
      speckles.push({ x: LEFT + Math.random() * (RIGHT - LEFT), y: TOP + Math.random() * (BOT - TOP), a: Math.random() * 0.08 + 0.015, r: Math.random() * 1.2 + 0.3 });
    }
  })();

  function drawTable() {
    var wood = ctx.createLinearGradient(0, 0, W, H);
    wood.addColorStop(0, '#1a0f22'); wood.addColorStop(0.35, '#3a1830'); wood.addColorStop(0.62, '#22102a'); wood.addColorStop(1, '#0e0814');
    ctx.fillStyle = wood;
    rr(0, 0, W, H, 15); ctx.fill();
    ctx.strokeStyle = 'rgba(255,45,149,.35)'; ctx.lineWidth = 1.5;
    rr(2.5, 2.5, W - 5, H - 5, 13); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,240,255,.16)'; ctx.lineWidth = 1;
    rr(7, 7, W - 14, H - 14, 11); ctx.stroke();

    var felt = ctx.createRadialGradient(W / 2, H / 2, 24, W / 2, H / 2, W * 0.72);
    felt.addColorStop(0, '#12805a');
    felt.addColorStop(0.55, '#0a6244');
    felt.addColorStop(1, '#053424');
    ctx.fillStyle = felt;
    ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BOT - TOP);

    ctx.save();
    ctx.beginPath(); ctx.rect(LEFT, TOP, RIGHT - LEFT, BOT - TOP); ctx.clip();
    for (var i = 0; i < speckles.length; i++) {
      var s = speckles[i];
      ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.3); ctx.fill();
    }
    ctx.restore();

    // 库边阴影与高光
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(LEFT, TOP, RIGHT - LEFT, 9);
    ctx.fillRect(LEFT, BOT - 9, RIGHT - LEFT, 9);
    ctx.fillRect(LEFT, TOP, 9, BOT - TOP);
    ctx.fillRect(RIGHT - 9, TOP, 9, BOT - TOP);
    ctx.strokeStyle = 'rgba(110,255,210,.16)'; ctx.lineWidth = 1;
    ctx.strokeRect(LEFT + 8, TOP + 8, RIGHT - LEFT - 16, BOT - TOP - 16);

    // 开球线与球点
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(HEAD_X, TOP + 6); ctx.lineTo(HEAD_X, BOT - 6); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.36)';
    ctx.beginPath(); ctx.arc(HEAD_X, H / 2, 2, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(FOOT_X, H / 2, 2, 0, 6.3); ctx.fill();

    // 台边菱形标记
    for (var dx = LEFT + 38; dx < RIGHT - 24; dx += 44) {
      if (Math.abs(dx - W / 2) < 24) continue;
      ctx.fillStyle = 'rgba(0,240,255,.4)';
      ctx.beginPath(); ctx.moveTo(dx, 8); ctx.lineTo(dx + 2.5, 11); ctx.lineTo(dx, 14); ctx.lineTo(dx - 2.5, 11); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(dx, H - 8); ctx.lineTo(dx + 2.5, H - 11); ctx.lineTo(dx, H - 14); ctx.lineTo(dx - 2.5, H - 11); ctx.closePath(); ctx.fill();
    }
    for (var dy = TOP + 42; dy < BOT - 30; dy += 46) {
      ctx.fillStyle = 'rgba(255,45,149,.36)';
      ctx.beginPath(); ctx.moveTo(9, dy); ctx.lineTo(12, dy + 2.5); ctx.lineTo(9, dy + 5); ctx.lineTo(6, dy + 2.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W - 9, dy); ctx.lineTo(W - 6, dy + 2.5); ctx.lineTo(W - 9, dy + 5); ctx.lineTo(W - 12, dy + 2.5); ctx.closePath(); ctx.fill();
    }

    // 袋口
    for (var p = 0; p < POCKETS.length; p++) {
      var pk = POCKETS[p];
      var pg = ctx.createRadialGradient(pk.x, pk.y, 2, pk.x, pk.y, PR);
      pg.addColorStop(0, '#000000');
      pg.addColorStop(0.68, '#020a07');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, PR, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,110,.34)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, PR, 0, 6.3); ctx.stroke();
    }
  }

  function drawBall(b) {
    if (!b || b.potted) return;
    var x = b.x, y = b.y, r = b.r;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x + 2.5, y + 3.4, r * 1.02, r * 0.85, 0, 0, 6.3); ctx.fill();
    ctx.restore();

    if (b.cue) {
      var cg = ctx.createRadialGradient(x - 3.4, y - 4.2, 1, x, y, r);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(0.42, '#f6f5ea');
      cg.addColorStop(0.78, '#d9d9cc');
      cg.addColorStop(1, '#a8a89b');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();

      if (phase === 'aim' && isHuman(current) && state === 'play') {
        ctx.strokeStyle = 'rgba(0,240,255,.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, r + 1.3, 0, 6.3); ctx.stroke();
      }
      // 滚动刻度
      ctx.save();
      ctx.translate(x, y); ctx.rotate(b.rot || 0);
      ctx.strokeStyle = 'rgba(40,60,60,.28)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.55, 0); ctx.stroke();
      ctx.restore();
      // 加塞标记
      var sp = b.spin || { x: 0, y: 0 };
      if (sp.x || sp.y) {
        var mx = x + sp.x * r * 0.5, my = y - sp.y * r * 0.5;
        ctx.fillStyle = '#ff2d95';
        ctx.beginPath(); ctx.arc(mx, my, 2.1, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,230,0,.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, r - 1, 0, 6.3); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(30,60,60,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.3); ctx.stroke();
      }
      return;
    }

    if (b.stripe) {
      ctx.fillStyle = '#f7f5e8';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.clip();
      var sg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      sg.addColorStop(0, b.color);
      sg.addColorStop(1, 'rgba(0,0,0,.32)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.64, 0, 0, 6.3); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(x, y, r - 0.6, r * 0.64, 0, 0, 6.3); ctx.stroke();
    } else {
      var g = ctx.createRadialGradient(x - 3.4, y - 4.2, 1, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(0.3, b.color);
      g.addColorStop(0.78, b.color);
      g.addColorStop(1, 'rgba(0,0,0,.66)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
    }

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.34, y - r * 0.42, r * 0.24, r * 0.17, -0.5, 0, 6.3); ctx.fill();

    // 号码
    ctx.fillStyle = '#f8f8f0';
    ctx.beginPath(); ctx.arc(x, y, 4.15, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#101016';
    ctx.font = 'bold 6.4px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(b.num), x, y + 0.4);
  }

  function rayBall(ox, oy, dx, dy, b) {
    var fx = ox - b.x, fy = oy - b.y;
    var rr2 = 2 * b.r;
    var bb = fx * dx + fy * dy;
    var cc = fx * fx + fy * fy - rr2 * rr2;
    var disc = bb * bb - cc;
    if (disc < 0) return null;
    var tt = -bb - Math.sqrt(disc);
    return tt > 0 ? tt : null;
  }

  function castRay() {
    var dx = Math.cos(aimAngle), dy = Math.sin(aimAngle);
    var maxT = 9999, hitBall = null;
    for (var i = 0; i < balls.length; i++) {
      if (balls[i].potted) continue;
      var t = rayBall(cue.x, cue.y, dx, dy, balls[i]);
      if (t !== null && t < maxT) { maxT = t; hitBall = balls[i]; }
    }
    var tx = 1e9, ty = 1e9;
    if (dx > 0) tx = (RIGHT - R - cue.x) / dx; else if (dx < 0) tx = (LEFT + R - cue.x) / dx;
    if (dy > 0) ty = (BOT - R - cue.y) / dy; else if (dy < 0) ty = (TOP + R - cue.y) / dy;
    var limit = Math.min(tx, ty);
    if (limit < 0) limit = 0;
    if (hitBall && maxT < limit) return { t: maxT, ball: hitBall };
    return { t: limit, ball: null };
  }

  function drawCueStick() {
    var dx = Math.cos(aimAngle), dy = Math.sin(aimAngle);
    var pull = 16 + power / 100 * 18;
    var tipX = cue.x - dx * pull, tipY = cue.y - dy * pull;
    var backLen = 128;
    var buttX = tipX - dx * backLen, buttY = tipY - dy * backLen;
    var sg = ctx.createLinearGradient(tipX, tipY, buttX, buttY);
    sg.addColorStop(0, '#f7ecd2');
    sg.addColorStop(0.12, '#d9ae6d');
    sg.addColorStop(0.5, '#9a6430');
    sg.addColorStop(1, '#29170c');
    ctx.save();
    ctx.shadowColor = 'rgba(255,190,110,.35)'; ctx.shadowBlur = 9;
    ctx.strokeStyle = sg; ctx.lineWidth = 4.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(buttX, buttY); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,240,255,.8)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - dx * 4, tipY - dy * 4); ctx.stroke();
    ctx.restore();
  }

  function drawAim() {
    if (!cue || !cue.inPlay) return;
    var dx = Math.cos(aimAngle), dy = Math.sin(aimAngle);
    var hit = castRay();
    var end = Math.max(20, hit.t);
    var ex = cue.x + dx * end, ey = cue.y + dy * end;

    var lg = ctx.createLinearGradient(cue.x, cue.y, ex, ey);
    lg.addColorStop(0, 'rgba(0,240,255,.92)');
    lg.addColorStop(0.55, 'rgba(255,230,0,.72)');
    lg.addColorStop(1, 'rgba(255,45,149,.12)');
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = lg; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(cue.x + dx * (R + 3), cue.y + dy * (R + 3));
    ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);

    if (hit.ball) {
      var gx = ex, gy = ey;
      ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(gx, gy, R, 0, 6.3); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.beginPath(); ctx.arc(gx, gy, R, 0, 6.3); ctx.fill();
      var odx = hit.ball.x - gx, ody = hit.ball.y - gy, od = hypot(odx, ody) || 1;
      odx /= od; ody /= od;
      ctx.strokeStyle = 'rgba(255,230,0,.62)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(hit.ball.x + odx * R, hit.ball.y + ody * R);
      ctx.lineTo(hit.ball.x + odx * (R + 54), hit.ball.y + ody * (R + 54)); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,240,255,.75)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hit.ball.x, hit.ball.y, R + 2.5, 0, 6.3); ctx.stroke();
    }
    ctx.restore();

    drawCueStick();

    // 力度环
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,0,.92)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cue.x, cue.y, R + 7, -1.5708, -1.5708 + (power / 100) * 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,45,149,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cue.x, cue.y, R + 8.8, 0, 6.3); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawTable();

    for (var i = 0; i < balls.length; i++) if (!balls[i].potted) drawBall(balls[i]);
    if (cue && cue.inPlay) drawBall(cue);

    if (state === 'play' && !paused && phase === 'aim' && isHuman(current)) drawAim();

    if (placing && cue) {
      ctx.strokeStyle = previewOverlap ? 'rgba(255,45,149,.9)' : 'rgba(57,255,20,.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cue.x, cue.y, R + 3, 0, 6.3); ctx.stroke();
      if (previewOverlap) {
        ctx.fillStyle = 'rgba(255,45,149,.18)';
        ctx.beginPath(); ctx.arc(cue.x, cue.y, R + 3, 0, 6.3); ctx.fill();
      }
    }

    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.3); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (var ri = 0; ri < rings.length; ri++) {
      var rg = rings[ri];
      ctx.globalAlpha = Math.max(0, rg.life);
      ctx.strokeStyle = rg.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, 6.3); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (var fi = 0; fi < floats.length; fi++) {
      var f = floats[fi];
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (potFlash > 0) {
      ctx.fillStyle = 'rgba(255,230,0,' + (potFlash * 0.14) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // 顶部状态角标
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    rr(9, 8, 146, 22, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,240,255,.92)';
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(playerName(current) + ' · ' + groupName(groups[current]), 17, 19);

    ctx.restore();
  }

  /* ---------- 输入 ---------- */
  function toCanvas(e) {
    var rect = canvas.getBoundingClientRect();
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    var cw = rect.width || 1, ch = rect.height || 1;
    return { x: (t.clientX - rect.left) * (W / cw), y: (t.clientY - rect.top) * (H / ch) };
  }

  function setAimPoint(p) {
    var dx = p.x - cue.x, dy = p.y - cue.y;
    if (hypot(dx, dy) > 3) aimAngle = Math.atan2(dy, dx);
  }

  function setCuePreview(p) {
    var x = p.x + placeOffset.x, y = p.y + placeOffset.y;
    x = clamp(x, LEFT + R + 2, RIGHT - R - 2);
    y = clamp(y, TOP + R + 2, BOT - R - 2);
    cue.x = x; cue.y = y;
    previewOverlap = overlapsAt(x, y);
  }

  function commitPlace() {
    placing = false;
    if (!cue) return;
    var spot = findFreeSpot(cue.x, cue.y);
    var snapped = dist(spot.x, spot.y, cue.x, cue.y) > 0.5;
    cue.x = spot.x; cue.y = spot.y; cue.vx = 0; cue.vy = 0;
    cue.inPlay = true;
    phase = 'aim';
    previewOverlap = false;
    setMsg(snapped ? t('gs.billiards.snapMsg') : t('gs.billiards.placed'), snapped ? 'is-info' : '');
    if (Arcade.audio) Arcade.audio.play('ui');
    refreshHud();
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!canHumanControl()) return;
    if (phase === 'ballinhand') {
      var p0 = toCanvas(e);
      var grab = dist(p0.x, p0.y, cue.x, cue.y);
      placeOffset = grab < R + 14 ? { x: cue.x - p0.x, y: cue.y - p0.y } : { x: 0, y: 0 };
      placing = true;
      setCuePreview(p0);
      if (e.cancelable) e.preventDefault();
    } else if (phase === 'aim') {
      aimDrag = true;
      setAimPoint(toCanvas(e));
      if (e.cancelable) e.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!canHumanControl()) return;
    if (placing) { setCuePreview(toCanvas(e)); if (e.cancelable) e.preventDefault(); }
    else if (aimDrag && phase === 'aim') { setAimPoint(toCanvas(e)); if (e.cancelable) e.preventDefault(); }
  });
  window.addEventListener('pointerup', function () {
    if (placing) commitPlace();
    aimDrag = false;
  });
  window.addEventListener('pointercancel', function () {
    if (placing) commitPlace();
    aimDrag = false;
  });

  shootBtn.addEventListener('pointerdown', function (e) {
    if (!canHumanControl() || phase !== 'aim') return;
    charging = true;
    shootBtn.classList.add('charging');
    if (e.cancelable) e.preventDefault();
  });
  window.addEventListener('pointerup', function () {
    if (!charging) return;
    charging = false;
    shootBtn.classList.remove('charging');
    if (state === 'play' && !paused && phase === 'aim' && isHuman(current)) {
      launch(false, spin.x, spin.y);
    }
  });
  window.addEventListener('pointercancel', function () {
    if (!charging) return;
    charging = false;
    shootBtn.classList.remove('charging');
  });
  shootBtn.addEventListener('click', function () {
    if (phase === 'aim' && canHumanControl()) launch(false, spin.x, spin.y);
  });

  var powerDrag = false;
  powerBar.addEventListener('pointerdown', function (e) {
    if (!canHumanControl()) return;
    powerDrag = true;
    setPowerFromClient(e.clientX);
    if (e.cancelable) e.preventDefault();
  });
  powerBar.addEventListener('pointermove', function (e) {
    if (powerDrag) { setPowerFromClient(e.clientX); if (e.cancelable) e.preventDefault(); }
  });
  window.addEventListener('pointerup', function () { powerDrag = false; });

  function rotateAim(delta) {
    if (!canHumanControl()) return;
    aimAngle += delta;
    if (Arcade.audio) Arcade.audio.play('move');
  }
  aimL.addEventListener('click', function () { rotateAim(-0.03); });
  aimR.addEventListener('click', function () { rotateAim(0.03); });

  spinBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setSpin(Number(btn.getAttribute('data-sx')), Number(btn.getAttribute('data-sy')));
      if (Arcade.audio) Arcade.audio.play('ui');
    });
  });

  function togglePause() {
    if (state !== 'play') return;
    paused = !paused;
    charging = false;
    shootBtn.classList.remove('charging');
    if (paused) {
      buildPausePanel();
      setMsg(t('gs.billiards.pausedMsg'), 'is-info');
    } else {
      hidePanel();
      setMsg(t('gs.billiards.resumeMsg'), 'is-info');
    }
    if (Arcade.audio) Arcade.audio.play('ui');
    refreshHud();
  }

  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', function () { restartGame(); });
  menuBtn.addEventListener('click', function () { showMenu(); });

  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'KeyP') { togglePause(); e.preventDefault(); return; }
    if (e.code === 'KeyR') { restartGame(); e.preventDefault(); return; }
    if (state !== 'play' || paused) return;
    if (e.code === 'KeyS') { cycleSpin(); e.preventDefault(); return; }
    if (!canHumanControl()) return;
    if (e.code === 'ArrowLeft') { rotateAim(-0.022); e.preventDefault(); }
    else if (e.code === 'ArrowRight') { rotateAim(0.022); e.preventDefault(); }
    else if (e.code === 'ArrowUp') { setPower(power + 3); e.preventDefault(); }
    else if (e.code === 'ArrowDown') { setPower(power - 3); e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'Enter') {
      if (phase === 'aim') { launch(false, spin.x, spin.y); e.preventDefault(); }
    }
  });

  /* ---------- 主循环 ---------- */
  function step() {
    tick++;
    updateEffects();

    if (charging && canHumanControl()) {
      setPower(power + 1.5);
    }

    if (state !== 'play' || paused) return;

    if (phase === 'thinking') {
      aiWait -= 16;
      if (aiWait <= 0) aiAct();
      return;
    }
    if (phase === 'shooting') {
      physics();
      if (allStopped()) resolveShot();
    }
  }

  window.GAME_RESTART = function () { restartGame(); };

  showMenu();
  Arcade.loop.start(step, draw, 16);
})();
