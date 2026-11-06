/* ============================================================
   战棋对决 Tactics · 回合制策略战棋（旗舰级重制）
   - 兵种：剑士(近战)/弓箭手·火枪手(远程)/骑兵(坦克)/法师/Boss
   - 克制：剑士克弓、弓克法、法克剑（+2 伤害）
   - 每单位每回合：移动一次 + 行动一次；移动后显式锁定，不能二次移动
   - 地形：高地 H（+1 攻 / 远程 +1 射程）、森林 F（减伤 2 / 闪避）
   - 战役：3 章 × 3 关 = 9 关，10×10 地图，逐关解锁
   - 技能树（星星解锁）+ 装备（金币购买/通关解锁），加成真实生效
   - AI：BFS 寻路 + 多单位依次行动 + 行动日志；三档难度
   - 记分 max：击杀+10（Boss+30）、过关 +50、剩余回合/存活单位加分
   核心纯函数以 ==TACTICS-CORE-START== / ==TACTICS-CORE-END== 包裹
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.tactics.tut1t'), d: T('gs.tactics.tut1') },
  { t: T('gs.tactics.tut2t'), d: T('gs.tactics.tut2') },
  { t: T('gs.tactics.tut3t'), d: T('gs.tactics.tut3') }
];

(function () {
  /* ==TACTICS-CORE-START== */
  var TYPES = {
    sword:  { hp: 14, atk: 4, mov: 3, rng: 1, role: 'melee',  skill: 'fury' },
    archer: { hp: 9,  atk: 3, mov: 3, rng: 3, role: 'ranged' },
    mage:   { hp: 8,  atk: 4, mov: 2, rng: 2, role: 'ranged' },
    knight: { hp: 18, atk: 4, mov: 3, rng: 1, role: 'tank',  skill: 'charge' },
    gunner: { hp: 9,  atk: 3, mov: 2, rng: 3, role: 'ranged', skill: 'pierce' },
    boss:   { hp: 28, atk: 5, mov: 3, rng: 2, role: 'tank' }
  };
  var COUNTER = { sword: 'archer', archer: 'mage', mage: 'sword' };
  var AI_PROFILES = {
    easy:   { kill: 50,  focus: 1, counter: 0,   hill: 0, forest: 0, step: 0.1, random: true,  idle: 0.25 },
    normal: { kill: 100, focus: 2, counter: 0.5, hill: 2, forest: 1, step: 0.2, random: false, idle: 0 },
    hard:   { kill: 120, focus: 3, counter: 3,   hill: 4, forest: 3, step: 0.3, random: false, idle: 0 }
  };

  function typeDef(t) { return TYPES[t] || TYPES.sword; }
  function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function inBounds(g, x, y) { return !!g && y >= 0 && x >= 0 && y < g.length && x < g[0].length; }
  function cellAt(g, x, y) { return inBounds(g, x, y) ? g[y][x] : null; }

  /* 单位有效射程：使用单位当前 rng（技能/装备已计入）；远程站高地 +1 */
  function unitRange(u, cell) {
    var t = typeDef(u.type);
    var r = (typeof u.rng === 'number') ? u.rng : t.rng;
    if (cell && cell.hill && t.role === 'ranged') r += 1;
    return r;
  }
  /* 地形减伤：森林 -2；火枪手技能/装备可无视 */
  function terrainGuard(cell, att) {
    if (att && att.ignoreForest) return 0;
    return cell && cell.forest ? 2 : 0;
  }

  /* 基础伤害（克制 / 狂暴 / 冲锋 / 高地 / 森林 / 装备） */
  function baseDamage(att, def, atkCell, defCell) {
    var t = typeDef(att.type), d = typeDef(def.type);
    var base = (typeof att.atk === 'number' ? att.atk : t.atk) + (atkCell && atkCell.hill ? 1 : 0);
    var counter = (t.skill !== 'pierce' && d.skill !== 'pierce' && COUNTER[att.type] === def.type) ? 2 : 0;
    var fury = (t.skill === 'fury' && att.hp / (att.maxHp || t.hp) < 0.4) ? 2 : 0;
    var charge = (t.skill === 'charge' && att.moved) ? 2 : 0;
    return Math.max(1, base + counter + fury + charge - terrainGuard(defCell, att));
  }

  /* 命中率：高地 +4%，森林目标 -12%，技能/装备命中加成 */
  function hitChanceOf(att, def, atkCell, defCell) {
    var c = 0.9 + (att.hitBonus || 0) + (atkCell && atkCell.hill ? 0.04 : 0) - (defCell && defCell.forest ? 0.12 : 0);
    return Math.max(0.55, Math.min(0.99, c));
  }

  /* 一次攻击判定：miss / crit / damage（rnd 为 [0,1) 随机函数，便于测试） */
  function resolveAttack(att, def, atkCell, defCell, rnd) {
    if (rnd() > hitChanceOf(att, def, atkCell, defCell)) return { miss: true, dmg: 0, crit: false };
    var base = baseDamage(att, def, atkCell, defCell);
    var crit = rnd() < 0.1;
    var dmg = Math.max(1, base + Math.floor(rnd() * 3) - 1);
    if (crit) dmg = Math.round(dmg * 1.5);
    return { miss: false, dmg: dmg, crit: crit };
  }

  /* 反击概率：近战/坦克高，远程较低 */
  function counterChance(def) {
    var role = typeDef(def.type).role;
    if (def.type === 'boss') return 0.7;
    return role === 'melee' || role === 'tank' ? 0.6 : 0.28;
  }
  function canCounter(def, att) {
    if (!def || def.hp <= 0) return false;
    var d = Math.abs(att.x - def.x) + Math.abs(att.y - def.y);
    return d > 0 && d <= unitRange(def, null);
  }
  function counterDamage(def, att, defCell, atkCell) {
    return Math.max(1, Math.round(baseDamage(def, att, defCell, atkCell) * 0.55));
  }

  /* BFS 可达范围：墙/其他单位阻挡；返回 key→{x,y,d,px,py} */
  var KEY_MUL = 32;
  function keyOf(x, y) { return y * KEY_MUL + x; }
  function bfsGrid(grid, sx, sy, maxSteps, self) {
    var map = {};
    var start = { x: sx, y: sy, d: 0, px: -1, py: -1 };
    map[keyOf(sx, sy)] = start;
    var q = [start], qi = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (qi < q.length) {
      var cur = q[qi++];
      if (cur.d >= maxSteps) continue;
      for (var i = 0; i < 4; i++) {
        var nx = cur.x + dirs[i][0], ny = cur.y + dirs[i][1];
        if (!inBounds(grid, nx, ny)) continue;
        var c = grid[ny][nx];
        if (c.wall) continue;
        var occ = c.unit;
        if (occ && occ !== self) continue;
        var k = keyOf(nx, ny);
        if (map[k]) continue;
        var node = { x: nx, y: ny, d: cur.d + 1, px: cur.x, py: cur.y };
        map[k] = node;
        q.push(node);
      }
    }
    return map;
  }
  function reachableCells(map) {
    var out = [];
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) out.push(map[k]);
    return out;
  }
  /* 路径（不含起点）；start 返回空数组 */
  function pathFrom(map, tx, ty) {
    var node = map[keyOf(tx, ty)];
    if (!node) return null;
    var path = [];
    while (node && node.px >= 0) {
      path.unshift({ x: node.x, y: node.y });
      node = map[keyOf(node.px, node.py)];
    }
    return path;
  }

  /* AI 决策（纯函数）：返回 {path, node, target} 或 null */
  function planEnemyAction(grid, u, units, diff, rnd) {
    var conf = AI_PROFILES[diff] || AI_PROFILES.normal;
    var targets = units.filter(function (t) { return t.side !== u.side && t.hp > 0; });
    if (!targets.length) return null;
    if (conf.random && rnd() < conf.idle) return null;

    var reach = bfsGrid(grid, u.x, u.y, u.mov, u);
    var cells = reachableCells(reach);
    var candidates = [];

    for (var i = 0; i < cells.length; i++) {
      var n = cells[i];
      var atkCell = grid[n.y][n.x];
      var rng = unitRange(u, atkCell);
      for (var j = 0; j < targets.length; j++) {
        var t = targets[j];
        var dis = Math.abs(t.x - n.x) + Math.abs(t.y - n.y);
        if (dis <= 0 || dis > rng) continue;
        var defCell = grid[t.y][t.x];
        var base = baseDamage(u, t, atkCell, defCell);
        var risk = 0;
        if (dis <= unitRange(t, defCell)) risk = counterDamage(t, u, defCell, atkCell);
        var score = base * 4;
        if (base >= t.hp) score += conf.kill;
        score += (t.maxHp - t.hp) * conf.focus;
        score += (atkCell.hill ? conf.hill : 0) + (atkCell.forest ? conf.forest : 0);
        score -= risk * conf.counter;
        score -= n.d * conf.step;
        candidates.push({ node: n, target: t, score: score });
      }
    }

    if (candidates.length) {
      var pick;
      if (conf.random) pick = candidates[Math.floor(rnd() * candidates.length)];
      else {
        pick = candidates[0];
        for (var c = 1; c < candidates.length; c++) if (candidates[c].score > pick.score) pick = candidates[c];
      }
      return {
        path: pathFrom(reach, pick.node.x, pick.node.y),
        node: pick.node,
        target: pick.target
      };
    }

    /* 无可攻击位置 → 向最弱/最近目标靠拢 */
    var focus = targets[0], bestDist = 1e9;
    for (var k = 0; k < targets.length; k++) {
      var d2 = Math.abs(targets[k].x - u.x) + Math.abs(targets[k].y - u.y);
      var pri = d2 - (targets[k].maxHp - targets[k].hp) * 0.35;
      if (pri < bestDist) { bestDist = pri; focus = targets[k]; }
    }
    if (!focus) return null;
    var bestNode = null, bestScore = -1e9;
    for (var m = 0; m < cells.length; m++) {
      var nn = cells[m];
      var cell2 = grid[nn.y][nn.x];
      var dist = Math.abs(focus.x - nn.x) + Math.abs(focus.y - nn.y);
      var sc = -dist * 10 + (cell2.forest ? 3 : 0) + (cell2.hill ? 2 : 0) - nn.d * 0.2;
      if (sc > bestScore) { bestScore = sc; bestNode = nn; }
    }
    if (!bestNode) return null;
    return { path: pathFrom(reach, bestNode.x, bestNode.y), node: bestNode, target: null };
  }
  /* ==TACTICS-CORE-END== */

  /* ---------- 关卡（10×10；'.'草地 '#'墙 'H'高地 'F'森林；大写我方 小写敌方） ---------- */
  var LEVELS = [
    {
      key: 'level1', limit: 12,
      map: [
        '....#.....',
        '.S.......H',
        '.A...F....',
        '.M........',
        '...H...#..',
        '..F.......',
        '.........a',
        '..H...s...',
        '.K....F...',
        '.......a..'
      ]
    },
    {
      key: 'level2', limit: 14,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H.......',
        '.....H....',
        '.K.....s..',
        '...F..a...',
        '.......m..',
        '......a...'
      ]
    },
    {
      key: 'level3', limit: 16,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H..H....',
        '.....F....',
        '.K.....s..',
        '...F..a.k.',
        '.......m..',
        '......a...'
      ]
    },
    {
      key: 'level4', limit: 16,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H..H....',
        '.G...F....',
        '.K.....s..',
        '...F..a.k.',
        '....#..m..',
        '......a..g'
      ]
    },
    {
      key: 'level5', limit: 18,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H..H....',
        '.G...F..s.',
        '.K.......k',
        '...F..a...',
        '....#..m..',
        '.a....a..g'
      ]
    },
    {
      key: 'level6', limit: 20,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H..H..B.',
        '.G...F....',
        '.K....#.s.',
        '...F..a.k.',
        '..m....#..',
        '.a....a..g'
      ]
    },
    {
      key: 'level7', limit: 18,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H..H..k.',
        '.G...F..s.',
        '.K....#...',
        '...F..a.m.',
        '..s...#.g.',
        '.a....a...'
      ]
    },
    {
      key: 'level8', limit: 20,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H..H..k.',
        '.G...F..s.',
        '.K..m.#...',
        '...F..a.m.',
        '..s...#.g.',
        '.a..k.a...'
      ]
    },
    {
      key: 'level9', limit: 22,
      map: [
        '..#....H..',
        '.S.......F',
        '.A..F.....',
        '.M....#...',
        '..H..H..B.',
        '.G...F..k.',
        '.K....#.s.',
        '...F..a.m.',
        '..s...#.g.',
        '.a..k.a...'
      ]
    }
  ];

  var LEVEL_UNIT = {
    S: ['my', 'sword'], A: ['my', 'archer'], M: ['my', 'mage'],
    K: ['my', 'knight'], G: ['my', 'gunner'], B: ['en', 'boss'],
    s: ['en', 'sword'], a: ['en', 'archer'], m: ['en', 'mage'],
    k: ['en', 'knight'], g: ['en', 'gunner']
  };

  /* ---------- 技能树 / 装备 / 金币（独立持久化键） ---------- */
  var META_KEY = 'arcade_tactics_meta_v2';
  var SKILLS = [
    { id: 'sword_hp',    cost: 2,  target: 'sword',  stat: 'hp',     add: 2 },
    { id: 'archer_atk',  cost: 4,  target: 'archer', stat: 'atk',    add: 1 },
    { id: 'mage_rng',    cost: 6,  target: 'mage',   stat: 'rng',    add: 1 },
    { id: 'knight_mov',  cost: 9,  target: 'knight', stat: 'mov',    add: 1 },
    { id: 'gunner_pierce', cost: 12, target: 'gunner', stat: 'pierce', add: 1 },
    { id: 'all_hit',     cost: 16, target: 'all',    stat: 'hit',    add: 5 }
  ];
  var EQUIPS = [
    { id: 'w_blade', slot: 'weapon', price: 0,   req: 0, bonus: { atk: 1 } },
    { id: 'w_rail',  slot: 'weapon', price: 120, req: 2, bonus: { atk: 1, atkRanged: 1 } },
    { id: 'w_crystal', slot: 'weapon', price: 160, req: 4, bonus: { rngRanged: 1 } },
    { id: 'a_vest',  slot: 'armor',  price: 0,   req: 0, bonus: { hp: 2 } },
    { id: 'a_plate', slot: 'armor',  price: 140, req: 3, bonus: { hp: 3 } },
    { id: 'a_cloak', slot: 'armor',  price: 110, req: 2, bonus: { hp: 1, mov: 1 } },
    { id: 't_charm', slot: 'trinket', price: 0,  req: 0, bonus: { hit: 5 } },
    { id: 't_boots', slot: 'trinket', price: 100, req: 1, bonus: { mov: 1 } },
    { id: 't_seal',  slot: 'trinket', price: 200, req: 5, bonus: { atk: 1, hit: 5 } }
  ];
  var SLOTS = ['weapon', 'armor', 'trinket'];
  var DEF_META = {
    version: 2, gold: 0, stars: {}, skills: [],
    owned: ['w_blade', 'a_vest', 't_charm'],
    equipped: { weapon: 'w_blade', armor: 'a_vest', trinket: 't_charm' }
  };
  function itemDef(id) {
    for (var i = 0; i < EQUIPS.length; i++) if (EQUIPS[i].id === id) return EQUIPS[i];
    return null;
  }
  function skillDef(id) {
    for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].id === id) return SKILLS[i];
    return null;
  }

  /* ---------- 旗舰版样式（运行时注入；index.html 仅同步 ?v=） ---------- */
  (function injectFlagshipStyle() {
    if (document.getElementById('tk-flagship-style')) return;
    var css = [
      "/* 关卡卡片文字换行 / 结算面板滚动 */",
      ".tk-lvl-t { display: block; }",
      ".tk-lvl-d { display: block; }",
      ".tk-modal { max-height: calc(100vh - 28px); overflow-y: auto; }",
      "",
      ".tk-chapter { margin: 0 0 8px; }",
      ".tk-ch-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 2px; border-bottom: 1px solid rgba(0,240,255,.18); margin-bottom: 8px; }",
      ".tk-ch-title { font-family: var(--font-pixel); font-size: 11px; color: var(--neon-cyan); text-shadow: 0 0 8px rgba(0,240,255,.5); white-space: nowrap; flex: 0 0 auto; }",
      ".tk-ch-stars { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-dim); white-space: nowrap; flex: 0 0 auto; }",
      ".tk-chapter .tk-levels { margin-bottom: 10px; }",
      ".tk-star { display: inline-block; width: 12px; height: 12px; background: #3a3f55; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }",
      ".tk-star.on { background: var(--neon-yellow); filter: drop-shadow(0 0 4px rgba(255,230,0,.7)); }",
      ".tk-lvl-stars { display: flex; gap: 3px; margin-top: 5px; }",
      ".tk-lvl-stars .tk-star { width: 10px; height: 10px; }",
      ".tk-pick-tools { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 0 auto 12px; }",
      ".tk-pick-tools .btn { min-height: 44px; min-width: 130px; }",
      ".tk-gold-chip { display: inline-flex; align-items: center; min-height: 32px; padding: 4px 12px; border: 1px dashed rgba(255,230,0,.45); border-radius: 999px; font-size: 11px; color: var(--neon-yellow); }",
      "",
      ".tk-prep { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; background: rgba(5,5,12,.88); padding: 8px; }",
      ".tk-prep.hidden { display: none; }",
      ".tk-prep-modal {",
      "  display: flex; flex-direction: column; width: min(460px, 96vw); max-height: calc(100vh - 20px);",
      "  background: var(--bg-panel); border: 1px solid var(--accent, #00f0ff); border-radius: 12px;",
      "  padding: 14px; text-align: left; box-shadow: 0 0 30px rgba(0,240,255,.22);",
      "}",
      ".tk-prep-modal h2 { font-family: var(--font-pixel); font-size: 14px; color: var(--neon-cyan); text-align: center; line-height: 1.5; }",
      ".tk-prep-sub { font-size: 11px; color: var(--text-dim); text-align: center; line-height: 1.6; margin: 5px 0 2px; }",
      ".tk-prep-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; flex: 0 0 auto; }",
      ".tk-prep-tabs .btn { min-height: 44px; font-size: 11px; }",
      ".tk-prep-tabs .btn.active { border-color: var(--neon-cyan); box-shadow: 0 0 12px rgba(0,240,255,.35); color: var(--neon-cyan); }",
      ".tk-prep-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 2px 3px 4px; margin-bottom: 8px; -webkit-overflow-scrolling: touch; }",
      ".tk-prep-sum { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: var(--text-dim); margin: 2px 0 8px; }",
      ".tk-prep-note { min-height: 18px; font-size: 11px; color: var(--neon-green); line-height: 1.5; margin: 2px 0 4px; }",
      ".tk-prep-foot { flex: 0 0 auto; }",
      ".tk-prep-gold { font-size: 11px; color: var(--neon-yellow); text-align: center; margin-bottom: 6px; }",
      ".tk-prep-actions { display: flex; gap: 8px; }",
      ".tk-prep-actions .btn { flex: 1; min-height: 44px; font-size: 10px; padding: 8px 10px; }",
      "",
      ".tk-skill { border: 1px solid rgba(255,255,255,.14); border-radius: 9px; padding: 9px 10px; margin-bottom: 8px; background: rgba(255,255,255,.03); }",
      ".tk-skill.unlocked { border-color: rgba(57,255,20,.5); background: linear-gradient(135deg, rgba(57,255,20,.10), rgba(0,240,255,.04)); }",
      ".tk-skill.avail { border-color: rgba(0,240,255,.55); box-shadow: 0 0 12px rgba(0,240,255,.14); }",
      ".tk-skill.locked { opacity: .68; }",
      ".tk-skill-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }",
      ".tk-skill-name { font-family: var(--font-pixel); font-size: 10px; color: var(--neon-yellow); line-height: 1.5; }",
      ".tk-skill-tag { font-size: 10px; white-space: nowrap; padding: 2px 7px; border-radius: 999px; border: 1px solid rgba(255,255,255,.2); color: var(--text-dim); }",
      ".tk-skill.unlocked .tk-skill-tag { color: var(--neon-green); border-color: rgba(57,255,20,.45); }",
      ".tk-skill.avail .tk-skill-tag { color: var(--neon-cyan); border-color: rgba(0,240,255,.45); }",
      ".tk-skill-desc { font-size: 11px; color: var(--text-main); line-height: 1.6; margin-top: 5px; }",
      ".tk-skill-req { font-size: 10px; color: var(--text-dim); margin-top: 4px; }",
      ".tk-skill .btn { width: 100%; min-height: 44px; margin-top: 7px; font-size: 10px; }",
      "",
      ".tk-gear-slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }",
      ".tk-gear-slot { border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 6px 7px; min-height: 58px; background: rgba(255,255,255,.03); }",
      ".tk-gear-slot .sl { font-size: 9px; color: var(--text-dim); font-family: var(--font-pixel); }",
      ".tk-gear-slot .nm { font-size: 10px; color: var(--neon-cyan); line-height: 1.45; margin-top: 3px; overflow-wrap: anywhere; }",
      ".tk-gear-sum { font-size: 10px; color: var(--neon-green); line-height: 1.7; border: 1px dashed rgba(57,255,20,.3); border-radius: 8px; padding: 6px 8px; margin-bottom: 9px; }",
      ".tk-gear-item { display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,.13); border-radius: 8px; padding: 7px 8px; margin-bottom: 7px; background: rgba(255,255,255,.025); }",
      ".tk-gear-item.equipped { border-color: rgba(57,255,20,.45); background: rgba(57,255,20,.06); }",
      ".tk-gear-item.locked { opacity: .62; }",
      ".tk-gear-main { flex: 1; min-width: 0; }",
      ".tk-gear-name { font-size: 11px; color: var(--neon-yellow); line-height: 1.45; }",
      ".tk-gear-desc { font-size: 10px; color: var(--text-dim); line-height: 1.55; margin-top: 2px; }",
      ".tk-gear-item .btn { flex: 0 0 auto; min-height: 44px; min-width: 74px; font-size: 9px; padding: 6px 8px; }",
      "",
      ".tk-result-stars { display: flex; justify-content: center; align-items: center; gap: 8px; margin: 2px 0 10px; font-size: 10px; color: var(--text-dim); }",
      ".tk-result-stars .tk-star { width: 22px; height: 22px; }",
      "@keyframes tkCellHit { 0% { filter: brightness(2.2); box-shadow: inset 0 0 0 3px rgba(255,255,255,.95), 0 0 24px rgba(255,255,255,.55); } 55% { filter: brightness(1.18); } 100% { filter: none; } }",
      ".tk-cell.hitflash { animation: tkCellHit .3s cubic-bezier(.2,.8,.3,1); }",
      ".tk-cell.hitflash.crit { animation-duration: .38s; }\n",
      "@keyframes tkOvIn { from { opacity: 0; } to { opacity: 1; } }",
      "@keyframes tkModalIn { from { opacity: 0; transform: translateY(12px) scale(.94); } to { opacity: 1; transform: none; } }",
      ".tk-overlay:not(.hidden) { animation: tkOvIn .2s ease-out both; }",
      ".tk-overlay:not(.hidden) .tk-modal, .tk-prep:not(.hidden) .tk-prep-modal { animation: tkModalIn .28s cubic-bezier(.2,.9,.3,1.18) both; }",
      ".tk-overlay { z-index: 9000; }",
      ".tk-prep { z-index: 9500; }",
      ".tk-battle .game-controls .btn { min-height: 44px; }",
      ".tk-chapter { border-radius: 10px; }",
      ".tk-ch-head { flex-wrap: wrap; }",
      "",
      "@media (max-width: 480px) {",
      "  .tk-top { font-size: 11px; gap: 4px 9px; }",
      "  .tk-top .stat-value { font-size: 10px; }",
      "  .tk-msg { font-size: 12px; }",
      "  .tk-detail { font-size: 10px; }",
      "  .tk-levels { gap: 8px; }",
      "  .tk-lvl { min-height: 68px; padding: 8px 10px; gap: 8px; }",
      "  .tk-lvl-num { font-size: 14px; min-width: 28px; }",
      "  .tk-lvl-t { font-size: 10px; }",
      "  .tk-lvl-d { font-size: 10px; }",
      "  .tk-modal h2 { font-size: 13px; }",
      "  .tk-result b { font-size: 12px; }",
      "  .tk-gear-item .btn { min-width: 66px; }",
      "}",
      "@media (max-width: 360px) {",
      "  .tk-wrap { width: 100%; padding: 10px 2px 18px; }",
      "  .tk-prep { padding: 4px; }",
      "  .tk-prep-modal { width: 100%; max-height: calc(100vh - 8px); padding: 11px; }",
      "  .tk-lvl { padding: 8px; gap: 7px; }",
      "  .tk-lvl-num { min-width: 24px; font-size: 13px; }",
      "  .tk-pick-tools .btn { min-width: 118px; }",
      "  .tk-gear-slots { gap: 4px; }",
      "  .tk-gear-slot { padding: 5px; }",
      "}"
    ].join("\n");
    var st = document.createElement('style');
    st.id = 'tk-flagship-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  })();

  /* ---------- DOM ---------- */
  var root = document.getElementById('game-root');
  root.innerHTML =
    '<div class="tk-wrap">' +
    '  <div class="tk-pick" id="tk-pick">' +
    '    <div class="tk-pick-title" id="tk-pick-title"></div>' +
    '    <div class="tk-pick-sub" id="tk-pick-sub"></div>' +
    '    <div class="tk-pick-best" id="tk-pick-best"></div>' +
    '    <div class="tk-pick-tools" id="tk-pick-tools"></div>' +
    '    <div class="tk-levels" id="tk-levels"></div>' +
    '    <div class="tk-diff" id="tk-diff"></div>' +
    '    <div class="tk-diff-note" id="tk-diff-note"></div>' +
    '  </div>' +
    '  <div class="tk-battle hidden" id="tk-battle">' +
    '    <div class="tk-top">' +
    '      <span>' + T('gs.tactics.levelLbl').replace('{a}', '<span class="stat-value" id="tk-level">1</span>').replace('{b}', '9') + '</span>' +
    '      <span>' + T('gs.tactics.turnLbl').replace('{n}', '<span class="stat-value" id="tk-turn">1</span>') + '</span>' +
    '      <span>' + T('gs.tactics.myLbl') + ' <span class="stat-value" style="color:var(--neon-green)" id="tk-my">3</span> : <span class="stat-value" style="color:var(--neon-pink)" id="tk-en">3</span> ' + T('gs.tactics.enLbl') + '</span>' +
    '      <span>' + T('gs.tactics.readyLbl').replace('{n}', '<span class="stat-value" style="color:var(--neon-cyan)" id="tk-ready">3</span>') + '</span>' +
    '      <span>' + T('gs.tactics.scoreLbl').replace('{n}', '<span class="stat-value" style="color:var(--neon-yellow)" id="tk-score">0</span>') + '</span>' +
    '    </div>' +
    '    <div class="tk-msg" id="tk-msg" aria-live="polite"></div>' +
    '    <div class="tk-stage" id="tk-stage">' +
    '      <div class="tk-boardView" id="tk-boardView">' +
    '        <div class="tk-boardWrap" id="tk-boardWrap">' +
    '          <div class="tk-board" id="tk-board" role="grid" aria-label="' + T('gs.tactics.boardAria') + '"></div>' +
    '          <canvas class="tk-fx" id="tk-fx"></canvas>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="tk-zoom-bar" id="tk-zoom-bar">' +
    '      <button type="button" class="btn" id="tk-zoom-out" aria-label="' + T('gs.tactics.zoomOut') + '">－</button>' +
    '      <button type="button" class="btn purple tk-zoom-toggle" id="tk-zoom-toggle" aria-label="' + T('gs.tactics.zoomToggle') + '">1.0×</button>' +
    '      <button type="button" class="btn" id="tk-zoom-in" aria-label="' + T('gs.tactics.zoomIn') + '">＋</button>' +
    '      <button type="button" class="btn" id="tk-zoom-reset" aria-label="' + T('gs.tactics.zoomReset') + '">' + T('gs.tactics.zoomReset') + '</button>' +
    '    </div>' +
    '    <div class="tk-zoom-hint" id="tk-zoom-hint"></div>' +
    '    <div class="tk-detail" id="tk-detail"></div>' +
    '    <div class="game-controls">' +
    '      <button class="btn green tk-endturn" id="tk-end">' + T('gs.tactics.endTurn') + '</button>' +
    '      <button class="btn purple" id="tk-hint">' + T('gs.tactics.hintBtn') + '</button>' +
    '      <button class="btn" id="tk-change">' + T('gs.tactics.levelsBtn') + '</button>' +
    '    </div>' +
    '    <div class="tk-legend">' +
    '      <span><i class="tk-dot" style="background:#2c5a35;border:1px solid #5a9a6a"></i>' + T('gs.tactics.terrGrass') + '</span>' +
    '      <span><i class="tk-dot" style="background:#55713c;border:1px solid #9aa85a"></i>' + T('gs.tactics.terrHill') + '</span>' +
    '      <span><i class="tk-dot" style="background:#123a24;border:1px solid #39ff14"></i>' + T('gs.tactics.terrForest') + '</span>' +
    '      <span><i class="tk-dot" style="background:#4a5470;border:1px solid #8a94b8"></i>' + T('gs.tactics.terrWall') + '</span>' +
    '    </div>' +
    '    <div class="help-text" id="tk-help"></div>' +
    '  </div>' +
    '  <div class="tk-overlay hidden" id="tk-overlay">' +
    '    <div class="tk-modal" id="tk-result-modal">' +
    '      <h2 id="tk-ov-title"></h2>' +
    '      <p id="tk-ov-text"></p>' +
    '      <div class="tk-result-stars" id="tk-ov-stars"></div>' +
    '      <div class="tk-result" id="tk-ov-stats"></div>' +
    '      <div class="game-controls" id="tk-ov-actions"></div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="tk-prep hidden" id="tk-prep">' +
    '    <div class="tk-prep-modal" role="dialog" aria-modal="true" aria-labelledby="tk-prep-title">' +
    '      <h2 id="tk-prep-title"></h2>' +
    '      <div class="tk-prep-sub" id="tk-prep-sub"></div>' +
    '      <div class="tk-prep-tabs">' +
    '        <button type="button" class="btn" id="tk-tab-skill"></button>' +
    '        <button type="button" class="btn" id="tk-tab-gear"></button>' +
    '      </div>' +
    '      <div class="tk-prep-body" id="tk-prep-body"></div>' +
    '      <div class="tk-prep-foot">' +
    '        <div class="tk-prep-note" id="tk-prep-note" aria-live="polite"></div>' +
    '        <div class="tk-prep-gold" id="tk-prep-gold"></div>' +
    '        <div class="tk-prep-actions">' +
    '          <button type="button" class="btn" id="tk-prep-close"></button>' +
    '          <button type="button" class="btn green" id="tk-prep-start"></button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var pickEl = document.getElementById('tk-pick');
  var battleEl = document.getElementById('tk-battle');
  var pickTitle = document.getElementById('tk-pick-title');
  var pickSub = document.getElementById('tk-pick-sub');
  var pickBest = document.getElementById('tk-pick-best');
  var pickTools = document.getElementById('tk-pick-tools');
  var levelsEl = document.getElementById('tk-levels');
  var diffEl = document.getElementById('tk-diff');
  var diffNote = document.getElementById('tk-diff-note');
  var boardEl = document.getElementById('tk-board');
  var boardWrap = document.getElementById('tk-boardWrap');
  var boardView = document.getElementById('tk-boardView');
  var fxCanvas = document.getElementById('tk-fx');
  var zoomOutBtn = document.getElementById('tk-zoom-out');
  var zoomInBtn = document.getElementById('tk-zoom-in');
  var zoomToggleBtn = document.getElementById('tk-zoom-toggle');
  var zoomResetBtn = document.getElementById('tk-zoom-reset');
  var zoomHintEl = document.getElementById('tk-zoom-hint');
  var msgEl = document.getElementById('tk-msg');
  var detailEl = document.getElementById('tk-detail');
  var levelEl = document.getElementById('tk-level');
  var turnEl = document.getElementById('tk-turn');
  var myEl = document.getElementById('tk-my');
  var enEl = document.getElementById('tk-en');
  var readyEl = document.getElementById('tk-ready');
  var scoreEl = document.getElementById('tk-score');
  var endBtn = document.getElementById('tk-end');
  var hintBtn = document.getElementById('tk-hint');
  var changeBtn = document.getElementById('tk-change');
  var overlayEl = document.getElementById('tk-overlay');
  var ovTitle = document.getElementById('tk-ov-title');
  var ovText = document.getElementById('tk-ov-text');
  var ovStars = document.getElementById('tk-ov-stars');
  var ovStats = document.getElementById('tk-ov-stats');
  var ovActions = document.getElementById('tk-ov-actions');
  var prepEl = document.getElementById('tk-prep');
  var prepTitle = document.getElementById('tk-prep-title');
  var prepSub = document.getElementById('tk-prep-sub');
  var prepBody = document.getElementById('tk-prep-body');
  var prepNote = document.getElementById('tk-prep-note');
  var prepGold = document.getElementById('tk-prep-gold');
  var prepClose = document.getElementById('tk-prep-close');
  var prepStart = document.getElementById('tk-prep-start');
  var tabSkill = document.getElementById('tk-tab-skill');
  var tabGear = document.getElementById('tk-tab-gear');

  pickTitle.textContent = T('gs.tactics.pickTitle');
  pickSub.textContent = T('gs.tactics.pickSub');
  document.getElementById('tk-help').innerHTML = T('gs.tactics.helpText');

  /* ---------- 状态 ---------- */
  var screen = 'pick';
  var levelIdx = 0;
  var pendingLevel = null;
  var prepTab = 'skills';
  var grid = [];
  var units = [];
  var turn = 1;
  var score = 0;
  var over = false;
  var phase = 'player';       // player | moving | combat | ai | result
  var selUnit = null;
  var moveCells = [];
  var atkCells = [];
  var moveMap = {};
  var cursor = { x: 1, y: 1 };
  var battleId = 0;
  var timers = [];
  var submitted = false;
  var nextUnitId = 1;
  var difficulty = 'normal';
  var fxW = 0, fxH = 0, fxCtx = null;
  var geom = { cell: 40, gap: 2, pad: 6, border: 1, scale: 1, ox: 0, oy: 0 };
  var cellEls = [];
  var zoom = 1;               // 棋盘缩放：1.0 = 全览；放大后单格 ≥40px
  var suppressClick = false;  // 拖拽平移后吞掉一次 click
  var loopApi = null;
  var CLEAR_KEY = 'arcade_tactics_cleared_v1';
  var DIFF_KEY = 'arcade_tactics_diff_v1';
  var inputLock = false;      // 动画/结算期间输入硬锁
  var startMyCount = 0;
  var aiLog = [];
  var aiRunning = false;
  var lastStarsEarned = 0;

  var effects = { floaters: [], parts: [], shots: [], slashes: [], rings: [] };

  /* ---------- 进度 / 星级 / 金币 / 技能 / 装备 ---------- */
  function readCleared() {
    try {
      var a = JSON.parse(localStorage.getItem(CLEAR_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function markCleared(idx) {
    var a = readCleared();
    a[idx] = true;
    try { localStorage.setItem(CLEAR_KEY, JSON.stringify(a)); } catch (e) {}
  }
  function levelUnlocked(idx, cleared) {
    if (idx === 0) return true;
    return !!(cleared[idx] || cleared[idx - 1]);
  }
  function readDiff() {
    try {
      var d = localStorage.getItem(DIFF_KEY);
      if (AI_PROFILES[d]) return d;
    } catch (e) {}
    return 'normal';
  }
  function saveDiff(d) {
    difficulty = d;
    try { localStorage.setItem(DIFF_KEY, d); } catch (e) {}
  }

  function clampInt(v, a, b) { v = Number(v); if (!isFinite(v)) return a; return v < a ? a : (v > b ? b : v); }

  function readMeta() {
    var m = null;
    try { m = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) {}
    var out = {
      version: 2, gold: 0, stars: {},
      skills: [], owned: DEF_META.owned.slice(),
      equipped: { weapon: 'w_blade', armor: 'a_vest', trinket: 't_charm' }
    };
    if (m && typeof m === 'object') {
      out.gold = Math.max(0, Number(m.gold) || 0);
      if (m.stars && typeof m.stars === 'object') {
        for (var k in m.stars) if (Object.prototype.hasOwnProperty.call(m.stars, k)) {
          out.stars[k] = clampInt(m.stars[k], 0, 3);
        }
      }
      if (Array.isArray(m.skills)) {
        for (var i = 0; i < m.skills.length; i++) if (skillDef(m.skills[i]) && out.skills.indexOf(m.skills[i]) < 0) out.skills.push(m.skills[i]);
      }
      if (Array.isArray(m.owned)) {
        out.owned = [];
        for (var j = 0; j < m.owned.length; j++) if (itemDef(m.owned[j]) && out.owned.indexOf(m.owned[j]) < 0) out.owned.push(m.owned[j]);
      }
      if (m.equipped && typeof m.equipped === 'object') {
        for (var s = 0; s < SLOTS.length; s++) {
          var slot = SLOTS[s], id = m.equipped[slot];
          if (itemDef(id) && itemDef(id).slot === slot && (out.owned.indexOf(id) >= 0 || itemDef(id).price === 0)) out.equipped[slot] = id;
        }
      }
    }
    return out;
  }
  function writeMeta(m) {
    try { localStorage.setItem(META_KEY, JSON.stringify(m)); return true; } catch (e) { return false; }
  }
  function totalStars() {
    var m = readMeta(), cleared = readCleared(), sum = 0;
    for (var i = 0; i < LEVELS.length; i++) {
      var st = m.stars[i];
      if (typeof st !== 'number' || st <= 0) st = cleared[i] ? 1 : 0;
      sum += clampInt(st, 0, 3);
    }
    return sum;
  }
  function chapterStars(ch) {
    var m = readMeta(), cleared = readCleared(), sum = 0;
    for (var i = ch * 3; i < ch * 3 + 3; i++) {
      var st = m.stars[i];
      if (typeof st !== 'number' || st <= 0) st = cleared[i] ? 1 : 0;
      sum += clampInt(st, 0, 3);
    }
    return sum;
  }
  function clearedCount() {
    var a = readCleared(), n = 0;
    for (var i = 0; i < LEVELS.length; i++) if (a[i]) n++;
    return n;
  }
  function gearBonus() {
    var m = readMeta();
    var b = { hp: 0, atk: 0, atkRanged: 0, mov: 0, rngRanged: 0, hit: 0, ignoreForest: false };
    for (var i = 0; i < SLOTS.length; i++) {
      var it = itemDef(m.equipped[SLOTS[i]]);
      if (!it) continue;
      for (var k in it.bonus) if (Object.prototype.hasOwnProperty.call(it.bonus, k)) {
        if (k === 'ignoreForest') b.ignoreForest = b.ignoreForest || !!it.bonus[k];
        else b[k] += it.bonus[k];
      }
    }
    return b;
  }
  function skillBonusFor(type) {
    var m = readMeta();
    var b = { hp: 0, atk: 0, mov: 0, rng: 0, hit: 0, pierce: false };
    for (var i = 0; i < SKILLS.length; i++) {
      var sk = SKILLS[i];
      if (m.skills.indexOf(sk.id) < 0) continue;
      if (sk.target !== 'all' && sk.target !== type) continue;
      if (sk.stat === 'pierce') b.pierce = true;
      else if (typeof b[sk.stat] === 'number') b[sk.stat] += sk.add;
    }
    return b;
  }
  function buyGoldEnough(price) { return readMeta().gold >= price; }

  /* ---------- 断点续玩（Arcade.savegame） ---------- */
  function writeSave() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write()); }
  function clearSave() { if (window.Arcade && Arcade.savegame) Arcade.savegame.clear(); }
  function tryResume() { return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume()); }

  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'tactics',
      collect: function () {
        if (screen !== 'battle' || over) return null;
        return {
          v: 3, levelIdx: levelIdx, turn: turn, score: score, startMyCount: startMyCount,
          units: units.map(function (u) {
            return {
              id: u.id, side: u.side, type: u.type, x: u.x, y: u.y,
              hp: u.hp, maxHp: u.maxHp, atk: u.atk, mov: u.mov, rng: u.rng,
              acted: !!u.acted, moved: !!u.moved, moveSpent: !!u.moveSpent,
              hitBonus: u.hitBonus || 0, ignoreForest: !!u.ignoreForest, boss: !!u.boss
            };
          })
        };
      },
      apply: function (s) {
        if (!s || !Array.isArray(s.units)) return false;
        var lv = typeof s.levelIdx === 'number' ? s.levelIdx : s.level;
        if (typeof lv !== 'number' || lv < 0 || lv >= LEVELS.length) return false;
        if (s.over) return false;
        levelIdx = lv;
        var rows = LEVELS[levelIdx].map;
        grid = [];
        for (var y = 0; y < rows.length; y++) {
          var row = [];
          for (var x = 0; x < rows[y].length; x++) {
            var ch = rows[y][x];
            row.push({ hill: ch === 'H', forest: ch === 'F', wall: ch === '#', unit: null });
          }
          grid.push(row);
        }
        turn = s.turn || 1;
        score = s.score || 0;
        startMyCount = (typeof s.startMyCount === 'number') ? s.startMyCount : 0;
        over = false; submitted = false; phase = 'player'; inputLock = false;
        selUnit = null; moveCells = []; atkCells = []; moveMap = {};
        units = [];
        nextUnitId = 1;
        for (var i = 0; i < s.units.length; i++) {
          var ru = s.units[i];
          if (!ru || !TYPES[ru.type]) continue;
          if (!inBounds(grid, ru.x, ru.y)) continue;
          var td = typeDef(ru.type);
          var u = {
            id: nextUnitId++, side: ru.side === 'en' ? 'en' : 'my', type: ru.type,
            x: ru.x, y: ru.y, hp: typeof ru.hp === 'number' ? ru.hp : td.hp,
            maxHp: ru.maxHp || td.hp, atk: ru.atk || td.atk, mov: ru.mov || td.mov, rng: ru.rng || td.rng,
            acted: !!ru.acted, moved: !!ru.moved, moveSpent: !!ru.moveSpent || !!ru.moved,
            hitBonus: Number(ru.hitBonus) || 0, ignoreForest: !!ru.ignoreForest,
            boss: !!ru.boss || ru.type === 'boss',
            flash: 0, anim: null, lungeT: 0, lungeDX: 0, lungeDY: 0
          };
          if (u.hp <= 0) continue;
          if (grid[u.y][u.x].unit) continue;
          units.push(u);
          grid[u.y][u.x].unit = u;
        }
        if (!units.length) return false;
        if (!startMyCount) startMyCount = aliveList('my').length;
        cursor.x = 1; cursor.y = 1;
        screen = 'battle';
        pendingLevel = null;
        prepEl.classList.add('hidden');
        pickEl.classList.add('hidden');
        battleEl.classList.remove('hidden');
        overlayEl.classList.add('hidden');
        if (Arcade.ui) Arcade.ui.setGamePhase('playing');
        buildBoard();
        layoutBoard();
        updateHud();
        updateHighlights();
        updateDetail();
        setMsg(T('gs.tactics.level' + (levelIdx + 1) + 'h'));
        startLoop();
        return true;
      }
    });
  }

  /* ---------- 计时器（统一清理；battleId 防跨局回调） ---------- */
  function later(fn, ms) {
    var bid = battleId;
    var id = setTimeout(function () {
      var at = timers.indexOf(id);
      if (at >= 0) timers.splice(at, 1);
      if (bid !== battleId) return;
      fn();
    }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }

  function tick() { /* 动画与特效均按时间戳绘制，无需固定步进 */ }

  function startLoop() {
    if (loopApi) { if (!loopApi.isRunning()) loopApi.resume(); return; }
    loopApi = Arcade.loop.start(tick, drawFrame, 16);
  }

  function setMsg(text, tone) {
    msgEl.textContent = text || '';
    msgEl.className = 'tk-msg' + (tone ? ' ' + tone : '');
  }
  function nameOf(u) { return T('gs.tactics.unit.' + u.type + '.n'); }
  function roleName(u) { return T('gs.tactics.role.' + typeDef(u.type).role); }
  function aliveList(side) {
    return units.filter(function (u) { return u.side === side && u.hp > 0; });
  }
  function unitAlive(u) { return !!u && u.hp > 0 && units.indexOf(u) >= 0; }

  /* ---------- 棋盘布局 / 坐标换算（基于 getBoundingClientRect） ---------- */
  function buildBoard() {
    boardEl.innerHTML = '';
    cellEls = [];
    for (var y = 0; y < grid.length; y++) {
      var row = [];
      for (var x = 0; x < grid[y].length; x++) {
        var c = grid[y][x];
        var d = document.createElement('div');
        var cls = 'tk-cell ';
        if (c.wall) cls += 'wall';
        else if (c.hill) cls += 'hill';
        else if (c.forest) cls += 'forest';
        else cls += 'grass' + ((x + y) % 2 ? ' alt' : '');
        d.className = cls;
        d.setAttribute('data-x', x);
        d.setAttribute('data-y', y);
        d.setAttribute('role', 'gridcell');
        d.setAttribute('aria-label', T('gs.tactics.cellAria').replace('{x}', x + 1).replace('{y}', y + 1));
        boardEl.appendChild(d);
        row.push(d);
      }
      cellEls.push(row);
    }
    layoutBoard();
  }

  function layoutBoard() {
    if (!grid.length) return;
    var cols = grid[0].length, rowsN = grid.length;
    var vw = window.innerWidth || 375;
    var wrapPad = vw <= 360 ? 4 : 20;
    var maxBoard = Math.min(vw, 600) * (vw <= 360 ? 1 : 0.98) - wrapPad - (vw <= 360 ? 4 : 4);
    var PAD = vw <= 360 ? 4 : 6, GAP = 2, BORDER = 1;
    var base = Math.floor((maxBoard - 2 * (PAD + BORDER) - GAP * (cols - 1)) / cols);
    base = GK.clamp(base, 28, 56);
    var cell = GK.clamp(Math.round(base * zoom), 28, 88);
    boardEl.style.setProperty('--tk-cell', cell + 'px');
    boardEl.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cell + 'px)';
    boardEl.style.gridTemplateRows = 'repeat(' + rowsN + ', ' + cell + 'px)';
    boardEl.style.gap = GAP + 'px';
    boardEl.style.padding = PAD + 'px';
    syncCanvas();
    measureBoard();
  }

  /* 把网格几何缓存下来；窗口缩放/旋转后重新测量 */
  function measureBoard() {
    if (!grid.length || !boardEl.offsetWidth) return;
    var br = boardEl.getBoundingClientRect();
    var wr = boardWrap.getBoundingClientRect();
    var scale = boardEl.offsetWidth > 0 ? br.width / boardEl.offsetWidth : 1;
    var cs = parseFloat(getComputedStyle(boardEl).getPropertyValue('--tk-cell')) || 40;
    var gap = parseFloat(getComputedStyle(boardEl).gap) || 2;
    var padL = parseFloat(getComputedStyle(boardEl).paddingLeft) || 6;
    var padT = parseFloat(getComputedStyle(boardEl).paddingTop) || 6;
    var bdL = parseFloat(getComputedStyle(boardEl).borderLeftWidth) || 1;
    var bdT = parseFloat(getComputedStyle(boardEl).borderTopWidth) || 1;
    geom = {
      cell: cs, gap: gap, pad: padL, border: bdL, scale: scale,
      ox: (br.left - wr.left) + (padL + bdL) * scale,
      oy: (br.top - wr.top) + (padT + bdT) * scale
    };
  }

  function syncCanvas() {
    if (!fxCanvas || !boardEl.offsetWidth) return;
    var br = boardEl.getBoundingClientRect();
    var wr = boardWrap.getBoundingClientRect();
    var w = Math.round(br.width), h = Math.round(br.height);
    if (w < 1 || h < 1) return;
    if (!fxCtx || w !== fxW || h !== fxH) {
      var s = GK.setup(fxCanvas, w, h);
      fxCtx = s.ctx; fxW = s.w; fxH = s.h;
      fxCanvas.style.left = '0px';
      fxCanvas.style.top = '0px';
    }
    var relL = Math.round(br.left - wr.left), relT = Math.round(br.top - wr.top);
    if (relL !== 0 || relT !== 0) {
      fxCanvas.style.left = relL + 'px';
      fxCanvas.style.top = relT + 'px';
    }
  }

  /* 单元格矩形（画布逻辑坐标，已考虑 CSS 缩放与棋盘偏移） */
  function cellRect(x, y) {
    var s = geom.cell * geom.scale;
    var pitch = (geom.cell + geom.gap) * geom.scale;
    var left = geom.ox + x * pitch;
    var top = geom.oy + y * pitch;
    return { x: left, y: top, w: s, h: s, cx: left + s / 2, cy: top + s / 2 };
  }
  function cellCenter(gx, gy) {
    var s = geom.cell * geom.scale;
    var pitch = (geom.cell + geom.gap) * geom.scale;
    return { x: geom.ox + gx * pitch + s / 2, y: geom.oy + gy * pitch + s / 2 };
  }

  /* ---------- 棋盘缩放 / 平移（双指缩放 + 拖拽 + 双击复位） ---------- */
  var ZOOM_MIN = 1, ZOOM_MAX = 2, ZOOM_STEP = 0.2, ZOOM_TOGGLE = 1.6;
  function zoomLabel() { return zoom.toFixed(1) + '×'; }
  function updateZoomUI() {
    if (zoomToggleBtn) {
      zoomToggleBtn.textContent = zoomLabel();
      zoomToggleBtn.classList.toggle('active', zoom > 1.001);
    }
    if (boardView) boardView.classList.toggle('zoomed', zoom > 1.001);
    if (zoomHintEl) zoomHintEl.textContent = T('gs.tactics.zoomHint');
  }
  /* 以屏幕坐标 (clientX/clientY) 为锚点缩放，保持锚点下的格不漂移 */
  function setZoom(z, clientX, clientY) {
    z = GK.clamp(Math.round(z * 10) / 10, ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(z - zoom) < 0.001) { updateZoomUI(); return; }
    var r = boardView ? boardView.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    var fx = (typeof clientX === 'number') ? clientX - r.left : r.width / 2;
    var fy = (typeof clientY === 'number') ? clientY - r.top : r.height / 2;
    var sx = (boardView ? boardView.scrollLeft : 0) + fx;
    var sy = (boardView ? boardView.scrollTop : 0) + fy;
    var k = z / zoom;
    zoom = z;
    layoutBoard();
    if (boardView) {
      boardView.scrollLeft = Math.max(0, sx * k - fx);
      boardView.scrollTop = Math.max(0, sy * k - fy);
    }
    updateZoomUI();
  }
  function resetZoom() {
    if (zoom !== 1) { zoom = 1; layoutBoard(); }
    if (boardView) { boardView.scrollLeft = 0; boardView.scrollTop = 0; }
    updateZoomUI();
  }

  /* ---------- 高亮 / 详情 / HUD ---------- */
  function updateHighlights() {
    if (!cellEls.length) return;
    var moveSet = {}, atkSet = {}, tgtSet = {};
    for (var i = 0; i < moveCells.length; i++) moveSet[keyOf(moveCells[i].x, moveCells[i].y)] = true;
    for (var j = 0; j < atkCells.length; j++) atkSet[keyOf(atkCells[j].x, atkCells[j].y)] = true;
    if (selUnit) {
      var rr = unitRange(selUnit, grid[selUnit.y][selUnit.x]);
      for (var k = 0; k < units.length; k++) {
        var eu = units[k];
        if (eu.side === selUnit.side || eu.hp <= 0) continue;
        var d = Math.abs(eu.x - selUnit.x) + Math.abs(eu.y - selUnit.y);
        if (d > 0 && d <= rr) tgtSet[keyOf(eu.x, eu.y)] = true;
      }
    }
    for (var y = 0; y < cellEls.length; y++) {
      for (var x = 0; x < cellEls[y].length; x++) {
        var el = cellEls[y][x];
        var kk = keyOf(x, y);
        el.classList.toggle('sel', !!(selUnit && selUnit.x === x && selUnit.y === y));
        el.classList.toggle('canmove', !!moveSet[kk]);
        el.classList.toggle('canatk', !!atkSet[kk]);
        el.classList.toggle('target', !!tgtSet[kk]);
        el.classList.toggle('cursor', !!cursor && cursor.x === x && cursor.y === y);
      }
    }
  }

  function updateDetail() {
    if (selUnit && unitAlive(selUnit)) {
      var u = selUnit;
      var cell = grid[u.y][u.x];
      var html =
        '<span class="tk-chip"><b>' + nameOf(u) + '</b> ' + roleName(u) + '</span>' +
        '<span class="tk-chip hp">HP <b>' + Math.max(0, u.hp) + '/' + u.maxHp + '</b></span>' +
        '<span class="tk-chip atk">ATK <b>' + u.atk + '</b></span>' +
        '<span class="tk-chip mov">MOV <b>' + u.mov + '</b></span>' +
        '<span class="tk-chip rng">RNG <b>' + unitRange(u, cell) + '</b></span>';
      if (cell.hill) html += '<span class="tk-chip good">' + T('gs.tactics.hillTag') + '</span>';
      if (cell.forest) html += '<span class="tk-chip good">' + T('gs.tactics.forestTag') + '</span>';
      if (u.ignoreForest) html += '<span class="tk-chip good">' + T('gs.tactics.gear.bPierce') + '</span>';
      html += '<span class="tk-chip ' + (u.acted ? 'warn' : 'good') + '">' +
        (u.acted ? T('gs.tactics.stActed') : ((u.moved || u.moveSpent) ? T('gs.tactics.stMoved') : T('gs.tactics.stReady'))) + '</span>';
      detailEl.innerHTML = html;
    } else {
      detailEl.innerHTML = '<span class="tk-chip">' + T('gs.tactics.detailIdle') + '</span>';
    }
  }

  function updateHud() {
    if (!LEVELS[levelIdx]) return;
    levelEl.textContent = (levelIdx + 1);
    turnEl.textContent = turn + '/' + LEVELS[levelIdx].limit;
    myEl.textContent = aliveList('my').length;
    enEl.textContent = aliveList('en').length;
    readyEl.textContent = units.filter(function (u) { return u.side === 'my' && u.hp > 0 && !u.acted; }).length;
    scoreEl.textContent = score;
  }

  function playerAttackTargets() {
    if (!selUnit) return [];
    var r = unitRange(selUnit, grid[selUnit.y][selUnit.x]);
    return units.filter(function (u) {
      return u.side !== selUnit.side && u.hp > 0 && Math.abs(u.x - selUnit.x) + Math.abs(u.y - selUnit.y) <= r;
    });
  }

  /* ---------- 特效数据（全部使用格坐标，窗口缩放后仍准确） ---------- */
  function floatText(gx, gy, text, color) {
    effects.floaters.push({ gx: gx, gy: gy, text: text, color: color || '#fff', t0: performance.now(), dur: 900 });
  }
  function spawnParticles(gx, gy, color, count, power) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (0.6 + Math.random() * 1.4) * (power || 1);
      effects.parts.push({
        gx: gx, gy: gy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8 * (power || 1),
        color: color, size: 1.4 + Math.random() * 2.2, t0: performance.now(), dur: 520 + Math.random() * 360
      });
    }
  }
  function spawnRing(gx, gy, color, maxR) {
    effects.rings.push({ gx: gx, gy: gy, color: color, maxR: maxR || 1.2, t0: performance.now(), dur: 480 });
  }
  function spawnShot(sx, sy, tx, ty, kind, color) {
    effects.shots.push({
      sx: sx, sy: sy, tx: tx, ty: ty, kind: kind || 'arrow',
      color: color || '#ffe600', t0: performance.now(), dur: kind === 'orb' ? 420 : 280
    });
  }
  function spawnSlash(sx, sy, tx, ty, color) {
    effects.slashes.push({ sx: sx, sy: sy, tx: tx, ty: ty, color: color || '#fff', t0: performance.now(), dur: 320 });
  }
  function spawnBurst(gx, gy, color, power) {
    spawnParticles(gx, gy, color, 8 + Math.round(power * 4), power);
    spawnRing(gx, gy, color, 0.9 + power * 0.25);
  }

  var ctx = null;
  function padCtx() { if (!ctx && fxCtx) ctx = fxCtx; return ctx; }

  function visualPos(u) {
    if (u.anim) {
      var t = (performance.now() - u.anim.t0) / u.anim.dur;
      if (t >= 1) { u.anim = null; return { x: u.x, y: u.y }; }
      var e = GK.easeInOutCubic(t);
      return { x: GK.lerp(u.anim.fx, u.x, e), y: GK.lerp(u.anim.fy, u.y, e) };
    }
    return { x: u.x, y: u.y };
  }

  function drawFrame() {
    var c = padCtx();
    if (!c) return;
    c.clearRect(0, 0, fxW, fxH);
    if ((screen !== 'battle' && screen !== 'result') || !grid.length) return;
    var now = performance.now();
    var cell = geom.cell * geom.scale;
    var R = cell * 0.34;

    pruneEffects(now, cell);

    // 1) 底层粒子
    for (var p = 0; p < effects.parts.length; p++) {
      var pt = effects.parts[p];
      var age = now - pt.t0;
      if (age > pt.dur) continue;
      var kk = age / 1000;
      var pos = cellCenter(pt.gx + pt.vx * kk, pt.gy + pt.vy * kk);
      var life = 1 - age / pt.dur;
      c.globalAlpha = Math.max(0, life);
      c.fillStyle = pt.color;
      c.beginPath();
      c.arc(pos.x, pos.y, pt.size * geom.scale * (0.4 + life * 0.6), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // 2) 单位（按行排序，保证遮挡自然）
    var drawList = units.slice().sort(function (a, b) { return visualPos(a).y - visualPos(b).y; });
    for (var i = 0; i < drawList.length; i++) drawUnit(c, drawList[i], now, cell, R);

    // 3) 斩击
    for (var s = 0; s < effects.slashes.length; s++) drawSlash(c, effects.slashes[s], now, cell);
    // 4) 投射物
    for (var sh = 0; sh < effects.shots.length; sh++) drawShot(c, effects.shots[sh], now, cell);
    // 5) 冲击波
    for (var rg = 0; rg < effects.rings.length; rg++) drawRing(c, effects.rings[rg], now, cell);
    // 6) 伤害数字
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (var f = 0; f < effects.floaters.length; f++) {
      var fl = effects.floaters[f];
      var ft = (now - fl.t0) / fl.dur;
      if (ft < 0 || ft >= 1) continue;
      var cp = cellCenter(fl.gx, fl.gy);
      var fe = 1 - Math.pow(1 - ft, 3); /* easeOutCubic：起飞快、收尾缓 */
      var fy = cp.y - cell * (0.45 + fe * 1.05);
      var pop = GK.easeOutBack(Math.min(1, ft / 0.32));
      var fs = 0.72 + 0.28 * pop;
      c.globalAlpha = 1 - ft * ft;
      c.save();
      c.translate(cp.x, fy);
      c.scale(fs, fs);
      c.font = '900 ' + Math.round(cell * 0.38) + 'px "Press Start 2P","Fusion Pixel","Microsoft YaHei",sans-serif';
      c.lineWidth = Math.max(2, cell * 0.07);
      c.strokeStyle = 'rgba(0,0,0,.75)';
      c.strokeText(fl.text, 0, 0);
      c.fillStyle = fl.color;
      c.fillText(fl.text, 0, 0);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  function pruneEffects(now) {
    effects.parts = effects.parts.filter(function (p) { return now - p.t0 < p.dur; });
    effects.shots = effects.shots.filter(function (s) { return now - s.t0 < s.dur; });
    effects.slashes = effects.slashes.filter(function (s) { return now - s.t0 < s.dur; });
    effects.rings = effects.rings.filter(function (r) { return now - r.t0 < r.dur; });
    effects.floaters = effects.floaters.filter(function (f) { return now - f.t0 < f.dur; });
  }

  function drawSlash(c, s, now, cell) {
    var t = (now - s.t0) / s.dur;
    if (t < 0 || t >= 1) return;
    var a = cellCenter(s.sx, s.sy);
    var b = cellCenter(s.tx, s.ty);
    var ang = Math.atan2(b.y - a.y, b.x - a.x);
    var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    var rad = cell * (0.34 + t * 0.22);
    c.save();
    c.translate(mid.x, mid.y);
    c.rotate(ang);
    c.globalAlpha = 1 - t;
    var grd = c.createLinearGradient(-rad, 0, rad, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, s.color);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = grd;
    c.lineWidth = Math.max(2, cell * 0.11);
    c.beginPath();
    c.arc(0, 0, rad, -1.15 + t * 0.5, 1.15 + t * 0.5);
    c.stroke();
    c.globalAlpha = (1 - t) * 0.6;
    c.lineWidth = Math.max(1, cell * 0.04);
    c.beginPath();
    c.arc(0, 0, rad * 1.18, -0.9 + t * 0.5, 0.9 + t * 0.5);
    c.stroke();
    c.restore();
  }

  function drawShot(c, s, now, cell) {
    var t = (now - s.t0) / s.dur;
    if (t < 0 || t >= 1) return;
    var e = GK.easeOutQuad(t);
    var a = cellCenter(s.sx, s.sy);
    var b = cellCenter(s.tx, s.ty);
    var x = GK.lerp(a.x, b.x, e), y = GK.lerp(a.y, b.y, e);
    var px = GK.lerp(a.x, b.x, Math.max(0, e - 0.22)), py = GK.lerp(a.y, b.y, Math.max(0, e - 0.22));
    c.save();
    c.strokeStyle = s.color;
    c.lineWidth = Math.max(1.5, cell * 0.05);
    c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
    if (s.kind === 'orb') {
      var g = c.createRadialGradient(x, y, 1, x, y, cell * 0.26);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, s.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, cell * 0.26, 0, Math.PI * 2); c.fill();
    } else if (s.kind === 'bullet') {
      c.fillStyle = '#fff';
      c.fillRect(x - cell * 0.06, y - cell * 0.03, cell * 0.12, cell * 0.06);
    } else {
      c.strokeStyle = '#ffffff';
      c.lineWidth = Math.max(1.5, cell * 0.04);
      c.beginPath(); c.moveTo(x - cell * 0.16, y + cell * 0.02); c.lineTo(x + cell * 0.14, y - cell * 0.02); c.stroke();
    }
    c.restore();
  }

  function drawRing(c, r, now, cell) {
    var t = (now - r.t0) / r.dur;
    if (t < 0 || t >= 1) return;
    var p = cellCenter(r.gx, r.gy);
    c.save();
    c.globalAlpha = (1 - t) * 0.85;
    c.strokeStyle = r.color;
    c.lineWidth = Math.max(1.5, cell * 0.07);
    c.beginPath();
    c.arc(p.x, p.y, cell * (0.2 + r.maxR * GK.easeOutCubic(t)), 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function drawUnit(c, u, now, cell, R) {
    var vp = visualPos(u);
    var cp = cellCenter(vp.x, vp.y);
    var bob = u.anim ? 0 : Math.sin(now / 640 + u.id * 1.4) * cell * 0.028;
    var lunge = 0;
    if (u.lungeT) {
      var lt = (now - u.lungeT) / 220;
      if (lt < 1) lunge = Math.sin(lt * Math.PI) * cell * 0.16;
      else u.lungeT = 0;
    }
    var x = cp.x + u.lungeDX * lunge;
    var y = cp.y + bob + u.lungeDY * lunge;
    var col = u.side === 'my' ? '#00f0ff' : (u.type === 'boss' ? '#ffe600' : '#ff2d95');
    var dark = u.side === 'my' ? '#045f6e' : (u.type === 'boss' ? '#7a6400' : '#7a0d45');

    c.save();
    c.translate(x, y);
    // 阴影
    c.fillStyle = 'rgba(0,0,0,.42)';
    c.beginPath();
    c.ellipse(0, R * 0.92, R * 0.82, R * 0.26, 0, 0, Math.PI * 2);
    c.fill();
    // 阵营底光
    c.globalAlpha = 0.16;
    c.fillStyle = col;
    c.beginPath();
    c.arc(0, 0, R * 1.08, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = u.acted ? 0.4 : 1;
    // 身体
    var bg = c.createLinearGradient(0, -R, 0, R);
    bg.addColorStop(0, col);
    bg.addColorStop(0.45, dark);
    bg.addColorStop(1, u.side === 'my' ? '#053c46' : '#3a0a24');
    c.fillStyle = bg;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.lineWidth = Math.max(1, cell * 0.035);
    c.stroke();
    // 类型武器
    drawGlyph(c, u, R, col);
    // 受击闪白
    if (u.flash > 0) {
      c.globalAlpha = Math.min(0.85, u.flash / 12);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(0, 0, R * 1.02, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    // 已行动灰化 + 勾标
    if (u.acted) {
      c.globalAlpha = 0.34;
      c.fillStyle = '#6b7280';
      c.beginPath();
      c.arc(0, 0, R, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 0.95;
      c.fillStyle = '#cbd5e1';
      c.font = '700 ' + Math.round(R * 0.7) + 'px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('✓', 0, 1);
    }
    // 选中环
    if (selUnit === u && !over) {
      c.globalAlpha = 0.9;
      c.strokeStyle = '#ffe600';
      c.lineWidth = Math.max(1.5, cell * 0.055);
      c.setLineDash([cell * 0.14, cell * 0.1]);
      c.lineDashOffset = -(now / 34) % (cell * 0.24);
      c.beginPath();
      c.arc(0, 0, R * 1.18, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.beginPath();
      c.moveTo(0, -R * 1.5);
      c.lineTo(-cell * 0.07, -R * 1.62);
      c.lineTo(cell * 0.07, -R * 1.62);
      c.closePath();
      c.fillStyle = '#ffe600';
      c.fill();
    }
    c.globalAlpha = 1;
    c.restore();

    // 血条（不受浮动影响，按格坐标绘制）
    var hbw = cell * (u.type === 'boss' ? 0.86 : 0.68);
    var hbh = Math.max(3, cell * 0.075);
    var hbx = cp.x - hbw / 2;
    var hby = cp.y - R * 1.52 - hbh;
    c.fillStyle = 'rgba(0,0,0,.7)';
    c.fillRect(hbx - 1, hby - 1, hbw + 2, hbh + 2);
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.fillRect(hbx, hby, hbw, hbh);
    var ratio = Math.max(0, Math.min(1, u.hp / u.maxHp));
    c.fillStyle = ratio > 0.5 ? '#39ff14' : (ratio > 0.25 ? '#ffe600' : '#ff2d95');
    c.fillRect(hbx, hby, hbw * ratio, hbh);
    c.strokeStyle = 'rgba(255,255,255,.28)';
    c.lineWidth = 1;
    c.strokeRect(hbx - 0.5, hby - 0.5, hbw + 1, hbh + 1);
    // 行动状态点：待行动=青色，已移动=黄色，已行动=灰
    c.fillStyle = u.acted ? '#8a94a8' : ((u.moved || u.moveSpent) ? '#ffe600' : '#00f0ff');
    c.beginPath();
    c.arc(hbx + hbw + cell * 0.08, hby + hbh / 2, Math.max(1.6, cell * 0.032), 0, Math.PI * 2);
    c.fill();
  }

  function drawGlyph(c, u, R, col) {
    var line = Math.max(1.4, R * 0.13);
    c.save();
    c.strokeStyle = '#eaf6ff';
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.lineWidth = line;
    c.lineCap = 'round';
    var t = u.type;
    if (t === 'sword') {
      c.beginPath();
      c.moveTo(-R * 0.52, -R * 0.34);
      c.lineTo(-R * 0.18, -R * 0.46);
      c.lineTo(-R * 0.05, -R * 0.12);
      c.lineTo(-R * 0.25, R * 0.36);
      c.lineTo(-R * 0.55, R * 0.1);
      c.closePath();
      c.fillStyle = 'rgba(220,240,255,.5)';
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(R * 0.06, R * 0.52);
      c.lineTo(R * 0.42, -R * 0.58);
      c.stroke();
      c.beginPath();
      c.moveTo(R * 0.18, R * 0.22);
      c.lineTo(R * 0.45, R * 0.1);
      c.stroke();
    } else if (t === 'archer') {
      c.beginPath();
      c.arc(-R * 0.06, 0, R * 0.56, -1.15, 1.15);
      c.stroke();
      c.beginPath();
      c.moveTo(R * 0.18, -R * 0.52);
      c.lineTo(R * 0.18, R * 0.52);
      c.stroke();
      c.beginPath();
      c.moveTo(-R * 0.2, 0);
      c.lineTo(R * 0.55, -R * 0.18);
      c.stroke();
      c.beginPath();
      c.moveTo(R * 0.55, -R * 0.18);
      c.lineTo(R * 0.38, -R * 0.3);
      c.moveTo(R * 0.55, -R * 0.18);
      c.lineTo(R * 0.4, R * 0.02);
      c.stroke();
    } else if (t === 'mage') {
      c.beginPath();
      c.moveTo(-R * 0.4, R * 0.62);
      c.lineTo(-R * 0.2, -R * 0.5);
      c.stroke();
      c.fillStyle = col;
      c.shadowColor = col;
      c.shadowBlur = R * 0.5;
      c.beginPath();
      c.arc(-R * 0.16, -R * 0.62, R * 0.22, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    } else if (t === 'knight') {
      c.beginPath();
      c.moveTo(-R * 0.5, -R * 0.55);
      c.lineTo(-R * 0.18, -R * 0.62);
      c.lineTo(-R * 0.02, -R * 0.18);
      c.lineTo(-R * 0.28, R * 0.55);
      c.lineTo(-R * 0.56, R * 0.05);
      c.closePath();
      c.fillStyle = 'rgba(220,240,255,.42)';
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(R * 0.12, -R * 0.5);
      c.lineTo(R * 0.5, -R * 0.5);
      c.lineTo(R * 0.5, R * 0.05);
      c.lineTo(R * 0.31, R * 0.28);
      c.lineTo(R * 0.12, R * 0.05);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(R * 0.31, -R * 0.36);
      c.lineTo(R * 0.31, R * 0.06);
      c.stroke();
    } else if (t === 'gunner') {
      c.beginPath();
      c.moveTo(-R * 0.55, R * 0.1);
      c.lineTo(R * 0.5, -R * 0.3);
      c.stroke();
      c.beginPath();
      c.moveTo(R * 0.1, -R * 0.12);
      c.lineTo(R * 0.16, R * 0.18);
      c.stroke();
      c.fillStyle = '#eaf6ff';
      c.beginPath();
      c.arc(R * 0.62, -R * 0.36, R * 0.1, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(-R * 0.55, -R * 0.32);
      c.lineTo(-R * 0.32, -R * 0.82);
      c.lineTo(-R * 0.12, -R * 0.48);
      c.lineTo(0, -R * 0.9);
      c.lineTo(R * 0.12, -R * 0.48);
      c.lineTo(R * 0.32, -R * 0.82);
      c.lineTo(R * 0.55, -R * 0.32);
      c.closePath();
      c.fillStyle = '#ffe600';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.8)';
      c.stroke();
      c.beginPath();
      c.arc(0, R * 0.18, R * 0.5, 0.2, Math.PI - 0.2);
      c.strokeStyle = '#eaf6ff';
      c.stroke();
    }
    c.restore();
  }

  /* ---------- 音效 / 震屏 ---------- */
  function audio(name) { if (window.Arcade && Arcade.audio) Arcade.audio.play(name); }
  function shakeBoard() {
    if (window.Arcade && Arcade.fx && Arcade.fx.shake) {
      try { Arcade.fx.shake(boardWrap); } catch (e) {}
    }
  }
  function interactive() { return screen === 'battle' && !over && phase === 'player' && !inputLock; }

  /* ---------- 关卡构建 / 出战 ---------- */
  function applyMyLoadout(u) {
    if (u.side !== 'my') return;
    var sk = skillBonusFor(u.type);
    var gb = gearBonus();
    var ranged = typeDef(u.type).role === 'ranged';
    u.maxHp += sk.hp + gb.hp;
    u.hp = u.maxHp;
    u.atk += sk.atk + gb.atk + (ranged ? gb.atkRanged : 0);
    u.mov += sk.mov + gb.mov;
    if (ranged) u.rng += sk.rng + gb.rngRanged;
    u.hitBonus = (sk.hit + gb.hit) / 100;
    u.ignoreForest = sk.pierce || gb.ignoreForest;
  }

  function buildGridAndUnits() {
    grid = [];
    units = [];
    nextUnitId = 1;
    var rows = LEVELS[levelIdx].map;
    for (var y = 0; y < rows.length; y++) {
      var row = [];
      for (var x = 0; x < rows[y].length; x++) {
        var ch = rows[y][x];
        row.push({ hill: ch === 'H', forest: ch === 'F', wall: ch === '#', unit: null });
      }
      grid.push(row);
    }
    for (var yy = 0; yy < rows.length; yy++) {
      for (var xx = 0; xx < rows[yy].length; xx++) {
        var cu = LEVEL_UNIT[rows[yy][xx]];
        if (!cu) continue;
        var td = typeDef(cu[1]);
        var u = {
          id: nextUnitId++, side: cu[0], type: cu[1], x: xx, y: yy,
          hp: td.hp, maxHp: td.hp, atk: td.atk, mov: td.mov, rng: td.rng,
          acted: false, moved: false, moveSpent: false, hitBonus: 0, ignoreForest: false,
          boss: cu[1] === 'boss', flash: 0, anim: null, lungeT: 0, lungeDX: 0, lungeDY: 0
        };
        applyMyLoadout(u);
        units.push(u);
        grid[yy][xx].unit = u;
      }
    }
  }

  function startLevel(idx, keepScore) {
    if (idx < 0 || idx >= LEVELS.length) return;
    clearTimers();
    battleId++;
    clearSave();
    if (!keepScore) score = 0;
    over = false; submitted = false; phase = 'player'; inputLock = false;
    turn = 1; levelIdx = idx; pendingLevel = null; lastStarsEarned = 0;
    aiLog = []; aiRunning = false;
    selUnit = null; moveCells = []; atkCells = []; moveMap = {};
    effects = { floaters: [], parts: [], shots: [], slashes: [], rings: [] };
    buildGridAndUnits();
    var ctrlBar = document.querySelector('#tk-battle .game-controls');
    if (ctrlBar) ctrlBar.classList.remove('is-hidden');
    startMyCount = aliveList('my').length;
    var first = units.filter(function (u) { return u.side === 'my'; })[0];
    cursor = first ? { x: first.x, y: first.y } : { x: 1, y: 1 };

    prepEl.classList.add('hidden');
    screen = 'battle';
    pickEl.classList.add('hidden');
    battleEl.classList.remove('hidden');
    overlayEl.classList.add('hidden');
    if (Arcade.ui) Arcade.ui.setGamePhase('playing');
    buildBoard();
    updateHud();
    updateHighlights();
    updateDetail();
    setMsg(T('gs.tactics.level' + (idx + 1) + 'h'), 'ok');
    startLoop();
    audio('ui');
    writeSave();
  }

  /* ---------- 关卡选择 ---------- */
  function showPicker() {
    clearTimers();
    battleId++;
    clearSave();
    screen = 'pick'; phase = 'pick'; over = false; inputLock = false;
    aiRunning = false;
    pendingLevel = null;
    selUnit = null; moveCells = []; atkCells = []; moveMap = {};
    effects = { floaters: [], parts: [], shots: [], slashes: [], rings: [] };
    overlayEl.classList.add('hidden');
    prepEl.classList.add('hidden');
    battleEl.classList.add('hidden');
    if (Arcade.ui) Arcade.ui.setGamePhase('playing');
    pickEl.classList.remove('hidden');
    renderPicker();
  }

  function starsHtml(n, max, cls) {
    var h = '';
    for (var i = 0; i < max; i++) h += '<i class="tk-star' + (i < n ? ' on' : '') + (cls ? ' ' + cls : '') + '"></i>';
    return h;
  }

  function renderPicker() {
    var cleared = readCleared();
    var best = (window.Arcade && Arcade.storage && Arcade.storage.getBest) ? Arcade.storage.getBest('tactics') : null;
    var meta = readMeta();
    pickBest.innerHTML =
      T('gs.tactics.bestLbl').replace('{n}', best == null ? '—' : best) + ' · ' +
      T('gs.tactics.skillTotal').replace('{n}', totalStars());

    pickTools.innerHTML = '';
    var toolsBtn = document.createElement('button');
    toolsBtn.type = 'button';
    toolsBtn.className = 'btn purple';
    toolsBtn.textContent = T('gs.tactics.pickTools');
    toolsBtn.addEventListener('click', function () { audio('ui'); openPrep(null); });
    pickTools.appendChild(toolsBtn);
    var goldChip = document.createElement('span');
    goldChip.className = 'tk-gold-chip';
    goldChip.textContent = T('gs.tactics.prepGold').replace('{n}', meta.gold);
    pickTools.appendChild(goldChip);

    levelsEl.innerHTML = '';
    for (var ch = 0; ch < 3; ch++) {
      var sec = document.createElement('div');
      sec.className = 'tk-chapter';
      sec.innerHTML =
        '<div class="tk-ch-head"><span class="tk-ch-title">' + T('gs.tactics.chapter' + (ch + 1)) + '</span>' +
        '<span class="tk-ch-stars">' + starsHtml(chapterStars(ch) > 0 ? 1 : 0, 1) + ' ' +
        T('gs.tactics.chapterStars').replace('{n}', chapterStars(ch)).replace('{m}', 9) + '</span></div>';
      var list = document.createElement('div');
      list.className = 'tk-levels';
      for (var i = ch * 3; i < ch * 3 + 3; i++) {
        (function (idx) {
          var unlocked = levelUnlocked(idx, cleared);
          var done = !!cleared[idx];
          var stars = readMeta().stars[idx] || (done ? 1 : 0);
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'tk-lvl' + (unlocked ? '' : ' locked');
          b.disabled = !unlocked;
          b.innerHTML =
            '<span class="tk-lvl-num">' + (idx + 1) + '</span>' +
            '<span class="tk-lvl-body">' +
            '<span class="tk-lvl-t">' + T('gs.tactics.level' + (idx + 1) + 'n') + '</span>' +
            '<span class="tk-lvl-d">' + T('gs.tactics.level' + (idx + 1) + 'h') + '</span>' +
            '<span class="tk-lvl-stars">' + starsHtml(stars, 3) + '</span>' +
            '</span>' +
            '<span class="tk-lvl-state">' + (done ? T('gs.tactics.cleared') : (unlocked ? T('gs.tactics.pickPlay') : T('gs.tactics.locked'))) + '</span>';
          b.addEventListener('click', function () {
            if (!unlocked) { audio('error'); return; }
            audio('ui');
            pendingLevel = idx;
            openPrep(idx);
          });
          list.appendChild(b);
        })(i);
      }
      sec.appendChild(list);
      levelsEl.appendChild(sec);
    }

    diffEl.innerHTML = '';
    var diffs = ['easy', 'normal', 'hard'];
    for (var d = 0; d < diffs.length; d++) {
      (function (key) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn mode-btn' + (difficulty === key ? ' active' : '');
        b.setAttribute('aria-pressed', difficulty === key ? 'true' : 'false');
        b.textContent = T('gs.tactics.diff_' + key);
        b.addEventListener('click', function () {
          saveDiff(key);
          renderPicker();
          audio('ui');
        });
        diffEl.appendChild(b);
      })(diffs[d]);
    }
    diffNote.textContent = T('gs.tactics.diff_note_' + difficulty);
  }

  /* ---------- 战前整备：技能树 / 装备 ---------- */
  /* 让全屏面板从站点导航下方开始，避免标题被固定导航遮挡 */
  function mountOverlay(el, modal) {
    var nav = document.querySelector('.shell-header') || document.getElementById('arcade-nav') || document.querySelector('header');
    var bottom = 8;
    if (nav) {
      var r = nav.getBoundingClientRect();
      if (r && r.bottom > 0) bottom = Math.min(r.bottom + 8, window.innerHeight * 0.4);
    }
    el.style.paddingTop = Math.round(bottom) + 'px';
    if (modal) modal.style.maxHeight = Math.max(220, window.innerHeight - Math.round(bottom) - 10) + 'px';
  }

  function openPrep(idx) {
    pendingLevel = (typeof idx === 'number') ? idx : null;
    prepTab = 'skills';
    prepMsg = '';
    prepNote.textContent = '';
    prepTitle.textContent = T('gs.tactics.prepTitle');
    prepSub.textContent = pendingLevel == null ? T('gs.tactics.prepReview') : T('gs.tactics.prepSub');
    prepStart.style.display = pendingLevel == null ? 'none' : '';
    prepClose.textContent = T('gs.tactics.prepClose');
    tabSkill.textContent = T('gs.tactics.tabSkills');
    tabGear.textContent = T('gs.tactics.tabGear');
    tabSkill.className = 'btn purple' + (prepTab === 'skills' ? ' active' : '');
    tabGear.className = 'btn purple' + (prepTab === 'gear' ? ' active' : '');
    renderPrep();
    prepEl.classList.remove('hidden');
    mountOverlay(prepEl, prepEl.querySelector('.tk-prep-modal'));
    audio('ui');
    later(function () { if (screen === 'pick') tabSkill.focus(); }, 60);
  }
  function closePrep() {
    prepEl.classList.add('hidden');
    pendingLevel = null;
    if (screen === 'pick') renderPicker();
  }
  function renderPrep() {
    var meta = readMeta();
    prepGold.textContent = T('gs.tactics.prepGold').replace('{n}', meta.gold);
    prepStart.textContent = T('gs.tactics.prepStart').replace('{level}', pendingLevel == null ? '' : T('gs.tactics.level' + (pendingLevel + 1) + 'n'));
    tabSkill.className = 'btn purple' + (prepTab === 'skills' ? ' active' : '');
    tabGear.className = 'btn purple' + (prepTab === 'gear' ? ' active' : '');
    if (prepTab === 'skills') renderSkills(meta); else renderGear(meta);
  }

  function renderSkills(meta) {
    var stars = totalStars();
    var html = '<div class="tk-prep-sum">' + T('gs.tactics.skillTotal').replace('{n}', stars) + '</div>';
    for (var i = 0; i < SKILLS.length; i++) {
      var sk = SKILLS[i];
      var unlocked = meta.skills.indexOf(sk.id) >= 0;
      var can = !unlocked && stars >= sk.cost;
      var cls = unlocked ? 'unlocked' : (can ? 'avail' : 'locked');
      var tag = unlocked ? T('gs.tactics.skillUnlocked') : (can ? T('gs.tactics.skillAvailable') : T('gs.tactics.skillLocked'));
      html += '<div class="tk-skill ' + cls + '">' +
        '<div class="tk-skill-head"><span class="tk-skill-name">' + T('gs.tactics.skill.' + sk.id + '.n') + '</span>' +
        '<span class="tk-skill-tag">' + tag + '</span></div>' +
        '<div class="tk-skill-desc">' + T('gs.tactics.skill.' + sk.id + '.d') + '</div>';
      if (!unlocked && can) {
        html += '<button type="button" class="btn green" data-skill="' + sk.id + '">' +
          T('gs.tactics.skillUnlockBtn').replace('{n}', sk.cost) + '</button>';
      } else if (!unlocked) {
        html += '<div class="tk-skill-req">' +
          T('gs.tactics.skillNeedStars').replace('{n}', sk.cost).replace('{m}', stars) + '</div>';
      }
      html += '</div>';
    }
    prepBody.innerHTML = html;
    var btns = prepBody.querySelectorAll('[data-skill]');
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', function () {
        unlockSkill(this.getAttribute('data-skill'));
      });
    }
  }

  function unlockSkill(id) {
    var sk = skillDef(id);
    if (!sk) return;
    var meta = readMeta();
    if (meta.skills.indexOf(id) >= 0) return;
    if (totalStars() < sk.cost) {
      prepNote.textContent = T('gs.tactics.skillNeedStars').replace('{n}', sk.cost).replace('{m}', totalStars());
      audio('error');
      return;
    }
    meta.skills.push(id);
    writeMeta(meta);
    prepNote.textContent = T('gs.tactics.skillUnlockedMsg').replace('{name}', T('gs.tactics.skill.' + id + '.n'));
    audio('clear');
    renderPrep();
  }

  function bonusLabels(b) {
    var out = [];
    if (b.hp) out.push(T('gs.tactics.gear.bHp').replace('{n}', b.hp));
    if (b.atk) out.push(T('gs.tactics.gear.bAtk').replace('{n}', b.atk));
    if (b.atkRanged) out.push(T('gs.tactics.gear.bAtkRanged').replace('{n}', b.atkRanged));
    if (b.mov) out.push(T('gs.tactics.gear.bMov').replace('{n}', b.mov));
    if (b.rngRanged) out.push(T('gs.tactics.gear.bRng').replace('{n}', b.rngRanged));
    if (b.hit) out.push(T('gs.tactics.gear.bHit').replace('{n}', b.hit));
    if (b.ignoreForest) out.push(T('gs.tactics.gear.bPierce'));
    return out;
  }

  function renderGear(meta) {
    var html = '<div class="tk-gear-slots">';
    for (var s = 0; s < SLOTS.length; s++) {
      var slot = SLOTS[s], eq = itemDef(meta.equipped[slot]);
      html += '<div class="tk-gear-slot"><div class="sl">' + T('gs.tactics.gearSlot.' + slot) + '</div>' +
        '<div class="nm">' + (eq ? T('gs.tactics.gear.' + eq.id + '.n') : T('gs.tactics.gearNone')) + '</div></div>';
    }
    html += '</div>';
    var gb = gearBonus();
    var labels = bonusLabels(gb);
    html += '<div class="tk-gear-sum">' + T('gs.tactics.gearSummary') + '：' +
      (labels.length ? labels.join(' · ') : T('gs.tactics.gearNoBonus')) + '</div>';

    var cleared = clearedCount();
    for (var i = 0; i < EQUIPS.length; i++) {
      var it = EQUIPS[i];
      var owned = meta.owned.indexOf(it.id) >= 0;
      var equipped = meta.equipped[it.slot] === it.id;
      var reqOk = cleared >= it.req;
      var canBuy = reqOk && meta.gold >= it.price;
      var cls = equipped ? 'equipped' : ((!owned && !reqOk) ? 'locked' : '');
      var btn = '';
      if (equipped) {
        btn = '<button type="button" class="btn" disabled>' + T('gs.tactics.gearEquipped') + '</button>';
      } else if (owned) {
        btn = '<button type="button" class="btn green" data-equip="' + it.id + '">' + T('gs.tactics.gearEquip') + '</button>';
      } else if (!reqOk) {
        btn = '<button type="button" class="btn" disabled>' + T('gs.tactics.gearNeedClear').replace('{n}', it.req) + '</button>';
      } else if (!canBuy) {
        btn = '<button type="button" class="btn" disabled>' + T('gs.tactics.gearNeedGold').replace('{n}', it.price) + '</button>';
      } else {
        btn = '<button type="button" class="btn green" data-buy="' + it.id + '">' + T('gs.tactics.gearBuy').replace('{n}', it.price) + '</button>';
      }
      html += '<div class="tk-gear-item ' + cls + '">' +
        '<div class="tk-gear-main"><div class="tk-gear-name">' + T('gs.tactics.gear.' + it.id + '.n') +
        ' · ' + T('gs.tactics.gearSlot.' + it.slot) + '</div>' +
        '<div class="tk-gear-desc">' + T('gs.tactics.gear.' + it.id + '.d') + '</div></div>' + btn + '</div>';
    }
    prepBody.innerHTML = html;
    var eb = prepBody.querySelectorAll('[data-equip]');
    for (var e = 0; e < eb.length; e++) {
      eb[e].addEventListener('click', function () { equipItem(this.getAttribute('data-equip')); });
    }
    var bb = prepBody.querySelectorAll('[data-buy]');
    for (var b = 0; b < bb.length; b++) {
      bb[b].addEventListener('click', function () { buyItem(this.getAttribute('data-buy')); });
    }
  }

  function equipItem(id) {
    var it = itemDef(id);
    if (!it) return;
    var meta = readMeta();
    if (meta.owned.indexOf(id) < 0) return;
    meta.equipped[it.slot] = id;
    writeMeta(meta);
    prepNote.textContent = T('gs.tactics.gearEquipMsg').replace('{name}', T('gs.tactics.gear.' + id + '.n'));
    audio('ui');
    renderPrep();
  }

  function buyItem(id) {
    var it = itemDef(id);
    if (!it) return;
    var meta = readMeta();
    if (meta.owned.indexOf(id) >= 0) return;
    if (clearedCount() < it.req) { audio('error'); return; }
    if (meta.gold < it.price) { prepNote.textContent = T('gs.tactics.gearNeedGold').replace('{n}', it.price); audio('error'); return; }
    meta.gold -= it.price;
    meta.owned.push(id);
    meta.equipped[it.slot] = id;
    writeMeta(meta);
    prepNote.textContent = T('gs.tactics.gearBuyMsg').replace('{name}', T('gs.tactics.gear.' + id + '.n'));
    audio('coin');
    renderPrep();
  }

  /* ---------- 选择 / 移动 / 攻击 ---------- */
  function clearSelection() {
    selUnit = null; moveCells = []; atkCells = []; moveMap = {};
  }
  function selectUnit(u) {
    if (!unitAlive(u) || u.side !== 'my') return;
    if (u.acted) {
      setMsg(T('gs.tactics.alreadyActed').replace('{name}', nameOf(u)), 'warn');
      audio('error');
      return;
    }
    selUnit = u;
    moveMap = {};
    moveCells = [];
    atkCells = [];
    if (u.moved || u.moveSpent) {
      setMsg(T('gs.tactics.movedOnlyAtk').replace('{name}', nameOf(u)), 'warn');
    } else {
      moveMap = bfsGrid(grid, u.x, u.y, u.mov, u);
      moveCells = reachableCells(moveMap).filter(function (n) { return n.d > 0; });
      setMsg(T('gs.tactics.selMsg').replace('{name}', nameOf(u)), '');
    }
    atkCells = playerAttackTargets();
    updateHighlights();
    updateDetail();
    cursor = { x: u.x, y: u.y };
    audio('ui');
  }

  function handleCell(x, y) {
    if (screen !== 'battle' || over) return;
    if (!interactive()) {
      if (phase === 'moving' || phase === 'combat') setMsg(T('gs.tactics.waitAnim'), 'warn');
      return;
    }
    cursor = { x: x, y: y };
    var c = cellAt(grid, x, y);
    if (!c) return;
    var u = c.unit;

    if (u && u.side === 'my') {
      selectUnit(u);
      return;
    }

    if (!selUnit) {
      setMsg(T('gs.tactics.pickUnit'), 'warn');
      return;
    }

    if (u && u.side !== selUnit.side) {
      var d = Math.abs(u.x - selUnit.x) + Math.abs(u.y - selUnit.y);
      if (d > 0 && d <= unitRange(selUnit, grid[selUnit.y][selUnit.x])) {
        doPlayerAttack(selUnit, u);
      } else {
        setMsg(T('gs.tactics.outOfRange'), 'warn');
        audio('error');
      }
      return;
    }

    /* 显式重复移动守卫：本回合已锁定移动的单位，点击任何空格都拒绝 */
    if (selUnit.moved || selUnit.moveSpent) {
      setMsg(T('gs.tactics.moveLocked').replace('{name}', nameOf(selUnit)), 'warn');
      audio('error');
      return;
    }

    var node = moveMap[keyOf(x, y)];
    if (node && !u) {
      doPlayerMove(selUnit, x, y);
      return;
    }
    if (c.wall) {
      setMsg(T('gs.tactics.blocked'), 'warn');
      audio('error');
      return;
    }
    setMsg(T('gs.tactics.cannotMove'), 'warn');
    audio('error');
  }

  function doPlayerMove(u, tx, ty) {
    if (!interactive()) return false;
    if (!unitAlive(u) || u.side !== 'my') return false;
    if (u.acted || u.moved || u.moveSpent) {
      setMsg(T('gs.tactics.moveLocked').replace('{name}', nameOf(u)), 'warn');
      audio('error');
      return false;
    }
    var node = moveMap[keyOf(tx, ty)];
    if (!node) return false;
    var path = pathFrom(moveMap, tx, ty);
    if (!path || !path.length) return false;

    /* 同步加锁：在接受移动的第一帧即标记，杜绝动画期间/快速连点的第二次移动 */
    u.moveSpent = true;
    inputLock = true;
    phase = 'moving';
    moveCells = [];
    atkCells = [];
    updateHighlights();
    updateDetail();
    setMsg(T('gs.tactics.moving').replace('{name}', nameOf(u)), '');

    var bid = battleId;
    animateSteps(u, path, function () {
      if (bid !== battleId) return;
      if (!unitAlive(u)) {
        inputLock = false; phase = 'player';
        checkEnd();
        return;
      }
      u.moveSpent = true;
      u.moved = true;
      inputLock = false;
      phase = 'player';
      atkCells = playerAttackTargets();
      updateHighlights();
      updateDetail();
      updateHud();
      if (atkCells.length) setMsg(T('gs.tactics.afterMoveAtk').replace('{name}', nameOf(u)), '');
      else setMsg(T('gs.tactics.afterMove').replace('{name}', nameOf(u)), '');
      writeSave();
      if (!units.some(function (q) { return q.side === 'my' && q.hp > 0 && !q.acted; })) {
        setMsg(T('gs.tactics.allDone'), 'warn');
      }
    });
    return true;
  }

  function animateSteps(u, path, done) {
    var bid = battleId;
    if (!path || !path.length) { done(); return; }
    var i = 0;
    function step() {
      if (bid !== battleId) return;
      if (i >= path.length) {
        u.anim = null;
        done();
        return;
      }
      var to = path[i++];
      var from = { x: u.x, y: u.y };
      if (grid[from.y][from.x].unit === u) grid[from.y][from.x].unit = null;
      u.anim = { fx: from.x, fy: from.y, t0: performance.now(), dur: 150 };
      u.x = to.x; u.y = to.y;
      grid[u.y][u.x].unit = u;
      audio('step');
      later(step, 150);
    }
    step();
  }

  function doPlayerAttack(att, def) {
    if (!interactive()) return false;
    if (!unitAlive(att) || !unitAlive(def) || att.side === def.side) return false;
    if (att.acted) {
      setMsg(T('gs.tactics.alreadyActed').replace('{name}', nameOf(att)), 'warn');
      audio('error');
      return false;
    }
    att.acted = true;      // 同步锁定：攻击动画期间不可再行动
    inputLock = true;
    phase = 'combat';
    clearSelection();
    updateHighlights();
    updateDetail();
    updateHud();
    setMsg(T('gs.tactics.attackMsg').replace('{a}', nameOf(att)).replace('{b}', nameOf(def)), '');
    attackSequence(att, def, function () {
      if (phase === 'combat') { phase = 'player'; inputLock = false; }
      updateHud();
      updateDetail();
      writeSave();
    });
    return true;
  }

  function flashUnit(u) { if (u) u.flash = 12; }

  /* 命中格反馈：白闪 + 亮边，命中/暴击强度不同 */
  function pulseCell(gx, gy, crit) {
    var el = cellEls[gy] && cellEls[gy][gx];
    if (!el) return;
    el.classList.remove('hitflash', 'crit');
    void el.offsetWidth;
    el.classList.add('hitflash');
    if (crit) el.classList.add('crit');
    setTimeout(function () { el.classList.remove('hitflash', 'crit'); }, crit ? 400 : 320);
  }

  function attackSequence(att, def, done, report) {
    var bid = battleId;
    var atkCell = grid[att.y][att.x];
    var defCell = grid[def.y][def.x];
    var ranged = typeDef(att.type).role === 'ranged' || att.type === 'boss';
    var beam = att.type === 'mage' || att.type === 'boss';
    var bullet = att.type === 'gunner';

    var dx = def.x - att.x, dy = def.y - att.y;
    var len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    att.lungeDX = dx / len; att.lungeDY = dy / len;
    att.lungeT = performance.now();

    if (ranged) {
      spawnShot(att.x, att.y, def.x, def.y, beam ? 'orb' : (bullet ? 'bullet' : 'arrow'), att.side === 'my' ? '#00f0ff' : '#ff2d95');
    } else {
      spawnSlash(att.x, att.y, def.x, def.y, att.side === 'my' ? '#b8f6ff' : '#ff9ecb');
    }

    function impact() {
      if (bid !== battleId || over || !unitAlive(att) || !unitAlive(def)) { if (!over) done(); return; }
      var res = resolveAttack(att, def, atkCell, defCell, Math.random);
      if (report) report(res, def);
      if (res.miss) {
        floatText(def.x, def.y, T('gs.tactics.floatMiss'), '#cbd5e1');
        audio('miss');
        setMsg(T('gs.tactics.missMsg').replace('{a}', nameOf(att)).replace('{b}', nameOf(def)), 'warn');
      } else {
        def.hp -= res.dmg;
        flashUnit(def);
        pulseCell(def.x, def.y, res.crit);
        spawnParticles(def.x, def.y, res.crit ? '#ffe600' : (def.side === 'my' ? '#00f0ff' : '#ff2d95'), res.crit ? 18 : 10, res.crit ? 1.6 : 1);
        spawnRing(def.x, def.y, res.crit ? '#ffe600' : '#ffffff', 0.6);
        floatText(def.x, def.y, '-' + res.dmg, res.crit ? '#ffe600' : '#ff6b9d');
        if (res.crit) {
          floatText(def.x, def.y - 0.35, T('gs.tactics.floatCrit'), '#ffe600');
          shakeBoard();
          audio('explode');
        } else audio('hit');
        setMsg(T(res.crit ? 'gs.tactics.critMsg' : 'gs.tactics.hitMsg').replace('{a}', nameOf(att)).replace('{b}', nameOf(def)).replace('{n}', res.dmg), res.crit ? 'good' : '');
      }
      updateHud();
      updateDetail();

      if (def.hp <= 0) {
        killUnit(def);
        checkEnd();
        if (!over) later(done, 420);
        return;
      }

      /* 反击：守方存活且可触及攻方 */
      if (canCounter(def, att) && Math.random() < counterChance(def)) {
        later(function () {
          if (bid !== battleId || over || !unitAlive(def) || !unitAlive(att)) { if (!over) done(); return; }
          var cd = counterDamage(def, att, defCell, atkCell);
          att.hp -= cd;
          flashUnit(att);
          pulseCell(att.x, att.y, false);
          spawnParticles(att.x, att.y, '#ffe600', 9, 1.1);
          floatText(att.x, att.y, '-' + cd, '#ffe600');
          floatText(att.x, att.y - 0.35, T('gs.tactics.floatCounter'), '#ffe600');
          shakeBoard();
          audio('hit');
          setMsg(T('gs.tactics.counterMsg').replace('{a}', nameOf(def)).replace('{b}', nameOf(att)).replace('{n}', cd), 'warn');
          updateHud(); updateDetail();
          if (att.hp <= 0) {
            killUnit(att);
            checkEnd();
            if (!over) later(done, 420);
            return;
          }
          later(done, 380);
        }, 280);
        return;
      }
      later(done, 380);
    }
    later(impact, ranged ? 340 : 190);
  }

  function killUnit(u) {
    if (!u || u.hp > 0) return;
    var i = units.indexOf(u);
    if (i >= 0) units.splice(i, 1);
    if (inBounds(grid, u.x, u.y) && grid[u.y][u.x].unit === u) grid[u.y][u.x].unit = null;
    spawnBurst(u.x, u.y, u.side === 'my' ? '#00f0ff' : '#ff2d95', u.type === 'boss' ? 2.2 : 1.2);
    floatText(u.x, u.y, T('gs.tactics.floatDead'), u.side === 'my' ? '#ff2d95' : '#39ff14');
    audio(u.side === 'my' ? 'error' : 'explode');
    if (u.side === 'en') {
      var pts = u.type === 'boss' ? 30 : (u.type === 'knight' || u.type === 'mage' ? 15 : 10);
      score += pts;
      var meta = readMeta();
      meta.gold += u.type === 'boss' ? 12 : 3;
      writeMeta(meta);
      floatText(u.x, u.y - 0.3, '+' + pts, '#ffe600');
    }
    if (selUnit === u) clearSelection();
    updateHud();
    updateHighlights();
    updateDetail();
  }

  /* ---------- 回合流转 / AI 多单位队列 ---------- */
  function endPlayerTurn() {
    if (screen !== 'battle' || over) return;
    if (phase !== 'player') {
      setMsg(T('gs.tactics.waitAnim'), 'warn');
      return;
    }
    if (inputLock) {
      setMsg(T('gs.tactics.waitAnim'), 'warn');
      return;
    }
    clearSelection();
    updateHighlights();
    phase = 'ai';
    aiRunning = false;
    aiLog = [];
    inputLock = false;
    setMsg(T('gs.tactics.enemyTurn'), 'warn');
    updateHud();
    writeSave();
    later(runAI, 420);
  }

  function runAI() {
    if (phase !== 'ai' || over) return;
    if (aiRunning) return;
    aiRunning = true;
    var list = aliveList('en');
    var i = 0;
    var bid = battleId;

    function step() {
      if (bid !== battleId || over) { aiRunning = false; return; }
      if (i >= list.length) {
        aiRunning = false;
        finishAITurn();
        return;
      }
      var e = list[i++];
      if (!unitAlive(e)) { later(step, 60); return; }
      aiAct(e, function () {
        if (bid !== battleId || over) { aiRunning = false; return; }
        later(step, 140);
      });
    }
    later(step, 260);
  }

  function firstTargetInRange(u) {
    var r = unitRange(u, grid[u.y][u.x]);
    var list = units.filter(function (t) {
      if (t.side === u.side || t.hp <= 0) return false;
      var d = Math.abs(t.x - u.x) + Math.abs(t.y - u.y);
      return d > 0 && d <= r;
    });
    list.sort(function (a, b) { return a.hp - b.hp; });
    return list[0] || null;
  }

  function aiAct(e, done) {
    var bid = battleId;
    var from = { x: e.x, y: e.y };
    var plan = planEnemyAction(grid, e, units, difficulty, Math.random);
    var path = plan && plan.path ? plan.path : [];

    function logMove() {
      aiLog.push({
        unitId: e.id, type: e.type, from: from, to: { x: e.x, y: e.y },
        action: (path.length ? 'move' : 'wait'), targetId: 0, targetType: '', hit: null, dmg: 0, crit: false, counter: 0
      });
    }

    function afterMove() {
      if (bid !== battleId || over) return;
      if (path.length) e.moved = true;
      logMove();
      updateHud();
      var target = (plan && plan.target && unitAlive(plan.target)) ? plan.target : null;
      if (!target) target = firstTargetInRange(e);
      if (target && unitAlive(target)) {
        setMsg(T('gs.tactics.aiActMsg').replace('{a}', nameOf(e)).replace('{b}', nameOf(target)), 'warn');
        attackSequence(e, target, function () {
          if (bid !== battleId) return;
          e.acted = true;
          updateHud();
          updateDetail();
          checkEnd();
          if (!over) done();
        }, function (res) {
          var last = aiLog[aiLog.length - 1];
          if (last) {
            last.action = 'attack';
            last.targetId = target.id;
            last.targetType = target.type;
            last.hit = !res.miss;
            last.dmg = res.dmg;
            last.crit = !!res.crit;
            last.to = { x: e.x, y: e.y };
          }
        });
        return;
      }
      e.acted = true;
      updateHud();
      updateDetail();
      checkEnd();
      if (!over) later(done, 180);
    }

    if (path.length) animateSteps(e, path, afterMove);
    else afterMove();
  }

  function finishAITurn() {
    if (over || screen !== 'battle') return;
    turn++;
    if (turn > LEVELS[levelIdx].limit) {
      finishBattle(false, 'timeout');
      return;
    }
    for (var i = 0; i < units.length; i++) {
      if (units[i].side === 'my') {
        units[i].acted = false;
        units[i].moved = false;
        units[i].moveSpent = false;
      }
    }
    phase = 'player';
    inputLock = false;
    selUnit = null; moveCells = []; atkCells = [];
    updateHud();
    updateHighlights();
    updateDetail();
    setMsg(T('gs.tactics.turnMsg').replace('{n}', turn), 'ok');
    audio('ui');
    writeSave();
  }

  function checkEnd() {
    if (over) return;
    if (!aliveList('en').length) { finishBattle(true); return; }
    if (!aliveList('my').length) { finishBattle(false); return; }
  }

  /* ---------- 结算 ---------- */
  function finishBattle(win, reason) {
    if (over) return;
    over = true;
    phase = 'result';
    inputLock = true;
    clearSelection();
    clearTimers();
    clearSave();

    var lv = LEVELS[levelIdx];
    var remain = Math.max(0, lv.limit - turn);
    var survivors = aliveList('my').length;
    var starsEarned = 0;
    if (win) {
      starsEarned = 1;
      if (remain >= Math.ceil(lv.limit * 0.25)) starsEarned++;
      if (startMyCount > 0 && survivors >= startMyCount) starsEarned++;
      score += 50;
    }
    lastStarsEarned = starsEarned;

    var meta = readMeta();
    var prevStars = clampInt(meta.stars[levelIdx] || 0, 0, 3);
    var cleared = readCleared();
    if (!prevStars && cleared[levelIdx]) prevStars = 1;

    if (win) {
      markCleared(levelIdx);
      if (starsEarned > prevStars) meta.stars[levelIdx] = starsEarned;
      else if (!meta.stars[levelIdx]) meta.stars[levelIdx] = Math.max(1, prevStars);
      meta.gold += 22 + starsEarned * 6;
      writeMeta(meta);
    }

    var isNew = false;
    if (win && window.Arcade && Arcade.shell && Arcade.shell.submitScore) {
      isNew = !!Arcade.shell.submitScore(score);
    }
    var best = (window.Arcade && Arcade.storage && Arcade.storage.getBest) ? Arcade.storage.getBest('tactics') : null;
    updateHud();
    showResult(win, reason, remain, starsEarned, prevStars, best, isNew);
  }

  function resultBtn(label, cls, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (cls || '');
    b.style.minHeight = '44px';
    b.textContent = label;
    b.addEventListener('click', function () { audio('ui'); fn(); });
    ovActions.appendChild(b);
    return b;
  }

  function showResult(win, reason, remain, starsEarned, prevStars, best, isNew) {
    var name = T('gs.tactics.level' + (levelIdx + 1) + 'n');
    ovTitle.textContent = T(win ? 'gs.tactics.resultWin' : 'gs.tactics.resultLose');
    ovTitle.className = win ? 'win' : 'lose';
    var reasonKey = (!win && reason === 'timeout') ? 'gs.tactics.resultTimeout' : (win ? 'gs.tactics.resultWinText' : 'gs.tactics.resultLoseText');
    ovText.innerHTML = T(reasonKey).replace('{level}', name);

    if (win) {
      ovStars.innerHTML = '<span>' + T('gs.tactics.resultStarsLbl') + '</span>' + starsHtml(starsEarned, 3) +
        (starsEarned > prevStars ? '<span style="color:var(--neon-green)">' + T('gs.tactics.resultNewStars') + '</span>' : '');
    } else {
      ovStars.innerHTML = '';
    }

    var meta = readMeta();
    var stats = [
      [T('gs.tactics.resultLevelLbl'), (levelIdx + 1) + '/9'],
      [T('gs.tactics.resultTurnsLbl'), remain],
      [T('gs.tactics.resultScoreLbl'), score],
      [T('gs.tactics.resultBestLbl'), best == null ? '—' : best, isNew ? 'rec' : ''],
      [T('gs.tactics.resultGoldLbl'), meta.gold]
    ];
    var h = '';
    for (var i = 0; i < stats.length; i++) {
      h += '<div class="' + (stats[i][2] || '') + '">' + stats[i][0] + '<b>' + stats[i][1] + '</b></div>';
    }
    ovStats.innerHTML = h + (isNew ? '<div class="rec" style="grid-column:1/-1">' + T('gs.tactics.resultNew') + '</div>' : '');

    ovActions.innerHTML = '';
    if (win) {
      if (levelIdx < LEVELS.length - 1) {
        resultBtn(T('gs.tactics.resultNext'), 'green', function () { startLevel(levelIdx + 1, false); });
      } else {
        resultBtn(T('gs.tactics.resultCampaign'), 'green', function () { startLevel(0, false); });
      }
    }
    resultBtn(T('gs.tactics.resultRetry'), win ? '' : 'green', function () { startLevel(levelIdx, false); });
    resultBtn(T('gs.tactics.resultLevels'), 'purple', showPicker);

    overlayEl.classList.remove('hidden');
    if (Arcade.ui) Arcade.ui.setGamePhase('overlay');
    prepEl.classList.add('hidden');
    /* 结算面板已有「下一关 / 重试 / 关卡选择」，隐藏战斗底部同义入口 */
    var ctrl = document.querySelector('#tk-battle .game-controls');
    if (ctrl) ctrl.classList.add('is-hidden');
    mountOverlay(overlayEl, document.getElementById('tk-result-modal'));
    var firstBtn = ovActions.querySelector('button');
    if (firstBtn) later(function () { try { firstBtn.focus(); } catch (e) {} }, 60);
    writeSave();
  }

  /* ---------- 提示 / 键盘 / 指针 ---------- */
  function showHint() {
    if (!interactive()) return;
    var ready = units.filter(function (u) { return u.side === 'my' && u.hp > 0 && !u.acted; });
    if (!ready.length) { setMsg(T('gs.tactics.allActed'), 'warn'); return; }
    var pick = ready[0], target = null, bestScore = -1e9;
    for (var i = 0; i < ready.length; i++) {
      var u = ready[i];
      var r = unitRange(u, grid[u.y][u.x]);
      for (var j = 0; j < units.length; j++) {
        var e = units[j];
        if (e.side === 'my' || e.hp <= 0) continue;
        var d = Math.abs(e.x - u.x) + Math.abs(e.y - u.y);
        var sc = (r >= d ? 20 : 0) - e.hp * 2 + (u.maxHp - u.hp) * -0.5;
        if (sc > bestScore) { bestScore = sc; pick = u; target = e; }
      }
    }
    if (!target) { setMsg(T('gs.tactics.hintNone'), 'warn'); return; }
    setMsg(T('gs.tactics.hintMsg').replace('{name}', nameOf(pick)).replace('{target}', nameOf(target)), 'ok');
    cursor = { x: pick.x, y: pick.y };
    selUnit = pick;
    if (!pick.moved && !pick.moveSpent) {
      moveMap = bfsGrid(grid, pick.x, pick.y, pick.mov, pick);
      moveCells = reachableCells(moveMap).filter(function (n) { return n.d > 0; });
    }
    atkCells = playerAttackTargets();
    updateHighlights();
    updateDetail();
  }

  function onKey(e) {
    if (!prepEl.classList.contains('hidden')) {
      if (e.key === 'Escape') { e.preventDefault(); closePrep(); }
      return;
    }
    if (screen !== 'battle' || over || overlayEl.classList.contains('hidden') === false) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      var dx = e.key === 'ArrowLeft' ? -1 : (e.key === 'ArrowRight' ? 1 : 0);
      var dy = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : 0);
      cursor.x = GK.clamp(cursor.x + dx, 0, grid[0].length - 1);
      cursor.y = GK.clamp(cursor.y + dy, 0, grid.length - 1);
      updateHighlights();
      audio('step');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      handleCell(cursor.x, cursor.y);
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (e.repeat) return;
      endPlayerTurn();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      clearSelection();
      updateHighlights();
      updateDetail();
      setMsg(T('gs.tactics.deselected'), '');
    }
  }

  /* ---------- 缩放 / 平移事件 ---------- */
  updateZoomUI();
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { setZoom(zoom - ZOOM_STEP, null, null); audio('ui'); });
  if (zoomInBtn) zoomInBtn.addEventListener('click', function () { setZoom(zoom + ZOOM_STEP, null, null); audio('ui'); });
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', function () { resetZoom(); audio('ui'); setMsg(T('gs.tactics.zoomResetMsg'), 'ok'); });
  if (zoomToggleBtn) zoomToggleBtn.addEventListener('click', function () {
    var next = zoom > 1.001 ? 1 : ZOOM_TOGGLE;
    setZoom(next, null, null);
    audio('ui');
    setMsg(next > 1 ? T('gs.tactics.zoomOnMsg') : T('gs.tactics.zoomResetMsg'), 'ok');
  });

  var pinchState = null, panState = null, tapState = { t: 0, x: 0, y: 0 }, ignoreTapsUntil = 0;
  function touchDist(a, b) {
    var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function midPoint(a, b) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }
  if (boardView) {
    boardView.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        var m = midPoint(e.touches[0], e.touches[1]);
        pinchState = { d: touchDist(e.touches[0], e.touches[1]), z: zoom, mx: m.x, my: m.y };
      }
    }, { passive: true });
    boardView.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinchState) {
        e.preventDefault();
        var d = touchDist(e.touches[0], e.touches[1]);
        if (d > 12 && pinchState.d > 12) {
          var m = midPoint(e.touches[0], e.touches[1]);
          setZoom(pinchState.z * (d / pinchState.d), m.x, m.y);
        }
      }
    }, { passive: false });
    boardView.addEventListener('touchend', function (e) {
      if (pinchState) {
        /* 双指手势结束：吞掉随后可能出现的单指 tap，避免误复位 */
        if (e.touches.length < 2) {
          pinchState = null;
          tapState.t = 0;
          ignoreTapsUntil = Date.now() + 400;
        }
        return;
      }
      if (e.touches.length) return;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t || Date.now() < ignoreTapsUntil) return;
      var now = Date.now();
      if (now - tapState.t < 320 && Math.abs(t.clientX - tapState.x) < 28 && Math.abs(t.clientY - tapState.y) < 28) {
        tapState.t = 0;
        resetZoom();
        setMsg(T('gs.tactics.zoomResetMsg'), 'ok');
      } else {
        tapState.t = now; tapState.x = t.clientX; tapState.y = t.clientY;
      }
    }, { passive: true });

    /* 鼠标/触控笔拖拽平移（触屏交给原生滚动） */
    boardView.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || zoom <= 1.001) return;
      suppressClick = false;
      panState = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: boardView.scrollLeft, st: boardView.scrollTop, moved: false };
      if (boardView.setPointerCapture) { try { boardView.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    boardView.addEventListener('pointermove', function (e) {
      if (!panState || e.pointerId !== panState.id) return;
      var dx = e.clientX - panState.x, dy = e.clientY - panState.y;
      if (!panState.moved && Math.abs(dx) + Math.abs(dy) > 6) {
        panState.moved = true;
        boardView.classList.add('dragging');
      }
      if (panState.moved) {
        boardView.scrollLeft = panState.sl - dx;
        boardView.scrollTop = panState.st - dy;
      }
    });
    function endPan(e) {
      if (!panState || (e && e.pointerId !== panState.id)) return;
      if (panState.moved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 400);
      }
      panState = null;
      boardView.classList.remove('dragging');
    }
    boardView.addEventListener('pointerup', endPan);
    boardView.addEventListener('pointercancel', endPan);
    boardView.addEventListener('dblclick', function (e) {
      if (zoom > 1.001 && (!e.target || !e.target.closest || e.target.closest('#tk-board'))) {
        e.preventDefault();
        resetZoom();
      }
    });
  }

  boardEl.addEventListener('click', function (e) {
    if (suppressClick) { suppressClick = false; return; }
    var tgt = e.target;
    while (tgt && tgt !== boardEl && (!tgt.getAttribute || tgt.getAttribute('data-x') == null)) tgt = tgt.parentNode;
    if (!tgt || tgt === boardEl) return;
    var x = Number(tgt.getAttribute('data-x')), y = Number(tgt.getAttribute('data-y'));
    if (!isFinite(x) || !isFinite(y)) return;
    handleCell(x, y);
  });

  endBtn.addEventListener('click', endPlayerTurn);
  hintBtn.addEventListener('click', showHint);
  changeBtn.addEventListener('click', showPicker);
  tabSkill.addEventListener('click', function () { prepTab = 'skills'; renderPrep(); audio('ui'); });
  tabGear.addEventListener('click', function () { prepTab = 'gear'; renderPrep(); audio('ui'); });
  prepClose.addEventListener('click', closePrep);
  prepStart.addEventListener('click', function () {
    if (pendingLevel == null) return;
    var idx = pendingLevel;
    prepEl.classList.add('hidden');
    startLevel(idx, false);
  });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', function () {
    if (screen === 'battle') { layoutBoard(); updateHighlights(); }
    if (!prepEl.classList.contains('hidden')) mountOverlay(prepEl, prepEl.querySelector('.tk-prep-modal'));
    if (!overlayEl.classList.contains('hidden')) mountOverlay(overlayEl, document.getElementById('tk-result-modal'));
  });

  /* ---------- 可选 QA 钩子（仅 ?qa=1） ---------- */
  var prepMsg = '';
  function qaState() {
    return {
      screen: screen, phase: phase, over: over, levelIdx: levelIdx, levelNo: levelIdx + 1,
      turn: turn, limit: LEVELS[levelIdx] ? LEVELS[levelIdx].limit : 0,
      score: score, difficulty: difficulty, stars: totalStars(), gold: readMeta().gold,
      prepOpen: !prepEl.classList.contains('hidden'),
      resultOpen: !overlayEl.classList.contains('hidden'),
      msg: msgEl.textContent, inputLock: inputLock,
      selectedId: selUnit ? selUnit.id : 0,
      moveCells: moveCells.map(function (n) { return { x: n.x, y: n.y }; }),
      attackTargets: atkCells.map(function (u) { return { x: u.x, y: u.y, id: u.id }; }),
      aiLog: aiLog.slice(),
      units: units.map(function (u) {
        return {
          id: u.id, side: u.side, type: u.type, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp,
          atk: u.atk, mov: u.mov, rng: u.rng, acted: !!u.acted, moved: !!u.moved,
          moveSpent: !!u.moveSpent, hitBonus: u.hitBonus || 0, ignoreForest: !!u.ignoreForest
        };
      }),
      board: { cols: grid[0] ? grid[0].length : 0, rows: grid.length, cell: geom.cell },
      zoom: zoom,
      scroll: boardView ? { left: boardView.scrollLeft, top: boardView.scrollTop } : null
    };
  }

  if (/[?&]qa=1(?:&|$)/.test(location.search)) {
    window.__qa = {
      state: qaState,
      forceWin: function () {
        if (screen !== 'battle' || over) return false;
        finishBattle(true, 'qa');
        return true;
      },
      forceLose: function () {
        if (screen !== 'battle' || over) return false;
        finishBattle(false, 'qa');
        return true;
      },
      act: {
        start: function (idx) { if (typeof idx === 'number') startLevel(idx, false); },
        openLevel: function (idx) { openPrep(idx); },
        openPrep: function (idx) { openPrep(idx); },
        closePrep: closePrep,
        select: function (x, y) { handleCell(x, y); },
        move: function (x, y) { handleCell(x, y); },
        attack: function (x, y) { handleCell(x, y); },
        endTurn: endPlayerTurn,
        setDifficulty: function (d) { if (AI_PROFILES[d]) { saveDiff(d); if (screen === 'pick') renderPicker(); } },
        setTab: function (t) { prepTab = t === 'gear' ? 'gear' : 'skills'; renderPrep(); },
        unlockSkill: unlockSkill,
        equip: equipItem,
        buy: buyItem,
        levels: showPicker,
        hint: showHint,
        zoomTo: function (z) { setZoom(z, null, null); },
        resetZoom: resetZoom
      }
    };
  }

  /* ---------- 启动 ---------- */
  difficulty = readDiff();
  if (!tryResume()) showPicker();
})();
