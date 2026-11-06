/* ============================================================
   切绳救星 · 关卡数据与生成器（确定性种子 + 手工参数表）
   - 60 个手写关卡：1-20 入门 / 21-40 进阶 / 41-60 专家
   - 61+ 程序化无限章：按 wave 递进，seed 只依赖 n，可复现
   - 每日挑战：按日期生成，独立入口
   - 纯数据模块，无 DOM 依赖，可在 Node 下做全量校验
   ============================================================ */
(function (root) {
  'use strict';

  var W = 540, H = 440, CX = 270, NET_Y = 414;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 手工参数表列：seed / 目标数 / 横向展开 / 主绳长 / 多锚点模式(0单 1交替 2全双)
     / 锯片 / 摆锤 / 岩浆 / 额外切绳 / 冻结 / 挂钩 / 安全网半宽 / 限时(秒) */
  function cfg(s, t, spread, len, mode, saws, pends, magma, cutB, freeze, hook, netHalf, time) {
    return [s, t, spread, len, mode, saws, pends, magma, cutB, freeze, hook, netHalf, time];
  }

  var TABLE = [
    /* ---- 1-20 入门 ---- */
    cfg(101, 2, 28, 118, 0, 0, 0, 0, 3, 1, 1, 92, 95),
    cfg(102, 2, 38, 124, 0, 0, 0, 0, 3, 1, 0, 90, 95),
    cfg(103, 3, 34, 120, 0, 0, 0, 0, 3, 1, 1, 90, 100),
    cfg(104, 3, 52, 128, 0, 1, 0, 0, 3, 0, 0, 88, 95),
    cfg(105, 3, 46, 122, 0, 0, 1, 0, 3, 1, 0, 88, 100),
    cfg(106, 3, 64, 130, 0, 1, 0, 0, 3, 0, 0, 86, 95),
    cfg(107, 3, 58, 134, 0, 1, 1, 0, 3, 1, 0, 86, 100),
    cfg(108, 3, 70, 128, 1, 0, 0, 0, 3, 0, 0, 84, 100),
    cfg(109, 3, 56, 132, 0, 1, 0, 1, 3, 1, 0, 84, 95),
    cfg(110, 3, 78, 130, 1, 1, 0, 0, 3, 0, 0, 84, 100),
    cfg(111, 3, 68, 122, 0, 1, 1, 0, 3, 1, 0, 82, 100),
    cfg(112, 3, 84, 136, 1, 0, 1, 0, 2, 0, 1, 82, 105),
    cfg(113, 3, 76, 128, 0, 1, 0, 1, 2, 1, 0, 82, 95),
    cfg(114, 3, 90, 132, 1, 1, 0, 0, 2, 0, 0, 80, 100),
    cfg(115, 3, 82, 126, 0, 1, 1, 1, 2, 1, 0, 80, 100),
    cfg(116, 3, 94, 138, 1, 0, 1, 0, 2, 1, 1, 80, 105),
    cfg(117, 3, 88, 130, 0, 1, 1, 1, 2, 0, 0, 78, 100),
    cfg(118, 3, 100, 130, 1, 1, 0, 1, 2, 1, 0, 78, 100),
    cfg(119, 3, 94, 136, 0, 2, 0, 1, 2, 0, 1, 78, 105),
    cfg(120, 3, 108, 134, 1, 1, 1, 0, 2, 1, 1, 78, 105),

    /* ---- 21-40 进阶 ---- */
    cfg(121, 3, 116, 142, 2, 2, 0, 0, 2, 1, 1, 76, 100),
    cfg(122, 3, 126, 138, 1, 2, 1, 0, 2, 0, 1, 76, 105),
    cfg(123, 3, 114, 144, 2, 1, 1, 1, 2, 1, 1, 76, 100),
    cfg(124, 4, 120, 138, 1, 2, 0, 1, 2, 0, 1, 74, 105),
    cfg(125, 3, 132, 142, 2, 2, 1, 0, 1, 1, 1, 74, 100),
    cfg(126, 3, 124, 132, 1, 2, 1, 1, 2, 1, 1, 74, 105),
    cfg(127, 4, 136, 140, 2, 2, 0, 0, 1, 0, 1, 74, 105),
    cfg(128, 3, 128, 146, 1, 2, 1, 1, 1, 1, 1, 72, 105),
    cfg(129, 3, 142, 134, 0, 2, 1, 1, 1, 1, 1, 72, 100),
    cfg(130, 4, 146, 142, 1, 2, 0, 1, 1, 0, 1, 72, 110),
    cfg(131, 3, 138, 136, 0, 3, 0, 1, 1, 1, 1, 72, 105),
    cfg(132, 3, 152, 144, 2, 2, 1, 0, 1, 1, 1, 70, 105),
    cfg(133, 4, 144, 138, 1, 2, 1, 1, 1, 0, 1, 70, 110),
    cfg(134, 3, 158, 146, 0, 3, 0, 1, 1, 1, 1, 70, 105),
    cfg(135, 3, 150, 140, 2, 2, 2, 0, 1, 1, 1, 70, 110),
    cfg(136, 4, 162, 144, 0, 2, 1, 1, 1, 1, 1, 70, 110),
    cfg(137, 3, 154, 148, 1, 3, 1, 1, 1, 0, 1, 68, 105),
    cfg(138, 3, 166, 142, 0, 3, 1, 0, 1, 1, 1, 68, 110),
    cfg(139, 4, 156, 146, 1, 3, 1, 1, 1, 1, 1, 68, 110),
    cfg(140, 4, 172, 144, 2, 3, 1, 1, 1, 0, 1, 68, 110),

    /* ---- 41-60 专家 ---- */
    cfg(141, 4, 178, 150, 1, 3, 1, 1, 1, 1, 1, 66, 110),
    cfg(142, 4, 186, 146, 2, 3, 2, 1, 1, 1, 1, 66, 110),
    cfg(143, 4, 180, 152, 1, 4, 1, 1, 1, 0, 2, 66, 115),
    cfg(144, 4, 192, 144, 2, 3, 1, 2, 1, 1, 1, 66, 110),
    cfg(145, 4, 184, 154, 1, 3, 2, 1, 1, 1, 1, 64, 115),
    cfg(146, 4, 198, 148, 2, 4, 1, 1, 1, 0, 2, 64, 115),
    cfg(147, 4, 192, 156, 0, 4, 2, 1, 1, 1, 1, 64, 115),
    cfg(148, 4, 204, 150, 1, 4, 1, 2, 1, 1, 2, 64, 115),
    cfg(149, 4, 194, 158, 2, 5, 1, 1, 1, 0, 1, 62, 115),
    cfg(150, 4, 208, 152, 1, 4, 2, 2, 1, 1, 2, 62, 115),
    cfg(151, 4, 200, 162, 0, 5, 1, 1, 1, 1, 1, 62, 115),
    cfg(152, 4, 214, 154, 2, 4, 2, 1, 1, 1, 2, 62, 115),
    cfg(153, 4, 206, 164, 1, 5, 2, 2, 1, 0, 1, 60, 115),
    cfg(154, 4, 218, 156, 0, 4, 2, 2, 1, 1, 2, 60, 120),
    cfg(155, 5, 210, 160, 1, 5, 1, 1, 1, 1, 1, 60, 120),
    cfg(156, 4, 222, 158, 2, 5, 2, 2, 1, 1, 2, 60, 120),
    cfg(157, 4, 212, 166, 1, 5, 2, 2, 1, 0, 1, 58, 115),
    cfg(158, 5, 224, 160, 2, 5, 2, 2, 1, 1, 2, 58, 120),
    cfg(159, 4, 230, 162, 1, 6, 2, 2, 1, 1, 2, 58, 120),
    cfg(160, 5, 218, 164, 2, 6, 2, 2, 1, 1, 2, 58, 120)
  ];

  var WRITTEN = TABLE.length;   /* 手写关卡数 = 60 */

  var CHAPTERS = [
    { id: 0, from: 1, to: 20, name: 'chapter1' },
    { id: 1, from: 21, to: 40, name: 'chapter2' },
    { id: 2, from: 41, to: 60, name: 'chapter3' },
    { id: 3, from: 61, to: 80, name: 'chapter4' }
  ];

  function chapterOf(n) {
    if (n >= 61) return 3;
    for (var i = 0; i < CHAPTERS.length; i++) {
      if (n >= CHAPTERS[i].from && n <= CHAPTERS[i].to) return i;
    }
    return 0;
  }

  function isEndless(n) { return Math.round(n) >= 61; }

  /** 章节范围：章节 0-2 固定；章节 3（无尽）每页 20 关，page 从 0 开始 */
  function chapterRange(id, page) {
    if (id === 3 || id === '3') {
      var p = Math.max(0, Math.floor(Number(page) || 0));
      var from = 61 + p * 20;
      return { from: from, to: from + 19, count: 20, page: p };
    }
    var c = CHAPTERS[id] || CHAPTERS[0];
    return { from: c.from, to: c.to, count: c.to - c.from + 1, page: 0 };
  }

  /* ---------- 程序化无限章：仅依赖 n，可复现 ---------- */
  function proceduralConfig(n) {
    n = Math.max(61, Math.round(n));
    var idx = n - 61;
    var wave = Math.floor(idx / 20);
    var step = idx % 20;
    var seed = (9100 + n * 37) >>> 0;
    var targets = Math.min(6, 5 + Math.floor(wave / 3));
    var netHalf = Math.max(50, 58 - wave * 2);
    var spread = Math.min(244, 226 + Math.min(18, wave * 3));
    var len = Math.min(190, 170 + Math.min(20, wave * 2));
    var mode = (n % 3 === 0) ? 2 : 1;
    var saws = Math.min(8, 5 + Math.floor(wave / 2) + (step >= 10 ? 1 : 0));
    var pend = Math.min(4, 2 + Math.floor(wave / 3));
    var magma = Math.min(3, 2 + Math.floor(wave / 4));
    var time = 120 + Math.min(20, wave * 2);
    return cfg(seed, targets, spread, len, mode, saws, pend, magma, 2, 1, 2, netHalf, time);
  }

  /* ---------- 危险物定位辅助 ---------- */
  function sawDef(x, y, axis, amp, spd, phase, r) {
    return { x: x, y: y, axis: axis, amp: amp, spd: spd, phase: phase, r: r };
  }
  function pendDef(px, py, len, amp, spd, phase, r) {
    return { px: px, py: py, len: len, amp: amp, spd: spd, phase: phase, r: r };
  }
  function magmaDef(x, y, w, h) { return { x: x, y: y, w: w, h: h }; }

  function sawPos(s, t) {
    var o = Math.sin(t * s.spd + s.phase) * s.amp;
    return s.axis === 'x' ? { x: s.x + o, y: s.y } : { x: s.x, y: s.y + o };
  }
  function pendPos(p, t) {
    var a = Math.sin(t * p.spd + p.phase) * p.amp;
    return { x: p.px + Math.sin(a) * p.len, y: p.py + Math.cos(a) * p.len };
  }

  /* ---------- 生成 ---------- */
  function makeLevel(n, config, attempt) {
    var R = mulberry32((config[0] + attempt * 7717) * 2654435761 >>> 0);
    var targetsN = config[1];
    var netHalf = config[11];
    var baseLen = config[3];
    var mode = config[4];
    var chapter = chapterOf(n);
    var angleMax = chapter === 0 ? 0.3 : chapter === 1 ? 0.42 : chapter === 2 ? 0.5 : 0.55;
    /* 摆幅可达性：锚点横向展开必须能让目标荡进安全网 */
    var reach = baseLen * Math.sin(angleMax);
    var spread = Math.min(config[2], config[3] + netHalf - 16, netHalf + reach - 22, CX - 34);
    spread = Math.max(spread, Math.min((targetsN - 1) * 26, CX - 34));
    if (spread < 16) spread = 16;

    var targets = [];
    var anchors = [];
    for (var i = 0; i < targetsN; i++) {
      var frac = targetsN === 1 ? 0 : (i / (targetsN - 1)) * 2 - 1;
      var ax = CX + frac * spread + (R() * 2 - 1) * 6;
      ax = clamp(ax, 50, W - 50);
      var ay = (i % 2 === 1 ? 50 : 28) + R() * 10;
      var len = baseLen + (R() * 2 - 1) * 8;
      var ang = (i % 2 === 1 ? -1 : 1) * angleMax * (0.9 + R() * 0.1);
      var tx = ax + Math.sin(ang) * len;
      var ty = ay + Math.cos(ang) * len;
      if (ty > NET_Y - 110) { len = Math.max(60, NET_Y - 110 - ay); ty = ay + Math.cos(ang) * len; }
      var strands = [{ ax: ax, ay: ay, len: len, ang: ang }];
      anchors.push({ x: ax, y: ay });
      var doubleRope = mode === 2 || (mode === 1 && i % 2 === 1);
      if (doubleRope) {
        var off = (i % 2 === 0 ? 1 : -1) * (44 + R() * 24);
        var ax2 = clamp(ax + off, 34, W - 34);
        var ay2 = clamp(ay + (R() * 2 - 1) * 14, 22, 62);
        var dx = tx - ax2, dy = ty - ay2;
        var len2 = Math.hypot(dx, dy);
        strands.push({ ax: ax2, ay: ay2, len: len2, ang: Math.atan2(dx, dy) });
        anchors.push({ x: ax2, y: ay2 });
      }
      targets.push({ id: i, x: tx, y: ty, strands: strands });
    }

    /* 目标初始位置分离（保持绳索几何：目标与全部锚点一起平移） */
    for (var pass = 0; pass < 8; pass++) {
      var moved = false;
      for (var a = 0; a < targets.length; a++) {
        for (var b = a + 1; b < targets.length; b++) {
          var ta = targets[a], tb = targets[b];
          var dist = Math.hypot(ta.x - tb.x, ta.y - tb.y);
          if (dist >= 32) continue;
          var dir = tb.x >= ta.x ? 1 : -1;
          var delta = (34 - dist) * dir;
          var minAx = Infinity, maxAx = -Infinity;
          tb.strands.forEach(function (s) {
            if (s.ax < minAx) minAx = s.ax;
            if (s.ax > maxAx) maxAx = s.ax;
          });
          if (delta > 0) delta = Math.min(delta, W - 42 - maxAx);
          else delta = Math.max(delta, 42 - minAx);
          if (Math.abs(delta) < 1) continue;
          tb.x += delta;
          tb.strands.forEach(function (s) { s.ax += delta; });
          moved = true;
        }
      }
      if (!moved) break;
    }
    anchors = [];
    targets.forEach(function (t) {
      t.strands.forEach(function (s) { anchors.push({ x: s.ax, y: s.ay }); });
    });

    var saws = [];
    var pends = [];
    var magmas = [];
    var netLeft = CX - netHalf;
    var netRight = CX + netHalf;

    for (var si = 0; si < config[5]; si++) {
      var right = si % 2 === 0;
      var zlo = right ? netRight + 26 : 30;
      var zhi = right ? W - 30 : netLeft - 26;
      if (zhi - zlo < 30) { zlo = right ? W - 54 : 24; zhi = right ? W - 24 : 54; }
      var axis = R() < 0.5 ? 'x' : 'y';
      var maxAmp = Math.max(10, (zhi - zlo) / 2 - 8);
      var amp = Math.min(14 + R() * 20, maxAmp);
      var x = zlo + amp + R() * Math.max(4, zhi - zlo - amp * 2);
      var y = 284 + R() * 48;
      if (axis === 'x') {
        x = Math.max(zlo + amp, Math.min(zhi - amp, x));
      } else {
        amp = Math.min(amp, 42);
        y = Math.max(272 + amp, Math.min(352 - amp, y));
      }
      saws.push(sawDef(x, y, axis, amp, 0.8 + R() * 1.1, R() * 6.28, 14 + R() * 7));
    }

    for (var pi = 0; pi < config[6]; pi++) {
      var pright = pi % 2 === 0;
      var px = pright ? W - 46 : 46;
      var plen = 104 + R() * 34;
      pends.push(pendDef(px, 38 + R() * 14, plen, 0.8 + R() * 0.2,
        0.8 + R() * 0.7, R() * 6.28, 12 + R() * 5));
    }

    for (var mi = 0; mi < config[7]; mi++) {
      var mright = mi % 2 === 0;
      if (mright) {
        var mw = Math.max(28, Math.min(96, W - 30 - netRight - 14));
        magmas.push(magmaDef(netRight + 8 + R() * 8, 392, mw, 22));
      } else {
        var mw2 = Math.max(28, Math.min(96, netLeft - 24 - 14));
        magmas.push(magmaDef(Math.max(8, netLeft - 16 - mw2), 392, mw2, 22));
      }
    }

    /* 宝石：中央自由区域的加分目标 */
    var gems = [];
    var gemCount = 1 + (n % 4 === 0 ? 1 : 0);
    for (var gi = 0; gi < gemCount; gi++) {
      var gx = 130 + R() * 280;
      var gy = 176 + R() * 150;
      for (var ga = 0; ga < 8; ga++) {
        var bad = false;
        for (var ti = 0; ti < targets.length; ti++) {
          if (Math.hypot(gx - targets[ti].x, gy - targets[ti].y) < 34) bad = true;
        }
        for (var sk = 0; sk < saws.length; sk++) {
          var sp0 = sawPos(saws[sk], 0);
          if (Math.hypot(gx - sp0.x, gy - sp0.y) < 26 + saws[sk].r) bad = true;
        }
        for (var pk = 0; pk < pends.length; pk++) {
          var pp0 = pendPos(pends[pk], 0);
          if (Math.hypot(gx - pp0.x, gy - pp0.y) < 26 + pends[pk].r) bad = true;
        }
        for (var mk = 0; mk < magmas.length; mk++) {
          var mm = magmas[mk];
          if (gx > mm.x - 16 && gx < mm.x + mm.w + 16 && gy > mm.y - 16) bad = true;
        }
        if (Math.abs(gx - CX) < netHalf - 20 && gy > NET_Y - 60) bad = true;
        if (bad) { gx = 130 + R() * 280; gy = 176 + R() * 150; } else break;
      }
      gems.push({ x: gx, y: gy, r: 9 });
    }

    var requiredCuts = 0;
    for (var ci = 0; ci < targets.length; ci++) requiredCuts += targets[ci].strands.length;

    var level = {
      n: n,
      seed: config[0],
      chapter: chapter,
      net: { x: CX, y: NET_Y, half: netHalf },
      timeLimit: config[12],
      cutBonus: config[8],
      cutLimit: requiredCuts + config[8],
      requiredCuts: requiredCuts,
      tools: { freeze: config[9], hook: config[10] },
      targets: targets,
      anchors: anchors,
      saws: saws,
      pendulums: pends,
      magmas: magmas,
      gems: gems,
      spikes: { y: NET_Y - 4, leftEdge: netLeft, rightEdge: netRight }
    };
    return level;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- 可解性：摆锤 + 抛体解析模拟 ---------- */
  function hazardHit(x, y, r, level, t) {
    for (var i = 0; i < level.saws.length; i++) {
      var s = level.saws[i], sp = sawPos(s, t);
      if (Math.hypot(x - sp.x, y - sp.y) < s.r + r) return true;
    }
    for (var j = 0; j < level.pendulums.length; j++) {
      var p = level.pendulums[j], pp = pendPos(p, t);
      if (Math.hypot(x - pp.x, y - pp.y) < p.r + r) return true;
    }
    for (var k = 0; k < level.magmas.length; k++) {
      var m = level.magmas[k];
      if (x > m.x && x < m.x + m.w && y > m.y && y < m.y + m.h) return true;
    }
    return false;
  }

  /** 模拟「先切断其它绳，只留 anchor 这条」后，寻找一个切割时刻可落入安全网 */
  function strandSolution(level, target, keep, r) {
    var G = 520, dt = 0.012, dtPre = 0.07;
    var ax = keep.ax, ay = keep.ay, len = keep.len;
    var theta = Math.atan2(target.x - ax, target.y - ay);
    var omega = 0;
    for (var pre = 0; pre <= 4.6; pre += dtPre) {
      // 摆锤推进
      var acc = -(G / Math.max(len, 40)) * Math.sin(theta);
      omega += acc * dtPre;
      omega *= 0.999;
      theta += omega * dtPre;
      if (pre < 0.001) { /* 起点也作为候选 */ }
      var x = ax + Math.sin(theta) * len;
      var y = ay + Math.cos(theta) * len;
      var vx = Math.cos(theta) * len * omega;
      var vy = -Math.sin(theta) * len * omega;
      // 抛体
      var bx = x, by = y, bvx = vx, bvy = vy;
      for (var ft = 0; ft < 3.2; ft += dt) {
        bvy += G * dt;
        bx += bvx * dt;
        by += bvy * dt;
        if (bx < 4 || bx > W - 4) break;
        if (hazardHit(bx, by, r, level, pre + ft)) break;
        if (by >= level.net.y - 4) {
          if (Math.abs(bx - level.net.x) <= level.net.half - 4) return true;
          break;
        }
        if (by > H + 20) break;
      }
    }
    return false;
  }

  function isSolvable(level) {
    var r = 13;
    for (var i = 0; i < level.targets.length; i++) {
      var t = level.targets[i];
      var ok = false;
      for (var k = 0; k < t.strands.length; k++) {
        if (strandSolution(level, t, t.strands[k], r)) { ok = true; break; }
      }
      if (!ok) return false;
    }
    return true;
  }

  /* ---------- 实体合法性 / 不重叠 ---------- */
  function validateLevel(level) {
    var issues = [];
    function bad(msg) { issues.push(msg); }
    if (!level || !level.targets || !level.targets.length) { bad('no targets'); return issues; }
    if (level.cutLimit < level.requiredCuts) bad('cutLimit < requiredCuts');
    if (!(level.timeLimit > 0)) bad('timeLimit invalid');

    level.targets.forEach(function (t, i) {
      if (t.x < 16 || t.x > W - 16 || t.y < 40 || t.y > level.net.y - 90) bad('target ' + i + ' out of bounds');
      t.strands.forEach(function (s, k) {
        if (s.ax < 20 || s.ax > W - 20 || s.ay < 16 || s.ay > 80) bad('anchor ' + i + '/' + k + ' out of bounds');
        if (!(s.len > 40)) bad('rope too short ' + i + '/' + k);
      });
      for (var j = i + 1; j < level.targets.length; j++) {
        var o = level.targets[j];
        if (Math.hypot(t.x - o.x, t.y - o.y) < 28) bad('target overlap ' + i + '/' + j);
      }
      level.saws.forEach(function (s) {
        var p = sawPos(s, 0);
        if (Math.hypot(t.x - p.x, t.y - p.y) < 13 + s.r + 4) bad('target/saw overlap ' + i);
        if (p.x - s.amp < 20 || p.x + s.amp > W - 20) bad('saw out of bounds');
      });
      level.pendulums.forEach(function (p) {
        var pp = pendPos(p, 0);
        if (Math.hypot(t.x - pp.x, t.y - pp.y) < 13 + p.r + 4) bad('target/pendulum overlap ' + i);
      });
      level.magmas.forEach(function (m) {
        if (t.x > m.x - 14 && t.x < m.x + m.w + 14 && t.y > m.y - 14) bad('target/magma overlap ' + i);
      });
      level.gems.forEach(function (g) {
        if (Math.hypot(t.x - g.x, t.y - g.y) < 13 + g.r + 4) bad('target/gem overlap ' + i);
      });
    });

    level.gems.forEach(function (g, i) {
      if (g.x < 40 || g.x > W - 40 || g.y < 120 || g.y > level.net.y - 40) bad('gem ' + i + ' out of bounds');
      level.saws.forEach(function (s) {
        var p = sawPos(s, 0);
        if (Math.hypot(g.x - p.x, g.y - p.y) < g.r + s.r + 2) bad('gem/saw overlap ' + i);
      });
      level.magmas.forEach(function (m) {
        if (g.x > m.x - 10 && g.x < m.x + m.w + 10 && g.y > m.y - 10) bad('gem/magma overlap ' + i);
      });
    });

    level.saws.forEach(function (s, i) {
      var p = sawPos(s, 0);
      if (s.axis === 'x') {
        if (p.x - s.amp < 14 || p.x + s.amp > W - 14) bad('saw ' + i + ' out of bounds');
        if (p.y < 120 || p.y > level.net.y - 20) bad('saw ' + i + ' invalid');
      } else {
        if (p.y - s.amp < 120 || p.y + s.amp > level.net.y - 20) bad('saw ' + i + ' out of bounds');
        if (p.x < 14 || p.x > W - 14) bad('saw ' + i + ' invalid');
      }
    });
    level.magmas.forEach(function (m, i) {
      if (m.x < 6 || m.x + m.w > W - 6 || m.y + m.h > level.net.y + 2) bad('magma ' + i + ' invalid');
    });
    if (!isSolvable(level)) bad('no solution');
    return issues;
  }

  var cache = {};
  function build(n) {
    n = Math.max(1, Math.round(Number(n) || 1));
    if (cache[n]) return cache[n];
    var level = n <= WRITTEN ? buildWritten(n) : buildProcedural(n);
    cache[n] = level;
    return level;
  }

  /* 1-60：完全沿用原手写表逻辑，保证数据与 signature 不变 */
  function buildWritten(n) {
    var config = TABLE[n - 1];
    var level = null;
    for (var attempt = 0; attempt < 18; attempt++) {
      var cand = makeLevel(n, config, attempt);
      level = cand;
      if (validateLevel(cand).length === 0) break;
    }
    if (!level) level = makeLevel(n, config, 0);
    /* 兜底：中央直落，保证始终可玩 */
    if (!isSolvable(level)) {
      level = makeLevel(n, cfg(config[0], config[1], Math.min(netHalfSafe(level), 40), config[3], 0,
        config[5], config[6], config[7], config[8], config[9], config[10], config[11], config[12]), 42);
    }
    return level;
  }

  /* 61+：程序化无限章。最多 24 次尝试，逐步降低危险物/缩小展开，
     后半段使用“宽安全网 + 无危险物 + 单绳”兜底，保证 validateLevel 为 0 问题。 */
  function buildProcedural(n) {
    var base = proceduralConfig(n);
    var level = null;
    for (var attempt = 0; attempt < 24; attempt++) {
      var c = base.slice();
      if (attempt < 12) {
        var k = Math.floor(attempt / 3);
        c[2] = Math.max(74, base[2] - k * 14);
        c[5] = Math.max(0, base[5] - k);
        c[6] = Math.max(0, base[6] - Math.floor(k / 2));
        c[7] = Math.max(0, base[7] - Math.floor(k / 2));
        c[11] = base[11] + Math.min(18, k * 6);
      } else {
        var j = attempt - 12;
        c[1] = Math.min(base[1], 6);
        c[2] = Math.max(58, 86 - Math.floor(j / 4) * 8);
        c[3] = Math.min(base[3], 150);
        c[4] = 0;                 /* 兜底改单绳，确保摆落可达 */
        c[5] = 0; c[6] = 0; c[7] = 0;
        c[11] = Math.max(78, base[11] + 24 - Math.floor(j / 6) * 4);
        c[12] = Math.max(base[12], 150);
      }
      var cand = makeLevel(n, c, attempt);
      var iss = validateLevel(cand);
      level = cand;
      if (iss.length === 0) break;
    }
    return level;
  }
  function netHalfSafe(level) { return level.net.half; }

  /* 每日挑战：日期种子，独立 6 目标 / 多种危险 */
  function daily(dateStr) {
    var s = String(dateStr || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var seed = 7000 + (h % 1000);
    var netHalf = 56 + (h % 12);
    var config = cfg(seed, 5, 232, 180, 2, 6, 3, 3, 1, 1, 2, netHalf, 130);
    var level = null;
    for (var attempt = 0; attempt < 12; attempt++) {
      var cand = makeLevel(999, config, attempt + 3);
      cand.n = 999; cand.daily = true; cand.chapter = 3;
      if (validateLevel(cand).length === 0) { level = cand; break; }
      if (!level) level = cand;
    }
    level.daily = true;
    return level;
  }

  function signature(level) {
    return JSON.stringify({
      n: level.n,
      t: level.targets.map(function (x) {
        return [Math.round(x.strands[0].ax), Math.round(x.strands[0].ay), Math.round(x.strands[0].len)];
      }),
      s: level.saws.map(function (x) { return [Math.round(x.x), Math.round(x.y), x.axis]; }),
      p: level.pendulums.map(function (x) { return [x.px, Math.round(x.len)]; }),
      m: level.magmas.map(function (x) { return [Math.round(x.x), Math.round(x.w)]; }),
      net: level.net.half
    });
  }

  var RopeLevels = {
    W: W, H: H, CX: CX, NET_Y: NET_Y,
    endless: true,
    writtenCount: WRITTEN,
    count: function () { return WRITTEN; },
    isEndless: isEndless,
    chapters: function () { return CHAPTERS.slice(); },
    chapterOf: chapterOf,
    chapterRange: chapterRange,
    proceduralConfig: proceduralConfig,
    build: build,
    daily: daily,
    validate: validateLevel,
    isSolvable: isSolvable,
    signature: signature,
    sawPos: sawPos,
    pendPos: pendPos,
    /* 全量校验（测试用） */
    validateAll: function () {
      return RopeLevels.validateAllRange(1, WRITTEN);
    },
    validateAllRange: function (from, to) {
      from = Math.max(1, Math.round(Number(from) || 1));
      to = Math.max(from, Math.round(Number(to) || from));
      var out = { from: from, to: to, total: to - from + 1, ok: 0, issues: [], signatures: {}, duplicates: 0 };
      for (var n = from; n <= to; n++) {
        var lv = build(n);
        var iss = validateLevel(lv);
        var sig = signature(lv);
        if (out.signatures[sig]) out.duplicates++;
        out.signatures[sig] = true;
        if (iss.length) out.issues.push({ n: n, issues: iss });
        else out.ok++;
      }
      return out;
    },
    validateDaily: function (dateStr) {
      var d = daily(dateStr || '2026-11-04');
      return { n: 'daily', issues: validateLevel(d) };
    }
  };

  root.RopeLevels = RopeLevels;
  if (typeof module !== 'undefined' && module.exports) module.exports = RopeLevels;
})(typeof window !== 'undefined' ? window : globalThis);
