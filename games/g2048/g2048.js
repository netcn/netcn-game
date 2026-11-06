/* ============================================================
   2048 · 旗舰版
   - 方块为持久 DOM 实体：transform 过渡完成滑动，合并弹跳 + 粒子
   - 经典 4×4 / 限步障碍（4×4·90 / 5×5·120）/ 每日种子 / 目标关战役
   - 道具：撤销、锤子、洗牌；每日挑战禁用
   - 真实合并计分，BEST 卡与 Arcade.shell.submitScore 结算提交
   核心合并函数用 ==G2048-CORE-START== / ==G2048-CORE-END== 标记包裹。
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.g2048.tut1t'), d: T('gs.g2048.tut1') },
    { t: T('gs.g2048.tut2t'), d: T('gs.g2048.tut2') },
    { t: T('gs.g2048.tut3t'), d: T('gs.g2048.tut3') }
  ];

  /* ==G2048-CORE-START== */
  /* 单段压缩合并：去零 → 相邻相等合并（每格每步只合一次）→ 补零到段长 */
  function compressSeg(vals) {
    var nums = vals.filter(function (v) { return v !== 0; });
    var out = [];
    var gained = 0;
    var mergedAt = [];
    for (var i = 0; i < nums.length; i++) {
      if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
        var v = nums[i] * 2;
        out.push(v);
        gained += v;
        mergedAt.push(out.length - 1);
        i++;
      } else {
        out.push(nums[i]);
      }
    }
    while (out.length < vals.length) out.push(0);
    while (out.length > vals.length) out.pop();
    return { line: out, gained: gained, mergedAt: mergedAt };
  }

  /* 取出沿移动方向的第 i 条线中的第 j 格坐标（靠目标边的格子 j 最小） */
  function linePos(dirKey, i, j, n) {
    if (dirKey === 'left') return { r: i, c: j };
    if (dirKey === 'right') return { r: i, c: n - 1 - j };
    if (dirKey === 'up') return { r: j, c: i };
    return { r: n - 1 - j, c: i };
  }

  function makeEmptyGrid(n) {
    var g = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(0);
      g.push(row);
    }
    return g;
  }
  function makeFalseGrid(n) {
    var g = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(false);
      g.push(row);
    }
    return g;
  }

  function canMoveGrid(g, wall, n) {
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (wall[r][c]) continue;
        if (g[r][c] === 0) return true;
        if (c + 1 < n && !wall[r][c + 1] && g[r][c] === g[r][c + 1]) return true;
        if (r + 1 < n && !wall[r + 1][c] && g[r][c] === g[r + 1][c]) return true;
      }
    }
    return false;
  }
  /* ==G2048-CORE-END== */

  /* ---------- 关卡 / 模式定义 ---------- */
  var CAMPAIGN = [
    { target: 128, moves: 60, size: 4 },
    { target: 256, moves: 70, size: 4 },
    { target: 512, moves: 82, size: 4 },
    { target: 1024, moves: 95, size: 4 },
    { target: 2048, moves: 115, size: 4 },
    { target: 4096, moves: 150, size: 5 }
  ];
  var LIMIT_DEFS = {
    lim4: { size: 4, moves: 90, target: 1024 },
    lim5: { size: 5, moves: 120, target: 2048 }
  };
  var MODES = [
    { key: 'classic', name: 'gs.g2048.modeClassic', meta: '4×4 · ∞' },
    { key: 'lim4', name: 'gs.g2048.modeLimit', meta: '4×4 · 90' },
    { key: 'lim5', name: 'gs.g2048.modeLimit', meta: '5×5 · 120' },
    { key: 'daily', name: 'gs.g2048.modeDaily', meta: 'gs.g2048.modeDailyMeta' },
    { key: 'campaign', name: 'gs.g2048.modeCampaign', meta: 'gs.g2048.modeCampaignMeta' }
  ];

  var BEST_ID = 'g2048';
  var PROGRESS_KEY = 'arcade_g2048_campaign_v1';
  var DAILY_KEY = 'arcade_g2048_daily_v1';
  var MOVE_MS = 130;

  /* ---------- 每日种子（YYYY-M-D → mulberry32） ---------- */
  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seed) {
    var a = seed >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    next.state = function () { return a >>> 0; };
    return next;
  }
  function loadDailyRecord() {
    var today = dayKey();
    try {
      var r = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
      if (r && r.day === today && r.done) {
        return { day: today, best: Number(r.best) || 0, max: Number(r.max) || 0, done: true };
      }
    } catch (e) {}
    return { day: today, best: 0, max: 0, done: false };
  }
  var dailyRecord = loadDailyRecord();

  /* ---------- 战役进度 ---------- */
  function loadCampaign() {
    var out = { cleared: [], best: [] };
    for (var i = 0; i < CAMPAIGN.length; i++) { out.cleared.push(false); out.best.push(0); }
    try {
      var raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
      if (raw) {
        var seq = true;
        for (var j = 0; j < CAMPAIGN.length; j++) {
          var done = !!(raw.cleared && raw.cleared[j]);
          if (!seq) done = false;
          out.cleared[j] = done;
          seq = done;
          var b = Number(raw.best && raw.best[j]);
          out.best[j] = isFinite(b) && b > 0 ? b : 0;
        }
      }
    } catch (e) {}
    return out;
  }
  var campaign = loadCampaign();
  function saveCampaign() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(campaign)); } catch (e) {}
  }
  function levelUnlocked(i) {
    return i === 0 || !!campaign.cleared[i - 1];
  }

  /* ---------- 运行状态 ---------- */
  var modeKey = 'classic';
  var SIZE = 4;
  var grid, tiles, blocked;
  var score = 0;
  var movesLeft = null;
  var movesUsed = 0;
  var target = 2048;
  var props = { undo: 0, hammer: 0, shuffle: 0 };
  var over = false, won = false, resultKind = null;
  var campaignLevel = 0;
  var dailyDay = '';
  var dailyRng = null;
  var dailyPractice = false;
  var dailyJustRecorded = false;
  var hammerArmed = false;
  var undoStack = [];
  var nextTileId = 1;
  var best = 0;
  var animLock = false;
  var pendingDirs = [];
  var runToken = 0;
  var timers = [];

  function isLimited() { return modeKey === 'lim4' || modeKey === 'lim5'; }
  function isCampaign() { return modeKey === 'campaign'; }
  function isDaily() { return modeKey === 'daily'; }
  function rand01() { return (isDaily() && dailyRng) ? dailyRng() : Math.random(); }

  /* ---------- 计时器 / 局次令牌：重开与撤销时统一清理 ---------- */
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }
  function bumpRun() {
    runToken++;
    clearTimers();
  }
  function later(ms, fn) {
    var tok = runToken;
    var id = setTimeout(function () {
      var idx = timers.indexOf(id);
      if (idx >= 0) timers.splice(idx, 1);
      if (tok === runToken) fn();
    }, ms);
    timers.push(id);
  }

  function audio(name) {
    if (window.Arcade && Arcade.audio) Arcade.audio.play(name);
  }
  function toast(msg, type) {
    if (window.Arcade && Arcade.ui && Arcade.ui.toast) Arcade.ui.toast(msg, type || '');
  }

  function bestScore() {
    try {
      return (window.Arcade && Arcade.storage && Arcade.storage.getBest(BEST_ID)) || 0;
    } catch (e) { return 0; }
  }
  function refreshBest() {
    best = bestScore();
    bestEl.textContent = String(best);
  }

  /* ---------- 本地存档（共享模块 Arcade.savegame） ---------- */
  function writeSave() {
    return !!(window.Arcade && Arcade.savegame && Arcade.savegame.write());
  }
  function clearSave() {
    if (window.Arcade && Arcade.savegame) Arcade.savegame.clear();
  }
  function tryResume() {
    return !!(window.Arcade && Arcade.savegame && Arcade.savegame.resume());
  }

  /* ---------- 棋盘尺寸 / 坐标 ---------- */
  function emptyTiles() {
    var g = [];
    for (var r = 0; r < SIZE; r++) {
      var row = [];
      for (var c = 0; c < SIZE; c++) row.push(null);
      g.push(row);
    }
    return g;
  }
  function cloneGrid(g) {
    return g.map(function (row) { return row.slice(); });
  }

  function setBoardSize(n) {
    SIZE = n;
    boardEl.style.setProperty('--n', String(n));
    boardEl.style.setProperty('--gap', n >= 5 ? '6px' : '8px');
    boardEl.style.setProperty('--pad', n >= 5 ? '9px' : '10px');
  }
  function buildBgGrid() {
    var html = '';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        html += '<div class="g2048-gcell' + (blocked[r][c] ? ' blocked' : '') + '"></div>';
      }
    }
    bgGrid.innerHTML = html;
  }

  function metrics() {
    var w = boardEl.clientWidth || 360;
    var pad = parseFloat(getComputedStyle(boardEl).paddingLeft) || 10;
    var cs = getComputedStyle(bgGrid);
    var gap = parseFloat(cs.columnGap || cs.gap);
    if (!isFinite(gap)) gap = SIZE >= 5 ? 6 : 8;
    var inner = w - pad * 2;
    var cell = Math.max(8, (inner - gap * (SIZE - 1)) / SIZE);
    return { w: w, pad: pad, gap: gap, cell: cell, step: cell + gap };
  }

  /* ---------- 方块 DOM ---------- */
  function faceClass(v) {
    return 'g2048-tile-inner v' + (v <= 2048 ? v : 'super');
  }
  function makeTile(v, r, c) {
    var el = document.createElement('div');
    el.className = 'g2048-tile';
    var inner = document.createElement('div');
    inner.className = faceClass(v);
    var span = document.createElement('span');
    span.textContent = String(v);
    inner.appendChild(span);
    el.appendChild(inner);
    var t = { id: nextTileId++, v: v, r: r, c: c, el: el, inner: inner, span: span };
    tileLayer.appendChild(el);
    return t;
  }
  function updateTileFace(t, v) {
    t.v = v;
    t.span.textContent = String(v);
    t.inner.className = faceClass(v);
  }
  function place(t, animate, m) {
    m = m || metrics();
    if (!animate) t.el.classList.add('no-anim');
    t.el.style.transform = 'translate3d(' + (m.step * t.c) + 'px,' + (m.step * t.r) + 'px,0)';
    if (!animate) {
      requestAnimationFrame(function () { t.el.classList.remove('no-anim'); });
    }
  }
  function layoutAll(instant) {
    var m = metrics();
    boardEl.style.setProperty('--cell', m.cell + 'px');
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var t = tiles[r][c];
        if (t) place(t, !instant, m);
      }
    }
  }
  function rebuildTiles() {
    tileLayer.innerHTML = '';
    tiles = emptyTiles();
    nextTileId = 1;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[r][c];
        if (v !== 0 && !blocked[r][c]) tiles[r][c] = makeTile(v, r, c);
      }
    }
    layoutAll(true);
  }

  function emptyCells() {
    var list = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0 && !blocked[r][c]) list.push([r, c]);
      }
    }
    return list;
  }

  function addRandomTile(animate) {
    var empty = emptyCells();
    if (!empty.length) return null;
    var pick = empty[Math.floor(rand01() * empty.length)];
    var v = rand01() < 0.9 ? 2 : 4;
    var m = metrics();
    boardEl.style.setProperty('--cell', m.cell + 'px');
    var t = makeTile(v, pick[0], pick[1]);
    grid[pick[0]][pick[1]] = v;
    tiles[pick[0]][pick[1]] = t;
    place(t, false, m);
    if (animate) {
      t.inner.classList.add('tile-new');
      later(220, function () { t.inner.classList.remove('tile-new'); });
      audio('ui');
    }
    return t;
  }

  function maxTile() {
    var mx = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] > mx) mx = grid[r][c];
      }
    }
    return mx;
  }
  function updateMaxTile() {
    maxTileEl.textContent = String(maxTile());
  }

  function floatGain(gained) {
    if (!gained) return;
    var span = document.createElement('span');
    span.className = 'g2k-gain';
    span.textContent = '+' + gained;
    scoreCardEl.appendChild(span);
    later(950, function () {
      if (span.parentNode) span.parentNode.removeChild(span);
    });
  }
  function removeGains() {
    var gains = scoreCardEl.querySelectorAll('.g2k-gain');
    for (var i = 0; i < gains.length; i++) {
      if (gains[i].parentNode) gains[i].parentNode.removeChild(gains[i]);
    }
  }

  function burstAtCell(r, c, color, count) {
    if (!(window.Arcade && Arcade.fx)) return;
    var m = metrics();
    var rect = bgGrid.getBoundingClientRect();
    var x = rect.left + m.step * c + m.cell / 2;
    var y = rect.top + m.step * r + m.cell / 2;
    Arcade.fx.burst(x, y, color, count);
  }
  function mergeColor(v) {
    if (v >= 2048) return 'var(--neon-yellow)';
    if (v >= 512) return 'var(--neon-yellow)';
    if (v >= 128) return 'var(--neon-orange)';
    if (v >= 32) return 'var(--neon-pink)';
    if (v >= 8) return 'var(--neon-green)';
    return 'var(--neon-cyan)';
  }

  /* ---------- HUD ---------- */
  function modeLabel() {
    if (isLimited()) return T('gs.g2048.modeLimit') + ' ' + SIZE + '×' + SIZE;
    if (isCampaign()) return T('gs.g2048.modeCampaign') + ' ' + (campaignLevel + 1) + '/' + CAMPAIGN.length;
    if (isDaily()) return T('gs.g2048.modeDaily');
    return T('gs.g2048.modeClassic');
  }
  function goalLabel() {
    if (isClassic()) return '2048';
    if (isDaily()) return '—';
    return String(target);
  }
  function isClassic() { return modeKey === 'classic'; }

  function updateHud() {
    scoreEl.textContent = String(score);
    movesEl.textContent = movesLeft === null ? '∞' : String(Math.max(0, movesLeft));
    modeEl.textContent = modeLabel();
    goalEl.textContent = goalLabel();
    updateMaxTile();
    var low = movesLeft !== null && movesLeft <= 10 && !resultKind;
    var nearFull = !resultKind && emptyCells().length <= 1;
    movesCard.classList.toggle('danger', low || nearFull);
    boardEl.classList.toggle('danger', low || nearFull);
    if (!resultKind && movesLeft !== null) {
      if (low) msg(T('gs.g2048.movesWarn').replace('{n}', Math.max(0, movesLeft)), 'var(--neon-pink)');
      else if (isLimited()) msg(T('gs.g2048.limitGoal').replace('{t}', target).replace('{m}', movesLeft), '');
      else if (isCampaign()) msg(T('gs.g2048.campaignGoal').replace('{n}', campaignLevel + 1).replace('{t}', target).replace('{m}', movesLeft), '');
    }
    updateTools();
  }

  function updateTools() {
    var daily = isDaily();
    var counts = {
      undo: props.undo, hammer: props.hammer, shuffle: props.shuffle
    };
    for (var k in counts) {
      var btn = toolBtns[k];
      if (!btn) continue;
      var cntEl = btn.querySelector('.g2k-prop-count');
      if (cntEl) cntEl.textContent = String(counts[k]);
      var empty = daily || counts[k] <= 0;
      btn.classList.toggle('empty', empty);
      btn.setAttribute('aria-disabled', empty ? 'true' : 'false');
    }
    toolBtns.hammer.classList.toggle('armed', hammerArmed);
    boardEl.classList.toggle('hammer-on', hammerArmed);
  }

  function msg(text, color) {
    msgEl.textContent = text;
    msgEl.style.color = color || '';
  }
  function modeMsg() {
    if (isLimited()) {
      msg(T('gs.g2048.limitGoal').replace('{t}', target).replace('{m}', movesLeft), '');
    } else if (isCampaign()) {
      msg(T('gs.g2048.campaignGoal').replace('{n}', campaignLevel + 1).replace('{t}', target).replace('{m}', movesLeft), '');
    } else if (isDaily()) {
      msg(T('gs.g2048.dailySeed').replace('{s}', dailyDay), 'var(--neon-cyan)');
    } else {
      msg(T('gs.g2048.hint'), '');
    }
  }

  function updateDailyNote() {
    if (!isDaily()) {
      dailyNote.classList.add('hidden');
      return;
    }
    dailyRecord = loadDailyRecord();
    dailyNote.classList.remove('hidden');
    dailyNote.classList.toggle('done', !!dailyRecord.done);
    dailyNote.textContent = dailyRecord.done
      ? T('gs.g2048.dailyNoteDone').replace('{s}', dailyRecord.best) + ' · ' + dailyDay
      : T('gs.g2048.dailyNoteOpen') + ' · ' + dailyDay;
  }

  function updateModeButtons() {
    var btns = modeRow.querySelectorAll('[data-mode]');
    for (var i = 0; i < btns.length; i++) {
      var k = btns[i].getAttribute('data-mode');
      var active = (k === modeKey) ||
        (isLimited() && k === modeKey);
      btns[i].classList.toggle('active', active);
    }
  }

  /* ---------- 结算面板 ---------- */
  function hideResult() {
    layerEl.classList.add('hidden');
    layerEl.setAttribute('aria-hidden', 'true');
    resultKind = null;
  }

  function settle(kind) {
    if (resultKind) return;
    resultKind = kind;
    animLock = false;
    pendingDirs = [];
    hammerArmed = false;

    var newRecord = false;
    if (score > 0) {
      try {
        if (window.Arcade && Arcade.shell && Arcade.shell.submitScore) {
          newRecord = !!Arcade.shell.submitScore(score);
        } else if (window.Arcade && Arcade.storage) {
          newRecord = !!Arcade.storage.submitBest(BEST_ID, score, 'max');
        }
      } catch (e) {}
    }
    refreshBest();

    if (isCampaign()) {
      campaign.best[campaignLevel] = Math.max(campaign.best[campaignLevel] || 0, score);
      if (kind === 'win') campaign.cleared[campaignLevel] = true;
      saveCampaign();
    }

    var maxV = maxTile();
    resScore.textContent = String(score);
    resBest.textContent = String(best);
    resMax.textContent = String(maxV);
    resBadge.classList.toggle('hidden', !newRecord);

    if (isDaily()) {
      resTitle.textContent = T('gs.g2048.dailyDoneTitle');
      resSub.textContent = dailyJustRecorded
        ? T('gs.g2048.dailySubDone').replace('{s}', score).replace('{m}', maxV)
        : T('gs.g2048.dailySubPractice');
      resGoal.textContent = T('gs.g2048.dailySeed').replace('{s}', dailyDay) + ' · ' + T('gs.g2048.dailyUnlimited');
      audio('daily');
      if (window.Arcade && Arcade.fx) Arcade.fx.centerBurst('var(--neon-cyan)', 20);
    } else if (kind === 'win') {
      if (isCampaign()) {
        resTitle.textContent = T('gs.g2048.campaignWinTitle');
        resSub.textContent = T('gs.g2048.campaignWinSub').replace('{n}', campaignLevel + 1).replace('{t}', target);
      } else if (isLimited()) {
        resTitle.textContent = T('gs.g2048.limitWinTitle');
        resSub.textContent = T('gs.g2048.limitWinSub').replace('{m}', movesUsed).replace('{t}', target);
      } else {
        resTitle.textContent = T('gs.g2048.winTitle');
        resSub.textContent = T('gs.g2048.winSub');
      }
      resGoal.textContent = isCampaign()
        ? T('gs.g2048.campaignGoal').replace('{n}', campaignLevel + 1).replace('{t}', target).replace('{m}', movesLeft)
        : T('gs.g2048.goal') + ' ' + (isLimited() ? target : 2048);
      if (window.Arcade && Arcade.juice && Arcade.juice.win) Arcade.juice.win();
      else {
        audio('win');
        if (window.Arcade && Arcade.fx) {
          Arcade.fx.centerBurst('var(--neon-yellow)', 26);
          Arcade.fx.flash('var(--neon-yellow)');
        }
      }
    } else {
      var noMoves = movesLeft !== null && movesLeft <= 0 && maxV < target;
      resTitle.textContent = noMoves ? T('gs.g2048.limitLoseTitle') : T('gs.g2048.overTitle');
      resSub.textContent = isCampaign()
        ? T('gs.g2048.campaignLoseSub').replace('{n}', campaignLevel + 1).replace('{t}', target)
        : (isLimited()
          ? T('gs.g2048.limitLoseSub').replace('{m}', movesUsed).replace('{t}', target)
          : T('gs.g2048.overSub'));
      resGoal.textContent = isDaily()
        ? T('gs.g2048.dailySeed').replace('{s}', dailyDay)
        : T('gs.g2048.resGoal').replace('{t}', target).replace('{m}', movesLeft === null ? '∞' : Math.max(0, movesLeft));
      audio('lose');
      if (window.Arcade && Arcade.fx) Arcade.fx.shake(boardEl);
    }

    var cont = !isDaily() && !isCampaign() && !isLimited() && kind === 'win';
    var next = isCampaign() && kind === 'win' && campaignLevel + 1 < CAMPAIGN.length;
    resContinue.classList.toggle('hidden', !cont);
    resNext.classList.toggle('hidden', !next);
    resLevels.classList.toggle('hidden', !isCampaign());
    resRestart.textContent = T('gs.g2048.again');

    layerEl.className = 'g2k-layer ' + (kind === 'lose' ? 'lose' : 'win');
    layerEl.setAttribute('aria-hidden', 'false');
    updateTools();
    writeSave();
  }

  function finishDaily() {
    if (dailyPractice) return false;
    if (score <= 0) return false;
    dailyRecord = { day: dailyDay, best: score, max: maxTile(), done: true };
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(dailyRecord)); } catch (e) {}
    dailyPractice = true;
    dailyJustRecorded = true;
    return true;
  }

  function checkSettle() {
    if (resultKind) return true;
    var mt = maxTile();

    if ((isLimited() || isCampaign()) && mt >= target) {
      settle('win');
      return true;
    }
    if (isClassic() && !won && mt >= 2048) {
      won = true;
      settle('win');
      return true;
    }
    if ((isLimited() || isCampaign()) && movesLeft !== null && movesLeft <= 0 && mt < target) {
      over = true;
      settle('lose');
      return true;
    }
    if (!canMoveGrid(grid, blocked, SIZE)) {
      if (isDaily()) {
        finishDaily();
        updateDailyNote();
        settle('win');
        return true;
      }
      over = true;
      settle('lose');
      return true;
    }
    writeSave();
    return false;
  }

  /* ---------- 一次移动 ---------- */
  function buildMove(dirKey) {
    var newGrid = makeEmptyGrid(SIZE);
    var newTiles = emptyTiles();
    var plans = [];
    var merges = [];
    var gained = 0;

    for (var i = 0; i < SIZE; i++) {
      var j = 0;
      while (j < SIZE) {
        var p0 = linePos(dirKey, i, j, SIZE);
        if (blocked[p0.r][p0.c]) { j++; continue; }
        var segPos = [];
        var e = j;
        while (e < SIZE) {
          var pe = linePos(dirKey, i, e, SIZE);
          if (blocked[pe.r][pe.c]) break;
          segPos.push(pe);
          e++;
        }
        var vals = [];
        var src = [];
        for (var k = 0; k < segPos.length; k++) {
          var q = segPos[k];
          vals.push(grid[q.r][q.c]);
          if (tiles[q.r][q.c]) src.push(tiles[q.r][q.c]);
        }
        var res = compressSeg(vals);
        gained += res.gained;

        var si = 0;
        for (var j2 = 0; j2 < segPos.length; j2++) {
          var val = res.line[j2];
          if (val === 0) continue;
          var p = segPos[j2];
          if (res.mergedAt.indexOf(j2) !== -1) {
            var a = src[si++];
            var b = src[si++];
            if (!a || !b) continue;
            newGrid[p.r][p.c] = val;
            newTiles[p.r][p.c] = a;
            plans.push({ tile: a, r: p.r, c: p.c, v: val, merge: true });
            plans.push({ tile: b, r: p.r, c: p.c, remove: true });
            merges.push({ r: p.r, c: p.c, v: val });
          } else {
            var t = src[si++];
            if (!t) continue;
            newGrid[p.r][p.c] = val;
            newTiles[p.r][p.c] = t;
            plans.push({ tile: t, r: p.r, c: p.c, v: val });
          }
        }
        j = e;
      }
    }
    return { grid: newGrid, tiles: newTiles, plans: plans, merges: merges, gained: gained };
  }

  function snapshot() {
    return {
      grid: cloneGrid(grid),
      score: score,
      movesLeft: movesLeft,
      movesUsed: movesUsed,
      won: won
    };
  }

  function doMove(dirKey) {
    if (over || resultKind || animLock || hammerArmed) return false;
    var built = buildMove(dirKey);

    var moved = false;
    for (var r2 = 0; r2 < SIZE; r2++) {
      for (var c2 = 0; c2 < SIZE; c2++) {
        if (grid[r2][c2] !== built.grid[r2][c2]) { moved = true; break; }
      }
      if (moved) break;
    }
    if (!moved) return false;

    if (props.undo > 0) {
      undoStack.push(snapshot());
      if (undoStack.length > 8) undoStack.shift();
    }

    grid = built.grid;
    tiles = built.tiles;
    score += built.gained;
    movesUsed++;
    if (movesLeft !== null) movesLeft = Math.max(0, movesLeft - 1);

    scoreEl.textContent = String(score);
    if (built.gained > 0) floatGain(built.gained);
    audio('move');
    updateHud();

    var m = metrics();
    for (var k = 0; k < built.plans.length; k++) {
      var pl = built.plans[k];
      var tile = pl.tile;
      tile.r = pl.r;
      tile.c = pl.c;
      if (pl.remove) {
        tile.el.style.zIndex = '1';
      } else {
        if (pl.merge) tile.el.style.zIndex = '2';
        else if (pl.v !== tile.v) updateTileFace(tile, pl.v);
      }
      place(tile, true, m);
    }

    animLock = true;
    later(MOVE_MS, function () { finishMove(built.plans, built.merges); });
    return true;
  }

  function finishMove(plans, merges) {
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].remove) {
        var dead = plans[i].tile;
        dead.el.style.zIndex = '';
        if (dead.el.parentNode) dead.el.parentNode.removeChild(dead.el);
      }
    }

    var maxMerged = 0;
    for (var j = 0; j < merges.length; j++) {
      var mg = merges[j];
      if (mg.v > maxMerged) maxMerged = mg.v;
      var tile = tiles[mg.r][mg.c];
      if (tile) {
        updateTileFace(tile, mg.v);
        tile.inner.classList.add('tile-merged');
        (function (t) {
          later(280, function () { t.inner.classList.remove('tile-merged'); });
        })(tile);
      }
      burstAtCell(mg.r, mg.c, mergeColor(mg.v), 14);
    }
    if (merges.length) audio('match');
    if (maxMerged >= 1024 && window.Arcade && Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');

    addRandomTile(true);
    updateHud();

    animLock = false;
    var settled = checkSettle();
    if (!settled) drain();
  }

  /* ---------- 输入队列：连续滑动不丢步 ---------- */
  function drain() {
    if (animLock || resultKind) return;
    while (pendingDirs.length) {
      var d = pendingDirs.shift();
      if (doMove(d)) return;
    }
  }
  function requestMove(dirKey) {
    if (resultKind || hammerArmed) return;
    if (animLock) {
      if (pendingDirs.length < 5) pendingDirs.push(dirKey);
      return;
    }
    if (!doMove(dirKey)) drain();
  }

  /* ---------- 道具 ---------- */
  function disarmHammer() {
    hammerArmed = false;
    updateTools();
  }

  function useUndo() {
    if (resultKind) return;
    if (isDaily()) { toast(T('gs.g2048.propDailyOff'), 'warn'); return; }
    if (animLock) return;
    if (props.undo <= 0) { toast(T('gs.g2048.propEmpty'), 'warn'); return; }
    if (!undoStack.length) { toast(T('gs.g2048.undoNone'), 'warn'); return; }
    var s = undoStack.pop();
    props.undo--;
    bumpRun();
    removeGains();
    pendingDirs = [];
    animLock = false;
    hammerArmed = false;
    grid = cloneGrid(s.grid);
    score = Number(s.score) || 0;
    movesLeft = s.movesLeft === null ? null : Math.max(0, Number(s.movesLeft) || 0);
    movesUsed = Math.max(0, Number(s.movesUsed) || 0);
    won = !!s.won;
    over = false;
    rebuildTiles();
    updateHud();
    refreshBest();
    msg(T('gs.g2048.undone'), '');
    audio('back');
    writeSave();
  }

  function armHammer() {
    if (resultKind) return;
    if (isDaily()) { toast(T('gs.g2048.propDailyOff'), 'warn'); return; }
    if (animLock) return;
    if (props.hammer <= 0) { toast(T('gs.g2048.propEmpty'), 'warn'); return; }
    hammerArmed = !hammerArmed;
    updateTools();
    if (hammerArmed) msg(T('gs.g2048.hammerHint'), 'var(--neon-orange)');
    else modeMsg();
  }

  function cellFromPoint(clientX, clientY) {
    var rect = bgGrid.getBoundingClientRect();
    var m = metrics();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    var c = Math.floor(x / m.step);
    var r = Math.floor(y / m.step);
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
    return { r: r, c: c };
  }

  function hammerCell(r, c) {
    if (blocked[r][c] || !grid[r][c]) {
      toast(T('gs.g2048.hammerEmpty'), 'warn');
      return false;
    }
    var v = grid[r][c];
    var t = tiles[r][c];
    burstAtCell(r, c, mergeColor(v), 12);
    audio('clear');
    if (t) {
      t.inner.classList.add('tile-hammer');
      (function (el) {
        later(230, function () { if (el.parentNode) el.parentNode.removeChild(el); });
      })(t.el);
    }
    grid[r][c] = 0;
    tiles[r][c] = null;
    props.hammer--;
    disarmHammer();
    updateHud();
    msg(T('gs.g2048.hammered'), 'var(--neon-orange)');
    writeSave();
    return true;
  }

  function shuffleBoard() {
    if (resultKind) return;
    if (isDaily()) { toast(T('gs.g2048.propDailyOff'), 'warn'); return; }
    if (animLock) return;
    if (props.shuffle <= 0) { toast(T('gs.g2048.propEmpty'), 'warn'); return; }

    var vals = [];
    var tls = [];
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (blocked[r][c]) continue;
        cells.push([r, c]);
        if (grid[r][c]) { vals.push(grid[r][c]); tls.push(tiles[r][c]); }
      }
    }
    if (!vals.length) return;

    for (var i = cells.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
    }

    grid = makeEmptyGrid(SIZE);
    tiles = emptyTiles();
    for (var k = 0; k < vals.length; k++) {
      var pos = cells[k];
      grid[pos[0]][pos[1]] = vals[k];
      var t = tls[k];
      t.r = pos[0];
      t.c = pos[1];
      tiles[pos[0]][pos[1]] = t;
      place(t, true, metrics());
    }

    props.shuffle--;
    hammerArmed = false;
    addRandomTile(true);
    updateHud();
    audio('clear');
    msg(T('gs.g2048.shuffled'), 'var(--neon-purple)');
    writeSave();
    var settled = checkSettle();
    if (!settled) drain();
  }

  /* ---------- 开局 / 读档 ---------- */
  function genObstacles(n, count) {
    var cells = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) cells.push([r, c]);
    }
    for (var i = cells.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
    }
    var wall = makeFalseGrid(n);
    for (var k = 0; k < count && k < cells.length; k++) {
      wall[cells[k][0]][cells[k][1]] = true;
    }
    return wall;
  }

  function startRun(key, level) {
    bumpRun();
    if (key) modeKey = key;
    resultKind = null;
    layerEl.className = 'g2k-layer hidden';
    layerEl.setAttribute('aria-hidden', 'true');
    levelLayer.classList.add('hidden');
    levelLayer.setAttribute('aria-hidden', 'true');
    removeGains();
    over = false;
    won = false;
    score = 0;
    movesUsed = 0;
    undoStack = [];
    pendingDirs = [];
    animLock = false;
    hammerArmed = false;
    dailyJustRecorded = false;
    dailyRng = null;
    dailyDay = '';
    dailyPractice = false;
    blocked = null;

    if (isLimited()) {
      var def = LIMIT_DEFS[modeKey];
      SIZE = def.size;
      target = def.target;
      movesLeft = def.moves;
      blocked = genObstacles(SIZE, 2 + Math.floor(Math.random() * 3));
      props = { undo: 2, hammer: 2, shuffle: 1 };
    } else if (isCampaign()) {
      campaignLevel = parseInt(level, 10);
      if (!(campaignLevel >= 0 && campaignLevel < CAMPAIGN.length)) campaignLevel = 0;
      var lv = CAMPAIGN[campaignLevel];
      SIZE = lv.size;
      target = lv.target;
      movesLeft = lv.moves;
      blocked = makeFalseGrid(SIZE);
      props = { undo: 2, hammer: 2, shuffle: 1 };
    } else if (isDaily()) {
      SIZE = 4;
      target = 0;
      movesLeft = null;
      blocked = makeFalseGrid(4);
      dailyDay = dayKey();
      dailyRecord = loadDailyRecord();
      dailyPractice = !!dailyRecord.done;
      dailyRng = makeRng(hashSeed(dailyDay));
      props = { undo: 0, hammer: 0, shuffle: 0 };
    } else {
      SIZE = 4;
      target = 2048;
      movesLeft = null;
      blocked = makeFalseGrid(4);
      props = { undo: 2, hammer: 2, shuffle: 1 };
    }

    setBoardSize(SIZE);
    buildBgGrid();
    tileLayer.innerHTML = '';
    grid = makeEmptyGrid(SIZE);
    tiles = emptyTiles();
    nextTileId = 1;

    addRandomTile(false);
    addRandomTile(false);
    layoutAll(true);

    scoreEl.textContent = '0';
    refreshBest();
    updateModeButtons();
    updateDailyNote();
    updateHud();
    modeMsg();
    clearSave();
    writeSave();
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return false;
    var key = s.modeKey;
    if (['classic', 'lim4', 'lim5', 'daily', 'campaign'].indexOf(key) < 0) return false;
    var n = Number(s.size);
    if (!(n === 4 || n === 5)) return false;
    if (key === 'classic' || key === 'daily') { if (n !== 4) return false; }
    if (key === 'lim4') { if (n !== 4) return false; }
    if (key === 'lim5') { if (n !== 5) return false; }
    if (!Array.isArray(s.grid) || s.grid.length !== n) return false;

    for (var r = 0; r < n; r++) {
      if (!Array.isArray(s.grid[r]) || s.grid[r].length !== n) return false;
      for (var c = 0; c < n; c++) {
        var v = s.grid[r][c];
        if (!isFinite(v) || v < 0) return false;
      }
    }

    var wall = makeFalseGrid(n);
    if (Array.isArray(s.blocked) && s.blocked.length === n) {
      for (var br = 0; br < n; br++) {
        if (!Array.isArray(s.blocked[br]) || s.blocked[br].length !== n) return false;
        for (var bc = 0; bc < n; bc++) wall[br][bc] = !!s.blocked[br][bc];
      }
    }
    for (var wr = 0; wr < n; wr++) {
      for (var wc = 0; wc < n; wc++) if (wall[wr][wc]) s.grid[wr][wc] = 0;
    }

    var lvl = parseInt(s.campaignLevel, 10);
    if (!(lvl >= 0 && lvl < CAMPAIGN.length)) lvl = 0;
    if (key === 'campaign' && n !== CAMPAIGN[lvl].size) return false;
    if (key === 'daily') {
      if (!s.dailyDay || s.dailyDay !== dayKey()) return false;
    }

    var sc = Number(s.score);
    if (!isFinite(sc) || sc < 0) sc = 0;
    var mv = s.movesLeft;
    if (key === 'classic' || key === 'daily') mv = null;
    else {
      mv = Number(mv);
      if (!isFinite(mv) || mv < 0) return false;
    }
    var pr = s.props || {};
    var pUndo = Number(pr.undo), pHam = Number(pr.hammer), pShf = Number(pr.shuffle);
    pUndo = isFinite(pUndo) ? Math.max(0, Math.min(2, pUndo)) : 0;
    pHam = isFinite(pHam) ? Math.max(0, Math.min(2, pHam)) : 0;
    pShf = isFinite(pShf) ? Math.max(0, Math.min(2, pShf)) : 0;

    var stack = [];
    if (Array.isArray(s.undoStack)) {
      for (var ui = 0; ui < s.undoStack.length && stack.length < 8; ui++) {
        var u = s.undoStack[ui];
        if (!u || !Array.isArray(u.grid) || u.grid.length !== n) continue;
        var ok = true;
        for (var ur = 0; ur < n; ur++) {
          if (!Array.isArray(u.grid[ur]) || u.grid[ur].length !== n) { ok = false; break; }
          for (var uc = 0; uc < n; uc++) {
            if (!isFinite(u.grid[ur][uc]) || u.grid[ur][uc] < 0) { ok = false; break; }
          }
          if (!ok) break;
        }
        if (!ok) continue;
        stack.push({
          grid: u.grid.map(function (row) { return row.slice(); }),
          score: Number(u.score) || 0,
          movesLeft: (u.movesLeft === null || u.movesLeft === undefined) ? null : Math.max(0, Number(u.movesLeft) || 0),
          movesUsed: Math.max(0, Number(u.movesUsed) || 0),
          won: !!u.won
        });
      }
    }

    bumpRun();
    modeKey = key;
    SIZE = n;
    campaignLevel = lvl;
    blocked = wall;
    grid = s.grid.map(function (row) { return row.map(function (v) { return Number(v) || 0; }); });
    score = sc;
    movesLeft = mv;
    movesUsed = Math.max(0, Number(s.movesUsed) || 0);
    won = !!s.won;
    over = false;
    resultKind = null;
    pendingDirs = [];
    animLock = false;
    hammerArmed = false;
    undoStack = stack;
    props = { undo: pUndo, hammer: pHam, shuffle: pShf };
    dailyDay = key === 'daily' ? s.dailyDay : '';
    dailyPractice = !!s.dailyPractice;
    dailyJustRecorded = false;
    dailyRecord = loadDailyRecord();
    if (key === 'daily' && dailyRecord.done) dailyPractice = true;
    dailyRng = key === 'daily' ? makeRng(Number(s.dailySeed) || hashSeed(dailyDay)) : null;
    target = isClassic() ? 2048 : (isDaily() ? 0 : (isCampaign() ? CAMPAIGN[campaignLevel].target : LIMIT_DEFS[modeKey].target));

    setBoardSize(SIZE);
    buildBgGrid();
    tileLayer.innerHTML = '';
    rebuildTiles();
    nextTileId = 1;
    layerEl.className = 'g2k-layer hidden';
    layerEl.setAttribute('aria-hidden', 'true');
    levelLayer.classList.add('hidden');
    levelLayer.setAttribute('aria-hidden', 'true');
    removeGains();
    refreshBest();
    updateModeButtons();
    updateDailyNote();
    updateHud();
    modeMsg();
    return true;
  }

  /* ---------- 面板 / 事件 ---------- */
  function boot() {
  function openLevels() {
    renderLevels();
    levelLayer.classList.remove('hidden');
    levelLayer.setAttribute('aria-hidden', 'false');
  }
  function closeLevels() {
    levelLayer.classList.add('hidden');
    levelLayer.setAttribute('aria-hidden', 'true');
  }
  function renderLevels() {
    var doneCount = 0;
    for (var d = 0; d < CAMPAIGN.length; d++) if (campaign.cleared[d]) doneCount++;
    levelSub.textContent = T('gs.g2048.campaignSub') + ' ' +
      T('gs.g2048.campaignProgress').replace('{c}', doneCount).replace('{n}', CAMPAIGN.length);
    var html = '';
    for (var i = 0; i < CAMPAIGN.length; i++) {
      var lv = CAMPAIGN[i];
      var locked = !levelUnlocked(i);
      var cleared = !!campaign.cleared[i];
      var stateText = locked
        ? T('gs.g2048.lvLocked')
        : (cleared
          ? T('gs.g2048.lvCleared') + (campaign.best[i] ? ' · ' + T('gs.g2048.lvBest') + ' ' + campaign.best[i] : '')
          : T('gs.g2048.lvOpen'));
      html += '<button type="button" class="g2k-level' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '') +
        '" data-level="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        '<span class="lv-no">' + (i + 1) + '</span>' +
        '<span class="lv-body"><b class="lv-target">' + lv.target + '</b>' +
        '<span class="lv-meta">' + lv.size + '×' + lv.size + ' · ' + lv.moves + T('gs.g2048.movesUnit') + '</span></span>' +
        '<span class="lv-state">' + stateText + '</span>' +
        '</button>';
    }
    levelList.innerHTML = html;
  }

  restartBtn.addEventListener('click', function () {
    audio('ui');
    startRun(modeKey, campaignLevel);
  });
  saveBtn.addEventListener('click', function () {
    if (writeSave()) {
      msg(T('gs.g2048.saved'), 'var(--neon-green)');
    } else {
      msg(T('gs.g2048.saveFail'), 'var(--neon-pink)');
    }
  });
  toolBtns.undo.addEventListener('click', function () { if (!resultKind) useUndo(); });
  toolBtns.hammer.addEventListener('click', function () { if (!resultKind) armHammer(); });
  toolBtns.shuffle.addEventListener('click', function () { if (!resultKind) shuffleBoard(); });

  resRestart.addEventListener('click', function () {
    hideResult();
    startRun(modeKey, campaignLevel);
  });
  resContinue.addEventListener('click', function () {
    if (resultKind !== 'win' || isCampaign() || isLimited() || isDaily()) return;
    hideResult();
    pendingDirs = [];
    animLock = false;
    audio('ui');
    msg(T('gs.g2048.endless'), 'var(--neon-cyan)');
    if (!canMoveGrid(grid, blocked, SIZE)) {
      over = true;
      settle('lose');
      return;
    }
    writeSave();
  });
  resNext.addEventListener('click', function () {
    if (!isCampaign() || campaignLevel + 1 >= CAMPAIGN.length) return;
    hideResult();
    startRun('campaign', campaignLevel + 1);
  });
  resLevels.addEventListener('click', function () {
    hideResult();
    openLevels();
  });
  levelClose.addEventListener('click', closeLevels);
  levelList.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-level]') : null;
    if (!btn) return;
    var i = parseInt(btn.getAttribute('data-level'), 10);
    if (isNaN(i) || !levelUnlocked(i)) return;
    audio('ui');
    closeLevels();
    startRun('campaign', i);
  });

  var modeBtns = modeRow.querySelectorAll('[data-mode]');
  for (var bi = 0; bi < modeBtns.length; bi++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.getAttribute('data-mode');
        audio('ui');
        if (k === 'campaign') { openLevels(); return; }
        startRun(k);
      });
    })(modeBtns[bi]);
  }

  Arcade.input.onKeys({
    up: function () { requestMove('up'); },
    down: function () { requestMove('down'); },
    left: function () { requestMove('left'); },
    right: function () { requestMove('right'); }
  });

  /* ---------- 指针：触屏滑动 / 鼠标拖拽 / 锤子点选 ---------- */
  var drag = null;
  boardEl.addEventListener('pointerdown', function (e) {
    if (resultKind) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  boardEl.addEventListener('pointerup', function (e) {
    if (!drag || drag.id !== e.pointerId) { drag = null; return; }
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    drag = null;
    try { boardEl.releasePointerCapture(e.pointerId); } catch (err) {}
    if (hammerArmed) {
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
        var cell = cellFromPoint(e.clientX, e.clientY);
        if (cell) hammerCell(cell.r, cell.c);
      }
      return;
    }
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) requestMove(dx > 0 ? 'right' : 'left');
    else requestMove(dy > 0 ? 'down' : 'up');
  });
  boardEl.addEventListener('pointercancel', function () { drag = null; });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyU') {
      var tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      e.preventDefault();
      useUndo();
    }
  });

  window.addEventListener('resize', function () {
    if (tiles) layoutAll(true);
  });

  if (window.Arcade && Arcade.savegame) {
    Arcade.savegame.setup({
      id: 'g2048',
      collect: function () {
        if (over || resultKind) return null;
        return {
          v: 2,
          modeKey: modeKey,
          size: SIZE,
          grid: grid,
          blocked: blocked,
          score: score,
          movesLeft: movesLeft,
          movesUsed: movesUsed,
          props: { undo: props.undo, hammer: props.hammer, shuffle: props.shuffle },
          campaignLevel: campaignLevel,
          dailyDay: dailyDay,
          dailySeed: dailyRng ? dailyRng.state() : 0,
          dailyPractice: dailyPractice,
          won: won,
          undoStack: undoStack
        };
      },
      apply: applySave,
      msg: 'gs.g2048.saveResume'
    });
  }

  /* ---------- 启动：优先恢复上次进度，否则经典模式新开 ---------- */
  if (!tryResume()) startRun('classic');

  window.GAME_RESTART = function () { startRun(modeKey, campaignLevel); };

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.g2048.helpText');
  root.appendChild(hd);
  }

  /* ---------- DOM ---------- */
  function q(id) { return document.getElementById(id); }

  root.innerHTML =
    '<div class="g2k-head">' +
    '  <div class="g2k-brand">2048<small>' + T('gs.g2048.hint') + '</small></div>' +
    '  <div class="g2k-modes" id="mode-row">' +
    MODES.map(function (m) {
      return '<button type="button" class="g2k-mode" data-mode="' + m.key + '">' +
        '<span class="mode-name">' + T(m.name) + '</span><small>' + (m.meta.indexOf('gs.') === 0 ? T(m.meta) : m.meta) + '</small></button>';
    }).join('') +
    '  </div>' +
    '  <div class="g2k-note hidden" id="daily-note"></div>' +
    '</div>' +
    '<div class="g2k-hud">' +
    '  <div class="g2k-stat g2k-score" id="score-card"><span>' + T('gs.g2048.score') + '</span><b id="score">0</b></div>' +
    '  <div class="g2k-stat g2k-best"><span>' + T('gs.g2048.best') + '</span><b id="best">0</b></div>' +
    '  <div class="g2k-stat g2k-max"><span>' + T('gs.g2048.maxTile') + '</span><b id="max-tile">2</b></div>' +
    '  <div class="g2k-stat g2k-moves" id="moves-card"><span>' + T('gs.g2048.moves') + '</span><b id="moves">∞</b></div>' +
    '  <div class="g2k-stat g2k-modecard"><span>' + T('gs.g2048.mode') + '</span><b class="small" id="mode">—</b></div>' +
    '  <div class="g2k-stat g2k-goalcard"><span>' + T('gs.g2048.goal') + '</span><b class="small" id="goal">2048</b></div>' +
    '</div>' +
    '<div class="g2k-tools" id="tool-row">' +
    '  <button type="button" class="g2k-prop" id="tool-undo" aria-label="' + T('gs.g2048.propUndo') + '">' +
    '    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H15a5 5 0 1 1 0 10H8"/><path d="M9 7l-4 4 4 4"/></svg>' +
    '    <span class="g2k-prop-name">' + T('gs.g2048.propUndo') + '</span><b class="g2k-prop-count">0</b></button>' +
    '  <button type="button" class="g2k-prop" id="tool-hammer" aria-label="' + T('gs.g2048.propHammer') + '">' +
    '    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l6-6"/><path d="M9 15l4-4"/><path d="M13 11l5-5"/><path d="M15 4l5 5-3 3-5-5z"/></svg>' +
    '    <span class="g2k-prop-name">' + T('gs.g2048.propHammer') + '</span><b class="g2k-prop-count">0</b></button>' +
    '  <button type="button" class="g2k-prop" id="tool-shuffle" aria-label="' + T('gs.g2048.propShuffle') + '">' +
    '    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h4l9 10h4"/><path d="M18 4l3 3-3 3"/><path d="M4 17h4l9-10h4"/><path d="M18 14l3 3-3 3"/></svg>' +
    '    <span class="g2k-prop-name">' + T('gs.g2048.propShuffle') + '</span><b class="g2k-prop-count">0</b></button>' +
    '</div>' +
    '<div class="game-message" id="msg">' + T('gs.g2048.hint') + '</div>' +
    '<div class="grid-board g2048-board" id="board">' +
    '  <div class="g2048-grid" id="bg-grid"></div>' +
    '  <div class="g2048-tiles" id="tile-layer"></div>' +
    '</div>' +
    '<div class="game-controls">' +
    '  <button id="save-btn" class="btn">' + T('gs.g2048.saveBtn') + '</button>' +
    '  <button id="restart-btn" class="btn pink">' + T('gs.g2048.restart') + '</button>' +
    '</div>' +
    '<p class="help-text">' + T('gs.g2048.help') + '</p>' +
    '<div class="g2k-layer hidden" id="result-layer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="res-title">' +
    '  <div class="g2k-panel">' +
    '    <span class="g2k-badge hidden" id="res-badge">' + T('gs.g2048.newRecord') + '</span>' +
    '    <h2 id="res-title"></h2>' +
    '    <p id="res-sub"></p>' +
    '    <div class="g2k-res-stats">' +
    '      <div><span>' + T('gs.g2048.score') + '</span><b id="res-score">0</b></div>' +
    '      <div><span>' + T('gs.g2048.best') + '</span><b id="res-best">0</b></div>' +
    '      <div><span>' + T('gs.g2048.maxTile') + '</span><b id="res-max">0</b></div>' +
    '    </div>' +
    '    <div class="g2k-res-goal" id="res-goal"></div>' +
    '    <div class="g2k-res-btns">' +
    '      <button class="btn green hidden" id="res-continue">' + T('gs.g2048.continue') + '</button>' +
    '      <button class="btn yellow hidden" id="res-next">' + T('gs.g2048.nextLevel') + '</button>' +
    '      <button class="btn hidden" id="res-levels">' + T('gs.g2048.levelPanel') + '</button>' +
    '      <button class="btn pink" id="res-restart">' + T('gs.g2048.again') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="g2k-layer hidden" id="level-layer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="level-title">' +
    '  <div class="g2k-panel g2k-level-panel">' +
    '    <h2 id="level-title">' + T('gs.g2048.campaignTitle') + '</h2>' +
    '    <p id="level-sub"></p>' +
    '    <div class="g2k-level-list" id="level-list"></div>' +
    '    <div class="g2k-res-btns"><button class="btn" id="level-close">' + T('gs.g2048.close') + '</button></div>' +
    '  </div>' +
    '</div>';

  var boardEl = q('board');
  var bgGrid = q('bg-grid');
  var tileLayer = q('tile-layer');
  var msgEl = q('msg');
  var dailyNote = q('daily-note');
  var scoreEl = q('score');
  var scoreCardEl = q('score-card');
  var bestEl = q('best');
  var maxTileEl = q('max-tile');
  var movesEl = q('moves');
  var movesCard = q('moves-card');
  var modeEl = q('mode');
  var goalEl = q('goal');
  var modeRow = q('mode-row');
  var restartBtn = q('restart-btn');
  var saveBtn = q('save-btn');
  var toolBtns = { undo: q('tool-undo'), hammer: q('tool-hammer'), shuffle: q('tool-shuffle') };
  var layerEl = q('result-layer');
  var resTitle = q('res-title');
  var resSub = q('res-sub');
  var resScore = q('res-score');
  var resBest = q('res-best');
  var resMax = q('res-max');
  var resGoal = q('res-goal');
  var resBadge = q('res-badge');
  var resContinue = q('res-continue');
  var resNext = q('res-next');
  var resLevels = q('res-levels');
  var resRestart = q('res-restart');
  var levelLayer = q('level-layer');
  var levelList = q('level-list');
  var levelSub = q('level-sub');
  var levelClose = q('level-close');

  boot();
})();
