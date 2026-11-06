/* 小行星 Asteroid Field —— 旗舰重制
   闭环：难度选择 → 波次战斗（陨石 / 装甲陨石 / 冰晶陨石 / UFO / 巨型陨石）→ 生命耗尽失败或全波通过
        → 结算（分数、波次、最高分、存活时间、再来一局）
   输入：键盘（←→/AD 转向、↑/W 推进、↓/S 刹车或反向、空格开火、Shift 护盾、E 冲刺、P 暂停）
        触屏（左侧虚拟摇杆 + 右侧 FIRE / SHIELD / DASH 大按钮），两套输入均可完整游玩。
   视觉：Canvas 矢量霓虹——多边形飞船 + 尾焰、三类陨石、飞碟、道具、爆炸碎片、冲击波、视差星空、屏震。
   ============================================================ */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.asteroidf.tut1t'), d: T('gs.asteroidf.tut1') },
  { t: T('gs.asteroidf.tut2t'), d: T('gs.asteroidf.tut2') },
  { t: T('gs.asteroidf.tut3t'), d: T('gs.asteroidf.tut3') },
  { t: T('gs.asteroidf.tut4t'), d: T('gs.asteroidf.tut4') }
];

(function () {
  /* ==AST-CORE-START== */
  var TAU = Math.PI * 2;
  var STEP = 16;
  var SHIP_R = 11;
  var INVULN_STEPS = 120;            // 2 秒复活无敌
  var PORTRAIT = (window.innerHeight > window.innerWidth * 1.05) || window.innerWidth < 520;
  var W = PORTRAIT ? 400 : 640;
  var H = PORTRAIT ? 440 : 420;
  var SPEED_K = H / 420;

  var DIFFS = [
    { waves: 4, perWave: 3, speed: 0.82, label: 'gs.asteroidf.dEasy', desc: 'gs.asteroidf.dEasyD' },
    { waves: 5, perWave: 4, speed: 1.00, label: 'gs.asteroidf.dNormal', desc: 'gs.asteroidf.dNormalD' },
    { waves: 6, perWave: 5, speed: 1.18, label: 'gs.asteroidf.dHard', desc: 'gs.asteroidf.dHardD' }
  ];
  var WAVE_BONUS = 100, WIN_BONUS = 300;
  var UFO_SCORE = 150, BOSS_SCORE = 400;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function wrapVal(v, min, max) { var span = max - min; return ((v - min) % span + span) % span + min; }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function fmtTime(steps) {
    var sec = Math.max(0, Math.floor(steps * STEP / 1000));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /** 半径 / 分值 / 耐久：大中小三档分裂 + 装甲 + 冰晶 + 冰碎片 + 巨型 */
  function radiusFor(kind, tier) {
    if (kind === 'boss') return 54;
    if (kind === 'armor') return 24;
    if (kind === 'ice') return 22;
    if (kind === 'shard') return 7.5;
    if (tier === 3) return 26;
    if (tier === 2) return 17;
    return 10.5;
  }
  function scoreFor(kind, tier) {
    if (kind === 'boss') return BOSS_SCORE;
    if (kind === 'armor') return 90;
    if (kind === 'ice') return 70;
    if (kind === 'shard') return 25;
    if (tier === 3) return 20;
    if (tier === 2) return 40;
    return 60;
  }
  function hpFor(kind) {
    if (kind === 'armor') return 3;
    if (kind === 'boss') return 9;
    return 1;
  }

  /** 生成一枚陨石（kind: rock / armor / ice / shard / boss） */
  function mkAsteroid(x, y, kind, tier, speedMul, wave) {
    var base = radiusFor(kind, tier) * (kind === 'shard' ? rand(0.85, 1.2) : rand(0.93, 1.07));
    var n;
    if (kind === 'ice') n = 6 + Math.floor(rand(0, 3));
    else if (kind === 'shard') n = 3 + Math.floor(rand(0, 2));
    else if (kind === 'boss') n = 14 + Math.floor(rand(0, 3));
    else if (kind === 'armor') n = 10 + Math.floor(rand(0, 3));
    else n = (tier === 3 ? 11 : 8) + Math.floor(rand(0, 3));
    var pts = [];
    for (var v = 0; v < n; v++) {
      var a = v / n * TAU;
      var ratio = kind === 'ice' ? rand(0.58, 1.24)
        : kind === 'shard' ? rand(0.5, 1.1)
        : kind === 'armor' ? rand(0.84, 1.08)
        : rand(0.72, 1.12);
      pts.push([Math.cos(a) * base * ratio, Math.sin(a) * base * ratio]);
    }
    var craters = [];
    if (kind === 'rock' || kind === 'armor' || kind === 'boss') {
      var cn = kind === 'boss' ? 5 : (tier === 3 ? 2 + Math.floor(rand(0, 3)) : 1 + Math.floor(rand(0, 2)));
      for (var c = 0; c < cn; c++) {
        var ca = Math.random() * TAU, cd = rand(0.12, 0.56) * base;
        craters.push({ x: Math.cos(ca) * cd, y: Math.sin(ca) * cd, r: base * rand(0.07, 0.16), a: Math.random() * TAU });
      }
    }
    var plates = [], cracks = [];
    if (kind === 'armor' || kind === 'boss' || kind === 'ice') {
      for (var pl = 0; pl < 3; pl++) plates.push({ a: rand(0, TAU), d: rand(0.1, 0.6), l: rand(0.5, 0.95) });
    }
    if (kind === 'armor' || kind === 'boss') {
      for (var cr = 0; cr < 8; cr++) {
        var ca2 = rand(0, TAU), r0 = rand(0.05, 0.3) * base;
        var seg = [[Math.cos(ca2) * r0, Math.sin(ca2) * r0]];
        for (var s2 = 1; s2 <= 3; s2++) {
          var rr2 = r0 + base * (s2 / 3) * rand(0.36, 0.5);
          seg.push([Math.cos(ca2 + rand(-0.18, 0.18)) * rr2, Math.sin(ca2 + rand(-0.18, 0.18)) * rr2]);
        }
        cracks.push(seg);
      }
    }
    var speedBase = kind === 'boss' ? 0.26
      : kind === 'armor' ? 0.42
      : kind === 'ice' ? 0.78
      : kind === 'shard' ? 2.5
      : (tier === 3 ? 0.55 : (tier === 2 ? 0.95 : 1.35));
    var ang = Math.random() * TAU;
    var sp = (speedBase + Math.random() * (kind === 'shard' ? 0.8 : 0.55)) * speedMul * SPEED_K;
    var vr = kind === 'boss' ? rand(-0.006, 0.006) : rand(-0.034, 0.034) * (tier === 3 ? 0.8 : 1.5);
    return {
      x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      kind: kind, tier: tier, base: base, pts: pts, craters: craters, plates: plates, cracks: cracks,
      hp: hpFor(kind), maxHp: hpFor(kind), score: scoreFor(kind, tier), flash: 0,
      rot: Math.random() * TAU, vr: vr
    };
  }

  /** 在远离飞船的位置生成陨石 */
  function spawnAsteroid(state, wave, kind, tier) {
    var speedMul = state.conf.speed * (1 + (wave - 1) * 0.09);
    var base = radiusFor(kind, tier);
    for (var tries = 0; tries < 48; tries++) {
      var x = rand(base + 16, W - base - 16);
      var y = rand(base + 16, H - base - 16);
      if (kind === 'boss') { x = rand(W * 0.28, W * 0.72); y = rand(70, H * 0.3); }
      if (dist2(x, y, state.ship.x, state.ship.y) < 175 * 175) continue;
      var ok = true;
      for (var i = 0; i < state.roids.length; i++) {
        if (dist2(x, y, state.roids[i].x, state.roids[i].y) < 74 * 74) { ok = false; break; }
      }
      if (!ok) continue;
      return mkAsteroid(x, y, kind, tier, speedMul, wave);
    }
    return mkAsteroid(rand(50, W - 50), rand(50, H - 50), kind, tier, speedMul, wave);
  }

  function pickSpec(n) {
    var r = Math.random();
    if (n >= 2 && r < 0.14) return { kind: 'armor', tier: 3 };
    if (n >= 2 && r < 0.30) return { kind: 'ice', tier: 3 };
    if (r < 0.55) return { kind: 'rock', tier: 3 };
    if (r < 0.82) return { kind: 'rock', tier: 2 };
    return { kind: 'rock', tier: 1 };
  }

  /** 分裂：大 → 2 中，中 → 2 小，冰晶 → 3 高速碎片，巨型 → 4 中，装甲不分裂 */
  function splitAsteroid(state, r) {
    var out = [];
    var speedMul = state.conf.speed * (1 + (state.wave - 1) * 0.09);
    function child(angle, kind, tier, burst) {
      var nr = mkAsteroid(r.x + Math.cos(angle) * r.base * 0.35, r.y + Math.sin(angle) * r.base * 0.35, kind, tier, speedMul, state.wave);
      nr.vx = r.vx * 0.55 + Math.cos(angle) * burst;
      nr.vy = r.vy * 0.55 + Math.sin(angle) * burst;
      out.push(nr);
    }
    if (r.kind === 'ice') {
      for (var i = 0; i < 3; i++) child(Math.random() * TAU + i * TAU / 3, 'shard', 1, rand(2.4, 3.4));
    } else if (r.kind === 'boss') {
      for (var b = 0; b < 4; b++) child(b * Math.PI / 2 + rand(-0.2, 0.2), 'rock', 2, rand(1.4, 2.2));
    } else if (r.kind === 'rock') {
      if (r.tier === 3) {
        child(rand(0, TAU), 'rock', 2, rand(1.2, 1.9));
        child(rand(0, TAU), 'rock', 2, rand(1.2, 1.9));
      } else if (r.tier === 2) {
        child(rand(0, TAU), 'rock', 1, rand(1.5, 2.4));
        child(rand(0, TAU), 'rock', 1, rand(1.5, 2.4));
      }
    }
    return out;
  }
  /* ==AST-CORE-END== */

  var root = document.getElementById('game-root');
  if (!root) return;

  var BEST_ID = 'asteroidf';
  try { BEST_ID = document.body.getAttribute('data-game-id') || 'asteroidf'; } catch (e) {}

  var st = null, loopApi = null, paused = false;
  var keys = { left: false, right: false, thrust: false, reverse: false, fire: false };
  var touchFire = false;
  var stick = { x: 0, y: 0, id: null };
  var diffIdx = 1;
  var camX = 0, camY = 0;

  /* ---------- DOM ---------- */
  root.innerHTML =
    '<div class="as-wrap">' +
      '<div class="as-hud">' +
        '<div class="as-hud-row">' +
          '<span class="as-stat">' + T('gs.asteroidf.score') + '<b id="as-score">0</b></span>' +
          '<span class="as-stat">' + T('gs.asteroidf.wave') + '<b id="as-wave">1/5</b></span>' +
          '<span class="as-stat">' + T('gs.asteroidf.lives') + '<b id="as-lives">3</b></span>' +
          '<span class="as-stat as-best-wrap">' + T('gs.asteroidf.best') + '<b id="as-best">0</b></span>' +
          '<button class="as-pause-mini" type="button" id="as-hud-pause" aria-label="' + T('gs.asteroidf.pauseBtn') + '"><span class="as-pause-ico"></span></button>' +
        '</div>' +
        '<div class="as-meters">' +
          '<span class="as-meter"><i class="as-dot-shield"></i><em>' + T('gs.asteroidf.shield') + '</em>' +
            '<span class="as-shield-bar"><s class="as-shield-fill" id="as-shield-fill"></s></span></span>' +
          '<span class="as-meter spread"><em>' + T('gs.asteroidf.spread') + '</em><b id="as-spread">--</b></span>' +
          '<span class="as-meter rapid"><em>' + T('gs.asteroidf.rapid') + '</em><b id="as-rapid">--</b></span>' +
        '</div>' +
      '</div>' +
      '<div class="as-stage" id="as-stage">' +
        '<canvas id="as-canvas" class="as-canvas"></canvas>' +
        '<div class="as-wave-banner" id="as-wave-banner"></div>' +
        '<div class="as-overlay" id="as-start">' +
          '<div class="as-card">' +
            '<h2>' + T('gs.asteroidf.tutTitle') + '</h2>' +
            '<p>' + T('gs.asteroidf.pickDesc') + '</p>' +
            '<div class="as-diffs">' +
              DIFFS.map(function (d, i) {
                return '<button class="btn mode-btn" type="button" data-diff="' + i + '">' + T(d.label) + '<small>' + T(d.desc) + '</small></button>';
              }).join('') +
            '</div>' +
            '<div class="as-pick-hint">' + T('gs.asteroidf.pickHint') + '</div>' +
            '<div class="as-ctl-help">' +
              '<div><b>' + T('gs.asteroidf.touch') + '</b>' + T('gs.asteroidf.touchHelp') + '</div>' +
              '<div><b>' + T('gs.asteroidf.keyboard') + '</b>' + T('gs.asteroidf.keysHelp') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="as-overlay hidden" id="as-pause">' +
          '<div class="as-card">' +
            '<h2>' + T('gs.asteroidf.pauseTitle') + '</h2>' +
            '<p>' + T('gs.asteroidf.pauseHint') + '</p>' +
            '<button class="btn green" type="button" id="as-resume">' + T('gs.asteroidf.resume') + '</button>' +
            '<button class="btn" type="button" id="as-pause-restart">' + T('gs.asteroidf.restart') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="as-overlay hidden" id="as-result">' +
          '<div class="as-card">' +
            '<h2 id="as-res-title"></h2>' +
            '<p id="as-res-text"></p>' +
            '<div class="as-stats">' +
              '<span>' + T('gs.asteroidf.score') + '<b id="as-final-score">0</b></span>' +
              '<span>' + T('gs.asteroidf.wave') + '<b id="as-final-wave">0</b></span>' +
              '<span>' + T('gs.asteroidf.best') + '<b id="as-final-best">0</b></span>' +
              '<span>' + T('gs.asteroidf.time') + '<b id="as-final-time">0:00</b></span>' +
            '</div>' +
            '<div class="as-new hidden" id="as-new">' + T('gs.asteroidf.newRecord') + '</div>' +
            '<div class="as-btns">' +
              '<button class="btn green" type="button" id="as-again">' + T('gs.asteroidf.again') + '</button>' +
              '<button class="btn purple" type="button" id="as-change">' + T('gs.asteroidf.changeDiff') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="as-deck" id="as-deck">' +
        '<div class="as-stick" id="as-stick" role="group" aria-label="' + T('gs.asteroidf.joystick') + '">' +
          '<div class="as-stick-knob" id="as-stick-knob"></div>' +
        '</div>' +
        '<div class="as-acts">' +
          '<button class="as-act fire" type="button" data-act="fire" aria-label="' + T('gs.asteroidf.fire') + '"><i class="as-ico-fire"></i><span>' + T('gs.asteroidf.fire') + '</span></button>' +
          '<button class="as-act shield" type="button" data-act="shield" aria-label="' + T('gs.asteroidf.shield') + '"><i class="as-ico-shield"></i><span>' + T('gs.asteroidf.shield') + '</span></button>' +
          '<button class="as-act dash" type="button" data-act="dash" aria-label="' + T('gs.asteroidf.dash') + '"><i class="as-ico-dash"></i><span>' + T('gs.asteroidf.dash') + '</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="as-msg" id="as-msg" aria-live="polite"></div>' +
    '</div>';

  var wrapEl = root.querySelector('.as-wrap');
  var canvas = root.querySelector('#as-canvas');
  var stageEl = root.querySelector('#as-stage');
  var bannerEl = root.querySelector('#as-wave-banner');
  var startEl = root.querySelector('#as-start');
  var pauseEl = root.querySelector('#as-pause');
  var resultEl = root.querySelector('#as-result');
  var scoreEl = root.querySelector('#as-score');
  var livesEl = root.querySelector('#as-lives');
  var waveEl = root.querySelector('#as-wave');
  var bestEl = root.querySelector('#as-best');
  var shieldFillEl = root.querySelector('#as-shield-fill');
  var spreadEl = root.querySelector('#as-spread');
  var rapidEl = root.querySelector('#as-rapid');
  var msgEl = root.querySelector('#as-msg');
  var resultTitle = root.querySelector('#as-res-title');
  var resultText = root.querySelector('#as-res-text');
  var finalScoreEl = root.querySelector('#as-final-score');
  var finalWaveEl = root.querySelector('#as-final-wave');
  var finalBestEl = root.querySelector('#as-final-best');
  var finalTimeEl = root.querySelector('#as-final-time');
  var newRecEl = root.querySelector('#as-new');

  var ctx;
  if (window.GK) {
    var gk = GK.setup(canvas, W, H);
    ctx = gk.ctx;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxWidth = W + 'px';
  } else {
    ctx = canvas.getContext('2d');
    if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
  }

  /* ---------- 通用 ---------- */
  function bestScore() {
    try { return (Arcade.storage && Arcade.storage.getBest(BEST_ID)) || 0; } catch (e) { return 0; }
  }
  function audio(name) { if (Arcade.audio) Arcade.audio.play(name); }
  function fxBurst(x, y, color, count) {
    if (window.GK && GK.burst) { GK.burst(canvas, x, y, color, count); return; }
    if (!Arcade.fx) return;
    var r = canvas.getBoundingClientRect();
    Arcade.fx.burst(r.left + x * (r.width / W), r.top + y * (r.height / H), color, count);
  }
  function canPlay() { return !!st && !st.over && !paused; }
  function setMsg(text) { if (msgEl) msgEl.textContent = text; }

  function toast(text, color) {
    setMsg(text);
    if (st) st.toast = { text: text, t: 1.9, color: color || '#00f0ff' };
  }

  function shake(amount) {
    if (!st) return;
    st.shake = Math.max(st.shake, amount || 5);
  }

  function addBurst(x, y, color, count, spd) {
    if (!st) return;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * TAU, s = rand(0.6, spd || 3.2);
      st.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.55, 1), decay: rand(0.018, 0.032),
        size: rand(1.4, 3.6), color: color, glow: Math.random() < 0.4
      });
    }
    while (st.particles.length > 300) st.particles.shift();
  }
  function addShock(x, y, color, maxR) {
    if (!st) return;
    st.shocks.push({ x: x, y: y, r: 4, maxR: maxR || 40, life: 1, color: color });
  }

  /* ---------- 星空（视差） ---------- */
  var STARS = (function () {
    var out = [];
    var k = (W * H) / (640 * 420);
    var layers = [
      { n: Math.max(30, Math.round(55 * k)), depth: 0.25, size: 1.0, alpha: 0.45 },
      { n: Math.max(18, Math.round(34 * k)), depth: 0.55, size: 1.5, alpha: 0.68 },
      { n: Math.max(10, Math.round(18 * k)), depth: 0.95, size: 2.2, alpha: 0.92 }
    ];
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li];
      for (var i = 0; i < L.n; i++) {
        out.push({
          x: Math.random() * W, y: Math.random() * H,
          depth: L.depth, size: L.size, alpha: L.alpha * rand(0.55, 1),
          tw: Math.random() * TAU,
          color: Math.random() < 0.18 ? '#bfe9ff' : (Math.random() < 0.5 ? '#ffffff' : '#ffe9c0')
        });
      }
    }
    return out;
  })();

  /* ---------- 波次 / 横幅 ---------- */
  var bannerTimer = 0;
  function showWaveBanner(main, sub, color, ms) {
    bannerEl.style.color = color || 'var(--neon-yellow)';
    bannerEl.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bannerEl.classList.remove('show'); }, ms || 1800);
  }
  function clearWaveBanner() {
    clearTimeout(bannerTimer);
    bannerEl.classList.remove('show');
  }

  function spawnUfo(wave, elite) {
    var fromLeft = Math.random() < 0.5;
    var y0 = rand(70, Math.min(H - 120, Math.max(110, H * 0.42)));
    return {
      x: fromLeft ? -42 : W + 42,
      y: y0, y0: y0,
      vx: (fromLeft ? 1 : -1) * rand(1.15, 1.75) * SPEED_K,
      phase: rand(0, TAU), hp: elite ? 5 : 3, maxHp: elite ? 5 : 3,
      cd: 90 + Math.floor(rand(0, 60)), flash: 0, elite: !!elite
    };
  }

  function startWave(n) {
    if (!st) return;
    st.wave = n;
    st.waveDone = false;
    st.nextWaveT = 0;
    var count = st.conf.perWave + Math.floor((n - 1) * 1.3);
    if (n === st.waves) count = Math.max(3, count - 1);
    for (var i = 0; i < count; i++) {
      var spec = pickSpec(n);
      st.roids.push(spawnAsteroid(st, n, spec.kind, spec.tier));
    }
    if (n === st.waves) {
      var boss = spawnAsteroid(st, n, 'boss', 3);
      boss.vx *= 0.6;
      boss.vy = 0.24 * SPEED_K;
      st.roids.push(boss);
    }
    var ufoN = 0;
    if (n >= 1 && Math.random() < Math.min(0.9, 0.15 + n * 0.13)) ufoN = 1;
    if (n >= 5 && Math.random() < 0.5) ufoN++;
    if (n >= 4) ufoN = Math.max(1, ufoN);
    if (n === st.waves) ufoN = Math.max(1, ufoN);
    for (var u = 0; u < ufoN; u++) st.ufos.push(spawnUfo(n, n === st.waves && u === 0));

    if (n === st.waves) {
      showWaveBanner(
        T('gs.asteroidf.waveIncoming').replace('{n}', n),
        T('gs.asteroidf.bossIncoming'),
        'var(--neon-pink)', 2200
      );
      toast(T('gs.asteroidf.bossIncoming'), '#ff2d95');
    } else {
      showWaveBanner(
        T('gs.asteroidf.waveIncoming').replace('{n}', n),
        T('gs.asteroidf.wave') + ' ' + n + '/' + st.waves,
        'var(--neon-yellow)', 1800
      );
      toast(T('gs.asteroidf.waveIncoming').replace('{n}', n), '#ffe600');
    }
    if (ufoN > 0) toast(T('gs.asteroidf.ufoIncoming'), '#ff2d95');
    updateHud();
  }

  /* ---------- 开局 / 重开 / 选择难度 ---------- */
  function resetInput() {
    keys.left = false; keys.right = false; keys.thrust = false;
    keys.reverse = false; keys.fire = false; touchFire = false;
    stickReset();
  }

  function startGame(idx) {
    diffIdx = (idx === undefined || idx === null) ? diffIdx : idx;
    var conf = DIFFS[diffIdx] || DIFFS[1];
    st = {
      diffIdx: diffIdx, conf: conf, waves: conf.waves,
      ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, ang: -Math.PI / 2, flame: 0 },
      roids: [], ufos: [], bullets: [], ebullets: [], powerups: [],
      particles: [], shocks: [],
      wave: 0, waveDone: false, nextWaveT: 0,
      score: 0, lives: 3, invuln: INVULN_STEPS, fireCd: 0, dashCd: 0,
      shield: 0, spreadT: 0, spreadLevel: 0, rapidT: 0,
      t: 0, elapsed: 0, shake: 0, flash: 0, toast: null, dropSeq: 0,
      best0: bestScore(), over: false, won: false, ended: false, submitted: false
    };
    paused = false;
    resetInput();
    clearWaveBanner();
    startEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    resultEl.classList.add('hidden');
    setMsg('');
    startWave(1);
    updateHud();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    audio('ui');
  }

  function openPicker() {
    st = null;
    paused = false;
    resetInput();
    clearWaveBanner();
    startEl.classList.remove('hidden');
    pauseEl.classList.add('hidden');
    resultEl.classList.add('hidden');
    scoreEl.textContent = '0';
    livesEl.textContent = '3';
    waveEl.textContent = '1/' + DIFFS[diffIdx].waves;
    bestEl.textContent = String(bestScore());
    shieldFillEl.style.width = '0%';
    spreadEl.textContent = '--';
    rapidEl.textContent = '--';
    setMsg('');
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  /* ---------- 暂停 ---------- */
  function togglePause(force) {
    if (!st || st.over) return;
    var next = force === undefined ? !paused : !!force;
    if (next === paused) return;
    paused = next;
    if (paused) {
      resetInput();
      if (loopApi) loopApi.pause();
      pauseEl.classList.remove('hidden');
      setMsg(T('gs.asteroidf.paused'));
    } else {
      if (loopApi) loopApi.resume();
      pauseEl.classList.add('hidden');
      setMsg('');
    }
    audio('ui');
  }

  /* ---------- 射击 / 护盾 / 冲刺 ---------- */
  function tryFire() {
    if (!canPlay() || st.fireCd > 0) return false;
    st.fireCd = st.rapidT > 0 ? 4 : 9;
    var s = st.ship;
    var fan = st.spreadLevel === 5 ? [-0.34, -0.17, 0, 0.17, 0.34]
      : st.spreadLevel === 3 ? [-0.17, 0, 0.17] : [0];
    for (var i = 0; i < fan.length; i++) {
      var ang = s.ang + fan[i];
      var bx = s.x + Math.cos(ang) * 20, by = s.y + Math.sin(ang) * 20;
      st.bullets.push({
        x: bx, y: by, px: bx, py: by,
        vx: Math.cos(ang) * 9.4 + s.vx * 0.3,
        vy: Math.sin(ang) * 9.4 + s.vy * 0.3,
        life: 55
      });
    }
    addBurst(s.x + Math.cos(s.ang) * 22, s.y + Math.sin(s.ang) * 22, '#ffe600', 3, 2);
    audio('drop');
    return true;
  }

  function fireAtPoint(px, py) {
    if (!canPlay()) return;
    var s = st.ship;
    s.ang = Math.atan2(py - s.y, px - s.x);
    tryFire();
  }

  function shieldBurst() {
    if (!canPlay()) return;
    if (st.shield < 25) { toast(T('gs.asteroidf.shieldLow'), '#ff2d95'); audio('error'); return; }
    st.shield -= 25;
    st.invuln = Math.max(st.invuln, 100);
    var s = st.ship;
    addShock(s.x, s.y, '#00f0ff', 58);
    addBurst(s.x, s.y, '#00f0ff', 16, 3.2);
    toast(T('gs.asteroidf.shieldBurst'), '#00f0ff');
    audio('coin');
    updateHud();
  }

  function dash() {
    if (!canPlay()) return;
    if (st.dashCd > 0) { toast(T('gs.asteroidf.dashCd'), '#b967ff'); return; }
    st.dashCd = 270;
    var s = st.ship;
    s.vx += Math.cos(s.ang) * 2.2;
    s.vy += Math.sin(s.ang) * 2.2;
    s.flame = 1;
    addShock(s.x, s.y, '#b967ff', 34);
    addBurst(s.x - Math.cos(s.ang) * 12, s.y - Math.sin(s.ang) * 12, '#b967ff', 12, 3.4);
    audio('drop');
  }

  /* ---------- 道具 ---------- */
  function powerType() {
    var r = Math.random();
    return r < 0.38 ? 'shield' : (r < 0.72 ? 'spread' : 'rapid');
  }

  function spawnPowerup(x, y, type) {
    if (!st) return;
    st.powerups.push({
      type: type || powerType(), x: x, y: y,
      vx: rand(-0.55, 0.55), vy: rand(0.35, 0.9),
      rot: rand(0, TAU), vrr: rand(0.02, 0.05), life: 900, age: 0
    });
  }

  /** 前两个道具固定为护盾 / 散射，作为开局引导；之后按概率掉落 */
  function maybeDrop(x, y, chance) {
    if (!st) return;
    if (st.dropSeq < 2) {
      spawnPowerup(x, y, st.dropSeq === 0 ? 'shield' : 'spread');
      st.dropSeq++;
      return;
    }
    if (Math.random() < chance) spawnPowerup(x, y);
  }

  function applyPowerup(p) {
    if (p.type === 'shield') {
      st.shield = clamp(st.shield + 70, 0, 100);
      toast(T('gs.asteroidf.powerShield'), '#00f0ff');
    } else if (p.type === 'spread') {
      if (st.spreadT > 0 && st.spreadLevel === 3) {
        st.spreadLevel = 5;
        toast(T('gs.asteroidf.powerSpread5'), '#b967ff');
      } else {
        st.spreadLevel = 3;
        toast(T('gs.asteroidf.powerSpread'), '#b967ff');
      }
      st.spreadT = Math.min(1800, st.spreadT + 720);
    } else {
      st.rapidT = Math.min(1200, st.rapidT + 600);
      toast(T('gs.asteroidf.powerRapid'), '#ff9f1c');
    }
    audio('coin');
    addShock(p.x, p.y, '#39ff14', 28);
    updateHud();
  }

  /* ---------- 命中 / 受伤 / 复活 ---------- */
  function destroyRoid(idx) {
    if (!st) return;
    var r = st.roids[idx];
    if (!r) return;
    st.roids.splice(idx, 1);
    st.score += r.score;
    var pinks = r.kind === 'ice' || r.kind === 'shard' ? '#8ff8ff'
      : r.kind === 'armor' ? '#cfe4ff'
      : r.kind === 'boss' ? '#ff2d95' : '#ff2d95';
    var count = r.kind === 'boss' ? 40 : (r.tier === 3 ? 18 : 11);
    addBurst(r.x, r.y, pinks, count, r.kind === 'boss' ? 5 : 3.4);
    addBurst(r.x, r.y, '#ffe600', Math.round(count * 0.5), 3);
    addShock(r.x, r.y, r.kind === 'armor' ? '#9fb3c8' : (r.kind === 'ice' ? '#00f0ff' : '#ff2d95'),
      r.kind === 'boss' ? 90 : (r.tier === 3 ? 46 : 30));
    shake(r.kind === 'boss' ? 9 : (r.tier === 3 ? 4 : 2));
    if (r.kind === 'boss') fxBurst(r.x, r.y, 'var(--neon-pink)', 24);
    if (r.kind === 'boss') toast(T('gs.asteroidf.bossDown').replace('{n}', r.score), '#ff2d95');
    var kids = splitAsteroid(st, r);
    for (var k = 0; k < kids.length; k++) st.roids.push(kids[k]);
    var chance = r.kind === 'boss' ? 1 : r.kind === 'armor' ? 0.28 : r.kind === 'ice' ? 0.2 : 0.1;
    maybeDrop(r.x, r.y, chance);
    audio(r.kind === 'boss' || r.tier === 3 ? 'clear' : 'coin');
    updateHud();
  }

  function hitRoid(idx) {
    if (!st) return;
    var r = st.roids[idx];
    if (!r) return;
    if (r.hp > 1) {
      r.hp--;
      r.flash = 7;
      addBurst(r.x, r.y, r.kind === 'armor' ? '#cfe4ff' : '#8ff8ff', 7, 2.6);
      audio('drop');
      return;
    }
    destroyRoid(idx);
  }

  function hitUfo(idx) {
    if (!st) return;
    var u = st.ufos[idx];
    if (!u) return;
    u.hp--;
    u.flash = 7;
    if (u.hp > 0) {
      addBurst(u.x, u.y, '#00f0ff', 7, 2.6);
      audio('drop');
      return;
    }
    st.ufos.splice(idx, 1);
    st.score += UFO_SCORE;
    addBurst(u.x, u.y, '#ff2d95', 18, 4);
    addBurst(u.x, u.y, '#00f0ff', 12, 3.4);
    addShock(u.x, u.y, '#ff2d95', 58);
    fxBurst(u.x, u.y, 'var(--neon-pink)', 12);
    shake(6);
    maybeDrop(u.x, u.y, 1);
    toast(T('gs.asteroidf.ufoDown').replace('{n}', UFO_SCORE), '#ff2d95');
    audio('clear');
    updateHud();
  }

  function damageShip() {
    if (!st || st.over || st.invuln > 0) return;
    var s = st.ship;
    if (st.shield > 0) {
      var absorb = Math.min(st.shield, 34);
      st.shield -= absorb;
      st.invuln = 26;
      addBurst(s.x, s.y, '#00f0ff', 18, 3.6);
      addShock(s.x, s.y, '#00f0ff', 48);
      st.flash = 0.5;
      shake(4);
      toast(T('gs.asteroidf.shieldAbsorb'), '#00f0ff');
      audio('error');
      updateHud();
      return;
    }
    hitShip();
  }

  function hitShip() {
    if (!st || st.over) return;
    var s = st.ship;
    addBurst(s.x, s.y, '#00f0ff', 24, 4);
    addBurst(s.x, s.y, '#ffffff', 10, 3);
    addShock(s.x, s.y, '#00f0ff', 52);
    fxBurst(s.x, s.y, 'var(--neon-cyan)', 16);
    st.flash = 1;
    shake(8);
    audio('error');
    st.lives--;
    updateHud();
    if (st.lives <= 0) {
      st.lives = 0;
      endGame(false);
      return;
    }
    respawn();
  }

  function respawn() {
    if (!st) return;
    var s = st.ship;
    for (var i = st.roids.length - 1; i >= 0; i--) {
      var r = st.roids[i];
      if (dist2(r.x, r.y, W / 2, H / 2) < 150 * 150) {
        addBurst(r.x, r.y, '#b967ff', 8, 2.4);
        st.roids.splice(i, 1);
      }
    }
    for (var e = st.ebullets.length - 1; e >= 0; e--) {
      if (dist2(st.ebullets[e].x, st.ebullets[e].y, W / 2, H / 2) < 180 * 180) st.ebullets.splice(e, 1);
    }
    s.x = W / 2; s.y = H / 2; s.vx = 0; s.vy = 0; s.ang = -Math.PI / 2; s.flame = 0;
    st.invuln = INVULN_STEPS;
    addShock(W / 2, H / 2, '#00f0ff', 64);
    audio('coin');
    toast(T('gs.asteroidf.respawn'), '#00f0ff');
  }

  /* ---------- 结算 ---------- */
  function endGame(win) {
    if (!st || st.ended) return;
    st.ended = true;
    st.over = true;
    st.won = !!win;
    paused = false;
    resetInput();
    pauseEl.classList.add('hidden');
    clearWaveBanner();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();

    var prevBest = st.best0;
    var isNew = false;
    if (!st.submitted) {
      st.submitted = true;
      if (st.score > 0 && Arcade.shell && Arcade.shell.submitScore) isNew = !!Arcade.shell.submitScore(st.score);
      if (st.score > prevBest) isNew = true;
    }
    var storedBest = bestScore();

    resultTitle.textContent = T(win ? 'gs.asteroidf.winTitle' : 'gs.asteroidf.loseTitle');
    resultTitle.className = win ? 'win' : '';
    resultText.innerHTML = T(win ? 'gs.asteroidf.winDesc' : 'gs.asteroidf.loseDesc')
      .replace('{w}', Math.max(1, st.wave)).replace('{s}', st.score);
    finalScoreEl.textContent = String(st.score);
    finalWaveEl.textContent = String(Math.max(1, st.wave)) + '/' + st.waves;
    finalBestEl.textContent = String(storedBest);
    finalTimeEl.textContent = fmtTime(st.elapsed);
    if (isNew) newRecEl.classList.remove('hidden'); else newRecEl.classList.add('hidden');
    bestEl.textContent = String(storedBest);
    resultEl.classList.remove('hidden');

    if (win) {
      if (Arcade.juice) Arcade.juice.win();
      else audio('win');
    } else {
      if (Arcade.juice) Arcade.juice.lose();
      else audio('lose');
    }
    setMsg(win ? T('gs.asteroidf.winTitle') : T('gs.asteroidf.loseTitle'));
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    if (!st) return;
    scoreEl.textContent = String(st.score);
    livesEl.textContent = String(Math.max(0, st.lives));
    waveEl.textContent = Math.max(1, st.wave) + '/' + st.waves;
    bestEl.textContent = String(Math.max(st.best0, st.score));
    shieldFillEl.style.width = Math.round(st.shield) + '%';
    spreadEl.textContent = st.spreadT > 0
      ? (Math.ceil(st.spreadT * STEP / 1000) + 's' + (st.spreadLevel === 5 ? '·5' : '·3'))
      : '--';
    rapidEl.textContent = st.rapidT > 0 ? (Math.ceil(st.rapidT * STEP / 1000) + 's') : '--';
  }

  function checkWave() {
    if (!st || st.over) return;
    if (st.waveDone) {
      if (st.nextWaveT > 0) {
        st.nextWaveT--;
        if (st.nextWaveT <= 0 && !st.over) {
          st.waveDone = false;
          startWave(st.wave + 1);
        }
      }
      return;
    }
    if (st.roids.length === 0 && st.ufos.length === 0) {
      if (st.wave >= st.waves) {
        st.score += WIN_BONUS;
        updateHud();
        endGame(true);
        return;
      }
      st.waveDone = true;
      st.score += WAVE_BONUS;
      st.nextWaveT = 90;
      showWaveBanner(
        T('gs.asteroidf.waveClear').replace('{n}', st.wave).replace('{b}', WAVE_BONUS),
        T('gs.asteroidf.wave') + ' ' + (st.wave + 1) + '/' + st.waves,
        'var(--neon-cyan)', 1700
      );
      toast(T('gs.asteroidf.waveClear').replace('{n}', st.wave).replace('{b}', WAVE_BONUS), '#00f0ff');
      audio('match');
      updateHud();
    }
  }

  function updateEffects() {
    if (!st) return;
    for (var i = st.particles.length - 1; i >= 0; i--) {
      var p = st.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life -= p.decay || 0.025;
      if (p.life <= 0) st.particles.splice(i, 1);
    }
    for (var s = st.shocks.length - 1; s >= 0; s--) {
      var sh = st.shocks[s];
      sh.r += 2.6;
      sh.life -= 0.04;
      if (sh.life <= 0) st.shocks.splice(s, 1);
    }
    st.shake *= 0.86;
    if (st.shake < 0.2) st.shake = 0;
    st.flash *= 0.92;
    if (st.flash < 0.02) st.flash = 0;
    if (st.toast) {
      st.toast.t -= 0.022;
      if (st.toast.t <= 0) st.toast = null;
    }
  }

  function updateUfos() {
    var s = st.ship;
    for (var i = st.ufos.length - 1; i >= 0; i--) {
      var u = st.ufos[i];
      u.phase += 0.022;
      u.y = u.y0 + Math.sin(u.phase) * 24;
      u.x += u.vx;
      if (u.x < -46) u.x = W + 46; else if (u.x > W + 46) u.x = -46;
      if (u.flash > 0) u.flash--;
      if (u.cd > 0) u.cd--;
      if (u.cd <= 0 && !st.over) {
        var ang = Math.atan2(s.y - u.y, s.x - u.x) + rand(-0.1, 0.1);
        st.ebullets.push({
          x: u.x, y: u.y + 5, px: u.x, py: u.y + 5,
          vx: Math.cos(ang) * 3.0 * SPEED_K,
          vy: Math.sin(ang) * 3.0 * SPEED_K,
          life: 150
        });
        u.cd = (u.elite ? 72 : 112) + Math.floor(rand(0, 55));
        audio('drop');
      }
    }
  }

  function update() {
    if (!st) return;
    if (st.over) {
      updateEffects();
      return;
    }
    if (paused) return;
    st.t++;
    st.elapsed++;
    var s = st.ship;

    // 转向：键盘 + 摇杆
    var turnAxis = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (Math.abs(stick.x) > 0.12) turnAxis += stick.x;
    turnAxis = clamp(turnAxis, -1.2, 1.2);
    s.ang += turnAxis * 0.068;

    // 推进 / 刹车或反向
    var thrustAxis = keys.thrust ? 1 : 0;
    var brakeAxis = keys.reverse ? 1 : 0;
    if (stick.y < -0.12) thrustAxis = Math.max(thrustAxis, -stick.y);
    if (stick.y > 0.12) brakeAxis = Math.max(brakeAxis, stick.y);
    if (thrustAxis > 0) {
      s.vx += Math.cos(s.ang) * 0.16 * thrustAxis;
      s.vy += Math.sin(s.ang) * 0.16 * thrustAxis;
      s.flame = Math.min(1, s.flame + 0.22 * thrustAxis);
      if (Math.random() < 0.9) {
        var bx = s.x - Math.cos(s.ang) * 13;
        var by = s.y - Math.sin(s.ang) * 13;
        var ea = s.ang + Math.PI + rand(-0.45, 0.45);
        var esp = rand(0.9, 2.2);
        st.particles.push({
          x: bx, y: by,
          vx: Math.cos(ea) * esp - s.vx * 0.25,
          vy: Math.sin(ea) * esp - s.vy * 0.25,
          life: rand(0.25, 0.55), decay: rand(0.035, 0.06),
          size: rand(1.2, 2.8),
          color: Math.random() < 0.5 ? '#ffb347' : (Math.random() < 0.5 ? '#ffe600' : '#ff6a00'),
          glow: true
        });
      }
    } else {
      s.flame = Math.max(0, s.flame - 0.2);
    }
    if (brakeAxis > 0) {
      s.vx -= Math.cos(s.ang) * 0.12 * brakeAxis;
      s.vy -= Math.sin(s.ang) * 0.12 * brakeAxis;
      s.vx *= 0.975; s.vy *= 0.975;
    }

    var sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > 5.2) { s.vx = s.vx / sp * 5.2; s.vy = s.vy / sp * 5.2; }
    s.vx *= 0.993; s.vy *= 0.993;
    s.x += s.vx; s.y += s.vy;
    if (s.x < -24) s.x = W + 24; else if (s.x > W + 24) s.x = -24;
    if (s.y < -24) s.y = H + 24; else if (s.y > H + 24) s.y = -24;

    if (st.invuln > 0) st.invuln--;
    if (st.fireCd > 0) st.fireCd--;
    if (st.dashCd > 0) st.dashCd--;
    if (st.shield > 0) st.shield = Math.max(0, st.shield - 0.15);
    if (st.spreadT > 0) { st.spreadT--; if (st.spreadT === 0) st.spreadLevel = 0; }
    if (st.rapidT > 0) st.rapidT--;
    if (keys.fire || touchFire) tryFire();

    // 视差相机
    camX += s.vx * 0.10 + 0.015;
    camY += s.vy * 0.10;

    // 陨石
    for (var ri = 0; ri < st.roids.length; ri++) {
      var r = st.roids[ri];
      r.x += r.vx; r.y += r.vy; r.rot += r.vr;
      if (r.flash > 0) r.flash--;
      if (r.x < -60) r.x = W + 60; else if (r.x > W + 60) r.x = -60;
      if (r.y < -60) r.y = H + 60; else if (r.y > H + 60) r.y = -60;
    }

    updateUfos();

    // 子弹
    for (var bi = st.bullets.length - 1; bi >= 0; bi--) {
      var b = st.bullets[bi];
      b.px = b.x; b.py = b.y;
      b.x += b.vx; b.y += b.vy;
      b.life--;
      if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) {
        st.bullets.splice(bi, 1);
        continue;
      }
      var hitIdx = -1;
      for (var rj = st.roids.length - 1; rj >= 0; rj--) {
        var rr = st.roids[rj];
        var rad = rr.base * 0.9;
        if (dist2(b.x, b.y, rr.x, rr.y) < rad * rad) { hitIdx = rj; break; }
      }
      if (hitIdx >= 0) {
        st.bullets.splice(bi, 1);
        hitRoid(hitIdx);
        continue;
      }
      for (var uj = st.ufos.length - 1; uj >= 0; uj--) {
        var uu = st.ufos[uj];
        if (dist2(b.x, b.y, uu.x, uu.y) < 22 * 22) {
          st.bullets.splice(bi, 1);
          hitUfo(uj);
          break;
        }
      }
      if (st.over) break;
    }

    // 敌方子弹
    for (var ei = st.ebullets.length - 1; ei >= 0; ei--) {
      var eb = st.ebullets[ei];
      eb.px = eb.x; eb.py = eb.y;
      eb.x += eb.vx; eb.y += eb.vy;
      eb.life--;
      if (eb.life <= 0 || eb.x < -30 || eb.x > W + 30 || eb.y < -30 || eb.y > H + 30) {
        st.ebullets.splice(ei, 1);
        continue;
      }
      if (dist2(eb.x, eb.y, s.x, s.y) < (SHIP_R + 5) * (SHIP_R + 5)) {
        st.ebullets.splice(ei, 1);
        damageShip();
        if (st.over) break;
      }
    }

    // 道具
    for (var pi = st.powerups.length - 1; pi >= 0; pi--) {
      var p = st.powerups[pi];
      if (dist2(p.x, p.y, s.x, s.y) < 200 * 200) {
        var ma = Math.atan2(s.y - p.y, s.x - p.x);
        p.vx += Math.cos(ma) * 0.05;
        p.vy += Math.sin(ma) * 0.05;
        var ms = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (ms > 2.6) { p.vx = p.vx / ms * 2.6; p.vy = p.vy / ms * 2.6; }
      }
      p.x += p.vx; p.y += p.vy; p.rot += p.vrr;
      p.life--; p.age++;
      if (p.x < 12) { p.x = 12; p.vx *= -1; } else if (p.x > W - 12) { p.x = W - 12; p.vx *= -1; }
      if (p.y < 12) { p.y = 12; p.vy *= -1; } else if (p.y > H - 12) { p.y = H - 12; p.vy *= -1; }
      if (p.life <= 0) { st.powerups.splice(pi, 1); continue; }
      if (dist2(p.x, p.y, s.x, s.y) < 30 * 30) {
        st.powerups.splice(pi, 1);
        applyPowerup(p);
      }
    }

    // 飞船碰撞（无敌期跳过）
    if (!st.over && st.invuln <= 0) {
      for (var si = 0; si < st.roids.length; si++) {
        var sr = st.roids[si];
        var hitR = sr.base * 0.86 + SHIP_R;
        if (dist2(s.x, s.y, sr.x, sr.y) < hitR * hitR) { damageShip(); break; }
      }
      if (!st.over && st.invuln <= 0) {
        for (var ui = 0; ui < st.ufos.length; ui++) {
          var u2 = st.ufos[ui];
          if (dist2(s.x, s.y, u2.x, u2.y) < (22 + SHIP_R) * (22 + SHIP_R)) { damageShip(); break; }
        }
      }
    }

    updateEffects();
    checkWave();
    updateHud();
  }

  /* ---------- 绘制 ---------- */
  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04050f');
    g.addColorStop(0.55, '#0a0718');
    g.addColorStop(1, '#100a1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var neb = [
      [W * 0.2, H * 0.25, H * 0.55, 'rgba(96,48,180,0.15)'],
      [W * 0.82, H * 0.72, H * 0.6, 'rgba(0,150,200,0.10)'],
      [W * 0.48, H * 1.0, H * 0.55, 'rgba(255,45,149,0.07)']
    ];
    for (var n = 0; n < neb.length; n++) {
      var ng = ctx.createRadialGradient(neb[n][0], neb[n][1], 0, neb[n][0], neb[n][1], neb[n][2]);
      ng.addColorStop(0, neb[n][3]);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, H);
    }

    var now = performance.now();
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var x = wrapVal(s.x - camX * s.depth, -4, W + 4);
      var y = wrapVal(s.y - camY * s.depth, -4, H + 4);
      ctx.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(now / 700 + s.tw));
      ctx.fillStyle = s.color;
      if (s.size > 2) {
        ctx.beginPath();
        ctx.arc(x, y, s.size * 0.55, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawShocks() {
    for (var i = 0; i < st.shocks.length; i++) {
      var s = st.shocks[i];
      var a = Math.max(0, s.life);
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function traceShape(pts) {
    ctx.beginPath();
    for (var v = 0; v < pts.length; v++) {
      if (v === 0) ctx.moveTo(pts[v][0], pts[v][1]); else ctx.lineTo(pts[v][0], pts[v][1]);
    }
    ctx.closePath();
  }

  function drawRockBody(r) {
    var b = r.base;
    traceShape(r.pts);
    var g = ctx.createRadialGradient(-b * 0.35, -b * 0.4, b * 0.15, 0, 0, b * 1.15);
    if (r.kind === 'boss') {
      g.addColorStop(0, '#c28ad4');
      g.addColorStop(0.4, '#6b3f80');
      g.addColorStop(1, '#160c22');
    } else {
      g.addColorStop(0, '#a487c0');
      g.addColorStop(0.42, '#6a4f8a');
      g.addColorStop(1, '#211731');
    }
    ctx.fillStyle = g;
    if (r.tier === 3 || r.kind === 'boss') { ctx.shadowColor = 'rgba(185,103,255,0.5)'; ctx.shadowBlur = 12; }
    ctx.fill();
    ctx.shadowBlur = 0;

    var rg = ctx.createLinearGradient(-b, -b, b, b);
    rg.addColorStop(0, 'rgba(228,205,255,0.85)');
    rg.addColorStop(0.5, 'rgba(140,105,180,0.25)');
    rg.addColorStop(1, 'rgba(60,40,90,0.35)');
    ctx.strokeStyle = rg;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    for (var c = 0; c < r.craters.length; c++) {
      var cr = r.craters[c];
      ctx.beginPath();
      ctx.ellipse(cr.x, cr.y, cr.r, cr.r * 0.78, cr.a, 0, TAU);
      ctx.fillStyle = 'rgba(18,10,28,0.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cr.x - cr.r * 0.2, cr.y - cr.r * 0.2, cr.r * 0.7, Math.PI * 0.9, Math.PI * 1.9);
      ctx.strokeStyle = 'rgba(220,190,255,0.24)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, b * 0.86, Math.PI, Math.PI * 1.55);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (r.kind === 'boss') {
      var glow = r.hp / r.maxHp;
      for (var k = 0; k < r.cracks.length; k++) {
        ctx.beginPath();
        var seg = r.cracks[k];
        ctx.moveTo(seg[0][0], seg[0][1]);
        for (var q = 1; q < seg.length; q++) ctx.lineTo(seg[q][0], seg[q][1]);
        ctx.strokeStyle = 'rgba(255,' + Math.round(80 + 120 * glow) + ',40,' + (0.5 + 0.4 * glow) + ')';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#ff6a00';
        ctx.shadowBlur = 8;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  }

  function drawArmorBody(r) {
    var b = r.base;
    traceShape(r.pts);
    var g = ctx.createLinearGradient(-b, -b, b, b);
    g.addColorStop(0, '#eef4fa');
    g.addColorStop(0.32, '#a6b4c2');
    g.addColorStop(0.62, '#5c6875');
    g.addColorStop(1, '#1b232b');
    ctx.fillStyle = g;
    if (r.tier === 3) { ctx.shadowColor = 'rgba(207,228,255,0.45)'; ctx.shadowBlur = 8; }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(225,238,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 金属板接缝
    for (var p = 0; p < r.plates.length; p++) {
      var pl = r.plates[p];
      var x1 = Math.cos(pl.a) * b * pl.d, y1 = Math.sin(pl.a) * b * pl.d;
      var x2 = Math.cos(pl.a + 0.9) * b * pl.l, y2 = Math.sin(pl.a + 0.9) * b * pl.l;
      ctx.strokeStyle = 'rgba(20,28,36,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x1 + 1, y1 + 1);
      ctx.lineTo(x2 + 1, y2 + 1);
      ctx.stroke();
    }
    // 铆钉
    for (var rv = 0; rv < 4; rv++) {
      var a = rv / 4 * TAU + 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * b * 0.55, Math.sin(a) * b * 0.55, 1.6, 0, TAU);
      ctx.fillStyle = 'rgba(230,244,255,0.85)';
      ctx.fill();
    }
    // 损伤裂缝
    var damage = r.maxHp - r.hp;
    for (var k = 0; k < Math.min(r.cracks.length, damage * 3); k++) {
      var seg = r.cracks[k];
      ctx.beginPath();
      ctx.moveTo(seg[0][0], seg[0][1]);
      for (var q = 1; q < seg.length; q++) ctx.lineTo(seg[q][0], seg[q][1]);
      ctx.strokeStyle = 'rgba(255,159,28,0.9)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff9f1c';
      ctx.shadowBlur = 7;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    if (r.flash > 0) {
      ctx.globalAlpha = 0.35;
      traceShape(r.pts);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawIceBody(r) {
    var b = r.base;
    traceShape(r.pts);
    var g = ctx.createRadialGradient(-b * 0.3, -b * 0.4, b * 0.1, 0, 0, b * 1.2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#bff9ff');
    g.addColorStop(0.7, '#3fc6ef');
    g.addColorStop(1, '#08506e');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(143,248,255,0.7)';
    ctx.shadowBlur = r.kind === 'shard' ? 7 : 13;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(225,255,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 晶面
    for (var v = 0; v < r.pts.length; v++) {
      if (v % 2) continue;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r.pts[v][0], r.pts[v][1]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-b * 0.22, -b * 0.3);
    ctx.lineTo(b * 0.12, -b * 0.55);
    ctx.lineTo(b * 0.3, -b * 0.16);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fill();
    if (r.flash > 0) {
      ctx.globalAlpha = 0.4;
      traceShape(r.pts);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawRoid(r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot);
    if (r.kind === 'ice' || r.kind === 'shard') drawIceBody(r);
    else if (r.kind === 'armor') drawArmorBody(r);
    else drawRockBody(r);
    if (r.hp < r.maxHp && r.kind !== 'armor' && r.kind !== 'boss') {
      ctx.beginPath();
      ctx.arc(0, 0, r.base * 0.5, 0, TAU);
      ctx.strokeStyle = 'rgba(255,159,28,0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    if (r.kind === 'boss') {
      var bw = 92, bh = 5, bx = r.x - bw / 2, by = r.y - r.base - 17;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = 'rgba(255,159,28,0.25)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ff7a1c';
      ctx.shadowColor = '#ff7a1c';
      ctx.shadowBlur = 8;
      ctx.fillRect(bx, by, bw * Math.max(0, r.hp / r.maxHp), bh);
      ctx.shadowBlur = 0;
    }
  }

  function drawParticles() {
    for (var i = 0; i < st.particles.length; i++) {
      var p = st.particles[i];
      var a = Math.max(0, Math.min(1, p.life));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, p.size * a), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawBullets() {
    for (var i = 0; i < st.bullets.length; i++) {
      var b = st.bullets[i];
      var m = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      var dx = b.vx / m, dy = b.vy / m;
      var tailX = b.x - dx * 16, tailY = b.y - dy * 16;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 12;
      var tg = ctx.createLinearGradient(tailX, tailY, b.x, b.y);
      tg.addColorStop(0, 'rgba(255,230,0,0)');
      tg.addColorStop(0.55, 'rgba(255,230,0,0.55)');
      tg.addColorStop(1, 'rgba(255,255,220,0.95)');
      ctx.strokeStyle = tg;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEBullets() {
    for (var i = 0; i < st.ebullets.length; i++) {
      var b = st.ebullets[i];
      var m = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,45,149,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx / m * 14, b.y - b.vy / m * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 8);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.35, 'rgba(255,45,149,0.9)');
      g.addColorStop(1, 'rgba(185,0,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 尾焰：双层渐变 + 辉光 + 时间脉动 */
  function drawFlame(s, now) {
    if (s.flame < 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var eg = ctx.createRadialGradient(-12, 0, 0, -12, 0, 4);
      eg.addColorStop(0, 'rgba(255,170,70,0.45)');
      eg.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(-12, 0, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }
    var pulse = 0.55 + 0.45 * Math.sin(now / 90 + st.t * 0.6) + 0.18 * Math.sin(now / 37);
    var len = 5 + s.flame * (16 + pulse * 6);
    var w = 3 + s.flame * 3;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#ff8a00';
    ctx.shadowBlur = 14;
    var og = ctx.createLinearGradient(-11, 0, -11 - len, 0);
    og.addColorStop(0, 'rgba(255,246,200,0.95)');
    og.addColorStop(0.3, 'rgba(255,166,48,0.85)');
    og.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.moveTo(-11, -w);
    ctx.quadraticCurveTo(-11 - len * 0.45, -w * 1.9, -11 - len, 0);
    ctx.quadraticCurveTo(-11 - len * 0.45, w * 1.9, -11, w);
    ctx.closePath();
    ctx.fill();

    var il = len * 0.55, iw = w * 0.52;
    var ig = ctx.createLinearGradient(-11, 0, -11 - il, 0);
    ig.addColorStop(0, 'rgba(255,255,255,0.98)');
    ig.addColorStop(0.45, 'rgba(120,240,255,0.85)');
    ig.addColorStop(1, 'rgba(0,150,255,0)');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.moveTo(-11, -iw);
    ctx.quadraticCurveTo(-11 - il * 0.5, -iw * 1.6, -11 - il, 0);
    ctx.quadraticCurveTo(-11 - il * 0.5, iw * 1.6, -11, iw);
    ctx.closePath();
    ctx.fill();

    var ng = ctx.createRadialGradient(-11, 0, 0, -11, 0, 7);
    ng.addColorStop(0, 'rgba(255,255,230,0.9)');
    ng.addColorStop(0.5, 'rgba(255,150,60,0.5)');
    ng.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(-11, 0, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawShip() {
    var s = st.ship;
    var now = performance.now();
    var blink = st.invuln > 0 && (Math.floor(st.invuln / 8) % 2 === 0);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.ang);
    ctx.globalAlpha = blink ? 0.34 : 1;

    drawFlame(s, now);

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(7, -8.4);
    ctx.lineTo(-3.5, -9.6);
    ctx.lineTo(-11, -5.2);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-11, 5.2);
    ctx.lineTo(-3.5, 9.6);
    ctx.lineTo(7, 8.4);
    ctx.closePath();
    var hg = ctx.createLinearGradient(0, -10, 0, 10);
    hg.addColorStop(0, '#d6feff');
    hg.addColorStop(0.32, '#4fe9ff');
    hg.addColorStop(0.62, '#00a9d4');
    hg.addColorStop(1, '#03566e');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,252,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255,255,255,0.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5, -6.4);
    ctx.lineTo(8.5, 0);
    ctx.lineTo(5, 6.4);
    ctx.stroke();

    var cg = ctx.createRadialGradient(8, -1, 0.5, 6, 0, 6);
    cg.addColorStop(0, 'rgba(255,255,255,0.95)');
    cg.addColorStop(0.45, 'rgba(120,250,255,0.75)');
    cg.addColorStop(1, 'rgba(0,120,160,0.15)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(6, 0, 4.6, 3, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = '#04222e';
    if (window.GK) GK.roundRect(ctx, -13, -3.6, 3.4, 7.2, 1.4);
    else ctx.rect(-13, -3.6, 3.4, 7.2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,240,255,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.moveTo(16, -2.4);
    ctx.lineTo(7, -6.6);
    ctx.lineTo(9, -3.4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 护盾环（能量护盾 / 无敌）
    if (st.shield > 0 || st.invuln > 0) {
      var pr = 25 + Math.sin(now / 120) * 2;
      var energy = st.shield / 100;
      var sa = st.invuln > 0 ? 0.85 : 0.32 + 0.34 * energy;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = st.invuln > 0 ? 'rgba(214,254,255,' + sa + ')' : 'rgba(0,240,255,' + sa + ')';
      ctx.lineWidth = st.invuln > 0 ? 2.6 : 1.8;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, TAU);
      ctx.stroke();
      // 环形刻度与扫描弧
      var t = now / 900;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, pr + 4, t, t + 1.2);
      ctx.strokeStyle = '#ff2d95';
      ctx.stroke();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(0, 0, pr, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawUfo(u, now) {
    ctx.save();
    ctx.translate(u.x, u.y);
    var blink = (Math.floor(now / 220) + Math.floor(u.x / 30)) % 3;

    // 底部牵引辉光
    var gg = ctx.createRadialGradient(0, 10, 2, 0, 10, 34);
    gg.addColorStop(0, 'rgba(0,240,255,0.30)');
    gg.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(0, 10, 34, 0, TAU);
    ctx.fill();

    // 座舱罩
    var dg = ctx.createLinearGradient(0, -16, 0, -2);
    dg.addColorStop(0, 'rgba(214,254,255,0.95)');
    dg.addColorStop(0.55, 'rgba(0,240,255,0.7)');
    dg.addColorStop(1, 'rgba(0,80,120,0.6)');
    ctx.beginPath();
    ctx.ellipse(0, -5, 14, 12, 0, Math.PI, TAU);
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,255,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 碟身
    var bg = ctx.createLinearGradient(-28, -8, 28, 8);
    bg.addColorStop(0, '#eef4ff');
    bg.addColorStop(0.35, '#9fb0cc');
    bg.addColorStop(0.68, '#5a6684');
    bg.addColorStop(1, '#242a44');
    ctx.beginPath();
    ctx.ellipse(0, 4, 28, 9.5, 0, 0, TAU);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 舷窗灯
    for (var i = -1; i <= 1; i++) {
      var on = (blink + i + 3) % 3 === 0;
      ctx.beginPath();
      ctx.arc(i * 12, 6, 2.1, 0, TAU);
      ctx.fillStyle = on ? '#ffe600' : (i === 0 ? '#00f0ff' : '#ff2d95');
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = on ? 9 : 5;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 天线
    ctx.strokeStyle = 'rgba(200,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(0, -22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -23, 2, 0, TAU);
    ctx.fillStyle = '#ff2d95';
    ctx.fill();

    if (u.elite) {
      ctx.strokeStyle = 'rgba(185,103,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 2, 33, 13, 0, 0, TAU);
      ctx.stroke();
    }
    if (u.flash > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 3, 28, 13, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function hexPath(r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + i * TAU / 6;
      var x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawPowerup(p, now) {
    var color = p.type === 'shield' ? '#00f0ff' : p.type === 'spread' ? '#b967ff' : '#ff9f1c';
    var pulse = 1 + Math.sin(now / 260 + p.rot) * 0.08;
    var fade = p.life < 120 ? (Math.floor(now / 140) % 2 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = fade;

    var g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();

    hexPath(13);
    var hg = ctx.createLinearGradient(-12, -12, 12, 12);
    hg.addColorStop(0, 'rgba(255,255,255,0.95)');
    hg.addColorStop(0.4, color);
    hg.addColorStop(1, 'rgba(10,10,22,0.9)');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.5;
    if (p.type === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.quadraticCurveTo(7, -6, 6, 1);
      ctx.quadraticCurveTo(4, 6, 0, 8);
      ctx.quadraticCurveTo(-4, 6, -6, 1);
      ctx.quadraticCurveTo(-7, -6, 0, -7);
      ctx.closePath();
      ctx.stroke();
    } else if (p.type === 'spread') {
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -1);
      ctx.moveTo(0, 1);
      ctx.lineTo(-6, -6);
      ctx.moveTo(0, 1);
      ctx.lineTo(6, -6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(-3, 0);
      ctx.lineTo(1, 0);
      ctx.lineTo(-2, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawToast() {
    if (!st || !st.toast) return;
    var a = Math.min(1, st.toast.t);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 13px "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = st.toast.color;
    ctx.shadowColor = st.toast.color;
    ctx.shadowBlur = 12;
    ctx.fillText(st.toast.text, W / 2, 30);
    ctx.restore();
  }

  function draw() {
    drawBackground();
    if (!st) return;

    var ox = st.shake > 0 ? rand(-st.shake, st.shake) : 0;
    var oy = st.shake > 0 ? rand(-st.shake, st.shake) : 0;
    var now = performance.now();
    ctx.save();
    ctx.translate(ox, oy);

    for (var i = 0; i < st.roids.length; i++) drawRoid(st.roids[i]);
    for (var u = 0; u < st.ufos.length; u++) drawUfo(st.ufos[u], now);
    for (var p = 0; p < st.powerups.length; p++) drawPowerup(st.powerups[p], now);
    drawShocks();
    drawParticles();
    drawBullets();
    drawEBullets();
    if (!st.over) drawShip();

    ctx.restore();

    // 受击闪光
    if (st.flash > 0) {
      ctx.fillStyle = 'rgba(255,45,149,' + Math.min(0.34, st.flash * 0.3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // 低生命警戒暗角
    if (st.lives === 1) {
      var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78);
      vg.addColorStop(0, 'rgba(255,45,149,0)');
      vg.addColorStop(1, 'rgba(255,45,149,0.17)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    drawToast();
  }

  /* ---------- 输入 ---------- */
  var stickEl = root.querySelector('#as-stick');
  var knobEl = root.querySelector('#as-stick-knob');

  function stickReset() {
    stick.x = 0; stick.y = 0; stick.id = null;
    if (knobEl) knobEl.style.transform = '';
    if (stickEl) stickEl.classList.remove('active');
  }

  function stickMove(ev) {
    var r = stickEl.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var max = r.width * 0.33;
    var dx = ev.clientX - cx, dy = ev.clientY - cy;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    if (len < r.width * 0.07) { dx = 0; dy = 0; }
    if (knobEl) knobEl.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    stick.x = clamp(dx / max, -1, 1);
    stick.y = clamp(dy / max, -1, 1);
  }

  stickEl.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    stick.id = ev.pointerId;
    stickEl.classList.add('active');
    try { stickEl.setPointerCapture(ev.pointerId); } catch (e) {}
    stickMove(ev);
  });
  stickEl.addEventListener('pointermove', function (ev) {
    if (stick.id === null || ev.pointerId !== stick.id) return;
    ev.preventDefault();
    stickMove(ev);
  });
  ['pointerup', 'pointercancel'].forEach(function (t) {
    stickEl.addEventListener(t, function (ev) {
      if (stick.id === null || ev.pointerId !== stick.id) return;
      stickReset();
    });
  });

  function setPressed(el, on) {
    if (!el) return;
    if (on) el.classList.add('pressed'); else el.classList.remove('pressed');
  }

  var actBtns = root.querySelectorAll('.as-act');
  for (var ai = 0; ai < actBtns.length; ai++) {
    (function (btn) {
      var act = btn.getAttribute('data-act');
      btn.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
        setPressed(btn, true);
        if (act === 'fire') {
          if (canPlay()) { touchFire = true; tryFire(); }
        } else if (act === 'shield') shieldBurst();
        else if (act === 'dash') dash();
      });
      function release() {
        setPressed(btn, false);
        if (act === 'fire') touchFire = false;
      }
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
        btn.addEventListener(t, release);
      });
      btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    })(actBtns[ai]);
  }

  root.querySelector('#as-hud-pause').addEventListener('click', function () { togglePause(); });
  root.querySelector('#as-resume').addEventListener('click', function () { togglePause(false); });
  root.querySelector('#as-pause-restart').addEventListener('click', function () {
    startGame(st ? st.diffIdx : diffIdx);
  });
  root.querySelector('#as-again').addEventListener('click', function () {
    startGame(st ? st.diffIdx : diffIdx);
  });
  root.querySelector('#as-change').addEventListener('click', function () {
    openPicker();
  });

  var diffBtns = startEl.querySelectorAll('[data-diff]');
  for (var di = 0; di < diffBtns.length; di++) {
    (function (b) {
      b.addEventListener('click', function () {
        startGame(parseInt(b.getAttribute('data-diff'), 10));
      });
    })(diffBtns[di]);
  }

  Arcade.input.onKeys({
    left: function () { if (canPlay()) keys.left = true; },
    right: function () { if (canPlay()) keys.right = true; },
    up: function () { if (canPlay()) keys.thrust = true; },
    down: function () { if (canPlay()) keys.reverse = true; },
    action: function () { if (canPlay()) { keys.fire = true; tryFire(); } }
  });

  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.thrust = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.reverse = false;
    if (e.code === 'Space' || e.code === 'Enter') keys.fire = false;
  });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (st && !st.over) {
        e.preventDefault();
        if (!e.repeat) togglePause();
      }
      return;
    }
    if (!canPlay()) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
      if (!e.repeat) shieldBurst();
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      if (!e.repeat) dash();
    }
  });

  window.addEventListener('blur', function () {
    resetInput();
    if (st && !st.over && !paused) togglePause(true);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && st && !st.over && !paused) togglePause(true);
  });

  // 桌面鼠标：朝落点转向并射击（触屏交给摇杆与 FIRE，避免误触）
  canvas.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    ev.preventDefault();
    var p;
    if (window.GK && GK.pointer) p = GK.pointer(canvas, ev);
    else {
      var r = canvas.getBoundingClientRect();
      p = { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
    }
    fireAtPoint(p.x, p.y);
  });

  /* ---------- 说明 / 全局钩子 ---------- */
  var hd = document.createElement('div');
  hd.className = 'as-help';
  hd.innerHTML = T('gs.asteroidf.helpText');
  wrapEl.appendChild(hd);

  window.GAME_RESTART = function () {
    startGame(st ? st.diffIdx : diffIdx);
  };

  /* ---------- 启动 ---------- */
  loopApi = Arcade.loop.start(update, draw, STEP);
  openPicker();
})();
