/* ============================================================
   跨游戏破译军衔系统（纯本地，个人维度）
   依赖：core/storage.js（先加载）
   经验来源：Arcade.shell.submitScore 统一接入（完成一局 +2，破纪录额外 +3）
   8 级军衔：见习密码员 → 初级密码员 → 密码员 → 高级密码员
            → 破译专家 → 首席破译官 → 王牌密码员 → 密码大师
   数据仅存 localStorage（arcade_rank），无任何服务端/排行榜。
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.rank = (function () {
  var KEY = 'arcade_rank';

  /* 军衔表：min = 升至此级所需累计 XP（封顶后 XP 继续累计但不升衔） */
  var RANKS = [
    { id: 'trainee',      name: '见习密码员', icon: '🔰', min: 0 },
    { id: 'junior',       name: '初级密码员', icon: '🪖', min: 40 },
    { id: 'cryptanalyst', name: '密码员',     icon: '📡', min: 100 },
    { id: 'senior',       name: '高级密码员', icon: '🕵️', min: 200 },
    { id: 'expert',       name: '破译专家',   icon: '💼', min: 350 },
    { id: 'chief',        name: '首席破译官', icon: '🏛️', min: 550 },
    { id: 'ace',          name: '王牌密码员', icon: '⚡', min: 800 },
    { id: 'master',       name: '密码大师',   icon: '👑', min: 1200 }
  ];

  function load() {
    try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : {}; }
    catch (e) { return {}; }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  function xp() {
    var d = load();
    return typeof d.xp === 'number' ? d.xp : 0;
  }

  /* 由 XP 推导军衔 */
  function rankFor(x) {
    var idx = 0;
    for (var i = 0; i < RANKS.length; i++) if (x >= RANKS[i].min) idx = i;
    var r = RANKS[idx];
    var next = idx + 1 < RANKS.length ? RANKS[idx + 1] : null;
    return { idx: idx, id: r.id, name: r.name, icon: r.icon, min: r.min, next: next };
  }

  function current() { return rankFor(xp()); }

  /* 本衔段进度百分比（0-100，封顶 100） */
  function progress() {
    var r = current();
    if (!r.next) return 100;
    var x = xp();
    var span = r.next.min - r.min;
    if (span <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((x - r.min) / span * 100)));
  }

  /** 增加经验，返回晋升后的军衔（{idx,name,icon,min,next}） */
  function add(amount) {
    var d = load();
    var before = rankFor(typeof d.xp === 'number' ? d.xp : 0);
    d.xp = (typeof d.xp === 'number' ? d.xp : 0) + amount;
    save(d);
    var after = rankFor(d.xp);
    if (after.idx > before.idx) {
      var t = Arcade.i18n ? Arcade.i18n.t : function (k) { return k; };
      if (Arcade.ui) Arcade.ui.toast(t('rank.promo').replace('{n}', t('rank.' + after.id + '.n')), 'win');
      if (Arcade.audio) Arcade.audio.play('win');
      if (Arcade.fx) Arcade.fx.flash('var(--neon-purple)');
    }
    return after;
  }

  return {
    RANKS: RANKS,
    xp: xp,
    add: add,
    current: current,
    progress: progress
  };
})();
