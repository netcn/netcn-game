/* ============================================================
   弹珠消消 Ball Pop · 球阵消除旗舰
   六角球阵自上而下压顶推进：瞄准发射同色球，三连及以上消除，
   悬空球整片脱落；炸弹/闪电/减速特殊球、成对传送门、12 关目标
   与多阶段 Boss 战。核心判定（六角邻接 / 连消 / 悬空 / 落点 /
   反弹预测）用 ==ZUMA-CORE-START== / ==ZUMA-CORE-END== 标记包裹，
   纯函数可测。
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.ballpop.tut1t'), d: T('gs.ballpop.tut1') },
  { t: T('gs.ballpop.tut2t'), d: T('gs.ballpop.tut2') },
  { t: T('gs.ballpop.tut3t'), d: T('gs.ballpop.tut3') },
  { t: T('gs.ballpop.tut4t'), d: T('gs.ballpop.tut4') },
  { t: T('gs.ballpop.tut5t'), d: T('gs.ballpop.tut5') },
  { t: T('gs.ballpop.tut6t'), d: T('gs.ballpop.tut6') }
];

(function () {
  /* ==ZUMA-CORE-START== */
  var CORE = (function () {
    var R = 19, ROW_H = 33, TOP = 6, W = 400, H = 560, DANGER_Y = 470;
    var PORTAL_R = 19;

    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    function colsFor(off) { return off ? 9 : 10; }
    function cellX(off, col) { return R + 2 * R * col + (off ? R : 0); }
    function cellPos(row, off, col, topOff) {
      return { x: cellX(off, col), y: TOP + (topOff || 0) + R + row * ROW_H };
    }
    function makeCell(c, k) { return { c: c, k: k || 0 }; }
    function cellAt(rows, r, c) {
      var row = rows[r];
      return (row && c >= 0 && c < row.cells.length) ? row.cells[c] : null;
    }

    /* 六角邻接：同行左右 + 上下两行中水平偏移恰为 R 的格 */
    function neighbors(rows, r, c) {
      var out = [];
      var row = rows[r];
      if (!row) return out;
      if (c > 0) out.push([r, c - 1]);
      if (c + 1 < row.cells.length) out.push([r, c + 1]);
      var x = cellX(row.off, c);
      var adj = [r - 1, r + 1];
      for (var k = 0; k < 2; k++) {
        var ar = rows[adj[k]];
        if (!ar) continue;
        for (var cc = 0; cc < ar.cells.length; cc++) {
          if (Math.abs(cellX(ar.off, cc) - x) < R * 1.02) out.push([adj[k], cc]);
        }
      }
      return out;
    }

    /* 同色连通块（含自身），特殊球按基础颜色归类 */
    function groupAt(rows, r, c) {
      var row = rows[r];
      if (!row || row.cells[c] == null) return [];
      var color = row.cells[c].c, seen = {}, out = [], stack = [[r, c]];
      while (stack.length) {
        var cur = stack.pop(), rr = cur[0], cc = cur[1];
        var key = rr + ',' + cc;
        if (seen[key]) continue;
        seen[key] = 1;
        var rw = rows[rr];
        if (!rw || rw.cells[cc] == null || rw.cells[cc].c !== color) continue;
        out.push(cur);
        var nbs = neighbors(rows, rr, cc);
        for (var i = 0; i < nbs.length; i++) {
          if (!seen[nbs[i][0] + ',' + nbs[i][1]]) stack.push(nbs[i]);
        }
      }
      return out;
    }

    /* 与顶行不连通的球（悬空球） */
    function floating(rows) {
      var seen = {}, stack = [];
      if (rows[0]) {
        for (var i = 0; i < rows[0].cells.length; i++) {
          if (rows[0].cells[i] != null) stack.push([0, i]);
        }
      }
      while (stack.length) {
        var cur = stack.pop(), key = cur[0] + ',' + cur[1];
        if (seen[key]) continue;
        var rw = rows[cur[0]];
        if (!rw || rw.cells[cur[1]] == null) continue;
        seen[key] = 1;
        var nbs = neighbors(rows, cur[0], cur[1]);
        for (var k = 0; k < nbs.length; k++) {
          if (!seen[nbs[k][0] + ',' + nbs[k][1]]) stack.push(nbs[k]);
        }
      }
      var out = [];
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < rows[r].cells.length; c++) {
          if (rows[r].cells[c] != null && !seen[r + ',' + c]) out.push([r, c]);
        }
      }
      return out;
    }

    /* 初始球阵：保证开局不存在 3 连 */
    function genBoard(rowsCount, colorCount, rng) {
      var rows = [];
      for (var r = 0; r < rowsCount; r++) {
        var off = r % 2, cells = [];
        rows.push({ off: off, cells: cells });
        for (var c = 0; c < colsFor(off); c++) {
          var color = 0, ok = false, tries = 0;
          while (!ok && tries < 24) {
            tries++;
            color = Math.floor(rng() * colorCount);
            cells.push(makeCell(color, 0));
            if (groupAt(rows, r, c).length >= 3) cells.pop();
            else ok = true;
          }
          if (!ok) cells.push(makeCell(Math.floor(rng() * colorCount), 0));
        }
      }
      ensureEmptyTail(rows);
      return rows;
    }

    /* 尾部预留下探空行，保证贴底命中也有合法落点 */
    function ensureEmptyTail(rows) {
      var lastFilled = -1;
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < rows[r].cells.length; c++) {
          if (rows[r].cells[c] != null) { lastFilled = r; break; }
        }
      }
      var target = lastFilled + 3;
      while (rows.length < target) {
        var off = rows.length ? (1 - rows[rows.length - 1].off) : 0;
        var cells = [];
        for (var k = 0; k < colsFor(off); k++) cells.push(null);
        rows.push({ off: off, cells: cells });
      }
      return rows;
    }

    /* 压顶：顶部插入一整行（偏移与当前顶行相反，保持六角互锁） */
    function pressRow(rows, rng, colorCount) {
      var off = rows.length ? (1 - rows[0].off) : 0;
      var cells = [];
      for (var c = 0; c < colsFor(off); c++) cells.push(makeCell(Math.floor(rng() * colorCount), 0));
      rows.unshift({ off: off, cells: cells });
      return off;
    }

    function boardCount(rows) {
      var n = 0;
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < rows[r].cells.length; c++) if (rows[r].cells[c] != null) n++;
      }
      return n;
    }

    function bottomEdge(rows, topOff) {
      for (var r = rows.length - 1; r >= 0; r--) {
        for (var c = 0; c < rows[r].cells.length; c++) {
          if (rows[r].cells[c] != null) return TOP + (topOff || 0) + R + r * ROW_H + R;
        }
      }
      return TOP + (topOff || 0);
    }

    function hitTest(rows, x, y, thresh, topOff) {
      var t = thresh || (2 * R - 3), t2 = t * t;
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        for (var c = 0; c < row.cells.length; c++) {
          if (row.cells[c] == null) continue;
          var p = cellPos(r, row.off, c);
          var dx = x - p.x, dy = y - (p.y + (topOff || 0));
          if (dx * dx + dy * dy <= t2) return { row: r, col: c, x: p.x, y: p.y + (topOff || 0) };
        }
      }
      return null;
    }

    /* 命中后落点：命中球周围最近的空格（无则退化为全局最近空格） */
    function snapCell(rows, hitR, hitC, sx, sy, topOff) {
      var best = null, bd = Infinity;
      function consider(r, c, needAdj) {
        var row = rows[r];
        if (!row || c < 0 || c >= row.cells.length) return;
        if (row.cells[c] != null) return;
        if (needAdj) {
          var nbs0 = neighbors(rows, r, c), has = false;
          for (var q = 0; q < nbs0.length; q++) {
            var nr = rows[nbs0[q][0]];
            if (nr && nr.cells[nbs0[q][1]] != null) { has = true; break; }
          }
          if (!has) return;
        }
        var p = cellPos(r, row.off, c);
        var d = Math.hypot(p.x - sx, (p.y + (topOff || 0)) - sy);
        if (d < bd) { bd = d; best = { row: r, col: c }; }
      }
      if (!rows[hitR]) return null;
      var nbs = neighbors(rows, hitR, hitC);
      for (var i = 0; i < nbs.length; i++) consider(nbs[i][0], nbs[i][1], false);
      if (best && bd <= R * 2.4) return best;
      best = null; bd = Infinity;
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < rows[r].cells.length; c++) consider(r, c, true);
      }
      return (best && bd <= R * 2.7) ? best : null;
    }

    /* 瞄准模拟：左右墙反弹 + 传送门折跃 + 首个命中格 + 轨迹采样点 */
    function aimTrace(rows, sx, sy, ang, portals, topOff) {
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var x = sx, y = sy, dots = [], bounces = [], hit = null;
      var step = 6, travel = 0, bounced = 0, jumps = 0;
      dots.push({ x: x, y: y });
      while (travel < 1150) {
        x += dx * step; y += dy * step; travel += step;
        if (x < R) { x = R; dx = -dx; bounces.push({ x: x, y: y }); bounced++; }
        else if (x > W - R) { x = W - R; dx = -dx; bounces.push({ x: x, y: y }); bounced++; }
        if (bounced > 4) break;
        var crossed = false;
        if (portals && jumps < 2) {
          for (var p = 0; p < portals.length && !crossed; p++) {
            var pr = portals[p];
            var ends = [pr.a, pr.b];
            for (var e = 0; e < 2; e++) {
              var end = ends[e], partner = ends[1 - e];
              if (Math.hypot(x - end.x, y - end.y) < PORTAL_R) {
                x = partner.x + dx * (R + 10);
                y = partner.y + dy * (R + 10);
                travel += 36;
                jumps++;
                crossed = true;
                dots.push({ x: x, y: y });
                break;
              }
            }
          }
        }
        if (crossed) continue;
        if (y < TOP + (topOff || 0) + R * 0.5) break;
        var h = hitTest(rows, x, y, undefined, topOff);
        if (h) { hit = h; dots.push({ x: x, y: y }); break; }
        if (travel % 12 === 0) dots.push({ x: x, y: y });
      }
      return { dots: dots, bounces: bounces, hit: hit };
    }

    return {
      R: R, ROW_H: ROW_H, TOP: TOP, W: W, H: H, DANGER_Y: DANGER_Y, PORTAL_R: PORTAL_R,
      mulberry32: mulberry32, colsFor: colsFor, cellX: cellX, cellPos: cellPos,
      makeCell: makeCell, cellAt: cellAt, neighbors: neighbors, groupAt: groupAt,
      floating: floating, genBoard: genBoard, ensureEmptyTail: ensureEmptyTail,
      pressRow: pressRow, boardCount: boardCount, bottomEdge: bottomEdge,
      hitTest: hitTest, snapCell: snapCell, aimTrace: aimTrace
    };
  })();
  /* ==ZUMA-CORE-END== */

  var R = CORE.R, ROW_H = CORE.ROW_H, TOP = CORE.TOP, W = CORE.W, H = CORE.H, DANGER_Y = CORE.DANGER_Y;
  var PI2 = Math.PI * 2;
  var SHOOTER = { x: W / 2, y: H - 40 };
  var AIM_MIN = -Math.PI + 0.30, AIM_MAX = -0.30;
  var MAX_LEVEL = 12;
  var KIND_BOMB = 1, KIND_BOLT = 2, KIND_SLOW = 3;
  var KIND_COLOR = { 1: '#ff6a3c', 2: '#7df9ff', 3: '#7cbcff' };
  var KIND_NAME = { 1: 'gs.ballpop.specBomb', 2: 'gs.ballpop.specLightning', 3: 'gs.ballpop.specSlow' };

  /* 7 色 + 独立图形符号（色盲友好区分） */
  var PALETTE = [
    { c: '#00e5ff', l: '#a8f7ff', d: '#005d75', glyph: 0 },
    { c: '#ff2d95', l: '#ffb6d9', d: '#8a0d47', glyph: 1 },
    { c: '#ffe600', l: '#fff9a3', d: '#8a7a00', glyph: 2 },
    { c: '#39ff14', l: '#bcffb0', d: '#167a05', glyph: 3 },
    { c: '#b967ff', l: '#e2c6ff', d: '#5a1c9e', glyph: 4 },
    { c: '#ff9f1c', l: '#ffdca8', d: '#995400', glyph: 5 },
    { c: '#4d7cff', l: '#c3d4ff', d: '#163a9e', glyph: 6 }
  ];

  var DIFFS = {
    easy: { colors: 5, rows: 4, shots: 44, push: 10 },
    normal: { colors: 6, rows: 5, shots: 42, push: 9 },
    hard: { colors: 7, rows: 6, shots: 40, push: 8 }
  };

  /* 12 关：清空 / 目标分 / Boss 三种目标；第 5、8、12 关为 Boss 战 */
  var LEVELS = [
    { type: 'clear', target: 16 },
    { type: 'clear', target: 20 },
    { type: 'score', target: 700 },
    { type: 'clear', target: 24 },
    { type: 'boss', hp: 85 },
    { type: 'clear', target: 30 },
    { type: 'score', target: 1300 },
    { type: 'boss', hp: 100 },
    { type: 'clear', target: 36 },
    { type: 'score', target: 1900 },
    { type: 'clear', target: 42 },
    { type: 'boss', hp: 115 }
  ];

  var root = document.getElementById('game-root');
  if (!root) return;

  root.innerHTML =
    '<div class="bp-wrap">' +
    '  <div class="bp-pick" id="bp-pick">' +
    '    <div class="bp-pick-t">' + T('gs.ballpop.pickT') + '</div>' +
    '    <div class="bp-pick-d">' + T('gs.ballpop.pickD') + '<br>' + T('gs.ballpop.pickGoal') + '</div>' +
    '    <div class="bp-pick-btns">' +
    '      <button class="btn mode-btn" data-d="easy">' + T('gs.ballpop.dEasy') + '<small>' + T('gs.ballpop.easySub') + '</small></button>' +
    '      <button class="btn mode-btn selected" data-d="normal">' + T('gs.ballpop.dNormal') + '<small>' + T('gs.ballpop.normalSub') + '</small></button>' +
    '      <button class="btn mode-btn" data-d="hard">' + T('gs.ballpop.dHard') + '<small>' + T('gs.ballpop.hardSub') + '</small></button>' +
    '    </div>' +
    '    <div class="bp-levels-head" id="bp-levels-head">' + T('gs.ballpop.selectTitle') + '</div>' +
    '    <div class="bp-level-grid" id="bp-level-grid"></div>' +
    '    <div class="bp-pick-d" style="margin:6px 0 0;font-size:10px">' + T('gs.ballpop.selectHint') + '</div>' +
    '  </div>' +
    '  <div class="bp-game hidden" id="bp-game">' +
    '    <div class="bp-hud">' +
    '      <span>' + T('gs.ballpop.finalScore') + ' <b id="bp-score">0</b></span>' +
    '      <span>' + T('gs.ballpop.combo') + ' <b id="bp-combo">0</b></span>' +
    '      <span>' + T('gs.ballpop.left') + ' <b id="bp-left">0</b></span>' +
    '      <span>' + T('gs.ballpop.cleared') + ' <b id="bp-cleared-hud">0</b></span>' +
    '      <span>' + T('gs.ballpop.shots').replace('{n}', '<b id="bp-shots">0</b>') + '</span>' +
    '      <span>' + T('gs.ballpop.level').replace('{n}', '<b id="bp-level">1</b>') + '</span>' +
    '    </div>' +
    '    <div class="bp-status">' +
    '      <span class="bp-chip special hidden" id="bp-special"></span>' +
    '      <span class="bp-chip slow hidden" id="bp-slow"></span>' +
    '      <span class="bp-chip portal hidden" id="bp-portal"></span>' +
    '    </div>' +
    '    <div class="bp-boss hidden" id="bp-boss">' +
    '      <span class="bp-boss-name">' + T('gs.ballpop.bossName') + '</span>' +
    '      <div class="bp-boss-bar"><i id="bp-boss-fill"></i></div>' +
    '      <span class="bp-boss-shield hidden" id="bp-boss-shield">' + T('gs.ballpop.bossShield') + '</span>' +
    '      <span class="bp-boss-hp" id="bp-boss-hp">0</span>' +
    '    </div>' +
    '    <div class="bp-stage" id="bp-stage">' +
    '      <canvas class="bp-canvas" id="bp-cv" width="' + W + '" height="' + H + '"></canvas>' +
    '      <div class="bp-overlay hidden" id="bp-overlay">' +
    '        <div class="bp-card">' +
    '          <h2 id="bp-ov-title"></h2>' +
    '          <p id="bp-ov-sub"></p>' +
    '          <div class="bp-stats">' +
    '            <span>' + T('gs.ballpop.finalScore') + ' <b id="bp-final">0</b></span>' +
    '            <span>' + T('gs.ballpop.levelShort') + ' <b id="bp-final-level">1</b></span>' +
    '            <span>' + T('gs.ballpop.remaining') + ' <b id="bp-remain">0</b></span>' +
    '            <span>' + T('gs.ballpop.best') + ' <b id="bp-best">0</b></span>' +
    '          </div>' +
    '          <div class="bp-record hidden" id="bp-record">' + T('gs.ballpop.newRecord') + '</div>' +
    '          <button class="btn green" id="bp-next">' + T('gs.ballpop.nextLevel') + '</button>' +
    '          <button class="btn green" id="bp-again">' + T('gs.ballpop.again') + '</button>' +
    '          <button class="btn purple" id="bp-change">' + T('gs.ballpop.changeDiff') + '</button>' +
    '        </div>' +
    '      </div>' +
    '      <div class="bp-pause hidden" id="bp-pause">' +
    '        <div class="bp-card">' +
    '          <h2>' + T('gs.ballpop.pauseTitle') + '</h2>' +
    '          <p>' + T('gs.ballpop.pauseHint') + '</p>' +
    '          <button class="btn yellow" id="bp-resume">' + T('gs.ballpop.resume') + '</button>' +
    '          <button class="btn" id="bp-pause-restart">' + T('gs.ballpop.again') + '</button>' +
    '          <button class="btn purple" id="bp-pause-select">' + T('gs.ballpop.changeDiff') + '</button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="bp-controls">' +
    '      <button class="btn yellow bp-fire" id="bp-fire">' + T('gs.ballpop.fire') + '</button>' +
    '      <button class="btn bp-pause-btn" id="bp-pause-btn" aria-label="' + T('gs.ballpop.pauseBtn') + '"><span class="bp-pause-ic"></span></button>' +
    '    </div>' +
    '    <div class="bp-help">' + T('gs.ballpop.help') + '</div>' +
    '  </div>' +
    '</div>';

  var pickEl = document.getElementById('bp-pick');
  var gameEl = document.getElementById('bp-game');
  var stageEl = document.getElementById('bp-stage');
  var canvas = document.getElementById('bp-cv');
  var ctx;
  if (window.GK) {
    ctx = GK.setup(canvas, W, H).ctx;
  } else {
    ctx = canvas.getContext('2d');
    if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = W + 'px';

  var hudScore = document.getElementById('bp-score');
  var hudCombo = document.getElementById('bp-combo');
  var hudLeft = document.getElementById('bp-left');
  var hudShots = document.getElementById('bp-shots');
  var hudLevel = document.getElementById('bp-level');
  var hudCleared = document.getElementById('bp-cleared-hud');
  var specialEl = document.getElementById('bp-special');
  var slowEl = document.getElementById('bp-slow');
  var portalEl = document.getElementById('bp-portal');
  var bossEl = document.getElementById('bp-boss');
  var bossFill = document.getElementById('bp-boss-fill');
  var bossHpEl = document.getElementById('bp-boss-hp');
  var bossShieldEl = document.getElementById('bp-boss-shield');
  var overlayEl = document.getElementById('bp-overlay');
  var ovTitle = document.getElementById('bp-ov-title');
  var ovSub = document.getElementById('bp-ov-sub');
  var finalEl = document.getElementById('bp-final');
  var finalLevelEl = document.getElementById('bp-final-level');
  var remainEl = document.getElementById('bp-remain');
  var bestEl = document.getElementById('bp-best');
  var recordEl = document.getElementById('bp-record');
  var nextBtn = document.getElementById('bp-next');
  var againBtn = document.getElementById('bp-again');
  var changeBtn = document.getElementById('bp-change');
  var pauseEl = document.getElementById('bp-pause');
  var diffRow = document.getElementById('bp-pick');
  var levelGrid = document.getElementById('bp-level-grid');

  var BEST_GAME = (Arcade.shell && Arcade.shell.gameId) || 'ballpop';
  var diff = 'normal';
  var state = null, paused = false, loopApi = null, dragging = false, lastAimSound = 0;

  var stars = [];
  for (var si = 0; si < 70; si++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.6 + Math.random() * 1.5, p: Math.random() * PI2
    });
  }

  function fmt(key, vals) {
    var s = T(key);
    for (var k in vals) {
      if (Object.prototype.hasOwnProperty.call(vals, k)) s = s.split('{' + k + '}').join(vals[k]);
    }
    return s;
  }

  function bestScore() {
    try { return (Arcade.storage && Arcade.storage.getBest(BEST_GAME)) || 0; } catch (e) { return 0; }
  }
  function audio(name) { if (Arcade.audio) Arcade.audio.play(name); }
  function toast(msg, type) { if (Arcade.ui) Arcade.ui.toast(msg, type || 'ok'); }
  function randColor() { return Math.floor(Math.random() * state.conf.colors); }

  function levelConf(level) {
    var b = DIFFS[diff] || DIFFS.normal;
    var L = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
    var idx = level - 1;
    var isBoss = L.type === 'boss';
    return {
      colors: Math.min(PALETTE.length, b.colors + (level >= 8 ? 1 : 0)),
      rows: Math.min(7, Math.max(3, b.rows + (level >= 7 ? 1 : 0) - (isBoss ? 1 : 0))),
      shots: Math.max(28, b.shots - idx) + (isBoss ? 12 : 0),
      push: Math.max(5, b.push - Math.floor(idx / 4)) + (isBoss ? 2 : 0),
      goalType: L.type,
      goal: L.target || 0,
      bossHp: L.hp || 0,
      topPad: isBoss ? 44 : 0,
      portals: level >= 7 ? 2 : (level >= 3 ? 1 : 0),
      specialChance: Math.min(0.32, 0.08 + idx * 0.018 + (diff === 'hard' ? 0.04 : 0)),
      seedSpecials: idx >= 2 ? Math.min(4, 1 + Math.floor(idx / 3)) : 0
    };
  }

  function makePortals(n, topPad) {
    var defs = [
      [{ x: 62, y: topPad + 292 }, { x: 338, y: topPad + 292 }],
      [{ x: 62, y: topPad + 396 }, { x: 338, y: topPad + 396 }]
    ];
    var cols = ['#00f0ff', '#ff2d95', '#b967ff'];
    var out = [];
    for (var i = 0; i < n && i < defs.length; i++) {
      out.push({ a: defs[i][0], b: defs[i][1], col: cols[i % cols.length], cd: 0 });
    }
    return out;
  }

  function seedSpecials(n) {
    var st = state;
    if (!st || !n) return;
    /* 只在已填充的球阵行内布置，避免落进尾部预留空行形成悬空球 */
    var lastFilled = 0;
    for (var fr = st.rows.length - 1; fr >= 0; fr--) {
      var filled = false;
      for (var fc = 0; fc < st.rows[fr].cells.length; fc++) {
        if (st.rows[fr].cells[fc] != null) { filled = true; break; }
      }
      if (filled) { lastFilled = fr; break; }
    }
    var placed = 0, guard = 0;
    while (placed < n && guard++ < 80) {
      var r = lastFilled > 1 ? 1 + Math.floor(Math.random() * lastFilled) : 0;
      var row = st.rows[r];
      if (!row) continue;
      var c = Math.floor(Math.random() * row.cells.length);
      if (row.cells[c] == null || row.cells[c].k) continue;
      row.cells[c].k = 1 + Math.floor(Math.random() * 3);
      placed++;
    }
  }

  function rollBall() {
    var st = state;
    var kind = 0;
    st.specialPity++;
    if (st.specialPity >= 5) {
      kind = st.specialCycle;
      st.specialCycle = st.specialCycle >= 3 ? 1 : st.specialCycle + 1;
      st.specialPity = 0;
    } else if (Math.random() < st.conf.specialChance) {
      kind = 1 + Math.floor(Math.random() * 3);
    }
    return { c: randColor(), k: kind };
  }

  function initLevel() {
    var st = state;
    st.conf = levelConf(st.level);
    st.rows = CORE.genBoard(st.conf.rows, st.conf.colors, Math.random);
    st.topPad = st.conf.topPad;
    seedSpecials(st.conf.seedSpecials);
    st.portals = makePortals(st.conf.portals, st.topPad);
    st.shotsLeft = st.conf.shots;
    st.pushEvery = st.conf.push;
    st.goalType = st.conf.goalType;
    st.goal = st.conf.goal;
    st.levelCleared = 0;
    st.levelScore = 0;
    st.levelStartScore = st.score;
    st.shotsSince = 0;
    st.specialPity = 0;
    st.specialCycle = 1;
    st.slowTimer = 0;
    st.slowShown = -1;
    st.fc = 0;
    st.boss = st.goalType === 'boss' ? {
      hp: st.conf.bossHp, maxHp: st.conf.bossHp, shield: 0, warn: 0,
      pending: '', attackCount: 0, shotsFired: 0, active: true
    } : null;
    st.current = rollBall();
    st.next = rollBall();
    st.fire = null;
    st.aim = -Math.PI / 2;
    st.loadAnim = 0.85;
    st.pushAnim = 0;
    st.particles = [];
    st.texts = [];
    st.drops = [];
    st.zaps = [];
    st.rings = [];
    st.shake = 0;
    updateBossHud();
  }

  function startGame(d, level, baseScore) {
    diff = d || diff;
    var lv = Math.max(1, Math.min(MAX_LEVEL, level || 1));
    state = {
      diff: diff, level: lv, startLevel: lv, score: Math.max(0, Number(baseScore) || 0),
      levelStartScore: Math.max(0, Number(baseScore) || 0),
      combo: 0, cleared: 0, rows: [], conf: null, shotsLeft: 0, pushEvery: 8,
      shotsSince: 0, goal: 0, goalType: 'clear', levelCleared: 0, levelScore: 0,
      winByBoard: false, current: null, next: null, fire: null,
      particles: [], texts: [], drops: [], zaps: [], rings: [],
      aim: -Math.PI / 2, loadAnim: 0, pushAnim: 0, muzzle: 0, shake: 0,
      slowTimer: 0, slowShown: -1, specialPity: 0, specialCycle: 1,
      topPad: 0, portals: [], boss: null, fc: 0,
      over: false, won: false, reason: '', submitted: false, newRecord: false, phase: 'play'
    };
    paused = false;
    dragging = false;
    initLevel();
    pickEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    overlayEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    if (loopApi) loopApi.stop();
    loopApi = Arcade.loop.start(update, draw, 16);
    updateHud();
    audio('ui');
  }

  function openPicker() {
    state = null;
    paused = false;
    dragging = false;
    if (loopApi) { loopApi.stop(); loopApi = null; }
    pickEl.classList.remove('hidden');
    gameEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
  }

  function goalRemain() {
    var st = state;
    if (!st) return 0;
    if (st.goalType === 'boss') return st.boss ? Math.max(0, Math.ceil(st.boss.hp)) : 0;
    if (st.goalType === 'score') return Math.max(0, st.goal - st.levelScore);
    return Math.max(0, st.goal - st.levelCleared);
  }

  function updateBossHud() {
    var st = state;
    if (!st) return;
    if (!st.boss) {
      bossEl.classList.add('hidden');
      return;
    }
    bossEl.classList.remove('hidden');
    var pct = st.boss.maxHp > 0 ? Math.max(0, st.boss.hp / st.boss.maxHp * 100) : 0;
    bossFill.style.width = pct.toFixed(1) + '%';
    bossHpEl.textContent = Math.ceil(st.boss.hp) + '/' + st.boss.maxHp;
    bossShieldEl.classList.toggle('hidden', !(st.boss.shield > 0));
  }

  function updateSlowChip() {
    var st = state;
    if (!st) return;
    if (st.slowTimer > 0) {
      slowEl.classList.remove('hidden');
      slowEl.textContent = fmt('gs.ballpop.slowChip', { n: st.slowTimer.toFixed(1) });
    } else {
      slowEl.classList.add('hidden');
    }
  }

  function updateHud() {
    var st = state;
    if (!st) return;
    hudScore.textContent = st.score;
    hudCombo.textContent = st.combo;
    hudLeft.textContent = goalRemain();
    hudShots.textContent = Math.max(0, st.shotsLeft);
    hudLevel.textContent = st.level;
    hudCleared.textContent = st.cleared;
    if (st.current && st.current.k) {
      specialEl.classList.remove('hidden');
      specialEl.textContent = T(KIND_NAME[st.current.k]);
    } else {
      specialEl.classList.add('hidden');
    }
    if (st.portals.length) {
      portalEl.classList.remove('hidden');
      portalEl.textContent = fmt('gs.ballpop.portalChip', { n: st.portals.length });
    } else {
      portalEl.classList.add('hidden');
    }
    updateSlowChip();
    updateBossHud();
  }

  function clampAim(a) {
    if (a >= 0) return a < Math.PI / 2 ? AIM_MAX : AIM_MIN;
    return Math.max(AIM_MIN, Math.min(AIM_MAX, a));
  }

  function adjustAim(d) {
    var st = state;
    if (!st || st.phase !== 'play' || st.over || st.won || paused) return;
    st.aim = clampAim(st.aim + d);
    var now = Date.now();
    if (now - lastAimSound > 150) { lastAimSound = now; audio('rotate'); }
  }

  function setAimFromPoint(px, py) {
    var st = state;
    if (!st || st.phase !== 'play' || st.over || st.won || paused) return;
    var a = clampAim(Math.atan2(py - SHOOTER.y, px - SHOOTER.x));
    if (Math.abs(a - st.aim) > 0.02) {
      st.aim = a;
      var now = Date.now();
      if (now - lastAimSound > 160) { lastAimSound = now; audio('rotate'); }
    }
  }

  function fire() {
    var st = state;
    if (!st || st.phase !== 'play' || st.over || st.won || paused || st.fire) return;
    if (st.shotsLeft <= 0) return;
    st.fire = {
      x: SHOOTER.x, y: SHOOTER.y, dx: Math.cos(st.aim), dy: Math.sin(st.aim),
      travel: 0, color: st.current.c, kind: st.current.k, trail: [], portalsUsed: 0
    };
    st.shotsLeft--;
    st.muzzle = 1;
    st.loadAnim = 0;
    st.current = st.next;
    st.next = rollBall();
    st.loadAnim = 1;
    bossShotTick();
    audio('drop');
    updateHud();
  }

  function bossShotTick() {
    var st = state, b = st.boss;
    if (!b || b.hp <= 0) return;
    b.shotsFired++;
    if (b.shotsFired >= 9) {
      b.shotsFired = 0;
      if (b.warn <= 0) {
        b.pending = (b.attackCount % 2 === 0) ? 'wall' : 'shield';
        b.attackCount++;
        b.warn = 1.5;
        audio('rotate');
        addText(W / 2, st.topPad + 62,
          T(b.pending === 'wall' ? 'gs.ballpop.bossWarnWall' : 'gs.ballpop.bossWarnShield'),
          '#ff6a80', 12);
      }
    }
  }

  /* ---------- 表现特效 ---------- */
  function spawnParticles(x, y, ci, n, speed) {
    var st = state;
    if (!st) return;
    var col = (PALETTE[ci] || PALETTE[0]).c;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * PI2, sp = (speed || 1.4) * (0.7 + Math.random() * 1.6);
      st.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8,
        life: 1, size: 1.4 + Math.random() * 2.2, color: col
      });
    }
  }

  function spawnSparks(x, y, color, n, speed) {
    var st = state;
    if (!st) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * PI2, sp = (speed || 2.2) * (0.6 + Math.random() * 1.7);
      st.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 1, size: 1.5 + Math.random() * 2.6, color: color
      });
    }
  }

  function addText(x, y, text, color, size) {
    if (!state) return;
    state.texts.push({
      x: x, y: y, text: text, color: color || '#ffffff',
      size: size || 13, life: 1, vy: -0.55
    });
  }

  function addZap(ax, ay, bx, by, color) {
    if (!state) return;
    state.zaps.push({ ax: ax, ay: ay, bx: bx, by: by, color: color || '#7df9ff', life: 1 });
  }

  function addRing(x, y, color, radius) {
    if (!state) return;
    state.rings.push({ x: x, y: y, color: color || '#ff9f1c', r: 6, max: radius || 54, life: 1 });
  }

  function updateFx() {
    var st = state;
    if (!st) return;
    var slowF = st.slowTimer > 0 ? 0.5 : 1;
    var i;
    for (i = st.particles.length - 1; i >= 0; i--) {
      var p = st.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.14 * slowF; p.vx *= 0.99; p.life -= 0.028;
      if (p.life <= 0) st.particles.splice(i, 1);
    }
    for (i = st.texts.length - 1; i >= 0; i--) {
      var tx = st.texts[i];
      tx.y += tx.vy; tx.life -= 0.024;
      if (tx.life <= 0) st.texts.splice(i, 1);
    }
    for (i = st.drops.length - 1; i >= 0; i--) {
      var dr = st.drops[i];
      dr.x += dr.vx; dr.y += dr.vy; dr.vy += 0.5 * slowF; dr.life -= 0.016;
      if (state.portals) portalCheckDrop(dr);
      if (dr.life <= 0 || dr.y > H + 60) st.drops.splice(i, 1);
    }
    for (i = st.zaps.length - 1; i >= 0; i--) {
      st.zaps[i].life -= 0.045;
      if (st.zaps[i].life <= 0) st.zaps.splice(i, 1);
    }
    for (i = st.rings.length - 1; i >= 0; i--) {
      var rg = st.rings[i];
      rg.r += (rg.max - rg.r) * 0.16 + 0.6;
      rg.life -= 0.055;
      if (rg.life <= 0) st.rings.splice(i, 1);
    }
    for (i = 0; i < st.portals.length; i++) {
      if (st.portals[i].cd > 0) st.portals[i].cd = Math.max(0, st.portals[i].cd - 0.016);
    }
    if (st.shake > 0) st.shake = Math.max(0, st.shake - 0.075);
  }

  function portalCheckShot(f) {
    var st = state;
    if (!st || !st.portals || f.portalsUsed >= 3) return;
    for (var i = 0; i < st.portals.length; i++) {
      var pr = st.portals[i];
      if (pr.cd > 0) continue;
      var ends = [pr.a, pr.b];
      for (var e = 0; e < 2; e++) {
        var end = ends[e], partner = ends[1 - e];
        if (Math.hypot(f.x - end.x, f.y - end.y) < CORE.PORTAL_R) {
          var ox = f.x, oy = f.y;
          f.x = Math.max(R, Math.min(W - R, partner.x + f.dx * (R + 10)));
          f.y = partner.y + f.dy * (R + 10);
          f.portalsUsed++;
          pr.cd = 0.9;
          addZap(ox, oy, f.x, f.y, pr.col);
          addRing(partner.x, partner.y, pr.col, 30);
          spawnSparks(partner.x, partner.y, pr.col, 10, 2.2);
          addText(partner.x, partner.y - 22, T('gs.ballpop.portalWarp'), pr.col, 12);
          audio('move');
          return;
        }
      }
    }
  }

  function portalCheckDrop(dr) {
    var st = state;
    if (!st || !st.portals || dr.tele >= 2) return;
    for (var i = 0; i < st.portals.length; i++) {
      var pr = st.portals[i];
      if (pr.cd > 0) continue;
      var ends = [pr.a, pr.b];
      for (var e = 0; e < 2; e++) {
        var end = ends[e], partner = ends[1 - e];
        if (Math.hypot(dr.x - end.x, dr.y - end.y) < CORE.PORTAL_R - 2) {
          var ox = dr.x, oy = dr.y;
          dr.x = partner.x + (Math.random() - 0.5) * 8;
          dr.y = partner.y - 4;
          dr.vy = 1.1;
          dr.vx = (Math.random() - 0.5) * 1.2;
          dr.tele++;
          pr.cd = 0.7;
          addZap(ox, oy, dr.x, dr.y, pr.col);
          addRing(partner.x, partner.y, pr.col, 24);
          audio('move');
          return;
        }
      }
    }
  }

  function activateSlow(seconds) {
    var st = state;
    if (!st) return;
    st.slowTimer = Math.max(st.slowTimer, seconds || 7);
    addText(W / 2, st.topPad + 128, fmt('gs.ballpop.slowChip', { n: (seconds || 7).toFixed(0) }), '#9ed6ff', 14);
    audio('merge');
    updateSlowChip();
  }

  function updateSlow(dt) {
    var st = state;
    if (!st || st.slowTimer <= 0) return;
    st.slowTimer = Math.max(0, st.slowTimer - dt);
    if (st.slowTimer === 0) {
      addText(W / 2, st.topPad + 128, T('gs.ballpop.slowEnd'), '#9ed6ff', 13);
      updateSlowChip();
      return;
    }
    if (Math.abs(st.slowShown - st.slowTimer) >= 0.1) {
      st.slowShown = st.slowTimer;
      updateSlowChip();
    }
  }

  function updateBossLogic(dt) {
    var st = state, b = st.boss;
    if (!b || b.hp <= 0) return;
    if (b.shield > 0) {
      var had = b.shield;
      b.shield = Math.max(0, b.shield - dt);
      if (had > 0 && b.shield === 0) {
        addText(W / 2, st.topPad + 74, T('gs.ballpop.bossShieldOff'), '#8fe8ff', 12);
        updateBossHud();
      }
    }
    if (b.warn > 0) {
      b.warn = Math.max(0, b.warn - dt);
      if (b.warn === 0) applyBossAttack(b);
    }
  }

  function applyBossAttack(b) {
    var st = state;
    if (!b || b.hp <= 0) return;
    if (b.pending === 'wall') {
      CORE.pressRow(st.rows, Math.random, st.conf.colors);
      st.pushAnim = 1;
      addText(W / 2, st.topPad + 96, T('gs.ballpop.bossWall'), '#ff6a80', 13);
      spawnSparks(W / 2, st.topPad + 40, '#ff6a80', 18, 2.6);
      audio('drop');
      if (CORE.bottomEdge(st.rows, st.topPad) > DANGER_Y) endGame(false, 'bottom');
    } else {
      b.shield = 4.5;
      addText(W / 2, st.topPad + 96, T('gs.ballpop.bossShieldOn'), '#8fe8ff', 12);
      addRing(W / 2, st.topPad + 34, '#00f0ff', 58);
      audio('merge');
    }
    updateBossHud();
  }

  /* ---------- 清除与连锁 ---------- */
  function coordsInRadius(x, y, rad) {
    var st = state, out = [];
    for (var r = 0; r < st.rows.length; r++) {
      var row = st.rows[r];
      for (var c = 0; c < row.cells.length; c++) {
        if (row.cells[c] == null) continue;
        var p = CORE.cellPos(r, row.off, c, st.topPad);
        if (Math.hypot(p.x - x, p.y - y) <= rad) out.push([r, c]);
      }
    }
    return out;
  }

  function crossCoords(r, c) {
    var st = state, out = [];
    var cell = CORE.cellAt(st.rows, r, c);
    if (cell) out.push([r, c]);
    var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (var d = 0; d < dirs.length; d++) {
      var rr = r, cc = c;
      for (var step = 0; step < 6; step++) {
        rr += dirs[d][0]; cc += dirs[d][1];
        if (CORE.cellAt(st.rows, rr, cc) == null) break;
        out.push([rr, cc]);
      }
    }
    return out;
  }

  function hitBoss(count, per, x, y) {
    var st = state, b = st.boss;
    if (!b || b.hp <= 0 || !count) return;
    var dmg = count * per * (b.shield > 0 ? 0.25 : 1);
    b.hp = Math.max(0, b.hp - dmg);
    if (x != null) addText(x, (y || 0) - 6, '-' + Math.max(1, Math.round(dmg)), b.shield > 0 ? '#8fe8ff' : '#ff9a7a', 11);
    if (b.hp <= 0 && b.active) {
      b.active = false;
      var bonus = 500 + st.level * 40;
      st.score += bonus;
      st.levelScore += bonus;
      addText(W / 2, st.topPad + 82, T('gs.ballpop.bossDown'), '#ffe600', 16);
      addText(W / 2, st.topPad + 106, fmt('gs.ballpop.bossBonus', { n: bonus }), '#ffe600', 13);
      addRing(W / 2, st.topPad + 34, '#ffe600', 120);
      spawnSparks(W / 2, st.topPad + 34, '#ffe600', 40, 4.2);
      st.shake = Math.max(st.shake, 1);
      audio('win');
    }
    updateBossHud();
    return dmg;
  }

  function clearCoords(coords, source, mult, origin) {
    var st = state;
    var seen = {}, specials = [], removed = 0, points = 0;
    for (var i = 0; i < coords.length; i++) {
      var r = coords[i][0], c = coords[i][1], key = r + ',' + c;
      if (seen[key]) continue;
      seen[key] = 1;
      var row = st.rows[r];
      if (!row || row.cells[c] == null) continue;
      var cell = row.cells[c];
      row.cells[c] = null;
      var p = CORE.cellPos(r, row.off, c, st.topPad);
      spawnParticles(p.x, p.y, cell.c, 7);
      if (cell.k) specials.push({ r: r, c: c, k: cell.k, color: cell.c });
      removed++;
      points += 10 * mult;
      st.score += 10 * mult;
      st.levelScore += 10 * mult;
      st.cleared++;
      st.levelCleared++;
    }
    if (removed) {
      /* 每消除 1 球对 Boss 造成 2 点基础伤害；炸弹 ×3、闪电 ×2 */
      var per = (source === 'bomb' ? 3 : (source === 'bolt' ? 2 : 1)) * 2;
      hitBoss(removed, per, origin ? origin.x : W / 2, origin ? origin.y : st.topPad + 40);
    }
    return { count: removed, specials: specials, points: points };
  }

  function runChain(specials, mult) {
    var st = state;
    var queue = (specials || []).slice(), guard = 0, chain = 1;
    while (queue.length && guard++ < 70) {
      var sp = queue.shift();
      var off = st.rows[sp.r] ? st.rows[sp.r].off : 0;
      var p = CORE.cellPos(sp.r, off, sp.c, st.topPad);
      if (sp.k === KIND_BOMB) {
        var bc = coordsInRadius(p.x, p.y, R * 2.55);
        var br = clearCoords(bc, 'bomb', mult, p);
        if (br.count) {
          addText(p.x, p.y - 12, fmt('gs.ballpop.chainPlus', { n: chain }), '#ffb070', 12);
          addRing(p.x, p.y, '#ff9f1c', 58);
          st.shake = Math.max(st.shake, 0.75);
          audio('clear');
        }
        queue = queue.concat(br.specials);
      } else if (sp.k === KIND_BOLT) {
        var cc = crossCoords(sp.r, sp.c);
        var cr = clearCoords(cc, 'bolt', mult, p);
        for (var q = 0; q < cc.length; q++) {
          var rw = st.rows[cc[q][0]];
          if (!rw) continue;
          var cp = CORE.cellPos(cc[q][0], rw.off, cc[q][1], st.topPad);
          addZap(p.x, p.y, cp.x, cp.y, '#7df9ff');
        }
        if (cr.count) {
          addText(p.x, p.y - 12, fmt('gs.ballpop.chainPlus', { n: chain }), '#a9f4ff', 12);
          st.shake = Math.max(st.shake, 0.4);
          audio('merge');
        }
        queue = queue.concat(cr.specials);
      } else if (sp.k === KIND_SLOW) {
        activateSlow(7);
      }
      chain++;
    }
  }

  function dropFloating(mult) {
    var st = state;
    var fl = CORE.floating(st.rows);
    if (!fl.length) return;
    var bonus = 0;
    for (var j = 0; j < fl.length; j++) {
      var fr = fl[j][0], fc = fl[j][1];
      var row = st.rows[fr];
      if (!row || row.cells[fc] == null) continue;
      var cell = row.cells[fc];
      var fp = CORE.cellPos(fr, row.off, fc, st.topPad);
      st.drops.push({
        x: fp.x, y: fp.y, vx: (Math.random() - 0.5) * 1.6,
        vy: 1.4 + Math.random() * 1.6, ci: cell.c, k: cell.k, life: 1, tele: 0
      });
      row.cells[fc] = null;
      st.cleared++;
      st.levelCleared++;
      bonus += 15 * mult;
    }
    if (bonus) {
      st.score += bonus;
      st.levelScore += bonus;
      hitBoss(fl.length, 2, W / 2, st.topPad + 110);
      addText(W / 2, H * 0.42, fmt('gs.ballpop.dropBonus', { n: bonus }), '#7dffb0', 13);
      audio('merge');
    }
  }

  function bombShot(x, y) {
    var st = state;
    var mult = Math.max(1, st.combo);
    var coords = coordsInRadius(x, y, R * 2.55);
    var res = clearCoords(coords, 'bomb', mult, { x: x, y: y });
    if (res.count) {
      addText(x, y - 14, fmt('gs.ballpop.bombBoom', { n: res.count }), '#ffbb78', 14);
      addRing(x, y, '#ff9f1c', 64);
      spawnSparks(x, y, '#ffcf8f', 28, 3.4);
      st.shake = Math.max(st.shake, 0.85);
      audio('clear');
      addText(x, y - 36, '+' + res.points, '#fff8a8', 14);
    }
    runChain(res.specials, mult);
    dropFloating(mult);
    updateHud();
    afterShot();
  }

  function boltShot(hitR, hitC) {
    var st = state;
    var mult = Math.max(1, st.combo);
    var row = st.rows[hitR];
    var origin = row ? CORE.cellPos(hitR, row.off, hitC, st.topPad) : { x: W / 2, y: st.topPad + 40 };
    var coords = crossCoords(hitR, hitC);
    for (var i = 0; i < coords.length; i++) {
      var rw = st.rows[coords[i][0]];
      if (!rw) continue;
      var cp = CORE.cellPos(coords[i][0], rw.off, coords[i][1], st.topPad);
      addZap(origin.x, origin.y, cp.x, cp.y, '#7df9ff');
    }
    var res = clearCoords(coords, 'bolt', mult, origin);
    if (res.count) {
      addText(origin.x, origin.y - 14, fmt('gs.ballpop.boltChain', { n: res.count }), '#a9f4ff', 14);
      spawnSparks(origin.x, origin.y, '#bdf8ff', 20, 3.2);
      st.shake = Math.max(st.shake, 0.42);
      audio('merge');
      addText(origin.x, origin.y - 36, '+' + res.points, '#fff8a8', 14);
    }
    runChain(res.specials, mult);
    dropFloating(mult);
    updateHud();
    afterShot();
  }

  function updateShot() {
    var st = state, f = st.fire;
    var STEP = 11;
    f.trail.push({ x: f.x, y: f.y });
    if (f.trail.length > 12) f.trail.shift();
    f.x += f.dx * STEP;
    f.y += f.dy * STEP;
    f.travel += STEP;
    var bounced = false;
    if (f.x < R) { f.x = R; f.dx = -f.dx; bounced = true; }
    else if (f.x > W - R) { f.x = W - R; f.dx = -f.dx; bounced = true; }
    if (bounced) audio('move');
    portalCheckShot(f);
    if (f.y < -R * 2 || f.travel > 2000) {
      st.fire = null;
      st.combo = 0;
      afterShot();
      return;
    }
    var hit = CORE.hitTest(st.rows, f.x, f.y, undefined, st.topPad);
    if (hit) { resolveHit(hit); return; }
    if (f.y > H) {
      st.fire = null;
      st.combo = 0;
      afterShot();
    }
  }

  function resolveHit(hit) {
    var st = state, f = st.fire;
    var color = f.color, kind = f.kind;
    st.fire = null;
    if (kind === KIND_BOMB) {
      st.combo = Math.min(9, st.combo + 1);
      bombShot(f.x, f.y);
      return;
    }
    if (kind === KIND_BOLT) {
      st.combo = Math.min(9, st.combo + 1);
      boltShot(hit.row, hit.col);
      return;
    }
    var cell = CORE.snapCell(st.rows, hit.row, hit.col, f.x, f.y, st.topPad);
    if (!cell) {
      st.combo = 0;
      afterShot();
      return;
    }
    st.rows[cell.row].cells[cell.col] = CORE.makeCell(color, kind === KIND_SLOW ? KIND_SLOW : 0);
    CORE.ensureEmptyTail(st.rows);
    if (kind === KIND_SLOW) activateSlow(7);
    var group = CORE.groupAt(st.rows, cell.row, cell.col);
    var hitRow = st.rows[hit.row];
    var popPos = CORE.cellPos(hit.row, hitRow.off, hit.col, st.topPad);
    if (group.length >= 3) {
      st.combo = Math.min(9, st.combo + 1);
      var mult = Math.max(1, st.combo);
      var res = clearCoords(group, 'normal', mult, popPos);
      addText(popPos.x, popPos.y - 8, '+' + res.points + (mult > 1 ? ' ×' + mult : ''), '#fff8a8', 15);
      audio('clear');
      if (mult > 1) audio('coin');
      if (window.GK && GK.burst) GK.burst(canvas, popPos.x, popPos.y, PALETTE[color].c, Math.min(18, group.length * 3));
      runChain(res.specials, mult);
      dropFloating(mult);
      if (st.combo > 1) addText(W / 2, H * 0.52, fmt('gs.ballpop.comboText', { n: st.combo }), '#ffd6f2', 14);
      st.shake = Math.max(st.shake, 0.22);
    } else {
      st.combo = 0;
      audio('ui');
    }
    updateHud();
    afterShot();
  }

  /* ---------- 关卡推进 / 结算 ---------- */
  function checkGoal() {
    var st = state;
    if (st.goalType === 'boss') {
      if (st.boss && st.boss.hp <= 0) { st.winByBoard = false; levelClear(); return true; }
      return false;
    }
    if (st.goalType === 'score') {
      if (st.levelScore >= st.goal) { st.winByBoard = false; levelClear(); return true; }
      return false;
    }
    if (st.levelCleared >= st.goal) { st.winByBoard = false; levelClear(); return true; }
    return false;
  }

  function afterShot() {
    var st = state;
    updateHud();
    if (st.phase !== 'play') return;
    if (checkGoal()) return;
    if (st.goalType !== 'boss' && CORE.boardCount(st.rows) === 0) {
      st.winByBoard = true;
      levelClear();
      return;
    }
    if (st.goalType === 'boss' && CORE.boardCount(st.rows) === 0 && st.boss && st.boss.hp > 0) {
      CORE.pressRow(st.rows, Math.random, st.conf.colors);
      st.pushAnim = 1;
      addText(W / 2, st.topPad + 96, T('gs.ballpop.bossWall'), '#ff6a80', 12);
    }
    st.shotsSince += st.slowTimer > 0 ? 0.5 : 1;
    if (st.shotsSince >= st.pushEvery) {
      st.shotsSince = 0;
      CORE.pressRow(st.rows, Math.random, st.conf.colors);
      st.pushAnim = 1;
      audio('drop');
      addText(W / 2, TOP + 18, T('gs.ballpop.press'), '#ff7a9c', 13);
    }
    if (CORE.bottomEdge(st.rows, st.topPad) > DANGER_Y) { endGame(false, 'bottom'); return; }
    if (st.shotsLeft <= 0) { endGame(false, 'shots'); }
  }

  function levelClear() {
    var st = state;
    if (!st || st.phase !== 'play') return;
    st.score += 800;
    st.levelScore += 800;
    if (st.winByBoard) { st.score += 200; st.levelScore += 200; }
    audio('clear');
    if (Arcade.fx) Arcade.fx.centerBurst('var(--neon-yellow)', 22);
    if (st.level >= MAX_LEVEL) {
      st.score += 1500;
      st.levelScore += 1500;
      endGame(true, 'win');
      return;
    }
    st.phase = 'levelclear';
    updateHud();
    showPanel('level');
  }

  function showPanel(mode) {
    var st = state;
    if (!st) return;
    if (mode === 'level') {
      ovTitle.textContent = fmt('gs.ballpop.levelClearTitle', { n: st.level });
      ovTitle.className = 'win';
      ovSub.textContent = fmt('gs.ballpop.levelClearSub', { m: st.level + 1 });
      nextBtn.classList.remove('hidden');
      againBtn.classList.add('hidden');
      changeBtn.classList.add('hidden');
      recordEl.classList.add('hidden');
    } else {
      var title;
      if (st.won) title = st.level >= MAX_LEVEL ? T('gs.ballpop.victoryTitle') : T('gs.ballpop.resultWin');
      else if (st.reason === 'shots') title = T('gs.ballpop.resultLoseShots');
      else title = T('gs.ballpop.resultLoseBottom');
      ovTitle.textContent = title;
      ovTitle.className = st.won ? 'win' : '';
      ovSub.textContent = st.won
        ? fmt('gs.ballpop.victorySub', { n: st.score })
        : fmt('gs.ballpop.resultSub', { n: st.level, m: st.cleared });
      nextBtn.classList.add('hidden');
      againBtn.classList.remove('hidden');
      changeBtn.classList.remove('hidden');
      againBtn.textContent = st.won ? T('gs.ballpop.again') : T('gs.ballpop.retry');
      recordEl.classList.toggle('hidden', !st.newRecord);
    }
    finalEl.textContent = st.score;
    finalLevelEl.textContent = st.level;
    remainEl.textContent = CORE.boardCount(st.rows);
    /* 过关进度面板也展示本次成绩；最终结算时 submitScore 已写入 bestScore */
    bestEl.textContent = Math.max(bestScore(), st.score);
    overlayEl.classList.remove('hidden');
  }

  function endGame(win, reason) {
    var st = state;
    if (!st || st.phase === 'over') return;
    st.phase = 'over';
    st.over = true;
    st.won = !!win;
    st.reason = reason || '';
    st.fire = null;
    if (win) {
      if (Arcade.juice) Arcade.juice.win(); else audio('win');
    } else {
      if (Arcade.juice) Arcade.juice.lose(); else audio('lose');
    }
    if (!st.submitted) {
      st.submitted = true;
      try {
        if (st.score > 0) {
          st.newRecord = (Arcade.shell && Arcade.shell.submitScore)
            ? Arcade.shell.submitScore(st.score)
            : (Arcade.storage ? Arcade.storage.submitBest(BEST_GAME, st.score, 'max') : false);
        } else {
          st.newRecord = false;
        }
      } catch (e) { st.newRecord = false; }
    }
    showPanel('result');
    updateHud();
  }

  function nextLevel() {
    var st = state;
    if (!st || st.phase !== 'levelclear') return;
    st.level = Math.min(MAX_LEVEL, st.level + 1);
    st.phase = 'play';
    st.winByBoard = false;
    overlayEl.classList.add('hidden');
    initLevel();
    updateHud();
    audio('ui');
  }

  function retryCurrent() {
    var st = state;
    if (!st) return;
    startGame(st.diff, st.level, st.levelStartScore || 0);
  }

  function restartRun() {
    var st = state;
    startGame(st ? st.diff : diff, st ? st.startLevel : 1, 0);
  }

  function togglePause() {
    var st = state;
    if (!st || st.phase !== 'play' || st.over || st.won) return;
    paused = !paused;
    if (paused) {
      if (loopApi) loopApi.pause();
      pauseEl.classList.remove('hidden');
    } else {
      if (loopApi) loopApi.resume();
      pauseEl.classList.add('hidden');
    }
    audio('ui');
  }

  /* ---------- 主循环 ---------- */
  function update() {
    var st = state;
    if (!st || paused) return;
    updateFx();
    if (st.phase !== 'play') return;
    if (st.over || st.won) return;
    updateSlow(0.016);
    if (st.boss) updateBossLogic(0.016);
    if (st.muzzle > 0) st.muzzle = Math.max(0, st.muzzle - 0.1);
    if (st.loadAnim > 0) st.loadAnim = Math.max(0, st.loadAnim - 0.09);
    if (st.pushAnim > 0) st.pushAnim = Math.max(0, st.pushAnim - 0.055);
    if (st.fire) updateShot();
  }

  /* ---------- 绘制工具 ---------- */
  function drawGlyph(x, y, r, idx) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, r * 0.09);
    var q = r * 0.34;
    if (idx === 0) {
      ctx.beginPath(); ctx.arc(0, 0, q * 0.72, 0, PI2); ctx.fill();
    } else if (idx === 1) {
      ctx.beginPath(); ctx.arc(0, 0, q, 0, PI2); ctx.stroke();
    } else if (idx === 2) {
      ctx.beginPath();
      ctx.moveTo(-q, 0); ctx.lineTo(q, 0);
      ctx.moveTo(0, -q); ctx.lineTo(0, q);
      ctx.stroke();
    } else if (idx === 3) {
      ctx.beginPath();
      ctx.moveTo(0, -q); ctx.lineTo(q * 0.9, q * 0.7); ctx.lineTo(-q * 0.9, q * 0.7);
      ctx.closePath(); ctx.stroke();
    } else if (idx === 4) {
      ctx.strokeRect(-q * 0.8, -q * 0.8, q * 1.6, q * 1.6);
    } else if (idx === 5) {
      ctx.beginPath();
      ctx.moveTo(0, -q); ctx.lineTo(q * 0.7, 0); ctx.lineTo(0, q); ctx.lineTo(-q * 0.7, 0);
      ctx.closePath(); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-q, -q * 0.5); ctx.lineTo(q, -q * 0.5);
      ctx.moveTo(-q, q * 0.5); ctx.lineTo(q, q * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpecialMark(x, y, r, kind) {
    var col = KIND_COLOR[kind] || '#ffffff';
    var now = performance.now();
    var pulse = 0.5 + 0.5 * Math.sin(now / 190 + (kind * 2.1));
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 + pulse * 6;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, PI2); ctx.stroke();
    if (kind === KIND_BOMB) {
      ctx.strokeStyle = '#fff2d0';
      ctx.lineWidth = 1.4;
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4 + now / 900;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
        ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2 + pulse * 1.2, 0, PI2); ctx.fill();
    } else if (kind === KIND_BOLT) {
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.24, -r * 0.55);
      ctx.lineTo(r * 0.12, -r * 0.1);
      ctx.lineTo(-r * 0.08, r * 0.02);
      ctx.lineTo(r * 0.24, r * 0.55);
      ctx.stroke();
    } else if (kind === KIND_SLOW) {
      ctx.strokeStyle = '#dff2ff';
      ctx.lineWidth = 1.6;
      for (var s = 0; s < 3; s++) {
        var aa = s * PI2 / 3 - Math.PI / 2 + now / 1400;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.44, aa, aa + PI2 / 5);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.4);
      ctx.moveTo(0, 0); ctx.lineTo(r * 0.28, r * 0.14);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBall(x, y, ci, rad, alpha, kind) {
    var p = PALETTE[ci] || PALETTE[0];
    var r = rad || R;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.shadowColor = p.c;
    ctx.shadowBlur = r * 0.7;
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, p.l);
    g.addColorStop(0.65, p.c);
    g.addColorStop(1, p.d);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, r - 0.7, 0, PI2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.42, r * 0.19, 0, PI2);
    ctx.fill();
    drawGlyph(x, y, r, p.glyph);
    if (kind) drawSpecialMark(x, y, r, kind);
    ctx.restore();
  }

  function drawBoard(st) {
    var shift = st.pushAnim > 0 ? -ROW_H * st.pushAnim : 0;
    for (var r = 0; r < st.rows.length; r++) {
      var row = st.rows[r];
      for (var c = 0; c < row.cells.length; c++) {
        var cell = row.cells[c];
        if (cell == null) continue;
        var p = CORE.cellPos(r, row.off, c, st.topPad);
        drawBall(p.x, p.y + shift, cell.c, R, 1, cell.k);
      }
    }
  }

  function drawDanger() {
    var pulse = 0.35 + 0.25 * Math.sin(performance.now() / 300);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,45,149,' + pulse + ')';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(6, DANGER_Y);
    ctx.lineTo(W - 6, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,45,149,' + (pulse * 0.08) + ')';
    ctx.fillRect(0, DANGER_Y, W, H - DANGER_Y);
    ctx.restore();
  }

  function drawAim(st) {
    if (st.fire || st.phase !== 'play' || st.over || st.won || paused) return;
    var tr = CORE.aimTrace(st.rows, SHOOTER.x, SHOOTER.y, st.aim, st.portals, st.topPad);
    var col = st.current.k ? KIND_COLOR[st.current.k] : PALETTE[st.current.c].c;
    var n = tr.dots.length;
    ctx.save();
    if (n > 1) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.moveTo(tr.dots[0].x, tr.dots[0].y);
      for (var q = 1; q < n; q++) ctx.lineTo(tr.dots[q].x, tr.dots[q].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (var i = 1; i < n; i++) {
      var d = tr.dots[i];
      var k = i / n;
      ctx.globalAlpha = 0.05 + 0.55 * (1 - k);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.5 + 1.4 * (1 - k), 0, PI2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (var b = 0; b < tr.bounces.length; b++) {
      var bp = tr.bounces[b];
      ctx.strokeStyle = 'rgba(0,240,255,0.7)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(bp.x, bp.y, 6, 0, PI2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bp.x - 9, bp.y); ctx.lineTo(bp.x + 9, bp.y); ctx.stroke();
    }
    if (tr.hit) {
      var cell = CORE.snapCell(st.rows, tr.hit.row, tr.hit.col, tr.hit.x, tr.hit.y, st.topPad);
      if (cell) {
        var row = st.rows[cell.row];
        var cp = CORE.cellPos(cell.row, row.off, cell.col, st.topPad);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(cp.x, cp.y, R - 2, 0, PI2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(cp.x, cp.y, R - 4, 0, PI2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawPortals(st) {
    if (!st.portals || !st.portals.length) return;
    var now = performance.now();
    for (var i = 0; i < st.portals.length; i++) {
      var pr = st.portals[i];
      var ends = [pr.a, pr.b];
      for (var e = 0; e < 2; e++) {
        var p = ends[e];
        var pulse = 0.5 + 0.5 * Math.sin(now / 260 + i * 1.7 + e * 2.2);
        var ready = pr.cd <= 0;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = ready ? 0.92 : 0.4;
        ctx.shadowColor = pr.col;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = pr.col;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, CORE.PORTAL_R - 1, 0, PI2); ctx.stroke();
        ctx.rotate(now / 700 + i * 0.8);
        ctx.setLineDash([6, 8]);
        ctx.globalAlpha = (ready ? 0.8 : 0.35) * (0.5 + pulse * 0.5);
        ctx.beginPath(); ctx.arc(0, 0, CORE.PORTAL_R - 5, 0, PI2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.rotate(-(now / 700 + i * 0.8));
        var g = ctx.createRadialGradient(0, 0, 1, 0, 0, CORE.PORTAL_R - 3);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.35, pr.col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = (ready ? 0.55 : 0.22) * (0.6 + pulse * 0.4);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, CORE.PORTAL_R - 3, 0, PI2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawZaps(st) {
    if (!st.zaps.length) return;
    ctx.save();
    for (var i = 0; i < st.zaps.length; i++) {
      var z = st.zaps[i];
      var a = Math.max(0, z.life);
      ctx.globalAlpha = a;
      ctx.strokeStyle = z.color;
      ctx.shadowColor = z.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.6 + a * 1.4;
      ctx.beginPath();
      var segs = 9;
      for (var s = 0; s <= segs; s++) {
        var tt = s / segs;
        var jx = (s > 0 && s < segs) ? (Math.random() - 0.5) * 10 * (1 - tt) : 0;
        var jy = (s > 0 && s < segs) ? (Math.random() - 0.5) * 10 * (1 - tt) : 0;
        var px = z.ax + (z.bx - z.ax) * tt + jx;
        var py = z.ay + (z.by - z.ay) * tt + jy;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRings(st) {
    if (!st.rings.length) return;
    ctx.save();
    for (var i = 0; i < st.rings.length; i++) {
      var rg = st.rings[i];
      ctx.globalAlpha = Math.max(0, rg.life);
      ctx.strokeStyle = rg.color;
      ctx.shadowColor = rg.color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 1.5 + rg.life * 3;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, PI2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawShooter(st) {
    var now = performance.now();
    var pulse = 0.5 + 0.5 * Math.sin(now / 260);
    var ncol = PALETTE[st.next.c] || PALETTE[0];

    var bx = W - 64, by = H - 62;
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,24,0.8)';
    if (window.GK) GK.roundRect(ctx, bx, by, 52, 56, 10); else ctx.rect(bx, by, 52, 56);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = ncol.c;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    drawBall(bx + 26, by + 22, st.next.c, 12, 1, st.next.k);
    ctx.save();
    ctx.fillStyle = 'rgba(210,220,240,0.8)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(T('gs.ballpop.next'), bx + 26, by + 46);
    ctx.restore();

    ctx.save();
    ctx.translate(SHOOTER.x, SHOOTER.y);
    ctx.rotate(st.aim + Math.PI / 2);
    var barG = ctx.createLinearGradient(-8, -46, 8, -12);
    barG.addColorStop(0, '#2b3a5c');
    barG.addColorStop(0.5, '#5d6fa0');
    barG.addColorStop(1, '#1a2238');
    ctx.fillStyle = barG;
    if (window.GK) GK.roundRect(ctx, -8, -46, 16, 36, 7); else ctx.rect(-8, -46, 16, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,240,255,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,255,' + (0.35 + pulse * 0.4) + ')';
    ctx.beginPath(); ctx.arc(0, -46, 4.5, 0, PI2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(SHOOTER.x, SHOOTER.y);
    var bgr = ctx.createLinearGradient(0, 8, 0, 38);
    bgr.addColorStop(0, '#16203a');
    bgr.addColorStop(1, '#070a16');
    ctx.fillStyle = bgr;
    if (window.GK) GK.roundRect(ctx, -40, 8, 80, 30, 12); else ctx.rect(-40, 8, 80, 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,240,255,0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(SHOOTER.x, SHOOTER.y);
    ctx.strokeStyle = 'rgba(0,240,255,' + (0.35 + pulse * 0.35) + ')';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R + 11 + pulse * 2, 0, PI2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.rotate(now / 1000);
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = 'rgba(185,103,255,0.65)';
    ctx.beginPath(); ctx.arc(0, 0, R + 6, 0, PI2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    var la = st.loadAnim || 0;
    var sc = 1 - la * 0.35;
    drawBall(SHOOTER.x, SHOOTER.y, st.current.c, R * sc, 1 - la * 0.25, st.current.k);
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha = la * 0.5;
      ctx.strokeStyle = st.current.k ? KIND_COLOR[st.current.k] : PALETTE[st.current.c].c;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(SHOOTER.x, SHOOTER.y, R + la * 10, 0, PI2); ctx.stroke();
      ctx.restore();
    }

    if (st.muzzle > 0) {
      ctx.save();
      var mx = SHOOTER.x + Math.cos(st.aim) * 48, my = SHOOTER.y + Math.sin(st.aim) * 48;
      ctx.globalAlpha = Math.max(0, st.muzzle);
      var mg = ctx.createRadialGradient(mx, my, 1, mx, my, 18);
      mg.addColorStop(0, 'rgba(255,255,220,0.9)');
      mg.addColorStop(0.4, 'rgba(0,240,255,0.6)');
      mg.addColorStop(1, 'rgba(0,240,255,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, 18, 0, PI2); ctx.fill();
      ctx.restore();
    }
  }

  function drawDrops(st) {
    for (var i = 0; i < st.drops.length; i++) {
      var d = st.drops[i];
      drawBall(d.x, d.y, d.ci, R * 0.9, Math.max(0, d.life), d.k);
    }
  }

  function drawParticles(st) {
    ctx.save();
    for (var i = 0; i < st.particles.length; i++) {
      var p = st.particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, PI2); ctx.fill();
    }
    ctx.restore();
  }

  function drawTexts(st) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < st.texts.length; i++) {
      var t = st.texts[i];
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.font = 'bold ' + t.size + 'px sans-serif';
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  function drawBallInFlight(st) {
    var f = st.fire;
    if (!f) return;
    var col = f.kind ? KIND_COLOR[f.kind] : PALETTE[f.color].c;
    ctx.save();
    for (var i = 0; i < f.trail.length; i++) {
      var t = f.trail[i];
      var k = (i + 1) / f.trail.length;
      ctx.globalAlpha = 0.25 * k;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(t.x, t.y, 6 * k + 1, 0, PI2); ctx.fill();
    }
    ctx.restore();
    drawBall(f.x, f.y, f.color, R, 1, f.kind);
  }

  function drawBossBack(st) {
    var b = st.boss;
    if (!b || b.hp <= 0) return;
    var now = performance.now();
    var cx = W / 2, cy = st.topPad ? 28 : 26;
    var pulse = 0.5 + 0.5 * Math.sin(now / 220);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.92;
    ctx.shadowColor = b.shield > 0 ? '#00f0ff' : '#ff2d55';
    ctx.shadowBlur = 18;
    var g = ctx.createRadialGradient(0, 0, 3, 0, 0, 30);
    g.addColorStop(0, '#fff3d0');
    g.addColorStop(0.28, '#ff9f1c');
    g.addColorStop(0.62, '#c11a4a');
    g.addColorStop(1, 'rgba(30,0,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,120,150,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 25 + pulse * 1.6, 0, PI2); ctx.stroke();
    ctx.save();
    ctx.rotate(now / 1500);
    ctx.setLineDash([9, 7]);
    ctx.strokeStyle = 'rgba(255,230,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, PI2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.fillStyle = '#2a0410';
    ctx.beginPath();
    ctx.moveTo(-21, 8); ctx.lineTo(-11, -13); ctx.lineTo(11, -13); ctx.lineTo(21, 8);
    ctx.lineTo(0, 19); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,160,120,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.55 + pulse * 0.45) + ')';
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, PI2); ctx.fill();
    ctx.restore();
  }

  function drawBossFront(st) {
    var b = st.boss;
    if (!b || b.hp <= 0) return;
    var cx = W / 2, cy = st.topPad ? 28 : 26;
    var now = performance.now();
    if (b.shield > 0) {
      var pa = 0.3 + 0.18 * Math.sin(now / 240);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(0,240,255,' + (pa + 0.25) + ')';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, PI2); ctx.stroke();
      ctx.setLineDash([8, 8]);
      ctx.globalAlpha = pa;
      ctx.beginPath(); ctx.arc(0, 0, 54, 0, PI2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,240,255,0.08)';
      ctx.beginPath(); ctx.arc(0, 0, 50, 0, PI2); ctx.fill();
      ctx.restore();
    }
    if (b.warn > 0) {
      var ratio = Math.max(0, Math.min(1, b.warn / 1.5));
      var warnPulse = 0.45 + 0.4 * Math.sin(now / 110);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(255,45,80,' + warnPulse + ')';
      ctx.shadowColor = '#ff2d50';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 39, -Math.PI / 2, -Math.PI / 2 + PI2 * ratio); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = warnPulse;
      ctx.fillStyle = '#ff6a80';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(T(b.pending === 'wall' ? 'gs.ballpop.bossWarnWall' : 'gs.ballpop.bossWarnShield'),
        W / 2, st.topPad + 52);
      ctx.restore();
    }
  }

  function drawSlowTint(st) {
    if (st.slowTimer <= 0) return;
    var now = performance.now();
    var pulse = 0.5 + 0.5 * Math.sin(now / 300);
    ctx.save();
    ctx.fillStyle = 'rgba(60,150,255,' + (0.045 + pulse * 0.022) + ')';
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(70,170,255,' + (0.12 + pulse * 0.05) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function draw() {
    var st = state;
    var now = performance.now();
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070714');
    bg.addColorStop(0.55, '#0b0a20');
    bg.addColorStop(1, '#170b24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    var rg = ctx.createRadialGradient(W * 0.2, H * 0.22, 8, W * 0.2, H * 0.22, W * 0.85);
    rg.addColorStop(0, 'rgba(0,240,255,0.08)');
    rg.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H * 0.65);
    var rg2 = ctx.createRadialGradient(W * 0.85, H * 0.78, 8, W * 0.85, H * 0.78, W * 0.7);
    rg2.addColorStop(0, 'rgba(255,45,149,0.08)');
    rg2.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = rg2;
    ctx.fillRect(0, H * 0.4, W, H * 0.6);
    ctx.restore();
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = 0.16 + 0.3 * (0.5 + 0.5 * Math.sin(now / 900 + s.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe2ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, PI2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!st) return;

    var shakeX = 0, shakeY = 0;
    if (st.shake > 0) {
      shakeX = (Math.random() - 0.5) * 7 * st.shake;
      shakeY = (Math.random() - 0.5) * 6 * st.shake;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBossBack(st);
    drawPortals(st);
    drawDanger();
    drawBoard(st);
    drawDrops(st);
    drawAim(st);
    drawParticles(st);
    drawZaps(st);
    drawRings(st);
    drawTexts(st);
    drawShooter(st);
    drawBallInFlight(st);
    ctx.restore();
    drawBossFront(st);
    drawSlowTint(st);
  }

  /* ---------- 输入 ---------- */
  function tutorialOpen() {
    return !!document.querySelector('.tut-overlay');
  }

  function pointerPos(ev) {
    if (window.GK && GK.pointer) return GK.pointer(canvas, ev);
    var r = canvas.getBoundingClientRect();
    var t = ev;
    if (ev.touches && ev.touches.length) t = ev.touches[0];
    else if (ev.changedTouches && ev.changedTouches.length) t = ev.changedTouches[0];
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }

  canvas.addEventListener('pointermove', function (ev) {
    if (!state || state.phase !== 'play' || state.over || state.won || paused) return;
    var p = pointerPos(ev);
    setAimFromPoint(p.x, p.y);
  });

  canvas.addEventListener('pointerdown', function (ev) {
    if (!state || state.phase !== 'play' || state.over || state.won || paused) return;
    ev.preventDefault();
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    var p = pointerPos(ev);
    setAimFromPoint(p.x, p.y);
    if (ev.pointerType === 'mouse' || !ev.pointerType) fire();
    else dragging = true;
  });

  canvas.addEventListener('pointerup', function (ev) {
    if (!dragging) return;
    dragging = false;
    if (!state || state.phase !== 'play' || state.over || state.won || paused) return;
    var p = pointerPos(ev);
    setAimFromPoint(p.x, p.y);
    fire();
  });

  canvas.addEventListener('pointercancel', function () { dragging = false; });
  canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  document.getElementById('bp-fire').addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    fire();
  });
  document.getElementById('bp-pause-btn').addEventListener('click', function () { togglePause(); });
  document.getElementById('bp-resume').addEventListener('click', function () { togglePause(); });
  document.getElementById('bp-pause-restart').addEventListener('click', function () { restartRun(); });
  document.getElementById('bp-pause-select').addEventListener('click', function () { openPicker(); });
  nextBtn.addEventListener('click', function () { nextLevel(); });
  againBtn.addEventListener('click', function () {
    if (!state) return;
    if (state.won) startGame(state.diff, 1, 0);
    else retryCurrent();
  });
  changeBtn.addEventListener('click', function () { openPicker(); });

  Arcade.input.onKeys({
    left: function () { adjustAim(-0.055); },
    right: function () { adjustAim(0.055); },
    action: function (e) {
      if (e && e.repeat) return;
      if (tutorialOpen()) return;
      fire();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (tutorialOpen()) return;
    if (e.key === 'p' || e.key === 'P') {
      if (state && state.phase === 'play' && !state.over && !state.won) { e.preventDefault(); togglePause(); }
    } else if (e.key === 'r' || e.key === 'R') {
      if (state) { e.preventDefault(); restartRun(); }
    }
  });

  diffRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      diffRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
      b.classList.add('selected');
      startGame(b.getAttribute('data-d'), 1, 0);
    });
  });

  (function buildLevelGrid() {
    for (var i = 1; i <= MAX_LEVEL; i++) {
      var L = LEVELS[i - 1];
      var b = document.createElement('button');
      b.className = 'bp-lv' + (L.type === 'boss' ? ' boss' : '') + (i === MAX_LEVEL ? ' final' : '');
      b.setAttribute('data-level', String(i));
      var tag = L.type === 'boss' ? T('gs.ballpop.lvBoss') : (L.type === 'score' ? T('gs.ballpop.lvScore') : T('gs.ballpop.lvClear'));
      if (i === MAX_LEVEL) tag = T('gs.ballpop.lvFinal');
      b.innerHTML = '<span>' + i + '</span><small>' + tag + '</small>';
      b.addEventListener('click', function () {
        startGame(diff, parseInt(this.getAttribute('data-level'), 10), 0);
      });
      levelGrid.appendChild(b);
    }
  })();

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.ballpop.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    if (state) restartRun();
    else openPicker();
  };

  openPicker();
})();
