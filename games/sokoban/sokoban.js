/* ============================================================
   推箱子 Sokoban · 旗舰版
   - 100 关（10 章 × 10 关，尺寸/箱数/拉动/内墙递进）
   - 反向拉动生成 + 生成后回放自校验，保证每关可解且开局未完成
   - 完整静态死锁检测（墙角 / 贴墙线 / 冻结箱群 / 2×2 箱块）
   - 完整历史撤销、单关重来、下一关、选关、暂停与断点存档（v3 兼容 v2）
   - 总分口径：100 关全部通关后提交「各关最佳步数之和」
   - Canvas 木纹箱子 / 目标脉动 / 归位光效 / 推箱缓动 / 死锁红色脉冲
   ============================================================ */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.sokoban.tut1t'), d: T('gs.sokoban.tut1') },
  { t: T('gs.sokoban.tut2t'), d: T('gs.sokoban.tut2') },
  { t: T('gs.sokoban.tut3t'), d: T('gs.sokoban.tut3') },
  { t: T('gs.sokoban.tut4t'), d: T('gs.sokoban.tut4') }
];

(function () {
  'use strict';
  var root = document.getElementById('game-root');
  if (!root) return;

  var W = 460, H = 460, PAD = 8;
  /* GEN-BEGIN: 关卡配置与生成算法（独立块，便于本地脚本抽取验证） */
  var TOTAL = 100;
  /* 前 15 关配置与生成结果保持不变（兼容旧进度） */
  var CFG = [
    { w: 7, h: 5, boxes: 1, pulls: 2, walls: 0 },
    { w: 8, h: 6, boxes: 1, pulls: 4, walls: 2 },
    { w: 8, h: 6, boxes: 2, pulls: 5, walls: 2 },
    { w: 9, h: 7, boxes: 2, pulls: 7, walls: 4 },
    { w: 9, h: 7, boxes: 2, pulls: 9, walls: 5 },
    { w: 10, h: 7, boxes: 3, pulls: 10, walls: 5 },
    { w: 10, h: 8, boxes: 3, pulls: 12, walls: 7 },
    { w: 10, h: 8, boxes: 3, pulls: 15, walls: 7 },
    { w: 11, h: 8, boxes: 4, pulls: 15, walls: 8 },
    { w: 11, h: 9, boxes: 4, pulls: 18, walls: 9 },
    { w: 12, h: 9, boxes: 4, pulls: 20, walls: 10 },
    { w: 12, h: 9, boxes: 5, pulls: 22, walls: 10 },
    { w: 13, h: 9, boxes: 5, pulls: 25, walls: 11 },
    { w: 13, h: 10, boxes: 5, pulls: 28, walls: 12 },
    { w: 14, h: 10, boxes: 6, pulls: 32, walls: 12 }
  ];
  /* 16–100 关：随关卡序号平滑递进（尺寸/箱数/拉动/内墙均不回落） */
  for (var cfi = 15; cfi < TOTAL; cfi++) {
    var cfT = (cfi - 15) / (TOTAL - 16);
    CFG[cfi] = {
      w: 14 + Math.floor(cfT * 4),
      h: 10 + Math.floor(cfT * 3),
      boxes: 6 + Math.floor(cfT * 5),
      pulls: 34 + Math.floor(cfT * 40),
      walls: 12 + Math.floor(cfT * 14)
    };
  }

  /* ---------------- 工具 ---------------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function fmtTime(ms) { return GK.fmtTime(ms); }

  /* ---------------- 关卡生成（反向拉动，保证可解） ---------------- */
  function genLevel(idx) {
    var cfg = CFG[idx];
    for (var attempt = 0; attempt < 140; attempt++) {
      var R = cfg.h, C = cfg.w;
      var rnd = mulberry32(0x51ED270B + idx * 2654435761 + attempt * 977);
      var walls = [], targets = [];
      var r, c;
      for (r = 0; r < R; r++) {
        walls[r] = []; targets[r] = [];
        for (c = 0; c < C; c++) {
          walls[r][c] = (r === 0 || r === R - 1 || c === 0 || c === C - 1);
          targets[r][c] = false;
        }
      }
      var interior = [];
      for (r = 1; r < R - 1; r++) for (c = 1; c < C - 1; c++) interior.push({ r: r, c: c });
      var picks = shuffle(interior.slice(), rnd);
      for (var wi = 0; wi < cfg.walls && wi < picks.length; wi++) {
        walls[picks[wi].r][picks[wi].c] = true;
      }
      var floorCells = interior.filter(function (p) { return !walls[p.r][p.c]; });
      if (floorCells.length < cfg.boxes + 3) continue;

      var goalCells = shuffle(floorCells.slice(), rnd).slice(0, cfg.boxes);
      goalCells.forEach(function (p) { targets[p.r][p.c] = true; });
      var boxes = goalCells.map(function (p) { return { r: p.r, c: p.c }; });

      function boxIndexAt(rr, cc) {
        for (var bi = 0; bi < boxes.length; bi++) if (boxes[bi].r === rr && boxes[bi].c === cc) return bi;
        return -1;
      }
      var freeCells = floorCells.filter(function (p) { return boxIndexAt(p.r, p.c) < 0; });
      if (!freeCells.length) continue;
      var ps = freeCells[Math.floor(rnd() * freeCells.length)];
      var player = { r: ps.r, c: ps.c };
      var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      var pulls = 0, guard = 0, ops = [];
      while (pulls < cfg.pulls && guard < cfg.pulls * 70) {
        guard++;
        var candidates = [];
        for (var di = 0; di < 4; di++) {
          var d = dirs[di];
          var br = player.r + d[0], bc = player.c + d[1];
          var bi = boxIndexAt(br, bc);
          if (bi < 0) continue;
          var pr = player.r - d[0], pc = player.c - d[1];
          if (pr < 1 || pr >= R - 1 || pc < 1 || pc >= C - 1) continue;
          if (walls[pr][pc] || boxIndexAt(pr, pc) >= 0) continue;
          candidates.push({ bi: bi, pr: pr, pc: pc, d: d });
        }
        var walks = [];
        for (var dj = 0; dj < 4; dj++) {
          var dd = dirs[dj];
          var wr = player.r + dd[0], wc = player.c + dd[1];
          if (wr < 1 || wr >= R - 1 || wc < 1 || wc >= C - 1) continue;
          if (walls[wr][wc] || boxIndexAt(wr, wc) >= 0) continue;
          walks.push({ r: wr, c: wc, d: dd });
        }
        if (candidates.length && (pulls === 0 || rnd() < 0.72)) {
          var pick = candidates[Math.floor(rnd() * candidates.length)];
          boxes[pick.bi].r = player.r;
          boxes[pick.bi].c = player.c;
          player = { r: pick.pr, c: pick.pc };
          ops.push({ t: 'p', d: [pick.d[0], pick.d[1]] });
          pulls++;
        } else if (walks.length) {
          var mv = walks[Math.floor(rnd() * walks.length)];
          player = { r: mv.r, c: mv.c };
          ops.push({ t: 'w', d: [mv.d[0], mv.d[1]] });
        } else break;
      }
      if (pulls < cfg.pulls) continue;
      var solved = true;
      for (var bi2 = 0; bi2 < boxes.length; bi2++) {
        if (!targets[boxes[bi2].r][boxes[bi2].c]) { solved = false; break; }
      }
      if (solved) continue;
      var lv = { R: R, C: C, walls: walls, targets: targets, boxes: boxes, player: player, sol: ops };
      /* 回放全部反向操作：确保生成局面确实可解（不通过则换随机种子重试） */
      if (!verifyLevel(lv)) continue;
      return lv;
    }
    return fallbackLevel(idx);
  }

  /* 用生成时记录的反向操作回放：把箱子推回全部目标点 */
  function verifyLevel(lv) {
    if (!lv || !lv.sol || !lv.sol.length) return false;
    var vBoxes = lv.boxes.map(function (b) { return { r: b.r, c: b.c }; });
    var vp = { r: lv.player.r, c: lv.player.c };
    var R = lv.R, C = lv.C, walls = lv.walls, targets = lv.targets;
    function at(r, c) {
      for (var i = 0; i < vBoxes.length; i++) if (vBoxes[i].r === r && vBoxes[i].c === c) return i;
      return -1;
    }
    for (var i = lv.sol.length - 1; i >= 0; i--) {
      var op = lv.sol[i];
      if (op.t === 'w') {
        var wr = vp.r - op.d[0], wc = vp.c - op.d[1];
        if (wr < 0 || wr >= R || wc < 0 || wc >= C || walls[wr][wc] || at(wr, wc) >= 0) return false;
        vp = { r: wr, c: wc };
      } else {
        var br = vp.r + op.d[0], bc = vp.c + op.d[1], bi = at(br, bc);
        if (bi < 0) return false;
        var dr = br + op.d[0], dc = bc + op.d[1];
        if (dr < 0 || dr >= R || dc < 0 || dc >= C || walls[dr][dc] || at(dr, dc) >= 0) return false;
        vBoxes[bi] = { r: dr, c: dc };
        vp = { r: br, c: bc };
      }
    }
    for (var j = 0; j < vBoxes.length; j++) {
      if (!targets[vBoxes[j].r][vBoxes[j].c]) return false;
    }
    return true;
  }

  /* 稳定兜底：按关卡序号变化的小型可解关（不会全部退化成同一关） */
  function fallbackLevel(idx) {
    var k = 1 + (idx % 3);
    var R = 5 + k, C = 9 + (idx % 2);
    var fw = [], ft = [];
    var r, c;
    for (r = 0; r < R; r++) {
      fw[r] = []; ft[r] = [];
      for (c = 0; c < C; c++) {
        fw[r][c] = (r === 0 || r === R - 1 || c === 0 || c === C - 1);
        ft[r][c] = false;
      }
    }
    var fBoxes = [];
    for (var j = 0; j < k; j++) {
      ft[2 + j][C - 5] = true;
      fBoxes.push({ r: 2 + j, c: C - 3 });
    }
    return {
      R: R, C: C, walls: fw, targets: ft,
      boxes: fBoxes, player: { r: 2, c: C - 2 }, sol: null, fallback: true
    };
  }
  /* GEN-END */

  /* 16–30 关：手工 ASCII 关卡（主题：走廊/双室/L形/十字/环形/窄门/对称/双通道/风车/钥匙孔/阶梯/棋盘/双环/闸门/迷宫）
     固定常量替代原程序生成，1–15 与 31–100 的生成结果保持不变。 */
  var HAND_LEVELS = {
    15: [
      '##############',
      '##.###.###.###',
      '#            #',
      '#@$ $ $ $ $ $#',
      '#            #',
      '####.###.###.#',
      '##############'
    ],
    16: [
      '###############',
      '##.#.#.########',
      '#      #      #',
      '#@$ $ $  $ $ $#',
      '#      #      #',
      '#########.#.#.#',
      '###############'
    ],
    17: [
      '##########',
      '####.#.#.#',
      '#        #',
      '# @ $ $ $#',
      '#        #',
      '#   ######',
      '# $ .#####',
      '#   ######',
      '# $ .#####',
      '#   ######',
      '# $ .#####',
      '##########'
    ],
    18: [
      '###########',
      '####   ####',
      '###. $ ####',
      '##.#.  ####',
      '#         #',
      '#@$ $ $ $ #',
      '#         #',
      '####  .#.##',
      '#### $ .###',
      '####   ####',
      '###########'
    ],
    19: [
      '###############',
      '#             #',
      '#@ $  $  $    #',
      '#  .  .  .    #',
      '#   #######   #',
      '#   #######.$ #',
      '#   #######   #',
      '#   #######   #',
      '#   #######.$ #',
      '#     .  .    #',
      '#     $  $    #',
      '#             #',
      '###############'
    ],
    20: [
      '###################',
      '##.#.#.#.##########',
      '#         #       #',
      '#@$ $ $ $   $ $ $ #',
      '#         #       #',
      '############.#.#.##',
      '###################'
    ],
    21: [
      '#############',
      '##### . #####',
      '##### $ #####',
      '##.#.   .#.##',
      '#     .     #',
      '#@$ $   $ $ #',
      '#     $     #',
      '#####   #####',
      '##### $ #####',
      '##### . #####',
      '#############'
    ],
    22: [
      '###########',
      '###.#.#.#.#',
      '#         #',
      '#@ $ $ $ $#',
      '#         #',
      '#   #######',
      '#   #######',
      '#         #',
      '#  $ $ $ $#',
      '#         #',
      '###.#.#.#.#',
      '###########'
    ],
    23: [
      '#############',
      '#####.###.###',
      '#           #',
      '#.$ @$   $  #',
      '#           #',
      '#   ##### $.#',
      '#.$ #####   #',
      '#           #',
      '#  $   $  $.#',
      '#           #',
      '###.###.#####',
      '#############'
    ],
    24: [
      '############',
      '###. . .#.##',
      '#          #',
      '#  $ $ $ $ #',
      '#@         #',
      '#  $ $ $ $ #',
      '#          #',
      '###.#.#.#.##',
      '############'
    ],
    25: [
      '#################',
      '###.#.#.#########',
      '#         #######',
      '#@ $ $ $  #######',
      '#     . . .######',
      '####         ####',
      '####  $ $ $  ####',
      '####         ####',
      '#######         #',
      '#######  $ $ $  #',
      '#######         #',
      '#########.#.#.###',
      '#################'
    ],
    26: [
      '####################',
      '##.###.###.###.###.#',
      '#                  #',
      '#@$ $ $ $ $ $ $ $ $#',
      '#                  #',
      '####.###.###.###.###',
      '####################'
    ],
    27: [
      '#####################',
      '#        ###        #',
      '#@ $     ### $  $   #',
      '#  .     ### .  .   #',
      '#.$ ##.$ ##.$  #.$  #',
      '#   ##         ###  #',
      '#   .    ###   .    #',
      '#   $    ###   $    #',
      '#        ###        #',
      '#####################'
    ],
    28: [
      '#######################',
      '##.#.#.#.##############',
      '#                     #',
      '#@$ $ $ $ ## $ $ $ $ $#',
      '#                     #',
      '#############.#.#.#.#.#',
      '#######################'
    ],
    29: [
      '#################',
      '####.#.#.########',
      '#              ##',
      '#@  $ $ $      ##',
      '#              ##',
      '#   ####.#.#.####',
      '#               #',
      '#       $ $ $   #',
      '#               #',
      '#   .#.#.########',
      '#               #',
      '#   $ $ $       #',
      '#               #',
      '#################',
      '#################'
    ]
  };

  /* 解析手工 ASCII：'#' 墙、' ' 地板、'.' 目标、'$' 箱、'@' 玩家、'*' 箱在目标、'+' 玩家在目标 */
  function parseHandMap(rows) {
    var R = rows.length, C = 0, r, c;
    for (r = 0; r < R; r++) if (rows[r].length > C) C = rows[r].length;
    var walls = [], targets = [], boxes = [], player = null;
    for (r = 0; r < R; r++) {
      walls[r] = []; targets[r] = [];
      for (c = 0; c < C; c++) {
        var ch = rows[r].charAt(c) || '#';
        walls[r][c] = ch === '#';
        targets[r][c] = ch === '.' || ch === '*' || ch === '+';
        if (ch === '$' || ch === '*') boxes.push({ r: r, c: c });
        if (ch === '@' || ch === '+') player = { r: r, c: c };
      }
    }
    return { R: R, C: C, walls: walls, targets: targets, boxes: boxes, player: player, sol: null, hand: true };
  }

  var levelCache = [];

  /* ---------------- DOM ---------------- */
  var wrap = document.createElement('div');
  wrap.className = 'sk-wrap';
  wrap.innerHTML =
    '<div class="sk-bar">' +
    '  <button class="sk-btn" id="sk-pause">' + T('gs.sokoban.pauseBtn') + '</button>' +
    '  <div class="sk-hud" id="sk-hud"></div>' +
    '  <button class="sk-btn" id="sk-menu">' + T('gs.sokoban.levelsBtn') + '</button>' +
    '</div>' +
    '<canvas id="sk-canvas" class="sk-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '<div class="sk-msg" id="sk-msg"></div>' +
    '<div class="sk-touch">' +
    '  <div id="sk-dpad"></div>' +
    '  <div class="sk-side">' +
    '    <button class="sk-btn tall" id="sk-undo">' + T('gs.sokoban.undoBtn') + '</button>' +
    '    <button class="sk-btn tall" id="sk-reset">' + T('gs.sokoban.restartLevel') + '</button>' +
    '  </div>' +
    '</div>' +
    '<p class="help-text">' + T('gs.sokoban.help') + '</p>' +
    '<div class="sk-overlay hidden" id="sk-levels">' +
    '  <div class="sk-panel">' +
    '    <div class="sk-panel-title">' + T('gs.sokoban.chooseLevel') + '</div>' +
    '    <div class="sk-lv-scroll"><div id="sk-lv-grid"></div></div>' +
    '    <button class="btn" id="sk-lv-close">' + T('gs.sokoban.closeBtn') + '</button>' +
    '  </div>' +
    '</div>' +
    '<div class="sk-overlay hidden" id="sk-result">' +
    '  <div class="sk-panel">' +
    '    <div class="sk-panel-title" id="sk-res-title"></div>' +
    '    <div class="sk-res-stats" id="sk-res-stats"></div>' +
    '    <div class="sk-res-btns" id="sk-res-btns"></div>' +
    '  </div>' +
    '</div>' +
    '<div class="sk-overlay hidden" id="sk-deadlock">' +
    '  <div class="sk-panel sk-deadlock-panel">' +
    '    <div class="sk-panel-title dead">' + T('gs.sokoban.deadlockTitle') + '</div>' +
    '    <div class="sk-res-stats" id="sk-dl-text"></div>' +
    '    <div class="sk-res-btns">' +
    '      <button class="btn yellow" id="sk-dl-undo">' + T('gs.sokoban.deadlockUndo') + '</button>' +
    '      <button class="btn pink" id="sk-dl-restart">' + T('gs.sokoban.deadlockRestart') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="sk-overlay hidden" id="sk-pause-ov">' +
    '  <div class="sk-panel">' +
    '    <div class="sk-panel-title">' + T('gs.sokoban.pausedTitle') + '</div>' +
    '    <div class="sk-res-btns">' +
    '      <button class="btn green" id="sk-resume">' + T('gs.sokoban.resumeBtn') + '</button>' +
    '      <button class="btn" id="sk-pause-menu">' + T('gs.sokoban.levelsBtn') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#sk-canvas');
  var g = GK.setup(canvas, W, H);
  var ctx = g.ctx;
  var hudEl = wrap.querySelector('#sk-hud');
  var msgEl = wrap.querySelector('#sk-msg');
  var pauseBtn = wrap.querySelector('#sk-pause');
  var menuBtn = wrap.querySelector('#sk-menu');
  var undoBtn = wrap.querySelector('#sk-undo');
  var resetBtn = wrap.querySelector('#sk-reset');
  var levelOv = wrap.querySelector('#sk-levels');
  var lvGrid = wrap.querySelector('#sk-lv-grid');
  var lvClose = wrap.querySelector('#sk-lv-close');
  var resultOv = wrap.querySelector('#sk-result');
  var resTitle = wrap.querySelector('#sk-res-title');
  var resStats = wrap.querySelector('#sk-res-stats');
  var resBtns = wrap.querySelector('#sk-res-btns');
  var pauseOv = wrap.querySelector('#sk-pause-ov');
  var resumeBtn = wrap.querySelector('#sk-resume');
  var pauseMenuBtn = wrap.querySelector('#sk-pause-menu');
  var deadlockOv = wrap.querySelector('#sk-deadlock');
  var deadlockText = wrap.querySelector('#sk-dl-text');
  var deadlockUndoBtn = wrap.querySelector('#sk-dl-undo');
  var deadlockRestartBtn = wrap.querySelector('#sk-dl-restart');

  /* ---------------- 状态 ---------------- */
  var li = 0, unlocked = 1, cleared = [], bestMs = [], totalSteps = 0, totalMs = 0;
  var walls = [], targets = [], boxes = [], player = null, R = 0, C = 0;
  var steps = 0, pushes = 0, history = [];
  var dir = 0; /* 0 上 1 右 2 下 3 左 */
  var over = false, paused = false, clearing = false, allDone = false;
  var deadlock = false, deadCells = [];
  var levelStart = 0, pausedMs = 0, pausedAt = 0;
  var anim = null, boxAnim = null, particles = [], ripples = [];
  var loopApi = null, lastHud = 0, hiddenAt = 0;

  /* ---------------- 关卡载入 ---------------- */
  function ensureLevel(i) {
    if (!levelCache[i]) {
      if (i >= 15 && i <= 29 && HAND_LEVELS[i]) levelCache[i] = parseHandMap(HAND_LEVELS[i]);
      else levelCache[i] = genLevel(i);
    }
    return levelCache[i];
  }

  function loadLevel(i, keepStats) {
    var data = ensureLevel(i);
    R = data.R; C = data.C; walls = data.walls; targets = data.targets;
    boxes = data.boxes.map(function (b) { return { r: b.r, c: b.c }; });
    player = { r: data.player.r, c: data.player.c };
    if (!keepStats) { steps = 0; pushes = 0; }
    history = [];
    dir = 0;
    anim = null; boxAnim = null; particles = []; ripples = [];
    clearing = false; paused = false; over = false; pausedMs = 0; levelStart = Date.now(); pausedAt = 0;
    clearDeadlock();
    msgEl.textContent = '';
    hideOverlays();
    updateHud();
    draw();
    writeSave();
  }

  /* ---------------- 游戏逻辑 ---------------- */
  function boxIndexAt(r, c) {
    for (var i = 0; i < boxes.length; i++) if (boxes[i].r === r && boxes[i].c === c) return i;
    return -1;
  }
  function isWall(r, c) { return r < 0 || c < 0 || r >= R || c >= C || walls[r][c]; }

  function snapshot() {
    return {
      player: { r: player.r, c: player.c },
      boxes: boxes.map(function (b) { return { r: b.r, c: b.c }; }),
      steps: steps, pushes: pushes, dir: dir
    };
  }
  function restore(s) {
    player = { r: s.player.r, c: s.player.c };
    boxes = s.boxes.map(function (b) { return { r: b.r, c: b.c }; });
    steps = s.steps; pushes = s.pushes; dir = s.dir;
  }

  function burstAt(r, c, color, count) {
    var p = cellCenter(r, c);
    GK.burst(canvas, p.x, p.y, color, count);
    for (var i = 0; i < count; i++) {
      particles.push({
        x: p.x, y: p.y,
        vx: (Math.random() - 0.5) * 4.2, vy: (Math.random() - 0.7) * 4.2,
        life: 1, color: color, size: 2 + Math.random() * 2.5
      });
    }
  }

  function move(dr, dc) {
    if (over || paused || clearing || deadlock || !player) return;
    if (!levelOv.classList.contains('hidden') || !resultOv.classList.contains('hidden') ||
        !pauseOv.classList.contains('hidden') || !deadlockOv.classList.contains('hidden')) return;
    dir = dr === -1 ? 0 : dc === 1 ? 1 : dr === 1 ? 2 : 3;
    var nr = player.r + dr, nc = player.c + dc;
    if (isWall(nr, nc)) {
      if (Arcade.audio) Arcade.audio.play('error');
      anim = { fromR: player.r, fromC: player.c, toR: player.r, toC: player.c, t0: Date.now(), dur: 90, bump: true };
      return;
    }
    var bi = boxIndexAt(nr, nc);
    var saved = snapshot();
    if (bi >= 0) {
      var br = nr + dr, bc = nc + dc;
      if (isWall(br, bc) || boxIndexAt(br, bc) >= 0) {
        if (Arcade.audio) Arcade.audio.play('error');
        anim = { fromR: player.r, fromC: player.c, toR: player.r, toC: player.c, t0: Date.now(), dur: 90, bump: true };
        return;
      }
      history.push(saved);
      var boxFrom = { r: nr, c: nc };
      boxes[bi].r = br; boxes[bi].c = bc;
      player = { r: nr, c: nc };
      steps++; pushes++;
      boxAnim = { fromR: boxFrom.r, fromC: boxFrom.c, toR: br, toC: bc, t0: Date.now(), dur: 140 };
      anim = { fromR: saved.player.r, fromC: saved.player.c, toR: nr, toC: nc, t0: Date.now(), dur: 140 };
      if (Arcade.audio) Arcade.audio.play('drop');
      burstAt(br, bc, 'rgba(200,168,106,0.95)', 7);
      if (targets[br][bc]) {
        /* 归位光效：绿色粒子 + 扩散波纹 */
        burstAt(br, bc, 'rgba(57,255,20,0.95)', 12);
        var gp = cellCenter(br, bc);
        ripples.push({ x: gp.x, y: gp.y, r: 4, max: 52, t: Date.now(), color: '57,255,20' });
        if (Arcade.audio) Arcade.audio.play('coin');
      }
    } else {
      history.push(saved);
      player = { r: nr, c: nc };
      steps++;
      anim = { fromR: saved.player.r, fromC: saved.player.c, toR: nr, toC: nc, t0: Date.now(), dur: 110 };
      if (Arcade.audio) Arcade.audio.play('move');
    }
    updateHud();
    writeSave();
    if (allOnTargets()) { levelClear(); return; }
    checkDeadlock();
  }

  function allOnTargets() {
    for (var i = 0; i < boxes.length; i++) if (!targets[boxes[i].r][boxes[i].c]) return false;
    return true;
  }

  /* ---------------- 静态死锁检测（墙角 / 贴墙线 / 冻结箱群 / 2×2 箱块） ---------------- */
  /* DL-BEGIN */
  /* 贴墙线：仅当箱子被限制在一条「无目标」的走廊内、且整条走廊无法垂直/水平脱离时才判死 */
  function wallLineDead(b, horizontal) {
    if (horizontal) {
      var l = b.c, rr = b.c, x;
      while (l - 1 >= 0 && !walls[b.r][l - 1]) l--;
      while (rr + 1 < C && !walls[b.r][rr + 1]) rr++;
      for (x = l; x <= rr; x++) {
        if (targets[b.r][x]) return false;
        /* 走廊内任一列若能上下推动（两侧均非墙），箱子就有机会脱离 */
        if (!walls[b.r - 1][x] && !walls[b.r + 1][x]) return false;
      }
      return true;
    }
    var t = b.r, bb = b.r, y;
    while (t - 1 >= 0 && !walls[t - 1][b.c]) t--;
    while (bb + 1 < R && !walls[bb + 1][b.c]) bb++;
    for (y = t; y <= bb; y++) {
      if (targets[y][b.c]) return false;
      if (!walls[y][b.c - 1] && !walls[y][b.c + 1]) return false;
    }
    return true;
  }
  function boxCanPush(b) {
    var ds = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var i = 0; i < 4; i++) {
      var dr = ds[i][0], dc = ds[i][1];
      var drr = b.r + dr, dcc = b.c + dc;
      if (isWall(drr, dcc) || boxIndexAt(drr, dcc) >= 0) continue;
      var brr = b.r - dr, bcc = b.c - dc;
      if (isWall(brr, bcc) || boxIndexAt(brr, bcc) >= 0) continue;
      return true;
    }
    return false;
  }

  function checkDeadlock() {
    if (deadlock) return true;
    var dead = [], seenCell = {};
    function mark(r, c) {
      var k = r + ',' + c;
      if (seenCell[k]) return;
      seenCell[k] = true;
      dead.push({ r: r, c: c });
    }
    var i, r, c;
    /* 1) 2×2 箱块：四箱彼此锁死，无法再被推动 */
    for (r = 0; r < R - 1; r++) {
      for (c = 0; c < C - 1; c++) {
        if (boxIndexAt(r, c) >= 0 && boxIndexAt(r, c + 1) >= 0 &&
            boxIndexAt(r + 1, c) >= 0 && boxIndexAt(r + 1, c + 1) >= 0) {
          if (!(targets[r][c] && targets[r][c + 1] && targets[r + 1][c] && targets[r + 1][c + 1])) {
            mark(r, c); mark(r, c + 1); mark(r + 1, c); mark(r + 1, c + 1);
          }
        }
      }
    }
    /* 2) 墙角 + 贴墙线（非目标且沿唯一可推轴没有目标） */
    for (i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (targets[b.r][b.c]) continue;
      var upW = isWall(b.r - 1, b.c), dnW = isWall(b.r + 1, b.c);
      var lfW = isWall(b.r, b.c - 1), rtW = isWall(b.r, b.c + 1);
      if ((upW || dnW) && (lfW || rtW)) { mark(b.r, b.c); continue; }
      if ((upW || dnW) && wallLineDead(b, true)) { mark(b.r, b.c); continue; }
      if ((lfW || rtW) && wallLineDead(b, false)) { mark(b.r, b.c); }
    }
    /* 3) 冻结箱群：四连通组内没有任何箱子可被推动 → 整组永久冻结 */
    var visited = [];
    for (i = 0; i < boxes.length; i++) visited[i] = false;
    for (i = 0; i < boxes.length; i++) {
      if (visited[i]) continue;
      var comp = [], queue = [i], movable = false, allGoal = true;
      visited[i] = true;
      while (queue.length) {
        var bi = queue.pop();
        comp.push(bi);
        if (boxCanPush(boxes[bi])) movable = true;
        if (!targets[boxes[bi].r][boxes[bi].c]) allGoal = false;
        for (var dj = 0; dj < 4; dj++) {
          var nb = boxIndexAt(boxes[bi].r + (dj === 0 ? -1 : dj === 1 ? 1 : 0),
                              boxes[bi].c + (dj === 2 ? -1 : dj === 3 ? 1 : 0));
          if (nb >= 0 && !visited[nb]) { visited[nb] = true; queue.push(nb); }
        }
      }
      if (!movable && !allGoal) {
        for (var ci = 0; ci < comp.length; ci++) {
          var cb = boxes[comp[ci]];
          if (!targets[cb.r][cb.c]) mark(cb.r, cb.c);
        }
      }
    }
    if (dead.length) {
      deadlock = true;
      deadCells = dead;
      deadlockText.innerHTML =
        '<span>' + T('gs.sokoban.deadlockBody') + '</span>' +
        '<span>' + T('gs.sokoban.deadlockHint') + '</span>';
      deadlockOv.classList.remove('hidden');
      if (Arcade.audio) Arcade.audio.play('error');
      return true;
    }
    deadCells = [];
    return false;
  }

  function clearDeadlock() {
    deadlock = false;
    deadCells = [];
    deadlockOv.classList.add('hidden');
  }
  /* DL-END */

  function undo() {
    if (over || paused || clearing) return;
    if (!history.length) {
      msgEl.textContent = T('gs.sokoban.msgUndoEmpty');
      msgEl.style.color = 'var(--text-dim)';
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    var curPlayer = { r: player.r, c: player.c };
    var s = history.pop();
    restore(s);
    dir = s.dir;
    anim = { fromR: curPlayer.r, fromC: curPlayer.c, toR: player.r, toC: player.c, t0: Date.now(), dur: 130 };
    boxAnim = null;
    msgEl.textContent = '';
    msgEl.style.color = '';
    if (Arcade.audio) Arcade.audio.play('back');
    updateHud();
    writeSave();
    checkDeadlock();
  }

  function restartLevel() {
    if (over) { allDone = false; }
    loadLevel(li, false);
    if (Arcade.audio) Arcade.audio.play('ui');
    msgEl.textContent = T('gs.sokoban.msgRestart');
    msgEl.style.color = 'var(--text-dim)';
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  function goLevel(i) {
    i = clamp(i, 0, TOTAL - 1);
    if (i + 1 > unlocked) {
      msgEl.textContent = T('gs.sokoban.msgLocked');
      msgEl.style.color = 'var(--neon-pink)';
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    li = i; allDone = false;
    loadLevel(li, false);
    if (Arcade.audio) Arcade.audio.play('ui');
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  function nextLevel() {
    if (clearing) return;
    if (cleared[li] === undefined) {
      msgEl.textContent = T('gs.sokoban.msgNotClear');
      msgEl.style.color = 'var(--neon-pink)';
      return;
    }
    if (li >= TOTAL - 1) {
      showAllResult();
      return;
    }
    if (li + 2 > unlocked) {
      msgEl.textContent = T('gs.sokoban.msgLocked');
      msgEl.style.color = 'var(--neon-pink)';
      return;
    }
    goLevel(li + 1);
  }

  function recomputeTotals() {
    totalSteps = 0; totalMs = 0;
    for (var i = 0; i < TOTAL; i++) {
      if (cleared[i] !== undefined) totalSteps += cleared[i];
      if (bestMs[i] !== undefined) totalMs += bestMs[i];
    }
  }

  function levelClear() {
    if (clearing) return;
    clearing = true;
    var lvSteps = steps;
    var lvPushes = pushes;
    var elapsed = Date.now() - levelStart - pausedMs;
    /* 每关各记最佳步数与最佳用时，总成绩 = 各关最佳之和（重玩不会虚增） */
    if (cleared[li] === undefined || lvSteps < cleared[li]) cleared[li] = lvSteps;
    if (bestMs[li] === undefined || elapsed < bestMs[li]) bestMs[li] = elapsed;
    recomputeTotals();
    unlocked = Math.max(unlocked, Math.min(TOTAL, li + 2));
    if (Arcade.juice) {
      var p = cellCenter(Math.floor(R / 2), Math.floor(C / 2));
      Arcade.juice.win(GK.toClient(canvas, p.x, p.y).x, GK.toClient(canvas, p.x, p.y).y);
    }
    var p2 = cellCenter(Math.floor(R / 2), Math.floor(C / 2));
    burstAt(Math.floor(R / 2), Math.floor(C / 2), '#ffe600', 26);
    ripples.push({ x: p2.x, y: p2.y, r: 6, max: 160, t: Date.now(), color: '255,230,0' });
    var completedAll = cleared.length > 0;
    for (var ci = 0; ci < TOTAL; ci++) {
      if (cleared[ci] === undefined) { completedAll = false; break; }
    }
    var isLast = li >= TOTAL - 1 && completedAll;
    if (isLast) allDone = true;
    /* 排行榜只在 100 关全部通关时提交一次：各关最佳步数之和（min 模式） */
    if (isLast && Arcade.shell) Arcade.shell.submitScore(totalSteps);
    writeSave();
    updateHud();
    setTimeout(function () { showResult(isLast, lvSteps, lvPushes, elapsed); }, 620);
  }

  function showResult(isLast, lvSteps, lvPushes, elapsed) {
    if (!clearing) return; /* 延迟展示期间若已重开/切关，丢弃过期结算 */
    resTitle.textContent = isLast ? T('gs.sokoban.allClear') : T('gs.sokoban.levelClear').replace('{n}', li + 1);
    resTitle.className = 'sk-panel-title ' + (isLast ? 'win' : '');
    if (isLast) {
      allDone = true;
      over = true;
      resStats.innerHTML =
        '<span>' + T('gs.sokoban.resFinal') + ' <b>' + totalSteps + '</b></span>' +
        '<span>' + T('gs.sokoban.resTotalTime') + ' <b>' + fmtTime(totalMs) + '</b></span>' +
        '<span>' + T('gs.sokoban.resCleared') + ' <b>' + TOTAL + '/' + TOTAL + '</b></span>' +
        '<span class="sk-res-note">' + T('gs.sokoban.resFinalNote') + '</span>';
      resBtns.innerHTML = '';
      addResultBtn('btn green', T('gs.sokoban.playAgain'), function () {
        li = 0; allDone = false; loadLevel(0, false);
      });
      addResultBtn('btn', T('gs.sokoban.levelsBtn'), function () { hideOverlays(); openLevels(); });
    } else {
      resStats.innerHTML =
        '<span>' + T('gs.sokoban.resSteps') + ' <b>' + lvSteps + '</b></span>' +
        '<span>' + T('gs.sokoban.resPushes') + ' <b>' + lvPushes + '</b></span>' +
        '<span>' + T('gs.sokoban.resTime') + ' <b>' + fmtTime(elapsed) + '</b></span>';
      resBtns.innerHTML = '';
      addResultBtn('btn green', T('gs.sokoban.nextBtn'), function () { hideOverlays(); nextLevel(); });
      addResultBtn('btn', T('gs.sokoban.replayBtn'), function () { hideOverlays(); loadLevel(li, false); });
      addResultBtn('btn', T('gs.sokoban.levelsBtn'), function () { hideOverlays(); openLevels(); });
    }
    resultOv.classList.remove('hidden');
    if (loopApi && loopApi.isRunning()) loopApi.pause();
  }

  function addResultBtn(cls, label, fn) {
    var b = document.createElement('button');
    b.className = cls; b.textContent = label;
    b.addEventListener('click', function () {
      hideOverlays();
      clearing = false;
      if (loopApi && !loopApi.isRunning()) loopApi.resume();
      fn();
      if (Arcade.audio) Arcade.audio.play('ui');
    });
    resBtns.appendChild(b);
  }

  function showAllResult() {
    hideOverlays();
    over = true;
    resultOv.classList.remove('hidden');
    resTitle.textContent = T('gs.sokoban.allClear');
    resTitle.className = 'sk-panel-title win';
    resStats.innerHTML =
      '<span>' + T('gs.sokoban.resFinal') + ' <b>' + totalSteps + '</b></span>' +
      '<span>' + T('gs.sokoban.resTotalTime') + ' <b>' + fmtTime(totalMs) + '</b></span>' +
      '<span>' + T('gs.sokoban.resCleared') + ' <b>' + TOTAL + '/' + TOTAL + '</b></span>' +
      '<span class="sk-res-note">' + T('gs.sokoban.resFinalNote') + '</span>';
    resBtns.innerHTML = '';
    addResultBtn('btn green', T('gs.sokoban.playAgain'), function () { li = 0; allDone = false; loadLevel(0, false); });
    addResultBtn('btn', T('gs.sokoban.levelsBtn'), function () { hideOverlays(); openLevels(); });
  }

  /* ---------------- 关卡选择（10 章 × 10 关，可滚动 5 列） ---------------- */
  function openLevels() {
    if (!levelOv.classList.contains('hidden') || clearing) return;
    if (loopApi && loopApi.isRunning()) loopApi.pause();
    buildLevelGrid();
    levelOv.classList.remove('hidden');
    var cur = lvGrid.querySelector('.sk-lvl.cur');
    if (cur && cur.scrollIntoView) {
      try { cur.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }
  function buildLevelGrid() {
    lvGrid.innerHTML = '';
    var per = Math.ceil(TOTAL / 10);
    for (var ch = 0; ch < 10; ch++) {
      var start = ch * per, end = Math.min(TOTAL, start + per);
      if (start >= TOTAL) break;
      var sec = document.createElement('div');
      sec.className = 'sk-chapter';
      var head = document.createElement('div');
      head.className = 'sk-chapter-title';
      head.textContent = T('gs.sokoban.chapterFmt')
        .replace('{n}', ch + 1)
        .replace('{a}', start + 1)
        .replace('{b}', end);
      sec.appendChild(head);
      var grid = document.createElement('div');
      grid.className = 'sk-lv-grid';
      for (var i = start; i < end; i++) {
        (function (idx) {
          var b = document.createElement('button');
          b.className = 'sk-lvl' + (idx < unlocked ? '' : ' locked') +
            (cleared[idx] !== undefined ? ' done' : '') + (idx === li ? ' cur' : '');
          b.setAttribute('aria-label', T('gs.sokoban.hudLevel').replace('{l}', idx + 1).replace('{t}', TOTAL));
          b.innerHTML = '<span class="sk-lvl-n">' + (idx + 1) + '</span>' +
            (idx < unlocked ? '' : '<span class="sk-lvl-lock" aria-hidden="true">×</span>') +
            (cleared[idx] !== undefined ? '<span class="sk-lvl-star">✓ ' + cleared[idx] + '</span>' : '');
          if (idx < unlocked) {
            b.addEventListener('click', function () {
              hideOverlays();
              if (loopApi && !loopApi.isRunning()) loopApi.resume();
              goLevel(idx);
            });
          }
          grid.appendChild(b);
        })(i);
      }
      sec.appendChild(grid);
      lvGrid.appendChild(sec);
    }
  }
  function hideOverlays() {
    levelOv.classList.add('hidden');
    resultOv.classList.add('hidden');
    pauseOv.classList.add('hidden');
  }

  /* ---------------- 暂停 ---------------- */
  function togglePause() {
    if (over || allDone || clearing || deadlock) return;
    paused = !paused;
    if (paused) {
      pausedAt = Date.now();
      pauseOv.classList.remove('hidden');
      if (loopApi) loopApi.pause();
    } else {
      pausedMs += Date.now() - pausedAt;
      pauseOv.classList.add('hidden');
      if (loopApi && !loopApi.isRunning()) loopApi.resume();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------------- HUD ---------------- */
  function updateHud() {
    var elapsed = levelStart ? (Date.now() - levelStart - pausedMs) : 0;
    hudEl.innerHTML =
      '<span>' + T('gs.sokoban.hudLevel').replace('{l}', li + 1).replace('{t}', TOTAL) + '</span>' +
      '<span>' + T('gs.sokoban.hudSteps') + ' <b>' + steps + '</b></span>' +
      '<span>' + T('gs.sokoban.hudPushes') + ' <b>' + pushes + '</b></span>' +
      '<span>' + T('gs.sokoban.hudTime') + ' <b>' + fmtTime(elapsed) + '</b></span>' +
      '<span>' + T('gs.sokoban.hudTotal') + ' <b>' + (totalSteps - (cleared[li] || 0) + steps) + '</b></span>';
  }

  /* ---------------- 绘制 ---------------- */
  function cellSize() {
    return Math.floor(Math.min((W - PAD * 2) / C, (H - PAD * 2) / R));
  }
  function origin() {
    var cs = cellSize();
    return { x: (W - C * cs) / 2, y: (H - R * cs) / 2, cs: cs };
  }
  function cellCenter(r, c) {
    var o = origin();
    return { x: o.x + c * o.cs + o.cs / 2, y: o.y + r * o.cs + o.cs / 2 };
  }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function animPos(a, now) {
    if (!a) return null;
    var t = Math.min(1, (now - a.t0) / a.dur);
    if (a.fromR === a.toR && a.fromC === a.toC) t = 1;
    var e = easeOut(t);
    var bump = a.bump ? Math.sin(t * Math.PI) : 0;
    return {
      r: a.fromR + (a.toR - a.fromR) * e - 0,
      c: a.fromC + (a.toC - a.fromC) * e,
      t: t,
      bump: bump
    };
  }

  function drawBackground() {
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#070b16');
    bg.addColorStop(0.55, '#0a0f1e');
    bg.addColorStop(1, '#0c0817');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    glow.addColorStop(0, 'rgba(0,240,255,0.055)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  function drawFloor(r, c, cs, ox, oy) {
    var x = ox + c * cs, y = oy + r * cs;
    var grad = ctx.createLinearGradient(x, y, x, y + cs);
    grad.addColorStop(0, 'rgba(30,44,66,0.55)');
    grad.addColorStop(1, 'rgba(16,24,40,0.7)');
    ctx.fillStyle = grad;
    GK.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,240,255,0.07)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
  }

  function drawWall(r, c, cs, ox, oy) {
    var x = ox + c * cs, y = oy + r * cs;
    var grad = ctx.createLinearGradient(x, y, x, y + cs);
    grad.addColorStop(0, '#3a475f');
    grad.addColorStop(0.5, '#263246');
    grad.addColorStop(1, '#151d2c');
    ctx.fillStyle = grad;
    GK.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, 4);
    ctx.fill();
    /* 砖纹 */
    ctx.save();
    GK.roundRect(ctx, x + 2, y + 2, cs - 4, cs - 4, 4);
    ctx.clip();
    ctx.strokeStyle = 'rgba(8,12,20,0.75)';
    ctx.lineWidth = 1.5;
    var rows = 3;
    for (var i = 1; i < rows; i++) {
      var yy = y + (cs / rows) * i;
      ctx.beginPath(); ctx.moveTo(x + 2, yy); ctx.lineTo(x + cs - 2, yy); ctx.stroke();
    }
    for (var j = 0; j < rows; j++) {
      var off = (j % 2) * (cs / 4);
      for (var k = 0; k < 2; k++) {
        var xx = x + cs / 2 + (k === 0 ? -cs / 4 : cs / 4) + off - cs / 4;
        if (xx < x + 4 || xx > x + cs - 4) continue;
        ctx.beginPath(); ctx.moveTo(xx, y + j * (cs / rows)); ctx.lineTo(xx, y + (j + 1) * (cs / rows)); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(140,175,220,0.22)';
    ctx.lineWidth = 1;
    GK.roundRect(ctx, x + 1.5, y + 1.5, cs - 3, cs - 3, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + 3, y + 3, cs - 6, 2);
  }

  function drawTarget(r, c, cs, ox, oy, now) {
    var cx = ox + c * cs + cs / 2, cy = oy + r * cs + cs / 2;
    var pulse = 0.5 + 0.5 * Math.sin(now / 320 + r * 0.8 + c * 0.6);
    var rad = cs * (0.18 + 0.05 * pulse);
    ctx.save();
    ctx.shadowColor = 'rgba(255,230,0,0.85)';
    ctx.shadowBlur = 12 + pulse * 8;
    ctx.fillStyle = 'rgba(255,230,0,' + (0.28 + 0.25 * pulse) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,' + (0.55 + 0.35 * pulse) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 4 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    /* 四角标记 */
    ctx.strokeStyle = 'rgba(255,245,150,0.7)';
    ctx.lineWidth = 1.5;
    for (var i = 0; i < 4; i++) {
      var ang = Math.PI / 2 * i + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (rad + 7), cy + Math.sin(ang) * (rad + 7));
      ctx.lineTo(cx + Math.cos(ang) * (rad + 11), cy + Math.sin(ang) * (rad + 11));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBox(rr, cc, cs, ox, oy, done, pop) {
    var x = ox + cc * cs, y = oy + rr * cs;
    var pad = Math.max(3, cs * 0.09);
    var s = 1 + (pop || 0) * 0.06;
    ctx.save();
    ctx.translate(x + cs / 2, y + cs / 2);
    ctx.scale(s, s);
    ctx.translate(-(x + cs / 2), -(y + cs / 2));
    /* 阴影 */
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    GK.roundRect(ctx, x + pad + 3, y + pad + 4, cs - pad * 2, cs - pad * 2, 7);
    ctx.fill();
    var wg = ctx.createLinearGradient(x, y, x + cs, y + cs);
    if (done) {
      wg.addColorStop(0, '#9cf07a'); wg.addColorStop(0.45, '#4fd65c'); wg.addColorStop(1, '#1c8f43');
    } else {
      wg.addColorStop(0, '#e0b76f'); wg.addColorStop(0.42, '#b9833f'); wg.addColorStop(1, '#7a4f22');
    }
    ctx.fillStyle = wg;
    GK.roundRect(ctx, x + pad, y + pad, cs - pad * 2, cs - pad * 2, 7);
    ctx.fill();
    /* 木纹 */
    ctx.strokeStyle = 'rgba(90,55,20,0.55)';
    ctx.lineWidth = Math.max(1, cs * 0.035);
    ctx.beginPath();
    ctx.moveTo(x + pad + 3, y + cs * 0.42);
    ctx.lineTo(x + cs - pad - 3, y + cs * 0.42);
    ctx.moveTo(x + pad + 3, y + cs * 0.62);
    ctx.lineTo(x + cs - pad - 3, y + cs * 0.62);
    ctx.stroke();
    /* 交叉板条 */
    ctx.strokeStyle = done ? 'rgba(220,255,210,0.5)' : 'rgba(255,220,160,0.35)';
    ctx.lineWidth = Math.max(1.5, cs * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + pad + 4, y + pad + 4);
    ctx.lineTo(x + cs - pad - 4, y + cs - pad - 4);
    ctx.moveTo(x + cs - pad - 4, y + pad + 4);
    ctx.lineTo(x + pad + 4, y + cs - pad - 4);
    ctx.stroke();
    /* 描边 + 高光 */
    ctx.strokeStyle = done ? 'rgba(180,255,180,0.9)' : 'rgba(255,214,150,0.7)';
    ctx.lineWidth = 1.5;
    GK.roundRect(ctx, x + pad, y + pad, cs - pad * 2, cs - pad * 2, 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + pad + 3, y + pad + 3, cs - pad * 2 - 6, Math.max(2, cs * 0.06));
    if (done) {
      ctx.save();
      ctx.shadowColor = 'rgba(57,255,20,0.9)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(220,255,220,0.95)';
      ctx.lineWidth = 2;
      var cx = x + cs / 2, cy = y + cs / 2;
      ctx.beginPath();
      ctx.moveTo(cx - cs * 0.13, cy);
      ctx.lineTo(cx - cs * 0.02, cy + cs * 0.12);
      ctx.lineTo(cx + cs * 0.16, cy - cs * 0.12);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPlayer(rr, cc, cs, ox, oy, now, moving) {
    var x = ox + cc * cs, y = oy + rr * cs;
    var cx = x + cs / 2, cy = y + cs / 2;
    var bob = Math.sin(now / 260) * (moving ? 1.5 : 0.8);
    var bodyW = cs * 0.46, bodyH = cs * 0.5;
    /* 阴影 */
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, y + cs * 0.86, cs * 0.22, cs * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    /* 身体 */
    var bg = ctx.createLinearGradient(cx, cy - bodyH / 2, cx, cy + bodyH / 2);
    bg.addColorStop(0, '#8fe9ff');
    bg.addColorStop(0.5, '#22b8e6');
    bg.addColorStop(1, '#0d5f93');
    ctx.save();
    ctx.shadowColor = 'rgba(0,240,255,0.85)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = bg;
    GK.roundRect(ctx, cx - bodyW / 2, cy - bodyH / 2 + bob, bodyW, bodyH, bodyW * 0.28);
    ctx.fill();
    ctx.restore();
    /* 头盔 */
    ctx.fillStyle = '#d7fbff';
    ctx.beginPath();
    ctx.arc(cx, cy - bodyH * 0.12 + bob, bodyW * 0.36, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e7fb1';
    ctx.fillRect(cx - bodyW * 0.36, cy - bodyH * 0.12 + bob, bodyW * 0.72, bodyW * 0.1);
    /* 眼睛（朝向） */
    var ex = dir === 3 ? -1 : dir === 1 ? 1 : 0;
    var ey = dir === 0 ? -1 : dir === 2 ? 1 : 0;
    ctx.fillStyle = '#052033';
    var eyeY = cy + bodyH * 0.02 + bob;
    ctx.beginPath();
    ctx.arc(cx - bodyW * 0.14 + ex * 2, eyeY + ey * 1.5, bodyW * 0.075, 0, Math.PI * 2);
    ctx.arc(cx + bodyW * 0.14 + ex * 2, eyeY + ey * 1.5, bodyW * 0.075, 0, Math.PI * 2);
    ctx.fill();
    /* 脚 */
    ctx.fillStyle = '#062235';
    ctx.fillRect(cx - bodyW * 0.36, cy + bodyH / 2 + bob - 2, bodyW * 0.26, Math.max(2, cs * 0.07));
    ctx.fillRect(cx + bodyW * 0.1, cy + bodyH / 2 + bob - 2, bodyW * 0.26, Math.max(2, cs * 0.07));
    /* 朝向小箭头 */
    ctx.save();
    ctx.fillStyle = 'rgba(0,240,255,0.55)';
    var ax = cx + ex * (bodyW * 0.9), ay = cy + ey * (bodyH * 0.75) + bob;
    ctx.beginPath();
    if (dir === 1) { ctx.moveTo(ax + 6, ay); ctx.lineTo(ax - 2, ay - 4); ctx.lineTo(ax - 2, ay + 4); }
    else if (dir === 3) { ctx.moveTo(ax - 6, ay); ctx.lineTo(ax + 2, ay - 4); ctx.lineTo(ax + 2, ay + 4); }
    else if (dir === 0) { ctx.moveTo(ax, ay - 6); ctx.lineTo(ax - 4, ay + 2); ctx.lineTo(ax + 4, ay + 2); }
    else { ctx.moveTo(ax, ay + 6); ctx.lineTo(ax - 4, ay - 2); ctx.lineTo(ax + 4, ay - 2); }
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    now = now || Date.now();
    drawBackground();
    var o = origin(), cs = o.cs, ox = o.x, oy = o.y;
    /* 地面 */
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      if (!walls[r][c]) drawFloor(r, c, cs, ox, oy);
    }
    /* 目标 */
    for (var tr = 0; tr < R; tr++) for (var tc = 0; tc < C; tc++) {
      if (targets[tr][tc]) drawTarget(tr, tc, cs, ox, oy, now);
    }
    /* 墙体 */
    for (var wr = 0; wr < R; wr++) for (var wc = 0; wc < C; wc++) {
      if (walls[wr][wc]) drawWall(wr, wc, cs, ox, oy);
    }
    /* 箱子归位光晕 */
    for (var gi = 0; gi < boxes.length; gi++) {
      var gb = boxes[gi];
      if (!targets[gb.r][gb.c]) continue;
      var gp = cellCenter(gb.r, gb.c);
      var gPulse = 0.5 + 0.5 * Math.sin(now / 300 + gi * 0.7);
      var grad = ctx.createRadialGradient(gp.x, gp.y, 1, gp.x, gp.y, cs * 0.72);
      grad.addColorStop(0, 'rgba(57,255,20,' + (0.22 + 0.16 * gPulse) + ')');
      grad.addColorStop(0.55, 'rgba(57,255,20,' + (0.07 + 0.05 * gPulse) + ')');
      grad.addColorStop(1, 'rgba(57,255,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, cs * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    /* 箱子 */
    for (var bi = 0; bi < boxes.length; bi++) {
      var b = boxes[bi];
      var br = b.r, bc = b.c, pop = 0;
      if (boxAnim && boxAnim.toR === b.r && boxAnim.toC === b.c) {
        var ap = animPos({ fromR: boxAnim.fromR, fromC: boxAnim.fromC, toR: boxAnim.toR, toC: boxAnim.toC, t0: boxAnim.t0, dur: boxAnim.dur }, now);
        br = ap.r; bc = ap.c;
        pop = Math.sin(ap.t * Math.PI) * 0.5;
      }
      drawBox(br, bc, cs, ox, oy, targets[b.r][b.c], pop);
    }
    /* 死锁红色警示脉冲 */
    if (deadlock && deadCells.length) {
      var dp = 0.5 + 0.5 * Math.sin(now / 150);
      for (var di = 0; di < deadCells.length; di++) {
        var dc = deadCells[di];
        var dx = ox + dc.c * cs, dy = oy + dc.r * cs;
        ctx.save();
        ctx.shadowColor = 'rgba(255,40,80,0.95)';
        ctx.shadowBlur = 10 + dp * 12;
        ctx.fillStyle = 'rgba(255,40,80,' + (0.10 + 0.12 * dp) + ')';
        GK.roundRect(ctx, dx + 1, dy + 1, cs - 2, cs - 2, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,77,109,' + (0.55 + 0.4 * dp) + ')';
        ctx.lineWidth = 2.5;
        GK.roundRect(ctx, dx + 2, dy + 2, cs - 4, cs - 4, 5);
        ctx.stroke();
        ctx.restore();
      }
    }
    /* 玩家 */
    var pr = player.r, pc = player.c, moving = false;
    if (anim) {
      var pa = animPos({ fromR: anim.fromR, fromC: anim.fromC, toR: anim.toR, toC: anim.toC, t0: anim.t0, dur: anim.dur, bump: anim.bump }, now);
      pr = pa.r; pc = pa.c;
      moving = pa.t < 1;
    }
    drawPlayer(pr, pc, cs, ox, oy, now, moving);
    /* 粒子 */
    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pt = particles[pi];
      if (pt.life <= 0) { particles.splice(pi, 1); continue; }
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* 波纹 */
    for (var ri = ripples.length - 1; ri >= 0; ri--) {
      var rp = ripples[ri];
      var tt = (now - rp.t) / 900;
      if (tt >= 1) { ripples.splice(ri, 1); continue; }
      ctx.strokeStyle = 'rgba(' + (rp.color || '255,230,0') + ',' + (0.55 * (1 - tt)) + ')';
      ctx.lineWidth = 3 * (1 - tt) + 0.5;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r + rp.max * tt, 0, Math.PI * 2);
      ctx.stroke();
    }
    /* 死角提示光 */
    if (msgEl.textContent && !over) {
      /* 文字已在 DOM，不重复绘制 */
    }
  }

  /* ---------------- 更新 ---------------- */
  function update() {
    if (paused || over) return;
    var now = Date.now();
    if (now - lastHud > 250) { updateHud(); lastHud = now; }
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.022;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (anim && now - anim.t0 > anim.dur) anim = null;
    if (boxAnim && now - boxAnim.t0 > boxAnim.dur) boxAnim = null;
  }

  /* ---------------- 存档 ---------------- */
  var restoring = false;
  function writeSave() {
    if (restoring) return;
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
  }
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'sokoban',
      collect: function () {
        var elapsed = levelStart ? Date.now() - levelStart - pausedMs : 0;
        return {
          v: 3,
          level: li, unlocked: unlocked, cleared: cleared.slice(), bestMs: bestMs.slice(),
          total: totalSteps, totalMs: totalMs,
          allDone: allDone,
          steps: steps, pushes: pushes, dir: dir,
          player: player ? { r: player.r, c: player.c } : null,
          boxes: boxes.map(function (b) { return { r: b.r, c: b.c }; }),
          elapsed: elapsed
        };
      },
      apply: function (s) {
        if (!s) return false;
        var idx = Number(s.level);
        if (!isFinite(idx)) return false;
        li = clamp(Math.floor(idx), 0, TOTAL - 1);
        unlocked = clamp(Math.floor(Number(s.unlocked) || 1), 1, TOTAL);
        cleared = [];
        for (var ci = 0; ci < TOTAL; ci++) cleared[ci] = undefined;
        if (Array.isArray(s.cleared)) {
          for (var cj = 0; cj < TOTAL; cj++) {
            var raw = s.cleared[cj];
            if (typeof raw === 'number' && isFinite(raw) && raw >= 0) cleared[cj] = raw;
          }
        }
        totalSteps = 0;
        totalMs = 0;
        bestMs = [];
        if (Array.isArray(s.bestMs)) {
          for (var mi = 0; mi < TOTAL; mi++) {
            var rm = s.bestMs[mi];
            if (typeof rm === 'number' && isFinite(rm) && rm >= 0) bestMs[mi] = rm;
          }
        }
        /* 兼容 v2：若旧档没有 cleared 明细，仍保留旧 total（至少不丢进度） */
        recomputeTotals();
        if (totalSteps === 0 && isFinite(Number(s.total)) && Number(s.total) > 0) {
          totalSteps = Math.max(0, Number(s.total));
        }
        var clearedCount = 0;
        for (var cc = 0; cc < TOTAL; cc++) if (cleared[cc] !== undefined) clearedCount++;
        /* 旧 v2 的第 15 关通关后应能继续进入新增的第 16 关 */
        for (var ci2 = 0; ci2 < TOTAL; ci2++) {
          if (cleared[ci2] !== undefined) unlocked = Math.max(unlocked, Math.min(TOTAL, ci2 + 2));
        }
        /* 旧 v2 仅 15 关的 allDone 不能视为 100 关通关 */
        allDone = !!s.allDone && clearedCount >= TOTAL;
        /* 恢复期间禁止写入，避免用初始局面覆盖刚读到的存档 */
        restoring = true;
        loadLevel(li, true);
        steps = Math.max(0, Number(s.steps) || 0);
        pushes = Math.max(0, Number(s.pushes) || 0);
        dir = clamp(Math.floor(Number(s.dir) || 0), 0, 3);
        var el = Math.max(0, Number(s.elapsed) || 0);
        levelStart = Date.now() - el;
        pausedMs = 0;
        history = [];
        if (Array.isArray(s.boxes) && !(levelCache[li] && levelCache[li].hand) && s.boxes.length === boxes.length) {
          var ok = true;
          for (var bi = 0; bi < s.boxes.length; bi++) {
            var bx = s.boxes[bi];
            if (!bx || !isFinite(bx.r) || !isFinite(bx.c) || isWall(Number(bx.r), Number(bx.c))) { ok = false; break; }
            boxes[bi] = { r: Number(bx.r), c: Number(bx.c) };
          }
          if (ok && s.player && isFinite(s.player.r) && isFinite(s.player.c) && !isWall(Number(s.player.r), Number(s.player.c))) {
            player = { r: Number(s.player.r), c: Number(s.player.c) };
          }
        }
        updateHud();
        checkDeadlock();
        restoring = false;
        writeSave();
        if (allDone) setTimeout(showAllResult, 300);
        return true;
      }
    });
  }

  /* ---------------- 输入 ---------------- */
  Arcade.input.onKeys({
    up: function () { move(-1, 0); },
    down: function () { move(1, 0); },
    left: function () { move(0, -1); },
    right: function () { move(0, 1); },
    action: function () { if (!levelOv.classList.contains('hidden')) return; }
  });
  Arcade.input.onSwipe(canvas, function (d) {
    if (d === 'up') move(-1, 0);
    else if (d === 'down') move(1, 0);
    else if (d === 'left') move(0, -1);
    else if (d === 'right') move(0, 1);
  });
  /* 方向键同时支持触控与鼠标点击 */
  Arcade.input.createDPad(wrap.querySelector('#sk-dpad'), function (d, pressed) {
    if (!pressed) return;
    if (d === 'up') move(-1, 0);
    else if (d === 'down') move(1, 0);
    else if (d === 'left') move(0, -1);
    else if (d === 'right') move(0, 1);
  });
  /* 鼠标点击画布：朝点击格子的方向移动一步 */
  canvas.addEventListener('pointerup', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (over || paused || clearing || deadlock || !player) return;
    var pt = GK.pointer(canvas, e);
    var o = origin();
    var cr = Math.floor((pt.y - o.y) / o.cs), cc = Math.floor((pt.x - o.x) / o.cs);
    if (cr < 0 || cr >= R || cc < 0 || cc >= C) return;
    var ddr = cr - player.r, ddc = cc - player.c;
    if (!ddr && !ddc) return;
    if (Math.abs(ddr) >= Math.abs(ddc)) move(ddr > 0 ? 1 : -1, 0);
    else move(0, ddc > 0 ? 1 : -1);
  });

  document.addEventListener('keydown', function (e) {
    /* 选关/结算/无解遮罩打开时忽略键盘，避免操作穿透遮罩 */
    if (!levelOv.classList.contains('hidden') || !resultOv.classList.contains('hidden') ||
        !deadlockOv.classList.contains('hidden')) return;
    if (e.code === 'KeyZ' || e.code === 'KeyU') { e.preventDefault(); undo(); }
    else if (e.code === 'KeyR') { e.preventDefault(); restartLevel(); }
    else if (e.code === 'KeyN') { e.preventDefault(); nextLevel(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); }
  });

  undoBtn.addEventListener('click', undo);
  resetBtn.addEventListener('click', restartLevel);
  pauseBtn.addEventListener('click', togglePause);
  menuBtn.addEventListener('click', openLevels);
  deadlockUndoBtn.addEventListener('click', function () {
    clearDeadlock();
    if (Arcade.audio) Arcade.audio.play('ui');
    if (history.length) undo();
    else restartLevel();
  });
  deadlockRestartBtn.addEventListener('click', function () {
    clearDeadlock();
    restartLevel();
  });
  lvClose.addEventListener('click', function () {
    hideOverlays();
    /* 全部通关结算页进入选关后直接返回，应回到结算页而不是空场 */
    if (over && allDone) { showAllResult(); return; }
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  resumeBtn.addEventListener('click', togglePause);
  pauseMenuBtn.addEventListener('click', function () {
    if (paused) { paused = false; pausedMs += Date.now() - pausedAt; }
    hideOverlays();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    openLevels();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt) { pausedMs += Date.now() - hiddenAt; hiddenAt = 0; }
  });

  window.GAME_RESTART = function () {
    hideOverlays();
    restartLevel();
  };

  /* ---------------- 启动 ---------------- */
  ensureLevel(0);
  var resumed = false;
  if (window.Arcade && Arcade.savegame) {
    try { resumed = Arcade.savegame.resume(); } catch (e) { resumed = false; }
  }
  if (!resumed) loadLevel(0, false);
  loopApi = Arcade.loop.start(update, draw, 16);

  /* helpText 附加说明 */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.sokoban.helpText');
  root.appendChild(hd);

})();
