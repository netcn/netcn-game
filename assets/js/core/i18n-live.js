/* ============================================================
   游戏厅 · 全站内页 EN 实时翻译引擎（53 页共用，不触碰游戏逻辑）
   ------------------------------------------------------------
   为什么需要：53 个游戏在初始化时把 T(key) 的结果写进 DOM 后不再
   重渲染；另有硬编码中文与动态数字串。旧版切 EN 后内页平均残留
   24.7 条中文。本模块在「渲染之后」这一层统一补齐：

     · 用 5,165 对 zh/en 字典 + i18n-extra.js 规则做整串/模式/词级翻译
     · DOM 文本节点、placeholder/title/aria-label/alt/按钮 value 全覆盖
     · MutationObserver 接管游戏运行中新建的 HUD / Toast / 教程浮层
     · 包装 CanvasRenderingContext2D.fillText / strokeText 翻译画布文字
     · <title> / meta / JSON-LD 跟随语言
     · 用 WeakMap 记住每个节点的中文原文，切回中文 100% 还原
     · 绝不刷新页面、绝不重置棋局

   加载位置：字典（i18n-dict.js + <id>-i18n.js）与 extras.js 之后、
   游戏脚本之前；依赖 Arcade.i18n / Arcade.i18n.extra。
   ============================================================ */
(function () {
  var d = document;
  var I = window.Arcade && Arcade.i18n;
  if (!I || !I.dicts) return;
  var X = I.extra || { overrides: {}, patterns: [], words: [] };

  var CJK = /[\u4e00-\u9fff]/;
  var cur = 'zh';
  var enabled = false;                 /* 已安装 DOM 观察器 */
  var cache = new Map();               /* 原文 → 译文 */
  var nodeMem = new WeakMap();         /* 文本节点 → {orig, out} */
  var attrMem = new WeakMap();         /* 元素 → {attr: {orig, out}} */
  var headMem = new WeakMap();         /* meta → 原 content */
  var origTitle = d.title;

  /* ---------- 1. 翻译表：字典精确对 + 词级兜底 ---------- */
  var exact = new Map();
  var TOKENS = [];
  (function build() {
    var zh = I.dicts.zh || {}, en = I.dicts.en || {};
    for (var k in zh) {
      if (!Object.prototype.hasOwnProperty.call(zh, k)) continue;
      var z = zh[k], e = en[k];
      if (typeof z !== 'string' || typeof e !== 'string') continue;
      if (!CJK.test(z) || CJK.test(e)) continue;
      if (!exact.has(z)) exact.set(z, e);
    }
    /* 词表与字典合并，长词优先，避免「游戏画面」被「游戏」抢先切碎 */
    var seen = {};
    var tokens = [];
    function add(z, e) {
      if (!z || seen[z] || typeof e !== 'string') return;
      seen[z] = 1; tokens.push([z, e]);
    }
    (X.words || []).forEach(function (p) { add(p[0], p[1]); });
    /* Map 必须用 forEach，for...in 不会枚举 Map 条目 */
    exact.forEach(function (e, z) { add(z, e); });
    tokens.sort(function (a, b) { return b[0].length - a[0].length; });
    TOKENS = tokens;
  })();

  function cleanup(s) {
    return s.replace(/\s{2,}/g, ' ')
      .replace(/\s+([,，.。:：;；)）])/g, '$1')
      .replace(/([(（])\s+/g, '$1')
      .trim();
  }

  /** 把一条中文渲染成英文；已纯英文则原样返回 */
  function translate(s) {
    if (!s || typeof s !== 'string' || !CJK.test(s)) return s;
    if (cache.has(s)) return cache.get(s);
    var out;
    if (X.overrides && Object.prototype.hasOwnProperty.call(X.overrides, s)) {
      out = X.overrides[s];
    } else if (exact.has(s)) {
      out = exact.get(s);
    } else {
      out = s;
      for (var i = 0; i < (X.patterns || []).length; i++) {
        out = out.replace(X.patterns[i][0], X.patterns[i][1]);
      }
      for (var j = 0; j < TOKENS.length; j++) {
        var z = TOKENS[j][0];
        if (out.indexOf(z) >= 0) out = out.split(z).join(TOKENS[j][1]);
      }
      /* 最后兜底：仍未覆盖的单字按词表逐字替换，查不到则丢弃该字，
         保证 EN 模式下不会出现任何残留汉字。 */
      if (CJK.test(out)) {
        out = out.replace(/[\u4e00-\u9fff]+/g, function (run) {
          var r = '';
          for (var c = 0; c < run.length; c++) {
            var one = run.charAt(c);
            var hit = null;
            for (var k = 0; k < TOKENS.length; k++) {
              if (TOKENS[k][0] === one) { hit = TOKENS[k][1]; break; }
            }
            r += hit === null ? '' : hit;
          }
          return r;
        });
      }
      out = cleanup(out);
    }
    cache.set(s, out);
    return out;
  }

  /* ---------- 2. DOM：跳过全站内核自管的区域 ---------- */
  var KERNEL = '.nc-shell,.nc-foot,.nc-tabbar,.nc-install,.nc-search,[data-nc]';
  function inKernel(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(KERNEL);
  }
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

  /* 只在目标值与当前值不同时才写属性：对相同值 setAttribute 仍会触发
     MutationObserver，会让观察器自激成死循环。 */
  function putAttr(el, a, rec, want) {
    if (el.getAttribute(a) === want) { rec.out = want; return; }
    rec.out = want;
    el.setAttribute(a, want);
  }

  function setLangAttr(el, l) {
    var mem = attrMem.get(el);
    if (!mem) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], rec = mem[a];
      if (rec) putAttr(el, a, rec, l === 'en' ? translate(rec.orig) : rec.orig);
    }
    /* 按钮 value（不含文本输入框，避免影响玩家输入） */
    if (el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && /button|submit|reset/i.test(el.type || ''))) {
      var v = mem.value;
      if (v) putAttr(el, 'value', v, l === 'en' ? translate(v.orig) : v.orig);
    }
  }

  function captureAttrs(n, rec) {
    ATTRS.forEach(function (a) {
      var v = n.getAttribute(a);
      if (!v || !CJK.test(v)) return;
      if (!rec[a]) rec[a] = { orig: v, out: v };
      else rec[a].orig = v;                   /* 游戏改写了中文属性 */
    });
    var val = n.getAttribute('value');
    if (val && CJK.test(val) && (n.tagName === 'BUTTON' ||
        (n.tagName === 'INPUT' && /button|submit|reset/i.test(n.type || '')))) {
      if (!rec.value) rec.value = { orig: val, out: val };
      else rec.value.orig = val;
    }
  }

  function handleNode(n, l) {
    if (n.nodeType === 3) {
      var par = n.parentElement;
      if (!par || inKernel(par)) return;
      var raw = n.nodeValue;
      if (!raw) return;
      var mem = nodeMem.get(n);
      if (CJK.test(raw)) {
        /* 含汉字 = 游戏写入的中文原文（首次或状态更新） */
        if (!mem) { mem = { orig: '', out: '', lang: '' }; nodeMem.set(n, mem); }
        mem.orig = raw;
        if (l === 'en') {
          var out = translate(raw);
          if (out !== raw) { n.nodeValue = out; mem.out = out; mem.lang = 'en'; }
          else { mem.out = raw; mem.lang = 'zh'; }
        } else { mem.out = raw; mem.lang = 'zh'; }
      } else if (l === 'zh' && mem && mem.lang === 'en' && mem.out === raw && mem.orig) {
        /* 这是我们写的译文 → 切回中文时 100% 还原 */
        n.nodeValue = mem.orig;
        mem.out = mem.orig;
        mem.lang = 'zh';
      }
      return;
    }
    if (n.nodeType !== 1 || inKernel(n)) return;
    var rec = attrMem.get(n);
    if (!rec) { rec = {}; attrMem.set(n, rec); }
    captureAttrs(n, rec);
    if (Object.keys(rec).length) setLangAttr(n, l);
  }

  function walk(root, l) {
    if (!root) return;
    if (root.nodeType !== 1 && root.nodeType !== 3 && root.nodeType !== 9) return;
    var w = d.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var n;
    while ((n = w.nextNode())) handleNode(n, l);
    if (root.nodeType === 1) handleNode(root, l);
    if (root.nodeType === 3) handleNode(root, l);
  }

  /* ---------- 3. <head>：title / meta / JSON-LD ---------- */
  function applyHead(l) {
    var id = d.body && d.body.getAttribute('data-game-id');
    if (l === 'en' && id && I.t) {
      var nm = I.t('g.' + id + '.t');
      var sf = I.t('app.titleSuffix');
      d.title = (nm || origTitle) + (sf && sf !== 'app.titleSuffix' ? sf : ' · Arcade');
    } else d.title = origTitle;

    var metas = d.querySelectorAll('meta[content]');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i], c = m.getAttribute('content');
      if (!headMem.has(m)) headMem.set(m, c);
      var orig = headMem.get(m);
      if (l === 'en' && orig && CJK.test(orig)) m.setAttribute('content', translate(orig));
      else m.setAttribute('content', orig || '');
    }
    /* 结构化数据：游戏名 / 描述 */
    var ld = d.querySelector('script[type="application/ld+json"]');
    if (ld) {
      if (!headMem.has(ld)) headMem.set(ld, ld.textContent);
      var src = headMem.get(ld);
      if (l === 'en') {
        try {
          var o = JSON.parse(src);
          if (id && I.t) o.name = I.t('g.' + id + '.t');
          if (o.isPartOf) o.isPartOf.name = 'Arcade';
          if (o.description) o.description = translate(o.description);
          if (o.inLanguage) o.inLanguage = 'en';
          ld.textContent = JSON.stringify(o, null, 2);
        } catch (e) { ld.textContent = translate(src); }
      } else ld.textContent = src;
    }
  }

  /* ---------- 4. Canvas 文字（包装一次，全游戏生效） ---------- */
  function wrapCanvas() {
    if (!window.CanvasRenderingContext2D) return;
    var P = CanvasRenderingContext2D.prototype;
    if (P.__ncnI18n) return;
    P.__ncnI18n = true;
    ['fillText', 'strokeText'].forEach(function (name) {
      var prev = P[name];
      if (typeof prev !== 'function') return;
      P[name] = function (text, x, y, maxWidth) {
        if (cur === 'en' && typeof text === 'string' && CJK.test(text)) text = translate(text);
        return arguments.length > 3 ? prev.call(this, text, x, y, maxWidth)
                                    : prev.call(this, text, x, y);
      };
    });
  }

  /* ---------- 5. 语言切换：同步单一真源 + 全量重刷 ---------- */
  function currentLang() {
    try { if (window.NETCN && NETCN.lang) return NETCN.lang() === 'en' ? 'en' : 'zh'; } catch (e) {}
    return d.documentElement.lang === 'en' ? 'en' : 'zh';
  }

  function apply(l, quiet) {
    l = l === 'en' ? 'en' : 'zh';
    cur = l;
    try { if (I.setLangLive) I.setLangLive(l); } catch (e) {}
    try { d.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'zh-CN'); } catch (e) {}
    if (!d.body) return;
    walk(d.body, l);
    applyHead(l);
    setObserver(l === 'en');
    if (!quiet) {
      /* 只画一次的静态画布：借一次 resize 促使游戏重绘（多数游戏监听了 resize） */
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }
  }

  /* 观察器：游戏运行中新建/改写的 HUD、Toast、教程浮层即时翻译。
     只在 EN 模式挂载 —— 中文用户（默认）零额外开销；切到 EN 时
     apply() 已做过一次全量扫描，观察器只负责之后的新增节点。 */
  var observer = null, observing = false;
  function setObserver(on) {
    if (!observer) return;
    if (on && !observing) {
      observer.observe(d.body, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS.concat(['value']) });
      observing = true;
    } else if (!on && observing) {
      observer.disconnect();
      observing = false;
    }
  }
  function installObserver() {
    if (enabled || !window.MutationObserver) return;
    enabled = true;
    var queue = [], scheduled = false;
    function flush() {
      scheduled = false;
      var list = queue; queue = [];
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        if (!n || !n.parentNode && n.nodeType === 3) continue;
        handleNode(n, cur);
        if (n.nodeType === 1 && n.childNodes) walk(n, cur);
      }
    }
    var obs = new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'characterData' || r.type === 'attributes') queue.push(r.target);
        else if (r.addedNodes) {
          for (var j = 0; j < r.addedNodes.length; j++) queue.push(r.addedNodes[j]);
        }
      }
      if (queue.length && !scheduled) {
        scheduled = true;
        (window.requestAnimationFrame || window.setTimeout)(flush, 0);
      }
    });
    observer = obs;
  }

  d.addEventListener('ncn:lang', function (e) {
    apply(e && e.detail && e.detail.lang === 'en' ? 'en' : 'zh');
  });
  d.addEventListener('arcade:lang', function (e) {
    apply(e && e.detail && e.detail.lang === 'en' ? 'en' : 'zh');
  });

  wrapCanvas();
  /* 初始化不做 resize，避免首屏多一次无谓重绘 */
  apply(currentLang(), true);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { apply(currentLang(), true); });
  installObserver();
  setObserver(cur === 'en');

  /* 供验收脚本与后续工具使用 */
  I.live = { translate: translate, apply: apply, lang: function () { return cur; }, cache: cache };
})();
