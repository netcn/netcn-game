/* ============================================================
   扫雷 · 旗舰版
   - 无猜棋盘：约束传播（单格计数 + 子集约束 + 全局雷数）验证
   - 每日挑战：YYYYMMDD 种子固定棋盘（无猜 · 中级）
   - 四档独立 BEST：easy / normal / hard / expert（自定义单独）
   - 本地成就 / 连胜 / 每日完成记录
   - DOM 网格增量更新；Canvas/CSS 自绘旗子与地雷
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.minesweeper.tut1t'), d: T('gs.minesweeper.tut1') },
    { t: T('gs.minesweeper.tut2t'), d: T('gs.minesweeper.tut2') },
    { t: T('gs.minesweeper.tut3t'), d: T('gs.minesweeper.tut3') },
    { t: T('gs.minesweeper.tut4t'), d: T('gs.minesweeper.tut4') }
  ];

  var DIFFS = {
    easy:   { cols: 9,  rows: 9,  mines: 10 },
    mid:    { cols: 16, rows: 16, mines: 40 },
    hard:   { cols: 20, rows: 20, mines: 80 },
    expert: { cols: 30, rows: 16, mines: 99 }
  };
  var TIERS = ['easy', 'mid', 'hard', 'expert'];
  /* 每档独立最高分 key 后缀：arcade_best_minesweeper_* */
  var BEST_SUFFIX = { easy: 'easy', mid: 'normal', hard: 'hard', expert: 'expert', custom: 'custom' };
  var ACH_KEY = 'arcade_ach_minesweeper';
  var STREAK_KEY = 'arcade_ms_streak';
  var DAILY_KEY = 'arcade_daily_minesweeper';
  var NOGUESS_DEFAULT = true;

  var ACH = [
    { id: 'first_win', name: 'achFirstWin', desc: 'achFirstWinD' },
    { id: 'win_easy',  name: 'achEasy',  desc: 'achEasyD' },
    { id: 'win_mid',   name: 'achMid',   desc: 'achMidD' },
    { id: 'win_hard',  name: 'achHard',  desc: 'achHardD' },
    { id: 'win_expert',name: 'achExpert',desc: 'achExpertD' },
    { id: 'no_flag',   name: 'achNoFlag',desc: 'achNoFlagD' },
    { id: 'fast_easy', name: 'achFast',  desc: 'achFastD' },
    { id: 'streak_3',  name: 'achStreak',desc: 'achStreakD' },
    { id: 'daily',     name: 'achDaily', desc: 'achDailyD' }
  ];

  var diffBtnsHtml =
    '<button class="ms-diff-btn" data-diff="easy" type="button"><b>' + T('gs.minesweeper.dEasyS') + '</b><small>' + T('gs.ms.dimsEasy') + '</small><em class="ms-diff-best" data-best-for="easy">—</em></button>' +
    '<button class="ms-diff-btn" data-diff="mid" type="button"><b>' + T('gs.minesweeper.dMidS') + '</b><small>' + T('gs.ms.dimsMid') + '</small><em class="ms-diff-best" data-best-for="mid">—</em></button>' +
    '<button class="ms-diff-btn" data-diff="hard" type="button"><b>' + T('gs.minesweeper.dHardS') + '</b><small>' + T('gs.ms.dimsHard') + '</small><em class="ms-diff-best" data-best-for="hard">—</em></button>' +
    '<button class="ms-diff-btn" data-diff="expert" type="button"><b>' + T('gs.ms.expertS') + '</b><small>' + T('gs.ms.dimsExpert') + '</small><em class="ms-diff-best" data-best-for="expert">—</em></button>';

  root.innerHTML =
    '<div class="ms-wrap">' +
    '  <div class="ms-pick">' +
    '    <div class="ms-pick-title">' + T('gs.minesweeper.pickDiff') + '</div>' +
    '    <div class="ms-diff-row">' + diffBtnsHtml + '</div>' +
    '    <button id="diff-custom" class="ms-custom-toggle" type="button">' + T('gs.minesweeper.custom') + '</button>' +
    '  </div>' +
    '  <div class="ms-tools">' +
    '    <button id="daily-btn" class="ms-tool-btn" type="button"><span class="ms-tool-ic ic-daily"></span><span class="ms-tool-txt">' + T('gs.ms.daily') + '</span><small id="daily-tag">' + T('gs.ms.dailyFresh') + '</small></button>' +
    '    <button id="ach-btn" class="ms-tool-btn" type="button"><span class="ms-tool-ic ic-ach"></span><span class="ms-tool-txt">' + T('gs.ms.achTitle') + '</span><small id="ach-count">' + T('gs.ms.achProgress').replace('{n}', 0).replace('{m}', ACH.length) + '</small></button>' +
    '    <button id="noguess-btn" class="ms-tool-btn is-on" type="button" aria-pressed="true"><span class="ms-tool-ic ic-lock"></span><span class="ms-tool-txt">' + T('gs.ms.noguess') + '</span><small id="noguess-val">' + T('gs.ms.noguessOn') + '</small></button>' +
    '  </div>' +
    '  <div class="ms-custom hidden" id="custom">' +
    '    <label>' + T('gs.minesweeper.cols') + '<input id="cust-cols" type="number" min="5" max="30" value="12"></label>' +
    '    <label>' + T('gs.minesweeper.rows') + '<input id="cust-rows" type="number" min="5" max="30" value="12"></label>' +
    '    <label>' + T('gs.minesweeper.mines') + '<input id="cust-mines" type="number" min="1" max="400" value="25"></label>' +
    '    <button id="cust-go" class="btn green" type="button">' + T('gs.minesweeper.go') + '</button>' +
    '  </div>' +
    '  <div class="ms-hud">' +
    '    <div class="ms-hud-item"><span class="ms-hud-lbl">' + T('gs.minesweeper.minesLeft') + '</span><span class="stat-value" id="mines-left">10</span></div>' +
    '    <div class="ms-hud-item">' + T('gs.minesweeper.timeFmt').replace('{n}', '<span class="stat-value" id="timer">0</span>') + '</div>' +
    '    <div class="ms-hud-item ms-best" id="best-wrap"><span class="ms-hud-lbl">' + T('gs.minesweeper.bestNow') + '</span><span class="stat-value" id="best-val">—</span></div>' +
    '    <div class="ms-hud-item ms-daily-hud" id="daily-hud"><span class="ms-hud-lbl">' + T('gs.ms.today') + '</span><span class="stat-value" id="daily-hud-val">—</span></div>' +
    '  </div>' +
    '  <div class="game-message ms-msg" id="msg">' + T('gs.minesweeper.msgInit') + '</div>' +
    '  <div class="ms-stage" id="ms-stage">' +
    '    <div class="ms-scroll" id="ms-scroll">' +
    '      <div class="grid-board ms-board d-easy" id="board" tabindex="0" role="grid" aria-label="' + T('gs.ms.boardLabel') + '"></div>' +
    '    </div>' +
    '    <div class="ms-result hidden" id="result" role="dialog" aria-modal="true">' +
    '      <div class="ms-result-card">' +
    '        <div class="ms-result-title" id="res-title"></div>' +
    '        <p class="ms-result-sub" id="res-sub"></p>' +
    '        <div class="ms-result-stats">' +
    '          <div><span>' + T('gs.minesweeper.resultTime') + '</span><b id="res-time">0</b></div>' +
    '          <div><span>' + T('gs.ms.resultDiff') + '</span><b id="res-diff">—</b></div>' +
    '          <div><span>' + T('gs.ms.resultMines') + '</span><b id="res-mines">0</b></div>' +
    '          <div><span>' + T('gs.minesweeper.resultBest') + '</span><b id="res-best">—</b></div>' +
    '        </div>' +
    '        <div class="ms-record hidden" id="res-record">' + T('gs.minesweeper.recordLine') + '</div>' +
    '        <div class="ms-ach-new hidden" id="res-ach"></div>' +
    '        <button class="btn green ms-result-again" id="res-again" type="button">' + T('gs.minesweeper.again') + '</button>' +
    '        <button class="ms-mini-btn ms-result-daily" id="res-daily" type="button">' + T('gs.ms.dailyEntry') + '</button>' +
    '        <div class="ms-result-change">' + T('gs.minesweeper.changeDiff') + '</div>' +
    '        <div class="ms-result-diffs">' +
    '          <button class="ms-mini-btn" data-res-diff="easy" type="button">' + T('gs.minesweeper.dEasyS') + '</button>' +
    '          <button class="ms-mini-btn" data-res-diff="mid" type="button">' + T('gs.minesweeper.dMidS') + '</button>' +
    '          <button class="ms-mini-btn" data-res-diff="hard" type="button">' + T('gs.minesweeper.dHardS') + '</button>' +
    '          <button class="ms-mini-btn" data-res-diff="expert" type="button">' + T('gs.ms.expertS') + '</button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="game-controls ms-controls">' +
    '    <button id="mode-btn" class="btn purple" type="button">' + T('gs.minesweeper.modeReveal') + '</button>' +
    '    <button id="restart-btn" class="btn pink" type="button">' + T('gs.minesweeper.restart') + '</button>' +
    '  </div>' +
    '  <p class="help-text">' + T('gs.ms.help') + '</p>' +
    '  <div class="ms-hints">' +
    '    <span>' + T('gs.ms.keyHint') + '</span>' +
    '    <span>' + T('gs.ms.touchHint') + '</span>' +
    '  </div>' +
    '</div>' +
    '<div class="ms-ach-overlay hidden" id="ach-ov" role="dialog" aria-modal="true" aria-label="' + T('gs.ms.achTitle') + '">' +
    '  <div class="ms-ach-panel">' +
    '    <div class="ms-ach-head"><span class="ms-ach-title">' + T('gs.ms.achTitle') + '</span><span class="ms-ach-prog" id="ach-prog">' + T('gs.ms.achProgress').replace('{n}', 0).replace('{m}', ACH.length) + '</span><button class="ms-ach-close" id="ach-close" type="button">' + T('gs.ms.achClose') + '</button></div>' +
    '    <div class="ms-ach-list" id="ach-list"></div>' +
    '  </div>' +
    '</div>';

  var boardEl = document.getElementById('board');
  var scrollEl = document.getElementById('ms-scroll');
  var stageEl = document.getElementById('ms-stage');
  var msgEl = document.getElementById('msg');
  var minesLeftEl = document.getElementById('mines-left');
  var timerEl = document.getElementById('timer');
  var bestWrap = document.getElementById('best-wrap');
  var bestValEl = document.getElementById('best-val');
  var dailyHudVal = document.getElementById('daily-hud-val');
  var dailyTag = document.getElementById('daily-tag');
  var dailyBtn = document.getElementById('daily-btn');
  var achBtn = document.getElementById('ach-btn');
  var achCount = document.getElementById('ach-count');
  var noguessBtn = document.getElementById('noguess-btn');
  var noguessVal = document.getElementById('noguess-val');
  var modeBtn = document.getElementById('mode-btn');
  var restartBtn = document.getElementById('restart-btn');
  var customToggle = document.getElementById('diff-custom');
  var customEl = document.getElementById('custom');
  var custCols = document.getElementById('cust-cols');
  var custRows = document.getElementById('cust-rows');
  var custMines = document.getElementById('cust-mines');
  var custGo = document.getElementById('cust-go');
  var resultEl = document.getElementById('result');
  var resTitle = document.getElementById('res-title');
  var resSub = document.getElementById('res-sub');
  var resTime = document.getElementById('res-time');
  var resDiff = document.getElementById('res-diff');
  var resMines = document.getElementById('res-mines');
  var resBest = document.getElementById('res-best');
  var resRecord = document.getElementById('res-record');
  var resAch = document.getElementById('res-ach');
  var resAgain = document.getElementById('res-again');
  var resDaily = document.getElementById('res-daily');
  var resDiffEls = resultEl.querySelectorAll('[data-res-diff]');
  var diffBtnEls = root.querySelectorAll('.ms-diff-btn[data-diff]');
  var diffBestEls = root.querySelectorAll('[data-best-for]');
  var achOv = document.getElementById('ach-ov');
  var achList = document.getElementById('ach-list');
  var achProg = document.getElementById('ach-prog');
  var achClose = document.getElementById('ach-close');
  var hintEls = root.querySelectorAll('.ms-hints');

  /* ---------- 状态 ---------- */
  var diff, cols, rows, mineCount;
  var customConf = null;
  var currentId = 'easy';
  var dailyActive = false, dailySeed = 0, dailyAnchorR = 0, dailyAnchorC = 0;
  var noGuess = NOGUESS_DEFAULT;
  var cells = null;
  var cellEls = null;
  var domCols = 0, domRows = 0;
  var started = false, over = false, flags = 0, revealedCount = 0;
  var flagMode = false;
  var timerRunning = false;
  var seconds = 0, timerId = null, timerStartAt = 0;
  var submitted = false;
  var timers = [];
  var lp = null;
  var suppressClickKey = null;
  var longKey = null, longAt = 0;
  var lastPointerType = 'mouse';
  var lastTap = null;
  var curR = 0, curC = 0, curOn = false;
  var everFlagged = false;
  var winStreak = 0;
  var unlockedIds = [];
  var sessionUnlocked = [];
  var achOpen = false;
  var lastNoGuessVerified = null;
  var resultVisible = false;
  var boardReady = false;

  /* ---------- 通用小工具 ---------- */
  function later(fn, ms) {
    var id = setTimeout(function () {
      for (var i = 0; i < timers.length; i++) {
        if (timers[i] === id) { timers.splice(i, 1); break; }
      }
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers = [];
  }

  function audio(name) {
    if (window.Arcade && Arcade.audio) Arcade.audio.play(name);
  }

  function haptic(ms) {
    try {
      if (navigator.vibrate && window.Arcade && Arcade.settings && Arcade.settings.get().haptic) {
        navigator.vibrate(ms);
      }
    } catch (e) {}
  }

  function bestKey(id) {
    return 'minesweeper_' + (BEST_SUFFIX[id] || id);
  }

  function bestFor(id) {
    try {
      return window.Arcade && Arcade.storage ? Arcade.storage.getBest(bestKey(id)) : null;
    } catch (e) { return null; }
  }

  function fmtSec(n) {
    if (n === null || n === undefined) return '—';
    return T('gs.ms.secUnit').replace('{n}', n);
  }

  function clearLongPress() {
    if (lp && lp.timer) clearTimeout(lp.timer);
    lp = null;
  }

  function sizeClass(n) {
    if (n <= 9) return 'd-easy';
    if (n <= 16) return 'd-mid';
    if (n <= 20) return 'd-hard';
    return 'd-expert';
  }

  function isExpertLayout() {
    return cols > 20;
  }

  function updateModeBtn() {
    modeBtn.textContent = flagMode ? T('gs.minesweeper.modeFlag') : T('gs.minesweeper.modeReveal');
  }

  function updateMinesLeft() {
    var left = mineCount - flags;
    minesLeftEl.textContent = String(left);
    minesLeftEl.classList.toggle('neg', left < 0);
  }

  function updateBestHud() {
    var b = dailyActive ? null : bestFor(currentId);
    bestValEl.textContent = (b === null || b === undefined) ? '—' : T('gs.minesweeper.bestVal').replace('{n}', b);
  }

  function updateDiffBests() {
    for (var i = 0; i < diffBestEls.length; i++) {
      var id = diffBestEls[i].getAttribute('data-best-for');
      var b = bestFor(id);
      diffBestEls[i].textContent = (b === null || b === undefined) ? '—' : T('gs.ms.bestShort').replace('{n}', b);
    }
  }

  function flashBestHud() {
    if (!bestWrap) return;
    bestWrap.classList.remove('flash');
    void bestWrap.offsetWidth;
    bestWrap.classList.add('flash');
  }

  function syncActive() {
    for (var i = 0; i < diffBtnEls.length; i++) {
      var id = diffBtnEls[i].getAttribute('data-diff');
      diffBtnEls[i].classList.toggle('is-active', !dailyActive && id === currentId);
    }
    customToggle.classList.toggle('is-active', !dailyActive && currentId === 'custom');
    dailyBtn.classList.toggle('is-on', dailyActive);
    dailyBtn.setAttribute('aria-pressed', dailyActive ? 'true' : 'false');
  }

  /* ============================================================
     确定性随机 / 棋盘生成 / 无猜求解器
     ============================================================ */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), a | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dailySeedValue() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function dailyDateString() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function resetMineData() {
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        cells[r][c].mine = false;
        cells[r][c].count = 0;
      }
    }
  }

  function computeCounts() {
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (cells[r][c].mine) continue;
        var n = 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            var nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr][nc].mine) n++;
          }
        }
        cells[r][c].count = n;
      }
    }
  }

  function placeMinesRandom(safeR, safeC, rng) {
    resetMineData();
    var pool = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        pool.push(r * cols + c);
      }
    }
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    var take = Math.min(mineCount, pool.length);
    for (var k = 0; k < take; k++) {
      var idx = pool[k];
      cells[Math.floor(idx / cols)][idx % cols].mine = true;
    }
    computeCounts();
  }

  /* 约束传播求解器：返回 {solved, revealed}
     规则：单格计数、子集差集、全局雷数（残局还会与局部约束做差集） */
  function solveCheck(safeR, safeC) {
    var N = cols * rows, M = mineCount;
    var rev = new Uint8Array(N);
    var flg = new Uint8Array(N);
    var unk = new Uint8Array(N);
    unk.fill(1);
    var totalRev = { v: 0 };
    var totalFlg = { v: 0 };

    function revealCell(start) {
      var stack = [start];
      while (stack.length) {
        var x = stack.pop();
        if (!unk[x]) continue;
        unk[x] = 0; rev[x] = 1; totalRev.v++;
        var r = Math.floor(x / cols), c = x % cols;
        if (cells[r][c].count === 0) {
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              var nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
              var j = nr * cols + nc;
              if (unk[j]) stack.push(j);
            }
          }
        }
      }
    }

    function trySafe(x) {
      if (flg[x]) return false;
      if (rev[x] || unk[x]) { if (unk[x]) revealCell(x); }
      return true;
    }

    function tryMine(x) {
      if (rev[x]) return false;
      if (unk[x]) { unk[x] = 0; flg[x] = 1; totalFlg.v++; }
      return true;
    }

    revealCell(safeR * cols + safeC);

    function collect() {
      var list = [];
      for (var i = 0; i < N; i++) {
        if (!rev[i]) continue;
        var r = Math.floor(i / cols), c = i % cols;
        var cnt = cells[r][c].count;
        if (cnt <= 0) continue;
        var arr = [], f = 0;
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            var nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            var j = nr * cols + nc;
            if (flg[j]) f++;
            else if (unk[j]) arr.push(j);
          }
        }
        var rem = cnt - f;
        if (rem < 0 || rem > arr.length) return { bad: true };
        if (arr.length > 0) {
          list.push({ cells: arr, rem: rem, len: arr.length });
        } else if (rem !== 0) {
          return { bad: true };
        }
      }
      return { list: list };
    }

    function applySets(safeSet, mineSet) {
      var prog = false;
      var i;
      if (mineSet) {
        for (i = 0; i < mineSet.length; i++) {
          if (!tryMine(mineSet[i])) return { bad: true, prog: prog };
          prog = true;
        }
      }
      if (safeSet) {
        for (i = 0; i < safeSet.length; i++) {
          if (!trySafe(safeSet[i])) return { bad: true, prog: prog };
          prog = true;
        }
      }
      return { bad: false, prog: prog };
    }

    var maxPass = 320;
    for (var pass = 0; pass < maxPass; pass++) {
      var cs = collect();
      if (cs.bad) return { solved: false, revealed: totalRev.v };

      /* 1) 单格计数直接规则 */
      var safe = [], mine = [];
      var k;
      for (k = 0; k < cs.list.length; k++) {
        var con = cs.list[k];
        if (con.rem === 0) {
          for (var a = 0; a < con.cells.length; a++) safe.push(con.cells[a]);
        } else if (con.rem === con.len) {
          for (var b = 0; b < con.cells.length; b++) mine.push(con.cells[b]);
        }
      }

      /* 2) 全局雷数直接规则 */
      var gLen = 0, gi;
      for (gi = 0; gi < N; gi++) if (unk[gi]) gLen++;
      var gRem = M - totalFlg.v;
      if (gRem < 0 || gRem > gLen) return { solved: false, revealed: totalRev.v };
      if (gLen > 0 && gRem === 0) {
        for (gi = 0; gi < N; gi++) if (unk[gi]) safe.push(gi);
      } else if (gLen > 0 && gRem === gLen) {
        for (gi = 0; gi < N; gi++) if (unk[gi]) mine.push(gi);
      }

      var app1 = applySets(safe, mine);
      if (app1.bad) return { solved: false, revealed: totalRev.v };
      if (totalRev.v === N - M) return { solved: true, revealed: totalRev.v };
      if (app1.prog) continue;

      /* 3) 子集约束（含残局与全局计数做差） */
      var safe2 = [], mine2 = [];
      var i1, i2;
      for (i1 = 0; i1 < cs.list.length; i1++) {
        var A = cs.list[i1];
        for (i2 = 0; i2 < cs.list.length; i2++) {
          if (i1 === i2) continue;
          var B = cs.list[i2];
          if (A.len >= B.len) continue;
          var subset = true;
          for (var m1 = 0; m1 < A.cells.length; m1++) {
            var cellA = A.cells[m1];
            var found = false;
            for (var m2 = 0; m2 < B.cells.length; m2++) {
              if (B.cells[m2] === cellA) { found = true; break; }
            }
            if (!found) { subset = false; break; }
          }
          if (!subset) continue;
          var diffRem = B.rem - A.rem;
          var diffLen = B.len - A.len;
          if (diffRem < 0 || diffRem > diffLen) return { solved: false, revealed: totalRev.v };
          if (diffRem === 0) {
            for (var m3 = 0; m3 < B.cells.length; m3++) {
              var cB = B.cells[m3];
              if (flg[cB]) return { solved: false, revealed: totalRev.v };
              var inA = false;
              for (var m4 = 0; m4 < A.cells.length; m4++) if (A.cells[m4] === cB) { inA = true; break; }
              if (!inA) safe2.push(cB);
            }
          } else if (diffRem === diffLen) {
            for (var m5 = 0; m5 < B.cells.length; m5++) {
              var cB2 = B.cells[m5];
              var inA2 = false;
              for (var m6 = 0; m6 < A.cells.length; m6++) if (A.cells[m6] === cB2) { inA2 = true; break; }
              if (!inA2) mine2.push(cB2);
            }
          }
        }
      }

      /* 残局：局部约束与全局雷数差集 */
      if (gLen <= 26 && gLen > 0 && cs.list.length) {
        for (i1 = 0; i1 < cs.list.length; i1++) {
          var C = cs.list[i1];
          var outLen = gLen - C.len;
          if (outLen <= 0) continue;
          var globalDiff = gRem - C.rem;
          if (globalDiff === 0) {
            for (gi = 0; gi < N; gi++) {
              if (!unk[gi]) continue;
              var inC = false;
              for (var m7 = 0; m7 < C.cells.length; m7++) if (C.cells[m7] === gi) { inC = true; break; }
              if (!inC) safe2.push(gi);
            }
          } else if (globalDiff === outLen) {
            for (gi = 0; gi < N; gi++) {
              if (!unk[gi]) continue;
              var inC2 = false;
              for (var m8 = 0; m8 < C.cells.length; m8++) if (C.cells[m8] === gi) { inC2 = true; break; }
              if (!inC2) mine2.push(gi);
            }
          }
        }
      }

      var app2 = applySets(safe2, mine2);
      if (app2.bad) return { solved: false, revealed: totalRev.v };
      if (totalRev.v === N - M) return { solved: true, revealed: totalRev.v };
      if (app2.prog) continue;
      break;
    }
    return { solved: totalRev.v === N - M, revealed: totalRev.v };
  }

  function genLimits() {
    if (dailyActive) return { attempts: 120, budget: 0 };
    if (currentId === 'expert') return { attempts: 140, budget: 1000 };
    if (currentId === 'hard') return { attempts: 110, budget: 620 };
    if (currentId === 'mid') return { attempts: 100, budget: 480 };
    if (currentId === 'easy') return { attempts: 90, budget: 320 };
    return { attempts: 50, budget: 320 };
  }

  function placeBoard(safeR, safeC) {
    var useNoGuess = dailyActive ? true : noGuess;
    var rng = dailyActive ? mulberry32(dailySeed) : Math.random;
    var lim = genLimits();
    var attempts = 0;
    var t0 = Date.now();
    lastNoGuessVerified = null;
    if (!useNoGuess) {
      placeMinesRandom(safeR, safeC, rng);
      attempts = 1;
      lastNoGuessVerified = false;
      return;
    }
    for (var a = 0; a < lim.attempts; a++) {
      attempts++;
      placeMinesRandom(safeR, safeC, rng);
      var res = solveCheck(safeR, safeC);
      if (res.solved) {
        lastNoGuessVerified = true;
        return;
      }
      if (lim.budget && Date.now() - t0 > lim.budget) break;
    }
    lastNoGuessVerified = false;
    if (window.Arcade && Arcade.ui) {
      Arcade.ui.toast(T('gs.ms.genFallback'), 'warn');
    }
  }

  /* ============================================================
     棋盘 DOM / 布局
     ============================================================ */

  function applyBoardLayout() {
    var expert = isExpertLayout();
    boardEl.className = 'grid-board ms-board ' + sizeClass(cols) + (expert ? ' ms-expert-board' : '');
    scrollEl.classList.toggle('is-expert', expert);
    boardEl.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    boardEl.style.width = '';
    boardEl.style.height = '';
    boardEl.style.gridAutoRows = '';
    boardEl.style.gap = '';
    boardEl.style.padding = '';
    scrollEl.style.height = '';
    if (expert) {
      var cell = 24, gap = 2, pad = 6;
      var bw = cols * cell + (cols - 1) * gap + pad * 2;
      var bh = rows * cell + (rows - 1) * gap + pad * 2;
      boardEl.style.width = bw + 'px';
      boardEl.style.height = bh + 'px';
      boardEl.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cell + 'px)';
      boardEl.style.gridAutoRows = cell + 'px';
      boardEl.style.gap = gap + 'px';
      boardEl.style.padding = pad + 'px';
      scrollEl.style.height = (bh + 10) + 'px';
    }
  }

  function positionExpertCells() {
    if (!isExpertLayout()) return;
    var cell = 24, gap = 2, pad = 6;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var el = cellEls[r][c];
        el.style.left = (pad + c * (cell + gap)) + 'px';
        el.style.top = (pad + r * (cell + gap)) + 'px';
        el.style.width = cell + 'px';
        el.style.height = cell + 'px';
      }
    }
  }

  function buildBoard() {
    var frag = document.createDocumentFragment();
    cellEls = [];
    for (var r = 0; r < rows; r++) {
      var rowEls = [];
      for (var c = 0; c < cols; c++) {
        var el = document.createElement('div');
        el.className = 'ms-cell';
        el.setAttribute('data-r', String(r));
        el.setAttribute('data-c', String(c));
        el.setAttribute('role', 'gridcell');
        frag.appendChild(el);
        rowEls.push(el);
      }
      cellEls.push(rowEls);
    }
    boardEl.innerHTML = '';
    boardEl.appendChild(frag);
    domCols = cols;
    domRows = rows;
  }

  function resetCells() {
    cells = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        var el = cellEls[r][c];
        el.className = 'ms-cell';
        el.textContent = '';
        el.style.animationDelay = '';
        el.style.left = '';
        el.style.top = '';
        el.style.width = '';
        el.style.height = '';
        row.push({
          mine: false, revealed: false, flagged: false, wrong: false,
          wonMine: false, count: 0, boom: false, el: el
        });
      }
      cells.push(row);
    }
    positionExpertCells();
  }

  function paint(r, c, delay) {
    var cell = cells[r][c];
    var el = cell.el;
    var cls = 'ms-cell';
    var text = '';
    if (cell.revealed) {
      if (cell.mine) {
        cls += cell.boom ? ' boom mine' : (cell.wonMine ? ' mine won' : ' mine');
      } else {
        cls += ' open';
        if (cell.count > 0) {
          cls += ' n' + cell.count;
          text = String(cell.count);
        }
      }
    } else if (cell.flagged) {
      cls += ' flagged';
      if (cell.wrong) { cls += ' wrong'; text = '×'; }
    }
    if (delay !== undefined) el.style.animationDelay = delay + 'ms';
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== text) el.textContent = text;
    if (curOn && curR === r && curC === c) el.classList.add('cursor');
  }

  /* ============================================================
     计时
     ============================================================ */

  function startTimer(fromSeconds) {
    stopTimer();
    timerRunning = true;
    seconds = Math.max(0, Math.floor(fromSeconds || 0));
    timerStartAt = Date.now() - seconds * 1000;
    timerEl.textContent = String(seconds);
    timerId = setInterval(function () {
      seconds = Math.floor((Date.now() - timerStartAt) / 1000);
      timerEl.textContent = String(seconds);
    }, 1000);
  }

  function ensureTimer() {
    if (!timerRunning && !over) startTimer();
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    timerRunning = false;
    timerStartAt = 0;
  }

  function freezeTimer() {
    if (timerStartAt) seconds = Math.floor((Date.now() - timerStartAt) / 1000);
    if (seconds < 1) seconds = 1;
    stopTimer();
    timerEl.textContent = String(seconds);
  }

  /* ============================================================
     开格 / 插旗 / Chord
     ============================================================ */

  function forEachNeighbor(r, c, fn) {
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
    }
  }

  function floodReveal(r0, c0) {
    var queue = [{ r: r0, c: c0, d: 0 }];
    var opened = 0;
    for (var qi = 0; qi < queue.length; qi++) {
      var p = queue[qi];
      var cell = cells[p.r][p.c];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      cell.wrong = false;
      revealedCount++;
      opened++;
      paint(p.r, p.c, Math.min(p.d, 10) * 16);
      if (cell.count === 0 && !cell.mine) {
        forEachNeighbor(p.r, p.c, function (nr, nc) {
          var n = cells[nr][nc];
          if (!n.revealed && !n.flagged) queue.push({ r: nr, c: nc, d: p.d + 1 });
        });
      }
    }
    return opened;
  }

  function revealAt(r, c) {
    if (over) return false;
    var cell = cells[r][c];
    if (cell.revealed || cell.flagged) return false;
    if (!started) {
      started = true;
      placeBoard(r, c);
      startTimer();
      msgEl.textContent = '';
      msgEl.style.color = '';
    } else {
      ensureTimer();
    }
    if (cell.mine) {
      loseGame(r, c);
      return false;
    }
    var opened = floodReveal(r, c);
    if (opened > 1) audio('clear');
    else audio('move');
    if (!over && revealedCount === rows * cols - mineCount) winGame();
    else saveSnapshot();
    return true;
  }

  function toggleFlag(r, c, user) {
    if (over) return false;
    var cell = cells[r][c];
    if (cell.revealed) return false;
    cell.flagged = !cell.flagged;
    flags += cell.flagged ? 1 : -1;
    if (cell.flagged) {
      everFlagged = true;
      if (user) haptic(18);
      audio('rotate');
    } else {
      cell.wrong = false;
      audio('back');
    }
    paint(r, c);
    updateMinesLeft();
    saveSnapshot();
    return cell.flagged;
  }

  function chordAt(r, c) {
    if (over || !started) return;
    var cell = cells[r][c];
    if (!cell.revealed || cell.count <= 0) return;
    var nb = [];
    var nf = 0;
    forEachNeighbor(r, c, function (nr, nc) {
      var n = cells[nr][nc];
      if (n.flagged) nf++;
      else if (!n.revealed) nb.push([nr, nc]);
    });
    if (nf !== cell.count || nb.length === 0) return;
    ensureTimer();

    var lost = null;
    var opened = 0;
    for (var i = 0; i < nb.length; i++) {
      var nr = nb[i][0], nc = nb[i][1];
      if (cells[nr][nc].mine) { lost = [nr, nc]; break; }
      opened += floodReveal(nr, nc);
    }
    if (lost) {
      loseGame(lost[0], lost[1]);
      return;
    }
    if (opened) audio('match');
    else audio('ui');
    if (!over && revealedCount === rows * cols - mineCount) winGame();
    else saveSnapshot();
  }

  /* ============================================================
     成就
     ============================================================ */

  function achKnown(id) {
    for (var i = 0; i < ACH.length; i++) if (ACH[i].id === id) return ACH[i];
    return null;
  }

  function loadAch() {
    try {
      var raw = localStorage.getItem(ACH_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      var out = [];
      for (var i = 0; i < arr.length; i++) if (achKnown(arr[i])) out.push(arr[i]);
      return out;
    } catch (e) { return []; }
  }

  function saveAch() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(unlockedIds)); } catch (e) {}
  }

  function hasAch(id) {
    return unlockedIds.indexOf(id) >= 0;
  }

  function achName(id) {
    var def = achKnown(id);
    return def ? T('gs.ms.' + def.name) : id;
  }

  function updateAchBadge() {
    var n = unlockedIds.length;
    var txt = T('gs.ms.achProgress').replace('{n}', n).replace('{m}', ACH.length);
    achCount.textContent = txt;
    achProg.textContent = txt;
  }

  function renderAchList() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < ACH.length; i++) {
      var def = ACH[i];
      var got = hasAch(def.id);
      var item = document.createElement('div');
      item.className = 'ms-ach-item' + (got ? ' got' : '');
      var ico = document.createElement('span');
      ico.className = 'ms-ach-ico';
      var body = document.createElement('span');
      body.className = 'ms-ach-body';
      var name = document.createElement('b');
      name.textContent = T('gs.ms.' + def.name);
      var desc = document.createElement('small');
      desc.textContent = got ? T('gs.ms.' + def.desc) : T('gs.ms.achLocked');
      body.appendChild(name);
      body.appendChild(desc);
      item.appendChild(ico);
      item.appendChild(body);
      item.setAttribute('data-ach', def.id);
      frag.appendChild(item);
    }
    achList.innerHTML = '';
    achList.appendChild(frag);
  }

  function openAchPanel() {
    achOpen = true;
    renderAchList();
    updateAchBadge();
    achOv.classList.remove('hidden');
    audio('ui');
    try { achClose.focus({ preventScroll: true }); } catch (e) {}
  }

  function closeAchPanel() {
    achOpen = false;
    achOv.classList.add('hidden');
  }

  function unlockAch(id) {
    if (hasAch(id)) return false;
    unlockedIds.push(id);
    sessionUnlocked.push(id);
    saveAch();
    updateAchBadge();
    if (achOpen) renderAchList();
    return true;
  }

  function notifyAchievements(fresh) {
    if (!fresh || !fresh.length) return;
    var msg = fresh.length === 1
      ? T('gs.ms.achUnlocked').replace('{n}', achName(fresh[0]))
      : T('gs.ms.achUnlockedMany').replace('{n}', fresh.length);
    if (window.Arcade && Arcade.ui) Arcade.ui.toast(msg, 'win');
    audio('record');
    if (window.Arcade && Arcade.fx) {
      Arcade.fx.centerBurst('var(--neon-yellow)', 22);
      Arcade.fx.centerBurst('var(--neon-cyan)', 12);
    }
  }

  function checkWinAchievements() {
    var ids = ['first_win'];
    if (!dailyActive) {
      if (currentId === 'easy') ids.push('win_easy');
      else if (currentId === 'mid') ids.push('win_mid');
      else if (currentId === 'hard') ids.push('win_hard');
      else if (currentId === 'expert') ids.push('win_expert');
    }
    if (!everFlagged) ids.push('no_flag');
    if (!dailyActive && currentId === 'easy' && seconds <= 30) ids.push('fast_easy');
    if (dailyActive) ids.push('daily');
    loadStreak();
    winStreak = loadStreak();
    winStreak += 1;
    saveStreak();
    if (winStreak >= 3) ids.push('streak_3');
    var fresh = [];
    for (var i = 0; i < ids.length; i++) {
      if (!hasAch(ids[i])) fresh.push(ids[i]);
    }
    for (var j = 0; j < fresh.length; j++) unlockAch(fresh[j]);
    notifyAchievements(fresh);
    return fresh;
  }

  function loadStreak() {
    try {
      var n = Number(localStorage.getItem(STREAK_KEY));
      winStreak = isFinite(n) && n > 0 ? n : 0;
    } catch (e) { winStreak = 0; }
    return winStreak;
  }

  function saveStreak() {
    try { localStorage.setItem(STREAK_KEY, String(winStreak)); } catch (e) {}
  }

  function resetStreak() {
    winStreak = 0;
    saveStreak();
  }

  /* ============================================================
     每日挑战记录
     ============================================================ */

  function loadDailyRec() {
    try {
      var v = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
      if (v && typeof v === 'object') return v;
    } catch (e) {}
    return { date: '', wins: 0, best: null, last: null };
  }

  function dailySolvedToday() {
    var rec = loadDailyRec();
    return rec.date === dailyDateString();
  }

  function recordDailyWin() {
    var rec = loadDailyRec();
    var today = dailyDateString();
    if (rec.date === today) {
      rec.wins = (rec.wins || 0) + 1;
      if (rec.best === null || rec.best === undefined || seconds < rec.best) rec.best = seconds;
    } else {
      rec.date = today;
      rec.wins = 1;
      rec.best = seconds;
    }
    rec.last = seconds;
    rec.seed = dailySeedValue();
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(rec)); } catch (e) {}
    try {
      if (window.Arcade && Arcade.daily) Arcade.daily.markSolved('minesweeper', seconds);
    } catch (e) {}
    updateDailyUi();
  }

  function todayBest() {
    var rec = loadDailyRec();
    if (rec.date !== dailyDateString()) return null;
    return rec.best;
  }

  function updateDailyUi() {
    var solved = dailySolvedToday();
    var best = solved ? todayBest() : null;
    dailyTag.textContent = solved
      ? T('gs.ms.dailyDone').replace('{n}', best)
      : T('gs.ms.dailyFresh');
    dailyHudVal.textContent = solved
      ? T('gs.ms.dailyDoneShort').replace('{n}', best)
      : T('gs.ms.dailyFreshShort');
    dailyHudVal.classList.toggle('done', solved);
    dailyBtn.classList.toggle('is-done', solved);
    syncActive();
  }

  /* ============================================================
     结算 / 胜负
     ============================================================ */

  function submitResult() {
    if (submitted) return false;
    submitted = true;
    var isNew = false;
    if (dailyActive) {
      recordDailyWin();
      updateBestHud();
      updateDiffBests();
      return false;
    }
    try {
      if (window.Arcade && Arcade.storage) {
        isNew = Arcade.storage.submitBest(bestKey(currentId), seconds, 'min');
      }
    } catch (e) {}
    var globalNew = false;
    try {
      if (window.Arcade && Arcade.shell) globalNew = Arcade.shell.submitScore(seconds, 'min');
    } catch (e) {}
    updateBestHud();
    updateDiffBests();
    if (isNew) {
      flashBestHud();
      if (!globalNew && window.Arcade && Arcade.ui) {
        Arcade.ui.toast(T('gs.minesweeper.recordLine'), 'win');
      }
    }
    return isNew;
  }

  function remainingMines() {
    var n = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = cells[r][c];
        if (cell.mine && !cell.flagged) n++;
      }
    }
    return n;
  }

  function loseGame(br, bc) {
    if (over) return;
    over = true;
    submitted = true;
    clearSave(dailyActive);
    freezeTimer();
    resetStreak();

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = cells[r][c];
        if (cell.mine && !cell.flagged) {
          cell.revealed = true;
          paint(r, c);
        } else if (cell.flagged && !cell.mine) {
          cell.wrong = true;
          paint(r, c);
        }
      }
    }
    var boom = cells[br][bc];
    boom.revealed = true;
    boom.boom = true;
    paint(br, bc);

    msgEl.textContent = T('gs.minesweeper.lose').replace('{s}', seconds);
    msgEl.style.color = 'var(--neon-pink)';

    var rect = boom.el.getBoundingClientRect();
    if (window.Arcade && Arcade.fx) {
      Arcade.fx.shake(stageEl);
      Arcade.fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 'var(--neon-pink)', 34);
      Arcade.fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 'var(--neon-yellow)', 14);
      Arcade.fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 'var(--neon-cyan)', 10);
      Arcade.fx.flash('var(--neon-pink)');
    }
    audio('lose');
    later(function () { showResult(false, false, []); }, 560);
  }

  function winEffects() {
    var rect = boardEl.getBoundingClientRect();
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var el = cells[r][c].el;
        el.classList.add('win-wave');
        el.style.animationDelay = Math.min((r + c) * 17, 760) + 'ms';
      }
    }
    audio('win');
    if (window.Arcade && Arcade.fx) {
      Arcade.fx.flash('var(--neon-yellow)');
      var colors = ['var(--neon-yellow)', 'var(--neon-cyan)', 'var(--neon-green)', 'var(--neon-pink)', 'var(--neon-purple)'];
      var top = rect.top + Math.min(80, rect.height * 0.3);
      for (var i = 0; i < 12; i++) {
        Arcade.fx.burst(
          rect.left + 14 + Math.random() * Math.max(1, rect.width - 28),
          top + Math.random() * 90,
          colors[i % colors.length],
          10
        );
      }
    }
  }

  function winGame() {
    if (over) return;
    over = true;
    clearSave(dailyActive);
    freezeTimer();
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = cells[r][c];
        if (!cell.mine) continue;
        if (!cell.flagged) {
          cell.flagged = true;
          cell.revealed = true;
          cell.wonMine = true;
          paint(r, c);
        }
      }
    }
    flags = mineCount;
    updateMinesLeft();
    msgEl.textContent = T('gs.minesweeper.win').replace('{s}', seconds);
    msgEl.style.color = 'var(--neon-green)';
    var fresh = checkWinAchievements();
    var isNew = submitResult();
    winEffects();
    later(function () { showResult(true, isNew, fresh); }, 820);
  }

  function tierLabel() {
    if (dailyActive) return T('gs.ms.dailyMid');
    if (currentId === 'custom') return T('gs.minesweeper.custom');
    if (currentId === 'easy') return T('gs.minesweeper.dEasyS');
    if (currentId === 'mid') return T('gs.minesweeper.dMidS');
    if (currentId === 'hard') return T('gs.minesweeper.dHardS');
    if (currentId === 'expert') return T('gs.ms.expertS');
    return T('gs.minesweeper.dEasyS');
  }

  function showResult(win, isNew, fresh) {
    resultVisible = true;
    resTitle.textContent = T(win ? 'gs.minesweeper.winTitle' : 'gs.minesweeper.loseTitle');
    resTitle.className = 'ms-result-title' + (win ? ' win' : '');
    resSub.textContent = T(win ? 'gs.minesweeper.winSub' : 'gs.minesweeper.loseSub');
    resTime.textContent = fmtSec(seconds);
    resDiff.textContent = tierLabel();
    resMines.textContent = String(remainingMines());

    var b = dailyActive ? todayBest() : bestFor(currentId);
    resBest.textContent = (b === null || b === undefined) ? '—' : fmtSec(b);
    resRecord.classList.toggle('hidden', !isNew);

    var names = [];
    if (fresh && fresh.length) {
      for (var i = 0; i < fresh.length; i++) names.push(achName(fresh[i]));
    }
    if (names.length) {
      resAch.innerHTML = '';
      var label = document.createElement('span');
      label.className = 'ms-ach-new-lbl';
      label.textContent = T('gs.ms.resultAch') + ' ';
      resAch.appendChild(label);
      for (var j = 0; j < names.length; j++) {
        var chip = document.createElement('span');
        chip.className = 'ms-ach-chip';
        chip.textContent = names[j];
        resAch.appendChild(chip);
      }
      resAch.classList.remove('hidden');
    } else {
      resAch.classList.add('hidden');
    }

    resAgain.textContent = dailyActive ? T('gs.ms.againDaily') : T('gs.minesweeper.again');
    resDaily.textContent = dailyActive ? T('gs.ms.againDaily') : T('gs.ms.dailyEntry');
    resultEl.classList.remove('hidden');
    try { resAgain.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ============================================================
     断点续玩：普通局 / 每日局各自独立存档键
     （arcade_save_minesweeper / arcade_save_minesweeper_daily，互不覆盖）
     ============================================================ */

  function saveKeyFor(daily) {
    return daily ? 'arcade_save_minesweeper_daily' : 'arcade_save_minesweeper';
  }

  function readSave(key) {
    try {
      var s = JSON.parse(localStorage.getItem(key) || 'null');
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  }

  function clearSave(daily) {
    try { localStorage.removeItem(saveKeyFor(daily)); } catch (e) {}
  }

  function saveSnapshot() {
    if (!started || over || resultVisible) return;
    try {
      var n = cols * rows;
      var m = '', rv = '', f = '', counts = '';
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cell = cells[r][c];
          m += cell.mine ? '1' : '0';
          rv += cell.revealed ? '1' : '0';
          f += cell.flagged ? '1' : '0';
          counts += String(cell.count);
        }
      }
      var secs = timerStartAt ? Math.floor((Date.now() - timerStartAt) / 1000) : seconds;
      var data = {
        v: 1, __t: Date.now(),
        daily: dailyActive,
        date: dailyActive ? dailyDateString() : '',
        diffId: dailyActive ? 'mid' : currentId,
        cols: cols, rows: rows, mines: mineCount,
        noGuess: noGuess, seed: dailyActive ? dailySeed : 0,
        anchor: dailyActive ? [dailyAnchorR, dailyAnchorC] : [0, 0],
        seconds: Math.max(0, secs),
        flags: flags, revealed: revealedCount, everFlagged: everFlagged,
        m: m, rv: rv, f: f, n: counts
      };
      localStorage.setItem(saveKeyFor(dailyActive), JSON.stringify(data));
    } catch (e) {}
  }

  /** 恢复存档；返回 {daily} 或 null */
  function applySave(s) {
    if (!s || s.v !== 1 || !s.cols || !s.rows) return null;
    if (s.daily && s.date !== dailyDateString()) return null;
    var n = s.cols * s.rows;
    if (n <= 0 || n > 900 || s.mines < 1) return null;
    if (!s.m || !s.rv || !s.f || !s.n ||
        s.m.length !== n || s.rv.length !== n || s.f.length !== n || s.n.length !== n) return null;
    if (s.revealed < 1 || s.revealed > n) return null;

    var id = s.daily ? 'mid' : (s.diffId || 'easy');
    var conf;
    if (!s.daily && id === 'custom') {
      customConf = { cols: s.cols, rows: s.rows, mines: s.mines };
      conf = customConf;
    } else if (s.daily) {
      conf = DIFFS.mid;
      if (s.cols !== conf.cols || s.rows !== conf.rows) return null;
    } else {
      if (!DIFFS[id] || DIFFS[id].cols !== s.cols || DIFFS[id].rows !== s.rows || DIFFS[id].mines !== s.mines) return null;
      conf = DIFFS[id];
    }

    noGuess = !!s.noGuess;
    init(id, conf, { daily: !!s.daily, restore: true });
    if (s.daily) {
      dailySeed = s.seed;
      dailyAnchorR = s.anchor && s.anchor[0] || Math.floor(rows / 2);
      dailyAnchorC = s.anchor && s.anchor[1] || Math.floor(cols / 2);
    }

    var idx = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++, idx++) {
        var cell = cells[r][c];
        cell.mine = s.m[idx] === '1';
        cell.revealed = s.rv[idx] === '1';
        cell.flagged = s.f[idx] === '1';
        cell.wrong = false;
        cell.wonMine = false;
        cell.boom = false;
        cell.count = Number(s.n[idx]) || 0;
        paint(r, c);
      }
    }
    flags = Number(s.flags) || 0;
    revealedCount = Number(s.revealed) || 0;
    everFlagged = !!s.everFlagged;
    started = true;
    over = false;
    submitted = false;
    resultVisible = false;
    seconds = Number(s.seconds) || 0;
    startTimer(seconds);
    msgEl.textContent = '';
    msgEl.style.color = '';
    updateMinesLeft();
    updateBestHud();
    updateDiffBests();
    updateDailyUi();
    syncActive();
    return { daily: dailyActive, seconds: seconds, revealed: revealedCount };
  }

  /** 启动时尝试恢复：两份存档按写入时间倒序尝试，坏档逐个清除 */
  function tryResume() {
    var list = [];
    var a = readSave(saveKeyFor(false));
    var b = readSave(saveKeyFor(true));
    if (a) list.push(a);
    if (b) list.push(b);
    list.sort(function (x, y) { return (Number(y.__t) || 0) - (Number(x.__t) || 0); });
    for (var i = 0; i < list.length; i++) {
      var res = applySave(list[i]);
      if (res) {
        try {
          if (window.Arcade && Arcade.ui && Arcade.i18n) {
            Arcade.ui.toast(Arcade.i18n.t('savegame.resumed'), 'ok');
          }
        } catch (e) {}
        return res;
      }
      clearSave(!!list[i].daily);
    }
    return false;
  }

  /* ============================================================
     初始化 / 切换
     ============================================================ */

  function updateNoguessUi() {
    noguessBtn.classList.toggle('is-on', noGuess);
    noguessBtn.setAttribute('aria-pressed', noGuess ? 'true' : 'false');
    noguessVal.textContent = noGuess ? T('gs.ms.noguessOn') : T('gs.ms.noguessOff');
  }

  function init(id, confOverride, opts) {
    opts = opts || {};
    var daily = !!opts.daily;
    if (!daily && id !== 'custom' && !DIFFS[id]) id = 'easy';
    var conf = daily ? DIFFS.mid : (confOverride || (id === 'custom' ? customConf : DIFFS[id]) || DIFFS.easy);
    currentId = daily ? 'mid' : id;
    dailyActive = daily;
    if (daily) {
      dailySeed = dailySeedValue();
      dailyAnchorR = Math.floor(conf.rows / 2);
      dailyAnchorC = Math.floor(conf.cols / 2);
    }
    diff = conf;
    cols = conf.cols;
    rows = conf.rows;
    mineCount = conf.mines;

    clearTimers();
    clearLongPress();
    stopTimer();
    started = false;
    over = false;
    submitted = false;
    flags = 0;
    revealedCount = 0;
    seconds = 0;
    flagMode = false;
    suppressClickKey = null;
    longKey = null;
    lastTap = null;
    curR = 0;
    curC = 0;
    curOn = false;
    everFlagged = false;
    sessionUnlocked = [];
    resultVisible = false;
    lastNoGuessVerified = null;

    resultEl.classList.add('hidden');
    msgEl.textContent = daily ? T('gs.ms.dailyIntro') : T('gs.minesweeper.msgInit');
    msgEl.style.color = '';
    timerEl.textContent = '0';
    minesLeftEl.textContent = String(mineCount);
    minesLeftEl.classList.remove('neg');

    applyBoardLayout();
    if (domCols !== cols || domRows !== rows) buildBoard();
    resetCells();
    updateModeBtn();
    updateMinesLeft();
    updateBestHud();
    updateDiffBests();
    updateNoguessUi();
    updateAchBadge();
    updateDailyUi();
    syncActive();

    if (daily && !opts.restore) {
      placeBoard(dailyAnchorR, dailyAnchorC);
      started = true;
      floodReveal(dailyAnchorR, dailyAnchorC);
      startTimer();
    }
  }

  function restart() {
    clearSave(dailyActive);
    if (dailyActive) startDaily();
    else init(currentId, diff);
  }

  function startDiff(id) {
    if (dailyActive) dailyActive = false;
    clearSave(false);
    if (id === 'custom') {
      if (!customConf) customConf = { cols: 12, rows: 12, mines: 25 };
      customEl.classList.add('hidden');
      init('custom', customConf);
      return;
    }
    if (!DIFFS[id]) return;
    dailyActive = false;
    customEl.classList.add('hidden');
    init(id, DIFFS[id]);
  }

  function startDaily() {
    dailyActive = true;
    clearSave(true);
    customEl.classList.add('hidden');
    init('mid', DIFFS.mid, { daily: true });
  }

  /* ============================================================
     指针 / 触摸 / 键盘
     ============================================================ */

  function cellFromEvent(e) {
    var t = e.target;
    while (t && t !== boardEl) {
      if (t.getAttribute && t.getAttribute('data-r') !== null) return t;
      t = t.parentNode;
    }
    return null;
  }

  function scrollCursorIntoView(el) {
    if (!scrollEl.classList.contains('is-expert')) return;
    var left = el.offsetLeft + boardEl.offsetLeft;
    var w = el.offsetWidth;
    if (left < scrollEl.scrollLeft) scrollEl.scrollLeft = Math.max(0, left - 8);
    else if (left + w > scrollEl.scrollLeft + scrollEl.clientWidth) {
      scrollEl.scrollLeft = left + w - scrollEl.clientWidth + 8;
    }
  }

  function setCursor(r, c, on) {
    if (curOn && cells && cells[curR] && cells[curR][curC]) {
      cells[curR][curC].el.classList.remove('cursor');
    }
    curR = r;
    curC = c;
    curOn = on !== false;
    if (curOn && cells && cells[r] && cells[r][c]) {
      cells[r][c].el.classList.add('cursor');
      scrollCursorIntoView(cells[r][c].el);
    }
  }

  boardEl.addEventListener('pointerdown', function (e) {
    lastPointerType = e.pointerType || 'mouse';
    if (lastPointerType === 'mouse') return;
    if (e.button !== undefined && e.button !== 0) return;
    if (over) return;
    var t = cellFromEvent(e);
    if (!t) return;
    var r = Number(t.getAttribute('data-r'));
    var c = Number(t.getAttribute('data-c'));
    if (cells[r][c].revealed) return;

    clearLongPress();
    var press = { r: r, c: c, key: r + ',' + c, x: e.clientX, y: e.clientY, timer: null };
    press.timer = setTimeout(function () {
      lp = null;
      if (over) return;
      longKey = press.key;
      longAt = Date.now();
      suppressClickKey = press.key;
      toggleFlag(press.r, press.c, true);
    }, 350);
    lp = press;
  });

  boardEl.addEventListener('pointermove', function (e) {
    if (!lp) return;
    var dx = e.clientX - lp.x;
    var dy = e.clientY - lp.y;
    if (dx * dx + dy * dy > 196) clearLongPress();
  });

  boardEl.addEventListener('pointerup', clearLongPress);
  boardEl.addEventListener('pointercancel', clearLongPress);
  boardEl.addEventListener('pointerleave', clearLongPress);
  document.addEventListener('pointerup', clearLongPress);
  document.addEventListener('pointercancel', clearLongPress);

  boardEl.addEventListener('click', function (e) {
    var t = cellFromEvent(e);
    if (!t) return;
    var r = Number(t.getAttribute('data-r'));
    var c = Number(t.getAttribute('data-c'));
    var key = r + ',' + c;
    setCursor(r, c, true);

    if (suppressClickKey === key) {
      suppressClickKey = null;
      return;
    }
    suppressClickKey = null;
    if (over) return;

    var cell = cells[r][c];
    var now = Date.now();
    if (lastPointerType !== 'mouse') {
      if (lastTap && lastTap.key === key && now - lastTap.t < 350 &&
          cell.revealed && cell.count > 0) {
        lastTap = null;
        chordAt(r, c);
        return;
      }
      lastTap = { key: key, t: now };
    }

    if (flagMode) {
      toggleFlag(r, c, true);
    } else if (!cell.revealed && !cell.flagged) {
      revealAt(r, c);
    }
  });

  boardEl.addEventListener('dblclick', function (e) {
    var t = cellFromEvent(e);
    if (!t || over) return;
    var r = Number(t.getAttribute('data-r'));
    var c = Number(t.getAttribute('data-c'));
    e.preventDefault();
    chordAt(r, c);
  });

  boardEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    var t = cellFromEvent(e);
    if (!t) return;
    var r = Number(t.getAttribute('data-r'));
    var c = Number(t.getAttribute('data-c'));
    var key = r + ',' + c;
    if (lastPointerType !== 'mouse' && longKey === key && Date.now() - longAt < 800) {
      longKey = null;
      return;
    }
    if (over) return;
    toggleFlag(r, c, true);
  });

  function moveCursor(dr, dc) {
    if (!curOn) setCursor(0, 0, true);
    setCursor(
      Math.max(0, Math.min(rows - 1, curR + dr)),
      Math.max(0, Math.min(cols - 1, curC + dc)),
      true
    );
  }

  boardEl.addEventListener('focus', function () {
    if (!curOn) setCursor(0, 0, true);
  });

  boardEl.addEventListener('blur', function () {
    if (curOn) setCursor(curR, curC, false);
  });

  boardEl.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowUp') { e.preventDefault(); moveCursor(-1, 0); return; }
    if (k === 'ArrowDown') { e.preventDefault(); moveCursor(1, 0); return; }
    if (k === 'ArrowLeft') { e.preventDefault(); moveCursor(0, -1); return; }
    if (k === 'ArrowRight') { e.preventDefault(); moveCursor(0, 1); return; }
    if (k === 'f' || k === 'F') {
      e.preventDefault();
      if (!over) toggleFlag(curR, curC, true);
      return;
    }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (over) return;
      var cell = cells[curR][curC];
      if (cell.revealed && cell.count > 0) chordAt(curR, curC);
      else if (!cell.revealed) revealAt(curR, curC);
    }
  });

  /* ============================================================
     按钮绑定
     ============================================================ */

  for (var bi = 0; bi < diffBtnEls.length; bi++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        startDiff(btn.getAttribute('data-diff'));
      });
    })(diffBtnEls[bi]);
  }

  for (var ri = 0; ri < resDiffEls.length; ri++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        startDiff(btn.getAttribute('data-res-diff'));
      });
    })(resDiffEls[ri]);
  }

  customToggle.addEventListener('click', function () {
    customEl.classList.toggle('hidden');
  });

  custGo.addEventListener('click', function () {
    var cc = Math.max(5, Math.min(30, parseInt(custCols.value, 10) || 12));
    var rr = Math.max(5, Math.min(30, parseInt(custRows.value, 10) || 12));
    var mm = Math.max(1, Math.min(cc * rr - 9, parseInt(custMines.value, 10) || 25));
    customConf = { cols: cc, rows: rr, mines: mm };
    customEl.classList.add('hidden');
    dailyActive = false;
    clearSave(false);
    init('custom', customConf);
  });

  modeBtn.addEventListener('click', function () {
    flagMode = !flagMode;
    updateModeBtn();
    audio('ui');
  });

  if (!(window.Arcade && Arcade.input && Arcade.input.isTouch())) {
    modeBtn.style.display = 'none';
  }

  restartBtn.addEventListener('click', restart);
  resAgain.addEventListener('click', restart);
  resDaily.addEventListener('click', startDaily);
  dailyBtn.addEventListener('click', startDaily);
  achBtn.addEventListener('click', openAchPanel);
  achClose.addEventListener('click', closeAchPanel);
  achOv.addEventListener('click', function (e) {
    if (e.target === achOv) closeAchPanel();
  });
  noguessBtn.addEventListener('click', function () {
    noGuess = !noGuess;
    updateNoguessUi();
    if (!over) {
      if (window.Arcade && Arcade.ui) Arcade.ui.toast(T('gs.ms.noguessNext'), 'warn');
    }
    audio('ui');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && achOpen) closeAchPanel();
  });

  window.GAME_RESTART = function () { restart(); };

  /* 自动存档：切后台 / 离开页面时快照（普通局与每日局分键） */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveSnapshot();
  });
  window.addEventListener('pagehide', saveSnapshot);

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.minesweeper.helpText');
  root.appendChild(hd);

  /* ============================================================
     调试钩子（仅 ?qa=1）
     ============================================================ */

  function qaState() {
    return {
      started: started, over: over, submitted: submitted, diff: currentId,
      daily: dailyActive, dailySeed: dailyActive ? dailySeed : 0,
      dailySolvedToday: dailySolvedToday(),
      noGuess: noGuess, noGuessVerified: lastNoGuessVerified,
      revealed: revealedCount, total: rows * cols - mineCount, mines: mineCount,
      flags: flags, seconds: seconds, flagMode: flagMode,
      resultVisible: resultVisible,
      achievements: unlockedIds.slice(), achievementCount: unlockedIds.length,
      streak: winStreak,
      bests: {
        easy: bestFor('easy'), mid: bestFor('mid'),
        hard: bestFor('hard'), expert: bestFor('expert'),
        custom: bestFor('custom')
      },
      bestKey: bestKey(currentId),
      cursor: { r: curR, c: curC, on: curOn },
      expertScroll: {
        isExpert: isExpertLayout(),
        scrollWidth: scrollEl.scrollWidth,
        clientWidth: scrollEl.clientWidth
      }
    };
  }

  function qaPlaceIfNeeded() {
    if (started) return;
    started = true;
    placeBoard(0, 0);
    ensureTimer();
  }

  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) window.__qa = {
    state: qaState,
    start: function (cfg) {
      cfg = cfg || {};
      if (cfg.noGuess !== undefined) {
        noGuess = !!cfg.noGuess;
        updateNoguessUi();
      }
      if (cfg.daily) {
        startDaily();
      } else {
        var id = cfg.diff || 'easy';
        if (id === 'custom') {
          if (!customConf) customConf = { cols: 12, rows: 12, mines: 25 };
          init('custom', customConf);
        } else if (DIFFS[id]) {
          init(id, DIFFS[id]);
        }
      }
      return qaState();
    },
    reveal: function (r, c) { return revealAt(r, c); },
    flag: function (r, c) { return toggleFlag(r, c, false); },
    chord: function (r, c) { chordAt(r, c); },
    win: function () {
      if (over) return false;
      qaPlaceIfNeeded();
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cell = cells[r][c];
          if (!cell.mine && !cell.revealed && !cell.flagged) {
            cell.revealed = true;
            revealedCount++;
            paint(r, c, Math.min((r + c) * 8, 400));
          }
        }
      }
      winGame();
      return true;
    },
    lose: function () {
      if (over) return false;
      if (!started) revealAt(0, 0);
      if (over) return false;
      var hit = null;
      for (var r = 0; r < rows && !hit; r++) {
        for (var c = 0; c < cols; c++) {
          if (cells[r][c].mine && !cells[r][c].flagged) { hit = [r, c]; break; }
        }
      }
      if (!hit) hit = [0, 0];
      loseGame(hit[0], hit[1]);
      return true;
    },
    mineList: function () {
      if (!started) return [];
      var out = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) if (cells[r][c].mine) out.push([r, c]);
      return out;
    },
    safeList: function () {
      var out = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) if (!cells[r][c].mine) out.push([r, c]);
      return out;
    },
    achOpen: openAchPanel,
    achClose: closeAchPanel,
    dailyRecord: loadDailyRec,
    save: function () { saveSnapshot(); return true; },
    resume: tryResume,
    saveRaw: function (daily) { return readSave(saveKeyFor(!!daily)); }
  };

  /* ---------- 启动 ---------- */
  unlockedIds = loadAch();
  loadStreak();
  init('easy', DIFFS.easy);
  tryResume();
})();
