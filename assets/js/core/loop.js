/* ============================================================
   游戏循环工具：固定步长 rAF 循环 + 失焦自动暂停
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.loop = (function () {

  /**
   * 启动固定步长循环。
   * update(dtSteps): 逻辑推进，参数为经过的步数（通常为 1）
   * render(): 每帧绘制
   * stepMs: 单步时长（毫秒），如贪吃蛇 120、动作游戏 16
   *
   * 返回控制句柄 { stop, pause, resume, setStep, isRunning }
   * 页面切后台（visibilitychange）时自动暂停，回前台需手动 resume 或自动恢复。
   */
  function start(update, render, stepMs, opts) {
    opts = opts || {};
    var autoResume = opts.autoResume !== false; // 默认回前台自动恢复
    var step = stepMs;
    var acc = 0;
    var last = 0;
    var rafId = null;
    var running = false;
    var pausedByHidden = false;

    function frame(ts) {
      if (!running) return;
      rafId = requestAnimationFrame(frame);
      if (!last) last = ts;
      var delta = ts - last;
      last = ts;
      // 防止切后台后 delta 暴涨导致一帧跳变
      if (delta > 250) delta = 250;
      acc += delta;
      var guard = 0;
      while (acc >= step && guard < 8) {
        update(1);
        acc -= step;
        guard++;
      }
      if (guard >= 8) acc = 0; // 积压过多直接丢弃，防死亡螺旋
      render();
    }

    function onVisibility() {
      if (document.hidden && running) {
        pausedByHidden = true;
        api.pause();
      } else if (!document.hidden && pausedByHidden && autoResume) {
        pausedByHidden = false;
        api.resume();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    var api = {
      isRunning: function () { return running; },
      pause: function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      },
      resume: function () {
        if (running) return;
        running = true;
        last = 0;
        acc = 0;
        rafId = requestAnimationFrame(frame);
      },
      stop: function () {
        api.pause();
        document.removeEventListener('visibilitychange', onVisibility);
      },
      setStep: function (ms) { step = ms; }
    };

    api.resume();
    lastLoop = api;
    return api;
  }

  var lastLoop = null;
  function pauseLast() { if (lastLoop) lastLoop.pause(); }
  function resumeLast() { if (lastLoop) lastLoop.resume(); }
  function toggleLast() { if (lastLoop) { if (lastLoop.isRunning()) lastLoop.pause(); else lastLoop.resume(); } }

  return { start: start, pause: pauseLast, resume: resumeLast, toggle: toggleLast };
})();
