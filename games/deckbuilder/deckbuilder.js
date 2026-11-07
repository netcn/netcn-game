/* 卡牌构筑 Deck Builder —— 旗舰版：三选一奖励 / 多意图 AI / 分层地图 / Canvas 立绘 */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.deckbuilder.tut1t'), d: T('gs.deckbuilder.tut1') },
  { t: T('gs.deckbuilder.tut2t'), d: T('gs.deckbuilder.tut2') },
  { t: T('gs.deckbuilder.tut3t'), d: T('gs.deckbuilder.tut3') },
  { t: T('gs.deckbuilder.tut4t'), d: T('gs.deckbuilder.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  function t(k) { return T('gs.deckbuilder.' + k); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rnd(arr.length)]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function audio(n) { if (window.Arcade && Arcade.audio) Arcade.audio.play(n); }
  function toast(m, type) { if (window.Arcade && Arcade.ui) Arcade.ui.toast(m, type || 'ok'); }

  /* ================= 卡牌 / 敌人 / 地图数据 ================= */
  /* ==DECK-CORE-START== 纯数据与纯函数区（供审阅/测试） */
  var CARDS = {
    /* ---- common 21 ---- */
    strike:    { cost: 1, type: 'atk', rarity: 'common',   dmg: 6 },
    defend:    { cost: 1, type: 'def', rarity: 'common',   block: 5 },
    bash:      { cost: 2, type: 'atk', rarity: 'common',   dmg: 8, vuln: 2 },
    quick:     { cost: 0, type: 'atk', rarity: 'common',   dmg: 3, draw: 1, ex: true },
    guard:     { cost: 1, type: 'def', rarity: 'common',   block: 8 },
    double:    { cost: 2, type: 'atk', rarity: 'common',   dmg: 12 },
    heal:      { cost: 1, type: 'sp',  rarity: 'common',   heal: 8 },
    jab:       { cost: 0, type: 'atk', rarity: 'common',   dmg: 4 },
    slash:     { cost: 1, type: 'atk', rarity: 'common',   dmg: 7 },
    brace:     { cost: 1, type: 'def', rarity: 'common',   block: 7 },
    feint:     { cost: 1, type: 'atk', rarity: 'common',   dmg: 5, draw: 1 },
    mend:      { cost: 1, type: 'sp',  rarity: 'common',   heal: 6 },
    stone:     { cost: 1, type: 'atk', rarity: 'common',   dmg: 9, ex: true },
    ward:      { cost: 1, type: 'def', rarity: 'common',   block: 5, heal: 2 },
    hex:       { cost: 1, type: 'sp',  rarity: 'common',   poison: 4 },
    taunt:     { cost: 1, type: 'sp',  rarity: 'common',   weak: 2 },
    cleave:    { cost: 2, type: 'atk', rarity: 'common',   dmg: 10 },
    recover:   { cost: 1, type: 'sp',  rarity: 'common',   heal: 5, block: 3 },
    sprint:    { cost: 0, type: 'sp',  rarity: 'common',   draw: 1, ex: true },
    poke:      { cost: 0, type: 'atk', rarity: 'common',   dmg: 3 },
    spark:     { cost: 1, type: 'atk', rarity: 'common',   dmg: 6, weak: 1 },
    /* ---- uncommon 23 ---- */
    shield:    { cost: 2, type: 'def', rarity: 'uncommon', block: 12 },
    poison:    { cost: 2, type: 'sp',  rarity: 'uncommon', poison: 6 },
    energy:    { cost: 0, type: 'sp',  rarity: 'uncommon', energy: 2, ex: true },
    focus:     { cost: 1, type: 'sp',  rarity: 'uncommon', draw: 2 },
    rage:      { cost: 1, type: 'sp',  rarity: 'uncommon', str: 3 },
    frost:     { cost: 1, type: 'def', rarity: 'uncommon', block: 7, draw: 1 },
    twin:      { cost: 1, type: 'atk', rarity: 'uncommon', dmg: 4, hits: 2 },
    surge:     { cost: 1, type: 'sp',  rarity: 'uncommon', energy: 1, draw: 1 },
    uppercut:  { cost: 2, type: 'atk', rarity: 'uncommon', dmg: 11, vuln: 1 },
    whirling:  { cost: 2, type: 'atk', rarity: 'uncommon', dmg: 5, hits: 3 },
    bulwark:   { cost: 2, type: 'def', rarity: 'uncommon', block: 14 },
    toxin:     { cost: 1, type: 'sp',  rarity: 'uncommon', poison: 5 },
    adrenaline:{ cost: 0, type: 'sp',  rarity: 'uncommon', energy: 1, draw: 1, ex: true },
    empower:   { cost: 1, type: 'sp',  rarity: 'uncommon', str: 2 },
    meditate:  { cost: 1, type: 'sp',  rarity: 'uncommon', draw: 3, ex: true },
    shiv:      { cost: 0, type: 'atk', rarity: 'uncommon', dmg: 4, ex: true },
    metalize:  { cost: 1, type: 'def', rarity: 'uncommon', block: 9 },
    frostbite: { cost: 1, type: 'atk', rarity: 'uncommon', dmg: 6, weak: 2 },
    leech:     { cost: 2, type: 'atk', rarity: 'uncommon', dmg: 9, heal: 6 },
    prepare:   { cost: 1, type: 'sp',  rarity: 'uncommon', block: 4, draw: 2 },
    dusk:      { cost: 2, type: 'sp',  rarity: 'uncommon', poison: 8 },
    quake:     { cost: 2, type: 'atk', rarity: 'uncommon', dmg: 14, weak: 1 },
    sap:       { cost: 1, type: 'sp',  rarity: 'uncommon', sap: 2 },
    /* ---- rare 22 ---- */
    fireball:  { cost: 2, type: 'atk', rarity: 'rare',     dmg: 18 },
    barrier:   { cost: 2, type: 'def', rarity: 'rare',     block: 16 },
    vamp:      { cost: 2, type: 'atk', rarity: 'rare',     dmg: 10, heal: 5 },
    lightning: { cost: 3, type: 'atk', rarity: 'rare',     dmg: 26 },
    execution: { cost: 3, type: 'atk', rarity: 'rare',     dmg: 32 },
    regen:     { cost: 2, type: 'sp',  rarity: 'rare',     heal: 12, block: 6 },
    bomb:      { cost: 2, type: 'sp',  rarity: 'rare',     poison: 10 },
    siphon:    { cost: 2, type: 'atk', rarity: 'rare',     dmg: 8, heal: 4, draw: 1 },
    meteor:    { cost: 3, type: 'atk', rarity: 'rare',     dmg: 30 },
    fortress:  { cost: 3, type: 'def', rarity: 'rare',     block: 24 },
    immortal:  { cost: 2, type: 'sp',  rarity: 'rare',     heal: 20 },
    annihilation:{ cost: 3, type: 'atk', rarity: 'rare',  dmg: 12, hits: 3 },
    plague:    { cost: 3, type: 'sp',  rarity: 'rare',     poison: 18 },
    apex:      { cost: 2, type: 'sp',  rarity: 'rare',     str: 4 },
    overflow:  { cost: 0, type: 'sp',  rarity: 'rare',     energy: 3, ex: true },
    phoenix:   { cost: 2, type: 'sp',  rarity: 'rare',     heal: 14, block: 10 },
    voidstrike:{ cost: 2, type: 'atk', rarity: 'rare',     dmg: 16, draw: 2 },
    bloodbath: { cost: 2, type: 'atk', rarity: 'rare',     dmg: 14, heal: 7 },
    thunder:   { cost: 2, type: 'atk', rarity: 'rare',     dmg: 8, hits: 2, weak: 1 },
    genesis:   { cost: 3, type: 'sp',  rarity: 'rare',     heal: 10, str: 3 },
    judgement: { cost: 3, type: 'atk', rarity: 'rare',     dmg: 24, vuln: 3 },
    echostrike:{ cost: 1, type: 'atk', rarity: 'rare',     dmg: 5, hits: 4 },
    /* ---- 术士专属 12 张 ---- */
    shadowbolt:{ cost: 1, type: 'atk', rarity: 'common',   cls: 'warlock', dmg: 5, poison: 2 },
    wardspell: { cost: 1, type: 'def', rarity: 'common',   cls: 'warlock', block: 6 },
    drainlife: { cost: 1, type: 'sp',  rarity: 'common',   cls: 'warlock', poison: 3, heal: 2 },
    darkember: { cost: 0, type: 'atk', rarity: 'common',   cls: 'warlock', dmg: 3 },
    veil:      { cost: 1, type: 'def', rarity: 'common',   cls: 'warlock', block: 5, draw: 1 },
    hexbolt:   { cost: 1, type: 'atk', rarity: 'common',   cls: 'warlock', dmg: 4, weak: 1 },
    wither:    { cost: 2, type: 'sp',  rarity: 'uncommon', cls: 'warlock', poison: 7 },
    soulflare: { cost: 1, type: 'atk', rarity: 'uncommon', cls: 'warlock', dmg: 7, vuln: 1 },
    bloodrite: { cost: 0, type: 'sp',  rarity: 'uncommon', cls: 'warlock', energy: 1, draw: 1, ex: true },
    netherguard:{ cost: 2, type: 'def', rarity: 'uncommon',cls: 'warlock', block: 13 },
    doom:      { cost: 3, type: 'sp',  rarity: 'rare',     cls: 'warlock', poison: 12 },
    oblivion:  { cost: 3, type: 'atk', rarity: 'rare',     cls: 'warlock', dmg: 22, heal: 6 },
    /* ---- 诅咒牌（不进入商店/奖励池） ---- */
    wound:     { cost: 2, type: 'sp',  rarity: 'common',   cls: 'curse', unplayable: true }
  };
  var COMMON_POOL = [], UNCOMMON_POOL = [], RARE_POOL = [];
  var WL_COMMON = [], WL_UNCOMMON = [], WL_RARE = [];
  for (var ck in CARDS) {
    var ccls = CARDS[ck].cls || 'warrior';
    if (ccls === 'warlock') {
      if (CARDS[ck].rarity === 'common') WL_COMMON.push(ck);
      else if (CARDS[ck].rarity === 'uncommon') WL_UNCOMMON.push(ck);
      else WL_RARE.push(ck);
    } else if (ccls === 'warrior') {
      if (CARDS[ck].rarity === 'common') COMMON_POOL.push(ck);
      else if (CARDS[ck].rarity === 'uncommon') UNCOMMON_POOL.push(ck);
      else RARE_POOL.push(ck);
    }
  }
  var CLASS_POOLS = {
    warrior: { common: COMMON_POOL, uncommon: UNCOMMON_POOL, rare: RARE_POOL },
    warlock: { common: WL_COMMON, uncommon: WL_UNCOMMON, rare: WL_RARE }
  };
  function classPools(cls) {
    return CLASS_POOLS[cls === 'warlock' ? 'warlock' : 'warrior'] || CLASS_POOLS.warrior;
  }
  function classCardPool(cls, rarity) {
    var p = classPools(cls);
    return p[rarity] && p[rarity].length ? p[rarity] : (p.common.length ? p.common : COMMON_POOL);
  }
  var WARLOCK_START_DECK = [
    'shadowbolt', 'shadowbolt', 'shadowbolt', 'shadowbolt',
    'wardspell', 'wardspell', 'wardspell',
    'drainlife', 'veil', 'darkember'
  ];

  var DIFF = [
    { key: 'easy',   hp: 90, energy: 4, enemyHp: 0.82, enemyDmg: 0.82, gold: 30,
      deck: ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'double', 'heal'] },
    { key: 'normal', hp: 90, energy: 3, enemyHp: 1, enemyDmg: 1, gold: 20,
      hpAct: [1, 1.28, 1.50], bossHpAct: [1, 0.88, 0.85], dmgAct: [1, 1.05, 1.20],
      postHeal: 10, restPct: 0.40, bossHeal: 20, act3Gold: 20,
      deck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'double', 'heal'] },
    { key: 'hard',   hp: 68, energy: 3, enemyHp: 1.28, enemyDmg: 1.22, gold: 10,
      deck: ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'double', 'heal', 'bash'] }
  ];

  var ENEMIES = {
    slime:   { hp: 26, dmg: 5, art: 'slime',   weights: { attack: 3, defend: 1, buff: 0.8, debuff: 1.1, multi: 0.6, charge: 0.6 } },
    crawler: { hp: 30, dmg: 6, art: 'crawler', weights: { attack: 2.6, defend: 0.8, buff: 0.7, debuff: 1, multi: 1.4, charge: 0.5 } },
    spider:  { hp: 34, dmg: 6, art: 'spider',  weights: { attack: 2.2, defend: 0.6, buff: 0.6, debuff: 2, multi: 1.1, charge: 0.5 } },
    guard:   { hp: 44, dmg: 8, art: 'guard',  elite: true, weights: { attack: 3, defend: 1.8, buff: 1.2, debuff: 0.8, multi: 1, charge: 0.8 } },
    warden:  { hp: 56, dmg: 9, art: 'warden', elite: true, weights: { attack: 2.8, defend: 1.4, buff: 1.5, debuff: 1.4, multi: 1.5, charge: 1 } }
  };
  var BOSSES = [
    { key: 'boss1', hp: 62,  dmg: 8,  art: 'boss1' },
    { key: 'boss2', hp: 96,  dmg: 11, art: 'boss2' },
    { key: 'boss3', hp: 132, dmg: 14, art: 'boss3' }
  ];

  /* 三幕分支地图：每幕独立节点行，幕末 Boss；第三幕 Boss 即整局终局 */
  var ACTS = [
    {
      key: 'act1', bossIdx: 0,
      rows: [
        [ { type: 'battle', enemy: 'slime' }, { type: 'event' }, { type: 'elite', enemy: 'guard' } ],
        [ { type: 'battle', enemy: 'crawler' }, { type: 'rest' } ],
        [ { type: 'shop' }, { type: 'battle', enemy: 'spider' }, { type: 'chest' }, { type: 'event' } ]
      ]
    },
    {
      key: 'act2', bossIdx: 1,
      rows: [
        [ { type: 'battle', enemy: 'crawler' }, { type: 'event' }, { type: 'elite', enemy: 'guard' } ],
        [ { type: 'shop' }, { type: 'rest' }, { type: 'event' } ],
        [ { type: 'elite', enemy: 'warden' }, { type: 'battle', enemy: 'spider' }, { type: 'chest' } ]
      ]
    },
    {
      key: 'act3', bossIdx: 2,
      rows: [
        [ { type: 'battle', enemy: 'spider' }, { type: 'event' }, { type: 'elite', enemy: 'warden' } ],
        [ { type: 'rest' }, { type: 'shop' }, { type: 'chest' }, { type: 'event' } ],
        [ { type: 'elite', enemy: 'guard' }, { type: 'battle', enemy: 'crawler' } ]
      ]
    }
  ];
  function actDef(a) { return ACTS[clamp(Number(a) || 1, 1, ACTS.length) - 1]; }
  function actRows(a) { return actDef(a).rows; }
  function restHealRatio() { var d = (S && DIFF[S.diff]) || DIFF[1]; return d.restPct || 0.3; }

  var RELICS = {
    blood:  { name: 'blood' },
    blade:  { name: 'blade' },
    thorn:  { name: 'thorn' },
    energy: { name: 'energy' },
    shield: { name: 'shield' },
    toxin:  { name: 'toxin' }
  };
  var RELIC_LIST = Object.keys(RELICS);

  /* 随机事件：节点只记录事件 key，选项效果在这里声明（可序列化，不含函数） */
  var EVENTS = [
    { id: 'shrine', opts: [
      { eff: { heal: 12 } },
      { eff: { loseHp: 6, gold: 70 } },
      { eff: { card: 'rare' } }
    ] },
    { id: 'merchant', opts: [
      { eff: { goldCost: 40, maxHp: 5, heal: 5 } },
      { eff: { goldCost: 65, relic: true } },
      { eff: { gold: 8 } }
    ] },
    { id: 'tome', opts: [
      { eff: { loseHp: 8, card: 'rare' } },
      { eff: { remove: true, heal: 5 } },
      { eff: { relic: true, wound: true } }
    ] },
    { id: 'altar', opts: [
      { eff: { loseHp: 10, gold: 100 } },
      { eff: { maxHp: -5, card: 'rare' } },
      { eff: { gold: 5 } }
    ] },
    { id: 'cache', opts: [
      { eff: { gold: 30, wound: true } },
      { eff: { relic: true } },
      { eff: { gold: 10 } }
    ] },
    { id: 'pond', opts: [
      { eff: { copy: true } },
      { eff: { remove: true, heal: 5 } },
      { eff: { gold: 8 } }
    ] }
  ];
  var EVENT_BY_KEY = {};
  EVENTS.forEach(function (ev) { EVENT_BY_KEY[ev.id] = ev; });

  /* 可序列化 seed → 事件选择（刷新后同幕同层得到同一事件） */
  function eventHash(n) {
    n = Math.abs(Number(n) || 1);
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = n * 0x27d4eb2d;
    n = n ^ (n >>> 15);
    return Math.abs(n);
  }
  function nextEventKey(seed, act, floor) {
    var h = eventHash((Number(seed) || 1) + Number(act || 1) * 131 + Number(floor || 0) * 37);
    return EVENTS[h % EVENTS.length].id;
  }

  var PILE_LIMIT = 10;

  /* ==DECK-CORE-END== */

  /* ================= 状态 ================= */
  var S = null;              // 当前整局状态（可序列化）
  var locked = false;        // 出牌/敌人行动动画锁
  var sel = -1;              // 选中手牌索引
  var floats = [];           // 飘字（运行时）
  var parts = [];            // 局部粒子（运行时）
  var hitFlash = 0;          // 敌人受击闪白
  var shakeT = 0;            // 舞台抖动
  var timers = [];           // 本局定时器（重开清理）
  var loopApi = null;
  var pickedDiff = 1;
  var pickedClass = 'warrior';
  var started = false;

  function delay(fn, ms) {
    var id = setTimeout(function () {
      var i = timers.indexOf(id);
      if (i >= 0) timers.splice(i, 1);
      fn();
    }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
    var flies = document.querySelectorAll('.dk-fly');
    for (var j = 0; j < flies.length; j++) {
      if (flies[j].parentNode) flies[j].parentNode.removeChild(flies[j]);
    }
  }

  /* ================= 存档（沿用 id: deckbuilder） ================= */
  function writeSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
  }
  function clearSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.clear();
  }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'deckbuilder',
      collect: function () {
        if (!S || S.phase === 'win' || S.phase === 'lose') return null;
        return S;
      },
      apply: function (s) {
        if (!s || typeof s !== 'object' || !Array.isArray(s.deck) || !Array.isArray(s.hand) ||
            !Array.isArray(s.draw) || !Array.isArray(s.discard) || typeof s.hp !== 'number') {
          return false;
        }
        var okPhase = ['map', 'fight', 'reward', 'rest', 'chest', 'shop', 'event', 'win', 'lose'];
        if (okPhase.indexOf(s.phase) < 0) return false;
        if (s.phase === 'fight' && (!s.enemy || typeof s.enemy.hp !== 'number' || !s.enemy.intent)) return false;
        if (s.phase === 'shop' && (!s.shop || !Array.isArray(s.shop.cards))) return false;
        if (s.phase === 'event' && (!s.event || typeof s.event.key !== 'string')) return false;
        S = normalize(s);
        pickedDiff = S.diff;
        pickedClass = S.cls;
        started = true;
        sel = -1; locked = false; floats = []; parts = []; hitFlash = 0; shakeT = 0;
        showGame();
        syncUI();
        if (S.phase === 'fight' && S.enemy && S.enemy.hp <= 0) {
          locked = true;
          delay(resolveVictory, 400);
        }
        return true;
      }
    });
  }

  function normalize(s) {
    var base = {
      v: 4, diff: 0, cls: 'warrior', seed: 0, phase: 'map', act: 1, actFloor: 0, hp: 80, maxHp: 80, gold: 0, floor: 0,
      deck: [], draw: [], discard: [], exhaust: [], hand: [],
      energy: 3, maxEnergy: 3, block: 0,
      poison: 0, strength: 0, vuln: 0, weak: 0,
      relics: [], node: null, enemy: null, event: null, turn: 1,
      eliteWins: 0, reward: null, rest: null, shop: null, log: '', msg: '', submitted: false
    };
    var out = {};
    for (var k in base) out[k] = (s[k] !== undefined && s[k] !== null) ? s[k] : base[k];
    out.v = 4;
    out.diff = clamp(Number(out.diff) || 0, 0, 2);
    out.cls = out.cls === 'warlock' ? 'warlock' : 'warrior';
    out.hp = Number(out.hp) || 1;
    out.maxHp = Number(out.maxHp) || out.hp;
    /* 旧存档兼容：没有 act 字段时按第一幕、floor 映射到幕内行 */
    out.act = clamp(Number(out.act) || 1, 1, ACTS.length);
    out.actFloor = clamp(Number(out.actFloor) || 0, 0, actRows(out.act).length);
    out.floor = (out.act - 1) * 3 + out.actFloor;
    out.phase = out.phase || 'map';
    out.deck = Array.isArray(out.deck) ? out.deck.filter(function (x) { return !!CARDS[x]; }) : [];
    out.hand = Array.isArray(out.hand) ? out.hand : [];
    out.draw = Array.isArray(out.draw) ? out.draw : [];
    out.discard = Array.isArray(out.discard) ? out.discard : [];
    out.exhaust = Array.isArray(out.exhaust) ? out.exhaust : [];
    out.relics = Array.isArray(out.relics) ? out.relics : [];
    out.shop = out.shop && typeof out.shop === 'object' ? out.shop : null;
    out.event = out.event && typeof out.event === 'object' && EVENT_BY_KEY[out.event.key]
      ? { key: out.event.key } : null;
    if (out.phase === 'event' && !out.event) {
      out.seed = Number(out.seed) || 1;
      out.event = { key: nextEventKey(out.seed, out.act, out.actFloor) };
    }
    if (!Number(out.seed)) out.seed = Math.floor(Math.random() * 1000000) + 1;
    if (out.enemy && typeof out.enemy === 'object') {
      var en = out.enemy;
      en.weak = Number(en.weak) || 0;
      en.vuln = Number(en.vuln) || 0;
      en.strength = Number(en.strength) || 0;
      en.block = Number(en.block) || 0;
      en.turn = Number(en.turn) || 0;
      en.step = Number(en.step) || 0;
      en.bossIdx = Number(en.bossIdx);
      if (isNaN(en.bossIdx)) en.bossIdx = en.boss ? Math.max(0, actDef(out.act).bossIdx) : -1;
    }
    return out;
  }

  function makeRun(diffIdx, cls) {
    var d = DIFF[diffIdx] || DIFF[1];
    cls = cls === 'warlock' ? 'warlock' : 'warrior';
    var startDeck = cls === 'warlock' ? WARLOCK_START_DECK.slice() : d.deck.slice();
    return {
      v: 4,
      diff: diffIdx, cls: cls, seed: Math.floor(Math.random() * 1000000) + 1,
      phase: 'map', act: 1, actFloor: 0, hp: d.hp, maxHp: d.hp, gold: d.gold, floor: 0,
      deck: startDeck, draw: [], discard: [], exhaust: [], hand: [],
      energy: d.energy, maxEnergy: d.energy, block: 0,
      poison: 0, strength: 0, vuln: 0, weak: 0,
      relics: [], node: null, enemy: null, event: null, turn: 1,
      eliteWins: 0, reward: null, rest: null, shop: null, log: '', msg: '', submitted: false
    };
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(i + 1);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function cardSpec(key) { return CARDS[key]; }
  function cardName(key) { return T('gs.deckbuilder.card.' + key + '.n'); }
  function cardDesc(key) { return T('gs.deckbuilder.card.' + key + '.d'); }
  function deckFull() { return S.deck.length; }
  function hasRelic(k) { return S.relics.indexOf(k) >= 0; }
  function baseEnergy() {
    var d = DIFF[S.diff] || DIFF[1];
    return d.energy + (hasRelic('energy') ? 1 : 0);
  }

  /* 敌人/玩家伤害换算（纯函数） */
  function playerAttackValue(spec) {
    var base = (spec.dmg || 0) + S.strength + (hasRelic('blade') && spec.type === 'atk' ? 2 : 0);
    var v = S.weak > 0 ? Math.round(base * 0.75) : base;
    return Math.max(0, v);
  }
  function bossIdxNow() { return actDef(S ? S.act : 1).bossIdx; }
  function enemyAttackValue(e, raw) {
    var d = DIFF[S.diff] || DIFF[1];
    var act = S.act || 1, af = S.actFloor || 0;
    var actDmg = d.dmgAct ? (d.dmgAct[Math.min(act, 3) - 1] || 1) : (1 + (act - 1) * 0.30);
    var v = Math.round(raw * d.enemyDmg * (actDmg + af * 0.05));
    v += e.strength || 0;
    if (e.weak > 0) v = Math.round(v * 0.75);
    if (e.phase > 0) v = Math.round(v * 1.2);
    return Math.max(0, v);
  }

  /* 奖励卡池按职业/稀有度/来源加权 */
  function rollRewardCards(elite) {
    var weights = elite ? [0.28, 0.44, 0.28] : [0.62, 0.30, 0.08];
    var pools = classPools(S ? S.cls : 'warrior');
    var out = [], guard = 0;
    while (out.length < 3 && guard++ < 60) {
      var r = Math.random(), key;
      if (r < weights[0]) key = pick(pools.common);
      else if (r < weights[0] + weights[1]) key = pick(pools.uncommon);
      else key = pick(pools.rare);
      if (out.indexOf(key) < 0) out.push(key);
    }
    if (out.length < 3) {
      var all = pools.common.concat(pools.uncommon);
      while (out.length < 3) {
        var k2 = pick(all);
        if (out.indexOf(k2) < 0) out.push(k2);
      }
    }
    return out;
  }

  /* ================= 敌人 / 意图 ================= */
  function makeEnemy(node) {
    var isBoss = node.type === 'boss';
    var bi = Math.max(0, bossIdxNow());
    var def = isBoss ? BOSSES[bi] : ENEMIES[node.enemy];
    if (!def) def = ENEMIES.slime;
    var d = DIFF[S.diff] || DIFF[1];
    var act = S.act || 1, af = S.actFloor || 0;
    var scale = isBoss
      ? d.enemyHp * (d.bossHpAct ? (d.bossHpAct[Math.min(act, 3) - 1] || 1) : (1 + (act - 1) * 0.12))
      : d.enemyHp * ((d.hpAct ? (d.hpAct[Math.min(act, 3) - 1] || 1) : (1 + (act - 1) * 0.42)) + af * 0.06);
    var hp = Math.round(def.hp * scale);
    var e = {
      key: def.key || node.enemy || 'slime',
      nameKey: isBoss ? def.key : node.enemy,
      art: def.art,
      hp: hp, maxHp: hp, block: 0, strength: 0, vuln: 0, weak: 0,
      charge: false, phase: 0, boss: isBoss, elite: !!def.elite,
      baseDmg: def.dmg, intent: null, turn: 0, step: 0, bossIdx: isBoss ? bi : -1,
      weights: def.weights || { attack: 3, defend: 1, buff: 1, debuff: 1, multi: 1, charge: 0.6 }
    };
    e.intent = e.boss ? bossIntent(e) : rollIntent(e);
    return e;
  }

  function intentWeights(e) {
    var w = {};
    var base = e.weights || { attack: 3, defend: 1, buff: 1, debuff: 1, multi: 1, charge: 0.6 };
    for (var k in base) w[k] = base[k];
    if (e.vuln > 0) w.debuff = (w.debuff || 0) + 0.8;
    if (e.hp < e.maxHp * 0.4) { w.defend = (w.defend || 0) * 0.5; w.buff = (w.buff || 0) + 0.8; }
    if (e.charge) { w.attack = (w.attack || 0) + 2.5; w.multi = (w.multi || 0) + 2; }
    return w;
  }

  /* 单次意图数值（普怪与 Boss 共用） */
  function intentValue(e, type) {
    var out = { type: type, value: 0, hits: 1, charged: false };
    var d = DIFF[S.diff] || DIFF[1];
    var raw = e.baseDmg;
    if (type === 'attack') {
      out.value = enemyAttackValue(e, raw);
    } else if (type === 'multi') {
      out.hits = e.boss && e.phase > 0 ? 3 : 2;
      out.value = Math.max(1, enemyAttackValue(e, Math.round(raw * 0.66)));
    } else if (type === 'defend') {
      out.value = Math.round((5 + (S.actFloor || 0) * 2 + (S.act - 1) * 4) * d.enemyHp);
    } else if (type === 'buff') {
      out.value = e.boss && e.phase > 0 ? 3 : 2;
    } else if (type === 'debuff') {
      out.value = e.boss && e.phase > 0 ? 3 : 2;
    }
    return out;
  }

  /** 普通敌人：沿用原有权重 */
  function rollIntent(e) {
    var w = intentWeights(e), total = 0;
    for (var k in w) total += Math.max(0, w[k]);
    var r = Math.random() * (total || 1), acc = 0, type = 'attack';
    for (var k2 in w) {
      acc += Math.max(0, w[k2]);
      if (r <= acc) { type = k2; break; }
    }
    var intent = intentValue(e, type);
    if (e.charge && (type === 'attack' || type === 'multi')) {
      intent.value *= 2; intent.charged = true;
    }
    return intent;
  }

  /* Boss 意图循环：按回合 + 血量阶段轮换 attack/defend/buff/debuff/multi/charge */
  var BOSS_CYCLES = [
    ['attack', 'defend', 'buff', 'multi', 'debuff', 'charge'],
    ['attack', 'debuff', 'multi', 'defend', 'charge', 'attack', 'buff'],
    ['attack', 'buff', 'multi', 'charge', 'debuff', 'defend']
  ];
  function bossIntent(e) {
    /* 蓄力后的下一击：大伤害 */
    if (e.charge) {
      var big = intentValue(e, 'attack');
      big.value = Math.round(big.value * 1.8) + Math.round(e.baseDmg * 0.6);
      big.charged = true;
      return big;
    }
    var seq = BOSS_CYCLES[(e.bossIdx || 0) % BOSS_CYCLES.length];
    var idx = (e.step !== undefined ? e.step : (e.turn || 0)) % seq.length;
    var type = seq[idx];
    /* 血量过半进入第二阶段：更频繁的进攻 */
    if (e.phase > 0 && idx % 3 === 0 && type !== 'attack' && type !== 'multi' && type !== 'charge') {
      type = (idx % 2 === 0) ? 'multi' : 'attack';
    }
    if (e.phase > 0 && e.hp < e.maxHp * 0.3 && type !== 'attack' && type !== 'multi') type = 'attack';
    var it = intentValue(e, type);
    if (type === 'charge') it.value = 0;
    return it;
  }

  function intentText(e) {
    var it = e.intent;
    if (!it) return '';
    var lbl = T('gs.deckbuilder.intent.' + it.type);
    if (it.type === 'attack') return (it.charged ? T('gs.deckbuilder.intent.chargedAttack') : lbl) + ' ' + it.value;
    if (it.type === 'multi') return lbl + ' ' + it.value + ' ×' + it.hits + (it.charged ? ' ' + T('gs.deckbuilder.charged') : '');
    if (it.type === 'defend') return lbl + ' +' + it.value;
    if (it.type === 'buff') return lbl + ' +' + it.value;
    if (it.type === 'debuff') return lbl + ' +' + it.value;
    return lbl;
  }

  /* ================= 战斗流程 ================= */
  function newRun(diffIdx, cls) {
    clearTimers();
    locked = false; sel = -1; floats = []; parts = []; hitFlash = 0; shakeT = 0;
    clearSave();
    S = makeRun(diffIdx, cls);
    pickedDiff = diffIdx;
    pickedClass = S.cls;
    started = true;
    showGame();
    closeOverlays();
    syncUI();
    writeSave();
  }

  function chooseNode(rowIdx, nodeIdx) {
    if (!S || S.phase !== 'map' || rowIdx !== S.actFloor) return;
    var rows = actRows(S.act);
    var node = rows[rowIdx] && rows[rowIdx][nodeIdx];
    if (!node) return;
    startNode({ type: node.type, enemy: node.enemy, row: rowIdx, act: S.act });
  }

  function chooseBoss() {
    if (!S || S.phase !== 'map' || S.actFloor < actRows(S.act).length) return;
    startNode({ type: 'boss', row: actRows(S.act).length, act: S.act });
  }

  function startNode(node) {
    if (!S) return;
    closeOverlays();
    S.node = node;
    S.reward = null; S.rest = null; S.shop = null; S.event = null;
    sel = -1; locked = false;
    if (node.type === 'rest') {
      S.phase = 'rest';
      var heal = Math.round(S.maxHp * restHealRatio());
      S.rest = { heal: heal, gold: 20 + (S.act - 1) * 12 + S.actFloor * 4, done: false };
      syncUI(); writeSave();
      return;
    }
    if (node.type === 'chest') {
      var avail = RELIC_LIST.filter(function (k) { return !hasRelic(k); });
      S.phase = 'chest';
      S.rest = { relic: avail.length ? pick(avail) : null, gold: 28 + (S.act - 1) * 14 + S.actFloor * 5, done: false };
      syncUI(); writeSave();
      return;
    }
    if (node.type === 'shop') {
      S.phase = 'shop';
      S.shop = makeShop();
      S.msg = t('shopWelcome');
      S.log = '';
      syncUI(); writeSave();
      return;
    }
    if (node.type === 'event') {
      S.phase = 'event';
      S.event = { key: nextEventKey(S.seed, S.act, S.actFloor) };
      S.msg = t('eventNodeMsg');
      S.log = '';
      syncUI(); writeSave();
      return;
    }
    startBattle(node);
  }

  function startBattle(node) {
    S.phase = 'fight';
    S.turn = 1;
    S.block = hasRelic('shield') ? 2 : 0;
    S.poison = 0; S.strength = 0; S.vuln = 0; S.weak = 0;
    if (S.cls === 'warlock') S.poison = 2;
    S.draw = shuffle(S.deck.slice());
    S.discard = []; S.exhaust = []; S.hand = [];
    sel = -1; locked = false; floats = []; parts = []; hitFlash = 0; shakeT = 0;
    S.enemy = makeEnemy(node);
    S.maxEnergy = baseEnergy();
    S.energy = S.maxEnergy;
    S.msg = node.type === 'boss'
      ? t('msgBossFight').replace('{name}', enemyName(S.enemy))
      : (node.type === 'elite' ? t('eliteFight') : t('msgStart'));
    if (S.cls === 'warlock') S.msg += ' · ' + t('gs.deckbuilder.cls.warlock.open');
    S.log = '';
    drawCards(5);
    syncUI();
    if (node.type === 'boss') {
      audio('daily');
      if (window.Arcade && Arcade.juice) Arcade.juice.coin(null, null, 'var(--neon-purple)');
    }
    writeSave();
  }

  function enemyName(e) {
    if (!e) return '';
    if (e.boss) return cleanName(T('gs.deckbuilder.' + e.nameKey + '.n'));
    return cleanName(T('gs.deckbuilder.enemy.' + e.nameKey + '.n'));
  }

  function drawCards(n) {
    for (var i = 0; i < n; i++) {
      if (!S.draw.length) {
        if (!S.discard.length) break;
        S.draw = shuffle(S.discard.slice());
        S.discard = [];
      }
      if (!S.draw.length) break;
      var k = S.draw.pop();
      if (S.hand.length >= PILE_LIMIT) S.discard.push(k);
      else S.hand.push(k);
    }
    audio('rotate');
  }

  function startPlayerTurn() {
    if (!S || S.phase !== 'fight') return;
    S.turn++;
    S.block = 0;
    if (hasRelic('shield')) S.block += 2;
    S.maxEnergy = baseEnergy();
    S.energy = S.maxEnergy;
    S.vuln = Math.max(0, S.vuln - 1);
    S.weak = Math.max(0, S.weak - 1);
    if (S.poison > 0) {
      var pd = S.poison;
      damageEnemyRaw(pd, 'poison');
      S.poison = Math.max(0, S.poison - 1);
      S.log = t('poisonTick').replace('{n}', pd);
      if (S.enemy.hp <= 0) { resolveVictory(); return; }
    }
    drawCards(5);
    locked = false;
    syncUI();
    writeSave();
  }

  function damageEnemyRaw(n, kind) {
    if (!S.enemy) return 0;
    var d = Math.max(0, n);
    var absorbed = Math.min(S.enemy.block, d);
    S.enemy.block -= absorbed;
    d -= absorbed;
    S.enemy.hp -= d;
    if (d > 0) {
      addFloat(enemyCenter().x, enemyCenter().y - 26, '-' + d, kind === 'poison' ? '#39ff14' : '#ffe600', 18);
      hitFlash = 10;
      burstAt(enemyCenter().x, enemyCenter().y, kind === 'poison' ? 'var(--neon-green)' : 'var(--neon-yellow)', 10);
    }
    if (S.enemy.hp < 0) S.enemy.hp = 0;
    checkBossPhase();
    return d;
  }

  function checkBossPhase() {
    var e = S.enemy;
    if (!e || !e.boss || e.phase > 0) return;
    if (e.hp <= e.maxHp * 0.5) {
      e.phase = 1;
      e.intent = rollIntent(e);
      S.msg = t('bossPhase');
      S.log = t('bossPhase');
      if (window.Arcade && Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
      audio('clear');
    }
  }

  function damagePlayer(n) {
    var d = Math.max(0, Math.round(n));
    if (S.vuln > 0) d = Math.round(d * 1.5);
    var blocked = Math.min(S.block, d);
    S.block -= blocked;
    d -= blocked;
    var pc = playerCenter();
    if (d > 0) {
      S.hp -= d;
      addFloat(pc.x, pc.y - 16, '-' + d, '#ff2d95', 20);
      burstAt(pc.x, pc.y, 'var(--neon-pink)', 12);
      shakeT = 14;
      if (window.Arcade && Arcade.fx) Arcade.fx.shake(stageEl);
      audio('error');
    } else {
      addFloat(pc.x, pc.y - 16, t('blockedAll'), '#00f0ff', 12);
      burstAt(pc.x, pc.y, 'var(--neon-cyan)', 6);
      audio('ui');
    }
    if (S.hp <= 0) { S.hp = 0; return true; }
    return false;
  }

  function denyCard(idx) {
    var el = handEl.children[idx];
    if (el) {
      el.classList.remove('deny');
      void el.offsetWidth;
      el.classList.add('deny');
      delay(function () { if (el) el.classList.remove('deny'); }, 380);
    }
    var spec = cardSpec(S.hand[idx]);
    var msg = t('noEnergyToast').replace('{n}', spec ? spec.cost : 0);
    setMsg(t('hintNoEnergy'), 'warn');
    toast(msg, 'err');
    audio('error');
    if (window.Arcade && Arcade.fx) {
      var r = el ? el.getBoundingClientRect() : null;
      if (r) Arcade.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 'var(--neon-pink)', 8);
    }
  }

  function playCard(idx, selfTarget) {
    if (!S || S.phase !== 'fight' || locked || !S.enemy || S.enemy.hp <= 0) return;
    var key = S.hand[idx];
    var spec = cardSpec(key);
    if (!spec) return;
    if (spec.unplayable) {
      setMsg(t('unplayable'), 'warn');
      audio('error');
      return;
    }
    if (S.energy < spec.cost) { denyCard(idx); return; }
    var atk = spec.type === 'atk';
    if (!atk && !selfTarget) {
      S.msg = t('hintSelf');
      setMsg(t('hintSelf'), 'info');
      return;
    }
    sel = -1;
    var handCardEl = handEl.children[idx];
    if (handCardEl) flyCard(handCardEl, atk ? enemyCenter(false) : playerCenter(false));
    S.energy -= spec.cost;
    S.hand.splice(idx, 1);
    var eff = [];
    var e = S.enemy;

    if (spec.dmg) {
      var hits = spec.hits || 1;
      var total = 0;
      for (var h = 0; h < hits; h++) {
        var raw = playerAttackValue(spec);
        if (e.vuln > 0) raw = Math.round(raw * 1.5);
        total += damageEnemyRaw(raw, 'hit');
      }
      eff.push(t('effDmg').replace('{n}', total));
    }
    if (spec.block) {
      S.block += spec.block;
      eff.push(t('effBlock').replace('{n}', spec.block));
      audio('ui');
    }
    if (spec.heal) {
      var hv = Math.min(S.maxHp - S.hp, spec.heal);
      S.hp += hv;
      eff.push(t('effHeal').replace('{n}', hv));
      audio('coin');
    }
    if (spec.poison) {
      var pv = hasRelic('toxin') ? Math.round(spec.poison * 1.5) : spec.poison;
      S.poison += pv;
      eff.push(t('effPoison').replace('{n}', pv));
    }
    if (spec.energy) {
      S.energy += spec.energy;
      eff.push(t('effEnergy').replace('{n}', spec.energy));
      audio('coin');
    }
    if (spec.str) {
      S.strength += spec.str;
      eff.push(t('effStr').replace('{n}', spec.str));
    }
    if (spec.vuln) {
      e.vuln += spec.vuln;
      eff.push(t('effVuln').replace('{n}', spec.vuln));
    }
    if (spec.weak) {
      e.weak += spec.weak;
      eff.push(t('effWeak').replace('{n}', spec.weak));
    }
    if (spec.sap) {
      var before = e.strength || 0;
      e.strength = Math.max(0, before - spec.sap);
      eff.push(t('effSap').replace('{n}', before - e.strength));
    }
    if (spec.draw) {
      drawCards(spec.draw);
      eff.push(t('effDraw').replace('{n}', spec.draw));
    }
    S.log = t('playLog').replace('{card}', cardName(key)).replace('{effects}', eff.join(T('gs.deckbuilder.effSep')));
    if (spec.ex) S.exhaust.push(key); else S.discard.push(key);
    audio('drop');
    syncUI();
    if (S.enemy.hp <= 0) {
      locked = true;
      delay(resolveVictory, 650);
      return;
    }
    writeSave();
  }

  function endTurn() {
    if (!S || S.phase !== 'fight' || locked || !S.enemy || S.enemy.hp <= 0) return;
    sel = -1; locked = true;
    syncUI();
    delay(function () {
      enemyAct(function () {
        if (!S || S.phase !== 'fight') return;
        S.discard = S.discard.concat(S.hand);
        S.hand = [];
        startPlayerTurn();
      });
    }, 240);
  }

  function enemyAct(done) {
    if (!S || S.phase !== 'fight' || !S.enemy) return;
    var e = S.enemy;
    var it = e.intent || { type: 'attack', value: 4, hits: 1 };
    e.block = 0; // 敌方护甲在行动后清零
    e.turn++;
    var dead = false;
    if (it.type === 'attack' || it.type === 'multi') {
      var hits = it.type === 'multi' ? (it.hits || 2) : 1;
      for (var h = 0; h < hits && !dead; h++) {
        dead = damagePlayer(it.value);
        if (dead) break;
      }
      if (!dead && hasRelic('thorn')) {
        damageEnemyRaw(3, 'thorn');
        S.log = t('thornLog').replace('{name}', enemyName(e)).replace('{d}', it.value);
        if (e.hp <= 0) {
          dead = false;
          locked = true;
          delay(resolveVictory, 550);
          return;
        }
      }
      if (!dead) S.log = (S.block > 0 ? t('hitLogBlock') : t('hitLog'))
        .replace('{name}', enemyName(e)).replace('{d}', it.value).replace('{b}', it.value);
      if (it.charged) e.charge = false;
      audio('drop');
    } else if (it.type === 'defend') {
      e.block += it.value;
      S.log = t('intentDefendLog').replace('{name}', enemyName(e)).replace('{n}', it.value);
      addFloat(enemyCenter().x, enemyCenter().y - 20, '+' + it.value, '#00f0ff', 16);
      audio('ui');
    } else if (it.type === 'buff') {
      e.strength += it.value;
      S.log = t('intentBuffLog').replace('{name}', enemyName(e)).replace('{n}', it.value);
      addFloat(enemyCenter().x, enemyCenter().y - 20, '+' + it.value + ' ' + t('statusStr'), '#ffe600', 16);
      burstAt(enemyCenter().x, enemyCenter().y, 'var(--neon-yellow)', 12);
      audio('merge');
    } else if (it.type === 'debuff') {
      S.vuln += it.value;
      S.log = t('intentDebuffLog').replace('{name}', enemyName(e)).replace('{n}', it.value);
      addFloat(playerCenter().x, playerCenter().y - 18, t('statusVuln').replace('{n}', it.value), '#ff2d95', 16);
      burstAt(playerCenter().x, playerCenter().y, 'var(--neon-pink)', 10);
      audio('error');
    } else if (it.type === 'charge') {
      e.charge = true;
      S.log = t('intentChargeMsg');
      addFloat(enemyCenter().x, enemyCenter().y - 22, t('intentChargeMsg'), '#ffe600', 18);
      burstAt(enemyCenter().x, enemyCenter().y, 'var(--neon-yellow)', 16);
      audio('clear');
    }
    e.vuln = Math.max(0, e.vuln - 1);
    e.weak = Math.max(0, e.weak - 1);
    if (e.boss && e.phase === 0 && e.hp <= e.maxHp * 0.5) e.phase = 1;
    if (e.boss) {
      if (it.type !== 'charge') e.step = (e.step || 0) + 1;
    }
    if (dead) {
      defeat();
      return;
    }
    e.intent = e.boss ? bossIntent(e) : rollIntent(e);
    syncUI();
    writeSave();
    if (done) done();
  }

  function progressFloor() { return (S.act - 1) * 3 + S.actFloor; }

  function resolveVictory() {
    if (!S || S.phase !== 'fight') return;
    if (!S.enemy || S.enemy.hp > 0) return;
    var node = S.node || { type: 'battle' };
    locked = false;
    var isBoss = node.type === 'boss';
    var isElite = node.type === 'elite';
    var d = DIFF[S.diff] || DIFF[1];
    var gold = isBoss ? 0 : (isElite ? 30 : 14) + S.act * 10 + S.actFloor * 3;
    if (!isBoss && d.act3Gold && S.act === 3) gold += d.act3Gold;
    S.gold += gold;
    if (isElite) S.eliteWins++;
    var postHeal = d.postHeal || 0;
    if (!isBoss && postHeal > 0) S.hp = Math.min(S.maxHp, S.hp + postHeal);
    if (hasRelic('blood')) S.hp = Math.min(S.maxHp, S.hp + 10);
    if (isBoss) {
      var bossGold = 55 + S.act * 25;
      S.gold += bossGold;
      var bossRelic = RELIC_LIST.filter(function (k) { return !hasRelic(k); });
      if (bossRelic.length) S.relics.push(pick(bossRelic));
      S.hp = Math.min(S.maxHp, S.hp + (d.bossHeal != null ? d.bossHeal : 8));
      var bossDownName = enemyName(S.enemy);
      if (S.act < ACTS.length) {
        /* 第 1/2 幕 Boss 击破：进入下一幕 */
        S.act++;
        S.actFloor = 0;
        S.floor = progressFloor();
        S.node = null;
        S.enemy = null;
        clearBattlePiles();
        S.phase = 'map';
        S.msg = t('actClearMsg').replace('{n}', S.act - 1).replace('{name}', cleanName(bossDownName));
        S.log = S.msg;
        S.reward = null;
        audio('record');
        if (window.Arcade && Arcade.fx) Arcade.fx.flash('var(--neon-green)');
        syncUI();
        writeSave();
        return;
      }
      /* 第 3 幕 Boss：整局胜利 */
      S.actFloor = actRows(S.act).length;
      S.floor = progressFloor();
      finalize(true);
      return;
    }
    var relicKey = null;
    if (isElite) {
      var avail = RELIC_LIST.filter(function (k) { return !hasRelic(k); });
      if (avail.length) {
        relicKey = pick(avail);
        S.relics.push(relicKey);
      } else {
        S.gold += 20;
      }
      S.hp = Math.min(S.maxHp, S.hp + 6);
    }
    S.actFloor++;
    S.floor = progressFloor();
    S.phase = 'reward';
    S.reward = {
      cards: rollRewardCards(isElite),
      gold: gold,
      relic: relicKey,
      skipGold: isElite ? 24 : 12,
      elite: isElite
    };
    S.msg = isElite ? t('rewardTitleElite') : t('rewardTitle');
    S.log = t('scoreLine').replace('{n}', computeScore(false));
    audio(isElite ? 'record' : 'clear');
    if (window.Arcade && Arcade.juice) Arcade.juice.coin(null, null, isElite ? 'var(--neon-yellow)' : 'var(--neon-cyan)');
    syncUI();
    writeSave();
  }

  function chooseReward(idx) {
    if (!S || S.phase !== 'reward' || !S.reward) return;
    var key = S.reward.cards[idx];
    if (!key) return;
    S.deck.push(key);
    S.msg = t('rewardGot').replace('{name}', cardName(key));
    S.log = S.msg;
    resetAfterReward();
    audio('coin');
    if (window.Arcade && Arcade.juice) Arcade.juice.coin(null, null, 'var(--neon-yellow)');
  }

  function skipReward() {
    if (!S || S.phase !== 'reward' || !S.reward) return;
    var add = S.reward.skipGold || 12;
    S.gold += add;
    S.msg = t('rewardSkipMsg').replace('{n}', add);
    S.log = S.msg;
    resetAfterReward();
    audio('coin');
  }

  function clearBattlePiles() {
    S.hand = []; S.draw = []; S.discard = []; S.exhaust = [];
    S.block = 0; S.energy = 0; S.poison = 0; S.strength = 0; S.vuln = 0; S.weak = 0;
  }

  function resetAfterReward() {
    S.reward = null;
    S.node = null;
    S.enemy = null;
    clearBattlePiles();
    S.phase = 'map';
    closeOverlays();
    sel = -1; locked = false;
    syncUI();
    writeSave();
  }

  function resolveRest(kind) {
    if (!S || S.phase !== 'rest' || !S.rest) return;
    if (kind === 'heal') {
      var hv = Math.min(S.maxHp - S.hp, S.rest.heal);
      S.hp += hv;
      S.msg = t('restHealMsg').replace('{n}', hv);
      S.log = S.msg;
      audio('coin');
    } else {
      S.gold += S.rest.gold;
      S.msg = t('restGoldMsg').replace('{n}', S.rest.gold);
      S.log = S.msg;
      audio('coin');
    }
    finishNode();
  }

  function resolveChest(kind) {
    if (!S || S.phase !== 'chest' || !S.rest) return;
    if (kind === 'relic' && S.rest.relic) {
      gainRelic(S.rest.relic);
      S.msg = t('chestRelicMsg').replace('{name}', T('gs.deckbuilder.relic.' + S.rest.relic + '.n'));
      S.log = S.msg;
      audio('record');
    } else {
      S.gold += S.rest.gold;
      S.msg = t('chestGoldMsg').replace('{n}', S.rest.gold);
      S.log = S.msg;
      audio('coin');
    }
    finishNode();
  }

  /* ================= 随机事件 ================= */
  function eventDef(key) { return EVENT_BY_KEY[key] || null; }
  function eventTitle(key) { return T('gs.deckbuilder.event.' + key + '.n'); }
  function eventOptionName(key, i) { return T('gs.deckbuilder.event.' + key + '.o' + i + '.n'); }
  function eventOptionDesc(key, i) { return T('gs.deckbuilder.event.' + key + '.o' + i + '.d'); }

  function applyEventOption(opt) {
    var eff = opt && opt.eff ? opt.eff : {};
    var out = [];
    if (eff.goldCost) {
      S.gold -= eff.goldCost;
      out.push(t('eventEffPay').replace('{n}', eff.goldCost));
    }
    if (eff.gold) {
      S.gold += eff.gold;
      out.push(t('eventEffGold').replace('{n}', eff.gold));
    }
    if (eff.loseHp) {
      var loss = Math.min(Math.max(0, S.hp - 1), eff.loseHp);
      S.hp -= loss;
      if (loss > 0) out.push(t('eventEffLoseHp').replace('{n}', loss));
    }
    if (eff.maxHp) {
      S.maxHp = Math.max(1, S.maxHp + eff.maxHp);
      if (eff.maxHp > 0) S.hp = Math.min(S.maxHp, S.hp + eff.maxHp);
      else S.hp = Math.min(S.hp, S.maxHp);
      out.push(t(eff.maxHp > 0 ? 'eventEffMaxUp' : 'eventEffMaxDown').replace('{n}', Math.abs(eff.maxHp)));
    }
    if (eff.heal) {
      var hv = Math.min(S.maxHp - S.hp, eff.heal);
      S.hp += hv;
      if (hv > 0) out.push(t('eventEffHeal').replace('{n}', hv));
    }
    if (eff.card) {
      var ck = pick(classCardPool(S.cls, eff.card));
      S.deck.push(ck);
      out.push(t('eventEffCard').replace('{name}', cleanName(cardName(ck))));
    }
    if (eff.wound) {
      S.deck.push('wound');
      out.push(t('eventEffWound').replace('{name}', cleanName(cardName('wound'))));
    }
    if (eff.remove && S.deck.length) {
      var ri = rnd(S.deck.length);
      var rk = S.deck.splice(ri, 1)[0];
      out.push(t('eventEffRemove').replace('{name}', cleanName(cardName(rk))));
    }
    if (eff.copy && S.deck.length) {
      var ck2 = S.deck[rnd(S.deck.length)];
      S.deck.push(ck2);
      out.push(t('eventEffCopy').replace('{name}', cleanName(cardName(ck2))));
    }
    if (eff.relic) {
      var avail = RELIC_LIST.filter(function (k) { return !hasRelic(k); });
      if (avail.length) {
        var relicKey = pick(avail);
        gainRelic(relicKey);
        out.push(t('eventEffRelic').replace('{name}', cleanName(T('gs.deckbuilder.relic.' + relicKey + '.n'))));
      } else {
        S.gold += 20;
        out.push(t('eventEffGold').replace('{n}', 20));
      }
    }
    return out.length ? out : [t('eventEffNone')];
  }

  function chooseEventOption(i) {
    if (!S || S.phase !== 'event' || !S.event) return false;
    var ev = eventDef(S.event.key);
    if (!ev || !ev.opts[i]) return false;
    var opt = ev.opts[i];
    if (opt.eff && opt.eff.goldCost && S.gold < opt.eff.goldCost) {
      setMsg(t('shopNoGold'), 'warn');
      audio('error');
      return false;
    }
    var res = applyEventOption(opt);
    S.msg = t('eventResult').replace('{name}', cleanName(eventTitle(S.event.key)))
      .replace('{res}', res.join(T('gs.deckbuilder.effSep')));
    S.log = S.msg;
    audio('coin');
    finishNode();
    return true;
  }

  /* ================= 商店 ================= */
  function shopCardPrice(key) {
    var s = CARDS[key];
    if (!s) return 50;
    var base = s.rarity === 'rare' ? 120 : (s.rarity === 'uncommon' ? 75 : 45);
    return Math.round(base + (s.cost || 0) * 6 + (S.act - 1) * 18 + rnd(9));
  }
  function makeShop() {
    var cards = [], guard = 0;
    var pools = classPools(S.cls);
    while (cards.length < 3 && guard++ < 80) {
      var r = Math.random(), key;
      if (r < 0.55) key = pick(pools.common);
      else if (r < 0.88) key = pick(pools.uncommon);
      else key = pick(pools.rare);
      var dup = false;
      for (var i = 0; i < cards.length; i++) if (cards[i].key === key) dup = true;
      if (dup) continue;
      cards.push({ key: key, price: shopCardPrice(key), sold: false });
    }
    var avail = RELIC_LIST.filter(function (k) { return !hasRelic(k); });
    var relic = avail.length ? { key: pick(avail), price: 130 + (S.act - 1) * 35, sold: false } : null;
    return {
      cards: cards,
      relic: relic,
      removePrice: 55 + (S.act - 1) * 15,
      removed: false,
      removing: false,
      sold: []
    };
  }
  function shopBuyCard(i) {
    if (!S || S.phase !== 'shop' || !S.shop) return false;
    var it = S.shop.cards[i];
    if (!it || it.sold) return false;
    if (S.gold < it.price) {
      S.msg = t('shopNoGold');
      setMsg(S.msg, 'warn');
      audio('error');
      return false;
    }
    S.gold -= it.price;
    it.sold = true;
    S.deck.push(it.key);
    S.msg = t('shopBought').replace('{name}', cardName(it.key)).replace('{n}', it.price);
    S.log = S.msg;
    audio('coin');
    syncUI(); writeSave();
    return true;
  }
  function shopBuyRelic() {
    if (!S || S.phase !== 'shop' || !S.shop || !S.shop.relic) return false;
    var it = S.shop.relic;
    if (it.sold) return false;
    if (S.gold < it.price) {
      S.msg = t('shopNoGold');
      setMsg(S.msg, 'warn');
      audio('error');
      return false;
    }
    S.gold -= it.price;
    it.sold = true;
    gainRelic(it.key);
    S.msg = t('shopRelicBought').replace('{name}', cleanName(T('gs.deckbuilder.relic.' + it.key + '.n')));
    S.log = S.msg;
    audio('record');
    syncUI(); writeSave();
    return true;
  }
  function shopRemoveMode() {
    if (!S || S.phase !== 'shop' || !S.shop || S.shop.removed) return false;
    S.shop.removing = true;
    S.msg = t('shopRemovePick');
    syncUI(); writeSave();
    return true;
  }
  function shopRemoveCard(i) {
    if (!S || S.phase !== 'shop' || !S.shop || !S.shop.removing || S.shop.removed) return false;
    if (!S.deck[i]) return false;
    var price = S.shop.removePrice;
    if (S.gold < price) {
      S.msg = t('shopNoGold');
      setMsg(S.msg, 'warn');
      audio('error');
      return false;
    }
    var key = S.deck.splice(i, 1)[0];
    S.gold -= price;
    S.shop.removed = true;
    S.shop.removing = false;
    S.msg = t('shopRemoveDone').replace('{name}', cardName(key)).replace('{n}', price);
    S.log = S.msg;
    audio('drop');
    syncUI(); writeSave();
    return true;
  }
  function leaveShop() {
    if (!S || S.phase !== 'shop') return;
    finishNode();
  }

  function finishNode() {
    S.actFloor++;
    S.floor = progressFloor();
    S.node = null;
    S.rest = null;
    S.shop = null;
    S.event = null;
    S.enemy = null;
    clearBattlePiles();
    S.phase = 'map';
    closeOverlays();
    sel = -1; locked = false;
    syncUI();
    writeSave();
  }

  function gainRelic(k) {
    if (!k || hasRelic(k)) return false;
    S.relics.push(k);
    if (k === 'blood') S.hp = Math.min(S.maxHp, S.hp + 10);
    if (k === 'energy') { S.maxEnergy = baseEnergy(); }
    return true;
  }

  function computeScore(won) {
    return (S.act - 1) * 400 + S.actFloor * 100 + S.eliteWins * 60 + S.relics.length * 15 +
      S.gold + Math.max(0, S.hp) * 2 + (won ? 900 : 0);
  }

  function finalize(won) {
    if (!S) return;
    if (S.phase === 'win' || S.phase === 'lose') return;
    S.phase = won ? 'win' : 'lose';
    sel = -1; locked = false;
    var score = computeScore(won);
    var isNew = false;
    if (!S.submitted) {
      S.submitted = true;
      if (window.Arcade && Arcade.shell) isNew = Arcade.shell.submitScore(score);
    }
    S.score = score;
    S.newRecord = !!isNew;
    S.best = bestScore();
    S.msg = won
      ? t('resultWinMsg').replace('{name}', cleanName(enemyName(S.enemy)))
      : t('resultDeadMsg').replace('{n}', Math.max(1, progressFloor() + 1));
    if (window.Arcade && Arcade.juice) { if (won) Arcade.juice.win(); else Arcade.juice.lose(); }
    else audio(won ? 'win' : 'lose');
    if (window.Arcade && Arcade.fx) Arcade.fx.flash(won ? 'var(--neon-green)' : 'var(--neon-pink)');
    clearSave();
    syncUI();
  }

  function defeat() {
    if (!S || S.phase !== 'fight') return;
    finalize(false);
  }

  function bestScore() {
    try {
      var v = window.Arcade && Arcade.storage ? Arcade.storage.getBest('deckbuilder') : null;
      return typeof v === 'number' ? v : 0;
    } catch (e) { return 0; }
  }

  /* ================= 舞台坐标 / 特效 ================= */
  var STAGE_W = 340, STAGE_H = 232;
  function enemyCenter(rel) {
    var r = stageCanvas ? stageCanvas.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    var x = r.left + r.width * 0.5, y = r.top + r.height * 0.52;
    return { x: x, y: y };
  }
  function playerCenter(rel) {
    var r = playerPanelEl ? playerPanelEl.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function burstAt(x, y, color, count) {
    if (window.Arcade && Arcade.fx) Arcade.fx.burst(x, y, color, count);
  }
  function addFloat(x, y, text, color, size) {
    floats.push({ x: x, y: y, text: text, color: color || 'var(--neon-yellow)', size: size || 16, life: 1 });
  }

  /* ================= DOM 构建 ================= */
  root.innerHTML =
    '<div class="dk-wrap" id="dk-wrap">' +
      '<div class="dk-screen" id="dk-pick">' +
        '<div class="dk-pick-t" id="dk-pick-title"></div>' +
        '<div class="dk-pick-d" id="dk-pick-sub"></div>' +
        '<div class="dk-class-title" id="dk-class-title"></div>' +
        '<div class="dk-class-grid" id="dk-class-grid"></div>' +
        '<div class="dk-diff-grid" id="dk-diff-grid"></div>' +
        '<div class="dk-diff-best" id="dk-pick-best"></div>' +
        '<button class="btn primary dk-start-btn" id="dk-start" type="button"></button>' +
        '<div class="dk-pick-help" id="dk-pick-help"></div>' +
      '</div>' +
      '<div class="dk-screen hidden" id="dk-game">' +
        '<div class="dk-hud">' +
          '<span class="dk-chip act" id="dk-act"></span>' +
          '<span class="dk-chip cls" id="dk-cls"></span>' +
          '<span class="dk-chip floor" id="dk-floor"></span>' +
          '<span class="dk-chip hp">' + t('hudHp') + ' <b id="dk-hp">0</b></span>' +
          '<span class="dk-chip block">' + t('hudBlock') + ' <b id="dk-block">0</b></span>' +
          '<span class="dk-chip gold">' + t('hudGold') + ' <b id="dk-gold">0</b></span>' +
          '<span class="dk-hud-spacer"></span>' +
          '<div class="dk-energy-orb" id="dk-energy"><b id="dk-energy-n">3</b><small>/<span id="dk-energy-max">3</span></small></div>' +
          '<div class="dk-piles">' +
            '<div class="dk-pile" id="dk-draw-pile" title="' + t('drawPile') + '">' + t('drawPile') + '<b id="dk-draw">0</b></div>' +
            '<div class="dk-pile" id="dk-discard-pile" title="' + t('discardPile') + '">' + t('discardPile') + '<b id="dk-discard">0</b></div>' +
            '<div class="dk-pile" id="dk-exhaust-pile" title="' + t('exhaustPile') + '">' + t('exhaustPile') + '<b id="dk-exhaust">0</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="dk-stage" id="dk-stage">' +
          '<div class="dk-enemy-hud">' +
            '<div class="dk-enemy-line"><span class="dk-enemy-name" id="dk-enemy-name">—</span><span class="dk-enemy-tag" id="dk-enemy-tag"></span></div>' +
            '<div class="dk-enemy-bar"><i id="dk-enemy-bar" style="width:100%"></i></div>' +
            '<div class="dk-enemy-meta"><span id="dk-enemy-hptext">0/0</span><span class="dk-enemy-block" id="dk-enemy-block"></span><span class="dk-intent-badge" id="dk-intent"></span></div>' +
          '</div>' +
          '<canvas id="dk-canvas" width="340" height="232"></canvas>' +
        '</div>' +
        '<div class="dk-player-panel" id="dk-player">' +
          '<div class="dk-player-hp"><div class="t">' + t('hudHp') + ' <b id="dk-php">0</b>/<span id="dk-pmax">0</span></div><div class="bar"><i id="dk-pbar" style="width:100%"></i></div></div>' +
          '<div class="dk-shield"><i class="sh"></i><span id="dk-pblock">0</span></div>' +
        '</div>' +
        '<div class="dk-status" id="dk-status"></div>' +
        '<div class="dk-relics dk-status" id="dk-relics"></div>' +
        '<div class="dk-handwrap"><div class="dk-hand" id="dk-hand"></div></div>' +
        '<div class="dk-controls">' +
          '<button class="btn primary" id="dk-end" type="button">' + t('endTurn') + '</button>' +
          '<button class="btn" id="dk-deck" type="button"></button>' +
          '<button class="btn" id="dk-restart" type="button">' + t('restart') + '</button>' +
        '</div>' +
        '<div class="dk-msg" id="dk-msg"></div>' +
        '<div class="dk-log" id="dk-log"></div>' +
        '<div class="dk-hint" id="dk-hint">' + t('hintSelect') + '</div>' +
        '<div class="dk-ov hidden" id="dk-map"><div class="dk-ov-card dk-map-card">' +
          '<div class="dk-ov-title" id="dk-map-title"></div>' +
          '<div class="dk-map-rows" id="dk-map-rows"></div>' +
          '<div class="dk-map-foot"><span class="dk-map-gold" id="dk-map-gold"></span><button class="btn" id="dk-map-deck" type="button"></button></div>' +
        '</div></div>' +
        '<div class="dk-ov hidden" id="dk-reward"><div class="dk-ov-card">' +
          '<div class="dk-ov-title" id="dk-reward-title"></div>' +
          '<div class="dk-ov-sub" id="dk-reward-sub"></div>' +
          '<div class="dk-ov-sub" id="dk-reward-relic"></div>' +
          '<div class="dk-reward-cards" id="dk-reward-cards"></div>' +
          '<div class="dk-ov-row"><button class="btn" id="dk-reward-skip" type="button"></button></div>' +
        '</div></div>' +
        '<div class="dk-ov hidden" id="dk-rest"><div class="dk-ov-card">' +
          '<div class="dk-ov-title" id="dk-rest-title"></div>' +
          '<div class="dk-ov-sub" id="dk-rest-sub"></div>' +
          '<div class="dk-ov-row"><button class="btn primary" id="dk-rest-heal" type="button"></button></div>' +
          '<div class="dk-ov-row"><button class="btn" id="dk-rest-gold" type="button"></button></div>' +
        '</div></div>' +
        '<div class="dk-ov hidden" id="dk-chest"><div class="dk-ov-card">' +
          '<div class="dk-ov-title" id="dk-chest-title"></div>' +
          '<div class="dk-ov-sub" id="dk-chest-sub"></div>' +
          '<div class="dk-ov-row"><button class="btn primary" id="dk-chest-relic" type="button"></button></div>' +
          '<div class="dk-ov-row"><button class="btn" id="dk-chest-gold" type="button"></button></div>' +
        '</div></div>' +
        '<div class="dk-ov hidden" id="dk-event"><div class="dk-ov-card dk-event-card">' +
          '<div class="dk-ov-title" id="dk-event-title"></div>' +
          '<div class="dk-ov-sub" id="dk-event-desc"></div>' +
          '<div class="dk-event-opts" id="dk-event-opts"></div>' +
        '</div></div>' +
        '<div class="dk-ov hidden" id="dk-shop"><div class="dk-ov-card dk-shop-card">' +
          '<div class="dk-ov-title" id="dk-shop-title"></div>' +
          '<div class="dk-ov-sub" id="dk-shop-sub"></div>' +
          '<div class="dk-shop-gold" id="dk-shop-gold"></div>' +
          '<div class="dk-shop-grid" id="dk-shop-grid"></div>' +
          '<div class="dk-shop-relic" id="dk-shop-relic"></div>' +
          '<div class="dk-shop-remove" id="dk-shop-remove"></div>' +
          '<div class="dk-shop-decklist" id="dk-shop-decklist"></div>' +
          '<div class="dk-ov-row"><button class="btn" id="dk-shop-leave" type="button"></button></div>' +
        '</div></div>' +
        '<div class="dk-ov hidden" id="dk-result"><div class="dk-ov-card">' +
          '<h2 id="dk-result-title"></h2>' +
          '<div class="dk-ov-sub" id="dk-result-msg"></div>' +
          '<div class="dk-badge" id="dk-result-record"></div>' +
          '<div class="dk-stats">' +
            '<div class="dk-stat"><span>' + t('resultFloors') + '</span><b id="dk-result-floors">0</b></div>' +
            '<div class="dk-stat"><span>' + t('resultScore') + '</span><b id="dk-result-score">0</b></div>' +
            '<div class="dk-stat"><span>' + t('resultBest') + '</span><b id="dk-result-best">0</b></div>' +
            '<div class="dk-stat"><span>' + t('resultGold') + '</span><b id="dk-result-gold">0</b></div>' +
          '</div>' +
          '<div class="dk-ov-row"><button class="btn primary" id="dk-again" type="button">' + t('resultAgain') + '</button></div>' +
          '<div class="dk-ov-row"><button class="btn" id="dk-change-diff" type="button">' + t('changeDiff') + '</button></div>' +
        '</div></div>' +
        '<div class="dk-ov hidden" id="dk-deck-ov"><div class="dk-ov-card">' +
          '<div class="dk-ov-title" id="dk-deck-title"></div>' +
          '<div class="dk-deck-list" id="dk-deck-list"></div>' +
          '<div class="dk-ov-row"><button class="btn" id="dk-deck-close" type="button">' + t('close') + '</button></div>' +
        '</div></div>' +
      '</div>' +
    '</div>';

  var wrapEl = document.getElementById('dk-wrap');
  var pickEl = document.getElementById('dk-pick');
  var gameEl = document.getElementById('dk-game');
  var diffGrid = document.getElementById('dk-diff-grid');
  var classGrid = document.getElementById('dk-class-grid');
  var classTitleEl = document.getElementById('dk-class-title');
  var pickBest = document.getElementById('dk-pick-best');
  var pickHelp = document.getElementById('dk-pick-help');
  var startBtn = document.getElementById('dk-start');
  var stageEl = document.getElementById('dk-stage');
  var stageCanvas = document.getElementById('dk-canvas');
  var enemyNameEl = document.getElementById('dk-enemy-name');
  var enemyTagEl = document.getElementById('dk-enemy-tag');
  var enemyBarEl = document.getElementById('dk-enemy-bar');
  var enemyHpText = document.getElementById('dk-enemy-hptext');
  var enemyBlockEl = document.getElementById('dk-enemy-block');
  var intentEl = document.getElementById('dk-intent');
  var playerPanelEl = document.getElementById('dk-player');
  var handEl = document.getElementById('dk-hand');
  var endBtn = document.getElementById('dk-end');
  var deckBtn = document.getElementById('dk-deck');
  var restartBtn = document.getElementById('dk-restart');
  var msgEl = document.getElementById('dk-msg');
  var logEl = document.getElementById('dk-log');
  var hintEl = document.getElementById('dk-hint');
  var floorEl = document.getElementById('dk-floor');
  var actEl = document.getElementById('dk-act');
  var clsEl = document.getElementById('dk-cls');
  var hpEl = document.getElementById('dk-hp');
  var blockEl = document.getElementById('dk-block');
  var goldEl = document.getElementById('dk-gold');
  var energyEl = document.getElementById('dk-energy');
  var energyNEl = document.getElementById('dk-energy-n');
  var energyMaxEl = document.getElementById('dk-energy-max');
  var drawEl = document.getElementById('dk-draw');
  var discardEl = document.getElementById('dk-discard');
  var exhaustEl = document.getElementById('dk-exhaust');
  var pHpEl = document.getElementById('dk-php');
  var pMaxEl = document.getElementById('dk-pmax');
  var pBarEl = document.getElementById('dk-pbar');
  var pBlockEl = document.getElementById('dk-pblock');
  var statusEl = document.getElementById('dk-status');
  var relicsEl = document.getElementById('dk-relics');
  var mapOv = document.getElementById('dk-map');
  var rewardOv = document.getElementById('dk-reward');
  var restOv = document.getElementById('dk-rest');
  var chestOv = document.getElementById('dk-chest');
  var eventOv = document.getElementById('dk-event');
  var shopOv = document.getElementById('dk-shop');
  var resultOv = document.getElementById('dk-result');
  var deckOv = document.getElementById('dk-deck-ov');
  var REWARD_CARDS = document.getElementById('dk-reward-cards');

  function cleanName(s) {
    return String(s).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
  }

  function showGame() {
    pickEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
  }
  function showPick() {
    gameEl.classList.add('hidden');
    pickEl.classList.remove('hidden');
    renderPick();
  }
  function hideOverlays() {
    mapOv.classList.add('hidden');
    rewardOv.classList.add('hidden');
    restOv.classList.add('hidden');
    chestOv.classList.add('hidden');
    eventOv.classList.add('hidden');
    shopOv.classList.add('hidden');
    resultOv.classList.add('hidden');
    deckOv.classList.add('hidden');
  }
  function closeOverlays() { hideOverlays(); }

  /* ================= 卡牌 DOM ================= */
  function makeCardEl(key, idx, mode) {
    var spec = cardSpec(key);
    if (!spec) return null;
    var el = document.createElement('div');
    el.className = 'dk-card type-' + spec.type + ' rar-' + spec.rarity;
    el.setAttribute('data-idx', String(idx));
    var cost = document.createElement('div');
    cost.className = 'dk-cost';
    cost.textContent = String(spec.cost);
    el.appendChild(cost);
    var inner = document.createElement('div');
    inner.className = 'dk-card-inner';
    var art = document.createElement('div');
    art.className = 'dk-art';
    var cv = document.createElement('canvas');
    cv.width = 160; cv.height = 80;
    art.appendChild(cv);
    var nm = document.createElement('div');
    nm.className = 'dk-name';
    nm.textContent = cleanName(cardName(key));
    var ds = document.createElement('div');
    ds.className = 'dk-desc';
    ds.textContent = cardDesc(key);
    var rr = document.createElement('div');
    rr.className = 'dk-rar';
    rr.textContent = T('gs.deckbuilder.rarity.' + spec.rarity);
    inner.appendChild(art); inner.appendChild(nm); inner.appendChild(ds); inner.appendChild(rr);
    el.appendChild(inner);
    drawCardArt(cv, key, spec);
    if (mode === 'hand' && S && S.energy < spec.cost) el.classList.add('cant');
    if (mode === 'hand' && idx === sel) el.classList.add('sel');
    return el;
  }

  function drawCardArt(cv, key, spec) {
    var ctx = cv.getContext('2d');
    var w = 160, h = 80;
    var seed = 0;
    for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 997;
    var g = ctx.createLinearGradient(0, 0, w, h);
    if (spec.type === 'atk') { g.addColorStop(0, '#3a0a24'); g.addColorStop(1, '#170717'); }
    else if (spec.type === 'def') { g.addColorStop(0, '#062634'); g.addColorStop(1, '#07101f'); }
    else { g.addColorStop(0, '#230b3a'); g.addColorStop(1, '#0b0a1e'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (var x = 8; x < w; x += 16) ctx.strokeRect(x + 0.5, 4.5, 14, h - 9);
    var col = spec.type === 'atk' ? '#ff2d95' : (spec.type === 'def' ? '#00f0ff' : '#b967ff');
    var accent = spec.rarity === 'rare' ? '#ffe600' : (spec.rarity === 'uncommon' ? '#ffffff' : '#9fb4ff');

    if (spec.type === 'atk') {
      var cx = 80 + (seed % 11) - 5, cy = 42;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.moveTo(24 + s * 6, 70 - s * 5);
        ctx.lineTo(112 + s * 10, 20 + s * 6);
        ctx.lineWidth = 3 - s * 0.6;
        var lg = ctx.createLinearGradient(20, 70, 140, 16);
        lg.addColorStop(0, 'rgba(255,45,149,0)');
        lg.addColorStop(0.55, col);
        lg.addColorStop(1, accent);
        ctx.strokeStyle = lg;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 15, 0, Math.PI * 2);
      var rg = ctx.createRadialGradient(cx, cy - 2, 1, cx, cy - 2, 18);
      rg.addColorStop(0, accent); rg.addColorStop(0.5, col); rg.addColorStop(1, 'rgba(255,45,149,0)');
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.restore();
    } else if (spec.type === 'def') {
      var px = 80, py = 40;
      ctx.save();
      ctx.translate(px, py);
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 3 * k - Math.PI / 2;
        var xx = Math.cos(a) * 22, yy = Math.sin(a) * 24;
        if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.closePath();
      var sg = ctx.createLinearGradient(-20, -24, 20, 24);
      sg.addColorStop(0, col); sg.addColorStop(0.55, '#071826'); sg.addColorStop(1, col);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(0, 14);
      ctx.moveTo(-9, 2); ctx.lineTo(9, 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(0,240,255,0.18)';
      ctx.beginPath(); ctx.arc(80, 40, 32, 0, Math.PI * 2); ctx.fill();
    } else {
      var ox = 80, oy = 41;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      var og = ctx.createRadialGradient(ox, oy, 2, ox, oy, 22);
      og.addColorStop(0, '#fff');
      og.addColorStop(0.4, col);
      og.addColorStop(1, 'rgba(185,103,255,0)');
      ctx.fillStyle = og;
      ctx.arc(ox, oy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(ox, oy, 30, 13, -0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(ox, oy, 30, 13, 0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (var p = 0; p < 4; p++) {
        var pa = seed + p * 1.6;
        ctx.beginPath();
        ctx.arc(ox + Math.cos(pa) * 26, oy + Math.sin(pa) * 11, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (spec.rarity !== 'common') {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(w - 18, 4, 14, 2);
      ctx.fillRect(w - 18, 8, 10, 1);
      ctx.globalAlpha = 1;
    }
  }

  function renderHand() {
    handEl.innerHTML = '';
    if (!S || S.phase !== 'fight' || !S.enemy) {
      var em = document.createElement('div');
      em.className = 'dk-hand-empty';
      em.textContent = S && S.phase === 'map'
        ? t('mapActTitle').replace('{n}', S.act).replace('{m}', ACTS.length)
          .replace('{name}', cleanName(T('gs.deckbuilder.act' + S.act + '.n')))
        : '—';
      handEl.appendChild(em);
      return;
    }
    if (!S.hand.length) {
      var e2 = document.createElement('div');
      e2.className = 'dk-hand-empty';
      e2.textContent = t('pileEmpty');
      handEl.appendChild(e2);
      return;
    }
    for (var i = 0; i < S.hand.length; i++) {
      var el = makeCardEl(S.hand[i], i, 'hand');
      if (el) handEl.appendChild(el);
    }
  }

  function updateHandStates() {
    if (!handEl.children.length) return;
    for (var i = 0; i < handEl.children.length; i++) {
      var el = handEl.children[i];
      if (!el.classList || !el.classList.contains('dk-card')) continue;
      var key = S.hand[i], spec = cardSpec(key);
      if (!spec) continue;
      el.classList.toggle('cant', S.energy < spec.cost);
      el.classList.toggle('sel', i === sel);
    }
  }

  /* ================= HUD / 状态 ================= */
  function syncUI() {
    if (!started) { showPick(); return; }
    showGame();
    if (!S) return;
    var rowsCount = actRows(S.act).length;
    var floorTxt = S.actFloor >= rowsCount
      ? t('mapBoss')
      : t('floorTag').replace('{n}', (S.actFloor + 1) + '/' + rowsCount);
    if (floorEl) floorEl.textContent = floorTxt;
    if (actEl) actEl.textContent = t('actChip').replace('{n}', S.act).replace('{m}', ACTS.length);
    if (clsEl) clsEl.textContent = cleanName(t('cls.' + S.cls + '.n'));
    if (hpEl) hpEl.textContent = S.hp + '/' + S.maxHp;
    if (blockEl) blockEl.textContent = String(S.block);
    if (goldEl) goldEl.textContent = String(S.gold);
    if (energyNEl) energyNEl.textContent = String(S.energy);
    if (energyMaxEl) energyMaxEl.textContent = String(S.maxEnergy);
    if (energyEl) energyEl.classList.toggle('low', S.energy <= 0);
    if (drawEl) drawEl.textContent = String(S.draw.length);
    if (discardEl) discardEl.textContent = String(S.discard.length);
    if (exhaustEl) exhaustEl.textContent = String(S.exhaust.length);
    if (deckBtn) deckBtn.textContent = t('deckBtn').replace('{n}', S.deck.length);
    if (pHpEl) pHpEl.textContent = String(S.hp);
    if (pMaxEl) pMaxEl.textContent = String(S.maxHp);
    if (pBarEl) pBarEl.style.width = clamp((S.hp / S.maxHp) * 100, 0, 100) + '%';
    if (pBlockEl) pBlockEl.textContent = String(S.block);

    var e = S.enemy;
    if (e) {
      enemyNameEl.textContent = cleanName(enemyName(e));
      enemyTagEl.textContent = e.boss ? t('enemy.bossTag') : (e.elite ? t('enemy.eliteTag') : '');
      enemyBarEl.style.width = clamp((e.hp / e.maxHp) * 100, 0, 100) + '%';
      enemyHpText.textContent = e.hp + '/' + e.maxHp + (e.strength ? ' · ' + t('statusStr').replace('{n}', e.strength) : '');
      enemyBlockEl.textContent = e.block > 0 ? t('enemyBlock').replace('{n}', e.block) : '';
      intentEl.textContent = S.phase === 'fight' ? intentText(e) : '';
      intentEl.title = intentEl.textContent;
    } else {
      enemyNameEl.textContent = '—';
      enemyTagEl.textContent = '';
      enemyBarEl.style.width = '0%';
      enemyHpText.textContent = '';
      enemyBlockEl.textContent = '';
      intentEl.textContent = '';
    }

    var st = [];
    if (S.strength > 0) st.push('<span class="str">' + t('statusStr').replace('{n}', S.strength) + '</span>');
    if (S.vuln > 0) st.push('<span class="vuln">' + t('statusVuln').replace('{n}', S.vuln) + '</span>');
    if (S.weak > 0) st.push('<span class="weak">' + t('statusWeak').replace('{n}', S.weak) + '</span>');
    if (S.poison > 0) st.push('<span class="poison">' + t('statusPoison').replace('{n}', S.poison) + '</span>');
    if (e && e.vuln > 0) st.push('<span class="vuln">' + t('statusVuln').replace('{n}', e.vuln) + '</span>');
    if (e && e.weak > 0) st.push('<span class="weak">' + t('statusWeak').replace('{n}', e.weak) + '</span>');
    statusEl.innerHTML = st.join('');

    var relics = S.relics.map(function (k) {
      return '<span title="' + T('gs.deckbuilder.relic.' + k + '.d') + '">' + cleanName(T('gs.deckbuilder.relic.' + k + '.n')) + '</span>';
    });
    relicsEl.innerHTML = relics.length ? relics.join('') : '<span>' + t('noRelic') + '</span>';

    renderHand();
    if (endBtn) endBtn.disabled = !(S.phase === 'fight' && !locked);
    if (msgEl) {
      msgEl.textContent = cleanName(S.msg || '');
      msgEl.className = 'dk-msg' + (S.msgType ? ' ' + S.msgType : '');
    }
    if (logEl) logEl.textContent = cleanName(S.log || '');
    if (hintEl) hintEl.textContent = hintText();
    refreshOverlays();
    if (pickBest) pickBest.textContent = t('best').replace('{n}', bestScore());
  }

  function hintText() {
    if (!S) return t('hintSelect');
    if (S.phase !== 'fight') return '';
    if (locked) return t('locked');
    if (sel >= 0 && S.hand[sel]) {
      var spec = cardSpec(S.hand[sel]);
      return spec && spec.type !== 'atk' ? t('hintSelf') : t('hintAtkTarget');
    }
    return t('hintSelect');
  }

  function setMsg(text, type) {
    if (!S) return;
    S.msg = text || '';
    S.msgType = type || '';
    if (msgEl) {
      msgEl.textContent = cleanName(S.msg);
      msgEl.className = 'dk-msg' + (S.msgType ? ' ' + S.msgType : '');
    }
  }

  function renderStatusInline() {
    var st = [];
    if (S.strength > 0) st.push('<span class="str">' + t('statusStr').replace('{n}', S.strength) + '</span>');
    if (S.vuln > 0) st.push('<span class="vuln">' + t('statusVuln').replace('{n}', S.vuln) + '</span>');
    if (S.weak > 0) st.push('<span class="weak">' + t('statusWeak').replace('{n}', S.weak) + '</span>');
    if (S.poison > 0) st.push('<span class="poison">' + t('statusPoison').replace('{n}', S.poison) + '</span>');
    statusEl.innerHTML = st.join('');
  }

  /* ================= 覆盖层 ================= */
  function refreshOverlays() {
    hideOverlays();
    if (!S) return;
    if (S.phase === 'map') { buildMap(); mapOv.classList.remove('hidden'); }
    else if (S.phase === 'reward') { buildReward(); rewardOv.classList.remove('hidden'); }
    else if (S.phase === 'rest') { buildRest(); restOv.classList.remove('hidden'); }
    else if (S.phase === 'chest') { buildChest(); chestOv.classList.remove('hidden'); }
    else if (S.phase === 'event') { buildEvent(); eventOv.classList.remove('hidden'); }
    else if (S.phase === 'shop') { buildShop(); shopOv.classList.remove('hidden'); }
    else if (S.phase === 'win' || S.phase === 'lose') { buildResult(); resultOv.classList.remove('hidden'); }
  }

  function buildMap() {
    var rowsData = actRows(S.act);
    document.getElementById('dk-map-title').textContent = t('mapActTitle')
      .replace('{n}', S.act).replace('{m}', ACTS.length)
      .replace('{name}', cleanName(T('gs.deckbuilder.act' + S.act + '.n')));
    var rows = document.getElementById('dk-map-rows');
    rows.innerHTML = '';
    rowsData.forEach(function (row, ri) {
      var r = document.createElement('div');
      r.className = 'dk-map-row';
      row.forEach(function (node, ni) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dk-node n-' + node.type;
        if (ri < S.actFloor) b.classList.add('locked');
        if (ri === S.actFloor) b.classList.add('cur');
        var sub = '';
        if (node.type === 'battle') sub = T('gs.deckbuilder.enemy.' + node.enemy + '.n');
        else if (node.type === 'elite') sub = t('node.elite') + ' · ' + T('gs.deckbuilder.enemy.' + node.enemy + '.n');
        else if (node.type === 'rest') sub = t('restHeal').replace('{n}', Math.round(S.maxHp * restHealRatio()));
        else if (node.type === 'chest') sub = t('node.chest');
        else if (node.type === 'shop') sub = t('shopShort');
        else if (node.type === 'event') sub = t('eventSub');
        b.innerHTML = '<span class="dk-node-ic"></span><span class="dk-node-name">' + t('node.' + node.type) + '</span>' +
          '<span class="dk-node-sub">' + (ri < S.actFloor ? t('nodeCleared') : sub) + '</span>';
        if (ri === S.actFloor) b.addEventListener('click', function () { chooseNode(ri, ni); });
        else b.disabled = true;
        r.appendChild(b);
      });
      rows.appendChild(r);
    });
    var br = document.createElement('div');
    br.className = 'dk-map-row dk-map-boss';
    var bb = document.createElement('button');
    bb.type = 'button';
    var atBoss = S.actFloor >= rowsData.length;
    bb.className = 'dk-node n-boss' + (atBoss ? ' cur' : ' locked');
    var bname = T('gs.deckbuilder.' + BOSSES[actDef(S.act).bossIdx].key + '.n');
    bb.innerHTML = '<span class="dk-node-ic"></span><span class="dk-node-name">' + t('mapBoss') + '</span>' +
      '<span class="dk-node-sub">' + cleanName(bname) + (S.act === ACTS.length ? ' · ' + t('finalBossTag') : '') + '</span>';
    if (atBoss) bb.addEventListener('click', chooseBoss);
    else bb.disabled = true;
    br.appendChild(bb);
    rows.appendChild(br);
    document.getElementById('dk-map-deck').textContent = t('deckBtn').replace('{n}', S.deck.length);
    document.getElementById('dk-map-gold').textContent = t('hudGold') + ' ' + S.gold;
  }

  /* ================= 商店 UI ================= */
  function buildShop() {
    var sh = S.shop;
    if (!sh) return;
    document.getElementById('dk-shop-title').textContent = t('shopTitle');
    document.getElementById('dk-shop-sub').textContent = t('shopSub');
    document.getElementById('dk-shop-gold').textContent = t('shopGold').replace('{n}', S.gold);
    var grid = document.getElementById('dk-shop-grid');
    grid.innerHTML = '';
    sh.cards.forEach(function (it, i) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dk-shop-item' + (it.sold ? ' sold' : '');
      cell.disabled = !!it.sold || sh.removing;
      var spec = CARDS[it.key] || {};
      var rarity = t('rarity.' + (spec.rarity || 'common'));
      cell.innerHTML =
        '<span class="dk-shop-art r-' + (spec.rarity || 'common') + '"></span>' +
        '<span class="dk-shop-name">' + cleanName(cardName(it.key)) + '</span>' +
        '<span class="dk-shop-rarity">' + rarity + ' · ' + t('energyShort').replace('{n}', spec.cost || 0) + '</span>' +
        '<span class="dk-shop-desc">' + cardDesc(it.key) + '</span>' +
        '<span class="dk-shop-price">' + (it.sold ? t('shopSold') : t('shopPrice').replace('{n}', it.price)) + '</span>';
      cell.addEventListener('click', function () { shopBuyCard(i); });
      grid.appendChild(cell);
    });
    var relicWrap = document.getElementById('dk-shop-relic');
    relicWrap.innerHTML = '';
    if (sh.relic) {
      var rb = document.createElement('button');
      rb.type = 'button';
      rb.className = 'dk-shop-item dk-shop-relicitem' + (sh.relic.sold ? ' sold' : '');
      rb.disabled = !!sh.relic.sold || sh.removing;
      rb.innerHTML = '<span class="dk-shop-art relic"></span>' +
        '<span class="dk-shop-name">' + cleanName(T('gs.deckbuilder.relic.' + sh.relic.key + '.n')) + '</span>' +
        '<span class="dk-shop-desc">' + T('gs.deckbuilder.relic.' + sh.relic.key + '.d') + '</span>' +
        '<span class="dk-shop-price">' + (sh.relic.sold ? t('shopSold') : t('shopPrice').replace('{n}', sh.relic.price)) + '</span>';
      rb.addEventListener('click', shopBuyRelic);
      relicWrap.appendChild(rb);
    }
    var rmWrap = document.getElementById('dk-shop-remove');
    rmWrap.innerHTML = '';
    var rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'dk-shop-removebtn' + (sh.removed ? ' sold' : '');
    rmBtn.disabled = sh.removed;
    rmBtn.textContent = sh.removed ? t('shopRemoveDoneTag') : t('shopRemove').replace('{n}', sh.removePrice);
    rmBtn.onclick = shopRemoveMode;
    rmWrap.appendChild(rmBtn);
    var list = document.getElementById('dk-shop-decklist');
    list.innerHTML = '';
    if (sh.removing) {
      var hint = document.createElement('div');
      hint.className = 'dk-shop-deckhint';
      hint.textContent = t('shopRemovePick');
      list.appendChild(hint);
      var order = S.deck.map(function (k, i) { return { k: k, i: i }; });
      order.sort(function (a, b) {
        var sa = CARDS[a.k], sb = CARDS[b.k];
        return (sa ? sa.cost : 0) - (sb ? sb.cost : 0);
      });
      order.forEach(function (o) {
        var db = document.createElement('button');
        db.type = 'button';
        db.className = 'dk-shop-deckbtn';
        db.textContent = cleanName(cardName(o.k));
        db.addEventListener('click', function () { shopRemoveCard(o.i); });
        list.appendChild(db);
      });
    }
    document.getElementById('dk-shop-leave').textContent = t('shopLeave');
    document.getElementById('dk-shop-leave').onclick = leaveShop;
  }

  function buildReward() {
    var r = S.reward;
    if (!r) return;
    document.getElementById('dk-reward-title').textContent = r.elite ? t('rewardTitleElite') : t('rewardTitle');
    document.getElementById('dk-reward-sub').textContent =
      t('rewardHint') + (r.gold ? ' · ' + t('goldGot').replace('{n}', r.gold) : '');
    var relicEl = document.getElementById('dk-reward-relic');
    relicEl.textContent = r.relic ? t('relicAward').replace('{name}', cleanName(T('gs.deckbuilder.relic.' + r.relic + '.n'))) : '';
    var cards = document.getElementById('dk-reward-cards');
    cards.innerHTML = '';
    r.cards.forEach(function (key, i) {
      var el = makeCardEl(key, i, 'reward');
      el.addEventListener('click', function () { chooseReward(i); });
      cards.appendChild(el);
    });
    var skip = document.getElementById('dk-reward-skip');
    skip.textContent = t('rewardSkip').replace('{n}', r.skipGold);
    skip.onclick = skipReward;
  }

  function buildRest() {
    var o = S.rest || {};
    document.getElementById('dk-rest-title').textContent = t('restTitle');
    document.getElementById('dk-rest-sub').textContent = t('hudHp') + ' ' + S.hp + '/' + S.maxHp;
    var heal = document.getElementById('dk-rest-heal');
    heal.textContent = t('restHeal').replace('{n}', o.heal || 0);
    heal.disabled = S.hp >= S.maxHp;
    heal.onclick = function () { resolveRest('heal'); };
    var gold = document.getElementById('dk-rest-gold');
    gold.textContent = t('restGold').replace('{n}', o.gold || 0);
    gold.onclick = function () { resolveRest('gold'); };
  }

  function buildChest() {
    var o = S.rest || {};
    document.getElementById('dk-chest-title').textContent = t('chestTitle');
    document.getElementById('dk-chest-sub').textContent = o.relic ? '' : t('chestEmpty');
    var relic = document.getElementById('dk-chest-relic');
    if (o.relic) {
      relic.textContent = t('chestRelic').replace('{name}', cleanName(T('gs.deckbuilder.relic.' + o.relic + '.n')));
      relic.disabled = false;
      relic.onclick = function () { resolveChest('relic'); };
    } else {
      relic.textContent = t('chestEmpty');
      relic.disabled = true;
      relic.onclick = null;
    }
    var gold = document.getElementById('dk-chest-gold');
    gold.textContent = t('chestGold').replace('{n}', o.gold || 0);
    gold.onclick = function () { resolveChest('gold'); };
  }

  function buildEvent() {
    var key = S.event ? S.event.key : '';
    var ev = eventDef(key);
    if (!ev) return;
    document.getElementById('dk-event-title').textContent = cleanName(eventTitle(key));
    document.getElementById('dk-event-desc').textContent = T('gs.deckbuilder.event.' + key + '.d');
    var wrap = document.getElementById('dk-event-opts');
    wrap.innerHTML = '';
    ev.opts.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dk-event-opt';
      b.setAttribute('data-opt', String(i));
      var cost = opt.eff && opt.eff.goldCost ? opt.eff.goldCost : 0;
      if (cost && S.gold < cost) {
        b.disabled = true;
        b.classList.add('cant');
      }
      var n = document.createElement('span');
      n.className = 'dk-event-opt-n';
      n.textContent = eventOptionName(key, i);
      var d = document.createElement('span');
      d.className = 'dk-event-opt-d';
      d.textContent = eventOptionDesc(key, i) + (cost ? ' (' + t('shopGold').replace('{n}', cost) + ')' : '');
      b.appendChild(n); b.appendChild(d);
      b.addEventListener('click', function () { chooseEventOption(i); });
      wrap.appendChild(b);
    });
  }

  function buildResult() {
    var won = S.phase === 'win';
    document.getElementById('dk-result-title').textContent = won ? t('resultWin') : t('resultLose');
    document.getElementById('dk-result-msg').textContent = cleanName(S.msg || '');
    var rec = document.getElementById('dk-result-record');
    rec.textContent = S.newRecord ? t('resultNewRecord') : '';
    document.getElementById('dk-result-floors').textContent =
      t('resultProgress').replace('{a}', S.act).replace('{b}', S.actFloor).replace('{c}', actRows(S.act).length);
    document.getElementById('dk-result-score').textContent = String(S.score || 0);
    document.getElementById('dk-result-best').textContent = String(S.best || bestScore());
    document.getElementById('dk-result-gold').textContent = String(S.gold);
    document.getElementById('dk-again').onclick = function () { newRun(S.diff, S.cls); };
    document.getElementById('dk-change-diff').onclick = function () {
      hideOverlays();
      gameEl.classList.add('hidden');
      pickEl.classList.remove('hidden');
      pickedClass = S.cls;
      renderPick();
    };
  }

  function openDeck() {
    if (!S) return;
    var counts = {};
    var order = [];
    S.deck.forEach(function (k) {
      if (!counts[k]) { counts[k] = 0; order.push(k); }
      counts[k]++;
    });
    var title = document.getElementById('dk-deck-title');
    title.textContent = t('deckTitle').replace('{n}', S.deck.length);
    var list = document.getElementById('dk-deck-list');
    list.innerHTML = '';
    order.sort(function (a, b) {
      var sa = cardSpec(a), sb = cardSpec(b);
      return (sa ? sa.cost : 0) - (sb ? sb.cost : 0);
    });
    order.forEach(function (k) {
      var spec = cardSpec(k);
      var row = document.createElement('div');
      row.className = 'dk-deck-item';
      row.innerHTML = '<span><b class="c">' + (spec ? spec.cost : 0) + '</b> ' + cleanName(cardName(k)) +
        ' <span style="color:#6b6f85">· ' + cardDesc(k) + '</span></span><b class="c">×' + counts[k] + '</b>';
      list.appendChild(row);
    });
    hideOverlays();
    deckOv.classList.remove('hidden');
  }

  /* ================= 难度选择 ================= */
  function renderPick() {
    document.getElementById('dk-pick-title').textContent = t('diffTitle');
    document.getElementById('dk-pick-sub').textContent = t('diffSub');
    classTitleEl.textContent = t('clsTitle');
    pickHelp.textContent = t('helpText');
    pickBest.textContent = t('best').replace('{n}', bestScore());
    classGrid.innerHTML = '';
    ['warrior', 'warlock'].forEach(function (cls) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dk-class' + (cls === pickedClass ? ' sel' : '');
      b.setAttribute('data-cls', cls);
      var n = document.createElement('span');
      n.className = 'dk-class-n';
      var cname = cleanName(t('cls.' + cls + '.n'));
      n.textContent = cname;
      b.setAttribute('data-emblem', cname.charAt(0));
      var d = document.createElement('span');
      d.className = 'dk-class-d';
      d.textContent = t('cls.' + cls + '.d');
      b.appendChild(n); b.appendChild(d);
      b.addEventListener('click', function () {
        pickedClass = cls;
        renderPick();
        audio('ui');
      });
      classGrid.appendChild(b);
    });
    diffGrid.innerHTML = '';
    DIFF.forEach(function (d, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dk-diff' + (i === pickedDiff ? ' sel' : '');
      b.style.borderColor = i === pickedDiff ? 'var(--neon-yellow)' : '';
      b.innerHTML = '<span class="dk-diff-n">' + t('diff.' + d.key + '.n') + '</span>' +
        '<span class="dk-diff-d">' + t('diff.' + d.key + '.d') + '</span>';
      b.addEventListener('click', function () {
        pickedDiff = i;
        renderPick();
        audio('ui');
      });
      diffGrid.appendChild(b);
    });
    startBtn.textContent = t('newGame');
  }

  /* ================= Canvas 舞台 ================= */
  var ctx = stageCanvas.getContext('2d');
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  stageCanvas.width = STAGE_W * dpr;
  stageCanvas.height = STAGE_H * dpr;
  ctx.scale(dpr, dpr);
  var animT = 0;
  var colorCache = {};

  function cssColor(c) {
    if (!c) return '#ffe600';
    if (c.indexOf('var(') !== 0) return c;
    if (colorCache[c]) return colorCache[c];
    var name = c.slice(4, -1).trim();
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    colorCache[c] = v || '#ffe600';
    return colorCache[c];
  }

  function update(step) {
    animT += step;
    for (var i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= 0.022 * step;
      floats[i].y -= 0.75 * step;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    if (hitFlash > 0) hitFlash -= step;
    if (shakeT > 0) shakeT -= step;
  }

  function drawStage() {
    var W = STAGE_W, H = STAGE_H;
    ctx.clearRect(0, 0, W, H);
    var bg = ctx.createRadialGradient(W / 2, 74, 8, W / 2, 110, 260);
    bg.addColorStop(0, '#1a1038');
    bg.addColorStop(0.55, '#0b0d1d');
    bg.addColorStop(1, '#05070f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.55;
    for (var s = 0; s < 26; s++) {
      var sx = (Math.sin(s * 12.9898) * 43758.5453) % 1;
      var sy = (Math.sin(s * 78.233) * 12543.21) % 1;
      sx = Math.abs(sx); sy = Math.abs(sy);
      ctx.fillStyle = s % 5 === 0 ? 'rgba(255,230,0,0.5)' : 'rgba(160,190,255,0.35)';
      ctx.fillRect(sx * W, sy * 120, 1.5, 1.5);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(0,240,255,0.10)';
    ctx.lineWidth = 1;
    for (var gx = 14; gx < W; gx += 24) {
      ctx.beginPath(); ctx.moveTo(gx, 118); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (var gy = 124; gy < H; gy += 18) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    var e = S && S.enemy;
    var cx = W / 2;
    var bob = Math.sin(animT * 0.015) * 3;
    var groundY = 196;
    ctx.save();
    if (e && e.boss && e.phase > 0) {
      var rage = ctx.createRadialGradient(cx, 140, 10, cx, 140, 110);
      rage.addColorStop(0, 'rgba(255,45,149,0.24)');
      rage.addColorStop(1, 'rgba(255,45,149,0)');
      ctx.fillStyle = rage;
      ctx.fillRect(0, 40, W, 180);
    }
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 6, 74, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(185,103,255,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (e) {
      var sx2 = shakeT > 0 ? Math.sin(animT * 2.4) * Math.min(5, shakeT / 3) : 0;
      ctx.save();
      ctx.translate(cx + sx2, bob);
      drawEnemyArt(ctx, e, animT, groundY);
      if (hitFlash > 0) {
        ctx.globalAlpha = Math.min(0.55, hitFlash / 16);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, groundY - 58, 42, 56, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.block > 0) {
        drawShieldBadge(ctx, 62, groundY - 88, e.block);
      }
      ctx.restore();
      drawIntentBadge(ctx, e, cx, 72);
    } else {
      ctx.fillStyle = 'rgba(160,174,200,0.5)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('—', cx, 150);
    }
    ctx.restore();

    drawFloats(W, H);
  }

  function drawShieldBadge(g, x, y, n) {
    g.save();
    g.translate(x, y);
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 3 * i - Math.PI / 2;
      var xx = Math.cos(a) * 12, yy = Math.sin(a) * 14;
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.closePath();
    g.fillStyle = 'rgba(0,240,255,0.22)';
    g.fill();
    g.strokeStyle = 'rgba(0,240,255,0.85)';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#00f0ff';
    g.font = 'bold 11px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 0, 1);
    g.restore();
  }

  function drawIntentBadge(g, e, cx, y) {
    var it = e.intent;
    if (!it) return;
    var label = '';
    if (it.type === 'attack') label = String(it.value);
    else if (it.type === 'multi') label = it.value + '×' + it.hits;
    else if (it.type === 'defend') label = '+' + it.value;
    else if (it.type === 'buff') label = '+' + it.value;
    else if (it.type === 'debuff') label = '+' + it.value;
    else label = '×2';
    var w = 96;
    g.save();
    g.translate(cx, y);
    g.globalAlpha = 0.95;
    var bg2 = g.createLinearGradient(-w / 2, -13, w / 2, 13);
    bg2.addColorStop(0, 'rgba(8,10,22,0.9)');
    bg2.addColorStop(1, 'rgba(30,16,46,0.9)');
    g.fillStyle = bg2;
    roundedRect(g, -w / 2, -13, w, 26, 8);
    g.fill();
    g.strokeStyle = it.charged ? 'rgba(255,45,149,0.9)' : 'rgba(255,230,0,0.55)';
    g.lineWidth = 1.2;
    g.stroke();
    drawIntentIcon(g, it.type, -w / 2 + 16, 0, it.charged);
    g.fillStyle = it.charged ? '#ff2d95' : '#ffe600';
    g.font = 'bold 12px monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(label, -w / 2 + 30, 1);
    if (it.type === 'defend') {
      g.fillStyle = 'rgba(0,240,255,0.7)';
      g.font = '9px monospace';
      g.fillText(T('gs.deckbuilder.intent.defend'), -w / 2 + 52, 1);
    } else if (it.type === 'buff') {
      g.fillStyle = 'rgba(255,230,0,0.75)';
      g.font = '9px monospace';
      g.fillText(T('gs.deckbuilder.intent.buff'), -w / 2 + 52, 1);
    } else if (it.type === 'debuff') {
      g.fillStyle = 'rgba(255,45,149,0.8)';
      g.font = '9px monospace';
      g.fillText(T('gs.deckbuilder.intent.debuff'), -w / 2 + 52, 1);
    } else if (it.type === 'charge') {
      g.fillStyle = 'rgba(255,230,0,0.8)';
      g.font = '9px monospace';
      g.fillText(T('gs.deckbuilder.intent.charge'), -w / 2 + 52, 1);
    }
    g.restore();
  }

  function roundedRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawIntentIcon(g, type, x, y, charged) {
    g.save();
    g.translate(x, y);
    var col = charged ? '#ff2d95' : (type === 'attack' || type === 'multi' ? '#ff2d95' :
      type === 'defend' ? '#00f0ff' : type === 'buff' ? '#ffe600' :
      type === 'debuff' ? '#b967ff' : '#ffe600');
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = 2;
    if (type === 'attack' || type === 'multi') {
      var n = type === 'multi' ? 3 : 1;
      for (var i = 0; i < n; i++) {
        var off = (i - (n - 1) / 2) * 4;
        g.beginPath();
        g.moveTo(-5 + off, 7);
        g.lineTo(6 + off, -7);
        g.stroke();
        g.beginPath();
        g.moveTo(-6 + off, 4);
        g.lineTo(-1 + off, 8);
        g.stroke();
      }
    } else if (type === 'defend') {
      g.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 3 * k - Math.PI / 2;
        var xx = Math.cos(a) * 8, yy = Math.sin(a) * 9;
        if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.closePath();
      g.stroke();
    } else if (type === 'buff' || type === 'charge') {
      if (type === 'charge') {
        g.beginPath();
        g.moveTo(1, -9); g.lineTo(-6, 1); g.lineTo(-1, 1); g.lineTo(-3, 9);
        g.lineTo(7, -2); g.lineTo(2, -2); g.closePath();
        g.fill();
      } else {
        g.beginPath(); g.moveTo(0, -7); g.lineTo(7, 1); g.lineTo(2, 1); g.lineTo(2, 8);
        g.lineTo(-2, 8); g.lineTo(-2, 1); g.lineTo(-7, 1); g.closePath(); g.fill();
      }
    } else if (type === 'debuff') {
      g.beginPath(); g.moveTo(0, 8); g.lineTo(7, 0); g.lineTo(2, 0); g.lineTo(2, -7);
      g.lineTo(-2, -7); g.lineTo(-2, 0); g.lineTo(-7, 0); g.closePath(); g.fill();
    }
    g.restore();
  }

  /* ---- 程序化敌人立绘（无 emoji） ---- */
  function drawEnemyArt(g, e, T2, groundY) {
    var art = e.art || 'slime';
    var boss = e.boss;
    var s = boss ? 1.32 : 1;
    g.save();
    g.scale(s, s);
    var cy = (groundY - 50) / s;
    if (art === 'slime') {
      var grad = g.createRadialGradient(-14, cy - 26, 4, 0, cy, 58);
      grad.addColorStop(0, '#8dff7a');
      grad.addColorStop(0.5, '#1fb37a');
      grad.addColorStop(1, '#0a3a3a');
      g.fillStyle = grad;
      g.beginPath();
      var wob = Math.sin(T2 * 0.02) * 3;
      g.ellipse(0, cy + 4, 38 + wob, 36 - wob, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(57,255,20,0.5)';
      g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#062616';
      g.beginPath(); g.ellipse(-13, cy - 4, 5, 7, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(13, cy - 4, 5, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d8ffb0';
      g.beginPath(); g.arc(-11, cy - 6, 2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(15, cy - 6, 2, 0, Math.PI * 2); g.fill();
    } else if (art === 'crawler') {
      g.strokeStyle = 'rgba(255,45,149,0.65)';
      g.lineWidth = 2;
      for (var l = -1; l <= 1; l += 2) {
        for (var j = 0; j < 3; j++) {
          var lx = l * (18 + j * 10);
          g.beginPath();
          g.moveTo(lx * 0.4, cy + 10);
          g.lineTo(lx, cy + 4 + Math.sin(T2 * 0.03 + j) * 5);
          g.lineTo(lx + l * 12, cy + 26 + Math.cos(T2 * 0.03 + j) * 3);
          g.stroke();
        }
      }
      var cg = g.createLinearGradient(0, cy - 30, 0, cy + 26);
      cg.addColorStop(0, '#5b7cff'); cg.addColorStop(1, '#171a3c');
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(0, cy, 30, 24, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#00f0ff'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#ff2d95';
      g.beginPath(); g.arc(-9, cy - 4, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(9, cy - 4, 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,240,255,0.5)';
      g.beginPath(); g.moveTo(-20, cy + 4); g.lineTo(20, cy + 4); g.stroke();
    } else if (art === 'spider') {
      g.strokeStyle = 'rgba(185,103,255,0.75)';
      g.lineWidth = 2;
      for (var p = 0; p < 8; p++) {
        var ang = Math.PI * (0.16 + p * 0.1);
        var dir = p < 4 ? -1 : 1;
        var baseX = dir * 10;
        g.beginPath();
        g.moveTo(baseX, cy + 6);
        g.lineTo(dir * (28 + p % 2 * 8), cy + 16);
        g.lineTo(dir * (38 + p % 2 * 6), cy + 34 + Math.sin(T2 * 0.025 + p) * 4);
        g.stroke();
      }
      var spg = g.createRadialGradient(-8, cy - 10, 3, 0, cy, 34);
      spg.addColorStop(0, '#c78bff'); spg.addColorStop(1, '#2a0e3c');
      g.fillStyle = spg;
      g.beginPath(); g.ellipse(0, cy + 2, 26, 22, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff2d95'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#39ff14';
      [[-10, cy - 8], [10, cy - 8], [-16, cy - 1], [16, cy - 1]].forEach(function (pt) {
        g.beginPath(); g.arc(pt[0], pt[1], 3, 0, Math.PI * 2); g.fill();
      });
      g.beginPath();
      g.moveTo(-15, cy + 20); g.quadraticCurveTo(0, cy + 30, 15, cy + 20);
      g.strokeStyle = 'rgba(57,255,20,0.6)'; g.stroke();
    } else if (art === 'guard') {
      var gg = g.createLinearGradient(0, cy - 44, 0, cy + 38);
      gg.addColorStop(0, '#6d7a9c'); gg.addColorStop(0.5, '#2c3350'); gg.addColorStop(1, '#12162a');
      g.fillStyle = gg;
      g.beginPath();
      g.moveTo(-30, cy + 34); g.lineTo(-24, cy - 18); g.lineTo(-12, cy - 40);
      g.lineTo(12, cy - 40); g.lineTo(24, cy - 18); g.lineTo(30, cy + 34);
      g.closePath(); g.fill();
      g.strokeStyle = '#00f0ff'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.moveTo(-18, cy - 14); g.lineTo(0, cy - 26); g.lineTo(18, cy - 14);
      g.lineTo(0, cy - 8); g.closePath();
      g.fillStyle = 'rgba(0,240,255,0.28)'; g.fill();
      g.strokeStyle = '#00f0ff'; g.stroke();
      g.fillStyle = '#39ff14';
      g.beginPath(); g.ellipse(0, cy - 24, 9, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,240,255,0.55)';
      g.beginPath(); g.moveTo(-34, cy + 2); g.lineTo(-4, cy + 2); g.stroke();
      g.fillStyle = 'rgba(255,45,149,0.9)';
      g.fillRect(18, cy - 6, 10, 3);
    } else if (art === 'warden') {
      var wg = g.createLinearGradient(0, cy - 50, 0, cy + 40);
      wg.addColorStop(0, '#b967ff'); wg.addColorStop(1, '#160a28');
      g.fillStyle = wg;
      g.beginPath();
      g.moveTo(0, cy - 54); g.quadraticCurveTo(34, cy - 22, 30, cy + 40);
      g.lineTo(-30, cy + 40); g.quadraticCurveTo(-34, cy - 22, 0, cy - 54);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,45,149,0.6)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#0a0614';
      g.beginPath(); g.ellipse(0, cy - 26, 12, 16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#39ff14';
      g.beginPath(); g.arc(-5, cy - 28, 2.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(5, cy - 28, 2.5, 0, Math.PI * 2); g.fill();
      for (var bl = -1; bl <= 1; bl += 2) {
        g.strokeStyle = 'rgba(0,240,255,0.8)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(bl * 28, cy + 20);
        g.lineTo(bl * 44, cy - 20 + Math.sin(T2 * 0.02) * 3);
        g.stroke();
      }
    } else if (art === 'boss1') {
      g.fillStyle = 'rgba(255,45,149,0.12)';
      g.beginPath(); g.arc(0, cy - 6, 58, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,45,149,0.45)'; g.lineWidth = 2; g.stroke();
      var b1 = g.createLinearGradient(0, cy - 56, 0, cy + 42);
      b1.addColorStop(0, '#ff6ba8'); b1.addColorStop(0.5, '#5a1f45'); b1.addColorStop(1, '#120a18');
      g.fillStyle = b1;
      roundedRect(g, -36, cy - 52, 72, 92, 14); g.fill();
      g.strokeStyle = '#ff2d95'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#ffe600';
      g.beginPath(); g.ellipse(0, cy - 20, 16, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a0010';
      g.beginPath(); g.ellipse(0, cy - 20, 6, 4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,45,149,0.9)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-28, cy + 18); g.lineTo(-48, cy + 6); g.stroke();
      g.beginPath(); g.moveTo(28, cy + 18); g.lineTo(48, cy + 6); g.stroke();
      g.fillStyle = '#ff2d95';
      g.beginPath(); g.moveTo(0, cy - 62); g.lineTo(3, cy - 52); g.lineTo(0, cy - 46); g.lineTo(-3, cy - 52); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,230,0,0.7)';
      g.beginPath(); g.arc(0, cy - 52, 9, 0, Math.PI * 2); g.stroke();
    } else if (art === 'boss2') {
      g.fillStyle = 'rgba(0,240,255,0.08)';
      g.beginPath(); g.ellipse(0, cy, 58, 74, 0, 0, Math.PI * 2); g.fill();
      var b2 = g.createLinearGradient(0, cy - 54, 0, cy + 44);
      b2.addColorStop(0, '#8ba0c8'); b2.addColorStop(0.45, '#3e4b6e'); b2.addColorStop(1, '#0f1524');
      g.fillStyle = b2;
      roundedRect(g, -40, cy - 44, 80, 84, 10); g.fill();
      g.strokeStyle = '#00f0ff'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#070b16';
      roundedRect(g, -24, cy - 28, 48, 18, 4); g.fill();
      g.fillStyle = '#ff2d95';
      for (var k2 = 0; k2 < 3; k2++) {
        g.fillRect(-16 + k2 * 14, cy - 22, 8, 6);
      }
      g.fillStyle = '#00f0ff';
      g.beginPath(); g.arc(-34, cy + 26, 7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(34, cy + 26, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,240,255,0.7)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-44, cy + 6); g.lineTo(-54, cy - 16); g.stroke();
      g.beginPath(); g.moveTo(44, cy + 6); g.lineTo(54, cy - 16); g.stroke();
      g.fillStyle = 'rgba(255,230,0,0.85)';
      g.fillRect(-30, cy - 54, 60, 4);
    } else if (art === 'boss3') {
      g.fillStyle = 'rgba(185,103,255,0.14)';
      g.beginPath(); g.arc(0, cy, 64, 0, Math.PI * 2); g.fill();
      for (var ring = 0; ring < 3; ring++) {
        g.strokeStyle = 'rgba(185,103,255,' + (0.55 - ring * 0.14) + ')';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(0, cy, 34 + ring * 12, 18 + ring * 9, T2 * 0.001 + ring * 0.5, 0, Math.PI * 2);
        g.stroke();
      }
      var core = g.createRadialGradient(0, cy - 4, 2, 0, cy, 34);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.3, '#ffe600');
      core.addColorStop(0.65, '#b967ff');
      core.addColorStop(1, '#2a0b46');
      g.fillStyle = core;
      g.beginPath(); g.arc(0, cy, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff2d95'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,45,149,0.8)';
      for (var sp = 0; sp < 6; sp++) {
        var sa = sp * Math.PI / 3 + T2 * 0.0008;
        g.beginPath();
        g.moveTo(Math.cos(sa) * 42, cy + Math.sin(sa) * 30);
        g.lineTo(Math.cos(sa + 0.16) * 54, cy + Math.sin(sa + 0.16) * 40);
        g.lineTo(Math.cos(sa - 0.16) * 54, cy + Math.sin(sa - 0.16) * 40);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#05030a';
      g.beginPath(); g.ellipse(0, cy - 2, 11, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff2d95';
      g.beginPath(); g.arc(0, cy - 4, 4, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#ff2d95';
      g.beginPath(); g.arc(0, cy, 30, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawFloats(W, H) {
    var r = stageCanvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var sx = W / r.width, sy = H / r.height;
    for (var i = 0; i < floats.length; i++) {
      var f = floats[i];
      var x = (f.x - r.left) * sx, y = (f.y - r.top) * sy;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.font = 'bold ' + f.size + 'px monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = cssColor(f.color);
      ctx.fillText(f.text, x, y);
      ctx.restore();
    }
  }

  /* ================= 交互 ================= */
  function selectCard(idx) {
    if (!S || S.phase !== 'fight' || locked) return;
    var spec = cardSpec(S.hand[idx]);
    if (!spec) return;
    if (spec.unplayable) {
      setMsg(t('unplayable'), 'warn');
      audio('error');
      return;
    }
    if (S.energy < spec.cost) { denyCard(idx); return; }
    if (idx === sel && spec.type !== 'atk') {
      playCard(idx, true);
      return;
    }
    sel = idx;
    updateHandStates();
    if (hintEl) hintEl.textContent = hintText();
    audio('move');
  }

  function castSelected(enemySide) {
    if (!S || S.phase !== 'fight' || locked) return;
    if (sel < 0 || !S.hand[sel]) {
      setMsg(t('selectFirst'), 'info');
      return;
    }
    var spec = cardSpec(S.hand[sel]);
    if (!spec) return;
    if (S.energy < spec.cost) { denyCard(sel); return; }
    if (spec.type === 'atk' && !enemySide) {
      setMsg(t('hintAtkTarget'), 'info');
      return;
    }
    playCard(sel, true);
  }

  function flyCard(cardEl, target) {
    try {
      if (!cardEl || !target) return;
      var r = cardEl.getBoundingClientRect();
      var clone = cardEl.cloneNode(true);
      clone.classList.remove('sel', 'deny', 'cant', 'kb');
      clone.classList.add('dk-fly');
      clone.style.left = r.left + 'px';
      clone.style.top = r.top + 'px';
      clone.style.width = r.width + 'px';
      clone.style.height = r.height + 'px';
      document.body.appendChild(clone);
      var dx = target.x - (r.left + r.width / 2);
      var dy = target.y - (r.top + r.height / 2);
      void clone.offsetWidth;
      clone.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.38) rotate(9deg)';
      clone.style.opacity = '0.7';
      setTimeout(function () { if (clone.parentNode) clone.parentNode.removeChild(clone); }, 430);
    } catch (e) {}
  }

  handEl.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('.dk-card') : null;
    if (!el) return;
    var idx = parseInt(el.getAttribute('data-idx'), 10);
    if (isNaN(idx)) return;
    selectCard(idx);
  });

  stageEl.addEventListener('click', function (ev) {
    if (!S || S.phase !== 'fight' || locked) return;
    if (ev.target === stageCanvas || ev.target.closest('.dk-stage')) castSelected(true);
  });

  playerPanelEl.addEventListener('click', function () {
    castSelected(false);
  });

  endBtn.addEventListener('click', endTurn);
  deckBtn.addEventListener('click', openDeck);
  restartBtn.addEventListener('click', function () {
    if (S) newRun(S.diff, S.cls);
    else newRun(pickedDiff, pickedClass);
  });
  document.getElementById('dk-deck-close').addEventListener('click', function () {
    deckOv.classList.add('hidden');
    refreshOverlays();
  });
  document.getElementById('dk-map-deck').addEventListener('click', openDeck);
  document.getElementById('dk-draw-pile').addEventListener('click', function () {
    if (!S) return;
    toast(t('drawPile') + ' ' + S.draw.length + ' / ' + t('discardPile') + ' ' + S.discard.length + ' / ' + t('exhaustPile') + ' ' + S.exhaust.length, 'ok');
    audio('ui');
  });
  document.getElementById('dk-discard-pile').addEventListener('click', function () { audio('ui'); });
  document.getElementById('dk-exhaust-pile').addEventListener('click', function () { audio('ui'); });
  startBtn.addEventListener('click', function () { newRun(pickedDiff, pickedClass); });

  document.addEventListener('keydown', function (ev) {
    if (!started || !S || gameEl.classList.contains('hidden')) return;
    if (ev.key === 'Escape') {
      sel = -1;
      updateHandStates();
      if (hintEl) hintEl.textContent = hintText();
      return;
    }
    if (ev.code === 'Space' || ev.key === ' ') {
      if (S.phase === 'fight' && !locked) {
        ev.preventDefault();
        endTurn();
      }
      return;
    }
    if ((ev.key === 'e' || ev.key === 'E') && S.phase === 'fight') {
      ev.preventDefault();
      endTurn();
      return;
    }
    if (S.phase === 'fight' && !locked) {
      var dir = ev.key;
      if (dir === 'ArrowLeft' || dir === 'ArrowUp') {
        ev.preventDefault();
        if (S.hand.length) { sel = sel <= 0 ? S.hand.length - 1 : sel - 1; selectCard(sel); }
        return;
      }
      if (dir === 'ArrowRight' || dir === 'ArrowDown') {
        ev.preventDefault();
        if (S.hand.length) { sel = (sel + 1) % S.hand.length; selectCard(sel); }
        return;
      }
      if (dir === 'Enter') {
        if (sel >= 0 && S.hand[sel]) { ev.preventDefault(); castSelected(true); }
        return;
      }
      if (/^[1-9]$/.test(ev.key)) {
        var hi = Number(ev.key) - 1;
        if (S.hand[hi]) {
          ev.preventDefault();
          sel = hi;
          updateHandStates();
          playCard(hi, true);
        }
      }
    }
  });

  /* ================= QA 钩子（仅 ?qa=1） ================= */
  var QA_MODE = /(?:^|[?&])qa=1(?:&|$)/.test(window.location.search);
  function qaSnapshot() {
    if (!S) return { started: false };
    return {
      started: true, phase: S.phase, diff: S.diff, cls: S.cls, seed: S.seed,
      act: S.act, actFloor: S.actFloor, floor: S.floor,
      hp: S.hp, maxHp: S.maxHp, gold: S.gold, energy: S.energy, maxEnergy: S.maxEnergy,
      block: S.block, poison: S.poison, strength: S.strength, vuln: S.vuln, weak: S.weak,
      deck: S.deck.slice(), hand: S.hand.slice(), draw: S.draw.length, discard: S.discard.length,
      relics: S.relics.slice(), submitted: !!S.submitted, score: S.score || 0, best: bestScore(),
      event: S.event ? { key: S.event.key, title: eventTitle(S.event.key) } : null,
      enemy: S.enemy ? {
        name: enemyName(S.enemy), hp: S.enemy.hp, maxHp: S.enemy.maxHp,
        block: S.enemy.block, strength: S.enemy.strength || 0, vuln: S.enemy.vuln || 0,
        weak: S.enemy.weak || 0, intent: S.enemy.intent, phase: S.enemy.phase, boss: S.enemy.boss,
        charge: !!S.enemy.charge
      } : null,
      reward: S.reward ? { cards: S.reward.cards.slice(), gold: S.reward.gold, skipGold: S.reward.skipGold } : null,
      shop: S.shop ? JSON.parse(JSON.stringify(S.shop)) : null
    };
  }
  function qaGoNode(type) {
    if (!S) return false;
    var rows = actRows(S.act);
    closeOverlays();
    S.node = null; S.enemy = null; S.reward = null; S.rest = null; S.shop = null; S.event = null;
    S.phase = 'map';
    sel = -1; locked = false;
    var found = null;
    for (var r = S.actFloor; r < rows.length && !found; r++) {
      for (var i = 0; i < rows[r].length; i++) {
        if (rows[r][i].type === type) { found = { r: r, i: i }; break; }
      }
    }
    if (type === 'boss') {
      if (S.actFloor >= rows.length) { chooseBoss(); return S.phase === 'fight'; }
      S.actFloor = rows.length;
      S.floor = progressFloor();
      chooseBoss();
      return S.phase === 'fight';
    }
    if (!found) return false;
    S.actFloor = found.r;
    S.floor = progressFloor();
    chooseNode(found.r, found.i);
    return S.phase !== 'map';
  }
  function qaSetHp(n) {
    if (!S) return false;
    S.hp = clamp(Number(n) || 0, 0, S.maxHp);
    syncUI(); writeSave();
    return true;
  }
  function qaSetGold(n) {
    if (!S) return false;
    S.gold = Math.max(0, Number(n) || 0);
    syncUI(); writeSave();
    return true;
  }
  function qaSetAct(n) {
    if (!S) return false;
    S.act = clamp(Number(n) || 1, 1, ACTS.length);
    S.actFloor = 0;
    S.floor = progressFloor();
    S.phase = 'map'; S.node = null; S.enemy = null; S.reward = null; S.rest = null; S.shop = null; S.event = null;
    sel = -1; locked = false;
    closeOverlays();
    syncUI(); writeSave();
    return true;
  }
  function qaWinBattle() {
    if (!S || S.phase !== 'fight' || !S.enemy) return false;
    S.enemy.hp = 0;
    resolveVictory();
    return S.phase !== 'fight';
  }
  function qaForceWin() {
    if (!S) return false;
    if (S.phase === 'win') return true;
    if (!(S.phase === 'fight' && S.node && S.node.type === 'boss' && S.act === ACTS.length)) {
      S.act = ACTS.length;
      S.actFloor = actRows(S.act).length;
      startNode({ type: 'boss', act: S.act, row: actRows(S.act).length });
    }
    if (S.enemy) S.enemy.hp = 0;
    resolveVictory();
    return S.phase === 'win';
  }
  function qaForceLose() {
    if (!S) return false;
    if (S.phase === 'lose') return true;
    if (S.phase !== 'fight') {
      S.act = 1; S.actFloor = 0;
      startNode({ type: 'battle', enemy: 'slime', act: 1, row: 0 });
    }
    S.hp = 0;
    defeat();
    return S.phase === 'lose';
  }
  function qaSaveInfo() {
    var key = 'arcade_save_deckbuilder', raw = null;
    try { raw = window.localStorage.getItem(key); } catch (e) {}
    var parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e2) {} }
    return {
      key: key, exists: !!raw, bytes: raw ? raw.length : 0,
      phase: parsed ? parsed.phase : null,
      cls: parsed ? parsed.cls : null,
      seed: parsed ? parsed.seed : null,
      event: parsed && parsed.event ? parsed.event.key : null,
      act: parsed ? parsed.act : null,
      actFloor: parsed ? parsed.actFloor : null,
      deckCount: parsed && Array.isArray(parsed.deck) ? parsed.deck.length : 0,
      hp: parsed ? parsed.hp : null,
      gold: parsed ? parsed.gold : null,
      relics: parsed && Array.isArray(parsed.relics) ? parsed.relics.slice() : [],
      submitted: S ? !!S.submitted : false,
      score: S ? (S.score || 0) : 0,
      best: bestScore()
    };
  }
  function qaBossIntent() {
    if (!S || !S.enemy || !S.enemy.intent) return null;
    var it = S.enemy.intent;
    return { type: it.type, value: it.value, hits: it.hits, charged: !!it.charged, text: intentText(S.enemy) };
  }
  if (QA_MODE) {
    /* 自动化环境没有真实触屏手势，屏蔽震动避免 Chrome 控制台噪音 */
    try { if (navigator.vibrate) navigator.vibrate = function () { return false; }; } catch (e0) {}
    try { if (window.Arcade && Arcade.settings) Arcade.settings.set('haptic', false); } catch (e1) {}
    window.__qa = {
      state: qaSnapshot,
      start: function (diff, cls) {
        var idx = typeof diff === 'string' ? ['easy', 'normal', 'hard'].indexOf(diff.toLowerCase()) : Number(diff);
        newRun(clamp(Number(idx) || 0, 0, 2), cls === 'warlock' ? 'warlock' : 'warrior');
        return true;
      },
      goNode: qaGoNode,
      winBattle: qaWinBattle,
      loseBattle: qaForceLose,
      setHp: qaSetHp,
      setGold: qaSetGold,
      setAct: qaSetAct,
      shopBuy: function (i) { return shopBuyCard(i); },
      shopBuyRelic: function () { return shopBuyRelic(); },
      shopRemove: function (i) { return shopRemoveCard(i); },
      shopRemoveMode: function () { return shopRemoveMode(); },
      leaveShop: function () { leaveShop(); return true; },
      rewards: function () { return S && S.reward ? S.reward.cards.slice() : []; },
      chooseReward: function (i) { chooseReward(i); return true; },
      skipReward: function () { skipReward(); return true; },
      bossIntent: qaBossIntent,
      endTurn: function () { endTurn(); return true; },
      forceWin: qaForceWin,
      forceLose: qaForceLose,
      finish: function (won) { finalize(!!won); return true; },
      cards: function () { return Object.keys(CARDS).length; },
      cardPools: function () {
        return {
          common: COMMON_POOL.length, uncommon: UNCOMMON_POOL.length, rare: RARE_POOL.length,
          warlockCommon: WL_COMMON.length, warlockUncommon: WL_UNCOMMON.length, warlockRare: WL_RARE.length
        };
      },
      events: function () { return EVENTS.map(function (e) { return e.id; }); },
      chooseEvent: function (i) { return chooseEventOption(i); },
      saveInfo: qaSaveInfo,
      map: function () { return actRows(S ? S.act : 1); }
    };
  }

  window.GAME_RESTART = function () {
    clearTimers();
    clearSave();
    S = null; started = false; sel = -1; locked = false;
    floats = []; parts = []; hitFlash = 0; shakeT = 0;
    hideOverlays();
    gameEl.classList.add('hidden');
    pickEl.classList.remove('hidden');
    renderPick();
    if (window.Arcade && Arcade.juice) Arcade.juice.rotate();
  };

  /* ================= 启动 ================= */
  renderPick();
  showPick();

  var resumed = false;
  if (window.Arcade && Arcade.savegame) {
    try { resumed = Arcade.savegame.resume(); } catch (e) { resumed = false; }
  }
  if (!resumed) { S = null; started = false; showPick(); }

  try {
    loopApi = Arcade.loop.start(update, drawStage, 16);
  } catch (e) { loopApi = null; }

})();
