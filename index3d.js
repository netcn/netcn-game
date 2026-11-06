/* ============================================================
   index3d.js —— 街机厅 3D 入口总控
   —— 开场推轨镜头 / 悬停拾取 / 键盘与触控 / 筛选淡出 /
      信息卡 / 加载进度 / WebGL 不可用回退
   ============================================================ */
(function () {
  'use strict';

  var GAMES = window.GAMES || [];
  var CATS = window.GAME_CATEGORIES || [];
  var CAT_COLOR = {
    '经典街机': 0x00f0ff,
    '逻辑谜题': 0x9dff3e,
    '空间解谜': 0xb36cff,
    '动作反应': 0xff3ea5,
    '棋类对弈': 0xffb020,
    '牌骰策略': 0xff4d5e,
    '球类竞技': 0x26e0d0
  };
  var FALLBACK_COLOR = 0x00f0ff;
  var LS_BEST = 'arcade_best_';
  var SESSION_LAST = 'arcade_hall_last';

  function colorOf(g) { return (CAT_COLOR[g.category] || FALLBACK_COLOR); }
  function bestOf(g) {
    try {
      var v = localStorage.getItem(LS_BEST + g.id);
      if (v === null || v === '') return null;
      var n = parseFloat(v);
      return isNaN(n) ? String(v) : n;
    } catch (e) { return null; }
  }

  var DPR = window.devicePixelRatio || 1;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var narrow = window.innerWidth < 880;
  var cores = navigator.hardwareConcurrency || 4;
  var isMobile = !!(coarse || narrow);
  var lowEnd = cores <= 4;
  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var params = {};
  (function () {
    var s = (location.search || '').replace(/^\?/, '');
    if (!s) return;
    s.split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
  })();

  var QUALITY = {
    low: isMobile || lowEnd,
    mid: isMobile,
    pixelRatio: Math.min(DPR, isMobile ? 1.5 : 1.75),
    samples: isMobile || lowEnd ? 0 : 2,
    bloom: params.fx !== '0',
    bloomStrength: isMobile ? 0.78 : 1.05,
    fog: 0.0135,
    reflection: !lowEnd
  };
  if (params.quality === 'low') {
    QUALITY.low = true; QUALITY.samples = 0; QUALITY.pixelRatio = 1;
    QUALITY.bloomStrength = 0.55;
  }

  var state = {
    ready: false, entering: false, degraded: false,
    selected: -1, hovered: -1, mode: 'intro', introDone: false, pendingId: null
  };

  var renderer, camera, sceneApi, post, time = 0;
  var stageEl, canvasEl, debugEl;
  var hoverDirty = false, hoverPoint = { x: 0, y: 0 };
  var pointer = { down: false, moved: 0, lastX: 0, lastY: 0, type: 'mouse', inside: false };
  var touchPts = {};
  var pinchLast = 0;

  var PORTRAIT = (window.innerHeight / window.innerWidth) > 1.15;
  /* 竖屏（手机）用斜 3/4 视角看一整排机柜，横屏用街道中线纵览 */
  var OVERVIEW_ANCHOR = PORTRAIT ? new THREE.Vector3(-4.9, 1.9, 5) : new THREE.Vector3(0, 2.35, 0);
  var OVERVIEW_DEFAULT = PORTRAIT
    ? { yaw: 0.90, pitch: 0.11, dist: 9.4 }
    : { yaw: 0, pitch: 0.09, dist: 24 };
  var view = { yaw: OVERVIEW_DEFAULT.yaw, pitch: OVERVIEW_DEFAULT.pitch, dist: OVERVIEW_DEFAULT.dist };
  var FOCUS_DIST = PORTRAIT ? 2.5 : 3.25;

  var curPos = new THREE.Vector3();
  var curLook = new THREE.Vector3();
  var intro = null;
  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var fpsT0 = 0, fpsFrames = 0, fpsValue = 0, fpsGrace = 6;

  /* ============================================================
     启动
     ============================================================ */
  boot();

  async function boot() {
    stageEl = document.getElementById('stage');

    window.HallUI.init({
      games: GAMES, cats: CATS, colorOf: colorOf, bestOf: bestOf,
      lang: (document.documentElement.lang || '').indexOf('en') === 0 ? 'en' : 'zh',
      onChange: onFilterChange,
      onSearchEnter: function (g) { focusGame(g); },
      onEnter: function (g) { enterGame(g); },
      onClose: function () { deselect(); },
      onLang: function (l) { try { localStorage.setItem('arcade_lang', l); } catch (e) { /* ignore */ } }
    });

    if (params['2d'] === '1') return start2D('forced');
    if (!window.THREE) return start2D('no-three');

    window.HallUI.setProgress(6, '初始化渲染器');
    await nextFrame();

    /* 先自己探测 WebGL，失败直接走 2D，避免 three 在控制台抛错 */
    var probe = document.createElement('canvas');
    var glOpts = { antialias: false, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' };
    var gl = probe.getContext('webgl2', glOpts) || probe.getContext('webgl', glOpts) || probe.getContext('experimental-webgl', glOpts);
    if (!gl) return start2D('no-webgl');

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: probe, context: gl,
        antialias: false, alpha: false, stencil: false, depth: true,
        powerPreference: 'high-performance', preserveDrawingBuffer: false
      });
    } catch (e) {
      return start2D('no-webgl');
    }

    renderer.setPixelRatio(QUALITY.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x04050b, 1);
    renderer.info.autoReset = false;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    stageEl.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;

    canvasEl.addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      start2D('context-lost');
    }, false);

    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 20, 56);
    curPos.copy(camera.position);

    /* ---- 预生成贴图（分帧，避免首屏卡死） ---- */
    var n = GAMES.length;
    for (var i = 0; i < n; i++) {
      window.HallTextures.screen(GAMES[i], colorOf(GAMES[i]), bestOf(GAMES[i]), QUALITY.low);
      window.HallTextures.marquee(GAMES[i], colorOf(GAMES[i]), QUALITY.low);
      if (i % 9 === 0) {
        window.HallUI.setProgress(8 + (i / n) * 46, '正在点亮机柜屏幕…');
        await nextFrame();
      }
    }
    window.HallUI.setProgress(56, '正在搭起霓虹街区…');
    await nextFrame();

    try {
      sceneApi = window.HallScene.build({
        games: GAMES, cats: CATS, colorOf: colorOf, bestOf: bestOf,
        quality: QUALITY, renderer: renderer
      });
    } catch (e) {
      console.warn('[hall] build failed', e);
      return start2D('build-failed');
    }

    window.HallUI.setProgress(84, '正在调校后期辉光…');
    await nextFrame();

    post = window.HallPost.create(renderer, {
      enabled: QUALITY.bloom,
      strength: QUALITY.bloomStrength,
      samples: QUALITY.samples,
      threshold: 0.70,
      exposure: 1.14
    });
    post.setSize(window.innerWidth, window.innerHeight, QUALITY.pixelRatio);

    setupCameraIntro();
    bindEvents();
    resize();

    window.HallUI.setProgress(97, '正在开门…');
    await nextFrame();

    /* 首帧 */
    renderFrame(0.016);
    window.HallUI.setProgress(100, '欢迎光临');
    window.HallUI.finishLoad();
    state.ready = true;
    requestAnimationFrame(animate);

    if (debugEnabled()) createDebug();

    /* 从游戏页返回时，记住上一台机柜 */
    try {
      var last = sessionStorage.getItem(SESSION_LAST);
      if (last) {
        for (var k = 0; k < sceneApi.cabinets.length; k++) {
          if (sceneApi.cabinets[k].game.id === last) { state.pendingId = k; break; }
        }
      }
    } catch (e) { /* ignore */ }
    if (state.pendingId !== null && state.introDone) {
      var pid0 = state.pendingId;
      state.pendingId = null;
      selectIndex(pid0);
    }
  }

  function nextFrame() {
    return new Promise(function (res) { requestAnimationFrame(function () { res(); }); });
  }

  /* ============================================================
     2D 回退
     ============================================================ */
  function start2D(reason) {
    state.ready = false;
    if (window.HallUI) window.HallUI.showFallback(reason);
  }

  /* ============================================================
     镜头
     ============================================================ */
  function setupCameraIntro() {
    var end = poseFor(OVERVIEW_DEFAULT, OVERVIEW_ANCHOR);
    /* 竖屏：从街区上空斜向落入左排机柜前；横屏：沿中线穿过北拱门 */
    var start = PORTRAIT ? new THREE.Vector3(11.5, 11.5, 31) : new THREE.Vector3(0, 21.5, 57);
    var mid = PORTRAIT ? new THREE.Vector3(7.4, 7.2, 20.5) : new THREE.Vector3(0, 12.4, 43);
    var fromLook = PORTRAIT ? new THREE.Vector3(0, 0.4, 2) : new THREE.Vector3(0, 7.0, 2);
    var curve = new THREE.CatmullRomCurve3([start, mid, end.pos], false, 'catmullrom', 0.45);

    if (reducedMotion) {
      state.mode = 'overview';
      state.introDone = true;
      curPos.copy(end.pos);
      curLook.copy(end.look);
      return;
    }
    state.mode = 'intro';
    intro = {
      t0: performance.now(), dur: isMobile ? 2.4 : 3.4, curve: curve,
      fromLook: fromLook, toLook: end.look,
      endPos: end.pos.clone(), endLook: end.look.clone()
    };
    curPos.copy(start);
    curLook.copy(fromLook);
  }

  function poseFor(v, anchor) {
    var cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    return {
      pos: new THREE.Vector3(
        anchor.x + v.dist * cp * Math.sin(v.yaw),
        anchor.y + v.dist * sp,
        anchor.z + v.dist * cp * Math.cos(v.yaw)
      ),
      look: anchor.clone()
    };
  }

  function focusPose() {
    var cab = sceneApi.cabinets[state.selected];
    if (!cab) return null;
    var fp = sceneApi.focusPose(cab);
    return poseFor({ yaw: view.yaw, pitch: Math.max(0.03, view.pitch), dist: view.dist }, fp.anchor);
  }

  function updateCamera(dt, t) {
    var wantPos = new THREE.Vector3();
    var wantLook = new THREE.Vector3();
    var lambda = 2.5;

    if (state.mode === 'intro' && intro) {
      /* 开场用真实时间推进：低帧设备也能按时结束，不会无限拖长 */
      var k = Math.min(1, (performance.now() - intro.t0) / 1000 / intro.dur);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      var p = intro.curve.getPoint(e);
      var le = Math.min(1, k * 1.15);
      var lv = le < 0.5 ? 2 * le * le : 1 - Math.pow(-2 * le + 2, 2) / 2;
      curPos.copy(p);
      curLook.lerpVectors(intro.fromLook, intro.toLook, lv);
      camera.position.copy(curPos);
      camera.lookAt(curLook);
      if (k >= 1) {
        state.mode = 'overview';
        state.introDone = true;
        curPos.copy(intro.endPos);
        curLook.copy(intro.endLook);
        intro = null;
        applyPending();
      }
      return;
    }

    var focus = state.mode === 'focus' && state.selected >= 0;
    if (focus) {
      var fp = focusPose();
      if (fp) { wantPos.copy(fp.pos); wantLook.copy(fp.look); }
      lambda = 2.2;
    } else {
      var yawEff = view.yaw + (pointer.down ? 0 : Math.sin(t * 0.16) * 0.06);
      var pv = poseFor({ yaw: yawEff, pitch: view.pitch, dist: view.dist }, OVERVIEW_ANCHOR);
      wantPos.copy(pv.pos); wantLook.copy(pv.look);
      lambda = 2.6;
      /* 鼠标视差 */
      if (!isMobile) {
        var nx = (hoverPoint.x / window.innerWidth - 0.5);
        var ny = (hoverPoint.y / window.innerHeight - 0.5);
        wantPos.x += nx * 0.9;
        wantPos.y -= ny * 0.5;
      }
    }

    var kp = 1 - Math.exp(-lambda * dt);
    curPos.x += (wantPos.x - curPos.x) * kp;
    curPos.y += (wantPos.y - curPos.y) * kp;
    curPos.z += (wantPos.z - curPos.z) * kp;
    var kl = 1 - Math.exp(-3.4 * dt);
    curLook.x += (wantLook.x - curLook.x) * kl;
    curLook.y += (wantLook.y - curLook.y) * kl;
    curLook.z += (wantLook.z - curLook.z) * kl;

    camera.position.copy(curPos);
    camera.lookAt(curLook);
  }

  /* ============================================================
     选择 / 进入
     ============================================================ */
  function selectIndex(i, fromPointer) {
    if (!sceneApi) return;
    var cab = sceneApi.cabinets[i];
    if (!cab) return;
    if (!window.HallUI.matches(cab.game)) return;
    if (state.selected === i) {
      if (fromPointer === 'touch') enterGame(cab.game);
      return;
    }
    var wasFocus = state.selected >= 0;
    state.selected = i;
    state.mode = 'focus';
    intro = null;
    view.yaw = cab.side ? -Math.PI / 2 : Math.PI / 2;
    view.pitch = 0.06;
    view.dist = FOCUS_DIST;
    sceneApi.setSelected(i);
    sceneApi.setHover(-1);
    state.hovered = -1;
    window.HallUI.hideTip();
    window.HallUI.showCard(cab.game);
    if (!wasFocus) { /* 保留总览视角，Esc 时复位 */ }
  }

  function focusGame(g) {
    if (!sceneApi) return;
    for (var i = 0; i < sceneApi.cabinets.length; i++) {
      if (sceneApi.cabinets[i].game.id === g.id) { selectIndex(i); return; }
    }
  }

  function deselect() {
    if (state.selected < 0) {
      window.HallUI.hideCard();
      return;
    }
    state.selected = -1;
    state.mode = 'overview';
    view.yaw = OVERVIEW_DEFAULT.yaw;
    view.pitch = OVERVIEW_DEFAULT.pitch;
    view.dist = OVERVIEW_DEFAULT.dist;
    if (sceneApi) sceneApi.setSelected(-1);
    window.HallUI.hideCard();
  }

  function enterGame(g) {
    if (state.entering || !g) return;
    state.entering = true;
    try { sessionStorage.setItem(SESSION_LAST, g.id); } catch (e) { /* ignore */ }
    var warp = document.getElementById('warp');
    if (warp) warp.classList.add('on');
    setTimeout(function () { location.href = g.path; }, 220);
  }

  function onFilterChange() {
    if (!sceneApi) {
      if (window.HallUI.isFallback()) window.HallUI.renderFallback();
      return;
    }
    sceneApi.setFilter(function (g) { return window.HallUI.matches(g); });
    if (state.selected >= 0) {
      var cab = sceneApi.cabinets[state.selected];
      if (cab && !window.HallUI.matches(cab.game)) deselect();
    }
    if (state.hovered >= 0) {
      var hc = sceneApi.cabinets[state.hovered];
      if (hc && !window.HallUI.matches(hc.game)) {
        sceneApi.setHover(-1); state.hovered = -1; window.HallUI.hideTip();
      }
    }
    if (window.HallUI.isFallback()) window.HallUI.renderFallback();
  }

  /* ============================================================
     拾取 / 输入
     ============================================================ */
  function bindEvents() {
    canvasEl.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    canvasEl.addEventListener('pointerleave', function () {
      pointer.inside = false;
      if (!pointer.down) clearHover();
    });
    canvasEl.addEventListener('pointerenter', function () { pointer.inside = true; hoverDirty = true; });
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 260); });
    window.addEventListener('keydown', onKey);
  }

  function onDown(e) {
    if (e.target !== canvasEl) return;
    skipIntro();
    pointer.down = true;
    pointer.moved = 0;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.type = e.pointerType || 'mouse';
    pointer.inside = true;
    touchPts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (canvasEl.setPointerCapture) {
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    if (e.pointerType === 'touch') { hoverPoint.x = e.clientX; hoverPoint.y = e.clientY; }
  }

  function onMove(e) {
    hoverPoint.x = e.clientX;
    hoverPoint.y = e.clientY;
    if (touchPts[e.pointerId]) { touchPts[e.pointerId] = { x: e.clientX, y: e.clientY }; }
    if (!pointer.down) {
      pointer.type = e.pointerType || 'mouse';
      if (pointer.type === 'mouse' && pointer.inside) hoverDirty = true;
      return;
    }
    var ids = Object.keys(touchPts);
    if (ids.length >= 2) {
      var a = touchPts[ids[0]], b = touchPts[ids[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchLast > 0 && d > 0) {
        view.dist = clamp(view.dist * (pinchLast / d), zoomMin(), zoomMax());
      }
      pinchLast = d;
      pointer.moved += 10;
      return;
    }
    var dx = e.clientX - pointer.lastX;
    var dy = e.clientY - pointer.lastY;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    if (pointer.moved < 4) return;
    if (state.mode === 'focus') {
      view.yaw -= dx * 0.005;
      view.pitch = clamp(view.pitch + dy * 0.004, -0.28, 0.72);
    } else {
      view.yaw = clamp(view.yaw - dx * 0.0034, -1.25, 1.25);
      view.pitch = clamp(view.pitch + dy * 0.0026, 0.01, 0.95);
    }
    window.HallUI.hideTip();
  }

  function onUp(e) {
    if (touchPts[e.pointerId]) delete touchPts[e.pointerId];
    if (Object.keys(touchPts).length < 2) pinchLast = 0;
    if (!pointer.down) return;
    var wasMoved = pointer.moved;
    var type = e.pointerType || pointer.type;
    pointer.down = false;
    if (wasMoved < 8) {
      var cab = pickAt(e.clientX, e.clientY);
      if (cab) {
        if (type === 'mouse') enterGame(cab.game);
        else selectIndex(cab.index, 'touch');
      } else if (type === 'mouse') {
        deselect();
      }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    skipIntro();
    view.dist = clamp(view.dist + e.deltaY * 0.03, zoomMin(), zoomMax());
  }

  /* 入场动画期间任何操作都可以直接跳到终点，避免等 3 秒 */
  function skipIntro() {
    if (state.mode !== 'intro' || !intro) return;
    state.mode = 'overview';
    state.introDone = true;
    curPos.copy(intro.endPos);
    curLook.copy(intro.endLook);
    intro = null;
    applyPending();
  }
  function applyPending() {
    if (state.pendingId === null) return;
    var pid = state.pendingId;
    state.pendingId = null;
    selectIndex(pid);
  }

  function zoomMin() { return state.selected >= 0 ? 2.1 : (PORTRAIT ? 6.5 : 14); }
  function zoomMax() { return state.selected >= 0 ? 6.5 : (PORTRAIT ? 22 : 62); }

  /* 键盘可到全部 53 台（相机不必看到也能选中）；鼠标在近处 6 台可通过缩小或旋转看到 */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function pickAt(cx, cy) {
    if (!sceneApi) return null;
    ndc.x = (cx / window.innerWidth) * 2 - 1;
    ndc.y = -(cy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObject(sceneApi.bodyMesh, false);
    if (!hits.length) return null;
    var idx = hits[0].instanceId;
    var cab = sceneApi.cabinets[idx];
    if (!cab || !window.HallUI.matches(cab.game)) return null;
    return cab;
  }

  function doHover() {
    hoverDirty = false;
    if (!sceneApi || isMobile) return;
    if (pointer.down) return;
    var cab = pickAt(hoverPoint.x, hoverPoint.y);
    var idx = cab ? cab.index : -1;
    if (idx === state.hovered) {
      if (cab) window.HallUI.moveTip(hoverPoint.x, hoverPoint.y);
      return;
    }
    state.hovered = idx;
    sceneApi.setHover(idx);
    if (cab) window.HallUI.showTip(cab.game, hoverPoint.x, hoverPoint.y);
    else window.HallUI.hideTip();
  }

  function clearHover() {
    state.hovered = -1;
    if (sceneApi) sceneApi.setHover(-1);
    window.HallUI.hideTip();
  }

  /* ============================================================
     键盘
     ============================================================ */
  function onKey(e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    skipIntro();
    var key = e.key;

    if (key === '/' || key === '／') {
      e.preventDefault();
      var q = document.getElementById('q');
      if (q) q.focus();
      return;
    }
    if ((key === 'b' || key === 'B') && post) {
      var on = !post.isEnabled();
      post.setEnabled(on);
      return;
    }
    if (key === 'Escape') {
      e.preventDefault();
      if (state.mode === 'focus') deselect();
      return;
    }
    if (!sceneApi) return;

    if (key === 'Enter') {
      e.preventDefault();
      if (state.selected >= 0) {
        enterGame(sceneApi.cabinets[state.selected].game);
      } else if (state.hovered >= 0) {
        enterGame(sceneApi.cabinets[state.hovered].game);
      } else {
        var vis = window.HallUI.visible();
        if (vis.length) focusGame(vis[0]);
      }
      return;
    }

    var dir = null;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') dir = 'left';
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') dir = 'right';
    else if (key === 'ArrowUp' || key === 'w' || key === 'W') dir = 'deep';
    else if (key === 'ArrowDown' || key === 's' || key === 'S') dir = 'back';
    if (!dir) return;
    e.preventDefault();

    var cur = state.selected >= 0 ? state.selected : 0;
    var next = navIndex(cur, dir);
    if (next !== null && next !== undefined) selectIndex(next);
  }

  function navIndex(cur, dir) {
    var n = sceneApi.cabinets.length;
    var step = 1;
    if (dir === 'left') step = (cur % 2 === 1) ? -1 : -2;
    if (dir === 'right') step = (cur % 2 === 0) ? 1 : 2;
    if (dir === 'deep') step = 2;
    if (dir === 'back') step = -2;
    var i = cur + step;
    var guard = 0;
    while (i >= 0 && i < n && guard < n) {
      if (window.HallUI.matches(sceneApi.cabinets[i].game)) return i;
      i += (step > 0 ? 1 : -1);
      guard++;
    }
    /* 到头则朝反方向找最近的可选机柜 */
    i = cur;
    for (var k = 0; k < n; k++) {
      i += (step > 0 ? -1 : 1);
      if (i < 0 || i >= n) break;
      if (window.HallUI.matches(sceneApi.cabinets[i].game)) return i;
    }
    return null;
  }

  /* ============================================================
     渲染循环
     ============================================================ */
  var debugEnabled = function () { return params.debug === '1'; };
  function createDebug() {
    debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:70;font:10px/1.5 monospace;' +
      'color:#9dff3e;background:rgba(0,0,0,.55);padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre';
    document.body.appendChild(debugEl);
  }

  function resize() {
    if (!renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(QUALITY.pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (post) post.setSize(w, h, QUALITY.pixelRatio);
  }

  function renderFrame(dt) {
    if (!renderer || !sceneApi) return;
    sceneApi.update(dt, time);
    post.render(sceneApi.scene, camera, time);
  }

  /* ============================================================
     对外调试接口（不参与 UI 行为）
     ============================================================ */
  var last = 0;
  function animate(ts) {
    requestAnimationFrame(animate);
    if (!state.ready) return;
    var dt = Math.min(0.05, Math.max(0.001, (ts - (last || ts)) / 1000 || 0.016));
    last = ts;
    time += dt;

    if (document.hidden) return;

    updateCamera(dt, time);
    if (hoverDirty) doHover();

    sceneApi.update(dt, time);
    renderer.info.reset();
    post.render(sceneApi.scene, camera, time);

    /* 帧率监测与自动降级（按真实帧时间统计） */
    if (!fpsT0) fpsT0 = ts;
    fpsFrames++;
    if (ts - fpsT0 >= 1000) {
      fpsValue = fpsFrames * 1000 / (ts - fpsT0);
      fpsT0 = ts; fpsFrames = 0;
      fpsGrace--;
      if (fpsGrace < 0 && !state.degraded && fpsValue < 42 && post.isEnabled()) {
        state.degraded = true;
        post.setEnabled(false);
        post.setStrength(0);
        QUALITY.pixelRatio = Math.min(QUALITY.pixelRatio, 1.25);
        resize();
      }
      if (debugEl) {
        var info = renderer.info;
        debugEl.textContent = 'FPS ' + fpsValue.toFixed(0) +
          '  calls ' + info.render.calls +
          '  tris ' + Math.round(info.render.triangles / 1000) + 'k' +
          '  pr ' + QUALITY.pixelRatio.toFixed(2) +
          (post.isEnabled() ? '  bloom' : '  no-bloom');
      }
    }
  }

  /* ============================================================
     对外调试接口（不参与 UI 行为，仅 ?qa=1 时挂载）
     ============================================================ */
  if (params.qa === '1') window.__ARCADE_HALL__ = {
    cabinets: function () { return sceneApi ? sceneApi.cabinets : []; },
    state: function () { return state; },
    select: function (i) { selectIndex(i); },
    deselect: deselect,
    focusGame: focusGame,
    enterGame: enterGame,
    renderer: function () { return renderer; },
    camera: function () { return camera; },
    scene: function () { return sceneApi; },
    post: function () { return post; },
    fps: function () { return fpsValue; },
    force2D: function () { start2D('debug'); }
  };
})();
