/* ============================================================
   五子棋 · 旗舰版
   - 15×15；双人对弈 / 人机三档 / 残局挑战
   - 棋型评估 + 邻域候选 + alpha-beta 限时搜索 + 迭代加深
   - 可开禁手（黑棋长连 / 双四 / 双三判负）
   - 十二道黑先三手内必胜残局，进度独立存档
   - 键盘光标 / 触控吸附 / 发光连珠 / 粒子 / 屏震 / 结算面板
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.gomoku.tut1t'), d: T('gs.gomoku.tut1') },
    { t: T('gs.gomoku.tut2t'), d: T('gs.gomoku.tut2') },
    { t: T('gs.gomoku.tut3t'), d: T('gs.gomoku.tut3') }
  ];

  var SIZE = 15, LOGICAL = 600, MARGIN = 20, CELL = 40;
  var EMPTY = 0, BLACK = 1, WHITE = 2;
  var PI2 = Math.PI * 2;

  var MODE_KEYS = { pvp: 'pvp', easy: 'aiEasy', medium: 'aiMedium', hard: 'aiHard', puzzle: 'modePuzzle' };

  root.innerHTML =
    '<div class="gk-wrap">' +
    '  <div class="gk-top">' +
    '    <span class="gk-pill"><i class="gk-dot black" id="gk-turn-dot"></i><b id="gk-turn-label">' + T('gs.gomoku.blackTurn') + '</b></span>' +
    '    <span class="gk-pill">' + T('gs.gomoku.stepsLabel') + ' <b id="gk-moves">0</b></span>' +
    '    <span class="gk-pill streak">' + T('gs.gomoku.streakLabel') + ' <b id="gs-streak">0</b></span>' +
    '    <span class="gk-pill best">' + T('gs.gomoku.bestStreakLabel') + ' <b id="gs-best">0</b></span>' +
    '  </div>' +
    '  <div class="game-message" id="msg" aria-live="polite">' + T('gs.gomoku.blackTurn') + '</div>' +
    '  <div class="gk-board-wrap">' +
    '    <canvas id="board" class="game-canvas gomoku-canvas" width="600" height="600" aria-label="' + T('gs.gomoku.boardAria') + '"></canvas>' +
    '    <span class="gk-badge" id="gk-badge" hidden></span>' +
    '  </div>' +
    '  <div class="gk-sub" id="gk-sub"></div>' +
    '  <div class="game-controls gk-modes" id="mode-controls">' +
    '    <button class="btn mode-btn active" data-mode="pvp">' + T('gs.gomoku.pvp') + '</button>' +
    '    <button class="btn purple mode-btn" data-mode="easy">' + T('gs.gomoku.aiEasy') + '</button>' +
    '    <button class="btn yellow mode-btn" data-mode="medium">' + T('gs.gomoku.aiMedium') + '</button>' +
    '    <button class="btn pink mode-btn" data-mode="hard">' + T('gs.gomoku.aiHard') + '</button>' +
    '    <button class="btn mode-btn gk-puzzle-btn" data-mode="puzzle">' + T('gs.gomoku.modePuzzle') + '</button>' +
    '  </div>' +
    '  <div class="game-controls gk-acts">' +
    '    <button id="undo-btn" class="btn yellow">' + T('gs.gomoku.undo') + '</button>' +
    '    <button id="restart-btn" class="btn green">' + T('gs.gomoku.restart') + '</button>' +
    '    <button id="forbidden-btn" class="btn pink" aria-pressed="false">' + T('gs.gomoku.forbidden') + ' ' + T('gs.gomoku.off') + '</button>' +
    '  </div>' +
    '  <div class="gk-keyhint">' + T('gs.gomoku.keyHint') + '</div>' +
    '  <div class="help-text" id="gk-help">' + T('gs.gomoku.help') + '</div>' +
    '  <div id="gk-help-long" style="font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:10px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px">' + T('gs.gomoku.helpText') + '</div>' +
    '</div>' +
    '<div class="gk-overlay hidden" id="gk-overlay" role="dialog" aria-modal="true">' +
    '  <div class="gk-modal">' +
    '    <div class="gk-res-title" id="gk-res-title"></div>' +
    '    <div class="gk-res-sub" id="gk-res-sub"></div>' +
    '    <div class="gk-res-grid" id="gk-res-grid"></div>' +
    '    <div class="game-controls gk-res-actions" id="gk-res-actions"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="gk-overlay hidden" id="gk-picker" role="dialog" aria-modal="true">' +
    '  <div class="gk-modal">' +
    '    <div class="gk-res-title" id="gk-pk-title"></div>' +
    '    <div class="gk-res-sub" id="gk-pk-sub"></div>' +
    '    <div class="gk-pk-list" id="gk-pk-list"></div>' +
    '    <div class="game-controls"><button class="btn" id="gk-pk-close">' + T('gs.gomoku.close') + '</button></div>' +
    '  </div>' +
    '</div>';

  var msgEl = document.getElementById('msg');
  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var undoBtn = document.getElementById('undo-btn');
  var restartBtn = document.getElementById('restart-btn');
  var forbiddenBtn = document.getElementById('forbidden-btn');
  var modeControls = document.getElementById('mode-controls');
  var modeBtns = modeControls.querySelectorAll('.mode-btn');
  var turnDot = document.getElementById('gk-turn-dot');
  var turnLabel = document.getElementById('gk-turn-label');
  var movesEl = document.getElementById('gk-moves');
  var streakEl = document.getElementById('gs-streak');
  var bestEl = document.getElementById('gs-best');
  var subEl = document.getElementById('gk-sub');
  var badgeEl = document.getElementById('gk-badge');
  var overlayEl = document.getElementById('gk-overlay');
  var resTitle = document.getElementById('gk-res-title');
  var resSub = document.getElementById('gk-res-sub');
  var resGrid = document.getElementById('gk-res-grid');
  var resActions = document.getElementById('gk-res-actions');
  var pickerEl = document.getElementById('gk-picker');
  var pkTitle = document.getElementById('gk-pk-title');
  var pkSub = document.getElementById('gk-pk-sub');
  var pkList = document.getElementById('gk-pk-list');
  var pkClose = document.getElementById('gk-pk-close');

  /* ---------- 状态 ---------- */
  var board = [], current = BLACK, moves = [];
  var gameOver = false, winCells = null, winnerSide = EMPTY, endReason = '';
  var mode = 'pvp', lastMode = 'pvp', screen = 'game';
  var forbiddenOn = false;
  var aiThinking = false, aiTimer = null, hintTimer = null, resultTimer = null;
  var aiToken = 0, aiPlaced = 0, openingIdx = -1;
  var cursor = { r: 7, c: 7 }, cursorOn = true, hoverCell = null;
  var pieceAnim = {}, hintCell = null, hintUntil = 0;
  var particles = [], winT0 = 0, lastFrame = 0;
  var puzzleIdx = -1, puzzleBlackMoves = 0;

  /* ---------- 持久化 ---------- */
  var STREAK_KEY = 'arcade_gomoku_streak_v1';
  var PUZZLE_KEY = 'arcade_gomoku_puzzle_v1';

  function loadStreak() {
    try {
      var v = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function saveStreak() {
    try { localStorage.setItem(STREAK_KEY, String(streak)); } catch (e) {}
  }
  function loadSolved() {
    try {
      var arr = JSON.parse(localStorage.getItem(PUZZLE_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (id) {
        for (var i = 0; i < PUZZLES.length; i++) if (PUZZLES[i].id === id) return true;
        return false;
      });
    } catch (e) { return []; }
  }
  function saveSolved() {
    try { localStorage.setItem(PUZZLE_KEY, JSON.stringify(solved)); } catch (e) {}
  }

  var streak = loadStreak();
  var solved = [];

  function bestStreak() {
    var b = 0;
    try { b = (Arcade.storage && Arcade.storage.getBest('gomoku')) || 0; } catch (e) { b = 0; }
    return Math.max(b, streak);
  }

  /* ---------- 断点续玩 ---------- */
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }

  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'gomoku',
      collect: function () {
        if (gameOver) return null;
        var s = {
          board: board, current: current, moves: moves, streak: streak,
          forbidden: forbiddenOn, screen: screen, mode: screen === 'puzzle' ? 'puzzle' : mode,
          lastMode: lastMode
        };
        if (screen === 'puzzle') {
          s.puzzleIdx = puzzleIdx;
          s.puzzleBlackMoves = puzzleBlackMoves;
        }
        return s;
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
        if (!Array.isArray(s.moves)) return false;
        var m = s.screen === 'puzzle' ? 'puzzle' : s.mode;
        if (m !== 'pvp' && m !== 'easy' && m !== 'medium' && m !== 'hard' && m !== 'puzzle') return false;
        if (m === 'puzzle') {
          if (!(typeof s.puzzleIdx === 'number' && s.puzzleIdx >= 0 && s.puzzleIdx < PUZZLES.length)) return false;
          if (!(typeof s.puzzleBlackMoves === 'number' && s.puzzleBlackMoves >= 0 && s.puzzleBlackMoves <= 3)) return false;
        }
        board = s.board.map(function (row) { return row.slice(); });
        current = s.current;
        moves = [];
        for (var mi = 0; mi < s.moves.length; mi++) {
          var mv = s.moves[mi];
          if (!mv || typeof mv.r !== 'number' || typeof mv.c !== 'number') continue;
          if (mv.r < 0 || mv.r >= SIZE || mv.c < 0 || mv.c >= SIZE) continue;
          if (mv.player !== BLACK && mv.player !== WHITE) continue;
          moves.push({ r: mv.r, c: mv.c, player: mv.player });
        }
        mode = m;
        lastMode = (s.lastMode === 'pvp' || s.lastMode === 'easy' || s.lastMode === 'medium' || s.lastMode === 'hard') ? s.lastMode : 'pvp';
        screen = m === 'puzzle' ? 'puzzle' : 'game';
        if (screen === 'puzzle') {
          puzzleIdx = s.puzzleIdx;
          puzzleBlackMoves = s.puzzleBlackMoves;
        } else {
          puzzleIdx = -1;
          puzzleBlackMoves = 0;
        }
        forbiddenOn = !!s.forbidden;
        streak = Math.max(Number(s.streak) || 0, loadStreak());
        solved = loadSolved();
        gameOver = false; winCells = null; winnerSide = EMPTY; endReason = '';
        aiThinking = false; aiToken++;
        clearTimers();
        pieceAnim = {}; particles = []; hintCell = null; cursorOn = true;
        aiPlaced = 0;
        for (var wi = 0; wi < moves.length; wi++) if (moves[wi].player === WHITE) aiPlaced++;
        hideOverlay(); hidePicker();
        syncModeUI();
        updateHud();
        updateUndoBtn();
        if (screen === 'puzzle') {
          current = current === WHITE ? WHITE : BLACK;
          if (current === WHITE) startPuzzleReply(); else { setTurnMessage(); draw(); }
        } else if (mode !== 'pvp' && current === WHITE) {
          startAiThink();
        } else {
          setTurnMessage();
          draw();
        }
        return true;
      }
    });
  }

  /* ---------- 常量 / 工具 ---------- */
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  var STARS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
  var INF = 1e9, WIN_VAL = 1e8;
  var EVAL_K = [0, 3, 34, 820, 13000, 1000000];

  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function buzz() { if (Arcade.audio && Arcade.audio.play) Arcade.audio.play('error'); }
  function inB(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function px(i) { return MARGIN + i * CELL; }
  function newBoard() {
    var b = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(EMPTY);
      b.push(row);
    }
    return b;
  }
  function flatBoard() {
    var a = new Int8Array(SIZE * SIZE);
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) a[r * SIZE + c] = board[r][c];
    }
    return a;
  }
  function isFull() {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (board[r][c] === EMPTY) return false;
    return true;
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function tierName(t) { return T('gs.gomoku.' + (t === 1 ? 'tierEasy' : t === 2 ? 'tierMedium' : 'tierHard')); }
  function tierSub(t) { return T('gs.gomoku.' + (t === 1 ? 'tierEasySub' : t === 2 ? 'tierMediumSub' : 'tierHardSub')); }
  function modeLabel(m) { return T('gs.gomoku.' + (MODE_KEYS[m] || 'pvp')); }
  function clearTimers() {
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
  }

  /* ---------- 画布尺寸 ---------- */
  var scale = 1;
  function layoutCanvas() {
    var rect = canvas.getBoundingClientRect();
    var cssW = rect.width;
    if (!cssW) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var bw = Math.round(cssW * dpr);
    if (canvas.width !== bw || canvas.height !== bw) {
      canvas.width = bw;
      canvas.height = bw;
    }
    scale = bw / LOGICAL;
  }
  layoutCanvas();
  window.addEventListener('resize', function () { layoutCanvas(); draw(); });
  if (window.ResizeObserver) {
    try { new ResizeObserver(function () { layoutCanvas(); draw(); }).observe(canvas); } catch (e) {}
  }

  /* ---------- 木纹缓存 ---------- */
  var wood = [];
  (function () {
    var seed = 987654;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < 30; i++) {
      wood.push({ x: rnd() * LOGICAL, w: 1 + rnd() * 4, a: 0.03 + rnd() * 0.07, tilt: (rnd() - 0.5) * 8 });
    }
  })();

  /* ---------- 绘制 ---------- */
  function pieceRadiusAt(r, c, t) {
    var key = r * SIZE + c;
    var st = pieceAnim[key];
    if (!st) return CELL * 0.42;
    var p = (t - st) / 210;
    if (p >= 1) { delete pieceAnim[key]; return CELL * 0.42; }
    var c1 = 1.70158, c3 = c1 + 1;
    var e = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    return CELL * 0.42 * (0.35 + 0.65 * e);
  }

  function drawPiece(r, c, p, rad) {
    var x = px(c), y = px(r);
    ctx.save();
    ctx.shadowColor = p === BLACK ? 'rgba(0,240,255,.4)' : 'rgba(255,255,255,.6)';
    ctx.shadowBlur = p === BLACK ? 9 : 12;
    var g = ctx.createRadialGradient(x - rad * 0.34, y - rad * 0.36, rad * 0.08, x, y, rad);
    if (p === BLACK) {
      g.addColorStop(0, '#6d7480');
      g.addColorStop(0.55, '#20242c');
      g.addColorStop(1, '#05070a');
    } else {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#f2f3f6');
      g.addColorStop(1, '#c4c9d2');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, PI2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = p === BLACK ? 'rgba(0,240,255,.45)' : 'rgba(255,255,255,.85)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - rad * 0.32, y - rad * 0.34, rad * 0.2, 0, PI2);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fill();
    ctx.restore();
  }

  function drawCursor(t) {
    if (!cursorOn || gameOver || aiThinking || !isHumanTurn()) return;
    var x = px(cursor.c), y = px(cursor.r), r = CELL * 0.53, len = 10;
    var a = 0.55 + 0.28 * Math.sin(t / 330);
    var col = current === BLACK ? 'rgba(255,230,0,' + a + ')' : 'rgba(0,240,255,' + a + ')';
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r + len); ctx.lineTo(x - r, y - r); ctx.lineTo(x - r + len, y - r);
    ctx.moveTo(x + r - len, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y - r + len);
    ctx.moveTo(x + r, y + r - len); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - len, y + r);
    ctx.moveTo(x - r + len, y + r); ctx.lineTo(x - r, y + r); ctx.lineTo(x - r, y + r - len);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + p.life * 0.5), 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!board.length) return;
    var t = now();
    var dt = lastFrame ? Math.min(3, (t - lastFrame) / 16.7) : 1;
    lastFrame = t;
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pp = particles[pi];
      pp.x += pp.vx * dt;
      pp.y += pp.vy * dt;
      pp.vy += 0.035 * dt;
      pp.vx *= 0.985;
      pp.life -= 0.022 * dt;
      if (pp.life <= 0) particles.splice(pi, 1);
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);

    var bg = ctx.createLinearGradient(0, 0, LOGICAL, LOGICAL);
    bg.addColorStop(0, '#2a1b10');
    bg.addColorStop(0.5, '#3a2716');
    bg.addColorStop(1, '#201308');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LOGICAL, LOGICAL);
    for (var wi = 0; wi < wood.length; wi++) {
      var wl = wood[wi];
      ctx.fillStyle = 'rgba(0,0,0,' + wl.a + ')';
      ctx.fillRect(wl.x, 0, wl.w, LOGICAL);
    }
    var vig = ctx.createRadialGradient(300, 280, 90, 300, 300, 430);
    vig.addColorStop(0, 'rgba(255,190,90,.06)');
    vig.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, LOGICAL, LOGICAL);

    ctx.strokeStyle = 'rgba(0,240,255,.34)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0,240,255,.55)';
    ctx.shadowBlur = 3;
    for (var k = 0; k < SIZE; k++) {
      ctx.beginPath(); ctx.moveTo(MARGIN, px(k)); ctx.lineTo(px(SIZE - 1), px(k)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(k), MARGIN); ctx.lineTo(px(k), px(SIZE - 1)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,240,255,.72)';
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGIN, MARGIN, CELL * (SIZE - 1), CELL * (SIZE - 1));
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0,240,255,.75)';
    for (var s = 0; s < STARS.length; s++) {
      ctx.beginPath();
      ctx.arc(px(STARS[s][0]), px(STARS[s][1]), 3.5, 0, PI2);
      ctx.fill();
    }

    if (winCells && winCells.length) {
      var wf = winCells[0], wlast = winCells[winCells.length - 1];
      var pulse = 0.66 + 0.34 * Math.sin((t - winT0) / 260);
      var x1 = px(wf.c), y1 = px(wf.r), x2 = px(wlast.c), y2 = px(wlast.r);
      ctx.save();
      var beam = ctx.createLinearGradient(x1, y1, x2, y2);
      beam.addColorStop(0, 'rgba(255,230,0,' + (0.55 * pulse) + ')');
      beam.addColorStop(0.5, 'rgba(57,255,20,' + (0.95 * pulse) + ')');
      beam.addColorStop(1, 'rgba(255,45,149,' + (0.7 * pulse) + ')');
      ctx.strokeStyle = beam;
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(255,230,0,.9)';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -(t - winT0) * 0.09;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * pulse) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      for (var wv = 0; wv < winCells.length; wv++) {
        ctx.strokeStyle = 'rgba(255,230,0,' + (0.55 + 0.35 * pulse) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px(winCells[wv].c), px(winCells[wv].r), CELL * 0.48, 0, PI2);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) drawPiece(r, c, board[r][c], pieceRadiusAt(r, c, t));
      }
    }

    if (moves.length && !winCells) {
      var last = moves[moves.length - 1];
      ctx.save();
      ctx.strokeStyle = last.player === BLACK ? 'rgba(255,230,0,.95)' : 'rgba(0,240,255,.95)';
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px(last.c), px(last.r), CELL * 0.2, 0, PI2);
      ctx.stroke();
      ctx.restore();
    }

    if (hoverCell && !gameOver && isHumanTurn()) {
      var hv = hoverCell;
      if (board[hv.r][hv.c] === EMPTY) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,240,255,.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px(hv.c), px(hv.r), CELL * 0.4, 0, PI2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (hintCell && screen === 'puzzle' && !gameOver && now() < hintUntil) {
      var hp = 0.55 + 0.4 * Math.sin(now() / 200);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,45,149,' + hp + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(px(hintCell.c), px(hintCell.r), CELL * 0.46, 0, PI2);
      ctx.stroke();
      ctx.restore();
    }

    drawParticles();
    drawCursor(t);

    if (aiThinking) drawThinking(t);
  }

  function drawThinking(t) {
    var a = 0.25 + 0.2 * Math.sin(t / 300);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,' + a + ')';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -t * 0.05;
    ctx.strokeRect(MARGIN - 8, MARGIN - 8, CELL * (SIZE - 1) + 16, CELL * (SIZE - 1) + 16);
    ctx.restore();
  }

  /* ---------- 粒子 ---------- */
  function spawnParticles(r, c, color, n) {
    var x = px(c), y = px(r);
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * PI2;
      var sp = 0.6 + Math.random() * 2.4;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.4, life: 1, size: 1.6 + Math.random() * 2, color: color });
    }
    if (particles.length > 140) particles.splice(0, particles.length - 140);
  }
  function spawnWinParticles(line) {
    for (var i = 0; i < line.length; i++) {
      spawnParticles(line[i].r, line[i].c, i % 2 ? '#39ff14' : '#ffe600', 5);
    }
    if (line.length) {
      spawnParticles(line[0].r, line[0].c, '#ff2d95', 10);
      spawnParticles(line[line.length - 1].r, line[line.length - 1].c, '#39ff14', 10);
    }
  }

  /* ---------- 棋盘 / 胜负 ---------- */
  function checkWin2(r, c, p) {
    for (var d = 0; d < DIRS.length; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1], line = [{ r: r, c: c }], i;
      for (i = 1; i < 5; i++) {
        var rr = r + dr * i, cc = c + dc * i;
        if (!inB(rr, cc) || board[rr][cc] !== p) break;
        line.push({ r: rr, c: cc });
      }
      for (i = 1; i < 5; i++) {
        var rr2 = r - dr * i, cc2 = c - dc * i;
        if (!inB(rr2, cc2) || board[rr2][cc2] !== p) break;
        line.unshift({ r: rr2, c: cc2 });
      }
      if (line.length >= 5) return line;
    }
    return null;
  }

  /* ---------- 棋型 / 禁手（作用于扁平副本，绝不触碰真实棋盘） ---------- */
  function runThrough(a, r, c, dr, dc, p) {
    var n = 1, rr = r + dr, cc = c + dc;
    while (inB(rr, cc) && a[rr * SIZE + cc] === p) { n++; rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inB(rr, cc) && a[rr * SIZE + cc] === p) { n++; rr -= dr; cc -= dc; }
    return n;
  }
  function wouldFive(a, r, c, p) {
    for (var d = 0; d < DIRS.length; d++) if (runThrough(a, r, c, DIRS[d][0], DIRS[d][1], p) >= 5) return true;
    return false;
  }
  function winPoints(a, p) {
    var out = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (a[r * SIZE + c] !== EMPTY) continue;
        if (wouldFive(a, r, c, p)) out.push({ r: r, c: c });
      }
    }
    return out;
  }
  function dirHasFour(a, r, c, dr, dc) {
    for (var k = -4; k <= 4; k++) {
      if (k === 0) continue;
      var rr = r + dr * k, cc = c + dc * k;
      if (!inB(rr, cc) || a[rr * SIZE + cc] !== EMPTY) continue;
      if (runThrough(a, rr, cc, dr, dc, BLACK) >= 5) return true;
    }
    return false;
  }
  function dirHasOpenThree(a, r, c, dr, dc) {
    for (var k = -4; k <= 4; k++) {
      if (k === 0) continue;
      var er = r + dr * k, ec = c + dc * k;
      if (!inB(er, ec) || a[er * SIZE + ec] !== EMPTY) continue;
      if (runThrough(a, er, ec, dr, dc, BLACK) >= 5) continue;
      var completions = 0;
      for (var j = -4; j <= 4; j++) {
        if (j === 0) continue;
        var qr = er + dr * j, qc = ec + dc * j;
        if (!inB(qr, qc) || a[qr * SIZE + qc] !== EMPTY) continue;
        if (runThrough(a, qr, qc, dr, dc, BLACK) >= 5) completions++;
      }
      if (completions >= 2) return true;
    }
    return false;
  }
  /** 黑棋新落一子后的禁手检查；返回 overline / doubleFour / doubleThree 或 null */
  function checkBlackForbidden(a, r, c) {
    var overline = false, five = false;
    for (var d = 0; d < DIRS.length; d++) {
      var run = runThrough(a, r, c, DIRS[d][0], DIRS[d][1], BLACK);
      if (run >= 6) overline = true;
      if (run === 5) five = true;
    }
    if (overline) return 'overline';
    if (five) return null;
    var fours = 0, threes = 0;
    for (var f = 0; f < DIRS.length; f++) {
      var dr = DIRS[f][0], dc = DIRS[f][1];
      if (dirHasFour(a, r, c, dr, dc)) fours++;
      else if (dirHasOpenThree(a, r, c, dr, dc)) threes++;
    }
    if (fours >= 2) return 'doubleFour';
    if (threes >= 2) return 'doubleThree';
    return null;
  }

  /* ---------- AI：评估 / 候选 / 搜索 ---------- */
  var LINES = (function () {
    var out = [];
    for (var d = 0; d < DIRS.length; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      for (var r = 0; r < SIZE; r++) {
        for (var c = 0; c < SIZE; c++) {
          if (inB(r - dr, c - dc)) continue;
          var line = [], rr = r, cc = c;
          while (inB(rr, cc)) { line.push(rr * SIZE + cc); rr += dr; cc += dc; }
          if (line.length >= 5) out.push(line);
        }
      }
    }
    return out;
  })();

  /** 局面评估：五连窗口棋型累计（从 side 视角） */
  function evalFlat(a, side) {
    var opp = side === BLACK ? WHITE : BLACK, me = 0, op = 0;
    for (var li = 0; li < LINES.length; li++) {
      var line = LINES[li], n = line.length;
      for (var i = 0; i <= n - 5; i++) {
        var cp = 0, blocked = false;
        for (var j = 0; j < 5; j++) {
          var v = a[line[i + j]];
          if (v === side) cp++;
          else if (v === opp) { blocked = true; break; }
        }
        if (blocked) continue;
        if (cp) me += EVAL_K[cp];
        var co = 0, blocked2 = false;
        for (var j2 = 0; j2 < 5; j2++) {
          var v2 = a[line[i + j2]];
          if (v2 === opp) co++;
          else if (v2 === side) { blocked2 = true; break; }
        }
        if (!blocked2 && co) op += EVAL_K[co];
      }
    }
    return me - 1.12 * op;
  }

  /** 单点攻势（含双威胁加权），临时落子后恢复 */
  function quickPoint(a, r, c, p) {
    var idx = r * SIZE + c;
    if (a[idx] !== EMPTY) return -1000;
    a[idx] = p;
    var total = 0, fours = 0, threes = 0;
    for (var d = 0; d < DIRS.length; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      var run = 1, open = 0;
      var rr = r + dr, cc = c + dc;
      while (inB(rr, cc) && a[rr * SIZE + cc] === p) { run++; rr += dr; cc += dc; }
      if (inB(rr, cc) && a[rr * SIZE + cc] === EMPTY) open++;
      rr = r - dr; cc = c - dc;
      while (inB(rr, cc) && a[rr * SIZE + cc] === p) { run++; rr -= dr; cc -= dc; }
      if (inB(rr, cc) && a[rr * SIZE + cc] === EMPTY) open++;
      if (run >= 5) {
        a[idx] = EMPTY;
        return 10000000;
      }
      if (run === 4) { fours++; total += open === 2 ? 200000 : 25000; }
      else if (run === 3) {
        if (open === 2) { threes++; total += 5000; }
        else if (open === 1) total += 520;
      } else if (run === 2) {
        total += open === 2 ? 320 : 35;
      } else if (run === 1) {
        total += open === 2 ? 12 : 0;
      }
    }
    if (fours >= 2) total += 400000;
    if (fours >= 1 && threes >= 1) total += 300000;
    if (threes >= 2) total += 150000;
    total += (7 - Math.abs(r - 7)) + (7 - Math.abs(c - 7));
    a[idx] = EMPTY;
    return total;
  }

  /** 邻域候选 + 走法排序 */
  function genMoves(a, side, limit, radius) {
    var rad = radius || 2;
    var mark = new Uint8Array(SIZE * SIZE);
    var pts = [], has = false;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (a[r * SIZE + c] === EMPTY) continue;
        has = true;
        for (var dr = -rad; dr <= rad; dr++) {
          for (var dc = -rad; dc <= rad; dc++) {
            var nr = r + dr, nc = c + dc;
            if (!inB(nr, nc) || a[nr * SIZE + nc] !== EMPTY) continue;
            var key = nr * SIZE + nc;
            if (mark[key]) continue;
            mark[key] = 1;
            pts.push({ r: nr, c: nc });
          }
        }
      }
    }
    if (!has) return [{ r: 7, c: 7 }];
    var opp = side === BLACK ? WHITE : BLACK;
    for (var i = 0; i < pts.length; i++) {
      var m = pts[i];
      m.s = quickPoint(a, m.r, m.c, side) + quickPoint(a, m.r, m.c, opp) * 0.9;
    }
    pts.sort(function (x, y) { return y.s - x.s; });
    return pts.slice(0, limit).map(function (m) { return { r: m.r, c: m.c }; });
  }

  var searchDeadline = 0, searchAborted = false, searchNodes = 0;

  function negamax(a, depth, alpha, beta, side, ply) {
    searchNodes++;
    if ((searchNodes & 31) === 0 && now() > searchDeadline) { searchAborted = true; return 0; }
    if (depth <= 0) return evalFlat(a, side);
    var limit = depth >= 3 ? 8 : 6;
    var radius = depth >= 3 ? 2 : 1;
    var list = genMoves(a, side, limit, radius);
    if (!list.length) return evalFlat(a, side);
    var opp = side === BLACK ? WHITE : BLACK;
    var best = -INF;
    for (var i = 0; i < list.length; i++) {
      var m = list[i], idx = m.r * SIZE + m.c;
      if (a[idx] !== EMPTY) continue;
      a[idx] = side;
      if (wouldFive(a, m.r, m.c, side)) {
        a[idx] = EMPTY;
        return WIN_VAL - ply;
      }
      var v = -negamax(a, depth - 1, -beta, -alpha, opp, ply + 1);
      a[idx] = EMPTY;
      if (searchAborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  function searchBest(a, side, maxDepth, deadline) {
    searchDeadline = deadline;
    searchNodes = 0;
    var root = genMoves(a, side, 14, 2);
    if (!root.length) return null;
    var opp = side === BLACK ? WHITE : BLACK;
    var best = root[0], incumbent = null;
    for (var depth = 2; depth <= maxDepth; depth++) {
      searchAborted = false;
      var alpha = -INF, localBest = null, localVal = -INF;
      var ordered = root.slice();
      if (incumbent) {
        ordered.sort(function (x, y) {
          if (x.r === incumbent.r && x.c === incumbent.c) return -1;
          if (y.r === incumbent.r && y.c === incumbent.c) return 1;
          return 0;
        });
      }
      for (var i = 0; i < ordered.length; i++) {
        if (now() > searchDeadline) { searchAborted = true; break; }
        var m = ordered[i], idx = m.r * SIZE + m.c;
        if (a[idx] !== EMPTY) continue;
        a[idx] = side;
        var v;
        if (wouldFive(a, m.r, m.c, side)) v = WIN_VAL - 1;
        else v = -negamax(a, depth - 1, -INF, -alpha, opp, 1);
        a[idx] = EMPTY;
        if (searchAborted) break;
        if (v > localVal) { localVal = v; localBest = m; }
        if (v > alpha) alpha = v;
      }
      if (!searchAborted && localBest) { best = localBest; incumbent = localBest; }
      if (searchAborted) break;
    }
    return best;
  }

  var OPENINGS = [
    { w1: [-1, 0], w2: [1, 0] },
    { w1: [0, 1], w2: [0, -1] },
    { w1: [1, 1], w2: [-1, -1] },
    { w1: [1, -1], w2: [-1, 1] },
    { w1: [-1, 2], w2: [1, -1] },
    { w1: [2, 1], w2: [-1, 0] },
    { w1: [-2, 0], w2: [2, 0] },
    { w1: [-2, 2], w2: [2, -2] }
  ];
  var BOOK_ALTS = [[0, 1], [1, 0], [1, 1], [-1, 0], [0, -1], [1, -1], [-1, 1], [-1, -1]];

  /** 开局库：前两手按随机合法的定式应手（中等/困难） */
  function openingMove(a) {
    if (mode === 'easy' || aiPlaced >= 2 || moves.length > 3) return null;
    var bm = [];
    for (var i = 0; i < moves.length; i++) if (moves[i].player === BLACK) bm.push(moves[i]);
    if (!bm.length) return null;
    if (openingIdx < 0) openingIdx = Math.floor(Math.random() * OPENINGS.length);
    var open = OPENINGS[openingIdx];
    var ref = aiPlaced === 0 ? bm[0] : (bm[1] || bm[0]);
    var off = aiPlaced === 0 ? open.w1 : open.w2;
    var tries = [off].concat(BOOK_ALTS);
    for (var t = 0; t < tries.length; t++) {
      var r = ref.r + tries[t][0], c = ref.c + tries[t][1];
      if (inB(r, c) && a[r * SIZE + c] === EMPTY) return { r: r, c: c };
    }
    return null;
  }

  function computeAiMove() {
    var a = flatBoard();
    var book = openingMove(a);
    if (book) return book;
    var mine = winPoints(a, WHITE);
    if (mine.length) return mine[0];
    if (mode === 'easy') {
      if (Math.random() < 0.55) {
        var blockEasy = winPoints(a, BLACK);
        if (blockEasy.length) return blockEasy[0];
      }
      var cands = genMoves(a, WHITE, 24, 2);
      if (!cands.length) return null;
      if (Math.random() < 0.4) return cands[0];
      return cands[Math.floor(Math.random() * Math.min(6, cands.length))];
    }
    var oppWin = winPoints(a, BLACK);
    if (oppWin.length === 1) return oppWin[0];
    var deadline = now() + (mode === 'hard' ? 420 : 300);
    var mv = searchBest(a, WHITE, mode === 'hard' ? 4 : 3, deadline);
    if (mv) return mv;
    var fb = genMoves(a, WHITE, 1, 2);
    return fb.length ? fb[0] : null;
  }

  /* ---------- 残局库（黑先，三手内必胜；已用求解器逐题验证） ---------- */
  var PUZZLES = [
    { id: 'p1', tier: 1, stones: [[BLACK,7,5],[BLACK,7,6],[BLACK,7,7],[WHITE,7,9],[WHITE,11,11]] },
    { id: 'p2', tier: 1, stones: [[BLACK,7,9],[BLACK,7,8],[BLACK,7,7],[WHITE,7,5],[WHITE,11,3]] },
    { id: 'p3', tier: 1, stones: [[BLACK,9,7],[BLACK,8,7],[BLACK,7,7],[WHITE,5,7],[WHITE,3,11]] },
    { id: 'p4', tier: 1, stones: [[BLACK,5,7],[BLACK,6,7],[BLACK,7,7],[WHITE,9,7],[WHITE,11,11]] },
    { id: 'p5', tier: 2, stones: [[BLACK,7,3],[BLACK,7,4],[BLACK,7,5],[BLACK,5,6],[BLACK,6,6],[WHITE,7,2]] },
    { id: 'p6', tier: 2, stones: [[BLACK,7,11],[BLACK,7,10],[BLACK,7,9],[BLACK,5,8],[BLACK,6,8],[WHITE,7,12]] },
    { id: 'p7', tier: 2, stones: [[BLACK,11,7],[BLACK,10,7],[BLACK,9,7],[BLACK,8,5],[BLACK,8,6],[WHITE,12,7]] },
    { id: 'p8', tier: 2, stones: [[BLACK,3,7],[BLACK,4,7],[BLACK,5,7],[BLACK,6,5],[BLACK,6,6],[WHITE,2,7]] },
    { id: 'p9', tier: 3, stones: [[BLACK,11,7],[BLACK,10,7],[BLACK,9,7],[BLACK,8,5],[BLACK,8,6],[WHITE,12,7],[WHITE,10,10]] },
    { id: 'p10', tier: 3, stones: [[BLACK,7,11],[BLACK,7,10],[BLACK,7,9],[BLACK,5,8],[BLACK,6,8],[WHITE,7,12],[WHITE,2,2],[BLACK,3,9]] },
    { id: 'p11', tier: 3, stones: [[BLACK,3,7],[BLACK,4,7],[BLACK,5,7],[BLACK,6,5],[BLACK,6,6],[WHITE,2,7],[WHITE,4,12]] },
    { id: 'p12', tier: 3, stones: [[BLACK,3,7],[BLACK,4,7],[BLACK,5,7],[BLACK,6,5],[BLACK,6,6],[WHITE,2,7],[WHITE,2,6],[WHITE,12,2]] }
  ];
  solved = loadSolved();

  /** VCF 强制杀：黑棋在 left 手内是否必胜（白棋只做唯一封堵） */
  function forceWinFlat(a, left) {
    if (left <= 0) return false;
    var mine = winPoints(a, BLACK);
    for (var w = 0; w < mine.length; w++) if (wouldFive(a, mine[w].r, mine[w].c, BLACK)) return true;
    if (winPoints(a, WHITE).length) return false;
    var cands = genMoves(a, BLACK, 18, 2);
    for (var i = 0; i < cands.length; i++) {
      var m = cands[i], idx = m.r * SIZE + m.c;
      if (a[idx] !== EMPTY) continue;
      a[idx] = BLACK;
      if (wouldFive(a, m.r, m.c, BLACK)) { a[idx] = EMPTY; return true; }
      if (winPoints(a, WHITE).length) { a[idx] = EMPTY; continue; }
      var wp = winPoints(a, BLACK);
      if (wp.length >= 2) {
        a[idx] = EMPTY;
        if (left >= 2) return true;
        continue;
      }
      if (wp.length === 1 && left >= 2) {
        var block = wp[0], bi = block.r * SIZE + block.c;
        a[bi] = WHITE;
        var ok = forceWinFlat(a, left - 1);
        a[bi] = EMPTY;
        a[idx] = EMPTY;
        if (ok) return true;
        continue;
      }
      a[idx] = EMPTY;
    }
    return false;
  }

  function isKillingMoveFlat(a, r, c, left) {
    if (left <= 0) return false;
    var idx = r * SIZE + c;
    if (a[idx] !== EMPTY) return false;
    a[idx] = BLACK;
    var ok = false;
    if (wouldFive(a, r, c, BLACK)) {
      ok = true;
    } else if (winPoints(a, WHITE).length) {
      ok = false;
    } else {
      var wp = winPoints(a, BLACK);
      if (wp.length >= 2) {
        ok = left >= 2;
      } else if (wp.length === 1 && left >= 2) {
        var block = wp[0], bi = block.r * SIZE + block.c;
        a[bi] = WHITE;
        ok = forceWinFlat(a, left - 1);
        a[bi] = EMPTY;
      }
    }
    a[idx] = EMPTY;
    return ok;
  }

  function findKillingMoveFlat(a, left) {
    var cands = genMoves(a, BLACK, 20, 2);
    for (var i = 0; i < cands.length; i++) {
      if (isKillingMoveFlat(a, cands[i].r, cands[i].c, left)) return cands[i];
    }
    return null;
  }

  function puzzleDefenseFlat(a) {
    var blocks = winPoints(a, BLACK);
    if (blocks.length) {
      var last = moves.length ? moves[moves.length - 1] : { r: 7, c: 7 };
      blocks.sort(function (x, y) {
        return (Math.abs(x.r - last.r) + Math.abs(x.c - last.c)) - (Math.abs(y.r - last.r) + Math.abs(y.c - last.c));
      });
      return blocks[0];
    }
    var cands = genMoves(a, WHITE, 16, 2);
    var best = null, bestS = -INF;
    for (var i = 0; i < cands.length; i++) {
      var m = cands[i];
      var s = quickPoint(a, m.r, m.c, BLACK) * 1.15 + quickPoint(a, m.r, m.c, WHITE) * 0.5;
      if (s > bestS) { bestS = s; best = m; }
    }
    return best;
  }

  /* ---------- 状态 / 界面 ---------- */
  function isHumanTurn() {
    if (gameOver || aiThinking) return false;
    if (screen === 'puzzle') return current === BLACK;
    if (mode === 'pvp') return true;
    return current === BLACK;
  }

  function setTurnMessage() {
    if (gameOver) return;
    msgEl.style.color = '';
    if (screen === 'puzzle') {
      if (aiThinking) msgEl.textContent = T('gs.gomoku.puzzleThinking');
      else {
        var left = Math.max(1, 3 - puzzleBlackMoves);
        msgEl.textContent = T('gs.gomoku.puzzleTurn').replace('{n}', String(left));
      }
      return;
    }
    if (mode === 'pvp') {
      msgEl.textContent = current === BLACK ? T('gs.gomoku.blackTurn') : T('gs.gomoku.whiteTurn');
      return;
    }
    msgEl.textContent = aiThinking ? T('gs.gomoku.aiThinkingWhite') : T('gs.gomoku.yourTurnBlack');
  }

  function showNote(text, color, duration) {
    clearTimeout(hintTimer);
    msgEl.textContent = text;
    msgEl.style.color = color || 'var(--neon-pink)';
    hintTimer = setTimeout(function () {
      if (!gameOver) setTurnMessage();
    }, duration || 1500);
  }

  function updateUndoBtn() {
    undoBtn.disabled = gameOver || moves.length === 0;
  }

  function updateHud() {
    movesEl.textContent = String(moves.length);
    turnLabel.textContent = current === BLACK ? T('gs.gomoku.turnBlackShort') : T('gs.gomoku.turnWhiteShort');
    turnDot.className = 'gk-dot ' + (current === BLACK ? 'black' : 'white');
    streakEl.textContent = String(streak);
    streakEl.classList.toggle('on', streak > 0);
    bestEl.textContent = String(bestStreak());
    subEl.textContent = modeLabel(mode) + ' · ' + (screen === 'puzzle' ? T('gs.gomoku.puzzleRule') : (forbiddenOn ? T('gs.gomoku.forbiddenOn') : T('gs.gomoku.forbiddenOff')));
    if (screen === 'puzzle') {
      badgeEl.hidden = false;
      badgeEl.innerHTML = T('gs.gomoku.puzzleBadge').replace('{n}', pad2(puzzleIdx + 1)).replace('{total}', String(PUZZLES.length)) +
        '<span class="sub">' + tierName(PUZZLES[puzzleIdx].tier) + ' · ' + solved.length + '/' + PUZZLES.length + '</span>';
    } else if (forbiddenOn) {
      badgeEl.hidden = false;
      badgeEl.textContent = T('gs.gomoku.forbidden') + ' ' + T('gs.gomoku.on');
    } else {
      badgeEl.hidden = true;
    }
    updateUndoBtn();
  }

  function syncModeUI() {
    for (var i = 0; i < modeBtns.length; i++) {
      var dm = modeBtns[i].getAttribute('data-mode');
      modeBtns[i].classList.toggle('active', screen === 'puzzle' ? dm === 'puzzle' : dm === mode);
    }
    forbiddenBtn.hidden = screen === 'puzzle';
    forbiddenBtn.setAttribute('aria-pressed', forbiddenOn ? 'true' : 'false');
    forbiddenBtn.textContent = T('gs.gomoku.forbidden') + ' ' + (forbiddenOn ? T('gs.gomoku.on') : T('gs.gomoku.off'));
  }

  function orbitBurst(r, c, color, n) {
    if (!Arcade.fx) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    var sx = rect.width / LOGICAL, sy = rect.height / LOGICAL;
    Arcade.fx.burst(rect.left + px(c) * sx, rect.top + px(r) * sy, color, n);
  }

  /* ---------- 落子 ---------- */
  function placeStone(r, c, p) {
    board[r][c] = p;
    pieceAnim[r * SIZE + c] = now();
    moves.push({ r: r, c: c, player: p });
    Arcade.juice.move();
    spawnParticles(r, c, p === BLACK ? '#00f0ff' : '#ffffff', 7);
  }

  function applyHumanMove(r, c) {
    if (!isHumanTurn()) return;
    if (board[r][c] !== EMPTY) {
      showNote(T('gs.gomoku.occupied'), 'var(--neon-pink)', 1300);
      buzz();
      return;
    }
    if (screen === 'puzzle') {
      var left = 3 - puzzleBlackMoves;
      var sim = flatBoard();
      if (!isKillingMoveFlat(sim, r, c, left)) {
        showNote(T('gs.gomoku.notKilling'), 'var(--neon-pink)', 1700);
        buzz();
        var hint = findKillingMoveFlat(sim, left);
        hintCell = hint ? { r: hint.r, c: hint.c } : null;
        hintUntil = now() + 2400;
        draw();
        return;
      }
    }
    var p = current;
    var foul = null;
    if (screen === 'game' && p === BLACK && forbiddenOn) {
      var fa = flatBoard();
      fa[r * SIZE + c] = BLACK;
      foul = checkBlackForbidden(fa, r, c);
    }
    placeStone(r, c, p);
    hoverCell = null;
    hintCell = null;

    if (foul) {
      finishForbidden(foul);
      return;
    }

    var line = checkWin2(r, c, p);
    if (line) {
      finishGame(p, 'five', line);
      return;
    }
    if (isFull()) {
      finishGame(EMPTY, 'draw', null);
      return;
    }

    if (screen === 'puzzle') {
      puzzleBlackMoves++;
      current = WHITE;
      updateHud();
      draw();
      writeSave();
      startPuzzleReply();
      return;
    }

    current = p === BLACK ? WHITE : BLACK;
    updateHud();
    setTurnMessage();
    draw();
    writeSave();
    if (mode !== 'pvp' && current === WHITE) startAiThink();
  }

  function finishForbidden(foul) {
    var reason = foul === 'overline' ? 'forbiddenOverline' : foul === 'doubleFour' ? 'forbiddenDoubleFour' : 'forbiddenDoubleThree';
    finishGame(WHITE, reason, null);
  }

  function finishGame(winner, reason, line) {
    gameOver = true;
    winnerSide = winner;
    endReason = reason;
    winCells = line;
    winT0 = now();
    aiThinking = false;
    canvas.classList.remove('thinking');
    clearTimers();
    hidePicker();
    var winForPlayer = screen === 'puzzle' ? winner === BLACK : (mode === 'pvp' ? true : winner === BLACK);
    if (line) {
      spawnWinParticles(line);
      if (winForPlayer) Arcade.juice.win(); else Arcade.juice.lose();
      if (Arcade.fx) {
        Arcade.fx.flash(winner === BLACK ? 'var(--neon-yellow)' : 'var(--neon-cyan)');
        Arcade.fx.shake(document.body);
        orbitBurst(line[0].r, line[0].c, 'var(--neon-yellow)', 21);
        orbitBurst(line[line.length - 1].r, line[line.length - 1].c, 'var(--neon-pink)', 21);
      }
    } else if (reason !== 'draw') {
      Arcade.juice.lose();
      if (Arcade.fx) Arcade.fx.shake(document.body);
      orbitBurst(cursor.r, cursor.c, 'var(--neon-pink)', 14);
    } else {
      Arcade.juice.select();
    }

    if (screen === 'puzzle') {
      if (winner === BLACK) {
        if (solved.indexOf(PUZZLES[puzzleIdx].id) < 0) {
          solved.push(PUZZLES[puzzleIdx].id);
          saveSolved();
        }
      }
    } else if (mode !== 'pvp') {
      if (winner === BLACK) {
        streak++;
        saveStreak();
        if (Arcade.shell) Arcade.shell.submitScore(streak);
      } else if (winner === WHITE) {
        streak = 0;
        saveStreak();
      }
    }

    updateHud();
    updateUndoBtn();
    setEndMessage();
    draw();
    writeSave();
    resultTimer = setTimeout(showResult, 540);
  }

  function setEndMessage() {
    msgEl.style.color = '';
    if (screen === 'puzzle') {
      msgEl.textContent = winnerSide === BLACK ? T('gs.gomoku.puzzleSolvedMsg') : T('gs.gomoku.reasonPuzzleFail');
      msgEl.style.color = winnerSide === BLACK ? 'var(--neon-green)' : 'var(--neon-pink)';
      return;
    }
    if (winnerSide === EMPTY) {
      msgEl.textContent = T('gs.gomoku.draw');
      msgEl.style.color = 'var(--neon-yellow)';
      return;
    }
    if (endReason && endReason.indexOf('forbidden') === 0) {
      msgEl.textContent = T('gs.gomoku.' + endReason);
      msgEl.style.color = 'var(--neon-pink)';
      return;
    }
    if (mode === 'pvp') {
      msgEl.textContent = winnerSide === BLACK ? T('gs.gomoku.blackWin') : T('gs.gomoku.whiteWin');
      msgEl.style.color = winnerSide === BLACK ? 'var(--neon-yellow)' : 'var(--neon-cyan)';
      return;
    }
    if (winnerSide === BLACK) {
      msgEl.textContent = T('gs.gomoku.blackWin');
      msgEl.style.color = 'var(--neon-green)';
    } else {
      msgEl.textContent = T('gs.gomoku.aiWin');
      msgEl.style.color = 'var(--neon-pink)';
    }
  }

  /* ---------- AI 回合 ---------- */
  function startAiThink() {
    if (screen !== 'game' || mode === 'pvp' || gameOver || current !== WHITE) return;
    aiThinking = true;
    canvas.classList.add('thinking');
    setTurnMessage();
    draw();
    var token = ++aiToken;
    clearTimeout(aiTimer);
    aiTimer = setTimeout(function () {
      if (token !== aiToken) return;
      aiThinking = false;
      canvas.classList.remove('thinking');
      if (gameOver || screen !== 'game' || mode === 'pvp' || current !== WHITE) return;
      var mv = null;
      try { mv = computeAiMove(); } catch (e) { mv = null; }
      if (!mv || !inB(mv.r, mv.c) || board[mv.r][mv.c] !== EMPTY) {
        var fb = genMoves(flatBoard(), WHITE, 1, 2);
        mv = fb.length ? fb[0] : null;
      }
      if (!mv) { finishGame(EMPTY, 'draw', null); return; }
      board[mv.r][mv.c] = WHITE;
      pieceAnim[mv.r * SIZE + mv.c] = now();
      moves.push({ r: mv.r, c: mv.c, player: WHITE });
      aiPlaced++;
      Arcade.juice.move();
      spawnParticles(mv.r, mv.c, '#ffffff', 7);
      hoverCell = null;
      var line = checkWin2(mv.r, mv.c, WHITE);
      if (line) { finishGame(WHITE, 'five', line); return; }
      if (isFull()) { finishGame(EMPTY, 'draw', null); return; }
      current = BLACK;
      updateHud();
      setTurnMessage();
      draw();
      writeSave();
    }, mode === 'easy' ? 260 : 150);
  }

  function startPuzzleReply() {
    if (screen !== 'puzzle' || gameOver) return;
    aiThinking = true;
    setTurnMessage();
    draw();
    var token = ++aiToken;
    clearTimeout(aiTimer);
    aiTimer = setTimeout(function () {
      if (token !== aiToken) return;
      aiThinking = false;
      if (gameOver || screen !== 'puzzle' || current !== WHITE) return;
      var sim = flatBoard();
      var mv = puzzleDefenseFlat(sim);
      if (!mv || board[mv.r][mv.c] !== EMPTY) { finishGame(EMPTY, 'draw', null); return; }
      board[mv.r][mv.c] = WHITE;
      pieceAnim[mv.r * SIZE + mv.c] = now();
      moves.push({ r: mv.r, c: mv.c, player: WHITE });
      Arcade.juice.move();
      spawnParticles(mv.r, mv.c, '#ffffff', 6);
      var line = checkWin2(mv.r, mv.c, WHITE);
      if (line) { finishGame(WHITE, 'five', line); return; }
      if (isFull()) { finishGame(EMPTY, 'draw', null); return; }
      current = BLACK;
      updateHud();
      setTurnMessage();
      draw();
      writeSave();
    }, 260);
  }

  /* ---------- 结算面板 ---------- */
  function hideOverlay() { overlayEl.classList.add('hidden'); }
  function hidePicker() { pickerEl.classList.add('hidden'); }

  function addResButton(label, cls, act) {
    var b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.textContent = label;
    b.setAttribute('data-act', act);
    b.addEventListener('click', function () {
      if (this && typeof this.blur === 'function') this.blur();
      Arcade.juice.select();
      hideOverlay();
      if (act === 'again') restartCurrent();
      else if (act === 'next') nextPuzzle();
      else if (act === 'retry') loadPuzzle(puzzleIdx);
      else if (act === 'mode') focusModes();
    });
    resActions.appendChild(b);
  }

  function focusModes() {
    modeControls.classList.remove('gk-flash');
    void modeControls.offsetWidth;
    modeControls.classList.add('gk-flash');
    setTimeout(function () { modeControls.classList.remove('gk-flash'); }, 1500);
    try { modeControls.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    if (Arcade.ui && Arcade.ui.toast) Arcade.ui.toast(T('gs.gomoku.modeChooseHint'), 'ok');
  }

  function showResult() {
    if (!gameOver) return;
    resActions.innerHTML = '';
    resGrid.innerHTML = '';
    resTitle.className = 'gk-res-title';
    if (screen === 'puzzle') {
      var solvedAll = solved.length >= PUZZLES.length;
      if (winnerSide === BLACK) {
        resTitle.textContent = T('gs.gomoku.resultPuzzleWin');
        resTitle.classList.add('win');
        resSub.textContent = T('gs.gomoku.reasonPuzzle') + (solvedAll ? ' · ' + T('gs.gomoku.puzzleAllDone') : '');
      } else if (winnerSide === EMPTY) {
        resTitle.textContent = T('gs.gomoku.resultDraw');
        resTitle.classList.add('draw');
        resSub.textContent = T('gs.gomoku.reasonDraw');
      } else {
        resTitle.textContent = T('gs.gomoku.resultPuzzleLose');
        resTitle.classList.add('lose');
        resSub.textContent = T('gs.gomoku.reasonPuzzleFail');
      }
      resGrid.innerHTML =
        '<div>' + T('gs.gomoku.statMoves') + '<b>' + moves.filter(function (m) { return m.player === BLACK; }).length + '</b></div>' +
        '<div class="rec">' + T('gs.gomoku.statProgress') + '<b>' + solved.length + '/' + PUZZLES.length + '</b></div>' +
        '<div>' + T('gs.gomoku.statBest') + '<b>' + bestStreak() + '</b></div>' +
        '<div>' + T('gs.gomoku.statMode') + '<b>' + tierName(PUZZLES[puzzleIdx].tier) + '</b></div>';
      if (winnerSide === BLACK) addResButton(T('gs.gomoku.nextPuzzle'), 'green', 'next');
      addResButton(winnerSide === BLACK ? T('gs.gomoku.again') : T('gs.gomoku.retryPuzzle'), 'yellow', 'retry');
      addResButton(T('gs.gomoku.changeMode'), 'purple', 'mode');
      overlayEl.classList.remove('hidden');
      return;
    }

    if (mode === 'pvp') {
      if (winnerSide === EMPTY) {
        resTitle.textContent = T('gs.gomoku.resultDraw');
        resTitle.classList.add('draw');
        resSub.textContent = T('gs.gomoku.reasonDraw');
      } else {
        resTitle.textContent = winnerSide === BLACK ? T('gs.gomoku.blackWin') : T('gs.gomoku.whiteWin');
        resTitle.classList.add(winnerSide === BLACK ? 'win' : 'lose');
        resSub.textContent = endReason && endReason.indexOf('forbidden') === 0 ? T('gs.gomoku.' + endReason) : T('gs.gomoku.reasonFive');
      }
    } else if (winnerSide === EMPTY) {
      resTitle.textContent = T('gs.gomoku.resultDraw');
      resTitle.classList.add('draw');
      resSub.textContent = T('gs.gomoku.reasonDraw');
    } else if (winnerSide === BLACK) {
      resTitle.textContent = T('gs.gomoku.resultWin');
      resTitle.classList.add('win');
      resSub.textContent = T('gs.gomoku.reasonFive');
    } else {
      resTitle.textContent = T('gs.gomoku.resultLose');
      resTitle.classList.add('lose');
      resSub.textContent = endReason && endReason.indexOf('forbidden') === 0 ? T('gs.gomoku.' + endReason) : T('gs.gomoku.reasonFive');
    }
    resGrid.innerHTML =
      '<div>' + T('gs.gomoku.statMoves') + '<b>' + moves.length + '</b></div>' +
      '<div>' + T('gs.gomoku.statStreak') + '<b>' + streak + '</b></div>' +
      '<div class="rec">' + T('gs.gomoku.statBest') + '<b>' + bestStreak() + '</b></div>' +
      '<div>' + T('gs.gomoku.statMode') + '<b>' + modeLabel(mode) + '</b></div>';
    addResButton(T('gs.gomoku.again'), 'green', 'again');
    addResButton(T('gs.gomoku.changeMode'), 'purple', 'mode');
    overlayEl.classList.remove('hidden');
  }

  /* ---------- 题目选择 ---------- */
  function openPicker() {
    pkTitle.textContent = T('gs.gomoku.pickTitle');
    pkSub.textContent = T('gs.gomoku.pickSub').replace('{a}', String(solved.length)).replace('{b}', String(PUZZLES.length));
    var html = '';
    for (var i = 0; i < PUZZLES.length; i++) {
      var p = PUZZLES[i];
      var done = solved.indexOf(p.id) >= 0;
      var cur = screen === 'puzzle' && puzzleIdx === i;
      html += '<button class="gk-pk t' + p.tier + (done ? ' done' : '') + (cur ? ' cur' : '') + '" data-pid="' + p.id + '">' +
        '<span class="tierbar"></span>' +
        '<span class="num">' + pad2(i + 1) + '</span>' +
        '<span class="meta">' + tierName(p.tier) + '<small>' + tierSub(p.tier) + '</small></span>' +
        '<span class="st">' + (done ? T('gs.gomoku.solvedTag') : T('gs.gomoku.unsolvedTag')) + '</span>' +
        '</button>';
    }
    pkList.innerHTML = html;
    pickerEl.classList.remove('hidden');
  }

  function loadPuzzle(idx) {
    if (idx < 0 || idx >= PUZZLES.length) return;
    aiToken++;
    clearTimers();
    aiThinking = false;
    canvas.classList.remove('thinking');
    hideOverlay();
    hidePicker();
    screen = 'puzzle';
    if (mode !== 'puzzle') lastMode = mode;
    mode = 'puzzle';
    puzzleIdx = idx;
    puzzleBlackMoves = 0;
    board = newBoard();
    var st = PUZZLES[idx].stones;
    for (var i = 0; i < st.length; i++) board[st[i][1]][st[i][2]] = st[i][0];
    moves = [];
    current = BLACK;
    gameOver = false; winCells = null; winnerSide = EMPTY; endReason = '';
    pieceAnim = {}; particles = []; hintCell = null; hoverCell = null; cursorOn = true;
    openingIdx = -1; aiPlaced = 0;
    clearSave();
    syncModeUI();
    updateHud();
    setTurnMessage();
    draw();
    writeSave();
  }

  function nextPuzzle() {
    var next = -1;
    for (var i = 1; i <= PUZZLES.length; i++) {
      var k = (puzzleIdx + i) % PUZZLES.length;
      if (solved.indexOf(PUZZLES[k].id) < 0) { next = k; break; }
    }
    if (next < 0) {
      next = (puzzleIdx + 1) % PUZZLES.length;
      if (Arcade.ui && Arcade.ui.toast) Arcade.ui.toast(T('gs.gomoku.puzzleAllDone'), 'ok');
    }
    loadPuzzle(next);
  }

  /* ---------- 悔棋 ---------- */
  function undoMove() {
    if (gameOver || moves.length === 0) return;
    aiToken++;
    clearTimers();
    aiThinking = false;
    canvas.classList.remove('thinking');
    hintCell = null;
    if (screen === 'puzzle') {
      var n = 0;
      while (moves.length && n < 2) {
        var pm = moves.pop();
        board[pm.r][pm.c] = EMPTY;
        if (pm.player === BLACK) puzzleBlackMoves = Math.max(0, puzzleBlackMoves - 1);
        n++;
      }
      current = BLACK;
    } else if (mode === 'pvp') {
      var pmv = moves.pop();
      board[pmv.r][pmv.c] = EMPTY;
      current = pmv.player;
    } else if (current === WHITE) {
      var pb = moves.pop();
      board[pb.r][pb.c] = EMPTY;
      current = BLACK;
    } else {
      var count = 0;
      while (moves.length && count < 2) {
        var pp = moves.pop();
        board[pp.r][pp.c] = EMPTY;
        if (pp.player === WHITE) aiPlaced = Math.max(0, aiPlaced - 1);
        count++;
      }
      current = BLACK;
    }
    winCells = null; winnerSide = EMPTY; endReason = '';
    updateHud();
    setTurnMessage();
    draw();
    writeSave();
  }

  /* ---------- 重开 / 模式 ---------- */
  function init() {
    aiToken++;
    clearTimers();
    aiThinking = false;
    canvas.classList.remove('thinking');
    screen = 'game';
    if (mode === 'puzzle') mode = lastMode;
    board = newBoard();
    current = BLACK;
    moves = [];
    gameOver = false; winCells = null; winnerSide = EMPTY; endReason = '';
    pieceAnim = {}; particles = []; hintCell = null; hoverCell = null; cursorOn = true;
    aiPlaced = 0; openingIdx = -1; puzzleIdx = -1; puzzleBlackMoves = 0;
    hideOverlay();
    hidePicker();
    clearSave();
    syncModeUI();
    updateHud();
    setTurnMessage();
    draw();
    writeSave();
  }

  function restartCurrent() {
    if (screen === 'puzzle' && puzzleIdx >= 0) loadPuzzle(puzzleIdx);
    else init();
  }

  function enterMode(next) {
    lastMode = next;
    mode = next;
    init();
  }

  /* ---------- 交互 ---------- */
  function canvasPoint(e) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var x = (e.clientX - rect.left) / rect.width * LOGICAL;
    var y = (e.clientY - rect.top) / rect.height * LOGICAL;
    var c = Math.round((x - MARGIN) / CELL);
    var r = Math.round((y - MARGIN) / CELL);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    if (Math.abs(px(c) - x) > CELL * 0.6 || Math.abs(px(r) - y) > CELL * 0.6) return null;
    return { r: r, c: c };
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var pt = canvasPoint(e);
    if (!pt) return;
    if (e.cancelable) e.preventDefault();
    /* 点棋盘即把键盘焦点从按钮移开，保证 Enter/Space 走落子而非按钮 */
    var ae = document.activeElement;
    if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur();
    cursor = { r: pt.r, c: pt.c };
    cursorOn = true;
    applyHumanMove(pt.r, pt.c);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    hoverCell = canvasPoint(e);
  });
  canvas.addEventListener('pointerleave', function () { hoverCell = null; });

  undoBtn.addEventListener('click', function () {
    if (typeof this.blur === 'function') this.blur();
    Arcade.juice.select();
    undoMove();
  });
  restartBtn.addEventListener('click', function () {
    if (typeof this.blur === 'function') this.blur();
    Arcade.juice.select();
    if (gameOver && screen === 'puzzle') loadPuzzle(puzzleIdx);
    else restartCurrent();
  });
  forbiddenBtn.addEventListener('click', function () {
    if (typeof this.blur === 'function') this.blur();
    if (screen === 'puzzle') return;
    forbiddenOn = !forbiddenOn;
    Arcade.juice.select();
    syncModeUI();
    updateHud();
    writeSave();
    showNote(T('gs.gomoku.forbiddenToggled').replace('{state}', forbiddenOn ? T('gs.gomoku.on') : T('gs.gomoku.off')) +
      (forbiddenOn ? ' · ' + T('gs.gomoku.forbiddenOn') : ''), forbiddenOn ? 'var(--neon-pink)' : '');
  });

  for (var mb = 0; mb < modeBtns.length; mb++) {
    modeBtns[mb].addEventListener('click', function (e) {
      if (e.currentTarget && typeof e.currentTarget.blur === 'function') e.currentTarget.blur();
      var next = e.currentTarget.getAttribute('data-mode');
      Arcade.juice.select();
      if (next === 'puzzle') { openPicker(); return; }
      if (screen === 'game' && next === mode) return;
      enterMode(next);
    });
  }

  pkClose.addEventListener('click', function () {
    if (typeof this.blur === 'function') this.blur();
    Arcade.juice.select();
    hidePicker();
  });
  pkList.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.gk-pk') : null;
    if (!btn) return;
    var pid = btn.getAttribute('data-pid');
    for (var i = 0; i < PUZZLES.length; i++) {
      if (PUZZLES[i].id === pid) {
        if (btn && typeof btn.blur === 'function') btn.blur();
        Arcade.juice.select();
        loadPuzzle(i);
        return;
      }
    }
  });
  pickerEl.addEventListener('click', function (e) {
    if (e.target === pickerEl) hidePicker();
  });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.tut-overlay')) return;
    var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;

    if (!pickerEl.classList.contains('hidden')) {
      if (e.key === 'Escape') { hidePicker(); }
      return;
    }
    if (!overlayEl.classList.contains('hidden')) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (e.cancelable) e.preventDefault();
      cursorOn = true;
      var dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      var dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      cursor.r = Math.max(0, Math.min(SIZE - 1, cursor.r + dr));
      cursor.c = Math.max(0, Math.min(SIZE - 1, cursor.c + dc));
      draw();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      var tag2 = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tag2 === 'button') return;
      if (e.cancelable) e.preventDefault();
      if (!isHumanTurn()) return;
      applyHumanMove(cursor.r, cursor.c);
      return;
    }
    if (e.key === 'u' || e.key === 'U') {
      if (e.cancelable) e.preventDefault();
      undoMove();
      return;
    }
    if (e.key === 'Escape') {
      cursorOn = false;
      hintCell = null;
      if (!gameOver) {
        showNote(T('gs.gomoku.cancelled'), '', 1200);
      }
      draw();
    }
  });

  /* ---------- 启动 ---------- */
  window.GAME_RESTART = restartCurrent;

  if (!tryResume()) init();

  function raf() {
    if (!document.hidden) draw();
    requestAnimationFrame(raf);
  }
  if (window.requestAnimationFrame) requestAnimationFrame(raf);
  else setInterval(draw, 1000 / 30);

  setTimeout(function () { draw(); updateHud(); }, 0);
  window.addEventListener('load', function () { layoutCanvas(); draw(); });

})();
