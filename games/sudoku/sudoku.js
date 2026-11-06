/* 数独 Sudoku —— P2 逻辑解谜旗舰
   技巧分级（唯余 / 隐性唯一 / 进阶）、自动候选、分级提示、
   经典与 X 对角线变体、断点续玩、完成演出与结算。 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.sudoku.tut1t'), d: T('gs.sudoku.tut1') },
  { t: T('gs.sudoku.tut2t'), d: T('gs.sudoku.tut2') },
  { t: T('gs.sudoku.tut3t'), d: T('gs.sudoku.tut3') },
  { t: T('gs.sudoku.tut4t'), d: T('gs.sudoku.tut4') }
  ];

(function () {
  var root = document.getElementById('game-root');
  var N = 9, startTs = Date.now(), over = false, sel = null;
  var DIFFS = { easy: 36, normal: 45, hard: 52, expert: 58 };
  var DIFF_ORDER = ['easy', 'normal', 'hard', 'expert'];
  var difficulty = 'normal';
  var variant = 'classic'; /* classic | x */
  var puzzle = [], solution = [], fixed = [], cells = [];
  var notes = [], noteMode = false, autoNotes = false;
  var hints = 0, techTier = 'basic';
  var errors = 0, errEl = null;

  /* 种子化 PRNG（每日一题用：同一天同一题） */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rng) {
    rng = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function valid(g, r, c, n) {
    for (var i = 0; i < 9; i++) { if (g[r][i] === n) return false; if (g[i][c] === n) return false; }
    var br = r - r % 3, bc = c - c % 3;
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) if (g[br + a][bc + b] === n) return false;
    if (variant === 'x') {
      if (r === c) { for (var d = 0; d < 9; d++) if (g[d][d] === n) return false; }
      if (r + c === 8) { for (var e = 0; e < 9; e++) if (g[e][8 - e] === n) return false; }
    }
    return true;
  }
  function fill(g, r, c, rng) {
    if (r === 9) return true;
    var nr = c === 8 ? r + 1 : r, nc = c === 8 ? 0 : c + 1;
    if (g[r][c] !== 0) return fill(g, nr, nc, rng);
    var nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    for (var k = 0; k < 9; k++) {
      var n = nums[k];
      if (valid(g, r, c, n)) { g[r][c] = n; if (fill(g, nr, nc, rng)) return true; g[r][c] = 0; }
    }
    return false;
  }
  /* 回溯计数解（limit 上限，用于挖洞后唯一解校验） */
  function countSolutions(g, limit) {
    var cnt = 0;
    function search() {
      if (cnt >= limit) return;
      var br = -1, bc = -1;
      for (var r = 0; r < 9 && br < 0; r++) for (var c = 0; c < 9; c++) if (g[r][c] === 0) { br = r; bc = c; break; }
      if (br < 0) { cnt++; return; }
      for (var n = 1; n <= 9; n++) {
        if (valid(g, br, bc, n)) { g[br][bc] = n; search(); g[br][bc] = 0; }
        if (cnt >= limit) return;
      }
    }
    search();
    return cnt;
  }
  function generate(holes, rng) {
    rng = rng || Math.random;
    var g = []; for (var i = 0; i < 9; i++) { g[i] = []; for (var j = 0; j < 9; j++) g[i][j] = 0; }
    fill(g, 0, 0, rng);
    var sol = g.map(function (row) { return row.slice(); });
    var pos = [];
    for (var a = 0; a < 81; a++) pos.push(a);
    shuffle(pos, rng);
    // 挖洞并保证唯一解：挖掉后若出现多解则恢复该格
    var dug = 0;
    for (var h = 0; h < holes && dug < 81; h++) {
      var r = Math.floor(pos[h] / 9), c = pos[h] % 9;
      var saved = g[r][c];
      g[r][c] = 0;
      if (countSolutions(g, 2) > 1) g[r][c] = saved;
      else dug++;
    }
    return { puzzle: g, solution: sol };
  }
  function resetNotes() {
    notes = [];
    for (var nr = 0; nr < 9; nr++) { notes[nr] = []; for (var nc = 0; nc < 9; nc++) notes[nr][nc] = []; }
  }

  /* ---------- 技巧分析 ---------- */
  function candidates(g, r, c) {
    var list = [];
    if (g[r][c]) return list;
    for (var n = 1; n <= 9; n++) if (valid(g, r, c, n)) list.push(n);
    return list;
  }
  function findStep(g) {
    var r, c, n;
    /* 1) 唯余法：候选只剩一个 */
    for (r = 0; r < 9; r++) for (c = 0; c < 9; c++) {
      if (!g[r][c]) {
        var list = candidates(g, r, c);
        if (list.length === 1) return { r: r, c: c, n: list[0], tech: 'naked' };
      }
    }
    /* 2) 隐性唯一：某单元内某数字只有一个落点 */
    for (var unit = 0; unit < 27; unit++) {
      var kind = unit < 9 ? 'row' : (unit < 18 ? 'col' : 'box');
      var idx = unit % 9;
      for (n = 1; n <= 9; n++) {
        var spots = [];
        for (var k = 0; k < 9; k++) {
          if (kind === 'row') { r = idx; c = k; }
          else if (kind === 'col') { r = k; c = idx; }
          else { r = Math.floor(idx / 3) * 3 + Math.floor(k / 3); c = (idx % 3) * 3 + (k % 3); }
          if (!g[r][c] && valid(g, r, c, n) && candidates(g, r, c).indexOf(n) >= 0) spots.push({ r: r, c: c });
        }
        if (spots.length === 1) return { r: spots[0].r, c: spots[0].c, n: n, tech: 'hidden', unit: kind };
      }
    }
    return null;
  }
  /* 只用唯余/隐性唯一能推到哪一步：用于技巧分级标签 */
  function ratePuzzle(pz) {
    var g = pz.map(function (row) { return row.slice(); });
    var steps = 0;
    while (steps < 120) {
      var st = findStep(g);
      if (!st) break;
      g[st.r][st.c] = st.n;
      steps++;
    }
    for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) if (!g[r][c]) return 'advanced';
    return 'basic';
  }
  function isFilled(g) {
    for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) if (!g[r][c]) return false;
    return true;
  }

  var dailyMode = false; // 当前是否每日一题（解完计入今日破译中心）
  function applyGen(gen, dailyMsg) {
    clearSave();
    puzzle = gen.puzzle; solution = gen.solution;
    fixed = puzzle.map(function (row) { return row.map(function (v) { return v !== 0; }); });
    resetNotes();
    startTs = Date.now(); over = false; sel = null; errors = 0; hints = 0;
    techTier = ratePuzzle(puzzle);
    autoNotes = false;
    if (errEl) errEl.textContent = '0';
    msg.textContent = dailyMsg || '';
    msg.style.color = '';
    if (overlay) overlay.classList.add('hidden');
    board.classList.remove('won');
    syncToolUi();
    renderBoard(); highlight();
    updatePadCounts();
    boardWrap.scrollLeft = 0; boardWrap.scrollTop = 0;
    setZoomVal(zoomVal, { force: true });
  }
  function newRandom() {
    dailyMode = false;
    var gen = generate(DIFFS[difficulty]);
    applyGen(gen, '');
  }
  function newDaily() {
    dailyMode = true;
    var seed = new Date().getFullYear() * 10000 + (new Date().getMonth() + 1) * 100 + new Date().getDate();
    var gen = generate(DIFFS.normal, mulberry32(seed)); // 固定难度：每日题仅由日期决定（全球同题）
    applyGen(gen, T('gs.sudoku.dailyMsg').replace('{n}', seed));
  }

  var wrap = document.createElement('div');
  wrap.className = 'su-wrap';
  wrap.innerHTML =
    '<div class="su-top">' +
    '  <span id="su-time">00:00</span>' +
    '  <span class="su-tier" id="su-tier"></span>' +
    '  <span class="su-err">✗ <span id="su-err">0</span></span>' +
    '  <span class="su-hintct"><i class="su-ic-dot"></i><span id="su-hintct">0</span></span>' +
    '  <button class="btn small" id="su-new">' + T('gs.sudoku.newBtn') + '</button>' +
    '</div>' +
    '<div class="su-boardwrap" id="su-boardwrap"><div class="su-board" id="su-board"></div></div>' +
    '<div class="su-zoomers" id="su-zoomers">' +
    '  <button id="su-zout" aria-label="缩小棋盘">−</button>' +
    '  <button id="su-z1" class="selected">1:1</button>' +
    '  <button id="su-zin" aria-label="放大棋盘">＋</button>' +
    '  <span class="su-zlbl" id="su-zlbl"></span>' +
    '</div>' +
    '<div class="su-zoomtip" id="su-zoomtip"></div>' +
    '<div class="su-pad" id="su-pad"></div>' +
    '<div class="su-diffs" id="su-diffs">' +
    '  <button class="mode-btn" data-diff="easy">' + T('gs.sudoku.easy') + '</button>' +
    '  <button class="mode-btn selected" data-diff="normal">' + T('gs.sudoku.normal') + '</button>' +
    '  <button class="mode-btn" data-diff="hard">' + T('gs.sudoku.hard') + '</button>' +
    '  <button class="mode-btn" data-diff="expert">' + T('gs.sudoku.expert') + '</button>' +
    '</div>' +
    '<div class="su-tools" id="su-tools">' +
    '  <button class="mode-btn" id="su-note">' + T('gs.sudoku.noteBtn') + '</button>' +
    '  <button class="mode-btn" id="su-auto">' + T('gs.sudoku.autoBtn') + '</button>' +
    '  <button class="mode-btn" id="su-tip">' + T('gs.sudoku.hintBtn') + '</button>' +
    '  <button class="mode-btn" id="su-variant">' + T('gs.sudoku.xBtn') + '</button>' +
    '  <button class="mode-btn" id="su-daily">' + T('gs.sudoku.dailyBtn') + '</button>' +
    '</div>' +
    '<div class="su-msg" id="su-msg"></div>' +
    '<div class="su-overlay hidden" id="su-overlay">' +
    '  <div class="su-ov-card">' +
    '    <div class="su-ov-title" id="su-ov-title"></div>' +
    '    <div class="su-ov-meta" id="su-ov-meta"></div>' +
    '    <div class="su-ov-row"><div>' + T('gs.sudoku.timeLabel') + '<b id="su-ov-time">--</b></div><div class="err">' + T('gs.sudoku.errLabel') + '<b id="su-ov-err">0</b></div><div>' + T('gs.sudoku.hintLabel') + '<b id="su-ov-hint">0</b></div></div>' +
    '    <div class="su-ov-btns"><button class="btn green" id="su-ov-again">' + T('gs.sudoku.again') + '</button><button class="btn" id="su-ov-daily">' + T('gs.sudoku.dailyBtn') + '</button></div>' +
    '  </div>' +
    '</div>';
  root.appendChild(wrap);
  var board = wrap.querySelector('.su-board'),
    pad = wrap.querySelector('#su-pad'),
    timeEl = wrap.querySelector('#su-time'),
    msg = wrap.querySelector('#su-msg'),
    diffRow = wrap.querySelector('#su-diffs'),
    toolRow = wrap.querySelector('#su-tools'),
    errEl = wrap.querySelector('#su-err'),
    hintCtEl = wrap.querySelector('#su-hintct'),
    tierEl = wrap.querySelector('#su-tier'),
    keyHint = document.createElement('div');
  keyHint.className = 'su-keys-hint';
  keyHint.textContent = T('gs.sudoku.keyHint');
  pad.parentNode.insertBefore(keyHint, pad.nextSibling);
  var overlay = wrap.querySelector('#su-overlay');
  var ovTitle = wrap.querySelector('#su-ov-title');
  var ovMeta = wrap.querySelector('#su-ov-meta');
  var ovTime = wrap.querySelector('#su-ov-time');
  var ovErr = wrap.querySelector('#su-ov-err');
  var ovHint = wrap.querySelector('#su-ov-hint');

  /* ---------- 棋盘缩放（1×~1.8×）：放大后用视口内平移，页面本身不横向溢出 ----------
     采用「真实布局宽度」而非 CSS transform 缩放，
     因此命中区随格子同步变大，放大后落子 / 笔记点击天然正确。 */
  var boardWrap = wrap.querySelector('#su-boardwrap');
  var zoomTipEl = wrap.querySelector('#su-zoomtip');
  var zoomLblEl = wrap.querySelector('#su-zlbl');
  var zInBtn = wrap.querySelector('#su-zin');
  var zOutBtn = wrap.querySelector('#su-zout');
  var zOneBtn = wrap.querySelector('#su-z1');
  var ZOOM_MIN = 1, ZOOM_MAX = 1.8, ZOOM_PRESETS = [1, 1.25, 1.5, 1.8];
  var zoomVal = 1;

  function calcCellPx() {
    var first = cells[0] && cells[0][0];
    return first ? Math.round(first.getBoundingClientRect().width * 10) / 10 : 0;
  }
  function updateZoomUi() {
    if (zoomLblEl) zoomLblEl.textContent = T('gs.sudoku.zoomLbl').replace('{n}', calcCellPx());
    if (zoomTipEl) zoomTipEl.textContent = T('gs.sudoku.zoomTip');
    if (zOneBtn) zOneBtn.classList.toggle('selected', zoomVal <= 1.001);
    if (zOutBtn) zOutBtn.disabled = zoomVal <= ZOOM_MIN + 0.001;
    if (zInBtn) zInBtn.disabled = zoomVal >= ZOOM_MAX - 0.001;
  }
  function scrollRatio() {
    var maxX = Math.max(1, boardWrap.scrollWidth - boardWrap.clientWidth);
    var maxY = Math.max(1, boardWrap.scrollHeight - boardWrap.clientHeight);
    return { x: boardWrap.scrollLeft / maxX, y: boardWrap.scrollTop / maxY };
  }
  function restoreScrollRatio(r) {
    boardWrap.scrollLeft = r.x * Math.max(0, boardWrap.scrollWidth - boardWrap.clientWidth);
    boardWrap.scrollTop = r.y * Math.max(0, boardWrap.scrollHeight - boardWrap.clientHeight);
  }
  function centerOnCell(r, c) {
    var cell = cells[r] && cells[r][c];
    if (!cell) return;
    var cb = cell.getBoundingClientRect(), wb = boardWrap.getBoundingClientRect();
    boardWrap.scrollLeft += (cb.left - wb.left) - (wb.width - cb.width) / 2;
    boardWrap.scrollTop += (cb.top - wb.top) - (wb.height - cb.height) / 2;
  }
  function ensureVisible(r, c) {
    var cell = cells[r] && cells[r][c];
    if (!cell) return;
    var cb = cell.getBoundingClientRect(), wb = boardWrap.getBoundingClientRect();
    if (cb.left < wb.left) boardWrap.scrollLeft += cb.left - wb.left - 6;
    else if (cb.right > wb.right) boardWrap.scrollLeft += cb.right - wb.right + 6;
    if (cb.top < wb.top) boardWrap.scrollTop += cb.top - wb.top - 6;
    else if (cb.bottom > wb.bottom) boardWrap.scrollTop += cb.bottom - wb.bottom + 6;
  }
  function setZoomVal(v, opts) {
    v = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(v) || 1));
    v = Math.round(v * 100) / 100;
    opts = opts || {};
    if (Math.abs(v - zoomVal) < 0.001 && !opts.force) { updateZoomUi(); return; }
    var before = scrollRatio();
    zoomVal = v;
    board.style.setProperty('--su-zoom', String(zoomVal));
    updateZoomUi();
    requestAnimationFrame(function () {
      if (sel) centerOnCell(sel.r, sel.c);
      else restoreScrollRatio(before);
      updateZoomUi();
    });
  }
  function zoomStep(dir) {
    var target = zoomVal;
    if (dir > 0) {
      for (var i = 0; i < ZOOM_PRESETS.length; i++) if (ZOOM_PRESETS[i] > zoomVal + 0.01) { target = ZOOM_PRESETS[i]; break; }
      if (target === zoomVal) target = ZOOM_MAX;
    } else {
      for (var j = ZOOM_PRESETS.length - 1; j >= 0; j--) if (ZOOM_PRESETS[j] < zoomVal - 0.01) { target = ZOOM_PRESETS[j]; break; }
      if (target === zoomVal) target = ZOOM_MIN;
    }
    setZoomVal(target);
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  if (zInBtn) zInBtn.addEventListener('click', function () { zoomStep(1); });
  if (zOutBtn) zOutBtn.addEventListener('click', function () { zoomStep(-1); });
  if (zOneBtn) zOneBtn.addEventListener('click', function () { setZoomVal(1); if (Arcade.audio) Arcade.audio.play('ui'); });

  /* 双指捏合缩放 */
  var pinch = null;
  function touchDist(t) {
    var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }
  boardWrap.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) pinch = { d: touchDist(e.touches), z: zoomVal };
  }, { passive: true });
  boardWrap.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2 && pinch) {
      e.preventDefault();
      setZoomVal(pinch.z * touchDist(e.touches) / pinch.d);
    }
  }, { passive: false });
  boardWrap.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
  boardWrap.addEventListener('touchcancel', function () { pinch = null; });

  function syncToolUi() {
    var noteBtn = wrap.querySelector('#su-note');
    var autoBtn = wrap.querySelector('#su-auto');
    var varBtn = wrap.querySelector('#su-variant');
    if (noteBtn) noteBtn.classList.toggle('selected', noteMode);
    if (autoBtn) autoBtn.classList.toggle('selected', autoNotes);
    if (varBtn) {
      varBtn.classList.toggle('selected', variant === 'x');
      varBtn.textContent = variant === 'x' ? T('gs.sudoku.xOn') : T('gs.sudoku.xBtn');
    }
    if (tierEl) tierEl.textContent = T(techTier === 'basic' ? 'gs.sudoku.techBasic' : 'gs.sudoku.techAdv');
    if (hintCtEl) hintCtEl.textContent = String(hints);
  }

  /* 断点续玩（共享模块，仅存本机） */
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'sudoku',
      collect: function () {
        if (over) return null;
        return {
          puzzle: puzzle, solution: solution, fixed: fixed,
          notes: notes, noteMode: noteMode, autoNotes: autoNotes,
          difficulty: difficulty, variant: variant, hints: hints,
          dailyMode: dailyMode, errors: errors,
          day: (window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : '',
          elapsed: Math.round((Date.now() - startTs) / 1000),
          zoom: zoomVal
        };
      },
      apply: function (s) {
        if (!s || !Array.isArray(s.puzzle) || s.puzzle.length !== 9) return false;
        if (!Array.isArray(s.solution) || s.solution.length !== 9) return false;
        if (!Array.isArray(s.fixed) || s.fixed.length !== 9) return false;
        if (!Array.isArray(s.notes) || s.notes.length !== 9) return false;
        /* 每日题跨天失效：昨天的每日进度不再恢复 */
        if (s.dailyMode && s.day !== ((window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : '')) return false;
        for (var i = 0; i < 9; i++) {
          if (!Array.isArray(s.puzzle[i]) || s.puzzle[i].length !== 9) return false;
          if (!Array.isArray(s.solution[i]) || s.solution[i].length !== 9) return false;
          if (!Array.isArray(s.fixed[i]) || s.fixed[i].length !== 9) return false;
          if (!Array.isArray(s.notes[i]) || s.notes[i].length !== 9) return false;
        }
        puzzle = s.puzzle;
        solution = s.solution;
        fixed = s.fixed;
        notes = s.notes;
        noteMode = !!s.noteMode;
        autoNotes = !!s.autoNotes;
        difficulty = DIFF_ORDER.indexOf(s.difficulty) >= 0 ? s.difficulty : 'normal';
        variant = s.variant === 'x' ? 'x' : 'classic';
        hints = Math.max(0, Number(s.hints) || 0);
        dailyMode = !!s.dailyMode;
        errors = Math.max(0, Number(s.errors) || 0);
        var el = Math.max(0, Number(s.elapsed) || 0);
        techTier = ratePuzzle(puzzle);
        startTs = Date.now() - el * 1000;
        over = false;
        sel = null;
        if (errEl) errEl.textContent = String(errors);
        var btns = diffRow.getElementsByTagName('button');
        for (var b = 0; b < btns.length; b++) {
          if (btns[b].getAttribute('data-diff')) btns[b].classList.toggle('selected', btns[b].getAttribute('data-diff') === difficulty);
        }
        syncToolUi();
        msg.textContent = '';
        zoomVal = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(s.zoom) || 1));
        renderBoard();
        highlight();
        board.style.setProperty('--su-zoom', String(zoomVal));
        updateZoomUi();
        return true;
      }
    });
  }

  // 需在 DOM 引用就绪后初始化（applyGen 会写 msg）
  if (!tryResume()) newRandom();

  function renderBoard() {
    board.innerHTML = '';
    for (var r = 0; r < 9; r++) {
      cells[r] = [];
      for (var c = 0; c < 9; c++) {
        var cell = document.createElement('div');
        cell.className = 'su-cell' + (fixed[r][c] ? ' fixed' : '') + (variant === 'x' ? ' x-mode' : '');
        cell.innerHTML = '';
        if (puzzle[r][c]) cell.textContent = puzzle[r][c];
        else if (notes[r][c] && notes[r][c].length) {
          var noteGrid = document.createElement('div');
          noteGrid.className = 'su-notes';
          for (var n = 1; n <= 9; n++) {
            var span = document.createElement('span');
            span.textContent = notes[r][c].indexOf(n) >= 0 ? n : '';
            noteGrid.appendChild(span);
          }
          cell.appendChild(noteGrid);
        }
        (function (rr, cc) { cell.addEventListener('click', function () { select(rr, cc); }); })(r, c);
        board.appendChild(cell);
        cells[r][c] = cell;
      }
    }
    updatePadCounts();
  }

  /* 自动候选：把所有空格的合法候选写入笔记 */
  function refreshAutoNotes() {
    for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
      notes[r][c] = (!puzzle[r][c] && autoNotes) ? candidates(puzzle, r, c) : [];
    }
  }

  /* 数字面板：显示每个数字剩余可填数量，填满后淡出 */
  function updatePadCounts() {
    if (!pad || !pad.children.length) return;
    var used = {};
    for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) if (puzzle[r][c]) used[puzzle[r][c]] = (used[puzzle[r][c]] || 0) + 1;
    for (var n = 1; n <= 9; n++) {
      var key = pad.children[n - 1];
      if (!key) continue;
      var span = key.querySelector('.su-left');
      if (!span) { span = document.createElement('span'); span.className = 'su-left'; key.appendChild(span); }
      var left = 9 - (used[n] || 0);
      span.textContent = left > 0 ? String(left) : '';
      key.classList.toggle('done', left <= 0);
    }
  }

  function select(r, c) {
    if (over) return;
    /* 固定格也允许选中，用于高亮同行/列/宫；落子仍在 place() 内拦截 */
    sel = { r: r, c: c };
    highlight();
    ensureVisible(r, c);
    if (Arcade.juice) Arcade.juice.select();
  }
  function highlight() {
    for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
      cells[r][c].classList.remove('sel', 'peer');
      if (sel && (r === sel.r || c === sel.c || (Math.floor(r / 3) === Math.floor(sel.r / 3) && Math.floor(c / 3) === Math.floor(sel.c / 3))) ||
          (variant === 'x' && sel && ((r === c && sel.r === sel.c) || (r + c === 8 && sel.r + sel.c === 8)))) cells[r][c].classList.add('peer');
    }
    if (sel) cells[sel.r][sel.c].classList.add('sel');
  }
  function place(n) {
    if (!sel || over || fixed[sel.r][sel.c]) return;
    if (noteMode) {
      if (n === 0) { notes[sel.r][sel.c] = []; }
      else {
        notes[sel.r][sel.c] = notes[sel.r][sel.c] || [];
        var idx = notes[sel.r][sel.c].indexOf(n);
        if (idx >= 0) notes[sel.r][sel.c].splice(idx, 1);
        else notes[sel.r][sel.c].push(n);
      }
      puzzle[sel.r][sel.c] = 0;
      cells[sel.r][sel.c].classList.remove('wrong');
      if (Arcade.juice) Arcade.juice.select();
      renderBoard();
      highlight();
      writeSave();
      return;
    }
    var r = sel.r, c = sel.c;
    var prev = puzzle[r][c];
    var isWrong = !!(n && solution[r] && n !== solution[r][c]);
    puzzle[r][c] = n;
    if (n) {
      notes[r][c] = [];
      // 错误计数：与答案不符即记错（重复填同一个错值不重复计数）
      if (isWrong && prev !== n) {
        errors++;
        if (errEl) errEl.textContent = errors;
      }
    }
    var cell = cells[r][c];
    cell.textContent = n || ''; // 擦除(0)时清空文字，不显示假 0
    cell.classList.toggle('wrong', isWrong);
    cell.classList.remove('wrongfx');
    if (isWrong) {
      void cell.offsetWidth;
      cell.classList.add('wrongfx');
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) {
        var rc = cell.getBoundingClientRect();
        Arcade.fx.burst(rc.left + rc.width / 2, rc.top + rc.height / 2, 'var(--neon-pink)', 8);
      }
      if (Arcade.fx) Arcade.fx.shake(cell);
    } else if (n) {
      if (Arcade.juice) Arcade.juice.select();
    }
    if (autoNotes) {
      refreshAutoNotes();
      renderBoard();
      highlight();
    }
    check();
    updatePadCounts();
    writeSave();
  }
  function check() {
    var full = true;
    for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
      var v = puzzle[r][c];
      if (!v) { full = false; continue; }
      puzzle[r][c] = 0;
      var ok = valid(puzzle, r, c, v);
      puzzle[r][c] = v;
      cells[r][c].classList.toggle('wrong', !ok || v !== solution[r][c]);
    }
    if (full && !board.querySelector('.wrong')) win();
  }

  /* 提示：优先进阶最浅的技巧，一步一只填一空 */
  function showHint() {
    if (over) return;
    var st = findStep(puzzle);
    if (!st) {
      if (isFilled(puzzle)) return;
      // 单点技巧推不动时才揭示，保证不会有静默失败
      for (var rr = 0; rr < 9; rr++) for (var cc = 0; cc < 9; cc++) if (!puzzle[rr][cc]) { st = { r: rr, c: cc, n: solution[rr][cc], tech: 'reveal' }; rr = 9; break; }
      if (!st) return;
    }
    hints++;
    var cellName = 'R' + (st.r + 1) + 'C' + (st.c + 1);
    puzzle[st.r][st.c] = st.n;
    notes[st.r][st.c] = [];
    if (autoNotes) refreshAutoNotes();
    var text;
    if (st.tech === 'naked') text = T('gs.sudoku.hintNaked').replace('{cell}', cellName).replace('{n}', st.n);
    else if (st.tech === 'hidden') {
      var unitKey = st.unit === 'row' ? 'gs.sudoku.unitRow' : (st.unit === 'col' ? 'gs.sudoku.unitCol' : 'gs.sudoku.unitBox');
      text = T('gs.sudoku.hintHidden').replace('{cell}', cellName).replace('{n}', st.n).replace('{u}', T(unitKey));
    } else text = T('gs.sudoku.hintReveal').replace('{cell}', cellName).replace('{n}', st.n);
    msg.textContent = text;
    msg.style.color = 'var(--neon-yellow)';
    if (Arcade.audio) Arcade.audio.play('coin');
    renderBoard();
    highlight();
    var target = cells[st.r][st.c];
    if (target) {
      ensureVisible(st.r, st.c);
      target.classList.add('hintfx');
      setTimeout(function () { if (target) target.classList.remove('hintfx'); }, 900);
    }
    syncToolUi();
    check();
    updatePadCounts();
    writeSave();
  }

  function win() {
    over = true;
    var sec = Math.round((Date.now() - startTs) / 1000);
    var total = sec + errors * 5 + hints * 15;
    msg.textContent = T('gs.sudoku.win').replace('{a}', sec) + (errors > 0 ? T('gs.sudoku.winErr').replace('{n}', errors) : T('gs.sudoku.winClean'));
    msg.style.color = 'var(--neon-green)';
    if (Arcade.juice) Arcade.juice.win();
    // 成绩 = 用时 + 错误惩罚（每个错误 +5 秒）+ 提示惩罚（每次 +15 秒）
    if (Arcade.shell) Arcade.shell.submitScore(total);
    if (Arcade.daily && dailyMode) Arcade.daily.markSolved('sudoku', total);

    // 完成演出：整盘绿光波浪 → 结算卡
    board.classList.add('won');
    for (var i = 0; i < 81; i++) {
      var cc = cells[Math.floor(i / 9)][i % 9];
      if (cc) cc.style.animationDelay = ((Math.floor(i / 9) + (i % 9)) * 22) + 'ms';
    }
    if (Arcade.fx) {
      Arcade.fx.flash('var(--neon-green)');
      setTimeout(function () { Arcade.fx.centerBurst('var(--neon-cyan)', 26); }, 220);
      setTimeout(function () { Arcade.fx.centerBurst('var(--neon-yellow)', 22); }, 560);
    }
    if (overlay) {
      ovTitle.textContent = T('gs.sudoku.winTitle');
      ovMeta.textContent = (variant === 'x' ? T('gs.sudoku.xOn') : T('gs.sudoku.xOff')) + ' · ' +
        T('gs.sudoku.' + difficulty) + ' · ' + (techTier === 'basic' ? T('gs.sudoku.techBasic') : T('gs.sudoku.techAdv'));
      ovTime.textContent = sec + 's';
      ovErr.textContent = String(errors);
      ovHint.textContent = String(hints);
      setTimeout(function () { overlay.classList.remove('hidden'); }, 620);
    }
  }

  ['1','2','3','4','5','6','7','8','9','⌫'].forEach(function (k) {
    var b = document.createElement('div'); b.className = 'su-key' + (k === '⌫' ? ' erase' : '');
    b.textContent = k;
    b.addEventListener('click', function () {
      if (!sel) {
        msg.textContent = T('gs.sudoku.pickCell');
        if (Arcade.audio) Arcade.audio.play('error');
        return;
      }
      place(k === '⌫' ? 0 : parseInt(k, 10));
    });
    pad.appendChild(b);
  });

  function tick() {
    if (over) return;
    var s = Math.round((Date.now() - startTs) / 1000);
    timeEl.textContent = ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
    setTimeout(tick, 500);
  }

  wrap.querySelector('#su-new').addEventListener('click', function () {
    newRandom();
    if (Arcade.audio) Arcade.audio.play('ui');
  });

  diffRow.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !b.getAttribute('data-diff')) return;
    difficulty = b.getAttribute('data-diff');
    var btns = diffRow.getElementsByTagName('button');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-diff') === difficulty) btns[i].classList.add('selected');
      else btns[i].classList.remove('selected');
    }
    newRandom();
    if (Arcade.audio) Arcade.audio.play('ui');
  });

  var noteBtn = wrap.querySelector('#su-note');
  function toggleNote() {
    noteMode = !noteMode;
    if (noteMode) autoNotes = false;
    syncToolUi();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  noteBtn.addEventListener('click', toggleNote);

  wrap.querySelector('#su-auto').addEventListener('click', function () {
    autoNotes = !autoNotes;
    if (autoNotes) {
      noteMode = false;
      refreshAutoNotes();
    } else {
      resetNotes();
    }
    syncToolUi();
    renderBoard();
    highlight();
    writeSave();
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  wrap.querySelector('#su-tip').addEventListener('click', showHint);
  wrap.querySelector('#su-variant').addEventListener('click', function () {
    variant = variant === 'x' ? 'classic' : 'x';
    syncToolUi();
    newRandom();
    if (Arcade.audio) Arcade.audio.play('coin');
    msg.textContent = T(variant === 'x' ? 'gs.sudoku.xIntro' : 'gs.sudoku.classicIntro');
  });
  wrap.querySelector('#su-daily').addEventListener('click', function () {
    newDaily();
    if (Arcade.audio) Arcade.audio.play('coin');
  });

  /* 键盘：1-9 填数 · 0/⌫ 擦除 · 方向键移动 · N 笔记 · H 提示 */
  function moveSel(dr, dc) {
    if (over) return;
    if (!sel) {
      sel = { r: 4, c: 4 };
      if (!fixed[sel.r][sel.c]) { highlight(); return; }
    }
    var r = sel.r, c = sel.c;
    for (var i = 0; i < 9; i++) {
      r = (r + dr + 9) % 9;
      c = (c + dc + 9) % 9;
      if (!fixed[r][c]) { sel = { r: r, c: c }; highlight(); return; }
    }
  }
  window.addEventListener('keydown', function (e) {
    if (over) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k >= '1' && k <= '9') {
      e.preventDefault();
      if (sel) place(parseInt(k, 10));
      else { msg.textContent = T('gs.sudoku.pickCell'); }
    } else if (k === '0' || k === 'Backspace' || k === 'Delete') {
      e.preventDefault();
      if (sel) place(0);
    } else if (k === 'ArrowUp') { e.preventDefault(); moveSel(-1, 0); }
    else if (k === 'ArrowDown') { e.preventDefault(); moveSel(1, 0); }
    else if (k === 'ArrowLeft') { e.preventDefault(); moveSel(0, -1); }
    else if (k === 'ArrowRight') { e.preventDefault(); moveSel(0, 1); }
    else if ((k === 'n' || k === 'N') && !e.repeat) toggleNote();
    else if ((k === 'h' || k === 'H') && !e.repeat) showHint();
    else if (k === '+' || k === '=') { e.preventDefault(); zoomStep(1); }
    else if (k === '-' || k === '_') { e.preventDefault(); zoomStep(-1); }
  });

  var ovAgain = wrap.querySelector('#su-ov-again');
  var ovDaily = wrap.querySelector('#su-ov-daily');
  if (ovAgain) ovAgain.addEventListener('click', function () { newRandom(); if (Arcade.audio) Arcade.audio.play('ui'); });
  if (ovDaily) ovDaily.addEventListener('click', function () { newDaily(); if (Arcade.audio) Arcade.audio.play('coin'); });

  renderBoard();
  tick();
  updateZoomUi();
      /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.sudoku.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    newRandom();
  };

  /* 调试钩子：仅 ?qa=1 时挂载，正常访问不暴露可篡改状态的入口 */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) window.__qa = {
    state: function () { return { over: over, errors: errors, hints: hints, variant: variant, difficulty: difficulty, tier: techTier, sel: sel }; },
    blank: function () {
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) if (!fixed[r][c] && !puzzle[r][c]) return { r: r, c: c };
      return null;
    },
    solution: function () { return solution; },
    fillAll: function () {
      for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) puzzle[r][c] = solution[r][c];
      renderBoard(); highlight(); check(); updatePadCounts();
      return over;
    },
    hint: showHint,
    restart: newRandom,
    zoom: function (v) { setZoomVal(v); return this.zoomInfo(); },
    zoomIn: function () { zoomStep(1); return this.zoomInfo(); },
    zoomOut: function () { zoomStep(-1); return this.zoomInfo(); },
    zoomInfo: function () {
      return {
        zoom: zoomVal,
        cellPx: calcCellPx(),
        wrapW: boardWrap.clientWidth,
        boardW: boardWrap.scrollWidth,
        scrollLeft: Math.round(boardWrap.scrollLeft),
        pageSW: document.documentElement.scrollWidth,
        pageCW: document.documentElement.clientWidth
      };
    },
    cellAt: function (r, c) {
      var el = cells[r] && cells[r][c];
      if (!el) return null;
      var b = el.getBoundingClientRect();
      return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), w: Math.round(b.width * 10) / 10 };
    },
    hitAt: function (r, c) {
      var p = this.cellAt(r, c);
      if (!p) return { hit: false };
      var el = document.elementFromPoint(p.x, p.y);
      var cell = el && el.closest ? el.closest('.su-cell') : null;
      return { hit: !!(cell && cell === cells[r][c]), x: p.x, y: p.y, w: p.w };
    },
    pick: function (r, c) { select(r, c); return sel; },
    place: function (n) { place(n); return { value: puzzle[sel.r][sel.c], notes: notes[sel.r][sel.c].slice() }; },
    setNote: function (on) { noteMode = !!on; syncToolUi(); return noteMode; }
  };

})();
