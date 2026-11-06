/* ============================================================
   档案索引页共用渲染 · people.html / artifacts.html
   依赖加载顺序：core/i18n.js → core/i18n-dict.js → games.js →
   stories.js → core/extras.js（提供 ensureArchive / escapeHtml）→ 本文件
   归档文案（人物传记、密件全文）由 ensureArchive 按需注入。
   ============================================================ */
(function () {
  'use strict';
  var kind = document.body.getAttribute('data-archive') || 'people';
  var en = !!(window.Arcade && Arcade.i18n && Arcade.i18n.getLang() === 'en');
  var L = en ? {
    people: 'People of Cryptology', artifacts: 'The Artifact Archive',
    back: 'Hall', peopleN: ' people', artifactsN: ' documents',
    chapters: 'Chapters', games: 'Related games', sources: 'Sources',
    nature: 'Document type', real: 'Historical record',
    dramatized: 'Dramatised from records', reconstructed: 'Reconstructed from records',
    unlock: 'Unlocked by', empty: 'Details are being catalogued.'
  } : {
    people: '人物志', artifacts: '密件册',
    back: '大厅', peopleN: ' 人', artifactsN: ' 件',
    chapters: '出现章节', games: '关联游戏', sources: '资料来源',
    nature: '史料性质', real: '真实史料',
    dramatized: '史料化演绎', reconstructed: '依史料重构',
    unlock: '通关解锁', empty: '资料整理中。'
  };

  function t(k) {
    if (!window.Arcade || !Arcade.i18n) return '';
    var v = Arcade.i18n.t(k);
    return (v && v !== k) ? v : '';
  }
  function esc(s) {
    if (window.Arcade && Arcade.escapeHtml) return Arcade.escapeHtml(String(s || ''));
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function chapterOf(id) {
    var list = window.STORIES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function gameOf(id) {
    var list = window.GAMES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function srcLabel(item) {
    var s = (item && item.label) || '';
    return s.replace(/\s*-\s*维基百科$/, '').replace(/\s*—\s*Wikipedia$/, '');
  }
  function fallbackName(pid) {
    var src = window.PEOPLE_SRC && window.PEOPLE_SRC[pid];
    return (src && src.length) ? srcLabel(src[0]) : pid;
  }
  function srcBlock(arr, title) {
    if (!arr || !arr.length) return '';
    return '<div class="arc-src"><b>' + esc(title) + '</b>' +
      '<ul>' + arr.map(function (x) { return '<li>' + esc(srcLabel(x)) + '</li>'; }).join('') + '</ul></div>';
  }
  function link(label, href) {
    return '<a class="arc-link" href="' + esc(href) + '">' + esc(label) + '</a>';
  }
  function chaptersForPerson(pid) {
    var out = [];
    (window.STORIES || []).forEach(function (ch) {
      if (ch.people && ch.people.indexOf(pid) >= 0) out.push(ch);
    });
    return out;
  }
  function gamesForPerson(pid) {
    var ids = [], seen = {};
    chaptersForPerson(pid).forEach(function (ch) {
      (ch.games || []).forEach(function (gid) {
        if (!seen[gid]) { seen[gid] = 1; ids.push(gid); }
      });
    });
    return ids;
  }

  function renderPeople() {
    var list = window.PEOPLE || [];
    return list.map(function (pid) {
      var name = t('stp.' + pid + '.name') || fallbackName(pid);
      var era = t('stp.' + pid + '.era'), role = t('stp.' + pid + '.role');
      var bio = t('stp.' + pid + '.bio'), quote = t('stp.' + pid + '.quote');
      var fact = t('stp.' + pid + '.fact');
      var chs = chaptersForPerson(pid).map(function (ch) {
        return link(t(ch.titleKey) || ch.id, 'story.html?id=' + ch.id);
      }).join('');
      var gs = gamesForPerson(pid).map(function (gid) {
        var g = gameOf(gid);
        return g ? link(t('g.' + gid + '.t') || gid, g.path) : '';
      }).join('');
      var body = (bio ? '<p>' + esc(bio) + '</p>' : '') +
        (quote ? '<blockquote>“' + esc(quote) + '”</blockquote>' : '') +
        (fact ? '<p class="arc-fact">' + esc(fact) + '</p>' : '') +
        (chs ? '<div class="arc-meta"><b>' + esc(L.chapters) + '</b>' + chs + '</div>' : '') +
        (gs ? '<div class="arc-meta"><b>' + esc(L.games) + '</b>' + gs + '</div>' : '') +
        srcBlock(window.PEOPLE_SRC && window.PEOPLE_SRC[pid], L.sources);
      return '<details class="arc-card" id="p-' + esc(pid) + '">' +
        '<summary><b>' + esc(name) + '</b><small>' + esc([era, role].filter(Boolean).join(' · ')) + '</small></summary>' +
        '<div class="arc-body">' + (body || '<p>' + esc(L.empty) + '</p>') + '</div></details>';
    }).join('');
  }

  function renderArtifacts() {
    var list = window.ARTIFACTS || [];
    var NAT = { real: L.real, dramatized: L.dramatized, reconstructed: L.reconstructed };
    return list.map(function (art) {
      var name = t('sta.' + art.id + '.name') || art.id;
      var desc = t('sta.' + art.id + '.desc');
      var ch = chapterOf(art.chapterId);
      var chLink = ch ? link(t(ch.titleKey) || ch.id, 'story.html?id=' + ch.id) : '';
      var g = gameOf(art.unlockGameId);
      var gLink = g ? link(t('g.' + g.id + '.t') || g.id, g.path) : '';
      var body = (desc ? '<p>' + esc(desc) + '</p>' : '') +
        (art.nature ? '<p class="arc-fact">' + esc(L.nature) + '：' + esc(NAT[art.nature] || art.nature) + '</p>' : '') +
        (chLink ? '<div class="arc-meta"><b>' + esc(L.chapters) + '</b>' + chLink + '</div>' : '') +
        (gLink ? '<div class="arc-meta"><b>' + esc(L.unlock) + '</b>' + gLink + '</div>' : '') +
        srcBlock(window.ARTIFACT_SRC && window.ARTIFACT_SRC[art.id], L.sources);
      return '<details class="arc-card" id="a-' + esc(art.id) + '">' +
        '<summary><b>' + esc(name) + '</b><small>' + esc(ch ? (t(ch.titleKey) || ch.id) : '') + '</small></summary>' +
        '<div class="arc-body">' + (body || '<p>' + esc(L.empty) + '</p>') + '</div></details>';
    }).join('');
  }

  function applyStatic(count) {
    document.title = L[kind === 'people' ? 'people' : 'artifacts'] + ' · ' +
      (en ? 'Arcade Hall' : '游戏街机厅');
    var h = document.getElementById('arc-title');
    var c = document.getElementById('arc-count');
    var b = document.getElementById('arc-back');
    var f = document.getElementById('arc-foot');
    var lb = document.getElementById('langToggle');
    if (h) h.textContent = L[kind === 'people' ? 'people' : 'artifacts'];
    if (c) c.textContent = count + L[kind === 'people' ? 'peopleN' : 'artifactsN'];
    if (b) b.textContent = L.back;
    if (f) f.textContent = L[kind === 'people' ? 'people' : 'artifacts'] + ' · ' +
      count + L[kind === 'people' ? 'peopleN' : 'artifactsN'];
    if (lb) lb.textContent = en ? '中' : 'EN';
  }

  function render() {
    var list = kind === 'people' ? (window.PEOPLE || []) : (window.ARTIFACTS || []);
    var grid = document.getElementById('arc-list');
    if (!grid) return;
    grid.innerHTML = kind === 'people' ? renderPeople() : renderArtifacts();
    applyStatic(list.length);
    var wanted = new URLSearchParams(location.search).get('id');
    if (wanted) {
      var el = document.getElementById((kind === 'people' ? 'p-' : 'a-') + wanted);
      if (el) { el.open = true; el.scrollIntoView({ block: 'center' }); }
    }
  }

  var lb = document.getElementById('langToggle');
  if (lb) lb.addEventListener('click', function () {
    if (window.Arcade && Arcade.i18n) Arcade.i18n.setLang(en ? 'zh' : 'en');
  });

  window.__arcadePagePrefix = '';
  if (window.Arcade && Arcade.ensureArchive) Arcade.ensureArchive(render);
  else render();
})();
