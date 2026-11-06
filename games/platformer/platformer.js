/* ============================================================
   平台跳跃 Platformer —— 霓虹旗舰版
   2 个世界 × 4 关：霓虹回廊 / 熔岩天穹
   检查点复活 · 墙跳 · 冲刺 · 首领战 · 完整闭环
   计分：金币 +20、踩怪 +50、首领弱点 +100、击破 +500、时间奖励
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.platformer.tut1t'), d: T('gs.platformer.tut1') },
  { t: T('gs.platformer.tut2t'), d: T('gs.platformer.tut2') },
  { t: T('gs.platformer.tut3t'), d: T('gs.platformer.tut3') },
  { t: T('gs.platformer.tut4t'), d: T('gs.platformer.tut4') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  var W = 800, H = 360;
  var GRAV = 0.55, JUMP = -12.2, SPEED = 4.2;
  var GROUND_TOP = H - 40;
  var DASH_SPD = 14, DASH_TIME = 0.22, DASH_CD = 0.85;
  var STEP = 0.016;

  /* ---------- 关卡数据（纯字面量，便于静态校验） ---------- */
  var PACKS = [
    {
      id: 'neon', theme: 'neon', accent: '#00f0ff', accent2: '#b967ff',
      nameKey: 'gs.platformer.pack1', descKey: 'gs.platformer.pack1Desc',
      levels: [
        {
          key: 'p1l1', nameKey: 'gs.platformer.p1l1', diff: 1, w: 2200,
          spawn: { x: 46, y: 282 },
          ground: [[0, 420], [580, 1020], [1200, 1660], [1840, 2200]],
          floats: [[250, 240, 110], [760, 236, 112], [960, 180, 100], [1250, 244, 120], [1450, 184, 100], [1900, 238, 110], [2070, 180, 100]],
          movers: [{ x: 1060, y: 250, w: 100, rx: 0, ry: 52, sp: 1.0, ph: 0 }],
          walls: [[820, 205, 22, 115]],
          spikes: [[360, 44], [700, 48], [1320, 44], [1980, 48], [2110, 44]],
          enemies: [[620, 590, 760], [1290, 1220, 1480], [1900, 1860, 2120]],
          coins: [
            [200, 292], [300, 290], [360, 292],
            [260, 208], [300, 202], [340, 208],
            [770, 204], [810, 198], [850, 204],
            [965, 148], [1005, 142], [1045, 148],
            [1110, 214], [1110, 250],
            [1260, 212], [1300, 206], [1340, 212],
            [1460, 152], [1500, 146], [1540, 152],
            [1910, 206], [1950, 200], [1990, 206],
            [2080, 148], [2120, 142], [2160, 148], [1220, 292]
          ],
          checkpoint: { x: 1220, y: 268 }
        },
        {
          key: 'p1l2', nameKey: 'gs.platformer.p1l2', diff: 2, w: 2600,
          spawn: { x: 46, y: 282 },
          ground: [[0, 380], [560, 900], [1080, 1420], [1600, 1960], [2140, 2600]],
          floats: [[240, 232, 100], [650, 240, 110], [880, 180, 96], [1150, 244, 116], [1360, 186, 98], [1660, 240, 110], [1870, 176, 96], [2200, 238, 110], [2400, 180, 100]],
          movers: [
            { x: 940, y: 246, w: 100, rx: 70, ry: 0, sp: 0.9, ph: 0.4 },
            { x: 1980, y: 230, w: 100, rx: 0, ry: 54, sp: 1.1, ph: 1.5 }
          ],
          walls: [[900, 200, 22, 120], [1960, 195, 22, 125]],
          spikes: [[320, 44], [820, 44], [1130, 44], [1900, 48], [2450, 42]],
          enemies: [[620, 580, 820], [1120, 1100, 1350], [1700, 1650, 1900], [2250, 2200, 2500]],
          coins: [
            [150, 292], [300, 290], [480, 290],
            [250, 200], [290, 194], [330, 200],
            [660, 208], [700, 202], [740, 208],
            [885, 148], [925, 142], [965, 148],
            [1160, 212], [1200, 206], [1240, 212],
            [1340, 290],
            [1370, 154], [1410, 148], [1450, 154],
            [1675, 208], [1715, 202], [1755, 208],
            [1880, 144], [1920, 138], [1960, 144],
            [2210, 206], [2250, 200], [2290, 206],
            [2410, 148], [2450, 142], [2490, 148]
          ],
          checkpoint: { x: 1330, y: 268 }
        },
        {
          key: 'p1l3', nameKey: 'gs.platformer.p1l3', diff: 3, w: 3000,
          spawn: { x: 46, y: 282 },
          ground: [[0, 380], [550, 900], [1070, 1440], [1600, 1980], [2160, 2520], [2700, 3000]],
          floats: [[260, 230, 100], [690, 238, 110], [900, 178, 94], [1160, 242, 112], [1370, 182, 96], [1680, 238, 110], [1890, 174, 96], [2240, 236, 110], [2450, 178, 96], [2790, 230, 110], [2900, 170, 90]],
          movers: [
            { x: 1000, y: 250, w: 100, rx: 0, ry: 56, sp: 1.0, ph: 0.2 },
            { x: 2020, y: 240, w: 100, rx: 54, ry: 0, sp: 1.0, ph: 1.1 },
            { x: 2580, y: 248, w: 100, rx: 0, ry: 48, sp: 0.8, ph: 2.0 }
          ],
          walls: [[900, 205, 22, 115], [1980, 200, 22, 120], [2520, 205, 22, 115]],
          spikes: [[330, 46], [780, 44], [1300, 48], [1800, 44], [2300, 46], [2850, 42]],
          enemies: [[600, 560, 760], [1150, 1120, 1350], [1700, 1660, 1900], [2250, 2200, 2460], [2760, 2720, 2960]],
          coins: [
            [150, 292], [300, 290], [480, 290],
            [270, 198], [310, 192], [350, 198],
            [700, 206], [740, 200], [780, 206],
            [905, 146], [945, 140], [985, 146],
            [1170, 210], [1210, 204], [1250, 210],
            [1380, 150], [1420, 144], [1460, 150],
            [1640, 292],
            [1690, 206], [1730, 200], [1770, 206],
            [1900, 142], [1940, 136], [1980, 142],
            [2250, 204], [2290, 198], [2330, 204],
            [2460, 146], [2500, 140], [2540, 146],
            [2800, 198], [2840, 192], [2880, 198],
            [2930, 138], [2960, 132]
          ],
          checkpoint: { x: 1630, y: 268 }
        },
        {
          key: 'p1l4', nameKey: 'gs.platformer.p1l4', diff: 4, w: 2600,
          spawn: { x: 46, y: 282 },
          ground: [[0, 360], [520, 840], [1020, 1360], [1540, 1860], [1940, 2600]],
          floats: [[260, 236, 100], [660, 240, 110], [880, 180, 96], [1200, 244, 112], [1420, 186, 98], [1620, 240, 110], [1780, 176, 96], [2020, 220, 110], [2240, 190, 100], [2380, 150, 96]],
          movers: [
            { x: 960, y: 248, w: 100, rx: 60, ry: 0, sp: 1.0, ph: 0.5 },
            { x: 1410, y: 244, w: 100, rx: 0, ry: 52, sp: 1.1, ph: 1.3 }
          ],
          walls: [[840, 205, 22, 115], [1860, 200, 22, 120]],
          spikes: [[300, 44], [740, 44], [1260, 48], [1640, 44], [1810, 40]],
          enemies: [[640, 600, 800], [1200, 1180, 1330], [1620, 1560, 1800]],
          coins: [
            [150, 292], [300, 290], [470, 290],
            [270, 204], [310, 198], [350, 204],
            [670, 208], [710, 202], [750, 208],
            [890, 148], [930, 142], [970, 148],
            [1210, 212], [1250, 206], [1290, 212],
            [1430, 154], [1470, 148], [1510, 154],
            [1630, 208], [1670, 202], [1710, 208],
            [1790, 144], [1830, 138], [1870, 144],
            [2030, 188], [2070, 182], [2110, 188],
            [2250, 158], [2290, 152], [2330, 158],
            [2390, 118], [2430, 112], [2470, 118],
            [1590, 292]
          ],
          checkpoint: { x: 1580, y: 268 },
          boss: { x: 2280, y: 250, w: 84, h: 70, hp: 8, arenaX: 2020, nameKey: 'gs.platformer.boss1' }
        }
      ]
    },
    {
      id: 'lava', theme: 'lava', accent: '#ff9f1c', accent2: '#ff2d95',
      nameKey: 'gs.platformer.pack2', descKey: 'gs.platformer.pack2Desc',
      levels: [
        {
          key: 'p2l1', nameKey: 'gs.platformer.p2l1', diff: 1, w: 2400,
          spawn: { x: 46, y: 282 },
          ground: [[0, 400], [580, 960], [1140, 1500], [1680, 2040], [2220, 2400]],
          floats: [[260, 232, 100], [680, 240, 110], [900, 180, 94], [1180, 244, 112], [1400, 184, 96], [1720, 240, 110], [1920, 176, 96], [2260, 230, 100]],
          movers: [
            { x: 1000, y: 248, w: 100, rx: 60, ry: 0, sp: 0.9, ph: 0.3 },
            { x: 2080, y: 242, w: 100, rx: 0, ry: 50, sp: 1.1, ph: 1.7 }
          ],
          walls: [[960, 205, 22, 115], [2040, 200, 22, 120]],
          spikes: [[350, 44], [800, 46], [1320, 44], [1960, 46], [2280, 42]],
          enemies: [[620, 600, 780], [1200, 1180, 1380], [1760, 1700, 1900], [2260, 2220, 2360]],
          coins: [
            [150, 292], [300, 290], [380, 292],
            [270, 200], [310, 194], [350, 200],
            [690, 208], [730, 202], [770, 208],
            [910, 148], [950, 142], [990, 148],
            [1190, 212], [1230, 206], [1270, 212],
            [1410, 152], [1450, 146], [1490, 152],
            [1730, 208], [1770, 202], [1810, 208],
            [1930, 144], [1970, 138], [2010, 144],
            [2270, 198], [2310, 192], [2350, 198]
          ],
          checkpoint: { x: 1200, y: 268 }
        },
        {
          key: 'p2l2', nameKey: 'gs.platformer.p2l2', diff: 2, w: 2800,
          spawn: { x: 46, y: 282 },
          ground: [[0, 360], [540, 880], [1060, 1400], [1580, 1920], [2100, 2440], [2620, 2800]],
          floats: [[240, 230, 100], [620, 238, 110], [860, 178, 94], [1120, 242, 112], [1340, 182, 96], [1640, 238, 110], [1860, 174, 96], [2160, 236, 110], [2380, 178, 96], [2680, 226, 100]],
          movers: [
            { x: 920, y: 248, w: 100, rx: 0, ry: 52, sp: 1.0, ph: 0.2 },
            { x: 2480, y: 240, w: 100, rx: 52, ry: 0, sp: 1.0, ph: 1.5 }
          ],
          walls: [[880, 205, 22, 115], [1920, 200, 22, 120], [2440, 205, 22, 115]],
          spikes: [[300, 44], [780, 46], [1280, 44], [1840, 46], [2320, 44], [2740, 42]],
          enemies: [[600, 560, 760], [1180, 1120, 1360], [1680, 1640, 1880], [2200, 2140, 2400], [2680, 2640, 2760]],
          coins: [
            [150, 292], [300, 290], [460, 290], [520, 292],
            [250, 198], [290, 192], [330, 198],
            [630, 206], [670, 200], [710, 206],
            [870, 146], [910, 140], [950, 146],
            [1130, 210], [1170, 204], [1210, 210],
            [1350, 150], [1390, 144], [1430, 150],
            [1600, 292],
            [1650, 206], [1690, 200], [1730, 206],
            [1870, 142], [1910, 136], [1950, 142],
            [2170, 204], [2210, 198], [2250, 204],
            [2390, 146], [2430, 140], [2470, 146],
            [2690, 194], [2730, 188], [2770, 194]
          ],
          checkpoint: { x: 1600, y: 268 }
        },
        {
          key: 'p2l3', nameKey: 'gs.platformer.p2l3', diff: 3, w: 3200,
          spawn: { x: 46, y: 282 },
          ground: [[0, 360], [540, 900], [1080, 1400], [1580, 1940], [2120, 2480], [2660, 2960], [3040, 3200]],
          floats: [[240, 230, 100], [620, 236, 110], [860, 176, 94], [1140, 242, 112], [1360, 182, 96], [1640, 236, 110], [1860, 174, 96], [2180, 236, 110], [2400, 178, 96], [2700, 234, 100], [2880, 172, 92], [3080, 224, 90]],
          movers: [
            { x: 980, y: 246, w: 100, rx: 52, ry: 0, sp: 0.9, ph: 0.4 },
            { x: 1980, y: 242, w: 100, rx: 0, ry: 52, sp: 1.1, ph: 1.2 },
            { x: 2540, y: 244, w: 100, rx: 0, ry: 48, sp: 1.0, ph: 2.3 }
          ],
          walls: [[900, 205, 22, 115], [1940, 200, 22, 120], [2480, 205, 22, 115], [2960, 200, 22, 120]],
          spikes: [[300, 44], [820, 46], [1300, 44], [1860, 46], [2380, 44], [2820, 42], [3120, 40]],
          enemies: [[600, 560, 760], [1180, 1120, 1360], [1700, 1640, 1900], [2260, 2200, 2440], [2760, 2700, 2920]],
          coins: [
            [150, 292], [300, 290], [480, 290], [1620, 292],
            [250, 198], [290, 192], [330, 198],
            [630, 204], [670, 198], [710, 204],
            [870, 144], [910, 138], [950, 144],
            [1150, 210], [1190, 204], [1230, 210],
            [1370, 150], [1410, 144], [1450, 150],
            [1650, 204], [1690, 198], [1730, 204],
            [1870, 142], [1910, 136], [1950, 142],
            [2190, 204], [2230, 198], [2270, 204],
            [2410, 146], [2450, 140], [2490, 146],
            [2710, 202], [2750, 196], [2790, 202],
            [2890, 140], [2930, 134], [2970, 140],
            [3090, 192], [3130, 186], [3170, 192]
          ],
          checkpoint: { x: 1620, y: 268 }
        },
        {
          key: 'p2l4', nameKey: 'gs.platformer.p2l4', diff: 4, w: 2800,
          spawn: { x: 46, y: 282 },
          ground: [[0, 340], [540, 920], [1080, 1400], [1480, 1800], [1900, 2800]],
          floats: [[240, 230, 100], [620, 236, 110], [840, 176, 94], [1160, 242, 112], [1440, 182, 96], [1560, 236, 110], [1740, 174, 96], [1980, 220, 110], [2200, 188, 100], [2380, 150, 96]],
          movers: [
            { x: 380, y: 244, w: 100, rx: 40, ry: 0, sp: 1.0, ph: 0 },
            { x: 900, y: 246, w: 100, rx: 52, ry: 0, sp: 1.0, ph: 0.3 },
            { x: 1240, y: 246, w: 100, rx: 0, ry: 54, sp: 1.1, ph: 1.5 }
          ],
          walls: [[860, 205, 22, 115], [1400, 200, 22, 120], [1800, 205, 22, 115]],
          spikes: [[280, 44], [780, 46], [1260, 44], [1740, 46]],
          enemies: [[600, 560, 760], [1180, 1120, 1340], [1600, 1560, 1760]],
          coins: [
            [150, 292], [300, 290], [460, 290], [1610, 292],
            [250, 198], [290, 192], [330, 198],
            [630, 204], [670, 198], [710, 204],
            [850, 144], [890, 138], [930, 144],
            [1170, 210], [1210, 204], [1250, 210],
            [1450, 150], [1490, 144], [1530, 150],
            [1570, 204], [1610, 198], [1650, 204],
            [1750, 142], [1790, 136], [1830, 142],
            [1990, 188], [2030, 182], [2070, 188],
            [2210, 156], [2250, 150], [2290, 156],
            [2390, 118], [2430, 112], [2470, 118]
          ],
          checkpoint: { x: 1610, y: 268 },
          boss: { x: 2380, y: 250, w: 88, h: 70, hp: 10, arenaX: 2080, nameKey: 'gs.platformer.boss2' }
        }
      ]
    }
  ];

  /* ---------- 状态 ---------- */
  var LEVELS = [];
  PACKS.forEach(function (pk) {
    pk.levels.forEach(function (lv) { LEVELS.push(lv); });
  });
  var state = 'menu';
  var packIndex = 0, levelIndex = 0;
  var runStartPack = 0, runStartStage = 0;
  var selPack = 0, selStage = 0;
  var lives = 3, score = 0, level = null;
  var player, cam, particles, afterImages, floats, keys = { left: false, right: false, jump: false };
  var jumpBuffer = 0, invuln = 0;
  var dashTimer = 0, dashCd = 0, dashDir = 1, dashFlash = 0;
  var wallDir = 0, wallJumpLock = 0, wallJumpVx = 0, wallSlide = false;
  var levelStart = 0, pausedAt = 0, elapsed = 0;
  var shake = 0, loopApi = null;
  var deathAt = 0, msgUntil = 0;
  var lastTapDir = 0, lastTapAt = 0;
  var overlayMainFn = null;
  var animT = 0;

  function t(key) { return T(key); }
  function fmt(key, obj) {
    var s = t(key);
    for (var k in obj) if (obj.hasOwnProperty(k)) s = s.replace('{' + k + '}', obj[k]);
    return s;
  }
  function esc(s) { return Arcade.escapeHtml ? Arcade.escapeHtml(s) : String(s); }
  function pack() { return PACKS[packIndex]; }

  /* ---------- DOM ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'pf-wrap';
  wrap.innerHTML =
    '<div class="pf-hud">' +
    '  <span id="pf-world"><b>--</b></span>' +
    '  <span>' + esc(t('gs.platformer.hudCoins')) + ' <b id="pf-coins">0/0</b></span>' +
    '  <span>' + esc(t('gs.platformer.hudScore')) + ' <b id="pf-score">0</b></span>' +
    '  <span id="pf-lives">--</span>' +
    '  <span id="pf-dash">--</span>' +
    '  <span id="pf-time">0.0s</span>' +
    '</div>' +
    '<div class="pf-stage">' +
    '  <canvas class="pf-canvas" id="pf-canvas"></canvas>' +
    '  <div class="pf-overlay" id="pf-overlay">' +
    '    <div class="pf-ov-title" id="pf-ov-title"></div>' +
    '    <div class="pf-ov-sub" id="pf-ov-sub"></div>' +
    '    <div class="pf-ov-stats" id="pf-ov-stats"></div>' +
    '    <div class="pf-ov-btns">' +
    '      <button class="btn green" id="pf-ov-main" type="button"></button>' +
    '      <button class="btn" id="pf-ov-alt" type="button"></button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="pf-msg" id="pf-msg"></div>' +
    '<div class="pf-touch" id="pf-touch">' +
    '  <button class="pf-tbtn" data-k="left" type="button">◀</button>' +
    '  <button class="pf-tbtn dash" data-k="dash" type="button">»</button>' +
    '  <button class="pf-tbtn" data-k="right" type="button">▶</button>' +
    '  <button class="pf-tbtn jump" data-k="jump" type="button">⤒</button>' +
    '</div>' +
    '<div class="game-controls">' +
    '  <button id="pf-pause" class="btn yellow pf-ctrl" type="button">II</button>' +
    '  <button id="pf-restart" class="btn purple pf-ctrl" type="button">' + esc(t('gs.platformer.restart')) + '</button>' +
    '  <button id="pf-menu" class="btn pf-ctrl" type="button">' + esc(t('gs.platformer.menu')) + '</button>' +
    '</div>' +
    '<p class="pf-hint">' + esc(t('gs.platformer.help')) + '</p>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#pf-canvas');
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.aspectRatio = W + ' / ' + H;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var worldEl = wrap.querySelector('#pf-world');
  var coinsEl = wrap.querySelector('#pf-coins');
  var scoreEl = wrap.querySelector('#pf-score'), livesEl = wrap.querySelector('#pf-lives');
  var dashEl = wrap.querySelector('#pf-dash');
  var timeEl = wrap.querySelector('#pf-time'), msgEl = wrap.querySelector('#pf-msg');
  var overlay = wrap.querySelector('#pf-overlay'), ovTitle = wrap.querySelector('#pf-ov-title');
  var ovSub = wrap.querySelector('#pf-ov-sub'), ovStats = wrap.querySelector('#pf-ov-stats');
  var ovMain = wrap.querySelector('#pf-ov-main'), ovAlt = wrap.querySelector('#pf-ov-alt');
  var touchPad = wrap.querySelector('#pf-touch');
  var pauseBtn = wrap.querySelector('#pf-pause');

  pauseBtn.textContent = 'II';
  pauseBtn.setAttribute('aria-label', t('gs.platformer.pauseTitle'));
  var touchBtns = touchPad.querySelectorAll('.pf-tbtn');
  for (var ti = 0; ti < touchBtns.length; ti++) {
    var tk = touchBtns[ti].getAttribute('data-k');
    var tl = tk === 'left' ? t('gs.platformer.ctrlLeft') :
      tk === 'right' ? t('gs.platformer.ctrlRight') :
      tk === 'dash' ? t('gs.platformer.ctrlDash') : t('gs.platformer.ctrlJump');
    touchBtns[ti].setAttribute('aria-label', tl);
    touchBtns[ti].title = tl;
    if (tk === 'dash') touchBtns[ti].textContent = tl;
  }

  function bestScore() {
    try { return Arcade.storage.getBest('platformer'); } catch (e) { return null; }
  }
  function sfx(name) { if (Arcade.audio) Arcade.audio.play(name); }

  /* ---------- 关卡装载 ---------- */
  function loadLevel(pIdx, sIdx, newRun) {
    packIndex = pIdx; levelIndex = sIdx;
    selPack = pIdx; selStage = sIdx;
    var src = PACKS[pIdx].levels[sIdx];
    level = {
      w: src.w,
      spawn: { x: src.spawn.x, y: src.spawn.y },
      theme: PACKS[pIdx].theme,
      accent: PACKS[pIdx].accent,
      accent2: PACKS[pIdx].accent2,
      platforms: [], coins: [], spikes: [], enemies: [], walls: [], bullets: [],
      goal: { x: src.w - 78, y: GROUND_TOP - 64, w: 20, h: 64 },
      checkpoint: { x: src.checkpoint.x, y: src.checkpoint.y, h: 52 },
      cpActive: false,
      respawn: { x: src.spawn.x, y: src.spawn.y }
    };
    src.ground.forEach(function (g) {
      level.platforms.push({ x: g[0], y: GROUND_TOP, w: g[1] - g[0], h: 40, dx: 0, dy: 0, solid: true });
    });
    src.floats.forEach(function (f) {
      level.platforms.push({ x: f[0], y: f[1], w: f[2], h: 16, dx: 0, dy: 0 });
    });
    (src.movers || []).forEach(function (m) {
      level.platforms.push({ x: m.x, y: m.y, w: m.w, h: 16, bx: m.x, by: m.y, rx: m.rx, ry: m.ry, sp: m.sp, ph: m.ph, dx: 0, dy: 0, mover: true });
    });
    (src.walls || []).forEach(function (wl) {
      level.walls.push({ x: wl[0], y: wl[1], w: wl[2], h: wl[3] });
    });
    src.spikes.forEach(function (s) { level.spikes.push({ x: s[0], y: GROUND_TOP - 14, w: s[1], h: 14 }); });
    src.coins.forEach(function (c) { level.coins.push({ x: c[0], y: c[1], got: false, ph: Math.random() * 6.28 }); });
    src.enemies.forEach(function (e) {
      level.enemies.push({ x: e[0], y: GROUND_TOP - 24, w: 30, h: 24, minX: e[1], maxX: e[2], dir: 1, alive: true, ph: Math.random() * 6.28 });
    });
    if (src.boss) {
      level.boss = {
        x: src.boss.x, y: src.boss.y, bx: src.boss.x, by: src.boss.y,
        w: src.boss.w, h: src.boss.h, hp: src.boss.hp, hpMax: src.boss.hp,
        vx: 0, vy: 0, state: 'walk', timer: 1.2, onGround: true,
        active: false, dead: false, phase: 1, flash: 0, deathTimer: 0,
        arenaX: src.boss.arenaX, nameKey: src.boss.nameKey
      };
    }
    if (newRun) { lives = 3; score = 0; }
    player = {
      x: level.spawn.x, y: level.spawn.y, w: 24, h: 32, vx: 0, vy: 0,
      onGround: false, face: 1, base: null, sq: 0, prevBottom: level.spawn.y + 32
    };
    cam = 0; particles = []; afterImages = []; floats = []; invuln = 0; jumpBuffer = 0;
    dashTimer = 0; dashCd = 0; dashDir = 1; wallDir = 0; wallJumpLock = 0;
    wallSlide = false; shake = 0; deathAt = 0;
    msgEl.textContent = ''; msgUntil = 0;
    levelStart = performance.now(); elapsed = 0;
    updateHud();
  }

  function updateHud() {
    if (!level) return;
    worldEl.innerHTML = '<b>' + esc(t(pack().nameKey)) + '</b> ' + (levelIndex + 1) + '/' + pack().levels.length;
    var got = level.coins.filter(function (c) { return c.got; }).length;
    coinsEl.textContent = got + '/' + level.coins.length;
    scoreEl.textContent = score;
    var heartHtml = '';
    for (var hi = 0; hi < 3; hi++) heartHtml += '<span class="pf-life' + (hi < lives ? '' : ' off') + '"></span>';
    livesEl.innerHTML = heartHtml;
    livesEl.setAttribute('aria-label', t('gs.platformer.livesLeft') + ' ' + Math.max(0, lives) + '/3');
    timeEl.textContent = elapsed.toFixed(1) + 's';
  }

  function updateDashHud() {
    if (!dashEl) return;
    if (dashCd > 0) {
      dashEl.textContent = fmt('gs.platformer.dashCd', { s: dashCd.toFixed(1) });
      dashEl.className = 'cooling';
    } else {
      dashEl.textContent = t('gs.platformer.dashReady');
      dashEl.className = 'ready';
    }
  }

  /* ---------- 粒子 / 残影 / 浮字 ---------- */
  function burst(x, y, color, n, pow) {
    var p = pow || 3;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = Math.random() * p + 0.6;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 1, color: color, size: 2 + Math.random() * 3 });
    }
  }
  function floatText(x, y, text, color) {
    floats.push({ x: x, y: y, text: text, color: color || '#ffe600', life: 1 });
  }
  function pushNearMiss(x, y) {
    for (var i = 0; i < 6; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 26, y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 1.6, vy: 2 + Math.random() * 3,
        life: 0.55, color: '#ffe600', size: 1.5 + Math.random() * 2
      });
    }
  }
  function addAfterImage() {
    afterImages.push({
      x: player.x, y: player.y, w: player.w, h: player.h,
      face: player.face, life: 1, color: level ? level.accent : '#00f0ff'
    });
  }

  /* ---------- 消息 ---------- */
  function setMsg(text, color, dur) {
    msgEl.textContent = text;
    msgEl.style.color = color || 'var(--neon-green)';
    msgUntil = dur ? performance.now() + dur : 0;
  }

  /* ---------- 输入 ---------- */
  function pressJump() {
    if (state !== 'play') return;
    jumpBuffer = 0.16;
  }
  function pressDash() {
    if (state !== 'play') return;
    var d = player.face;
    if (keys.left && !keys.right) d = -1;
    else if (keys.right && !keys.left) d = 1;
    startDash(d);
  }
  function startDash(dir) {
    if (state !== 'play' || dashCd > 0 || dashTimer > 0) return;
    dashDir = dir || player.face;
    player.face = dashDir;
    dashTimer = DASH_TIME;
    dashCd = DASH_CD;
    dashFlash = 0.25;
    addAfterImage();
    burst(player.x + player.w / 2, player.y + player.h / 2, level ? level.accent : '#00f0ff', 12, 3.5);
    sfx('drop');
    if (Arcade.juice) Arcade.juice.select();
    updateDashHud();
  }
  function dirPressed(d) {
    if (state !== 'play') return;
    var now = performance.now();
    if (lastTapDir === d && now - lastTapAt < 260) {
      startDash(d);
      lastTapDir = 0; lastTapAt = 0;
    } else {
      lastTapDir = d; lastTapAt = now;
    }
  }

  Arcade.input.onKeys({
    left: function () { keys.left = true; },
    right: function () { keys.right = true; },
    up: function () { if (!keys.jump) pressJump(); keys.jump = true; },
    action: function () { if (!keys.jump) pressJump(); keys.jump = true; }
  });

  window.addEventListener('keydown', function (e) {
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') && !e.repeat) {
      pressDash(); return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      keys.left = true;
      if (!e.repeat) dirPressed(-1);
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      keys.right = true;
      if (!e.repeat) dirPressed(1);
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space' || e.code === 'Enter') {
      if (state !== 'play' && overlay.classList.contains('show') && overlayMainFn) {
        if (tag !== 'button') { e.preventDefault(); overlayMainFn(); }
        return;
      }
      if (!keys.jump) pressJump();
      keys.jump = true;
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW' || e.code === 'Enter') keys.jump = false;
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'play') pressJump();
  });

  function bindTouch() {
    for (var i = 0; i < touchBtns.length; i++) {
      (function (b) {
        var k = b.getAttribute('data-k');
        function down(e) {
          e.preventDefault();
          if (k === 'jump') { if (!keys.jump) pressJump(); keys.jump = true; }
          else if (k === 'dash') { pressDash(); }
          else {
            keys[k] = true;
            dirPressed(k === 'left' ? -1 : 1);
          }
          b.classList.add('on');
        }
        function up(e) {
          if (e) e.preventDefault();
          if (k === 'jump') keys.jump = false;
          else if (k === 'left' || k === 'right') keys[k] = false;
          b.classList.remove('on');
        }
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
      })(touchBtns[i]);
    }
    if (!Arcade.input.isTouch()) touchPad.classList.add('desktop');
  }
  bindTouch();

  /* ---------- 覆盖层 ---------- */
  function showOverlay(title, sub, stats, mainText, altText, mainFn, altFn) {
    ovTitle.textContent = title;
    ovSub.textContent = sub || '';
    ovStats.innerHTML = stats || '';
    ovMain.textContent = mainText || '';
    ovAlt.textContent = altText || '';
    overlayMainFn = mainFn || null;
    ovMain.onclick = function () { if (mainFn) mainFn(); };
    ovAlt.onclick = function () { if (altFn) altFn(); };
    ovMain.style.display = mainText ? '' : 'none';
    ovAlt.style.display = altText ? '' : 'none';
    overlay.classList.add('show');
  }
  function hideOverlay() {
    overlay.classList.remove('show');
    overlayMainFn = null;
  }

  function bestMarkup(label) {
    var best = bestScore();
    return '<span>' + esc(label) + ' <b>' + (best === null ? '----' : best) + '</b></span>';
  }

  function diffLabel(n) { return t('gs.platformer.diff' + n); }

  function buildMenuHtml() {
    var html = '<div class="pf-menu">';
    html += '<div class="pf-packs">';
    PACKS.forEach(function (pk, i) {
      html += '<button class="pf-pack' + (i === selPack ? ' sel' : '') + '" type="button" data-pack="' + i + '" style="--pf-accent:' + pk.accent + '">' +
        '<span class="pf-pack-name">' + esc(t(pk.nameKey)) + '</span>' +
        '<span class="pf-pack-desc">' + esc(t(pk.descKey)) + '</span>' +
        '<span class="pf-pack-tag">' + esc(fmt('gs.platformer.packTag', { n: pk.levels.length })) + '</span>' +
        '</button>';
    });
    html += '</div>';
    html += '<div class="pf-pick-title">' + esc(t('gs.platformer.menuStage')) + '</div>';
    html += '<div class="pf-stage-grid">';
    PACKS[selPack].levels.forEach(function (lv, i) {
      html += '<button class="pf-stage-btn' + (i === selStage ? ' sel' : '') + '" type="button" data-stage="' + i + '">' +
        '<span class="pf-stage-no">' + (i + 1) + '</span>' +
        '<span class="pf-stage-name">' + esc(t(lv.nameKey)) + '</span>' +
        '<span class="pf-diff d' + lv.diff + '">' + esc(diffLabel(lv.diff)) + '</span>' +
        '</button>';
    });
    html += '</div>';
    var cur = PACKS[selPack].levels[selStage];
    html += '<div class="pf-menu-foot">';
    html += '<span>' + esc(t('gs.platformer.menuPick')) + ' <b>' + esc(t(cur.nameKey)) + '</b> · ' + esc(diffLabel(cur.diff)) + '</span>';
    html += '<span>' + bestMarkup(t('gs.platformer.bestInfo')) + '</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function bindMenu() {
    var cards = ovStats.querySelectorAll('.pf-pack');
    for (var i = 0; i < cards.length; i++) {
      (function (el) {
        el.addEventListener('click', function () {
          selPack = Number(el.getAttribute('data-pack'));
          selStage = 0;
          loadLevel(selPack, selStage, true);
          ovStats.innerHTML = buildMenuHtml();
          bindMenu();
          sfx('ui');
        });
      })(cards[i]);
    }
    var stages = ovStats.querySelectorAll('.pf-stage-btn');
    for (var j = 0; j < stages.length; j++) {
      (function (el) {
        el.addEventListener('click', function () {
          selStage = Number(el.getAttribute('data-stage'));
          loadLevel(selPack, selStage, true);
          ovStats.innerHTML = buildMenuHtml();
          bindMenu();
          sfx('ui');
        });
      })(stages[j]);
    }
  }

  function showMenu() {
    state = 'menu';
    loadLevel(selPack, selStage, true);
    draw();
    showOverlay(
      t('gs.platformer.title'),
      t('gs.platformer.subtitle'),
      buildMenuHtml(),
      t('gs.platformer.startHere'),
      '',
      function () { startRun(selPack, selStage); },
      null
    );
    bindMenu();
  }

  function startRun(pIdx, sIdx) {
    runStartPack = pIdx; runStartStage = sIdx;
    selPack = pIdx; selStage = sIdx;
    keys.left = false; keys.right = false; keys.jump = false; jumpBuffer = 0;
    state = 'play';
    loadLevel(pIdx, sIdx, true);
    hideOverlay();
    setMsg(fmt('gs.platformer.levelIntro', { n: sIdx + 1, name: t(PACKS[pIdx].levels[sIdx].nameKey) }), 'var(--neon-cyan)', 2800);
    sfx('ui');
    if (Arcade.juice) Arcade.juice.select();
  }

  function nextLevel() {
    if (state !== 'clear') return;
    if (levelIndex + 1 >= pack().levels.length) { packClearScreen(); return; }
    state = 'play';
    loadLevel(packIndex, levelIndex + 1, false);
    hideOverlay();
    setMsg(fmt('gs.platformer.levelIntro', { n: levelIndex + 1, name: t(pack().levels[levelIndex].nameKey) }), 'var(--neon-cyan)', 2800);
    sfx('ui');
  }

  function completeLevel() {
    if (state !== 'play') return;
    state = 'clear';
    sfx('win');
    var bonus = Math.max(0, Math.round(420 - elapsed * 4));
    score += bonus;
    submitScore();
    updateHud();
    if (level.goal) {
      for (var i = 0; i < 5; i++) {
        burst(level.goal.x + 10 + Math.random() * 40, level.goal.y + Math.random() * 50, ['#00f0ff', '#39ff14', '#ffe600', '#ff2d95'][i % 4], 12, 5);
      }
    }
    if (Arcade.juice) Arcade.juice.win();
    if (levelIndex + 1 >= pack().levels.length) { packClearScreen(); return; }
    showOverlay(
      t('gs.platformer.clearTitle'),
      fmt('gs.platformer.clearSub', { n: levelIndex + 1, name: t(pack().levels[levelIndex].nameKey) }),
      '<span>' + esc(t('gs.platformer.timeBonus')) + ' <b>+' + bonus + '</b></span><br>' +
      '<span>' + esc(t('gs.platformer.totalScore')) + ' <b>' + score + '</b></span><br>' +
      bestMarkup(t('gs.platformer.bestInfo')),
      t('gs.platformer.nextLevel'),
      t('gs.platformer.restart'),
      function () { nextLevel(); },
      function () { startRun(runStartPack, runStartStage); }
    );
  }

  function packClearScreen() {
    state = 'victory';
    sfx('win');
    if (Arcade.juice) { Arcade.juice.win(); Arcade.fx.centerBurst('#ffe600', 40); }
    var finalPack = packIndex >= PACKS.length - 1;
    showOverlay(
      finalPack ? t('gs.platformer.allTitle') : t('gs.platformer.packClearTitle'),
      finalPack ? t('gs.platformer.allSub') : fmt('gs.platformer.packClearSub', { name: t(pack().nameKey) }),
      '<span>' + esc(t('gs.platformer.totalScore')) + ' <b>' + score + '</b></span><br>' +
      bestMarkup(t('gs.platformer.bestInfo')),
      finalPack ? t('gs.platformer.playAgain') : t('gs.platformer.nextPack'),
      t('gs.platformer.backMenu'),
      finalPack ? function () { startRun(runStartPack, runStartStage); } : function () { startRun(packIndex + 1, 0); },
      function () { showMenu(); }
    );
  }

  function gameOver() {
    state = 'gameover';
    sfx('lose');
    if (Arcade.juice) Arcade.juice.lose();
    submitScore();
    showOverlay(
      t('gs.platformer.gameOverTitle'),
      t('gs.platformer.gameOverSub'),
      '<span>' + esc(t('gs.platformer.totalScore')) + ' <b>' + score + '</b></span><br>' +
      bestMarkup(t('gs.platformer.bestInfo')),
      t('gs.platformer.playAgain'),
      t('gs.platformer.backMenu'),
      function () { startRun(runStartPack, runStartStage); },
      function () { showMenu(); }
    );
  }

  function submitScore() {
    try { if (Arcade.shell) Arcade.shell.submitScore(score); } catch (e) {}
  }

  /* ---------- 死亡 / 复活 ---------- */
  function die(cause) {
    if (state !== 'play') return;
    if (cause !== 'fall' && (invuln > 0 || dashTimer > 0)) return;
    lives--;
    sfx('lose');
    if (Arcade.juice) Arcade.juice.lose();
    shake = 10;
    burst(player.x + player.w / 2, player.y + player.h / 2, '#ff2d95', 26, 5);
    updateHud();
    if (lives <= 0) { gameOver(); return; }
    state = 'dying';
    deathAt = performance.now();
    var reason = cause === 'spike' ? t('gs.platformer.deathSpike') :
      cause === 'boss' ? t('gs.platformer.deathBoss') :
      cause === 'enemy' ? t('gs.platformer.deathEnemy') : t('gs.platformer.deathFall');
    setMsg(reason, 'var(--neon-pink)', 0);
    showOverlay(
      t('gs.platformer.deathTitle'),
      reason + ' · ' + t('gs.platformer.deathAuto'),
      '<span>' + esc(t('gs.platformer.livesLeft')) + ' <b>' + lives + '</b></span><br>' +
      '<span>' + esc(t('gs.platformer.cpActive')) + ' <b>' + (level.cpActive ? t('gs.platformer.cpOn') : t('gs.platformer.cpOff')) + '</b></span>',
      t('gs.platformer.respawnBtn'),
      t('gs.platformer.backMenu'),
      function () { respawnFromCheckpoint(); },
      function () { showMenu(); }
    );
  }

  function respawnFromCheckpoint() {
    if (state !== 'dying') return;
    var now = performance.now();
    var cp = level.respawn;
    player.x = cp.x; player.y = GROUND_TOP - player.h;
    player.vx = 0; player.vy = 0; player.onGround = false; player.base = null;
    player.sq = 1; player.prevBottom = player.y + player.h;
    invuln = 1.6; dashTimer = 0; dashCd = 0; dashDir = 1;
    wallDir = 0; wallJumpLock = 0; wallSlide = false;
    if (level.boss && !level.boss.dead) {
      var b = level.boss;
      b.active = false; b.x = b.bx; b.y = b.by; b.vx = 0; b.vy = 0;
      b.state = 'walk'; b.timer = 1.1; b.onGround = true; b.flash = 0;
      level.bullets = [];
    }
    levelStart += now - deathAt;
    deathAt = 0;
    state = 'play';
    hideOverlay();
    setMsg(level.cpActive ? t('gs.platformer.respawned') : t('gs.platformer.hint'), 'var(--neon-green)', 1800);
    sfx('ui');
  }

  function togglePause() {
    if (state === 'play') {
      state = 'paused';
      pausedAt = performance.now();
      showOverlay(
        t('gs.platformer.pauseTitle'),
        t('gs.platformer.pauseSub'),
        '<span>' + esc(t('gs.platformer.packName')) + ' <b>' + esc(t(pack().nameKey)) + '</b></span><br>' +
        '<span>' + esc(t('gs.platformer.stageName')) + ' <b>' + esc(t(pack().levels[levelIndex].nameKey)) + '</b></span><br>' +
        '<span>' + esc(t('gs.platformer.totalScore')) + ' <b>' + score + '</b></span>',
        t('gs.platformer.resume'),
        t('gs.platformer.backMenu'),
        function () { resumeGame(); },
        function () { showMenu(); }
      );
      sfx('ui');
    } else if (state === 'paused') {
      resumeGame();
    }
  }

  function resumeGame() {
    if (state !== 'paused') return;
    levelStart += performance.now() - pausedAt;
    state = 'play';
    hideOverlay();
    setMsg(t('gs.platformer.hint'), 'var(--neon-green)', 1800);
    sfx('ui');
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'play') togglePause();
  });

  /* ---------- 物理辅助 ---------- */
  function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function rectOverlap(x, y, w, h, b) { return x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y; }

  /* ---------- 首领 ---------- */
  function bossPhase(b) {
    if (b.hp > b.hpMax * 0.66) return 1;
    if (b.hp > b.hpMax * 0.33) return 2;
    return 3;
  }

  function activateBoss() {
    var b = level.boss;
    b.active = true;
    b.timer = 1.1;
    b.phase = bossPhase(b);
    shake = 8;
    sfx('drop');
    if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
    setMsg(fmt('gs.platformer.bossIntro', { name: t(b.nameKey) }), 'var(--neon-pink)', 2600);
    burst(b.x + b.w / 2, b.y + b.h / 2, level.accent2, 22, 4.5);
  }

  function bossShoot(b, phase) {
    var cx = b.x + b.w / 2, cy = b.y + b.h * 0.45;
    var tx = player.x + player.w / 2, ty = player.y + player.h / 2;
    var ang = Math.atan2(ty - cy, tx - cx);
    var shots = phase >= 3 ? 3 : 1;
    for (var i = 0; i < shots; i++) {
      var a = ang + (shots === 1 ? 0 : (i - 1) * 0.20);
      var sp = 3.0 + phase * 0.35;
      level.bullets.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 9, life: 4.2, kind: 'orb', ph: Math.random() * 6.28 });
    }
    sfx('drop');
  }

  function bossLandShock(b, phase) {
    shake = 13;
    burst(b.x + b.w / 2, GROUND_TOP - 6, level.accent, 18, 4);
    if (phase >= 2) {
      level.bullets.push({ x: b.x + 14, y: GROUND_TOP - 16, vx: -4.8, vy: 0, r: 11, life: 2.4, kind: 'wave', ph: 0 });
      level.bullets.push({ x: b.x + b.w - 14, y: GROUND_TOP - 16, vx: 4.8, vy: 0, r: 11, life: 2.4, kind: 'wave', ph: 1.2 });
    }
    if (Arcade.fx) Arcade.fx.shake(document.body);
  }

  function hitBoss(b) {
    b.hp--;
    b.flash = 0.28;
    score += 100;
    shake = 7;
    updateHud();
    burst(b.x + b.w / 2, b.y + 10, '#ffe600', 18, 4);
    floatText(b.x + b.w / 2, b.y - 6, '+100', '#ffe600');
    sfx('match');
    var np = bossPhase(b);
    if (np !== b.phase) {
      b.phase = np;
      shake = 12;
      burst(b.x + b.w / 2, b.y + b.h / 2, level.accent2, 26, 5);
      setMsg(fmt('gs.platformer.bossPhase', { n: np }), 'var(--neon-yellow)', 2200);
      sfx('clear');
    }
    if (b.hp <= 0) defeatBoss(b);
  }

  function defeatBoss(b) {
    b.dead = true; b.hp = 0; b.deathTimer = 1.3;
    level.bullets = [];
    score += 500;
    shake = 18;
    invuln = 999;
    updateHud();
    for (var i = 0; i < 8; i++) {
      burst(b.x + b.w / 2 + (Math.random() - 0.5) * 70, b.y + b.h / 2 + (Math.random() - 0.5) * 70,
        ['#ffe600', '#ff2d95', '#00f0ff', '#39ff14'][i % 4], 16, 6);
    }
    floatText(b.x + b.w / 2, b.y - 14, '+500', '#ffe600');
    setMsg(t('gs.platformer.bossDefeated'), 'var(--neon-green)', 3200);
    sfx('win');
    if (Arcade.juice) Arcade.juice.win();
    if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
  }

  function updateBoss(dt) {
    var b = level.boss;
    if (!b) return;
    if (b.dead) {
      if (b.deathTimer > 0) {
        b.deathTimer -= dt;
        if (b.deathTimer <= 0) completeLevel();
      }
      return;
    }
    if (!b.active) {
      if (player.x + player.w > b.arenaX) activateBoss();
      return;
    }

    if (b.flash > 0) b.flash -= dt;
    b.timer -= dt;

    var phase = b.phase;
    if (b.state === 'jump') {
      b.vy += GRAV * 0.95;
      b.y += b.vy;
      b.x += b.vx;
      if (b.y + b.h >= GROUND_TOP) {
        b.y = GROUND_TOP - b.h;
        b.vy = 0;
        b.state = 'walk';
        b.onGround = true;
        b.timer = 1.45 - phase * 0.16;
        bossLandShock(b, phase);
      }
    } else {
      var toward = player.x + player.w / 2 > b.x + b.w / 2 ? 1 : -1;
      b.x += toward * (0.45 + phase * 0.28) * (b.timer < 0.4 ? 1.4 : 1);
      if (b.timer <= 0) {
        if (phase === 1 || (phase === 2 && Math.random() < 0.3) || (phase === 3 && Math.random() < 0.25)) {
          b.state = 'jump';
          b.vy = -10.4 - phase * 0.35;
          b.vx = toward * (1.0 + phase * 0.22);
          b.onGround = false;
          b.timer = 0;
          sfx('move');
        } else {
          bossShoot(b, phase);
          b.timer = 1.25 - phase * 0.16;
        }
      }
    }
    b.x = Math.max(b.arenaX + 20, Math.min(level.w - b.w - 20, b.x));

    if (aabb(player, b)) {
      var stomp = player.vy > 1.5 && (player.y + player.h) < b.y + b.h * 0.48;
      if (stomp) {
        player.vy = -10.5; player.sq = 0.72;
        invuln = Math.max(invuln, 0.4);
        hitBoss(b);
      } else if (dashTimer <= 0) {
        die('boss');
        return;
      }
    }

    for (var i = level.bullets.length - 1; i >= 0; i--) {
      var bl = level.bullets[i];
      bl.x += bl.vx; bl.y += bl.vy; bl.life -= dt;
      if (bl.kind === 'wave') bl.y = GROUND_TOP - 16 - Math.abs(Math.sin(animT * 12 + bl.ph)) * 4;
      if (bl.life <= 0 || bl.x < b.arenaX - 80 || bl.x > level.w + 60) { level.bullets.splice(i, 1); continue; }
      if (player.x + 2 < bl.x + bl.r && player.x + player.w - 2 > bl.x - bl.r &&
          player.y + 2 < bl.y + bl.r && player.y + player.h - 2 > bl.y - bl.r) {
        if (dashTimer > 0) {
          level.bullets.splice(i, 1);
          burst(bl.x, bl.y, '#ffe600', 10, 3);
          sfx('match');
        } else {
          die('boss');
          return;
        }
      }
    }
  }

  /* ---------- 更新 ---------- */
  function update(steps) {
    var now = performance.now();
    var dt = STEP * (steps || 1);
    animT += dt;

    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pt = particles[pi];
      pt.x += pt.vx * dt * 60; pt.y += pt.vy * dt * 60;
      pt.vy += 0.12 * dt * 60; pt.vx *= 0.99; pt.life -= dt * 1.05;
      if (pt.life <= 0) particles.splice(pi, 1);
    }
    for (var fi = floats.length - 1; fi >= 0; fi--) {
      var ft = floats[fi];
      ft.y -= dt * 34; ft.life -= dt * 0.9;
      if (ft.life <= 0) floats.splice(fi, 1);
    }
    for (var ai = afterImages.length - 1; ai >= 0; ai--) {
      afterImages[ai].life -= dt * 3.2;
      if (afterImages[ai].life <= 0) afterImages.splice(ai, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 1.6);
    if (dashFlash > 0) dashFlash -= dt;

    if (state === 'dying' && deathAt && now - deathAt > 2500) { respawnFromCheckpoint(); return; }
    if (state !== 'play') {
      if (msgUntil && now > msgUntil) { msgEl.textContent = ''; msgUntil = 0; }
      return;
    }
    if (msgUntil && now > msgUntil) { msgEl.textContent = ''; msgUntil = 0; }

    elapsed = (now - levelStart) / 1000;
    timeEl.textContent = elapsed.toFixed(1) + 's';
    if (dashCd > 0) dashCd = Math.max(0, dashCd - dt);
    updateDashHud();

    var tSec = now / 1000;
    for (var mi = 0; mi < level.platforms.length; mi++) {
      var mp = level.platforms[mi];
      if (!mp.mover) continue;
      var nx = mp.bx + Math.sin(tSec * mp.sp + mp.ph) * mp.rx;
      var ny = mp.by + Math.sin(tSec * mp.sp + mp.ph) * mp.ry;
      mp.dx = nx - mp.x; mp.dy = ny - mp.y; mp.x = nx; mp.y = ny;
    }

    var move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (move) player.face = move;

    if (dashTimer > 0) {
      dashTimer = Math.max(0, dashTimer - dt);
      player.vx = dashDir * DASH_SPD;
      player.vy = 0;
      if (Math.floor(dashTimer * 60) % 2 === 0) addAfterImage();
      if (dashTimer <= 0) player.vx = dashDir * SPEED * 0.6;
    } else if (wallJumpLock > 0) {
      wallJumpLock = Math.max(0, wallJumpLock - dt);
      player.vx = wallJumpVx;
    } else {
      player.vx = move * SPEED;
    }
    if (player.vx > 0) player.face = 1;
    else if (player.vx < 0) player.face = -1;

    player.x += player.vx;
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x > level.w - player.w) { player.x = level.w - player.w; player.vx = 0; }

    wallDir = 0;
    for (var wi = 0; wi < level.walls.length; wi++) {
      var wl = level.walls[wi];
      if (player.x + player.w > wl.x && player.x < wl.x + wl.w && player.y + player.h > wl.y + 4 && player.y < wl.y + wl.h) {
        if (player.vx > 0 && player.x + player.w - player.vx <= wl.x + 1) { player.x = wl.x - player.w; player.vx = 0; dashTimer = 0; }
        else if (player.vx < 0 && player.x - player.vx >= wl.x + wl.w - 1) { player.x = wl.x + wl.w; player.vx = 0; dashTimer = 0; }
      }
      if (player.y + player.h > wl.y + 4 && player.y < wl.y + wl.h) {
        if (player.x + player.w >= wl.x - 2 && player.x + player.w <= wl.x + 5) wallDir = 1;
        else if (player.x <= wl.x + wl.w + 2 && player.x >= wl.x + wl.w - 5) wallDir = -1;
      }
    }

    if (jumpBuffer > 0) jumpBuffer -= dt;
    if (jumpBuffer > 0) {
      if (player.onGround) {
        player.vy = JUMP; player.onGround = false; jumpBuffer = 0; player.sq = 0.8;
        sfx('move');
        burst(player.x + player.w / 2, player.y + player.h, level.accent, 8, 2);
      } else if (wallDir !== 0 && wallJumpLock <= 0.02) {
        player.vy = -11.6;
        wallJumpVx = -wallDir * 5.4;
        wallJumpLock = 0.24;
        player.face = -wallDir;
        jumpBuffer = 0;
        player.sq = 0.78;
        player.onGround = false;
        sfx('move');
        burst(player.x + player.w / 2, player.y + player.h / 2, '#ffe600', 10, 3);
      }
    }
    if (player.vy < -3 && !keys.jump) player.vy += GRAV * 1.4;

    wallSlide = false;
    if (!player.onGround && dashTimer <= 0 && wallDir !== 0 && player.vy > 0 && move === wallDir) {
      player.vy = Math.min(player.vy, 2.4);
      wallSlide = true;
      if (Math.floor(now / 90) % 2 === 0) pushNearMiss(player.x + player.w / 2, player.y + player.h / 2);
    }

    var prevBottom = player.y + player.h;
    player.prevBottom = prevBottom;
    if (dashTimer <= 0) {
      player.vy += GRAV;
      player.vy = Math.min(player.vy, 14);
    }
    player.y += player.vy;

    var wasGround = player.onGround;
    player.onGround = false; player.base = null;
    for (var i = 0; i < level.platforms.length; i++) {
      var p = level.platforms[i];
      if (player.x + player.w < p.x || player.x > p.x + p.w) continue;
      if (player.vy >= 0 && prevBottom <= p.y + 8 && player.y + player.h >= p.y && player.y + player.h <= p.y + p.h + 20) {
        player.y = p.y - player.h; player.vy = 0; player.onGround = true; player.base = p;
      }
    }
    for (var wj = 0; wj < level.walls.length; wj++) {
      var ww = level.walls[wj];
      if (player.x + player.w < ww.x || player.x > ww.x + ww.w) continue;
      if (player.vy >= 0 && prevBottom <= ww.y + 8 && player.y + player.h >= ww.y && player.y + player.h <= ww.y + ww.h) {
        player.y = ww.y - player.h; player.vy = 0; player.onGround = true; player.base = null;
      }
    }
    if (player.onGround && player.base && player.base.mover) {
      player.x += player.base.dx; player.y += player.base.dy;
      if (player.x < 0) player.x = 0;
      if (player.x > level.w - player.w) player.x = level.w - player.w;
    }
    if (player.onGround && !wasGround) {
      player.sq = 0.82;
      burst(player.x + player.w / 2, player.y + player.h, level.accent2, 6, 1.5);
    }
    if (player.sq < 1) player.sq = Math.min(1, player.sq + dt * 4);

    if (invuln > 0) invuln -= dt;
    if (player.y > H + 60) { die('fall'); return; }

    /* 检查点 */
    if (!level.cpActive) {
      var cpRect = { x: level.checkpoint.x, y: level.checkpoint.y, w: 30, h: level.checkpoint.h };
      if (aabb(player, cpRect)) {
        level.cpActive = true;
        level.respawn = { x: level.checkpoint.x, y: GROUND_TOP - player.h };
        burst(level.checkpoint.x + 15, level.checkpoint.y + 20, '#39ff14', 18, 3.5);
        floatText(level.checkpoint.x + 15, level.checkpoint.y - 8, t('gs.platformer.cpOn'), '#39ff14');
        setMsg(t('gs.platformer.cpActive'), 'var(--neon-green)', 2200);
        shake = 4;
        sfx('coin');
        updateHud();
      }
    }

    /* 金币 */
    for (var c = 0; c < level.coins.length; c++) {
      var co = level.coins[c];
      if (co.got) continue;
      if (Math.abs(player.x + player.w / 2 - co.x) < 20 && Math.abs(player.y + player.h / 2 - co.y) < 22) {
        co.got = true; score += 20;
        burst(co.x, co.y, '#ffe600', 10, 2.5);
        floatText(co.x, co.y - 8, '+20', '#ffe600');
        sfx('coin');
        if (Arcade.juice) Arcade.juice.coin(screenX(co.x), screenY(co.y), '#ffe600');
        updateHud();
      }
    }

    /* 尖刺 */
    for (var s = 0; s < level.spikes.length; s++) {
      var sp = level.spikes[s];
      if (player.x + 4 < sp.x + sp.w && player.x + player.w - 4 > sp.x && player.y + player.h >= sp.y + 2 && player.y + player.h <= sp.y + sp.h + 8) {
        die('spike'); return;
      }
    }

    /* 敌人 */
    for (var e = 0; e < level.enemies.length; e++) {
      var en = level.enemies[e];
      if (!en.alive) continue;
      en.x += en.dir * 1.1;
      if (en.x < en.minX) { en.x = en.minX; en.dir = 1; }
      if (en.x + en.w > en.maxX) { en.x = en.maxX - en.w; en.dir = -1; }
      if (!aabb(player, en)) continue;
      if (dashTimer > 0) {
        en.alive = false;
        score += 50; updateHud();
        burst(en.x + en.w / 2, en.y + en.h / 2, '#39ff14', 16, 4);
        floatText(en.x + en.w / 2, en.y - 4, '+50', '#39ff14');
        sfx('match');
        shake = 5;
      } else if (player.vy > 2 && player.y + player.h - player.vy <= en.y + 12) {
        en.alive = false;
        player.vy = -8.5; player.sq = 0.75;
        invuln = Math.max(invuln, 0.35);
        score += 50; updateHud();
        burst(en.x + en.w / 2, en.y + en.h / 2, '#39ff14', 16, 4);
        floatText(en.x + en.w / 2, en.y - 4, '+50', '#39ff14');
        sfx('match');
        shake = 5;
      } else {
        die('enemy');
        return;
      }
    }

    /* 首领 */
    if (level.boss) updateBoss(dt);
    if (state !== 'play') return;

    /* 终点 */
    if ((!level.boss || level.boss.dead) && aabb(player, level.goal)) { completeLevel(); return; }

    var target = player.x - W * 0.36;
    target = Math.max(0, Math.min(level.w - W, target));
    cam += (target - cam) * (1 - Math.pow(0.88, dt * 60));
  }

  function screenX(wx) {
    var r = canvas.getBoundingClientRect();
    return r.left + (wx - cam) * (r.width / W);
  }
  function screenY(wy) {
    var r = canvas.getBoundingClientRect();
    return r.top + wy * (r.height / H);
  }

  /* ---------- 绘制辅助 ---------- */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (r < 0) r = 0;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(now) {
    var isLava = level && level.theme === 'lava';
    var g = ctx.createLinearGradient(0, 0, 0, H);
    if (isLava) {
      g.addColorStop(0, '#160611'); g.addColorStop(0.45, '#3a0b1a'); g.addColorStop(0.8, '#7a1a1c'); g.addColorStop(1, '#c2410c');
    } else {
      g.addColorStop(0, '#09051c'); g.addColorStop(0.55, '#170c34'); g.addColorStop(1, '#2a0f3a');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (isLava) {
      for (var ei = 0; ei < 46; ei++) {
        var ex = (ei * 97 + 31) % W;
        var ey = H - ((now / 18 + ei * 47) % (H * 0.82));
        var ea = 0.25 + Math.sin(now / 400 + ei) * 0.18;
        ctx.globalAlpha = Math.max(0.05, ea);
        ctx.fillStyle = ei % 5 === 0 ? '#ffe600' : '#ff9f1c';
        ctx.fillRect(ex, ey, ei % 7 === 0 ? 2 : 1, ei % 7 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
      var sun = ctx.createRadialGradient(W * 0.2, 94, 8, W * 0.2, 94, 96);
      sun.addColorStop(0, 'rgba(255,236,150,0.95)'); sun.addColorStop(0.35, 'rgba(255,159,28,0.45)'); sun.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W * 0.2, 94, 96, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#ffefb0'; ctx.beginPath(); ctx.arc(W * 0.2, 94, 24, 0, 6.3); ctx.fill();
      drawHills(-cam * 0.14, 214, 240, '#3a0b1a', 0.6, 1);
      drawHills(-cam * 0.3, 252, 220, '#5a1220', 0.72, 2);
      drawHills(-cam * 0.52, 292, 176, '#7a1a1c', 0.8, 3);
      var lg = ctx.createLinearGradient(0, H - 120, 0, H);
      lg.addColorStop(0, 'rgba(255,159,28,0)'); lg.addColorStop(1, 'rgba(255,120,20,0.34)');
      ctx.fillStyle = lg; ctx.fillRect(0, H - 120, W, 120);
    } else {
      for (var i = 0; i < 64; i++) {
        var sx = (i * 137 + 43) % W, sy = (i * 73 + 21) % (H * 0.6);
        var tw = 0.3 + Math.sin(now / 700 + i) * 0.3;
        ctx.globalAlpha = Math.max(0.05, tw);
        ctx.fillStyle = i % 5 === 0 ? '#ff2d95' : '#bfe9ff';
        ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
      var mg = ctx.createRadialGradient(W * 0.78, 74, 4, W * 0.78, 74, 52);
      mg.addColorStop(0, 'rgba(255,240,190,0.95)'); mg.addColorStop(0.35, 'rgba(255,220,150,0.35)'); mg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(W * 0.78, 74, 52, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(W * 0.78, 74, 15, 0, 6.3); ctx.fill();
      drawHills(-cam * 0.12, 210, 300, '#1b1040', 0.55, 1);
      drawHills(-cam * 0.28, 250, 240, '#241456', 0.65, 2);
      drawHills(-cam * 0.5, 292, 180, '#2c1a63', 0.75, 3);
      var ng = ctx.createLinearGradient(0, H - 110, 0, H);
      ng.addColorStop(0, 'rgba(185,103,255,0)'); ng.addColorStop(1, 'rgba(185,103,255,0.22)');
      ctx.fillStyle = ng; ctx.fillRect(0, H - 110, W, 110);
    }

    /* 峡谷底部的熔岩 / 深渊 */
    var pit = ctx.createLinearGradient(0, H - 30, 0, H);
    if (isLava) {
      pit.addColorStop(0, 'rgba(255,120,20,0.05)'); pit.addColorStop(0.55, 'rgba(255,120,20,0.55)'); pit.addColorStop(1, 'rgba(255,230,0,0.9)');
    } else {
      pit.addColorStop(0, 'rgba(0,0,0,0)'); pit.addColorStop(0.6, 'rgba(10,4,24,0.55)'); pit.addColorStop(1, 'rgba(3,1,10,0.95)');
    }
    ctx.fillStyle = pit; ctx.fillRect(0, H - 30, W, 30);
  }

  function drawHills(off, baseY, amp, color, alpha, seed) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    var step = 80;
    for (var x = -off - step; x <= W + step; x += step) {
      var y = baseY + Math.sin((x + off) / (190 + seed * 20)) * amp * 0.2 + Math.cos((x + off) / (300 + seed * 30)) * amp * 0.14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + step, H);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPlatform(p, now) {
    ctx.save();
    var isLava = level && level.theme === 'lava';
    var g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    if (p.mover) { g.addColorStop(0, '#7ef9ff'); g.addColorStop(1, '#2060a8'); }
    else if (isLava) { g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#8a2410'); }
    else { g.addColorStop(0, '#9a7bff'); g.addColorStop(1, '#452a8f'); }
    ctx.fillStyle = g;
    ctx.shadowColor = p.mover ? '#00f0ff' : (isLava ? '#ff6b00' : '#b967ff');
    ctx.shadowBlur = 12;
    rr(p.x, p.y, p.w, p.h, p.h > 20 ? 6 : 8); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = p.mover ? 'rgba(126,249,255,0.95)' : (isLava ? 'rgba(255,220,160,0.8)' : 'rgba(206,180,255,0.75)');
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x + 4, p.y + 1); ctx.lineTo(p.x + p.w - 4, p.y + 1); ctx.stroke();
    if (p.h > 20) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (var i = 0; i < p.w; i += 28) ctx.fillRect(p.x + i + 6, p.y + 14, 10, 3);
    }
    if (p.mover) {
      var pulse = 0.4 + Math.sin(now / 220) * 0.3;
      ctx.fillStyle = 'rgba(0,240,255,' + pulse + ')';
      for (var j = 8; j < p.w - 8; j += 20) ctx.fillRect(p.x + j, p.y + p.h + 3, 6, 3);
    }
    ctx.restore();
  }

  function drawWall(w, now) {
    ctx.save();
    var isLava = level && level.theme === 'lava';
    var g = ctx.createLinearGradient(w.x, 0, w.x + w.w, 0);
    if (isLava) { g.addColorStop(0, '#4a1208'); g.addColorStop(0.5, '#ff7a1c'); g.addColorStop(1, '#2a0a04'); }
    else { g.addColorStop(0, '#3a1a63'); g.addColorStop(0.5, '#8e5cff'); g.addColorStop(1, '#2a1040'); }
    ctx.fillStyle = g;
    ctx.shadowColor = isLava ? '#ff6b00' : '#b967ff'; ctx.shadowBlur = 12;
    rr(w.x, w.y, w.w, w.h, 4); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,240,255,0.75)'; ctx.lineWidth = 1.4;
    ctx.strokeRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
    var pulse = 0.25 + Math.sin(now / 260 + w.x) * 0.2;
    ctx.fillStyle = 'rgba(0,240,255,' + pulse + ')';
    for (var y = w.y + 8; y < w.y + w.h - 6; y += 18) ctx.fillRect(w.x + 4, y, w.w - 8, 2);
    ctx.restore();
  }

  function drawSpike(s) {
    ctx.save();
    ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 10;
    var n = Math.max(2, Math.round(s.w / 16));
    for (var i = 0; i < n; i++) {
      var x = s.x + i * (s.w / n);
      var grd = ctx.createLinearGradient(x, s.y, x, s.y + s.h);
      grd.addColorStop(0, '#ffd1e8'); grd.addColorStop(0.5, '#ff2d95'); grd.addColorStop(1, '#7a0f3a');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(x, s.y + s.h); ctx.lineTo(x + s.w / n / 2, s.y); ctx.lineTo(x + s.w / n, s.y + s.h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawCoin(c, now) {
    if (c.got) return;
    var bob = Math.sin(now / 260 + c.ph) * 3;
    var sc = Math.abs(Math.cos(now / 320 + c.ph));
    ctx.save();
    ctx.translate(c.x, c.y + bob); ctx.scale(Math.max(0.15, sc), 1);
    ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 12;
    var grd = ctx.createLinearGradient(-10, -10, 10, 10);
    grd.addColorStop(0, '#fff6a8'); grd.addColorStop(0.5, '#ffe600'); grd.addColorStop(1, '#b58b00');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.3); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 6.3); ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(en, now) {
    var bob = Math.sin(now / 240 + en.ph) * 2;
    ctx.save();
    ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 12;
    var grd = ctx.createRadialGradient(en.x + en.w / 2, en.y + en.h / 2, 2, en.x + en.w / 2, en.y + en.h / 2, en.w / 2);
    grd.addColorStop(0, '#d6ffc8'); grd.addColorStop(0.55, '#39ff14'); grd.addColorStop(1, '#128a0a');
    ctx.fillStyle = grd;
    rr(en.x, en.y + bob, en.w, en.h - bob, 10); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#08120a';
    ctx.beginPath(); ctx.arc(en.x + 9, en.y + 9 + bob, 3.4, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(en.x + en.w - 9, en.y + 9 + bob, 3.4, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(en.x + 10, en.y + 8 + bob, 1.2, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(en.x + en.w - 8, en.y + 8 + bob, 1.2, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  function drawCheckpoint(now) {
    var cp = level.checkpoint;
    var active = level.cpActive;
    var col = active ? '#39ff14' : '#7a5cff';
    var baseY = GROUND_TOP;
    ctx.save();
    var pulse = 0.6 + Math.sin(now / 240) * 0.3;
    var rg = ctx.createRadialGradient(cp.x + 15, cp.y + 22, 4, cp.x + 15, cp.y + 22, active ? 56 : 36);
    rg.addColorStop(0, active ? 'rgba(57,255,20,0.42)' : 'rgba(122,92,255,0.22)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cp.x + 15, cp.y + 22, active ? 56 : 36, 0, 6.3); ctx.fill();

    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(cp.x + 6, baseY); ctx.lineTo(cp.x + 6, cp.y + 4); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cp.x + 7, cp.y + 4);
    for (var i = 0; i <= 8; i++) {
      var tt = i / 8;
      ctx.lineTo(cp.x + 7 + tt * 22, cp.y + 4 + Math.sin(now / 170 + tt * 4) * 4 * tt + tt * 3);
    }
    for (var j = 8; j >= 0; j--) {
      var t2 = j / 8;
      ctx.lineTo(cp.x + 7 + t2 * 22, cp.y + 16 + Math.sin(now / 170 + t2 * 4) * 4 * t2 + t2 * 3);
    }
    ctx.closePath(); ctx.fill();

    ctx.globalAlpha = 0.35 + pulse * 0.35;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cp.x + 15, cp.y + 26, active ? 7 : 5, 0, 6.3); ctx.fill();
    ctx.globalAlpha = 1;
    if (active) {
      ctx.strokeStyle = 'rgba(57,255,20,' + (0.3 + pulse * 0.35) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cp.x + 15, baseY - 3, 22 + pulse * 8, 5 + pulse * 3, 0, 0, 6.3); ctx.stroke();
    }
    ctx.restore();
  }

  function drawGoal(now) {
    var g = level.goal;
    if (level.boss && !level.boss.dead) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff2d95'; ctx.lineWidth = 2;
      ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 14;
      rr(g.x - 4, g.y - 8, g.w + 8, g.h + 8, 8); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g.x + 2, g.y + 4); ctx.lineTo(g.x + g.w / 2, g.y + g.h / 2); ctx.lineTo(g.x + 2, g.y + g.h - 4);
      ctx.moveTo(g.x + g.w - 2, g.y + 4); ctx.lineTo(g.x + g.w / 2, g.y + g.h / 2); ctx.lineTo(g.x + g.w - 2, g.y + g.h - 4);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    var pulse = 1 + Math.sin(now / 260) * 0.12;
    var rg = ctx.createRadialGradient(g.x + g.w / 2, g.y + g.h / 2, 4, g.x + g.w / 2, g.y + g.h / 2, 46 * pulse);
    rg.addColorStop(0, 'rgba(57,255,20,0.55)'); rg.addColorStop(0.6, 'rgba(0,240,255,0.22)'); rg.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(g.x + g.w / 2, g.y + g.h / 2, 46 * pulse, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#a8fff0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(g.x + 4, g.y + g.h); ctx.lineTo(g.x + 4, g.y); ctx.stroke();
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(g.x + 5, g.y + 4);
    for (var i = 0; i <= 8; i++) {
      var tt = i / 8;
      ctx.lineTo(g.x + 5 + tt * 34, g.y + 4 + Math.sin(now / 180 + tt * 4) * 5 * tt + tt * 4);
    }
    for (var j = 8; j >= 0; j--) {
      var t2 = j / 8;
      ctx.lineTo(g.x + 5 + t2 * 34, g.y + 24 + Math.sin(now / 180 + t2 * 4) * 5 * t2 + t2 * 4);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawBoss(now) {
    var b = level.boss;
    if (!b) return;
    ctx.save();
    if (b.dead) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.deathTimer / 1.3));
    }
    var bob = Math.sin(now / 230) * 3;
    var alpha = b.flash > 0 ? 0.75 + Math.sin(now / 30) * 0.25 : 1;
    ctx.globalAlpha *= alpha;

    var sh = ctx.createRadialGradient(b.x + b.w / 2, GROUND_TOP, 4, b.x + b.w / 2, GROUND_TOP, b.w * 0.7);
    sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, GROUND_TOP - 2, b.w * 0.7, 9, 0, 0, 6.3); ctx.fill();

    var grd = ctx.createLinearGradient(b.x, b.y + bob, b.x + b.w, b.y + b.h + bob);
    grd.addColorStop(0, b.flash > 0 ? '#ffffff' : '#ffd1e8');
    grd.addColorStop(0.4, level.accent2);
    grd.addColorStop(1, '#5a0f3a');
    ctx.fillStyle = grd;
    ctx.shadowColor = level.accent2; ctx.shadowBlur = 22;
    rr(b.x, b.y + bob, b.w, b.h, 18); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(b.x + 8, b.y + 10 + bob, b.w - 16, b.h * 0.4, 10); ctx.fill();

    var eye = b.flash > 0 ? '#ff2d95' : '#0a0410';
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.32, b.y + b.h * 0.4 + bob, 7, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.68, b.y + b.h * 0.4 + bob, 7, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#ffe600';
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.32 + 2, b.y + b.h * 0.4 + bob, 2.6, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.68 + 2, b.y + b.h * 0.4 + bob, 2.6, 0, 6.3); ctx.fill();

    /* 锯齿冠 */
    ctx.fillStyle = level.accent;
    for (var i = 0; i < 5; i++) {
      var px = b.x + 8 + i * (b.w - 16) / 4;
      ctx.beginPath();
      ctx.moveTo(px - 8, b.y + bob + 2);
      ctx.lineTo(px, b.y + bob - 12 - Math.sin(now / 300 + i) * 2);
      ctx.lineTo(px + 8, b.y + bob + 2);
      ctx.closePath(); ctx.fill();
    }

    /* 弱点 */
    var pulse = 1 + Math.sin(now / 180) * 0.16;
    var wr = 15 * pulse;
    var wg = ctx.createRadialGradient(b.x + b.w / 2, b.y + bob + 14, 2, b.x + b.w / 2, b.y + bob + 14, wr);
    wg.addColorStop(0, 'rgba(255,255,255,0.95)');
    wg.addColorStop(0.45, 'rgba(255,230,0,0.9)');
    wg.addColorStop(1, 'rgba(255,159,28,0)');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + bob + 14, wr, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#ffe600';
    ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + bob + 14, 5, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  function drawBullet(bl, now) {
    ctx.save();
    var pulse = 1 + Math.sin(now / 140 + bl.ph) * 0.15;
    if (bl.kind === 'wave') {
      ctx.strokeStyle = 'rgba(255,159,28,0.9)'; ctx.lineWidth = 4;
      ctx.shadowColor = level.accent2; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(bl.x, bl.y, 12 * pulse, Math.PI, 0); ctx.stroke();
    } else {
      var g = ctx.createRadialGradient(bl.x, bl.y, 1, bl.x, bl.y, bl.r * pulse);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#ffe600'); g.addColorStop(1, 'rgba(255,45,149,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r * pulse, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,45,149,0.8)';
      ctx.beginPath(); ctx.arc(bl.x, bl.y, 3, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(now) {
    for (var ti = 0; ti < afterImages.length; ti++) {
      var ai = afterImages[ti];
      ctx.save();
      ctx.globalAlpha = Math.max(0, ai.life) * 0.4;
      ctx.fillStyle = ai.color;
      rr(ai.x, ai.y, ai.w, ai.h, 9); ctx.fill();
      ctx.restore();
    }
    if (invuln > 0 && Math.floor(now / 100) % 2 === 0) return;
    var sq = player.sq, w = player.w * sq, h = player.h * (2 - sq);
    var x = player.x + (player.w - w) / 2, y = player.y + (player.h - h);
    ctx.save();
    ctx.shadowColor = dashTimer > 0 ? '#ffe600' : '#00f0ff';
    ctx.shadowBlur = dashTimer > 0 ? 22 : 16;
    var grd = ctx.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, dashTimer > 0 ? '#fff9c4' : '#bffcff');
    grd.addColorStop(0.5, dashTimer > 0 ? '#ffe600' : '#00f0ff');
    grd.addColorStop(1, dashTimer > 0 ? '#ff9f1c' : '#0077a8');
    ctx.fillStyle = grd;
    rr(x, y, w, h, 9); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff2d95';
    ctx.beginPath();
    var dir = player.face;
    ctx.moveTo(x + (dir < 0 ? 0 : w), y + 10);
    ctx.quadraticCurveTo(x + (dir < 0 ? -22 : w + 22) + Math.sin(now / 120) * 4, y + 16, x + (dir < 0 ? -6 : w + 6), y + 22);
    ctx.lineTo(x + (dir < 0 ? 0 : w), y + 18);
    ctx.fill();

    ctx.fillStyle = '#04121a';
    var ex = x + w / 2 + (dir > 0 ? 3 : -3);
    ctx.beginPath(); ctx.arc(ex - 4, y + 12, 2.6, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 4, y + 12, 2.6, 0, 6.3); ctx.fill();

    if (wallSlide) {
      ctx.fillStyle = 'rgba(255,230,0,0.8)';
      ctx.fillRect(x + (wallDir > 0 ? w - 3 : 0), y + 8, 3, 18);
    }
    ctx.restore();
  }

  function drawBossBar(now) {
    var b = level.boss;
    if (!b || !b.active || b.dead) return;
    var bw = 360, bh = 13, bx = (W - bw) / 2, by = 12;
    ctx.save();
    ctx.fillStyle = 'rgba(5,3,14,0.72)';
    rr(bx - 10, by - 4, bw + 20, bh + 30, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(255,45,149,0.6)'; ctx.lineWidth = 1;
    rr(bx - 10, by - 4, bw + 20, bh + 30, 9); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffd1e8';
    ctx.fillText(t(b.nameKey), W / 2, by + 9);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(bx, by + 15, bw, bh, 6); ctx.fill();
    var ratio = Math.max(0, b.hp / b.hpMax);
    var g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#ff2d95'); g.addColorStop(1, '#ffe600');
    ctx.fillStyle = g;
    if (ratio > 0) { rr(bx, by + 15, bw * ratio, bh, 6); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    for (var i = 1; i < b.hpMax; i++) {
      var dx = bx + bw * i / b.hpMax;
      ctx.beginPath(); ctx.moveTo(dx, by + 15); ctx.lineTo(dx, by + 15 + bh); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(t('gs.platformer.bossPhaseTag') + ' ' + b.phase, bx + bw, by + 9);
    ctx.restore();
  }

  function draw(now) {
    now = now || performance.now();
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawBackground(now);
    ctx.save();
    ctx.translate(-cam, 0);

    if (level) {
      level.platforms.forEach(function (p) { drawPlatform(p, now); });
      level.walls.forEach(function (w) { drawWall(w, now); });
      level.spikes.forEach(drawSpike);
      level.coins.forEach(function (c) { drawCoin(c, now); });
      level.enemies.forEach(function (e) { if (e.alive) drawEnemy(e, now); });
      drawCheckpoint(now);
      drawGoal(now);
      if (level.boss) {
        drawBoss(now);
        level.bullets.forEach(function (bl) { drawBullet(bl, now); });
      }

      particles.forEach(function (p) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, 6.3); ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (state !== 'menu' && player) drawPlayer(now);

      floats.forEach(function (f) {
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
      });
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    var fog = ctx.createLinearGradient(0, H - 46, 0, H);
    fog.addColorStop(0, 'rgba(20,8,34,0)'); fog.addColorStop(1, 'rgba(20,8,34,0.85)');
    ctx.fillStyle = fog; ctx.fillRect(0, H - 46, W, 46);

    if (level && player) {
      var prog = Math.min(1, player.x / (level.w - 80));
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(18, H - 20, W - 36, 6, 3); ctx.fill();
      var pg = ctx.createLinearGradient(18, 0, W - 18, 0);
      pg.addColorStop(0, level.accent); pg.addColorStop(1, '#39ff14');
      ctx.fillStyle = pg; rr(18, H - 20, Math.max(2, (W - 36) * prog), 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(18 + (W - 36) * prog, H - 17, 4, 0, 6.3); ctx.fill();
    }

    if (level && level.boss) drawBossBar(now);
    ctx.restore();
  }

  /* ---------- 循环 ---------- */
  loopApi = Arcade.loop.start(update, draw, 16);

  /* ---------- 按钮 ---------- */
  wrap.querySelector('#pf-restart').addEventListener('click', function () {
    if (state === 'menu' || state === 'gameover') showMenu();
    else startRun(runStartPack, runStartStage);
  });
  wrap.querySelector('#pf-menu').addEventListener('click', function () { showMenu(); });
  pauseBtn.addEventListener('click', function () { togglePause(); });

  window.GAME_RESTART = function () {
    if (state === 'menu' || state === 'gameover') showMenu();
    else startRun(runStartPack, runStartStage);
  };

  showMenu();

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.platformer.helpText');
  root.appendChild(hd);

})();
