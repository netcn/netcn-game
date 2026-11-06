/* 国际象棋 Chess vs AI —— 完整规则：易位、吃过路兵、升变四选、50 回合 / 三次重复 / 子力不足和棋；
   四档 AI（简单随机 / 中等 2 层 / 困难 4 层 / 大师 5 层，均含 alpha-beta + 静态搜索 + 时间预算）；
   双方计时器（3+2 / 5+3 / 10+5）；残局题库运行时校验必杀；键鼠 + 触控；结算覆盖层 + 最高分。 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.chess.tut1t'), d: T('gs.chess.tut1') },
  { t: T('gs.chess.tut2t'), d: T('gs.chess.tut2') },
  { t: T('gs.chess.tut3t'), d: T('gs.chess.tut3') },
  { t: T('gs.chess.tut4t'), d: T('gs.chess.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;
  var DIFFS = ['easy', 'normal', 'hard', 'master'];
  var difficulty = 'normal';
  var VAL = { K: 0, Q: 9, R: 5, B: 3.2, N: 3.1, P: 1 };
  var GLYPH = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };
  var TCS = [
    { id: '3+2', base: 180000, inc: 2000 },
    { id: '5+3', base: 300000, inc: 3000 },
    { id: '10+5', base: 600000, inc: 5000 }
  ];
  var tcIndex = 2;

  /* ---------------- 状态与走法 ---------------- */
  var S = null, sel = null, targets = [], over = false, capturedScore = 0;
  var hist = [], lastMove = null, cursor = { r: 6, c: 4 }, pendingMove = null;
  var puzzleMode = false, currentPuzzle = null, replayBase = null, replaying = false, replayTimer = null;
  var aiTimer = null, aiSeq = 0;
  var posHistory = [], clock = null, clockTimer = null;

  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function cloneState(s) {
    return {
      board: s.board.map(function (row) { return row.slice(); }),
      turn: s.turn,
      castling: { wk: s.castling.wk, wq: s.castling.wq, bk: s.castling.bk, bq: s.castling.bq },
      ep: s.ep ? [s.ep[0], s.ep[1]] : null,
      half: s.half
    };
  }
  function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function kingPos(s, color) {
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) if (s.board[r][c] === color + 'K') return { r: r, c: c };
    return null;
  }
  /* (r,c) 是否被 by 方攻击 */
  function attacked(s, r, c, by) {
    var b = s.board;
    var pr = by === 'w' ? r + 1 : r - 1;
    if (inB(pr, c - 1) && b[pr][c - 1] === by + 'P') return true;
    if (inB(pr, c + 1) && b[pr][c + 1] === by + 'P') return true;
    var kn = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
    for (var i = 0; i < 8; i++) {
      var nr = r + kn[i][0], nc = c + kn[i][1];
      if (inB(nr, nc) && b[nr][nc] === by + 'N') return true;
    }
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      var kr = r + dr, kc = c + dc;
      if (inB(kr, kc) && b[kr][kc] === by + 'K') return true;
    }
    var orth = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var j = 0; j < 4; j++) {
      var rr = r + orth[j][0], cc = c + orth[j][1];
      while (inB(rr, cc)) {
        var p = b[rr][cc];
        if (p) { if (p[0] === by && (p[1] === 'R' || p[1] === 'Q')) return true; break; }
        rr += orth[j][0]; cc += orth[j][1];
      }
    }
    var dia = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (var k = 0; k < 4; k++) {
      var r2 = r + dia[k][0], c2 = c + dia[k][1];
      while (inB(r2, c2)) {
        var p2 = b[r2][c2];
        if (p2) { if (p2[0] === by && (p2[1] === 'B' || p2[1] === 'Q')) return true; break; }
        r2 += dia[k][0]; c2 += dia[k][1];
      }
    }
    return false;
  }
  function inCheck(s, color) {
    var kp = kingPos(s, color);
    if (!kp) return false;
    return attacked(s, kp.r, kp.c, color === 'w' ? 'b' : 'w');
  }

  function genPseudo(s, r, c) {
    var out = [];
    var p = s.board[r][c];
    if (!p) return out;
    var color = p[0], type = p[1];
    function add(tr, tc, flag, extra) {
      if (!inB(tr, tc)) return;
      var tp = s.board[tr][tc];
      if (tp && tp[1] === 'K') return; // 不允许吃王
      if (tp && tp[0] === color) return;
      var m = { fr: r, fc: c, tr: tr, tc: tc, flag: flag || null };
      if (extra) for (var kk in extra) m[kk] = extra[kk];
      out.push(m);
    }
    if (type === 'P') {
      var f = color === 'w' ? -1 : 1;
      var one = r + f;
      var startRow = color === 'w' ? 6 : 1;
      var promoRow = color === 'w' ? 0 : 7;
      if (inB(one, c) && !s.board[one][c]) {
        add(one, c, one === promoRow ? 'promo' : null);
        if (r === startRow && !s.board[r + 2 * f][c]) add(r + 2 * f, c, null);
      }
      [[one, c - 1], [one, c + 1]].forEach(function (t) {
        if (!inB(t[0], t[1])) return;
        var tp = s.board[t[0]][t[1]];
        if (tp && tp[0] !== color) {
          add(t[0], t[1], t[0] === promoRow ? 'promo' : null);
        } else if (!tp && s.ep && s.ep[0] === t[0] && s.ep[1] === t[1]) {
          add(t[0], t[1], 'ep', { capR: r, capC: t[1] });
        }
      });
    } else if (type === 'N') {
      var kn = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
      for (var i = 0; i < 8; i++) add(r + kn[i][0], c + kn[i][1]);
    } else if (type === 'K') {
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        add(r + dr, c + dc);
      }
      // 易位：王未动、车未动、中间无子、王不过被攻击格
      var home = color === 'w' ? 7 : 0;
      var opp = color === 'w' ? 'b' : 'w';
      if (r === home && c === 4) {
        var rkSide = color === 'w' ? s.castling.wk : s.castling.bk;
        var rqSide = color === 'w' ? s.castling.wq : s.castling.bq;
        if (rkSide && s.board[home][7] === color + 'R' && !s.board[home][5] && !s.board[home][6]
          && !inCheck(s, color) && !attacked(s, home, 5, opp) && !attacked(s, home, 6, opp)) {
          add(home, 6, 'k', { rook: { fr: home, fc: 7, tr: home, tc: 5 } });
        }
        if (rqSide && s.board[home][0] === color + 'R' && !s.board[home][1] && !s.board[home][2] && !s.board[home][3]
          && !inCheck(s, color) && !attacked(s, home, 3, opp) && !attacked(s, home, 2, opp)) {
          add(home, 2, 'q', { rook: { fr: home, fc: 0, tr: home, tc: 3 } });
        }
      }
    } else {
      var dirs;
      if (type === 'R') dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      else if (type === 'B') dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      else dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (var d = 0; d < dirs.length; d++) {
        var rr = r + dirs[d][0], cc = c + dirs[d][1];
        while (inB(rr, cc)) {
          var tp2 = s.board[rr][cc];
          if (!tp2) add(rr, cc);
          else { if (tp2[0] !== color && tp2[1] !== 'K') add(rr, cc); break; }
          rr += dirs[d][0]; cc += dirs[d][1];
        }
      }
    }
    return out;
  }

  function applyMove(s, m, promo) {
    var n = cloneState(s);
    n.turn = s.turn === 'w' ? 'b' : 'w';
    var piece = n.board[m.fr][m.fc];
    var cap = m.flag === 'ep' ? n.board[m.capR][m.capC] : n.board[m.tr][m.tc];
    n.captured = cap || null;
    n.board[m.fr][m.fc] = null;
    if (m.flag === 'ep') n.board[m.capR][m.capC] = null;
    n.board[m.tr][m.tc] = (m.flag === 'promo') ? piece[0] + (promo || 'Q') : piece;
    if (m.rook) {
      n.board[m.rook.fr][m.rook.fc] = null;
      n.board[m.rook.tr][m.rook.tc] = piece[0] + 'R';
    }
    // 易位权
    if (piece[1] === 'K') {
      if (piece[0] === 'w') { n.castling.wk = false; n.castling.wq = false; }
      else { n.castling.bk = false; n.castling.bq = false; }
    }
    if (piece[1] === 'R') {
      if (piece[0] === 'w' && m.fr === 7) { if (m.fc === 0) n.castling.wq = false; if (m.fc === 7) n.castling.wk = false; }
      if (piece[0] === 'b' && m.fr === 0) { if (m.fc === 0) n.castling.bq = false; if (m.fc === 7) n.castling.bk = false; }
    }
    if (cap && cap[1] === 'R') {
      var home = cap[0] === 'w' ? 7 : 0;
      if (m.tr === home && m.tc === 0) { if (cap[0] === 'w') n.castling.wq = false; else n.castling.bq = false; }
      if (m.tr === home && m.tc === 7) { if (cap[0] === 'w') n.castling.wk = false; else n.castling.bk = false; }
    }
    // 吃过路兵目标格
    n.ep = null;
    if (piece[1] === 'P' && Math.abs(m.tr - m.fr) === 2) n.ep = [(m.fr + m.tr) / 2, m.fc];
    n.half = (cap || piece[1] === 'P') ? 0 : s.half + 1;
    return n;
  }

  /* 搜索专用增量走子：原地 make / unmake，避免每节点深拷贝棋盘（与 applyMove 语义一致） */
  function makeMove(s, m, promo) {
    var piece = s.board[m.fr][m.fc];
    var cap = m.flag === 'ep' ? s.board[m.capR][m.capC] : s.board[m.tr][m.tc];
    var u = {
      cap: cap || null,
      ep: s.ep, half: s.half, turn: s.turn, captured: s.captured,
      cwk: s.castling.wk, cwq: s.castling.wq, cbk: s.castling.bk, cbq: s.castling.bq
    };
    s.captured = cap || null;
    s.turn = s.turn === 'w' ? 'b' : 'w';
    s.board[m.fr][m.fc] = null;
    if (m.flag === 'ep') s.board[m.capR][m.capC] = null;
    s.board[m.tr][m.tc] = (m.flag === 'promo') ? piece[0] + (promo || 'Q') : piece;
    if (m.rook) {
      var rp = s.board[m.rook.fr][m.rook.fc];
      s.board[m.rook.fr][m.rook.fc] = null;
      s.board[m.rook.tr][m.rook.tc] = rp;
    }
    if (piece[1] === 'K') {
      if (piece[0] === 'w') { s.castling.wk = false; s.castling.wq = false; }
      else { s.castling.bk = false; s.castling.bq = false; }
    }
    if (piece[1] === 'R') {
      if (piece[0] === 'w' && m.fr === 7) { if (m.fc === 0) s.castling.wq = false; if (m.fc === 7) s.castling.wk = false; }
      if (piece[0] === 'b' && m.fr === 0) { if (m.fc === 0) s.castling.bq = false; if (m.fc === 7) s.castling.bk = false; }
    }
    if (cap && cap[1] === 'R') {
      var home = cap[0] === 'w' ? 7 : 0;
      if (m.tr === home && m.tc === 0) { if (cap[0] === 'w') s.castling.wq = false; else s.castling.bq = false; }
      if (m.tr === home && m.tc === 7) { if (cap[0] === 'w') s.castling.wk = false; else s.castling.bk = false; }
    }
    s.ep = null;
    if (piece[1] === 'P' && Math.abs(m.tr - m.fr) === 2) s.ep = [(m.fr + m.tr) / 2, m.fc];
    s.half = (cap || piece[1] === 'P') ? 0 : s.half + 1;
    return u;
  }
  function unmakeMove(s, m, u) {
    var piece = s.board[m.tr][m.tc];
    if (m.flag === 'promo') piece = piece[0] + 'P';
    s.board[m.fr][m.fc] = piece;
    s.board[m.tr][m.tc] = null;
    if (m.flag === 'ep') s.board[m.capR][m.capC] = u.cap;
    else s.board[m.tr][m.tc] = u.cap;
    if (m.rook) {
      s.board[m.rook.tr][m.rook.tc] = null;
      s.board[m.rook.fr][m.rook.fc] = piece[0] + 'R';
    }
    s.castling.wk = u.cwk; s.castling.wq = u.cwq;
    s.castling.bk = u.cbk; s.castling.bq = u.cbq;
    s.ep = u.ep; s.half = u.half; s.turn = u.turn; s.captured = u.captured;
  }

  function legalFor(s, color) {
    var out = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = s.board[r][c];
        if (!p || p[0] !== color) continue;
        var pm = genPseudo(s, r, c);
        for (var i = 0; i < pm.length; i++) {
          var m = pm[i];
          var u = makeMove(s, m, 'Q');
          var ok = !inCheck(s, color);
          unmakeMove(s, m, u);
          if (ok) out.push(m);
        }
      }
    }
    return out;
  }
  function movesFrom(r, c) {
    var out = [], pm = genPseudo(S, r, c);
    for (var i = 0; i < pm.length; i++) {
      var n = applyMove(S, pm[i], 'Q');
      if (!inCheck(n, S.turn)) out.push(pm[i]);
    }
    return out;
  }

  /* ---------------- 和棋判定 ---------------- */
  function positionKey(s) {
    var b = '';
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) b += (s.board[r][c] || '..');
    return b + '|' + s.turn + '|' + (s.castling.wk ? 1 : 0) + (s.castling.wq ? 1 : 0) +
      (s.castling.bk ? 1 : 0) + (s.castling.bq ? 1 : 0) + '|' + (s.ep ? s.ep[0] + ',' + s.ep[1] : '-');
  }
  function rebuildPosHistory(base, list) {
    var st = cloneState(base), keys = [positionKey(st)];
    for (var i = 0; i < list.length; i++) {
      st = applyMove(st, list[i].move, list[i].promo);
      keys.push(positionKey(st));
    }
    posHistory = keys;
  }
  function repetitionCount(key) {
    var n = 0;
    for (var i = 0; i < posHistory.length; i++) if (posHistory[i] === key) n++;
    return n;
  }
  /* 子力不足：仅王；王+单象/单马；双方仅象且同色格 */
  function insufficientMaterial(s) {
    var minors = 0, knights = 0, bishopColor = -1, sameColor = true, otherPiece = false;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = s.board[r][c];
      if (!p || p[1] === 'K') continue;
      if (p[1] === 'B') {
        minors++;
        var col = (r + c) % 2;
        if (bishopColor < 0) bishopColor = col;
        else if (col !== bishopColor) sameColor = false;
      } else if (p[1] === 'N') {
        minors++; knights++;
      } else {
        otherPiece = true;
      }
    }
    if (otherPiece) return false;
    if (minors === 0) return true;               // K vs K
    if (minors === 1 && knights <= 1) return true; // K+B vs K / K+N vs K
    if (knights === 0 && sameColor) return true;  // 双方仅象且全在同色格
    return false;
  }

  /* ---------------- 评估与搜索 ---------------- */
  function evalState(s) { // 白方视角（正值利于白）
    var v = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = s.board[r][c];
        if (!p) continue;
        var base = VAL[p[1]] || 0;
        if (p[1] === 'N' || p[1] === 'B') {
          var cd = Math.abs(r - 3.5) + Math.abs(c - 3.5);
          base += (7 - cd) * 0.04;
        }
        if (p[1] === 'P') base += (p[0] === 'w' ? (6 - r) : (r - 1)) * 0.05;
        if (p[1] === 'K') base += 0;
        v += p[0] === 'w' ? base : -base;
      }
    }
    return v;
  }
  function evalFor(s, color) { return color === 'w' ? evalState(s) : -evalState(s); }

  function moveScore(st, m) {
    var cap = st.board[m.tr][m.tc];
    if (m.flag === 'ep') cap = 'xP';
    var atk = st.board[m.fr][m.fc];
    var sc = 0;
    if (cap) sc = 10 * (VAL[cap[1]] || 0) - (atk ? (VAL[atk[1]] || 0) : 0) + 4; // MVV-LVA
    if (m.flag === 'promo') sc += 80;
    if (m.flag === 'k' || m.flag === 'q') sc += 6;
    return sc;
  }

  var ABORT = { abort: true };
  var searchNodes = 0, searchDeadline = 0, searchQd = 1;
  var lastSearchNodes = 0, lastSearchDepth = 0;
  var TT = null, killers = null, histTable = null;

  /* 静态搜索只需吃子/升变着法，跳过大量安静着法的合法性克隆 */
  function capturesFor(st, color) {
    var out = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = st.board[r][c];
        if (!p || p[0] !== color) continue;
        var pm = genPseudo(st, r, c);
        for (var i = 0; i < pm.length; i++) {
          var m = pm[i];
          if (!(st.board[m.tr][m.tc] || m.flag === 'ep' || m.flag === 'promo')) continue;
          var u = makeMove(st, m, 'Q');
          var ok = !inCheck(st, color);
          unmakeMove(st, m, u);
          if (ok) out.push(m);
        }
      }
    }
    return out;
  }

  function quiesce(st, alpha, beta, color, qd) {
    searchNodes++;
    if ((searchNodes & 511) === 0 && Date.now() > searchDeadline) throw ABORT;
    if (searchNodes > 900000) throw ABORT;
    var stand = evalFor(st, color);
    if (qd <= 0) return stand;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    var caps = capturesFor(st, color);
    caps.sort(function (a, b) { return moveScore(st, b) - moveScore(st, a); });
    for (var j = 0; j < caps.length; j++) {
      // 静态搜索增量裁剪：吃子后最好情况仍远低于 alpha，直接跳过
      if (caps[j].flag !== 'promo') {
        var cv = caps[j].flag === 'ep' ? 1 : (st.board[caps[j].tr][caps[j].tc] ? (VAL[st.board[caps[j].tr][caps[j].tc][1]] || 0) : 0);
        if (stand + cv + 1.5 < alpha) continue;
      }
      var u = makeMove(st, caps[j], 'Q');
      try {
        var v = -quiesce(st, -beta, -alpha, other(color), qd - 1);
        if (v >= beta) return beta;
        if (v > alpha) alpha = v;
      } finally {
        unmakeMove(st, caps[j], u);
      }
    }
    return alpha;
  }

  function sameMove(a, b) {
    return !!a && !!b && a.fr === b.fr && a.fc === b.fc && a.tr === b.tr && a.tc === b.tc;
  }

  function negamax(st, depth, alpha, beta, color, ply) {
    searchNodes++;
    if ((searchNodes & 511) === 0 && Date.now() > searchDeadline) throw ABORT;
    if (searchNodes > 900000) throw ABORT;
    if (st.half >= 100) return 0;
    if (insufficientMaterial(st)) return 0;
    var key = null, tb = null, ent = null;
    // 置换表探查提前到着法生成之前，命中即省掉整棵合法着法生成
    if (TT && depth >= 2) {
      key = positionKey(st);
      ent = TT.get(key);
      if (ent) {
        tb = ent.move;
        if (ent.depth >= depth) {
          if (ent.flag === 0) return ent.value;
          if (ent.flag === 1 && ent.value <= alpha) return ent.value;
          if (ent.flag === 2 && ent.value >= beta) return ent.value;
        }
      }
    }
    if (depth <= 0) {
      // 叶子层只在被将军时才需要生成全部合法着法（检测将杀）
      if (inCheck(st, color) && !legalFor(st, color).length) return -99000 + ply;
      return quiesce(st, alpha, beta, color, searchQd);
    }
    var ms = legalFor(st, color);
    if (!ms.length) return inCheck(st, color) ? (-99000 + ply) : 0;
    var alpha0 = alpha;
    var km = killers && killers[ply] ? killers[ply] : null;
    ms.sort(function (a, b) {
      var sa = moveScore(st, a), sb = moveScore(st, b);
      if (sameMove(a, tb)) sa += 100000;
      if (sameMove(b, tb)) sb += 100000;
      if (km) {
        if (sameMove(a, km[0])) sa += 9000;
        if (sameMove(b, km[0])) sb += 9000;
        if (sameMove(a, km[1])) sa += 8000;
        if (sameMove(b, km[1])) sb += 8000;
      }
      // 历史启发：安静着法按全局截断次数排序
      if (histTable) {
        if (!st.board[a.tr][a.tc] && a.flag !== 'ep' && a.flag !== 'promo') sa += Math.min(histTable[a.fr * 64 + a.tc], 300);
        if (!st.board[b.tr][b.tc] && b.flag !== 'ep' && b.flag !== 'promo') sb += Math.min(histTable[b.fr * 64 + b.tc], 300);
      }
      return sb - sa;
    });
    var best = -1e9, bestM = null;
    for (var i = 0; i < ms.length; i++) {
      var u = makeMove(st, ms[i], 'Q');
      try {
        var v = -negamax(st, depth - 1, -beta, -alpha, other(color), ply + 1);
      } finally {
        unmakeMove(st, ms[i], u);
      }
      if (v > best) { best = v; bestM = ms[i]; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (killers) {
          if (km !== null) {
            if (!sameMove(ms[i], killers[ply][0])) killers[ply] = [ms[i], killers[ply][0]];
          } else killers[ply] = [ms[i], null];
        }
        if (histTable && !st.board[ms[i].tr][ms[i].tc] && ms[i].flag !== 'ep' && ms[i].flag !== 'promo') {
          var hi = ms[i].fr * 64 + ms[i].tc;
          histTable[hi] += depth * depth;
        }
        break;
      }
    }
    if (TT && key) {
      if (TT.size > 250000) TT.clear();
      var flag = best <= alpha0 ? 1 : (best >= beta ? 2 : 0);
      TT.set(key, { depth: depth, value: best, flag: flag, move: bestM });
    }
    return best;
  }

  function aiChoose() {
    var ms = legalFor(S, 'b');
    if (!ms.length) return null;
    var bookM = bookMoveFor(S);
    if (bookM) { lastSearchNodes = 0; lastSearchDepth = 0; return bookM; }
    if (difficulty === 'easy') {
      lastSearchNodes = 0; lastSearchDepth = 0;
      var caps = ms.filter(function (m) { return S.board[m.tr][m.tc] || m.flag === 'ep'; });
      var pool = caps.length && Math.random() < 0.7 ? caps : ms;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    var maxDepth = difficulty === 'normal' ? 2 : difficulty === 'hard' ? 4 : 5;
    var budget = difficulty === 'normal' ? 260 : difficulty === 'hard' ? 1500 : 3000;
    searchQd = difficulty === 'master' ? 2 : 1;
    searchNodes = 0; lastSearchDepth = 0;
    TT = new Map(); killers = []; histTable = new Int32Array(4096);
    searchDeadline = Date.now() + budget;
    var ordered = ms.slice().sort(function (a, b) { return moveScore(S, b) - moveScore(S, a); });
    var bestM = ordered[0];
    try {
      for (var d = 1; d <= maxDepth; d++) {
        var localBest = ordered[0], localV = -1e9, scored = [];
        var alpha = -1e9;
        for (var i = 0; i < ordered.length; i++) {
          var u = makeMove(S, ordered[i], 'Q');
          var v;
          try {
            if (i === 0) {
              v = -negamax(S, d - 1, -1e9, 1e9, 'w', 1);
            } else {
              // 根节点 PVS：先用零窗口试探，仅在 fail-high 时全窗口重搜
              v = -negamax(S, d - 1, -(alpha + 1), -alpha, 'w', 1);
              if (v > alpha) v = -negamax(S, d - 1, -1e9, -alpha, 'w', 1);
            }
          } finally {
            unmakeMove(S, ordered[i], u);
          }
          scored.push([v, ordered[i]]);
          if (v > localV) { localV = v; localBest = ordered[i]; }
          if (v > alpha) alpha = v;
        }
        scored.sort(function (a, b) { return b[0] - a[0]; });
        ordered = scored.map(function (x) { return x[1]; });
        bestM = localBest;
        lastSearchDepth = d;
        if (Math.abs(localV) > 90000) break; // 已找到必杀/必败，提前收敛
      }
    } catch (e) {
      if (e !== ABORT) throw e;
    }
    lastSearchNodes = searchNodes;
    return bestM;
  }

  /* ---------------- 残局题库与校验 ---------------- */
  function parsePuzzle(rows) {
    var b = [];
    for (var r = 0; r < 8; r++) {
      b[r] = [];
      for (var c = 0; c < 8; c++) {
        var ch = rows[r][c];
        b[r][c] = ch === '.' ? null : (ch === ch.toUpperCase() ? 'w' + ch : 'b' + ch.toUpperCase());
      }
    }
    return { board: b, turn: 'w', castling: { wk: false, wq: false, bk: false, bq: false }, ep: null, half: 0 };
  }
  function puzzlePositionLegal(st) {
    var wk = kingPos(st, 'w'), bk = kingPos(st, 'b');
    if (!wk || !bk) return false;
    if (Math.abs(wk.r - bk.r) <= 1 && Math.abs(wk.c - bk.c) <= 1) return false;
    if (inCheck(st, 'b')) return false; // 白先手，黑方不应已被将军
    return true;
  }
  /* 找到白方在 moves 步内的必杀着法（对手所有应手都要被将死） */
  function findMateMove(st, color, moves) {
    var mine = legalFor(st, color);
    if (!mine.length) return null;
    for (var i = 0; i < mine.length; i++) {
      var m = mine[i];
      var n = applyMove(st, m, 'Q');
      var om = legalFor(n, other(color));
      if (!om.length) {
        if (inCheck(n, other(color))) return m;
        continue;
      }
      if (moves <= 1) continue;
      var ok = true;
      for (var j = 0; j < om.length; j++) {
        var n2 = applyMove(n, om[j], 'Q');
        if (!findMateMove(n2, color, moves - 1)) { ok = false; break; }
      }
      if (ok) return m;
    }
    return null;
  }

  var PUZZLES = [
    { nKey: 'gs.chess.pz0n', dKey: 'gs.chess.pz0d', mateIn: 1, rows: ['......k.', '.....ppp', '........', '........', '........', '........', '........', 'K..Q....'] },
    { nKey: 'gs.chess.pz1n', dKey: 'gs.chess.pz1d', mateIn: 1, rows: ['k.......', '.R......', '.K......', '........', '........', '........', '........', '.......R'] },
    { nKey: 'gs.chess.pz2n', dKey: 'gs.chess.pz2d', mateIn: 1, rows: ['.......k', '.....K..', '......Q.', '........', '........', '........', '........', '........'] },
    { nKey: 'gs.chess.pz3n', dKey: 'gs.chess.pz3d', mateIn: 1, rows: ['k.......', '....Q...', '.K......', '........', '........', '........', '........', '........'] },
    { nKey: 'gs.chess.pz4n', dKey: 'gs.chess.pz4d', mateIn: 1, rows: ['......rk', '......pp', '........', '......N.', '........', '........', '........', '.K......'] },
    { nKey: 'gs.chess.pz5n', dKey: 'gs.chess.pz5d', mateIn: 1, rows: ['......kr', '......pp', '........', '.......Q', '........', '........', '........', 'K....R..'] },
    { nKey: 'gs.chess.pz6n', dKey: 'gs.chess.pz6d', mateIn: 1, rows: ['k.......', '........', '.K......', '........', '.......Q', '........', '........', '........'] },
    { nKey: 'gs.chess.pz7n', dKey: 'gs.chess.pz7d', mateIn: 1, rows: ['......rk', '......pp', '.......N', '........', '........', '........', '........', '.K......'] }
  ];
  var VALID_PUZZLES = [];
  PUZZLES.forEach(function (pz) {
    pz.start = parsePuzzle(pz.rows);
    pz.solution = null;
    if (puzzlePositionLegal(pz.start)) pz.solution = findMateMove(pz.start, 'w', pz.mateIn);
    if (pz.solution) VALID_PUZZLES.push(pz);
  });

  /* ---------------- 时钟 ---------------- */
  function tc() { return TCS[tcIndex]; }
  function fmtClock(ms) {
    ms = Math.max(0, ms);
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60), s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function updateClocks() {
    if (!clkWEl) return;
    var show = !puzzleMode && !!clock && !over;
    clocksEl.style.display = show ? '' : 'none';
    if (!clock) return;
    clkWEl.textContent = fmtClock(clock.w);
    clkBEl.textContent = fmtClock(clock.b);
    clkWBox.classList.toggle('active', show && S && S.turn === 'w');
    clkBBox.classList.toggle('active', show && S && S.turn === 'b');
    clkWEl.classList.toggle('low', clock.w <= 60000);
    clkBEl.classList.toggle('low', clock.b <= 60000);
  }
  function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    if (clock) clock.running = false;
  }
  function startClock(saved) {
    stopClock();
    if (puzzleMode || over) { clock = null; updateClocks(); return; }
    var t = tc();
    clock = {
      w: saved && typeof saved.w === 'number' ? Math.max(0, saved.w) : t.base,
      b: saved && typeof saved.b === 'number' ? Math.max(0, saved.b) : t.base,
      inc: t.inc, running: true, last: Date.now()
    };
    clockTimer = setInterval(tickClock, 250);
    updateClocks();
  }
  function tickClock() {
    if (!clock || !clock.running || over || !S) return;
    var now = Date.now(), dt = now - clock.last;
    clock.last = now;
    if (replaying || pendingMove) return; // 回放/等待升变时暂停
    if (S.turn === 'w') clock.w -= dt; else clock.b -= dt;
    if (clock.w <= 0) { clock.w = 0; clock.running = false; updateClocks(); finish('lose', 'time'); return; }
    if (clock.b <= 0) { clock.b = 0; clock.running = false; updateClocks(); finish('win', 'time'); return; }
    updateClocks();
  }

  /* ---------------- 对局流程 ---------------- */
  function initialState() {
    var b = [];
    var back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (var r = 0; r < 8; r++) { b[r] = []; for (var c = 0; c < 8; c++) b[r][c] = null; }
    for (var i = 0; i < 8; i++) { b[0][i] = 'b' + back[i]; b[1][i] = 'bP'; b[6][i] = 'wP'; b[7][i] = 'w' + back[i]; }
    return { board: b, turn: 'w', castling: { wk: true, wq: true, bk: true, bq: true }, ep: null, half: 0 };
  }

  /* ---------------- 开局库（标准对局开局阶段秒走，残局模式不查库） ---------------- */
  var BOOK_LINES = [
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4'],
    ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'd7d6', 'e5f3', 'f6e4'],
    ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6'],
    ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'e4e5', 'f6d7'],
    ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'e4e5', 'f6d7'],
    ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7'],
    ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'e7e6'],
    ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6'],
    ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'e8g8'],
    ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3', 'd7d5', 'c4d5', 'f6d5'],
    ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'g7g6', 'e1g1', 'f8g7'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'g8f6'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1', 'f6e4'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5'],
    ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5', 'd2d4', 'g8f6'],
    ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f1c4', 'f8c5', 'd2d3', 'd7d6'],
    ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'h2h4', 'g5g4'],
    ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8e7'],
    ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'b8d7'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3', 'g8f6', 'e1g1', 'e8g8'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5', 'e4d5', 'c6a5'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'b7b5'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'g8f6', 'd4c6', 'b7c6', 'e4e5', 'd8e7'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'f8c5'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6', 'f1b5', 'f8b4'],
    ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f2f4', 'd7d5', 'f4e5', 'f6e4'],
    ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'g7g5', 'h2h4', 'g5g4', 'f3e5', 'd7d6'],
    ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5'],
    ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5', 'c8f5'],
    ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4d5', 'c6d5', 'c1d2', 'b8c6'],
    ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'f8b4', 'e4e5', 'c7c5'],
    ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'e4e5', 'f6d7', 'f1d3', 'c7c5'],
    ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'e4e5', 'c7c5', 'c2c3', 'b8c6'],
    ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6', 'c1e3', 'e7e5'],
    ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6', 'c1e3', 'f8g7', 'f2f3', 'e8g8'],
    ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'b8c6', 'f1e2', 'e7e5'],
    ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'd7d6', 'f1e2', 'f8e7'],
    ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'e7e5', 'd4b5', 'd7d6'],
    ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'f1b5', 'g7g6', 'e1g1', 'f8g7', 'c2c3', 'g8f6'],
    ['e2e4', 'c7c5', 'c2c3', 'd7d5', 'e4d5', 'd8d5', 'd2d4', 'g8f6'],
    ['e2e4', 'c7c5', 'b1c3', 'b8c6', 'g2g3', 'g7g6', 'f1g2', 'f8g7'],
    ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5', 'd2d4', 'g8f6'],
    ['e2e4', 'd7d5', 'e4d5', 'g8f6', 'd2d4', 'f6d5', 'g1f3', 'g7g6'],
    ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6', 'g1f3', 'd5b6'],
    ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6', 'f2f4', 'f8g7'],
    ['e2e4', 'g7g6', 'd2d4', 'f8g7', 'b1c3', 'd7d6', 'f2f4', 'g8f6'],
    ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c4d5', 'e6d5', 'c1g5', 'f8e7'],
    ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3', 'g8f6', 'e2e3', 'e7e6', 'f1c4', 'c7c5'],
    ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'd5c4', 'a2a4', 'c8f5'],
    ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'g1f3', 'c7c6', 'e2e3', 'b8d7', 'f1d3', 'd5c4'],
    ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'e8g8', 'f1d3', 'd7d5'],
    ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b5', 'g2g3', 'c8b7', 'f1g2', 'f8e7'],
    ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'g1f3', 'e8g8'],
    ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'f2f3', 'e8g8', 'c1e3', 'e7e5'],
    ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c4d5', 'f6d5', 'e2e4', 'd5c3', 'b2c3', 'f8g7'],
    ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3', 'd7d5', 'f1g2', 'f8e7', 'g1f3', 'e8g8'],
    ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6', 'b1c3', 'e6d5', 'c4d5', 'd7d6'],
    ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'b7b5', 'c4b5', 'a7a6'],
    ['c2c4', 'c7c5', 'b1c3', 'b8c6', 'g2g3', 'g7g6', 'f1g2', 'f8g7', 'g1f3', 'g8f6'],
    ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g1f3', 'b8c6', 'g2g3', 'f8b4'],
    ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3', 'd7d5', 'c4d5', 'f6d5'],
    ['g1f3', 'd7d5', 'c2c4', 'e7e6', 'g2g3', 'g8f6', 'f1g2', 'f8e7'],
    ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'g7g6', 'e1g1', 'f8g7'],
    ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4', 'e7e6', 'e2e3', 'f8e7'],
    ['d2d4', 'g8f6', 'c1g5', 'e7e6', 'e2e3', 'c7c5', 'g1f3', 'b7b5'],
    ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'e2e3', 'e7e6', 'f1d3', 'c7c5'],
    ['d2d4', 'f7f5', 'c2c4', 'g8f6', 'g2g3', 'e7e6', 'f1g2', 'f8e7'],
    ['d2d4', 'g8f6', 'c2c4', 'e7e5', 'd4e5', 'f6g4'],
    ['f2f4', 'd7d5', 'g1f3', 'g8f6', 'e2e3', 'c7c5'],
    ['f2f4', 'd7d5', 'g1f3', 'g8f6', 'b2b3', 'g7g6', 'c1b2', 'f8g7'],
    ['f2f4', 'e7e5', 'f4e5', 'd7d6', 'e5d6', 'f8d6', 'g1f3', 'g8f6'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1', 'f6e4', 'd2d4', 'e4d6', 'b5c6', 'd7c6'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3', 'd7d6', 'e1g1', 'e8g8'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4', 'f8c5', 'c1e3', 'd8f6'],
    ['e2e4', 'e7e5', 'b1c3', 'b8c6', 'f1c4', 'f8c5', 'd2d3', 'd7d6'],
    ['e2e4', 'e7e5', 'f2f4', 'e5f4', 'g1f3', 'd7d5', 'e4d5', 'g8f6'],
    ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'f1e2', 'e7e5'],
    ['e2e4', 'c7c5', 'g1f3', 'e7e6', 'd2d4', 'c5d4', 'f3d4', 'a7a6', 'f1e2', 'g8f6'],
    ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g7g6', 'c2c4', 'f8g7'],
    ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5', 'e4g3', 'f5g6'],
    ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1d2', 'd5e4', 'd2e4', 'b8d7'],
    ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5', 'f8e7', 'e4e5', 'f6d7'],
    ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'b8d7'],
    ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5', 'd2d4', 'g8f6', 'g1f3', 'c7c6'],
    ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6', 'g1f3', 'g7g6', 'f1c4', 'd5b6'],
    ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6', 'c1e3', 'f8g7'],
    ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6', 'f1e2', 'e8g8'],
    ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'd7d5', 'f1d3', 'e8g8'],
    ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5', 'c4d5', 'f6d5', 'e2e4', 'd5c3', 'b2c3', 'f8g7', 'f1c4', 'c7c5'],
    ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'e7e6', 'b1c3', 'e6d5', 'c4d5', 'd7d6', 'e2e4', 'g7g6'],
    ['d2d4', 'd7d5', 'c2c4', 'c7c6', 'g1f3', 'g8f6', 'b1c3', 'd5c4', 'a2a4', 'c8f5', 'e2e3', 'e7e6'],
    ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3', 'g8f6', 'e2e3', 'e7e6', 'f1c4', 'c7c5', 'e1g1', 'a7a6'],
    ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g1f3', 'b8c6', 'g2g3', 'f8b4', 'f1g2', 'e8g8'],
    ['c2c4', 'g7g6', 'b1c3', 'f8g7', 'g2g3', 'g8f6', 'f1g2', 'e8g8'],
    ['g1f3', 'g8f6', 'c2c4', 'e7e6', 'g2g3', 'd7d5', 'f1g2', 'f8e7', 'e1g1', 'e8g8'],
    ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'd7d6', 'e5f3', 'f6e4', 'd2d4', 'd6d5'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'd7d6', 'd2d4', 'c8d7'],
    ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6', 'e1g1', 'f7f6']
  ];
  var BOOK = null;
  function sqName(r, c) { return 'abcdefgh'.charAt(c) + (8 - r); }
  function uciOf(m) { return sqName(m.fr, m.fc) + sqName(m.tr, m.tc); }
  function uciPretty(m) { return sqName(m.fr, m.fc) + '–' + sqName(m.tr, m.tc); }
  function buildBook() {
    if (BOOK) return BOOK;
    var map = {};
    BOOK_LINES.forEach(function (line) {
      var st = initialState();
      for (var i = 0; i < line.length; i++) {
        var ms = legalFor(st, st.turn), mv = null;
        for (var j = 0; j < ms.length; j++) {
          if (uciOf(ms[j]) === line[i]) { mv = ms[j]; break; }
        }
        if (!mv) break; // 非法着法直接截断该线
        var key = positionKey(st);
        if (!map[key]) map[key] = [];
        if (map[key].indexOf(line[i]) < 0) map[key].push(line[i]);
        st = applyMove(st, mv, 'Q');
      }
    });
    BOOK = map;
    return BOOK;
  }
  function bookMoveFor(st) {
    if (puzzleMode || !st || st.turn !== 'b') return null; // 残局模式/非 AI 回合不查库
    var ucis = buildBook()[positionKey(st)];
    if (!ucis || !ucis.length) return null;
    var ms = legalFor(st, st.turn);
    // 按主线登记顺序取着，保证同一局面始终沿用最早录入的主线
    for (var i = 0; i < ucis.length; i++) {
      for (var j = 0; j < ms.length; j++) {
        if (uciOf(ms[j]) === ucis[i]) return ms[j];
      }
    }
    return null;
  }

  function newGame() {
    cancelAI();
    clearSave();
    stopClock();
    S = initialState();
    replayBase = cloneState(S);
    hist = []; sel = null; targets = []; over = false; capturedScore = 0;
    lastMove = null; puzzleMode = false; currentPuzzle = null; pendingMove = null;
    posHistory = [positionKey(S)];
    hideOverlay(); hidePromo();
    cursor = { r: 6, c: 4 };
    render(); updateHud();
    startClock();
    syncModeBtns();
    msg.textContent = T('gs.chess.msgStart');
    msg.style.color = '';
  }
  function loadPuzzle(pz) {
    if (!pz) return;
    cancelAI();
    clearSave();
    stopClock();
    clock = null;
    puzzleMode = true; currentPuzzle = pz;
    S = parsePuzzle(pz.rows);
    replayBase = cloneState(S);
    hist = []; sel = null; targets = []; over = false; capturedScore = 0;
    lastMove = null; pendingMove = null; cursor = { r: 6, c: 4 };
    posHistory = [positionKey(S)];
    hideOverlay(); hidePromo();
    render(); updateHud(); updateClocks();
    msg.textContent = T('gs.chess.puzzleMsg').replace('{n}', T(pz.nKey)).replace('{d}', T(pz.dKey));
    msg.style.color = 'var(--neon-yellow)';
    syncPuzzleBtns();
  }

  function scoreNow() {
    if (!puzzleMode) return Math.floor(capturedScore);
    return Math.max(10, 100 - Math.floor(hist.length / 2) * 2) + Math.floor(capturedScore);
  }

  function playMove(m, promo) {
    var mover = S.turn;
    hist.push({ state: cloneState(S), move: m, promo: promo || 'Q' });
    var cap = (m.flag === 'ep') ? (S.turn === 'w' ? 'bP' : 'wP') : S.board[m.tr][m.tc];
    if (cap && S.turn === 'w') capturedScore += (VAL[cap[1]] || 1);
    S = applyMove(S, m, promo);
    posHistory.push(positionKey(S));
    if (clock && !puzzleMode) { clock[mover] += clock.inc; clock.last = Date.now(); }
    lastMove = m;
    sel = null; targets = [];
    if (Arcade.audio) {
      if (m.flag === 'promo') Arcade.audio.play('coin');
      else if (m.flag === 'k' || m.flag === 'q') Arcade.audio.play('drop');
      else if (cap) Arcade.audio.play('match');
      else Arcade.audio.play('move');
    }
    render(); updateHud(); updateClocks();
  }

  function scheduleAI() {
    if (over) return;
    var seq = ++aiSeq;
    var bookM = bookMoveFor(S);
    if (bookM) {
      msg.textContent = T('gs.chess.bookThink');
      msg.style.color = 'var(--neon-cyan)';
    } else {
      msg.textContent = T('gs.chess.aiThink');
      msg.style.color = 'var(--text-dim)';
    }
    aiTimer = setTimeout(function () {
      if (seq !== aiSeq || over || S.turn !== 'b' || replaying) return;
      var m = bookM || aiChoose();
      if (!m) { gameEnd(false); return; }
      playMove(m, 'Q');
      if (!gameEnd(false)) {
        if (bookM) {
          msg.textContent = T('gs.chess.bookPlay').replace('{m}', uciPretty(m));
          msg.style.color = 'var(--neon-cyan)';
        } else {
          msg.textContent = T('gs.chess.msgYourTurn');
          msg.style.color = '';
        }
      }
      writeSave();
    }, bookM ? 60 : 360);
  }
  function cancelAI() { aiSeq++; if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } }

  function gameEnd(silent) {
    if (over) return true;
    var ms = legalFor(S, S.turn);
    if (!ms.length) {
      var mate = inCheck(S, S.turn);
      finish(mate ? (S.turn === 'w' ? 'lose' : 'win') : 'draw', mate ? null : 'stalemate');
      return true;
    }
    if (S.half >= 100) { finish('draw', 'fifty'); return true; }
    if (insufficientMaterial(S)) { finish('draw', 'material'); return true; }
    if (repetitionCount(positionKey(S)) >= 3) { finish('draw', 'repeat'); return true; }
    return false;
  }

  function diffName(d) {
    return T('gs.chess.d' + d.charAt(0).toUpperCase() + d.slice(1));
  }
  function bestKey() { return 'arcade.chess.best.' + difficulty; }
  function getBest() { try { return parseInt(localStorage.getItem(bestKey()) || '0', 10) || 0; } catch (e) { return 0; } }
  function setBest(v) { try { localStorage.setItem(bestKey(), String(v)); } catch (e) {} }

  function drawReasonText(reason) {
    if (reason === 'repeat') return T('gs.chess.drawRepeat');
    if (reason === 'material') return T('gs.chess.drawMaterial');
    if (reason === 'fifty') return T('gs.chess.drawFifty');
    if (reason === 'stalemate') return T('gs.chess.stalemate');
    if (reason === 'time') return T('gs.chess.timeout');
    return '';
  }

  function finish(kind, reason) {
    if (over) return;
    over = true;
    cancelAI();
    stopClock();
    sel = null; targets = []; pendingMove = null;
    clearSave();
    var sc = scoreNow();
    var ranked = kind === 'win' && !puzzleMode;
    if (ranked) sc += 10;
    render(); updateHud(); updateClocks();
    if (ranked && sc > 0 && Arcade.shell) Arcade.shell.submitScore(sc);
    var best = getBest();
    var isNew = ranked && sc > best;
    if (isNew) setBest(sc);

    if (kind === 'win') {
      ovIcon.textContent = '♚';
      ovTitle.textContent = reason === 'time' ? T('gs.chess.timeWinTitle') : T('gs.chess.winTitle');
      ovTitle.className = 'win';
      ovText.innerHTML = T('gs.chess.winSub').replace('{n}', sc);
      if (Arcade.audio) Arcade.audio.play('win');
      if (Arcade.juice) { Arcade.juice.win(); Arcade.fx.centerBurst('#ffe600', 32); }
    } else if (kind === 'lose') {
      ovIcon.textContent = '♟';
      ovTitle.textContent = reason === 'time' ? T('gs.chess.timeLoseTitle') : T('gs.chess.loseTitle');
      ovTitle.className = '';
      ovText.innerHTML = T('gs.chess.loseSub').replace('{n}', sc);
      if (Arcade.audio) Arcade.audio.play('lose');
      if (Arcade.juice) Arcade.juice.lose();
    } else {
      ovIcon.textContent = '½';
      ovTitle.textContent = T('gs.chess.drawTitle');
      ovTitle.className = '';
      ovText.innerHTML = T('gs.chess.drawSub').replace('{n}', sc);
      if (Arcade.audio) Arcade.audio.play('ui');
    }
    var note = drawReasonText(reason);
    if (note) ovText.innerHTML = '<div class="ch-ov-note">' + note + '</div>' + ovText.innerHTML;
    ovText.innerHTML += '<div class="ch-ov-line">' + T('gs.chess.scoreFmt').replace('{n}', sc) + '</div>';
    if (!puzzleMode) {
      ovText.innerHTML += '<div class="ch-ov-best' + (isNew ? ' new' : '') + '">' +
        (isNew ? T('gs.chess.newBest') : T('gs.chess.bestFmt').replace('{n}', best)) + '</div>';
    }
    ovBtn.textContent = T('gs.chess.playAgain');
    ovBtn.onclick = function () { overlayEl.classList.add('hidden'); over = false; if (puzzleMode && currentPuzzle) loadPuzzle(currentPuzzle); else newGame(); };
    var di = DIFFS.indexOf(difficulty);
    if (kind === 'win' && puzzleMode && currentPuzzle) {
      ovAlt.style.display = '';
      ovAlt.textContent = T('gs.chess.nextPuzzle');
      ovAlt.onclick = function () {
        overlayEl.classList.add('hidden');
        over = false;
        var ni = (PUZZLES.indexOf(currentPuzzle) + 1) % PUZZLES.length;
        loadPuzzle(PUZZLES[ni]);
      };
    } else if (kind === 'win' && !puzzleMode && di >= 0 && di < DIFFS.length - 1) {
      ovAlt.style.display = '';
      ovAlt.textContent = T('gs.chess.nextLevel');
      ovAlt.onclick = function () {
        overlayEl.classList.add('hidden');
        over = false;
        difficulty = DIFFS[di + 1];
        syncDiffBtns();
        newGame();
      };
    } else {
      ovAlt.style.display = 'none';
    }
    overlayEl.classList.remove('hidden');
    msg.textContent = kind === 'win' ? T('gs.chess.winMsg') : kind === 'lose' ? T('gs.chess.loseMsg') : T('gs.chess.drawMsg');
  }

  function captureOf(st, mv) {
    if (mv.flag === 'ep') return st.turn === 'w' ? 'bP' : 'wP';
    return st.board[mv.tr][mv.tc] || null;
  }
  /* 从初始局面重放，重建当前状态与俘获分 */
  function rebuild(base, list) {
    var st = cloneState(base), sc = 0;
    for (var i = 0; i < list.length; i++) {
      var cap = captureOf(st, list[i].move);
      if (cap && st.turn === 'w') sc += (VAL[cap[1]] || 1);
      st = applyMove(st, list[i].move, list[i].promo);
    }
    capturedScore = sc;
    return st;
  }
  function undoPair() {
    if (!hist.length) { msg.textContent = T('gs.chess.undoNone'); msg.style.color = 'var(--text-dim)'; return; }
    cancelAI();
    over = false;
    hideOverlay();
    // 回退到最近一次「白方待走」的状态
    var idx = 0;
    for (var i = hist.length - 1; i >= 0; i--) {
      if (hist[i].state.turn === 'w') { idx = i; break; }
    }
    hist = hist.slice(0, idx);
    S = rebuild(replayBase, hist);
    rebuildPosHistory(replayBase, hist);
    if (clock && !puzzleMode) clock.last = Date.now();
    lastMove = hist.length ? hist[hist.length - 1].move : null;
    sel = null; targets = [];
    render(); updateHud(); updateClocks();
    msg.textContent = T('gs.chess.msgUndone');
    msg.style.color = '';
    if (Arcade.audio) Arcade.audio.play('ui');
    writeSave();
  }

  /* ---------------- UI ---------------- */
  var wrap = document.createElement('div');
  wrap.className = 'ch-wrap';
  wrap.innerHTML =
    '<div class="mode-row" id="ch-mode">' +
    '  <button class="btn mode-btn selected" data-mode="std">' + T('gs.chess.modeStd') + '</button>' +
    '  <button class="btn mode-btn" data-mode="puzzle">' + T('gs.chess.modePuzzle') + '</button>' +
    '</div>' +
    '<div class="mode-row" id="ch-diff">' +
    '  <button class="btn mode-btn" data-d="easy">' + T('gs.chess.dEasy') + '</button>' +
    '  <button class="btn mode-btn" data-d="normal">' + T('gs.chess.dNormal') + '</button>' +
    '  <button class="btn mode-btn" data-d="hard">' + T('gs.chess.dHard') + '</button>' +
    '  <button class="btn mode-btn" data-d="master">' + T('gs.chess.dMaster') + '</button>' +
    '</div>' +
    '<div class="mode-row ch-time-row" id="ch-time">' +
    '  <button class="btn mode-btn" data-tc="0">3+2</button>' +
    '  <button class="btn mode-btn" data-tc="1">5+3</button>' +
    '  <button class="btn mode-btn selected" data-tc="2">10+5</button>' +
    '</div>' +
    '<div class="mode-row" id="ch-puzzles" style="display:none"></div>' +
    '<div class="ch-hud">' +
    '  <div class="ch-stat"><span>' + T('gs.chess.hudScore') + '</span><b id="ch-score">0</b></div>' +
    '  <div class="ch-stat"><span>' + T('gs.chess.hudBest') + '</span><b id="ch-best">0</b></div>' +
    '  <div class="ch-stat"><span>' + T('gs.chess.hudCaptures') + '</span><b id="ch-caps">—</b></div>' +
    '</div>' +
    '<div class="ch-clocks" id="ch-clocks">' +
    '  <div class="ch-clock" id="ch-clkW"><i>' + T('gs.chess.winYou') + '</i><b id="ch-clkW-v">10:00</b></div>' +
    '  <div class="ch-clock" id="ch-clkB"><i>AI</i><b id="ch-clkB-v">10:00</b></div>' +
    '</div>' +
    '<div class="ch-grid" id="ch-grid"></div>' +
    '<div class="ch-msg" id="ch-msg">' + T('gs.chess.msgStart') + '</div>' +
    '<div class="game-controls">' +
    '  <button class="btn cyan" id="ch-undo">' + T('gs.chess.undo') + '</button>' +
    '  <button class="btn cyan" id="ch-replay">' + T('gs.chess.replay') + '</button>' +
    '  <button class="btn yellow" id="ch-hint">' + T('gs.chess.hint') + '</button>' +
    '  <button class="btn purple" id="ch-restart">' + T('gs.chess.restart') + '</button>' +
    '</div>' +
    '<div class="ch-help">' + T('gs.chess.help') + '</div>' +
    '<div class="ch-overlay hidden" id="ch-overlay">' +
    '  <div class="ch-ov-card">' +
    '    <div class="ch-ov-icon" id="ch-ov-icon">♚</div>' +
    '    <h2 id="ch-ov-title"></h2>' +
    '    <p id="ch-ov-text"></p>' +
    '    <div class="ch-ov-btns">' +
    '      <button class="btn green" id="ch-ov-btn"></button>' +
    '      <button class="btn purple" id="ch-ov-alt"></button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="ch-promo hidden" id="ch-promo">' +
    '  <div class="ch-ov-card">' +
    '    <h2>' + T('gs.chess.promoTitle') + '</h2>' +
    '    <p>' + T('gs.chess.promoSub') + '</p>' +
    '    <div class="ch-promo-btns">' +
    '      <button class="ch-promo-btn" data-p="Q">♕</button>' +
    '      <button class="ch-promo-btn" data-p="R">♖</button>' +
    '      <button class="ch-promo-btn" data-p="B">♗</button>' +
    '      <button class="ch-promo-btn" data-p="N">♘</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';
  root.appendChild(wrap);

  var gridEl = wrap.querySelector('#ch-grid');
  var msg = wrap.querySelector('#ch-msg');
  var diffRow = wrap.querySelector('#ch-diff');
  var modeRow = wrap.querySelector('#ch-mode');
  var timeRow = wrap.querySelector('#ch-time');
  var puzzleRow = wrap.querySelector('#ch-puzzles');
  var scoreEl = wrap.querySelector('#ch-score');
  var bestEl = wrap.querySelector('#ch-best');
  var capsEl = wrap.querySelector('#ch-caps');
  var clocksEl = wrap.querySelector('#ch-clocks');
  var clkWBox = wrap.querySelector('#ch-clkW');
  var clkBBox = wrap.querySelector('#ch-clkB');
  var clkWEl = wrap.querySelector('#ch-clkW-v');
  var clkBEl = wrap.querySelector('#ch-clkB-v');
  var overlayEl = wrap.querySelector('#ch-overlay');
  var ovTitle = wrap.querySelector('#ch-ov-title');
  var ovText = wrap.querySelector('#ch-ov-text');
  var ovBtn = wrap.querySelector('#ch-ov-btn');
  var ovAlt = wrap.querySelector('#ch-ov-alt');
  var ovIcon = wrap.querySelector('#ch-ov-icon');
  var promoEl = wrap.querySelector('#ch-promo');
  var cells = [];

  // 残局按钮由「校验通过」的题库动态生成
  puzzleRow.innerHTML = VALID_PUZZLES.map(function (pz) {
    return '<button class="btn mode-btn" data-pz="' + PUZZLES.indexOf(pz) + '">' + T(pz.nKey) + '</button>';
  }).join('');

  function hideOverlay() { if (overlayEl) overlayEl.classList.add('hidden'); }
  function hidePromo() { if (promoEl) promoEl.classList.add('hidden'); pendingMove = null; }

  function syncDiffBtns() {
    diffRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
    var b = diffRow.querySelector('[data-d="' + difficulty + '"]');
    if (b) b.classList.add('selected');
  }
  function syncPuzzleBtns() {
    puzzleRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
    if (!currentPuzzle) return;
    var b = puzzleRow.querySelector('[data-pz="' + PUZZLES.indexOf(currentPuzzle) + '"]');
    if (b) b.classList.add('selected');
  }
  function syncModeBtns() {
    modeRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
    var m = modeRow.querySelector('[data-mode="' + (puzzleMode ? 'puzzle' : 'std') + '"]');
    if (m) m.classList.add('selected');
    puzzleRow.style.display = puzzleMode ? '' : 'none';
    timeRow.style.display = puzzleMode ? 'none' : '';
  }
  function syncTimeBtns() {
    timeRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
    var b = timeRow.querySelector('[data-tc="' + tcIndex + '"]');
    if (b) b.classList.add('selected');
  }

  function updateHud() {
    if (!scoreEl) return;
    scoreEl.textContent = scoreNow();
    bestEl.textContent = Math.max(getBest(), scoreNow());
    var caps = [];
    for (var i = 0; i < hist.length; i++) {
      var mv = hist[i].move;
      var st = hist[i].state;
      var cp = (mv.flag === 'ep') ? (st.turn === 'w' ? 'bP' : 'wP') : st.board[mv.tr][mv.tc];
      if (cp) caps.push(GLYPH[cp] || '');
    }
    capsEl.textContent = caps.length ? (caps.slice(-10).join('') || '—') : '—';
  }

  function render() {
    gridEl.innerHTML = '';
    cells = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var d = document.createElement('div');
        d.className = 'ch-cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        var p = S.board[r][c];
        if (p) {
          var sp = document.createElement('span');
          sp.className = 'ch-piece ' + (p[0] === 'w' ? 'white' : 'black') + (p[1] === 'K' ? ' king' : '');
          sp.textContent = GLYPH[p] || '';
          d.appendChild(sp);
        }
        if (lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c))) d.classList.add('last');
        if (sel && sel[0] === r && sel[1] === c) d.classList.add('sel');
        if (cursor && cursor.r === r && cursor.c === c) d.classList.add('cursor');
        var t = targets.filter(function (m) { return m.tr === r && m.tc === c; })[0];
        if (t) d.classList.add(t.flag === 'promo' ? 'promo' : (S.board[r][c] || t.flag === 'ep' ? 'capture' : 'move'));
        if (!over) {
          if (S.turn === 'w' && inCheck(S, 'w') && S.board[r][c] === 'wK') d.classList.add('check');
          if (S.turn === 'b' && inCheck(S, 'b') && S.board[r][c] === 'bK') d.classList.add('check');
        }
        d.addEventListener('click', (function (rr, cc) { return function () { cursor = { r: rr, c: cc }; click(rr, cc); }; })(r, c));
        gridEl.appendChild(d);
        cells.push(d);
      }
    }
  }

  function click(r, c) {
    if (over || S.turn !== 'w' || replaying || pendingMove) return;
    var p = S.board[r][c];
    if (sel) {
      var t = targets.filter(function (m) { return m.tr === r && m.tc === c; })[0];
      if (t) {
        if (t.flag === 'promo') {
          pendingMove = t;
          promoEl.classList.remove('hidden');
          if (Arcade.audio) Arcade.audio.play('select');
          return;
        }
        commitMove(t, 'Q');
        return;
      }
      if (p && p[0] === 'w') {
        sel = [r, c]; targets = movesFrom(r, c);
        if (Arcade.audio) Arcade.audio.play('select');
        render(); return;
      }
      sel = null; targets = [];
      if (Arcade.audio) Arcade.audio.play('ui');
    } else if (p && p[0] === 'w') {
      sel = [r, c]; targets = movesFrom(r, c);
      if (Arcade.audio) Arcade.audio.play('select');
    } else {
      if (Arcade.audio) Arcade.audio.play('error');
    }
    render();
  }

  function commitMove(m, promo) {
    pendingMove = null;
    hidePromo();
    playMove(m, promo);
    writeSave();
    if (gameEnd(false)) return;
    scheduleAI();
  }

  wrap.querySelectorAll('#ch-promo .ch-promo-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!pendingMove) return;
      var mv = pendingMove;
      commitMove(mv, b.getAttribute('data-p'));
    });
  });
  promoEl.addEventListener('click', function (e) {
    if (e.target === promoEl) { hidePromo(); render(); }
  });

  modeRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.getAttribute('data-mode');
      if (m === 'puzzle') {
        if (!puzzleMode) loadPuzzle(VALID_PUZZLES[0] || PUZZLES[0]);
      } else if (puzzleMode) {
        newGame();
      } else {
        newGame();
      }
      syncModeBtns();
      if (Arcade.audio) Arcade.audio.play('ui');
    });
  });
  puzzleRow.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-pz]') : null;
    if (!b) return;
    var pz = PUZZLES[Number(b.getAttribute('data-pz'))];
    if (pz) loadPuzzle(pz);
    if (Arcade.audio) Arcade.audio.play('ui');
  });

  diffRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      difficulty = b.getAttribute('data-d');
      syncDiffBtns();
      if (puzzleMode) {
        msg.textContent = T('gs.chess.diffChanged').replace('{d}', diffName(difficulty));
        msg.style.color = 'var(--neon-yellow)';
      } else {
        newGame();
      }
      updateHud();
      if (Arcade.audio) Arcade.audio.play('ui');
    });
  });
  timeRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      tcIndex = Number(b.getAttribute('data-tc')) || 0;
      syncTimeBtns();
      if (!puzzleMode) startClock();
      if (Arcade.audio) Arcade.audio.play('ui');
    });
  });

  wrap.querySelector('#ch-restart').addEventListener('click', function () {
    restartCurrent();
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  function restartCurrent() {
    if (puzzleMode && currentPuzzle) loadPuzzle(currentPuzzle); else newGame();
  }

  wrap.querySelector('#ch-undo').addEventListener('click', function () {
    if (replaying) { msg.textContent = T('gs.chess.replayWait'); msg.style.color = 'var(--text-dim)'; return; }
    if (S.turn !== 'w' || over) { msg.textContent = T('gs.chess.undoOnlyTurn'); msg.style.color = 'var(--text-dim)'; return; }
    undoPair();
  });
  wrap.querySelector('#ch-hint').addEventListener('click', function () {
    if (S.turn !== 'w' || over || replaying) { msg.textContent = T('gs.chess.hintOnlyTurn'); msg.style.color = 'var(--text-dim)'; return; }
    var best = null;
    if (puzzleMode && currentPuzzle) best = findMateMove(S, 'w', currentPuzzle.mateIn);
    if (!best) {
      var all = legalFor(S, 'w');
      if (!all.length) return;
      var bv = -1e9;
      for (var i = 0; i < all.length; i++) {
        var n = applyMove(S, all[i], 'Q');
        var v = -evalState(n);
        if (v > bv) { bv = v; best = all[i]; }
      }
    }
    if (!best) return;
    sel = [best.fr, best.fc];
    targets = [best];
    msg.textContent = T('gs.chess.hintMove').replace('{p}', pieceName(S.board[best.fr][best.fc])).replace('{r}', best.tr + 1).replace('{c}', best.tc + 1);
    msg.style.color = 'var(--neon-yellow)';
    render();
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  function pieceName(p) {
    if (!p) return T('gs.chess.piece');
    var names = { K: T('gs.chess.pK'), Q: T('gs.chess.pQ'), R: T('gs.chess.pR'), B: T('gs.chess.pB'), N: T('gs.chess.pN'), P: T('gs.chess.pP') };
    return names[p[1]] || p[1];
  }

  wrap.querySelector('#ch-replay').addEventListener('click', function () {
    if (replaying) return;
    if (!hist.length) { msg.textContent = T('gs.chess.replayNone'); msg.style.color = 'var(--text-dim)'; return; }
    replaying = true;
    cancelAI();
    var saved = cloneState(S), savedHist = hist.slice(), savedScore = capturedScore, savedOver = over, savedLast = lastMove;
    S = cloneState(replayBase);
    sel = null; targets = []; lastMove = null;
    render();
    msg.textContent = T('gs.chess.replayPlay').replace('{n}', savedHist.length);
    msg.style.color = 'var(--neon-cyan)';
    var i = 0;
    replayTimer = setInterval(function () {
      if (i >= savedHist.length) {
        clearInterval(replayTimer); replayTimer = null;
        S = saved; hist = savedHist; capturedScore = savedScore; over = savedOver; lastMove = savedLast;
        replaying = false; sel = null; targets = [];
        rebuildPosHistory(replayBase, hist);
        render(); updateHud(); updateClocks();
        msg.textContent = T('gs.chess.replayDone');
        msg.style.color = '';
        return;
      }
      var h = savedHist[i++];
      S = applyMove(S, h.move, h.promo);
      lastMove = h.move;
      render();
      if (Arcade.audio) Arcade.audio.play('move');
    }, 340);
  });

  /* 键盘 */
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (pendingMove && /^[qrbn]$/i.test(k)) {
      e.preventDefault();
      commitMove(pendingMove, k.toUpperCase());
      return;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      cursor.r += (k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0);
      cursor.c += (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0);
      cursor.r = Math.max(0, Math.min(7, cursor.r));
      cursor.c = Math.max(0, Math.min(7, cursor.c));
      render();
      return;
    }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); if (!pendingMove) click(cursor.r, cursor.c); return; }
    if (k === 'Escape') { sel = null; targets = []; hidePromo(); render(); return; }
    if (k === 'u' || k === 'U') { e.preventDefault(); if (S.turn === 'w' && !over && !replaying) undoPair(); return; }
    if (k === 'h' || k === 'H') { e.preventDefault(); wrap.querySelector('#ch-hint').click(); return; }
    if (k === 'r' || k === 'R') { e.preventDefault(); restartCurrent(); }
  });

  /* 存档 */
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'chess',
      collect: function () {
        if (over || replaying || !S) return null;
        return {
          board: S.board, turn: S.turn, castling: S.castling, ep: S.ep, half: S.half,
          capturedScore: capturedScore, difficulty: difficulty,
          puzzleMode: puzzleMode,
          puzzleIndex: puzzleMode && currentPuzzle ? PUZZLES.indexOf(currentPuzzle) : -1,
          replayBase: replayBase,
          posHistory: posHistory,
          clock: clock ? { w: clock.w, b: clock.b } : null,
          tcIndex: tcIndex
        };
      },
      apply: function (s) {
        if (!s || !Array.isArray(s.board) || s.board.length !== 8) return false;
        for (var ri = 0; ri < 8; ri++) if (!Array.isArray(s.board[ri]) || s.board[ri].length !== 8) return false;
        if (s.turn !== 'w' && s.turn !== 'b') return false;
        if (DIFFS.indexOf(s.difficulty) < 0) return false;
        var base = { board: s.board.map(function (r) { return r.slice(); }), turn: s.turn, castling: s.castling || { wk: false, wq: false, bk: false, bq: false }, ep: s.ep || null, half: Number(s.half) || 0 };
        if (!base.castling || typeof base.castling.wk !== 'boolean') base.castling = { wk: false, wq: false, bk: false, bq: false };
        S = base;
        difficulty = s.difficulty;
        tcIndex = (typeof s.tcIndex === 'number' && s.tcIndex >= 0 && s.tcIndex < TCS.length) ? s.tcIndex : tcIndex;
        capturedScore = Number(s.capturedScore) || 0;
        puzzleMode = !!s.puzzleMode;
        currentPuzzle = (puzzleMode && typeof s.puzzleIndex === 'number' && s.puzzleIndex >= 0 && s.puzzleIndex < PUZZLES.length) ? PUZZLES[s.puzzleIndex] : null;
        if (puzzleMode && !currentPuzzle) currentPuzzle = VALID_PUZZLES[0] || null;
        replayBase = s.replayBase && s.replayBase.board ? s.replayBase : cloneState(S);
        hist = []; sel = null; targets = []; over = false; replaying = false; lastMove = null; pendingMove = null;
        posHistory = Array.isArray(s.posHistory) && s.posHistory.length ? s.posHistory.slice() : [positionKey(S)];
        cursor = { r: 6, c: 4 };
        syncDiffBtns(); syncTimeBtns(); syncModeBtns(); if (puzzleMode) syncPuzzleBtns();
        render(); updateHud();
        startClock(puzzleMode ? null : s.clock);
        if (S.turn === 'b') scheduleAI();
        else { msg.textContent = T('gs.chess.msgYourTurn'); msg.style.color = ''; }
        return true;
      }
    });
  }

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.chess.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () { restartCurrent(); };

  var resumed = false;
  if (window.Arcade && Arcade.savegame) resumed = Arcade.savegame.resume();
  if (!resumed) newGame();

  /* ?qa=1 时挂载测试钩子（正常访问不存在） */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(location.search)) {
    window.__qa = {
      puzzles: function () {
        return PUZZLES.map(function (pz) {
          return { key: pz.nKey, valid: !!pz.solution, mateIn: pz.mateIn, solution: pz.solution };
        });
      },
      validCount: function () { return VALID_PUZZLES.length; },
      turn: function () { return S && S.turn; },
      over: function () { return over; },
      clock: function () { return clock ? { w: clock.w, b: clock.b } : null; },
      repetition: function () { return repetitionCount(positionKey(S)); },
      insufficient: function () { return S ? insufficientMaterial(S) : null; },
      setClock: function (w, b) { if (clock) { clock.w = w; clock.b = b; updateClocks(); } },
      forceFlag: function (side) {
        if (!clock || puzzleMode) return false;
        if (side === 'w') clock.w = 0; else clock.b = 0;
        tickClock();
        return true;
      },
      mateMove: function () { return currentPuzzle ? findMateMove(S, 'w', currentPuzzle.mateIn) : null; },
      bestMove: function (depth) {
        var old = difficulty;
        difficulty = 'hard';
        var m = aiChoose();
        difficulty = old;
        return m;
      },
      puzzleIndex: function () { return currentPuzzle ? PUZZLES.indexOf(currentPuzzle) : -1; },
      diag: function (i) {
        var st = parsePuzzle(PUZZLES[i].rows);
        var mine = legalFor(st, 'w');
        var info = mine.map(function (m) {
          var n = applyMove(st, m, 'Q');
          var om = legalFor(n, 'b');
          return { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc, blackLegal: om.length, givesCheck: inCheck(n, 'b') };
        });
        return { legal: mine.length, blackInCheck: inCheck(st, 'b'), whiteInCheck: inCheck(st, 'w'), moves: info };
      },
      loadPuzzle: function (i) { loadPuzzle(PUZZLES[i]); return !!PUZZLES[i]; },
      solve: function () {
        var m = currentPuzzle ? findMateMove(S, 'w', currentPuzzle.mateIn) : null;
        if (m) commitMove(m, 'Q');
        return m;
      },
      perf: function (diff) {
        var old = difficulty;
        difficulty = diff;
        var t = Date.now();
        var m = aiChoose();
        var ms = Date.now() - t;
        var info = { ms: ms, nodes: lastSearchNodes, depth: lastSearchDepth };
        difficulty = old;
        info.from = m ? [m.fr, m.fc] : null;
        info.to = m ? [m.tr, m.tc] : null;
        return info;
      },
      bookInfo: function () {
        var bk = buildBook();
        return { lines: BOOK_LINES.length, positions: Object.keys(bk).length, move: bookMoveFor(S) };
      },
      setRows: function (rows) {
        cancelAI(); stopClock(); clock = null; over = false; puzzleMode = false; currentPuzzle = null;
        S = parsePuzzle(rows); replayBase = cloneState(S); hist = []; sel = null; targets = [];
        capturedScore = 0; pendingMove = null; lastMove = null;
        posHistory = [positionKey(S)];
        hideOverlay(); hidePromo(); render(); updateHud(); updateClocks();
        return true;
      },
      clickAt: function (r, c) { click(r, c); return true; },
      promoOpen: function () { return !promoEl.classList.contains('hidden'); },
      board: function () { return S ? S.board : null; },
      startStd: function () { newGame(); return true; }
    };
  }
}
)();
