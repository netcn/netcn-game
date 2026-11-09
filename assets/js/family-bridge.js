/* ============================================================
   family-bridge.js — 家族顶栏与 53 个游戏内页的联动（共用一份）
   1) 顶栏中英切换 → 同步 Arcade.i18n（不刷新，不打断正在玩的游戏）
   2) 顶栏明暗切换 → 家族主题是唯一真源，游戏旧主题系统退出，
      页面框架与游戏舞台一起随全站明暗变化
   3) 顶栏搜索 → 回车回大厅搜游戏
   4) 隐藏游戏快捷栏里与顶栏重复的语言/主题按钮，以及已下线的背景乐开关
   ============================================================ */
(function () {
  var d = document, r = d.documentElement;

  /* ---------- 中英 ---------- */
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

  /* ---------- 明暗：一处开关，全页跟随 ---------- */
  function curTheme() {
    return r.getAttribute('data-theme') === 'dark' || r.classList.contains('dark') ? 'dark' : 'light';
  }
  function themeMeta(t) {
    var m = d.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#10141c' : '#fafbfc');
    var sb = d.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (sb) sb.setAttribute('content', t === 'dark' ? 'black-translucent' : 'default');
  }
  /* 游戏自带的 theme-daylight（晨光档案）是与全站并行的第二套主题，
     会盖掉家族深色态；让位给 html[data-theme]/html.dark 这一处真源。
     extras.js 在 Arcade.settings.set() 时会重新加回，故用观察器兜底。 */
  function lockTheme(t) {
    if (r.classList.contains('theme-daylight')) r.classList.remove('theme-daylight');
    themeMeta(t);
  }
  d.addEventListener('ncn:theme', function (e) {
    var t = (e && e.detail && e.detail.theme) || curTheme();
    lockTheme(t);
    try { d.dispatchEvent(new CustomEvent('arcade:theme', { detail: { theme: t } })); } catch (err) {}
  });
  try {
    var tObs = new MutationObserver(function () { lockTheme(curTheme()); });
    tObs.observe(r, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  } catch (e) {}

  /* ---------- 顶栏搜索：回车回大厅 ---------- */
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

  /* ---------- 快捷栏去重 + 背景乐开关下线 ---------- */
  function dedupeQuickbar() {
    var bar = d.getElementById('arcade-quickbar');
    if (!bar) return;
    var T = (window.Arcade && Arcade.i18n && Arcade.i18n.t) ? Arcade.i18n.t : function (k) { return k; };
    [].slice.call(bar.querySelectorAll('.qb-btn')).forEach(function (b, i) {
      var label = (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '');
      if (b.classList.contains('qb-lang')) { b.classList.add('qb-family-dup'); return; }
      /* 第 2 个按钮固定是背景乐开关；背景乐已整体下线，连开关一并收起 */
      if (i === 1 || /音乐|Music|BGM/i.test(label)) {
        b.classList.add('qb-music');
        b.setAttribute('aria-hidden', 'true');
        return;
      }
      if (label.indexOf(T('settings.theme')) >= 0 || /主题|Theme/i.test(label)) {
        b.classList.add('qb-family-dup');
      }
    });
  }

  function init() {
    wireSearch();
    dedupeQuickbar();
    /* 页脚在早期版本带 data-nc-tone="dark"，会与其余四站深浅不同 */
    var foot = d.querySelector('.nc-foot[data-nc-tone]');
    if (foot) foot.removeAttribute('data-nc-tone');
    lockTheme(curTheme());
    var obs = new MutationObserver(function () { dedupeQuickbar(); });
    obs.observe(d.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 3000);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
