/* ============================================================
   青蛙过河 Frog Crossing —— 旗舰版
   · 随机河道（每关河道/车道数量、平台类型、速度与方向随机）
   · 乌龟浮沉（浮起→预警→潜水→浮起），潜水中的乌龟不可站立
   · 青蛙潜水（0.8s 水面存活 + 3s 冷却）
   · 荷叶苍蝇（+1 秒用时奖励）
   · 双人同屏竞速（共享车流、各自生命与进度）
   · 每帧 AABB 碰撞；用时 + 罚时（min 模式）
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.frogcross.tut1t'), d: T('gs.frogcross.tut1') },
  { t: T('gs.frogcross.tut2t'), d: T('gs.frogcross.tut2') },
  { t: T('gs.frogcross.tut3t'), d: T('gs.frogcross.tut3') },
  { t: T('gs.frogcross.tut4t'), d: T('gs.frogcross.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  var W = 460, H = 500;
  var FROG_SIZE = 26;
  var MAX_LEVEL = 5;
  var START_LIVES = 3;
  var DEATH_PENALTY = 3000;
  var DIVE_MS = 800;
  var DIVE_CD = 3000;
  var TURTLE_CYCLE = 6000;

  var laneTypes = [], LANE_H = 62.5, START_LANE = 7, riverLanes = [], roadLanes = [];
  var players = [], duo = false, level = 1;
  var cars = [], platforms = [], flies = [], fxTexts = [], droplets = [], ripples = [], shockwaves = [], bubbles = [];
  var elapsedMs = 0, clock = 0, hitFlash = 0, state = 'ready';
  var transTimer = null, flyTimer = 0, fliesEaten = 0, flyTotal = 0;
  var vig = null;

  function laneCenterY(lane) { return lane * LANE_H + LANE_H / 2; }
  function laneY(lane) { return lane * LANE_H + (LANE_H - FROG_SIZE) / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- DOM ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'fr-wrap';
  wrap.innerHTML =
    '<div class="fr-stage">' +
    '  <canvas class="fr-canvas" id="fr-canvas" aria-label="' + T('gs.frogcross.aria') + '"></canvas>' +
    '  <div class="fr-ov hidden" id="fr-ov">' +
    '    <div class="fr-ov-title" id="fr-ov-title"></div>' +
    '    <div class="fr-ov-body" id="fr-ov-body"></div>' +
    '    <div class="fr-ov-btns" id="fr-ov-btns"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="fr-top">' +
    '  <span>' + T('gs.frogcross.level') + ' <b id="fr-level">1</b></span>' +
    '  <span>' + T('gs.frogcross.time') + ' <b id="fr-time">0s</b></span>' +
    '  <span id="fr-flies">' + T('gs.frogcross.flies') + ' <b>0</b></span>' +
    '  <span id="fr-status"></span>' +
    '  <span id="fr-status2" hidden></span>' +
    '</div>' +
    '<div class="fr-msg" id="fr-msg">' + T('gs.frogcross.hint') + '</div>' +
    '<div class="fr-pads" id="fr-pads">' +
    '  <div class="fr-pad-box" id="fr-padbox1"><span class="fr-pad-label" id="fr-label1"></span><div id="fr-dpad1"></div>' +
    '    <button class="fr-dive" id="fr-dive1" type="button">' + T('gs.frogcross.dive') + '<small></small></button></div>' +
    '  <div class="fr-pad-box" id="fr-padbox2" hidden><span class="fr-pad-label">P2</span><div id="fr-dpad2"></div>' +
    '    <button class="fr-dive" id="fr-dive2" type="button">' + T('gs.frogcross.dive') + '<small></small></button></div>' +
    '</div>' +
    '<div class="game-controls">' +
    '  <button id="fr-pause" class="btn green">' + T('gs.frogcross.pause') + '</button>' +
    '  <button id="fr-mode" class="btn">' + T('gs.frogcross.duoMode') + '</button>' +
    '  <button id="fr-restart" class="btn purple">' + T('gs.frogcross.restart') + '</button>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#fr-canvas');
  var info = GK.setup(canvas, W, H);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = info.ctx;

  var levelEl = wrap.querySelector('#fr-level');
  var timeEl = wrap.querySelector('#fr-time');
  var fliesEl = wrap.querySelector('#fr-flies').querySelector('b');
  var statusEl = wrap.querySelector('#fr-status');
  var status2El = wrap.querySelector('#fr-status2');
  var msg = wrap.querySelector('#fr-msg');
  var ov = wrap.querySelector('#fr-ov'), ovTitle = wrap.querySelector('#fr-ov-title'),
      ovBody = wrap.querySelector('#fr-ov-body'), ovBtns = wrap.querySelector('#fr-ov-btns');
  var pauseBtn = wrap.querySelector('#fr-pause'), restartBtn = wrap.querySelector('#fr-restart'),
      modeBtn = wrap.querySelector('#fr-mode');
  var padBox1 = wrap.querySelector('#fr-padbox1'), padBox2 = wrap.querySelector('#fr-padbox2'),
      label1 = wrap.querySelector('#fr-label1'), diveBtn1 = wrap.querySelector('#fr-dive1'),
      diveBtn2 = wrap.querySelector('#fr-dive2');

  function setTxt(el, v) {
    if (!el) return;
    v = String(v);
    if (el.__v !== v) { el.__v = v; el.textContent = v; }
  }

  /* ---------- 关卡布局 ---------- */
  function buildLanes(lv) {
    var riverN = 3 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0);
    if (lv >= 4 && Math.random() < 0.45) riverN++;
    riverN = clamp(riverN, 3, 5);
    var roadN = lv >= 3 ? 3 : 2;
    var types = ['goal'];
    for (var r = 0; r < riverN; r++) types.push('river');
    for (var d = 0; d < roadN; d++) types.push('road');
    types.push('start');
    laneTypes = types;
    LANE_H = H / types.length;
    START_LANE = types.length - 1;
    riverLanes = []; roadLanes = [];
    for (var i = 0; i < types.length; i++) {
      if (types[i] === 'river') riverLanes.push(i);
      if (types[i] === 'road') roadLanes.push(i);
    }
  }

  /* ---------- 交通 / 平台生成 ---------- */
  function makeCars(lv) {
    cars = [];
    roadLanes.forEach(function (lane, idx) {
      var dir = (idx % 2 === 0) ? 1 : -1;
      if (Math.random() < 0.35) dir = -dir;
      var speed = 1.7 + Math.random() * 1.1 + lv * 0.3;
      var gap = Math.max(104, 158 - lv * 8 + (Math.random() - 0.5) * 18);
      var w = (Math.random() < 0.35) ? 54 : 44;
      var h = 22;
      var off = Math.random() * gap * 0.5;
      for (var x = -w - off; x < W + 60; x += gap) {
        cars.push({ lane: lane, dir: dir, speed: speed, w: w, h: h, x: x, y: lane * LANE_H + (LANE_H - h) / 2 });
      }
    });
  }

  function makePlatforms(lv) {
    platforms = [];
    riverLanes.forEach(function (lane, idx) {
      var dir = (idx % 2 === 0) ? 1 : -1;
      if (Math.random() < 0.4) dir = -dir;
      var speed = 0.55 + Math.random() * 1.35 + lv * 0.16;
      var kindRoll = Math.random();
      var kind = kindRoll < 0.26 ? 'turtle' : (kindRoll < 0.48 ? 'lily' : 'log');
      var w = kind === 'turtle' ? 58 + Math.random() * 18 : (kind === 'lily' ? 54 + Math.random() * 16 : 72 + Math.random() * 42);
      var gap = 32 + Math.random() * 14;
      var off = Math.random() * gap;
      var items = [];
      for (var x = -w - off; x < W + 60; x += w + gap) {
        items.push(x);
      }
      items.forEach(function (x, gi) {
        platforms.push({
          lane: lane, dir: dir, speed: speed, kind: kind, w: w,
          h: kind === 'turtle' ? 26 : 28, x: x,
          y: lane * LANE_H + (LANE_H - (kind === 'turtle' ? 26 : 28)) / 2,
          seed: Math.random() * 6.28,
          phase: kind === 'turtle' ? (gi / Math.max(1, items.length)) * TURTLE_CYCLE + Math.random() * 300 : 0,
          group: gi
        });
      });
    });
  }

  /* ---------- 玩家 ---------- */
  function makePlayer(i, color) {
    return {
      i: i, color: color, x: 0, y: 0, lane: START_LANE, alive: true,
      lives: START_LIVES, deaths: 0, penalty: 0, bonusMs: 0, progress: 0,
      diveTimer: 0, diveCool: 0, squash: 0, invuln: 0, lastLane: START_LANE
    };
  }
  function resetPlayer(p) {
    p.x = duo ? (p.i === 0 ? W / 2 - 92 : W / 2 + 66) : W / 2 - FROG_SIZE / 2;
    p.lane = START_LANE;
    p.y = laneY(START_LANE);
    p.diveTimer = 0;
    p.squash = 0;
    p.invuln = 240;
    p.lastLane = START_LANE;
  }
  function resetPlayers() {
    players.forEach(resetPlayer);
  }
  function playerByIdx(idx) { return players[idx] || players[0]; }
  function playerTime(p) { return Math.max(0, Math.round((elapsedMs + p.penalty - p.bonusMs) / 1000)); }

  function hearts(n) {
    var s = '';
    for (var i = 0; i < START_LIVES; i++) s += '<i class="fr-heart' + (i < n ? ' on' : '') + '"></i>';
    return s;
  }
  function renderHUD() {
    setTxt(levelEl, level);
    var t = players.length ? playerTime(players[0]) : 0;
    setTxt(timeEl, (duo ? Math.round(elapsedMs / 1000) : t) + 's');
    setTxt(fliesEl, fliesEaten);
    var p1 = players[0];
    var html1 = '';
    if (p1) {
      html1 = (duo ? '<b class="fr-p1">P1</b>' : '') + hearts(p1.lives) +
        (duo ? ' <span class="fr-prog">★' + p1.progress + '</span>' : '');
      statusEl.style.color = p1.lives <= 1 ? 'var(--neon-pink)' : 'var(--neon-green)';
    } else {
      statusEl.style.color = '';
    }
    if (statusEl.__h !== html1) { statusEl.__h = html1; statusEl.innerHTML = html1; }
    if (duo && players[1]) {
      var p2 = players[1];
      status2El.hidden = false;
      var html2 = '<b class="fr-p2">P2</b>' + hearts(p2.lives) + ' <span class="fr-prog">★' + p2.progress + '</span>';
      if (status2El.__h !== html2) { status2El.__h = html2; status2El.innerHTML = html2; }
      status2El.style.color = p2.lives <= 1 ? 'var(--neon-pink)' : 'var(--neon-cyan)';
    } else {
      status2El.hidden = true;
      status2El.innerHTML = '';
      status2El.__h = '';
    }
    updateDiveUI();
  }

  /* ---------- 覆盖层 ---------- */
  function openOverlay(title, bodyHtml, buttons) {
    ovTitle.innerHTML = title;
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

  function bestKey() { return duo ? 'frogcross_duo' : 'frogcross'; }
  function bestValue() {
    var b = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest(bestKey()) : null;
    return b === null ? '—' : b + 's';
  }

  /* ---------- 流程 ---------- */
  function newGame() {
    if (transTimer) { clearTimeout(transTimer); transTimer = null; }
    state = 'play';
    level = 1;
    elapsedMs = 0;
    fliesEaten = 0; flyTotal = 0;
    flyTimer = 3000;
    hitFlash = 0;
    fxTexts = []; droplets = []; ripples = []; shockwaves = []; bubbles = [];
    players = [makePlayer(0, 'green')];
    if (duo) players.push(makePlayer(1, 'cyan'));
    buildLanes(level);
    makeCars(level);
    makePlatforms(level);
    resetPlayers();
    closeOverlay();
    renderHUD();
    msg.textContent = duo ? T('gs.frogcross.duoStart') : T('gs.frogcross.hint');
    msg.style.color = '';
    if (Arcade.audio) Arcade.audio.play('ui');
    updatePadVisibility();
  }

  function gameOver(reason) {
    state = 'fail';
    if (transTimer) { clearTimeout(transTimer); transTimer = null; }
    var p1 = players[0];
    if (window.Arcade && Arcade.juice) Arcade.juice.lose();
    openOverlay(
      T('gs.frogcross.failT'),
      T('gs.frogcross.failD').replace('{t}', p1 ? playerTime(p1) : 0).replace('{d}', p1 ? p1.deaths : 0) +
        '<div class="fr-ov-note">' + T('gs.frogcross.fliesResult').replace('{n}', fliesEaten) + '</div>',
      [
        { label: T('gs.frogcross.restart'), cls: 'green', action: newGame },
        { label: T('gs.frogcross.toLobby'), href: '../../index.html' }
      ]
    );
    msg.textContent = T('gs.frogcross.failT');
    msg.style.color = 'var(--neon-pink)';
  }

  function winGame() {
    state = 'win';
    var p1 = players[0];
    var sec = playerTime(p1);
    var isNew = window.Arcade && Arcade.shell ? Arcade.shell.submitScore(sec) : false;
    if (Arcade.juice) Arcade.juice.win();
    openOverlay(
      T('gs.frogcross.winAllT'),
      T('gs.frogcross.winAllD').replace('{t}', sec).replace('{d}', p1.deaths) +
        '<div class="fr-ov-note">' + T('gs.frogcross.fliesResult').replace('{n}', fliesEaten) + ' · ' +
        T('gs.frogcross.resultLine').replace('{b}', bestValue()) +
        (isNew ? ' · ' + T('gs.frogcross.newRecord') : '') + '</div>',
      [
        { label: T('gs.frogcross.again'), cls: 'green', action: newGame },
        { label: T('gs.frogcross.toLobby'), href: '../../index.html' }
      ]
    );
    msg.textContent = T('gs.frogcross.winAllT');
    msg.style.color = 'var(--neon-green)';
  }

  function winMatch(winner, how) {
    state = 'win';
    var sec = playerTime(winner);
    var isNew = false;
    try {
      if (window.Arcade && Arcade.storage && Arcade.storage.submitBest) isNew = !!Arcade.storage.submitBest('frogcross_duo', sec);
    } catch (e) {}
    if (window.Arcade && Arcade.juice) Arcade.juice.win();
    fxBurst(W / 2, H / 2, '0,240,255', 40);
    var other = players[1 - winner.i];
    openOverlay(
      T('gs.frogcross.duoWinT').replace('{p}', winner.i === 0 ? 'P1' : 'P2'),
      T(how === 'elim' ? 'gs.frogcross.duoWinElim' : 'gs.frogcross.duoWinD')
        .replace('{p1}', players[0].progress).replace('{p2}', players[1] ? players[1].progress : 0)
        .replace('{t}', sec) +
        '<div class="fr-ov-note">' + T('gs.frogcross.fliesResult').replace('{n}', fliesEaten) + ' · ' +
        T('gs.frogcross.duoBestLine').replace('{b}', bestValue()) +
        (isNew ? ' · ' + T('gs.frogcross.newRecord') : '') + '</div>',
      [
        { label: T('gs.frogcross.again'), cls: 'green', action: newGame },
        { label: T('gs.frogcross.toLobby'), href: '../../index.html' }
      ]
    );
    msg.textContent = T('gs.frogcross.duoWinT').replace('{p}', winner.i === 0 ? 'P1' : 'P2');
    msg.style.color = 'var(--neon-green)';
    renderHUD();
  }

  function nextLevel(who) {
    if (state !== 'play') return;
    if (duo) {
      who.progress++;
      if (who.progress >= MAX_LEVEL) { winMatch(who, 'goal'); return; }
    } else {
      if (level >= MAX_LEVEL) { winGame(); return; }
      level++;
    }
    state = 'transition';
    if (window.Arcade && Arcade.juice) Arcade.juice.win();
    fxBurst(who.x + FROG_SIZE / 2, Math.max(16, who.y), who.color === 'cyan' ? '0,240,255' : '57,255,20', 24);
    if (duo) {
      if (who.progress < MAX_LEVEL) level = Math.min(MAX_LEVEL, level + 1);
    }
    openOverlay(
      T('gs.frogcross.levelClearT').replace('{n}', level),
      duo
        ? T('gs.frogcross.duoLevelClear').replace('{p}', who.i === 0 ? 'P1' : 'P2').replace('{n}', who.progress)
        : T('gs.frogcross.levelClearD').replace('{n}', Math.min(MAX_LEVEL, level + 1)),
      []
    );
    transTimer = setTimeout(function () {
      transTimer = null;
      if (state !== 'transition') return;
      buildLanes(level);
      makeCars(level);
      makePlatforms(level);
      flies = [];
      flyTimer = 3000 + Math.random() * 3000;
      resetPlayers();
      state = 'play';
      closeOverlay();
      renderHUD();
      msg.textContent = T('gs.frogcross.levelUp').replace('{n}', level);
      msg.style.color = 'var(--neon-yellow)';
      if (Arcade.audio) Arcade.audio.play('clear');
    }, 1150);
  }

  function die(reason, p) {
    if (state !== 'play' || !p || !p.alive) return;
    p.deaths++;
    p.lives--;
    p.penalty += DEATH_PENALTY;
    hitFlash = 1;
    p.squash = 1;
    var cx = p.x + FROG_SIZE / 2, cy = p.y + FROG_SIZE / 2;
    if (reason === 'car') {
      fxBurst(cx, cy, '255,45,149', 20);
      for (var i = 0; i < 16; i++) {
        var ang = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.4;
        droplets.push({ x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1, life: 1, kind: 'spark', size: 1 + Math.random() * 2.2 });
      }
      shockwaves.push({ x: cx, y: cy, r: 6, life: 1, color: '255,45,149' });
      if (window.Arcade && Arcade.juice) Arcade.juice.lose();
    } else {
      fxBurst(cx, cy, '154,209,255', 18);
      ripples.push({ x: cx, y: cy, r: 4, life: 1 });
      ripples.push({ x: cx, y: cy, r: 1, life: 1 });
      for (var d = 0; d < 22; d++) {
        droplets.push({ x: cx + (Math.random() - 0.5) * 18, y: cy, vx: (Math.random() - 0.5) * 2.6, vy: -1.6 - Math.random() * 3, life: 1, kind: 'water', size: 1.6 + Math.random() * 2.4 });
      }
      if (Arcade.audio) Arcade.audio.play('error');
    }
    if (p.lives <= 0) {
      p.alive = false;
      if (duo) {
        var other = players[1 - p.i];
        if (!other || !other.alive) { gameOver('both'); return; }
        winMatch(other, 'elim');
        return;
      }
      gameOver(reason);
      return;
    }
    resetPlayer(p);
    msg.textContent = (reason === 'car' ? T('gs.frogcross.dieCar')
      : reason === 'carried' ? T('gs.frogcross.dieCarried')
        : T('gs.frogcross.dieDrown')) + ' ' + (duo ? (p.i === 0 ? 'P1 ' : 'P2 ') : '') +
      T('gs.frogcross.livesLeft').replace('{n}', p.lives);
    msg.style.color = 'var(--neon-pink)';
    renderHUD();
  }

  /* ---------- 苍蝇 ---------- */
  function spawnFly() {
    if (flies.length) return;
    var river = platforms.filter(function (pl) { return pl.kind !== 'turtle'; });
    var fly;
    if (river.length && Math.random() < 0.75) {
      var pl = river[Math.floor(Math.random() * river.length)];
      fly = { platform: pl, lane: pl.lane, x: pl.x + pl.w / 2, y: pl.y - 6, phase: Math.random() * 6.28, life: 8000, onGoal: false };
    } else {
      var pads = 6;
      var idx = Math.floor(Math.random() * pads);
      fly = { platform: null, lane: 0, x: 38 + idx * ((W - 76) / (pads - 1)), y: laneCenterY(0) - 4, phase: Math.random() * 6.28, life: 8000, onGoal: true };
    }
    flies.push(fly);
    flyTotal++;
  }
  function eatFly(fly, p) {
    var idx = flies.indexOf(fly);
    if (idx < 0) return;
    flies.splice(idx, 1);
    fliesEaten++;
    p.bonusMs += 1000;
    fxTexts.push({ x: fly.x, y: fly.y, text: T('gs.frogcross.flyBonus'), life: 1, color: '#ffe066' });
    for (var i = 0; i < 12; i++) {
      var a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2.2;
      droplets.push({ x: fly.x, y: fly.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, kind: 'spark', size: 1.2 + Math.random() * 1.6 });
    }
    if (Arcade.audio) Arcade.audio.play('coin');
    renderHUD();
  }

  /* ---------- 潜水 ---------- */
  function dive(p) {
    if (state !== 'play' || !p || !p.alive) return;
    if (p.diveCool > 0 || p.diveTimer > 0) return;
    p.diveTimer = DIVE_MS;
    p.diveCool = DIVE_CD;
    p.squash = 1;
    var cx = p.x + FROG_SIZE / 2, cy = p.y + FROG_SIZE / 2;
    for (var i = 0; i < 10; i++) {
      bubbles.push({ x: cx + (Math.random() - 0.5) * 16, y: cy, r: 1 + Math.random() * 2, life: 1, vy: -0.7 - Math.random() * 0.9 });
    }
    if (Arcade.audio) Arcade.audio.play('drop');
  }

  /* ---------- 每帧 ---------- */
  function onPlatformAt(p, lane) {
    var best = null, bestDist = 999;
    for (var i = 0; i < platforms.length; i++) {
      var pl = platforms[i];
      if (pl.lane !== lane) continue;
      if (pl.kind === 'turtle' && turtleState(pl) === 'sink') continue;
      var fc = p.x + FROG_SIZE / 2;
      if (fc >= pl.x - 4 && fc <= pl.x + pl.w + 4) {
        var d = Math.abs(fc - (pl.x + pl.w / 2));
        if (d < bestDist) { bestDist = d; best = pl; }
      }
    }
    return best;
  }
  function turtleState(pl) {
    var t = (clock + pl.phase) % TURTLE_CYCLE;
    if (t < 3400) return 'float';
    if (t < 4400) return 'warn';
    if (t < 5500) return 'sink';
    return 'float';
  }

  function update(n) {
    var steps = n || 1;
    clock += 16 * steps;
    if (state !== 'play') { renderFlyTick(steps); return; }
    elapsedMs += 16 * steps;
    if (hitFlash > 0) hitFlash *= 0.9;
    if (flyTimer > 0) flyTimer -= 16 * steps;
    if (flyTimer <= 0 && flies.length === 0) { spawnFly(); flyTimer = 8000 + Math.random() * 4000; }

    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      c.x += c.dir * c.speed * steps;
      if (c.dir > 0 && c.x > W + 60) c.x = -c.w - 24;
      if (c.dir < 0 && c.x + c.w < -60) c.x = W + 24;
    }
    for (var j = 0; j < platforms.length; j++) {
      var lg = platforms[j];
      lg.x += lg.dir * lg.speed * steps;
      if (lg.dir > 0 && lg.x > W + 60) lg.x = -lg.w - 24;
      if (lg.dir < 0 && lg.x + lg.w < -60) lg.x = W + 24;
    }

    for (var pi = 0; pi < players.length; pi++) {
      var p = players[pi];
      if (!p.alive) continue;
      if (p.invuln > 0) p.invuln -= 16 * steps;
      if (p.diveCool > 0) p.diveCool -= 16 * steps;
      if (p.diveTimer > 0) p.diveTimer -= 16 * steps;
      var diving = p.diveTimer > 0;

      if (laneTypes[p.lane] === 'river') {
        var support = onPlatformAt(p, p.lane);
        if (!support) {
          if (!diving) { die('drown', p); continue; }
        } else {
          p.x += support.dir * support.speed * steps;
        }
        if (p.x < -FROG_SIZE * 0.5 || p.x > W - FROG_SIZE * 0.5) { die('carried', p); continue; }
      } else {
        p.x = clamp(p.x, 0, W - FROG_SIZE);
      }

      if (laneTypes[p.lane] === 'road') {
        var fx = p.x + 3, fy = p.y + 4, fw = FROG_SIZE - 6, fh = FROG_SIZE - 8;
        for (var m = 0; m < cars.length; m++) {
          var car = cars[m];
          if (car.lane !== p.lane) continue;
          if (fx < car.x + car.w && fx + fw > car.x && fy < car.y + car.h && fy + fh > car.y) { die('car', p); break; }
        }
        if (!p.alive) continue;
      }
      p.squash *= 0.88;
      if (p.lastLane !== p.lane) {
        if (laneTypes[p.lane] === 'river') {
          fxBurst(p.x + FROG_SIZE / 2, p.y + FROG_SIZE / 2, '154,209,255', 6);
          ripples.push({ x: p.x + FROG_SIZE / 2, y: p.y + FROG_SIZE / 2, r: 3, life: 1 });
        }
        p.lastLane = p.lane;
      }
      if (diving && laneTypes[p.lane] === 'river' && Math.random() < 0.18) {
        bubbles.push({ x: p.x + FROG_SIZE / 2 + (Math.random() - 0.5) * 14, y: p.y + FROG_SIZE / 2, r: 1 + Math.random() * 2, life: 1, vy: -0.8 - Math.random() * 0.7 });
      }
    }

    /* 苍蝇位置 */
    for (var fi = 0; fi < flies.length; fi++) {
      var fly = flies[fi];
      if (fly.platform) { fly.x = fly.platform.x + fly.platform.w / 2; fly.y = fly.platform.y - 7; }
      fly.life -= 16 * steps;
      if (fly.life <= 0) { flies.splice(fi, 1); fi--; continue; }
      for (var k = 0; k < players.length; k++) {
        var plr = players[k];
        if (!plr.alive) continue;
        var ddx = (plr.x + FROG_SIZE / 2) - fly.x, ddy = (plr.y + FROG_SIZE / 2) - fly.y;
        if (ddx * ddx + ddy * ddy < 26 * 26) { eatFly(fly, plr); break; }
      }
    }

    tickFx(steps);
    renderHUD();
  }

  function renderFlyTick(steps) {
    tickFx(steps);
  }

  function tickFx(steps) {
    for (var r = ripples.length - 1; r >= 0; r--) {
      ripples[r].r += 2.2 * steps; ripples[r].life -= 0.03 * steps;
      if (ripples[r].life <= 0) ripples.splice(r, 1);
    }
    for (var d = droplets.length - 1; d >= 0; d--) {
      var dp = droplets[d];
      dp.x += dp.vx * steps; dp.y += dp.vy * steps;
      dp.vy += (dp.kind === 'water' ? 0.12 : 0.16) * steps;
      dp.life -= 0.028 * steps;
      if (dp.life <= 0) droplets.splice(d, 1);
    }
    for (var s = shockwaves.length - 1; s >= 0; s--) {
      shockwaves[s].r += 3.2 * steps; shockwaves[s].life -= 0.035 * steps;
      if (shockwaves[s].life <= 0) shockwaves.splice(s, 1);
    }
    for (var b = bubbles.length - 1; b >= 0; b--) {
      bubbles[b].y += bubbles[b].vy * steps; bubbles[b].life -= 0.035 * steps;
      if (bubbles[b].life <= 0) bubbles.splice(b, 1);
    }
    for (var t = fxTexts.length - 1; t >= 0; t--) {
      fxTexts[t].y -= 0.8 * steps; fxTexts[t].life -= 0.028 * steps;
      if (fxTexts[t].life <= 0) fxTexts.splice(t, 1);
    }
  }

  /* ---------- 输入 ---------- */
  function move(dir, p) {
    if (state !== 'play' || !p || !p.alive) return;
    var stepX = 46;
    if (dir === 'up' && p.lane > 0) {
      p.lane--; p.y = laneY(p.lane);
      if (laneTypes[p.lane] === 'goal') { p.squash = 1; nextLevel(p); return; }
    } else if (dir === 'down' && p.lane < START_LANE) {
      p.lane++; p.y = laneY(p.lane);
    } else if (dir === 'left') {
      p.x = Math.max(0, p.x - stepX);
    } else if (dir === 'right') {
      p.x = Math.min(W - FROG_SIZE, p.x + stepX);
    }
    p.squash = 1;
    if (window.Arcade && Arcade.juice) Arcade.juice.move();
    if (laneTypes[p.lane] === 'goal') { nextLevel(p); return; }
    if (laneTypes[p.lane] === 'road') {
      var fx = p.x + 3, fy = p.y + 4, fw = FROG_SIZE - 6, fh = FROG_SIZE - 8;
      for (var m = 0; m < cars.length; m++) {
        var car = cars[m];
        if (car.lane !== p.lane) continue;
        if (fx < car.x + car.w && fx + fw > car.x && fy < car.y + car.h && fy + fh > car.y) { die('car', p); return; }
      }
    }
  }

  function togglePause(force) {
    if (state !== 'play' && state !== 'pause') return;
    var toPause = (typeof force === 'boolean') ? force : (state === 'play');
    if (toPause) {
      state = 'pause';
      openOverlay(T('gs.frogcross.pauseT'), T('gs.frogcross.pauseD'), [
        { label: T('gs.frogcross.resumeBtn'), cls: 'green', action: function () { togglePause(false); } }
      ]);
    } else {
      state = 'play';
      closeOverlay();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function updatePadVisibility() {
    var touch = window.Arcade && Arcade.input && Arcade.input.isTouch && Arcade.input.isTouch();
    wrap.querySelector('#fr-pads').style.display = touch ? '' : 'none';
    padBox2.hidden = !duo;
    label1.textContent = duo ? 'P1' : '';
    modeBtn.textContent = duo ? T('gs.frogcross.soloMode') : T('gs.frogcross.duoMode');
  }

  /* ---------- 渲染 ---------- */
  var CAR_PAL = ['#ff2d95', '#00f0ff', '#ffe600', '#a06bff', '#ff8a3d'];

  function waveY(x, base, amp, phase) {
    return base + Math.sin(x * 0.045 + clock * 0.0022 + phase) * amp;
  }

  function drawGoalBand() {
    var y = 0, h = LANE_H;
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#04240f'); g.addColorStop(0.55, '#0a3a1c'); g.addColorStop(1, '#06180c');
    ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
    var n = 6, cw = W / n;
    for (var i = 0; i < n; i++) {
      var cx = cw * i + cw / 2, cy = y + h * 0.56, r = Math.min(cw, h) * 0.3;
      var pulse = 0.3 + 0.18 * Math.sin(clock / 380 + i * 0.9);
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.25, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(57,255,20,0.07)'; ctx.fill();
      ctx.save();
      ctx.shadowColor = 'rgba(57,255,20,0.7)'; ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(57,255,20,' + pulse.toFixed(2) + ')'; ctx.lineWidth = 1.6;
      ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(57,255,20,0.22)'; ctx.lineWidth = 1;
    for (var b = 0; b < 26; b++) {
      var bx = (b * 41 + 13) % W, bh = 3 + (b * 13) % 8;
      ctx.beginPath(); ctx.moveTo(bx, y + h - 2); ctx.lineTo(bx + 2, y + h - 2 - bh); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(57,255,20,0.5)'; ctx.fillRect(0, y + h - 1, W, 1);
  }

  function drawWaterBand(lane) {
    var y = lane * LANE_H, h = LANE_H;
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#071a2e'); g.addColorStop(0.5, '#0a2a45'); g.addColorStop(1, '#071a2e');
    ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
    for (var i = 0; i < 3; i++) {
      var base = y + h * (0.26 + i * 0.23);
      ctx.strokeStyle = 'rgba(0,240,255,' + (0.07 + i * 0.03) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 10) {
        var yy = waveY(x, base, 2.4, i * 1.7 + lane);
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,240,255,0.10)';
    ctx.fillRect(0, y, W, 1);
    ctx.fillRect(0, y + h - 1, W, 1);
  }

  function drawRoadBand(lane) {
    var y = lane * LANE_H, h = LANE_H;
    ctx.fillStyle = '#14161d'; ctx.fillRect(0, y, W, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, y, W, 1); ctx.fillRect(0, y + h - 1, W, 1);
    ctx.strokeStyle = 'rgba(255,230,0,0.24)';
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 22]);
    ctx.lineDashOffset = -((clock * 0.06) % 38);
    ctx.beginPath(); ctx.moveTo(0, y + h / 2); ctx.lineTo(W, y + h / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 3); ctx.lineTo(W, y + 3);
    ctx.moveTo(0, y + h - 3); ctx.lineTo(W, y + h - 3);
    ctx.stroke();
  }

  function drawStartBand(lane) {
    var y = lane * LANE_H, h = LANE_H;
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#0b1d12'); g.addColorStop(1, '#0f2a16');
    ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
    ctx.fillStyle = 'rgba(0,240,255,0.35)'; ctx.fillRect(0, y, W, 1);
    ctx.strokeStyle = 'rgba(0,240,255,0.14)'; ctx.lineWidth = 1;
    for (var x = 8; x < W; x += 26) {
      ctx.beginPath(); ctx.moveTo(x, y + h - 8); ctx.lineTo(x + 6, y + h - 8); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,240,255,0.06)';
    ctx.fillRect(0, y + h - 3, W, 3);
  }

  function drawLog(pl) {
    var x = pl.x, y = pl.y, w = pl.w, h = pl.h;
    ctx.save();
    ctx.shadowColor = 'rgba(255,180,60,0.45)'; ctx.shadowBlur = 9;
    GK.roundRect(ctx, x, y, w, h, h / 2);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#8a5a2b'); g.addColorStop(0.45, '#c98b45'); g.addColorStop(1, '#6b4520');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,215,140,0.5)'; ctx.lineWidth = 1;
    GK.roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,25,0.5)'; ctx.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      var rx = x + 9 + i * ((w - 18) / 3 + 1);
      ctx.beginPath(); ctx.ellipse(rx, y + h / 2, 3.5, h / 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawLily(pl) {
    var x = pl.x, y = pl.y, w = pl.w, h = pl.h;
    var cx = x + w / 2, cy = y + h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(57,255,20,0.4)'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#3fbf5a'); g.addColorStop(1, '#1d6b33');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(8,30,52,0.92)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + w * 0.55, cy - h * 0.13);
    ctx.lineTo(cx + w * 0.55, cy + h * 0.13);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(160,255,180,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd6f2';
    ctx.beginPath(); ctx.arc(cx - 7, cy - 2, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx - 7, cy - 2, 1.1, 0, Math.PI * 2); ctx.fill();
  }

  function drawTurtle(pl) {
    var st = turtleState(pl);
    var x = pl.x, y = pl.y, w = pl.w, h = pl.h;
    var cx = x + w / 2, cy = y + h / 2;
    if (st === 'sink') {
      ctx.fillStyle = 'rgba(0,240,255,0.16)';
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.28, 3, 0, 0, Math.PI * 2); ctx.fill();
      for (var b = 0; b < 3; b++) {
        var bx = cx - 12 + b * 12, by = cy - ((clock / 6 + b * 9) % 18);
        ctx.strokeStyle = 'rgba(160,220,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.stroke();
      }
      return;
    }
    var warn = st === 'warn' && Math.floor(clock / 110) % 2 === 0;
    var shell = warn ? '#ffb020' : '#2f8f5b';
    var shellDark = warn ? '#7a4a00' : '#1c5c3a';
    var headX = pl.dir > 0 ? x + w - 4 : x + 4;
    ctx.fillStyle = '#7fd18b';
    ctx.beginPath(); ctx.arc(headX, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1a10';
    ctx.beginPath(); ctx.arc(headX + (pl.dir > 0 ? 1.5 : -1.5), cy - 1.4, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.shadowColor = warn ? 'rgba(255,176,32,0.75)' : 'rgba(47,143,91,0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = shell; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = shellDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
    for (var r = 1; r <= 2; r++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, (w / 2 - 5) * (r / 2.6), (h / 2 - 4) * (r / 2.6), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawCar(c) {
    var col = CAR_PAL[(c.lane * 3 + (c.w > 50 ? 2 : 0)) % CAR_PAL.length];
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    GK.roundRect(ctx, c.x, c.y, c.w, c.h, 6);
    ctx.fillStyle = col; ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(4,10,20,0.62)';
    GK.roundRect(ctx, c.x + 8, c.y + 4, c.w - 16, c.h * 0.42, 3); ctx.fill();
    var lampX = c.dir > 0 ? c.x + c.w - 3 : c.x + 1;
    ctx.fillStyle = '#fffce8';
    ctx.fillRect(lampX, c.y + 3, 2, 4);
    ctx.fillRect(lampX, c.y + c.h - 7, 2, 4);
    ctx.fillStyle = 'rgba(255,45,90,0.85)';
    var tailX = c.dir > 0 ? c.x + 1 : c.x + c.w - 3;
    ctx.fillRect(tailX, c.y + 4, 2, 3);
    ctx.fillRect(tailX, c.y + c.h - 7, 2, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    GK.roundRect(ctx, c.x, c.y, c.w, c.h, 6); ctx.stroke();
  }

  function drawFly(fly) {
    var bob = Math.sin(clock / 210 + fly.phase) * 2;
    var x = fly.x, y = fly.y + bob;
    var flap = Math.abs(Math.sin(clock / 70 + fly.phase)) * 3 + 1;
    ctx.fillStyle = 'rgba(220,245,255,0.55)';
    ctx.beginPath(); ctx.ellipse(x - 3, y - 3, 3, flap, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 3, y - 3, 3, flap, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.ellipse(x, y, 3.2, 4.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,40,0,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke();
  }

  function drawFrog(p) {
    if (!p.alive) return;
    var x = p.x, y = p.y, s = FROG_SIZE;
    var diving = p.diveTimer > 0;
    var cx = x + s / 2, cy = y + s / 2;
    if (diving) {
      ctx.strokeStyle = 'rgba(0,240,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.62, s * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(57,255,20,0.32)';
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.28, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    var col = p.color === 'cyan' ? '#00f0ff' : '#39ff14';
    var dark = p.color === 'cyan' ? '#00626e' : '#1a7a10';
    var inv = p.invuln > 0 && Math.floor(clock / 90) % 2 === 0;
    var sq = clamp(p.squash, 0, 1);
    var sw = s * (1 + sq * 0.22), sh = s * (1 - sq * 0.24);
    ctx.save();
    ctx.globalAlpha = inv ? 0.5 : 1;
    /* 后腿 */
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(x + sw * 0.16, y + sh * 0.84, s * 0.2, s * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + sw * 0.84, y + sh * 0.84, s * 0.2, s * 0.1, 0.5, 0, Math.PI * 2); ctx.fill();
    /* 身体 */
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(cx, y + sh * 0.56, sw * 0.42, sh * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, y + sh * 0.66, sw * 0.27, sh * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    /* 眼睛 */
    var ex = sw * 0.19, ey = y + sh * 0.2;
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx - ex, ey, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ex, ey, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6ffe9';
    ctx.beginPath(); ctx.arc(cx - ex, ey, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ex, ey, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#06120a';
    ctx.beginPath(); ctx.arc(cx - ex + 1, ey + 1, s * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ex - 1, ey + 1, s * 0.045, 0, Math.PI * 2); ctx.fill();
    /* 双人标识 */
    if (duo) {
      ctx.strokeStyle = p.color === 'cyan' ? 'rgba(0,240,255,0.85)' : 'rgba(57,255,20,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, y + sh * 0.56, s * 0.58, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function fxBurst(x, y, rgb, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 4;
      droplets.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8,
        life: 1, kind: 'spark', color: rgb, size: 1.2 + Math.random() * 2 });
    }
    shockwaves.push({ x: x, y: y, r: 4, life: 1, color: rgb });
  }

  function drawFx() {
    var i, e;
    for (i = 0; i < ripples.length; i++) {
      e = ripples[i];
      ctx.strokeStyle = 'rgba(180,230,255,' + (e.life * 0.55).toFixed(2) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r, e.r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (i = 0; i < shockwaves.length; i++) {
      e = shockwaves[i];
      ctx.strokeStyle = 'rgba(' + e.color + ',' + (e.life * 0.7).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (i = 0; i < droplets.length; i++) {
      e = droplets[i];
      ctx.globalAlpha = Math.max(0, e.life);
      ctx.fillStyle = e.color ? 'rgb(' + e.color + ')' : (e.kind === 'water' ? '#9ad1ff' : '#ffd6e8');
      ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < bubbles.length; i++) {
      e = bubbles[i];
      ctx.strokeStyle = 'rgba(190,235,255,' + Math.max(0, e.life * 0.6).toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (i = 0; i < fxTexts.length; i++) {
      e = fxTexts[i];
      ctx.globalAlpha = Math.max(0, e.life);
      ctx.fillStyle = e.color;
      ctx.fillText(e.text, e.x, e.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (!laneTypes.length) return;
    for (var i = 0; i < laneTypes.length; i++) {
      var t = laneTypes[i];
      if (t === 'goal') drawGoalBand();
      else if (t === 'river') drawWaterBand(i);
      else if (t === 'road') drawRoadBand(i);
      else drawStartBand(i);
    }
    for (var j = 0; j < platforms.length; j++) {
      var pl = platforms[j];
      if (pl.kind === 'turtle') drawTurtle(pl);
      else if (pl.kind === 'lily') drawLily(pl);
      else drawLog(pl);
    }
    for (var k = 0; k < cars.length; k++) drawCar(cars[k]);
    for (var f = 0; f < flies.length; f++) drawFly(flies[f]);
    for (var p = 0; p < players.length; p++) drawFrog(players[p]);
    drawFx();
    if (hitFlash > 0.02) {
      ctx.fillStyle = 'rgba(255,45,149,' + (hitFlash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- 潜水按钮状态 ---------- */
  function updateDiveUI() {
    function sync(btn, p) {
      if (!btn || !p) return;
      var ready = p.diveCool <= 0 && p.diveTimer <= 0;
      if (btn.__ready !== ready) { btn.__ready = ready; btn.classList.toggle('ready', ready); }
      var small = btn.querySelector('small');
      if (!small) return;
      var txt = ready ? T('gs.frogcross.diveReady') : (Math.max(0, p.diveCool) / 1000).toFixed(1) + 's';
      if (small.__v !== txt) { small.__v = txt; small.textContent = txt; }
    }
    sync(diveBtn1, players[0]);
    sync(diveBtn2, players[1]);
  }

  /* ---------- 输入 ---------- */
  var P1_KEYS = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  var P2_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault(); togglePause(); return;
      }
      if (state !== 'play') return;
      var dir = null, p = null;
      if (duo) {
        if (P1_KEYS[e.code]) { dir = P1_KEYS[e.code]; p = players[0]; }
        else if (P2_KEYS[e.code]) { dir = P2_KEYS[e.code]; p = players[1]; }
        else if (e.code === 'Space') { e.preventDefault(); dive(players[0]); return; }
        else if (e.code === 'Enter') { e.preventDefault(); dive(players[1]); return; }
      } else {
        dir = P1_KEYS[e.code] || P2_KEYS[e.code];
        p = players[0];
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault(); dive(p); return;
        }
      }
      if (!dir || !p) return;
      e.preventDefault();
      move(dir, p);
    });

    if (window.Arcade && Arcade.input) {
      if (Arcade.input.createDPad) {
        Arcade.input.createDPad(wrap.querySelector('#fr-dpad1'), function (dir, pressed) {
          if (pressed) move(dir, players[0]);
        });
        Arcade.input.createDPad(wrap.querySelector('#fr-dpad2'), function (dir, pressed) {
          if (pressed) move(dir, players[1]);
        });
      }
      if (Arcade.input.onSwipe) {
        Arcade.input.onSwipe(canvas, function (dir) {
          move(dir, players[duo ? 0 : 0]);
        });
      }
    }

    function bindDive(btn, idx) {
      if (!btn) return;
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        dive(players[idx]);
      });
    }
    bindDive(diveBtn1, 0);
    bindDive(diveBtn2, 1);
  }

  /* ---------- 启动 / 覆盖层 ---------- */
  function showStart() {
    state = 'ready';
    if (transTimer) { clearTimeout(transTimer); transTimer = null; }
    players = [];
    level = 1;
    elapsedMs = 0; fliesEaten = 0; flies = []; fxTexts = [];
    droplets = []; ripples = []; shockwaves = []; bubbles = [];
    buildLanes(1); makeCars(1); makePlatforms(1);
    renderHUD();
    updatePadVisibility();
    openOverlay(T('gs.frogcross.startT'), T('gs.frogcross.startD'), [
      { label: T('gs.frogcross.startBtn'), cls: 'green', action: function () { duo = false; newGame(); } },
      { label: T('gs.frogcross.duoStartBtn'), cls: '', action: function () { duo = true; newGame(); } }
    ]);
  }

  if (pauseBtn) pauseBtn.addEventListener('click', function () { togglePause(); });
  if (restartBtn) restartBtn.addEventListener('click', function () { newGame(); });
  if (modeBtn) modeBtn.addEventListener('click', function () {
    duo = !duo;
    showStart();
  });

  window.GAME_RESTART = function () { newGame(); };

  /* helpText（沿用原页面结构） */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.frogcross.helpText');
  root.appendChild(hd);

  /* ---------- QA（仅 ?qa=1 时暴露） ---------- */
  try {
    if (/[?&]qa=1/.test(location.search)) {
      window.__qa = {
        get state() { return state; },
        get info() {
          return {
            state: state, duo: duo, level: level, lanes: laneTypes.slice(),
            time: Math.round(elapsedMs), flies: fliesEaten,
            players: players.map(function (p) {
              return { lane: p.lane, x: p.x, y: p.y, lives: p.lives, alive: p.alive, progress: p.progress, dive: p.diveTimer, cool: p.diveCool };
            })
          };
        },
        start: function (d) { duo = !!d; newGame(); return true; },
        move: function (dir, idx) { move(dir, players[idx || 0]); return state; },
        dive: function (idx) { dive(players[idx || 0]); return true; },
        forceFly: function () { spawnFly(); return flies.length; },
        eatFly: function (idx) { if (flies.length) eatFly(flies[0], players[idx || 0]); return fliesEaten; },
        nextLevel: function (idx) { nextLevel(players[idx || 0]); return level; },
        win: function () { if (players.length && duo) winMatch(players[0], 'goal'); else winGame(); return state; },
        lose: function () { gameOver('qa'); return state; },
        ready: function () { showStart(); return state; }
      };
    }
  } catch (e) {}

  bindInput();
  showStart();
  Arcade.loop.start(update, render, 16);
})();
