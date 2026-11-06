/* ============================================================
   最高分持久化：localStorage 封装
   key 规范：arcade_best_{gameId}
   ============================================================ */

window.Arcade = window.Arcade || {};

Arcade.storage = (function () {
  var PREFIX = 'arcade_best_';
  /* B3：任一写入失败（隐私模式/配额满）置位，extras.js 启动后一次性提示 */
  var writeFailed = false;

  function key(gameId) {
    return PREFIX + gameId;
  }

  /** 读取最高分；无记录返回 null */
  function getBest(gameId) {
    try {
      var raw = localStorage.getItem(key(gameId));
      if (raw === null) return null;
      var n = Number(raw);
      return isNaN(n) ? null : n;
    } catch (e) {
      return null; // 隐私模式等场景下 localStorage 不可用
    }
  }

  /**
   * 提交成绩；破纪录则写入并返回 true
   * mode: 'max'（默认，越高越好）| 'min'（越低越好，如计时/步数）
   *
   * 纪录判定只接受有效得分（> 0）：
   *   - 首次 0 分（如开局即失败）不写 BEST、不返回 true，避免误报「新纪录」；
   *   - 旧版本可能已把 0 写入 BEST（历史脏数据），提交时按「无纪录」处理，
   *     真实成绩仍能正常刷新；存档键 arcade_best_<id> 与 max/min 语义不变。
   */
  function submitBest(gameId, score, mode) {
    var n = Number(score);
    if (!isFinite(n) || n <= 0) return false;
    var best = getBest(gameId);
    var base = (best !== null && best > 0) ? best : null; // 0/负数旧档视作无有效纪录
    var isNewRecord =
      base === null ||
      (mode === 'min' ? n < base : n > base);
    if (isNewRecord) {
      try {
        localStorage.setItem(key(gameId), String(n));
      } catch (e) { writeFailed = true; /* 忽略写入失败 */ }
    }
    return isNewRecord;
  }

  function markWriteFail() { writeFailed = true; }
  function hasWriteError() { return writeFailed; }

  return { getBest: getBest, submitBest: submitBest, markWriteFail: markWriteFail, hasWriteError: hasWriteError };
})();

/* ============================================================
   每日破译中心持久化
   key：arcade_daily_{gameId}_{YYYY-M-D} = 当日破解用时（秒）
       arcade_daily_streak / arcade_daily_last = 连续破译天数
   依赖：上方 Arcade.storage 同一 localStorage
   ============================================================ */

Arcade.daily = (function () {
  var PREFIX = 'arcade_daily_';
  var STREAK_KEY = PREFIX + 'streak';
  var LAST_KEY = PREFIX + 'last';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {
      if (window.Arcade && Arcade.storage && Arcade.storage.markWriteFail) Arcade.storage.markWriteFail();
    }
  }

  /** 某游戏某日（默认今天）是否已破译今日题 */
  function isSolved(gameId, d) {
    return get(PREFIX + gameId + '_' + dayStr(d)) !== null;
  }
  /** 某游戏某日（默认今天）的破解用时；未破译返回 null */
  function solvedTime(gameId, d) {
    var v = get(PREFIX + gameId + '_' + dayStr(d));
    return v === null ? null : Number(v);
  }
  /** 记录今日题已破译（用时秒）；同一天同游戏只记一次，返回是否新记录 */
  function markSolved(gameId, seconds) {
    var k = PREFIX + gameId + '_' + dayStr();
    if (get(k) !== null) return false;
    set(k, String(seconds));
    updateStreak();
    if (window.Arcade && Arcade.audio) Arcade.audio.play('daily');
    return true;
  }
  function updateStreak() {
    var today = dayStr();
    var last = get(LAST_KEY);
    if (last === today) return; // 今天已计入过
    var streak = Number(get(STREAK_KEY) || 0);
    if (last === dayStr(addDays(new Date(), -1))) {
      streak += 1;
    } else {
      streak = 1;
    }
    set(STREAK_KEY, String(streak));
    set(LAST_KEY, today);
  }
  /** 当前连破天数（含今天，若今天已至少解一题） */
  function streak() { return Number(get(STREAK_KEY) || 0); }
  function lastDay() { return get(LAST_KEY); }

  return {
    dayStr: dayStr, isSolved: isSolved, solvedTime: solvedTime,
    markSolved: markSolved, streak: streak, lastDay: lastDay
  };
})();

/* ============================================================
   断点续玩通用件 Arcade.savegame（2026-08 批量扩展）
   任意游戏：setup({id, collect, apply}) 后自动获得
     - 页面隐藏（visibilitychange）与离开（pagehide）自动存档
     - 状态变更后调用 write() 即时快照（推荐每次关键变更后）
     - 启动时调用 resume()：恢复成功返回 true 并 toast；否则返回 false
     apply 返回 false / 异常 → 视为无效存档自动清除
   仅存本机 localStorage（arcade_save_<id>），绝不上传。
   ============================================================ */
window.Arcade = window.Arcade || {};

Arcade.savegame = (function () {
  var cfg = null;

  function key() { return 'arcade_save_' + cfg.id; }

  /** 快照写入；collect 返回 null/undefined 视为「无局可存」→ 清档。
      返回 true=已持久化（或已清档），false=存储不可用/失败（调用方可提示用户） */
  function write() {
    if (!cfg || !cfg.collect) return false;
    try {
      var s = cfg.collect();
      if (s == null) { localStorage.removeItem(key()); return true; }
      s.__t = Date.now();
      localStorage.setItem(key(), JSON.stringify(s));
      return true;
    } catch (e) { return false; }
  }

  function clear() {
    try { localStorage.removeItem(key()); } catch (e) {}
  }

  /** 读档恢复；apply 返回 false / 抛错 → 视为无效存档并清除 */
  function resume() {
    if (!cfg || !cfg.apply) return false;
    try {
      var s = JSON.parse(localStorage.getItem(key()) || 'null');
      if (!s) return false;
      if (!cfg.apply(s)) { clear(); return false; }
      var msg = cfg.msg ? Arcade.i18n.t(cfg.msg) : Arcade.i18n.t('savegame.resumed');
      if (window.Arcade && Arcade.i18n && Arcade.ui && Arcade.ui.toast) {
        Arcade.ui.toast(msg, 'ok');
      }
      return true;
    } catch (e) { return false; }
  }

  /** 注册（并挂自动存档钩子）；游戏启动后调用 resume() 决定恢复或开新局 */
  function setup(o) {
    cfg = o;
    if (!cfg || !cfg.collect || !cfg.apply) return;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') write();
    });
    window.addEventListener('pagehide', write);
  }

  return { setup: setup, resume: resume, write: write, clear: clear };
})();
