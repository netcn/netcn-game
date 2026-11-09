/* ============================================================
   游戏街机厅 · 扩展基座
   模块：settings / audio / fx / ui / tutorial
   纯静态零依赖；须在 storage.js 之后加载
   游戏页由 shell.js 自动注入；大厅在 index.html 直接引入
   ============================================================ */

window.Arcade = window.Arcade || {};

/* ---------------- 公共 DOM 工具 ---------------- */
/* HTML 转义：任何外部/动态字符串（URL 参数、localStorage 恢复、分享链接等）
   拼入 innerHTML 模板前必须经过本函数，防止标记注入 */
Arcade.escapeHtml = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

/* ---------------- 设置：音效 / 音乐 / 语言 / 主题 / 触感 ---------------- */
Arcade.settings = (function () {
  var KEY = 'arcade_settings';
  var THEMES = ['neon', 'daylight'];
  /* 各主题的主题色（meta theme-color / iOS 状态栏联动；与 theme.css 配色一致） */
  var THEME_COLORS = { neon: '#0a0a12', daylight: '#f2ead8' };
  /* 默认街机霓虹（neon）；历史存档中的 auto/已下线主题一律迁移回默认 */
  var state = { sound: true, music: true, reducedMotion: false, theme: 'neon', haptic: true };

  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var s = JSON.parse(raw);
      for (var k in state) if (s[k] !== undefined) state[k] = s[k];
    }
  } catch (e) {}
  if (THEMES.indexOf(state.theme) < 0) { state.theme = 'neon'; save(); }

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.reducedMotion = true;
  }

  /* 主题色联动：meta theme-color（安卓地址栏/状态栏）+ iOS 状态栏样式随主题切换 */
  function syncThemeColor(t) {
    var color = THEME_COLORS[t] || '#0a0a12';
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', color);
    var sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (sb) sb.setAttribute('content', t === 'daylight' ? 'default' : 'black-translucent');
  }

  function apply() {
    var root = document.documentElement;
    root.classList.remove('theme-daylight');
    var t = THEMES.indexOf(state.theme) >= 0 ? state.theme : 'neon';
    if (t !== 'neon') root.classList.add('theme-' + t);
    root.classList.toggle('reduced-motion', !!state.reducedMotion);
    syncThemeColor(t);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  apply();

  function get() { return JSON.parse(JSON.stringify(state)); }
  function set(k, v) {
    state[k] = v; save(); apply();
    if (k === 'sound' && Arcade.audio) Arcade.audio.setMuted(!v);
    /* 背景乐已下线：music 只作为历史存档字段保留，不再驱动任何播放器 */
  }

  return { get: get, set: set, THEMES: THEMES };
})();

/* B3：存储写入失败一次性提示（隐私模式/配额满），会话内仅提示一次 */
setTimeout(function () {
  try {
    if (Arcade.storage && Arcade.storage.hasWriteError && Arcade.storage.hasWriteError() &&
        Arcade.ui && Arcade.ui.toast) {
      Arcade.ui.toast(Arcade.i18n.t('settings.storageWarn'), 'err');
    }
  } catch (e) {}
}, 4000);

/* ---------------- 音效：WebAudio 程序化合成 ---------------- */
Arcade.audio = (function () {
  var ctx = null;
  var muted = !Arcade.settings.get().sound;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }

  function tone(freq, dur, type, vol, delay) {
    if (!ctx || muted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.14, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  var LIB = {
    move:   function () { tone(330, 0.06, 'square', 0.08); },
    rotate: function () { tone(440, 0.05, 'square', 0.08); },
    drop:   function () { tone(180, 0.10, 'sawtooth', 0.10); },
    match:  function () { tone(660, 0.08, 'triangle', 0.12); tone(880, 0.10, 'triangle', 0.10, 0.05); },
    clear:  function () { tone(523, 0.07, 'square', 0.12); tone(784, 0.09, 'square', 0.12, 0.06); tone(1046, 0.12, 'square', 0.10, 0.12); },
    coin:   function () { tone(988, 0.06, 'square', 0.12); tone(1318, 0.10, 'square', 0.10, 0.05); },
    win:    function () { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.14, i * 0.09); }); },
    lose:   function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.22, 'sawtooth', 0.12, i * 0.13); }); },
    ui:     function () { tone(550, 0.04, 'square', 0.06); },
    back:   function () { tone(300, 0.06, 'square', 0.06); },
    error:  function () { tone(160, 0.14, 'sawtooth', 0.12); tone(120, 0.18, 'sawtooth', 0.10, 0.08); },
    type:   function () { tone(720, 0.025, 'square', 0.05); },
    merge:  function () { tone(392, 0.07, 'triangle', 0.12); tone(587, 0.09, 'triangle', 0.10, 0.06); tone(784, 0.12, 'triangle', 0.08, 0.12); },
    daily:  function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.16, 'square', 0.12, i * 0.08); }); },
    record: function () { [659, 784, 988, 1318, 1568].forEach(function (f, i) { tone(f, 0.20, 'square', 0.13, i * 0.07); tone(f * 2, 0.16, 'sine', 0.05, i * 0.07); }); }
  };

  /* 触感反馈：音效名 → 震动模式（ms / 模式数组）；随设置面板 haptic 开关与设备能力 */
  var VIB = {
    move: 8, rotate: 8, select: 8, flip: 8, type: 6, ui: 10, back: 8,
    drop: 15, match: [12, 30, 12], clear: [12, 30, 12], coin: [12, 30, 12],
    win: [20, 40, 20, 40, 30], record: [20, 40, 20, 40, 30], daily: [15, 30, 15, 30, 15],
    lose: [30, 30], error: [30, 30]
  };
  /* E2E 修复：Chrome 要求 navigator.vibrate 必须发生在用户手势之后，
     否则记为 console error —— 加「已交互」门控，同时消除真机控制台噪音 */
  var userGestured = false;
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, function () { userGestured = true; }, { passive: true });
  });
  function vibrate(name) {
    try {
      if (!userGestured || !navigator.vibrate || !Arcade.settings.get().haptic) return;
      var p = VIB[name];
      if (p) navigator.vibrate(p);
    } catch (e) {}
  }

  function play(name) { ensure(); var fn = LIB[name]; if (fn) fn(); vibrate(name); }
  function setMuted(m) { muted = !!m; }
  function isMuted() { return muted; }

  function unlock() { ensure(); }
  if (window.addEventListener) {
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  return { play: play, setMuted: setMuted, isMuted: isMuted, ensure: ensure };
})();

/* ---------------- 特效：粒子 / 闪光 / 屏震 ---------------- */
Arcade.fx = (function () {
  var layer = null;
  function getLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'arcade-fx-layer';
    document.body.appendChild(layer);
    return layer;
  }
  function reduced() { return Arcade.settings.get().reducedMotion; }

  function burst(x, y, color, count) {
    if (reduced()) return;
    var L = getLayer();
    count = count || 18;
    var parts = [];
    for (var i = 0; i < count; i++) {
      var s = document.createElement('span');
      s.className = 'fx-particle';
      s.style.background = color || 'var(--accent)';
      L.appendChild(s);
      var ang = Math.random() * Math.PI * 2;
      var sp = 2 + Math.random() * 5;
      parts.push({ el: s, x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, life: 1 });
    }
    var start = performance.now();
    function step(now) {
      var alive = false;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.life <= 0) continue;
        alive = true;
        p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        p.el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(' + p.life + ')';
        p.el.style.opacity = p.life;
        if (p.life <= 0 && p.el.parentNode) p.el.parentNode.removeChild(p.el);
      }
      if (alive) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function flash(color) {
    if (reduced()) return;
    var L = getLayer();
    var f = document.createElement('div');
    f.className = 'fx-flash';
    f.style.background = color || 'var(--accent)';
    L.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 420);
  }

  function shake(el) {
    if (reduced() || !el) return;
    el.classList.remove('fx-shake');
    void el.offsetWidth;
    el.classList.add('fx-shake');
  }

  function centerBurst(color, count) {
    burst(window.innerWidth / 2, window.innerHeight / 2, color, count);
  }

  return { burst: burst, flash: flash, shake: shake, centerBurst: centerBurst };
})();

/* ---------------- UI：toast / 快捷图标条（音效/音乐/语言/主题） ---------------- */
Arcade.ui = (function () {
  var bar = null, toastBox = null, navHost = null; // navHost: 是否注入导航条右侧（供搜索路径判断）

  function ensureToast() {
    if (toastBox) return toastBox;
    toastBox = document.createElement('div');
    toastBox.id = 'arcade-toast';
    toastBox.setAttribute('aria-live', 'polite'); /* E6：读屏可感知 */
    toastBox.setAttribute('role', 'status');
    document.body.appendChild(toastBox);
    return toastBox;
  }
  function toast(msg, type, onClick, iconClass) {
    var box = ensureToast();
    var t = document.createElement('div');
    t.className = 'toast-item' + (type ? ' ' + type : '') + (onClick ? ' tappable' : '');
    if (iconClass) {
      var ic = document.createElement('span');
      ic.className = 'ui-ic ' + iconClass;
      ic.setAttribute('aria-hidden', 'true');
      t.appendChild(ic);
      t.appendChild(document.createTextNode(' ' + msg));
    } else {
      t.textContent = msg;
    }
    if (onClick) t.addEventListener('click', onClick);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 3200);
  }

  /* ---------- 快捷图标条：音效 / 音乐 / 语言 / 主题 ----------
     优先注入顶部导航条右侧容器（#arcade-quickbar 由 nav.js 创建）；
     无导航的页面（游戏页）：先挂到 body，等 shell.js 注入顶栏后并入
     .shell-header（共享层修复：不再固定悬浮压住游戏首行 HUD）。 */
  function ensureQuickbar() {
    if (bar) return;
    var T = Arcade.i18n ? Arcade.i18n.t : function (k) { return k; };
    var s = Arcade.settings.get();

    navHost = document.getElementById('arcade-quickbar');
    bar = navHost || document.createElement('div');
    if (!navHost) bar.id = 'arcade-quickbar';
    if (navHost) document.body.classList.add('has-nav');

    // 音效
    var soundBtn = document.createElement('button');
    soundBtn.className = 'qb-btn' + (s.sound ? '' : ' off');
    soundBtn.setAttribute('aria-label', T('settings.sound'));
    soundBtn.title = T('settings.sound');
    soundBtn.innerHTML = '<span class="qb-tip">' + T('settings.sound') + '</span>';
    soundBtn.addEventListener('click', function () {
      var v = !Arcade.settings.get().sound;
      Arcade.settings.set('sound', v);
      soundBtn.classList.toggle('off', !v);
      soundBtn.innerHTML = '<span class="qb-tip">' + T('settings.sound') + '</span>';
      if (v) Arcade.audio.play('ui');
    });
    bar.appendChild(soundBtn);

    // 音乐：背景乐已整体下线，按钮保留 DOM 位次（顶栏图标按 nth-child 映射）
    // 但统一由 family-ui.css 隐藏，不再出现在任何游戏页 UI 中。
    var musicBtn = document.createElement('button');
    musicBtn.className = 'qb-btn qb-music' + (s.music ? '' : ' off');
    musicBtn.setAttribute('aria-label', T('settings.music'));
    musicBtn.title = T('settings.music');
    musicBtn.innerHTML = '<span class="qb-tip">' + T('settings.music') + '</span>';
    musicBtn.addEventListener('click', function () {
      var v = !Arcade.settings.get().music;
      Arcade.settings.set('music', v);
      musicBtn.classList.toggle('off', !v);
      if (Arcade.audio) Arcade.audio.play('ui');
    });
    bar.appendChild(musicBtn);

    // 语言：按钮文字 = 目标语言（当前 zh → EN，当前 en → 中），悬浮提示同义
    var langBtn = document.createElement('button');
    langBtn.className = 'qb-btn qb-lang';
    langBtn.setAttribute('aria-label', T('settings.language'));
    langBtn.title = T('settings.language');
    var toZh = Arcade.i18n.getLang() === 'en';
    langBtn.innerHTML = (toZh ? '中' : 'EN') + '<span class="qb-tip">' + (toZh ? '中文' : 'English') + '</span>';
    langBtn.addEventListener('click', function () {
      var next = Arcade.i18n.getLang() === 'zh' ? 'en' : 'zh';
      Arcade.i18n.setLang(next); // reload
    });
    bar.appendChild(langBtn);

    // 主题：点击按 THEMES 顺序循环切换（街机霓虹 → 晨光档案 → 街机霓虹）
    var themeBtn = document.createElement('button');
    themeBtn.className = 'qb-btn';
    themeBtn.setAttribute('aria-label', T('settings.theme'));
    themeBtn.title = T('settings.theme');
    themeBtn.innerHTML = '<span class="qb-tip">' + T('theme.' + Arcade.settings.get().theme) + '</span>';
    themeBtn.addEventListener('click', function () {
      var cur = Arcade.settings.get().theme;
      var themes = Arcade.settings.THEMES;
      var i = themes.indexOf(cur);
      var next = themes[(i + 1) % themes.length];
      Arcade.settings.set('theme', next);
      // 提示显示在图标旁（qb-tip 短暂亮起显示主题名）
      var tip = themeBtn.querySelector('.qb-tip');
      if (tip) {
        tip.textContent = T('theme.' + next);
        tip.classList.add('show');
        clearTimeout(themeBtn._tipTimer);
        themeBtn._tipTimer = setTimeout(function () { tip.classList.remove('show'); }, 1600);
      }
      if (Arcade.audio) Arcade.audio.play('ui');
    });
    bar.appendChild(themeBtn);

    // 搜索：游戏搜索浮层
    var searchBtn = document.createElement('button');
    searchBtn.className = 'qb-btn';
    searchBtn.setAttribute('aria-label', T('settings.search'));
    searchBtn.title = T('settings.search');
    searchBtn.innerHTML = '<span class="qb-tip">' + T('settings.search') + '</span>';
    searchBtn.addEventListener('click', function () {
      openSearch();
      if (Arcade.audio) Arcade.audio.play('ui');
    });
    bar.appendChild(searchBtn);

    // 触感：震动反馈开关（仅触屏设备显示——桌面 API 存在但无硬件意义）
    var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
    if (navigator.vibrate && isTouch) {
      var hapBtn = document.createElement('button');
      hapBtn.className = 'qb-btn' + (s.haptic ? '' : ' off');
      hapBtn.setAttribute('aria-label', T('settings.haptic'));
      hapBtn.title = T('settings.haptic');
      hapBtn.innerHTML = '<span class="qb-tip">' + T('settings.haptic') + '</span>';
      hapBtn.addEventListener('click', function () {
        var v = !Arcade.settings.get().haptic;
        Arcade.settings.set('haptic', v);
        hapBtn.classList.toggle('off', !v);
        hapBtn.innerHTML = '<span class="qb-tip">' + T('settings.haptic') + '</span>';
        if (v) { try { navigator.vibrate(20); } catch (e) {} }
        if (Arcade.audio) Arcade.audio.play('ui');
      });
      bar.appendChild(hapBtn);
    }

    if (!navHost) {
      document.body.appendChild(bar);
      /* 顶栏由 shell.js 同步注入；此处在它出现后立刻把快捷条并入顶栏。
         并入后成为普通流式 flex 项，窄屏随顶栏换行，不再覆盖游戏内容。 */
      var attachToHeader = function () {
        if (!bar || !bar.parentNode || navHost) return true;
        var header = document.querySelector('.shell-header');
        if (!header || bar.parentNode === header) return false;
        header.appendChild(bar);
        document.body.classList.add('has-header-quickbar');
        return true;
      };
      attachToHeader();
      if (!document.body.classList.contains('has-header-quickbar') && 'MutationObserver' in window) {
        var mo = new MutationObserver(function () {
          if (attachToHeader()) mo.disconnect();
        });
        mo.observe(document.body, { childList: true });
      }
      /* 兜底（极少数顶栏延后注入的页面）：DOM 就绪后再试一次 */
      document.addEventListener('DOMContentLoaded', function () { attachToHeader(); });
    }
  }

  /* ---------- 游戏搜索浮层 ---------- */
  var searchOv = null, searchInput = null, searchList = null;

  function openSearch() {
    if (!searchOv) buildSearch();
    // 已打开则再点关闭（toggle）
    if (searchOv.classList.contains('open')) { closeSearch(); return; }
    searchOv.classList.add('open');
    searchOv.style.display = 'flex'; // 内联强制显示（防 CSS 干扰）
    lastSearchFocus = document.activeElement; /* E2：焦点归还目标 */
    if (searchInput) setTimeout(function () { searchInput.focus(); }, 30);
  }
  function closeSearch() {
    if (searchOv) {
      searchOv.classList.remove('open');
      searchOv.style.display = 'none'; // 内联强制隐藏（防 CSS 干扰/残留）
      /* E2：焦点归还触发按钮（搜索浮层 a11y） */
      try { if (lastSearchFocus && lastSearchFocus.focus) lastSearchFocus.focus(); } catch (e) {}
      lastSearchFocus = null;
    }
  }
  var lastSearchFocus = null;

  function buildSearch() {
    var T = Arcade.i18n ? Arcade.i18n.t : function (k) { return k; };
    searchOv = document.createElement('div');
    searchOv.className = 'search-overlay';
    /* E2 a11y：对话框语义 + 键盘可达 */
    searchOv.setAttribute('role', 'dialog');
    searchOv.setAttribute('aria-modal', 'true');
    searchOv.setAttribute('aria-label', T('search.title'));
    searchOv.innerHTML =
      '<div class="search-box">' +
      '  <div class="search-head"><span class="ui-ic ic-search" aria-hidden="true"></span> ' + T('search.title') + '<button class="search-close" aria-label="' + T('common.close') + '">✕</button></div>' +
      '  <input class="search-input" type="search" placeholder="' + T('search.ph') + '" autocomplete="off">' +
      '  <div class="search-hint">' + T('search.hint') + '</div>' +
      '  <div class="search-results"></div>' +
      '</div>';
    document.body.appendChild(searchOv);
    searchInput = searchOv.querySelector('.search-input');
    searchList = searchOv.querySelector('.search-results');
    var box = searchOv.querySelector('.search-box');

    /* E2：结果列表 ↑↓ 导航的高亮样式（注入一次） */
    if (!document.getElementById('arcade-sr-style')) {
      var st = document.createElement('style');
      st.id = 'arcade-sr-style';
      st.textContent = '.search-results a.sr-active{outline:2px solid var(--neon-cyan);outline-offset:-2px;background:rgba(0,240,255,.08)}';
      document.head.appendChild(st);
    }

    searchOv.querySelector('.search-close').addEventListener('click', closeSearch);
    // 点击搜索框外任意处关闭（不只遮罩自身，兼容 box 边缘空隙）
    searchOv.addEventListener('click', function (e) {
      if (!box.contains(e.target)) closeSearch();
    });
    /* E2：↑↓ 在结果间移动高亮，Enter 跟随当前高亮项（无高亮则取第一个） */
    function activeLink() { return searchList.querySelector('a.sr-active'); }
    function moveActive(dir) {
      var links = searchList.querySelectorAll('a');
      if (!links.length) return;
      var cur = activeLink();
      var next;
      if (!cur) next = links[dir > 0 ? 0 : links.length - 1];
      else {
        var idx = Array.prototype.indexOf.call(links, cur);
        next = links[Math.min(links.length - 1, Math.max(0, idx + dir))];
        if (cur) cur.classList.remove('sr-active');
      }
      next.classList.add('sr-active');
      try { next.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); return; }
      if (e.key === 'Enter' && e.target.value.trim()) {
        var go = activeLink() || searchList.querySelector('a');
        if (go) window.location.href = go.getAttribute('href');
      }
    });
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      if (!q) { searchList.innerHTML = ''; return; }
      // 120ms 防抖：停止输入后才执行搜索
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchList.innerHTML = doSearch(q, T);
      }, 120);
    });
  }

  /* 全局 Esc 关闭搜索（焦点任意处都生效，一次性绑定） */
  if (!window.__arcadeSearchEscBound) {
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && Arcade.ui && Arcade.ui.closeSearch) Arcade.ui.closeSearch();
    });
    window.__arcadeSearchEscBound = true;
  }

  /* E1 全局热键：Ctrl/Cmd+K 或 / 开搜索；R 重开（游戏页）；T 教程（游戏页）。
     输入框/富文本内不劫持任何单字符键。 */
  if (!window.__arcadeHotkeysBound) {
    window.addEventListener('keydown', function (e) {
      var tag = ((e.target && e.target.tagName) || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || !!(e.target && e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (Arcade.ui && Arcade.ui.toggleSearch) Arcade.ui.toggleSearch();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return; /* 按住不连发 */
      /* 浮层开启时 R/T 短路，避免隔层误操作底层游戏 */
      if (document.querySelector('.tut-overlay') || (searchOv && searchOv.classList.contains('open'))) return;
      if (e.key === '/') {
        /* '/' 仅在非游戏页启用（游戏页用 Ctrl+K 或搜索按钮） */
        if (!document.body.hasAttribute('data-game-id')) {
          e.preventDefault();
          if (Arcade.ui && Arcade.ui.toggleSearch) Arcade.ui.toggleSearch();
        }
        return;
      }
      if (typeof window.GAME_RESTART === 'function' && (e.key === 'r' || e.key === 'R')) {
        window.GAME_RESTART();
        return;
      }
      if ((e.key === 't' || e.key === 'T') && Arcade.shell && Arcade.shell.showTutorial) {
        Arcade.shell.showTutorial();
      }
    });
    window.__arcadeHotkeysBound = true;
  }

  /* 检索游戏（大小写不敏感，匹配标题/描述/id） */
  function doSearch(q, T) {
    var html = '';
    var any = false;
    // 跨层链接前缀：nav.js 已按页面目录算好（'' 根目录 / '../' 游戏厅 / '../../' 游戏页）
    var up = (typeof window.__arcadePagePrefix === 'string') ? window.__arcadePagePrefix : (navHost ? '' : '../../');

    // ① 游戏（注册表动态）
    if (window.GAMES) {
      var gRes = window.GAMES.filter(function (g) {
        var t = (T('g.' + g.id + '.t') || '').toLowerCase();
        var d = (T('g.' + g.id + '.d') || '').toLowerCase();
        return t.indexOf(q) >= 0 || d.indexOf(q) >= 0 || g.id.indexOf(q) >= 0;
      });
      if (gRes.length) {
        any = true;
        html += '<div class="search-group">' + T('search.games') + ' <span>' + gRes.length + '</span></div>';
        gRes.slice(0, 8).forEach(function (g) {
          html += '<a class="search-item" href="' + up + g.path + '">' +
            '<span class="si-ic">' + g.icon + '</span>' +
            '<span class="si-t">' + T('g.' + g.id + '.t') + '</span>' +
            '<span class="si-d">' + (T('g.' + g.id + '.d') || '').slice(0, 36) + '</span></a>';
        });
      }
    }

    if (!any) html = '<div class="search-empty">' + T('search.empty') + '</div>';
    return html;
  }

  /* 共享阶段约定：结算/暂停浮层显示时隐藏底部同义控制条
     phase: 'playing' | 'overlay'（overlay 也接受 'pause' / 'result' 别名） */
  function setGamePhase(phase) {
    var isOverlay = phase === 'overlay' || phase === 'pause' || phase === 'result';
    if (document.body) {
      document.body.classList.toggle('game-phase-overlay', isOverlay);
      document.body.setAttribute('data-game-phase', isOverlay ? 'overlay' : 'playing');
    }
  }

  return { toast: toast, ensureQuickbar: ensureQuickbar, closeSearch: closeSearch, toggleSearch: openSearch, setGamePhase: setGamePhase };
})();

/* ---------------- 教程浮层 ---------------- */
Arcade.tutorial = (function () {
  var KEYP = 'arcade_tut_';

  /* 无障碍（plan-3 P4.1）：浮层焦点管理——Esc 关闭 / 焦点入浮层 / Tab 圈定 */
  function makeAccessible(overlay) {
    var lastFocus = document.activeElement;
    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', onKey, true);
      try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    }
    function focusables() {
      return overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    overlay.closeA11y = close;
    setTimeout(function () {
      var f = focusables();
      if (f.length) { try { f[0].focus(); } catch (e) {} }
    }, 30);
  }


  function show(steps, opts) {
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.className = 'tut-overlay';
    var html = '<div class="tut-modal">' +
      '  <div class="tut-title">' + (opts.title || T('extras.tutDefaultTitle')) + '</div>' +
      '  <ul class="tut-list">';
    steps.forEach(function (st) {
      html += '<li><b>' + st.t + '</b>' + (st.d ? '<span>' + st.d + '</span>' : '') + '</li>';
    });
    html += '</ul>' +
      '  <button class="btn green tut-start">' + T('extras.tutStart') + '</button>' +
      '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    makeAccessible(overlay);
    overlay.querySelector('.tut-start').addEventListener('click', function () {
      if (overlay.closeA11y) overlay.closeA11y(); else if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (opts.onStart) opts.onStart();
    });
  }

  function auto(id, steps, opts) {
    opts = opts || {};
    var seen = false;
    try { seen = localStorage.getItem(KEYP + id) === '1'; } catch (e) {}
    if (seen) { if (opts.onStart) opts.onStart(); return; }
    show(steps, {
      title: opts.title || T('extras.tutDefaultTitle'),
      onStart: function () {
        try { localStorage.setItem(KEYP + id, '1'); } catch (e) {}
        if (opts.onStart) opts.onStart();
      }
    });
  }

  return { show: show, auto: auto };
})();

/* ---------------- 调味：统一的音效 + 特效封装 ----------------
   各游戏只调用语义化方法，无需关心底层音频/粒子细节
   坐标参数 (x,y) 为『屏幕像素坐标系』（canvas 游戏用 getBoundingClientRect 换算）  */
Arcade.juice = (function () {
  function A(name) { if (Arcade.audio) Arcade.audio.play(name); }
  function burstAt(x, y, color, count) {
    if (!Arcade.fx) return;
    if (x != null && y != null) Arcade.fx.burst(x, y, color, count);
    else Arcade.fx.centerBurst(color, count);
  }
  return {
    move:   function () { A('move'); },
    rotate: function () { A('rotate'); },
    drop:   function () { A('drop'); },
    select: function () { A('ui'); },
    flip:   function () { A('ui'); },
    merge:  function (x, y, color) { A('match'); burstAt(x, y, color || 'var(--accent)', 10); },
    clear:  function (x, y, color, count) { A('clear'); burstAt(x, y, color || 'var(--accent)', count || 16); },
    coin:   function (x, y, color) { A('coin'); burstAt(x, y, color || 'var(--neon-yellow)', 12); },
    win:    function (x, y) {
      A('win');
      if (Arcade.fx) { burstAt(x, y, 'var(--neon-yellow)', 28); Arcade.fx.flash('var(--neon-yellow)'); }
    },
    lose:   function () { A('lose'); if (Arcade.fx) Arcade.fx.shake(document.body); },
    ok:     function () { A('win'); }
  };
})();

/* 快捷图标条由页面脚本触发：
   - 有全局导航的页面：nav.js 在渲染导航后调用 Arcade.ui.ensureQuickbar()（注入导航右侧）
   - 游戏页：shell.js 注入块加载完成后调用（无导航 → 右上角悬浮） */
