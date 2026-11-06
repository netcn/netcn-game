/* ============================================================
   地牢探险 Dungeon · Roguelike 回合制（旗舰级）
   5 层随机地牢（房间+走廊）· 墙体遮蔽视线（LOS）· 记忆迷雾
   3 职业 / 3 装备槽 / 主动技能+通用技能 / 4 类陷阱
   第 3 层中 Boss、第 5 层双阶段最终 Boss · Arcade.savegame 断点续玩
   HiDPI：GK.setup 建立画布后按 CSS 实际宽度重设 backing store，
   逻辑坐标 460×300 通过 setTransform 映射，dpr 上限 2；粒子/格心自洽
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.dungeon.tut1t'), d: T('gs.dungeon.tut1') },
  { t: T('gs.dungeon.tut2t'), d: T('gs.dungeon.tut2') },
  { t: T('gs.dungeon.tut3t'), d: T('gs.dungeon.tut3') }
];

(function () {
  /* ---------- 配置 ---------- */
  var W = 460, H = 300;
  var COLS = 23, ROWS = 15, FOV = 6;
  var MAX_LAYER = 5;
  var ACT_GAP = 70; // 两次行动最小间隔 ms
  var WALL = 0, FLOOR = 1, STAIR = 2;
  var CLS_KEY = 'arcade_dg_class';

  var CLASSES = {
    warrior: {
      color: '#ff9f1c', glow: '#ffd38a', hp: 44, atk: 4, def: 2, skill: 'cleave',
      weapon: 'w_iron', armor: 'a_leather', trinket: 't_guard'
    },
    mage: {
      color: '#b967ff', glow: '#e2b6ff', hp: 30, atk: 5, def: 0, skill: 'fireball',
      weapon: 'w_staff', armor: 'a_robe', trinket: 't_focus'
    },
    ranger: {
      color: '#39ff14', glow: '#b6ff9c', hp: 36, atk: 3, def: 1, skill: 'volley',
      weapon: 'w_bow', armor: 'a_cloak', trinket: 't_guard'
    }
  };

  /* 装备库：slot + 属性（atk/def/hp/sk） */
  var ITEMS = {
    w_iron:   { slot: 'weapon', atk: 2 },
    w_staff:  { slot: 'weapon', atk: 2, sk: 15 },
    w_bow:    { slot: 'weapon', atk: 1, sk: 10 },
    w_flame:  { slot: 'weapon', atk: 4, sk: 10 },
    w_hammer: { slot: 'weapon', atk: 5 },
    a_leather:{ slot: 'armor', def: 1, hp: 4 },
    a_robe:   { slot: 'armor', def: 1, hp: 2, sk: 10 },
    a_cloak:  { slot: 'armor', def: 2, hp: 3 },
    a_plate:  { slot: 'armor', def: 4, hp: 8 },
    a_shadow: { slot: 'armor', def: 3, hp: 10 },
    t_focus:  { slot: 'trinket', sk: 20 },
    t_power:  { slot: 'trinket', atk: 2, sk: 10 },
    t_guard:  { slot: 'trinket', def: 1, hp: 5 },
    t_vamp:   { slot: 'trinket', atk: 1, sk: 10 }
  };
  var ITEM_IDS = Object.keys(ITEMS);

  var SKILLS = {
    cleave:   { cd: 6, mul: 1.5 },
    fireball: { cd: 7, mul: 2.2 },
    volley:   { cd: 6, mul: 1.2, range: 6 },
    dash:     { cd: 8, mul: 1 }
  };

  /* ---------- Canvas + HiDPI 自适应 ---------- */
  var canvas = document.createElement('canvas');
  canvas.className = 'dg-canvas';
  canvas.setAttribute('aria-label', T('gs.dungeon.aria'));
  var gk = GK.setup(canvas, W, H);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = gk.ctx;
  var cw = W / COLS, ch = H / ROWS;
  var vig = null;

  function fitCanvas() {
    var rect = canvas.getBoundingClientRect();
    var cssW = rect.width || W;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssH = cssW * H / W;
    var bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.height = cssH + 'px';
    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
    vig = null;
  }

  /* ---------- DOM ---------- */
  var stage = document.createElement('div');
  stage.className = 'dg-stage hidden';

  var top = document.createElement('div');
  top.className = 'dg-top';
  top.innerHTML =
    '<span class="dg-hpwrap"><b class="dg-lbl">HP</b><span class="hp" id="dg-hp">44/44</span>' +
    '<i class="dg-hpbar"><i class="dg-hpfill" id="dg-hpfill"></i></i></span>' +
    '<span class="dg-chip"><b class="dg-lbl">ATK</b><span class="atk" id="dg-atk">4</span></span>' +
    '<span class="dg-chip"><b class="dg-lbl">DEF</b><span class="atk" id="dg-def">2</span></span>' +
    '<span class="dg-chip"><b class="dg-lbl" id="dg-scorelbl"></b><span class="atk" id="dg-score">0</span></span>' +
    '<span class="dg-chip"><b class="dg-lbl">' + T('gs.dungeon.layer') + '</b><span class="lv" id="dg-layer">1</span>/' + MAX_LAYER + '</span>' +
    '<button class="dg-pausebtn" id="dg-pausebtn" type="button" aria-label="' + T('gs.dungeon.pauseBtn') + '"><i></i><i></i></button>';

  var msg = document.createElement('div');
  msg.className = 'dg-msg';
  msg.setAttribute('aria-live', 'polite');

  var overlay = document.createElement('div');
  overlay.className = 'dg-overlay hidden';
  overlay.innerHTML =
    '<div class="dg-ov-title" id="dg-ov-title"></div>' +
    '<div class="dg-ov-sub" id="dg-ov-sub"></div>' +
    '<div class="dg-ov-stats" id="dg-ov-stats"></div>' +
    '<div class="game-controls dg-ov-btns">' +
    '  <button class="btn green" id="dg-start" type="button"></button>' +
    '  <button class="btn purple" id="dg-change" type="button">' + T('gs.dungeon.menuBtn') + '</button>' +
    '  <a class="btn" id="dg-lobby" href="../../index.html">' + T('gs.dungeon.lobbyBtn') + '</a>' +
    '</div>';

  var pauseOv = document.createElement('div');
  pauseOv.className = 'dg-pause hidden';
  pauseOv.innerHTML =
    '<div class="dg-pause-t">' + T('gs.dungeon.pauseTitle') + '</div>' +
    '<div class="dg-pause-d">' + T('gs.dungeon.pauseHint') + '</div>' +
    '<div class="dg-pause-btns">' +
    '  <button class="btn green" id="dg-resume" type="button">' + T('gs.dungeon.resumeBtn') + '</button>' +
    '  <button class="btn pink" id="dg-saveexit" type="button">' + T('gs.dungeon.pauseSave') + '</button>' +
    '</div>';

  var menu = document.createElement('div');
  menu.className = 'dg-menu';
  menu.innerHTML =
    '<div class="dg-menu-title">' + T('gs.dungeon.menuTitle') + '</div>' +
    '<div class="dg-menu-sub">' + T('gs.dungeon.menuSub') + '</div>' +
    '<div class="dg-classes" id="dg-classes"></div>' +
    '<div class="dg-menu-hint">' + T('gs.dungeon.pickClass') + '</div>' +
    '<div class="dg-menu-btns">' +
    '  <button class="btn green" id="dg-continue" type="button">' + T('gs.dungeon.contBtn') + '</button>' +
    '  <button class="btn blue" id="dg-begin" type="button">' + T('gs.dungeon.beginBtn') + '</button>' +
    '</div>';

  var equipPanel = document.createElement('div');
  equipPanel.className = 'dg-equip hidden';
  equipPanel.innerHTML =
    '<div class="dg-slots">' +
    '  <div class="dg-slot"><span class="dg-slot-l">' + T('gs.dungeon.slot.weapon') + '</span><span class="dg-slot-n" id="dg-eq-weapon"></span></div>' +
    '  <div class="dg-slot"><span class="dg-slot-l">' + T('gs.dungeon.slot.armor') + '</span><span class="dg-slot-n" id="dg-eq-armor"></span></div>' +
    '  <div class="dg-slot"><span class="dg-slot-l">' + T('gs.dungeon.slot.trinket') + '</span><span class="dg-slot-n" id="dg-eq-trinket"></span></div>' +
    '</div>' +
    '<div class="dg-eq-sum" id="dg-eq-sum"></div>';

  var eqPrompt = document.createElement('div');
  eqPrompt.className = 'dg-eqp hidden';
  eqPrompt.innerHTML =
    '<div class="dg-eqp-t" id="dg-eqp-title"></div>' +
    '<div class="dg-eqp-compare" id="dg-eqp-compare"></div>' +
    '<div class="dg-eqp-btns">' +
    '  <button class="btn green" id="dg-eqp-take" type="button">' + T('gs.dungeon.equipTake') + '</button>' +
    '  <button class="btn pink" id="dg-eqp-drop" type="button">' + T('gs.dungeon.equipDrop') + '</button>' +
    '</div>';

  var skillBar = document.createElement('div');
  skillBar.className = 'dg-skillbar hidden';
  skillBar.innerHTML =
    '<button class="dg-skill" id="dg-skill-q" type="button">' +
    '  <span class="dg-sk-key">Q</span><span class="dg-sk-name" id="dg-sk-q-name"></span>' +
    '  <span class="dg-sk-cd" id="dg-sk-q-cd"></span></button>' +
    '<button class="dg-skill" id="dg-skill-e" type="button">' +
    '  <span class="dg-sk-key">E</span><span class="dg-sk-name" id="dg-sk-e-name"></span>' +
    '  <span class="dg-sk-cd" id="dg-sk-e-cd"></span></button>';

  var dpadHolder = document.createElement('div');
  dpadHolder.id = 'dg-dpad';

  var leg = document.createElement('div');
  leg.className = 'dg-leg';
  leg.innerHTML =
    '<span><i class="dg-dot" style="background:#00f0ff"></i>' + T('gs.dungeon.you') + '</span>' +
    '<span><i class="dg-dot" style="background:#ff2d95"></i>' + T('gs.dungeon.enemy') + '</span>' +
    '<span><i class="dg-dot" style="background:#39ff14"></i>' + T('gs.dungeon.potion') + '</span>' +
    '<span><i class="dg-dot" style="background:#ffe600"></i>' + T('gs.dungeon.coin') + '</span>' +
    '<span><i class="dg-dot" style="background:#b967ff"></i>' + T('gs.dungeon.legendEquip') + '</span>' +
    '<span><i class="dg-dot" style="background:#ff6b3d"></i>' + T('gs.dungeon.legendTrap') + '</span>' +
    '<span><i class="dg-dot" style="background:#39ff14;border-radius:2px"></i>' + T('gs.dungeon.stair') + '</span>';

  stage.appendChild(canvas);
  stage.appendChild(overlay);
  stage.appendChild(pauseOv);

  var root = document.getElementById('game-root');
  var wrap = document.createElement('div');
  wrap.className = 'dg-wrap';
  wrap.appendChild(top);
  wrap.appendChild(msg);
  wrap.appendChild(menu);
  wrap.appendChild(stage);
  wrap.appendChild(equipPanel);
  wrap.appendChild(eqPrompt);
  wrap.appendChild(skillBar);
  wrap.appendChild(dpadHolder);
  wrap.appendChild(leg);
  root.appendChild(wrap);

  var hpEl = document.getElementById('dg-hp');
  var hpFillEl = document.getElementById('dg-hpfill');
  var layerEl = document.getElementById('dg-layer');
  var atkEl = document.getElementById('dg-atk');
  var defEl = document.getElementById('dg-def');
  var scoreEl = document.getElementById('dg-score');
  var scoreLbl = document.getElementById('dg-scorelbl');
  scoreLbl.textContent = T('gs.dungeon.scoreShort');
  var ovTitle = document.getElementById('dg-ov-title');
  var ovSub = document.getElementById('dg-ov-sub');
  var ovStats = document.getElementById('dg-ov-stats');
  var startBtn = document.getElementById('dg-start');
  var changeBtn = document.getElementById('dg-change');
  var lobbyLink = document.getElementById('dg-lobby');
  var pauseBtn = document.getElementById('dg-pausebtn');
  var resumeBtn = document.getElementById('dg-resume');
  var saveExitBtn = document.getElementById('dg-saveexit');
  var classesEl = document.getElementById('dg-classes');
  var continueBtn = document.getElementById('dg-continue');
  var beginBtn = document.getElementById('dg-begin');
  var eqEls = {
    weapon: document.getElementById('dg-eq-weapon'),
    armor: document.getElementById('dg-eq-armor'),
    trinket: document.getElementById('dg-eq-trinket')
  };
  var eqSum = document.getElementById('dg-eq-sum');
  var eqpTitle = document.getElementById('dg-eqp-title');
  var eqpCompare = document.getElementById('dg-eqp-compare');
  var eqpTake = document.getElementById('dg-eqp-take');
  var eqpDrop = document.getElementById('dg-eqp-drop');
  var skillQ = document.getElementById('dg-skill-q');
  var skillE = document.getElementById('dg-skill-e');
  var skillQName = document.getElementById('dg-sk-q-name');
  var skillEName = document.getElementById('dg-sk-e-name');
  var skillQCd = document.getElementById('dg-sk-q-cd');
  var skillECd = document.getElementById('dg-sk-e-cd');

  /* ---------- 状态 ---------- */
  var grid = [], explored = [], visible = [], torches = [], rooms = [];
  var monsters = [], items = [], traps = [];
  var particles = [], rings = [], beams = [], slashes = [], texts = [];
  var px = 0, py = 0, prx = 0, pry = 0;
  var facing = { x: 1, y: 0 };
  var classId = readSavedClass();
  var equip = { weapon: null, armor: null, trinket: null };
  var baseHp = 44, baseAtk = 4, baseDef = 2;
  var hp = 44, maxHp = 44, atk = 4, def = 2, skillPower = 100;
  var cdClass = 0, cdUni = 0;
  var universalUnlocked = false, poison = null;
  var layer = 1, score = 0, kills = 0, steps = 0;
  var runSeed = 1, levelSeed = 1;
  var over = false, started = false, paused = false, won = false;
  var menuOpen = true, awaitEquip = false, pendingEquip = null, pendingFinishSlot = null;
  var autoPath = [];
  var clock = 0, hitFlash = 0, lastAct = 0;
  var runStartAt = 0;

  function readSavedClass() {
    try {
      var v = localStorage.getItem(CLS_KEY);
      if (v && CLASSES[v]) return v;
    } catch (e) {}
    return 'warrior';
  }
  function saveClass(id) {
    try { localStorage.setItem(CLS_KEY, id); } catch (e) {}
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rndInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }

  /* ---------- 种子随机（存档可按 levelSeed 复原地图） ---------- */
  var rng = Math.random;
  function seedRng(seed) {
    var a = seed >>> 0;
    rng = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function levelSeedFor(seed, lv) {
    var x = (seed ^ (lv * 0x9E3779B9)) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }

  /* ---------- 地图生成：房间 + L 走廊，保证连通 ---------- */
  function genLevel() {
    grid = []; explored = []; visible = []; torches = []; rooms = [];
    for (var y0 = 0; y0 < ROWS; y0++) {
      var row = [], er = [], vr = [];
      for (var x0 = 0; x0 < COLS; x0++) { row.push(WALL); er.push(false); vr.push(false); }
      grid.push(row); explored.push(er); visible.push(vr);
    }

    var tries = 0;
    while (rooms.length < 5 && tries < 240) {
      tries++;
      var rw = 4 + Math.floor(rng() * 3);
      var rh = 3 + Math.floor(rng() * 2);
      var rx = 1 + Math.floor(rng() * (COLS - rw - 2));
      var ry = 1 + Math.floor(rng() * (ROWS - rh - 2));
      var overlap = false;
      for (var r = 0; r < rooms.length; r++) {
        var o = rooms[r];
        if (rx < o.x + o.w + 1 && rx + rw + 1 > o.x && ry < o.y + o.h + 1 && ry + rh + 1 > o.y) { overlap = true; break; }
      }
      if (overlap) continue;
      for (var yy = ry; yy < ry + rh; yy++) {
        for (var xx = rx; xx < rx + rw; xx++) grid[yy][xx] = FLOOR;
      }
      rooms.push({ x: rx, y: ry, w: rw, h: rh });
    }
    if (!rooms.length) {
      rooms.push({ x: 4, y: 4, w: 8, h: 5 });
      for (var by = 4; by < 9; by++) for (var bx = 4; bx < 12; bx++) grid[by][bx] = FLOOR;
    }

    for (var r2 = 1; r2 < rooms.length; r2++) {
      var c1x = rooms[r2 - 1].x + Math.floor(rooms[r2 - 1].w / 2);
      var c1y = rooms[r2 - 1].y + Math.floor(rooms[r2 - 1].h / 2);
      var c2x = rooms[r2].x + Math.floor(rooms[r2].w / 2);
      var c2y = rooms[r2].y + Math.floor(rooms[r2].h / 2);
      carve(c1x, c1y, c2x, c2y);
    }

    var startR = rooms[0];
    px = startR.x + Math.floor(startR.w / 2);
    py = startR.y + Math.floor(startR.h / 2);
    grid[py][px] = FLOOR;
    prx = px; pry = py;
    facing = { x: 1, y: 0 };

    var lastR = rooms[rooms.length - 1];
    var sx = lastR.x + Math.floor(lastR.w / 2);
    var sy = lastR.y + Math.floor(lastR.h / 2);
    if (sx === px && sy === py) {
      sx = lastR.x + 1; sy = lastR.y + 1;
      if (grid[sy][sx] !== FLOOR) { sx = lastR.x + lastR.w - 2; sy = lastR.y + lastR.h - 2; }
    }
    grid[sy][sx] = STAIR;
    var stairPos = { x: sx, y: sy };

    for (var t = 0; t < rooms.length; t++) {
      var rm = rooms[t];
      torches.push({ x: rm.x + 1, y: rm.y - 1, phase: rng() * 6.28 });
      if (rm.w > 5) torches.push({ x: rm.x + rm.w - 2, y: rm.y - 1, phase: rng() * 6.28 });
    }

    /* 物品：药水 / 金币 / 装备（每层至少 1 件装备） */
    items = []; traps = []; monsters = [];
    var nItem = 4 + layer;
    for (var i = 0; i < nItem; i++) {
      var pos = findFreeTile(2, stairPos);
      if (!pos) continue;
      var type;
      if (i === 0) type = 'equip';
      else {
        var roll = rng();
        type = roll < 0.34 ? 'potion' : (roll < 0.62 ? 'coin' : 'equip');
      }
      items.push({
        x: pos.x, y: pos.y, type: type,
        itemId: type === 'equip' ? ITEM_IDS[Math.floor(rng() * ITEM_IDS.length)] : null,
        phase: rng() * 6.28
      });
    }

    /* 普通敌人 */
    var nMon = 3 + layer + Math.floor(rng() * 2);
    var guard = 0;
    while (monsters.length < nMon && guard < 400) {
      guard++;
      var mp = findFreeTile(5, stairPos);
      if (!mp) break;
      var mhp = 8 + (layer - 1) * 3 + Math.floor(rng() * 4);
      monsters.push({
        x: mp.x, y: mp.y, rx: mp.x, ry: mp.y,
        hp: mhp, maxHp: mhp, atk: 2 + Math.floor(layer * 0.8),
        boss: false, kind: null, phase: 1, specialCd: 0, hurt: 0,
        tint: Math.floor(rng() * 3), awake: false
      });
    }

    if (layer === 3) placeBoss('mid', stairPos);
    if (layer === 5) placeBoss('final', stairPos);

    /* 陷阱：每层至少 3 种不同陷阱，绝不生成在起点附近 */
    var trapTypes = ['spike', 'poison', 'teleport', 'arrow'];
    var picked = trapTypes.slice();
    for (var sh = picked.length - 1; sh > 0; sh--) {
      var j = Math.floor(rng() * (sh + 1));
      var tmp = picked[sh]; picked[sh] = picked[j]; picked[j] = tmp;
    }
    var nTrap = 4 + Math.min(layer, 3);
    for (var ti = 0; ti < nTrap; ti++) {
      var tp = findFreeTile(4, stairPos);
      if (!tp) continue;
      var ttype = ti < 3 ? picked[ti] : trapTypes[Math.floor(rng() * trapTypes.length)];
      traps.push({ x: tp.x, y: tp.y, type: ttype, used: false, phase: rng() * 6.28 });
    }

    computeFov();
  }

  function carve(x0, y0, x1, y1) {
    var x = x0, y = y0;
    while (x !== x1) { grid[y][x] = FLOOR; x += (x1 > x ? 1 : -1); }
    while (y !== y1) { grid[y][x] = FLOOR; y += (y1 > y ? 1 : -1); }
    grid[y][x] = FLOOR;
  }

  function monsterAt(x, y) {
    for (var i = 0; i < monsters.length; i++) if (monsters[i].x === x && monsters[i].y === y) return monsters[i];
    return null;
  }
  function itemAt(x, y) {
    for (var i = 0; i < items.length; i++) if (items[i].x === x && items[i].y === y) return items[i];
    return null;
  }
  function trapAt(x, y) {
    for (var i = 0; i < traps.length; i++) if (traps[i].x === x && traps[i].y === y) return traps[i];
    return null;
  }
  function bossAlive(kind) {
    for (var i = 0; i < monsters.length; i++) {
      if (monsters[i].boss && monsters[i].kind === kind) return true;
    }
    return false;
  }
  function bossRef() {
    for (var i = 0; i < monsters.length; i++) if (monsters[i].boss) return monsters[i];
    return null;
  }
  function manhattan(x0, y0, x1, y1) { return Math.abs(x0 - x1) + Math.abs(y0 - y1); }
  function walkable(x, y) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS && grid[y][x] !== WALL;
  }

  function findFreeTile(minDist, stairPos) {
    for (var t = 0; t < 300; t++) {
      var x = 1 + Math.floor(rng() * (COLS - 2));
      var y = 1 + Math.floor(rng() * (ROWS - 2));
      if (grid[y][x] !== FLOOR) continue;
      if (x === px && y === py) continue;
      if (manhattan(x, y, px, py) < minDist) continue;
      if (stairPos && x === stairPos.x && y === stairPos.y) continue;
      if (monsterAt(x, y) || itemAt(x, y) || trapAt(x, y)) continue;
      return { x: x, y: y };
    }
    return null;
  }

  function placeBoss(kind, stairPos) {
    var room = null;
    if (kind === 'final') {
      room = rooms[rooms.length - 1];
    } else {
      for (var i = rooms.length - 1; i >= 1; i--) {
        var rm = rooms[i];
        var cx = rm.x + Math.floor(rm.w / 2), cy = rm.y + Math.floor(rm.h / 2);
        if (manhattan(cx, cy, px, py) >= 6) { room = rm; break; }
      }
      if (!room) room = rooms[rooms.length - 1];
    }
    var bx = room.x + Math.floor(room.w / 2);
    var by = room.y + Math.floor(room.h / 2);
    var guard = 0;
    while (guard < 300) {
      guard++;
      if (grid[by][bx] === FLOOR && !(bx === px && by === py) && manhattan(bx, by, px, py) >= 6 &&
          !(stairPos && bx === stairPos.x && by === stairPos.y) && !monsterAt(bx, by)) break;
      bx = room.x + Math.floor(rng() * room.w);
      by = room.y + Math.floor(rng() * room.h);
      if (guard > 200) { room = rooms[rooms.length - 1]; bx = room.x + 1; by = room.y + 1; }
    }
    var maxH = kind === 'mid' ? (36 + layer * 3) : (66 + layer * 4);
    monsters.push({
      x: bx, y: by, rx: bx, ry: by, hp: maxH, maxHp: maxH,
      atk: kind === 'mid' ? 5 : 6, boss: true, kind: kind, phase: 1,
      specialCd: kind === 'final' ? 3 : 2, hurt: 0, tint: 0, awake: false
    });
  }

  /* ---------- 视线：墙体遮挡（DDA 采样），记忆与实时视野分离 ---------- */
  function lineClear(x0, y0, x1, y1) {
    var ax = x0 + 0.5, ay = y0 + 0.5, bx = x1 + 0.5, by = y1 + 0.5;
    var dx = bx - ax, dy = by - ay;
    var steps = Math.max(2, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 3));
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var cx = Math.floor(ax + dx * t);
      var cy = Math.floor(ay + dy * t);
      if ((cx === x0 && cy === y0) || (cx === x1 && cy === y1)) continue;
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
      if (grid[cy][cx] === WALL) return false;
    }
    return true;
  }

  function computeFov() {
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) visible[y][x] = false;
    if (px < 0 || py < 0 || px >= COLS || py >= ROWS) return;
    visible[py][px] = true;
    explored[py][px] = true;
    var R2 = FOV * FOV;
    for (var ty = 0; ty < ROWS; ty++) {
      for (var tx = 0; tx < COLS; tx++) {
        var dx = tx - px, dy = ty - py;
        if (dx * dx + dy * dy > R2) continue;
        if (dx === 0 && dy === 0) continue;
        if (!lineClear(px, py, tx, ty)) continue;
        visible[ty][tx] = true;
        explored[ty][tx] = true;
      }
    }
  }

  function inFov(x, y) {
    return y >= 0 && y < ROWS && x >= 0 && x < COLS && visible[y][x];
  }

  /* ---------- 属性 / HUD ---------- */
  function equipBonus() {
    var b = { atk: 0, def: 0, hp: 0, sk: 0 };
    ['weapon', 'armor', 'trinket'].forEach(function (slot) {
      var id = equip[slot];
      var d = id && ITEMS[id];
      if (!d) return;
      b.atk += d.atk || 0; b.def += d.def || 0;
      b.hp += d.hp || 0; b.sk += d.sk || 0;
    });
    return b;
  }
  function recomputeStats(gainHp) {
    var cls = CLASSES[classId];
    var oldMax = maxHp;
    baseHp = cls.hp; baseAtk = cls.atk; baseDef = cls.def;
    var b = equipBonus();
    maxHp = baseHp + b.hp;
    atk = baseAtk + b.atk;
    def = baseDef + b.def;
    skillPower = 100 + b.sk;
    if (gainHp && maxHp > oldMax) hp += (maxHp - oldMax);
    hp = Math.min(hp, maxHp);
    if (hp < 0) hp = 0;
  }
  function itemName(id) {
    return id ? T('gs.dungeon.item.' + id) : T('gs.dungeon.slot.empty');
  }
  function itemStatsText(id) {
    var d = id && ITEMS[id];
    if (!d) return '';
    var parts = [];
    if (d.atk) parts.push('ATK +' + d.atk);
    if (d.def) parts.push('DEF +' + d.def);
    if (d.hp) parts.push('HP +' + d.hp);
    if (d.sk) parts.push(T('gs.dungeon.statSkill') + ' +' + d.sk + '%');
    return parts.join(' · ');
  }

  function updateHud(changed) {
    hpEl.textContent = hp + '/' + maxHp;
    if (hpFillEl) hpFillEl.style.width = Math.max(0, Math.round(hp / maxHp * 100)) + '%';
    layerEl.textContent = layer;
    atkEl.textContent = atk;
    defEl.textContent = def;
    scoreEl.textContent = score;
    if (changed) {
      changed.classList.remove('dg-pop');
      void changed.offsetWidth;
      changed.classList.add('dg-pop');
    }
  }

  function updateSkillUI() {
    var cls = CLASSES[classId];
    var skName = T('gs.dungeon.skillName.' + cls.skill);
    skillQName.textContent = skName;
    skillQ.title = T('gs.dungeon.skillDesc.' + cls.skill) + ' · Q';
    var qCool = cdClass > 0;
    skillQ.classList.toggle('cooling', qCool);
    skillQ.disabled = !canAct() || qCool;
    skillQCd.textContent = qCool ? String(cdClass) : '';

    skillEName.textContent = T('gs.dungeon.skillName.dash');
    skillE.title = T('gs.dungeon.skillDesc.dash') + ' · E';
    var eLocked = !universalUnlocked;
    var eCool = cdUni > 0;
    skillE.classList.toggle('locked', eLocked);
    skillE.classList.toggle('cooling', !eLocked && eCool);
    skillE.disabled = !canAct() || eLocked || eCool;
    skillECd.textContent = eLocked ? T('gs.dungeon.skillLocked') : (eCool ? String(cdUni) : '');
  }

  function updateEquipUI() {
    ['weapon', 'armor', 'trinket'].forEach(function (slot) {
      var el = eqEls[slot];
      if (!el) return;
      var id = equip[slot];
      el.textContent = itemName(id);
      el.title = id ? itemStatsText(id) : T('gs.dungeon.slot.empty');
      el.style.color = id ? (slot === 'weapon' ? '#ffb86b' : slot === 'armor' ? '#9ad1ff' : '#e2b6ff') : 'var(--text-dim)';
    });
    var b = equipBonus();
    eqSum.textContent = T('gs.dungeon.totalStats') + '  ATK +' + b.atk + ' · DEF +' + b.def +
      ' · HP +' + b.hp + ' · ' + T('gs.dungeon.statSkill') + ' +' + b.sk + '%';
  }

  function canAct() {
    return started && !over && !paused && !menuOpen && !awaitEquip;
  }

  /* ---------- 职业选择 ---------- */
  function buildClassCards() {
    classesEl.innerHTML = '';
    Object.keys(CLASSES).forEach(function (id) {
      var c = CLASSES[id];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dg-class' + (id === classId ? ' sel' : '');
      btn.style.setProperty('--cls-color', c.color);
      btn.innerHTML =
        '<span class="dg-cn" style="color:' + c.color + '">' + T('gs.dungeon.cls.' + id) + '</span>' +
        '<span class="dg-cs">HP ' + c.hp + ' · ATK ' + c.atk + ' · DEF ' + c.def + '</span>' +
        '<span class="dg-cd">' + T('gs.dungeon.cls.' + id + 'Desc') + '</span>' +
        '<span class="dg-ck">' + T('gs.dungeon.skillName.' + c.skill) + '</span>';
      btn.addEventListener('click', function () {
        classId = id;
        saveClass(id);
        buildClassCards();
        var cls = CLASSES[classId];
        maxHp = cls.hp; hp = cls.hp; atk = cls.atk; def = cls.def;
        updateHud();
        updateSkillUI();
        if (Arcade.audio) Arcade.audio.play('ui');
      });
      classesEl.appendChild(btn);
    });
  }

  function showMenu() {
    started = false; over = false; won = false; paused = false; menuOpen = true;
    awaitEquip = false; pendingEquip = null; pendingFinishSlot = null; autoPath = [];
    overlay.classList.add('hidden');
    pauseOv.classList.add('hidden');
    stage.classList.add('hidden');
    equipPanel.classList.add('hidden');
    skillBar.classList.add('hidden');
    dpadHolder.style.display = 'none';
    menu.classList.remove('hidden');
    buildClassCards();
    var cls = CLASSES[classId];
    maxHp = cls.hp; hp = cls.hp; atk = cls.atk; def = cls.def;
    updateHud(); updateSkillUI(); updateEquipUI();
    var raw = readSaveRaw();
    if (raw && raw.v === 3 && raw.layer >= 1 && raw.layer <= MAX_LAYER) {
      continueBtn.style.display = '';
      continueBtn.textContent = T('gs.dungeon.contBtn') + ' · ' + raw.layer + '/5';
      continueBtn.title = T('gs.dungeon.contInfo').replace('{n}', raw.layer)
        .replace('{c}', T('gs.dungeon.cls.' + (raw.cls in CLASSES ? raw.cls : 'warrior')));
    } else {
      continueBtn.style.display = 'none';
    }
    msg.textContent = T('gs.dungeon.clickHint');
  }

  function showPlayUI() {
    menu.classList.add('hidden');
    menuOpen = false;
    stage.classList.remove('hidden');
    equipPanel.classList.remove('hidden');
    skillBar.classList.remove('hidden');
    dpadHolder.style.display = '';
    fitCanvas();
  }

  /* ---------- 存档 ---------- */
  function saveKey() { return 'arcade_save_dungeon'; }
  function readSaveRaw() {
    try { return JSON.parse(localStorage.getItem(saveKey()) || 'null'); } catch (e) { return null; }
  }
  function writeSave() {
    if (window.Arcade && Arcade.savegame) return Arcade.savegame.write();
    return false;
  }
  function applySave(s) {
    if (!s || s.v !== 3) return false;
    if (typeof s.layer !== 'number' || s.layer < 1 || s.layer > MAX_LAYER) return false;
    if (s.over) return false;
    if (!(s.cls in CLASSES)) return false;
    classId = s.cls;
    saveClass(classId);
    layer = s.layer;
    runSeed = Number(s.runSeed) || 1;
    levelSeed = Number(s.levelSeed) || levelSeedFor(runSeed, layer);
    seedRng(levelSeed);
    genLevel();

    if (typeof s.px === 'number' && typeof s.py === 'number' && walkable(s.px, s.py)) {
      px = s.px; py = s.py;
    }
    prx = px; pry = py;
    if (s.facing && typeof s.facing.x === 'number') facing = { x: s.facing.x, y: s.facing.y };

    score = Number(s.score) || 0;
    kills = Number(s.kills) || 0;
    steps = Number(s.steps) || 0;
    equip = {
      weapon: (s.equip && s.equip.weapon in ITEMS) ? s.equip.weapon : null,
      armor: (s.equip && s.equip.armor in ITEMS) ? s.equip.armor : null,
      trinket: (s.equip && s.equip.trinket in ITEMS) ? s.equip.trinket : null
    };
    universalUnlocked = !!s.universalUnlocked;
    cdClass = Math.max(0, Number(s.cdClass) || 0);
    cdUni = Math.max(0, Number(s.cdUni) || 0);
    poison = (s.poison && s.poison.turns > 0) ? { turns: s.poison.turns, dmg: s.poison.dmg } : null;

    monsters = [];
    (s.monsters || []).forEach(function (m) {
      if (!m || !walkable(m.x, m.y)) return;
      var mx = m.maxHp || m.hp || 8;
      monsters.push({
        x: m.x, y: m.y, rx: m.x, ry: m.y,
        hp: Math.max(1, m.hp), maxHp: mx, atk: m.atk || 2,
        boss: !!m.boss, kind: m.kind || null, phase: m.phase || 1,
        specialCd: m.specialCd || 0, hurt: 0, tint: m.tint || 0, awake: !!m.awake
      });
    });
    items = [];
    (s.items || []).forEach(function (it) {
      if (!it || !walkable(it.x, it.y)) return;
      if (it.type !== 'potion' && it.type !== 'coin' && it.type !== 'equip') return;
      if (it.type === 'equip' && !(it.itemId in ITEMS)) return;
      items.push({ x: it.x, y: it.y, type: it.type, itemId: it.itemId || null, phase: it.phase || 0 });
    });
    traps = [];
    (s.traps || []).forEach(function (tr) {
      if (!tr || !walkable(tr.x, tr.y)) return;
      if (['spike', 'poison', 'teleport', 'arrow'].indexOf(tr.type) < 0) return;
      traps.push({ x: tr.x, y: tr.y, type: tr.type, used: !!tr.used, phase: tr.phase || 0 });
    });

    if (typeof s.explored === 'string' && s.explored.length >= ROWS * COLS) {
      explored = [];
      for (var y = 0; y < ROWS; y++) {
        var row = [];
        for (var x = 0; x < COLS; x++) row.push(s.explored.charAt(y * COLS + x) === '1');
        explored.push(row);
      }
    }

    recomputeStats(false);
    maxHp = Number(s.maxHp) || maxHp;
    atk = Number(s.atk) || atk;
    def = Number(s.def) || def;
    skillPower = Number(s.skillPower) || skillPower;
    hp = Math.min(maxHp, Math.max(1, Number(s.hp) || maxHp));

    started = true; over = false; won = false; paused = false;
    menuOpen = false; awaitEquip = false; pendingEquip = null; pendingFinishSlot = null;
    autoPath = [];
    showPlayUI();
    overlay.classList.add('hidden');
    pauseOv.classList.add('hidden');
    computeFov();
    msg.textContent = T('gs.dungeon.descendMsg').replace('{n}', layer);
    updateHud(); updateSkillUI(); updateEquipUI();
    lastAct = Date.now();
    return true;
  }

  function saveSnapshot() {
    if (!started || over || menuOpen) return null;
    var ex = '';
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) ex += explored[y][x] ? '1' : '0';
    }
    return {
      v: 3, cls: classId, layer: layer, px: px, py: py, facing: facing,
      hp: hp, maxHp: maxHp, atk: atk, def: def, skillPower: skillPower,
      score: score, kills: kills, steps: steps,
      runSeed: runSeed, levelSeed: levelSeed,
      equip: equip, universalUnlocked: universalUnlocked,
      cdClass: cdClass, cdUni: cdUni, poison: poison,
      monsters: monsters.map(function (m) {
        return {
          x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, atk: m.atk,
          boss: !!m.boss, kind: m.kind, phase: m.phase,
          specialCd: m.specialCd, tint: m.tint, awake: !!m.awake
        };
      }),
      items: items.map(function (it) {
        return { x: it.x, y: it.y, type: it.type, itemId: it.itemId, phase: it.phase };
      }),
      traps: traps.map(function (tr) {
        return { x: tr.x, y: tr.y, type: tr.type, used: tr.used, phase: tr.phase };
      }),
      explored: ex
    };
  }

  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'dungeon',
      collect: saveSnapshot,
      apply: applySave
    });
  }

  /* ---------- 新局 / 开始 ---------- */
  function resetRunState() {
    score = 0; kills = 0; steps = 0;
    over = false; won = false; started = true; paused = false;
    menuOpen = false; awaitEquip = false; pendingEquip = null; pendingFinishSlot = null;
    autoPath = [];
    cdClass = 0; cdUni = 0; universalUnlocked = false; poison = null;
    particles = []; rings = []; beams = []; slashes = []; texts = [];
    hitFlash = 0; autoPath = [];
  }

  function startGame(clsId) {
    if (clsId && CLASSES[clsId]) classId = clsId;
    saveClass(classId);
    resetRunState();
    layer = 1;
    runSeed = ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
    levelSeed = levelSeedFor(runSeed, layer);
    seedRng(levelSeed);
    genLevel();

    var cls = CLASSES[classId];
    equip = { weapon: cls.weapon, armor: cls.armor, trinket: cls.trinket };
    recomputeStats(false);
    hp = maxHp;
    runStartAt = Date.now();
    showPlayUI();
    overlay.classList.add('hidden');
    pauseOv.classList.add('hidden');
    msg.textContent = layer === 3 ? T('gs.dungeon.bossWakeMid') : T('gs.dungeon.startMsg');
    updateHud(); updateSkillUI(); updateEquipUI();
    lastAct = Date.now();
    if (Arcade.audio) Arcade.audio.play('ui');
    if (Arcade.fx) Arcade.fx.flash('var(--neon-cyan)');
    writeSave();
  }

  function descend() {
    layer++;
    score += 25;
    hp = Math.min(maxHp, hp + 6);
    poison = null;
    levelSeed = levelSeedFor(runSeed, layer);
    seedRng(levelSeed);
    genLevel();
    msg.textContent = T('gs.dungeon.descendMsg').replace('{n}', layer);
    if (layer === 3) {
      msg.textContent = T('gs.dungeon.bossWakeMid');
      if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.bossWakeMid'), 'warn');
    }
    if (layer === 5) {
      msg.textContent = T('gs.dungeon.bossWakeFinal');
      if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.bossWakeFinal'), 'warn');
    }
    if (layer === 2) {
      universalUnlocked = true;
      if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.universalUnlock'), 'ok');
      spawnBurst(W / 2, H / 2, '#b967ff', 26, 3);
      if (Arcade.audio) Arcade.audio.play('record');
    }
    if (Arcade.audio) Arcade.audio.play('win');
    if (Arcade.fx) Arcade.fx.flash('var(--neon-green)');
    spawnBurst((px + 0.5) * cw, (py + 0.5) * ch, '#39ff14', 16, 2);
    updateHud(scoreEl); updateSkillUI(); updateEquipUI();
    writeSave();
  }

  /* ---------- 特效（自绘粒子 / 环 / 光束 / 斩击 / 浮动数字） ---------- */
  function spawnBurst(x, y, color, count, speed, layer) {
    if (!count) count = 12;
    var sp = speed || 2.4;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = (0.4 + Math.random() * 0.8) * sp;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6,
        life: 1, decay: 0.025 + Math.random() * 0.03,
        size: 1.4 + Math.random() * 2.4, color: color,
        grav: 0.11, z: (layer === 0 ? 0 : 1)
      });
    }
  }
  function spawnRing(x, y, color, grow) {
    rings.push({ x: x, y: y, r: 3, life: 1, color: color, grow: grow || 2.2 });
  }
  function addBeam(x0, y0, x1, y1, color, width) {
    beams.push({ x0: x0, y0: y0, x1: x1, y1: y1, color: color, life: 1, width: width || 2.4 });
  }
  function addSlash(x, y, color, ang) {
    slashes.push({ x: x, y: y, life: 1, color: color || '#ffe600', ang: ang || 0 });
  }
  function addText(x, y, str, color) {
    texts.push({ x: x, y: y, y0: y, str: String(str), color: color || '#ffe600', life: 1, vy: -0.9 });
  }
  function cellCenter(x, y) { return { x: (x + 0.5) * cw, y: (y + 0.5) * ch }; }

  /* ---------- 移动 / 陷阱 / 拾取 ---------- */
  function tryMove(dx, dy, auto) {
    if (!canAct()) return false;
    var now = Date.now();
    if (now - lastAct < ACT_GAP) return false;
    lastAct = now;
    if (!auto) autoPath = [];
    facing = { x: dx, y: dy };

    var nx = px + dx, ny = py + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { if (Arcade.juice) Arcade.juice.move(); autoPath = []; return false; }
    if (grid[ny][nx] === WALL) { if (Arcade.juice) Arcade.juice.move(); autoPath = []; return false; }

    var foe = monsterAt(nx, ny);
    if (foe) { autoPath = []; attack(foe); return true; }

    spawnBurst((px + 0.5) * cw, (py + 0.9) * ch, '#00f0ff', 2, 0.7, 0);
    px = nx; py = ny;
    steps++;
    if (Arcade.juice) Arcade.juice.move();
    var tr = trapAt(px, py);
    if (tr && !tr.used) {
      triggerTrap(tr);
      if (over) return true;
    }

    var it = itemAt(px, py);
    if (it) pickupItem(it);
    if (awaitEquip) { pendingFinishSlot = null; return true; }

    if (grid[py][px] === STAIR) {
      if (handleStair()) return true;
    }
    endAction(null);
    return true;
  }

  function handleStair() {
    if (grid[py][px] !== STAIR) return false;
    if (layer >= MAX_LAYER) {
      if (bossAlive('final')) {
        msg.textContent = T('gs.dungeon.finalLocked');
        if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.finalLocked'), 'warn');
        return false;
      }
      win();
      return true;
    }
    if (layer === 3 && bossAlive('mid')) {
      msg.textContent = T('gs.dungeon.bossStairLock');
      if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.bossStairLock'), 'warn');
      if (Arcade.audio) Arcade.audio.play('error');
      return false;
    }
    descend();
    return true;
  }

  function triggerTrap(tr) {
    tr.used = true;
    var c = cellCenter(px, py);
    if (tr.type === 'spike') {
      var raw = 5 + layer * 2;
      var dmg = damageTaken(raw);
      spawnBurst(c.x, c.y, '#ff6b3d', 18, 3.2);
      spawnRing(c.x, c.y, '#ff6b3d', 2.4);
      addSlash(c.x, c.y, '#ff9f1c', Math.random() * 6.28);
      hitFlash = 1;
      shakeT = 1;
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(stage);
      msg.textContent = T('gs.dungeon.trapMsg.spike').replace('{n}', dmg);
      hurtPlayer(raw);
    } else if (tr.type === 'poison') {
      var turns = 4;
      poison = { turns: turns, dmg: 2 + Math.floor(layer / 2) };
      spawnBurst(c.x, c.y, '#39ff14', 22, 2.2);
      spawnRing(c.x, c.y, '#39ff14', 1.8);
      if (Arcade.audio) Arcade.audio.play('error');
      msg.textContent = T('gs.dungeon.trapMsg.poison').replace('{n}', turns);
      addText(c.x, c.y - 8, T('gs.dungeon.trap.poison'), '#39ff14');
    } else if (tr.type === 'teleport') {
      spawnBurst(c.x, c.y, '#b967ff', 24, 3);
      spawnRing(c.x, c.y, '#b967ff', 2.8);
      var dest = null;
      for (var i = 0; i < 200; i++) {
        var tx = 1 + Math.floor(Math.random() * (COLS - 2));
        var ty = 1 + Math.floor(Math.random() * (ROWS - 2));
        if (grid[ty][tx] !== FLOOR) continue;
        if (manhattan(tx, ty, px, py) < 5) continue;
        if (monsterAt(tx, ty)) continue;
        dest = { x: tx, y: ty }; break;
      }
      if (dest) {
        px = dest.x; py = dest.y; prx = px; pry = py;
        computeFov();
        var c2 = cellCenter(px, py);
        spawnBurst(c2.x, c2.y, '#b967ff', 20, 3);
        addText(c2.x, c2.y - 8, T('gs.dungeon.trap.teleport'), '#b967ff');
      }
      if (Arcade.audio) Arcade.audio.play('ui');
      msg.textContent = T('gs.dungeon.trapMsg.teleport');
    } else {
      var aRaw = 4 + layer * 2;
      var aDmg = damageTaken(aRaw);
      var dir = Math.floor(Math.random() * 4);
      var sx = px, sy = py;
      if (dir === 0) sx = 0; else if (dir === 1) sx = COLS - 1;
      else if (dir === 2) sy = 0; else sy = ROWS - 1;
      addBeam((sx + 0.5) * cw, (sy + 0.5) * ch, c.x, c.y, '#ff2d95', 2);
      spawnBurst(c.x, c.y, '#ff2d95', 16, 3);
      addSlash(c.x, c.y, '#ff2d95', 0);
      hitFlash = 1;
      shakeT = 1;
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(stage);
      msg.textContent = T('gs.dungeon.trapMsg.arrow').replace('{n}', aDmg);
      hurtPlayer(aRaw);
    }
    if (!over && window.Arcade && Arcade.ui) Arcade.ui.toast(msg.textContent, 'warn');
    updateHud(hpEl);
  }

  function pickupItem(it) {
    var idx = items.indexOf(it);
    if (idx < 0) return;
    var c = cellCenter(it.x, it.y);
    if (it.type === 'potion') {
      items.splice(idx, 1);
      hp = Math.min(maxHp, hp + 12);
      msg.textContent = T('gs.dungeon.msgPotion');
      if (Arcade.audio) Arcade.audio.play('coin');
      spawnBurst(c.x, c.y, '#39ff14', 12, 2);
      addText(c.x, c.y - 8, '+12 HP', '#39ff14');
      updateHud(hpEl);
    } else if (it.type === 'coin') {
      items.splice(idx, 1);
      score += 5;
      msg.textContent = T('gs.dungeon.msgCoin');
      if (Arcade.audio) Arcade.audio.play('coin');
      spawnBurst(c.x, c.y, '#ffe600', 12, 2);
      addText(c.x, c.y - 8, '+5', '#ffe600');
      updateHud(scoreEl);
    } else if (it.type === 'equip' && ITEMS[it.itemId]) {
      items.splice(idx, 1);
      showEquipPrompt(it.itemId);
    }
  }

  /* ---------- 装备对比面板 ---------- */
  function showEquipPrompt(itemId) {
    pendingEquip = itemId;
    awaitEquip = true;
    updateSkillUI();
    var itemDef = ITEMS[itemId];
    var slot = itemDef.slot;
    var cur = equip[slot];
    eqpTitle.textContent = T('gs.dungeon.equipFound').replace('{n}', itemName(itemId));

    var sim = { weapon: equip.weapon, armor: equip.armor, trinket: equip.trinket };
    sim[slot] = itemId;
    var nb = { atk: baseAtk, def: baseDef, hp: baseHp, sk: 100 };
    ['weapon', 'armor', 'trinket'].forEach(function (sl) {
      var d = sim[sl] && ITEMS[sim[sl]];
      if (!d) return;
      nb.atk += d.atk || 0; nb.def += d.def || 0; nb.hp += d.hp || 0; nb.sk += d.sk || 0;
    });
    function delta(now, next) {
      var d = next - now;
      if (d === 0) return '<span class="dg-eq-same">±0</span>';
      return '<span class="' + (d > 0 ? 'dg-eq-up' : 'dg-eq-down') + '">' + (d > 0 ? '+' : '') + d + '</span>';
    }
    eqpCompare.innerHTML =
      '<div class="dg-eqp-row"><span class="dg-eqp-k">' + T('gs.dungeon.equipNow') + '</span>' +
      '<span>' + (cur ? itemName(cur) + ' <b>' + itemStatsText(cur) + '</b>' : T('gs.dungeon.slot.empty')) + '</span></div>' +
      '<div class="dg-eqp-row new"><span class="dg-eqp-k">' + T('gs.dungeon.equipTake') + '</span>' +
      '<span>' + itemName(itemId) + ' <b>' + itemStatsText(itemId) + '</b></span></div>' +
      '<div class="dg-eqp-total">' +
      T('gs.dungeon.statAtk') + ' ' + atk + '→' + nb.atk + ' ' + delta(atk, nb.atk) + ' · ' +
      T('gs.dungeon.statDef') + ' ' + def + '→' + nb.def + ' ' + delta(def, nb.def) + '<br>' +
      T('gs.dungeon.statHp') + ' ' + maxHp + '→' + nb.hp + ' ' + delta(maxHp, nb.hp) + ' · ' +
      T('gs.dungeon.statSkill') + ' ' + skillPower + '%→' + nb.sk + '% ' + delta(skillPower, nb.sk) +
      '</div>';
    eqPrompt.classList.remove('hidden');
  }

  function resolveEquip(take) {
    if (!pendingEquip) return;
    var itemId = pendingEquip;
    var slot = ITEMS[itemId].slot;
    var c = cellCenter(px, py);
    if (take) {
      equip[slot] = itemId;
      recomputeStats(true);
      msg.textContent = T('gs.dungeon.equippedMsg').replace('{n}', itemName(itemId));
      spawnBurst(c.x, c.y, '#b967ff', 16, 2.4);
      if (Arcade.audio) Arcade.audio.play('clear');
    } else {
      msg.textContent = T('gs.dungeon.discardedMsg').replace('{n}', itemName(itemId));
      if (Arcade.audio) Arcade.audio.play('back');
    }
    pendingEquip = null;
    awaitEquip = false;
    eqPrompt.classList.add('hidden');
    updateHud(hpEl); updateEquipUI(); updateSkillUI();
    var finishSlot = pendingFinishSlot;
    pendingFinishSlot = null;
    if (!over) endAction(finishSlot);
  }

  function endAction(usedSlot) {
    if (awaitEquip) { pendingFinishSlot = usedSlot; return; }
    finishPlayerTurn(usedSlot);
  }

  function finishPlayerTurn(usedSlot) {
    if (over) return;
    if (Array.isArray(autoPath) && autoPath.length && !awaitEquip) { /* 点击寻路继续 */ }
    if (poison && poison.turns > 0) {
      poison.turns--;
      var pd = poison.dmg;
      hp -= pd;
      hitFlash = Math.max(hitFlash, 0.45);
      msg.textContent = T('gs.dungeon.poisonTick').replace('{n}', pd);
      var pc = cellCenter(px, py);
      spawnBurst(pc.x, pc.y, '#39ff14', 10, 1.6);
      addText(pc.x, pc.y - 9, '-' + pd, '#39ff14');
      if (hp <= 0) { hp = 0; updateHud(hpEl); gameOver(); return; }
      if (poison.turns <= 0) poison = null;
      updateHud(hpEl);
    }
    enemyTurn();
    if (over) return;
    if (usedSlot !== 'class' && cdClass > 0) cdClass--;
    if (usedSlot !== 'uni' && cdUni > 0) cdUni--;
    computeFov();
    updateHud(); updateSkillUI(); updateEquipUI();
    writeSave();
  }

  /* ---------- 伤害 / 战斗 ---------- */
  function damageTaken(raw) { return Math.max(1, raw - def); }

  function hurtPlayer(raw) {
    if (over) return true;
    var dmg = damageTaken(raw);
    hp -= dmg;
    hitFlash = 1;
    shakeT = 1;
    var c = cellCenter(px, py);
    spawnBurst(c.x, c.y, '#ff2d95', 14, 2.6);
    spawnRing(c.x, c.y, '#ff2d95', 2);
    addText(c.x, c.y - 8, '-' + dmg, '#ff2d95');
    if (Arcade.fx) Arcade.fx.shake(stage);
    if (hp <= 0) { hp = 0; updateHud(hpEl); gameOver(); return true; }
    updateHud(hpEl);
    return false;
  }

  function attack(foe) {
    var c = cellCenter(foe.x, foe.y);
    addSlash(c.x, c.y, CLASSES[classId].glow, Math.atan2(facing.y, facing.x));
    spawnBurst(c.x, c.y, CLASSES[classId].color, 10, 2.2);
    if (Arcade.audio) Arcade.audio.play('match');
    var dmg = atk;
    hitMonster(foe, dmg, CLASSES[classId].color);
    if (over) return;
    msg.textContent = T('gs.dungeon.msgHit').replace('{n}', dmg);
    endAction(null);
  }

  function hitMonster(m, dmg, color) {
    if (!m || m.hp <= 0) return;
    m.hp -= dmg;
    m.hurt = 1;
    var c = cellCenter(m.x, m.y);
    spawnBurst(c.x, c.y, color || '#ffe600', 9, 2);
    addText(c.x, c.y - 8, '-' + dmg, color || '#ffe600');
    if (m.boss) checkBossPhase(m);
    if (m.hp <= 0) killMonster(m);
  }

  function killMonster(m) {
    var idx = monsters.indexOf(m);
    if (idx < 0) return;
    monsters.splice(idx, 1);
    var c = cellCenter(m.x, m.y);
    var pts = m.kind === 'final' ? 200 : (m.kind === 'mid' ? 80 : 10);
    score += pts;
    kills++;
    spawnBurst(c.x, c.y, m.boss ? '#ff2d95' : '#ff2d95', m.boss ? 34 : 14, m.boss ? 3.6 : 2.4);
    spawnRing(c.x, c.y, '#ff2d95', m.boss ? 4 : 2.2);
    shakeT = 1;
    if (Arcade.fx) Arcade.fx.shake(stage);
    if (Arcade.audio) Arcade.audio.play(m.boss ? 'record' : 'clear');
    updateHud(scoreEl);

    if (m.kind === 'final') {
      msg.textContent = T('gs.dungeon.finalWinMsg');
      win();
      return;
    }
    if (m.kind === 'mid') {
      msg.textContent = T('gs.dungeon.bossDownMsg').replace('{n}', T('gs.dungeon.boss.mid')).replace('{m}', pts);
      if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.bossDownMsg').replace('{n}', T('gs.dungeon.boss.mid')).replace('{m}', pts), 'ok');
      dropEquipAt(m.x, m.y, true);
    } else {
      msg.textContent = T('gs.dungeon.msgKill').replace('{n}', pts);
      if (Math.random() < 0.24) dropEquipAt(m.x, m.y, false);
    }
    writeSave();
  }

  function dropEquipAt(x, y, bossDrop) {
    if (itemAt(x, y)) return;
    var pool = bossDrop
      ? ['w_flame', 'w_hammer', 'a_plate', 'a_shadow', 't_power', 't_vamp']
      : ITEM_IDS;
    var id = pool[Math.floor(Math.random() * pool.length)];
    items.push({ x: x, y: y, type: 'equip', itemId: id, phase: Math.random() * 6.28 });
  }

  function checkBossPhase(m) {
    if (m.kind !== 'final' || m.phase !== 1 || m.hp > m.maxHp * 0.5 || m.hp <= 0) return;
    m.phase = 2;
    m.atk += 3;
    m.specialCd = 2;
    var c = cellCenter(m.x, m.y);
    spawnBurst(c.x, c.y, '#ff2d95', 42, 4);
    spawnBurst(c.x, c.y, '#ffe600', 24, 3);
    spawnRing(c.x, c.y, '#ff2d95', 3.6);
    spawnRing(c.x, c.y, '#ffe600', 2.8);
    hitFlash = 0.8;
    shakeT = 1;
    if (Arcade.fx) Arcade.fx.shake(stage);
    if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
    if (Arcade.audio) Arcade.audio.play('record');
    msg.textContent = T('gs.dungeon.bossPhaseMsg');
    if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.bossPhaseMsg'), 'warn');
  }

  /* ---------- 主动技能 ---------- */
  function useSkill(slot) {
    if (!canAct()) return;
    if (slot === 'class') {
      if (cdClass > 0) {
        msg.textContent = T('gs.dungeon.skillCd').replace('{n}', cdClass);
        if (Arcade.audio) Arcade.audio.play('error');
        return;
      }
      castClassSkill();
      if (over) return;
      endAction('class');
    } else {
      if (!universalUnlocked) {
        msg.textContent = T('gs.dungeon.skillLocked');
        return;
      }
      if (cdUni > 0) {
        msg.textContent = T('gs.dungeon.skillCd').replace('{n}', cdUni);
        if (Arcade.audio) Arcade.audio.play('error');
        return;
      }
      castDash();
      if (over) return;
      endAction('uni');
    }
  }

  function castClassSkill() {
    var cls = CLASSES[classId];
    var sk = cls.skill;
    var info = SKILLS[sk];
    var dmg = Math.round(atk * info.mul * skillPower / 100);
    var hits = 0, total = 0;
    var c = cellCenter(px, py);
    if (sk === 'cleave') {
      spawnRing(c.x, c.y, cls.color, 3.4);
      for (var a = 0; a < 8; a++) {
        var ang = a * Math.PI / 4;
        addSlash(c.x + Math.cos(ang) * cw * 0.5, c.y + Math.sin(ang) * ch * 0.5, cls.color, ang);
      }
      monsters.slice().forEach(function (m) {
        if (over) return;
        var dx = Math.abs(m.x - px), dy = Math.abs(m.y - py);
        if (dx <= 1 && dy <= 1 && dx + dy > 0) {
          hitMonster(m, dmg, cls.color); hits++; total += dmg;
        }
      });
      if (Arcade.audio) Arcade.audio.play('match');
      if (Arcade.fx) Arcade.fx.shake(stage);
    } else if (sk === 'fireball') {
      var endX = px, endY = py, target = null;
      for (var i = 1; i <= 5; i++) {
        var nx = px + facing.x * i, ny = py + facing.y * i;
        if (!walkable(nx, ny)) break;
        endX = nx; endY = ny;
        var foe = monsterAt(nx, ny);
        if (foe) { target = foe; break; }
      }
      var ec = cellCenter(endX, endY);
      addBeam(c.x, c.y, ec.x, ec.y, cls.color, 3);
      spawnBurst(ec.x, ec.y, cls.color, 18, 3);
      spawnRing(ec.x, ec.y, cls.color, 2.4);
      if (target) { hitMonster(target, dmg, cls.color); hits = 1; total = dmg; }
      if (Arcade.audio) Arcade.audio.play('record');
    } else if (sk === 'volley') {
      var range = info.range || 6;
      var dist = 0;
      for (var j = 1; j <= range; j++) {
        var vx = px + facing.x * j, vy = py + facing.y * j;
        if (!walkable(vx, vy)) break;
        dist = j;
        var f2 = monsterAt(vx, vy);
        if (f2) { hitMonster(f2, dmg, cls.color); hits++; total += dmg; }
      }
      var vc = cellCenter(px + facing.x * Math.max(1, dist), py + facing.y * Math.max(1, dist));
      addBeam(c.x, c.y, vc.x, vc.y, cls.color, 2.6);
      spawnBurst(vc.x, vc.y, cls.color, 14, 2.6);
      if (Arcade.audio) Arcade.audio.play('match');
    }
    cdClass = info.cd;
    msg.textContent = hits
      ? T('gs.dungeon.skillHit').replace('{n}', total)
      : T('gs.dungeon.skillNoTarget');
    updateSkillUI();
  }

  function castDash() {
    var lx = px, ly = py;
    for (var i = 1; i <= 2; i++) {
      var nx = px + facing.x * i, ny = py + facing.y * i;
      if (!walkable(nx, ny)) break;
      if (grid[ny][nx] !== FLOOR) break;
      if (monsterAt(nx, ny)) break;
      lx = nx; ly = ny;
    }
    var c = cellCenter(px, py);
    for (var t = 0; t < 10; t++) {
      particles.push({
        x: c.x + (Math.random() - 0.5) * cw, y: c.y + (Math.random() - 0.5) * ch,
        vx: (Math.random() - 0.5) * 1.4, vy: (Math.random() - 0.5) * 1.4,
        life: 1, decay: 0.035, size: 1.6 + Math.random() * 2, color: '#00f0ff', grav: 0
      });
    }
    cdUni = SKILLS.dash.cd;
    if (lx !== px || ly !== py) {
      px = lx; py = ly; steps++;
      if (Arcade.juice) Arcade.juice.move();
      var c2 = cellCenter(px, py);
      spawnBurst(c2.x, c2.y, '#00f0ff', 16, 2.6);
      spawnRing(c2.x, c2.y, '#00f0ff', 2);
      var tr = trapAt(px, py);
      if (tr && !tr.used) {
        triggerTrap(tr);
        if (over) return;
      }
      var it = itemAt(px, py);
      if (it) pickupItem(it);
      computeFov();
    }
    if (Arcade.audio) Arcade.audio.play('back');
    msg.textContent = T('gs.dungeon.dashMsg');
    updateSkillUI();
  }

  /* ---------- 敌人 AI / Boss 技能 ---------- */
  function enemyTurn() {
    var list = monsters.slice();
    for (var i = 0; i < list.length; i++) {
      if (over) return;
      var m = list[i];
      if (monsters.indexOf(m) < 0) continue;
      var d = manhattan(m.x, m.y, px, py);
      if (m.boss) {
        m.awake = true;
        if (m.specialCd > 0) m.specialCd--;
        if (m.specialCd <= 0 && d <= 10 && lineClear(m.x, m.y, px, py)) {
          castBossSkill(m);
          if (over) return;
          continue;
        }
      }
      if (d === 1) {
        var dmg = damageTaken(m.atk);
        hurtPlayer(m.atk);
        if (over) return;
        msg.textContent = T('gs.dungeon.hurtMsg').replace('{n}', dmg);
        if (Arcade.audio) Arcade.audio.play('error');
        continue;
      }
      var sees = m.boss || d <= FOV + 2 || lineClear(m.x, m.y, px, py);
      if (!sees) continue;
      var sx = px > m.x ? 1 : (px < m.x ? -1 : 0);
      var sy = py > m.y ? 1 : (py < m.y ? -1 : 0);
      var moves = Math.abs(px - m.x) >= Math.abs(py - m.y) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
      for (var mv = 0; mv < moves.length; mv++) {
        var nx = m.x + moves[mv][0], ny = m.y + moves[mv][1];
        if (!walkable(nx, ny)) continue;
        if (nx === px && ny === py) continue;
        if (monsterAt(nx, ny)) continue;
        m.x = nx; m.y = ny;
        break;
      }
    }
    computeFov();
  }

  function castBossSkill(m) {
    var isFinal = m.kind === 'final';
    var raw, color;
    if (!isFinal) {
      raw = 4 + layer;
      color = '#b967ff';
      m.specialCd = 3;
    } else if (m.phase === 1) {
      raw = 5 + layer;
      color = '#ff2d95';
      m.specialCd = 3;
    } else {
      raw = 7 + layer;
      color = '#ff2d95';
      m.specialCd = 2;
      if (monsters.length < 10 && Math.random() < 0.7) summonMinion(m);
    }
    var bc = cellCenter(m.x, m.y);
    var pc = cellCenter(px, py);
    addBeam(bc.x, bc.y, pc.x, pc.y, color, isFinal ? 3.4 : 2.6);
    spawnBurst(bc.x, bc.y, color, 20, 3);
    spawnBurst(pc.x, pc.y, color, 16, 2.8);
    if (m.phase === 2) spawnRing(pc.x, pc.y, '#ffe600', 3);
    shakeT = 1;
    if (Arcade.fx) Arcade.fx.shake(stage);
    if (Arcade.audio) Arcade.audio.play('error');
    var dmg = damageTaken(raw);
    hurtPlayer(raw);
    if (over) return;
    msg.textContent = T('gs.dungeon.bossBeamMsg').replace('{n}', dmg);
  }

  function summonMinion(m) {
    var spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (var i = 0; i < spots.length; i++) {
      var nx = m.x + spots[i][0], ny = m.y + spots[i][1];
      if (!walkable(nx, ny)) continue;
      if (nx === px && ny === py) continue;
      if (monsterAt(nx, ny)) continue;
      var hpv = 7 + layer * 2;
      monsters.push({
        x: nx, y: ny, rx: nx, ry: ny, hp: hpv, maxHp: hpv,
        atk: 2 + Math.floor(layer * 0.6), boss: false, kind: null,
        phase: 1, specialCd: 0, hurt: 0, tint: 2, awake: true
      });
      var c = cellCenter(nx, ny);
      spawnBurst(c.x, c.y, '#ff2d95', 12, 2.4);
      msg.textContent = T('gs.dungeon.summonMsg');
      if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.summonMsg'), 'warn');
      return;
    }
  }

  /* ---------- 结算 ---------- */
  function showResult(isWin) {
    var isNew = false;
    if (Arcade.shell) isNew = Arcade.shell.submitScore(score);
    var best = 0;
    if (Arcade.storage) best = Arcade.storage.getBest('dungeon') || 0;
    ovTitle.textContent = isWin ? T('gs.dungeon.victoryTitle') : T('gs.dungeon.failTitle');
    ovTitle.className = 'dg-ov-title ' + (isWin ? 'win' : 'lose');
    var bodyKey = isWin ? 'gs.dungeon.victoryBody' : 'gs.dungeon.failBody';
    ovSub.innerHTML = T(bodyKey)
      .replace('{k}', kills).replace('{s}', score).replace('{l}', layer);
    ovStats.innerHTML = T('gs.dungeon.resultBest').replace('{b}', best) +
      (isNew ? ' · <b class="dg-newrec">' + T('gs.dungeon.newRecord') + '</b>' : '');
    startBtn.textContent = T('gs.dungeon.retryBtn');
    overlay.classList.remove('hidden');
    if (Arcade.audio) Arcade.audio.play(isWin ? 'record' : 'error');
    if (Arcade.fx) Arcade.fx.flash(isWin ? 'var(--neon-green)' : 'var(--neon-pink)');
    if (Arcade.fx) Arcade.fx.shake(stage);
  }

  function gameOver() {
    if (over) return;
    over = true; won = false; paused = false;
    autoPath = [];
    awaitEquip = false; pendingEquip = null; pendingFinishSlot = null;
    eqPrompt.classList.add('hidden');
    pauseOv.classList.add('hidden');
    msg.textContent = T('gs.dungeon.msgDie').replace('{n}', layer);
    if (Arcade.audio) Arcade.audio.play('error');
    writeSave();
    showResult(false);
    updateSkillUI();
  }

  function win() {
    if (over) return;
    over = true; won = true; paused = false;
    autoPath = [];
    awaitEquip = false; pendingEquip = null; pendingFinishSlot = null;
    eqPrompt.classList.add('hidden');
    pauseOv.classList.add('hidden');
    score += 100;
    updateHud(scoreEl);
    msg.textContent = T('gs.dungeon.finalWinMsg');
    var bc = cellCenter(px, py);
    spawnBurst(bc.x, bc.y, '#ffe600', 50, 4);
    spawnRing(bc.x, bc.y, '#39ff14', 5);
    if (Arcade.audio) Arcade.audio.play('win');
    writeSave();
    showResult(true);
    updateSkillUI();
  }

  /* ---------- 渲染 ---------- */
  function rr(x, y, w, h, r) {
    if (w < r * 2) r = w / 2;
    if (h < r * 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#04040a';
    ctx.fillRect(0, 0, W, H);

    var sh = Math.max(0, Math.min(1, shakeT));
    ctx.save();
    if (sh > 0) ctx.translate((Math.random() - 0.5) * sh * 4, (Math.random() - 0.5) * sh * 4);

    drawTiles();
    drawTorches();
    drawTrapsAndItems();
    drawFx(0);
    drawMonsters();
    drawPlayer();
    drawFx(1);
    drawVignette();
    drawBossBar();
    ctx.restore();

    if (hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,45,149,' + (hitFlash * 0.26) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (poison) {
      ctx.fillStyle = 'rgba(57,255,20,0.06)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawTiles() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!explored[y][x]) continue;
        var vis = visible[y][x];
        var px0 = x * cw, py0 = y * ch;
        if (grid[y][x] === WALL) {
          ctx.fillStyle = vis ? '#252536' : '#12121c';
          ctx.fillRect(px0, py0, cw, ch);
          ctx.strokeStyle = vis ? 'rgba(0,240,255,0.16)' : 'rgba(0,240,255,0.05)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px0 + 0.5, py0 + 0.5, cw - 1, ch - 1);
          if (vis) {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.moveTo(px0 + 2, py0 + ch - 3);
            ctx.lineTo(px0 + cw - 2, py0 + ch - 3);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = vis ? '#141420' : '#0a0a11';
          ctx.fillRect(px0, py0, cw, ch);
          if (vis) {
            ctx.strokeStyle = 'rgba(0,240,255,0.055)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px0 + 0.5, py0 + 0.5, cw - 1, ch - 1);
          }
          if (grid[y][x] === STAIR) {
            drawStairs(px0, py0, vis);
          }
        }
      }
    }
  }

  function drawStairs(x, y, vis) {
    var a = vis ? 1 : 0.4;
    ctx.globalAlpha = a;
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#39ff14' : '#0f2a12';
      ctx.fillRect(x + 3 + i, y + 3 + i * 3.4, cw - 6 - i * 2, 2.4);
    }
    ctx.globalAlpha = 1;
    if (vis) {
      ctx.fillStyle = 'rgba(57,255,20,0.18)';
      ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, 8, 0, 6.28); ctx.fill();
    }
  }

  function drawTorches() {
    for (var i = 0; i < torches.length; i++) {
      var t = torches[i];
      if (!explored[t.y] || !explored[t.y][t.x]) continue;
      var c = cellCenter(t.x, t.y);
      var vis = inFov(t.x, t.y);
      var fl = Math.sin(clock * 7 + t.phase) * 1.4;
      ctx.globalAlpha = vis ? 0.9 : 0.3;
      ctx.fillStyle = '#5a3a10';
      ctx.fillRect(c.x - 1, c.y + 2, 2, 6);
      ctx.fillStyle = vis ? '#ff9f1c' : '#3a2a10';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + fl, 3.2, 5 + fl, 0, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = vis ? 'rgba(255,230,0,0.5)' : 'rgba(255,200,80,0.1)';
      ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, 6.28); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawTrapsAndItems() {
    var i;
    for (i = 0; i < traps.length; i++) {
      var tr = traps[i];
      if (!explored[tr.y][tr.x]) continue;
      var vis = inFov(tr.x, tr.y);
      if (!vis && !tr.used) continue;
      var tc = cellCenter(tr.x, tr.y);
      ctx.globalAlpha = tr.used ? 0.35 : (vis ? 1 : 0.4);
      if (tr.type === 'spike') {
        ctx.fillStyle = tr.used ? '#4a3028' : '#ff6b3d';
        for (var s = 0; s < 3; s++) {
          ctx.beginPath();
          ctx.moveTo(tc.x - 6 + s * 6, tc.y + 6);
          ctx.lineTo(tc.x - 3 + s * 6, tc.y - 2);
          ctx.lineTo(tc.x + s * 6, tc.y + 6);
          ctx.closePath(); ctx.fill();
        }
      } else if (tr.type === 'poison') {
        ctx.fillStyle = tr.used ? 'rgba(57,255,20,0.15)' : 'rgba(57,255,20,0.5)';
        for (var b = 0; b < 3; b++) {
          var bx = tc.x - 6 + b * 6, by = tc.y + Math.sin(clock * 3 + b) * 2;
          ctx.beginPath(); ctx.arc(bx, by, 4.2, 0, 6.28); ctx.fill();
        }
      } else if (tr.type === 'teleport') {
        ctx.strokeStyle = tr.used ? 'rgba(185,103,255,0.25)' : '#b967ff';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(tc.x, tc.y, 6.5, 0, 6.28); ctx.stroke();
        ctx.beginPath(); ctx.arc(tc.x, tc.y, 2.6, 0, 6.28); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tc.x - 5, tc.y - 5); ctx.lineTo(tc.x + 5, tc.y + 5);
        ctx.moveTo(tc.x + 5, tc.y - 5); ctx.lineTo(tc.x - 5, tc.y + 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = tr.used ? '#4a2030' : '#ff2d95';
        for (var ar = 0; ar < 2; ar++) {
          var ax = tc.x - 5 + ar * 5;
          ctx.beginPath();
          ctx.moveTo(ax, tc.y - 5); ctx.lineTo(ax + 4, tc.y); ctx.lineTo(ax, tc.y + 5);
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (!inFov(it.x, it.y)) continue;
      var ic = cellCenter(it.x, it.y);
      var bob = Math.sin(clock * 3 + it.phase) * 1.6;
      ctx.save();
      ctx.translate(ic.x, ic.y + bob);
      if (it.type === 'potion') {
        ctx.fillStyle = '#39ff14';
        ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 7;
        rr(-3, -4, 6, 9, 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#b6ff9c';
        ctx.fillRect(-1.5, -6.5, 3, 2);
      } else if (it.type === 'coin') {
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 7;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.28); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#8a7a00'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 6.28); ctx.stroke();
      } else {
        var d = ITEMS[it.itemId];
        var col = d && d.slot === 'armor' ? '#9ad1ff' : d && d.slot === 'trinket' ? '#e2b6ff' : '#ffb86b';
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-2, -2, 4, 4);
      }
      ctx.restore();
    }
  }

  function drawMonsters() {
    for (var i = 0; i < monsters.length; i++) {
      var m = monsters[i];
      if (!inFov(m.x, m.y)) continue;
      var c = cellCenter(m.x, m.y);
      var bob = Math.sin(clock * 3.2 + i) * 1.2;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      var hurt = m.hurt > 0;
      if (m.boss) {
        drawBoss(m, hurt);
      } else {
        var col = ['#ff2d95', '#ff6b3d', '#b967ff'][m.tint % 3];
        ctx.fillStyle = hurt ? '#ffffff' : col;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, 1, 7.2, 6.2, 0, 0, 6.28); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = hurt ? '#ff2d95' : '#04040a';
        ctx.beginPath(); ctx.arc(-2.6, -1, 1.6, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(2.6, -1, 1.6, 0, 6.28); ctx.fill();
        ctx.strokeStyle = hurt ? '#04040a' : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 4, 3.2, 0.2, Math.PI - 0.2); ctx.stroke();
        if (m.hp < m.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(-8, -10, 16, 2.4);
          ctx.fillStyle = '#ff2d95';
          ctx.fillRect(-8, -10, 16 * Math.max(0, m.hp / m.maxHp), 2.4);
        }
      }
      ctx.restore();
    }
  }

  function drawBoss(m, hurt) {
    var isFinal = m.kind === 'final';
    var col = isFinal ? (m.phase === 2 ? '#ffe600' : '#ff2d95') : '#b967ff';
    var r = isFinal ? 11 : 9;
    ctx.fillStyle = hurt ? '#ffffff' : col;
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(-r, 5);
    ctx.lineTo(-r * 0.7, -r * 0.2);
    ctx.lineTo(-r * 0.35, -r);
    ctx.lineTo(0, -r * 0.6);
    ctx.lineTo(r * 0.35, -r);
    ctx.lineTo(r * 0.7, -r * 0.2);
    ctx.lineTo(r, 5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = hurt ? '#ff2d95' : '#04040a';
    ctx.beginPath(); ctx.arc(-3.4, -1.5, 1.8, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(3.4, -1.5, 1.8, 0, 6.28); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 3, 5.4, 0.15, Math.PI - 0.15); ctx.stroke();
    if (m.phase === 2) {
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r + 4 + Math.sin(clock * 5) * 1.5, 0, 6.28); ctx.stroke();
    }
  }

  function drawPlayer() {
    var cls = CLASSES[classId];
    var ix = (prx + (px - prx) * 0.28 + 0.5) * cw;
    var iy = (pry + (py - pry) * 0.28 + 0.5) * ch;
    var bob = Math.sin(clock * 4) * 1.2;
    ctx.save();
    ctx.translate(ix, iy + bob);
    ctx.globalAlpha = 0.18 + Math.sin(clock * 3) * 0.04;
    ctx.fillStyle = cls.color;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = cls.color; ctx.shadowBlur = 10;
    ctx.fillStyle = hitFlash > 0.4 ? '#ffffff' : cls.color;
    if (classId === 'warrior') {
      rr(-6, -6.5, 12, 12, 3); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#4a2a00';
      ctx.fillRect(-4, -3, 8, 2);
      ctx.fillStyle = cls.glow;
      ctx.beginPath(); ctx.arc(-6, 1, 4.4, 1.7, 4.5); ctx.fill();
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(5, 2); ctx.lineTo(10 + facing.x, 2 + facing.y * 4); ctx.stroke();
    } else if (classId === 'mage') {
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(7.5, 4); ctx.lineTo(-7.5, 4); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = cls.glow;
      ctx.beginPath(); ctx.arc(0, -2, 2.2, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#e2b6ff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(8, 2, 3.4, 0, 6.28); ctx.stroke();
      ctx.fillStyle = cls.glow;
      ctx.beginPath(); ctx.arc(8, 2, 1.5, 0, 6.28); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, -1, 6.6, Math.PI, 0); ctx.fill();
      ctx.fillRect(-6.6, -1, 13.2, 7);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#123a10';
      ctx.fillRect(-5, 0, 10, 2);
      ctx.strokeStyle = '#b6ff9c'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(7, 1, 5.4, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(5, 1); ctx.lineTo(12, 1); ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawFx(layer) {
    var i;
    if (layer === 0) {
      /* 后景层：移动扬尘 / 地面碎屑，压在单位之下 */
      for (i = 0; i < particles.length; i++) {
        var up = particles[i];
        if ((up.z || 1) !== 0) continue;
        ctx.globalAlpha = Math.max(0, up.life) * 0.7;
        ctx.fillStyle = up.color;
        ctx.fillRect(up.x - up.size / 2, up.y - up.size / 2, up.size, up.size);
      }
      ctx.globalAlpha = 1;
      return;
    }
    for (i = 0; i < beams.length; i++) {
      var b = beams[i];
      var a = Math.max(0, b.life);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = a * 0.7;
      ctx.lineWidth = b.width * a;
      ctx.shadowColor = b.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, b.width * 0.35);
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    for (i = 0; i < rings.length; i++) {
      var rg = rings[i];
      ctx.strokeStyle = rg.color;
      ctx.globalAlpha = Math.max(0, rg.life) * 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, 6.28); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < slashes.length; i++) {
      var sl = slashes[i];
      var life = Math.max(0, sl.life);
      ctx.strokeStyle = sl.color;
      ctx.globalAlpha = life;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(sl.x, sl.y, 9 - life * 5, sl.ang - 0.9, sl.ang + 0.9);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      if ((p.z || 1) === 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < texts.length; i++) {
      var tx = texts[i];
      var pr = 1 - tx.life;
      var pop = 0.72 + 0.28 * GK.easeOutBack(Math.min(1, pr * 2.4));
      ctx.globalAlpha = Math.min(1, Math.max(0, tx.life) * 1.6);
      ctx.fillStyle = tx.color;
      ctx.font = 'bold 7px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(tx.x, tx.y);
      ctx.scale(pop, pop);
      ctx.fillText(tx.str, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    if (!vig) {
      vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.72)');
    }
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBossBar() {
    var b = bossRef();
    if (!b) return;
    if (!b.awake && !inFov(b.x, b.y) && !explored[b.y][b.x]) return;
    var w = 300, h = 11, x = (W - w) / 2, y = 3;
    ctx.fillStyle = 'rgba(4,4,10,0.82)';
    rr(x, y, w, h, 3); ctx.fill();
    var ratio = Math.max(0, b.hp / b.maxHp);
    var col = b.kind === 'final' ? (b.phase === 2 ? '#ffe600' : '#ff2d95') : '#b967ff';
    ctx.fillStyle = col;
    rr(x + 1, y + 1, (w - 2) * ratio, h - 2, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    rr(x + 0.5, y + 0.5, w - 1, h - 1, 3); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.textAlign = 'left';
    var nm = b.kind === 'final' ? T('gs.dungeon.boss.final') : T('gs.dungeon.boss.mid');
    var phase = b.kind === 'final' ? ' · ' + (b.phase === 2 ? T('gs.dungeon.bossPhase2') : T('gs.dungeon.bossPhase1')) : '';
    ctx.fillText(T('gs.dungeon.bossLabel') + '  ' + nm + phase, x + 4, y + h + 9);
    ctx.textAlign = 'right';
    ctx.fillText(b.hp + ' / ' + b.maxHp, x + w - 4, y + h + 9);
    ctx.textAlign = 'left';
  }

  /* ---------- 更新循环 ---------- */
  var shakeT = 0;

  function update(dt) {
    if (!started) return;
    var k = Math.min(3, dt / 16.67);
    clock += dt / 1000;
    prx += (px - prx) * Math.min(1, 0.2 * k);
    pry += (py - pry) * Math.min(1, 0.2 * k);
    for (var i = 0; i < monsters.length; i++) {
      var m = monsters[i];
      m.rx += (m.x - m.rx) * Math.min(1, 0.22 * k);
      m.ry += (m.y - m.ry) * Math.min(1, 0.22 * k);
      if (m.hurt > 0) m.hurt -= 0.08 * k;
    }
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * k; p.y += p.vy * k; p.vy += p.grav * k;
      p.vx *= 0.985; p.life -= p.decay * k;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (i = rings.length - 1; i >= 0; i--) {
      var rg = rings[i];
      rg.r += rg.grow * k; rg.life -= 0.045 * k;
      if (rg.life <= 0) rings.splice(i, 1);
    }
    for (i = beams.length - 1; i >= 0; i--) {
      beams[i].life -= 0.055 * k;
      if (beams[i].life <= 0) beams.splice(i, 1);
    }
    for (i = slashes.length - 1; i >= 0; i--) {
      slashes[i].life -= 0.06 * k;
      if (slashes[i].life <= 0) slashes.splice(i, 1);
    }
    for (i = texts.length - 1; i >= 0; i--) {
      var tx = texts[i];
      tx.y += tx.vy * k * (0.35 + 0.65 * tx.life); tx.life -= 0.034 * k;
      if (tx.life <= 0) texts.splice(i, 1);
    }
    if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - 0.055 * k);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - 0.07 * k);

    if (autoPath.length && canAct() && Date.now() - lastAct >= ACT_GAP) {
      var step = autoPath.shift();
      tryMove(step.dx, step.dy, true);
    }
  }

  var lastFrame = 0;
  function frame(ts) {
    if (!lastFrame) lastFrame = ts;
    var dt = Math.min(48, ts - lastFrame);
    lastFrame = ts;
    if (started) {
      update(dt);
      render();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  function togglePause(force) {
    if (!started || over || menuOpen || awaitEquip) return;
    var next = typeof force === 'boolean' ? force : !paused;
    if (next === paused) return;
    paused = next;
    if (paused) {
      autoPath = [];
      pauseOv.classList.remove('hidden');
      msg.textContent = T('gs.dungeon.pauseTitle');
      writeSave();
    } else {
      pauseOv.classList.add('hidden');
      msg.textContent = T('gs.dungeon.clickHint');
      lastAct = Date.now();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
    updateSkillUI();
  }

  var DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };

  Arcade.input.onKeys({
    up: function () { tryMove(0, -1, false); },
    down: function () { tryMove(0, 1, false); },
    left: function () { tryMove(-1, 0, false); },
    right: function () { tryMove(1, 0, false); },
    action: function () { togglePause(); }
  });

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.code === 'KeyQ') { useSkill('class'); e.preventDefault(); }
    else if (e.code === 'KeyE') { useSkill('uni'); e.preventDefault(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); }
  });

  var lastSwipeAt = 0;
  Arcade.input.onSwipe(canvas, function (dir) {
    lastSwipeAt = Date.now();
    var d = DIRS[dir];
    if (d) tryMove(d.x, d.y, false);
  });

  function findPath(tx, ty) {
    if (!walkable(tx, ty)) return null;
    var targetIsMonster = !!monsterAt(tx, ty);
    var seen = [], prev = [];
    for (var y = 0; y < ROWS; y++) {
      var sr = [], pr = [];
      for (var x = 0; x < COLS; x++) { sr.push(false); pr.push(null); }
      seen.push(sr); prev.push(pr);
    }
    var q = [[px, py]];
    seen[py][px] = true;
    var dest = null;
    while (q.length) {
      var cur = q.shift();
      var isGoal = targetIsMonster
        ? (manhattan(cur[0], cur[1], tx, ty) === 1)
        : (cur[0] === tx && cur[1] === ty);
      if (isGoal) { dest = cur; break; }
      var order = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var oi = 0; oi < 4; oi++) {
        var nx = cur[0] + order[oi][0], ny = cur[1] + order[oi][1];
        if (!walkable(nx, ny) || seen[ny][nx]) continue;
        if (monsterAt(nx, ny)) continue;
        seen[ny][nx] = true;
        prev[ny][nx] = cur;
        q.push([nx, ny]);
      }
    }
    if (!dest) return null;
    var path = [];
    var cx = dest[0], cy = dest[1];
    var guard = 0;
    while ((cx !== px || cy !== py) && guard < 120) {
      guard++;
      var pp = prev[cy][cx];
      if (!pp) break;
      path.push({ dx: cx - pp[0], dy: cy - pp[1] });
      cx = pp[0]; cy = pp[1];
    }
    path.reverse();
    return path.length ? path : null;
  }

  canvas.addEventListener('click', function (e) {
    if (!canAct()) return;
    if (Date.now() - lastSwipeAt < 280) return;
    var p = GK.pointer(canvas, e);
    var tx = Math.floor(p.x / cw), ty = Math.floor(p.y / ch);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
    if (tx === px && ty === py) return;
    if (manhattan(tx, ty, px, py) === 1) {
      tryMove(tx - px, ty - py, false);
      return;
    }
    var path = findPath(tx, ty);
    if (path) {
      autoPath = path;
      lastAct = Date.now() - ACT_GAP;
    } else {
      autoPath = [];
    }
  });

  if (Arcade.input && (Arcade.input.isTouch() || true)) {
    Arcade.input.createDPad(dpadHolder, function (dir, pressed) {
      if (!pressed) return;
      var d = DIRS[dir];
      if (!d) return;
      tryMove(d.x, d.y, false);
    });
  }

  /* ---------- 按钮 ---------- */
  beginBtn.addEventListener('click', function () { startGame(classId); });
  continueBtn.addEventListener('click', function () {
    var ok = Arcade.savegame && Arcade.savegame.resume();
    if (!ok) showMenu();
  });
  startBtn.addEventListener('click', function () { startGame(classId); });
  changeBtn.addEventListener('click', function () { showMenu(); });
  pauseBtn.addEventListener('click', function () { togglePause(true); });
  resumeBtn.addEventListener('click', function () { togglePause(false); });
  saveExitBtn.addEventListener('click', function () {
    writeSave();
    if (Arcade.ui) Arcade.ui.toast(T('gs.dungeon.savedOk'), 'ok');
    location.href = '../../index.html';
  });
  eqpTake.addEventListener('click', function () { resolveEquip(true); });
  eqpDrop.addEventListener('click', function () { resolveEquip(false); });
  skillQ.addEventListener('click', function () { useSkill('class'); });
  skillE.addEventListener('click', function () { useSkill('uni'); });

  window.addEventListener('resize', function () { fitCanvas(); });

  /* ---------- QA 钩子（仅 ?qa=1） ---------- */
  function gridToString(g) {
    var out = [];
    for (var y = 0; y < ROWS; y++) {
      var s = '';
      for (var x = 0; x < COLS; x++) s += g[y] && g[y][x] ? '1' : '0';
      out.push(s);
    }
    return out;
  }
  function qaState() {
    var rect = canvas.getBoundingClientRect();
    return {
      started: started, over: over, won: won, paused: paused, menuOpen: menuOpen,
      awaitEquip: awaitEquip, layer: layer, classId: classId, hp: hp, maxHp: maxHp,
      atk: atk, def: def, skillPower: skillPower, score: score, kills: kills, steps: steps,
      player: { x: px, y: py }, facing: { x: facing.x, y: facing.y },
      equip: { weapon: equip.weapon, armor: equip.armor, trinket: equip.trinket },
      cdClass: cdClass, cdUni: cdUni, universalUnlocked: universalUnlocked,
      poison: poison ? { turns: poison.turns, dmg: poison.dmg } : null,
      monsters: monsters.map(function (m) {
        return { x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, atk: m.atk, boss: !!m.boss, kind: m.kind, phase: m.phase, specialCd: m.specialCd, awake: !!m.awake };
      }),
      traps: traps.map(function (t) {
        return { x: t.x, y: t.y, type: t.type, used: !!t.used };
      }),
      items: items.map(function (it) {
        return { x: it.x, y: it.y, type: it.type, itemId: it.itemId };
      }),
      stairs: (function () {
        for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) if (grid[y][x] === STAIR) return { x: x, y: y };
        return null;
      })(),
      equipStats: { atk: atk, def: def, maxHp: maxHp, skillPower: skillPower },
      grid: gridToString(grid), visible: gridToString(visible), explored: gridToString(explored),
      hasSave: !!readSaveRaw(),
      canvas: {
        width: canvas.width, height: canvas.height,
        cssWidth: rect.width, cssHeight: rect.height,
        dpr: window.devicePixelRatio || 1, clampDpr: Math.min(window.devicePixelRatio || 1, 2)
      }
    };
  }
  if (/(?:^|[?&])qa=1(?:&|$)/.test(location.search)) {
    window.__qa = {
      state: qaState,
      forceWin: function () {
        if (!started) startGame(classId);
        if (over) return false;
        win();
        return true;
      },
      forceLose: function () {
        if (!started) startGame(classId);
        if (over) return false;
        hp = 0; updateHud(hpEl); gameOver();
        return true;
      },
      teleport: function (col, row) {
        if (!started || !walkable(col, row)) return false;
        px = col; py = row; prx = px; pry = py;
        computeFov(); updateHud(); return true;
      },
      particlesAt: function (col, row) {
        var c = cellCenter(col, row);
        spawnBurst(c.x, c.y, '#00f0ff', 18, 0.8);
        return { x: c.x, y: c.y, client: GK.toClient(canvas, c.x, c.y) };
      },
      cellCenter: function (col, row) {
        return GK.toClient(canvas, (col + 0.5) * cw, (row + 0.5) * ch);
      },
      skill: function (slot) { useSkill(slot || 'class'); },
      startClass: function (id) { startGame(CLASSES[id] ? id : 'warrior'); return qaState(); },
      grantItem: function (id) {
        if (!started) startGame(classId);
        if (!ITEMS[id]) return false;
        var it = { x: px, y: py, type: 'equip', itemId: id, phase: 0 };
        items.push(it);
        pickupItem(it);
        if (awaitEquip) resolveEquip(true);
        updateHud(hpEl); updateEquipUI(); updateSkillUI();
        return qaState();
      },
      floor: function (n) {
        if (!started) startGame(classId);
        n = Math.max(1, Math.min(MAX_LAYER, Math.floor(n) || 1));
        if (n > layer) score += (n - layer) * 25;
        layer = n;
        if (layer >= 2) universalUnlocked = true;
        poison = null; autoPath = [];
        levelSeed = levelSeedFor(runSeed, layer);
        seedRng(levelSeed);
        genLevel();
        computeFov();
        updateHud(); updateSkillUI(); updateEquipUI();
        writeSave();
        return qaState();
      },
      hitBoss: function (dmg) {
        var b = bossRef();
        if (!b) return false;
        hitMonster(b, Math.max(1, Math.floor(dmg) || 1), '#00f0ff');
        updateHud(scoreEl); updateSkillUI(); updateEquipUI();
        return true;
      }
    };
  }

  /* ---------- 启动 ---------- */
  showMenu();
  fitCanvas();
  requestAnimationFrame(frame);
})();
