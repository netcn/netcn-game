/* ============================================================
   24点 · 旗舰版（2026-11 重构）
   - 难度分级：求解器枚举全部解，按「是否必须分数中间值 / 可用解数量」
     分为 简单 / 标准 / 大师 三档；出题按目标档筛选，绝不出无解题。
   - 每日题：日期种子 → 全球同题；首解记入 Arcade.daily（连胜/今日状态）。
   - 竞速榜：arcade_lb_game24 记录难度 / 用时 ms / 题面 / 时间戳，各档前 5。
   - 对战：玩家 vs AI，三局两胜或五局三胜，双方同题，AI 用真实求解器答案，
     按难度延迟 3~8 秒作答；回合比分、倒计时、先对者得分。
   - 视觉：霓虹手绘 CSS、数字牌翻转入场、胜负粒子与屏震、计时环。
   核心求解 / 表达式解析为纯函数，用 ==CORE-START== / ==CORE-END== 包裹。
   ============================================================ */

(function () {
  var root = document.getElementById('game-root');
  if (!root) return;

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.game24.tut1t'), d: T('gs.game24.tut1') },
    { t: T('gs.game24.tut2t'), d: T('gs.game24.tut2') },
    { t: T('gs.game24.tut3t'), d: T('gs.game24.tut3') },
    { t: T('gs.game24.tut4t'), d: T('gs.game24.tut4') }
  ];

  /* ==CORE-START== */
  var EPS = 1e-6;
  var OP_SYMS = ['+', '−', '×', '÷'];
  var MERGE_STEPS = 3;          /* 4 张牌最少 3 次合并 */
  var EASY_SOLUTIONS = 26;      /* 枚举上限同时作为「多解」阈值 */
  var MASTER_SOLUTIONS = 4;     /* 解法 ≤ 4 视为大师级稀缺解 */

  function applyOp(o, a, b) {
    if (o === 0) return a + b;
    if (o === 1) return a - b;
    if (o === 2) return a * b;
    if (o === 3) return Math.abs(b) < EPS ? NaN : a / b;
    return NaN;
  }

  function isIntVal(v) {
    return Math.abs(v - Math.round(v)) < EPS;
  }

  function stateKey(a) {
    return 'k' + a.slice().sort(function (x, y) { return x - y; })
      .map(function (v) { return Math.round(v * 1e6) / 1e6; }).join(',');
  }

  /* 可解性搜索：无序取对 + 6 种运算组合；失败状态按数值多重集记忆化。
     integerOnly 为 true 时，所有中间值必须是整数（用于识别大师题）。 */
  function canMake24(nums, integerOnly) {
    var memo = {};
    function rec(a) {
      if (a.length === 1) return Math.abs(a[0] - 24) < EPS;
      var k = stateKey(a);
      if (memo[k] !== undefined) return memo[k];
      for (var i = 0; i < a.length; i++) {
        for (var j = i + 1; j < a.length; j++) {
          var rest = [];
          for (var q = 0; q < a.length; q++) if (q !== i && q !== j) rest.push(a[q]);
          var x = a[i], y = a[j];
          var cands = [x + y, x * y, x - y, y - x];
          if (Math.abs(y) > EPS) cands.push(x / y);
          if (Math.abs(x) > EPS) cands.push(y / x);
          for (var c = 0; c < cands.length; c++) {
            var v = cands[c];
            if (!isFinite(v)) continue;
            if (integerOnly && !isIntVal(v)) continue;
            if (rec(rest.concat([v]))) { memo[k] = true; return true; }
          }
        }
      }
      memo[k] = false;
      return false;
    }
    return rec(nums.slice());
  }

  /* 递归合并：有序取对 + 4 种运算，覆盖全排列与 5 种二叉树括号结构。
     返回 { expr, steps }；steps[0] 为首个合并，供「第一步」提示。 */
  function solveDetailed(nums) {
    var found = null;
    function rec(list, steps) {
      if (found) return;
      if (list.length === 1) {
        if (Math.abs(list[0].v - 24) < EPS) found = { expr: list[0].e, steps: steps.slice() };
        return;
      }
      for (var i = 0; i < list.length; i++) {
        for (var j = 0; j < list.length; j++) {
          if (i === j) continue;
          for (var o = 0; o < 4; o++) {
            if (o === 3 && Math.abs(list[j].v) < EPS) continue;
            var v = applyOp(o, list[i].v, list[j].v);
            if (isNaN(v)) continue;
            var rest = [];
            for (var k = 0; k < list.length; k++) {
              if (k !== i && k !== j) rest.push(list[k]);
            }
            rest.push({ v: v, e: '(' + list[i].e + OP_SYMS[o] + list[j].e + ')' });
            var next = steps.concat([{ a: list[i].v, b: list[j].v, op: o, v: v }]);
            rec(rest, next);
            if (found) return;
          }
        }
      }
    }
    rec(nums.map(function (n) { return { v: n, e: String(n) }; }), []);
    return found;
  }

  function solve(nums) {
    var r = solveDetailed(nums);
    return r ? r.expr : null;
  }

  /* 解法数量（有序合并路径，上限 cap；用于多解/少解分级与题面展示） */
  function countSolutions(nums, cap, integerOnly) {
    var count = 0;
    function rec(a) {
      if (a.length === 1) {
        if (Math.abs(a[0] - 24) < EPS) count++;
        return count >= cap;
      }
      for (var i = 0; i < a.length; i++) {
        for (var j = 0; j < a.length; j++) {
          if (i === j) continue;
          var rest = [];
          for (var q = 0; q < a.length; q++) if (q !== i && q !== j) rest.push(a[q]);
          var x = a[i], y = a[j];
          var cands = [x + y, x - y, x * y];
          if (Math.abs(y) > EPS) cands.push(x / y);
          for (var o = 0; o < cands.length; o++) {
            var v = cands[o];
            if (!isFinite(v)) continue;
            if (integerOnly && !isIntVal(v)) continue;
            if (rec(rest.concat([v]))) return true;
          }
        }
      }
      return false;
    }
    rec(nums.slice());
    return count;
  }

  /* 轻量探测：只算档位与解数量，不构造表达式（出题时高频调用） */
  function probePuzzle(nums) {
    if (!canMake24(nums, false)) return null;
    var intOnly = canMake24(nums, true);
    var count = countSolutions(nums, EASY_SOLUTIONS, false);
    var tier = (!intOnly || count <= MASTER_SOLUTIONS)
      ? 'master'
      : (count >= EASY_SOLUTIONS ? 'easy' : 'standard');
    return { tier: tier, solutionCount: count, integerOnly: intOnly };
  }

  /* 完整分析：补全表达式、首步提示与展示字段（仅在最终出题时调用） */
  function analyzePuzzle(nums) {
    var det = solveDetailed(nums);
    if (!det) return null;
    var intOnly = canMake24(nums, true);
    var count = countSolutions(nums, EASY_SOLUTIONS, false);
    var tier = (!intOnly || count <= MASTER_SOLUTIONS)
      ? 'master'
      : (count >= EASY_SOLUTIONS ? 'easy' : 'standard');
    return {
      nums: nums.slice(),
      solution: det.expr,
      first: det.steps[0] || null,
      steps: MERGE_STEPS,
      solutionCount: count,
      capped: count >= EASY_SOLUTIONS,
      integerOnly: intOnly,
      tier: tier
    };
  }

  function fmt(v) {
    var r = Math.round(v);
    if (Math.abs(v - r) < EPS) return String(r);
    return String(Number(v.toFixed(2)));
  }

  function evalBinary(op, a, b) {
    if (op === '+') return a + b;
    if (op === '-' || op === '−') return a - b;
    if (op === '×' || op === '*') return a * b;
    if (op === '÷' || op === '/') return Math.abs(b) < EPS ? NaN : a / b;
    return NaN;
  }

  /* 递归下降解析：expr -> term ((+|-) term)*；term -> factor ((×|÷) factor)*
     token: { type:'num', v } | { type:'op', v } | { type:'paren', v } */
  function evaluateTokens(tokens) {
    var i = 0;
    function fail(code) { return { ok: false, error: code }; }

    function parseExpr() {
      var left = parseTerm();
      if (!left.ok) return left;
      while (i < tokens.length) {
        var t = tokens[i];
        if (t.type === 'op' && (t.v === '+' || t.v === '-' || t.v === '−')) {
          i++;
          var right = parseTerm();
          if (!right.ok) return right;
          left = { ok: true, value: t.v === '+' ? left.value + right.value : left.value - right.value };
        } else break;
      }
      return left;
    }

    function parseTerm() {
      var left = parseFactor();
      if (!left.ok) return left;
      while (i < tokens.length) {
        var t = tokens[i];
        if (t.type === 'op' && (t.v === '×' || t.v === '*' || t.v === '÷' || t.v === '/')) {
          i++;
          var right = parseFactor();
          if (!right.ok) return right;
          var v = evalBinary(t.v, left.value, right.value);
          if (isNaN(v)) return fail('div0');
          left = { ok: true, value: v };
        } else break;
      }
      return left;
    }

    function parseFactor() {
      var t = tokens[i];
      if (!t) return fail('syntax');
      if (t.type === 'num') {
        i++;
        return { ok: true, value: t.v };
      }
      if (t.type === 'op' && (t.v === '-' || t.v === '−')) {
        i++;
        var f = parseFactor();
        if (!f.ok) return f;
        return { ok: true, value: -f.value };
      }
      if (t.type === 'paren' && t.v === '(') {
        i++;
        var e = parseExpr();
        if (!e.ok) return e;
        var close = tokens[i];
        if (!close || !(close.type === 'paren' && close.v === ')')) return fail('unbalanced');
        i++;
        return e;
      }
      return fail('syntax');
    }

    if (!tokens.length) return fail('empty');
    var res = parseExpr();
    if (!res.ok) return res;
    if (i < tokens.length) {
      if (tokens[i].type === 'paren' && tokens[i].v === ')') return fail('unbalanced');
      return fail('syntax');
    }
    return res;
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /* 三档难度：数值范围 / 时限 / 基础分 / 时间系数 / 连对加成 / 得分倍率 */
  var DIFFS = [
    { key: 'easy', nameKey: 'gs.game24.dEasy', min: 1, max: 9, time: 90, base: 60, perSec: 5, streakBonus: 15, mult: 1, hintMode: 'full' },
    { key: 'standard', nameKey: 'gs.game24.dStandard', min: 1, max: 10, time: 60, base: 90, perSec: 6, streakBonus: 20, mult: 1.6, hintMode: 'first' },
    { key: 'master', nameKey: 'gs.game24.dMaster', min: 1, max: 13, time: 50, base: 130, perSec: 8, streakBonus: 25, mult: 2.4, hintMode: 'none' }
  ];

  /* 预置题库（按求解器指标归档，供随机生成超时/无匹配时回退） */
  var PRESET_SETS = [
    [1, 2, 3, 4], [1, 3, 4, 6], [2, 3, 4, 6], [3, 3, 8, 8], [4, 4, 4, 4],
    [1, 5, 5, 5], [1, 4, 5, 6], [2, 2, 10, 10], [6, 6, 6, 6], [13, 13, 1, 1],
    [13, 5, 6, 2], [11, 7, 4, 2], [13, 9, 3, 1], [1, 6, 6, 8], [2, 7, 8, 9],
    [3, 4, 8, 10], [8, 8, 3, 3], [5, 5, 5, 1],
    [10, 9, 7, 7], [1, 4, 5, 7], [7, 6, 2, 8], [6, 3, 3, 6], [5, 2, 1, 5],
    [1, 5, 9, 4], [6, 4, 8, 10], [2, 5, 4, 5], [1, 7, 6, 4], [9, 4, 5, 8]
  ];

  var PRESET_LIB = (function buildPresets() {
    var lib = { easy: [], standard: [], master: [] };
    PRESET_SETS.forEach(function (nums) {
      var p = analyzePuzzle(nums);
      if (p) lib[p.tier].push(p);
    });
    return lib;
  })();

  function pickFallback(tier) {
    var pool = PRESET_LIB[tier];
    if (!pool || !pool.length) pool = PRESET_LIB.standard.length ? PRESET_LIB.standard : PRESET_LIB.easy;
    if (!pool.length) return null;
    var p = pool[randInt(0, pool.length - 1)];
    return {
      nums: p.nums.slice(), solution: p.solution, first: p.first, steps: p.steps,
      solutionCount: p.solutionCount, capped: p.capped, integerOnly: p.integerOnly, tier: p.tier
    };
  }

  /* 按目标档位出题：先随机筛选，超出时间/次数预算回退预置题库 */
  function makePuzzle(diff, tierOverride) {
    var tier = tierOverride || diff.key;
    var start = Date.now();
    var tries = 0;
    while (tries < 320) {
      tries++;
      var nums = [
        randInt(diff.min, diff.max), randInt(diff.min, diff.max),
        randInt(diff.min, diff.max), randInt(diff.min, diff.max)
      ];
      var probe = probePuzzle(nums);
      if (!probe) {
        if (tries % 36 === 0 && Date.now() - start > 45) break;
        continue;
      }
      if (probe.tier === tier) return analyzePuzzle(nums);
      if (tries % 36 === 0 && Date.now() - start > 45) break;
    }
    return pickFallback(tier) || pickFallback('standard') || pickFallback('easy');
  }
  /* ==CORE-END== */

  /* ---------------- 常量与 UI 骨架 ---------------- */

  var BEST_KEY = document.body.getAttribute('data-game-id') || 'game24';
  var GAME_ID = BEST_KEY;
  var LB_KEY = 'arcade_lb_game24';
  var LB_STORE = 5;

  function audio(name) {
    if (window.Arcade && Arcade.audio) Arcade.audio.play(name);
  }

  function keyBtn(k, label, cls, aria) {
    return '<button type="button" class="g24-key' + (cls ? ' ' + cls : '') +
      '" data-k="' + k + '" aria-label="' + aria + '">' + label + '</button>';
  }

  var KEYS_HTML =
    keyBtn('1', '1', '', '1') + keyBtn('2', '2', '', '2') + keyBtn('3', '3', '', '3') +
    keyBtn('4', '4', '', '4') + keyBtn('5', '5', '', '5') +
    keyBtn('6', '6', '', '6') + keyBtn('7', '7', '', '7') + keyBtn('8', '8', '', '8') +
    keyBtn('9', '9', '', '9') + keyBtn('0', '0', '', '0') +
    keyBtn('+', '+', 'op', '+') + keyBtn('-', '−', 'op', '−') +
    keyBtn('*', '×', 'op', '×') + keyBtn('/', '÷', 'op', '÷') +
    keyBtn('back', '⌫', 'act', 'backspace') +
    keyBtn('(', '(', 'paren', '(') + keyBtn(')', ')', 'paren', ')') +
    keyBtn('undo', T('gs.game24.undo'), 'act', T('gs.game24.undo')) +
    keyBtn('hint', T('gs.game24.hint'), 'act', T('gs.game24.hint')) +
    keyBtn('clear', T('gs.game24.clear'), 'act', T('gs.game24.clear')) +
    keyBtn('skip', T('gs.game24.newPuzzle'), 'skip', T('gs.game24.newPuzzle')) +
    keyBtn('submit', T('gs.game24.submit'), 'submit', T('gs.game24.submit'));

  root.innerHTML =
    '<div class="g24-wrap">' +
    '  <div class="g24-top">' +
    '    <div class="g24-modes" id="g24-modes" role="tablist"></div>' +
    '    <div class="g24-hud">' +
    '      <span class="g24-chip">' + T('gs.game24.totalScore') + '<b id="g24-total">0</b></span>' +
    '      <span class="g24-chip streak" id="g24-streakWrap">' + T('gs.game24.streak') + '<b id="g24-streak">0</b></span>' +
    '      <span class="g24-chip best">' + T('gs.game24.best') + '<b id="g24-best">0</b></span>' +
    '      <span class="g24-chip daily" id="g24-dailyChip"></span>' +
    '    </div>' +
    '  </div>' +
    '  <div class="g24-diffs" id="g24-diffs" role="group"></div>' +
    '  <div class="g24-sub">' +
    '    <div class="g24-series hidden" id="g24-series" role="group"></div>' +
    '    <span class="g24-mult" id="g24-mult"></span>' +
    '  </div>' +
    '  <div class="g24-dailybar hidden" id="g24-dailybar">' +
    '    <span id="g24-dailyDate"></span><span id="g24-dailyState"></span>' +
    '  </div>' +
    '  <div class="g24-vs hidden" id="g24-vs">' +
    '    <div class="g24-vs-side p"><span class="g24-vs-role">' + T('gs.game24.you') + '</span><b id="g24-vsP">0</b></div>' +
    '    <div class="g24-vs-mid">' +
    '      <span id="g24-vsRound"></span>' +
    '      <div class="g24-vs-dots" id="g24-vsDots"></div>' +
    '      <span id="g24-vsStatus" aria-live="polite"></span>' +
    '    </div>' +
    '    <div class="g24-vs-side a"><span class="g24-vs-role">AI</span><b id="g24-vsA">0</b></div>' +
    '  </div>' +
    '  <div class="g24-stage" id="g24-stage">' +
    '    <div class="g24-cards" id="g24-cards"></div>' +
    '    <div class="g24-ring" id="g24-ring" role="timer" aria-label="timer"><span id="g24-timerText">--</span></div>' +
    '  </div>' +
    '  <div class="g24-timer"><div class="g24-timer-fill" id="g24-timerFill"></div></div>' +
    '  <div class="game-message" id="g24-msg">' + T('gs.game24.msgStart') + '</div>' +
    '  <div class="g24-expr-box" id="g24-exprBox"><div class="g24-expr" id="g24-expr" aria-live="polite"></div></div>' +
    '  <div class="g24-preview" id="g24-preview"></div>' +
    '  <div class="g24-keys" id="g24-keys">' + KEYS_HTML + '</div>' +
    '  <div class="g24-result hidden" id="g24-result" role="dialog" aria-live="polite">' +
    '    <div class="g24-res-title" id="g24-resTitle"></div>' +
    '    <div class="g24-res-reason" id="g24-resReason"></div>' +
    '    <div class="g24-res-meta" id="g24-resMeta"></div>' +
    '    <div class="g24-res-stats">' +
    '      <div class="g24-res-stat"><span id="g24-lblScore">' + T('gs.game24.roundScore') + '</span><b id="g24-resScore">0</b></div>' +
    '      <div class="g24-res-stat"><span id="g24-lblStreak">' + T('gs.game24.streak') + '</span><b id="g24-resStreak">0</b></div>' +
    '      <div class="g24-res-stat"><span id="g24-lblTotal">' + T('gs.game24.totalScore') + '</span><b id="g24-resTotal">0</b></div>' +
    '      <div class="g24-res-stat"><span id="g24-lblBest">' + T('gs.game24.best') + '</span><b id="g24-resBest">0</b></div>' +
    '    </div>' +
    '    <div class="g24-res-sol" id="g24-resSol"></div>' +
    '    <div class="g24-lb hidden" id="g24-lb"></div>' +
    '    <div class="g24-res-actions">' +
    '      <button class="btn green" id="g24-next">' + T('gs.game24.nextPuzzle') + '</button>' +
    '      <button class="btn purple" id="g24-restart">' + T('gs.game24.restart') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <p class="help-text">' + T('gs.game24.keyHint') + '</p>' +
    '  <div class="g24-helpnote">' + T('gs.game24.helpText') + '</div>' +
    '</div>';

  var modesEl = document.getElementById('g24-modes');
  var diffsEl = document.getElementById('g24-diffs');
  var seriesEl = document.getElementById('g24-series');
  var multEl = document.getElementById('g24-mult');
  var dailyBarEl = document.getElementById('g24-dailybar');
  var dailyDateEl = document.getElementById('g24-dailyDate');
  var dailyStateEl = document.getElementById('g24-dailyState');
  var vsEl = document.getElementById('g24-vs');
  var vsPEl = document.getElementById('g24-vsP');
  var vsAEl = document.getElementById('g24-vsA');
  var vsRoundEl = document.getElementById('g24-vsRound');
  var vsDotsEl = document.getElementById('g24-vsDots');
  var vsStatusEl = document.getElementById('g24-vsStatus');
  var streakWrapEl = document.getElementById('g24-streakWrap');
  var dailyChipEl = document.getElementById('g24-dailyChip');
  var totalEl = document.getElementById('g24-total');
  var streakEl = document.getElementById('g24-streak');
  var bestEl = document.getElementById('g24-best');
  var stageEl = document.getElementById('g24-stage');
  var timerTextEl = document.getElementById('g24-timerText');
  var timerFillEl = document.getElementById('g24-timerFill');
  var ringEl = document.getElementById('g24-ring');
  var msgEl = document.getElementById('g24-msg');
  var cardsEl = document.getElementById('g24-cards');
  var exprBoxEl = document.getElementById('g24-exprBox');
  var exprEl = document.getElementById('g24-expr');
  var previewEl = document.getElementById('g24-preview');
  var keysEl = document.getElementById('g24-keys');
  var resultEl = document.getElementById('g24-result');
  var resTitleEl = document.getElementById('g24-resTitle');
  var resReasonEl = document.getElementById('g24-resReason');
  var resMetaEl = document.getElementById('g24-resMeta');
  var resScoreEl = document.getElementById('g24-resScore');
  var resStreakEl = document.getElementById('g24-resStreak');
  var resTotalEl = document.getElementById('g24-resTotal');
  var resBestEl = document.getElementById('g24-resBest');
  var resSolEl = document.getElementById('g24-resSol');
  var lbEl = document.getElementById('g24-lb');
  var lblScoreEl = document.getElementById('g24-lblScore');
  var lblStreakEl = document.getElementById('g24-lblStreak');
  var lblTotalEl = document.getElementById('g24-lblTotal');
  var lblBestEl = document.getElementById('g24-lblBest');
  var nextBtn = document.getElementById('g24-next');
  var restartBtn = document.getElementById('g24-restart');

  /* ---------------- 模式 / 难度按钮 ---------------- */

  var MODE_DEFS = [
    { key: 'solo', nameKey: 'gs.game24.modeSolo' },
    { key: 'daily', nameKey: 'gs.game24.modeDaily' },
    { key: 'vs', nameKey: 'gs.game24.modeVs' }
  ];

  var modeBtns = MODE_DEFS.map(function (m) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g24-mode';
    b.setAttribute('role', 'tab');
    b.textContent = T(m.nameKey);
    b.setAttribute('aria-label', T(m.nameKey));
    b.addEventListener('click', function (e) { if (e.detail > 0) b.blur(); setMode(m.key); });
    modesEl.appendChild(b);
    return b;
  });

  var diffBtns = DIFFS.map(function (d, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g24-diff';
    b.textContent = T(d.nameKey) + ' ×' + d.mult;
    b.setAttribute('aria-label', T(d.nameKey) + ' ×' + d.mult + ' · ' + d.time + 's');
    b.addEventListener('click', function (e) { if (e.detail > 0) b.blur(); setDiff(i); });
    diffsEl.appendChild(b);
    return b;
  });

  var seriesBtns = [3, 5].map(function (n) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'g24-series-btn';
    b.textContent = T(n === 3 ? 'gs.game24.bestOf3' : 'gs.game24.bestOf5');
    b.setAttribute('aria-label', b.textContent);
    b.addEventListener('click', function (e) { if (e.detail > 0) b.blur(); setSeries(n); });
    seriesEl.appendChild(b);
    return b;
  });

  /* ---------------- 状态 ---------------- */

  var diffIdx = 1;
  var mode = 'solo';
  var series = 3;
  var puzzle = null;
  var tokens = [];
  var digitBuf = '';
  var usedCards = [false, false, false, false];
  var cardEls = [];
  var streak = 0;
  var total = 0;
  var roundActive = false;
  var locked = false;
  var playerLocked = false;
  var submittedThisRound = false;
  var deadline = 0;
  var roundStartAt = 0;
  var tickTimer = null;
  var fxTimer = null;
  var vsAiTimer = null;
  var vsNextTimer = null;
  var dailyCache = { key: null, puzzle: null };
  var dailyWasSolved = false;

  var vs = {
    player: 0, ai: 0, round: 0, target: 2,
    resolved: true, aiAnswered: false, aiAt: 0, matchOver: false
  };

  /* ---------------- 通用工具 ---------------- */

  function setMsg(text, color) {
    msgEl.textContent = text;
    msgEl.style.color = color || '';
  }

  function readBest() {
    try {
      var b = Arcade.storage ? Arcade.storage.getBest(BEST_KEY) : null;
      return (b === null || b === undefined || isNaN(b)) ? 0 : b;
    } catch (e) { return 0; }
  }

  function fmtSec(sec) {
    return String(Number(sec.toFixed(2)));
  }

  function puzzleText(p) {
    return p.nums.join(' ');
  }

  function pointsFor(d) {
    var remaining = Math.max(0, (deadline - Date.now()) / 1000);
    var raw = d.base + Math.round(remaining * d.perSec) + Math.min(streak, 5) * d.streakBonus;
    return Math.round(raw * d.mult);
  }

  function tierName(tier) {
    if (tier === 'easy') return T('gs.game24.dEasy');
    if (tier === 'master') return T('gs.game24.dMaster');
    return T('gs.game24.dStandard');
  }

  function solutionText(p) {
    if (p.capped) return T('gs.game24.solutionsPlus').replace('{n}', String(p.solutionCount));
    return T('gs.game24.solutions').replace('{n}', String(p.solutionCount));
  }

  function updateHud() {
    totalEl.textContent = String(total);
    streakEl.textContent = String(streak);
    bestEl.textContent = String(Math.max(readBest(), total));
    updateDailyChip();
  }

  function renderDiff() {
    diffBtns.forEach(function (b, i) {
      b.classList.toggle('active', i === diffIdx);
      b.setAttribute('aria-pressed', i === diffIdx ? 'true' : 'false');
    });
    multEl.textContent = T('gs.game24.mult').replace('{m}', String(DIFFS[diffIdx].mult));
  }

  function renderModes() {
    modeBtns.forEach(function (b, i) {
      var on = MODE_DEFS[i].key === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    seriesEl.classList.toggle('hidden', mode !== 'vs');
    dailyBarEl.classList.toggle('hidden', mode !== 'daily');
    vsEl.classList.toggle('hidden', mode !== 'vs');
    streakWrapEl.classList.toggle('hidden', mode === 'vs');
    seriesBtns.forEach(function (b, i) {
      var n = i === 0 ? 3 : 5;
      b.classList.toggle('active', n === series);
      b.setAttribute('aria-pressed', n === series ? 'true' : 'false');
    });
  }

  function updateKeyAvailability() {
    var hintKey = keysEl.querySelector('[data-k="hint"]');
    var skipKey = keysEl.querySelector('[data-k="skip"]');
    var hintOff = mode === 'vs';
    var skipOff = mode === 'vs';
    if (hintKey) hintKey.classList.toggle('g24-key-off', hintOff);
    if (skipKey) skipKey.classList.toggle('g24-key-off', skipOff);
  }

  function updateDailyChip() {
    if (!window.Arcade || !Arcade.daily) {
      dailyChipEl.textContent = T('gs.game24.dailyChip') + ' ' + T('gs.game24.dailyUnavailable');
      return;
    }
    var solved = Arcade.daily.isSolved(GAME_ID);
    var t = Arcade.daily.solvedTime(GAME_ID);
    dailyChipEl.textContent = T('gs.game24.dailyChip') + ' ' +
      (solved ? T('gs.game24.dailySolved').replace('{t}', fmtSec(Number(t) || 0))
              : T('gs.game24.dailyUnsolved')) +
      ' · ' + T('gs.game24.dailyStreak').replace('{n}', String(Arcade.daily.streak()));
  }

  function updateDailyBar() {
    if (mode !== 'daily' || !window.Arcade || !Arcade.daily) return;
    var key = Arcade.daily.dayStr();
    var solved = Arcade.daily.isSolved(GAME_ID);
    var t = Arcade.daily.solvedTime(GAME_ID);
    var st = Arcade.daily.streak();
    dailyDateEl.textContent = T('gs.game24.dailyTitle').replace('{d}', key);
    dailyStateEl.textContent = (solved
      ? T('gs.game24.dailyDone').replace('{t}', fmtSec(Number(t) || 0))
      : T('gs.game24.dailyPending')) + ' · ' + T('gs.game24.dailyStreak').replace('{n}', String(st));
  }

  function pulseBad(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(function () { el.classList.remove('shake'); }, 420);
  }

  function feedback(text) {
    setMsg(text, 'var(--neon-pink)');
    pulseBad(exprBoxEl);
    audio('error');
  }

  function burstAt(el, color, count) {
    if (!window.Arcade || !Arcade.fx || !el) return;
    var r = el.getBoundingClientRect();
    Arcade.fx.burst(r.left + r.width / 2, r.top + r.height / 2, color, count);
  }

  function countUsed() {
    var n = 0;
    for (var i = 0; i < usedCards.length; i++) if (usedCards[i]) n++;
    return n;
  }

  function exprText() {
    return tokens.map(function (t) {
      return t.type === 'num' ? String(t.v) : t.v;
    }).join(' ');
  }

  function isInputOpen() {
    return roundActive && !locked;
  }

  /* ---------------- 渲染 ---------------- */

  function renderCards() {
    cardsEl.innerHTML = '';
    cardEls = [];
    puzzle.nums.forEach(function (n, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'g24-card';
      b.style.animationDelay = (i * 70) + 'ms';
      b.setAttribute('aria-label', String(n));
      var val = document.createElement('span');
      val.className = 'g24-val';
      val.textContent = String(n);
      var tag = document.createElement('span');
      tag.className = 'g24-tag';
      b.appendChild(val);
      b.appendChild(tag);
      b.addEventListener('click', function () { if (b.blur) b.blur(); onCard(i); });
      cardsEl.appendChild(b);
      cardEls.push(b);
    });
    updateCards();
  }

  function updateCards() {
    cardEls.forEach(function (el, i) {
      var used = !!usedCards[i];
      el.classList.toggle('used', used);
      el.setAttribute('aria-disabled', used ? 'true' : 'false');
      var tag = el.querySelector('.g24-tag');
      if (tag) tag.textContent = used ? T('gs.game24.used') : '';
    });
  }

  function renderExpr() {
    exprEl.innerHTML = '';
    if (!tokens.length && !digitBuf) {
      var ph = document.createElement('span');
      ph.className = 'g24-ph';
      ph.textContent = T('gs.game24.exprPlaceholder');
      exprEl.appendChild(ph);
    } else {
      tokens.forEach(function (tk) {
        var s = document.createElement('span');
        s.className = 'g24-tok ' + (tk.type === 'num' ? 'num' : (tk.type === 'op' ? 'op' : 'paren'));
        s.textContent = tk.type === 'num' ? String(tk.v) : tk.v;
        exprEl.appendChild(s);
      });
      if (digitBuf) {
        var b = document.createElement('span');
        b.className = 'g24-buf';
        b.textContent = digitBuf;
        exprEl.appendChild(b);
      }
    }
    exprEl.scrollLeft = exprEl.scrollWidth;
    updatePreview();
  }

  function updatePreview() {
    previewEl.textContent = '';
    previewEl.classList.remove('good');
    if (!tokens.length || digitBuf) return;
    var res = evaluateTokens(tokens);
    if (!res.ok) return;
    previewEl.textContent = '= ' + fmt(res.value);
    if (Math.abs(res.value - 24) < EPS) previewEl.classList.add('good');
  }

  /* ---------------- 输入 ---------------- */

  function typeDigit(d) {
    if (!isInputOpen()) return;
    if (digitBuf.length >= 2) return;
    var next = Number(digitBuf + d);
    if (next > 13) { audio('back'); return; }
    digitBuf += d;
    renderExpr();
    audio('type');
  }

  function commitDigitBuf() {
    if (!digitBuf) return true;
    var val = Number(digitBuf);
    var idx = -1;
    for (var i = 0; i < 4; i++) {
      if (!usedCards[i] && puzzle.nums[i] === val) { idx = i; break; }
    }
    if (isNaN(val) || idx < 0) {
      digitBuf = '';
      renderExpr();
      feedback(T('gs.game24.errNumber'));
      return false;
    }
    usedCards[idx] = true;
    tokens.push({ type: 'num', v: val, card: idx });
    digitBuf = '';
    renderExpr();
    updateCards();
    return true;
  }

  function onCard(i) {
    if (!isInputOpen()) return;
    if (usedCards[i]) {
      setMsg(T('gs.game24.cardUsed'), 'var(--neon-yellow)');
      pulseBad(cardEls[i]);
      audio('back');
      return;
    }
    digitBuf = '';
    usedCards[i] = true;
    tokens.push({ type: 'num', v: puzzle.nums[i], card: i });
    renderExpr();
    updateCards();
    audio('ui');
  }

  function insertOp(op) {
    if (!isInputOpen()) return;
    if (!commitDigitBuf()) return;
    tokens.push({ type: 'op', v: op });
    renderExpr();
    audio('rotate');
  }

  function insertParen(p) {
    if (!isInputOpen()) return;
    if (!commitDigitBuf()) return;
    tokens.push({ type: 'paren', v: p });
    renderExpr();
    audio('rotate');
  }

  function backspace() {
    if (!isInputOpen()) return;
    if (digitBuf) {
      digitBuf = digitBuf.slice(0, -1);
    } else {
      var t = tokens.pop();
      if (t && t.type === 'num') usedCards[t.card] = false;
    }
    renderExpr();
    updateCards();
    audio('back');
  }

  function clearExpr(silent) {
    if (!isInputOpen()) return;
    tokens = [];
    digitBuf = '';
    usedCards = [false, false, false, false];
    renderExpr();
    updateCards();
    if (!silent) {
      setMsg(T('gs.game24.msgStart'));
      audio('back');
    }
  }

  function showHint() {
    if (!isInputOpen()) return;
    if (mode === 'vs') {
      setMsg(T('gs.game24.vsNoHint'), 'var(--neon-yellow)');
      audio('back');
      return;
    }
    var hintMode = DIFFS[diffIdx].hintMode;
    if (hintMode === 'none') {
      setMsg(T('gs.game24.noHintMaster'), 'var(--neon-yellow)');
      audio('back');
      return;
    }
    if (hintMode === 'first' && puzzle.first) {
      var f = puzzle.first;
      setMsg(T('gs.game24.hintFirst')
        .replace('{a}', fmt(f.a)).replace('{op}', OP_SYMS[f.op])
        .replace('{b}', fmt(f.b)).replace('{v}', fmt(f.v)), 'var(--neon-yellow)');
    } else {
      setMsg(T('gs.game24.hintMsg').replace('{h}', puzzle.solution), 'var(--neon-yellow)');
    }
    audio('coin');
  }

  /* ---------------- 每日题（日期种子，全球同题） ---------------- */

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clonePuzzle(p) {
    return {
      nums: p.nums.slice(), solution: p.solution, first: p.first, steps: p.steps,
      solutionCount: p.solutionCount, capped: p.capped, integerOnly: p.integerOnly, tier: p.tier
    };
  }

  function makeDailyPuzzle(dayKey) {
    if (dailyCache.key === dayKey && dailyCache.puzzle) return dailyCache.puzzle;
    var seed = hashSeed(dayKey);
    var rand = mulberry32(seed);
    var tiers = ['easy', 'standard', 'master'];
    var target = tiers[seed % 3];
    var anyNums = null;
    for (var i = 0; i < 180; i++) {
      var nums = [
        1 + Math.floor(rand() * 13), 1 + Math.floor(rand() * 13),
        1 + Math.floor(rand() * 13), 1 + Math.floor(rand() * 13)
      ].sort(function (a, b) { return a - b; });
      var probe = probePuzzle(nums);
      if (!probe) continue;
      if (!anyNums) anyNums = nums;
      if (probe.tier === target) {
        var hit = analyzePuzzle(nums);
        if (hit) {
          dailyCache.key = dayKey;
          dailyCache.puzzle = hit;
          return hit;
        }
      }
    }
    var fallback = null;
    if (anyNums) fallback = analyzePuzzle(anyNums);
    if (!fallback) {
      var pool = PRESET_LIB[target] && PRESET_LIB[target].length
        ? PRESET_LIB[target]
        : (PRESET_LIB.standard.length ? PRESET_LIB.standard : PRESET_LIB.easy);
      fallback = clonePuzzle(pool[(seed >>> 4) % pool.length]);
    }
    dailyCache.key = dayKey;
    dailyCache.puzzle = fallback;
    return fallback;
  }

  /* ---------------- 本地竞速榜（arcade_lb_game24） ---------------- */

  function readLb() {
    var arr = [];
    try {
      var raw = localStorage.getItem(LB_KEY);
      if (raw) arr = JSON.parse(raw) || [];
    } catch (e) { arr = []; }
    if (!arr || typeof arr.length !== 'number') arr = [];
    var valid = [];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (!e || typeof e.ms !== 'number' || !isFinite(e.ms) || e.ms <= 0) continue;
      if (typeof e.ts !== 'number' || typeof e.puzzle !== 'string') continue;
      if (e.diff !== 'easy' && e.diff !== 'standard' && e.diff !== 'master') continue;
      valid.push({ diff: e.diff, ms: Math.round(e.ms), puzzle: e.puzzle, ts: e.ts });
    }
    valid.sort(function (a, b) { return a.ms - b.ms || a.ts - b.ts; });
    return valid;
  }

  function addLb(diffKey, ms, p) {
    var entry = { diff: diffKey, ms: Math.round(ms), puzzle: puzzleText(p), ts: Date.now() };
    var all = readLb();
    all.push(entry);
    var out = [];
    var record = null;
    ['easy', 'standard', 'master'].forEach(function (key) {
      var group = all.filter(function (e) { return e.diff === key; });
      group.sort(function (a, b) { return a.ms - b.ms || a.ts - b.ts; });
      for (var i = 0; i < group.length && i < LB_STORE; i++) {
        out.push(group[i]);
        if (group[i] === entry) record = { rank: i + 1, entry: entry };
      }
    });
    try {
      localStorage.setItem(LB_KEY, JSON.stringify(out));
    } catch (e) {
      if (window.Arcade && Arcade.storage && Arcade.storage.markWriteFail) Arcade.storage.markWriteFail();
    }
    return record;
  }

  function renderLeaderboard(highlight) {
    lbEl.innerHTML = '';
    lbEl.classList.remove('hidden');
    var title = document.createElement('div');
    title.className = 'g24-lb-title';
    title.textContent = T('gs.game24.lbTitle');
    lbEl.appendChild(title);
    var all = readLb();
    var grid = document.createElement('div');
    grid.className = 'g24-lb-grid';
    ['easy', 'standard', 'master'].forEach(function (key) {
      var col = document.createElement('div');
      col.className = 'g24-lb-col';
      var head = document.createElement('div');
      head.className = 'g24-lb-diff';
      head.textContent = tierName(key);
      col.appendChild(head);
      var list = all.filter(function (e) { return e.diff === key; }).slice(0, LB_STORE);
      if (!list.length) {
        var empty = document.createElement('div');
        empty.className = 'g24-lb-empty';
        empty.textContent = T('gs.game24.lbEmpty');
        col.appendChild(empty);
      } else {
        list.forEach(function (e, i) {
          var row = document.createElement('div');
          row.className = 'g24-lb-row';
          if (highlight && e.ts === highlight.ts && e.diff === highlight.diff) row.classList.add('new');
          var r = document.createElement('span');
          r.className = 'r';
          r.textContent = String(i + 1);
          var t = document.createElement('span');
          t.className = 't';
          t.textContent = fmtSec(e.ms / 1000) + 's';
          var p = document.createElement('span');
          p.className = 'p';
          p.textContent = e.puzzle;
          row.appendChild(r);
          row.appendChild(t);
          row.appendChild(p);
          col.appendChild(row);
        });
      }
      grid.appendChild(col);
    });
    lbEl.appendChild(grid);
  }

  /* ---------------- 计时环 ---------------- */

  function updateTimerUI(left) {
    var d = DIFFS[diffIdx];
    var ratio = Math.max(0, Math.min(1, left / (d.time * 1000)));
    timerFillEl.style.width = (ratio * 100).toFixed(1) + '%';
    timerTextEl.textContent = Math.max(0, Math.ceil(left / 1000)) + 's';
    if (ringEl) ringEl.style.setProperty('--p', (ratio * 100).toFixed(1));
    var warn = left > 0 && left <= Math.min(10000, d.time * 1000 * 0.3);
    timerFillEl.classList.toggle('warn', warn);
    if (ringEl) ringEl.classList.toggle('warn', warn);
  }

  function stopTimer() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  function clearVsTimers() {
    if (vsAiTimer) { clearTimeout(vsAiTimer); vsAiTimer = null; }
    if (vsNextTimer) { clearTimeout(vsNextTimer); vsNextTimer = null; }
  }

  function startTimer() {
    stopTimer();
    var d = DIFFS[diffIdx];
    deadline = Date.now() + d.time * 1000;
    timerFillEl.classList.remove('warn');
    if (ringEl) ringEl.classList.remove('warn');
    updateTimerUI(d.time * 1000);
    tickTimer = setInterval(function () {
      if (!roundActive) return;
      var left = deadline - Date.now();
      updateVsClock();
      if (left <= 0) {
        updateTimerUI(0);
        if (mode === 'vs') vsTimeout();
        else endRound('timeout');
        return;
      }
      updateTimerUI(left);
    }, 140);
  }

  /* ---------------- 动效 ---------------- */

  function winFx() {
    var colors = ['var(--neon-cyan)', 'var(--neon-pink)', 'var(--neon-yellow)', 'var(--neon-green)'];
    cardEls.forEach(function (el, i) {
      el.classList.remove('bounce');
      void el.offsetWidth;
      el.classList.add('bounce');
      burstAt(el, colors[i % colors.length], 10);
    });
    if (window.Arcade && Arcade.fx) Arcade.fx.flash('var(--neon-green)');
    if (ringEl) ringEl.classList.add('hit');
    if (fxTimer) clearTimeout(fxTimer);
    fxTimer = setTimeout(function () {
      cardEls.forEach(function (el) { el.classList.remove('bounce'); });
      if (ringEl) ringEl.classList.remove('hit');
      fxTimer = null;
    }, 900);
  }

  function loseFx() {
    if (window.Arcade && Arcade.fx) {
      var r = stageEl.getBoundingClientRect();
      Arcade.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 'var(--neon-pink)', 16);
      Arcade.fx.shake(stageEl);
    }
    stageEl.classList.remove('bad');
    void stageEl.offsetWidth;
    stageEl.classList.add('bad');
    if (fxTimer) clearTimeout(fxTimer);
    fxTimer = setTimeout(function () {
      stageEl.classList.remove('bad');
      fxTimer = null;
    }, 700);
  }

  /* ---------------- 结算 ---------------- */

  function resetResultLabels() {
    lblScoreEl.textContent = T('gs.game24.roundScore');
    lblStreakEl.textContent = T('gs.game24.streak');
    lblTotalEl.textContent = T('gs.game24.totalScore');
    lblBestEl.textContent = T('gs.game24.best');
  }

  function openResult() {
    keysEl.classList.add('hidden');
    resultEl.classList.remove('hidden');
    previewEl.textContent = '';
    previewEl.classList.remove('good');
  }

  function configureResultActions() {
    nextBtn.classList.toggle('hidden', mode === 'vs');
    nextBtn.textContent = mode === 'daily' ? T('gs.game24.dailyAgain') : T('gs.game24.nextPuzzle');
    restartBtn.textContent = mode === 'vs' ? T('gs.game24.vsRematch') : T('gs.game24.restart');
  }

  function endRound(kind, reason) {
    if (!roundActive) return;
    roundActive = false;
    locked = true;
    stopTimer();

    var d = DIFFS[diffIdx];
    var remaining = Math.max(0, (deadline - Date.now()) / 1000);
    var roundPoints = 0;
    var timeBonus = 0;
    var streakBonus = 0;
    var isNew = false;
    var solvedMs = 0;
    var lbRecord = null;
    dailySolveInfo = null;

    if (kind === 'win') {
      solvedMs = Math.max(1, Date.now() - roundStartAt);
      var dailyPractice = mode === 'daily' && dailyWasSolved;
      if (dailyPractice) {
        /* 每日题已解：重复练习只展示，不再计分、不再入榜/最佳 */
        dailySolveInfo = {
          fresh: false,
          seconds: Number(Arcade.daily.solvedTime(GAME_ID)) || Math.round(solvedMs / 1000),
          streak: Arcade.daily.streak()
        };
        winFx();
        audio('clear');
      } else {
        timeBonus = Math.round(remaining * d.perSec);
        streakBonus = Math.min(streak, 5) * d.streakBonus;
        roundPoints = Math.round((d.base + timeBonus + streakBonus) * d.mult);
        streak += 1;
        total += roundPoints;
        if (mode !== 'daily') lbRecord = addLb(d.key, solvedMs, puzzle);

        if (mode === 'daily' && window.Arcade && Arcade.daily) {
          var sec = Math.max(1, Math.round(solvedMs / 1000));
          var fresh = Arcade.daily.markSolved(GAME_ID, sec);
          var stored = Number(Arcade.daily.solvedTime(GAME_ID));
          dailySolveInfo = {
            fresh: fresh,
            seconds: isNaN(stored) ? sec : stored,
            streak: Arcade.daily.streak()
          };
        }

        winFx();
        audio('clear');
        if (streak >= 3) audio('win');
        if (mode !== 'vs' && !submittedThisRound && Arcade.shell && Arcade.shell.submitScore) {
          submittedThisRound = true;
          isNew = !!Arcade.shell.submitScore(total);
        }
      }
    } else {
      streak = 0;
      if (kind === 'timeout') audio('lose');
      else audio('error');
      loseFx();
      pulseBad(exprBoxEl);
    }

    updateHud();
    var bestNow = Math.max(readBest(), total);
    bestEl.textContent = String(bestNow);

    resultEl.classList.toggle('bad', kind !== 'win');
    var dailyPracticeNow = mode === 'daily' && dailyWasSolved;
    resTitleEl.textContent = kind === 'win'
      ? (dailyPracticeNow ? T('gs.game24.dailyPracticeTitle')
          : (isNew ? T('gs.game24.winNew') : T('gs.game24.resWin')))
      : (kind === 'timeout' ? T('gs.game24.resTimeout') : T('gs.game24.resWrong'));

    resMetaEl.textContent = tierName(puzzle.tier) + ' · ' + solutionText(puzzle);

    if (kind === 'win') {
      var breakText = T('gs.game24.scoreBreak')
        .replace('{b}', String(Math.round(d.base * d.mult)))
        .replace('{t}', String(Math.round(timeBonus * d.mult)))
        .replace('{s}', String(Math.round(streakBonus * d.mult)))
        .replace('{m}', String(d.mult));
      if (mode === 'daily' && dailySolveInfo) {
        var dailyText = dailySolveInfo.fresh
          ? T('gs.game24.dailyNew').replace('{t}', fmtSec(dailySolveInfo.seconds))
              .replace('{n}', String(dailySolveInfo.streak))
          : T('gs.game24.dailyReplay').replace('{t}', fmtSec(dailySolveInfo.seconds));
        resReasonEl.textContent = dailyPracticeNow ? dailyText : dailyText + ' · ' + breakText;
      } else {
        resReasonEl.textContent = breakText;
      }
      resSolEl.textContent = T('gs.game24.yourAnswer').replace('{a}', exprText());
    } else {
      resReasonEl.textContent = kind === 'timeout' ? T('gs.game24.resTimeoutMsg') : (reason || '');
      resSolEl.textContent = T('gs.game24.answerShow').replace('{a}', puzzle.solution);
    }

    resetResultLabels();
    resScoreEl.textContent = String(roundPoints);
    resStreakEl.textContent = String(streak);
    resTotalEl.textContent = String(total);
    resBestEl.textContent = String(bestNow);

    renderLeaderboard(lbRecord ? lbRecord.entry : null);
    configureResultActions();
    updateDailyBar();
    openResult();
  }

  /* ---------------- 对战模式（玩家 vs AI） ---------------- */

  function updateVsDots() {
    vsDotsEl.innerHTML = '';
    for (var i = 0; i < series; i++) {
      var dot = document.createElement('span');
      dot.className = 'g24-vs-dot';
      var h = vs.history[i];
      if (h === 'p') dot.classList.add('p');
      else if (h === 'a') dot.classList.add('a');
      else if (h === 'd') dot.classList.add('d');
      vsDotsEl.appendChild(dot);
    }
  }

  function updateVsPanel() {
    vsPEl.textContent = String(vs.player);
    vsAEl.textContent = String(vs.ai);
    vsRoundEl.textContent = T('gs.game24.vsRound')
      .replace('{r}', String(Math.max(1, vs.round)))
      .replace('{n}', String(vs.target));
    updateVsDots();
  }

  function updateVsClock() {
    if (mode !== 'vs' || vs.resolved || !roundActive) return;
    var left = Math.max(0, (vs.aiAt - Date.now()) / 1000);
    var txt = playerLocked
      ? T('gs.game24.vsLockedWait').replace('{s}', left.toFixed(1))
      : T('gs.game24.vsAiThinking').replace('{s}', left.toFixed(1));
    vsStatusEl.textContent = txt;
    vsStatusEl.classList.toggle('warn', left <= 2);
  }

  /* AI 思考时长：难题思考更久（简单 3–5s / 标准 4.5–6.5s / 大师 5.5–8s） */
  function aiDelayMs() {
    var d = DIFFS[diffIdx];
    var min = d.key === 'easy' ? 3000 : (d.key === 'standard' ? 4500 : 5500);
    var max = d.key === 'easy' ? 5000 : (d.key === 'standard' ? 6500 : 8000);
    return Math.round(min + Math.random() * (max - min));
  }

  function scheduleAi() {
    clearVsTimers();
    if (mode !== 'vs') return;
    vs.aiAnswered = false;
    var delay = aiDelayMs();
    vs.aiAt = Date.now() + delay;
    vsAiTimer = setTimeout(aiAnswer, delay);
    updateVsPanel();
    updateVsClock();
  }

  /* AI 答案直接取自本题求解器结果，不预置、不作弊 */
  function aiAnswer() {
    vsAiTimer = null;
    if (mode !== 'vs' || !roundActive || vs.resolved) return;
    vs.aiAnswered = true;
    resolveVs('ai');
  }

  function resolveVs(winner) {
    if (mode !== 'vs' || !roundActive || vs.resolved) return;
    vs.resolved = true;
    roundActive = false;
    locked = true;
    stopTimer();
    clearVsTimers();

    var d = DIFFS[diffIdx];
    var points = 0;
    if (winner === 'player') {
      points = pointsFor(d);
      total += points;
      streak += 1;
      vs.player += 1;
      vs.history.push('p');
      winFx();
      audio('clear');
    } else if (winner === 'ai') {
      vs.ai += 1;
      vs.history.push('a');
      streak = 0;
      loseFx();
      audio('lose');
    } else {
      vs.history.push('d');
      audio('back');
    }

    updateHud();
    updateVsPanel();

    var msg;
    if (winner === 'player') msg = T('gs.game24.vsPlayerWin');
    else if (winner === 'ai') msg = T('gs.game24.vsAiWin');
    else msg = T('gs.game24.vsDraw');
    setMsg(msg, winner === 'player' ? 'var(--neon-green)' : 'var(--neon-pink)');

    if (winner === 'ai') {
      vsStatusEl.textContent = T('gs.game24.vsAiSolved').replace('{a}', puzzle.solution);
    } else if (winner === 'player') {
      vsStatusEl.textContent = T('gs.game24.vsPlayerGain').replace('{p}', String(points));
    } else {
      vsStatusEl.textContent = '';
    }

    if (vs.player >= vs.target || vs.ai >= vs.target || vs.history.length >= series) {
      vs.matchOver = true;
      vsNextTimer = setTimeout(endMatch, 1600);
    } else {
      vsNextTimer = setTimeout(nextVsRound, 1600);
    }
  }

  function vsWrong(value) {
    locked = true;
    playerLocked = true;
    setMsg(T('gs.game24.vsWrongLocked').replace('{v}', fmt(value)), 'var(--neon-pink)');
    pulseBad(exprBoxEl);
    audio('error');
    updateVsClock();
  }

  function vsTimeout() {
    if (mode !== 'vs' || !roundActive || vs.resolved) return;
    resolveVs(vs.aiAnswered ? 'ai' : 'draw');
  }

  function nextVsRound() {
    vsNextTimer = null;
    if (mode !== 'vs' || vs.matchOver) return;
    vs.resolved = false;
    vs.aiAnswered = false;
    vs.round += 1;
    resultEl.classList.add('hidden');
    keysEl.classList.remove('hidden');
    deal();
    updateVsPanel();
  }

  function startMatch() {
    clearVsTimers();
    stopTimer();
    vs.player = 0;
    vs.ai = 0;
    vs.round = 0;
    vs.target = Math.ceil(series / 2);
    vs.resolved = true;
    vs.matchOver = false;
    vs.aiAnswered = false;
    vs.history = [];
    total = 0;
    streak = 0;
    submittedThisRound = false;
    dailySolveInfo = null;
    updateHud();
    updateVsPanel();
    nextVsRound();
    audio('ui');
  }

  function endMatch() {
    vsNextTimer = null;
    if (mode !== 'vs') return;
    vs.matchOver = true;
    roundActive = false;
    locked = true;
    stopTimer();
    clearVsTimers();

    var won = vs.player >= vs.target;
    var aiWon = vs.ai >= vs.target;
    var draw = !won && !aiWon;

    if (won) winFx();
    else if (!draw) loseFx();
    updateHud();
    var bestNow = Math.max(readBest(), total);
    bestEl.textContent = String(bestNow);

    resultEl.classList.toggle('bad', !won);
    resTitleEl.textContent = won
      ? T('gs.game24.vsMatchWin')
      : (draw ? T('gs.game24.vsMatchDraw') : T('gs.game24.vsMatchLose'));
    resReasonEl.textContent = T('gs.game24.vsScoreLine')
      .replace('{p}', String(vs.player))
      .replace('{a}', String(vs.ai))
      .replace('{n}', String(series));
    resMetaEl.textContent = T('gs.game24.vsMeta')
      .replace('{r}', String(vs.history.length))
      .replace('{t}', tierName(puzzle.tier));
    resSolEl.textContent = T('gs.game24.answerShow').replace('{a}', puzzle.solution);

    lblScoreEl.textContent = T('gs.game24.vsPlayerWins');
    lblStreakEl.textContent = T('gs.game24.vsAiWins');
    lblTotalEl.textContent = T('gs.game24.totalScore');
    lblBestEl.textContent = T('gs.game24.best');
    resScoreEl.textContent = String(vs.player);
    resStreakEl.textContent = String(vs.ai);
    resTotalEl.textContent = String(total);
    resBestEl.textContent = String(bestNow);

    renderLeaderboard(null);
    configureResultActions();
    openResult();
    audio(won ? 'win' : 'lose');
  }

  /* ---------------- 发题 / 流程 ---------------- */

  function deal() {
    stopTimer();
    clearVsTimers();
    if (fxTimer) { clearTimeout(fxTimer); fxTimer = null; }
    stageEl.classList.remove('bad');
    resultEl.classList.add('hidden');
    keysEl.classList.remove('hidden');

    if (mode === 'daily' && window.Arcade && Arcade.daily) {
      puzzle = makeDailyPuzzle(Arcade.daily.dayStr());
    } else {
      puzzle = makePuzzle(DIFFS[diffIdx]);
    }
    dailyWasSolved = mode === 'daily' && !!window.Arcade && !!Arcade.daily && Arcade.daily.isSolved(GAME_ID);

    tokens = [];
    digitBuf = '';
    usedCards = [false, false, false, false];
    locked = false;
    playerLocked = false;
    roundActive = true;
    submittedThisRound = false;
    roundStartAt = Date.now();

    renderCards();
    renderExpr();
    renderDiff();
    renderModes();
    updateKeyAvailability();
    updateHud();
    updateDailyBar();

    if (mode === 'vs') {
      setMsg(T('gs.game24.vsRoundStart').replace('{r}', String(Math.max(1, vs.round))), 'var(--neon-cyan)');
    } else if (mode === 'daily' && window.Arcade && Arcade.daily && Arcade.daily.isSolved(GAME_ID)) {
      setMsg(T('gs.game24.dailyPracticeMsg'));
    } else {
      setMsg(T('gs.game24.msgStart'));
    }

    startTimer();
    if (mode === 'vs') scheduleAi();
  }

  function nextRound() {
    if (mode === 'vs') { startMatch(); return; }
    resultEl.classList.add('hidden');
    keysEl.classList.remove('hidden');
    deal();
  }

  function restartGame() {
    clearVsTimers();
    stopTimer();
    total = 0;
    streak = 0;
    submittedThisRound = false;
    dailySolveInfo = null;
    resultEl.classList.add('hidden');
    keysEl.classList.remove('hidden');
    if (mode === 'vs') startMatch();
    else deal();
    updateHud();
  }

  function skipRound() {
    if (mode === 'vs') {
      setMsg(T('gs.game24.vsNoSkip'), 'var(--neon-yellow)');
      audio('back');
      return;
    }
    if (!roundActive) return;
    if (mode === 'daily') {
      deal();
      setMsg(T('gs.game24.dailyFixed'), 'var(--neon-yellow)');
      audio('back');
      return;
    }
    stopTimer();
    roundActive = false;
    streak = 0;
    updateHud();
    deal();
    setMsg(T('gs.game24.skipped'), 'var(--neon-yellow)');
    audio('back');
  }

  function submit() {
    if (!roundActive || locked) return;
    if (Date.now() >= deadline) {
      if (mode === 'vs') vsTimeout();
      else endRound('timeout');
      return;
    }
    if (!commitDigitBuf()) return;
    if (!tokens.length) { feedback(T('gs.game24.errEmpty')); return; }
    var used = countUsed();
    if (used < 4) {
      feedback(T('gs.game24.errUnused').replace('{n}', String(4 - used)));
      return;
    }
    var res = evaluateTokens(tokens);
    if (!res.ok) {
      feedback(res.error === 'div0' ? T('gs.game24.errDivZero') : T('gs.game24.errSyntax'));
      return;
    }
    if (Math.abs(res.value - 24) >= EPS) {
      if (mode === 'vs') { vsWrong(res.value); return; }
      endRound('wrong', T('gs.game24.errNot24').replace('{v}', fmt(res.value)));
      return;
    }
    if (mode === 'vs') resolveVs('player');
    else endRound('win');
  }

  function setDiff(i) {
    if (i < 0 || i >= DIFFS.length || i === diffIdx) return;
    diffIdx = i;
    total = 0;
    streak = 0;
    submittedThisRound = false;
    dailySolveInfo = null;
    resultEl.classList.add('hidden');
    keysEl.classList.remove('hidden');
    renderDiff();
    updateKeyAvailability();
    audio('ui');
    if (mode === 'vs') startMatch();
    else deal();
  }

  function setSeries(n) {
    if (n === series) return;
    series = n;
    renderModes();
    audio('ui');
    if (mode === 'vs') startMatch();
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    total = 0;
    streak = 0;
    submittedThisRound = false;
    dailySolveInfo = null;
    resultEl.classList.add('hidden');
    keysEl.classList.remove('hidden');
    renderModes();
    updateKeyAvailability();
    updateDailyBar();
    audio('ui');
    if (mode === 'vs') startMatch();
    else deal();
  }

  /* ---------------- 绑定 ---------------- */

  function handleKey(k) {
    if (!resultEl.classList.contains('hidden')) return;
    if (k === 'back' || k === 'undo') { backspace(); return; }
    if (k === 'hint') { showHint(); return; }
    if (k === 'clear') { clearExpr(); return; }
    if (k === 'skip') { skipRound(); return; }
    if (k === 'submit') { submit(); return; }
    if (k === '(' || k === ')') { insertParen(k); return; }
    if (k === '+') { insertOp('+'); return; }
    if (k === '-') { insertOp('−'); return; }
    if (k === '*') { insertOp('×'); return; }
    if (k === '/') { insertOp('÷'); return; }
    if (/^[0-9]$/.test(k)) { typeDigit(k); }
  }

  keysEl.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-k]') : null;
    if (!btn || !keysEl.contains(btn)) return;
    if (btn.blur) btn.blur();
    handleKey(btn.getAttribute('data-k'));
  });

  nextBtn.addEventListener('click', function () {
    if (nextBtn.blur) nextBtn.blur();
    if (mode === 'vs') startMatch();
    else nextRound();
  });
  restartBtn.addEventListener('click', function () {
    if (restartBtn.blur) restartBtn.blur();
    if (mode === 'vs') startMatch();
    else restartGame();
  });

  document.addEventListener('keydown', function (e) {
    if (document.querySelector('.tut-overlay')) return;
    var t = e.target;
    var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;

    /* 焦点在按钮上时交给原生 Enter/Space 激活，避免与自定义提交双触发 */
    if (tag === 'button' && (k === 'Enter' || k === ' ')) return;

    if (k === 'Enter') {
      e.preventDefault();
      if (!resultEl.classList.contains('hidden')) {
        if (mode === 'vs') startMatch();
        else nextRound();
      } else if (mode !== 'vs' || !vs.resolved) {
        submit();
      }
      return;
    }
    if (k === 'Backspace') { e.preventDefault(); backspace(); return; }
    if (k === 'Escape') {
      e.preventDefault();
      if (resultEl.classList.contains('hidden')) clearExpr();
      return;
    }
    if (k === '(' || k === ')') { e.preventDefault(); insertParen(k); return; }
    if (k === '+' || k === '-' || k === '*' || k === '/' || k === '×' || k === '÷' || k === '−') {
      e.preventDefault();
      insertOp(k === '-' ? '−' : (k === '*' ? '×' : (k === '/' ? '÷' : k)));
      return;
    }
    if (/^[0-9]$/.test(k)) { e.preventDefault(); typeDigit(k); }
  });

  window.GAME_RESTART = restartGame;

  /* 既有 QA 钩子（仅 ?qa=1 暴露），未新增调试入口 */
  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) window.__qa = {
    state: function () {
      return { nums: puzzle ? puzzle.nums.slice() : null,
        solution: puzzle ? puzzle.solution : null,
        tier: puzzle ? puzzle.tier : null,
        total: total, streak: streak, roundActive: roundActive, locked: locked,
        remaining: deadline ? Math.max(0, deadline - Date.now()) : 0,
        submitted: submittedThisRound, mode: mode, diff: DIFFS[diffIdx].key,
        vsPlayer: vs.player, vsAi: vs.ai, vsRound: vs.round };
    },
    solve: function () {
      if (!puzzle || !roundActive) return false;
      var s = puzzle.solution, out = [], used = [false, false, false, false];
      function take(v) {
        for (var k = 0; k < 4; k++) {
          if (!used[k] && puzzle.nums[k] === v) { used[k] = true; return k; }
        }
        return -1;
      }
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (/\d/.test(ch)) {
          var two = s.substr(i, 2);
          var idx = -1;
          if (/^\d\d$/.test(two)) idx = take(parseInt(two, 10));
          if (idx >= 0) { out.push({ type: 'num', v: parseInt(two, 10), card: idx }); i++; }
          else {
            var n1 = parseInt(ch, 10);
            idx = take(n1);
            if (idx < 0) return false;
            out.push({ type: 'num', v: n1, card: idx });
          }
        } else if (ch === '×' || ch === '÷' || ch === '−' || ch === '+' ||
          ch === '*' || ch === '/' || ch === '-') {
          out.push({ type: 'op', v: ch === '*' ? '×' : (ch === '/' ? '÷' : (ch === '-' ? '−' : ch)) });
        } else if (ch === '(' || ch === ')') {
          out.push({ type: 'paren', v: ch });
        }
      }
      tokens = out;
      usedCards = used;
      digitBuf = '';
      renderExpr();
      updateCards();
      submit();
      return true;
    },
    timeout: function () { if (roundActive) deadline = Date.now() - 1; },
    setTotal: function (n) { total = n; updateHud(); },
    puzzle: function (key) {
      var d = DIFFS[key === 'easy' ? 0 : (key === 'master' ? 2 : 1)];
      var p = makePuzzle(d);
      return { nums: p.nums.slice(), solution: p.solution, tier: p.tier };
    },
    presets: function (key) {
      var lib = PRESET_LIB[key] || PRESET_LIB.standard;
      return lib.map(function (p) { return { nums: p.nums.slice(), solution: p.solution, tier: p.tier }; });
    }
  };

  renderDiff();
  renderModes();
  updateKeyAvailability();
  updateHud();
  updateDailyBar();
  deal();
})();
