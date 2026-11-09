/* ============================================================
   family-bridge.js — 家族顶栏与游戏页的联动（53 个内页共用）
   1) 顶栏中英切换 → 同步 Arcade.i18n（不刷新，不打断正在玩的游戏）
   2) 顶栏搜索 → 回车回大厅搜游戏，与全站搜索槽位行为一致
   3) 隐藏游戏快捷栏里与顶栏重复的语言/主题按钮
   ============================================================ */
(function () {
  var d = document;

  function syncLang(l) {
    if (l !== 'zh' && l !== 'en') return;
    try {
      if (window.Arcade && Arcade.i18n && Arcade.i18n.setLangLive) Arcade.i18n.setLangLive(l);
      if (window.Arcade && Arcade.i18n && Arcade.i18n.applyStatic) Arcade.i18n.applyStatic(d);
      d.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'zh-CN');
    } catch (e) {}
    try { d.dispatchEvent(new CustomEvent('arcade:lang', { detail: { lang: l } })); } catch (e) {}
  }

  d.addEventListener('ncn:lang', function (e) {
    syncLang(e && e.detail && e.detail.lang);
  });

  /* 顶栏搜索：回车回大厅并把关键词带过去 */
  function wireSearch() {
    var box = d.querySelector('.nc-search input');
    if (!box || box.dataset.familyWired) return;
    box.dataset.familyWired = '1';
    box.setAttribute('placeholder', '搜游戏（回车回大厅）');
    box.setAttribute('aria-label', '搜索游戏');
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var q = (box.value || '').trim();
      location.href = '../../index.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  /* 快捷栏由 extras.js 异步创建，用 MutationObserver 去重 */
  function dedupeQuickbar() {
    var bar = d.getElementById('arcade-quickbar');
    if (!bar) return;
    [].slice.call(bar.querySelectorAll('.qb-btn')).forEach(function (b) {
      if (b.classList.contains('qb-lang')) { b.classList.add('qb-family-dup'); return; }
      var label = (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '');
      /* 家族顶栏已有明暗切换；游戏自带的「主题色循环」按钮隐藏，避免两套主题 */
      var T = (window.Arcade && Arcade.i18n && Arcade.i18n.t) ? Arcade.i18n.t : function (k) { return k; };
      if (label.indexOf(T('settings.theme')) >= 0 || label.indexOf('主题') >= 0 || label.indexOf('Theme') >= 0) {
        b.classList.add('qb-family-dup');
      }
    });
  }

  function init() {
    wireSearch();
    dedupeQuickbar();
    var obs = new MutationObserver(function () { dedupeQuickbar(); });
    obs.observe(d.body, { childList: true, subtree: true });
    /* 观察 3 秒后停止，避免长期开销 */
    setTimeout(function () { obs.disconnect(); }, 3000);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
