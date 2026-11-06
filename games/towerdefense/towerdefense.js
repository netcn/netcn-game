/* ============================================================
   塔防 Tower Defense（旗舰版）
   在重制版基础上增量升级：
   a) 30 波 + 第 10/20/30 波 Boss（护甲/召唤/护盾/减速免疫等机制）。
   b) 敌人类型：普通/快速/重甲/护盾/治疗/分裂/精英 + 3 种 Boss，各自绘制与行为。
   c) 6 种塔 × 3 级，2 级后选择分支（12 条），改变伤害/射程/攻速/特效。
   d) 波次分组错峰刷怪（spawnQueue 分组 + 间隔 + 场上上限）。
   e) 冰塔减速只刷新不叠加；毒伤层数上限 4（毒塔「叠层」分支 8）与持续时间上限。
   f) 存档沿用 arcade_save_towerdefense / arcade_best_towerdefense，并新增最高波次键。
   g) 双输入：点击/触控放塔选塔 + 键盘（1-6/方向键/Enter/U/S/空格）。
   h) Canvas 全自绘，保留粒子、屏幕抖动、命中闪白，新增连锁/穿透/冻结/新星特效。
   所有共享文件均未修改。
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.towerdefense.tut1t'), d: T('gs.towerdefense.tut1') },
  { t: T('gs.towerdefense.tut2t'), d: T('gs.towerdefense.tut2') },
  { t: T('gs.towerdefense.tut3t'), d: T('gs.towerdefense.tut3') },
  { t: T('gs.towerdefense.tut4t'), d: T('gs.towerdefense.tut4') },
  { t: T('gs.towerdefense.tut5t'), d: T('gs.towerdefense.tut5') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var W = 720, H = 460;
  var CELL = 20;
  var COLS = W / CELL, ROWS = H / CELL; // 36×23

  var MAX_WAVES = 30;
  var BOSS_WAVES = { 10: 'boss1', 20: 'boss2', 30: 'boss3' };
  function maxWaveLimit() { return MODE === 'endless' ? ENDLESS_CAP : MAX_WAVES; }
  /* 无尽 30 波之后每 10 波按 10/20/30 的 Boss 循环继续出场 */
  function bossKindForWave(w) {
    if (BOSS_WAVES[w]) return BOSS_WAVES[w];
    if (MODE === 'endless' && w > MAX_WAVES && w % 10 === 0) {
      var cyc = w % 30;
      return cyc === 10 ? 'boss1' : cyc === 20 ? 'boss2' : 'boss3';
    }
    return null;
  }
  var SLOW_MUL = 0.6;       // 冰塔：-40% 速度（只刷新覆盖，不叠加）
  var SLOW_FRAMES = 75;     // 1.2s @16ms
  var POISON_MAX_STACKS = 4;
  var POISON_FRAMES = 144;  // 2.4s 上限
  var POISON_TICK = 24;
  var POISON_DMG = 4;       // 每个 tick 每层 4 点（小伤害）
  var SPAWN_GAP = 18;       // 逐格入场间隔（组内由组数据覆盖）
  var SPAWN_GROUP_GAP = 54; // 组与组之间的缓冲
  var MAX_FIELD = 14;       // 同一时刻场上敌人上限
  var ARMOR_BREAK_FRAMES = 180;

  /* ---------- 路径（与旧版完全一致，保证存档/地图兼容） ---------- */
  var PATH = [], pathSet = {}, mapStyle = 'std';
  function buildPath(style) {
    style = style || mapStyle;
    PATH = [];
    var r, c = -1, dir = 1;
    var guard = 0;
    if (style === 'loop') {
      r = 2;
      while (guard++ < 4000) {
        while (c + 1 < COLS) { c += 1; PATH.push([r, c]); }
        while (r + 1 < ROWS - 4) { r += 1; PATH.push([r, c]); }
        while (c - 1 >= 0) { c -= 1; PATH.push([r, c]); }
        while (r + 1 < ROWS - 2) { r += 1; PATH.push([r, c]); }
        break;
      }
    } else {
      var stepV = style === 'snake' ? 2 : 3;
      r = style === 'snake' ? 2 : 4;
      while (guard++ < 2000) {
        while (c + dir >= 0 && c + dir < COLS) {
          c += dir;
          PATH.push([r, c]);
        }
        var moved = false;
        for (var v = 0; v < stepV; v++) {
          if (r + 1 >= ROWS - 3) break;
          r += 1;
          PATH.push([r, c]);
          moved = true;
        }
        if (!moved) break;
        dir = -dir;
      }
    }
    pathSet = {};
    PATH.forEach(function (p) { pathSet[p[0] + ',' + p[1]] = 1; });
    if (PATH.length < 30) { buildPath(style); }
  }

  var TOWERS = {
    bolt:    { cost: 15, dmg: 12, range: 65,  cd: 22, color: '#00f0ff', glow: '#7ffcff', speed: 9,  barrel: 12 },
    sniper:  { cost: 25, dmg: 30, range: 130, cd: 45, color: '#ff2d95', glow: '#ff9bd0', speed: 15, barrel: 18 },
    frost:   { cost: 20, dmg: 4,  range: 70,  cd: 30, color: '#4a8cff', glow: '#a8d4ff', speed: 8,  barrel: 10, slow: true },
    poison:  { cost: 22, dmg: 6,  range: 80,  cd: 26, color: '#39ff14', glow: '#b6ff9b', speed: 8,  barrel: 9,  poison: true },
    cannon:  { cost: 30, dmg: 18, range: 95,  cd: 40, color: '#ff9f1a', glow: '#ffd18a', speed: 7,  barrel: 13, splash: 26 },
    battery: { cost: 35, dmg: 55, range: 110, cd: 75, color: '#b967ff', glow: '#e0b3ff', speed: 11, barrel: 14 }
  };
  var TYPE_ORDER = ['bolt', 'sniper', 'frost', 'poison', 'cannon', 'battery'];
  var BEST_KEY = (Arcade.shell && Arcade.shell.gameId) || 'towerdefense';
  var BEST_WAVE_KEY = 'arcade_best_towerdefense_wave';
  var ENDLESS_BEST_KEY = 'arcade_best_towerdefense_endless';
  var META_KEY = 'arcade_meta_towerdefense';
  var ENDLESS_CAP = 9999;
  var MODE = 'campaign';                       // campaign=30 波战役 / endless=无尽

  /* ---------- 元进度（独立 localStorage 键，不占用共享层键） ---------- */
  var META_UNLOCKS = [
    { id: 'gold',  cost: 5,  n: 'gs.towerdefense.meta.gold.n',  d: 'gs.towerdefense.meta.gold.d' },
    { id: 'lives', cost: 6,  n: 'gs.towerdefense.meta.lives.n', d: 'gs.towerdefense.meta.lives.d' },
    { id: 'loop',  cost: 8,  n: 'gs.towerdefense.meta.loop.n',  d: 'gs.towerdefense.meta.loop.d' },
    { id: 'level', cost: 12, n: 'gs.towerdefense.meta.level.n', d: 'gs.towerdefense.meta.level.d' }
  ];
  function emptyMeta() { return { cores: 0, unlocked: {} }; }
  function readMeta() {
    try {
      var o = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      if (!o || typeof o !== 'object') return emptyMeta();
      return { cores: Math.max(0, Number(o.cores) || 0), unlocked: (o.unlocked && typeof o.unlocked === 'object') ? o.unlocked : {} };
    } catch (e) { return emptyMeta(); }
  }
  var meta = readMeta();
  function writeMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  }
  function metaHas(id) { return !!(meta.unlocked && meta.unlocked[id]); }
  function addCores(n) {
    if (!(n > 0)) return 0;
    meta.cores = Math.max(0, meta.cores + n);
    writeMeta();
    updateMetaPanel();
    return n;
  }

  /* ---------- 塔分支（2 级后选择，12 条） ---------- */
  var BRANCHES = {
    bolt: [
      { id: 'chain', n: 'gs.towerdefense.branch.bolt.chain.n', d: 'gs.towerdefense.branch.bolt.chain.d' },
      { id: 'overcharge', n: 'gs.towerdefense.branch.bolt.overcharge.n', d: 'gs.towerdefense.branch.bolt.overcharge.d' }
    ],
    sniper: [
      { id: 'pierce', n: 'gs.towerdefense.branch.sniper.pierce.n', d: 'gs.towerdefense.branch.sniper.pierce.d' },
      { id: 'crit', n: 'gs.towerdefense.branch.sniper.crit.n', d: 'gs.towerdefense.branch.sniper.crit.d' }
    ],
    frost: [
      { id: 'wide', n: 'gs.towerdefense.branch.frost.wide.n', d: 'gs.towerdefense.branch.frost.wide.d' },
      { id: 'freeze', n: 'gs.towerdefense.branch.frost.freeze.n', d: 'gs.towerdefense.branch.frost.freeze.d' }
    ],
    poison: [
      { id: 'stack', n: 'gs.towerdefense.branch.poison.stack.n', d: 'gs.towerdefense.branch.poison.stack.d' },
      { id: 'contagion', n: 'gs.towerdefense.branch.poison.contagion.n', d: 'gs.towerdefense.branch.poison.contagion.d' }
    ],
    cannon: [
      { id: 'cluster', n: 'gs.towerdefense.branch.cannon.cluster.n', d: 'gs.towerdefense.branch.cannon.cluster.d' },
      { id: 'shatter', n: 'gs.towerdefense.branch.cannon.shatter.n', d: 'gs.towerdefense.branch.cannon.shatter.d' }
    ],
    battery: [
      { id: 'beam', n: 'gs.towerdefense.branch.battery.beam.n', d: 'gs.towerdefense.branch.battery.beam.d' },
      { id: 'nova', n: 'gs.towerdefense.branch.battery.nova.n', d: 'gs.towerdefense.branch.battery.nova.d' }
    ]
  };

  /* 12 个分支的数值/特效实现函数（statsFor 调用） */
  function fxChain(st) { st.dmg *= 0.92; st.chain = 3; st.chainRange = 74; }
  function fxOvercharge(st) { st.dmg *= 1.55; st.cd *= 0.85; st.armorPierce = true; st.overcharge = true; }
  function fxPierce(st) { st.pierce = 1; st.pierceRange = 70; st.range += 20; }
  function fxCrit(st) { st.critChance = 0.35; st.critMul = 2.2; st.armorPierce = true; }
  function fxWideSlow(st) { st.slowRadius = 54; st.slowMul = 0.48; st.slowFrames = 96; st.dmg *= 0.7; st.range += 8; }
  function fxFreeze(st) { st.freezeFrames = 46; st.freezeChance = 0.55; st.dmg *= 1.25; }
  function fxStackPlus(st) { st.poisonStacks = 8; st.poisonFrames = 192; }
  function fxContagion(st) { st.contagionRadius = 64; st.poisonFrames = 168; }
  function fxCluster(st) { st.cluster = 2; st.splash = (st.splash || 26) + 14; st.dmg *= 0.82; }
  function fxShatter(st) { st.shatter = true; st.splash = (st.splash || 26) + 10; st.dmg *= 1.05; }
  function fxBeamBranch(st) { st.beam = true; st.dmg *= 0.72; st.cd *= 0.55; }
  function fxNovaBranch(st) { st.nova = 96; st.dmg *= 1.25; st.cd *= 1.3; }

  var BRANCH_FX = {
    bolt: { chain: fxChain, overcharge: fxOvercharge },
    sniper: { pierce: fxPierce, crit: fxCrit },
    frost: { wide: fxWideSlow, freeze: fxFreeze },
    poison: { stack: fxStackPlus, contagion: fxContagion },
    cannon: { cluster: fxCluster, shatter: fxShatter },
    battery: { beam: fxBeamBranch, nova: fxNovaBranch }
  };
  function branchMeta(type, id) {
    var list = BRANCHES[type] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function branchName(t) {
    var m = t && t.branch && branchMeta(t.type, t.branch);
    return m ? T(m.n) : '';
  }
  /* 塔的实际数值：基础 × 等级成长 + 分支修正 */
  function statsFor(t) {
    var base = TOWERS[t.type] || TOWERS.bolt;
    var lv = t.level || 1;
    var st = {
      level: lv,
      dmg: base.dmg * (1 + (lv - 1) * 0.7),
      range: base.range + (lv - 1) * 10,
      cd: base.cd,
      splash: base.splash || 0,
      speed: base.speed,
      barrel: base.barrel,
      color: base.color,
      glow: base.glow,
      slow: !!base.slow,
      poison: !!base.poison,
      poisonStacks: POISON_MAX_STACKS,
      poisonFrames: POISON_FRAMES,
      slowMul: SLOW_MUL,
      slowFrames: SLOW_FRAMES,
      chain: 0, chainRange: 0, pierce: 0, pierceRange: 0,
      critChance: 0, critMul: 1, armorPierce: false,
      slowRadius: 0, freezeFrames: 0, freezeChance: 0,
      contagionRadius: 0, cluster: 0, shatter: false,
      beam: false, nova: 0, overcharge: false
    };
    var fn = t.branch && BRANCH_FX[t.type] && BRANCH_FX[t.type][t.branch];
    if (fn) fn(st);
    return st;
  }

  /* ---------- 敌人定义（7 种常规/精英 + 3 种 Boss） ---------- */
  var ENEMY_DEFS = {
    normal:   { hpMul: 1,    speedMul: 1,    gold: 2,  armor: 0,    radius: 9,  color: '#ff2d95', dark: '#8a0d47' },
    fast:     { hpMul: 0.75, speedMul: 2.3,  gold: 3,  armor: 0,    radius: 7,  color: '#ffe600', dark: '#8a7a00' },
    tank:     { hpMul: 2.6,  speedMul: 0.95, gold: 6,  armor: 0.25, radius: 11, color: '#ff9f1a', dark: '#8a4a00' },
    shield:   { hpMul: 1.6,  speedMul: 1,    gold: 5,  armor: 0.1,  radius: 10, color: '#00f0ff', dark: '#007a8a', shield: 0.9 },
    healer:   { hpMul: 1.4,  speedMul: 1.05, gold: 7,  armor: 0.15, radius: 9,  color: '#b6ff9b', dark: '#2f7a1f', heal: true },
    splitter: { hpMul: 1.8,  speedMul: 0.9,  gold: 5,  armor: 0,    radius: 10, color: '#b967ff', dark: '#5a2a8a', split: true },
    split:    { hpMul: 0.5,  speedMul: 1.5,  gold: 2,  armor: 0,    radius: 6,  color: '#e0b3ff', dark: '#7a4aa8' },
    elite:    { hpMul: 3.6,  speedMul: 1.1,  gold: 12, armor: 0.4,  radius: 12, color: '#ff2d95', dark: '#5a0030', shield: 0.35, aura: '#ffd18a' },
    boss1:    { hpMul: 22,   speedMul: 0.55, gold: 80, armor: 0.35, radius: 19, color: '#ff9f1a', dark: '#5a2a00', boss: true, summon: 300 },
    boss2:    { hpMul: 28,   speedMul: 0.5,  gold: 120, armor: 0.1, radius: 20, color: '#00f0ff', dark: '#005a6a', boss: true, shield: 1.6, slowImmune: true, freezeImmune: true },
    boss3:    { hpMul: 32,   speedMul: 0.48, gold: 200, armor: 0.2,  radius: 22, color: '#b967ff', dark: '#3a0a6a', boss: true, summon: 300, shield: 0.4, slowImmune: true, enrage: true }
  };

  /* ---------- 状态 ---------- */
  var gold, wave, lives, kills, score, towers, enemies, bullets, floats, particles, rings, beams;
  var waveBanner, waveBannerTimer = 0;
  var spawnQueue, spawnTimer, spawnIdx, waveActive, over, won, paused, loopApi;
  var selectedType, selectedTower, hover, cursor, speedMul, baseFlash, sfxCd, bgCanvas;
  var scoreSubmitted = false, submitCount = 0, difficulty = 'normal', touchGuard = 0, cursorVisible = false;

  /* ---------- 敌人移动速度统一入口（减速不叠加；Boss 可免疫） ---------- */
  function effectiveSpeed(enemy) {
    var s = enemy.baseSpeed;
    if (enemy.frozenT > 0) return 0;
    if (enemy.slowT > 0) s *= (enemy.slowMul || SLOW_MUL); // 单一减速系数，只刷新覆盖
    return s;
  }

  /* ---------- 波次数据 ---------- */
  function enemySpec(kind, w) {
    var d = ENEMY_DEFS[kind] || ENEMY_DEFS.normal;
    var hp = Math.round((20 + w * 12) * d.hpMul);
    var sh = Math.round(hp * (d.shield || 0));
    return {
      kind: kind, hp: hp, maxHp: hp,
      baseSpeed: d.speedMul * (1 + w * 0.035),
      gold: d.gold, armor: d.armor || 0,
      shieldHp: sh, shieldMax: sh,
      boss: !!d.boss, summon: d.summon || 0,
      heal: !!d.heal, split: !!d.split,
      slowImmune: !!d.slowImmune, freezeImmune: !!d.freezeImmune,
      enrage: !!d.enrage, radius: d.radius,
      color: d.color, dark: d.dark, aura: d.aura || ''
    };
  }
  /* 每波分组：普通/快速/重甲/护盾/治疗/分裂/精英逐组错峰入场，Boss 单独入场 */
  function waveGroups(w) {
    var g = [];
    var boss = bossKindForWave(w);
    if (boss) {
      g.push({ kind: 'normal', count: 8 + w, gap: 15 });
      g.push({ kind: 'fast', count: 3 + Math.floor(w / 4), gap: 12 });
      if (w >= 20) g.push({ kind: 'shield', count: 4, gap: 22 });
      g.push({ kind: boss, count: 1, gap: 0, boss: true, delay: 80 });
      return g;
    }
    g.push({ kind: 'normal', count: 4 + Math.floor(w * 0.6), gap: 16 });
    if (w >= 3) g.push({ kind: 'fast', count: Math.floor(w * 0.32), gap: 10 });
    if (w >= 6) g.push({ kind: 'tank', count: Math.floor(w * 0.22), gap: 24 });
    if (w >= 9) g.push({ kind: 'shield', count: Math.floor(w * 0.16), gap: 22 });
    if (w >= 12) g.push({ kind: 'healer', count: Math.min(3, Math.floor(w * 0.1)), gap: 30 });
    if (w >= 15) g.push({ kind: 'splitter', count: Math.min(4, Math.floor(w * 0.12)), gap: 20 });
    if (w >= 18) g.push({ kind: 'elite', count: 1 + Math.floor((w - 18) / 6), gap: 40 });
    return g.filter(function (x) { return x.count > 0; });
  }
  function waveTotals(w) {
    var groups = waveGroups(w), total = 0, boss = null;
    groups.forEach(function (g) { total += g.count; if (g.boss) boss = g.kind; });
    return { total: total, boss: boss, groups: groups };
  }
  function nextWaveInfo() {
    if (MODE === 'campaign' && wave >= MAX_WAVES) return T('gs.towerdefense.allDone');
    var w = wave + 1;
    var info = waveTotals(w);
    if (info.boss) {
      return T('gs.towerdefense.nextBoss')
        .replace('{w}', w)
        .replace('{a}', info.total)
        .replace('{name}', T('gs.towerdefense.enemy.' + info.boss + '.n'));
    }
    var hp = Math.round(20 + w * 12);
    return T('gs.towerdefense.nextInfo').replace('{a}', info.total).replace('{b}', hp);
  }
  var bestWaveCache = -1;
  function readBestWave() {
    if (bestWaveCache >= 0) return bestWaveCache;
    try { bestWaveCache = Number(localStorage.getItem(BEST_WAVE_KEY) || 0) || 0; } catch (e) { bestWaveCache = 0; }
    return bestWaveCache;
  }
  function writeBestWave(n) {
    if (n > readBestWave()) {
      bestWaveCache = n;
      try { localStorage.setItem(BEST_WAVE_KEY, String(n)); } catch (e) {}
    }
  }
  var endlessBestCache = -1;
  function readEndlessBest() {
    if (endlessBestCache >= 0) return endlessBestCache;
    try { endlessBestCache = Number(localStorage.getItem(ENDLESS_BEST_KEY) || 0) || 0; } catch (e) { endlessBestCache = 0; }
    return endlessBestCache;
  }
  function writeEndlessBest(n) {
    if (n > readEndlessBest()) {
      endlessBestCache = n;
      try { localStorage.setItem(ENDLESS_BEST_KEY, String(n)); } catch (e) {}
    }
  }
  function currentBestWave() {
    return MODE === 'endless' ? readEndlessBest() : readBestWave();
  }
  function pathPx(idx) {
    var p = PATH[idx % PATH.length];
    return { x: p[1] * CELL + CELL / 2, y: p[0] * CELL + CELL / 2 };
  }
  function isPathCell(r, c) { return !!pathSet[r + ',' + c]; }
  function towerAt(r, c) {
    for (var i = 0; i < towers.length; i++) {
      var t = towers[i];
      if (Math.floor(t.x / CELL) === c && Math.floor(t.y / CELL) === r) return t;
    }
    return null;
  }
  function upCost(t) { return 16 + (t.level - 1) * 16; }
  function sellValue(t) { return Math.round((t.invested || TOWERS[t.type].cost) * 0.6); }
  function tname(type) { return T('gs.towerdefense.tower.' + type + '.n'); }
  function bestScore() {
    try { return (Arcade.storage && Arcade.storage.getBest(BEST_KEY)) || 0; } catch (e) { return 0; }
  }
  function audio(n) { if (Arcade.audio) Arcade.audio.play(n); }
  function shake() { if (Arcade.fx) Arcade.fx.shake(stageEl); }
  function fxBurst(x, y, color, n) {
    if (window.GK && GK.burst) { GK.burst(canvas, x, y, color, n); return; }
    if (!Arcade.fx) return;
    var r = canvas.getBoundingClientRect();
    Arcade.fx.burst(r.left + x * (r.width / W), r.top + y * (r.height / H), color, n);
  }

  /* ---------- DOM ---------- */
  // 触控目标 ≥44px（只作用于本游戏页面）
  var tdStyle = document.createElement('style');
  tdStyle.textContent =
    '.td-sel .btn{min-height:44px;min-width:44px;padding:8px 12px}' +
    '.td-tower{min-height:44px;min-width:44px}' +
    '.td-branches{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0;padding:8px;' +
    'border-radius:8px;background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.25)}' +
    '.td-branches.hidden{display:none}' +
    '.td-branch{flex:1 1 140px;min-height:44px;min-width:44px;display:flex;flex-direction:column;' +
    'gap:2px;align-items:center;justify-content:center;padding:6px 10px;line-height:1.25}' +
    '.td-branch b{font-size:12px;color:var(--neon-cyan)}' +
    '.td-branch small{font-size:10px;color:var(--text-dim);text-align:center}' +
    '.td-branch.unafford{opacity:.45}' +
    '.td-meta{margin:6px 0 4px;padding:8px 10px;border-radius:8px;background:rgba(185,103,255,0.07);' +
    'border:1px solid rgba(185,103,255,0.28);text-align:left}' +
    '.td-meta.hidden{display:none}' +
    '.td-meta-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;' +
    'color:var(--text-dim);letter-spacing:.04em;margin-bottom:6px}' +
    '.td-meta-head b{font-family:var(--font-mono);font-size:14px;color:var(--neon-yellow)}' +
    '.td-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}' +
    '.td-meta-btn{min-height:44px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;' +
    'gap:1px;padding:5px 8px;text-align:left;line-height:1.25}' +
    '.td-meta-btn b{font-size:11px;color:var(--neon-cyan)}' +
    '.td-meta-btn small{font-size:9px;color:var(--text-dim);line-height:1.3}' +
    '.td-meta-btn em{font-style:normal;font-family:var(--font-mono);font-size:9px;color:var(--neon-yellow)}' +
    '.td-meta-btn.owned{border-color:rgba(57,255,20,.5);opacity:.85}' +
    '.td-meta-btn.owned b{color:var(--neon-green)}' +
    '.mode-btn.locked{opacity:.55;border-style:dashed}' +
    '@media (max-width:480px){.td-branch{flex:1 1 120px}.td-branch small{font-size:9px}' +
    '.td-meta-grid{grid-template-columns:1fr 1fr}.td-meta-btn small{font-size:8.5px}}' +
    '@media (max-width:360px){.td-meta-grid{grid-template-columns:1fr}' +
    '.td-meta-btn{min-height:40px}.td-meta-btn small{font-size:9.5px}}';
  document.head.appendChild(tdStyle);

  var wrap = document.createElement('div');
  wrap.className = 'td-wrap';
  wrap.innerHTML =
    '<div class="mode-row" id="td-mode">' +
    '  <button class="btn mode-btn selected" data-mode="campaign">' + T('gs.towerdefense.modeCampaign') + '</button>' +
    '  <button class="btn mode-btn" data-mode="endless">' + T('gs.towerdefense.modeEndless') + '</button>' +
    '</div>' +
    '<div class="td-meta" id="td-meta">' +
    '  <div class="td-meta-head"><span>' + T('gs.towerdefense.metaTitle') + '</span><b id="td-meta-cores">0</b></div>' +
    '  <div class="td-meta-grid" id="td-meta-grid"></div>' +
    '</div>' +
    '<div class="mode-row" id="td-map">' +
    '  <button class="btn mode-btn selected" data-map="std">' + T('gs.towerdefense.mapStd') + '</button>' +
    '  <button class="btn mode-btn" data-map="snake">' + T('gs.towerdefense.mapSnake') + '</button>' +
    '  <button class="btn mode-btn" data-map="loop">' + T('gs.towerdefense.mapLoop') + '</button>' +
    '</div>' +
    '<div class="td-top">' +
    '  <span>' + T('gs.towerdefense.gold') + ' <b id="td-gold">80</b></span>' +
    '  <span>' + T('gs.towerdefense.waveLbl').replace('{n}', '<b id="td-wave">0</b>') + '</span>' +
    '  <span>' + T('gs.towerdefense.lives') + ' <b id="td-lives">20</b></span>' +
    '  <span>' + T('gs.towerdefense.kills') + ' <b id="td-kills">0</b></span>' +
    '  <span>' + T('gs.towerdefense.score') + ' <b id="td-score">0</b></span>' +
    '  <span>' + T('gs.towerdefense.next') + ': <b id="td-next"></b></span>' +
    '  <span>' + T('gs.towerdefense.bestWave') + ' <b id="td-bestwave">0</b></span>' +
    '</div>' +
    '<div class="td-tray" id="td-tray">' +
    TYPE_ORDER.map(function (tp) {
      var s = TOWERS[tp];
      return '<button class="td-tower' + (tp === 'bolt' ? ' sel' : '') + '" data-t="' + tp + '">' +
        '<i class="td-dot" style="background:' + s.color + ';box-shadow:0 0 6px ' + s.color + '"></i>' +
        T('gs.towerdefense.tower.' + tp + '.n') + ' <b>' + s.cost + '</b></button>';
    }).join('') +
    '</div>' +
    '<div class="td-stage" id="td-stage">' +
    '  <canvas class="td-canvas" id="td-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '  <div class="td-wave-banner" id="td-wave-banner"></div>' +
    '  <div class="td-over hidden" id="td-pause-over">' +
    '    <div class="td-card">' +
    '      <div class="td-title">' + T('gs.towerdefense.pauseTitle') + '</div>' +
    '      <div class="td-hint">' + T('gs.towerdefense.pauseHint') + '</div>' +
    '      <button class="btn green" id="td-resume">' + T('gs.towerdefense.resume') + '</button>' +
    '      <button class="btn" id="td-pause-restart">' + T('gs.towerdefense.restart') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="td-over hidden" id="td-result">' +
    '    <div class="td-card">' +
    '      <div class="td-title" id="td-res-title"></div>' +
    '      <div class="td-res-stats">' +
    '        <span><span id="td-res-wave-lbl">' + T('gs.towerdefense.wavesSurvived') + '</span> <b id="td-res-wave">0</b></span>' +
    '        <span>' + T('gs.towerdefense.kills') + ' <b id="td-res-kills">0</b></span>' +
    '        <span>' + T('gs.towerdefense.score') + ' <b id="td-res-score">0</b></span>' +
    '        <span>' + T('gs.towerdefense.best') + ' <b id="td-res-best">0</b></span>' +
    '        <span>' + T('gs.towerdefense.bestWave') + ' <b id="td-res-bestwave">0</b></span>' +
    '        <span class="hidden" id="td-res-ebest-row">' + T('gs.towerdefense.endlessBest') + ' <b id="td-res-ebest">0</b></span>' +
    '      </div>' +
    '      <button class="btn green" id="td-again">' + T('gs.towerdefense.restart') + '</button>' +
    '      <button class="btn purple" id="td-next-map">' + T('gs.towerdefense.changeMap') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="td-msg" id="td-msg">' + T('gs.towerdefense.msgStart') + '</div>' +
    '<div class="td-sel hidden" id="td-sel">' +
    '  <span id="td-sel-name"></span>' +
    '  <button class="btn green" id="td-up">' + T('gs.towerdefense.upgrade') + ' <b id="td-up-c"></b></button>' +
    '  <button class="btn yellow" id="td-sell">' + T('gs.towerdefense.sell') + ' +<b id="td-sell-v"></b></button>' +
    '  <button class="btn" id="td-desel">' + T('gs.towerdefense.deselect') + '</button>' +
    '</div>' +
    '<div class="td-branches hidden" id="td-branches">' +
    '  <button class="btn td-branch" data-b="0"><b class="td-bn"></b><small class="td-bd"></small></button>' +
    '  <button class="btn td-branch" data-b="1"><b class="td-bn"></b><small class="td-bd"></small></button>' +
    '</div>' +
    '<div class="game-controls">' +
    '  <button class="btn yellow" id="td-start">' + T('gs.towerdefense.startWave').replace('{n}', '1') + '</button>' +
    '  <button class="btn green" id="td-pause">' + T('gs.towerdefense.pause') + '</button>' +
    '  <button class="btn purple" id="td-speed">2x</button>' +
    '  <button class="btn" id="td-restart">' + T('gs.towerdefense.restart') + '</button>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#td-canvas');
  var ctx;
  if (window.GK) ctx = GK.setup(canvas, W, H).ctx;
  else { ctx = canvas.getContext('2d'); if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas); }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = W + 'px';

  var stageEl = wrap.querySelector('#td-stage');
  var goldEl = wrap.querySelector('#td-gold'), waveEl = wrap.querySelector('#td-wave'),
      livesEl = wrap.querySelector('#td-lives'), killsEl = wrap.querySelector('#td-kills'),
      scoreEl = wrap.querySelector('#td-score'), nextEl = wrap.querySelector('#td-next'),
      bestWaveEl = wrap.querySelector('#td-bestwave'),
      msgEl = wrap.querySelector('#td-msg'), startBtn = wrap.querySelector('#td-start'),
      pauseBtn = wrap.querySelector('#td-pause'), speedBtn = wrap.querySelector('#td-speed'),
      restartBtn = wrap.querySelector('#td-restart'), tray = wrap.querySelector('#td-tray'),
      mapRow = wrap.querySelector('#td-map'), modeRow = wrap.querySelector('#td-mode'),
      metaPanel = wrap.querySelector('#td-meta'), metaCoresEl = wrap.querySelector('#td-meta-cores'),
      metaGrid = wrap.querySelector('#td-meta-grid'),
      pauseEl = wrap.querySelector('#td-pause-over'), resultEl = wrap.querySelector('#td-result'),
      resTitle = wrap.querySelector('#td-res-title'),
      resWave = wrap.querySelector('#td-res-wave'), resKills = wrap.querySelector('#td-res-kills'),
      resScore = wrap.querySelector('#td-res-score'), resBest = wrap.querySelector('#td-res-best'),
      resBestWave = wrap.querySelector('#td-res-bestwave'),
      resWaveLbl = wrap.querySelector('#td-res-wave-lbl'),
      resEbestRow = wrap.querySelector('#td-res-ebest-row'), resEbest = wrap.querySelector('#td-res-ebest'),
      selPanel = wrap.querySelector('#td-sel'), selName = wrap.querySelector('#td-sel-name'),
      upBtn = wrap.querySelector('#td-up'), upCostEl = wrap.querySelector('#td-up-c'),
      sellBtn = wrap.querySelector('#td-sell'), sellValEl = wrap.querySelector('#td-sell-v'),
      branchesEl = wrap.querySelector('#td-branches');
  waveBanner = wrap.querySelector('#td-wave-banner');

  function showWaveBanner(main, sub, color, ms) {
    if (!waveBanner) return;
    waveBanner.style.color = color || 'var(--neon-yellow)';
    waveBanner.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    waveBanner.classList.remove('show');
    void waveBanner.offsetWidth;
    waveBanner.classList.add('show');
    clearTimeout(waveBannerTimer);
    waveBannerTimer = setTimeout(function () { waveBanner.classList.remove('show'); }, ms || 2000);
  }

  /* ---------- 存档（保持旧字段，兼容旧档） ---------- */
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function normalizeTower(t) {
    var spec = TOWERS[t.type] || TOWERS.bolt;
    var lv = Math.max(1, Math.min(3, t.level || 1));
    t.level = lv;
    if (lv < 3) t.branch = null;                       // 分支只在 3 级生效
    t.branch = t.branch && branchMeta(t.type, t.branch) ? t.branch : null;
    t.range = statsFor(t).range;
    t.invested = t.invested || (spec.cost + (lv - 1) * 16);
    t.cd = 0;
    t.angle = typeof t.angle === 'number' ? t.angle : 0;
    t.muzzle = 0;
    return t;
  }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'towerdefense',
      collect: function () {
        if (over) return null;
        return {
          gold: gold, wave: wave, lives: lives, kills: kills, score: score,
          towers: towers, mapStyle: mapStyle, selectedType: selectedType,
          bestWave: readBestWave(), difficulty: difficulty, mode: MODE
        };
      },
      apply: function (s) {
        if (!s || typeof s.gold !== 'number' || typeof s.wave !== 'number' || !Array.isArray(s.towers)) return false;
        MODE = s.mode === 'endless' ? 'endless' : 'campaign';
        gold = s.gold; wave = Math.min(maxWaveLimit(), s.wave); lives = s.lives; kills = s.kills || 0;
        score = typeof s.score === 'number' ? s.score : kills * 10;
        towers = s.towers.map(normalizeTower);
        enemies = []; bullets = []; floats = []; particles = []; rings = []; beams = [];
        spawnQueue = []; spawnTimer = 0; spawnIdx = 0; scoreSubmitted = false;
        waveActive = false; over = false; won = false; paused = false;
        selectedTower = null; speedMul = 1; baseFlash = 0; cursor = null;
        selectedType = s.selectedType || 'bolt';
        mapStyle = s.mapStyle || 'std';
        difficulty = s.difficulty || 'normal';
        buildPath(mapStyle);
        buildBackground();
        syncMapButtons();
        syncModeButtons();
        syncTray();
        hideOverlays();
        updateMetaPanel();
        setMetaVisible(wave === 0);
        startBtn.disabled = false;
        startBtn.textContent = wave >= maxWaveLimit() ? T('gs.towerdefense.allDone') : T('gs.towerdefense.startWave').replace('{n}', wave + 1);
        speedBtn.textContent = '1x';
        msgEl.textContent = T('gs.towerdefense.msgStart');
        msgEl.style.color = '';
        updateHud();
        return true;
      }
    });
  }

  /* ---------- 初始化 ---------- */
  function reset() {
    clearSave();
    gold = 80 + (metaHas('gold') ? 20 : 0);
    wave = 0;
    lives = 20 + (metaHas('lives') ? 3 : 0);
    kills = 0; score = 0;
    towers = []; enemies = []; bullets = []; floats = []; particles = []; rings = []; beams = [];
    spawnQueue = []; spawnTimer = 0; spawnIdx = 0; waveActive = false;
    over = false; won = false; paused = false; scoreSubmitted = false; submitCount = 0;
    selectedTower = null; selectedType = 'bolt'; speedMul = 1;
    hover = null; cursor = null; cursorVisible = false; baseFlash = 0; sfxCd = 0;
    difficulty = 'normal';
    buildPath(mapStyle);
    buildBackground();
    hideOverlays();
    syncMapButtons();
    syncModeButtons();
    syncTray();
    updateMetaPanel();
    setMetaVisible(true);
    msgEl.textContent = T('gs.towerdefense.msgStart');
    msgEl.style.color = '';
    startBtn.disabled = false;
    startBtn.textContent = T('gs.towerdefense.startWave').replace('{n}', '1');
    speedBtn.textContent = '1x';
    speedBtn.classList.remove('on');
    updateHud();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  function hideOverlays() {
    pauseEl.classList.add('hidden');
    resultEl.classList.add('hidden');
    if (Arcade.ui) Arcade.ui.setGamePhase('playing');
    var ctrl = document.querySelector('.td-wrap .game-controls');
    if (ctrl) ctrl.classList.remove('is-hidden');
  }
  function syncMapButtons() {
    updateLoopLock();
    var bs = mapRow.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('selected', bs[i].getAttribute('data-map') === mapStyle);
    }
  }
  function updateLoopLock() {
    var b = mapRow.querySelector('button[data-map="loop"]');
    if (!b) return;
    var locked = !metaHas('loop');
    b.classList.toggle('locked', locked);
    b.textContent = T('gs.towerdefense.mapLoop') + (locked ? ' · ' + T('gs.towerdefense.locked') : '');
  }
  function syncModeButtons() {
    var bs = modeRow.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('selected', bs[i].getAttribute('data-mode') === MODE);
    }
  }
  function updateMetaPanel() {
    if (!metaPanel) return;
    metaCoresEl.textContent = String(meta.cores);
    metaGrid.innerHTML = META_UNLOCKS.map(function (u) {
      var owned = metaHas(u.id);
      return '<button class="btn td-meta-btn' + (owned ? ' owned' : '') + '" data-u="' + u.id + '"' +
        (owned ? ' disabled' : '') + '>' +
        '<b>' + T(u.n) + '</b><small>' + T(u.d) + '</small>' +
        '<em>' + (owned ? T('gs.towerdefense.metaUnlocked') : T('gs.towerdefense.metaCost').replace('{n}', u.cost)) + '</em>' +
        '</button>';
    }).join('');
  }
  function setMetaVisible(on) {
    if (metaPanel) metaPanel.classList.toggle('hidden', !on);
  }
  function metaUnlock(id) {
    var u = null;
    for (var i = 0; i < META_UNLOCKS.length; i++) if (META_UNLOCKS[i].id === id) u = META_UNLOCKS[i];
    if (!u || metaHas(id)) return false;
    if (meta.cores < u.cost) {
      msgEl.textContent = T('gs.towerdefense.metaNoCores').replace('{n}', u.cost);
      msgEl.style.color = 'var(--neon-pink)';
      audio('error');
      return false;
    }
    meta.cores -= u.cost;
    meta.unlocked[id] = 1;
    writeMeta();
    updateMetaPanel();
    reset();
    msgEl.textContent = T('gs.towerdefense.metaUnlockedMsg').replace('{name}', T(u.n));
    msgEl.style.color = 'var(--neon-green)';
    audio('coin');
    return true;
  }
  function syncTray() {
    var bs = tray.querySelectorAll('.td-tower');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.toggle('sel', bs[i].getAttribute('data-t') === selectedType);
    }
  }

  /* ---------- 地图背景（静态缓存，避免整盘重建 DOM / 每帧重绘砖块） ---------- */
  function buildBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W; bgCanvas.height = H;
    var b = bgCanvas.getContext('2d');
    var g = b.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#08120d'); g.addColorStop(0.6, '#0a0f18'); g.addColorStop(1, '#0c0a16');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    // 网格
    b.strokeStyle = 'rgba(57,255,20,0.05)'; b.lineWidth = 1;
    b.beginPath();
    for (var x = 0; x <= W; x += CELL * 2) { b.moveTo(x, 0); b.lineTo(x, H); }
    for (var y = 0; y <= H; y += CELL * 2) { b.moveTo(0, y); b.lineTo(W, y); }
    b.stroke();
    // 路径地砖
    PATH.forEach(function (p, i) {
      var px = p[1] * CELL, py = p[0] * CELL;
      var tg = b.createLinearGradient(px, py, px, py + CELL);
      tg.addColorStop(0, i % 2 ? '#4c3d23' : '#55452a');
      tg.addColorStop(1, i % 2 ? '#2e2513' : '#352a17');
      b.fillStyle = tg;
      b.fillRect(px, py, CELL, CELL);
      b.strokeStyle = 'rgba(255,220,150,0.13)';
      b.lineWidth = 1;
      b.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      b.fillStyle = 'rgba(255,235,190,0.08)';
      b.fillRect(px + 4, py + 5, 2, 2);
      b.fillRect(px + 13, py + 14, 2, 2);
      // 方向箭头
      if (i % 6 === 0 && i < PATH.length - 1) {
        var np = PATH[i + 1];
        var dx = np[1] - p[1], dy = np[0] - p[0];
        var cx = px + CELL / 2, cy = py + CELL / 2;
        b.save();
        b.translate(cx, cy);
        b.rotate(Math.atan2(dy, dx));
        b.fillStyle = 'rgba(255,230,150,0.35)';
        b.beginPath();
        b.moveTo(5, 0); b.lineTo(-2, -3.5); b.lineTo(-2, 3.5);
        b.closePath(); b.fill();
        b.restore();
      }
    });
  }

  /* ---------- 波次 ---------- */
  function startWave() {
    if (over || paused || waveActive) return;
    if (wave >= maxWaveLimit()) return;
    if (enemies.length) return;
    wave++;
    waveActive = true;
    setMetaVisible(false);
    var groups = waveGroups(wave);
    spawnQueue = groups.map(function (g) {
      return { kind: g.kind, left: g.count, gap: g.gap, boss: !!g.boss };
    });
    spawnIdx = 0;
    spawnTimer = (groups[0] && groups[0].delay) || SPAWN_GAP;
    var info = waveTotals(wave);
    startBtn.disabled = true;
    startBtn.textContent = T('gs.towerdefense.defending');
    msgEl.textContent = T('gs.towerdefense.waveComing').replace('{n}', wave);
    msgEl.style.color = 'var(--neon-yellow)';
    if (info.boss) {
      showWaveBanner(
        T('gs.towerdefense.bossIncoming').replace('{name}', T('gs.towerdefense.enemy.' + info.boss + '.n')),
        T('gs.towerdefense.waveSub').replace('{n}', info.total),
        'var(--neon-pink)', 2400);
      if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
      shake();
    } else {
      showWaveBanner(T('gs.towerdefense.waveComing').replace('{n}', wave),
        T('gs.towerdefense.waveSub').replace('{n}', info.total), 'var(--neon-yellow)', 2100);
    }
    audio('ui');
    writeSave();
    updateHud();
  }

  function spawnEnemyAt(spec, pathIdx) {
    var p = pathPx(pathIdx || 0);
    var e = {
      kind: spec.kind,
      x: p.x, y: p.y, pathIdx: pathIdx || 0,
      hp: spec.hp, maxHp: spec.maxHp,
      baseSpeed: spec.baseSpeed, gold: spec.gold, armor: spec.armor || 0,
      shieldHp: spec.shieldHp || 0, shieldMax: spec.shieldMax || 0, shieldCd: 0,
      slowT: 0, slowMul: SLOW_MUL, frozenT: 0,
      poisonStacks: 0, poisonT: 0, poisonTick: 0,
      armorBreakT: 0, flash: 0, spawnAnim: 18, angle: Math.PI / 2, alive: true,
      boss: !!spec.boss, summonCd: spec.summon || 0, healCd: 70,
      slowImmune: !!spec.slowImmune, freezeImmune: !!spec.freezeImmune,
      enrage: !!spec.enrage, radius: spec.radius,
      color: spec.color, dark: spec.dark, aura: spec.aura
    };
    enemies.push(e);
    return e;
  }
  /* 分组错峰入场：组内按 gap，组间 SPAWN_GROUP_GAP，Boss 组额外延迟 */
  function spawnNext() {
    if (spawnIdx >= spawnQueue.length) return false;
    if (enemies.length >= MAX_FIELD) return false; // 场上数量上限
    var g = spawnQueue[spawnIdx];
    if (!g || g.left <= 0) { spawnIdx++; return false; }
    spawnEnemyAt(enemySpec(g.kind, wave), 0);
    g.left--;
    if (g.left <= 0) {
      spawnIdx++;
      if (spawnIdx < spawnQueue.length) {
        spawnTimer = SPAWN_GROUP_GAP + (spawnQueue[spawnIdx].boss ? 82 : 0);
      }
    } else {
      spawnTimer = g.gap;
    }
    return true;
  }

  /* ---------- 战斗 ---------- */
  function addFloat(x, y, text, color) {
    floats.push({ x: x, y: y, text: text, color: color, life: 1, vy: -0.9 });
    if (floats.length > 50) floats.shift();
  }
  function addParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.6;
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, size: 1.2 + Math.random() * 2.2, color: color
      });
    }
  }
  function addRing(x, y, color, maxR, delay) {
    rings.push({ x: x, y: y, r: 3, maxR: maxR || 24, life: 1, color: color || '#ff2d95', delay: delay || 0 });
  }

  function addBeam(x1, y1, x2, y2, color, kind) {
    beams.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color || '#7ffcff', life: 1, kind: kind || 'line' });
    if (beams.length > 30) beams.shift();
  }
  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    var col = e.color || '#ff2d95';
    addRing(e.x, e.y, col, e.boss ? 60 : 26);
    gold += e.gold;
    kills++;
    score += e.boss ? 150 : 10;
    addParticles(e.x, e.y, col, e.boss ? 28 : 10);
    addFloat(e.x, e.y - 12, '+' + e.gold, '#ffe600');
    if (e.boss) {
      addRing(e.x, e.y, '#ffe600', 90);
      shake();
      if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
    }
    // 分裂者死亡后生成两个小分裂体
    if (e.split && e.kind === 'splitter') {
      for (var si = 0; si < 2; si++) {
        var child = spawnEnemyAt(enemySpec('split', wave), e.pathIdx);
        child.x = e.x + (si ? 7 : -7);
        child.y = e.y + (si ? 4 : -4);
        child.spawnAnim = 10;
      }
    }
    fxBurst(e.x, e.y, 'var(--neon-pink)', 6);
    if (sfxCd <= 0) { audio('clear'); sfxCd = 6; }
  }
  /* 护甲 + 护盾；opts.pierceArmor / opts.bypassShield 供分支使用 */
  function damageEnemy(e, dmg, color, opts) {
    if (!e || !e.alive) return 0;
    opts = opts || {};
    var armor = e.armor || 0;
    if (e.armorBreakT > 0) armor *= 0.4;
    if (opts.pierceArmor) armor = 0;
    var real = dmg * (1 - armor);
    var applied = 0;
    if (e.shieldHp > 0 && !opts.bypassShield) {
      var sh = Math.min(e.shieldHp, real);
      e.shieldHp -= sh;
      real -= sh;
      applied += sh;
      e.shieldCd = 150;
      if (e.shieldHp <= 0) {
        addRing(e.x, e.y, '#7ffcff', 26);
        addParticles(e.x, e.y, '#7ffcff', 10);
      }
    }
    if (real > 0) { e.hp -= real; applied += real; }
    e.flash = 5;
    if (applied > 0) addFloat(e.x, e.y - (e.radius || 9) - 10, '-' + Math.round(applied), color || '#fff');
    if (e.hp <= 0) killEnemy(e);
    return applied;
  }
  /* 减速：刷新时长 + 覆盖单一系数，绝不做乘法叠加 */
  function applySlow(e, st) {
    if (!e || !e.alive || e.slowImmune) return;
    e.slowT = Math.max(e.slowT || 0, st.slowFrames);
    e.slowMul = st.slowMul;
    addParticles(e.x, e.y, '#a8d4ff', 3);
  }
  /* 毒：层数 ≤ 上限、持续时间 ≤ 上限，刷新覆盖计时 */
  function applyPoison(e, st, stacks) {
    if (!e || !e.alive) return;
    e.poisonStacks = Math.min(st.poisonStacks, (e.poisonStacks || 0) + (stacks || 1));
    e.poisonT = st.poisonFrames;
    e.poisonCap = st.poisonStacks;
    if (!e.poisonTick) e.poisonTick = POISON_TICK;
    addParticles(e.x, e.y, '#39ff14', 3);
  }
  function chainLightning(e, st, dmg) {
    var list = enemies.slice().filter(function (o) {
      return o.alive && o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= st.chainRange;
    }).sort(function (a, b) {
      return Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y);
    });
    for (var i = 0; i < Math.min(st.chain, list.length); i++) {
      var o = list[i];
      addBeam(e.x, e.y, o.x, o.y, '#7ffcff', 'chain');
      damageEnemy(o, dmg * 0.6, '#7ffcff');
      addParticles(o.x, o.y, '#7ffcff', 4);
    }
  }
  function pierceShot(b, e, st, dmg) {
    var dx = b.dirX || 0, dy = b.dirY || 1;
    enemies.slice().forEach(function (o) {
      if (!o.alive || o === e) return;
      var ox = o.x - e.x, oy = o.y - e.y;
      var proj = ox * dx + oy * dy;
      var perp = Math.abs(-ox * dy + oy * dx);
      if (proj > 0 && proj <= st.pierceRange && perp < 18) {
        addBeam(e.x, e.y, o.x, o.y, st.glow, 'pierce');
        damageEnemy(o, dmg * 0.72, st.glow, { pierceArmor: st.armorPierce });
      }
    });
  }
  function clusterBlast(e, st, dmg) {
    addRing(e.x, e.y, '#ff9f1a', 30);
    for (var i = 0; i < st.cluster; i++) {
      var a = Math.random() * Math.PI * 2;
      var ox = e.x + Math.cos(a) * 16, oy = e.y + Math.sin(a) * 16;
      addRing(ox, oy, '#ffd18a', 24, i * 5);
      addParticles(ox, oy, '#ff9f1a', 10);
      enemies.slice().forEach(function (o) {
        if (!o.alive) return;
        if (Math.hypot(o.x - ox, o.y - oy) < 28) damageEnemy(o, dmg * 0.55, '#ffd18a');
      });
    }
  }
  function applyBulletHit(b, e) {
    var st = b.stats || statsFor({ type: b.type, level: b.level, branch: b.branch });
    var dmg = st.dmg;
    var crit = st.critChance && Math.random() < st.critChance;
    if (crit) dmg *= st.critMul;
    damageEnemy(e, dmg, crit ? '#ffe600' : (st.glow || '#fff'), { pierceArmor: st.armorPierce || crit });
    if (crit) {
      addFloat(e.x, e.y - 24, 'CRIT!', '#ffe600');
      addRing(e.x, e.y, '#ffe600', 28);
      addParticles(e.x, e.y, '#ffe600', 10);
    }
    // 超载：命中爆出白色电火花（与连锁电弧区分）
    if (st.overcharge) {
      addRing(e.x, e.y, '#ffffff', 18);
      addParticles(e.x, e.y, '#ffffff', 8);
      addBeam(e.x - 12, e.y - 8, e.x + 10, e.y + 6, '#7ffcff', 'chain');
    }
    if (st.slow) {
      if (st.slowRadius) {
        enemies.slice().forEach(function (o) {
          if (o.alive && Math.hypot(o.x - e.x, o.y - e.y) <= st.slowRadius) applySlow(o, st);
        });
        addRing(e.x, e.y, '#a8d4ff', st.slowRadius);
        addParticles(e.x, e.y, '#d8f4ff', 8);
      } else {
        applySlow(e, st);
      }
    }
    if (st.freezeFrames && !e.freezeImmune && (!st.freezeChance || Math.random() < st.freezeChance)) {
      e.frozenT = Math.max(e.frozenT || 0, st.freezeFrames);
      addRing(e.x, e.y, '#d8f4ff', 20);
      addParticles(e.x, e.y, '#d8f4ff', 8);
    }
    if (st.poison) {
      applyPoison(e, st);
      if (st.contagionRadius) {
        addRing(e.x, e.y, '#39ff14', st.contagionRadius);
        enemies.slice().forEach(function (o) {
          if (o.alive && o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= st.contagionRadius) {
            applyPoison(o, st, 1);
            addBeam(e.x, e.y, o.x, o.y, '#39ff14', 'contagion');
            addRing(o.x, o.y, '#39ff14', 14, 2);
          }
        });
      }
    }
    if (st.splash) {
      enemies.slice().forEach(function (o) {
        if (!o.alive || o === e) return;
        if (Math.hypot(o.x - e.x, o.y - e.y) < st.splash) {
          damageEnemy(o, dmg * 0.6, '#ffd18a');
          if (st.shatter) {
            o.armorBreakT = ARMOR_BREAK_FRAMES;
            addParticles(o.x, o.y, '#cfd8e3', 6);
            addRing(o.x, o.y, '#cfd8e3', 16);
          }
        }
      });
      if (st.shatter) {
        e.armorBreakT = ARMOR_BREAK_FRAMES;
        addParticles(e.x, e.y, '#cfd8e3', 10);
        addRing(e.x, e.y, '#cfd8e3', 26);
      }
      addParticles(e.x, e.y, '#ff9f1a', 12);
    }
    if (st.cluster) clusterBlast(e, st, dmg);
    if (st.chain) chainLightning(e, st, dmg);
    if (st.pierce) pierceShot(b, e, st, dmg);
    addParticles(e.x, e.y, st.color || '#fff', 5);
    addRing(e.x, e.y, st.glow || '#fff', st.splash ? 30 : 16);
  }
  /* 光束分支：命中即沿射线穿透 */
  function pointSegDistance(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    var cx = x1 + dx * t, cy = y1 + dy * t;
    return Math.hypot(px - cx, py - cy);
  }
  function fireBeam(t, target, st) {
    addBeam(t.x, t.y, target.x, target.y, st.glow, 'beam');
    t.beamFlash = 26;
    t.lastBeam = { x: target.x, y: target.y };
    addRing(target.x, target.y, '#ffffff', 16);
    enemies.slice().forEach(function (o) {
      if (!o.alive || o.spawnAnim > 0) return;
      if (pointSegDistance(o.x, o.y, t.x, t.y, target.x, target.y) <= 12) {
        damageEnemy(o, st.dmg, st.glow, { pierceArmor: st.armorPierce });
      }
    });
    addParticles(target.x, target.y, st.color, 8);
  }
  /* 新星分支：以塔为中心的即时范围爆发 */
  function fireNova(t, st) {
    addRing(t.x, t.y, st.glow, st.nova);
    addRing(t.x, t.y, '#ffffff', Math.round(st.nova * 0.55), 3);
    addParticles(t.x, t.y, st.color, 22);
    addParticles(t.x, t.y, '#ffffff', 8);
    enemies.slice().forEach(function (o) {
      if (!o.alive || o.spawnAnim > 0) return;
      if (Math.hypot(o.x - t.x, o.y - t.y) <= st.nova) {
        damageEnemy(o, st.dmg, st.glow, { pierceArmor: st.armorPierce });
      }
    });
  }

  function leak(e) {
    e.alive = false;
    var dmg = e.boss ? 10 : 1;
    lives -= dmg;
    baseFlash = 16;
    addParticles(e.x, e.y, '#ff2d95', e.boss ? 24 : 12);
    addRing(e.x, e.y, '#ff2d95', e.boss ? 70 : 42);
    addFloat(e.x, e.y - 12, '-' + dmg, '#ff2d95');
    audio('error');
    shake();
    if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
    if (lives <= 0) lose();
  }

  /* ---------- 单步逻辑（1x / 2x 同帧执行 1~2 次） ---------- */
  function step() {
    if (over || paused) return;
    if (sfxCd > 0) sfxCd--;
    if (baseFlash > 0) baseFlash--;
    // 排队入场（分组错峰 + 场上上限，从路径起点生成）
    if (waveActive && spawnIdx < spawnQueue.length) {
      if (spawnTimer > 0) spawnTimer--;
      else spawnNext();
    }
    // 敌人
    for (var ei = 0; ei < enemies.length; ei++) {
      var e = enemies[ei];
      if (!e.alive) continue;
      if (e.flash > 0) e.flash--;
      if (e.spawnAnim > 0) { e.spawnAnim--; continue; }
      if (e.slowT > 0) {
        e.slowT--;
        if (Math.random() < 0.18) addParticles(e.x, e.y, '#a8d4ff', 1);
      }
      if (e.frozenT > 0) {
        e.frozenT--;
        if (Math.random() < 0.2) addParticles(e.x, e.y, '#d8f4ff', 1);
      }
      if (e.armorBreakT > 0) e.armorBreakT--;
      // 护盾：脱离战斗后缓慢再生
      if (e.shieldMax > 0) {
        if (e.shieldCd > 0) e.shieldCd--;
        else if (e.shieldHp < e.shieldMax) {
          e.shieldHp = Math.min(e.shieldMax, e.shieldHp + e.shieldMax * 0.012 + 0.2);
          if (Math.random() < 0.2) addParticles(e.x, e.y, '#7ffcff', 1);
        }
      }
      // 治疗者：周期性治疗周围敌人
      if (e.heal) {
        e.healCd--;
        if (e.healCd <= 0) {
          e.healCd = 110;
          addRing(e.x, e.y, '#39ff14', 44);
          enemies.slice().forEach(function (o) {
            if (o.alive && o.hp < o.maxHp && Math.hypot(o.x - e.x, o.y - e.y) < 54) {
              o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.06);
              addParticles(o.x, o.y, '#39ff14', 2);
            }
          });
        }
      }
      // Boss 召唤：周期性从身后召唤小兵
      if (e.summon > 0) {
        e.summonCd--;
        if (e.summonCd <= 0 && enemies.length < MAX_FIELD + 4) {
          e.summonCd = e.summon;
          for (var sm = 0; sm < 2; sm++) {
            var minion = spawnEnemyAt(enemySpec('normal', wave), Math.max(0, e.pathIdx - 2));
            minion.x = e.x + (sm ? 10 : -10);
            minion.y = e.y + (sm ? 6 : -6);
            minion.spawnAnim = 12;
          }
          addRing(e.x, e.y, e.color, 52);
          addParticles(e.x, e.y, e.color, 8);
        }
      }
      // 低血量狂暴（Boss3）
      if (e.enrage && !e.enraged && e.hp < e.maxHp * 0.35) {
        e.enraged = true;
        e.baseSpeed *= 1.3;
        addRing(e.x, e.y, '#ff2d95', 60);
        addFloat(e.x, e.y - 30, 'ENRAGE', '#ff2d95');
      }
      // 毒：每 POISON_TICK 帧固定小伤害，层数 ≤ 上限，持续 ≤ 上限
      if (e.poisonT > 0) {
        e.poisonT--;
        e.poisonTick--;
        if (e.poisonTick <= 0) {
          e.poisonTick = POISON_TICK;
          var pStacks = Math.min(e.poisonCap || POISON_MAX_STACKS, e.poisonStacks || 1);
          damageEnemy(e, POISON_DMG * pStacks, '#39ff14', { bypassShield: true, pierceArmor: true });
          if (!e.alive) continue;
        }
      } else {
        e.poisonStacks = 0;
        e.poisonCap = 0;
      }
      // 到达终点
      if (e.pathIdx >= PATH.length - 1) { leak(e); continue; }
      // 移动（统一走 effectiveSpeed）
      var spd = effectiveSpeed(e);
      var target = pathPx(e.pathIdx + 1);
      var dx = target.x - e.x, dy = target.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.angle = Math.atan2(dy, dx);
      if (d <= spd) {
        e.x = target.x; e.y = target.y;
        e.pathIdx++;
        if (e.pathIdx >= PATH.length - 1) { leak(e); continue; }
      } else {
        e.x += dx / d * spd;
        e.y += dy / d * spd;
      }
    }
    enemies = enemies.filter(function (x) { return x.alive; });

    // 塔索敌 / 开火（按分支数值 statsFor）
    for (var ti = 0; ti < towers.length; ti++) {
      var t = towers[ti];
      if (t.cd > 0) t.cd--;
      if (t.muzzle > 0) t.muzzle--;
      if (t.recoil > 0) t.recoil--;
      if (t.beamFlash > 0) t.beamFlash--;
      var st = statsFor(t);
      t.range = st.range;
      var best = null, bestProg = -1;
      for (var k = 0; k < enemies.length; k++) {
        var en = enemies[k];
        if (!en.alive || en.spawnAnim > 0) continue;
        var dd = Math.hypot(en.x - t.x, en.y - t.y);
        if (dd <= t.range && en.pathIdx > bestProg) { bestProg = en.pathIdx; best = en; }
      }
      if (best) {
        var want = Math.atan2(best.y - t.y, best.x - t.x);
        var diff = ((want - t.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        t.angle += diff * 0.22;
        if (t.cd <= 0) {
          t.cd = Math.round(st.cd);
          t.muzzle = 6;
          t.recoil = 4;
          if (st.nova) {
            fireNova(t, st);
          } else if (st.beam) {
            fireBeam(t, best, st);
          } else {
            var mx = t.x + Math.cos(t.angle) * st.barrel;
            var my = t.y + Math.sin(t.angle) * st.barrel;
            bullets.push({
              x: mx, y: my, tx: best.x, ty: best.y,
              target: best, type: t.type, level: t.level, branch: t.branch,
              stats: st, dirX: Math.cos(t.angle), dirY: Math.sin(t.angle),
              speed: st.speed, life: 60,
              trail: [{ x: mx, y: my }]
            });
          }
          if (sfxCd <= 0) { audio('rotate'); sfxCd = 5; }
        }
      }
    }

    // 子弹
    for (var bi = bullets.length - 1; bi >= 0; bi--) {
      var b = bullets[bi];
      b.life--;
      var alive = b.target && b.target.alive;
      if (alive) { b.tx = b.target.x; b.ty = b.target.y; }
      var bdx = b.tx - b.x, bdy = b.ty - b.y;
      var bd = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 5) b.trail.shift();
      if (bd <= b.speed + 3) {
        if (alive) applyBulletHit(b, b.target);
        else addParticles(b.tx, b.ty, TOWERS[b.type].color, 3);
        bullets.splice(bi, 1);
        continue;
      }
      b.x += bdx / bd * b.speed;
      b.y += bdy / bd * b.speed;
      if (b.life <= 0) bullets.splice(bi, 1);
    }
    enemies = enemies.filter(function (x) { return x.alive; });

    // 波次结束 / 胜负
    if (waveActive && spawnIdx >= spawnQueue.length && enemies.length === 0 && !over) {
      waveActive = false;
      startBtn.disabled = false;
      var wBoss = !!waveTotals(wave).boss;
      var cores = wBoss ? 3 : 1;
      addCores(cores);
      if (MODE === 'campaign') {
        writeBestWave(wave);
        if (wave >= MAX_WAVES) {
          win();
        }
      } else {
        writeEndlessBest(wave);
      }
      if (!over) {
        score += 100;
        var bonus = 15 + wave * 3;
        gold += bonus;
        startBtn.textContent = T('gs.towerdefense.startWave').replace('{n}', wave + 1);
        msgEl.textContent = T('gs.towerdefense.waveComing').replace('{n}', wave + 1) + ' +' + bonus + 'G';
        showWaveBanner(T('gs.towerdefense.waveClear'),
          '+' + bonus + 'G · ' + T('gs.towerdefense.starEarned').replace('{n}', cores) + ' · ' +
          T('gs.towerdefense.waveNext').replace('{n}', wave + 1), 'var(--neon-green)', 1800);
        if (Arcade.fx) Arcade.fx.centerBurst('var(--neon-green)', 16);
        msgEl.style.color = 'var(--neon-yellow)';
        addFloat(pathPx(0).x + 20, pathPx(0).y, '+' + bonus, '#ffe600');
        audio('coin');
        writeSave();
      }
    }
    // 连锁/光束特效衰减
    for (var bm = beams.length - 1; bm >= 0; bm--) {
      beams[bm].life -= 0.18;
      if (beams[bm].life <= 0) beams.splice(bm, 1);
    }
    if (!over && lives <= 0) lose();

    // 粒子/飘字
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var p = particles[pi];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96;
      p.life -= 0.03;
      if (p.life <= 0) particles.splice(pi, 1);
    }
    for (var fi = floats.length - 1; fi >= 0; fi--) {
      var f = floats[fi];
      f.y += f.vy; f.life -= 0.025;
      if (f.life <= 0) floats.splice(fi, 1);
    }
    for (var ri = rings.length - 1; ri >= 0; ri--) {
      var rg = rings[ri];
      if (rg.delay > 0) { rg.delay--; continue; }
      rg.r += (rg.maxR - rg.r) * 0.18;
      rg.life -= 0.07;
      if (rg.life <= 0) rings.splice(ri, 1);
    }
  }

  function win() {
    if (over) return;
    over = true; won = true; waveActive = false;
    score += 500;
    writeBestWave(MAX_WAVES);
    audio('win');
    if (Arcade.juice) Arcade.juice.win();
    showResult();
    writeSave();
  }
  function lose() {
    if (over) return;
    over = true; won = false; waveActive = false;
    audio('lose');
    if (Arcade.juice) Arcade.juice.lose();
    showResult();
    writeSave();
  }
  function showResult() {
    selectedTower = null;
    selPanel.classList.add('hidden');
    branchesEl.classList.add('hidden');
    var endless = MODE === 'endless';
    var survived = won ? MAX_WAVES : (endless ? wave : Math.max(0, wave - 1));
    resTitle.textContent = won ? T('gs.towerdefense.ovWin')
      : endless ? T('gs.towerdefense.endlessEnd') : T('gs.towerdefense.ovLose');
    resTitle.className = 'td-title ' + (won ? 'win' : 'lose');
    resWaveLbl.textContent = endless ? T('gs.towerdefense.reachedWave') : T('gs.towerdefense.wavesSurvived');
    resWave.textContent = String(survived);
    resKills.textContent = String(kills);
    resScore.textContent = String(score);
    var endlessBest = endless ? Math.max(readEndlessBest(), survived) : 0;
    if (endless) writeEndlessBest(survived);
    resultEl.classList.remove('hidden');
    if (Arcade.ui) Arcade.ui.setGamePhase('overlay');
    /* 结算面板自带「重新开始 / 换地图」，隐藏底部同义控制条 */
    var ctrl = document.querySelector('.td-wrap .game-controls');
    if (ctrl) ctrl.classList.add('is-hidden');
    startBtn.disabled = true;
    // 结算只提交一次；战役成绩才提交到共享最高分，无尽只写独立最高波次键
    if (!scoreSubmitted) {
      scoreSubmitted = true;
      if (!endless) {
        submitCount++;
        if (Arcade.shell && Arcade.shell.submitScore) Arcade.shell.submitScore(score);
      }
    }
    if (endless) {
      resBest.parentNode.classList.add('hidden');
      resBestWave.parentNode.classList.add('hidden');
      resEbestRow.classList.remove('hidden');
      resEbest.textContent = String(endlessBest);
    } else {
      resBest.parentNode.classList.remove('hidden');
      resBestWave.parentNode.classList.remove('hidden');
      resEbestRow.classList.add('hidden');
      resBest.textContent = String(bestScore());
      resBestWave.textContent = String(readBestWave());
    }
    if (window.Arcade && Arcade.savegame) Arcade.savegame.clear();
  }

  function update() {
    if (over || paused) { updateHud(); return; }
    for (var s = 0; s < speedMul; s++) step();
    updateHud();
    updateSelPanel();
  }

  function remainingInWave() {
    var n = 0;
    for (var i = spawnIdx; i < spawnQueue.length; i++) n += spawnQueue[i].left;
    return n + enemies.length;
  }
  function updateHud() {
    goldEl.textContent = String(gold);
    waveEl.textContent = String(wave);
    livesEl.textContent = String(Math.max(0, lives));
    killsEl.textContent = String(kills);
    scoreEl.textContent = String(score);
    bestWaveEl.textContent = String(currentBestWave());
    if (over) nextEl.textContent = '—';
    else if (waveActive) {
      nextEl.textContent = T('gs.towerdefense.fieldInfo')
        .replace('{a}', remainingInWave())
        .replace('{b}', enemies.length);
    } else nextEl.textContent = nextWaveInfo();
  }
  function updateSelPanel() {
    if (!selectedTower || over) {
      selPanel.classList.add('hidden');
      branchesEl.classList.add('hidden');
      return;
    }
    var t = selectedTower;
    selPanel.classList.remove('hidden');
    var bn = branchName(t);
    selName.textContent = tname(t.type) + ' Lv.' + t.level + (bn ? ' · ' + bn : '');
    var maxed = t.level >= 3 && !!t.branch;
    upCostEl.textContent = maxed ? 'MAX' : String(upCost(t));
    upBtn.disabled = maxed;
    sellValEl.textContent = String(sellValue(t));
    // 2 级（或旧档 3 级无分支）显示两条分支路线
    var canBranch = t.level === 2 || (t.level === 3 && !t.branch);
    if (canBranch) {
      branchesEl.classList.remove('hidden');
      var list = BRANCHES[t.type] || [];
      var bs = branchesEl.querySelectorAll('.td-branch');
      var cost = t.level === 2 ? upCost(t) : 0;
      for (var i = 0; i < bs.length; i++) {
        var meta = list[i];
        if (!meta) { bs[i].style.display = 'none'; continue; }
        bs[i].style.display = '';
        bs[i].querySelector('.td-bn').textContent = T(meta.n);
        bs[i].querySelector('.td-bd').textContent = T(meta.d) + (cost ? ' · ' + cost + 'G' : '');
        bs[i].classList.toggle('unafford', gold < cost);
      }
    } else {
      branchesEl.classList.add('hidden');
    }
  }

  /* ---------- 交互 ---------- */
  function eventPoint(ev, x, y) {
    if (typeof x === 'number' && typeof y === 'number') {
      var r0 = canvas.getBoundingClientRect();
      return { x: (x - r0.left) * (W / r0.width), y: (y - r0.top) * (H / r0.height) };
    }
    if (window.GK) return GK.pointer(canvas, ev);
    var r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
  }
  function pointerCell(ev) {
    var p = eventPoint(ev);
    return { c: Math.floor(p.x / CELL), r: Math.floor(p.y / CELL) };
  }
  /* 触控命中：空格直接建造；路径/越界时在 22 CSS px 半径（目标直径 ≥44px）内吸附塔或空格 */
  function pickCell(x, y, coarse) {
    var p = eventPoint(null, x, y);
    var rect = canvas.getBoundingClientRect();
    var snap = 22 * (W / (rect.width || W));
    var c0 = Math.floor(p.x / CELL), r0 = Math.floor(p.y / CELL);
    var direct = { c: c0, r: r0 };
    var inBounds = c0 >= 0 && r0 >= 0 && c0 < COLS && r0 < ROWS;
    if (inBounds && towerAt(r0, c0)) return direct;
    if (inBounds && !isPathCell(r0, c0)) return direct; // 直接落在可建造空格：就地建造
    var reach = Math.ceil(snap / CELL);
    var bestTower = null, bestD = Infinity;
    for (var rr = r0 - reach; rr <= r0 + reach; rr++) {
      for (var cc = c0 - reach; cc <= c0 + reach; cc++) {
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        var tw = towerAt(rr, cc);
        if (!tw) continue;
        var dd = Math.hypot(cc * CELL + CELL / 2 - p.x, rr * CELL + CELL / 2 - p.y);
        if (dd <= snap && dd < bestD) { bestD = dd; bestTower = { c: cc, r: rr }; }
      }
    }
    if (bestTower) return bestTower;
    if (!coarse || !inBounds) return direct;
    // 粗指针点在路径上：吸附到 44px 内最近可建造空格
    var bestEmpty = null, bestE = Infinity;
    for (var rr2 = r0 - reach; rr2 <= r0 + reach; rr2++) {
      for (var cc2 = c0 - reach; cc2 <= c0 + reach; cc2++) {
        if (cc2 < 0 || rr2 < 0 || cc2 >= COLS || rr2 >= ROWS) continue;
        if (isPathCell(rr2, cc2) || towerAt(rr2, cc2)) continue;
        var d2 = Math.hypot(cc2 * CELL + CELL / 2 - p.x, rr2 * CELL + CELL / 2 - p.y);
        if (d2 <= snap && d2 < bestE) { bestE = d2; bestEmpty = { c: cc2, r: rr2 }; }
      }
    }
    return bestEmpty || direct;
  }
  function tapAt(x, y, coarse) {
    var cell = pickCell(x, y, coarse);
    handleCell(cell.c, cell.r);
  }
  function selectType(tp) {
    selectedType = tp;
    syncTray();
    audio('ui');
  }
  function selectTower(t) {
    selectedTower = t;
    if (t) cursor = { c: Math.floor(t.x / CELL), r: Math.floor(t.y / CELL) };
    updateSelPanel();
    audio('ui');
  }
  function handleCell(c, r) {
    if (over || paused) return;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    var existing = towerAt(r, c);
    if (existing) { selectTower(existing); return; }
    if (isPathCell(r, c)) {
      msgEl.textContent = T('gs.towerdefense.onPath');
      msgEl.style.color = 'var(--neon-pink)';
      audio('error');
      return;
    }
    var spec = TOWERS[selectedType];
    if (!spec) return;
    if (gold < spec.cost) {
      msgEl.textContent = T('gs.towerdefense.noGold').replace('{n}', spec.cost);
      msgEl.style.color = 'var(--neon-pink)';
      audio('error');
      return;
    }
    gold -= spec.cost;
    var startLv = metaHas('level') ? 2 : 1;
    towers.push(normalizeTower({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, type: selectedType, level: startLv, invested: spec.cost }));
    addParticles(c * CELL + CELL / 2, r * CELL + CELL / 2, spec.color, 8);
    fxBurst(c * CELL + CELL / 2, r * CELL + CELL / 2, 'var(--neon-green)', 6);
    msgEl.textContent = T('gs.towerdefense.built').replace('{name}', tname(selectedType));
    msgEl.style.color = 'var(--neon-green)';
    audio('drop');
    writeSave();
    updateHud();
  }
  function upgradeSelected() {
    var t = selectedTower;
    if (!t || over || paused) return false;
    if (t.level >= 3) { msgEl.textContent = T('gs.towerdefense.maxed'); return false; }
    if (t.level === 2 && !t.branch) {
      // 2 级后必须二选一分支才能进 3 级
      msgEl.textContent = T('gs.towerdefense.chooseBranch');
      msgEl.style.color = 'var(--neon-cyan)';
      updateSelPanel();
      audio('ui');
      return false;
    }
    var cost = upCost(t);
    if (gold < cost) { msgEl.textContent = T('gs.towerdefense.noGold').replace('{n}', cost); audio('error'); return false; }
    gold -= cost;
    t.level++;
    t.invested = (t.invested || 0) + cost;
    t.range = statsFor(t).range;
    msgEl.textContent = T('gs.towerdefense.upgraded').replace('{name}', tname(t.type)).replace('{n}', t.level);
    msgEl.style.color = 'var(--neon-yellow)';
    addParticles(t.x, t.y, '#ffe600', 10);
    audio('coin');
    writeSave();
    updateHud();
    updateSelPanel();
    return true;
  }
  function branchSelected(i) {
    var t = selectedTower;
    if (!t || over || paused) return false;
    var list = BRANCHES[t.type] || [];
    var meta = list[i];
    if (!meta) return false;
    if (t.branch) { msgEl.textContent = T('gs.towerdefense.maxed'); return false; }
    if (t.level < 2) return false;
    var cost = t.level === 2 ? upCost(t) : 0;
    if (gold < cost) {
      msgEl.textContent = T('gs.towerdefense.noGold').replace('{n}', cost);
      msgEl.style.color = 'var(--neon-pink)';
      audio('error');
      return false;
    }
    gold -= cost;
    if (t.level === 2) { t.level = 3; t.invested = (t.invested || 0) + cost; }
    t.branch = meta.id;
    t.range = statsFor(t).range;
    msgEl.textContent = T('gs.towerdefense.branchChosen')
      .replace('{name}', tname(t.type))
      .replace('{b}', T(meta.n));
    msgEl.style.color = 'var(--neon-cyan)';
    addParticles(t.x, t.y, TOWERS[t.type].glow, 16);
    addRing(t.x, t.y, TOWERS[t.type].glow, 30);
    audio('coin');
    writeSave();
    updateHud();
    updateSelPanel();
    return true;
  }
  function sellSelected() {
    var t = selectedTower;
    if (!t || over || paused) return false;
    var refund = sellValue(t);
    gold += refund;
    towers = towers.filter(function (x) { return x !== t; });
    selectedTower = null;
    selPanel.classList.add('hidden');
    branchesEl.classList.add('hidden');
    msgEl.textContent = T('gs.towerdefense.sold').replace('{name}', tname(t.type)).replace('{n}', refund);
    msgEl.style.color = 'var(--neon-yellow)';
    addParticles(t.x, t.y, '#ffe600', 8);
    audio('coin');
    writeSave();
    updateHud();
    return true;
  }

  /* 指针 / 触控 */
  canvas.addEventListener('pointermove', function (ev) {
    hover = pointerCell(ev);
  });
  canvas.addEventListener('pointerdown', function (ev) {
    hover = pointerCell(ev);
  });
  canvas.addEventListener('pointerleave', function () { hover = null; });
  // 触控：touchend 直接放塔/选塔（44px 吸附），并抑制随后合成的 click
  canvas.addEventListener('touchstart', function (ev) {
    if (!ev.changedTouches || !ev.changedTouches.length) return;
    var t = ev.changedTouches[0];
    hover = pickCell(t.clientX, t.clientY, true);
    ev.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', function (ev) {
    if (!ev.changedTouches || !ev.changedTouches.length) return;
    var t = ev.changedTouches[0];
    touchGuard = Date.now();
    tapAt(t.clientX, t.clientY, true);
    ev.preventDefault();
  }, { passive: false });
  canvas.addEventListener('click', function (ev) {
    if (Date.now() - touchGuard < 500) return; // 触控已处理
    tapAt(ev.clientX, ev.clientY, false);
  });

  // 塔类型 / 地图按钮
  tray.addEventListener('click', function (ev) {
    var b = ev.target.closest('.td-tower');
    if (!b) return;
    selectType(b.getAttribute('data-t'));
  });
  mapRow.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    var m = b.getAttribute('data-map');
    if (m === 'loop' && !metaHas('loop')) {
      msgEl.textContent = T('gs.towerdefense.mapLocked');
      msgEl.style.color = 'var(--neon-pink)';
      audio('error');
      return;
    }
    if (m === mapStyle && wave === 0) { syncMapButtons(); return; }
    mapStyle = m;
    syncMapButtons();
    reset();
    msgEl.textContent = { std: T('gs.towerdefense.mapStdMsg'), snake: T('gs.towerdefense.mapSnakeMsg'), loop: T('gs.towerdefense.mapLoopMsg') }[mapStyle];
    msgEl.style.color = 'var(--neon-yellow)';
    audio('ui');
  });
  modeRow.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b) return;
    var m = b.getAttribute('data-mode');
    if (!m || m === MODE) return;
    if (wave > 0 && !over) {
      msgEl.textContent = T('gs.towerdefense.modeLocked');
      msgEl.style.color = 'var(--neon-pink)';
      audio('error');
      return;
    }
    MODE = m;
    reset();
    msgEl.textContent = m === 'endless' ? T('gs.towerdefense.endlessStart') : T('gs.towerdefense.msgStart');
    msgEl.style.color = 'var(--neon-yellow)';
    audio('ui');
  });
  metaGrid.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-u]');
    if (!b) return;
    metaUnlock(b.getAttribute('data-u'));
  });

  startBtn.addEventListener('click', startWave);
  pauseBtn.addEventListener('click', togglePause);
  speedBtn.addEventListener('click', function () {
    speedMul = speedMul === 1 ? 2 : 1;
    speedBtn.textContent = speedMul === 1 ? '1x' : '2x';
    speedBtn.classList.toggle('on', speedMul === 2);
    audio('ui');
  });
  restartBtn.addEventListener('click', function () { reset(); audio('ui'); });
  wrap.querySelector('#td-resume').addEventListener('click', togglePause);
  wrap.querySelector('#td-pause-restart').addEventListener('click', function () { reset(); audio('ui'); });
  wrap.querySelector('#td-again').addEventListener('click', function () { reset(); audio('ui'); });
  wrap.querySelector('#td-next-map').addEventListener('click', function () {
    var order = ['std', 'snake', 'loop'].filter(function (m) { return m !== 'loop' || metaHas('loop'); });
    mapStyle = order[(order.indexOf(mapStyle) + 1) % order.length];
    syncMapButtons();
    reset();
    msgEl.textContent = { std: T('gs.towerdefense.mapStdMsg'), snake: T('gs.towerdefense.mapSnakeMsg'), loop: T('gs.towerdefense.mapLoopMsg') }[mapStyle];
    msgEl.style.color = 'var(--neon-yellow)';
    audio('ui');
  });
  upBtn.addEventListener('click', upgradeSelected);
  sellBtn.addEventListener('click', sellSelected);
  branchesEl.addEventListener('click', function (ev) {
    var b = ev.target.closest('.td-branch');
    if (!b) return;
    branchSelected(Number(b.getAttribute('data-b')));
  });
  wrap.querySelector('#td-desel').addEventListener('click', function () {
    selectedTower = null;
    selPanel.classList.add('hidden');
    branchesEl.classList.add('hidden');
  });

  function togglePause() {
    if (over) return;
    paused = !paused;
    if (paused) {
      if (loopApi) loopApi.pause();
      pauseEl.classList.remove('hidden');
    } else {
      if (loopApi) loopApi.resume();
      pauseEl.classList.add('hidden');
    }
    if (Arcade.ui) Arcade.ui.setGamePhase(paused ? 'overlay' : 'playing');
    audio('ui');
  }

  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag && /INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.code === 'KeyP') { e.preventDefault(); togglePause(); return; }
    if (over) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (paused) togglePause();
      else if (waveActive) togglePause();
      else startWave();
      return;
    }
    if (e.code === 'Enter') {
      e.preventDefault();
      if (!cursor) cursor = { c: 18, r: 6 };
      handleCell(cursor.c, cursor.r);
      return;
    }
    // 方向键移动建造光标
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      if (!cursor) cursor = { c: 18, r: 6 };
      if (e.code === 'ArrowUp') cursor.r = Math.max(0, cursor.r - 1);
      if (e.code === 'ArrowDown') cursor.r = Math.min(ROWS - 1, cursor.r + 1);
      if (e.code === 'ArrowLeft') cursor.c = Math.max(0, cursor.c - 1);
      if (e.code === 'ArrowRight') cursor.c = Math.min(COLS - 1, cursor.c + 1);
      hover = cursor;
      return;
    }
    var idx = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[e.code];
    if (idx !== undefined) { selectType(TYPE_ORDER[idx]); return; }
    if (e.code === 'KeyU') { upgradeSelected(); return; }
    if (e.code === 'KeyS') { sellSelected(); return; }
  });

  /* ---------- 绘制 ---------- */
  function drawBase() {
    if (PATH.length === 0) return;
    var p = pathPx(PATH.length - 1);
    var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260);
    ctx.save();
    ctx.translate(p.x, p.y);
    var g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26 + baseFlash);
    g.addColorStop(0, baseFlash > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,168,220,0.9)');
    g.addColorStop(0.5, 'rgba(255,45,149,0.55)');
    g.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 26 + baseFlash, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2d95';
    ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 14 + pulse * 8;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + Date.now() / 2600;
      var px = Math.cos(a) * 9, py = Math.sin(a) * 9;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function drawStart() {
    if (!PATH.length) return;
    var p = pathPx(0);
    var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = 'rgba(57,255,20,' + (0.4 + pulse * 0.4) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 10 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(57,255,20,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTower(t) {
    var spec = TOWERS[t.type];
    var lv = t.level;
    ctx.save();
    ctx.translate(t.x, t.y);
    // 基座
    var pg = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
    pg.addColorStop(0, 'rgba(255,255,255,0.18)');
    pg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = pg;
    if (window.GK) GK.roundRect(ctx, -10, -10, 20, 20, 5); else ctx.rect(-10, -10, 20, 20);
    ctx.fill();
    ctx.strokeStyle = spec.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 炮管（先画，位于塔身下）
    ctx.save();
    ctx.rotate(t.angle);
    if (t.recoil > 0) ctx.translate(-t.recoil * 1.3, 0); // 开火后坐力
    var bg = ctx.createLinearGradient(0, -2, spec.barrel, 2);
    bg.addColorStop(0, spec.color); bg.addColorStop(1, '#ffffff');
    ctx.fillStyle = bg;
    if (window.GK) GK.roundRect(ctx, 0, -2.2, spec.barrel, 4.4, 2.2); else ctx.rect(0, -2.2, spec.barrel, 4.4);
    ctx.fill();
    ctx.fillStyle = spec.glow;
    ctx.beginPath(); ctx.arc(spec.barrel, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    if (t.muzzle > 0) {
      ctx.globalAlpha = t.muzzle / 6;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(spec.barrel + 2, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 塔身
    ctx.shadowColor = spec.color; ctx.shadowBlur = 10;
    var bodyG = ctx.createRadialGradient(-2, -2, 1, 0, 0, 9);
    bodyG.addColorStop(0, '#ffffff');
    bodyG.addColorStop(0.35, spec.glow);
    bodyG.addColorStop(1, spec.color);
    ctx.fillStyle = bodyG;
    if (t.type === 'bolt') {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 - Math.PI / 2;
        var px = Math.cos(a) * 7.5, py = Math.sin(a) * 7.5;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    } else if (t.type === 'frost') {
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
      for (var k = 0; k < 3; k++) {
        var aa = k * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(Math.cos(aa) * -7, Math.sin(aa) * -7); ctx.lineTo(Math.cos(aa) * 7, Math.sin(aa) * 7); ctx.stroke();
      }
    } else if (t.type === 'cannon') {
      ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill();
    } else if (t.type === 'battery') {
      ctx.beginPath(); ctx.arc(0, 0, 7.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, Math.PI * 2); ctx.stroke();
    } else if (t.type === 'poison') {
      ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, Math.PI * 2); ctx.fill();
      for (var b2 = 0; b2 < 3; b2++) {
        var ba = Date.now() / 380 + b2 * Math.PI * 2 / 3;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(Math.cos(ba) * 5, Math.sin(ba) * 5, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // 等级 + 分支标记
    if (lv > 1) {
      ctx.fillStyle = '#ffe600';
      for (var p = 0; p < lv - 1; p++) ctx.fillRect(-5 + p * 5, -13, 3, 3);
    }
    if (t.branch) {
      ctx.strokeStyle = spec.glow;
      ctx.globalAlpha = 0.7 + 0.25 * Math.sin(Date.now() / 200);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      var bd = Date.now() / 500;
      ctx.fillStyle = '#fff';
      for (var dp = 0; dp < 2; dp++) {
        var da = bd + dp * Math.PI;
        ctx.save();
        ctx.translate(Math.cos(da) * 11, Math.sin(da) * 11);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-1.5, -1.5, 3, 3);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    var def = ENEMY_DEFS[e.kind] || ENEMY_DEFS.normal;
    var r = e.radius || def.radius || 9;
    var col = e.color || def.color;
    var col2 = e.dark || def.dark;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.spawnAnim > 0) {
      var prog = 1 - e.spawnAnim / 18;
      ctx.globalAlpha = Math.min(1, 0.3 + prog * 0.7);
      ctx.scale(0.5 + 0.5 * (window.GK ? GK.easeOutBack(prog) : prog), 0.5 + 0.5 * (window.GK ? GK.easeOutBack(prog) : prog));
      ctx.strokeStyle = 'rgba(57,255,20,' + (0.7 * (1 - prog)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 10 + prog * 12, 0, Math.PI * 2); ctx.stroke();
    }
    // 冰霜光环
    if (e.slowT > 0) {
      ctx.strokeStyle = 'rgba(140,210,255,' + (0.5 + 0.3 * Math.sin(Date.now() / 150)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(120,190,255,0.12)';
      ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.fill();
      for (var f = 0; f < 3; f++) {
        var fa = Date.now() / 500 + f * 2.1;
        ctx.fillStyle = 'rgba(200,240,255,0.8)';
        ctx.beginPath(); ctx.arc(Math.cos(fa) * (r + 4), Math.sin(fa) * (r + 4), 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 毒泡泡：数量随层数增长（1-8 层一眼可辨）
    if (e.poisonT > 0) {
      var pn = Math.max(1, Math.min(8, e.poisonStacks || 1));
      if (pn >= 5) {
        ctx.strokeStyle = 'rgba(57,255,20,' + (0.35 + 0.25 * Math.sin(Date.now() / 160)) + ')';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.stroke();
      }
      for (var pb = 0; pb < pn; pb++) {
        var pa = -Date.now() / 400 + pb * (Math.PI * 2 / pn);
        ctx.fillStyle = pn >= 5 ? 'rgba(180,255,120,0.95)' : 'rgba(57,255,20,0.7)';
        ctx.beginPath();
        ctx.arc(Math.cos(pa) * (r + 4), Math.sin(pa) * (r + 4), pn >= 5 ? 2 : 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.8, r * 0.9, 3, 0, 0, Math.PI * 2); ctx.fill();
    // 身体：按类型自绘
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, col2);
    ctx.fillStyle = g;
    if (e.boss) {
      // Boss：旋转尖刺外壳 + 能量核心
      var spin = Date.now() / 700;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var bsp = 0; bsp < 8; bsp++) {
        var ba2 = spin + bsp * Math.PI / 4;
        var rr1 = r * 1.02, rr2 = r * 1.4;
        ctx.moveTo(Math.cos(ba2) * rr1, Math.sin(ba2) * rr1);
        ctx.lineTo(Math.cos(ba2 + 0.1) * rr2, Math.sin(ba2 + 0.1) * rr2);
      }
      ctx.stroke();
      ctx.beginPath();
      for (var bp = 0; bp < 8; bp++) {
        var bpa = spin * 0.6 + bp * Math.PI / 4;
        if (bp === 0) ctx.moveTo(Math.cos(bpa) * r, Math.sin(bpa) * r);
        else ctx.lineTo(Math.cos(bpa) * r, Math.sin(bpa) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
      // 核心
      var coreR = r * 0.46 + Math.sin(Date.now() / 160) * 1.2;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, coreR * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.stroke();
      // 王冠
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.9); ctx.lineTo(-r * 0.2, -r * 1.35);
      ctx.lineTo(0, -r * 0.95); ctx.lineTo(r * 0.2, -r * 1.35); ctx.lineTo(r * 0.45, -r * 0.9);
      ctx.closePath(); ctx.fill();
    } else if (e.kind === 'fast') {
      ctx.save(); ctx.rotate(e.angle);
      ctx.fillStyle = 'rgba(255,230,0,0.18)';
      for (var tr = 1; tr <= 3; tr++) {
        ctx.beginPath();
        ctx.moveTo(-tr * 5 - r * 0.2, 0); ctx.lineTo(-tr * 5 - r * 1.1, -r * 0.5); ctx.lineTo(-tr * 5 - r * 1.1, r * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(r * 1.15, 0); ctx.lineTo(0, -r * 0.85); ctx.lineTo(-r, 0); ctx.lineTo(0, r * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(r * 0.35, 0, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (e.kind === 'tank' || e.kind === 'elite') {
      if (window.GK) GK.roundRect(ctx, -r, -r * 0.85, r * 2, r * 1.7, 4); else ctx.rect(-r, -r * 0.85, r * 2, r * 1.7);
      ctx.fill();
      if (e.kind === 'elite') {
        ctx.strokeStyle = e.aura || '#ffd18a'; ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-r, -r * 0.85, r * 2, 3.5);
      ctx.fillRect(-r, r * 0.55, r * 2, 3.5);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      var tOff = (Date.now() / 40 + e.pathIdx * 7) % 6;
      for (var tx2 = -r + tOff; tx2 < r - 2; tx2 += 6) {
        ctx.fillRect(tx2, -r * 0.85, 2, 3.5);
        ctx.fillRect(tx2, r * 0.55, 2, 3.5);
      }
      ctx.save();
      ctx.rotate(e.angle);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(r * 0.35, -1.6, r * 0.75, 3.2);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'shield') {
      // 六边形装甲体
      ctx.beginPath();
      for (var hx = 0; hx < 6; hx++) {
        var ha = hx * Math.PI / 3 + Date.now() / 900;
        var hxx = Math.cos(ha) * r, hyy = Math.sin(ha) * r;
        if (hx === 0) ctx.moveTo(hxx, hyy); else ctx.lineTo(hxx, hyy);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'healer') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(57,255,20,' + (0.45 + 0.25 * Math.sin(Date.now() / 180)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
      // 十字
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.55, -2, r * 1.1, 4);
      ctx.fillRect(-2, -r * 0.55, 4, r * 1.1);
    } else if (e.kind === 'splitter') {
      // 双瓣分裂体
      for (var sp2 = 0; sp2 < 2; sp2++) {
        var off = sp2 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(off * r * 0.36, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.2, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.2, 1.6, 0, Math.PI * 2); ctx.fill();
    } else {
      // 普通兵 / 小分裂体：躯干 + 腿部摆动 + 双眼
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2;
      var lphase = Date.now() / 90 + e.pathIdx;
      for (var lgi = 0; lgi < (e.kind === 'split' ? 2 : 3); lgi++) {
        var la = lphase + lgi * 2.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(la) * (r * 0.6), Math.sin(la) * (r * 0.6));
        ctx.lineTo(Math.cos(la) * (r * 1.15), Math.sin(la) * (r * 1.15));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(3, -2, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(3, -2, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    // 护盾环
    if (e.shieldHp > 0) {
      var sr = r + 5;
      ctx.strokeStyle = 'rgba(127,252,255,' + (0.55 + 0.25 * Math.sin(Date.now() / 140)) + ')';
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(127,252,255,0.1)';
      ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.fill();
    }
    // 冻结：整块冰晶包裹 + 停住的六向冰棱
    if (e.frozenT > 0) {
      ctx.fillStyle = 'rgba(190,235,255,0.20)';
      ctx.beginPath();
      for (var fx0 = 0; fx0 < 6; fx0++) {
        var fa0 = fx0 * Math.PI / 3 - Math.PI / 2;
        var fxx = Math.cos(fa0) * (r + 5), fyy = Math.sin(fa0) * (r + 5);
        if (fx0 === 0) ctx.moveTo(fxx, fyy); else ctx.lineTo(fxx, fyy);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(216,244,255,0.95)';
      ctx.lineWidth = 1.6;
      for (var ic = 0; ic < 6; ic++) {
        var ia = ic * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ia) * (r + 1), Math.sin(ia) * (r + 1));
        ctx.lineTo(Math.cos(ia) * (r + 8), Math.sin(ia) * (r + 8));
        ctx.stroke();
        var tipX = Math.cos(ia) * (r + 8), tipY = Math.sin(ia) * (r + 8);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(tipX, tipY, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 破甲：灰色裂痕标记
    if (e.armorBreakT > 0) {
      ctx.strokeStyle = 'rgba(207,216,227,0.85)';
      ctx.lineWidth = 1.2;
      for (var ab = 0; ab < 4; ab++) {
        var aba = ab * Math.PI / 2 + 0.35;
        ctx.beginPath();
        ctx.moveTo(Math.cos(aba) * (r * 0.35), Math.sin(aba) * (r * 0.35));
        ctx.lineTo(Math.cos(aba) * (r + 1), Math.sin(aba) * (r + 1));
        ctx.stroke();
      }
    }
    // 受击闪白
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(0.85, e.flash / 5);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 血条（Boss 更宽）
    var hpR = Math.max(0, e.hp / e.maxHp);
    var bw = e.boss ? r * 3 : r * 2.4;
    var barY = e.y - r - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(e.x - bw / 2, barY, bw, 4);
    var hg = ctx.createLinearGradient(e.x - bw / 2, 0, e.x + bw / 2, 0);
    hg.addColorStop(0, hpR > 0.5 ? '#39ff14' : '#ff9f1a');
    hg.addColorStop(1, hpR > 0.5 ? '#b6ff9b' : '#ff2d95');
    ctx.fillStyle = hg;
    ctx.fillRect(e.x - bw / 2, barY, bw * hpR, 4);
    // 护盾条
    if (e.shieldMax > 0 && e.shieldHp > 0) {
      var shR = Math.max(0, e.shieldHp / e.shieldMax);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(e.x - bw / 2, barY - 5, bw, 3);
      ctx.fillStyle = '#7ffcff';
      ctx.fillRect(e.x - bw / 2, barY - 5, bw * shR, 3);
    }
  }

  function drawBullet(b) {
    var spec = TOWERS[b.type];
    var big = b.branch === 'overcharge';
    // 拖尾
    for (var i = 0; i < b.trail.length; i++) {
      var tr = b.trail[i];
      ctx.globalAlpha = (i + 1) / b.trail.length * 0.35;
      ctx.fillStyle = big ? '#ffffff' : spec.color;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, big ? 3 : 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = big ? '#7ffcff' : spec.color; ctx.shadowBlur = big ? 16 : 9;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(b.x, b.y, big ? 3.7 : 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = big ? '#7ffcff' : spec.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, big ? 6.6 : 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPreview() {
    if (!hover || over || paused || !selectedType) return;
    var c = hover.c, r = hover.r;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    var cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
    var spec = TOWERS[selectedType];
    var existing = towerAt(r, c);
    if (existing) {
      ctx.save();
      ctx.strokeStyle = TOWERS[existing.type].color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(existing.x, existing.y, existing.range, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.arc(existing.x, existing.y, existing.range, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    var ok = !isPathCell(r, c);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = ok ? spec.color : '#ff2d95';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, spec.range, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = ok ? spec.color : '#ff2d95';
    ctx.beginPath(); ctx.arc(cx, cy, spec.range, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.20)' : 'rgba(255,45,149,0.32)';
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.5)' : '#ff2d95';
    ctx.lineWidth = 1;
    ctx.strokeRect(c * CELL + 0.5, r * CELL + 0.5, CELL - 1, CELL - 1);
    if (ok) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = spec.color;
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* 键盘建造光标 */
  function drawCursor() {
    if (!cursor || over) return;
    var c = cursor.c, r = cursor.r;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    var cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
    var col = (TOWERS[selectedType] || TOWERS.bolt).glow;
    var pulse = 0.55 + 0.35 * Math.sin(Date.now() / 160);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);
    // 路径流动可视化：沿行进路线移动的虚线
    if (PATH && PATH.length > 1) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 12]);
      ctx.lineDashOffset = -(Date.now() / 55) % 18;
      ctx.beginPath();
      for (var pi2 = 0; pi2 < PATH.length; pi2++) {
        var pp = pathPx(pi2);
        if (pi2 === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    drawStart();
    drawBase();
    // 选中塔射程
    if (selectedTower) {
      ctx.save();
      ctx.strokeStyle = TOWERS[selectedTower.type].color;
      ctx.globalAlpha = 0.6 + 0.2 * Math.sin(Date.now() / 200);
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(selectedTower.x, selectedTower.y, selectedTower.range, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = TOWERS[selectedTower.type].color;
      ctx.beginPath(); ctx.arc(selectedTower.x, selectedTower.y, selectedTower.range, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    drawPreview();
    drawCursor();
    towers.forEach(drawTower);
    enemies.forEach(drawEnemy);
    bullets.forEach(drawBullet);
    // 聚能光束分支：持续脉冲光束（粗外辉 + 白核）
    towers.forEach(function (t) {
      if (t.branch !== 'beam' || !t.lastBeam || !(t.beamFlash > 0)) return;
      var a = Math.min(1, t.beamFlash / 22);
      ctx.save();
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = TOWERS[t.type].glow;
      ctx.shadowColor = TOWERS[t.type].glow;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.lastBeam.x, t.lastBeam.y); ctx.stroke();
      ctx.globalAlpha = a * 0.95;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.lastBeam.x, t.lastBeam.y); ctx.stroke();
      ctx.restore();
    });
    // 连锁闪电 / 贯穿 / 传染 / 光束
    beams.forEach(function (b) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.life) * 0.85;
      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      if (b.kind === 'beam') {
        ctx.lineWidth = 5.5;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      } else if (b.kind === 'chain' || b.kind === 'contagion') {
        // 折线电弧：与直线贯穿/光束区分
        var segs = 5;
        ctx.lineWidth = b.kind === 'chain' ? 2.4 : 2;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        for (var si = 1; si < segs; si++) {
          var t0 = si / segs;
          var jx = (Math.random() - 0.5) * 10, jy = (Math.random() - 0.5) * 10;
          ctx.lineTo(b.x1 + (b.x2 - b.x1) * t0 + jx, b.y1 + (b.y2 - b.y1) * t0 + jy);
        }
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      } else {
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      }
      ctx.restore();
    });
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    rings.forEach(function (rg) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, rg.life);
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
    floats.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- 帮助文本与重开入口 ---------- */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.towerdefense.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () { reset(); };

  /* ---------- QA 钩子（?qa=1 时启用，正常访问不受影响） ---------- */
  function towerInfo(t) {
    var st = statsFor(t);
    return {
      type: t.type, level: t.level, branch: t.branch || null,
      dmg: Math.round(st.dmg * 10) / 10, range: Math.round(st.range),
      cd: Math.round(st.cd), x: Math.round(t.x), y: Math.round(t.y),
      invested: t.invested || 0
    };
  }
  function waveInfo() {
    var w = Math.min(maxWaveLimit(), wave + 1);
    var info = waveTotals(w);
    return {
      next: w, boss: info.boss, total: info.total,
      groups: info.groups.map(function (g) {
        return { kind: g.kind, count: g.count, gap: g.gap, boss: !!g.boss };
      })
    };
  }
  /* 12 条分支在 3 级的计算后数值摘要（供视觉/文案一致性自测） */
  function qaBranches() {
    var out = [];
    TYPE_ORDER.forEach(function (tp) {
      (BRANCHES[tp] || []).forEach(function (bm) {
        var st = statsFor({ type: tp, level: 3, branch: bm.id });
        out.push({
          type: tp, branch: bm.id, name: T(bm.n), desc: T(bm.d),
          dmg: Math.round(st.dmg * 10) / 10,
          range: Math.round(st.range),
          cd: Math.round(st.cd),
          slowMul: st.slow ? Math.round(st.slowMul * 100) / 100 : 0,
          special: {
            chain: st.chain || 0, overcharge: !!st.overcharge,
            pierce: st.pierce ? st.pierceRange : 0,
            critChance: st.critChance || 0, critMul: st.critMul || 1,
            slowRadius: st.slowRadius || 0, freezeChance: st.freezeChance || 0,
            poisonStacks: st.poison ? st.poisonStacks : 0,
            contagionRadius: st.contagionRadius || 0,
            cluster: st.cluster || 0, shatter: !!st.shatter,
            beam: !!st.beam, nova: st.nova || 0
          },
          armorPierce: !!st.armorPierce
        });
      });
    });
    return out;
  }
  function qaState() {
    return {
      mode: MODE,
      gold: gold, wave: wave, maxWaves: MAX_WAVES,
      lives: lives, kills: kills, score: score,
      waveActive: waveActive, over: over, won: won, paused: paused,
      selectedType: selectedType,
      selectedTower: selectedTower ? towerInfo(selectedTower) : null,
      towers: towers.map(towerInfo),
      enemies: enemies.map(function (e) {
        return {
          kind: e.kind, hp: Math.round(e.hp), maxHp: e.maxHp,
          shield: Math.round(e.shieldHp || 0), shieldMax: e.shieldMax || 0,
          slowT: e.slowT || 0, slowMul: e.slowMul || 1, frozenT: e.frozenT || 0,
          poisonStacks: e.poisonStacks || 0, poisonT: e.poisonT || 0,
          poisonCap: e.poisonCap || 0, boss: !!e.boss, pathIdx: e.pathIdx
        };
      }),
      caps: {
        slowFrames: SLOW_FRAMES, poisonStacks: POISON_MAX_STACKS,
        poisonFrames: POISON_FRAMES, maxField: MAX_FIELD,
        maxWaves: maxWaveLimit()
      },
      spawnRemaining: remainingInWave(),
      submissions: submitCount,
      bestWave: readBestWave(),
      endlessBest: readEndlessBest(),
      bestScore: bestScore(),
      mode: MODE,
      meta: { cores: meta.cores, unlocked: Object.keys(meta.unlocked || {}) },
      mapStyle: mapStyle, difficulty: difficulty
    };
  }
  function qaStart(map, diff) {
    if (map === 'std' || map === 'snake' || map === 'loop') mapStyle = map;
    reset();
    if (diff === 'easy' || diff === 'hard') {
      difficulty = diff;
      if (diff === 'easy') { lives = 25; gold = 120; }
      if (diff === 'hard') { lives = 15; gold = 60; }
      updateHud();
    }
    return qaState();
  }
  function qaSetWave(n) {
    if (over) return qaState();
    enemies = []; bullets = []; beams = [];
    spawnQueue = []; spawnIdx = 0; spawnTimer = 0; waveActive = false;
    wave = Math.max(0, Math.min(maxWaveLimit(), Math.floor(n) || 0));
    startBtn.disabled = false;
    startBtn.textContent = wave >= maxWaveLimit() ? T('gs.towerdefense.allDone')
      : T('gs.towerdefense.startWave').replace('{n}', wave + 1);
    msgEl.textContent = T('gs.towerdefense.msgStart');
    updateHud();
    return qaState();
  }
  function qaKillAll() {
    var n = enemies.length;
    enemies.forEach(function (e) { e.alive = false; });
    enemies = []; bullets = [];
    spawnQueue = []; spawnIdx = 0; spawnTimer = 0;
    return n;
  }
  function qaSpawnBoss() {
    var w = wave || 1;
    var kind = bossKindForWave(w) || (w >= 29 ? 'boss3' : w >= 19 ? 'boss2' : 'boss1');
    spawnEnemyAt(enemySpec(kind, Math.min(MAX_WAVES, w)), 0);
    updateHud();
    return qaState();
  }
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) {
    /* 自动化无真实用户手势，浏览器会拦截 vibrate 并在控制台报错；QA 模式下禁用 */
    try { if (navigator.vibrate) navigator.vibrate = function () { return false; }; } catch (e) {}
    window.__qa = {
      state: qaState,
      start: qaStart,
      setWave: qaSetWave,
      spawnBoss: function () { return qaSpawnBoss(); },
      killAll: function () { return qaKillAll(); },
      addGold: function (n) { gold += (Number(n) || 0); updateHud(); return gold; },
      upgradeSelected: function () { return upgradeSelected(); },
      branch: function (i) { return branchSelected(Number(i)); },
      sellSelected: function () { return sellSelected(); },
      forceWin: function () { if (!over) { enemies = []; spawnQueue = []; spawnIdx = 0; wave = MAX_WAVES; win(); } return qaState(); },
      forceLose: function () { if (!over) { lives = 0; lose(); } return qaState(); },
      towers: function () { return towers.map(towerInfo); },
      enemyCount: function () { return enemies.length; },
      waveInfo: waveInfo,
      branches: qaBranches,
      meta: function () { return { cores: meta.cores, unlocked: Object.keys(meta.unlocked || {}) }; },
      setMode: function (m) {
        if (m === 'campaign' || m === 'endless') { MODE = m; reset(); }
        return qaState();
      }
    };
  }

  /* ---------- 启动：优先恢复上次进度；无档则新开一局 ---------- */
  buildPath(mapStyle);
  buildBackground();
  var resumed = false;
  if (window.Arcade && Arcade.savegame) resumed = Arcade.savegame.resume();
  if (!resumed) reset();
  loopApi = Arcade.loop.start(update, draw, 16);
})();
