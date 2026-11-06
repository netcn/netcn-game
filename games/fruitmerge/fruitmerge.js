/* 西瓜合成 Watermelon Merge —— Canvas 绘制 / 圆碰撞物理 / 接触警戒线即判负
   规则：两个同级水果相碰合成下一级；已落定水果顶部触及警戒线立即判负。
   「下一个」在已解锁等级内加权随机（不会只增不减）。
   旗舰扩展：连锁倍率、炸弹果 / 彩虹果、每日种子挑战、自绘粒子与屏震。 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.fruitmerge.tut1t'), d: T('gs.fruitmerge.tut1') },
  { t: T('gs.fruitmerge.tut2t'), d: T('gs.fruitmerge.tut2') },
  { t: T('gs.fruitmerge.tut3t'), d: T('gs.fruitmerge.tut3') },
  { t: T('gs.fruitmerge.tut4t'), d: T('gs.fruitmerge.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  var W = 400, H = 560;
  var SPAWN_Y = 48, DANGER_Y = 96, FLOOR = H - 10;
  var MAXLV = 10, COMBO_MS = 900;
  var DAILY_KEY = 'arcade_daily_fruitmerge';
  var LEVELS = [
    { a: '#b39dff', b: '#5e35b1', hi: '#f0e9ff', leaf: '#7cb342' },
    { a: '#ff8fa8', b: '#b3123f', hi: '#ffe3e9', leaf: '#66bb6a' },
    { a: '#ffc078', b: '#d85b00', hi: '#fff0d6', leaf: '#7cb342' },
    { a: '#fff59d', b: '#e0a800', hi: '#fffde7', leaf: '#689f38' },
    { a: '#b9d98a', b: '#4c8c2b', hi: '#f1f8e9', leaf: '#5d9c3d' },
    { a: '#ff8a65', b: '#c62828', hi: '#ffd9ce', leaf: '#558b2f' },
    { a: '#ffc1a6', b: '#e0705a', hi: '#fff0e8', leaf: '#6a9e3c' },
    { a: '#ffd75e', b: '#c68a00', hi: '#fff7cc', leaf: '#4e8f2f' },
    { a: '#d2ab80', b: '#6d4c2f', hi: '#f5e6d6', leaf: '#5d8c3a' },
    { a: '#b2d98a', b: '#2e7d32', hi: '#eef8e3', leaf: '#4e8f2f' },
    { a: '#81c784', b: '#1b5e20', hi: '#e8f5e9', leaf: '#33691e' }
  ];

  var fruits, current, next, currentSpecial, nextSpecial, maxLevel, merges, score, over, paused, touchActive;
  var aimX, dropCool, runToken, submitted, best, loopApi;
  var combo, comboTimer, maxCombo, shake, flashAlpha, texts, parts, dailyMode, daily, dropCount, won;
  var rng = Math.random;
  var gravity = 0.34;
  var QA = /(?:^|[?&])qa=1(?:&|$)/.test(location.search);

  function radiusOf(lv) { return 12 + lv * 3.1; }

  /* ---------- 确定性随机（每日挑战） ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function loadDaily() {
    var today = todayStr();
    try {
      var o = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
      if (o && o.date === today) return { date: today, best: Number(o.best) || 0, plays: Number(o.plays) || 0 };
    } catch (e) {}
    return { date: today, best: 0, plays: 0 };
  }
  function saveDaily() {
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(daily)); } catch (e) {}
  }

  function rollNext() {
    var hi = Math.max(1, Math.min(5, maxLevel + 1));
    var weights = [], total = 0, lv;
    for (lv = 0; lv <= hi; lv++) {
      var w = Math.pow(hi - lv + 1, 1.7);
      weights.push(w); total += w;
    }
    var x = rng() * total;
    for (lv = 0; lv <= hi; lv++) {
      x -= weights[lv];
      if (x <= 0) return lv;
    }
    return 0;
  }
  function rollSpecial() {
    if (maxLevel < 1) return null;
    var r = rng();
    if (r < 0.10) return 'rainbow';
    if (r < 0.21) return 'bomb';
    return null;
  }

  function setup(opts) {
    opts = opts || {};
    if (opts.daily !== undefined) dailyMode = !!opts.daily;
    runToken++;
    daily = loadDaily();
    rng = dailyMode ? mulberry32(seedOf(daily.date)) : Math.random;
    fruits = [];
    current = 0;
    next = 0;
    currentSpecial = null;
    nextSpecial = null;
    maxLevel = 0;
    merges = 0;
    score = 0;
    over = false;
    won = false;
    paused = false;
    submitted = false;
    combo = 0;
    comboTimer = 0;
    maxCombo = 0;
    shake = 0;
    flashAlpha = 0;
    texts = [];
    parts = [];
    dropCount = 0;
    aimX = W / 2;
    dropCool = 0;
    touchActive = false;
    gravity = 0.34;
    current = rollNext();
    next = rollNext();
    currentSpecial = rollSpecial();
    nextSpecial = rollSpecial();
    updateHUD();
    hideOver();
    updateModeBadge();
  }

  /* ---------- DOM ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'fm-wrap';
  wrap.innerHTML =
    '<div class="fm-top">' +
    '  <span>' + T('gs.fruitmerge.score') + ' <b id="fm-score">0</b></span>' +
    '  <span><i id="fm-bestlabel">' + T('gs.fruitmerge.best') + '</i> <b id="fm-best">0</b></span>' +
    '  <span>' + T('gs.fruitmerge.merges') + ' <b id="fm-merge">0</b></span>' +
    '  <span>' + T('gs.fruitmerge.combo') + ' <b id="fm-combo">x0</b></span>' +
    '  <span class="fm-nextlabel">' + T('gs.fruitmerge.next') + '<canvas id="fm-next" width="34" height="34"></canvas></span>' +
    '</div>' +
    '<div class="fm-mode" id="fm-mode"></div>' +
    '<div class="fm-stage">' +
    '  <canvas class="fm-canvas" id="fm-canvas"></canvas>' +
    '  <div class="fm-over" id="fm-over"><div class="fm-over-box">' +
    '    <div class="fm-over-title" id="fm-otitle"></div>' +
    '    <div class="fm-over-score" id="fm-oscore"></div>' +
    '    <div class="fm-over-sub" id="fm-osub"></div>' +
    '    <div class="fm-over-btns">' +
    '      <button class="btn green" id="fm-orest">' + T('gs.fruitmerge.restart') + '</button>' +
    '      <button class="btn purple" id="fm-odaily">' + T('gs.fruitmerge.daily') + '</button>' +
    '    </div>' +
    '  </div></div>' +
    '</div>' +
    '<div class="fm-controls">' +
    '  <button class="btn purple" id="fm-pause">' + T('gs.fruitmerge.pause') + '</button>' +
    '  <button class="btn" id="fm-daily">' + T('gs.fruitmerge.daily') + '</button>' +
    '  <button class="btn" id="fm-restart">' + T('gs.fruitmerge.restart') + '</button>' +
    '</div>' +
    '<div class="fm-msg" id="fm-msg">' + T('gs.fruitmerge.help') + '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#fm-canvas'), stage = wrap.querySelector('.fm-stage');
  var gk = GK.setup(canvas, W, H);
  var ctx = gk.ctx;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var nextCanvas = wrap.querySelector('#fm-next'), nctx = nextCanvas.getContext('2d');
  var scoreEl = wrap.querySelector('#fm-score'), bestEl = wrap.querySelector('#fm-best'),
      bestLabel = wrap.querySelector('#fm-bestlabel'),
      mergeEl = wrap.querySelector('#fm-merge'), comboEl = wrap.querySelector('#fm-combo'),
      msg = wrap.querySelector('#fm-msg'), modeEl = wrap.querySelector('#fm-mode'),
      overEl = wrap.querySelector('#fm-over'), oTitle = wrap.querySelector('#fm-otitle'),
      oScore = wrap.querySelector('#fm-oscore'), oSub = wrap.querySelector('#fm-osub'),
      pauseBtn = wrap.querySelector('#fm-pause'), restartBtn = wrap.querySelector('#fm-restart'),
      dailyBtn = wrap.querySelector('#fm-daily'), oRestBtn = wrap.querySelector('#fm-orest'),
      oDailyBtn = wrap.querySelector('#fm-odaily');

  best = (window.Arcade && Arcade.storage) ? (Arcade.storage.getBest('fruitmerge') || 0) : 0;
  bestEl.textContent = String(best);

  function updateModeBadge() {
    if (dailyMode) {
      modeEl.textContent = T('gs.fruitmerge.dailyMode').replace('{d}', daily.date);
      modeEl.classList.add('on');
      dailyBtn.textContent = T('gs.fruitmerge.normal');
      oDailyBtn.textContent = T('gs.fruitmerge.normal');
      bestLabel.textContent = T('gs.fruitmerge.dailyBest');
    } else {
      modeEl.textContent = '';
      modeEl.classList.remove('on');
      dailyBtn.textContent = T('gs.fruitmerge.daily');
      oDailyBtn.textContent = T('gs.fruitmerge.daily');
      bestLabel.textContent = T('gs.fruitmerge.best');
    }
    bestEl.textContent = String(dailyMode ? daily.best : best);
    comboEl.textContent = combo > 0 ? ('x' + Math.min(combo, 8)) : 'x0';
  }

  function updateHUD() {
    scoreEl.textContent = String(score);
    mergeEl.textContent = String(merges);
    bestEl.textContent = String(dailyMode ? daily.best : best);
    comboEl.textContent = combo > 0 ? ('x' + Math.min(combo, 8)) : 'x0';
    drawNextPreview();
  }

  function drawSpecialPreview(g, x, y, r, type) {
    if (type === 'bomb') {
      var bg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      bg.addColorStop(0, '#7a4b6b'); bg.addColorStop(0.5, '#2b1626'); bg.addColorStop(1, '#120a12');
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,45,149,0.8)'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#ffcc66'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x + r * 0.2, y - r * 0.9); g.quadraticCurveTo(x + r * 0.8, y - r * 1.4, x + r * 0.4, y - r * 1.7); g.stroke();
      g.fillStyle = '#ffe066'; g.beginPath(); g.arc(x + r * 0.4, y - r * 1.7, 2 + Math.abs(Math.sin(Date.now() / 140)) * 2, 0, Math.PI * 2); g.fill();
    } else {
      var rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, '#00f0ff');
      rg.addColorStop(0.65, '#ff2d95'); rg.addColorStop(1, '#7c4dff');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(x - r * 0.28, y - r * 0.3, r * 0.18, 0, Math.PI * 2); g.fill();
    }
  }

  function drawNextPreview() {
    nctx.clearRect(0, 0, 34, 34);
    if (nextSpecial) {
      drawSpecialPreview(nctx, 17, 18, 11, nextSpecial);
      return;
    }
    var c = LEVELS[next], r = 11;
    var grd = nctx.createRadialGradient(12, 10, 2, 17, 17, r);
    grd.addColorStop(0, c.hi); grd.addColorStop(0.45, c.a); grd.addColorStop(1, c.b);
    nctx.fillStyle = grd;
    nctx.beginPath(); nctx.arc(17, 18, r, 0, Math.PI * 2); nctx.fill();
    nctx.strokeStyle = 'rgba(255,255,255,0.5)'; nctx.lineWidth = 1; nctx.stroke();
    nctx.fillStyle = c.leaf;
    nctx.beginPath(); nctx.ellipse(22, 6, 5, 2.4, -0.5, 0, Math.PI * 2); nctx.fill();
  }

  /* ---------- 水果绘制 ---------- */
  function drawFruit(g, x, y, r, lv, scale, glow) {
    if (r <= 0) return;
    var c = LEVELS[Math.max(0, Math.min(MAXLV, lv))];
    g.save();
    g.translate(x, y);
    g.scale(scale || 1, scale || 1);

    /* 阴影 */
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(r * 0.18, r * 0.92, r * 0.92, r * 0.32, 0, 0, Math.PI * 2); g.fill();

    /* 球体渐变 */
    var grd = g.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.08, 0, 0, r * 1.05);
    grd.addColorStop(0, c.hi);
    grd.addColorStop(0.38, c.a);
    grd.addColorStop(1, c.b);
    if (glow) { g.shadowColor = c.a; g.shadowBlur = 18; }
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;

    /* 品种纹理 */
    g.save();
    g.beginPath(); g.arc(0, 0, r - 0.5, 0, Math.PI * 2); g.clip();
    if (lv === 0) {
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (var i = 0; i < 6; i++) {
        var a = i * 1.05;
        g.beginPath(); g.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.26, 0, Math.PI * 2); g.fill();
      }
    } else if (lv === 4) {
      g.fillStyle = 'rgba(40,60,20,0.55)';
      for (var k = 0; k < 8; k++) {
        var a2 = k * Math.PI / 4;
        g.beginPath(); g.ellipse(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45, 1.6, 2.8, a2, 0, Math.PI * 2); g.fill();
      }
    } else if (lv === 7) {
      g.strokeStyle = 'rgba(120,70,0,0.35)'; g.lineWidth = 1;
      for (var d1 = -r; d1 < r; d1 += r * 0.55) {
        g.beginPath(); g.moveTo(d1, -r); g.lineTo(d1 + r * 1.4, r); g.stroke();
        g.beginPath(); g.moveTo(d1, r); g.lineTo(d1 + r * 1.4, -r); g.stroke();
      }
    } else if (lv === 8) {
      g.strokeStyle = 'rgba(60,35,15,0.35)'; g.lineWidth = 1;
      for (var f = -r; f < r; f += r * 0.5) {
        g.beginPath(); g.moveTo(-r, f); g.quadraticCurveTo(0, f + r * 0.3, r, f); g.stroke();
      }
    } else if (lv === 10) {
      g.strokeStyle = 'rgba(20,60,20,0.55)'; g.lineWidth = Math.max(2, r * 0.09);
      for (var s2 = -2; s2 <= 2; s2++) {
        g.beginPath();
        g.moveTo(s2 * r * 0.38, -r * 0.98);
        g.quadraticCurveTo(s2 * r * 0.55, 0, s2 * r * 0.38, r * 0.98);
        g.stroke();
      }
    } else if (lv === 9) {
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2;
      for (var s3 = -2; s3 <= 2; s3++) {
        g.beginPath(); g.moveTo(s3 * r * 0.4, -r); g.quadraticCurveTo(s3 * r * 0.55, 0, s3 * r * 0.4, r); g.stroke();
      }
    }
    g.restore();

    /* 高光 */
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.ellipse(-r * 0.34, -r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2); g.fill();

    /* 叶片 / 果柄 */
    g.fillStyle = c.leaf;
    g.beginPath(); g.ellipse(r * 0.34, -r * 0.88, r * 0.32, r * 0.14, -0.55, 0, Math.PI * 2); g.fill();
    g.strokeStyle = c.leaf; g.lineWidth = Math.max(1.5, r * 0.08);
    g.beginPath(); g.moveTo(0, -r * 0.96); g.lineTo(0, -r * 1.12); g.stroke();

    /* 表情 */
    var eyeY = -r * 0.12, eyeX = r * 0.3, eyeR = Math.max(2, r * 0.13);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(-eyeX, eyeY, eyeR, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b2433';
    g.beginPath(); g.arc(-eyeX + eyeR * 0.25, eyeY + eyeR * 0.15, eyeR * 0.55, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(eyeX + eyeR * 0.25, eyeY + eyeR * 0.15, eyeR * 0.55, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(60,30,40,0.75)'; g.lineWidth = Math.max(1.4, r * 0.06);
    g.beginPath(); g.arc(0, r * 0.18, r * 0.28, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,90,120,0.22)';
    g.beginPath(); g.arc(-r * 0.52, r * 0.16, r * 0.12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(r * 0.52, r * 0.16, r * 0.12, 0, Math.PI * 2); g.fill();

    g.restore();
  }

  function drawSpecial(g, f, scale) {
    var r = f.r, x = f.x, y = f.y;
    g.save();
    g.translate(x, y);
    g.scale(scale || 1, scale || 1);
    if (f.special === 'bomb') {
      var pulse = f.fuse > 0 ? (0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 90))) : 1;
      g.shadowColor = 'rgba(255,45,149,' + pulse + ')'; g.shadowBlur = 16;
      var bg = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
      bg.addColorStop(0, '#7a4b6b'); bg.addColorStop(0.5, '#2b1626'); bg.addColorStop(1, '#120a12');
      g.fillStyle = bg; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,45,149,' + pulse + ')'; g.lineWidth = 2.2;
      g.beginPath(); g.arc(0, 0, r - 1, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath(); g.ellipse(-r * 0.3, -r * 0.35, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffcc66'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(r * 0.15, -r * 0.88); g.quadraticCurveTo(r * 0.95, -r * 1.35, r * 0.4, -r * 1.7); g.stroke();
      g.fillStyle = '#ffe066';
      g.beginPath(); g.arc(r * 0.4, -r * 1.7, 2.4 + Math.abs(Math.sin(Date.now() / 130)) * 2.2, 0, Math.PI * 2); g.fill();
    } else {
      g.save();
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
      for (var i = 0; i < 7; i++) {
        g.fillStyle = 'hsl(' + ((i * 51 + Date.now() / 18) % 360) + ',92%,62%)';
        g.beginPath(); g.arc(0, 0, r, (i / 7) * Math.PI * 2, ((i + 1) / 7) * Math.PI * 2 + 0.02); g.fill();
      }
      g.restore();
      var rg = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.25)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 0, r - 1, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#fff';
      for (var s = 0; s < 3; s++) {
        var ang = Date.now() / 900 + s * 2.1;
        g.beginPath(); g.arc(Math.cos(ang) * r * 0.55, Math.sin(ang) * r * 0.55, r * 0.13, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }

  /* ---------- 反馈 ---------- */
  function addText(x, y, text, color) {
    texts.push({ x: x, y: y, text: text, color: color || '#ffe066', life: 1, vy: -0.9 });
    if (texts.length > 22) texts.shift();
  }
  function addParts(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 4.2;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4, life: 1, color: color, size: 1.5 + Math.random() * 3 });
    }
    if (parts.length > 160) parts = parts.slice(-160);
  }

  /* ---------- 物理 ---------- */
  function clampAim(x) {
    var r = radiusOf(current);
    return GK.clamp(x, r + 2, W - r - 2);
  }

  function drop() {
    if (over || paused || dropCool > 0) return;
    dropCool = 18;
    var lv = current, r = radiusOf(lv);
    var special = currentSpecial;
    if (special) r = Math.max(r, 16);
    fruits.push({
      x: clampAim(aimX), y: SPAWN_Y, vx: 0, vy: 1.2, r: r, lv: lv,
      pop: 1, flash: 0, born: Date.now(), landed: false, special: special || null, fuse: 0, dead: false, age: 0
    });
    dropCount++;
    if (Arcade.audio) Arcade.audio.play(special ? 'coin' : 'drop');
    /* 粒子统一走画布内层级（parts），避免 body 级 DOM 粒子溢出视口 */
    addParts(aimX, SPAWN_Y, special === 'rainbow' ? '#ffffff' : LEVELS[lv].a, 8);
    current = next;
    next = rollNext();
    currentSpecial = nextSpecial;
    nextSpecial = rollSpecial();
    aimX = clampAim(aimX);
    msg.textContent = T('gs.fruitmerge.help'); msg.style.color = '';
    updateHUD();
  }

  function pulseCombo() {
    if (comboTimer > 0) combo += 1; else combo = 1;
    comboTimer = COMBO_MS;
    if (combo > maxCombo) maxCombo = combo;
  }

  function mergePair(a, b) {
    var newLv = Math.min(MAXLV, a.lv + 1);
    var nr = radiusOf(newLv);
    var massA = a.r * a.r, massB = b.r * b.r;
    a.x = (a.x * massA + b.x * massB) / (massA + massB);
    a.y = (a.y * massA + b.y * massB) / (massA + massB);
    a.lv = newLv;
    a.r = nr;
    a.vx = (a.vx + b.vx) * 0.5;
    a.vy = (a.vy + b.vy) * 0.5 - 1.8;
    a.pop = 1.45; a.flash = 1;
    a.landed = a.landed || b.landed;
    merges++;
    pulseCombo();
    var mult = Math.min(8, combo);
    score += (newLv + 1) * 10 * mult;
    addText(a.x, a.y - nr, '+' + ((newLv + 1) * 10 * mult) + (mult > 1 ? ' x' + mult : ''), LEVELS[Math.min(newLv, MAXLV)].a);
    addParts(a.x, a.y, LEVELS[Math.min(newLv, MAXLV)].a, newLv >= 8 ? 18 : 9);
    shake = Math.max(shake, newLv >= 8 ? 7 : 3);
    if (newLv >= 8) flashAlpha = Math.max(flashAlpha, 0.16);
    if (newLv > maxLevel) {
      maxLevel = newLv;
      gravity = 0.34 + Math.min(0.16, maxLevel * 0.012);
      if (newLv === 10) {
        msg.textContent = T('gs.fruitmerge.watermelon'); msg.style.color = 'var(--neon-yellow)';
        var token = runToken;
        setTimeout(function () {
          if (!over && token === runToken) { msg.textContent = T('gs.fruitmerge.keepGoing'); msg.style.color = ''; }
        }, 1200);
      }
    }
    if (Arcade.audio) Arcade.audio.play(newLv >= 8 ? 'clear' : 'merge');
    updateHUD();
  }

  function mergeRainbow(rb, target) {
    var newLv = Math.min(MAXLV, target.lv + 1);
    target.lv = newLv;
    target.r = radiusOf(newLv);
    target.pop = 1.5; target.flash = 1;
    merges++;
    pulseCombo();
    var mult = Math.min(8, combo);
    var gain = (newLv + 1) * 14 * mult;
    score += gain;
    addText(target.x, target.y - target.r, T('gs.fruitmerge.rainbowMerge') + ' +' + gain, '#00f0ff');
    addParts(target.x, target.y, '#ff2d95', 20);
    addParts(target.x, target.y, '#00f0ff', 20);
    if (newLv > maxLevel) maxLevel = newLv;
    rb.dead = true;
    shake = Math.max(shake, 5);
    flashAlpha = 0.35;
    if (Arcade.audio) Arcade.audio.play('clear');
    updateHUD();
  }

  function explode(bomb) {
    if (bomb.dead) return;
    bomb.dead = true;
    var radius = 92;
    var hits = 0;
    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (f === bomb || f.dead) continue;
      var dx = f.x - bomb.x, dy = f.y - bomb.y;
      if (Math.sqrt(dx * dx + dy * dy) < radius + f.r * 0.5) {
        f.dead = true; hits++;
      }
    }
    score += 18 + hits * 12;
    addText(bomb.x, bomb.y - bomb.r, T('gs.fruitmerge.bombBoom') + ' +' + (18 + hits * 12), '#ff6b9d');
    addParts(bomb.x, bomb.y, '#ff2d95', 34);
    addParts(bomb.x, bomb.y, '#ffcc66', 26);
    shake = 14; flashAlpha = 0.55;
    if (Arcade.audio) Arcade.audio.play('clear');
    if (Arcade.fx) Arcade.fx.flash('rgba(255,45,149,0.35)');
    updateHUD();
  }

  function resolvePhysics() {
    var pass, i, j;
    for (pass = 0; pass < 3; pass++) {
      for (i = 0; i < fruits.length; i++) {
        var a = fruits[i];
        if (a.dead) continue;
        for (j = i + 1; j < fruits.length; j++) {
          var b = fruits[j];
          if (b.dead) continue;
          var dx = b.x - a.x, dy = b.y - a.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var minD = a.r + b.r;
          if (d >= minD || d <= 0.0001) continue;
          if (a.special === 'rainbow' && !b.special) { a.landed = true; b.landed = true; mergeRainbow(a, b); continue; }
          if (b.special === 'rainbow' && !a.special) { a.landed = true; b.landed = true; mergeRainbow(b, a); continue; }
          if (!a.special && !b.special && a.lv === b.lv && a.lv < MAXLV) {
            a.landed = true; b.landed = true;
            mergePair(a, b);
            b.dead = true;
            continue;
          }
          var nx = dx / d, ny = dy / d;
          var overlap = minD - d;
          var ma = a.r * a.r, mb = b.r * b.r, inv = 1 / (ma + mb);
          a.x -= nx * overlap * 0.55 * (mb * inv);
          a.y -= ny * overlap * 0.55 * (mb * inv);
          b.x += nx * overlap * 0.55 * (ma * inv);
          b.y += ny * overlap * 0.55 * (ma * inv);
          var rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rvn < 0) {
            var imp = -(1 + 0.16) * rvn / (1 / ma + 1 / mb);
            a.vx -= imp * nx / ma;
            a.vy -= imp * ny / ma;
            b.vx += imp * nx / mb;
            b.vy += imp * ny / mb;
          }
          a.landed = true; b.landed = true;
        }
      }
      if (pass === 0) fruits = fruits.filter(function (f) { return !f.dead; });
    }
    fruits = fruits.filter(function (f) { return !f.dead; });
  }

  function update() {
    if (over || paused) return;
    var i;
    if (dropCool > 0) dropCool--;
    if (comboTimer > 0) {
      comboTimer -= 16;
      if (comboTimer <= 0) { welcomeComboBreak(); }
    }
    if (shake > 0) shake *= 0.9;
    if (shake < 0.4) shake = 0;
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.035);

    for (i = texts.length - 1; i >= 0; i--) {
      var t = texts[i];
      t.y += t.vy; t.life -= 0.028;
      if (t.life <= 0) texts.splice(i, 1);
    }
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.vx *= 0.99; p.life -= 0.024;
      if (p.life <= 0) parts.splice(i, 1);
    }

    for (i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      f.age = (f.age || 0) + 1;
      f.vy += gravity;
      if (f.vy > 13) f.vy = 13;
      f.vx *= 0.995;
      f.x += f.vx;
      f.y += f.vy;
      if (f.x - f.r < 0) { f.x = f.r; f.vx = Math.abs(f.vx) * 0.45; }
      if (f.x + f.r > W) { f.x = W - f.r; f.vx = -Math.abs(f.vx) * 0.45; }
      if (f.y + f.r > FLOOR) {
        f.y = FLOOR - f.r;
        if (f.vy > 0) {
          f.vy *= -0.24;
          if (Math.abs(f.vy) < 1.1) f.vy = 0;
        }
        f.vx *= 0.82;
        f.landed = true;
      }
      f.pop += (1 - f.pop) * 0.14;
      if (f.flash > 0) f.flash -= 0.06;
      if (f.special === 'bomb' && f.landed) {
        f.fuse += 16;
        if (f.fuse >= 900) explode(f);
      }
    }
    resolvePhysics();

    /* 接触即判负：任何已落定水果顶部触及警戒线，立即结束 */
    for (i = 0; i < fruits.length; i++) {
      var g2 = fruits[i];
      if (g2.landed && !g2.dead && g2.y - g2.r < DANGER_Y - 1) {
        endGame(false);
        return;
      }
    }
  }

  function welcomeComboBreak() {
    combo = 0;
    comboTimer = 0;
    updateHUD();
  }

  /* ---------- 渲染 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1226'); bg.addColorStop(0.55, '#0a0f1e'); bg.addColorStop(1, '#070a14');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    /* 霓虹网格 */
    ctx.strokeStyle = 'rgba(0,240,255,0.045)'; ctx.lineWidth = 1;
    for (var gx = 40; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 40; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    /* 顶部警戒区 */
    var dz = ctx.createLinearGradient(0, 0, 0, DANGER_Y + 20);
    dz.addColorStop(0, 'rgba(255,45,149,0.10)'); dz.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = dz; ctx.fillRect(0, 0, W, DANGER_Y + 20);

    /* 警戒线：危险时闪烁 */
    var dangerOn = false;
    for (var di = 0; di < fruits.length; di++) {
      var df = fruits[di];
      if (df.landed && df.y - df.r < DANGER_Y + 24) { dangerOn = true; break; }
    }
    var blink = dangerOn ? (0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 170))) : 0.35;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,45,149,' + blink + ')';
    ctx.lineWidth = dangerOn ? 2.8 : 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(W, DANGER_Y); ctx.stroke();
    ctx.restore();
    if (dangerOn && !over) {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = 'rgba(255,90,150,' + blink + ')';
      ctx.fillText(T('gs.fruitmerge.topWarn'), W / 2, DANGER_Y - 16);
      ctx.restore();
    }

    /* 瞄准虚线 + 当前水果预览 */
    if (!over) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,240,255,0.22)'; ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(aimX, SPAWN_Y + radiusOf(current)); ctx.lineTo(aimX, DANGER_Y + 14); ctx.stroke();
      ctx.restore();
      var pr = radiusOf(current);
      if (currentSpecial) drawSpecial(ctx, { x: clampAim(aimX), y: SPAWN_Y, r: Math.max(pr, 16), special: currentSpecial, fuse: 0 }, 0.94);
      else drawFruit(ctx, clampAim(aimX), SPAWN_Y, pr, current, 0.94, true);
    }

    /* 水果 */
    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (f.dead) continue;
      if (f.special) drawSpecial(ctx, f, f.pop || 1);
      else drawFruit(ctx, f.x, f.y, f.r, f.lv, f.pop || 1, f.flash > 0);
    }

    /* 粒子 */
    for (var pi = 0; pi < parts.length; pi++) {
      var pp = parts[pi];
      ctx.globalAlpha = Math.max(0, pp.life);
      ctx.fillStyle = pp.color;
      ctx.fillRect(pp.x - pp.size / 2, pp.y - pp.size / 2, pp.size, pp.size);
    }
    ctx.globalAlpha = 1;

    /* 飘字 */
    for (var ti = 0; ti < texts.length; ti++) {
      var tt = texts[ti];
      ctx.globalAlpha = Math.max(0, Math.min(1, tt.life));
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = tt.color;
      ctx.fillText(tt.text, tt.x, tt.y);
    }
    ctx.globalAlpha = 1;

    /* 连击提示 */
    if (combo > 1 && comboTimer > 0) {
      var cAlpha = Math.min(1, comboTimer / 500);
      ctx.save();
      ctx.globalAlpha = cAlpha;
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffe066';
      ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 12;
      ctx.fillText('COMBO x' + Math.min(8, combo), W - 12, DANGER_Y + 18);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* 底部地面 */
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, FLOOR, W, H - FLOOR);

    if (flashAlpha > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, flashAlpha) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    if (paused && !over) {
      ctx.fillStyle = 'rgba(4,7,16,0.78)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe066'; ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(T('gs.fruitmerge.paused'), W / 2, H / 2);
      ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(T('gs.fruitmerge.pauseHint'), W / 2, H / 2 + 28);
    }
    ctx.restore();
  }

  /* ---------- 结算 ---------- */
  function commitScore() {
    if (submitted) return;
    submitted = true;
    if (dailyMode) {
      daily.plays += 1;
      if (score > daily.best) daily.best = score;
      saveDaily();
      return;
    }
    if (window.Arcade && Arcade.shell) Arcade.shell.submitScore(score);
    if (window.Arcade && Arcade.storage) best = Arcade.storage.getBest('fruitmerge') || best;
    if (best < score) best = score;
    bestEl.textContent = String(best);
  }

  function endGame(isWin) {
    if (over) return;
    over = true;
    won = !!isWin;
    paused = false;
    if (Arcade.juice) Arcade.juice.lose();
    commitScore();
    oTitle.textContent = won ? T('gs.fruitmerge.victory') : T('gs.fruitmerge.dead');
    oTitle.style.color = won ? 'var(--neon-green)' : 'var(--neon-pink)';
    oScore.textContent = T('gs.fruitmerge.finalScore').replace('{s}', score) + ' · ' + T('gs.fruitmerge.bestScore').replace('{b}', dailyMode ? daily.best : best);
    oSub.innerHTML =
      T('gs.fruitmerge.finalRank').replace('{n}', maxLevel) + ' · ' +
      T('gs.fruitmerge.finalCombo').replace('{n}', maxCombo) + '<br>' +
      (dailyMode
        ? T('gs.fruitmerge.dailyResult').replace('{b}', daily.best).replace('{n}', daily.plays)
        : T('gs.fruitmerge.finalMerges').replace('{n}', merges));
    overEl.classList.add('show');
    msg.textContent = won ? T('gs.fruitmerge.victory') : T('gs.fruitmerge.dead');
    msg.style.color = won ? 'var(--neon-green)' : 'var(--neon-pink)';
    updateHUD();
  }
  function hideOver() { overEl.classList.remove('show'); }

  function togglePause() {
    if (over) return;
    paused = !paused;
    pauseBtn.textContent = paused ? T('gs.fruitmerge.resume') : T('gs.fruitmerge.pause');
    if (paused) { msg.textContent = T('gs.fruitmerge.paused'); msg.style.color = 'var(--neon-yellow)'; }
    else { msg.textContent = T('gs.fruitmerge.help'); msg.style.color = ''; }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function restart() {
    var d = dailyMode;
    setup({ daily: d });
    pauseBtn.textContent = T('gs.fruitmerge.pause');
    msg.textContent = T('gs.fruitmerge.help'); msg.style.color = '';
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function toggleDaily() {
    dailyMode = !dailyMode;
    restart();
    if (Arcade.audio) Arcade.audio.play(dailyMode ? 'daily' : 'ui');
  }

  /* ---------- 输入 ---------- */
  function setAimFromEvent(e) {
    var p = GK.pointer(canvas, e);
    aimX = clampAim(p.x);
  }
  canvas.addEventListener('mousemove', setAimFromEvent);
  canvas.addEventListener('mousedown', function (e) { setAimFromEvent(e); drop(); e.preventDefault(); });
  canvas.addEventListener('touchstart', function (e) { setAimFromEvent(e); touchActive = true; e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { setAimFromEvent(e); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchend', function (e) {
    if (touchActive) { touchActive = false; drop(); }
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') {
      if (e.code === 'Space' || e.code === 'Enter') return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { aimX = clampAim(aimX - 24); e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { aimX = clampAim(aimX + 24); e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'Enter') { drop(); e.preventDefault(); }
    else if (e.code === 'KeyP') { togglePause(); e.preventDefault(); }
  });
  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', restart);
  dailyBtn.addEventListener('click', toggleDaily);
  oRestBtn.addEventListener('click', restart);
  oDailyBtn.addEventListener('click', toggleDaily);

  /* helpText */
  var hd = document.createElement('div');
  hd.className = 'fm-help';
  hd.innerHTML = T('gs.fruitmerge.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () { restart(); };

  /* ---------- QA 钩子（仅 ?qa=1） ---------- */
  if (QA) {
    window.__qa = {
      state: function () {
        return {
          score: score, best: best, over: over, won: won, daily: dailyMode, dailyDate: daily.date,
          dailyBest: daily.best, merges: merges, maxLevel: maxLevel, combo: combo, maxCombo: maxCombo,
          current: current, next: next, special: currentSpecial, nextSpecial: nextSpecial,
          fruits: fruits.length, paused: paused
        };
      },
      start: function (opts) { setup(opts || {}); return this.state(); },
      drop: function (x) { if (x != null) aimX = clampAim(x); dropCool = 0; drop(); return this.state(); },
      setChain: function (n) { combo = n; comboTimer = COMBO_MS; if (combo > maxCombo) maxCombo = combo; updateHUD(); return this.state(); },
      injectSpecial: function (type, x) {
        var r = 18;
        fruits.push({ x: x == null ? W / 2 : x, y: SPAWN_Y + 34, vx: 0, vy: 2, r: r, lv: 2, pop: 1, flash: 0,
          born: Date.now(), landed: false, special: type, fuse: 0, dead: false, age: 0 });
        return this.state();
      },
      fruitInfo: function () {
        return fruits.map(function (f) {
          return { x: Math.round(f.x), y: Math.round(f.y), r: Math.round(f.r), lv: f.lv, special: f.special,
            landed: f.landed, fuse: f.fuse, dead: f.dead };
        });
      },
      win: function () { score = Math.max(score, 900); maxCombo = Math.max(maxCombo, 5); endGame(true); return this.state(); },
      lose: function () { endGame(false); return this.state(); },
      forceDanger: function () {
        fruits.push({ x: W / 2, y: DANGER_Y - 4, vx: 0, vy: 0, r: 24, lv: 3, pop: 1, flash: 0,
          born: Date.now(), landed: true, special: null, fuse: 0, dead: false, age: 0 });
        return this.state();
      }
    };
  }

  setup();
  loopApi = Arcade.loop.start(update, draw, 16);
})();
