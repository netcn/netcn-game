/* ============================================================
   hall-ui.js —— 顶栏筛选项 / 悬停提示 / 选中信息卡 / 加载进度 / 2D 降级
   ============================================================ */
window.HallUI = (function () {
  'use strict';

  var I18N = {
    zh: {
      all: '全部', cat: '分类', lv: '难度',
      easy: '轻松', mid: '进阶', hard: '硬核',
      search: '搜索游戏…（斜杠 / 聚焦）',
      count: '款', games: '款游戏',
      best: '最高分', enter: '开始游戏', close: '关闭', goView: '返回总览',
      click: '点击机柜 · 直接进入', tap: '双击或按下方按钮进入',
      fbTitle: 'ARCADE INDEX', fbNote: '当前设备不支持 WebGL，已切换 2D 列表',
      hint: '<kbd>拖动</kbd> 旋转 · <kbd>滚轮</kbd> 缩放 · <kbd>←→↑↓</kbd> 选机柜 · <kbd>Enter</kbd> 进入 · <kbd>Esc</kbd> 总览 · <kbd>/</kbd> 搜索',
      loadMsg: '正在点亮霓虹街区…'
    },
    en: {
      all: 'ALL', cat: 'GENRE', lv: 'LEVEL',
      easy: 'Easy', mid: 'Medium', hard: 'Hard',
      search: 'Search games… ( / to focus )',
      count: '', games: 'games',
      best: 'BEST', enter: 'PLAY', close: 'Close', goView: 'Overview',
      click: 'Click a cabinet to play', tap: 'Tap again, or use the button below',
      fbTitle: 'ARCADE INDEX', fbNote: 'WebGL unavailable — showing the 2D list',
      hint: '<kbd>Drag</kbd> orbit · <kbd>Wheel</kbd> zoom · <kbd>Arrows</kbd> choose · <kbd>Enter</kbd> play · <kbd>Esc</kbd> overview · <kbd>/</kbd> search',
      loadMsg: 'Lighting up the neon street…'
    }
  };

  var opts = {};
  var lang = 'zh';
  var games = [];
  var cats = [];
  var colorOf = function () { return 0x00f0ff; };
  var bestOf = function () { return null; };
  var state = { cat: null, lvl: null, kw: '' };
  var panel = null, tip = null, currentCard = null;
  var lastVis = [];

  /* ---------- 状态 ---------- */
  function matches(g) {
    if (state.cat && g.category !== state.cat) return false;
    if (state.lvl && g.lvl !== state.lvl) return false;
    if (state.kw) {
      var hay = (g.title + ' ' + g.desc + ' ' + g.category + ' ' + g.id).toLowerCase();
      if (hay.indexOf(state.kw) < 0) return false;
    }
    return true;
  }

  function visible() {
    var out = [];
    for (var i = 0; i < games.length; i++) if (matches(games[i])) out.push(games[i]);
    return out;
  }

  function lvName(k) { return I18N[lang][k] || k; }
  function t(k) { return I18N[lang][k] || k; }

  /* ---------- 筛选条 ---------- */
  function buildFilters() {
    var catRow = document.getElementById('cat-row');
    var lvlRow = document.getElementById('lvl-row');
    if (!catRow || !lvlRow) return;
    catRow.innerHTML = '';
    lvlRow.innerHTML = '';

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'chip';
    allBtn.dataset.role = 'all';
    allBtn.innerHTML = '<span class="dot" style="color:#9fb4cc;background:#9fb4cc"></span><span class="lb">' + t('all') + '</span><span class="n">' + games.length + '</span>';
    allBtn.addEventListener('click', function () {
      state.cat = null;
      syncChips();
      opts.onChange && opts.onChange(state, visible());
    });
    catRow.appendChild(allBtn);

    cats.forEach(function (cn) {
      var n = games.filter(function (g) { return g.category === cn; }).length;
      var col = colorOf({ category: cn });
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.cat = cn;
      b.innerHTML = '<span class="dot" style="color:' + hex(col) + ';background:' + hex(col) + '"></span>' +
        '<span class="lb">' + cn + '</span><span class="n">' + n + '</span>';
      b.addEventListener('click', function () {
        /* 单类筛选取代多选排除：点某一类=只看这一类，再点一次回到全部 */
        state.cat = state.cat === cn ? null : cn;
        syncChips();
        opts.onChange && opts.onChange(state, visible());
      });
      catRow.appendChild(b);
    });

    ['easy', 'mid', 'hard'].forEach(function (lv) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.lvl = lv;
      b.innerHTML = '<span class="lb">' + lvName(lv) + '</span>';
      b.addEventListener('click', function () {
        state.lvl = state.lvl === lv ? null : lv;
        syncChips();
        opts.onChange && opts.onChange(state, visible());
      });
      lvlRow.appendChild(b);
    });
    syncChips();
  }

  function syncChips() {
    var catRow = document.getElementById('cat-row');
    if (catRow) {
      var children = catRow.querySelectorAll('.chip');
      for (var i = 0; i < children.length; i++) {
        var cn = children[i].dataset.cat;
        if (!cn) {
          children[i].classList.toggle('on', !state.cat);
        } else {
          children[i].classList.toggle('on', state.cat === cn);
          children[i].classList.toggle('off', !!state.cat && state.cat !== cn);
        }
      }
    }
    var lvlRow = document.getElementById('lvl-row');
    if (lvlRow) {
      var lcs = lvlRow.querySelectorAll('.chip');
      for (var j = 0; j < lcs.length; j++) {
        lcs[j].classList.toggle('on', state.lvl === lcs[j].dataset.lvl);
      }
    }
    var total = document.getElementById('s-total');
    if (total) total.textContent = String(visible().length);
  }

  function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }

  /* ---------- 搜索 ---------- */
  var debTimer = null;
  function bindSearch() {
    var q = document.getElementById('q');
    if (!q) return;
    q.placeholder = t('search');
    q.addEventListener('input', function () {
      clearTimeout(debTimer);
      debTimer = setTimeout(function () {
        state.kw = q.value.trim().toLowerCase();
        syncChips();
        opts.onChange && opts.onChange(state, visible());
      }, 140);
    });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var list = visible();
        if (list.length) opts.onSearchEnter && opts.onSearchEnter(list[0]);
      } else if (e.key === 'Escape') {
        q.value = '';
        state.kw = '';
        q.blur();
        syncChips();
        opts.onChange && opts.onChange(state, visible());
      }
    });
    q.id = 'q';
  }

  /* ---------- 信息卡 ---------- */
  function fillCard(g) {
    if (!panel) return;
    var best = bestOf(g);
    panel.innerHTML =
      '<div class="p-top">' +
        '<span class="p-ic">' + (g.icon || '🎮') + '</span>' +
        '<div class="p-id"><div class="p-name">' + esc(g.title) + '</div>' +
          '<div class="p-sub"><span class="badge" style="color:' + hex(colorOf(g)) + ';border-color:' + hex(colorOf(g)) + '66;background:' + hex(colorOf(g)) + '14">' + esc(g.category) + '</span>' +
          '<span class="badge">' + esc(lvName(g.lvl)) + '</span>' +
          '<span class="badge">' + esc(g.time || '') + '</span></div></div>' +
        '<button class="p-x" type="button" aria-label="' + t('close') + '">✕</button>' +
      '</div>' +
      '<div class="p-best"><span>' + t('best') + '</span><b class="' + (best === null ? 'none' : '') + '">' + (best === null ? '----' : best) + '</b></div>' +
      '<p class="p-desc">' + esc(g.desc) + '</p>' +
      '<div class="p-actions"><a class="btn p-go" href="' + esc(g.path) + '">▸ ' + t('enter') + '</a></div>';
    var x = panel.querySelector('.p-x');
    if (x) x.addEventListener('click', function () { hideCard(); opts.onClose && opts.onClose(); });
    var go = panel.querySelector('.p-go');
    if (go) go.addEventListener('click', function (e) {
      if (opts.onEnter) { e.preventDefault(); opts.onEnter(g); }
    });
  }

  function showCard(g) {
    if (!panel) panel = document.getElementById('panel');
    currentCard = g;
    fillCard(g);
    panel.classList.add('on');
  }
  function hideCard() {
    if (panel) panel.classList.remove('on');
    currentCard = null;
  }
  function refreshCard() { if (currentCard) fillCard(currentCard); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 悬停提示 ---------- */
  function showTip(g, x, y) {
    if (!tip) tip = document.getElementById('tip');
    if (!tip) return;
    var best = bestOf(g);
    tip.innerHTML =
      '<div class="t-cat">' + esc(g.category) + ' · ' + esc(lvName(g.lvl)) + ' · ' + esc(g.time) + '</div>' +
      '<div class="t-name">' + (g.icon || '') + ' ' + esc(g.title) + '</div>' +
      '<div class="t-desc">' + esc(g.desc) + '</div>' +
      (best === null ? '' : '<div class="t-best">BEST ' + best + '</div>') +
      '<div class="t-go">' + t('click') + '</div>';
    tip.classList.add('on');
    moveTip(x, y);
  }
  function moveTip(x, y) {
    if (!tip || !tip.classList.contains('on')) return;
    var w = tip.offsetWidth || 260, h = tip.offsetHeight || 120;
    var vw = window.innerWidth, vh = window.innerHeight;
    var tx = x + 18, ty = y + 16;
    if (tx + w > vw - 10) tx = x - w - 18;
    if (ty + h > vh - 10) ty = y - h - 18;
    if (tx < 8) tx = 8;
    if (ty < 8) ty = 8;
    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('on'); }

  /* ---------- 加载 ---------- */
  function setProgress(pct, msg) {
    var fill = document.getElementById('l-fill');
    var num = document.getElementById('l-pct');
    var m = document.getElementById('l-msg');
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (num) num.textContent = Math.round(pct) + '%';
    if (m && msg) m.textContent = msg;
  }
  function finishLoad(cb) {
    var el = document.getElementById('load');
    if (!el) { cb && cb(); return; }
    el.classList.add('gone');
    setTimeout(function () { el.style.display = 'none'; cb && cb(); }, 700);
  }

  /* ---------- 2D 降级 ---------- */
  var fallbackMode = false;
  function renderFallback() {
    var grid = document.getElementById('fb-grid');
    var cnt = document.getElementById('fb-count');
    if (!grid) return;
    var vis = visible();
    lastVis = vis;
    grid.innerHTML = vis.map(function (g) {
      var c = hex(colorOf(g));
      var best = bestOf(g);
      return '<a class="fb-card" href="' + esc(g.path) + '" style="border-left-color:' + c + '">' +
        '<div class="fb-t"><span class="fb-ic">' + (g.icon || '🎮') + '</span>' +
        '<span class="fb-n">' + esc(g.title) + '</span></div>' +
        '<div class="fb-d">' + esc(g.desc) + '</div>' +
        '<div class="fb-m"><span class="badge" style="color:' + c + ';border-color:' + c + '66">' + esc(g.category) + '</span>' +
        '<span class="badge">' + esc(lvName(g.lvl)) + '</span>' +
        (best === null ? '' : '<span class="fb-best">' + best + '</span>') + '</div></a>';
    }).join('');
    if (cnt) cnt.textContent = vis.length + ' / ' + games.length + ' ' + t('games');
  }

  function showFallback(reason) {
    fallbackMode = true;
    document.body.classList.remove('mode-3d');
    document.body.classList.add('mode-2d');
    var fb = document.getElementById('fallback');
    if (fb) fb.hidden = false;
    hideCard(); hideTip();
    var load = document.getElementById('load');
    if (load) { load.classList.add('gone'); load.style.display = 'none'; }
    var note = document.getElementById('fb-count');
    if (note && reason) note.setAttribute('data-reason', reason);
    renderFallback();
  }

  /* ---------- 语言 ---------- */
  function applyLang(next) {
    lang = next;
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    document.body.classList.toggle('lang-en', next === 'en');
    var btn = document.getElementById('lang');
    if (btn) { btn.textContent = next === 'zh' ? 'EN' : '中'; btn.setAttribute('aria-label', next === 'zh' ? 'Switch to English' : '切换到中文'); }
    var q = document.getElementById('q');
    if (q) q.placeholder = t('search');
    var titles = document.querySelectorAll('.lg-title');
    if (titles[0]) titles[0].textContent = t('cat');
    if (titles[1]) titles[1].textContent = t('lv');
    var allLb = document.querySelector('#cat-row .lb');
    if (allLb) allLb.textContent = t('all');
    var lvBtns = document.querySelectorAll('#lvl-row .chip');
    for (var i = 0; i < lvBtns.length; i++) {
      var lb = lvBtns[i].querySelector('.lb');
      if (lb) lb.textContent = lvName(lvBtns[i].dataset.lvl);
    }
    var hint = document.getElementById('hint');
    if (hint) hint.innerHTML = t('hint');
    refreshCard();
    if (fallbackMode) renderFallback();
  }

  /* ---------- 初始化 ---------- */
  function init(o) {
    opts = o || {};
    games = opts.games || window.GAMES || [];
    cats = opts.cats || window.GAME_CATEGORIES || [];
    colorOf = opts.colorOf || colorOf;
    bestOf = opts.bestOf || bestOf;
    lang = opts.lang || 'zh';
    panel = document.getElementById('panel');

    /* 语义化游戏链接（SEO / 读屏） */
    var sr = document.getElementById('sr-games');
    if (sr) {
      sr.innerHTML = games.map(function (g) {
        return '<a href="' + esc(g.path) + '">' + esc(g.title) + '</a>';
      }).join('');
    }

    buildFilters();
    bindSearch();

    var lbtn = document.getElementById('lang');
    if (lbtn) lbtn.addEventListener('click', function () {
      applyLang(lang === 'zh' ? 'en' : 'zh');
      opts.onLang && opts.onLang(lang);
    });
    applyLang(lang);
    syncChips();
    var sc = document.getElementById('s-cat');
    if (sc) sc.textContent = String(cats.length);
    var sd = document.getElementById('s-daily');
    if (sd && window.DAILY_IDS) sd.textContent = String(window.DAILY_IDS.length);
  }

  return {
    init: init,
    matches: matches,
    visible: visible,
    state: state,
    setProgress: setProgress,
    finishLoad: finishLoad,
    showCard: showCard,
    hideCard: hideCard,
    refreshCard: refreshCard,
    showTip: showTip,
    moveTip: moveTip,
    hideTip: hideTip,
    showFallback: showFallback,
    renderFallback: renderFallback,
    applyLang: applyLang,
    lang: function () { return lang; },
    isFallback: function () { return fallbackMode; },
    t: t
  };
})();
