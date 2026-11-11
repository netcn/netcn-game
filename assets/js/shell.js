/* ============================================================
   游戏页共享骨架：运行时注入统一顶栏
   依赖：core/storage.js（先加载）
   页面约定：<body data-game-id="xxx" data-game-title="标题">
   暴露 API：Arcade.shell.submitScore(score) / refreshBest() / flashBest()
             Arcade.shell.setBestMode('min'|'max')
   P0 增强：自动注入 extras（音效/特效/设置/教程），顶栏新增「玩法」，进入即记最近游玩
   ============================================================ */

/* 自动注入扩展基座，游戏页无需逐个改 HTML（相对游戏页解析路径）
   字典已拆分：i18n-dict.js 为站点键（g./公共），游戏内文案 gs.* 按游戏
   拆到 games/<id>/<id>-i18n.js 按需加载（如铁壁防线等无 gs 键的游戏跳过）
   注入方式：按序 DOM 插入经典 <script>（同步执行、保持原有加载时序；替代已废弃的
   document.write，不阻塞解析器，兼容性更好） */
if (!window.__arcadeExtrasLoaded) {
  /* P3/E2E 修复：sync-game-scripts.js 已把依赖链写成静态标签的页面
     （特征：存在 core/i18n.js 静态标签）无需再运行时注入；
     注入保留作兜底，且 async=false 保证注入队列内部按序。 */
  var __staticChain = !!document.querySelector('script[src*="assets/js/core/i18n.js"]');
  var gid = document.body.getAttribute('data-game-id') || '';
  var __arcadeExtras = [
    '../../assets/js/core/i18n.js',
    '../../assets/js/core/i18n-dict.js',
    gid ? gid + '-i18n.js' : '',
    '../../assets/js/core/extras.js',
    '../../assets/js/rank.js',
    '../../assets/js/pwa.js'
  ];
  for (var __i = 0; __i < __arcadeExtras.length && !__staticChain; __i++) {
    if (!__arcadeExtras[__i]) continue;
    var __s = document.createElement('script');
    /* 关键修复（E2E 发现）：动态插入的外链脚本默认 async，执行顺序=下载完成顺序，
       弱网/无缓存下会打乱 i18n→词典→游戏的依赖链导致 T 未定义。
       async=false 强制浏览器按插入顺序执行，恢复与静态标签等价的时序。 */
    __s.async = false;
    __s.src = __arcadeExtras[__i];
    document.head.appendChild(__s);
  }
  window.__arcadeExtrasLoaded = true;
}

/* 游戏页：构建快捷图标条（右上角悬浮：音效/音乐/语言/主题） */
(function () {
  if (window.Arcade && Arcade.ui && Arcade.ui.ensureQuickbar) {
    try { Arcade.ui.ensureQuickbar(); } catch (e) {}
  }
})();

/* 键盘无障碍（D3）：游戏页注入「跳到游戏本体」skip link（游戏页不加载 nav.js） */
(function () {
  try {
    var host = document.getElementById('arcade-nav');
    if (host || !document.getElementById('game-root')) return;
    var skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#game-root';
    var lbl = '跳到游戏';
    if (window.Arcade && Arcade.i18n && Arcade.i18n.t) {
      var v = Arcade.i18n.t('nav.skip');
      if (v && v.indexOf('nav.skip') < 0) lbl = v;
    }
    skip.setAttribute('aria-label', lbl);
    skip.textContent = lbl;
    document.body.insertBefore(skip, document.body.firstChild);
  } catch (e) {}
})();

window.Arcade = window.Arcade || {};

Arcade.shell = (function () {
  var gameId = document.body.getAttribute('data-game-id') || '';
  var gameTitle = document.body.getAttribute('data-game-title') || '游戏';
  var bestMode = document.body.getAttribute('data-best-mode') || 'max';
  var bestEl = null;
  var hasBest = document.body.getAttribute('data-has-best') !== 'false';

  /* 游戏显示名：优先 i18n 翻译名（顶栏/教程/无障碍标签，英文版不显示 data-game-title 中文） */
  function displayName() {
    return Arcade.i18n ? Arcade.i18n.t('g.' + gameId + '.t') : gameTitle;
  }
  /* 教程浮层标题：游戏专属 tutTitle，缺（如铁壁防线用公共 gt.*）则回退「游戏名 · 玩法」 */
  function tutTitle() {
    if (Arcade.i18n) {
      var own = 'gs.' + gameId + '.tutTitle';
      var v = Arcade.i18n.t(own);
      if (v !== own) return v;
      return Arcade.i18n.t('g.' + gameId + '.t') + ' · ' + Arcade.i18n.t('common.help');
    }
    return gameTitle + ' · 玩法';
  }

  /* 动态 <title>：语言切换后跟随当前语言（如「铁壁防线 · 游戏厅」） */
  try {
    if (gameId && Arcade.i18n) {
      document.title = Arcade.i18n.t('g.' + gameId + '.t') + Arcade.i18n.t('app.titleSuffix');
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        var tail = Arcade.i18n.getLang() === 'en'
          ? ' Play instantly — best scores are saved in your browser.'
          : ' 打开即玩，最高分记录保存在本地浏览器。';
        metaDesc.setAttribute('content',
          Arcade.i18n.t('g.' + gameId + '.t') + ' · ' + Arcade.i18n.t('app.title') + ' — ' + Arcade.i18n.t('g.' + gameId + '.d') + tail);
      }
    }
  } catch (e) {}

  function pushRecent() {
    if (!gameId) return;
    try {
      var raw = localStorage.getItem('arcade_recent');
      var arr = raw ? JSON.parse(raw) : [];
      arr = arr.filter(function (x) { return x !== gameId; });
      arr.unshift(gameId);
      if (arr.length > 6) arr = arr.slice(0, 6);
      localStorage.setItem('arcade_recent', JSON.stringify(arr));
    } catch (e) {}
  }

  function showTutorial() {
    if (document.querySelector('.tut-overlay')) return; /* 已开不叠加 */
    var steps = window.GAME_TUTORIAL_STEPS;
    if (!steps || !steps.length) {
      if (Arcade.ui) Arcade.ui.toast(Arcade.i18n ? Arcade.i18n.t('shell.noTutorial') : '该游戏暂未配置教程', 'warn');
      return;
    }
    var opts = { title: tutTitle() };
    if (Arcade.tutorial) Arcade.tutorial.show(steps, opts);
  }

  /** 全局重开：游戏注册 window.GAME_RESTART 则无缝重开，否则整页刷新兜底 */
  function doRestart() {
    if (typeof window.GAME_RESTART === 'function') {
      window.GAME_RESTART();
      if (Arcade.audio) Arcade.audio.play('ui');
      return;
    }
    location.reload();
  }

  function buildHeader() {
    var header = document.createElement('header');
    header.className = 'shell-header';

    var back = document.createElement('a');
    back.className = 'shell-back';
    back.href = '../../index.html';
    back.textContent = Arcade.i18n ? Arcade.i18n.t('shell.lobby') : '◀ 大厅';
    header.appendChild(back);

    var title = document.createElement('div');
    title.className = 'shell-title';
    title.textContent = displayName();
    header.appendChild(title);


    var help = document.createElement('button');
    help.className = 'shell-help';
    help.type = 'button';
    help.textContent = Arcade.i18n ? Arcade.i18n.t('shell.help') : '玩法';
    help.addEventListener('click', showTutorial);
    header.appendChild(help);

    /* ⛶ 全屏：沉浸式游玩（浏览器支持才显示；iOS Safari 不支持则自动隐藏） */
    var canFS = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    if (canFS) {
      var fsBtn = document.createElement('button');
      fsBtn.type = 'button';
      fsBtn.className = 'shell-fs';
      /* 图标与文字分开：宽屏只露图标；收进窄屏「更多」菜单时 CSS 显示文字标签 */
      var fsGlyph = document.createElement('span');
      fsGlyph.className = 'shell-fs-glyph ui-ic ic-fullscreen';
      fsGlyph.setAttribute('aria-hidden', 'true');
      fsGlyph.textContent = '';
      var fsText = document.createElement('span');
      fsText.className = 'shell-fs-label';
      fsBtn.appendChild(fsGlyph);
      fsBtn.appendChild(fsText);
      function fsLabel() {
        var isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        return isFS
          ? (Arcade.i18n ? Arcade.i18n.t('shell.exitFullscreen') : '退出全屏')
          : (Arcade.i18n ? Arcade.i18n.t('shell.fullscreen') : '全屏');
      }
      function updateFs() {
        /* 图标由 CSS mask 绘制，避免文字标签与字形重复出现 */
        fsGlyph.className = 'shell-fs-glyph ui-ic ' +
          ((document.fullscreenElement || document.webkitFullscreenElement) ? 'ic-exitfull' : 'ic-fullscreen');
        fsText.textContent = fsLabel();
        fsBtn.title = fsLabel();
        fsBtn.setAttribute('aria-label', fsLabel());
      }
      fsBtn.title = fsLabel();
      fsBtn.setAttribute('aria-label', fsLabel());
      fsText.textContent = fsLabel();
      fsBtn.addEventListener('click', function () {
        var el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else {
          if (el.requestFullscreen) el.requestFullscreen();
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        }
      });
      document.addEventListener('fullscreenchange', updateFs);
      document.addEventListener('webkitfullscreenchange', updateFs);
      header.appendChild(fsBtn);
    }

    var restart = document.createElement('button');
    restart.className = 'shell-restart';
    restart.type = 'button';
    restart.textContent = Arcade.i18n ? Arcade.i18n.t('shell.restart') : '↻ 重开';
    restart.addEventListener('click', doRestart);
    header.appendChild(restart);

    if (hasBest) {
      bestEl = document.createElement('div');
      bestEl.className = 'shell-best';
      header.appendChild(bestEl);
      refreshBest();
    }

    /* 窄屏「更多」菜单（≤480px）：把 玩法/全屏/重开/BEST 收进下拉，
       顶栏只留「返回 + 标题 + 更多」一行，快捷条独占一行，总高约 104px，
       避免 3 行 153px 顶栏吃掉首屏；宽屏仍按原顺序平铺，不出现该按钮。 */
    var narrow = window.matchMedia ? window.matchMedia('(max-width: 480px)') : { matches: false };

    var moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'shell-more-btn';
    moreBtn.textContent = '⋯';
    var moreLabel = (Arcade.i18n && Arcade.i18n.getLang() === 'en') ? 'More' : '更多';
    moreBtn.title = moreLabel;
    moreBtn.setAttribute('aria-label', moreLabel);
    moreBtn.setAttribute('aria-haspopup', 'true');
    moreBtn.setAttribute('aria-expanded', 'false');

    var panel = document.createElement('div');
    panel.className = 'shell-more-panel';
    panel.setAttribute('role', 'menu');

    var moreWrap = document.createElement('div');
    moreWrap.className = 'shell-more';
    moreWrap.appendChild(moreBtn);

    var movable = [];
    movable.push(help);
    if (canFS) movable.push(fsBtn);
    movable.push(restart);

    function closeMenu() {
      panel.classList.remove('open');
      moreBtn.setAttribute('aria-expanded', 'false');
    }

    /* 窄屏/宽屏切换时在「顶栏」与「下拉面板」之间搬移同一批节点，
       事件监听与 refreshBest 始终作用在原元素上，无需重建 */
    function applyLayout() {
      closeMenu();
      if (narrow.matches) {
        for (var i = 0; i < movable.length; i++) panel.appendChild(movable[i]);
        if (bestEl) panel.appendChild(bestEl);
        moreWrap.appendChild(panel);
        header.appendChild(moreWrap);
      } else {
        if (bestEl) header.appendChild(bestEl);
        for (var j = 0; j < movable.length; j++) header.insertBefore(movable[j], bestEl || null);
        header.appendChild(moreWrap);
        moreWrap.appendChild(panel);
      }
    }

    moreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.classList.toggle('open');
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.shell-help, .shell-restart, .shell-fs')) closeMenu();
    });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !moreWrap.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) { closeMenu(); moreBtn.focus(); }
    });
    if (narrow.addEventListener) narrow.addEventListener('change', applyLayout);
    else if (narrow.addListener) narrow.addListener(applyLayout);

    applyLayout();
    /* 家族统一顶栏存在时，游戏工具条必须排在它下面，否则会盖住主导航 */
    var familyNav = document.querySelector('.nc-shell');
    if (familyNav && familyNav.parentNode === document.body) {
      document.body.insertBefore(header, familyNav.nextSibling);
    } else {
      document.body.insertBefore(header, document.body.firstChild);
    }
  }

  function refreshBest() {
    if (!bestEl) return;
    var best = Arcade.storage.getBest(gameId);
    /* C3 审校修复：BEST 走 i18n（zh 最高分 / en BEST），与全站用语统一 */
    bestEl.textContent = Arcade.i18n.t('shell.best') + ' ' + (best === null ? '----' : best);
  }

  /** 破纪录时闪烁顶栏 BEST 区 */
  function flashBest() {
    if (!bestEl) return;
    bestEl.classList.remove('flash');
    void bestEl.offsetWidth; // 重启动画
    bestEl.classList.add('flash');
  }

  /**
   * 提交成绩：破纪录自动写入、刷新显示并闪烁。
   * 返回是否破纪录。
   */
  function submitScore(score) {

    var isNew = Arcade.storage.submitBest(gameId, score, bestMode);
    // 跨游戏军衔经验：完成一局 +2，破纪录额外 +3（纯本地生涯累计）
    // 0 分/负分不写 BEST，也不发放 XP，避免空提交刷经验
    if (score > 0 && Arcade.rank) Arcade.rank.add(isNew ? 5 : 2);
    // D8 月度足迹：按月累计完成局数（档案页热力条数据源；旧纪录无时间戳显示为「早期」）
    try {
      var d = new Date();
      var mk = d.getFullYear() + '-' + (d.getMonth() + 1);
      var hist = {};
      try { hist = JSON.parse(localStorage.getItem('arcade_playhist') || '{}') || {}; } catch (e) {}
      hist[mk] = (hist[mk] || 0) + 1;
      localStorage.setItem('arcade_playhist', JSON.stringify(hist));
    } catch (e) {}
    if (isNew) {
      refreshBest();
      flashBest();
      if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
      if (Arcade.audio) Arcade.audio.play('record');
      if (Arcade.ui) Arcade.ui.toast(Arcade.i18n ? Arcade.i18n.t('shell.newRecord') : '新纪录！', 'win', null, 'ic-trophy');
    } else {
      if (Arcade.audio) Arcade.audio.play('coin');
    }
    return isNew;
  }

  function setBestMode(mode) { bestMode = mode; }

  /* 首次进入自动弹教程（延迟等游戏脚本定义 GAME_TUTORIAL_STEPS）
     点「开始」后才标记已看（与原有游戏内 auto 语义一致） */
  function autoTutorialFirstTime() {
    if (!gameId || !Arcade.tutorial || !window.GAME_TUTORIAL_STEPS) return;
    try {
      var seen = localStorage.getItem('arcade_tut_' + gameId);
      if (seen) return;
      setTimeout(function () {
        if (window.GAME_TUTORIAL_STEPS && Arcade.tutorial) {
          Arcade.tutorial.show(window.GAME_TUTORIAL_STEPS, {
            title: tutTitle(),
            onStart: function () {
              try { localStorage.setItem('arcade_tut_' + gameId, '1'); } catch (e) {}
            }
          });
        }
      }, 650);
    } catch (e) {}
  }

  buildHeader();
  pushRecent();
  autoTutorialFirstTime();

  /* 背景乐已下线：不再注入 music.js、不再自动播放 chiptune。
     游戏音效（Arcade.audio）与节奏游戏自带的曲子不受影响。 */

  /* 无障碍：canvas 游戏画面补 role="img" + aria-label（屏幕阅读器可读出游戏名）
     游戏脚本同步执行创建 canvas，这里延迟扫描即可覆盖全部（含未来新游戏） */
  try {
    var canvasLabel = function () {
      return Arcade.i18n
        ? Arcade.i18n.t('shell.canvasLabel').replace('{n}', displayName())
        : gameTitle + ' 游戏画面';
    };
    (function labelCanvas() {
      var cvs = document.querySelectorAll('canvas');
      for (var i = 0; i < cvs.length; i++) {
        var c = cvs[i];
        if (!c.getAttribute('aria-label')) {
          c.setAttribute('role', 'img');
          c.setAttribute('aria-label', canvasLabel());
        }
      }
    })();
    window.addEventListener('load', function () {
      var cvs = document.querySelectorAll('canvas');
      for (var i = 0; i < cvs.length; i++) {
        var c = cvs[i];
        if (!c.getAttribute('aria-label')) {
          c.setAttribute('role', 'img');
          c.setAttribute('aria-label', canvasLabel());
        }
      }
    });
  } catch (e) {}

  return {
    gameId: gameId,
    gameTitle: gameTitle,
    refreshBest: refreshBest,
    flashBest: flashBest,
    submitScore: submitScore,
    setBestMode: setBestMode,
    showTutorial: showTutorial
  };
})();
