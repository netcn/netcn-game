/* 太空射击 Space Shooter —— 旗舰级重制
   Canvas + HiDPI；多层视差星空、渐变机体、引擎尾焰、护盾分段环、爆炸粒子
   3 机体 × 3 武器 × 武器 Lv1~3；僚机编队；3 种多阶段 Boss；战役 / 无尽模式
   无尽模式每 5 波叠加词缀（敌速 / 弹幕密度 / 计分 / 护盾恢复 / 僚机火力）
   护盾状态机 ready → broken（6~8s 冷却）→ charging（逐段充能）
   键盘：WASD / 方向键移动，自动开火，空格 / B 炸弹，L 僚机编队，P / Esc 暂停
   触屏：画布拖拽移动 + 底部炸弹 / 僚机按钮 */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.spaceshooter.tut1t'), d: T('gs.spaceshooter.tut1') },
  { t: T('gs.spaceshooter.tut2t'), d: T('gs.spaceshooter.tut2') },
  { t: T('gs.spaceshooter.tut3t'), d: T('gs.spaceshooter.tut3') },
  { t: T('gs.spaceshooter.tut4t'), d: T('gs.spaceshooter.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  /* index.html 仅做版本号变更；这里注入旗舰版布局样式（覆盖同页基础样式） */
  var flagshipStyle = document.createElement('style');
  flagshipStyle.textContent = `
    .ss-wrap { padding: 10px; width: min(520px, 100%); margin: 0 auto; text-align: center; }
    .ss-hud { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px;
      font-size: 12px; color: var(--text-dim); margin-bottom: 5px; }
    .ss-hud-item { display: inline-flex; align-items: baseline; gap: 5px; }
    .ss-hud-item em { font-style: normal; font-size: 9px; letter-spacing: 1px; opacity: .8; }
    .ss-hud-item b { font-family: var(--font-pixel); font-weight: 400; font-size: 11px;
      color: var(--neon-cyan); text-shadow: 0 0 8px rgba(0, 240, 255, 0.45); }
    .ss-hud-item b.warn { color: var(--neon-pink); text-shadow: 0 0 8px rgba(255, 45, 149, 0.6); }
    .ss-affix { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px 8px;
      font-size: 10px; color: var(--neon-yellow); margin: 0 0 5px; line-height: 1.5; }
    .ss-affix span { border: 1px solid rgba(255, 230, 0, 0.35); border-radius: 8px;
      padding: 1px 6px; background: rgba(255, 230, 0, 0.08); }
    .ss-stage { position: relative; width: 100%; max-width: 480px; margin: 0 auto; }
    .ss-bossbar { position: absolute; top: 9px; left: 12px; right: 12px; z-index: 5;
      display: flex; align-items: center; gap: 6px; pointer-events: none; }
    .ss-bossbar span { font-family: var(--font-pixel); font-size: 8px; color: var(--neon-pink);
      text-shadow: 0 0 10px rgba(255, 45, 149, 0.8); white-space: nowrap;
      max-width: 46%; overflow: hidden; text-overflow: ellipsis; }
    .ss-bossbar i { position: relative; flex: 1; height: 11px; display: block; overflow: hidden;
      border-radius: 6px; border: 1px solid rgba(255, 45, 149, 0.6); background: rgba(0, 0, 0, 0.55); }
    .ss-bossbar b { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; height: 100%;
      background: linear-gradient(90deg, #ff2d95, #ffe600);
      box-shadow: 0 0 12px rgba(255, 45, 149, 0.7); transition: width 0.1s linear; }
    .ss-bossbar u { position: absolute; inset: 0; display: block; pointer-events: none;
      background: linear-gradient(90deg,
        transparent calc(33.33% - 1px), rgba(0, 0, 0, 0.85) calc(33.33% - 1px),
        rgba(0, 0, 0, 0.85) calc(33.33% + 1px), transparent calc(33.33% + 1px),
        transparent calc(66.66% - 1px), rgba(0, 0, 0, 0.85) calc(66.66% - 1px),
        rgba(0, 0, 0, 0.85) calc(66.66% + 1px), transparent calc(66.66% + 1px)); }
    .ss-overlay { position: absolute; inset: 0; z-index: 6; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start; overflow-y: auto; padding: 12px;
      background: radial-gradient(ellipse at center, rgba(10, 12, 26, 0.93), rgba(4, 5, 12, 0.97));
      border-radius: 12px; backdrop-filter: blur(3px); }
    .ss-ov-inner { margin: auto 0; width: 100%; display: flex; flex-direction: column;
      align-items: center; gap: 7px; }
    @keyframes ssOvIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ssOvInnerIn { from { opacity: 0; transform: translateY(12px) scale(.95); } to { opacity: 1; transform: none; } }
    .ss-overlay:not(.ss-hide) { animation: ssOvIn .2s ease-out both; }
    .ss-overlay:not(.ss-hide) .ss-ov-inner { animation: ssOvInnerIn .28s cubic-bezier(.2,.9,.3,1.18) both; }
    .ss-overlay h2 { margin: 0; font-family: var(--font-pixel); font-size: 13px; line-height: 1.5;
      color: var(--neon-cyan); text-shadow: 0 0 14px rgba(0, 240, 255, 0.65); }
    .ss-ov-text { font-size: 11.5px; line-height: 1.65; color: var(--text-dim); max-width: 340px; }
    .ss-ov-text b { color: var(--neon-yellow); font-weight: 400; }
    .ss-ov-text .ss-new { color: var(--neon-yellow); font-family: var(--font-pixel); font-size: 10px;
      text-shadow: 0 0 10px rgba(255, 230, 0, 0.8); margin-top: 2px; }
    .ss-ov-btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 2px; }
    .ss-ov-btns .btn { min-height: 44px; min-width: 96px; }
    .ss-select { width: 100%; display: flex; flex-direction: column; gap: 5px; }
    .ss-select-label { align-self: flex-start; font-size: 9px; letter-spacing: 1px;
      color: var(--text-dim); padding-left: 2px; }
    .ss-opt-row { display: flex; gap: 6px; justify-content: stretch; }
    .ss-opt { flex: 1 1 0; min-width: 0; min-height: 46px; padding: 4px 3px; border-radius: 8px;
      border: 1px solid rgba(0, 240, 255, 0.34); background: rgba(0, 240, 255, 0.06);
      color: var(--text-main); cursor: pointer; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 1px; font: inherit; }
    .ss-opt b { font-family: var(--font-pixel); font-weight: 400; font-size: 9px; color: var(--neon-cyan); }
    .ss-opt i { font-style: normal; font-size: 9px; line-height: 1.25; opacity: .72; }
    .ss-opt.on { border-color: var(--neon-yellow); background: rgba(255, 230, 0, 0.14);
      box-shadow: 0 0 12px rgba(255, 230, 0, 0.38); }
    .ss-opt.on b { color: var(--neon-yellow); }
    .ss-opt:focus-visible { outline: 2px solid var(--neon-yellow); outline-offset: 2px; }
    .ss-msg { min-height: 18px; font-size: 12px; color: var(--neon-cyan); margin: 7px 0 4px;
      line-height: 1.5; transition: color 0.2s; }
    .ss-tools { display: flex; gap: 8px; justify-content: center; margin-bottom: 7px; flex-wrap: wrap; }
    .ss-tools .btn { min-height: 44px; min-width: 74px; }
    .ss-help { font-size: 11px; color: var(--text-dim); line-height: 1.7; text-align: left;
      background: rgba(255, 255, 255, 0.04); border-radius: 10px; padding: 9px 11px; }
    @media (max-width: 400px) {
      .ss-wrap { padding: 8px; }
      .ss-hud { gap: 3px 9px; }
      .ss-hud-item b { font-size: 10px; }
      .ss-hud-item em { font-size: 8px; }
      .ss-ov-text { font-size: 11px; }
      .ss-opt { min-height: 44px; }
      .ss-tools .btn { min-width: 68px; }
    }
    @media (max-width: 340px) {
      .ss-opt i { display: none; }
      .ss-opt b { font-size: 9px; }
      .ss-overlay { padding: 8px; }
      .ss-ov-inner { gap: 5px; }
      .ss-ov-text { font-size: 10.5px; line-height: 1.5; }
      .ss-ov-btns .btn { min-width: 84px; }
    }
  `;
  document.head.appendChild(flagshipStyle);

  var W = 480, H = 640, WAVE_COUNT = 10;

  var SHIPS = {
    assault: {
      key: 'assault', nameKey: 'gs.spaceshooter.shipAssault', descKey: 'gs.spaceshooter.shipAssaultDesc',
      lives: 3, speed: 5.3, fire: 8, r: 9, shieldMax: 2, broken: 400,
      dmg: 1, color: '#00f0ff', accent: '#b967ff'
    },
    guard: {
      key: 'guard', nameKey: 'gs.spaceshooter.shipGuard', descKey: 'gs.spaceshooter.shipGuardDesc',
      lives: 5, speed: 4.1, fire: 10, r: 13, shieldMax: 3, broken: 450,
      dmg: 0.95, color: '#39ff14', accent: '#00f0ff'
    },
    bomber: {
      key: 'bomber', nameKey: 'gs.spaceshooter.shipBomber', descKey: 'gs.spaceshooter.shipBomberDesc',
      lives: 4, speed: 3.9, fire: 12, r: 15, shieldMax: 2, broken: 390,
      dmg: 1.45, color: '#ff9f1c', accent: '#ff2d95'
    }
  };

  var WEAPONS = {
    spread: { key: 'spread', nameKey: 'gs.spaceshooter.weaponSpread', descKey: 'gs.spaceshooter.weaponSpreadDesc', cd: 1, color: '#7dffff' },
    laser: { key: 'laser', nameKey: 'gs.spaceshooter.weaponLaser', descKey: 'gs.spaceshooter.weaponLaserDesc', cd: 0.78, color: '#ffffff' },
    missile: { key: 'missile', nameKey: 'gs.spaceshooter.weaponMissile', descKey: 'gs.spaceshooter.weaponMissileDesc', cd: 1.2, color: '#ffe600' }
  };

  var BOSSES = [
    { id: 'crimson', nameKey: 'gs.spaceshooter.bossCrimson', color: '#ff2d95', accent: '#ffe600', hp: 520, score: 800, w: 172, h: 116 },
    { id: 'prism', nameKey: 'gs.spaceshooter.bossPrism', color: '#00f0ff', accent: '#b967ff', hp: 600, score: 1000, w: 168, h: 118 },
    { id: 'void', nameKey: 'gs.spaceshooter.bossVoid', color: '#39ff14', accent: '#ffe600', hp: 660, score: 1200, w: 160, h: 126 }
  ];

  var AFFIXES = [
    { id: 'swift', nameKey: 'gs.spaceshooter.affixSwift' },
    { id: 'dense', nameKey: 'gs.spaceshooter.affixDense' },
    { id: 'double', nameKey: 'gs.spaceshooter.affixScore' },
    { id: 'regen', nameKey: 'gs.spaceshooter.affixRegen' },
    { id: 'wing', nameKey: 'gs.spaceshooter.affixWing' }
  ];

  /* ---------------- DOM ---------------- */
  var wrap = document.createElement('div');
  wrap.className = 'ss-wrap';
  wrap.innerHTML =
    '<div class="ss-hud">' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudLives') + '</em><b id="ss-lives">3</b></span>' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudShield') + '</em><b id="ss-shield">2/2</b></span>' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudScore') + '</em><b id="ss-score">0</b></span>' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudWave') + '</em><b id="ss-wave">0/' + WAVE_COUNT + '</b></span>' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudShip') + '</em><b id="ss-ship">—</b></span>' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudWeapon') + '</em><b id="ss-weapon">—</b></span>' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudWing') + '</em><b id="ss-wing">0/2</b></span>' +
    '  <span class="ss-hud-item"><em>' + T('gs.spaceshooter.hudBomb') + '</em><b id="ss-bombs">1</b></span>' +
    '</div>' +
    '<div class="ss-affix ss-hide" id="ss-affix"></div>' +
    '<div class="ss-stage">' +
    '  <canvas id="ss-canvas" class="ss-canvas"></canvas>' +
    '  <div class="ss-bossbar ss-hide" id="ss-bossbar"><span id="ss-bossname">BOSS</span><i><b id="ss-bossfill"></b><u></u></i></div>' +
    '  <div class="ss-overlay ss-hide" id="ss-overlay">' +
    '    <div class="ss-ov-inner">' +
    '      <h2 id="ss-ov-title"></h2>' +
    '      <div class="ss-ov-text" id="ss-ov-text"></div>' +
    '      <div class="ss-select ss-hide" id="ss-select">' +
    '        <div class="ss-select-label" id="ss-ship-label"></div>' +
    '        <div class="ss-opt-row" id="ss-ship-row"></div>' +
    '        <div class="ss-select-label" id="ss-weapon-label"></div>' +
    '        <div class="ss-opt-row" id="ss-weapon-row"></div>' +
    '        <div class="ss-select-label" id="ss-mode-label"></div>' +
    '        <div class="ss-opt-row" id="ss-mode-row"></div>' +
    '      </div>' +
    '      <div class="ss-ov-btns">' +
    '        <button class="btn green" id="ss-ov-primary"></button>' +
    '        <button class="btn ss-hide" id="ss-ov-secondary"></button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="ss-msg" id="ss-msg">' + T('gs.spaceshooter.controlsText') + '</div>' +
    '<div class="ss-tools">' +
    '  <button class="btn" id="ss-pause">' + T('gs.spaceshooter.pauseBtn') + '</button>' +
    '  <button class="btn yellow" id="ss-bomb">' + T('gs.spaceshooter.bombBtn') + '</button>' +
    '  <button class="btn purple" id="ss-wingbtn">' + T('gs.spaceshooter.wingBtn') + '</button>' +
    '  <button class="btn" id="ss-restart">' + T('gs.spaceshooter.restart') + '</button>' +
    '</div>' +
    '<div class="ss-help">' + T('gs.spaceshooter.help') + '</div>';
  root.appendChild(wrap);

  var canvas = document.getElementById('ss-canvas');
  var gk = GK.setup(canvas, W, H);
  var ctx = gk.ctx;
  var overlayEl = document.getElementById('ss-overlay');
  var ovTitle = document.getElementById('ss-ov-title');
  var ovText = document.getElementById('ss-ov-text');
  var ovPrimary = document.getElementById('ss-ov-primary');
  var ovSecondary = document.getElementById('ss-ov-secondary');
  var selectEl = document.getElementById('ss-select');
  var shipRow = document.getElementById('ss-ship-row');
  var weaponRow = document.getElementById('ss-weapon-row');
  var modeRow = document.getElementById('ss-mode-row');
  var livesEl = document.getElementById('ss-lives');
  var shieldEl = document.getElementById('ss-shield');
  var scoreEl = document.getElementById('ss-score');
  var waveEl = document.getElementById('ss-wave');
  var shipEl = document.getElementById('ss-ship');
  var weaponEl = document.getElementById('ss-weapon');
  var wingEl = document.getElementById('ss-wing');
  var bombEl = document.getElementById('ss-bombs');
  var affixEl = document.getElementById('ss-affix');
  var bossBar = document.getElementById('ss-bossbar');
  var bossNameEl = document.getElementById('ss-bossname');
  var bossFill = document.getElementById('ss-bossfill');
  var msgEl = document.getElementById('ss-msg');
  var pauseBtn = document.getElementById('ss-pause');
  var bombBtn = document.getElementById('ss-bomb');
  var wingBtn = document.getElementById('ss-wingbtn');
  var restartBtn = document.getElementById('ss-restart');

  document.getElementById('ss-ship-label').textContent = T('gs.spaceshooter.shipLabel');
  document.getElementById('ss-weapon-label').textContent = T('gs.spaceshooter.weaponLabel');
  document.getElementById('ss-mode-label').textContent = T('gs.spaceshooter.modeLabel');

  function optionHtml(group, key, nameKey, descKey) {
    return '<button type="button" class="ss-opt" id="ss-' + group + '-' + key + '" data-group="' + group + '" data-key="' + key + '">' +
      '<b>' + T(nameKey) + '</b><i>' + T(descKey) + '</i></button>';
  }
  shipRow.innerHTML = optionHtml('ship', 'assault', 'gs.spaceshooter.shipAssault', 'gs.spaceshooter.shipAssaultDesc') +
    optionHtml('ship', 'guard', 'gs.spaceshooter.shipGuard', 'gs.spaceshooter.shipGuardDesc') +
    optionHtml('ship', 'bomber', 'gs.spaceshooter.shipBomber', 'gs.spaceshooter.shipBomberDesc');
  weaponRow.innerHTML = optionHtml('weapon', 'spread', 'gs.spaceshooter.weaponSpread', 'gs.spaceshooter.weaponSpreadDesc') +
    optionHtml('weapon', 'laser', 'gs.spaceshooter.weaponLaser', 'gs.spaceshooter.weaponLaserDesc') +
    optionHtml('weapon', 'missile', 'gs.spaceshooter.weaponMissile', 'gs.spaceshooter.weaponMissileDesc');
  modeRow.innerHTML = optionHtml('mode', 'campaign', 'gs.spaceshooter.modeCampaign', 'gs.spaceshooter.modeCampaignDesc') +
    optionHtml('mode', 'endless', 'gs.spaceshooter.modeEndless', 'gs.spaceshooter.modeEndlessDesc');

  /* ---------------- 运行时状态 ---------------- */
  var state = 'ready';
  var mode = 'campaign', selectedShip = 'assault', selectedWeapon = 'spread';
  var player = null, bullets = [], ebullets = [], enemies = [], powerups = [], particles = [], floats = [];
  var wingmen = [], boss = null, bossLasers = [], stars = [];
  var wave = 0, spawnQueue = [], transitionT = -1, bossActive = false, pendingBoss = false;
  var bossIndex = 0, campaignBossIdx = 0;
  var score = 0, kills = 0, frame = 0, playFrames = 0;
  var shake = 0, flash = 0, flashColor = '#ff2d55';
  var bannerText = '', bannerT = 0, bannerMax = 1;
  var dragging = false, dragOffX = 0, dragOffY = 0, keys = {};
  var ended = false, submitted = false, resultInfo = null;
  var msgTimer = null, lastShotSound = 0;
  var affixes = {};

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    var hw = rw / 2, hh = rh / 2;
    var nx = Math.max(rx - hw, Math.min(cx, rx + hw));
    var ny = Math.max(ry - hh, Math.min(cy, ry + hh));
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= cr * cr;
  }
  function sfx(n) { if (Arcade.audio) Arcade.audio.play(n); }
  function getAffix(id) { return affixes[id] || 0; }
  function scoreMul() { return Math.pow(2, getAffix('double')); }
  function speedMul() { return Math.pow(1.3, getAffix('swift')); }
  function denseExtra() { return getAffix('dense'); }
  function regenSlow() { return Math.pow(2, getAffix('regen')); }

  function setMsg(text, color, ms) {
    msgEl.textContent = text;
    msgEl.style.color = color || '';
    if (msgTimer) clearTimeout(msgTimer);
    if (ms) {
      msgTimer = setTimeout(function () {
        if (state === 'playing') { msgEl.textContent = T('gs.spaceshooter.controlsText'); msgEl.style.color = ''; }
      }, ms);
    }
  }

  function syncOptions() {
    var all = [shipRow, weaponRow, modeRow];
    for (var r = 0; r < all.length; r++) {
      var btns = all[r].getElementsByTagName('button');
      for (var i = 0; i < btns.length; i++) {
        var g = btns[i].getAttribute('data-group');
        var k = btns[i].getAttribute('data-key');
        var on = (g === 'ship' && k === selectedShip) || (g === 'weapon' && k === selectedWeapon) || (g === 'mode' && k === mode);
        btns[i].classList.toggle('on', on);
      }
    }
  }

  function bindOptionRow(rowEl, group) {
    rowEl.addEventListener('click', function (e) {
      var b = e.target;
      while (b && b !== rowEl && b.tagName !== 'BUTTON') b = b.parentNode;
      if (!b || b === rowEl) return;
      var key = b.getAttribute('data-key');
      if (group === 'ship' && SHIPS[key]) selectedShip = key;
      else if (group === 'weapon' && WEAPONS[key]) selectedWeapon = key;
      else if (group === 'mode') mode = (key === 'endless') ? 'endless' : 'campaign';
      syncOptions();
      if (state === 'ready') { resetRun(); updateHud(); }
    });
  }
  bindOptionRow(shipRow, 'ship');
  bindOptionRow(weaponRow, 'weapon');
  bindOptionRow(modeRow, 'mode');
  syncOptions();
  /* ---------------- 星空 ---------------- */
  function initStars() {
    var colors = ['#ffffff', '#9fefff', '#b967ff', '#ffe600'];
    for (var i = 0; i < 110; i++) {
      var z = 1 + Math.floor(Math.random() * 3);
      stars.push({
        x: Math.random() * W, y: Math.random() * H, z: z,
        s: (z === 1 ? 0.7 : (z === 2 ? 1.3 : 2.0)),
        speed: (z === 1 ? 0.35 : (z === 2 ? 0.9 : 1.6)),
        color: colors[Math.floor(Math.random() * colors.length)],
        a: 0.3 + Math.random() * 0.6
      });
    }
  }
  initStars();

  function updateStars(speedMul2) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y += s.speed * (speedMul2 || 1);
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    }
  }

  /* ---------------- 运行时初始化 ---------------- */
  function resetRun() {
    var ship = SHIPS[selectedShip];
    player = {
      x: W / 2, y: H - 92, r: ship.r, speed: ship.speed,
      shipKey: ship.key, ship: ship,
      lives: ship.lives, weaponKey: selectedWeapon, weaponLv: 1,
      shieldMax: ship.shieldMax, shieldPips: ship.shieldMax, shieldState: 'ready',
      shieldCd: 0, chargeTimer: 0, invuln: 0, fireCd: 0, hitFlash: 0,
      bombs: 1, wingMode: 'spread'
    };
    bullets = []; ebullets = []; enemies = []; powerups = []; particles = []; floats = [];
    wingmen = []; boss = null; bossLasers = [];
    wave = 0; spawnQueue = []; transitionT = -1; bossActive = false; pendingBoss = false;
    bossIndex = 0;
    campaignBossIdx = Math.floor(Math.random() * BOSSES.length);
    score = 0; kills = 0; frame = 0; playFrames = 0;
    shake = 0; flash = 0; bannerT = 0;
    affixes = {};
    ended = false; submitted = false; resultInfo = null;
    dragging = false;
    bossBar.classList.add('ss-hide');
    renderAffixHud();
    updateHud();
  }

  function startRun() {
    resetRun();
    state = 'playing';
    hideOverlay();
    var toolsEl = document.querySelector('.ss-tools');
    if (toolsEl) toolsEl.classList.remove('ss-tools-hidden');
    startWave(1);
    setMsg(T('gs.spaceshooter.controlsText'), '');
  }

  /* ---------------- 波次 ---------------- */
  function startWave(n) {
    wave = n;
    transitionT = -1;
    pendingBoss = false;
    spawnQueue = [];
    ebullets = [];
    bossLasers = [];

    if (mode === 'endless' && n === WAVE_COUNT + 1) {
      showBanner(T('gs.spaceshooter.endlessEnter'), 170);
      setMsg(T('gs.spaceshooter.endlessEnter'), 'var(--neon-yellow)', 1800);
      sfx('record');
    }
    var count = Math.min(20, 5 + n);
    var cols = 5;
    for (var i = 0; i < count; i++) {
      var type = pickType(n);
      spawnQueue.push({
        delay: 18 + i * 22,
        type: type,
        x: W / 2 + ((i % cols) - 2) * 88 + rand(-8, 8),
        baseY: 62 + Math.floor(i / cols) * 50 + (type === 'spreader' ? -6 : 0),
        phase: Math.random() * 6.283
      });
    }
    if (n >= 4) {
      spawnQueue.push({ delay: 40, type: 'tank', x: W / 2 + rand(-90, 90), baseY: 76, phase: Math.random() * 6.283 });
    }

    showBanner(T('gs.spaceshooter.waveBanner').replace('{n}', n), 120);
    setMsg(T('gs.spaceshooter.waveMsg').replace('{n}', n), 'var(--neon-cyan)', 1300);
    sfx('daily');
    /* 词缀在波次横幅之后触发，确保词缀横幅可见 */
    if (mode === 'endless' && n > WAVE_COUNT && n % 5 === 0) addAffix();
    updateHud();
  }

  function pickType(n) {
    var r = Math.random();
    if (n >= 7 && r < 0.16) return 'tank';
    if (n >= 5 && r < 0.34) return 'spreader';
    if (n >= 3 && r < 0.58) return 'seeker';
    return 'grunt';
  }

  function makeEnemy(spawn) {
    var type = spawn.type;
    var cfg = {
      grunt: { w: 36, h: 30, hp: 1, score: 10, color: '#ff5e5e', fire: 150 },
      seeker: { w: 38, h: 34, hp: 2, score: 20, color: '#b967ff', fire: 180 },
      spreader: { w: 42, h: 34, hp: 2, score: 30, color: '#ff9f1c', fire: 195 },
      tank: { w: 50, h: 42, hp: 5, score: 60, color: '#39ff14', fire: 225 }
    }[type];
    var hpMul = (mode === 'endless' && wave > WAVE_COUNT) ? 1 + (wave - WAVE_COUNT) * 0.07 : 1;
    var hp = Math.max(1, Math.ceil(cfg.hp * hpMul));
    return {
      type: type, elite: type === 'tank',
      x: spawn.x, y: -50 - Math.random() * 20,
      baseX: spawn.x, baseY: Math.min(spawn.baseY, H - 150),
      amp: type === 'grunt' ? 26 : (type === 'seeker' ? 18 : 12),
      phase: spawn.phase,
      t: Math.random() * 100,
      w: cfg.w, h: cfg.h, hp: hp, maxHp: hp,
      score: cfg.score, color: cfg.color,
      fireCd: cfg.fire + Math.floor(rand(-30, 30)),
      fireBase: Math.max(78, cfg.fire - wave * 6),
      hit: 0
    };
  }

  function spawnEnemies() {
    for (var i = spawnQueue.length - 1; i >= 0; i--) {
      spawnQueue[i].delay--;
      if (spawnQueue[i].delay <= 0) {
        enemies.push(makeEnemy(spawnQueue[i]));
        spawnQueue.splice(i, 1);
      }
    }
  }

  /* ---------------- 玩家 ---------------- */
  function updatePlayer() {
    var dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
    if (dx || dy) {
      var len = Math.hypot(dx, dy);
      player.x += dx / len * player.speed;
      player.y += dy / len * player.speed;
    }
    player.x = clamp(player.x, 24, W - 24);
    player.y = clamp(player.y, 46, H - 30);

    /* 尾焰后景粒子：压在机身之下，和前景火花分两层 */
    if (frame % 2 === 0) {
      particles.push({
        x: player.x + rand(-2.4, 2.4), y: player.y + 13,
        vx: rand(-0.3, 0.3), vy: rand(1.4, 2.4),
        life: 12, max: 18, size: rand(1.4, 2.6), z: 0,
        color: player.ship.color || '#00f0ff'
      });
    }

    if (player.invuln > 0) player.invuln--;
    if (player.hitFlash > 0) player.hitFlash--;
    updateShield();

    if (player.fireCd > 0) player.fireCd--;
    if (player.fireCd <= 0) {
      firePlayer();
      player.fireCd = fireInterval();
    }
  }

  function fireInterval() {
    var w = WEAPONS[player.weaponKey];
    var base = player.ship.fire * w.cd;
    return Math.max(5, Math.round(base * (1 - 0.07 * (player.weaponLv - 1))));
  }

  function pushBullet(x, y, vx, vy, r, dmg, color, opt) {
    opt = opt || {};
    bullets.push({
      x: x, y: y, vx: vx, vy: vy, r: r, dmg: dmg, color: color,
      splash: opt.splash || 0, pierce: opt.pierce || 0, homing: opt.homing || 0,
      type: opt.type || 'bolt', t: 0
    });
  }

  function firePlayer() {
    var y = player.y - 20;
    var lv = player.weaponLv;
    var dmg = player.ship.dmg;
    var weapon = player.weaponKey;

    if (weapon === 'spread') {
      var n = lv * 2 + 1;
      var span = 0.13 + lv * 0.04;
      for (var i = 0; i < n; i++) {
        var a = -span + (2 * span) * (i / (n - 1));
        pushBullet(player.x + Math.sin(a) * 10, y + Math.cos(a) * 6, Math.sin(a) * 9, -Math.cos(a) * 9,
          2.6 + lv * 0.25, 1 * dmg, lv >= 3 ? '#ffe600' : '#7dffff', { type: 'bolt' });
      }
    } else if (weapon === 'laser') {
      var ln = lv === 1 ? 2 : 3;
      var spreadX = lv === 1 ? 5 : 9;
      for (var j = 0; j < ln; j++) {
        var ox = (j - (ln - 1) / 2) * spreadX;
        pushBullet(player.x + ox, y, 0, -14, 1.8 + lv * 0.3, 1.15 * dmg, '#d8ffff',
          { type: 'laser', pierce: lv >= 3 ? 1 : 0 });
      }
    } else {
      var mn = lv + 1;
      for (var k = 0; k < mn; k++) {
        var mx = player.x + (k - (mn - 1) / 2) * 7;
        pushBullet(mx, y + 2, 0, -6, 3.2, 1.3 * dmg, '#ffe600',
          { type: 'missile', homing: 110, splash: 22 + lv * 4 });
      }
    }
    if (frame - lastShotSound > 5) { lastShotSound = frame; sfx('type'); }
  }

  function damagePlayer() {
    if (!player || player.invuln > 0 || state !== 'playing') return;
    if (player.shieldPips > 0) {
      player.shieldPips--;
      player.invuln = 62;
      player.hitFlash = 10;
      flash = 0.6; flashColor = '#00f0ff';
      shake = 6;
      if (player.shieldPips <= 0) {
        player.shieldState = 'broken';
        player.shieldCd = Math.round(player.ship.broken * regenSlow());
        player.chargeTimer = 0;
        var secs = (player.shieldCd / 60).toFixed(1);
        setMsg(T('gs.spaceshooter.shieldBrokenMsg').replace('{s}', secs), 'var(--neon-pink)', 1800);
        shake = 10;
      } else {
        setMsg(T('gs.spaceshooter.shielded'), 'var(--neon-cyan)', 1200);
      }
      sfx('error');
      updateHud();
      return;
    }
    player.lives--;
    player.invuln = 105;
    player.hitFlash = 16;
    floatAt(player.x, player.y - 30, '-1', '#ff2d55');
    flash = 1;
    flashColor = '#ff2d55';
    shake = 16;
    setMsg(T('gs.spaceshooter.hit'), 'var(--neon-pink)', 1200);
    sfx('error');
    updateHud();
    if (player.lives <= 0) endRun(false);
  }

  /* ---------------- 护盾状态机 ready / broken / charging ---------------- */
  function chargeInterval() {
    return Math.round(170 * regenSlow());
  }

  function updateShield() {
    if (!player) return;
    if (player.shieldState === 'broken') {
      player.shieldCd--;
      if (player.shieldCd <= 0) {
        player.shieldCd = 0;
        player.shieldState = 'charging';
        player.chargeTimer = 0;
        setMsg(T('gs.spaceshooter.shieldRechargeStart'), 'var(--neon-cyan)', 1400);
      }
    } else if (player.shieldState === 'charging') {
      player.chargeTimer++;
      if (player.chargeTimer >= chargeInterval()) {
        player.chargeTimer = 0;
        if (player.shieldPips < player.shieldMax) {
          player.shieldPips++;
          setMsg(T('gs.spaceshooter.shieldRecharged'), 'var(--neon-cyan)', 1000);
          sfx('record');
          updateHud();
        }
        if (player.shieldPips >= player.shieldMax) player.shieldState = 'ready';
      }
    }
    updateShieldHud();
  }

  function shieldHudText() {
    if (!player) return '';
    if (player.shieldState === 'broken') {
      return T('gs.spaceshooter.shieldCooldownFmt').replace('{s}', (Math.max(0, player.shieldCd) / 60).toFixed(1));
    }
    if (player.shieldState === 'charging') {
      return T('gs.spaceshooter.shieldChargingFmt').replace('{a}', player.shieldPips).replace('{b}', player.shieldMax);
    }
    return player.shieldPips + '/' + player.shieldMax;
  }

  function updateShieldHud() {
    if (!player) return;
    shieldEl.textContent = shieldHudText();
    shieldEl.classList.toggle('warn', player.shieldState === 'broken');
  }

  /* ---------------- 僚机 ---------------- */
  function addWing() {
    var slot = wingmen.length;
    wingmen.push({
      x: player.x + (slot === 0 ? -44 : 44), y: player.y + 30,
      hp: 3, maxHp: 3, hit: 0, fireCd: 26, seed: Math.random() * 6.283
    });
    explosion(wingmen[wingmen.length - 1].x, wingmen[wingmen.length - 1].y, '#00f0ff', 14);
    setMsg(T('gs.spaceshooter.wingGot'), 'var(--neon-cyan)', 1400);
    sfx('record');
    updateHud();
  }

  function removeWingAt(idx) {
    if (idx < 0 || idx >= wingmen.length) return;
    var w = wingmen[idx];
    explosion(w.x, w.y, '#ff9f1c', 16);
    shake = Math.max(shake, 8);
    wingmen.splice(idx, 1);
    setMsg(T('gs.spaceshooter.wingLost'), 'var(--neon-pink)', 1400);
    sfx('error');
    updateHud();
  }

  function wingInterval() {
    var base = 44 - player.weaponLv * 4;
    var factor = Math.pow(1.5, getAffix('wing'));
    return Math.max(10, Math.round(base / factor));
  }

  function fireWing(w) {
    var dmg = 0.55 * player.ship.dmg * Math.pow(1.5, getAffix('wing'));
    var weapon = player.weaponKey;
    if (weapon === 'laser') {
      pushBullet(w.x, w.y - 8, 0, -12.5, 1.7, dmg, '#ffe600', { type: 'wing', pierce: 0 });
    } else if (weapon === 'missile') {
      pushBullet(w.x, w.y - 8, 0, -6.2, 2.4, dmg, '#ff9f1c', { type: 'wing', homing: 80, splash: 14 });
    } else {
      pushBullet(w.x, w.y - 8, 0, -9.2, 2.1, dmg, '#ff9f1c', { type: 'wing' });
    }
  }

  function updateWingmen() {
    for (var i = wingmen.length - 1; i >= 0; i--) {
      var w = wingmen[i];
      if (w.hit > 0) w.hit--;
      var focus = player.wingMode === 'focus';
      var ox = focus ? (i === 0 ? -26 : 26) : (i === 0 ? -46 : 46);
      var oy = focus ? 12 : 34;
      w.x += (player.x + ox - w.x) * 0.16;
      w.y += (player.y + oy - w.y) * 0.16;
      w.fireCd--;
      if (w.fireCd <= 0) {
        fireWing(w);
        w.fireCd = wingInterval();
      }
    }
  }
  /* ---------------- 敌人 ---------------- */
  function updateEnemies() {
    var sp = speedMul();
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      e.t++;
      if (e.hit > 0) e.hit--;
      var targetX = e.baseX + Math.sin(e.t * 0.024 + e.phase) * e.amp;
      if (e.type === 'seeker') targetX += clamp(player.x - targetX, -26, 26);
      e.x += (targetX - e.x) * 0.06;
      if (e.y < e.baseY) e.y += 2.2 * sp;
      else e.y = e.baseY + Math.sin(e.t * 0.04 + e.phase) * 5;

      e.fireCd--;
      if (e.fireCd <= 0 && e.y > 8) {
        fireEnemy(e);
        e.fireCd = Math.round(e.fireBase / Math.pow(1.15, getAffix('swift'))) + Math.floor(rand(-14, 18));
      }

      if (circleRect(player.x, player.y, player.r, e.x, e.y, e.w, e.h)) damagePlayer();
      if (e.y > H + 50) enemies.splice(i, 1);
    }
  }

  function fireEnemy(e) {
    var aim = Math.atan2(player.y - e.y, player.x - e.x);
    var sp = 2.1 + Math.min(wave, 20) * 0.1;
    var extra = denseExtra();
    if (e.type === 'grunt') {
      addEBullet(e.x, e.y + 12, Math.cos(aim) * sp, Math.sin(aim) * sp, 4, '#ff5e5e', 0);
    } else if (e.type === 'seeker') {
      addEBullet(e.x, e.y + 10, Math.cos(aim) * (sp * 0.85), Math.sin(aim) * (sp * 0.85), 4.5, '#b967ff', 140);
    } else if (e.type === 'spreader') {
      var cnt = 3 + extra;
      for (var k = 0; k < cnt; k++) {
        var a = aim + (k - (cnt - 1) / 2) * 0.24;
        addEBullet(e.x, e.y + 12, Math.cos(a) * (sp * 0.9), Math.sin(a) * (sp * 0.9), 4, '#ff9f1c', 0);
      }
    } else {
      var cnt2 = 5 + extra * 2;
      for (var k2 = 0; k2 < cnt2; k2++) {
        var a2 = aim + (k2 - (cnt2 - 1) / 2) * 0.19;
        addEBullet(e.x, e.y + 14, Math.cos(a2) * (sp * 0.8), Math.sin(a2) * (sp * 0.8), 5, '#39ff14', 0);
      }
      addEBullet(e.x, e.y + 14, Math.cos(aim) * (sp * 1.1), Math.sin(aim) * (sp * 1.1), 4, '#ffffff', 0);
    }
    if (frame % 3 === 0) sfx('ui');
  }

  function addEBullet(x, y, vx, vy, r, color, homing) {
    ebullets.push({ x: x, y: y, vx: vx, vy: vy, r: r, color: color, homing: homing || 0, t: 0 });
  }

  function killEnemy(e) {
    var idx = enemies.indexOf(e);
    if (idx < 0) return;
    enemies.splice(idx, 1);
    var gained = Math.round(e.score * scoreMul());
    score += gained;
    kills++;
    explosion(e.x, e.y, e.color, e.elite ? 30 : 18);
    floatAt(e.x, e.y - 10, '+' + gained, e.elite ? '#ffe600' : '#7dffff');
    shake = Math.max(shake, e.elite ? 8 : 4);
    sfx('coin');
    maybeDropPowerup(e.x, e.y, e.elite);
    updateHud();
  }

  /* ---------------- 子弹 ---------------- */
  function nearestTarget(x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < enemies.length; i++) {
      var d = (enemies[i].x - x) * (enemies[i].x - x) + (enemies[i].y - y) * (enemies[i].y - y);
      if (d < bd) { bd = d; best = { x: enemies[i].x, y: enemies[i].y }; }
    }
    if (boss) {
      var db = (boss.x - x) * (boss.x - x) + (boss.y - y) * (boss.y - y);
      if (db < bd) best = { x: boss.x, y: boss.y };
    }
    return best;
  }

  function splashDamage(x, y, radius, dmg) {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (Math.hypot(e.x - x, e.y - y) <= radius + Math.max(e.w, e.h) / 2) {
        e.hp -= dmg; e.hit = 4;
        burstParticles(e.x, e.y, '#ffe600', 4, 2);
        if (e.hp <= 0) killEnemy(e);
      }
    }
    if (boss && Math.hypot(boss.x - x, boss.y - y) <= radius + boss.w / 2) {
      boss.hp -= dmg; boss.hit = 4;
      burstParticles(x, y, '#ffe600', 4, 2);
      if (boss.hp <= 0) killBoss();
    }
  }

  function updateBullets() {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.t++;
      if (b.homing > 0) {
        var tgt = nearestTarget(b.x, b.y);
        if (tgt) {
          var want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          var cur = Math.atan2(b.vy, b.vx);
          var diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          var turn = clamp(diff, -0.09, 0.09);
          var spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(cur + turn) * spd;
          b.vy = Math.sin(cur + turn) * spd;
        }
        b.homing--;
      }
      b.x += b.vx; b.y += b.vy;
      if (b.y < -24 || b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }

      var hit = false;
      for (var j = enemies.length - 1; j >= 0; j--) {
        if (circleRect(b.x, b.y, b.r, enemies[j].x, enemies[j].y, enemies[j].w, enemies[j].h)) {
          var e = enemies[j];
          e.hp -= b.dmg;
          e.hit = 4;
          burstParticles(b.x, b.y, e.color, 5, 2);
          if (b.splash > 0) splashDamage(b.x, b.y, b.splash, b.dmg * 0.7);
          if (b.pierce > 0) b.pierce--;
          else bullets.splice(i, 1);
          hit = true;
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
      if (hit) continue;

      if (boss && circleRect(b.x, b.y, b.r, boss.x, boss.y, boss.w, boss.h)) {
        boss.hp -= b.dmg;
        boss.hit = 4;
        burstParticles(b.x, b.y, '#ffe600', 4, 1.8);
        if (b.splash > 0) splashDamage(b.x, b.y, b.splash, b.dmg * 0.7);
        if (b.pierce > 0) b.pierce--;
        else bullets.splice(i, 1);
        if (boss && boss.hp <= 0) killBoss();
      }
    }

    for (var k = ebullets.length - 1; k >= 0; k--) {
      var eb = ebullets[k];
      eb.t++;
      if (eb.homing > 0 && state === 'playing') {
        var want2 = Math.atan2(player.y - eb.y, player.x - eb.x);
        var cur2 = Math.atan2(eb.vy, eb.vx);
        var diff2 = want2 - cur2;
        while (diff2 > Math.PI) diff2 -= Math.PI * 2;
        while (diff2 < -Math.PI) diff2 += Math.PI * 2;
        var turn2 = clamp(diff2, -0.045, 0.045);
        var sp2 = Math.hypot(eb.vx, eb.vy);
        eb.vx = Math.cos(cur2 + turn2) * sp2;
        eb.vy = Math.sin(cur2 + turn2) * sp2;
        eb.homing--;
      }
      eb.x += eb.vx; eb.y += eb.vy;
      if (eb.x < -40 || eb.x > W + 40 || eb.y < -50 || eb.y > H + 40) { ebullets.splice(k, 1); continue; }

      var consumed = false;
      for (var wi = wingmen.length - 1; wi >= 0; wi--) {
        var w = wingmen[wi];
        if (circleRect(w.x, w.y, 11, eb.x, eb.y, eb.r * 2, eb.r * 2)) {
          w.hp--;
          w.hit = 10;
          ebullets.splice(k, 1);
          burstParticles(eb.x, eb.y, '#ff9f1c', 5, 2);
          if (w.hp <= 0) removeWingAt(wi);
          consumed = true;
          break;
        }
      }
      if (consumed) continue;

      if (circleRect(player.x, player.y, player.r - 1, eb.x, eb.y, eb.r * 2, eb.r * 2)) {
        ebullets.splice(k, 1);
        damagePlayer();
      }
    }

    for (var p = powerups.length - 1; p >= 0; p--) {
      var pw = powerups[p];
      pw.y += 1.5;
      pw.t++;
      if (pw.y > H + 30) { powerups.splice(p, 1); continue; }
      if (circleRect(player.x, player.y, player.r + 14, pw.x, pw.y, 28, 28)) {
        applyPowerup(pw.type);
        explosion(pw.x, pw.y, '#ffffff', 10);
        powerups.splice(p, 1);
      }
    }
  }

  /* ---------------- 道具 ---------------- */
  function dropPowerup(type, x, y) {
    powerups.push({ x: x, y: y, type: type, t: 0 });
  }

  function maybeDropPowerup(x, y, elite) {
    var r = Math.random();
    if (elite) {
      if (r < 0.35) dropPowerup('wing', x, y);
      else if (r < 0.52) dropPowerup('weapon', x, y);
      else if (r < 0.68) dropPowerup('bomb', x, y);
      else if (r < 0.82) dropPowerup('shield', x, y);
      else dropPowerup('heal', x, y);
      return;
    }
    if (r > 0.13) return;
    var t;
    if (r < 0.02) t = 'wing';
    else if (r < 0.05) t = 'weapon';
    else if (r < 0.08) t = 'bomb';
    else if (r < 0.11) t = 'shield';
    else t = 'heal';
    dropPowerup(t, x, y);
  }

  function applyPowerup(type) {
    if (type === 'wing') {
      if (wingmen.length >= 2) {
        player.bombs = Math.min(4, player.bombs + 1);
        setMsg(T('gs.spaceshooter.wingFull'), 'var(--neon-yellow)', 1400);
      } else {
        addWing();
      }
    } else if (type === 'weapon') {
      if (player.weaponLv < 3) {
        player.weaponLv++;
        setMsg(T('gs.spaceshooter.weaponUp').replace('{n}', player.weaponLv), 'var(--neon-yellow)', 1400);
      } else {
        player.bombs = Math.min(4, player.bombs + 1);
        setMsg(T('gs.spaceshooter.weaponMax'), 'var(--neon-yellow)', 1400);
      }
    } else if (type === 'bomb') {
      if (player.bombs < 4) {
        player.bombs++;
        setMsg(T('gs.spaceshooter.bombUp'), 'var(--neon-yellow)', 1200);
      } else {
        setMsg(T('gs.spaceshooter.bombMaxMsg'), 'var(--neon-yellow)', 1200);
      }
    } else if (type === 'shield') {
      if (player.shieldState === 'broken') {
        setMsg(T('gs.spaceshooter.shieldPickupLocked'), 'var(--neon-pink)', 1400);
        return;
      }
      if (player.shieldPips < player.shieldMax) {
        player.shieldPips++;
        if (player.shieldPips >= player.shieldMax) player.shieldState = 'ready';
        setMsg(T('gs.spaceshooter.shieldUp'), 'var(--neon-cyan)', 1200);
      } else {
        setMsg(T('gs.spaceshooter.shieldMaxMsg'), 'var(--neon-cyan)', 1200);
      }
    } else {
      if (player.lives < 6) {
        player.lives++;
        setMsg(T('gs.spaceshooter.healed'), 'var(--neon-green)', 1200);
      } else {
        setMsg(T('gs.spaceshooter.healMaxMsg'), 'var(--neon-green)', 1200);
      }
    }
    sfx('record');
    updateHud();
  }

  function useBomb() {
    if (!player || state !== 'playing') return;
    if (player.bombs <= 0) {
      setMsg(T('gs.spaceshooter.bombEmptyMsg'), 'var(--neon-pink)', 1000);
      return;
    }
    player.bombs--;
    ebullets = [];
    bossLasers = [];
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      e.hp -= 3;
      e.hit = 8;
      burstParticles(e.x, e.y, '#00f0ff', 6, 2.4);
      if (e.hp <= 0) killEnemy(e);
    }
    if (boss) {
      boss.hp -= 90;
      boss.hit = 8;
      if (boss.hp <= 0) killBoss();
    }
    flash = 0.9; flashColor = '#00f0ff';
    shake = 16;
    for (var r = 0; r < 18; r++) {
      var a = r * Math.PI * 2 / 18;
      burstParticles(player.x + Math.cos(a) * 60, player.y + Math.sin(a) * 40, '#00f0ff', 5, 3);
    }
    setMsg(T('gs.spaceshooter.bombUsed'), 'var(--neon-cyan)', 1200);
    sfx('error');
    updateHud();
  }

  function toggleWingMode() {
    if (!player) return;
    player.wingMode = player.wingMode === 'focus' ? 'spread' : 'focus';
    setMsg(player.wingMode === 'focus' ? T('gs.spaceshooter.wingModeFocus') : T('gs.spaceshooter.wingModeSpread'), 'var(--neon-purple)', 1200);
  }

  /* ---------------- 无尽词缀 ---------------- */
  function addAffix() {
    var a = AFFIXES[Math.floor(Math.random() * AFFIXES.length)];
    affixes[a.id] = (affixes[a.id] || 0) + 1;
    renderAffixHud();
    var name = T(a.nameKey);
    showBanner(T('gs.spaceshooter.affixBanner').replace('{n}', name), 170);
    setMsg(T('gs.spaceshooter.affixBanner').replace('{n}', name), 'var(--neon-yellow)', 1800);
    sfx('record');
  }

  function renderAffixHud() {
    var ids = Object.keys(affixes);
    if (!ids.length) { affixEl.classList.add('ss-hide'); affixEl.innerHTML = ''; return; }
    var parts = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var def = null;
      for (var j = 0; j < AFFIXES.length; j++) if (AFFIXES[j].id === id) def = AFFIXES[j];
      if (!def) continue;
      var label = T(def.nameKey) + (affixes[id] > 1 ? ' ×' + affixes[id] : '');
      parts.push('<span>' + label + '</span>');
    }
    affixEl.innerHTML = '<span>' + T('gs.spaceshooter.hudAffix') + '</span>' + parts.join('');
    affixEl.classList.remove('ss-hide');
  }
  /* ---------------- Boss 库 ---------------- */
  function startBoss() {
    bossActive = true;
    pendingBoss = false;
    var def = BOSSES[mode === 'campaign' ? campaignBossIdx : bossIndex % BOSSES.length];
    var hpScale = mode === 'endless' ? 1 + Math.floor(bossIndex / BOSSES.length) * 0.2 : 1;
    var hp = Math.round(def.hp * hpScale);
    boss = {
      def: def, x: W / 2, y: -180, w: def.w, h: def.h,
      hp: hp, maxHp: hp, phase: 1, t: 0,
      entering: true, entrance: 0, hit: 0, rotate: 0,
      mainCd: 120, subCd: 40, ringCd: 90, laserCd: 180, subAng: 0,
      droppedWing: false
    };
    transitionT = -1;
    bossNameEl.textContent = T(def.nameKey);
    bossFill.style.width = '100%';
    bossFill.style.background = 'linear-gradient(90deg, ' + def.color + ', ' + def.accent + ')';
    bossBar.classList.remove('ss-hide');
    showBanner(T('gs.spaceshooter.bossWarn').replace('{n}', T(def.nameKey)), 200);
    setMsg(T('gs.spaceshooter.bossWarn').replace('{n}', T(def.nameKey)), 'var(--neon-pink)', 1900);
    flash = 0.5; flashColor = def.color; shake = 12;
    sfx('lose');
  }

  function fanShots(x, y, count, arc, speed, color, homing) {
    var aim = Math.atan2(player.y - y, player.x - x);
    for (var i = 0; i < count; i++) {
      var a = aim + (count > 1 ? (i - (count - 1) / 2) * (arc / (count - 1)) : 0);
      addEBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 4.8, color, homing || 0);
    }
  }

  function ringShots(x, y, count, speed, color, offset) {
    for (var i = 0; i < count; i++) {
      var a = i * Math.PI * 2 / count + (offset || 0);
      addEBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 4.4, color, 0);
    }
  }

  function spawnLaser(x, warn, active, width, color) {
    bossLasers.push({
      x: clamp(x, 18, W - 18), y: boss ? boss.y + 40 : 160,
      w: width, warn: warn, maxWarn: warn, active: active, life: warn + active,
      color: color || '#00f0ff', hitDone: false
    });
    if (frame % 2 === 0) sfx('ui');
  }

  function updateBoss() {
    if (!boss) return;
    boss.t++;
    var def = boss.def;

    if (boss.entering) {
      boss.entrance++;
      var p = Math.min(1, boss.entrance / 100);
      boss.y = -180 + 305 * GK.easeOutCubic(p);
      boss.x = W / 2;
      if (frame % 2 === 0) burstParticles(boss.x + rand(-70, 70), boss.y - 20, def.color, 2, 1.8);
      if (p >= 1) {
        boss.entering = false;
        boss.y = 125;
        shake = 18;
        flash = 0.8; flashColor = def.color;
        sfx('clear');
      }
      return;
    }

    boss.x = W / 2 + Math.sin(boss.t * 0.011) * (def.id === 'prism' ? 120 : 145);
    boss.y = 125 + Math.sin(boss.t * 0.02) * 8;
    boss.rotate += def.id === 'prism' ? 0.014 : 0.006;
    if (boss.hit > 0) boss.hit--;

    var frac = boss.hp / boss.maxHp;
    var ph = frac > 0.66 ? 1 : (frac > 0.33 ? 2 : 3);
    if (ph !== boss.phase) {
      boss.phase = ph;
      boss.hit = 14;
      shake = 12;
      explosion(boss.x, boss.y, def.color, 30);
      showBanner(T('gs.spaceshooter.bossPhase').replace('{n}', ph), 120);
      sfx('clear');
      boss.mainCd = 70;
      boss.subCd = 20;
      boss.ringCd = 60;
      boss.laserCd = 80;
      if (ph === 2 && !boss.droppedWing) {
        boss.droppedWing = true;
        dropPowerup('wing', clamp(boss.x, 30, W - 30), Math.min(H - 170, boss.y + 80));
        setMsg(T('gs.spaceshooter.wingDropMsg'), 'var(--neon-cyan)', 1600);
      }
    }

    var dense = denseExtra();
    boss.mainCd--; boss.subCd--; boss.ringCd--; boss.laserCd--;

    if (def.id === 'crimson') {
      if (boss.mainCd <= 0) {
        fanShots(boss.x, boss.y + 28, 5 + (boss.phase - 1) * 2 + dense, 0.5, 2.6 + boss.phase * 0.25, '#ff9f1c', 0);
        boss.mainCd = [110, 88, 68][boss.phase - 1];
        sfx('ui');
      }
      if (boss.phase >= 2 && boss.subCd <= 0) {
        boss.subAng += 0.32;
        var sp1 = 2.1 + boss.phase * 0.25;
        for (var k = 0; k < 3; k++) {
          var a1 = boss.subAng + k * Math.PI * 2 / 3;
          addEBullet(boss.x, boss.y + 8, Math.cos(a1) * sp1, Math.sin(a1) * sp1, 4.5, k === 0 ? '#00f0ff' : '#ff2d95', 0);
        }
        boss.subCd = boss.phase === 2 ? 18 : 12;
      }
      if (boss.phase >= 3 && boss.ringCd <= 0) {
        ringShots(boss.x, boss.y, 18 + dense * 6, 2.5, '#ffe600', boss.t * 0.02);
        boss.ringCd = 150;
        sfx('error');
      }
    } else if (def.id === 'prism') {
      if (boss.mainCd <= 0) {
        fanShots(boss.x, boss.y + 26, 3 + dense, 0.22, 2.9, '#00f0ff', 0);
        addEBullet(boss.x - 58, boss.y + 22, Math.cos(Math.PI / 2) * 2.2, Math.sin(Math.PI / 2) * 2.2, 4, '#b967ff', 0);
        addEBullet(boss.x + 58, boss.y + 22, Math.cos(Math.PI / 2) * 2.2, Math.sin(Math.PI / 2) * 2.2, 4, '#b967ff', 0);
        boss.mainCd = [98, 78, 62][boss.phase - 1];
        sfx('ui');
      }
      if (boss.phase >= 2 && boss.subCd <= 0) {
        ringShots(boss.x, boss.y, 10 + dense * 4, 2.3, '#b967ff', boss.rotate);
        boss.subCd = boss.phase === 2 ? 32 : 24;
      }
      if (boss.phase >= 3 && boss.laserCd <= 0) {
        spawnLaser(player.x, 55, 42, 44, '#00f0ff');
        spawnLaser(W - player.x, 55, 42, 44, '#b967ff');
        setMsg(T('gs.spaceshooter.laserWarn'), 'var(--neon-pink)', 1200);
        boss.laserCd = 200;
      }
    } else {
      if (boss.mainCd <= 0) {
        fanShots(boss.x, boss.y + 20, 3 + dense, 0.7, 2.2, '#39ff14', 160);
        boss.mainCd = [96, 80, 64][boss.phase - 1];
        sfx('ui');
      }
      if (boss.phase >= 2 && boss.subCd <= 0) {
        boss.subAng += 0.42;
        var sp3 = 2.0 + boss.phase * 0.22;
        for (var k3 = 0; k3 < 4; k3++) {
          var a3 = boss.subAng + k3 * Math.PI / 2;
          addEBullet(boss.x, boss.y, Math.cos(a3) * sp3, Math.sin(a3) * sp3, 4.2, '#39ff14', 0);
        }
        boss.subCd = boss.phase === 2 ? 14 : 10;
      }
      if (boss.phase >= 3 && boss.ringCd <= 0) {
        ringShots(boss.x, boss.y, 20 + dense * 6, 2.7, '#ffe600', boss.t * 0.03);
        boss.ringCd = 130;
      }
      if (boss.phase >= 3 && boss.laserCd <= 0) {
        spawnLaser(player.x, 50, 38, 38, '#39ff14');
        boss.laserCd = 190;
      }
    }

    bossFill.style.width = Math.max(0, frac * 100) + '%';
    bossNameEl.textContent = T(def.nameKey) + ' · P' + boss.phase;
    if (circleRect(player.x, player.y, player.r, boss.x, boss.y, boss.w, boss.h)) damagePlayer();
  }

  function updateBossLasers() {
    for (var i = bossLasers.length - 1; i >= 0; i--) {
      var l = bossLasers[i];
      l.life--;
      if (l.warn > 0) {
        l.warn--;
        if (l.warn === 0) { flash = 0.5; flashColor = l.color; shake = 8; sfx('error'); }
      } else if (l.active > 0) {
        l.active--;
        if (!l.hitDone && state === 'playing' &&
          Math.abs(player.x - l.x) <= l.w / 2 + player.r && player.y > l.y) {
          l.hitDone = true;
          damagePlayer();
        }
      }
      if (l.life <= 0) bossLasers.splice(i, 1);
    }
  }

  function killBoss() {
    if (!boss) return;
    var def = boss.def;
    var bx = boss.x, by = boss.y;
    var bgain = Math.round(def.score * scoreMul());
    score += bgain;
    floatAt(bx, by, '+' + bgain, '#ffe600');
    boss = null;
    bossActive = false;
    bossLasers = [];
    bossIndex++;
    for (var i = 0; i < 6; i++) {
      explosion(bx + rand(-60, 60), by + rand(-40, 40), i % 2 ? def.color : def.accent, 26);
    }
    shake = 26;
    flash = 0.9; flashColor = def.color;
    bossBar.classList.add('ss-hide');
    sfx('win');
    updateHud();
    if (mode === 'campaign') {
      endRun(true);
    } else {
      dropPowerup('wing', clamp(bx, 30, W - 30), Math.min(H - 150, by + 70));
      transitionT = 150;
      showBanner(T('gs.spaceshooter.bossDefeated'), 190);
      setMsg(T('gs.spaceshooter.bossDefeated'), 'var(--neon-yellow)', 1700);
    }
  }
  /* ---------------- 粒子 / 爆炸 ---------------- */
  function burstParticles(x, y, color, n, sp) {
    sp = sp || 2;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = rand(0.4, sp);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 16 + Math.floor(Math.random() * 18), max: 34, z: 1,
        color: color, size: rand(1.2, 3.2)
      });
    }
  }

  function explosion(x, y, color, n) {
    burstParticles(x, y, color, n, 4.2);
    burstParticles(x, y, '#ffffff', Math.floor(n / 3), 2.4);
    if (Arcade.fx && n >= 20) {
      var p = GK.toClient(canvas, x, y);
      Arcade.fx.burst(p.x, p.y, color, 10);
    }
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.985; p.vy *= 0.985;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var f = floats.length - 1; f >= 0; f--) {
      floats[f].t++;
      if (floats[f].t >= floats[f].dur) floats.splice(f, 1);
    }
  }

  /* 浮字反馈：easeOutCubic 上浮 + easeOutBack 弹出 */
  function floatAt(x, y, str, color) {
    if (floats.length > 16) floats.shift();
    floats.push({ x: x, y: y, str: String(str), color: color || '#ffe600', t: 0, dur: 52 });
  }

  /* ---------------- 主循环 ---------------- */
  function update() {
    frame++;
    if (state === 'paused') { updateParticles(); return; }
    if (state === 'playing') {
      playFrames++;
      updateStars(1.25);
      updatePlayer();
      updateWingmen();
      spawnEnemies();
      updateEnemies();
      updateBullets();
      updateBossLasers();
      if (boss) updateBoss();
      updateParticles();
      if (bannerT > 0) bannerT--;
      if (shake > 0) shake--;
      if (flash > 0) flash -= 0.05;
      checkWaveFlow();
    } else {
      updateStars(0.5);
      updateParticles();
      if (shake > 0) shake--;
      if (flash > 0) flash -= 0.04;
      if (bannerT > 0) bannerT--;
    }
  }

  function needBoss(n) {
    return mode === 'campaign' ? n >= WAVE_COUNT : n % 5 === 0;
  }

  function checkWaveFlow() {
    if (transitionT >= 0) {
      transitionT--;
      if (transitionT <= 0) {
        if (pendingBoss) { pendingBoss = false; startBoss(); }
        else startWave(wave + 1);
      }
      return;
    }
    if (bossActive) return;
    if (spawnQueue.length === 0 && enemies.length === 0) {
      if (needBoss(wave)) {
        transitionT = 130;
        pendingBoss = true;
        showBanner(T('gs.spaceshooter.bossIncoming'), 190);
        setMsg(T('gs.spaceshooter.bossIncoming'), 'var(--neon-pink)', 1600);
        sfx('record');
      } else {
        transitionT = 100;
        showBanner(T('gs.spaceshooter.waveClear').replace('{n}', wave), 120);
        setMsg(T('gs.spaceshooter.waveClearMsg'), 'var(--neon-green)', 1400);
        sfx('clear');
      }
    }
  }

  /* ---------------- 结算 ---------------- */
  function endRun(win) {
    if (ended) return;
    ended = true;
    state = win ? 'won' : 'lost';
    dragging = false;
    var prevBest = null;
    try { prevBest = Arcade.storage.getBest('spaceshooter'); } catch (e) {}
    var isNew = false;
    if (!submitted) {
      submitted = true;
      if (Arcade.shell) isNew = !!Arcade.shell.submitScore(score);
    }
    var best = score;
    try {
      var stored = Arcade.storage.getBest('spaceshooter');
      if (stored !== null && stored > best) best = stored;
    } catch (e2) {}
    resultInfo = {
      win: win, score: score, kills: kills, wave: Math.max(1, wave),
      best: best, newRecord: isNew || (prevBest !== null && score > prevBest && score > 0),
      time: GK.fmtTime(playFrames * 1000 / 60)
    };
    bossBar.classList.add('ss-hide');
    bossLasers = [];
    if (win) {
      if (Arcade.juice) Arcade.juice.win();
      sfx('record');
      setTimeout(function () { if (ended) showResult(); }, 950);
    } else {
      if (Arcade.juice) Arcade.juice.lose();
      sfx('lose');
      setTimeout(function () { if (ended) showResult(); }, 800);
    }
    updateHud();
  }

  function showResult() {
    var r = resultInfo;
    if (!r) return;
    var lines =
      T('gs.spaceshooter.scoreFmt').replace('{n}', r.score) + '<br>' +
      T('gs.spaceshooter.killsFmt').replace('{n}', r.kills) + '<br>' +
      T('gs.spaceshooter.reachedFmt').replace('{n}', r.wave) + '<br>' +
      T('gs.spaceshooter.timeFmt').replace('{t}', r.time) + '<br>' +
      T('gs.spaceshooter.bestFmt').replace('{n}', r.best);
    if (r.newRecord) lines += '<div class="ss-new">' + T('gs.spaceshooter.newRecordFmt') + '</div>';
    var title = mode === 'endless' ? T('gs.spaceshooter.endlessOverTitle') : (r.win ? T('gs.spaceshooter.winTitle') : T('gs.spaceshooter.loseTitle'));
    showOverlay(title, lines, T('gs.spaceshooter.again'), startRun, T('gs.spaceshooter.backBtn'), backToHangar, false);
  }

  /* ---------------- HUD / 遮罩 ---------------- */
  function updateHud() {
    if (!player) return;
    var ship = SHIPS[player.shipKey] || SHIPS[selectedShip];
    var weapon = WEAPONS[player.weaponKey] || WEAPONS[selectedWeapon];
    livesEl.textContent = String(player.lives);
    shieldEl.textContent = shieldHudText();
    shieldEl.classList.toggle('warn', player.shieldState === 'broken');
    scoreEl.textContent = String(score);
    waveEl.textContent = bossActive ? T('gs.spaceshooter.boss') :
      (mode === 'endless' ? wave + ' ∞' : (wave > 0 ? wave + '/' + WAVE_COUNT : '0/' + WAVE_COUNT));
    shipEl.textContent = T(ship.nameKey);
    weaponEl.textContent = T(weapon.nameKey) + ' Lv' + player.weaponLv;
    wingEl.textContent = wingmen.length + '/2';
    bombEl.textContent = String(player.bombs);
  }

  function hideOverlay() {
    overlayEl.classList.add('ss-hide');
    if (Arcade.ui) Arcade.ui.setGamePhase('playing');
  }

  function showOverlay(title, text, primaryLabel, primaryFn, secondaryLabel, secondaryFn, showSelect) {
    ovTitle.textContent = title;
    ovText.innerHTML = text;
    ovPrimary.textContent = primaryLabel;
    ovPrimary.onclick = primaryFn;
    selectEl.classList.toggle('ss-hide', !showSelect);
    if (secondaryLabel) {
      ovSecondary.classList.remove('ss-hide');
      ovSecondary.textContent = secondaryLabel;
      ovSecondary.onclick = secondaryFn;
    } else {
      ovSecondary.classList.add('ss-hide');
      ovSecondary.onclick = null;
    }
    overlayEl.classList.remove('ss-hide');
    overlayEl.scrollTop = 0;
    if (Arcade.ui) Arcade.ui.setGamePhase('overlay');
    /* 覆盖层里已带「再来一局 / 返回机库」，隐藏工具栏同义按钮 */
    var toolsEl = document.querySelector('.ss-tools');
    if (toolsEl) toolsEl.classList.add('ss-tools-hidden');
  }

  function showReady() {
    showOverlay(
      T('gs.spaceshooter.readyTitle'),
      T('gs.spaceshooter.readyText'),
      T('gs.spaceshooter.startBtn'),
      startRun,
      null, null, true
    );
    syncOptions();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    dragging = false;
    showOverlay(
      T('gs.spaceshooter.pauseTitle'),
      T('gs.spaceshooter.pauseText'),
      T('gs.spaceshooter.resumeBtn'),
      resumeGame,
      T('gs.spaceshooter.restart'),
      startRun,
      false
    );
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    hideOverlay();
  }

  function togglePause() {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }

  function backToHangar() {
    resetRun();
    state = 'ready';
    showReady();
    updateHud();
  }

  /* ---------------- 输入 ---------------- */
  function confirmAction() {
    if (state === 'ready') startRun();
    else if (state === 'paused') resumeGame();
    else if (state === 'won' || state === 'lost') startRun();
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }
    if (e.code === 'Enter') {
      e.preventDefault();
      confirmAction();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      useBomb();
      return;
    }
    if (e.code === 'KeyB') { e.preventDefault(); useBomb(); return; }
    if (e.code === 'KeyL') { e.preventDefault(); toggleWingMode(); return; }
    if (e.code.indexOf('Arrow') === 0) e.preventDefault();
    keys[e.code] = true;
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  canvas.addEventListener('pointerdown', function (e) {
    if (state !== 'playing' || !player) return;
    e.preventDefault();
    var p = GK.pointer(canvas, e);
    dragOffX = p.x - player.x;
    dragOffY = p.y - player.y;
    dragging = true;
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging || state !== 'playing' || !player) return;
    var p = GK.pointer(canvas, e);
    player.x = clamp(p.x - dragOffX, 24, W - 24);
    player.y = clamp(p.y - dragOffY, 46, H - 30);
  }, { passive: true });
  window.addEventListener('pointerup', function () { dragging = false; });
  window.addEventListener('pointercancel', function () { dragging = false; });

  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', startRun);
  bombBtn.addEventListener('click', useBomb);
  wingBtn.addEventListener('click', toggleWingMode);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'playing') pauseGame();
  });
  /* ---------------- 绘制 ---------------- */
  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060713');
    g.addColorStop(0.55, '#090a1d');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var n1 = ctx.createRadialGradient(W * 0.25, H * 0.2, 10, W * 0.25, H * 0.2, 300);
    n1.addColorStop(0, 'rgba(0,240,255,0.10)');
    n1.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = n1;
    ctx.fillRect(0, 0, W, H);

    var n2 = ctx.createRadialGradient(W * 0.8, H * 0.72, 10, W * 0.8, H * 0.72, 360);
    n2.addColorStop(0, 'rgba(185,103,255,0.11)');
    n2.addColorStop(1, 'rgba(185,103,255,0)');
    ctx.fillStyle = n2;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.color;
      if (s.z === 3) ctx.fillRect(s.x, s.y, s.s, s.s * 2.2);
      else ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    if (!player) return;
    if (player.invuln > 0 && Math.floor(frame / 4) % 2 === 0) return;
    var ship = player.ship;
    ctx.save();
    ctx.translate(player.x, player.y);

    /* 引擎尾焰 */
    var fl = 15 + Math.sin(frame * 0.35) * 6;
    var fg = ctx.createLinearGradient(0, 14, 0, 14 + fl);
    fg.addColorStop(0, 'rgba(255,230,0,0.95)');
    fg.addColorStop(0.4, 'rgba(255,120,30,0.8)');
    fg.addColorStop(1, 'rgba(255,40,120,0)');
    ctx.fillStyle = fg;
    if (ship.key === 'bomber') {
      ctx.beginPath(); ctx.moveTo(-12, 15); ctx.lineTo(-7, 16 + fl); ctx.lineTo(-2, 15); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12, 15); ctx.lineTo(7, 16 + fl); ctx.lineTo(2, 15); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(-7, 15); ctx.lineTo(0, 16 + fl); ctx.lineTo(7, 15); ctx.closePath(); ctx.fill();
    }

    if (ship.key === 'guard') {
      /* 护卫机：宽装甲机翼 */
      var wg = ctx.createLinearGradient(-26, 0, 26, 22);
      wg.addColorStop(0, '#0a4a10');
      wg.addColorStop(0.5, ship.color);
      wg.addColorStop(1, '#0a2f1a');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(26, 2);
      ctx.lineTo(22, 16);
      ctx.lineTo(10, 12);
      ctx.lineTo(8, 20);
      ctx.lineTo(-8, 20);
      ctx.lineTo(-10, 12);
      ctx.lineTo(-22, 16);
      ctx.lineTo(-26, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,255,200,0.85)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#eaffee';
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(6, -4); ctx.lineTo(5, 18); ctx.lineTo(-5, 18); ctx.lineTo(-6, -4);
      ctx.closePath(); ctx.fill();
    } else if (ship.key === 'bomber') {
      /* 轰炸机：厚重矩形机翼 */
      var bw = ctx.createLinearGradient(-30, -6, 30, 22);
      bw.addColorStop(0, '#5a2600');
      bw.addColorStop(0.5, ship.color);
      bw.addColorStop(1, '#3a0820');
      ctx.fillStyle = bw;
      GK.roundRect(ctx, -27, -8, 54, 28, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,120,0.8)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#ffe8cc';
      GK.roundRect(ctx, -8, -24, 16, 36, 6);
      ctx.fill();
    } else {
      /* 突击机：轻盈三角 */
      var aw = ctx.createLinearGradient(-24, 0, 24, 20);
      aw.addColorStop(0, '#1b6dff');
      aw.addColorStop(0.5, ship.color);
      aw.addColorStop(1, '#0a2f66');
      ctx.fillStyle = aw;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(20, 8);
      ctx.lineTo(12, 18);
      ctx.lineTo(0, 12);
      ctx.lineTo(-12, 18);
      ctx.lineTo(-20, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,255,255,0.85)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      var bg = ctx.createLinearGradient(0, -24, 0, 20);
      bg.addColorStop(0, '#e8ffff');
      bg.addColorStop(0.4, ship.color);
      bg.addColorStop(1, '#0b4a7a');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(0, -24); ctx.lineTo(7, -6); ctx.lineTo(6, 16); ctx.lineTo(-6, 16); ctx.lineTo(-7, -6);
      ctx.closePath(); ctx.fill();
    }

    /* 驾驶舱 */
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.ellipse(0, -9, 3.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    /* 武器色环 */
    var wc = WEAPONS[player.weaponKey].color;
    ctx.globalAlpha = 0.35 + player.weaponLv * 0.12;
    ctx.strokeStyle = wc;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + player.weaponLv, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* 护盾分段环 */
    if (player.shieldPips > 0) {
      var seg = Math.PI * 2 / player.shieldMax;
      for (var i = 0; i < player.shieldMax; i++) {
        var on = i < player.shieldPips;
        var a0 = i * seg - Math.PI / 2 + 0.06;
        var a1 = a0 + seg - 0.12;
        ctx.strokeStyle = on ? 'rgba(0,240,255,0.85)' : 'rgba(0,240,255,0.18)';
        ctx.lineWidth = on ? 2.4 : 1.4;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = on ? 10 : 0;
        ctx.beginPath();
        ctx.arc(0, 0, 27 + player.shieldPips * 1.5, a0, a1);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (player.shieldState === 'charging') {
        var pct = player.chargeTimer / chargeInterval();
        ctx.strokeStyle = 'rgba(255,230,0,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 33, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
      }
    } else {
      /* 破盾：红色虚线环 + 冷却进度 */
      ctx.strokeStyle = 'rgba(255,45,85,0.45)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (player.shieldState === 'broken') {
        var total = player.ship.broken * regenSlow();
        var prog = 1 - Math.max(0, player.shieldCd) / total;
        ctx.strokeStyle = 'rgba(255,45,85,0.85)';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = '#ff2d55';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 32, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * prog);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    if (player.hitFlash > 0) {
      ctx.globalAlpha = player.hitFlash / 18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawWing(w, idx) {
    ctx.save();
    ctx.translate(w.x, w.y);
    if (w.hit > 0) {
      ctx.globalAlpha = w.hit / 10;
    }
    var bob = Math.sin(frame * 0.12 + w.seed) * 1.6;
    ctx.translate(0, bob);
    ctx.shadowColor = '#ff9f1c';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(9, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-9, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    /* 独立小血条 */
    var frac = w.hp / w.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-11, -20, 22, 3);
    ctx.fillStyle = frac > 0.5 ? '#39ff14' : '#ff2d55';
    ctx.fillRect(-11, -20, 22 * frac, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-11, -20, 22, 3);
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    var s = e.hit > 0 ? 1.15 : 1;
    ctx.scale(s, s);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;

    if (e.type === 'grunt') {
      var g = ctx.createLinearGradient(0, -16, 0, 16);
      g.addColorStop(0, '#ffb0b0');
      g.addColorStop(0.5, e.color);
      g.addColorStop(1, '#6a1010');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 15); ctx.lineTo(-16, -6); ctx.lineTo(-8, -14); ctx.lineTo(8, -14); ctx.lineTo(16, -6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(0, -1, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'seeker') {
      var g2 = ctx.createRadialGradient(0, -2, 2, 0, 0, 19);
      g2.addColorStop(0, '#ffd6ff');
      g2.addColorStop(0.5, e.color);
      g2.addColorStop(1, '#3a0a5c');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'spreader') {
      var g3 = ctx.createLinearGradient(-20, -16, 20, 16);
      g3.addColorStop(0, '#ffe0a0');
      g3.addColorStop(0.45, e.color);
      g3.addColorStop(1, '#7a3a00');
      ctx.fillStyle = g3;
      ctx.beginPath();
      ctx.moveTo(0, 15); ctx.lineTo(-20, 0); ctx.lineTo(-10, -15); ctx.lineTo(10, -15); ctx.lineTo(20, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (var i = -1; i <= 1; i++) ctx.fillRect(i * 8 - 1.5, 6, 3, 8);
    } else {
      var g4 = ctx.createLinearGradient(0, -20, 0, 20);
      g4.addColorStop(0, '#d8ffd0');
      g4.addColorStop(0.5, e.color);
      g4.addColorStop(1, '#0a4a10');
      ctx.fillStyle = g4;
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var ang = k * Math.PI / 3 - Math.PI / 6;
        var rr = 22;
        if (k === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = e.elite ? 'rgba(255,230,0,0.9)' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = e.elite ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      if (e.elite) {
        ctx.strokeStyle = 'rgba(255,230,0,0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, 27 + Math.sin(frame * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
      }
    }

    if (e.hit > 0) {
      ctx.globalAlpha = e.hit / 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawCrimson(b) {
    var def = b.def;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#5c0a2e';
    ctx.beginPath();
    ctx.moveTo(-86, -8); ctx.lineTo(-58, -38); ctx.lineTo(-32, -12);
    ctx.lineTo(-32, 18); ctx.lineTo(-60, 34); ctx.lineTo(-86, 12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(86, -8); ctx.lineTo(58, -38); ctx.lineTo(32, -12);
    ctx.lineTo(32, 18); ctx.lineTo(60, 34); ctx.lineTo(86, 12);
    ctx.closePath(); ctx.fill();

    var hull = ctx.createLinearGradient(0, -58, 0, 54);
    hull.addColorStop(0, '#ffb0d8');
    hull.addColorStop(0.45, def.color);
    hull.addColorStop(1, '#4a0724');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -58); ctx.lineTo(44, -32); ctx.lineTo(70, -4);
    ctx.lineTo(50, 26); ctx.lineTo(22, 44); ctx.lineTo(0, 52);
    ctx.lineTo(-22, 44); ctx.lineTo(-50, 26); ctx.lineTo(-70, -4);
    ctx.lineTo(-44, -32);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,0.7)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    var core = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, def.accent);
    core.addColorStop(0.8, def.color);
    core.addColorStop(1, 'rgba(74,7,36,0.9)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(frame * 0.12) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a030f';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = def.accent;
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawPrism(b) {
    var def = b.def;
    ctx.save();
    ctx.rotate(b.rotate);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 24;
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#123a4f' : '#2a1050';
      ctx.beginPath();
      ctx.moveTo(58, 0); ctx.lineTo(80, -12); ctx.lineTo(88, 0); ctx.lineTo(80, 12);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (var k = 0; k < 6; k++) {
      var ang = k * Math.PI / 3;
      if (k === 0) ctx.moveTo(Math.cos(ang) * 62, Math.sin(ang) * 62);
      else ctx.lineTo(Math.cos(ang) * 62, Math.sin(ang) * 62);
    }
    ctx.closePath(); ctx.stroke();

    ctx.strokeStyle = def.accent;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(0, 0, 40, -b.rotate, -b.rotate + Math.PI * 1.5); ctx.stroke();
    ctx.globalAlpha = 1;

    var core = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.4, def.color);
    core.addColorStop(1, 'rgba(20,10,50,0.9)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(0, -25); ctx.lineTo(22, -10); ctx.lineTo(22, 12);
    ctx.lineTo(0, 26); ctx.lineTo(-22, 12); ctx.lineTo(-22, -10);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawVoid(b) {
    var def = b.def;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 22;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + b.t * 0.01;
      var len = 88 + Math.sin(b.t * 0.05 + i) * 14;
      ctx.strokeStyle = 'rgba(57,255,20,0.72)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 52, Math.sin(a) * 52);
      ctx.quadraticCurveTo(
        Math.cos(a + 0.3) * (len * 0.8), Math.sin(a + 0.3) * (len * 0.8),
        Math.cos(a + 0.15) * len, Math.sin(a + 0.15) * len
      );
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,0,0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,230,0,0.8)';
      ctx.beginPath();
      ctx.arc(Math.cos(a + 0.15) * len, Math.sin(a + 0.15) * len, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    var body = ctx.createRadialGradient(-10, -14, 6, 0, 0, 62);
    body.addColorStop(0, '#d8ffd0');
    body.addColorStop(0.3, def.color);
    body.addColorStop(0.7, '#0d4a12');
    body.addColorStop(1, '#04160a');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, 56 + Math.sin(frame * 0.1) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke();

    ctx.shadowBlur = 0;
    var eyes = [[-20, -16], [16, -20], [2, 17]];
    for (var e = 0; e < eyes.length; e++) {
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.ellipse(eyes[e][0], eyes[e][1], 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a030f';
      ctx.beginPath(); ctx.ellipse(eyes[e][0], eyes[e][1], 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    /* 裂开的巨口 + 锯齿 */
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.beginPath(); ctx.ellipse(0, 6, 28, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,0.8)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#e8ffff';
    for (var tth = -2; tth <= 2; tth++) {
      var tx = tth * 9;
      ctx.beginPath();
      ctx.moveTo(tx - 4, -2); ctx.lineTo(tx, 7); ctx.lineTo(tx + 4, -2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - 4, 14); ctx.lineTo(tx, 5); ctx.lineTo(tx + 4, 14);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawBoss() {
    if (!boss) return;
    var b = boss;
    var sc = b.entering ? 0.5 + 0.5 * GK.easeOutBack(Math.min(1, b.entrance / 100)) : 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(sc, sc);
    if (b.def.id === 'crimson') drawCrimson(b);
    else if (b.def.id === 'prism') drawPrism(b);
    else drawVoid(b);
    if (b.hit > 0) {
      ctx.globalAlpha = b.hit / 14;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawBossLasers() {
    for (var i = 0; i < bossLasers.length; i++) {
      var l = bossLasers[i];
      if (l.warn > 0) {
        var pulse = 0.25 + 0.3 * Math.abs(Math.sin(frame * 0.18));
        ctx.strokeStyle = l.color;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 10]);
        ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = pulse + 0.2;
        ctx.beginPath();
        ctx.moveTo(l.x - 8, l.y); ctx.lineTo(l.x + 8, l.y); ctx.lineTo(l.x, l.y + 14);
        ctx.closePath(); ctx.fillStyle = l.color; ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        var flick = 0.55 + Math.random() * 0.25;
        ctx.globalAlpha = flick;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 24;
        ctx.fillStyle = l.color;
        ctx.fillRect(l.x - l.w / 2, l.y, l.w, H - l.y);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(l.x - l.w / 6, l.y, l.w / 3, H - l.y);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBullets() {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      if (b.type === 'laser') {
        ctx.fillRect(b.x - b.r, b.y - 11, b.r * 2, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x - 0.8, b.y - 8, 1.6, 16);
      } else if (b.type === 'missile') {
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(4, 0); ctx.lineTo(0, 7); ctx.lineTo(-4, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff2d95';
        ctx.beginPath(); ctx.arc(0, 4, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (var k = 0; k < ebullets.length; k++) {
      var eb = ebullets[k];
      ctx.save();
      ctx.shadowColor = eb.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = eb.color;
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(eb.x - eb.r * 0.25, eb.y - eb.r * 0.25, eb.r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPowerups() {
    for (var i = 0; i < powerups.length; i++) {
      var p = powerups[i];
      var col = '#00f0ff';
      if (p.type === 'weapon') col = '#ffe600';
      else if (p.type === 'bomb') col = '#ff2d95';
      else if (p.type === 'heal') col = '#39ff14';
      else if (p.type === 'shield') col = '#00f0ff';
      else if (p.type === 'wing') col = '#b967ff';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 0.05);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.rotate(-p.t * 0.05);
      ctx.fillStyle = col;
      if (p.type === 'wing') {
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(7, 5); ctx.lineTo(0, 2); ctx.lineTo(-7, 5);
        ctx.closePath(); ctx.fill();
      } else if (p.type === 'weapon') {
        ctx.beginPath();
        ctx.moveTo(-6, 2); ctx.lineTo(0, -7); ctx.lineTo(6, 2);
        ctx.lineTo(6, 5); ctx.lineTo(0, -4); ctx.lineTo(-6, 5);
        ctx.closePath(); ctx.fill();
      } else if (p.type === 'bomb') {
        ctx.beginPath();
        ctx.arc(0, 1, 4, 0, Math.PI * 2); ctx.fill();
        for (var r = 0; r < 8; r++) {
          var a = r * Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
          ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
        }
      } else if (p.type === 'shield') {
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(7, -4); ctx.lineTo(6, 4); ctx.lineTo(0, 8); ctx.lineTo(-6, 4); ctx.lineTo(-7, -4);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      }
      ctx.restore();
    }
  }

  function drawParticles(layer) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if ((p.z || 0) !== layer) continue;
      var a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < floats.length; i++) {
      var f = floats[i];
      var k = f.t / f.dur;
      var rise = 34 * GK.easeOutCubic(k);
      var pop = 0.72 + 0.28 * GK.easeOutBack(Math.min(1, k * 2.4));
      ctx.globalAlpha = 1 - k * k;
      ctx.save();
      ctx.translate(f.x, f.y - rise);
      ctx.scale(pop, pop);
      ctx.font = "900 12px 'Press Start 2P','Fusion Pixel',monospace";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(f.str, 0, 0);
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;
      ctx.fillText(f.str, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function showBanner(text, frames) {
    bannerText = text;
    bannerT = frames;
    bannerMax = frames;
  }

  function drawBanner() {
    if (bannerT <= 0 || !bannerText) return;
    var elapsed = bannerMax - bannerT;
    var alpha = Math.min(1, elapsed / 12, bannerT / 26);
    var scale = 1 + Math.sin(frame * 0.12) * 0.03;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(W / 2, 210);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "14px 'Press Start 2P', monospace";
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.fillText(bannerText, 0, 0);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,240,255,0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-150, 18); ctx.lineTo(150, 18); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    ctx.save();
    if (shake > 0.5) ctx.translate(rand(-shake, shake) * 0.55, rand(-shake, shake) * 0.55);
    drawParticles(0); /* 尾焰后景 */
    drawPowerups();
    for (var i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
    drawBoss();
    drawBossLasers();
    drawBullets();
    for (var w = 0; w < wingmen.length; w++) drawWing(wingmen[w], w);
    drawPlayer();
    drawParticles(1);
    drawFloats();
    ctx.restore();

    if (flash > 0.01) {
      ctx.globalAlpha = Math.min(1, flash);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    drawBanner();

    var vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }
  /* ---------------- QA 钩子（仅 ?qa=1） ---------------- */
  function qaState() {
    var shieldState = player ? player.shieldState : null;
    return {
      state: state, mode: mode, wave: wave, score: score, kills: kills,
      x: player ? Math.round(player.x) : 0,
      y: player ? Math.round(player.y) : 0,
      r: player ? player.r : 0,
      lives: player ? player.lives : 0,
      ship: player ? player.shipKey : selectedShip,
      weapon: player ? player.weaponKey : selectedWeapon,
      weaponLv: player ? player.weaponLv : 1,
      shieldPips: player ? player.shieldPips : 0,
      shieldMax: player ? player.shieldMax : 0,
      shieldState: shieldState,
      shieldCooldown: player ? player.shieldCd : 0,
      shieldCooldownSec: player ? +(player.shieldCd / 60).toFixed(2) : 0,
      shieldHud: shieldEl.textContent,
      bombs: player ? player.bombs : 0,
      wingMode: player ? player.wingMode : null,
      wingmen: wingmen.length,
      wingHp: wingmen.map(function (w) { return w.hp; }),
      affixes: (function () {
        var out = {};
        for (var k in affixes) if (Object.prototype.hasOwnProperty.call(affixes, k)) out[k] = affixes[k];
        return out;
      })(),
      boss: boss ? {
        id: boss.def.id, name: T(boss.def.nameKey), hp: Math.round(boss.hp),
        maxHp: boss.maxHp, phase: boss.phase, entering: boss.entering,
        x: boss.x, y: boss.y, w: boss.w, h: boss.h
      } : null,
      enemies: enemies.filter(function (e) { return e.hp > 0; }).map(function (e) {
        return { x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, type: e.type, r: e.r || 14, elite: !!e.elite };
      }),
      ebullets: ebullets.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r, homing: b.homing || 0 }; }),
      bossLasers: bossLasers.map(function (l) { return { x: l.x, y: l.y, w: l.w, len: l.len, active: l.active, t: l.t }; }),
      bossActive: bossActive,
      powerups: powerups.map(function (p) { return { type: p.type, x: p.x, y: p.y, t: p.t }; }),
      ended: ended, submitted: submitted,
      result: resultInfo,
      best: (function () {
        try { return Arcade.storage.getBest('spaceshooter'); } catch (e) { return null; }
      })()
    };
  }

  function qaForceWin() {
    if (ended) return false;
    if (state === 'ready') startRun();
    if (state === 'paused') resumeGame();
    if (state !== 'playing') return false;
    endRun(true);
    return true;
  }

  function qaForceLose() {
    if (ended) return false;
    if (state === 'ready') startRun();
    if (state === 'paused') resumeGame();
    if (state !== 'playing') return false;
    if (player) player.lives = 0;
    endRun(false);
    return true;
  }

  function qaSpawnPickup(type) {
    if (!player || state !== 'playing') return false;
    powerups.push({
      x: clamp(player.x, 30, W - 30),
      y: player.y - 90,
      type: type || 'wing',
      t: 0
    });
    return true;
  }

  function qaHit() {
    if (!player || state !== 'playing') return false;
    player.invuln = 0;
    damagePlayer();
    return true;
  }

  function qaSpawnBoss(id) {
    if (state === 'ready') startRun();
    if (state !== 'playing') return false;
    spawnQueue = []; enemies = []; ebullets = []; bossLasers = [];
    bossActive = false; boss = null; transitionT = -1; pendingBoss = false;
    var idx = 0;
    for (var i = 0; i < BOSSES.length; i++) if (BOSSES[i].id === id) idx = i;
    campaignBossIdx = idx;
    bossIndex = idx;
    startBoss();
    return true;
  }

  function qaSetBossHp(f) {
    if (!boss) return false;
    boss.hp = Math.max(1, boss.maxHp * f);
    return true;
  }

  function qaWarpTo(n) {
    if (state === 'ready') startRun();
    if (state !== 'playing') return false;
    enemies = []; spawnQueue = []; ebullets = []; bossLasers = [];
    boss = null; bossActive = false; pendingBoss = false; transitionT = -1;
    wave = Math.max(1, n - 1);
    startWave(Math.max(1, n));
    return true;
  }

  if (/(?:[?&])qa=1(?:&|$)/.test(window.location.search)) {
    window.__qa = {
      state: qaState,
      /* QA：按真实开局流程启动（难度=机体/武器/模式选择） */
      start: function (o) {
        o = o || {};
        if (o.ship && SHIPS[o.ship]) selectedShip = o.ship;
        if (o.weapon && WEAPONS[o.weapon]) selectedWeapon = o.weapon;
        if (o.mode) mode = o.mode === 'endless' ? 'endless' : 'campaign';
        syncOptions();
        resetRun();
        startRun();
        return qaState();
      },
      wing: function () { toggleWingMode(); return qaState(); },
      forceWin: qaForceWin,
      forceLose: qaForceLose,
      spawnPickup: qaSpawnPickup,
      clearBullets: function () { ebullets = []; return true; },
      hit: qaHit,
      spawnBoss: qaSpawnBoss,
      setBossHp: qaSetBossHp,
      warpTo: qaWarpTo,
      useBomb: function () { useBomb(); return true; }
    };
  }

  /* ---------------- 启动 ---------------- */
  resetRun();
  state = 'ready';
  showReady();
  updateHud();
  window.GAME_RESTART = startRun;
  Arcade.loop.start(update, render, 16);
})();
