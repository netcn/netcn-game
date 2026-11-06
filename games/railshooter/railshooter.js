/* ============================================================
   轨道射击 Rail Shooter —— 旗舰版
   · 伪 3D 霓虹轨道：敌人从地平线逼近，玩家在近景轨道上左右/前后闪避
   · 弹匣 12 发 / 手动 R 换弹（有耗时与进度条）/ 打空自动换弹 / 换弹中禁射
   · 生命 100 + 护甲 60；敌人子弹与近战冲锋会扣血；归零→失败结算
   · 6 波敌人（冲锋 / 远程 / 飞行 / 护盾）+ 双阶段 Boss（弱点弹幕）
   · 平民横穿与惊慌逃散；误伤扣 60 分并断连击（画面闪红 + 音效）
   · 补给掉落：弹药箱 / 医疗包 / 护盾；应急弹药兜底，绝不静默卡死
   · 存档 arcade_save_railshooter（波次 / 生命 / 弹药 / 分数 / Boss），断点续玩
   · 键鼠：WASD 移动、空格射击、R 换弹、P 暂停；触控：拖拽连射 + ≥44px 按钮
   仅 ?qa=1 暴露 window.__QA（正常访问不存在）
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.railshooter.tut1t'), d: T('gs.railshooter.tut1') },
  { t: T('gs.railshooter.tut2t'), d: T('gs.railshooter.tut2') },
  { t: T('gs.railshooter.tut3t'), d: T('gs.railshooter.tut3') },
  { t: T('gs.railshooter.tut4t'), d: T('gs.railshooter.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var W = 640, H = 400, HORIZON = 150;
  var MAG_SIZE = 12, RELOAD_TIME = 1.2, FIRE_INTERVAL = 0.135;
  var MAX_RESERVE = 96, EMERGENCY_DELAY = 6;
  var BOSS_HP = 1500, BOSS_HIT = 30;
  var PLAYER_MIN_X = 58, PLAYER_MAX_X = W - 58;
  var PLAYER_MIN_Y = 296, PLAYER_MAX_Y = 362;

  var TYPE_BASE = { rusher: 8, shooter: 12, flyer: 14, shield: 16 };
  var TYPE_HP = { rusher: 1, shooter: 3, flyer: 2, shield: 3 };
  var TYPE_COLOR = { rusher: '#ff3b5c', shooter: '#ff2d95', flyer: '#ffe600', shield: '#b967ff' };

  var WAVES = [
    { key: 'wave1', spawn: 1.25, max: 4, dur: 20, kills: 8, types: ['rusher'] },
    { key: 'wave2', spawn: 1.55, max: 3, dur: 22, kills: 7, types: ['shooter', 'rusher'] },
    { key: 'wave3', spawn: 1.25, max: 5, dur: 24, kills: 9, types: ['flyer', 'rusher'] },
    { key: 'wave4', spawn: 1.65, max: 4, dur: 24, kills: 8, types: ['shield', 'shooter'] },
    { key: 'wave5', spawn: 1.1, max: 6, dur: 26, kills: 12, types: ['rusher', 'shooter', 'flyer', 'shield'] },
    { key: 'wave6', spawn: 0, max: 0, dur: 0, kills: 0, types: [] }
  ];

  /* ---------------- 布局 ---------------- */
  root.innerHTML =
    '<div class="rs-wrap">' +
    '  <div class="rs-hud" id="rs-hud">' +
    '    <div class="rs-hud-row">' +
    '      <span class="rs-hud-item"><em>' + T('gs.railshooter.hudScore') + '</em><b id="rs-score">0</b></span>' +
    '      <span class="rs-hud-item"><em>' + T('gs.railshooter.hudWave') + '</em><b id="rs-wave">1/6</b></span>' +
    '      <span class="rs-hud-item"><em>' + T('gs.railshooter.hudCombo') + '</em><b id="rs-combo">0</b></span>' +
    '      <span class="rs-hud-item"><em>' + T('gs.railshooter.hudAcc') + '</em><b id="rs-acc">--</b></span>' +
    '      <span class="rs-hud-item"><em>BEST</em><b id="rs-best">--</b></span>' +
    '    </div>' +
    '    <div class="rs-hud-row">' +
    '      <div class="rs-gauge"><em>HP</em><div class="rs-bar hp"><i id="rs-hp"></i></div><span id="rs-hp-num">100</span></div>' +
    '      <div class="rs-gauge"><em>' + T('gs.railshooter.hudArmor') + '</em><div class="rs-bar armor"><i id="rs-armor"></i></div><span id="rs-armor-num">0</span></div>' +
    '      <div class="rs-gauge rs-gauge-ammo"><em>' + T('gs.railshooter.hudAmmo') + '</em>' +
    '        <span class="rs-ammo-box"><span id="rs-ammo" class="rs-ammo">12/48</span>' +
    '        <div class="rs-bar reload"><i id="rs-reload"></i></div></span></div>' +
    '    </div>' +
    '    <div class="rs-boss rs-hide" id="rs-boss-bar">' +
    '      <em>BOSS</em>' +
    '      <div class="rs-bar boss"><i id="rs-boss-fill"></i></div>' +
    '      <span class="rs-boss-pct" id="rs-boss-pct">100%</span>' +
    '      <span class="rs-boss-ph" id="rs-boss-phase">PHASE 1</span>' +
    '    </div>' +
    '  </div>' +
    '  <div class="rs-stage" id="rs-stage">' +
    '    <canvas class="rs-canvas" id="rs-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '    <div class="rs-screen" id="rs-menu">' +
    '      <div class="rs-screen-title">' + T('gs.railshooter.menuTitle') + '</div>' +
    '      <div class="rs-screen-sub">' + T('gs.railshooter.menuSub') + '</div>' +
    '      <div class="rs-screen-btns">' +
    '        <button class="btn green" id="rs-start">' + T('gs.railshooter.startBtn') + '</button>' +
    '        <button class="btn yellow rs-hide" id="rs-continue">' + T('gs.railshooter.continueBtn') + '</button>' +
    '      </div>' +
    '      <div class="rs-keys">' + T('gs.railshooter.menuKeys') + '</div>' +
    '    </div>' +
    '    <div class="rs-screen rs-hide" id="rs-result">' +
    '      <div class="rs-screen-title" id="rs-res-title"></div>' +
    '      <div class="rs-screen-sub" id="rs-res-sub"></div>' +
    '      <div class="rs-res-grid" id="rs-res-stats"></div>' +
    '      <div class="rs-screen-btns">' +
    '        <button class="btn green" id="rs-again">' + T('gs.railshooter.replay') + '</button>' +
    '        <button class="btn purple" id="rs-back">' + T('gs.railshooter.backMenu') + '</button>' +
    '      </div>' +
    '    </div>' +
    '    <div class="rs-pause rs-hide" id="rs-pause-ov">' +
    '      <div>' + T('gs.railshooter.pausedOverlay') + '</div>' +
    '      <div class="rs-screen-btns">' +
    '        <button class="btn green" id="rs-resume">' + T('gs.railshooter.resume') + '</button>' +
    '        <button class="btn yellow" id="rs-pause-restart">' + T('gs.railshooter.restart') + '</button>' +
    '        <button class="btn purple" id="rs-quitmenu">' + T('gs.railshooter.backMenu') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="rs-touch" id="rs-touch">' +
    '    <button class="rs-tbtn" id="rs-move-left" aria-label="' + T('gs.railshooter.moveLeft') + '">&#9664;</button>' +
    '    <button class="rs-tbtn" id="rs-move-right" aria-label="' + T('gs.railshooter.moveRight') + '">&#9654;</button>' +
    '    <button class="rs-tbtn wide" id="rs-reload-btn" aria-label="' + T('gs.railshooter.reloadBtn') + '">' + T('gs.railshooter.reloadBtn') + '</button>' +
    '    <button class="rs-tbtn wide" id="rs-pause-btn" aria-label="' + T('gs.railshooter.pause') + '">' + T('gs.railshooter.pause') + '</button>' +
    '  </div>' +
    '  <div class="rs-msg" id="rs-msg">' + T('gs.railshooter.help') + '</div>' +
    '  <div class="game-controls">' +
    '    <button class="btn purple" id="rs-restart">' + T('gs.railshooter.restart') + '</button>' +
    '  </div>' +
    '</div>';

  var canvas = document.getElementById('rs-canvas');
  var info = GK.setup(canvas, W, H);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = info.ctx;

  var elScore = document.getElementById('rs-score');
  var elWave = document.getElementById('rs-wave');
  var elCombo = document.getElementById('rs-combo');
  var elAcc = document.getElementById('rs-acc');
  var elBest = document.getElementById('rs-best');
  var elHp = document.getElementById('rs-hp');
  var elHpNum = document.getElementById('rs-hp-num');
  var elArmor = document.getElementById('rs-armor');
  var elArmorNum = document.getElementById('rs-armor-num');
  var elAmmo = document.getElementById('rs-ammo');
  var elReload = document.getElementById('rs-reload');
  var bossBar = document.getElementById('rs-boss-bar');
  var elBossFill = document.getElementById('rs-boss-fill');
  var elBossPct = document.getElementById('rs-boss-pct');
  var elBossPhase = document.getElementById('rs-boss-phase');
  var msg = document.getElementById('rs-msg');
  var menuScreen = document.getElementById('rs-menu');
  var resultScreen = document.getElementById('rs-result');
  var resTitle = document.getElementById('rs-res-title');
  var resSub = document.getElementById('rs-res-sub');
  var resStats = document.getElementById('rs-res-stats');
  var pauseOv = document.getElementById('rs-pause-ov');
  var startBtn = document.getElementById('rs-start');
  var contBtn = document.getElementById('rs-continue');
  var againBtn = document.getElementById('rs-again');
  var backBtn = document.getElementById('rs-back');
  var pauseTopBtn = document.getElementById('rs-pause-btn');
  var restartBtn = document.getElementById('rs-restart');
  var pauseRestartBtn = document.getElementById('rs-pause-restart');
  var resumeBtn = document.getElementById('rs-resume');
  var quitMenuBtn = document.getElementById('rs-quitmenu');
  var reloadBtn = document.getElementById('rs-reload-btn');
  var leftBtn = document.getElementById('rs-move-left');
  var rightBtn = document.getElementById('rs-move-right');
  var touchBar = document.getElementById('rs-touch');

  /* ---------------- 运行时状态 ---------------- */
  var state = 'menu';             // menu | play | paused | over
  var score = 0, combo = 0, maxCombo = 0, shots = 0, hits = 0, civHits = 0, kills = 0;
  var runTime = 0;
  var player = { x: W / 2, y: 340, hp: 100, maxHp: 100, armor: 0, maxArmor: 60, r: 15, invuln: 0 };
  var mag = MAG_SIZE, reserve = 48;
  var reloading = false, reloadT = 0, reloadDur = RELOAD_TIME, reloadBlockT = 0;
  var emptyT = 0;
  var waveIndex = 0, waveT = 0, waveKills = 0, spawnTimer = 0, waveBannerT = 0;
  var interT = 0, civTimer = 0, saveT = 0;
  var enemies = [], ebullets = [], civs = [], drops = [], tracers = [], particles = [], floaters = [], rings = [];
  var boss = null, bossWarnT = 0, phaseBannerT = 0, victoryDelay = 0;
  var cursor = { x: W / 2, y: 230 };
  var firing = false, fireCd = 0, muzzleT = 0, muzzle = { x: 0, y: 0, ang: -Math.PI / 2 };
  var shake = 0, redFlash = 0, whiteFlash = 0;
  var keys = { left: false, right: false, up: false, down: false };
  var hud = { score: -1, wave: '', combo: -1, acc: '', best: '', hp: -1, armor: -1, ammo: '', reload: -1,
    bossActive: false, bossPct: -1, bossPhase: 0 };
  var lastFrame = 0;
  var slideX = 0;
  var qaGod = false;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }
  function accuracy() { return shots ? Math.round((hits / shots) * 100) : 0; }

  function setMsg(text, color) {
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = color || '';
  }

  function i18n(key, vars) {
    var s = T(key);
    if (vars) for (var k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

  /* ---------------- HUD ---------------- */
  function refreshBest() {
    var b = Arcade.storage ? Arcade.storage.getBest('railshooter') : null;
    hud.best = b === null ? '--' : String(b);
    elBest.textContent = hud.best;
  }

  function updateHud(force) {
    var acc = accuracy();
    if (force || hud.score !== score) { hud.score = score; elScore.textContent = String(score); }
    var wt = (waveIndex >= 5 ? 'BOSS' : String(waveIndex + 1)) + '/6';
    if (force || hud.wave !== wt) { hud.wave = wt; elWave.textContent = wt; }
    if (force || hud.combo !== combo) { hud.combo = combo; elCombo.textContent = String(combo); }
    var accText = shots ? acc + '%' : '--';
    if (force || hud.acc !== accText) { hud.acc = accText; elAcc.textContent = accText; }

    var hpPct = clamp(player.hp / player.maxHp, 0, 1);
    var arPct = clamp(player.armor / player.maxArmor, 0, 1);
    elHp.style.transform = 'scaleX(' + hpPct.toFixed(3) + ')';
    elArmor.style.transform = 'scaleX(' + arPct.toFixed(3) + ')';
    if (force || hud.hp !== player.hp) {
      hud.hp = player.hp;
      elHpNum.textContent = String(Math.max(0, Math.round(player.hp)));
      elHp.parentNode.classList.toggle('critical', player.hp <= 30);
    }
    if (force || hud.armor !== player.armor) {
      hud.armor = player.armor;
      elArmorNum.textContent = String(Math.max(0, Math.round(player.armor)));
    }

    var ammoText = mag + '/' + reserve;
    if (force || hud.ammo !== ammoText) {
      hud.ammo = ammoText;
      elAmmo.textContent = ammoText;
      elAmmo.classList.toggle('low', mag <= 3);
      elAmmo.classList.toggle('empty', mag === 0);
    }
    var rp = reloading ? clamp(1 - reloadT / reloadDur, 0, 1) : 0;
    if (force || Math.abs(rp - hud.reload) > 0.004) {
      hud.reload = rp;
      elReload.style.transform = 'scaleX(' + rp.toFixed(3) + ')';
    }
    elReload.parentNode.classList.toggle('active', reloading);

    var bossActive = !!(boss && !boss.dead);
    if (force || hud.bossActive !== bossActive) {
      hud.bossActive = bossActive;
      bossBar.classList.toggle('rs-hide', !bossActive);
    }
    if (bossActive) {
      var bPct = clamp(boss.hp / boss.maxHp, 0, 1);
      if (force || Math.abs(bPct - hud.bossPct) > 0.002) {
        hud.bossPct = bPct;
        elBossFill.style.transform = 'scaleX(' + bPct.toFixed(3) + ')';
        elBossPct.textContent = Math.round(bPct * 100) + '%';
      }
      if (force || hud.bossPhase !== boss.phase) {
        hud.bossPhase = boss.phase;
        elBossPhase.textContent = 'PHASE ' + boss.phase;
        bossBar.classList.toggle('phase2', boss.phase === 2);
      }
    }
  }

  /* ---------------- 局生命周期 ---------------- */
  function clearWorld() {
    enemies = []; ebullets = []; civs = []; drops = [];
    tracers = []; particles = []; floaters = []; rings = [];
    boss = null; bossWarnT = 0; phaseBannerT = 0; victoryDelay = 0;
  }

  function resetRun() {
    clearWorld();
    score = 0; combo = 0; maxCombo = 0; shots = 0; hits = 0; civHits = 0; kills = 0;
    runTime = 0; firing = false; fireCd = 0; muzzleT = 0;
    mag = MAG_SIZE; reserve = 48; reloading = false; reloadT = 0; reloadBlockT = 0; emptyT = 0;
    player.hp = player.maxHp; player.armor = 0; player.invuln = 0;
    player.x = W / 2; player.y = 340;
    cursor.x = W / 2; cursor.y = 230;
    waveIndex = 0; waveT = 0; waveKills = 0; spawnTimer = 0.8; waveBannerT = 0;
    interT = 0; civTimer = 0; saveT = 0;
    shake = 0; redFlash = 0; whiteFlash = 0;
    keys.left = keys.right = keys.up = keys.down = false;
    updateHud(true); refreshBest();
  }

  function beginWave(n) {
    waveIndex = n; waveT = 0; waveKills = 0; spawnTimer = 0.7; waveBannerT = 2.2;
    civTimer = 3.0; enemies = []; ebullets = []; boss = null; bossWarnT = 0;
    if (n >= 5) {
      bossWarnT = 3.0;
      setMsg(T('gs.railshooter.bossWarn'), 'var(--neon-pink)');
      if (Arcade.audio) Arcade.audio.play('error');
    } else {
      setMsg(i18n('gs.railshooter.waveBanner', { n: n + 1, w: T('gs.railshooter.' + WAVES[n].key) }), 'var(--neon-yellow)');
      if (Arcade.audio) Arcade.audio.play('ui');
    }
    updateHud(true);
  }

  function showPlay() {
    menuScreen.classList.add('rs-hide');
    resultScreen.classList.add('rs-hide');
    pauseOv.classList.add('rs-hide');
    if (Arcade.ui) Arcade.ui.setGamePhase('playing');
  }

  /* 仅在游玩中显示触控条与重开，避免菜单/结算出现无效按钮或重复同义入口 */
  function syncRunControls() {
    var play = state === 'play';
    if (touchBar) touchBar.classList.toggle('rs-hide', !play);
    if (reloadBtn) reloadBtn.disabled = !play;
    if (restartBtn) restartBtn.classList.toggle('rs-hide', !play);
  }

  function startRun() {
    resetRun();
    state = 'play';
    showPlay();
    syncRunControls();
    setMsg(T('gs.railshooter.help'), '');
    beginWave(0);
    if (Arcade.audio) Arcade.audio.play('ui');
    if (Arcade.savegame) Arcade.savegame.write();
    lastFrame = 0;
  }

  function backToMenu() {
    state = 'menu';
    firing = false;
    reloading = false;
    clearWorld();
    resetRun();
    menuScreen.classList.remove('rs-hide');
    resultScreen.classList.add('rs-hide');
    pauseOv.classList.add('rs-hide');
    if (Arcade.ui) Arcade.ui.setGamePhase('playing');
    syncRunControls();
    setMsg(T('gs.railshooter.help'), '');
    if (Arcade.savegame) Arcade.savegame.clear();
    refreshContinue();
    if (Arcade.audio) Arcade.audio.play('back');
  }

  function togglePause() {
    if (state !== 'play' && state !== 'paused') return;
    if (state === 'play') {
      state = 'paused';
      firing = false;
      pauseOv.classList.remove('rs-hide');
      if (Arcade.savegame) Arcade.savegame.write();
    } else {
      state = 'play';
      pauseOv.classList.add('rs-hide');
      lastFrame = 0;
    }
    syncRunControls();
    if (Arcade.ui) Arcade.ui.setGamePhase(state === 'paused' ? 'overlay' : 'playing');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function ratingFor(acc) {
    if (acc >= 65 && civHits === 0) return 'S';
    if (acc >= 50 && civHits <= 1) return 'A';
    if (acc >= 32) return 'B';
    return 'C';
  }

  function finish(outcome) {
    if (state === 'over') return;
    var win = outcome === 'win';
    state = 'over';
    firing = false;
    reloading = false;
    pauseOv.classList.add('rs-hide');
    syncRunControls();
    if (Arcade.savegame) Arcade.savegame.clear();

    var acc = accuracy();
    var isNew = false;
    if (Arcade.shell) isNew = !!Arcade.shell.submitScore(score);
    refreshBest();

    resTitle.textContent = T(win ? 'gs.railshooter.resWin' : 'gs.railshooter.resFail');
    resTitle.style.color = win ? 'var(--neon-green)' : 'var(--neon-pink)';
    resSub.textContent = T(win ? 'gs.railshooter.resSubWin' : 'gs.railshooter.resSubFail');
    var rows = [
      { k: T('gs.railshooter.resScore'), v: String(score) },
      { k: T('gs.railshooter.resAcc'), v: acc + '%' },
      { k: T('gs.railshooter.resTime'), v: GK.fmtTime(runTime * 1000) },
      { k: T('gs.railshooter.resRating'), v: ratingFor(acc) },
      { k: T('gs.railshooter.resCombo'), v: String(maxCombo) },
      { k: T('gs.railshooter.resWave'), v: (waveIndex + 1) + '/6' },
      { k: T('gs.railshooter.resKills'), v: String(kills) },
      { k: T('gs.railshooter.resCiv'), v: String(civHits) },
      { k: T('gs.railshooter.resBest'), v: hud.best }
    ];
    resStats.innerHTML = rows.map(function (r) {
      return '<div class="rs-res-row"><span>' + r.k + '</span><b>' + r.v + '</b></div>';
    }).join('');
    if (isNew) resStats.innerHTML += '<div class="rs-res-new">' + T('gs.railshooter.newRecord') + '</div>';

    setMsg(i18n(win ? 'gs.railshooter.timeWin' : 'gs.railshooter.timeFail', { n: score }),
      win ? 'var(--neon-green)' : 'var(--neon-pink)');
    resultScreen.classList.remove('rs-hide');
    if (Arcade.ui) Arcade.ui.setGamePhase('overlay');
    if (Arcade.audio) Arcade.audio.play(win ? 'win' : 'lose');
    if (win && Arcade.juice) Arcade.juice.win();
    if (!win && Arcade.juice) Arcade.juice.lose();
    updateHud(true);
    refreshContinue();
  }

  /* ---------------- 换弹 ---------------- */
  function startReload() {
    if (state !== 'play' || reloading) return false;
    if (mag >= MAG_SIZE) return false;
    if (reserve <= 0) { setMsg(T('gs.railshooter.reloadNoReserve'), 'var(--neon-pink)'); return false; }
    reloading = true; reloadT = reloadDur;
    if (Arcade.audio) Arcade.audio.play('ui');
    setMsg(T('gs.railshooter.reloading'), 'var(--neon-cyan)');
    updateHud(true);
    return true;
  }

  function interruptReload() {
    if (!reloading) return;
    reloading = false; reloadT = 0; reloadBlockT = 0.4;
    setMsg(T('gs.railshooter.reloadInterrupted'), 'var(--neon-pink)');
    if (Arcade.audio) Arcade.audio.play('error');
  }

  function completeReload() {
    var need = Math.min(MAG_SIZE - mag, reserve);
    mag += need; reserve -= need;
    reloading = false; reloadT = 0;
    if (Arcade.audio) Arcade.audio.play('match');
    setMsg(T('gs.railshooter.reloadDone'), 'var(--neon-green)');
    updateHud(true);
  }

  /* ---------------- 特效小件 ---------------- */
  function floater(text, x, y, color, size) {
    floaters.push({ x: x, y: y, text: text, color: color || '#39ff14', life: 1, size: size || 13 });
  }

  function sparkBurst(x, y, color, count, power) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = rnd(40, power || 220);
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: rnd(0.5, 1), size: rnd(1.4, 3.2), color: color, grav: rnd(120, 240)
      });
    }
  }

  function shockRing(x, y, color, maxR) {
    rings.push({ x: x, y: y, r: 8, maxR: maxR || 60, color: color, life: 1 });
  }

  function shieldCore(e) {
    var rr = (e.r || 14) * (e.scale || 0.6);
    return { x: e.x, y: e.y - rr * 0.62, r: 6 + rr * 0.28 };
  }

  /* ---------------- 射击与命中 ---------------- */
  function pickTarget(x, y) {
    var best = null, bestD = 1e9;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead) continue;
      var rr = e.r * e.scale;
      var d = dist(x, y, e.x, e.y);
      if (e.type === 'shield') {
        var core = shieldCore(e);
        var dc = dist(x, y, core.x, core.y);
        if (dc <= core.r + 6 && dc < bestD) { bestD = dc; best = { kind: 'enemy', enemy: e, weak: true }; }
        else if (d <= rr * 1.05 + 8 && d < bestD) { bestD = d; best = { kind: 'enemy', enemy: e, weak: false }; }
      } else if (d <= rr + 8 && d < bestD) {
        bestD = d;
        best = { kind: 'enemy', enemy: e, weak: d < rr * 0.4 };
      }
    }
    for (var c = 0; c < civs.length; c++) {
      var cv = civs[c];
      if (cv.dead) continue;
      var cr = 12 * cv.scale;
      var cd = dist(x, y, cv.x, cv.y - 3 * cv.scale);
      if (cd <= cr + 5 && cd < bestD) { bestD = cd; best = { kind: 'civ', civ: cv }; }
    }
    if (boss && !boss.dead && !boss.entering) {
      var core = bossCorePos();
      var bd = dist(x, y, core.x, core.y);
      if (bd <= core.r + 7 && bd < bestD) { bestD = bd; best = { kind: 'boss', part: 'core' }; }
      else if (bd > core.r + 7 && dist(x, y, boss.x, boss.y) <= 72 && dist(x, y, boss.x, boss.y) < bestD) {
        bestD = dist(x, y, boss.x, boss.y); best = { kind: 'boss', part: 'body' };
      }
    }
    return best;
  }

  function shootAt(x, y) {
    if (state !== 'play') return false;
    if (state === 'paused') return false;
    if (reloading) {
      setMsg(T('gs.railshooter.reloading'), 'var(--neon-cyan)');
      return false;
    }
    if (fireCd > 0) return false;
    if (mag <= 0) {
      if (reserve > 0) { startReload(); return false; }
      setMsg(i18n('gs.railshooter.emptyAmmo', { n: Math.max(0, EMERGENCY_DELAY - emptyT).toFixed(1) }), 'var(--neon-pink)');
      return false;
    }

    fireCd = FIRE_INTERVAL;
    mag--; shots++;
    cursor.x = clamp(x, 2, W - 2); cursor.y = clamp(y, 2, H - 2);
    var ang = Math.atan2(cursor.y - player.y, cursor.x - player.x);
    muzzle = { x: player.x + Math.cos(ang) * 26, y: player.y - 12 + Math.sin(ang) * 26, ang: ang };
    muzzleT = 0.12;
    tracers.push({ x1: muzzle.x, y1: muzzle.y, x2: cursor.x, y2: cursor.y, t: 0, dur: 0.07 });
    if (Arcade.audio) Arcade.audio.play('type');

    for (var ci = 0; ci < civs.length; ci++) {
      if (dist(civs[ci].x, civs[ci].y, cursor.x, cursor.y) < 100) civs[ci].scared = true;
    }

    var target = pickTarget(cursor.x, cursor.y);
    if (target) {
      if (target.kind === 'civ') civilHit(target.civ, cursor.x, cursor.y);
      else if (target.kind === 'enemy') hitEnemy(target.enemy, target.weak, cursor.x, cursor.y);
      else if (target.kind === 'boss') hitBoss(target.part, cursor.x, cursor.y);
    } else {
      combo = 0;
      sparkBurst(cursor.x, cursor.y, '#7a89b8', 5, 90);
      floater(T('gs.railshooter.fxMiss'), cursor.x, cursor.y - 12, '#7a89b8', 11);
    }
    updateHud(true);
    return true;
  }

  function hitEnemy(e, weak, hx, hy) {
    var col = TYPE_COLOR[e.type] || '#ff2d95';
    if (e.type === 'shield' && !weak) {
      e.blockedT = 0.25;
      sparkBurst(hx, hy, '#b967ff', 6, 120);
      floater(T('gs.railshooter.fxBlocked'), hx, hy - 10, '#b967ff', 11);
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    hits++; combo++;
    if (combo > maxCombo) maxCombo = combo;
    var base = TYPE_BASE[e.type] || 10;
    var gain = base + Math.min(combo, 10) * 2 + (weak ? 12 : 0);
    score += gain;
    e.hp -= weak ? 2 : 1;
    e.hitT = 0.18;
    sparkBurst(hx, hy, col, weak ? 14 : 8, weak ? 260 : 170);
    if (weak) shockRing(hx, hy, '#ffe600', 34);
    floater('+' + gain + (weak ? ' ' + T('gs.railshooter.fxHead') : ''), hx, hy - 14, weak ? '#ffe600' : '#39ff14', weak ? 14 : 12);
    if (e.hp <= 0) {
      e.dead = true; kills++; waveKills++;
      score += 15;
      sparkBurst(e.x, e.y, col, 22, 300);
      shockRing(e.x, e.y, col, 46);
      if (Arcade.audio) Arcade.audio.play('clear');
      maybeDrop(e);
    } else if (Arcade.audio) {
      Arcade.audio.play('coin');
    }
    if (shake < 0.35) shake = 0.35;
  }

  function maybeDrop(e) {
    var lowAmmo = mag + reserve <= 18;
    var r = Math.random();
    if (lowAmmo && r < 0.5) spawnDrop('ammo', e.x, e.y);
    else if (r < 0.16) spawnDrop('ammo', e.x, e.y);
    else if (r < 0.28) spawnDrop(player.hp < 60 ? 'med' : 'armor', e.x, e.y);
    else if (r < 0.36) spawnDrop('armor', e.x, e.y);
  }

  function spawnDrop(kind, x, y) {
    drops.push({ kind: kind, x: clamp(x, 30, W - 30), y: clamp(y, 120, H - 60), vy: 34, age: 0, life: 16, bob: rnd(0, 6), r: 13 });
  }

  function collectDrop(d) {
    if (d.kind === 'ammo') {
      var add = Math.min(24, MAX_RESERVE - reserve);
      reserve += add;
      score += 5;
      floater(i18n('gs.railshooter.pickAmmo', { n: add }), player.x, player.y - 38, '#ffe600', 12);
    } else if (d.kind === 'med') {
      var heal = Math.min(35, player.maxHp - player.hp);
      player.hp += heal;
      floater(i18n('gs.railshooter.pickMed', { n: heal }), player.x, player.y - 38, '#39ff14', 12);
    } else {
      var sa = Math.min(35, player.maxArmor - player.armor);
      player.armor += sa;
      floater(i18n('gs.railshooter.pickArmor', { n: sa }), player.x, player.y - 38, '#00f0ff', 12);
    }
    d.dead = true;
    if (Arcade.audio) Arcade.audio.play('match');
    updateHud(true);
    if (Arcade.savegame) Arcade.savegame.write();
  }

  function civilHit(c, x, y) {
    c.dead = true;
    civHits++;
    combo = 0;
    score = Math.max(0, score - 60);
    redFlash = Math.max(redFlash, 1);
    shake = Math.max(shake, 0.9);
    sparkBurst(x, y, '#ff3b5c', 18, 260);
    floater(i18n('gs.railshooter.civFloater', { n: 60 }), x, y - 14, '#ff3b5c', 14);
    setMsg(T('gs.railshooter.civPenalty'), 'var(--neon-pink)');
    if (Arcade.audio) Arcade.audio.play('error');
    if (Arcade.fx) Arcade.fx.flash('rgba(255,40,70,0.55)');
    updateHud(true);
  }

  function damagePlayer(amount, srcX, srcY) {
    if (state !== 'play' || player.invuln > 0 || qaGod) return;
    amount = Math.max(1, Math.round(amount));
    var absorbed = Math.min(player.armor, amount);
    player.armor -= absorbed;
    var rest = amount - absorbed;
    player.hp = Math.max(0, player.hp - rest);
    player.invuln = 0.45;
    redFlash = Math.max(redFlash, 0.85);
    shake = Math.max(shake, 0.75);
    interruptReload();
    floater('-' + amount, player.x, player.y - 34, absorbed > 0 && rest === 0 ? '#00f0ff' : '#ff3b5c', 14);
    sparkBurst(player.x, player.y, '#ff3b5c', 12, 180);
    if (Arcade.audio) Arcade.audio.play('error');
    updateHud(true);
    if (player.hp <= 0) finish('defeat');
  }

  /* ---------------- Boss ---------------- */
  function bossCorePos() {
    if (!boss) return { x: W / 2, y: 190, r: 17 };
    var off = boss.phase === 2 ? Math.sin(boss.t * 1.9) * 28 : Math.sin(boss.t * 0.8) * 10;
    return { x: boss.x + off, y: boss.y + 6, r: 17 };
  }

  function createBoss() {
    boss = {
      x: W / 2, y: 118, hp: BOSS_HP, maxHp: BOSS_HP, phase: 1, t: 0,
      entering: true, enterT: 1.2, coreOpen: false, coreT: 1.1,
      fanT: 1.6, aimT: 1.0, spiralT: 0.4, dead: false, deathT: 0,
      phaseShift: 0, hurtT: 0, blockedT: 0, rot: 0
    };
    bossWarnT = 0;
    phaseBannerT = 0;
    setMsg(T('gs.railshooter.bossAppear'), 'var(--neon-pink)');
    if (Arcade.audio) Arcade.audio.play('record');
    shockRing(W / 2, 190, '#ff2d95', 160);
  }

  function bossBullet(ang, speed, color, dmg, r) {
    if (!boss) return;
    ebullets.push({
      x: boss.x, y: boss.y + 12,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      r: r || 5, dmg: dmg || 10, color: color || '#ff2d95', trail: []
    });
  }

  function bossFan() {
    var n = boss.phase === 2 ? 11 : 7;
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 2 - 0.75 + (i / (n - 1)) * 1.5;
      bossBullet(a, boss.phase === 2 ? 145 : 115, '#ff2d95', 10, 5);
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function bossAim() {
    var base = Math.atan2(player.y - boss.y, player.x - boss.x);
    var n = boss.phase === 2 ? 3 : 2;
    for (var i = 0; i < n; i++) {
      var off = (i - (n - 1) / 2) * 0.14;
      bossBullet(base + off, boss.phase === 2 ? 210 : 170, boss.phase === 2 ? '#ffe600' : '#ff5c74', 13, 5.5);
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function bossSpiral() {
    var a1 = boss.t * 2.6;
    bossBullet(a1, 150, '#ffe600', 11, 5);
    bossBullet(a1 + Math.PI, 150, '#ffe600', 11, 5);
  }

  function enterPhase2() {
    boss.phase = 2;
    boss.phaseShift = 1.15;
    boss.coreOpen = false;
    boss.coreT = 1.0;
    phaseBannerT = 2.2;
    shake = Math.max(shake, 1.2);
    whiteFlash = Math.max(whiteFlash, 0.55);
    shockRing(boss.x, boss.y, '#ffe600', 150);
    sparkBurst(boss.x, boss.y, '#ffe600', 30, 420);
    setMsg(T('gs.railshooter.bossPhase2'), 'var(--neon-yellow)');
    if (Arcade.audio) Arcade.audio.play('record');
    if (Arcade.savegame) Arcade.savegame.write();
  }

  function bossDefeated() {
    boss.dead = true;
    boss.deathT = 1.7;
    ebullets = [];
    kills++;
    score += 300;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    shake = Math.max(shake, 1.4);
    whiteFlash = 0.8;
    shockRing(boss.x, boss.y, '#ffe600', 200);
    sparkBurst(boss.x, boss.y, '#ffe600', 46, 520);
    sparkBurst(boss.x, boss.y, '#ff2d95', 30, 420);
    setMsg(T('gs.railshooter.bossDown'), 'var(--neon-green)');
    if (Arcade.audio) Arcade.audio.play('win');
    if (Arcade.fx) Arcade.fx.flash('rgba(255,230,0,0.4)');
    if (Arcade.savegame) Arcade.savegame.clear();
    updateHud(true);
  }

  function hitBoss(part, x, y) {
    if (!boss || boss.dead || boss.entering) return;
    if (part !== 'core') {
      boss.blockedT = 0.22;
      sparkBurst(x, y, '#b967ff', 6, 110);
      floater(T('gs.railshooter.fxBlocked'), x, y - 10, '#b967ff', 11);
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    if (!boss.coreOpen || boss.phaseShift > 0) {
      floater(T('gs.railshooter.fxShielded'), x, y - 12, '#00f0ff', 12);
      sparkBurst(x, y, '#00f0ff', 6, 100);
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    hits++; combo++;
    if (combo > maxCombo) maxCombo = combo;
    var gain = 24 + Math.min(combo, 10) * 2;
    score += gain;
    boss.hp -= BOSS_HIT;
    boss.hurtT = 0.16;
    sparkBurst(x, y, '#ffe600', 16, 300);
    shockRing(x, y, '#ffe600', 36);
    floater('+' + gain, x, y - 16, '#ffe600', 14);
    if (Arcade.audio) Arcade.audio.play('coin');
    if (shake < 0.55) shake = 0.55;
    if (boss.hp <= 0) {
      boss.hp = 0;
      bossDefeated();
    } else if (boss.phase === 1 && boss.hp <= Math.round(boss.maxHp * 0.55)) {
      enterPhase2();
    }
    updateHud(true);
  }

  function updateBoss(dt) {
    if (!boss) return;
    boss.t += dt;
    boss.rot += dt * 0.7;
    if (boss.hurtT > 0) boss.hurtT -= dt;
    if (boss.blockedT > 0) boss.blockedT -= dt;

    if (boss.entering) {
      boss.enterT -= dt;
      var k = clamp(1 - boss.enterT / 1.2, 0, 1);
      boss.y = GK.lerp(118, 205, GK.easeOutCubic(k));
      if (boss.enterT <= 0) {
        boss.entering = false;
        setMsg(T('gs.railshooter.bossFight'), 'var(--neon-pink)');
      }
      return;
    }

    if (boss.dead) {
      boss.deathT -= dt;
      if (boss.deathT <= 0) finish('win');
      return;
    }

    boss.x = W / 2 + Math.sin(boss.t * 0.7) * (boss.phase === 2 ? 74 : 46);
    boss.y = 205 + Math.sin(boss.t * 1.1) * 9;

    if (boss.phaseShift > 0) {
      boss.phaseShift -= dt;
      boss.coreOpen = false;
    } else {
      boss.coreT -= dt;
      if (boss.coreT <= 0) {
        boss.coreOpen = !boss.coreOpen;
        boss.coreT = boss.coreOpen ? (boss.phase === 2 ? 1.9 : 2.5) : (boss.phase === 2 ? 1.0 : 1.5);
        if (Arcade.audio) Arcade.audio.play('ui');
      }
    }

    boss.fanT -= dt;
    if (boss.fanT <= 0) { bossFan(); boss.fanT = boss.phase === 2 ? 1.7 : 2.6; }
    boss.aimT -= dt;
    if (boss.aimT <= 0) { bossAim(); boss.aimT = boss.phase === 2 ? 1.0 : 1.5; }
    if (boss.phase === 2) {
      boss.spiralT -= dt;
      if (boss.spiralT <= 0) { bossSpiral(); boss.spiralT = 0.4; }
    }
  }

  /* ---------------- 敌人 / 平民 / 波次 ---------------- */
  function enemyScale(e) {
    var k = clamp((e.y - HORIZON) / (H - HORIZON), 0, 1);
    return e.type === 'flyer' ? 0.68 + k * 0.36 : 0.52 + k * 0.58;
  }

  function spawnEnemy(type) {
    var e = {
      type: type, x: rnd(90, W - 90), y: HORIZON + rnd(0, 14),
      baseY: 0, age: 0, hp: TYPE_HP[type] || 1, r: 16, scale: 0.55,
      seed: Math.random() * 10, fireT: rnd(0.8, 1.6), hitT: 0, blockedT: 0,
      dead: false, speed: 42 + waveIndex * 7
    };
    if (type === 'flyer') {
      var dir = Math.random() < 0.5 ? -1 : 1;
      e.vx = dir * rnd(95, 135);
      e.x = dir > 0 ? -28 : W + 28;
      e.y = rnd(HORIZON + 20, 238);
      e.baseY = e.y;
      e.fireT = rnd(1.2, 2.2);
    } else if (type === 'shooter') {
      e.x = rnd(110, W - 110);
      e.stopY = rnd(244, 278);
      e.fireT = rnd(1.2, 1.9);
    } else if (type === 'shield') {
      e.x = rnd(120, W - 120);
      e.stopY = rnd(252, 286);
      e.speed = 30 + waveIndex * 4;
    }
    e.baseY = e.y;
    e.baseX = e.x;
    e.scale = enemyScale(e);
    enemies.push(e);
  }

  function spawnCiv() {
    var behavior = Math.random() < 0.56 ? 'cross' : 'panic';
    var dir = Math.random() < 0.5 ? -1 : 1;
    var c = {
      behavior: behavior, dir: dir, x: 0, y: 0, baseY: 0,
      speed: behavior === 'cross' ? rnd(38, 58) : rnd(72, 104),
      age: 0, seed: Math.random() * 6, scared: false, dead: false,
      life: rnd(3.6, 5.2), scale: 0.8
    };
    if (behavior === 'cross') {
      c.x = dir > 0 ? -24 : W + 24;
      c.y = rnd(252, 306);
    } else {
      c.x = rnd(90, W - 90);
      c.y = rnd(248, 302);
      c.dir = c.x < player.x ? 1 : -1;
    }
    c.baseY = c.y;
    civs.push(c);
  }

  function enemyShoot(e, dmg, color) {
    var ang = Math.atan2(player.y - e.y, player.x - e.x) + rnd(-0.09, 0.09);
    ebullets.push({
      x: e.x, y: e.y,
      vx: Math.cos(ang) * 165, vy: Math.sin(ang) * 165,
      r: 4.5, dmg: dmg, color: color || '#ff2d95', trail: []
    });
    if (Arcade.audio) Arcade.audio.play('drop');
  }

  function clearWave() {
    if (interT > 0 || waveIndex >= 5) return;
    interT = 4.2;
    waveBannerT = 0;
    for (var i = 0; i < enemies.length; i++) sparkBurst(enemies[i].x, enemies[i].y, '#5a6b9a', 5, 90);
    enemies = []; ebullets = [];
    spawnDrop('ammo', player.x - 92, 190);
    spawnDrop(player.hp < 70 ? 'med' : 'armor', player.x + 92, 190);
    setMsg(i18n('gs.railshooter.waveClear', { n: waveIndex + 1 }), 'var(--neon-green)');
    if (Arcade.audio) Arcade.audio.play('daily');
    if (Arcade.savegame) Arcade.savegame.write();
    updateHud(true);
  }

  /* ---------------- 主更新 ---------------- */
  function update() {
    if (state !== 'play') return;
    var dt = 0.016;
    runTime += dt;
    saveT += dt;
    if (saveT >= 8) { saveT = 0; if (Arcade.savegame) Arcade.savegame.write(); }

    if (shake > 0) shake = Math.max(0, shake - dt * 2.4);
    if (redFlash > 0) redFlash = Math.max(0, redFlash - dt * 1.7);
    if (whiteFlash > 0) whiteFlash = Math.max(0, whiteFlash - dt * 2.2);
    if (muzzleT > 0) muzzleT -= dt;
    if (fireCd > 0) fireCd -= dt;
    if (reloadBlockT > 0) reloadBlockT -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (waveBannerT > 0) waveBannerT -= dt;
    if (phaseBannerT > 0) phaseBannerT -= dt;

    if (reloading) {
      reloadT -= dt;
      if (reloadT <= 0) completeReload();
    }

    /* 移动 */
    var mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (mx && my) { mx *= 0.72; my *= 0.72; }
    player.x = clamp(player.x + mx * 245 * dt, PLAYER_MIN_X, PLAYER_MAX_X);
    player.y = clamp(player.y + my * 190 * dt, PLAYER_MIN_Y, PLAYER_MAX_Y);

    /* 按住连射 */
    if (firing && fireCd <= 0 && !reloading) shootAt(cursor.x, cursor.y);

    /* 弹药耗尽兜底：6 秒后自动空投，杜绝“无子弹也无法失败”的静默卡死 */
    if (mag === 0 && reserve === 0 && !reloading) {
      emptyT += dt;
      var left = EMERGENCY_DELAY - emptyT;
      var sec = Math.ceil(left);
      if (hud.emptySec !== sec) {
        hud.emptySec = sec;
        setMsg(i18n('gs.railshooter.emptyAmmo', { n: Math.max(0, left).toFixed(1) }), 'var(--neon-pink)');
      }
      if (emptyT >= EMERGENCY_DELAY) {
        emptyT = 0; hud.emptySec = 0;
        mag = MAG_SIZE;
        setMsg(T('gs.railshooter.emergencyAmmo'), 'var(--neon-green)');
        floater(T('gs.railshooter.emergencyAmmo'), player.x, player.y - 44, '#ffe600', 13);
        if (Arcade.audio) Arcade.audio.play('daily');
        updateHud(true);
      }
    } else {
      emptyT = 0;
      hud.emptySec = 0;
    }

    /* 波次推进 */
    if (interT > 0) {
      interT -= dt;
      if (interT <= 0) {
        if (waveIndex >= 4) beginWave(5);
        else beginWave(waveIndex + 1);
      }
    } else if (waveIndex >= 5) {
      if (bossWarnT > 0) {
        bossWarnT -= dt;
        if (bossWarnT <= 0) createBoss();
      } else if (boss) {
        updateBoss(dt);
      }
    } else {
      waveT += dt;
      var def = WAVES[waveIndex];
      var alive = 0;
      for (var a = 0; a < enemies.length; a++) if (!enemies[a].dead) alive++;
      spawnTimer -= dt;
      if (spawnTimer <= 0 && alive < def.max) {
        spawnEnemy(def.types[GK.randInt(0, def.types.length - 1)]);
        spawnTimer = def.spawn + rnd(-0.15, 0.2);
      }
      if (waveIndex >= 1) {
        civTimer -= dt;
        if (civTimer <= 0) {
          if (civs.length < 2) spawnCiv();
          civTimer = rnd(4.0, 6.5);
        }
      }
      if (waveT >= def.dur || waveKills >= def.kills) clearWave();
    }

    /* 敌人 */
    for (var ei = enemies.length - 1; ei >= 0; ei--) {
      var e = enemies[ei];
      if (e.dead) { enemies.splice(ei, 1); continue; }
      e.age += dt;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.blockedT > 0) e.blockedT -= dt;

      if (e.type === 'rusher') {
        var dx = player.x - e.x, dy = player.y - e.y;
        var dd = Math.hypot(dx, dy) || 1;
        e.x += dx / dd * e.speed * dt;
        e.y += dy / dd * e.speed * dt;
        if (dist(e.x, e.y, player.x, player.y) < player.r + 13 * e.scale) {
          damagePlayer(22, e.x, e.y);
          sparkBurst(e.x, e.y, '#ff3b5c', 16, 240);
          e.dead = true;
        }
      } else if (e.type === 'shooter') {
        if (e.y < e.stopY) e.y += 46 * dt;
        e.x = e.baseX + Math.sin(e.age * 1.15 + e.seed) * 22;
        e.fireT -= dt;
        if (e.fireT <= 0) {
          if (e.y > HORIZON + 40) enemyShoot(e, 12, '#ff2d95');
          e.fireT = rnd(1.5, 2.2);
        }
      } else if (e.type === 'flyer') {
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.age * 2 + e.seed) * 16;
        if (e.x < 34) { e.x = 34; e.vx = Math.abs(e.vx); }
        if (e.x > W - 34) { e.x = W - 34; e.vx = -Math.abs(e.vx); }
        e.fireT -= dt;
        if (e.fireT <= 0) {
          if (e.x > 50 && e.x < W - 50) enemyShoot(e, 10, '#ffe600');
          e.fireT = rnd(1.7, 2.6);
        }
      } else if (e.type === 'shield') {
        if (e.y < e.stopY) e.y += 38 * dt;
        e.x = e.baseX + Math.sin(e.age * 1.05 + e.seed) * 18;
      }
      e.scale = enemyScale(e);
    }

    /* 敌方子弹 */
    for (var bi = ebullets.length - 1; bi >= 0; bi--) {
      var b = ebullets[bi];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (!b.trail) b.trail = [];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 5) b.trail.shift();
      if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) { ebullets.splice(bi, 1); continue; }
      if (dist(b.x, b.y, player.x, player.y - 6) < player.r + b.r) {
        damagePlayer(b.dmg, b.x, b.y);
        ebullets.splice(bi, 1);
      }
    }

    /* 平民 */
    for (var ci = civs.length - 1; ci >= 0; ci--) {
      var c = civs[ci];
      if (c.dead) { civs.splice(ci, 1); continue; }
      c.age += dt;
      c.scale = 0.7 + clamp((c.y - HORIZON) / (H - HORIZON), 0, 1) * 0.5;
      var sp = c.speed * (c.scared ? 1.8 : 1);
      if (c.behavior === 'cross') {
        c.x += c.dir * sp * dt;
        c.y = c.baseY + Math.sin(c.age * 3 + c.seed) * 3;
        if (c.x < -42 || c.x > W + 42) c.dead = true;
      } else {
        c.x += c.dir * sp * dt;
        c.y = c.baseY + Math.sin(c.age * 5 + c.seed) * 9;
        c.life -= dt;
        if (c.life <= 0 || c.x < -42 || c.x > W + 42) c.dead = true;
      }
    }

    /* 补给 */
    for (var di = drops.length - 1; di >= 0; di--) {
      var d = drops[di];
      if (d.dead) { drops.splice(di, 1); continue; }
      d.age += dt; d.life -= dt;
      if (d.age > 0.45) {
        var ddx = player.x - d.x, ddy = (player.y - 12) - d.y;
        var ddist = Math.hypot(ddx, ddy) || 1;
        d.x += ddx / ddist * 100 * dt;
        d.y += ddy / ddist * 100 * dt;
      } else {
        d.y += d.vy * dt;
      }
      if (d.age > 0.45 && dist(d.x, d.y, player.x, player.y - 12) < 30) collectDrop(d);
      if (d.life <= 0) d.dead = true;
    }

    /* 粒子 / 光环 / 飘字 / 弹道 */
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var p = particles[pi];
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt * 1.5;
      if (p.life <= 0) particles.splice(pi, 1);
    }
    for (var ri = rings.length - 1; ri >= 0; ri--) {
      rings[ri].life -= dt * 2.2;
      if (rings[ri].life <= 0) rings.splice(ri, 1);
    }
    for (var fi = floaters.length - 1; fi >= 0; fi--) {
      floaters[fi].life -= dt * 1.25;
      floaters[fi].y -= dt * 30;
      if (floaters[fi].life <= 0) floaters.splice(fi, 1);
    }
    for (var ti = tracers.length - 1; ti >= 0; ti--) {
      tracers[ti].t += dt;
      if (tracers[ti].t >= tracers[ti].dur) tracers.splice(ti, 1);
    }

    updateHud(false);
  }

  /* ---------------- 绘制：场景 ---------------- */
  function drawBackground(time) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04060f');
    g.addColorStop(0.42, '#0a0f26');
    g.addColorStop(0.72, '#160b2c');
    g.addColorStop(1, '#0b0518');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* 星点（视差漂移） */
    for (var s = 0; s < 64; s++) {
      var sx = (s * 89 + time * (6 + (s % 5) * 2)) % W;
      var sy = (s * 37) % (HORIZON - 26);
      ctx.fillStyle = 'rgba(180,230,255,' + (0.18 + (s % 3) * 0.12) + ')';
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }

    /* 远处城市剪影 */
    ctx.save();
    for (var c = 0; c < 22; c++) {
      var bx = (c * 31 + 7) % W;
      var bw = 16 + (c % 5) * 7;
      var bh = 14 + ((c * 13) % 26);
      ctx.fillStyle = 'rgba(6,10,26,0.92)';
      ctx.fillRect(bx, HORIZON - bh, bw, bh);
      ctx.strokeStyle = 'rgba(0,240,255,0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, HORIZON - bh + 0.5, bw - 1, bh - 1);
      if (c % 3 === 0) {
        ctx.fillStyle = (Math.sin(time * 2 + c) > 0) ? 'rgba(255,230,0,0.5)' : 'rgba(255,45,149,0.35)';
        ctx.fillRect(bx + bw * 0.4, HORIZON - bh + 4, 2, 2);
      }
    }
    ctx.restore();

    /* 地平线辉光 */
    var hg = ctx.createLinearGradient(0, HORIZON - 44, 0, HORIZON + 30);
    hg.addColorStop(0, 'rgba(0,240,255,0)');
    hg.addColorStop(0.55, 'rgba(0,240,255,0.12)');
    hg.addColorStop(0.75, 'rgba(255,45,149,0.16)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, HORIZON - 44, W, 76);
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke();
    ctx.shadowBlur = 0;

    /* 地面 */
    var fg = ctx.createLinearGradient(0, HORIZON, 0, H);
    fg.addColorStop(0, 'rgba(18,10,42,0.85)');
    fg.addColorStop(1, 'rgba(4,4,12,0.96)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    /* 透视轨道 */
    ctx.save();
    var vx = W / 2;
    var lanes = [-150, -54, 54, 150];
    for (var l = 0; l < lanes.length; l++) {
      var x1 = vx + lanes[l] * 0.16, x2 = vx + lanes[l] * 2.2;
      ctx.strokeStyle = l === 1 || l === 2 ? 'rgba(0,240,255,0.34)' : 'rgba(255,45,149,0.32)';
      ctx.shadowColor = l === 1 || l === 2 ? '#00f0ff' : '#ff2d95';
      ctx.shadowBlur = 8;
      ctx.lineWidth = l === 1 || l === 2 ? 1.6 : 1.2;
      ctx.beginPath(); ctx.moveTo(x1, HORIZON); ctx.lineTo(x2, H); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    /* 移动的横向轨道格 */
    for (var k = 0; k < 9; k++) {
      var ph = (time * 0.42 + k / 9) % 1;
      var yy = HORIZON + ph * ph * (H - HORIZON);
      var span = (yy - HORIZON) / (H - HORIZON);
      var half = 30 + span * 280;
      var a = 0.05 + span * 0.22;
      ctx.strokeStyle = 'rgba(0,240,255,' + a.toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(vx - half, yy); ctx.lineTo(vx + half, yy); ctx.stroke();
    }
    /* 中心光带 */
    var cg = ctx.createLinearGradient(0, HORIZON, 0, H);
    cg.addColorStop(0, 'rgba(0,240,255,0.05)');
    cg.addColorStop(1, 'rgba(255,45,149,0.10)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(vx - 8, HORIZON); ctx.lineTo(vx + 8, HORIZON);
    ctx.lineTo(vx + 150, H); ctx.lineTo(vx - 150, H); ctx.closePath();
    ctx.fill();
    ctx.restore();

    /* 远处浮空平台 */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,45,149,0.25)';
    ctx.lineWidth = 1;
    for (var pl = 0; pl < 2; pl++) {
      var px = pl === 0 ? 96 : W - 96;
      var py = HORIZON - 26 + Math.sin(time * 0.8 + pl * 2) * 3;
      ctx.beginPath(); ctx.moveTo(px - 26, py); ctx.lineTo(px + 26, py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 16, py); ctx.lineTo(px - 24, py + 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + 16, py); ctx.lineTo(px + 24, py + 14); ctx.stroke();
    }
    ctx.restore();

    /* 扫描线 */
    ctx.fillStyle = 'rgba(0,240,255,0.028)';
    for (var ly = 0; ly < H; ly += 4) ctx.fillRect(0, ly, W, 1);
  }

  function drawPlayer(time) {
    var ang = Math.atan2(cursor.y - player.y, cursor.x - player.x);
    var flicker = player.invuln > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(time * 26)) : 1;
    ctx.save();
    ctx.globalAlpha = flicker;
    ctx.translate(player.x, player.y);

    /* 地面阴影 */
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 18, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* 推进器火焰 */
    var fl = 10 + Math.sin(time * 18) * 5;
    var tg = ctx.createLinearGradient(0, 8, 0, 8 + fl);
    tg.addColorStop(0, 'rgba(0,240,255,0.9)');
    tg.addColorStop(0.5, 'rgba(255,45,149,0.55)');
    tg.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-12, 8); ctx.lineTo(0, 8 + fl); ctx.lineTo(12, 8); ctx.closePath();
    ctx.fill();

    /* 悬浮环 */
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(0, 14, 26, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    /* 炮塔主体（六边形） */
    var r = 19;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3;
      var px = Math.cos(a) * r, py = Math.sin(a) * r * 0.82;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,18,34,0.92)';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* 护甲薄膜 */
    if (player.armor > 0) {
      ctx.strokeStyle = 'rgba(0,240,255,' + (0.35 + 0.25 * Math.sin(time * 5)) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke();
    }

    /* 炮管 */
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = '#0a1a2a';
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 10;
    GK.roundRect(ctx, 8, -4.5, 22, 9, 3);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,230,0,0.85)';
    ctx.fillRect(26, -2, 8, 4);
    ctx.restore();

    /* 座舱 */
    var core = ctx.createRadialGradient(-3, -4, 1, 0, 0, 12);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, '#8ff6ff');
    core.addColorStop(1, 'rgba(0,120,180,0.25)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(-2, -3, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();

    /* 枪口火焰 */
    if (muzzleT > 0 && state === 'play') {
      var ma = Math.max(0, muzzleT / 0.12);
      ctx.save();
      ctx.globalAlpha = ma;
      ctx.translate(muzzle.x, muzzle.y);
      ctx.rotate(muzzle.ang);
      ctx.strokeStyle = '#ffe600';
      ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      for (var m = 0; m < 6; m++) {
        var aa = m * Math.PI / 3 + (1 - ma) * 0.5;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(4 + Math.cos(aa) * (10 + (1 - ma) * 8), Math.sin(aa) * (10 + (1 - ma) * 8));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemy(e, time) {
    var col = TYPE_COLOR[e.type] || '#ff2d95';
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 13 * e.scale, 15 * e.scale, 4.5 * e.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(e.scale, e.scale);
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;

    if (e.type === 'rusher') {
      if (e.y > HORIZON + 90) {
        var pulse = 0.4 + 0.3 * Math.sin(time * 10);
        ctx.strokeStyle = 'rgba(255,59,92,' + pulse.toFixed(2) + ')';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
      }
      ctx.fillStyle = 'rgba(30,8,18,0.9)';
      ctx.beginPath();
      ctx.moveTo(0, 17); ctx.lineTo(-13, -13); ctx.lineTo(0, -5); ctx.lineTo(13, -13);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(0, 2, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,59,92,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-7, -13); ctx.lineTo(-11, -22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, -13); ctx.lineTo(11, -22); ctx.stroke();
    } else if (e.type === 'shooter') {
      ctx.fillStyle = 'rgba(34,6,28,0.92)';
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 3 * i + Math.PI / 6;
        var px = Math.cos(a) * 13, py = Math.sin(a) * 13;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      var aim = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.save();
      ctx.rotate(aim);
      ctx.fillStyle = 'rgba(20,4,16,0.95)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.6;
      GK.roundRect(ctx, 6, -3.5, 17, 7, 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(20, -1.5, 5, 3);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'flyer') {
      ctx.strokeStyle = 'rgba(255,230,0,0.45)';
      ctx.lineWidth = 1;
      for (var rt = 0; rt < 4; rt++) {
        var ra = time * 9 + rt * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(ra) * 16, -Math.sin(ra) * 8);
        ctx.lineTo(Math.cos(ra) * 16, Math.sin(ra) * 8);
        ctx.stroke();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.8;
      ctx.fillStyle = 'rgba(38,32,4,0.92)';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,0,0.8)';
      ctx.fillRect(-2, 12, 4, 2.5);
    } else if (e.type === 'shield') {
      ctx.fillStyle = 'rgba(24,8,36,0.92)';
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(12, -6); ctx.lineTo(12, 8);
      ctx.lineTo(0, 16); ctx.lineTo(-12, 8); ctx.lineTo(-12, -6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      /* 正面护盾（下半弧，朝向玩家） */
      var blocked = e.blockedT > 0;
      ctx.strokeStyle = blocked ? 'rgba(255,255,255,0.95)' : 'rgba(185,103,255,0.85)';
      ctx.fillStyle = blocked ? 'rgba(255,255,255,0.2)' : 'rgba(185,103,255,0.10)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 19, Math.PI * 0.14, Math.PI * 0.86);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(185,103,255,0.4)';
      ctx.lineWidth = 0.8;
      for (var sh = 1; sh <= 3; sh++) {
        var sy = -8 + sh * 7;
        var half = 19 * Math.sin(Math.acos(clamp(sy / 19, -1, 1))) * 0.92;
        ctx.beginPath(); ctx.moveTo(-half, sy); ctx.lineTo(half, sy); ctx.stroke();
      }
      /* 弱点核心 */
      var corePulse = 0.75 + 0.25 * Math.sin(time * 6);
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(0,240,255,' + corePulse.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(0, -8.7, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, -8.7, 6.5, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (e.hp > 1) {
      var hw = 24;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-hw / 2, -25); ctx.lineTo(hw / 2, -25); ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(-hw / 2, -25); ctx.lineTo(-hw / 2 + hw * (e.hp / (TYPE_HP[e.type] || 1)), -25); ctx.stroke();
    }

    if (e.hitT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (e.hitT / 0.18 * 0.55).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    }

    /* 开火预警 */
    if (e.fireT !== undefined && e.fireT > 0 && e.fireT < 0.45 && (e.type === 'shooter' || e.type === 'flyer')) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo((player.x - e.x) / e.scale, (player.y - e.y) / e.scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawCiv(c, time) {
    var walking = Math.sin(c.age * 8 + c.seed) * 3;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 11 * c.scale, 9 * c.scale, 3.5 * c.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 8;
    /* 腿 */
    ctx.strokeStyle = '#8fffd8';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-3 + walking, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, 2); ctx.lineTo(3 - walking, 12); ctx.stroke();
    /* 身体 */
    ctx.fillStyle = 'rgba(70,230,190,0.8)';
    ctx.strokeStyle = '#bffff0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-7, -6); ctx.lineTo(7, -6); ctx.lineTo(4.5, 4); ctx.lineTo(-4.5, 4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* 头 */
    ctx.fillStyle = '#e8fffa';
    ctx.beginPath(); ctx.arc(0, -12, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -12, 4.6, 0, Math.PI * 2); ctx.stroke();
    /* 手臂：惊慌时举起 */
    ctx.strokeStyle = '#8fffd8';
    ctx.lineWidth = 2.2;
    var raised = c.scared || c.behavior === 'panic' || c.behavior === 'flee';
    if (raised) {
      ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-11, -14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(11, -14); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-8, 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(8, 4); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(57,255,20,0.85)';
    ctx.font = 'bold 7px "Press Start 2P","Fusion Pixel",monospace';
    ctx.textAlign = 'center';
    ctx.fillText(T('gs.railshooter.civTag'), c.x, c.y - 25 * c.scale);
    ctx.restore();
  }

  function drawBoss(time) {
    if (!boss) return;
    var core = bossCorePos();
    var px = boss.x, py = boss.y;
    ctx.save();
    ctx.translate(px, py);

    var accent = boss.phase === 2 ? '#ff7a00' : '#ff2d95';
    var auraR = 66 + Math.sin(time * 3) * 4;
    var ag = ctx.createRadialGradient(0, 0, 10, 0, 0, auraR);
    ag.addColorStop(0, boss.phase === 2 ? 'rgba(255,122,0,0.20)' : 'rgba(255,45,149,0.16)');
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();

    /* 外圈旋转环 */
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.rotate(boss.rot);
    for (var i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 60 + i * 8, i * Math.PI, i * Math.PI + Math.PI * 0.72);
      ctx.stroke();
    }
    for (var t = 0; t < 8; t++) {
      var ta = t * Math.PI / 4 + boss.rot * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ta) * 52, Math.sin(ta) * 52);
      ctx.lineTo(Math.cos(ta) * 62, Math.sin(ta) * 62);
      ctx.stroke();
    }
    ctx.restore();

    /* 侧翼炮台 */
    ctx.fillStyle = 'rgba(24,6,30,0.95)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    for (var w = -1; w <= 1; w += 2) {
      ctx.beginPath();
      ctx.moveTo(w * 76, -16); ctx.lineTo(w * 58, -8);
      ctx.lineTo(w * 58, 16); ctx.lineTo(w * 76, 24);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(w * 72, 12, 3, 0, Math.PI * 2); ctx.fill();
    }

    /* 主体 */
    ctx.fillStyle = 'rgba(18,4,26,0.96)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -46); ctx.lineTo(38, -24); ctx.lineTo(44, 20);
    ctx.lineTo(22, 44); ctx.lineTo(-22, 44); ctx.lineTo(-44, 20);
    ctx.lineTo(-38, -24); ctx.closePath();
    ctx.fill(); ctx.stroke();

    /* 装甲纹路 */
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-34, -6); ctx.lineTo(34, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 18); ctx.lineTo(30, 18); ctx.stroke();

    /* 眼睛 */
    ctx.fillStyle = boss.phase === 2 ? '#ff9d00' : '#ff5c74';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    ctx.fillRect(-20, -34, 40, 5);
    ctx.beginPath(); ctx.arc(0, -12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    if (boss.hurtT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (boss.hurtT / 0.16 * 0.45).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    /* 弱点核心 */
    ctx.save();
    ctx.translate(core.x, core.y);
    var pulse = 0.8 + 0.2 * Math.sin(time * 8);
    if (boss.coreOpen) {
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 26;
      var og = ctx.createRadialGradient(0, 0, 1, 0, 0, core.r + 4);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.35, '#ffe600');
      og.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(0, 0, core.r + 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + pulse.toFixed(2) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, core.r + 3, 0, Math.PI * 2); ctx.stroke();
      /* 开窗倒计时环 */
      var openMax = boss.phase === 2 ? 1.9 : 2.5;
      var remain = clamp(boss.coreT / openMax, 0, 1);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, core.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain); ctx.stroke();
      ctx.fillStyle = 'rgba(255,230,0,0.9)';
      ctx.font = 'bold 8px "Press Start 2P","Fusion Pixel",monospace';
      ctx.textAlign = 'center';
      ctx.fillText(T('gs.railshooter.coreOpen'), 0, -core.r - 12);
    } else {
      ctx.strokeStyle = 'rgba(0,240,255,0.9)';
      ctx.fillStyle = 'rgba(0,240,255,0.14)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var h = 0; h < 6; h++) {
        var ha = h * Math.PI / 3 + Math.PI / 6;
        var hx = Math.cos(ha) * (core.r + 4), hy = Math.sin(ha) * (core.r + 4);
        if (h === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawDrop(d, time) {
    var col = d.kind === 'ammo' ? '#ffe600' : (d.kind === 'med' ? '#39ff14' : '#00f0ff');
    ctx.save();
    ctx.translate(d.x, d.y + Math.sin(time * 3 + d.bob) * 2.5);
    ctx.rotate(Math.sin(time * 1.4 + d.bob) * 0.18);
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(8,14,26,0.92)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    GK.roundRect(ctx, -12, -12, 24, 24, 4);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    if (d.kind === 'ammo') {
      for (var i = -1; i <= 1; i++) ctx.fillRect(i * 5 - 1.5, -7, 3, 14);
    } else if (d.kind === 'med') {
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-8, -2, 16, 4);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(8, -4); ctx.lineTo(8, 3); ctx.lineTo(0, 9);
      ctx.lineTo(-8, 3); ctx.lineTo(-8, -4); ctx.closePath();
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBullets() {
    for (var i = 0; i < ebullets.length; i++) {
      var b = ebullets[i];
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      if (b.trail && b.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (var t = 1; t < b.trail.length; t++) ctx.lineTo(b.trail[t].x, b.trail[t].y);
        ctx.stroke();
      }
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (var tr = 0; tr < tracers.length; tr++) {
      var tc = tracers[tr];
      var a = 1 - tc.t / tc.dur;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(tc.x1, tc.y1); ctx.lineTo(tc.x2, tc.y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(tc.x1, tc.y1); ctx.lineTo(tc.x2, tc.y2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawEffects() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r];
      var rr = 8 + (ring.maxR - 8) * (1 - ring.life);
      ctx.save();
      ctx.globalAlpha = Math.max(0, ring.life) * 0.8;
      ctx.strokeStyle = ring.color;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      ctx.save();
      ctx.globalAlpha = Math.min(1, fl.life * 1.6);
      ctx.fillStyle = fl.color;
      ctx.font = 'bold ' + fl.size + 'px "Press Start 2P","Fusion Pixel",monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.restore();
    }
  }

  function drawAmmoPanel(time) {
    var startX = W / 2 - (MAG_SIZE * 12) / 2;
    var y = H - 26;
    ctx.save();
    ctx.fillStyle = 'rgba(4,8,18,0.55)';
    GK.roundRect(ctx, startX - 10, y - 10, MAG_SIZE * 12 + 74, 24, 5);
    ctx.fill();
    for (var i = 0; i < MAG_SIZE; i++) {
      var filled = i < mag;
      ctx.fillStyle = filled ? (mag <= 3 ? 'rgba(255,59,92,0.95)' : 'rgba(255,230,0,0.9)') : 'rgba(255,255,255,0.10)';
      GK.roundRect(ctx, startX + i * 12, y - 6, 9, 15, 2);
      ctx.fill();
    }
    ctx.fillStyle = mag === 0 ? '#ff3b5c' : '#ffe600';
    ctx.font = 'bold 9px "Press Start 2P","Fusion Pixel",monospace';
    ctx.textAlign = 'left';
    ctx.fillText(mag + ' / ' + reserve, startX + MAG_SIZE * 12 + 6, y + 5);
    if (reloading) {
      var p = clamp(1 - reloadT / reloadDur, 0, 1);
      ctx.fillStyle = 'rgba(255,230,0,0.22)';
      GK.roundRect(ctx, startX, y + 11, MAG_SIZE * 12, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#ffe600';
      GK.roundRect(ctx, startX, y + 11, MAG_SIZE * 12 * p, 3, 1.5); ctx.fill();
    }
    ctx.restore();
  }

  function drawBanners(time) {
    if (waveBannerT > 0 && waveIndex < 5) {
      var wa = Math.min(1, waveBannerT / 0.6) * Math.min(1, (2.2 - waveBannerT) / 0.4 + 0.2);
      ctx.save();
      ctx.globalAlpha = clamp(wa, 0, 1);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 16px "Press Start 2P","Fusion Pixel",monospace';
      ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 16;
      ctx.fillText('WAVE ' + (waveIndex + 1) + ' / 6', W / 2, 74);
      ctx.fillStyle = 'rgba(0,240,255,0.95)';
      ctx.font = 'bold 10px "Fusion Pixel","Press Start 2P",monospace';
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 10;
      ctx.fillText(T('gs.railshooter.' + WAVES[waveIndex].key), W / 2, 94);
      ctx.restore();
    }

    if (bossWarnT > 0) {
      var bl = 0.55 + 0.45 * Math.abs(Math.sin(time * 9));
      ctx.save();
      ctx.fillStyle = 'rgba(255,20,60,' + (0.10 * bl).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = bl;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff3b5c';
      ctx.shadowColor = '#ff3b5c'; ctx.shadowBlur = 24;
      ctx.font = 'bold 26px "Press Start 2P","Fusion Pixel",monospace';
      ctx.fillText('WARNING', W / 2, 168);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 10px "Fusion Pixel","Press Start 2P",monospace';
      ctx.fillText(T('gs.railshooter.bossWarn'), W / 2, 196);
      ctx.restore();
    }

    if (phaseBannerT > 0 && boss) {
      var pa = Math.min(1, phaseBannerT / 0.5);
      ctx.save();
      ctx.globalAlpha = pa;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 26;
      ctx.font = 'bold 24px "Press Start 2P","Fusion Pixel",monospace';
      ctx.fillText('PHASE 2', W / 2, 46);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 10px "Fusion Pixel","Press Start 2P",monospace';
      ctx.shadowBlur = 8;
      ctx.fillText(T('gs.railshooter.bossPhase2'), W / 2, 64);
      ctx.restore();
    }
  }

  function drawFrame() {
    ctx.save();
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0,240,255,0.35)';
    ctx.lineWidth = 1;
    var m = 8, len = 18;
    ctx.beginPath();
    ctx.moveTo(m, m + len); ctx.lineTo(m, m); ctx.lineTo(m + len, m);
    ctx.moveTo(W - m - len, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + len);
    ctx.moveTo(m, H - m - len); ctx.lineTo(m, H - m); ctx.lineTo(m + len, H - m);
    ctx.moveTo(W - m - len, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - len);
    ctx.stroke();
    ctx.restore();
  }

  function draw(ts) {
    if (!ts) ts = (typeof performance !== 'undefined' ? performance.now() : 0);
    var dt = lastFrame ? Math.min(0.05, (ts - lastFrame) / 1000) : 0.016;
    lastFrame = ts;
    var time = ts / 1000;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 7, rnd(-1, 1) * shake * 5);

    drawBackground(time);

    if (state !== 'menu') {
      if (boss) drawBoss(time);

      var actors = enemies.concat(civs);
      actors.sort(function (a, b) { return a.y - b.y; });
      for (var i = 0; i < actors.length; i++) {
        var a = actors[i];
        if (a.dead) continue;
        if (a.behavior) drawCiv(a, time); else drawEnemy(a, time);
      }
      for (var d = 0; d < drops.length; d++) drawDrop(drops[d], time);

      drawBullets();
      drawPlayer(time);
      drawEffects();
      drawCrosshair(time);
      drawAmmoPanel(time);
      drawBanners(time);
    }
    ctx.restore();

    if (whiteFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (whiteFlash * 0.55).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (redFlash > 0) {
      ctx.fillStyle = 'rgba(255,24,64,' + (redFlash * 0.30).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'play' && player.hp <= 30 && player.hp > 0) {
      var danger = 0.10 + 0.06 * Math.sin(time * 4);
      ctx.fillStyle = 'rgba(255,20,60,' + danger.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    drawFrame();
  }

  /* ---------------- 存档 ---------------- */
  var SAVE_KEY = 'arcade_save_railshooter';

  function collectSave() {
    if (state !== 'play' && state !== 'paused') return null;
    return {
      v: 1,
      w: waveIndex + 1,
      wk: waveKills,
      t: Math.round(runTime * 10) / 10,
      hp: Math.max(1, Math.round(player.hp)),
      ar: Math.round(player.armor),
      mag: mag,
      res: reserve,
      sc: score,
      sh: shots,
      hi: hits,
      co: combo,
      mc: maxCombo,
      ch: civHits,
      ki: kills,
      boss: (boss && !boss.dead) ? { hp: Math.round(boss.hp), ph: boss.phase, open: !!boss.coreOpen } : null
    };
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    var w = Math.round(Number(s.w));
    if (!isFinite(w) || w < 1 || w > 6) return false;
    var h = Math.round(Number(s.hp));
    if (!isFinite(h) || h <= 0 || h > 100) return false;

    resetRun();
    score = Math.max(0, Math.round(Number(s.sc) || 0));
    shots = Math.max(0, Math.round(Number(s.sh) || 0));
    hits = Math.min(shots, Math.max(0, Math.round(Number(s.hi) || 0)));
    combo = Math.max(0, Math.round(Number(s.co) || 0));
    maxCombo = Math.max(combo, Math.round(Number(s.mc) || 0));
    civHits = Math.max(0, Math.round(Number(s.ch) || 0));
    kills = Math.max(0, Math.round(Number(s.ki) || 0));
    runTime = Math.max(0, Number(s.t) || 0);
    player.hp = clamp(h, 1, player.maxHp);
    player.armor = clamp(Math.round(Number(s.ar) || 0), 0, player.maxArmor);
    mag = clamp(Math.round(Number(s.mag) || 0), 0, MAG_SIZE);
    reserve = clamp(Math.round(Number(s.res) || 0), 0, MAX_RESERVE);

    state = 'play';
    showPlay();
    beginWave(w - 1);
    waveKills = Math.max(0, Math.round(Number(s.wk) || 0));
    waveT = 0;
    if (w === 6) {
      if (s.boss && Number(s.boss.hp) > 0) {
        bossWarnT = 0;
        createBoss();
        boss.entering = false;
        boss.y = 205;
        boss.hp = clamp(Math.round(Number(s.boss.hp)), 1, BOSS_HP);
        boss.phase = Number(s.boss.ph) === 2 ? 2 : 1;
        boss.coreOpen = !!s.boss.open;
      }
    }
    setMsg(T('gs.railshooter.help'), '');
    updateHud(true);
    return true;
  }

  function refreshContinue() {
    var ok = false, n = 1;
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        var w = Math.round(Number(s && s.w));
        if (s && isFinite(w) && w >= 1 && w <= 6 && isFinite(Number(s.hp)) && Number(s.hp) > 0) {
          ok = true; n = w;
        }
      }
    } catch (err) { ok = false; }
    contBtn.classList.toggle('rs-hide', !ok);
    if (ok) contBtn.textContent = i18n('gs.railshooter.continueBtn', { n: n });
  }

  /* ---------------- 输入 ---------------- */
  function stopFiring() { firing = false; }

  function bindHold(btn, key) {
    if (!btn) return;
    function down(e) {
      e.preventDefault();
      if (state !== 'play') return;
      keys[key] = true;
      btn.classList.add('is-down');
    }
    function up(e) {
      if (e) e.preventDefault();
      keys[key] = false;
      btn.classList.remove('is-down');
    }
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* R 键在捕获阶段截获，避免触发全局「R 重开」 */
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyR' && e.key !== 'r' && e.key !== 'R') return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (state === 'play') {
      e.preventDefault();
      e.stopPropagation();
      startReload();
    } else if (state === 'paused') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space') {
      if (state === 'play') { e.preventDefault(); shootAt(cursor.x, cursor.y); }
      return;
    }
    if (e.code === 'Enter') {
      if (state === 'menu' || state === 'over') { e.preventDefault(); startRun(); }
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'play' || state === 'paused') { e.preventDefault(); togglePause(); }
      return;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') { keys.right = true; e.preventDefault(); }
    else if (e.code === 'KeyW' || e.code === 'ArrowUp') { keys.up = true; e.preventDefault(); }
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') { keys.down = true; e.preventDefault(); }
    else if (e.code === 'KeyR') { e.preventDefault(); }
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    else if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
  });

  canvas.addEventListener('pointerdown', function (e) {
    if (state !== 'play') return;
    e.preventDefault();
    var p = GK.pointer(canvas, e);
    cursor.x = clamp(p.x, 2, W - 2);
    cursor.y = clamp(p.y, 2, H - 2);
    firing = true;
    shootAt(cursor.x, cursor.y);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }, { passive: false });

  canvas.addEventListener('pointermove', function (e) {
    if (state !== 'play') return;
    var p = GK.pointer(canvas, e);
    cursor.x = clamp(p.x, 2, W - 2);
    cursor.y = clamp(p.y, 2, H - 2);
  });

  canvas.addEventListener('pointerup', stopFiring);
  canvas.addEventListener('pointercancel', stopFiring);
  window.addEventListener('pointerup', stopFiring);
  window.addEventListener('blur', function () { stopFiring(); keys.left = keys.right = keys.up = keys.down = false; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'play') togglePause();
  });

  bindHold(leftBtn, 'left');
  bindHold(rightBtn, 'right');

  startBtn.addEventListener('click', function () { startRun(); });
  contBtn.addEventListener('click', function () {
    if (!Arcade.savegame || !Arcade.savegame.resume()) {
      refreshContinue();
      setMsg(T('gs.railshooter.saveInvalid'), 'var(--neon-pink)');
    }
  });
  againBtn.addEventListener('click', function () { startRun(); });
  backBtn.addEventListener('click', function () { backToMenu(); });
  pauseTopBtn.addEventListener('click', function () { togglePause(); });
  restartBtn.addEventListener('click', function () { startRun(); });
  pauseRestartBtn.addEventListener('click', function () { startRun(); });
  resumeBtn.addEventListener('click', function () { togglePause(); });
  quitMenuBtn.addEventListener('click', function () { backToMenu(); });
  reloadBtn.addEventListener('click', function () { startReload(); });
  reloadBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------------- 初始化 ---------------- */
  if (Arcade.savegame) {
    Arcade.savegame.setup({ id: 'railshooter', collect: collectSave, apply: applySave });
  }
  refreshBest();
  refreshContinue();
  updateHud(true);
  syncRunControls();
  setMsg(T('gs.railshooter.help'), '');
  draw();

  Arcade.loop.start(function () { update(); }, function () { draw(); }, 16);

  /* ---------------- 仅 ?qa=1 暴露的测试钩子 ---------------- */
  if (/(?:^|[?&])qa=1(?:[&]|$)/.test(location.search)) {
    window.__QA = {
      start: function () { startRun(); return true; },
      state: function () {
        return {
          state: state, wave: waveIndex + 1, hp: Math.round(player.hp), armor: Math.round(player.armor),
          mag: mag, reserve: reserve, reloading: reloading, reloadT: Math.round(reloadT * 100) / 100,
          score: score, shots: shots, hits: hits, civHits: civHits, combo: combo,
          enemies: enemies.length, civs: civs.length, interT: Math.round(interT * 100) / 100,
          civModes: civs.map(function (c) { return c.behavior; }),
          drops: drops.map(function (d) { return d.kind; }),
          boss: boss ? {
            hp: Math.round(boss.hp), maxHp: boss.maxHp, phase: boss.phase,
            coreOpen: boss.coreOpen, entering: boss.entering, dead: boss.dead
          } : null
        };
      },
      setAmmo: function (m, r) {
        mag = clamp(Math.round(Number(m) || 0), 0, MAG_SIZE);
        reserve = clamp(Math.round(Number(r) || 0), 0, MAX_RESERVE);
        updateHud(true); return { mag: mag, reserve: reserve };
      },
      setHealth: function (v) {
        player.hp = clamp(Number(v) || 0, 0, player.maxHp);
        if (player.hp <= 0) finish('defeat');
        updateHud(true); return player.hp;
      },
      setArmor: function (v) { player.armor = clamp(Number(v) || 0, 0, player.maxArmor); updateHud(true); },
      damage: function (n) { player.invuln = 0; damagePlayer(n || 30); return player.hp; },
      reload: function () { return startReload(); },
      fire: function (x, y) { return shootAt(Number(x), Number(y)); },
      fireAtBossCore: function () { if (!boss) return false; var c = bossCorePos(); return shootAt(c.x, c.y); },
      bossCore: function () { if (!boss) return null; return bossCorePos(); },
      skipToBoss: function () {
        if (state !== 'play') startRun();
        clearWorld(); bossWarnT = 2.6; interT = 0; waveBannerT = 0;
        waveIndex = 5; waveT = 0; waveKills = 0; enemies = []; ebullets = [];
        setMsg(T('gs.railshooter.bossWarn'), 'var(--neon-pink)');
        updateHud(true);
        if (Arcade.savegame) Arcade.savegame.write();
        return true;
      },
      openBossCore: function () {
        if (!boss) return false;
        boss.phaseShift = 0; boss.coreOpen = true; boss.coreT = 99;
        return true;
      },
      setBossHp: function (v) { if (!boss) return false; boss.hp = Math.max(1, Math.round(Number(v) || 1)); return boss.hp; },
      god: function (on) { qaGod = !!on; return qaGod; },
      save: function () { if (Arcade.savegame) Arcade.savegame.write(); return true; },
      spawnDrop: function (kind) {
        spawnDrop(kind || 'ammo', player.x, player.y - 6);
        return true;
      },
      clearWave: function () { clearWave(); return { interT: interT, drops: drops.length }; },
      spawnCiv: function (behavior) {
        if (state !== 'play') startRun();
        spawnCiv();
        var c = civs[civs.length - 1];
        if (behavior) c.behavior = behavior;
        c.x = W / 2; c.y = 282; c.baseY = 282; c.scale = 1;
        return { x: c.x, y: c.y };
      },
      shootCivilian: function () {
        if (state !== 'play') startRun();
        spawnCiv('cross');
        var c = civs[civs.length - 1];
        c.x = W / 2; c.y = 282; c.baseY = 282; c.scale = 1;
        return shootAt(c.x, c.y - 3);
      },
      spawnEnemy: function (type) {
        if (state !== 'play') startRun();
        spawnEnemy(type || 'shooter');
        var e = enemies[enemies.length - 1];
        e.x = W / 2; e.baseX = W / 2; e.y = 300; e.baseY = 300; e.scale = enemyScale(e);
        return { x: e.x, y: e.y, type: e.type };
      },
      tick: function (sec) {
        var steps = Math.max(1, Math.round((Number(sec) || 1) / 0.016));
        for (var i = 0; i < steps; i++) { update(); }
        draw();
        return true;
      }
    };
  }

  function drawCrosshair(time) {
    var x = cursor.x, y = cursor.y;
    var target = pickTarget(x, y);
    var col = '#00f0ff';
    if (target) {
      if (target.kind === 'civ') col = '#39ff14';
      else if (target.kind === 'boss') col = '#ffe600';
      else if (target.enemy && target.enemy.type === 'shield' && !target.weak) col = '#b967ff';
      else col = '#ff5c74';
    }
    ctx.save();
    ctx.strokeStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.lineWidth = 1.6;
    var rr = 15 + Math.sin(time * 4) * 1.5;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x - 10, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 26, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x, y - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y + 26); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();

    if (target && target.kind === 'civ') {
      ctx.strokeStyle = 'rgba(57,255,20,0.8)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(x, y, 23, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 9px "Fusion Pixel","Press Start 2P",monospace';
      ctx.textAlign = 'center';
      ctx.fillText(T('gs.railshooter.civLabel'), x, y + 34);
    }
    ctx.restore();

    if (reloading) {
      var p = clamp(1 - reloadT / reloadDur, 0, 1);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,230,0,0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffe600';
      ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 9px "Press Start 2P","Fusion Pixel",monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RELOADING', x, y + 42);
      ctx.restore();
    }
  }
})();



