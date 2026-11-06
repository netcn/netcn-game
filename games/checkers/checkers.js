/* 跳棋 · 游戏街机厅
   模式：人机 8×8（英式）/ 双人同屏 8×8 / 国际跳棋 10×10（飞王）/ 残局挑战
   规则：有跳必跳；英式兵斜进、可后退吃、链结束升王；国际兵斜进+后退吃、王任意距离滑行与吃子
   工程：Canvas 自绘、AI 限时搜索（克隆棋盘）、开局库、残局求解、断点续玩、键盘/触控 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.checkers.tut1t'), d: T('gs.checkers.tut1') },
  { t: T('gs.checkers.tut2t'), d: T('gs.checkers.tut2') },
  { t: T('gs.checkers.tut3t'), d: T('gs.checkers.tut3') },
  { t: T('gs.checkers.tut4t'), d: T('gs.checkers.tut4') }
];

(function () {
  'use strict';
  var root = document.getElementById('game-root');
  if (!root) return;

  var T = window.T || function (k) { return k; };
  var DRAW_ACCEPT = 0.25;
  var DRAW_LIMIT = 50;
  var PROGRESS_KEY = 'arcade_checkers_puzzle_v1';
  var MODE_AI8 = 'ai8', MODE_PVP8 = 'pvp8', MODE_AI10 = 'ai10', MODE_PUZZLE = 'puzzle';
  var DIFFS = ['easy', 'normal', 'hard'];
  var DIFF_KEYS = { easy: 'gs.checkers.dEasy', normal: 'gs.checkers.dNormal', hard: 'gs.checkers.dHard' };
  var MODE_KEYS = {
    ai8: 'gs.checkers.modeAi8', pvp8: 'gs.checkers.modePvp8',
    ai10: 'gs.checkers.modeAi10', puzzle: 'gs.checkers.modePuzzle'
  };
  var LOGICAL = 600;
  var DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  /* ---------------- 开局库（全部逐手校验） ---------------- */
  var BOOKS = {
    8: [
      [[5, 2, 4, 1], [2, 3, 3, 4], [6, 1, 5, 2], [3, 4, 4, 5]],
      [[5, 0, 4, 1], [2, 1, 3, 0], [5, 6, 4, 7], [1, 2, 2, 1]],
      [[5, 0, 4, 1], [2, 5, 3, 6], [5, 4, 4, 3], [1, 4, 2, 5]],
      [[5, 0, 4, 1], [2, 3, 3, 4], [4, 1, 3, 0], [2, 7, 3, 6]],
      [[5, 4, 4, 3], [2, 3, 3, 4], [6, 3, 5, 4], [1, 4, 2, 3]],
      [[5, 2, 4, 3], [2, 3, 3, 2], [6, 1, 5, 2], [1, 4, 2, 3]],
      [[5, 2, 4, 3], [2, 1, 3, 0], [6, 3, 5, 2], [1, 0, 2, 1]]
    ],
    10: [
      [[6, 1, 5, 2], [3, 8, 4, 9], [7, 0, 6, 1], [4, 9, 5, 8]],
      [[6, 3, 5, 2], [3, 8, 4, 7], [7, 4, 6, 3], [3, 4, 4, 5]],
      [[6, 5, 5, 4], [3, 8, 4, 7], [6, 7, 5, 8], [4, 7, 5, 6]],
      [[6, 3, 5, 4], [3, 2, 4, 1], [7, 4, 6, 3], [4, 1, 5, 0]],
      [[6, 7, 5, 8], [3, 2, 4, 1], [6, 5, 5, 6], [4, 1, 5, 0]]
    ]
  };

  /* ---------------- 残局（求解器验证：红先必杀，2-4 步） ---------------- */
  var PUZZLES = [
    { id: 'p1', tier: 1, n: 8, intl: false, moves: 2, stones: [['b', 2, 7, 0], ['r', 3, 2, 0], ['r', 3, 4, 0], ['r', 6, 3, 0]] },
    { id: 'p2', tier: 1, n: 8, intl: false, moves: 2, stones: [['b', 2, 1, 0], ['b', 2, 3, 0], ['r', 3, 2, 0], ['r', 3, 6, 0], ['r', 4, 3, 0]] },
    { id: 'p3', tier: 1, n: 8, intl: false, moves: 2, stones: [['b', 1, 2, 0], ['b', 2, 7, 0], ['r', 3, 6, 0], ['r', 4, 3, 0], ['r', 4, 5, 0]] },
    { id: 'p4', tier: 2, n: 8, intl: false, moves: 3, stones: [['b', 1, 4, 0], ['b', 2, 1, 0], ['r', 3, 0, 0], ['r', 3, 2, 0], ['b', 3, 6, 0], ['r', 4, 7, 0], ['r', 5, 4, 0]] },
    { id: 'p5', tier: 2, n: 8, intl: false, moves: 3, stones: [['b', 2, 7, 0], ['r', 3, 2, 0], ['b', 3, 4, 0], ['r', 4, 7, 0], ['r', 5, 6, 0], ['r', 6, 1, 0]] },
    { id: 'p6', tier: 2, n: 8, intl: false, moves: 3, stones: [['b', 0, 3, 0], ['b', 3, 0, 0], ['r', 3, 2, 0], ['r', 3, 4, 0], ['r', 4, 3, 0], ['r', 7, 2, 0]] },
    { id: 'p7', tier: 3, n: 8, intl: false, moves: 4, stones: [['b', 0, 7, 0], ['b', 1, 6, 0], ['b', 3, 2, 0], ['b', 3, 6, 0], ['r', 4, 1, 0], ['r', 4, 5, 0], ['r', 5, 6, 0], ['r', 6, 3, 0]] },
    { id: 'p8', tier: 3, n: 10, intl: true, moves: 3, stones: [['b', 0, 3, 0], ['b', 1, 8, 0], ['b', 2, 5, 0], ['b', 3, 8, 0], ['r', 7, 0, 1], ['r', 8, 3, 0], ['r', 9, 2, 0]] }
  ];

  /* ---------------- 状态 ---------------- */
  var mode = MODE_AI8, difficulty = 'normal';
  var N = 8, INTL = false;
  var board = [], turn = 'red', selected = null, legalTargets = [];
  var over = false, score = 0;
  var capsRed = 0, capsBlack = 0, kingsRed = 0, kingsBlack = 0, ply = 0, noCap = 0;
  var hist = [], moveLog = [], lastMove = null, lastCrown = null;
  var aiTimer = null, aiSeq = 0, aiThinking = false, resultTimer = null;
  var cursor = { r: 5, c: 0 };
  var particles = [];
  var drawOpen = false, lastDrawPly = -999;
  var puzzleIdx = 0, puzzleRedMoves = 0, puzzleBusy = false;
  var pickerOpen = false;
  var hints = { all: [], must: false, sources: {}, ready: false };

  function isAI() { return mode === MODE_AI8 || mode === MODE_AI10; }
  function isPvp() { return mode === MODE_PVP8; }

  /* ---------------- 规则核心（对传入棋盘操作，生成链会自行还原） ---------------- */
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
  function isDark(r, c) { return (r + c) % 2 === 1; }
  function promoRow(color) { return color === 'red' ? 0 : N - 1; }
  function manDirs(color) { return color === 'red' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]; }

  function cloneBoard(bd) {
    return bd.map(function (row) {
      return row.map(function (p) { return p ? { color: p.color, king: !!p.king } : null; });
    });
  }

  function stepTargets(bd, r, c) {
    var p = bd[r][c], out = [];
    if (!p) return out;
    var ds = p.king ? DIRS : manDirs(p.color);
    for (var i = 0; i < ds.length; i++) {
      var dr = ds[i][0], dc = ds[i][1], rr = r + dr, cc = c + dc;
      if (p.king && INTL) {
        while (inB(rr, cc) && !bd[rr][cc]) { out.push({ r: rr, c: cc }); rr += dr; cc += dc; }
      } else if (inB(rr, cc) && isDark(rr, cc) && !bd[rr][cc]) {
        out.push({ r: rr, c: cc });
      }
    }
    return out;
  }

  /* 跳吃候选（兵：相邻敌子；国际王：任意距离飞吃） */
  function jumpOptions(bd, r, c) {
    var p = bd[r][c], out = [];
    if (!p) return out;
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      if (!p.king) {
        var mr = r + dr, mc = c + dc;
        if (!inB(mr, mc) || !isDark(mr, mc)) continue;
        var mid = bd[mr][mc];
        if (!mid || mid.color === p.color) continue;
        var lr = mr + dr, lc = mc + dc;
        if (inB(lr, lc) && isDark(lr, lc) && !bd[lr][lc]) out.push({ r: lr, c: lc, mid: { r: mr, c: mc } });
      } else if (INTL) {
        var rr = r + dr, cc = c + dc, enemy = null;
        while (inB(rr, cc) && !bd[rr][cc]) { rr += dr; cc += dc; }
        if (inB(rr, cc) && bd[rr][cc] && bd[rr][cc].color !== p.color) enemy = { r: rr, c: cc };
        if (enemy) {
          rr += dr; cc += dc;
          while (inB(rr, cc) && !bd[rr][cc]) {
            out.push({ r: rr, c: cc, mid: enemy });
            rr += dr; cc += dc;
          }
        }
      } else {
        var mr2 = r + dr, mc2 = c + dc;
        if (!inB(mr2, mc2)) continue;
        var mid2 = bd[mr2][mc2];
        if (!mid2 || mid2.color === p.color) continue;
        var lr2 = mr2 + dr, lc2 = mc2 + dc;
        if (inB(lr2, lc2) && !bd[lr2][lc2]) out.push({ r: lr2, c: lc2, mid: { r: mr2, c: mc2 } });
      }
    }
    return out;
  }

  /* 展开完整跳跃链；中途在棋盘上移动，递归后还原 */
  function chainsFrom(bd, fr, fc, color, curR, curC, chain, out) {
    var hops = jumpOptions(bd, curR, curC);
    var piece = bd[curR][curC];
    var any = false;
    for (var i = 0; i < hops.length; i++) {
      var h = hops[i], mid = h.mid;
      var midPiece = bd[mid.r][mid.c];
      bd[mid.r][mid.c] = null;
      bd[curR][curC] = null;
      bd[h.r][h.c] = piece;
      any = true;
      var nextChain = chain.concat([[mid.r, mid.c]]);
      var stopForPromotion = INTL && piece && !piece.king && h.r === promoRow(color);
      if (stopForPromotion) {
        out.push({ fr: fr, fc: fc, tr: h.r, tc: h.c, jumps: nextChain });
      } else {
        chainsFrom(bd, fr, fc, color, h.r, h.c, nextChain, out);
      }
      bd[h.r][h.c] = null;
      bd[curR][curC] = piece;
      bd[mid.r][mid.c] = midPiece;
    }
    if (!any && chain.length) out.push({ fr: fr, fc: fc, tr: curR, tc: curC, jumps: chain.slice() });
  }

  /* 全部合法走法：有跳必跳 */
  function genMoves(bd, color) {
    var jumps = [], steps = [];
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var p = bd[r][c];
        if (!p || p.color !== color) continue;
        var ch = [];
        chainsFrom(bd, r, c, color, r, c, [], ch);
        if (ch.length) jumps = jumps.concat(ch);
        else {
          var st = stepTargets(bd, r, c);
          for (var i = 0; i < st.length; i++) steps.push({ fr: r, fc: c, tr: st[i].r, tc: st[i].c, jumps: [] });
        }
      }
    }
    return jumps.length ? jumps : steps;
  }

  function pieceMoves(bd, r, c, color) {
    var ch = [];
    chainsFrom(bd, r, c, color, r, c, [], ch);
    if (ch.length) return ch;
    var out = [], st = stepTargets(bd, r, c);
    for (var i = 0; i < st.length; i++) out.push({ fr: r, fc: c, tr: st[i].r, tc: st[i].c, jumps: [] });
    return out;
  }

  function countColor(bd, color) {
    var n = 0;
    if (!bd || !bd.length) return n;
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (bd[r] && bd[r][c] && bd[r][c].color === color) n++;
    return n;
  }

  function applyTo(bd, m) {
    var p = bd[m.fr][m.fc], caps = [];
    bd[m.fr][m.fc] = null;
    for (var i = 0; i < m.jumps.length; i++) {
      var jr = m.jumps[i][0], jc = m.jumps[i][1];
      if (bd[jr][jc]) { caps.push({ r: jr, c: jc, piece: bd[jr][jc] }); bd[jr][jc] = null; }
    }
    bd[m.tr][m.tc] = p;
    var crowned = false;
    if (p && !p.king && m.tr === promoRow(p.color)) { p.king = true; crowned = true; }
    return { caps: caps, crowned: crowned, piece: p };
  }

  function revertFrom(bd, m, undo) {
    bd[m.tr][m.tc] = null;
    if (undo.crowned) undo.piece.king = false;
    bd[m.fr][m.fc] = undo.piece;
    for (var i = undo.caps.length - 1; i >= 0; i--) {
      var cp = undo.caps[i];
      bd[cp.r][cp.c] = cp.piece;
    }
  }

  function boardHash(bd) {
    var s = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var p = bd[r][c];
      s.push(p ? (p.color === 'red' ? 'R' : 'B') + (p.king ? 'K' : 'm') : '.');
    }
    return s.join('');
  }

  /* ---------------- 残局求解（强制胜验证，不依赖调试接口） ---------------- */
  function winWithin(bd, sideToMove, redMovesLeft) {
    var memo = new Map();
    function rec(current, left) {
      var redN = countColor(bd, 'red'), blackN = countColor(bd, 'black');
      if (redN === 0) return false;
      if (blackN === 0) return true;
      var key = boardHash(bd) + '|' + current + '|' + left;
      if (memo.has(key)) return memo.get(key);
      var ms = genMoves(bd, current);
      if (!ms.length) {
        var terminal = current === 'black';
        memo.set(key, terminal);
        return terminal;
      }
      if (current === 'black') {
        var allWin = true;
        for (var i = 0; i < ms.length; i++) {
          var u = applyTo(bd, ms[i]);
          var w = rec('red', left);
          revertFrom(bd, ms[i], u);
          if (!w) { allWin = false; break; }
        }
        memo.set(key, allWin);
        return allWin;
      }
      if (left <= 0) { memo.set(key, false); return false; }
      var anyWin = false;
      for (var j = 0; j < ms.length; j++) {
        var u2 = applyTo(bd, ms[j]);
        var w2 = rec('black', left - 1);
        revertFrom(bd, ms[j], u2);
        if (w2) { anyWin = true; break; }
      }
      memo.set(key, anyWin);
      return anyWin;
    }
    return rec(sideToMove, redMovesLeft);
  }

  /* ---------------- 评估与 AI ---------------- */
  function evalBoard(bd) {
    var s = 0;
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var p = bd[r][c];
        if (!p) continue;
        var v = p.king ? (INTL ? 3.7 : 3.25) : 1;
        if (!p.king) v += p.color === 'black' ? r * 0.06 : (N - 1 - r) * 0.06;
        var edge = Math.min(c, N - 1 - c);
        v += edge === 0 ? 0.02 : 0;
        s += p.color === 'black' ? v : -v;
      }
    }
    return s;
  }

  function orderMoves(ms) {
    return ms.slice().sort(function (a, b) {
      var ja = a.jumps ? a.jumps.length : 0, jb = b.jumps ? b.jumps.length : 0;
      return jb - ja;
    });
  }

  var searchNodes = 0, searchDeadline = 0, searchAbort = false;
  function search(bd, depth, alpha, beta, color) {
    searchNodes++;
    if ((searchNodes & 63) === 0 && Date.now() > searchDeadline) { searchAbort = true; return 0; }
    var ms = genMoves(bd, color);
    if (!ms.length) return color === 'black' ? -950 : 950;
    if (depth <= 0) return evalBoard(bd);
    ms = orderMoves(ms);
    if (color === 'black') {
      var best = -1e9;
      for (var i = 0; i < ms.length; i++) {
        var u = applyTo(bd, ms[i]);
        var v = search(bd, depth - 1, alpha, beta, 'red');
        revertFrom(bd, ms[i], u);
        if (searchAbort) return 0;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (beta <= alpha) break;
      }
      return best;
    }
    var worst = 1e9;
    for (var j = 0; j < ms.length; j++) {
      var u2 = applyTo(bd, ms[j]);
      var v2 = search(bd, depth - 1, alpha, beta, 'black');
      revertFrom(bd, ms[j], u2);
      if (searchAbort) return 0;
      if (v2 < worst) worst = v2;
      if (v2 < beta) beta = v2;
      if (beta <= alpha) break;
    }
    return worst;
  }

  function bookMove() {
    if (moveLog.length >= 4 || moveLog.length % 2 !== 1) return null;
    var lines = BOOKS[N] || [], cands = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.length <= moveLog.length) continue;
      var ok = true;
      for (var j = 0; j < moveLog.length; j++) {
        var a = moveLog[j], b = line[j];
        if (a.fr !== b[0] || a.fc !== b[1] || a.tr !== b[2] || a.tc !== b[3]) { ok = false; break; }
      }
      if (ok) cands.push(line[moveLog.length]);
    }
    if (!cands.length) return null;
    var pick = cands[Math.floor(Math.random() * cands.length)];
    var root = genMoves(board, 'black');
    for (var k = 0; k < root.length; k++) {
      var rm = root[k];
      if (rm.fr === pick[0] && rm.fc === pick[1] && rm.tr === pick[2] && rm.tc === pick[3]) return rm;
    }
    return null;
  }

  function aiChoose() {
    var bm = bookMove();
    if (bm) return bm;
    var bd = cloneBoard(board);
    var root = genMoves(bd, 'black');
    if (!root.length) return null;
    if (difficulty === 'easy') {
      var jumps = root.filter(function (m) { return m.jumps.length; });
      var pool = jumps.length && Math.random() < 0.7 ? jumps : root;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    searchAbort = false;
    if (N === 10) {
      searchNodes = 0;
      searchDeadline = Date.now() + 160;
      var best10 = root[0], val10 = -1e9;
      var ordered10 = orderMoves(root);
      for (var i = 0; i < ordered10.length; i++) {
        var u10 = applyTo(bd, ordered10[i]);
        var v10 = search(bd, 1, -1e9, 1e9, 'red');
        revertFrom(bd, ordered10[i], u10);
        if (searchAbort) break;
        v10 += Math.random() * (difficulty === 'easy' ? 0.6 : 0.18);
        if (v10 > val10) { val10 = v10; best10 = ordered10[i]; }
      }
      return best10;
    }
    if (difficulty === 'normal') {
      searchNodes = 0;
      searchDeadline = Date.now() + 180;
      var bestN = root[0], valN = -1e9;
      var orderedN = orderMoves(root);
      for (var j = 0; j < orderedN.length; j++) {
        var uN = applyTo(bd, orderedN[j]);
        var vN = search(bd, 1, -1e9, 1e9, 'red');
        revertFrom(bd, orderedN[j], uN);
        if (searchAbort) break;
        vN += Math.random() * 0.22;
        if (vN > valN) { valN = vN; bestN = orderedN[j]; }
      }
      return bestN;
    }
    searchNodes = 0;
    searchDeadline = Date.now() + 350;
    var bestH = root[0], orderedH = orderMoves(root);
    for (var depth = 2; depth <= 6; depth += 2) {
      var localBest = null, localVal = -1e9;
      for (var k = 0; k < orderedH.length; k++) {
        var uH = applyTo(bd, orderedH[k]);
        var vH = search(bd, depth - 1, localVal, 1e9, 'red');
        revertFrom(bd, orderedH[k], uH);
        if (searchAbort) break;
        if (vH > localVal) { localVal = vH; localBest = orderedH[k]; }
      }
      if (!searchAbort && localBest) bestH = localBest;
      if (searchAbort) break;
      if (localVal > 900) break;
    }
    return bestH;
  }

  /* ---------------- 对局流程 ---------------- */
  function createInitialBoard(n) {
    var bd = [];
    for (var r = 0; r < n; r++) {
      bd[r] = [];
      for (var c = 0; c < n; c++) {
        var v = null;
        if (isDark(r, c)) {
          if (r < n / 2 - 1) v = { color: 'black', king: false };
          if (r > n / 2) v = { color: 'red', king: false };
        }
        bd[r][c] = v;
      }
    }
    return bd;
  }

  function firstRedCell() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      if (board[r] && board[r][c] && board[r][c].color === 'red') return { r: r, c: c };
    }
    return { r: N - 1, c: 0 };
  }

  function resetStats() {
    turn = 'red'; selected = null; legalTargets = [];
    over = false; score = 0;
    capsRed = 0; capsBlack = 0; kingsRed = 0; kingsBlack = 0;
    ply = 0; noCap = 0;
    hist = []; moveLog = []; lastMove = null; lastCrown = null;
    particles = []; drawOpen = false; lastDrawPly = -999;
    puzzleRedMoves = 0; puzzleBusy = false;
    if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
  }

  function newGame() {
    cancelAI();
    closeResult();
    N = mode === MODE_AI10 ? 10 : 8;
    INTL = N === 10;
    board = createInitialBoard(N);
    resetStats();
    closeDrawOffer();
    clearSave();
    var f = firstRedCell(); cursor = { r: f.r, c: f.c };
    msg.textContent = T('gs.checkers.startMsg');
    msg.style.color = '';
    writeSave();
    syncModeUI();
    refresh();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function loadPuzzle(idx) {
    cancelAI();
    closeResult();
    closePicker();
    mode = MODE_PUZZLE;
    puzzleIdx = idx % PUZZLES.length;
    var pz = PUZZLES[puzzleIdx];
    N = pz.n; INTL = pz.intl;
    board = [];
    for (var r = 0; r < N; r++) {
      board[r] = [];
      for (var c = 0; c < N; c++) board[r][c] = null;
    }
    pz.stones.forEach(function (s) {
      board[s[1]][s[2]] = { color: s[0] === 'r' ? 'red' : 'black', king: !!s[3] };
    });
    resetStats();
    closeDrawOffer();
    clearSave();
    var f = firstRedCell(); cursor = { r: f.r, c: f.c };
    syncModeUI();
    refresh();
    setMsg(T('gs.checkers.puzzleTurn').replace('{n}', pz.moves), 'var(--neon-yellow)');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function snap() {
    return {
      board: cloneBoard(board), turn: turn, score: score,
      capsRed: capsRed, capsBlack: capsBlack, kingsRed: kingsRed, kingsBlack: kingsBlack,
      ply: ply, noCap: noCap, puzzleRedMoves: puzzleRedMoves,
      moveLog: moveLog.slice()
    };
  }
  function restore(s) {
    board = cloneBoard(s.board);
    turn = s.turn; score = s.score;
    capsRed = s.capsRed; capsBlack = s.capsBlack; kingsRed = s.kingsRed; kingsBlack = s.kingsBlack;
    ply = s.ply; noCap = s.noCap; puzzleRedMoves = s.puzzleRedMoves || 0;
    moveLog = s.moveLog ? s.moveLog.slice() : [];
    selected = null; legalTargets = []; lastMove = null; lastCrown = null; particles = [];
    over = false;
  }

  function pushHist() {
    hist.push(snap());
    if (hist.length > 80) hist.shift();
  }

  function animateMove(m, info, color) {
    var dest = cellCenter(m.tr, m.tc);
    var capColor = color === 'red' ? '#ff5b7f' : '#7fd8ff';
    for (var i = 0; i < info.caps.length; i++) {
      var cc = cellCenter(info.caps[i].r, info.caps[i].c);
      spawnBurst(cc.x, cc.y, capColor, 10);
      spawnBurst(cc.x, cc.y, '#ffffff', 3);
    }
    spawnBurst(dest.x, dest.y, color === 'red' ? '#ff8fa3' : '#aab4d6', 6);
    if (info.crowned) {
      lastCrown = { r: m.tr, c: m.tc, t: Date.now() };
      spawnBurst(dest.x, dest.y, '#ffe600', 26);
      spawnBurst(dest.x, dest.y, '#fff6a8', 12);
      shakeStage();
      if (Arcade.fx) Arcade.fx.shake(document.body);
      if (Arcade.audio) Arcade.audio.play('clear');
      setMsg(T('gs.checkers.crownedMsg'), 'var(--neon-yellow)');
    } else if (info.caps.length) {
      if (Arcade.audio) Arcade.audio.play('match');
    } else if (Arcade.audio) {
      Arcade.audio.play('move');
    }
  }

  function afterHumanMove() {
    if (isAI()) {
      if (checkEnd()) return;
      scheduleAI(230);
    } else {
      if (checkEnd()) return;
      updateTurnMsg();
      writeSave();
    }
  }

  function commitMove(m, color) {
    pushHist();
    var info = applyTo(board, m);
    animateMove(m, info, color);
    ply++;
    noCap = info.caps.length ? 0 : noCap + 1;
    if (color === 'red') {
      capsRed += info.caps.length;
      if (info.crowned) kingsRed++;
      score += info.caps.length + (info.crowned ? 2 : 0);
    } else {
      capsBlack += info.caps.length;
      if (info.crowned) kingsBlack++;
      if (isPvp()) score += info.caps.length + (info.crowned ? 2 : 0);
    }
    moveLog.push({ fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc, jumps: m.jumps ? m.jumps.length : 0 });
    lastMove = { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc, color: color, caps: info.caps.length };
    selected = null; legalTargets = [];
    turn = color === 'red' ? 'black' : 'red';
    refresh();
  }

  function humanMove(m) {
    if (mode === MODE_PUZZLE) { tryPuzzleMove(m); return; }
    var color = turn;
    commitMove(m, color);
    if (color === 'red' || isPvp()) writeSave();
    afterHumanMove();
  }

  function checkEnd() {
    var redN = countColor(board, 'red'), blackN = countColor(board, 'black');
    if (redN === 0) { finishGame('lose', 'all'); return true; }
    if (blackN === 0) { finishGame('win', 'all'); return true; }
    if (noCap >= DRAW_LIMIT) { finishGame('draw', 'limit'); return true; }
    if (!genMoves(board, turn).length) {
      if (turn === 'red') finishGame('lose', 'stuck');
      else finishGame('win', 'stuck');
      return true;
    }
    return false;
  }

  /* ---------------- AI 调度 ---------------- */
  function scheduleAI(delay) {
    if (!isAI() || over || turn !== 'black') return;
    cancelAI();
    aiThinking = true;
    var seq = ++aiSeq;
    setMsg(T('gs.checkers.aiThinking'), 'var(--text-dim)');
    updateHud();
    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (seq !== aiSeq || over || turn !== 'black') return;
      var m = aiChoose();
      if (seq !== aiSeq || over || turn !== 'black') return;
      aiThinking = false;
      if (!m) { checkEnd(); updateHud(); return; }
      commitMove(m, 'black');
      writeSave();
      if (checkEnd()) return;
      updateTurnMsg();
      updateHud();
      maybeOfferDrawByAI();
    }, delay || 230);
  }

  function cancelAI() {
    aiSeq++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  }

  /* ---------------- 求和 ---------------- */
  function offerDraw() {
    if (over || !isAI() || turn !== 'red' || aiThinking || drawOpen) return;
    var adv = evalBoard(board);
    if (adv <= DRAW_ACCEPT) {
      closeDrawOffer();
      finishGame('draw', 'agree');
    } else {
      setMsg(T('gs.checkers.drawRefused'), 'var(--neon-pink)');
      if (Arcade.audio) Arcade.audio.play('error');
    }
  }

  function maybeOfferDrawByAI() {
    if (!isAI() || over || turn !== 'red' || drawOpen) return;
    if (noCap < 10) return;
    if (ply - lastDrawPly < 12) return;
    if (Math.abs(evalBoard(board)) > 0.45) return;
    if (Math.random() > 0.3) return;
    lastDrawPly = ply;
    showDrawOffer();
  }

  function showDrawOffer() {
    if (over || drawOpen) return;
    drawOpen = true;
    doTitle.textContent = T('gs.checkers.aiDrawTitle');
    doSub.textContent = T('gs.checkers.aiDrawSub');
    doIcon.innerHTML = iconHandshake();
    doOffer.classList.remove('hidden');
    updateHud();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function closeDrawOffer() {
    drawOpen = false;
    doOffer.classList.add('hidden');
    updateHud();
  }

  function acceptDrawOffer() {
    if (!drawOpen) return;
    closeDrawOffer();
    finishGame('draw', 'agree');
  }

  function declineDrawOffer() {
    if (!drawOpen) return;
    closeDrawOffer();
    lastDrawPly = Math.max(lastDrawPly, ply);
    setMsg(T('gs.checkers.drawDeclined'), 'var(--text-dim)');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------------- 残局流程 ---------------- */
  function tryPuzzleMove(m) {
    var pz = PUZZLES[puzzleIdx];
    var remaining = pz.moves - puzzleRedMoves;
    var test = cloneBoard(board);
    var testUndo = applyTo(test, m);
    var winning = winWithin(test, 'black', remaining - 1);
    revertFrom(test, m, testUndo);
    if (!winning) {
      setMsg(T('gs.checkers.puzzleWrong'), 'var(--neon-pink)');
      if (Arcade.audio) Arcade.audio.play('error');
      shakeStage();
      return;
    }
    pushHist();
    var info = applyTo(board, m);
    animateMove(m, info, 'red');
    ply++;
    noCap = info.caps.length ? 0 : noCap + 1;
    capsRed += info.caps.length;
    if (info.crowned) kingsRed++;
    score += info.caps.length + (info.crowned ? 2 : 0);
    moveLog.push({ fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc });
    lastMove = { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc, color: 'red', caps: info.caps.length };
    puzzleRedMoves++;
    selected = null; legalTargets = [];
    turn = 'black';
    refresh();
    setMsg(T('gs.checkers.puzzleTurn').replace('{n}', Math.max(0, pz.moves - puzzleRedMoves)), 'var(--neon-yellow)');
    if (countColor(board, 'black') === 0 || !genMoves(board, 'black').length) {
      finishPuzzle(true);
      return;
    }
    puzzleBusy = true;
    setTimeout(function () {
      puzzleBusy = false;
      if (mode !== MODE_PUZZLE || over) return;
      var ms = genMoves(board, 'black');
      if (!ms.length) { finishPuzzle(true); return; }
      var bm = ms[0];
      var binfo = applyTo(board, bm);
      animateMove(bm, binfo, 'black');
      ply++;
      noCap = binfo.caps.length ? 0 : noCap + 1;
      capsBlack += binfo.caps.length;
      if (binfo.crowned) kingsBlack++;
      moveLog.push({ fr: bm.fr, fc: bm.fc, tr: bm.tr, tc: bm.tc });
      lastMove = { fr: bm.fr, fc: bm.fc, tr: bm.tr, tc: bm.tc, color: 'black', caps: binfo.caps.length };
      turn = 'red';
      refresh();
      if (countColor(board, 'red') === 0 || !genMoves(board, 'red').length) { finishPuzzle(false); return; }
      setMsg(T('gs.checkers.puzzleTurn').replace('{n}', Math.max(0, pz.moves - puzzleRedMoves)), 'var(--neon-yellow)');
    }, 320);
  }

  function finishPuzzle(won) {
    if (over) return;
    over = true; cancelAI(); puzzleBusy = false;
    if (won) {
      markSolved(PUZZLES[puzzleIdx].id);
      if (Arcade.audio) Arcade.audio.play('win');
      if (Arcade.juice) Arcade.juice.win();
      burstCenter('#ffe600', 40);
      shakeStage();
      if (Arcade.fx) Arcade.fx.shake(document.body);
    } else {
      if (Arcade.audio) Arcade.audio.play('lose');
      if (Arcade.juice) Arcade.juice.lose();
      shakeStage();
    }
    refresh();
    setMsg(won ? T('gs.checkers.puzzleSolvedMsg') : T('gs.checkers.puzzleFailMsg'),
      won ? 'var(--neon-green)' : 'var(--neon-pink)');
    scheduleResult(won ? 'puzzleWin' : 'puzzleLose', won ? 'puzzle' : 'puzzleFail');
  }

  /* ---------------- 结算 ---------------- */
  function finishGame(kind, reason) {
    if (over) return;
    over = true; cancelAI(); selected = null; legalTargets = [];
    closeDrawOffer();
    clearSave();
    var prevBest = getBest();
    var isNew = false;
    if (isAI()) {
      if (kind === 'win') score += 5;
      isNew = score > prevBest;
      if (isNew) setBest(score);
      if (Arcade.shell && Arcade.shell.submitScore) Arcade.shell.submitScore(score);
    } else if (isPvp() && kind === 'win') {
      score += 5;
    }
    refresh();
    if (kind === 'win') {
      if (Arcade.audio) Arcade.audio.play('win');
      if (Arcade.juice) Arcade.juice.win();
      burstCenter('#39ff14', 34);
      shakeStage();
      if (Arcade.fx) Arcade.fx.shake(document.body);
    } else if (kind === 'lose') {
      if (Arcade.audio) Arcade.audio.play('lose');
      if (Arcade.juice) Arcade.juice.lose();
      burstCenter('#ff5b7f', 14);
      shakeStage();
    } else {
      if (Arcade.audio) Arcade.audio.play('ui');
      burstCenter('#00f0ff', 16);
      shakeStage();
    }
    setMsg(kind === 'win' ? T('gs.checkers.winScore').replace('{n}', score)
      : kind === 'lose' ? T('gs.checkers.loseAll').replace('{n}', score)
        : T('gs.checkers.drawTitle'), kind === 'win' ? 'var(--neon-green)' : kind === 'lose' ? 'var(--neon-pink)' : 'var(--text-dim)');
    scheduleResult(kind, reason, isNew, prevBest);
  }

  function scheduleResult(kind, reason, isNew, prevBest) {
    if (resultTimer) clearTimeout(resultTimer);
    resultTimer = setTimeout(function () {
      resultTimer = null;
      showResult(kind, reason, isNew, prevBest);
    }, 420);
  }

  function resultInfo(kind, reason, isNew, prevBest) {
    var pz = mode === MODE_PUZZLE;
    var title, sub, icon, cls = '';
    if (kind === 'win') {
      title = isPvp() ? T('gs.checkers.pvpWinTitle').replace('{x}', T('gs.checkers.colorRed')) : T('gs.checkers.winTitle');
      sub = isPvp() ? T('gs.checkers.pvpWinSub') : T('gs.checkers.winSub').replace('{n}', score);
      icon = iconTrophy(); cls = 'win';
    } else if (kind === 'lose') {
      title = isPvp() ? T('gs.checkers.pvpWinTitle').replace('{x}', T('gs.checkers.colorBlack')) : T('gs.checkers.loseTitle');
      sub = isPvp() ? T('gs.checkers.pvpLoseSub') : T('gs.checkers.loseSub').replace('{n}', score);
      icon = iconSkull();
    } else if (kind === 'puzzleWin') {
      title = T('gs.checkers.puzzleSolvedTitle'); sub = T('gs.checkers.puzzleSolvedSub'); icon = iconTrophy(); cls = 'win';
    } else if (kind === 'puzzleLose') {
      title = T('gs.checkers.puzzleFailTitle'); sub = T('gs.checkers.puzzleFailSub'); icon = iconSkull();
    } else {
      title = T('gs.checkers.drawTitle'); sub = T('gs.checkers.drawSub').replace('{n}', score); icon = iconHandshake();
    }
    if (reason === 'stuck' && kind !== 'draw') {
      sub = T('gs.checkers.stuckSub').replace('{n}', score);
    }
    return { title: title, sub: sub, icon: icon, cls: cls, pz: pz };
  }

  function showResult(kind, reason, isNew, prevBest) {
    var info = resultInfo(kind, reason, isNew, prevBest);
    resIcon.innerHTML = info.icon;
    resTitle.textContent = info.title;
    resTitle.className = info.cls;
    resSub.innerHTML = info.sub;
    var pz = mode === MODE_PUZZLE;
    var bestVal = isAI() ? Math.max(prevBest || 0, score) : isPvp() ? '—' : solvedCount() + '/' + PUZZLES.length;
    var capsVal = isPvp() ? capsRed + ' : ' + capsBlack : String(capsRed);
    var cells = [
      [T('gs.checkers.statMode'), modeLabel()],
      [T('gs.checkers.statCaps'), capsVal],
      [T('gs.checkers.statKings'), String(kingsRed)],
      [T('gs.checkers.statSteps'), String(ply)],
      [pz ? T('gs.checkers.statProgress') : T('gs.checkers.statBest'), String(bestVal)]
    ];
    resGrid.innerHTML = '';
    cells.forEach(function (row) {
      var cell = document.createElement('div');
      cell.className = 'ck-res-cell';
      var lab = document.createElement('span');
      lab.textContent = row[0];
      var val = document.createElement('b');
      val.textContent = row[1];
      if (row[0] === (pz ? T('gs.checkers.statProgress') : T('gs.checkers.statBest')) && isNew) {
        val.className = 'new';
        val.textContent = row[1] + ' · ' + T('gs.checkers.newBestShort');
      }
      cell.appendChild(lab); cell.appendChild(val);
      resGrid.appendChild(cell);
    });
    resBtns.innerHTML = '';
    function addBtn(label, cls, action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (cls || '');
      b.textContent = label;
      b.setAttribute('data-act', action);
      b.addEventListener('click', onResultAction);
      resBtns.appendChild(b);
    }
    if (pz) {
      addBtn(T('gs.checkers.puzzleNext'), 'green', 'nextpuz');
      addBtn(T('gs.checkers.puzzleReset'), 'purple', 'resetpuz');
      addBtn(T('gs.checkers.choosePuzzle'), '', 'pick');
    } else {
      addBtn(T('gs.checkers.playAgain'), 'green', 'again');
      var idx = DIFFS.indexOf(difficulty);
      if (isAI() && idx >= 0 && idx < DIFFS.length - 1 && (kind === 'win' || kind === 'draw')) {
        addBtn(T('gs.checkers.nextLevel'), 'purple', 'next');
      }
    }
    resultOverlay.classList.remove('hidden');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function onResultAction(e) {
    var act = e.currentTarget.getAttribute('data-act');
    closeResult();
    if (act === 'again') newGame();
    else if (act === 'next') {
      var idx = DIFFS.indexOf(difficulty);
      if (idx >= 0 && idx < DIFFS.length - 1) difficulty = DIFFS[idx + 1];
      newGame();
    } else if (act === 'nextpuz') {
      loadPuzzle(puzzleIdx + 1);
    } else if (act === 'resetpuz') {
      loadPuzzle(puzzleIdx);
    } else if (act === 'pick') {
      openPicker();
    }
  }

  function closeResult() {
    resultOverlay.classList.add('hidden');
    if (resultTimer) { clearTimeout(resultTimer); resultTimer = null; }
  }

  /* ---------------- 悔棋 ---------------- */
  function undoMove() {
    if (drawOpen) return;
    if (!hist.length) {
      setMsg(T('gs.checkers.undoNone'), 'var(--neon-yellow)');
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    cancelAI();
    puzzleBusy = false;
    closeResult();
    var s = hist.pop();
    restore(s);
    turn = 'red';
    selected = null; legalTargets = [];
    drawOpen = false; doOffer.classList.add('hidden');
    refresh();
    writeSave();
    setMsg(mode === MODE_PUZZLE
      ? T('gs.checkers.puzzleTurn').replace('{n}', Math.max(0, PUZZLES[puzzleIdx].moves - puzzleRedMoves))
      : T('gs.checkers.undone'), 'var(--text-dim)');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------------- 进度 / 最高分 ---------------- */
  function bestKey() { return 'arcade.checkers.best.' + difficulty; }
  function getBest() { try { return parseInt(localStorage.getItem(bestKey()) || '0', 10) || 0; } catch (e) { return 0; } }
  function setBest(v) { try { localStorage.setItem(bestKey(), String(v)); } catch (e) {} }

  function loadSolved() {
    try {
      var v = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function markSolved(id) {
    try {
      var arr = loadSolved();
      if (arr.indexOf(id) < 0) { arr.push(id); localStorage.setItem(PROGRESS_KEY, JSON.stringify(arr)); }
    } catch (e) {}
    updateHud();
  }
  function solvedCount() { return loadSolved().length; }

  /* ---------------- 界面 ---------------- */
  var wrap = document.createElement('div');
  wrap.className = 'ck-wrap';
  wrap.innerHTML =
    '<div class="ck-topbar" id="ck-modes">' +
    '  <button type="button" class="ck-mode-btn active" data-mode="ai8">' + T('gs.checkers.modeAi8') + '</button>' +
    '  <button type="button" class="ck-mode-btn" data-mode="pvp8">' + T('gs.checkers.modePvp8') + '</button>' +
    '  <button type="button" class="ck-mode-btn" data-mode="ai10">' + T('gs.checkers.modeAi10') + '</button>' +
    '  <button type="button" class="ck-mode-btn" data-mode="puzzle">' + T('gs.checkers.modePuzzle') + '</button>' +
    '</div>' +
    '<div class="ck-diff on" id="ck-diff">' +
    '  <button type="button" class="ck-diff-btn" data-d="easy">' + T('gs.checkers.dEasy') + '</button>' +
    '  <button type="button" class="ck-diff-btn active" data-d="normal">' + T('gs.checkers.dNormal') + '</button>' +
    '  <button type="button" class="ck-diff-btn" data-d="hard">' + T('gs.checkers.dHard') + '</button>' +
    '</div>' +
    '<div class="ck-hud">' +
    '  <div class="ck-stat"><span>' + T('gs.checkers.hudMode') + '</span><b id="ck-mode-label">—</b></div>' +
    '  <div class="ck-stat"><span>' + T('gs.checkers.hudScore') + '</span><b id="ck-score">0</b></div>' +
    '  <div class="ck-stat"><span id="ck-best-label">' + T('gs.checkers.hudBest') + '</span><b id="ck-best">0</b></div>' +
    '  <div class="ck-stat"><span>' + T('gs.checkers.hudPieces') + '</span><b id="ck-pieces">12 : 12</b></div>' +
    '</div>' +
    '<div class="ck-stage" id="ck-stage"><canvas id="ck-board" class="ck-canvas" aria-label="' + T('gs.checkers.boardAria') + '"></canvas></div>' +
    '<div class="ck-turnbar"><i id="ck-dot" class="ck-dot red"></i><span id="ck-turn"></span><span id="ck-steps"></span></div>' +
    '<div class="ck-msg" id="ck-msg"></div>' +
    '<div class="ck-actions">' +
    '  <button type="button" class="ck-act" id="ck-undo">' + T('gs.checkers.undo') + '</button>' +
    '  <button type="button" class="ck-act" id="ck-draw">' + T('gs.checkers.drawOffer') + '</button>' +
    '  <button type="button" class="ck-act" id="ck-restart">' + T('gs.checkers.restart') + '</button>' +
    '</div>' +
    '<div class="ck-puzbar" id="ck-puzbar">' +
    '  <span id="ck-puz-info"></span>' +
    '  <span class="ck-puz-btns">' +
    '    <button type="button" class="ck-mini" id="ck-puz-next">' + T('gs.checkers.puzzleNext') + '</button>' +
    '    <button type="button" class="ck-mini" id="ck-puz-reset">' + T('gs.checkers.puzzleReset') + '</button>' +
    '  </span>' +
    '</div>' +
    '<div class="ck-help">' + T('gs.checkers.help') + '</div>' +
    '<div class="ck-help ck-lore">' + T('gs.checkers.helpText') + '</div>' +
    '<div class="ck-overlay hidden" id="ck-overlay">' +
    '  <div class="ck-ov-card" role="dialog" aria-modal="true">' +
    '    <div class="ck-ov-icon" id="ck-res-icon"></div>' +
    '    <h2 id="ck-res-title"></h2>' +
    '    <p id="ck-res-sub"></p>' +
    '    <div class="ck-res-grid" id="ck-res-grid"></div>' +
    '    <div class="ck-ov-btns" id="ck-res-btns"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="ck-overlay hidden" id="ck-doffer">' +
    '  <div class="ck-ov-card ck-small" role="dialog" aria-modal="true">' +
    '    <div class="ck-ov-icon" id="ck-do-icon"></div>' +
    '    <h2 id="ck-do-title"></h2>' +
    '    <p id="ck-do-sub"></p>' +
    '    <div class="ck-ov-btns">' +
    '      <button type="button" class="btn green" id="ck-do-accept">' + T('gs.checkers.acceptDraw') + '</button>' +
    '      <button type="button" class="btn" id="ck-do-decline">' + T('gs.checkers.declineDraw') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="ck-overlay hidden" id="ck-picker">' +
    '  <div class="ck-ov-card ck-picker-card" role="dialog" aria-modal="true">' +
    '    <div class="ck-pk-head"><h2 id="ck-pk-title">' + T('gs.checkers.pickTitle') + '</h2>' +
    '      <button type="button" class="ck-pk-close" id="ck-pk-close" aria-label="' + T('gs.checkers.close') + '">×</button></div>' +
    '    <p id="ck-pk-sub"></p>' +
    '    <div class="ck-pk-list" id="ck-pk-list"></div>' +
    '  </div>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#ck-board');
  var ctx = canvas.getContext('2d');
  var stageEl = wrap.querySelector('#ck-stage');
  var msg = wrap.querySelector('#ck-msg');
  var modeRow = wrap.querySelector('#ck-modes');
  var diffRow = wrap.querySelector('#ck-diff');
  var scoreEl = wrap.querySelector('#ck-score');
  var bestEl = wrap.querySelector('#ck-best');
  var bestLabelEl = wrap.querySelector('#ck-best-label');
  var piecesEl = wrap.querySelector('#ck-pieces');
  var modeLabelEl = wrap.querySelector('#ck-mode-label');
  var turnEl = wrap.querySelector('#ck-turn');
  var turnDot = wrap.querySelector('#ck-dot');
  var stepsEl = wrap.querySelector('#ck-steps');
  var undoBtn = wrap.querySelector('#ck-undo');
  var drawBtn = wrap.querySelector('#ck-draw');
  var restartBtn = wrap.querySelector('#ck-restart');
  var puzbar = wrap.querySelector('#ck-puzbar');
  var puzInfo = wrap.querySelector('#ck-puz-info');
  var puzNext = wrap.querySelector('#ck-puz-next');
  var puzReset = wrap.querySelector('#ck-puz-reset');
  var resultOverlay = wrap.querySelector('#ck-overlay');
  var resIcon = wrap.querySelector('#ck-res-icon');
  var resTitle = wrap.querySelector('#ck-res-title');
  var resSub = wrap.querySelector('#ck-res-sub');
  var resGrid = wrap.querySelector('#ck-res-grid');
  var resBtns = wrap.querySelector('#ck-res-btns');
  var doOffer = wrap.querySelector('#ck-doffer');
  var doIcon = wrap.querySelector('#ck-do-icon');
  var doTitle = wrap.querySelector('#ck-do-title');
  var doSub = wrap.querySelector('#ck-do-sub');
  var doAccept = wrap.querySelector('#ck-do-accept');
  var doDecline = wrap.querySelector('#ck-do-decline');
  var picker = wrap.querySelector('#ck-picker');
  var pkList = wrap.querySelector('#ck-pk-list');
  var pkSub = wrap.querySelector('#ck-pk-sub');
  var pkClose = wrap.querySelector('#ck-pk-close');

  /* ---------------- 自绘图标 ---------------- */
  function iconTrophy() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<defs><linearGradient id="ckGold" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fff6a8"/><stop offset=".55" stop-color="#ffe600"/><stop offset="1" stop-color="#c58a00"/></linearGradient></defs>' +
      '<path d="M20 9h24v9c0 9-5.4 15-12 15s-12-6-12-15V9z" fill="url(#ckGold)" stroke="#ffcf3a" stroke-width="1.6"/>' +
      '<path d="M20 12H11c0 8 4 12 9.5 12M44 12h9c0 8-4 12-9.5 12" fill="none" stroke="#ffd84d" stroke-width="2.4"/>' +
      '<path d="M28 32h8v7h-8z" fill="#e0a900"/><path d="M21 47c0-5 4.5-8 11-8s11 3 11 8v4H21z" fill="url(#ckGold)"/>' +
      '<path d="M18 55h28v4H18z" fill="#b87d00" stroke="#ffcf3a" stroke-width="1.2"/>' +
      '<path d="M32 12l2.1 4.6 5 .5-3.8 3.5 1.1 5-4.4-2.6-4.4 2.6 1.1-5-3.8-3.5 5-.5z" fill="#fffbe0" opacity=".9"/></svg>';
  }
  function iconSkull() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<defs><linearGradient id="ckBone" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f4f6ff"/><stop offset="1" stop-color="#9aa3bf"/></linearGradient></defs>' +
      '<path d="M32 6c-13.5 0-23 9.3-23 22 0 7.8 3.8 13.4 10 16.8V54h5l2-5h12l2 5h5v-9.2C51.2 41.4 55 35.8 55 28c0-12.7-9.5-22-23-22z" fill="url(#ckBone)" stroke="#d7ddff" stroke-width="1.4"/>' +
      '<ellipse cx="23.5" cy="28" rx="6" ry="7" fill="#151827"/><ellipse cx="40.5" cy="28" rx="6" ry="7" fill="#151827"/>' +
      '<path d="M32 33l-4.5 8h9z" fill="#151827"/>' +
      '<path d="M24 45v7M32 45v7M40 45v7" stroke="#151827" stroke-width="2.2"/>' +
      '<path d="M18 9c5-4 12-5 19-4" stroke="#ff2d95" stroke-width="2" fill="none" opacity=".55"/></svg>';
  }
  function iconHandshake() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<defs><linearGradient id="ckCyan" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#8ff8ff"/><stop offset="1" stop-color="#00b7d9"/></linearGradient>' +
      '<linearGradient id="ckPink" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ffb0c9"/><stop offset="1" stop-color="#d81b60"/></linearGradient></defs>' +
      '<path d="M6 24l12-8 9 7-8 9-13-3z" fill="url(#ckPink)" stroke="#ff7ba7" stroke-width="1.2"/>' +
      '<path d="M58 24l-12-8-9 7 8 9 13-3z" fill="url(#ckCyan)" stroke="#6ff2ff" stroke-width="1.2"/>' +
      '<path d="M18 23l8-5 7 5 7-5 8 5-7 6 4 5-5 6-7-6-7 6-5-6 4-5z" fill="#ffe600" opacity=".92"/>' +
      '<path d="M19 28l10 10M45 28l-10 10" stroke="#fff3a0" stroke-width="1.8"/>' +
      '<path d="M10 38l6 10M54 38l-6 10" stroke="#ff2d95" stroke-width="2" opacity=".6"/></svg>';
  }

  /* ---------------- 画布 ---------------- */
  var scale = 1, cssW = 360, margin = 28, cell = 68;
  function layoutCanvas() {
    var w = stageEl.clientWidth || 360;
    if (!w) w = 360;
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);
    cssW = w;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(w * dpr);
    }
    scale = canvas.width / LOGICAL;
    margin = N === 8 ? 27 : 19;
    cell = (LOGICAL - margin * 2) / N;
  }
  function cellCenter(r, c) {
    return { x: margin + cell * (c + 0.5), y: margin + cell * (r + 0.5) };
  }
  function cellAt(px, py) {
    var c = Math.floor((px - margin) / cell);
    var r = Math.floor((py - margin) / cell);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    return { r: r, c: c };
  }

  function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function burstCenter(color, count) {
    if (Arcade.fx) Arcade.fx.centerBurst(color, count);
  }
  function spawnBurst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 0.6 + Math.random() * 2.4;
      particles.push({
        x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.1,
        life: 1, decay: 0.018 + Math.random() * 0.02, size: 1.5 + Math.random() * 3, color: color
      });
      if (particles.length > 220) particles.shift();
    }
  }
  function shakeStage() {
    stageEl.classList.remove('ck-shake');
    void stageEl.offsetWidth;
    stageEl.classList.add('ck-shake');
  }

  function drawBoard() {
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, LOGICAL, LOGICAL);
    var g = ctx.createLinearGradient(0, 0, LOGICAL, LOGICAL);
    g.addColorStop(0, '#151a2b');
    g.addColorStop(0.5, '#0c0f1c');
    g.addColorStop(1, '#171226');
    ctx.fillStyle = g;
    roundRect(0, 0, LOGICAL, LOGICAL, 18);
    ctx.fill();

    var pad = margin - 4;
    var inner = LOGICAL - pad * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,240,255,.35)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(0,240,255,.55)';
    ctx.lineWidth = 1.4;
    roundRect(pad, pad, inner, inner, 10);
    ctx.stroke();
    ctx.restore();

    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var x = margin + c * cell, y = margin + r * cell;
        if (isDark(r, c)) {
          var dg = ctx.createLinearGradient(x, y, x + cell, y + cell);
          dg.addColorStop(0, '#5c4632');
          dg.addColorStop(0.6, '#493626');
          dg.addColorStop(1, '#33251a');
          ctx.fillStyle = dg;
        } else {
          var lg = ctx.createLinearGradient(x, y, x + cell, y + cell);
          lg.addColorStop(0, '#efe3c8');
          lg.addColorStop(0.62, '#dfcfae');
          lg.addColorStop(1, '#c7b18a');
          ctx.fillStyle = lg;
        }
        ctx.fillRect(x, y, cell, cell);
        if (isDark(r, c)) {
          ctx.strokeStyle = 'rgba(0,240,255,.10)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
      }
    }

    /* 外框高亮角 */
    var corner = 17;
    ctx.strokeStyle = 'rgba(0,240,255,.8)';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = 'rgba(0,240,255,.7)';
    ctx.shadowBlur = 8;
    [[pad, pad, 1, 1], [LOGICAL - pad, pad, -1, 1], [pad, LOGICAL - pad, 1, -1], [LOGICAL - pad, LOGICAL - pad, -1, -1]]
      .forEach(function (v) {
        ctx.beginPath();
        ctx.moveTo(v[0] + v[2] * corner, v[1]);
        ctx.lineTo(v[0], v[1]);
        ctx.lineTo(v[0], v[1] + v[3] * corner);
        ctx.stroke();
      });
    ctx.shadowBlur = 0;

    /* 上一步轨迹 */
    if (lastMove) {
      var a = cellCenter(lastMove.fr, lastMove.fc);
      var b = cellCenter(lastMove.tr, lastMove.tc);
      ctx.strokeStyle = lastMove.color === 'red' ? 'rgba(255,110,140,.75)' : 'rgba(120,220,255,.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,240,255,.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - cell * 0.44, b.y - cell * 0.44, cell * 0.88, cell * 0.88);
    }

    /* 吃子提示：强制跳（使用缓存的合法走法，避免每帧搜索） */
    var mustJump = hints.ready && hints.must;
    var jumpSources = hints.sources;

    /* 棋子 */
    for (var rr = 0; rr < N; rr++) {
      for (var cc = 0; cc < N; cc++) {
        var p = board[rr][cc];
        if (!p) continue;
        drawPiece(rr, cc, p, mustJump && jumpSources[rr + ',' + cc]);
      }
    }

    /* 选中 */
    if (selected) {
      var sc = cellCenter(selected.r, selected.c);
      var t = performance.now() / 1000;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,230,0,.95)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255,230,0,.8)';
      ctx.shadowBlur = 12 + Math.sin(t * 4) * 4;
      ctx.strokeRect(sc.x - cell * 0.46, sc.y - cell * 0.46, cell * 0.92, cell * 0.92);
      ctx.restore();
    }

    /* 可落点 */
    for (var li = 0; li < legalTargets.length; li++) {
      var lm = legalTargets[li];
      var tc = cellCenter(lm.tr, lm.tc);
      var pulse = 1 + Math.sin(performance.now() / 330) * 0.08;
      if (lm.jumps.length) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,45,149,.95)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255,45,149,.85)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, cell * 0.26 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,45,149,.15)';
        ctx.fill();
        if (lm.jumps.length > 1) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffe600';
          ctx.font = 'bold ' + Math.max(11, Math.round(cell * 0.3)) + 'px system-ui,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(lm.jumps.length), tc.x, tc.y + 0.5);
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = 'rgba(57,255,20,.9)';
        ctx.shadowColor = 'rgba(57,255,20,.8)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, cell * 0.12 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    /* 升王金环 */
    if (lastCrown) {
      var age = (Date.now() - lastCrown.t) / 420;
      if (age < 1) {
        var cp = cellCenter(lastCrown.r, lastCrown.c);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,230,0,' + (1 - age) + ')';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, cell * (0.3 + age * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else { lastCrown = null; }
    }

    /* 光标 */
    if (!over && cursor && (turn === 'red' || isPvp()) && !drawOpen) {
      var cu = cellCenter(cursor.r, cursor.c);
      var inset = cell * 0.08, len = cell * 0.2;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,240,255,.9)';
      ctx.lineWidth = 2;
      var x0 = cu.x - cell / 2 + inset, y0 = cu.y - cell / 2 + inset;
      var x1 = cu.x + cell / 2 - inset, y1 = cu.y + cell / 2 - inset;
      [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(function (v) {
        ctx.beginPath();
        ctx.moveTo(v[0] + v[2] * len, v[1]);
        ctx.lineTo(v[0], v[1]);
        ctx.lineTo(v[0], v[1] + v[3] * len);
        ctx.stroke();
      });
      ctx.restore();
    }

    /* AI 思考脉冲 */
    if (aiThinking) {
      var alpha = 0.25 + Math.sin(performance.now() / 260) * 0.15;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,45,149,' + alpha + ')';
      ctx.lineWidth = 3;
      roundRect(pad, pad, inner, inner, 10);
      ctx.stroke();
      ctx.restore();
    }

    /* 粒子 */
    for (var pi = 0; pi < particles.length; pi++) {
      var pt = particles[pi];
      if (pt.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPiece(r, c, p, forced) {
    var pos = cellCenter(r, c);
    var rad = cell * 0.37;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    var grad = ctx.createRadialGradient(pos.x - rad * 0.32, pos.y - rad * 0.38, rad * 0.08, pos.x, pos.y, rad);
    if (p.color === 'red') {
      grad.addColorStop(0, '#ffd0da');
      grad.addColorStop(0.36, '#f06486');
      grad.addColorStop(0.75, '#b01840');
      grad.addColorStop(1, '#650c22');
    } else {
      grad.addColorStop(0, '#d9deef');
      grad.addColorStop(0.36, '#6b7390');
      grad.addColorStop(0.75, '#272b3b');
      grad.addColorStop(1, '#0c0e17');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = p.color === 'red' ? 'rgba(255,150,175,.9)' : 'rgba(150,190,255,.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rad - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rad * 0.68, 0, Math.PI * 2);
    ctx.stroke();

    if (p.king) {
      var kg = ctx.createLinearGradient(pos.x - rad, pos.y - rad, pos.x + rad, pos.y + rad);
      kg.addColorStop(0, '#fff6a8');
      kg.addColorStop(0.5, '#ffe600');
      kg.addColorStop(1, '#b57e00');
      ctx.fillStyle = kg;
      ctx.shadowColor = 'rgba(255,230,0,.9)';
      ctx.shadowBlur = 10;
      var s = rad * 0.56;
      ctx.beginPath();
      ctx.moveTo(pos.x - s * 0.72, pos.y + s * 0.4);
      ctx.lineTo(pos.x - s * 0.72, pos.y - s * 0.18);
      ctx.lineTo(pos.x - s * 0.3, pos.y + s * 0.06);
      ctx.lineTo(pos.x, pos.y - s * 0.58);
      ctx.lineTo(pos.x + s * 0.3, pos.y + s * 0.06);
      ctx.lineTo(pos.x + s * 0.72, pos.y - s * 0.18);
      ctx.lineTo(pos.x + s * 0.72, pos.y + s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(80,50,0,.75)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(80,50,0,.55)';
      ctx.fillRect(pos.x - s * 0.6, pos.y + s * 0.36, s * 1.2, s * 0.14);
    }

    if (forced) {
      ctx.fillStyle = 'rgba(255,45,149,.95)';
      ctx.shadowColor = 'rgba(255,45,149,.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pos.x + rad * 0.78, pos.y - rad * 0.78, Math.max(2.5, rad * 0.09), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  var lastFrame = 0;
  function loop(now) {
    var dt = Math.min(34, now - (lastFrame || now));
    lastFrame = now;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life <= 0) continue;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.vy += 0.075 * (dt / 16);
      p.life -= p.decay * (dt / 16);
    }
    while (particles.length && particles[0].life <= 0) particles.shift();
    drawBoard();
    requestAnimationFrame(loop);
  }

  /* ---------------- HUD / 文案 ---------------- */
  function diffLabel() { return T(DIFF_KEYS[difficulty] || DIFF_KEYS.normal); }
  function modeLabel() {
    var base = T(MODE_KEYS[mode]);
    if (isAI()) return base + ' · ' + diffLabel();
    if (mode === MODE_PUZZLE) {
      var pz = PUZZLES[puzzleIdx];
      return base + ' · ' + pz.n + '×' + pz.n + (pz.intl ? ' · ' + T('gs.checkers.intlShort') : '');
    }
    return base;
  }

  function setMsg(text, color) {
    msg.textContent = text;
    msg.style.color = color || '';
  }

  function updateTurnMsg() {
    if (over) return;
    if (isAI()) {
      setMsg(T('gs.checkers.yourTurn'), 'var(--text-dim)');
    } else if (isPvp()) {
      setMsg(turn === 'red' ? T('gs.checkers.pvpTurnRed') : T('gs.checkers.pvpTurnBlack'),
        turn === 'red' ? 'var(--neon-pink)' : 'var(--neon-cyan)');
    } else {
      setMsg(T('gs.checkers.puzzleTurn').replace('{n}', Math.max(0, PUZZLES[puzzleIdx].moves - puzzleRedMoves)), 'var(--neon-yellow)');
    }
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    if (isAI()) {
      bestEl.textContent = String(Math.max(getBest(), score));
      bestLabelEl.textContent = T('gs.checkers.hudBest');
    } else if (mode === MODE_PUZZLE) {
      bestEl.textContent = solvedCount() + '/' + PUZZLES.length;
      bestLabelEl.textContent = T('gs.checkers.hudProgress');
    } else {
      bestEl.textContent = '—';
      bestLabelEl.textContent = T('gs.checkers.hudBest');
    }
    piecesEl.textContent = countColor(board, 'red') + ' : ' + countColor(board, 'black');
    modeLabelEl.textContent = modeLabel();
    turnEl.textContent = over ? T('gs.checkers.gameOver') : turn === 'red' ? T('gs.checkers.colorRedTurn') : isAI() ? T('gs.checkers.colorBlackTurnAI') : T('gs.checkers.colorBlackTurn');
    turnDot.className = 'ck-dot ' + (turn === 'red' ? 'red' : 'black');
    stepsEl.textContent = T('gs.checkers.stepFmt').replace('{n}', ply);
    var canDraw = isAI() && !over && turn === 'red' && !aiThinking && !drawOpen;
    drawBtn.disabled = !canDraw;
    drawBtn.title = canDraw ? '' : T('gs.checkers.drawLocked');
    undoBtn.disabled = !hist.length || drawOpen;
    puzbar.classList.toggle('on', mode === MODE_PUZZLE);
    if (mode === MODE_PUZZLE) {
      var pz = PUZZLES[puzzleIdx];
      puzInfo.textContent = T('gs.checkers.puzzleBadge')
        .replace('{n}', puzzleIdx + 1).replace('{total}', PUZZLES.length)
        .replace('{tier}', T(pz.tier === 1 ? 'gs.checkers.tierEasy' : pz.tier === 2 ? 'gs.checkers.tierMedium' : 'gs.checkers.tierHard'));
    }
  }

  function syncModeUI() {
    modeRow.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    diffRow.classList.toggle('on', isAI());
    diffRow.querySelectorAll('[data-d]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-d') === difficulty);
    });
    updateHud();
  }

  function refresh() {
    layoutCanvas();
    rebuildHints();
    drawBoard();
    updateHud();
  }

  /* ---------------- 输入 ---------------- */
  function rebuildHints() {
    hints = { all: [], must: false, sources: {}, ready: false };
    if (over || !board.length) return;
    var all = genMoves(board, turn);
    var must = !!(all.length && all[0].jumps.length);
    var map = {};
    if (must) {
      for (var i = 0; i < all.length; i++) map[all[i].fr + ',' + all[i].fc] = true;
    }
    hints = { all: all, must: must, sources: map, ready: true };
  }

  function forcedSources() {
    return { map: hints.sources, any: hints.must };
  }

  function selectPiece(r, c) {
    selected = { r: r, c: c };
    var ms = pieceMoves(board, r, c, turn);
    legalTargets = ms.map(function (m) { return { tr: m.tr, tc: m.tc, jumps: m.jumps, fr: m.fr, fc: m.fc }; });
    if (Arcade.audio) Arcade.audio.play('ui');
    refresh();
  }

  function onCellTap(r, c) {
    if (over || drawOpen || pickerOpen) return;
    if (!isPvp() && turn !== 'red') return;
    if (mode === MODE_PUZZLE && (puzzleBusy || turn !== 'red')) return;
    var p = board[r][c];
    var fs = forcedSources();
    if (selected) {
      var target = null;
      for (var i = 0; i < legalTargets.length; i++) {
        if (legalTargets[i].tr === r && legalTargets[i].tc === c) { target = legalTargets[i]; break; }
      }
      if (target) {
        humanMove({
          fr: selected.r, fc: selected.c, tr: r, tc: c,
          jumps: target.jumps
        });
        return;
      }
      if (p && p.color === turn) {
        if (fs.any && !fs.map[r + ',' + c]) {
          setMsg(T('gs.checkers.mustJump'), 'var(--neon-yellow)');
          if (Arcade.audio) Arcade.audio.play('error');
          return;
        }
        selectPiece(r, c);
        return;
      }
      selected = null; legalTargets = [];
      refresh();
      return;
    }
    if (p && p.color === turn) {
      if (fs.any && !fs.map[r + ',' + c]) {
        setMsg(T('gs.checkers.mustJump'), 'var(--neon-yellow)');
        if (Arcade.audio) Arcade.audio.play('error');
        return;
      }
      selectPiece(r, c);
    }
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var px = (e.clientX - rect.left) / rect.width * LOGICAL;
    var py = (e.clientY - rect.top) / rect.height * LOGICAL;
    var cellHit = cellAt(px, py);
    if (!cellHit) return;
    cursor = cellHit;
    onCellTap(cellHit.r, cellHit.c);
  });

  /* 按钮 */
  modeRow.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () {
      var target = b.getAttribute('data-mode');
      if (target === MODE_PUZZLE) { openPicker(); return; }
      closePicker();
      mode = target;
      N = mode === MODE_AI10 ? 10 : 8;
      INTL = N === 10;
      newGame();
      syncModeUI();
    });
  });
  diffRow.querySelectorAll('[data-d]').forEach(function (b) {
    b.addEventListener('click', function () {
      difficulty = b.getAttribute('data-d');
      syncModeUI();
      newGame();
    });
  });
  restartBtn.addEventListener('click', function () {
    if (mode === MODE_PUZZLE) loadPuzzle(puzzleIdx); else newGame();
  });
  undoBtn.addEventListener('click', undoMove);
  drawBtn.addEventListener('click', offerDraw);
  doAccept.addEventListener('click', acceptDrawOffer);
  doDecline.addEventListener('click', declineDrawOffer);
  pkClose.addEventListener('click', closePicker);
  puzNext.addEventListener('click', function () { loadPuzzle(puzzleIdx + 1); });
  puzReset.addEventListener('click', function () { loadPuzzle(puzzleIdx); });
  picker.addEventListener('click', function (e) {
    if (e.target === picker) closePicker();
  });

  /* 键盘：方向键 + Enter + Esc + U；R 由全局热键调用 GAME_RESTART */
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (drawOpen) {
      if (k === 'Enter') { e.preventDefault(); acceptDrawOffer(); return; }
      if (k === 'Escape') { e.preventDefault(); declineDrawOffer(); return; }
    }
    if (pickerOpen) {
      if (k === 'Escape') { e.preventDefault(); closePicker(); return; }
    }
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault(); e.stopPropagation();
      var dr = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0;
      var dc = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0;
      cursor.r = Math.max(0, Math.min(N - 1, cursor.r + dr));
      cursor.c = Math.max(0, Math.min(N - 1, cursor.c + dc));
      drawBoard();
      return;
    }
    if (k === 'Enter' || k === ' ') {
      if (e.target && e.target.tagName === 'BUTTON') return;
      e.preventDefault(); e.stopPropagation();
      onCellTap(cursor.r, cursor.c);
      return;
    }
    if (k === 'Escape') {
      e.preventDefault();
      selected = null; legalTargets = [];
      refresh();
      return;
    }
    if (k === 'u' || k === 'U') {
      e.preventDefault(); e.stopPropagation();
      undoMove();
      return;
    }
    if (k === 'd' || k === 'D') {
      e.preventDefault(); e.stopPropagation();
      offerDraw();
    }
  });

  /* ---------------- 题库 ---------------- */
  function tierKey(t) { return t === 1 ? 'gs.checkers.tierEasy' : t === 2 ? 'gs.checkers.tierMedium' : 'gs.checkers.tierHard'; }

  function openPicker() {
    pickerOpen = true;
    pkSub.textContent = T('gs.checkers.pickSub').replace('{n}', solvedCount()).replace('{total}', PUZZLES.length);
    pkList.innerHTML = '';
    var solved = loadSolved();
    PUZZLES.forEach(function (pz, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ck-pk-card tier-' + pz.tier;
      b.setAttribute('data-pid', String(i));
      var tier = document.createElement('span');
      tier.className = 'ck-pk-tier';
      tier.textContent = T(tierKey(pz.tier));
      var boardTag = document.createElement('span');
      boardTag.className = 'ck-pk-board';
      boardTag.textContent = pz.n + '×' + pz.n + (pz.intl ? ' · ' + T('gs.checkers.intlShort') : '');
      var name = document.createElement('b');
      name.textContent = T('gs.checkers.puzzleName').replace('{n}', i + 1);
      var state = document.createElement('span');
      state.className = 'ck-pk-state' + (solved.indexOf(pz.id) >= 0 ? ' done' : '');
      state.textContent = solved.indexOf(pz.id) >= 0 ? T('gs.checkers.solvedTag') : T('gs.checkers.unsolvedTag');
      b.appendChild(tier); b.appendChild(boardTag); b.appendChild(name); b.appendChild(state);
      b.addEventListener('click', function () { loadPuzzle(i); });
      pkList.appendChild(b);
    });
    picker.classList.remove('hidden');
    updateHud();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function closePicker() {
    pickerOpen = false;
    picker.classList.add('hidden');
    syncModeUI();
  }

  /* ---------------- 断点续玩 ---------------- */
  function writeSave() {
    if (mode !== MODE_AI8 && mode !== MODE_AI10) return false;
    if (over) return false;
    return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write());
  }
  function clearSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.clear();
  }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'checkers',
      collect: function () {
        if (mode !== MODE_AI8 && mode !== MODE_AI10) return null;
        if (over) return null;
        return {
          v: 1, mode: mode, difficulty: difficulty, board: board, turn: turn,
          score: score, capsRed: capsRed, capsBlack: capsBlack,
          kingsRed: kingsRed, kingsBlack: kingsBlack, ply: ply, noCap: noCap
        };
      },
      apply: function (s) {
        if (!s || (s.mode !== MODE_AI8 && s.mode !== MODE_AI10)) return false;
        var n = s.mode === MODE_AI10 ? 10 : 8;
        if (!Array.isArray(s.board) || s.board.length !== n) return false;
        for (var r = 0; r < n; r++) {
          if (!Array.isArray(s.board[r]) || s.board[r].length !== n) return false;
        }
        var bd = [];
        var reds = 0, blacks = 0;
        for (var rr = 0; rr < n; rr++) {
          bd[rr] = [];
          for (var cc = 0; cc < n; cc++) {
            var cellVal = s.board[rr][cc];
            if (cellVal == null) { bd[rr][cc] = null; continue; }
            if (cellVal.color !== 'red' && cellVal.color !== 'black') return false;
            bd[rr][cc] = { color: cellVal.color, king: !!cellVal.king };
            if (cellVal.color === 'red') reds++; else blacks++;
          }
        }
        if (reds === 0 || blacks === 0) return false;
        if (s.turn !== 'red' && s.turn !== 'black') return false;
        if (DIFFS.indexOf(s.difficulty) < 0) return false;
        mode = s.mode;
        difficulty = s.difficulty;
        N = n; INTL = n === 10;
        board = bd; turn = s.turn;
        score = Number(s.score) || 0;
        capsRed = Number(s.capsRed) || 0;
        capsBlack = Number(s.capsBlack) || 0;
        kingsRed = Number(s.kingsRed) || 0;
        kingsBlack = Number(s.kingsBlack) || 0;
        ply = Number(s.ply) || 0;
        noCap = Number(s.noCap) || 0;
        hist = []; moveLog = []; lastMove = null; lastCrown = null;
        selected = null; legalTargets = []; over = false; particles = [];
        var f = firstRedCell(); cursor = { r: f.r, c: f.c };
        syncModeUI();
        refresh();
        if (turn === 'black') scheduleAI(320);
        else setMsg(T('gs.checkers.yourTurn'), 'var(--text-dim)');
        return true;
      }
    });
  }

  window.GAME_RESTART = function () {
    closePicker();
    closeDrawOffer();
    if (mode === MODE_PUZZLE) loadPuzzle(puzzleIdx);
    else newGame();
  };

  /* ---------------- 启动 ---------------- */
  (function boot() {
    var resumed = false;
    if (window.Arcade && Arcade.savegame) resumed = Arcade.savegame.resume();
    if (!resumed) {
      mode = MODE_AI8; N = 8; INTL = false;
      difficulty = 'normal';
      newGame();
    }
    syncModeUI();
    layoutCanvas();
    requestAnimationFrame(loop);
    window.addEventListener('resize', function () { layoutCanvas(); drawBoard(); });
  })();
})();
