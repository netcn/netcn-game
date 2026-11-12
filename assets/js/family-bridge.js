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

  /* ---------- 顶栏搜索：回车回大厅 ----------
     文案跟随统一内核的语言状态（历史版本硬编码中文，EN 下不变） */
  function setSearchPh() {
    var box = d.querySelector('.nc-search input');
    if (!box) return;
    var en = (window.NETCN && NETCN.lang && NETCN.lang() === 'en') ||
             (!window.NETCN && d.documentElement.lang === 'en');
    box.setAttribute('placeholder', en ? 'Search games... (Enter for lobby)' : '搜游戏…（回车回大厅）');
    box.setAttribute('aria-label', en ? 'Search games' : '搜索游戏');
  }
  function wireSearch() {
    var box = d.querySelector('.nc-search input');
    if (!box || box.dataset.familyWired) return;
    box.dataset.familyWired = '1';
    setSearchPh();
    d.addEventListener('ncn:lang', setSearchPh);
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var q = (box.value || '').trim();
      location.href = '../../index.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  /* 顶栏「↻ 重开」默认在没有 GAME_RESTART 时整页刷新。少数游戏只写了
     游戏内的「重新开始」按钮，没把这个钩子接出来。这里做一次通用兜底：
     动态找到游戏自己的重开按钮并触发它，走游戏原本的重置逻辑，
     不刷新页面、不丢滚动位置；找不到时才回退到刷新。 */
  function wireRestartFallback() {
    if (typeof window.GAME_RESTART === 'function') return;
    window.GAME_RESTART = function () {
      var btns = d.querySelectorAll('#game-root button, #game-root [role="button"]');
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || '').trim().replace(/\s+/g, ' ');
        if (/^(?:↻\s*)?(?:重新开始|重开|再来一次|再玩一次|再来一局|再玩一局|重新挑战|开始冒险|重试|新游戏|Restart|Play Again|Retry|New Game)/i.test(t)) {
          try { btns[i].click(); return; } catch (e) {}
        }
      }
      location.reload();
    };
  }

  function init() {
    wireSearch();
    wireRestartFallback();
    /* 页脚在早期版本带 data-nc-tone="dark"，会与其余四站深浅不同 */
    var foot = d.querySelector('.nc-foot[data-nc-tone]');
    if (foot) foot.removeAttribute('data-nc-tone');
    lockTheme(curTheme());
    /* 重复的音乐 / 语言 / 主题按钮已在 extras.js 停止生成，无需再去重观察 */
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
