/* ============================================================
   黑白棋 · 旗舰版
   8×8 标准翻转规则；双人对弈 / 人机对战
   引擎：开局库 + 迭代加深 α-β + 置换表 + 位运算终局精确解
   交互：指针/触控、方向键 + Enter、U/Z 撤销、H 提示、P 暂停
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  var isQA = /(?:^|[?&])qa=1(?:&|$)/.test(location.search);

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.reversi.tut1t'), d: T('gs.reversi.tut1') },
    { t: T('gs.reversi.tut2t'), d: T('gs.reversi.tut2') },
    { t: T('gs.reversi.tut3t'), d: T('gs.reversi.tut3') }
  ];

  root.innerHTML =
    '<div class="rv-hud">' +
    '  <div class="rv-side rv-side-black" id="rv-side-b">' +
    '    <span class="rv-side-label">' + T('gs.rv.sideBlack') + '</span>' +
    '    <span class="rv-side-count" id="score-b">2</span>' +
    '  </div>' +
    '  <div class="rv-mid">' +
    '    <div class="rv-bar"><div class="rv-bar-b" id="bar-b"></div><div class="rv-bar-w" id="bar-w"></div></div>' +
    '    <div class="rv-turn" id="rv-turn"></div>' +
    '  </div>' +
    '  <div class="rv-side rv-side-white" id="rv-side-w">' +
    '    <span class="rv-side-label">' + T('gs.rv.sideWhite') + '</span>' +
    '    <span class="rv-side-count" id="score-w">2</span>' +
    '  </div>' +
    '</div>' +
    '<div class="rv-meta">' +
    '  <span class="rv-meta-item" id="rv-streak"></span>' +
    '  <span class="rv-meta-item" id="rv-best"></span>' +
    '  <span class="rv-meta-item rv-diff-label" id="rv-diff-label"></span>' +
    '</div>' +
    '<div class="game-message" id="msg"></div>' +
    '<div class="rv-board-wrap">' +
    '  <div class="rv-board" id="board" role="grid" aria-label="' + T('gs.rv.boardLabel') + '"></div>' +
    '  <div class="rv-pause-mask hidden" id="rv-pause-mask"><div class="rv-pause-card">' +
    '    <div class="rv-pause-title" id="rv-pause-title"></div>' +
    '    <div class="rv-pause-sub" id="rv-pause-sub"></div>' +
    '  </div></div>' +
    '</div>' +
    '<div class="game-controls rv-action-row">' +
    '  <button class="btn purple rv-act" id="undo-btn" type="button">' + T('gs.rv.undo') + '<span class="rv-key">U</span></button>' +
    '  <button class="btn yellow rv-act" id="hint-btn" type="button">' + T('gs.rv.hint') + '<span class="rv-key">H</span></button>' +
    '  <button class="btn rv-act" id="pause-btn" type="button">' + T('gs.rv.pause') + '<span class="rv-key">P</span></button>' +
    '  <button class="btn green rv-act" id="restart-btn" type="button">' + T('gs.reversi.restart') + '<span class="rv-key">R</span></button>' +
    '</div>' +
    '<div class="game-controls" id="mode-controls">' +
    '  <button class="btn mode-btn active" data-mode="pvp" type="button">' + T('gs.reversi.pvp') + '</button>' +
    '  <button class="btn pink mode-btn" data-mode="ai" type="button">' + T('gs.reversi.aiMode') + '</button>' +
    '</div>' +
    '<div class="game-controls" id="diff-controls">' +
    '  <button class="btn purple mode-btn" data-diff="easy" type="button">' + T('gs.reversi.dEasy') + '</button>' +
    '  <button class="btn yellow mode-btn active" data-diff="medium" type="button">' + T('gs.reversi.dNormal') + '</button>' +
    '  <button class="btn green mode-btn" data-diff="hard" type="button">' + T('gs.reversi.dHard') + '</button>' +
    '</div>' +
    '<p class="help-text rv-help">' + T('gs.rv.keyHelp') + '</p>';

  var ovWrap = document.createElement('div');
  ovWrap.className = 'rv-overlay hidden';
  ovWrap.id = 'rv-overlay';
  ovWrap.innerHTML =
    '<div class="rv-ov-card" role="dialog" aria-modal="true">' +
    '  <div class="rv-ov-title" id="rv-ov-title"></div>' +
    '  <div class="rv-ov-sub" id="rv-ov-sub"></div>' +
    '  <div class="rv-ov-score">' +
    '    <div class="rv-ov-side black"><span>' + T('gs.rv.sideBlack') + '</span><b id="rv-ov-b">0</b></div>' +
    '    <div class="rv-ov-vs">:</div>' +
    '    <div class="rv-ov-side white"><span>' + T('gs.rv.sideWhite') + '</span><b id="rv-ov-w">0</b></div>' +
    '  </div>' +
    '  <div class="rv-ov-rows">' +
    '    <div class="rv-ov-row"><span>' + T('gs.rv.sideLabel') + '</span><b id="rv-ov-side">—</b></div>' +
    '    <div class="rv-ov-row"><span>' + T('gs.rv.streakLabel') + '</span><b id="rv-ov-streak">0</b></div>' +
    '    <div class="rv-ov-row"><span>' + T('gs.rv.bestLabel') + '</span><b id="rv-ov-best">----</b></div>' +
    '  </div>' +
    '  <div class="rv-ov-btns">' +
    '    <button class="btn green rv-ov-btn" id="rv-ov-again" type="button">' + T('gs.reversi.again') + '</button>' +
    '    <button class="btn yellow rv-ov-btn" id="rv-ov-diff" type="button">' + T('gs.rv.changeDiff') + '</button>' +
    '    <button class="btn pink rv-ov-btn" id="rv-ov-mode" type="button">' + T('gs.rv.switchMode') + '</button>' +
    '    <button class="btn rv-ov-btn" id="rv-ov-close" type="button">' + T('gs.reversi.viewBoard') + '</button>' +
    '  </div>' +
    '</div>';
  root.appendChild(ovWrap);

  var msgEl = document.getElementById('msg');
  var boardEl = document.getElementById('board');
  var scoreBEl = document.getElementById('score-b');
  var scoreWEl = document.getElementById('score-w');
  var barBEl = document.getElementById('bar-b');
  var barWEl = document.getElementById('bar-w');
  var turnEl = document.getElementById('rv-turn');
  var streakEl = document.getElementById('rv-streak');
  var bestEl = document.getElementById('rv-best');
  var diffLabelEl = document.getElementById('rv-diff-label');
  var undoBtn = document.getElementById('undo-btn');
  var hintBtn = document.getElementById('hint-btn');
  var pauseBtn = document.getElementById('pause-btn');
  var restartBtn = document.getElementById('restart-btn');
  var pauseMask = document.getElementById('rv-pause-mask');
  var pauseTitle = document.getElementById('rv-pause-title');
  var pauseSub = document.getElementById('rv-pause-sub');
  var ovTitleEl = ovWrap.querySelector('#rv-ov-title');
  var ovSubEl = ovWrap.querySelector('#rv-ov-sub');
  var ovBEl = ovWrap.querySelector('#rv-ov-b');
  var ovWEl = ovWrap.querySelector('#rv-ov-w');
  var ovStreakEl = ovWrap.querySelector('#rv-ov-streak');
  var ovBestEl = ovWrap.querySelector('#rv-ov-best');
  var ovSideEl = ovWrap.querySelector('#rv-ov-side');
  var modeBtns = document.querySelectorAll('.mode-btn[data-mode]');
  var diffBtns = document.querySelectorAll('#diff-controls .mode-btn');

  var SIZE = 8, EMPTY = 0, BLACK = 1, WHITE = 2;
  var OPP = { 1: 2, 2: 1 };

  var DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  /* ---------- 持久化 ---------- */
  var STREAK_KEY = 'arcade_streak_reversi';
  function readStreak() {
    try {
      var raw = localStorage.getItem(STREAK_KEY);
      if (raw !== null) {
        var n = Number(raw);
        if (isFinite(n) && n >= 0) return Math.floor(n);
      }
    } catch (e) {}
    /* 兼容历史存档里的连胜字段 */
    try {
      var old = JSON.parse(localStorage.getItem('arcade_save_reversi') || 'null');
      if (old && typeof old.streak === 'number' && isFinite(old.streak) && old.streak >= 0) {
        return Math.floor(old.streak);
      }
    } catch (e2) {}
    return 0;
  }
  function writeStreak(n) {
    try { localStorage.setItem(STREAK_KEY, String(n)); } catch (e) {}
  }
  function bestScore() {
    return (window.Arcade && Arcade.storage) ? Arcade.storage.getBest('reversi') : null;
  }

  /* ---------- 状态 ---------- */
  var board = emptyBoard();
  var current = BLACK;
  var mode = 'pvp';
  var difficulty = 'medium';
  var gameOver = false;
  var aiThinking = false;
  var paused = false;
  var aiTimer = null;
  var turnToken = 0;
  var streak = readStreak();
  var history = [];
  var lastMove = null;
  var moveNumber = 0;
  var hintCell = null;
  var hintGain = 0;
  var hintReadyAt = 0;
  var hintTimerId = null;
  var cursor = null;
  var active = true;
  var lastSubmitted = null;
  var bookSeed = Math.floor(Math.random() * 1e9);
  var cells = [];
  var overlayTimer = null;

  var UNDO_LIMIT = 60;
  var HINT_CD = 4500;

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(EMPTY);
      b.push(row);
    }
    return b;
  }
  function cloneBoard(b) {
    var out = [];
    for (var r = 0; r < SIZE; r++) out.push(b[r].slice());
    return out;
  }
  function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function coordOf(r, c) { return String.fromCharCode(97 + c) + (8 - r); }
  function rcOfCoord(s) { return { r: 8 - Number(s.slice(1)), c: s.charCodeAt(0) - 97 }; }

  function countPieces(b) {
    b = b || board;
    var bl = 0, wh = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (b[r][c] === BLACK) bl++;
        else if (b[r][c] === WHITE) wh++;
      }
    }
    return { b: bl, w: wh };
  }

  function getFlips(b, r, c, player) {
    if (b[r][c] !== EMPTY || !inBounds(r, c)) return [];
    var opp = OPP[player], all = [];
    for (var d = 0; d < DIRS.length; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      var line = [], rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc) && b[rr][cc] === opp) {
        line.push({ r: rr, c: cc });
        rr += dr; cc += dc;
      }
      if (line.length && inBounds(rr, cc) && b[rr][cc] === player) all = all.concat(line);
    }
    return all;
  }

  function legalMoves(b, player) {
    var res = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var f = getFlips(b, r, c, player);
        if (f.length) res.push({ r: r, c: c, flips: f });
      }
    }
    return res;
  }

  function hasLegal(b, player) { return legalMoves(b, player).length > 0; }

  /* ---------- 断点续玩（沿用既有存档键 arcade_save_reversi） ---------- */
  function writeSave() {
    return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write());
  }
  function clearSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.clear();
  }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'reversi',
      collect: function () {
        if (gameOver) return null;
        return {
          board: board, current: current, mode: mode, streak: streak,
          difficulty: difficulty, bookSeed: bookSeed, lastMove: lastMove, moveNumber: moveNumber
        };
      },
      apply: function (s) {
        if (!s || !Array.isArray(s.board) || s.board.length !== SIZE) return false;
        for (var ri = 0; ri < SIZE; ri++) {
          if (!Array.isArray(s.board[ri]) || s.board[ri].length !== SIZE) return false;
          for (var ci = 0; ci < SIZE; ci++) {
            var v = s.board[ri][ci];
            if (v !== EMPTY && v !== BLACK && v !== WHITE) return false;
          }
        }
        if (s.current !== BLACK && s.current !== WHITE) return false;
        if (s.mode !== 'pvp' && s.mode !== 'ai') return false;
        board = cloneBoard(s.board);
        current = s.current;
        mode = s.mode;
        difficulty = (s.difficulty === 'easy' || s.difficulty === 'hard') ? s.difficulty : 'medium';
        if (!s.difficulty && s.aiDepth) difficulty = s.aiDepth <= 2 ? 'easy' : s.aiDepth >= 6 ? 'hard' : 'medium';
        bookSeed = typeof s.bookSeed === 'number' ? s.bookSeed : bookSeed;
        lastMove = s.lastMove && typeof s.lastMove.r === 'number' ? s.lastMove : null;
        moveNumber = typeof s.moveNumber === 'number' ? s.moveNumber : 0;
        streak = typeof s.streak === 'number' ? Math.max(readStreak(), Math.floor(s.streak)) : readStreak();
        writeStreak(streak);
        history = [];
        gameOver = false; aiThinking = false; paused = false;
        clearTimeout(aiTimer);
        syncModeButtons();
        syncDiffButtons();
        hideOverlay();
        hidePause();
        render();
        turnMessage();
        updateMeta();
        maybeAi();
        return true;
      }
    });
  }

  // 构建 8×8 棋盘 DOM
  for (var i = 0; i < SIZE * SIZE; i++) {
    var cell = document.createElement('div');
    cell.className = 'rv-cell' + ((Math.floor(i / SIZE) + i % SIZE) % 2 ? ' alt' : '');
    cell.setAttribute('data-i', i);
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', coordOf(Math.floor(i / SIZE), i % SIZE));
    cell.addEventListener('click', onCellClick);
    boardEl.appendChild(cell);
    cells.push(cell);
  }

  function syncModeButtons() {
    for (var k = 0; k < modeBtns.length; k++) {
      modeBtns[k].classList.toggle('active', modeBtns[k].getAttribute('data-mode') === mode);
    }
  }
  function syncDiffButtons() {
    var ai = mode === 'ai';
    for (var k = 0; k < diffBtns.length; k++) {
      diffBtns[k].classList.toggle('active', diffBtns[k].getAttribute('data-diff') === difficulty);
      diffBtns[k].disabled = !ai;
    }
    var ovDiff = ovWrap && ovWrap.querySelector('#rv-ov-diff');
    if (ovDiff) ovDiff.style.display = ai ? '' : 'none';
  }

  function setMessage(text, color) {
    msgEl.textContent = text;
    msgEl.style.color = color || '';
  }

  function playerCanAct() {
    if (gameOver || paused || aiThinking) return false;
    if (mode === 'ai' && current !== BLACK) return false;
    return true;
  }

  function turnMessage() {
    var cls = 'rv-turn';
    if (paused) {
      turnEl.textContent = T('gs.rv.paused');
      cls += ' paused';
    } else if (mode === 'ai') {
      if (current === BLACK) { turnEl.textContent = T('gs.rv.yourTurn'); cls += ' black'; }
      else { turnEl.textContent = T('gs.reversi.aiThinking'); cls += ' ai'; }
    } else {
      turnEl.textContent = current === BLACK ? T('gs.reversi.blackTurn') : T('gs.reversi.whiteTurn');
      cls += current === BLACK ? ' black' : ' white';
    }
    turnEl.className = cls;
  }

  function updateMeta() {
    streakEl.textContent = T('gs.rv.streak').replace('{n}', streak);
    var best = bestScore();
    bestEl.textContent = T('gs.rv.bestLabel') + ' ' + (best === null ? '----' : best);
    var diffKey = difficulty === 'easy' ? 'dEasy' : difficulty === 'hard' ? 'dHard' : 'dNormal';
    diffLabelEl.textContent = mode === 'ai'
      ? T('gs.rv.diffLabel') + ' ' + T('gs.reversi.' + diffKey)
      : T('gs.reversi.pvp');
    undoBtn.disabled = history.length === 0 || gameOver;
  }

  function updateHUD() {
    var s = countPieces();
    scoreBEl.textContent = s.b;
    scoreWEl.textContent = s.w;
    var total = s.b + s.w;
    var pb = total ? (s.b / total) * 100 : 50;
    barBEl.style.width = pb + '%';
    barWEl.style.width = (100 - pb) + '%';
  }

  /** 渲染棋盘；opt.place = 新落子；opt.flips = 翻转格（逐枚延迟动画） */
  function render(opt) {
    opt = opt || {};
    var legalMap = {};
    if (playerCanAct()) {
      var moves = legalMoves(board, current);
      for (var m = 0; m < moves.length; m++) legalMap[moves[m].r * SIZE + moves[m].c] = true;
    }
    var flipMap = {}, flipIdx = {}, order = 0;
    if (opt.flips) {
      var pr = opt.place ? opt.place.r : 4, pc = opt.place ? opt.place.c : 4;
      var dists = [];
      for (var f = 0; f < opt.flips.length; f++) {
        var fr = opt.flips[f].r, fc = opt.flips[f].c;
        dists.push({ r: fr, c: fc, d: Math.max(Math.abs(fr - pr), Math.abs(fc - pc) * 0.4) });
      }
      dists.sort(function (a, b) { return a.d - b.d; });
      for (var fd = 0; fd < dists.length; fd++) {
        var key = dists[fd].r * SIZE + dists[fd].c;
        flipMap[key] = true;
        flipIdx[key] = fd;
      }
      order = dists.length;
    }
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var idx = r * SIZE + c;
        var el = cells[idx];
        var v = board[r][c];
        el.className = 'rv-cell' + ((r + c) % 2 ? ' alt' : '') +
          (v !== EMPTY ? ' occupied' : '') +
          (lastMove && lastMove.r === r && lastMove.c === c ? ' rv-last' : '') +
          (legalMap[idx] ? ' rv-legal' : '') +
          (hintCell && hintCell.r === r && hintCell.c === c ? ' rv-hint-best' : '') +
          (cursor && cursor.r === r && cursor.c === c ? ' rv-cursor' : '');
        el.innerHTML = '';
        if (v !== EMPTY) {
          var disc = document.createElement('div');
          disc.className = 'rv-disc ' + (v === BLACK ? 'black' : 'white');
          if (flipMap[idx]) {
            disc.classList.add('rv-flip');
            disc.style.setProperty('--delay', String(30 + flipIdx[idx] * 32) + 'ms');
          }
          if (opt.place && opt.place.r === r && opt.place.c === c) disc.classList.add('rv-pop');
          el.appendChild(disc);
        } else if (legalMap[idx]) {
          var dot = document.createElement('span');
          dot.className = 'rv-legal-dot';
          el.appendChild(dot);
        }
        if (hintCell && hintCell.r === r && hintCell.c === c) {
          var badge = document.createElement('span');
          badge.className = 'rv-hint-badge';
          badge.textContent = '+' + hintGain;
          el.appendChild(badge);
        }
        if (lastMove && lastMove.r === r && lastMove.c === c) {
          var ring = document.createElement('span');
          ring.className = 'rv-last-ring';
          el.appendChild(ring);
        }
      }
    }
    updateHUD();
    updateMeta();
  }

  function hideOverlay() {
    if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; }
    ovWrap.classList.add('hidden');
  }
  function hidePause() {
    pauseMask.classList.add('hidden');
    boardEl.classList.remove('paused');
    if (pauseBtn) pauseBtn.textContent = T('gs.rv.pause');
    if (pauseBtn) pauseBtn.appendChild(makeKeySpan('P'));
  }
  function makeKeySpan(k) {
    var s = document.createElement('span');
    s.className = 'rv-key';
    s.textContent = k;
    return s;
  }

  function clearHint() {
    hintCell = null; hintGain = 0;
    if (hintTimerId) { clearInterval(hintTimerId); hintTimerId = null; }
  }

  /* ---------- 结算 ---------- */
  function finishGame(forceWinner, instant) {
    clearTimeout(aiTimer);
    aiThinking = false;
    paused = false;
    hidePause();
    gameOver = true;
    clearHint();
    boardEl.classList.remove('thinking', 'paused');
    boardEl.classList.add('finished');

    var s = countPieces();
    var winner = forceWinner || (s.b > s.w ? BLACK : s.w > s.b ? WHITE : 0);
    var title, sub, resultClass = '';
    if (winner === BLACK) {
      title = mode === 'ai' ? T('gs.rv.youWin') : T('gs.reversi.blackWins');
      sub = T('gs.rv.winSub');
      resultClass = 'win';
    } else if (winner === WHITE) {
      title = mode === 'ai' ? T('gs.rv.youLose') : T('gs.reversi.whiteWins');
      sub = T('gs.rv.loseSub');
      resultClass = 'lose';
    } else {
      title = T('gs.reversi.draw');
      sub = T('gs.rv.drawSub');
      resultClass = 'draw';
    }

    var submitted = false;
    lastSubmitted = null;
    if (mode === 'ai') {
      if (winner === BLACK) {
        streak = streak + 1;
        writeStreak(streak);
        lastSubmitted = streak;
        if (window.Arcade && Arcade.shell) Arcade.shell.submitScore(streak);
        submitted = true;
      } else if (winner === WHITE) {
        streak = 0;
        writeStreak(0);
      }
    }

    if (winner === BLACK) {
      if (window.Arcade && Arcade.juice) Arcade.juice.win();
      if (window.Arcade && Arcade.fx) {
        Arcade.fx.flash('var(--neon-yellow)');
        setTimeout(function () { Arcade.fx.centerBurst('var(--neon-yellow)', 26); }, 220);
      }
    } else if (winner === WHITE) {
      if (window.Arcade && Arcade.juice) Arcade.juice.lose();
      if (window.Arcade && Arcade.audio) Arcade.audio.play('lose');
    } else {
      if (window.Arcade && Arcade.juice) Arcade.juice.select();
    }

    setMessage(title + ' · ' + s.b + ' : ' + s.w, winner === BLACK ? 'var(--neon-yellow)' : 'var(--neon-cyan)');
    ovTitleEl.textContent = title;
    ovTitleEl.className = 'rv-ov-title ' + resultClass;
    ovSubEl.textContent = sub;
    ovBEl.textContent = String(s.b);
    ovWEl.textContent = String(s.w);
    ovSideEl.textContent = mode === 'ai' ? T('gs.rv.sideYouBlack') : T('gs.rv.sidePvp');
    ovStreakEl.textContent = mode === 'ai' ? String(streak) : '—';
    var best = bestScore();
    ovBestEl.textContent = best === null ? '----' : String(best);
    ovWrap.querySelector('#rv-ov-mode').textContent = mode === 'ai' ? T('gs.rv.switchToPvp') : T('gs.rv.switchToAi');
    ovWrap.querySelector('#rv-ov-mode').className = 'btn rv-ov-btn ' + (mode === 'ai' ? 'purple' : 'pink');
    syncModeButtons();
    syncDiffButtons();
    updateMeta();
    render();
    writeSave();
    if (instant) { if (overlayTimer) { clearTimeout(overlayTimer); overlayTimer = null; } showOverlay(); }
    else overlayTimer = setTimeout(showOverlay, 650);
  }

  function showOverlay() {
    ovWrap.classList.remove('hidden');
  }

  /* ============================================================
     AI 引擎：64 位位棋盘（BigInt 双位面）+ α-β + 置换表
     bit i 对应格 r*8+c；p 为「轮到走棋的一方」
     ============================================================ */
  var FULL = (1n << 64n) - 1n;
  var NOT_H = 0x7f7f7f7f7f7f7f7fn;
  var NOT_A = 0xfefefefefefefefen;

  function shE(x) { return (x & NOT_H) << 1n; }
  function shW(x) { return (x & NOT_A) >> 1n; }
  function shS(x) { return (x << 8n) & FULL; }
  function shN(x) { return (x >> 8n) & FULL; }
  function shSE(x) { return shE((x << 8n) & FULL); }
  function shSW(x) { return shW((x << 8n) & FULL); }
  function shNE(x) { return shE(x >> 8n); }
  function shNW(x) { return shW(x >> 8n); }
  var SHIFTS = [shE, shW, shS, shN, shSE, shSW, shNE, shNW];

  var BB_CORNERS = (1n << 0n) | (1n << 7n) | (1n << 56n) | (1n << 63n);
  var BB_EDGES = 0xff818181818181ffn;
  var PC16 = null;

  function popcount64(x) {
    if (!PC16) {
      PC16 = new Uint8Array(65536);
      for (var i = 0; i < 65536; i++) {
        var v = i, c = 0;
        while (v) { c += v & 1; v >>= 1; }
        PC16[i] = c;
      }
    }
    var c2 = 0;
    while (x) { c2 += PC16[Number(x & 0xffffn)]; x >>= 16n; }
    return c2;
  }

  function bbLegal(p, o) {
    var empty = ~(p | o) & FULL, res = 0n;
    for (var d = 0; d < 8; d++) {
      var x = SHIFTS[d](p) & o;
      while (x) {
        x = SHIFTS[d](x);
        res |= x & empty;
        x &= o;
      }
    }
    return res;
  }

  function bbFlips(m, p, o) {
    var flips = 0n;
    for (var d = 0; d < 8; d++) {
      var x = SHIFTS[d](m), f = 0n;
      while (x & o) { f |= x; x = SHIFTS[d](x); }
      if (x & p) flips |= f;
    }
    return flips;
  }

  function bbApply(m, p, o) {
    var f = bbFlips(m, p, o);
    return [p | m | f, o & ~f];
  }

  function bbIndex(m) { return popcount64(m - 1n); }

  function boardToBB(b, player) {
    var p = 0n, o = 0n, pc = 0, oc = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = b[r][c];
        if (v === EMPTY) continue;
        var bit = 1n << BigInt(r * 8 + c);
        if (v === player) { p |= bit; pc++; } else { o |= bit; oc++; }
      }
    }
    return { p: p, o: o, pc: pc, oc: oc };
  }

  function bbFromSimple(b, player) {
    var p = 0n, o = 0n;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = b[r][c];
        if (v === EMPTY) continue;
        var bit = 1n << BigInt(r * 8 + c);
        if (v === player) p |= bit; else o |= bit;
      }
    }
    return { p: p, o: o };
  }

  /* 邻接空格的己方子（frontier）：越少越稳 */
  function bbSpread(x) {
    return shE(x) | shW(x) | shS(x) | shN(x) | shSE(x) | shSW(x) | shNE(x) | shNW(x);
  }

  /* 边线稳定子近似：从角出发的连续同色边子（4 条边） */
  function edgeRun(v) {
    var a = 0, b = 0;
    while (a < 8 && (v & (1 << a))) a++;
    while (b < 8 && (v & (1 << (7 - b)))) b++;
    return a + b > 8 ? 8 : a + b;
  }
  function bbStableEdges(p) {
    var total = edgeRun(Number(p & 0xffn)) + edgeRun(Number((p >> 56n) & 0xffn));
    var left = 0, right = 0;
    for (var i = 0; i < 8; i++) {
      if (p & (1n << BigInt(i * 8))) left |= 1 << i;
      if (p & (1n << BigInt(i * 8 + 7))) right |= 1 << i;
    }
    return total + edgeRun(left) + edgeRun(right);
  }

  /* 从 p 方视角评估（约等于「子差量级」） */
  function evalBB(p, o, pcnt, ocnt) {
    var empties = 64 - pcnt - ocnt;
    var pMob = popcount64(bbLegal(p, o));
    var oMob = popcount64(bbLegal(o, p));
    var pCorner = popcount64(p & BB_CORNERS);
    var oCorner = popcount64(o & BB_CORNERS);
    var pEdge = popcount64(p & BB_EDGES) - pCorner;
    var oEdge = popcount64(o & BB_EDGES) - oCorner;
    var empty = ~(p | o) & FULL;
    var near = bbSpread(empty);
    var pFront = popcount64(near & p);
    var oFront = popcount64(near & o);
    var pStable = bbStableEdges(p), oStable = bbStableEdges(o);
    var v = (pCorner - oCorner) * 80 + (pEdge - oEdge) * 8 +
      (oMob - pMob) * 14 + (oFront - pFront) * 5 +
      (pStable - oStable) * 6;
    if (empties <= 10) v += (pcnt - ocnt) * 10;
    return v;
  }

  function terminalValue(pcnt, ocnt) {
    var d = pcnt - ocnt;
    return d * 1000 + (d > 0 ? 500000 : d < 0 ? -500000 : 0);
  }

  var CELL_W = [
    90, -18, 8, 4, 4, 8, -18, 90,
    -18, -30, -3, -3, -3, -3, -30, -18,
    8, -3, 12, 2, 2, 12, -3, 8,
    4, -3, 2, 1, 1, 2, -3, 4,
    4, -3, 2, 1, 1, 2, -3, 4,
    8, -3, 12, 2, 2, 12, -3, 8,
    -18, -30, -3, -3, -3, -3, -30, -18,
    90, -18, 8, 4, 4, 8, -18, 90
  ];

  var TT = new Map();
  var nodeCount = 0;
  var deadlineMs = 0;
  var TIMEOUT = { timeout: true };

  function negamax(p, o, pcnt, ocnt, depth, alpha, beta, passed) {
    nodeCount++;
    if ((nodeCount & 2047) === 0 && deadlineMs && Date.now() > deadlineMs) throw TIMEOUT;
    var empties = 64 - pcnt - ocnt;
    if (empties === 0) return terminalValue(pcnt, ocnt);
    if (depth <= 0) return evalBB(p, o, pcnt, ocnt);
    var key = (p << 64n) | o;
    var ent = TT.get(key);
    if (ent !== undefined && ent.d >= depth) {
      if (ent.f === 0) return ent.v;
      if (ent.f === 1 && ent.v >= beta) return ent.v;
      if (ent.f === 2 && ent.v <= alpha) return ent.v;
    }
    var moves = bbLegal(p, o);
    if (moves === 0n) {
      if (passed) return terminalValue(pcnt, ocnt);
      return -negamax(o, p, ocnt, pcnt, depth, -beta, -alpha, true);
    }
    var list = [];
    var rem = moves;
    while (rem) {
      var m = rem & -rem; rem ^= m;
      var idx = bbIndex(m);
      var sc = (m & BB_CORNERS) ? 10000 : CELL_W[idx] || 0;
      if (ent && ent.m === m) sc += 100000;
      list.push({ m: m, s: sc });
    }
    list.sort(function (a, b) { return b.s - a.s; });

    var best = -Infinity, bestM = 0n, origAlpha = alpha;
    for (var i = 0; i < list.length; i++) {
      var mv = list[i].m;
      var q = bbApply(mv, p, o);
      var np = q[0], no = q[1];
      var flips = popcount64(np) - pcnt - 1;
      var v = -negamax(no, np, ocnt - flips, pcnt + 1 + flips, depth - 1, -beta, -alpha, false);
      if (v > best) { best = v; bestM = mv; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    if (TT.size > 220000) TT.clear();
    TT.set(key, { d: depth, v: best, f: best <= origAlpha ? 2 : best >= beta ? 1 : 0, m: bestM });
    return best;
  }

  /** 根节点搜索。exact=true 时空位 ≤12 全搜索；否则迭代加深。 */
  function searchRoot(p, o, pcnt, ocnt, maxDepth, timeLimit, exact) {
    var empties = 64 - pcnt - ocnt;
    nodeCount = 0;
    TT.clear();
    deadlineMs = exact ? 0 : (Date.now() + (timeLimit || 500));
    var moves = bbLegal(p, o);
    if (moves === 0n) return { m: 0n, value: 0, depth: 0 };
    var rootList = [];
    var rem = moves;
    while (rem) {
      var m = rem & -rem; rem ^= m;
      rootList.push({ m: m, s: (m & BB_CORNERS) ? 10000 : (CELL_W[bbIndex(m)] || 0) });
    }
    rootList.sort(function (a, b) { return b.s - a.s; });

    var bestM = rootList[0].m, bestVal = 0, reached = 0;
    var depths = exact ? [empties] : [];
    if (!exact) {
      for (var d = 2; d <= maxDepth; d += 2) depths.push(Math.min(d, empties));
      if (depths[depths.length - 1] !== empties && empties <= maxDepth) depths.push(empties);
    }
    for (var di = 0; di < depths.length; di++) {
      var depth = depths[di];
      var alpha = -Infinity, beta = Infinity, iterBest = bestM, iterVal = -Infinity;
      try {
        for (var ri = 0; ri < rootList.length; ri++) {
          var rm = rootList[ri].m;
          var q = bbApply(rm, p, o);
          var np = q[0], no = q[1];
          var flips = popcount64(np) - pcnt - 1;
          var v = -negamax(no, np, ocnt - flips, pcnt + 1 + flips, depth - 1, -beta, -alpha, false);
          if (v > iterVal) { iterVal = v; iterBest = rm; }
          if (v > alpha) alpha = v;
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        break;
      }
      bestM = iterBest; bestVal = iterVal; reached = depth;
      /* 上一轮最佳着法优先，提升剪枝效率 */
      for (var rj = 0; rj < rootList.length; rj++) {
        if (rootList[rj].m === bestM) {
          var tmp = rootList[0]; rootList[0] = rootList[rj]; rootList[rj] = tmp;
          break;
        }
      }
      if (deadlineMs && Date.now() > deadlineMs) break;
      if (depth >= empties) break;
    }
    return { m: bestM, value: bestVal, depth: reached };
  }

  /* ---------------- 开局库 ---------------- */
  var BOOK = null;
  var BOOK_LINES = [
    ['f5', 'f6', 'e6', 'f4'],
    ['f5', 'f6', 'e6', 'd6'],
    ['f5', 'f6', 'e6', 'f4', 'f3'],
    ['c4', 'c3', 'f5', 'd6'],
    ['c4', 'f5', 'f6', 'e6'],
    ['e4', 'f4', 'e6', 'c4'],
    ['d3', 'c3', 'f5', 'd6'],
    ['b5', 'c3', 'f5', 'd6']
  ];
  var BOOK_PLY_W = [12, 10, 8, 6, 4];

  function initialBoard() {
    var b = emptyBoard();
    b[3][3] = BLACK; b[4][4] = BLACK;   // d4 / e5（标准初始）
    b[3][4] = WHITE; b[4][3] = WHITE;   // e4 / d5
    return b;
  }

  function buildBook() {
    BOOK = {};
    for (var li = 0; li < BOOK_LINES.length; li++) {
      var line = BOOK_LINES[li];
      var b = initialBoard(), player = BLACK, ok = true;
      for (var pi = 0; pi < line.length && pi < 4; pi++) {
        var rc = rcOfCoord(line[pi]);
        var flips = getFlips(b, rc.r, rc.c, player);
        if (!flips.length) { ok = false; break; }
        var bb = bbFromSimple(b, player);
        var key = (bb.p << 64n) | bb.o;
        if (!BOOK[key]) BOOK[key] = {};
        BOOK[key][rc.r * SIZE + rc.c] = (BOOK[key][rc.r * SIZE + rc.c] || 0) + BOOK_PLY_W[pi];
        b[rc.r][rc.c] = player;
        for (var fi = 0; fi < flips.length; fi++) b[flips[fi].r][flips[fi].c] = player;
        player = OPP[player];
      }
      if (!ok) continue;
    }
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619 >>> 0;
    return h;
  }

  function bookLookup(player) {
    if (!BOOK) buildBook();
    if (moveNumber >= 4) return null;
    var bb = boardToBB(board, player);
    var key = (bb.p << 64n) | bb.o;
    var entry = BOOK[key];
    if (!entry) return null;
    var cand = [], total = 0;
    for (var idx in entry) {
      if (!entry.hasOwnProperty(idx)) continue;
      cand.push({ idx: Number(idx), w: entry[idx] });
      total += entry[idx];
    }
    if (!cand.length) return null;
    var seed = (hashStr(key.toString(36)) ^ (bookSeed >>> 0)) >>> 0;
    var pick = seed % total;
    var chosen = cand[cand.length - 1];
    for (var i = 0; i < cand.length; i++) {
      if (pick < cand[i].w) { chosen = cand[i]; break; }
      pick -= cand[i].w;
    }
    return { r: Math.floor(chosen.idx / SIZE), c: chosen.idx % SIZE, book: true };
  }

  /** 选点：先开局库，再精确/迭代搜索 */
  function chooseMove(player, opts) {
    opts = opts || {};
    var book = opts.book ? bookLookup(player) : null;
    if (book) return book;
    var bb = boardToBB(board, player);
    var empties = 64 - bb.pc - bb.oc;
    var legal = bbLegal(bb.p, bb.o);
    if (legal === 0n) return null;
    var maxDepth = 6, budget = 500;
    if (opts.level === 'easy') { maxDepth = 2; budget = 120; }
    else if (opts.level === 'medium') { maxDepth = 5; budget = 320; }
    else if (opts.level === 'hard') { maxDepth = 9; budget = 650; }
    if (opts.hint) { maxDepth = 9; budget = 700; }
    var exact = empties <= 12;
    var r = searchRoot(bb.p, bb.o, bb.pc, bb.oc, maxDepth, budget, exact);
    var m = r.m;
    if (m === 0n) {
      var rem = legal;
      m = rem & -rem;
    }
    return {
      r: Math.floor(bbIndex(m) / SIZE), c: bbIndex(m) % SIZE,
      value: r.value, depth: r.depth, exact: exact, book: false
    };
  }

  function aiDelay() {
    return difficulty === 'easy' ? 360 : difficulty === 'hard' ? 520 : 440;
  }

  function maybeAi() {
    if (gameOver || paused || mode !== 'ai' || current !== WHITE) return;
    if (aiThinking) return;
    aiThinking = true;
    boardEl.classList.add('thinking');
    render();
    turnMessage();
    var token = turnToken;
    clearTimeout(aiTimer);
    aiTimer = setTimeout(function () {
      if (token !== turnToken || gameOver || paused || mode !== 'ai' || current !== WHITE) {
        aiThinking = false;
        boardEl.classList.remove('thinking');
        return;
      }
      aiMove();
    }, aiDelay());
  }

  function aiMove() {
    aiThinking = false;
    boardEl.classList.remove('thinking');
    if (gameOver || paused || current !== WHITE) return;
    var mv = chooseMove(WHITE, { level: difficulty, book: true });
    if (!mv) { afterMove([]); return; }
    place(mv.r, mv.c, null, true);
  }

  /* ============================================================
     对局流程
     ============================================================ */
  function makeSnapshot() {
    var s = countPieces();
    return {
      board: cloneBoard(board),
      current: current,
      lastMove: lastMove ? { r: lastMove.r, c: lastMove.c } : null,
      moveNumber: moveNumber,
      score: { b: s.b, w: s.w },
      streak: streak
    };
  }
  function pushHistory() {
    history.push(makeSnapshot());
    if (history.length > UNDO_LIMIT) history.shift();
  }
  function restoreSnapshot(s) {
    board = cloneBoard(s.board);
    current = s.current;
    lastMove = s.lastMove ? { r: s.lastMove.r, c: s.lastMove.c } : null;
    moveNumber = s.moveNumber || 0;
  }

  function msgTurn() {
    var empty = SIZE * SIZE - countPieces().b - countPieces().w;
    var base;
    if (mode === 'ai') base = current === BLACK ? T('gs.reversi.yourTurnBlack') : T('gs.reversi.aiThinking');
    else base = current === BLACK ? T('gs.reversi.blackTurn') : T('gs.reversi.whiteTurn');
    if (empty > 0 && empty <= 8) base += ' · ' + T('gs.reversi.nearEnd').replace('{n}', empty);
    setMessage(base, '');
  }

  /** 落子（mv 可空，自动求翻转）。isAi=true 表示 AI 代打 */
  function place(r, c, mv, isAi) {
    if (gameOver || paused) return false;
    if (!isAi && !playerCanAct()) return false;
    if (mode === 'ai' && current !== WHITE && isAi) return false;
    var flips = mv && mv.flips ? mv.flips : getFlips(board, r, c, current);
    if (!flips.length) return false;

    clearHint();
    pushHistory();
    var before = countPieces();
    board[r][c] = current;
    for (var i = 0; i < flips.length; i++) board[flips[i].r][flips[i].c] = current;
    var after = countPieces();
    var changed = [{ r: r, c: c }].concat(flips);
    lastMove = { r: r, c: c };
    moveNumber++;
    cursor = { r: r, c: c };

    if (window.Arcade && Arcade.juice) Arcade.juice.move();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('flip');
    if (window.Arcade && Arcade.fx) {
      var rc = cells[r * SIZE + c].getBoundingClientRect();
      Arcade.fx.burst(rc.left + rc.width / 2, rc.top + rc.height / 2,
        current === BLACK ? 'var(--neon-pink)' : 'var(--neon-cyan)', 8);
    }

    /* 大翻盘：单步翻转 ≥8 或分差骤变 ≥12 → 屏震 + 粒子 */
    var swing = Math.abs((after.b - after.w) - (before.b - before.w));
    if ((flips.length >= 8 || swing >= 12) && !isAi) {
      if (window.Arcade && Arcade.fx) {
        Arcade.fx.shake(boardEl);
        Arcade.fx.centerBurst('var(--neon-yellow)', 22);
      }
      setMessage(T('gs.rv.bigFlip'), 'var(--neon-yellow)');
    }

    afterMove(changed, isAi);
    writeSave();
    return true;
  }

  function afterMove(changed, isAi) {
    if (gameOver) return;
    var opp = OPP[current];
    var oppMoves = legalMoves(board, opp);
    var myMoves = legalMoves(board, current);

    if (oppMoves.length === 0 && myMoves.length === 0) {
      render(changed);
      finishGame(null, false);
      return;
    }
    if (oppMoves.length === 0) {
      var name = opp === BLACK ? T('gs.reversi.blackName') : T('gs.reversi.whiteName');
      setMessage(T('gs.reversi.skip').replace('{n}', name), 'var(--neon-yellow)');
      render(changed);
      turnMessage();
      maybeAi();
      return;
    }
    current = opp;
    turnMessage();
    msgTurn();
    render(changed);
    maybeAi();
  }

  /* ---------- 撤销 ---------- */
  function undo() {
    if (gameOver || !history.length) return false;
    clearTimeout(aiTimer);
    aiThinking = false;
    boardEl.classList.remove('thinking');
    turnToken++;
    var restored = false;
    while (history.length) {
      var s = history.pop();
      restoreSnapshot(s);
      restored = true;
      if (mode !== 'ai' || current === BLACK) break;
    }
    if (!restored) return false;
    gameOver = false;
    boardEl.classList.remove('finished');
    hideOverlay();
    clearHint();
    paused = false;
    hidePause();
    turnMessage();
    setMessage(T('gs.rv.undoDone'), 'var(--neon-cyan)');
    render();
    writeSave();
    return true;
  }

  /* ---------- 提示 ---------- */
  function restoreHintLabel() {
    hintBtn.innerHTML = T('gs.rv.hint') + '<span class="rv-key">H</span>';
    hintBtn.classList.remove('rv-cooling');
    hintBtn.style.removeProperty('--cd');
  }
  function resetHintCooldown() {
    if (hintTimerId) { clearInterval(hintTimerId); hintTimerId = null; }
    hintReadyAt = 0;
    restoreHintLabel();
  }
  function startHintCooldown() {
    hintReadyAt = Date.now() + HINT_CD;
    hintBtn.classList.add('rv-cooling');
    if (hintTimerId) clearInterval(hintTimerId);
    hintTimerId = setInterval(function () {
      var left = hintReadyAt - Date.now();
      if (left <= 0) {
        clearInterval(hintTimerId);
        hintTimerId = null;
        hintBtn.classList.remove('rv-cooling');
        hintBtn.style.removeProperty('--cd');
        restoreHintLabel();
        return;
      }
      var pct = Math.max(0, Math.min(100, (left / HINT_CD) * 100));
      hintBtn.style.setProperty('--cd', pct.toFixed(1) + '%');
      hintBtn.innerHTML = T('gs.rv.hintCool').replace('{s}', (left / 1000).toFixed(1)) +
        '<span class="rv-key">H</span>';
    }, 100);
  }

  function requestHint() {
    if (gameOver || paused || aiThinking) return false;
    if (mode === 'ai' && current !== BLACK) return false;
    if (Date.now() < hintReadyAt) {
      setMessage(T('gs.rv.hintWait').replace('{s}', ((hintReadyAt - Date.now()) / 1000).toFixed(1)), 'var(--neon-yellow)');
      return false;
    }
    var mv = chooseMove(current, { hint: true, book: true });
    if (!mv) return false;
    var bb = boardToBB(board, current);
    var base = evalBB(bb.p, bb.o, bb.pc, bb.oc);
    var gain;
    if (mv.book) {
      var bookFlips = getFlips(board, mv.r, mv.c, current).length;
      gain = Math.max(1, bookFlips + (mv.r === 0 || mv.r === 7 || mv.c === 0 || mv.c === 7 ? 6 : 3));
    } else {
      if (mv.exact) {
        var vv = Math.abs(mv.value);
        var discGain = Math.round((vv >= 500000 ? vv - 500000 : vv) / 1000);
        gain = Math.max(1, discGain);
      } else {
        gain = Math.max(1, Math.round((mv.value - base) / 12));
      }
    }
    hintCell = { r: mv.r, c: mv.c };
    hintGain = Math.min(99, gain);
    clearTimeout(aiTimer);
    boardEl.classList.remove('thinking');
    aiThinking = false;
    render();
    setMessage(T('gs.rv.hintUsed').replace('{c}', coordOf(mv.r, mv.c)).replace('{n}', hintGain), 'var(--neon-cyan)');
    startHintCooldown();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
    return true;
  }

  /* ---------- 暂停 ---------- */
  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    render();
    if (paused) {
      clearTimeout(aiTimer);
      aiThinking = false;
      boardEl.classList.remove('thinking');
      boardEl.classList.add('paused');
      pauseMask.classList.remove('hidden');
      pauseTitle.textContent = T('gs.rv.paused');
      pauseSub.textContent = T('gs.rv.pauseHint');
      pauseBtn.innerHTML = T('gs.rv.resume') + '<span class="rv-key">P</span>';
      setMessage(T('gs.rv.paused'), 'var(--neon-yellow)');
      turnMessage();
    } else {
      hidePause();
      boardEl.classList.remove('paused');
      pauseMask.classList.add('hidden');
      pauseBtn.innerHTML = T('gs.rv.pause') + '<span class="rv-key">P</span>';
      turnMessage();
      msgTurn();
      maybeAi();
    }
  }

  /* ---------- 开局 ---------- */
  function init(opts) {
    opts = opts || {};
    if (opts.mode === 'ai' || opts.mode === 'pvp') mode = opts.mode;
    if (opts.difficulty) difficulty = opts.difficulty;
    if (opts.diff) difficulty = opts.diff === 2 ? 'easy' : opts.diff === 6 ? 'hard' : opts.diff === 4 ? 'medium' : difficulty;
    /* 先读取连胜（含历史存档兼容），再清理旧存档 */
    var keptStreak = readStreak();
    clearSave();
    clearTimeout(aiTimer);
    turnToken++;
    aiThinking = false;
    paused = false;
    gameOver = false;
    history = [];
    lastMove = null;
    moveNumber = 0;
    cursor = null;
    clearHint();
    resetHintCooldown();
    streak = keptStreak;
    writeStreak(streak);
    bookSeed = Math.floor(Math.random() * 1e9);
    board = initialBoard();
    current = BLACK;
    hideOverlay();
    hidePause();
    boardEl.classList.remove('thinking', 'finished', 'paused');
    pauseMask.classList.add('hidden');
    syncModeButtons();
    syncDiffButtons();
    turnMessage();
    updateMeta();
    setMessage(mode === 'ai' ? T('gs.reversi.startAi') : T('gs.reversi.startBlack'), '');
    render();
    writeSave();
  }

  /* ============================================================
     交互
     ============================================================ */
  function feedbackIllegal() {
    if (window.Arcade && Arcade.audio) Arcade.audio.play('error');
    setMessage(T('gs.rv.illegal'), 'var(--neon-pink)');
  }

  function tryMoveAt(r, c) {
    if (!playerCanAct()) {
      if (!gameOver && mode === 'ai' && current !== BLACK) feedbackIllegal();
      return false;
    }
    var moves = legalMoves(board, current);
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].r === r && moves[i].c === c) {
        cursor = { r: r, c: c };
        return place(r, c, moves[i], false);
      }
    }
    feedbackIllegal();
    return false;
  }

  function onCellClick(e) {
    if (gameOver || aiThinking) return;
    if (mode === 'ai' && current !== BLACK) return;
    var idx = Number(e.currentTarget.getAttribute('data-i'));
    tryMoveAt(Math.floor(idx / SIZE), idx % SIZE);
  }

  function moveCursor(dr, dc) {
    if (!cursor) cursor = { r: 3, c: 3 };
    cursor.r = Math.max(0, Math.min(SIZE - 1, cursor.r + dr));
    cursor.c = Math.max(0, Math.min(SIZE - 1, cursor.c + dc));
    render();
  }

  function typingTarget(t) {
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || !!t.isContentEditable;
  }

  function onKeyDown(e) {
    if (!active) return;
    if (typingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.tut-overlay')) return;
    var search = document.querySelector('.search-overlay.open');
    if (search) return;
    if (!ovWrap.classList.contains('hidden')) return;

    var k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      if (k === 'ArrowUp') moveCursor(-1, 0);
      else if (k === 'ArrowDown') moveCursor(1, 0);
      else if (k === 'ArrowLeft') moveCursor(0, -1);
      else moveCursor(0, 1);
      return;
    }
    if (k === 'Enter' || k === ' ') {
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'button' || tag === 'a') return;
      e.preventDefault();
      if (!cursor) {
        var first = legalMoves(board, current);
        if (first.length) cursor = { r: first[0].r, c: first[0].c };
      }
      if (cursor) tryMoveAt(cursor.r, cursor.c);
      return;
    }
    if (e.repeat) return;
    if (k === 'u' || k === 'U' || k === 'z' || k === 'Z') { e.preventDefault(); undo(); return; }
    if (k === 'h' || k === 'H') { e.preventDefault(); requestHint(); return; }
    if (k === 'p' || k === 'P') { e.preventDefault(); togglePause(); return; }
  }

  /* ---------- 按钮 ---------- */
  undoBtn.addEventListener('click', function () {
    if (!undo() && window.Arcade && Arcade.audio) Arcade.audio.play('error');
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
  });
  hintBtn.addEventListener('click', function () { requestHint(); });
  pauseBtn.addEventListener('click', function () { togglePause(); if (window.Arcade && Arcade.audio) Arcade.audio.play('ui'); });
  restartBtn.addEventListener('click', function () { init(); if (window.Arcade && Arcade.audio) Arcade.audio.play('ui'); });
  pauseMask.addEventListener('click', function () { if (paused) togglePause(); });

  for (var mb = 0; mb < modeBtns.length; mb++) {
    modeBtns[mb].addEventListener('click', function (e) {
      var next = e.currentTarget.getAttribute('data-mode');
      if (next === mode) return;
      mode = next;
      init();
      if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
    });
  }
  for (var db = 0; db < diffBtns.length; db++) {
    diffBtns[db].addEventListener('click', function (e) {
      if (mode !== 'ai') return;
      difficulty = e.currentTarget.getAttribute('data-diff');
      syncDiffButtons();
      updateMeta();
      if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
    });
  }

  var DIFF_ORDER = ['easy', 'medium', 'hard'];
  function cycleDifficulty() {
    var idx = DIFF_ORDER.indexOf(difficulty);
    difficulty = DIFF_ORDER[(idx + 1) % DIFF_ORDER.length];
    init();
  }

  ovWrap.querySelector('#rv-ov-again').addEventListener('click', function () {
    init();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
  });
  ovWrap.querySelector('#rv-ov-diff').addEventListener('click', function () {
    cycleDifficulty();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
  });
  ovWrap.querySelector('#rv-ov-mode').addEventListener('click', function () {
    mode = mode === 'ai' ? 'pvp' : 'ai';
    init();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
  });
  ovWrap.querySelector('#rv-ov-close').addEventListener('click', function () {
    hideOverlay();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
  });

  window.addEventListener('keydown', onKeyDown);

  /* ============================================================
     QA 钩子（仅 ?qa=1；正常访问不暴露）
     ============================================================ */
  function qaState() {
    return {
      board: cloneBoard(board),
      current: current === BLACK ? 'b' : 'w',
      mode: mode,
      difficulty: difficulty,
      over: gameOver,
      paused: paused,
      aiThinking: aiThinking,
      streak: streak,
      best: bestScore(),
      lastSubmitted: lastSubmitted,
      canUndo: history.length > 0,
      history: history.length,
      hint: hintCell ? { r: hintCell.r, c: hintCell.c, gain: hintGain } : null,
      hintReadyIn: Math.max(0, Math.round(hintReadyAt - Date.now())),
      moveNumber: moveNumber,
      lastMove: lastMove ? { r: lastMove.r, c: lastMove.c } : null,
      cursor: cursor ? { r: cursor.r, c: cursor.c } : null,
      legal: legalMoves(board, current).map(function (m) {
        return { r: m.r, c: m.c, coord: coordOf(m.r, m.c) };
      }),
      scores: countPieces()
    };
  }

  function forceFinish(winner) {
    clearTimeout(aiTimer);
    aiThinking = false;
    paused = false;
    hidePause();
    gameOver = false;
    history = [];
    var b = emptyBoard();
    var blackCount = winner === BLACK ? 42 : winner === WHITE ? 22 : 32;
    var n = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        b[r][c] = n < blackCount ? BLACK : WHITE;
        n++;
      }
    }
    board = b;
    current = winner === WHITE ? WHITE : BLACK;
    lastMove = { r: 7, c: 7 };
    moveNumber = 64;
    render();
    finishGame(winner, true);
    return qaState();
  }

  if (isQA) {
    window.__qa = {
      state: qaState,
      start: function (opts) { init(opts || {}); return qaState(); },
      move: function (r, c) {
        var ok = tryMoveAt(Number(r), Number(c));
        var s = qaState();
        s.ok = ok;
        return s;
      },
      clickAt: function (r, c) {
        var cell = cells[Number(r) * SIZE + Number(c)];
        if (cell) cell.click();
        return qaState();
      },
      undo: function () {
        var ok = undo();
        var s = qaState();
        s.ok = ok;
        return s;
      },
      hint: function () {
        var ok = requestHint();
        var s = qaState();
        s.ok = ok;
        return s;
      },
      pause: function () { togglePause(); return qaState(); },
      win: function () { return forceFinish(BLACK); },
      lose: function () { return forceFinish(WHITE); },
      draw: function () { return forceFinish(0); },
      bestMove: function (player) {
        return chooseMove(player === 'w' ? WHITE : BLACK, { level: difficulty, book: false });
      },
      bookMove: function (player) {
        return bookLookup(player === 'w' ? WHITE : BLACK);
      },
      setBoard: function (rows) {
        if (!Array.isArray(rows) || rows.length !== SIZE) return false;
        board = rows.map(function (row) { return row.slice(); });
        gameOver = false; history = []; lastMove = null; moveNumber = 0;
        render(); return qaState();
      }
    };
  }

  /* ============================================================
     启动
     ============================================================ */
  window.GAME_RESTART = function () { init(); };

  var resumed = false;
  if (window.Arcade && Arcade.savegame) resumed = Arcade.savegame.resume();
  if (!resumed) { mode = 'pvp'; difficulty = 'medium'; init(); }

})();
