/* ============================================================
   保龄球 Bowling · 旗舰重制（P2 品类旗舰）
   真实 2D 圆盘动力学（球-瓶 / 瓶-瓶 冲量碰撞 + 摩擦 + 速度衰减 + 旋转），
   固定 60Hz 逻辑步长 + 4 子步保证稳定；击倒数完全由模拟产生。
   完整 10 帧标准计分（Strike/Spare/第 10 帧补球）+ 结算面板。
   控制：按住蓄力（鼠标/触屏/空格）、←→ 角度、↑↓ 旋转、拖拽瞄准。
   视觉：木纹球道 + 油面反光 + 犯规线/箭头 + 渐变球体 + 立体球瓶 + 击倒粒子。
   核心计分/物理用 ==BOWL-CORE-START== / ==BOWL-CORE-END== 标记包裹。
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.bowling.tut1t'), d: T('gs.bowling.tut1') },
  { t: T('gs.bowling.tut2t'), d: T('gs.bowling.tut2') },
  { t: T('gs.bowling.tut3t'), d: T('gs.bowling.tut3') }
];

(function () {
  /* ==BOWL-CORE-START== */
  var BWLCORE = (function () {
    var LANE_HALF = 20;      // 球道半宽（世界单位）
    var LANE_LEN = 120;      // 犯规线到瓶区末端
    var BALL_R = 3.8;
    var PIN_R = 2.2;
    var PIN_BASE_Y = 90;     // 第一排瓶中心
    var PIN_GAP = 9.5;       // 同排瓶距
    var ROW_GAP = 8.66;      // 排间距（三角阵）

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

    /* ---------------- 标准计分（纯函数） ---------------- */
    function flatRolls(frames) {
      var out = [];
      for (var i = 0; i < frames.length; i++) {
        var f = frames[i];
        if (!f) continue;
        for (var j = 0; j < f.length; j++) out.push(f[j]);
      }
      return out;
    }

    function startOf(frames, idx) {
      var n = 0;
      for (var i = 0; i < idx; i++) n += frames[i] ? frames[i].length : 0;
      return n;
    }

    /* 单帧得分；追加投不足时返回 null（尚未确定） */
    function frameScore(frames, idx) {
      var f = frames[idx];
      if (!f || !f.length) return null;
      var rolls = flatRolls(frames), st = startOf(frames, idx);
      if (f[0] === 10) {
        if (rolls.length < st + 3) return null;
        return 10 + rolls[st + 1] + rolls[st + 2];
      }
      if (f.length < 2) return null;
      var sum = f[0] + f[1];
      if (sum === 10) {
        if (rolls.length < st + 3) return null;
        return 10 + rolls[st + 2];
      }
      return sum;
    }

    function scoreGame(frames) {
      var total = 0, complete = true, fs = [];
      for (var i = 0; i < 10; i++) {
        var v = frameScore(frames, i);
        fs.push(v);
        if (v === null) complete = false;
        else total += v;
      }
      return { total: total, frames: fs, complete: complete };
    }

    function runningTotals(frames) {
      var g = scoreGame(frames), out = [], acc = 0;
      for (var i = 0; i < 10; i++) {
        if (g.frames[i] === null || acc === null) { acc = null; out.push(null); }
        else { acc += g.frames[i]; out.push(acc); }
      }
      return out;
    }

    function stats(frames) {
      var strikes = 0, spares = 0;
      for (var i = 0; i < 10; i++) {
        var f = frames[i] || [];
        if (i < 9) {
          if (f[0] === 10) strikes++;
          else if (f.length === 2 && f[0] + f[1] === 10) spares++;
        } else {
          for (var r = 0; r < f.length; r++) if (f[r] === 10) strikes++;
          if (f[0] !== 10 && f.length >= 2 && f[0] + f[1] === 10) spares++;
          else if (f[0] === 10 && f.length >= 3 && f[1] !== 10 && f[1] + f[2] === 10) spares++;
        }
      }
      return { strikes: strikes, spares: spares };
    }

    /* 实际击倒瓶数（不含 Strike/Spare 的追加分），用于锦标赛系列总 pinfall */
    function pinfall(frames) {
      var n = 0;
      for (var i = 0; i < frames.length; i++) {
        var f = frames[i];
        if (!f) continue;
        for (var j = 0; j < f.length; j++) n += f[j];
      }
      return n;
    }

    /* ---------------- 瓶阵 / 物理模拟 ---------------- */
    function pinPositions(gapScale) {
      gapScale = gapScale || 1;
      var gap = PIN_GAP * gapScale, row = ROW_GAP * gapScale, arr = [];
      for (var r = 0; r < 4; r++) {
        for (var c = 0; c <= r; c++) {
          arr.push({ x: (c - r / 2) * gap, y: PIN_BASE_Y + r * row });
        }
      }
      return arr;
    }

    function createRack(gapScale) {
      return pinPositions(gapScale).map(function (p, i) {
        return {
          id: i, x: p.x, y: p.y, bx: p.x, by: p.y,
          vx: 0, vy: 0, r: PIN_R, m: 1.2,
          fall: 0, tilt: 0, down: false, gone: false, fallDir: 1
        };
      });
    }

    /* 圆-圆碰撞：分离 + 冲量，返回冲量大小 */
    function collide(a, b, e) {
      var dx = b.x - a.x, dy = b.y - a.y;
      var rr = a.r + b.r;
      var d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-8) return 0;
      var d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      var ima = 1 / a.m, imb = 1 / b.m, itot = ima + imb;
      var overlap = rr - d;
      a.x -= nx * overlap * (ima / itot); a.y -= ny * overlap * (ima / itot);
      b.x += nx * overlap * (imb / itot); b.y += ny * overlap * (imb / itot);
      var rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rvn > 0) return 0;
      var j = -(1 + e) * rvn / itot;
      a.vx -= j * nx * ima; a.vy -= j * ny * ima;
      b.vx += j * nx * imb; b.vy += j * ny * imb;
      return j;
    }

    function capSpeed(o, max) {
      var sp = Math.hypot(o.vx, o.vy);
      if (sp > max && sp > 0) { o.vx = o.vx / sp * max; o.vy = o.vy / sp * max; }
    }

    function knock(p, ev) {
      if (p.down) return;
      p.down = true;
      p.fall = 1;
      var sp = Math.hypot(p.vx, p.vy);
      p.fallDir = (sp > 0.6 && Math.abs(p.vx) > 0.15) ? (p.vx >= 0 ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1);
      ev.downed.push(p);
    }

    /** 固定步长物理推进；sim = { ball, pins, oil, spin, drift } */
    function stepSim(sim, dt) {
      var ev = { hits: 0, gutter: false, downed: [] };
      var ball = sim.ball, pins = sim.pins, i;

      if (ball && !ball.done) {
        var prog = clamp(ball.y / LANE_LEN, 0, 1);
        if (!ball.gutter) {
          var hook = (sim.spin || 0) * 9 * (1.1 - prog * 0.3) * (sim.hookMul || 1);
          ball.vx += hook * dt;
          if (sim.drift) ball.vx += (Math.random() - 0.5) * sim.drift * 18 * dt;
        }
        var sp = Math.hypot(ball.vx, ball.vy);
        if (sp > 0) {
          var dec = ball.gutter ? 1.2 : ((2.5 + (1 - (sim.oil || 0)) * 4) * (sim.decayMul || 1));
          var nsp = Math.max(0, sp - dec * dt);
          ball.vx = ball.vx / sp * nsp;
          ball.vy = ball.vy / sp * nsp;
        }
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.roll += sp * dt;
        if (!ball.gutter && Math.abs(ball.x) > LANE_HALF - 0.4) {
          ball.gutter = true;
          ev.gutter = true;
          ball.vx = 0;
        }
        if (ball.gutter) ball.x = clamp(ball.x, -LANE_HALF - 2.5, LANE_HALF + 2.5);
        if (ball.y > LANE_LEN + 12 || ball.y < 0) ball.done = true;
        if (ball.y > 8 && Math.abs(ball.vy) < 0.5 && Math.abs(ball.vx) < 0.5) ball.done = true;
      }

      for (i = 0; i < pins.length; i++) {
        var p = pins[i];
        if (p.gone) continue;
        var psp = Math.hypot(p.vx, p.vy);
        if (psp > 0.0001) {
          var pdec = p.down ? 4 : 16;
          var pn = Math.max(0, psp - pdec * dt);
          var k = pn / psp;
          p.vx *= k; p.vy *= k;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        if (p.down) {
          if (p.tilt < 1) p.tilt = Math.min(1, p.tilt + dt * 5.2);
        } else {
          if (p.fall >= 1) knock(p, ev);
          else if (dist2(p.x, p.y, p.bx, p.by) > 49) knock(p, ev);
          if (psp < 0.6) { p.vx = 0; p.vy = 0; }
        }
        if (Math.abs(p.x) > LANE_HALF + 2.5) {
          if (!p.down) knock(p, ev);
          if (Math.abs(p.x) > LANE_HALF + 6) p.gone = true;
        }
      }

      for (var it = 0; it < 2; it++) {
        if (ball && !ball.done && !ball.gutter) {
          for (i = 0; i < pins.length; i++) {
            var bp = pins[i];
            if (bp.gone) continue;
            var jb = collide(ball, bp, 0.55);
            if (jb > 0.05) {
              ev.hits++;
              var dvb = jb / bp.m;
              bp.fall += dvb * 0.022 * (sim.impact || 1);
              if (bp.fall >= 1) knock(bp, ev);
            }
          }
        }
        for (var a = 0; a < pins.length; a++) {
          var pa = pins[a];
          if (pa.gone) continue;
          for (var b = a + 1; b < pins.length; b++) {
            var pb = pins[b];
            if (pb.gone) continue;
            var jp = collide(pa, pb, 0.8);
            if (jp > 0.05) {
              ev.hits++;
              var dvp = jp / 1.2;
              pa.fall += dvp * 0.020;
              pb.fall += dvp * 0.020;
              if (pa.fall >= 1) knock(pa, ev);
              if (pb.fall >= 1) knock(pb, ev);
            }
          }
        }
      }

      if (ball) capSpeed(ball, 62);
      for (i = 0; i < pins.length; i++) capSpeed(pins[i], 45);
      return ev;
    }

    return {
      LANE_HALF: LANE_HALF, LANE_LEN: LANE_LEN, BALL_R: BALL_R, PIN_R: PIN_R,
      PIN_BASE_Y: PIN_BASE_Y, clamp: clamp,
      createRack: createRack, stepSim: stepSim,
      frameScore: frameScore, scoreGame: scoreGame, runningTotals: runningTotals,
      stats: stats, pinfall: pinfall
    };
  })();
  /* ==BOWL-CORE-END== */
  if (typeof window !== 'undefined') window.BWLCORE = BWLCORE;

  var root = document.getElementById('game-root');
  if (!root) return;

  var W = 360, H = 450;
  var CX = W / 2, FOUL_Y = H - 30, DECK_Y = 80;
  var LEN_PX = FOUL_Y - DECK_Y;
  var S_BOT = 8, S_TOP = 4.8;
  var HALF = BWLCORE.LANE_HALF, LEN = BWLCORE.LANE_LEN;
  var BALL_R = BWLCORE.BALL_R;

  /* ---------------- 难度（油量与球种独立选择） ---------------- */
  var DIFFS = {
    easy:   { speed: 1.05, gap: 0.97, spinGain: 1.20, assist: 2, drift: 0 },
    normal: { speed: 1.00, gap: 1.00, spinGain: 1.00, assist: 1, drift: 0.25 },
    hard:   { speed: 0.95, gap: 1.04, spinGain: 0.86, assist: 0, drift: 0.75 }
  };
  var diffKey = 'normal', D = DIFFS[diffKey];

  /* 球种：质量 / 球速 / 旋转增益 / 碰撞冲击，均直接进入物理；配色与指孔进入绘制 */
  var BALLS = {
    b12: {
      id: 'b12', mass: 7.0, speed: 0.93, spin: 0.95, impact: 0.92,
      c1: '#e6fdff', c2: '#54d8ff', c3: '#1463c8', c4: '#031534',
      glow: 'rgba(0,240,255,0.82)', holeR: 0.108, holeGlow: 'rgba(120,245,255,0.55)',
      holes: [[-0.34, -0.20], [0.02, -0.46], [0.34, -0.12]], arc: 0
    },
    b14: {
      id: 'b14', mass: 8.6, speed: 1.00, spin: 1.08, impact: 1.00,
      c1: '#f1e5ff', c2: '#a06cff', c3: '#4d259e', c4: '#140631',
      glow: 'rgba(185,103,255,0.85)', holeR: 0.126, holeGlow: 'rgba(205,160,255,0.55)',
      holes: [[-0.36, -0.27], [0.05, -0.45], [0.31, -0.15]], arc: 0
    },
    b16: {
      id: 'b16', mass: 10.6, speed: 1.05, spin: 1.30, impact: 1.14,
      c1: '#ffe3ee', c2: '#ff5c9e', c3: '#b3123f', c4: '#2a0410',
      glow: 'rgba(255,45,149,0.88)', holeR: 0.146, holeGlow: 'rgba(255,150,195,0.6)',
      holes: [[-0.31, -0.24], [0.09, -0.44], [0.35, -0.13]], arc: 1
    }
  };
  var BALL_ORDER = ['b12', 'b14', 'b16'];
  var ballKey = 'b14', BALL = BALLS[ballKey];

  /* 油道：基础油量 / 破坏速度 / 速度衰减倍率 / 钩球倍率 */
  var OILS = {
    house: { id: 'house', oil: 0.70, wear: 0.40, decay: 1.00, hook: 1.00 },
    long:  { id: 'long',  oil: 0.90, wear: 0.32, decay: 0.72, hook: 0.82 },
    dry:   { id: 'dry',   oil: 0.28, wear: 0.55, decay: 1.28, hook: 1.30 }
  };
  var OIL_ORDER = ['house', 'long', 'dry'];
  var oilKey = 'house', OIL = OILS[oilKey];

  var GAME_MODES = ['single', 'tour'];
  var gameMode = 'single';
  var TOUR_GAMES = 3;
  var CHAMPION_LINE = 540;
  var SERIES_TOP_KEY = 'arcade_bowl_series_top';

  /* ---------------- 页面结构 ---------------- */
  function pickHtml(kind) {
    var order = kind === 'ball' ? BALL_ORDER : OIL_ORDER;
    var cur = kind === 'ball' ? ballKey : oilKey;
    var out = '';
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      var data = kind === 'ball' ? ' data-b="' + id + '"' : ' data-o="' + id + '"';
      out += '<button class="bw-pick' + (id === cur ? ' selected' : '') + '"' + data + '>' +
        '<b>' + T('gs.bowling.' + id) + '</b><small>' + T('gs.bowling.' + id + 'D') + '</small></button>';
    }
    return out;
  }

  var html =
    '<div class="bw-top">' +
    '  <span id="bw-hud"></span>' +
    '  <span class="bw-total-wrap"><span id="bw-total-lab">' + T('gs.bowling.total') + '</span> <b id="bw-total">0</b></span>' +
    '  <span class="bw-best"><span id="bw-best-lab">' + T('gs.bowling.best') + '</span> <b id="bw-best">--</b></span>' +
    '</div>' +
    '<div class="mode-row bw-mode-row" id="bw-modes">' +
    '  <button class="mode-btn selected" data-m="single">' + T('gs.bowling.modeSingle') + '<small>' + T('gs.bowling.modeSingleD') + '</small></button>' +
    '  <button class="mode-btn" data-m="tour">' + T('gs.bowling.modeTour') + '<small>' + T('gs.bowling.modeTourD') + '</small></button>' +
    '</div>' +
    '<div class="bw-status">' +
    '  <span class="bw-chip" id="bw-st-mode">--</span>' +
    '  <span class="bw-chip" id="bw-st-ball">--</span>' +
    '  <span class="bw-chip bw-chip-oil" id="bw-st-oil">--</span>' +
    '</div>' +
    '<div class="bw-pick-row" id="bw-balls">' + pickHtml('ball') + '</div>' +
    '<div class="bw-pick-row" id="bw-oils">' + pickHtml('oil') + '</div>' +
    '<div class="mode-row bw-diff" id="bw-diffs">' +
    '  <button class="mode-btn" data-d="easy">' + T('gs.bowling.dEasy') + '<small>' + T('gs.bowling.dEasyD') + '</small></button>' +
    '  <button class="mode-btn selected" data-d="normal">' + T('gs.bowling.dNormal') + '<small>' + T('gs.bowling.dNormalD') + '</small></button>' +
    '  <button class="mode-btn" data-d="hard">' + T('gs.bowling.dHard') + '<small>' + T('gs.bowling.dHardD') + '</small></button>' +
    '</div>' +
    '<div class="bw-stage" id="bw-stage">' +
    '  <canvas class="bw-canvas" id="bw-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '  <div class="bw-msg" id="bw-msg"></div>' +
    '  <div class="bw-overlay hidden" id="bw-pause">' +
    '    <div class="bw-card">' +
    '      <h2>' + T('gs.bowling.paused') + '</h2>' +
    '      <div class="bw-ov-btns">' +
    '        <button class="btn green" id="bw-resume">' + T('gs.bowling.resume') + '</button>' +
    '        <button class="btn" id="bw-pause-restart">' + T('gs.bowling.restart') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="bw-overlay hidden" id="bw-over">' +
    '    <div class="bw-card bw-card-wide">' +
    '      <h2 id="bw-ov-title">' + T('gs.bowling.result') + '</h2>' +
    '      <div class="bw-final-lab" id="bw-ov-lab">' + T('gs.bowling.finalScore') + '</div>' +
    '      <div class="bw-final" id="bw-ov-score">0</div>' +
    '      <div class="bw-games hidden" id="bw-ov-games"></div>' +
    '      <div class="bw-ov-stats">' +
    '        <span>' + T('gs.bowling.strikes') + ' <b id="bw-ov-strikes">0</b></span>' +
    '        <span>' + T('gs.bowling.spares') + ' <b id="bw-ov-spares">0</b></span>' +
    '        <span>' + T('gs.bowling.pinfall') + ' <b id="bw-ov-pinfall">0</b></span>' +
    '        <span id="bw-ov-best-wrap">' + T('gs.bowling.best') + ' <b id="bw-ov-best">--</b></span>' +
    '      </div>' +
    '      <div class="bw-champion hidden" id="bw-ov-champion"></div>' +
    '      <div class="bw-rank hidden" id="bw-ov-rank"></div>' +
    '      <div class="bw-record hidden" id="bw-ov-record">' + T('gs.bowling.newRecord') + '</div>' +
    '      <div class="bw-note" id="bw-ov-note"></div>' +
    '      <div class="bw-ov-btns">' +
    '        <button class="btn green" id="bw-again">' + T('gs.bowling.again') + '</button>' +
    '        <button class="btn purple" id="bw-change">' + T('gs.bowling.changeDiff') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="bw-overlay hidden" id="bw-between">' +
    '    <div class="bw-card bw-card-wide">' +
    '      <h2 id="bw-between-title"></h2>' +
    '      <div class="bw-final-lab">' + T('gs.bowling.gameScore') + '</div>' +
    '      <div class="bw-final" id="bw-between-score">0</div>' +
    '      <div class="bw-ov-stats">' +
    '        <span>' + T('gs.bowling.seriesTotal') + ' <b id="bw-between-series">0</b></span>' +
    '        <span>' + T('gs.bowling.pinfall') + ' <b id="bw-between-pinfall">0</b></span>' +
    '        <span>' + T('gs.bowling.strikes') + ' <b id="bw-between-strikes">0</b></span>' +
    '        <span>' + T('gs.bowling.spares') + ' <b id="bw-between-spares">0</b></span>' +
    '      </div>' +
    '      <div class="bw-rank" id="bw-between-rank"></div>' +
    '      <div class="bw-lead" id="bw-between-lead"></div>' +
    '      <div class="bw-ov-btns">' +
    '        <button class="btn green" id="bw-next">' + T('gs.bowling.nextGame') + '</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div class="bw-board" id="bw-board"></div>' +
    '<div class="bw-panel">' +
    '  <div class="bw-meter"><div class="bw-meter-fill" id="bw-meter-fill"></div><div class="bw-meter-txt" id="bw-meter-txt">0%</div></div>' +
    '  <div class="bw-aimrow">' +
    '    <div class="bw-group"><span class="bw-lab">' + T('gs.bowling.angle') + '</span>' +
    '      <button class="bw-step" id="bw-angle-l" aria-label="-">−</button>' +
    '      <b class="bw-val" id="bw-angle-v">0</b>' +
    '      <button class="bw-step" id="bw-angle-r" aria-label="+">＋</button></div>' +
    '    <div class="bw-group"><span class="bw-lab">' + T('gs.bowling.curve') + '</span>' +
    '      <button class="bw-step" id="bw-spin-l" aria-label="-">−</button>' +
    '      <b class="bw-val" id="bw-spin-v">0</b>' +
    '      <button class="bw-step" id="bw-spin-r" aria-label="+">＋</button></div>' +
    '  </div>' +
    '  <button class="btn green bw-throw" id="bw-throw">' + T('gs.bowling.hold') + '</button>' +
    '</div>';
  root.innerHTML = html;

  var canvas = document.getElementById('bw-canvas');
  var ctx;
  if (window.GK) {
    ctx = GK.setup(canvas, W, H).ctx;
  } else {
    ctx = canvas.getContext('2d');
    if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  }
  if (!ctx) return;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';

  var stageEl = document.getElementById('bw-stage');
  var hudEl = document.getElementById('bw-hud');
  var totalEl = document.getElementById('bw-total');
  var totalLab = document.getElementById('bw-total-lab');
  var bestEl = document.getElementById('bw-best');
  var bestLab = document.getElementById('bw-best-lab');
  var boardEl = document.getElementById('bw-board');
  var msgEl = document.getElementById('bw-msg');
  var pauseEl = document.getElementById('bw-pause');
  var overEl = document.getElementById('bw-over');
  var betweenEl = document.getElementById('bw-between');
  var ovScore = document.getElementById('bw-ov-score');
  var ovLab = document.getElementById('bw-ov-lab');
  var ovTitle = document.getElementById('bw-ov-title');
  var ovStrikes = document.getElementById('bw-ov-strikes');
  var ovSpares = document.getElementById('bw-ov-spares');
  var ovPinfall = document.getElementById('bw-ov-pinfall');
  var ovBest = document.getElementById('bw-ov-best');
  var ovBestWrap = document.getElementById('bw-ov-best-wrap');
  var ovGames = document.getElementById('bw-ov-games');
  var ovChampion = document.getElementById('bw-ov-champion');
  var ovRank = document.getElementById('bw-ov-rank');
  var ovNote = document.getElementById('bw-ov-note');
  var recordEl = document.getElementById('bw-ov-record');
  var againBtn = document.getElementById('bw-again');
  var changeBtn = document.getElementById('bw-change');
  var throwBtn = document.getElementById('bw-throw');
  var angLbl = document.getElementById('bw-angle-v');
  var spinLbl = document.getElementById('bw-spin-v');
  var meterFill = document.getElementById('bw-meter-fill');
  var meterTxt = document.getElementById('bw-meter-txt');
  var diffRow = document.getElementById('bw-diffs');
  var modeRow = document.getElementById('bw-modes');
  var ballsRow = document.getElementById('bw-balls');
  var oilsRow = document.getElementById('bw-oils');
  var stMode = document.getElementById('bw-st-mode');
  var stBall = document.getElementById('bw-st-ball');
  var stOil = document.getElementById('bw-st-oil');
  var betweenTitle = document.getElementById('bw-between-title');
  var betweenScore = document.getElementById('bw-between-score');
  var betweenSeries = document.getElementById('bw-between-series');
  var betweenPinfall = document.getElementById('bw-between-pinfall');
  var betweenStrikes = document.getElementById('bw-between-strikes');
  var betweenSpares = document.getElementById('bw-between-spares');
  var betweenRank = document.getElementById('bw-between-rank');
  var betweenLead = document.getElementById('bw-between-lead');
  var nextBtn = document.getElementById('bw-next');

  var BEST_KEY = (Arcade.shell && Arcade.shell.gameId) || 'bowling';
  var loopApi = null, paused = false, over = false, submitted = false;
  var frames = [], frameIdx = 0, roll = 1;
  var angleVal = 0, spinVal = 0, powerVal = 0.72;
  var charging = false, chargeStart = 0, dragStart = null, angleStart = 0, dragAim = false;
  var sim = null;
  var world = { pins: BWLCORE.createRack(D.gap), ball: null };
  var phase = 'aim';
  var settleT = 0, throwT = 0, lastHitSound = 0, lastRollSound = 0, lastTrail = 0, lastDownSound = 0;
  var trail = [], particles = [], rings = [], msgTimer = null;
  var flashUntil = 0, flashKind = '';
  var MATCH = { mode: 'single', gameIdx: 0, games: [], pinfall: 0, strikes: 0, spares: 0 };

  var CHARGE_MS = 1050;

  function audio(name) { if (Arcade.audio) Arcade.audio.play(name); }
  function bestValue() {
    try {
      var b = Arcade.storage ? Arcade.storage.getBest(BEST_KEY) : null;
      return (b === null || b === undefined) ? '--' : String(b);
    } catch (e) { return '--'; }
  }

  /* ---------------- 油道 / 系列榜 ---------------- */
  var STAGE_KEYS = { early: 'gs.bowling.oilEarly', mid: 'gs.bowling.oilMid', late: 'gs.bowling.oilLate' };

  function oilState() {
    var prog = BWLCORE.clamp(frameIdx / 9, 0, 1);
    var shots = 0;
    for (var i = 0; i < frames.length; i++) shots += frames[i] ? frames[i].length : 0;
    var wear = OIL.wear + Math.min(0.12, shots * 0.006);
    var val = BWLCORE.clamp(OIL.oil * (1 - wear * prog), 0.05, 0.95);
    var hookMul = BWLCORE.clamp(OIL.hook * (1 + 0.35 * prog + (1 - val / OIL.oil) * 0.5), 0.6, 1.8);
    return {
      prog: prog, val: val, pct: Math.round(val * 100),
      hookMul: hookMul, decayMul: OIL.decay * (1 + 0.15 * prog),
      stage: frameIdx < 3 ? 'early' : (frameIdx < 7 ? 'mid' : 'late')
    };
  }

  function seriesTotal() {
    var n = 0;
    for (var i = 0; i < MATCH.games.length; i++) n += MATCH.games[i].score;
    return n;
  }
  function readSeriesTop() {
    try {
      var arr = JSON.parse(localStorage.getItem(SERIES_TOP_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(Number).filter(function (n) { return isFinite(n) && n > 0; });
    } catch (e) { return []; }
  }
  function seriesRank(total) {
    var top = readSeriesTop(), r = 1;
    for (var i = 0; i < top.length; i++) if (top[i] > total) r++;
    return r;
  }
  function saveSeries(total) {
    if (!(total > 0)) return;
    var top = readSeriesTop();
    top.push(total);
    top.sort(function (a, b) { return b - a; });
    top = top.slice(0, 5);
    try { localStorage.setItem(SERIES_TOP_KEY, JSON.stringify(top)); } catch (e) {}
  }

  /* ---------------- 坐标换算 ---------------- */
  function w2s(x, y) {
    var t = y / LEN;
    var s = S_BOT + (S_TOP - S_BOT) * t;
    return { x: CX + x * s, y: FOUL_Y - t * LEN_PX, s: s, t: t };
  }
  function aimX() {
    return (angleVal / 100) * (HALF - BALL_R - 1.0);
  }

  function rr(x, y, w, h, r) {
    if (window.GK && GK.roundRect) { GK.roundRect(ctx, x, y, w, h, r); return; }
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 局状态 ---------------- */
  function resetRack() {
    world.pins = BWLCORE.createRack(D.gap);
    world.ball = null;
    if (sim) sim.pins = world.pins;
  }
  function stripDowned() {
    world.pins = world.pins.filter(function (p) { return !p.down; });
    world.pins.forEach(function (p) {
      p.vx = 0; p.vy = 0; p.fall = 0; p.tilt = 0;
      p.bx = p.x; p.by = p.y;
    });
    if (sim) sim.pins = world.pins;
  }
  function updateBestHud() {
    bestEl.textContent = bestValue();
    bestLab.textContent = MATCH.mode === 'tour' ? T('gs.bowling.bestSingle') : T('gs.bowling.best');
  }

  function updateStatus() {
    var os = oilState();
    stMode.textContent = MATCH.mode === 'tour'
      ? T('gs.bowling.chipTour').replace('{g}', String(MATCH.gameIdx + 1)).replace('{n}', String(TOUR_GAMES))
      : T('gs.bowling.modeSingle');
    stBall.textContent = T('gs.bowling.' + ballKey);
    stOil.textContent = T('gs.bowling.' + oilKey) + ' · ' + T(STAGE_KEYS[os.stage]) + ' ' + os.pct + '%';
    totalLab.textContent = MATCH.mode === 'tour' ? T('gs.bowling.totalSeries') : T('gs.bowling.total');
  }

  function syncPickers() {
    ballsRow.querySelectorAll('.bw-pick').forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-b') === ballKey);
    });
    oilsRow.querySelectorAll('.bw-pick').forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-o') === oilKey);
    });
    modeRow.querySelectorAll('.mode-btn').forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-m') === MATCH.mode);
    });
  }

  function updateHud() {
    var g = BWLCORE.scoreGame(frames);
    if (MATCH.mode === 'tour') {
      hudEl.innerHTML = T('gs.bowling.hudTour')
        .replace('{g}', String(MATCH.gameIdx + 1))
        .replace('{n}', String(Math.min(10, frameIdx + 1)))
        .replace('{m}', String(roll));
      totalEl.textContent = String(seriesTotal() + (over ? 0 : g.total));
    } else {
      hudEl.innerHTML = T('gs.bowling.hudFrame')
        .replace('{n}', String(Math.min(10, frameIdx + 1)))
        .replace('{m}', String(roll));
      totalEl.textContent = String(g.total);
    }
    updateBestHud();
    updateStatus();
  }

  function rollDisp(f, r) {
    var v = f[r];
    if (v === 10) return 'X';
    if (r > 0 && f[r - 1] !== 10 && f[r - 1] + v === 10) return '/';
    if (v === 0) return '–';
    return String(v);
  }

  function renderBoard() {
    var totals = BWLCORE.runningTotals(frames), out = '';
    for (var i = 0; i < 10; i++) {
      var f = frames[i] || [], disp = '';
      for (var r = 0; r < f.length; r++) disp += '<span>' + rollDisp(f, r) + '</span>';
      var active = (!over && i === frameIdx) ? ' active' : '';
      var tenth = (i === 9) ? ' f10' : '';
      out += '<div class="bw-frame' + active + tenth + '">' +
        '<div class="bw-fn">' + (i + 1) + '</div>' +
        '<div class="bw-fr">' + disp + '</div>' +
        '<div class="bw-ts">' + (totals[i] === null ? '' : totals[i]) + '</div></div>';
    }
    boardEl.innerHTML = out;
  }

  function updateAimUI() {
    angLbl.textContent = (angleVal > 0 ? '+' : '') + Math.round(angleVal);
    spinLbl.textContent = (spinVal > 0 ? '+' : '') + Math.round(spinVal);
    meterFill.style.width = (powerVal * 100).toFixed(1) + '%';
    meterTxt.textContent = Math.round(powerVal * 100) + '%';
    var canThrow = (phase === 'aim' && !over && !paused);
    throwBtn.disabled = !canThrow;
    throwBtn.textContent = charging
      ? T('gs.bowling.charging') + ' ' + Math.round(powerVal * 100) + '%'
      : T('gs.bowling.hold');
  }

  function beginMatch() {
    MATCH = { mode: gameMode, gameIdx: 0, games: [], pinfall: 0, strikes: 0, spares: 0 };
    startGame();
  }

  function startGame() {
    if (msgTimer) { clearTimeout(msgTimer); msgTimer = null; }
    frames = [];
    for (var i = 0; i < 10; i++) frames.push([]);
    frameIdx = 0; roll = 1; over = false; submitted = false; paused = false;
    angleVal = 0; spinVal = 0; powerVal = 0.72; charging = false; phase = 'aim';
    dragAim = false; dragStart = null;
    settleT = 0; throwT = 0; flashUntil = 0;
    trail = []; particles = []; rings = [];
    sim = null;
    world.ball = null;
    resetRack();
    pauseEl.classList.add('hidden');
    overEl.classList.add('hidden');
    betweenEl.classList.add('hidden');
    recordEl.classList.add('hidden');
    msgEl.className = 'bw-msg';
    syncPickers();
    updateHud();
    updateAimUI();
    renderBoard();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  function newGame() { beginMatch(); }

  function showMsg(text, kind) {
    msgEl.textContent = text;
    msgEl.className = 'bw-msg show' + (kind ? ' ' + kind : '');
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(function () {
      msgEl.className = 'bw-msg';
      msgTimer = null;
    }, 1300);
  }

  /* ---------------- 投球 ---------------- */
  function startCharge() {
    if (over || paused || phase !== 'aim' || charging) return;
    charging = true;
    chargeStart = performance.now();
    powerVal = 0.28;
    updateAimUI();
  }

  function cancelCharge() {
    charging = false;
    powerVal = Math.max(powerVal, 0.28);
    updateAimUI();
  }

  function releaseCharge() {
    if (!charging) return;
    charging = false;
    var p = BWLCORE.clamp(powerVal, 0.28, 1);
    throwBall(p);
  }

  function throwBall(power) {
    if (over || paused || phase !== 'aim') return;
    var x0 = aimX();
    var os = oilState();
    var speed = (26 + power * 34) * D.speed * BALL.speed;
    world.ball = {
      x: x0, y: 6, vx: 0, vy: speed, r: BALL_R, m: BALL.mass, ballId: ballKey,
      roll: 0, gutter: false, done: false
    };
    sim = {
      ball: world.ball, pins: world.pins,
      oil: os.val, spin: (spinVal / 100) * D.spinGain * BALL.spin, drift: D.drift,
      hookMul: os.hookMul, decayMul: os.decayMul, impact: BALL.impact
    };
    powerVal = power;
    phase = 'rolling';
    throwT = 0; settleT = 0;
    trail = [];
    lastTrail = 0;
    audio('drop');
    updateAimUI();
  }

  /* ---------------- 结束一次投球 ---------------- */
  function endThrow() {
    if (!sim) return;
    var atStart = world.pins.length, knocked = 0;
    world.pins.forEach(function (p) { if (p.down) knocked++; });

    var isStrike = (knocked === atStart && atStart === 10);
    var isSpare = (!isStrike && knocked === atStart && atStart > 0);
    var isGutter = (knocked === 0);

    frames[frameIdx].push(knocked);

    var action;
    if (frameIdx < 9) {
      if (roll === 1) {
        if (knocked === atStart) { frameIdx++; roll = 1; action = 'reset'; }
        else { roll = 2; action = 'keep'; }
      } else {
        frameIdx++; roll = 1; action = 'reset';
      }
    } else {
      var f10 = frames[9];
      if (f10.length === 1) {
        roll = 2;
        action = (f10[0] === 10) ? 'reset' : 'keep';
      } else if (f10.length === 2) {
        if (f10[0] === 10) {
          /* 首球 Strike 后的补球：第二球再 Strike 才重摆，否则打剩余瓶 */
          roll = 3;
          action = (f10[1] === 10) ? 'reset' : 'keep';
        } else if (f10[0] + f10[1] === 10) { roll = 3; action = 'reset'; }
        else action = 'end';
      } else {
        action = 'end';
      }
    }

    if (action === 'keep') stripDowned();
    else if (action === 'reset') resetRack();
    sim = null;
    world.ball = null;
    phase = 'aim';
    settleT = 0; throwT = 0;
    updateHud();
    renderBoard();

    if (isStrike) throwFeedback('strike');
    else if (isSpare) throwFeedback('spare');
    else if (isGutter) { showMsg(T('gs.bowling.gutter'), 'gutter'); audio('error'); }

    if (action === 'end') { finishGame(); return; }
    updateAimUI();
  }

  function throwFeedback(kind) {
    showMsg(kind === 'strike' ? T('gs.bowling.strike') : T('gs.bowling.spare'), kind);
    if (kind === 'strike') audio('clear'); else audio('coin');
    var c = w2s(0, 100);
    addDebris(c.x, c.y - 6, kind === 'strike' ? 32 : 20,
      kind === 'strike'
        ? ['#ffe600', '#fff6b0', '#ffb300', '#ffffff']
        : ['#00f0ff', '#c8fbff', '#6cbcff', '#ffffff']);
    addRing(c.x, c.y, kind === 'strike' ? 'rgba(255,230,0,0.9)' : 'rgba(0,240,255,0.85)',
      kind === 'strike' ? 150 : 105, kind === 'strike' ? 620 : 460);
    flashKind = kind;
    flashUntil = performance.now() + (kind === 'strike' ? 620 : 460);
    if (Arcade.fx) Arcade.fx.shake(stageEl);
  }

  function gameResult() {
    var g = BWLCORE.scoreGame(frames);
    var st = BWLCORE.stats(frames);
    return { score: g.total, pinfall: BWLCORE.pinfall(frames), strikes: st.strikes, spares: st.spares };
  }

  function finishGame() {
    if (over) return;
    over = true;
    phase = 'over';
    charging = false;
    var res = gameResult();

    if (MATCH.mode === 'tour') {
      MATCH.games.push(res);
      MATCH.pinfall += res.pinfall;
      MATCH.strikes += res.strikes;
      MATCH.spares += res.spares;
      if (MATCH.gameIdx < TOUR_GAMES - 1) showBetween(res);
      else showTourResult();
    } else {
      showSingleResult(res);
    }

    updateHud();
    renderBoard();
    updateAimUI();
    if (Arcade.juice) Arcade.juice.win();
    else audio('win');
  }

  function showSingleResult(res) {
    var isNew = false;
    if (!submitted) {
      submitted = true;
      try {
        if (Arcade.shell && Arcade.shell.submitScore) isNew = !!Arcade.shell.submitScore(res.score);
      } catch (e) {}
    }
    var record = isNew && res.score > 0;
    ovTitle.textContent = T('gs.bowling.result');
    ovLab.textContent = T('gs.bowling.finalScore');
    ovScore.textContent = String(res.score);
    ovStrikes.textContent = String(res.strikes);
    ovSpares.textContent = String(res.spares);
    ovPinfall.textContent = String(res.pinfall);
    ovBest.textContent = bestValue();
    ovBestWrap.classList.remove('hidden');
    ovGames.classList.add('hidden');
    ovChampion.classList.add('hidden');
    ovRank.classList.add('hidden');
    ovNote.textContent = T('gs.bowling.noteSingle');
    recordEl.classList.toggle('hidden', !record);
    againBtn.textContent = T('gs.bowling.again');
    changeBtn.textContent = T('gs.bowling.changeDiff');
    betweenEl.classList.add('hidden');
    overEl.classList.remove('hidden');
  }

  function showBetween(res) {
    var total = seriesTotal();
    var lead = total - CHAMPION_LINE;
    betweenTitle.textContent = T('gs.bowling.betweenTitle').replace('{g}', String(MATCH.gameIdx + 1));
    betweenScore.textContent = String(res.score);
    betweenSeries.textContent = String(total);
    betweenPinfall.textContent = String(MATCH.pinfall);
    betweenStrikes.textContent = String(MATCH.strikes);
    betweenSpares.textContent = String(MATCH.spares);
    betweenRank.textContent = T('gs.bowling.seriesRank').replace('{n}', String(seriesRank(total)));
    betweenLead.textContent = T('gs.bowling.championLine').replace('{n}', String(CHAMPION_LINE)) + ' · ' +
      (lead > 0 ? T('gs.bowling.leadAhead').replace('{n}', String(lead))
        : (lead < 0 ? T('gs.bowling.leadBehind').replace('{n}', String(-lead))
          : T('gs.bowling.leadTie')));
    nextBtn.textContent = T('gs.bowling.nextGame').replace('{n}', String(MATCH.gameIdx + 2));
    overEl.classList.add('hidden');
    betweenEl.classList.remove('hidden');
  }

  function showTourResult() {
    var total = seriesTotal();
    var rank = seriesRank(total);
    var champion = total >= CHAMPION_LINE;
    saveSeries(total);

    ovTitle.textContent = T('gs.bowling.tourResult');
    ovLab.textContent = T('gs.bowling.seriesTotal');
    ovScore.textContent = String(total);
    ovStrikes.textContent = String(MATCH.strikes);
    ovSpares.textContent = String(MATCH.spares);
    ovPinfall.textContent = String(MATCH.pinfall);
    ovBestWrap.classList.add('hidden');
    var gamesHtml = '';
    for (var i = 0; i < MATCH.games.length; i++) {
      gamesHtml += '<div class="bw-game-item"><span>' + T('gs.bowling.gameN').replace('{n}', String(i + 1)) +
        '</span><b>' + MATCH.games[i].score + '</b></div>';
    }
    ovGames.innerHTML = gamesHtml;
    ovGames.classList.remove('hidden');
    ovChampion.textContent = (champion ? T('gs.bowling.championHit') : T('gs.bowling.championMiss')) + ' · ' +
      T('gs.bowling.championLine').replace('{n}', String(CHAMPION_LINE));
    ovChampion.classList.remove('hidden');
    ovRank.textContent = T('gs.bowling.seriesRank').replace('{n}', String(rank));
    ovRank.classList.remove('hidden');
    ovNote.textContent = T('gs.bowling.noteTour');
    recordEl.classList.add('hidden');
    againBtn.textContent = T('gs.bowling.againTour');
    changeBtn.textContent = T('gs.bowling.changeMode');
    betweenEl.classList.add('hidden');
    overEl.classList.remove('hidden');
  }

  function nextTournamentGame() {
    if (MATCH.mode !== 'tour' || MATCH.gameIdx >= TOUR_GAMES - 1 ||
      betweenEl.classList.contains('hidden')) return;
    MATCH.gameIdx++;
    startGame();
    audio('ui');
  }

  /* ---------------- 每帧逻辑 ---------------- */
  function mergeEvents(dst, src) {
    dst.hits += src.hits;
    dst.gutter = dst.gutter || src.gutter;
    for (var i = 0; i < src.downed.length; i++) dst.downed.push(src.downed[i]);
    return dst;
  }

  function handleEvents(ev, now) {
    if (ev.gutter) audio('error');
    if (ev.hits && now - lastHitSound > 100) {
      lastHitSound = now;
      audio('match');
    }
    if (ev.downed.length) {
      for (var i = 0; i < ev.downed.length; i++) {
        var p = ev.downed[i];
        var s = w2s(p.x, p.y);
        addDebris(s.x, s.y - 3, 7);
      }
      if (now - lastDownSound > 140) {
        lastDownSound = now;
        audio('ui');
      }
    }
    if (world.ball && !world.ball.done) {
      var sp = Math.hypot(world.ball.vx, world.ball.vy);
      if (sp > 8 && now - lastRollSound > 280) {
        lastRollSound = now;
        audio('rotate');
      }
    }
  }

  function addDebris(x, y, count, palette) {
    var colors = palette || ['#ffffff', '#ffd9e2', '#e0244a', '#c9d2df'];
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 170;
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
        life: 1, decay: 1.3 + Math.random(), size: 1.4 + Math.random() * 2.8,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function addRing(x, y, color, maxR, dur) {
    rings.push({ x: x, y: y, color: color, maxR: maxR, t0: performance.now(), dur: dur || 500 });
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (var j = trail.length - 1; j >= 0; j--) {
      trail[j].life -= dt * 2.2;
      if (trail[j].life <= 0) trail.splice(j, 1);
    }
  }

  function pinsAtRest() {
    for (var i = 0; i < world.pins.length; i++) {
      var p = world.pins[i];
      if (!p.gone && Math.hypot(p.vx, p.vy) > 2) return false;
    }
    return true;
  }

  function update() {
    if (paused || over) return;
    var now = performance.now();

    if (charging) {
      powerVal = BWLCORE.clamp(0.28 + 0.72 * ((now - chargeStart) / CHARGE_MS), 0.28, 1);
      updateAimUI();
    }

    if (phase === 'rolling' && sim) {
      throwT += 0.016;
      var ev = { hits: 0, gutter: false, downed: [] };
      for (var s = 0; s < 4; s++) mergeEvents(ev, BWLCORE.stepSim(sim, 0.004));
      handleEvents(ev, now);
      if (world.ball && !world.ball.done && now - lastTrail > 45) {
        lastTrail = now;
        var bs = w2s(world.ball.x, world.ball.y);
        trail.push({ x: bs.x, y: bs.y, r: world.ball.r * bs.s, life: 1 });
      }
      if (!world.ball || world.ball.done) {
        world.ball = null; sim.ball = null;
        phase = 'settle'; settleT = 0;
      } else if (throwT > 6.5) {
        world.ball = null; sim.ball = null;
        phase = 'settle'; settleT = 0;
      }
    } else if (phase === 'settle' && sim) {
      var ev2 = { hits: 0, gutter: false, downed: [] };
      for (var s2 = 0; s2 < 4; s2++) mergeEvents(ev2, BWLCORE.stepSim(sim, 0.004));
      handleEvents(ev2, now);
      settleT += 0.016;
      if ((settleT > 0.75 && pinsAtRest()) || settleT > 1.9) endThrow();
    }

    updateParticles(0.016);
  }

  /* ---------------- 绘制 ---------------- */
  function laneQuad(half, y0, y1) {
    var a = w2s(-half, y0), b = w2s(half, y0), c = w2s(half, y1), d = w2s(-half, y1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  function drawBackground() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05060f');
    bg.addColorStop(0.55, '#0a0a16');
    bg.addColorStop(1, '#070510');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var glow = ctx.createRadialGradient(CX, H - 20, 10, CX, H - 20, 240);
    glow.addColorStop(0, 'rgba(80,140,255,0.16)');
    glow.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, H - 260, W, 260);
  }

  function gutterQuad(x0, x1) {
    var a = w2s(x0, -8), b = w2s(x1, -8), c = w2s(x1, LEN), d = w2s(x0, LEN);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  function drawGutters() {
    var gg = ctx.createLinearGradient(0, FOUL_Y, 0, DECK_Y);
    gg.addColorStop(0, '#171227');
    gg.addColorStop(1, '#07060d');
    ctx.fillStyle = gg;
    gutterQuad(-HALF - 9, -HALF); ctx.fill();
    gutterQuad(HALF, HALF + 9); ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w2s(-HALF, -8).x, w2s(-HALF, -8).y);
    ctx.lineTo(w2s(-HALF, LEN).x, w2s(-HALF, LEN).y);
    ctx.moveTo(w2s(HALF, -8).x, w2s(HALF, -8).y);
    ctx.lineTo(w2s(HALF, LEN).x, w2s(HALF, LEN).y);
    ctx.stroke();
  }

  function drawLane(now) {
    drawGutters();

    // 球道木纹底色
    ctx.save();
    laneQuad(HALF, -8, LEN);
    var lg = ctx.createLinearGradient(0, FOUL_Y, 0, DECK_Y);
    lg.addColorStop(0, '#8a5c2c');
    lg.addColorStop(0.3, '#6d4520');
    lg.addColorStop(0.7, '#57361a');
    lg.addColorStop(1, '#3b2513');
    ctx.fillStyle = lg;
    ctx.fill();

    // 木板缝 + 纹理
    ctx.clip();
    var boards = 16;
    for (var i = 1; i < boards; i++) {
      var bx = -HALF + (2 * HALF / boards) * i;
      var p1 = w2s(bx, -8), p2 = w2s(bx, LEN);
      ctx.strokeStyle = 'rgba(18,10,3,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,160,0.05)';
      ctx.beginPath(); ctx.moveTo(p1.x + 1, p1.y); ctx.lineTo(p2.x + 1, p2.y); ctx.stroke();
    }
    // 纵向木纹高光
    for (var g = 0; g < 9; g++) {
      var gx = -HALF + (g * 4.6) + 1.2;
      var q1 = w2s(gx, -8), q2 = w2s(gx + 0.4, LEN);
      ctx.strokeStyle = 'rgba(255,200,130,0.055)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
    }

    // 油面反光（随当前油量与破坏阶段变化、缓慢流动）
    var os = oilState();
    var ox = Math.sin(now / 900) * 6;
    var og = ctx.createLinearGradient(CX - 130 + ox, 0, CX + 130 + ox, 0);
    var oilA = 0.018 + os.val * 0.115;
    og.addColorStop(0, 'rgba(150,220,255,0)');
    og.addColorStop(0.45, 'rgba(170,232,255,' + oilA.toFixed(3) + ')');
    og.addColorStop(0.62, 'rgba(210,245,255,' + (oilA * 1.35).toFixed(3) + ')');
    og.addColorStop(1, 'rgba(150,220,255,0)');
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, W, H);

    // 油面破坏：越到后段，球道中后段的干涩划痕越明显
    if (os.prog > 0.15) {
      var wearA = (os.prog - 0.15) * 0.16;
      for (var w = 0; w < 7; w++) {
        var wx = -HALF + 3.6 + w * 5.7;
        var wy0 = 34 + (w % 3) * 9;
        var wq1 = w2s(wx, wy0), wq2 = w2s(wx + 0.8, LEN - 6);
        ctx.strokeStyle = 'rgba(24,12,5,' + wearA.toFixed(3) + ')';
        ctx.lineWidth = w < 3 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(wq1.x, wq1.y); ctx.lineTo(wq2.x, wq2.y); ctx.stroke();
      }
    }

    // 后段油面渐亮（油多时更亮，油被破坏后减弱）
    var og2 = ctx.createLinearGradient(0, FOUL_Y - 40, 0, DECK_Y + 70);
    og2.addColorStop(0, 'rgba(255,245,210,0)');
    og2.addColorStop(1, 'rgba(255,240,190,' + (0.03 + os.val * 0.12).toFixed(3) + ')');
    ctx.fillStyle = og2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 犯规线
    var fl = w2s(0, 0);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,240,190,0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,230,150,0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(w2s(-HALF, 0).x, fl.y);
    ctx.lineTo(w2s(HALF, 0).x, fl.y);
    ctx.stroke();
    ctx.restore();

    // 犯规线前的引导点
    ctx.fillStyle = 'rgba(255,240,200,0.5)';
    for (var d = -3; d <= 3; d++) {
      var dp = w2s(d * 4.5, 9);
      ctx.beginPath(); ctx.arc(dp.x, dp.y, dp.s * 0.55, 0, Math.PI * 2); ctx.fill();
    }

    // 箭头（7 个）
    ctx.fillStyle = 'rgba(255,220,130,0.42)';
    for (var ar = -3; ar <= 3; ar++) {
      var ap = w2s(ar * 4.6, 17);
      var aw = ap.s * 1.15;
      ctx.beginPath();
      ctx.moveTo(ap.x, ap.y - aw);
      ctx.lineTo(ap.x - aw * 0.62, ap.y + aw * 0.38);
      ctx.lineTo(ap.x + aw * 0.62, ap.y + aw * 0.38);
      ctx.closePath();
      ctx.fill();
    }

    // 边线霓虹
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w2s(-HALF, -8).x, w2s(-HALF, -8).y);
    ctx.lineTo(w2s(-HALF, LEN).x, w2s(-HALF, LEN).y);
    ctx.moveTo(w2s(HALF, -8).x, w2s(HALF, -8).y);
    ctx.lineTo(w2s(HALF, LEN).x, w2s(HALF, LEN).y);
    ctx.stroke();
    ctx.restore();
  }

  function drawDeck(now) {
    ctx.save();
    laneQuad(HALF, 82, LEN);
    ctx.fillStyle = 'rgba(255,228,170,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,180,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w2s(-HALF, 82).x, w2s(-HALF, 82).y);
    ctx.lineTo(w2s(HALF, 82).x, w2s(HALF, 82).y);
    ctx.stroke();
    ctx.restore();

    // 瓶区灯光（叠加发光）
    var pulse = 0.75 + Math.sin(now / 420) * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var sg = ctx.createRadialGradient(CX, 78, 6, CX, 78, 200);
    sg.addColorStop(0, 'rgba(255,240,180,' + (0.20 * pulse).toFixed(3) + ')');
    sg.addColorStop(0.45, 'rgba(255,210,110,0.07)');
    sg.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, 320);
    ctx.restore();
  }

  function pinPath(w, h) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0);
    ctx.quadraticCurveTo(-w * 0.56, -h * 0.30, -w * 0.20, -h * 0.56);
    ctx.quadraticCurveTo(-w * 0.12, -h * 0.72, -w * 0.27, -h * 0.82);
    ctx.quadraticCurveTo(-w * 0.09, -h * 1.00, 0, -h * 1.00);
    ctx.quadraticCurveTo(w * 0.09, -h * 1.00, w * 0.27, -h * 0.82);
    ctx.quadraticCurveTo(w * 0.12, -h * 0.72, w * 0.20, -h * 0.56);
    ctx.quadraticCurveTo(w * 0.56, -h * 0.30, w * 0.5, 0);
    ctx.quadraticCurveTo(0, h * 0.09, -w * 0.5, 0);
    ctx.closePath();
  }

  function drawPin(p) {
    if (p.gone) return;
    var s = w2s(p.x, p.y);
    var w = p.r * 2 * s.s;
    var h = w * 2.5;
    var tilt = 0;
    if (p.down) tilt = p.fallDir * Math.min(1, p.tilt) * 1.28;
    var alpha = (Math.abs(p.x) > HALF) ? 0.72 : 1;

    // 地面阴影（不随倾倒旋转）
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(s.x + tilt * h * 0.35, s.y + 2, w * 0.78, w * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x, s.y);
    ctx.rotate(tilt);

    var pg = ctx.createLinearGradient(-w * 0.55, 0, w * 0.55, 0);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(0.32, '#f4f6fb');
    pg.addColorStop(0.72, '#ccd5e2');
    pg.addColorStop(1, '#98a4b7');
    ctx.fillStyle = pg;
    pinPath(w, h);
    ctx.fill();

    // 红颈环（裁剪在瓶身内）
    ctx.save();
    pinPath(w, h);
    ctx.clip();
    ctx.strokeStyle = '#e0244a';
    ctx.lineWidth = Math.max(1, w * 0.11);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.615, w * 0.22, w * 0.075, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.68, w * 0.195, w * 0.065, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 左侧高光
    var hg = ctx.createLinearGradient(-w * 0.45, 0, -w * 0.05, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0.55)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(-w * 0.46, -h * 0.9, w * 0.34, h * 0.82);
    ctx.restore();

    ctx.strokeStyle = 'rgba(40,50,70,0.28)';
    ctx.lineWidth = 1;
    pinPath(w, h);
    ctx.stroke();

    // 瓶头高光
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.06, -h * 0.885, w * 0.1, w * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPins(now) {
    var list = world.pins.slice().sort(function (a, b) { return b.y - a.y; });
    for (var i = 0; i < list.length; i++) drawPin(list[i]);
  }

  function drawTrail() {
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, t.life) * 0.35;
      var tg = ctx.createRadialGradient(t.x, t.y, 1, t.x, t.y, t.r);
      tg.addColorStop(0, 'rgba(120,220,255,0.9)');
      tg.addColorStop(1, 'rgba(80,120,255,0)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (1.2 - t.life * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBallBody(x, y, r, roll, B, idle) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = B.glow;
    ctx.shadowBlur = idle ? 26 : 18;
    var rg = ctx.createRadialGradient(x - r * 0.34, y - r * 0.4, r * 0.15, x, y, r * 1.05);
    rg.addColorStop(0, B.c1);
    rg.addColorStop(0.22, B.c2);
    rg.addColorStop(0.6, B.c3);
    rg.addColorStop(1, B.c4);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = B.glow;
    ctx.lineWidth = idle ? 2 : 1.4;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll * 0.5);
    // 指孔样式随球种变化（数量/孔径/发光）
    for (var i = 0; i < B.holes.length; i++) {
      ctx.fillStyle = 'rgba(3,6,20,0.94)';
      ctx.beginPath();
      ctx.arc(B.holes[i][0] * r, B.holes[i][1] * r, r * B.holeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = B.holeGlow;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    if (B.arc) {
      // 重球内置配重弧线
      ctx.strokeStyle = 'rgba(255,190,220,0.45)';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, -2.5, -1.1);
      ctx.stroke();
    }
    ctx.strokeStyle = B.holeGlow;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.66, 0.2, 2.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.66, Math.PI + 0.3, Math.PI + 1.9);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // 镜面高光
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.34, y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    var b = world.ball;
    if (b) {
      var s = w2s(b.x, b.y);
      drawBallBody(s.x, s.y, b.r * s.s, b.roll, BALLS[b.ballId] || BALL, false);
    } else if (phase === 'aim' && !over && !paused) {
      var st = w2s(aimX(), 6);
      drawBallBody(st.x, st.y, BALL_R * st.s, 0, BALL, true);
    }
  }

  function drawRings(now) {
    for (var i = rings.length - 1; i >= 0; i--) {
      var ring = rings[i];
      var t = (now - ring.t0) / ring.dur;
      if (t >= 1) { rings.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.maxR * (0.18 + t * 0.85), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlash(now) {
    if (now >= flashUntil) return;
    var t = (flashUntil - now) / (flashKind === 'strike' ? 620 : 460);
    var col = flashKind === 'strike' ? '255,230,0' : '0,240,255';
    var fg = ctx.createRadialGradient(CX, DECK_Y + 40, 8, CX, DECK_Y + 40, 260);
    fg.addColorStop(0, 'rgba(' + col + ',' + (0.28 * t).toFixed(3) + ')');
    fg.addColorStop(1, 'rgba(' + col + ',0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawGuide() {
    if (phase !== 'aim' || D.assist <= 0) return;
    var power = charging ? powerVal : Math.max(powerVal, 0.72);
    var os = oilState();
    var speed = (26 + power * 34) * D.speed * BALL.speed;
    var hook = (spinVal / 100) * D.spinGain * BALL.spin * 9 * 1.1 * os.hookMul;
    var x0 = aimX();
    var maxY = (D.assist === 2) ? 104 : 64;

    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,0.30)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -(performance.now() / 60) % 12;
    ctx.beginPath();
    var started = false;
    for (var t = 0; t < 3.2; t += 0.05) {
      var y = 6 + speed * t;
      if (y > maxY) break;
      var x = x0 + 0.5 * hook * t * t;
      var sp = w2s(x, y);
      if (!started) { ctx.moveTo(sp.x, sp.y); started = true; }
      else ctx.lineTo(sp.x, sp.y);
    }
    ctx.stroke();
    ctx.restore();

    // 出球点幽灵球
    var st = w2s(x0, 6);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.s * BALL_R * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPowerBar() {
    if (!charging) return;
    var bw = 8, bh = 190, bx = W - 20, by = H - 300;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(bx, by, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    var fh = bh * powerVal;
    if (fh > 4) {
      var pg = ctx.createLinearGradient(0, by + bh, 0, by);
      pg.addColorStop(0, '#39ff14');
      pg.addColorStop(0.55, '#ffe600');
      pg.addColorStop(1, '#ff2d95');
      ctx.fillStyle = pg;
      rr(bx + 1.5, by + bh - fh + 1.5, bw - 3, Math.max(0, fh - 3), 3);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    for (var k = 1; k < 5; k++) {
      var ty = by + bh - (bh / 5) * k;
      ctx.beginPath(); ctx.moveTo(bx - 2, ty); ctx.lineTo(bx + bw + 2, ty); ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    var now = performance.now();
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawLane(now);
    drawDeck(now);
    drawGuide();
    drawPins(now);
    drawTrail();
    drawBall();
    drawRings(now);
    drawParticles();
    drawPowerBar();
    drawFlash(now);
  }

  /* ---------------- 输入 ---------------- */
  function canvasPos(ev) {
    if (window.GK && GK.pointer) return GK.pointer(canvas, ev);
    var r = canvas.getBoundingClientRect();
    var t = (ev.touches && ev.touches[0]) || ev;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }

  canvas.addEventListener('pointerdown', function (ev) {
    if (over || paused || phase !== 'aim') return;
    ev.preventDefault();
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    dragStart = canvasPos(ev);
    angleStart = angleVal;
    dragAim = true;
    startCharge();
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!charging || !dragAim || !dragStart) return;
    ev.preventDefault();
    var p = canvasPos(ev);
    angleVal = BWLCORE.clamp(angleStart + (p.x - dragStart.x) / 2.6, -100, 100);
    updateAimUI();
  });
  canvas.addEventListener('pointerup', function (ev) {
    if (!dragAim) return;
    dragAim = false;
    ev.preventDefault();
    releaseCharge();
  });
  canvas.addEventListener('pointercancel', function () {
    dragAim = false;
    cancelCharge();
  });

  throwBtn.addEventListener('pointerdown', function (ev) {
    if (over || paused || phase !== 'aim') return;
    ev.preventDefault();
    startCharge();
  });
  throwBtn.addEventListener('pointerup', function (ev) {
    ev.preventDefault();
    releaseCharge();
  });
  throwBtn.addEventListener('pointercancel', function () { cancelCharge(); });
  throwBtn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  document.addEventListener('pointerup', function () {
    if (charging) { dragAim = false; releaseCharge(); }
  });

  function stepAngle(d) {
    if (over || paused || phase !== 'aim') return;
    angleVal = BWLCORE.clamp(angleVal + d, -100, 100);
    updateAimUI();
    audio('rotate');
  }
  function stepSpin(d) {
    if (over || paused || phase !== 'aim') return;
    spinVal = BWLCORE.clamp(spinVal + d, -100, 100);
    updateAimUI();
    audio('rotate');
  }
  document.getElementById('bw-angle-l').addEventListener('click', function () { stepAngle(-5); });
  document.getElementById('bw-angle-r').addEventListener('click', function () { stepAngle(5); });
  document.getElementById('bw-spin-l').addEventListener('click', function () { stepSpin(-5); });
  document.getElementById('bw-spin-r').addEventListener('click', function () { stepSpin(5); });

  function selectBall(id) {
    if (!BALLS[id]) return;
    ballKey = id;
    BALL = BALLS[id];
    syncPickers();
    updateStatus();
    updateAimUI();
    audio('ui');
  }
  function selectOil(id) {
    if (!OILS[id]) return;
    oilKey = id;
    OIL = OILS[id];
    syncPickers();
    updateStatus();
    updateAimUI();
    audio('ui');
  }
  function selectMode(m) {
    if (GAME_MODES.indexOf(m) < 0) return;
    gameMode = m;
    if (MATCH.mode === m) { syncPickers(); return; }
    newGame();
    audio('ui');
  }

  document.addEventListener('keydown', function (ev) {
    var k = ev.key;
    if (k === 'p' || k === 'P') {
      ev.preventDefault();
      togglePause();
      return;
    }
    if (over || paused) return;
    if (phase === 'aim' && k >= '1' && k <= '3') {
      ev.preventDefault();
      selectBall(BALL_ORDER[Number(k) - 1]);
      return;
    }
    if (phase === 'aim' && k >= '4' && k <= '6') {
      ev.preventDefault();
      selectOil(OIL_ORDER[Number(k) - 4]);
      return;
    }
    if (k === 'ArrowLeft') { ev.preventDefault(); stepAngle(-4); return; }
    if (k === 'ArrowRight') { ev.preventDefault(); stepAngle(4); return; }
    if (k === 'ArrowUp') { ev.preventDefault(); stepSpin(4); return; }
    if (k === 'ArrowDown') { ev.preventDefault(); stepSpin(-4); return; }
    if (k === ' ' || k === 'Spacebar') {
      ev.preventDefault();
      if (!ev.repeat) startCharge();
    }
  });
  document.addEventListener('keyup', function (ev) {
    if (ev.key === ' ' || ev.key === 'Spacebar') {
      if (charging) { ev.preventDefault(); releaseCharge(); }
    }
  });
  window.addEventListener('blur', function () { if (charging) cancelCharge(); });

  /* ---------------- 暂停 / 结算 / 难度 ---------------- */
  function togglePause() {
    if (over) return;
    paused = !paused;
    if (paused) {
      charging = false;
      if (loopApi) loopApi.pause();
      pauseEl.classList.remove('hidden');
    } else {
      if (loopApi) loopApi.resume();
      pauseEl.classList.add('hidden');
    }
    updateAimUI();
    audio('ui');
  }
  document.getElementById('bw-resume').addEventListener('click', function () {
    if (paused) togglePause();
  });
  document.getElementById('bw-pause-restart').addEventListener('click', function () {
    newGame();
    audio('ui');
  });
  againBtn.addEventListener('click', function () {
    newGame();
    audio('ui');
  });
  changeBtn.addEventListener('click', function () {
    var target = MATCH.mode === 'tour' ? modeRow : diffRow;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    audio('ui');
  });
  nextBtn.addEventListener('click', function () { nextTournamentGame(); });

  modeRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () { selectMode(b.getAttribute('data-m')); });
  });
  ballsRow.querySelectorAll('.bw-pick').forEach(function (b) {
    b.addEventListener('click', function () { selectBall(b.getAttribute('data-b')); });
  });
  oilsRow.querySelectorAll('.bw-pick').forEach(function (b) {
    b.addEventListener('click', function () { selectOil(b.getAttribute('data-o')); });
  });

  diffRow.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      diffRow.querySelectorAll('.mode-btn').forEach(function (x) { x.classList.remove('selected'); });
      b.classList.add('selected');
      diffKey = b.getAttribute('data-d');
      D = DIFFS[diffKey] || DIFFS.normal;
      newGame();
      audio('ui');
    });
  });

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.bowling.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    D = DIFFS[diffKey] || DIFFS.normal;
    newGame();
  };

  newGame();
  loopApi = Arcade.loop.start(update, draw, 16);
})();
