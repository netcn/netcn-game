/* 方形分割 Shikaku —— 旗舰重制
   - 矩形剖分 → 合并提示 生成器：回溯求解器统计解数，仅接受唯一解（解数=1）
   - 确定性 seed：每日挑战按日期复现；战役存档保存 seed，断点续玩可重建同一棋盘
   - 5×5 / 7×7 / 9×9 / 11×11 四档；撤销 / 清空 / 有限提示（每次 +20s 时间惩罚）
   - 拖拽或两次点击画矩形；非法矩形即时红闪 + 原因；全覆盖且数字=面积 → 结算
   - 每日挑战独立结算：Arcade.daily.markSolved('shikaku', seconds)，不污染战役 BEST
   - 自绘 CSS 霓虹网格 / 填充动画 / 数字发光 / 胜利波纹粒子
   仅 ?qa=1 暴露 window.__QA（正常 URL 不存在）
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.shikaku.tut1t'), d: T('gs.shikaku.tut1') },
  { t: T('gs.shikaku.tut2t'), d: T('gs.shikaku.tut2') },
  { t: T('gs.shikaku.tut3t'), d: T('gs.shikaku.tut3') },
  { t: T('gs.shikaku.tut4t'), d: T('gs.shikaku.tut4') }
];

(function () {
  'use strict';
  var QA = /(?:^|[?&])qa=1(?:&|$)/.test(location.search);
  var root = document.getElementById('game-root');
  if (!root) return;

  var SIZES = [
    { n: 5, clues: 7, label: '5×5' },
    { n: 7, clues: 11, label: '7×7' },
    { n: 9, clues: 17, label: '9×9' },
    { n: 11, clues: 23, label: '11×11' }
  ];
  var PALETTE = ['#00f0ff', '#39ff14', '#ff2d95', '#b967ff', '#ffe600', '#ff9f1c', '#2d7dff', '#ff5e5e'];
  var HINT_MAX = 3;
  var HINT_PENALTY_MS = 20000;
  var GAP = 2;

  /* ============================================================
     生成器：确定性随机 → 矩形剖分 → 合并 → 求解器唯一性校验
     ============================================================ */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function randomSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  }

  function splitRects(n, target, rng) {
    var rects = [{ r: 0, c: 0, h: n, w: n }];
    var guard = 0;
    while (rects.length < target && guard++ < target * 40) {
      var cands = [], total = 0;
      for (var i = 0; i < rects.length; i++) {
        var q = rects[i];
        var ar = q.h * q.w;
        if (ar > 1) { cands.push(i); total += ar; }
      }
      if (!cands.length) break;
      var pick = rng() * total, at = cands[cands.length - 1];
      for (var k = 0; k < cands.length; k++) {
        var a = rects[cands[k]].h * rects[cands[k]].w;
        if (pick < a) { at = cands[k]; break; }
        pick -= a;
      }
      var rc = rects[at], canH = rc.h > 1, canW = rc.w > 1;
      if (!canH && !canW) break;
      var dir = (canH && canW) ? (rng() < 0.5 ? 'h' : 'w') : (canH ? 'h' : 'w');
      if (dir === 'h') {
        var ch = 1 + Math.floor(rng() * (rc.h - 1));
        rects.splice(at, 1,
          { r: rc.r, c: rc.c, h: ch, w: rc.w },
          { r: rc.r + ch, c: rc.c, h: rc.h - ch, w: rc.w });
      } else {
        var cw = 1 + Math.floor(rng() * (rc.w - 1));
        rects.splice(at, 1,
          { r: rc.r, c: rc.c, h: rc.h, w: cw },
          { r: rc.r, c: rc.c + cw, h: rc.h, w: rc.w - cw });
      }
    }
    return rects;
  }

  /* 合并相邻且完全对齐的矩形 —— 提示更少、更像「方形分割」 */
  function mergeRects(rects, target, rng, maxArea) {
    var guard = 0;
    while (rects.length > target && guard++ < 300) {
      var pairs = [];
      for (var i = 0; i < rects.length; i++) {
        for (var j = i + 1; j < rects.length; j++) {
          var a = rects[i], b = rects[j];
          if (a.r === b.r && a.h === b.h && (a.c + a.w === b.c || b.c + b.w === a.c)) {
            if (a.h * (a.w + b.w) <= maxArea) pairs.push([i, j]);
          } else if (a.c === b.c && a.w === b.w && (a.r + a.h === b.r || b.r + b.h === a.r)) {
            if (a.w * (a.h + b.h) <= maxArea) pairs.push([i, j]);
          }
        }
      }
      if (!pairs.length) break;
      var p = pairs[Math.floor(rng() * pairs.length)];
      var ra = rects[p[0]], rb = rects[p[1]], m;
      if (ra.r === rb.r && ra.h === rb.h) m = { r: ra.r, c: Math.min(ra.c, rb.c), h: ra.h, w: ra.w + rb.w };
      else m = { r: Math.min(ra.r, rb.r), c: ra.c, h: ra.h + rb.h, w: ra.w };
      rects[p[0]] = m;
      rects.splice(p[1], 1);
    }
    return rects;
  }

  function splitOne(rects, rng) {
    var cands = [];
    for (var i = 0; i < rects.length; i++) {
      if (rects[i].h > 1 || rects[i].w > 1) cands.push(i);
    }
    if (!cands.length) return false;
    var at = cands[Math.floor(rng() * cands.length)];
    var rc = rects[at], canH = rc.h > 1, canW = rc.w > 1;
    var dir = (canH && canW) ? (rng() < 0.5 ? 'h' : 'w') : (canH ? 'h' : 'w');
    if (dir === 'h') {
      if (rc.h < 2) return false;
      var ch = 1 + Math.floor(rng() * (rc.h - 1));
      rects.splice(at, 1,
        { r: rc.r, c: rc.c, h: ch, w: rc.w },
        { r: rc.r + ch, c: rc.c, h: rc.h - ch, w: rc.w });
    } else {
      if (rc.w < 2) return false;
      var cw = 1 + Math.floor(rng() * (rc.w - 1));
      rects.splice(at, 1,
        { r: rc.r, c: rc.c, h: rc.h, w: cw },
        { r: rc.r, c: rc.c + cw, h: rc.h, w: rc.w - cw });
    }
    return true;
  }

  /* 回溯求解器：统计解数（最多 limit 个），并返回首个解的所有矩形 */
  function solvePuzzle(n, seedMap, limit) {
    var total = n * n;
    var cover = new Uint8Array(total);
    var clueVals = new Int16Array(total);
    clueVals.fill(0);
    var maxV = 0;
    Object.keys(seedMap).forEach(function (k) {
      var s = seedMap[k];
      clueVals[s.r * n + s.c] = s.v;
      if (s.v > maxV) maxV = s.v;
    });
    var count = 0, solution = null, stack = [];

    function rec() {
      if (count >= limit) return;
      var cell = -1;
      for (var i = 0; i < total; i++) {
        if (!cover[i]) { cell = i; break; }
      }
      if (cell < 0) {
        count++;
        if (!solution) solution = stack.slice();
        return;
      }
      var r = Math.floor(cell / n), c = cell % n;
      for (var top = 0; top <= r; top++) {
        for (var bottom = r; bottom < n; bottom++) {
          var h = bottom - top + 1;
          if (h > maxV) continue;
          for (var left = 0; left <= c; left++) {
            for (var right = c; right < n; right++) {
              var area = h * (right - left + 1);
              if (area > maxV) break;
              var bad = false, clueCount = 0, clueVal = 0;
              for (var rr = top; rr <= bottom && !bad; rr++) {
                for (var cc = left; cc <= right; cc++) {
                  var kk = rr * n + cc;
                  if (cover[kk]) { bad = true; break; }
                  var cv = clueVals[kk];
                  if (cv) { clueCount++; clueVal = cv; }
                }
              }
              if (bad || clueCount > 1) break;
              if (clueCount === 1 && area === clueVal) {
                for (var rr2 = top; rr2 <= bottom; rr2++) {
                  for (var cc2 = left; cc2 <= right; cc2++) cover[rr2 * n + cc2] = 1;
                }
                stack.push({ r1: top, c1: left, r2: bottom, c2: right });
                rec();
                stack.pop();
                for (var rr3 = top; rr3 <= bottom; rr3++) {
                  for (var cc3 = left; cc3 <= right; cc3++) cover[rr3 * n + cc3] = 0;
                }
              } else if (clueCount === 1 && area > clueVal) {
                break;
              }
            }
          }
        }
      }
    }
    rec();
    return { count: count, solution: solution };
  }

  function generatePuzzle(n, targetClues, baseSeed) {
    for (var attempt = 0; attempt < 8; attempt++) {
      var rng = mulberry32((baseSeed + attempt * 0x9E3779B9) >>> 0);
      var rects = splitRects(n, targetClues + Math.floor(n / 2), rng);
      rects = mergeRects(rects, targetClues, rng, Math.floor(n * n / 2));
      var tries = 0;
      while (tries++ < n * n) {
        var seeds = [];
        rects.forEach(function (rc) {
          seeds.push({
            r: rc.r + Math.floor(rng() * rc.h),
            c: rc.c + Math.floor(rng() * rc.w),
            v: rc.h * rc.w
          });
        });
        var seedMap = {};
        seeds.forEach(function (s) { seedMap[s.r * n + s.c] = s; });
        var check = solvePuzzle(n, seedMap, 2);
        if (check.count === 1) {
          if (rects.length <= targetClues + 5) {
            return {
              n: n, target: targetClues, seed: baseSeed, attempt: attempt,
              rects: rects, seeds: seeds, solution: check.solution,
              clues: seeds.length, solutions: 1
            };
          }
          break;
        }
        if (rects.length >= targetClues + 5) break;
        if (!splitOne(rects, rng)) break;
      }
    }
    /* 终极兜底：每格一个 1，唯一解恒成立 */
    var seeds2 = [], sol2 = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        seeds2.push({ r: r, c: c, v: 1 });
        sol2.push({ r1: r, c1: c, r2: r, c2: c });
      }
    }
    return { n: n, target: targetClues, seed: baseSeed, seeds: seeds2, solution: sol2, clues: n * n, solutions: 1, fallback: true };
  }

  /* ============================================================
     页面骨架
     ============================================================ */
  var wrap = document.createElement('div');
  wrap.className = 'sh-wrap';
  wrap.innerHTML =
    '<div class="sh-size-row" id="sh-size-row">' +
    '  <button class="sh-size-btn" data-size="0" aria-label="5×5">5×5</button>' +
    '  <button class="sh-size-btn selected" data-size="1" aria-label="7×7">7×7</button>' +
    '  <button class="sh-size-btn" data-size="2" aria-label="9×9">9×9</button>' +
    '  <button class="sh-size-btn" data-size="3" aria-label="11×11">11×11</button>' +
    '  <button class="sh-size-btn sh-daily-btn" id="sh-daily-btn" aria-label="Daily">' + T('gs.shikaku.dailyTab') + '</button>' +
    '</div>' +
    '<div class="sh-daily-status" id="sh-daily-status"></div>' +
    '<div class="sh-hud">' +
    '  <span class="sh-hud-item"><em>' + T('gs.shikaku.hudSize') + '</em><b id="sh-size">7×7</b></span>' +
    '  <span class="sh-hud-item"><em>' + T('gs.shikaku.hudTime') + '</em><b id="sh-time">00:00</b></span>' +
    '  <span class="sh-hud-item"><em>' + T('gs.shikaku.hudLeft') + '</em><b id="sh-left">0</b></span>' +
    '  <span class="sh-hud-item"><em>' + T('gs.shikaku.hudHints') + '</em><b id="sh-hints">3</b></span>' +
    '</div>' +
    '<div class="sh-view" id="sh-view">' +
    '  <div class="sh-board" id="sh-board">' +
    '    <div class="sh-grid" id="sh-grid"></div>' +
    '    <div class="sh-preview sh-hide" id="sh-preview"><span id="sh-area"></span></div>' +
    '    <div class="sh-wavelayer" id="sh-wavelayer"></div>' +
    '    <div class="sh-overlay sh-hide" id="sh-overlay">' +
    '      <h2 id="sh-ov-title"></h2>' +
    '      <div class="sh-ov-stats" id="sh-ov-stats"></div>' +
    '      <div class="sh-ov-btns">' +
    '        <button class="btn green" id="sh-ov-next"></button>' +
    '        <button class="btn" id="sh-ov-restart">' + T('gs.shikaku.again') + '</button>' +
    '      </div>' +
    '    </div>' +
    '    <div class="sh-overlay sh-hide" id="sh-pause">' +
    '      <h2>' + T('gs.shikaku.paused') + '</h2>' +
    '      <div class="sh-ov-stats" id="sh-pause-sub"></div>' +
    '      <div class="sh-ov-btns">' +
    '        <button class="btn green" id="sh-pause-resume">' + T('gs.shikaku.resume') + '</button>' +
    '        <button class="btn" id="sh-pause-restart">' + T('gs.shikaku.again') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="sh-zoom" id="sh-zoom" role="group" aria-label="' + T('gs.shikaku.zoomLbl') + '">' +
    '  <button type="button" class="sh-zbtn" id="sh-zout" aria-label="' + T('gs.shikaku.zoomOut') + '">−</button>' +
    '  <button type="button" class="sh-zbtn sh-zlbl" id="sh-zlbl" aria-label="' + T('gs.shikaku.zoomTip') + '">' +
    '    <b id="sh-zval">1×</b><span id="sh-zpx"></span></button>' +
    '  <button type="button" class="sh-zbtn" id="sh-zin" aria-label="' + T('gs.shikaku.zoomIn') + '">+</button>' +
    '  <button type="button" class="sh-zbtn sh-zreset" id="sh-zreset" aria-label="' + T('gs.shikaku.zoomReset') + '">' + T('gs.shikaku.zoomReset') + '</button>' +
    '</div>' +
    '<div class="sh-msg" id="sh-msg">' + T('gs.shikaku.dragHint') + '</div>' +
    '<div class="sh-tools">' +
    '  <button class="btn" id="sh-undo-btn">' + T('gs.shikaku.undo') + ' <span id="sh-undo-n">0</span></button>' +
    '  <button class="btn" id="sh-clear-btn">' + T('gs.shikaku.clear') + '</button>' +
    '  <button class="btn yellow" id="sh-hint-btn">' + T('gs.shikaku.hint') + ' <span id="sh-hint-n">3</span></button>' +
    '  <button class="btn" id="sh-pause-btn">' + T('gs.shikaku.pause') + '</button>' +
    '  <button class="btn purple" id="sh-restart-btn">' + T('gs.shikaku.again') + '</button>' +
    '</div>' +
    '<div class="sh-help">' + T('gs.shikaku.help') +
    '  <div class="sh-help-sub">' + T('gs.shikaku.helpText') + '</div></div>';
  root.appendChild(wrap);

  var viewEl = document.getElementById('sh-view');
  var gridEl = document.getElementById('sh-grid');
  var boardEl = document.getElementById('sh-board');
  var previewEl = document.getElementById('sh-preview');
  var areaEl = document.getElementById('sh-area');
  var waveLayer = document.getElementById('sh-wavelayer');
  var msgEl = document.getElementById('sh-msg');
  var sizeEl = document.getElementById('sh-size');
  var timeEl = document.getElementById('sh-time');
  var leftEl = document.getElementById('sh-left');
  var hintsEl = document.getElementById('sh-hints');
  var overlayEl = document.getElementById('sh-overlay');
  var ovTitle = document.getElementById('sh-ov-title');
  var ovStats = document.getElementById('sh-ov-stats');
  var ovNext = document.getElementById('sh-ov-next');
  var ovRestart = document.getElementById('sh-ov-restart');
  var pauseEl = document.getElementById('sh-pause');
  var pauseSub = document.getElementById('sh-pause-sub');
  var pauseResume = document.getElementById('sh-pause-resume');
  var pauseRestart = document.getElementById('sh-pause-restart');
  var pauseBtn = document.getElementById('sh-pause-btn');
  var restartBtn = document.getElementById('sh-restart-btn');
  var undoBtn = document.getElementById('sh-undo-btn');
  var undoN = document.getElementById('sh-undo-n');
  var clearBtn = document.getElementById('sh-clear-btn');
  var hintBtn = document.getElementById('sh-hint-btn');
  var hintN = document.getElementById('sh-hint-n');
  var sizeRow = document.getElementById('sh-size-row');
  var dailyBtn = document.getElementById('sh-daily-btn');
  var dailyStatusEl = document.getElementById('sh-daily-status');
  var zOut = document.getElementById('sh-zout');
  var zIn = document.getElementById('sh-zin');
  var zLbl = document.getElementById('sh-zlbl');
  var zVal = document.getElementById('sh-zval');
  var zPx = document.getElementById('sh-zpx');
  var zReset = document.getElementById('sh-zreset');
  var zoom = 1;

  var mode = 'campaign';           // campaign | daily
  var sizeIdx = 1;
  var N = 7;
  var puzzle = null;               // {n, seed, seeds, seedMap, solution, clues}
  var seedMap = {};
  var seeds = [];
  var covered = [];
  var blockOf = [];
  var blocks = [];
  var cells = [];
  var moves = 0, errors = 0, undoCount = 0, hintsUsed = 0, hintsLeft = HINT_MAX;
  var won = false, paused = false, started = false;
  var sel = null, gesture = null, dragging = false;
  var elapsedBase = 0, runStart = 0, lastWinMs = 0;
  var msgTimer = null, fontTick = null, hintTimer = null;
  var lastSec = 0;
  var pendingRestore = null;

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ============================================================
     棋盘构建
     ============================================================ */
  function buildGrid() {
    gridEl.innerHTML = '';
    gridEl.style.setProperty('--n', String(N));
    cells = [];
    for (var i = 0; i < N * N; i++) {
      var r = Math.floor(i / N), c = i % N;
      var d = document.createElement('div');
      d.className = 'sh-cell';
      d.setAttribute('data-i', String(i));
      d.setAttribute('data-r', String(r));
      d.setAttribute('data-c', String(c));
      var sd = seedMap[i];
      if (sd) {
        d.textContent = String(sd.v);
        d.classList.add('seeded');
      }
      gridEl.appendChild(d);
      cells.push(d);
    }
    updateCellFont();
    if (fontTick) clearTimeout(fontTick);
    fontTick = setTimeout(updateCellFont, 120);
  }

  function updateCellFont() {
    if (!cells.length) return;
    var r = gridEl.getBoundingClientRect();
    if (!r.width) return;
    var cs = (r.width - GAP * (N - 1)) / N;
    gridEl.style.fontSize = Math.max(9, Math.floor(cs * 0.42)) + 'px';
    gridEl.style.setProperty('--cell', (cs + GAP) + 'px');
  }
  window.addEventListener('resize', function () {
    if (fontTick) clearTimeout(fontTick);
    fontTick = setTimeout(function () { updateCellFont(); updateZoomUI(); }, 120);
  });

  /* ============================================================
     棋盘视口缩放（真实布局宽度，不做 transform）
     ============================================================ */
  function cellPx() {
    var r = gridEl.getBoundingClientRect();
    if (!r.width) return 0;
    return (r.width - GAP * (N - 1)) / N;
  }

  function fmtZoom(z) {
    var v = Math.round(z * 100) / 100;
    return String(v) + '×';
  }

  /** 按当前屏宽自动算出「单格 ≥44px」的最小缩放（0.05 步进，上限 3×）
      棋盘宽度线性放大、间隙/内边距固定，故用 boardW1 / 固定占位反解 */
  function fitZoom() {
    var r = boardEl.getBoundingClientRect();
    var cur = cellPx();
    if (!r.width || !cur || !zoom) return 1;
    var fixed = r.width - N * cur;           /* 间隙 + 内边距，随缩放不变 */
    var boardW1 = r.width / zoom;
    var need = (44 * N + fixed) / boardW1;
    need = Math.ceil(need * 20 - 1e-6) / 20;
    return Math.round(Math.max(1, Math.min(3, need)) * 100) / 100;
  }

  function updateZoomUI() {
    if (!zVal) return;
    zVal.textContent = fmtZoom(zoom);
    var px = cellPx();
    zPx.textContent = px ? Math.round(px) + 'px · 44→' + fmtZoom(fitZoom()) : '';
    zOut.disabled = zoom <= 1.001;
    zIn.disabled = zoom >= 2.999;
  }

  function setZoom(z, anchorX, anchorY) {
    var nz = Math.max(1, Math.min(3, Math.round(Number(z) * 100) / 100));
    if (!isFinite(nz)) nz = 1;
    if (nz === zoom) { updateZoomUI(); return; }
    var old = zoom;
    var vRect = viewEl.getBoundingClientRect();
    var ax = (anchorX == null) ? vRect.width / 2 : anchorX - vRect.left;
    var ay = (anchorY == null) ? vRect.height / 2 : anchorY - vRect.top;
    var contentX = viewEl.scrollLeft + ax;
    var contentY = viewEl.scrollTop + ay;
    var oldW = boardEl.getBoundingClientRect().width;
    zoom = nz;
    if (sel) cancelSel(true);
    boardEl.style.setProperty('--sh-zoom', String(nz));
    gridEl.style.touchAction = nz > 1 ? 'pan-x pan-y' : 'none';
    updateCellFont();
    var newW = boardEl.getBoundingClientRect().width;
    var ratio = oldW ? newW / oldW : nz / old;
    viewEl.scrollLeft = contentX * ratio - ax;
    viewEl.scrollTop = contentY * ratio - ay;
    updateZoomUI();
  }

  function resetZoom() {
    setZoom(1);
    viewEl.scrollLeft = 0;
    viewEl.scrollTop = 0;
    updateZoomUI();
  }

  function zoomStep(dir) {
    var steps = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
    var cur = zoom, at = 0;
    for (var i = 0; i < steps.length; i++) if (steps[i] <= cur + 0.001) at = i;
    if (dir > 0) at = Math.min(steps.length - 1, at + 1);
    else at = Math.max(0, at - 1);
    setZoom(steps[at]);
  }

  /* 双指捏合：以两指中点为锚点 */
  var pinching = false, pinchBase = 0, pinchZoom = 1;
  var lastPinchAt = 0, lastTouchAt = 0, lastTap = null;
  function touchDist(a, b) {
    var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  viewEl.addEventListener('touchstart', function (e) {
    lastTouchAt = Date.now();
    if (e.touches.length === 2) {
      pinching = true;
      pinchBase = touchDist(e.touches[0], e.touches[1]);
      pinchZoom = zoom;
      lastPinchAt = Date.now();
      if (sel) cancelSel(true);
      // 双指按下即接管手势，避免浏览器先启动原生滚动导致 touchmove 不可取消
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });
  viewEl.addEventListener('touchmove', function (e) {
    lastTouchAt = Date.now();
    if (!pinching || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    lastPinchAt = Date.now();
    var d = touchDist(e.touches[0], e.touches[1]);
    if (!pinchBase || !d) return;
    var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    var my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    setZoom(pinchZoom * d / pinchBase, mx, my);
  }, { passive: false });
  viewEl.addEventListener('touchend', function (e) {
    lastTouchAt = Date.now();
    if (e.touches.length < 2) {
      if (pinching) lastPinchAt = Date.now();
      pinching = false;
      pinchBase = 0;
    }
    if (e.touches.length || !e.changedTouches || !e.changedTouches.length) return;
    if (zoom <= 1 || Date.now() - lastPinchAt < 400) return;
    var t = e.changedTouches[0];
    if (t.target && t.target.closest && t.target.closest('.sh-cell')) return;
    var now = Date.now();
    if (lastTap && now - lastTap.at < 320 &&
        Math.abs(t.clientX - lastTap.x) < 28 && Math.abs(t.clientY - lastTap.y) < 28) {
      resetZoom();
      lastTap = null;
    } else {
      lastTap = { at: now, x: t.clientX, y: t.clientY };
    }
  }, { passive: true });

  // 鼠标双击复位：抢在格子 pointerdown 之前识别，避免被 preventDefault 吞掉
  var lastDblDown = null, dblSuppressUntil = 0;
  viewEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.button !== 0 || zoom <= 1) return;
    var now = Date.now();
    if (lastDblDown && now - lastDblDown.t < 340 &&
        Math.abs(e.clientX - lastDblDown.x) < 26 && Math.abs(e.clientY - lastDblDown.y) < 26) {
      lastDblDown = null;
      dblSuppressUntil = now + 350;
      e.preventDefault();
      e.stopPropagation();
      resetZoom();
      return;
    }
    lastDblDown = { t: now, x: e.clientX, y: e.clientY };
  }, true);
  viewEl.addEventListener('click', function (e) {
    if (performance.now() >= dblSuppressUntil) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  viewEl.addEventListener('dblclick', function () {
    if (Date.now() - lastTouchAt < 500) return;
    resetZoom();
  });

  zOut.addEventListener('click', function () { zoomStep(-1); });
  zIn.addEventListener('click', function () { zoomStep(1); });
  zReset.addEventListener('click', function () { resetZoom(); });
  zLbl.addEventListener('click', function () { setZoom(zoom <= 1.001 ? fitZoom() : 1); });

  /* 鼠标/触控笔在视口空白处拖拽平移 */
  var panDrag = null;
  viewEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (gridEl.contains(e.target) || zoom <= 1) return;
    panDrag = { x: e.clientX, y: e.clientY, sl: viewEl.scrollLeft, st: viewEl.scrollTop };
  });
  viewEl.addEventListener('pointermove', function (e) {
    if (!panDrag) return;
    e.preventDefault();
    viewEl.scrollLeft = panDrag.sl - (e.clientX - panDrag.x);
    viewEl.scrollTop = panDrag.st - (e.clientY - panDrag.y);
  });
  window.addEventListener('pointerup', function () { panDrag = null; });
  window.addEventListener('pointercancel', function () { panDrag = null; });

  function cellAt(clientX, clientY, clamp) {
    var rect = gridEl.getBoundingClientRect();
    var cs = (rect.width - GAP * (N - 1)) / N;
    var x = clientX - rect.left, y = clientY - rect.top;
    var c = Math.floor(x / (cs + GAP));
    var r = Math.floor(y / (cs + GAP));
    if (clamp) {
      if (c < 0) c = 0; if (c >= N) c = N - 1;
      if (r < 0) r = 0; if (r >= N) r = N - 1;
    } else {
      if (c < 0 || c >= N || r < 0 || r >= N) return null;
    }
    return { r: r, c: c, i: r * N + c };
  }

  function normRect(a, b) {
    return {
      r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r),
      c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c)
    };
  }

  function validateRect(rc) {
    var seedsIn = [], overlap = false;
    for (var r = rc.r1; r <= rc.r2; r++) {
      for (var c = rc.c1; c <= rc.c2; c++) {
        var idx = r * N + c;
        if (covered[idx]) overlap = true;
        if (seedMap[idx]) seedsIn.push(seedMap[idx]);
      }
    }
    var area = (rc.r2 - rc.r1 + 1) * (rc.c2 - rc.c1 + 1);
    if (overlap) return { ok: false, code: 'overlap', area: area };
    if (seedsIn.length === 0) return { ok: false, code: 'noSeed', area: area };
    if (seedsIn.length > 1) return { ok: false, code: 'multiSeed', area: area };
    if (area !== seedsIn[0].v) return { ok: false, code: 'area', area: area, seed: seedsIn[0] };
    return { ok: true, area: area, seed: seedsIn[0] };
  }

  /* ============================================================
     预览 / 选中
     ============================================================ */
  function renderPreview(rc, flashBad) {
    if (!rc) { previewEl.classList.add('sh-hide'); return; }
    var a = cells[rc.r1 * N + rc.c1], b = cells[rc.r2 * N + rc.c2];
    if (!a || !b) return;
    var br = boardEl.getBoundingClientRect();
    var ar = a.getBoundingClientRect(), brr = b.getBoundingClientRect();
    previewEl.style.left = (ar.left - br.left) + 'px';
    previewEl.style.top = (ar.top - br.top) + 'px';
    previewEl.style.width = (brr.right - ar.left) + 'px';
    previewEl.style.height = (brr.bottom - ar.top) + 'px';
    var res = validateRect(rc);
    areaEl.textContent = T('gs.shikaku.areaBadge').replace('{a}', res.area);
    previewEl.classList.remove('sh-hide');
    previewEl.classList.toggle('bad', !res.ok);
    if (flashBad) {
      previewEl.classList.remove('bad-flash');
      void previewEl.offsetWidth;
      previewEl.classList.add('bad-flash');
    }
    return res;
  }

  function updatePreview() {
    if (!sel || !gesture) { previewEl.classList.add('sh-hide'); return; }
    renderPreview(normRect(sel, gesture.end), false);
  }

  function markSel() {
    for (var i = 0; i < cells.length; i++) {
      var on = !!(sel && sel.r === Math.floor(i / N) && sel.c === i % N);
      cells[i].classList.toggle('sel', on);
    }
  }

  function cancelSel(silent) {
    if (!sel) return;
    sel = null;
    gesture = null;
    dragging = false;
    markSel();
    previewEl.classList.add('sh-hide');
    if (!silent) {
      setMsg(T('gs.shikaku.startMsg'), '');
      if (Arcade.audio) Arcade.audio.play('back');
    }
  }

  /* ============================================================
     输入：拖拽 / 两次点击
     ============================================================ */
  gridEl.addEventListener('pointerdown', function (e) {
    if (won || paused) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var cell = cellAt(e.clientX, e.clientY, false);
    if (!cell) return;
    var touchPan = e.pointerType === 'touch' && zoom > 1;
    if (!touchPan) e.preventDefault();
    if (covered[cell.i]) {
      setMsg(T('gs.shikaku.cellCovered'), 'var(--neon-pink)', 1100);
      if (Arcade.audio) Arcade.audio.play('error');
      shakeBoard();
      return;
    }
    var existed = !!sel;
    if (!existed) {
      sel = { r: cell.r, c: cell.c };
      cells[cell.i].classList.add('pop');
      (function (el) { setTimeout(function () { el.classList.remove('pop'); }, 260); })(cells[cell.i]);
      if (Arcade.juice) Arcade.juice.select();
      else if (Arcade.audio) Arcade.audio.play('ui');
    }
    gesture = { existed: existed, end: { r: cell.r, c: cell.c }, startX: e.clientX, startY: e.clientY, moved: false, panMode: touchPan };
    dragging = true;
    markSel();
    updatePreview();
    if (!existed) setMsg(T('gs.shikaku.selHint'), 'var(--neon-cyan)');
  });

  window.addEventListener('pointermove', function (e) {
    if (!dragging || !gesture || !sel) return;
    if (gesture.panMode) {
      if (Math.abs(e.clientX - gesture.startX) > 8 || Math.abs(e.clientY - gesture.startY) > 8) {
        gesture.moved = true;
      }
      if (gesture.moved) return; /* 交给原生滚动 */
    }
    var cell = cellAt(e.clientX, e.clientY, true);
    if (!cell) return;
    if (cell.r !== gesture.end.r || cell.c !== gesture.end.c) gesture.moved = true;
    gesture.end = { r: cell.r, c: cell.c };
    updatePreview();
  }, { passive: true });

  window.addEventListener('pointerup', function () {
    if (!dragging || !gesture || !sel) { dragging = false; gesture = null; return; }
    if (gesture.panMode && gesture.moved) {
      dragging = false;
      gesture = null;
      cancelSel(true);
      return;
    }
    var end = gesture.end;
    var same = (end.r === sel.r && end.c === sel.c);
    var wasExisting = gesture.existed;
    dragging = false;
    gesture = null;
    if (same) {
      var clue = seedMap[end.r * N + end.c];
      if (clue && clue.v === 1) {
        /* 线索 1 的唯一解就是 1×1：单点 / 同格拖拽也直接落子，否则单格矩形永远画不出来 */
        commit(normRect(sel, end));
        return;
      }
      if (wasExisting) {
        cancelSel();
      } else {
        previewEl.classList.add('sh-hide');
        setMsg(T('gs.shikaku.selHint'), 'var(--neon-cyan)');
      }
      return;
    }
    commit(normRect(sel, end));
  });

  window.addEventListener('pointercancel', function () {
    var wasPan = !!(gesture && gesture.panMode);
    dragging = false;
    gesture = null;
    previewEl.classList.add('sh-hide');
    if (wasPan && sel) cancelSel(true);
  });

  boardEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    cancelSel();
  });
  boardEl.addEventListener('dblclick', function () { cancelSel(); });

  /* ============================================================
     提交 / 撤销 / 清空
     ============================================================ */
  function commit(rc) {
    if (!sel || paused || won) return null;
    var res = renderPreview(rc, true);
    sel = null;
    markSel();

    if (!res.ok) {
      errors++;
      moves++;
      var text;
      if (res.code === 'overlap') text = T('gs.shikaku.overlap');
      else if (res.code === 'noSeed') text = T('gs.shikaku.noSeed');
      else if (res.code === 'multiSeed') text = T('gs.shikaku.multiSeed');
      else text = T('gs.shikaku.badArea').replace('{a}', res.area).replace('{v}', res.seed.v);
      setMsg(text, 'var(--neon-pink)', 1300);
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(boardEl);
      shakeBoard();
      updateHUD();
      setTimeout(function () {
        previewEl.classList.remove('bad-flash');
        previewEl.classList.add('sh-hide');
      }, 520);
      return res;
    }

    addBlock(rc);
    moves++;
    previewEl.classList.remove('bad', 'bad-flash');
    previewEl.classList.add('sh-hide');
    markSel();
    setMsg(T('gs.shikaku.placedFmt').replace('{n}', remainingSeeds()), 'var(--neon-cyan)', 900);
    updateHUD();
    if (allCovered() && verifySolved()) winGame();
    writeSave();
    return res;
  }

  function addBlock(rc, silent) {
    var bid = blocks.length;
    var color = PALETTE[bid % PALETTE.length];
    blocks.push({ r1: rc.r1, c1: rc.c1, r2: rc.r2, c2: rc.c2, color: color });
    for (var r = rc.r1; r <= rc.r2; r++) {
      for (var c = rc.c1; c <= rc.c2; c++) {
        var idx = r * N + c;
        covered[idx] = true;
        blockOf[idx] = bid;
      }
    }
    paintEdges();
    animateFill(rc);
    if (!silent) {
      if (Arcade.juice) Arcade.juice.clear();
      burstRect(rc, color, 10);
    }
  }

  function animateFill(rc) {
    for (var r = rc.r1; r <= rc.r2; r++) {
      for (var c = rc.c1; c <= rc.c2; c++) {
        var cell = cells[r * N + c];
        if (!cell) continue;
        cell.classList.remove('fill');
        void cell.offsetWidth;
        cell.classList.add('fill');
        cell.style.animationDelay = ((r - rc.r1 + c - rc.c1) * 18) + 'ms';
        (function (el) { setTimeout(function () { el.classList.remove('fill'); el.style.animationDelay = ''; }, 420); })(cell);
      }
    }
  }

  function rebuildCoverage() {
    covered = [];
    blockOf = [];
    for (var i = 0; i < N * N; i++) { covered[i] = false; blockOf[i] = -1; }
    for (var b = 0; b < blocks.length; b++) {
      var rc = blocks[b];
      for (var r = rc.r1; r <= rc.r2; r++) {
        for (var c = rc.c1; c <= rc.c2; c++) {
          var idx = r * N + c;
          covered[idx] = true;
          blockOf[idx] = b;
        }
      }
    }
  }

  function undo() {
    if (won || paused) return;
    if (!blocks.length) {
      setMsg(T('gs.shikaku.noUndo'), 'var(--neon-yellow)', 1100);
      if (Arcade.audio) Arcade.audio.play('back');
      return;
    }
    blocks.pop();
    undoCount++;
    rebuildCoverage();
    paintEdges();
    updateHUD();
    setMsg(T('gs.shikaku.undone').replace('{n}', blocks.length), 'var(--neon-cyan)', 1000);
    if (Arcade.audio) Arcade.audio.play('back');
    writeSave();
  }

  function clearAll() {
    if (won || paused) return;
    if (!blocks.length) {
      setMsg(T('gs.shikaku.noUndo'), 'var(--neon-yellow)', 1100);
      return;
    }
    blocks = [];
    undoCount++;
    rebuildCoverage();
    paintEdges();
    previewEl.classList.add('sh-hide');
    updateHUD();
    setMsg(T('gs.shikaku.cleared'), 'var(--neon-cyan)', 1100);
    if (Arcade.audio) Arcade.audio.play('back');
    writeSave();
  }

  function paintEdges() {
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var sides = ['borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var r = Math.floor(i / N), c = i % N;
      var bid = blockOf[i];
      if (bid < 0) {
        cell.classList.remove('inblock');
        cell.style.background = '';
        cell.style.boxShadow = '';
        cell.style.borderTopColor = cell.style.borderBottomColor = '';
        cell.style.borderLeftColor = cell.style.borderRightColor = '';
        continue;
      }
      var color = blocks[bid].color;
      cell.classList.add('inblock');
      cell.style.background = hexA(color, 0.22);
      cell.style.boxShadow = 'inset 0 0 16px ' + hexA(color, 0.32);
      for (var d = 0; d < 4; d++) {
        var nr = r + dirs[d][0], nc = c + dirs[d][1];
        var same = (nr >= 0 && nr < N && nc >= 0 && nc < N && blockOf[nr * N + nc] === bid);
        cell.style[sides[d]] = same ? 'transparent' : hexA(color, 0.95);
      }
    }
  }

  function shakeBoard() {
    gridEl.classList.remove('shake');
    void gridEl.offsetWidth;
    gridEl.classList.add('shake');
    setTimeout(function () { gridEl.classList.remove('shake'); }, 420);
  }

  /* ============================================================
     提示经济
     ============================================================ */
  function useHint() {
    if (won || paused) return { ok: false, reason: 'state' };
    if (hintsLeft <= 0) {
      setMsg(T('gs.shikaku.noHint'), 'var(--neon-yellow)', 1400);
      if (Arcade.audio) Arcade.audio.play('back');
      return { ok: false, reason: 'empty' };
    }
    var sol = puzzle && puzzle.solution ? puzzle.solution : [];
    var pick = null;
    for (var i = 0; i < sol.length; i++) {
      var rc = sol[i], placed = false;
      for (var b = 0; b < blocks.length; b++) {
        var bl = blocks[b];
        if (bl.r1 === rc.r1 && bl.c1 === rc.c1 && bl.r2 === rc.r2 && bl.c2 === rc.c2) { placed = true; break; }
      }
      if (!placed && (!pick || areaOf(rc) > areaOf(pick))) pick = rc;
    }
    if (!pick && sol.length) pick = sol[0];
    hintsLeft--;
    hintsUsed++;
    elapsedBase += HINT_PENALTY_MS;
    highlightRect(pick);
    setMsg(T('gs.shikaku.hintUsed').replace('{s}', Math.round(HINT_PENALTY_MS / 1000)), 'var(--neon-yellow)', 1600);
    if (Arcade.juice) Arcade.juice.select();
    updateHUD();
    writeSave();
    return { ok: true, rect: pick, hintsLeft: hintsLeft };
  }

  function areaOf(rc) { return (rc.r2 - rc.r1 + 1) * (rc.c2 - rc.c1 + 1); }

  function highlightRect(rc) {
    if (!rc) return;
    if (hintTimer) clearTimeout(hintTimer);
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('hint');
    for (var r = rc.r1; r <= rc.r2; r++) {
      for (var c = rc.c1; c <= rc.c2; c++) {
        var cell = cells[r * N + c];
        if (cell) cell.classList.add('hint');
      }
    }
    hintTimer = setTimeout(function () {
      for (var k = 0; k < cells.length; k++) cells[k].classList.remove('hint');
    }, 1800);
  }

  /* ============================================================
     计时 / HUD
     ============================================================ */
  function elapsedMs() {
    if (won) return lastWinMs;
    return elapsedBase + (paused ? 0 : (Date.now() - runStart));
  }

  function remainingSeeds() {
    var n = 0;
    for (var i = 0; i < seeds.length; i++) {
      if (!covered[seeds[i].r * N + seeds[i].c]) n++;
    }
    return n;
  }

  function allCovered() {
    for (var i = 0; i < covered.length; i++) if (!covered[i]) return false;
    return true;
  }

  function verifySolved() {
    if (!allCovered()) return false;
    var total = 0;
    for (var b = 0; b < blocks.length; b++) {
      var rc = blocks[b];
      var area = areaOf(rc);
      var seedCount = 0, value = 0;
      for (var r = rc.r1; r <= rc.r2; r++) {
        for (var c = rc.c1; c <= rc.c2; c++) {
          var sd = seedMap[r * N + c];
          if (sd) { seedCount++; value = sd.v; }
        }
      }
      if (seedCount !== 1 || area !== value) return false;
      total += area;
    }
    return total === N * N;
  }

  function updateHUD() {
    sizeEl.textContent = N + '×' + N;
    timeEl.textContent = GK.fmtTime(elapsedMs());
    leftEl.textContent = String(remainingSeeds());
    hintsEl.textContent = String(hintsLeft);
    undoN.textContent = String(blocks.length);
    hintN.textContent = String(hintsLeft);
    undoBtn.disabled = won || paused || !blocks.length;
    clearBtn.disabled = won || paused || !blocks.length;
    hintBtn.classList.toggle('depleted', hintsLeft <= 0);
    setTabs();
  }

  function setTabs() {
    var btns = sizeRow.querySelectorAll('.sh-size-btn');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (btn === dailyBtn) btn.classList.toggle('selected', mode === 'daily');
      else btn.classList.toggle('selected', mode === 'campaign' && Number(btn.getAttribute('data-size')) === sizeIdx);
    }
  }

  setInterval(function () {
    if (started && !won && !paused) timeEl.textContent = GK.fmtTime(elapsedMs());
  }, 400);

  /* ============================================================
     每日状态
     ============================================================ */
  function refreshDailyStatus() {
    if (!dailyStatusEl) return;
    var solved = Arcade.daily.isSolved('shikaku');
    var sec = Arcade.daily.solvedTime('shikaku');
    var streak = Arcade.daily.streak();
    var text;
    if (solved) {
      text = T('gs.shikaku.dailySolvedFmt').replace('{t}', String(sec)).replace('{n}', String(streak));
    } else {
      text = T('gs.shikaku.dailyPendingFmt').replace('{n}', String(streak));
    }
    dailyStatusEl.textContent = text;
    dailyStatusEl.classList.toggle('solved', solved);
  }

  /* ============================================================
     开局 / 结算
     ============================================================ */
  function dailySeed() {
    return hashStr('shikaku-daily-' + Arcade.daily.dayStr());
  }

  function startPuzzle(idx, newMode, seed, restore) {
    sizeIdx = Math.max(0, Math.min(SIZES.length - 1, idx));
    mode = newMode === 'daily' ? 'daily' : 'campaign';
    /* 开新局时恢复底部工具栏（结算/暂停时曾隐藏，避免与面板同义入口重复） */
    var toolsEl = document.querySelector('.sh-tools');
    if (toolsEl) toolsEl.classList.remove('sh-tools-hidden');
    N = SIZES[sizeIdx].n;
    var baseSeed = (seed == null) ? (mode === 'daily' ? dailySeed() : randomSeed()) : seed;
    var puz = generatePuzzle(N, SIZES[sizeIdx].clues, baseSeed);
    puzzle = puz;
    seeds = puz.seeds.slice();
    seedMap = {};
    for (var i = 0; i < seeds.length; i++) seedMap[seeds[i].r * N + seeds[i].c] = seeds[i];

    blocks = [];
    covered = [];
    blockOf = [];
    for (var j = 0; j < N * N; j++) { covered[j] = false; blockOf[j] = -1; }
    moves = 0;
    errors = 0;
    undoCount = 0;
    hintsLeft = HINT_MAX;
    hintsUsed = 0;
    won = false;
    paused = false;
    started = true;
    sel = null;
    gesture = null;
    dragging = false;
    elapsedBase = 0;
    runStart = Date.now();
    lastWinMs = 0;

    buildGrid();
    paintEdges();
    resetZoom();

    if (restore) {
      restoreBlocks(restore);
      elapsedBase = Math.max(0, Number(restore.elapsedMs) || 0);
      runStart = Date.now();
      moves = Math.max(0, Number(restore.moves) || 0);
      undoCount = Math.max(0, Number(restore.undoCount) || 0);
      hintsLeft = Math.max(0, Math.min(HINT_MAX, Number(restore.hintsLeft)));
      if (isNaN(hintsLeft)) hintsLeft = HINT_MAX;
      hintsUsed = HINT_MAX - hintsLeft;
    }

    previewEl.classList.add('sh-hide');
    overlayEl.classList.add('sh-hide');
    pauseEl.classList.add('sh-hide');
    pauseBtn.textContent = T('gs.shikaku.pause');
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    removeHintClasses();
    updateHUD();
    refreshDailyStatus();
    if (mode === 'daily') {
      setMsg(T('gs.shikaku.dailyStartMsg'), 'var(--neon-purple)');
    } else {
      setMsg(T('gs.shikaku.dragHint'), '');
    }
    if (!restore) writeSave();
  }

  function restoreBlocks(s) {
    var arr = s.blocks || s.undoStack || s.rects;
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      var rc = arr[i];
      if (!rc || typeof rc.r1 !== 'number') continue;
      if (rc.r1 < 0 || rc.c1 < 0 || rc.r2 >= N || rc.c2 >= N || rc.r1 > rc.r2 || rc.c1 > rc.c2) continue;
      var test = validateRect(rc);
      if (!test.ok) continue;
      addBlock(rc, true);
    }
  }

  function removeHintClasses() {
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('hint');
  }

  function winGame() {
    if (won) return;
    if (!verifySolved()) return;
    won = true;
    resetZoom();
    elapsedBase += Date.now() - runStart;
    lastWinMs = elapsedBase;
    lastSec = Math.max(1, Math.round(lastWinMs / 1000));
    var dailyNote = '';
    if (mode === 'daily') {
      var first = Arcade.daily.markSolved('shikaku', lastSec);
      dailyNote = first ? T('gs.shikaku.dailyRecord') : T('gs.shikaku.dailyRepeat');
      refreshDailyStatus();
      if (first && Arcade.juice) Arcade.juice.win();
    } else {
      if (Arcade.shell) Arcade.shell.submitScore(lastSec);
      if (Arcade.juice) Arcade.juice.win();
    }
    celebrate();
    updateHUD();
    writeSave();
    setTimeout(function () { showWinOverlay(dailyNote); }, 650);
  }

  function celebrate() {
    boardEl.classList.remove('celebrate');
    void boardEl.offsetWidth;
    boardEl.classList.add('celebrate');
    waveLayer.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var d = document.createElement('div');
      d.className = 'sh-wave';
      d.style.animationDelay = (i * 0.16) + 's';
      waveLayer.appendChild(d);
    }
    setTimeout(function () { waveLayer.innerHTML = ''; }, 1500);

    for (var s = 0; s < seeds.length; s++) {
      var el = cells[seeds[s].r * N + seeds[s].c];
      if (!el) continue;
      var r2 = el.getBoundingClientRect();
      if (Arcade.fx) Arcade.fx.burst(r2.left + r2.width / 2, r2.top + r2.height / 2, PALETTE[s % PALETTE.length], 5);
    }
    if (Arcade.fx) Arcade.fx.flash('var(--neon-cyan)');
  }

  function burstRect(rc, color, n) {
    if (!Arcade.fx) return;
    var a = cells[rc.r1 * N + rc.c1], b = cells[rc.r2 * N + rc.c2];
    if (!a || !b) return;
    var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
    Arcade.fx.burst((ar.left + br.right) / 2, (ar.top + br.bottom) / 2, color, n);
  }

  function showWinOverlay(dailyNote) {
    if (!won || !puzzle) return;
    var stats = [];
    stats.push(T('gs.shikaku.levelTimeFmt').replace('{t}', GK.fmtTime(lastWinMs)));
    stats.push(T('gs.shikaku.hintStatFmt').replace('{h}', String(hintsUsed)).replace('{s}', String(hintsUsed * Math.round(HINT_PENALTY_MS / 1000))));
    stats.push(T('gs.shikaku.undoStatFmt').replace('{n}', String(undoCount)));
    stats.push(T('gs.shikaku.movesFmt').replace('{n}', String(moves)));
    stats.push(T('gs.shikaku.scoreFmt').replace('{s}', String(lastSec)));

    if (mode === 'daily') {
      ovTitle.textContent = T('gs.shikaku.dailyWin');
      stats.push(dailyNote);
      stats.push(T('gs.shikaku.dailyNoPollute'));
      ovNext.textContent = T('gs.shikaku.backCampaign');
    } else {
      ovTitle.textContent = T('gs.shikaku.splitDone');
      var best = 0;
      try { best = (Arcade.storage && Arcade.storage.getBest('shikaku')) || 0; } catch (e) { best = 0; }
      if (best > 0) stats.push(T('gs.shikaku.bestFmt').replace('{s}', String(best)));
      ovNext.textContent = sizeIdx < SIZES.length - 1 ? T('gs.shikaku.nextDiff') : T('gs.shikaku.dailyTab');
    }
    ovStats.innerHTML = stats.join('<br>');
    overlayEl.classList.remove('sh-hide');
    /* 结算面板已有「下一难度 / 再来一局」，隐藏页面工具栏的同义入口 */
    var toolsEl = document.querySelector('.sh-tools');
    if (toolsEl) toolsEl.classList.add('sh-tools-hidden');
  }

  function restartCurrent() {
    if (!puzzle) return;
    if (mode === 'daily') startPuzzle(sizeIdx, 'daily', puzzle.seed);
    else startPuzzle(sizeIdx, 'campaign', randomSeed());
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function nextAction() {
    if (mode === 'daily') {
      startPuzzle(sizeIdx, 'campaign', randomSeed());
    } else if (sizeIdx < SIZES.length - 1) {
      startPuzzle(sizeIdx + 1, 'campaign', randomSeed());
    } else {
      startDaily();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function startDaily() {
    startPuzzle(1, 'daily', dailySeed());
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ============================================================
     暂停
     ============================================================ */
  function togglePause() {
    if (won || !started) return;
    if (paused) {
      paused = false;
      runStart = Date.now();
      pauseEl.classList.add('sh-hide');
      pauseBtn.textContent = T('gs.shikaku.pause');
      setMsg(mode === 'daily' ? T('gs.shikaku.dailyStartMsg') : T('gs.shikaku.dragHint'), '');
    } else {
      elapsedBase += Date.now() - runStart;
      paused = true;
      pauseSub.textContent = T('gs.shikaku.pauseHint') + ' · ' + GK.fmtTime(elapsedMs());
      pauseEl.classList.remove('sh-hide');
      pauseBtn.textContent = T('gs.shikaku.resume');
      previewEl.classList.add('sh-hide');
      sel = null;
      gesture = null;
      dragging = false;
      markSel();
      writeSave();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  /* ============================================================
     存档
     ============================================================ */
  function snapshot() {
    if (!started || won || !puzzle) return null;
    return {
      v: 2,
      mode: mode,
      size: N,
      seed: puzzle.seed,
      blocks: blocks.map(function (b) { return { r1: b.r1, c1: b.c1, r2: b.r2, c2: b.c2 }; }),
      undoStack: blocks.map(function (b) { return { r1: b.r1, c1: b.c1, r2: b.r2, c2: b.c2 }; }),
      elapsedMs: elapsedMs(),
      moves: moves,
      undoCount: undoCount,
      hintsLeft: hintsLeft,
      dailyDate: mode === 'daily' ? Arcade.daily.dayStr() : null
    };
  }
  function writeSave() {
    if (Arcade.savegame) Arcade.savegame.write();
  }

  function findSizeIndex(s) {
    var n = Number(s.size || s.n);
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i].n === n) return i;
    return -1;
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    var idx = findSizeIndex(s);
    if (idx < 0) return false;
    if (typeof s.seed !== 'number' || !isFinite(s.seed)) return false;
    var m = s.mode === 'daily' ? 'daily' : 'campaign';
    if (m === 'daily' && s.dailyDate !== Arcade.daily.dayStr()) return false;
    pendingRestore = { s: s, idx: idx, mode: m };
    return true;
  }

  function restoreGame() {
    if (!pendingRestore) return;
    var s = pendingRestore.s;
    try {
      startPuzzle(pendingRestore.idx, pendingRestore.mode, s.seed, s);
    } catch (e) {
      startPuzzle(1, 'campaign', randomSeed());
    }
    pendingRestore = null;
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  ovNext.addEventListener('click', nextAction);
  ovRestart.addEventListener('click', restartCurrent);
  pauseResume.addEventListener('click', togglePause);
  pauseRestart.addEventListener('click', restartCurrent);
  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', restartCurrent);
  undoBtn.addEventListener('click', undo);
  clearBtn.addEventListener('click', clearAll);
  hintBtn.addEventListener('click', useHint);

  sizeRow.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b === dailyBtn) { startDaily(); return; }
    var idx = Number(b.getAttribute('data-size'));
    if (!isNaN(idx)) {
      if (mode === 'campaign' && idx === sizeIdx && !won) return;
      startPuzzle(idx, 'campaign', randomSeed());
      if (Arcade.audio) Arcade.audio.play('ui');
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') {
      e.preventDefault();
      cancelSel();
    } else if (e.code === 'Space' || e.code === 'KeyP') {
      e.preventDefault();
      togglePause();
    } else if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      undo();
    } else if (e.code === 'KeyH') {
      e.preventDefault();
      useHint();
    } else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
      e.preventDefault();
      zoomStep(1);
    } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      zoomStep(-1);
    } else if (e.key === '0' || e.code === 'Numpad0') {
      e.preventDefault();
      resetZoom();
    }
  });

  function setMsg(text, color, resetMs) {
    msgEl.textContent = text;
    msgEl.style.color = color || '';
    if (msgTimer) clearTimeout(msgTimer);
    if (resetMs) {
      msgTimer = setTimeout(function () {
        if (!won && !paused) {
          msgEl.textContent = mode === 'daily' ? T('gs.shikaku.dailyStartMsg') : T('gs.shikaku.dragHint');
          msgEl.style.color = '';
        }
      }, resetMs);
    }
  }

  window.GAME_RESTART = function () { restartCurrent(); };

  /* ============================================================
     启动 + 存档恢复
     ============================================================ */
  Arcade.savegame.setup({
    id: 'shikaku',
    collect: snapshot,
    apply: applySave
  });
  Arcade.savegame.resume();
  if (pendingRestore) restoreGame();
  else startPuzzle(1, 'campaign', randomSeed());
  refreshDailyStatus();

  /* ============================================================
     仅 ?qa=1 的内部钩子
     ============================================================ */
  if (QA) {
    window.__QA = {
      state: function () {
        return {
          mode: mode, size: N, seed: puzzle ? puzzle.seed : null,
          level: sizeIdx + 1, clues: seeds.length, solutions: puzzle ? puzzle.solutions : 0,
          blocks: blocks.length, hintsLeft: hintsLeft, hintsUsed: hintsUsed,
          undoCount: undoCount, undoDepth: blocks.length, moves: moves,
          elapsedMs: elapsedMs(), sec: Math.max(1, Math.round(elapsedMs() / 1000)),
          won: won, paused: paused, covered: covered.filter(Boolean).length,
          dailySolved: Arcade.daily.isSolved('shikaku'),
          streak: Arcade.daily.streak()
        };
      },
      solution: function () { return puzzle ? puzzle.solution.map(function (r) { return { r1: r.r1, c1: r.c1, r2: r.r2, c2: r.c2 }; }) : []; },
      startSize: function (n) {
        var idx = findSizeIndex({ size: n });
        if (idx < 0) idx = 1;
        startPuzzle(idx, 'campaign', randomSeed());
        return this.state();
      },
      startDaily: function () { startDaily(); return this.state(); },
      solve: function () {
        if (!puzzle) return null;
        blocks = [];
        rebuildCoverage();
        paintEdges();
        for (var i = 0; i < puzzle.solution.length; i++) addBlock(puzzle.solution[i], true);
        moves = puzzle.solution.length;
        updateHUD();
        if (allCovered() && verifySolved()) winGame();
        return this.state();
      },
      hint: function () { var h = useHint(); return { ok: h.ok, hintsLeft: hintsLeft, state: this.state() }; },
      undo: function () { undo(); return this.state(); },
      clear: function () { clearAll(); return this.state(); },
      commitRect: function (r1, c1, r2, c2) {
        var rc = { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
        var res = validateRect(rc);
        if (!res.ok) { errors++; moves++; updateHUD(); return { ok: false, code: res.code, area: res.area }; }
        addBlock(rc); moves++; paintEdges(); updateHUD();
        if (allCovered() && verifySolved()) winGame();
        writeSave();
        return { ok: true, area: res.area };
      },
      dailyStatus: function () {
        return { solved: Arcade.daily.isSolved('shikaku'), seconds: Arcade.daily.solvedTime('shikaku'), streak: Arcade.daily.streak() };
      },
      zoom: function (v) { setZoom(Number(v) || 1); return this.zoomInfo(); },
      zoomInfo: function () {
        var vr = viewEl.getBoundingClientRect();
        return {
          zoom: zoom, cell: cellPx(), cellRounded: Math.round(cellPx() * 10) / 10,
          fit: fitZoom(),
          boardW: boardEl.getBoundingClientRect().width,
          viewW: vr.width, viewH: vr.height,
          clientW: viewEl.clientWidth, clientH: viewEl.clientHeight,
          scrollW: viewEl.scrollWidth, scrollH: viewEl.scrollHeight,
          scrollLeft: viewEl.scrollLeft, scrollTop: viewEl.scrollTop,
          canScrollX: viewEl.scrollWidth > viewEl.clientWidth,
          canScrollY: viewEl.scrollHeight > viewEl.clientHeight
        };
      },
      cellRect: function (r, c) {
        var i = Number(r) * N + Number(c);
        var el = cells[i];
        if (!el) return null;
        var b = el.getBoundingClientRect();
        return { r: Number(r), c: Number(c), x: b.left, y: b.top, width: b.width, height: b.height };
      },
      save: function () { writeSave(); return true; }
    };
  }

})();
