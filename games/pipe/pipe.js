/* ============================================================
   管道连接 Pipe · 旗舰级重制
   - 与 circuit 真正共用 PipeGen：生成树可解 + BFS 连通 + 1/2/3/4 口（含 X 四口）
   - 经典 / 专家 两本关卡包 × 12 关；每日挑战（日期种子固定棋盘）
   - 整轮战役计分：累计步数 + 累计秒数，仅在完成第 12 关且本轮有效时提交
   - 一次手势最多旋转一格：pointerdown 记起点 + 按压高亮，pointerup 同格才旋转
   - 存档续玩（兼容 v2 旧档）；HUD 同时显示本关与整轮累计
   ============================================================ */
window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.pipe.tut1t'), d: T('gs.pipe.tut1') },
  { t: T('gs.pipe.tut2t'), d: T('gs.pipe.tut2') },
  { t: T('gs.pipe.tut3t'), d: T('gs.pipe.tut3') }
];

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;
  var T_ = T;
  var W = 520, H = 520;
  var GAME_ID = 'pipe';
  var PACKS = {
    classic: {
      levels: [
        { c: 4, r: 4, d: 1, s: 1 }, { c: 4, r: 5, d: 2, s: 1 },
        { c: 5, r: 5, d: 3, s: 1 }, { c: 5, r: 6, d: 4, s: 1 },
        { c: 6, r: 6, d: 5, s: 1 }, { c: 6, r: 7, d: 6, s: 2 },
        { c: 7, r: 7, d: 7, s: 2 }, { c: 7, r: 8, d: 8, s: 2 },
        { c: 8, r: 8, d: 9, s: 2 }, { c: 8, r: 9, d: 10, s: 3 },
        { c: 9, r: 9, d: 11, s: 3 }, { c: 9, r: 10, d: 12, s: 3 }
      ]
    },
    expert: {
      levels: [
        { c: 6, r: 6, d: 4, s: 2 }, { c: 7, r: 7, d: 5, s: 2 },
        { c: 7, r: 8, d: 6, s: 2 }, { c: 8, r: 8, d: 7, s: 2 },
        { c: 8, r: 9, d: 8, s: 3 }, { c: 9, r: 9, d: 9, s: 2 },
        { c: 9, r: 10, d: 10, s: 3 }, { c: 10, r: 10, d: 10, s: 3 },
        { c: 10, r: 11, d: 11, s: 3 }, { c: 11, r: 11, d: 11, s: 3 },
        { c: 11, r: 12, d: 12, s: 3 }, { c: 12, r: 12, d: 12, s: 2 }
      ]
    }
  };
  var DAILY = { c: 8, r: 8, d: 8, s: 3 };
  var DAILY_BEST_KEY = 'arcade_pipe_daily_best';

  /* 本页自绘控件样式（index.html 只允许改 ?v=，新增样式在脚本内注入） */
  var styleEl = document.createElement('style');
  styleEl.textContent =
    '#game-root .btn{min-height:44px}' +
    '.pp-packs{display:flex;gap:6px;justify-content:center;margin:8px 2px 0;flex-wrap:wrap}' +
    '.pp-pack{appearance:none;border:1px solid rgba(100,235,255,0.25);background:rgba(8,32,42,0.8);' +
    'color:var(--text-dim);border-radius:8px;padding:0 14px;min-height:44px;font-size:12px;cursor:pointer;' +
    'transition:border-color .15s,color .15s,box-shadow .15s}' +
    '.pp-pack:hover{border-color:rgba(100,235,255,0.6);color:#c8fbff}' +
    '.pp-pack.sel{border-color:#6ef0ff;color:#dffcff;box-shadow:0 0 12px rgba(100,235,255,0.32)}' +
    '.pp-lv{min-height:44px}' +
    '.pp-daily{font-size:12px;color:var(--text-dim);margin:8px 2px 0;line-height:1.6}' +
    '.pp-round{color:#8ff5ff}' +
    '.pp-head .bump{animation:ppBump .22s ease-out}' +
    '.pp-overlay{z-index:9750}' +
    '@keyframes ppBump{0%{transform:scale(1.18);color:#bff8ff}100%{transform:scale(1)}}';
  document.head.appendChild(styleEl);

  var wrap = document.createElement('div');
  wrap.className = 'pp-wrap';
  wrap.innerHTML =
    '<div class="pp-head">' +
    '  <span id="pp-level"></span><span id="pp-moves"></span>' +
    '  <span id="pp-time"></span><span id="pp-water"></span>' +
    '</div>' +
    '<div class="pp-head"><span id="pp-round" class="pp-round"></span></div>' +
    '<div class="pp-view" id="pp-view">' +
    '  <div class="pp-stage" id="pp-stage">' +
    '    <canvas id="pp-canvas" class="pp-canvas" aria-label="' + T_('gs.pipe.canvasAria') + '"></canvas>' +
    '    <div class="pp-paused hidden" id="pp-paused"></div>' +
    '    <div class="pp-overlay hidden" id="pp-overlay">' +
    '      <div class="pp-ov-card">' +
    '        <div class="pp-ov-title" id="pp-ov-title"></div>' +
    '        <div class="pp-ov-stats" id="pp-ov-stats"></div>' +
    '        <div class="pp-ov-score" id="pp-ov-score"></div>' +
    '        <div class="pp-ov-best" id="pp-ov-best"></div>' +
    '        <div class="pp-ov-btns">' +
    '          <button class="btn green" id="pp-next"></button>' +
    '          <button class="btn" id="pp-replay"></button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="pp-zoombar" id="pp-zoombar">' +
    '  <button class="pp-zbtn" id="pp-zoom-out" type="button" aria-label="' + T_('gs.pipe.zoomOut') + '">−</button>' +
    '  <button class="pp-zval" id="pp-zoom-val" type="button" aria-label="' + T_('gs.pipe.zoomTip') + '"></button>' +
    '  <button class="pp-zbtn" id="pp-zoom-in" type="button" aria-label="' + T_('gs.pipe.zoomIn') + '">+</button>' +
    '  <button class="pp-zbtn pp-zrst" id="pp-zoom-reset" type="button">' + T_('gs.pipe.zoomReset') + '</button>' +
    '  <span class="pp-zcell" id="pp-zoom-cell"></span>' +
    '</div>' +
    '<div class="pp-msg" id="pp-msg" aria-live="polite"></div>' +
    '<div class="pp-packs" id="pp-packs"></div>' +
    '<div class="pp-levels" id="pp-levels"></div>' +
    '<div class="pp-daily hidden" id="pp-daily"></div>' +
    '<div class="game-controls">' +
    '  <button class="btn purple" id="pp-restart"></button>' +
    '  <button class="btn" id="pp-pause"></button>' +
    '</div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#pp-canvas');
  var gk = GK.setup(canvas, W, H);
  var ctx = gk.ctx;
  var msgEl = wrap.querySelector('#pp-msg');
  var levelEl = wrap.querySelector('#pp-level');
  var movesEl = wrap.querySelector('#pp-moves');
  var timeEl = wrap.querySelector('#pp-time');
  var waterEl = wrap.querySelector('#pp-water');
  var roundEl = wrap.querySelector('#pp-round');
  var packRow = wrap.querySelector('#pp-packs');
  var levelRow = wrap.querySelector('#pp-levels');
  var dailyEl = wrap.querySelector('#pp-daily');
  var overlayEl = wrap.querySelector('#pp-overlay');
  var ovTitle = wrap.querySelector('#pp-ov-title');
  var ovStats = wrap.querySelector('#pp-ov-stats');
  var ovScore = wrap.querySelector('#pp-ov-score');
  var ovBest = wrap.querySelector('#pp-ov-best');
  var nextBtn = wrap.querySelector('#pp-next');
  var replayBtn = wrap.querySelector('#pp-replay');
  var restartBtn = wrap.querySelector('#pp-restart');
  var pauseBtn = wrap.querySelector('#pp-pause');
  var pausedEl = wrap.querySelector('#pp-paused');
  var viewEl = wrap.querySelector('#pp-view');
  var stageEl = wrap.querySelector('#pp-stage');
  var zoomOutBtn = wrap.querySelector('#pp-zoom-out');
  var zoomValBtn = wrap.querySelector('#pp-zoom-val');
  var zoomInBtn = wrap.querySelector('#pp-zoom-in');
  var zoomResetBtn = wrap.querySelector('#pp-zoom-reset');
  var zoomCellEl = wrap.querySelector('#pp-zoom-cell');

  /* ---------------- 棋盘视口缩放（真实布局宽度，非 transform） ---------------- */
  var ZOOM_MIN = 1, ZOOM_MAX = 3;
  var ZOOM_PRESETS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
  var zoom = 1;
  var recentTaps = [];          // 双击复位时回滚这两次点击造成的旋转
  var lastTouchTap = null;
  var lastMouseTap = null;
  var suppressTapUntil = 0;     // 双指手势结束后短暂屏蔽点按
  var lastGestureReset = 0;
  var dragState = null;
  var suppressClickUntil = 0;

  function zoomLabel(z) {
    var s = Math.round(z * 100) / 100;
    return (Math.abs(s - Math.round(s)) < 1e-6 ? String(Math.round(s)) : String(s)) + '×';
  }
  function cellCssPx() {
    var r = canvas.getBoundingClientRect();
    return r.width ? layout.cell * (r.width / W) : 0;
  }
  /** 按当前屏宽自动算出「单格 ≥44px」的最小缩放（0.05 步进，上限 3×） */
  function fitZoom() {
    var px = cellCssPx();
    if (!px || !zoom) return { z: ZOOM_MIN, px: 0 };
    var base = px / zoom;
    var need = Math.ceil((44 / base) * 20 - 1e-6) / 20;
    need = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, need));
    return { z: Math.round(need * 100) / 100, px: base * need };
  }
  function updateZoomUI() {
    if (zoomValBtn) {
      zoomValBtn.textContent = zoomLabel(zoom);
      zoomValBtn.setAttribute('aria-label', T_('gs.pipe.zoomTip'));
    }
    if (zoomCellEl) {
      var fit = fitZoom();
      zoomCellEl.textContent = T_('gs.pipe.zoomLbl').replace('{n}', Math.round(cellCssPx())) +
        (fit.px ? ' · 44→' + zoomLabel(fit.z) : '');
    }
    if (zoomOutBtn) zoomOutBtn.disabled = zoom <= ZOOM_MIN + 1e-6;
    if (zoomInBtn) zoomInBtn.disabled = zoom >= ZOOM_MAX - 1e-6;
    if (zoomResetBtn) zoomResetBtn.classList.toggle('on', zoom > ZOOM_MIN + 1e-6);
  }
  /** 设置缩放；anchorX/anchorY 为视口坐标，缩放时尽量保持该点内容不动 */
  function setZoom(z, anchorX, anchorY) {
    z = Number(z);
    if (!isFinite(z)) return zoom;
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    if (!viewEl || !stageEl) { zoom = z; return zoom; }
    var rect = viewEl.getBoundingClientRect();
    var ax = anchorX == null ? viewEl.clientWidth / 2 : anchorX - rect.left;
    var ay = anchorY == null ? viewEl.clientHeight / 2 : anchorY - rect.top;
    var cx = viewEl.scrollLeft + ax;
    var cy = viewEl.scrollTop + ay;
    var old = zoom;
    var oldW = stageEl.offsetWidth;
    zoom = z;
    stageEl.style.setProperty('--pp-zoom', String(z));
    var newW = stageEl.offsetWidth;
    var ratio = oldW > 0 ? newW / oldW : z / old;
    if (z <= ZOOM_MIN + 1e-6) {
      viewEl.scrollLeft = 0;
      viewEl.scrollTop = 0;
    } else {
      viewEl.scrollLeft = Math.max(0, cx * ratio - ax);
      viewEl.scrollTop = Math.max(0, cy * ratio - ay);
    }
    updateZoomUI();
    return zoom;
  }
  function resetZoom() {
    setZoom(1, null, null);
    if (viewEl) { viewEl.scrollLeft = 0; viewEl.scrollTop = 0; }
    updateZoomUI();
  }
  function zoomStep(dir) {
    var target = null, i;
    if (dir > 0) {
      for (i = 0; i < ZOOM_PRESETS.length; i++) {
        if (ZOOM_PRESETS[i] > zoom + 0.001) { target = ZOOM_PRESETS[i]; break; }
      }
      if (target == null) target = ZOOM_MAX;
    } else {
      for (i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
        if (ZOOM_PRESETS[i] < zoom - 0.001) { target = ZOOM_PRESETS[i]; break; }
      }
      if (target == null) target = ZOOM_MIN;
    }
    return setZoom(target, null, null);
  }
  function toggleZoomPreset() {
    return setZoom(zoom > ZOOM_MIN + 1e-6 ? ZOOM_MIN : fitZoom().z, null, null);
  }
  function zoomInfo() {
    var r = canvas.getBoundingClientRect();
    return {
      zoom: zoom,
      cellPx: r.width ? layout.cell * (r.width / W) : 0,
      fit: fitZoom().z,
      fitPx: fitZoom().px,
      viewport: viewEl ? viewEl.clientWidth : 0,
      clientWidth: r.width,
      innerWidth: window.innerWidth,
      scrollLeft: viewEl ? viewEl.scrollLeft : 0,
      scrollTop: viewEl ? viewEl.scrollTop : 0,
      scrollWidth: viewEl ? viewEl.scrollWidth : 0,
      stageWidth: stageEl ? stageEl.offsetWidth : 0
    };
  }
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { zoomStep(-1); });
  if (zoomInBtn) zoomInBtn.addEventListener('click', function () { zoomStep(1); });
  if (zoomValBtn) zoomValBtn.addEventListener('click', function () { toggleZoomPreset(); });
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', function () { resetZoom(); });
  window.addEventListener('resize', function () {
    stageEl.style.setProperty('--pp-zoom', String(zoom));
    viewEl.scrollLeft = Math.min(viewEl.scrollLeft, Math.max(0, viewEl.scrollWidth - viewEl.clientWidth));
    viewEl.scrollTop = Math.min(viewEl.scrollTop, Math.max(0, viewEl.scrollHeight - viewEl.clientHeight));
    updateZoomUI();
  });

  function touchDist(a, b) {
    var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  var pinchState = null;
  viewEl.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      pinchState = { d: touchDist(e.touches[0], e.touches[1]), z: zoom };
      pressCell = null;
      pressCanceled = false;
      lastTouchTap = null;
      suppressTapUntil = performance.now() + 500;
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });
  viewEl.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2 && pinchState) {
      if (e.cancelable) e.preventDefault();
      var d = touchDist(e.touches[0], e.touches[1]);
      if (pinchState.d > 8) {
        var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setZoom(pinchState.z * d / pinchState.d, mx, my);
      }
      suppressTapUntil = performance.now() + 400;
    }
  }, { passive: false });
  viewEl.addEventListener('touchend', function (e) {
    if (pinchState && e.touches.length < 2) {
      pinchState = null;
      suppressTapUntil = performance.now() + 400;
      lastTouchTap = null;
    }
  });

  /* 鼠标/触控笔拖拽平移（触屏交给原生滚动） */
  viewEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    if (e.button != null && e.button !== 0) return;
    dragState = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: viewEl.scrollLeft, st: viewEl.scrollTop, moved: false };
  });
  viewEl.addEventListener('pointermove', function (e) {
    if (!dragState || e.pointerId !== dragState.id) return;
    var dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
    if (!dragState.moved && Math.abs(dx) + Math.abs(dy) <= 6) return;
    dragState.moved = true;
    viewEl.scrollLeft = dragState.sl - dx;
    viewEl.scrollTop = dragState.st - dy;
    if (pressCell) pressCanceled = true;
    if (e.cancelable) e.preventDefault();
  });
  function endDrag(e) {
    if (!dragState) return;
    if (dragState.moved) {
      suppressClickUntil = performance.now() + 300;
      pressCell = null;
      pressCanceled = false;
    }
    dragState = null;
  }
  viewEl.addEventListener('pointerup', endDrag);
  viewEl.addEventListener('pointercancel', endDrag);
  viewEl.addEventListener('click', function (e) {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* 双击复位：回滚双击造成的那两次旋转，再复位缩放 */
  function revertTap(tp) {
    var cell = board.cells[idxOf(tp.r, tp.c)];
    if (!cell || cell.fixed || cell.type === 'X') return false;
    cell.rot = (cell.rot + 3) % 4;
    moves = Math.max(0, moves - 1);
    return true;
  }
  /** 回滚双击两次点击造成的旋转；explicit 为双击识别时明确捕获的两个落点 */
  function undoRecentTaps(x, y, explicit) {
    if (!board || won) { recentTaps.length = 0; return 0; }
    var now = performance.now(), done = 0, i;
    if (explicit) {
      for (i = explicit.length - 1; i >= 0; i--) { if (revertTap(explicit[i])) done++; }
    } else {
      for (i = recentTaps.length - 1; i >= 0 && done < 2; i--) {
        var tp = recentTaps[i];
        if (now - tp.t > 520) continue;
        var dx = tp.x - x, dy = tp.y - y;
        if (dx * dx + dy * dy > 34 * 34) continue;
        if (revertTap(tp)) done++;
      }
    }
    recentTaps.length = 0;
    if (done) { recalc(); updateHud(); writeSave(); }
    return done;
  }
  function gestureReset(x, y, tapA, tapB) {
    var now = performance.now();
    if (now - lastGestureReset < 350) return;
    lastGestureReset = now;
    lastEmptyTap = null;
    undoRecentTaps(x, y, (tapA && tapB) ? [tapA, tapB] : null);
    resetZoom();
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  var lastEmptyTap = null;
  // 空白/不可旋转格上的双击也复位（不依赖原生 dblclick 的 clickCount）
  viewEl.addEventListener('pointerup', function (e) {
    if (mustIgnoreEmptyTap(e)) return;
    var now = performance.now();
    var cur = { t: now, x: e.clientX, y: e.clientY };
    if (lastEmptyTap && now - lastEmptyTap.t <= 550 &&
        Math.abs(e.clientX - lastEmptyTap.x) <= 28 && Math.abs(e.clientY - lastEmptyTap.y) <= 28) {
      lastEmptyTap = null;
      gestureReset(e.clientX, e.clientY);
    } else {
      lastEmptyTap = cur;
    }
  });
  function mustIgnoreEmptyTap(e) {
    var now = performance.now();
    if (now < suppressClickUntil) return true;
    if (e.pointerType === 'touch' && now < suppressTapUntil) return true;
    if (pinchState) return true;
    if (now - lastRotateTapTime < 40) return true;
    return false;
  }
  viewEl.addEventListener('dblclick', function (e) {
    if (e.cancelable) e.preventDefault();
    gestureReset(e.clientX, e.clientY);
  });
  var lastRotateTapTime = 0;
  function noteTapPoint(e, r, c) {
    var now = performance.now();
    lastRotateTapTime = now;
    var cur = { t: now, x: e.clientX, y: e.clientY, r: r, c: c };
    recentTaps.push(cur);
    if (recentTaps.length > 6) recentTaps.shift();
    var near = function (prev) {
      return prev && now - prev.t <= 550 && prev.r === r && prev.c === c &&
        Math.abs(e.clientX - prev.x) <= 28 && Math.abs(e.clientY - prev.y) <= 28;
    };
    if (e.pointerType === 'touch') {
      if (now < suppressTapUntil) return;
      if (near(lastTouchTap)) {
        var prev = lastTouchTap;
        lastTouchTap = null;
        gestureReset(e.clientX, e.clientY, prev, cur);
      } else {
        lastTouchTap = cur;
      }
    } else {
      // 鼠标/笔的双击：pointerdown 的 preventDefault 会吞掉原生 dblclick，这里自行识别
      if (near(lastMouseTap)) {
        var prevm = lastMouseTap;
        lastMouseTap = null;
        gestureReset(e.clientX, e.clientY, prevm, cur);
      } else {
        lastMouseTap = cur;
      }
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'NumpadAdd' || e.code === 'Equal' || e.key === '+') {
      e.preventDefault(); zoomStep(1);
    } else if (e.code === 'NumpadSubtract' || e.code === 'Minus' || e.key === '-') {
      e.preventDefault(); zoomStep(-1);
    } else if (e.code === 'Digit0' || e.code === 'Numpad0' || e.key === '0') {
      e.preventDefault(); resetZoom();
    }
  });

  var board = null;
  var mode = 'campaign';        // campaign | daily
  var packKey = 'classic';      // classic | expert | daily
  var levelIdx = 0;
  var seed = 1;
  var moves = 0;
  var elapsed = 0;
  var lastNow = 0;
  var paused = false;
  var won = false;
  var power = null;
  var lit = 0;
  var sinkTotal = 0;
  var flashT = 0;
  var winAnim = 0;
  var animStart = [];
  var cursor = { r: 0, c: 0 };
  var layout = { cell: 40, ox: 10, oy: 10 };
  var pressCell = null, pressAt = 0, pressCanceled = false;
  var lastPress = null;        // QA 用：最近一次命中的格子
  var campaign = { valid: true, moves: 0, ms: 0 };
  var lastContrib = null;
  var dailyBest = 0;
  var dailyOverlay = false;   // 每日结算面板打开时，次按钮改为“返回经典”

  function idxOf(r, c) { return r * board.cols + c; }
  function cellPos(i) {
    var r = Math.floor(i / board.cols), c = i % board.cols;
    return {
      x: layout.ox + (c + 0.5) * layout.cell,
      y: layout.oy + (r + 0.5) * layout.cell
    };
  }
  function layoutBoard() {
    var cell = Math.min((W - 20) / board.cols, (H - 20) / board.rows);
    layout = { cell: cell, ox: (W - cell * board.cols) / 2, oy: (H - cell * board.rows) / 2 };
  }
  function recalc() {
    power = PipeGen.derive(board);
    lit = power.connectedSinks.length;
    sinkTotal = (board.sinks || []).length;
  }
  function timeSec() { return Math.floor(elapsed / 1000); }
  function chooseSeed() { return (Date.now() % 2147483647) + levelIdx * 7919 + Math.floor(Math.random() * 9973); }
  function levelsOf() { return packKey === 'expert' ? PACKS.expert.levels : PACKS.classic.levels; }
  function confFor(li) { return mode === 'daily' ? DAILY : levelsOf()[li]; }
  function maxLevels() { return mode === 'daily' ? 1 : 12; }
  function isDaily() { return mode === 'daily'; }
  function dailySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function readDailyBest() {
    try { dailyBest = Number(localStorage.getItem(DAILY_BEST_KEY) || 0) || 0; } catch (e) { dailyBest = 0; }
  }
  function writeDailyBest(sec) {
    if (!dailyBest || sec < dailyBest) {
      dailyBest = sec;
      try { localStorage.setItem(DAILY_BEST_KEY, String(sec)); } catch (e) {}
    }
  }
  function bump(el) {
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function assignBoard(li, sd, rots, mv, el) {
    levelIdx = Math.max(0, Math.min(maxLevels() - 1, li));
    var L = confFor(levelIdx);
    seed = typeof sd === 'number' && isFinite(sd) ? sd : (isDaily() ? dailySeed() : chooseSeed());
    board = PipeGen.makeBoard(L.c, L.r, { level: L.d, sinks: L.s }, seed);
    var n = board.cells.length;
    if (Array.isArray(rots) && rots.length === n) {
      for (var i = 0; i < n; i++) {
        if (board.cells[i].fixed) continue;
        var v = Number(rots[i]);
        if (v >= 0 && v < 4) board.cells[i].rot = v;
      }
    }
    moves = Math.max(0, Number(mv) || 0);
    elapsed = Math.max(0, Number(el) || 0);
    paused = false;
    won = false;
    flashT = 0;
    winAnim = 0;
    animStart = [];
    pressCell = null;
    pressCanceled = false;
    lastNow = performance.now();
    layoutBoard();
    cursor = { r: board.sourcePos ? board.sourcePos.r : 0, c: 0 };
    recalc();
    resetZoom();
    recentTaps.length = 0;
    lastTouchTap = null;
    overlayEl.classList.add('hidden');
    pausedEl.classList.add('hidden');
    restartBtn.textContent = T_('gs.pipe.replay');
    pauseBtn.textContent = T_('gs.pipe.pause');
    msgEl.textContent = isDaily()
      ? T_('gs.pipe.dailyStartMsg')
      : (T_('gs.pipe.startMsg') + ' · ' + T_('gs.pipe.minHint').replace('{n}', board.minMoves));
    syncRows();
    updateHud();
  }

  function loadLevel(li, sd) {
    assignBoard(li, sd, null, 0, 0);
    writeSave();
  }
  function startCampaign(pk) {
    mode = 'campaign';
    packKey = pk === 'expert' ? 'expert' : 'classic';
    campaign = { valid: true, moves: 0, ms: 0 };
    lastContrib = null;
    dailyOverlay = false;
    loadLevel(0);
  }
  function startDaily() {
    mode = 'daily';
    packKey = 'daily';
    campaign = { valid: false, moves: 0, ms: 0 };
    lastContrib = null;
    dailyOverlay = false;
    readDailyBest();
    loadLevel(0, dailySeed());
  }
  function syncRows() {
    var pbs = packRow.querySelectorAll('.pp-pack');
    for (var i = 0; i < pbs.length; i++) pbs[i].classList.toggle('sel', pbs[i].getAttribute('data-pack') === (isDaily() ? 'daily' : packKey));
    var bs = levelRow.querySelectorAll('.pp-lv');
    for (var j = 0; j < bs.length; j++) {
      bs[j].style.display = isDaily() ? 'none' : '';
      bs[j].classList.toggle('sel', j === levelIdx);
    }
    dailyEl.classList.toggle('hidden', !isDaily());
    packRow.style.display = '';
    if (isDaily()) updateDailyPanel();
  }
  function updateDailyPanel() {
    var solved = (window.Arcade && Arcade.daily) ? Arcade.daily.solvedTime(GAME_ID) : null;
    var streak = (window.Arcade && Arcade.daily) ? Arcade.daily.streak() : 0;
    var best = dailyBest ? GK.fmtTime(dailyBest * 1000) : '----';
    var t = solved == null ? null : GK.fmtTime(Number(solved) * 1000);
    dailyEl.textContent = T_(t == null ? 'gs.pipe.dailyInfoTodo' : 'gs.pipe.dailyInfo')
      .replace('{s}', streak).replace('{t}', t == null ? '----' : t).replace('{b}', best);
  }
  function updateHud() {
    if (!board) return;
    if (isDaily()) {
      levelEl.textContent = T_('gs.pipe.dailyLevel');
      movesEl.textContent = T_('gs.pipe.movesLbl').replace('{n}', moves);
      timeEl.textContent = T_('gs.pipe.timeLbl').replace('{t}', GK.fmtTime(elapsed));
      waterEl.textContent = T_('gs.pipe.waterLbl').replace('{n}', lit).replace('{m}', sinkTotal);
      var solved = (window.Arcade && Arcade.daily) ? Arcade.daily.solvedTime(GAME_ID) : null;
      var streak = (window.Arcade && Arcade.daily) ? Arcade.daily.streak() : 0;
      roundEl.textContent = T_('gs.pipe.dailyRound')
        .replace('{s}', streak)
        .replace('{t}', solved == null ? '----' : GK.fmtTime(Number(solved) * 1000))
        .replace('{b}', dailyBest ? GK.fmtTime(dailyBest * 1000) : '----');
    } else {
      levelEl.textContent = T_(packKey === 'expert' ? 'gs.pipe.packExpert' : 'gs.pipe.packClassic') +
        ' ' + (levelIdx + 1) + '/' + maxLevels();
      movesEl.textContent = T_('gs.pipe.movesLbl').replace('{n}', moves);
      timeEl.textContent = T_('gs.pipe.timeLbl').replace('{t}', GK.fmtTime(elapsed));
      waterEl.textContent = T_('gs.pipe.waterLbl').replace('{n}', lit).replace('{m}', sinkTotal);
      var counted = won && lastContrib && lastContrib.level === levelIdx;
      roundEl.textContent = campaign.valid
        ? T_('gs.pipe.roundLbl')
            .replace('{m}', campaign.moves + (counted ? 0 : moves))
            .replace('{t}', GK.fmtTime(campaign.ms + (counted ? 0 : elapsed)))
        : T_('gs.pipe.roundVoid');
    }
    updateDailyPanel();
  }
  function writeSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.write();
  }

  function rotateAt(r, c) {
    if (!board || won || paused) return;
    if (r < 0 || c < 0 || r >= board.rows || c >= board.cols) return;
    var i = idxOf(r, c), cell = board.cells[i];
    if (cell.openCount === 0) return;
    if (cell.fixed) {
      msgEl.textContent = T_('gs.pipe.locked');
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.fx) Arcade.fx.shake(canvas);
      return;
    }
    if (cell.type === 'X') {
      // 四口 X 四向全开，旋转不改变开口集合，也不计入步数
      animStart[i] = performance.now();
      if (Arcade.juice) Arcade.juice.rotate();
      return;
    }
    var prevLit = lit;
    var prevSinks = power ? power.connectedSinks.slice() : [];
    cell.rot = (cell.rot + 1) % 4;
    animStart[i] = performance.now();
    moves++;
    recalc();
    updateHud();
    bump(movesEl);
    if (Arcade.juice) Arcade.juice.rotate();
    // 新接通出水口：接通瞬间粒子
    for (var k = 0; k < power.connectedSinks.length; k++) {
      var si = power.connectedSinks[k];
      if (prevSinks.indexOf(si) < 0) {
        var sp = cellPos(si);
        GK.burst(canvas, sp.x, sp.y, '#7ce8ff', 16);
      }
    }
    if (!won && power.ok) {
      completeLevel();
    } else if (!won && lit > prevLit) {
      msgEl.textContent = T_('gs.pipe.flowing').replace('{n}', lit).replace('{m}', sinkTotal);
      if (Arcade.audio) Arcade.audio.play('coin');
    } else if (!won && lit < prevLit) {
      flashT = 1;
      if (Arcade.audio) Arcade.audio.play('error');
      msgEl.textContent = T_('gs.pipe.leak');
    } else if (!won && power.reached.length > 1) {
      msgEl.textContent = T_('gs.pipe.pouring').replace('{n}', lit).replace('{m}', sinkTotal);
    }
    writeSave();
  }

  function recordContribution() {
    if (isDaily() || !campaign.valid) return;
    campaign.moves += moves;
    campaign.ms += elapsed;
    lastContrib = { level: levelIdx, m: moves, ms: elapsed };
  }
  function unrecordContribution() {
    if (!isDaily() && campaign.valid && lastContrib && lastContrib.level === levelIdx) {
      campaign.moves = Math.max(0, campaign.moves - lastContrib.m);
      campaign.ms = Math.max(0, campaign.ms - lastContrib.ms);
    }
    lastContrib = null;
  }

  function completeLevel() {
    won = true;
    winAnim = 0.01;
    flashT = 0;
    msgEl.textContent = T_(isDaily() ? 'gs.pipe.dailyWinMsg' : 'gs.pipe.winMsg');
    if (Arcade.juice) Arcade.juice.win();
    if (Arcade.fx) Arcade.fx.shake(canvas);
    var srcP = cellPos(board.sources[0]);
    GK.burst(canvas, srcP.x, srcP.y, '#d8fbff', 16);
    nextBtn.textContent = T_('gs.pipe.next');
    replayBtn.textContent = T_('gs.pipe.replay');

    if (isDaily()) {
      var sec = Math.max(1, timeSec());
      if (Arcade.daily) Arcade.daily.markSolved(GAME_ID, sec);
      writeDailyBest(sec);
      var solved = Arcade.daily ? Arcade.daily.solvedTime(GAME_ID) : sec;
      var streak = Arcade.daily ? Arcade.daily.streak() : 0;
      ovTitle.textContent = T_('gs.pipe.dailyTitle');
      ovStats.textContent = T_('gs.pipe.dailyStats')
        .replace('{lit}', lit).replace('{total}', sinkTotal)
        .replace('{moves}', moves).replace('{time}', GK.fmtTime(elapsed));
      ovScore.textContent = T_('gs.pipe.dailyRound')
        .replace('{s}', streak)
        .replace('{t}', GK.fmtTime(Number(solved) * 1000))
        .replace('{b}', dailyBest ? GK.fmtTime(dailyBest * 1000) : '----');
      ovBest.textContent = T_('gs.pipe.dailyNoBest');
      nextBtn.textContent = T_('gs.pipe.dailyAgain');
      replayBtn.textContent = T_('gs.pipe.backClassic');
      dailyOverlay = true;
      resetZoom();
      overlayEl.classList.remove('hidden');
      updateHud();
      writeSave();
      return;
    }

    dailyOverlay = false;
    recordContribution();
    var isLast = levelIdx >= maxLevels() - 1;
    var finalScore = campaign.moves + Math.floor(campaign.ms / 1000);
    if (isLast && campaign.valid && finalScore > 0) {
      if (Arcade.shell) Arcade.shell.submitScore(finalScore);
    }
    var best = (window.Arcade && Arcade.storage) ? Arcade.storage.getBest(GAME_ID) : null;
    ovTitle.textContent = T_(isLast ? (campaign.valid ? 'gs.pipe.allTitle' : 'gs.pipe.practiceTitle') : 'gs.pipe.winTitle');
    ovStats.textContent = T_('gs.pipe.levelStats')
      .replace('{moves}', moves).replace('{time}', GK.fmtTime(elapsed))
      .replace('{lit}', lit).replace('{total}', sinkTotal) + ' · ' +
      T_('gs.pipe.roundStats').replace('{m}', campaign.moves).replace('{t}', GK.fmtTime(campaign.ms));
    if (isLast && campaign.valid) {
      ovScore.textContent = T_('gs.pipe.finalScore').replace('{n}', finalScore);
    } else if (isLast) {
      ovScore.textContent = T_('gs.pipe.invalidFinal');
    } else {
      ovScore.textContent = T_('gs.pipe.roundScore').replace('{m}', campaign.valid ? campaign.moves : 0).replace('{t}', GK.fmtTime(campaign.valid ? campaign.ms : 0));
    }
    ovBest.textContent = T_('gs.pipe.bestLbl').replace('{n}', best == null ? '----' : best);
    nextBtn.textContent = T_(isLast ? (campaign.valid ? 'gs.pipe.replayAll' : 'gs.pipe.restartCampaign') : 'gs.pipe.next');
    replayBtn.textContent = T_('gs.pipe.replay');
    resetZoom();
    overlayEl.classList.remove('hidden');
    updateHud();
    writeSave();
  }

  function togglePause(force) {
    if (!board || won) return;
    paused = force != null ? !!force : !paused;
    pausedEl.textContent = T_('gs.pipe.paused');
    pausedEl.classList.toggle('hidden', !paused);
    pauseBtn.textContent = T_(paused ? 'gs.pipe.resume' : 'gs.pipe.pause');
    lastNow = performance.now();
    if (Arcade.audio) Arcade.audio.play('ui');
  }

  function goNext() {
    overlayEl.classList.add('hidden');
    if (isDaily()) { startDaily(); return; }
    if (levelIdx >= maxLevels() - 1) { startCampaign(packKey); return; }
    lastContrib = null;
    loadLevel(levelIdx + 1);
  }
  function replayCurrent() {
    overlayEl.classList.add('hidden');
    if (isDaily()) { startDaily(); return; }
    unrecordContribution();
    loadLevel(levelIdx);
  }

  nextBtn.addEventListener('click', function () { goNext(); if (Arcade.audio) Arcade.audio.play('ui'); });
  replayBtn.addEventListener('click', function () {
    if (dailyOverlay) {
      dailyOverlay = false;
      overlayEl.classList.add('hidden');
      startCampaign('classic');
    } else {
      replayCurrent();
    }
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  restartBtn.addEventListener('click', function () { replayCurrent(); if (Arcade.audio) Arcade.audio.play('ui'); });
  pauseBtn.addEventListener('click', function () { togglePause(); });

  // 包切换（经典 / 专家 / 每日）
  [['classic', 'gs.pipe.packClassic'], ['expert', 'gs.pipe.packExpert'], ['daily', 'gs.pipe.dailyPack']].forEach(function (it) {
    var b = document.createElement('button');
    b.className = 'pp-pack';
    b.setAttribute('data-pack', it[0]);
    b.textContent = T_(it[1]);
    b.addEventListener('click', function () {
      if (Arcade.audio) Arcade.audio.play('ui');
      if (it[0] === 'daily') startDaily();
      else startCampaign(it[0]);
    });
    packRow.appendChild(b);
  });

  // 关卡按钮（两本包共用 12 个按钮，按包切换高亮）
  for (var lb = 0; lb < 12; lb++) {
    (function (i) {
      var b = document.createElement('button');
      b.className = 'pp-lv';
      b.textContent = String(i + 1);
      b.title = T_('gs.pipe.levelN').replace('{n}', i + 1);
      b.addEventListener('click', function () {
        if (Arcade.audio) Arcade.audio.play('ui');
        if (isDaily()) return;
        if (i === levelIdx) { replayCurrent(); return; }
        if (i === 0) { startCampaign(packKey); return; }
        // 中途跳关：本轮作废，仍可练习
        campaign.valid = false;
        campaign.moves = 0;
        campaign.ms = 0;
        lastContrib = null;
        if (Arcade.ui) Arcade.ui.toast(T_('gs.pipe.voidMsg'), 'warn');
        msgEl.textContent = T_('gs.pipe.voidMsg');
        loadLevel(i);
      });
      levelRow.appendChild(b);
    })(lb);
  }

  /* ---------------- 存档（兼容旧档缺失字段） ---------------- */
  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'pipe',
      collect: function () {
        if (!board) return null;
        return {
          v: 3, mode: mode, pack: packKey, levelIdx: levelIdx, seed: seed, moves: moves, elapsed: elapsed,
          rots: board.cells.map(function (c) { return c.rot; }),
          campaign: { valid: !!campaign.valid, moves: campaign.moves, ms: campaign.ms },
          lastContrib: lastContrib, won: !!won
        };
      },
      apply: function (s) {
        if (!s || typeof s !== 'object') return false;
        var pk = s.pack === 'expert' ? 'expert' : (s.pack === 'daily' ? 'daily' : 'classic');
        mode = pk === 'daily' ? 'daily' : 'campaign';
        packKey = pk;
        var li = (typeof s.levelIdx === 'number' ? s.levelIdx : (typeof s.level === 'number' ? s.level : 0));
        if (!(li >= 0 && li < maxLevels())) li = 0;
        var L = confFor(li);
        var sd = (typeof s.seed === 'number' && isFinite(s.seed)) ? s.seed : (isDaily() ? dailySeed() : chooseSeed());
        var b = PipeGen.makeBoard(L.c, L.r, { level: L.d, sinks: L.s }, sd);
        var rots = Array.isArray(s.rots) ? s.rots : null;
        if (rots && rots.length !== b.cells.length) return false;
        var cp = s.campaign && typeof s.campaign === 'object' ? s.campaign : null;
        campaign = {
          valid: !!(cp && cp.valid), // 旧 v2 档没有战役字段 → 视为练习，避免误提交
          moves: Math.max(0, Number(cp && cp.moves) || 0),
          ms: Math.max(0, Number(cp && cp.ms) || 0)
        };
        var lc = s.lastContrib && typeof s.lastContrib === 'object' ? s.lastContrib : null;
        lastContrib = lc && Number(lc.level) === li ? { level: li, m: Math.max(0, Number(lc.m) || 0), ms: Math.max(0, Number(lc.ms) || 0) } : null;
        assignBoard(li, sd, rots, s.moves, s.elapsed);
        readDailyBest();
        if (s.won) {
          if (isDaily()) { startDaily(); return true; }
          if (li < maxLevels() - 1) { lastContrib = null; loadLevel(li + 1); }
          else { startCampaign(packKey); }
        }
        return true;
      }
    });
  }

  /* ---------------- 渲染 ---------------- */
  var COL = {
    metalA: '#243542', metalB: '#93aab8', metalHi: '#eef9ff',
    waterA: '#075c8c', waterB: '#5ce4ff', waterHi: '#dffcff',
    plate: '#0b1922', edge: '#1a3848', red: '#ff4658', green: '#7cf7c4'
  };

  function drawBackground(now) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#04121a');
    g.addColorStop(0.5, '#071b26');
    g.addColorStop(1, '#04121a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (!board) return;
    var step = layout.cell;
    ctx.save();
    ctx.strokeStyle = 'rgba(64,120,140,0.12)';
    ctx.lineWidth = 1;
    for (var x = layout.ox; x <= layout.ox + step * board.cols + 0.5; x += step) {
      ctx.beginPath(); ctx.moveTo(x, layout.oy); ctx.lineTo(x, layout.oy + step * board.rows); ctx.stroke();
    }
    for (var y = layout.oy; y <= layout.oy + step * board.rows + 0.5; y += step) {
      ctx.beginPath(); ctx.moveTo(layout.ox, y); ctx.lineTo(layout.ox + step * board.cols, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,190,205,0.14)';
    for (var rr = 0; rr <= board.rows; rr++) {
      for (var cc = 0; cc <= board.cols; cc++) {
        var px = layout.ox + cc * step, py = layout.oy + rr * step, t = 3;
        ctx.beginPath(); ctx.moveTo(px - t, py); ctx.lineTo(px + t, py); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py - t); ctx.lineTo(px, py + t); ctx.stroke();
      }
    }
    ctx.restore();
    var b = Math.max(2, step * 0.09);
    ctx.save();
    GK.roundRect(ctx, layout.ox - b, layout.oy - b, step * board.cols + b * 2, step * board.rows + b * 2, step * 0.2);
    var mg = ctx.createLinearGradient(0, layout.oy, 0, layout.oy + step * board.rows);
    mg.addColorStop(0, 'rgba(30,58,72,0.85)');
    mg.addColorStop(1, 'rgba(8,24,33,0.9)');
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.strokeStyle = won ? 'rgba(110,235,255,' + (0.55 + Math.sin(now / 190) * 0.3) + ')' : 'rgba(42,90,108,0.7)';
    ctx.lineWidth = b * 0.7;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlate(x, y, s, fixed) {
    var pad = s * 0.04;
    GK.roundRect(ctx, x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.12);
    var g = ctx.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, 'rgba(17,42,55,0.85)');
    g.addColorStop(1, 'rgba(6,20,28,0.85)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = fixed ? 'rgba(120,220,255,0.5)' : 'rgba(40,95,115,0.5)';
    ctx.lineWidth = fixed ? 1.4 : 1;
    ctx.stroke();
    if (fixed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120,220,255,0.5)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      GK.roundRect(ctx, x + pad + 2, y + pad + 2, s - pad * 2 - 4, s - pad * 2 - 4, s * 0.1);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      var lx = x + s - pad - 9, ly = y + pad + 5;
      ctx.strokeStyle = 'rgba(150,235,255,0.9)';
      ctx.fillStyle = 'rgba(150,235,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(lx + 3, ly + 2, 2.6, Math.PI, 0); ctx.stroke();
      GK.roundRect(ctx, lx, ly + 2, 6, 5, 1.4); ctx.fill();
      ctx.restore();
    }
  }

  function drawPipe(ang, s, pressured) {
    var dx = PipeGen.DIR[ang][0], dy = PipeGen.DIR[ang][1];
    var ex = dx * s * 0.5, ey = dy * s * 0.5;
    var inner = s * 0.105;
    var w = s * 0.24;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = pressured ? 'rgba(80,225,255,0.55)' : 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = pressured ? s * 0.2 : s * 0.05;
    var mg = ctx.createLinearGradient(-dy * w * 0.5, dx * w * 0.5, dy * w * 0.5, -dx * w * 0.5);
    mg.addColorStop(0, COL.metalA);
    mg.addColorStop(0.35, COL.metalB);
    mg.addColorStop(0.55, COL.metalHi);
    mg.addColorStop(0.75, COL.metalB);
    mg.addColorStop(1, COL.metalA);
    ctx.strokeStyle = mg;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(dx * inner, dy * inner); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.shadowBlur = 0;
    var cg = ctx.createLinearGradient(-dy * w * 0.25, dx * w * 0.25, dy * w * 0.25, -dx * w * 0.25);
    if (pressured) {
      cg.addColorStop(0, COL.waterA);
      cg.addColorStop(0.45, COL.waterB);
      cg.addColorStop(1, COL.waterHi);
    } else {
      cg.addColorStop(0, 'rgba(3,14,20,0.95)');
      cg.addColorStop(1, 'rgba(10,28,38,0.95)');
    }
    ctx.strokeStyle = cg;
    ctx.lineWidth = w * 0.43;
    ctx.beginPath(); ctx.moveTo(dx * (inner + s * 0.03), dy * (inner + s * 0.03)); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = w * 0.09;
    ctx.beginPath(); ctx.moveTo(dx * inner + dy * w * 0.2, dy * inner - dx * w * 0.2); ctx.lineTo(ex + dy * w * 0.2, ey - dx * w * 0.2); ctx.stroke();
    ctx.restore();
  }

  function drawValve(s, on) {
    ctx.save();
    ctx.shadowColor = on ? 'rgba(90,230,255,0.8)' : 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = on ? s * 0.28 : s * 0.08;
    var rg = ctx.createRadialGradient(-s * 0.05, -s * 0.05, 1, 0, 0, s * 0.2);
    rg.addColorStop(0, '#eef9ff');
    rg.addColorStop(0.5, '#8fa8b8');
    rg.addColorStop(1, '#263744');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = on ? 'rgba(180,250,255,0.9)' : 'rgba(160,190,205,0.5)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = on ? '#bff8ff' : '#c6d6df';
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.moveTo(-s * 0.14, 0); ctx.lineTo(s * 0.14, 0);
    ctx.moveTo(0, -s * 0.14); ctx.lineTo(0, s * 0.14);
    ctx.stroke();
    ctx.fillStyle = on ? '#54e6ff' : '#6f8797';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawDrain(s, on, now) {
    ctx.save();
    ctx.shadowColor = on ? 'rgba(80,230,255,0.75)' : 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = on ? s * 0.25 : s * 0.06;
    var rg = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 0.2);
    rg.addColorStop(0, on ? '#c9fbff' : '#274252');
    rg.addColorStop(0.55, '#7c96a6');
    rg.addColorStop(1, '#1a2c38');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = on ? '#8ff5ff' : 'rgba(140,170,185,0.5)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = on ? '#033a50' : '#0a1c26';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = on ? 'rgba(170,250,255,0.9)' : 'rgba(110,140,155,0.6)';
    ctx.lineWidth = Math.max(1, s * 0.018);
    for (var k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * s * 0.045, -s * 0.075);
      ctx.lineTo(k * s * 0.045, s * 0.075);
      ctx.stroke();
    }
    if (on) {
      ctx.globalAlpha = 0.5 + Math.sin(now / 190) * 0.25;
      ctx.strokeStyle = '#8ff5ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.24 + Math.sin(now / 260) * s * 0.03, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCells(now) {
    for (var i = 0; i < board.cells.length; i++) {
      var cell = board.cells[i];
      var r = Math.floor(i / board.cols), c = i % board.cols;
      var s = layout.cell;
      var x = layout.ox + c * s, y = layout.oy + r * s;
      var cx = x + s / 2, cy = y + s / 2;
      var pressured = !!power.seen[i];
      drawPlate(x, y, s, cell.fixed);
      if (cell.openCount === 0) continue;
      var offset = 0;
      var at = animStart[i];
      if (at) {
        var p = Math.min(1, (now - at) / 150);
        if (p >= 1) animStart[i] = 0;
        else offset = -(1 - GK.easeOutCubic(p)) * Math.PI / 2;
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(offset);
      var mask = PipeGen.rotMask(cell.type, cell.rot);
      for (var d = 0; d < 4; d++) if (mask[d]) drawPipe(d, s, pressured);
      ctx.save();
      ctx.shadowColor = pressured ? 'rgba(80,230,255,0.7)' : 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = pressured ? s * 0.2 : s * 0.06;
      var jg = ctx.createRadialGradient(-s * 0.03, -s * 0.03, 1, 0, 0, s * 0.11);
      jg.addColorStop(0, COL.metalHi);
      jg.addColorStop(0.5, COL.metalB);
      jg.addColorStop(1, COL.metalA);
      ctx.fillStyle = jg;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pressured ? '#b9fbff' : '#122a36';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.035, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      var isSrc = board.sources.indexOf(i) >= 0;
      var isSink = board.sinks.indexOf(i) >= 0;
      if (isSrc) drawValve(s, pressured);
      else if (isSink) drawDrain(s, pressured, now);
      ctx.restore();
    }
  }

  function drawFlow(now) {
    for (var i = 0; i < board.cells.length; i++) {
      if (!power.seen[i] || !power.parents || power.parents[i] < 0) continue;
      var from = cellPos(power.parents[i]);
      var to = cellPos(i);
      var s = layout.cell;
      var phase = ((now / 560) + i * 0.16) % 1;
      for (var k = 0; k < 2; k++) {
        var t = (phase + k * 0.5) % 1;
        var px = from.x + (to.x - from.x) * t;
        var py = from.y + (to.y - from.y) * t;
        ctx.save();
        ctx.globalAlpha = 0.45 + Math.sin(t * Math.PI) * 0.5;
        ctx.shadowColor = 'rgba(90,240,255,0.95)';
        ctx.shadowBlur = s * 0.25;
        ctx.fillStyle = '#c8fbff';
        ctx.beginPath(); ctx.ellipse(px, py, s * 0.028, s * 0.045, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(px - (to.x - from.x) * 0.03, py - (to.y - from.y) * 0.03, s * 0.022, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawRipples(now) {
    var s = layout.cell;
    for (var si = 0; si < board.sinks.length; si++) {
      if (!won && !power.seen[board.sinks[si]]) continue;
      var p0 = cellPos(board.sinks[si]);
      var base = won ? (winAnim / 900) : (now / 1400) % 1;
      var rings = won ? 3 : 2;
      for (var k = 0; k < rings; k++) {
        var t = (base + k / rings) % 1;
        var rad = s * 0.22 + t * s * 0.62;
        ctx.save();
        ctx.globalAlpha = (1 - t) * (won ? 0.85 : 0.35);
        ctx.strokeStyle = '#9ff8ff';
        ctx.lineWidth = 1.6 + (1 - t) * 2;
        ctx.beginPath(); ctx.arc(p0.x, p0.y, rad, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawCursor(now) {
    if (won) return;
    var s = layout.cell;
    var x = layout.ox + cursor.c * s, y = layout.oy + cursor.r * s;
    ctx.save();
    ctx.strokeStyle = 'rgba(124,247,196,' + (0.6 + Math.sin(now / 260) * 0.25) + ')';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(80,255,200,0.8)';
    ctx.shadowBlur = 8;
    ctx.setLineDash([5, 4]);
    GK.roundRect(ctx, x + s * 0.03, y + s * 0.03, s * 0.94, s * 0.94, s * 0.14);
    ctx.stroke();
    ctx.restore();
  }

  function drawPress(now) {
    if (!pressCell) return;
    var s = layout.cell;
    var x = layout.ox + pressCell.c * s, y = layout.oy + pressCell.r * s;
    var p = Math.min(1, (now - pressAt) / 170);
    var k = GK.easeOutCubic(p);
    var inset = s * (0.16 - 0.13 * k);
    ctx.save();
    ctx.strokeStyle = pressCanceled ? 'rgba(255,70,88,0.8)' : 'rgba(143,245,255,' + (0.5 + 0.35 * k) + ')';
    ctx.fillStyle = pressCanceled ? 'rgba(255,70,88,0.10)' : 'rgba(120,240,255,' + (0.08 + 0.14 * k) + ')';
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.shadowColor = pressCanceled ? 'rgba(255,70,88,0.7)' : 'rgba(120,240,255,0.8)';
    ctx.shadowBlur = s * 0.2;
    GK.roundRect(ctx, x + inset, y + inset, s - inset * 2, s - inset * 2, s * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawWin(now) {
    if (!won) return;
    var pulse = 0.45 + Math.sin(now / 210) * 0.25;
    ctx.save();
    ctx.strokeStyle = 'rgba(120,240,255,' + pulse + ')';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(100,235,255,0.9)';
    ctx.shadowBlur = 18;
    GK.roundRect(ctx, layout.ox - 4, layout.oy - 4, layout.cell * board.cols + 8, layout.cell * board.rows + 8, layout.cell * 0.18);
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
    drawRipples(now);
    drawPress(now);
    drawCursor(now);
    drawWin(now);
    if (flashT > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,60,80,' + (flashT * 0.15) + ')';
      GK.roundRect(ctx, layout.ox, layout.oy, layout.cell * board.cols, layout.cell * board.rows, layout.cell * 0.14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,80,100,' + flashT + ')';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- 输入：一次手势最多旋转一格 ---------------- */
  function cellFromEvent(e) {
    if (!board) return null;
    var p = GK.pointer(canvas, e);
    var c = Math.floor((p.x - layout.ox) / layout.cell);
    var r = Math.floor((p.y - layout.oy) / layout.cell);
    if (c < 0 || r < 0 || c >= board.cols || r >= board.rows) return null;
    return { r: r, c: c };
  }
  function sameCell(a, b) { return a && b && a.r === b.r && a.c === b.c; }

  var pressStartX = 0, pressStartY = 0;
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    if (pinchState || (e.pointerType === 'touch' && performance.now() < suppressTapUntil)) return;
    // 触屏阻止兼容鼠标事件；鼠标保留原生 dblclick（任意位置双击复位）
    if (e.pointerType === 'touch' && e.cancelable) e.preventDefault();
    if (!board || paused || won) return;
    var cc = cellFromEvent(e);
    if (!cc) return;
    pressCell = cc;
    lastPress = { r: cc.r, c: cc.c };
    pressCanceled = false;
    pressAt = performance.now();
    pressStartX = e.clientX;
    pressStartY = e.clientY;
    cursor = cc;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pressCell) return;
    var dx = e.clientX - pressStartX, dy = e.clientY - pressStartY;
    if (Math.abs(dx) + Math.abs(dy) > 6) pressCanceled = true;
    var cc = cellFromEvent(e);
    if (!cc || !sameCell(cc, pressCell)) {
      // 跨格拖动：取消本次旋转（一次手势最多一格）
      pressCanceled = true;
    }
  });
  function endPress(e) {
    if (!pressCell) return;
    var start = pressCell;
    var cc = e ? cellFromEvent(e) : null;
    pressCell = null;
    if (!pressCanceled && cc && sameCell(cc, start)) {
      var ci = idxOf(start.r, start.c);
      var target = board ? board.cells[ci] : null;
      rotateAt(start.r, start.c);
      if (e && target && !target.fixed && target.type !== 'X' && target.openCount > 0) {
        noteTapPoint(e, start.r, start.c);
      }
    }
    pressCanceled = false;
  }
  canvas.addEventListener('pointerup', endPress);
  canvas.addEventListener('pointercancel', function () { pressCell = null; pressCanceled = false; });
  canvas.addEventListener('pointerleave', function () {
    if (pressCell) { pressCell = null; pressCanceled = false; }
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function moveCursor(dr, dc) {
    if (!board || paused || won) return;
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

  /* ---------------- 循环与启动 ---------------- */
  var lastSec = -1;
  var lastMovesShown = 0;
  function update() {
    var now = performance.now();
    var dt = lastNow ? now - lastNow : 16;
    if (dt > 80) dt = 80;
    lastNow = now;
    if (!paused && !won) elapsed += dt;
    if (won) winAnim = Math.min(winAnim + dt, 1400);
    if (flashT > 0) flashT = Math.max(0, flashT - dt / 450);
    var sec = timeSec();
    if (sec !== lastSec) {
      lastSec = sec;
      updateHud();
      if (!won) bump(timeEl);
    }
    if (moves !== lastMovesShown) { lastMovesShown = moves; updateHud(); }
  }

  readDailyBest();
  if (window.Arcade && Arcade.savegame) {
    if (!Arcade.savegame.resume()) startCampaign('classic');
  } else {
    startCampaign('classic');
  }

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T_('gs.pipe.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    overlayEl.classList.add('hidden');
    if (isDaily()) startDaily();
    else startCampaign(packKey);
  };

  Arcade.loop.start(update, render, 16);

  /* ---------------- QA 钩子（仅 ?qa=1 生效） ---------------- */
  if (/[?&]qa=1(?:&|$)/.test(location.search)) {
    function solveInternal() {
      if (!board || won) return false;
      for (var i = 0; i < board.cells.length; i++) {
        if (board.cells[i].fixed) continue;
        var old = board.cells[i].rot;
        moves += PipeGen.turnsTo(board.cells[i].type, old, board.solutionRot[i]);
        board.cells[i].rot = board.solutionRot[i];
      }
      if (moves === 0) moves = Math.max(1, board.minMoves || 1);
      recalc();
      updateHud();
      if (power.ok) { completeLevel(); return true; }
      return false;
    }
    window.__QA = {
      state: function () {
        return {
          mode: mode, pack: packKey, levelIdx: levelIdx, moves: moves, elapsed: elapsed,
          campaign: { valid: campaign.valid, moves: campaign.moves, ms: campaign.ms },
          dailyBest: dailyBest
        };
      },
      boardInfo: function () {
        return {
          cols: board.cols, rows: board.rows, sinks: board.sinks.length, sources: board.sources.length,
          cells: board.cells.length, minMoves: board.minMoves, solved: power.ok
        };
      },
      cellCenter: function (r, c) {
        return { x: (layout.ox + (c + 0.5) * layout.cell) / W, y: (layout.oy + (r + 0.5) * layout.cell) / H };
      },
      cursor: function () { return { r: cursor.r, c: cursor.c }; },
      setCursor: function (r, c) { cursor.r = r; cursor.c = c; },
      cellRot: function (r, c) { return board.cells[r * board.cols + c].rot; },
      cellFixed: function (r, c) { return !!board.cells[r * board.cols + c].fixed; },
      cellInfo: function (r, c) {
        var cell = board.cells[r * board.cols + c];
        return { rot: cell.rot, fixed: !!cell.fixed, type: cell.type, openCount: cell.openCount };
      },
      lastPressed: function () { return lastPress; },
      zoom: function (v) { setZoom(v); return zoomInfo(); },
      zoomInfo: zoomInfo,
      resetZoom: function () { resetZoom(); return zoomInfo(); },
      loadLevel: function (li) {
        if (isDaily()) return false;
        campaign.valid = false;
        campaign.moves = 0;
        campaign.ms = 0;
        lastContrib = null;
        loadLevel(Math.max(0, Math.min(maxLevels() - 1, Number(li) || 0)));
        return true;
      },
      solveCurrent: function () { return solveInternal(); },
      startDaily: function () { startDaily(); },
      startCampaign: function (pk) { startCampaign(pk || 'classic'); },
      runCampaign: function (pk) {
        startCampaign(pk || 'classic');
        var out = [];
        for (var i = 0; i < 12; i++) {
          solveInternal();
          out.push({ level: levelIdx, moves: moves });
          if (i < 11) { lastContrib = null; loadLevel(i + 1); }
        }
        var best = Arcade.storage ? Arcade.storage.getBest(GAME_ID) : null;
        return { campaign: campaign, best: best, levels: out };
      },
      dailyStatus: function () {
        return {
          solved: Arcade.daily ? Arcade.daily.solvedTime(GAME_ID) : null,
          streak: Arcade.daily ? Arcade.daily.streak() : 0,
          best: dailyBest
        };
      }
    };
  }
})();
