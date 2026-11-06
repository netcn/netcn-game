/* ============================================================
   中英双语 i18n —— Arcade.i18n
   语言存储：localStorage 'arcade_lang'（zh / en）
   默认语言：已存 → 记忆值；未存（首次访问）→ 按浏览器语言自适应
   （/^zh/ 浏览器 → zh，其余 → en）。t(key) 取当前语言文案，缺省回退 zh。
   静态元素：元素带 data-i18n="key"（textContent）或
   data-i18n-attr="key|attrName"（属性，如 placeholder/title）。
   切换语言后整页刷新（静态文案重渲染最可靠）。
   依赖：无（最先加载）；字典见 i18n-dict.js（须在其后加载）。
   注意：head 内联探测脚本（sync-head.js 注入）与这里的默认语言逻辑必须保持一致。
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.i18n = (function () {
  var KEY = 'arcade_lang';
  var lang = 'zh';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'zh' || saved === 'en') {
      lang = saved;
    } else {
      /* 首次访问（无记忆）：按浏览器语言自适应 —— 中文浏览器 → zh，其余 → en */
      var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
      lang = /^zh/.test(nav) ? 'zh' : 'en';
    }
  } catch (e) {}
  if (lang !== 'en' && lang !== 'zh') lang = 'zh';

  function t(key) {
    var dicts = Arcade.i18n.dicts;
    var v = dicts && dicts[lang] && dicts[lang][key];
    if (v === undefined && lang !== 'zh') {
      v = dicts && dicts.zh && dicts.zh[key];
    }
    return v !== undefined ? v : key;
  }

  function setLang(l) {
    if (l !== 'zh' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    location.reload();
  }
  function getLang() { return lang; }

  /* 同步 <html lang> 属性（SEO/无障碍：切 EN 时 lang 应为 en） */
  (function syncLang() {
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
      }
    } catch (e) {}
  })();

  /* 应用静态 data-i18n 元素（页面加载后调用） */
  function applyStatic(rootEl) {
    var root = rootEl || document;
    var els = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = t(els[i].getAttribute('data-i18n'));
    }
    var attrs = root.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrs.length; j++) {
      var spec = attrs[j].getAttribute('data-i18n-attr');
      var parts = spec.split('|');
      if (parts.length === 2) attrs[j].setAttribute(parts[1], t(parts[0]));
    }
  }

  return { t: t, setLang: setLang, getLang: getLang, applyStatic: applyStatic };
})();

/* 全局翻译函数 T（游戏/页面脚本通用）：所有脚本均在 i18n.js 之后加载，安全直接使用 */
var T = Arcade.i18n.t;
