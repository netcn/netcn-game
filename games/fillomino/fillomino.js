/* 拼图填数 Fillomino —— 旗舰级重制
   纯算法核心：随机多联骨牌分区 + 区域放置约束传播与回溯求解（最多数到 2 个解）
   每题都经过唯一解验证；提示取自唯一解；检查逐区域诊断并高亮
   难度：简单 5×5 / 中等 6×6 / 困难 7×7 / 专家 8×8；每日题按日期确定性种子
   Canvas 自绘霓虹界面；触控数字盘 + 键盘输入；撤销 / 提示 / 检查 / 暂停 */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.fillomino.tut1t'), d: T('gs.fillomino.tut1') },
  { t: T('gs.fillomino.tut2t'), d: T('gs.fillomino.tut2') },
  { t: T('gs.fillomino.tut3t'), d: T('gs.fillomino.tut3') },
  { t: T('gs.fillomino.tut4t'), d: T('gs.fillomino.tut4') }
];

(function () {
  'use strict';
  var root = document.getElementById('game-root');
  if (!root) return;

  /* ============================================================
     纯算法核心（无 DOM / 无 i18n / 无调试入口）
     ============================================================ */
  var Engine = (function () {
    var MAXV = 9;

    function mulberry32(a) {
      a = a >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function hashStr(s) {
      var h = 2166136261 >>> 0;
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    }

    function neighborsOf(i, n) {
      var r = Math.floor(i / n), c = i % n, out = [];
      if (r > 0) out.push(i - n);
      if (r < n - 1) out.push(i + n);
      if (c > 0) out.push(i - 1);
      if (c < n - 1) out.push(i + 1);
      return out;
    }

    function shuffle(arr, rng) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    function componentInGrid(start, grid, n) {
      var v = grid[start];
      var seen = new Uint8Array(n * n), stack = [start], out = [];
      seen[start] = 1;
      var NBS = [];
      while (stack.length) {
        var i = stack.pop();
        out.push(i);
        var nb = NBS[i] || (NBS[i] = neighborsOf(i, n));
        for (var k = 0; k < nb.length; k++) {
          var m = nb[k];
          if (!seen[m] && grid[m] === v) { seen[m] = 1; stack.push(m); }
        }
      }
      return out;
    }

    function validGrid(grid, n) {
      var total = n * n, seen = new Uint8Array(total);
      for (var i = 0; i < total; i++) {
        if (seen[i]) continue;
        var v = grid[i];
        if (!v || v > MAXV) return false;
        var comp = componentInGrid(i, grid, n);
        if (comp.length !== v) return false;
        for (var k = 0; k < comp.length; k++) seen[comp[k]] = 1;
      }
      return true;
    }

    /* 随机合法分区：从未填格出发放置随机形状，失败则回溯 */
    function partitionAttempt(n, maxArea, rng, nodeCap) {
      var total = n * n;
      var grid = new Uint8Array(total);
      var NBS = new Array(total);
      var inShape = new Uint8Array(total);
      for (var i = 0; i < total; i++) NBS[i] = neighborsOf(i, n);
      var nodes = 0;

      function reachCount(cells) {
        var seen = new Uint8Array(total), stack = [], cnt = 0;
        for (var s = 0; s < cells.length; s++) {
          var nb = NBS[cells[s]];
          for (var q = 0; q < nb.length; q++) {
            var m = nb[q];
            if (!seen[m] && !inShape[m] && grid[m] === 0) {
              seen[m] = 1; stack.push(m); cnt++;
            }
          }
        }
        while (stack.length) {
          var x = stack.pop();
          var nb2 = NBS[x];
          for (var k = 0; k < nb2.length; k++) {
            var m2 = nb2[k];
            if (!seen[m2] && !inShape[m2] && grid[m2] === 0) {
              seen[m2] = 1; stack.push(m2); cnt++;
            }
          }
        }
        return cnt;
      }

      function buildShapes(anchor, v) {
        var out = [], seenKeys = {};
        var shape = [anchor], maskLo = 0, maskHi = 0;
        inShape[anchor] = 1;
        if (anchor < 32) maskLo |= (1 << anchor);
        else maskHi |= (1 << (anchor - 32));

        function dfs() {
          var need = v - shape.length;
          if (need === 0) {
            var key = maskHi + '|' + maskLo;
            if (!seenKeys[key]) {
              seenKeys[key] = 1;
              var bad = false;
              for (var s = 0; s < shape.length && !bad; s++) {
                var nb = NBS[shape[s]];
                for (var k = 0; k < nb.length; k++) {
                  if (grid[nb[k]] === v) { bad = true; break; }
                }
              }
              if (!bad) out.push(shape.slice());
            }
            return;
          }
          if (reachCount(shape) < need) return;
          var frontier = [], fseen = {};
          for (var s2 = 0; s2 < shape.length; s2++) {
            var nb2 = NBS[shape[s2]];
            for (var k2 = 0; k2 < nb2.length; k2++) {
              var m = nb2[k2];
              if (!inShape[m] && !fseen[m] && grid[m] === 0) {
                fseen[m] = 1;
                var blocked = false, mnb = NBS[m];
                for (var z = 0; z < mnb.length; z++) {
                  if (grid[mnb[z]] === v) { blocked = true; break; }
                }
                if (!blocked) frontier.push(m);
              }
            }
          }
          for (var f = 0; f < frontier.length; f++) {
            var cand = frontier[f];
            inShape[cand] = 1;
            shape.push(cand);
            if (cand < 32) maskLo |= (1 << cand);
            else maskHi |= (1 << (cand - 32));
            dfs();
            shape.pop();
            if (cand < 32) maskLo &= ~(1 << cand);
            else maskHi &= ~(1 << (cand - 32));
            inShape[cand] = 0;
          }
        }
        dfs();
        inShape[anchor] = 0;
        return out;
      }

      function rec() {
        nodes++;
        if (nodes > nodeCap) return null;
        var anchor = -1;
        for (var i = 0; i < total; i++) if (grid[i] === 0) { anchor = i; break; }
        if (anchor < 0) return Array.from(grid);
        var vals = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].slice(0, maxArea), rng);
        for (var vi = 0; vi < vals.length; vi++) {
          var v = vals[vi];
          var shapes = shuffle(buildShapes(anchor, v), rng);
          for (var si = 0; si < shapes.length; si++) {
            var sh = shapes[si];
            for (var s2 = 0; s2 < sh.length; s2++) grid[sh[s2]] = v;
            var res = rec();
            if (res) return res;
            for (var s3 = 0; s3 < sh.length; s3++) grid[sh[s3]] = 0;
            if (nodes > nodeCap) return null;
          }
        }
        return null;
      }
      return rec();
    }

    function genPartition(n, rng, maxArea) {
      for (var a = 0; a < 5; a++) {
        var g = partitionAttempt(n, maxArea, rng, 60000);
        if (g && validGrid(g, n)) return g;
      }
      return null;
    }

    function makeClues(sol, n, ratio, rng) {
      var total = n * n, out = new Array(total), seen = new Uint8Array(total), comps = [];
      for (var i = 0; i < total; i++) out[i] = 0;
      for (var s = 0; s < total; s++) {
        if (seen[s]) continue;
        var comp = componentInGrid(s, sol, n);
        comps.push(comp);
        for (var k = 0; k < comp.length; k++) seen[comp[k]] = 1;
      }
      for (var c = 0; c < comps.length; c++) {
        var cp = comps[c];
        out[cp[Math.floor(rng() * cp.length)]] = sol[cp[0]];
      }
      var target = Math.floor(total * ratio);
      var count = comps.length, guard = 0;
      while (count < target && guard++ < total * 4) {
        var r = Math.floor(rng() * total);
        if (out[r]) continue;
        out[r] = sol[r];
        count++;
      }
      return out;
    }

    /* 区域放置求解器：约束传播 + 回溯，最多数到 limit 个解 */
    function solvePuzzle(clues, n, limit, nodeCap) {
      var total = n * n;
      var grid = new Uint8Array(total);
      var NBS = new Array(total);
      var inShape = new Uint8Array(total);
      for (var i = 0; i < total; i++) NBS[i] = neighborsOf(i, n);
      var nodes = 0, backtracks = 0, aborted = false;
      var solutions = [];

      function reachCount(cells, v) {
        var seen = new Uint8Array(total), stack = [], cnt = 0;
        for (var s = 0; s < cells.length; s++) {
          var nb = NBS[cells[s]];
          for (var q = 0; q < nb.length; q++) {
            var m = nb[q];
            if (!seen[m] && !inShape[m] && grid[m] === 0 && (clues[m] === 0 || clues[m] === v)) {
              seen[m] = 1; stack.push(m); cnt++;
            }
          }
        }
        while (stack.length) {
          var x = stack.pop();
          var nb2 = NBS[x];
          for (var k = 0; k < nb2.length; k++) {
            var m2 = nb2[k];
            if (!seen[m2] && !inShape[m2] && grid[m2] === 0 && (clues[m2] === 0 || clues[m2] === v)) {
              seen[m2] = 1; stack.push(m2); cnt++;
            }
          }
        }
        return cnt;
      }

      function validateShape(shape, v) {
        for (var s = 0; s < shape.length; s++) {
          var i = shape[s], nb = NBS[i];
          for (var k = 0; k < nb.length; k++) {
            var m = nb[k];
            if (grid[m] === v) return false;
            if (clues[m] === v && !inShape[m]) return false;
          }
        }
        return true;
      }

      function placeShapes(anchor, v, cb) {
        if (v < 1 || v > MAXV) return;
        if (grid[anchor] !== 0) return;
        if (clues[anchor] && clues[anchor] !== v) return;
        var shape = [anchor], maskLo = 0, maskHi = 0, seenKeys = {};
        inShape[anchor] = 1;
        if (anchor < 32) maskLo |= (1 << anchor);
        else maskHi |= (1 << (anchor - 32));

        function dfs() {
          var need = v - shape.length;
          if (need === 0) {
            var key = maskHi + '|' + maskLo;
            if (seenKeys[key]) return;
            seenKeys[key] = 1;
            if (!validateShape(shape, v)) return;
            cb(shape.slice(), v);
            return;
          }
          if (reachCount(shape, v) < need) return;
          var frontier = [], fseen = {};
          for (var s = 0; s < shape.length; s++) {
            var nb = NBS[shape[s]];
            for (var k = 0; k < nb.length; k++) {
              var m = nb[k];
              if (!inShape[m] && !fseen[m] && grid[m] === 0 && (clues[m] === 0 || clues[m] === v)) {
                fseen[m] = 1; frontier.push(m);
              }
            }
          }
          for (var f = 0; f < frontier.length; f++) {
            var cand = frontier[f];
            if (grid[cand] !== 0 || inShape[cand]) continue;
            var bad = false;
            var cnb = NBS[cand];
            for (var z = 0; z < cnb.length; z++) {
              if (grid[cnb[z]] === v) { bad = true; break; }
            }
            if (bad) continue;
            inShape[cand] = 1;
            shape.push(cand);
            if (cand < 32) maskLo |= (1 << cand);
            else maskHi |= (1 << (cand - 32));
            dfs();
            shape.pop();
            if (cand < 32) maskLo &= ~(1 << cand);
            else maskHi &= ~(1 << (cand - 32));
            inShape[cand] = 0;
          }
        }
        dfs();
        inShape[anchor] = 0;
      }

      function viable() {
        for (var i = 0; i < total; i++) {
          if (grid[i] !== 0) continue;
          var lo = 1, hi = MAXV;
          if (clues[i]) lo = hi = clues[i];
          var ok = false;
          for (var v = lo; v <= hi && !ok; v++) {
            var nb = NBS[i], blocked = false;
            for (var k = 0; k < nb.length; k++) {
              if (grid[nb[k]] === v) { blocked = true; break; }
            }
            if (blocked) continue;
            if (reachCount([i], v) >= v - 1) ok = true;
          }
          if (!ok) return false;
        }
        return true;
      }

      function rec() {
        if (aborted || solutions.length >= limit) return;
        nodes++;
        if (nodes > nodeCap) { aborted = true; return; }
        var anchor = -1, forced = false, bestScore = 999;
        for (var i = 0; i < total; i++) {
          if (grid[i] !== 0) continue;
          if (clues[i]) { anchor = i; forced = true; break; }
          var score = 0, nb = NBS[i];
          for (var k = 0; k < nb.length; k++) if (grid[nb[k]] === 0) score++;
          if (score < bestScore) { bestScore = score; anchor = i; }
        }
        if (anchor < 0) {
          if (validGrid(grid, n)) solutions.push(Array.from(grid));
          return;
        }
        var lo = 1, hi = MAXV;
        if (forced) lo = hi = clues[anchor];
        for (var v = lo; v <= hi; v++) {
          if (aborted || solutions.length >= limit) return;
          placeShapes(anchor, v, function (shape, val) {
            if (aborted || solutions.length >= limit) return;
            for (var s = 0; s < shape.length; s++) grid[shape[s]] = val;
            backtracks++;
            if (viable()) rec();
            for (var s2 = 0; s2 < shape.length; s2++) grid[shape[s2]] = 0;
          });
        }
      }

      var t0 = Date.now();
      rec();
      return {
        count: solutions.length,
        solution: solutions[0] || null,
        backtracks: backtracks,
        nodes: nodes,
        ms: Date.now() - t0,
        aborted: aborted
      };
    }

    function buildUnique(n, ratio, rng, nodeCap) {
      var sol = genPartition(n, rng, Math.min(9, n));
      if (!sol) return null;
      var clues = makeClues(sol, n, ratio, rng);
      var res = solvePuzzle(clues, n, 2, nodeCap);
      if (res.aborted) return null;
      var guard = 0;
      while (res.count !== 1 && guard++ < n * n) {
        var hidden = [], total = n * n;
        for (var i = 0; i < total; i++) if (!clues[i]) hidden.push(i);
        if (!hidden.length) break;
        var pick = hidden[Math.floor(rng() * hidden.length)];
        clues[pick] = sol[pick];
        res = solvePuzzle(clues, n, 2, nodeCap);
        if (res.aborted) return null;
      }
      if (res.count !== 1) return null;
      var hiddenCount = 0, total2 = n * n;
      for (var k = 0; k < total2; k++) if (!clues[k]) hiddenCount++;
      return {
        n: n,
        solution: sol,
        clues: clues,
        hidden: hiddenCount,
        stats: { backtracks: res.backtracks, nodes: res.nodes, ms: res.ms }
      };
    }

    function generate(n, ratio, rng) {
      return buildUnique(n, ratio, rng, 8000);
    }

    function fallback(n, rng) {
      return buildUnique(n, 0.82, rng, 30000);
    }

    function verify(grid, n) {
      if (!validGrid(grid, n)) return false;
      var res = solvePuzzle(grid.slice(), n, 1, 4000);
      return !res.aborted && res.count === 1;
    }

    return {
      mulberry32: mulberry32,
      hashStr: hashStr,
      generate: generate,
      fallback: fallback,
      verify: verify,
      solve: solvePuzzle,
      validGrid: validGrid
    };
  })();

  /* ============================================================
     界面与状态
     ============================================================ */
  var W = 480, H = 480, PAD = 10;
  var DIFFS = [
    { key: 'simple', tKey: 'gs.fillomino.diffSimple', n: 5, ratio: 0.50 },
    { key: 'medium', tKey: 'gs.fillomino.diffMedium', n: 6, ratio: 0.40 },
    { key: 'hard', tKey: 'gs.fillomino.diffHard', n: 7, ratio: 0.36 },
    { key: 'expert', tKey: 'gs.fillomino.diffExpert', n: 8, ratio: 0.34 }
  ];
  var DAILY_N = 7, DAILY_RATIO = 0.38;
  var VAL_COLORS = ['#00f0ff', '#ff2d95', '#ffe600', '#39ff14', '#b967ff', '#ff8a00', '#00ffb3', '#ff4d6d', '#8ab4ff'];

  function T2(k, r, v) {
    var s = T(k);
    if (r) s = s.split(r).join(v);
    return s;
  }

  var wrap = document.createElement('div');
  wrap.className = 'fo-wrap';

  var diffHtml = '';
  for (var di = 0; di < DIFFS.length; di++) {
    diffHtml +=
      '<button type="button" class="fo-diff-btn" data-diff="' + di + '">' +
      '<span class="fo-diff-name">' + T(DIFFS[di].tKey) + '</span>' +
      '<span class="fo-diff-size">' + DIFFS[di].n + '×' + DIFFS[di].n + '</span>' +
      '<span class="fo-diff-best" id="fo-best-' + di + '">' + T2('gs.fillomino.bestLabel', '{t}', '--:--') + '</span>' +
      '</button>';
  }

  wrap.innerHTML =
    '<div class="fo-modes">' +
    '  <button type="button" class="fo-tab" id="fo-tab-normal" data-mode="normal">' + T('gs.fillomino.modeNormal') + '</button>' +
    '  <button type="button" class="fo-tab" id="fo-tab-daily" data-mode="daily">' + T('gs.fillomino.modeDaily') + '</button>' +
    '</div>' +
    '<div class="fo-diffs" id="fo-diffs">' + diffHtml + '</div>' +
    '<div class="fo-daily" id="fo-daily"></div>' +
    '<div class="fo-hud">' +
    '  <span class="fo-hud-item"><em>' + T('gs.fillomino.hudMode') + '</em><b id="fo-mode">--</b></span>' +
    '  <span class="fo-hud-item"><em>' + T('gs.fillomino.hudTime') + '</em><b id="fo-time">00:00</b></span>' +
    '  <span class="fo-hud-item"><em>' + T('gs.fillomino.hudFilled') + '</em><b id="fo-filled">0/0</b></span>' +
    '  <span class="fo-hud-item"><em>' + T('gs.fillomino.hudErrors') + '</em><b id="fo-errors">0</b></span>' +
    '  <span class="fo-hud-item"><em>' + T('gs.fillomino.hudHints') + '</em><b id="fo-hints">0</b></span>' +
    '</div>' +
    '<div class="fo-stage">' +
    '  <canvas id="fo-canvas" class="fo-canvas"></canvas>' +
    '  <div class="fo-overlay fo-hide" id="fo-loading">' +
    '    <div class="fo-spinner"></div>' +
    '    <h2 id="fo-loading-title">' + T('gs.fillomino.loadingTitle') + '</h2>' +
    '    <div class="fo-ov-stats" id="fo-loading-sub">' + T('gs.fillomino.loadingSub') + '</div>' +
    '    <button type="button" class="btn green fo-hide" id="fo-loading-retry">' + T('gs.fillomino.retry') + '</button>' +
    '  </div>' +
    '  <div class="fo-overlay fo-hide" id="fo-overlay">' +
    '    <h2 id="fo-ov-title"></h2>' +
    '    <div class="fo-ov-stats" id="fo-ov-stats"></div>' +
    '    <div class="fo-ov-btns">' +
    '      <button type="button" class="btn green" id="fo-ov-next">' + T('gs.fillomino.nextPuzzle') + '</button>' +
    '      <button type="button" class="btn" id="fo-ov-restart">' + T('gs.fillomino.restartPuzzle') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="fo-overlay fo-hide" id="fo-pause">' +
    '    <h2>' + T('gs.fillomino.paused') + '</h2>' +
    '    <div class="fo-ov-stats" id="fo-pause-sub"></div>' +
    '    <div class="fo-ov-btns">' +
    '      <button type="button" class="btn green" id="fo-pause-resume">' + T('gs.fillomino.resume') + '</button>' +
    '      <button type="button" class="btn" id="fo-pause-restart">' + T('gs.fillomino.restartPuzzle') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="fo-msg" id="fo-msg" aria-live="polite">' + T('gs.fillomino.selectHint') + '</div>' +
    '<div class="fo-tools">' +
    '  <button type="button" class="btn purple" id="fo-check">' + T('gs.fillomino.checkBtn') + '</button>' +
    '  <button type="button" class="btn" id="fo-hint">' + T('gs.fillomino.hintBtn') + '</button>' +
    '  <button type="button" class="btn" id="fo-undo">' + T('gs.fillomino.undoBtn') + '</button>' +
    '  <button type="button" class="btn" id="fo-clear">' + T('gs.fillomino.clearBtn') + '</button>' +
    '  <button type="button" class="btn" id="fo-pause-btn">' + T('gs.fillomino.pauseBtn') + '</button>' +
    '  <button type="button" class="btn" id="fo-restart-btn">' + T('gs.fillomino.restartBtn') + '</button>' +
    '</div>' +
    '<div class="fo-pad" id="fo-pad">' +
    '  <button type="button" class="fo-key" data-n="1">1</button><button type="button" class="fo-key" data-n="2">2</button><button type="button" class="fo-key" data-n="3">3</button>' +
    '  <button type="button" class="fo-key" data-n="4">4</button><button type="button" class="fo-key" data-n="5">5</button><button type="button" class="fo-key" data-n="6">6</button>' +
    '  <button type="button" class="fo-key" data-n="7">7</button><button type="button" class="fo-key" data-n="8">8</button><button type="button" class="fo-key" data-n="9">9</button>' +
    '</div>' +
    '<div class="fo-help">' + T('gs.fillomino.help') + '</div>';
  root.appendChild(wrap);

  var canvas = document.getElementById('fo-canvas');
  var gk = GK.setup(canvas, W, H);
  var ctx = gk.ctx;
  var msgEl = document.getElementById('fo-msg');
  var modeEl = document.getElementById('fo-mode');
  var timeEl = document.getElementById('fo-time');
  var filledEl = document.getElementById('fo-filled');
  var errorsEl = document.getElementById('fo-errors');
  var hintsEl = document.getElementById('fo-hints');
  var dailyEl = document.getElementById('fo-daily');
  var overlayEl = document.getElementById('fo-overlay');
  var ovTitle = document.getElementById('fo-ov-title');
  var ovStats = document.getElementById('fo-ov-stats');
  var ovNext = document.getElementById('fo-ov-next');
  var ovRestart = document.getElementById('fo-ov-restart');
  var loadingEl = document.getElementById('fo-loading');
  var loadingTitle = document.getElementById('fo-loading-title');
  var loadingSub = document.getElementById('fo-loading-sub');
  var loadingRetry = document.getElementById('fo-loading-retry');
  var pauseEl = document.getElementById('fo-pause');
  var pauseSub = document.getElementById('fo-pause-sub');
  var pauseResume = document.getElementById('fo-pause-resume');
  var pauseRestart = document.getElementById('fo-pause-restart');
  var pauseBtn = document.getElementById('fo-pause-btn');
  var padEl = document.getElementById('fo-pad');
  var tabNormal = document.getElementById('fo-tab-normal');
  var tabDaily = document.getElementById('fo-tab-daily');
  var diffBtns = document.querySelectorAll('.fo-diff-btn');
  var checkBtn = document.getElementById('fo-check');
  var hintBtn = document.getElementById('fo-hint');
  var undoBtn = document.getElementById('fo-undo');
  var clearBtn = document.getElementById('fo-clear');
  var restartBtn = document.getElementById('fo-restart-btn');

  var state = {
    mode: 'normal',
    diff: 0,
    n: 5,
    solution: [],
    clues: [],
    fills: [],
    hidden: 0,
    stats: null,
    selected: null,
    history: [],
    hints: 0,
    errors: 0,
    steps: 0,
    won: false,
    paused: false,
    loading: true,
    entryOverlay: false,
    newBest: false,
    elapsedBase: 0,
    runStart: 0,
    winMs: 0,
    shakeUntil: 0,
    flashUntil: 0,
    problemCells: {},
    problemUntil: 0,
    errorCells: {},
    hintCell: -1,
    hintUntil: 0
  };

  var genToken = 0, genTimer = null, msgTimer = null;
  var particles = [], rings = [], winFxStart = 0;

  function nowMs() { return Date.now(); }
  function cellSize() { return (W - PAD * 2) / state.n; }
  function idxOf(r, c) { return r * state.n + c; }
  function valueAt(i) { return state.clues[i] || state.fills[i]; }
  function valColor(v) { return VAL_COLORS[(v - 1) % VAL_COLORS.length]; }
  function hexA(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function currentGrid() {
    var total = state.n * state.n, grid = new Array(total);
    for (var i = 0; i < total; i++) grid[i] = valueAt(i);
    return grid;
  }

  function neighborsOf(i, n) {
    var r = Math.floor(i / n), c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  }

  function componentOf(start, grid) {
    var n = state.n, v = grid[start];
    if (!v) return [];
    var seen = {}, stack = [start], out = [];
    seen[start] = 1;
    while (stack.length) {
      var i = stack.pop();
      out.push(i);
      var nb = neighborsOf(i, n);
      for (var k = 0; k < nb.length; k++) {
        var m = nb[k];
        if (!seen[m] && grid[m] === v) { seen[m] = 1; stack.push(m); }
      }
    }
    return out;
  }

  function reachableBlanks(comp, grid) {
    var n = state.n, total = n * n;
    var seen = new Uint8Array(total), stack = [], count = 0;
    function pushFrom(i) {
      var nb = neighborsOf(i, n);
      for (var k = 0; k < nb.length; k++) {
        var m = nb[k];
        if (!seen[m] && grid[m] === 0) {
          seen[m] = 1; stack.push(m); count++;
        }
      }
    }
    for (var c = 0; c < comp.length; c++) pushFrom(comp[c]);
    while (stack.length) {
      var x = stack.pop();
      pushFrom(x);
    }
    return count;
  }

  function filledCount() {
    var n = 0, total = state.n * state.n;
    for (var i = 0; i < total; i++) if (valueAt(i)) n++;
    return n;
  }

  function elapsedMs() {
    if (state.won) return state.winMs;
    if (state.paused || state.loading) return state.elapsedBase;
    return state.elapsedBase + Math.max(0, nowMs() - state.runStart);
  }

  function fmtSeconds(sec) {
    return GK.fmtTime(Math.max(0, Math.round(Number(sec) * 1000)));
  }

  function defaultMsg() {
    return state.mode === 'daily' ? T('gs.fillomino.dailyStart') : T('gs.fillomino.selectHint');
  }

  function setMsg(text, color, resetMs) {
    msgEl.textContent = text;
    msgEl.style.color = color || '';
    if (msgTimer) clearTimeout(msgTimer);
    if (resetMs) {
      msgTimer = setTimeout(function () {
        if (!state.won && !state.paused && !state.loading) {
          msgEl.textContent = defaultMsg();
          msgEl.style.color = '';
        }
      }, resetMs);
    }
  }

  function bestKey(i) { return 'arcade_best_fillomino_' + DIFFS[i].key; }

  function readBest(i) {
    try {
      var raw = localStorage.getItem(bestKey(i));
      if (raw !== null) {
        var n = Number(raw);
        if (isFinite(n) && n > 0) return n;
      }
      if (window.Arcade && Arcade.storage) {
        var old = Arcade.storage.getBest('fillomino');
        if (old !== null && old > 0) return old;
      }
    } catch (e) {}
    return null;
  }

  function storeBest(i, sec) {
    var old = readBest(i);
    var isNew = old === null || sec < old;
    var keep = (old !== null && old < sec) ? old : sec;
    try { localStorage.setItem(bestKey(i), String(keep)); } catch (e) {}
    return isNew;
  }

  function refreshBestLabels() {
    for (var i = 0; i < DIFFS.length; i++) {
      var el = document.getElementById('fo-best-' + i);
      if (!el) continue;
      var sec = readBest(i);
      el.textContent = T2('gs.fillomino.bestLabel', '{t}', sec === null ? '--:--' : fmtSeconds(sec));
    }
  }

  function refreshDailyStatus() {
    if (!dailyEl) return;
    var solved = false, sec = null;
    if (window.Arcade && Arcade.daily) {
      solved = Arcade.daily.isSolved('fillomino');
      sec = Arcade.daily.solvedTime('fillomino');
    }
    dailyEl.textContent = solved
      ? T2('gs.fillomino.dailyDone', '{t}', fmtSeconds(sec || 0))
      : T('gs.fillomino.dailyPending');
    dailyEl.classList.toggle('done', !!solved);
  }

  function setTabs() {
    tabNormal.classList.toggle('selected', state.mode === 'normal');
    tabDaily.classList.toggle('selected', state.mode === 'daily');
    for (var i = 0; i < diffBtns.length; i++) {
      diffBtns[i].classList.toggle('selected', state.mode === 'normal' && Number(diffBtns[i].getAttribute('data-diff')) === state.diff);
    }
  }

  function updateHUD() {
    var modeText;
    if (state.mode === 'daily') {
      modeText = T2('gs.fillomino.diffFmt', '{d}', T('gs.fillomino.modeDaily'));
      modeText = modeText.split('{n}').join(String(DAILY_N));
    } else {
      modeText = T2('gs.fillomino.diffFmt', '{d}', T(DIFFS[state.diff].tKey));
      modeText = modeText.split('{n}').join(String(state.n));
    }
    modeEl.textContent = modeText;
    timeEl.textContent = GK.fmtTime(elapsedMs());
    filledEl.textContent = String(filledCount()) + '/' + String(state.n * state.n);
    errorsEl.textContent = String(state.errors);
    hintsEl.textContent = String(state.hints);
    pauseBtn.textContent = state.paused ? T('gs.fillomino.resume') : T('gs.fillomino.pauseBtn');
    var locked = state.loading || state.won;
    undoBtn.disabled = locked || !state.history.length;
    clearBtn.disabled = locked || filledCount() === 0;
    checkBtn.disabled = locked || !state.solution.length;
    hintBtn.disabled = locked || !state.solution.length;
    setTabs();
  }

  function firstBlank() {
    var total = state.n * state.n;
    for (var i = 0; i < total; i++) if (!state.clues[i] && !state.fills[i]) {
      return { r: Math.floor(i / state.n), c: i % state.n };
    }
    return null;
  }

  function dailyDateStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* ---------------- 生成流程（分步异步，避免长时间阻塞） ---------------- */
  function startNewPuzzle(mode, diffIdx) {
    state.mode = mode === 'daily' ? 'daily' : 'normal';
    state.diff = Math.max(0, Math.min(DIFFS.length - 1, Number(diffIdx) || 0));
    state.n = state.mode === 'daily' ? DAILY_N : DIFFS[state.diff].n;
    genToken++;
    var token = genToken;
    if (genTimer) { clearTimeout(genTimer); genTimer = null; }

    state.loading = true;
    state.won = false;
    state.paused = false;
    state.entryOverlay = false;
    state.solution = [];
    state.clues = [];
    state.fills = [];
    state.hidden = 0;
    state.stats = null;
    state.selected = null;
    state.history = [];
    state.hints = 0;
    state.errors = 0;
    state.steps = 0;
    state.elapsedBase = 0;
    state.runStart = 0;
    state.winMs = 0;
    state.newBest = false;
    state.problemCells = {};
    state.problemUntil = 0;
    state.errorCells = {};
    state.shakeUntil = 0;
    state.flashUntil = 0;
    state.hintCell = -1;
    state.hintUntil = 0;
    particles = [];
    rings = [];
    winFxStart = 0;

    overlayEl.classList.add('fo-hide');
    pauseEl.classList.add('fo-hide');
    loadingEl.classList.remove('fo-hide');
    loadingRetry.classList.add('fo-hide');
    loadingTitle.textContent = T('gs.fillomino.loadingTitle');
    loadingSub.textContent = T('gs.fillomino.loadingSub');
    setTabs();
    refreshBestLabels();
    updateHUD();
    setMsg(state.mode === 'daily' ? T('gs.fillomino.dailyStart') : T('gs.fillomino.selectHint'), '');

    var seed = state.mode === 'daily'
      ? Engine.hashStr('fillomino-daily-' + dailyDateStr())
      : Math.floor(Math.random() * 4294967296);
    var rng = Engine.mulberry32(seed);
    var ratio = state.mode === 'daily' ? DAILY_RATIO : DIFFS[state.diff].ratio;
    var attempts = 0;

    function tick() {
      if (token !== genToken) return;
      var p = Engine.generate(state.n, ratio, rng);
      if (token !== genToken) return;
      if (p) {
        applyPuzzle(p, token);
        return;
      }
      attempts++;
      if (attempts < 6) {
        genTimer = setTimeout(tick, 16);
        return;
      }
      var fb = Engine.fallback(state.n, rng);
      if (token !== genToken) return;
      if (fb) {
        applyPuzzle(fb, token);
        return;
      }
      state.loading = false;
      loadingTitle.textContent = T('gs.fillomino.loadingFail');
      loadingSub.textContent = T('gs.fillomino.loadingSub');
      loadingRetry.classList.remove('fo-hide');
      setMsg(T('gs.fillomino.loadingFail'), 'var(--neon-pink)');
    }
    genTimer = setTimeout(tick, 24);
  }

  function applyPuzzle(p, token) {
    if (token !== genToken) return;
    state.loading = false;
    state.solution = p.solution.slice();
    state.clues = p.clues.slice();
    state.fills = [];
    for (var i = 0; i < state.n * state.n; i++) state.fills[i] = 0;
    state.hidden = p.hidden;
    state.stats = p.stats;
    state.history = [];
    state.hints = 0;
    state.errors = 0;
    state.steps = 0;
    state.won = false;
    state.paused = false;
    state.entryOverlay = false;
    state.elapsedBase = 0;
    state.runStart = nowMs();
    state.winMs = 0;
    state.selected = firstBlank();
    state.problemCells = {};
    state.problemUntil = 0;
    state.errorCells = {};
    state.shakeUntil = 0;
    state.flashUntil = 0;
    state.hintCell = -1;
    state.hintUntil = 0;
    particles = [];
    rings = [];
    winFxStart = 0;
    loadingEl.classList.add('fo-hide');
    overlayEl.classList.add('fo-hide');
    pauseEl.classList.add('fo-hide');
    updateHUD();
    refreshBestLabels();
    refreshDailyStatus();
    setTabs();

    var solvedToday = false, solvedSec = null;
    if (state.mode === 'daily' && window.Arcade && Arcade.daily) {
      solvedToday = Arcade.daily.isSolved('fillomino');
      solvedSec = Arcade.daily.solvedTime('fillomino');
    }
    if (solvedToday) {
      showDailyDoneEntry(solvedSec);
    } else {
      setMsg(defaultMsg(), '');
      if (Arcade.audio) Arcade.audio.play('ui');
    }
  }

  function showDailyDoneEntry(sec) {
    state.paused = true;
    state.entryOverlay = true;
    state.elapsedBase = 0;
    ovTitle.textContent = T2('gs.fillomino.dailyDoneTitle', '{t}', fmtSeconds(sec || 0));
    var lines = [];
    if (window.Arcade && Arcade.daily) {
      lines.push(T2('gs.fillomino.streakFmt', '{n}', String(Arcade.daily.streak())));
    }
    lines.push(T('gs.fillomino.dailyIndependent'));
    ovStats.innerHTML = lines.join('<br>');
    ovNext.textContent = T('gs.fillomino.backNormal');
    ovRestart.textContent = T('gs.fillomino.dailyReplay');
    overlayEl.classList.remove('fo-hide');
    pauseEl.classList.add('fo-hide');
    updateHUD();
  }

  function showLoadingRetry() {
    loadingEl.classList.remove('fo-hide');
    loadingTitle.textContent = T('gs.fillomino.loadingTitle');
    loadingSub.textContent = T('gs.fillomino.loadingSub');
    loadingRetry.classList.add('fo-hide');
    startNewPuzzle(state.mode, state.diff);
  }

  /* ---------------- 计时 ---------------- */
  setInterval(function () {
    if (!state.loading && !state.won && !state.paused) timeEl.textContent = GK.fmtTime(elapsedMs());
  }, 250);

  /* ---------------- 选格 / 填写 ---------------- */
  function selectCell(r, c) {
    if (state.loading || state.won || state.paused) return;
    if (r < 0 || r >= state.n || c < 0 || c >= state.n) return;
    state.selected = { r: r, c: c };
    var i = idxOf(r, c);
    if (state.clues[i]) {
      setMsg(T('gs.fillomino.clueLocked'), 'var(--neon-yellow)', 1400);
    } else {
      setMsg(T2('gs.fillomino.selectedFmt', '{r}', String(r + 1)).replace('{c}', String(c + 1)), 'var(--neon-cyan)', 1000);
    }
    if (Arcade.juice) Arcade.juice.select();
  }

  function place(v) {
    if (state.loading || state.won || state.paused) return;
    if (!state.selected) {
      setMsg(T('gs.fillomino.needSelect'), 'var(--neon-yellow)', 1400);
      return;
    }
    var i = idxOf(state.selected.r, state.selected.c);
    if (state.clues[i]) {
      setMsg(T('gs.fillomino.clueLocked'), 'var(--neon-yellow)', 1600);
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    if (state.fills[i] === v) {
      setMsg(T2('gs.fillomino.alreadyFmt', '{v}', String(v)), 'var(--neon-cyan)', 900);
      return;
    }
    var prev = state.fills[i];
    state.fills[i] = v;
    var grid = currentGrid();
    var comp = componentOf(i, grid);
    var size = comp.length;
    var reject = false, reason = '';

    if (size > v) {
      reject = true;
      reason = T2('gs.fillomino.errConflict', '{v}', String(v)).replace('{n}', String(size)).replace('{v}', String(v));
    } else if (size < v) {
      var reach = reachableBlanks(comp, grid);
      if (reach === 0 || size + reach < v) {
        reject = true;
        var sizeText = T2('gs.fillomino.errSize', '{v}', String(v)).replace('{n}', String(size));
        var disText = T2('gs.fillomino.errDisconnected', '{v}', String(v))
          .replace('{n}', String(size))
          .replace('{m}', String(size + reach));
        reason = sizeText + ' · ' + disText;
      }
    }

    if (reject) {
      state.fills[i] = prev;
      state.errors++;
      state.errorCells[i] = nowMs() + 1000;
      state.shakeUntil = nowMs() + 340;
      state.flashUntil = nowMs() + 220;
      if (Arcade.audio) Arcade.audio.play('error');
      setMsg(reason, 'var(--neon-pink)', 3000);
      updateHUD();
      return;
    }

    state.history.push({ i: i, prev: prev });
    state.steps++;
    if (state.hintCell === i) { state.hintCell = -1; state.hintUntil = 0; }
    delete state.problemCells[i];
    if (Arcade.audio) Arcade.audio.play('ui');
    setMsg(T2('gs.fillomino.placedFmt', '{v}', String(v)), 'var(--neon-cyan)', 800);
    updateHUD();

    if (filledCount() === state.n * state.n) validateFull();
  }

  function clearSelected() {
    if (state.loading || state.won || state.paused || !state.selected) return;
    var i = idxOf(state.selected.r, state.selected.c);
    if (state.clues[i]) {
      setMsg(T('gs.fillomino.clueLocked'), 'var(--neon-yellow)', 1400);
      return;
    }
    if (!state.fills[i]) {
      if (Arcade.audio) Arcade.audio.play('back');
      return;
    }
    state.history.push({ i: i, prev: state.fills[i] });
    state.fills[i] = 0;
    state.steps++;
    delete state.problemCells[i];
    if (Arcade.audio) Arcade.audio.play('back');
    setMsg(defaultMsg(), '', 700);
    updateHUD();
  }

  function undo() {
    if (state.loading || state.won || state.paused) return;
    if (!state.history.length) {
      setMsg(T('gs.fillomino.undoNone'), 'var(--neon-yellow)', 1200);
      return;
    }
    var h = state.history.pop();
    state.fills[h.i] = h.prev;
    state.selected = { r: Math.floor(h.i / state.n), c: h.i % state.n };
    if (Arcade.audio) Arcade.audio.play('back');
    setMsg(T('gs.fillomino.undone'), 'var(--neon-cyan)', 900);
    updateHUD();
  }

  function clearAll() {
    if (state.loading || state.won || state.paused) return;
    for (var i = 0; i < state.n * state.n; i++) state.fills[i] = 0;
    state.history = [];
    state.steps = 0;
    state.problemCells = {};
    state.problemUntil = 0;
    state.hintCell = -1;
    state.hintUntil = 0;
    setMsg(T('gs.fillomino.cleared'), 'var(--neon-cyan)', 1100);
    if (Arcade.audio) Arcade.audio.play('back');
    updateHUD();
  }

  function resetCurrentPuzzle() {
    if (state.loading || !state.solution.length) return;
    state.won = false;
    state.paused = false;
    state.entryOverlay = false;
    state.fills = [];
    for (var i = 0; i < state.n * state.n; i++) state.fills[i] = 0;
    state.history = [];
    state.hints = 0;
    state.errors = 0;
    state.steps = 0;
    state.elapsedBase = 0;
    state.runStart = nowMs();
    state.winMs = 0;
    state.selected = firstBlank();
    state.problemCells = {};
    state.problemUntil = 0;
    state.errorCells = {};
    state.shakeUntil = 0;
    state.flashUntil = 0;
    state.hintCell = -1;
    state.hintUntil = 0;
    particles = [];
    rings = [];
    winFxStart = 0;
    overlayEl.classList.add('fo-hide');
    pauseEl.classList.add('fo-hide');
    loadingEl.classList.add('fo-hide');
    pauseBtn.textContent = T('gs.fillomino.pauseBtn');
    setMsg(defaultMsg(), '');
    updateHUD();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ---------------- 诊断 ---------------- */
  function diagnose() {
    var n = state.n, total = n * n;
    var grid = currentGrid();
    var seen = new Uint8Array(total);
    var probs = [];
    for (var s = 0; s < total; s++) {
      if (seen[s] || !grid[s]) continue;
      var comp = componentOf(s, grid);
      for (var k = 0; k < comp.length; k++) seen[comp[k]] = 1;
      var v = grid[s], size = comp.length;
      var reason = '';
      var hasWrong = false;
      for (var c = 0; c < comp.length; c++) {
        var idx = comp[c];
        if (!state.clues[idx] && state.fills[idx] && state.solution.length && state.fills[idx] !== state.solution[idx]) {
          hasWrong = true;
          break;
        }
      }
      if (hasWrong) {
        reason = T('gs.fillomino.errWrong');
      } else if (size > v) {
        reason = T2('gs.fillomino.errMerged', '{v}', String(v)).replace('{n}', String(size)).replace('{v}', String(v));
      } else if (size < v) {
        var reach = reachableBlanks(comp, grid);
        if (reach === 0 || size + reach < v) {
          var sizeText = T2('gs.fillomino.errSize', '{v}', String(v)).replace('{n}', String(size));
          var disText = T2('gs.fillomino.errDisconnected', '{v}', String(v))
            .replace('{n}', String(size))
            .replace('{m}', String(size + reach));
          reason = sizeText + ' · ' + disText;
        }
      }
      if (reason) probs.push({ cells: comp, reason: reason });
    }
    return probs;
  }

  function showProblems(probs) {
    var now = nowMs();
    state.problemCells = {};
    for (var p = 0; p < probs.length; p++) {
      for (var c = 0; c < probs[p].cells.length; c++) state.problemCells[probs[p].cells[c]] = 1;
    }
    state.problemUntil = now + 3200;
    state.shakeUntil = now + 260;
    var reason = probs[0].reason;
    var text = T2('gs.fillomino.checkProblems', '{n}', String(probs.length)).replace('{reason}', reason);
    setMsg(text, 'var(--neon-pink)', 3600);
    if (Arcade.audio) Arcade.audio.play('error');
    updateHUD();
  }

  function checkPuzzle() {
    if (state.loading || state.won || state.paused || !state.solution.length) return;
    var probs = diagnose();
    if (!probs.length) {
      var blanks = state.n * state.n - filledCount();
      setMsg(T2('gs.fillomino.checkOk', '{n}', String(blanks)), 'var(--neon-green)', 2400);
      if (Arcade.audio) Arcade.audio.play('ui');
      return;
    }
    showProblems(probs);
  }

  function validateFull() {
    var grid = currentGrid();
    var ok = Engine.verify(grid, state.n);
    if (ok) {
      finishWin();
      return;
    }
    state.errors++;
    var probs = diagnose();
    if (!probs.length) {
      probs.push({ cells: [], reason: T('gs.fillomino.notValid') });
    }
    showProblems(probs);
    state.flashUntil = nowMs() + 260;
    setMsg(T2('gs.fillomino.errFull', '{n}', String(probs.length))
      .replace('{reason}', probs[0].reason), 'var(--neon-pink)', 3600);
  }

  /* ---------------- 提示 ---------------- */
  function useHint() {
    if (state.loading || state.won || state.paused || !state.solution.length) return;
    var target = -1;
    if (state.selected) {
      var si = idxOf(state.selected.r, state.selected.c);
      if (!state.clues[si] && state.fills[si] !== state.solution[si]) target = si;
    }
    if (target < 0) {
      var total = state.n * state.n;
      for (var i = 0; i < total; i++) {
        if (!state.clues[i] && state.fills[i] !== state.solution[i]) {
          if (!state.fills[i]) { target = i; break; }
        }
      }
      if (target < 0) {
        for (var j = 0; j < total; j++) {
          if (!state.clues[j] && !state.fills[j]) { target = j; break; }
        }
      }
    }
    if (target < 0) {
      setMsg(T('gs.fillomino.hintNone'), 'var(--neon-yellow)', 1400);
      return;
    }
    var v = state.solution[target];
    var prev = state.fills[target];
    state.fills[target] = v;
    state.history.push({ i: target, prev: prev });
    state.hints++;
    state.steps++;
    state.selected = { r: Math.floor(target / state.n), c: target % state.n };
    state.hintCell = target;
    state.hintUntil = nowMs() + 2200;
    delete state.problemCells[target];
    var rr = Math.floor(target / state.n) + 1, cc = (target % state.n) + 1;
    setMsg(T2('gs.fillomino.hintFmt', '{r}', String(rr))
      .replace('{c}', String(cc))
      .replace('{v}', String(v)), 'var(--neon-yellow)', 3000);
    if (Arcade.audio) Arcade.audio.play('coin');
    updateHUD();
    if (filledCount() === state.n * state.n) validateFull();
  }

  /* ---------------- 结算 ---------------- */
  function finishWin() {
    if (state.won) return;
    var ms = elapsedMs();
    state.won = true;
    state.paused = false;
    state.winMs = ms;
    state.elapsedBase = ms;
    state.problemCells = {};
    state.problemUntil = 0;
    var sec = Math.max(1, Math.round(ms / 1000));
    if (state.mode === 'daily') {
      if (window.Arcade && Arcade.daily) Arcade.daily.markSolved('fillomino', sec);
      refreshDailyStatus();
      if (Arcade.juice) Arcade.juice.win();
    } else {
      state.newBest = storeBest(state.diff, sec);
      if (window.Arcade && Arcade.shell) Arcade.shell.submitScore(sec);
      refreshBestLabels();
      if (Arcade.juice) Arcade.juice.win();
    }
    winFxStart = nowMs();
    spawnWinFx();
    updateHUD();
    setTimeout(function () {
      if (state.won) showWinOverlay(sec);
    }, 680);
  }

  function showWinOverlay(sec) {
    if (!state.won) return;
    var lines = [];
    lines.push(T2('gs.fillomino.winTimeFmt', '{t}', fmtSeconds(sec)));
    lines.push(T2('gs.fillomino.winHintsFmt', '{n}', String(state.hints)));
    if (state.mode === 'daily') {
      ovTitle.textContent = T('gs.fillomino.dailyWinTitle');
      var dailyLabel = T2('gs.fillomino.diffFmt', '{d}', T('gs.fillomino.modeDaily')).split('{n}').join(String(DAILY_N));
      lines.push(T2('gs.fillomino.winDiffFmt', '{d}', dailyLabel));
      lines.push(T2('gs.fillomino.winHiddenFmt', '{n}', String(state.hidden)));
      lines.push(T2('gs.fillomino.dailyDone', '{t}', fmtSeconds(sec)));
      if (window.Arcade && Arcade.daily) lines.push(T2('gs.fillomino.streakFmt', '{n}', String(Arcade.daily.streak())));
      lines.push(T('gs.fillomino.dailyIndependent'));
      ovNext.textContent = T('gs.fillomino.backNormal');
      ovRestart.textContent = T('gs.fillomino.dailyReplay');
    } else {
      ovTitle.textContent = T('gs.fillomino.winTitle');
      var diffLabel = T2('gs.fillomino.diffFmt', '{d}', T(DIFFS[state.diff].tKey)).split('{n}').join(String(state.n));
      lines.push(T2('gs.fillomino.winDiffFmt', '{d}', diffLabel));
      lines.push(T2('gs.fillomino.winHiddenFmt', '{n}', String(state.hidden)));
      var best = readBest(state.diff);
      if (best !== null) lines.push(T2('gs.fillomino.winBestFmt', '{t}', fmtSeconds(best)));
      if (state.newBest) lines.push(T('gs.fillomino.newBest'));
      ovNext.textContent = T('gs.fillomino.nextPuzzle');
      ovRestart.textContent = T('gs.fillomino.restartPuzzle');
    }
    ovStats.innerHTML = lines.join('<br>');
    overlayEl.classList.remove('fo-hide');
    pauseEl.classList.add('fo-hide');
  }

  function togglePause() {
    if (state.loading || state.won || !state.solution.length || state.entryOverlay) return;
    if (state.paused) {
      state.paused = false;
      state.runStart = nowMs();
      pauseEl.classList.add('fo-hide');
      pauseBtn.textContent = T('gs.fillomino.pauseBtn');
      setMsg(defaultMsg(), '');
    } else {
      state.elapsedBase += Math.max(0, nowMs() - state.runStart);
      state.paused = true;
      pauseSub.textContent = T('gs.fillomino.pauseHint') + ' · ' + GK.fmtTime(elapsedMs());
      pauseEl.classList.remove('fo-hide');
      pauseBtn.textContent = T('gs.fillomino.resume');
    }
    if (Arcade.audio) Arcade.audio.play('ui');
    updateHUD();
  }

  /* ---------------- 特效 ---------------- */
  function spawnWinFx() {
    var grid = currentGrid();
    var n = state.n, total = n * n;
    var seen = new Uint8Array(total);
    var centers = [];
    for (var s = 0; s < total; s++) {
      if (seen[s] || !grid[s]) continue;
      var comp = componentOf(s, grid);
      for (var k = 0; k < comp.length; k++) seen[comp[k]] = 1;
      if (comp.length !== grid[s]) continue;
      var cx = 0, cy = 0;
      for (var c = 0; c < comp.length; c++) {
        cx += (comp[c] % n) + 0.5;
        cy += Math.floor(comp[c] / n) + 0.5;
      }
      centers.push({ x: PAD + (cx / comp.length) * cellSize(), y: PAD + (cy / comp.length) * cellSize(), v: grid[s] });
    }
    rings.push({ x: W / 2, y: H / 2, t: 0, life: 52, color: '#00f0ff' });
    rings.push({ x: W / 2, y: H / 2, t: -12, life: 60, color: '#ffe600' });
    rings.push({ x: W / 2, y: H / 2, t: -24, life: 68, color: '#ff2d95' });
    for (var q = 0; q < centers.length; q++) {
      for (var p = 0; p < 4; p++) {
        var ang = Math.random() * Math.PI * 2;
        var sp = 1.2 + Math.random() * 3.4;
        particles.push({
          x: centers[q].x, y: centers[q].y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.8,
          life: 38 + Math.floor(Math.random() * 30), maxLife: 68,
          size: 1.6 + Math.random() * 3, color: valColor(centers[q].v),
          rot: Math.random() * 6, rotV: (Math.random() - 0.5) * 0.2
        });
      }
    }
    for (var w = 0; w < 30; w++) {
      var a2 = Math.random() * Math.PI * 2, sp2 = 1.5 + Math.random() * 5;
      particles.push({
        x: W / 2, y: H / 2,
        vx: Math.cos(a2) * sp2, vy: Math.sin(a2) * sp2 - 1,
        life: 34 + Math.floor(Math.random() * 34), maxLife: 68,
        size: 1.5 + Math.random() * 3.2,
        color: VAL_COLORS[Math.floor(Math.random() * VAL_COLORS.length)],
        rot: Math.random() * 6, rotV: (Math.random() - 0.5) * 0.24
      });
    }
    if (Arcade.fx) Arcade.fx.flash('var(--neon-cyan)');
  }

  /* ---------------- 绘制 ---------------- */
  function analyzeComps(grid) {
    var n = state.n, total = n * n;
    var seen = new Uint8Array(total), comps = [], compId = new Int16Array(total);
    for (var i = 0; i < total; i++) compId[i] = -1;
    for (var s = 0; s < total; s++) {
      if (seen[s] || !grid[s]) continue;
      var comp = componentOf(s, grid);
      var ci = comps.length;
      comps.push({ v: grid[s], size: comp.length, cells: comp });
      for (var k = 0; k < comp.length; k++) {
        seen[comp[k]] = 1;
        compId[comp[k]] = ci;
      }
    }
    return { comps: comps, compId: compId };
  }

  function drawCell(x, y, s, v, isClue, i, now, compInfo) {
    var rad = Math.max(4, Math.min(9, s * 0.16));
    var color = valColor(v || 1);
    var g;
    if (!v) {
      g = ctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, 'rgba(255,255,255,0.055)');
      g.addColorStop(1, 'rgba(0,240,255,0.012)');
    } else {
      g = ctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, hexA(color, isClue ? 0.36 : 0.30));
      g.addColorStop(0.55, hexA(color, 0.15));
      g.addColorStop(1, hexA(color, 0.07));
    }
    ctx.fillStyle = g;
    GK.roundRect(ctx, x, y, s, s, rad);
    ctx.fill();

    var complete = false;
    if (v && compInfo.compId[i] >= 0) {
      var cp = compInfo.comps[compInfo.compId[i]];
      if (cp.size === cp.v) complete = true;
    }
    ctx.save();
    ctx.strokeStyle = isClue ? 'rgba(255,230,0,0.82)' : (v ? hexA(color, complete ? 0.85 : 0.45) : 'rgba(0,240,255,0.13)');
    ctx.lineWidth = isClue ? 2 : (complete ? 1.8 : 1);
    if (complete) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + 3 * Math.sin(now / 240);
    }
    GK.roundRect(ctx, x, y, s, s, rad);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    var hl = ctx.createLinearGradient(x, y, x, y + s * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,0.13)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    GK.roundRect(ctx, x + 1.5, y + 1.5, s - 3, s / 2, Math.max(2, rad - 2));
    ctx.fill();
    ctx.restore();

    if (v) {
      ctx.save();
      ctx.font = '400 ' + Math.max(10, Math.floor(s * 0.46)) + 'px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isClue ? '#ffe600' : '#ffffff';
      ctx.shadowColor = isClue ? 'rgba(255,230,0,0.95)' : hexA(color, 0.95);
      ctx.shadowBlur = isClue ? 14 : 10;
      ctx.fillText(String(v), x + s / 2, y + s / 2 + 1);
      ctx.restore();
    }

    var errUntil = state.errorCells[i] || 0;
    if (errUntil > now) {
      var t = (errUntil - now) / 1000;
      ctx.save();
      ctx.globalAlpha = 0.16 + t * 0.32;
      ctx.fillStyle = '#ff2d55';
      GK.roundRect(ctx, x, y, s, s, rad);
      ctx.fill();
      ctx.globalAlpha = 0.55 + t * 0.4;
      ctx.strokeStyle = '#ff2d55';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#ff2d55';
      ctx.shadowBlur = 14;
      GK.roundRect(ctx, x, y, s, s, rad);
      ctx.stroke();
      ctx.restore();
    } else if (errUntil) {
      delete state.errorCells[i];
    }

    if (state.problemUntil > now && state.problemCells[i]) {
      var p = (state.problemUntil - now) / 1000;
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.10 * Math.sin(now / 110);
      ctx.fillStyle = '#ff2d55';
      GK.roundRect(ctx, x, y, s, s, rad);
      ctx.fill();
      ctx.globalAlpha = 0.65;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#ff2d55';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff2d55';
      ctx.shadowBlur = 9;
      GK.roundRect(ctx, x, y, s, s, rad);
      ctx.stroke();
      ctx.restore();
    }

    if (state.hintCell === i && state.hintUntil > now) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 140);
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.6;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 16;
      GK.roundRect(ctx, x, y, s, s, rad);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBoundaries(grid, compInfo, now) {
    var n = state.n, cell = cellSize();
    for (var i = 0; i < n * n; i++) {
      var v = grid[i];
      if (!v) continue;
      var r = Math.floor(i / n), c = i % n;
      var x = PAD + c * cell, y = PAD + r * cell;
      var s = cell;
      var color = valColor(v);
      var ci = compInfo.compId[i];
      var complete = ci >= 0 && compInfo.comps[ci].size === compInfo.comps[ci].v;
      var winPulse = state.won ? (0.55 + 0.45 * Math.sin(now / 170 + i)) : 0;
      ctx.save();
      ctx.strokeStyle = hexA(color, complete || state.won ? 0.92 : 0.55);
      ctx.lineWidth = complete ? 2.6 : 1.8;
      ctx.shadowColor = color;
      ctx.shadowBlur = complete || state.won ? 10 + winPulse * 14 : 4;
      if (r === 0 || grid[i - n] !== v) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.stroke();
      }
      if (c === 0 || grid[i - 1] !== v) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + s); ctx.stroke();
      }
      if (r === n - 1) {
        ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x + s, y + s); ctx.stroke();
      }
      if (c === n - 1) {
        ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function render() {
    var now = nowMs();
    ctx.setTransform(gk.dpr, 0, 0, gk.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, W, H);
    var bg = ctx.createRadialGradient(W / 2, H * 0.44, 20, W / 2, H * 0.44, W * 0.86);
    bg.addColorStop(0, 'rgba(0,240,255,0.09)');
    bg.addColorStop(0.52, 'rgba(185,103,255,0.06)');
    bg.addColorStop(1, 'rgba(7,7,13,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,0.025)';
    ctx.lineWidth = 1;
    for (var sy = 0; sy < H; sy += 4) {
      ctx.beginPath(); ctx.moveTo(0, sy + 0.5); ctx.lineTo(W, sy + 0.5); ctx.stroke();
    }
    ctx.restore();

    var shakeX = 0, shakeY = 0;
    if (state.shakeUntil > now) {
      var amp = Math.max(0, state.shakeUntil - now) / 340 * 7;
      shakeX = (Math.random() * 2 - 1) * amp;
      shakeY = (Math.random() * 2 - 1) * amp;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    var grid = currentGrid();
    var compInfo = analyzeComps(grid);
    var n = state.n, cell = cellSize();
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n;
      var x = PAD + c * cell + 2, y = PAD + r * cell + 2;
      drawCell(x, y, cell - 4, grid[i], !!state.clues[i], i, now, compInfo);
    }
    drawBoundaries(grid, compInfo, now);

    if (state.selected && !state.won) {
      var sx = PAD + state.selected.c * cell + 2;
      var sy2 = PAD + state.selected.r * cell + 2;
      var ss = cell - 4;
      var pulse = 0.5 + 0.5 * Math.sin(now / 230);
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      ctx.lineWidth = 2.6;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12 + pulse * 12;
      GK.roundRect(ctx, sx, sy2, ss, ss, Math.max(4, Math.min(9, ss * 0.16)));
      ctx.stroke();
      ctx.restore();
    }

    if (state.won && winFxStart) {
      var wp = Math.min(1, (now - winFxStart) / 1400);
      ctx.save();
      var wg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.75);
      wg.addColorStop(0, 'rgba(0,240,255,' + (0.08 + 0.10 * (1 - wp)) + ')');
      wg.addColorStop(0.6, 'rgba(185,103,255,' + (0.05 + 0.06 * (1 - wp)) + ')');
      wg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    for (var ri = rings.length - 1; ri >= 0; ri--) {
      var rg = rings[ri];
      rg.t += 1;
      if (rg.t > rg.life) { rings.splice(ri, 1); continue; }
      if (rg.t < 0) continue;
      var rp = rg.t / rg.life;
      ctx.save();
      ctx.globalAlpha = (1 - rp) * 0.8;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 2 + 5 * (1 - rp);
      ctx.shadowColor = rg.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, 20 + rp * W * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (var pi = particles.length - 1; pi >= 0; pi--) {
      var pt = particles[pi];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.055;
      pt.vx *= 0.992;
      pt.vy *= 0.992;
      pt.life--;
      pt.rot += pt.rotV;
      if (pt.life <= 0) { particles.splice(pi, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, pt.life / 22);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 9;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    ctx.restore();

    if (state.flashUntil > now) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.4, (state.flashUntil - now) / 260 * 0.45);
      ctx.fillStyle = '#ff2d55';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /* ---------------- 输入绑定 ---------------- */
  canvas.addEventListener('pointerdown', function (e) {
    if (state.loading || state.won || state.paused) return;
    e.preventDefault();
    var p = GK.pointer(canvas, e);
    var cell = cellSize();
    var c = Math.floor((p.x - PAD) / cell);
    var r = Math.floor((p.y - PAD) / cell);
    if (r < 0 || r >= state.n || c < 0 || c >= state.n) return;
    selectCell(r, c);
  });

  padEl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.fo-key') : null;
    if (!b) return;
    place(parseInt(b.getAttribute('data-n'), 10));
  });

  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      if (state.loading || state.won || state.paused) return;
      var r = state.selected ? state.selected.r : 0;
      var c = state.selected ? state.selected.c : 0;
      if (e.code === 'ArrowLeft') c = Math.max(0, c - 1);
      else if (e.code === 'ArrowRight') c = Math.min(state.n - 1, c + 1);
      else if (e.code === 'ArrowUp') r = Math.max(0, r - 1);
      else r = Math.min(state.n - 1, r + 1);
      selectCell(r, c);
      return;
    }
    if (e.code === 'Backspace' || e.code === 'Delete') {
      e.preventDefault();
      clearSelected();
      return;
    }
    if (e.key && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      place(parseInt(e.key, 10));
      return;
    }
    if (e.key === 'u' || e.key === 'U') {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetCurrentPuzzle();
      return;
    }
    if (e.code === 'Space' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
    }
  });

  tabNormal.addEventListener('click', function () {
    if (state.mode === 'normal' && !state.loading) return;
    startNewPuzzle('normal', state.diff);
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  tabDaily.addEventListener('click', function () {
    startNewPuzzle('daily', state.diff);
    if (Arcade.audio) Arcade.audio.play('ui');
  });

  for (var bi = 0; bi < diffBtns.length; bi++) {
    (function (idx) {
      diffBtns[idx].addEventListener('click', function () {
        startNewPuzzle('normal', idx);
        if (Arcade.audio) Arcade.audio.play('ui');
      });
    })(bi);
  }

  checkBtn.addEventListener('click', checkPuzzle);
  hintBtn.addEventListener('click', useHint);
  undoBtn.addEventListener('click', undo);
  clearBtn.addEventListener('click', clearAll);
  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', resetCurrentPuzzle);

  ovNext.addEventListener('click', function () {
    startNewPuzzle('normal', state.diff);
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  ovRestart.addEventListener('click', resetCurrentPuzzle);
  pauseResume.addEventListener('click', togglePause);
  pauseRestart.addEventListener('click', resetCurrentPuzzle);
  loadingRetry.addEventListener('click', showLoadingRetry);

  window.GAME_RESTART = function () { resetCurrentPuzzle(); };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !state.paused && !state.won && !state.loading && state.solution.length) togglePause();
  });

  refreshBestLabels();
  refreshDailyStatus();
  updateHUD();
  Arcade.loop.start(function () {}, render, 16);
  startNewPuzzle('normal', 0);
})();
