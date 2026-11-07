/* ============================================================
   纸牌接龙 KLONDIKE · 解码牌局（Windows 全球最流行纸牌）
   标准 Klondike：7 列红黑交替降序 / 4 基础堆 A→K 同花 / 抽牌堆。
   2026-11 旗舰版：新增 FreeCell 变体、提示按钮、自动收牌、
   独立提示通道（不随重绘清空）、键盘/拖拽、胜利粒子与收牌光效。
   把打乱的牌局重新整理成完整序列。
   核心逻辑用 ==KLON-CORE-START== / ==KLON-CORE-END== 标记包裹，供 Node harness 提取。
   ============================================================ */

(function () {
  /* ==KLON-CORE-START== */
  var K_SUITS = ['♠', '♥', '♦', '♣'];
  var K_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function K_mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function K_shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function K_color(s) { return (s === 0 || s === 3) ? 0 : 1; } // ♠♣ 黑 / ♥♦ 红

  /** 新建一局 Klondike：drawMode 1=单张翻 3=三张翻 */
  function K_newGame(seed, drawMode) {
    var rnd = K_mulberry32(seed || (Date.now() % 2147483647));
    var cards = [];
    for (var s = 0; s < 4; s++) for (var r = 0; r < 13; r++) cards.push({ v: r, s: s, up: false });
    K_shuffle(cards, rnd);
    var cols = [];
    var k = 0;
    for (var i = 0; i < 7; i++) {
      var col = [];
      for (var j = 0; j <= i; j++) {
        var c = cards[k++];
        c.up = (j === i);
        col.push(c);
      }
      cols.push(col);
    }
    return {
      variant: 'klondike',
      cols: cols,
      found: [[], [], [], []],
      stock: cards.slice(k),
      waste: [],
      drawMode: drawMode || 1,
      moves: 0, undosLeft: 3
    };
  }

  /** 列顶（up 的牌；返回 null 若全盖） */
  function K_colTop(st, i) {
    var col = st.cols[i];
    for (var j = col.length - 1; j >= 0; j--) if (col[j].up) return col[j];
    return null;
  }

  /** 从列顶开始连续 up 的牌数 */
  function K_upRun(st, i) {
    var col = st.cols[i], n = 0;
    for (var j = col.length - 1; j >= 0; j--) {
      if (!col[j].up) break;
      n++;
    }
    return n;
  }

  /** Klondike 列间移动合法性（取 from 列末尾 count 张到 to 列） */
  function K_canMoveCol(st, from, to, count) {
    if (from === to) return false;
    var fc = st.cols[from], tc = st.cols[to];
    if (count < 1 || count > fc.length) return false;
    var base = fc[fc.length - count];
    if (!base.up) return false;
    if (tc.length === 0) return base.v === 12; // 空列只能放 K
    var top = K_colTop(st, to);
    if (!top) return false;
    return top.v === base.v + 1 && K_color(top.s) !== K_color(base.s);
  }

  /** 执行 Klondike 列间移动 */
  function K_moveCol(st, from, to, count) {
    if (!K_canMoveCol(st, from, to, count)) return false;
    var moving = st.cols[from].splice(st.cols[from].length - count, count);
    st.cols[to] = st.cols[to].concat(moving);
    K_flipTop(st, from);
    st.moves++;
    return true;
  }

  /** 翻列顶盖牌 */
  function K_flipTop(st, i) {
    var col = st.cols[i];
    if (col.length && !col[col.length - 1].up) col[col.length - 1].up = true;
  }

  /** 列顶 → 基础堆 */
  function K_canToFound(st, i) {
    var top = K_colTop(st, i);
    if (!top) return false;
    var f = st.found[top.s];
    if (f.length === 0) return top.v === 0;
    return f[f.length - 1].v === top.v - 1;
  }
  function K_toFound(st, i) {
    if (!K_canToFound(st, i)) return false;
    var top = st.cols[i].pop();
    st.found[top.s].push(top);
    K_flipTop(st, i);
    st.moves++;
    return true;
  }

  /** 抽牌：stock → waste（按翻牌模式）；stock 空则回收 waste */
  function K_draw(st) {
    if (st.stock.length === 0) {
      while (st.waste.length) st.stock.push(st.waste.pop());
      return 'recycle';
    }
    var n = st.drawMode;
    for (var i = 0; i < n && st.stock.length; i++) {
      var c = st.stock.pop();
      c.up = true; // 抽到 waste 的牌必为正面，避免后续入列时仍被当作盖牌
      st.waste.push(c);
    }
    return 'draw';
  }

  /** waste 顶 → 列 */
  function K_canWasteToCol(st, to) {
    if (!st.waste.length) return false;
    var base = st.waste[st.waste.length - 1];
    var tc = st.cols[to];
    if (tc.length === 0) return base.v === 12;
    var top = K_colTop(st, to);
    if (!top) return false;
    return top.v === base.v + 1 && K_color(top.s) !== K_color(base.s);
  }
  function K_moveWasteToCol(st, to) {
    if (!K_canWasteToCol(st, to)) return false;
    var top = st.waste.pop();
    top.up = true; // 入列的牌必为正面（兼容旧存档里 waste 的 up=false）
    st.cols[to].push(top);
    st.moves++;
    return true;
  }

  /** waste 顶 → 基础堆 */
  function K_canWasteToFound(st) {
    if (!st.waste.length) return false;
    var top = st.waste[st.waste.length - 1];
    var f = st.found[top.s];
    if (f.length === 0) return top.v === 0;
    return f[f.length - 1].v === top.v - 1;
  }
  function K_wasteToFound(st) {
    if (!K_canWasteToFound(st)) return false;
    var top = st.waste.pop();
    st.found[top.s].push(top);
    st.moves++;
    return true;
  }

  /** 胜利判定 */
  function K_won(st) {
    for (var s = 0; s < 4; s++) if (st.found[s].length !== 13) return false;
    return true;
  }

  /* ---------------- FreeCell 核心 ---------------- */

  /** 新建 FreeCell：52 张全明牌，轮流发入 8 列（前 4 列各 7 张） */
  function K_newFreeCell(seed) {
    var rnd = K_mulberry32(seed || (Date.now() % 2147483647));
    var cards = [];
    for (var s = 0; s < 4; s++) for (var r = 0; r < 13; r++) cards.push({ v: r, s: s, up: true });
    K_shuffle(cards, rnd);
    var cols = [[], [], [], [], [], [], [], []];
    for (var i = 0; i < 52; i++) cols[i % 8].push(cards[i]);
    return {
      variant: 'freecell',
      cols: cols,
      found: [[], [], [], []],
      free: [[], [], [], []],
      moves: 0,
      undosLeft: -1
    };
  }

  /** 从 idx 起向下的合法连续序列长度（降序 + 红黑交替；至少 1） */
  function K_fcSeqLen(st, ci, idx) {
    var col = st.cols[ci];
    if (!col || idx < 0 || idx >= col.length) return 0;
    for (var j = idx + 1; j < col.length; j++) {
      if (col[j].v !== col[j - 1].v - 1 || K_color(col[j].s) === K_color(col[j - 1].s)) {
        return j - idx;
      }
    }
    return col.length - idx;
  }

  function K_fcEmptyFree(st) {
    var n = 0;
    for (var i = 0; i < 4; i++) if (st.free[i].length === 0) n++;
    return n;
  }
  function K_fcEmptyCols(st) {
    var n = 0;
    for (var i = 0; i < st.cols.length; i++) if (st.cols[i].length === 0) n++;
    return n;
  }
  /** 超级移动容量：(空闲空位+1) × 2^(空闲列-目标占用的空列) */
  function K_fcCapacity(st, toEmpty) {
    var ec = K_fcEmptyCols(st);
    if (toEmpty) ec = Math.max(0, ec - 1);
    return (K_fcEmptyFree(st) + 1) * Math.pow(2, ec);
  }

  function K_fcCanColToCol(st, from, idx, to) {
    if (from === to) return false;
    var col = st.cols[from];
    if (!col || idx < 0 || idx >= col.length) return false;
    var count = col.length - idx;
    if (K_fcSeqLen(st, from, idx) !== count) return false;
    var base = col[idx];
    var tc = st.cols[to];
    if (tc.length === 0) return count <= K_fcCapacity(st, true);
    var top = K_colTop(st, to);
    if (!top) return false;
    if (top.v !== base.v + 1 || K_color(top.s) === K_color(base.s)) return false;
    return count <= K_fcCapacity(st, false);
  }

  function K_fcMoveColToCol(st, from, idx, to) {
    if (!K_fcCanColToCol(st, from, idx, to)) return false;
    var moving = st.cols[from].splice(idx);
    st.cols[to] = st.cols[to].concat(moving);
    st.moves++;
    return true;
  }

  /** 返回可用的空位索引；无则 -1 */
  function K_fcFreeSlotFor(st) {
    for (var i = 0; i < 4; i++) if (st.free[i].length === 0) return i;
    return -1;
  }
  function K_fcColToFree(st, ci, fi) {
    if (!st.cols[ci].length || st.free[fi].length) return false;
    var c = st.cols[ci].pop();
    c.up = true;
    st.free[fi].push(c);
    st.moves++;
    return true;
  }
  function K_fcCanFreeToCol(st, fi, to) {
    var f = st.free[fi];
    if (!f.length || fi < 0 || fi > 3) return false;
    var base = f[0], tc = st.cols[to];
    if (tc.length === 0) return true;
    var top = K_colTop(st, to);
    if (!top) return false;
    return top.v === base.v + 1 && K_color(top.s) !== K_color(base.s);
  }
  function K_fcFreeToCol(st, fi, to) {
    if (!K_fcCanFreeToCol(st, fi, to)) return false;
    var c = st.free[fi].pop();
    st.cols[to].push(c);
    st.moves++;
    return true;
  }
  function K_fcCanFreeToFound(st, fi) {
    var f = st.free[fi];
    if (!f.length) return false;
    var c = f[0], pile = st.found[c.s];
    if (pile.length === 0) return c.v === 0;
    return pile[pile.length - 1].v === c.v - 1;
  }
  function K_fcFreeToFound(st, fi) {
    if (!K_fcCanFreeToFound(st, fi)) return false;
    var c = st.free[fi].pop();
    st.found[c.s].push(c);
    st.moves++;
    return true;
  }

  /* ============================================================
     每日一题：构造式必胜牌局（标准 7 列 + 24 张发牌堆）
     设计：轮转顺序 A♠A♥A♦A♣ 2♠2♥2♦2♣ 3♠…K♣；
     列顶 = 前 7 张（四 A + 2♠2♥2♦），列隐藏牌按揭示链编排（揭示即下一张可入基础），
     发牌堆 = 后 24 张反序（draw-3 抽出的 waste 顶依序可入基础）。
     全程只需「列顶/废牌顶 → 基础堆」，无需列间移动，必胜性已由独立贪心验证。
     花色按种子置换，保证每天牌面不同且全部可解。
     ============================================================ */
  function K_buildSolvableDeal(seed) {
    var perm = [0, 1, 2, 3];
    var rnd = K_mulberry32(seed || 1);
    for (var i = 3; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    function P(s) { return perm[s]; }
    var O = [];
    for (var v = 0; v < 13; v++) for (var s = 0; s < 4; s++) O.push({ v: v, s: P(s) });
    var cols = [], hid = 0, hiddenByCol = [0, 1, 2, 3, 4, 5, 6];
    for (var ci = 0; ci < 7; ci++) {
      var col = [];
      var nHidden = hiddenByCol[ci];
      for (var k = nHidden - 1; k >= 0; k--) col.push({ v: O[7 + hid + k].v, s: O[7 + hid + k].s, up: false });
      hid += nHidden;
      col.push({ v: O[ci].v, s: O[ci].s, up: true });
      cols.push(col);
    }
    var stock = [];
    for (var k2 = 51; k2 >= 28; k2--) stock.push({ v: O[k2].v, s: O[k2].s, up: false });
    return { variant: 'klondike', cols: cols, found: [[], [], [], []], stock: stock, waste: [], drawMode: 3, moves: 0, undosLeft: 0 };
  }
  /* ==KLON-CORE-END== */

  /* ================= UI 层 ================= */
  var root = document.getElementById('game-root');
  if (!root) return;

  var DIFF_INFO = [
    { t: T('gs.klondike.diffEasy'), d: T('gs.klondike.diffEasyD') },
    { t: T('gs.klondike.diffNormal'), d: T('gs.klondike.diffNormalD') },
    { t: T('gs.klondike.diffHard'), d: T('gs.klondike.diffHardD') }
  ];
  var DIFF_ICONS = ['♠', '♥', '♣'];

  var SVG_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>';
  var SVG_TROPHY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z"></path><path d="M7 6H4v2a3 3 0 0 0 3 3"></path><path d="M17 6h3v2a3 3 0 0 1-3 3"></path><path d="M12 14v3"></path><path d="M8 20h8"></path><path d="M10 17h4"></path></svg>';

  root.innerHTML =
    '<div class="kl-wrap">' +
    '  <div class="kl-pick hidden" id="kl-pick">' +
    '    <div class="kl-pick-t">' + T('gs.klondike.pickT') + '</div>' +
    '    <div class="kl-pick-d">' + T('gs.klondike.pickD') + '</div>' +
    '    <div class="kl-vswitch" role="tablist">' +
    '      <button class="kl-vtab on" id="kl-v-klondike" data-v="klondike" role="tab" aria-selected="true" type="button">' + T('gs.klondike.varKlondike') + '</button>' +
    '      <button class="kl-vtab" id="kl-v-freecell" data-v="freecell" role="tab" aria-selected="false" type="button">' + T('gs.klondike.varFreecell') + '</button>' +
    '    </div>' +
    '    <div id="kl-pick-klondike">' +
    '      <div class="kl-diff-grid">' +
    DIFF_INFO.map(function (d, i) {
      return '<button class="kl-diff" data-i="' + i + '" type="button">' +
        '<span class="kl-diff-ic' + (i === 1 ? ' red' : '') + '">' + DIFF_ICONS[i] + '</span>' +
        '<span class="kl-diff-name">' + d.t + '</span>' +
        '<span class="kl-diff-d">' + d.d + '</span>' +
        '</button>';
    }).join('') +
    '      </div>' +
    '      <button class="kl-daily" id="kl-pick-daily" type="button">' + T('gs.klondike.pickDaily') + '</button>' +
    '      <div class="kl-daily-state" id="kl-daily-state"></div>' +
    '    </div>' +
    '    <div id="kl-pick-freecell" class="hidden">' +
    '      <div class="kl-fc-desc">' + T('gs.klondike.fcDesc') + '</div>' +
    '      <button class="btn green kl-fc-start" id="kl-fc-start" type="button">' + T('gs.klondike.fcStart') + '</button>' +
    '    </div>' +
    '    <div class="kl-pick-best" id="kl-pick-best"></div>' +
    '  </div>' +
    '  <div class="kl-game hidden" id="kl-game">' +
    '    <div class="kl-hud">' +
    '      <span class="kl-chip" id="kl-lev"></span>' +
    '      <span class="kl-chip kl-chip-time"><span class="kl-chip-ic">' + SVG_CLOCK + '</span><b id="kl-timer">0:00</b></span>' +
    '      <span class="kl-chip"><span class="kl-chip-ic">' + SVG_TROPHY + '</span><b id="kl-best">—</b></span>' +
    '    </div>' +
    '    <div class="kl-board" id="kl-board">' +
    '      <div class="kl-top" id="kl-top">' +
    '        <div class="kl-stock" id="kl-stock"></div>' +
    '        <div class="kl-found" id="kl-found"></div>' +
    '      </div>' +
    '      <div class="kl-cols-wrap" id="kl-cols-wrap"><div class="kl-cols" id="kl-cols"></div></div>' +
    '    </div>' +
    '    <div class="kl-status">' +
    '      <span class="kl-stat">' + T('gs.klondike.statusMoves') + ' <b id="kl-moves">0</b></span>' +
    '      <span class="kl-stat">' + T('gs.klondike.statusUndo') + ' <b id="kl-undo">0</b> <span id="kl-undo-unit">' + T('gs.klondike.undoUnit') + '</span></span>' +
    '    </div>' +
    '    <div class="kl-actions">' +
    '      <button class="btn kl-mini" id="kl-hint-btn" type="button">' + T('gs.klondike.hintBtn') + '</button>' +
    '      <button class="btn kl-mini kl-toggle" id="kl-auto" type="button" aria-pressed="false"><span class="kl-sw" aria-hidden="true"></span><span>' + T('gs.klondike.autoBtn') + '</span></button>' +
    '      <button class="btn kl-mini" id="kl-undo-btn" type="button">' + T('gs.klondike.undoBtn') + '</button>' +
    '      <button class="btn kl-mini" id="kl-new" type="button">' + T('gs.klondike.newBtn') + '</button>' +
    '      <button class="btn kl-mini" id="kl-back" type="button">' + T('gs.klondike.backPick') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="kl-overlay hidden" id="kl-overlay">' +
    '    <div class="kl-ov-card">' +
    '      <div class="kl-ov-badge" id="kl-ov-badge"></div>' +
    '      <h2 id="kl-ov-title"></h2>' +
    '      <p id="kl-ov-text"></p>' +
    '      <div class="kl-ov-stats">' +
    '        <div><span>' + T('gs.klondike.timeLbl') + '</span><b id="kl-ov-time">0s</b></div>' +
    '        <div><span>' + T('gs.klondike.statusMoves') + '</span><b id="kl-ov-moves">0</b></div>' +
    '        <div><span>' + T('gs.klondike.bestLbl') + '</span><b id="kl-ov-best">—</b></div>' +
    '      </div>' +
    '      <div class="kl-ov-btns">' +
    '        <button class="btn green" id="kl-ov-again" type="button">' + T('gs.klondike.again') + '</button>' +
    '        <button class="btn purple" id="kl-ov-pick" type="button">' + T('gs.klondike.pickDiff') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="kl-tip" id="kl-tip" role="status" aria-live="assertive"></div>' +
    '</div>';

  var wrapEl = root.querySelector('.kl-wrap');
  var pickEl = document.getElementById('kl-pick');
  var gameEl = document.getElementById('kl-game');
  var levEl = document.getElementById('kl-lev');
  var timerEl = document.getElementById('kl-timer');
  var bestChipEl = document.getElementById('kl-best');
  var foundEl = document.getElementById('kl-found');
  var stockEl = document.getElementById('kl-stock');
  var colsEl = document.getElementById('kl-cols');
  var colsWrapEl = document.getElementById('kl-cols-wrap');
  var topEl = document.getElementById('kl-top');
  var movesEl = document.getElementById('kl-moves');
  var undoEl = document.getElementById('kl-undo');
  var undoUnitEl = document.getElementById('kl-undo-unit');
  var undoBtn = document.getElementById('kl-undo-btn');
  var hintBtn = document.getElementById('kl-hint-btn');
  var autoBtn = document.getElementById('kl-auto');
  var tipEl = document.getElementById('kl-tip');
  var boardEl = document.getElementById('kl-board');
  var overlayEl = document.getElementById('kl-overlay');
  var ovBadge = document.getElementById('kl-ov-badge');
  var ovTitle = document.getElementById('kl-ov-title');
  var ovText = document.getElementById('kl-ov-text');
  var ovTime = document.getElementById('kl-ov-time');
  var ovMoves = document.getElementById('kl-ov-moves');
  var ovBest = document.getElementById('kl-ov-best');
  var pickDailyBtn = document.getElementById('kl-pick-daily');
  var dailyStateEl = document.getElementById('kl-daily-state');
  var pickBestEl = document.getElementById('kl-pick-best');
  var pickKlondikeEl = document.getElementById('kl-pick-klondike');
  var pickFreecellEl = document.getElementById('kl-pick-freecell');
  var fcStartBtn = document.getElementById('kl-fc-start');
  var vtabEls = [document.getElementById('kl-v-klondike'), document.getElementById('kl-v-freecell')];

  var st = null;
  var sel = null; // { kind:'col'|'waste'|'free', col, idx, count, free }
  var history = [];
  var isDaily = false;
  var curDiff = 1;
  var variant = 'klondike';
  var pickVariant = 'klondike';
  var chalStart = 0, totalMs = 0, timerTick = null, clockRunning = false;
  var ended = false;
  var tipTimer = null, dealTimer = null, resizeTimer = null;
  var kbCol = 0, kbIdx = -1, kbZone = 'cols', kbFree = 0, kbSuit = 0;
  var autoOn = false, autoTimer = null, autoRunId = 0;
  var hintPulse = null, hintTimer = null;
  var suppressClickUntil = 0;

  var BEST_ID = (window.Arcade && Arcade.shell && Arcade.shell.gameId) || 'klondike';
  var FC_BEST_ID = 'klondike_freecell';

  function cardTxt(c) { return K_RANKS[c.v] + K_SUITS[c.s]; }
  function cardKey(c) { return K_SUITS[c.s] + '_' + c.v; }
  function todaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function totalSec() { return Math.max(1, Math.floor(totalMs / 1000)); }
  function elapsedMs() { return totalMs + (clockRunning ? Date.now() - chalStart : 0); }
  function formatClock(ms) {
    if (window.GK && typeof GK.fmtTime === 'function') return GK.fmtTime(ms);
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function fmtBest(v) {
    return (v === null || v === undefined || isNaN(Number(v))) ? '—' : Math.round(Number(v)) + 's';
  }
  function bestKeyFor(v) { return v === 'freecell' ? FC_BEST_ID : BEST_ID; }
  function bestValFor(v) {
    try { return Arcade.storage.getBest(bestKeyFor(v)); } catch (e) { return null; }
  }
  function bestVal() { return bestValFor(variant); }
  function topUpIndex(ci) {
    var col = st.cols[ci];
    for (var j = col.length - 1; j >= 0; j--) if (col[j].up) return j;
    return -1;
  }
  function dealOrderFor(ci, idx) {
    return 7 * idx - (idx * (idx - 1)) / 2 + (ci - idx);
  }
  function pushHistory() { history.push(JSON.stringify(st)); }

  /* ---------- 存档（兼容旧字段：st/history/isDaily/totalMs/diffIdx/day） ---------- */
  var saveVariant = 'klondike', saveRegistered = false;
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }

  function collectSave() {
    if (!st || K_won(st)) return null;
    return {
      v: 2,
      variant: variant,
      st: st,
      history: history,
      isDaily: isDaily,
      totalMs: elapsedMs(),
      diffIdx: curDiff,
      day: (window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : ''
    };
  }

  function applySave(s) {
    if (!s || !s.st) return false;
    var v = s.variant || s.st.variant ||
      ((Array.isArray(s.st.cols) && s.st.cols.length === 8) ? 'freecell' : 'klondike');
    if (v === 'freecell') {
      if (!Array.isArray(s.st.cols) || s.st.cols.length !== 8) return false;
      if (!Array.isArray(s.st.free) || s.st.free.length !== 4) return false;
    } else {
      v = 'klondike';
      if (!Array.isArray(s.st.cols) || s.st.cols.length !== 7) return false;
      if (!Array.isArray(s.st.stock) || !Array.isArray(s.st.waste)) return false;
    }
    if (s.isDaily && s.day !== ((window.Arcade && Arcade.daily) ? Arcade.daily.dayStr() : '')) return false;
    stopClock();
    if (dealTimer) { clearTimeout(dealTimer); dealTimer = null; }
    cancelAutoRun();
    autoOn = false;
    clearHint(false);
    st = s.st;
    variant = v;
    st.variant = v;
    if (v === 'freecell') {
      st.undosLeft = -1;
      for (var fi = 0; fi < 4; fi++) if (!Array.isArray(st.free[fi])) st.free[fi] = [];
      for (var ci = 0; ci < 8; ci++) {
        if (!Array.isArray(st.cols[ci])) return false;
        for (var cj = 0; cj < st.cols[ci].length; cj++) st.cols[ci][cj].up = true;
      }
    } else {
      st.drawMode = st.drawMode === 3 ? 3 : 1;
      st.moves = typeof st.moves === 'number' ? st.moves : 0;
      st.undosLeft = typeof st.undosLeft === 'number' ? st.undosLeft : 0;
      for (var fs = 0; fs < 4; fs++) if (!Array.isArray(st.found[fs])) st.found[fs] = [];
    }
    if (!Array.isArray(st.found) || st.found.length !== 4) return false;
    st.moves = typeof st.moves === 'number' ? st.moves : 0;
    history = Array.isArray(s.history) ? s.history : [];
    isDaily = !!s.isDaily;
    curDiff = typeof s.diffIdx === 'number' ? s.diffIdx : 1;
    totalMs = typeof s.totalMs === 'number' ? s.totalMs : 0;
    ended = false;
    sel = null;
    kbCol = 0;
    kbIdx = -1;
    kbZone = 'cols';
    pickVariant = v;
    setupSave(v);
    pickEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    overlayEl.classList.add('hidden');
    boardEl.classList.remove('kl-won');
    updateLevelLabel();
    updateBestUI();
    updatePickInfo();
    updateAutoBtn();
    paintAll();
    startClock();
    return true;
  }

  function setupSave(v) {
    if (saveVariant === v && saveRegistered) return;
    saveVariant = v;
    saveRegistered = true;
    if (window.Arcade && Arcade.savegame) {
      Arcade.savegame.setup({ id: v === 'freecell' ? 'freecell' : 'klondike', collect: collectSave, apply: applySave });
    }
  }

  /* ---------- 计时 ---------- */
  function updateTimerUI() {
    timerEl.textContent = formatClock(st ? elapsedMs() : 0);
  }
  function startClock() {
    if (clockRunning) return;
    clockRunning = true;
    chalStart = Date.now();
    if (timerTick) clearInterval(timerTick);
    timerTick = setInterval(updateTimerUI, 250);
    updateTimerUI();
  }
  function stopClock() {
    if (clockRunning) {
      totalMs += Date.now() - chalStart;
      clockRunning = false;
    }
    chalStart = 0;
    if (timerTick) { clearInterval(timerTick); timerTick = null; }
    updateTimerUI();
  }
  function resetClock() {
    stopClock();
    totalMs = 0;
    updateTimerUI();
  }

  /* ---------- 独立提示通道：paintAll / clearMsg / 动画帧都不会清空 ---------- */
  function tip(text, type, ms) {
    if (!tipEl) return;
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    tipEl.textContent = text;
    tipEl.className = 'kl-tip show' + (type ? ' ' + type : '');
    var dur = Math.max(1600, ms || 2000);
    tipTimer = setTimeout(function () {
      tipTimer = null;
      tipEl.textContent = '';
      tipEl.className = 'kl-tip';
    }, dur);
  }
  function invalid(key) {
    sel = null;
    clearHint(false);
    paintAll();
    tip(T(key), 'warn', 2200);
    if (Arcade.audio) Arcade.audio.play('error');
    if (Arcade.fx) Arcade.fx.shake(boardEl);
  }

  /* ---------- 牌面几何 ---------- */
  function layoutBoard() {
    var n = variant === 'freecell' ? 8 : 7;
    var avail = (colsWrapEl && colsWrapEl.clientWidth) || colsEl.clientWidth || wrapEl.clientWidth || 700;
    var gap = avail < 430 ? 4 : 8;
    var colW = Math.floor((avail - gap * (n - 1)) / n);
    var minColW = variant === 'freecell' ? 46 : 44; // FreeCell 8 列多留 2px 余量，确保 dpr/取整后仍 ≥44px
    if (colW < minColW) colW = minColW; // 窄屏下 7/8 列均保证 ≥44px 命中区（超出时容器内横向滚动）
    if (colW > 92) colW = 92;
    var ch = Math.round(colW * 1.42);
    var up = Math.max(12, Math.round(ch * 0.235));
    var down = Math.max(8, Math.round(ch * 0.155));
    wrapEl.style.setProperty('--kl-cw', colW + 'px');
    wrapEl.style.setProperty('--kl-ch', ch + 'px');
    wrapEl.style.setProperty('--kl-up', up + 'px');
    wrapEl.style.setProperty('--kl-down', down + 'px');
    wrapEl.style.setProperty('--kl-gap', gap + 'px');
    wrapEl.style.setProperty('--kl-ncols', n);
    return { w: colW, h: ch, up: up, down: down, gap: gap, n: n };
  }

  function makeCard(c, opts) {
    opts = opts || {};
    var card = document.createElement('div');
    card.className = 'kl-card ' + (opts.up ? 'up' : 'down') +
      (K_color(c.s) === 1 ? ' red' : '') + (opts.cls ? ' ' + opts.cls : '');
    card.dataset.key = cardKey(c);
    card.setAttribute('aria-label', opts.up ? (K_RANKS[c.v] + ' ' + K_SUITS[c.s]) : T('gs.klondike.hiddenCard'));
    var inner = document.createElement('div');
    inner.className = 'kl-card-in';
    var front = document.createElement('div');
    front.className = 'kl-face kl-front';
    front.innerHTML =
      '<span class="kl-corner tl"><span class="kl-rank">' + K_RANKS[c.v] + '</span><span class="kl-suit">' + K_SUITS[c.s] + '</span></span>' +
      '<span class="kl-pip">' + K_SUITS[c.s] + '</span>' +
      '<span class="kl-corner br"><span class="kl-rank">' + K_RANKS[c.v] + '</span><span class="kl-suit">' + K_SUITS[c.s] + '</span></span>';
    var back = document.createElement('div');
    back.className = 'kl-face kl-back';
    back.innerHTML = '<span class="kl-back-pattern"></span>';
    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    if (opts.top !== undefined) card.style.top = opts.top + 'px';
    if (opts.deal !== undefined) {
      card.classList.add('deal');
      card.style.setProperty('--deal-i', opts.deal);
    }
    return card;
  }

  function bindCard(card, info) {
    card.addEventListener('click', function () {
      if (Date.now() < suppressClickUntil) return;
      if (info.kind === 'col') clickColCard(info.col, info.idx);
      else if (info.kind === 'waste') clickWaste();
      else if (info.kind === 'free') clickFree(info.free);
    });
    card.addEventListener('pointerdown', function (e) { startDrag(e, info, card); });
  }

  /* ---------- 选中目标判定 ---------- */
  function canFoundTarget(s) {
    if (!sel) return false;
    if (sel.kind === 'col') {
      if (sel.count !== 1) return false;
      var col = st.cols[sel.col];
      var top = col[col.length - 1];
      return !!top && top.s === s && K_canToFound(st, sel.col);
    }
    if (sel.kind === 'waste') {
      var w = st.waste[st.waste.length - 1];
      return !!w && w.s === s && K_canWasteToFound(st);
    }
    if (sel.kind === 'free') {
      var fc = st.free[sel.free] && st.free[sel.free][0];
      return !!fc && fc.s === s && K_fcCanFreeToFound(st, sel.free);
    }
    return false;
  }
  function isColDropTarget(ci) {
    if (!sel) return false;
    if (sel.kind === 'col') {
      return variant === 'freecell'
        ? K_fcCanColToCol(st, sel.col, sel.idx, ci)
        : (sel.col !== ci && K_canMoveCol(st, sel.col, ci, sel.count));
    }
    if (sel.kind === 'waste') return K_canWasteToCol(st, ci);
    if (sel.kind === 'free') return K_fcCanFreeToCol(st, sel.free, ci);
    return false;
  }

  /* ---------- 绘制 ---------- */
  function paintAll(opts) {
    opts = opts || {};
    if (!st) return;
    paintTop();
    paintFound();
    paintCols(opts);
    movesEl.textContent = st.moves;
    undoEl.textContent = variant === 'freecell' ? T('gs.klondike.undoInf') : st.undosLeft;
    if (undoUnitEl) undoUnitEl.textContent = variant === 'freecell' ? '' : T('gs.klondike.undoUnit');
    updateUndoBtn();
    updateAutoBtn();
    updateBestUI();
    if (opts.oldRects) applyMoveAnimation(opts.oldRects);
  }

  function paintTop() {
    stockEl.innerHTML = '';
    if (variant === 'freecell') { paintFreeCells(); return; }

    var stockSlot = document.createElement('div');
    stockSlot.className = 'kl-slot kl-stock-slot' +
      (kbZone === 'stock' ? ' kb' : '') +
      (hintPulse && (hintPulse.srcKind === 'stock' || hintPulse.srcKind === 'draw' || hintPulse.srcKind === 'recycle') ? ' kl-hint' : '');
    stockSlot.dataset.drop = 'stock';
    stockSlot.setAttribute('role', 'button');
    if (st.stock.length) {
      stockSlot.classList.add('clickable');
      stockSlot.title = T('gs.klondike.stockTitle').replace('{n}', st.stock.length);
      stockSlot.appendChild(makeCard(st.stock[st.stock.length - 1], { up: false }));
      var badge = document.createElement('span');
      badge.className = 'kl-count';
      badge.textContent = st.stock.length;
      stockSlot.appendChild(badge);
    } else if (st.waste.length) {
      stockSlot.classList.add('clickable', 'recycle');
      stockSlot.title = T('gs.klondike.recycleTitle');
      stockSlot.innerHTML = '<span class="kl-recycle">↻</span>';
    } else {
      stockSlot.classList.add('empty', 'clickable');
      stockSlot.title = T('gs.klondike.msgStockEmpty');
    }
    stockSlot.addEventListener('click', function () {
      if (Date.now() < suppressClickUntil) return;
      drawStock();
    });
    stockEl.appendChild(stockSlot);

    var wasteSlot = document.createElement('div');
    wasteSlot.className = 'kl-slot kl-waste-slot' + (st.waste.length ? '' : ' empty');
    wasteSlot.dataset.drop = 'stock';
    wasteSlot.setAttribute('role', 'button');
    if (st.waste.length) {
      var fanCount = Math.min(st.drawMode || 1, st.waste.length);
      var start = st.waste.length - fanCount;
      for (var k = start; k < st.waste.length; k++) {
        var isTop = k === st.waste.length - 1;
        var card = makeCard(st.waste[k], {
          up: true,
          cls: 'waste-card' + (isTop ? ' top' : '') + (isTop && sel && sel.kind === 'waste' ? ' sel' : '') +
            (isTop && hintPulse && hintPulse.srcKind === 'waste' ? ' kl-hint' : '') + (isTop ? ' clickable' : ' fan-behind')
        });
        card.style.setProperty('--fan', k - start);
        if (isTop) bindCard(card, { kind: 'waste' });
        wasteSlot.appendChild(card);
      }
    }
    stockEl.appendChild(wasteSlot);
  }

  function paintFreeCells() {
    for (var i = 0; i < 4; i++) {
      (function (fi) {
        var cell = st.free[fi] || [];
        var slot = document.createElement('div');
        slot.className = 'kl-slot kl-free-slot clickable' +
          (cell.length ? ' has' : '') + (kbZone === 'free' && kbFree === fi ? ' kb' : '') +
          (hintPulse && ((hintPulse.dstKind === 'free' && hintPulse.dstFree === fi) ||
            (hintPulse.srcKind === 'free' && hintPulse.srcFree === fi)) ? ' kl-hint' : '');
        slot.dataset.drop = 'free';
        slot.dataset.free = fi;
        slot.setAttribute('role', 'button');
        slot.setAttribute('aria-label', T('gs.klondike.freeCellName') + ' ' + (fi + 1) + (cell.length ? ' ' + cardTxt(cell[0]) : ''));
        if (cell.length) {
          var card = makeCard(cell[0], { up: true, cls: (sel && sel.kind === 'free' && sel.free === fi ? 'sel' : '') });
          bindCard(card, { kind: 'free', free: fi });
          slot.appendChild(card);
        } else {
          slot.innerHTML = '<span class="kl-slot-watermark">+</span>';
        }
        slot.addEventListener('click', function () {
          if (Date.now() < suppressClickUntil) return;
          clickFree(fi);
        });
        stockEl.appendChild(slot);
      })(i);
    }
  }

  function paintFound() {
    foundEl.innerHTML = '';
    for (var s = 0; s < 4; s++) {
      (function (suit) {
        var f = st.found[suit];
        var slot = document.createElement('div');
        slot.className = 'kl-slot kl-found-slot clickable' + (f.length ? ' has' : '') +
          (canFoundTarget(suit) ? ' drop' : '') +
          (kbZone === 'found' && kbSuit === suit ? ' kb' : '') +
          (hintPulse && hintPulse.dstKind === 'found' && hintPulse.dstSuit === suit ? ' kl-hint' : '');
        slot.dataset.drop = 'found';
        slot.dataset.suit = suit;
        slot.setAttribute('role', 'button');
        slot.setAttribute('aria-label', K_SUITS[suit] + ' ' + T('gs.klondike.foundName') + ' ' + f.length + '/13');
        if (f.length) {
          slot.appendChild(makeCard(f[f.length - 1], { up: true, cls: 'found-card' }));
          var cnt = document.createElement('span');
          cnt.className = 'kl-count';
          cnt.textContent = f.length;
          slot.appendChild(cnt);
        } else {
          slot.innerHTML = '<span class="kl-slot-watermark">' + K_SUITS[suit] + '</span>';
        }
        slot.addEventListener('click', function () {
          if (Date.now() < suppressClickUntil) return;
          clickFound(suit);
        });
        foundEl.appendChild(slot);
      })(s);
    }
  }

  function paintCols(opts) {
    var dims = layoutBoard();
    colsEl.innerHTML = '';
    if (!st) return;
    var n = dims.n;
    if (kbCol < 0 || kbCol >= n) kbCol = 0;
    if (!st.cols[kbCol].length) kbIdx = -1;
    else if (kbIdx < 0 || kbIdx >= st.cols[kbCol].length || !st.cols[kbCol][kbIdx] || !st.cols[kbCol][kbIdx].up) {
      kbIdx = topUpIndex(kbCol);
    }

    for (var ci = 0; ci < n; ci++) {
      (function (i) {
        var col = st.cols[i];
        var div = document.createElement('div');
        div.className = 'kl-col' + (col.length ? '' : ' empty') + (variant === 'freecell' ? ' fc' : '') +
          (kbZone === 'cols' && i === kbCol ? ' kb' : '') +
          (isColDropTarget(i) ? ' drop' : '') +
          (hintPulse && hintPulse.dstKind === 'col' && hintPulse.dstCol === i ? ' kl-hint' : '');
        div.dataset.drop = 'col';
        div.dataset.col = i;
        var topPos = 0;
        var height = dims.h;
        for (var j = 0; j < col.length; j++) {
          (function (c, idx, cardTop) {
            var isTop = idx === col.length - 1 && c.up;
            var inSel = sel && sel.kind === 'col' && sel.col === i && idx >= col.length - sel.count;
            var inHint = hintPulse && hintPulse.srcKind === 'col' && hintPulse.srcCol === i &&
              idx >= col.length - hintPulse.srcCount;
            var classes = [];
            if (isTop) classes.push('top');
            if (inSel) classes.push('sel');
            if (inHint) classes.push('kl-hint');
            if (kbZone === 'cols' && i === kbCol && idx === kbIdx) classes.push('kb');
            if (c.up || sel) classes.push('clickable');
            if (opts.flipKey && c.up && cardKey(c) === opts.flipKey) classes.push('flip-in');
            var deal = opts.deal ? (variant === 'freecell' ? (idx * n + i) : dealOrderFor(i, idx)) : undefined;
            var card = makeCard(c, {
              up: c.up,
              top: cardTop,
              cls: classes.join(' '),
              deal: deal
            });
            bindCard(card, { kind: 'col', col: i, idx: idx });
            div.appendChild(card);
          })(col[j], j, topPos);
          topPos += col[j].up ? dims.up : dims.down;
          height = Math.max(height, topPos + dims.h);
        }
        if (!col.length) {
          div.style.height = dims.h + 'px';
          div.classList.add('clickable');
          div.addEventListener('click', function () {
            if (Date.now() < suppressClickUntil) return;
            clickColCard(i, -1);
          });
        } else {
          div.style.height = height + 'px';
        }
        colsEl.appendChild(div);
      })(ci);
    }
  }

  function popFound(suit) {
    var slot = foundEl.children[suit];
    if (!slot) return;
    slot.classList.add('kl-pop');
    setTimeout(function () { if (slot && slot.parentNode) slot.classList.remove('kl-pop'); }, 540);
    if (Arcade.juice) {
      var r = slot.getBoundingClientRect();
      Arcade.juice.coin(r.left + r.width / 2, r.top + r.height / 2, 'var(--neon-green)');
    } else if (Arcade.audio) {
      Arcade.audio.play('coin');
    }
  }

  /* ---------- 移动动画（FLIP） ---------- */
  function captureRects() {
    var map = {};
    var cards = gameEl.querySelectorAll('.kl-card[data-key]');
    for (var i = 0; i < cards.length; i++) {
      var key = cards[i].dataset.key;
      if (key) map[key] = cards[i].getBoundingClientRect();
    }
    return map;
  }
  function applyMoveAnimation(oldRects) {
    if (!oldRects) return;
    var cards = gameEl.querySelectorAll('.kl-card[data-key]');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        var old = oldRects[card.dataset.key];
        if (!old) return;
        var nr = card.getBoundingClientRect();
        var dx = old.left - nr.left;
        var dy = old.top - nr.top;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        if (card.classList.contains('deal')) return;
        card.classList.add('kl-fly');
        card.style.zIndex = '30';
        card.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        void card.offsetWidth;
        requestAnimationFrame(function () {
          card.style.transform = 'translate(0,0)';
          setTimeout(function () {
            card.classList.remove('kl-fly');
            card.style.transform = '';
            card.style.zIndex = '';
          }, 340);
        });
      })(cards[i]);
    }
  }

  /* ---------- 极简拖拽 ---------- */
  function makeGhost(card, x, y) {
    var rect = card.getBoundingClientRect();
    var g = card.cloneNode(true);
    g.classList.remove('deal');
    g.classList.add('kl-ghost');
    g.style.animationDelay = '';
    g.style.setProperty('--deal-i', '0');
    g.style.width = rect.width + 'px';
    g.style.height = rect.height + 'px';
    g.style.transform = 'translate(' + (x - rect.width / 2) + 'px,' + (y - rect.height / 2) + 'px)';
    document.body.appendChild(g);
    return g;
  }
  function moveGhost(g, x, y) {
    var w = parseFloat(g.style.width) || 44;
    var h = parseFloat(g.style.height) || 62;
    g.style.transform = 'translate(' + (x - w / 2) + 'px,' + (y - h / 2) + 'px) rotate(2deg)';
  }
  function selectForDrag(info) {
    if (info.kind === 'col') {
      var count = variant === 'freecell'
        ? K_fcSeqLen(st, info.col, info.idx)
        : (st.cols[info.col].length - info.idx);
      if (count < 1) count = 1;
      sel = { kind: 'col', col: info.col, idx: info.idx, count: count };
      kbCol = info.col; kbIdx = info.idx; kbZone = 'cols';
    } else if (info.kind === 'waste') {
      sel = { kind: 'waste' };
      kbZone = 'stock';
    } else if (info.kind === 'free') {
      sel = { kind: 'free', free: info.free };
      kbZone = 'free'; kbFree = info.free;
    }
    clearHint(false);
    paintAll();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function startDrag(e, info, card) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (info.kind === 'col') {
      var c = st.cols[info.col][info.idx];
      if (!c || !c.up) return;
    }
    var sx = e.clientX, sy = e.clientY, moved = false, ghost = null;
    function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }
    function onMove(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 10) {
        moved = true;
        cancelAutoRun();
        ghost = makeGhost(card, ev.clientX, ev.clientY);
        selectForDrag(info);
      }
      if (moved && ghost) moveGhost(ghost, ev.clientX, ev.clientY);
      if (moved && ev.cancelable) ev.preventDefault();
    }
    function onUp(ev) {
      cleanup();
      if (!moved) return; // 未移动：交给 click
      var target = dropTargetAt(ev.clientX, ev.clientY);
      if (target) performDrop(target);
      else tip(T('gs.klondike.msgDropNone'), 'warn', 1800);
      suppressClickUntil = Date.now() + 400;
    }
    function onCancel() { cleanup(); }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }
  function dropTargetAt(x, y) {
    var el = document.elementFromPoint(x, y);
    var host = el && el.closest ? el.closest('[data-drop]') : null;
    if (!host) return null;
    return {
      kind: host.dataset.drop,
      col: parseInt(host.dataset.col, 10),
      suit: parseInt(host.dataset.suit, 10),
      free: parseInt(host.dataset.free, 10)
    };
  }
  function performDrop(t) {
    if (t.kind === 'col') clickColCard(t.col, -1);
    else if (t.kind === 'found') clickFound(t.suit);
    else if (t.kind === 'free') clickFree(t.free);
    else if (t.kind === 'stock') {
      if (sel) tip(T('gs.klondike.msgDropNone'), 'warn', 1800);
      else drawStock();
    }
  }

  /* ---------- 提示脉冲 ---------- */
  function clearHint(repaint) {
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    var had = !!hintPulse;
    hintPulse = null;
    if (repaint && had && st && !ended) paintAll();
  }
  function hintText(m) {
    if (!m) return '';
    if (m.srcKind === 'draw') return T('gs.klondike.hintDraw');
    if (m.srcKind === 'recycle') return T('gs.klondike.hintRecycle');
    if (m.dstKind === 'found') return T('gs.klondike.hintToFound').replace('{c}', cardTxt(m.card));
    if (m.dstKind === 'free') return T('gs.klondike.hintToFree').replace('{c}', cardTxt(m.card));
    return T('gs.klondike.hintToCol').replace('{c}', cardTxt(m.card));
  }
  function findMove() {
    if (!st) return null;
    if (variant === 'freecell') return findFreeCellMove();
    return findKlondikeMove();
  }
  function findKlondikeMove() {
    var ci, to, col, idx;
    if (st.waste.length && K_canWasteToFound(st)) {
      return { srcKind: 'waste', card: st.waste[st.waste.length - 1], dstKind: 'found', dstSuit: st.waste[st.waste.length - 1].s };
    }
    for (ci = 0; ci < 7; ci++) {
      if (K_canToFound(st, ci)) {
        var ft = K_colTop(st, ci);
        return { srcKind: 'col', srcCol: ci, srcCount: 1, card: ft, dstKind: 'found', dstSuit: ft.s };
      }
    }
    for (var from = 0; from < 7; from++) {
      col = st.cols[from];
      for (idx = 1; idx < col.length; idx++) {
        if (!col[idx].up || col[idx - 1].up) continue; // 只提示能翻开盖牌的移动
        for (to = 0; to < 7; to++) {
          if (K_canMoveCol(st, from, to, col.length - idx)) {
            return { srcKind: 'col', srcCol: from, srcCount: col.length - idx, card: col[idx], dstKind: 'col', dstCol: to };
          }
        }
      }
    }
    if (st.waste.length) {
      for (to = 0; to < 7; to++) {
        if (K_canWasteToCol(st, to)) {
          return { srcKind: 'waste', card: st.waste[st.waste.length - 1], dstKind: 'col', dstCol: to };
        }
      }
    }
    for (var f2 = 0; f2 < 7; f2++) {
      col = st.cols[f2];
      if (!col.length) continue;
      var run = K_upRun(st, f2);
      if (!run) continue;
      for (idx = col.length - run; idx < col.length; idx++) {
        if (!col[idx].up || idx === 0) continue;
        for (to = 0; to < 7; to++) {
          if (to !== f2 && K_canMoveCol(st, f2, to, col.length - idx)) {
            return { srcKind: 'col', srcCol: f2, srcCount: col.length - idx, card: col[idx], dstKind: 'col', dstCol: to };
          }
        }
      }
    }
    if (st.stock.length) return { srcKind: 'draw' };
    if (st.waste.length) return { srcKind: 'recycle' };
    return null;
  }
  function findFreeCellMove() {
    var ci, fi, to;
    for (ci = 0; ci < 8; ci++) {
      if (K_canToFound(st, ci)) {
        var ft = K_colTop(st, ci);
        return { srcKind: 'col', srcCol: ci, srcCount: 1, card: ft, dstKind: 'found', dstSuit: ft.s };
      }
    }
    for (fi = 0; fi < 4; fi++) {
      if (K_fcCanFreeToFound(st, fi)) {
        return { srcKind: 'free', srcFree: fi, card: st.free[fi][0], dstKind: 'found', dstSuit: st.free[fi][0].s };
      }
    }
    for (fi = 0; fi < 4; fi++) {
      if (!st.free[fi].length) continue;
      for (to = 0; to < 8; to++) {
        if (K_fcCanFreeToCol(st, fi, to)) {
          return { srcKind: 'free', srcFree: fi, card: st.free[fi][0], dstKind: 'col', dstCol: to };
        }
      }
    }
    for (var from = 0; from < 8; from++) {
      var col = st.cols[from];
      for (var idx = 0; idx < col.length; idx++) {
        var count = K_fcSeqLen(st, from, idx);
        if (count < 1) continue;
        for (to = 0; to < 8; to++) {
          if (K_fcCanColToCol(st, from, idx, to)) {
            return { srcKind: 'col', srcCol: from, srcCount: count, card: col[idx], dstKind: 'col', dstCol: to };
          }
        }
      }
    }
    var empty = K_fcFreeSlotFor(st);
    if (empty >= 0) {
      for (var f3 = 0; f3 < 8; f3++) {
        if (st.cols[f3].length) {
          return { srcKind: 'col', srcCol: f3, srcCount: 1, card: K_colTop(st, f3), dstKind: 'free', dstFree: empty };
        }
      }
    }
    return null;
  }
  function showHint() {
    if (!st || ended) return;
    var m = findMove();
    if (!m) {
      var msg = variant === 'freecell' ? T('gs.klondike.hintNoneFc')
        : (st.stock.length || st.waste.length ? T('gs.klondike.hintNoneKlondike') : T('gs.klondike.hintNoneNoStock'));
      tip(msg, 'info', 2600);
      if (Arcade.audio) Arcade.audio.play('ui');
      return;
    }
    sel = null;
    hintPulse = {
      srcKind: m.srcKind, srcCol: m.srcCol, srcCount: m.srcCount || 1, srcFree: m.srcFree,
      dstKind: m.dstKind, dstCol: m.dstCol, dstSuit: m.dstSuit, dstFree: m.dstFree
    };
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hintTimer = null; clearHint(true); }, 3000);
    paintAll();
    tip(hintText(m), 'info', 2600);
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------- 自动收牌 ---------- */
  function allFaceUp() {
    if (!st) return false;
    for (var i = 0; i < st.cols.length; i++) {
      for (var j = 0; j < st.cols[i].length; j++) if (!st.cols[i][j].up) return false;
    }
    if (variant === 'klondike' && st.stock.length) return false;
    return true;
  }
  function findAutoMove() {
    if (!st) return null;
    if (variant === 'freecell') {
      for (var fi = 0; fi < 4; fi++) {
        if (K_fcCanFreeToFound(st, fi)) {
          return { kind: 'free', free: fi, card: st.free[fi][0], suit: st.free[fi][0].s };
        }
      }
      for (var ci = 0; ci < 8; ci++) {
        if (K_canToFound(st, ci)) {
          var ct = K_colTop(st, ci);
          return { kind: 'col', col: ci, card: ct, suit: ct.s };
        }
      }
      return null;
    }
    if (st.waste.length && K_canWasteToFound(st)) {
      var wt = st.waste[st.waste.length - 1];
      return { kind: 'waste', card: wt, suit: wt.s };
    }
    for (var k = 0; k < 7; k++) {
      if (K_canToFound(st, k)) {
        var t2 = K_colTop(st, k);
        return { kind: 'col', col: k, card: t2, suit: t2.s };
      }
    }
    return null;
  }
  function cancelAutoRun() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    autoRunId++;
  }
  function stopAuto() {
    cancelAutoRun();
    autoOn = false;
    updateAutoBtn();
  }
  function updateAutoBtn() {
    if (!autoBtn) return;
    autoBtn.classList.toggle('on', !!autoOn);
    autoBtn.setAttribute('aria-pressed', autoOn ? 'true' : 'false');
  }
  function toggleAuto() {
    if (!st || ended) return;
    if (autoOn) {
      stopAuto();
      if (Arcade.audio) Arcade.audio.play('back');
      return;
    }
    if (!allFaceUp()) {
      tip(T('gs.klondike.msgAutoLocked'), 'warn', 2200);
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    autoOn = true;
    updateAutoBtn();
    sel = null;
    clearHint(false);
    paintAll();
    if (Arcade.audio) Arcade.audio.play('ui');
    scheduleAuto(0, true);
  }
  function scheduleAuto(delay, manual) {
    if (!st || ended || !autoOn) return;
    if (!allFaceUp()) {
      if (manual) {
        autoOn = false;
        updateAutoBtn();
        tip(T('gs.klondike.msgAutoLocked'), 'warn', 2200);
      }
      return;
    }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    var token = autoRunId;
    autoTimer = setTimeout(function () {
      autoTimer = null;
      autoStep(token, manual);
    }, delay || 0);
  }
  function autoStep(token, manual) {
    if (token !== autoRunId || !st || ended || !autoOn) return;
    var m = findAutoMove();
    if (!m) {
      if (manual && !ended) tip(T('gs.klondike.msgAutoDone'), 'info', 2000);
      return;
    }
    performAutoMove(m);
    if (st && !ended && autoOn && token === autoRunId) scheduleAuto(300, false);
  }
  function performAutoMove(m) {
    var oldRects = captureRects();
    var flipKey = null;
    pushHistory();
    if (m.kind === 'waste') {
      if (!K_wasteToFound(st)) { history.pop(); return; }
    } else if (m.kind === 'free') {
      if (!K_fcFreeToFound(st, m.free)) { history.pop(); return; }
    } else {
      var src = st.cols[m.col];
      var willFlip = src.length > 1 && !src[src.length - 2].up;
      if (!K_toFound(st, m.col)) { history.pop(); return; }
      var sc = st.cols[m.col];
      if (willFlip && sc.length && sc[sc.length - 1].up) flipKey = cardKey(sc[sc.length - 1]);
    }
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects, flipKey: flipKey });
    popFound(m.suit);
    if (flipKey && Arcade.audio) Arcade.audio.play('rotate');
    writeSave();
    checkWin();
  }
  function maybeAuto() {
    if (!autoOn || !st || ended) return;
    if (allFaceUp() && findAutoMove()) scheduleAuto(160, false);
  }

  /* ---------- 交互 ---------- */
  function selectCol(ci, idx) {
    var col = st.cols[ci];
    var count;
    if (variant === 'freecell') count = K_fcSeqLen(st, ci, idx);
    else count = col.length - idx;
    if (count < 1) count = 1;
    sel = { kind: 'col', col: ci, idx: idx, count: count };
    kbCol = ci; kbIdx = idx; kbZone = 'cols';
    clearHint(false);
    paintAll();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function clickColCard(ci, idx) {
    if (!st || ended) return;
    if (Date.now() < suppressClickUntil) return;
    cancelAutoRun();
    var col = st.cols[ci];
    kbCol = ci;
    kbZone = 'cols';
    if (idx >= 0) kbIdx = idx;

    if (sel && sel.kind === 'col') {
      if (sel.col !== ci) {
        if (variant === 'freecell') {
          if (K_fcCanColToCol(st, sel.col, sel.idx, ci)) moveFcColAction(sel.col, sel.idx, ci);
          else if (sel.count > K_fcCapacity(st, col.length === 0)) tip(T('gs.klondike.msgSeqTooLong'), 'warn', 2000);
          else invalid('gs.klondike.msgCantMove');
        } else if (K_canMoveCol(st, sel.col, ci, sel.count)) {
          moveColAction(sel.col, ci, sel.count);
        } else {
          invalid('gs.klondike.msgCantMove');
        }
        return;
      }
      if (idx >= 0 && idx >= col.length - sel.count) {
        sel = null; clearHint(false); paintAll();
        if (Arcade.audio) Arcade.audio.play('back');
      } else if (idx >= 0 && col[idx] && col[idx].up) {
        selectCol(ci, idx);
      } else {
        sel = null; clearHint(false); paintAll();
      }
      return;
    }

    if (sel && sel.kind === 'waste') {
      if (K_canWasteToCol(st, ci)) wasteToColAction(ci);
      else invalid('gs.klondike.msgCantCol');
      return;
    }

    if (sel && sel.kind === 'free') {
      if (K_fcCanFreeToCol(st, sel.free, ci)) moveFreeToColAction(sel.free, ci);
      else invalid('gs.klondike.msgCantCol');
      return;
    }

    if (idx < 0) { sel = null; clearHint(false); paintAll(); invalid('gs.klondike.msgPickCard'); return; }
    if (!col[idx].up) { invalid('gs.klondike.msgHidden'); return; }
    selectCol(ci, idx);
  }

  function clickWaste() {
    if (!st || ended) return;
    if (Date.now() < suppressClickUntil) return;
    cancelAutoRun();
    if (sel && sel.kind === 'waste') {
      sel = null; clearHint(false); paintAll();
      if (Arcade.audio) Arcade.audio.play('back');
      return;
    }
    sel = { kind: 'waste' };
    kbZone = 'stock';
    clearHint(false);
    paintAll();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function clickFree(fi) {
    if (!st || ended || variant !== 'freecell') return;
    if (Date.now() < suppressClickUntil) return;
    cancelAutoRun();
    kbZone = 'free';
    kbFree = fi;
    var cell = st.free[fi] || [];
    if (sel) {
      if (sel.kind === 'free' && sel.free === fi) {
        sel = null; clearHint(false); paintAll();
        if (Arcade.audio) Arcade.audio.play('back');
        return;
      }
      if (!cell.length) {
        if (sel.kind === 'col') {
          if (sel.count === 1) moveColToFreeAction(sel.col, fi);
          else tip(T('gs.klondike.msgSingleFree'), 'warn', 2200);
          return;
        }
        invalid('gs.klondike.msgCantMove');
        return;
      }
      invalid('gs.klondike.msgFreeOccupied');
      return;
    }
    if (cell.length) {
      sel = { kind: 'free', free: fi };
      clearHint(false);
      paintAll();
      if (Arcade.audio) Arcade.audio.play('ui');
    } else {
      invalid('gs.klondike.msgPickCard');
    }
  }

  function moveColAction(from, to, count) {
    if (!st || !K_canMoveCol(st, from, to, count)) { invalid('gs.klondike.msgCantMove'); return; }
    var oldRects = captureRects();
    var src = st.cols[from];
    var exposed = src.length - count - 1;
    var willFlip = exposed >= 0 && !src[exposed].up;
    pushHistory();
    if (!K_moveCol(st, from, to, count)) { history.pop(); return; }
    var sc = st.cols[from];
    var flipKey = willFlip && sc.length && sc[sc.length - 1].up ? cardKey(sc[sc.length - 1]) : null;
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects, flipKey: flipKey });
    if (Arcade.audio) Arcade.audio.play('move');
    if (flipKey && Arcade.audio) Arcade.audio.play('rotate');
    writeSave();
    if (checkWin()) return;
    maybeAuto();
  }

  function moveFcColAction(from, idx, to) {
    if (!st || !K_fcCanColToCol(st, from, idx, to)) { invalid('gs.klondike.msgCantMove'); return; }
    var oldRects = captureRects();
    pushHistory();
    if (!K_fcMoveColToCol(st, from, idx, to)) { history.pop(); return; }
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects });
    if (Arcade.audio) Arcade.audio.play('move');
    writeSave();
    if (checkWin()) return;
    maybeAuto();
  }

  function wasteToColAction(to) {
    if (!K_canWasteToCol(st, to)) { invalid('gs.klondike.msgCantCol'); return; }
    var oldRects = captureRects();
    pushHistory();
    if (!K_moveWasteToCol(st, to)) { history.pop(); return; }
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects });
    if (Arcade.audio) Arcade.audio.play('move');
    writeSave();
    if (checkWin()) return;
    maybeAuto();
  }

  function moveColToFreeAction(ci, fi) {
    if (!st || variant !== 'freecell' || !st.cols[ci].length || st.free[fi].length) {
      invalid('gs.klondike.msgCantMove');
      return;
    }
    var oldRects = captureRects();
    pushHistory();
    if (!K_fcColToFree(st, ci, fi)) { history.pop(); return; }
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects });
    if (Arcade.audio) Arcade.audio.play('drop');
    writeSave();
  }

  function moveFreeToColAction(fi, to) {
    if (!K_fcCanFreeToCol(st, fi, to)) { invalid('gs.klondike.msgCantCol'); return; }
    var oldRects = captureRects();
    pushHistory();
    if (!K_fcFreeToCol(st, fi, to)) { history.pop(); return; }
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects });
    if (Arcade.audio) Arcade.audio.play('move');
    writeSave();
    if (checkWin()) return;
    maybeAuto();
  }

  function moveFreeToFoundAction(fi) {
    if (!K_fcCanFreeToFound(st, fi)) { invalid('gs.klondike.msgCantFound'); return; }
    var card = st.free[fi][0];
    var oldRects = captureRects();
    pushHistory();
    if (!K_fcFreeToFound(st, fi)) { history.pop(); return; }
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects });
    popFound(card.s);
    writeSave();
    if (checkWin()) return;
    maybeAuto();
  }

  function moveSelToFound() {
    if (!sel || !st) return;
    if (sel.kind === 'col') {
      if (sel.count !== 1) { tip(T('gs.klondike.msgSingleOnly'), 'warn', 2200); return; }
      if (!K_canToFound(st, sel.col)) { invalid('gs.klondike.msgCantFound'); return; }
    } else if (sel.kind === 'waste') {
      if (!K_canWasteToFound(st)) { invalid('gs.klondike.msgCantFound'); return; }
    } else if (sel.kind === 'free') {
      if (!K_fcCanFreeToFound(st, sel.free)) { invalid('gs.klondike.msgCantFound'); return; }
    } else return;

    var oldRects = captureRects();
    var wasCol = sel.kind === 'col';
    var from = sel.col;
    var card, willFlip = false, flipKey = null;
    if (wasCol) {
      card = st.cols[from][st.cols[from].length - 1];
      var src = st.cols[from];
      willFlip = src.length > 1 && !src[src.length - 2].up;
    } else if (sel.kind === 'waste') {
      card = st.waste[st.waste.length - 1];
    } else {
      card = st.free[sel.free][0];
    }
    pushHistory();
    var ok = wasCol ? K_toFound(st, from)
      : (sel.kind === 'waste' ? K_wasteToFound(st) : K_fcFreeToFound(st, sel.free));
    if (!ok) { history.pop(); return; }
    if (wasCol) {
      var sc = st.cols[from];
      if (willFlip && sc.length && sc[sc.length - 1].up) flipKey = cardKey(sc[sc.length - 1]);
    }
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects, flipKey: flipKey });
    popFound(card.s);
    if (flipKey && Arcade.audio) Arcade.audio.play('rotate');
    writeSave();
    if (checkWin()) return;
    maybeAuto();
  }

  function clickFound(s) {
    if (!st || ended) return;
    if (Date.now() < suppressClickUntil) return;
    cancelAutoRun();
    kbZone = 'found';
    kbSuit = s;
    if (!sel) { invalid('gs.klondike.msgPickCard'); return; }
    if (sel.kind === 'col' && sel.count !== 1) {
      tip(T('gs.klondike.msgSingleOnly'), 'warn', 2200);
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(boardEl);
      return;
    }
    if (canFoundTarget(s)) moveSelToFound();
    else invalid('gs.klondike.msgCantFound');
  }

  function drawStock() {
    if (!st || ended) return;
    if (Date.now() < suppressClickUntil) return;
    cancelAutoRun();
    if (variant === 'freecell') { invalid('gs.klondike.msgNoDraw'); return; }
    if (!st.stock.length && !st.waste.length) {
      invalid('gs.klondike.msgStockEmpty');
      return;
    }
    var oldRects = captureRects();
    pushHistory();
    var r = K_draw(st);
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects });
    if (Arcade.audio) Arcade.audio.play(r === 'recycle' ? 'rotate' : 'drop');
    writeSave();
    maybeAuto();
  }

  function undo() {
    if (!st || ended) return;
    if (variant !== 'freecell' && st.undosLeft <= 0) {
      tip(T('gs.klondike.msgNoUndo'), 'warn', 2200);
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(boardEl);
      return;
    }
    if (!history.length) { tip(T('gs.klondike.msgNoHistory'), 'info', 2000); return; }
    cancelAutoRun();
    var oldRects = captureRects();
    var curUndos = st.undosLeft;
    st = JSON.parse(history.pop());
    st.variant = variant;
    if (variant !== 'freecell') st.undosLeft = Math.max(0, (curUndos || 0) - 1);
    else st.undosLeft = -1;
    sel = null;
    clearHint(false);
    paintAll({ oldRects: oldRects });
    if (Arcade.audio) Arcade.audio.play('back');
    writeSave();
  }

  /* ---------- HUD / 选择页 ---------- */
  function updateUndoBtn() {
    var disabled = !st || ended || !history.length || (variant !== 'freecell' && st.undosLeft <= 0);
    undoBtn.disabled = disabled;
    undoBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }
  function updateLevelLabel() {
    if (!st) { levEl.textContent = ''; return; }
    if (isDaily) {
      levEl.textContent = T('gs.klondike.dailyLev');
    } else if (variant === 'freecell') {
      levEl.textContent = T('gs.klondike.fcLev');
    } else {
      var info = DIFF_INFO[curDiff] || DIFF_INFO[1];
      levEl.textContent = T('gs.klondike.chalLev')
        .replace('{t}', info.t)
        .replace('{d}', T(st.drawMode === 1 ? 'gs.klondike.draw1' : 'gs.klondike.draw3'));
    }
  }
  function updateBestUI() {
    var best = bestVal();
    if (bestChipEl) bestChipEl.textContent = fmtBest(best);
    if (pickBestEl) pickBestEl.textContent = T('gs.klondike.pickBest').replace('{s}', fmtBest(bestValFor(pickVariant)));
  }
  function updatePickInfo() {
    if (vtabEls.length === 2) {
      vtabEls[0].classList.toggle('on', pickVariant === 'klondike');
      vtabEls[1].classList.toggle('on', pickVariant === 'freecell');
      vtabEls[0].setAttribute('aria-selected', pickVariant === 'klondike' ? 'true' : 'false');
      vtabEls[1].setAttribute('aria-selected', pickVariant === 'freecell' ? 'true' : 'false');
    }
    if (pickKlondikeEl) pickKlondikeEl.classList.toggle('hidden', pickVariant !== 'klondike');
    if (pickFreecellEl) pickFreecellEl.classList.toggle('hidden', pickVariant !== 'freecell');

    var solved = false, streak = 0, solvedTime = null;
    if (window.Arcade && Arcade.daily) {
      try {
        solved = Arcade.daily.isSolved('klondike');
        streak = Arcade.daily.streak();
        solvedTime = Arcade.daily.solvedTime('klondike');
      } catch (e) {}
    }
    if (dailyStateEl) {
      dailyStateEl.classList.toggle('done', !!solved);
      if (solved) {
        dailyStateEl.textContent = T('gs.klondike.dailySolved')
          .replace('{s}', solvedTime === null ? '—' : String(Math.round(solvedTime)))
          .replace('{n}', streak);
      } else if (streak > 0) {
        dailyStateEl.textContent = T('gs.klondike.dailyStreak').replace('{n}', streak);
      } else {
        dailyStateEl.textContent = T('gs.klondike.dailyHint');
      }
    }
    if (pickBestEl) pickBestEl.textContent = T('gs.klondike.pickBest').replace('{s}', fmtBest(bestValFor(pickVariant)));
  }

  /* ---------- 流程 ---------- */
  function startGame(v, diffIdx, daily) {
    v = v === 'freecell' ? 'freecell' : 'klondike';
    stopClock();
    if (dealTimer) { clearTimeout(dealTimer); dealTimer = null; }
    stopAuto();
    clearHint(false);
    setupSave(v);
    clearSave();
    variant = v;
    pickVariant = v;
    isDaily = !!daily && v === 'klondike';
    curDiff = typeof diffIdx === 'number' ? diffIdx : 1;
    ended = false;
    totalMs = 0;
    history = [];
    sel = null;
    kbCol = 0;
    kbIdx = -1;
    kbZone = 'cols';
    kbFree = 0;
    kbSuit = 0;
    if (v === 'freecell') {
      st = K_newFreeCell();
      st.undosLeft = -1;
    } else {
      var drawMode = (isDaily || curDiff === 2) ? 3 : 1;
      var undos = isDaily ? 0 : (curDiff === 0 ? 3 : (curDiff === 1 ? 1 : 0));
      st = isDaily ? K_buildSolvableDeal(todaySeed()) : K_newGame(undefined, drawMode);
      st.variant = 'klondike';
      st.undosLeft = undos;
      st.drawMode = drawMode;
    }
    pickEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    overlayEl.classList.add('hidden');
    boardEl.classList.remove('kl-won');
    updateLevelLabel();
    updateTimerUI();
    updateBestUI();
    updateAutoBtn();
    paintAll({ deal: true });
    startClock();
    writeSave();
    if (Arcade.audio) Arcade.audio.play('drop');
    dealTimer = setTimeout(function () {
      dealTimer = null;
      if (Arcade.audio) Arcade.audio.play('rotate');
    }, 420);
  }

  function openPicker(silent) {
    stopClock();
    if (dealTimer) { clearTimeout(dealTimer); dealTimer = null; }
    stopAuto();
    clearHint(false);
    totalMs = 0;
    ended = false;
    st = null;
    sel = null;
    history = [];
    clearSave();
    boardEl.classList.remove('kl-won');
    overlayEl.classList.add('hidden');
    gameEl.classList.add('hidden');
    pickEl.classList.remove('hidden');
    pickVariant = variant;
    updateTimerUI();
    updateBestUI();
    updatePickInfo();
    if (!silent && Arcade.audio) Arcade.audio.play('back');
  }

  function confettiBurst() {
    if (!overlayEl) return;
    var colors = ['var(--neon-cyan)', 'var(--neon-pink)', 'var(--neon-yellow)', 'var(--neon-green)', 'var(--neon-purple)'];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement('span');
      s.className = 'kl-confetti';
      s.style.setProperty('--x', ((Math.random() * 2 - 1) * 44) + 'vw');
      s.style.setProperty('--y', ((Math.random() * 0.78 + 0.28) * 72) + 'vh');
      s.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
      s.style.setProperty('--c', colors[i % colors.length]);
      s.style.animationDelay = (Math.random() * 0.35) + 's';
      overlayEl.appendChild(s);
      (function (el) {
        setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 1900);
      })(s);
    }
  }

  function checkWin() {
    if (!st || ended || !K_won(st)) return false;
    ended = true;
    stopClock();
    cancelAutoRun();
    clearHint(false);
    var sec = totalSec();
    if (Arcade.juice) Arcade.juice.win();
    if (isDaily && window.Arcade && Arcade.daily) {
      Arcade.daily.markSolved('klondike', sec);
    }
    var isNew = false, globalNew = false;
    try {
      if (window.Arcade && Arcade.storage) isNew = !!Arcade.storage.submitBest(bestKeyFor(variant), sec, 'min');
    } catch (e) {}
    if (variant === 'klondike') {
      try { if (window.Arcade && Arcade.shell) globalNew = !!Arcade.shell.submitScore(sec); } catch (e) {}
    } else {
      try { if (window.Arcade && Arcade.rank) Arcade.rank.add(isNew ? 5 : 2); } catch (e) {}
    }
    if (isNew && !globalNew && Arcade.ui) Arcade.ui.toast(T('gs.klondike.newRecord'), 'win');
    var best = bestVal();
    ovBadge.textContent = isNew ? T('gs.klondike.newRecord') : '';
    ovTitle.textContent = T(variant === 'freecell' ? 'gs.klondike.fcWinT' : 'gs.klondike.winT');
    ovTitle.className = 'win';
    ovText.innerHTML = T(variant === 'freecell' ? 'gs.klondike.fcWinD' : 'gs.klondike.winD')
      .replace('{s}', sec).replace('{n}', st.moves);
    ovTime.textContent = sec + 's';
    ovMoves.textContent = st.moves;
    ovBest.textContent = fmtBest(best);
    overlayEl.classList.remove('hidden');
    boardEl.classList.add('kl-won');
    clearSave();
    updateBestUI();
    updatePickInfo();
    updateUndoBtn();
    updateAutoBtn();
    confettiBurst();
    return true;
  }

  /* ---------- 键盘 ---------- */
  function gameActive() {
    return !!st && !ended && !gameEl.classList.contains('hidden') &&
      !document.querySelector('.tut-overlay');
  }
  function kbZones() { return variant === 'freecell' ? ['cols', 'free', 'found'] : ['cols', 'stock', 'found']; }
  function moveKbFocus(delta) {
    if (!gameActive()) return;
    if (kbZone === 'stock') return;
    if (kbZone === 'free') kbFree = (kbFree + delta + 4) % 4;
    else if (kbZone === 'found') kbSuit = (kbSuit + delta + 4) % 4;
    else {
      var n = variant === 'freecell' ? 8 : 7;
      kbCol = (kbCol + delta + n) % n;
      kbIdx = topUpIndex(kbCol);
    }
    paintAll();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function cycleKbZone(delta) {
    if (!gameActive()) return;
    var zones = kbZones();
    var i = zones.indexOf(kbZone);
    if (i < 0) i = 0;
    kbZone = zones[(i + delta + zones.length) % zones.length];
    paintAll();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function moveKbCard(delta) {
    if (!gameActive() || kbZone !== 'cols') return;
    var col = st.cols[kbCol];
    var ups = [];
    for (var j = 0; j < col.length; j++) if (col[j].up) ups.push(j);
    if (!ups.length) return;
    var pos = ups.indexOf(kbIdx);
    if (pos < 0) pos = ups.length - 1;
    pos = Math.max(0, Math.min(ups.length - 1, pos + delta));
    kbIdx = ups[pos];
    paintAll();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function kbActivate() {
    if (!gameActive()) return;
    if (kbZone === 'stock') {
      if (sel && sel.kind === 'waste') {
        sel = null; clearHint(false); paintAll();
        if (Arcade.audio) Arcade.audio.play('back');
        return;
      }
      if (st.waste.length && st.stock.length) {
        sel = { kind: 'waste' };
        clearHint(false); paintAll();
        if (Arcade.audio) Arcade.audio.play('ui');
        return;
      }
      drawStock();
      return;
    }
    if (kbZone === 'free') {
      clickFree(kbFree);
      return;
    }
    if (kbZone === 'found') {
      if (!sel) { invalid('gs.klondike.msgPickCard'); return; }
      var targetSuit = kbSuit;
      if (sel.kind === 'col') {
        var tc = st.cols[sel.col];
        if (tc.length) targetSuit = tc[tc.length - 1].s;
      } else if (sel.kind === 'waste') {
        if (st.waste.length) targetSuit = st.waste[st.waste.length - 1].s;
      } else if (sel.kind === 'free') {
        if (st.free[sel.free] && st.free[sel.free].length) targetSuit = st.free[sel.free][0].s;
      }
      kbSuit = targetSuit;
      clickFound(targetSuit);
      return;
    }
    if (sel) {
      if (sel.kind === 'col' && sel.col === kbCol) {
        sel = null; clearHint(false); paintAll();
        if (Arcade.audio) Arcade.audio.play('back');
        return;
      }
      clickColCard(kbCol, -1);
      return;
    }
    var col = st.cols[kbCol];
    var idx = kbIdx;
    if (idx < 0 || !col[idx]) {
      invalid('gs.klondike.msgPickCard');
      return;
    }
    if (!col[idx].up) {
      invalid('gs.klondike.msgHidden');
      return;
    }
    selectCol(kbCol, idx);
  }

  document.addEventListener('keydown', function (e) {
    if (!gameActive() || e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a' || (e.target && e.target.isContentEditable)) return;
    var k = e.key;
    var handled = true;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      if (e.shiftKey) cycleKbZone(k === 'ArrowLeft' ? -1 : 1);
      else moveKbFocus(k === 'ArrowLeft' ? -1 : 1);
    }
    else if (k === 'ArrowUp') moveKbCard(-1);
    else if (k === 'ArrowDown') moveKbCard(1);
    else if (k === ' ' || k === 'Spacebar' || e.code === 'Space') drawStock();
    else if (k === 'Enter') kbActivate();
    else if (k === 'Escape') {
      if (sel) { sel = null; clearHint(true); if (Arcade.audio) Arcade.audio.play('back'); }
    }
    else if (k === 'h' || k === 'H') showHint();
    else if (k === 'a' || k === 'A') toggleAuto();
    else if (k === 'u' || k === 'U') undo();
    else if (k === 'n' || k === 'N') startGame(variant, curDiff, isDaily);
    else if (k === 'b' || k === 'B') openPicker(false);
    else handled = false;
    if (handled) e.preventDefault();
  });

  /* ================= SIM-AUTOPLAY (?sim=1) =================
     仅测试入口：?sim=1 时暴露 window.__klSim。
     先对「当前真实发牌」的克隆状态做 best-first 搜索，再把找到的合法
     走法逐招回放给真实的 moveColAction / wasteToColAction / drawStock /
     performAutoMove；胜负完全由 checkWin() 与 #kl-overlay 决定。
     搜索失败则重新发牌，最多 maxGames 局。绝不注入残局或终局存档。
     ================================================================ */
  var SIM_ON = /(?:\?|&)sim=1(?:&|$)/.test(window.location.search);
  var simState = null;

  function simClone(s) {
    var mk = function (a) { return a.map(function (c) { return { v: c.v, s: c.s, up: c.up }; }); };
    return {
      variant: s.variant, cols: s.cols.map(mk), found: s.found.map(mk),
      stock: mk(s.stock), waste: mk(s.waste), drawMode: s.drawMode,
      moves: 0, undosLeft: 0
    };
  }
  function simHash(s) {
    var o = '';
    for (var i = 0; i < 4; i++) o += s.found[i].length + ',';
    for (var c = 0; c < 7; c++) {
      var col = s.cols[c];
      for (var j = 0; j < col.length; j++) o += (col[j].up ? 'u' : 'd') + (col[j].v * 4 + col[j].s) + ',';
      o += '|';
    }
    o += '#';
    for (var k = 0; k < s.stock.length; k++) o += (s.stock[k].v * 4 + s.stock[k].s) + ',';
    o += '#';
    for (var w = 0; w < s.waste.length; w++) o += (s.waste[w].v * 4 + s.waste[w].s) + ',';
    return o;
  }
  function simTopUp(col) {
    for (var j = 0; j < col.length; j++) if (col[j].up) return j;
    return -1;
  }
  function simRunOk(col, idx) {
    for (var i = idx + 1; i < col.length; i++) {
      if (col[i].v !== col[i - 1].v - 1 || K_color(col[i].s) === K_color(col[i - 1].s)) return false;
    }
    return true;
  }
  function simHeuristic(s) {
    var f = 0, hidden = 0, up = 0, emptyCols = 0;
    for (var i = 0; i < 4; i++) f += s.found[i].length;
    for (var c = 0; c < 7; c++) {
      var col = s.cols[c];
      if (!col.length) emptyCols++;
      for (var j = 0; j < col.length; j++) { if (col[j].up) up++; else hidden++; }
    }
    return f * 100 + up * 2 - hidden * 6 + emptyCols * 4 - s.waste.length * 3;
  }
  function simCandidates(s) {
    var out = [], empties = [];
    for (var i = 0; i < 7; i++) if (!s.cols[i].length) empties.push(i);
    for (var from = 0; from < 7; from++) {
      var col = s.cols[from], us = simTopUp(col);
      if (us < 0) continue;
      for (var idx = us; idx < col.length; idx++) {
        var count = col.length - idx;
        if (!simRunOk(col, idx)) continue;
        for (var to = 0; to < 7; to++) {
          if (from === to) continue;
          if (!K_canMoveCol(s, from, to, count)) continue;
          var te = s.cols[to].length === 0;
          if (te) {
            if (!empties.length || to !== empties[0]) continue;
            if (count === col.length) continue; // 整列搬到空列无意义
          }
          out.push({ t: 'c2c', from: from, to: to, count: count });
        }
      }
    }
    if (s.waste.length) {
      for (var to2 = 0; to2 < 7; to2++) {
        if (!K_canWasteToCol(s, to2)) continue;
        if (s.cols[to2].length === 0 && (!empties.length || to2 !== empties[0])) continue;
        out.push({ t: 'w2c', to: to2 });
      }
    }
    if (s.stock.length) out.push({ t: 'draw' });
    else if (s.waste.length) out.push({ t: 'recycle' });
    return out;
  }
  function simApply(s, m) {
    if (m.t === 'c2f') return K_toFound(s, m.col);
    if (m.t === 'w2f') return K_wasteToFound(s);
    if (m.t === 'c2c') return K_moveCol(s, m.from, m.to, m.count);
    if (m.t === 'w2c') return K_moveWasteToCol(s, m.to);
    if (m.t === 'draw' || m.t === 'recycle') { K_draw(s); return true; }
    return false;
  }
  function simAutoFound(s, path) {
    for (var guard = 0; guard < 16; guard++) {
      var moved = false;
      if (K_canWasteToFound(s)) {
        var w = s.waste[s.waste.length - 1];
        var mw = { t: 'w2f', cardS: w.s };
        K_wasteToFound(s); path.push(mw); moved = true;
      }
      if (!moved) {
        for (var c = 0; c < 7; c++) {
          if (K_canToFound(s, c)) {
            var top = K_colTop(s, c);
            var mc = { t: 'c2f', col: c, cardS: top.s };
            K_toFound(s, c); path.push(mc); moved = true; break;
          }
        }
      }
      if (!moved) break;
    }
  }
  function simHeapPush(a, n) {
    a.push(n);
    var i = a.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (a[p].score >= a[i].score) break;
      var t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  }
  function simHeapPop(a) {
    if (!a.length) return null;
    var top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0;
      while (true) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < a.length && a[l].score > a[m].score) m = l;
        if (r < a.length && a[r].score > a[m].score) m = r;
        if (m === i) break;
        var t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  }
  function simSolve(init, budget) {
    var start = simClone(init), path0 = [];
    simAutoFound(start, path0);
    if (K_won(start)) return { ok: true, moves: path0, nodes: 1 };
    var heap = [], seen = {}, nodes = 0;
    var h0 = simHash(start);
    seen[h0] = 1;
    simHeapPush(heap, { s: start, path: path0, score: simHeuristic(start) });
    while (heap.length && nodes < budget) {
      var node = simHeapPop(heap);
      nodes++;
      var moves = simCandidates(node.s);
      for (var i = 0; i < moves.length; i++) {
        var ns = simClone(node.s);
        var m = moves[i];
        if (!simApply(ns, m)) continue;
        var p = node.path.concat([m]);
        simAutoFound(ns, p);
        if (K_won(ns)) return { ok: true, moves: p, nodes: nodes };
        var h = simHash(ns);
        if (seen[h]) continue;
        seen[h] = 1;
        simHeapPush(heap, { s: ns, path: p, score: simHeuristic(ns) });
        nodes++;
      }
    }
    return { ok: false, moves: [], nodes: nodes };
  }

  function simExec(m) {
    if (!st || ended) return false;
    if (m.t === 'draw' || m.t === 'recycle') {
      if (!st.stock.length && !st.waste.length) return false;
      drawStock(); return true;
    }
    if (m.t === 'c2c') {
      if (!K_canMoveCol(st, m.from, m.to, m.count)) return false;
      moveColAction(m.from, m.to, m.count); return true;
    }
    if (m.t === 'w2c') {
      if (!K_canWasteToCol(st, m.to)) return false;
      wasteToColAction(m.to); return true;
    }
    if (m.t === 'c2f') {
      if (!K_canToFound(st, m.col)) return false;
      var top = K_colTop(st, m.col);
      performAutoMove({ kind: 'col', col: m.col, card: top, suit: top.s }); return true;
    }
    if (m.t === 'w2f') {
      if (!K_canWasteToFound(st)) return false;
      var w = st.waste[st.waste.length - 1];
      performAutoMove({ kind: 'waste', card: w, suit: w.s }); return true;
    }
    return false;
  }
  function simFinish() {
    var S = simState;
    if (!S || !S.running) return;
    S.running = false;
    S.endedAt = Date.now();
    S.won = !!(ended && st && K_won(st));
    S.successGame = S.won ? S.games : 0;
    S.elapsedMs = S.endedAt - S.startedAt;
    S.clockMs = elapsedMs();
    S.moves = st ? st.moves : 0;
    S.overlayVisible = overlayEl ? !overlayEl.classList.contains('hidden') : false;
    S.overlayText = overlayEl ? (overlayEl.innerText || overlayEl.textContent || '') : '';
    try { S.saveKlondike = localStorage.getItem('arcade_save_klondike'); } catch (e) {}
    try { S.bestKlondike = localStorage.getItem('arcade_best_klondike'); } catch (e) {}
    S.finished = true;
  }
  function simRetryOrFinish(reason) {
    var S = simState;
    if (!S || !S.running) return;
    S.lastAbort = reason;
    if (S.games < S.maxGames) {
      setTimeout(function () { if (simState && simState.running) simNextGame(); }, 150);
    } else {
      simFinish();
    }
  }
  function simPlay(moves, i) {
    var S = simState;
    if (!S || !S.running) return;
    if (ended) { simFinish(); return; }
    if (i >= moves.length) {
      if (st && K_won(st)) checkWin();
      if (ended) simFinish(); else simRetryOrFinish('plan-ended');
      return;
    }
    if (!simExec(moves[i])) { simRetryOrFinish('exec-invalid:' + moves[i].t); return; }
    S.movesPlayed = st ? st.moves : 0;
    if (ended) { simFinish(); return; }
    setTimeout(function () { simPlay(moves, i + 1); }, 0);
  }
  function simNextGame() {
    var S = simState;
    if (!S || !S.running) return;
    S.games++;
    S.planMoves = 0;
    startGame('klondike', S.diff, false);
    setTimeout(function () {
      if (!simState || !simState.running) return;
      var t0 = Date.now();
      var r = simSolve(st, S.budget);
      S.nodes = r.nodes;
      S.solveMs = Date.now() - t0;
      S.log.push({ game: S.games, ok: r.ok, moves: r.moves.length, nodes: r.nodes, ms: S.solveMs });
      if (!r.ok) { simRetryOrFinish('search'); return; }
      S.planMoves = r.moves.length;
      simPlay(r.moves, 0);
    }, 260);
  }
  function simStart(opts) {
    if (!SIM_ON || (simState && simState.running)) return false;
    opts = opts || {};
    simState = {
      running: true, finished: false, won: false, games: 0,
      maxGames: opts.maxGames || 20,
      budget: opts.budget || 70000,
      diff: typeof opts.diff === 'number' ? opts.diff : 0,
      startedAt: Date.now(), endedAt: 0, log: [],
      nodes: 0, solveMs: 0, planMoves: 0, movesPlayed: 0,
      lastAbort: null, overlayText: '', overlayVisible: false,
      saveKlondike: null, bestKlondike: null
    };
    simNextGame();
    return true;
  }
  if (SIM_ON) {
    window.__klSim = {
      start: simStart,
      status: function () { return simState; },
      paint: function () { if (st) paintAll(); },
      solve: function (budget) { if (!st) return null; return simSolve(st, budget || 70000); }
    };
  }

  /* ---------- 断点续玩 ---------- */
  if (window.Arcade && Arcade.savegame) {
    setupSave('klondike');
  }

  /* ---------- 绑定 ---------- */
  var pickBtns = pickEl.querySelectorAll('button[data-i]');
  for (var i = 0; i < pickBtns.length; i++) {
    pickBtns[i].addEventListener('click', function () {
      startGame('klondike', parseInt(this.dataset.i, 10) || 0, false);
    });
  }
  pickDailyBtn.addEventListener('click', function () { startGame('klondike', 2, true); });
  fcStartBtn.addEventListener('click', function () { startGame('freecell', 1, false); });
  for (var vi = 0; vi < vtabEls.length; vi++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        pickVariant = btn.dataset.v === 'freecell' ? 'freecell' : 'klondike';
        updatePickInfo();
        if (Arcade.audio) Arcade.audio.play('ui');
      });
    })(vtabEls[vi]);
  }
  undoBtn.addEventListener('click', undo);
  hintBtn.addEventListener('click', showHint);
  autoBtn.addEventListener('click', toggleAuto);
  document.getElementById('kl-new').addEventListener('click', function () {
    startGame(variant, curDiff, isDaily);
  });
  document.getElementById('kl-back').addEventListener('click', function () {
    openPicker(false);
  });
  document.getElementById('kl-ov-again').addEventListener('click', function () {
    overlayEl.classList.add('hidden');
    startGame(variant, curDiff, isDaily);
  });
  document.getElementById('kl-ov-pick').addEventListener('click', function () {
    overlayEl.classList.add('hidden');
    openPicker(true);
  });

  window.addEventListener('resize', function () {
    if (!st) return;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resizeTimer = null; if (st && !ended) paintAll(); }, 140);
  });

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.klondike.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    if (st) startGame(variant, curDiff, isDaily);
    else openPicker(true);
  };

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.klondike.tut1t'), d: T('gs.klondike.tut1') },
    { t: T('gs.klondike.tut2t'), d: T('gs.klondike.tut2') },
    { t: T('gs.klondike.tut3t'), d: T('gs.klondike.tut3') },
    { t: T('gs.klondike.tut4t'), d: T('gs.klondike.tut4') }
  ];

  /* 启动：优先恢复上次 Klondike（兼容旧档），再尝试 FreeCell；无档则显示选择界面 */
  updateBestUI();
  updatePickInfo();
  updateTimerUI();
  if (!tryResume()) {
    setupSave('freecell');
    if (!tryResume()) openPicker(true);
  }

})();
