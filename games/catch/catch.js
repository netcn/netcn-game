/* ============================================================
   接物大作战 · 旗舰版
   移动篮子接住下落好物、躲开炸弹；限时内达到目标分即胜，生命/时间耗尽则败。
   难度递进（速度/生成频率/炸弹比例/目标分）+ 连击加成 + 暂停遮罩 + 结算面板。
   新增：磁铁/冻结/双倍增益、Boss 波、每局随机任务、本地前 5 排行榜。
   视觉：渐变篮子（条纹纹理/高光/发光边）、Canvas 径向渐变道具、背景光点、
        接住粒子与飘分、炸弹闪红屏震、Boss 血条/横幅/镜头震动。
   输入：键盘 / 拖动 / 左右大按钮。
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var W = 400, H = 520, STEP = 16;
  var BASKET_Y = H - 66;
  var BASKET_W = 84;
  var BEST_KEY = (window.Arcade && Arcade.shell && Arcade.shell.gameId) || 'catch';
  var LB_KEY = 'arcade_lb_catch';
  var LB_STORE = 10;
  var LB_SHOW = 5;
  var BOSS_MS = 15000;
  var BOSS_EVERY = 3;

  /* 难度：生成间隔 / 下落速度 / 炸弹比例 / 目标分 / 时限 */
  var DIFFS = [
    { spawnMs: 1000, speed: 2.0, bomb: 0.08, target: 200, time: 90 },
    { spawnMs: 780, speed: 2.5, bomb: 0.14, target: 350, time: 85 },
    { spawnMs: 620, speed: 3.0, bomb: 0.20, target: 520, time: 75 }
  ];
  var DIFF_INFO = [
    { t: 'gs.catch.dEasy', d: 'gs.catch.dEasyD' },
    { t: 'gs.catch.dNormal', d: 'gs.catch.dNormalD' },
    { t: 'gs.catch.dHard', d: 'gs.catch.dHardD' }
  ];

  /* 道具：分值 / 半径 / 配色 / 音效（增益类额外带 buff 与持续时间） */
  var TYPES = {
    coin: { id: 'coin', score: 10, r: 15, color: '#ffd54a', deep: '#8a5a00',
      glow: 'rgba(255,213,74,0.30)', sound: 'coin' },
    gem: { id: 'gem', score: 30, r: 16, color: '#5ef2ff', deep: '#075f9e',
      glow: 'rgba(0,240,255,0.30)', sound: 'merge' },
    clock: { id: 'clock', score: 20, r: 16, color: '#c79bff', deep: '#5b21a8',
      glow: 'rgba(185,103,255,0.30)', sound: 'match', time: 2 },
    bomb: { id: 'bomb', score: 0, r: 17, color: '#ff5c7a', deep: '#31040e',
      glow: 'rgba(255,45,149,0.30)', sound: 'lose' },
    magnet: { id: 'magnet', score: 15, r: 16, color: '#ff9500', deep: '#6b2a00',
      glow: 'rgba(255,149,0,0.30)', sound: 'match', buff: 'magnet', dur: 5000 },
    freeze: { id: 'freeze', score: 15, r: 16, color: '#7fb2ff', deep: '#1c3b8a',
      glow: 'rgba(127,178,255,0.30)', sound: 'merge', buff: 'freeze', dur: 4000 },
    double: { id: 'double', score: 15, r: 16, color: '#39ff14', deep: '#0d5c00',
      glow: 'rgba(57,255,20,0.30)', sound: 'clear', buff: 'double', dur: 8000 }
  };
  var POWERUPS = [TYPES.magnet, TYPES.freeze, TYPES.double];

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.catch.tut1t'), d: T('gs.catch.tut1') },
    { t: T('gs.catch.tut2t'), d: T('gs.catch.tut2') },
    { t: T('gs.catch.tut3t'), d: T('gs.catch.tut3') },
    { t: T('gs.catch.tut4t'), d: T('gs.catch.tut4') }
  ];

  var hudItem = function (labelKey, id, cls) {
    return '<div class="ct-item"><span class="ct-lab">' + T(labelKey) + '</span>' +
      '<span class="ct-val' + (cls ? ' ' + cls : '') + '" id="' + id + '">0</span></div>';
  };

  root.innerHTML =
    '<div class="catch-wrap">' +
    '  <div class="ct-hud">' +
    hudItem('gs.catch.hudScore', 'ct-score', 'gold') +
    hudItem('gs.catch.hudBest', 'ct-best', 'gold') +
    hudItem('gs.catch.hudLives', 'ct-lives') +
    hudItem('gs.catch.hudCombo', 'ct-combo') +
    hudItem('gs.catch.hudTime', 'ct-time') +
    '  </div>' +
    '  <div class="ct-meta"><span id="ct-target"></span><span id="ct-level"></span></div>' +
    '  <div class="ct-buffs" id="ct-buffs"></div>' +
    '  <div class="ct-miss" id="ct-miss"></div>' +
    '  <div class="ct-stage" id="ct-stage">' +
    '    <canvas id="ct-cv"></canvas>' +
    '    <button type="button" class="ct-pause" id="ct-pause-btn" aria-label="' + T('gs.catch.pauseBtn') + '"><span class="ct-pause-ic" aria-hidden="true"></span></button>' +
    '    <div class="ct-ov" id="ct-pick">' +
    '      <div class="ct-card">' +
    '        <h2>' + T('gs.catch.pickTitle') + '</h2>' +
    '        <p>' + T('gs.catch.pickSub') + '</p>' +
    '        <div class="ct-diffs">' +
    DIFF_INFO.map(function (x, i) {
      return '<button type="button" class="ct-diff" data-i="' + i + '">' + T(x.t) +
        '<small>' + T(x.d) + '</small></button>';
    }).join('') +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="ct-ov" id="ct-pause" hidden>' +
    '      <div class="ct-card">' +
    '        <h2>' + T('gs.catch.pauseTitle') + '</h2>' +
    '        <p>' + T('gs.catch.pauseHint') + '</p>' +
    '        <div class="ct-btns">' +
    '          <button type="button" class="btn green" id="ct-resume">' + T('gs.catch.resume') + '</button>' +
    '          <button type="button" class="btn" id="ct-pause-restart">' + T('gs.catch.btnRestart') + '</button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="ct-ov" id="ct-result" hidden>' +
    '      <div class="ct-card">' +
    '        <h2 id="ct-result-title"></h2>' +
    '        <p id="ct-result-sub"></p>' +
    '        <div class="ct-stats">' +
    '          <div class="ct-stat">' + T('gs.catch.hudScore') + '<b id="ct-final">0</b></div>' +
    '          <div class="ct-stat">' + T('gs.catch.ovCaught') + '<b id="ct-caught">0</b></div>' +
    '          <div class="ct-stat">' + T('gs.catch.ovBest') + '<b id="ct-best2">0</b></div>' +
    '          <div class="ct-stat">' + T('gs.catch.ovCombo') + '<b id="ct-maxcombo">0</b></div>' +
    '        </div>' +
    '        <div class="ct-miss-res" id="ct-miss-res"></div>' +
    '        <div class="ct-record" id="ct-record"></div>' +
    '        <div class="ct-lb" id="ct-lb"></div>' +
    '        <div class="ct-btns">' +
    '          <button type="button" class="btn green" id="ct-again">' + T('gs.catch.btnRestart') + '</button>' +
    '          <button type="button" class="btn purple" id="ct-change">' + T('gs.catch.changeDiff') + '</button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="ct-touch">' +
    '    <button type="button" class="btn ct-move" id="ct-left" aria-label="' + T('gs.catch.ariaLeft') + '"></button>' +
    '    <button type="button" class="btn ct-move" id="ct-right" aria-label="' + T('gs.catch.ariaRight') + '"></button>' +
    '  </div>' +
    '  <div class="ct-hint">' + T('gs.catch.helpMove') + '</div>' +
    '</div>';

  var stageEl = document.getElementById('ct-stage');
  var cv = document.getElementById('ct-cv');
  var ctx;
  var gkInfo = null;
  if (window.GK && GK.setup) {
    gkInfo = GK.setup(cv, W, H);
    ctx = gkInfo.ctx;
  } else {
    cv.width = W; cv.height = H;
    ctx = cv.getContext('2d');
  }
  cv.style.width = '100%';
  cv.style.height = 'auto';
  cv.style.maxWidth = W + 'px';

  var scoreEl = document.getElementById('ct-score');
  var bestEl = document.getElementById('ct-best');
  var livesEl = document.getElementById('ct-lives');
  var comboEl = document.getElementById('ct-combo');
  var timeEl = document.getElementById('ct-time');
  var targetEl = document.getElementById('ct-target');
  var levelEl = document.getElementById('ct-level');
  var buffsEl = document.getElementById('ct-buffs');
  var missEl = document.getElementById('ct-miss');
  var pickOv = document.getElementById('ct-pick');
  var pauseOv = document.getElementById('ct-pause');
  var resultOv = document.getElementById('ct-result');
  var pauseBtn = document.getElementById('ct-pause-btn');
  var resultTitle = document.getElementById('ct-result-title');
  var resultSub = document.getElementById('ct-result-sub');
  var finalEl = document.getElementById('ct-final');
  var caughtEl = document.getElementById('ct-caught');
  var best2El = document.getElementById('ct-best2');
  var maxComboEl = document.getElementById('ct-maxcombo');
  var missResEl = document.getElementById('ct-miss-res');
  var recordEl = document.getElementById('ct-record');
  var lbEl = document.getElementById('ct-lb');
  var resumeBtn = document.getElementById('ct-resume');
  var pauseRestartBtn = document.getElementById('ct-pause-restart');
  var againBtn = document.getElementById('ct-again');
  var changeBtn = document.getElementById('ct-change');
  var leftBtn = document.getElementById('ct-left');
  var rightBtn = document.getElementById('ct-right');

  /* helpText */
  var helpEl = document.createElement('div');
  helpEl.className = 'ct-help';
  helpEl.innerHTML = T('gs.catch.helpText');
  root.querySelector('.catch-wrap').appendChild(helpEl);

  var run = null;
  var phase = 'pick'; // pick | play | pause | over
  var loopApi = null;
  var bestCache = readBest();
  var keys = { left: false, right: false, shift: false };
  var dragging = false;

  /* 背景漂浮光点（全局，不随重开重建） */
  var dots = [];
  for (var di = 0; di < 30; di++) {
    dots.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.8 + Math.random() * 2.2, sp: 0.15 + Math.random() * 0.5,
      ph: Math.random() * Math.PI * 2,
      col: di % 5 === 0 ? 'rgba(255,45,149,' : (di % 3 === 0 ? 'rgba(255,230,0,' : 'rgba(0,240,255,')
    });
  }

  function readBest() {
    try {
      if (window.Arcade && Arcade.storage) {
        var b = Arcade.storage.getBest(BEST_KEY);
        return b === null ? 0 : b;
      }
    } catch (e) {}
    return 0;
  }
  function audio(name) { if (window.Arcade && Arcade.audio) Arcade.audio.play(name); }
  function pointerPos(e) {
    if (window.GK && GK.pointer) return GK.pointer(cv, e);
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function burstAt(x, y, color, count) {
    if (window.GK && GK.burst) GK.burst(cv, x, y, color, count);
  }
  function clampBasket(x) {
    var half = BASKET_W / 2 + 3;
    return Math.max(half, Math.min(W - half, x));
  }
  function comboMult(combo) {
    var m = 1 + Math.floor(combo / 5) * 0.5;
    return m > 4 ? 4 : m;
  }
  function hearts(n) {
    if (!n) return '—';
    var s = '';
    for (var i = 0; i < n; i++) s += '<span class="ct-life" aria-hidden="true"></span>';
    return s;
  }

  /* ---------- 本地排行榜（独立键，不改动 arcade_best_catch） ---------- */
  function sortLb(a, b) {
    return b.score - a.score || a.ts - b.ts;
  }
  function readLb() {
    var arr = [];
    try {
      var raw = localStorage.getItem(LB_KEY);
      if (raw) arr = JSON.parse(raw) || [];
    } catch (e) { arr = []; }
    if (!arr || typeof arr.length !== 'number') arr = [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (!e || typeof e.score !== 'number' || !isFinite(e.score) || e.score <= 0) continue;
      if (typeof e.ts !== 'number') continue;
      out.push({ score: e.score, ts: e.ts, diff: typeof e.diff === 'number' ? e.diff : 0 });
    }
    out.sort(sortLb);
    return out.slice(0, LB_STORE);
  }
  function saveLb(score, diff) {
    var entry = { score: score, ts: Date.now(), diff: diff };
    var arr = readLb();
    arr.push(entry);
    arr.sort(sortLb);
    arr = arr.slice(0, LB_STORE);
    try { localStorage.setItem(LB_KEY, JSON.stringify(arr)); } catch (e) {}
    return { list: arr, entry: entry };
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    if (!d || isNaN(d.getTime())) return '';
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function isSameLbEntry(a, b) {
    return !!a && !!b && a.ts === b.ts && a.score === b.score;
  }
  function renderLb(list, cur) {
    if (!lbEl) return;
    var rows = [];
    var shown = (list || []).slice(0, LB_SHOW);
    var curShown = false;
    for (var i = 0; i < shown.length; i++) {
      var e = shown[i];
      var isCur = isSameLbEntry(e, cur);
      if (isCur) curShown = true;
      rows.push('<div class="ct-lb-row' + (isCur ? ' cur' : '') + '">' +
        '<span class="rk">' + (i + 1) + '</span>' +
        '<span class="sc">' + e.score + '</span>' +
        '<span class="dt">' + fmtDate(e.ts) + (isCur ? ' · ' + T('gs.catch.lbYou') : '') + '</span>' +
        '</div>');
    }
    if (cur && !curShown) {
      rows.push('<div class="ct-lb-row cur">' +
        '<span class="rk">—</span>' +
        '<span class="sc">' + cur.score + '</span>' +
        '<span class="dt">' + fmtDate(cur.ts) + ' · ' + T('gs.catch.lbYou') + '</span>' +
        '</div>');
    }
    if (!rows.length) rows.push('<div class="ct-lb-empty">' + T('gs.catch.lbEmpty') + '</div>');
    lbEl.innerHTML = '<div class="ct-lb-title">' + T('gs.catch.lbTitle') + '</div>' + rows.join('');
  }

  /* ---------- 任务 ---------- */
  var MISSION_FACTORY = {
    gems: function () {
      var n = 6 + Math.floor(Math.random() * 3);
      return { id: 'gems', target: n, bonus: 80, text: T('gs.catch.missionGems').replace('{n}', n) };
    },
    combo: function () {
      var n = 8 + Math.floor(Math.random() * 5);
      return { id: 'combo', target: n, bonus: 80, text: T('gs.catch.missionCombo').replace('{n}', n) };
    },
    noBomb: function () {
      return { id: 'noBomb', target: 30, bonus: 100, text: T('gs.catch.missionNoBomb').replace('{n}', 30) };
    },
    magnet: function () {
      return { id: 'magnet', target: 2, bonus: 90, text: T('gs.catch.missionMagnet').replace('{n}', 2) };
    },
    freeze: function () {
      return { id: 'freeze', target: 2, bonus: 90, text: T('gs.catch.missionFreeze').replace('{n}', 2) };
    },
    double: function () {
      return { id: 'double', target: 2, bonus: 90, text: T('gs.catch.missionDouble').replace('{n}', 2) };
    },
    catch: function () {
      var n = 28 + Math.floor(Math.random() * 7);
      return { id: 'catch', target: n, bonus: 70, text: T('gs.catch.missionCatch').replace('{n}', n) };
    }
  };
  function isBuffMission(id) {
    return id === 'magnet' || id === 'freeze' || id === 'double';
  }
  function buildMissions() {
    var ids = ['gems', 'combo', 'noBomb', 'magnet', 'freeze', 'double', 'catch'];
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    var picked = ids.slice(0, 3);
    var buffCount = 0;
    for (var k = 0; k < picked.length; k++) if (isBuffMission(picked[k])) buffCount++;
    if (buffCount >= 3) picked[2] = 'catch';
    var out = [];
    for (var m = 0; m < picked.length; m++) {
      var def = MISSION_FACTORY[picked[m]]();
      def.progress = 0;
      def.done = false;
      def.failed = false;
      out.push(def);
    }
    return out;
  }
  function missionById(st, id) {
    if (!st) return null;
    for (var i = 0; i < st.missions.length; i++) {
      if (st.missions[i].id === id) return st.missions[i];
    }
    return null;
  }
  function missionProgressText(m) {
    if (m.id === 'noBomb') {
      var pv = Math.min(m.target, Math.floor(m.progress));
      return T('gs.catch.secFmt').replace('{n}', pv) + ' / ' + T('gs.catch.secFmt').replace('{n}', m.target);
    }
    return Math.min(m.target, Math.floor(m.progress)) + '/' + m.target;
  }
  function completeMission(st, m) {
    if (!m || m.done || m.failed) return;
    m.done = true;
    m.progress = m.target;
    st.score += m.bonus;
    addFloat(W / 2, 124, T('gs.catch.missionDone').replace('{n}', m.bonus), '#39ff14', 15, 950);
    addParticles(W / 2, 124, '#39ff14', 16, 2.6);
    addRing(W / 2, 124, '#39ff14', 60);
    audio('clear');
    renderMissions(st);
    updateHud();
  }
  function missionAdd(st, id, add) {
    var m = missionById(st, id);
    if (!m || m.done || m.failed) return;
    if (add === 0) return;
    m.progress += add;
    if (m.progress >= m.target) completeMission(st, m);
  }
  function missionSet(st, id, val) {
    var m = missionById(st, id);
    if (!m || m.done || m.failed) return;
    if (val <= m.progress) { m.progress = val; return; }
    m.progress = val;
    if (m.progress >= m.target) completeMission(st, m);
  }
  function failNoBombMission(st) {
    var m = missionById(st, 'noBomb');
    if (!m || m.done || m.failed) return;
    m.failed = true;
    addFloat(W / 2, 124, T('gs.catch.missionFail'), '#ff5c7a', 13, 900);
    renderMissions(st);
  }
  function renderMissions(st) {
    if (!missEl) return;
    if (!st) { missEl.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < st.missions.length; i++) {
      var m = st.missions[i];
      var cls = m.done ? ' done' : (m.failed ? ' fail' : '');
      var ico = m.done ? '✓' : (m.failed ? '✕' : '○');
      var prog = m.done ? '' : '<span class="ct-miss-prog">' + missionProgressText(m) + '</span>';
      html += '<div class="ct-miss-row' + cls + '"><span class="ico">' + ico + '</span>' +
        '<span>' + m.text + '</span>' + prog + '</div>';
    }
    missEl.innerHTML = html;
  }

  function missionBuffWeight(st, buffId) {
    for (var i = 0; i < st.missions.length; i++) {
      var m = st.missions[i];
      if (!m.done && !m.failed && m.id === buffId) return 2.4;
    }
    return 1;
  }
  function pickPowerup(st) {
    var weights = [], total = 0, i;
    for (i = 0; i < POWERUPS.length; i++) {
      weights[i] = missionBuffWeight(st, POWERUPS[i].buff);
      total += weights[i];
    }
    var r = Math.random() * total;
    for (i = 0; i < POWERUPS.length; i++) {
      r -= weights[i];
      if (r <= 0) return POWERUPS[i];
    }
    return POWERUPS[POWERUPS.length - 1];
  }
  function pickGood(st) {
    var r = Math.random() * 100;
    if (r < 40) return TYPES.coin;
    if (r < 64) return TYPES.gem;
    if (r < 78) return TYPES.clock;
    return pickPowerup(st);
  }

  /* ---------- HUD / 局面 ---------- */
  function renderBuffs(st) {
    if (!buffsEl) return;
    if (!st) { buffsEl.innerHTML = ''; return; }
    var parts = [];
    var defs = [
      { k: 'magnet', t: 'gs.catch.buffMagnet', c: TYPES.magnet.color },
      { k: 'freeze', t: 'gs.catch.buffFreeze', c: TYPES.freeze.color },
      { k: 'double', t: 'gs.catch.buffDouble', c: TYPES.double.color }
    ];
    for (var i = 0; i < defs.length; i++) {
      var ms = st.eff[defs[i].k];
      if (ms > 0) {
        var sec = Math.ceil(ms / 1000);
        parts.push('<span class="ct-buff" style="--c:' + defs[i].c + '"><i></i>' +
          T(defs[i].t) + ' ' + T('gs.catch.secShort').replace('{n}', sec) + '</span>');
      }
    }
    buffsEl.innerHTML = parts.join('');
  }

  function updateHud() {
    var st = run;
    scoreEl.textContent = st ? String(st.score) : '0';
    bestEl.textContent = String(bestCache);
    livesEl.innerHTML = st ? hearts(st.lives) : hearts(3);
    livesEl.setAttribute('aria-label', T('gs.catch.hudLives') + ' ' + (st ? st.lives : 3));
    comboEl.textContent = st && st.combo > 0 ? 'x' + st.combo : '—';
    timeEl.textContent = GK.fmtTime(st ? st.timeLeft : DIFFS[1].time * 1000);
    targetEl.textContent = T('gs.catch.target').replace('{n}', st ? st.conf.target : DIFFS[1].target);
    levelEl.textContent = T('gs.catch.lvFmt').replace('{n}', st ? st.level : 1);
    livesEl.classList.toggle('warn', !!st && st.lives <= 1);
    timeEl.classList.toggle('warn', !!st && st.timeLeft <= 10000);
    comboEl.classList.toggle('warn', !!st && st.combo >= 5);
    renderBuffs(st);
    renderMissions(st);
  }

  function resetRun(diffIdx) {
    var conf = DIFFS[diffIdx] || DIFFS[0];
    run = {
      diff: diffIdx, conf: conf,
      score: 0, caught: 0, lives: 3, combo: 0, maxCombo: 0,
      elapsed: 0, timeLeft: conf.time * 1000, level: 1, lastSec: conf.time,
      items: [], particles: [], floats: [], rings: [],
      spawnIn: 520, basketX: W / 2, targetX: W / 2, squash: 0,
      flashT: 0, flashMax: 1, flashColor: '#ff2d95',
      eff: { magnet: 0, freeze: 0, double: 0 },
      missions: buildMissions(), boss: null, lastBossLevel: 0,
      banner: null, camShake: 0,
      submitted: false, over: false, won: false
    };
    bestCache = readBest();
    phase = 'play';
    pickOv.hidden = true;
    pauseOv.hidden = true;
    resultOv.hidden = true;
    pauseBtn.hidden = false;
    stageEl.classList.remove('fx-shake');
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    updateHud();
  }

  function startRun(diffIdx) {
    resetRun(diffIdx);
    audio('ui');
  }

  function openPicker(quiet) {
    phase = 'pick';
    run = null;
    pickOv.hidden = false;
    pauseOv.hidden = true;
    resultOv.hidden = true;
    pauseBtn.hidden = true;
    stageEl.classList.remove('fx-shake');
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    updateHud();
    if (!quiet) audio('ui');
  }

  function pauseGame(silent) {
    if (phase !== 'play') return;
    phase = 'pause';
    pauseOv.hidden = false;
    pauseBtn.hidden = true;
    if (loopApi) loopApi.pause();
    if (!silent) audio('ui');
  }

  function resumeGame() {
    if (phase !== 'pause') return;
    phase = 'play';
    pauseOv.hidden = true;
    pauseBtn.hidden = false;
    if (loopApi) loopApi.resume();
    audio('ui');
  }

  function togglePause() {
    if (phase === 'play') pauseGame();
    else if (phase === 'pause') resumeGame();
  }

  function endGame(won, reason) {
    if (!run || phase === 'over') return;
    phase = 'over';
    run.over = true;
    run.won = won;
    run.boss = null;
    pauseBtn.hidden = true;
    if (loopApi) loopApi.pause();
    if (won) {
      if (window.Arcade && Arcade.juice) Arcade.juice.win();
    } else {
      if (window.Arcade && Arcade.juice) Arcade.juice.lose();
    }
    var isNew = false;
    if (!run.submitted) {
      run.submitted = true;
      if (run.score > 0 && window.Arcade && Arcade.shell && Arcade.shell.submitScore) {
        isNew = !!Arcade.shell.submitScore(run.score);
      }
    }
    bestCache = readBest();
    if (bestCache < run.score) bestCache = run.score;

    var lb = null;
    if (run.score > 0) lb = saveLb(run.score, run.diff);

    var doneCount = 0, total = run.missions.length;
    for (var mi = 0; mi < run.missions.length; mi++) if (run.missions[mi].done) doneCount++;

    resultTitle.textContent = won ? T('gs.catch.winTitle')
      : (reason === 'time' ? T('gs.catch.timeUpTitle') : T('gs.catch.livesOutTitle'));
    resultTitle.className = won ? 'win' : '';
    resultSub.textContent = T('gs.catch.target').replace('{n}', run.conf.target) + ' · ' +
      T('gs.catch.lvFmt').replace('{n}', run.level);
    finalEl.textContent = String(run.score);
    caughtEl.textContent = String(run.caught);
    best2El.textContent = String(bestCache);
    maxComboEl.textContent = String(run.maxCombo);
    missResEl.textContent = T('gs.catch.ovMissions') + ' ' + doneCount + '/' + total;
    recordEl.textContent = isNew ? T('gs.catch.newRecord') : '';
    renderLb(lb ? lb.list : readLb(), lb ? lb.entry : null);
    resultOv.hidden = false;
    updateHud();
  }

  /* ---------- 特效 ---------- */
  function addFloat(x, y, text, color, size, life) {
    if (!run) return;
    run.floats.push({ x: x, y: y, text: text, color: color, size: size || 14,
      life: life || 800, max: life || 800 });
  }
  function addParticles(x, y, color, count, power) {
    if (!run) return;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 0.8 + Math.random() * (power || 3.2);
      run.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.7,
        size: 1.4 + Math.random() * 2.4, color: color, life: 1, max: 1
      });
    }
  }
  function addRing(x, y, color, maxR) {
    if (!run) return;
    run.rings.push({ x: x, y: y, r: 8, max: maxR || 54, life: 1, color: color });
  }
  function screenFlash(ms, color, alpha) {
    if (!run) return;
    run.flashT = ms;
    run.flashMax = ms;
    run.flashColor = color;
    run.flashAlpha = alpha || 0.4;
  }

  /* ---------- 生成 / 接取 ---------- */
  function spawnItem(st) {
    var bombP = st.conf.bomb + (st.level - 1) * 0.03;
    if (bombP > 0.45) bombP = 0.45;
    var type = Math.random() < bombP ? TYPES.bomb : pickGood(st);
    var r = type.r;
    st.items.push({
      x: r + 8 + Math.random() * (W - (r + 8) * 2),
      y: -r - 6,
      vy: (st.conf.speed + (st.level - 1) * 0.22) * (0.9 + Math.random() * 0.3),
      r: r, type: type,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * (type.id === 'bomb' ? 0.04 : 0.09),
      ph: Math.random() * Math.PI * 2
    });
  }

  function activateBuff(st, type, x) {
    var dur = type.dur;
    if (st.eff[type.buff] < dur) st.eff[type.buff] = dur;
    var nameKey = 'gs.catch.buff' + type.buff.charAt(0).toUpperCase() + type.buff.slice(1);
    var label = T(nameKey) + ' ' + T('gs.catch.secShort').replace('{n}', Math.round(dur / 1000));
    addFloat(x, BASKET_Y - 52, label, type.color, 13, 950);
    addParticles(st.basketX, BASKET_Y - 4, type.color, 16, 3.0);
    addRing(st.basketX, BASKET_Y - 4, type.color, 66);
    audio('clear');
  }

  function catchItem(st, it) {
    st.squash = 1;
    var bx = st.basketX;
    if (it.type.id === 'bomb') {
      st.lives--;
      st.combo = 0;
      screenFlash(420, '#ff2d95', 0.5);
      addParticles(bx, BASKET_Y - 4, '#ff5c7a', 26, 3.6);
      addParticles(bx, BASKET_Y - 4, '#ffd54a', 12, 3.2);
      addRing(bx, BASKET_Y - 4, '#ff2d95', 74);
      addFloat(bx, BASKET_Y - 30, T('gs.catch.loseLife'), '#ff5c7a', 16, 900);
      st.camShake = Math.max(st.camShake, 6);
      failNoBombMission(st);
      audio('lose');
      if (window.Arcade && Arcade.fx) {
        Arcade.fx.shake(stageEl);
        Arcade.fx.flash('var(--neon-pink)');
      }
    } else {
      st.combo++;
      if (st.combo > st.maxCombo) st.maxCombo = st.combo;
      st.caught++;
      var mult = comboMult(st.combo);
      var doubleOn = st.eff.double > 0;
      var pts = Math.round(it.type.score * mult * (doubleOn ? 2 : 1));
      st.score += pts;
      addParticles(bx, BASKET_Y - 4, it.type.color, 14, 2.6);
      addRing(bx, BASKET_Y - 4, it.type.color, 34);
      addFloat(it.x, BASKET_Y - 26, '+' + pts + (doubleOn ? ' x2' : ''), it.type.color, 15, 850);
      burstAt(it.x, BASKET_Y - 6, it.type.color, 10);
      missionAdd(st, 'catch', 1);
      if (it.type.id === 'gem') missionAdd(st, 'gems', 1);
      if (it.type.buff) {
        activateBuff(st, it.type, it.x);
        missionAdd(st, it.type.buff, 1);
      }
      missionSet(st, 'combo', st.combo);
      if (it.type.id === 'clock') {
        var addMs = Math.min(st.conf.time * 1000, st.timeLeft + (it.type.time || 2) * 1000) - st.timeLeft;
        st.timeLeft += addMs;
        if (addMs > 0) {
          addFloat(it.x, BASKET_Y - 48, T('gs.catch.timePlus').replace('{n}', Math.round(addMs / 1000)),
            '#c79bff', 12, 850);
        }
      }
      if (st.boss) damageBoss(st, it);
      if (st.combo % 5 === 0) {
        addFloat(W / 2, 100, T('gs.catch.comboFmt').replace('{n}', st.combo), '#39ff14', 16, 950);
        audio('clear');
      } else {
        audio(it.type.sound);
      }
    }
    updateHud();
  }

  function missItem(st, it) {
    st.lives--;
    st.combo = 0;
    screenFlash(280, '#ff2d95', 0.26);
    addParticles(it.x, H - 24, '#ff5c7a', 10, 2.2);
    addFloat(it.x, H - 42, T('gs.catch.miss'), '#ff5c7a', 13, 800);
    st.camShake = Math.max(st.camShake, 3);
    audio('error');
    updateHud();
  }

  /* ---------- Boss 波 ---------- */
  function startBoss(st) {
    var maxHp = 80 + st.level * 4;
    st.boss = {
      x: W / 2, y: 84, r: 27, dir: Math.random() < 0.5 ? -1 : 1,
      hp: maxHp, maxHp: maxHp, timer: BOSS_MS,
      throwIn: 700, hits: 0
    };
    st.lastBossLevel = st.level;
    st.banner = { text: T('gs.catch.bossIncoming'), t: 1700, max: 1700, color: '#ff2d95' };
    st.camShake = Math.max(st.camShake, 8);
    addParticles(W / 2, 90, '#ff2d95', 26, 4);
    addRing(W / 2, 90, '#ff2d95', 90);
    screenFlash(260, '#ff2d95', 0.28);
    audio('merge');
    if (window.Arcade && Arcade.fx) Arcade.fx.shake(stageEl);
    updateHud();
  }

  function endBoss(st, defeated) {
    if (!st.boss) return;
    var bonus = Math.round(defeated ? (180 + st.level * 25) : (70 + st.level * 10));
    st.score += bonus;
    st.boss = null;
    st.banner = {
      text: defeated ? T('gs.catch.bossDefeat') : T('gs.catch.bossSurvive'),
      t: 1600, max: 1600, color: defeated ? '#39ff14' : '#ffe600'
    };
    addFloat(W / 2, 150, T('gs.catch.bossReward').replace('{n}', bonus), '#ffe600', 17, 1100);
    addParticles(W / 2, 110, defeated ? '#39ff14' : '#ffe600', 24, 3.6);
    addRing(W / 2, 110, defeated ? '#39ff14' : '#ffe600', 80);
    st.camShake = Math.max(st.camShake, defeated ? 7 : 5);
    audio(defeated ? 'win' : 'clear');
    if (window.Arcade && Arcade.fx) Arcade.fx.flash(defeated ? 'var(--neon-green)' : 'var(--neon-yellow)');
    updateHud();
  }

  function damageBoss(st, it) {
    if (!st.boss) return;
    var dmg = it.type.id === 'gem' ? 9
      : (it.type.id === 'clock' ? 7 : (it.type.buff ? 11 : 5));
    st.boss.hp -= dmg;
    st.boss.hits++;
    addFloat(it.x, BASKET_Y - 48, '-' + dmg, '#ff2d95', 12, 700);
    st.camShake = Math.max(st.camShake, 4);
    if (st.boss.hp <= 0) {
      st.boss.hp = 0;
      endBoss(st, true);
    }
  }

  function bossThrow(st) {
    var b = st.boss;
    if (!b) return;
    var isBomb = Math.random() < 0.5;
    var type = isBomb ? TYPES.bomb : pickGood(st);
    st.items.push({
      x: b.x, y: b.y + b.r * 0.4,
      vy: (st.conf.speed + (st.level - 1) * 0.2) * (0.95 + Math.random() * 0.25),
      r: type.r, type: type,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.08,
      ph: Math.random() * Math.PI * 2, fromBoss: true
    });
    addParticles(b.x, b.y + 14, isBomb ? '#ff5c7a' : type.color, 9, 2.6);
    b.throwIn = Math.max(420, 900 - st.level * 45) * (0.85 + Math.random() * 0.3);
  }

  function updateBoss(st, dt) {
    var b = st.boss;
    if (!b) return;
    b.timer -= dt;
    b.x += b.dir * (1.5 + st.level * 0.15);
    var margin = b.r + 14;
    if (b.x < margin) { b.x = margin; b.dir = 1; }
    if (b.x > W - margin) { b.x = W - margin; b.dir = -1; }
    b.throwIn -= dt;
    if (b.throwIn <= 0) bossThrow(st);
    if (b.timer <= 0) endBoss(st, false);
  }

  /* ---------- 每帧逻辑 ---------- */
  function update() {
    if (!run || phase !== 'play') return;
    var st = run, dt = STEP;

    st.elapsed += dt;
    st.timeLeft -= dt;

    var lv = 1 + Math.floor(st.elapsed / 20000);
    if (lv !== st.level) {
      st.level = lv;
      addFloat(W / 2, 92, T('gs.catch.levelUp'), '#b967ff', 14, 900);
      audio('ui');
      updateHud();
    }
    if (st.level % BOSS_EVERY === 0 && st.level !== st.lastBossLevel && !st.boss) {
      startBoss(st);
    }

    var buffEnded = false;
    if (st.eff.magnet > 0) { st.eff.magnet -= dt; if (st.eff.magnet <= 0) { st.eff.magnet = 0; buffEnded = true; } }
    if (st.eff.freeze > 0) { st.eff.freeze -= dt; if (st.eff.freeze <= 0) { st.eff.freeze = 0; buffEnded = true; } }
    if (st.eff.double > 0) { st.eff.double -= dt; if (st.eff.double <= 0) { st.eff.double = 0; buffEnded = true; } }
    if (buffEnded) updateHud();

    if (st.banner) {
      st.banner.t -= dt;
      if (st.banner.t <= 0) st.banner = null;
    }
    if (st.camShake > 0) st.camShake = Math.max(0, st.camShake - dt * 0.012);

    missionSet(st, 'noBomb', Math.min(30, Math.floor(st.elapsed / 1000)));

    var v = 6.2 * (keys.shift ? 1.55 : 1);
    var goLeft = keys.left || hold.left;
    var goRight = keys.right || hold.right;
    if (goLeft && !goRight) st.targetX -= v;
    else if (goRight && !goLeft) st.targetX += v;
    st.targetX = clampBasket(st.targetX);
    st.basketX += (st.targetX - st.basketX) * 0.3;
    st.basketX = clampBasket(st.basketX);

    if (st.squash > 0) st.squash = Math.max(0, st.squash - 0.075);
    if (st.flashT > 0) st.flashT = Math.max(0, st.flashT - dt);

    if (st.boss) {
      updateBoss(st, dt);
      st.camShake = Math.max(st.camShake, 1.1);
    }

    st.spawnIn -= dt;
    if (st.spawnIn <= 0) {
      spawnItem(st);
      var base = Math.max(st.conf.spawnMs * 0.52, st.conf.spawnMs - (st.level - 1) * 55);
      if (st.boss) base *= 1.65;
      st.spawnIn = base * (0.85 + Math.random() * 0.35);
    }

    var frozen = st.eff.freeze > 0;
    var magnetOn = st.eff.magnet > 0;

    for (var i = st.items.length - 1; i >= 0; i--) {
      var it = st.items[i];
      it.y += it.vy * (frozen ? 0.2 : 1);
      if (frozen) it.y += Math.sin(st.elapsed / 260 + it.ph) * 0.16;
      it.x += Math.sin(st.elapsed / 420 + it.ph) * 0.35;
      it.rot += it.spin;
      if (magnetOn && it.type.id !== 'bomb') {
        var dx = st.basketX - it.x;
        var dy = (BASKET_Y - 8) - it.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          it.x += dx * 0.16;
          if (dy > 0) it.y += Math.min(5.5, dy * 0.12);
        }
      }
      var aligned = Math.abs(it.x - st.basketX) <= BASKET_W / 2 + it.r * 0.55;
      if (aligned && it.y >= BASKET_Y - 14 && it.y <= BASKET_Y + 18) {
        st.items.splice(i, 1);
        catchItem(st, it);
        if (st.lives <= 0) break;
        continue;
      }
      if (it.y - it.r > H) {
        st.items.splice(i, 1);
        if (it.type.id !== 'bomb') missItem(st, it);
        if (st.lives <= 0) break;
      }
    }

    for (var j = st.particles.length - 1; j >= 0; j--) {
      var p = st.particles[j];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= dt / 560;
      if (p.life <= 0) st.particles.splice(j, 1);
    }
    for (var k = st.rings.length - 1; k >= 0; k--) {
      var rg = st.rings[k];
      rg.r += 2.4;
      rg.life -= dt / 620;
      if (rg.life <= 0) st.rings.splice(k, 1);
    }
    for (var m = st.floats.length - 1; m >= 0; m--) {
      var fl = st.floats[m];
      fl.y -= 0.8;
      fl.life -= dt;
      if (fl.life <= 0) st.floats.splice(m, 1);
    }

    var sec = Math.ceil(st.timeLeft / 1000);
    if (sec !== st.lastSec) {
      st.lastSec = sec;
      updateHud();
    }

    if (st.lives <= 0) { endGame(false, 'lives'); return; }
    if (st.timeLeft <= 0) { st.timeLeft = 0; endGame(false, 'time'); return; }
    if (st.score >= st.conf.target) { endGame(true, 'target'); return; }
  }

  /* ---------- 绘制 ---------- */
  function drawBackground() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1024');
    bg.addColorStop(0.55, '#0b0d1a');
    bg.addColorStop(1, '#160a20');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var t = Date.now() / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g1 = ctx.createRadialGradient(60, 80, 4, 60, 80, 150);
    g1.addColorStop(0, 'rgba(0,240,255,0.10)');
    g1.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    var g2 = ctx.createRadialGradient(W - 30, H * 0.4, 4, W - 30, H * 0.4, 170);
    g2.addColorStop(0, 'rgba(185,103,255,0.12)');
    g2.addColorStop(1, 'rgba(185,103,255,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var yy = (d.y + t * d.sp * 16) % (H + 24) - 12;
      var xx = d.x + Math.sin(t * 0.7 + d.ph) * 9;
      var a = 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(t + d.ph));
      ctx.fillStyle = d.col + a + ')';
      ctx.beginPath();
      ctx.arc(xx, yy, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* 底部接物区光带 */
    var fg = ctx.createLinearGradient(0, H - 90, 0, H);
    fg.addColorStop(0, 'rgba(0,240,255,0)');
    fg.addColorStop(1, 'rgba(0,240,255,0.06)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, H - 90, W, 90);
  }

  function drawProgress(st) {
    if (!st) return;
    var p = Math.min(1, st.score / st.conf.target);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, 0, W, 3);
    var pg = ctx.createLinearGradient(0, 0, W, 0);
    pg.addColorStop(0, '#00f0ff');
    pg.addColorStop(0.6, '#39ff14');
    pg.addColorStop(1, '#ffe600');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, W * p, 3);
  }

  function drawBuffField(st) {
    if (!st) return;
    var t = Date.now() / 1000;
    if (st.eff.magnet > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,149,0,' + (0.16 + 0.14 * (0.5 + 0.5 * Math.sin(t * 4))) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(st.basketX, BASKET_Y - 6, 70 + Math.sin(t * 3) * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,149,0,0.10)';
      ctx.beginPath();
      ctx.arc(st.basketX, BASKET_Y - 6, 96 + Math.sin(t * 2 + 1) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (st.eff.freeze > 0) {
      ctx.save();
      var ig = ctx.createLinearGradient(0, 0, 0, H);
      ig.addColorStop(0, 'rgba(127,178,255,0.13)');
      ig.addColorStop(0.5, 'rgba(127,178,255,0.04)');
      ig.addColorStop(1, 'rgba(127,178,255,0.12)');
      ctx.fillStyle = ig;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (st.eff.double > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(57,255,20,' + (0.16 + 0.12 * (0.5 + 0.5 * Math.sin(t * 5))) + ')';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      ctx.restore();
    }
  }

  function drawCombo(st) {
    if (!st || st.combo < 2) return;
    var mul = comboMult(st.combo);
    var label = T('gs.catch.comboFmt').replace('{n}', st.combo) + (mul > 1 ? '  x' + mul.toFixed(1) : '');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 12px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(160,255,180,0.95)';
    ctx.fillText(label, W / 2, 26);
    ctx.restore();
  }

  /* 金币：径向渐变 + 内环 + 币面符号 + 高光 */
  function drawCoin(r, t) {
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    g.addColorStop(0, '#fff9c4');
    g.addColorStop(0.45, '#ffd54a');
    g.addColorStop(1, t.deep);
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 13;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,248,190,0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,74,0,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#6a4300';
    ctx.font = "bold " + Math.round(r * 1.05) + "px 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¥', 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.42, -r * 0.48, r * 0.24, r * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 宝石：棱面多边形 + 渐变 + 刻面线 + 星芒 */
  function drawGem(r, t) {
    var g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, t.color);
    g.addColorStop(1, t.deep);
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.12);
    ctx.lineTo(r * 0.95, -r * 0.18);
    ctx.lineTo(0, r * 1.08);
    ctx.lineTo(-r * 0.95, -r * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(235,255,255,0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.12); ctx.lineTo(0, r * 1.08);
    ctx.moveTo(-r * 0.95, -r * 0.18); ctx.lineTo(r * 0.95, -r * 0.18);
    ctx.moveTo(-r * 0.48, -r * 0.62); ctx.lineTo(0, -r * 0.18); ctx.lineTo(r * 0.48, -r * 0.62);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.5, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 时钟：表盘 + 刻度 + 指针 + 渐变光晕 */
  function drawClock(r, t) {
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r);
    g.addColorStop(0, '#f4e8ff');
    g.addColorStop(0.5, t.color);
    g.addColorStop(1, t.deep);
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(240,225,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.1;
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      var r1 = r * 0.78, r2 = r * 0.9;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2d1250';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r * 0.56);
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.42, r * 0.2);
    ctx.stroke();
    ctx.fillStyle = '#2d1250';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 炸弹：暗色球体 + 高光 + 引线火花 + 红色脉冲环 */
  function drawBomb(r, t) {
    var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260 + (t.phase || 0));
    ctx.strokeStyle = 'rgba(255,45,149,' + (0.35 + pulse * 0.35) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();

    var g = ctx.createRadialGradient(-r * 0.32, -r * 0.36, 1, 0, 0, r * 0.92);
    g.addColorStop(0, '#ff9aaa');
    g.addColorStop(0.25, '#c2183c');
    g.addColorStop(0.7, '#5c0818');
    g.addColorStop(1, t.deep);
    ctx.shadowColor = 'rgba(255,45,149,0.8)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,140,160,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.4, r * 0.2, r * 0.11, -0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d9a066';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.24, -r * 0.78);
    ctx.quadraticCurveTo(r * 0.8, -r * 1.1, r * 0.92, -r * 1.42);
    ctx.stroke();
    var sg = ctx.createRadialGradient(r * 0.92, -r * 1.42, 1, r * 0.92, -r * 1.42, r * 0.42);
    sg.addColorStop(0, '#fffde0');
    sg.addColorStop(0.4, '#ffd54a');
    sg.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(r * 0.92, -r * 1.42, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 磁铁：橙色 U 形磁石 + 金属高光 + 亮色磁极 */
  function drawMagnet(r, t) {
    ctx.save();
    var g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#ffd9a8');
    g.addColorStop(0.4, t.color);
    g.addColorStop(1, t.deep);
    ctx.strokeStyle = g;
    ctx.lineWidth = r * 0.4;
    ctx.lineCap = 'round';
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 12;
    /* 上半圆弧 */
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, Math.PI, 0);
    ctx.stroke();
    /* 两条腿 */
    ctx.beginPath();
    ctx.moveTo(-r * 0.58, 0);
    ctx.lineTo(-r * 0.58, r * 0.5);
    ctx.moveTo(r * 0.58, 0);
    ctx.lineTo(r * 0.58, r * 0.5);
    ctx.stroke();
    ctx.shadowBlur = 0;
    /* 磁极亮头 */
    ctx.strokeStyle = '#eaf7ff';
    ctx.lineWidth = r * 0.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.58, r * 0.34);
    ctx.lineTo(-r * 0.58, r * 0.56);
    ctx.moveTo(r * 0.58, r * 0.34);
    ctx.lineTo(r * 0.58, r * 0.56);
    ctx.stroke();
    /* 内圈高光 */
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  /* 冻结：冰晶六角盘 + 雪花 */
  function drawFreeze(r, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(127,178,255,0.18)';
    ctx.strokeStyle = 'rgba(200,230,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (var h = 0; h < 6; h++) {
      var ha = h * Math.PI / 3 + Math.PI / 6;
      var hx = Math.cos(ha) * r * 0.92;
      var hy = Math.sin(ha) * r * 0.92;
      if (h) ctx.lineTo(hx, hy); else ctx.moveTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = t.color;
    ctx.lineWidth = r * 0.11;
    ctx.lineCap = 'round';
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 12;
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      var ex = Math.cos(a) * r * 0.78;
      var ey = Math.sin(a) * r * 0.78;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      /* 雪花分叉 */
      var bx = Math.cos(a) * r * 0.5;
      var by = Math.sin(a) * r * 0.5;
      var pa = a + Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(pa) * r * 0.26, by + Math.sin(pa) * r * 0.26);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(pa + Math.PI / 3) * r * 0.26, by + Math.sin(pa + Math.PI / 3) * r * 0.26);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* 双倍：绿色圆角徽章 + ×2 字样 */
  function drawDouble(r, t) {
    var size = r * 1.46;
    var g = ctx.createLinearGradient(-size, -size, size, size);
    g.addColorStop(0, '#c9ffb8');
    g.addColorStop(0.45, t.color);
    g.addColorStop(1, t.deep);
    ctx.save();
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    if (window.GK && GK.roundRect) {
      GK.roundRect(ctx, -size / 2, -size / 2, size, size, r * 0.28);
    } else {
      ctx.beginPath();
      ctx.rect(-size / 2, -size / 2, size, size);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(230,255,225,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#06340a';
    ctx.font = "bold " + Math.round(r * 0.92) + "px 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×2', 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.16, -size * 0.28, r * 0.22, r * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawItem(it) {
    var r = it.r, t = it.type;
    ctx.save();
    ctx.translate(it.x, it.y);
    var halo = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2);
    halo.addColorStop(0, t.glow);
    halo.addColorStop(0.55, t.glow.replace('0.30', '0.10'));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(it.rot);
    if (t.id === 'coin') drawCoin(r, t);
    else if (t.id === 'gem') drawGem(r, t);
    else if (t.id === 'clock') drawClock(r, t);
    else if (t.id === 'magnet') drawMagnet(r, t);
    else if (t.id === 'freeze') drawFreeze(r, t);
    else if (t.id === 'double') drawDouble(r, t);
    else drawBomb(r, t);
    ctx.restore();
  }

  /* Boss：霓虹核心 + 旋转尖刺 + 眼 */
  function drawBoss(st) {
    var b = st.boss;
    if (!b) return;
    var t = Date.now() / 1000;
    ctx.save();
    ctx.translate(b.x, b.y);

    var halo = ctx.createRadialGradient(0, 0, b.r * 0.4, 0, 0, b.r * 2);
    halo.addColorStop(0, 'rgba(255,45,149,0.22)');
    halo.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(t * 0.8);
    for (var i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = 'rgba(255,120,190,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.r * 1.12, 0);
      ctx.lineTo(b.r * 1.46, 0);
      ctx.stroke();
    }
    ctx.restore();

    var g = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.34, 2, 0, 0, b.r);
    g.addColorStop(0, '#ff8ab9');
    g.addColorStop(0.32, '#b5165f');
    g.addColorStop(0.72, '#4c0b2a');
    g.addColorStop(1, '#220418');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (var k = 0; k < 6; k++) {
      var a = k * Math.PI / 3 + Math.PI / 6;
      var px = Math.cos(a) * b.r, py = Math.sin(a) * b.r;
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,160,205,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    var pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = '#07020c';
    ctx.beginPath();
    ctx.ellipse(0, -b.r * 0.06, b.r * 0.44, b.r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(0,240,255,' + (0.7 + pulse * 0.3) + ')';
    ctx.beginPath();
    ctx.ellipse(0, -b.r * 0.06, b.r * 0.1, b.r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255,120,160,0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, b.r * 0.44, b.r * 0.46, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.restore();
  }

  function drawBossHp(st) {
    var b = st.boss;
    if (!b) return;
    var x = 54, y = 38, w = W - 108, h = 9;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    var ratio = Math.max(0, Math.min(1, b.hp / b.maxHp));
    var grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#ff2d95');
    grad.addColorStop(0.55, '#ff8a3d');
    grad.addColorStop(1, '#ffe600');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = 'rgba(255,180,210,0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,235,245,0.95)';
    ctx.font = "bold 8px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,45,149,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(T('gs.catch.bossName') + '  ' + Math.max(0, Math.ceil(b.hp)) + '/' + b.maxHp, W / 2, y + h / 2);
    ctx.restore();
  }

  function drawBanner(st) {
    var b = st.banner;
    if (!b) return;
    var p = 1 - b.t / b.max;
    var sc = p < 0.22 ? GK.easeOutBack(Math.min(1, p / 0.22)) : 1;
    var alpha = b.t < 300 ? Math.max(0, b.t / 300) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, 152);
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "bold 21px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }

  function drawBasket(st) {
    var bx = st && st.basketX ? st.basketX : W / 2;
    var squash = st ? (st.squash || 0) : 0;
    var lift = squash * 5;
    var sx = 1 + squash * 0.2;
    var sy = 1 - squash * 0.16;
    var w = BASKET_W;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(bx, BASKET_Y + 34, w * 0.46, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(bx, BASKET_Y - lift);
    ctx.scale(sx, sy);

    /* 发光边 */
    ctx.save();
    ctx.shadowColor = 'rgba(0,240,255,0.85)';
    ctx.shadowBlur = 16 + squash * 16;
    var body = ctx.createLinearGradient(0, -8, 0, 32);
    body.addColorStop(0, '#8dffe0');
    body.addColorStop(0.28, '#25d3a2');
    body.addColorStop(0.7, '#0c8d6b');
    body.addColorStop(1, '#054638');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -7);
    ctx.quadraticCurveTo(-w / 2 + 4, 28, -w / 2 + 14, 31);
    ctx.lineTo(w / 2 - 14, 31);
    ctx.quadraticCurveTo(w / 2 - 4, 28, w / 2, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(190,255,240,0.9)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    /* 编织纹理 */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-w / 2, -7);
    ctx.quadraticCurveTo(-w / 2 + 4, 28, -w / 2 + 14, 31);
    ctx.lineTo(w / 2 - 14, 31);
    ctx.quadraticCurveTo(w / 2 - 4, 28, w / 2, -7);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (var i = 1; i <= 4; i++) {
      var yy = -7 + i * 7;
      ctx.beginPath();
      ctx.moveTo(-w / 2, yy);
      ctx.quadraticCurveTo(0, yy + 3, w / 2, yy);
      ctx.stroke();
    }
    for (var xx = -w / 2 + 10; xx < w / 2; xx += 12) {
      ctx.beginPath();
      ctx.moveTo(xx, -8);
      ctx.quadraticCurveTo(xx + 3, 12, xx + 6, 32);
      ctx.stroke();
    }
    ctx.restore();

    /* 篮口：亮环 + 内部阴影 */
    var rim = ctx.createLinearGradient(-w / 2, -14, w / 2, 0);
    rim.addColorStop(0, '#0c8d6b');
    rim.addColorStop(0.4, '#bfffe8');
    rim.addColorStop(0.7, '#5cf2c2');
    rim.addColorStop(1, '#0c8d6b');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(0, -7, w / 2, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,255,250,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(3,30,26,0.72)';
    ctx.beginPath();
    ctx.ellipse(0, -7, w / 2 - 5, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(-2, -8, w / 2 - 9, 4, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.restore();
  }

  function drawEffects(st) {
    for (var i = 0; i < st.particles.length; i++) {
      var p = st.particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (var j = 0; j < st.rings.length; j++) {
      var rg = st.rings[j];
      ctx.save();
      ctx.globalAlpha = Math.max(0, rg.life) * 0.85;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var k = 0; k < st.floats.length; k++) {
      var f = st.floats[k];
      ctx.save();
      ctx.globalAlpha = f.life < 260 ? Math.max(0, f.life / 260) : 1;
      ctx.font = "bold " + f.size + "px 'Segoe UI', 'Microsoft YaHei', sans-serif";
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawFlash(st) {
    if (!st || st.flashT <= 0) return;
    ctx.save();
    ctx.globalAlpha = (st.flashT / st.flashMax) * (st.flashAlpha || 0.4);
    ctx.fillStyle = st.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function render() {
    drawBackground();
    if (!run) {
      drawBasket(null);
      return;
    }
    drawProgress(run);
    ctx.save();
    var shake = run.camShake || 0;
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    drawBuffField(run);
    for (var i = 0; i < run.items.length; i++) drawItem(run.items[i]);
    drawBoss(run);
    drawBasket(run);
    drawEffects(run);
    ctx.restore();
    drawCombo(run);
    drawBossHp(run);
    drawBanner(run);
    drawFlash(run);
  }

  /* ---------- 输入 ---------- */
  var hold = { left: false, right: false };

  function releaseAll() {
    dragging = false;
    hold.left = false;
    hold.right = false;
    leftBtn.classList.remove('on');
    rightBtn.classList.remove('on');
  }

  function moveBasketTo(e) {
    if (phase !== 'play' || !run) return;
    var p = pointerPos(e);
    run.targetX = clampBasket(p.x);
  }

  cv.addEventListener('pointerdown', function (e) {
    if (phase !== 'play') return;
    dragging = true;
    if (cv.setPointerCapture) {
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    }
    moveBasketTo(e);
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('pointermove', function (e) {
    if (phase !== 'play') return;
    if (e.pointerType === 'mouse' || dragging) moveBasketTo(e);
  }, { passive: true });
  window.addEventListener('pointerup', releaseAll);
  window.addEventListener('pointercancel', releaseAll);

  function bindHold(btn, dir) {
    function down(e) {
      if (phase !== 'play') return;
      e.preventDefault();
      hold[dir] = true;
      btn.classList.add('on');
    }
    function up() {
      hold[dir] = false;
      btn.classList.remove('on');
    }
    btn.addEventListener('pointerdown', down, { passive: false });
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('lostpointercapture', up);
  }
  bindHold(leftBtn, 'left');
  bindHold(rightBtn, 'right');

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      keys.left = true;
      if (phase === 'play') e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      keys.right = true;
      if (phase === 'play') e.preventDefault();
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      keys.shift = true;
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (phase === 'play' || phase === 'pause') {
        e.preventDefault();
        togglePause();
      }
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && phase === 'play') pauseGame(true);
  });

  pauseBtn.addEventListener('click', function () {
    if (phase === 'play') pauseGame();
  });
  resumeBtn.addEventListener('click', function () { resumeGame(); });
  pauseRestartBtn.addEventListener('click', function () {
    if (run) startRun(run.diff);
  });
  againBtn.addEventListener('click', function () {
    if (run) startRun(run.diff);
  });
  changeBtn.addEventListener('click', function () { openPicker(false); });

  pickOv.addEventListener('click', function (e) {
    var node = e.target;
    while (node && node !== pickOv && !(node.classList && node.classList.contains('ct-diff'))) {
      node = node.parentNode;
    }
    if (!node || node === pickOv) return;
    var idx = parseInt(node.getAttribute('data-i'), 10);
    if (idx >= 0) startRun(idx);
  });

  window.GAME_RESTART = function () {
    startRun(run ? run.diff : 1);
  };

  /* ---------- 启动 ---------- */
  if (window.Arcade && Arcade.loop) {
    loopApi = Arcade.loop.start(update, render, STEP, { autoResume: false });
  }
  openPicker(true);
})();
