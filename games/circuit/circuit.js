/* ============================================================
   电路连接 Circuit · 旗舰级重制
   - 两本章节包（新手 5 关 / 进阶 6 关），固定种子、尺寸、步数预算
   - 单向管（W，只能沿箭头方向导通）与交叉管（C，横竖双线互不连通）
   - 点按旋转、拖动交换；方向键移动光标 + 空格旋转
   - 每关限步，耗尽即失败并可立即重开；进度写入 arcade_progress_circuit
   - 每日题按日期种子生成，Arcade.daily.markSolved 记录连胜
   - Canvas 手绘霓虹电路：流光、电火花、粒子、屏震、缓动
   ============================================================ */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.circuit.tut1t'), d: T('gs.circuit.tut1') },
  { t: T('gs.circuit.tut2t'), d: T('gs.circuit.tut2') },
  { t: T('gs.circuit.tut3t'), d: T('gs.circuit.tut3') }
];

/* ============================================================
   CircuitGen · 纯逻辑（生成 + 判定），无 DOM 依赖，可在 Node 中校验
   ============================================================ */
window.CircuitGen = (function () {
  var PG = window.PipeGen;
  var DIR = PG.DIR;
  var ALL_TYPES = { O: 1, S: 1, I: 1, L: 1, T: 1, X: 1, C: 1, W: 1 };

  function opp(d) { return (d + 2) % 4; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function maskOf(cell) {
    if (cell.type === 'C') return [1, 1, 1, 1];
    if (cell.type === 'W') return PG.rotMask('I', cell.rot);
    return PG.rotMask(cell.type, cell.rot);
  }
  function countMask(m) {
    var n = 0;
    for (var i = 0; i < 4; i++) if (m[i]) n++;
    return n;
  }

  /* 电流进入某格（via=进入侧）后，内部所在的导电组：
     普通管 0（四向互连）；交叉管 1=竖 / 2=横；单向管 3（仅尾侧可进） */
  function groupFor(cell, via) {
    if (cell.type === 'C') {
      if (via < 0) return -1;
      return (via % 2 === 0) ? 1 : 2;
    }
    if (cell.type === 'W') {
      if (via < 0) return -1;
      return via === ((cell.rot + 2) % 4) ? 3 : -1;
    }
    return 0;
  }
  function portsFor(cell, group) {
    if (cell.type === 'C') return group === 1 ? [0, 2] : [1, 3];
    if (cell.type === 'W') return group === 3 ? [cell.rot] : [];
    var m = maskOf(cell), out = [], i;
    for (i = 0; i < 4; i++) if (m[i]) out.push(i);
    return out;
  }

  function derive(board) {
    var cols = board.cols, rows = board.rows, cells = board.cells;
    var total = cols * rows;
    var seen = new Uint8Array(total);
    var groups = new Uint8Array(total);
    var state = new Uint8Array(total * 4);
    var parents = new Int32Array(total);
    for (var pi = 0; pi < total; pi++) parents[pi] = -1;
    var queue = [], head = 0, order = [];

    function sourceIdx(s) {
      return typeof s === 'number' ? s : s.r * cols + s.c;
    }
    function visit(i, g, parent) {
      if (g < 0) return false;
      var key = i * 4 + g;
      if (state[key]) return false;
      state[key] = 1;
      groups[i] = groups[i] | (1 << g);
      if (!seen[i]) {
        seen[i] = 1;
        order.push(i);
      }
      if (parent >= 0 && parents[i] < 0) parents[i] = parent;
      queue.push({ i: i, g: g });
      return true;
    }

    var sources = board.sources || [], sinks = board.sinks || [];
    sources.forEach(function (s) {
      var i = sourceIdx(s);
      if (i >= 0 && i < total) visit(i, groupFor(cells[i], -1), -1);
    });

    while (head < queue.length) {
      var cur = queue[head++];
      var cell = cells[cur.i];
      var r = Math.floor(cur.i / cols), c = cur.i % cols;
      var ports = portsFor(cell, cur.g);
      for (var k = 0; k < ports.length; k++) {
        var d = ports[k];
        var nr = r + DIR[d][0], nc = c + DIR[d][1];
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        var ni = nr * cols + nc;
        var ncell = cells[ni];
        var entry = opp(d);
        if (!maskOf(ncell)[entry]) continue;
        var ng = groupFor(ncell, entry);
        if (ng < 0) continue;
        visit(ni, ng, cur.i);
      }
    }

    var connectedSinks = [];
    sinks.forEach(function (s) {
      var i = sourceIdx(s);
      if (seen[i]) connectedSinks.push(i);
    });

    return {
      ok: sinks.length > 0 && connectedSinks.length === sinks.length,
      seen: seen, groups: groups, parents: parents,
      reached: order, connectedSinks: connectedSinks
    };
  }

  function dirBetween(a, b, cols) {
    var ar = Math.floor(a / cols), ac = a % cols;
    var br = Math.floor(b / cols), bc = b % cols;
    if (br - ar === -1) return 0;
    if (bc - ac === 1) return 1;
    if (br - ar === 1) return 2;
    return 3;
  }

  /* 当前朝向 → 目标朝向的最少顺时针步数；单向管四个朝向各不相同 */
  function turnsTo(cell, from, to) {
    if (cell.fixed || cell.immutable) return 0;
    if (cell.type === 'C') return 0;
    if (cell.type === 'W') return ((to - from) % 4 + 4) % 4;
    return PG.turnsTo(cell.type, ((from % 4) + 4) % 4, ((to % 4) + 4) % 4);
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /**
   * 生成一关：先用 PipeGen 的生成树保证基础可解，再在不破坏“解”的前提下
   * 植入交叉管 / 单向管，最后重排朝向并计算最少参考步数。
   * cfg: { cols, rows, diff, sinks, budget, slack, crosses, oneWays }
   */
  function makeBoard(cfg, seed) {
    cfg = cfg || {};
    var cols = clamp(cfg.cols || 5, 3, 7);
    var rows = clamp(cfg.rows || 5, 3, 7);
    var base = PG.makeBoard(cols, rows, { level: cfg.diff || 5, sinks: cfg.sinks || 1 }, seed);
    var board = {
      cols: base.cols, rows: base.rows,
      cells: base.cells.map(function (c) {
        return { type: c.type, rot: c.rot, fixed: !!c.fixed, immutable: false, openCount: 0 };
      }),
      sources: base.sources.slice(),
      sinks: base.sinks.slice(),
      solutionRot: base.solutionRot.slice(),
      sourcePos: base.sourcePos,
      sinkPos: base.sinkPos,
      sinksPos: base.sinksPos ? base.sinksPos.slice() : null,
      seed: seed,
      __fallback: !!base.__fallback
    };
    var cells = board.cells;
    for (var i0 = 0; i0 < cells.length; i0++) cells[i0].openCount = countMask(maskOf(cells[i0]));

    var rng = PG.mulberry32(((seed >>> 0) ^ 0x9e3779b9) >>> 0);

    function solutionProbe() {
      return PG.withRots(board, board.solutionRot);
    }
    function solutionOk() {
      return derive(solutionProbe()).ok;
    }
    function saveCell(idx) {
      return { type: cells[idx].type, rot: cells[idx].rot, openCount: cells[idx].openCount, sol: board.solutionRot[idx] };
    }
    function restoreCell(idx, s) {
      cells[idx].type = s.type;
      cells[idx].rot = s.rot;
      cells[idx].openCount = s.openCount;
      cells[idx].immutable = (s.type === 'C');
      board.solutionRot[idx] = s.sol;
    }

    /* ---- 交叉管：优先直管/四口，转换后“解”仍需连通 ---- */
    var oneTarget = Math.max(0, Number(cfg.oneWays) || 0);
    var crossTarget = Math.max(0, Number(cfg.crosses) || 0);
    var crossA = [], crossB = [];
    var straightLeft = 0;
    for (var ci0 = 0; ci0 < cells.length; ci0++) {
      var cc0 = cells[ci0];
      if (cc0.fixed || cc0.openCount === 0) continue;
      var cr0 = Math.floor(ci0 / cols), cc1 = ci0 % cols;
      if (cr0 === 0 || cc1 === 0 || cr0 === rows - 1 || cc1 === cols - 1) continue;
      if (cc0.type === 'I') straightLeft++;
      if (cc0.type === 'I' || cc0.type === 'X' || cc0.type === 'T') crossA.push(ci0);
      else crossB.push(ci0);
    }
    shuffle(crossA, rng); shuffle(crossB, rng);
    var crossList = crossA.concat(crossB);
    var crossMade = 0;
    for (var ci1 = 0; ci1 < crossList.length && crossMade < crossTarget; ci1++) {
      var cidx = crossList[ci1];
      if (cells[cidx].type === 'C') continue;
      var isStraight = cells[cidx].type === 'I';
      if (isStraight && straightLeft <= oneTarget) continue;
      var cSave = saveCell(cidx);
      cells[cidx].type = 'C';
      cells[cidx].rot = 0;
      cells[cidx].openCount = 4;
      cells[cidx].immutable = true;
      board.solutionRot[cidx] = 0;
      if (solutionOk()) {
        crossMade++;
        if (isStraight) straightLeft--;
      } else {
        cells[cidx].immutable = false;
        restoreCell(cidx, cSave);
      }
    }

    /* ---- 单向管：取解路径上的直管，箭头指向电流前进方向 ---- */
    var oneList = [];
    for (var oi0 = 0; oi0 < cells.length; oi0++) {
      if (cells[oi0].fixed || cells[oi0].type !== 'I') continue;
      oneList.push(oi0);
    }
    shuffle(oneList, rng);
    var oneMade = 0;
    for (var oi1 = 0; oi1 < oneList.length && oneMade < oneTarget; oi1++) {
      var oidx = oneList[oi1];
      if (cells[oidx].type !== 'I') continue;
      var probe = derive(solutionProbe());
      var par = probe.parents[oidx];
      if (par < 0) continue;
      var entry = dirBetween(par, oidx, cols);
      var om = maskOf(cells[oidx]);
      if (!om[entry] || !om[opp(entry)]) continue;
      var oSave = saveCell(oidx);
      cells[oidx].type = 'W';
      cells[oidx].rot = opp(entry);       // rot = 出口侧；入口 = 出口对侧
      cells[oidx].openCount = 2;
      board.solutionRot[oidx] = cells[oidx].rot;
      if (solutionOk()) oneMade++;
      else restoreCell(oidx, oSave);
    }

    /* ---- 保证开局不是已经接通（否则玩家会陷入“无动作结束”） ---- */
    function currentProbe() {
      return PG.withRots(board, cells.map(function (c) { return c.rot; }));
    }
    var guard = 0;
    while (derive(currentProbe()).ok && guard < 160) {
      var movable = [];
      for (var mi = 0; mi < cells.length; mi++) {
        if (!cells[mi].fixed && !cells[mi].immutable && cells[mi].openCount > 0) movable.push(mi);
      }
      if (!movable.length) break;
      var pick = movable[Math.floor(rng() * movable.length)];
      cells[pick].rot = (cells[pick].rot + 1) % 4;
      guard++;
    }

    var minMoves = 0;
    for (var mm = 0; mm < cells.length; mm++) {
      minMoves += turnsTo(cells[mm], cells[mm].rot, board.solutionRot[mm]);
    }
    board.minMoves = minMoves;
    board.budget = Math.max(Number(cfg.budget) || 0, minMoves + (cfg.slack == null ? 8 : cfg.slack));
    board.oneWayCount = 0;
    board.crossCount = 0;
    for (var ft = 0; ft < cells.length; ft++) {
      if (cells[ft].type === 'W') board.oneWayCount++;
      else if (cells[ft].type === 'C') board.crossCount++;
    }
    board.initialSolved = derive(currentProbe()).ok;
    return board;
  }

  return {
    DIR: DIR, ALL_TYPES: ALL_TYPES,
    mask: maskOf, countMask: countMask,
    groupFor: groupFor, portsFor: portsFor,
    derive: derive, turnsTo: turnsTo,
    makeBoard: makeBoard
  };
})();

/* ============================================================
   游戏界面与交互
   ============================================================ */
(function () {
  var root = document.getElementById('game-root');
  if (!root) return;
  var T_ = T;
  var W = 520, H = 520;
  var GAME_ID = 'circuit';
  var PROGRESS_KEY = 'arcade_progress_circuit';

  /* 每关固定种子 / 尺寸 / 预算；单向与交叉数量随难度增加 */
  var CHAPTERS = {
    novice: {
      nameKey: 'gs.circuit.chNovice',
      levels: [
        { seed: 104729, cols: 4, rows: 4, diff: 2, sinks: 1, budget: 20, slack: 10, oneWays: 1, crosses: 0 },
        { seed: 130363, cols: 4, rows: 5, diff: 3, sinks: 1, budget: 30, slack: 10, oneWays: 1, crosses: 1 },
        { seed: 365379, cols: 5, rows: 5, diff: 4, sinks: 1, budget: 22, slack: 10, oneWays: 2, crosses: 1 },
        { seed: 196613, cols: 5, rows: 6, diff: 5, sinks: 2, budget: 42, slack: 12, oneWays: 2, crosses: 2 },
        { seed: 216839, cols: 6, rows: 6, diff: 6, sinks: 2, budget: 45, slack: 14, oneWays: 3, crosses: 2 }
      ]
    },
    advanced: {
      nameKey: 'gs.circuit.chAdvanced',
      levels: [
        { seed: 262147, cols: 6, rows: 6, diff: 7, sinks: 2, budget: 45, slack: 14, oneWays: 3, crosses: 3 },
        { seed: 319483, cols: 6, rows: 7, diff: 8, sinks: 2, budget: 48, slack: 14, oneWays: 4, crosses: 3 },
        { seed: 373591, cols: 7, rows: 7, diff: 9, sinks: 3, budget: 54, slack: 16, oneWays: 5, crosses: 4 },
        { seed: 405829, cols: 7, rows: 7, diff: 10, sinks: 3, budget: 66, slack: 16, oneWays: 6, crosses: 4 },
        { seed: 447079, cols: 7, rows: 7, diff: 11, sinks: 3, budget: 64, slack: 18, oneWays: 6, crosses: 5 },
        { seed: 900405, cols: 7, rows: 7, diff: 12, sinks: 3, budget: 62, slack: 18, oneWays: 7, crosses: 5 }
      ]
    }
  };
  var CHAPTER_ORDER = ['novice', 'advanced'];
  var DAILY = { cols: 7, rows: 7, diff: 9, sinks: 3, budget: 72, slack: 8, oneWays: 6, crosses: 5 };

  /* 本页私有样式（共享 CSS 只读，按约定在脚本内注入） */
  var styleEl = document.createElement('style');
  styleEl.textContent =
    '#game-root .btn{min-height:44px}' +
    '.ci-wrap{width:min(540px,100%);box-sizing:border-box;margin:0 auto;padding:10px 8px 18px}' +
    '.ci-head{padding:0 10px;gap:3px 9px}' +
    '.ci-head span{font-size:11.5px}' +
    '.ci-barwrap{margin:0 10px 6px;height:4px;border-radius:2px;background:rgba(0,240,255,0.09);overflow:hidden}' +
    '.ci-bar{height:100%;width:0;background:#00f0ff;box-shadow:0 0 8px rgba(0,240,255,0.8);transition:width .2s,background .2s}' +
    '.ci-goal{padding:0 10px;margin:0 0 4px;min-height:15px;font-size:11px;color:var(--text-dim)}' +
    '.ci-msg{padding:0 10px;font-size:12.5px}' +
    '.ci-chapters{display:flex;gap:6px;padding:0 10px;margin-top:8px}' +
    '.ci-ch{flex:1;min-height:44px;appearance:none;border:1px solid rgba(0,240,255,0.22);' +
      'background:rgba(9,32,43,0.82);color:var(--text-dim);border-radius:9px;font-size:12px;' +
      'cursor:pointer;padding:0 4px;transition:border-color .15s,color .15s,box-shadow .15s}' +
    '.ci-ch:hover{border-color:rgba(0,240,255,0.6);color:#c8fbff}' +
    '.ci-ch.sel{border-color:#00f0ff;color:#dfffff;box-shadow:0 0 12px rgba(0,240,255,0.3)}' +
    '.ci-levels{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:0 10px;margin:8px 0 0}' +
    '.ci-lv{min-height:44px;position:relative}' +
    '.ci-lv.clear{border-color:rgba(93,255,167,0.5);color:#c7ffe1}' +
    '.ci-lv.clear::after{content:"";position:absolute;right:6px;top:6px;width:5px;height:5px;' +
      'border-radius:50%;background:#5dffa7;box-shadow:0 0 6px #5dffa7}' +
    '.ci-daily-row{display:flex;align-items:center;gap:8px;padding:0 10px;margin-top:8px;flex-wrap:wrap}' +
    '.ci-daily-btn{flex:1;min-height:44px;appearance:none;border:1px solid rgba(255,209,102,0.28);' +
      'background:rgba(43,31,9,0.8);color:#ffd98a;border-radius:9px;font-size:12px;cursor:pointer;' +
      'transition:border-color .15s,color .15s,box-shadow .15s}' +
    '.ci-daily-btn:hover{border-color:rgba(255,209,102,0.7);color:#fff0c4}' +
    '.ci-daily-btn.sel{border-color:#ffd166;box-shadow:0 0 12px rgba(255,209,102,0.3);color:#fff3cc}' +
    '.ci-daily-btn.done{border-color:rgba(93,255,167,0.55);color:#c7ffe1}' +
    '.ci-daily{flex:1.5;min-width:150px;font-size:11px;line-height:1.5;color:var(--text-dim);text-align:left}' +
    '.ci-moves.danger{color:#ff6b7d}';
  document.head.appendChild(styleEl);

  var wrap = document.createElement('div');
  wrap.className = 'ci-wrap';
  wrap.innerHTML =
    '<div class="ci-head">' +
    '  <span id="ci-level"></span><span id="ci-moves" class="ci-moves"></span>' +
    '  <span id="ci-time"></span><span id="ci-power"></span>' +
    '</div>' +
    '<div class="ci-barwrap"><div class="ci-bar" id="ci-bar"></div></div>' +
    '<div class="ci-goal" id="ci-goal"></div>' +
    '<div class="ci-stage" id="ci-stage">' +
    '  <canvas id="ci-canvas" class="ci-canvas" aria-label="' + T_('gs.circuit.canvasAria') + '"></canvas>' +
    '  <div class="ci-paused hidden" id="ci-paused"></div>' +
    '  <div class="ci-overlay hidden" id="ci-overlay">' +
    '    <div class="ci-ov-card">' +
    '      <div class="ci-ov-title" id="ci-ov-title"></div>' +
    '      <div class="ci-ov-stats" id="ci-ov-stats"></div>' +
    '      <div class="ci-ov-score" id="ci-ov-score"></div>' +
    '      <div class="ci-ov-best" id="ci-ov-best"></div>' +
    '      <div class="ci-ov-btns">' +
    '        <button class="btn green" id="ci-next"></button>' +
    '        <button class="btn" id="ci-replay"></button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="ci-msg" id="ci-msg" aria-live="polite"></div>' +
    '<div class="ci-chapters" id="ci-chapters"></div>' +
    '<div class="ci-levels" id="ci-levels"></div>' +
    '<div class="ci-daily-row">' +
    '  <button class="ci-daily-btn" id="ci-daily-btn"></button>' +
    '  <span class="ci-daily" id="ci-daily"></span>' +
    '</div>' +
    '<div class="game-controls">' +
    '  <button class="btn purple" id="ci-restart"></button>' +
    '  <button class="btn" id="ci-pause"></button>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#ci-canvas');
  var gk = GK.setup(canvas, W, H);
  var ctx = gk.ctx;
  var msgEl = wrap.querySelector('#ci-msg');
  var levelEl = wrap.querySelector('#ci-level');
  var movesEl = wrap.querySelector('#ci-moves');
  var timeEl = wrap.querySelector('#ci-time');
  var powerEl = wrap.querySelector('#ci-power');
  var goalEl = wrap.querySelector('#ci-goal');
  var barEl = wrap.querySelector('#ci-bar');
  var chapterRow = wrap.querySelector('#ci-chapters');
  var levelRow = wrap.querySelector('#ci-levels');
  var dailyEl = wrap.querySelector('#ci-daily');
  var dailyBtn = wrap.querySelector('#ci-daily-btn');
  var overlayEl = wrap.querySelector('#ci-overlay');
  var ovTitle = wrap.querySelector('#ci-ov-title');
  var ovStats = wrap.querySelector('#ci-ov-stats');
  var ovScore = wrap.querySelector('#ci-ov-score');
  var ovBest = wrap.querySelector('#ci-ov-best');
  var nextBtn = wrap.querySelector('#ci-next');
  var replayBtn = wrap.querySelector('#ci-replay');
  var restartBtn = wrap.querySelector('#ci-restart');
  var pauseBtn = wrap.querySelector('#ci-pause');
  var pausedEl = wrap.querySelector('#ci-paused');

  /* ---------------- 进度（自有键，不动共享键） ---------------- */
  function defaultProgress() {
    var p = { v: 1, ch: {}, last: { ch: 'novice', li: 0 } };
    CHAPTER_ORDER.forEach(function (k) {
      p.ch[k] = { best: [] };
      var n = CHAPTERS[k].levels.length;
      for (var i = 0; i < n; i++) p.ch[k].best.push(-1);
    });
    return p;
  }
  function loadProgress() {
    var def = defaultProgress();
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return def;
      var o = JSON.parse(raw);
      if (!o || o.v !== 1 || !o.ch) return def;
      var p = defaultProgress();
      CHAPTER_ORDER.forEach(function (k) {
        var src = o.ch[k] && o.ch[k].best;
        var n = CHAPTERS[k].levels.length;
        for (var i = 0; i < n; i++) {
          var v = Array.isArray(src) ? Number(src[i]) : -1;
          p.ch[k].best[i] = (isFinite(v) && v >= 0) ? Math.floor(v) : -1;
        }
      });
      if (o.last && CHAPTERS[o.last.ch]) {
        var li = Number(o.last.li);
        if (isFinite(li) && li >= 0 && li < CHAPTERS[o.last.ch].levels.length) {
          p.last = { ch: o.last.ch, li: Math.floor(li) };
        }
      }
      return p;
    } catch (e) { return def; }
  }
  var progress = loadProgress();
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function chapterClearedCount(ch) {
    var b = progress.ch[ch].best, n = 0;
    for (var i = 0; i < b.length; i++) if (b[i] >= 0) n++;
    return n;
  }
  function chapterAllCleared(ch) {
    return chapterClearedCount(ch) === CHAPTERS[ch].levels.length;
  }
  function allChaptersCleared() {
    for (var i = 0; i < CHAPTER_ORDER.length; i++) {
      if (!chapterAllCleared(CHAPTER_ORDER[i])) return false;
    }
    return true;
  }
  function firstOpenLevel(ch) {
    var b = progress.ch[ch].best;
    for (var i = 0; i < b.length; i++) if (b[i] < 0) return i;
    return 0;
  }

  /* ---------------- 运行状态 ---------------- */
  var board = null;
  var mode = 'campaign';
  var chapterKey = 'novice';
  var levelIdx = 0;
  var seed = 1;
  var budget = 0;
  var moves = 0;
  var elapsed = 0;
  var lastNow = 0;
  var paused = false;
  var won = false;
  var failed = false;
  var power = null;
  var lit = 0;
  var sinkTotal = 0;
  var flashT = 0;
  var winAnim = 0;
  var animStart = [];
  var glowAt = [];
  var pulseAt = 0, pulseReady = false, powerDepth = [], powerMaxDepth = 1;
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var cursor = { r: 0, c: 0 };
  var pressCell = null;
  var dragTarget = null;
  var layout = { cell: 40, ox: 10, oy: 10 };

  function idxOf(r, c) { return r * board.cols + c; }
  function cellPos(i) {
    var r = Math.floor(i / board.cols), c = i % board.cols;
    return {
      x: layout.ox + (c + 0.5) * layout.cell,
      y: layout.oy + (r + 0.5) * layout.cell
    };
  }
  function layoutBoard() {
    var cols = board.cols, rows = board.rows;
    var pad = 8;
    var cell = Math.min((W - pad) / cols, (H - pad) / rows);
    layout = { cell: cell, ox: (W - cell * cols) / 2, oy: (H - cell * rows) / 2 };
  }
  function motionOff() { return !!(motionQuery && motionQuery.matches); }
  function recalc() {
    var oldLit = lit, oldOk = !!(power && power.ok);
    power = CircuitGen.derive(board);
    lit = power.connectedSinks.length;
    sinkTotal = (board.sinks || []).length;
    powerDepth = [];
    powerMaxDepth = 1;
    for (var di = 0; di < board.cells.length; di++) powerDepth.push(0);
    for (var pi = 0; pi < power.reached.length; pi++) {
      var ci = power.reached[pi], par = power.parents[ci];
      powerDepth[ci] = par >= 0 ? powerDepth[par] + 1 : 0;
      if (powerDepth[ci] > powerMaxDepth) powerMaxDepth = powerDepth[ci];
    }
    if (pulseReady && (lit > oldLit || (!oldOk && power.ok))) pulseAt = performance.now();
    pulseReady = true;
  }
  function timeSec() { return Math.floor(elapsed / 1000); }
  function currentLevels() { return CHAPTERS[chapterKey].levels; }
  function dailySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function todayStr() {
    return (window.Arcade && Arcade.daily && Arcade.daily.dayStr) ? Arcade.daily.dayStr() : '';
  }
  function writeSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
  }

  /* ---------------- 选关界面 ---------------- */
  function renderNav() {
    chapterRow.innerHTML = '';
    CHAPTER_ORDER.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ci-ch' + (mode === 'campaign' && k === chapterKey ? ' sel' : '');
      b.textContent = T_('gs.circuit.chTab')
        .replace('{name}', T_(CHAPTERS[k].nameKey))
        .replace('{done}', chapterClearedCount(k))
        .replace('{total}', CHAPTERS[k].levels.length);
      b.addEventListener('click', function () {
        if (Arcade.audio) Arcade.audio.play('ui');
        var target = (mode === 'campaign' && k === chapterKey) ? levelIdx : firstOpenLevel(k);
        startChapter(k, target);
      });
      chapterRow.appendChild(b);
    });

    levelRow.innerHTML = '';
    if (mode === 'campaign') {
      var lvs = currentLevels();
      for (var i = 0; i < lvs.length; i++) {
        var lb = document.createElement('button');
        lb.type = 'button';
        lb.className = 'ci-lv' + (i === levelIdx ? ' sel' : '') +
          (progress.ch[chapterKey].best[i] >= 0 ? ' clear' : '');
        lb.textContent = String(i + 1);
        lb.title = T_(CHAPTERS[chapterKey].nameKey) + ' · ' + T_('gs.circuit.levelN').replace('{n}', i + 1);
        lb.setAttribute('aria-label', lb.title);
        (function (idx) {
          lb.addEventListener('click', function () {
            if (Arcade.audio) Arcade.audio.play('ui');
            loadLevel(idx);
          });
        })(i);
        levelRow.appendChild(lb);
      }
    }
    levelRow.style.display = mode === 'daily' ? 'none' : '';
    dailyBtn.classList.toggle('sel', mode === 'daily');
  }

  function updateDailyStatus() {
    var solved = (window.Arcade && Arcade.daily) ? Arcade.daily.solvedTime(GAME_ID) : null;
    var streak = (window.Arcade && Arcade.daily) ? Arcade.daily.streak() : 0;
    var date = todayStr();
    var t = solved == null ? '----' : GK.fmtTime(Number(solved) * 1000);
    dailyEl.textContent = T_(solved == null ? 'gs.circuit.dailyTodo' : 'gs.circuit.dailyDone')
      .replace('{date}', date).replace('{s}', streak).replace('{t}', t);
    dailyBtn.textContent = T_(solved == null ? 'gs.circuit.dailyBtn' : 'gs.circuit.dailyBtnDone');
    dailyBtn.classList.toggle('done', solved != null);
  }

  function updateHud() {
    if (!board) return;
    if (mode === 'daily') {
      levelEl.textContent = T_('gs.circuit.dailyLevel');
      goalEl.textContent = T_('gs.circuit.dailyGoal').replace('{n}', sinkTotal);
    } else {
      levelEl.textContent = T_('gs.circuit.levelLbl')
        .replace('{name}', T_(CHAPTERS[chapterKey].nameKey))
        .replace('{n}', levelIdx + 1)
        .replace('{m}', currentLevels().length);
      goalEl.textContent = T_('gs.circuit.goalLbl').replace('{n}', sinkTotal) +
        ' · ' + T_('gs.circuit.minHint').replace('{n}', board.minMoves);
    }
    movesEl.textContent = T_('gs.circuit.movesBudget').replace('{n}', moves).replace('{m}', budget);
    timeEl.textContent = T_('gs.circuit.timeLbl').replace('{t}', GK.fmtTime(elapsed));
    powerEl.textContent = T_('gs.circuit.poweredLbl').replace('{n}', lit).replace('{m}', sinkTotal);
    var pct = budget > 0 ? Math.min(100, (moves / budget) * 100) : 0;
    barEl.style.width = pct + '%';
    var danger = moves >= budget;
    movesEl.classList.toggle('danger', moves >= budget || (budget > 0 && moves >= budget - 2));
    barEl.style.background = danger ? '#ff4d6a' : (moves >= budget * 0.72 ? '#ffd166' : '#00f0ff');
    updateDailyStatus();
  }

  function applyStates(states) {
    if (!Array.isArray(states) || states.length !== board.cells.length) return false;
    for (var i = 0; i < board.cells.length; i++) {
      var cell = board.cells[i];
      if (cell.fixed) continue;
      var st = states[i];
      if (!Array.isArray(st) || st.length < 2) continue;
      var t = String(st[0]);
      var r = Number(st[1]);
      if (!CircuitGen.ALL_TYPES[t] || !(r >= 0 && r < 4)) continue;
      cell.type = t;
      cell.rot = Math.floor(r);
      cell.immutable = (t === 'C');
      cell.openCount = CircuitGen.countMask(CircuitGen.mask(cell));
    }
    return true;
  }

  function assignBoard(o) {
    o = o || {};
    mode = o.mode === 'daily' ? 'daily' : 'campaign';
    if (mode === 'campaign') {
      chapterKey = CHAPTERS[o.ch] ? o.ch : chapterKey;
      var maxLv = CHAPTERS[chapterKey].levels.length - 1;
      levelIdx = GK.clamp(Number(o.li) || 0, 0, maxLv);
    } else {
      levelIdx = 0;
    }
    var cfg = mode === 'daily' ? DAILY : CHAPTERS[chapterKey].levels[levelIdx];
    seed = mode === 'daily' ? dailySeed() : cfg.seed;
    board = CircuitGen.makeBoard(cfg, seed);
    budget = board.budget;
    if (o.states) applyStates(o.states);
    moves = Math.max(0, Number(o.moves) || 0);
    elapsed = Math.max(0, Number(o.elapsed) || 0);
    paused = false;
    won = false;
    failed = false;
    flashT = 0;
    winAnim = 0;
    animStart = [];
    glowAt = [];
    pressCell = null;
    dragTarget = null;
    pulseAt = 0;
    pulseReady = false;
    lastNow = performance.now();
    cursor = board.sourcePos ? { r: board.sourcePos.r, c: board.sourcePos.c } : { r: 0, c: 0 };
    layoutBoard();
    recalc();
    overlayEl.classList.add('hidden');
    pausedEl.classList.add('hidden');
    restartBtn.textContent = T_('gs.circuit.restart');
    pauseBtn.textContent = T_('gs.circuit.pause');
    if (mode === 'daily') {
      msgEl.textContent = T_('gs.circuit.dailyStartMsg');
    } else {
      var hint = T_('gs.circuit.startMsg') + ' · ' + T_('gs.circuit.minHint').replace('{n}', board.minMoves);
      if (board.oneWayCount || board.crossCount) {
        hint += ' · ' + T_('gs.circuit.featureHint')
          .replace('{w}', board.oneWayCount).replace('{c}', board.crossCount);
      }
      msgEl.textContent = hint;
    }
    renderNav();
    updateHud();
  }

  function loadLevel(li) {
    assignBoard({ mode: 'campaign', ch: chapterKey, li: li });
    progress.last = { ch: chapterKey, li: levelIdx };
    saveProgress();
    writeSave();
  }
  function startChapter(ch, li) {
    if (!CHAPTERS[ch]) return;
    assignBoard({ mode: 'campaign', ch: ch, li: li == null ? firstOpenLevel(ch) : li });
    progress.last = { ch: chapterKey, li: levelIdx };
    saveProgress();
    writeSave();
  }
  function startDaily() {
    assignBoard({ mode: 'daily' });
    writeSave();
  }
  function backToCampaign() {
    var p = progress.last;
    startChapter(p.ch, p.li);
  }
  function startInitial() {
    var p = progress.last;
    startChapter(p.ch, p.li);
  }

  /* ---------------- 结算 ---------------- */
  function newSinkColors(i) {
    var p = cellPos(i);
    GK.burst(canvas, p.x, p.y, '#ffe88a', 14);
  }

  function completeLevel() {
    won = true;
    winAnim = 0.01;
    flashT = 0;
    pressCell = null;
    dragTarget = null;
    msgEl.textContent = T_(mode === 'daily' ? 'gs.circuit.dailyWinMsg' : 'gs.circuit.winMsg');
    if (Arcade.juice) Arcade.juice.win();
    if (Arcade.fx) Arcade.fx.shake(canvas);
    for (var s = 0; s < (board.sinks || []).length; s++) newSinkColors(board.sinks[s]);
    if (board.sources && board.sources.length) {
      var srcP = cellPos(board.sources[0]);
      GK.burst(canvas, srcP.x, srcP.y, '#00f0ff', 18);
    }

    if (mode === 'daily') {
      var wasSolved = (window.Arcade && Arcade.daily) ? Arcade.daily.isSolved(GAME_ID) : false;
      var sec = Math.max(1, timeSec());
      var fresh = false;
      if (window.Arcade && Arcade.daily) fresh = Arcade.daily.markSolved(GAME_ID, sec);
      var solved = (window.Arcade && Arcade.daily) ? Arcade.daily.solvedTime(GAME_ID) : sec;
      var streak = (window.Arcade && Arcade.daily) ? Arcade.daily.streak() : 0;
      ovTitle.textContent = T_(wasSolved ? 'gs.circuit.dailyRepeatTitle' : 'gs.circuit.dailyTitle');
      ovStats.textContent = T_('gs.circuit.dailyStats')
        .replace('{time}', GK.fmtTime(elapsed)).replace('{moves}', moves)
        .replace('{budget}', budget).replace('{lit}', lit).replace('{total}', sinkTotal);
      ovScore.textContent = T_('gs.circuit.dailyRound')
        .replace('{s}', streak).replace('{t}', GK.fmtTime(Number(solved) * 1000)) +
        (fresh ? ' · ' + T_('gs.circuit.dailyFresh') : '');
      ovBest.textContent = T_('gs.circuit.dailyNoBest');
      nextBtn.textContent = T_('gs.circuit.dailyAgain');
      replayBtn.textContent = T_('gs.circuit.dailyBack');
      overlayEl.classList.remove('hidden');
      updateHud();
      writeSave();
      return;
    }

    var best = progress.ch[chapterKey].best[levelIdx];
    if (best < 0 || moves < best) {
      progress.ch[chapterKey].best[levelIdx] = moves;
      saveProgress();
    }
    renderNav();

    var isLast = levelIdx >= currentLevels().length - 1;
    var allDone = chapterAllCleared(chapterKey);
    var submitted = false;
    var newRecord = false;
    if (allDone) {
      var total = 0;
      for (var b = 0; b < progress.ch[chapterKey].best.length; b++) total += progress.ch[chapterKey].best[b];
      var curBest = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest(GAME_ID) : null;
      var improves = curBest == null || total < Number(curBest);
      if (total > 0 && improves && window.Arcade && Arcade.shell) newRecord = Arcade.shell.submitScore(total);
      submitted = true;
    }
    var bestScore = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest(GAME_ID) : null;
    var everything = allChaptersCleared();

    if (isLast && allDone) {
      ovTitle.textContent = T_(everything ? 'gs.circuit.allTitle' : 'gs.circuit.chapterTitle')
        .replace('{name}', T_(CHAPTERS[chapterKey].nameKey));
    } else {
      ovTitle.textContent = T_('gs.circuit.winTitle');
    }
    ovStats.textContent = T_('gs.circuit.winStats')
      .replace('{lit}', lit).replace('{total}', sinkTotal)
      .replace('{moves}', moves).replace('{budget}', budget)
      .replace('{time}', GK.fmtTime(elapsed));
    if (allDone && submitted) {
      var chapterTotal = 0;
      for (var c2 = 0; c2 < progress.ch[chapterKey].best.length; c2++) chapterTotal += progress.ch[chapterKey].best[c2];
      ovScore.textContent = T_('gs.circuit.chapterScore').replace('{n}', chapterTotal) +
        (newRecord ? ' · ' + T_('gs.circuit.newRecord') : '');
    } else {
      ovScore.textContent = T_('gs.circuit.levelScore').replace('{n}', moves).replace('{m}', budget);
    }
    ovBest.textContent = T_('gs.circuit.bestLbl').replace('{n}', bestScore == null ? '----' : bestScore);

    if (isLast) {
      var ci = CHAPTER_ORDER.indexOf(chapterKey);
      nextBtn.textContent = T_(ci < CHAPTER_ORDER.length - 1 ? 'gs.circuit.nextChapter' : 'gs.circuit.replayChapter');
    } else {
      nextBtn.textContent = T_('gs.circuit.next');
    }
    replayBtn.textContent = T_('gs.circuit.replay');
    overlayEl.classList.remove('hidden');
    updateHud();
    writeSave();
  }

  function failLevel() {
    failed = true;
    pressCell = null;
    dragTarget = null;
    flashT = 1;
    msgEl.textContent = T_('gs.circuit.failMsg');
    if (Arcade.audio) Arcade.audio.play('lose');
    if (Arcade.fx) Arcade.fx.shake(canvas);
    var bestScore = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest(GAME_ID) : null;
    ovTitle.textContent = T_('gs.circuit.failTitle');
    ovStats.textContent = T_('gs.circuit.failStats')
      .replace('{n}', moves).replace('{m}', budget)
      .replace('{lit}', lit).replace('{total}', sinkTotal);
    ovScore.textContent = T_('gs.circuit.failHint');
    ovBest.textContent = T_('gs.circuit.bestLbl').replace('{n}', bestScore == null ? '----' : bestScore);
    nextBtn.textContent = T_('gs.circuit.replay');
    replayBtn.textContent = T_('gs.circuit.backToLevels');
    overlayEl.classList.remove('hidden');
    updateHud();
    writeSave();
  }

  /* ---------------- 动作 ---------------- */
  function canAct() { return !!board && !won && !failed && !paused; }

  function snapshotPower() {
    return { lit: lit, sinks: power ? power.connectedSinks.slice() : [] };
  }

  function afterAction(prev, kind) {
    recalc();
    var gained = [];
    for (var i = 0; i < (power.connectedSinks || []).length; i++) {
      var si = power.connectedSinks[i];
      if (prev.sinks.indexOf(si) < 0) gained.push(si);
    }
    for (var g = 0; g < gained.length; g++) {
      var sp = cellPos(gained[g]);
      GK.burst(canvas, sp.x, sp.y, '#ffe88a', 14);
    }
    updateHud();
    if (power.ok) { completeLevel(); return; }
    if (moves >= budget) { failLevel(); return; }
    if (lit > prev.lit) {
      msgEl.textContent = T_('gs.circuit.flowing').replace('{n}', lit).replace('{m}', sinkTotal);
      if (Arcade.audio) Arcade.audio.play('coin');
    } else if (lit < prev.lit) {
      flashT = 1;
      if (Arcade.audio) Arcade.audio.play('error');
      msgEl.textContent = T_('gs.circuit.breakFlow');
    } else if (kind === 'swap') {
      msgEl.textContent = T_('gs.circuit.swapDone');
    } else if (power.reached.length > 1) {
      msgEl.textContent = T_('gs.circuit.charging').replace('{n}', lit).replace('{m}', sinkTotal);
    } else {
      msgEl.textContent = T_('gs.circuit.aligned');
    }
    writeSave();
  }

  function rotateAt(r, c) {
    if (!canAct()) return;
    if (r < 0 || c < 0 || r >= board.rows || c >= board.cols) return;
    var i = idxOf(r, c), cell = board.cells[i];
    if (cell.openCount === 0) {
      msgEl.textContent = T_('gs.circuit.emptyCell');
      return;
    }
    if (cell.fixed) {
      msgEl.textContent = T_('gs.circuit.locked');
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(canvas);
      return;
    }
    if (cell.type === 'C') {
      msgEl.textContent = T_('gs.circuit.crossNoRotate');
      if (Arcade.audio) Arcade.audio.play('ui');
      return;
    }
    var prev = snapshotPower();
    cell.rot = (cell.rot + 1) % 4;
    animStart[i] = performance.now();
    moves++;
    if (Arcade.juice) Arcade.juice.rotate();
    afterAction(prev, 'rotate');
  }

  function swapCells(a, b) {
    if (!canAct()) return;
    if (a.r === b.r && a.c === b.c) { rotateAt(a.r, a.c); return; }
    var ia = idxOf(a.r, a.c), ib = idxOf(b.r, b.c);
    var ca = board.cells[ia], cb = board.cells[ib];
    if (ca.openCount === 0 || cb.openCount === 0) {
      msgEl.textContent = T_('gs.circuit.emptyCell');
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    if (ca.fixed || cb.fixed) {
      msgEl.textContent = T_('gs.circuit.locked');
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(canvas);
      return;
    }
    if (ca.type === 'C' || cb.type === 'C') {
      msgEl.textContent = T_('gs.circuit.crossLocked');
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    var prev = snapshotPower();
    var tt = ca.type, tr = ca.rot, to = ca.openCount;
    ca.type = cb.type; ca.rot = cb.rot; ca.openCount = cb.openCount;
    cb.type = tt; cb.rot = tr; cb.openCount = to;
    var now = performance.now();
    glowAt[ia] = now; glowAt[ib] = now;
    moves++;
    if (Arcade.audio) Arcade.audio.play('drop');
    afterAction(prev, 'swap');
  }

  function togglePause(force) {
    if (!board || won || failed) return;
    paused = force != null ? !!force : !paused;
    pausedEl.textContent = T_('gs.circuit.paused');
    pausedEl.classList.toggle('hidden', !paused);
    pauseBtn.textContent = T_(paused ? 'gs.circuit.resume' : 'gs.circuit.pause');
    lastNow = performance.now();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------------- 按钮 ---------------- */
  nextBtn.addEventListener('click', function () {
    if (Arcade.audio) Arcade.audio.play('ui');
    if (failed) { loadCurrent(); return; }
    if (!won) return;
    if (mode === 'daily') { startDaily(); return; }
    if (levelIdx < currentLevels().length - 1) { loadLevel(levelIdx + 1); return; }
    var ci = CHAPTER_ORDER.indexOf(chapterKey);
    if (ci < CHAPTER_ORDER.length - 1) startChapter(CHAPTER_ORDER[ci + 1], 0);
    else loadLevel(0);
  });
  replayBtn.addEventListener('click', function () {
    if (Arcade.audio) Arcade.audio.play('ui');
    if (failed) {
      overlayEl.classList.add('hidden');
      msgEl.textContent = T_('gs.circuit.selectHint');
      return;
    }
    if (mode === 'daily') { backToCampaign(); return; }
    if (won) { loadLevel(levelIdx); return; }
    loadCurrent();
  });
  restartBtn.addEventListener('click', function () {
    if (Arcade.audio) Arcade.audio.play('ui');
    loadCurrent();
  });
  pauseBtn.addEventListener('click', function () { togglePause(); });
  dailyBtn.addEventListener('click', function () {
    if (Arcade.audio) Arcade.audio.play('ui');
    startDaily();
  });

  function loadCurrent() {
    if (mode === 'daily') startDaily();
    else loadLevel(levelIdx);
  }

  /* ---------------- 输入 ---------------- */
  function cellFromEvent(e) {
    var p = GK.pointer(canvas, e);
    var c = Math.floor((p.x - layout.ox) / layout.cell);
    var r = Math.floor((p.y - layout.oy) / layout.cell);
    if (c < 0 || r < 0 || c >= board.cols || r >= board.rows) return null;
    return { r: r, c: c };
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!canAct()) return;
    var cc = cellFromEvent(e);
    if (!cc) return;
    pressCell = cc;
    dragTarget = null;
    cursor = { r: cc.r, c: cc.c };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pressCell || !canAct()) return;
    e.preventDefault();
    var cc = cellFromEvent(e);
    if (!cc) return;
    cursor = cc;
    dragTarget = (cc.r === pressCell.r && cc.c === pressCell.c) ? null : cc;
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!pressCell) return;
    var from = pressCell;
    pressCell = null;
    dragTarget = null;
    if (!canAct()) return;
    var cc = cellFromEvent(e);
    if (cc && cc.r === from.r && cc.c === from.c) rotateAt(from.r, from.c);
    else if (cc) swapCells(from, cc);
  });
  canvas.addEventListener('pointercancel', function () {
    pressCell = null;
    dragTarget = null;
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function moveCursor(dr, dc) {
    if (!canAct()) return;
    cursor.r = GK.clamp(cursor.r + dr, 0, board.rows - 1);
    cursor.c = GK.clamp(cursor.c + dc, 0, board.cols - 1);
    if (Arcade.audio) Arcade.audio.play('move');
  }
  if (window.Arcade && Arcade.input) {
    Arcade.input.onKeys({
      up: function () { moveCursor(-1, 0); },
      down: function () { moveCursor(1, 0); },
      left: function () { moveCursor(0, -1); },
      right: function () { moveCursor(0, 1); },
      action: function () { rotateAt(cursor.r, cursor.c); }
    });
  }
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyP') {
      e.preventDefault();
      togglePause();
    }
  });

  /* ---------------- 存档 ---------------- */
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'circuit',
      collect: function () {
        if (!board || won || failed) return null;
        return {
          v: 3,
          mode: mode,
          ch: chapterKey,
          li: levelIdx,
          day: mode === 'daily' ? todayStr() : '',
          moves: moves,
          elapsed: elapsed,
          states: board.cells.map(function (c) { return [c.type, c.rot]; })
        };
      },
      apply: function (s) {
        if (!s || s.v !== 3) return false;
        var m = s.mode === 'daily' ? 'daily' : 'campaign';
        if (m === 'daily' && s.day !== todayStr()) return false;
        if (m === 'campaign' && !CHAPTERS[s.ch]) return false;
        var li = Number(s.li);
        if (m === 'campaign' && (!(li >= 0) || li >= CHAPTERS[s.ch].levels.length)) return false;
        assignBoard({ mode: m, ch: s.ch, li: li, states: s.states, moves: s.moves, elapsed: s.elapsed });
        if (!won && !failed && moves >= budget && !power.ok) return false;
        return true;
      }
    });
  }

  /* ---------------- 渲染 ---------------- */
  var COL = {
    copperA: '#5a2a08', copperB: '#ffd28a', copperHi: '#fff1c9',
    hotA: '#007a92', hotB: '#8ffcff', hotHi: '#e8ffff',
    red: '#ff3b52', gold: '#ffd166', dim: '#4a6b7a'
  };

  function drawBackground(now) {
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#050d15');
    grad.addColorStop(0.55, '#081722');
    grad.addColorStop(1, '#050d15');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    /* 环境流光：斜向低强度扫光，静止时也让画面有呼吸感 */
    if (!motionOff()) {
      var span = W * 0.85;
      var sx = -span + ((now % 8000) / 8000) * (W + span * 2);
      var sg = ctx.createLinearGradient(sx, 0, sx + span, H);
      sg.addColorStop(0, 'rgba(0,240,255,0)');
      sg.addColorStop(0.5, 'rgba(0,240,255,0.035)');
      sg.addColorStop(1, 'rgba(0,240,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    }
    if (!board) return;
    var step = layout.cell;
    ctx.save();
    ctx.strokeStyle = 'rgba(42,110,130,0.13)';
    ctx.lineWidth = 1;
    for (var x = layout.ox; x <= layout.ox + step * board.cols + 0.5; x += step) {
      ctx.beginPath(); ctx.moveTo(x, layout.oy); ctx.lineTo(x, layout.oy + step * board.rows); ctx.stroke();
    }
    for (var y = layout.oy; y <= layout.oy + step * board.rows + 0.5; y += step) {
      ctx.beginPath(); ctx.moveTo(layout.ox, y); ctx.lineTo(layout.ox + step * board.cols, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,190,210,0.16)';
    for (var rr = 0; rr <= board.rows; rr++) {
      for (var cc = 0; cc <= board.cols; cc++) {
        ctx.beginPath();
        ctx.arc(layout.ox + cc * step, layout.oy + rr * step, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    var border = Math.max(2, step * 0.09);
    ctx.save();
    GK.roundRect(ctx, layout.ox - border, layout.oy - border,
      step * board.cols + border * 2, step * board.rows + border * 2, step * 0.16);
    ctx.fillStyle = 'rgba(8,28,38,0.75)';
    ctx.fill();
    var edgeColor;
    if (failed) edgeColor = motionOff() ? 'rgba(255,70,90,0.7)' : 'rgba(255,70,90,' + (0.5 + Math.sin(now / 160) * 0.3) + ')';
    else if (won) edgeColor = motionOff() ? 'rgba(0,240,255,0.7)' : 'rgba(0,240,255,' + (0.5 + Math.sin(now / 190) * 0.25) + ')';
    else edgeColor = 'rgba(30,90,105,0.65)';
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = border * 0.7;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlate(x, y, s, cell) {
    var pad = s * 0.055;
    var g = ctx.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, '#0d2a38');
    g.addColorStop(0.5, '#091d28');
    g.addColorStop(1, '#071722');
    GK.roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.15);
    ctx.fillStyle = g;
    ctx.fill();
    var rim = 'rgba(36,105,120,0.6)';
    if (cell.fixed) rim = 'rgba(255,208,122,0.72)';
    else if (cell.type === 'C') rim = 'rgba(255,209,102,0.5)';
    ctx.strokeStyle = rim;
    ctx.lineWidth = (cell.fixed || cell.type === 'C') ? 1.6 : 1.1;
    ctx.stroke();
    if (cell.fixed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,208,122,0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      GK.roundRect(ctx, x + pad + 2, y + pad + 2, s - pad * 2 - 4, s - pad * 2 - 4, s * 0.12);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,140,0.9)';
      ctx.fillStyle = 'rgba(255,214,140,0.9)';
      ctx.lineWidth = 1.2;
      var lx = x + s - pad - 8, ly = y + pad + 6;
      ctx.beginPath(); ctx.arc(lx + 3, ly + 2, 2.6, Math.PI, 0); ctx.stroke();
      GK.roundRect(ctx, lx, ly + 2, 6, 5, 1.4);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWire(ang, s, powered, inner) {
    var dx = CircuitGen.DIR[ang][0], dy = CircuitGen.DIR[ang][1];
    var ex = dx * s * 0.5, ey = dy * s * 0.5;
    var inn = inner == null ? s * 0.10 : inner;
    var w = s * 0.17;
    var g = ctx.createLinearGradient(-ex * 0.1, -ey * 0.1, ex, ey);
    if (powered) {
      g.addColorStop(0, COL.hotA);
      g.addColorStop(0.45, COL.hotB);
      g.addColorStop(1, COL.hotHi);
    } else {
      g.addColorStop(0, COL.copperA);
      g.addColorStop(0.55, COL.copperB);
      g.addColorStop(1, COL.copperHi);
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = powered ? 'rgba(0,240,255,0.95)' : 'rgba(255,160,70,0.55)';
    ctx.shadowBlur = powered ? s * 0.32 : s * 0.13;
    ctx.strokeStyle = g;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(dx * inn, dy * inn);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = powered ? 'rgba(235,255,255,0.92)' : 'rgba(255,235,190,0.75)';
    ctx.lineWidth = w * 0.26;
    ctx.stroke();
    ctx.restore();
  }

  function drawOneWay(s, powered, rot) {
    var d = rot % 4;
    var dx = CircuitGen.DIR[d][0], dy = CircuitGen.DIR[d][1];
    var ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(dx * s * 0.30, dy * s * 0.30);
    ctx.rotate(ang);
    ctx.fillStyle = powered ? '#eaffff' : '#ffe8b4';
    ctx.shadowColor = powered ? 'rgba(0,240,255,0.9)' : 'rgba(255,190,80,0.5)';
    ctx.shadowBlur = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(s * 0.12, 0);
    ctx.lineTo(-s * 0.015, -s * 0.062);
    ctx.lineTo(-s * 0.015, s * 0.062);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = powered ? 'rgba(255,255,255,0.85)' : 'rgba(255,245,205,0.55)';
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.stroke();
    ctx.restore();
  }

  function drawCrossArms(cell, i, s, powered) {
    var g = power && power.groups ? power.groups[i] : 0;
    var pv = powered && (g & (1 << 1));
    var ph = powered && (g & (1 << 2));
    drawWire(0, s, pv);
    drawWire(2, s, pv);
    drawWire(1, s, ph);
    drawWire(3, s, ph);
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(5,16,23,0.96)';
    ctx.strokeStyle = powered ? 'rgba(140,255,255,0.55)' : 'rgba(255,209,102,0.42)';
    ctx.lineWidth = 1.2;
    var rad = s * 0.085;
    ctx.beginPath();
    ctx.rect(-rad, -rad, rad * 2, rad * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSolder(powered) {
    ctx.save();
    ctx.shadowColor = powered ? '#9ffcff' : 'rgba(255,170,80,0.5)';
    ctx.shadowBlur = powered ? 10 : 5;
    ctx.fillStyle = powered ? '#dfffff' : '#e3b070';
    ctx.beginPath();
    ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBulb(s, on) {
    var rad = s * 0.175;
    if (on) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,232,138,0.95)';
      ctx.shadowBlur = s * 0.5;
      var rg = ctx.createRadialGradient(0, -s * 0.03, 1, 0, -s * 0.03, rad * 1.7);
      rg.addColorStop(0, '#fffbe0');
      rg.addColorStop(0.45, '#ffe27a');
      rg.addColorStop(1, 'rgba(255,196,60,0.35)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(0, -s * 0.03, rad, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = on ? 'rgba(255,248,205,0.95)' : 'rgba(120,160,175,0.32)';
    ctx.strokeStyle = on ? '#fff3b0' : 'rgba(130,180,195,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -s * 0.03, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = on ? '#ff9d2e' : 'rgba(160,200,210,0.35)';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-rad * 0.45, -s * 0.02); ctx.lineTo(-rad * 0.18, -s * 0.09);
    ctx.lineTo(rad * 0.18, s * 0.02); ctx.lineTo(rad * 0.45, -s * 0.07);
    ctx.stroke();
    ctx.fillStyle = on ? '#ffd166' : 'rgba(120,150,165,0.45)';
    GK.roundRect(ctx, -s * 0.075, s * 0.1, s * 0.15, s * 0.055, s * 0.018);
    ctx.fill();
    ctx.restore();
  }

  function drawSource(s, on) {
    ctx.save();
    ctx.shadowColor = on ? 'rgba(255,214,102,0.95)' : 'rgba(255,190,80,0.4)';
    ctx.shadowBlur = s * (on ? 0.4 : 0.16);
    ctx.fillStyle = on ? '#ffe27a' : '#c79a3c';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#3a2408';
    ctx.strokeStyle = on ? '#fff6cf' : '#6a4a14';
    ctx.lineWidth = Math.max(1, s * 0.012);
    var p = [
      [-0.020, -0.220], [0.135, -0.220], [0.055, -0.045],
      [0.150, -0.045], [-0.070, 0.225], [-0.010, 0.045], [-0.130, 0.045]
    ];
    ctx.beginPath();
    for (var i = 0; i < p.length; i++) {
      var x = p[i][0] * s, y = p[i][1] * s;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCells(now) {
    for (var i = 0; i < board.cells.length; i++) {
      var cell = board.cells[i];
      var r = Math.floor(i / board.cols), c = i % board.cols;
      var s = layout.cell;
      var x = layout.ox + c * s, y = layout.oy + r * s;
      var cx = x + s / 2, cy = y + s / 2;
      var powered = !!power.seen[i];
      drawPlate(x, y, s, cell);
      if (cell.openCount === 0) continue;

      var offset = 0;
      var at = animStart[i];
      if (at) {
        if (motionOff()) animStart[i] = 0;
        else {
          var pr = Math.min(1, (now - at) / 150);
          if (pr >= 1) animStart[i] = 0;
          else offset = -(1 - GK.easeOutCubic(pr)) * Math.PI / 2;
        }
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(offset);

      if (cell.type === 'C') {
        drawCrossArms(cell, i, s, powered);
      } else {
        var mask = CircuitGen.mask(cell);
        for (var d = 0; d < 4; d++) if (mask[d]) drawWire(d, s, powered);
        if (cell.type === 'W') drawOneWay(s, powered, cell.rot);
        var isSrc0 = board.sources.indexOf(i) >= 0;
        var isSink0 = board.sinks.indexOf(i) >= 0;
        if (!isSrc0 && !isSink0) drawSolder(powered);
      }

      var isSrc = board.sources.indexOf(i) >= 0;
      var isSink = board.sinks.indexOf(i) >= 0;
      if (isSrc) drawSource(s, powered);
      else if (isSink) drawBulb(s, powered);
      ctx.restore();

      if (glowAt[i] && !motionOff()) {
        var gp = Math.min(1, (now - glowAt[i]) / 260);
        if (gp >= 1) glowAt[i] = 0;
        else {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,220,130,' + (1 - gp) * 0.8 + ')';
          ctx.lineWidth = 2;
          GK.roundRect(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.14);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function drawFlow(now) {
    if (!power || motionOff()) { pulseAt = 0; return; }
    var s = layout.cell;
    for (var i = 0; i < board.cells.length; i++) {
      if (!power.seen[i] || !power.parents || power.parents[i] < 0) continue;
      var from = cellPos(power.parents[i]);
      var to = cellPos(i);
      var dx = to.x - from.x, dy = to.y - from.y;
      var segLen = Math.sqrt(dx * dx + dy * dy) || 1;
      /* 沿线路推进的虚线高光（持续电流流光） */
      ctx.save();
      ctx.strokeStyle = 'rgba(190,255,255,0.5)';
      ctx.lineWidth = Math.max(1, s * 0.042);
      ctx.setLineDash([segLen * 0.2, segLen * 0.55]);
      ctx.lineDashOffset = -(((now / 7) + i * 13) % (segLen * 0.75));
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      ctx.restore();
      var phase = ((now / 620) + i * 0.17) % 1;
      for (var k = 0; k < 2; k++) {
        var t = (phase + k * 0.5) % 1;
        var px = from.x + dx * t;
        var py = from.y + dy * t;
        ctx.save();
        ctx.shadowColor = 'rgba(120,255,255,0.95)';
        ctx.shadowBlur = s * 0.22;
        ctx.fillStyle = 'rgba(225,255,255,0.95)';
        ctx.beginPath(); ctx.arc(px, py, s * 0.035, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    /* 接头电火花：已通电的焊点偶发微闪 */
    for (var j = 0; j < board.cells.length; j++) {
      if (!power.seen[j]) continue;
      if (board.sources.indexOf(j) >= 0 || board.sinks.indexOf(j) >= 0) continue;
      var jp = ((now / 1500) + j * 0.37) % 1;
      if (jp > 0.05) continue;
      var ja = 1 - jp / 0.05;
      if (ja <= 0) continue;
      var jc = cellPos(j);
      var jl = s * 0.055 * ja;
      ctx.save();
      ctx.strokeStyle = 'rgba(225,255,255,' + (ja * 0.55).toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(jc.x - jl, jc.y); ctx.lineTo(jc.x + jl, jc.y);
      ctx.moveTo(jc.x, jc.y - jl); ctx.lineTo(jc.x, jc.y + jl);
      ctx.stroke();
      ctx.restore();
    }
    /* 电源与已点亮灯泡处短促闪动 */
    var targets = (board.sinks || []).filter(function (sk) { return power.seen[sk]; });
    if (board.sources && board.sources.length && power.seen[board.sources[0]]) targets.push(board.sources[0]);
    for (var t2 = 0; t2 < targets.length; t2++) {
      var tp = cellPos(targets[t2]);
      var a = Math.sin(now / 90 + t2 * 1.7);
      if (a < 0.35) continue;
      var len = layout.cell * 0.09 * a;
      ctx.save();
      ctx.strokeStyle = 'rgba(210,255,255,' + (a * 0.8) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tp.x - len, tp.y); ctx.lineTo(tp.x + len, tp.y);
      ctx.moveTo(tp.x, tp.y - len); ctx.lineTo(tp.x, tp.y + len);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* 通电瞬间：亮带沿已接通线路从电源向灯座推进 */
  function drawPulse(now) {
    if (motionOff() || !pulseAt || !power) return;
    var t = (now - pulseAt) / 950;
    if (t < 0) return;
    if (t > 1) { pulseAt = 0; return; }
    var e = GK.easeOutCubic(t);
    var s = layout.cell;
    for (var i = 0; i < board.cells.length; i++) {
      var par = power.parents && power.parents[i];
      if (par == null || par < 0 || !power.seen[i]) continue;
      var d = powerDepth[i] / (powerMaxDepth || 1);
      if (Math.abs(d - e) > 0.16) continue;
      var from = cellPos(par), to = cellPos(i);
      var alpha = (1 - t) * 0.85;
      ctx.save();
      ctx.strokeStyle = 'rgba(240,255,255,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = Math.max(2, s * 0.085);
      ctx.shadowColor = 'rgba(120,255,255,0.95)';
      ctx.shadowBlur = s * 0.3;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      ctx.restore();
    }
  }

  function drawCursor(now) {
    if (won || failed) return;
    var s = layout.cell;
    var x = layout.ox + cursor.c * s, y = layout.oy + cursor.r * s;
    ctx.save();
    ctx.strokeStyle = 'rgba(120,255,255,' + (motionOff() ? 0.7 : 0.55 + Math.sin(now / 260) * 0.25) + ')';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,240,255,0.8)';
    ctx.shadowBlur = 8;
    ctx.setLineDash([5, 4]);
    GK.roundRect(ctx, x + s * 0.03, y + s * 0.03, s * 0.94, s * 0.94, s * 0.14);
    ctx.stroke();
    ctx.restore();
  }

  function drawDragTarget(now) {
    if (!dragTarget || !pressCell) return;
    var s = layout.cell;
    var x = layout.ox + dragTarget.c * s, y = layout.oy + dragTarget.r * s;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,209,102,' + (motionOff() ? 0.7 : 0.55 + Math.sin(now / 180) * 0.25) + ')';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = 'rgba(255,190,80,0.75)';
    ctx.shadowBlur = 10;
    GK.roundRect(ctx, x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.14);
    ctx.stroke();
    var a = cellPos(idxOf(pressCell.r, pressCell.c));
    var b = cellPos(idxOf(dragTarget.r, dragTarget.c));
    ctx.strokeStyle = 'rgba(255,209,102,0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }

  function drawWin(now) {
    if (!won) return;
    var p = GK.clamp(winAnim / 900, 0, 1);
    var sinks = board.sinks || [];
    if (!motionOff()) {
      for (var i = 0; i < sinks.length; i++) {
        var c0 = cellPos(sinks[i]);
        ctx.save();
        ctx.globalAlpha = (1 - p) * 0.7;
        ctx.strokeStyle = '#ffe88a';
        ctx.lineWidth = 3 + 6 * (1 - p);
        ctx.beginPath();
        ctx.arc(c0.x, c0.y, layout.cell * 0.4 + p * W * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    var pulse = motionOff() ? 0.55 : 0.45 + Math.sin(now / 210) * 0.25;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,225,130,' + pulse + ')';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,220,120,0.9)';
    ctx.shadowBlur = 16;
    GK.roundRect(ctx, layout.ox - 4, layout.oy - 4,
      layout.cell * board.cols + 8, layout.cell * board.rows + 8, layout.cell * 0.16);
    ctx.stroke();
    ctx.restore();
  }

  function drawFail(now) {
    if (!failed) return;
    var pulse = motionOff() ? 0.5 : 0.4 + Math.sin(now / 150) * 0.22;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,70,90,' + pulse + ')';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,45,70,0.8)';
    ctx.shadowBlur = 14;
    GK.roundRect(ctx, layout.ox - 3, layout.oy - 3,
      layout.cell * board.cols + 6, layout.cell * board.rows + 6, layout.cell * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    var now = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var dpr = gk.dpr || 1;
    ctx.scale(dpr, dpr);
    drawBackground(now);
    if (!board) return;
    drawCells(now);
    drawFlow(now);
    drawPulse(now);
    drawCursor(now);
    drawDragTarget(now);
    drawWin(now);
    drawFail(now);
    if (flashT > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,45,70,' + (flashT * 0.16) + ')';
      GK.roundRect(ctx, layout.ox, layout.oy,
        layout.cell * board.cols, layout.cell * board.rows, layout.cell * 0.12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,70,90,' + flashT + ')';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- 循环与启动 ---------------- */
  var lastSec = -1;
  function update() {
    var now = performance.now();
    var dt = lastNow ? now - lastNow : 16;
    if (dt > 80) dt = 80;
    lastNow = now;
    if (!paused && !won && !failed) elapsed += dt;
    if (won) winAnim = Math.min(winAnim + dt, 1400);
    if (flashT > 0) flashT = Math.max(0, flashT - dt / 450);
    var sec = timeSec();
    if (sec !== lastSec) { lastSec = sec; updateHud(); }
  }

  if (window.Arcade && Arcade.savegame) {
    if (!Arcade.savegame.resume()) startInitial();
  } else {
    startInitial();
  }

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T_('gs.circuit.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () { loadCurrent(); };

  Arcade.loop.start(update, render, 16);
})();
