/* ============================================================
   切绳救星 Rope Rescue —— 旗舰版
   60 手写关 + 61 起程序化无限章 · Verlet 绳索 · 多锚点
   划切轨迹判定 · 危险物 · 安全网救援 · 断点续玩 · 章节分页
   ============================================================ */

(function () {
  'use strict';
  var root = document.getElementById('game-root');

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.roperescue.tut1t'), d: T('gs.roperescue.tut1') },
    { t: T('gs.roperescue.tut2t'), d: T('gs.roperescue.tut2') },
    { t: T('gs.roperescue.tut3t'), d: T('gs.roperescue.tut3') },
    { t: T('gs.roperescue.tut4t'), d: T('gs.roperescue.tut4') }
  ];

  var W = 540, H = 440;
  var CAMERA = { x: 270, y: 190 };
  var TOTAL = RopeLevels.count();
  var SAVE_ID = 'roperescue';
  var ARC = window.Arcade;

  root.innerHTML = [
    '<div class="cr-wrap" id="cr-wrap">',
    '  <div class="cr-top">',
    '    <span>' + T('gs.roperescue.hudLevel').replace('{n}', '<b id="cr-level">1</b>') + '</span>',
    '    <span>' + T('gs.roperescue.hudEaten') + ' <b id="cr-eaten">0/0</b></span>',
    '    <span>' + T('gs.roperescue.hudCuts') + ' <b id="cr-cuts">0/0</b></span>',
    '    <span>' + T('gs.roperescue.hudTime') + ' <b id="cr-time">0.0s</b></span>',
    '  </div>',
    '  <div class="cr-stage" id="cr-stage">',
    '    <canvas class="cr-canvas" id="cr-canvas"></canvas>',
    '    <div class="cr-screen" id="cr-start">',
    '      <div class="cr-chapters" id="cr-chapters"></div>',
    '      <div class="cr-screen-title">' + T('gs.roperescue.selectTitle') + '</div>',
    '      <div class="cr-level-grid" id="cr-levels"></div>',
    '      <div class="cr-screen-btns">',
    '        <button class="btn yellow" id="cr-daily">' + T('gs.roperescue.dailyBtn') + '</button>',
    '      </div>',
    '      <div class="cr-screen-sub" id="cr-select-sub">' + T('gs.roperescue.selectSub') + '</div>',
    '    </div>',
    '    <div class="cr-screen hidden" id="cr-result">',
    '      <div class="cr-screen-title" id="cr-res-title"></div>',
    '      <div class="cr-res-grid" id="cr-res-stats"></div>',
    '      <div class="cr-screen-btns">',
    '        <button class="btn green" id="cr-next">' + T('gs.roperescue.nextLevel') + '</button>',
    '        <button class="btn" id="cr-retry">' + T('gs.roperescue.retry') + '</button>',
    '        <button class="btn purple" id="cr-menu">' + T('gs.roperescue.levelSelect') + '</button>',
    '      </div>',
    '    </div>',
    '    <div class="cr-screen hidden" id="cr-paused">',
    '      <div class="cr-screen-title">' + T('gs.roperescue.paused') + '</div>',
    '      <div class="cr-screen-btns">',
    '        <button class="btn green" id="cr-resume">' + T('gs.roperescue.resume') + '</button>',
    '        <button class="btn purple" id="cr-quitmenu">' + T('gs.roperescue.levelSelect') + '</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="cr-tools" id="cr-tools">',
    '    <button class="cr-tool active" data-tool="cut"><i class="cr-ico cr-ico-cut"></i><span>' + T('gs.roperescue.toolCut') + '</span><em id="cr-tool-cut">0</em></button>',
    '    <button class="cr-tool" data-tool="freeze"><i class="cr-ico cr-ico-freeze"></i><span>' + T('gs.roperescue.toolFreeze') + '</span><em id="cr-tool-freeze">0</em></button>',
    '    <button class="cr-tool" data-tool="hook"><i class="cr-ico cr-ico-hook"></i><span>' + T('gs.roperescue.toolHook') + '</span><em id="cr-tool-hook">0</em></button>',
    '  </div>',
    '  <div class="cr-msg" id="cr-msg">' + T('gs.roperescue.help') + '</div>',
    '  <div class="game-controls">',
    '    <button class="btn" id="cr-pause">' + T('gs.roperescue.pause') + '</button>',
    '    <button class="btn purple" id="cr-restart">' + T('gs.roperescue.retry') + '</button>',
    '    <button class="btn yellow" id="cr-levels-btn">' + T('gs.roperescue.levelSelect') + '</button>',
    '  </div>',
    '</div>'
  ].join('');

  /* 章节 4（无尽）分页条：本目录 index.html 仅允许改 ?v=，因此分页 UI 由 JS 注入 */
  var pager = document.createElement('div');
  pager.id = 'cr-pager';
  pager.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;margin:2px 0 6px;flex-wrap:wrap';
  pager.innerHTML =
    '<button class="btn" id="cr-page-prev" style="min-width:86px;min-height:44px">' + T('gs.roperescue.pagePrev') + '</button>' +
    '<span id="cr-page-lbl" style="font-family:var(--font-pixel);font-size:10px;color:var(--text-dim);min-width:96px;text-align:center"></span>' +
    '<button class="btn" id="cr-page-next" style="min-width:86px;min-height:44px">' + T('gs.roperescue.pageNext') + '</button>';
  var levelsEl = document.getElementById('cr-levels');
  levelsEl.insertAdjacentElement('afterend', pager);

  var canvas = document.getElementById('cr-canvas');
  var info = GK.setup(canvas, W, H);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  var ctx = info.ctx;

  var els = {
    stage: document.getElementById('cr-stage'),
    top: document.querySelector('.cr-top'),
    level: document.getElementById('cr-level'),
    eaten: document.getElementById('cr-eaten'),
    cuts: document.getElementById('cr-cuts'),
    time: document.getElementById('cr-time'),
    msg: document.getElementById('cr-msg'),
    start: document.getElementById('cr-start'),
    result: document.getElementById('cr-result'),
    paused: document.getElementById('cr-paused'),
    resTitle: document.getElementById('cr-res-title'),
    resStats: document.getElementById('cr-res-stats'),
    next: document.getElementById('cr-next'),
    retry: document.getElementById('cr-retry'),
    menu: document.getElementById('cr-menu'),
    resume: document.getElementById('cr-resume'),
    quit: document.getElementById('cr-quitmenu'),
    restart: document.getElementById('cr-restart'),
    pause: document.getElementById('cr-pause'),
    levelsBtn: document.getElementById('cr-levels-btn'),
    levels: document.getElementById('cr-levels'),
    chapters: document.getElementById('cr-chapters'),
    pager: pager,
    pagePrev: document.getElementById('cr-page-prev'),
    pageNext: document.getElementById('cr-page-next'),
    pageLbl: document.getElementById('cr-page-lbl'),
    controls: root.querySelector('.game-controls'),
    daily: document.getElementById('cr-daily'),
    selectSub: document.getElementById('cr-select-sub'),
    tools: document.getElementById('cr-tools'),
    toolCut: document.getElementById('cr-tool-cut'),
    toolFreeze: document.getElementById('cr-tool-freeze'),
    toolHook: document.getElementById('cr-tool-hook')
  };

  /* ---------------- 状态 ---------------- */
  var state = 'menu';            /* menu | playing | won | lost */
  var paused = false;
  var isDaily = false;
  var levelNo = 1;
  var level = null;              /* RopeLevels 数据 */
  var world = null;              /* RopePhysics 世界 */
  var cutsUsed = 0;
  var toolStock = { freeze: 0, hook: 0 };
  var activeTool = 'cut';
  var levelStart = 0, pausedAt = 0, pausedTotal = 0, frozenElapsed = 0;
  var trail = [], sparks = [], floats = [], shakeAmt = 0;
  var dragStart = null, dragPrev = null, dragging = false, movedDist = 0;
  var cursor = { x: 270, y: 200, on: false };
  var lastHud = {};
  var chapterIdx = 0;
  var chapterPage = 0;
  var lastDraw = 0;
  var loopApi = null;
  var lastResult = null;

  var progress = {
    level: 1,
    cleared: {},
    levelBest: {},
    career: 0,
    dailyDate: '',
    dailyDone: false
  };
  var pendingRun = null;

  var stars = [];
  for (var si = 0; si < 44; si++) {
    stars.push({ x: (si * 97) % W, y: (si * 53) % 240, r: si % 5 === 0 ? 1.6 : 1, tw: si * 0.7 });
  }

  function elapsedMs() {
    if (!levelStart) return 0;
    if (paused) return frozenElapsed;
    return Math.max(0, Date.now() - levelStart - pausedTotal);
  }
  function remainingMs() {
    if (!level) return 0;
    return Math.max(0, level.timeLimit * 1000 - elapsedMs());
  }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function toast(m, type) { if (ARC.ui && ARC.ui.toast) ARC.ui.toast(m, type || 'ok'); }
  /* .btn/.cr-tools 自带 display，hidden 属性会被样式覆盖，统一用 .hidden 类 */
  function setHidden(el, hideIt) {
    if (!el) return;
    if (hideIt) el.classList.add('hidden'); else el.classList.remove('hidden');
  }
  function setControls(on) {
    setHidden(els.controls, !on);
  }

  /* ---------------- 存档进度 ---------------- */
  function calcCareer() {
    var sum = 0;
    for (var k in progress.levelBest) {
      if (Object.prototype.hasOwnProperty.call(progress.levelBest, k)) sum += (progress.levelBest[k] || 0);
    }
    return sum;
  }

  function collectSave() {
    var run = null;
    if (state === 'playing' && world && level) {
      run = {
        level: levelNo,
        daily: isDaily,
        elapsed: elapsedMs(),
        cutsUsed: cutsUsed,
        tools: { freeze: toolStock.freeze, hook: toolStock.hook },
        activeTool: activeTool,
        world: RopePhysics.snapshot(world)
      };
    }
    return {
      v: 2,
      level: progress.level,
      cleared: progress.cleared,
      levelBest: progress.levelBest,
      career: calcCareer(),
      dailyDate: progress.dailyDate,
      dailyDone: progress.dailyDone,
      run: run,
      savedAt: Date.now()
    };
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    /* 兼容旧档：只认 level 字段也接受；无尽章允许 >60，不再 clamp */
    var lv = Number(s.level);
    progress.level = isFinite(lv) ? Math.max(1, Math.round(lv)) : 1;
    progress.cleared = (s.cleared && typeof s.cleared === 'object') ? s.cleared : {};
    progress.levelBest = (s.levelBest && typeof s.levelBest === 'object') ? s.levelBest : {};
    progress.career = calcCareer();
    progress.dailyDate = s.dailyDate || '';
    progress.dailyDone = !!s.dailyDone;
    if (s.run && s.run.world && s.run.level) pendingRun = s.run;
    /* 旧档只带 level：恢复后把菜单/画布切到该关 */
    levelNo = progress.level;
    if (!pendingRun && state === 'menu') {
      level = RopeLevels.build(levelNo);
      world = RopePhysics.create(level);
      chapterIdx = RopeLevels.chapterOf(levelNo);
      chapterPage = chapterIdx === 3 ? Math.floor((levelNo - 61) / 20) : 0;
      renderChapters(); renderLevels(); updateHud();
    }
    return true;
  }

  function writeSave() {
    try { ARC.savegame.write(); } catch (e) {}
  }

  /* ---------------- 关卡选择 ---------------- */
  function renderChapters() {
    var chs = RopeLevels.chapters();
    els.chapters.innerHTML = chs.map(function (c, i) {
      return '<button class="cr-tab' + (i === chapterIdx ? ' active' : '') + '" data-chapter="' + i + '">' +
        T('gs.roperescue.chapter' + (i + 1)) + '</button>';
    }).join('');
  }

  function renderLevels() {
    var endless = chapterIdx === 3;
    var range = RopeLevels.chapterRange(chapterIdx, endless ? chapterPage : 0);
    var html = '';
    for (var n = range.from; n <= range.to; n++) {
      var cleared = progress.cleared[n] || 0;
      var dots = '';
      for (var d = 0; d < 3; d++) dots += '<i' + (d < cleared ? ' class="on"' : '') + '></i>';
      html += '<button class="btn cr-level-btn' + (cleared ? ' cleared' : '') + '" data-level="' + n + '">' +
        '<span>' + n + '</span><b class="cr-dots">' + dots + '</b></button>';
    }
    els.levels.innerHTML = html;
    if (els.pager) {
      els.pager.style.display = endless ? 'flex' : 'none';
      if (endless) {
        if (els.pageLbl) els.pageLbl.textContent = T('gs.roperescue.pageLbl')
          .replace('{a}', String(range.from)).replace('{b}', String(range.to));
        if (els.pagePrev) {
          els.pagePrev.disabled = chapterPage <= 0;
          els.pagePrev.style.opacity = chapterPage <= 0 ? '0.45' : '';
        }
        if (els.pageNext) els.pageNext.disabled = false;
      }
    }
    els.selectSub.textContent = progress.career > 0
      ? T('gs.roperescue.selectSub2').replace('{n}', progress.career)
      : T('gs.roperescue.selectSub');
    var dailyDone = progress.dailyDate === ARC.daily.dayStr() && progress.dailyDone;
    els.daily.textContent = T(dailyDone ? 'gs.roperescue.dailyDoneBtn' : 'gs.roperescue.dailyBtn');
    els.daily.classList.toggle('green', !!dailyDone);
    syncMenuHeight();
  }

  /* 关卡选择层高于画布时把舞台一起撑高，保证 20 个关卡按钮在 320/375 下完整可见 */
  function syncMenuHeight() {
    if (!els.stage) return;
    if (els.start.classList.contains('hidden')) { els.stage.style.minHeight = ''; return; }
    els.stage.style.minHeight = '';
    var need = Math.ceil(els.start.scrollHeight);
    if (need > els.stage.clientHeight) els.stage.style.minHeight = (need + 4) + 'px';
  }

  function openMenu() {
    state = 'menu';
    paused = false;
    hide(els.result);
    hide(els.paused);
    show(els.start);
    setHidden(els.pause, true);
    setHidden(els.tools, true);
    setControls(false);
    if (els.top) els.top.style.visibility = 'hidden';
    setMsg(T('gs.roperescue.help'), '');
    renderChapters();
    renderLevels();
    ARC.audio && ARC.audio.play('back');
    updateHud();
    writeSave();
  }

  els.chapters.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-chapter]');
    if (!b) return;
    chapterIdx = parseInt(b.getAttribute('data-chapter'), 10) || 0;
    if (chapterIdx === 3) chapterPage = 0;
    renderChapters();
    renderLevels();
    ARC.audio && ARC.audio.play('ui');
  });

  if (els.pagePrev) els.pagePrev.addEventListener('click', function () {
    if (chapterPage <= 0) return;
    chapterPage--;
    renderLevels();
    ARC.audio && ARC.audio.play('ui');
  });
  if (els.pageNext) els.pageNext.addEventListener('click', function () {
    chapterPage++;
    renderLevels();
    ARC.audio && ARC.audio.play('ui');
  });

  els.levels.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-level]');
    if (!b) return;
    var n = parseInt(b.getAttribute('data-level'), 10);
    chapterIdx = RopeLevels.chapterOf(n);
    startLevel(n, { resetSession: true });
  });

  els.daily.addEventListener('click', function () {
    startDaily();
  });

  function startDaily() {
    var today = ARC.daily.dayStr();
    var lv = RopeLevels.daily(today);
    progress.dailyDate = today;
    progress.dailyDone = ARC.daily.isSolved(SAVE_ID);
    isDaily = true;
    startLevel(lv, { data: lv, daily: true });
    toast(T('gs.roperescue.dailyStart'), 'ok');
  }

  /* ---------------- 开始关卡 ---------------- */
  function startLevel(n, opts) {
    opts = opts || {};
    var data = opts.data || RopeLevels.build(n);
    level = data;
    levelNo = opts.daily ? data.n : n;
    isDaily = !!opts.daily;
    world = RopePhysics.create(level);
    cutsUsed = 0;
    toolStock.freeze = level.tools.freeze;
    toolStock.hook = level.tools.hook;
    activeTool = 'cut';
    trail = []; sparks = []; floats = []; shakeAmt = 0;
    dragStart = null; dragPrev = null; dragging = false;
    cursor.on = false;
    paused = false; pausedTotal = 0; pausedAt = 0; frozenElapsed = 0;
    levelStart = Date.now();
    state = 'playing';
    lastResult = null;
    setHidden(els.pause, false);
    setHidden(els.tools, false);
    setControls(true);
    if (els.top) els.top.style.visibility = 'visible';
    hide(els.start); hide(els.result); hide(els.paused);
    if (els.stage) els.stage.style.minHeight = '';
    setMsg(T(isDaily ? 'gs.roperescue.dailyHelp' : 'gs.roperescue.help'), '');
    updateToolUi();
    updateHud();
    if (!isDaily) {
      progress.level = n;
      chapterIdx = RopeLevels.chapterOf(n);
      chapterPage = chapterIdx === 3 ? Math.floor((n - 61) / 20) : 0;
      renderChapters();
    }
    writeSave();
    if (opts.restore) restoreRun(opts.restore);
    ARC.audio && ARC.audio.play('ui');
  }

  function restoreRun(run) {
    if (!run || !run.world) return false;
    if (run.daily && !isDaily) return false;
    if (!RopePhysics.restore(world, run.world)) return false;
    cutsUsed = Math.min(level.cutLimit, Math.max(0, Number(run.cutsUsed) || 0));
    toolStock.freeze = Math.max(0, Number(run.tools && run.tools.freeze) || 0);
    toolStock.hook = Math.max(0, Number(run.tools && run.tools.hook) || 0);
    activeTool = run.activeTool || 'cut';
    levelStart = Date.now() - (Number(run.elapsed) || 0);
    pausedTotal = 0;
    paused = true;
    frozenElapsed = Number(run.elapsed) || 0;
    pausedAt = Date.now();
    state = 'playing';
    show(els.paused);
    hide(els.result); hide(els.start);
    if (els.stage) els.stage.style.minHeight = '';
    setHidden(els.pause, true);
    setHidden(els.tools, true);
    setControls(false);
    setMsg(T('gs.roperescue.resumeTip'), '');
    updateToolUi();
    updateHud();
    return true;
  }

  function setMsg(text, color) {
    els.msg.textContent = text;
    els.msg.style.color = color || '';
  }

  function updateToolUi() {
    els.tools.querySelectorAll('.cr-tool').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tool') === activeTool);
    });
    els.toolCut.textContent = (level ? (level.cutLimit - cutsUsed) : 0) + '';
    els.toolFreeze.textContent = toolStock.freeze + '';
    els.toolHook.textContent = toolStock.hook + '';
  }

  function updateHud() {
    if (!level || !world) return;
    var rescued = world.rescued;
    var totalT = level.targets.length;
    var left = Math.ceil(remainingMs() / 1000);
    var key = levelNo + '|' + rescued + '|' + cutsUsed + '|' + left;
    if (lastHud.key === key) return;
    lastHud.key = key;
    els.level.textContent = isDaily ? T('gs.roperescue.dailyShort') : String(levelNo);
    els.eaten.textContent = rescued + ' / ' + totalT;
    els.cuts.textContent = cutsUsed + ' / ' + level.cutLimit;
    els.time.textContent = left + 's';
    els.time.style.color = left <= 10 ? 'var(--neon-pink)' : '';
    updateToolUi();
  }

  /* ---------------- 工具 ---------------- */
  function selectTool(name) {
    if (['cut', 'freeze', 'hook'].indexOf(name) < 0) return;
    if (name === 'freeze') { useFreeze(); return; }
    activeTool = name;
    updateToolUi();
    if (name === 'hook') setMsg(T('gs.roperescue.hookHint'), 'var(--neon-yellow)');
    else if (name === 'cut') setMsg(T('gs.roperescue.help'), '');
    ARC.audio && ARC.audio.play('ui');
  }

  function useFreeze() {
    if (state !== 'playing' || paused) return;
    if (toolStock.freeze <= 0) { toast(T('gs.roperescue.noFreeze'), 'warn'); ARC.audio && ARC.audio.play('error'); return; }
    if (world.freezeT > 0) { toast(T('gs.roperescue.freezeBusy'), 'warn'); return; }
    toolStock.freeze--;
    world.freezeT = 4.2;
    activeTool = 'cut';
    updateToolUi();
    spawnBurst(CAMERA.x, CAMERA.y, '#7ce8ff', 22);
    floats.push({ x: CAMERA.x, y: 120, text: T('gs.roperescue.frozen'), life: 1.2, color: '#7ce8ff' });
    ARC.audio && ARC.audio.play('daily');
    writeSave();
  }

  function tryPlaceHook(x, y) {
    if (toolStock.hook <= 0) { toast(T('gs.roperescue.noHook'), 'warn'); return false; }
    var best = null, bestD = 999;
    for (var i = 0; i < world.targets.length; i++) {
      var t = world.targets[i];
      if (t.rescued || t.lost) continue;
      var d = Math.hypot(t.node.x - x, t.node.y - y);
      if (d < 160 && d < bestD) { best = t; bestD = d; }
    }
    if (!best) { toast(T('gs.roperescue.hookNone'), 'warn'); ARC.audio && ARC.audio.play('error'); return false; }
    var len = Math.max(26, Math.hypot(best.node.x - x, best.node.y - y));
    world.hooks.push({ x: x, y: y, targetId: best.id, len: len, t: 3.2 });
    toolStock.hook--;
    activeTool = 'cut';
    updateToolUi();
    spawnBurst(x, y, '#b967ff', 20);
    floats.push({ x: x, y: y - 20, text: T('gs.roperescue.hooked'), life: 1.1, color: '#b967ff' });
    ARC.audio && ARC.audio.play('drop');
    writeSave();
    return true;
  }

  els.tools.addEventListener('click', function (e) {
    var b = e.target.closest('.cr-tool');
    if (!b) return;
    selectTool(b.getAttribute('data-tool'));
  });

  /* ---------------- 切割 ---------------- */
  function canCut() {
    return state === 'playing' && !paused && cutsUsed < level.cutLimit;
  }

  function doCut(hit, point) {
    if (!canCut()) {
      if (cutsUsed >= level.cutLimit) toast(T('gs.roperescue.outOfCuts'), 'warn');
      return false;
    }
    var t = RopePhysics.cut(world, hit.strand);
    if (!t) return false;
    cutsUsed++;
    var px = point ? point.x : (world.lastCutPoint ? world.lastCutPoint.x : 270);
    var py = point ? point.y : (world.lastCutPoint ? world.lastCutPoint.y : 200);
    spawnBurst(px, py, '#ffe600', 18);
    spawnSparks(px, py, '#ffe600', 16);
    floats.push({ x: px, y: py - 8, text: T('gs.roperescue.cutText'), life: 0.7, color: '#ffe600' });
    shakeAmt = Math.max(shakeAmt, 5);
    ARC.audio && ARC.audio.play('type');
    if (ARC.fx) ARC.fx.shake(canvas);
    updateHud();
    writeSave();
    if (cutsUsed >= level.cutLimit) {
      var attached = false;
      world.targets.forEach(function (tg) {
        if (!tg.rescued && !tg.lost && RopePhysics.isAttached(world, tg.id)) attached = true;
      });
      if (attached) { failLevel('cuts'); return true; }
    }
    checkRescue();
    return true;
  }

  function tryCutLine(a, b) {
    if (!canCut()) return;
    var hits = RopePhysics.lineHits(world, a.x, a.y, b.x, b.y, 6);
    for (var i = 0; i < hits.length; i++) {
      if (cutsUsed >= level.cutLimit) break;
      doCut(hits[i], { x: hits[i].x, y: hits[i].y });
      if (state !== 'playing') return;
    }
  }

  function tryTapCut(p) {
    if (!canCut()) return;
    var hit = RopePhysics.nearest(world, p.x, p.y, 20);
    if (hit) doCut(hit, { x: p.x, y: p.y });
  }

  /* ---------------- 结算 ---------------- */
  function checkRescue() {
    if (state !== 'playing') return;
    if (world.failReason) { failLevel(world.failReason); return; }
    if (world.lost > 0) { failLevel(world.failReason || 'spike'); return; }
    if (world.rescued >= level.targets.length) winLevel();
  }

  function failLevel(reason) {
    if (state !== 'playing') return;
    state = 'lost';
    paused = false;
    var elapsed = elapsedMs();
    lastResult = { success: false, reason: reason || 'spike', time: elapsed };
    setMsg(T('gs.roperescue.failMsg'), 'var(--neon-pink)');
    ARC.audio && ARC.audio.play('lose');
    if (ARC.juice) ARC.juice.lose();
    if (ARC.fx) { ARC.fx.shake(canvas); ARC.fx.flash('rgba(255,45,74,0.35)'); }
    updateHud();
    showResult(false);
    writeSave();
  }

  function winLevel() {
    if (state !== 'playing') return;
    state = 'won';
    paused = false;
    var elapsed = elapsedMs();
    var timeLeft = Math.max(0, level.timeLimit * 1000 - elapsed);
    var starsGot = 1;
    if (cutsUsed <= level.requiredCuts && timeLeft >= level.timeLimit * 1000 * 0.25) starsGot = 3;
    else if (cutsUsed <= level.requiredCuts + 1) starsGot = 2;
    var score = level.targets.length * 100 + world.gemCount * 50 +
      Math.round(timeLeft / 1000) * 8 + Math.max(0, (level.cutLimit - cutsUsed)) * 15;
    if (!isDaily) {
      progress.levelBest[levelNo] = Math.max(progress.levelBest[levelNo] || 0, score);
      progress.cleared[levelNo] = Math.max(progress.cleared[levelNo] || 0, starsGot);
      progress.level = levelNo + 1;   /* 无尽章不设上限 */
      progress.career = calcCareer();
    } else {
      progress.dailyDone = ARC.daily.markSolved(SAVE_ID, Math.max(1, Math.round(elapsed / 1000)));
      progress.dailyDate = ARC.daily.dayStr();
    }
    /* 61+ 为无尽章，不出现“全部关卡完成”终局 */
    var final = false;
    lastResult = {
      success: true, time: elapsed, score: score, stars: starsGot,
      final: final, career: progress.career
    };
    if (ARC.shell && ARC.shell.submitScore) ARC.shell.submitScore(progress.career || score);
    if (ARC.juice) ARC.juice.win();
    if (ARC.audio) ARC.audio.play(final ? 'record' : 'win');
    setMsg(T(isDaily ? 'gs.roperescue.dailyWin' : (final ? 'gs.roperescue.allDone' : 'gs.roperescue.levelDone'))
      .replace('{n}', String(final ? progress.career : levelNo)), 'var(--neon-green)');
    updateHud();
    showResult(true);
    writeSave();
  }

  function reasonText(r) {
    var map = {
      saw: 'reasonSaw', spike: 'reasonSpike', magma: 'reasonMagma',
      pendulum: 'reasonPendulum', out: 'reasonOut', time: 'reasonTime', cuts: 'reasonCuts'
    };
    return T('gs.roperescue.' + (map[r] || 'reasonSpike'));
  }

  function showResult(success) {
    var r = lastResult;
    var starsStr = '';
    if (success) {
      for (var i = 0; i < 3; i++) starsStr += (i < r.stars ? '●' : '○');
    }
    els.resTitle.textContent = success
      ? T(isDaily ? 'gs.roperescue.dailyDoneTitle' : (r.final ? 'gs.roperescue.allDoneTitle' : 'gs.roperescue.levelDoneTitle'))
        .replace('{n}', String(isDaily ? T('gs.roperescue.dailyShort') : levelNo))
      : T(isDaily ? 'gs.roperescue.dailyFailTitle' : 'gs.roperescue.failTitle').replace('{n}', String(levelNo));
    els.resTitle.style.color = success ? 'var(--neon-green)' : 'var(--neon-pink)';
    var rows = [
      { k: T('gs.roperescue.resTime'), v: T('gs.roperescue.secFmt').replace('{n}', (r.time / 1000).toFixed(1)) },
      { k: T('gs.roperescue.resCuts'), v: cutsUsed + ' / ' + level.cutLimit },
      { k: T('gs.roperescue.resCandies'), v: world.rescued + ' / ' + level.targets.length },
      { k: T('gs.roperescue.resGems'), v: world.gemCount + ' / ' + world.gems.length }
    ];
    if (success) {
      rows.push({ k: T('gs.roperescue.resScore'), v: String(r.score) });
      rows.push({ k: T('gs.roperescue.resStars'), v: starsStr });
      if (!isDaily) rows.push({ k: T('gs.roperescue.resTotal'), v: String(progress.career) });
    } else {
      rows.push({ k: T('gs.roperescue.resReason'), v: reasonText(r.reason) });
    }
    if (isDaily) {
      rows.push({ k: T('gs.roperescue.resDaily'), v: progress.dailyDone ? T('gs.roperescue.dailySolved') : T('gs.roperescue.dailyUnsolved') });
    }
    els.resStats.innerHTML = rows.map(function (row) {
      return '<div class="cr-res-row"><span>' + row.k + '</span><b>' + row.v + '</b></div>';
    }).join('');
    els.next.style.display = (success && !isDaily && !r.final) ? '' : 'none';
    els.retry.style.display = success ? 'none' : '';
    els.restart.textContent = success
      ? T(r.final || isDaily ? 'gs.roperescue.levelSelect' : 'gs.roperescue.nextLevel')
      : T('gs.roperescue.retry');
    show(els.result);
    setHidden(els.pause, true);
    setHidden(els.tools, true);
    setControls(false);
  }

  /* ---------------- 暂停/结束控制 ---------------- */
  function togglePause() {
    if (state !== 'playing') return;
    if (!paused) {
      paused = true;
      pausedAt = Date.now();
      frozenElapsed = Date.now() - levelStart - pausedTotal;
      dragging = false; dragStart = null; dragPrev = null;
      show(els.paused);
      setHidden(els.tools, true);
      setControls(false);
      setMsg(T('gs.roperescue.paused'), 'var(--neon-yellow)');
      writeSave();
    } else {
      paused = false;
      pausedTotal += Date.now() - pausedAt;
      hide(els.paused);
      setHidden(els.tools, false);
      setControls(true);
      setMsg(T(isDaily ? 'gs.roperescue.dailyHelp' : 'gs.roperescue.help'), '');
    }
    ARC.audio && ARC.audio.play('ui');
  }

  function retry() {
    if (isDaily) startDaily();
    else startLevel(levelNo, { resetSession: true });
  }

  function nextLevel() {
    if (isDaily) openMenu();
    else startLevel(levelNo + 1, { resetSession: true });
  }

  els.pause.addEventListener('click', togglePause);
  els.resume.addEventListener('click', togglePause);
  els.quit.addEventListener('click', function () { openMenu(); });
  els.menu.addEventListener('click', openMenu);
  els.retry.addEventListener('click', retry);
  els.restart.addEventListener('click', function () {
    if (state === 'playing' || state === 'lost') retry();
    else if (state === 'won') nextLevel();
    else if (state === 'menu') startLevel(levelNo, { resetSession: true });
  });
  els.next.addEventListener('click', nextLevel);
  els.levelsBtn.addEventListener('click', function () {
    if (state === 'playing') { writeSave(); }
    openMenu();
  });

  /* ---------------- 输入 ---------------- */
  function toCanvas(e) { return GK.pointer(canvas, e); }

  function down(e) {
    if (state !== 'playing' || paused) return;
    var p = toCanvas(e);
    dragging = true; dragStart = p; dragPrev = p; movedDist = 0;
    cursor.x = p.x; cursor.y = p.y; cursor.on = true;
    e.preventDefault();
  }
  function move(e) {
    if (state !== 'playing' || paused) return;
    var p = toCanvas(e);
    cursor.x = p.x; cursor.y = p.y; cursor.on = true;
    if (!dragging) return;
    movedDist += Math.hypot(p.x - dragPrev.x, p.y - dragPrev.y);
    trail.push({ x: p.x, y: p.y, life: 1 });
    if (trail.length > 26) trail.shift();
    if (activeTool === 'cut') tryCutLine(dragPrev, p);
    dragPrev = p;
    e.preventDefault();
  }
  function up(e) {
    if (!dragging) return;
    var p = toCanvas(e);
    if (movedDist < 14) {
      if (activeTool === 'hook') tryPlaceHook(p.x, p.y);
      else tryTapCut(p);
    }
    dragging = false; dragStart = null; dragPrev = null;
    e.preventDefault();
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', function () { dragging = false; dragStart = null; dragPrev = null; });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'playing') { e.preventDefault(); togglePause(); }
    } else if (e.code === 'KeyR') {
      if (state !== 'menu') { e.preventDefault(); retry(); }
    } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      e.preventDefault();
      selectTool(e.code === 'Digit1' ? 'cut' : e.code === 'Digit2' ? 'freeze' : 'hook');
    } else if (e.code === 'Space') {
      if (state !== 'playing' || paused) return;
      e.preventDefault();
      var hit = RopePhysics.nearest(world, cursor.x, cursor.y, 34);
      if (hit) doCut(hit, { x: hit.x, y: hit.y });
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (state !== 'playing' || paused) return;
      e.preventDefault();
      cursor.on = true;
      var step = e.shiftKey ? 42 : 22;
      if (e.code === 'ArrowUp') cursor.y -= step;
      if (e.code === 'ArrowDown') cursor.y += step;
      if (e.code === 'ArrowLeft') cursor.x -= step;
      if (e.code === 'ArrowRight') cursor.x += step;
      cursor.x = Math.max(6, Math.min(W - 6, cursor.x));
      cursor.y = Math.max(6, Math.min(H - 6, cursor.y));
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'playing' && !paused) togglePause();
  });

  /* ---------------- 粒子 ---------------- */
  function spawnSparks(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 50 + Math.random() * 220;
      sparks.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
        life: 1, size: 1.4 + Math.random() * 2.6, color: color
      });
    }
  }
  function spawnBurst(x, y, color, n) {
    if (ARC.fx) {
      var c = GK.toClient(canvas, x, y);
      ARC.fx.burst(c.x, c.y, color, n);
    }
    spawnSparks(x, y, color, Math.min(22, n));
  }

  function updateFx(dt) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i];
      p.vy += 300 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt * 1.6;
      if (p.life <= 0) sparks.splice(i, 1);
    }
    for (var j = trail.length - 1; j >= 0; j--) {
      trail[j].life -= dt * 2.2;
      if (trail[j].life <= 0) trail.splice(j, 1);
    }
    for (var k = floats.length - 1; k >= 0; k--) {
      floats[k].y -= dt * 32;
      floats[k].life -= dt * 1.4;
      if (floats[k].life <= 0) floats.splice(k, 1);
    }
    if (shakeAmt > 0) shakeAmt = Math.max(0, shakeAmt - dt * 26);
  }

  /* ---------------- 主循环 ---------------- */
  function update(dtMs) {
    var dt = Math.min(0.033, (dtMs || 16) / 1000);
    updateFx(dt);
    if (state !== 'playing' || paused) return;

    if (remainingMs() <= 0) { failLevel('time'); return; }
    var prevRescued = world.rescued;
    RopePhysics.step(world, dt, 1);
    if (world.rescued > prevRescued) onRescue(prevRescued);
    if (state !== 'playing') return;
    if (world.failReason) { failLevel(world.failReason); return; }
    if (world.lost > 0) { failLevel(world.failReason || 'spike'); return; }
    if (world.rescued >= level.targets.length) { winLevel(); return; }
    if (world.freezeT > 0) {
      setMsg(T('gs.roperescue.frozenTip').replace('{n}', (world.freezeT).toFixed(1)), 'var(--neon-cyan)');
    }
    updateHud();
  }

  function onRescue() {
    var t = null;
    for (var i = 0; i < world.targets.length; i++) {
      if (world.targets[i].rescued) { t = world.targets[i]; break; }
    }
    var x = level.net.x, y = level.net.y - 16;
    spawnBurst(x, y, '#39ff14', 30);
    floats.push({ x: x, y: y - 30, text: T('gs.roperescue.rescuedText'), life: 1.2, color: '#39ff14' });
    ARC.audio && ARC.audio.play('coin');
    ARC.juice && ARC.juice.coin();
  }

  /* ---------------- 绘制 ---------------- */
  function drawBackground(t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070d1c');
    g.addColorStop(0.5, '#0d1830');
    g.addColorStop(1, '#180b26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var moon = ctx.createRadialGradient(430, 76, 3, 430, 76, 120);
    moon.addColorStop(0, 'rgba(150,220,255,0.30)');
    moon.addColorStop(1, 'rgba(150,220,255,0)');
    ctx.fillStyle = moon;
    ctx.beginPath(); ctx.arc(430, 76, 120, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,240,255,0.7)';
    ctx.beginPath(); ctx.arc(430, 76, 20, 0, Math.PI * 2); ctx.fill();

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = 0.35 + Math.sin(t * 1.4 + s.tw) * 0.25;
      ctx.fillStyle = i % 7 === 0 ? '#ffd1e8' : '#bfe9ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    /* 远景霓虹山脊 */
    ctx.fillStyle = 'rgba(16,32,64,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 306);
    ctx.quadraticCurveTo(90, 244, 180, 298);
    ctx.quadraticCurveTo(270, 250, 360, 296);
    ctx.quadraticCurveTo(450, 248, 540, 306);
    ctx.lineTo(540, 440); ctx.lineTo(0, 440); ctx.closePath(); ctx.fill();

    /* 中景建筑 + 呼吸灯 */
    for (var b = 0; b < 12; b++) {
      var bw = 24 + (b % 4) * 8;
      var bh = 44 + ((b * 37) % 84);
      var bx = b * 48 - 10;
      ctx.fillStyle = 'rgba(8,18,38,0.95)';
      ctx.fillRect(bx, 338 - bh, bw, bh);
      var pulse = 0.1 + 0.12 * Math.sin(t * 1.3 + b);
      ctx.fillStyle = 'rgba(0,240,255,' + pulse.toFixed(3) + ')';
      for (var wy = 0; wy < Math.floor(bh / 16); wy++) {
        ctx.fillRect(bx + 5, 344 - bh + wy * 14, 4, 5);
        ctx.fillRect(bx + 13, 344 - bh + wy * 14, 4, 5);
      }
    }

    /* 霓虹网格地平线 */
    ctx.strokeStyle = 'rgba(0,240,255,0.10)';
    ctx.lineWidth = 1;
    for (var gy = 300; gy < 410; gy += 18) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    for (var gx = 0; gx < W; gx += 36) {
      ctx.beginPath(); ctx.moveTo(gx, 300); ctx.lineTo(gx + (gx - 270) * 0.4, 410); ctx.stroke();
    }

    /* 顶部横梁 */
    var beam = ctx.createLinearGradient(0, 0, 0, 16);
    beam.addColorStop(0, '#6c7ea8');
    beam.addColorStop(1, '#1b2942');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = 'rgba(0,240,255,0.6)';
    ctx.fillRect(0, 14, W, 2);
  }

  function drawSpikes() {
    var net = level.net;
    ctx.save();
    ctx.fillStyle = 'rgba(58,10,26,0.9)';
    ctx.fillRect(0, 412, net.x - net.half, H - 412);
    ctx.fillRect(net.x + net.half, 412, W - (net.x + net.half), H - 412);
    for (var x = 0; x < W; x += 20) {
      if (x > net.x - net.half - 10 && x < net.x + net.half + 10) continue;
      ctx.beginPath();
      ctx.moveTo(x, 412);
      ctx.lineTo(x + 10, 394);
      ctx.lineTo(x + 20, 412);
      ctx.closePath();
      var sg = ctx.createLinearGradient(0, 394, 0, 412);
      sg.addColorStop(0, '#ff5c74');
      sg.addColorStop(1, '#4a0c1c');
      ctx.fillStyle = sg;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNet(t) {
    var net = level.net;
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.save();
    var glow = ctx.createRadialGradient(net.x, net.y - 10, 10, net.x, net.y - 10, net.half + 30);
    glow.addColorStop(0, 'rgba(57,255,20,' + (0.18 + pulse * 0.1).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(57,255,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(net.x - net.half - 40, net.y - 70, net.half * 2 + 80, 90);

    ctx.strokeStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(net.x - net.half, net.y - 6); ctx.lineTo(net.x + net.half, net.y - 6); ctx.stroke();
    ctx.shadowBlur = 0;

    /* 网格救援网 */
    ctx.strokeStyle = 'rgba(57,255,20,0.45)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 8; i++) {
      var xx = net.x - net.half + (net.half * 2 / 8) * i;
      ctx.beginPath(); ctx.moveTo(xx, net.y - 6); ctx.lineTo(xx, net.y + 10 + Math.sin(t * 2 + i) * 2); ctx.stroke();
    }
    for (var j = 0; j < 3; j++) {
      ctx.beginPath();
      ctx.moveTo(net.x - net.half, net.y + 2 + j * 4);
      ctx.lineTo(net.x + net.half, net.y + 2 + j * 4);
      ctx.stroke();
    }
    /* 端柱 */
    [net.x - net.half, net.x + net.half].forEach(function (x) {
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 12;
      ctx.fillRect(x - 2, net.y - 20, 4, 26);
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  function drawHazards(t) {
    /* 岩浆 */
    level.magmas.forEach(function (m) {
      var lg = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
      lg.addColorStop(0, '#ff8a00');
      lg.addColorStop(0.4, '#ff2d55');
      lg.addColorStop(1, '#5a0018');
      ctx.fillStyle = lg;
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle = 'rgba(255,230,0,0.55)';
      for (var x = m.x; x < m.x + m.w; x += 10) {
        var hh = 3 + Math.sin(t * 4 + x * 0.4) * 3;
        ctx.fillRect(x, m.y - hh, 8, hh + 2);
      }
      ctx.save();
      ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(255,45,85,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + m.w, m.y); ctx.stroke();
      ctx.restore();
    });

    /* 摆锤 */
    level.pendulums.forEach(function (p, i) {
      var pp = world.pendPos[i] || { x: p.px, y: p.py + p.len };
      var pivot = { x: p.px, y: p.py };
      ctx.save();
      ctx.strokeStyle = 'rgba(180,200,255,0.7)';
      ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(pp.x, pp.y); ctx.stroke();
      ctx.fillStyle = '#7f8fb5';
      ctx.beginPath(); ctx.arc(pivot.x, pivot.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.translate(pp.x, pp.y);
      ctx.rotate(Math.sin(t * p.spd + p.phase) * 0.7);
      ctx.fillStyle = '#c9d3ee';
      ctx.beginPath(); ctx.arc(0, 0, p.r + 3, 0, Math.PI * 2); ctx.fill();
      var pg = ctx.createRadialGradient(-4, -4, 2, 0, 0, p.r + 4);
      pg.addColorStop(0, '#ff9ec4'); pg.addColorStop(0.6, '#ff2d95'); pg.addColorStop(1, '#4a0620');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    /* 锯片 */
    world.sawPos.forEach(function (sp, i) {
      var s = level.saws[i];
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(t * (3 + i * 0.5));
      ctx.shadowColor = 'rgba(255,45,149,0.7)';
      ctx.shadowBlur = 14;
      for (var k = 0; k < 12; k++) {
        var a = (k / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s.r, Math.sin(a) * s.r);
        ctx.lineTo(Math.cos(a + 0.18) * (s.r + 8), Math.sin(a + 0.18) * (s.r + 8));
        ctx.lineTo(Math.cos(a + 0.32) * s.r, Math.sin(a + 0.32) * s.r);
        ctx.closePath();
        ctx.fillStyle = '#d6def5';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      var sg = ctx.createRadialGradient(-s.r * 0.3, -s.r * 0.3, 2, 0, 0, s.r);
      sg.addColorStop(0, '#ff9ec4'); sg.addColorStop(0.55, '#ff2d95'); sg.addColorStop(1, '#5a0b28');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, s.r - 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function drawAnchors() {
    level.anchors.forEach(function (a, i) {
      ctx.save();
      var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400 + i);
      ctx.fillStyle = '#7ce8ff';
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 7);
      ctx.lineTo(a.x + 6, a.y);
      ctx.lineTo(a.x, a.y + 7);
      ctx.lineTo(a.x - 6, a.y);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,240,255,' + (0.25 + pulse * 0.3).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(a.x, a.y, 11 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
  }

  function drawStrands(t) {
    world.strands.forEach(function (s) {
      if (!s.alive) return;
      var tg = world.targets[s.targetId];
      if (tg.rescued || tg.lost) return;
      var pts = s.nodes.concat([tg.node]);
      var tension = s.tension || 0;
      var hot = tension > 0.35;
      ctx.save();
      ctx.strokeStyle = hot ? '#ff2d95' : (tension > 0.12 ? '#7ce8ff' : 'rgba(150,200,255,0.55)');
      ctx.shadowColor = hot ? '#ff2d95' : '#00f0ff';
      ctx.shadowBlur = 5 + tension * 12;
      ctx.lineWidth = 2 + tension * 1.4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      /* 受力节点 */
      if (tension > 0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (var k = 1; k < pts.length - 1; k += 2) {
          ctx.fillRect(pts[k].x - 1, pts[k].y - 1, 2, 2);
        }
      }
      ctx.restore();
    });
  }

  function drawTargets(t) {
    world.targets.forEach(function (tg) {
      if (tg.rescued) return;
      var n = tg.node;
      ctx.save();
      if (tg.lost) ctx.globalAlpha = 0.5;
      /* 拖尾 */
      tg.trail.forEach(function (p) {
        ctx.globalAlpha = Math.max(0, p.a) * 0.35;
        ctx.fillStyle = '#ffd23d';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 * p.a, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = tg.lost ? 0.5 : 1;
      ctx.translate(n.x, n.y);
      var spin = t * 1.6 + tg.id;
      /* 光晕 */
      var halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
      halo.addColorStop(0, 'rgba(255,210,61,0.35)');
      halo.addColorStop(1, 'rgba(255,210,61,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
      /* 外环 */
      ctx.strokeStyle = 'rgba(255,230,150,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 17, spin, spin + 4.4); ctx.stroke();
      /* 本体 */
      var g = ctx.createRadialGradient(-4, -5, 2, 0, 0, 16);
      g.addColorStop(0, '#fff6c0');
      g.addColorStop(0.4, '#ffd23d');
      g.addColorStop(1, '#ff7a00');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(255,180,60,0.9)'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      /* 高光与霓虹纹 */
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(-4, -5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,45,149,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0.6, 2.2); ctx.stroke();
      ctx.restore();
    });
  }

  function drawGems(t) {
    world.gems.forEach(function (g) {
      if (g.got) return;
      ctx.save();
      ctx.translate(g.x, g.y + Math.sin(t * 2 + g.x) * 3);
      ctx.rotate(t * 0.9);
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#7ce8ff';
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawHooks() {
    world.hooks.forEach(function (h) {
      if (h.t <= 0) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(185,103,255,0.9)';
      ctx.shadowColor = '#b967ff'; ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(h.hx == null ? h.x : h.hx, h.hy == null ? h.y : h.hy);
      ctx.stroke();
      ctx.fillStyle = '#b967ff';
      ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function drawSparks() {
    sparks.forEach(function (p) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    floats.forEach(function (f) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color || '#ffe600';
      ctx.font = 'bold 13px "Fusion Pixel",monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = f.color || '#ffe600'; ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  }

  function drawTrail() {
    if (!trail.length) return;
    ctx.save();
    ctx.strokeStyle = '#ffe600';
    ctx.shadowColor = '#ffe600'; ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (var i = 1; i < trail.length; i++) {
      ctx.globalAlpha = Math.max(0, trail[i].life);
      ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCursor() {
    if (!cursor.on || state !== 'playing' || paused) return;
    ctx.save();
    ctx.strokeStyle = activeTool === 'hook' ? '#b967ff' : '#ffe600';
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cursor.x, cursor.y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cursor.x - 18, cursor.y); ctx.lineTo(cursor.x - 7, cursor.y);
    ctx.moveTo(cursor.x + 7, cursor.y); ctx.lineTo(cursor.x + 18, cursor.y);
    ctx.moveTo(cursor.x, cursor.y - 18); ctx.lineTo(cursor.x, cursor.y - 7);
    ctx.moveTo(cursor.x, cursor.y + 7); ctx.lineTo(cursor.x, cursor.y + 18);
    ctx.stroke();
    ctx.restore();
  }

  function draw(tm) {
    var dt = lastDraw ? Math.min(0.05, (tm - lastDraw) / 1000) : 0.016;
    lastDraw = tm;
    var t = performance.now() / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeAmt > 0) {
      ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    }
    drawBackground(t);
    if (level) {
      drawSpikes();
      drawNet(t);
      drawGems(t);
      drawHazards(t);
      drawAnchors();
      drawStrands(t);
      drawTargets(t);
      drawHooks();
      drawSparks();
      drawTrail();
      drawCursor();
    } else {
      drawSparks();
    }
    ctx.restore();

    /* 顶部提示 */
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = 'rgba(0,240,255,0.8)';
    ctx.font = '11px "Fusion Pixel",monospace';
    ctx.textAlign = 'left';
    var hint = state === 'playing' && level
      ? (isDaily ? T('gs.roperescue.stageDaily') : T('gs.roperescue.stageHint'))
      : T('gs.roperescue.stageHint');
    ctx.fillText(hint, 12, 18);
    if (world && world.freezeT > 0) {
      ctx.fillStyle = '#7ce8ff';
      ctx.textAlign = 'right';
      ctx.fillText(T('gs.roperescue.frozenShort').replace('{n}', world.freezeT.toFixed(1)), W - 12, 18);
    }
    ctx.restore();
  }

  /* ---------------- 启动 ---------------- */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.roperescue.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    if (state === 'playing') { writeSave(); togglePause(); }
    else if (state === 'won') nextLevel();
    else if (state === 'lost') retry();
    else startLevel(levelNo, { resetSession: true });
  };

  function boot() {
    levelNo = Math.max(1, Math.round(progress.level || 1));
    level = RopeLevels.build(levelNo);
    world = RopePhysics.create(level);
    chapterIdx = RopeLevels.chapterOf(levelNo);
    chapterPage = chapterIdx === 3 ? Math.floor((levelNo - 61) / 20) : 0;
    renderChapters();
    renderLevels();
    updateHud();
    state = 'menu';
    show(els.start);
    setHidden(els.pause, true);
    setHidden(els.tools, true);
    setControls(false);
    if (els.top) els.top.style.visibility = 'hidden';
    hide(els.result); hide(els.paused);
    els.restart.textContent = T('gs.roperescue.retry');
  }

  ARC.savegame.setup({ id: SAVE_ID, collect: collectSave, apply: applySave, msg: 'gs.roperescue.saveResumed' });
  boot();
  var resumed = ARC.savegame.resume();
  if (resumed && pendingRun) {
    var ok = false;
    if (pendingRun.daily) {
      var dlv = RopeLevels.daily(ARC.daily.dayStr());
      if (pendingRun.level === 999) { startLevel(dlv, { data: dlv, daily: true, restore: pendingRun }); ok = true; }
    } else if (pendingRun.level >= 1) {
      startLevel(pendingRun.level, { resetSession: false, restore: pendingRun });
      ok = true;
    }
    if (ok) paused = true;
  } else if (resumed) {
    openMenu();
  }

  loopApi = ARC.loop.start(function () { update(16); }, draw, 16);

  window.addEventListener('resize', syncMenuHeight);

  /* ---------------- QA（仅 ?qa=1） ---------------- */
  if (/[?&]qa=1(?:&|$)/.test(window.location.search)) {
    window.__QA = {
      state: function () {
        return {
          state: state, paused: paused, level: levelNo, daily: isDaily,
          rescued: world ? world.rescued : 0, total: level ? level.targets.length : 0,
          cutsUsed: cutsUsed, cutLimit: level ? level.cutLimit : 0,
          cutsRequired: level ? level.requiredCuts : 0,
          tools: { freeze: toolStock.freeze, hook: toolStock.hook },
          timeLeft: Math.round(remainingMs()),
          timeLimit: level ? level.timeLimit : 0,
          fail: world ? world.failReason : '',
          freezeT: world ? world.freezeT : 0,
          activeTool: activeTool,
          result: lastResult,
          career: progress.career,
          cleared: progress.cleared,
          saved: (function () { try { return !!localStorage.getItem('arcade_save_roperescue'); } catch (e) { return false; } })()
        };
      },
      totalLevels: function () { return TOTAL; },
      writtenLevels: TOTAL,
      chapterRange: RopeLevels.chapterRange,
      page: function () { return chapterPage; },
      chapter: function () { return chapterIdx; },
      net: function () {
        return level ? { x: level.net.x, y: level.net.y, half: level.net.half } : null;
      },
      strandCount: function (id) {
        return world ? RopePhysics.liveStrands(world, id).length : 0;
      },
      strands: function (id) {
        return world ? RopePhysics.liveStrands(world, id).map(function (s) { return s.index; }) : [];
      },
      target: function (id) {
        if (!world || !world.targets[id]) return null;
        var t = world.targets[id];
        return {
          id: t.id, x: t.node.x, y: t.node.y, ox: t.node.ox, oy: t.node.oy,
          rescued: t.rescued, lost: t.lost, attached: RopePhysics.isAttached(world, t.id),
          strands: RopePhysics.liveStrands(world, id).length
        };
      },
      keepStrand: function (id, keepIdx) {
        if (state !== 'playing' || !world) return false;
        var live = RopePhysics.liveStrands(world, id);
        var cuts = 0;
        for (var i = 0; i < live.length; i++) {
          if (live[i].index === keepIdx) continue;
          if (state !== 'playing') break;
          doCut({ strand: live[i].index }, null);
          cuts++;
        }
        return cuts;
      },
      levelInfo: function (n) {
        var lv = RopeLevels.build(n);
        return {
          n: lv.n, targets: lv.targets.length, strands: lv.requiredCuts,
          cutLimit: lv.cutLimit, timeLimit: lv.timeLimit,
          saws: lv.saws.length, pendulums: lv.pendulums.length, magmas: lv.magmas.length,
          netHalf: lv.net.half, tools: lv.tools
        };
      },
      startLevel: function (n) { startLevel(n, { resetSession: true, data: RopeLevels.build(n) }); },
      startDaily: function () { startDaily(); },
      cutTarget: function (id) {
        if (state !== 'playing' || !world) return false;
        var strands = RopePhysics.liveStrands(world, id);
        if (!strands.length) return false;
        var s = strands[0];
        var tg = world.targets[id];
        var hit = { strand: s.index, x: tg.node.x, y: tg.node.y };
        return doCut(hit, { x: tg.node.x, y: tg.node.y - 30 });
      },
      cutAll: function () {
        if (state !== 'playing' || !world) return false;
        for (var i = 0; i < world.targets.length; i++) {
          var guard = 0;
          while (RopePhysics.liveStrands(world, i).length && guard < 6) {
            doCut({ strand: RopePhysics.liveStrands(world, i)[0].index }, null);
            guard++;
          }
        }
        return true;
      },
      useTool: function (name) {
        if (name === 'freeze') { useFreeze(); return true; }
        if (name === 'hook') { selectTool('hook'); return true; }
        selectTool('cut'); return true;
      },
      placeHook: function (x, y) { return tryPlaceHook(x, y); },
      cursor: function () { return { x: cursor.x, y: cursor.y }; },
      setCursor: function (x, y) { cursor.x = x; cursor.y = y; cursor.on = true; },
      world: function () {
        if (!world) return null;
        return {
          targets: world.targets.map(function (t) {
            return { id: t.id, x: t.node.x, y: t.node.y, rescued: t.rescued, lost: t.lost, attached: RopePhysics.isAttached(world, t.id) };
          }),
          strands: world.strands.map(function (s) { return { alive: s.alive, tension: s.tension }; }),
          gems: world.gemCount, hooks: world.hooks.length, freezeT: world.freezeT
        };
      },
      skipTime: function (ms) { levelStart -= (ms || 0); updateHud(); },
      pause: function () { if (!paused) togglePause(); },
      resume: function () { if (paused) togglePause(); },
      openMenu: openMenu,
      retry: retry,
      next: nextLevel,
      validateAll: function () { return RopeLevels.validateAll(); }
    };
  }

})();
