/* ============================================================
   像素恐龙 Pixel Dino（旗舰版）
   在既有跑酷逻辑上增量增强：
   金币 / 三种道具（磁铁、护盾、时缓）/ 每局随机任务 / 暴龙首领追逐 /
   晴雨沙尘夜随机天气 / 粒子·屏震·浮动文字·湿滑与顺风机制差异
   原有恐龙脚底基线绘制、AABB 判定、难度、暂停、结算、触屏与 submitScore 全部保留。
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.pixeldino.tut1t'), d: T('gs.pixeldino.tut1') },
  { t: T('gs.pixeldino.tut2t'), d: T('gs.pixeldino.tut2') },
  { t: T('gs.pixeldino.tut3t'), d: T('gs.pixeldino.tut3') },
  { t: T('gs.pixeldino.tut4t'), d: T('gs.pixeldino.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;
  var W = 640, H = 300, GROUND = 248;
  var GRAV = 0.6, JUMP_V = -13;
  var PI2 = Math.PI * 2;

  var DIFFS = {
    easy:   { key: 'gs.pixeldino.dEasy',   start: 5.2, step: 0.6 },
    normal: { key: 'gs.pixeldino.dNormal', start: 6.4, step: 0.8 },
    hard:   { key: 'gs.pixeldino.dHard',   start: 7.8, step: 1.0 }
  };
  /* BEST_KEY 只存「最远距离」（arcade_best_pixeldino，data-best-mode=max）；
     综合分（距离+金币×10+奖励）另存独立键 arcade_best_pixeldino_score，互不覆盖 */
  var BEST_KEY = (Arcade.shell && Arcade.shell.gameId) || 'pixeldino';
  var SCORE_KEY = BEST_KEY + '_score';
  var QA = /(?:^|[?&])qa=1(?:&|$)/.test(window.location.search);

  /* ---------------- 天气 / 道具 / 任务定义 ---------------- */
  var WEATHERS = {
    sunny: { key: 'gs.pixeldino.wSunny', speed: 1.0,  jump: 1.0,  grav: 1.0 },
    rain:  { key: 'gs.pixeldino.wRain',  speed: 0.98, jump: 0.93, grav: 1.08 },
    sand:  { key: 'gs.pixeldino.wSand',  speed: 1.05, jump: 1.0,  grav: 1.0 },
    night: { key: 'gs.pixeldino.wNight', speed: 1.0,  jump: 1.0,  grav: 1.0 }
  };
  var WEATHER_ORDER = ['sunny', 'rain', 'sand', 'night'];

  var SKY_PALETTES = {
    sunny: ['#10294a', '#1d5277', '#2c6f86'],
    rain:  ['#0a1018', '#16303a', '#2a4a52'],
    sand:  ['#3b2412', '#8a5424', '#c98a3e'],
    night: ['#05060f', '#0b1226', '#141f3d']
  };

  var POWERS = {
    magnet: { key: 'gs.pixeldino.powerMagnet', color: '#ff2d95', dur: 480 },
    shield: { key: 'gs.pixeldino.powerShield', color: '#00f0ff', dur: 600 },
    slow:   { key: 'gs.pixeldino.powerSlow',   color: '#b967ff', dur: 360 }
  };
  var POWER_ORDER = ['magnet', 'shield', 'slow'];

  var TASK_POOL = [
    { type: 'coins', key: 'gs.pixeldino.taskCoins', reward: 40, need: { easy: 10, normal: 15, hard: 22 } },
    { type: 'dist',  key: 'gs.pixeldino.taskDist',  reward: 50, need: { easy: 500, normal: 800, hard: 1100 } },
    { type: 'dodge', key: 'gs.pixeldino.taskDodge', reward: 45, need: { easy: 5, normal: 6, hard: 8 } },
    { type: 'power', key: 'gs.pixeldino.taskPower', reward: 35, need: { easy: 2, normal: 2, hard: 3 } },
    { type: 'boss',  key: 'gs.pixeldino.taskBoss',  reward: 60, need: { easy: 1, normal: 1, hard: 1 } }
  ];

  var wrap = document.createElement('div');
  wrap.className = 'dn-wrap';
  wrap.innerHTML =
    '<div class="dn-top">' +
    '  <span><span class="dn-ico dn-ico-coin" aria-hidden="true"></span> <b id="dn-coins">0</b></span>' +
    '  <span>' + T('gs.pixeldino.distance') + ' <b id="dn-score">0</b>m</span>' +
    '  <span>' + T('gs.pixeldino.score') + ' <b id="dn-points">0</b></span>' +
    '  <span>' + T('gs.pixeldino.best') + ' <b id="dn-best">0</b></span>' +
    '  <span>' + T('gs.pixeldino.speed') + ' <b id="dn-speed">1.00x</b></span>' +
    '  <span class="dn-weather"><span class="dn-ico dn-ico-w-sunny" id="dn-w-ico" aria-hidden="true"></span>' +
    '    <span id="dn-w-txt"></span></span>' +
    '</div>' +
    '<div class="dn-stage" id="dn-stage">' +
    '  <canvas class="dn-canvas" id="dn-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '</div>' +
    '<div class="dn-power" id="dn-power" aria-label="' + T('gs.pixeldino.powerMagnet') + '">' +
    '  <span class="dn-pw" data-pw="magnet" title="' + T('gs.pixeldino.powerMagnet') + '">' +
    '    <span class="dn-ico dn-ico-magnet" aria-hidden="true"></span><i><em></em></i></span>' +
    '  <span class="dn-pw" data-pw="shield" title="' + T('gs.pixeldino.powerShield') + '">' +
    '    <span class="dn-ico dn-ico-shield" aria-hidden="true"></span><i><em></em></i></span>' +
    '  <span class="dn-pw" data-pw="slow" title="' + T('gs.pixeldino.powerSlow') + '">' +
    '    <span class="dn-ico dn-ico-slow" aria-hidden="true"></span><i><em></em></i></span>' +
    '</div>' +
    '<div class="dn-boss hidden" id="dn-boss">' +
    '  <div class="dn-boss-top"><span id="dn-boss-name"></span><b id="dn-boss-pct">100%</b></div>' +
    '  <div class="dn-boss-bar dn-boss-hp"><i id="dn-boss-hp"></i></div>' +
    '  <div class="dn-boss-bar dn-boss-chase"><i id="dn-boss-chase"></i></div>' +
    '</div>' +
    '<div class="dn-tasks idle" id="dn-tasks"></div>' +
    /* 遮罩挂在 .dn-wrap 上（而非画布盒）：画布高度仅由宽高比决定，窄屏下卡片会比画布高，
       若以画布为定位基准会向上溢出到顶栏后面，标题被遮住 */
    '  <div class="dn-over" id="dn-over">' +
    '    <div class="dn-card">' +
    '      <div class="dn-title" id="dn-ov-title"></div>' +
    '      <div class="dn-hint" id="dn-ov-hint"></div>' +
    '      <div class="dn-stats hidden" id="dn-ov-stats">' +
    '        <span>' + T('gs.pixeldino.ovScore') + ' <b id="dn-final-score">0</b></span>' +
    '        <span>' + T('gs.pixeldino.ovCoins') + ' <b id="dn-final-coins">0</b></span>' +
    '        <span>' + T('gs.pixeldino.ovDist') + ' <b id="dn-final">0</b>m</span>' +
    '        <span>' + T('gs.pixeldino.best') + ' <b id="dn-final-best">0</b>m</span>' +
    '        <span>' + T('gs.pixeldino.bestScore') + ' <b id="dn-final-best-score">0</b></span>' +
    '      </div>' +
    '      <div class="dn-ov-tasks hidden" id="dn-ov-tasks">' +
    '        <div class="dn-ov-lbl">' + T('gs.pixeldino.tasksLbl') + '</div>' +
    '        <div id="dn-ov-task-list"></div>' +
    '      </div>' +
    '      <div class="dn-diff" id="dn-diff">' +
    '        <span class="dn-diff-lbl">' + T('gs.pixeldino.diffLbl') + '</span>' +
    '        <button class="btn mode-btn" data-diff="easy">' + T('gs.pixeldino.dEasy') + '</button>' +
    '        <button class="btn mode-btn selected" data-diff="normal">' + T('gs.pixeldino.dNormal') + '</button>' +
    '        <button class="btn mode-btn" data-diff="hard">' + T('gs.pixeldino.dHard') + '</button>' +
    '      </div>' +
    '      <button class="btn green" id="dn-start-btn">' + T('gs.pixeldino.start') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="dn-over hidden" id="dn-pause">' +
    '    <div class="dn-card">' +
    '      <div class="dn-title">' + T('gs.pixeldino.pauseTitle') + '</div>' +
    '      <div class="dn-hint">' + T('gs.pixeldino.pauseHint') + '</div>' +
    '      <button class="btn green" id="dn-resume">' + T('gs.pixeldino.resume') + '</button>' +
    '      <button class="btn" id="dn-pause-restart">' + T('gs.pixeldino.restart') + '</button>' +
    '    </div>' +
    '  </div>' +
    '<div class="dn-msg" id="dn-msg">' + T('gs.pixeldino.help') + '</div>' +
    '<div class="dn-touch" id="dn-touch">' +
    '  <button class="btn" id="dn-duck">' + T('gs.pixeldino.duckBtn') + '</button>' +
    '  <button class="btn yellow" id="dn-jump">' + T('gs.pixeldino.jumpBtn') + '</button>' +
    '</div>' +
    '<div class="game-controls">' +
    '  <button id="dn-pause-btn" class="btn purple">' + T('gs.pixeldino.pauseBtn') + '</button>' +
    '  <button id="dn-restart" class="btn purple">' + T('gs.pixeldino.restart') + '</button>' +
    '</div>';

  root.appendChild(wrap);

  var canvas = wrap.querySelector('#dn-canvas');
  var ctx;
  if (window.GK) ctx = GK.setup(canvas, W, H).ctx;
  else { ctx = canvas.getContext('2d'); if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas); }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = W + 'px';

  var stageEl = wrap.querySelector('#dn-stage');
  var scoreEl = wrap.querySelector('#dn-score');
  var pointsEl = wrap.querySelector('#dn-points');
  var coinsEl = wrap.querySelector('#dn-coins');
  var speedEl = wrap.querySelector('#dn-speed');
  var wIcoEl = wrap.querySelector('#dn-w-ico');
  var wTxtEl = wrap.querySelector('#dn-w-txt');
  var bestEl = wrap.querySelector('#dn-best');
  var bestScoreEl = wrap.querySelector('#dn-best-score'); // 综合分只在结算面板展示
  var msgEl = wrap.querySelector('#dn-msg');
  var overEl = wrap.querySelector('#dn-over');
  var pauseEl = wrap.querySelector('#dn-pause');
  var ovTitle = wrap.querySelector('#dn-ov-title');
  var ovHint = wrap.querySelector('#dn-ov-hint');
  var ovStats = wrap.querySelector('#dn-ov-stats');
  var ovTasks = wrap.querySelector('#dn-ov-tasks');
  var ovTaskList = wrap.querySelector('#dn-ov-task-list');
  var finalScoreEl = wrap.querySelector('#dn-final-score');
  var finalCoinsEl = wrap.querySelector('#dn-final-coins');
  var finalEl = wrap.querySelector('#dn-final');
  var finalBestEl = wrap.querySelector('#dn-final-best');
  var finalBestScoreEl = wrap.querySelector('#dn-final-best-score');
  var startBtn = wrap.querySelector('#dn-start-btn');
  var diffRow = wrap.querySelector('#dn-diff');
  var touchRow = wrap.querySelector('#dn-touch');
  var tasksEl = wrap.querySelector('#dn-tasks');
  var bossEl = wrap.querySelector('#dn-boss');
  var bossHpEl = wrap.querySelector('#dn-boss-hp');
  var bossChaseEl = wrap.querySelector('#dn-boss-chase');
  var bossPctEl = wrap.querySelector('#dn-boss-pct');
  wrap.querySelector('#dn-boss-name').textContent = T('gs.pixeldino.bossName');
  var pwEls = {
    magnet: wrap.querySelector('.dn-pw[data-pw="magnet"]'),
    shield: wrap.querySelector('.dn-pw[data-pw="shield"]'),
    slow: wrap.querySelector('.dn-pw[data-pw="slow"]')
  };

  var S = {
    mode: 'ready', diff: 'normal', cfg: DIFFS.normal, paused: false,
    dino: { x: 70, feet: GROUND, vy: 0, onGround: true, jumps: 0, duck: false, runPhase: 0 },
    obstacles: [], coinList: [], pickups: [], fireballs: [], particles: [], floats: [],
    score: 0, maxDist: 0, coinCount: 0, bonus: 0, dodged: 0, picked: 0, bossWins: 0,
    speed: DIFFS.normal.start, effSpeed: DIFFS.normal.start,
    scrollFar: 0, scrollNear: 0, groundScroll: 0,
    shakeT: 0, flash: 0, dustT: 0, invuln: 0,
    spawnGap: 320, coinGap: 190, pickGap: 420,
    duckHeld: false, submitted: false,
    weather: 'sunny', wA: { sunny: 1, rain: 0, sand: 0, night: 0 }, weatherTimer: 900, banner: null,
    power: { magnet: 0, shield: 0, slow: 0 }, shieldCharges: 0,
    boss: null, bossNextAt: 620,
    tasks: []
  };
  var loopApi = null;

  /* ---------- 工具 ---------- */
  function audio(name) { if (Arcade.audio) Arcade.audio.play(name); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOutCubic(t) { t = 1 - t; return 1 - t * t * t; }
  function roundRect(x, y, w, h, r) {
    if (window.GK) { GK.roundRect(ctx, x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function rgb(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(c1, c2, t) {
    var a = rgb(c1), b = rgb(c2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function skyCol(i) {
    var r = 0, g = 0, b = 0, wsum = 0;
    for (var k in SKY_PALETTES) {
      var w = S.wA[k] || 0;
      if (w <= 0) continue;
      var c = rgb(SKY_PALETTES[k][i]);
      r += c[0] * w; g += c[1] * w; b += c[2] * w; wsum += w;
    }
    if (!wsum) return SKY_PALETTES.sunny[i];
    return 'rgb(' + Math.round(r / wsum) + ',' + Math.round(g / wsum) + ',' + Math.round(b / wsum) + ')';
  }
  function bestScore() {
    try { return (Arcade.storage && Arcade.storage.getBest(BEST_KEY)) || 0; } catch (e) { return 0; }
  }
  /* 综合分独立纪录：旧档无此键时按 0 展示，不影响距离纪录比较 */
  function bestCombined() {
    try { return (Arcade.storage && Arcade.storage.getBest(SCORE_KEY)) || 0; } catch (e) { return 0; }
  }
  function updateBest() {
    bestEl.textContent = String(bestScore());
    if (bestScoreEl) bestScoreEl.textContent = String(bestCombined());
  }
  function totalScore() { return Math.round(S.score) + S.coinCount * 10 + S.bonus; }
  function floatText(x, y, text, color) {
    S.floats.push({ x: x, y: y, text: text, color: color || '#ffe600', life: 1, vy: -0.9 });
  }
  function addBonus(n, text, x, y, color) {
    S.bonus += n;
    if (text) floatText(x == null ? W * 0.5 : x, y == null ? 110 : y, text, color || '#ffe600');
  }

  /* ---------- 天气 ---------- */
  function setWeather(w, silent) {
    if (!WEATHERS[w]) return;
    S.weather = w;
    var def = WEATHERS[w];
    var txt = T('gs.pixeldino.wSwitch').replace('{w}', T(def.key));
    if (!silent) {
      S.banner = { text: txt, t: 0, dur: 120 };
      msgEl.textContent = txt;
      msgEl.style.color = 'var(--neon-cyan)';
      audio('ui');
    }
    wTxtEl.textContent = T(def.key);
    wIcoEl.className = 'dn-ico dn-ico-w-' + w;
  }
  function updateWeatherWeights() {
    for (var k in S.wA) {
      var target = S.weather === k ? 1 : 0;
      S.wA[k] += (target - S.wA[k]) * 0.07;
    }
  }

  /* ---------- 任务 ---------- */
  function newTasks() {
    var pool = TASK_POOL.filter(function (x) { return x.type !== 'boss'; });
    var list = [];
    // 必含金币或距离任务，保证每局都有明确主线
    var first = Math.random() < 0.5 ? TASK_POOL[0] : TASK_POOL[1];
    list.push(first);
    var rest = pool.filter(function (x) { return x.type !== first.type; });
    shuffle(rest);
    list.push(rest[0]);
    if (Math.random() < 0.4) list.push(TASK_POOL[4]);
    else list.push(rest[1]);
    S.tasks = list.map(function (def) {
      var need = def.need[S.diff] || def.need.normal;
      return { type: def.type, key: def.key, reward: def.reward, need: need, progress: 0, done: false, els: null, ovEls: null };
    });
    renderTaskRows();
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function taskLabel(t) { return T(t.key).replace('{n}', t.need); }
  function taskValue(t) {
    if (t.type === 'coins') return S.coinCount;
    if (t.type === 'dist') return Math.floor(S.score);
    if (t.type === 'dodge') return S.dodged;
    if (t.type === 'power') return S.picked;
    if (t.type === 'boss') return S.bossWins;
    return 0;
  }
  function makeTaskRow(t, compact) {
    var row = document.createElement('div');
    row.className = 'dn-task';
    var nm = document.createElement('span');
    nm.className = 'dn-task-nm';
    nm.textContent = taskLabel(t);
    var val = document.createElement('span');
    val.className = 'dn-task-val';
    var bar = document.createElement('span');
    bar.className = 'dn-task-bar';
    var fill = document.createElement('i');
    bar.appendChild(fill);
    row.appendChild(nm); row.appendChild(val); row.appendChild(bar);
    var refs = { row: row, val: val, fill: fill };
    row.__refs = refs;
    return row;
  }
  function renderTaskRows() {
    tasksEl.innerHTML = '';
    ovTaskList.innerHTML = '';
    for (var i = 0; i < S.tasks.length; i++) {
      var t = S.tasks[i];
      var row = makeTaskRow(t, false);
      tasksEl.appendChild(row);
      t.els = row.__refs;
    }
    tasksEl.classList.toggle('idle', S.mode === 'ready');
    updateTaskHud();
  }
  function updateTaskHud(force) {
    for (var i = 0; i < S.tasks.length; i++) {
      var t = S.tasks[i];
      var v = taskValue(t);
      if (v > t.progress || !t.els) t.progress = v;
      var p = Math.min(t.progress, t.need);
      var pct = t.need ? Math.round(p / t.need * 100) : 0;
      if (t.els) {
        if (t.els.val.textContent !== p + '/' + t.need) t.els.val.textContent = p + '/' + t.need;
        t.els.fill.style.width = pct + '%';
        t.els.row.classList.toggle('done', t.done);
      }
      if (!t.done && p >= t.need) {
        t.done = true;
        addBonus(t.reward, '+ ' + t.reward, W * 0.55, 120, '#39ff14');
        msgEl.textContent = T('gs.pixeldino.taskDone').replace('{t}', taskLabel(t)).replace('{n}', t.reward);
        msgEl.style.color = 'var(--neon-green)';
        if (t.els) {
          t.els.row.classList.add('done');
          t.els.fill.style.width = '100%';
          t.els.val.textContent = p + '/' + t.need;
        }
        audio('coin');
      }
    }
  }

  /* ---------- 道具 ---------- */
  function activePower(key) { return S.power[key] > 0; }
  function activatePower(key) {
    S.power[key] = POWERS[key].dur;
    if (key === 'shield') S.shieldCharges = 1;
    S.picked++;
    var msg = key === 'magnet' ? 'gs.pixeldino.gotMagnet' : key === 'shield' ? 'gs.pixeldino.gotShield' : 'gs.pixeldino.gotSlow';
    msgEl.textContent = T(msg);
    msgEl.style.color = POWERS[key].color;
    S.banner = { text: T(msg), t: 0, dur: 90 };
    floatText(S.dino.x + 22, S.dino.feet - 70, T(POWERS[key].key), POWERS[key].color);
    audio('record');
    burst(S.dino.x + 22, S.dino.feet - 30, 14, POWERS[key].color);
  }
  function updatePowerHud() {
    for (var i = 0; i < POWER_ORDER.length; i++) {
      var k = POWER_ORDER[i];
      var on = S.power[k] > 0;
      var el = pwEls[k];
      if (!el) continue;
      el.classList.toggle('on', on);
      el.querySelector('em').style.width = on ? Math.round(S.power[k] / POWERS[k].dur * 100) + '%' : '0%';
    }
  }

  /* ---------- 金币 / 拾取物 ---------- */
  function spawnCoinArc() {
    var n = 3 + Math.floor(Math.random() * 3);
    var arc = Math.random() < 0.55;
    var step = 30;
    for (var i = 0; i < n; i++) {
      var x = W + 24 + i * step;
      var y = arc ? GROUND - 20 - Math.sin(i / (n - 1) * Math.PI) * 62 : GROUND - 16;
      S.coinList.push({ x: x, y: y, phase: rand(0, 6), taken: false });
    }
  }
  function spawnPickup() {
    var key = POWER_ORDER[Math.floor(Math.random() * POWER_ORDER.length)];
    S.pickups.push({
      kind: key, x: W + 30, y: GROUND - (Math.random() < 0.55 ? 78 : 24),
      phase: rand(0, 6)
    });
  }
  function collectCoin(c) {
    c.taken = true;
    S.coinCount++;
    floatText(c.x, c.y - 4, '+10', '#ffe600');
    for (var i = 0; i < 5; i++) {
      S.particles.push({
        x: c.x, y: c.y, vx: rand(-1.8, 1.8), vy: rand(-2.4, -0.4),
        life: 1, size: rand(1.2, 2.4), color: '#ffe600'
      });
    }
    audio('coin');
  }

  /* ---------- 暴龙首领 ---------- */
  function startBoss() {
    if (S.boss) return;
    S.boss = {
      hp: 100, maxHp: 100, t: 0, dur: 660, x: -190, state: 'in', outT: 0,
      throwT: 52, charge: 0, fireKind: 'low', hitFlash: 0
    };
    S.obstacles = [];
    S.banner = { text: T('gs.pixeldino.bossWarn'), t: 0, dur: 130 };
    msgEl.textContent = T('gs.pixeldino.bossWarn');
    msgEl.style.color = 'var(--neon-pink)';
    S.shakeT = 14;
    bossEl.classList.remove('hidden');
    bossPctEl.textContent = '100%';
    bossHpEl.style.width = '100%';
    bossChaseEl.style.width = '100%';
    audio('error');
    if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
  }
  function bossReward(defeated) {
    var b = S.boss;
    if (!b || b.state === 'out') return;
    b.state = 'out';
    b.outT = 0;
    S.bossWins++;
    var reward = defeated ? 150 : 60;
    var coins = defeated ? 8 : 6;
    S.coinCount += coins;
    addBonus(reward, '+ ' + reward, W * 0.5, 100, '#ffe600');
    S.banner = {
      text: T(defeated ? 'gs.pixeldino.bossDefeat' : 'gs.pixeldino.bossSurvive').replace('{n}', reward),
      t: 0, dur: 130
    };
    if (defeated) {
      S.shakeT = 18;
      S.flash = 0.7;
      if (Arcade.fx) { Arcade.fx.flash('var(--neon-yellow)'); Arcade.fx.shake(stageEl); }
      audio('win');
    } else {
      audio('record');
    }
    bossEl.classList.add('hidden');
  }
  function spawnFireball() {
    var b = S.boss;
    if (!b) return;
    b.charge = 22;
    b.fireKind = Math.random() < 0.5 ? 'low' : 'high';
  }
  function launchFireball() {
    var b = S.boss;
    if (!b) return;
    var y = b.fireKind === 'low' ? GROUND - 14 : GROUND - 50;
    S.fireballs.push({ x: -30, y: y, vy: 0, r: 9, passed: false, trail: 0, kind: b.fireKind });
    audio('move');
  }
  function updateBoss(eff) {
    var b = S.boss;
    if (!b) return;
    b.t++;
    if (b.hitFlash > 0) b.hitFlash--;
    if (b.state === 'in') {
      var p = clamp(b.t / 55, 0, 1);
      b.x = -200 + easeOutCubic(p) * 162;
      if (p >= 1) b.state = 'active';
    } else if (b.state === 'active') {
      b.x = -38 + Math.sin(b.t * 0.08) * 3;
      b.throwT--;
      if (b.charge > 0) {
        b.charge--;
        if (b.charge === 0) launchFireball();
      } else if (b.throwT <= 0) {
        spawnFireball();
        b.throwT = 56 + Math.floor(rand(0, 22));
      }
      if (b.hp <= 0) { bossReward(true); return; }
      if (b.t >= b.dur) { bossReward(false); return; }
    } else if (b.state === 'out') {
      b.outT++;
      b.x -= 5;
      if (b.outT > 55) {
        S.boss = null;
        S.bossNextAt = Math.round(S.score) + 760;
        bossEl.classList.add('hidden');
        finishRun(true);
        return;
      }
    }
    if (S.boss) {
      var hp = clamp(b.hp / b.maxHp, 0, 1);
      bossHpEl.style.width = Math.round(hp * 100) + '%';
      bossPctEl.textContent = Math.round(hp * 100) + '%';
      if (b.state === 'active') {
        bossChaseEl.style.width = Math.round((1 - b.t / b.dur) * 100) + '%';
      } else if (b.state === 'in') {
        bossChaseEl.style.width = '100%';
      } else {
        bossChaseEl.style.width = '0%';
      }
    }
    // 火球推进
    for (var i = S.fireballs.length - 1; i >= 0; i--) {
      var f = S.fireballs[i];
      f.x += (4.0 + eff * 0.18);
      f.trail++;
      if (!f.passed && f.x > dinoBox().x + dinoBox().w) {
        f.passed = true;
        b.hp = Math.max(0, b.hp - 12);
        b.hitFlash = 8;
        floatText(100, f.y - 10, '-' + 12, '#ff2d95');
        msgEl.textContent = T('gs.pixeldino.bossHit');
        msgEl.style.color = 'var(--neon-pink)';
        audio('coin');
      }
      if (f.x > W + 30) S.fireballs.splice(i, 1);
    }
  }

  function burst(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      S.particles.push({
        x: x + rand(-6, 6), y: y + rand(-8, 8),
        vx: rand(-2.6, 2.6), vy: rand(-3.4, 0.4),
        life: 1, size: rand(1.4, 3), color: color || '#ffe600'
      });
    }
  }

  /* ---------- 状态切换 / 结算 ---------- */
  function renderOverlayTasks() {
    ovTaskList.innerHTML = '';
    for (var i = 0; i < S.tasks.length; i++) {
      var t = S.tasks[i];
      var row = makeTaskRow(t, true);
      var refs = row.__refs;
      var p = Math.min(t.progress, t.need);
      refs.val.textContent = t.done ? '✓ +' + t.reward : p + '/' + t.need;
      refs.fill.style.width = (t.need ? Math.round(p / t.need * 100) : 0) + '%';
      if (t.done) row.classList.add('done');
      ovTaskList.appendChild(row);
    }
  }
  function showOverlay(kind) {
    overEl.classList.remove('hidden');
    var ended = kind !== 'ready';
    ovStats.classList.toggle('hidden', !ended);
    ovTasks.classList.toggle('hidden', !ended);
    if (kind === 'dead') {
      ovTitle.textContent = T('gs.pixeldino.deadTitle');
      ovHint.textContent = T('gs.pixeldino.deadHint');
    } else if (kind === 'win') {
      ovTitle.textContent = T('gs.pixeldino.winTitle');
      ovHint.textContent = T('gs.pixeldino.winHint');
    } else {
      ovTitle.textContent = T('gs.pixeldino.readyTitle');
      ovHint.textContent = T('gs.pixeldino.readyHint');
    }
    startBtn.textContent = ended ? T('gs.pixeldino.restart') : T('gs.pixeldino.start');
    if (ended) {
      finalScoreEl.textContent = String(totalScore());
      finalCoinsEl.textContent = String(S.coinCount);
      finalEl.textContent = String(Math.round(S.maxDist || S.score));
      finalBestEl.textContent = String(bestScore());
      finalBestScoreEl.textContent = String(bestCombined());
      renderOverlayTasks();
    }
    tasksEl.classList.toggle('idle', !ended && S.mode === 'ready');
  }
  function hideOverlay() { overEl.classList.add('hidden'); }

  function resetRun(diff) {
    S.diff = diff || S.diff;
    S.cfg = DIFFS[S.diff] || DIFFS.normal;
    S.mode = 'run';
    S.paused = false;
    S.dino = { x: 70, feet: GROUND, vy: 0, onGround: true, jumps: 0, duck: false, runPhase: 0 };
    S.obstacles = [];
    S.coinList = [];
    S.pickups = [];
    S.fireballs = [];
    S.particles = [];
    S.floats = [];
    S.score = 0;
    S.maxDist = 0;
    S.coinCount = 0;
    S.bonus = 0;
    S.dodged = 0;
    S.picked = 0;
    S.bossWins = 0;
    S.speed = S.cfg.start;
    S.effSpeed = S.cfg.start;
    S.shakeT = 0;
    S.flash = 0;
    S.dustT = 0;
    S.invuln = 0;
    S.spawnGap = 320;
    S.coinGap = 190;
    S.pickGap = 420;
    S.duckHeld = false;
    S.submitted = false;
    S.power = { magnet: 0, shield: 0, slow: 0 };
    S.shieldCharges = 0;
    S.boss = null;
    S.bossNextAt = 620;
    S.weatherTimer = 760 + Math.floor(rand(0, 320));
    S.banner = null;
    S.weather = 'sunny';
    S.wA = { sunny: 1, rain: 0, sand: 0, night: 0 };
    bossEl.classList.add('hidden');
    hideOverlay();
    pauseEl.classList.add('hidden');
    msgEl.textContent = T('gs.pixeldino.help');
    msgEl.style.color = '';
    setWeather('sunny', true);
    newTasks();
    updateBest();
    updateHud();
    updatePowerHud();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    audio('ui');
  }

  function submitScore() {
    if (S.submitted) return;
    S.submitted = true;
    var dist = Math.round(S.maxDist || S.score);
    /* 距离纪录走 shell 顶层 BEST（arcade_best_pixeldino，max 语义不变，旧档距离可直接比较） */
    if (Arcade.shell && Arcade.shell.submitScore) Arcade.shell.submitScore(dist);
    else if (Arcade.storage) Arcade.storage.submitBest(BEST_KEY, dist, 'max');
    /* 综合分写独立键 arcade_best_pixeldino_score，绝不顶掉距离纪录 */
    if (Arcade.storage) Arcade.storage.submitBest(SCORE_KEY, totalScore(), 'max');
    updateBest();
  }

  function die() {
    if (S.mode !== 'run') return;
    S.mode = 'dead';
    S.flash = 1;
    S.shakeT = 16;
    var p = dinoBox();
    for (var i = 0; i < 22; i++) {
      S.particles.push({
        x: p.x + p.w / 2, y: p.y + p.h / 2,
        vx: rand(-3.5, 3.5), vy: rand(-4.5, 0.5),
        life: 1, size: rand(1.5, 3.6), color: i % 2 ? '#ff2d95' : '#ff9f1c'
      });
    }
    msgEl.textContent = T('gs.pixeldino.dead').replace('{n}', Math.round(S.score));
    msgEl.style.color = 'var(--neon-pink)';
    if (Arcade.juice) Arcade.juice.lose();
    else audio('lose');
    if (Arcade.fx) Arcade.fx.shake(stageEl);
    if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
    submitScore();
    showOverlay('dead');
  }

  function finishRun(won) {
    if (S.mode !== 'run') return;
    S.mode = won ? 'won' : 'dead';
    if (won) {
      S.flash = 0.4;
      S.shakeT = 6;
      audio('win');
      if (Arcade.fx) Arcade.fx.flash('var(--neon-green)');
    } else {
      audio('lose');
    }
    submitScore();
    showOverlay(won ? 'win' : 'dead');
  }

  function takeHit() {
    if (S.invuln > 0) return;
    if (S.shieldCharges > 0) {
      S.shieldCharges = 0;
      S.power.shield = 0;
      S.invuln = 100;
      S.shakeT = 14;
      var p = dinoBox();
      burst(p.x + p.w / 2, p.y + p.h / 2, 16, '#00f0ff');
      floatText(p.x + p.w / 2, p.y - 6, T('gs.pixeldino.powerShield'), '#00f0ff');
      msgEl.textContent = T('gs.pixeldino.shieldBlock');
      msgEl.style.color = 'var(--neon-cyan)';
      audio('error');
      if (Arcade.fx) { Arcade.fx.flash('var(--neon-cyan)'); Arcade.fx.shake(stageEl); }
      updatePowerHud();
      return;
    }
    die();
  }

  function togglePause() {
    if (S.mode !== 'run') return;
    S.paused = !S.paused;
    if (S.paused) {
      if (loopApi) loopApi.pause();
      pauseEl.classList.remove('hidden');
    } else {
      if (loopApi) loopApi.resume();
      pauseEl.classList.add('hidden');
    }
    audio('ui');
  }

  /* ---------- 输入 ---------- */
  function jump(ev) {
    if (ev && ev.repeat) return;
    if (S.mode !== 'run' || S.paused) return;
    var d = S.dino;
    var wdef = WEATHERS[S.weather];
    if (d.onGround) {
      d.vy = JUMP_V * wdef.jump;
      d.onGround = false;
      d.jumps = 1;
      d.duck = false;
      spawnDust(4);
      audio('move');
    } else if (d.jumps < 2) {
      d.vy = JUMP_V * 0.88 * wdef.jump;
      d.jumps = 2;
      audio('rotate');
    }
  }
  function duckStart() {
    if (S.mode !== 'run' || S.paused) return;
    S.duckHeld = true;
  }
  function duckEnd() { S.duckHeld = false; }

  Arcade.input.onKeys({
    up: jump,
    action: jump,
    down: duckStart
  });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') duckStart();
    if (e.code === 'KeyP') { e.preventDefault(); togglePause(); }
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') duckEnd();
  });
  window.addEventListener('blur', function () { S.duckHeld = false; });

  // 触屏：画布左 35% = 蹲（长按），其余 = 跳
  canvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    if (window.GK) {
      var p = GK.pointer(canvas, ev);
      if (p.x < W * 0.35) duckStart(); else jump();
    } else {
      var r = canvas.getBoundingClientRect();
      if ((ev.clientX - r.left) / r.width < 0.35) duckStart(); else jump();
    }
  });
  canvas.addEventListener('pointerup', function () { duckEnd(); });
  canvas.addEventListener('pointerleave', function () { duckEnd(); });
  canvas.addEventListener('pointercancel', function () { duckEnd(); });

  var jumpBtn = wrap.querySelector('#dn-jump');
  var duckBtn = wrap.querySelector('#dn-duck');
  jumpBtn.addEventListener('pointerdown', function (ev) { ev.preventDefault(); jump(); });
  duckBtn.addEventListener('pointerdown', function (ev) { ev.preventDefault(); duckStart(); });
  duckBtn.addEventListener('pointerup', function () { duckEnd(); });
  duckBtn.addEventListener('pointerleave', function () { duckEnd(); });
  duckBtn.addEventListener('pointercancel', function () { duckEnd(); });
  if (Arcade.input && Arcade.input.isTouch && Arcade.input.isTouch()) touchRow.classList.add('show');

  /* ---------- 物理 / 生成 ---------- */
  function dinoBox() {
    var d = S.dino;
    if (d.duck && d.onGround) {
      return { x: d.x + 2, y: GROUND - 25, w: 44, h: 23 };
    }
    return { x: d.x + 7, y: d.feet - 43, w: 29, h: 41 };
  }
  function obsBox(o) {
    if (o.kind === 'bird') return { x: o.x + 3, y: o.y + 2, w: o.w - 6, h: o.h - 4 };
    if (o.kind === 'cactus') return { x: o.x + 3, y: GROUND - 30, w: 14, h: 30 };
    if (o.kind === 'cactusBig') return { x: o.x + 3, y: GROUND - 46, w: 24, h: 46 };
    return { x: o.x + 5, y: GROUND - 62, w: 18, h: 62 };
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function spawnDust(n) {
    var base = S.dino.feet;
    for (var i = 0; i < n; i++) {
      S.particles.push({
        x: S.dino.x + rand(8, 44), y: base - rand(0, 4),
        vx: rand(-1.8, -0.4), vy: rand(-1.6, -0.3),
        life: 1, size: rand(1.4, 3.2), color: null
      });
    }
  }
  function spawnObstacle() {
    var roll = Math.random();
    if (S.score > 260 && roll < 0.28) {
      S.obstacles.push({ kind: 'bird', x: W + 30, y: GROUND - 58, w: 34, h: 26, phase: rand(0, 6) });
    } else if (roll < 0.57) {
      S.obstacles.push({ kind: 'cactus', x: W + 20, w: 20, h: 30 });
    } else if (roll < 0.84) {
      S.obstacles.push({ kind: 'cactusBig', x: W + 20, w: 30, h: 46 });
    } else {
      S.obstacles.push({ kind: 'tall', x: W + 20, w: 28, h: 62 });
    }
  }

  /* ---------- 主循环 ---------- */
  function updateHud() {
    scoreEl.textContent = String(Math.round(S.score));
    pointsEl.textContent = String(totalScore());
    coinsEl.textContent = String(S.coinCount);
    speedEl.textContent = (S.effSpeed / S.cfg.start).toFixed(2) + 'x';
  }
  function fireBox(f) {
    return { x: f.x - f.r, y: f.y - f.r, w: f.r * 2, h: f.r * 2 };
  }
  function updateParticles() {
    for (var pi = S.particles.length - 1; pi >= 0; pi--) {
      var pt = S.particles[pi];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.08;
      pt.life -= 0.024;
      if (pt.life <= 0) S.particles.splice(pi, 1);
    }
    for (var fi = S.floats.length - 1; fi >= 0; fi--) {
      var fl = S.floats[fi];
      fl.y += fl.vy;
      fl.vy *= 0.985;
      fl.life -= 0.02;
      if (fl.life <= 0) S.floats.splice(fi, 1);
    }
  }

  function update() {
    var d = S.dino;
    updateWeatherWeights();
    updateWeatherFx();
    if (S.banner) {
      S.banner.t++;
      if (S.banner.t > S.banner.dur) S.banner = null;
    }

    if (S.mode === 'run' && !S.paused) {
      var wdef = WEATHERS[S.weather];
      var base = Math.min(14, S.cfg.start + Math.floor(S.score / 500) * S.cfg.step);
      S.speed = base;
      S.effSpeed = base * wdef.speed * (S.power.slow > 0 ? 0.6 : 1);

      S.scrollFar += S.effSpeed * 0.26;
      S.scrollNear += S.effSpeed * 0.6;
      S.groundScroll += S.effSpeed;

      // 天气随机切换
      S.weatherTimer--;
      if (S.weatherTimer <= 0) {
        var idx = WEATHER_ORDER.indexOf(S.weather);
        var next = WEATHER_ORDER[(idx + 1 + Math.floor(Math.random() * 3)) % 4];
        setWeather(next);
        S.weatherTimer = 850 + Math.floor(rand(0, 380));
      }

      // 道具倒计时
      for (var pk in S.power) if (S.power[pk] > 0) S.power[pk]--;
      if (S.power.shield <= 0 && S.shieldCharges > 0) S.shieldCharges = 0;
      updatePowerHud();

      // 障碍入场（Boss 战暂停普通障碍）
      if (!S.boss) {
        S.spawnGap -= S.effSpeed;
        if (S.spawnGap <= 0) {
          spawnObstacle();
          S.spawnGap = 200 + Math.random() * 170 + S.effSpeed * 10;
        }
      }
      for (var i = 0; i < S.obstacles.length; i++) {
        var o = S.obstacles[i];
        o.x -= S.effSpeed;
        if (o.kind === 'bird') o.phase += 0.12;
        if (!o.passed && o.x + o.w < d.x + 4) {
          o.passed = true;
          S.dodged++;
        }
      }
      S.obstacles = S.obstacles.filter(function (x) { return x.x > -80; });

      // 金币 / 道具生成
      if (!S.boss) {
        S.coinGap -= S.effSpeed;
        if (S.coinGap <= 0) { spawnCoinArc(); S.coinGap = 165 + Math.random() * 150; }
        S.pickGap -= S.effSpeed;
        if (S.pickGap <= 0) { spawnPickup(); S.pickGap = 330 + Math.random() * 220; }
      }

      // 跳跃物理
      if (!d.onGround) {
        d.vy += GRAV * wdef.grav;
        if (S.duckHeld) d.vy += 1.1; // 空中下蹲 = 快速下落
        d.feet += d.vy;
        if (d.feet >= GROUND) {
          var fall = d.vy;
          d.feet = GROUND;
          d.vy = 0;
          d.onGround = true;
          d.jumps = 0;
          if (fall > 3) {
            if (S.weather === 'rain') burst(d.x + 24, GROUND, 6, '#8fd8ff');
            else spawnDust(6);
            audio('drop');
          }
        }
      }
      d.duck = S.duckHeld && d.onGround;
      d.runPhase += S.effSpeed * 0.07;

      // 尘土
      S.dustT--;
      if (d.onGround && S.dustT <= 0) { spawnDust(2); S.dustT = 9 + rand(0, 10); }

      // 金币移动 / 磁铁吸附 / 拾取
      var box = dinoBox();
      for (var ci = S.coinList.length - 1; ci >= 0; ci--) {
        var c = S.coinList[ci];
        c.phase += 0.09;
        if (S.power.magnet > 0) {
          var mdx = (d.x + 24) - c.x, mdy = (d.feet - 26) - c.y;
          var md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < 180) {
            c.x += mdx * 0.17;
            c.y += mdy * 0.17;
          } else {
            c.x -= S.effSpeed;
          }
        } else {
          c.x -= S.effSpeed;
        }
        if (c.x < -30 || c.taken) { S.coinList.splice(ci, 1); continue; }
        if (overlap(box, { x: c.x - 8, y: c.y - 8, w: 16, h: 16 })) {
          collectCoin(c);
          S.coinList.splice(ci, 1);
        }
      }
      for (var pi2 = S.pickups.length - 1; pi2 >= 0; pi2--) {
        var pu = S.pickups[pi2];
        pu.x -= S.effSpeed;
        pu.phase += 0.07;
        if (pu.x < -30) { S.pickups.splice(pi2, 1); continue; }
        if (overlap(box, { x: pu.x - 12, y: pu.y - 12, w: 24, h: 24 })) {
          S.pickups.splice(pi2, 1);
          activatePower(pu.kind);
        }
      }

      // Boss
      if (S.boss) updateBoss(S.effSpeed);
      else if (S.score >= S.bossNextAt) startBoss();
      if (S.mode !== 'run') return;

      // AABB 碰撞（障碍 + 火球）
      var hit = false;
      for (var k = 0; k < S.obstacles.length; k++) {
        if (overlap(box, obsBox(S.obstacles[k]))) { hit = true; break; }
      }
      for (var fj = S.fireballs.length - 1; fj >= 0; fj--) {
        if (overlap(box, fireBox(S.fireballs[fj]))) {
          S.fireballs.splice(fj, 1);
          hit = true;
        }
      }
      if (hit) {
        takeHit();
        if (S.mode !== 'run') return;
      }
      if (S.invuln > 0) S.invuln--;

      S.score += S.effSpeed * 0.06;
      if (S.score > S.maxDist) S.maxDist = S.score;
      if (S.shakeT > 0) S.shakeT--;
      if (S.flash > 0) S.flash -= 0.05;
      updateHud();
      updateTaskHud();
    } else if (S.mode === 'ready') {
      S.scrollFar += 0.35;
      S.scrollNear += 0.8;
      S.groundScroll += 1;
      d.runPhase += 0.06;
    } else {
      if (S.shakeT > 0) S.shakeT--;
      if (S.flash > 0) S.flash -= 0.04;
    }
    updateParticles();
  }

  /* ---------- 绘制 ---------- */
  var cloudSeed = [], starSeed = [], rainDrops = [], sandBits = [], puddleSeed = [];
  for (var ci0 = 0; ci0 < 6; ci0++) cloudSeed.push({ x: ci0 * 130 + rand(0, 40), y: rand(26, 92), s: rand(0.7, 1.3) });
  for (var si0 = 0; si0 < 40; si0++) starSeed.push({ x: rand(0, W), y: rand(6, GROUND - 60), s: rand(0.6, 1.6), p: rand(0, 6) });
  for (var ri0 = 0; ri0 < 72; ri0++) rainDrops.push({ x: rand(0, W + 80), y: rand(-20, GROUND), sp: rand(11, 20), len: rand(5, 11) });
  for (var sa0 = 0; sa0 < 44; sa0++) sandBits.push({ x: rand(0, W), y: rand(4, GROUND - 12), sp: rand(7, 15), len: rand(5, 13) });
  for (var pu0 = 0; pu0 < 6; pu0++) puddleSeed.push({ x: rand(0, W), w: rand(30, 76), y: rand(GROUND + 12, H - 12) });

  function wColor(map) {
    var r = 0, g = 0, b = 0, ws = 0;
    for (var k in map) {
      var w = S.wA[k] || 0;
      if (w <= 0) continue;
      var c = rgb(map[k]);
      r += c[0] * w; g += c[1] * w; b += c[2] * w; ws += w;
    }
    if (!ws) return map.sunny;
    return 'rgb(' + Math.round(r / ws) + ',' + Math.round(g / ws) + ',' + Math.round(b / ws) + ')';
  }

  function drawSky() {
    var sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, skyCol(0));
    sky.addColorStop(0.55, skyCol(1));
    sky.addColorStop(1, skyCol(2));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 暮色暖光（昼夜过渡，避免瞬切）
    var nightA = S.wA.night;
    var dusk = Math.sin(Math.PI * nightA);
    if (dusk > 0.02) {
      ctx.fillStyle = 'rgba(255,110,70,' + (dusk * 0.16) + ')';
      ctx.fillRect(0, 0, W, GROUND);
      var hg2 = ctx.createLinearGradient(0, GROUND - 60, 0, GROUND);
      hg2.addColorStop(0, 'rgba(255,150,90,0)');
      hg2.addColorStop(1, 'rgba(255,150,90,' + (dusk * 0.28) + ')');
      ctx.fillStyle = hg2;
      ctx.fillRect(0, GROUND - 60, W, 60);
    }

    // 星星（夜间淡入）
    if (nightA > 0.05) {
      for (var i = 0; i < starSeed.length; i++) {
        var st = starSeed[i];
        var tw = 0.55 + 0.45 * Math.sin(Date.now() / 700 + st.p);
        ctx.globalAlpha = nightA * tw;
        ctx.fillStyle = '#dff3ff';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, PI2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 太阳（晴）
    var sunA = S.wA.sunny;
    if (sunA > 0.04) {
      var sx = 520, sy = 66;
      ctx.save();
      ctx.globalAlpha = sunA;
      var sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, 26);
      sun.addColorStop(0, '#fff4b0'); sun.addColorStop(0.5, 'rgba(255,220,120,0.75)'); sun.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = sun;
      ctx.beginPath(); ctx.arc(sx, sy, 26, 0, PI2); ctx.fill();
      ctx.restore();
    }
    // 月亮（夜）
    if (nightA > 0.04) {
      ctx.save();
      ctx.globalAlpha = nightA;
      ctx.fillStyle = '#dfeaff';
      ctx.shadowColor = '#9fc8ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(120, 58, 16, 0, PI2); ctx.fill();
      ctx.fillStyle = 'rgba(10,20,40,0.9)';
      ctx.beginPath(); ctx.arc(126, 52, 6, 0, PI2); ctx.fill();
      ctx.restore();
    }

    // 云（晴/雨，沙尘时压暗）
    var cAlpha = Math.max(0, 1 - nightA * 0.9) * Math.min(1, S.wA.sunny + S.wA.rain * 0.85);
    if (cAlpha > 0.05) {
      ctx.globalAlpha = cAlpha * 0.8;
      var cloudCol = wColor({ sunny: '#bfe7f2', rain: '#6f8896', sand: '#d8a86a', night: '#2a3550' });
      for (var c = 0; c < cloudSeed.length; c++) {
        var cl = cloudSeed[c];
        var cx = ((cl.x - S.scrollFar * 0.35) % (W + 160) + W + 160) % (W + 160) - 80;
        ctx.fillStyle = c % 2 ? cloudCol : '#9fd6e8';
        ctx.beginPath();
        ctx.ellipse(cx, cl.y, 26 * cl.s, 10 * cl.s, 0, 0, PI2);
        ctx.ellipse(cx + 20 * cl.s, cl.y - 6 * cl.s, 18 * cl.s, 8 * cl.s, 0, 0, PI2);
        ctx.ellipse(cx - 22 * cl.s, cl.y + 4 * cl.s, 16 * cl.s, 7 * cl.s, 0, 0, PI2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 远处城市剪影（最远层视差）
    drawCity(S.scrollFar * 0.16, wColor({ sunny: '#20455f', rain: '#1b333c', sand: '#5c3a1a', night: '#0b1728' }), nightA);
    // 远山（两层视差）
    drawRange(S.scrollFar * 0.5, GROUND - 24,
      wColor({ sunny: '#2c5c78', rain: '#243d46', sand: '#7a4c22', night: '#16233f' }), 46, 170);
    drawRange(S.scrollNear * 0.35 + 90, GROUND - 8,
      wColor({ sunny: '#1e4157', rain: '#1a2e36', sand: '#5a371a', night: '#0e182c' }), 64, 230);
  }

  function drawRange(off, baseY, color, amp, period) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-60, baseY);
    for (var x = -60; x <= W + 60; x += 24) {
      var y = baseY - amp * (0.42 + 0.35 * Math.sin((x + off) / period * PI2) + 0.18 * Math.sin((x + off * 1.7) / (period * 0.47) * PI2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 60, baseY + 20);
    ctx.lineTo(-60, baseY + 20);
    ctx.closePath();
    ctx.fill();
  }

  function drawCity(off, color, nightA) {
    var span = W + 220;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    for (var i = 0; i < 20; i++) {
      var bx = ((i * 86 - off) % span + span) % span - 110;
      var bh = 18 + ((i * 37 + 11) % 44);
      var bw = 20 + (i % 3) * 7;
      var by = GROUND - 40 - bh;
      roundRect(bx, by, bw, bh + 40, 2);
      ctx.fill();
      if (nightA > 0.15) {
        ctx.save();
        ctx.globalAlpha = 0.55 * nightA;
        ctx.fillStyle = '#ffd98a';
        for (var wy = by + 6; wy < GROUND - 46; wy += 9) {
          for (var wx = bx + 4; wx < bx + bw - 5; wx += 8) {
            if ((i + wy + wx) % 3 === 0) ctx.fillRect(wx, wy, 2.2, 2.2);
          }
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawGround() {
    var g = ctx.createLinearGradient(0, GROUND, 0, H);
    g.addColorStop(0, wColor({ sunny: '#3a2f22', rain: '#2b3338', sand: '#6b4a28', night: '#141a28' }));
    g.addColorStop(1, wColor({ sunny: '#20180f', rain: '#141a20', sand: '#3c2a14', night: '#080b12' }));
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND, W, H - GROUND);

    // 雨后水洼（越湿越明显）
    if (S.wA.rain > 0.05) {
      ctx.save();
      for (var pi = 0; pi < puddleSeed.length; pi++) {
        var pd = puddleSeed[pi];
        var px2 = ((pd.x - S.groundScroll * 0.5) % (W + 120) + W + 120) % (W + 120) - 60;
        ctx.fillStyle = 'rgba(130,200,240,' + (0.16 * S.wA.rain) + ')';
        ctx.beginPath();
        ctx.ellipse(px2, pd.y, pd.w * 0.5, 5, 0, 0, PI2);
        ctx.fill();
        ctx.fillStyle = 'rgba(210,240,255,' + (0.1 * S.wA.rain) + ')';
        ctx.fillRect(px2 - pd.w * 0.28, pd.y - 4, pd.w * 0.3, 1.4);
      }
      ctx.restore();
    }

    ctx.strokeStyle = wColor({ sunny: '#f5e6c4', rain: '#7fb2c8', sand: '#f0c27a', night: '#78aaff' });
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
    ctx.globalAlpha = 1;
    // 速度纹理
    var off = -(S.groundScroll % 40);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (var x = off - 40; x < W + 40; x += 40) ctx.fillRect(x, GROUND + 12, 22, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var x2 = off * 0.6 - 40; x2 < W + 40; x2 += 64) ctx.fillRect(x2, GROUND + 26, 30, 2);
  }

  function drawDino() {
    var d = S.dino;
    var x = d.x, base = d.feet;
    var duck = d.duck && d.onGround;
    var stretch = (!d.onGround && d.vy < 0) ? 0.94 : 1;
    var bob = d.onGround ? Math.sin(d.runPhase * 2) * 1.4 : 0;
    var swing = Math.sin(d.runPhase);

    // 地面阴影（离地越高越小越淡）
    var airH = Math.max(0, GROUND - base);
    var sh = 1 - Math.min(0.5, airH / 140);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + (d.onGround ? 0.35 : 0.16) * sh + ')';
    ctx.beginPath(); ctx.ellipse(x + 24, GROUND + 2, 19 * sh, 4.2 * sh, 0, 0, PI2); ctx.fill();
    ctx.restore();

    ctx.save();
    if (S.invuln > 0 && Math.floor(S.invuln / 6) % 2 === 0) ctx.globalAlpha = 0.55;
    var bodyG = ctx.createLinearGradient(0, base - 55, 0, base);
    bodyG.addColorStop(0, '#b2ffff');
    bodyG.addColorStop(0.35, '#00e5f5');
    bodyG.addColorStop(1, '#045563');
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;

    // ---- 后腿（先画，位于身体后层） ----
    ctx.strokeStyle = '#0a97a8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    if (!duck) {
      if (d.onGround) {
        var s2 = Math.sin(d.runPhase + Math.PI);
        var knee2x = x + 32 + s2 * 5, knee2y = base - 13 + bob;
        var foot2x = x + 34 + s2 * 8;
        ctx.beginPath(); ctx.moveTo(x + 31, base - 27 + bob); ctx.lineTo(knee2x, knee2y); ctx.lineTo(foot2x, base - 2); ctx.stroke();
        ctx.fillStyle = '#0a97a8';
        ctx.fillRect(foot2x - 3, base - 3, 9, 3);
      } else {
        ctx.beginPath(); ctx.moveTo(x + 31, base - 26); ctx.lineTo(x + 35, base - 8); ctx.stroke();
        ctx.fillStyle = '#0a97a8'; ctx.fillRect(x + 33, base - 9, 8, 3);
      }
    }

    // ---- 尾巴（左右摆动 + 末端发光） ----
    var tailSway = Math.sin(d.runPhase * 0.9) * 5;
    ctx.strokeStyle = '#0ab7c8';
    ctx.lineWidth = duck ? 7 : 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (duck) {
      ctx.moveTo(x + 14, base - 14);
      ctx.quadraticCurveTo(x - 8, base - 12, x - 20, base - 18 + tailSway * 0.5);
    } else {
      ctx.moveTo(x + 12, base - 24 + bob);
      ctx.quadraticCurveTo(x - 9, base - 26 + bob, x - 21, base - 34 + tailSway);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(127,252,255,.5)';
    ctx.beginPath(); ctx.arc(x - 21, base - (duck ? 18 : 34) + (duck ? tailSway * 0.5 : tailSway), 2.4, 0, PI2); ctx.fill();

    if (duck) {
      // ---- 蹲姿：身体压低、头前伸 ----
      roundRect(x + 2, base - 24 + bob * 0.4, 46, 22, 9);
      ctx.fillStyle = bodyG; ctx.fill();
      ctx.fillStyle = 'rgba(200,255,230,0.32)';
      roundRect(x + 8, base - 12, 28, 7, 3); ctx.fill();
      roundRect(x + 38, base - 28 + bob * 0.4, 23, 17, 7);
      ctx.fillStyle = bodyG; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 52, base - 22, 4, 0, PI2); ctx.fill();
      ctx.fillStyle = '#04131a'; ctx.beginPath(); ctx.arc(x + 53.5, base - 22, 2, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#0a97a8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 30, base - 6); ctx.lineTo(x + 38, base - 2); ctx.stroke();
    } else {
      // ---- 身体 ----
      var bodyTop = base - 40 * stretch + bob;
      roundRect(x + 8, bodyTop, 30, 35 * stretch, 10);
      ctx.fillStyle = bodyG; ctx.fill();
      ctx.fillStyle = 'rgba(200,255,230,0.35)';
      roundRect(x + 14, bodyTop + 16, 18, 15, 7); ctx.fill();
      ctx.fillStyle = '#7ffcff';
      for (var sp = 0; sp < 4; sp++) {
        var sx2 = x + 11 + sp * 7;
        ctx.beginPath();
        ctx.moveTo(sx2, bodyTop + 3); ctx.lineTo(sx2 + 3.5, bodyTop - 4 - (sp % 2)); ctx.lineTo(sx2 + 7, bodyTop + 3);
        ctx.closePath(); ctx.fill();
      }

      var headTop = base - 55 * stretch + bob;
      ctx.fillStyle = '#12cfdf';
      roundRect(x + 25, bodyTop - 2, 12, 12, 5); ctx.fill();
      var hg = ctx.createLinearGradient(x + 28, headTop, x + 50, headTop + 22);
      hg.addColorStop(0, '#c7ffff'); hg.addColorStop(0.5, '#22dcea'); hg.addColorStop(1, '#07899a');
      roundRect(x + 28, headTop, 22, 21, 7);
      ctx.fillStyle = hg; ctx.fill();
      roundRect(x + 42, headTop + 6, 14, 10, 4);
      ctx.fillStyle = '#0bb2c3'; ctx.fill();
      ctx.fillStyle = '#9dffff';
      ctx.beginPath(); ctx.moveTo(x + 36, headTop + 3); ctx.lineTo(x + 44, headTop + 2); ctx.lineTo(x + 43, headTop + 5); ctx.lineTo(x + 36, headTop + 5.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 39.5, headTop + 8.5, 4.3, 0, PI2); ctx.fill();
      ctx.fillStyle = '#04131a'; ctx.beginPath(); ctx.arc(x + 40.8, headTop + 8.5, 2.2, 0, PI2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x + 39.6, headTop + 7.2, 1, 0, PI2); ctx.fill();
      ctx.fillStyle = '#043e48'; ctx.beginPath(); ctx.arc(x + 50, headTop + 9, 1.1, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#043e48'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + 44, headTop + 16); ctx.lineTo(x + 53, headTop + 16); ctx.stroke();

      ctx.strokeStyle = '#12cfdf'; ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(x + 33, bodyTop + 20);
      ctx.quadraticCurveTo(x + 38, bodyTop + 22 + swing * 2, x + 41, bodyTop + 25 + swing * 2.5);
      ctx.stroke();
    }
    ctx.restore();

    // ---- 前腿（最上层，带膝弯与脚掌） ----
    ctx.save();
    if (S.invuln > 0 && Math.floor(S.invuln / 6) % 2 === 0) ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#0ab7c8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    if (duck) {
      ctx.fillStyle = '#0ab7c8';
      ctx.fillRect(x + 8, base - 4, 10, 4);
      ctx.fillRect(x + 34, base - 4, 10, 4);
    } else if (d.onGround) {
      var kneeX = x + 15 + swing * 5, kneeY = base - 13 + bob;
      var footX = x + 13 + swing * 8;
      ctx.beginPath(); ctx.moveTo(x + 17, base - 27 + bob); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, base - 2); ctx.stroke();
      ctx.fillStyle = '#0ab7c8';
      ctx.fillRect(footX - 3, base - 3, 9, 3);
    } else {
      ctx.beginPath(); ctx.moveTo(x + 17, base - 26); ctx.lineTo(x + 21, base - 8); ctx.stroke();
      ctx.fillStyle = '#0ab7c8';
      ctx.fillRect(x + 19, base - 9, 8, 3);
    }
    ctx.restore();

    // ---- 道具光环 ----
    if (S.power.magnet > 0) {
      ctx.save();
      var ma = 0.35 + 0.2 * Math.sin(Date.now() / 180);
      ctx.strokeStyle = 'rgba(255,45,149,' + ma + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + 24, base - 28, 38, -0.2, PI2 - 0.4);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 24, base - 28, 46, 0.4, PI2 - 0.1);
      ctx.stroke();
      ctx.restore();
    }
    if (S.shieldCharges > 0) {
      ctx.save();
      var sa = 0.55 + 0.25 * Math.sin(Date.now() / 220);
      ctx.strokeStyle = 'rgba(0,240,255,' + sa + ')';
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x + 24, base - 27, 33, 36, 0, 0, PI2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawObstacle(o) {
    if (o.kind === 'bird') {
      var flap = Math.sin(o.phase) * 8;
      ctx.save();
      ctx.shadowColor = '#b967ff'; ctx.shadowBlur = 10;
      var bg = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
      bg.addColorStop(0, '#d59bff'); bg.addColorStop(1, '#7a2ec4');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(o.x + 16, o.y + 14, 13, 8, 0, 0, PI2); ctx.fill();
      ctx.fillStyle = '#9b52e8';
      ctx.beginPath();
      ctx.moveTo(o.x + 12, o.y + 10); ctx.lineTo(o.x - 2, o.y + 10 + flap); ctx.lineTo(o.x + 12, o.y + 18);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(o.x + 20, o.y + 10); ctx.lineTo(o.x + 34, o.y + 10 - flap); ctx.lineTo(o.x + 22, o.y + 18);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb02e';
      ctx.beginPath(); ctx.moveTo(o.x + 28, o.y + 12); ctx.lineTo(o.x + 36, o.y + 14); ctx.lineTo(o.x + 28, o.y + 16); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x + 24, o.y + 11, 3, 0, PI2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(o.x + 25, o.y + 11, 1.5, 0, PI2); ctx.fill();
      ctx.restore();
      return;
    }
    var h = o.h, w = o.w;
    var baseX = o.x;
    var g = ctx.createLinearGradient(baseX, GROUND - h, baseX + w, GROUND);
    g.addColorStop(0, '#7dff5c'); g.addColorStop(0.5, '#27b80a'); g.addColorStop(1, '#0b5c02');
    ctx.save();
    ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 8;
    ctx.fillStyle = g;
    if (o.kind === 'cactus') {
      roundRect(baseX + 5, GROUND - h, 12, h, 5); ctx.fill();
      roundRect(baseX, GROUND - h + 12, 7, 15, 3); ctx.fill();
      roundRect(baseX + 15, GROUND - h + 16, 6, 12, 3); ctx.fill();
    } else if (o.kind === 'cactusBig') {
      roundRect(baseX + 8, GROUND - h, 15, h, 6); ctx.fill();
      roundRect(baseX, GROUND - h + 14, 10, 22, 4); ctx.fill();
      roundRect(baseX + 20, GROUND - h + 20, 9, 16, 4); ctx.fill();
    } else {
      roundRect(baseX + 7, GROUND - h, 15, h, 6); ctx.fill();
      roundRect(baseX, GROUND - h + 20, 9, 24, 4); ctx.fill();
      roundRect(baseX + 18, GROUND - h + 28, 9, 18, 4); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(baseX + (o.kind === 'cactus' ? 8 : 11), GROUND - h + 4, 2, h - 10);
  }

  function drawCoin(c) {
    var y = c.y + Math.sin(c.phase) * 2;
    var wob = 0.75 + 0.25 * Math.abs(Math.cos(c.phase * 1.3));
    ctx.save();
    ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffe600';
    ctx.beginPath(); ctx.ellipse(c.x, y, 7.4 * wob, 7.8, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = '#fff7b0';
    ctx.beginPath(); ctx.ellipse(c.x, y, 4 * wob, 4.2, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = 'rgba(160,110,0,0.75)';
    ctx.fillRect(c.x - 1, y - 4.2, 2, 7.6);
    ctx.restore();
  }

  function drawPowerIcon(kind, cx, cy, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = color; ctx.shadowBlur = 6;
    if (kind === 'magnet') {
      ctx.fillRect(cx - 5, cy - 6, 3, 9);
      ctx.fillRect(cx + 2, cy - 6, 3, 9);
      ctx.fillRect(cx - 5, cy + 1, 10, 3);
      ctx.fillStyle = '#ffe600'; ctx.fillRect(cx - 5, cy - 6, 3, 3);
      ctx.fillStyle = '#00f0ff'; ctx.fillRect(cx + 2, cy - 6, 3, 3);
    } else if (kind === 'shield') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx + 6, cy - 3);
      ctx.lineTo(cx + 6, cy + 2);
      ctx.lineTo(cx, cy + 7);
      ctx.lineTo(cx - 6, cy + 2);
      ctx.lineTo(cx - 6, cy - 3);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,240,255,0.28)'; ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, PI2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 3.5, cy + 1.5); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPickup(p) {
    var def = POWERS[p.kind];
    var y = p.y + Math.sin(p.phase) * 3;
    var pulse = 0.85 + 0.15 * Math.sin(p.phase * 2);
    ctx.save();
    ctx.translate(p.x, y);
    ctx.rotate(Math.sin(p.phase * 0.6) * 0.12);
    ctx.shadowColor = def.color; ctx.shadowBlur = 14;
    roundRect(-11, -11, 22, 22, 7);
    ctx.fillStyle = 'rgba(6,12,20,0.88)'; ctx.fill();
    ctx.strokeStyle = def.color; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = def.color;
    roundRect(-13 * pulse, -13 * pulse, 26 * pulse, 26 * pulse, 9); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, y, 14 + Math.sin(p.phase) * 2, 0, PI2); ctx.stroke();
    ctx.restore();
    drawPowerIcon(p.kind, p.x, y, def.color);
  }

  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function drawBoss() {
    var b = S.boss;
    if (!b) return;
    var base = GROUND;
    var bob = Math.sin(b.t * 0.16) * 3;
    var bx = b.x;
    var open = b.charge > 0 ? 10 + Math.sin((22 - b.charge) / 22 * Math.PI) * 12 : 5 + Math.sin(b.t * 0.3) * 2;
    ctx.save();
    ctx.translate(0, base);
    ctx.scale(1, 1.34);
    ctx.translate(0, -base);
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 16;
    // 尾部与后腿
    px(bx - 34, base - 46 + bob, 40, 12, '#5a0f2c');
    px(bx - 54, base - 40 + bob, 24, 8, '#5a0f2c');
    px(bx + 14, base - 26, 14, 26, '#5a0f2c');
    px(bx + 48, base - 22, 14, 22, '#6a1533');
    // 躯干（先描边再填色，像素轮廓更清晰）
    px(bx, base - 68 + bob, 66, 48, '#2a0512');
    px(bx + 2, base - 66 + bob, 62, 44, '#7a1a3f');
    px(bx + 2, base - 66 + bob, 62, 6, '#ff2d95');
    px(bx + 10, base - 50 + bob, 44, 9, '#9c2450');
    // 背刺
    for (var s = 0; s < 4; s++) {
      ctx.fillStyle = s % 2 ? '#ff9f1c' : '#ffe600';
      ctx.beginPath();
      ctx.moveTo(bx + 9 + s * 14, base - 66 + bob);
      ctx.lineTo(bx + 15 + s * 14, base - 82 + bob);
      ctx.lineTo(bx + 22 + s * 14, base - 66 + bob);
      ctx.closePath(); ctx.fill();
    }
    // 颈与头
    px(bx + 42, base - 104 + bob, 30, 46, '#2a0512');
    px(bx + 44, base - 102 + bob, 26, 42, '#7a1a3f');
    px(bx + 54, base - 122 + bob, 56, 46, '#2a0512');
    px(bx + 56, base - 120 + bob, 52, 42, '#9c2450');
    px(bx + 56, base - 120 + bob, 52, 5, '#ff2d95');
    // 眉骨 + 眼睛
    px(bx + 70, base - 113 + bob, 30, 6, '#ff2d95');
    px(bx + 83, base - 108 + bob, 10, 10, '#ffe600');
    px(bx + 87, base - 105 + bob, 4, 4, '#0a0a12');
    // 头顶双角（龙特征）
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.moveTo(bx + 72, base - 120 + bob);
    ctx.lineTo(bx + 76, base - 137 + bob);
    ctx.lineTo(bx + 82, base - 120 + bob);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 86, base - 121 + bob);
    ctx.lineTo(bx + 90, base - 133 + bob);
    ctx.lineTo(bx + 95, base - 121 + bob);
    ctx.closePath(); ctx.fill();
    // 口腔（蓄力时张开）
    var jawY = base - 80 + bob;
    px(bx + 56, jawY, 48, 10 + open, '#34060f');
    for (var t = 0; t < 4; t++) px(bx + 62 + t * 11, jawY, 6, 7, '#f2f2ff');
    px(bx + 56, jawY + 10 + open, 48, 9, '#6a1533');
    for (var t2 = 0; t2 < 4; t2++) px(bx + 64 + t2 * 11, jawY + 10 + open, 5, 6, '#f2f2ff');
    // 前爪
    px(bx + 42, base - 58 + bob, 12, 20, '#6a1533');
    px(bx + 36, base - 44 + bob, 22, 7, '#ff9f1c');
    // 口中蓄力火球
    if (b.charge > 0) {
      var cr = 5 + (22 - b.charge) * 0.6;
      ctx.fillStyle = 'rgba(255,159,28,0.7)';
      ctx.beginPath(); ctx.arc(bx + 100, jawY + 6, cr, 0, PI2); ctx.fill();
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(bx + 100, jawY + 6, cr * 0.5, 0, PI2); ctx.fill();
    }
    if (b.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (b.hitFlash / 8 * 0.4) + ')';
      ctx.fillRect(bx - 54, base - 120 + bob, 165, 120);
    }
    ctx.restore();
  }

  function drawFireballs() {
    for (var i = 0; i < S.fireballs.length; i++) {
      var f = S.fireballs[i];
      ctx.save();
      ctx.shadowColor = '#ff6b1c'; ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(255,90,20,0.35)';
      ctx.beginPath(); ctx.ellipse(f.x - 12, f.y, 13, 6, 0, 0, PI2); ctx.fill();
      ctx.fillStyle = '#ff7a1c';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, PI2); ctx.fill();
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.52, 0, PI2); ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (var i = 0; i < S.particles.length; i++) {
      var p = S.particles[i];
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color || 'rgba(200,225,245,0.55)';
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.save();
    ctx.font = 'bold 11px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    for (var i = 0; i < S.floats.length; i++) {
      var fl = S.floats[i];
      ctx.globalAlpha = clamp(fl.life, 0, 1);
      ctx.fillStyle = fl.color;
      ctx.shadowColor = fl.color; ctx.shadowBlur = 8;
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.restore();
  }

  function updateWeatherFx() {
    var rw = S.wA.rain, sw = S.wA.sand;
    if (rw > 0.02) {
      for (var i = 0; i < rainDrops.length; i++) {
        var d = rainDrops[i];
        d.y += d.sp * (0.5 + rw);
        d.x -= d.sp * 0.22;
        if (d.y > GROUND + 4) { d.y = rand(-30, 0); d.x = rand(0, W + 80); }
        if (d.x < -12) d.x = W + 12;
      }
    }
    if (sw > 0.02) {
      for (var j = 0; j < sandBits.length; j++) {
        var s = sandBits[j];
        s.x -= s.sp * (0.4 + sw);
        if (s.x < -20) { s.x = W + rand(0, 60); s.y = rand(4, GROUND - 12); }
      }
    }
  }

  function drawWeatherFx() {
    var rw = S.wA.rain, sw = S.wA.sand, na = S.wA.night;
    if (rw > 0.04) {
      ctx.save();
      ctx.strokeStyle = 'rgba(155,215,255,' + (0.42 * rw) + ')';
      ctx.lineWidth = 1.2;
      for (var i = 0; i < rainDrops.length; i++) {
        var d = rainDrops[i];
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + d.len); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(60,120,180,' + (0.10 * rw) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (sw > 0.04) {
      ctx.fillStyle = 'rgba(205,145,70,' + (0.13 * sw) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,215,150,' + (0.34 * sw) + ')';
      ctx.lineWidth = 1;
      for (var j = 0; j < sandBits.length; j++) {
        var s = sandBits[j];
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len, s.y + 1.5); ctx.stroke();
      }
      ctx.restore();
    }
    if (na > 0.05) {
      ctx.fillStyle = 'rgba(2,5,16,' + (0.14 * na) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (S.power.slow > 0) {
      ctx.fillStyle = 'rgba(150,80,230,0.07)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(185,103,255,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    }
  }

  function drawOverlayFxF() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (var y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawBanner() {
    var b = S.banner;
    if (!b) return;
    var a = b.t < 16 ? b.t / 16 : Math.min(1, (b.dur - b.t) / 28);
    a = clamp(a, 0, 1);
    if (a <= 0) return;
    var y = 66 - (1 - a) * 10;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 12px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var tw = Math.min(W - 36, ctx.measureText(b.text).width + 30);
    ctx.fillStyle = 'rgba(6,12,22,0.88)';
    roundRect(W / 2 - tw / 2, y - 14, tw, 26, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(0,240,255,0.65)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#bffcff';
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
    ctx.fillText(b.text, W / 2, y + 1);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shakeT > 0) {
      ctx.translate(rand(-3, 3), rand(-2, 2));
    }
    drawSky();
    drawGround();
    for (var i = 0; i < S.coinList.length; i++) drawCoin(S.coinList[i]);
    for (var j = 0; j < S.pickups.length; j++) drawPickup(S.pickups[j]);
    for (var k = 0; k < S.obstacles.length; k++) drawObstacle(S.obstacles[k]);
    drawBoss();
    drawFireballs();
    drawDino();
    drawParticles();
    drawFloats();
    drawWeatherFx();
    drawOverlayFxF();
    if (S.flash > 0) {
      ctx.fillStyle = 'rgba(255,45,149,' + (S.flash * 0.38) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    drawBanner();
    ctx.restore();
  }

  /* ---------- 按钮 ---------- */
  startBtn.addEventListener('click', function () { resetRun(S.diff); });
  diffRow.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('[data-diff]') : null;
    if (!btn) return;
    S.diff = btn.getAttribute('data-diff');
    S.cfg = DIFFS[S.diff] || DIFFS.normal;
    var all = diffRow.querySelectorAll('[data-diff]');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('selected', all[i] === btn);
    audio('ui');
  });
  wrap.querySelector('#dn-pause-btn').addEventListener('click', togglePause);
  wrap.querySelector('#dn-resume').addEventListener('click', togglePause);
  wrap.querySelector('#dn-restart').addEventListener('click', function () { resetRun(S.diff); });
  wrap.querySelector('#dn-pause-restart').addEventListener('click', function () { resetRun(S.diff); });

  /* ---------- QA 接口（仅 ?qa=1） ---------- */
  if (QA) {
    window.__qa = {
      start: function (diff) { resetRun(diff || S.diff); return window.__qa.info(); },
      info: function () {
        return {
          state: S.mode,
          score: totalScore(),
          distance: Math.round(S.score),
          maxDist: Math.round(S.maxDist || 0),
          coins: S.coinCount,
          bonus: S.bonus,
          dodged: S.dodged,
          picked: S.picked,
          bossWins: S.bossWins,
          weather: S.weather,
          power: { magnet: S.power.magnet, shield: S.power.shield, slow: S.power.slow, charges: S.shieldCharges },
          boss: S.boss ? { hp: S.boss.hp, state: S.boss.state, t: S.boss.t } : null,
          tasks: S.tasks.map(function (t) {
            return { type: t.type, need: t.need, progress: Math.min(t.progress, t.need), done: t.done, reward: t.reward };
          }),
          overlayVisible: !overEl.classList.contains('hidden'),
          overlayTitle: ovTitle.textContent,
          paused: S.paused,
          best: bestScore(),
          bestCombined: bestCombined(),
          speed: S.effSpeed
        };
      },
      jump: function () { jump(); return window.__qa.info(); },
      duck: function () { duckStart(); setTimeout(duckEnd, 420); return window.__qa.info(); },
      setWeather: function (w) { setWeather(w); return window.__qa.info(); },
      spawnBoss: function () { startBoss(); return window.__qa.info(); },
      winBoss: function () {
        if (!S.boss) startBoss();
        bossReward(false);
        if (S.boss) S.boss.outT = 56;
        return window.__qa.info();
      },
      kill: function () { die(); return window.__qa.info(); },
      lose: function () { die(); return window.__qa.info(); },
      win: function () { finishRun(true); return window.__qa.info(); },
      addCoins: function (n) {
        n = Math.max(0, Math.floor(n || 0));
        S.coinCount += n;
        floatText(S.dino.x + 26, S.dino.feet - 40, '+' + (n * 10), '#ffe600');
        updateHud();
        updateTaskHud();
        return window.__qa.info();
      },
      completeTask: function (i) {
        var t = S.tasks[i];
        if (!t) return window.__qa.info();
        if (!t.done) {
          t.done = true;
          t.progress = t.need;
          addBonus(t.reward, '+ ' + t.reward, W * 0.55, 120, '#39ff14');
          if (t.els) {
            t.els.row.classList.add('done');
            t.els.fill.style.width = '100%';
            t.els.val.textContent = t.need + '/' + t.need;
          }
          audio('coin');
        }
        return window.__qa.info();
      }
    };
  }

  /* ---------- 启动 ---------- */
  updateBest();
  setWeather('sunny', true);
  updateHud();
  updatePowerHud();
  updateTaskHud();
  showOverlay('ready');
  loopApi = Arcade.loop.start(update, draw, 16, { autoResume: true });
})();
