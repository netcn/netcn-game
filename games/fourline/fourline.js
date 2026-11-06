/* 四子棋 Four in a Row —— 旗舰版
   模式：简单(随机) / 中等(挡四) / 困难(negamax) / 专家(迭代加深+限时) / 同屏双人 / 每日残局
   规则：AI 与双人模式每局交替先手；先手首回合只能落中间三列。
   表现：DOM 自绘棋子 + Canvas 粒子/四连辉光 + 落子回弹 + 胜利震屏。
   记录：仅 AI/单人胜利与每日残局写入成绩；双人对战绝不提交排行榜。 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.fourline.tut1t'), d: T('gs.fourline.tut1') },
  { t: T('gs.fourline.tut2t'), d: T('gs.fourline.tut2') },
  { t: T('gs.fourline.tut3t'), d: T('gs.fourline.tut3') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var COLS = 7, ROWS = 6;
  var GAME_ID = document.body.getAttribute('data-game-id') || 'fourline';
  var DAILY_BEST_ID = GAME_ID + '-daily';
  var AI_DELAY = { easy: 420, medium: 560, hard: 700, expert: 780 };
  var EXPERT_BUDGET = 320;
  var HARD_DEPTH = 6;
  var OPEN_COLS = [2, 3, 4];

  var MODE_LIST = [
    { id: 'easy', name: 'dEasy', desc: 'modeEasyD', icon: 'easy' },
    { id: 'medium', name: 'dMedium', desc: 'modeMediumD', icon: 'medium' },
    { id: 'hard', name: 'dHard', desc: 'modeHardD', icon: 'hard' },
    { id: 'expert', name: 'dExpert', desc: 'modeExpertD', icon: 'expert' },
    { id: 'pvp', name: 'modePvp', desc: 'modePvpD', icon: 'pvp' },
    { id: 'daily', name: 'dDaily', desc: 'modeDailyD', icon: 'daily' }
  ];

  /* 每日残局：固定手工局面，按日期确定性轮换（row0 为顶行，1=红方 2=黄方） */
  var DAILY_PUZZLES = [
    { name: 'dailyName1', rows: ['.......', '.......', '.......', '.......', '.......', '2.111.2'], line: [1] },
    { name: 'dailyName2', rows: ['.......', '.......', '.......', '..1....', '..1....', '..1..2.'], line: [2] },
    { name: 'dailyName3', rows: ['.......', '.......', '.......', '...12..', '..122..', '.12222.'], line: [4] },
    { name: 'dailyName4', rows: ['.......', '.......', '......1', '.....1.', '....1..', '2.2....'], line: [3] },
    { name: 'dailyName5', rows: ['.......', '.......', '.1.....', '.212...', '.221...', '.222.22'], line: [4] },
    { name: 'dailyName6', rows: ['.......', '.......', '.......', '...1...', '...1...', '.2.1...'], line: [3] },
    { name: 'dailyName7', rows: ['.......', '.......', '.....1.', '....1..', '...1...', '2..2...'], line: [2] },
    { name: 'dailyName8', rows: ['.......', '.......', '.......', '.......', '..111..', '.22222.'], line: [1] }
  ];

  /* 内联 SVG 图标（不使用 emoji 作为美术） */
  var ICONS = {
    easy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/></svg>',
    medium: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l7 3v5c0 4.6-2.9 7.9-7 9-4.1-1.1-7-4.4-7-9V6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 11.5l2.4 2.4 4.6-4.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    hard: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".55"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="currentColor" stroke-width="1.5"/></svg>',
    expert: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 17l3-9 3 4 2-6 2 6 3-4 3 9z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 17h16v3H4z" fill="currentColor" opacity=".35"/></svg>',
    pvp: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.5" cy="9.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19c0-3 2.4-5 5.5-5s5.5 2 5.5 5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14.5 15.2c2.6.2 4.5 1.7 4.5 3.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    daily: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="14" r="1.4" fill="currentColor"/><circle cx="12" cy="14" r="1.4" fill="currentColor"/><circle cx="15.5" cy="14" r="1.4" fill="currentColor"/></svg>'
  };
  function iconSvg(name) { return '<span class="c4-mode-ic">' + (ICONS[name] || '') + '</span>'; }
  function smallIcon(name) {
    var svg = {
      again: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
      trophy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>'
    };
    return '<span class="c4-btn-ic" aria-hidden="true">' + (svg[name] || '') + '</span>';
  }

  var board = [], cells = [], lineLayer = null;
  var turn = 1, mode = 'medium', lastMode = 'medium';
  var over = true, thinking = false, pickerVisible = true;
  var paused = false, pauseStart = 0, pausedMs = 0, resumeAI = false, resumeDaily = false;
  var firstPlayer = 1, humanPlayer = 1, aiPlayer = 2;
  var streak = 0, roundNo = 0, moves = 0, startTs = 0, lastScore = 0;
  var sessionWins = 0, sessionRounds = 0, lastOutcome = '';
  var selectedCol = 3, ghostCol = 3, pendingCol = -1;
  var timers = [];
  var daily = { puzzle: null, index: 0, step: 0, playerMoves: 0, maxMoves: 1, fresh: false };

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers.length = 0;
    thinking = false;
  }
  function audio(name) { if (Arcade.audio) Arcade.audio.play(name); }

  var modesHtml = MODE_LIST.map(function (m) {
    return '<button class="mode-btn c4-mode-btn" data-mode="' + m.id + '" aria-label="' + T('gs.fourline.' + m.name) + '">' +
      iconSvg(m.icon) +
      '<b>' + T('gs.fourline.' + m.name) + '</b><small>' + T('gs.fourline.' + m.desc) + '</small></button>';
  }).join('');

  root.innerHTML =
    '<div class="c4-wrap">' +
    '  <div class="c4-pick" id="c4-pick">' +
    '    <div class="c4-pick-t">' + T('gs.fourline.pickTitle') + '</div>' +
    '    <div class="c4-pick-d">' + T('gs.fourline.pickDesc') + '</div>' +
    '    <div class="c4-modes" id="c4-modes">' + modesHtml + '</div>' +
    '    <div class="c4-pick-best" id="c4-pick-best"></div>' +
    '    <div class="c4-pick-daily" id="c4-pick-daily"></div>' +
    '  </div>' +
    '  <div class="c4-game hidden" id="c4-game">' +
    '    <div class="c4-hud">' +
    '      <span class="c4-chip" id="c4-chip-mode"></span>' +
    '      <span class="c4-chip" id="c4-chip-first"></span>' +
    '      <span class="c4-chip" id="c4-chip-streak"></span>' +
    '      <span class="c4-chip" id="c4-chip-score"></span>' +
    '      <span class="c4-chip" id="c4-chip-best"></span>' +
    '    </div>' +
    '    <div class="c4-stage" id="c4-stage">' +
    '      <div class="c4-board" id="c4-board" role="grid" aria-label="' + T('gs.fourline.boardAria') + '"></div>' +
    '    </div>' +
    '    <div class="c4-status" id="c4-msg" aria-live="polite"></div>' +
    '    <div class="c4-rule" id="c4-rule"></div>' +
    '    <div class="c4-tip">' + T('gs.fourline.kbdHint') + '</div>' +
    '    <div class="c4-tools">' +
    '      <button class="btn purple c4-open-picker" id="c4-open-picker">' + T('gs.fourline.changeMode') + '</button>' +
    '      <button class="btn yellow c4-open-picker" id="c4-pause-btn">' + T('gs.fourline.pauseBtn') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="c4-overlay hidden" id="c4-overlay">' +
    '    <div class="c4-card">' +
    '      <h2 id="c4-ov-title"></h2>' +
    '      <p id="c4-ov-text"></p>' +
    '      <div class="c4-stats">' +
    '        <span><i id="c4-s1l"></i><b id="c4-s1v">0</b></span>' +
    '        <span><i id="c4-s2l"></i><b id="c4-s2v">0</b></span>' +
    '        <span><i id="c4-s3l"></i><b id="c4-s3v">0</b></span>' +
    '      </div>' +
    '      <div class="c4-record hidden" id="c4-record"></div>' +
    '      <div class="c4-ov-note hidden" id="c4-ov-note"></div>' +
    '      <div class="c4-ov-btns">' +
    '        <button class="btn green" id="c4-again"></button>' +
    '        <button class="btn purple" id="c4-change-mode">' + T('gs.fourline.changeMode') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="c4-overlay c4-pause-overlay hidden" id="c4-pause">' +
    '    <div class="c4-card">' +
    '      <h2 class="draw">' + T('gs.fourline.pauseTitle') + '</h2>' +
    '      <p>' + T('gs.fourline.pauseDesc') + '</p>' +
    '      <div class="c4-ov-btns">' +
    '        <button class="btn green" id="c4-resume">' + T('gs.fourline.resume') + '</button>' +
    '        <button class="btn yellow" id="c4-pause-restart">' + T('gs.fourline.again') + '</button>' +
    '        <button class="btn purple" id="c4-pause-mode">' + T('gs.fourline.changeMode') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var pickEl = root.querySelector('#c4-pick');
  var gameEl = root.querySelector('#c4-game');
  var stageEl = root.querySelector('#c4-stage');
  var boardEl = root.querySelector('#c4-board');
  var msgEl = root.querySelector('#c4-msg');
  var ruleEl = root.querySelector('#c4-rule');
  var overlayEl = root.querySelector('#c4-overlay');
  var pauseEl = root.querySelector('#c4-pause');
  var ovTitle = root.querySelector('#c4-ov-title');
  var ovText = root.querySelector('#c4-ov-text');
  var s1l = root.querySelector('#c4-s1l'), s1v = root.querySelector('#c4-s1v');
  var s2l = root.querySelector('#c4-s2l'), s2v = root.querySelector('#c4-s2v');
  var s3l = root.querySelector('#c4-s3l'), s3v = root.querySelector('#c4-s3v');
  var recordEl = root.querySelector('#c4-record');
  var ovNote = root.querySelector('#c4-ov-note');
  var pickBestEl = root.querySelector('#c4-pick-best');
  var pickDailyEl = root.querySelector('#c4-pick-daily');
  var chipMode = root.querySelector('#c4-chip-mode');
  var chipFirst = root.querySelector('#c4-chip-first');
  var chipStreak = root.querySelector('#c4-chip-streak');
  var chipScore = root.querySelector('#c4-chip-score');
  var chipBest = root.querySelector('#c4-chip-best');
  var againBtn = root.querySelector('#c4-again');
  var modeBtns = root.querySelectorAll('.c4-mode-btn');

  for (var r0 = 0; r0 < ROWS; r0++) {
    for (var c0 = 0; c0 < COLS; c0++) {
      var cell = document.createElement('div');
      cell.className = 'c4-cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('data-col', String(c0));
      cell.innerHTML = '<div class="c4-ghost"></div><div class="c4-piece"></div>';
      cell._piece = cell.querySelector('.c4-piece');
      cell._ghost = cell.querySelector('.c4-ghost');
      cell._piece.addEventListener('animationend', function (e) {
        if (e.animationName === 'c4drop') this.classList.remove('dropping');
      });
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }
  lineLayer = document.createElement('div');
  lineLayer.className = 'c4-line-layer';
  boardEl.appendChild(lineLayer);

  var fxCanvas = document.createElement('canvas');
  fxCanvas.className = 'c4-fx-canvas';
  fxCanvas.setAttribute('aria-hidden', 'true');
  boardEl.appendChild(fxCanvas);
  var fxCtx = fxCanvas.getContext && fxCanvas.getContext('2d');

  /* ================= 状态 / 工具 ================= */
  var firstIsHuman = true;
  function bestScore() {
    try {
      var b = Arcade.storage && Arcade.storage.getBest(GAME_ID);
      return b == null ? 0 : b;
    } catch (e) { return 0; }
  }
  function dailyBest() {
    try {
      var b = Arcade.storage && Arcade.storage.getBest(DAILY_BEST_ID);
      return b == null ? 0 : b;
    } catch (e) { return 0; }
  }
  function dailyStreak() {
    try { return (Arcade.daily && Arcade.daily.streak()) || 0; } catch (e) { return 0; }
  }
  function dailySolvedToday() {
    try { return !!(Arcade.daily && Arcade.daily.isSolved(GAME_ID)); } catch (e) { return false; }
  }
  function dailyIndex() {
    var d = new Date();
    var day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    var n = DAILY_PUZZLES.length;
    return ((day % n) + n) % n;
  }
  function dailyName() {
    return daily.puzzle ? T('gs.fourline.' + daily.puzzle.name) : '';
  }
  function modeLabel(m) {
    for (var i = 0; i < MODE_LIST.length; i++) {
      if (MODE_LIST[i].id === m) return T('gs.fourline.' + MODE_LIST[i].name);
    }
    return m;
  }
  function colorName(p) { return p === 1 ? T('gs.fourline.colorRed') : T('gs.fourline.colorYellow'); }
  function firstLabel() {
    if (mode === 'daily') return T('gs.fourline.firstYou');
    if (mode === 'pvp') return firstPlayer === 1 ? T('gs.fourline.firstRed') : T('gs.fourline.firstYellow');
    return firstIsHuman ? T('gs.fourline.firstYou') : T('gs.fourline.firstAI');
  }
  function elapsedSec() {
    var ms = Date.now() - startTs - pausedMs;
    if (paused) ms -= Date.now() - pauseStart;
    return Math.max(1, Math.round(ms / 1000));
  }
  function isOpening() {
    return !over && !pickerVisible && moves === 0 && mode !== 'daily';
  }
  function openingAllowed(col) {
    for (var i = 0; i < OPEN_COLS.length; i++) if (OPEN_COLS[i] === col) return true;
    return false;
  }
  function canHumanPlay() {
    if (pickerVisible || over || paused || thinking) return false;
    if (mode === 'daily') return turn === 1;
    if (mode === 'pvp') return true;
    return turn === humanPlayer;
  }
  function lowest(col) {
    for (var r = ROWS - 1; r >= 0; r--) if (!board[r][col]) return r;
    return -1;
  }
  function full() {
    for (var c = 0; c < COLS; c++) if (!board[0][c]) return false;
    return true;
  }
  function setMsg(text, cls) {
    msgEl.className = 'c4-status' + (cls ? ' ' + cls : '');
    msgEl.textContent = text;
  }
  function setTurnMsg() {
    if (mode === 'daily') {
      var left = Math.max(1, daily.maxMoves - daily.playerMoves);
      setMsg(T('gs.fourline.dailyGoal').replace('{n}', left), 'turn1');
      return;
    }
    if (mode === 'pvp') {
      setMsg(turn === 1 ? T('gs.fourline.p1Turn') : T('gs.fourline.p2Turn'), turn === 1 ? 'turn1' : 'turn2');
      return;
    }
    if (turn === humanPlayer) setMsg(T('gs.fourline.yourTurnColor').replace('{c}', colorName(turn)), turn === 1 ? 'turn1' : 'turn2');
    else setMsg(T('gs.fourline.aiTurn'), 'thinking');
  }
  function setThinkingMsg() {
    msgEl.className = 'c4-status thinking';
    msgEl.innerHTML = T('gs.fourline.aiTurn') + '<span class="c4-dots"><i></i><i></i><i></i></span>';
  }
  function setDailyThinkingMsg() {
    msgEl.className = 'c4-status thinking';
    msgEl.innerHTML = T('gs.fourline.dailyThinking') + '<span class="c4-dots"><i></i><i></i><i></i></span>';
  }
  function updateRule() {
    if (mode === 'daily' && daily.puzzle) {
      ruleEl.innerHTML = T('gs.fourline.dailyRule')
        .replace('{name}', dailyName()).replace('{n}', daily.maxMoves);
      return;
    }
    ruleEl.innerHTML = T('gs.fourline.ruleOpening').replace('{p}', firstLabel());
  }
  function updateHud() {
    chipMode.textContent = modeLabel(mode);
    chipFirst.textContent = T('gs.fourline.hudFirst').replace('{p}', firstLabel());
    if (mode === 'pvp') {
      chipStreak.textContent = T('gs.fourline.hudRounds').replace('{n}', roundNo);
      chipScore.textContent = T('gs.fourline.hudMoves').replace('{n}', moves);
      chipBest.textContent = T('gs.fourline.noRankShort');
    } else if (mode === 'daily') {
      chipStreak.textContent = dailySolvedToday() ? T('gs.fourline.dailySolved') : T('gs.fourline.dailyStreak').replace('{n}', dailyStreak());
      chipScore.textContent = T('gs.fourline.hudScore').replace('{n}', lastScore);
      chipBest.textContent = T('gs.fourline.dailyBestChip').replace('{n}', dailyBest());
    } else {
      chipStreak.textContent = T('gs.fourline.hudStreak').replace('{n}', streak);
      chipScore.textContent = T('gs.fourline.hudScore').replace('{n}', lastScore);
      chipBest.textContent = T('gs.fourline.hudBestNum').replace('{n}', bestScore());
    }
    updateRule();
  }
  function updateBestUI() {
    pickBestEl.innerHTML = T('gs.fourline.hudBest').replace('{n}', '<b>' + bestScore() + '</b>');
    pickDailyEl.textContent = T('gs.fourline.dailyPickInfo')
      .replace('{s}', dailySolvedToday() ? T('gs.fourline.dailySolved') : T('gs.fourline.dailyUnsolved'))
      .replace('{n}', dailyStreak());
  }
  function setPickerActive() {
    for (var i = 0; i < modeBtns.length; i++) {
      modeBtns[i].classList.toggle('active', modeBtns[i].getAttribute('data-mode') === lastMode);
    }
  }
  function boardGap() {
    try {
      var g = parseFloat(getComputedStyle(boardEl).gap);
      return isNaN(g) ? 5 : g;
    } catch (e) { return 5; }
  }
  function boardEmpty() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
      board[r] = [];
      for (var c = 0; c < COLS; c++) board[r][c] = 0;
    }
  }
  function copyBoard(b) {
    var out = [];
    for (var r = 0; r < ROWS; r++) out[r] = b[r].slice();
    return out;
  }

  /* ================= Canvas 粒子 / 四连辉光 ================= */
  var fxParticles = [], fxGlows = [], fxBeam = null, fxRaf = 0, fxUntil = 0;
  function fxReduced() {
    try { return !!(Arcade.settings && Arcade.settings.get().reducedMotion); } catch (e) { return false; }
  }
  function resizeFx() {
    if (!fxCanvas || !fxCtx) return;
    var b = boardEl.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    fxCanvas.width = Math.max(1, Math.round(b.width * dpr));
    fxCanvas.height = Math.max(1, Math.round(b.height * dpr));
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function cellLocal(cell) {
    var b = boardEl.getBoundingClientRect();
    var c = cell.getBoundingClientRect();
    return { x: c.left + c.width / 2 - b.left, y: c.top + c.height / 2 - b.top, r: c.width / 2 };
  }
  function fxBurstCell(cell, color, count) {
    if (fxReduced() || !fxCtx) return;
    var p = cellLocal(cell);
    for (var i = 0; i < (count || 7); i++) {
      var a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4;
      fxParticles.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.6, life: 1, color: color });
    }
    startFx();
  }
  function fxWinGlow(seq, p) {
    fxGlows = [];
    var color = p === 1 ? '#ff2d6f' : '#ffd400';
    for (var i = 0; i < seq.length; i++) {
      var q = cellLocal(cells[seq[i].r * COLS + seq[i].c]);
      fxGlows.push({ x: q.x, y: q.y, r: q.r, color: color });
      for (var k = 0; k < 5; k++) {
        var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.4;
        fxParticles.push({ x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 1, color: color });
      }
    }
    var a0 = cellLocal(cells[seq[0].r * COLS + seq[0].c]);
    var a1 = cellLocal(cells[seq[seq.length - 1].r * COLS + seq[seq.length - 1].c]);
    fxBeam = { x1: a0.x, y1: a0.y, x2: a1.x, y2: a1.y, color: color };
    fxUntil = performance.now() + 1800;
    startFx();
  }
  function startFx() {
    if (fxRaf || !fxCtx) return;
    fxRaf = requestAnimationFrame(fxTick);
  }
  function fxTick(now) {
    fxRaf = 0;
    var W = fxCanvas.width / (Math.min(2, window.devicePixelRatio || 1));
    var H = fxCanvas.height / (Math.min(2, window.devicePixelRatio || 1));
    fxCtx.clearRect(0, 0, W, H);
    if (fxBeam) {
      var fade = Math.max(0, Math.min(1, (fxUntil - now) / 900));
      fxCtx.globalCompositeOperation = 'lighter';
      fxCtx.strokeStyle = fxBeam.color;
      fxCtx.globalAlpha = 0.55 * fade;
      fxCtx.lineWidth = 7;
      fxCtx.beginPath(); fxCtx.moveTo(fxBeam.x1, fxBeam.y1); fxCtx.lineTo(fxBeam.x2, fxBeam.y2); fxCtx.stroke();
      fxCtx.globalAlpha = 1;
    }
    for (var g = 0; g < fxGlows.length; g++) {
      var gl = fxGlows[g];
      var pul = 0.78 + Math.sin(now / 180 + g) * 0.22;
      var rad = Math.max(0, Math.min(1, (fxUntil - now) / 800));
      var rg = fxCtx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r * 1.9);
      rg.addColorStop(0, gl.color);
      rg.addColorStop(0.45, gl.color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      fxCtx.globalCompositeOperation = 'lighter';
      fxCtx.globalAlpha = 0.38 * pul * rad;
      fxCtx.fillStyle = rg;
      fxCtx.beginPath(); fxCtx.arc(gl.x, gl.y, gl.r * 1.9, 0, Math.PI * 2); fxCtx.fill();
      fxCtx.globalAlpha = 1;
    }
    fxCtx.globalCompositeOperation = 'source-over';
    for (var i = fxParticles.length - 1; i >= 0; i--) {
      var p = fxParticles[i];
      p.vy += 0.09; p.x += p.vx; p.y += p.vy; p.life -= 0.018;
      if (p.life <= 0) { fxParticles.splice(i, 1); continue; }
      fxCtx.globalAlpha = Math.max(0, p.life);
      fxCtx.fillStyle = p.color;
      fxCtx.beginPath(); fxCtx.arc(p.x, p.y, 2.2 * p.life + 0.7, 0, Math.PI * 2); fxCtx.fill();
    }
    fxCtx.globalAlpha = 1;
    if (fxParticles.length || now < fxUntil) fxRaf = requestAnimationFrame(fxTick);
    else { fxGlows = []; fxBeam = null; fxCtx.clearRect(0, 0, W, H); }
  }
  function resetFx() {
    if (fxRaf) cancelAnimationFrame(fxRaf);
    fxRaf = 0; fxParticles = []; fxGlows = []; fxBeam = null; fxUntil = 0;
    if (fxCtx) {
      var W = fxCanvas.width / (Math.min(2, window.devicePixelRatio || 1));
      var H = fxCanvas.height / (Math.min(2, window.devicePixelRatio || 1));
      fxCtx.clearRect(0, 0, W, H);
    }
  }

  /* ================= 预览 / 落子 ================= */
  function refreshPreview() {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = cells[r * COLS + c];
        cell.classList.remove('hl', 'sel', 'ok-col', 'dim-col');
        cell._ghost.className = 'c4-ghost';
      }
    }
    var opening = isOpening();
    boardEl.classList.toggle('opening', opening);
    if (opening) {
      for (var co = 0; co < COLS; co++) {
        var ok = openingAllowed(co);
        for (var ro = 0; ro < ROWS; ro++) {
          cells[ro * COLS + co].classList.add(ok ? 'ok-col' : 'dim-col');
        }
      }
    }
    if (!canHumanPlay()) return;
    var col = ghostCol >= 0 ? ghostCol : selectedCol;
    if (col < 0 || col >= COLS) return;
    if (opening && !openingAllowed(col)) return;
    var row = lowest(col);
    for (var rr = 0; rr < ROWS; rr++) cells[rr * COLS + col].classList.add('hl');
    if (row < 0) return;
    var target = cells[row * COLS + col];
    target.classList.add('sel');
    target._ghost.className = 'c4-ghost show p' + turn;
  }
  function spawnRipple(cell, p) {
    var rp = document.createElement('div');
    rp.className = 'c4-ripple p' + p;
    cell.appendChild(rp);
    later(function () { if (rp.parentNode) rp.parentNode.removeChild(rp); }, 600);
  }
  function placePiece(row, col, p, animate) {
    var cell = cells[row * COLS + col];
    var piece = cell._piece;
    if (!animate) {
      piece.removeAttribute('style');
      piece.className = 'c4-piece p' + p;
      return;
    }
    var gap = boardGap();
    piece.style.setProperty('--fall', ((row + 1) * (cell.getBoundingClientRect().height + gap)) + 'px');
    piece.className = 'c4-piece p' + p + ' dropping';
    audio('drop');
    later(function () {
      spawnRipple(cell, p);
      fxBurstCell(cell, p === 1 ? '#ff2d6f' : '#ffd400', 7);
    }, 340);
  }
  function findLine(row, col, p) {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var d = 0; d < dirs.length; d++) {
      var seq = [{ r: row, c: col }];
      var dr = dirs[d][0], dc = dirs[d][1];
      for (var s = 1; s < 4; s++) {
        var nr = row + dr * s, nc = col + dc * s;
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS || board[nr][nc] !== p) break;
        seq.push({ r: nr, c: nc });
      }
      for (var s2 = 1; s2 < 4; s2++) {
        var pr = row - dr * s2, pc = col - dc * s2;
        if (pr < 0 || pc < 0 || pr >= ROWS || pc >= COLS || board[pr][pc] !== p) break;
        seq.unshift({ r: pr, c: pc });
      }
      if (seq.length >= 4) return seq.slice(0, 4);
    }
    return null;
  }
  function outcomeForWinner(p) {
    if (mode === 'pvp') return p === 1 ? 'pvp1' : 'pvp2';
    if (mode === 'daily') return p === 1 ? 'dailywin' : 'dailyfail';
    return p === humanPlayer ? 'win' : 'lose';
  }

  function commitMove(col, p) {
    var row = lowest(col);
    if (row < 0) return false;
    board[row][col] = p;
    moves++;
    selectedCol = col;
    if (mode === 'daily' && p === 1) daily.playerMoves++;
    placePiece(row, col, p, true);
    var line = findLine(row, col, p);
    if (line) {
      endRound(outcomeForWinner(p), p, line);
      return true;
    }
    if (full()) {
      endRound(mode === 'daily' ? 'dailyfail' : 'draw', 0, null);
      return true;
    }
    if (mode === 'daily') {
      var expected = daily.puzzle ? daily.puzzle.line[daily.step] : -1;
      if (p === 1 && expected !== col) {
        daily.fresh = false;
        endRound('dailyfail', 0, null);
        return true;
      }
      daily.step++;
      if (p === 1) {
        if (daily.playerMoves >= daily.maxMoves) {
          endRound('dailyfail', 0, null);
          return true;
        }
      }
    }
    turn = 3 - p;
    if (mode === 'daily') {
      if (turn === 2) {
        thinking = true;
        setDailyThinkingMsg();
        refreshPreview();
        scheduleDailyReply();
      } else {
        setTurnMsg();
        refreshPreview();
      }
    } else if (mode === 'pvp') {
      ghostCol = selectedCol;
      setTurnMsg();
      refreshPreview();
    } else if (turn === aiPlayer) {
      thinking = true;
      setThinkingMsg();
      refreshPreview();
      later(aiMove, AI_DELAY[mode] || 560);
    } else {
      setTurnMsg();
      refreshPreview();
    }
    updateHud();
    return true;
  }

  /* ================= 结算 ================= */
  function calcScore(outcome, elapsed) {
    if (mode === 'daily') {
      return Math.round(140 + daily.maxMoves * 40 + Math.max(0, 120 - elapsed * 3));
    }
    if (outcome === 'win') {
      var base = mode === 'expert' ? 320 : (mode === 'hard' ? 240 : (mode === 'medium' ? 160 : 100));
      return Math.round(base + streak * 30 + Math.max(0, 120 - elapsed * 3));
    }
    return Math.round(Math.max(0, moves * 2));
  }
  function winRate() {
    return sessionRounds ? Math.round(sessionWins / sessionRounds * 100) : 0;
  }
  function drawWinLine(seq, p) {
    var b = boardEl.getBoundingClientRect();
    var first = cells[seq[0].r * COLS + seq[0].c].getBoundingClientRect();
    var last = cells[seq[seq.length - 1].r * COLS + seq[seq.length - 1].c].getBoundingClientRect();
    var x1 = first.left + first.width / 2 - b.left;
    var y1 = first.top + first.height / 2 - b.top;
    var x2 = last.left + last.width / 2 - b.left;
    var y2 = last.top + last.height / 2 - b.top;
    var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    var rot = Math.atan2(y2 - y1, x2 - x1);
    var line = document.createElement('div');
    line.className = 'c4-winline p' + p;
    line.style.left = x1 + 'px';
    line.style.top = (y1 - 3) + 'px';
    line.style.width = len + 'px';
    line.style.setProperty('--rot', rot + 'rad');
    lineLayer.appendChild(line);
  }
  function markWinCells(seq) {
    for (var i = 0; i < seq.length; i++) {
      var piece = cells[seq[i].r * COLS + seq[i].c]._piece;
      if (!piece) continue;
      piece.classList.remove('dropping');
      piece.classList.add('win');
      piece.style.animationDelay = (i * 0.12) + 's';
    }
  }
  function triggerWinFx(seq, p) {
    drawWinLine(seq, p);
    markWinCells(seq);
    fxWinGlow(seq, p);
    if (!fxReduced()) {
      stageEl.classList.remove('c4-shake');
      void stageEl.offsetWidth;
      stageEl.classList.add('c4-shake');
      later(function () { stageEl.classList.remove('c4-shake'); }, 620);
    }
    if (Arcade.juice && Arcade.juice.win) Arcade.juice.win();
    else audio('win');
    if (Arcade.fx) Arcade.fx.flash(p === 1 ? '#ff2d6f' : '#ffd400');
  }

  function endRound(outcome, p, line) {
    if (over) return;
    over = true;
    thinking = false;
    paused = false;
    resumeAI = false;
    resumeDaily = false;
    pendingCol = -1;
    ghostCol = -1;
    var elapsed = elapsedSec();
    lastOutcome = outcome;
    var isNew = false, isNewDaily = false;

    if (mode === 'pvp') {
      /* 双人对战：不计分，绝不调用 Arcade.shell.submitScore，不写最高分/排行榜 */
      lastScore = 0;
    } else if (mode === 'daily') {
      lastScore = outcome === 'dailywin' ? calcScore(outcome, elapsed) : 0;
      if (outcome === 'dailywin' && Arcade.daily) {
        daily.fresh = Arcade.daily.markSolved(GAME_ID, elapsed);
        if (daily.fresh && Arcade.storage) {
          isNewDaily = !!Arcade.storage.submitBest(DAILY_BEST_ID, lastScore, 'max');
        }
      }
    } else {
      sessionRounds++;
      if (outcome === 'win') { sessionWins++; streak++; } else { streak = 0; }
      lastScore = outcome === 'win' ? calcScore(outcome, elapsed) : 0;
      /* 只有单人/AI 模式的胜利才提交普通最高分；失败/平局不写排行榜 */
      if (outcome === 'win' && Arcade.shell && Arcade.shell.submitScore) {
        try { isNew = !!Arcade.shell.submitScore(lastScore); } catch (e) { isNew = false; }
      }
    }
    updateHud();
    updateBestUI();
    refreshPreview();
    var resultMsg = '', resultCls = '';
    if (outcome === 'win') { resultMsg = T('gs.fourline.win').replace('{n}', streak); resultCls = 'win'; }
    else if (outcome === 'lose') { resultMsg = T('gs.fourline.lose'); resultCls = 'lose'; }
    else if (outcome === 'draw') { resultMsg = T('gs.fourline.draw'); resultCls = 'draw'; }
    else if (outcome === 'pvp1') { resultMsg = T('gs.fourline.ovP1T'); resultCls = 'turn1'; }
    else if (outcome === 'pvp2') { resultMsg = T('gs.fourline.ovP2T'); resultCls = 'turn2'; }
    else if (outcome === 'dailywin') { resultMsg = T('gs.fourline.ovDailyWinT'); resultCls = 'win'; }
    else if (outcome === 'dailyfail') { resultMsg = T('gs.fourline.ovDailyFailT'); resultCls = 'lose'; }
    setMsg(resultMsg, resultCls);
    boardEl.classList.remove('lose', 'draw', 'fail');

    later(function () {
      if (outcome === 'win' || outcome === 'pvp1' || outcome === 'pvp2' || outcome === 'dailywin') {
        if (line) triggerWinFx(line, p);
      } else if (outcome === 'lose') {
        if (line) triggerWinFx(line, p);
        boardEl.classList.add('lose');
        audio('lose');
        if (Arcade.fx) { Arcade.fx.shake(boardEl); Arcade.fx.flash('#ff2d6f'); }
      } else if (outcome === 'dailyfail') {
        boardEl.classList.add('fail');
        audio('lose');
        if (Arcade.fx) Arcade.fx.shake(stageEl);
      } else {
        boardEl.classList.add('draw');
        audio('match');
      }
    }, 470);

    later(function () { showResult(outcome, elapsed, lastScore, isNew, isNewDaily); }, 1320);
  }

  function setStat(elLabel, elValue, label, value) {
    elLabel.textContent = label;
    elValue.textContent = String(value);
  }
  function showResult(outcome, elapsed, score, isNew, isNewDaily) {
    var title, cls, text;
    var mName = modeLabel(mode);
    var rate = winRate();
    if (outcome === 'win') {
      title = T('gs.fourline.ovWinT'); cls = 'win';
      text = T('gs.fourline.ovWinD').replace('{m}', mName).replace('{t}', elapsed).replace('{n}', streak).replace('{r}', rate);
    } else if (outcome === 'lose') {
      title = T('gs.fourline.ovLoseT'); cls = 'lose';
      text = T('gs.fourline.ovLoseD').replace('{m}', mName).replace('{t}', elapsed).replace('{r}', rate);
    } else if (outcome === 'draw') {
      title = T('gs.fourline.ovDrawT'); cls = 'draw';
      text = mode === 'pvp'
        ? T('gs.fourline.ovPvpD').replace('{t}', elapsed).replace('{m}', moves)
        : T('gs.fourline.ovDrawD').replace('{t}', elapsed).replace('{m}', moves).replace('{r}', rate);
    } else if (outcome === 'dailywin') {
      title = T('gs.fourline.ovDailyWinT'); cls = 'win';
      text = T('gs.fourline.ovDailyWinD')
        .replace('{d}', daily.index + 1).replace('{name}', dailyName()).replace('{m}', daily.playerMoves)
        .replace('{t}', elapsed).replace('{n}', dailyStreak());
    } else if (outcome === 'dailyfail') {
      title = T('gs.fourline.ovDailyFailT'); cls = 'lose';
      text = T('gs.fourline.ovDailyFailD')
        .replace('{name}', dailyName()).replace('{m}', daily.playerMoves).replace('{t}', elapsed);
    } else {
      title = outcome === 'pvp1' ? T('gs.fourline.ovP1T') : T('gs.fourline.ovP2T');
      cls = outcome === 'pvp1' ? 'win' : 'lose';
      text = T('gs.fourline.ovPvpD').replace('{t}', elapsed).replace('{m}', moves);
    }
    ovTitle.textContent = title;
    ovTitle.className = cls;
    ovText.textContent = text;

    if (mode === 'pvp') {
      setStat(s1l, s1v, T('gs.fourline.statMoves'), moves);
      setStat(s2l, s2v, T('gs.fourline.statTime'), elapsed + 's');
      setStat(s3l, s3v, T('gs.fourline.statRound'), roundNo);
    } else if (outcome === 'dailyfail') {
      setStat(s1l, s1v, T('gs.fourline.statMoves'), daily.playerMoves);
      setStat(s2l, s2v, T('gs.fourline.statGoal'), daily.maxMoves);
      setStat(s3l, s3v, T('gs.fourline.statTime'), elapsed + 's');
    } else {
      setStat(s1l, s1v, T('gs.fourline.statScore'), score);
      setStat(s2l, s2v, T('gs.fourline.statMoves'), moves);
      setStat(s3l, s3v, T('gs.fourline.statTime'), elapsed + 's');
    }

    if (mode === 'pvp') {
      ovNote.innerHTML = T('gs.fourline.pvpNoRank');
      ovNote.classList.remove('hidden');
      recordEl.classList.add('hidden');
    } else if (mode === 'daily') {
      ovNote.innerHTML = T('gs.fourline.dailyNote');
      ovNote.classList.remove('hidden');
      if (isNewDaily) {
        recordEl.innerHTML = smallIcon('trophy') + T('gs.fourline.dailyNewBest');
        recordEl.classList.remove('hidden');
      } else recordEl.classList.add('hidden');
    } else {
      ovNote.classList.add('hidden');
      if (isNew) {
        recordEl.innerHTML = smallIcon('trophy') + T('gs.fourline.newBest');
        recordEl.classList.remove('hidden');
      } else recordEl.classList.add('hidden');
    }

    var againText = outcome === 'dailyfail' ? T('gs.fourline.dailyRetry') : T('gs.fourline.again');
    againBtn.innerHTML = smallIcon('again') + againText;
    overlayEl.classList.remove('hidden');
    updateHud();
    updateBestUI();
    later(function () {
      if (!overlayEl.classList.contains('hidden') && againBtn.focus) againBtn.focus();
    }, 80);
  }

  function scheduleDailyReply() {
    if (mode !== 'daily' || over || paused) return;
    if (!daily.puzzle || daily.step >= daily.puzzle.line.length) {
      endRound('dailyfail', 0, null);
      return;
    }
    var col = daily.puzzle.line[daily.step];
    later(function () {
      if (mode !== 'daily' || over || paused) return;
      thinking = false;
      commitMove(col, 2);
    }, 520);
  }

  /* ================= AI：四档递进 ================= */
  var WIN_SCORE = 900000;
  var searchAborted = false;
  function validColsB(bd) {
    var out = [];
    for (var c = 0; c < COLS; c++) if (!bd[0][c]) out.push(c);
    return out;
  }
  function getRowB(bd, col) { for (var r = ROWS - 1; r >= 0; r--) if (!bd[r][col]) return r; return -1; }
  function checkWinB(bd, r, c, p) {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var d = 0; d < dirs.length; d++) {
      var cnt = 1, dr = dirs[d][0], dc = dirs[d][1];
      for (var s = 1; s < 4; s++) { var nr = r + dr * s, nc = c + dc * s; if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS || bd[nr][nc] !== p) break; cnt++; }
      for (var s2 = 1; s2 < 4; s2++) { var pr = r - dr * s2, pc = c - dc * s2; if (pr < 0 || pc < 0 || pr >= ROWS || pc >= COLS || bd[pr][pc] !== p) break; cnt++; }
      if (cnt >= 4) return true;
    }
    return false;
  }
  function findWinColB(bd, p) {
    for (var c = 0; c < COLS; c++) {
      var row = getRowB(bd, c);
      if (row < 0) continue;
      bd[row][c] = p;
      var won = checkWinB(bd, row, c, p);
      bd[row][c] = 0;
      if (won) return c;
    }
    return -1;
  }
  function grantsOppWinB(bd, col, p) {
    var row = getRowB(bd, col);
    if (row < 0) return true;
    bd[row][col] = p;
    var w = findWinColB(bd, 3 - p);
    bd[row][col] = 0;
    return w >= 0;
  }
  function randomValid() {
    var valid = validColsB(board);
    return valid.length ? valid[Math.floor(Math.random() * valid.length)] : -1;
  }
  function openingPick() {
    if (mode === 'easy') return OPEN_COLS[Math.floor(Math.random() * OPEN_COLS.length)];
    return 3;
  }
  function chooseEasy(p) {
    if (moves === 0) return openingPick();
    return randomValid();
  }
  function chooseMedium(p) {
    if (moves === 0) return openingPick();
    var win = findWinColB(board, p); if (win >= 0) return win;
    var block = findWinColB(board, 3 - p); if (block >= 0) return block;
    var order = [3, 2, 4, 1, 5, 0, 6];
    for (var i = 0; i < order.length; i++) {
      var col = order[i];
      if (board[0][col]) continue;
      if (!grantsOppWinB(board, col, p)) return col;
    }
    return randomValid();
  }

  function scoreWindow(w, p) {
    var me = 0, op = 0, empty = 0, opp = 3 - p;
    for (var i = 0; i < w.length; i++) {
      if (w[i] === p) me++; else if (w[i] === opp) op++; else if (w[i] === 0) empty++;
    }
    if (me === 4) return 1000000;
    if (op === 4) return -1000000;
    if (me === 3 && empty === 1) return 260;
    if (op === 3 && empty === 1) return -320;
    if (me === 2 && empty === 2) return 18;
    if (op === 2 && empty === 2) return -20;
    return 0;
  }
  function countWinsB(bd, p) {
    var n = 0;
    for (var c = 0; c < COLS; c++) {
      var row = getRowB(bd, c);
      if (row < 0) continue;
      bd[row][c] = p;
      if (checkWinB(bd, row, c, p)) n++;
      bd[row][c] = 0;
    }
    return n;
  }
  function countOpenThreesB(bd, p) {
    var opp = 3 - p, n = 0;
    function scan(list) {
      var a = list[0], b = list[1], c = list[2], d = list[3], e = list[4];
      if (a === 0 && e === 0 && b === p && c === p && d === p) n++;
      if (a !== opp && b !== opp && c !== opp && d !== opp && e !== opp) {
        var pc = (a === p ? 1 : 0) + (b === p ? 1 : 0) + (c === p ? 1 : 0) + (d === p ? 1 : 0) + (e === p ? 1 : 0);
        if (pc === 3 && (a === 0 || b === 0 || c === 0 || d === 0 || e === 0)) {
          /* 5 格内三子含断点：视为冲四潜力，轻量加分 */
          n += 0.35;
        }
      }
    }
    for (var r = 0; r < ROWS; r++) for (var c0 = 0; c0 < COLS - 4; c0++) scan([bd[r][c0], bd[r][c0 + 1], bd[r][c0 + 2], bd[r][c0 + 3], bd[r][c0 + 4]]);
    for (var c1 = 0; c1 < COLS; c1++) for (var r1 = 0; r1 < ROWS - 4; r1++) scan([bd[r1][c1], bd[r1 + 1][c1], bd[r1 + 2][c1], bd[r1 + 3][c1], bd[r1 + 4][c1]]);
    for (var r2 = 0; r2 < ROWS - 4; r2++) for (var c2 = 0; c2 < COLS - 4; c2++) scan([bd[r2][c2], bd[r2 + 1][c2 + 1], bd[r2 + 2][c2 + 2], bd[r2 + 3][c2 + 3], bd[r2 + 4][c2 + 4]]);
    for (var r3 = ROWS - 1; r3 >= 4; r3--) for (var c3 = 0; c3 < COLS - 4; c3++) scan([bd[r3][c3], bd[r3 - 1][c3 + 1], bd[r3 - 2][c3 + 2], bd[r3 - 3][c3 + 3], bd[r3 - 4][c3 + 4]]);
    return n;
  }
  function evaluateB(bd, p, strong) {
    var score = 0, r, c;
    for (r = 0; r < ROWS; r++) {
      if (bd[r][3] === p) score += 8; else if (bd[r][3] === 3 - p) score -= 8;
      if (bd[r][2] === p) score += 4; else if (bd[r][2] === 3 - p) score -= 4;
      if (bd[r][4] === p) score += 4; else if (bd[r][4] === 3 - p) score -= 4;
    }
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS - 3; c++) score += scoreWindow([bd[r][c], bd[r][c + 1], bd[r][c + 2], bd[r][c + 3]], p);
    }
    for (r = 0; r < ROWS - 3; r++) {
      for (c = 0; c < COLS; c++) score += scoreWindow([bd[r][c], bd[r + 1][c], bd[r + 2][c], bd[r + 3][c]], p);
    }
    for (r = 0; r < ROWS - 3; r++) {
      for (c = 0; c < COLS - 3; c++) score += scoreWindow([bd[r][c], bd[r + 1][c + 1], bd[r + 2][c + 2], bd[r + 3][c + 3]], p);
    }
    for (r = 3; r < ROWS; r++) {
      for (c = 0; c < COLS - 3; c++) score += scoreWindow([bd[r][c], bd[r - 1][c + 1], bd[r - 2][c + 2], bd[r - 3][c + 3]], p);
    }
    if (strong) {
      var meW = countWinsB(bd, p), opW = countWinsB(bd, 3 - p);
      var meT = countOpenThreesB(bd, p), opT = countOpenThreesB(bd, 3 - p);
      /* 双威胁检测：同时存在两个可成四的落点，价值极高 */
      score += meW >= 2 ? 5200 : meW * 900;
      score -= opW >= 2 ? 6400 : opW * 1050;
      score += meT * 190 - opT * 230;
    }
    return score;
  }

  var searchNodes = 0;
  function negamax(bd, depth, alpha, beta, player, deadline, strong) {
    searchNodes++;
    if ((searchNodes & 255) === 0 && deadline && Date.now() > deadline) {
      searchAborted = true;
      return 0;
    }
    var valid = validColsB(bd);
    if (!valid.length) return 0;
    if (depth === 0) return evaluateB(bd, player, strong);
    var opp = 3 - player, order = [3, 2, 4, 1, 5, 0, 6], best = -Infinity;
    for (var i = 0; i < order.length; i++) {
      var col = order[i];
      if (bd[0][col]) continue;
      var row = getRowB(bd, col);
      bd[row][col] = player;
      var won = checkWinB(bd, row, col, player);
      var s = won ? WIN_SCORE + depth : -negamax(bd, depth - 1, -beta, -alpha, opp, deadline, strong);
      bd[row][col] = 0;
      if (searchAborted) return 0;
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function rootOrder(bd, p) {
    var cols = validColsB(bd), scored = [];
    for (var i = 0; i < cols.length; i++) {
      var col = cols[i], row = getRowB(bd, col);
      bd[row][col] = p;
      var win = checkWinB(bd, row, col, p);
      var myThreats = countWinsB(bd, p), oppThreats = countWinsB(bd, 3 - p);
      bd[row][col] = 0;
      var s = (win ? 100000000 : 0) + myThreats * 14000 - oppThreats * 9000 + (col === 3 ? 20 : (col === 2 || col === 4 ? 8 : 0));
      scored.push({ col: col, s: s });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    var out = [];
    for (var j = 0; j < scored.length; j++) out.push(scored[j].col);
    return out;
  }
  function searchBestMove(bd, p, maxDepth, budget) {
    var order = rootOrder(bd, p);
    var best = order.length ? order[0] : -1;
    if (!order.length) return -1;
    var deadline = Date.now() + budget;
    var bestScore = -Infinity;
    for (var depth = 2; depth <= maxDepth; depth++) {
      searchAborted = false;
      searchNodes = 0;
      var localBest = -1, localScore = -Infinity;
      for (var i = 0; i < order.length; i++) {
        var col = order[i];
        if (bd[0][col]) continue;
        var row = getRowB(bd, col);
        bd[row][col] = p;
        var s;
        if (checkWinB(bd, row, col, p)) s = WIN_SCORE + depth;
        else s = -negamax(bd, depth - 1, -Infinity, Infinity, 3 - p, deadline, true);
        bd[row][col] = 0;
        if (searchAborted) break;
        if (s > localScore) { localScore = s; localBest = col; }
      }
      if (searchAborted) break;
      if (localBest >= 0) { best = localBest; bestScore = localScore; }
      if (bestScore >= WIN_SCORE) break;
    }
    return best;
  }
  function chooseHard(p) {
    if (moves === 0) return openingPick();
    var win = findWinColB(board, p); if (win >= 0) return win;
    var order = [3, 2, 4, 1, 5, 0, 6];
    var bestScore = -Infinity, candidates = [], deadline = Date.now() + 180;
    for (var i = 0; i < order.length; i++) {
      var col = order[i];
      if (board[0][col]) continue;
      var row = getRowB(board, col);
      board[row][col] = p;
      searchAborted = false;
      var s = checkWinB(board, row, col, p) ? WIN_SCORE : -negamax(board, HARD_DEPTH - 1, -Infinity, Infinity, 3 - p, deadline, false);
      board[row][col] = 0;
      if (searchAborted) break;
      if (s > bestScore) { bestScore = s; candidates = [col]; }
      else if (s === bestScore) candidates.push(col);
    }
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : randomValid();
  }
  function chooseExpert(p) {
    if (moves === 0) return openingPick();
    var win = findWinColB(board, p); if (win >= 0) return win;
    var block = findWinColB(board, 3 - p); if (block >= 0) return block;
    var col = searchBestMove(board, p, 10, EXPERT_BUDGET);
    if (col >= 0 && !board[0][col]) return col;
    return randomValid();
  }
  function chooseAI(p) {
    if (mode === 'easy') return chooseEasy(p);
    if (mode === 'expert') return chooseExpert(p);
    if (mode === 'hard') return chooseHard(p);
    return chooseMedium(p);
  }
  function aiMove() {
    if (over || pickerVisible || paused || mode === 'pvp' || mode === 'daily' || turn !== aiPlayer) { thinking = false; return; }
    var col = -1;
    try { col = chooseAI(aiPlayer); } catch (e) { col = -1; }
    if (col < 0 || col >= COLS || lowest(col) < 0) col = randomValid();
    if (col < 0) { thinking = false; endRound('draw', 0, null); return; }
    thinking = false;
    commitMove(col, aiPlayer);
  }

  /* ================= 事件 ================= */
  function drop(col) {
    if (!canHumanPlay()) return;
    if (isOpening() && !openingAllowed(col)) {
      audio('error');
      setMsg(T('gs.fourline.firstMoveBlocked'), 'warn');
      return;
    }
    selectedCol = col;
    ghostCol = col;
    pendingCol = -1;
    if (lowest(col) < 0) {
      audio('error');
      setMsg(T('gs.fourline.colFull'), 'warn');
      later(function () {
        if (!over && !pickerVisible && !paused && canHumanPlay()) setTurnMsg();
      }, 900);
      return;
    }
    commitMove(col, turn);
  }
  function eventCol(e) {
    var el = e.target && e.target.closest ? e.target.closest('.c4-cell') : null;
    if (!el || !boardEl.contains(el)) return -1;
    return parseInt(el.getAttribute('data-col'), 10);
  }
  function previewAt(col) {
    selectedCol = col;
    ghostCol = col;
    refreshPreview();
  }

  boardEl.addEventListener('pointermove', function (e) {
    if (!canHumanPlay()) return;
    var col = eventCol(e);
    if (col >= 0 && col !== ghostCol) previewAt(col);
  });
  boardEl.addEventListener('pointerdown', function (e) {
    if (!canHumanPlay()) return;
    var col = eventCol(e);
    if (col < 0) return;
    e.preventDefault();
    pendingCol = col;
    previewAt(col);
  });
  boardEl.addEventListener('pointerup', function (e) {
    if (pendingCol < 0) return;
    var col = eventCol(e);
    var from = pendingCol;
    pendingCol = -1;
    if (col === from && canHumanPlay()) drop(from);
  });
  boardEl.addEventListener('pointerleave', function () {
    if (!canHumanPlay()) return;
    pendingCol = -1;
    ghostCol = selectedCol;
    refreshPreview();
  });
  boardEl.addEventListener('pointercancel', function () {
    pendingCol = -1;
    ghostCol = selectedCol;
    refreshPreview();
  });

  function moveSelection(dir) {
    if (!canHumanPlay()) return;
    if (isOpening()) {
      var nextOpen = selectedCol + dir;
      if (nextOpen < OPEN_COLS[0]) nextOpen = OPEN_COLS[OPEN_COLS.length - 1];
      if (nextOpen > OPEN_COLS[OPEN_COLS.length - 1]) nextOpen = OPEN_COLS[0];
      selectedCol = nextOpen;
    } else {
      selectedCol = (selectedCol + dir + COLS) % COLS;
    }
    ghostCol = selectedCol;
    refreshPreview();
    audio('move');
  }

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (document.querySelector('.tut-overlay')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (paused) resumeGame();
      else if (overlayEl.classList.contains('hidden') && !pickerVisible && !over) pauseGame();
      return;
    }
    if (!overlayEl.classList.contains('hidden')) return;
    if (pickerVisible || over || paused) return;
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      e.preventDefault();
      if (e.repeat) return;
      moveSelection(-1);
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      e.preventDefault();
      if (e.repeat) return;
      moveSelection(1);
    } else if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (e.repeat || !canHumanPlay()) return;
      ghostCol = selectedCol;
      refreshPreview();
      drop(selectedCol);
    }
  });

  for (var bi = 0; bi < modeBtns.length; bi++) {
    modeBtns[bi].addEventListener('click', function (e) {
      var m = e.currentTarget.getAttribute('data-mode');
      if (e.currentTarget.blur) e.currentTarget.blur();
      startRound(m, true);
    });
  }
  root.querySelector('#c4-open-picker').addEventListener('click', function () { audio('back'); showPicker(); });
  root.querySelector('#c4-pause-btn').addEventListener('click', function () {
    if (paused) resumeGame(); else pauseGame();
  });
  root.querySelector('#c4-resume').addEventListener('click', resumeGame);
  root.querySelector('#c4-pause-restart').addEventListener('click', function () { startRound(mode, false); });
  root.querySelector('#c4-pause-mode').addEventListener('click', function () { audio('back'); showPicker(); });
  againBtn.addEventListener('click', function () { startRound(mode, false); });
  root.querySelector('#c4-change-mode').addEventListener('click', function () { audio('back'); showPicker(); });

  /* ================= 暂停 ================= */
  function pauseGame() {
    if (pickerVisible || over || paused || !overlayEl.classList.contains('hidden')) return;
    paused = true;
    pauseStart = Date.now();
    resumeAI = mode !== 'pvp' && mode !== 'daily' && turn === aiPlayer;
    resumeDaily = mode === 'daily' && turn === 2;
    clearTimers();
    pauseEl.classList.remove('hidden');
    audio('ui');
  }
  function resumeGame() {
    if (!paused) return;
    pausedMs += Date.now() - pauseStart;
    paused = false;
    pauseEl.classList.add('hidden');
    if (resumeAI) {
      resumeAI = false;
      thinking = true;
      setThinkingMsg();
      refreshPreview();
      later(aiMove, 300);
    } else if (resumeDaily) {
      resumeDaily = false;
      thinking = true;
      setDailyThinkingMsg();
      refreshPreview();
      scheduleDailyReply();
    } else {
      setTurnMsg();
      refreshPreview();
    }
    audio('ui');
  }

  /* ================= 开局 / 重开 ================= */
  function clearBoardVisuals() {
    boardEl.classList.remove('lose', 'draw', 'fail', 'opening');
    lineLayer.innerHTML = '';
    stageEl.classList.remove('c4-shake');
    resetFx();
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.remove('hl', 'sel', 'ok-col', 'dim-col');
      cells[i]._piece.removeAttribute('style');
      cells[i]._piece.className = 'c4-piece';
      cells[i]._ghost.className = 'c4-ghost';
      var old = cells[i].querySelectorAll('.c4-ripple');
      for (var ri = 0; ri < old.length; ri++) if (old[ri].parentNode) old[ri].parentNode.removeChild(old[ri]);
    }
  }
  function setupDailyPuzzle() {
    daily.index = dailyIndex();
    daily.puzzle = DAILY_PUZZLES[daily.index];
    daily.step = 0;
    daily.playerMoves = 0;
    daily.maxMoves = Math.ceil(daily.puzzle.line.length / 2);
    daily.fresh = false;
    boardEmpty();
    var rows = daily.puzzle.rows;
    for (var r = 0; r < ROWS; r++) {
      var rowStr = rows[r] || '.......';
      for (var c = 0; c < COLS; c++) {
        var v = parseInt(rowStr.charAt(c), 10);
        board[r][c] = (v === 1 || v === 2) ? v : 0;
        if (board[r][c]) placePiece(r, c, board[r][c], false);
      }
    }
    firstPlayer = 1;
    humanPlayer = 1;
    aiPlayer = 2;
    firstIsHuman = true;
    turn = 1;
  }

  function startRound(m, resetSession) {
    clearTimers();
    mode = m || mode;
    lastMode = mode;
    pickerVisible = false;
    paused = false;
    pauseStart = 0;
    resumeAI = false;
    resumeDaily = false;
    pauseEl.classList.add('hidden');
    pickEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    overlayEl.classList.add('hidden');
    if (resetSession) {
      streak = 0; roundNo = 0; sessionWins = 0; sessionRounds = 0; lastScore = 0;
    }
    roundNo++;
    clearBoardVisuals();
    boardEmpty();
    if (mode === 'daily') {
      setupDailyPuzzle();
    } else {
      if (mode === 'pvp') {
        firstPlayer = (roundNo % 2 === 1) ? 1 : 2;
        humanPlayer = 0;
        aiPlayer = 0;
      } else {
        firstIsHuman = (roundNo % 2 === 1);
        humanPlayer = firstIsHuman ? 1 : 2;
        aiPlayer = 3 - humanPlayer;
        firstPlayer = 1;
      }
      turn = firstPlayer;
    }
    over = false;
    thinking = false;
    moves = 0;
    lastScore = 0;
    pausedMs = 0;
    startTs = Date.now();
    selectedCol = 3;
    ghostCol = 3;
    pendingCol = -1;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    updateHud();
    updateBestUI();
    if (mode === 'daily') {
      setTurnMsg();
      refreshPreview();
    } else if (mode === 'pvp') {
      setTurnMsg();
      refreshPreview();
    } else if (turn === aiPlayer) {
      thinking = true;
      setThinkingMsg();
      refreshPreview();
      later(aiMove, AI_DELAY[mode] || 560);
    } else {
      setTurnMsg();
      refreshPreview();
    }
    later(resizeFx, 30);
    audio('ui');
  }

  function showPicker() {
    clearTimers();
    pickerVisible = true;
    paused = false;
    over = true;
    resumeAI = false;
    resumeDaily = false;
    pendingCol = -1;
    ghostCol = -1;
    pauseEl.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    pickEl.classList.remove('hidden');
    gameEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    setPickerActive();
    updateBestUI();
    resetFx();
  }

  window.GAME_RESTART = function () {
    if (pickerVisible) startRound(lastMode, true);
    else startRound(mode, false);
  };

  window.addEventListener('resize', function () { resizeFx(); });

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.fourline.helpText');
  root.appendChild(hd);

  /* 初始状态：模式选择 */
  boardEmpty();
  setPickerActive();
  updateBestUI();
  resizeFx();

  /* ================= SIM-HARNESS（仅 ?sim=1，只读仿真，不碰 UI/存档） ================= */
  /* SIM-HARNESS：AI 强度量化实验入口。
     复用纯棋盘函数 chooseEasy/chooseMedium/chooseHard/chooseExpert、checkWinB、
     findWinColB、copyBoard 等；只在调用 AI 的瞬间临时把闭包内的 board/moves/mode
     指向仿真棋盘，调用结束立即还原，正常游玩不受影响。
     为保证实验可复现，调用期间用固定种子 LCG 替换 Math.random。 */
  var SIM_SEED = 20261104;
  var SIM_OPEN = [2, 3, 4];
  var SIM_MATCHUPS = [
    { name: 'expert_vs_easy', other: 'easy', games: 20 },
    { name: 'expert_vs_medium', other: 'medium', games: 20 }
  ];
  var simSeedState = SIM_SEED >>> 0;
  function simRandom() {
    simSeedState = (simSeedState * 1664525 + 1013904223) >>> 0;
    return simSeedState / 4294967296;
  }
  function simEmpty() {
    var b = [];
    for (var r = 0; r < ROWS; r++) { b[r] = []; for (var c = 0; c < COLS; c++) b[r][c] = 0; }
    return b;
  }
  function simPick(modeName, p, gb, ply) {
    var saveBoard = board, saveMoves = moves, saveMode = mode;
    var saveRandom = Math.random;
    var col = -1;
    board = gb; moves = ply; mode = modeName;
    Math.random = simRandom;
    try {
      if (modeName === 'expert') col = chooseExpert(p);
      else if (modeName === 'hard') col = chooseHard(p);
      else if (modeName === 'medium') col = chooseMedium(p);
      else col = chooseEasy(p);
    } catch (e) { col = -1; }
    Math.random = saveRandom;
    board = saveBoard; moves = saveMoves; mode = saveMode;
    if (col < 0 || col >= COLS || gb[0][col]) {
      var valid = [];
      for (var c = 0; c < COLS; c++) if (!gb[0][c]) valid.push(c);
      col = valid.length ? valid[0] : -1;
    }
    if (ply === 0) {
      var ok = false;
      for (var i = 0; i < SIM_OPEN.length; i++) if (col === SIM_OPEN[i]) ok = true;
      if (!ok) col = 3;
    }
    return col;
  }
  /* 以固定种子构造 4 手开局，使每局局面不同；同一开局再用两种颜色各下一局，
     用“换色双局”抵消先手优势，避免同一局面重复采样。 */
  function simOpening(seed) {
    var st = seed >>> 0;
    function rnd() { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; }
    var gb = simEmpty(), ply = 0, cols = [];
    while (ply < 4) {
      var p = (ply % 2 === 0) ? 1 : 2;
      var cand = [];
      for (var c = 0; c < COLS; c++) {
        if (gb[0][c]) continue;
        if (ply === 0 && SIM_OPEN.indexOf(c) < 0) continue;
        if (grantsOppWinB(gb, c, p)) continue;
        cand.push(c);
      }
      if (!cand.length) return null;
      var col = cand[Math.floor(rnd() * cand.length)];
      var row = getRowB(gb, col);
      gb[row][col] = p;
      cols.push(col);
      ply++;
      if (checkWinB(gb, row, col, p)) return null;
    }
    return { board: gb, cols: cols, ply: ply };
  }
  function simRun(matchIndex) {
    var res = window.__c4sim;
    if (matchIndex >= SIM_MATCHUPS.length) {
      res.running = false;
      res.finishedAt = new Date().toISOString();
      /* 只读结果：window.__c4sim */
      return;
    }
    var spec = SIM_MATCHUPS[matchIndex];
    var m = {
      name: spec.name, games: spec.games, winsExpert: 0, winsOther: 0, draws: 0,
      avgMoves: 0, movesPerGame: [], firstPlayerPerGame: [], winnerPerGame: [],
      winsExpertAsFirst: 0, winsExpertAsSecond: 0,
      avgMovesExpertWins: 0, avgMovesOtherWins: 0, openings: []
    };
    res.matchups.push(m);
    var gameIndex = 0, cachedIdx = -1, cachedOp = null;
    var expertWinPlies = [], otherWinPlies = [];
    function startGame() {
      if (gameIndex >= spec.games) {
        var sum = 0;
        for (var i2 = 0; i2 < m.movesPerGame.length; i2++) sum += m.movesPerGame[i2];
        m.avgMoves = m.movesPerGame.length ? Math.round(sum / m.movesPerGame.length * 10) / 10 : 0;
        m.avgMovesExpertWins = expertWinPlies.length ? Math.round(expertWinPlies.reduce(function (a, b) { return a + b; }, 0) / expertWinPlies.length * 10) / 10 : 0;
        m.avgMovesOtherWins = otherWinPlies.length ? Math.round(otherWinPlies.reduce(function (a, b) { return a + b; }, 0) / otherWinPlies.length * 10) / 10 : 0;
        simRun(matchIndex + 1);
        return;
      }
      var oi = Math.floor(gameIndex / 2);
      var expertFirst = (gameIndex % 2 === 0);
      if (cachedIdx !== oi) {
        cachedOp = simOpening(SIM_SEED + matchIndex * 104729 + oi * 7919);
        cachedIdx = oi;
        m.openings.push(cachedOp ? cachedOp.cols.join('') : null);
      }
      if (!cachedOp) { gameIndex += 2; setTimeout(startGame, 0); return; }
      var expertColor = expertFirst ? 1 : 2;
      var gb = cachedOp.board.map(function (r) { return r.slice(); });
      var ply = cachedOp.ply;
      m.firstPlayerPerGame.push(expertFirst ? 'expert' : spec.other);
      /* 每局用不同随机种子（用于平局列/简单档），避免同局重复 */
      simSeedState = (SIM_SEED + gameIndex * 2654435761 + matchIndex * 40503) >>> 0;
      function move() {
        if (ply >= ROWS * COLS) {
          m.draws++; m.winnerPerGame.push('draw'); m.movesPerGame.push(ply);
          gameIndex++; setTimeout(startGame, 0);
          return;
        }
        var p = (ply % 2 === 0) ? 1 : 2;
        var who = (p === expertColor) ? 'expert' : spec.other;
        var col = simPick(who === 'expert' ? 'expert' : who, p, gb, ply);
        if (col < 0) {
          m.draws++; m.winnerPerGame.push('draw'); m.movesPerGame.push(ply);
          gameIndex++; setTimeout(startGame, 0);
          return;
        }
        var row = getRowB(gb, col);
        gb[row][col] = p;
        ply++;
        if (checkWinB(gb, row, col, p)) {
          if (p === expertColor) {
            m.winsExpert++;
            if (expertFirst) m.winsExpertAsFirst++; else m.winsExpertAsSecond++;
            expertWinPlies.push(ply);
          } else {
            m.winsOther++;
            otherWinPlies.push(ply);
          }
          m.winnerPerGame.push(p === 1 ? 'red' : 'yellow');
          m.movesPerGame.push(ply);
          gameIndex++;
          setTimeout(startGame, 0);
          return;
        }
        setTimeout(move, 0);
      }
      setTimeout(move, 0);
    }
    startGame();
  }
  if (/(?:^|[?&])sim=1(?:&|$)/.test(window.location.search)) {
    var simRes = {
      sim: true, seed: SIM_SEED, running: true,
      startedAt: new Date().toISOString(), matchups: []
    };
    window.__c4sim = simRes;
    setTimeout(function () { simRun(0); }, 0);
  }

  /* 调试钩子：仅 ?qa=1 时挂载，正常访问不暴露可篡改状态的入口 */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) window.__qa = {
    start: function (m) { startRound(m || 'pvp', true); },
    state: function () {
      return { mode: mode, turn: turn, over: over, paused: paused, moves: moves,
        firstPlayer: firstPlayer, humanPlayer: humanPlayer,
        board: board.map(function (row) { return row.slice(); }) };
    },
    set: function (g, t) {
      startRound(mode, false);
      boardEmpty();
      var count = 0;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          board[r][c] = (g[r] && g[r][c]) ? g[r][c] : 0;
          if (board[r][c]) count++;
          placePiece(r, c, board[r][c], false);
        }
      }
      turn = t || humanPlayer || 1; over = false; thinking = false; paused = false; moves = count;
      refreshPreview(); updateHud();
    },
    drop: function (c) { drop(c); }
  };
})();
