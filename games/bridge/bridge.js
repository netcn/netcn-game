/* ============================================================
   桥梁搭建 Bridge Builder —— 旗舰版
   真 2D 桁架（节点 + 杆件 + 刚度矩阵 + 位移法 + 轴力/应力/挠度）
   木 / 钢 / 缆索 · 8 关 · 关卡编辑器 · 断裂与失稳结算
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.bridge.tut1t'), d: T('gs.bridge.tut1') },
  { t: T('gs.bridge.tut2t'), d: T('gs.bridge.tut2') },
  { t: T('gs.bridge.tut3t'), d: T('gs.bridge.tut3') },
  { t: T('gs.bridge.tut4t'), d: T('gs.bridge.tut4') }
];

(function () {
  'use strict';
  var root = document.getElementById('game-root');
  if (!root) return;
  var PHYS = window.BridgePhysics;
  var MAT = PHYS.MATERIALS;
  var QA = /[?&]qa=1(?:[&#]|$)/.test(location.search);

  /* ---------------- 关卡数据 ---------------- */
  var LEVELS = [
    {
      name: 'gs.bridge.level1', L: { x: 80, y: 230 }, R: { x: 520, y: 230 },
      supports: [{ x: 300, y: 345 }], budget: 70, weight: 160, maxNodes: 6
    },
    {
      name: 'gs.bridge.level2', L: { x: 70, y: 230 }, R: { x: 530, y: 210 },
      supports: [{ x: 200, y: 350 }, { x: 400, y: 350 }], budget: 88, weight: 220, maxNodes: 8
    },
    {
      name: 'gs.bridge.level3', L: { x: 60, y: 220 }, R: { x: 540, y: 205 },
      supports: [{ x: 300, y: 350 }], budget: 88, weight: 300, maxNodes: 8
    },
    {
      name: 'gs.bridge.level4', L: { x: 60, y: 240 }, R: { x: 540, y: 180 },
      supports: [{ x: 200, y: 340 }, { x: 400, y: 340 }], budget: 95, weight: 360, maxNodes: 9
    },
    {
      name: 'gs.bridge.level5', L: { x: 50, y: 230 }, R: { x: 550, y: 210 },
      supports: [{ x: 220, y: 350 }, { x: 380, y: 350 }], budget: 98, weight: 420, maxNodes: 10
    },
    {
      name: 'gs.bridge.level6', L: { x: 40, y: 220 }, R: { x: 560, y: 240 },
      supports: [{ x: 300, y: 355 }], budget: 115, weight: 480, maxNodes: 11
    },
    {
      name: 'gs.bridge.level7', L: { x: 40, y: 210 }, R: { x: 560, y: 230 },
      supports: [{ x: 200, y: 350 }, { x: 400, y: 350 }], budget: 118, weight: 540, maxNodes: 11
    },
    {
      name: 'gs.bridge.level8', L: { x: 30, y: 220 }, R: { x: 570, y: 210 },
      supports: [{ x: 300, y: 360 }], budget: 134, weight: 620, maxNodes: 12
    }
  ];

  /* 参考解（QA / 演示用；正式玩法由玩家自己搭） */
  var REF = [
    { deck: [{ x: 180, y: 230 }, { x: 300, y: 230 }, { x: 420, y: 230 }],
      beams: [[0, 'd0', 'wood'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 1, 'wood'],
        ['d1', 's0', 'wood'], ['d0', 's0', 'wood'], ['d2', 's0', 'wood']] },
    { deck: [{ x: 170, y: 227 }, { x: 270, y: 223 }, { x: 370, y: 218 }, { x: 470, y: 214 }],
      beams: [[0, 'd0', 'wood'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 'd3', 'wood'], ['d3', 1, 'wood'],
        ['d0', 's0', 'wood'], ['d1', 's0', 'wood'], ['d1', 's1', 'wood'], ['d2', 's1', 'wood'], ['d2', 's0', 'wood'], ['d3', 's1', 'wood']] },
    { deck: [{ x: 160, y: 216 }, { x: 300, y: 212 }, { x: 440, y: 209 }],
      beams: [[0, 'd0', 'wood'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 1, 'wood'],
        ['d1', 's0', 'wood'], ['d0', 's0', 'wood'], ['d2', 's0', 'wood']] },
    { deck: [{ x: 160, y: 227 }, { x: 280, y: 212 }, { x: 420, y: 195 }],
      beams: [[0, 'd0', 'wood'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 1, 'wood'],
        ['d0', 's0', 'wood'], ['d1', 's0', 'wood'], ['d1', 's1', 'wood'], ['d2', 's1', 'wood']] },
    { deck: [{ x: 140, y: 226 }, { x: 220, y: 223 }, { x: 300, y: 220 }, { x: 380, y: 217 }, { x: 460, y: 214 }],
      beams: [[0, 'd0', 'wood'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 'd3', 'wood'], ['d3', 'd4', 'wood'], ['d4', 1, 'wood'],
        ['d1', 's0', 'wood'], ['d2', 's0', 'wood'], ['d2', 's1', 'wood'], ['d3', 's1', 'wood'], ['d0', 's0', 'wood'], ['d4', 's1', 'wood']] },
    { deck: [{ x: 140, y: 224 }, { x: 220, y: 227 }, { x: 300, y: 230 }, { x: 380, y: 233 }, { x: 460, y: 236 }],
      beams: [[0, 'd0', 'wood'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 'd3', 'wood'], ['d3', 'd4', 'wood'], ['d4', 1, 'wood'],
        ['d2', 's0', 'steel'], ['d0', 's0', 'steel'], ['d1', 's0', 'steel'], ['d3', 's0', 'steel'], ['d4', 's0', 'steel']] },
    { deck: [{ x: 120, y: 213 }, { x: 200, y: 216 }, { x: 280, y: 219 }, { x: 360, y: 222 }, { x: 440, y: 225 }],
      beams: [[0, 'd0', 'wood'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 'd3', 'wood'], ['d3', 'd4', 'wood'], ['d4', 1, 'wood'],
        ['d1', 's0', 'steel'], ['d0', 's0', 'steel'], ['d2', 's0', 'steel'], ['d2', 's1', 'steel'], ['d3', 's1', 'steel'], ['d4', 's1', 'steel']] },
    { deck: [{ x: 130, y: 218 }, { x: 230, y: 216 }, { x: 300, y: 215 }, { x: 370, y: 214 }, { x: 470, y: 212 }],
      beams: [[0, 'd0', 'steel'], ['d0', 'd1', 'wood'], ['d1', 'd2', 'wood'], ['d2', 'd3', 'wood'], ['d3', 'd4', 'wood'], ['d4', 1, 'steel'],
        ['d2', 's0', 'steel'], ['d0', 's0', 'steel'], ['d4', 's0', 'steel'], ['d1', 's0', 'steel'], ['d3', 's0', 'steel']] }
  ];

  var W = 600, H = 400, SNAP = 20, HIT_NODE = 40, HIT_BEAM = 40, MIN_BEAM = 30;
  var DEFLECT_LIMIT = 20, SPEED = 62;
  var CLEAR_KEY = 'arcade_bridge_cleared';
  var BEST_KEY = 'arcade_bridge_best_levels';
  var EDIT_KEY = 'arcade_bridge_editor_custom';

  /* ---------------- DOM ---------------- */
  var wrap = document.createElement('div');
  wrap.className = 'br-wrap';
  wrap.innerHTML =
    '<div class="br-bar">' +
    '  <button class="br-tab" id="br-levels-btn">' + T('gs.bridge.levels') + '</button>' +
    '  <button class="br-tab active" id="br-build-btn">' + T('gs.bridge.build') + '</button>' +
    '  <button class="br-tab" id="br-del-btn">' + T('gs.bridge.remove') + '</button>' +
    '  <button class="br-tab" id="br-undo-btn">' + T('gs.bridge.undo') + '</button>' +
    '  <div class="br-hud" id="br-hud"></div>' +
    '</div>' +
    '<div class="br-matbar" id="br-matbar"></div>' +
    '<canvas class="br-canvas" id="br-canvas" aria-label="' + T('gs.bridge.canvasLabel') + '"></canvas>' +
    '<div class="br-msg" id="br-msg"></div>' +
    '<div class="br-actions">' +
    '  <button class="br-btn green" id="br-test">' + T('gs.bridge.test') + '</button>' +
    '  <button class="br-btn" id="br-editor">' + T('gs.bridge.editor') + '</button>' +
    '  <div class="br-editorbar" id="br-editorbar">' +
    '    <button class="br-btn" id="br-save">' + T('gs.bridge.save') + '</button>' +
    '    <button class="br-btn" id="br-load">' + T('gs.bridge.load') + '</button>' +
    '    <button class="br-btn" id="br-clear">' + T('gs.bridge.clear') + '</button>' +
    '    <button class="br-btn" id="br-exit-editor">' + T('gs.bridge.exitEditor') + '</button>' +
    '  </div>' +
    '  <button class="br-btn" id="br-restart">' + T('gs.bridge.restart') + '</button>' +
    '</div>' +
    '<div class="br-overlay hidden" id="br-result"><div class="br-panel">' +
    '  <div class="br-title" id="br-res-title"></div>' +
    '  <div class="br-res-stats" id="br-res-stats"></div>' +
    '  <div class="br-res-btns" id="br-res-btns"></div>' +
    '</div></div>' +
    '<div class="br-overlay hidden" id="br-levels"><div class="br-panel">' +
    '  <div class="br-title">' + T('gs.bridge.selectLevel') + '</div>' +
    '  <div class="br-lv-grid" id="br-lv-grid"></div>' +
    '  <div class="br-res-btns"><button class="br-btn" id="br-lv-close">' + T('gs.bridge.close') + '</button>' +
    '  <button class="br-btn" id="br-lv-editor">' + T('gs.bridge.editor') + '</button></div>' +
    '</div></div>';
  root.appendChild(wrap);

  var canvas = wrap.querySelector('#br-canvas');
  var gk = GK.setup(canvas, W, H);
  var ctx = gk.ctx;
  var hud = wrap.querySelector('#br-hud');
  var msgEl = wrap.querySelector('#br-msg');
  var matbar = wrap.querySelector('#br-matbar');
  var resultOv = wrap.querySelector('#br-result');
  var resTitle = wrap.querySelector('#br-res-title');
  var resStats = wrap.querySelector('#br-res-stats');
  var resBtns = wrap.querySelector('#br-res-btns');
  var levelsOv = wrap.querySelector('#br-levels');
  var lvGrid = wrap.querySelector('#br-lv-grid');
  var editorbar = wrap.querySelector('#br-editorbar');
  var buildBtn = wrap.querySelector('#br-build-btn');
  var delBtn = wrap.querySelector('#br-del-btn');
  var testBtn = wrap.querySelector('#br-test');

  /* ---------------- 状态 ---------------- */
  var nodes = [], beams = [], undoStack = [];
  var mode = 'level', levelIdx = 0, tool = 'build', material = 'wood', phase = 'build';
  var budget = 70, weight = 160, maxNodes = 6;
  var test = null, result = null, lastResult = null, speedMul = 1;
  var hover = { x: 0, y: 0, on: false, node: -1, beam: -1 };
  var dragFrom = null, dragPos = null, dragMoved = false;
  var fx = [], stars = [], clock = 0;

  (function initStars() {
    var seed = 7;
    for (var i = 0; i < 46; i++) {
      seed = (seed * 16807) % 2147483647;
      stars.push({ x: (seed % 600), y: ((seed * 3) % 210), a: 0.25 + ((seed % 60) / 100) });
    }
  })();

  /* ---------------- 存档（关卡/最佳） ---------------- */
  function readCleared() {
    try {
      var a = JSON.parse(localStorage.getItem(CLEAR_KEY) || '[]');
      return LEVELS.map(function (_, i) { return !!a[i]; });
    } catch (e) { return LEVELS.map(function () { return false; }); }
  }
  function readBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  var cleared = readCleared();
  var bestLevels = readBest();

  /* ---------------- 关卡装载 ---------------- */
  function fixedNode(x, y) { return { x: x, y: y, fixed: true, broken: false }; }

  function loadLevel(idx) {
    idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
    mode = 'level'; levelIdx = idx;
    var cfg = LEVELS[idx];
    nodes = [fixedNode(cfg.L.x, cfg.L.y), fixedNode(cfg.R.x, cfg.R.y)];
    cfg.supports.forEach(function (s) { nodes.push(fixedNode(s.x, s.y)); });
    beams = []; undoStack = [];
    budget = cfg.budget; weight = cfg.weight; maxNodes = cfg.maxNodes;
    phase = 'build'; test = null; result = null; lastResult = null; dragFrom = null;
    hideOverlays();
    setTool('build');
    say(T('gs.bridge.levelStart').replace('{n}', String(idx + 1)), 'var(--text-dim)');
    recalc();
    updateControls();
    refreshMatbar();
    refreshHUD();
  }

  function enterEditor() {
    mode = 'editor'; phase = 'build'; test = null; result = null; lastResult = null;
    nodes = [fixedNode(60, 220), fixedNode(540, 220)];
    beams = []; undoStack = [];
    budget = 220; weight = 300; maxNodes = 30;
    hideOverlays();
    setTool('build');
    say(T('gs.bridge.editorStart'), 'var(--neon-yellow)');
    recalc(); updateControls(); refreshMatbar(); refreshHUD();
  }

  /* ---------------- 基础操作 ---------------- */
  function playerNodeCount() {
    var c = 0;
    nodes.forEach(function (n) { if (!n.fixed) c++; });
    return c;
  }
  function usedCost() {
    var sum = 0;
    beams.forEach(function (b) { sum += PHYS.memberCost(b, nodes); });
    return sum;
  }
  function matLabel(k) { return T('gs.bridge.' + MAT[k].name); }
  function recalc() {
    var u = usedCost();
    hud.setAttribute('data-used', u.toFixed(1));
    refreshHUD();
  }
  function refreshHUD() {
    var name = mode === 'editor' ? T('gs.bridge.editorTitle') : T(LEVELS[levelIdx].name);
    var span = nodes.length >= 2 ? Math.round(PHYS.lengthOf(nodes[0], nodes[1])) : 0;
    var matName = matLabel(material);
    var over = usedCost() > budget + 0.01;
    hud.innerHTML =
      '<span>' + name + '</span>' +
      '<span>' + T('gs.bridge.hudSpan') + ' <b>' + span + '</b></span>' +
      '<span class="' + (over ? 'bad' : '') + '">' + T('gs.bridge.hudBudget') + ' <b>' + Math.round(usedCost()) + '/' + Math.round(budget) + '</b></span>' +
      '<span>' + T('gs.bridge.hudWeight') + ' <b>' + Math.round(weight) + '</b></span>' +
      '<span>' + T('gs.bridge.hudNodes') + ' <b>' + playerNodeCount() + '/' + maxNodes + '</b></span>' +
      '<span>' + T('gs.bridge.hudMat') + ' <b>' + matName + '</b></span>';
  }
  function say(text, color) {
    msgEl.textContent = text;
    msgEl.style.color = color || 'var(--neon-green)';
  }
  function setTool(t) {
    tool = t;
    buildBtn.classList.toggle('active', t === 'build');
    delBtn.classList.toggle('active', t === 'delete');
  }
  function hideOverlays() {
    resultOv.classList.add('hidden');
    levelsOv.classList.add('hidden');
  }
  function showOverlay(el) { el.classList.remove('hidden'); }

  function snapshot() {
    undoStack.push({
      nodes: nodes.map(function (n) { return { x: n.x, y: n.y, fixed: n.fixed }; }),
      beams: beams.map(function (b) { return { a: b.a, b: b.b, mat: b.mat }; }),
      tool: tool
    });
    if (undoStack.length > 40) undoStack.shift();
  }
  function undo() {
    if (phase !== 'build') return;
    if (!undoStack.length) { say(T('gs.bridge.nothingUndo'), 'var(--text-dim)'); return; }
    var s = undoStack.pop();
    nodes = s.nodes.map(function (n) { return { x: n.x, y: n.y, fixed: n.fixed }; });
    beams = s.beams.map(function (b) { return { a: b.a, b: b.b, mat: b.mat }; });
    dragFrom = null;
    recalc(); refreshHUD();
    say(T('gs.bridge.undone'), 'var(--neon-cyan)');
  }

  function nearestNode(x, y) {
    var best = -1, bd = HIT_NODE;
    for (var i = 0; i < nodes.length; i++) {
      var d = Math.sqrt((nodes[i].x - x) * (nodes[i].x - x) + (nodes[i].y - y) * (nodes[i].y - y));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function nearestBeam(x, y) {
    var best = -1, bd = HIT_BEAM;
    for (var i = 0; i < beams.length; i++) {
      var d = pointSegDist(x, y, nodes[beams[i].a], nodes[beams[i].b]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function pointSegDist(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) return Math.sqrt((px - a.x) * (px - a.x) + (py - a.y) * (py - a.y));
    var t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / L2));
    var qx = a.x + t * dx, qy = a.y + t * dy;
    return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
  }

  function addNode(x, y) {
    if (playerNodeCount() >= maxNodes) {
      say(T('gs.bridge.nodeLimit'), 'var(--neon-pink)');
      return -1;
    }
    var nx = Math.max(16, Math.min(W - 16, Math.round(x / SNAP) * SNAP));
    var ny = Math.max(48, Math.min(H - 24, Math.round(y / SNAP) * SNAP));
    for (var i = 0; i < nodes.length; i++) {
      if (Math.abs(nodes[i].x - nx) < 6 && Math.abs(nodes[i].y - ny) < 6) return i;
    }
    nodes.push({ x: nx, y: ny, fixed: false });
    recalc(); refreshHUD();
    return nodes.length - 1;
  }
  function removeNode(idx) {
    if (idx < 0 || nodes[idx].fixed) return false;
    nodes.splice(idx, 1);
    var keep = [];
    beams.forEach(function (b) {
      if (b.a === idx || b.b === idx) return;
      keep.push({ a: b.a > idx ? b.a - 1 : b.a, b: b.b > idx ? b.b - 1 : b.b, mat: b.mat });
    });
    beams = keep;
    recalc();
    return true;
  }
  function addBeam(a, b, mat) {
    if (a === b) return false;
    var len = PHYS.lengthOf(nodes[a], nodes[b]);
    if (len < MIN_BEAM) { say(T('gs.bridge.tooShort'), 'var(--neon-pink)'); return false; }
    for (var i = 0; i < beams.length; i++) {
      if ((beams[i].a === a && beams[i].b === b) || (beams[i].a === b && beams[i].b === a)) {
        say(T('gs.bridge.duplicate'), 'var(--neon-yellow)'); return false;
      }
    }
    var extra = len * MAT[mat].cost;
    if (usedCost() + extra > budget + 0.01) {
      say(T('gs.bridge.overBudget').replace('{c}', String(Math.round(extra))), 'var(--neon-pink)');
      return false;
    }
    beams.push({ a: a, b: b, mat: mat });
    recalc(); refreshHUD();
    return true;
  }

  /* ---------------- 材质栏 ---------------- */
  function refreshMatbar() {
    matbar.innerHTML = '';
    ['wood', 'steel', 'cable'].forEach(function (k) {
      var m = MAT[k];
      var b = document.createElement('button');
      b.className = 'br-mat' + (material === k ? ' active' : '');
      b.setAttribute('data-mat', k);
      b.innerHTML = '<i style="background:' + m.color + '"></i>' +
        '<span>' + matLabel(k) + '</span>' +
        '<em>' + (Math.round(m.cost * 1000) / 10) + '/100px · ' + (m.tensionOnly ? T('gs.bridge.tensionOnly') : T('gs.bridge.tensionOk')) + '</em>';
      b.addEventListener('click', function () {
        material = k;
        refreshMatbar();
        refreshHUD();
        say(T('gs.bridge.materialSel').replace('{m}', matLabel(k)), m.color);
        if (Arcade.audio) Arcade.audio.play('ui');
      });
      matbar.appendChild(b);
    });
  }

  /* ---------------- 指针交互 ---------------- */
  function pointerWorld(ev) { return GK.pointer(canvas, ev); }

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  canvas.addEventListener('pointerdown', function (e) {
    if (phase !== 'build') return;
    if (e.button === 2) { /* 右键删除 */
      var p0 = pointerWorld(e);
      snapshot();
      var bi = nearestBeam(p0.x, p0.y);
      if (bi >= 0) { beams.splice(bi, 1); recalc(); say(T('gs.bridge.beamDeleted'), 'var(--text-dim)'); return; }
      var ni = nearestNode(p0.x, p0.y);
      if (ni >= 0 && removeNode(ni)) { say(T('gs.bridge.nodeDeleted'), 'var(--text-dim)'); return; }
      return;
    }
    e.preventDefault();
    var p = pointerWorld(e);
    if (tool === 'delete') {
      snapshot();
      var bi2 = nearestBeam(p.x, p.y);
      var did = false;
      if (bi2 >= 0) { beams.splice(bi2, 1); did = true; }
      else {
        var ni2 = nearestNode(p.x, p.y);
        if (ni2 >= 0 && removeNode(ni2)) did = true;
      }
      if (did) { recalc(); if (Arcade.audio) Arcade.audio.play('ui'); say(T('gs.bridge.removed'), 'var(--text-dim)'); }
      else { undoStack.pop(); say(T('gs.bridge.nothingRemove'), 'var(--text-dim)'); }
      return;
    }
    var hit = nearestNode(p.x, p.y);
    if (hit < 0) {
      snapshot();
      hit = addNode(p.x, p.y);
      if (hit < 0) { undoStack.pop(); return; }
    }
    dragFrom = hit;
    dragPos = p;
    dragMoved = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (Arcade.audio) Arcade.audio.play('click');
  });

  canvas.addEventListener('pointermove', function (e) {
    if (phase !== 'build') return;
    var p = pointerWorld(e);
    hover.x = p.x; hover.y = p.y; hover.on = true;
    hover.node = nearestNode(p.x, p.y);
    hover.beam = nearestBeam(p.x, p.y);
    if (dragFrom != null) {
      dragPos = p;
      dragMoved = dragMoved || Math.abs(p.x - dragPos.x) + Math.abs(p.y - dragPos.y) > 2;
    }
  });

  canvas.addEventListener('pointerleave', function () {
    hover.on = false; hover.node = -1; hover.beam = -1;
    if (dragFrom == null) dragPos = null;
  });

  function finishDrag(e) {
    if (phase !== 'build' || dragFrom == null) return;
    var p = pointerWorld(e);
    var target = nearestNode(p.x, p.y);
    if (target >= 0 && target !== dragFrom && addBeam(dragFrom, target, material)) {
      if (Arcade.audio) Arcade.audio.play('drop');
      say(T('gs.bridge.beamBuilt').replace('{m}', matLabel(material)), MAT[material].color);
    }
    dragFrom = null; dragPos = null; dragMoved = false;
  }
  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', function () { dragFrom = null; dragPos = null; });

  /* ---------------- 试跑 ---------------- */
  function eligibleBeams() {
    var limit = Math.max(nodes[0].y, nodes[1].y) + 38;
    var out = [];
    beams.forEach(function (b, i) {
      if (b.broken) return;
      var my = (nodes[b.a].y + nodes[b.b].y) / 2;
      if (my <= limit) out.push(i);
    });
    return out;
  }
  function findDeckPath() {
    var n = nodes.length, adj = [];
    for (var i = 0; i < n; i++) adj[i] = [];
    eligibleBeams().forEach(function (bi) {
      var b = beams[bi];
      adj[b.a].push({ to: b.b, beam: bi });
      adj[b.b].push({ to: b.a, beam: bi });
    });
    var prev = new Array(n).fill(-2);
    prev[0] = -1;
    var q = [0];
    while (q.length) {
      var cur = q.shift();
      if (cur === 1) break;
      for (var k = 0; k < adj[cur].length; k++) {
        var nb = adj[cur][k].to;
        if (prev[nb] === -2) { prev[nb] = cur; q.push(nb); }
      }
    }
    if (prev[1] === -2) return null;
    var path = [], at = 1;
    while (at !== -1) { path.unshift(at); at = prev[at]; }
    return path;
  }
  function pathSegments(path) {
    var segs = [], total = 0;
    for (var i = 0; i < path.length - 1; i++) {
      var a = path[i], b = path[i + 1];
      var len = PHYS.lengthOf(nodes[a], nodes[b]);
      segs.push({ a: a, b: b, start: total, len: len });
      total += len;
    }
    return { segs: segs, total: total };
  }

  function startTest() {
    if (phase === 'test') return;
    if (!beams.length) { say(T('gs.bridge.needBridge'), 'var(--neon-pink)'); return; }
    var path = findDeckPath();
    if (!path || path.length < 2) {
      showResult(false, 'nopath', {});
      return;
    }
    var info = pathSegments(path);
    if (info.total < 20) { say(T('gs.bridge.needBridge'), 'var(--neon-pink)'); return; }
    var res = solveAt(info.segs, 0, 0);
    if (res.unstable) {
      var reason = (res.slack && res.slack.length) ? 'slack' : 'unstable';
      showResult(false, reason, { res: res, path: path });
      return;
    }
    phase = 'test';
    test = {
      path: path, segs: info.segs, total: info.total, dist: 0,
      elapsed: 0, px: nodes[path[0]].x, py: nodes[path[0]].y,
      defl: 0, ratio: 0, res: res, _seg: res._seg, _t: res._t
    };
    result = null; lastResult = res;
    hideOverlays();
    updateControls();
    say(T('gs.bridge.testing'), 'var(--neon-cyan)');
    if (Arcade.audio) Arcade.audio.play('start');
  }

  function solveAt(segs, dist, ti) {
    var seg = segs[0];
    for (var i = 0; i < segs.length; i++) {
      if (dist <= segs[i].start + segs[i].len + 1e-9) { seg = segs[i]; break; }
    }
    var t = ti;
    if (t === undefined) t = seg.len > 0 ? (dist - seg.start) / seg.len : 0;
    t = Math.max(0, Math.min(1, t));
    var loads = [];
    PHYS.distributeLoad(loads, seg.a, seg.b, weight, t);
    var res = PHYS.solve({ nodes: nodes, members: beams, loads: loads, selfWeight: true });
    res._seg = seg; res._t = t;
    return res;
  }

  function updateHUDDuringTest(res) {
    if (!res || res.unstable) return;
    var span = Math.round(test.total);
    var pct = test.dist / test.total;
    hud.innerHTML =
      '<span>' + (mode === 'editor' ? T('gs.bridge.editorTitle') : T(LEVELS[levelIdx].name)) + '</span>' +
      '<span>' + T('gs.bridge.hudStress') + ' <b>' + Math.round(Math.max.apply(null, res.ratio) * 100) + '%</b></span>' +
      '<span>' + T('gs.bridge.hudDeflect') + ' <b>' + res.maxDeflection.toFixed(1) + '</b></span>' +
      '<span>' + T('gs.bridge.hudBudget') + ' <b>' + Math.round(usedCost()) + '/' + Math.round(budget) + '</b></span>' +
      '<span>' + T('gs.bridge.hudCross') + ' <b>' + Math.round(pct * 100) + '%</b></span>';
  }

  function breakBeam(bi, res) {
    var b = beams[bi];
    if (!b || b.broken) return;
    b.broken = true;
    var a = nodes[b.a], c = nodes[b.b];
    var mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
    fx.push({ x: mx, y: my, t: 0, color: '#ff5b3a' });
    var cp = GK.toClient(canvas, mx, my);
    if (Arcade.fx) {
      Arcade.fx.burst(cp.x, cp.y, '#ff5b3a', 26);
      Arcade.fx.burst(cp.x, cp.y, '#ffe600', 14);
      Arcade.fx.shake(canvas);
    }
    if (Arcade.audio) Arcade.audio.play('lose');
    if (Arcade.juice) Arcade.juice.lose();
    var ratio = res && res.ratio ? res.ratio[bi] : 1;
    showResult(false, 'break', { res: res, beam: bi, ratio: ratio });
  }

  function finishWin(res) {
    var elapsed = test ? test.elapsed : 0;
    phase = 'result';
    test = null;
    lastResult = res;
    var stats = buildStats(res, elapsed);
    result = { win: true, stats: stats };
    if (mode === 'level') {
      var cost = Math.round(usedCost());
      cleared[levelIdx] = true;
      try { localStorage.setItem(CLEAR_KEY, JSON.stringify(cleared)); } catch (e) {}
      var old = bestLevels[String(levelIdx)];
      if (!old || cost < old) {
        bestLevels[String(levelIdx)] = cost;
        try { localStorage.setItem(BEST_KEY, JSON.stringify(bestLevels)); } catch (e) {}
      }
      if (Arcade.shell) Arcade.shell.submitScore(cost);
    }
    if (Arcade.audio) Arcade.audio.play('win');
    if (Arcade.juice) Arcade.juice.win();
    if (Arcade.fx) { Arcade.fx.centerBurst('#39ff14', 34); Arcade.fx.flash('rgba(57,255,20,0.12)'); }
    showResult(true, null, { res: res, stats: stats });
  }

  function buildStats(res, elapsed) {
    var counts = { wood: 0, steel: 0, cable: 0 };
    beams.forEach(function (b) { counts[b.mat] = (counts[b.mat] || 0) + 1; });
    var cost = Math.round(usedCost());
    var vals = (res && res.ratio) ? res.ratio.filter(function (v) { return isFinite(v); }) : [];
    var maxRatio = vals.length ? Math.max.apply(null, vals) : 0;
    return {
      cost: cost, beams: beams.length, counts: counts,
      time: elapsed !== undefined ? elapsed : (test ? test.elapsed : 0),
      defl: res && isFinite(res.maxDeflection) ? res.maxDeflection : 0,
      safety: maxRatio
    };
  }

  function showResult(win, reason, data) {
    phase = 'result';
    lastResult = data.res || lastResult;
    var st = data.stats || buildStats(data.res);
    result = { win: !!win, stats: st, reason: reason || null };
    if (win) {
      resTitle.textContent = mode === 'editor' ? T('gs.bridge.editorPass') : T('gs.bridge.winTitle');
      resTitle.className = 'br-title win';
    } else {
      resTitle.textContent = T('gs.bridge.failTitle');
      resTitle.className = 'br-title fail';
    }
    var reasonKey = {
      nopath: 'gs.bridge.failNoPath', unstable: 'gs.bridge.failUnstable',
      slack: 'gs.bridge.failSlack', break: 'gs.bridge.failBreak',
      deflection: 'gs.bridge.failDeflect'
    }[reason];
    var breakdown = T('gs.bridge.matBreakdown')
      .replace('{w}', String(st.counts.wood || 0))
      .replace('{s}', String(st.counts.steel || 0))
      .replace('{c}', String(st.counts.cable || 0));
    var hint = reason ? T('gs.bridge.failHint') : (mode === 'level' && win && cleared.every(Boolean) ? T('gs.bridge.allClear') : '');
    resStats.innerHTML =
      '<div>' + (win ? T('gs.bridge.safeArrive') : T(reasonKey)) + '</div>' +
      (hint ? '<div class="br-tip">' + hint + '</div>' : '') +
      '<div>' + T('gs.bridge.resTime') + ' <b>' + st.time.toFixed(1) + 's</b></div>' +
      '<div>' + T('gs.bridge.resCost') + ' <b>' + st.cost + '</b> / ' + Math.round(budget) + '</div>' +
      '<div>' + T('gs.bridge.resBeams') + ' <b>' + st.beams + '</b> · ' + breakdown + '</div>' +
      '<div>' + T('gs.bridge.resDefl') + ' <b>' + st.defl.toFixed(1) + ' px</b> · ' +
        T('gs.bridge.resStress') + ' <b>' + Math.round(st.safety * 100) + '%</b></div>' +
      (win && mode === 'level' ? '<div class="br-tip">' + T('gs.bridge.bestLevel').replace('{n}', String(bestLevels[String(levelIdx)] || st.cost)) + '</div>' : '');
    resBtns.innerHTML = '';
    if (mode === 'editor') {
      addResBtn('br-btn green', T('gs.bridge.continueEdit'), function () { resetTestState(); phase = 'build'; hideOverlays(); updateControls(); say(T('gs.bridge.editorStart'), 'var(--neon-yellow)'); });
      addResBtn('br-btn', T('gs.bridge.retry'), function () { resetTestState(); startTest(); });
    } else if (win) {
      addResBtn('br-btn green', T('gs.bridge.nextLevel'), function () {
        if (levelIdx < LEVELS.length - 1) loadLevel(levelIdx + 1);
        else loadLevel(0);
      });
      addResBtn('br-btn', T('gs.bridge.retry'), function () { resetTestState(); startTest(); });
      addResBtn('br-btn', T('gs.bridge.levels'), function () { hideOverlays(); openLevels(); });
    } else {
      addResBtn('br-btn green', T('gs.bridge.retry'), function () { resetTestState(); startTest(); });
      addResBtn('br-btn', T('gs.bridge.backEdit'), function () { resetTestState(); phase = 'build'; hideOverlays(); updateControls(); say(T('gs.bridge.repair'), 'var(--neon-yellow)'); });
      addResBtn('br-btn', T('gs.bridge.levels'), function () { hideOverlays(); openLevels(); });
    }
    showOverlay(resultOv);
    updateControls();
    refreshHUD();
  }
  function addResBtn(cls, label, fn) {
    var b = document.createElement('button');
    b.className = cls; b.textContent = label;
    b.addEventListener('click', function () {
      if (Arcade.audio) Arcade.audio.play('ui');
      fn();
    });
    resBtns.appendChild(b);
  }
  function resetTestState() {
    phase = 'build'; test = null; result = null; lastResult = null;
    beams.forEach(function (b) { b.broken = false; });
    dragFrom = null; dragPos = null;
    recalc();
  }

  /* ---------------- 关卡选择 ---------------- */
  function openLevels() {
    lvGrid.innerHTML = '';
    LEVELS.forEach(function (lv, i) {
      var b = document.createElement('button');
      b.className = 'br-lv' + (mode === 'level' && i === levelIdx ? ' cur' : '') + (cleared[i] ? ' done' : '');
      var span = Math.round(PHYS.lengthOf(lv.L, lv.R));
      b.innerHTML = '<span class="br-lv-n">LV ' + (i + 1) + '</span>' +
        '<span class="br-lv-l">' + T(lv.name) + '</span>' +
        '<span class="br-lv-m">' + T('gs.bridge.lvMeta')
          .replace('{s}', String(span)).replace('{b}', String(lv.budget)).replace('{w}', String(lv.weight)) + '</span>' +
        '<span class="br-lv-m">' + (cleared[i] ? T('gs.bridge.clearedTag') + ' · ' + T('gs.bridge.bestShort').replace('{n}', String(bestLevels[String(i)] || '-')) : T('gs.bridge.notCleared')) + '</span>';
      b.addEventListener('click', function () {
        hideOverlays();
        loadLevel(i);
        if (Arcade.audio) Arcade.audio.play('ui');
      });
      lvGrid.appendChild(b);
    });
    levelsOv.classList.remove('hidden');
  }

  /* ---------------- 编辑器保存/读取 ---------------- */
  function saveEditor() {
    if (mode !== 'editor') return;
    var anchor = nodes.slice(0, 2).map(function (n) { return { x: n.x, y: n.y }; });
    var supports = [];
    nodes.forEach(function (n) { if (n.fixed && n !== nodes[0] && n !== nodes[1]) supports.push({ x: n.x, y: n.y }); });
    var free = nodes.filter(function (n) { return !n.fixed; }).map(function (n) { return { x: n.x, y: n.y }; });
    var data = {
      v: 1, L: anchor[0], R: anchor[1], supports: supports,
      nodes: free, beams: beams.map(function (b) { return { a: b.a, b: b.b, mat: b.mat }; }),
      budget: budget, weight: weight, maxNodes: maxNodes
    };
    try {
      localStorage.setItem(EDIT_KEY, JSON.stringify(data));
      say(T('gs.bridge.saved'), 'var(--neon-green)');
      if (Arcade.ui) Arcade.ui.toast(T('gs.bridge.saved'), 'win');
    } catch (e) { say(T('gs.bridge.saveFail'), 'var(--neon-pink)'); }
  }
  function loadEditor() {
    if (mode !== 'editor') return;
    try {
      var d = JSON.parse(localStorage.getItem(EDIT_KEY) || 'null');
      if (!d || !d.L || !d.R || !Array.isArray(d.nodes) || !Array.isArray(d.beams)) {
        say(T('gs.bridge.noSave'), 'var(--neon-yellow)'); return;
      }
      nodes = [fixedNode(d.L.x, d.L.y), fixedNode(d.R.x, d.R.y)];
      (d.supports || []).forEach(function (s) { nodes.push(fixedNode(s.x, s.y)); });
      d.nodes.forEach(function (n) { nodes.push({ x: n.x, y: n.y, fixed: false }); });
      beams = d.beams.filter(function (b) {
        return b && b.a >= 0 && b.a < nodes.length && b.b >= 0 && b.b < nodes.length && MAT[b.mat];
      }).map(function (b) { return { a: b.a, b: b.b, mat: b.mat }; });
      budget = Number(d.budget) || 220;
      weight = Number(d.weight) || 300;
      maxNodes = Number(d.maxNodes) || 30;
      undoStack = [];
      phase = 'build'; test = null; lastResult = null; hideOverlays();
      recalc(); refreshHUD();
      say(T('gs.bridge.loaded').replace('{n}', String(nodes.length)), 'var(--neon-green)');
      if (Arcade.ui) Arcade.ui.toast(T('gs.bridge.loaded').replace('{n}', String(nodes.length)), 'info');
    } catch (e) { say(T('gs.bridge.loadFail'), 'var(--neon-pink)'); }
  }

  /* ---------------- 控制 ---------------- */
  function updateControls() {
    var testing = phase === 'test';
    [buildBtn, delBtn, wrap.querySelector('#br-undo-btn')].forEach(function (b) { b.disabled = testing; });
    testBtn.disabled = testing;
    wrap.querySelector('#br-editor').disabled = testing;
    wrap.querySelector('#br-restart').disabled = testing;
    wrap.querySelector('#br-levels-btn').disabled = testing;
    editorbar.style.display = mode === 'editor' ? 'flex' : 'none';
    wrap.querySelector('#br-editor').style.display = mode === 'editor' ? 'none' : '';
  }

  buildBtn.addEventListener('click', function () { if (phase === 'build') setTool('build'); });
  delBtn.addEventListener('click', function () { if (phase === 'build') setTool('delete'); });
  wrap.querySelector('#br-undo-btn').addEventListener('click', undo);
  wrap.querySelector('#br-test').addEventListener('click', startTest);
  wrap.querySelector('#br-editor').addEventListener('click', function () {
    enterEditor();
    if (Arcade.audio) Arcade.audio.play('ui');
  });
  wrap.querySelector('#br-levels-btn').addEventListener('click', openLevels);
  wrap.querySelector('#br-save').addEventListener('click', saveEditor);
  wrap.querySelector('#br-load').addEventListener('click', loadEditor);
  wrap.querySelector('#br-clear').addEventListener('click', function () {
    if (phase !== 'build') return;
    snapshot();
    beams = [];
    nodes = nodes.filter(function (n) { return n.fixed; });
    recalc(); refreshHUD();
    say(T('gs.bridge.msgCleared'), 'var(--text-dim)');
  });
  wrap.querySelector('#br-exit-editor').addEventListener('click', function () { loadLevel(levelIdx); });
  wrap.querySelector('#br-restart').addEventListener('click', function () {
    if (phase !== 'build') return;
    snapshot();
    beams = [];
    nodes = nodes.filter(function (n) { return n.fixed; });
    recalc(); refreshHUD();
    say(T('gs.bridge.restarted'), 'var(--text-dim)');
  });
  wrap.querySelector('#br-lv-close').addEventListener('click', function () { levelsOv.classList.add('hidden'); });
  wrap.querySelector('#br-lv-editor').addEventListener('click', function () { enterEditor(); });

  /* ---------------- 键盘 ---------------- */
  window.addEventListener('keydown', function (e) {
    var tag = ((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    if (e.code === 'KeyZ') { undo(); e.preventDefault(); }
    else if (e.code === 'KeyR') {
      if (phase === 'build') wrap.querySelector('#br-restart').click();
      e.preventDefault();
    } else if (e.code === 'KeyT') { startTest(); e.preventDefault(); }
    else if (e.code === 'KeyE') { enterEditor(); e.preventDefault(); }
    else if (e.code === 'Digit1') { material = 'wood'; refreshMatbar(); refreshHUD(); }
    else if (e.code === 'Digit2') { material = 'steel'; refreshMatbar(); refreshHUD(); }
    else if (e.code === 'Digit3') { material = 'cable'; refreshMatbar(); refreshHUD(); }
  });

  /* ---------------- 绘制 ---------------- */
  function camera() {
    if (phase === 'test' && test) {
      var s = 1.16;
      var tx = GK.clamp(W / 2 - test.px * s, W - W * s, 0);
      var ty = H * 0.60 - 228 * s;
      return { s: s, tx: tx, ty: ty };
    }
    return { s: 1, tx: 0, ty: 0 };
  }

  function drawSky(t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1230');
    g.addColorStop(0.55, '#071026');
    g.addColorStop(1, '#03050f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var a = st.a + Math.sin(t * 1.4 + i) * 0.16;
      ctx.fillStyle = 'rgba(190,235,255,' + Math.max(0.08, a) + ')';
      ctx.fillRect(st.x, st.y, 2, 2);
    }
    /* 月亮 */
    ctx.save();
    ctx.shadowColor = '#8fe9ff'; ctx.shadowBlur = 24;
    ctx.fillStyle = '#b7f3ff';
    ctx.beginPath(); ctx.arc(520, 72, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(0,10,25,0.35)';
    ctx.beginPath(); ctx.arc(530, 66, 20, 0, Math.PI * 2); ctx.fill();
  }

  function drawScene(t) {
    /* 水面 */
    var wg = ctx.createLinearGradient(0, 330, 0, H);
    wg.addColorStop(0, 'rgba(10,40,70,0.55)');
    wg.addColorStop(1, 'rgba(3,10,24,0.95)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 330, W, H - 330);
    for (var wy = 0; wy < 4; wy++) {
      ctx.strokeStyle = 'rgba(0,220,255,' + (0.10 + wy * 0.02) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var wx = 0; wx <= W; wx += 10) {
        var yy = 352 + wy * 14 + Math.sin((wx / 40) + t * 1.1 + wy) * 2.2;
        if (wx === 0) ctx.moveTo(wx, yy); else ctx.lineTo(wx, yy);
      }
      ctx.stroke();
    }

    /* 两岸悬崖 */
    drawCliff(0, nodes[0].x + 34, nodes[0].y);
    drawCliff(W, nodes[1].x - 34, nodes[1].y);

    /* 固定支撑（桥墩） */
    for (var i = 2; i < nodes.length; i++) {
      if (!nodes[i].fixed) break;
      drawPier(nodes[i], i - 2);
    }

    /* 建造网格 */
    if (phase === 'build') drawGrid();

    /* 参考/结构杆件 */
    for (var bi = 0; bi < beams.length; bi++) drawBeam(bi, t);

    /* 拖拽预览 */
    if (dragFrom != null && dragPos) {
      var a = nodes[dragFrom];
      var bx = Math.round(dragPos.x / SNAP) * SNAP, by = Math.round(dragPos.y / SNAP) * SNAP;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(0,240,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
      var extraCost = Math.round(PHYS.lengthOf(a, { x: bx, y: by }) * MAT[material].cost);
      ctx.font = '10px monospace';
      ctx.fillStyle = usedCost() + extraCost > budget + 0.01 ? '#ff4d6d' : '#ffe600';
      ctx.fillText('+' + extraCost, bx + 8, by - 8);
    }

    /* 节点 */
    for (var ni = 0; ni < nodes.length; ni++) drawNode(ni, t);

    /* 车辆 */
    if (phase === 'test' && test) drawVehicle(t);

    /* 火花 */
    drawFx(t);
  }

  function drawCliff(edgeX, topX, topY) {
    ctx.save();
    ctx.fillStyle = '#0b1a25';
    ctx.strokeStyle = 'rgba(0,240,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(edgeX, H);
    ctx.lineTo(edgeX, topY + 50);
    ctx.lineTo(topX, topY + 14);
    ctx.lineTo(topX, H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    /* 崖壁纹理 */
    ctx.strokeStyle = 'rgba(0,240,255,0.08)';
    for (var k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(edgeX + (topX - edgeX) * 0.15, topY + 70 + k * 32);
      ctx.lineTo(topX - (topX - edgeX) * 0.05, topY + 80 + k * 30);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPier(n, idx) {
    ctx.save();
    ctx.fillStyle = 'rgba(35,60,80,0.85)';
    ctx.strokeStyle = 'rgba(0,240,255,0.35)';
    ctx.lineWidth = 1;
    GK.roundRect(ctx, n.x - 11, n.y - 4, 22, H - n.y + 4, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,255,0.55)';
    ctx.fillRect(n.x - 14, n.y - 7, 28, 4);
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(140,220,255,0.55)';
    ctx.fillText('P' + (idx + 1), n.x - 7, n.y + 40);
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,240,255,0.10)';
    for (var x = 20; x < W; x += SNAP) {
      for (var y = 60; y < 320; y += SNAP) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    ctx.restore();
  }

  function stressColor(ratio) {
    if (ratio < 0.45) return '#39ff14';
    if (ratio < 0.75) return '#ffe600';
    if (ratio < 1.0) return '#ff9f1c';
    return '#ff2d55';
  }

  function drawBeam(bi, t) {
    var b = beams[bi];
    var a = nodes[b.a], c = nodes[b.b];
    if (!a || !c) return;
    var m = MAT[b.mat];
    var isTest = phase === 'test' && lastResult && lastResult.ratio && lastResult.ratio[bi] !== undefined;
    var ratio = isTest ? lastResult.ratio[bi] : 0;
    var slack = lastResult && lastResult.slack && lastResult.slack.indexOf(bi) >= 0;
    var color = isTest ? stressColor(ratio) : m.color;
    if (slack) color = '#8a8f99';
    if (b.broken) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,60,90,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      ctx.restore();
      return;
    }
    var width = b.mat === 'cable' ? 2.2 : (b.mat === 'steel' ? 3.8 : 4.8);
    ctx.save();
    if (isTest && ratio > 0.75) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    var mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
    if (slack && b.mat === 'cable') {
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my + 14, c.x, c.y);
    } else {
      ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
    /* 内芯高光 */
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, width - 3);
    ctx.beginPath();
    if (slack && b.mat === 'cable') { ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my + 14, c.x, c.y); }
    else { ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); }
    ctx.stroke();
    ctx.restore();
    /* 应力标签（试跑时） */
    if (isTest && ratio > 0.55) {
      ctx.font = '8px monospace';
      ctx.fillStyle = color;
      ctx.fillText(Math.round(ratio * 100) + '%', mx + 4, my - 5);
    }
  }

  function drawNode(ni, t) {
    var n = nodes[ni];
    var du = lastResult && phase === 'test' ? lastResult.ux[ni] : 0;
    var dv = lastResult && phase === 'test' ? lastResult.uy[ni] : 0;
    var x = n.x + (isFinite(du) ? du : 0);
    var y = n.y + (isFinite(dv) ? dv : 0);
    var r = n.fixed ? 8 : 6;
    ctx.save();
    ctx.shadowColor = n.fixed ? '#ffe600' : '#00f0ff';
    ctx.shadowBlur = n.fixed ? 15 : 10;
    ctx.fillStyle = n.fixed ? '#ffe600' : '#63f6ff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(4,8,16,0.8)';
    ctx.beginPath(); ctx.arc(x, y, r - 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (n.fixed) {
      ctx.strokeStyle = 'rgba(255,230,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke();
    }
    if (phase === 'build' && hover.on && hover.node === ni) {
      ctx.strokeStyle = '#ff2d95';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawVehicle(t) {
    var seg = test._seg;
    var pos = vehiclePos(test, lastResult);
    var x = pos.x, y = pos.y;
    ctx.save();
    ctx.translate(x, y - 13);
    ctx.rotate(pos.angle || 0);
    /* 车灯光锥 */
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.moveTo(16, -2); ctx.lineTo(42, -12); ctx.lineTo(42, 10); ctx.lineTo(16, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    /* 车身 */
    ctx.fillStyle = '#12e0a0';
    ctx.shadowColor = '#12e0a0'; ctx.shadowBlur = 14;
    GK.roundRect(ctx, -20, -9, 38, 17, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#07202a';
    GK.roundRect(ctx, 2, -14, 14, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#63f6ff';
    ctx.fillRect(-16, -6, 15, 5);
    /* 车轮 */
    ctx.fillStyle = '#0a0a12';
    ctx.strokeStyle = '#63f6ff';
    ctx.lineWidth = 1.5;
    [-11, 10].forEach(function (wx) {
      ctx.beginPath(); ctx.arc(wx, 9, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
    /* 车辆重心向下的箭头（载荷可视化） */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,0,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x, y + 8); ctx.lineTo(x + 3, y + 4); ctx.stroke();
    ctx.restore();
  }

  function vehiclePos(ts, res) {
    var seg = ts._seg;
    var a = nodes[seg.a], b = nodes[seg.b];
    var ux = res && res.ux && isFinite(res.ux[seg.a]) ? res.ux : [];
    var uy = res && res.uy && isFinite(res.uy[seg.a]) ? res.uy : [];
    var ax = a.x + (ux[seg.a] || 0), ay = a.y + (uy[seg.a] || 0);
    var bx = b.x + (ux[seg.b] || 0), by = b.y + (uy[seg.b] || 0);
    var tt = ts._t;
    return {
      x: ax + (bx - ax) * tt,
      y: ay + (by - ay) * tt,
      angle: Math.atan2(by - ay, bx - ax)
    };
  }

  function drawFx(t) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i];
      f.t += 1 / 60;
      if (f.t > 0.7) { fx.splice(i, 1); continue; }
      var r = 4 + f.t * 26;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.t / 0.7);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function draw() {
    clock += 1 / 60;
    drawSky(clock);
    var cam = camera();
    ctx.save();
    ctx.translate(cam.tx, cam.ty);
    ctx.scale(cam.s, cam.s);
    drawScene(clock);
    ctx.restore();
  }

  /* ---------------- 主循环 ---------------- */
  function update(n) {
    if (phase !== 'test' || !test) return;
    var dt = (n / 60) * speedMul;
    test.elapsed += dt;
    test.dist += SPEED * dt;
    var res = solveAt(test.segs, Math.min(test.dist, test.total), undefined);
    test._seg = res._seg;
    test._t = res._t;
    lastResult = res;
    if (res.unstable) {
      var reason = (res.slack && res.slack.length) ? 'slack' : 'unstable';
      showResult(false, reason, { res: res });
      return;
    }
    test.defl = res.maxDeflection;
    test.ratio = res.ratio.length ? Math.max.apply(null, res.ratio.filter(function (v) { return isFinite(v); })) : 0;
    if (res.maxDeflection > DEFLECT_LIMIT) {
      showResult(false, 'deflection', { res: res });
      return;
    }
    for (var i = 0; i < res.ratio.length; i++) {
      if (isFinite(res.ratio[i]) && res.ratio[i] > 1.0) {
        breakBeam(i, res);
        return;
      }
    }
    var pos = vehiclePos(test, res);
    test.px = pos.x; test.py = pos.y;
    if (test.dist >= test.total) {
      finishWin(res);
      return;
    }
    if (Math.floor(test.dist) % 2 === 0) updateHUDDuringTest(res);
  }

  /* ---------------- 启动 ---------------- */
  loadLevel(0);
  Arcade.loop.start(update, draw, 16);

  window.GAME_RESTART = function () {
    if (mode === 'editor') { enterEditor(); return; }
    loadLevel(levelIdx);
  };

  /* 说明文字 */
  var help = document.createElement('div');
  help.style.cssText = 'font-size:11px;color:var(--text-dim);line-height:1.8;margin-top:10px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  help.innerHTML = T('gs.bridge.helpText');
  root.appendChild(help);

  /* ---------------- QA 钩子（仅 ?qa=1） ---------------- */
  if (QA) {
    window.__QA = {
      state: function () {
        return {
          mode: mode, levelIdx: levelIdx, phase: phase, tool: tool, material: material,
          budget: budget, weight: weight, maxNodes: maxNodes, used: usedCost(),
          nodes: nodes.map(function (n) { return { x: n.x, y: n.y, fixed: !!n.fixed }; }),
          beams: beams.map(function (b) { return { a: b.a, b: b.b, mat: b.mat, broken: !!b.broken }; }),
          cleared: cleared.slice(), bestLevels: bestLevels,
          result: result ? { win: result.win, stats: result.stats } : null,
          overlay: !resultOv.classList.contains('hidden'),
          test: test ? { dist: test.dist, total: test.total, defl: test.defl, ratio: test.ratio } : null
        };
      },
      setLevel: loadLevel,
      enterEditor: enterEditor,
      setMaterial: function (m) { if (MAT[m]) { material = m; refreshMatbar(); refreshHUD(); } },
      clear: function () {
        if (phase !== 'build') return false;
        beams = []; nodes = nodes.filter(function (n) { return n.fixed; });
        recalc(); refreshHUD(); return true;
      },
      addNode: function (x, y) { return addNode(x, y); },
      addBeam: function (a, b, m) { return addBeam(a, b, m || material); },
      loadSolution: function (idx) {
        loadLevel(idx);
        var ref = REF[idx];
        var off = 2 + LEVELS[idx].supports.length;
        undoStack = [];
        ref.deck.forEach(function (d) { nodes.push({ x: d.x, y: d.y, fixed: false }); });
        function nid(k) {
          if (k === 0) return 0;
          if (k === 1) return 1;
          if (typeof k === 'string' && k[0] === 'd') return off + parseInt(k.slice(1), 10);
          if (typeof k === 'string' && k[0] === 's') return 2 + parseInt(k.slice(1), 10);
          return k;
        }
        ref.beams.forEach(function (b) { addBeam(nid(b[0]), nid(b[1]), b[2]); });
        undoStack = [];
        recalc(); refreshHUD();
        return { used: usedCost(), beams: beams.length };
      },
      test: function () { startTest(); },
      setSpeed: function (x) { speedMul = Number(x) || 1; },
      reset: function () { resetTestState(); hideOverlays(); updateControls(); },
      solve: function () {
        var path = findDeckPath();
        if (!path) return { ok: false, reason: 'nopath' };
        var info = pathSegments(path);
        var r = solveAt(info.segs, info.total / 2, 0.5);
        return {
          ok: !r.unstable, unstable: r.unstable, slack: r.slack,
          maxDeflection: r.maxDeflection, maxRatio: Math.max.apply(null, r.ratio.filter(isFinite)),
          cost: usedCost(), path: path
        };
      },
      hit: function () {
        var rect = canvas.getBoundingClientRect();
        var k = rect.width / W;
        return { nodeDiameterCSS: HIT_NODE * 2 * k, beamWidthCSS: HIT_BEAM * 2 * k, canvasCSS: rect.width };
      },
      nodeClient: function (idx) {
        var p = GK.toClient(canvas, nodes[idx].x, nodes[idx].y);
        return { x: p.x, y: p.y, size: HIT_NODE * 2 * (canvas.getBoundingClientRect().width / W) };
      },
      buildUnstable: function () {
        loadLevel(0);
        var off = 2 + LEVELS[0].supports.length;
        nodes.push({ x: 180, y: 230, fixed: false });
        nodes.push({ x: 300, y: 230, fixed: false });
        nodes.push({ x: 420, y: 230, fixed: false });
        addBeam(0, off, 'wood');
        addBeam(off, off + 1, 'wood');
        addBeam(off + 1, off + 2, 'wood');
        addBeam(off + 2, 1, 'wood');
        startTest();
        return this.state();
      },
      editorSave: saveEditor,
      editorLoad: loadEditor,
      editorData: function () {
        try { return JSON.parse(localStorage.getItem(EDIT_KEY) || 'null'); } catch (e) { return null; }
      },
      levels: function () {
        return LEVELS.map(function (l, i) {
          return { idx: i, name: l.name, span: Math.round(PHYS.lengthOf(l.L, l.R)), budget: l.budget, weight: l.weight };
        });
      }
    };
  }
})();
