/* 21点 Blackjack —— 多手 / 分牌 / 加倍 / 保险 / 边注 / 策略训练 / 算牌 / 锦标赛
   状态机：bet（下注）→ player（逐手行动）→ dealer（庄家补牌）→ result（结算遮罩）
   → bet / over。牌堆与全部手牌写入 Arcade.savegame，旧档可安全迁移。
   训练局与锦标赛不写 arcade_best_blackjack，锦标赛另存独立纪录。 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.blackjack.tut1t'), d: T('gs.blackjack.tut1') },
  { t: T('gs.blackjack.tut2t'), d: T('gs.blackjack.tut2') },
  { t: T('gs.blackjack.tut3t'), d: T('gs.blackjack.tut3') },
  { t: T('gs.blackjack.tut4t'), d: T('gs.blackjack.tut4') }
];

(function () {
  var root = document.getElementById('game-root');

  /* == PURE-ENGINE:BEGIN == */
  var SUITS = ['♠', '♥', '♦', '♣'];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var DECKS = 4;
  var MIN_CHIP = 10;
  var START_CHIPS = 100;
  var GOAL_CHIPS = 300;
  var TOUR_ROUNDS = 10;
  var MAX_START_HANDS = 3;
  var MAX_TOTAL_HANDS = 4;
  var MODE_NORMAL = 'normal';
  var MODE_TRAIN = 'training';
  var MODE_TOUR = 'tournament';
  var uidSeq = 0;

  function rankNum(r) {
    if (r === 'A') return 11;
    if (r === 'J' || r === 'Q' || r === 'K') return 10;
    return parseInt(r, 10);
  }
  function handValue(cards) {
    var sum = 0, aces = 0;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].r === 'A') { aces++; sum += 1; }
      else sum += rankNum(cards[i].r);
    }
    if (aces && sum + 10 <= 21) return { v: sum + 10, soft: true };
    return { v: sum, soft: false };
  }
  function isRed(c) { return c.s === '♥' || c.s === '♦'; }
  function isPair(cards) {
    if (!cards || cards.length !== 2) return false;
    return cards[0].r === cards[1].r;
  }
  function cardSafe(c) { return c && typeof c.s === 'string' && typeof c.r === 'string' && SUITS.indexOf(c.s) >= 0 && RANKS.indexOf(c.r) >= 0; }
  function cardsSafe(a) { if (!Array.isArray(a)) return false; for (var i = 0; i < a.length; i++) if (!cardSafe(a[i])) return false; return true; }
  function normalizeCards(a) {
    return a.map(function (c) { return { s: c.s, r: c.r, uid: typeof c.uid === 'number' ? c.uid : ++uidSeq }; });
  }
  function hiLoValue(c) {
    if (!c) return 0;
    var r = c.r;
    if (r === 'A' || r === '10' || r === 'J' || r === 'Q' || r === 'K') return -1;
    var n = parseInt(r, 10);
    if (n >= 2 && n <= 6) return 1;
    return 0;
  }
  function trueCount(rc, decks) {
    if (!isFinite(decks) || decks <= 0) return rc;
    return Math.round((rc / decks) * 10) / 10;
  }
  function rankOrder(r) {
    if (r === 'A') return 14;
    if (r === 'K') return 13;
    if (r === 'Q') return 12;
    if (r === 'J') return 11;
    return parseInt(r, 10);
  }
  function pairKind(cards) {
    if (!isPair(cards)) return null;
    if (cards[0].s === cards[1].s) return 'perfect';
    return isRed(cards[0]) === isRed(cards[1]) ? 'colored' : 'mixed';
  }
  function pairRatio(kind) {
    if (kind === 'perfect') return 25;
    if (kind === 'colored') return 12;
    if (kind === 'mixed') return 5;
    return 0;
  }
  function threeCardKind(cards) {
    if (!cards || cards.length !== 3 || !cardsSafe(cards)) return null;
    var sameSuit = cards[0].s === cards[1].s && cards[1].s === cards[2].s;
    var sameRank = cards[0].r === cards[1].r && cards[1].r === cards[2].r;
    var nums = [rankOrder(cards[0].r), rankOrder(cards[1].r), rankOrder(cards[2].r)].sort(function (a, b) { return a - b; });
    var straight = (nums[0] + 1 === nums[1] && nums[1] + 1 === nums[2]) ||
      (nums[2] === 14 && nums[0] === 2 && nums[1] === 3) ||
      (nums[2] === 14 && nums[0] === 12 && nums[1] === 13);
    if (sameSuit && straight) return 'straightFlush';
    if (sameRank) return 'trips';
    if (straight) return 'straight';
    if (sameSuit) return 'flush';
    return null;
  }
  function threeRatio(kind) {
    if (kind === 'straightFlush') return 30;
    if (kind === 'trips') return 15;
    if (kind === 'straight') return 10;
    if (kind === 'flush') return 5;
    return 0;
  }
  /* 简化基本策略（4 副牌、软 17 继续要牌、分牌后可加倍） */
  function basicAction(cards, dealerUp, opts) {
    opts = opts || {};
    var hv = handValue(cards);
    var d = dealerUp ? (dealerUp.r === 'A' ? 11 : rankNum(dealerUp.r)) : 10;
    var canDouble = !!opts.canDouble && cards.length === 2;
    var canSplit = !!opts.canSplit && cards.length === 2 && isPair(cards);
    if (canSplit) {
      var pr = cards[0].r;
      if (pr === 'A' || pr === '8') return 'split';
      if (pr === '9') {
        if (d !== 7 && d !== 10 && d !== 11) return 'split';
      } else if (pr === '2' || pr === '3' || pr === '7') {
        if (d <= 7) return 'split';
      } else if (pr === '6') {
        if (d <= 6) return 'split';
      } else if (pr === '4') {
        if (d >= 4 && d <= 6) return 'split';
      }
    }
    if (hv.soft) {
      var sv = hv.v;
      if (sv >= 19) return 'stand';
      if (sv === 18) return (canDouble && d >= 2 && d <= 6) ? 'double' : 'stand';
      if (sv === 17) return (canDouble && d >= 3 && d <= 6) ? 'double' : 'hit';
      if (sv >= 15) return (canDouble && d >= 4 && d <= 6) ? 'double' : 'hit';
      if (sv >= 13) return (canDouble && d >= 5 && d <= 6) ? 'double' : 'hit';
      return 'hit';
    }
    var v = hv.v;
    if (v >= 17) return 'stand';
    if (v >= 13) return d <= 6 ? 'stand' : 'hit';
    if (v === 12) return (d >= 4 && d <= 6) ? 'stand' : 'hit';
    if (v === 11) return canDouble ? 'double' : 'hit';
    if (v === 10) return (canDouble && d <= 9) ? 'double' : 'hit';
    if (v === 9) return (canDouble && d >= 3 && d <= 6) ? 'double' : 'hit';
    return 'hit';
  }
  /* 结算：返回每手结果、保险与边注赔付。payout 为返还总额（含本金） */
  function settleRound(hands, dealer, insuranceBet, side) {
    side = side || {};
    var dealerV = handValue(dealer).v;
    var dealerNatural = dealer.length === 2 && dealerV === 21;
    var out = {
      dealerV: dealerV, dealerNatural: dealerNatural, handResults: [],
      payout: 0, wins: 0, losses: 0, pushes: 0,
      insurancePayout: 0, insuranceNet: 0,
      sidePair: { kind: null, ratio: 0, payout: 0, stake: 0, net: 0 },
      sideThree: { kind: null, ratio: 0, payout: 0, stake: 0, net: 0 },
      sidePayout: 0
    };
    if (insuranceBet > 0 && dealerNatural) out.insurancePayout = insuranceBet * 3;
    if (insuranceBet > 0) out.insuranceNet = out.insurancePayout - insuranceBet;

    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var pv = handValue(h.cards).v;
      var bet = (typeof h.bet === 'number' && h.bet > 0) ? h.bet : 0;
      var isNat = !!h.natural && !h.split && h.cards.length === 2 && pv === 21;
      var res, pay = 0;
      if (pv > 21) {
        res = 'bust';
        out.losses++;
      } else if (dealerNatural && isNat) {
        res = 'push'; pay = bet; out.pushes++;
      } else if (dealerNatural) {
        res = 'lose'; out.losses++;
      } else if (isNat) {
        res = 'natural'; pay = bet * 2.5; out.wins++;
      } else if (dealerV > 21) {
        res = 'win'; pay = bet * 2; out.wins++;
      } else if (pv > dealerV) {
        res = 'win'; pay = bet * 2; out.wins++;
      } else if (pv === dealerV) {
        res = 'push'; pay = bet; out.pushes++;
      } else {
        res = 'lose'; out.losses++;
      }
      out.handResults.push({ index: i, result: res, bet: bet, payout: pay, net: pay - bet });
      out.payout += pay;
    }

    var pairStake = (side.pairStake > 0) ? side.pairStake : 0;
    if (pairStake > 0) {
      var pk = pairKind(side.pairCards || []);
      var pr = pairRatio(pk);
      out.sidePair = {
        kind: pk, ratio: pr, stake: pairStake,
        payout: pk ? pairStake * (pr + 1) : 0,
        net: (pk ? pairStake * (pr + 1) : 0) - pairStake
      };
      out.sidePayout += out.sidePair.payout;
    }
    var threeStake = (side.threeStake > 0) ? side.threeStake : 0;
    if (threeStake > 0) {
      var tk = threeCardKind(side.threeCards || []);
      var tr = threeRatio(tk);
      out.sideThree = {
        kind: tk, ratio: tr, stake: threeStake,
        payout: tk ? threeStake * (tr + 1) : 0,
        net: (tk ? threeStake * (tr + 1) : 0) - threeStake
      };
      out.sidePayout += out.sideThree.payout;
    }

    out.payout = Math.round(out.payout + out.insurancePayout + out.sidePayout);
    return out;
  }
  /* 存档迁移/校验：旧档 player 必须有至少两张合法牌；坏档返回 null */
  function migrateSave(s) {
    if (!s || typeof s !== 'object') return null;
    var br = (typeof s.bankroll === 'number') ? s.bankroll : (typeof s.chips === 'number' ? s.chips : null);
    if (typeof br !== 'number' || !isFinite(br) || br < 0) return null;
    var legacy = !s.v;
    var hands = [];
    if (Array.isArray(s.hands)) {
      for (var i = 0; i < s.hands.length; i++) {
        var h = s.hands[i];
        if (!h || !cardsSafe(h.cards) || h.cards.length < 2) return null;
        hands.push({
          cards: normalizeCards(h.cards),
          bet: (typeof h.bet === 'number' && h.bet > 0) ? h.bet : MIN_CHIP,
          doubled: !!h.doubled, done: !!h.done, bust: !!h.bust, split: !!h.split,
          natural: !!h.natural
        });
      }
      if (hands.length > MAX_TOTAL_HANDS) return null;
    } else if (cardsSafe(s.player) && s.player.length >= 2) {
      hands.push({
        cards: normalizeCards(s.player),
        bet: br >= MIN_CHIP ? MIN_CHIP : Math.max(1, Math.floor(br)),
        doubled: false, done: false, bust: false, split: false, natural: false
      });
      if (legacy && br >= MIN_CHIP) br -= MIN_CHIP;
    } else {
      return null;
    }
    if (!cardsSafe(s.dealer)) return null;
    var dealer = normalizeCards(s.dealer);
    var deck = (Array.isArray(s.deck) && cardsSafe(s.deck) && s.deck.length > 12) ? normalizeCards(s.deck) : null;

    var mode = (s.mode === MODE_TRAIN || s.mode === MODE_TOUR) ? s.mode : MODE_NORMAL;
    var handCount = (typeof s.handCount === 'number') ? s.handCount : 1;
    handCount = Math.max(1, Math.min(MAX_START_HANDS, Math.floor(handCount)));
    var betHands = [];
    if (Array.isArray(s.betHands)) {
      for (var bi = 0; bi < handCount; bi++) {
        var bv = s.betHands[bi];
        betHands.push((typeof bv === 'number' && isFinite(bv) && bv >= 0) ? bv : 0);
      }
    } else {
      var defBet = (typeof s.bet === 'number' && s.bet > 0) ? s.bet : MIN_CHIP;
      for (var bj = 0; bj < handCount; bj++) betHands.push(defBet);
    }
    var betTarget = (typeof s.betTarget === 'number') ? s.betTarget : 0;
    betTarget = Math.max(0, Math.min(handCount - 1, Math.floor(betTarget)));
    var lastBetEach = [];
    if (Array.isArray(s.lastBetEach)) {
      for (var li = 0; li < handCount; li++) {
        var lv = s.lastBetEach[li];
        lastBetEach.push((typeof lv === 'number' && lv >= MIN_CHIP) ? lv : MIN_CHIP);
      }
    } else {
      for (var lj = 0; lj < handCount; lj++) lastBetEach.push((typeof s.lastBet === 'number' && s.lastBet >= MIN_CHIP) ? s.lastBet : MIN_CHIP);
    }
    var sidePair = (typeof s.sidePair === 'number' && s.sidePair >= 0) ? s.sidePair : 0;
    var sideThree = (typeof s.sideThree === 'number' && s.sideThree >= 0) ? s.sideThree : 0;
    var sideStake = {
      pair: (s.sideStake && typeof s.sideStake.pair === 'number' && s.sideStake.pair >= 0) ? s.sideStake.pair : sidePair,
      three: (s.sideStake && typeof s.sideStake.three === 'number' && s.sideStake.three >= 0) ? s.sideStake.three : sideThree
    };
    var sideCards = null;
    if (s.sideCards && cardsSafe(s.sideCards.pair) && s.sideCards.pair.length === 2 &&
        cardsSafe(s.sideCards.three) && s.sideCards.three.length === 3) {
      sideCards = { pair: normalizeCards(s.sideCards.pair), three: normalizeCards(s.sideCards.three) };
    } else if (hands.length && hands[0].cards.length >= 2 && dealer.length >= 1) {
      sideCards = {
        pair: normalizeCards([hands[0].cards[0], hands[0].cards[1]]),
        three: normalizeCards([hands[0].cards[0], hands[0].cards[1], dealer[0]])
      };
    }
    var insuranceBet = (typeof s.insuranceBet === 'number' && s.insuranceBet > 0) ? s.insuranceBet : 0;
    var insuranceTaken = !!s.insuranceTaken;
    var handIndex = (typeof s.handIndex === 'number') ? Math.floor(s.handIndex) : 0;
    if (hands.length) handIndex = Math.max(0, Math.min(handIndex, hands.length - 1));
    else handIndex = 0;
    var phase = (s.phase === 'player' && hands.length > 0 && dealer.length >= 2) ? 'player' : 'bet';
    var wagerSum = insuranceBet + sideStake.pair + sideStake.three;
    for (var wi = 0; wi < hands.length; wi++) wagerSum += hands[wi].bet;
    var roundStart = (typeof s.roundStart === 'number' && isFinite(s.roundStart)) ? s.roundStart : (br + wagerSum);
    var tour = { round: 0, wins: 0, losses: 0, pushes: 0, active: false, done: false };
    if (s.tour && typeof s.tour === 'object') {
      tour.round = Math.max(0, Math.min(TOUR_ROUNDS, Math.floor(s.tour.round || 0)));
      tour.wins = Math.max(0, Math.floor(s.tour.wins || 0));
      tour.losses = Math.max(0, Math.floor(s.tour.losses || 0));
      tour.pushes = Math.max(0, Math.floor(s.tour.pushes || 0));
      tour.active = !!s.tour.active;
      tour.done = !!s.tour.done;
    }
    var train = { total: 0, correct: 0 };
    if (s.trainStats && typeof s.trainStats === 'object') {
      train.total = Math.max(0, Math.floor(s.trainStats.total || 0));
      train.correct = Math.max(0, Math.min(train.total, Math.floor(s.trainStats.correct || 0)));
    }
    var hintEnabled = (typeof s.hintEnabled === 'boolean') ? s.hintEnabled : (mode === MODE_TRAIN);
    var countEnabled = (typeof s.countEnabled === 'boolean') ? s.countEnabled : false;
    return {
      bankroll: br, hands: hands, dealer: dealer, deck: deck, handCount: handCount,
      betHands: betHands, betTarget: betTarget, lastBetEach: lastBetEach,
      bet: betHands[betTarget] || 0, lastBet: lastBetEach[0] || MIN_CHIP,
      sidePair: sidePair, sideThree: sideThree, sideStake: sideStake, sideCards: sideCards,
      insuranceBet: insuranceBet, insuranceTaken: insuranceTaken,
      handIndex: handIndex, phase: phase, roundStart: roundStart,
      mode: mode, tour: tour, hintEnabled: hintEnabled, countEnabled: countEnabled, trainStats: train
    };
  }
  /* == PURE-ENGINE:END == */

  var CHIPS = [10, 25, 50, 100];
  var bankroll, betHands, handCount, betTarget, lastBetEach;
  var deck, dealer, hands, handIndex, hidden;
  var phase, insuranceBet, insuranceTaken, busy, roundToken, best, resultInfo, roundStart;
  var mode, sidePair, sideThree, sideStake, sideCards;
  var tour, trainStats, trainLast, hintEnabled, countEnabled, paused;
  var tourBest;

  function tr(key, vars) {
    var s = T(key);
    if (vars) for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }
  function refreshBest() {
    best = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest('blackjack') : null;
    if (best === null) best = 0;
  }
  function loadTourBest() {
    try {
      var v = Number(localStorage.getItem('arcade_best_blackjack_tour'));
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function submit() {
    if (mode !== MODE_NORMAL) return;
    if (window.Arcade && Arcade.shell) Arcade.shell.submitScore(bankroll);
    refreshBest();
    if (best < bankroll) best = bankroll;
  }
  function audio(name) { if (window.Arcade && Arcade.audio) Arcade.audio.play(name); }

  /* ---------- 牌堆 ---------- */
  function buildDeck() {
    var d = [];
    for (var n = 0; n < DECKS; n++) {
      for (var s = 0; s < SUITS.length; s++) {
        for (var r = 0; r < RANKS.length; r++) d.push({ s: SUITS[s], r: RANKS[r], uid: ++uidSeq });
      }
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
  function totalMainBet() {
    var t = 0;
    for (var i = 0; i < betHands.length; i++) t += betHands[i];
    return t;
  }
  function wagerTotal() { return totalMainBet() + sidePair + sideThree; }
  function currentHand() { return hands && hands[handIndex]; }

  /* ---------- 存档 ---------- */
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'blackjack',
      collect: function () {
        if (phase !== 'bet' && phase !== 'player') return null;
        return {
          v: 3, bankroll: bankroll, bet: betHands[betTarget] || 0,
          betHands: betHands.slice(), handCount: handCount, betTarget: betTarget,
          lastBetEach: lastBetEach.slice(), lastBet: lastBetEach[0] || 0,
          deck: deck, dealer: dealer, hands: hands, handIndex: handIndex,
          hidden: hidden, phase: phase, insuranceBet: insuranceBet, insuranceTaken: insuranceTaken,
          roundStart: roundStart, mode: mode, sidePair: sidePair, sideThree: sideThree,
          sideStake: { pair: sideStake.pair, three: sideStake.three }, sideCards: sideCards,
          tour: { round: tour.round, wins: tour.wins, losses: tour.losses, pushes: tour.pushes, active: tour.active, done: tour.done },
          hintEnabled: hintEnabled, countEnabled: countEnabled,
          trainStats: { total: trainStats.total, correct: trainStats.correct }
        };
      },
      apply: function (s) {
        var st = migrateSave(s);
        if (!st) return false;
        bankroll = st.bankroll;
        deck = st.deck || buildDeck();
        dealer = st.dealer;
        hands = st.hands;
        handIndex = st.handIndex;
        hidden = st.hidden || false;
        phase = st.phase;
        insuranceBet = st.insuranceBet;
        insuranceTaken = st.insuranceTaken;
        roundStart = st.roundStart;
        mode = st.mode;
        handCount = st.handCount;
        betHands = st.betHands;
        betTarget = st.betTarget;
        lastBetEach = st.lastBetEach;
        sidePair = st.sidePair;
        sideThree = st.sideThree;
        sideStake = st.sideStake;
        sideCards = st.sideCards;
        tour = st.tour;
        trainStats = st.trainStats;
        hintEnabled = st.hintEnabled;
        countEnabled = st.countEnabled;
        busy = false;
        paused = false;
        hidden = st.phase === 'player';
        hideResult();
        if (phase === 'player') {
          msg.textContent = T('gs.blackjack.resumeMsg');
        } else {
          hands = []; dealer = []; hidden = false;
          msg.textContent = tr('gs.blackjack.restartMsg', { a: GOAL_CHIPS, b: GOAL_CHIPS });
        }
        msg.style.color = '';
        render();
        updateButtons();
        if (phase === 'player' && hands[handIndex] && hands[handIndex].done) {
          roundToken++;
          var rtok = roundToken;
          later(function () { if (rtok === roundToken && phase === 'player') { busy = false; advanceHand(); } }, 0, rtok);
        }
        return true;
      }
    });
  }

  /* ---------- DOM ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'bj-wrap';
  wrap.innerHTML =
    '<div class="bj-stats">' +
    '  <span>' + T('gs.blackjack.chips') + ' <b class="bj-chips" id="bj-chips">0</b></span>' +
    '  <span>' + T('gs.blackjack.best') + ' <b class="bj-best" id="bj-best">0</b></span>' +
    '  <span class="bj-goal-wrap">' + T('gs.blackjack.goal') + ' <b id="bj-goal">' + GOAL_CHIPS + '</b></span>' +
    '  <button type="button" class="bj-mini bj-pausebtn" id="bj-pause-btn">' + T('gs.blackjack.pause') + '</button>' +
    '</div>' +
    '<div class="bj-modes" id="bj-modes">' +
    '  <button type="button" class="bj-mode" data-mode="' + MODE_NORMAL + '">' + T('gs.blackjack.modeNormal') + '</button>' +
    '  <button type="button" class="bj-mode" data-mode="' + MODE_TRAIN + '">' + T('gs.blackjack.modeTraining') + '</button>' +
    '  <button type="button" class="bj-mode" data-mode="' + MODE_TOUR + '">' + T('gs.blackjack.modeTournament') + '</button>' +
    '</div>' +
    '<div class="bj-tourinfo hidden" id="bj-tourinfo"></div>' +
    '<div class="bj-table" id="bj-table">' +
    '  <canvas class="bj-felt" id="bj-felt" aria-hidden="true"></canvas>' +
    '  <div class="bj-table-in">' +
    '    <div class="bj-side dealer">' +
    '      <div class="bj-side-head"><span>' + T('gs.blackjack.dealer') + '</span><span class="bj-val" id="bj-dval"></span></div>' +
    '      <div class="bj-cards" id="bj-dealer"></div>' +
    '    </div>' +
    '    <div class="bj-side">' +
    '      <div class="bj-side-head"><span>' + T('gs.blackjack.you') + '</span><span class="bj-val" id="bj-pval"></span></div>' +
    '      <div id="bj-hands"></div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="bj-msg" id="bj-msg"></div>' +
    '<div class="bj-hint hidden" id="bj-hint"></div>' +
    '<div class="bj-count hidden" id="bj-count"></div>' +
    '<div class="bj-betinfo" id="bj-betinfo">' +
    '  <span>' + T('gs.blackjack.bet') + ' <b id="bj-bet">0</b></span>' +
    '  <button type="button" class="bj-mini" id="bj-repeat">' + T('gs.blackjack.repeat') + '</button>' +
    '  <button type="button" class="bj-mini" id="bj-clear">' + T('gs.blackjack.clear') + '</button>' +
    '</div>' +
    '<div class="bj-handpick" id="bj-handpick">' +
    '  <span class="bj-handpick-lbl">' + T('gs.blackjack.handCount') + '</span>' +
    '  <button type="button" class="bj-mini bj-count-btn" data-n="1">1</button>' +
    '  <button type="button" class="bj-mini bj-count-btn" data-n="2">2</button>' +
    '  <button type="button" class="bj-mini bj-count-btn" data-n="3">3</button>' +
    '  <span class="bj-handpick-note">' + T('gs.blackjack.betPickNote') + '</span>' +
    '</div>' +
    '<div class="bj-betplans" id="bj-betplans"></div>' +
    '<div class="bj-sidebox" id="bj-sidebox">' +
    '  <div class="bj-sidebox-hd"><span>' + T('gs.blackjack.sideBets') + '</span><span class="bj-sidebox-note">' + T('gs.blackjack.sideNote') + '</span></div>' +
    '  <div class="bj-side-row">' +
    '    <span class="bj-side-name">' + T('gs.blackjack.sidePair') + '</span>' +
    '    <button type="button" class="bj-mini bj-side-minus" data-side="pair">−</button>' +
    '    <b class="bj-side-amt" id="bj-pair-amt">0</b>' +
    '    <button type="button" class="bj-mini bj-side-plus" data-side="pair">+</button>' +
    '    <span class="bj-side-odds">' + T('gs.blackjack.sidePairRules') + '</span>' +
    '  </div>' +
    '  <div class="bj-side-row">' +
    '    <span class="bj-side-name">' + T('gs.blackjack.sideThree') + '</span>' +
    '    <button type="button" class="bj-mini bj-side-minus" data-side="three">−</button>' +
    '    <b class="bj-side-amt" id="bj-three-amt">0</b>' +
    '    <button type="button" class="bj-mini bj-side-plus" data-side="three">+</button>' +
    '    <span class="bj-side-odds">' + T('gs.blackjack.sideThreeRules') + '</span>' +
    '  </div>' +
    '</div>' +
    '<div class="bj-chips-row" id="bj-chiprow"></div>' +
    '<div class="bj-actions">' +
    '  <button type="button" class="btn green" id="bj-hit">' + T('gs.blackjack.hit') + '</button>' +
    '  <button type="button" class="btn yellow" id="bj-stand">' + T('gs.blackjack.stand') + '</button>' +
    '  <button type="button" class="btn purple" id="bj-double">' + T('gs.blackjack.double') + '</button>' +
    '  <button type="button" class="btn purple" id="bj-split">' + T('gs.blackjack.split') + '</button>' +
    '  <button type="button" class="btn pink" id="bj-insure">' + T('gs.blackjack.insurance') + '</button>' +
    '</div>' +
    '<div class="bj-dealrow" id="bj-dealrow">' +
    '  <button type="button" class="btn green bj-deal" id="bj-deal">' + T('gs.blackjack.deal') + '</button>' +
    '  <button type="button" class="btn" id="bj-restart">' + T('gs.blackjack.restart') + '</button>' +
    '</div>' +
    '<div class="bj-toggles" id="bj-toggles">' +
    '  <button type="button" class="bj-mini" id="bj-hint-toggle">' + T('gs.blackjack.hintToggleOff') + '</button>' +
    '  <button type="button" class="bj-mini" id="bj-count-toggle">' + T('gs.blackjack.countToggleOff') + '</button>' +
    '</div>' +
    '<div class="bj-result" id="bj-result">' +
    '  <div class="bj-result-box">' +
    '    <div class="bj-result-title" id="bj-rtitle"></div>' +
    '    <div class="bj-result-net" id="bj-rnet"></div>' +
    '    <div class="bj-result-sub" id="bj-rsub"></div>' +
    '    <div class="bj-result-details" id="bj-rdetails"></div>' +
    '    <div class="bj-result-btns">' +
    '      <button type="button" class="btn green" id="bj-next">' + T('gs.blackjack.next') + '</button>' +
    '      <button type="button" class="btn purple" id="bj-rrestart">' + T('gs.blackjack.restart') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="bj-pauseov" id="bj-pauseov">' +
    '  <div class="bj-pause-box">' +
    '    <div class="bj-result-title">' + T('gs.blackjack.paused') + '</div>' +
    '    <div class="bj-result-sub">' + T('gs.blackjack.pauseSub') + '</div>' +
    '    <div class="bj-result-btns">' +
    '      <button type="button" class="btn green" id="bj-resume">' + T('gs.blackjack.pauseResume') + '</button>' +
    '      <button type="button" class="btn purple" id="bj-presume">' + T('gs.blackjack.restart') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';
  root.appendChild(wrap);

  var chipsEl = wrap.querySelector('#bj-chips'), bestEl = wrap.querySelector('#bj-best'), goalEl = wrap.querySelector('#bj-goal'),
      tableEl = wrap.querySelector('#bj-table'), feltEl = wrap.querySelector('#bj-felt'),
      dealerEl = wrap.querySelector('#bj-dealer'), dvalEl = wrap.querySelector('#bj-dval'),
      handsEl = wrap.querySelector('#bj-hands'), pvalEl = wrap.querySelector('#bj-pval'),
      msg = wrap.querySelector('#bj-msg'), betEl = wrap.querySelector('#bj-bet'),
      hintEl = wrap.querySelector('#bj-hint'), countEl = wrap.querySelector('#bj-count'), tourInfoEl = wrap.querySelector('#bj-tourinfo'),
      chipRow = wrap.querySelector('#bj-chiprow'), betInfo = wrap.querySelector('#bj-betinfo'), dealRow = wrap.querySelector('#bj-dealrow'),
      handPick = wrap.querySelector('#bj-handpick'), betPlans = wrap.querySelector('#bj-betplans'), sideBox = wrap.querySelector('#bj-sidebox'),
      pairAmt = wrap.querySelector('#bj-pair-amt'), threeAmt = wrap.querySelector('#bj-three-amt'),
      modesEl = wrap.querySelector('#bj-modes'), togglesEl = wrap.querySelector('#bj-toggles'),
      hitBtn = wrap.querySelector('#bj-hit'), standBtn = wrap.querySelector('#bj-stand'),
      doubleBtn = wrap.querySelector('#bj-double'), splitBtn = wrap.querySelector('#bj-split'), insureBtn = wrap.querySelector('#bj-insure'),
      dealBtn = wrap.querySelector('#bj-deal'), restartBtn = wrap.querySelector('#bj-restart'),
      repeatBtn = wrap.querySelector('#bj-repeat'), clearBtn = wrap.querySelector('#bj-clear'),
      pauseBtn = wrap.querySelector('#bj-pause-btn'), hintToggleBtn = wrap.querySelector('#bj-hint-toggle'), countToggleBtn = wrap.querySelector('#bj-count-toggle'),
      resultEl = wrap.querySelector('#bj-result'), rTitle = wrap.querySelector('#bj-rtitle'), rNet = wrap.querySelector('#bj-rnet'),
      rSub = wrap.querySelector('#bj-rsub'), rDetails = wrap.querySelector('#bj-rdetails'),
      nextBtn = wrap.querySelector('#bj-next'), rRestartBtn = wrap.querySelector('#bj-rrestart'),
      pauseOv = wrap.querySelector('#bj-pauseov'), resumeBtn = wrap.querySelector('#bj-resume'), pauseRestartBtn = wrap.querySelector('#bj-presume');

  CHIPS.forEach(function (v) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bj-chip v' + v;
    b.setAttribute('data-v', String(v));
    b.innerHTML = '<span>' + v + '</span>';
    chipRow.appendChild(b);
  });

  /* ---------- 绘制：台面霓虹 ---------- */
  var reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedOn() { return !!(reducedQuery && reducedQuery.matches); }
  var feltRaf = 0, feltW = 0, feltH = 0, feltLast = 0, feltLoop = false;

  function scheduleFelt() {
    if (reducedOn()) { drawFelt(performance.now(), false); return; }
    startFelt();
  }
  function startFelt() {
    if (feltLoop || !window.requestAnimationFrame) return;
    feltLoop = true; feltLast = 0;
    feltRaf = window.requestAnimationFrame(feltTick);
  }
  function stopFelt() {
    feltLoop = false;
    if (feltRaf) { window.cancelAnimationFrame(feltRaf); feltRaf = 0; }
  }
  function feltTick(t) {
    if (!feltLoop) return;
    if (reducedOn()) { stopFelt(); drawFelt(t, false); return; }
    if (t - feltLast >= 32) { feltLast = t; drawFelt(t, true); }
    feltRaf = window.requestAnimationFrame(feltTick);
  }
  if (reducedQuery) {
    var onMotionChange = function () {
      if (reducedOn()) { stopFelt(); drawFelt(performance.now(), false); }
      else startFelt();
    };
    if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', onMotionChange);
    else if (reducedQuery.addListener) reducedQuery.addListener(onMotionChange);
  }

  function drawFelt(now, animate) {
    if (!feltEl || !feltEl.getContext) return;
    var ctx = feltEl.getContext('2d');
    if (!ctx) return;
    var rect = tableEl.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== feltW || h !== feltH || feltEl.width !== w * dpr) {
      feltW = w; feltH = h;
      feltEl.width = w * dpr; feltEl.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var breath = animate ? 0.5 + 0.5 * Math.sin(now / 5200) : 0.5;
    var cx = w / 2, cy = h * 0.56;
    var r = Math.min(w * 0.56, h * 0.74) * (animate ? 1 + 0.015 * Math.sin(now / 4300) : 1);
    var g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(18, 38, 62, ' + (0.24 + 0.09 * breath).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(3, 8, 16, 0.05)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 240, 255, ' + (0.18 + 0.09 * breath).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 45, 149, ' + (0.12 + 0.07 * (1 - breath)).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 9, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    for (var i = 0; i < 7; i++) {
      var a = Math.PI * 1.09 + (Math.PI * 0.82) * (i / 6);
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.07)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    /* 绒面灯带：沿外弧缓慢推进的虚光 + 斜向扫光 */
    ctx.save();
    ctx.setLineDash([9, 15]);
    ctx.lineDashOffset = animate ? -((now / 16) % 24) : 0;
    ctx.strokeStyle = animate
      ? 'rgba(120, 245, 255, ' + (0.09 + 0.05 * breath).toFixed(3) + ')'
      : 'rgba(120, 245, 255, 0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.restore();
    if (animate) {
      var span = w * 1.35;
      var x0 = -span + ((now % 9000) / 9000) * (w + span * 2);
      var sweep = ctx.createLinearGradient(x0, 0, x0 + span, h);
      sweep.addColorStop(0, 'rgba(0, 240, 255, 0)');
      sweep.addColorStop(0.45, 'rgba(0, 240, 255, 0.045)');
      sweep.addColorStop(0.55, 'rgba(255, 45, 149, 0.028)');
      sweep.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = 'rgba(0, 240, 255, 0.10)';
    ctx.font = '600 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BLACKJACK · 21', cx, cy + r * 0.46);
  }

  /* ---------- 渲染 ---------- */
  function cardEl(c, faceUp) {
    var el = document.createElement('div');
    el.className = 'bj-card' + (faceUp ? '' : ' down') + (isRed(c) ? ' red' : '');
    el.innerHTML =
      '<div class="bj-card-inner">' +
      '  <div class="bj-face">' +
      '    <span class="bj-rank tl">' + c.r + '</span>' +
      '    <span class="bj-suit">' + c.s + '</span>' +
      '    <span class="bj-rank br">' + c.r + '</span>' +
      '  </div>' +
      '  <div class="bj-back"><span>21</span></div>' +
      '</div>';
    return el;
  }
  function syncCards(container, cards, downIdx, newEls) {
    var kids = Array.prototype.slice.call(container.children);
    while (kids.length > cards.length) { container.removeChild(kids.pop()); }
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], up = (i !== downIdx);
      var el = kids[i];
      if (!el || el.getAttribute('data-uid') !== String(c.uid) || el.getAttribute('data-up') !== (up ? '1' : '0')) {
        var nel = cardEl(c, up);
        nel.setAttribute('data-uid', String(c.uid));
        nel.setAttribute('data-up', up ? '1' : '0');
        if (el) { nel.classList.add('flip'); container.replaceChild(nel, el); }
        else { container.appendChild(nel); dealArc(nel, newEls.length); }
        newEls.push(nel);
      }
    }
  }
  function burstEl(el, color, count) {
    if (!window.Arcade || !Arcade.fx || !el) return;
    try {
      var r = el.getBoundingClientRect();
      if (r.width) Arcade.fx.burst(r.left + r.width / 2, r.top + r.height / 2, color, count);
    } catch (e) {}
  }
  /* 发牌弧线：从台面右上角的牌靴沿二次弧线落到目标位（不是直线位移） */
  function dealArc(el, idx) {
    if (!el || !tableEl || reducedOn() || !el.animate) return;
    var cr = el.getBoundingClientRect(), tr = tableEl.getBoundingClientRect();
    if (!cr.width || !tr.width) return;
    var sx = tr.right - Math.min(34, tr.width * 0.09);
    var sy = tr.top + Math.min(22, tr.height * 0.12);
    var dx = sx - (cr.left + cr.width / 2);
    var dy = sy - (cr.top + cr.height / 2);
    try {
      el.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(-12deg) scale(.62)', opacity: .18, offset: 0 },
        { transform: 'translate(' + (dx * .42) + 'px,' + (dy * .44 - 22) + 'px) rotate(-5deg) scale(.86)', opacity: .92, offset: .55 },
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: 1 }
      ], {
        duration: 430, delay: Math.min(idx, 4) * 46,
        easing: 'cubic-bezier(.2,.86,.3,1.05)', fill: 'both'
      });
    } catch (e) {}
  }
  function burstCards(els) {
    if (reducedOn()) return;
    for (var i = 0; i < els.length; i++) {
      (function (el, k) {
        setTimeout(function () { burstEl(el, '#ffd447', 7); }, 430 + Math.min(k, 4) * 46);
      })(els[i], i);
    }
  }
  function ensurePanel(i) {
    var p = handsEl.children[i];
    if (!p) {
      p = document.createElement('div');
      p.className = 'bj-hand-panel';
      p.innerHTML =
        '<div class="bj-hand-hd"><span class="bj-hand-name"></span><span class="bj-hand-bet"></span><span class="bj-hand-val"></span></div>' +
        '<div class="bj-cards"></div>';
      handsEl.appendChild(p);
    }
    return p;
  }
  function resultLabel(res) {
    if (res === 'natural') return T('gs.blackjack.resultNatural');
    if (res === 'bust') return T('gs.blackjack.resultBust');
    if (res === 'win') return T('gs.blackjack.resultWin');
    if (res === 'push') return T('gs.blackjack.resultPush');
    return T('gs.blackjack.resultLose');
  }
  function kindLabel(prefix, kind) {
    return T('gs.blackjack.' + prefix + kind.charAt(0).toUpperCase() + kind.slice(1));
  }
  function signed(n) {
    if (n > 0) return '+' + n;
    if (n < 0) return String(n);
    return '±0';
  }

  function renderBetPlans() {
    var show = phase === 'bet';
    betPlans.classList.toggle('hidden', !show);
    handPick.classList.toggle('hidden', !show);
    sideBox.classList.toggle('hidden', !show);
    if (!show) {
      betPlans.innerHTML = '';
      return;
    }
    betPlans.innerHTML = '';
    for (var i = 0; i < handCount; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bj-plan' + (i === betTarget ? ' active' : '');
      b.setAttribute('data-i', String(i));
      b.innerHTML = '<span>' + tr('gs.blackjack.hand', { n: i + 1 }) + '</span><b>' + betHands[i] + '</b>';
      betPlans.appendChild(b);
    }
  }

  function renderHint() {
    var show = (mode === MODE_TRAIN && hintEnabled);
    hintEl.classList.toggle('hidden', !show);
    if (!show) return;
    var acc = trainStats.total > 0
      ? tr('gs.blackjack.hintAcc', {
        a: trainStats.correct, b: trainStats.total,
        c: Math.round((trainStats.correct / trainStats.total) * 100)
      })
      : tr('gs.blackjack.hintAcc', { a: 0, b: 0, c: 0 });
    var bestKey = trainLast && trainLast.best ? trainLast.best : null;
    var parts = [];
    if (trainLast && bestKey) {
      parts.push(tr('gs.blackjack.hintBest', { a: T('gs.blackjack.' + bestKey) }));
      parts.push(trainLast.ok ? T('gs.blackjack.hintOk') : T('gs.blackjack.hintMiss'));
    } else if (phase === 'player' && currentHand() && dealer.length) {
      parts.push(tr('gs.blackjack.hintBest', { a: T('gs.blackjack.' + bestFor(currentHand())) }));
      parts.push(T('gs.blackjack.hintNoData'));
    } else {
      parts.push(T('gs.blackjack.hintIdle'));
    }
    parts.push(acc);
    hintEl.textContent = parts.join(' · ');
  }

  function renderCount() {
    var show = countEnabled && mode !== MODE_TOUR;
    countEl.classList.toggle('hidden', !show);
    if (!show) return;
    var rc = 0;
    for (var i = 0; i < deck.length; i++) rc -= hiLoValue(deck[i]);
    if (hidden && dealer.length > 1) rc -= hiLoValue(dealer[1]);
    var rem = deck.length / 52;
    countEl.textContent = tr('gs.blackjack.countInfo', {
      a: rc, b: trueCount(rc, rem), c: rem.toFixed(1)
    });
  }

  function renderTour() {
    var show = mode === MODE_TOUR;
    tourInfoEl.classList.toggle('hidden', !show);
    if (!show) return;
    var parts = [tr('gs.blackjack.tourRound', { a: Math.min(tour.round + 1, TOUR_ROUNDS), b: TOUR_ROUNDS })];
    parts.push(tr('gs.blackjack.tourWins', { n: tour.wins }));
    if (tourBest > 0) parts.push(T('gs.blackjack.tourBest') + ' ' + tourBest);
    tourInfoEl.textContent = parts.join(' · ');
  }

  function render() {
    chipsEl.textContent = String(bankroll);
    bestEl.textContent = String(best);
    goalEl.textContent = String(GOAL_CHIPS);
    betEl.textContent = String(betHands[betTarget] || 0);
    pairAmt.textContent = String(sidePair);
    threeAmt.textContent = String(sideThree);
    var newEls = [];
    var downIdx = (hidden && dealer.length > 1 && phase === 'player') ? 1 : -1;
    syncCards(dealerEl, dealer || [], downIdx, newEls);
    if (!dealer || !dealer.length) dvalEl.textContent = '';
    else if (downIdx >= 0) dvalEl.textContent = tr('gs.blackjack.upcard', { n: handValue([dealer[0]]).v });
    else dvalEl.textContent = tr('gs.blackjack.value', { n: handValue(dealer).v });

    var shownHands = (phase === 'bet' || !hands || !hands.length) ? [] : hands;
    while (handsEl.children.length > shownHands.length) handsEl.removeChild(handsEl.lastElementChild);
    for (var i = 0; i < shownHands.length; i++) {
      var h = shownHands[i], p = ensurePanel(i);
      p.classList.toggle('active', phase === 'player' && i === handIndex);
      p.classList.toggle('busted', !!h.bust);
      p.classList.toggle('done', !!h.done);
      p.querySelector('.bj-hand-name').textContent = shownHands.length > 1 ? tr('gs.blackjack.hand', { n: i + 1 }) : T('gs.blackjack.you');
      p.querySelector('.bj-hand-bet').textContent = tr('gs.blackjack.betOf', { n: h.bet });
      var hv = handValue(h.cards);
      var st = h.bust ? T('gs.blackjack.busted') : (h.done && hv.v < 21 ? T('gs.blackjack.stood') : '');
      p.querySelector('.bj-hand-val').textContent = tr('gs.blackjack.value', { n: hv.v }) + (st ? ' · ' + st : '');
      syncCards(p.querySelector('.bj-cards'), h.cards, -1, newEls);
    }

    if (shownHands.length) {
      var hv2 = handValue(shownHands[handIndex] ? shownHands[handIndex].cards : shownHands[0].cards);
      pvalEl.textContent = tr('gs.blackjack.value', { n: hv2.v }) + (hv2.soft ? ' · ' + T('gs.blackjack.soft') : '');
    } else pvalEl.textContent = '';

    var isBet = phase === 'bet';
    chipRow.classList.toggle('hidden', !isBet);
    betInfo.classList.toggle('hidden', !isBet);
    dealRow.classList.toggle('hidden', phase !== 'bet');
    renderBetPlans();
    renderHint();
    renderCount();
    renderTour();
    burstCards(newEls);
    scheduleFelt();
  }

  function bestFor(h) {
    return basicAction(h.cards, dealer[0], {
      canSplit: h.cards.length === 2 && isPair(h.cards) && hands.length < MAX_TOTAL_HANDS && bankroll >= h.bet && !h.natural,
      canDouble: h.cards.length === 2 && bankroll >= h.bet && !h.natural
    });
  }

  function updateButtons() {
    var h = hands && hands[handIndex];
    var act = (phase === 'player' && h && !h.done && !busy && !paused);
    var twoCards = act && h.cards.length === 2;
    hitBtn.disabled = !act || handValue(h.cards).v >= 21;
    standBtn.disabled = !act;
    doubleBtn.disabled = !(twoCards && bankroll >= h.bet && !h.natural);
    splitBtn.disabled = !(twoCards && isPair(h.cards) && hands.length < MAX_TOTAL_HANDS && bankroll >= h.bet);
    var mainTotal = totalMainBet();
    var cost = Math.floor(mainTotal / 2);
    var canIns = (phase === 'player' && dealer.length && dealer[0].r === 'A' && !insuranceTaken &&
      cost >= 1 && bankroll >= cost && !paused);
    insureBtn.disabled = !canIns;
    insureBtn.classList.toggle('hidden', !(phase === 'player' && dealer.length && dealer[0].r === 'A'));

    var issue = betIssue();
    dealBtn.disabled = !(phase === 'bet' && !issue && !paused);
    repeatBtn.disabled = !(phase === 'bet' && lastBetEach.length > 0 && !paused);
    clearBtn.disabled = !(phase === 'bet' && wagerTotal() > 0 && !paused);
    var chipBtns = chipRow.querySelectorAll('.bj-chip');
    for (var i = 0; i < chipBtns.length; i++) {
      var v = Number(chipBtns[i].getAttribute('data-v'));
      chipBtns[i].disabled = !(phase === 'bet' && !paused) || (bankroll - wagerTotal()) < v;
    }
    var modeBtns = modesEl.querySelectorAll('.bj-mode');
    for (var m = 0; m < modeBtns.length; m++) {
      modeBtns[m].disabled = !(phase === 'bet' && !paused);
      modeBtns[m].classList.toggle('active', modeBtns[m].getAttribute('data-mode') === mode);
    }
    var handBtns = handPick.querySelectorAll('.bj-count-btn');
    for (var n = 0; n < handBtns.length; n++) {
      handBtns[n].disabled = !(phase === 'bet' && !paused);
      handBtns[n].classList.toggle('active', Number(handBtns[n].getAttribute('data-n')) === handCount);
    }
    var sideBtns = sideBox.querySelectorAll('.bj-side-plus, .bj-side-minus');
    for (var s = 0; s < sideBtns.length; s++) sideBtns[s].disabled = !(phase === 'bet' && !paused);
    hintToggleBtn.disabled = false;
    countToggleBtn.disabled = mode === MODE_TOUR;
    hintToggleBtn.textContent = hintEnabled ? T('gs.blackjack.hintToggleOn') : T('gs.blackjack.hintToggleOff');
    countToggleBtn.textContent = countEnabled ? T('gs.blackjack.countToggleOn') : T('gs.blackjack.countToggleOff');
    hintToggleBtn.classList.toggle('hidden', mode !== MODE_TRAIN);
    countToggleBtn.classList.toggle('hidden', mode === MODE_TOUR);
    togglesEl.classList.toggle('hidden', mode === MODE_TOUR);
    pauseBtn.disabled = !((phase === 'player' || phase === 'dealer') && !paused);
    if (nextBtn) nextBtn.style.display = (phase === 'over') ? 'none' : '';
    restartBtn.disabled = false;
  }

  function showResult(info) {
    resultInfo = info;
    rTitle.textContent = info.title;
    rTitle.style.color = info.color || 'var(--text)';
    rNet.textContent = info.net;
    rNet.style.color = info.netColor || 'var(--text-dim)';
    rSub.textContent = info.sub || '';
    rDetails.innerHTML = '';
    if (info.details && info.details.length) {
      for (var i = 0; i < info.details.length; i++) {
        var line = document.createElement('div');
        line.className = 'bj-detail' + (info.details[i].tone ? ' ' + info.details[i].tone : '');
        line.textContent = info.details[i].text;
        rDetails.appendChild(line);
      }
    }
    resultEl.classList.add('show');
    updateButtons();
  }
  function hideResult() { resultEl.classList.remove('show'); }

  function setMsg(text, color) { msg.textContent = text; msg.style.color = color || ''; }

  function later(fn, delay, token) {
    setTimeout(function tick() {
      if (token !== undefined && token !== roundToken) return;
      if (paused) { setTimeout(tick, 240); return; }
      fn();
    }, delay || 0);
  }

  /* ---------- 下注街 ---------- */
  function betIssue() {
    if (phase !== 'bet') return 'phase';
    if (handCount < 1) return 'hands';
    for (var i = 0; i < handCount; i++) if (!betHands[i] || betHands[i] < MIN_CHIP) return 'min';
    if (wagerTotal() > bankroll) return 'funds';
    return null;
  }
  function betIssueMsg(issue) {
    if (issue === 'funds') return tr('gs.blackjack.insufficient', { n: bankroll });
    return tr('gs.blackjack.eachHandMin', { n: MIN_CHIP });
  }
  function adjustSide(kind, dir) {
    if (phase !== 'bet' || paused) return;
    var cur = kind === 'pair' ? sidePair : sideThree;
    var next = cur + dir * MIN_CHIP;
    if (next < 0) next = 0;
    if (dir > 0 && bankroll - wagerTotal() < MIN_CHIP) {
      setMsg(T('gs.blackjack.sideInsufficient'), 'var(--neon-pink)');
      audio('error');
      return;
    }
    if (kind === 'pair') sidePair = next; else sideThree = next;
    audio('coin');
    burstEl(kind === 'pair' ? pairAmt : threeAmt, '#ffd447', 8);
    setMsg(tr('gs.blackjack.sideBetMsg', { n: next }), 'var(--neon-cyan)');
    render(); updateButtons();
  }
  function setHandCount(n) {
    if (phase !== 'bet' || paused) return;
    n = Math.max(1, Math.min(MAX_START_HANDS, n));
    if (n === handCount) return;
    while (betHands.length < n) {
      var canAdd = bankroll - wagerTotal() >= MIN_CHIP;
      betHands.push(canAdd ? MIN_CHIP : 0);
    }
    betHands = betHands.slice(0, n);
    handCount = n;
    if (betTarget >= n) betTarget = n - 1;
    audio('ui');
    render(); updateButtons();
  }
  function addChip(v) {
    if (phase !== 'bet' || paused) return;
    if (bankroll - wagerTotal() < v) {
      setMsg(tr('gs.blackjack.insufficient', { n: bankroll - wagerTotal() }), 'var(--neon-pink)');
      audio('error');
      return;
    }
    betHands[betTarget] = (betHands[betTarget] || 0) + v;
    audio('coin');
    setMsg(tr('gs.blackjack.betReady', { n: wagerTotal() }), 'var(--neon-cyan)');
    render(); updateButtons();
  }
  function clearBet() {
    if (phase !== 'bet') return;
    for (var i = 0; i < betHands.length; i++) betHands[i] = 0;
    sidePair = 0; sideThree = 0;
    setMsg(T('gs.blackjack.start'));
    render(); updateButtons();
  }
  function repeatBet() {
    if (phase !== 'bet') return;
    var next = [];
    for (var i = 0; i < handCount; i++) {
      var v = lastBetEach[i] !== undefined ? lastBetEach[i] : lastBetEach[0];
      next.push(v && v >= MIN_CHIP ? v : MIN_CHIP);
    }
    var sum = 0;
    for (var j = 0; j < next.length; j++) sum += next[j];
    if (sum + sidePair + sideThree > bankroll) {
      setMsg(tr('gs.blackjack.insufficient', { n: bankroll }), 'var(--neon-pink)');
      audio('error');
      return;
    }
    betHands = next;
    audio('coin');
    setMsg(tr('gs.blackjack.betReady', { n: wagerTotal() }), 'var(--neon-cyan)');
    render(); updateButtons();
  }

  /* ---------- 发牌 / 玩家行动 ---------- */
  function startRound() {
    if (phase !== 'bet' || paused) return;
    var issue = betIssue();
    if (issue) {
      setMsg(betIssueMsg(issue), 'var(--neon-pink)');
      audio('error');
      return;
    }
    roundToken++;
    busy = false;
    roundStart = bankroll;
    var mainTotal = totalMainBet();
    bankroll -= mainTotal + sidePair + sideThree;
    lastBetEach = betHands.slice();
    sideStake = { pair: sidePair, three: sideThree };
    if (!deck || deck.length < 26) deck = buildDeck();
    dealer = [];
    hands = [];
    for (var h = 0; h < handCount; h++) {
      hands.push({ cards: [], bet: betHands[h], doubled: false, done: false, bust: false, split: false, natural: false });
    }
    for (var i = 0; i < handCount; i++) { hands[i].cards.push(draw()); hands[i].cards.push(draw()); }
    dealer.push(draw());
    dealer.push(draw());
    for (var j = 0; j < hands.length; j++) hands[j].natural = handValue(hands[j].cards).v === 21;
    sideCards = {
      pair: [{ s: hands[0].cards[0].s, r: hands[0].cards[0].r, uid: hands[0].cards[0].uid },
        { s: hands[0].cards[1].s, r: hands[0].cards[1].r, uid: hands[0].cards[1].uid }],
      three: [{ s: hands[0].cards[0].s, r: hands[0].cards[0].r, uid: hands[0].cards[0].uid },
        { s: hands[0].cards[1].s, r: hands[0].cards[1].r, uid: hands[0].cards[1].uid },
        { s: dealer[0].s, r: dealer[0].r, uid: dealer[0].uid }]
    };
    handIndex = 0;
    hidden = true;
    insuranceBet = 0; insuranceTaken = false;
    trainLast = null;
    phase = 'player';
    if (mode === MODE_TOUR && !tour.active) {
      tour.active = true; tour.round = 0; tour.wins = 0; tour.losses = 0; tour.pushes = 0; tour.done = false;
    }
    hideResult();
    if (dealer[0].r === 'A') {
      setMsg(T('gs.blackjack.insuranceOffer'), 'var(--neon-yellow)');
    } else {
      setMsg(handCount > 1 ? tr('gs.blackjack.multiTurn', { n: 1, m: handCount }) : T('gs.blackjack.hitOrStand'));
    }
    audio('drop');
    render(); updateButtons(); writeSave();
    if (hands[0].natural) {
      later(function () {
        if (phase === 'player') setMsg(T('gs.blackjack.naturalReady'), 'var(--neon-yellow)');
      }, 350, roundToken);
    }
  }

  function gradeAction(action) {
    if (mode !== MODE_TRAIN) return;
    var h = currentHand();
    if (!h || !dealer.length) return;
    var bestAction = bestFor(h);
    trainStats.total++;
    if (action === bestAction) trainStats.correct++;
    trainLast = { best: bestAction, chosen: action, ok: action === bestAction };
    try {
      localStorage.setItem('arcade_bj_train_stats', JSON.stringify({ total: trainStats.total, correct: trainStats.correct }));
    } catch (e) {}
  }

  function markDone(h, bust) {
    h.done = true; h.bust = !!bust;
    busy = true; updateButtons(); render();
    if (bust && !reducedOn()) {
      var panel = handsEl.children[handIndex];
      var cards = panel && panel.querySelector('.bj-cards');
      if (cards) burstEl(cards, '#ff5c7a', 9);
    }
    later(function () { busy = false; advanceHand(); }, 420, roundToken);
  }

  function advanceHand() {
    if (phase !== 'player') return;
    while (handIndex < hands.length && hands[handIndex].done) handIndex++;
    if (handIndex >= hands.length) { dealerTurn(); return; }
    busy = false;
    trainLast = null;
    setMsg(hands.length > 1 ? tr('gs.blackjack.handTurn', { n: handIndex + 1 }) : T('gs.blackjack.hitOrStand'));
    render(); updateButtons(); writeSave();
  }

  function hit() {
    if (phase !== 'player' || !currentHand() || currentHand().done || busy || paused) return;
    var h = currentHand();
    if (handValue(h.cards).v >= 21) {
      setMsg(T('gs.blackjack.twentyOne'), 'var(--neon-yellow)');
      return;
    }
    gradeAction('hit');
    h.cards.push(draw());
    audio('ui');
    var v = handValue(h.cards).v;
    if (v > 21) {
      setMsg(T('gs.blackjack.bust'), 'var(--neon-pink)');
      audio('lose');
      markDone(h, true);
    } else if (v === 21) {
      setMsg(T('gs.blackjack.twentyOne'), 'var(--neon-yellow)');
      render(); updateButtons();
    } else {
      setMsg(T('gs.blackjack.hitOrStand'));
      render(); updateButtons();
    }
    writeSave();
  }

  function stand() {
    if (phase !== 'player' || !currentHand() || currentHand().done || busy || paused) return;
    var h = currentHand();
    gradeAction('stand');
    h.done = true;
    audio('ui');
    busy = true; updateButtons(); render();
    later(function () { busy = false; advanceHand(); }, 280, roundToken);
    writeSave();
  }

  function dbl() {
    if (phase !== 'player' || !currentHand() || currentHand().done || busy || paused) return;
    var h = currentHand();
    if (h.cards.length !== 2 || bankroll < h.bet || h.natural) {
      setMsg(T('gs.blackjack.cantDouble'), 'var(--neon-pink)');
      audio('error');
      return;
    }
    gradeAction('double');
    bankroll -= h.bet;
    h.bet *= 2; h.doubled = true;
    h.cards.push(draw());
    audio('coin');
    if (handValue(h.cards).v > 21) {
      setMsg(T('gs.blackjack.bust'), 'var(--neon-pink)');
      audio('lose');
    } else setMsg(T('gs.blackjack.doubledMsg'), 'var(--neon-yellow)');
    markDone(h, handValue(h.cards).v > 21);
    writeSave();
  }

  function split() {
    if (phase !== 'player' || !currentHand() || currentHand().done || busy || paused) return;
    var h = currentHand();
    if (h.cards.length !== 2 || !isPair(h.cards) || hands.length >= MAX_TOTAL_HANDS || bankroll < h.bet) {
      setMsg(T('gs.blackjack.cantSplit'), 'var(--neon-pink)');
      audio('error');
      return;
    }
    gradeAction('split');
    bankroll -= h.bet;
    var moved = h.cards.pop();
    h.cards.push(draw());
    h.natural = false;
    hands.splice(handIndex + 1, 0, {
      cards: [moved, draw()], bet: h.bet, doubled: false, done: false,
      bust: false, split: true, natural: false
    });
    audio('drop');
    setMsg(tr('gs.blackjack.handTurn', { n: handIndex + 1 }), 'var(--neon-cyan)');
    render(); updateButtons(); writeSave();
  }

  function insure() {
    if (phase !== 'player' || paused) return;
    if (!dealer.length || dealer[0].r !== 'A' || insuranceTaken) {
      setMsg(T('gs.blackjack.insuranceUnavailable'), 'var(--neon-pink)');
      audio('error');
      return;
    }
    var cost = Math.floor(totalMainBet() / 2);
    if (cost < 1) return;
    if (bankroll < cost) {
      setMsg(tr('gs.blackjack.insufficient', { n: bankroll }), 'var(--neon-pink)');
      audio('error');
      return;
    }
    bankroll -= cost; insuranceBet = cost; insuranceTaken = true;
    audio('coin');
    setMsg(tr('gs.blackjack.insuranceTaken', { n: cost }), 'var(--neon-yellow)');
    render(); updateButtons(); writeSave();
  }

  /* ---------- 庄家 ---------- */
  function dealerTurn() {
    phase = 'dealer';
    hidden = false;
    busy = true;
    setMsg(T('gs.blackjack.dealerTurn'), 'var(--neon-cyan)');
    audio('drop');
    render(); updateButtons();
    later(function () { dealerStep(); }, 620, roundToken);
  }
  function dealerStep() {
    if (phase !== 'dealer') return;
    var alive = false;
    for (var i = 0; i < hands.length; i++) if (handValue(hands[i].cards).v <= 21) { alive = true; break; }
    if (!alive) { settle(); return; }
    var hv = handValue(dealer);
    if (hv.v < 17 || (hv.v === 17 && hv.soft)) {
      dealer.push(draw());
      audio('ui');
      render();
      later(function () { dealerStep(); }, 680, roundToken);
    } else {
      settle();
    }
  }

  /* ---------- 结算 ---------- */
  function buildDetails(res) {
    var lines = [];
    for (var i = 0; i < res.handResults.length; i++) {
      var hr = res.handResults[i];
      lines.push({
        text: tr('gs.blackjack.handResult', { n: i + 1, r: resultLabel(hr.result), x: signed(hr.net) }),
        tone: hr.net > 0 ? 'good' : (hr.net < 0 ? 'bad' : '')
      });
    }
    if (sideStake.pair > 0) {
      if (res.sidePair.kind) {
        lines.push({
          text: tr('gs.blackjack.sideWin', {
            a: T('gs.blackjack.sidePair'), b: kindLabel('pair', res.sidePair.kind),
            x: signed(res.sidePair.net)
          }), tone: res.sidePair.net > 0 ? 'good' : ''
        });
      } else {
        lines.push({ text: tr('gs.blackjack.sideMiss', { a: T('gs.blackjack.sidePair'), x: signed(-sideStake.pair) }), tone: 'bad' });
      }
    }
    if (sideStake.three > 0) {
      if (res.sideThree.kind) {
        lines.push({
          text: tr('gs.blackjack.sideWin', {
            a: T('gs.blackjack.sideThree'), b: kindLabel('three', res.sideThree.kind),
            x: signed(res.sideThree.net)
          }), tone: res.sideThree.net > 0 ? 'good' : ''
        });
      } else {
        lines.push({ text: tr('gs.blackjack.sideMiss', { a: T('gs.blackjack.sideThree'), x: signed(-sideStake.three) }), tone: 'bad' });
      }
    }
    if (insuranceBet > 0) {
      lines.push({
        text: tr('gs.blackjack.insuranceLine', { x: signed(res.insuranceNet) }),
        tone: res.insuranceNet > 0 ? 'good' : (res.insuranceNet < 0 ? 'bad' : '')
      });
    }
    return lines;
  }

  function tourStanding() {
    var gain = bankroll - START_CHIPS;
    var score = gain + tour.wins * 10;
    var rank = 4, bonus = 10;
    if (score >= 150) { rank = 1; bonus = 100; }
    else if (score >= 90) { rank = 2; bonus = 60; }
    else if (score >= 40) { rank = 3; bonus = 30; }
    return { rank: rank, bonus: bonus, gain: gain, score: score };
  }
  function recordTour(bonus) {
    try {
      var prev = Number(localStorage.getItem('arcade_best_blackjack_tour'));
      if (!isFinite(prev) || prev < bankroll) localStorage.setItem('arcade_best_blackjack_tour', String(bankroll));
    } catch (e) {}
    try {
      var pts = Number(localStorage.getItem('arcade_bj_tour_points')) || 0;
      localStorage.setItem('arcade_bj_tour_points', String(pts + bonus));
    } catch (e) {}
    tourBest = loadTourBest();
  }
  function finishTournament(handDetails) {
    phase = 'over';
    tour.done = true;
    var st = tourStanding();
    recordTour(st.bonus);
    var details = (handDetails || []).slice();
    details = details.concat([{
      text: T('gs.blackjack.tourFinal') + ' ' + bankroll,
      tone: bankroll >= START_CHIPS ? 'good' : 'bad'
    }, {
      text: tr('gs.blackjack.tourWinsLine', { n: tour.wins })
    }, {
      text: tr('gs.blackjack.tourRank', { n: st.rank }) + ' · ' + tr('gs.blackjack.tourBonus', { n: st.bonus }),
      tone: st.rank <= 2 ? 'good' : ''
    }]);
    showResult({
      title: T('gs.blackjack.tourEndTitle'),
      color: st.rank <= 2 ? 'var(--neon-yellow)' : 'var(--neon-cyan)',
      net: bankroll + ' ' + T('gs.blackjack.chips'),
      netColor: bankroll >= START_CHIPS ? 'var(--neon-green)' : 'var(--neon-pink)',
      sub: tr('gs.blackjack.tourEndSub', { n: tour.round }),
      details: details
    });
    setMsg(T('gs.blackjack.tourEndMsg'), 'var(--neon-yellow)');
    nextBtn.style.display = 'none';
    writeSave();
    render(); updateButtons();
  }

  function settle() {
    phase = 'result';
    hidden = false;
    var res = settleRound(hands, dealer, insuranceBet, {
      pairStake: sideStake.pair, pairCards: sideCards && sideCards.pair,
      threeStake: sideStake.three, threeCards: sideCards && sideCards.three
    });
    bankroll = Math.round(bankroll + res.payout);
    if (typeof roundStart !== 'number') roundStart = bankroll;
    var net = bankroll - roundStart;
    var details = buildDetails(res);

    if (mode === MODE_TOUR) {
      tour.round++;
      tour.wins += res.wins;
      tour.losses += res.losses;
      tour.pushes += res.pushes;
    }

    var title, color;
    if (res.wins > 0 && res.losses === 0) { title = T('gs.blackjack.roundWin'); color = 'var(--neon-green)'; audio('win'); }
    else if (res.losses > 0 && res.wins === 0) { title = T('gs.blackjack.roundLose'); color = 'var(--neon-pink)'; audio('lose'); }
    else if (res.wins > 0 && res.losses > 0) { title = T('gs.blackjack.roundMixed'); color = 'var(--neon-cyan)'; audio('ui'); }
    else { title = T('gs.blackjack.push'); color = 'var(--text-dim)'; audio('ui'); }
    var naturalWin = false;
    for (var n = 0; n < res.handResults.length; n++) if (res.handResults[n].result === 'natural') naturalWin = true;
    if (naturalWin) { title += ' · ' + T('gs.blackjack.naturalWin'); color = 'var(--neon-yellow)'; }

    if (mode === MODE_NORMAL) submit();
    var sub = tr('gs.blackjack.roundSub', { b: bankroll });
    if (mode === MODE_TOUR) sub += ' · ' + tr('gs.blackjack.tourRound', { a: Math.min(tour.round, TOUR_ROUNDS), b: TOUR_ROUNDS });
    if (mode !== MODE_TOUR && bankroll >= GOAL_CHIPS) sub += ' · ' + tr('gs.blackjack.goalHit', { n: GOAL_CHIPS });
    if (bankroll < MIN_CHIP) phase = 'over';

    var tourDone = mode === MODE_TOUR && (tour.round >= TOUR_ROUNDS || bankroll < MIN_CHIP);
    if (tourDone) {
      finishTournament(details);
      return;
    }

    showResult({
      title: title, color: color,
      net: signed(net) + ' ' + T('gs.blackjack.chips'),
      netColor: net > 0 ? 'var(--neon-green)' : (net < 0 ? 'var(--neon-pink)' : 'var(--text-dim)'),
      sub: sub, details: details
    });
    if (net > 0) {
      tableEl.classList.add('bj-win-glow');
      setTimeout(function () { tableEl.classList.remove('bj-win-glow'); }, 700);
      if (!reducedOn()) {
        burstEl(tableEl, '#39ff14', 18);
        var twr = tableEl.getBoundingClientRect();
        if (window.Arcade && Arcade.fx && twr.width) {
          Arcade.fx.burst(twr.left + twr.width / 2, twr.bottom - 20, '#ffd447', 12);
        }
      }
    } else if (net < 0) {
      if (window.Arcade && Arcade.fx) Arcade.fx.shake(tableEl);
      if (!reducedOn()) {
        var hwr = handsEl.getBoundingClientRect();
        if (window.Arcade && Arcade.fx && hwr.width) {
          Arcade.fx.burst(hwr.left + hwr.width / 2, hwr.top + 30, '#ff5c7a', 10);
        }
      }
    }
    if (phase === 'over') {
      setMsg(tr('gs.blackjack.broke', { n: bankroll }), 'var(--neon-pink)');
      nextBtn.style.display = 'none';
    } else {
      setMsg(T('gs.blackjack.settled'), 'var(--text-dim)');
    }
    writeSave();
    render(); updateButtons();
  }

  function gameOver() {
    if (mode === MODE_TOUR) {
      tour.done = true;
      finishTournament();
      return;
    }
    phase = 'over';
    if (mode === MODE_NORMAL) submit();
    showResult({
      title: T('gs.blackjack.roundLose'),
      color: 'var(--neon-pink)',
      net: bankroll + ' ' + T('gs.blackjack.chips'),
      netColor: 'var(--neon-pink)',
      sub: tr('gs.blackjack.broke', { n: bankroll }) + ' · ' + T('gs.blackjack.tapRestart')
    });
    nextBtn.style.display = 'none';
    setMsg(tr('gs.blackjack.broke', { n: bankroll }), 'var(--neon-pink)');
    render(); updateButtons(); writeSave();
  }

  /* ---------- 流程控制 ---------- */
  function prepareNext() {
    roundToken++;
    hideResult();
    phase = 'bet';
    hands = []; dealer = []; hidden = false; busy = false; paused = false;
    insuranceBet = 0; insuranceTaken = false;
    sidePair = 0; sideThree = 0; sideStake = { pair: 0, three: 0 }; sideCards = null;
    var keepMode = mode === MODE_TRAIN ? MODE_TRAIN : (mode === MODE_TOUR ? MODE_TOUR : MODE_NORMAL);
    mode = keepMode;
    if (bankroll >= MIN_CHIP) {
      betHands = [];
      for (var i = 0; i < handCount; i++) {
        var v = lastBetEach[i] !== undefined ? lastBetEach[i] : MIN_CHIP;
        betHands.push(v >= MIN_CHIP && v <= bankroll ? v : Math.min(MIN_CHIP, bankroll) | 0);
      }
      if (!betHands.length) betHands = [Math.min(MIN_CHIP, bankroll)];
      if (betHands.length !== handCount) handCount = betHands.length;
      betTarget = 0;
      setMsg(T('gs.blackjack.start'), '');
    } else {
      betHands = [0];
      handCount = 1; betTarget = 0;
      setMsg(tr('gs.blackjack.broke', { n: bankroll }), 'var(--neon-pink)');
    }
    trainLast = null;
    render(); updateButtons(); writeSave();
  }

  function resetSession() {
    roundToken++;
    hideResult();
    paused = false;
    pauseOv.classList.remove('show');
    bankroll = START_CHIPS;
    handCount = 1; betHands = [MIN_CHIP]; betTarget = 0; lastBetEach = [MIN_CHIP];
    deck = buildDeck(); dealer = []; hands = []; handIndex = 0;
    hidden = false; phase = 'bet'; insuranceBet = 0; insuranceTaken = false; busy = false;
    sidePair = 0; sideThree = 0; sideStake = { pair: 0, three: 0 }; sideCards = null;
    tour = { round: 0, wins: 0, losses: 0, pushes: 0, active: false, done: false };
    trainLast = null;
    refreshBest();
    tourBest = loadTourBest();
  }

  function fullReset() {
    if (phase === 'player' || phase === 'dealer') submit();
    clearSave();
    resetSession();
    if (mode === MODE_TRAIN) { hintEnabled = true; countEnabled = true; }
    else { hintEnabled = false; countEnabled = false; }
    setMsg(mode === MODE_TOUR ? T('gs.blackjack.tourIntro') : (mode === MODE_TRAIN ? T('gs.blackjack.trainingIntro') : T('gs.blackjack.start')), mode === MODE_TOUR ? 'var(--neon-yellow)' : '');
    render(); updateButtons(); writeSave();
  }

  function switchMode(next) {
    if (phase !== 'bet' || paused || next === mode) return;
    mode = next;
    resetSession();
    if (mode === MODE_TRAIN) { hintEnabled = true; countEnabled = true; }
    else if (mode === MODE_TOUR) { hintEnabled = false; countEnabled = false; }
    else { hintEnabled = false; countEnabled = false; }
    setMsg(mode === MODE_TOUR ? T('gs.blackjack.tourIntro') : (mode === MODE_TRAIN ? T('gs.blackjack.trainingIntro') : T('gs.blackjack.start')), mode === MODE_TOUR ? 'var(--neon-yellow)' : '');
    render(); updateButtons(); writeSave();
  }

  function togglePause(force) {
    if (phase !== 'player' && phase !== 'dealer') return;
    paused = (force === undefined) ? !paused : !!force;
    pauseOv.classList.toggle('show', paused);
    updateButtons();
    if (!paused) render();
  }

  /* ---------- 事件 ---------- */
  chipRow.addEventListener('click', function (e) {
    var b = e.target.closest('.bj-chip');
    if (!b) return;
    addChip(Number(b.getAttribute('data-v')));
    burstEl(b, '#ffd447', 10);
  });
  betPlans.addEventListener('click', function (e) {
    var b = e.target.closest('.bj-plan');
    if (!b) return;
    betTarget = Number(b.getAttribute('data-i'));
    render(); updateButtons();
  });
  handPick.addEventListener('click', function (e) {
    var b = e.target.closest('.bj-count-btn');
    if (!b) return;
    setHandCount(Number(b.getAttribute('data-n')));
  });
  sideBox.addEventListener('click', function (e) {
    var b = e.target.closest('.bj-side-plus, .bj-side-minus');
    if (!b) return;
    adjustSide(b.getAttribute('data-side'), b.classList.contains('bj-side-plus') ? 1 : -1);
  });
  modesEl.addEventListener('click', function (e) {
    var b = e.target.closest('.bj-mode');
    if (!b) return;
    switchMode(b.getAttribute('data-mode'));
  });
  clearBtn.addEventListener('click', clearBet);
  repeatBtn.addEventListener('click', repeatBet);
  dealBtn.addEventListener('click', startRound);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', stand);
  doubleBtn.addEventListener('click', dbl);
  splitBtn.addEventListener('click', split);
  insureBtn.addEventListener('click', insure);
  nextBtn.addEventListener('click', function () {
    if (bankroll < MIN_CHIP) { gameOver(); return; }
    prepareNext();
    audio('ui');
  });
  restartBtn.addEventListener('click', fullReset);
  rRestartBtn.addEventListener('click', fullReset);
  pauseBtn.addEventListener('click', function () { togglePause(); });
  resumeBtn.addEventListener('click', function () { togglePause(false); });
  pauseRestartBtn.addEventListener('click', fullReset);
  hintToggleBtn.addEventListener('click', function () {
    if (mode !== MODE_TRAIN) return;
    hintEnabled = !hintEnabled;
    audio('ui');
    render(); updateButtons();
  });
  countToggleBtn.addEventListener('click', function () {
    if (mode === MODE_TOUR) return;
    countEnabled = !countEnabled;
    audio('ui');
    render(); updateButtons();
  });

  function keyAction(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    var key = e.key;
    var active = document.activeElement;
    var mainIds = { 'bj-hit': 1, 'bj-stand': 1, 'bj-double': 1, 'bj-split': 1, 'bj-insure': 1 };
    if (active && active.tagName === 'BUTTON' && !mainIds[active.id] && (key === 'Enter' || key === ' ')) return;
    if (paused) {
      if (key === 'Enter' || key === ' ' || key === 'Escape') { e.preventDefault(); togglePause(false); }
      return;
    }
    if (key === 'Escape') {
      if (phase === 'player' || phase === 'dealer') { e.preventDefault(); togglePause(true); }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      if (resultEl.classList.contains('show')) {
        if (phase === 'over') { fullReset(); return; }
        if (bankroll < MIN_CHIP) { gameOver(); return; }
        prepareNext();
        return;
      }
      if (phase === 'bet') { startRound(); return; }
      if (phase === 'player') {
        if (key === 'Enter') hit(); else stand();
      }
      return;
    }
    if (phase === 'player' && !busy) {
      var k = key.toLowerCase();
      if (k === 'h') hit();
      else if (k === 's') stand();
      else if (k === 'd') dbl();
      else if (k === 'p') split();
      else if (k === 'i') insure();
    }
  }
  wrap.addEventListener('pointerup', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    setTimeout(function () { if (document.activeElement === b) b.blur(); }, 0);
  });
  document.addEventListener('keydown', keyAction);
  window.addEventListener('resize', scheduleFelt);

  /* ---------- 初始化 ---------- */
  mode = MODE_NORMAL;
  resetSession();
  hintEnabled = false; countEnabled = false;
  trainStats = { total: 0, correct: 0 };
  try {
    var ts = JSON.parse(localStorage.getItem('arcade_bj_train_stats') || 'null');
    if (ts && typeof ts === 'object') {
      trainStats.total = Math.max(0, Math.floor(ts.total || 0));
      trainStats.correct = Math.max(0, Math.min(trainStats.total, Math.floor(ts.correct || 0)));
    }
  } catch (e) {}
  roundToken = 0; resultInfo = null; paused = false; trainLast = null;
  tourBest = loadTourBest();
  refreshBest();

  if (!tryResume()) {
    setMsg(T('gs.blackjack.start'), '');
    render(); updateButtons();
    writeSave();
  } else {
    render(); updateButtons();
  }

  /* helpText */
  var hd = document.createElement('div');
  hd.className = 'bj-help';
  hd.innerHTML = T('gs.blackjack.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () { fullReset(); };
})();
