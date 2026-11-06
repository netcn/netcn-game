/* ============================================================
   剧情互通（纯本地）：破译战役 ↔ 密码侦探 ↔ 大厅每日电报
   localStorage key: arcade_plot = { campaign, detective, detectiveHidden }
     campaign        破译战役已通关
     detective       密码侦探已通关（任一结局）
     detectiveHidden 密码侦探隐藏结局「真相」达成
   使用：campaign/detective 通关处 Arcade.plot.mark('xxx')；
        大厅 / 游戏内用 Arcade.plot.has('xxx') 读取解锁状态。
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.plot = (function () {
  var KEY = 'arcade_plot';

  function load() {
    try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : {}; }
    catch (e) { return {}; }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  function has(k) { return !!load()[k]; }

  function mark(k) {
    var d = load();
    if (!d[k]) { d[k] = 1; save(d); }
  }

  return { has: has, mark: mark };
})();
