/* ============================================================
   统一输入工具：键盘 / 触屏滑动 / 虚拟方向键
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.input = (function () {

  /**
   * 键盘绑定。map: { up: fn, down: fn, left: fn, right: fn, action: fn, any: fn }
   * 支持方向键 + WASD，空格/回车触发 action；自动 preventDefault 防页面滚动。
   */
  function onKeys(map) {
    var KEYMAP = {
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      Space: 'action', Enter: 'action'
    };
    function handler(e) {
      var dir = KEYMAP[e.code];
      if (!dir) return;
      e.preventDefault();
      if (map[dir]) map[dir](e);
      if (map.any) map.any(dir, e);
    }
    window.addEventListener('keydown', handler);
    return function off() { window.removeEventListener('keydown', handler); };
  }

  /**
   * 触屏滑动检测。位移 >= threshold(px) 判定四方向。
   * cb(dir): 'up' | 'down' | 'left' | 'right'
   */
  function onSwipe(el, cb, threshold) {
    var min = threshold || 24;
    var sx = 0, sy = 0, tracking = false;

    el.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; tracking = true;
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < min && Math.abs(dy) < min) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        cb(dx > 0 ? 'right' : 'left');
      } else {
        cb(dy > 0 ? 'down' : 'up');
      }
    }, { passive: true });
  }

  /**
   * 生成霓虹虚拟方向键，返回容器元素。
   * cb(dir, pressed): 'up' | 'down' | 'left' | 'right'；pressed=true 按下 / false 释放。
   * 语义升级：pointer 按下/释放（长按持续）；click 仅作无 pointer 环境兜底并自动去重。
   * 旧式单参回调（只按 dir 判断）在释放时会再次收到 dir，需按 pressed 判断（见各游戏）。
   */
  function createDPad(container, cb) {
    var pad = document.createElement('div');
    pad.className = 'dpad';
    var defs = [
      ['up', '▲', 'dpad-up'],
      ['left', '◀', 'dpad-left'],
      ['down', '▼', 'dpad-down'],
      ['right', '▶', 'dpad-right']
    ];
    defs.forEach(function (d) {
      var btn = document.createElement('button');
      btn.className = 'dpad-btn ' + d[2];
      btn.textContent = d[1];
      btn.setAttribute('aria-label', d[0]);
      var lastPointer = false;
      btn.addEventListener('pointerdown', function () { lastPointer = true; cb(d[0], true); });
      btn.addEventListener('pointerup', function () { cb(d[0], false); });
      btn.addEventListener('pointerleave', function () { cb(d[0], false); });
      btn.addEventListener('pointercancel', function () { cb(d[0], false); });
      // 键盘/无 pointer 环境兜底；pointer 触发过的 click 去重，避免双触发
      btn.addEventListener('click', function () {
        if (lastPointer) { lastPointer = false; return; }
        cb(d[0], true);
      });
      pad.appendChild(btn);
    });
    container.appendChild(pad);
    return pad;
  }

  /** 是否触屏设备（用于决定是否默认显示虚拟方向键） */
  function isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  /**
   * 高分屏清晰化（深度评审 MINOR 批量修复）：
   * 按 devicePixelRatio 放大画布 backing store 并缩放上下文，
   * 绘制代码继续使用逻辑坐标，无需任何改动。
   * 必须在 getContext('2d') 之后、首次绘制之前调用一次。
   */
  function hiDPI(canvas) {
    try {
      var w = parseInt(canvas.getAttribute('width'), 10);
      var h = parseInt(canvas.getAttribute('height'), 10);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!w || !h || dpr <= 1) return;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.getContext('2d').scale(dpr, dpr);
    } catch (e) {}
  }

  return { onKeys: onKeys, onSwipe: onSwipe, createDPad: createDPad, isTouch: isTouch, hiDPI: hiDPI };
})();
