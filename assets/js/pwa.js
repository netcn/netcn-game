/* ============================================================
   游戏街机厅 · PWA 引导 + 更新接管（D4 修订）
   - 注册 Service Worker（仅 http/https，file:// 下自动跳过）
   - 新版本就绪即自动 SKIP_WAITING（不再依赖用户点击后才接管，
     避免旧缓存栈滞留导致的「假存档/旧功能」问题；
     控制器变更不自动 reload，下次导航自然生效）
   - toast 仍提示「有更新」；点击立即刷新加载新版本
   加载位置：根页面由 sync-head 工具注入；游戏页由 shell.js 注入
   ============================================================ */

(function () {
  if (window.__arcadePWAInjected) return; // 幂等：shell.js 注入与 HTML 直插可能重复加载
  window.__arcadePWAInjected = true;
  try {
    if (!('serviceWorker' in navigator)) return;
    var proto = (window.location.protocol || '');
    if (proto !== 'https:' && proto !== 'http:') return; // file:// 不注册
    window.__arcadePWA = true;

    var updateReady = false;
    var waitingSW = null;

    function autoSkip(sw) {
      try { if (sw && sw.postMessage) sw.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
    }

    function toastUpdate() {
      if (updateReady || !window.Arcade || !Arcade.ui || !Arcade.ui.toast) return;
      updateReady = true;
      var msg = (Arcade.i18n && Arcade.i18n.getLang && Arcade.i18n.getLang() === 'en')
        ? 'New version ready — tap to refresh'
        : '新版本已就绪，点击刷新';
      try {
        Arcade.ui.toast(msg, 'win', function () {
          window.location.reload();
        });
      } catch (e) {}
    }

    window.addEventListener('load', function () {
      /* 子站根页面（index.html）用 ./sw.js，游戏页在 games/<id>/ 下用 ../../sw.js */
      var swUrl = /\/games\/[^/]+\//.test(location.pathname) ? '../../sw.js' : 'sw.js';
      navigator.serviceWorker.register(swUrl).then(function (reg) {
        /* 后续更新：waiting → 自动接管 + 提示（忽略提示则下次导航自然生效） */
        if (reg.waiting) { waitingSW = reg.waiting; autoSkip(reg.waiting); toastUpdate(); }
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              waitingSW = sw;
              autoSkip(sw);
              toastUpdate();
            }
          });
        });
        /* 接管由 skipWaiting 完成；不自动 reload（避免中断进行中的游戏），
           下次导航即用新缓存。首次安装的 clients.claim() 亦无副作用。 */
      }).catch(function (err) {
        /* 注册失败静默（如部署于子路径/无 SW 权限的环境） */
        if (window.console && console.info) console.info('[PWA] SW 注册跳过:', err && err.message);
      });

      /* 接收 SW 发来的「新版本」消息（仅非首次安装时提示） */
      navigator.serviceWorker.addEventListener('message', function (ev) {
        if (ev.data && ev.data.type === 'NEW_VERSION' && navigator.serviceWorker.controller) {
          toastUpdate();
        }
        /* P3-11：SW 缓存命中统计 → 本地 localStorage（每打开页 +1；绝不上传） */
        if (ev.data && ev.data.type === 'SW_STATS' && ev.data.kind) {
          try {
            var s = JSON.parse(localStorage.getItem('arcade_sw_stats') || '{}');
            s[ev.data.kind] = (s[ev.data.kind] || 0) + 1;
            s.t = Date.now();
            localStorage.setItem('arcade_sw_stats', JSON.stringify(s));
          } catch (e2) {}
        }
      });
    });
  } catch (e) {}
})();
