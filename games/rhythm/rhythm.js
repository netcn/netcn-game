/* ============================================================
   节拍脉冲 · 旗舰版 Pulse Tap
   · 3 首曲目（104 / 132 / 160 BPM）× Easy / Normal / Hard
   · 模式模板谱面：连续流、双押、Hold、Flick 滑动
   · Perfect / Great / Good / Miss · 连击 · 准确率 · S~D 评级
   · ±300ms 音频偏移校准（持久化 + 试听节拍）
   · 自绘霓虹轨道、长按流光、粒子、屏震；无 emoji 美术
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  var QA = /[?&]qa=1/.test(location.search);

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.rhythm.tut1t'), d: T('gs.rhythm.tut1') },
    { t: T('gs.rhythm.tut2t'), d: T('gs.rhythm.tut2') },
    { t: T('gs.rhythm.tut3t'), d: T('gs.rhythm.tut3') }
  ];

  var W = 400, H = 600;
  var HIT_Y = 494;
  var LEAD = 1800;
  var PERFECT_W = 42, GREAT_W = 88, GOOD_W = 140;
  var KEY_LABELS = ['D', 'F', 'J', 'K'];
  var KEY_CODES = [
    ['KeyD', 'ArrowLeft'],
    ['KeyF', 'ArrowDown'],
    ['KeyJ', 'ArrowUp'],
    ['KeyK', 'ArrowRight']
  ];
  var CALIB_KEY = 'arcade_rhythm_calib';
  var DIRS = ['left', 'right', 'up', 'down'];

  var SONGS = [
    {
      id: 'neon', nameKey: 'gs.rhythm.songNeon', styleKey: 'gs.rhythm.songNeonSub',
      bpm: 104, dur: 62, seed: 20261105,
      colors: ['#00f0ff', '#b967ff', '#39ff14', '#ff2d95'],
      accent: '#00f0ff', accent2: '#b967ff',
      bass: [55.0, 65.4, 49.0, 58.3],
      melody: [440, -1, 494, -1, 523, -1, 392, 440, 349, -1, 440, -1, 523, 494, 392, -1]
    },
    {
      id: 'drive', nameKey: 'gs.rhythm.songDrive', styleKey: 'gs.rhythm.songDriveSub',
      bpm: 132, dur: 62, seed: 771013,
      colors: ['#ffe600', '#00f0ff', '#ff9f1c', '#ff2d95'],
      accent: '#ffe600', accent2: '#00f0ff',
      bass: [73.4, 87.3, 65.4, 82.4],
      melody: [587, 659, 784, -1, 659, 587, 523, -1, 587, 784, 880, -1, 784, 659, 587, -1]
    },
    {
      id: 'overclock', nameKey: 'gs.rhythm.songOverclock', styleKey: 'gs.rhythm.songOverclockSub',
      bpm: 160, dur: 60, seed: 991127,
      colors: ['#ff2d95', '#ff5c74', '#b967ff', '#ffe600'],
      accent: '#ff2d95', accent2: '#b967ff',
      bass: [58.3, 77.8, 69.3, 87.3],
      melody: [880, 784, 988, 880, 1047, -1, 988, 784, 880, 1175, 1047, -1, 988, 880, 784, -1]
    }
  ];
  var DIFFS = [
    { key: 'easy', nameKey: 'gs.rhythm.dEasy', step: 1.5, gap: 0.4, hold: 0.35, flick: 0.10, double: 0.04 },
    { key: 'normal', nameKey: 'gs.rhythm.dNormal', step: 1.0, gap: 0.12, hold: 0.5, flick: 0.28, double: 0.16 },
    { key: 'hard', nameKey: 'gs.rhythm.dHard', step: 0.5, gap: 0.02, hold: 0.55, flick: 0.42, double: 0.30 }
  ];

  root.innerHTML =
    '<div class="rh-wrap">' +
    '  <div class="rh-top">' +
    '    <span>' + T('gs.rhythm.hudScore') + ' <b id="rh-score">0</b></span>' +
    '    <span>' + T('gs.rhythm.hudCombo') + ' <b id="rh-combo">0</b></span>' +
    '    <span>' + T('gs.rhythm.hudAcc') + ' <b id="rh-acc">100%</b></span>' +
    '    <span>' + T('gs.rhythm.hudProg') + ' <b id="rh-prog">0%</b></span>' +
    '  </div>' +
    '  <div class="rh-stage">' +
    '    <canvas class="rh-canvas" id="rh-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '    <div class="rh-screen" id="rh-menu">' +
    '      <div class="rh-screen-title">' + T('gs.rhythm.menuTitle') + '</div>' +
    '      <div class="rh-screen-sub">' + T('gs.rhythm.menuSub') + '</div>' +
    '      <div class="rh-songs" id="rh-songs"></div>' +
    '      <div class="rh-diffs" id="rh-diffs"></div>' +
    '      <div class="rh-best" id="rh-best"></div>' +
    '      <div class="rh-calib">' +
    '        <div class="rh-calib-head"><span>' + T('gs.rhythm.calibLabel') + '</span><b id="rh-calib-val">0 ms</b></div>' +
    '        <div class="rh-calib-row">' +
    '          <button class="rh-calib-btn" data-cal="-10">−10</button>' +
    '          <input id="rh-calib-slider" type="range" min="-300" max="300" step="10" value="0" aria-label="' + T('gs.rhythm.calibLabel') + '">' +
    '          <button class="rh-calib-btn" data-cal="10">+10</button>' +
    '        </div>' +
    '        <div class="rh-calib-foot">' +
    '          <button class="rh-calib-test" id="rh-calib-test">' + T('gs.rhythm.calibTest') + '</button>' +
    '          <span class="rh-calib-dot" id="rh-calib-dot"></span>' +
    '        </div>' +
    '      </div>' +
    '      <button class="btn green" id="rh-start">' + T('gs.rhythm.startBtn') + '</button>' +
    '    </div>' +
    '    <div class="rh-screen hidden" id="rh-result">' +
    '      <div class="rh-screen-title" id="rh-res-title"></div>' +
    '      <div class="rh-grade" id="rh-grade">S</div>' +
    '      <div class="rh-res-grid" id="rh-res-stats"></div>' +
    '      <div class="rh-screen-btns">' +
    '        <button class="btn green" id="rh-again">' + T('gs.rhythm.replay') + '</button>' +
    '        <button class="btn purple" id="rh-change">' + T('gs.rhythm.quit') + '</button>' +
    '      </div>' +
    '    </div>' +
    '    <div class="rh-screen hidden" id="rh-pause">' +
    '      <div class="rh-screen-title" id="rh-pause-title">' + T('gs.rhythm.paused') + '</div>' +
    '      <div class="rh-screen-sub" id="rh-pause-sub"></div>' +
    '      <div class="rh-screen-btns">' +
    '        <button class="btn green" id="rh-resume">' + T('gs.rhythm.resume') + '</button>' +
    '        <button class="btn yellow" id="rh-pause-restart">' + T('gs.rhythm.restart') + '</button>' +
    '        <button class="btn purple" id="rh-quit">' + T('gs.rhythm.quit') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="rh-lanes" id="rh-lanes">' +
    '    <button class="rh-lane-pad" data-lane="0">D</button>' +
    '    <button class="rh-lane-pad" data-lane="1">F</button>' +
    '    <button class="rh-lane-pad" data-lane="2">J</button>' +
    '    <button class="rh-lane-pad" data-lane="3">K</button>' +
    '  </div>' +
    '  <div class="rh-msg" id="rh-msg">' + T('gs.rhythm.help') + '</div>' +
    '  <div class="game-controls">' +
    '    <button class="btn" id="rh-pause-btn">' + T('gs.rhythm.pause') + '</button>' +
    '    <button class="btn purple" id="rh-restart-btn">' + T('gs.rhythm.restart') + '</button>' +
    '  </div>' +
    '</div>';

  var canvas = document.getElementById('rh-canvas');
  var info = GK.setup(canvas, W, H);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = info.ctx;
  var scoreEl = document.getElementById('rh-score');
  var comboEl = document.getElementById('rh-combo');
  var accEl = document.getElementById('rh-acc');
  var progEl = document.getElementById('rh-prog');
  var msgEl = document.getElementById('rh-msg');
  var menuScreen = document.getElementById('rh-menu');
  var resultScreen = document.getElementById('rh-result');
  var pauseScreen = document.getElementById('rh-pause');
  var pauseTitle = document.getElementById('rh-pause-title');
  var pauseSub = document.getElementById('rh-pause-sub');
  var songsEl = document.getElementById('rh-songs');
  var diffsEl = document.getElementById('rh-diffs');
  var bestEl = document.getElementById('rh-best');
  var calibValEl = document.getElementById('rh-calib-val');
  var calibSlider = document.getElementById('rh-calib-slider');
  var calibDot = document.getElementById('rh-calib-dot');
  var resTitle = document.getElementById('rh-res-title');
  var resStats = document.getElementById('rh-res-stats');
  var gradeEl = document.getElementById('rh-grade');
  var startBtn = document.getElementById('rh-start');
  var againBtn = document.getElementById('rh-again');
  var changeBtn = document.getElementById('rh-change');
  var resumeBtn = document.getElementById('rh-resume');
  var pauseRestartBtn = document.getElementById('rh-pause-restart');
  var quitBtn = document.getElementById('rh-quit');
  var pauseBtn = document.getElementById('rh-pause-btn');
  var restartBtn = document.getElementById('rh-restart-btn');
  var lanesEl = document.getElementById('rh-lanes');

  var state = 'menu';          // menu | playing | over
  var screen = 'menu';         // menu | result | pause | resume | none
  var paused = false;
  var songIndex = 0;
  var diffIndex = 1;
  var song = SONGS[0];
  var chart = null;
  var startTs = 0, pausedTotal = 0, pausedAtSong = 0, pauseRealAt = 0;
  var calib = 0;
  var perfect = 0, great = 0, good = 0, miss = 0, combo = 0, maxCombo = 0;
  var weighted = 0, score = 0, totalJudged = 0, finished = false;
  var laneFlash = [0, 0, 0, 0];
  var laneHold = [null, null, null, null];
  var shockwaves = [], particles = [], floats = [];
  var shake = 0;
  var lastDraw = 0, lastMissSound = 0, lastMissFx = 0, lastSaveAt = 0, lastTickAt = 0;
  var activePointers = {};
  var calibPreviewTimers = [];
  var resumeToast = null;

  try {
    var savedCalib = Number(localStorage.getItem(CALIB_KEY));
    if (isFinite(savedCalib)) calib = Math.max(-300, Math.min(300, savedCalib));
  } catch (e) { calib = 0; }

  /* ---------------- 音频：自建 AudioContext，逐曲 BGM ---------------- */
  var actx = null, master = null, noiseBuffer = null;
  var bgmTimer = null, bgmBeat = 0, bgmNextTime = 0;

  function audioOk() {
    try {
      if (Arcade.audio && Arcade.audio.isMuted && Arcade.audio.isMuted()) return false;
      if (Arcade.settings && Arcade.settings.get && Arcade.settings.get().music === false) return false;
    } catch (e) { }
    return true;
  }

  function initAudio() {
    if (actx) {
      if (actx.state === 'suspended') { try { actx.resume(); } catch (e) { } }
      return actx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      actx = new AC();
      master = actx.createGain();
      master.gain.value = audioOk() ? 1 : 0;
      master.connect(actx.destination);
      var len = Math.floor(actx.sampleRate * 0.3);
      noiseBuffer = actx.createBuffer(1, len, actx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      actx = null; master = null;
    }
    return actx;
  }

  function tone(freq, t, dur, gain, type, slideTo) {
    if (!actx || !master) return;
    try {
      var o = actx.createOscillator();
      var g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { }
  }

  function noiseHit(t, dur, gain, hp) {
    if (!actx || !master || !noiseBuffer) return;
    try {
      var src = actx.createBufferSource();
      src.buffer = noiseBuffer;
      var g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(g);
      if (hp) {
        var f = actx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = hp;
        g.connect(f); f.connect(master);
      } else {
        g.connect(master);
      }
      src.start(t); src.stop(t + dur + 0.01);
    } catch (e) { }
  }

  function playBeat(idx, t) {
    var spb = chart ? chart.beatMs / 1000 : 0.625;
    var s = song || SONGS[0];
    tone(150, t, 0.13, 0.22, 'sine', 52);
    if (idx % 4 === 1 || idx % 4 === 3) noiseHit(t + 0.01, 0.09, 0.12, 1100);
    noiseHit(t, 0.03, 0.045, 3600);
    noiseHit(t + spb / 2, 0.025, 0.03, 4600);
    if (idx % 2 === 0) {
      var root = s.bass[Math.floor(idx / 4) % s.bass.length];
      tone(root, t, spb * 0.58, 0.10, 'triangle');
      tone(root * 2, t + 0.02, spb * 0.32, 0.025, 'sine');
    }
    var mf = s.melody[((idx % 16) + 16) % 16];
    if (mf > 0) {
      tone(mf, t + 0.015, spb * 0.3, 0.055, 'triangle');
      if (songIndex === 2) tone(mf * 1.5, t + 0.01, spb * 0.18, 0.02, 'square');
    }
    if (idx % 8 === 0) {
      var chordRoot = s.bass[0] * 2;
      tone(chordRoot * 1.25, t + 0.02, spb * 0.9, 0.018, 'sine');
      tone(chordRoot * 1.5, t + 0.03, spb * 0.85, 0.016, 'sine');
    }
  }

  function startBgm() {
    if (!initAudio()) return;
    if (master) master.gain.value = audioOk() ? 1 : 0;
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) { } }
    var beatMs = chart ? chart.beatMs : 60000 / song.bpm;
    bgmBeat = Math.max(0, Math.floor(songNow() / beatMs));
    bgmNextTime = actx.currentTime + 0.06;
    clearInterval(bgmTimer);
    bgmTimer = setInterval(scheduleBgm, 90);
  }

  function scheduleBgm() {
    if (!actx || !chart) return;
    if (actx.state !== 'running') return;
    if (master) master.gain.value = audioOk() ? 1 : 0;
    if (bgmNextTime < actx.currentTime - 0.05) bgmNextTime = actx.currentTime + 0.05;
    var spb = chart.beatMs / 1000;
    var totalBeats = Math.ceil((chart.endTime + 900) / chart.beatMs);
    while (bgmNextTime < actx.currentTime + 0.35 && bgmBeat <= totalBeats) {
      playBeat(bgmBeat, bgmNextTime);
      bgmBeat++;
      bgmNextTime += spb;
    }
    if (bgmBeat > totalBeats) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  function stopBgm(suspend) {
    clearInterval(bgmTimer);
    bgmTimer = null;
    if (actx && suspend) { try { actx.suspend(); } catch (e) { } }
  }

  function resumeBgm() {
    if (!actx) { startBgm(); return; }
    try { actx.resume(); } catch (e) { }
    var beatMs = chart ? chart.beatMs : 60000 / song.bpm;
    bgmBeat = Math.max(0, Math.floor(songNow() / beatMs));
    bgmNextTime = actx.currentTime + 0.06;
    clearInterval(bgmTimer);
    bgmTimer = setInterval(scheduleBgm, 90);
  }

  /* ---------------- 谱面生成（可复现 seed） ---------------- */
  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      s = Math.imul(s ^ (s >>> 15), 1 | s);
      s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s;
      return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildChart(s, diff, seed) {
    var rnd = mulberry32(seed || s.seed);
    var beatMs = 60000 / s.bpm;
    var totalBeats = Math.floor(s.dur * 1000 / beatMs);
    var startBeat = Math.ceil(2400 / beatMs);
    var notes = [];
    var laneBusy = [0, 0, 0, 0];
    var laneLast = [-9999, -9999, -9999, -9999];
    var step = diff.step;

    function pickLane(t, exclude) {
      for (var a = 0; a < 6; a++) {
        var l = Math.floor(rnd() * 4);
        if (l === exclude) continue;
        if (laneBusy[l] > t + 110) continue;
        if (laneLast[l] + 170 > t) continue;
        return l;
      }
      return -1;
    }
    function add(lane, time, type, dur, dir) {
      notes.push({
        lane: lane, time: time, type: type || 'tap', dur: dur || 0,
        dir: dir || null, judged: false, res: null, holding: false,
        startRank: null, source: null, tickAcc: 0
      });
      laneLast[lane] = time;
      if (dur) laneBusy[lane] = time + dur;
    }

    for (var b = startBeat; b <= totalBeats - 2; b += step) {
      var t = b * beatMs;
      if (t < 2400) continue;
      if (rnd() < diff.gap) continue;
      var section = Math.floor((b - startBeat) / 8);
      var mode = ['stream', 'sync', 'hold', 'swipe', 'burst'][section % 5];
      var lane = pickLane(t, -1);
      if (lane < 0) continue;
      var type = 'tap', dur = 0, dir = null;
      if (mode === 'hold' && rnd() < diff.hold) {
        var beats = 2 + Math.floor(rnd() * 3);
        var holdDur = Math.min(beats * beatMs, (totalBeats - 2) * beatMs - t - 100);
        if (holdDur >= beatMs * 1.5) {
          type = 'hold'; dur = holdDur;
        }
      } else if (mode === 'swipe' && rnd() < diff.flick) {
        type = 'flick'; dir = DIRS[Math.floor(rnd() * 4)];
      }
      add(lane, t, type, dur, dir);

      var dblChance = diff.double * (mode === 'sync' ? 1.7 : 1);
      if (rnd() < dblChance) {
        var l2 = pickLane(t, lane);
        if (l2 >= 0) add(l2, t, 'tap', 0, null);
      }
      if (diff.key === 'hard' && mode === 'sync' && rnd() < 0.3) {
        var l3 = pickLane(t, lane);
        if (l3 >= 0) add(l3, t, 'tap', 0, null);
      }
      if (mode === 'burst' && rnd() < 0.35) {
        var off = beatMs * 0.25;
        if (t + off < (totalBeats - 2) * beatMs) {
          var lb = pickLane(t + off, lane);
          if (lb >= 0) add(lb, t + off, 'tap', 0, null);
        }
      }
    }

    notes.sort(function (a, b2) { return a.time - b2.time; });
    var last = notes.length ? notes[notes.length - 1] : null;
    var endTime = (last ? last.time + last.dur : s.dur * 1000) + 1500;
    return {
      notes: notes, total: notes.length, beatMs: beatMs,
      seed: seed || s.seed, diffKey: diff.key, songId: s.id, endTime: endTime
    };
  }

  function songNow() {
    if (!startTs) return 0;
    if (paused) return pausedAtSong;
    return Math.max(0, Date.now() - startTs - pausedTotal);
  }
  function judgeNow() { return songNow() - calib; }

  /* ---------------- 状态 / 菜单 ---------------- */
  function fmtAcc() {
    var acc = totalJudged ? weighted / totalJudged : 0;
    return totalJudged ? (acc * 100).toFixed(1) : '100.0';
  }
  function updateHud() {
    scoreEl.textContent = String(Math.floor(score));
    comboEl.textContent = String(combo);
    accEl.textContent = fmtAcc() + '%';
    var prog = chart ? Math.min(100, Math.round(songNow() / chart.endTime * 100)) : 0;
    progEl.textContent = prog + '%';
  }
  function localBestKey(sid, dkey) { return 'arcade_rhythm_best_' + sid + '_' + dkey; }
  function readNum(key, dflt) {
    try {
      var v = localStorage.getItem(key);
      if (v === null || v === '') return dflt;
      var n = Number(v);
      return isFinite(n) ? n : dflt;
    } catch (e) { return dflt; }
  }
  function writeNum(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) { }
  }
  function globalBest() {
    return Arcade.storage ? Arcade.storage.getBest('rhythm') : null;
  }

  function renderSongs() {
    songsEl.innerHTML = SONGS.map(function (s, i) {
      return '<button class="rh-song' + (i === songIndex ? ' selected' : '') + '" data-song="' + i + '">' +
        '<b>' + T(s.nameKey) + '</b><span>' + T(s.styleKey) + '</span></button>';
    }).join('');
  }
  function renderDiffs() {
    var s = SONGS[songIndex];
    diffsEl.innerHTML = DIFFS.map(function (d, i) {
      var c = buildChart(s, d, s.seed + i * 7919);
      return '<button class="rh-diff' + (i === diffIndex ? ' selected' : '') + '" data-diff="' + i + '">' +
        '<b>' + T(d.nameKey) + '</b>' +
        '<span>' + T('gs.rhythm.noteCount').replace('{n}', c.total) + '</span>' +
        '</button>';
    }).join('');
  }
  function menuBest() {
    var s = SONGS[songIndex], d = DIFFS[diffIndex];
    var lb = readNum(localBestKey(s.id, d.key), -1);
    var gb = globalBest();
    bestEl.innerHTML =
      T('gs.rhythm.bestLocal').replace('{n}', lb >= 0 ? lb : '--') + ' · ' +
      T('gs.rhythm.bestGlobal').replace('{n}', gb == null ? '--' : gb);
  }
  function refreshMenu() {
    renderSongs();
    renderDiffs();
    menuBest();
    renderCalib();
  }

  function renderCalib() {
    calibValEl.textContent = (calib > 0 ? '+' : '') + calib + ' ms';
    calibSlider.value = String(calib);
  }
  function setCalib(v) {
    calib = Math.max(-300, Math.min(300, Math.round(Number(v) || 0)));
    renderCalib();
    writeNum(CALIB_KEY, calib);
  }
  function pulseCalibDot() {
    if (!calibDot) return;
    calibDot.classList.add('beat');
    setTimeout(function () { calibDot.classList.remove('beat'); }, 150);
  }
  function previewCalibration() {
    calibPreviewTimers.forEach(function (t) { clearTimeout(t); });
    calibPreviewTimers = [];
    for (var i = 0; i < 8; i++) {
      (function (idx) {
        calibPreviewTimers.push(setTimeout(function () {
          pulseCalibDot();
          if (Arcade.audio) Arcade.audio.play('ui');
        }, 140 + idx * 500));
      })(i);
    }
    if (!initAudio()) return;
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) { } }
    var start = actx.currentTime + 0.14;
    for (var k = 0; k < 8; k++) {
      tone(880, start + k * 0.5, 0.05, 0.22, 'square');
      tone(440, start + k * 0.5, 0.09, 0.08, 'sine');
    }
  }

  /* ---------------- 游戏流 ---------------- */
  function resetGameState() {
    perfect = 0; great = 0; good = 0; miss = 0; combo = 0; maxCombo = 0;
    weighted = 0; score = 0; totalJudged = 0; finished = false;
    laneFlash = [0, 0, 0, 0];
    laneHold = [null, null, null, null];
    shockwaves = []; particles = []; floats = [];
    activePointers = {};
    shake = 0;
    lastMissSound = 0; lastSaveAt = Date.now(); lastTickAt = Date.now();
  }
  function hideAllScreens() {
    menuScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    screen = 'none';
  }
  /* 菜单/结算时底栏按钮无效，直接禁用，避免死按钮与重复入口 */
  function syncBottomControls() {
    var on = state === 'playing' && screen !== 'result';
    pauseBtn.disabled = !on;
    restartBtn.disabled = !on;
  }
  function startGame(opts) {
    opts = opts || {};
    song = SONGS[songIndex];
    var diff = DIFFS[diffIndex];
    var seed = opts.seed || (song.seed + diffIndex * 7919);
    chart = buildChart(song, diff, seed);
    resetGameState();
    paused = false; pausedTotal = 0; pausedAtSong = 0; pauseRealAt = 0;
    startTs = Date.now();
    state = 'playing';
    hideAllScreens();
    syncBottomControls();
    msgEl.textContent = T('gs.rhythm.playingMsg')
      .replace('{s}', T(song.nameKey)).replace('{b}', song.bpm).replace('{d}', T(diff.nameKey));
    msgEl.style.color = 'var(--neon-cyan)';
    startBgm();
    updateHud();
    if (Arcade.audio) Arcade.audio.play('ui');
    if (Arcade.savegame) Arcade.savegame.write();
  }
  function backToMenu() {
    state = 'menu';
    screen = 'menu';
    paused = false;
    startTs = 0;
    chart = null;
    stopBgm(true);
    hideAllScreens();
    menuScreen.classList.remove('hidden');
    screen = 'menu';
    msgEl.textContent = T('gs.rhythm.help');
    msgEl.style.color = '';
    syncBottomControls();
    refreshMenu();
    updateHud();
    if (Arcade.savegame) Arcade.savegame.clear();
    if (Arcade.audio) Arcade.audio.play('back');
  }

  function rankOf(delta) {
    var abs = Math.abs(delta);
    if (abs <= PERFECT_W) return 'perfect';
    if (abs <= GREAT_W) return 'great';
    if (abs <= GOOD_W) return 'good';
    return null;
  }
  function rankText(res) {
    if (res === 'perfect') return T('gs.rhythm.jPerfect');
    if (res === 'great') return T('gs.rhythm.jGreat');
    if (res === 'good') return T('gs.rhythm.jGood');
    return T('gs.rhythm.jMiss');
  }
  function rankColor(res) {
    if (res === 'perfect') return '#39ff14';
    if (res === 'great') return '#00f0ff';
    if (res === 'good') return '#ffe600';
    return '#ff2d95';
  }
  function spawnBurst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 50 + Math.random() * 230;
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
        life: 1, size: 1.5 + Math.random() * 3, color: color
      });
    }
  }
  function addFloat(text, x, y, color, size) {
    floats.push({ text: text, x: x, y: y, color: color, life: 1, size: size || 16 });
  }
  function laneX(lane) { return lane * (W / 4) + (W / 4) / 2; }
  function hitEffects(lane, res, n) {
    var col = rankColor(res);
    var lx = laneX(lane);
    addFloat(rankText(res), lx, HIT_Y - 28, col, res === 'perfect' ? 19 : 15);
    shockwaves.push({ x: lx, y: HIT_Y, r: 8, life: 1, color: col, max: 70 });
    spawnBurst(lx, HIT_Y, col, res === 'perfect' ? 16 : res === 'great' ? 11 : 7);
    if (res === 'perfect') {
      if (Arcade.audio) Arcade.audio.play('coin');
      screenShake(2.2);
    } else if (Arcade.audio) Arcade.audio.play('ui');
  }
  function screenShake(amount) { shake = Math.max(shake, amount); }

  function hitNote(n, now, opts) {
    opts = opts || {};
    var rank = rankOf(now - n.time);
    if (!rank) return false;
    if (n.type === 'flick' && opts.requireDir && n.dir && opts.dir && n.dir !== opts.dir) return false;
    n.judged = true;
    n.res = rank;
    if (rank === 'perfect') { perfect++; weighted += 1; }
    else if (rank === 'great') { great++; weighted += 0.72; }
    else { good++; weighted += 0.42; }
    totalJudged++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    var base = rank === 'perfect' ? 120 : rank === 'great' ? 72 : 38;
    score += base + Math.min(combo, 80) * 2 + (n.type === 'flick' ? 30 : 0);
    hitEffects(n.lane, rank, n);
    if (combo >= 10 && combo % 10 === 0) {
      addFloat(T('gs.rhythm.comboTag').replace('{n}', combo), W / 2, HIT_Y - 150, '#ffffff', 14);
      screenShake(4);
      if (Arcade.fx) Arcade.fx.flash(rankColor(rank));
    }
    updateHud();
    return true;
  }

  function startHold(n, source, now) {
    var rank = rankOf(now - n.time);
    if (!rank) return false;
    n.holding = true;
    n.judged = false;
    n.startRank = rank;
    n.source = source;
    laneHold[n.lane] = { note: n, source: source };
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    score += 25 + Math.min(combo, 80) * 2;
    addFloat(T('gs.rhythm.holdStart'), laneX(n.lane), HIT_Y - 30, '#ffffff', 12);
    spawnBurst(laneX(n.lane), HIT_Y, song.colors[n.lane], 8);
    if (Arcade.audio) Arcade.audio.play('ui');
    updateHud();
    return true;
  }
  function completeHold(n) {
    if (!n || n.judged) return;
    n.judged = true;
    n.holding = false;
    var rank = n.startRank || 'good';
    n.res = rank;
    if (rank === 'perfect') { perfect++; weighted += 1; }
    else if (rank === 'great') { great++; weighted += 0.72; }
    else { good++; weighted += 0.42; }
    totalJudged++;
    var beats = Math.max(1, n.dur / (chart ? chart.beatMs : 500));
    score += 40 + Math.round(beats * 10) + (rank === 'perfect' ? 25 : 0);
    hitEffects(n.lane, rank, n);
    addFloat(T('gs.rhythm.holdDone'), laneX(n.lane), HIT_Y - 54, '#39ff14', 11);
    if (laneHold[n.lane] && laneHold[n.lane].note === n) laneHold[n.lane] = null;
    updateHud();
  }
  function missNote(n, withSound) {
    if (!n || n.judged) return;
    n.judged = true;
    n.holding = false;
    n.res = 'miss';
    miss++;
    totalJudged++;
    combo = 0;
    addFloat(T('gs.rhythm.jMiss'), laneX(n.lane), HIT_Y - 28, '#ff2d95', 14);
    shockwaves.push({ x: laneX(n.lane), y: HIT_Y, r: 6, life: 1, color: '#ff2d95', max: 45 });
    if (laneHold[n.lane] && laneHold[n.lane].note === n) laneHold[n.lane] = null;
    if (withSound && Arcade.audio && Date.now() - lastMissSound > 220) {
      lastMissSound = Date.now();
      Arcade.audio.play('error');
    }
    if (withSound && Arcade.fx && Date.now() - lastMissFx > 180) {
      lastMissFx = Date.now();
      Arcade.fx.flash('rgba(255,45,74,0.15)');
    }
    updateHud();
  }

  function pressLane(lane, source, px, py, isPad) {
    if (state !== 'playing' || paused || !chart) return false;
    laneFlash[lane] = 1;
    var now = judgeNow();
    var best = null, bestAbs = 1e9;
    for (var i = 0; i < chart.notes.length; i++) {
      var n = chart.notes[i];
      if (n.judged || n.holding || n.lane !== lane) continue;
      var d = now - n.time;
      if (Math.abs(d) > GOOD_W) continue;
      if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); best = n; }
    }
    if (!best) {
      spawnBurst(laneX(lane), HIT_Y, song.colors[lane], 4);
      return false;
    }
    if (best.type === 'hold') {
      return startHold(best, source, now);
    }
    if (best.type === 'flick' && !isPad && source.charAt(0) === 'p') {
      activePointers[source] = {
        lane: lane, startX: px, startY: py, flick: best, source: source
      };
      return false;
    }
    return hitNote(best, now, { requireDir: false });
  }

  function releaseLane(lane, source) {
    var h = laneHold[lane];
    if (!h || h.source !== source) return;
    var n = h.note;
    if (!n || n.judged) { laneHold[lane] = null; return; }
    var tail = n.time + n.dur;
    var now = judgeNow();
    if (now < tail - 160) {
      missNote(n, true);
      addFloat(T('gs.rhythm.holdBreak'), laneX(lane), HIT_Y - 50, '#ff2d95', 11);
    } else {
      completeHold(n);
    }
    laneHold[lane] = null;
  }

  function pointerMove(source, x, y) {
    var p = activePointers[source];
    if (!p || !p.flick) return;
    var dx = x - p.startX, dy = y - p.startY;
    if (Math.sqrt(dx * dx + dy * dy) < 22) return;
    var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (dir === p.flick.dir) {
      hitNote(p.flick, judgeNow(), { requireDir: true, dir: dir });
      p.flick = null;
    }
  }

  /* ---------------- 每帧逻辑 ---------------- */
  function update() {
    if (state !== 'playing' || paused || !chart) return;
    var now = judgeNow();
    var realNow = Date.now();
    for (var i = 0; i < chart.notes.length; i++) {
      var n = chart.notes[i];
      if (n.judged) continue;
      if (n.holding) {
        var tail = n.time + n.dur;
        if (now > tail + 50) completeHold(n);
        continue;
      }
      if (now > n.time + GOOD_W) missNote(n, true);
    }
    if (realNow - lastTickAt > 120) {
      lastTickAt = realNow;
      for (var l = 0; l < 4; l++) {
        var h = laneHold[l];
        if (!h || !h.note || h.note.judged) continue;
        score += 2;
        laneFlash[l] = Math.max(laneFlash[l], 0.55);
        if (Math.random() < 0.4) {
          spawnBurst(laneX(l), HIT_Y - 10, song.colors[l], 2);
        }
      }
    }
    if (songNow() > chart.endTime) finishGame();
    updateHud();
    if (realNow - lastSaveAt > 2000) {
      lastSaveAt = realNow;
      if (Arcade.savegame) Arcade.savegame.write();
    }
  }

  function finalizeNotes() {
    for (var i = 0; i < chart.notes.length; i++) {
      var n = chart.notes[i];
      if (n.judged) continue;
      if (n.holding) completeHold(n);
      else missNote(n, false);
    }
  }

  function finishGame() {
    if (finished || !chart) return;
    finalizeNotes();
    finished = true;
    state = 'over';
    screen = 'result';
    paused = false;
    stopBgm(true);
    var acc = totalJudged ? weighted / totalJudged : 0;
    var grade = 'D';
    if (acc >= 0.95) grade = 'S';
    else if (acc >= 0.85) grade = 'A';
    else if (acc >= 0.70) grade = 'B';
    else if (acc >= 0.50) grade = 'C';
    var key = localBestKey(song.id, DIFFS[diffIndex].key);
    var lb = readNum(key, -1);
    var isNewLocal = score > 0 && score > lb;
    if (isNewLocal) writeNum(key, score);
    var isNewGlobal = false;
    if (Arcade.shell && score > 0) isNewGlobal = !!Arcade.shell.submitScore(score);
    var gb = globalBest();
    if (Arcade.juice) Arcade.juice.win();
    msgEl.textContent = T('gs.rhythm.done').replace('{n}', maxCombo);
    msgEl.style.color = 'var(--neon-green)';
    resTitle.textContent = T('gs.rhythm.resultTitle')
      .replace('{s}', T(song.nameKey)).replace('{d}', T(DIFFS[diffIndex].nameKey));
    gradeEl.textContent = grade;
    gradeEl.className = 'rh-grade grade-' + grade;
    var rows = [
      { k: T('gs.rhythm.resPerfect'), v: String(perfect) },
      { k: T('gs.rhythm.resGreat'), v: String(great) },
      { k: T('gs.rhythm.resGood'), v: String(good) },
      { k: T('gs.rhythm.resMiss'), v: String(miss) },
      { k: T('gs.rhythm.resCombo'), v: String(maxCombo) },
      { k: T('gs.rhythm.resAcc'), v: (acc * 100).toFixed(1) + '%' },
      { k: T('gs.rhythm.resScore'), v: String(Math.floor(score)) },
      { k: T('gs.rhythm.resBest'), v: (Math.max(lb, score) > 0 ? String(Math.max(lb, score)) : '--') },
      { k: T('gs.rhythm.resBestGlobal'), v: gb == null ? '--' : String(gb) }
    ];
    resStats.innerHTML = rows.map(function (r) {
      return '<div class="rh-res-row"><span>' + r.k + '</span><b>' + r.v + '</b></div>';
    }).join('') +
      (isNewLocal ? '<div class="rh-res-new">' + T('gs.rhythm.newRecord') + '</div>' : '') +
      '<div class="rh-res-row"><span>' + T('gs.rhythm.noFail') + '</span></div>';
    resultScreen.classList.remove('hidden');
    syncBottomControls();
    if (Arcade.savegame) Arcade.savegame.clear();
  }

  function togglePause() {
    if (screen === 'resume' || screen === 'pause') { resumeGame(); return; }
    if (state !== 'playing' || screen === 'result') return;
    if (!paused) {
      pausedAtSong = songNow();
      paused = true;
      pauseRealAt = Date.now();
      stopBgm(true);
      pauseTitle.textContent = T('gs.rhythm.paused');
      pauseSub.textContent = T('gs.rhythm.pausedSub');
      pauseScreen.classList.remove('hidden');
      screen = 'pause';
      msgEl.textContent = T('gs.rhythm.paused');
      msgEl.style.color = 'var(--neon-yellow)';
      if (Arcade.savegame) Arcade.savegame.write();
    } else {
      resumeGame();
    }
    syncBottomControls();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function resumeGame() {
    if (!paused) { pauseScreen.classList.add('hidden'); screen = 'none'; return; }
    paused = false;
    pausedTotal += Date.now() - pauseRealAt;
    pauseScreen.classList.add('hidden');
    screen = 'none';
    msgEl.textContent = T('gs.rhythm.playingMsg')
      .replace('{s}', T(song.nameKey)).replace('{b}', song.bpm).replace('{d}', T(DIFFS[diffIndex].nameKey));
    msgEl.style.color = 'var(--neon-cyan)';
    resumeBgm();
    updateHud();
  }

  /* ---------------- 存档 ---------------- */
  function collectSave() {
    if (state !== 'playing' || !chart) return null;
    return {
      v: 2,
      songId: song.id,
      diffKey: DIFFS[diffIndex].key,
      seed: chart.seed,
      elapsed: songNow(),
      score: score,
      combo: combo,
      maxCombo: maxCombo,
      perfect: perfect, great: great, good: good, miss: miss,
      weighted: weighted, totalJudged: totalJudged,
      calib: calib,
      paused: paused
    };
  }
  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    var si = -1;
    for (var i = 0; i < SONGS.length; i++) if (SONGS[i].id === s.songId) si = i;
    if (si < 0) si = 0;
    var di = -1;
    for (var j = 0; j < DIFFS.length; j++) if (DIFFS[j].key === s.diffKey) di = j;
    if (di < 0) di = 1;
    songIndex = si; diffIndex = di;
    song = SONGS[si];
    chart = buildChart(song, DIFFS[di], Number(s.seed) || (song.seed + di * 7919));
    var elapsed = Math.max(0, Math.min(chart.endTime - 100, Number(s.elapsed) || 0));
    resetGameState();
    perfect = Math.max(0, Number(s.perfect) || 0);
    great = Math.max(0, Number(s.great) || 0);
    good = Math.max(0, Number(s.good) || 0);
    miss = Math.max(0, Number(s.miss) || 0);
    weighted = Number(s.weighted) || (perfect + great * 0.72 + good * 0.42);
    totalJudged = Math.max(0, Number(s.totalJudged) || (perfect + great + good + miss));
    score = Math.max(0, Number(s.score) || 0);
    combo = Math.max(0, Number(s.combo) || 0);
    maxCombo = Math.max(combo, Number(s.maxCombo) || 0);
    if (s.calib != null) calib = Math.max(-300, Math.min(300, Number(s.calib) || 0));
    for (var k = 0; k < chart.notes.length; k++) {
      var n2 = chart.notes[k];
      if (n2.time + n2.dur < elapsed - 120) { n2.judged = true; n2.res = 'skip'; }
    }
    paused = true;
    pausedAtSong = elapsed;
    pausedTotal = 0;
    pauseRealAt = Date.now();
    startTs = Date.now() - elapsed;
    state = 'playing';
    finished = false;
    screen = 'resume';
    hideAllScreens();
    pauseTitle.textContent = T('gs.rhythm.resumed');
    pauseSub.textContent = T('gs.rhythm.resumedSub');
    pauseScreen.classList.remove('hidden');
    screen = 'resume';
    renderCalib();
    updateHud();
    return true;
  }

  /* ---------------- 渲染（Canvas 自绘，无 emoji 美术） ---------------- */
  var comboPop = 0, comboSeen = 0, lastDrawAt = 0;

  function rgba(hex, a) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (!isFinite(n)) return 'rgba(255,255,255,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function drawBackground(realNow) {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#06060f');
    bg.addColorStop(0.6, '#0a0715');
    bg.addColorStop(1, '#120820');
    ctx.fillStyle = bg;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    var accent = (song && song.accent) || '#00f0ff';
    var glow = ctx.createRadialGradient(W / 2, HIT_Y + 40, 10, W / 2, HIT_Y + 40, W * 0.95);
    glow.addColorStop(0, rgba(accent, 0.14));
    glow.addColorStop(0.5, rgba(accent, 0.04));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    var lw = W / 4;
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.014)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(i * lw, 0, lw, H);
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.055)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * lw + 0.5, 0);
        ctx.lineTo(i * lw + 0.5, H);
        ctx.stroke();
      }
    }

    var beatMs = chart ? chart.beatMs : 60000 / song.bpm;
    var tNow = chart ? songNow() : realNow;
    var phase = (tNow % beatMs) / beatMs;
    var step = HIT_Y / 9;
    for (var k = 0; k < 10; k++) {
      var y = HIT_Y - (k + 1 - phase) * step;
      if (y < 4 || y > H) continue;
      ctx.strokeStyle = k % 4 === 0 ? rgba(accent, 0.10) : 'rgba(255,255,255,0.022)';
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = rgba(accent, 0.85);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, HIT_Y + 0.5);
    ctx.lineTo(W, HIT_Y + 0.5);
    ctx.stroke();
    ctx.restore();

    for (var l = 0; l < 4; l++) {
      var f = laneFlash[l];
      if (f > 0.02) {
        ctx.fillStyle = rgba(song.colors[l], f * 0.20);
        ctx.fillRect(l * lw + 1, HIT_Y - 150, lw - 2, 190);
      }
      if (laneHold[l] && laneHold[l].note && !laneHold[l].note.judged) {
        ctx.fillStyle = rgba(song.colors[l], 0.14);
        ctx.fillRect(l * lw + 1, 0, lw - 2, HIT_Y);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(KEY_LABELS[l], l * lw + lw / 2, HIT_Y + 18);
    }
    ctx.textAlign = 'left';
  }

  function drawTapNote(n, x, y) {
    var col = song.colors[n.lane];
    var w = 66, h = 22;
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    GK.roundRect(ctx, x - w / 2, y - h / 2, w, h, 8);
    var g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, rgba(col, 0.95));
    g.addColorStop(1, rgba(col, 0.45));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  function drawFlickNote(n, x, y) {
    var col = song.colors[n.lane];
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(x, y - 17);
    ctx.lineTo(x + 30, y);
    ctx.lineTo(x, y + 17);
    ctx.lineTo(x - 30, y);
    ctx.closePath();
    ctx.fillStyle = rgba(col, 0.30);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.95);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    var d = n.dir || 'up';
    ctx.beginPath();
    if (d === 'up' || d === 'down') {
      var v = d === 'up' ? -1 : 1;
      ctx.moveTo(x - 9, y + v * 4);
      ctx.lineTo(x, y - v * 4);
      ctx.lineTo(x + 9, y + v * 4);
    } else {
      var hdir = d === 'left' ? -1 : 1;
      ctx.moveTo(x + hdir * 4, y - 9);
      ctx.lineTo(x - hdir * 4, y);
      ctx.lineTo(x + hdir * 4, y + 9);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawHoldNote(n, x, headY, tailY) {
    var col = song.colors[n.lane];
    var top = Math.min(headY, tailY);
    var bot = Math.max(headY, tailY);
    var bodyW = 16;
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = n.holding ? 20 : 10;
    ctx.strokeStyle = rgba(col, n.holding ? 0.95 : 0.6);
    ctx.lineWidth = 2;
    GK.roundRect(ctx, x - bodyW / 2, top, bodyW, Math.max(10, bot - top), 8);
    ctx.fillStyle = rgba(col, n.holding ? 0.5 : 0.2);
    ctx.fill();
    ctx.stroke();
    if (n.holding) {
      var flow = (realNowForFx() % 700) / 700;
      ctx.fillStyle = rgba('#ffffff', 0.35 * (1 - flow));
      ctx.fillRect(x - bodyW / 2 + 2, top + (bot - top) * flow, bodyW - 4, 5);
    }
    ctx.shadowBlur = 0;
    GK.roundRect(ctx, x - 27, headY - 8, 54, 16, 7);
    ctx.fillStyle = rgba(col, 0.9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  function realNowForFx() { return Date.now(); }

  function drawNotes() {
    if (!chart) return;
    var now = judgeNow();
    var speed = HIT_Y / LEAD;
    for (var i = 0; i < chart.notes.length; i++) {
      var n = chart.notes[i];
      if (n.judged && !n.holding) continue;
      var y = HIT_Y - (n.time - now) * speed;
      var tailY = n.type === 'hold' ? HIT_Y - (n.time + n.dur - now) * speed : y;
      if (y < -70 && tailY < -70) break;
      var x = laneX(n.lane);
      if (n.type === 'hold') {
        if (tailY > H + 40) continue;
        drawHoldNote(n, x, y, tailY);
      } else if (n.type === 'flick') {
        if (y > H + 40) continue;
        drawFlickNote(n, x, y);
      } else {
        if (y > H + 40) continue;
        drawTapNote(n, x, y);
      }
    }
  }

  function drawIdle(realNow) {
    if (!song) return;
    for (var i = 0; i < 16; i++) {
      var lane = i % 4;
      var y = ((realNow / 900 + i * 47) % (H + 90)) - 45;
      ctx.fillStyle = rgba(song.colors[lane], 0.10 + (i % 3) * 0.03);
      GK.roundRect(ctx, laneX(lane) - 30, y - 9, 60, 18, 7);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(song.bpm + ' BPM', W / 2, HIT_Y - 130);
    ctx.textAlign = 'left';
  }

  function drawFx(dt) {
    var f = dt / 1000;
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= f * 1.5;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += 150 * f;
      p.x += p.vx * f;
      p.y += p.vy * f;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (var j = shockwaves.length - 1; j >= 0; j--) {
      var w = shockwaves[j];
      w.life -= f * 2.4;
      if (w.life <= 0) { shockwaves.splice(j, 1); continue; }
      w.r += (w.max - w.r) * f * 6.5;
      ctx.strokeStyle = rgba(w.color, w.life * 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (var k = floats.length - 1; k >= 0; k--) {
      var t = floats[k];
      t.life -= f * 1.1;
      if (t.life <= 0) { floats.splice(k, 1); continue; }
      t.y -= 34 * f;
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 1.6));
      ctx.fillStyle = t.color;
      ctx.font = '600 ' + t.size + 'px "Press Start 2P", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawCombo(dt) {
    if (!combo || state !== 'playing') { comboSeen = 0; return; }
    if (combo !== comboSeen) { comboSeen = combo; comboPop = 1; }
    comboPop = Math.max(0, comboPop - dt / 220);
    var scale = 1 + comboPop * 0.38;
    ctx.save();
    ctx.translate(W / 2, HIT_Y - 190);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.shadowColor = (song && song.accent) || '#00f0ff';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px "Press Start 2P", monospace';
    ctx.fillText(String(combo), 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(T('gs.rhythm.hudCombo'), 0, 18);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  function drawProgress() {
    if (!chart) return;
    var p = Math.max(0, Math.min(1, songNow() / chart.endTime));
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, 0, W, 4);
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, song.accent);
    g.addColorStop(1, song.accent2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * p, 4);
  }

  function draw() {
    var realNow = Date.now();
    var dt = lastDrawAt ? Math.min(48, realNow - lastDrawAt) : 16;
    lastDrawAt = realNow;
    ctx.save();
    if (shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.9;
      if (shake < 0.3) shake = 0;
    }
    drawBackground(realNow);
    if (chart) drawNotes();
    else drawIdle(realNow);
    for (var i = 0; i < 4; i++) laneFlash[i] = Math.max(0, laneFlash[i] - dt / 300);
    drawFx(dt);
    drawCombo(dt);
    drawProgress();
    ctx.restore();
  }

  /* ---------------- 输入：画布 / 4 轨触控 / 键盘 D F J K ---------------- */
  var pointerLane = {};

  function laneFromX(x) {
    return Math.max(0, Math.min(3, Math.floor(x / (W / 4))));
  }
  function laneFromCode(code) {
    for (var i = 0; i < 4; i++) if (KEY_CODES[i].indexOf(code) >= 0) return i;
    return -1;
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (state !== 'playing' || paused) return;
    e.preventDefault();
    var p = GK.pointer(canvas, e);
    var lane = laneFromX(p.x);
    var src = 'p' + e.pointerId;
    pointerLane[src] = lane;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    pressLane(lane, src, p.x, p.y, false);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (state !== 'playing' || paused) return;
    var p = GK.pointer(canvas, e);
    pointerMove('p' + e.pointerId, p.x, p.y);
  });
  function canvasUp(e) {
    var src = 'p' + e.pointerId;
    var lane = pointerLane[src];
    if (lane != null) releaseLane(lane, src);
    delete pointerLane[src];
    delete activePointers[src];
  }
  canvas.addEventListener('pointerup', canvasUp);
  canvas.addEventListener('pointercancel', canvasUp);

  Array.prototype.forEach.call(lanesEl.querySelectorAll('.rh-lane-pad'), function (btn, lane) {
    btn.addEventListener('pointerdown', function (e) {
      if (state !== 'playing' || paused) return;
      e.preventDefault();
      btn.classList.add('held');
      try { btn.setPointerCapture(e.pointerId); } catch (err) { }
      pressLane(lane, 'pad' + e.pointerId, laneX(lane), HIT_Y, true);
    });
    function padUp(e) {
      btn.classList.remove('held');
      releaseLane(lane, 'pad' + e.pointerId);
    }
    btn.addEventListener('pointerup', padUp);
    btn.addEventListener('pointercancel', padUp);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });

  window.addEventListener('keydown', function (e) {
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.code === 'Space' || e.code === 'KeyP') {
      if (screen === 'menu' || screen === 'result') return;
      e.preventDefault();
      togglePause();
      return;
    }
    if (state !== 'playing' || paused) return;
    var lane = laneFromCode(e.code);
    if (lane < 0 || e.repeat) return;
    e.preventDefault();
    pressLane(lane, 'k' + lane, laneX(lane), HIT_Y, true);
  });
  window.addEventListener('keyup', function (e) {
    var lane = laneFromCode(e.code);
    if (lane < 0) return;
    releaseLane(lane, 'k' + lane);
  });

  /* ---------------- 菜单 / 校准 / 按钮 ---------------- */
  startBtn.addEventListener('click', function () { startGame(); });
  againBtn.addEventListener('click', function () { startGame(); });
  changeBtn.addEventListener('click', function () { backToMenu(); });
  resumeBtn.addEventListener('click', function () { resumeGame(); });
  pauseRestartBtn.addEventListener('click', function () { startGame(); });
  quitBtn.addEventListener('click', function () { backToMenu(); });
  pauseBtn.addEventListener('click', function () { togglePause(); });
  restartBtn.addEventListener('click', function () {
    if (state !== 'playing' || screen === 'result') return;
    startGame();
  });
  syncBottomControls();

  songsEl.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-song]') : null;
    if (!b) return;
    songIndex = Number(b.getAttribute('data-song')) || 0;
    song = SONGS[songIndex];
    refreshMenu();
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  diffsEl.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-diff]') : null;
    if (!b) return;
    diffIndex = Number(b.getAttribute('data-diff')) || 0;
    refreshMenu();
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  calibSlider.addEventListener('input', function () { setCalib(this.value); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-cal]'), function (b) {
    b.addEventListener('click', function () {
      setCalib(calib + Number(b.getAttribute('data-cal')));
      if (Arcade.audio) Arcade.audio.play('ui');
    });
  });
  document.getElementById('rh-calib-test').addEventListener('click', previewCalibration);

  /* ---------------- 启动 ---------------- */
  function finishInit() {
    if (Arcade.loop) Arcade.loop.start(update, draw, 16);
    else {
      (function frame() {
        update();
        draw();
        setTimeout(frame, 16);
      })();
    }
    window.GAME_RESTART = function () {
      if (state === 'playing' || state === 'over' || screen === 'pause' || screen === 'resume') {
        startGame();
      }
    };
  }

  function init() {
    song = SONGS[songIndex];
    refreshMenu();
    updateHud();
    if (Arcade.savegame) {
      Arcade.savegame.setup({ id: 'rhythm', collect: collectSave, apply: applySave });
      if (Arcade.savegame.resume()) {
        finishInit();
        return;
      }
    }
    hideAllScreens();
    menuScreen.classList.remove('hidden');
    screen = 'menu';
    finishInit();
  }

  /* ---------------- QA（仅 ?qa=1 URL 暴露） ---------------- */
  if (QA) {
    window.__QA = {
      state: function () {
        return {
          state: state, screen: screen, paused: paused,
          song: song.id, diff: DIFFS[diffIndex].key,
          score: Math.floor(score), combo: combo, maxCombo: maxCombo,
          perfect: perfect, great: great, good: good, miss: miss,
          elapsed: Math.floor(songNow()), total: chart ? chart.total : 0,
          judged: chart ? chart.notes.filter(function (n) { return n.judged; }).length : 0,
          calib: calib
        };
      },
      start: function (sid, dkey) {
        if (sid != null) {
          for (var i = 0; i < SONGS.length; i++) if (SONGS[i].id === sid) songIndex = i;
        }
        if (dkey != null) {
          for (var j = 0; j < DIFFS.length; j++) if (DIFFS[j].key === dkey) diffIndex = j;
        }
        startGame();
        return window.__QA.state();
      },
      seek: function (ms) {
        if (!chart || state !== 'playing') return false;
        var target = Math.max(0, Math.min(chart.endTime - 60, Number(ms) || 0));
        paused = false; pausedTotal = 0; pausedAtSong = 0;
        startTs = Date.now() - target;
        return true;
      },
      noteList: function () {
        if (!chart) return [];
        return chart.notes.map(function (n) {
          return {
            time: Math.round(n.time), lane: n.lane, type: n.type,
            dir: n.dir || null, dur: Math.round(n.dur || 0),
            judged: !!n.judged, res: n.res || null
          };
        });
      },
      hit: function (index) {
        if (!chart) return false;
        var n = chart.notes[index];
        if (!n || n.judged) return false;
        if (n.type === 'hold') {
          startHold(n, 'qa', n.time);
          completeHold(n);
        } else {
          hitNote(n, n.time, { requireDir: false });
        }
        return true;
      },
      finish: function () {
        if (state !== 'playing' || !chart) return false;
        finishGame();
        return true;
      }
    };
  }

  init();
})();
