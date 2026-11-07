/* ============================================================
   连连看 · 连线配对（国民品类）
   牌面用不同图案，两段三折线内连通即消除。
   核心：0/1/2 折连通判定（含棋盘外绕边）+ 逆向放置可解发牌器。
   核心逻辑用 ==LLK-CORE-START== / ==LLK-CORE-END== 标记包裹，供 Node harness 提取。
   ============================================================ */

(function () {
  /* ==LLK-CORE-START== */
  var LLK_SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Δ', 'Ω', '⌁', '☍', '⌬', '◬', '⏚', '✶', '◉', '▣'];
  var LLK_CONF = {
    1: { rows: 6, cols: 8, kinds: 8 },   // 48 张 / 8 种 × 6
    2: { rows: 8, cols: 8, kinds: 16 },  // 64 张 / 16 种 × 4
    3: { rows: 9, cols: 8, kinds: 18 }   // 72 张 / 18 种（成对分布；8 列保证 375 宽下牌面更大）
  };

  function LLK_mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function LLK_shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** 同行/同列无障碍（含端点；棋盘外 -1/n 视为空） */
  function LLK_lineClear(board, r1, c1, r2, c2) {
    var R = board.length, C = board[0].length;
    if (r1 === r2 && c1 === c2) return true;
    if (r1 === r2) {
      if (r1 < 0 || r1 >= R) return true;
      var step = c1 < c2 ? 1 : -1;
      for (var c = c1 + step; c !== c2; c += step) {
        if (c < 0 || c >= C) continue;
        if (board[r1][c] !== 0) return false;
      }
      return true;
    }
    if (c1 === c2) {
      if (c1 < 0 || c1 >= C) return true;
      var step2 = r1 < r2 ? 1 : -1;
      for (var r = r1 + step2; r !== r2; r += step2) {
        if (r < 0 || r >= R) continue;
        if (board[r][c1] !== 0) return false;
      }
      return true;
    }
    return false;
  }

  /** 两位置是否可消（≤2 折，含绕边）；返回 { points: [p1, 拐点…, p2] } 或 null */
  function LLK_findPath(board, p1, p2) {
    var R = board.length, C = board[0].length;
    var r1 = p1[0], c1 = p1[1], r2 = p2[0], c2 = p2[1];
    if (r1 === r2 && c1 === c2) return null;
    if (board[r1][c1] === 0 || board[r2][c2] === 0) return null;
    if (board[r1][c1] !== board[r2][c2]) return null;
    if ((r1 === r2 || c1 === c2) && LLK_lineClear(board, r1, c1, r2, c2)) return { points: [[r1, c1], [r2, c2]] };
    if (LLK_at(board, r1, c2) === 0 && LLK_lineClear(board, r1, c1, r1, c2) && LLK_lineClear(board, r1, c2, r2, c2)) return { points: [[r1, c1], [r1, c2], [r2, c2]] };
    if (LLK_at(board, r2, c1) === 0 && LLK_lineClear(board, r1, c1, r2, c1) && LLK_lineClear(board, r2, c1, r2, c2)) return { points: [[r1, c1], [r2, c1], [r2, c2]] };
    for (var c = -1; c <= C; c++) {
      if (c === c1 || c === c2) continue;
      if (LLK_at(board, r1, c) !== 0 || LLK_at(board, r2, c) !== 0) continue;
      if (LLK_lineClear(board, r1, c1, r1, c) && LLK_lineClear(board, r1, c, r2, c) && LLK_lineClear(board, r2, c, r2, c2)) return { points: [[r1, c1], [r1, c], [r2, c], [r2, c2]] };
    }
    for (var r = -1; r <= R; r++) {
      if (r === r1 || r === r2) continue;
      if (LLK_at(board, r, c1) !== 0 || LLK_at(board, r, c2) !== 0) continue;
      if (LLK_lineClear(board, r1, c1, r, c1) && LLK_lineClear(board, r, c1, r, c2) && LLK_lineClear(board, r, c2, r2, c2)) return { points: [[r1, c1], [r, c1], [r, c2], [r2, c2]] };
    }
    return null;
  }
  function LLK_canConnect(board, p1, p2) { return !!LLK_findPath(board, p1, p2); }
  /** 越界访问返回 0（空） */
  function LLK_at(board, r, c) {
    if (r < 0 || r >= board.length || c < 0 || c >= board[0].length) return 0;
    return board[r][c];
  }

  /** 扫描全部可消对（用于提示/无解判定） */
  function LLK_findPair(board) {
    var R = board.length, C = board[0].length;
    var groups = {};
    for (var r = 0; r < R; r++) {
      for (var c = 0; c < C; c++) {
        var v = board[r][c];
        if (v === 0) continue;
        var key = 'v' + v;
        (groups[key] = groups[key] || []).push([r, c]);
      }
    }
    for (var k in groups) {
      var list = groups[k];
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          if (LLK_canConnect(board, list[i], list[j])) return [list[i], list[j]];
        }
      }
    }
    return null;
  }

  /** 某一层（距边界 depth 的环）格子，按顺时针环序排列 */
  function LLK_layerCells(R, C, depth) {
    var out = [];
    var minR = depth, maxR = R - 1 - depth, minC = depth, maxC = C - 1 - depth;
    if (minR > maxR || minC > maxC) return out;
    for (var c1 = minC; c1 <= maxC; c1++) out.push([minR, c1]);
    for (var r1 = minR + 1; r1 <= maxR; r1++) out.push([r1, maxC]);
    if (maxR > minR) { for (var c2 = maxC - 1; c2 >= minC; c2--) out.push([maxR, c2]); }
    if (maxC > minC) { for (var r2 = maxR - 1; r2 >= minR + 1; r2--) out.push([r2, minC]); }
    return out;
  }

  function LLK_emptyBoard(R, C) {
    var b = [];
    for (var r = 0; r < R; r++) {
      var row = [];
      for (var c = 0; c < C; c++) row.push(0);
      b.push(row);
    }
    return b;
  }

  /** 兜底：全部用相邻格成对（必然可解，任何顺序都能消） */
  function LLK_adjacentBoard(R, C, kinds, rnd) {
    var board = LLK_emptyBoard(R, C);
    var pairs = [];
    var useH = (C % 2 === 0);
    if (useH) {
      for (var r = 0; r < R; r++) {
        for (var c = 0; c + 1 < C; c += 2) pairs.push([[r, c], [r, c + 1]]);
      }
    } else {
      for (var c3 = 0; c3 < C; c3++) {
        for (var r3 = 0; r3 + 1 < R; r3 += 2) pairs.push([[r3, c3], [r3 + 1, c3]]);
      }
    }
    var kindsArr = [];
    for (var i = 0; i < pairs.length; i++) kindsArr.push((i % kinds) + 1);
    LLK_shuffle(kindsArr, rnd);
    for (var p = 0; p < pairs.length; p++) {
      var pair = pairs[p], k = kindsArr[p];
      board[pair[0][0]][pair[0][1]] = k;
      board[pair[1][0]][pair[1][1]] = k;
    }
    return { board: board, pairs: pairs };
  }

  /**
   * 逆向放置生成器：
   * 从空棋盘开始，按「未来消除顺序的逆序」成对放置；每放一对都用 LLK_findPath
   * 在当前已放牌上验证 ≤2 折连通（空格即当时已消除的格），因此按相反顺序必能全消。
   * 兜底：全体相邻成对（任何顺序都可消）。
   */
  function LLK_genBoard(level, seed) {
    var conf = LLK_CONF[level] || LLK_CONF[1];
    var R = conf.rows, C = conf.cols, kinds = conf.kinds;
    var total = R * C;
    if (total % 2 !== 0) throw new Error('board must be even');
    var pairCount = total / 2;
    var baseSeed = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0) : ((Date.now() % 2147483647) >>> 0);
    var MAX_ATTEMPTS = 48;

    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var rnd = LLK_mulberry32(baseSeed + attempt * 131);
      var board = LLK_emptyBoard(R, C);
      var pairsPlaced = [];
      var kindsArr = [];
      for (var ki = 0; ki < pairCount; ki++) kindsArr.push((ki % kinds) + 1);
      LLK_shuffle(kindsArr, rnd);
      var layers = [];
      for (var d = 0; d < Math.max(R, C); d++) {
        var lc = LLK_layerCells(R, C, d);
        if (!lc.length) break;
        layers.push(lc);
      }
      var ok = true;
      var pairCursor = 0;
      for (var li = layers.length - 1; li >= 0 && ok; li--) {
        var cells = layers[li].slice();
        LLK_shuffle(cells, rnd);
        while (cells.length) {
          var a = cells[0];
          var found = -1;
          var n = cells.length;
          var start = 1 + Math.floor(rnd() * (n - 1));
          for (var t = 0; t < n - 1; t++) {
            var idx = 1 + ((start - 1 + t) % (n - 1));
            var cand = cells[idx];
            board[a[0]][a[1]] = 9999;
            board[cand[0]][cand[1]] = 9999;
            var path = LLK_findPath(board, a, cand);
            board[a[0]][a[1]] = 0;
            board[cand[0]][cand[1]] = 0;
            if (path) { found = idx; break; }
          }
          if (found < 0) { ok = false; break; }
          var b = cells[found];
          var k = kindsArr[pairCursor++];
          board[a[0]][a[1]] = k;
          board[b[0]][b[1]] = k;
          pairsPlaced.push([a, b]);
          cells.splice(found, 1);
          cells.splice(0, 1);
        }
      }
      if (!ok) continue;

      // 正向回放验证：按相反顺序消除，必须全部清空
      var test = [];
      for (var tr = 0; tr < R; tr++) test.push(board[tr].slice());
      var solution = pairsPlaced.slice().reverse();
      var verify = true;
      for (var si = 0; si < solution.length; si++) {
        var pp = solution[si];
        if (!LLK_findPath(test, pp[0], pp[1])) { verify = false; break; }
        test[pp[0][0]][pp[0][1]] = 0;
        test[pp[1][0]][pp[1][1]] = 0;
      }
      if (verify) {
        for (var vr = 0; vr < R && verify; vr++) {
          for (var vc = 0; vc < C; vc++) {
            if (test[vr][vc] !== 0) { verify = false; break; }
          }
        }
      }
      if (!verify) continue;
      // 开局自检：至少存在一对可消
      if (!LLK_findPair(board)) continue;
      return { board: board, R: R, C: C, kinds: kinds, solution: solution, seed: baseSeed, attempts: attempt };
    }

    // 极端兜底
    var fbRnd = LLK_mulberry32(baseSeed + 991);
    var fb = LLK_adjacentBoard(R, C, kinds, fbRnd);
    return { board: fb.board, R: R, C: C, kinds: kinds, solution: fb.pairs, seed: baseSeed, attempts: MAX_ATTEMPTS, fallback: true };
  }
  /* ==LLK-CORE-END== */

  /* ================= UI 层 ================= */
  var root = document.getElementById('game-root');
  if (!root) return;

  var HINTS_PER_RUN = 3;
  var SHUFFLES_PER_RUN = 3;
  var HINT_PENALTY_MS = 4000;
  var MODE_OPTS = [
    { key: 'standard', labelKey: 'gs.llk.optStandard' },
    { key: 'timed', sec: 90, labelKey: 'gs.llk.optTimed' },
    { key: 'timed', sec: 120, labelKey: 'gs.llk.optTimed' },
    { key: 'timed', sec: 150, labelKey: 'gs.llk.optTimed' },
    { key: 'moves', moves: 40, labelKey: 'gs.llk.optMoves' },
    { key: 'moves', moves: 60, labelKey: 'gs.llk.optMoves' }
  ];
  var LEVEL_INFO = [
    { t: T('gs.llk.level1t'), d: T('gs.llk.level1d') },
    { t: T('gs.llk.level2t'), d: T('gs.llk.level2d') },
    { t: T('gs.llk.level3t'), d: T('gs.llk.level3d') }
  ];

  var styleEl = document.createElement('style');
  styleEl.textContent =
    '#game-root .btn{min-height:44px}' +
    '.ll-modes{display:flex;gap:8px;align-items:center;justify-content:center;margin:0 0 10px;font-size:12px;color:var(--text-dim)}' +
    '.ll-modes select{min-height:44px;background:rgba(8,32,42,.92);color:#8ff5ff;border:1px solid rgba(0,240,255,.35);' +
    'border-radius:8px;padding:0 10px;font-size:13px;max-width:100%}' +
    '.ll-daily{font-size:12px;color:var(--text-dim);margin:4px 2px 6px;line-height:1.6}' +
    '.ll-boardview{width:100%;max-height:70vh;overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}' +
    '.ll-board{box-shadow:0 0 18px rgba(0,240,255,0.10), inset 0 0 24px rgba(0,0,0,0.5);animation:llBoardGlow 3.2s ease-in-out infinite alternate}' +
    '@keyframes llBoardGlow{from{box-shadow:0 0 10px rgba(0,240,255,0.08), inset 0 0 24px rgba(0,0,0,0.5)}to{box-shadow:0 0 24px rgba(0,240,255,0.20), inset 0 0 24px rgba(0,0,0,0.5)}}' +
    '.ll-tile{box-sizing:border-box;aspect-ratio:1/1 !important;font-size:12px}' +
    '.ll-tile.kb{outline:2px solid var(--neon-yellow);outline-offset:-2px;box-shadow:0 0 10px rgba(255,230,0,.55)}' +
    '.ll-status span{white-space:nowrap}' +
    '.ll-hintcost{color:var(--neon-pink)}' +
    '.ll-overlay{z-index:9750}' +
    /* 375 宽：收窄横向留白/间隙，把 8 列牌面实际渲染尺寸抬到 ≥44px（仍不横向溢出） */
    '@media (max-width:480px){#game-root{padding-left:0!important;padding-right:0!important}' +
    '.ll-wrap{padding-left:0!important;padding-right:0!important;width:100vw!important}}';
  document.head.appendChild(styleEl);

  root.innerHTML =
    '<div class="ll-wrap">' +
    '  <div class="ll-tabs">' +
    '    <button class="btn mode-btn selected" id="ll-tab-chal">' + T('gs.llk.tabChal') + '</button>' +
    '    <button class="btn mode-btn" id="ll-tab-daily">' + T('gs.llk.tabDaily') + '</button>' +
    '  </div>' +
    '  <div class="ll-modes" id="ll-modes"><label for="ll-mode">' + T('gs.llk.modeLbl') + '</label><select id="ll-mode"></select></div>' +
    '  <div class="ll-info"><span id="ll-lev"></span><span id="ll-timer">0s</span></div>' +
    '  <div class="ll-flavor" id="ll-brief"></div>' +
    '  <div class="ll-daily hidden" id="ll-daily"></div>' +
    '  <div class="ll-boardview" id="ll-boardview"><div class="ll-board" id="ll-board"></div></div>' +
    '  <div class="ll-status">' +
    '    <span>' + T('gs.llk.left') + ' <b id="ll-left">0</b> ' + T('gs.llk.tilesUnit') + '</span>' +
    '    <span>' + T('gs.llk.steps') + ' <b id="ll-steps">0</b></span>' +
    '    <span>' + T('gs.llk.hintLbl') + ' <b id="ll-hints">' + HINTS_PER_RUN + '</b> <span class="ll-hintcost">' + T('gs.llk.hintCost') + '</span></span>' +
    '    <span>' + T('gs.llk.shuffles') + ' <b id="ll-shuff">' + SHUFFLES_PER_RUN + '</b> ' + T('gs.llk.shuffUnit') + '</span>' +
    '  </div>' +
    '  <div class="ll-row">' +
    '    <button class="btn" id="ll-hint">' + T('gs.llk.hintBtn') + '</button>' +
    '    <button class="btn" id="ll-shuffle">' + T('gs.llk.shuffleBtn') + '</button>' +
    '  </div>' +
    '  <div class="ll-msg" id="ll-msg"></div>' +
    '  <div class="ll-overlay hidden" id="ll-overlay">' +
    '    <h2 id="ll-ov-title"></h2>' +
    '    <p id="ll-ov-text"></p>' +
    '    <div class="ll-row">' +
    '      <button class="btn" id="ll-ov-btn2"></button>' +
    '      <button class="btn green" id="ll-ov-btn"></button>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var tabChal = document.getElementById('ll-tab-chal');
  var tabDaily = document.getElementById('ll-tab-daily');
  var modesEl = document.getElementById('ll-modes');
  var modeSelect = document.getElementById('ll-mode');
  var levEl = document.getElementById('ll-lev');
  var timerEl = document.getElementById('ll-timer');
  var briefEl = document.getElementById('ll-brief');
  var dailyEl = document.getElementById('ll-daily');
  var boardEl = document.getElementById('ll-board');
  var viewEl = document.getElementById('ll-boardview');
  var leftEl = document.getElementById('ll-left');
  var stepsEl = document.getElementById('ll-steps');
  var hintsEl = document.getElementById('ll-hints');
  var shuffEl = document.getElementById('ll-shuff');
  var msgEl = document.getElementById('ll-msg');
  var overlayEl = document.getElementById('ll-overlay');
  var ovTitle = document.getElementById('ll-ov-title');
  var ovText = document.getElementById('ll-ov-text');
  var ovBtn = document.getElementById('ll-ov-btn');
  var ovBtn2 = document.getElementById('ll-ov-btn2');

  var board = null, R = 0, C = 0;
  var sel = null, steps = 0, hints = HINTS_PER_RUN, shuffles = SHUFFLES_PER_RUN;
  var isDaily = false, levelIdx = 0;
  var modeIdx = 0, mode = 'standard', limitSec = 0, limitMoves = 0;
  var totalMs = 0, penaltyMs = 0, levelStart = 0;
  var levelPenaltyMs = 0, stepsAtLevelStart = 0;
  var wonGame = false, failed = false;
  var solution = null;
  var kbd = { r: 0, c: 0 };
  var timerTick = null;

  function todaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function modeOpt() { return MODE_OPTS[modeIdx] || MODE_OPTS[0]; }
  function modeLabel() {
    var o = modeOpt();
    return T(o.labelKey).replace('{s}', String(o.sec || '')).replace('{n}', String(o.moves || ''));
  }
  function applyMode(idx) {
    modeIdx = (idx >= 0 && idx < MODE_OPTS.length) ? idx : 0;
    var o = MODE_OPTS[modeIdx];
    mode = o.key;
    limitSec = o.sec || 0;
    limitMoves = o.moves || 0;
    if (modeSelect && modeSelect.value !== String(modeIdx)) modeSelect.value = String(modeIdx);
  }
  function remainingCount() {
    var n = 0;
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (board[r][c] !== 0) n++;
    return n;
  }
  function elapsedTotal() {
    return totalMs + penaltyMs + (wonGame || failed ? 0 : Math.max(0, Date.now() - levelStart));
  }
  /* 本关限时/限步口径：每关独立预算（进入下一关时重置），整轮成绩仍累计 */
  function levelElapsedMs() {
    return Math.max(0, Date.now() - levelStart) + levelPenaltyMs;
  }
  function levelSteps() {
    return Math.max(0, steps - stepsAtLevelStart);
  }
  function fmtSec(sec) { return String(Math.max(0, Math.floor(sec))) + 's'; }

  var tilePx = 40;

  function paintBoard(withDeal) {
    if (!board) return;
    var vw = viewEl ? viewEl.clientWidth : 0;
    if (!vw) vw = Math.max(0, window.innerWidth - 20);
    /* 还原窄屏去掉的横向边框，再按当前视口重新计算 */
    boardEl.style.borderLeftWidth = '';
    boardEl.style.borderRightWidth = '';
    var cs = getComputedStyle(boardEl);
    var bw = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    var pad = vw < 360 ? 2 : (vw < 480 ? 5 : 8);
    var gap = vw < 360 ? 1 : (vw < 480 ? 2 : 3);
    function fitTile(p, g) { return Math.floor((vw - bw - p * 2 - g * (C - 1)) / C); }
    var tile = fitTile(pad, gap);
    /* 优先保证单格 ≥40px：先收内边距/间隙，再收横向边框，最后才允许容器内滚动 */
    if (tile < 40) {
      pad = 0; gap = 0;
      tile = fitTile(0, 0);
      if (tile < 40 && bw > 0) {
        boardEl.style.borderLeftWidth = '0';
        boardEl.style.borderRightWidth = '0';
        bw = 0;
        tile = fitTile(0, 0);
      }
    }
    tile = Math.max(40, Math.min(64, tile || 0));
    tilePx = tile;
    var prevL = viewEl ? viewEl.scrollLeft : 0;
    var prevT = viewEl ? viewEl.scrollTop : 0;
    boardEl.innerHTML = '';
    boardEl.style.padding = pad + 'px';
    boardEl.style.gap = gap + 'px';
    boardEl.style.gridTemplateColumns = 'repeat(' + C + ', ' + tile + 'px)';
    boardEl.style.gridTemplateRows = 'repeat(' + R + ', ' + tile + 'px)';
    var fs = Math.max(11, Math.min(20, Math.round(tile * 0.4)));
    for (var r = 0; r < R; r++) {
      for (var c = 0; c < C; c++) {
        (function (rr, cc) {
          var v = board[rr][cc];
          var t = document.createElement('button');
          t.className = 'll-tile' + (v === 0 ? ' empty' : '');
          t.dataset.r = rr; t.dataset.c = cc;
          t.style.width = tile + 'px';
          t.style.height = tile + 'px';
          t.style.fontSize = fs + 'px';
          if (v !== 0) {
            t.textContent = LLK_SYMBOLS[(v - 1) % LLK_SYMBOLS.length];
            if (sel && sel[0] === rr && sel[1] === cc) t.classList.add('sel');
            if (kbd.r === rr && kbd.c === cc) t.classList.add('kb');
            if (withDeal) {
              t.classList.add('deal');
              t.style.animationDelay = Math.min(360, (rr * C + cc) * 7) + 'ms';
            }
            t.addEventListener('click', function () { clickTile(rr, cc); });
          }
          boardEl.appendChild(t);
        })(r, c);
      }
    }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'll-lines');
    boardEl.appendChild(svg);
    if (viewEl) { viewEl.scrollLeft = prevL; viewEl.scrollTop = prevT; }
    leftEl.textContent = remainingCount();
    stepsEl.textContent = mode === 'moves' ? (levelSteps() + '/' + limitMoves) : steps;
    hintsEl.textContent = hints;
    shuffEl.textContent = shuffles;
    updateShuffleHint();
  }

  function updateShuffleHint() {
    var btn = document.getElementById('ll-shuffle');
    if (!btn) return;
    btn.classList.toggle('urgent', !LLK_findPair(board) && remainingCount() > 0);
  }

  function tileClient(r, c) {
    var el = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
    if (!el) return null;
    var b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
  }
  function burstTile(r, c, color, count) {
    if (!window.Arcade || !Arcade.fx) return;
    var p = tileClient(r, c);
    if (p) Arcade.fx.burst(p.x, p.y, color, count);
  }
  /* 只滚动棋盘视口，把目标牌带入可见区域（键盘/提示/洗牌后） */
  function revealTile(r, c) {
    if (!boardEl || r < 0 || c < 0) return;
    var el = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* 真实连线：SVG 折线沿路径生长 + 拐点闪光（视觉层，不影响判定） */
  function drawLink(path, ok) {
    var svg = boardEl.querySelector('.ll-lines');
    if (!svg || !path || !path.length) return;
    var t00 = boardEl.querySelector('[data-r="0"][data-c="0"]');
    if (!t00) return;
    var box = boardEl.getBoundingClientRect();
    var r00 = t00.getBoundingClientRect();
    var c01 = boardEl.querySelector('[data-r="0"][data-c="1"]');
    var r10 = boardEl.querySelector('[data-r="1"][data-c="0"]');
    var stepX = c01 ? (c01.getBoundingClientRect().left - r00.left) : r00.width;
    var stepY = r10 ? (r10.getBoundingClientRect().top - r00.top) : r00.height;
    var w = box.width, h = box.height;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var pts = path.map(function (p) {
      return [
        r00.left - box.left + p[1] * stepX + r00.width / 2,
        r00.top - box.top + p[0] * stepY + r00.height / 2
      ];
    });
    var color = ok ? '#39ff14' : '#ff2d95';
    var len = 0;
    for (var i = 1; i < pts.length; i++) {
      len += Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2));
    }
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', color);
    poly.setAttribute('stroke-width', '3');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.style.filter = 'drop-shadow(0 0 6px ' + color + ')';
    poly.style.strokeDasharray = len + ' ' + len;
    poly.style.strokeDashoffset = len;
    poly.style.transition = 'stroke-dashoffset .32s cubic-bezier(.3,.9,.4,1)';
    svg.appendChild(poly);
    pts.forEach(function (p, idx) {
      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]); dot.setAttribute('r', idx === 0 || idx === pts.length - 1 ? 4.5 : 3);
      dot.setAttribute('fill', color);
      dot.style.filter = 'drop-shadow(0 0 5px ' + color + ')';
      svg.appendChild(dot);
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { poly.style.strokeDashoffset = '0'; });
    });
    setTimeout(function () {
      svg.classList.add('fade');
      setTimeout(function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }, 320);
    }, 460);
  }

  function flashPath(path, ok) {
    path.forEach(function (pt) {
      var r = pt[0], c = pt[1];
      if (r < 0 || r >= R || c < 0 || c >= C) return;
      var el = boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
      if (el) el.classList.add(ok ? 'path' : 'bad');
    });
    drawLink(path, ok);
    if (window.Arcade && Arcade.fx) {
      var end0 = path[0], end1 = path[path.length - 1];
      burstTile(end0[0], end0[1], ok ? 'var(--neon-green)' : 'var(--neon-pink)', ok ? 12 : 8);
      burstTile(end1[0], end1[1], ok ? 'var(--neon-green)' : 'var(--neon-pink)', ok ? 12 : 8);
    }
    setTimeout(function () {
      var els = boardEl.querySelectorAll('.ll-tile.path, .ll-tile.bad');
      for (var i = 0; i < els.length; i++) els[i].classList.remove('path', 'bad');
    }, 500);
  }

  function overlayOpen() { return !overlayEl.classList.contains('hidden'); }

  /* 结算出现前清空 toast 堆叠（只删共享 DOM 节点，不改共享 UI 代码） */
  function clearToasts() {
    var box = document.getElementById('arcade-toast');
    if (!box) return;
    var items = box.querySelectorAll('.toast-item');
    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].parentNode) items[i].parentNode.removeChild(items[i]);
    }
  }

  function clickTile(r, c) {
    if (!board || wonGame || failed || overlayOpen()) return;
    if (r < 0 || r >= R || c < 0 || c >= C) return;
    if (board[r][c] === 0) return;
    kbd = { r: r, c: c };
    if (sel === null) {
      sel = [r, c];
      paintBoard();
      if (Arcade.audio) Arcade.audio.play('ui');
      burstTile(r, c, 'var(--neon-cyan)', 6);
      return;
    }
    if (sel[0] === r && sel[1] === c) {
      sel = null;
      paintBoard();
      if (Arcade.audio) Arcade.audio.play('back');
      return;
    }
    var from = [sel[0], sel[1]];
    var path = LLK_findPath(board, from, [r, c]);
    steps++;
    if (path) {
      board[from[0]][from[1]] = 0;
      board[r][c] = 0;
      sel = null;
      if (Arcade.audio) Arcade.audio.play('coin');
      paintBoard();
      var pts = path.points;
      setTimeout(function () { flashPath(pts, true); }, 30);
      updateHudStatus();
      writeSave();
      if (remainingCount() === 0) { winLevel(); return; }
      checkDeadlock();
      if (mode === 'moves' && levelSteps() >= limitMoves) { failGame('moves'); return; }
    } else {
      sel = null;
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(boardEl);
      paintBoard();
      setTimeout(function () { flashPath([from, [r, c]], false); }, 30);
      updateHudStatus();
      writeSave();
      if (mode === 'moves' && levelSteps() >= limitMoves) { failGame('moves'); return; }
    }
  }

  function checkDeadlock() {
    if (!LLK_findPair(board)) {
      msgEl.textContent = T('gs.llk.msgDeadlock');
      if (Arcade.ui) Arcade.ui.toast(T('gs.llk.toastDeadlock'), 'warn');
    } else {
      msgEl.textContent = '';
    }
    updateShuffleHint();
  }

  function startGame(daily) {
    isDaily = !!daily;
    levelIdx = 0; totalMs = 0; penaltyMs = 0; steps = 0; levelPenaltyMs = 0; stepsAtLevelStart = 0;
    hints = HINTS_PER_RUN; shuffles = SHUFFLES_PER_RUN;
    sel = null; wonGame = false; failed = false;
    kbd = { r: 0, c: 0 };
    overlayEl.classList.add('hidden');
    tabChal.classList.toggle('selected', !isDaily);
    tabDaily.classList.toggle('selected', isDaily);
    modesEl.classList.toggle('hidden', isDaily);
    dailyEl.classList.toggle('hidden', !isDaily);
    if (!isDaily) modeSelect.disabled = false;
    else modeSelect.disabled = true;
    startLevel();
  }

  function randomSeed() {
    return ((Date.now() % 2147483647) + levelIdx * 104729 + Math.floor(Math.random() * 99991)) >>> 0;
  }

  function startLevel() {
    var g = isDaily
      ? LLK_genBoard(1 + (levelIdx % 3), todaySeed() + levelIdx * 7)
      : LLK_genBoard(levelIdx + 1, randomSeed());
    board = g.board; R = g.R; C = g.C;
    solution = g.solution || null;
    sel = null;
    kbd = { r: 0, c: 0 };
    for (var r = 0; r < R && board[kbd.r][kbd.c] === 0; r++) {
      for (var c = 0; c < C; c++) { if (board[r][c] !== 0) { kbd = { r: r, c: c }; r = R; break; } }
    }
    msgEl.textContent = T('gs.llk.kbHint');
    timerEl.textContent = (mode === 'timed' && !isDaily) ? fmtSec(limitSec) : '0s';
    levelStart = Date.now();
    levelPenaltyMs = 0;
    stepsAtLevelStart = steps;
    if (isDaily) {
      levEl.textContent = T('gs.llk.dailyLev').replace('{n}', levelIdx + 1).replace('{d}', (levelIdx === 0 ? '6×8' : levelIdx === 1 ? '8×8' : '9×8'));
      briefEl.textContent = T('gs.llk.dailyBrief') + LEVEL_INFO[levelIdx % 3].d;
    } else {
      levEl.textContent = T('gs.llk.chalLev').replace('{t}', LEVEL_INFO[levelIdx].t).replace('{n}', levelIdx + 1) +
        ' · ' + modeLabel();
      briefEl.textContent = LEVEL_INFO[levelIdx].d + ' ' + T('gs.llk.scoreRule');
    }
    if (viewEl) { viewEl.scrollLeft = 0; viewEl.scrollTop = 0; }
    paintBoard(true);
    updateHudStatus();
    checkDeadlock();
    updateDailyInfo();
    writeSave();
  }

  function updateHudStatus() {
    if (!board) return;
    leftEl.textContent = remainingCount();
    stepsEl.textContent = mode === 'moves' ? (levelSteps() + '/' + limitMoves) : steps;
    hintsEl.textContent = hints;
    shuffEl.textContent = shuffles;
  }

  function updateDailyInfo() {
    var solved = (window.Arcade && Arcade.daily) ? Arcade.daily.solvedTime('llk') : null;
    var streak = (window.Arcade && Arcade.daily) ? Arcade.daily.streak() : 0;
    dailyEl.textContent = T('gs.llk.dailyInfo')
      .replace('{state}', solved == null ? T('gs.llk.dailyTodo') : T('gs.llk.dailyDone').replace('{t}', fmtSec(solved)))
      .replace('{s}', streak);
  }

  function tick() {
    if (wonGame || failed || !board || overlayOpen()) return;
    var el = elapsedTotal();
    if (mode === 'timed' && !isDaily) {
      var left = limitSec * 1000 - levelElapsedMs();
      if (left <= 0) {
        timerEl.textContent = '0s';
        failGame('timeout');
        return;
      }
      timerEl.textContent = fmtSec(Math.ceil(left / 1000));
      timerEl.style.color = left <= 15000 ? 'var(--neon-pink)' : '';
      timerEl.style.textShadow = left <= 15000 ? '0 0 10px rgba(255,45,149,0.8)' : '';
    } else {
      timerEl.textContent = fmtSec(el / 1000);
      timerEl.style.color = '';
      timerEl.style.textShadow = '';
    }
  }

  function showOverlay(title, text, primaryLabel, primaryFn, secondaryLabel, secondaryFn, win) {
    clearToasts();
    ovTitle.textContent = title;
    ovTitle.className = win ? 'win' : '';
    ovText.innerHTML = text;
    ovBtn.textContent = primaryLabel;
    ovBtn.onclick = primaryFn;
    ovBtn2.textContent = secondaryLabel;
    ovBtn2.onclick = secondaryFn;
    overlayEl.classList.remove('hidden');
  }

  function winLevel() {
    totalMs += Date.now() - levelStart;
    levelStart = Date.now();
    if (levelIdx < 2) {
      levelIdx++;
      startLevel();
      if (Arcade.ui) Arcade.ui.toast(T('gs.llk.toastLevelPass').replace('{n}', levelIdx + 1), 'win');
      return;
    }
    finishGame();
  }

  function finishGame() {
    wonGame = true;
    if (Arcade.juice) Arcade.juice.win();
    var finalMs = totalMs + penaltyMs;
    var finalSec = Math.max(1, Math.round(finalMs / 1000));
    timerEl.textContent = fmtSec(finalSec);
    var score = finalSec + steps;
    var modeText = isDaily ? T('gs.llk.dailyTag') : modeLabel();
    var stats = T('gs.llk.winFinalD')
      .replace('{mode}', modeText).replace('{s}', finalSec)
      .replace('{n}', steps).replace('{h}', HINTS_PER_RUN - hints)  // 提示使用次数
      .replace('{sc}', score);
    if (isDaily) {
      if (Arcade.daily) Arcade.daily.markSolved('llk', finalSec);
      updateDailyInfo();
      showOverlay(T('gs.llk.winDailyT'),
        T('gs.llk.winDailyD').replace('{s}', finalSec).replace('{n}', steps) + '<br>' +
        T('gs.llk.dailyInfo').replace('{state}', T('gs.llk.dailyDone').replace('{t}', fmtSec(finalSec))).replace('{s}', Arcade.daily ? Arcade.daily.streak() : 0) + '<br>' +
        T('gs.llk.dailyNoBest'),
        T('gs.llk.again'), function () { startGame(true); },
        T('gs.llk.backToChal'), function () { startGame(false); }, true);
    } else {
      if (Arcade.shell) Arcade.shell.submitScore(score);
      var best = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest('llk') : null;
      showOverlay(T('gs.llk.winAllT'), stats + '<br>' + T('gs.llk.bestLbl').replace('{n}', best == null ? '----' : best),
        T('gs.llk.again'), function () { startGame(false); },
        T('gs.llk.changeMode'), function () { cycleMode(); }, true);
    }
    writeSave();
  }

  function failGame(reason) {
    if (wonGame || failed) return;
    failed = true;
    if (Arcade.juice) Arcade.juice.lose();
    if (Arcade.fx) Arcade.fx.shake(boardEl);
    var text = reason === 'timeout'
      ? T('gs.llk.failTimeoutD').replace('{s}', limitSec).replace('{n}', levelIdx)
      : T('gs.llk.failMovesD').replace('{n}', limitMoves).replace('{m}', levelIdx);
    showOverlay(T('gs.llk.failT'), text,
      T('gs.llk.retry'), function () { startGame(isDaily); },
      T('gs.llk.changeMode'), function () { cycleMode(); }, false);
    writeSave();
  }

  function cycleMode() {
    if (isDaily) { startGame(false); return; }
    applyMode((modeIdx + 1) % MODE_OPTS.length);
    if (modeSelect) modeSelect.value = String(modeIdx);
    if (Arcade.ui) Arcade.ui.toast(T('gs.llk.modeToast').replace('{m}', modeLabel()), 'ok');
    startGame(false);
  }

  document.getElementById('ll-hint').addEventListener('click', function () {
    if (!board || wonGame || failed || overlayOpen()) return;
    if (hints <= 0) {
      msgEl.textContent = T('gs.llk.hintNone');
      if (Arcade.ui) Arcade.ui.toast(T('gs.llk.hintNone'), 'warn');
      return;
    }
    var p = LLK_findPair(board);
    if (!p) { msgEl.textContent = T('gs.llk.msgNoPair'); return; }
    var path = LLK_findPath(board, p[0], p[1]) || { points: [p[0], p[1]] };
    hints--;
    penaltyMs += HINT_PENALTY_MS;
    levelPenaltyMs += HINT_PENALTY_MS;
    updateHudStatus();
    msgEl.textContent = T('gs.llk.msgHint').replace('{r1}', p[0][0] + 1).replace('{c1}', p[0][1] + 1)
      .replace('{r2}', p[1][0] + 1).replace('{c2}', p[1][1] + 1) +
      ' · ' + T('gs.llk.hintPenalty').replace('{n}', hints).replace('{s}', HINT_PENALTY_MS / 1000);
    flashPath(path.points, true);
    revealTile(p[0][0], p[0][1]);
    revealTile(p[1][0], p[1][1]);
    if (Arcade.audio) Arcade.audio.play('coin');
    writeSave();
  });

  document.getElementById('ll-shuffle').addEventListener('click', function () {
    if (!board || wonGame || failed || overlayOpen()) return;
    if (shuffles <= 0) { msgEl.textContent = T('gs.llk.msgShuffNone'); return; }
    var positions = [], values = [];
    for (var r = 0; r < R; r++) {
      for (var c = 0; c < C; c++) {
        if (board[r][c] !== 0) { positions.push([r, c]); values.push(board[r][c]); }
      }
    }
    var rnd = LLK_mulberry32((Date.now() % 2147483647) >>> 0);
    var found = false;
    for (var tryN = 0; tryN < 40; tryN++) {
      LLK_shuffle(values, rnd);
      for (var k = 0; k < positions.length; k++) board[positions[k][0]][positions[k][1]] = values[k];
      if (LLK_findPair(board)) { found = true; break; }
    }
    if (!found) {
      for (var k2 = 0; k2 < positions.length; k2++) board[positions[k2][0]][positions[k2][1]] = values[k2];
    }
    shuffles--;
    sel = null;
    if (Arcade.audio) Arcade.audio.play('clear');
    if (Arcade.fx) Arcade.fx.centerBurst('var(--neon-cyan)', 12);
    msgEl.textContent = found ? T('gs.llk.msgShuffOk') : T('gs.llk.msgShuffDead');
    paintBoard(true);
    revealTile(kbd.r, kbd.c);
    /* 发牌动画（缩放 0.7）期间 rect 偏小，动画结束后再校正一次 */
    setTimeout(function () { revealTile(kbd.r, kbd.c); }, 380);
    updateHudStatus();
    writeSave();
  });

  /* 模式选择 */
  MODE_OPTS.forEach(function (o, i) {
    var opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = T(o.labelKey).replace('{s}', String(o.sec || '')).replace('{n}', String(o.moves || ''));
    modeSelect.appendChild(opt);
  });
  modeSelect.value = '0';
  modeSelect.addEventListener('change', function () {
    if (isDaily) return;
    applyMode(Number(modeSelect.value));
    if (Arcade.audio) Arcade.audio.play('ui');
    startGame(false);
  });

  tabChal.addEventListener('click', function () {
    if (Arcade.audio) Arcade.audio.play('ui');
    startGame(false);
  });
  tabDaily.addEventListener('click', function () {
    if (Arcade.audio) Arcade.audio.play('ui');
    startGame(true);
  });

  /* 键盘：方向键移动选择 + 空格确认 */
  function moveKbd(dr, dc) {
    if (!board || wonGame || failed || overlayOpen()) return;
    var nr = kbd.r, nc = kbd.c;
    for (var guard = 0; guard < R * C; guard++) {
      nr = (nr + dr + R) % R;
      nc = (nc + dc + C) % C;
      if (board[nr][nc] !== 0) break;
    }
    kbd = { r: nr, c: nc };
    paintBoard(false);
    revealTile(kbd.r, kbd.c);
    if (Arcade.audio) Arcade.audio.play('move');
  }
  if (window.Arcade && Arcade.input) {
    Arcade.input.onKeys({
      up: function () { moveKbd(-1, 0); },
      down: function () { moveKbd(1, 0); },
      left: function () { moveKbd(0, -1); },
      right: function () { moveKbd(0, 1); },
      action: function () { clickTile(kbd.r, kbd.c); }
    });
  }

  /* ---------------- 存档 ---------------- */
  function writeSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
  }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'llk',
      collect: function () {
        if (!board || wonGame || failed) return null;
        return {
          v: 2, isDaily: !!isDaily, modeIdx: modeIdx, levelIdx: levelIdx,
          board: board.map(function (row) { return row.slice(); }),
          steps: steps, totalMs: totalMs, penaltyMs: penaltyMs,
          levelElapsed: Math.max(0, Date.now() - levelStart),
          levelPenaltyMs: levelPenaltyMs, levelSteps: levelSteps(),
          hints: hints, shuffles: shuffles
        };
      },
      apply: function (s) {
        if (!s || typeof s !== 'object') return false;
        var daily = !!s.isDaily;
        var mi = Number(s.modeIdx);
        applyMode(isFinite(mi) ? mi : 0);
        var li = Number(s.levelIdx);
        li = (isFinite(li) && li >= 0 && li < 3) ? Math.floor(li) : 0;
        var conf = LLK_CONF[li + 1];
        var snap = s.board;
        if (!Array.isArray(snap) || snap.length !== conf.rows) return false;
        var counts = {};
        for (var r = 0; r < conf.rows; r++) {
          if (!Array.isArray(snap[r]) || snap[r].length !== conf.cols) return false;
          for (var c = 0; c < conf.cols; c++) {
            var v = Number(snap[r][c]);
            if (!isFinite(v) || v < 0 || v > LLK_SYMBOLS.length) return false;
            if (v !== 0) counts[v] = (counts[v] || 0) + 1;
          }
        }
        for (var k in counts) if (counts[k] % 2 !== 0) return false;
        isDaily = daily;
        levelIdx = li;
        board = snap.map(function (row) { return row.map(function (v) { return Number(v); }); });
        R = conf.rows; C = conf.cols;
        solution = null;
        steps = Math.max(0, Number(s.steps) || 0);
        totalMs = Math.max(0, Number(s.totalMs) || 0);
        penaltyMs = Math.max(0, Number(s.penaltyMs) || 0);
        hints = (typeof s.hints === 'number' && s.hints >= 0) ? s.hints : HINTS_PER_RUN;
        shuffles = (typeof s.shuffles === 'number' && s.shuffles >= 0) ? s.shuffles : SHUFFLES_PER_RUN;
        levelPenaltyMs = Math.max(0, Number(s.levelPenaltyMs) || 0);
        stepsAtLevelStart = Math.max(0, steps - Math.max(0, Number(s.levelSteps) || 0));
        levelStart = Date.now() - Math.max(0, Number(s.levelElapsed) || 0);
        sel = null; wonGame = false; failed = false;
        kbd = { r: 0, c: 0 };
        tabChal.classList.toggle('selected', !daily);
        tabDaily.classList.toggle('selected', daily);
        modesEl.classList.toggle('hidden', daily);
        dailyEl.classList.toggle('hidden', !daily);
        modeSelect.value = String(modeIdx);
        modeSelect.disabled = daily;
        levEl.textContent = daily
          ? T('gs.llk.dailyLev').replace('{n}', levelIdx + 1).replace('{d}', (levelIdx === 0 ? '6×8' : levelIdx === 1 ? '8×8' : '9×8'))
          : T('gs.llk.chalLev').replace('{t}', LEVEL_INFO[levelIdx].t).replace('{n}', levelIdx + 1) + ' · ' + modeLabel();
        briefEl.textContent = daily ? T('gs.llk.dailyBrief') + LEVEL_INFO[levelIdx % 3].d
          : LEVEL_INFO[levelIdx].d + ' ' + T('gs.llk.scoreRule');
        paintBoard(false);
        updateHudStatus();
        updateDailyInfo();
        checkDeadlock();
        return true;
      }
    });
  }

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.llk.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    overlayEl.classList.add('hidden');
    startGame(isDaily);
  };

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.llk.tut1t'), d: T('gs.llk.tut1') },
    { t: T('gs.llk.tut2t'), d: T('gs.llk.tut2') },
    { t: T('gs.llk.tut3t'), d: T('gs.llk.tut3') },
    { t: T('gs.llk.tut4t'), d: T('gs.llk.tut4') }
  ];

  /* 启动 */
  timerEl.textContent = '0s';
  tick();
  timerTick = setInterval(tick, 250);
  if (window.Arcade && Arcade.savegame) {
    if (!Arcade.savegame.resume()) startGame(false);
  } else {
    startGame(false);
  }

  /* ---------------- QA 钩子（仅 ?qa=1 生效） ---------------- */
  if (/[?&]qa=1(?:&|$)/.test(location.search)) {
    function solveCurrentInternal() {
      if (!board || wonGame || failed) return false;
      if (!solution) return false;
      for (var i = 0; i < solution.length; i++) {
        var p = solution[i];
        if (board[p[0][0]][p[0][1]] !== 0 && board[p[1][0]][p[1][1]] !== 0) {
          board[p[0][0]][p[0][1]] = 0;
          board[p[1][0]][p[1][1]] = 0;
          steps++;
        }
      }
      paintBoard(false);
      updateHudStatus();
      if (remainingCount() === 0) { winLevel(); return true; }
      return false;
    }
    window.__QA = {
      state: function () {
        return {
          isDaily: isDaily, levelIdx: levelIdx, mode: mode, modeIdx: modeIdx,
          steps: steps, levelSteps: levelSteps(), limitMoves: limitMoves, limitSec: limitSec,
          hints: hints, shuffles: shuffles, totalMs: totalMs, penaltyMs: penaltyMs, levelPenaltyMs: levelPenaltyMs,
          remaining: remainingCount(), won: wonGame, failed: failed
        };
      },
      dims: function () { return { R: R, C: C }; },
      boardInfo: function () {
        var v = viewEl;
        var first = boardEl ? boardEl.querySelector('.ll-tile') : null;
        var rect = first ? first.getBoundingClientRect() : null;
        var toastBox = document.getElementById('arcade-toast');
        return {
          tile: tilePx,
          tileRectWidth: rect ? rect.width : 0,
          viewScrollWidth: v ? v.scrollWidth : 0,
          viewClientWidth: v ? v.clientWidth : 0,
          docScrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          toasts: toastBox ? toastBox.querySelectorAll('.toast-item').length : 0,
          overlayVisible: overlayOpen()
        };
      },
      tileBox: function (r, c) { return tileClient(r, c); },
      solutionLength: function () { return solution ? solution.length : 0; },
      findPair: function () { return board ? LLK_findPair(board) : null; },
      startLevelAt: function (n) {
        if (isDaily) return false;
        levelIdx = Math.max(0, Math.min(2, Number(n) || 0));
        startLevel();
        return true;
      },
      verifySolvable: function () {
        if (!board || !solution) return false;
        var test = board.map(function (row) { return row.slice(); });
        for (var i = 0; i < solution.length; i++) {
          var p = solution[i];
          if (!LLK_findPath(test, p[0], p[1])) return false;
          test[p[0][0]][p[0][1]] = 0;
          test[p[1][0]][p[1][1]] = 0;
        }
        for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (test[r][c] !== 0) return false;
        return true;
      },
      solveCurrent: function () { return solveCurrentInternal(); },
      runChallenge: function (mi) {
        applyMode(isFinite(Number(mi)) ? Number(mi) : 0);
        startGame(false);
        for (var i = 0; i < 3; i++) solveCurrentInternal();
        return {
          won: wonGame, steps: steps, totalMs: totalMs, penaltyMs: penaltyMs,
          score: Math.max(1, Math.round((totalMs + penaltyMs) / 1000)) + steps,
          best: Arcade.storage ? Arcade.storage.getBest('llk') : null
        };
      },
      runDaily: function () {
        startGame(true);
        for (var i = 0; i < 3; i++) solveCurrentInternal();
        return {
          won: wonGame, steps: steps, totalMs: totalMs, penaltyMs: penaltyMs,
          solved: Arcade.daily ? Arcade.daily.solvedTime('llk') : null,
          streak: Arcade.daily ? Arcade.daily.streak() : 0,
          best: Arcade.storage ? Arcade.storage.getBest('llk') : null
        };
      },
      forceFail: function (reason) {
        if (reason === 'moves') { applyMode(4); startGame(false); }
        else { applyMode(1); startGame(false); }
        failGame(reason === 'moves' ? 'moves' : 'timeout');
        return true;
      },
      setMode: function (mi) { applyMode(Number(mi) || 0); startGame(false); }
    };
  }
})();
