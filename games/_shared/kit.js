/* ============================================================
   游戏街机厅 · 游戏页共享小工具（仅新增，不改动 core 既有行为）
   载入顺序：在 core/* 之后、游戏主脚本之前引入
   用法：GK.setup(canvas, 460, 300) 得到 { ctx, w, h, dpr }
       所有绘制仍使用逻辑坐标（w/h），HiDPI 由内部缩放
   ============================================================ */
window.GK = (function () {
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function easeOutCubic(t) { t = 1 - t; return 1 - t * t * t; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  /** 画布初始化：按 devicePixelRatio 放大 backing store，绘制继续用逻辑坐标 */
  function setup(canvas, w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.setAttribute('width', String(w));
    canvas.setAttribute('height', String(h));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    if (dpr > 1) ctx.scale(dpr, dpr);
    var info = { w: w, h: h, dpr: dpr, ctx: ctx };
    canvas.__gk = info;
    return info;
  }

  /** 逻辑尺寸（优先取 setup 记录，退化到属性值） */
  function size(canvas) {
    if (canvas.__gk) return canvas.__gk;
    return {
      w: parseInt(canvas.getAttribute('width'), 10) || canvas.width,
      h: parseInt(canvas.getAttribute('height'), 10) || canvas.height,
      dpr: 1
    };
  }

  /** 指针/触摸事件 → 画布逻辑坐标（用于格子类游戏精确取格） */
  function pointer(canvas, ev) {
    var s = size(canvas);
    var r = canvas.getBoundingClientRect();
    var t = ev;
    if (ev && ev.touches && ev.touches.length) t = ev.touches[0];
    else if (ev && ev.changedTouches && ev.changedTouches.length) t = ev.changedTouches[0];
    var x = (t.clientX - r.left) * (s.w / r.width);
    var y = (t.clientY - r.top) * (s.h / r.height);
    return { x: x, y: y, col: x, row: y };
  }

  /** 画布逻辑坐标 → 视口坐标（Arcade.fx/juice 的 DOM 粒子层用） */
  function toClient(canvas, x, y) {
    var s = size(canvas);
    var r = canvas.getBoundingClientRect();
    return { x: r.left + x * (r.width / s.w), y: r.top + y * (r.height / s.h) };
  }

  /** 在画布逻辑坐标处播放粒子（自动换算到视口） */
  function burst(canvas, x, y, color, count) {
    if (!window.Arcade || !Arcade.fx) return;
    var p = toClient(canvas, x, y);
    Arcade.fx.burst(p.x, p.y, color, count);
  }

  function roundRect(ctx, x, y, w, h, r) {
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

  /** 霓虹描边文字（不影响调用方的字体设置） */
  function glowText(ctx, text, x, y, color, blur) {
    ctx.save();
    ctx.shadowColor = color || '#00f0ff';
    ctx.shadowBlur = blur || 12;
    ctx.fillStyle = color || '#00f0ff';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** mm:ss */
  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  return {
    clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, choice: choice,
    easeOutCubic: easeOutCubic, easeInOutCubic: easeInOutCubic,
    easeOutBack: easeOutBack, easeOutQuad: easeOutQuad,
    setup: setup, size: size, pointer: pointer, toClient: toClient,
    burst: burst, roundRect: roundRect, glowText: glowText, fmtTime: fmtTime
  };
})();
