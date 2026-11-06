/* 扑克对决 Poker Duel —— 单挑德州扑克 · 多桌 / AI 分层 / 手牌复盘
   翻牌前 → 翻牌 → 转牌 → 河牌 → 摊牌；每条街 Check/Call/Raise/Fold。
   桌台决定盲注、买入与 AI 风格；AI 依据牌力、底池赔率、位置与风格行动。
   摊牌为完整 7 选 5 牌型判定；成绩 = 最终筹码（最高分）。 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.poker.tut1t'), d: T('gs.poker.tut1') },
  { t: T('gs.poker.tut2t'), d: T('gs.poker.tut2') },
  { t: T('gs.poker.tut3t'), d: T('gs.poker.tut3') },
  { t: T('gs.poker.tut4t'), d: T('gs.poker.tut4') },
  { t: T('gs.poker.tut5t'), d: T('gs.poker.tut5') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var SUITS = ['♠', '♥', '♦', '♣'];
  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var RV = {}; for (var ri = 0; ri < RANKS.length; ri++) RV[RANKS[ri]] = ri + 2;
  var MAX_HISTORY = 24;
  var uidSeq = 0;

  var TABLES = [
    { id: 'rookie', sb: 2, bb: 5, buyin: 80, style: 'tight' },
    { id: 'standard', sb: 5, bb: 10, buyin: 100, style: 'normal' },
    { id: 'pro', sb: 10, bb: 20, buyin: 160, style: 'aggro' }
  ];
  var TABLE_I18N = {
    rookie: 'gs.poker.tableRookie',
    standard: 'gs.poker.tableStandard',
    pro: 'gs.poker.tablePro'
  };
  var STYLE_I18N = {
    tight: 'gs.poker.tableStyleRookie',
    normal: 'gs.poker.tableStyleStandard',
    aggro: 'gs.poker.tableStylePro'
  };
  var AI_STYLES = {
    /* 紧弱：少加注、不诈唬、面对下注更快弃牌 */
    tight: {
      pos: 0.02, openStrong: 0.76, openStrongP: 0.48, openMid: 0.58, openMidP: 0.08,
      foldLow: 0.44, foldR: 0.78, foldLow2: 0.34, foldR2: 0.52,
      raiseStrong: 0.78, raiseStrongP: 0.36, raiseMid: 0.60, raiseMidP: 0.10,
      bluff: 0, bluffMax: 0.12, maxRaises: 1
    },
    /* 标准：攻守均衡（面对下注略收紧，形成 新手 < 标准 < 高手 的难度梯度） */
    normal: {
      pos: 0.04, openStrong: 0.68, openStrongP: 0.52, openMid: 0.44, openMidP: 0.14,
      foldLow: 0.36, foldR: 0.84, foldLow2: 0.28, foldR2: 0.60,
      raiseStrong: 0.70, raiseStrongP: 0.46, raiseMid: 0.46, raiseMidP: 0.16,
      bluff: 0.07, bluffMax: 0.16, maxRaises: 1
    },
    /* 激进：频繁加注、轻跟注、较高诈唬率，可再加注一次 */
    aggro: {
      pos: 0.06, openStrong: 0.66, openStrongP: 0.70, openMid: 0.44, openMidP: 0.34,
      foldLow: 0.24, foldR: 0.90, foldLow2: 0.18, foldLow2P: 0.42, foldR2: 0.80,
      raiseStrong: 0.64, raiseStrongP: 0.68, raiseMid: 0.42, raiseMidP: 0.30,
      bluff: 0.18, bluffMax: 0.20, maxRaises: 2
    }
  };
  var SVG_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  var SVG_REPLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v6h6"/></svg>';
  var SVG_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6l-12 12"/></svg>';
  var SVG_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var SVG_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var ICON_TABLE = {
    rookie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/></svg>',
    standard: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    pro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L5 13h5l-1 9 8-11h-5z"/></svg>'
  };

  var table = TABLES[1];
  var chips, aiChips, pot, deck, playerCards, aiCards, boardCards;
  var street, streetBet, invested, acted, sbIsPlayer, handNo, lastRaiseSize, aiRaisesThisStreet;
  var phase, currentActor, activeToken, revealAI, startChips, best, resultVisible;
  var paused = false, pauseOpen = false, replayOpen = false, replayFromPause = false, replayWasPaused = false;
  var tableOpen = false, replayIdx = -1;
  var handHistory = [], curActions = [], showdowns = 0, showdownWins = 0;
  var lastShownPot = -1, lastShownChips = -1, lastShownAi = -1;

  function tr(key, vars) {
    var s = T(key);
    if (vars) for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function formatNet(n) { return (n > 0 ? '+' : '') + n; }
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }
  function refreshBest() {
    best = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest('poker') : null;
    if (best === null) best = 0;
  }
  function submitRound() {
    if (window.Arcade && Arcade.shell) Arcade.shell.submitScore(chips);
    refreshBest();
    if (best < chips) best = chips;
  }
  function tableById(id) {
    for (var i = 0; i < TABLES.length; i++) if (TABLES[i].id === id) return TABLES[i];
    return TABLES[1];
  }
  function tableName(t) { return T(TABLE_I18N[(t || table).id] || TABLE_I18N.standard); }
  function tableNameById(id) { return tableName(tableById(id)); }
  function buyIn() { return table.buyin; }
  function goal() { return table.buyin * 2; }
  function blinds() {
    var lvl = Math.floor(Math.max(0, handNo - 1) / 10);
    var f = Math.pow(2, lvl);
    return { sb: table.sb * f, bb: table.bb * f };
  }
  function BB() { return blinds().bb; }

  /* ---------- 牌组 ---------- */
  function buildDeck() {
    var d = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) d.push({ s: SUITS[s], r: RANKS[r], uid: ++uidSeq });
    }
    for (var i = d.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
  }
  function draw() {
    if (!deck || !deck.length) deck = buildDeck();
    return deck.pop();
  }
  function isRed(c) { return c.s === '♥' || c.s === '♦'; }
  function cardSafe(c) { return c && typeof c.s === 'string' && typeof c.r === 'string' && SUITS.indexOf(c.s) >= 0 && RANKS.indexOf(c.r) >= 0; }
  function cardsSafe(a) { if (!Array.isArray(a)) return false; for (var i = 0; i < a.length; i++) if (!cardSafe(a[i])) return false; return true; }
  function normCards(a) {
    return a.map(function (c) { return { s: c.s, r: c.r, uid: typeof c.uid === 'number' ? c.uid : ++uidSeq }; });
  }
  function copyCards(a) {
    return (a || []).map(function (c) { return { s: c.s, r: c.r, uid: typeof c.uid === 'number' ? c.uid : ++uidSeq }; });
  }
  function safeCards(a) {
    if (!Array.isArray(a)) return [];
    var out = [];
    for (var i = 0; i < a.length; i++) {
      if (cardSafe(a[i])) out.push({ s: a[i].s, r: a[i].r, uid: typeof a[i].uid === 'number' ? a[i].uid : ++uidSeq });
    }
    return out;
  }

  /* ---------- 牌型评估：完整 7 选 5 ---------- */
  function ranksDesc(cards) {
    return cards.map(function (c) { return RV[c.r]; }).sort(function (a, b) { return b - a; });
  }
  function straightHigh(uniq) {
    /* uniq 为去重降序；A2345 返回 5，否则返回顺子最大牌 */
    for (var i = 0; i + 4 < uniq.length; i++) {
      if (uniq[i] - uniq[i + 4] === 4) return uniq[i];
    }
    if (uniq.indexOf(14) >= 0 && uniq.indexOf(5) >= 0 && uniq.indexOf(4) >= 0 && uniq.indexOf(3) >= 0 && uniq.indexOf(2) >= 0) return 5;
    return 0;
  }
  function evalFive(cards) {
    var vals = ranksDesc(cards);
    var flush = true, firstSuit = cards[0].s;
    for (var f = 1; f < cards.length; f++) if (cards[f].s !== firstSuit) { flush = false; break; }
    var uniq = vals.filter(function (v, i) { return vals.indexOf(v) === i; });
    var sHigh = straightHigh(uniq);

    var cnt = {}, groups = [];
    vals.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
    for (var k in cnt) if (Object.prototype.hasOwnProperty.call(cnt, k)) groups.push({ v: Number(k), n: cnt[k] });
    groups.sort(function (a, b) { return b.n - a.n || b.v - a.v; });

    if (flush && sHigh) return [8, sHigh];
    if (groups[0].n === 4) return [7, groups[0].v, groups[1] ? groups[1].v : 0];
    if (groups[0].n === 3 && groups[1] && groups[1].n === 2) return [6, groups[0].v, groups[1].v];
    if (flush) return [5].concat(vals);
    if (sHigh) return [4, sHigh];
    if (groups[0].n === 3) {
      var kick = groups.filter(function (g) { return g.n === 1; }).map(function (g) { return g.v; });
      return [3, groups[0].v, kick[0] || 0, kick[1] || 0];
    }
    var pairs = groups.filter(function (g) { return g.n === 2; }).sort(function (a, b) { return b.v - a.v; });
    if (pairs.length >= 2) {
      var kick2 = groups.filter(function (g) { return g.n === 1; }).map(function (g) { return g.v; });
      return [2, pairs[0].v, pairs[1].v, kick2[0] || 0];
    }
    if (pairs.length === 1) {
      var kick3 = groups.filter(function (g) { return g.n === 1; }).map(function (g) { return g.v; });
      kick3.sort(function (a, b) { return b - a; });
      return [1, pairs[0].v, kick3[0] || 0, kick3[1] || 0, kick3[2] || 0];
    }
    return [0].concat(vals);
  }
  function cmpEv(a, b) {
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }
  function choose5(arr, k, start, cur, out) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (var i = start; i <= arr.length - (k - cur.length); i++) {
      cur.push(arr[i]);
      choose5(arr, k, i + 1, cur, out);
      cur.pop();
    }
  }
  function bestHand(cards) {
    if (!cards || cards.length < 5) return { ev: [0, 0, 0, 0, 0], cards: [] };
    if (cards.length === 5) return { ev: evalFive(cards), cards: cards.slice() };
    var combos = [];
    choose5(cards, 5, 0, [], combos);
    var bestEv = null, bestCards = null;
    for (var i = 0; i < combos.length; i++) {
      var ev = evalFive(combos[i]);
      if (!bestEv || cmpEv(ev, bestEv) > 0) { bestEv = ev; bestCards = combos[i]; }
    }
    return { ev: bestEv, cards: bestCards };
  }
  function handName(cat) {
    var n = Number(cat);
    if (!isFinite(n) || n < 0 || n > 8) n = 0;
    return T('gs.poker.hand' + n);
  }

  /* ---------- 存档 ---------- */
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'poker',
      collect: function () {
        if (phase !== 'action') return null;
        return {
          v: 4, chips: chips, aiChips: aiChips, pot: pot, deck: deck,
          playerCards: playerCards, aiCards: aiCards, boardCards: boardCards,
          street: street, streetBet: streetBet, invested: invested, acted: acted,
          sbIsPlayer: sbIsPlayer, handNo: handNo, lastRaiseSize: lastRaiseSize,
          aiRaisesThisStreet: aiRaisesThisStreet, startChips: startChips,
          table: table.id, handHistory: handHistory, showdowns: showdowns, showdownWins: showdownWins
        };
      },
      apply: function (s) {
        if (!s || typeof s !== 'object') return false;
        if (typeof s.chips !== 'number' || !isFinite(s.chips) || s.chips < 0) return false;
        table = tableById(s.table);
        var fullState = cardsSafe(s.playerCards) && s.playerCards.length === 2 &&
          cardsSafe(s.aiCards) && s.aiCards.length === 2 &&
          cardsSafe(s.boardCards) && (s.boardCards.length === 0 || (s.boardCards.length >= 3 && s.boardCards.length <= 5)) &&
          Array.isArray(s.deck) && cardsSafe(s.deck) && s.deck.length >= 8 &&
          s.streetBet && typeof s.streetBet.p === 'number' && typeof s.streetBet.a === 'number' &&
          s.invested && typeof s.invested.p === 'number' && typeof s.invested.a === 'number';
        if (!s.v && !fullState) {
          /* 仅含筹码的旧档：保留筹码与桌台，安全重开一手 */
          chips = Math.floor(s.chips);
          aiChips = buyIn();
          handNo = 0;
          handHistory = []; showdowns = 0; showdownWins = 0;
          phase = 'action'; currentActor = 'player';
          hideResult(); resetPanels();
          startNewHand();
          return true;
        }
        if (!cardsSafe(s.playerCards) || s.playerCards.length !== 2) return false;
        if (!cardsSafe(s.aiCards) || s.aiCards.length !== 2) return false;
        if (!cardsSafe(s.boardCards) || s.boardCards.length > 5) return false;
        if (!Array.isArray(s.deck) || !cardsSafe(s.deck) || s.deck.length < 8) return false;
        var st = s.boardCards.length;
        if (st === 0) street = 0;
        else if (st === 3) street = 1;
        else if (st === 4) street = 2;
        else if (st === 5) street = 3;
        else return false;
        if (!s.streetBet || typeof s.streetBet.p !== 'number' || typeof s.streetBet.a !== 'number') return false;
        if (!s.invested || typeof s.invested.p !== 'number' || typeof s.invested.a !== 'number') return false;
        chips = Math.floor(s.chips);
        aiChips = (typeof s.aiChips === 'number' && s.aiChips >= 0) ? Math.floor(s.aiChips) : buyIn();
        pot = (typeof s.pot === 'number' && s.pot >= 0) ? Math.floor(s.pot) : 0;
        deck = normCards(s.deck);
        playerCards = normCards(s.playerCards);
        aiCards = normCards(s.aiCards);
        boardCards = normCards(s.boardCards);
        streetBet = { p: Math.max(0, s.streetBet.p), a: Math.max(0, s.streetBet.a) };
        invested = { p: Math.max(0, s.invested.p), a: Math.max(0, s.invested.a) };
        acted = { p: !!(s.acted && s.acted.p), a: !!(s.acted && s.acted.a) };
        sbIsPlayer = !!s.sbIsPlayer;
        handNo = (typeof s.handNo === 'number' && s.handNo > 0) ? Math.floor(s.handNo) : 1;
        lastRaiseSize = (typeof s.lastRaiseSize === 'number' && s.lastRaiseSize > 0) ? s.lastRaiseSize : BB();
        aiRaisesThisStreet = (typeof s.aiRaisesThisStreet === 'number') ? s.aiRaisesThisStreet : 0;
        startChips = (typeof s.startChips === 'number') ? s.startChips : chips + invested.p;
        handHistory = sanitizeHistory(s.handHistory);
        showdowns = (typeof s.showdowns === 'number' && s.showdowns >= 0) ? Math.floor(s.showdowns) : 0;
        showdownWins = (typeof s.showdownWins === 'number' && s.showdownWins >= 0) ? Math.min(Math.floor(s.showdownWins), showdowns) : 0;
        activeToken++;
        phase = 'action'; currentActor = 'player'; revealAI = false;
        paused = false; resetPanels();
        hideResult();
        setMsg(T('gs.poker.resumeMsg') + ' · ' + tableName() + ' · ' + streetLabel());
        render();
        if (chips <= 0) scheduleAutoCheck();
        return true;
      }
    });
  }

  function sanitizeHistory(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    var start = Math.max(0, list.length - MAX_HISTORY);
    for (var i = start; i < list.length; i++) {
      var r = list[i];
      if (!r || typeof r !== 'object') continue;
      var rec = {
        n: typeof r.n === 'number' ? Math.floor(r.n) : 0,
        t: (r.t === 'rookie' || r.t === 'standard' || r.t === 'pro') ? r.t : 'standard',
        sb: typeof r.sb === 'number' ? r.sb : 0,
        bb: typeof r.bb === 'number' ? r.bb : 0,
        p: safeCards(r.p), a: safeCards(r.a), b: safeCards(r.b),
        acts: Array.isArray(r.acts) ? r.acts.slice(0, 160) : [],
        kind: r.kind === 'fold' ? 'fold' : 'show',
        res: (r.res === 'lose' || r.res === 'draw' || r.res === 'foldwin' || r.res === 'foldlose') ? r.res : 'win',
        pCat: typeof r.pCat === 'number' ? r.pCat : 0,
        aCat: typeof r.aCat === 'number' ? r.aCat : 0,
        pot: typeof r.pot === 'number' ? r.pot : 0,
        net: typeof r.net === 'number' ? r.net : 0,
        chipsAfter: typeof r.chipsAfter === 'number' ? r.chipsAfter : 0,
        aiChipsAfter: typeof r.aiChipsAfter === 'number' ? r.aiChipsAfter : 0,
        over: !!r.over
      };
      out.push(rec);
    }
    return out;
  }

  function streetName(n) {
    if (n === 0) return T('gs.poker.streetPre');
    if (n === 1) return T('gs.poker.streetFlop');
    if (n === 2) return T('gs.poker.streetTurn');
    return T('gs.poker.streetRiver');
  }
  function streetLabel() { return streetName(street); }

  /* ---------- DOM ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'pk-wrap';
  wrap.innerHTML =
    '<canvas class="pk-felt" id="pk-felt" aria-hidden="true"></canvas>' +
    '<div class="pk-hud">' +
    '  <span class="pk-hud-table" id="pk-table">--</span>' +
    '  <span>' + T('gs.poker.you') + ' <b class="pk-num" id="pk-chips">0</b></span>' +
    '  <span>' + T('gs.poker.ai') + ' <b class="pk-num" id="pk-aichips">0</b></span>' +
    '  <span>' + T('gs.poker.blind') + ' <b id="pk-blinds">5/10</b></span>' +
    '  <span>' + T('gs.poker.best') + ' <b class="pk-best" id="pk-best">0</b></span>' +
    '  <button class="pk-pause-btn" id="pk-pause" type="button" aria-label="' + T('gs.poker.pause') + '">' +
    '    <span class="pk-ico">' + SVG_PAUSE + '</span><span>' + T('gs.poker.pause') + '</span>' +
    '  </button>' +
    '</div>' +
    '<div class="pk-side ai" id="pk-ai-side">' +
    '  <div class="pk-label" id="pk-ailabel"></div>' +
    '  <div class="pk-hand" id="pk-ai"></div>' +
    '</div>' +
    '<div class="pk-mid">' +
    '  <div class="pk-board" id="pk-board"></div>' +
    '  <div class="pk-potbox" id="pk-potbox"><span class="pk-potchip"></span>' + T('gs.poker.pot') + ' <b id="pk-pot">0</b></div>' +
    '</div>' +
    '<div class="pk-side me" id="pk-me-side">' +
    '  <div class="pk-label">' + T('gs.poker.yourHand') + '</div>' +
    '  <div class="pk-hand" id="pk-me"></div>' +
    '</div>' +
    '<div class="pk-msg" id="pk-msg"></div>' +
    '<div class="pk-controls">' +
    '  <button class="btn green" id="pk-call" type="button"></button>' +
    '  <button class="btn yellow" id="pk-raise" type="button"></button>' +
    '  <button class="btn pink" id="pk-fold" type="button">' + T('gs.poker.fold') + '</button>' +
    '  <button class="btn yellow" id="pk-show" type="button" style="display:none">' + T('gs.poker.show') + '</button>' +
    '</div>' +
    '<div class="pk-controls pk-controls-sub">' +
    '  <button class="btn purple" id="pk-replay" type="button"><span class="pk-ico">' + SVG_REPLAY + '</span>' + T('gs.poker.replay') + '</button>' +
    '  <button class="btn" id="pk-restart" type="button">' + T('gs.poker.restart') + '</button>' +
    '</div>' +
    '<div class="pk-result" id="pk-result"><div class="pk-result-box">' +
    '  <div class="pk-result-title" id="pk-rtitle"></div>' +
    '  <div class="pk-result-sub" id="pk-rsub"></div>' +
    '  <div class="pk-result-stats" id="pk-rstats"></div>' +
    '  <div class="pk-result-btns">' +
    '    <button class="btn green" id="pk-next" type="button">' + T('gs.poker.next') + '</button>' +
    '    <button class="btn green" id="pk-again" type="button" style="display:none">' + T('gs.poker.again') + '</button>' +
    '    <button class="btn purple" id="pk-replay-r" type="button">' + T('gs.poker.resultReplay') + '</button>' +
    '    <button class="btn yellow" id="pk-change" type="button">' + T('gs.poker.changeTableAgain') + '</button>' +
    '  </div>' +
    '</div></div>' +
    '<div class="pk-overlay" id="pk-select" role="dialog" aria-modal="true" aria-labelledby="pk-select-title">' +
    '  <div class="pk-panel pk-panel-wide">' +
    '    <div class="pk-panel-kicker">' + T('gs.poker.tableKicker') + '</div>' +
    '    <div class="pk-panel-title" id="pk-select-title">' + T('gs.poker.tableTitle') + '</div>' +
    '    <div class="pk-panel-sub">' + T('gs.poker.tableSub') + '</div>' +
    '    <div class="pk-tables" id="pk-tables"></div>' +
    '    <div class="pk-panel-foot">' + T('gs.poker.tableHint') + '</div>' +
    '  </div>' +
    '</div>' +
    '<div class="pk-overlay" id="pk-pause-panel" role="dialog" aria-modal="true" aria-labelledby="pk-pause-title">' +
    '  <div class="pk-panel pk-panel-sm">' +
    '    <div class="pk-panel-title" id="pk-pause-title">' + T('gs.poker.pauseTitle') + '</div>' +
    '    <div class="pk-panel-sub">' + T('gs.poker.pauseSub') + '</div>' +
    '    <div class="pk-panel-btns">' +
    '      <button class="btn green" id="pk-resume" type="button">' + T('gs.poker.resume') + '</button>' +
    '      <button class="btn purple" id="pk-p-replay" type="button">' + T('gs.poker.replay') + '</button>' +
    '      <button class="btn yellow" id="pk-p-table" type="button">' + T('gs.poker.changeTable') + '</button>' +
    '      <button class="btn pink" id="pk-p-restart" type="button">' + T('gs.poker.restart') + '</button>' +
    '    </div>' +
    '    <div class="pk-key-hint">' + T('gs.poker.keyHint') + '</div>' +
    '  </div>' +
    '</div>' +
    '<div class="pk-overlay pk-overlay-replay" id="pk-replay-panel" role="dialog" aria-modal="true" aria-labelledby="pk-replay-title">' +
    '  <div class="pk-panel pk-panel-wide">' +
    '    <div class="pk-panel-head">' +
    '      <div>' +
    '        <div class="pk-panel-title" id="pk-replay-title">' + T('gs.poker.replayTitle') + '</div>' +
    '        <div class="pk-panel-sub" id="pk-replay-sub"></div>' +
    '      </div>' +
    '      <button class="pk-icon-btn" id="pk-replay-close" type="button" aria-label="' + T('gs.poker.replayClose') + '">' + SVG_CLOSE + '</button>' +
    '    </div>' +
    '    <div class="pk-replay-body">' +
    '      <div class="pk-replay-side">' +
    '        <div class="pk-replay-list" id="pk-replay-list"></div>' +
    '        <div class="pk-replay-nav">' +
    '          <button class="pk-icon-btn" id="pk-replay-prev" type="button" aria-label="' + T('gs.poker.replayPrev') + '">' + SVG_LEFT + '</button>' +
    '          <button class="pk-icon-btn" id="pk-replay-next" type="button" aria-label="' + T('gs.poker.replayNext') + '">' + SVG_RIGHT + '</button>' +
    '        </div>' +
    '      </div>' +
    '      <div class="pk-replay-detail" id="pk-replay-detail"></div>' +
    '    </div>' +
    '  </div>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#pk-felt');
  var cctx = canvas ? canvas.getContext('2d') : null;
  var chipsEl = wrap.querySelector('#pk-chips'), aiChipsEl = wrap.querySelector('#pk-aichips'),
      blindsEl = wrap.querySelector('#pk-blinds'), bestEl = wrap.querySelector('#pk-best'),
      tableEl = wrap.querySelector('#pk-table'),
      aiEl = wrap.querySelector('#pk-ai'), meEl = wrap.querySelector('#pk-me'), boardEl = wrap.querySelector('#pk-board'),
      aiLabel = wrap.querySelector('#pk-ailabel'), potEl = wrap.querySelector('#pk-pot'), potBox = wrap.querySelector('#pk-potbox'),
      aiSide = wrap.querySelector('#pk-ai-side'), meSide = wrap.querySelector('#pk-me-side'),
      msg = wrap.querySelector('#pk-msg'), callBtn = wrap.querySelector('#pk-call'), raiseBtn = wrap.querySelector('#pk-raise'),
      foldBtn = wrap.querySelector('#pk-fold'), showBtn = wrap.querySelector('#pk-show'),
      restartBtn = wrap.querySelector('#pk-restart'), replayBtn = wrap.querySelector('#pk-replay'),
      pauseBtn = wrap.querySelector('#pk-pause'),
      resultEl = wrap.querySelector('#pk-result'), rTitle = wrap.querySelector('#pk-rtitle'), rSub = wrap.querySelector('#pk-rsub'),
      rStats = wrap.querySelector('#pk-rstats'), nextBtn = wrap.querySelector('#pk-next'), againBtn = wrap.querySelector('#pk-again'),
      replayRBtn = wrap.querySelector('#pk-replay-r'), changeBtn = wrap.querySelector('#pk-change'),
      selectEl = wrap.querySelector('#pk-select'), tablesEl = wrap.querySelector('#pk-tables'),
      pauseEl = wrap.querySelector('#pk-pause-panel'), resumeBtn = wrap.querySelector('#pk-resume'),
      pReplayBtn = wrap.querySelector('#pk-p-replay'), pTableBtn = wrap.querySelector('#pk-p-table'),
      pRestartBtn = wrap.querySelector('#pk-p-restart'),
      replayEl = wrap.querySelector('#pk-replay-panel'), replaySub = wrap.querySelector('#pk-replay-sub'),
      replayList = wrap.querySelector('#pk-replay-list'), replayDetail = wrap.querySelector('#pk-replay-detail'),
      replayCloseBtn = wrap.querySelector('#pk-replay-close'), replayPrevBtn = wrap.querySelector('#pk-replay-prev'),
      replayNextBtn = wrap.querySelector('#pk-replay-next');

  /* 固定面板挂到 body，避免被 .pk-wrap 的 isolation 困在顶栏之下 */
  if (document.body) {
    document.body.appendChild(selectEl);
    document.body.appendChild(pauseEl);
    document.body.appendChild(replayEl);
  }
  function syncOverlayTop() {
    var header = document.querySelector('.shell-header');
    var offset = header ? Math.max(0, Math.round(header.getBoundingClientRect().height)) : 0;
    [selectEl, pauseEl, replayEl].forEach(function (el) {
      if (el) el.style.top = offset + 'px';
    });
  }

  function setMsg(text, color) { msg.textContent = text; msg.style.color = color || ''; }
  function bump(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* ---------- 卡牌渲染 ---------- */
  function cardMarkup(c, up) {
    if (!cardSafe(c)) return '<div class="pk-card empty"></div>';
    return '<div class="pk-card' + (up ? '' : ' down') + (isRed(c) ? ' red' : '') + '">' +
      '<div class="pk-inner"><div class="pk-face">' +
      '<span class="pk-r tl">' + c.r + '</span><span class="pk-s">' + c.s + '</span><span class="pk-r br">' + c.r + '</span>' +
      '</div><div class="pk-back"><span>♦</span></div></div></div>';
  }
  function cardEl(c, up) {
    var el = document.createElement('div');
    el.className = 'pk-card' + (up ? '' : ' down') + (isRed(c) ? ' red' : '');
    el.innerHTML =
      '<div class="pk-inner"><div class="pk-face">' +
      '<span class="pk-r tl">' + c.r + '</span><span class="pk-s">' + c.s + '</span><span class="pk-r br">' + c.r + '</span>' +
      '</div><div class="pk-back"><span>♦</span></div></div>';
    return el;
  }
  function emptyCard() {
    var el = document.createElement('div');
    el.className = 'pk-card empty';
    return el;
  }
  function setSlot(container, i, c, up, newEls) {
    var old = container.children[i];
    if (!c) {
      if (old && old.classList.contains('empty')) return;
      var emp = emptyCard();
      if (old) container.replaceChild(emp, old); else container.appendChild(emp);
      return;
    }
    if (!old) {
      var el0 = cardEl(c, up);
      el0.setAttribute('data-uid', String(c.uid));
      el0.setAttribute('data-up', up ? '1' : '0');
      el0.classList.add('deal');
      container.appendChild(el0);
      newEls.push(el0);
      return;
    }
    var isPlaceholder = old.classList.contains('empty');
    if (!isPlaceholder && old.getAttribute('data-uid') === String(c.uid) && old.getAttribute('data-up') === (up ? '1' : '0')) return;
    var el = cardEl(c, up);
    el.setAttribute('data-uid', String(c.uid));
    el.setAttribute('data-up', up ? '1' : '0');
    el.classList.add(isPlaceholder ? 'deal' : 'flip');
    container.replaceChild(el, old);
    newEls.push(el);
  }
  function renderSlots(container, cards, slots, hiddenAll, newEls, delayStep) {
    while (container.children.length < slots) container.appendChild(emptyCard());
    while (container.children.length > slots) container.removeChild(container.lastElementChild);
    var added = 0;
    for (var i = 0; i < slots; i++) {
      var c = (i < cards.length) ? cards[i] : null;
      var before = newEls.length;
      setSlot(container, i, c, c ? !hiddenAll : false, newEls);
      if (newEls.length > before) {
        var el = newEls[newEls.length - 1];
        el.style.animationDelay = ((added++) * (delayStep || 0)).toFixed(2) + 's';
      }
    }
  }
  function burstNew(els) {
    if (!window.Arcade || !Arcade.fx) return;
    for (var i = 0; i < els.length; i++) {
      try {
        var r = els[i].getBoundingClientRect();
        if (r.width) Arcade.fx.burst(r.left + r.width / 2, r.top + r.height / 2, '#ffd447', 6);
      } catch (e) {}
    }
  }

  function clearWinHighlights() {
    var els = wrap.querySelectorAll('.pk-card.win-card');
    for (var i = 0; i < els.length; i++) els[i].classList.remove('win-card');
    winRects = [];
    winGlowUntil = 0;
  }
  function markWinningCards(cards) {
    clearWinHighlights();
    if (!cards || !cards.length) return;
    var ids = {};
    for (var i = 0; i < cards.length; i++) if (cards[i] && cards[i].uid != null) ids[String(cards[i].uid)] = true;
    var els = wrap.querySelectorAll('.pk-card[data-uid]');
    for (var j = 0; j < els.length; j++) {
      if (ids[els[j].getAttribute('data-uid')]) els[j].classList.add('win-card');
    }
    winGlowUntil = performance.now() + 1800;
    measureFx();
  }

  function render() {
    var newEls = [];
    renderSlots(boardEl, boardCards || [], 5, false, newEls, 0.10);
    renderSlots(meEl, playerCards || [], 2, false, newEls, 0.14);
    renderSlots(aiEl, aiCards || [], 2, !revealAI, newEls, 0.14);

    chipsEl.textContent = String(chips);
    aiChipsEl.textContent = String(aiChips);
    var b = blinds();
    blindsEl.textContent = b.sb + '/' + b.bb;
    bestEl.textContent = String(best);
    tableEl.textContent = tableName() + ' · ' + b.sb + '/' + b.bb;
    potEl.textContent = String(pot);
    aiLabel.textContent = tr('gs.poker.aiLabel', { n: aiChips }) + ' · ' + streetLabel();

    if (lastShownPot !== pot) {
      if (pot > lastShownPot && lastShownPot >= 0) { bump(potBox); potPulseAt = performance.now(); }
      lastShownPot = pot;
    }
    if (lastShownChips !== chips) { if (lastShownChips >= 0) bump(chipsEl); lastShownChips = chips; }
    if (lastShownAi !== aiChips) { if (lastShownAi >= 0) bump(aiChipsEl); lastShownAi = aiChips; }

    var canAct = phase === 'action' && currentActor === 'player';
    var toCall = canAct ? toCallP() : 0;
    if (canAct && toCall > 0) callBtn.textContent = tr('gs.poker.callN', { n: Math.min(toCall, chips) });
    else callBtn.textContent = T('gs.poker.check');
    callBtn.disabled = !canAct || (toCall > 0 && chips <= 0);

    var target = Math.max(streetBet ? streetBet.p : 0, streetBet ? streetBet.a : 0);
    var raiseTo = Math.min(target + Math.max(BB(), lastRaiseSize), (streetBet ? streetBet.p : 0) + chips);
    if (raiseTo < target) raiseTo = target;
    raiseBtn.textContent = canAct ? tr('gs.poker.raiseN', { n: raiseTo }) : T('gs.poker.raise');
    raiseBtn.disabled = !canAct || chips <= toCall || chips <= 0;

    foldBtn.disabled = !canAct || chips <= 0;
    showBtn.style.display = (phase === 'showdown') ? '' : 'none';
    showBtn.disabled = phase !== 'showdown';
    replayBtn.disabled = handHistory.length === 0 && phase !== 'result' && phase !== 'over';
    updateResultButtons();
    burstNew(newEls);
    measureFx();
  }

  function updateResultButtons() {
    if (!nextBtn || !againBtn) return;
    nextBtn.style.display = (phase === 'over') ? 'none' : '';
    againBtn.style.display = (phase === 'over') ? '' : 'none';
  }

  /* ---------- 下注金额 ---------- */
  function toCallP() { return Math.max(0, streetBet.a - streetBet.p); }
  function toCallA() { return Math.max(0, streetBet.p - streetBet.a); }

  function payPlayer(amount) {
    amount = Math.min(amount, chips);
    if (amount <= 0) return 0;
    chips -= amount; pot += amount; streetBet.p += amount; invested.p += amount;
    return amount;
  }
  function payAI(amount) {
    amount = Math.min(amount, aiChips);
    if (amount <= 0) return 0;
    aiChips -= amount; pot += amount; streetBet.a += amount; invested.a += amount;
    return amount;
  }

  function flyChips(fromEl, count, color) {
    if (!fromEl || !potEl || !document.body) return;
    try {
      var a = fromEl.getBoundingClientRect(), b = potEl.getBoundingClientRect();
      for (var i = 0; i < count; i++) {
        var d = document.createElement('div');
        d.className = 'pk-fly';
        d.style.left = (a.left + a.width / 2 - 6) + 'px';
        d.style.top = (a.top + a.height / 2 - 6) + 'px';
        d.style.background = color || '#ffd447';
        document.body.appendChild(d);
        (function (el, tx, ty, delay, spin) {
          requestAnimationFrame(function () {
            el.style.transition = 'transform .62s cubic-bezier(.18,.72,.28,1), opacity .62s ease';
            el.style.transitionDelay = (delay * 0.045) + 's';
            el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + spin + 'deg) scale(.5)';
            el.style.opacity = '0.12';
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 860);
          });
        })(d, b.left + b.width / 2 - (a.left + a.width / 2), b.top + b.height / 2 - (a.top + a.height / 2), i, 300 + i * 40);
      }
    } catch (e) {}
  }

  /* ---------- 行动记录 ---------- */
  function logAction(who, kind, amount, to) {
    curActions.push({
      s: street,
      w: who,
      k: kind,
      n: typeof amount === 'number' ? amount : 0,
      to: typeof to === 'number' ? to : 0
    });
  }

  /* ---------- 开局 / 发牌 ---------- */
  function postBlind(seat, amount) {
    if (seat === 'p') {
      var ap = Math.min(amount, chips);
      chips -= ap; pot += ap; streetBet.p += ap; invested.p += ap;
    } else {
      var aa = Math.min(amount, aiChips);
      aiChips -= aa; pot += aa; streetBet.a += aa; invested.a += aa;
    }
  }

  function startNewHand() {
    activeToken++;
    hideResult();
    resetPanels();
    aiSide.classList.remove('win'); meSide.classList.remove('win');
    revealAI = false;
    clearWinHighlights();
    if (chips <= 0) { playerBroke(); return; }
    if (aiChips <= 0) { aiBroke(); return; }
    handNo++;
    sbIsPlayer = (handNo % 2 === 1);
    deck = buildDeck();
    playerCards = [draw(), draw()];
    aiCards = [draw(), draw()];
    boardCards = [];
    pot = 0;
    street = 0;
    streetBet = { p: 0, a: 0 };
    invested = { p: 0, a: 0 };
    acted = { p: false, a: false };
    aiRaisesThisStreet = 0;
    lastRaiseSize = BB();
    startChips = chips;
    curActions = [];
    var b = blinds();
    postBlind(sbIsPlayer ? 'p' : 'a', b.sb);
    postBlind(sbIsPlayer ? 'a' : 'p', b.bb);
    setMsg(tr('gs.poker.handStart', { a: b.sb, b: b.bb }), 'var(--neon-cyan)');
    if (Arcade.audio) Arcade.audio.play('drop');
    beginStreet(0);
  }

  function addBoard(n) {
    for (var i = 0; i < n; i++) boardCards.push(draw());
    if (Arcade.audio) Arcade.audio.play('drop');
  }

  function beginStreet(n) {
    street = n;
    acted = { p: false, a: false };
    aiRaisesThisStreet = 0;
    lastRaiseSize = BB();
    if (n > 0) {
      streetBet = { p: 0, a: 0 };
      addBoard(n === 1 ? 3 : 1);
    }
    render();
    var first = (n === 0) ? (sbIsPlayer ? 'player' : 'ai') : (sbIsPlayer ? 'ai' : 'player');
    enterTurn(first);
  }

  function scheduleAI() {
    var token = activeToken;
    setTimeout(function () {
      if (token !== activeToken || paused) return;
      if (phase === 'ai') aiAct();
    }, 520);
  }
  function scheduleAutoCheck() {
    var tok = activeToken;
    setTimeout(function () {
      if (tok !== activeToken || paused) return;
      if (phase === 'action' && currentActor === 'player' && chips <= 0) playerAct('check');
    }, 260);
  }

  function enterTurn(actor) {
    currentActor = actor;
    phase = (actor === 'player') ? 'action' : 'ai';
    render();
    if (actor === 'player') {
      setMsg(T('gs.poker.yourTurn') + ' · ' + streetLabel());
      writeSave();
      if (chips <= 0) scheduleAutoCheck();
      return;
    }
    setMsg(T('gs.poker.aiThinking') + ' · ' + streetLabel());
    scheduleAI();
  }

  function afterAction(seat) {
    if (phase === 'result' || phase === 'over') return;
    render();
    if (acted.p && acted.a && streetBet.p === streetBet.a) { closeStreet(); return; }
    if (seat === 'p') enterTurn('ai'); else enterTurn('player');
  }

  function closeStreet() {
    if (street >= 3) { beginShowdown(); return; }
    beginStreet(street + 1);
  }

  function beginShowdown() {
    phase = 'showdown';
    currentActor = null;
    render();
    writeSave();
    setMsg(T('gs.poker.showHint'), 'var(--neon-yellow)');
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------- 玩家行动 ---------- */
  function playerAct(kind) {
    if (phase !== 'action' || currentActor !== 'player') return;
    var toCall = toCallP();
    if (kind === 'check' && toCall > 0) kind = 'call';

    if (kind === 'fold') {
      logAction('p', 'fold');
      if (Arcade.audio) Arcade.audio.play('back');
      settleFold('ai');
      return;
    }
    if (kind === 'check') {
      acted.p = true;
      logAction('p', 'check');
      setMsg(T('gs.poker.youCheck'), 'var(--text-dim)');
      afterAction('p');
      return;
    }
    if (kind === 'call') {
      var paid = payPlayer(toCall);
      acted.p = true;
      logAction('p', 'call', paid, streetBet.p);
      if (paid > 0) {
        flyChips(meEl, Math.max(2, Math.min(6, Math.ceil(paid / 10))), '#ffd447');
        setMsg(tr('gs.poker.youCall', { n: paid }), 'var(--neon-cyan)');
        if (Arcade.audio) Arcade.audio.play('coin');
      } else {
        setMsg(T('gs.poker.youCheck'), 'var(--text-dim)');
      }
      if (paid < toCall || chips <= 0) {
        /* 短筹码全下跟注：单挑无需边池，立即退回多下部分并结束本街 */
        refundExcess();
        closeStreet();
        return;
      }
      afterAction('p');
      return;
    }
    if (kind === 'raise') {
      if (chips <= toCall) { playerAct('call'); return; }
      var target = Math.max(streetBet.p, streetBet.a);
      var step = Math.max(BB(), lastRaiseSize);
      var wanted = target + step;
      var pay = Math.min(wanted - streetBet.p, chips);
      if (pay <= toCall) { playerAct('call'); return; }
      payPlayer(pay);
      lastRaiseSize = Math.max(BB(), pay - toCall);
      acted.p = true; acted.a = false;
      logAction('p', 'raise', pay, streetBet.p);
      flyChips(meEl, Math.max(3, Math.min(8, Math.ceil(pay / 10))), '#ffd447');
      setMsg(tr('gs.poker.youRaise', { n: streetBet.p }), 'var(--neon-yellow)');
      if (Arcade.audio) Arcade.audio.play('coin');
      afterAction('p');
    }
  }

  /* ---------- AI 决策（纯函数：牌力评估 + 风格决策，供游戏与仿真共用） ---------- */
  function preflopStrengthOf(cards) {
    if (!cards || cards.length < 2) return 0.05;
    var a = RV[cards[0].r], b = RV[cards[1].r];
    var hi = Math.max(a, b), lo = Math.min(a, b);
    var suited = cards[0].s === cards[1].s;
    var s;
    if (a === b) {
      s = 0.5 + (hi - 2) / 12 * 0.45;
    } else {
      s = (hi + lo) / 28 * 0.48;
      if (suited) s += 0.07;
      if (hi === 14) s += 0.11;
      if (lo >= 10) s += 0.05;
      var gap = hi - lo;
      if (gap === 1) s += 0.06; else if (gap === 2) s += 0.03;
      if (lo < 6 && hi < 10) s -= 0.08;
    }
    return clamp(s, 0.05, 1);
  }
  function strengthOf(cards, board, street) {
    board = board || [];
    if (typeof street !== 'number') street = board.length === 0 ? 0 : board.length - 2;
    if (street === 0) return preflopStrengthOf(cards);
    if (!cards || cards.length < 2) return 0;
    var ev = bestHand(cards.concat(board)).ev;
    var base = [0.2, 0.45, 0.6, 0.72, 0.79, 0.84, 0.9, 0.95, 0.99][ev[0]];
    if (ev[0] === 0) {
      base = 0.16 + Math.max(RV[cards[0].r], RV[cards[1].r]) / 14 * 0.12;
    }
    return clamp(base, 0, 1);
  }
  /* decide(style, { toCall, pot, inPos, raises, stack, board, cards, bb, street? }) → 'check' | 'call' | 'raise' | 'fold' */
  function decide(style, ctx) {
    var st = style || AI_STYLES.normal;
    var c = ctx || {};
    var board = c.board || [];
    var s = clamp(strengthOf(c.cards, board, c.street) + (c.inPos ? st.pos : 0), 0, 1);
    var toCall = c.toCall || 0;
    var pot = c.pot || 0;
    var raises = c.raises || 0;
    var stack = typeof c.stack === 'number' ? c.stack : 0;
    var bb = c.bb || 1;
    var potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    var r = Math.random();

    if (toCall === 0) {
      if (s > st.openStrong && r < st.openStrongP && raises < st.maxRaises) return 'raise';
      if (s > st.openMid && r < st.openMidP && raises < st.maxRaises) return 'raise';
      if (st.bluff > 0 && s < st.bluffMax && r < st.bluff && raises < st.maxRaises && stack > bb * 4) return 'raise';
      return 'check';
    }
    if (s < st.foldLow && potOdds > 0.30 && r > st.foldR) return 'fold';
    if (s < st.foldLow2 && potOdds > 0.20 && r > (st.foldR2 || st.foldR)) return 'fold';
    if (s > st.raiseStrong && r < st.raiseStrongP && raises < st.maxRaises) return 'raise';
    if (s > st.raiseMid && r < st.raiseMidP && raises < st.maxRaises) return 'raise';
    if (st.bluff > 0 && s < st.bluffMax && potOdds < 0.22 && r < st.bluff && raises < st.maxRaises) return 'raise';
    return 'call';
  }
  /* 线上 AI 的薄封装：只负责把当前牌局状态喂给纯函数 decide */
  function aiDecide(toCall) {
    return decide(AI_STYLES[table.style] || AI_STYLES.normal, {
      toCall: toCall, pot: pot, inPos: !sbIsPlayer, raises: aiRaisesThisStreet,
      stack: aiChips, board: boardCards, cards: aiCards, bb: BB(), street: street
    });
  }
  function aiAct() {
    if (phase !== 'ai' || paused) return;
    var toCall = toCallA();
    if (chips <= 0 && toCall === 0) {
      /* 对手已全下，AI 不再下注，只过牌推进公共牌 */
      acted.a = true;
      logAction('a', 'check');
      setMsg(T('gs.poker.aiCheck'), 'var(--text-dim)');
      afterAction('a');
      return;
    }
    if (aiChips <= 0) {
      acted.a = true;
      logAction('a', 'check');
      setMsg(T('gs.poker.aiCheck'), 'var(--text-dim)');
      afterAction('a');
      return;
    }
    var d = aiDecide(toCall);
    if (d === 'fold') {
      logAction('a', 'fold');
      if (Arcade.audio) Arcade.audio.play('back');
      setMsg(T('gs.poker.aiFold'), 'var(--neon-green)');
      settleFold('player');
      return;
    }
    if (d === 'check') {
      acted.a = true;
      logAction('a', 'check');
      setMsg(T('gs.poker.aiCheck'), 'var(--text-dim)');
      afterAction('a');
      return;
    }
    if (d === 'call') {
      var paid = payAI(toCall);
      acted.a = true;
      logAction('a', 'call', paid, streetBet.a);
      if (paid > 0) {
        flyChips(aiEl, Math.max(2, Math.min(6, Math.ceil(paid / 10))), '#7fe7ff');
        setMsg(tr('gs.poker.aiCall', { n: paid }), 'var(--neon-cyan)');
        if (Arcade.audio) Arcade.audio.play('coin');
      } else {
        setMsg(T('gs.poker.aiCheck'), 'var(--text-dim)');
      }
      if (paid < toCall || aiChips <= 0) {
        refundExcess();
        closeStreet();
        return;
      }
      afterAction('a');
      return;
    }
    /* raise */
    if (aiChips <= toCall) { aiActCallFallback(toCall); return; }
    var target = Math.max(streetBet.p, streetBet.a);
    var step = Math.max(BB(), Math.floor(pot * 0.5), lastRaiseSize);
    var wanted = target + step;
    var pay = Math.min(wanted - streetBet.a, aiChips);
    if (pay <= toCall) { aiActCallFallback(toCall); return; }
    payAI(pay);
    lastRaiseSize = Math.max(BB(), pay - toCall);
    aiRaisesThisStreet++;
    acted.a = true; acted.p = false;
    logAction('a', 'raise', pay, streetBet.a);
    flyChips(aiEl, Math.max(3, Math.min(8, Math.ceil(pay / 10))), '#7fe7ff');
    setMsg(tr('gs.poker.aiRaise', { n: streetBet.a }), 'var(--neon-yellow)');
    if (Arcade.audio) Arcade.audio.play('coin');
    afterAction('a');
  }
  function aiActCallFallback(toCall) {
    var paid = payAI(toCall);
    acted.a = true;
    logAction('a', 'call', paid, streetBet.a);
    setMsg(paid > 0 ? tr('gs.poker.aiCall', { n: paid }) : T('gs.poker.aiCheck'), 'var(--neon-cyan)');
    if (paid < toCall || aiChips <= 0) { refundExcess(); closeStreet(); return; }
    afterAction('a');
  }

  /* ---------- 结算 ---------- */
  function refundExcess() {
    if (invested.p < invested.a) {
      var back = invested.a - invested.p;
      aiChips += back; pot -= back; invested.a -= back;
    } else if (invested.a < invested.p) {
      var back2 = invested.p - invested.a;
      chips += back2; pot -= back2; invested.p -= back2;
    }
  }

  function recordFinishedHand(info) {
    var b = blinds();
    var net = chips - startChips;
    var rec = {
      n: handNo, t: table.id, sb: b.sb, bb: b.bb,
      p: copyCards(playerCards), a: copyCards(aiCards), b: copyCards(boardCards),
      acts: curActions.slice(),
      kind: info.kind, res: info.res,
      pCat: typeof info.pCat === 'number' ? info.pCat : 0,
      aCat: typeof info.aCat === 'number' ? info.aCat : 0,
      pot: info.potWon || 0,
      net: net,
      chipsAfter: chips,
      aiChipsAfter: aiChips,
      over: chips <= 0 || aiChips <= 0
    };
    handHistory.push(rec);
    if (handHistory.length > MAX_HISTORY) handHistory = handHistory.slice(handHistory.length - MAX_HISTORY);
    if (info.kind === 'show') {
      showdowns++;
      if (info.res === 'win') showdownWins++;
    }
  }

  function resolveShow() {
    if (phase !== 'showdown') return;
    phase = 'result';
    revealAI = true;
    refundExcess();
    var pBest = bestHand(playerCards.concat(boardCards));
    var aBest = bestHand(aiCards.concat(boardCards));
    var c = cmpEv(pBest.ev, aBest.ev);
    var potWon = pot;
    var title, color, res, winCards;
    if (c > 0) {
      chips += pot;
      aiSide.classList.remove('win'); meSide.classList.add('win');
      title = T('gs.poker.win'); color = 'var(--neon-green)'; res = 'win';
      winCards = pBest.cards;
      if (Arcade.juice) Arcade.juice.win();
    } else if (c < 0) {
      aiChips += pot;
      meSide.classList.remove('win'); aiSide.classList.add('win');
      title = T('gs.poker.lose'); color = 'var(--neon-pink)'; res = 'lose';
      winCards = aBest.cards;
      if (Arcade.juice) Arcade.juice.lose();
    } else {
      chips += Math.floor(pot / 2);
      aiChips += pot - Math.floor(pot / 2);
      title = T('gs.poker.draw'); color = 'var(--neon-yellow)'; res = 'draw';
      winCards = pBest.cards.concat(aBest.cards);
      if (Arcade.audio) Arcade.audio.play('ui');
    }
    pot = 0;
    var net = chips - startChips;
    recordFinishedHand({ kind: 'show', res: res, pCat: pBest.ev[0], aCat: aBest.ev[0], potWon: potWon });
    setMsg(title, color);
    render();
    markWinningCards(winCards);
    /* 先展示翻牌 / 获胜手牌高亮，再弹出结算面板 */
    var token = activeToken;
    setTimeout(function () {
      if (token !== activeToken) return;
      showResult(
        title, color,
        tr('gs.poker.netChips', { n: formatNet(net), p: potWon }),
        tr('gs.poker.showResult', { p: handName(pBest.ev[0]), a: handName(aBest.ev[0]) }) + ' · ' + tr('gs.poker.roundSub', { b: chips })
      );
      finishHand();
    }, 820);
  }

  function settleFold(winner) {
    phase = 'result';
    var potWon = pot;
    if (winner === 'player') {
      chips += pot;
      meSide.classList.add('win'); aiSide.classList.remove('win');
      setMsg(tr('gs.poker.aiFoldWin', { n: potWon }), 'var(--neon-green)');
    } else {
      aiChips += pot;
      aiSide.classList.add('win'); meSide.classList.remove('win');
      setMsg(tr('gs.poker.youFoldWin', { n: potWon }), 'var(--text-dim)');
    }
    pot = 0;
    var net = chips - startChips;
    recordFinishedHand({ kind: 'fold', res: winner === 'player' ? 'foldwin' : 'foldlose', pCat: 0, aCat: 0, potWon: potWon });
    render();
    var token = activeToken;
    setTimeout(function () {
      if (token !== activeToken) return;
      showResult(
        winner === 'player' ? T('gs.poker.win') : T('gs.poker.lose'),
        winner === 'player' ? 'var(--neon-green)' : 'var(--neon-pink)',
        tr('gs.poker.netChips', { n: formatNet(net), p: potWon }),
        winner === 'player' ? tr('gs.poker.foldSub', { n: potWon }) : tr('gs.poker.foldSubLose', { n: potWon })
      );
      finishHand();
    }, 520);
  }

  function finishHand() {
    writeSave();
    if (chips >= goal()) {
      rSub.innerHTML += ' · ' + tr('gs.poker.goalHit', { n: goal() });
      if (Arcade.juice) Arcade.juice.coin(null, null, 'var(--neon-yellow)');
    }
    if (chips <= 0) {
      phase = 'over';
      rTitle.textContent = T('gs.poker.playerOut');
      nextBtn.style.display = 'none';
      submitRound();
      if (Arcade.juice) Arcade.juice.lose();
    } else if (aiChips <= 0) {
      phase = 'over';
      rTitle.textContent = T('gs.poker.aiOut');
      nextBtn.style.display = 'none';
      submitRound();
      if (Arcade.juice) Arcade.juice.win();
    }
    resultVisible = true;
    updateResultButtons();
    renderResultStats();
    render();
  }

  function playerBroke() {
    phase = 'over';
    showResult(T('gs.poker.playerOut'), 'var(--neon-pink)', T('gs.poker.broke'), tr('gs.poker.roundSub', { b: chips }));
    nextBtn.style.display = 'none';
    updateResultButtons();
    submitRound();
    render();
  }
  function aiBroke() {
    phase = 'over';
    showResult(T('gs.poker.aiOut'), 'var(--neon-yellow)', T('gs.poker.aiBroke'), tr('gs.poker.roundSub', { b: chips }));
    nextBtn.style.display = 'none';
    updateResultButtons();
    submitRound();
    render();
  }

  function renderResultStats() {
    if (!rStats) return;
    var rate = showdowns > 0 ? Math.round(showdownWins / showdowns * 100) + '%' : T('gs.poker.statNoShowdown');
    rStats.innerHTML =
      '<span>' + tr('gs.poker.statFinal', { n: chips }) + '</span>' +
      '<span>' + tr('gs.poker.statHands', { n: handNo }) + '</span>' +
      '<span>' + tr('gs.poker.statShowdown', { w: showdownWins, s: showdowns, p: rate }) + '</span>' +
      '<span>' + tr('gs.poker.statTable', { t: tableName() }) + '</span>';
  }

  function showResult(title, color, net, sub) {
    resultVisible = true;
    rTitle.textContent = title;
    rTitle.style.color = color || 'var(--text)';
    rSub.innerHTML = (net ? net + '<br>' : '') + (sub || '');
    renderResultStats();
    resultEl.classList.add('show');
  }
  function hideResult() { resultVisible = false; resultEl.classList.remove('show'); }

  /* ---------- 桌台 / 面板 ---------- */
  function buildTableCards() {
    if (!tablesEl) return;
    tablesEl.innerHTML = '';
    for (var i = 0; i < TABLES.length; i++) {
      (function (t, idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pk-table-card tier-' + t.id;
        b.setAttribute('data-table', t.id);
        var meta = tr('gs.poker.tableBlinds', { a: t.sb, b: t.bb }) + ' · ' + tr('gs.poker.tableBuyin', { n: t.buyin });
        b.setAttribute('aria-label', tableName(t) + ' ' + meta);
        b.innerHTML =
          '<span class="pk-table-ico">' + (ICON_TABLE[t.id] || ICON_TABLE.standard) + '</span>' +
          '<span class="pk-table-name">' + tableName(t) + '</span>' +
          '<span class="pk-table-meta">' + tr('gs.poker.tableBlinds', { a: t.sb, b: t.bb }) + '</span>' +
          '<span class="pk-table-meta">' + tr('gs.poker.tableBuyin', { n: t.buyin }) + '</span>' +
          '<span class="pk-table-style">' + T(STYLE_I18N[t.style]) + '</span>' +
          '<span class="pk-table-key">' + (idx + 1) + '</span>';
        b.addEventListener('click', function () { selectTable(t.id); });
        tablesEl.appendChild(b);
      })(TABLES[i], i);
    }
  }

  function showTableSelect() {
    activeToken++;
    clearSave();
    resetPanels();
    hideResult();
    phase = 'select';
    currentActor = null;
    tableOpen = true;
    buildTableCards();
    syncOverlayTop();
    selectEl.classList.add('show');
    setTimeout(syncOverlayTop, 320);
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function hideTableSelect() {
    tableOpen = false;
    selectEl.classList.remove('show');
  }
  function selectTable(id) {
    if (!tableOpen) return;
    table = tableById(id);
    hideTableSelect();
    if (Arcade.audio) Arcade.audio.play('ui');
    fullReset();
  }

  function openPause() {
    if (phase === 'select' || tableOpen || replayOpen) return;
    pauseOpen = true;
    paused = true;
    syncOverlayTop();
    pauseEl.classList.add('show');
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function closePause() {
    if (!pauseOpen) return;
    pauseOpen = false;
    paused = false;
    pauseEl.classList.remove('show');
    resumeTimers();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function resumeTimers() {
    if (phase === 'ai') scheduleAI();
    else if (phase === 'action' && chips <= 0) scheduleAutoCheck();
  }

  function openReplay(fromPause) {
    if (tableOpen) return;
    replayFromPause = !!fromPause && pauseOpen;
    replayWasPaused = paused;
    if (replayFromPause) pauseEl.classList.remove('show');
    paused = true;
    replayOpen = true;
    replayIdx = handHistory.length ? handHistory.length - 1 : -1;
    replaySub.textContent = tr('gs.poker.replaySub', { n: handHistory.length });
    syncOverlayTop();
    replayEl.classList.add('show');
    renderReplay();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function closeReplay() {
    if (!replayOpen) return;
    replayOpen = false;
    replayEl.classList.remove('show');
    if (replayFromPause) {
      replayFromPause = false;
      if (pauseOpen) pauseEl.classList.add('show');
      return;
    }
    if (replayWasPaused) { paused = true; }
    else { paused = false; resumeTimers(); }
    replayWasPaused = false;
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  function resetPanels() {
    tableOpen = false; pauseOpen = false; replayOpen = false;
    replayFromPause = false; replayWasPaused = false; paused = false;
    if (selectEl) selectEl.classList.remove('show');
    if (pauseEl) pauseEl.classList.remove('show');
    if (replayEl) replayEl.classList.remove('show');
  }

  function resultText(rec) {
    if (rec.res === 'win') return tr('gs.poker.resShowWin', { n: rec.pot });
    if (rec.res === 'lose') return tr('gs.poker.resShowLose', { n: rec.pot });
    if (rec.res === 'draw') return tr('gs.poker.resShowDraw', { n: rec.pot });
    if (rec.res === 'foldwin') return tr('gs.poker.aiFoldWin', { n: rec.pot });
    return tr('gs.poker.youFoldWin', { n: rec.pot });
  }
  function resultTag(rec) {
    if (rec.res === 'lose' || rec.res === 'foldlose') return T('gs.poker.replayTagLose');
    if (rec.res === 'draw') return T('gs.poker.replayTagDraw');
    return T('gs.poker.replayTagWin');
  }
  function resultTagClass(rec) {
    if (rec.res === 'lose' || rec.res === 'foldlose') return 'lose';
    if (rec.res === 'draw') return 'draw';
    return 'win';
  }
  function actionText(a) {
    if (!a) return '';
    if (a.k === 'check') return T('gs.poker.actCheck');
    if (a.k === 'call') return tr('gs.poker.actCall', { n: a.n || 0 });
    if (a.k === 'raise') return tr('gs.poker.actRaiseTo', { n: a.to || a.n || 0 });
    return T('gs.poker.actFold');
  }
  function cardsRowHTML(cards, slots) {
    var s = '<div class="pk-hand pk-rp-hand">';
    for (var i = 0; i < slots; i++) {
      if (i < cards.length) s += cardMarkup(cards[i], true);
      else s += '<div class="pk-card empty"></div>';
    }
    return s + '</div>';
  }
  function renderReplayList() {
    if (!replayList) return;
    if (!handHistory.length) {
      replayList.innerHTML = '<div class="pk-replay-empty">' + T('gs.poker.replayEmpty') + '</div>';
      return;
    }
    var html = '';
    for (var i = handHistory.length - 1; i >= 0; i--) {
      var rec = handHistory[i];
      html += '<button type="button" class="pk-replay-hand' + (i === replayIdx ? ' on' : '') + ' ' + resultTagClass(rec) + '" data-idx="' + i + '">' +
        '<span class="pk-rp-n">#' + rec.n + '</span>' +
        '<span class="pk-rp-tag">' + resultTag(rec) + '</span>' +
        '<span class="pk-rp-net">' + formatNet(rec.net) + '</span>' +
        '</button>';
    }
    replayList.innerHTML = html;
    var btns = replayList.querySelectorAll('.pk-replay-hand');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        var idx = Number(this.getAttribute('data-idx'));
        if (!isFinite(idx)) return;
        replayIdx = idx;
        renderReplay();
      });
    }
  }
  function renderReplayDetail() {
    if (!replayDetail) return;
    if (replayIdx < 0 || !handHistory[replayIdx]) {
      replayDetail.innerHTML = '<div class="pk-replay-empty">' + T('gs.poker.replayEmpty') + '</div>';
      return;
    }
    var rec = handHistory[replayIdx];
    var html = '';
    html += '<div class="pk-rp-meta">' + tr('gs.poker.replayMeta', { n: rec.n, t: tableNameById(rec.t), a: rec.sb, b: rec.bb }) + '</div>';
    html += '<div class="pk-rp-cards"><span class="pk-rp-tag">' + T('gs.poker.you') + '</span>' + cardsRowHTML(rec.p, 2) + '</div>';
    html += '<div class="pk-rp-cards"><span class="pk-rp-tag">' + T('gs.poker.ai') + '</span>' + cardsRowHTML(rec.a, 2) + '</div>';
    html += '<div class="pk-rp-cards"><span class="pk-rp-tag">' + T('gs.poker.board') + '</span>' + cardsRowHTML(rec.b, 5) + '</div>';
    html += '<div class="pk-rp-sec-title">' + T('gs.poker.replayActions') + '</div>';
    var hasActs = false;
    for (var st = 0; st < 4; st++) {
      var rows = '';
      for (var i = 0; i < rec.acts.length; i++) {
        var a = rec.acts[i];
        if (!a || a.s !== st) continue;
        hasActs = true;
        rows += '<div class="pk-rp-act ' + (a.w === 'a' ? 'ai' : 'me') + '">' +
          '<span class="pk-rp-who">' + (a.w === 'a' ? T('gs.poker.ai') : T('gs.poker.you')) + '</span>' +
          '<span class="pk-rp-what">' + actionText(a) + '</span></div>';
      }
      if (rows) html += '<div class="pk-rp-street"><div class="pk-rp-street-h">' + streetName(st) + '</div>' + rows + '</div>';
    }
    if (!hasActs) html += '<div class="pk-replay-empty">' + T('gs.poker.replayNoActions') + '</div>';
    html += '<div class="pk-rp-sec-title">' + T('gs.poker.replayResult') + '</div>';
    html += '<div class="pk-rp-result ' + resultTagClass(rec) + '">';
    if (rec.kind === 'show') {
      html += '<div class="pk-rp-hands">' + tr('gs.poker.showResult', { p: handName(rec.pCat), a: handName(rec.aCat) }) + '</div>';
    }
    html += '<div class="pk-rp-outcome">' + resultText(rec) + '</div>';
    html += '<div class="pk-rp-foot">' + tr('gs.poker.roundSub', { b: rec.chipsAfter }) + ' · ' + tr('gs.poker.netChips', { n: formatNet(rec.net), p: rec.pot }) + '</div>';
    html += '</div>';
    replayDetail.innerHTML = html;
  }
  function renderReplay() {
    renderReplayList();
    renderReplayDetail();
    if (replayPrevBtn) replayPrevBtn.disabled = replayIdx <= 0;
    if (replayNextBtn) replayNextBtn.disabled = replayIdx < 0 || replayIdx >= handHistory.length - 1;
  }

  /* ---------- 流程控制 ---------- */
  function fullReset() {
    if (tableOpen) {
      selectEl.classList.add('show');
      syncOverlayTop();
      return;
    }
    activeToken++;
    clearSave();
    resetPanels();
    hideResult();
    clearWinHighlights();
    chips = buyIn(); aiChips = buyIn(); handNo = 0;
    handHistory = []; curActions = []; showdowns = 0; showdownWins = 0;
    pot = 0; street = 0; streetBet = { p: 0, a: 0 }; invested = { p: 0, a: 0 };
    acted = { p: false, a: false }; playerCards = []; aiCards = []; boardCards = [];
    deck = []; sbIsPlayer = true; lastRaiseSize = table.bb; aiRaisesThisStreet = 0;
    startChips = chips; revealAI = false; phase = 'action'; currentActor = 'player';
    paused = false;
    refreshBest();
    render();
    startNewHand();
  }

  /* ---------- Canvas 自绘增强 ---------- */
  var fxW = 0, fxH = 0, fxRaf = 0, fxSpecks = null;
  var potCenter = { x: 0, y: 0 }, winRects = [], winGlowUntil = 0, potPulseAt = 0;
  var fxReduced = false;
  function reducedMotion() {
    try { return !!(window.Arcade && Arcade.settings && Arcade.settings.get().reducedMotion); } catch (e) { return false; }
  }
  function resizeCanvas() {
    if (!canvas || !cctx) return;
    try {
      var r = wrap.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      fxW = r.width; fxH = r.height;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(fxW * dpr);
      canvas.height = Math.round(fxH * dpr);
      canvas.style.width = fxW + 'px';
      canvas.style.height = fxH + 'px';
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFx(performance.now());
    } catch (e) {}
  }
  function initSpecks() {
    fxSpecks = [];
    for (var i = 0; i < 16; i++) {
      fxSpecks.push({
        x: Math.random(), y: Math.random(),
        r: 1 + Math.random() * 1.8,
        sp: 0.08 + Math.random() * 0.18,
        ph: Math.random() * Math.PI * 2
      });
    }
  }
  function measureFx() {
    if (!canvas || !cctx) return;
    try {
      var cr = wrap.getBoundingClientRect();
      if (Math.abs(cr.width - fxW) > 1 || Math.abs(cr.height - fxH) > 1) resizeCanvas();
      var pr = potBox.getBoundingClientRect();
      potCenter = { x: pr.left - cr.left + pr.width / 2, y: pr.top - cr.top + pr.height / 2 };
      winRects = [];
      var wc = wrap.querySelectorAll('.pk-card.win-card .pk-face');
      for (var i = 0; i < wc.length; i++) {
        var q = wc[i].getBoundingClientRect();
        if (q.width) winRects.push({ x: q.left - cr.left + q.width / 2, y: q.top - cr.top + q.height / 2, w: q.width, h: q.height });
      }
    } catch (e) {}
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawFx(now) {
    if (!cctx || !fxW || !fxH) return;
    now = now || performance.now();
    fxReduced = reducedMotion();
    try {
      cctx.clearRect(0, 0, fxW, fxH);
      var r = 18;
      var bg = cctx.createRadialGradient(fxW * 0.5, fxH * 0.42, 12, fxW * 0.5, fxH * 0.5, Math.max(fxW, fxH) * 0.72);
      bg.addColorStop(0, 'rgba(16, 34, 62, 0.72)');
      bg.addColorStop(0.55, 'rgba(9, 17, 34, 0.82)');
      bg.addColorStop(1, 'rgba(4, 7, 16, 0.92)');
      cctx.fillStyle = bg;
      roundRect(cctx, 0, 0, fxW, fxH, r);
      cctx.fill();

      cctx.save();
      cctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
      cctx.lineWidth = 1;
      cctx.beginPath();
      cctx.ellipse(fxW * 0.5, fxH * 0.46, fxW * 0.42, fxH * 0.28, 0, 0, Math.PI * 2);
      cctx.stroke();
      cctx.strokeStyle = 'rgba(185, 103, 255, 0.05)';
      cctx.beginPath();
      cctx.ellipse(fxW * 0.5, fxH * 0.46, fxW * 0.30, fxH * 0.19, 0, 0, Math.PI * 2);
      cctx.stroke();
      cctx.restore();

      if (!fxReduced && fxSpecks) {
        for (var i = 0; i < fxSpecks.length; i++) {
          var p = fxSpecks[i];
          var y = (p.y - (now * p.sp / 1000) % 1 + 1) % 1;
          var a = 0.18 + 0.16 * Math.sin(now / 700 + p.ph);
          cctx.beginPath();
          cctx.fillStyle = 'rgba(0, 240, 255,' + a.toFixed(3) + ')';
          cctx.arc(p.x * fxW, y * fxH, p.r, 0, Math.PI * 2);
          cctx.fill();
        }
      }

      var strength = Math.min(0.85, 0.18 + pot / Math.max(160, buyIn() * 2) * 0.6);
      if (!fxReduced) strength += 0.04 * Math.sin(now / 520);
      var pg = cctx.createRadialGradient(potCenter.x, potCenter.y, 2, potCenter.x, potCenter.y, 64);
      pg.addColorStop(0, 'rgba(255, 230, 0,' + (0.20 * strength).toFixed(3) + ')');
      pg.addColorStop(0.55, 'rgba(255, 159, 28,' + (0.10 * strength).toFixed(3) + ')');
      pg.addColorStop(1, 'rgba(255, 159, 28, 0)');
      cctx.fillStyle = pg;
      cctx.beginPath();
      cctx.arc(potCenter.x, potCenter.y, 64, 0, Math.PI * 2);
      cctx.fill();

      if (!fxReduced) {
        var age = now - potPulseAt;
        if (age >= 0 && age < 900) {
          for (var k = 0; k < 2; k++) {
            var t = (age + k * 220) / 900;
            if (t > 1) continue;
            cctx.beginPath();
            cctx.strokeStyle = 'rgba(255, 230, 0,' + (0.38 * (1 - t)).toFixed(3) + ')';
            cctx.lineWidth = 2;
            cctx.arc(potCenter.x, potCenter.y, 20 + t * 62, 0, Math.PI * 2);
            cctx.stroke();
          }
        }
      }

      if (!fxReduced && now < winGlowUntil && winRects.length) {
        var remain = (winGlowUntil - now) / 1800;
        for (var w = 0; w < winRects.length; w++) {
          var rect = winRects[w];
          for (var s2 = 0; s2 < 3; s2++) {
            var ang = (now / 260 + w * 2 + s2 * 2.1) % (Math.PI * 2);
            var rad = 12 + 8 * Math.sin(now / 220 + s2);
            var px = rect.x + Math.cos(ang) * rad;
            var py = rect.y + Math.sin(ang) * rad;
            cctx.beginPath();
            cctx.fillStyle = 'rgba(255, 230, 0,' + (0.85 * remain).toFixed(3) + ')';
            cctx.arc(px, py, 1.8, 0, Math.PI * 2);
            cctx.fill();
          }
        }
      }
    } catch (e) {}
  }
  function startFxLoop() {
    if (!cctx || fxRaf) return;
    function frame(ts) {
      fxRaf = 0;
      drawFx(ts);
      if (!fxReduced) fxRaf = requestAnimationFrame(frame);
    }
    fxRaf = requestAnimationFrame(frame);
  }

  /* ---------- 事件 ---------- */
  callBtn.addEventListener('click', function () {
    if (!(phase === 'action' && currentActor === 'player')) return;
    playerAct(toCallP() > 0 ? 'call' : 'check');
  });
  raiseBtn.addEventListener('click', function () {
    if (!(phase === 'action' && currentActor === 'player')) return;
    playerAct('raise');
  });
  foldBtn.addEventListener('click', function () {
    if (!(phase === 'action' && currentActor === 'player')) return;
    playerAct('fold');
  });
  showBtn.addEventListener('click', function () {
    if (phase !== 'showdown') return;
    if (Arcade.audio) Arcade.audio.play('ui');
    resolveShow();
  });
  nextBtn.addEventListener('click', function () {
    if (phase === 'over') return;
    if (Arcade.audio) Arcade.audio.play('ui');
    startNewHand();
  });
  againBtn.addEventListener('click', function () {
    if (Arcade.audio) Arcade.audio.play('ui');
    fullReset();
  });
  restartBtn.addEventListener('click', function () { fullReset(); });
  replayBtn.addEventListener('click', function () { openReplay(false); });
  replayRBtn.addEventListener('click', function () { openReplay(false); });
  changeBtn.addEventListener('click', function () { showTableSelect(); });
  pauseBtn.addEventListener('click', function () {
    if (pauseOpen) closePause(); else openPause();
  });
  resumeBtn.addEventListener('click', function () { closePause(); });
  pReplayBtn.addEventListener('click', function () { openReplay(true); });
  pTableBtn.addEventListener('click', function () {
    pauseOpen = false;
    paused = false;
    pauseEl.classList.remove('show');
    showTableSelect();
  });
  pRestartBtn.addEventListener('click', function () {
    pauseOpen = false;
    paused = false;
    pauseEl.classList.remove('show');
    fullReset();
  });
  replayCloseBtn.addEventListener('click', function () { closeReplay(); });
  replayPrevBtn.addEventListener('click', function () {
    if (replayIdx > 0) { replayIdx--; renderReplay(); }
  });
  replayNextBtn.addEventListener('click', function () {
    if (replayIdx >= 0 && replayIdx < handHistory.length - 1) { replayIdx++; renderReplay(); }
  });

  function onEscape() {
    if (replayOpen) { closeReplay(); return; }
    if (tableOpen) return;
    if (pauseOpen) { closePause(); return; }
    if (phase === 'select') return;
    openPause();
  }

  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var code = e.code || '';
    if (code === 'Escape') { e.preventDefault(); onEscape(); return; }
    if (replayOpen) {
      if (code === 'ArrowLeft') { e.preventDefault(); if (replayIdx > 0) { replayIdx--; renderReplay(); } }
      else if (code === 'ArrowRight') { e.preventDefault(); if (replayIdx >= 0 && replayIdx < handHistory.length - 1) { replayIdx++; renderReplay(); } }
      return;
    }
    if (tableOpen) {
      if (code === 'Digit1' || code === 'Numpad1') { e.preventDefault(); selectTable(TABLES[0].id); }
      else if (code === 'Digit2' || code === 'Numpad2') { e.preventDefault(); selectTable(TABLES[1].id); }
      else if (code === 'Digit3' || code === 'Numpad3') { e.preventDefault(); selectTable(TABLES[2].id); }
      return;
    }
    if (pauseOpen) {
      if (code === 'KeyC' || code === 'Enter' || code === 'Space') { e.preventDefault(); closePause(); }
      return;
    }
    if (code === 'KeyC') {
      if (phase === 'action' && currentActor === 'player') { e.preventDefault(); playerAct(toCallP() > 0 ? 'call' : 'check'); }
    } else if (code === 'KeyR') {
      if (phase === 'action' && currentActor === 'player') { e.preventDefault(); playerAct('raise'); }
    } else if (code === 'KeyF') {
      if (phase === 'action' && currentActor === 'player') { e.preventDefault(); playerAct('fold'); }
    } else if (code === 'KeyS') {
      if (phase === 'showdown') { e.preventDefault(); resolveShow(); }
    } else if (code === 'KeyN') {
      if (resultVisible && phase !== 'over') { e.preventDefault(); startNewHand(); }
    } else if (code === 'KeyP') {
      if (phase !== 'select') { e.preventDefault(); if (pauseOpen) closePause(); else openPause(); }
    }
  });

  if (typeof ResizeObserver === 'function') {
    try { new ResizeObserver(function () { resizeCanvas(); measureFx(); }).observe(wrap); } catch (e) {}
  }
  window.addEventListener('resize', function () { resizeCanvas(); measureFx(); syncOverlayTop(); });

  /* keyHint */
  var hd = document.createElement('div');
  hd.className = 'pk-help';
  hd.innerHTML = T('gs.poker.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () { fullReset(); };

  /* ---------- 初始化 ---------- */
  table = TABLES[1];
  chips = buyIn(); aiChips = buyIn(); pot = 0; deck = []; playerCards = []; aiCards = []; boardCards = [];
  street = 0; streetBet = { p: 0, a: 0 }; invested = { p: 0, a: 0 }; acted = { p: false, a: false };
  sbIsPlayer = true; handNo = 0; lastRaiseSize = table.bb; aiRaisesThisStreet = 0;
  phase = 'select'; currentActor = null; activeToken = 0; revealAI = false; startChips = buyIn();
  handHistory = []; curActions = []; showdowns = 0; showdownWins = 0;
  refreshBest();
  buildTableCards();
  render();
  initSpecks();
  measureFx();
  startFxLoop();

  if (!tryResume()) {
    showTableSelect();
  } else {
    hideTableSelect();
    if (!resultVisible) hideResult();
    render();
  }

  /* ---------- SIM-HARNESS ----------
     仅当 URL 带 ?sim=1 时执行：用同一套 strengthOf / decide 跑无 UI 单挑自对弈，
     量化三档 AI 的强弱差。不写存档、不提交分数、不影响正常游玩流程。 */
  function simQuery() {
    try { return /(?:^|[?&])sim=1(?:&|$)/.test(window.location.search || ''); } catch (e) { return false; }
  }
  function simRound(v, d) {
    var p = Math.pow(10, d || 2);
    return Math.round(v * p) / p;
  }

  /* 单挑引擎：双方同为 AI，100BB 重置、SB 每手轮换、每 10 手升盲（与游戏内公式一致）。
     盲注等级封顶 6 级：1500 手会推到 149 级（2^149），双精度整数会失真并使
     streetBet 等值判断失效；因每手都重置为 100BB，博弈在 BB 尺度上对盲注倍数不敏感。 */
  function simPlayHand(styleA, styleB, handNo, baseSb, baseBb) {
    var level = Math.min(6, Math.floor(Math.max(0, handNo - 1) / 10));
    var mult = Math.pow(2, level);
    var sb = baseSb * mult, bb = baseBb * mult;
    var start = 100 * bb;
    var stack = { a: start, b: start };
    var inv = { a: 0, b: 0 };
    var bet = { a: 0, b: 0 };
    var acted = { a: false, b: false };
    var raises = { a: 0, b: 0 };
    var deck = buildDeck();
    var hole = { a: [deck.pop(), deck.pop()], b: [deck.pop(), deck.pop()] };
    var board = [];
    var pot = 0, street = 0, lastRaise = bb;
    var aIsSb = (handNo % 2 === 1);
    var guard = 0, ended = null, guardHit = false;

    function pay(seat, amount) {
      var p = Math.min(amount, stack[seat]);
      if (p <= 0) return 0;
      stack[seat] -= p; pot += p; bet[seat] += p; inv[seat] += p;
      return p;
    }
    function refund() {
      if (inv.a < inv.b) { var x = inv.b - inv.a; stack.b += x; pot -= x; inv.b -= x; }
      else if (inv.b < inv.a) { var y = inv.a - inv.b; stack.a += y; pot -= y; inv.a -= y; }
    }
    function settle(winner) {
      if (winner === 'a' || winner === 'b') stack[winner] += pot;
      else { stack.a += Math.floor(pot / 2); stack.b += pot - Math.floor(pot / 2); }
      ended = { winner: winner, pot: pot };
    }
    function closeStreet() {
      if (street >= 3) {
        refund();
        var pa = bestHand(hole.a.concat(board)), pb = bestHand(hole.b.concat(board));
        var cmp = cmpEv(pa.ev, pb.ev);
        settle(cmp > 0 ? 'a' : (cmp < 0 ? 'b' : 'draw'));
        ended.showdown = true;
        return true;
      }
      street++;
      bet = { a: 0, b: 0 }; acted = { a: false, b: false }; raises = { a: 0, b: 0 };
      lastRaise = bb;
      if (street === 1) board.push(deck.pop(), deck.pop(), deck.pop());
      else board.push(deck.pop());
      order = aIsSb ? ['b', 'a'] : ['a', 'b'];
      return false;
    }
    function doCall(seat, toCall) {
      var paid = pay(seat, toCall);
      acted[seat] = true;
      if (paid < toCall || stack[seat] <= 0) { refund(); closeStreet(); return true; }
      return false;
    }

    pay(aIsSb ? 'a' : 'b', sb);
    pay(aIsSb ? 'b' : 'a', bb);
    var order = aIsSb ? ['a', 'b'] : ['b', 'a'];
    var turn = 0;

    while (!ended) {
      if (++guard > 400) { guardHit = true; settle('draw'); ended.showdown = false; break; }
      var seat = order[turn % order.length];
      var other = seat === 'a' ? 'b' : 'a';
      var toCall = Math.max(0, bet[other] - bet[seat]);
      var move;
      if (stack[seat] <= 0) {
        move = toCall > 0 ? 'call' : 'check';
      } else {
        move = decide(seat === 'a' ? styleA : styleB, {
          toCall: toCall, pot: pot, inPos: (seat === 'a') ? !aIsSb : aIsSb,
          raises: raises[seat], stack: stack[seat], board: board, cards: hole[seat], bb: bb
        });
      }
      if (move === 'check' && toCall > 0) move = 'call';
      if (move === 'fold') { settle(other); break; }
      if (move === 'check') {
        acted[seat] = true;
      } else if (move === 'call') {
        if (doCall(seat, toCall)) { turn = 0; continue; }
      } else {
        /* raise：与线上 aiAct 相同的尺度（max(bb, 0.5 底池, 上次加注额)） */
        var target = Math.max(bet.a, bet.b);
        var step = Math.max(bb, Math.floor(pot * 0.5), lastRaise);
        var payAmt = Math.min(target + step - bet[seat], stack[seat]);
        if (payAmt <= toCall) {
          if (doCall(seat, toCall)) { turn = 0; continue; }
        } else {
          pay(seat, payAmt);
          lastRaise = Math.max(bb, payAmt - toCall);
          raises[seat]++;
          acted[seat] = true; acted[other] = false;
        }
      }
      if (ended) break;
      if (acted.a && acted.b && bet.a === bet.b) {
        if (closeStreet()) break;
        turn = 0;
        continue;
      }
      turn++;
    }

    return {
      winner: ended.winner,
      potBB: pot / bb,
      showdown: !!ended.showdown,
      netABb: (stack.a - start) / bb,
      guardHit: guardHit
    };
  }

  function simPair(nameA, nameB, hands, baseSb, baseBb) {
    var styleA = AI_STYLES[nameA] || AI_STYLES.normal;
    var styleB = AI_STYLES[nameB] || AI_STYLES.normal;
    var aWins = 0, bWins = 0, draws = 0, aShowWins = 0, bShowWins = 0, showHands = 0, guardHits = 0;
    var potSum = 0, netSum = 0, curve = [];
    for (var h = 1; h <= hands; h++) {
      var r = simPlayHand(styleA, styleB, h, baseSb, baseBb);
      if (r.winner === 'a') aWins++;
      else if (r.winner === 'b') bWins++;
      else draws++;
      if (r.showdown) {
        showHands++;
        if (r.winner === 'a') aShowWins++;
        else if (r.winner === 'b') bShowWins++;
      }
      if (r.guardHit) guardHits++;
      potSum += r.potBB;
      netSum += r.netABb;
      if (h % 100 === 0 || h === hands) curve.push({ hand: h, netBB: simRound(netSum, 2) });
    }
    return {
      matchup: nameA + ' vs ' + nameB,
      a: nameA, b: nameB, hands: hands,
      aWins: aWins, bWins: bWins, draws: draws,
      aWinRate: simRound(aWins / hands, 4),
      bWinRate: simRound(bWins / hands, 4),
      aEquityRate: simRound((aWins + draws / 2) / hands, 4),
      bEquityRate: simRound((bWins + draws / 2) / hands, 4),
      aNetBB: simRound(netSum, 2),
      aNetBBper100: simRound(netSum / hands * 100, 2),
      avgPotBB: simRound(potSum / hands, 2),
      showdownRate: simRound(showHands / hands, 4),
      showdownWinsA: aShowWins,
      showdownWinsB: bShowWins,
      guardHits: guardHits,
      curve: curve
    };
  }

  function runPokerSim(hands) {
    hands = Math.max(400, Math.floor(hands || 1500));
    var base = TABLES[1];
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var results = [
      simPair('tight', 'normal', hands, base.sb, base.bb),
      simPair('normal', 'aggro', hands, base.sb, base.bb),
      simPair('tight', 'aggro', hands, base.sb, base.bb)
    ];
    var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
    return {
      engine: 'heads-up self-play (no UI)',
      handsPerPair: hands,
      baseBlinds: { sb: base.sb, bb: base.bb },
      stackBB: 100,
      blindLevelFormula: 'level = floor((hand-1)/10), mult = 2^level',
      blindLevelCap: 6,
      elapsedMs: Math.round(t1 - t0),
      results: results
    };
  }

  if (simQuery()) {
    try {
      var simResult = runPokerSim(1500);
      simResult.run = function (n) { return runPokerSim(n); };
      window.__pksim = simResult;
    } catch (e) {
      console.error('[pksim] failed: ' + (e && e.message ? e.message : e));
    }
  }
})();
