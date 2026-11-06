/* ============================================================
   像素飞鸟 Pixel Bird —— 旗舰版
   · 护盾 / 磁铁 / 慢速 三种道具（持续时间 + 粒子反馈）
   · 每局 3 个轮换任务 + 每日挑战
   · 巡逻无人机 / 追踪鸟 / 投弹机 三种敌人（预警 + 护盾抵挡）
   · 开局菜单 → 游玩 → 撞毁或 20 管通关 → 结算 → 再来
   · 多层视差城市 / 云层 / 昼夜渐变 / 像素自绘
   ============================================================ */
(function () {
  'use strict';
  var root = document.getElementById('game-root');

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.pixelbird.tut1t'), d: T('gs.pixelbird.tut1') },
    { t: T('gs.pixelbird.tut2t'), d: T('gs.pixelbird.tut2') },
    { t: T('gs.pixelbird.tut3t'), d: T('gs.pixelbird.tut3') },
    { t: T('gs.pixelbird.tut4t'), d: T('gs.pixelbird.tut4') }
  ];

  var W = 400, H = 500, GROUND = 438;
  var BIRD_X = 108, BIRD_R = 11, PIPE_W = 62, GOAL = 20;
  var SAVE_ID = 'pixelbird';
  var ARC = window.Arcade;

  root.innerHTML = [
    '<div class="pb-wrap">',
    '  <div class="pb-stage" id="pb-stage">',
    '    <canvas class="pb-canvas" id="pb-canvas" aria-label="Pixel Bird"></canvas>',
    '    <button class="pb-pause" id="pb-pause" aria-label="Pause">II</button>',
    '    <div class="pb-overlay" id="pb-menu">',
    '      <div class="pb-title">PIXEL BIRD</div>',
    '      <div class="pb-sub" id="pb-menu-sub"></div>',
    '      <div class="pb-bestline" id="pb-bestline"></div>',
    '      <div class="pb-daily" id="pb-daily"></div>',
    '      <div class="pb-missions" id="pb-menu-missions"></div>',
    '      <div class="pb-btns">',
    '        <button class="btn green" id="pb-start">' + T('gs.pixelbird.start') + '</button>',
    '        <button class="btn yellow" id="pb-continue" hidden>' + T('gs.pixelbird.continue') + '</button>',
    '      </div>',
    '      <div class="pb-how">' + T('gs.pixelbird.how') + '</div>',
    '    </div>',
    '    <div class="pb-overlay" id="pb-result" hidden>',
    '      <div class="pb-title" id="pb-res-title"></div>',
    '      <div class="pb-scorebig"><span>' + T('gs.pixelbird.score') + '</span><b id="pb-res-score">0</b></div>',
    '      <div class="pb-res-line" id="pb-res-line"></div>',
    '      <div class="pb-medal" id="pb-res-medal"></div>',
    '      <div class="pb-missions" id="pb-res-missions"></div>',
    '      <div class="pb-btns">',
    '        <button class="btn green" id="pb-again">' + T('gs.pixelbird.again') + '</button>',
    '        <button class="btn purple" id="pb-menu-btn">' + T('gs.pixelbird.menu') + '</button>',
    '      </div>',
    '    </div>',
    '    <div class="pb-pause-veil" id="pb-pause-veil" hidden>',
    '      <div class="pb-title">' + T('gs.pixelbird.paused') + '</div>',
    '      <div class="pb-how">' + T('gs.pixelbird.pauseHint') + '</div>',
    '      <button class="btn green" id="pb-resume">' + T('gs.pixelbird.resume') + '</button>',
    '    </div>',
    '  </div>',
    '  <div class="pb-firehud" id="pb-firehud" hidden>',
    '    <span class="pb-ammo" id="pb-ammo" aria-hidden="true"><i></i><i></i><i></i></span>',
    '    <button class="pb-fire" id="pb-fire" type="button">' + T('gs.pixelbird.fireBtn') + ' ×2</button>',
    '  </div>',
    '  <div class="pb-taskbar" id="pb-taskbar"></div>',
    '  <div class="pb-help">' + T('gs.pixelbird.helpText') + '</div>',
    '</div>'
  ].join('');

  var canvas = document.getElementById('pb-canvas');
  var info = GK.setup(canvas, W, H);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = info.ctx;

  var els = {
    stage: document.getElementById('pb-stage'),
    menu: document.getElementById('pb-menu'),
    result: document.getElementById('pb-result'),
    veil: document.getElementById('pb-pause-veil'),
    pause: document.getElementById('pb-pause'),
    start: document.getElementById('pb-start'),
    cont: document.getElementById('pb-continue'),
    again: document.getElementById('pb-again'),
    menuBtn: document.getElementById('pb-menu-btn'),
    resume: document.getElementById('pb-resume'),
    resTitle: document.getElementById('pb-res-title'),
    resScore: document.getElementById('pb-res-score'),
    resLine: document.getElementById('pb-res-line'),
    resMedal: document.getElementById('pb-res-medal'),
    resMissions: document.getElementById('pb-res-missions'),
    menuSub: document.getElementById('pb-menu-sub'),
    bestline: document.getElementById('pb-bestline'),
    daily: document.getElementById('pb-daily'),
    menuMissions: document.getElementById('pb-menu-missions'),
    taskbar: document.getElementById('pb-taskbar'),
    fire: document.getElementById('pb-fire'),
    fireHud: document.getElementById('pb-firehud'),
    ammo: document.getElementById('pb-ammo')
  };

  /* ---------------- 常量/工具 ---------------- */
  var PALETTES = [
    { top: '#111a3a', bot: '#3d2a66', sun: '#ffd36e', star: 0.9, name: 'night' },
    { top: '#243b6b', bot: '#f2a65a', sun: '#ffe9a8', star: 0.25, name: 'dawn' },
    { top: '#2b78c4', bot: '#a6e3ff', sun: '#fff3b0', star: 0.0, name: 'day' },
    { top: '#3b2a6e', bot: '#ff7a6b', sun: '#ffd2a1', star: 0.45, name: 'dusk' }
  ];
  var MISSION_POOL = [
    { type: 'pipes', zhKey: 'mPipes', enKey: 'mPipes' },
    { type: 'coins', zhKey: 'mCoins', enKey: 'mCoins' },
    { type: 'survive', zhKey: 'mSurvive', enKey: 'mSurvive' },
    { type: 'dodge', zhKey: 'mDodge', enKey: 'mDodge' },
    { type: 'pickups', zhKey: 'mPickups', enKey: 'mPickups' }
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function hexMix(c1, c2, t) {
    function rgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
    var a = rgb(c1), b = rgb(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  function fmt(n) { return String(Math.floor(n)); }
  function hide(el) { if (el) el.hidden = true; }
  function show(el) { if (el) el.hidden = false; }

  /* ---------------- 状态 ---------------- */
  var state = 'menu';         /* menu | play | dying | clear | over */
  var paused = false;
  var run = null;
  var best = ARC.storage.getBest('pixelbird') || 0;
  var menuT = 0;
  var lastDraw = 0;
  var runIndex = 0;
  try { runIndex = parseInt(localStorage.getItem('arcade_pb_runs') || '0', 10) || 0; } catch (e) { runIndex = 0; }
  var previewMissions = [];
  var resumeSnap = null;
  var cloudFar = [], cloudNear = [], cityFar = [], cityNear = [], menuStars = [];
  var scrollBg = 0;
  var taskTimer = 0;

  for (var i = 0; i < 26; i++) menuStars.push({ x: (i * 89 + 13) % W, y: (i * 47 + 9) % 260, s: 1 + (i % 3 === 0) });
  for (var c = 0; c < 8; c++) cloudFar.push({ x: c * 70 + rand(0, 40), y: 66 + rand(0, 110), s: rand(0.7, 1.3), w: rand(22, 46) });
  for (var c2 = 0; c2 < 6; c2++) cloudNear.push({ x: c2 * 100 + rand(0, 50), y: 150 + rand(0, 120), s: rand(1.1, 1.9), w: rand(26, 50) });
  for (var b = 0; b < 12; b++) cityFar.push({ x: b * 48, w: 28 + (b % 4) * 10, h: 40 + (b * 53) % 100, win: (b * 7) % 5 });
  for (var b2 = 0; b2 < 10; b2++) cityNear.push({ x: b2 * 54, w: 34 + (b2 % 3) * 12, h: 78 + (b2 * 41) % 120, win: (b2 * 3) % 4 });

  function dayPhase() {
    var t = run && state !== 'menu' ? run.time : menuT;
    return (0.25 + t / 55) % 4;
  }

  function makeMissions(seedIndex) {
    var out = [];
    for (var i = 0; i < 3; i++) {
      var item = MISSION_POOL[(seedIndex * 2 + i * 3) % MISSION_POOL.length];
      var target;
      if (item.type === 'pipes') target = 8 + (seedIndex % 4) * 2;
      else if (item.type === 'coins') target = 10 + (seedIndex % 3) * 3;
      else if (item.type === 'survive') target = 20 + (seedIndex % 4) * 5;
      else if (item.type === 'dodge') target = 3 + (seedIndex % 3);
      else target = 2;
      out.push({ type: item.type, target: target, done: false });
    }
    return out;
  }

  function dailyMission() {
    var day = ARC.daily.dayStr();
    var h = hashStr(day + 'pixelbird');
    var kind = h % 3;
    var target = kind === 0 ? 22 + h % 8 : kind === 1 ? 18 + h % 7 : 13 + h % 5;
    return {
      day: day, type: kind === 0 ? 'score' : kind === 1 ? 'coins' : 'pipes',
      target: target, done: false, claimed: false
    };
  }

  function missionLabel(m) {
    var key = m.type === 'pipes' ? 'mPipes' : m.type === 'coins' ? 'mCoins' :
      m.type === 'survive' ? 'mSurvive' : m.type === 'dodge' ? 'mDodge' : 'mPickups';
    return T('gs.pixelbird.' + key).replace('{n}', String(m.target));
  }
  function dailyLabel(d) {
    var key = d.type === 'score' ? 'dScore' : d.type === 'coins' ? 'dCoins' : 'dPipes';
    return T('gs.pixelbird.' + key).replace('{n}', String(d.target));
  }
  function missionProgress(m) {
    if (!run) return 0;
    if (m.type === 'pipes') return run.pipeCount;
    if (m.type === 'coins') return run.coins;
    if (m.type === 'survive') return run.time;
    if (m.type === 'dodge') return run.dodges;
    if (m.type === 'pickups') return run.pickupCount;
    return 0;
  }
  function dailyProgress(d) {
    if (!run) return 0;
    if (d.type === 'score') return run.score;
    if (d.type === 'coins') return run.coins;
    if (d.type === 'pipes') return run.pipeCount;
    return 0;
  }

  function updateTaskbar() {
    if (!run || state === 'menu') {
      els.taskbar.innerHTML = previewMissions.map(function (m) {
        return '<div class="pb-task"><span>' + missionLabel(m) + '</span><em>0/' + m.target + '</em></div>';
      }).join('');
      return;
    }
    var prog = missionProgress;
    els.taskbar.innerHTML = run.missions.map(function (m) {
      var p = Math.min(m.target, prog(m));
      return '<div class="pb-task' + (m.done ? ' done' : '') + '"><span>' + missionLabel(m) +
        '</span><em>' + (Math.round(p * 10) / 10) + '/' + m.target + '</em></div>';
    }).join('');
  }

  /* ---------------- 开新局 ---------------- */
  function startRun(restore) {
    var r = restore || null;
    if (r) {
      run = r;
      run.ammoMax = run.ammoMax || 3;
      run.ammo = run.ammo == null ? 2 : run.ammo;
      run.nextAmmoScore = run.nextAmmoScore == null ? 8 : run.nextAmmoScore;
      run.bullets = run.bullets || [];
      run.kills = run.kills || 0;
      state = 'play';
      paused = false;
    } else {
      runIndex++;
      try { localStorage.setItem('arcade_pb_runs', String(runIndex)); } catch (e) {}
      var missions = previewMissions.length ? JSON.parse(JSON.stringify(previewMissions)) : makeMissions(runIndex);
      run = {
        time: 0, score: 0, coins: 0, pipeCount: 0, dodges: 0, pickupCount: 0,
        ammo: 2, ammoMax: 3, nextAmmoScore: 8, bullets: [], kills: 0,
        bird: { y: 236, vy: 0, rot: 0, wing: 0 },
        vy: 0,
        pipes: [], coinList: [], pickups: [], enemies: [], bombs: [], warnings: [],
        particles: [], floats: [], blocks: [],
        missions: missions, daily: dailyMission(),
        shieldT: 0, magnetT: 0, slowT: 0, invulnT: 0,
        shake: 0, flash: 0, slowmo: 1,
        spawnTimer: 0.9, enemyTimer: 9, pipeGap: 158, spawnCount: 0,
        dyingT: 0, clearT: 0, passed: 0
      };
      state = 'play';
      paused = false;
      seedFirstPipes(run);
      previewMissions = makeMissions(runIndex + 1);
    }
    hide(els.menu); hide(els.result); hide(els.veil);
    els.pause.hidden = false;
    paused = false;
    updateTaskbar();
    updateFireBtn();
    ARC.audio && ARC.audio.play('ui');
  }

  function seedFirstPipes(r) {
    var gapY = 244;
    r.pipes.push(makePipe(W + 46, gapY, 158));
  }

  function makePipe(x, gapY, gap) {
    return { x: x, gapY: gapY, gap: gap, passed: false };
  }

  function spawnPipe() {
    var prev = run.pipes[run.pipes.length - 1];
    var gap = run.pipeGap;
    var lastY = prev ? prev.gapY : 244;
    var gapY = clamp(lastY + rand(-110, 110), 108 + gap / 2, GROUND - 84 - gap / 2);
    var x = prev ? prev.x + rand(196, 232) : W + 50;
    if (x < W + 30) x = W + 30;
    var p = makePipe(x, gapY, gap);
    run.pipes.push(p);
    run.spawnCount = (run.spawnCount || 0) + 1;
    /* 金币 / 道具（缺口中心安全位置，不与管道重叠） */
    if (run.spawnCount % 3 === 0) {
      var types = ['shield', 'magnet', 'slow'];
      var type = types[(run.spawnCount / 3) % 3 | 0];
      run.pickups.push({ type: type, x: p.x + PIPE_W / 2, y: gapY, r: 13, t: 0, got: false });
    } else {
      var baseY = gapY - 22;
      for (var i = 0; i < 3; i++) {
        run.coinList.push({
          x: p.x + 8 + i * 23, y: baseY + (i === 1 ? -8 : i === 2 ? -16 : 0),
          t: Math.random() * 2, got: false
        });
      }
    }
  }

  /* ---------------- 输入 ---------------- */
  function flap() {
    if (state !== 'play' || paused) return;
    run.bird.vy = -318;
    run.bird.wing = 1;
    run.floats.push({ x: BIRD_X - 4, y: run.bird.y + 12, text: '', life: 0.4, color: 'rgba(255,255,255,0.5)' });
    ARC.audio && ARC.audio.play('move');
  }

  function togglePause() {
    if (state !== 'play') return;
    paused = !paused;
    els.veil.hidden = !paused;
    els.pause.textContent = paused ? '>' : 'II';
    updateFireBtn();
    if (!paused) ARC.audio && ARC.audio.play('ui');
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'play' && !paused) flap();
  });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      if (state === 'play' && !paused) { e.preventDefault(); flap(); }
      else if (state === 'over' || state === 'menu') { e.preventDefault(); previewMissions = makeMissions(runIndex + 1); startRun(); }
    } else if (e.code === 'KeyX' || e.code === 'KeyZ') {
      if (state === 'play' && !paused) { e.preventDefault(); fire(); }
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'play') { e.preventDefault(); togglePause(); }
    }
  });
  els.fire.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    fire();
  });
  els.fire.addEventListener('click', function (e) { e.stopPropagation(); });

  els.start.addEventListener('click', function () { startRun(); });
  els.cont.addEventListener('click', function () {
    if (resumeSnap) { var s = resumeSnap; resumeSnap = null; els.cont.hidden = true; startRun(s); }
  });
  els.again.addEventListener('click', function () { previewMissions = makeMissions(runIndex + 1); startRun(); });
  els.menuBtn.addEventListener('click', function () { showMenu(); });
  els.pause.addEventListener('click', function (e) { e.stopPropagation(); togglePause(); });
  els.resume.addEventListener('click', function () { paused = true; togglePause(); });
  els.veil.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  els.menu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  els.result.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  /* ---------------- 菜单 ---------------- */
  function showMenu() {
    state = 'menu';
    paused = false;
    hide(els.result); hide(els.veil);
    els.pause.hidden = true;
    show(els.menu);
    best = ARC.storage.getBest('pixelbird') || 0;
    runIndex = (function () { try { return parseInt(localStorage.getItem('arcade_pb_runs') || '0', 10) || 0; } catch (e) { return 0; } })();
    previewMissions = makeMissions(runIndex + 1);
    var today = ARC.daily.dayStr();
    var solved = ARC.daily.isSolved(SAVE_ID);
    var streak = ARC.daily.streak();
    els.menuSub.textContent = T('gs.pixelbird.menuSub');
    els.bestline.textContent = T('gs.pixelbird.best') + ' ' + best + '  ·  ' + T('gs.pixelbird.goal').replace('{n}', GOAL);
    var dm = dailyMission();
    els.daily.innerHTML = '<b>' + T('gs.pixelbird.daily') + '</b><span>' + dailyLabel(dm) + '</span><em>' +
      (solved ? T('gs.pixelbird.dailyDone') : T('gs.pixelbird.dailyTodo')) +
      (streak > 1 ? ' · ' + T('gs.pixelbird.streak').replace('{n}', streak) : '') + '</em>';
    updateTaskbar();
    els.taskbar.innerHTML = previewMissions.map(function (m) {
      return '<div class="pb-task"><span>' + missionLabel(m) + '</span><em>0/' + m.target + '</em></div>';
    }).join('');
    els.cont.hidden = !resumeSnap;
    updateFireBtn();
  }

  /* ---------------- 每局逻辑 ---------------- */
  function die(reason) {
    if (state !== 'play') return;
    state = 'dying';
    run.dyingT = 0;
    run.shake = 14;
    run.flash = 1;
    run.slowmo = 0.35;
    run.deathReason = reason || 'pipe';
    spawnBricks();
    ARC.audio && ARC.audio.play('lose');
    if (ARC.fx) { ARC.fx.shake(canvas); ARC.fx.flash('rgba(255,45,74,0.4)'); }
    if (ARC.juice) ARC.juice.lose();
    els.pause.hidden = true;
    updateFireBtn();
  }

  function spawnBricks() {
    for (var i = 0; i < 26; i++) {
      run.blocks.push({
        x: BIRD_X, y: run.bird.y, vx: rand(-150, 100), vy: rand(-240, -40),
        w: rand(3, 7), h: rand(3, 6), rot: rand(0, 6), vr: rand(-6, 6),
        life: 1, color: i % 3 === 0 ? '#fff2a8' : i % 3 === 1 ? '#ffd23d' : '#ff8a00'
      });
    }
  }

  function spawnFloat(text, color, x, y) {
    run.floats.push({ x: x || BIRD_X + 20, y: y || run.bird.y - 18, text: text, life: 1.2, color: color || '#ffe600' });
  }

  function updateFireBtn() {
    if (!els.fire) return;
    var ammo = run ? run.ammo : 2;
    els.fire.textContent = T('gs.pixelbird.fireBtn') + ' ×' + ammo;
    els.fire.classList.toggle('empty', ammo <= 0);
    els.fire.disabled = paused;
    if (els.fireHud) els.fireHud.hidden = state !== 'play';
    if (els.ammo) {
      var pips = els.ammo.children;
      for (var i = 0; i < pips.length; i++) pips[i].classList.toggle('off', i >= ammo);
    }
  }

  function addAmmo(n, x, y) {
    if (!run) return false;
    var before = run.ammo;
    run.ammo = Math.min(run.ammoMax || 3, run.ammo + (n || 1));
    var gained = run.ammo > before;
    if (gained) spawnFloat(T('gs.pixelbird.ammoGot'), '#7ce8ff', x, y);
    updateFireBtn();
    return gained;
  }

  function checkAmmoMilestones() {
    if (!run) return;
    var gained = false;
    while (run.score >= run.nextAmmoScore) {
      run.nextAmmoScore += 10;
      if (addAmmo(1)) gained = true;
    }
    if (gained) ARC.audio && ARC.audio.play('coin');
  }

  function fire() {
    if (!run || state !== 'play' || paused) return false;
    if (run.ammo <= 0) {
      spawnFloat(T('gs.pixelbird.fireEmpty'), '#ff8360');
      ARC.audio && ARC.audio.play('error');
      return false;
    }
    run.ammo--;
    var b = run.bird;
    run.bullets.push({ x: BIRD_X + 18, y: b.y, vx: 540, vy: 0, r: 4, ttl: 1.2 });
    for (var i = 0; i < 6; i++) {
      run.particles.push({
        x: BIRD_X + 18, y: b.y, vx: rand(60, 150), vy: rand(-34, 34),
        life: 0.7, size: rand(2, 3), color: '#7ce8ff', square: true
      });
    }
    ARC.audio && ARC.audio.play('match');
    updateFireBtn();
    return true;
  }

  function pickupEffect(type) {
    run.pickupCount++;
    if (type === 'shield') {
      run.shieldT = 12;
      spawnFloat(T('gs.pixelbird.gotShield'), '#7ce8ff');
      ARC.audio && ARC.audio.play('win');
    } else if (type === 'magnet') {
      run.magnetT = 8;
      spawnFloat(T('gs.pixelbird.gotMagnet'), '#b967ff');
      ARC.audio && ARC.audio.play('coin');
    } else {
      run.slowT = 5;
      spawnFloat(T('gs.pixelbird.gotSlow'), '#39ff14');
      ARC.audio && ARC.audio.play('daily');
    }
    for (var i = 0; i < 18; i++) {
      run.particles.push({
        x: BIRD_X, y: run.bird.y, vx: rand(-90, 90), vy: rand(-90, 90),
        life: 1, size: rand(2, 4), color: type === 'shield' ? '#7ce8ff' : type === 'magnet' ? '#b967ff' : '#39ff14', square: true
      });
    }
    if (ARC.juice) ARC.juice.coin();
    addAmmo(1);
  }

  function updateMissions() {
    run.missions.forEach(function (m) {
      if (m.done) return;
      if (missionProgress(m) >= m.target) {
        m.done = true;
        run.score += 40;
        run.floats.push({
          x: W / 2, y: 128, text: T('gs.pixelbird.missionDone').replace('{n}', missionLabel(m)),
          life: 2.0, color: '#39ff14'
        });
        if (ARC.ui) ARC.ui.toast(T('gs.pixelbird.missionDone').replace('{n}', missionLabel(m)), 'win');
        ARC.audio && ARC.audio.play('win');
        if (ARC.juice) ARC.juice.win();
      }
    });
    if (!run.daily.claimed && dailyProgress(run.daily) >= run.daily.target) {
      run.daily.claimed = true;
      run.daily.done = true;
      run.score += 100;
      ARC.daily.markSolved(SAVE_ID, Math.max(1, Math.round(run.time)));
      if (ARC.ui) ARC.ui.toast(T('gs.pixelbird.dailyDoneToast'), 'win');
      run.floats.push({ x: W / 2, y: 154, text: T('gs.pixelbird.dailyDoneToast'), life: 2.2, color: '#ffe600' });
      ARC.audio && ARC.audio.play('record');
    }
    checkAmmoMilestones();
  }

  function addCoins(n) {
    run.coins += n;
    run.score += n;
    updateMissions();
  }

  function updatePlay(dt) {
    run.time += dt;
    run.pipeGap = Math.max(122, 158 - run.score * 0.55);
    var speed = (150 + Math.min(85, run.score * 2.2)) * (run.slowT > 0 ? 0.55 : 1);
    scrollBg += speed * dt;
    updatePickupTimers(dt);

    var b = run.bird;
    b.vy += 840 * dt;
    b.vy = clamp(b.vy, -420, 420);
    b.y += b.vy * dt;
    b.rot = clamp(b.vy / 300, -1, 1);
    b.wing = Math.max(0, b.wing - dt * 4.5);
    b.y = Math.min(b.y, GROUND - BIRD_R);
    if (b.y >= GROUND - BIRD_R) { die('ground'); return; }

    /* 管道 */
    for (var i = 0; i < run.pipes.length; i++) {
      var p = run.pipes[i];
      p.x -= speed * dt;
      if (!p.passed && p.x + PIPE_W < BIRD_X) {
        p.passed = true;
        run.pipeCount++;
        run.score++;
        run.floats.push({ x: BIRD_X + 32, y: b.y - 16, text: '+1', life: 0.7, color: '#7ce8ff' });
        ARC.audio && ARC.audio.play('coin');
        updateMissions();
        if (run.pipeCount >= GOAL && state === 'play') {
          clearRun();
          return;
        }
      }
    }
    while (run.pipes.length && run.pipes[0].x < -PIPE_W - 10) run.pipes.shift();

    /* 金币 */
    for (var ci = 0; ci < run.coinList.length; ci++) {
      var coin = run.coinList[ci];
      coin.x -= speed * dt;
      coin.t += dt;
      if (run.magnetT > 0) {
        var dx = BIRD_X - coin.x, dy = b.y - coin.y;
        var d = Math.hypot(dx, dy);
        if (d < 110 && d > 1) {
          coin.x += dx / d * 230 * dt;
          coin.y += dy / d * 230 * dt;
        }
      }
      if (!coin.got && Math.hypot(coin.x - BIRD_X, coin.y - b.y) < 20) {
        coin.got = true;
        addCoins(1);
        run.floats.push({ x: coin.x, y: coin.y - 8, text: '+1', life: 0.6, color: '#ffe600' });
        ARC.audio && ARC.audio.play('coin');
      }
    }
    run.coinList = run.coinList.filter(function (c) { return !c.got && c.x > -20; });

    /* 道具 */
    for (var pi = 0; pi < run.pickups.length; pi++) {
      var pu = run.pickups[pi];
      pu.x -= speed * dt;
      pu.t += dt;
      if (!pu.got && Math.hypot(pu.x - BIRD_X, pu.y - b.y) < 23) {
        pu.got = true;
        pickupEffect(pu.type);
      }
    }
    run.pickups = run.pickups.filter(function (p) { return !p.got && p.x > -30; });

    /* 敌人生成节奏 */
    run.enemyTimer -= dt;
    if (run.score >= 5 && run.enemyTimer <= 0 && run.enemies.length < 3) {
      queueEnemy();
      run.enemyTimer = Math.max(3.2, 7 - run.score * 0.06);
    }
    updateEnemies(dt, speed);
    updateBullets(dt);
    updateWarnings(dt);

    /* 生成管道 / 回收 */
    var last = run.pipes[run.pipes.length - 1];
    if (!last || last.x < W - 150) spawnPipe();
    else if (run.pipeGap > 0) { /* noop */ }

    checkCollisions();

    /* 粒子/浮字/震屏 */
    updateFx(dt);
    if (run.shake > 0) run.shake = Math.max(0, run.shake - dt * 34);
    if (run.flash > 0) run.flash = Math.max(0, run.flash - dt * 3.2);
    if (run.slowmo < 1) run.slowmo = Math.min(1, run.slowmo + dt * 1.2);
  }

  function updatePickupTimers(dt) {
    if (run.shieldT > 0) run.shieldT = Math.max(0, run.shieldT - dt);
    if (run.magnetT > 0) run.magnetT = Math.max(0, run.magnetT - dt);
    if (run.slowT > 0) run.slowT = Math.max(0, run.slowT - dt);
    if (run.invulnT > 0) run.invulnT = Math.max(0, run.invulnT - dt);
  }

  function queueEnemy(forced) {
    var types = ['drone', 'chaser', 'bomber'];
    var type = forced || types[Math.floor(rand(0, types.length)) % types.length];
    var y;
    if (type === 'chaser') y = clamp(run.bird.y + rand(-70, 70), 90, GROUND - 90);
    else if (type === 'bomber') y = rand(84, 130);
    else y = rand(90, GROUND - 100);
    run.warnings.push({ type: type, y: y, t: 0.8 });
  }

  function updateWarnings(dt) {
    for (var i = run.warnings.length - 1; i >= 0; i--) {
      var w = run.warnings[i];
      w.t -= dt;
      if (w.t <= 0) {
        spawnEnemy(w.type, w.y);
        run.warnings.splice(i, 1);
      }
    }
  }

  function spawnEnemy(type, y, x) {
    var speed = (150 + Math.min(85, run.score * 2.2)) * (run.slowT > 0 ? 0.55 : 1);
    var e = {
      type: type, x: x == null ? W + 34 : x, y: y, baseY: y, t: 0, hit: false,
      vx: -(speed * (type === 'chaser' ? 1.28 : type === 'bomber' ? 0.92 : 1.08)),
      dropT: 1.0, near: false
    };
    run.enemies.push(e);
  }

  function updateEnemies(dt, speed) {
    for (var i = run.enemies.length - 1; i >= 0; i--) {
      var e = run.enemies[i];
      e.t += dt;
      e.x += e.vx * dt;
      if (e.type === 'drone') {
        e.y = e.baseY + Math.sin(e.t * 2.6) * 30;
      } else if (e.type === 'chaser') {
        e.y += clamp(run.bird.y - e.y, -95, 95) * dt;
      } else if (e.type === 'bomber') {
        e.y = e.baseY + Math.sin(e.t * 1.6) * 8;
        e.dropT -= dt;
        if (e.dropT <= 0) {
          e.dropT = 1.25;
          run.bombs.push({ x: e.x, y: e.y + 14, vx: e.vx * 0.75, vy: 40, r: 5 });
        }
      }
      /* 近身躲过 */
      if (!e.near && e.x < BIRD_X - 12 && Math.hypot(e.x - BIRD_X, e.y - run.bird.y) < 56) {
        e.near = true;
        run.dodges++;
        run.score += 1;
        run.floats.push({ x: BIRD_X + 30, y: run.bird.y - 28, text: T('gs.pixelbird.dodge'), life: 0.9, color: '#ff9ec4' });
        updateMissions();
      }
      if (e.x < -50) run.enemies.splice(i, 1);
    }
    for (var b = run.bombs.length - 1; b >= 0; b--) {
      var bomb = run.bombs[b];
      bomb.vy += 300 * dt;
      bomb.x += bomb.vx * dt;
      bomb.y += bomb.vy * dt;
      if (bomb.y > GROUND - 6 || bomb.x < -30) run.bombs.splice(b, 1);
    }
  }

  function enemyPoints(type) {
    return type === 'chaser' ? 8 : type === 'bomber' ? 10 : 5;
  }

  function updateBullets(dt) {
    for (var i = run.bullets.length - 1; i >= 0; i--) {
      var bu = run.bullets[i];
      bu.x += bu.vx * dt;
      bu.y += bu.vy * dt;
      bu.ttl -= dt;
      if (bu.ttl <= 0 || bu.x > W + 20 || bu.x < -20) { run.bullets.splice(i, 1); continue; }
      for (var e = run.enemies.length - 1; e >= 0; e--) {
        var en = run.enemies[e];
        if (Math.hypot(en.x - bu.x, en.y - bu.y) < bu.r + 13) {
          run.bullets.splice(i, 1);
          killEnemy(en);
          break;
        }
      }
    }
  }

  function killEnemy(enemy) {
    var idx = run.enemies.indexOf(enemy);
    if (idx < 0) return 0;
    run.enemies.splice(idx, 1);
    var pts = enemyPoints(enemy.type);
    run.kills++;
    run.score += pts;
    run.shake = Math.max(run.shake, 6);
    spawnFloat(T('gs.pixelbird.killFloat').replace('{n}', String(pts)), '#ff9ec4', enemy.x, enemy.y - 14);
    var col = enemy.type === 'chaser' ? '#ff8a00' : enemy.type === 'bomber' ? '#ffd36e' : '#7ce8ff';
    for (var i = 0; i < 24; i++) {
      run.particles.push({
        x: enemy.x, y: enemy.y, vx: rand(-150, 150), vy: rand(-150, 150),
        life: 1, size: rand(2, 4), color: col, square: true
      });
    }
    ARC.audio && ARC.audio.play('match');
    if (ARC.fx) ARC.fx.shake(canvas);
    updateMissions();
    return pts;
  }

  function checkCollisions() {
    var b = run.bird;
    for (var i = 0; i < run.pipes.length; i++) {
      var p = run.pipes[i];
      if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
        var top = p.gapY - p.gap / 2;
        var bot = p.gapY + p.gap / 2;
        if (b.y - BIRD_R < top || b.y + BIRD_R > bot) { die('pipe'); return; }
      }
    }
    if (run.invulnT > 0) return;
    for (var e = 0; e < run.enemies.length; e++) {
      var en = run.enemies[e];
      if (Math.hypot(en.x - BIRD_X, en.y - b.y) < BIRD_R + 13) {
        if (run.shieldT > 0) { shieldBlock(en, 'enemy'); return; }
        die('enemy'); return;
      }
    }
    for (var bi = 0; bi < run.bombs.length; bi++) {
      var bomb = run.bombs[bi];
      if (Math.hypot(bomb.x - BIRD_X, bomb.y - b.y) < BIRD_R + bomb.r) {
        if (run.shieldT > 0) { shieldBlock(null, 'bomb', bi); return; }
        die('bomb'); return;
      }
    }
  }

  function shieldBlock(enemy, kind, bombIndex) {
    run.shieldT = 0;
    run.invulnT = 1.3;
    run.score += 3;
    run.shake = 10;
    run.flash = 0.5;
    spawnFloat(T('gs.pixelbird.shieldBlock'), '#7ce8ff');
    for (var i = 0; i < 20; i++) {
      run.particles.push({
        x: BIRD_X, y: run.bird.y, vx: rand(-140, 140), vy: rand(-140, 140),
        life: 1, size: rand(2, 5), color: '#7ce8ff', square: true
      });
    }
    if (enemy) {
      var idx = run.enemies.indexOf(enemy);
      if (idx >= 0) {
        run.enemies.splice(idx, 1);
        run.kills++;
        run.score += enemyPoints(enemy.type);
      }
    }
    if (bombIndex != null) run.bombs.splice(bombIndex, 1);
    ARC.audio && ARC.audio.play('match');
    if (ARC.fx) { ARC.fx.shake(canvas); ARC.fx.flash('rgba(124,232,255,0.35)'); }
    if (ARC.juice) ARC.juice.win();
    updateMissions();
  }

  function clearRun() {
    state = 'clear';
    run.clearT = 0;
    run.shake = 6;
    run.slowmo = 0.45;
    spawnFloat(T('gs.pixelbird.goalDone'), '#39ff14', run.bird.y - 40);
    ARC.audio && ARC.audio.play('record');
    if (ARC.juice) ARC.juice.win();
  }

  function updateDying(dt) {
    run.dyingT += dt;
    var b = run.bird;
    b.vy += 840 * dt;
    b.y += b.vy * dt;
    updateFx(dt);
    for (var i = 0; i < run.blocks.length; i++) {
      var bl = run.blocks[i];
      bl.vy += 420 * dt;
      bl.x += bl.vx * dt;
      bl.y += bl.vy * dt;
      bl.rot += bl.vr * dt;
      bl.life -= dt * 0.9;
    }
    if (run.dyingT > 1.15 && state === 'dying') settle(false);
  }

  function updateClear(dt) {
    run.clearT += dt;
    updateFx(dt);
    if (run.clearT > 1.3 && state === 'clear') settle(true);
  }

  function updateFx(dt) {
    for (var i = run.particles.length - 1; i >= 0; i--) {
      var p = run.particles[i];
      p.vy += (p.grav == null ? 240 : p.grav) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.5;
      if (p.life <= 0) run.particles.splice(i, 1);
    }
    for (var f = run.floats.length - 1; f >= 0; f--) {
      var fl = run.floats[f];
      fl.y -= dt * 26;
      fl.life -= dt * (fl.text ? 1.2 : 2.6);
      if (fl.life <= 0) run.floats.splice(f, 1);
    }
    for (var b = run.blocks.length - 1; b >= 0; b--) {
      var bl = run.blocks[b];
      if (bl.life <= 0) run.blocks.splice(b, 1);
    }
  }

  /* ---------------- 结算 ---------------- */
  function settle(victory) {
    if (state === 'over') return;
    state = 'over';
    paused = false;
    var finalScore = Math.round(run.score);
    var isNew = false;
    if (ARC.shell && ARC.shell.submitScore) isNew = !!ARC.shell.submitScore(finalScore);
    best = ARC.storage.getBest('pixelbird') || best;
    var medal = finalScore >= 34 ? 'gold' : finalScore >= 22 ? 'silver' : finalScore >= 12 ? 'bronze' : 'none';
    var medalText = medal === 'none' ? T('gs.pixelbird.noMedal') : T('gs.pixelbird.medal' + medal);
    els.resTitle.textContent = victory ? T('gs.pixelbird.clearTitle') : T('gs.pixelbird.overTitle');
    els.resTitle.style.color = victory ? 'var(--neon-green)' : 'var(--neon-pink)';
    els.resScore.textContent = finalScore;
    els.resLine.textContent = T('gs.pixelbird.resLine')
      .replace('{p}', run.pipeCount).replace('{c}', run.coins)
      .replace('{t}', Math.round(run.time)) + '  ·  ' + T('gs.pixelbird.best') + ' ' + best;
    els.resMedal.textContent = medalText + (isNew ? '  ·  ' + T('gs.pixelbird.newBest') : '');
    els.resMissions.innerHTML = run.missions.map(function (m) {
      return '<div class="pb-task' + (m.done ? ' done' : '') + '"><span>' + missionLabel(m) +
        '</span><em>' + (m.done ? T('gs.pixelbird.done') : (Math.round(missionProgress(m) * 10) / 10) + '/' + m.target) + '</em></div>';
    }).join('') + '<div class="pb-task' + (run.daily.claimed ? ' done' : '') + '"><span>' +
      dailyLabel(run.daily) + '</span><em>' + (run.daily.claimed ? T('gs.pixelbird.done') :
        (Math.round(dailyProgress(run.daily) * 10) / 10) + '/' + run.daily.target) + '</em></div>';
    show(els.result);
    updateTaskbar();
    els.pause.hidden = true;
    run.result = { victory: victory, score: finalScore, coins: run.coins, best: best, medal: medal, isNew: isNew };
    updateFireBtn();
    writeSave();
  }

  function writeSave() {
    try { ARC.savegame.write(); } catch (e) {}
  }

  /* ---------------- 绘制辅助 ---------------- */
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function drawSky(t) {
    var phase = dayPhase();
    var idx = Math.floor(phase) % 4, nx = (idx + 1) % 4, a = phase - Math.floor(phase);
    var p1 = PALETTES[idx], p2 = PALETTES[nx];
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p1.top); g.addColorStop(1, p1.bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    var g2 = ctx.createLinearGradient(0, 0, 0, H);
    g2.addColorStop(0, p2.top); g2.addColorStop(1, p2.bot);
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    var starA = lerp(p1.star, p2.star, a);
    if (starA > 0.05) {
      for (var i = 0; i < menuStars.length; i++) {
        var s = menuStars[i];
        ctx.globalAlpha = starA * (0.35 + 0.35 * Math.sin(t * 2 + i));
        px(s.x, s.y, s.s, s.s, '#dff4ff');
      }
      ctx.globalAlpha = 1;
    }

    /* 太阳/月亮像素块 */
    var sunX = 300 - Math.sin(phase / 4 * Math.PI * 2) * 80;
    var sunY = 84 + Math.cos(phase / 4 * Math.PI * 2) * 30;
    var sunC = idx === 0 || idx === 3 ? '#cfd8ff' : p1.sun;
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (var sx = -12; sx <= 12; sx += 6) {
      for (var sy = -12; sy <= 12; sy += 6) {
        if (Math.abs(sx) + Math.abs(sy) <= 20) px(sunX + sx, sunY + sy, 6, 6, sunC);
      }
    }
    ctx.globalAlpha = 0.18;
    px(sunX - 22, sunY - 20, 44, 40, sunC);
    ctx.restore();
  }

  function drawClouds(list, speedFactor, alpha, baseY) {
    var off = scrollBg * speedFactor;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < list.length; i++) {
      var cl = list[i];
      var x = ((cl.x - off) % (W + 140)) - 70;
      if (x < -100) x += W + 140;
      var y = cl.y;
      var s = cl.s;
      px(x, y, cl.w * s, 8 * s, '#e9f6ff');
      px(x + 8 * s, y - 7 * s, cl.w * s * 0.7, 8 * s, '#e9f6ff');
      px(x + 4 * s, y + 7 * s, cl.w * s * 0.8, 5 * s, '#d4ecff');
    }
    ctx.restore();
  }

  function drawCity(list, factor, baseY, color, lit, alpha) {
    var off = scrollBg * factor;
    var total = list.length * (list[0].w + 18) + 200;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var x = ((b.x - off) % total);
      if (x < -80) x += total;
      px(x, baseY - b.h, b.w, b.h, color);
      px(x + b.w - 4, baseY - b.h - 8, 3, 8, color);
      if (lit) {
        var pulse = 0.25 + 0.2 * Math.sin(scrollBg * 0.02 + i);
        ctx.globalAlpha = alpha * pulse;
        for (var wy = 0; wy < Math.floor(b.h / 18); wy++) {
          for (var wx = 0; wx < 2; wx++) {
            if ((i + wy + wx) % 3 === 0) continue;
            px(x + 6 + wx * 12, baseY - b.h + 8 + wy * 16, 4, 6, '#ffd36e');
          }
        }
        ctx.globalAlpha = alpha;
      }
    }
    ctx.restore();
  }

  function drawGround() {
    px(0, GROUND, W, H - GROUND, '#0b1122');
    var g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 10);
    g.addColorStop(0, '#2d6cff'); g.addColorStop(1, 'rgba(11,17,34,0)');
    ctx.fillStyle = g; ctx.fillRect(0, GROUND, W, 12);
    px(0, GROUND, W, 2, '#7ce8ff');
    var off = scrollBg % 36;
    ctx.fillStyle = 'rgba(124,232,255,0.18)';
    for (var x = -off; x < W; x += 36) {
      ctx.fillRect(x, GROUND + 12, 18, 3);
      ctx.fillRect(x + 8, GROUND + 28, 10, 2);
    }
  }

  function drawPipes() {
    run.pipes.forEach(function (p) {
      var top = p.gapY - p.gap / 2;
      var bot = p.gapY + p.gap / 2;
      /* 上管 */
      var pg = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      pg.addColorStop(0, '#1c7d45'); pg.addColorStop(0.35, '#55e087'); pg.addColorStop(0.65, '#2ba862'); pg.addColorStop(1, '#145c36');
      ctx.fillStyle = pg;
      ctx.fillRect(p.x, 0, PIPE_W, top);
      ctx.fillRect(p.x, bot, PIPE_W, GROUND - bot);
      /* 像素高光/暗边 */
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(p.x + PIPE_W - 8, 0, 8, top);
      ctx.fillRect(p.x + PIPE_W - 8, bot, 8, GROUND - bot);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(p.x + 5, 0, 4, top);
      ctx.fillRect(p.x + 5, bot, 4, GROUND - bot);
      /* 管口 */
      ctx.fillStyle = '#0b1122';
      ctx.fillRect(p.x - 3, top - 10, PIPE_W + 6, 10);
      ctx.fillRect(p.x - 3, bot, PIPE_W + 6, 10);
      ctx.fillStyle = '#7ce8ff';
      ctx.globalAlpha = 0.55;
      ctx.fillRect(p.x - 3, top - 11, PIPE_W + 6, 2);
      ctx.fillRect(p.x - 3, bot + 9, PIPE_W + 6, 2);
      ctx.globalAlpha = 1;
    });
  }

  function drawCoins() {
    run.coinList.forEach(function (c) {
      var bob = Math.sin(c.t * 3) * 2;
      var x = c.x, y = c.y + bob;
      ctx.save();
      ctx.globalAlpha = 0.25;
      px(x - 8, y - 8, 16, 16, '#ffe600');
      ctx.globalAlpha = 1;
      px(x - 5, y - 7, 10, 14, '#ffd23d');
      px(x - 7, y - 4, 14, 8, '#ffd23d');
      px(x - 3, y - 5, 4, 3, '#fff7c0');
      px(x + 1, y, 2, 4, '#b8860b');
      ctx.restore();
    });
  }

  function drawPickups() {
    run.pickups.forEach(function (p) {
      var bob = Math.sin(p.t * 2.4) * 3;
      var y = p.y + bob;
      ctx.save();
      ctx.strokeStyle = p.type === 'shield' ? '#7ce8ff' : p.type === 'magnet' ? '#b967ff' : '#39ff14';
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(p.t * 4);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, y, 18 + Math.sin(p.t * 4) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      if (p.type === 'shield') {
        px(p.x - 8, y - 8, 16, 16, '#7ce8ff');
        px(p.x - 5, y - 5, 10, 10, '#0b1122');
        px(p.x - 2, y - 2, 4, 4, '#7ce8ff');
      } else if (p.type === 'magnet') {
        px(p.x - 8, y - 8, 5, 16, '#b967ff');
        px(p.x + 3, y - 8, 5, 16, '#b967ff');
        px(p.x - 8, y + 4, 16, 5, '#b967ff');
        px(p.x - 3, y - 4, 6, 6, '#ffe6ff');
      } else {
        px(p.x - 8, y - 9, 16, 4, '#39ff14');
        px(p.x - 7, y - 5, 4, 10, '#39ff14');
        px(p.x - 2, y, 4, 4, '#39ff14');
        px(p.x + 3, y + 4, 4, 5, '#39ff14');
      }
      ctx.restore();
    });
  }

  function drawEnemies() {
    run.enemies.forEach(function (e) {
      ctx.save();
      if (e.type === 'drone') {
        px(e.x - 10, e.y - 6, 20, 12, '#4b5b84');
        px(e.x - 6, e.y - 9, 12, 4, '#8aa0cc');
        px(e.x - 1, e.y - 2, 4, 4, '#ff2d55');
        px(e.x - 16, e.y - 11, 8, 3, '#c9d3ee');
        px(e.x + 8, e.y - 11, 8, 3, '#c9d3ee');
        var rotor = Math.sin(e.t * 18) > 0 ? 1 : -1;
        px(e.x - 20, e.y - 13, 10, 2, rotor > 0 ? '#7ce8ff' : '#3b4a6e');
        px(e.x + 10, e.y - 13, 10, 2, rotor > 0 ? '#3b4a6e' : '#7ce8ff');
      } else if (e.type === 'chaser') {
        var flap = Math.sin(e.t * 14) > 0 ? 5 : -5;
        px(e.x - 10, e.y - 6, 18, 12, '#3a2442');
        px(e.x - 14, e.y - 2, 8, 4, '#703a8a');
        px(e.x + 3, e.y - 8, 6, 5, '#3a2442');
        px(e.x + 8, e.y - 2, 5, 3, '#ff8a00');
        px(e.x + 4, e.y - 7, 3, 3, '#ff2d55');
        px(e.x - 4, e.y - 10 - flap, 8, 4, '#703a8a');
      } else {
        px(e.x - 11, e.y - 9, 22, 18, '#3b2a2e');
        px(e.x - 8, e.y - 12, 16, 5, '#8a4a55');
        px(e.x - 9, e.y + 9, 6, 4, '#c9d3ee');
        px(e.x + 3, e.y + 9, 6, 4, '#c9d3ee');
        px(e.x - 3, e.y - 4, 6, 5, '#ff8a00');
        var prop = Math.sin(e.t * 20) > 0 ? 1 : -1;
        px(e.x - 14, e.y - 14 + prop, 28, 2, '#ffd36e');
      }
      ctx.restore();
    });
    run.bombs.forEach(function (b) {
      px(b.x - 4, b.y - 4, 8, 8, '#2a1a1a');
      px(b.x - 2, b.y - 6, 4, 3, '#ff8a00');
      px(b.x - 1, b.y - 1, 2, 2, '#ff2d55');
    });
  }

  function drawBullets() {
    run.bullets.forEach(function (bu) {
      ctx.save();
      var g = ctx.createLinearGradient(bu.x - 28, 0, bu.x + 4, 0);
      g.addColorStop(0, 'rgba(124,232,255,0)');
      g.addColorStop(1, 'rgba(124,232,255,0.9)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bu.x - 28, bu.y); ctx.lineTo(bu.x + 2, bu.y); ctx.stroke();
      ctx.shadowColor = '#7ce8ff'; ctx.shadowBlur = 10;
      px(bu.x - 3, bu.y - 3, 8, 6, '#bff4ff');
      px(bu.x + 3, bu.y - 1, 4, 2, '#ff2d55');
      ctx.restore();
    });
  }

  function drawWarnings() {
    run.warnings.forEach(function (w) {
      var blink = Math.sin(w.t * 22) > 0;
      if (!blink) return;
      ctx.save();
      ctx.globalAlpha = 0.9;
      px(W - 16, w.y - 8, 10, 16, '#ff2d55');
      px(W - 24, w.y - 4, 8, 8, '#ff2d55');
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "Fusion Pixel",monospace';
      ctx.textAlign = 'right';
      ctx.fillText(T('gs.pixelbird.warning'), W - 30, w.y + 4);
      ctx.restore();
    });
  }

  function drawBird(t) {
    if (state === 'dying' || state === 'over') return;
    var b = run.bird;
    ctx.save();
    ctx.translate(BIRD_X, b.y);
    ctx.rotate(b.rot * 0.5);
    var wing = Math.sin(t * 13) > 0 ? -1 : 1;
    var flap = b.wing > 0 ? -1 : wing;
    var blink = run.invulnT > 0 && Math.floor(t * 16) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    if (run.shieldT > 0) {
      ctx.strokeStyle = '#7ce8ff'; ctx.globalAlpha = blink ? 0.5 : 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    /* 像素身体 */
    px(-10, -8, 16, 14, '#ffd23d');
    px(-9, -9, 14, 3, '#fff2a8');
    px(-8, 5, 13, 4, '#f5a623');
    px(4, -11, 10, 10, '#ffd23d');
    px(4, -11, 10, 3, '#fff2a8');
    px(12, -5, 6, 4, '#ff8a00');
    px(13, -4, 4, 2, '#ffd23d');
    px(8, -7, 3, 3, '#0b1122');
    px(9, -7, 1, 1, '#fff');
    px(-13, -2, 5, 3, '#f5a623');
    /* 翅膀 */
    if (flap < 0) {
      px(-4, -12, 11, 5, '#fff2a8');
      px(-3, -16, 8, 4, '#ffd23d');
    } else {
      px(-4, 3, 11, 5, '#f5a623');
      px(-3, 7, 8, 3, '#ffd23d');
    }
    ctx.restore();
  }

  function drawEffects() {
    run.particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.square) px(p.x, p.y, p.size, p.size, p.color);
      else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    run.blocks.forEach(function (bl) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, bl.life);
      ctx.translate(bl.x, bl.y); ctx.rotate(bl.rot);
      px(-bl.w / 2, -bl.h / 2, bl.w, bl.h, bl.color);
      ctx.restore();
    });
    run.floats.forEach(function (f) {
      if (!f.text) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.font = 'bold 11px "Fusion Pixel",monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = f.color; ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  }

  function drawPowerBars() {
    var items = [];
    if (run.shieldT > 0) items.push({ c: '#7ce8ff', t: run.shieldT / 12 });
    if (run.magnetT > 0) items.push({ c: '#b967ff', t: run.magnetT / 8 });
    if (run.slowT > 0) items.push({ c: '#39ff14', t: run.slowT / 5 });
    items.forEach(function (it, i) {
      var x = 10 + i * 52, y = 42;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y, 44, 5);
      ctx.fillStyle = it.c;
      ctx.fillRect(x, y, 44 * clamp(it.t, 0, 1), 5);
    });
  }

  function drawHud() {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff7c0';
    ctx.font = 'bold 13px "Fusion Pixel",monospace';
    ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 8;
    ctx.fillText(String(Math.floor(run.score)), 14, 26);
    ctx.shadowBlur = 0;
    /* 金币 */
    px(12, 34, 7, 9, '#ffd23d');
    ctx.fillStyle = '#fff2a8'; ctx.font = 'bold 10px "Fusion Pixel",monospace';
    ctx.fillText(String(run.coins), 24, 43);

    /* 弹药 */
    var ammo = run.ammo || 0;
    var ammoCol = ammo > 0 ? '#7ce8ff' : '#6b7280';
    px(12, 54, 4, 8, ammoCol);
    px(11, 61, 6, 3, ammoCol);
    ctx.fillStyle = ammo > 0 ? '#bff4ff' : '#7a8699';
    ctx.font = 'bold 10px "Fusion Pixel",monospace';
    ctx.fillText(T('gs.pixelbird.ammoHud') + ' ×' + ammo, 22, 64);

    /* 目标进度 */
    var gx = W - 110;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(gx, 18, 96, 7);
    ctx.fillStyle = '#7ce8ff';
    ctx.fillRect(gx, 18, 96 * clamp(run.pipeCount / GOAL, 0, 1), 7);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '9px "Fusion Pixel",monospace';
    ctx.textAlign = 'right';
    ctx.fillText(T('gs.pixelbird.goalHud').replace('{p}', run.pipeCount).replace('{n}', GOAL), W - 14, 36);
    drawPowerBars();
    /* 减速提示 */
    if (run.slowT > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(57,255,20,0.75)';
      ctx.font = '9px "Fusion Pixel",monospace';
      ctx.fillText(T('gs.pixelbird.slowHud'), 10, 76);
    }
    ctx.restore();
  }

  function render(tm) {
    var dt = lastDraw ? Math.min(0.05, (tm - lastDraw) / 1000) : 0.016;
    lastDraw = tm;
    var t = tm / 1000;
    menuT += dt;
    scrollBg += dt * (state === 'menu' ? 42 : 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    var shake = run ? run.shake : 0;
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawSky(t);
    drawClouds(cloudFar, 0.18, 0.35, 0);
    drawCity(cityFar, 0.16, GROUND - 18, '#1a2342', true, 0.65);
    drawCity(cityNear, 0.42, GROUND, '#0d162e', true, 0.9);
    drawClouds(cloudNear, 0.7, 0.25, 0);
    drawGround();

    if (run && state !== 'menu') {
      drawPipes();
      drawCoins();
      drawPickups();
      drawEnemies();
      drawBullets();
      drawWarnings();
      drawBird(t);
      drawEffects();
      drawHud();
        /* 减速滤镜 */
      if (run.slowT > 0) {
        ctx.fillStyle = 'rgba(57,255,20,0.05)';
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      drawBirdIdle(t);
    }
    if (run && run.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (run.flash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawBirdIdle(t) {
    var fake = { bird: { y: 250 + Math.sin(t * 1.6) * 8, vy: 0, wing: 0, rot: 0 }, t: t };
    ctx.save();
    ctx.translate(BIRD_X, fake.bird.y);
    var wing = Math.sin(t * 8) > 0 ? -1 : 1;
    px(-10, -8, 16, 14, '#ffd23d');
    px(-9, -9, 14, 3, '#fff2a8');
    px(4, -11, 10, 10, '#ffd23d');
    px(12, -5, 6, 4, '#ff8a00');
    px(8, -7, 3, 3, '#0b1122');
    px(9, -7, 1, 1, '#fff');
    if (wing < 0) { px(-4, -12, 11, 5, '#fff2a8'); px(-3, -16, 8, 4, '#ffd23d'); }
    else { px(-4, 3, 11, 5, '#f5a623'); px(-3, 7, 8, 3, '#ffd23d'); }
    ctx.restore();
  }

  /* ---------------- 主循环 ---------------- */
  function update(dtMs) {
    if (dtMs > 100) dtMs = 16;
    var dt = dtMs / 1000;
    if (state === 'play' && !paused) {
      updatePlay(dt * (run.slowmo || 1));
      updateMissions();
    } else if (state === 'dying') {
      updateDying(dt * 0.6);
      if (run.shake > 0) run.shake = Math.max(0, run.shake - dt * 30);
    } else if (state === 'clear') {
      updateClear(dt);
      if (run.shake > 0) run.shake = Math.max(0, run.shake - dt * 22);
    } else if (state === 'over') {
      if (run && run.floats) updateFx(dt);
    }
    taskTimer += dt;
    if (taskTimer > 0.25) {
      taskTimer = 0;
      if (state === 'play' && run) updateTaskbar();
    }
  }

  /* ---------------- 存档 ---------------- */
  function collectSave() {
    var snap = null;
    if (run && (state === 'play' || state === 'dying')) {
      snap = JSON.parse(JSON.stringify({
        time: run.time, score: run.score, coins: run.coins, pipeCount: run.pipeCount,
        dodges: run.dodges, pickupCount: run.pickupCount,
        bird: run.bird, pipesL: run.pipes, coinL: run.coinList,
        pickupsL: run.pickups, enemiesL: run.enemies, bombsL: run.bombs,
        missions: run.missions, daily: run.daily,
        shieldT: run.shieldT, magnetT: run.magnetT, slowT: run.slowT, invulnT: run.invulnT,
        ammo: run.ammo, ammoMax: run.ammoMax, nextAmmoScore: run.nextAmmoScore,
        kills: run.kills, bulletsL: run.bullets,
        pipeGap: run.pipeGap, spawnCount: run.spawnCount
      }));
    }
    return { v: 2, best: best, run: snap, runs: runIndex, savedAt: Date.now() };
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    best = Math.max(best, Number(s.best) || 0);
    if (s.runs) runIndex = Math.max(runIndex, Number(s.runs) || 0);
    if (s.run && s.run.bird && Array.isArray(s.run.pipesL)) {
      var r = s.run;
      resumeSnap = {
        time: r.time, score: r.score, coins: r.coins, pipeCount: r.pipeCount || 0,
        dodges: r.dodges, pickupCount: r.pickupCount,
        bird: r.bird, vy: r.bird.vy,
        pipes: r.pipesL, coinList: r.coinL || [], pickups: r.pickupsL || [],
        enemies: r.enemiesL || [], bombs: r.bombsL || [], warnings: [],
        particles: [], floats: [], blocks: [],
        missions: r.missions || makeMissions(runIndex + 1),
        daily: r.daily || dailyMission(),
        shieldT: r.shieldT || 0, magnetT: r.magnetT || 0, slowT: r.slowT || 0, invulnT: r.invulnT || 0,
        ammo: r.ammo == null ? 2 : r.ammo, ammoMax: r.ammoMax || 3,
        nextAmmoScore: r.nextAmmoScore == null ? 8 : r.nextAmmoScore,
        kills: r.kills || 0, bullets: r.bulletsL || r.bullets || [],
        shake: 0, flash: 0, slowmo: 1, spawnTimer: 0.9, enemyTimer: 8,
        pipeGap: r.pipeGap || 158, spawnCount: r.spawnCount || 0, dyingT: 0, clearT: 0
      };
    }
    return true;
  }

  /* ---------------- 启动 ---------------- */
  ARC.savegame.setup({ id: SAVE_ID, collect: collectSave, apply: applySave, msg: 'gs.pixelbird.saveResumed' });
  var resumed = ARC.savegame.resume() && !!resumeSnap;
  previewMissions = makeMissions(runIndex + 1);
  showMenu();
  if (resumed) els.cont.hidden = false;
  else if (ARC.savegame.resume) { /* toast handled */ }

  ARC.loop.start(function () { update(16); }, render, 16);

  /* ---------------- QA（仅 ?qa=1） ---------------- */
  if (/[?&]qa=1(?:&|$)/.test(window.location.search)) {
    window.__QA = {
      state: function () {
        return {
          state: state, paused: paused,
          score: run ? run.score : 0, coins: run ? run.coins : 0,
          pipes: run ? run.pipeCount : 0, goal: GOAL, time: run ? Math.round(run.time * 10) / 10 : 0,
          birdY: run ? Math.round(run.bird.y * 10) / 10 : 0,
          missions: run ? run.missions.map(function (m) { return { type: m.type, target: m.target, done: m.done }; }) : [],
          daily: run ? { type: run.daily.type, target: run.daily.target, done: run.daily.done } : null,
          shield: run ? run.shieldT : 0, magnet: run ? run.magnetT : 0, slow: run ? run.slowT : 0,
          pickups: run ? run.pickups.length : 0, enemies: run ? run.enemies.length : 0,
          ammo: run ? run.ammo : 0, ammoMax: run ? run.ammoMax : 3,
          kills: run ? run.kills : 0, bullets: run ? run.bullets.length : 0,
          warnings: run ? run.warnings.length : 0,
          best: best, result: run ? (run.result || null) : null,
          saved: (function () { try { return !!localStorage.getItem('arcade_save_pixelbird'); } catch (e) { return false; } })()
        };
      },
      start: function () { previewMissions = []; startRun(); },
      continueSaved: function () { if (resumeSnap) { var s = resumeSnap; resumeSnap = null; startRun(s); } },
      flap: function () { flap(); },
      setBirdY: function (y) { if (run) { run.bird.y = y; run.bird.vy = 0; } },
      clearPipes: function () { if (run) run.pipes.length = 0; },
      autopilot: function (on) { run.autopilot = !!on; },
      addPipes: function (n) {
        if (!run) return;
        for (var i = 0; i < (n || 1); i++) {
          run.pipeCount++; run.score++;
        }
        updateMissions();
        if (run.pipeCount >= GOAL && state === 'play') clearRun();
      },
      addCoins: function (n) { if (run) addCoins(n || 1); },
      spawnPickup: function (type) {
        if (!run) return;
        run.pickups.push({ type: type || 'shield', x: BIRD_X + 40, y: run.bird.y, r: 13, t: 0, got: false });
      },
      collectPickup: function (type) {
        if (!run) return;
        pickupEffect(type || 'shield');
      },
      spawnEnemy: function (type, y) {
        if (!run) return;
        var ty = type || 'drone';
        var yy = y == null ? (ty === 'bomber' ? 96 : run.bird.y - 10) : y;
        spawnEnemy(ty, yy, BIRD_X + 90);
      },
      fire: function () { return fire(); },
      warnEnemy: function (type) { if (run) queueEnemy(type); },
      die: function () { die('qa'); },
      clear: function () { if (state === 'play') clearRun(); },
      setTime: function (t) { if (run) run.time = t; },
      menu: function () { showMenu(); },
      again: function () { startRun(); },
      validateMissions: function () {
        return {
          pool: MISSION_POOL.map(function (m) { return m.type; }),
          preview: previewMissions.map(function (m) { return [m.type, m.target]; }),
          daily: (function () { var d = dailyMission(); return [d.type, d.target, ARC.daily.isSolved(SAVE_ID)]; })()
        };
      }
    };
  }

  /* 自动飞行（QA 专用，正常玩家不应触发） */
  var _autoTimer = 0;
  setInterval(function () {
    if (!run || !run.autopilot || state !== 'play' || paused) return;
    _autoTimer++;
    var target = 246;
    for (var i = 0; i < run.pipes.length; i++) {
      var p = run.pipes[i];
      if (p.x + PIPE_W > BIRD_X - 20) { target = p.gapY; break; }
    }
    /* 预测下一个缺口中心：朝最近管道中心飞 */
    if (run.bird.y > target + 12 && run.bird.vy > -40) flap();
    /* 收集道具/金币靠磁铁和正常飞行 */
  }, 34);
})();
