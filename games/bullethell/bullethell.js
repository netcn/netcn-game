/* ============================================================
   弹幕射击 Bullet Hell · 旗舰重制
   极小判定点（3px）贴弹擦分；三难度、波次推进、多阶段 Boss。
   视觉：路径绘制战机/敌机/Boss，星空视差 + 扫描线，Canvas 碎片+冲击波，
        受击闪白/屏震/爆炸，Boss 阶段转场提示，胜利清屏慢动作。
   闭环：难度/开始遮罩 → 进行 → 生命耗尽或击破 Boss → 结算 → 重开/换难度。
   共享能力：T / Arcade.audio / Arcade.juice / Arcade.fx / Arcade.shell.submitScore /
            Arcade.storage.getBest / Arcade.loop / GK.setup / GK.pointer。
   核心逻辑用 ==BH-CORE-START== / ==BH-CORE-END== 标记包裹，供 Node harness 提取。
   ============================================================ */

window.GAME_TUTORIAL_STEPS = [
  { t: T('gs.bullethell.tut1t'), d: T('gs.bullethell.tut1') },
  { t: T('gs.bullethell.tut2t'), d: T('gs.bullethell.tut2') },
  { t: T('gs.bullethell.tut3t'), d: T('gs.bullethell.tut3') },
  { t: T('gs.bullethell.tut4t'), d: T('gs.bullethell.tut4') }
];

(function () {
  /* ==BH-CORE-START== */
  var BHCORE = (function () {
    /* 弹幕模式（纯数学，可测）：返回弹的初始 (vx,vy) 列表 */
    function ringPattern(n, speed, dir, spread, rng) {
      var out = [];
      var base = (rng ? rng() * Math.PI * 2 : 0) + (dir || 0);
      for (var i = 0; i < n; i++) {
        var a = base + (spread || Math.PI * 2) * i / n;
        out.push([Math.cos(a) * speed, Math.sin(a) * speed]);
      }
      return out;
    }
    function spiralPattern(speed, angle) {
      return [Math.cos(angle) * speed, Math.sin(angle) * speed];
    }
    function aimAngle(px, py, ex, ey) {
      return Math.atan2(py - ey, px - ex);
    }
    function fanPattern(n, centerAng, spread, speed) {
      var out = [];
      if (n === 1) { out.push([Math.cos(centerAng) * speed, Math.sin(centerAng) * speed]); return out; }
      for (var i = 0; i < n; i++) {
        var a = centerAng - spread / 2 + spread * i / (n - 1);
        out.push([Math.cos(a) * speed, Math.sin(a) * speed]);
      }
      return out;
    }
    /* 判定：返回 0=命中判定点 / 1=擦弹圈内未命中 / 2=安全 */
    function judgeHit(px, py, bx, by, hitR, grazeR) {
      var d2 = (px - bx) * (px - bx) + (py - by) * (py - by);
      if (d2 <= hitR * hitR) return 0;
      if (d2 <= grazeR * grazeR) return 1;
      return 2;
    }
    /* 敌机击破判定 */
    function hitEnemy(px, py, ex, ey, er) {
      var dx = px - ex, dy = py - ey;
      return dx * dx + dy * dy <= er * er;
    }
    /* Boss 阶段：按剩余血量比例 0/1/2 */
    function bossPhase(hp, maxHp) {
      if (!maxHp) return 0;
      var r = hp / maxHp;
      return r > 0.66 ? 0 : (r > 0.33 ? 1 : 2);
    }
    return {
      ringPattern: ringPattern, spiralPattern: spiralPattern, aimAngle: aimAngle,
      fanPattern: fanPattern, judgeHit: judgeHit, hitEnemy: hitEnemy, bossPhase: bossPhase
    };
  })();
  /* ==BH-CORE-END== */

  var ringPattern = BHCORE.ringPattern, spiralPattern = BHCORE.spiralPattern;
  var aimAngle = BHCORE.aimAngle, fanPattern = BHCORE.fanPattern;
  var judgeHit = BHCORE.judgeHit, hitEnemy = BHCORE.hitEnemy;
  var bossPhaseOf = BHCORE.bossPhase;

  var root = document.getElementById('game-root');
  if (!root) return;

  /* ---------------- 基础常量 ---------------- */
  var W = 420, H = 620;
  var TOTAL_WAVES = 12, MID_WAVE = 6, FINAL_WAVE = 12;
  var GRAZE_R = 17;
  var BEST_KEY = (Arcade.shell && Arcade.shell.gameId) || 'bullethell';
  var LOADOUT_KEY = 'arcade_bh_loadout'; /* 新键：机体/武器/练习偏好，不覆盖 arcade_best_bullethell */

  /* 三种机体：速度 / 聚焦速度 / 核心判定半径 / 擦弹圈 / 初始生命 / 配色，全部明确不同 */
  var SHIPS = {
    balanced: { speed: 4.6, focus: 2.0, hitR: 3.0, graze: 17, lives: 3, col: '#00f0ff', hot: '#7fe9ff', deep: '#06506a', shape: 'balanced' },
    swift:    { speed: 5.6, focus: 2.7, hitR: 2.4, graze: 16, lives: 3, col: '#ff2d95', hot: '#ffb0da', deep: '#67103e', shape: 'swift' },
    heavy:    { speed: 3.9, focus: 1.7, hitR: 3.8, graze: 19, lives: 4, col: '#ffe600', hot: '#fff6a8', deep: '#6a5a00', shape: 'heavy' }
  };
  var SHIP_KEYS = ['balanced', 'swift', 'heavy'];

  /* 三种武器：散射 / 聚焦激光 / 追踪 */
  var WEAPONS = {
    spread: { col: '#39ff14', gap: 6,  dmg: 1, speed: 11.5, homing: false, laser: false, pierce: 0 },
    laser:  { col: '#00f0ff', gap: 8,  dmg: 2, speed: 16,   homing: false, laser: true,  pierce: 1 },
    homing: { col: '#ff2d95', gap: 9,  dmg: 1, speed: 9,    homing: true,  laser: false, pierce: 0 }
  };
  var WEAPON_KEYS = ['spread', 'laser', 'homing'];

  var DIFFS = {
    easy:   { speed: 1.15, ringN: 10, waves: TOTAL_WAVES, midHp: 55,  finalHp: 80,  count: 3, fireGap: 88, bossGap0: 70, spiralGap: 19, bossGap2: 62 },
    normal: { speed: 1.70, ringN: 14, waves: TOTAL_WAVES, midHp: 92,  finalHp: 140, count: 4, fireGap: 68, bossGap0: 58, spiralGap: 14, bossGap2: 47 },
    hard:   { speed: 2.20, ringN: 18, waves: TOTAL_WAVES, midHp: 132, finalHp: 210, count: 5, fireGap: 54, bossGap0: 47, spiralGap: 11, bossGap2: 36 }
  };
  var DIFF_KEYS = ['easy', 'normal', 'hard'];
  var DIFF_LABELS = {
    easy: ['dEasy', 'dEasyDesc'], normal: ['dNormal', 'dNormalDesc'], hard: ['dHard', 'dHardDesc']
  };
  var ENEMY_COL = ['#ff2d95', '#b967ff', '#ff9f1c'];
  var BOSS_COL = ['#b967ff', '#ff9f1c', '#ff2d95'];
  var STAR_COL = ['#bfefff', '#7fd4ff', '#ffe9a8'];

  function audio(name) { if (Arcade.audio) Arcade.audio.play(name); }
  function readBest() {
    try { return (Arcade.storage && Arcade.storage.getBest(BEST_KEY)); } catch (e) { return null; }
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function shipName(k) { return T('gs.bullethell.ship_' + k); }
  function weaponName(k) { return T('gs.bullethell.weapon_' + k); }
  function loadPrefs() {
    var o = { ship: 'balanced', weapon: 'spread', practice: false, startWave: 1 };
    try {
      var raw = localStorage.getItem(LOADOUT_KEY);
      var p = raw ? JSON.parse(raw) : null;
      if (p) {
        if (SHIPS[p.ship]) o.ship = p.ship;
        if (WEAPONS[p.weapon]) o.weapon = p.weapon;
        o.practice = !!p.practice;
        if (p.startWave === 6 || p.startWave === 12) o.startWave = p.startWave;
      }
    } catch (e) {}
    return o;
  }
  function savePrefs() {
    try {
      localStorage.setItem(LOADOUT_KEY, JSON.stringify({
        ship: selShip, weapon: selWeapon, practice: selPractice, startWave: selStartWave
      }));
    } catch (e) {}
  }

  /* 新增 UI 样式：不改 index.html，运行时注入，保持霓虹深色与 ≥44px 触控目标 */
  (function injectCss() {
    var st = document.createElement('style');
    st.textContent =
      '.bh-overlay{padding:56px 12px 16px;align-items:center;}' +
      '.bh-card{max-height:calc(100vh - 74px);gap:8px;}' +
      '.bh-pick-label{display:flex;justify-content:space-between;align-items:center;font-size:9px;letter-spacing:.1em;color:var(--text-dim);text-transform:uppercase;margin-top:-2px;}' +
      '.bh-pick-label span{font-family:var(--font-pixel);font-size:8px;color:var(--neon-yellow);}' +
      '.bh-pickrow{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}' +
      '.bh-pick{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:46px;padding:5px 3px;border-radius:7px;border:1px solid rgba(0,240,255,.28);background:rgba(0,240,255,.04);color:var(--text-dim);cursor:pointer;font-family:var(--font-body);}' +
      '.bh-pick b{font-family:var(--font-pixel);font-size:8px;line-height:1.35;color:var(--neon-cyan);text-shadow:0 0 6px rgba(0,240,255,.35);white-space:nowrap;}' +
      '.bh-pick small{font-size:7.8px;line-height:1.35;opacity:.78;white-space:nowrap;}' +
      '.bh-pick.selected{border-color:var(--neon-yellow);background:rgba(255,230,0,.12);box-shadow:0 0 12px rgba(255,230,0,.28);}' +
      '.bh-pick.selected b{color:var(--neon-yellow);text-shadow:0 0 8px rgba(255,230,0,.65);}' +
      '.bh-diff-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}' +
      '.bh-diff{width:100%;min-height:44px;text-align:center;padding:6px 3px;font-size:9px;}' +
      '.bh-diff small{font-size:7.5px;margin-top:2px;}' +
      '.bh-toggle{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:44px;padding:8px 12px;border-radius:7px;border:1px solid rgba(255,230,0,.4);background:rgba(255,230,0,.05);color:var(--text-dim);font-family:var(--font-body);font-size:10px;cursor:pointer;}' +
      '.bh-toggle b{font-family:var(--font-pixel);font-size:9px;padding:4px 8px;border-radius:4px;border:1px solid rgba(255,230,0,.5);color:var(--neon-yellow);}' +
      '.bh-toggle.on{border-color:var(--neon-yellow);background:rgba(255,230,0,.15);color:#fff;}' +
      '.bh-toggle.on b{background:var(--neon-yellow);color:#191500;}' +
      '.bh-wave-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}' +
      '.bh-wave-btn{min-height:44px;padding:6px 2px;font-size:8px;border-radius:7px;border:1px solid rgba(185,103,255,.45);background:rgba(185,103,255,.06);color:var(--neon-purple);font-family:var(--font-pixel);cursor:pointer;}' +
      '.bh-wave-btn.selected{background:rgba(185,103,255,.3);color:#fff;box-shadow:0 0 10px rgba(185,103,255,.5);}' +
      '.bh-loadout{display:flex;align-items:center;gap:7px;min-height:15px;padding:0 4px;font-size:9px;color:var(--text-dim);white-space:nowrap;overflow:hidden;}' +
      '.bh-loadout b{color:var(--neon-cyan);font-weight:normal;}' +
      '.bh-loadout .bh-practice-tag{color:var(--neon-yellow);font-family:var(--font-pixel);font-size:7.5px;padding:2px 5px;border:1px solid rgba(255,230,0,.45);border-radius:4px;}' +
      '.bh-controls .btn{min-height:44px;}' +
      '.bh-card .btn,.bh-actions .btn{min-height:44px;}' +
      '.bh-practice-note{margin:0;padding:6px 8px;border:1px dashed rgba(255,230,0,.5);border-radius:6px;color:var(--neon-yellow);font-size:9.5px;line-height:1.5;}' +
      '#bh-weapon-btn{font-size:8px;padding:6px 7px;min-width:44px;max-width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.bh-bosswrap.mid .bh-bossbar::before{left:50%;}' +
      '.bh-bosswrap.mid .bh-bossbar::after{display:none;}' +
      '@keyframes bhOvIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes bhCardIn{from{opacity:0;transform:translateY(12px) scale(.94)}to{opacity:1;transform:none}}' +
      '.bh-overlay:not(.hidden){animation:bhOvIn .2s ease-out both;}' +
      '.bh-overlay:not(.hidden) .bh-card{animation:bhCardIn .28s cubic-bezier(.2,.9,.3,1.18) both;}' +
      '@media (max-width:360px){.bh-auto{display:none;}.bh-card{padding:14px 12px;}.bh-pick small{font-size:7px;}.bh-loadout{gap:5px;}}' +
      '@media (max-height:720px){.bh-card{max-height:calc(100vh - 62px);}.bh-pick{min-height:44px;}}';
    (document.head || document.documentElement).appendChild(st);
  })();

  function diffButtonsHtml() {
    return DIFF_KEYS.map(function (k) {
      return '<button class="btn mode-btn bh-diff" data-d="' + k + '" type="button">' +
        '<span>' + T('gs.bullethell.' + DIFF_LABELS[k][0]) + '</span>' +
        '<small>' + T('gs.bullethell.' + DIFF_LABELS[k][1]) + '</small></button>';
    }).join('');
  }
  function shipButtonsHtml() {
    return SHIP_KEYS.map(function (k) {
      return '<button class="bh-pick" type="button" id="bh-ship-' + k + '" data-ship="' + k + '">' +
        '<b>' + shipName(k) + '</b><small>' + T('gs.bullethell.shipDesc_' + k) + '</small></button>';
    }).join('');
  }
  function weaponButtonsHtml() {
    return WEAPON_KEYS.map(function (k) {
      return '<button class="bh-pick" type="button" id="bh-weapon-pick-' + k + '" data-weapon="' + k + '">' +
        '<b>' + weaponName(k) + '</b><small>' + T('gs.bullethell.weaponDesc_' + k) + '</small></button>';
    }).join('');
  }
  function waveButtonsHtml() {
    return [1, 6, 12].map(function (n) {
      return '<button class="bh-wave-btn" type="button" id="bh-wave-' + n + '" data-wave="' + n + '">' +
        T('gs.bullethell.wave').replace('{n}', n) + '</button>';
    }).join('');
  }

  root.innerHTML =
    '<div class="bh-wrap">' +
    '  <div class="bh-hud">' +
    '    <div class="bh-hud-row">' +
    '      <span class="bh-stat"><i>' + T('gs.bullethell.hudScore') + '</i><b id="bh-score">0</b></span>' +
    '      <span class="bh-stat"><i>' + T('gs.bullethell.hudGraze') + '</i><b id="bh-graze">0</b></span>' +
    '      <span class="bh-stat lives"><i>' + T('gs.bullethell.hudLives') + '</i><b id="bh-lives" class="bh-lives"><span class="bh-life" aria-hidden="true"></span><span class="bh-life" aria-hidden="true"></span><span class="bh-life" aria-hidden="true"></span></b></span>' +
    '      <span class="bh-stat wave"><i>' + T('gs.bullethell.hudWave') + '</i><b id="bh-wave">1/12</b></span>' +
    '    </div>' +
    '    <div class="bh-hud-sub">' +
    '      <span><span id="bh-best-label">' + T('gs.bullethell.hudBest') + '</span> <b id="bh-best">----</b></span>' +
    '      <span class="bh-combo" id="bh-combo"></span>' +
    '    </div>' +
    '    <div class="bh-loadout" id="bh-loadout">' +
    '      <span id="bh-ship-hud"></span><b id="bh-weapon-hud"></b>' +
    '      <span class="bh-practice-tag hidden" id="bh-practice-hud">' + T('gs.bullethell.practiceBadge') + '</span>' +
    '    </div>' +
    '    <div class="bh-bosswrap hidden" id="bh-bosswrap">' +
    '      <span class="bh-bosslabel" id="bh-bosslabel">BOSS</span>' +
    '      <div class="bh-bossbar"><i id="bh-bossfill"></i></div>' +
    '      <span class="bh-phase" id="bh-phase"></span>' +
    '    </div>' +
    '  </div>' +
    '  <div class="bh-stage" id="bh-stage">' +
    '    <canvas id="bh-canvas" class="bh-canvas" width="' + W + '" height="' + H + '"></canvas>' +
    '    <div class="bh-banner" id="bh-banner"></div>' +
    '  </div>' +
    '  <div class="bh-controls">' +
    '    <button class="btn pink" id="bh-pause-btn" type="button">' + T('gs.bullethell.pauseBtn') + '</button>' +
    '    <button class="btn yellow" id="bh-weapon-btn" type="button" title="' + T('gs.bullethell.weaponHint') + '"></button>' +
    '    <span class="bh-auto">' + T('gs.bullethell.autoFire') + '</span>' +
    '    <button class="btn yellow" id="bh-focus-btn" type="button" title="' + T('gs.bullethell.focusHint') + '" aria-pressed="false">' + T('gs.bullethell.focusBtn') + '</button>' +
    '  </div>' +
    '  <div class="bh-help">' + T('gs.bullethell.help') + '</div>' +
    '</div>' +
    /* 开始 / 机体 / 武器 / 难度 / 练习遮罩 */
    '<div class="bh-overlay" id="bh-start">' +
    '  <div class="bh-card bh-start-card">' +
    '    <h2>' + T('gs.bullethell.startTitle') + '</h2>' +
    '    <p>' + T('gs.bullethell.startDesc') + '</p>' +
    '    <div class="bh-pick-label"><span>' + T('gs.bullethell.pickShip') + '</span><span>← →</span></div>' +
    '    <div class="bh-pickrow" id="bh-ships">' + shipButtonsHtml() + '</div>' +
    '    <div class="bh-pick-label"><span>' + T('gs.bullethell.pickWeapon') + '</span><span>↑ ↓</span></div>' +
    '    <div class="bh-pickrow" id="bh-weapons">' + weaponButtonsHtml() + '</div>' +
    '    <div class="bh-pick-label"><span>' + T('gs.bullethell.pickDiff') + '</span><span></span></div>' +
    '    <div class="bh-diff-btns" id="bh-diffs">' + diffButtonsHtml() + '</div>' +
    '    <button class="bh-toggle" id="bh-practice" type="button" aria-pressed="false">' +
    '      <span>' + T('gs.bullethell.practiceToggle') + '</span><b id="bh-practice-state">' + T('gs.bullethell.practiceOff') + '</b></button>' +
    '    <div class="bh-wave-row hidden" id="bh-wave-row">' + waveButtonsHtml() + '</div>' +
    '    <button class="btn green" id="bh-start-btn" type="button">' + T('gs.bullethell.startBtn') + '</button>' +
    '    <small class="bh-start-hint">' + T('gs.bullethell.selectHint') + '</small>' +
    '  </div>' +
    '</div>' +
    /* 暂停遮罩 */
    '<div class="bh-overlay hidden" id="bh-pause">' +
    '  <div class="bh-card">' +
    '    <h2>' + T('gs.bullethell.pauseTitle') + '</h2>' +
    '    <p>' + T('gs.bullethell.pauseHint') + '</p>' +
    '    <button class="btn green" id="bh-resume" type="button">' + T('gs.bullethell.resumeBtn') + '</button>' +
    '    <button class="btn" id="bh-pause-restart" type="button">' + T('gs.bullethell.restartBtn') + '</button>' +
    '    <button class="btn purple" id="bh-pause-change" type="button">' + T('gs.bullethell.changeDiff') + '</button>' +
    '  </div>' +
    '</div>' +
    /* 结算遮罩 */
    '<div class="bh-overlay hidden" id="bh-result">' +
    '  <div class="bh-card">' +
    '    <h2 id="bh-res-title"></h2>' +
    '    <p id="bh-res-desc"></p>' +
    '    <div class="bh-record" id="bh-record">' + T('gs.bullethell.newRecord') + '</div>' +
    '    <div class="bh-res-stats">' +
    '      <div class="bh-res-stat"><span>' + T('gs.bullethell.stScore') + '</span><b id="bh-res-score">0</b></div>' +
    '      <div class="bh-res-stat"><span>' + T('gs.bullethell.stGraze') + '</span><b id="bh-res-graze">0</b></div>' +
    '      <div class="bh-res-stat wide"><span>' + T('gs.bullethell.stWave') + '</span><b id="bh-res-wave">0</b></div>' +
    '      <div class="bh-res-stat wide"><span>' + T('gs.bullethell.stBest') + '</span><b id="bh-res-best">----</b></div>' +
    '    </div>' +
    '    <p class="bh-practice-note hidden" id="bh-res-practice">' + T('gs.bullethell.resPractice') + '</p>' +
    '    <div class="bh-actions">' +
    '      <button class="btn green" id="bh-again" type="button">' + T('gs.bullethell.restartBtn') + '</button>' +
    '      <button class="btn purple" id="bh-change" type="button">' + T('gs.bullethell.backBtn') + '</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  /* ---------------- DOM ---------------- */
  var canvas = document.getElementById('bh-canvas');
  var ctx;
  if (window.GK && GK.setup) {
    ctx = GK.setup(canvas, W, H).ctx;
  } else {
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d');
    if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';

  var stageEl = document.getElementById('bh-stage');
  var scoreEl = document.getElementById('bh-score');
  var grazeEl = document.getElementById('bh-graze');
  var livesEl = document.getElementById('bh-lives');
  var waveEl = document.getElementById('bh-wave');
  var bestEl = document.getElementById('bh-best');
  var comboEl = document.getElementById('bh-combo');
  var bossWrap = document.getElementById('bh-bosswrap');
  var bossFill = document.getElementById('bh-bossfill');
  var bossLabel = document.getElementById('bh-bosslabel');
  var phaseEl = document.getElementById('bh-phase');
  var bannerEl = document.getElementById('bh-banner');
  var startEl = document.getElementById('bh-start');
  var pauseEl = document.getElementById('bh-pause');
  var resultEl = document.getElementById('bh-result');
  var resTitle = document.getElementById('bh-res-title');
  var resDesc = document.getElementById('bh-res-desc');
  var resScore = document.getElementById('bh-res-score');
  var resGraze = document.getElementById('bh-res-graze');
  var resWave = document.getElementById('bh-res-wave');
  var resBest = document.getElementById('bh-res-best');
  var recordEl = document.getElementById('bh-record');
  var resPracticeEl = document.getElementById('bh-res-practice');
  var diffRow = document.getElementById('bh-diffs');
  var pauseBtn = document.getElementById('bh-pause-btn');
  var focusBtn = document.getElementById('bh-focus-btn');
  var weaponBtn = document.getElementById('bh-weapon-btn');
  var shipHud = document.getElementById('bh-ship-hud');
  var weaponHud = document.getElementById('bh-weapon-hud');
  var practiceHud = document.getElementById('bh-practice-hud');
  var shipRow = document.getElementById('bh-ships');
  var weaponRow = document.getElementById('bh-weapons');
  var practiceBtn = document.getElementById('bh-practice');
  var practiceState = document.getElementById('bh-practice-state');
  var waveRow = document.getElementById('bh-wave-row');
  var bannerTimer = null;

  /* ---------------- 状态 ---------------- */
  var selDiff = 'normal';
  var prefs = loadPrefs();
  var selShip = prefs.ship, selWeapon = prefs.weapon;
  var selPractice = prefs.practice, selStartWave = prefs.startWave;
  var bestVal = readBest();
  var bgT = 0;
  var loopApi = null;
  var keys = { left: false, right: false, up: false, down: false };
  var focusHold = false, focusKey = false, touchFocus = false;
  var drag = { active: false, id: null, x: 0, y: 0 };
  var pointers = {}, primaryPointer = null;

  function makeConf(diffKey, practice) {
    var src = DIFFS[diffKey] || DIFFS.normal;
    var conf = {};
    for (var k in src) { if (src.hasOwnProperty(k)) conf[k] = src[k]; }
    if (practice) conf.speed = src.speed * 0.78; /* 练习模式弹幕减速 */
    return conf;
  }

  function makeState(diffKey, mode, opts) {
    opts = opts || {};
    var practice = !!opts.practice;
    var ship = SHIPS[opts.ship || selShip] || SHIPS.balanced;
    return {
      mode: mode || 'playing', diffKey: diffKey, conf: makeConf(diffKey, practice), t: 0,
      practice: practice, startWave: opts.startWave || 1,
      shipKey: opts.ship || selShip, weaponKey: opts.weapon || selWeapon,
      score: 0, graze: 0, grazeCombo: 0, comboIdle: 0,
      lives: practice ? 999 : ship.lives,
      wave: opts.startWave || 1,
      player: { x: W / 2, y: H - 78, flash: 0 },
      enterT: mode === 'menu' ? 0 : 34,
      pbullets: [], ebullets: [], enemies: [], particles: [], rings: [], texts: [],
      boss: null, bossPhase: 0, bossDefeated: false, bossSpawned: false,
      bossClearT: 0, bossDownWave: 0,
      spawnQueue: [], spawnT: 0, waveT: 0,
      fireT: 0, invT: 0, shakeT: 0, flashT: 0, flashColor: 'rgba(255,255,255,0.5)',
      grazeSndT: 0,
      endT: 0, endWin: false, submitted: false, isRecord: false, bestAtEnd: null
    };
  }

  var S = makeState('normal', 'menu');

  /* ---------------- 星空 ---------------- */
  var stars = [];
  (function buildStars() {
    for (var i = 0; i < 115; i++) {
      var z = Math.random();
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        z: z, r: 0.5 + z * 1.7, a: 0.25 + z * 0.65,
        tw: Math.random() * Math.PI * 2, sp: 0.25 + z * 1.7
      });
    }
  })();
  function updateStars() {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y += s.sp;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    }
  }

  /* ---------------- HUD ---------------- */
  function updateHud() {
    scoreEl.textContent = String(S.score);
    grazeEl.textContent = String(S.graze);
    if (S.practice) { livesEl.textContent = '∞'; }
    else if (S.lives > 0) { livesEl.innerHTML = new Array(S.lives + 1).join('<span class="bh-life" aria-hidden="true"></span>'); }
    else { livesEl.textContent = '—'; }
    livesEl.setAttribute('aria-label', T('gs.bullethell.hudLives') + ' ' + (S.practice ? '∞' : S.lives));
    waveEl.textContent = S.boss
      ? (S.boss.kind === 'mid' ? T('gs.bullethell.midBossTag') : T('gs.bullethell.finalBossTag'))
      : (Math.max(1, Math.min(S.wave, S.conf.waves)) + '/' + S.conf.waves);
    var showCombo = S.grazeCombo > 2;
    comboEl.textContent = showCombo ? 'COMBO ' + S.grazeCombo : '';
    comboEl.classList.toggle('on', showCombo);
    bestEl.textContent = bestVal == null ? '----' : String(bestVal);
    shipHud.textContent = T('gs.bullethell.hudShip') + ' ' + shipName(S.shipKey);
    weaponHud.textContent = T('gs.bullethell.hudWeapon') + ' ' + weaponName(S.weaponKey);
    practiceHud.classList.toggle('hidden', !S.practice);
    weaponBtn.textContent = weaponName(S.weaponKey);
    if (S.boss) {
      bossWrap.classList.remove('hidden');
      bossWrap.classList.toggle('mid', S.boss.kind === 'mid');
      bossLabel.textContent = S.boss.kind === 'mid' ? T('gs.bullethell.midBossLabel') : T('gs.bullethell.finalBossLabel');
      bossFill.style.width = (Math.max(0, S.boss.hp / S.boss.maxHp) * 100) + '%';
      phaseEl.textContent = T('gs.bullethell.phaseText').replace('{n}', (S.bossPhase | 0) + 1);
    } else {
      bossWrap.classList.add('hidden');
      bossWrap.classList.remove('mid');
    }
  }

  function updateDiffSelection() {
    if (!diffRow) return;
    var btns = diffRow.querySelectorAll('.bh-diff');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('selected', btns[i].getAttribute('data-d') === selDiff);
    }
  }
  function updateShipSelection() {
    if (!shipRow) return;
    var btns = shipRow.querySelectorAll('.bh-pick');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('selected', btns[i].getAttribute('data-ship') === selShip);
    }
  }
  function updateWeaponSelection() {
    if (!weaponRow) return;
    var btns = weaponRow.querySelectorAll('.bh-pick');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('selected', btns[i].getAttribute('data-weapon') === selWeapon);
    }
  }
  function updatePracticeUi() {
    practiceBtn.classList.toggle('on', selPractice);
    practiceBtn.setAttribute('aria-pressed', selPractice ? 'true' : 'false');
    practiceState.textContent = selPractice ? T('gs.bullethell.practiceOn') : T('gs.bullethell.practiceOff');
    waveRow.classList.toggle('hidden', !selPractice);
    var btns = waveRow.querySelectorAll('.bh-wave-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('selected', Number(btns[i].getAttribute('data-wave')) === selStartWave);
    }
  }
  function updateSelectors() {
    updateDiffSelection();
    updateShipSelection();
    updateWeaponSelection();
    updatePracticeUi();
  }
  function setShip(k) {
    if (!SHIPS[k]) return;
    selShip = k;
    savePrefs();
    if (S.mode === 'menu') {
      S.shipKey = k;
      S.lives = S.practice ? 999 : SHIPS[k].lives;
    }
    updateShipSelection();
    updateHud();
    audio('ui');
  }
  function setWeapon(k) {
    if (!WEAPONS[k]) return;
    selWeapon = k;
    if (S.mode === 'playing' || S.mode === 'menu') S.weaponKey = k;
    savePrefs();
    updateWeaponSelection();
    updateHud();
    audio('ui');
  }
  function cycleShip(dir) {
    var idx = SHIP_KEYS.indexOf(selShip);
    setShip(SHIP_KEYS[(idx + (dir || 1) + SHIP_KEYS.length) % SHIP_KEYS.length]);
  }
  function cycleWeapon(dir) {
    var idx = WEAPON_KEYS.indexOf(selWeapon);
    setWeapon(WEAPON_KEYS[(idx + (dir || 1) + WEAPON_KEYS.length) % WEAPON_KEYS.length]);
  }
  function switchWeaponInGame(k) {
    if (S.mode !== 'playing' && S.mode !== 'paused') return;
    if (!WEAPONS[k] || k === S.weaponKey) return;
    S.weaponKey = k;
    selWeapon = k;
    savePrefs();
    updateHud();
    showBanner(weaponName(k), T('gs.bullethell.weaponSwitchSub'), 'var(--neon-yellow)', 900);
    audio('ui');
  }
  function restartCurrent() {
    var practice = S.practice, startWave = S.practice ? S.startWave : 1;
    startGame(S.diffKey, { practice: practice, startWave: startWave });
  }

  function hideOverlays() {
    startEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    resultEl.classList.add('hidden');
  }

  function clearKeys() {
    keys.left = keys.right = keys.up = keys.down = false;
    focusHold = false; focusKey = false; touchFocus = false;
    drag.active = false; drag.id = null;
    pointers = {}; primaryPointer = null;
    focusBtn.setAttribute('aria-pressed', 'false');
  }

  function showBanner(main, sub, color, ms) {
    bannerEl.innerHTML = '';
    var m = document.createElement('div');
    m.className = 'm';
    m.textContent = main;
    bannerEl.appendChild(m);
    if (sub) {
      var s = document.createElement('span');
      s.className = 's';
      s.textContent = sub;
      bannerEl.appendChild(s);
    }
    bannerEl.style.color = color || 'var(--neon-cyan)';
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { bannerEl.classList.remove('show'); }, ms || 1600);
  }

  /* ---------------- 开局 / 菜单 ---------------- */
  function startGame(diffKey, opts) {
    opts = opts || {};
    var key = DIFFS[diffKey] ? diffKey : 'normal';
    var practice = opts.practice !== undefined ? !!opts.practice : selPractice;
    var startWave = opts.startWave || (practice ? selStartWave : 1);
    selDiff = key;
    if (practice) selStartWave = startWave;
    S = makeState(key, 'playing', {
      practice: practice, startWave: startWave, ship: selShip, weapon: selWeapon
    });
    S.rings.push({ x: W / 2, y: H - 78, r: 3, maxR: 64, grow: 2.4, life: 1, decay: 0.03, color: 'rgba(0,240,255,0.8)', w: 2 });
    clearKeys();
    hideOverlays();
    bestVal = readBest();
    updateSelectors();
    updateHud();
    spawnWave(startWave);
    if (practice) {
      showBanner(T('gs.bullethell.practiceStart').replace('{n}', startWave), T('gs.bullethell.practiceModeHint'), 'var(--neon-yellow)', 1500);
    } else {
      showBanner(T('gs.bullethell.wave').replace('{n}', startWave), T('gs.bullethell.waveSub'), 'var(--neon-cyan)', 1400);
    }
    audio('ui');
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  function openPicker() {
    var key = S ? S.diffKey : selDiff;
    S = makeState(key, 'menu', { practice: selPractice, ship: selShip, weapon: selWeapon });
    selDiff = key;
    clearKeys();
    hideOverlays();
    startEl.classList.remove('hidden');
    updateSelectors();
    bestVal = readBest();
    updateHud();
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    audio('back');
  }

  /* ---------------- 波次 ---------------- */
  function buildWave(n) {
    var conf = S.conf;
    var count = Math.min(8, conf.count + Math.floor((n - 1) / 2));
    var list = [];
    var span = W - 140;
    for (var i = 0; i < count; i++) {
      var type = (i + n) % 3;
      var hp = type === 2 ? 2 + Math.floor(n / 3) : 1;
      if (conf.finalHp >= 180 && type === 2) hp++;
      list.push({
        x: count > 1 ? 70 + span * i / (count - 1) : W / 2,
        y0: -34 - i * 14,
        ty: 76 + (i % 3) * 24,
        hp: hp, type: type,
        gap: 14 + (i % 2) * 4
      });
    }
    return list;
  }

  function spawnWave(n) {
    S.wave = n;
    S.waveT = 0;
    if (n === MID_WAVE) { spawnBoss('mid'); return; }
    if (n === FINAL_WAVE) { spawnBoss('final'); return; }
    S.spawnQueue = buildWave(n);
    S.spawnT = 14;
    updateHud();
  }

  function spawnEnemy(spec) {
    S.enemies.push({
      x: spec.x, y: spec.y0, baseX: spec.x, ty: spec.ty,
      hp: spec.hp, maxHp: spec.hp, type: spec.type,
      hitR: spec.type === 2 ? 10 : 8, /* 与自绘核心半径一致，命中/碰撞共用 */
      t: 0, spawnT: 22, flash: 0,
      fireT: 46 + Math.floor(Math.random() * 40),
      lifeT: 200 + Math.floor(Math.random() * 80),
      leaving: false, dead: false,
      phase: Math.random() * Math.PI * 2
    });
  }

  function updateSpawns() {
    if (!S.spawnQueue.length) return;
    S.spawnT--;
    if (S.spawnT > 0) return;
    var spec = S.spawnQueue.shift();
    spawnEnemy(spec);
    S.spawnT = spec.gap;
  }

  /* ---------------- 玩家 / 射击 ---------------- */
  function shipStats() { return SHIPS[S.shipKey] || SHIPS.balanced; }
  function weaponStats() { return WEAPONS[S.weaponKey] || WEAPONS.spread; }
  function isFocus() { return !!(focusKey || focusHold || touchFocus); }
  function gain(n) { if (!S.practice) S.score += n; }

  function pushPBullet(x, y, vx, vy, w, dmg) {
    if (S.pbullets.length >= 120) return;
    S.pbullets.push({
      x: x, y: y, vx: vx, vy: vy, w: w, dmg: dmg,
      col: w.col || '#39ff14', homing: !!w.homing, laser: !!w.laser,
      pierce: w.pierce || 0, passT: 0, dead: false, age: 0
    });
  }

  function firePlayer() {
    var p = S.player;
    var w = weaponStats();
    if (S.weaponKey === 'spread') {
      var angs = [-0.17, 0, 0.17];
      for (var i = 0; i < angs.length; i++) {
        pushPBullet(p.x + (i - 1) * 4, p.y - 12,
          Math.sin(angs[i]) * w.speed, -Math.cos(angs[i]) * w.speed, w, w.dmg);
      }
    } else if (S.weaponKey === 'laser') {
      pushPBullet(p.x - 4, p.y - 14, 0, -w.speed, w, w.dmg);
      pushPBullet(p.x + 4, p.y - 14, 0, -w.speed, w, w.dmg);
    } else {
      pushPBullet(p.x - 6, p.y - 12, -1.2, -w.speed, w, w.dmg);
      pushPBullet(p.x + 6, p.y - 12, 1.2, -w.speed, w, w.dmg);
    }
  }

  function nearestTarget(x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd) { bd = d; best = { x: e.x, y: e.y }; }
    }
    if (S.boss && !S.bossDefeated) {
      var db = (S.boss.x - x) * (S.boss.x - x) + (S.boss.y - y) * (S.boss.y - y);
      if (db < bd) best = { x: S.boss.x, y: S.boss.y };
    }
    return best;
  }

  function steerHoming(b) {
    var target = nearestTarget(b.x, b.y);
    if (!target) return;
    var cur = Math.atan2(b.vy, b.vx);
    var want = Math.atan2(target.y - b.y, target.x - b.x);
    var diff = want - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    diff = clamp(diff, -0.12, 0.12);
    var sp = Math.hypot(b.vx, b.vy) || 9;
    b.vx = Math.cos(cur + diff) * sp;
    b.vy = Math.sin(cur + diff) * sp;
  }

  function updatePlayerBullets() {
    var keep = [];
    for (var i = 0; i < S.pbullets.length; i++) {
      var b = S.pbullets[i];
      b.age++;
      if (b.passT > 0) b.passT--;
      if (b.homing) steerHoming(b);
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -18 || b.x < -14 || b.x > W + 14 || b.y > H + 20) continue;
      var hit = false;
      if (b.passT <= 0) {
        for (var j = 0; j < S.enemies.length; j++) {
          var e = S.enemies[j];
          if (e.dead) continue;
          if (hitEnemy(b.x, b.y, e.x, e.y, e.hitR)) {
            e.hp -= b.dmg; e.flash = 10; gain(b.dmg);
            impactAt(b.x, b.y, ENEMY_COL[e.type], false);
            hit = true;
            if (e.hp <= 0) killEnemy(e);
            break;
          }
        }
        if (!hit && S.boss && !S.bossDefeated) {
          if (hitEnemy(b.x, b.y, S.boss.x, S.boss.y, S.boss.hitR)) {
            S.boss.hp -= b.dmg; S.boss.flash = 10; gain(b.dmg * 2);
            impactAt(b.x, b.y, '#ffe600', true);
            hit = true;
            if (S.boss.hp <= 0) { killBoss(); break; }
          }
        }
      }
      if (hit && b.pierce > 0) { b.pierce--; b.passT = 7; hit = false; }
      if (!hit) keep.push(b);
    }
    S.pbullets = keep;
  }

  /* ---------------- 敌机 ---------------- */
  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    gain(100 + S.wave * 10);
    explode(e.x, e.y, ENEMY_COL[e.type] || '#ff2d95', false);
    floatText(e.x, e.y - 8, '+' + (100 + S.wave * 10), '#ffe600');
    S.shakeT = Math.max(S.shakeT, 5);
    audio('clear');
  }

  function fireEnemy(e) {
    var sp = S.conf.speed;
    var col = ENEMY_COL[e.type];
    var aim = aimAngle(S.player.x, S.player.y, e.x, e.y);
    var ox = e.x, oy = e.y + 10;
    if (e.type === 0) {
      fanPattern(3, aim, Math.PI * 0.32, sp * 1.2).forEach(function (v) {
        addEBullet(ox, oy, v[0], v[1], col, 4.2);
      });
    } else if (e.type === 1) {
      ringPattern(8 + Math.floor(S.wave / 2), sp * 0.85, e.phase, Math.PI * 2, null).forEach(function (v) {
        addEBullet(ox, oy, v[0], v[1], col, 4.4);
      });
    } else {
      fanPattern(5, aim, Math.PI * 0.5, sp * 0.95).forEach(function (v) {
        addEBullet(ox, oy, v[0], v[1], col, 4.8);
      });
    }
  }

  function updateEnemies() {
    var keep = [];
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      e.t++;
      if (e.flash > 0) e.flash--;
      if (e.spawnT > 0) {
        e.spawnT--;
        e.y += (e.ty - e.y) * 0.14;
        keep.push(e);
        continue;
      }
      if (e.leaving) {
        e.y += 2.8;
        if (e.y > H + 44) e.dead = true; else keep.push(e);
        continue;
      }
      e.x = e.baseX + Math.sin(e.t * 0.05 + e.phase) * 14;
      e.y += (e.ty - e.y) * 0.05;
      e.lifeT--;
      if (e.lifeT <= 0) { e.leaving = true; keep.push(e); continue; }
      e.fireT--;
      if (e.fireT <= 0) {
        fireEnemy(e);
        e.fireT = S.conf.fireGap + Math.floor(Math.random() * 18);
      }
      keep.push(e);
    }
    S.enemies = keep;
  }

  function addEBullet(x, y, vx, vy, col, r, homing) {
    if (S.ebullets.length >= 480) return;
    S.ebullets.push({
      x: x, y: y, vx: vx, vy: vy, col: col || '#ff2d95', r: r || 4.4,
      homing: !!homing, grazed: false, dead: false
    });
  }

  /* ---------------- Boss（中 Boss / 最终 Boss） ---------------- */
  function spawnBoss(kind) {
    if (S.boss) return;
    var isMid = kind === 'mid';
    var cfg = S.conf;
    var hp = isMid ? cfg.midHp : cfg.finalHp;
    S.bossSpawned = true;
    S.boss = {
      kind: isMid ? 'mid' : 'final',
      x: W / 2, y: -84, ty: isMid ? 112 : 106,
      hp: hp, maxHp: hp,
      t: 0, intro: isMid ? 64 : 80, flash: 0, angle: 0,
      fireT: isMid ? 58 : 76, volley: 0, spiralA: 0,
      hitR: isMid ? 11 : 16
    };
    S.bossPhase = 0;
    S.ebullets.length = 0;
    if (isMid) {
      showBanner(T('gs.bullethell.midBossWarn'), T('gs.bullethell.midBossWarnSub'), 'var(--neon-orange)', 2300);
      audio('drop');
      if (Arcade.fx) Arcade.fx.flash('var(--neon-orange)');
    } else {
      showBanner(T('gs.bullethell.bossWarn'), T('gs.bullethell.bossWarnSub'), 'var(--neon-pink)', 2600);
      audio('error');
      if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
    }
    updateHud();
  }

  function updateBoss() {
    var b = S.boss;
    if (!b) return;
    b.t++;
    if (b.flash > 0) b.flash--;
    if (b.intro > 0) {
      b.intro--;
      b.y += (b.ty - b.y) * 0.06;
      b.x = W / 2 + Math.sin(b.t * 0.02) * 18;
      return;
    }
    if (b.kind === 'mid') {
      b.x = W / 2 + Math.sin(b.t * 0.012) * 96;
      b.y = b.ty + Math.sin(b.t * 0.03) * 14;
      b.angle += 0.06;
    } else {
      b.x = W / 2 + Math.sin(b.t * 0.007) * 76;
      b.y = b.ty + Math.sin(b.t * 0.02) * 9;
      b.angle += 0.045;
    }
    var ph = b.kind === 'mid'
      ? (b.hp / b.maxHp > 0.5 ? 0 : 1)
      : bossPhaseOf(b.hp, b.maxHp);
    if (ph > S.bossPhase) { S.bossPhase = ph; onBossPhase(ph); }
    b.fireT--;
    if (b.fireT <= 0) bossFire(b, S.bossPhase);
    if (b.hp / b.maxHp < (b.kind === 'mid' ? 0.5 : 0.34) && b.t % 7 === 0) {
      addParticle({
        x: b.x + rand(-24, 24), y: b.y + rand(-16, 16),
        vx: rand(-0.35, 0.35), vy: -0.35 - Math.random() * 0.5,
        life: 0.6, decay: 0.024, kind: 0, size: 2.6, z: 0, color: 'rgba(255,120,70,0.55)'
      });
    }
  }

  function onBossPhase(ph) {
    S.ebullets.length = 0;
    S.flashT = 12;
    S.flashColor = 'rgba(255,230,0,0.45)';
    S.shakeT = 16;
    if (S.boss) {
      explode(S.boss.x, S.boss.y, '#ffe600', true);
      S.rings.push({
        x: S.boss.x, y: S.boss.y, r: 12, maxR: 190, grow: 6.4, life: 1,
        decay: 0.016, color: 'rgba(255,230,0,0.9)', w: 3
      });
    }
    showBanner(T('gs.bullethell.phaseText').replace('{n}', ph + 1), T('gs.bullethell.phaseSub'), 'var(--neon-yellow)', 1400);
    audio('drop');
    if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
  }

  function fanShot(ox, oy, aim, n, spread, speed, col, r) {
    fanPattern(n, aim, spread, speed).forEach(function (v) {
      addEBullet(ox, oy, v[0], v[1], col, r);
    });
  }
  function ringShot(ox, oy, n, speed, rot, col, r) {
    ringPattern(n, speed, rot, Math.PI * 2, null).forEach(function (v) {
      addEBullet(ox, oy, v[0], v[1], col, r);
    });
  }

  function bossFire(b, ph) {
    var cfg = S.conf;
    var col = BOSS_COL[Math.min(ph, 2)];
    var aim = aimAngle(S.player.x, S.player.y, b.x, b.y);
    var ox = b.x, oy = b.y + 16;
    var isMid = b.kind === 'mid';
    b.volley = (b.volley || 0) + 1;

    if (isMid) {
      if (ph === 0) {
        /* 中 Boss 阶段1：环形脉冲 + 瞄准扇形 */
        b.fireT = Math.max(30, cfg.bossGap0 - 8);
        ringShot(ox, oy, Math.max(8, cfg.ringN - 2), cfg.speed * 0.95, b.t * 0.015, col, 4.4);
        if (b.volley % 2 === 0) fanShot(ox, oy, aim, 3, Math.PI * 0.3, cfg.speed * 1.25, '#ff9f1c', 4.2);
      } else {
        /* 中 Boss 阶段2：双螺旋 + 追踪弹 */
        b.fireT = Math.max(13, cfg.spiralGap - 2);
        b.spiralA += 0.26;
        var v = spiralPattern(cfg.speed * 1.2, b.spiralA);
        addEBullet(ox, oy, v[0], v[1], col, 4.1);
        var v2 = spiralPattern(cfg.speed * 1.2, b.spiralA + Math.PI);
        addEBullet(ox, oy, v2[0], v2[1], col, 4.1);
        if (b.volley % 6 === 0) {
          addEBullet(ox, oy, Math.cos(aim) * cfg.speed * 1.05, Math.sin(aim) * cfg.speed * 1.05, '#ffe600', 5, true);
        }
      }
      return;
    }

    if (ph === 0) {
      b.fireT = cfg.bossGap0;
      ringShot(ox, oy, cfg.ringN, cfg.speed * 0.92, b.t * 0.01, col, 4.6);
      if (b.volley % 2 === 0) fanShot(ox, oy, aim, 3, Math.PI * 0.24, cfg.speed * 1.2, '#ff9f1c', 4.2);
      if (b.volley % 5 === 0) {
        addEBullet(ox, oy, Math.cos(aim) * cfg.speed, Math.sin(aim) * cfg.speed, '#ffe600', 4.8, true);
      }
    } else if (ph === 1) {
      b.fireT = cfg.spiralGap;
      b.spiralA += 0.3;
      var arms = cfg.finalHp >= 180 ? 3 : 2;
      for (var k = 0; k < arms; k++) {
        var sv = spiralPattern(cfg.speed * 1.15, b.spiralA + k * Math.PI * 2 / arms);
        addEBullet(ox, oy, sv[0], sv[1], col, 4.1);
      }
      if (b.volley % 7 === 0) fanShot(ox, oy, aim, 4, Math.PI * 0.4, cfg.speed * 1.2, '#ffe600', 4.4);
    } else {
      b.fireT = cfg.bossGap2;
      if (b.volley % 2 === 0) {
        ringShot(ox, oy, cfg.ringN + 6, cfg.speed * 0.88, b.t * 0.02, col, 5);
      } else {
        fanShot(ox, oy, aim, 7, Math.PI * 0.42, cfg.speed * 1.3, '#ffe600', 4.8);
      }
      b.spiralA += 0.34;
      var a1 = spiralPattern(cfg.speed * 1.35, b.spiralA);
      var a2 = spiralPattern(cfg.speed * 1.35, b.spiralA + Math.PI);
      addEBullet(ox, oy, a1[0], a1[1], BOSS_COL[2], 4.2);
      addEBullet(ox, oy, a2[0], a2[1], BOSS_COL[2], 4.2);
      if (b.volley % 4 === 0) {
        addEBullet(ox, oy, Math.cos(aim) * cfg.speed * 1.1, Math.sin(aim) * cfg.speed * 1.1, '#ffe600', 5, true);
        addEBullet(ox, oy, Math.cos(aim + 0.22) * cfg.speed * 1.1, Math.sin(aim + 0.22) * cfg.speed * 1.1, '#ffe600', 5, true);
      }
    }
  }

  function killBoss() {
    var b = S.boss;
    if (!b) return;
    var bx = b.x, by = b.y;
    var isMid = b.kind === 'mid';
    S.boss = null;
    S.ebullets.length = 0;
    if (isMid) {
      if (S.bossDownWave === MID_WAVE) return;
      S.bossDownWave = MID_WAVE;
      S.bossSpawned = false;
      S.bossClearT = 58;
      gain(1200);
      floatText(bx, by, '+1200', '#ffe600', true);
      for (var m = 0; m < 5; m++) {
        explode(bx + rand(-40, 40), by + rand(-30, 30), m % 2 ? '#ffe600' : '#ff9f1c', true);
      }
      S.shakeT = 18;
      S.flashT = 16;
      S.flashColor = 'rgba(255,159,28,0.45)';
      showBanner(T('gs.bullethell.midBossDown'), '', 'var(--neon-orange)', 1700);
      audio('clear');
      updateHud();
      return;
    }
    if (S.bossDefeated) return;
    S.bossDefeated = true;
    gain(5000);
    floatText(bx, by, '+5000', '#ffe600', true);
    for (var i = 0; i < 10; i++) {
      explode(bx + rand(-74, 74), by + rand(-48, 48), i % 2 ? '#ffe600' : '#b967ff', true);
    }
    S.shakeT = 28;
    S.flashT = 26;
    S.flashColor = 'rgba(255,230,0,0.6)';
    showBanner(T('gs.bullethell.bossDown'), '', 'var(--neon-green)', 1800);
    startEnding(true);
  }

  /* ---------------- 弹幕 / 擦弹 ---------------- */
  function updateEnemyBullets() {
    var grazeSpawn = 0;
    var sh = shipStats();
    for (var i = 0; i < S.ebullets.length; i++) {
      var b = S.ebullets[i];
      if (b.dead) continue;
      if (b.homing) {
        var cur = Math.atan2(b.vy, b.vx);
        var want = aimAngle(S.player.x, S.player.y, b.x, b.y);
        var diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        diff = clamp(diff, -0.012, 0.012);
        var sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur + diff) * sp;
        b.vy = Math.sin(cur + diff) * sp;
      }
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -16 || b.x > W + 16 || b.y < -18 || b.y > H + 24) { b.dead = true; continue; }
      var j = judgeHit(S.player.x, S.player.y, b.x, b.y, sh.hitR, sh.graze);
      if (j === 0) {
        b.dead = true;
        if (S.invT <= 0) {
          takeHit();
          if (S.mode !== 'playing') break;
        }
      } else if (j === 1 && !b.grazed) {
        b.grazed = true;
        S.graze++;
        S.grazeCombo++;
        S.comboIdle = 150;
        gain(2 + Math.min(10, Math.floor(S.grazeCombo / 8)));
        if (grazeSpawn < 6) { grazeSpawn++; grazeSpark(b.x, b.y); }
        if (S.grazeCombo % 10 === 0) floatText(S.player.x, S.player.y - 20, 'GRAZE ' + S.grazeCombo, '#ffe600');
        if (S.grazeSndT <= 0) { audio('type'); S.grazeSndT = 8; }
      }
    }
    S.ebullets = S.ebullets.filter(function (b) { return !b.dead; });
  }

  function takeHit() {
    if (S.invT > 0 || S.mode !== 'playing') return;
    if (!S.practice) S.lives--;
    S.invT = 94; /* ≈1.5s 无敌闪烁 */
    S.grazeCombo = 0;
    S.comboIdle = 0;
    explode(S.player.x, S.player.y, '#00f0ff', true);
    S.ebullets.length = 0;
    S.shakeT = 18;
    S.flashT = 12;
    S.flashColor = 'rgba(255,45,149,0.55)';
    if (Arcade.juice) Arcade.juice.lose(); else audio('lose');
    if (Arcade.fx) Arcade.fx.shake(stageEl);
    updateHud();
    if (!S.practice && S.lives <= 0) startEnding(false);
  }

  /* ---------------- 粒子 / 冲击波 ---------------- */
  function addParticle(p) {
    if (S.particles.length >= 560) return;
    if (typeof p.z !== 'number') p.z = 1; /* 0=机身后景 / 1=前景火花 */
    S.particles.push(p);
  }

  /* 浮字反馈：easeOutCubic 上浮 + easeOutBack 弹出 */
  function floatText(x, y, str, color, big) {
    if (S.texts.length > 22) S.texts.shift();
    S.texts.push({
      x: x, y: y, str: String(str), color: color || '#ffe600',
      t: 0, dur: big ? 64 : 44, size: big ? 14 : 10
    });
  }
  function updateTexts(scale) {
    for (var i = S.texts.length - 1; i >= 0; i--) {
      var t = S.texts[i];
      t.t += scale;
      if (t.t >= t.dur) S.texts.splice(i, 1);
    }
  }

  function sparkAt(x, y, color, count, spread) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = rand(0.4, 1.8) * (spread || 1);
      addParticle({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, decay: rand(0.035, 0.07), kind: 0, size: rand(1, 2.4), color: color || '#ffe600'
      });
    }
  }

  /* 命中反馈：白色闪核 + 火花 + 冲击环，比旧版更明显 */
  function impactAt(x, y, color, big) {
    sparkAt(x, y, color || '#ffe600', big ? 9 : 5, big ? 0.8 : 0.5);
    sparkAt(x, y, '#ffffff', big ? 4 : 2, 0.35);
    S.rings.push({
      x: x, y: y, r: 1.5, maxR: big ? 26 : 15, grow: big ? 2.4 : 1.6,
      life: 1, decay: 0.08, color: 'rgba(255,255,255,0.9)', w: big ? 2.2 : 1.4
    });
  }

  function grazeSpark(bx, by) {
    for (var i = 0; i < 4; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = rand(0.5, 1.8);
      addParticle({
        x: S.player.x + Math.cos(a) * 12, y: S.player.y + Math.sin(a) * 12,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.25,
        life: 1, decay: rand(0.04, 0.08), kind: 0, size: rand(1.1, 2.2), color: '#ffe600'
      });
    }
    if (bx !== undefined) {
      addParticle({
        x: bx, y: by, vx: 0, vy: 0, life: 1, decay: 0.11, kind: 0, size: 2.0, color: '#ffffff'
      });
      S.rings.push({
        x: bx, y: by, r: 2, maxR: 22, grow: 1.9, life: 1,
        decay: 0.075, color: 'rgba(255,230,0,0.85)', w: 1.6
      });
    }
  }

  function explode(x, y, color, big) {
    var n = big ? 34 : 16;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = big ? rand(1.2, 5.4) : rand(0.5, 2.6);
      addParticle({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, decay: rand(0.018, 0.045), kind: 0,
        size: rand(1.4, big ? 4.2 : 2.8), color: color
      });
    }
    var frags = big ? 16 : 6;
    for (var f = 0; f < frags; f++) {
      var fa = Math.random() * Math.PI * 2;
      var fs = big ? rand(1.4, 5) : rand(0.6, 2.8);
      addParticle({
        x: x, y: y, vx: Math.cos(fa) * fs, vy: Math.sin(fa) * fs,
        life: 1, decay: rand(0.012, 0.026), kind: 1,
        size: rand(3, big ? 9 : 5), rot: Math.random() * Math.PI, vr: rand(-0.35, 0.35), color: color
      });
    }
    S.rings.push({
      x: x, y: y, r: big ? 10 : 5, maxR: big ? 124 : 44,
      grow: (big ? 124 : 44) / 34, life: 1,
      decay: big ? 0.016 : 0.035, color: color, w: big ? 3 : 2
    });
    if (big) {
      S.rings.push({
        x: x, y: y, r: 6, maxR: 180, grow: 5.2, life: 1,
        decay: 0.01, color: 'rgba(255,255,255,0.8)', w: 2
      });
    }
  }

  function updateParticles(scale) {
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.life -= p.decay * scale;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      p.x += p.vx * scale;
      p.y += p.vy * scale;
      p.vx *= 0.985;
      p.vy *= 0.985;
      if (p.kind === 1) p.rot += p.vr * scale;
    }
  }

  function updateRings(scale) {
    for (var i = S.rings.length - 1; i >= 0; i--) {
      var r = S.rings[i];
      r.life -= r.decay * scale;
      r.r += r.grow * scale;
      if (r.life <= 0 || r.r > r.maxR) { S.rings.splice(i, 1); }
    }
  }

  /* ---------------- 结算 ---------------- */
  function startEnding(win) {
    if (S.mode !== 'playing') return;
    S.mode = 'ending';
    S.endWin = win;
    S.endT = win ? 152 : 122;
    S.ebullets.length = 0;
    S.enemies.length = 0;
    S.rings.push({ x: W / 2, y: H / 2, r: 20, maxR: 420, grow: 9, life: 1, decay: 0.012, color: win ? 'rgba(255,230,0,0.6)' : 'rgba(255,45,149,0.5)', w: 3 });
    if (!S.submitted) {
      S.submitted = true;
      if (S.practice) {
        /* 练习模式：不计分、不提交最高分 */
        S.isRecord = false;
        S.bestAtEnd = readBest();
      } else {
        S.isRecord = !!(Arcade.shell && Arcade.shell.submitScore ? Arcade.shell.submitScore(S.score) : false);
        S.bestAtEnd = readBest();
      }
      bestVal = S.bestAtEnd;
    }
    if (win) {
      if (Arcade.juice) Arcade.juice.win();
      if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
    }
  }

  function showResult() {
    S.mode = 'result';
    S.endT = 0;
    if (S.endWin) {
      resTitle.textContent = T('gs.bullethell.resWinT');
      resTitle.className = 'win';
      resDesc.textContent = T('gs.bullethell.resWinD');
    } else {
      resTitle.textContent = T('gs.bullethell.resLoseT');
      resTitle.className = 'lose';
      resDesc.textContent = T('gs.bullethell.resLoseD');
    }
    if (S.practice) resDesc.textContent += ' ' + T('gs.bullethell.resPracticeNote');
    resScore.textContent = String(S.score);
    resGraze.textContent = String(S.graze);
    resWave.textContent = (Math.max(1, Math.min(S.wave, S.conf.waves))) + ' / ' + S.conf.waves;
    resBest.textContent = S.bestAtEnd == null ? '----' : String(S.bestAtEnd);
    recordEl.classList.toggle('on', !!S.isRecord && S.score > 0);
    resPracticeEl.classList.toggle('hidden', !S.practice);
    bestVal = S.bestAtEnd != null ? S.bestAtEnd : readBest();
    updateHud();
    resultEl.classList.remove('hidden');
    if (loopApi) loopApi.pause();
  }

  /* ---------------- 循环 ---------------- */
  function update() {
    bgT++;
    S.t++;
    updateStars();
    if (S.mode === 'menu' || S.mode === 'result') return;
    if (S.mode === 'paused') return;
    if (S.mode === 'ending') { updateEnding(); return; }
    if (S.mode === 'playing') updatePlaying();
  }

  function updatePlaying() {
    var p = S.player;
    if (S.invT > 0) S.invT--;
    if (S.shakeT > 0) S.shakeT--;
    if (S.flashT > 0) S.flashT--;
    if (S.grazeSndT > 0) S.grazeSndT--;
    if (S.enterT > 0) S.enterT--;
    if (S.comboIdle > 0) {
      S.comboIdle--;
      if (S.comboIdle === 0) S.grazeCombo = 0;
    }

    var dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    var dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (dx || dy) {
      var len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
    }
    var sh = shipStats();
    var speed = isFocus() ? sh.focus : sh.speed;
    p.x = clamp(p.x + dx * speed, 14, W - 14);
    p.y = clamp(p.y + dy * speed, 34, H - 16);

    S.fireT--;
    if (S.fireT <= 0 && S.enterT <= 0) { S.fireT = weaponStats().gap; firePlayer(); }

    updatePlayerBullets();
    if (S.mode !== 'playing') return;
    updateSpawns();
    updateEnemies();
    if (S.mode !== 'playing') return;
    updateBoss();
    if (S.mode !== 'playing') return;
    updateEnemyBullets();
    if (S.mode !== 'playing') return;
    updateParticles(1);
    updateRings(1);
    updateTexts(1);
    updateWaveFlow();
    updateHud();
  }

  function updateWaveFlow() {
    if (S.boss || S.mode !== 'playing') return;
    if (S.bossClearT > 0) {
      S.bossClearT--;
      if (S.bossClearT === 0) {
        S.wave = MID_WAVE + 1;
        spawnWave(S.wave);
        showBanner(T('gs.bullethell.wave').replace('{n}', S.wave), T('gs.bullethell.waveSub'), 'var(--neon-cyan)', 1500);
        audio('ui');
      }
      return;
    }
    if (S.spawnQueue.length || S.enemies.length) { S.waveT = 0; return; }
    if (S.wave === MID_WAVE) { spawnBoss('mid'); return; }
    if (S.wave === FINAL_WAVE) { spawnBoss('final'); return; }
    S.waveT++;
    if (S.waveT < 50) return;
    S.waveT = 0;
    if (S.wave >= TOTAL_WAVES) return;
    S.wave++;
    gain(100);
    spawnWave(S.wave);
    if (S.wave !== MID_WAVE && S.wave !== FINAL_WAVE) {
      showBanner(T('gs.bullethell.wave').replace('{n}', S.wave), T('gs.bullethell.waveSub'), 'var(--neon-cyan)', 1500);
      audio('ui');
    }
    updateHud();
  }

  function updateEnding() {
    S.endT--;
    S.shakeT = Math.max(0, S.shakeT - 1);
    if (S.flashT > 0) S.flashT--;
    if (S.endWin) {
      if (S.endT % 15 === 0 && S.endT > 34) {
        explode(rand(70, W - 70), rand(70, 300), (S.endT % 30 === 0) ? '#ffe600' : '#b967ff', true);
      }
      if (S.endT === 98) {
        S.flashT = 18;
        S.flashColor = 'rgba(255,255,255,0.7)';
        if (Arcade.fx) Arcade.fx.flash('var(--neon-yellow)');
      }
    }
    updateParticles(S.endWin ? 0.55 : 1);
    updateRings(S.endWin ? 0.55 : 1);
    updateTexts(S.endWin ? 0.55 : 1);
    if (S.endT <= 0) showResult();
  }

  /* ---------------- 输入 ---------------- */
  function pointerPos(ev) {
    if (window.GK && GK.pointer) return GK.pointer(canvas, ev);
    var r = canvas.getBoundingClientRect();
    var t = (ev.touches && ev.touches[0]) || ev;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }

  function movePlayerBy(dx, dy) {
    if (S.mode !== 'playing') return;
    S.player.x = clamp(S.player.x + dx, 14, W - 14);
    S.player.y = clamp(S.player.y + dy, 34, H - 16);
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (S.mode !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var id = e.pointerId === undefined ? 1 : e.pointerId;
    var p = pointerPos(e);
    pointers[id] = true;
    if (!drag.active) {
      /* 第一指：拖动移动 */
      drag.active = true;
      drag.id = id;
      drag.x = p.x;
      drag.y = p.y;
      primaryPointer = id;
      try { canvas.setPointerCapture(id); } catch (err) {}
    } else if (id !== drag.id) {
      /* 第二指按下：立即进入集中/低速，不再移动 */
      touchFocus = true;
      focusBtn.setAttribute('aria-pressed', 'true');
    }
    if (e.cancelable) e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag.active || e.pointerId !== drag.id) return;
    var p = pointerPos(e);
    var dx = p.x - drag.x;
    var dy = p.y - drag.y;
    drag.x = p.x;
    drag.y = p.y;
    movePlayerBy(dx, dy);
    if (e.cancelable) e.preventDefault();
  });
  function endDrag(e) {
    var id = e && e.pointerId !== undefined ? e.pointerId : drag.id;
    if (id !== undefined) delete pointers[id];
    if (drag.active && id === drag.id) {
      drag.active = false;
      drag.id = null;
      primaryPointer = null;
    }
    if (id !== primaryPointer) {
      touchFocus = false;
      focusBtn.setAttribute('aria-pressed', 'false');
    }
    if (!drag.active && Object.keys(pointers).length === 0) {
      touchFocus = false;
      focusBtn.setAttribute('aria-pressed', 'false');
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', function (e) { if (!drag.active) return; /* capture 维持拖拽 */ });

  document.addEventListener('keydown', function (e) {
    var key = e.key || '';
    var code = e.code || '';
    var tag = e.target && e.target.tagName;
    var onControl = tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (onControl && (code === 'Space' || key === 'Enter')) return;
    if (key === 'p' || key === 'P' || key === 'Escape' || key === 'Esc') {
      if (S.mode === 'playing' || S.mode === 'paused') { e.preventDefault(); togglePause(); }
      return;
    }
    if (code === 'Space') {
      if (S.mode === 'playing' || S.mode === 'paused') {
        if (e.repeat) return;
        e.preventDefault();
        togglePause();
      }
      return;
    }
    if (key === 'Enter') {
      if (S.mode === 'menu') startGame(selDiff);
      else if (S.mode === 'result') restartCurrent();
      return;
    }
    if (key === 'Shift') { focusKey = true; return; }
    /* 开始界面：←→ 换机体，↑↓ 换武器 */
    if (S.mode === 'menu') {
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') { e.preventDefault(); cycleShip(-1); }
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') { e.preventDefault(); cycleShip(1); }
      else if (key === 'ArrowUp' || key === 'w' || key === 'W') { e.preventDefault(); cycleWeapon(-1); }
      else if (key === 'ArrowDown' || key === 's' || key === 'S') { e.preventDefault(); cycleWeapon(1); }
      else if (key === '1' || key === '2' || key === '3') { e.preventDefault(); setWeapon(WEAPON_KEYS[Number(key) - 1]); }
      return;
    }
    if (S.mode !== 'playing') return;
    if (key === 'z' || key === 'Z') { e.preventDefault(); switchWeaponInGame(WEAPON_KEYS[(WEAPON_KEYS.indexOf(S.weaponKey) + 2) % 3]); return; }
    if (key === 'x' || key === 'X') { e.preventDefault(); switchWeaponInGame(WEAPON_KEYS[(WEAPON_KEYS.indexOf(S.weaponKey) + 1) % 3]); return; }
    if (key === '1' || key === '2' || key === '3') { e.preventDefault(); switchWeaponInGame(WEAPON_KEYS[Number(key) - 1]); return; }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') { e.preventDefault(); keys.left = true; }
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') { e.preventDefault(); keys.right = true; }
    else if (key === 'ArrowUp' || key === 'w' || key === 'W') { e.preventDefault(); keys.up = true; }
    else if (key === 'ArrowDown' || key === 's' || key === 'S') { e.preventDefault(); keys.down = true; }
  });
  document.addEventListener('keyup', function (e) {
    var key = e.key || '';
    if (key === 'Shift') focusKey = false;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') keys.left = false;
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') keys.right = false;
    else if (key === 'ArrowUp' || key === 'w' || key === 'W') keys.up = false;
    else if (key === 'ArrowDown' || key === 's' || key === 'S') keys.down = false;
  });
  window.addEventListener('blur', clearKeys);

  function togglePause() {
    if (S.mode === 'playing') {
      S.mode = 'paused';
      clearKeys();
      pauseEl.classList.remove('hidden');
      if (loopApi) loopApi.pause();
      audio('ui');
    } else if (S.mode === 'paused') {
      S.mode = 'playing';
      pauseEl.classList.add('hidden');
      if (loopApi) loopApi.resume();
      audio('ui');
    }
  }

  pauseBtn.addEventListener('click', function () { this.blur(); togglePause(); });
  document.getElementById('bh-resume').addEventListener('click', function () { this.blur(); togglePause(); });
  document.getElementById('bh-pause-restart').addEventListener('click', function () {
    this.blur();
    restartCurrent();
  });
  document.getElementById('bh-pause-change').addEventListener('click', function () { this.blur(); openPicker(); });
  document.getElementById('bh-again').addEventListener('click', function () { this.blur(); restartCurrent(); });
  document.getElementById('bh-change').addEventListener('click', function () { this.blur(); openPicker(); });
  document.getElementById('bh-start-btn').addEventListener('click', function () { this.blur(); startGame(selDiff); });
  weaponBtn.addEventListener('click', function () {
    this.blur();
    switchWeaponInGame(WEAPON_KEYS[(WEAPON_KEYS.indexOf(S.weaponKey) + 1) % 3]);
  });

  (function bindShips() {
    var btns = shipRow.querySelectorAll('.bh-pick');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        this.blur();
        setShip(this.getAttribute('data-ship'));
      });
    }
  })();
  (function bindWeapons() {
    var btns = weaponRow.querySelectorAll('.bh-pick');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        this.blur();
        setWeapon(this.getAttribute('data-weapon'));
      });
    }
  })();
  practiceBtn.addEventListener('click', function () {
    this.blur();
    selPractice = !selPractice;
    if (!selPractice) selStartWave = 1;
    if (S.mode === 'menu') { S.practice = selPractice; S.startWave = selStartWave; }
    savePrefs();
    updatePracticeUi();
    updateHud();
    audio('ui');
  });
  (function bindWaves() {
    var btns = waveRow.querySelectorAll('.bh-wave-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        this.blur();
        selStartWave = Number(this.getAttribute('data-wave')) || 1;
        if (S.mode === 'menu') S.startWave = selStartWave;
        savePrefs();
        updatePracticeUi();
        audio('ui');
      });
    }
  })();

  (function bindDiff() {
    var btns = diffRow.querySelectorAll('.bh-diff');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        selDiff = this.getAttribute('data-d');
        updateDiffSelection();
        audio('ui');
      });
    }
  })();

  (function bindFocus() {
    function on() { focusHold = true; }
    function off() { focusHold = false; }
    focusBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); on(); });
    focusBtn.addEventListener('pointerup', off);
    focusBtn.addEventListener('pointerleave', off);
    focusBtn.addEventListener('pointercancel', off);
    window.addEventListener('pointerup', off);
    window.addEventListener('pointercancel', off);
  })();

  window.GAME_RESTART = function () {
    restartCurrent();
  };

  /* 仅在 ?qa=1 时暴露，普通访问无任何调试全局 */
  var QA_ON = /[?&]qa=1(?:&|$|[#])/.test(window.location.search);
  if (QA_ON) {
    window.__qa = {
      state: function () {
        return {
          mode: S.mode, score: S.score, graze: S.graze, wave: S.wave, total: TOTAL_WAVES,
          lives: S.lives, practice: S.practice, ship: S.shipKey, weapon: S.weaponKey,
          shipHitR: (SHIPS[S.shipKey] || SHIPS.balanced).hitR,
          grazeR: (SHIPS[S.shipKey] || SHIPS.balanced).graze,
          focus: isFocus(),
          player: { x: S.player.x, y: S.player.y },
          boss: S.boss ? { kind: S.boss.kind, hp: S.boss.hp, maxHp: S.boss.maxHp, phase: S.bossPhase, hitR: S.boss.hitR, x: S.boss.x, y: S.boss.y, intro: S.boss.intro } : null,
          enemies: S.enemies.filter(function (e) { return !e.dead; }).map(function (e) {
            return { x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, type: e.type, hitR: e.hitR };
          }),
          bullets: S.ebullets.map(function (b) { return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r }; }),
          playerBullets: S.pbullets.slice(0, 80).map(function (b) {
            return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, dmg: b.dmg, laser: !!b.laser, homing: !!b.homing, pierce: b.pierce };
          }),
          submitted: S.submitted, best: bestVal,
          resultVisible: !resultEl.classList.contains('hidden'),
          startVisible: !startEl.classList.contains('hidden')
        };
      },
      /* QA：按真实开局流程启动（可指定难度/机体/武器/练习波次） */
      start: function (o) {
        o = o || {};
        if (o.ship) setShip(o.ship);
        if (o.weapon) setWeapon(o.weapon);
        if (o.diff && DIFFS[o.diff]) selDiff = o.diff;
        if (typeof o.practice === 'boolean') selPractice = o.practice;
        if (o.startWave) selStartWave = o.startWave;
        startGame(o.diff || selDiff, { practice: typeof o.practice === 'boolean' ? o.practice : selPractice, startWave: o.startWave || 1 });
        return this.state();
      },
      switchWeapon: switchWeaponInGame,
      forceWin: function () {
        if (S.mode === 'menu' || S.mode === 'result') startGame(S.diffKey || selDiff, { practice: S.practice, startWave: S.practice ? S.startWave : 1 });
        if (S.mode === 'paused') { pauseEl.classList.add('hidden'); S.mode = 'playing'; }
        if (S.mode === 'playing') startEnding(true);
        return this.state();
      },
      forceLose: function () {
        if (S.mode === 'menu' || S.mode === 'result') startGame(S.diffKey || selDiff, { practice: S.practice, startWave: S.practice ? S.startWave : 1 });
        if (S.mode === 'paused') { pauseEl.classList.add('hidden'); S.mode = 'playing'; }
        if (S.mode === 'playing') startEnding(false);
        return this.state();
      }
    };
  }

  /* ---------------- 绘制辅助 ---------------- */
  var bulletCache = {};
  function hexToRgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var r = parseInt(h.substr(0, 2), 16) || 0;
    var g = parseInt(h.substr(2, 2), 16) || 0;
    var b = parseInt(h.substr(4, 2), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function bulletSprite(col) {
    if (bulletCache[col]) return bulletCache[col];
    var size = 40;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(20, 20, 0, 20, 20, 19);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.4, col);
    grd.addColorStop(0.72, hexToRgba(col, 0.42));
    grd.addColorStop(1, hexToRgba(col, 0));
    g.fillStyle = grd;
    g.beginPath(); g.arc(20, 20, 19, 0, Math.PI * 2); g.fill();
    bulletCache[col] = c;
    return c;
  }
  function tracePoly(n, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var a = (rot || 0) + i * Math.PI * 2 / n - Math.PI / 2;
      var x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function traceEnemy(type, r) {
    ctx.beginPath();
    if (type === 0) {
      ctx.moveTo(0, r * 1.18);
      ctx.lineTo(-r, -r * 0.58);
      ctx.lineTo(0, -r * 0.24);
      ctx.lineTo(r, -r * 0.58);
    } else if (type === 1) {
      ctx.moveTo(0, r * 1.14);
      ctx.lineTo(r * 0.82, 0);
      ctx.lineTo(0, -r * 1.12);
      ctx.lineTo(-r * 0.82, 0);
    } else {
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 6 + i * Math.PI / 3;
        var x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }

  /* ---------------- 背景 ---------------- */
  function drawBackground() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#050713');
    bg.addColorStop(0.55, '#0b0a1e');
    bg.addColorStop(1, '#140a18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* 星云 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var pulse = 0.5 + Math.sin(bgT * 0.006) * 0.16;
    var n1 = ctx.createRadialGradient(W * 0.28, H * 0.24, 10, W * 0.28, H * 0.24, 250);
    n1.addColorStop(0, 'rgba(80,40,160,' + (0.16 * pulse) + ')');
    n1.addColorStop(1, 'rgba(80,40,160,0)');
    ctx.fillStyle = n1;
    ctx.fillRect(0, 0, W, H);
    var n2 = ctx.createRadialGradient(W * 0.82, H * 0.68, 10, W * 0.82, H * 0.68, 230);
    n2.addColorStop(0, 'rgba(0,120,150,' + (0.14 * pulse) + ')');
    n2.addColorStop(1, 'rgba(0,120,150,0)');
    ctx.fillStyle = n2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    /* 视差星空 */
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.6 + Math.sin(bgT * 0.05 + s.tw) * 0.4;
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = STAR_COL[i % 3];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.z > 0.85) {
        ctx.globalAlpha = s.a * tw * 0.7;
        ctx.fillRect(s.x - 0.5, s.y - 4, 1, 8);
      }
    }
    ctx.globalAlpha = 1;

    /* 扫描网格 */
    var off = (bgT * 0.6) % 44;
    ctx.strokeStyle = 'rgba(0,240,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= W; gx += 44) { ctx.moveTo(gx, 0); ctx.lineTo(gx, H); }
    for (var gy = -44 + off; gy <= H; gy += 44) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke();
  }

  function drawPostFx() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.075)';
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------------- 玩家绘制 ---------------- */
  function drawPlayerBody() {
    var p = S.player;
    var sh = SHIPS[S.shipKey] || SHIPS.balanced;
    var blink = S.invT > 0 && (Math.floor(S.invT / 6) % 2 === 0);
    ctx.save();
    ctx.globalAlpha = blink ? 0.34 : 1;
    ctx.translate(p.x, p.y);
    if (S.enterT > 0) {
      var esc = 0.7 + 0.3 * (1 - S.enterT / 34);
      ctx.scale(esc, esc);
      ctx.globalAlpha *= 0.55 + 0.45 * (1 - S.enterT / 34);
    }

    var wingW = sh.shape === 'heavy' ? 16.5 : (sh.shape === 'swift' ? 10.5 : 13);
    var noseY = sh.shape === 'heavy' ? -14 : (sh.shape === 'swift' ? -20 : -17);
    var tailY = sh.shape === 'heavy' ? 13 : 11;

    /* 引擎辉光 + 尾焰（配色随机体） */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var glow = ctx.createRadialGradient(0, 10, 1, 0, 10, 20);
    glow.addColorStop(0, hexToRgba(sh.hot, 0.55));
    glow.addColorStop(0.5, hexToRgba(sh.col, 0.22));
    glow.addColorStop(1, hexToRgba(sh.col, 0));
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 11, 20, 0, Math.PI * 2); ctx.fill();
    var fh = 13 + Math.sin(S.t * 0.9) * 4;
    var fg = ctx.createLinearGradient(0, 6, 0, 12 + fh);
    fg.addColorStop(0, 'rgba(255,255,255,0.95)');
    fg.addColorStop(0.35, hexToRgba(sh.col, 0.9));
    fg.addColorStop(1, hexToRgba(sh.col, 0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-4, 6); ctx.lineTo(4, 6); ctx.lineTo(0, 12 + fh);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    /* 机翼 */
    var wing = ctx.createLinearGradient(0, -12, 0, 12);
    wing.addColorStop(0, sh.hot);
    wing.addColorStop(0.45, sh.col);
    wing.addColorStop(1, sh.deep);
    ctx.fillStyle = wing;
    ctx.strokeStyle = hexToRgba(sh.hot, 0.78);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, noseY + 5);
    ctx.lineTo(wingW, 4);
    ctx.lineTo(wingW * 0.58, 9);
    ctx.lineTo(2.5, 5);
    ctx.lineTo(-2.5, 5);
    ctx.lineTo(-wingW * 0.58, 9);
    ctx.lineTo(-wingW, 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (sh.shape === 'heavy') {
      ctx.fillStyle = hexToRgba(sh.col, 0.22);
      ctx.beginPath();
      ctx.moveTo(-wingW - 5, 1); ctx.lineTo(-wingW, -3); ctx.lineTo(-wingW, 6); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(wingW + 5, 1); ctx.lineTo(wingW, -3); ctx.lineTo(wingW, 6); ctx.closePath(); ctx.fill();
    } else if (sh.shape === 'swift') {
      ctx.strokeStyle = hexToRgba(sh.hot, 0.85);
      ctx.beginPath();
      ctx.moveTo(-wingW, 5); ctx.lineTo(-wingW - 3, 10);
      ctx.moveTo(wingW, 5); ctx.lineTo(wingW + 3, 10);
      ctx.stroke();
    }

    /* 机身 */
    var body = ctx.createLinearGradient(0, noseY, 0, tailY);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.35, sh.hot);
    body.addColorStop(0.8, sh.col);
    body.addColorStop(1, sh.deep);
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(235,255,255,0.85)';
    ctx.lineWidth = 1.1;
    var bw = sh.shape === 'heavy' ? 7 : 5.5;
    ctx.beginPath();
    ctx.moveTo(0, noseY);
    ctx.lineTo(bw, -4);
    ctx.lineTo(bw + 0.5, tailY * 0.7);
    ctx.lineTo(0, tailY);
    ctx.lineTo(-bw - 0.5, tailY * 0.7);
    ctx.lineTo(-bw, -4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    /* 座舱 */
    var ck = ctx.createRadialGradient(-1, -5, 0.4, 0, -4, 5);
    ck.addColorStop(0, '#ffffff');
    ck.addColorStop(0.5, sh.hot);
    ck.addColorStop(1, hexToRgba(sh.deep, 0.15));
    ctx.fillStyle = ck;
    ctx.beginPath(); ctx.ellipse(0, -4, 3.2, 5.2, 0, 0, Math.PI * 2); ctx.fill();

    /* 翼尖灯 */
    ctx.fillStyle = sh.shape === 'heavy' ? '#ffffff' : 'rgba(255,230,0,0.9)';
    ctx.beginPath(); ctx.arc(-wingW + 1, 3, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(wingW - 1, 3, 1.4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawPlayerCore() {
    var p = S.player;
    var sh = SHIPS[S.shipKey] || SHIPS.balanced;
    var hr = sh.hitR;
    var blink = S.invT > 0 && (Math.floor(S.invT / 6) % 2 === 0);
    ctx.save();
    ctx.globalAlpha = blink ? 0.55 : 1;
    /* 外圈半径 = 2×核心半径，核心白点半径 = hitR，与碰撞完全一致 */
    ctx.shadowColor = sh.col;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = hexToRgba(sh.col, 0.95);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(p.x, p.y, hr * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(p.x, p.y, hr, 0, Math.PI * 2); ctx.fill();
    /* 四向刻度，突出核心边界 */
    ctx.strokeStyle = hexToRgba(sh.hot, 0.9);
    ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + 0.2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * hr * 1.55, p.y + Math.sin(a) * hr * 1.55);
      ctx.lineTo(p.x + Math.cos(a) * hr * 1.95, p.y + Math.sin(a) * hr * 1.95);
      ctx.stroke();
    }
    ctx.restore();
    if (isFocus()) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(bgT * 0.07);
      ctx.strokeStyle = hexToRgba(sh.col, 0.55);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, sh.graze, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- 敌机绘制 ---------------- */
  function drawEnemy(e) {
    var col = ENEMY_COL[e.type] || '#ff2d95';
    var sc = 1;
    if (e.spawnT > 0) {
      var pr = 1 - e.spawnT / 22;
      sc = 0.35 + 0.65 * (window.GK ? GK.easeOutBack(pr) : pr);
    }
    var alpha = 1;
    if (e.leaving) alpha = Math.max(0.25, 1 - (e.y - e.ty) / (H * 0.9));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(e.x, e.y);
    ctx.scale(sc, sc);
    ctx.shadowColor = col;
    ctx.shadowBlur = 11;
    var g = ctx.createLinearGradient(0, -12, 0, 12);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, col);
    g.addColorStop(1, hexToRgba(col, 0.25));
    ctx.fillStyle = g;
    traceEnemy(e.type, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    /* 核心：半径严格等于 e.hitR（命中判定共用） */
    var hr = e.hitR || 8;
    var core = ctx.createRadialGradient(0, 0, 0.5, 0, 0, hr);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, col);
    core.addColorStop(1, hexToRgba(col, 0.12));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.stroke();
    /* 炮口 */
    if (e.type === 2) {
      ctx.strokeStyle = hexToRgba(col, 0.8);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-5, 8); ctx.lineTo(-5, 13);
      ctx.moveTo(5, 8); ctx.lineTo(5, 13); ctx.stroke();
    }
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(0.9, e.flash / 9);
      ctx.fillStyle = '#ffffff';
      traceEnemy(e.type, 12);
      ctx.fill();
    }
    ctx.restore();
    /* 血量条 */
    if (e.maxHp > 1 && !e.leaving) {
      var hpR = Math.max(0, e.hp / e.maxHp);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(e.x - 12, e.y - 22, 24, 3);
      ctx.fillStyle = hpR > 0.5 ? '#39ff14' : '#ffe600';
      ctx.fillRect(e.x - 12, e.y - 22, 24 * hpR, 3);
      ctx.restore();
    }
  }

  /* ---------------- Boss 绘制 ---------------- */
  function drawMidBoss(b) {
    var accent = S.bossPhase ? '#ff2d95' : '#ff9f1c';
    var introAlpha = b.intro > 0 ? Math.max(0.3, 1 - b.intro / 64) : 1;
    var hr = b.hitR || 11;
    ctx.save();
    ctx.globalAlpha = introAlpha;
    ctx.translate(b.x, b.y);
    /* 小型光环 */
    var aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    aura.addColorStop(0, hexToRgba(accent, 0.34));
    aura.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    /* 旋翼 */
    ctx.save();
    ctx.rotate(b.angle);
    ctx.strokeStyle = hexToRgba(accent, 0.75);
    ctx.lineWidth = 1.6;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    for (var w = 0; w < 3; w++) {
      var wa = w * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(wa) * 8, Math.sin(wa) * 8);
      ctx.lineTo(Math.cos(wa) * 27, Math.sin(wa) * 27);
      ctx.stroke();
      ctx.fillStyle = hexToRgba(accent, 0.8);
      ctx.beginPath(); ctx.arc(Math.cos(wa) * 27, Math.sin(wa) * 27, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    /* 菱形装甲 */
    ctx.save();
    ctx.rotate(-b.angle * 0.5);
    var ag = ctx.createLinearGradient(-18, -18, 18, 18);
    ag.addColorStop(0, '#ffb347');
    ag.addColorStop(0.45, '#5a1a0c');
    ag.addColorStop(1, '#2a0a1a');
    ctx.fillStyle = ag;
    ctx.strokeStyle = hexToRgba(accent, 0.9);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(16, 0); ctx.lineTo(0, 18); ctx.lineTo(-16, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    /* 核心：半径 = b.hitR */
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 14;
    var core = ctx.createRadialGradient(0, 0, 0.5, 0, 0, hr);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.45, '#ffe600');
    core.addColorStop(1, hexToRgba(accent, 0.35));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.stroke();
    if (b.flash > 0) {
      ctx.globalAlpha = Math.min(0.85, b.flash / 10);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBoss() {
    var b = S.boss;
    if (!b) return;
    if (b.kind === 'mid') { drawMidBoss(b); return; }
    var accent = BOSS_COL[Math.min(S.bossPhase, 2)];
    var introAlpha = b.intro > 0 ? Math.max(0.3, 1 - b.intro / 78) : 1;
    ctx.save();
    ctx.globalAlpha = introAlpha;
    ctx.translate(b.x, b.y);

    /* 光环 */
    var aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 66);
    aura.addColorStop(0, hexToRgba(accent, 0.35));
    aura.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.fill();

    /* 旋转外环 */
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    for (var r = 0; r < 3; r++) {
      ctx.save();
      ctx.rotate(b.angle * (r % 2 === 0 ? 1 : -1) + r * 1.15);
      ctx.strokeStyle = hexToRgba(accent, 0.6 - r * 0.13);
      ctx.lineWidth = r === 0 ? 2.4 : 1.6;
      ctx.beginPath(); ctx.arc(0, 0, 34 + r * 8, 0.2, 1.55); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 34 + r * 8, Math.PI + 0.55, Math.PI + 1.9); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    /* 装甲板 */
    ctx.save();
    ctx.rotate(-b.angle * 0.45);
    var ag = ctx.createLinearGradient(-30, -30, 30, 30);
    ag.addColorStop(0, '#4a2c72');
    ag.addColorStop(0.5, '#150b28');
    ag.addColorStop(1, '#2a1444');
    ctx.fillStyle = ag;
    tracePoly(8, 30, Math.PI / 8);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, 0.85);
    ctx.lineWidth = 2;
    ctx.stroke();

    /* 炮塔 */
    for (var t = 0; t < 6; t++) {
      var ta = t * Math.PI / 3;
      var tx = Math.cos(ta) * 25, ty = Math.sin(ta) * 25;
      ctx.fillStyle = hexToRgba(accent, 0.8);
      ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ta) * 25, Math.sin(ta) * 25);
      ctx.lineTo(Math.cos(ta) * 33, Math.sin(ta) * 33);
      ctx.stroke();
    }

    /* 内层六边形核心 */
    ctx.rotate(b.angle * 0.9);
    var ig = ctx.createRadialGradient(-4, -6, 2, 0, 0, 22);
    ig.addColorStop(0, '#ffffff');
    ig.addColorStop(0.3, accent);
    ig.addColorStop(1, 'rgba(20,8,40,0.9)');
    ctx.fillStyle = ig;
    tracePoly(6, 19, Math.PI / 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    /* 核心眼：半径 = b.hitR（命中判定共用） */
    var chr = b.hitR || 16;
    var eye = ctx.createRadialGradient(0, 0, 1, 0, 0, chr);
    eye.addColorStop(0, '#ffffff');
    eye.addColorStop(0.4, '#ffe600');
    eye.addColorStop(1, hexToRgba(accent, 0.15));
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(0, 0, chr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, chr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, chr * 0.28, 0, Math.PI * 2); ctx.fill();

    /* 受损闪白 */
    if (b.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, b.flash / 10) + ')';
      tracePoly(8, 30, Math.PI / 8);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- 子弹 / 粒子绘制 ---------------- */
  function drawPBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < S.pbullets.length; i++) {
      var b = S.pbullets[i];
      var col = b.col || '#39ff14';
      var sprite = bulletSprite(col);
      var len = b.laser ? 13 : 9;
      var wid = b.laser ? 3.4 : 2.4;
      var g = ctx.createLinearGradient(b.x, b.y + len, b.x, b.y - len);
      g.addColorStop(0, hexToRgba(col, 0));
      g.addColorStop(0.5, hexToRgba(col, 0.8));
      g.addColorStop(1, 'rgba(255,255,255,0.95)');
      ctx.strokeStyle = g;
      ctx.lineWidth = wid;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y + len); ctx.lineTo(b.x, b.y - len); ctx.stroke();
      var s = b.laser ? 13 : 14;
      ctx.drawImage(sprite, b.x - s / 2, b.y - s / 2, s, s);
      if (b.homing) {
        ctx.strokeStyle = hexToRgba(col, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawEBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < S.ebullets.length; i++) {
      var b = S.ebullets[i];
      var col = b.grazed ? '#ffe600' : b.col;
      var s = b.r * 4.6;
      ctx.drawImage(bulletSprite(col), b.x - s / 2, b.y - s / 2, s, s);
    }
    ctx.restore();
  }

  function drawParticles(layer) {
    ctx.save();
    for (var i = 0; i < S.particles.length; i++) {
      var p = S.particles[i];
      if ((p.z || 0) !== layer) continue;
      var a = Math.max(0, Math.min(1, p.life));
      ctx.globalAlpha = a;
      if (p.kind === 1) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        var sz = p.size * Math.max(0.25, p.life);
        ctx.fillRect(-sz * 0.5, -sz * 0.16, sz, sz * 0.32);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * Math.max(0.22, p.life), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRings() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < S.rings.length; i++) {
      var r = S.rings[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, r.life));
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < S.texts.length; i++) {
      var t = S.texts[i];
      var k = t.t / t.dur;
      if (k < 0 || k >= 1) continue;
      var rise = 30 * GK.easeOutCubic(k);
      var pop = 0.72 + 0.28 * GK.easeOutBack(Math.min(1, k * 2.4));
      ctx.globalAlpha = 1 - k * k;
      ctx.save();
      ctx.translate(t.x, t.y - rise);
      ctx.scale(pop, pop);
      ctx.font = '900 ' + t.size + 'px "Press Start 2P","Fusion Pixel",monospace';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.fillText(t.str, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawFlash() {
    if (S.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, S.flashT / 14);
      ctx.fillStyle = S.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /* ---------------- 主绘制 ---------------- */
  function draw() {
    drawBackground();
    ctx.save();
    var amp = S.shakeT > 0 ? Math.min(9, S.shakeT * 0.45) : 0;
    if (amp > 0) {
      ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    }
    if (S.mode === 'menu') {
      ctx.save();
      ctx.translate(0, Math.sin(bgT * 0.03) * 7);
      drawPlayerBody();
      ctx.restore();
      drawPlayerCore();
    } else {
      var showShip = !(S.mode === 'ending' && !S.endWin);
      drawParticles(0); /* 后景：Boss 残焰等，压在单位之下 */
      drawPBullets();
      for (var i = 0; i < S.enemies.length; i++) drawEnemy(S.enemies[i]);
      drawBoss();
      if (showShip) drawPlayerBody();
      drawEBullets();
      drawParticles(1); /* 前景火花压在弹幕之上 */
      drawRings();
      if (showShip) drawPlayerCore();
      drawTexts();
    }
    ctx.restore();
    drawPostFx();
    drawFlash();
  }

  /* ---------------- 启动 ---------------- */
  updateSelectors();
  updateHud();
  loopApi = Arcade.loop.start(update, draw, 16);

})();
