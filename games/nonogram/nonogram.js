/* ============================================================
   数织 Nonogram —— 旗舰版
   5 / 8 / 10 / 12 / 15 · 唯一解题库 + 求解器提示 + 每日挑战
   严格逐格判定胜利 · 叉标 · 键盘 · 断点续玩 · 结算闭环
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.nonogram.tut1t'), d: T('gs.nonogram.tut1') },
  { t: T('gs.nonogram.tut2t'), d: T('gs.nonogram.tut2') },
  { t: T('gs.nonogram.tut3t'), d: T('gs.nonogram.tut3') },
  { t: T('gs.nonogram.tut4t'), d: T('gs.nonogram.tut4') }
];

(function () {
  'use strict';
  var root = document.getElementById('game-root');
  if (!root) return;
  var NG = window.NGCore;

  var SIZE_OPTIONS = [5, 8, 10, 12, 15];
  var DIFF_NAMES = { 5: 'lv5', 8: 'lv8', 10: 'lv10', 12: 'lv12', 15: 'lv15' };
  var QA = /[?&]qa=1(?:[&#]|$)/.test(location.search);

  var S = 5, target = [], state = [], puzzle = null;
  var startTs = Date.now(), over = false, mistakes = 0, hintsLeft = 3;
  var cursor = { r: 0, c: 0 }, markMode = false;
  var mode = 'normal'; /* normal | daily */

  var wrap = document.createElement('div');
  wrap.className = 'no-wrap';
  wrap.innerHTML =
    '<div class="no-diff" id="no-diff"></div>' +
    '<div class="no-daily-row">' +
    '  <button class="btn no-daily-btn" id="no-daily">' + T('gs.nonogram.dailyBtn') + '</button>' +
    '  <span class="no-daily-info" id="no-daily-info"></span>' +
    '</div>' +
    '<div class="no-view" id="no-view">' +
    '  <div class="no-stage" id="no-stage">' +
    '    <div class="no-grid" id="no-grid"></div>' +
    '    <div class="no-overlay" id="no-overlay">' +
    '      <div class="no-ov-title" id="no-ov-title"></div>' +
    '      <div class="no-ov-stats" id="no-ov-stats"></div>' +
    '      <div class="no-ov-btns" id="no-ov-btns"></div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="no-zoom" id="no-zoom" role="group" aria-label="' + T('gs.nonogram.zoomLbl') + '">' +
    '  <button type="button" class="no-zbtn" id="no-zout" aria-label="' + T('gs.nonogram.zoomOut') + '">−</button>' +
    '  <button type="button" class="no-zbtn no-zlbl" id="no-zlbl" aria-label="' + T('gs.nonogram.zoomTip') + '">' +
    '    <b id="no-zval">1×</b><span id="no-zpx"></span></button>' +
    '  <button type="button" class="no-zbtn" id="no-zin" aria-label="' + T('gs.nonogram.zoomIn') + '">+</button>' +
    '  <button type="button" class="no-zbtn no-zreset" id="no-zreset" aria-label="' + T('gs.nonogram.zoomReset') + '">' + T('gs.nonogram.zoomReset') + '</button>' +
    '</div>' +
    '<div class="no-head">' +
    '  <div class="no-stat"><span>' + T('gs.nonogram.hudTime') + '</span><b id="no-time">00:00</b></div>' +
    '  <div class="no-stat"><span>' + T('gs.nonogram.hudPic') + '</span><b id="no-pic">—</b></div>' +
    '  <div class="no-stat"><span>' + T('gs.nonogram.hudHint') + '</span><b id="no-hint">3</b></div>' +
    '  <div class="no-stat"><span>' + T('gs.nonogram.hudMiss') + '</span><b id="no-miss">0</b></div>' +
    '</div>' +
    '<div class="no-msg" id="no-msg">' + T('gs.nonogram.hintLine') + '</div>' +
    '<div class="no-actions">' +
    '  <button class="btn" id="no-mark">' + T('gs.nonogram.markBtn') + '</button>' +
    '  <button class="btn" id="no-hint-btn">' + T('gs.nonogram.hintBtn') + '</button>' +
    '  <button class="btn" id="no-check">' + T('gs.nonogram.checkBtn') + '</button>' +
    '  <button class="btn purple" id="no-restart">' + T('gs.nonogram.restartBtn') + '</button>' +
    '</div>';
  root.appendChild(wrap);

  var diffRow = wrap.querySelector('#no-diff');
  var adaptiveRow = wrap.querySelector('.no-daily-row');
  var dailyBtn = wrap.querySelector('#no-daily');
  var dailyInfo = wrap.querySelector('#no-daily-info');
  var viewEl = wrap.querySelector('#no-view');
  var gridEl = wrap.querySelector('#no-grid');
  var stageEl = wrap.querySelector('#no-stage');
  var zOut = wrap.querySelector('#no-zout'), zIn = wrap.querySelector('#no-zin');
  var zLbl = wrap.querySelector('#no-zlbl'), zVal = wrap.querySelector('#no-zval');
  var zPx = wrap.querySelector('#no-zpx'), zReset = wrap.querySelector('#no-zreset');
  var zoom = 1;
  var timeEl = wrap.querySelector('#no-time'), picEl = wrap.querySelector('#no-pic');
  var hintEl = wrap.querySelector('#no-hint'), missEl = wrap.querySelector('#no-miss');
  var msgEl = wrap.querySelector('#no-msg');
  var overlay = wrap.querySelector('#no-overlay'), ovTitle = wrap.querySelector('#no-ov-title');
  var ovStats = wrap.querySelector('#no-ov-stats'), ovBtns = wrap.querySelector('#no-ov-btns');
  var markBtn = wrap.querySelector('#no-mark'), hintBtn = wrap.querySelector('#no-hint-btn');

  SIZE_OPTIONS.forEach(function (n) {
    var b = document.createElement('button');
    b.className = 'btn mode-btn' + (n === 5 ? ' selected' : '');
    b.setAttribute('data-n', n);
    b.textContent = T('gs.nonogram.' + DIFF_NAMES[n]);
    b.addEventListener('click', function () {
      startPuzzle(n, NG.nextPuzzle(n, puzzle ? puzzle.id : null), 'normal');
      if (Arcade.audio) Arcade.audio.play('ui');
    });
    diffRow.appendChild(b);
  });

  /* ---------------- 数据 ---------------- */
  function gridFrom(p) { return p.grid.map(function (row) { return row.slice(); }); }
  function blankState(n) { return NG.blank(n, 0); }
  function currentClueR() { return puzzle ? puzzle.clueR : NG.rowsOf(target); }
  function currentClueC() { return puzzle ? puzzle.clueC : NG.colsOf(target); }

  function dailyStatus() {
    if (!window.Arcade || !Arcade.daily) return { solved: false, sec: null, streak: 0 };
    return {
      solved: Arcade.daily.isSolved('nonogram'),
      sec: Arcade.daily.solvedTime('nonogram'),
      streak: Arcade.daily.streak()
    };
  }
  function refreshDailyInfo() {
    var d = dailyStatus();
    if (d.solved) {
      dailyInfo.textContent = T('gs.nonogram.dailyInfoSolved')
        .replace('{t}', fmt(Number(d.sec) || 0))
        .replace('{n}', String(d.streak));
      dailyBtn.classList.add('done');
    } else {
      dailyInfo.textContent = T('gs.nonogram.dailyInfo')
        .replace('{n}', String(d.streak));
      dailyBtn.classList.remove('done');
    }
  }

  /* ---------------- 渲染 ---------------- */
  var cells = [], rowHintEls = [], colHintEls = [];

  function hintFont(n) { return n >= 12 ? 8 : (n >= 10 ? 9 : 10); }

  function buildBoard() {
    gridEl.style.setProperty('--n', S);
    gridEl.style.setProperty('--hc', S >= 12 ? '23px' : (S >= 10 ? '28px' : '32px'));
    gridEl.classList.toggle('big', S >= 12);
    gridEl.innerHTML = '';
    cells = []; rowHintEls = []; colHintEls = [];
    var fs = hintFont(S);
    var corner = document.createElement('div');
    corner.className = 'no-unit no-corner';
    corner.textContent = '';
    gridEl.appendChild(corner);

    for (var c = 0; c < S; c++) {
      var colClue = puzzle ? puzzle.clueC[c] : NG.colsOf(target)[c];
      var cu = document.createElement('div');
      cu.className = 'no-unit no-hint no-colhint';
      cu.style.fontSize = fs + 'px';
      colClue.forEach(function (v) { var s = document.createElement('span'); s.textContent = v; cu.appendChild(s); });
      gridEl.appendChild(cu);
      colHintEls.push({ el: cu, clue: colClue });
    }

    for (var r = 0; r < S; r++) {
      var rowClue = puzzle ? puzzle.clueR[r] : NG.rowsOf(target)[r];
      var ru = document.createElement('div');
      ru.className = 'no-unit no-hint no-rowhint';
      ru.style.fontSize = fs + 'px';
      rowClue.forEach(function (v) { var s = document.createElement('span'); s.textContent = v; ru.appendChild(s); });
      gridEl.appendChild(ru);
      rowHintEls.push({ el: ru, clue: rowClue });
      cells[r] = [];
      for (var c2 = 0; c2 < S; c2++) {
        (function (rr, cc) {
          var u = document.createElement('button');
          u.type = 'button';
          u.className = 'no-cell';
          u.setAttribute('data-r', rr);
          u.setAttribute('data-c', cc);
          u.setAttribute('aria-label', T('gs.nonogram.cellLabel')
            .replace('{r}', String(rr + 1)).replace('{c}', String(cc + 1)));
          u.addEventListener('click', function () { toggle(rr, cc, false); });
          u.addEventListener('contextmenu', function (e) { e.preventDefault(); toggle(rr, cc, true); });
          gridEl.appendChild(u);
          cells[rr][cc] = u;
        })(r, c2);
      }
    }
    paintAll();
    updateHints();
  }

  function ripple(r, c) {
    var el = cells[r] && cells[r][c];
    if (!el) return;
    el.classList.remove('ripple');
    void el.offsetWidth;
    el.classList.add('ripple');
    setTimeout(function () { el.classList.remove('ripple'); }, 520);
  }

  function paintAll() {
    for (var r = 0; r < S; r++) {
      for (var c = 0; c < S; c++) {
        var el = cells[r][c];
        if (!el) continue;
        el.classList.toggle('filled', state[r][c] === 1);
        el.classList.toggle('crossed', state[r][c] === 2);
        el.classList.toggle('cursor', r === cursor.r && c === cursor.c && !over);
      }
    }
  }

  function lineMatches(line, targetLine) {
    for (var i = 0; i < line.length; i++) {
      if ((line[i] === 1) !== (targetLine[i] === 1)) return false;
    }
    return true;
  }

  /* 线索完成高亮只基于实际格与目标格，避免“线索字符串相同但位置不同”的误导 */
  function updateHints() {
    for (var r = 0; r < S; r++) {
      var ok = true;
      for (var c = 0; c < S; c++) if ((state[r][c] === 1) !== (target[r][c] === 1)) { ok = false; break; }
      rowHintEls[r].el.classList.toggle('done', ok);
    }
    for (var c2 = 0; c2 < S; c2++) {
      var ok2 = true;
      for (var r2 = 0; r2 < S; r2++) if ((state[r2][c2] === 1) !== (target[r2][c2] === 1)) { ok2 = false; break; }
      colHintEls[c2].el.classList.toggle('done', ok2);
    }
  }

  /* ---------------- 棋盘视口缩放（真实布局宽度） ---------------- */
  function cellPx() {
    var el = cells[0] && cells[0][0];
    if (!el) return 0;
    var b = el.getBoundingClientRect();
    return Math.min(b.width, b.height);
  }

  function fmtZoom(z) {
    var v = Math.round(z * 100) / 100;
    return String(v) + '×';
  }

  /** 按当前屏宽自动算出「单格 ≥44px」的最小缩放（0.05 步进，上限 3×）
      stage 宽度线性放大、线索栏固定，故用 stageW1 / 固定占位反解 */
  function fitZoom() {
    var cur = cellPx();
    var st = stageEl.getBoundingClientRect().width;
    if (!cur || !st || !zoom) return 1;
    var fixed = st - S * cur;                /* 线索栏 + 间隙，随缩放不变 */
    var stageW1 = st / zoom;
    var need = (44 * S + fixed) / stageW1;
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
    var oldW = stageEl.getBoundingClientRect().width;
    zoom = nz;
    stageEl.style.setProperty('--no-zoom', String(nz));
    var newW = stageEl.getBoundingClientRect().width;
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
    /* 触屏双击只在非格子/按钮区域复位，避免吞掉「同一格快速两次点击」 */
    if (t.target && t.target.closest && t.target.closest('.no-cell, button')) return;
    var now = Date.now();
    if (lastTap && now - lastTap.at < 320 &&
        Math.abs(t.clientX - lastTap.x) < 28 && Math.abs(t.clientY - lastTap.y) < 28) {
      resetZoom();
      lastTap = null;
    } else {
      lastTap = { at: now, x: t.clientX, y: t.clientY };
    }
  }, { passive: true });

  // 鼠标双击复位：抢在格子 click 之前识别，缩放态下双击即复位
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

  /* 鼠标/触控笔拖拽平移；位移后吞掉随后的 click */
  var panDrag = null, suppressClick = false, suppressTimer = null;
  viewEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0 || zoom <= 1) return;
    if (e.target && e.target.closest && e.target.closest('.no-overlay')) return;
    panDrag = { x: e.clientX, y: e.clientY, sl: viewEl.scrollLeft, st: viewEl.scrollTop, moved: false };
  });
  viewEl.addEventListener('pointermove', function (e) {
    if (!panDrag) return;
    var dx = e.clientX - panDrag.x, dy = e.clientY - panDrag.y;
    if (!panDrag.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    panDrag.moved = true;
    e.preventDefault();
    viewEl.scrollLeft = panDrag.sl - dx;
    viewEl.scrollTop = panDrag.st - dy;
  });
  viewEl.addEventListener('pointerup', function () {
    if (panDrag && panDrag.moved) {
      suppressClick = true;
      if (suppressTimer) clearTimeout(suppressTimer);
      suppressTimer = setTimeout(function () { suppressClick = false; }, 320);
    }
    panDrag = null;
  });
  viewEl.addEventListener('pointercancel', function () { panDrag = null; });
  viewEl.addEventListener('click', function (e) {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  /* ---------------- 交互 ---------------- */
  function toggle(r, c, forceMark) {
    if (over || !cells[r] || !cells[r][c]) return;
    cursor.r = r; cursor.c = c;
    var useMark = forceMark || markMode;
    var next = useMark ? (state[r][c] === 2 ? 0 : 2) : (state[r][c] === 1 ? 0 : 1);
    state[r][c] = next;
    var el = cells[r][c];
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    ripple(r, c);
    if (Arcade.audio) Arcade.audio.play(next === 1 ? 'drop' : 'ui');
    paintAll();
    updateHints();
    checkWin();
    save();
  }

  /* 唯一判定：与 target 逐格严格相等 */
  function checkWin() {
    if (over) return false;
    if (!NG.strictMatch(state, target)) return false;
    win();
    return true;
  }

  /* ---------------- 结算 ---------------- */
  function win() {
    if (over) return;
    over = true;
    var sec = elapsedSec();
    var hintsUsed = 3 - hintsLeft;
    var score = sec + (S - 5) * 20 + mistakes * 15 + hintsUsed * 25;
    if (Arcade.audio) Arcade.audio.play('win');
    if (Arcade.juice) Arcade.juice.win();
    if (Arcade.fx) {
      Arcade.fx.shake(stageEl);
      Arcade.fx.centerBurst('#00f0ff', 30);
      Arcade.fx.flash('rgba(0,240,255,0.16)');
    }
    if (Arcade.shell) Arcade.shell.submitScore(score);
    storeBest(S, score);
    if (Arcade.savegame) Arcade.savegame.clear();
    if (mode === 'daily') {
      var d = dailyStatus();
      if (!d.solved) {
        Arcade.daily.markSolved('nonogram', sec);
        if (Arcade.ui) Arcade.ui.toast(T('gs.nonogram.dailySolvedToast'), 'win');
      }
      refreshDailyInfo();
    }
    picEl.textContent = T(puzzle ? puzzle.name : 'gs.nonogram.picRandom');
    ovTitle.textContent = mode === 'daily' ? T('gs.nonogram.dailyWinTitle') : T('gs.nonogram.winTitle');
    ovStats.innerHTML =
      '<div class="no-pic-name">「' + T(puzzle ? puzzle.name : 'gs.nonogram.picRandom') + '」 · ' +
      S + '×' + S + '</div>' +
      '<div>' + T('gs.nonogram.resTime') + ' <b>' + fmt(sec) + '</b></div>' +
      '<div>' + T('gs.nonogram.resMiss') + ' <b>' + mistakes + '</b></div>' +
      '<div>' + T('gs.nonogram.resHint') + ' <b>' + hintsUsed + '</b></div>' +
      '<div>' + T('gs.nonogram.resScore') + ' <b>' + score + '</b></div>' +
      '<div class="no-best">' + T('gs.nonogram.bestFmt').replace('{n}', loadBest(S)) + '</div>';
    resetZoom();
    overlay.classList.add('show');
    renderOvBtns();
    updateHints();
    refreshDailyInfo();
  }

    function bestKey(n) { return 'arcade.nonogram.best.' + n; }
  function storeBest(n, sc) {
    try {
      if (!(sc > 0)) return;
      var old = parseInt(localStorage.getItem(bestKey(n)) || '0', 10);
      if (!old || sc < old) localStorage.setItem(bestKey(n), sc);
    } catch (e) {}
  }
  function loadBest(n) {
    try { return parseInt(localStorage.getItem(bestKey(n)) || '0', 10) || 0; } catch (e) { return 0; }
  }

  function renderOvBtns() {
    ovBtns.innerHTML = '';
    addOvBtn('btn green', T('gs.nonogram.nextPuzzle'), function () {
      startPuzzle(S, NG.nextPuzzle(S, puzzle ? puzzle.id : null), 'normal');
    });
    addOvBtn('btn', T('gs.nonogram.changeDiff'), function () {
      var idx = SIZE_OPTIONS.indexOf(S);
      var ns = SIZE_OPTIONS[(idx + 1) % SIZE_OPTIONS.length];
      startPuzzle(ns, NG.nextPuzzle(ns, null), 'normal');
    });
    addOvBtn('btn purple', T('gs.nonogram.dailyBtn'), function () {
      startDaily();
    });
  }
  function addOvBtn(cls, label, fn) {
    var b = document.createElement('button');
    b.className = cls; b.textContent = label;
    b.addEventListener('click', function () {
      if (Arcade.audio) Arcade.audio.play('ui');
      fn();
    });
    ovBtns.appendChild(b);
  }

  /* ---------------- 计时 ---------------- */
  function elapsedSec() { return Math.max(0, Math.round((Date.now() - startTs) / 1000)); }
  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
  }

  setInterval(function () {
    if (over) return;
    var s = elapsedSec();
    timeEl.textContent = fmt(s);
    if (s % 10 === 0) save();
  }, 500);

  /* ---------------- 生命周期 ---------------- */
  function selectSizeUI() {
    for (var k = 0; k < SIZE_OPTIONS.length; k++) {
      var b = diffRow.querySelector('[data-n="' + SIZE_OPTIONS[k] + '"]');
      if (b) b.classList.toggle('selected', SIZE_OPTIONS[k] === S && mode !== 'daily');
    }
    dailyBtn.classList.toggle('selected', mode === 'daily');
  }

  function startPuzzle(size, pz, m) {
    if (!pz) pz = NG.bySeed(1);
    mode = m || 'normal';
    puzzle = pz;
    S = pz.size || size;
    target = gridFrom(pz);
    state = blankState(S);
    startTs = Date.now();
    over = false; mistakes = 0; hintsLeft = 3;
    cursor = { r: 0, c: 0 };
    markMode = false;
    markBtn.classList.remove('on');
    markBtn.textContent = T('gs.nonogram.markBtn');
    overlay.classList.remove('show');
    msgEl.textContent = T('gs.nonogram.hintLine');
    msgEl.style.color = '';
    picEl.textContent = '???';
    hintEl.textContent = '3';
    missEl.textContent = '0';
    timeEl.textContent = '00:00';
    selectSizeUI();
    refreshDailyInfo();
    buildBoard();
    resetZoom();
    if (Arcade.savegame) { Arcade.savegame.clear(); save(); }
  }

  function startDaily() {
    var pz = NG.dailyPuzzle();
    startPuzzle(pz.size, pz, 'daily');
    if (Arcade.audio) Arcade.audio.play('daily');
    dailyStatusToast();
  }
  function dailyStatusToast() {
    var d = dailyStatus();
    if (Arcade.ui) {
      Arcade.ui.toast(d.solved ? T('gs.nonogram.dailyAlready') : T('gs.nonogram.dailyStart'), 'info');
    }
  }

  function save() { if (Arcade.savegame) Arcade.savegame.write(); }

  if (Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'nonogram',
      collect: function () {
        if (over) return null;
        return {
          v: 2,
          size: S, target: target, state: state,
          puzzleId: puzzle ? puzzle.id : null,
          picName: puzzle ? puzzle.name : 'gs.nonogram.picRandom',
          mode: mode, elapsed: elapsedSec(), mistakes: mistakes,
          hintsLeft: hintsLeft
        };
      },
      apply: function (s) {
        if (!s || !s.target || !s.state) return false;
        var n = Number(s.size) || 0;
        if (SIZE_OPTIONS.indexOf(n) < 0) return false;
        if (s.target.length !== n || s.state.length !== n) return false;
        for (var i = 0; i < n; i++) {
          if (s.target[i].length !== n || s.state[i].length !== n) return false;
        }
        S = n;
        target = s.target.map(function (row) {
          return row.map(function (v) { return v === 1 ? 1 : 0; });
        });
        state = s.state.map(function (row) {
          return row.map(function (v) { return v === 1 ? 1 : (v === 2 ? 2 : 0); });
        });
        var found = s.puzzleId ? NG.byId(s.puzzleId) : null;
        if (found && found.size === n) puzzle = found;
        else {
          puzzle = {
            id: s.puzzleId || 'resume', name: s.picName || 'gs.nonogram.picRandom',
            size: n, grid: target.map(function (row) { return row.slice(); }),
            clueR: NG.rowsOf(target), clueC: NG.colsOf(target)
          };
        }
        mode = s.mode === 'daily' ? 'daily' : 'normal';
        mistakes = Number(s.mistakes) || 0;
        hintsLeft = s.hintsLeft === undefined ? 3 : Math.max(0, Math.min(3, Number(s.hintsLeft) || 0));
        startTs = Date.now() - (Number(s.elapsed) || 0) * 1000;
        over = false;
        overlay.classList.remove('show');
        missEl.textContent = mistakes;
        hintEl.textContent = hintsLeft;
        picEl.textContent = '???';
        msgEl.textContent = T('gs.nonogram.hintLine');
        msgEl.style.color = '';
        selectSizeUI();
        refreshDailyInfo();
        buildBoard();
        resetZoom();
        return true;
      }
    });
  }

  /* ---------------- 检查 / 提示 / 叉标 / 重开 ---------------- */
  wrap.querySelector('#no-check').addEventListener('click', function () {
    if (over) return;
    var wrong = NG.wrongCells(state, target);
    if (wrong.length) {
      for (var i = 0; i < wrong.length; i++) {
        (function (w) {
          var el = cells[w.r] && cells[w.r][w.c];
          if (!el) return;
          el.classList.add('wrong');
          setTimeout(function () { el.classList.remove('wrong'); }, 1800);
        })(wrong[i]);
      }
      mistakes += 1;
      missEl.textContent = mistakes;
      startTs -= 10 * 1000;
      msgEl.textContent = T('gs.nonogram.checkBad').replace('{n}', wrong.length);
      msgEl.style.color = 'var(--neon-red, #ff4d6d)';
      if (Arcade.audio) Arcade.audio.play('error');
      if (Arcade.juice) Arcade.juice.lose();
      save();
      return;
    }
    if (checkWin()) return;
    msgEl.textContent = T('gs.nonogram.checkOk');
    msgEl.style.color = 'var(--neon-green)';
    if (Arcade.audio) Arcade.audio.play('match');
  });

  function useHint() {
    if (over) return;
    if (hintsLeft <= 0) {
      msgEl.textContent = T('gs.nonogram.hintNone');
      msgEl.style.color = 'var(--neon-pink)';
      if (Arcade.audio) Arcade.audio.play('error');
      return;
    }
    var h = NG.hint(state, target, currentClueR(), currentClueC());
    if (!h) {
      msgEl.textContent = T('gs.nonogram.hintComplete');
      msgEl.style.color = 'var(--neon-green)';
      return;
    }
    state[h.r][h.c] = h.v === 1 ? 1 : 2;
    hintsLeft--;
    hintEl.textContent = hintsLeft;
    startTs -= 12 * 1000;
    cursor.r = h.r; cursor.c = h.c;
    ripple(h.r, h.c);
    paintAll();
    updateHints();
    msgEl.textContent = T('gs.nonogram.hintUsed')
      .replace('{r}', String(h.r + 1)).replace('{c}', String(h.c + 1))
      .replace('{v}', h.v === 1 ? T('gs.nonogram.hintFill') : T('gs.nonogram.hintCross'));
    msgEl.style.color = 'var(--neon-yellow)';
    if (Arcade.audio) Arcade.audio.play('coin');
    if (Arcade.fx && cells[h.r] && cells[h.r][h.c]) {
      var b = cells[h.r][h.c].getBoundingClientRect();
      Arcade.fx.burst(b.left + b.width / 2, b.top + b.height / 2, '#ffe600', 10);
    }
    checkWin();
    save();
  }
  hintBtn.addEventListener('click', useHint);

  function toggleMarkMode() {
    markMode = !markMode;
    markBtn.classList.toggle('on', markMode);
    markBtn.textContent = markMode ? T('gs.nonogram.markOn') : T('gs.nonogram.markBtn');
    if (Arcade.audio) Arcade.audio.play('ui');
  }
  markBtn.addEventListener('click', toggleMarkMode);

  dailyBtn.addEventListener('click', startDaily);

  wrap.querySelector('#no-restart').addEventListener('click', function () {
    if (mode === 'daily') startDaily();
    else startPuzzle(S, puzzle, 'normal');
    if (Arcade.audio) Arcade.audio.play('ui');
  });

  /* ---------------- 键盘 ---------------- */
  window.addEventListener('keydown', function (e) {
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
      e.preventDefault();
      zoomStep(1);
      return;
    }
    if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      zoomStep(-1);
      return;
    }
    if (e.key === '0' || e.code === 'Numpad0') {
      e.preventDefault();
      resetZoom();
      return;
    }
    if (over) return;
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    var handled = true;
    if (e.code === 'ArrowLeft') cursor.c = Math.max(0, cursor.c - 1);
    else if (e.code === 'ArrowRight') cursor.c = Math.min(S - 1, cursor.c + 1);
    else if (e.code === 'ArrowUp') cursor.r = Math.max(0, cursor.r - 1);
    else if (e.code === 'ArrowDown') cursor.r = Math.min(S - 1, cursor.r + 1);
    else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') toggle(cursor.r, cursor.c, false);
    else if (e.code === 'KeyX') toggle(cursor.r, cursor.c, true);
    else if (e.code === 'KeyM') toggleMarkMode();
    else if (e.code === 'KeyH') useHint();
    else if (e.code === 'KeyC') wrap.querySelector('#no-check').click();
    else handled = false;
    if (handled) { e.preventDefault(); paintAll(); }
  });

  /* ---------------- 启动 ---------------- */
  var resumed = false;
  if (Arcade.savegame) resumed = Arcade.savegame.resume();
  if (!resumed) startPuzzle(5, NG.nextPuzzle(5, null), 'normal');

  window.GAME_RESTART = function () {
    if (mode === 'daily') startDaily();
    else startPuzzle(S, NG.nextPuzzle(S, puzzle ? puzzle.id : null), 'normal');
  };

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.nonogram.helpText');
  root.appendChild(hd);

  /* ---------------- QA 钩子（仅 ?qa=1） ---------------- */
  if (QA) {
    window.__QA = {
      state: function () {
        return {
          size: S, puzzleId: puzzle ? puzzle.id : null, name: puzzle ? puzzle.name : null,
          mode: mode, over: over, mistakes: mistakes, hintsLeft: hintsLeft,
          elapsed: elapsedSec(), daily: dailyStatus(),
          grid: state.map(function (row) { return row.slice(); }),
          target: target.map(function (row) { return row.slice(); })
        };
      },
      sizes: function () { return NG.sizes(); },
      puzzles: function () { return NG.all().map(function (p) { return { id: p.id, size: p.size, seed: p.seed, unique: p.unique }; }); },
      startSize: function (n) { startPuzzle(n, NG.nextPuzzle(n, null), 'normal'); },
      startDaily: startDaily,
      dailyStatus: dailyStatus,
      solve: function () {
        state = target.map(function (row) {
          return row.map(function (v) { return v === 1 ? 1 : 0; });
        });
        paintAll(); updateHints(); checkWin(); save();
        return over;
      },
      cellCenter: function (r, c) {
        var el = cells[r] && cells[r][c];
        if (!el) return null;
        var b = el.getBoundingClientRect();
        var st = document.documentElement.scrollTop || document.body.scrollTop;
        return { x: b.left + b.width / 2, y: b.top + st + b.height / 2, size: Math.min(b.width, b.height) };
      },
      useHint: useHint,
      zoom: function (v) { setZoom(Number(v) || 1); return this.zoomInfo(); },
      zoomInfo: function () {
        var vr = viewEl.getBoundingClientRect();
        return {
          zoom: zoom, cell: cellPx(), cellRounded: Math.round(cellPx() * 10) / 10,
          fit: fitZoom(),
          stageW: stageEl.getBoundingClientRect().width,
          viewW: vr.width, viewH: vr.height,
          clientW: viewEl.clientWidth, clientH: viewEl.clientHeight,
          scrollW: viewEl.scrollWidth, scrollH: viewEl.scrollHeight,
          scrollLeft: viewEl.scrollLeft, scrollTop: viewEl.scrollTop,
          canScrollX: viewEl.scrollWidth > viewEl.clientWidth,
          canScrollY: viewEl.scrollHeight > viewEl.clientHeight
        };
      },
      cellRect: function (r, c) {
        var el = cells[r] && cells[r][c];
        if (!el) return null;
        var b = el.getBoundingClientRect();
        return { r: r, c: c, x: b.left, y: b.top, width: b.width, height: b.height };
      },
      check: function () { wrap.querySelector('#no-check').click(); return over; },
      /* 旧误报场景：5×5 两组行列线索完全相同、实际格不同的棋盘
         旧版仅比较线索字符串会误判胜利；新版必须逐格一致 */
      loadAmbiguous: function () {
        var A = NG.parseRows(['10000', '01000', '00111', '10110', '11100']);
        var B = NG.parseRows(['10000', '00001', '11100', '10110', '01110']);
        S = 5;
        target = A;
        state = B;
        puzzle = {
          id: 'qa-ambiguous', name: 'gs.nonogram.picRandom', size: 5,
          grid: A.map(function (r) { return r.slice(); }),
          clueR: NG.rowsOf(A), clueC: NG.colsOf(A)
        };
        mode = 'normal';
        over = false; mistakes = 0; hintsLeft = 3;
        startTs = Date.now();
        overlay.classList.remove('show');
        selectSizeUI();
        buildBoard();
        var sameRows = NG.rowsOf(A).map(function (c) { return c.join(' '); }).join('|') ===
                       NG.rowsOf(B).map(function (c) { return c.join(' '); }).join('|');
        var sameCols = NG.colsOf(A).map(function (c) { return c.join(' '); }).join('|') ===
                       NG.colsOf(B).map(function (c) { return c.join(' '); }).join('|');
        return {
          sameRowClues: sameRows, sameColClues: sameCols,
          strictMatch: NG.strictMatch(B, A), won: checkWin()
        };
      },
      checkWin: function () { return checkWin(); }
    };
  }
})();
