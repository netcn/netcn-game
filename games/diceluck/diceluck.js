/* 快艇骰子 Dice Roll —— 五颗立体骰子 · 13 类计分 · 断点续玩 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.diceluck.tut1t'), d: T('gs.diceluck.tut1') },
  { t: T('gs.diceluck.tut2t'), d: T('gs.diceluck.tut2') },
  { t: T('gs.diceluck.tut3t'), d: T('gs.diceluck.tut3') },
  { t: T('gs.diceluck.tut4t'), d: T('gs.diceluck.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var CATS = [
    { key: 'ones', label: 'ones', top: true },
    { key: 'twos', label: 'twos', top: true },
    { key: 'threes', label: 'threes', top: true },
    { key: 'fours', label: 'fours', top: true },
    { key: 'fives', label: 'fives', top: true },
    { key: 'sixes', label: 'sixes', top: true },
    { key: 'threeKind', label: 'threeKind' },
    { key: 'fourKind', label: 'fourKind' },
    { key: 'fullHouse', label: 'fullHouse' },
    { key: 'smallStraight', label: 'smallStraight' },
    { key: 'largeStraight', label: 'largeStraight' },
    { key: 'yahtzee', label: 'yahtzee' },
    { key: 'chance', label: 'chance' }
  ];
  var DIFFS = [
    { rolls: 4, mult: 1 },
    { rolls: 3, mult: 1 },
    { rolls: 2, mult: 1.5 }
  ];
  var DIFF_INFO = [
    { t: T('gs.diceluck.diffEasy'), d: T('gs.diceluck.diffEasyD') },
    { t: T('gs.diceluck.diffNormal'), d: T('gs.diceluck.diffNormalD') },
    { t: T('gs.diceluck.diffHard'), d: T('gs.diceluck.diffHardD') }
  ];
  var MODE_INFO = [
    { key: 'solo', t: T('gs.diceluck.modeSolo'), d: T('gs.diceluck.modeSoloD') },
    { key: 'daily', t: T('gs.diceluck.modeDaily'), d: T('gs.diceluck.modeDailyD') },
    { key: 'vs', t: T('gs.diceluck.modeVs'), d: T('gs.diceluck.modeVsD') }
  ];
  /* 挑战卡：每局三选一，真实改写规则 */
  var CARDS = [
    { id: 'upper2', t: T('gs.diceluck.cardUpper2'), d: T('gs.diceluck.cardUpper2D') },
    { id: 'lower15', t: T('gs.diceluck.cardLower15'), d: T('gs.diceluck.cardLower15D') },
    { id: 'oneRoll', t: T('gs.diceluck.cardOneRoll'), d: T('gs.diceluck.cardOneRollD') },
    { id: 'fixedSix', t: T('gs.diceluck.cardFixedSix'), d: T('gs.diceluck.cardFixedSixD') },
    { id: 'straight15', t: T('gs.diceluck.cardStraight15'), d: T('gs.diceluck.cardStraight15D') },
    { id: 'chance25', t: T('gs.diceluck.cardChance25'), d: T('gs.diceluck.cardChance25D') }
  ];
  var DAILY_KEY = 'arcade_daily_diceluck';
  /* 标准骰面点位（3×3 网格：行, 列） */
  var PIP_LAYOUT = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]]
  };

  var dice = [1, 1, 1, 1, 1];
  var hold = [false, false, false, false, false];
  var rollsLeft = 3;
  var used = {};
  var turn = 1;
  var over = false;
  var rolling = false;
  var submitted = false;
  var hasProgress = false;
  var diffIdx = 1;
  var selKey = CATS[0].key;
  var mode = 'solo';
  var cardId = null;
  var cardsShown = [];
  var rng = Math.random;
  var aiUsed = {};
  var aiTotal = 0;
  var aiLast = null;
  var daily = null;
  var dieEls = [];
  var rollTimer = null, faceTimer = null, landTimer = null;
  var endOverlay, endTitleEl, endScoreEl, endLabelEl, endTagEl, endBreakEl, endBestEl, endPlayBtn;

  function tr(key, vars) {
    var s = T(key);
    if (vars) {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k)) s = s.replace('{' + k + '}', vars[k]);
      }
    }
    return s;
  }
  function maxRolls() {
    var base = DIFFS[diffIdx].rolls;
    if (cardId === 'oneRoll') base = Math.min(base, 2);
    return base;
  }
  function mult() { return DIFFS[diffIdx].mult; }

  /* ---------- 每日种子 / 模式 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function loadDaily() {
    var today = todayStr();
    try {
      var o = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
      if (o && o.date === today) return { date: today, best: Number(o.best) || 0, plays: Number(o.plays) || 0 };
    } catch (e) {}
    return { date: today, best: 0, plays: 0 };
  }
  function saveDaily() { try { localStorage.setItem(DAILY_KEY, JSON.stringify(daily)); } catch (e) {} }
  function bestKey() { return mode === 'vs' ? 'diceluck_vs' : 'diceluck'; }
  function isTop(key) { for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) return !!CATS[i].top; return false; }
  function findCard(id) {
    for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i];
    return null;
  }
  function cardAdjust(key, pts) {
    if (cardId === 'upper2' && isTop(key)) return pts * 2;
    if (cardId === 'lower15' && !isTop(key)) return Math.round(pts * 1.5);
    if (cardId === 'straight15' && key === 'smallStraight' && pts > 0) return pts + 15;
    if (cardId === 'chance25' && key === 'chance' && pts > 0) return pts + 25;
    return pts;
  }
  function randDie() { return 1 + Math.floor(rng() * 6); }
  function shufflePick(arr, n) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy.slice(0, n);
  }

  function isUsed(key) { return Object.prototype.hasOwnProperty.call(used, key); }
  function usedCount() { return Object.keys(used).length; }
  function bestValue() {
    if (mode === 'daily' && daily) return daily.best > 0 ? daily.best : null;
    try {
      if (window.Arcade && Arcade.storage && Arcade.storage.getBest) return Arcade.storage.getBest(bestKey());
    } catch (e) {}
    return null;
  }
  function reducedMotion() {
    try {
      if (window.Arcade && Arcade.settings && Arcade.settings.get) return !!Arcade.settings.get().reducedMotion;
    } catch (e) {}
    return false;
  }
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }

  /* ---------- 核心规则 ---------- */
  function roll() {
    for (var i = 0; i < 5; i++) if (!hold[i]) dice[i] = randDie();
    if (cardId === 'fixedSix') dice[0] = 6;
    rollsLeft--;
  }
  function newGame() {
    abortAnim();
    daily = loadDaily();
    rng = mode === 'daily' ? mulberry32(seedOf(daily.date)) : Math.random;
    if (mode === 'daily') {
      diffIdx = 1;
      var seedIdx = seedOf(daily.date) % CARDS.length;
      cardId = CARDS[seedIdx].id;
      cardsShown = [CARDS[seedIdx], CARDS[(seedIdx + 1) % CARDS.length], CARDS[(seedIdx + 2) % CARDS.length]];
    } else {
      cardsShown = shufflePick(CARDS, 3);
      cardId = cardsShown[0].id;
    }
    dice = [];
    for (var i = 0; i < 5; i++) dice.push(randDie());
    if (cardId === 'fixedSix') dice[0] = 6;
    hold = [false, false, false, false, false];
    rollsLeft = maxRolls();
    used = {};
    aiUsed = {};
    aiTotal = 0;
    aiLast = null;
    turn = 1;
    over = false;
    rolling = false;
    submitted = false;
    hasProgress = false;
    selKey = CATS[0].key;
  }
  function countsOf(arr) {
    var c = [0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 5; i++) c[arr[i]]++;
    return c;
  }
  function counts() { return countsOf(dice); }
  function scoreForDice(key, arr) {
    var c = countsOf(arr), sum = 0;
    for (var i = 0; i < 5; i++) sum += arr[i];
    var pts;
    if (key === 'ones') pts = c[1] * 1;
    else if (key === 'twos') pts = c[2] * 2;
    else if (key === 'threes') pts = c[3] * 3;
    else if (key === 'fours') pts = c[4] * 4;
    else if (key === 'fives') pts = c[5] * 5;
    else if (key === 'sixes') pts = c[6] * 6;
    else if (key === 'threeKind') pts = c.some(function (x) { return x >= 3; }) ? sum : 0;
    else if (key === 'fourKind') pts = c.some(function (x) { return x >= 4; }) ? sum : 0;
    else if (key === 'fullHouse') {
      var has2 = false, has3 = false;
      for (var k = 1; k <= 6; k++) { if (c[k] === 2) has2 = true; if (c[k] === 3) has3 = true; }
      pts = (has2 && has3) ? 25 : 0;
    } else if (key === 'smallStraight') {
      var s = '';
      for (var k2 = 1; k2 <= 6; k2++) s += c[k2] > 0 ? '1' : '0';
      pts = s.indexOf('1111') >= 0 ? 30 : 0;
    } else if (key === 'largeStraight') {
      pts = (c[1] && c[2] && c[3] && c[4] && c[5]) || (c[2] && c[3] && c[4] && c[5] && c[6]) ? 40 : 0;
    } else if (key === 'yahtzee') pts = c.some(function (x) { return x === 5; }) ? 50 : 0;
    else pts = sum;
    return cardAdjust(key, pts);
  }
  function scoreFor(key) { return scoreForDice(key, dice); }
  function upperSum() {
    var s = 0;
    CATS.forEach(function (c) { if (c.top && isUsed(c.key)) s += used[c.key]; });
    return s;
  }
  function lowerSum() {
    var s = 0;
    CATS.forEach(function (c) { if (!c.top && isUsed(c.key)) s += used[c.key]; });
    return s;
  }
  function topBonus() { return upperSum() >= 63 ? 35 : 0; }
  function rawTotal() { return upperSum() + topBonus() + lowerSum(); }
  function finalTotal() { return Math.round(rawTotal() * mult()); }
  function upperFor(u) {
    var s = 0;
    CATS.forEach(function (c) { if (c.top && Object.prototype.hasOwnProperty.call(u, c.key)) s += u[c.key]; });
    return s;
  }
  function lowerFor(u) {
    var s = 0;
    CATS.forEach(function (c) { if (!c.top && Object.prototype.hasOwnProperty.call(u, c.key)) s += u[c.key]; });
    return s;
  }
  function totalFor(u) {
    var up = upperFor(u);
    return Math.round((up + (up >= 63 ? 35 : 0) + lowerFor(u)) * mult());
  }
  /* AI：独立计分卡，按每轮随机骰子的最优可填类别决策，不读取玩家骰子 */
  function aiPlayTurn() {
    var avail = CATS.filter(function (c) { return !Object.prototype.hasOwnProperty.call(aiUsed, c.key); });
    if (!avail.length) return;
    var rolls = maxRolls();
    var best = null;
    for (var r = 0; r < rolls; r++) {
      var ad = [];
      for (var d = 0; d < 5; d++) ad.push(randDie());
      if (cardId === 'fixedSix') ad[0] = 6;
      for (var i = 0; i < avail.length; i++) {
        var pts = scoreForDice(avail[i].key, ad);
        if (!best || pts > best.pts) best = { key: avail[i].key, pts: pts };
      }
    }
    if (!best) return;
    aiUsed[best.key] = best.pts;
    aiLast = best;
    aiTotal = totalFor(aiUsed);
  }

  /* ---------- 界面骨架 ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'dl-wrap';
  wrap.innerHTML =
    '<div class="dl-head">' +
      '<div class="dl-diffs" role="group" aria-label="' + T('gs.diceluck.diffTitle') + '">' +
        DIFF_INFO.map(function (d, i) {
          return '<button type="button" class="dl-diff" data-diff="' + i + '" aria-pressed="false">' +
            d.t + '<small>' + d.d + '</small></button>';
        }).join('') +
      '</div>' +
      '<button type="button" class="dl-mini" id="dl-restart" aria-label="' + T('gs.diceluck.restart') + '" title="' + T('gs.diceluck.restart') + '">↺</button>' +
    '</div>' +
    '<div class="dl-modes" id="dl-modes" role="group" aria-label="' + T('gs.diceluck.modeTitle') + '">' +
      MODE_INFO.map(function (m) {
        return '<button type="button" class="dl-mode" data-mode="' + m.key + '" aria-pressed="false">' +
          m.t + '<small>' + m.d + '</small></button>';
      }).join('') +
    '</div>' +
    '<div class="dl-cardpick" id="dl-cardpick"></div>' +
    '<div class="dl-stage">' +
      '<div class="dl-dice" id="dl-dice" role="group" aria-label="' + T('gs.diceluck.diceGroup') + '"></div>' +
      '<div class="dl-msg" id="dl-msg" aria-live="polite"></div>' +
    '</div>' +
    '<div class="dl-mainrow">' +
      '<div class="dl-totalbox">' +
        '<div class="dl-total-line"><span>' + T('gs.diceluck.total') + '</span><b id="dl-total">0</b><i class="dl-mult" id="dl-mult">×1</i></div>' +
        '<div class="dl-total-sub"><span id="dl-turn"></span><span id="dl-best"></span></div>' +
        '<div class="dl-ai" id="dl-ai" hidden></div>' +
      '</div>' +
      '<button type="button" class="btn yellow dl-roll" id="dl-roll"></button>' +
    '</div>' +
    '<div class="dl-card">' +
      '<div class="dl-card-head"><span>' + T('gs.diceluck.catCol') + '</span><span>' + T('gs.diceluck.scoreCol') + '</span></div>' +
      '<div class="dl-scroll" id="dl-scroll"></div>' +
    '</div>' +
    '<div class="dl-help">' + T('gs.diceluck.helpText') + '<br><span class="dl-keys">' + T('gs.diceluck.helpKeys') + '</span></div>';

  endOverlay = document.createElement('div');
  endOverlay.className = 'dl-end-overlay';
  endOverlay.hidden = true;
  endOverlay.innerHTML =
    '<div class="dl-panel" role="dialog" aria-modal="true" aria-labelledby="dl-end-title">' +
      '<h2 id="dl-end-title"></h2>' +
      '<div class="dl-end-score"><span id="dl-end-label"></span><b id="dl-end-total">0</b></div>' +
      '<div class="dl-end-tag" id="dl-end-tag"></div>' +
      '<div class="dl-end-break" id="dl-end-break"></div>' +
      '<div class="dl-end-best" id="dl-end-best"></div>' +
      '<button type="button" class="btn yellow dl-end-play" id="dl-end-play"></button>' +
    '</div>';
  wrap.appendChild(endOverlay);
  root.appendChild(wrap);

  var diceEl = wrap.querySelector('#dl-dice');
  var msgEl = wrap.querySelector('#dl-msg');
  var totalEl = wrap.querySelector('#dl-total');
  var multEl = wrap.querySelector('#dl-mult');
  var turnEl = wrap.querySelector('#dl-turn');
  var bestEl = wrap.querySelector('#dl-best');
  var rollBtn = wrap.querySelector('#dl-roll');
  var restartBtn = wrap.querySelector('#dl-restart');
  var scrollEl = wrap.querySelector('#dl-scroll');
  var diffBtns = Array.prototype.slice.call(wrap.querySelectorAll('.dl-diff'));
  var modesEl = wrap.querySelector('#dl-modes');
  var modeBtns = Array.prototype.slice.call(wrap.querySelectorAll('.dl-mode'));
  var cardPickEl = wrap.querySelector('#dl-cardpick');
  var aiEl = wrap.querySelector('#dl-ai');

  endTitleEl = endOverlay.querySelector('#dl-end-title');
  endScoreEl = endOverlay.querySelector('#dl-end-total');
  endLabelEl = endOverlay.querySelector('#dl-end-label');
  endTagEl = endOverlay.querySelector('#dl-end-tag');
  endBreakEl = endOverlay.querySelector('#dl-end-break');
  endBestEl = endOverlay.querySelector('#dl-end-best');
  endPlayBtn = endOverlay.querySelector('#dl-end-play');

  /* ---------- 骰子绘制 ---------- */
  function buildDice() {
    diceEl.innerHTML = '';
    dieEls = [];
    for (var i = 0; i < 5; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dl-die';
      btn.setAttribute('data-i', String(i));
      btn.innerHTML = '<span class="dl-face"></span>';
      btn.addEventListener('click', function (idx) {
        return function () {
          if (rolling) { finishRoll(); return; }
          toggleHold(idx);
        };
      }(i));
      diceEl.appendChild(btn);
      dieEls.push(btn);
    }
  }
  function setFace(el, value) {
    if (!el) return;
    var face = el.firstChild;
    if (!face) return;
    el.classList.toggle('red', value === 1 || value === 4);
    var html = '';
    var pts = PIP_LAYOUT[value] || PIP_LAYOUT[1];
    for (var i = 0; i < pts.length; i++) {
      html += '<i class="dl-pip" style="grid-row:' + pts[i][0] + ';grid-column:' + pts[i][1] + '"></i>';
    }
    face.innerHTML = html;
  }
  function renderDice() {
    for (var i = 0; i < 5; i++) {
      var el = dieEls[i];
      if (!el) continue;
      setFace(el, dice[i]);
      el.classList.toggle('hold', !!hold[i]);
      el.classList.remove('rolling', 'landed');
      el.setAttribute('aria-label', tr('gs.diceluck.dieAria', { n: i + 1, p: dice[i] }) +
        ' · ' + T(hold[i] ? 'gs.diceluck.dieLocked' : 'gs.diceluck.dieUnlocked'));
    }
  }

  /* ---------- 渲染 ---------- */
  function renderDiff() {
    diffBtns.forEach(function (b, i) {
      var on = i === diffIdx;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.disabled = mode === 'daily';
      b.classList.toggle('disabled', mode === 'daily');
    });
  }
  function renderModes() {
    modeBtns.forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function renderCards() {
    if (!cardPickEl) return;
    var html = '';
    for (var i = 0; i < cardsShown.length; i++) {
      var c = cardsShown[i];
      var on = c.id === cardId;
      var locked = mode === 'daily' && !on;
      html += '<button type="button" class="dl-cardpick-btn' + (on ? ' active' : '') + (locked ? ' locked' : '') +
        '" data-card="' + c.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
        (locked ? ' disabled aria-disabled="true"' : '') + '>' +
        '<b>' + c.t + '</b><small>' + c.d + '</small></button>';
    }
    cardPickEl.innerHTML = html;
    Array.prototype.forEach.call(cardPickEl.querySelectorAll('.dl-cardpick-btn'), function (b) {
      b.addEventListener('click', function () { selectCard(b.getAttribute('data-card')); });
    });
  }
  function renderAI() {
    if (!aiEl) return;
    if (mode !== 'vs') { aiEl.hidden = true; aiEl.innerHTML = ''; return; }
    aiEl.hidden = false;
    aiEl.innerHTML = T('gs.diceluck.aiScore') + ' <b>' + aiTotal + '</b>' +
      (aiLast ? ' · ' + T('gs.diceluck.cat.' + aiLast.key) + ' +' + aiLast.pts : '');
  }
  function renderTotal() {
    totalEl.textContent = String(finalTotal());
    multEl.textContent = '×' + (mult() === 1 ? '1' : String(mult()));
    var shownTurn = over ? 13 : Math.min(13, usedCount() + 1);
    turnEl.textContent = tr('gs.diceluck.turnInfo', { n: shownTurn });
    var bv = bestValue();
    var lbl = mode === 'daily' ? T('gs.diceluck.dailyBestLabel')
      : (mode === 'vs' ? T('gs.diceluck.vsBestLabel') : T('gs.diceluck.bestLabel'));
    bestEl.textContent = lbl + ' ' + (bv === null ? '----' : bv);
  }
  function renderRollBtn() {
    rollBtn.classList.remove('is-fast', 'is-wait');
    var text, label;
    if (rolling) {
      text = T('gs.diceluck.fastForward');
      label = text;
      rollBtn.classList.add('is-fast');
    } else if (over) {
      text = T('gs.diceluck.endTitle');
      label = text;
      rollBtn.classList.add('is-wait');
    } else if (rollsLeft <= 0) {
      text = T('gs.diceluck.pickNow');
      label = text;
      rollBtn.classList.add('is-wait');
    } else {
      text = tr('gs.diceluck.rollBtn', { n: rollsLeft });
      label = text;
    }
    rollBtn.textContent = text;
    rollBtn.setAttribute('aria-label', label);
  }
  function availableCats() {
    return CATS.filter(function (c) { return !isUsed(c.key); });
  }
  function ensureSel() {
    var avail = availableCats();
    if (!avail.length) { selKey = null; return; }
    var ok = avail.some(function (c) { return c.key === selKey; });
    if (!ok) selKey = avail[0].key;
  }
  function renderCategories() {
    var prevScroll = scrollEl.scrollTop;
    var html = '<div class="dl-sect">' + T('gs.diceluck.upperSection') + '</div>';
    var showPreview = rollsLeft < maxRolls() && !rolling;

    CATS.forEach(function (c) {
      if (c.top) html += catRow(c, showPreview);
    });
    var up = upperSum(), bonus = topBonus();
    var pct = Math.max(0, Math.min(100, Math.round(up / 63 * 100)));
    html += '<div class="dl-sum"><span>' + T('gs.diceluck.topSub') + '</span><span>' + up + ' / 63</span></div>' +
      '<div class="dl-ubar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="dl-sum"><span>' + T('gs.diceluck.topBonus') + '</span><span class="' + (bonus ? 'ok' : 'dim') + '">' +
        (bonus ? '+35' : (up > 0 ? tr('gs.diceluck.bonusNeed', { n: 63 - up }) : '+0')) + '</span></div>';

    html += '<div class="dl-sect">' + T('gs.diceluck.lowerSection') + '</div>';
    CATS.forEach(function (c) {
      if (!c.top) html += catRow(c, showPreview);
    });

    if (mult() !== 1) {
      html += '<div class="dl-sum"><span>' + tr('gs.diceluck.diffBonus', { n: mult() }) + '</span><span>+' +
        (finalTotal() - rawTotal()) + '</span></div>';
    }
    html += '<div class="dl-sum total"><span>' + T('gs.diceluck.total') + '</span><span>' + finalTotal() + '</span></div>';
    scrollEl.innerHTML = html;
    scrollEl.scrollTop = prevScroll;

    Array.prototype.forEach.call(scrollEl.querySelectorAll('.dl-cat'), function (btn) {
      btn.addEventListener('click', function () {
        scoreCategory(btn.getAttribute('data-key'));
      });
    });
  }
  function catRow(c, showPreview) {
    var u = isUsed(c.key);
    var valText, valCls = '', cls = '';
    if (u) {
      valText = String(used[c.key]);
      valCls = 'used';
      cls = 'used';
    } else if (rolling) {
      valText = '…';
      valCls = 'zero';
    } else if (showPreview) {
      var v = scoreFor(c.key);
      valText = String(v);
      valCls = v === 0 ? 'zero' : (v >= 40 ? 'hot' : '');
      cls = 'can';
    } else {
      valText = '—';
      valCls = 'zero';
    }
    if (!u && c.key === selKey) cls += ' sel';
    return '<button type="button" class="dl-cat ' + cls + '" data-key="' + c.key + '"' +
      (u ? ' aria-disabled="true"' : '') + '>' +
      '<span class="dl-cat-name">' + T('gs.diceluck.cat.' + c.key) + '</span>' +
      '<span class="dl-cat-val ' + valCls + '">' + valText + '</span></button>';
  }
  function renderAll() {
    renderModes();
    renderDiff();
    renderCards();
    renderDice();
    renderTotal();
    renderRollBtn();
    renderCategories();
    renderAI();
  }
  function setMsg(key, vars, color) {
    msgEl.textContent = tr(key, vars || {});
    msgEl.style.color = color || '';
  }
  function fail(key, vars) {
    setMsg(key, vars, 'var(--neon-pink)');
    if (window.Arcade && Arcade.audio) Arcade.audio.play('error');
    if (window.Arcade && Arcade.fx) Arcade.fx.shake(msgEl);
  }

  /* ---------- 动画 ---------- */
  function clearTimers() {
    if (faceTimer) { clearInterval(faceTimer); faceTimer = null; }
    if (rollTimer) { clearTimeout(rollTimer); rollTimer = null; }
    if (landTimer) { clearTimeout(landTimer); landTimer = null; }
  }
  function abortAnim() {
    clearTimers();
    rolling = false;
    if (diceEl) diceEl.classList.remove('is-rolling');
    for (var i = 0; i < dieEls.length; i++) dieEls[i].classList.remove('rolling', 'landed');
  }
  function startRoll() {
    if (over) return;
    if (rolling) { finishRoll(); return; }
    if (rollsLeft <= 0) { fail('gs.diceluck.pickCat'); return; }
    clearTimers();
    roll();
    hasProgress = true;
    rolling = true;
    setMsg('gs.diceluck.rollingMsg');
    if (window.Arcade && Arcade.audio) Arcade.audio.play('rotate');
    for (var i = 0; i < 5; i++) if (!hold[i]) dieEls[i].classList.add('rolling');
    diceEl.classList.add('is-rolling');
    renderTotal();
    renderRollBtn();
    renderCategories();

    var dur = reducedMotion() ? 120 : 680;
    faceTimer = setInterval(function () {
      for (var j = 0; j < 5; j++) {
        if (!hold[j]) setFace(dieEls[j], 1 + Math.floor(Math.random() * 6));
      }
    }, 70);
    rollTimer = setTimeout(finishRoll, dur);
  }
  function finishRoll() {
    if (!rolling) return;
    rolling = false;
    if (faceTimer) { clearInterval(faceTimer); faceTimer = null; }
    if (rollTimer) { clearTimeout(rollTimer); rollTimer = null; }
    diceEl.classList.remove('is-rolling');
    renderDice();
    for (var i = 0; i < 5; i++) {
      if (!hold[i]) dieEls[i].classList.add('landed');
    }
    if (landTimer) clearTimeout(landTimer);
    landTimer = setTimeout(function () {
      for (var j = 0; j < dieEls.length; j++) dieEls[j].classList.remove('landed');
      landTimer = null;
    }, 460);
    if (window.Arcade && Arcade.audio) Arcade.audio.play('drop');
    if (rollsLeft > 0) setMsg('gs.diceluck.canRoll', { n: rollsLeft });
    else setMsg('gs.diceluck.pickNow');
    ensureSel();
    renderTotal();
    renderRollBtn();
    renderCategories();
    writeSave();
  }

  /* ---------- 操作 ---------- */
  function toggleHold(idx) {
    if (over) return;
    if (rolling) { finishRoll(); return; }
    if (rollsLeft === maxRolls()) { fail('gs.diceluck.mustRollFirst'); return; }
    hold[idx] = !hold[idx];
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
    renderDice();
    setMsg(hold[idx] ? 'gs.diceluck.lockOn' : 'gs.diceluck.lockOff', { n: idx + 1 });
    writeSave();
  }
  function celebrate(key, pts, row) {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    if (row) {
      var r = row.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    }
    if (key === 'yahtzee' && pts === 50) {
      setMsg('gs.diceluck.yahtzeeShout', { n: pts }, 'var(--neon-yellow)');
      if (window.Arcade && Arcade.audio) Arcade.audio.play('win');
      if (window.Arcade && Arcade.fx) {
        Arcade.fx.flash('var(--neon-yellow)');
        Arcade.fx.burst(cx, cy, 'var(--neon-yellow)', 40);
      }
      return true;
    }
    if (pts >= 40) {
      setMsg('gs.diceluck.greatShout', { n: pts }, 'var(--neon-yellow)');
      if (window.Arcade && Arcade.audio) Arcade.audio.play('record');
      if (window.Arcade && Arcade.fx) {
        Arcade.fx.flash('var(--neon-yellow)');
        Arcade.fx.burst(cx, cy, 'var(--neon-orange)', 28);
      }
      return true;
    }
    if (pts > 0) {
      if (window.Arcade && Arcade.audio) Arcade.audio.play('coin');
      if (window.Arcade && Arcade.fx) Arcade.fx.burst(cx, cy, 'var(--neon-green)', 12);
    } else {
      if (window.Arcade && Arcade.audio) Arcade.audio.play('back');
    }
    return false;
  }
  function scoreCategory(key) {
    if (over) return;
    if (rolling) { fail('gs.diceluck.rollingMsg'); return; }
    var cat = null;
    for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) { cat = CATS[i]; break; }
    if (!cat) return;
    if (isUsed(key)) { fail('gs.diceluck.catUsed'); return; }
    if (rollsLeft === maxRolls()) { fail('gs.diceluck.mustRollFirst'); return; }

    var pts = scoreFor(key);
    used[key] = pts;
    hasProgress = true;
    if (mode === 'vs') aiPlayTurn();
    turn = Math.min(13, usedCount() + 1);
    var row = scrollEl.querySelector('.dl-cat[data-key="' + key + '"]');
    var big = celebrate(key, pts, row);

    if (usedCount() >= CATS.length) {
      ensureSel();
      renderDice();
      renderTotal();
      renderRollBtn();
      renderCategories();
      renderAI();
      finish();
      return;
    }

    hold = [false, false, false, false, false];
    rollsLeft = maxRolls();
    ensureSel();
    renderDice();
    renderTotal();
    renderRollBtn();
    renderCategories();
    renderAI();
    if (!big) setMsg('gs.diceluck.newTurn');
    writeSave();
  }
  function moveSel(step) {
    var avail = availableCats();
    if (!avail.length) return;
    var cur = -1;
    for (var i = 0; i < avail.length; i++) if (avail[i].key === selKey) { cur = i; break; }
    var next = (cur + step + avail.length) % avail.length;
    selKey = avail[next].key;
    Array.prototype.forEach.call(scrollEl.querySelectorAll('.dl-cat'), function (b) {
      b.classList.toggle('sel', b.getAttribute('data-key') === selKey);
    });
    var target = scrollEl.querySelector('.dl-cat.sel');
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
    if (window.Arcade && Arcade.audio) Arcade.audio.play('move');
  }

  /* ---------- 结算 ---------- */
  function finish() {
    if (over) return;
    over = true;
    rolling = false;
    clearTimers();
    var final = finalTotal();
    var raw = rawTotal();
    var isNew = false;
    var title = T('gs.diceluck.endTitle');
    var aiFinal = null;
    if (mode === 'vs') {
      aiFinal = totalFor(aiUsed);
      submitted = true;
      isNew = !!(window.Arcade && Arcade.storage && Arcade.storage.submitBest && Arcade.storage.submitBest('diceluck_vs', final));
      title = final > aiFinal ? T('gs.diceluck.vsWin') : (final === aiFinal ? T('gs.diceluck.vsDraw') : T('gs.diceluck.vsLose'));
    } else if (mode === 'daily') {
      submitted = true;
      if (daily) {
        var oldBest = daily.best;
        daily.plays += 1;
        if (final > daily.best) daily.best = final;
        saveDaily();
        isNew = final > oldBest;
      }
      title = T('gs.diceluck.dailyEnd');
    } else if (!submitted) {
      submitted = true;
      if (window.Arcade && Arcade.shell && Arcade.shell.submitScore) {
        try { isNew = !!Arcade.shell.submitScore(final); } catch (e) { isNew = false; }
      } else if (window.Arcade && Arcade.audio) {
        Arcade.audio.play('win');
      }
    }
    var bv = bestValue();
    clearSave();
    renderDice();
    renderTotal();
    renderRollBtn();
    renderCategories();
    renderDiff();
    renderAI();
    setMsg('gs.diceluck.gameOver', { n: final }, 'var(--neon-green)');

    var html = '';
    CATS.forEach(function (c) {
      html += '<div class="dl-bd-row"><span>' + T('gs.diceluck.cat.' + c.key) + '</span><b>' +
        (isUsed(c.key) ? used[c.key] : 0) + '</b></div>';
    });
    html += '<div class="dl-bd-row bonus"><span>' + T('gs.diceluck.topBonus') + '</span><b>+' + topBonus() + '</b></div>';
    if (mult() !== 1) {
      html += '<div class="dl-bd-row bonus"><span>' + tr('gs.diceluck.diffBonus', { n: mult() }) + '</span><b>+' +
        (final - raw) + '</b></div>';
    }
    html += '<div class="dl-bd-row"><span>' + T('gs.diceluck.modeLabel') + '</span><b>' +
      (mode === 'daily' ? T('gs.diceluck.modeDaily') : (mode === 'vs' ? T('gs.diceluck.modeVs') : T('gs.diceluck.modeSolo'))) + '</b></div>';
    var card = findCard(cardId);
    if (card) html += '<div class="dl-bd-row"><span>' + T('gs.diceluck.cardLabel') + '</span><b>' + card.t + '</b></div>';
    if (mode === 'vs') {
      html += '<div class="dl-bd-row bonus"><span>' + T('gs.diceluck.aiScore') + '</span><b>' + aiFinal + '</b></div>';
      html += '<div class="dl-bd-row"><span>' + T('gs.diceluck.vsResult') + '</span><b>' +
        (final > aiFinal ? T('gs.diceluck.vsWinTag') : (final === aiFinal ? T('gs.diceluck.vsDrawTag') : T('gs.diceluck.vsLoseTag'))) + '</b></div>';
    }
    if (mode === 'daily' && daily) {
      html += '<div class="dl-bd-row bonus"><span>' + T('gs.diceluck.dailyBestLabel') + '</span><b>' + daily.best + '</b></div>';
      html += '<div class="dl-bd-row"><span>' + T('gs.diceluck.dailyDateLabel') + '</span><b>' + daily.date + '</b></div>';
    }
    endTitleEl.textContent = title;
    endLabelEl.textContent = T('gs.diceluck.endTotal');
    endScoreEl.textContent = String(final);
    endTagEl.textContent = isNew ? T('gs.diceluck.endRecord') : '';
    endTagEl.className = 'dl-end-tag' + (isNew ? ' record' : '');
    endBreakEl.innerHTML = html;
    endBestEl.textContent = T('gs.diceluck.bestLabel') + ' ' + (bv === null ? '----' : bv);
    endPlayBtn.textContent = T('gs.diceluck.playAgain');
    endOverlay.hidden = false;
    try { endPlayBtn.focus(); } catch (e) {}

    if (window.Arcade && Arcade.audio) Arcade.audio.play('win');
    if (window.Arcade && Arcade.fx) {
      Arcade.fx.flash('var(--neon-yellow)');
      Arcade.fx.centerBurst('var(--neon-yellow)', 46);
    }
  }
  function modeStartMsg() {
    if (mode === 'daily') setMsg('gs.diceluck.dailyStartMsg');
    else if (mode === 'vs') setMsg('gs.diceluck.vsStartMsg');
    else setMsg('gs.diceluck.msgStart');
  }
  function selectCard(id) {
    if (mode === 'daily') { fail('gs.diceluck.dailyCardFixed'); return; }
    if (hasProgress || rolling || over) return;
    var ok = false;
    for (var i = 0; i < cardsShown.length; i++) if (cardsShown[i].id === id) ok = true;
    if (!ok) return;
    cardId = id;
    if (cardId === 'fixedSix') dice[0] = 6;
    rollsLeft = maxRolls();
    renderAll();
    setMsg('gs.diceluck.cardPicked', { n: findCard(id).t });
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
  }
  function selectMode(m) {
    if (m === mode) return;
    if (hasProgress && !over) { fail('gs.diceluck.modeLocked'); return; }
    mode = m;
    if (m === 'daily') diffIdx = 1;
    doRestart();
  }
  function doRestart() {
    abortAnim();
    endOverlay.hidden = true;
    newGame();
    renderAll();
    modeStartMsg();
    clearSave();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('ui');
  }
  function selectDiff(i) {
    if (i < 0 || i >= DIFFS.length) return;
    if (mode === 'daily') { fail('gs.diceluck.dailyFixedDiff'); return; }
    if (i === diffIdx && !over) return;
    if (hasProgress && !over) { fail('gs.diceluck.diffLocked'); return; }
    diffIdx = i;
    doRestart();
  }

  /* ---------- 断点续玩 ---------- */
  function collectSave() {
    if (over || !hasProgress) return null;
    var u = {};
    CATS.forEach(function (c) { if (isUsed(c.key)) u[c.key] = used[c.key]; });
    var au = {};
    CATS.forEach(function (c) { if (Object.prototype.hasOwnProperty.call(aiUsed, c.key)) au[c.key] = aiUsed[c.key]; });
    return {
      v: 3,
      mode: mode,
      card: cardId,
      cards: cardsShown.map(function (c) { return c.id; }),
      diff: diffIdx,
      dice: dice.slice(),
      hold: hold.slice(),
      rollsLeft: rollsLeft,
      used: u,
      turn: turn,
      total: finalTotal(),
      aiUsed: au,
      aiTotal: aiTotal,
      aiLast: aiLast ? { key: aiLast.key, pts: aiLast.pts } : null
    };
  }
  function sanitizeUsed(obj) {
    var nu = {};
    if (obj && typeof obj === 'object') {
      var validKeys = {};
      CATS.forEach(function (c) { validKeys[c.key] = true; });
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k) || !validKeys[k]) continue;
        var val = obj[k];
        if (typeof val === 'number' && isFinite(val) && val >= 0) nu[k] = Math.round(val);
      }
    }
    return nu;
  }
  function applySave(s) {
    try {
      if (!s || typeof s !== 'object') return false;
      if (!Array.isArray(s.dice) || s.dice.length !== 5) return false;
      var nd = [];
      for (var i = 0; i < 5; i++) {
        var v = s.dice[i];
        if (typeof v !== 'number' || !isFinite(v) || v < 1 || v > 6 || Math.floor(v) !== v) return false;
        nd.push(v);
      }
      var md = (s.mode === 'daily' || s.mode === 'vs') ? s.mode : 'solo';
      var d = (typeof s.diff === 'number' && isFinite(s.diff) && Math.floor(s.diff) === s.diff) ? s.diff : 1;
      if (d < 0 || d > 2) d = 1;
      if (md === 'daily') d = 1;

      var cid = null;
      if (typeof s.card === 'string' && findCard(s.card)) cid = s.card;
      var cshown = [];
      if (Array.isArray(s.cards)) {
        for (var ci = 0; ci < s.cards.length && cshown.length < 3; ci++) {
          if (typeof s.cards[ci] === 'string' && findCard(s.cards[ci]) && !cshown.some(function (x) { return x.id === s.cards[ci]; })) {
            cshown.push(findCard(s.cards[ci]));
          }
        }
      }
      if (cshown.length < 3) {
        for (var cj = 0; cj < CARDS.length && cshown.length < 3; cj++) {
          if (!cshown.some(function (x) { return x.id === CARDS[cj].id; })) cshown.push(CARDS[cj]);
        }
      }
      if (!cid) cid = cshown[0].id;

      var h = [];
      for (var j = 0; j < 5; j++) h.push(!!(Array.isArray(s.hold) && s.hold[j]));

      var nu = sanitizeUsed(s.used);
      if (Object.keys(nu).length >= CATS.length) return false;
      var au = sanitizeUsed(s.aiUsed);
      if (Object.keys(au).length >= CATS.length) return false;

      var rl = s.rollsLeft;
      var mr = cid === 'oneRoll' ? Math.min(DIFFS[d].rolls, 2) : DIFFS[d].rolls;
      if (typeof rl !== 'number' || !isFinite(rl) || Math.floor(rl) !== rl || rl < 0 || rl > mr) rl = mr;

      abortAnim();
      mode = md;
      diffIdx = d;
      cardId = cid;
      cardsShown = cshown;
      daily = loadDaily();
      dice = nd;
      hold = h;
      used = nu;
      aiUsed = au;
      aiTotal = (typeof s.aiTotal === 'number' && isFinite(s.aiTotal)) ? Math.round(s.aiTotal) : totalFor(au);
      aiLast = (s.aiLast && typeof s.aiLast === 'object' && s.aiLast.key && isFinite(s.aiLast.pts))
        ? { key: s.aiLast.key, pts: Math.round(s.aiLast.pts) } : null;
      rollsLeft = rl;
      turn = Math.min(13, Object.keys(nu).length + 1);
      over = false;
      rolling = false;
      submitted = false;
      hasProgress = true;
      ensureSel();
      endOverlay.hidden = true;
      renderAll();
      if (rollsLeft === maxRolls()) setMsg('gs.diceluck.newTurn');
      else if (rollsLeft > 0) setMsg('gs.diceluck.canRoll', { n: rollsLeft });
      else setMsg('gs.diceluck.pickNow');
      return true;
    } catch (e) { return false; }
  }

  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'diceluck',
      collect: collectSave,
      apply: applySave
    });
  }

  /* ---------- 交互绑定 ---------- */
  rollBtn.addEventListener('click', startRoll);
  restartBtn.addEventListener('click', doRestart);
  endPlayBtn.addEventListener('click', doRestart);
  diffBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      selectDiff(parseInt(b.getAttribute('data-diff'), 10));
    });
  });
  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      selectMode(b.getAttribute('data-mode'));
    });
  });

  function onKey(e) {
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.tut-overlay')) return;
    if (endOverlay && !endOverlay.hidden) return;

    var code = e.code;
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3' || code === 'Digit4' || code === 'Digit5' ||
        code === 'Numpad1' || code === 'Numpad2' || code === 'Numpad3' || code === 'Numpad4' || code === 'Numpad5') {
      e.preventDefault();
      var idx = parseInt(code.replace('Digit', '').replace('Numpad', ''), 10) - 1;
      toggleHold(idx);
      return;
    }
    if (code === 'Space') {
      e.preventDefault();
      startRoll();
      return;
    }
    if (code === 'Enter') {
      e.preventDefault();
      if (selKey) scoreCategory(selKey);
      else fail('gs.diceluck.pickCat');
      return;
    }
    if (code === 'ArrowUp' || code === 'ArrowLeft') {
      e.preventDefault();
      moveSel(-1);
    } else if (code === 'ArrowDown' || code === 'ArrowRight') {
      e.preventDefault();
      moveSel(1);
    }
  }
  document.addEventListener('keydown', onKey);

  window.GAME_RESTART = doRestart;

  /* ---------- QA 钩子（仅 ?qa=1） ---------- */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(location.search)) {
    window.__qa = {
      state: function () {
        return {
          mode: mode, diff: diffIdx, card: cardId, cards: cardsShown.map(function (c) { return c.id; }),
          dice: dice.slice(), rollsLeft: rollsLeft, used: Object.keys(used).length, total: finalTotal(),
          aiUsed: Object.keys(aiUsed).length, aiTotal: aiTotal, over: over,
          dailyDate: daily ? daily.date : null, dailyBest: daily ? daily.best : 0, dailyPlays: daily ? daily.plays : 0,
          best: bestValue()
        };
      },
      start: function (opts) {
        opts = opts || {};
        if (opts.mode) mode = opts.mode;
        if (opts.diff != null) diffIdx = opts.diff;
        if (mode === 'daily') diffIdx = 1;
        endOverlay.hidden = true;
        newGame();
        renderAll();
        modeStartMsg();
        return this.state();
      },
      forceRoll: function () {
        if (over || rolling || rollsLeft <= 0) return this.state();
        roll();
        renderDice(); renderTotal(); renderRollBtn(); renderCategories();
        return this.state();
      },
      setDice: function (arr) {
        if (!Array.isArray(arr) || arr.length !== 5) return this.state();
        dice = arr.map(function (v) { return Math.max(1, Math.min(6, Math.round(v))); });
        hold = [false, false, false, false, false];
        renderDice(); renderTotal(); renderRollBtn(); renderCategories();
        return this.state();
      },
      score: function (key) { scoreCategory(key); return this.state(); },
      finish: function () { finish(); return this.state(); },
      win: function () {
        used = {}; aiUsed = {};
        CATS.forEach(function (c) { used[c.key] = c.top ? 30 : 50; });
        hasProgress = true;
        if (mode === 'vs') { aiUsed = {}; CATS.forEach(function (c) { aiUsed[c.key] = 0; }); aiTotal = totalFor(aiUsed); }
        finish();
        return this.state();
      },
      lose: function () {
        used = {}; aiUsed = {};
        CATS.forEach(function (c) { used[c.key] = 0; });
        hasProgress = true;
        if (mode === 'vs') { aiUsed = {}; CATS.forEach(function (c) { aiUsed[c.key] = 50; }); aiTotal = totalFor(aiUsed); }
        finish();
        return this.state();
      }
    };
  }

  /* ---------- 启动 ---------- */
  buildDice();
  newGame();
  renderAll();
  modeStartMsg();
  if (window.Arcade && Arcade.savegame && Arcade.savegame.resume()) {
    renderAll();
  }
})();
