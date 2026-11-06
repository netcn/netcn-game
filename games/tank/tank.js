/* ============================================================
   铁壁防线 · 守卫密码局（完美旗舰版）
   敌军坦克进攻密码局情报部——驾驶守卫坦克，多波次清剿、守住基地。
   修复：子弹带归属（玩家子弹不再误伤基地）、BFS 敌人寻路（不再卡墙/抖动）、
        引导线把砖墙视为阻挡、双人本地合作、四类敌军 + BOSS、整局升级树。
   视觉：霓虹手绘车体（履带/炮塔/炮管/护盾）、爆炸粒子、屏震、命中闪白、BOSS 血条。
   核心逻辑用 ==TANK-CORE-START== / ==TANK-CORE-END== 标记包裹，供 Node harness 提取。
   ============================================================ */

(function () {
  /* ==TANK-CORE-START== */
  var T_GRID = 13; // 13×13 格
  var T_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 上右下左
  var T_SPAWN_SPOTS = [[0, 0], [6, 0], [12, 0]];   // 顶部三个出生点（按顺序占位）
  var T_BASE_ROW = 12, T_BASE_C0 = 5, T_BASE_C1 = 7;
  var T_DIFF = [
    { waves: 4, perWave: 3, enemyHp: 1, enemySpeed: 0.82, shootP: 0.016, items: 3, bossHp: 10 },
    { waves: 6, perWave: 4, enemyHp: 1, enemySpeed: 1.02, shootP: 0.022, items: 4, bossHp: 14 },
    { waves: 8, perWave: 5, enemyHp: 2, enemySpeed: 1.22, shootP: 0.028, items: 5, bossHp: 20 }
  ];

  function T_mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function T_inBounds(c, r) { return c >= 0 && r >= 0 && c < T_GRID && r < T_GRID; }
  function T_isBaseCell(c, r) { return r === T_BASE_ROW && c >= T_BASE_C0 && c <= T_BASE_C1; }

  /** 格可通行（坦克）：空且非基地格；钢/砖均不可直接驶入 */
  function T_passable(grid, r, c) {
    if (!T_inBounds(c, r)) return false;
    if (T_isBaseCell(c, r)) return false;
    return grid[r][c] === ' ';
  }

  /** 通用 BFS：allow(ch) 判断某格是否可走；返回 [[c,r]...] 或 null */
  function T_bfsGrid(grid, sx, sy, tx, ty, allow) {
    if (!T_inBounds(sx, sy) || !T_inBounds(tx, ty)) return null;
    if (!allow(grid[ty][tx])) return null;
    var seen = {}, prev = {};
    var q = [[sx, sy]];
    seen[sx + ',' + sy] = true;
    var found = false;
    while (q.length) {
      var cur = q.shift();
      if (cur[0] === tx && cur[1] === ty) { found = true; break; }
      for (var d = 0; d < 4; d++) {
        var nx = cur[0] + T_DIRS[d][0], ny = cur[1] + T_DIRS[d][1];
        if (!T_inBounds(nx, ny)) continue;
        var key = nx + ',' + ny;
        if (seen[key]) continue;
        if (!allow(grid[ny][nx])) continue;
        seen[key] = true;
        prev[key] = cur;
        q.push([nx, ny]);
      }
    }
    if (!found) return null;
    var path = [], node = [tx, ty];
    while (node) {
      path.unshift([node[0], node[1]]);
      node = prev[node[0] + ',' + node[1]];
    }
    return path;
  }

  /** 引导线/回归测试专用：只走空格（'B' 砖墙不可穿越，'S' 钢墙亦不可） */
  function T_bfsEmptyPath(grid, sx, sy, tx, ty) {
    return T_bfsGrid(grid, sx, sy, tx, ty, function (ch) { return ch === ' '; });
  }

  /**
   * 地图连通性兜底：随机砖块/钢墙可能截断出生点到基地的路线。
   * 先尝试只清砖（保留钢墙），仍不通再清整条路线；保证每张图都有活路。
   */
  function T_ensureRoutes(grid) {
    for (var i = 0; i < T_SPAWN_SPOTS.length; i++) {
      var sp = T_SPAWN_SPOTS[i];
      if (T_bfsEmptyPath(grid, sp[0], sp[1], 6, T_BASE_ROW)) continue;
      var p = T_bfsGrid(grid, sp[0], sp[1], 6, T_BASE_ROW, function (ch) { return ch !== 'S'; });
      if (p) {
        for (var k = 0; k < p.length; k++) {
          if (grid[p[k][1]][p[k][0]] === 'B') grid[p[k][1]][p[k][0]] = ' ';
        }
        if (T_bfsEmptyPath(grid, sp[0], sp[1], 6, T_BASE_ROW)) continue;
      }
      var p2 = T_bfsGrid(grid, sp[0], sp[1], 6, T_BASE_ROW, function () { return true; });
      if (p2) {
        for (var m = 0; m < p2.length; m++) {
          if (grid[p2[m][1]][p2[m][0]] !== ' ') grid[p2[m][1]][p2[m][0]] = ' ';
        }
      }
    }
  }

  /** 地图生成：13×13；'B' 砖 'S' 钢 ' ' 空；基地占 (5..7,12)，该区域用空格表示 */
  function T_genMap(seed) {
    var rnd = T_mulberry32(seed || (Date.now() % 2147483647));
    var g = [];
    for (var r = 0; r < T_GRID; r++) {
      var row = [];
      for (var c = 0; c < T_GRID; c++) row.push(' ');
      g.push(row);
    }
    // 基地前沿工事：钢-砖-钢（基地本体所在的三格保持空格，由子弹归属判定）
    g[11][5] = 'S'; g[11][6] = 'B'; g[11][7] = 'S';
    var blocks = 12;
    function safeSpot(r, c) {
      if (r >= 10 && c >= 4 && c <= 8) return false;
      if (r === 9 && c >= 5 && c <= 7) return false;
      if (r >= 11) return false;
      if (r <= 1 || c <= 1 || c >= T_GRID - 2) return false;
      return true;
    }
    var guard = 0;
    var placed = 0;
    while (placed < blocks && guard++ < 300) {
      var r = Math.floor(rnd() * T_GRID);
      var c = Math.floor(rnd() * T_GRID);
      var horiz = rnd() < 0.5;
      var ok = false;
      if (horiz) { if (c + 1 < T_GRID && safeSpot(r, c) && safeSpot(r, c + 1)) ok = true; }
      else { if (r + 1 < T_GRID && safeSpot(r, c) && safeSpot(r + 1, c)) ok = true; }
      if (!ok) continue;
      g[r][c] = 'B';
      if (horiz) g[r][c + 1] = 'B'; else g[r + 1][c] = 'B';
      placed++;
    }
    var steel = 3;
    guard = 0;
    var sp = 0;
    while (sp < steel && guard++ < 200) {
      var r2 = Math.floor(rnd() * (T_GRID - 4)) + 2;
      var c2 = Math.floor(rnd() * (T_GRID - 4)) + 2;
      if (g[r2][c2] === ' ' && !(r2 >= 9 && c2 >= 5 && c2 <= 7)) { g[r2][c2] = 'S'; sp++; }
    }
    T_ensureRoutes(g);
    return g;
  }

  /** 某格是否已有存活坦克（移动中的坦克按目标格占位，避免交叉穿模） */
  function T_occupied(tanks, gx, gy) {
    for (var i = 0; i < tanks.length; i++) {
      var t = tanks[i];
      if (!t || !t.alive) continue;
      var tx = (t.targetGx !== undefined) ? t.targetGx : ((t.gx !== undefined && t.gx !== null) ? t.gx : Math.floor(t.x / 32));
      var ty = (t.targetGy !== undefined) ? t.targetGy : ((t.gy !== undefined && t.gy !== null) ? t.gy : Math.floor(t.y / 32));
      if (tx === gx && ty === gy) return true;
    }
    return false;
  }

  /** 子弹碰撞：owner 决定能否摧毁基地与击中谁
      - enemy 子弹撞基地 → 'base'
      - player 子弹撞基地 → 'absorb'（被吸收，不扣分不判负）
      - 只命中「非同阵营」坦克，绝无友军伤害
      power 1=单发 2=穿透砖墙 3=穿透砖墙且强化伤害 */
  function T_bulletStep(grid, bx, by, power, owner, tanks) {
    var gx = Math.floor(bx / 32), gy = Math.floor(by / 32);
    if (gx < 0 || gy < 0 || gx >= T_GRID || gy >= T_GRID) return { hit: 'none' };
    // 基地（先于砖判定；归属不同结果不同）
    // 回归断言：T_bulletStep(grid, 6*32+16, 12*32+16, 1, 'player', []) → {hit:'absorb'}
    //           T_bulletStep(grid, 6*32+16, 12*32+16, 1, 'enemy',  []) → {hit:'base'}
    if (gx >= T_BASE_C0 && gx <= T_BASE_C1 && gy === T_BASE_ROW) {
      return { hit: owner === 'enemy' ? 'base' : 'absorb' };
    }
    var ch = grid[gy] && grid[gy][gx];
    if (ch === 'S') return { hit: 'steel' };
    if (ch === 'B') {
      grid[gy][gx] = ' ';
      return { hit: 'brick', pass: power >= 2 };
    }
    for (var i = 0; i < tanks.length; i++) {
      var t = tanks[i];
      if (!t || !t.alive) continue;
      if (t.kind === owner) continue; // 不打友军
      var tgx = Math.round(t.x / 32), tgy = Math.round(t.y / 32);
      if (tgx === gx && tgy === gy) return { hit: 'tank', idx: i };
    }
    return { hit: 'none' };
  }

  /** 按顺序找出生格：必须 passable 且当前无敌坦占用；全占满返回 null（下一帧重试） */
  function T_findSpawn(grid, tanks, startSlot) {
    for (var k = 0; k < T_SPAWN_SPOTS.length; k++) {
      var idx = (startSlot + k) % T_SPAWN_SPOTS.length;
      var s = T_SPAWN_SPOTS[idx];
      if (!T_passable(grid, s[1], s[0])) continue;
      if (T_occupied(tanks, s[0], s[1])) continue;
      return { gx: s[0], gy: s[1], slot: idx };
    }
    return null;
  }

  /** 敌人 Dijkstra 寻路到基地：空地代价 1，砖墙代价 6（可打掉），钢墙不可通行。
      每到一个格心重新规划，砖被打掉后自动走新路线。 */
  function T_findPath(grid, sx, sy) {
    var N = T_GRID * T_GRID;
    var dist = new Array(N), prev = new Array(N), done = new Array(N);
    for (var i = 0; i < N; i++) { dist[i] = Infinity; prev[i] = -1; done[i] = false; }
    var start = sy * T_GRID + sx;
    if (!T_inBounds(sx, sy)) return null;
    dist[start] = 0;
    var cur = -1;
    while (true) {
      cur = -1;
      var best = Infinity;
      for (var j = 0; j < N; j++) {
        if (!done[j] && dist[j] < best) { best = dist[j]; cur = j; }
      }
      if (cur < 0) break;
      done[cur] = true;
      var cx = cur % T_GRID, cy = Math.floor(cur / T_GRID);
      if (T_isBaseCell(cx, cy)) {
        var path = [], node = cur;
        while (node !== -1) {
          path.unshift([node % T_GRID, Math.floor(node / T_GRID)]);
          node = prev[node];
        }
        return path;
      }
      for (var d = 0; d < 4; d++) {
        var nx = cx + T_DIRS[d][0], ny = cy + T_DIRS[d][1];
        if (!T_inBounds(nx, ny)) continue;
        var ch = grid[ny][nx];
        if (ch === 'S') continue;
        var ni = ny * T_GRID + nx;
        var cost = ch === 'B' ? 6 : 1;
        if (best + cost < dist[ni]) { dist[ni] = best + cost; prev[ni] = cur; }
      }
    }
    return null;
  }

  function T_stepDir(gx, gy, nx, ny) {
    var dx = nx - gx, dy = ny - gy;
    if (dx > 0) return 1;
    if (dx < 0) return 3;
    if (dy > 0) return 2;
    if (dy < 0) return 0;
    return -1;
  }

  /** 清空直线：同行/同列中间所有格都必须是空地（砖/钢/基地格均阻挡） */
  function T_lineClear(grid, ax, ay, bx, by) {
    if (ax !== bx && ay !== by) return false;
    var dx = bx > ax ? 1 : (bx < ax ? -1 : 0);
    var dy = by > ay ? 1 : (by < ay ? -1 : 0);
    var x = ax + dx, y = ay + dy;
    while (x !== bx || y !== by) {
      if (!T_inBounds(x, y)) return false;
      if (grid[y][x] !== ' ') return false;
      x += dx; y += dy;
    }
    return true;
  }

  /** 波次敌种参数 */
  function T_enemySpec(type, wave, conf, rnd) {
    var bonusHp = Math.floor((wave - 1) / 4);
    var speedBonus = (wave - 1) * 0.035;
    var s = conf.enemySpeed + speedBonus;
    var p = conf.shootP;
    if (type === 'fast') {
      return { type: 'fast', hp: 1 + Math.floor((wave - 1) / 6), maxHp: 1 + Math.floor((wave - 1) / 6),
        speed: s * 1.55, shootP: p * 0.65, score: 60, scale: 0.84, armored: false, longRange: false };
    }
    if (type === 'armor') {
      var ah = 4 + Math.floor((wave - 1) / 3);
      return { type: 'armor', hp: ah, maxHp: ah, speed: s * 0.7, shootP: p * 0.85,
        score: 130, scale: 1.12, armored: true, longRange: false };
    }
    if (type === 'sniper') {
      var sh = 2 + Math.floor((wave - 1) / 5);
      return { type: 'sniper', hp: sh, maxHp: sh, speed: s * 0.85, shootP: p * 2.4,
        score: 110, scale: 1.0, armored: false, longRange: true };
    }
    var nh = conf.enemyHp + bonusHp;
    return { type: 'normal', hp: nh, maxHp: nh, speed: s, shootP: p,
      score: 50, scale: 1.0, armored: false, longRange: false };
  }

  function T_bossSpec(wave, conf) {
    var hp = conf.bossHp + wave * 2 + Math.floor(wave / 3);
    return { type: 'boss', hp: hp, maxHp: hp, speed: (conf.enemySpeed + (wave - 1) * 0.03) * 0.62,
      shootP: 0.09, score: 800, scale: 1.78, armored: true, longRange: false, boss: true };
  }

  /** 波次队列：按权重混编四类敌兵；每 3 波或最终波加入 BOSS。
      返回 { list:[spec...], bossWave:boolean }，BOSS 排在最前制造威压。 */
  function T_makeWave(wave, conf, rnd) {
    var list = [];
    var count = conf.perWave + Math.floor((wave - 1) / 3);
    var wNormal = Math.max(0.25, 1.0 - wave * 0.07);
    var wFast = wave >= 2 ? 0.15 + wave * 0.02 : 0;
    var wArmor = wave >= 3 ? 0.11 + wave * 0.015 : 0;
    var wSniper = wave >= 3 ? 0.08 + wave * 0.012 : 0;
    var total = wNormal + wFast + wArmor + wSniper;
    for (var i = 0; i < count; i++) {
      var roll = rnd() * total;
      var type = 'normal';
      if (roll >= wNormal + wFast + wArmor) type = 'sniper';
      else if (roll >= wNormal + wFast) type = 'armor';
      else if (roll >= wNormal) type = 'fast';
      var spec = T_enemySpec(type, wave, conf, rnd);
      spec.shootCd = 24 + Math.floor(rnd() * 46);
      list.push(spec);
    }
    var bossWave = (wave % 3 === 0) || (wave === conf.waves);
    if (bossWave) {
      var boss = T_bossSpec(wave, conf);
      boss.shootCd = 30;
      list.unshift(boss);
    }
    return { list: list, bossWave: bossWave };
  }

  /** 道具生成：空地随机，避开基地区/出生格/已占格 */
  function T_genItem(grid, rnd, isTaken) {
    var types = ['star', 'shield', 'freeze', 'repair'];
    for (var tries = 0; tries < 60; tries++) {
      var r = 1 + Math.floor(rnd() * 9);   // 1..9
      var c = 1 + Math.floor(rnd() * 11);  // 1..11
      if (grid[r][c] !== ' ') continue;
      if (r === 10 && c >= 5 && c <= 7) continue; // 玩家出生区
      if (r >= 9 && c >= 5 && c <= 7) continue;
      if (isTaken && isTaken(c, r)) continue;
      return { x: c * 32, y: r * 32, type: types[Math.floor(rnd() * types.length)], alive: true };
    }
    return null;
  }

  /** 格级移动判定：tank 从 (gx,gy) 向 dir 走一格是否可通行 */
  function T_canStep(grid, gx, gy, dir, tanks, self) {
    var nx = gx + T_DIRS[dir][0], ny = gy + T_DIRS[dir][1];
    if (!T_passable(grid, ny, nx)) return false;
    for (var i = 0; i < tanks.length; i++) {
      var o = tanks[i];
      if (o === self || !o.alive) continue;
      var ogx = (o.targetGx !== undefined) ? o.targetGx : ((o.gx !== undefined && o.gx !== null) ? o.gx : Math.floor(o.x / 32));
      var ogy = (o.targetGy !== undefined) ? o.targetGy : ((o.gy !== undefined && o.gy !== null) ? o.gy : Math.floor(o.y / 32));
      if (ogx === nx && ogy === ny) return false;
    }
    return true;
  }

  /** 三选一升级池：限制满级的项目，其余随机洗牌取 3 */
  function T_pickUpgrades(rnd, ups) {
    var pool = ['pierce', 'rate', 'shield', 'repair', 'speed', 'twin'];
    var avail = [];
    for (var i = 0; i < pool.length; i++) {
      var id = pool[i];
      if (id === 'pierce' && ups.pierce >= 3) continue;
      if (id === 'rate' && ups.rate >= 6) continue;
      if (id === 'speed' && ups.speed >= 5) continue;
      if (id === 'twin' && ups.twin) continue;
      avail.push(id);
    }
    for (var a = avail.length - 1; a > 0; a--) {
      var b = Math.floor(rnd() * (a + 1));
      var tmp = avail[a]; avail[a] = avail[b]; avail[b] = tmp;
    }
    return avail.slice(0, 3);
  }

  /** 引导线：从三个出生点到基地的 BFS 折线；只走空格，砖墙 'B' 视为阻挡。
      砖被打掉后调用方重建即可得到新路线。 */
  function T_buildGuides(grid) {
    var out = [];
    for (var i = 0; i < T_SPAWN_SPOTS.length; i++) {
      var sp = T_SPAWN_SPOTS[i];
      var p = T_bfsEmptyPath(grid, sp[0], sp[1], 6, T_BASE_ROW);
      if (p) out.push(p);
    }
    return out;
  }
  /* ==TANK-CORE-END== */

  /* ================= UI 层 ================= */
  var root = document.getElementById('game-root');
  if (!root) return;

  var CELL = 32, MAP = T_GRID * CELL;
  var DIFF_INFO = [
    { t: T('gt.easy'), d: T('gt.dEasy') },
    { t: T('gt.normal'), d: T('gt.dNormal') },
    { t: T('gt.hard'), d: T('gt.dHard') }
  ];

  root.innerHTML =
    '<div class="tk-wrap">' +
    '  <div class="tk-pick" id="tk-pick">' +
    '    <div class="tk-pick-t">' + T('gt.pickT') + '</div>' +
    '    <div class="tk-pick-d">' + T('gt.pickD') + '</div>' +
    '    <div class="tk-mode" id="tk-mode">' +
    '      <button class="btn tk-mode-btn active" data-m="1">' + T('gs.tank.modeOneP') + '<small>' + T('gs.tank.modeOnePSub') + '</small></button>' +
    '      <button class="btn tk-mode-btn" data-m="2">' + T('gs.tank.modeTwoP') + '<small>' + T('gs.tank.modeTwoPSub') + '</small></button>' +
    '    </div>' +
    '    <div class="tk-pick-btns">' +
    DIFF_INFO.map(function (d, i) {
      return '<button class="btn mode-btn" data-i="' + i + '">' + d.t + '<small>' + d.d + '</small></button>';
    }).join('') +
    '    </div>' +
    '  </div>' +
    '  <div id="tk-game" class="tk-game hidden">' +
    '    <div class="tk-info">' +
    '      <span id="tk-wave"></span><span id="tk-enemies"></span>' +
    '      <span id="tk-lives"></span><span id="tk-score"></span>' +
    '    </div>' +
    '    <div class="tk-stage" id="tk-stage">' +
    '      <canvas id="tk-cv" width="' + MAP + '" height="' + MAP + '" class="tk-canvas"></canvas>' +
    '      <div class="tk-wave-banner" id="tk-wave-banner"></div>' +
    '      <div class="tk-pause hidden" id="tk-pause">' +
    '        <div class="tk-card">' +
    '          <h2>' + T('gs.tank.pauseTitle') + '</h2>' +
    '          <p>' + T('gs.tank.pauseHint') + '</p>' +
    '          <button class="btn green" id="tk-resume">' + T('gs.tank.resume') + '</button>' +
    '          <button class="btn" id="tk-pause-restart">' + T('gs.tank.restart') + '</button>' +
    '        </div>' +
    '      </div>' +
    '      <div class="tk-upgrade hidden" id="tk-upgrade">' +
    '        <div class="tk-card tk-up-card">' +
    '          <h2 id="tk-up-title"></h2>' +
    '          <p id="tk-up-sub"></p>' +
    '          <div class="tk-up-list" id="tk-up-list"></div>' +
    '        </div>' +
    '      </div>' +
    '      <div class="tk-overlay hidden" id="tk-overlay">' +
    '        <div class="tk-card">' +
    '          <h2 id="tk-ov-title"></h2>' +
    '          <p id="tk-ov-text"></p>' +
    '          <div class="tk-ov-stats">' +
    '            <span>' + T('gt.score') + ' <b id="tk-final-score">0</b></span>' +
    '            <span>' + T('gs.tank.best') + ' <b id="tk-best">0</b></span>' +
    '          </div>' +
    '          <button class="btn green" id="tk-again">' + T('gs.tank.restart') + '</button>' +
    '          <button class="btn purple" id="tk-change">' + T('gs.tank.changeDiff') + '</button>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="tk-controls" id="tk-controls">' +
    '      <div class="tk-dpad">' +
    '        <i class="tk-sp"></i>' +
    '        <button class="btn tk-dir" data-d="0" aria-label="up">▲</button>' +
    '        <i class="tk-sp"></i>' +
    '        <button class="btn tk-dir" data-d="3" aria-label="left">◀</button>' +
    '        <i class="tk-sp tk-dot"></i>' +
    '        <button class="btn tk-dir" data-d="1" aria-label="right">▶</button>' +
    '        <i class="tk-sp"></i>' +
    '        <button class="btn tk-dir" data-d="2" aria-label="down">▼</button>' +
    '        <i class="tk-sp"></i>' +
    '      </div>' +
    '      <button class="btn yellow tk-fire" id="tk-fire">' + T('gt.fire') + '</button>' +
    '      <button class="btn tk-pause-btn" id="tk-pause-btn">' + T('gs.tank.pauseBtn') + '</button>' +
    '    </div>' +
    '    <div class="tk-p2 hidden" id="tk-p2">' +
    '      <span class="tk-p2-label">P2</span>' +
    '      <div class="tk-dpad tk-dpad2">' +
    '        <i class="tk-sp"></i>' +
    '        <button class="btn tk-dir tk-dir2" data-d="0" aria-label="p2 up">▲</button>' +
    '        <i class="tk-sp"></i>' +
    '        <button class="btn tk-dir tk-dir2" data-d="3" aria-label="p2 left">◀</button>' +
    '        <i class="tk-sp tk-dot"></i>' +
    '        <button class="btn tk-dir tk-dir2" data-d="1" aria-label="p2 right">▶</button>' +
    '        <i class="tk-sp"></i>' +
    '        <button class="btn tk-dir tk-dir2" data-d="2" aria-label="p2 down">▼</button>' +
    '        <i class="tk-sp"></i>' +
    '      </div>' +
    '      <button class="btn yellow tk-fire" id="tk-fire2">F</button>' +
    '    </div>' +
    '    <div class="tk-msg" id="tk-msg"></div>' +
    '  </div>' +
    '</div>';

  var pickEl = document.getElementById('tk-pick');
  var gameEl = document.getElementById('tk-game');
  var stageEl = document.getElementById('tk-stage');
  var waveEl = document.getElementById('tk-wave');
  var enemiesEl = document.getElementById('tk-enemies');
  var livesEl = document.getElementById('tk-lives');
  var scoreEl = document.getElementById('tk-score');
  var msgEl = document.getElementById('tk-msg');
  var overlayEl = document.getElementById('tk-overlay');
  var upgradeEl = document.getElementById('tk-upgrade');
  var upTitleEl = document.getElementById('tk-up-title');
  var upSubEl = document.getElementById('tk-up-sub');
  var upListEl = document.getElementById('tk-up-list');
  var waveBanner = document.getElementById('tk-wave-banner');
  var waveBannerTimer = 0;
  function showWaveBanner(main, sub, color, ms) {
    if (!waveBanner) return;
    waveBanner.style.color = color || 'var(--neon-yellow)';
    waveBanner.innerHTML = main + (sub ? '<small>' + sub + '</small>' : '');
    waveBanner.classList.remove('show');
    void waveBanner.offsetWidth;
    waveBanner.classList.add('show');
    clearTimeout(waveBannerTimer);
    waveBannerTimer = setTimeout(function () { waveBanner.classList.remove('show'); }, ms || 2000);
  }
  var pauseEl = document.getElementById('tk-pause');
  var p2El = document.getElementById('tk-p2');
  var ovTitle = document.getElementById('tk-ov-title');
  var ovText = document.getElementById('tk-ov-text');
  var finalScoreEl = document.getElementById('tk-final-score');
  var bestEl = document.getElementById('tk-best');
  var canvas = document.getElementById('tk-cv');
  var ctx;
  if (window.GK) {
    ctx = GK.setup(canvas, MAP, MAP).ctx;
  } else {
    ctx = canvas.getContext('2d');
    if (Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = MAP + 'px';

  var state = null, loopApi = null, paused = false;
  var fireHeld = [false, false];
  var pickCoop = 1;
  var BEST_KEY = (Arcade.shell && Arcade.shell.gameId) || 'tank';

  function bestScore() {
    try { return (Arcade.storage && Arcade.storage.getBest(BEST_KEY)) || 0; } catch (e) { return 0; }
  }

  /* ---------- 坐标/特效工具 ---------- */
  function pointerPos(ev) {
    if (window.GK && GK.pointer) return GK.pointer(canvas, ev);
    var r = canvas.getBoundingClientRect();
    var t = (ev.touches && ev.touches[0]) || ev;
    return { x: (t.clientX - r.left) * (MAP / r.width), y: (t.clientY - r.top) * (MAP / r.height) };
  }
  function fxBurst(x, y, color, count) {
    if (window.GK && GK.burst) { GK.burst(canvas, x, y, color, count); return; }
    if (!Arcade.fx) return;
    var r = canvas.getBoundingClientRect();
    Arcade.fx.burst(r.left + x * (r.width / MAP), r.top + y * (r.height / MAP), color, count);
  }
  function shake() { if (Arcade.fx) Arcade.fx.shake(stageEl); }
  function audio(name) { if (Arcade.audio) Arcade.audio.play(name); }
  function toast(msg, type) { if (Arcade.ui) Arcade.ui.toast(msg, type || 'ok'); }

  function addBurst(st, x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 1 + Math.random() * 3.4;
      st.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 1, size: 1.8 + Math.random() * 2.6, color: color
      });
    }
  }
  function addShock(st, x, y, color, maxR) {
    st.shocks.push({ x: x, y: y, r: 5, maxR: maxR || 34, life: 1, color: color || '#ff2d95' });
  }

  /* ---------- 玩家创建 ---------- */
  function basePlayerSpeed(st) { return 2.2 + st.upgrades.speed * 0.25; }

  function putPlayer(idx, st, cell) {
    return {
      x: cell[0] * 32, y: cell[1] * 32, gx: cell[0], gy: cell[1], dir: 0,
      kind: 'player', alive: true, moving: false, want: null,
      pidx: idx, speed: basePlayerSpeed(st), power: 1 + st.upgrades.pierce, twin: st.upgrades.twin,
      shield: 0, flash: 0, fireCd: 0, respawnT: 0,
      targetGx: undefined, targetGy: undefined
    };
  }

  function makePlayer(idx, st) {
    var spots = idx === 0 ? [[6, 10], [5, 10], [7, 10], [6, 9]] : [[5, 10], [7, 10], [6, 10], [5, 9]];
    var cell = spots[0];
    for (var i = 0; i < spots.length; i++) {
      if (T_passable(st.grid, spots[i][1], spots[i][0]) && !T_occupied(st.players, spots[i][0], spots[i][1])) {
        cell = spots[i]; break;
      }
    }
    var p = putPlayer(idx, st, cell);
    p.power = Math.max(p.power, 1 + st.upgrades.pierce);
    return p;
  }

  function findPlayerRespawn(idx, st) {
    var cells = idx === 0 ? [[6, 10], [5, 10], [7, 10], [6, 9], [5, 9], [7, 9], [4, 10], [8, 10]]
      : [[5, 10], [7, 10], [6, 10], [5, 9], [7, 9], [6, 9], [4, 10], [8, 10]];
    var all = st.players.concat(st.enemies);
    for (var i = 0; i < cells.length; i++) {
      if (T_passable(st.grid, cells[i][1], cells[i][0]) && !T_occupied(all, cells[i][0], cells[i][1])) return cells[i];
    }
    return null;
  }

  /* ---------- 开局 ---------- */
  function startGame(diffIdx, coop) {
    var conf = T_DIFF[diffIdx] || T_DIFF[0];
    var rnd = T_mulberry32((Date.now() ^ (diffIdx * 7919)) % 2147483647);
    var grid = T_genMap(Date.now() % 2147483647);
    var st = {
      diff: diffIdx, conf: conf, rnd: rnd, grid: grid,
      players: [], player: null, coop: coop === 2 ? 2 : 1,
      enemies: [], bullets: [], items: [], particles: [], shocks: [], muzzles: [], guides: [],
      wave: 0, waveActive: false, spawnQueue: [], spawnTimer: 0, spawnSlotCursor: 0,
      interT: 0, score: 0, kills: 0, bossKills: 0, lives: 3, baseAlive: true, over: false, won: false,
      enemyFreeze: 0, guidesDirty: false, choosing: false, upgradeChoices: [], upgradeBoss: false,
      waveBoss: false, upgrades: { pierce: 0, rate: 0, speed: 0, twin: false }
    };
    st.players.push(makePlayer(0, st));
    if (st.coop === 2) st.players.push(makePlayer(1, st));
    st.player = st.players[0];

    var items = [];
    for (var i = 0; i < conf.items; i++) {
      var taken = function (c, r) {
        for (var k = 0; k < items.length; k++) {
          if (items[k].alive && Math.floor(items[k].x / 32) === c && Math.floor(items[k].y / 32) === r) return true;
        }
        return false;
      };
      var it = T_genItem(grid, rnd, taken);
      if (it) items.push(it);
    }
    st.items = items;
    state = st;
    paused = false;
    fireHeld[0] = false; fireHeld[1] = false;
    dirHeld[0] = {}; dirHeld[1] = {};
    pauseEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    upgradeEl.classList.add('hidden');
    pickEl.classList.add('hidden');
    if (p2El) p2El.classList.toggle('hidden', st.coop !== 2);
    gameEl.classList.remove('hidden');
    msgEl.textContent = st.coop === 2 ? T('gs.tank.tut2x') : T('gt.tut2');
    msgEl.style.color = '';
    startWave(1);
    updateHud();
    if (loopApi) { if (!loopApi.isRunning()) loopApi.resume(); }
    else loopApi = Arcade.loop.start(update, draw, 16);
    audio('ui');
  }

  function openPicker() {
    if (state) pickCoop = state.coop;
    state = null;
    paused = false;
    fireHeld[0] = false; fireHeld[1] = false;
    for (var mb = 0; mb < modeBtns.length; mb++) {
      modeBtns[mb].classList.toggle('active', parseInt(modeBtns[mb].getAttribute('data-m'), 10) === pickCoop);
    }
    pickEl.classList.remove('hidden');
    gameEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    upgradeEl.classList.add('hidden');
    if (p2El) p2El.classList.add('hidden');
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
  }

  function startWave(n) {
    var st = state;
    var waveObj = T_makeWave(n, st.conf, st.rnd);
    st.wave = n;
    st.waveActive = true;
    st.spawnQueue = waveObj.list;
    st.spawnTimer = 26;
    st.spawnSlotCursor = 0;
    st.waveBoss = waveObj.bossWave;
    st.upgradeBoss = false;
    st.guides = T_buildGuides(st.grid);
    msgEl.textContent = T('gt.waveIncoming').replace('{n}', n);
    msgEl.style.color = 'var(--neon-yellow)';
    var sub = st.waveBoss ? T('gs.tank.waveBossSub') : T('gs.tank.waveSub');
    showWaveBanner(T('gt.waveIncoming').replace('{n}', n), sub,
      st.waveBoss ? 'var(--neon-pink)' : 'var(--neon-yellow)', 2400);
    updateHud();
  }

  /* ---------- 输入 ---------- */
  var dirHeld = [{}, {}];
  function setWant(pi, d) {
    if (!state || paused || state.choosing) return;
    var p = state.players[pi];
    if (!p || !p.alive) return;
    dirHeld[pi][d] = true;
    p.want = d;
  }
  function releaseDir(pi, d) {
    dirHeld[pi][d] = false;
    var any = null;
    for (var k in dirHeld[pi]) { if (dirHeld[pi][k]) { any = parseInt(k, 10); break; } }
    var p = state && state.players[pi];
    if (p) p.want = any;
  }
  function arrowDir(k) {
    if (k === 'ArrowUp') return 0;
    if (k === 'ArrowRight') return 1;
    if (k === 'ArrowDown') return 2;
    if (k === 'ArrowLeft') return 3;
    return null;
  }
  function wasdDir(k) {
    if (k === 'w' || k === 'W') return 0;
    if (k === 'd' || k === 'D') return 1;
    if (k === 's' || k === 'S') return 2;
    if (k === 'a' || k === 'A') return 3;
    return null;
  }

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'p' || k === 'P') {
      if (state && !state.over && !state.choosing) { e.preventDefault(); togglePause(); }
      return;
    }
    if (!state || state.over) return;
    if (state.choosing) {
      if (k === '1' || k === '2' || k === '3') {
        e.preventDefault();
        chooseUpgrade(parseInt(k, 10) - 1);
      }
      return;
    }
    if (paused) return;
    if (k === ' ') { e.preventDefault(); if (!e.repeat) { fireHeld[0] = true; fire(0); } return; }
    if (k === 'f' || k === 'F') {
      if (state.coop === 2) { e.preventDefault(); if (!e.repeat) { fireHeld[1] = true; fire(1); } }
      return;
    }
    var ad = arrowDir(k);
    if (ad !== null) { e.preventDefault(); setWant(0, ad); return; }
    var wd = wasdDir(k);
    if (wd !== null) { e.preventDefault(); setWant(state.coop === 2 ? 1 : 0, wd); }
  });
  document.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === ' ') { fireHeld[0] = false; return; }
    if (k === 'f' || k === 'F') { fireHeld[1] = false; return; }
    var ad = arrowDir(k);
    if (ad !== null && state) { releaseDir(0, ad); return; }
    var wd = wasdDir(k);
    if (wd !== null && state) { releaseDir(state.coop === 2 ? 1 : 0, wd); }
  });
  window.addEventListener('blur', function () {
    fireHeld[0] = false; fireHeld[1] = false;
    dirHeld[0] = {}; dirHeld[1] = {};
    if (state) {
      for (var i = 0; i < state.players.length; i++) state.players[i].want = null;
    }
  });

  var dirBtns = root.querySelectorAll('.tk-dir');
  for (var bi = 0; bi < dirBtns.length; bi++) {
    (function (b) {
      var d = parseInt(b.getAttribute('data-d'), 10);
      b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); setWant(0, d); });
      b.addEventListener('pointerup', function () { releaseDir(0, d); });
      b.addEventListener('pointerleave', function () { if (dirHeld[0][d]) releaseDir(0, d); });
      b.addEventListener('pointercancel', function () { releaseDir(0, d); });
    })(dirBtns[bi]);
  }
  var fireBtn = document.getElementById('tk-fire');
  fireBtn.addEventListener('pointerdown', function (ev) { ev.preventDefault(); fireHeld[0] = true; fire(0); });
  fireBtn.addEventListener('pointerup', function () { fireHeld[0] = false; });
  fireBtn.addEventListener('pointerleave', function () { fireHeld[0] = false; });
  fireBtn.addEventListener('pointercancel', function () { fireHeld[0] = false; });
  document.getElementById('tk-pause-btn').addEventListener('click', function () { togglePause(); });

  /* 双人模式：P2 触控方向键与开火（P1 触控仍可用） */
  var p2Dirs = root.querySelectorAll('.tk-dir2');
  for (var p2i = 0; p2i < p2Dirs.length; p2i++) {
    (function (b) {
      var d = parseInt(b.getAttribute('data-d'), 10);
      b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); setWant(1, d); });
      b.addEventListener('pointerup', function () { releaseDir(1, d); });
      b.addEventListener('pointerleave', function () { if (dirHeld[1][d]) releaseDir(1, d); });
      b.addEventListener('pointercancel', function () { releaseDir(1, d); });
    })(p2Dirs[p2i]);
  }
  var fire2Btn = document.getElementById('tk-fire2');
  if (fire2Btn) {
    fire2Btn.addEventListener('pointerdown', function (ev) { ev.preventDefault(); fireHeld[1] = true; fire(1); });
    fire2Btn.addEventListener('pointerup', function () { fireHeld[1] = false; });
    fire2Btn.addEventListener('pointerleave', function () { fireHeld[1] = false; });
    fire2Btn.addEventListener('pointercancel', function () { fireHeld[1] = false; });
  }

  /* 模式选择 */
  var modeBtns = pickEl.querySelectorAll('.tk-mode-btn');
  for (var mi = 0; mi < modeBtns.length; mi++) {
    (function (b) {
      b.addEventListener('click', function () {
        pickCoop = parseInt(b.getAttribute('data-m'), 10) === 2 ? 2 : 1;
        for (var j = 0; j < modeBtns.length; j++) {
          modeBtns[j].classList.toggle('active', modeBtns[j] === b);
        }
        audio('ui');
      });
    })(modeBtns[mi]);
  }

  /* ---------- 暂停 ---------- */
  function togglePause() {
    if (!state || state.over || state.choosing) return;
    paused = !paused;
    if (paused) {
      if (loopApi) loopApi.pause();
      pauseEl.classList.remove('hidden');
    } else {
      if (loopApi) loopApi.resume();
      pauseEl.classList.add('hidden');
    }
    audio('ui');
  }

  /* ---------- 开火 ---------- */
  function effFireCd(st) { return Math.max(6, 14 - st.upgrades.rate * 2); }

  function fire(pi) {
    var st = state;
    if (!st || st.over || paused || st.choosing) return;
    var p = st.players[pi];
    if (!p || !p.alive) return;
    if (p.fireCd > 0) return;
    p.fireCd = effFireCd(st);
    if (p.want !== null) p.dir = p.want;
    var d = p.dir;
    var perp = T_DIRS[(d + 1) % 4];
    var offsets = st.upgrades.twin ? [-9, 9] : [0];
    for (var oi = 0; oi < offsets.length; oi++) {
      st.bullets.push({
        x: p.x + 16 + T_DIRS[d][0] * 14 + perp[0] * offsets[oi],
        y: p.y + 16 + T_DIRS[d][1] * 14 + perp[1] * offsets[oi],
        dir: d, speed: 7.8, power: p.power, owner: 'player', source: pi
      });
    }
    st.muzzles.push({
      x: p.x + 16 + T_DIRS[d][0] * 32,
      y: p.y + 16 + T_DIRS[d][1] * 32,
      dir: d, life: 1, owner: 'player'
    });
    audio('drop');
  }

  function enemyFire(e, dir, speed) {
    var st = state;
    var d = (dir === null || dir === undefined) ? e.dir : dir;
    var perp = T_DIRS[(d + 1) % 4];
    var offsets = e.type === 'boss' ? [-11, 0, 11] : [0];
    for (var i = 0; i < offsets.length; i++) {
      st.bullets.push({
        x: e.x + 16 + T_DIRS[d][0] * 16 + perp[0] * offsets[i],
        y: e.y + 16 + T_DIRS[d][1] * 16 + perp[1] * offsets[i],
        dir: d, speed: speed || 5.2, power: 1, owner: 'enemy'
      });
    }
    st.muzzles.push({
      x: e.x + 16 + T_DIRS[d][0] * 34,
      y: e.y + 16 + T_DIRS[d][1] * 34,
      dir: d, life: 1, owner: 'enemy'
    });
  }

  function othersFor(t) {
    var st = state;
    var arr = [];
    var i;
    if (t.kind === 'player') {
      for (i = 0; i < st.enemies.length; i++) if (st.enemies[i].alive) arr.push(st.enemies[i]);
      for (i = 0; i < st.players.length; i++) if (st.players[i] !== t && st.players[i].alive) arr.push(st.players[i]);
      return arr;
    }
    for (i = 0; i < st.players.length; i++) if (st.players[i].alive) arr.push(st.players[i]);
    for (i = 0; i < st.enemies.length; i++) if (st.enemies[i] !== t && st.enemies[i].alive) arr.push(st.enemies[i]);
    return arr;
  }

  /** 平滑格间移动：到格心后清空目标，等下一帧重新规划 */
  function moveTank(t) {
    if (!t.alive) { t.moving = false; return; }
    var st = state;
    if (t.targetGx === undefined) {
      if (!t.moving) return;
      var others = othersFor(t);
      if (!T_canStep(st.grid, t.gx, t.gy, t.dir, others, t)) {
        t.moving = false;
        return;
      }
      t.targetGx = t.gx + T_DIRS[t.dir][0];
      t.targetGy = t.gy + T_DIRS[t.dir][1];
    }
    var tx = t.targetGx * 32, ty = t.targetGy * 32;
    var dx = tx - t.x, dy = ty - t.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var step = Math.min(dist, t.speed);
    if (dist > 0) { t.x += dx / dist * step; t.y += dy / dist * step; }
    if (dist <= step + 0.001) {
      t.x = tx; t.y = ty;
      t.gx = t.targetGx; t.gy = t.targetGy;
      t.targetGx = undefined; t.targetGy = undefined;
      if (t.kind === 'player') {
        if (t.want === null) t.moving = false;
      }
    }
  }

  function updatePlayers() {
    var st = state;
    for (var i = 0; i < st.players.length; i++) {
      var p = st.players[i];
      if (!p.alive) {
        if (p.respawnT > 0) {
          p.respawnT--;
          if (p.respawnT === 0) respawnPlayer(p);
        }
        continue;
      }
      if (p.flash > 0) p.flash--;
      if (p.shield > 0) p.shield--;
      if (p.fireCd > 0) p.fireCd--;
      if (p.want !== null) {
        p.dir = p.want;
        p.moving = true;
      }
      moveTank(p);
      if (fireHeld[i]) fire(i);
    }
  }

  function respawnPlayer(p) {
    var st = state;
    if (!st || st.over || !st.baseAlive) return;
    var cell = findPlayerRespawn(p.pidx, st);
    if (!cell) { p.respawnT = 8; return; }
    p.x = cell[0] * 32; p.y = cell[1] * 32; p.gx = cell[0]; p.gy = cell[1];
    p.targetGx = undefined; p.targetGy = undefined;
    p.dir = 0; p.want = null; p.moving = false; p.alive = true; p.shield = 170;
    p.speed = basePlayerSpeed(st); p.power = 1 + st.upgrades.pierce;
    addBurst(st, p.x + 16, p.y + 16, '#00f0ff', 14);
  }

  /* ---------- 敌人 AI ---------- */
  function nearestPlayer(e) {
    var st = state;
    var best = null, bd = Infinity;
    for (var i = 0; i < st.players.length; i++) {
      var p = st.players[i];
      if (!p.alive) continue;
      var d = Math.abs(p.gx - e.gx) + Math.abs(p.gy - e.gy);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function alignedDir(e, tx, ty) {
    if (e.gx === tx) return ty > e.gy ? 2 : 0;
    if (e.gy === ty) return tx > e.gx ? 1 : 3;
    return null;
  }

  function dirTowardBase(e) {
    var dx = 6 - e.gx, dy = T_BASE_ROW - e.gy;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
    return dy >= 0 ? 2 : 0;
  }

  function enemyShootDecision(e) {
    var st = state;
    if (e.shootCd > 0) return;
    var dir = null, must = false;
    if (e.breakDir !== null && e.breakDir !== undefined) {
      var bx = e.gx + T_DIRS[e.breakDir][0], by = e.gy + T_DIRS[e.breakDir][1];
      if (T_inBounds(bx, by) && st.grid[by][bx] === 'B') { dir = e.breakDir; must = true; }
    }
    if (dir === null) {
      var p = nearestPlayer(e);
      if (p) {
        var pd = alignedDir(e, p.gx, p.gy);
        if (pd !== null && T_lineClear(st.grid, e.gx, e.gy, p.gx, p.gy)) {
          var chance = e.shootP * (e.longRange ? 9 : 3.2);
          if (e.type === 'boss') chance = 1;
          if (Math.random() < chance) { dir = pd; must = true; }
        }
      }
    }
    if (dir === null) {
      var bd = alignedDir(e, 6, T_BASE_ROW);
      if (bd !== null && T_lineClear(st.grid, e.gx, e.gy, 6, T_BASE_ROW)) {
        if (e.type === 'boss' || Math.random() < 0.06) { dir = bd; must = true; }
      }
    }
    if (dir === null) {
      var chance2 = e.type === 'boss' ? 1 : e.shootP * 1.6;
      if (Math.random() < chance2) dir = e.dir;
    }
    if (dir === null) return;
    var speed = e.type === 'sniper' ? 6.1 : (e.type === 'boss' ? 4.6 : 5.1);
    e.dir = dir;
    enemyFire(e, dir, speed);
    e.shootCd = e.type === 'sniper' ? 38 + Math.floor(Math.random() * 22)
      : (e.type === 'boss' ? 46 : 64 + Math.floor(Math.random() * 46));
    if (must && e.type === 'boss') audio('rotate');
  }

  function chooseAltStep(e) {
    var st = state;
    var others = othersFor(e);
    var bestDir = -1, bestScore = Infinity;
    for (var d = 0; d < 4; d++) {
      if (d === ((e.dir + 2) % 4)) continue; // 不立即回头
      if (!T_canStep(st.grid, e.gx, e.gy, d, others, e)) continue;
      var nx = e.gx + T_DIRS[d][0], ny = e.gy + T_DIRS[d][1];
      var score = Math.abs(6 - nx) + Math.abs(T_BASE_ROW - ny) + (d === e.dir ? -0.5 : 0);
      if (score < bestScore) { bestScore = score; bestDir = d; }
    }
    return bestDir;
  }

  function updateEnemies() {
    var st = state;
    for (var i = 0; i < st.enemies.length; i++) {
      var e = st.enemies[i];
      if (!e.alive) continue;
      if (e.flash > 0) e.flash--;
      if (e.spawnAnim > 0) {
        e.spawnAnim--;
        if (e.spawnAnim === 0) e.locked = false;
        continue;
      }
      if (e.locked) continue;
      if (st.enemyFreeze > 0) continue;
      if (e.shootCd > 0) e.shootCd--;
      if (e.targetGx !== undefined) {
        moveTank(e);
        continue;
      }
      e.breakDir = null;
      var path = T_findPath(st.grid, e.gx, e.gy);
      var next = (path && path.length > 1) ? path[1] : null;
      if (next) {
        var nx = next[0], ny = next[1];
        var ch = st.grid[ny][nx];
        if (T_isBaseCell(nx, ny)) {
          e.dir = alignedDir(e, 6, T_BASE_ROW) === null ? dirTowardBase(e) : alignedDir(e, 6, T_BASE_ROW);
          e.waitT = 0;
          enemyShootDecision(e);
          continue;
        }
        var nd = T_stepDir(e.gx, e.gy, nx, ny);
        if (ch === 'B') {
          e.dir = nd;
          e.breakDir = nd;
          e.waitT = 0;
          enemyShootDecision(e);
          continue;
        }
        if (T_occupied(othersFor(e), nx, ny)) {
          e.dir = nd;
          e.waitT = (e.waitT || 0) + 1;
          if (e.waitT > 24) {
            e.waitT = 0;
            var alt = chooseAltStep(e);
            if (alt >= 0) { e.dir = alt; e.moving = true; moveTank(e); }
          }
          enemyShootDecision(e);
          continue;
        }
        e.waitT = 0;
        e.dir = nd;
        e.moving = true;
        moveTank(e);
      } else {
        e.dir = dirTowardBase(e);
        e.waitT = (e.waitT || 0) + 1;
        if (e.waitT > 24) {
          e.waitT = 0;
          var alt2 = chooseAltStep(e);
          if (alt2 >= 0) { e.dir = alt2; e.moving = true; moveTank(e); }
        }
        enemyShootDecision(e);
      }
    }
  }

  function trySpawn() {
    var st = state;
    var sp = T_findSpawn(st.grid, st.enemies, st.spawnSlotCursor);
    if (!sp) { st.spawnTimer = 4; return; }
    var spec = st.spawnQueue.shift();
    var e = {
      x: sp.gx * 32, y: sp.gy * 32, gx: sp.gx, gy: sp.gy, dir: 2, moving: true,
      hp: spec.hp, maxHp: spec.maxHp, speed: spec.speed, kind: 'enemy', alive: true,
      type: spec.type, scale: spec.scale, armored: spec.armored, longRange: spec.longRange,
      boss: !!spec.boss, shootP: spec.shootP, shootCd: spec.shootCd || 30,
      stepTimer: 8, locked: true, spawnAnim: 26, flash: 0, waitT: 0, breakDir: null,
      targetGx: undefined, targetGy: undefined
    };
    st.enemies.push(e);
    st.spawnSlotCursor = (sp.slot + 1) % T_SPAWN_SPOTS.length;
    st.spawnTimer = e.boss ? 44 : 30;
    if (e.boss) {
      showWaveBanner(T('gs.tank.bossIncoming'), T('gs.tank.waveBossSub'), 'var(--neon-pink)', 2200);
      if (Arcade.fx) Arcade.fx.centerBurst('var(--neon-pink)', 18);
      shake();
    }
    audio('ui');
  }

  /* ---------- 子弹 ---------- */
  function updateBullets() {
    var st = state;
    var keep = [];
    for (var i = 0; i < st.bullets.length; i++) {
      var b = st.bullets[i];
      var dead = false;
      var subs = 4;
      for (var s = 0; s < subs && !dead; s++) {
        b.x += T_DIRS[b.dir][0] * b.speed / subs;
        b.y += T_DIRS[b.dir][1] * b.speed / subs;
        if (b.x < 4 || b.y < 4 || b.x > MAP - 4 || b.y > MAP - 4) { dead = true; break; }
        var tanks = [];
        var k;
        if (b.owner === 'player') {
          for (k = 0; k < st.enemies.length; k++) if (st.enemies[k].alive) tanks.push(st.enemies[k]);
        } else {
          for (k = 0; k < st.players.length; k++) if (st.players[k].alive) tanks.push(st.players[k]);
        }
        var coll = T_bulletStep(st.grid, b.x, b.y, b.power, b.owner, tanks);
        if (coll.hit === 'base') {
          dead = true;
          baseDestroyed();
          break;
        }
        if (coll.hit === 'absorb') {
          dead = true;
          addBurst(st, b.x, b.y, '#00f0ff', 8);
          fxBurst(b.x, b.y, 'var(--neon-cyan)', 6);
          break;
        }
        if (coll.hit === 'brick') {
          if (b.owner === 'player') st.score += 10;
          st.guidesDirty = true;
          addBurst(st, b.x, b.y, '#b4642a', 6);
          if (!coll.pass) { dead = true; break; }
        } else if (coll.hit === 'steel') {
          if (b.owner === 'player') st.score += 5;
          addBurst(st, b.x, b.y, '#d8e4f0', 6);
          dead = true;
          break;
        } else if (coll.hit === 'tank') {
          dead = true;
          if (b.owner === 'player') {
            var e = tanks[coll.idx];
            if (e && e.alive) {
              var dmg = (b.power >= 3 && !e.armored) ? 2 : 1;
              e.hp -= dmg;
              e.flash = 10;
              addBurst(st, e.x + 16, e.y + 16, '#ffe600', 8);
              if (e.hp <= 0) killEnemy(e);
              else audio('rotate');
            }
          } else {
            hitPlayer(tanks[coll.idx]);
          }
          break;
        }
      }
      if (st.over) { keep.push(b); break; }
      if (!dead) keep.push(b);
    }
    st.bullets = keep;
  }

  function killEnemy(e) {
    var st = state;
    if (!e.alive) return;
    e.alive = false;
    st.kills++;
    var gain = e.boss ? 800 : (e.type === 'armor' ? 130 : (e.type === 'sniper' ? 110 : (e.type === 'fast' ? 60 : 50)));
    st.score += gain;
    var big = e.boss ? 44 : 20;
    addBurst(st, e.x + 16, e.y + 16, '#ff2d95', big);
    addBurst(st, e.x + 16, e.y + 16, '#ffe600', Math.floor(big / 2));
    addShock(st, e.x + 16, e.y + 16, '#ff2d95', e.boss ? 78 : 32);
    addShock(st, e.x + 16, e.y + 16, '#ffe600', e.boss ? 54 : 20);
    fxBurst(e.x + 16, e.y + 16, 'var(--neon-pink)', e.boss ? 26 : 14);
    audio(e.boss ? 'win' : 'clear');
    shake();
    if (e.boss) {
      st.bossKills++;
      msgEl.textContent = T('gs.tank.bossKilledToast').replace('{s}', String(gain));
      msgEl.style.color = 'var(--neon-pink)';
      showWaveBanner(T('gs.tank.bossKilled'), '+' + gain, 'var(--neon-yellow)', 2000);
      if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
      openUpgrade(true);
    }
    updateHud();
  }

  function hitPlayer(p) {
    var st = state;
    if (!p || !p.alive || st.over) return;
    if (p.shield > 0) {
      addBurst(st, p.x + 16, p.y + 16, '#00f0ff', 12);
      audio('ui');
      return;
    }
    p.alive = false;
    p.moving = false;
    p.want = null;
    p.targetGx = undefined; p.targetGy = undefined;
    st.lives--;
    addBurst(st, p.x + 16, p.y + 16, '#00f0ff', 26);
    addShock(st, p.x + 16, p.y + 16, '#00f0ff', 40);
    fxBurst(p.x + 16, p.y + 16, 'var(--neon-cyan)', 16);
    audio('lose');
    shake();
    if (st.lives <= 0) {
      st.over = true;
      endGame(false);
    } else {
      p.respawnT = 50;
      toast(T('gt.reborn').replace('{n}', st.lives), 'warn');
    }
    updateHud();
  }

  function baseDestroyed() {
    var st = state;
    if (!st.baseAlive) return;
    st.baseAlive = false;
    if (st.over) return;
    st.over = true;
    addBurst(st, 6 * 32, 12 * 32 + 16, '#ff2d95', 40);
    addBurst(st, 6 * 32, 12 * 32 + 16, '#ffe600', 20);
    fxBurst(6 * 32, 12 * 32 + 16, 'var(--neon-pink)', 24);
    if (Arcade.fx) Arcade.fx.flash('var(--neon-pink)');
    shake();
    audio('error');
    endGame(false);
  }

  /* ---------- 道具 ---------- */
  function repairBaseWalls(st) {
    var all = st.players.concat(st.enemies);
    if (!T_occupied(all, 5, 11)) st.grid[11][5] = 'S';
    if (!T_occupied(all, 6, 11)) st.grid[11][6] = 'B';
    if (!T_occupied(all, 7, 11)) st.grid[11][7] = 'S';
    st.guidesDirty = true;
  }

  function applyItem(it) {
    var st = state;
    if (it.type === 'star') {
      st.upgrades.pierce = Math.max(st.upgrades.pierce, 1);
      for (var i = 0; i < st.players.length; i++) {
        var p = st.players[i];
        p.power = Math.max(p.power, Math.min(3, 1 + st.upgrades.pierce));
      }
      msgEl.textContent = T('gt.itemStar');
    } else if (it.type === 'shield') {
      for (var j = 0; j < st.players.length; j++) if (st.players[j].alive) st.players[j].shield = 240;
      msgEl.textContent = T('gt.itemShield');
    } else if (it.type === 'freeze') {
      st.enemyFreeze = 200;
      msgEl.textContent = T('gt.itemFreeze');
    } else if (it.type === 'repair') {
      repairBaseWalls(st);
      if (st.lives < 5) st.lives++;
      msgEl.textContent = T('gt.itemRepair');
    }
    st.score += 30;
    addBurst(it.x + 16, it.y + 16, '#ffe600', 16);
    fxBurst(it.x + 16, it.y + 16, 'var(--neon-yellow)', 10);
    audio('coin');
    updateHud();
  }

  function updateItems() {
    var st = state;
    for (var i = 0; i < st.items.length; i++) {
      var it = st.items[i];
      if (!it.alive) continue;
      for (var j = 0; j < st.players.length; j++) {
        var p = st.players[j];
        if (!p.alive) continue;
        var dx = (it.x + 16) - (p.x + 16);
        var dy = (it.y + 16) - (p.y + 16);
        if (dx * dx + dy * dy < 26 * 26) { it.alive = false; applyItem(it); break; }
      }
    }
  }

  /* ---------- 粒子 ---------- */
  function updateParticles() {
    var st = state;
    for (var i = st.particles.length - 1; i >= 0; i--) {
      var p = st.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.022;
      if (p.life <= 0) st.particles.splice(i, 1);
    }
    for (var s = st.shocks.length - 1; s >= 0; s--) {
      var sh = st.shocks[s];
      sh.r += 2.2; sh.life -= 0.045;
      if (sh.life <= 0) st.shocks.splice(s, 1);
    }
    for (var m = st.muzzles.length - 1; m >= 0; m--) {
      st.muzzles[m].life -= 0.14;
      if (st.muzzles[m].life <= 0) st.muzzles.splice(m, 1);
    }
    for (var k = 0; k < st.players.length; k++) {
      var pl = st.players[k];
      if (pl && pl.alive && pl.moving && Math.random() < 0.25) {
        st.particles.push({
          x: pl.x + 8 + Math.random() * 16, y: pl.y + 26,
          vx: (Math.random() - 0.5) * 0.4, vy: 0.2 + Math.random() * 0.4,
          life: 0.6, size: 1.6 + Math.random() * 1.8, color: 'rgba(160,170,190,0.5)'
        });
      }
    }
  }

  /* ---------- 升级 ---------- */
  function upgradeDesc(id) { return T('gs.tank.up.' + id + '.desc'); }

  function openUpgrade(isBoss) {
    var st = state;
    if (!st || st.over) return;
    st.choosing = true;
    st.upgradeBoss = !!isBoss;
    st.upgradeChoices = T_pickUpgrades(st.rnd, st.upgrades);
    upTitleEl.textContent = isBoss ? T('gs.tank.bossBonus') : T('gs.tank.upgradeTitle');
    upSubEl.textContent = isBoss ? T('gs.tank.upgradeBossSub') : T('gs.tank.upgradeSub');
    var html = '';
    for (var i = 0; i < st.upgradeChoices.length; i++) {
      var id = st.upgradeChoices[i];
      html += '<button class="btn tk-up-btn" data-u="' + id + '">' +
        '<span class="k">' + (i + 1) + '</span>' +
        '<span class="tx"><b>' + T('gs.tank.up.' + id) + '</b><small>' + upgradeDesc(id) + '</small></span>' +
        '</button>';
    }
    upListEl.innerHTML = html;
    upgradeEl.classList.remove('hidden');
    audio('ui');
  }

  function chooseUpgrade(i) {
    var st = state;
    if (!st || !st.choosing) return;
    var id = st.upgradeChoices[i];
    if (!id) return;
    applyUpgrade(id);
    st.choosing = false;
    upgradeEl.classList.add('hidden');
    msgEl.textContent = T('gs.tank.upChosen').replace('{n}', T('gs.tank.up.' + id));
    msgEl.style.color = 'var(--neon-cyan)';
    if (!st.waveActive) st.interT = 50;
    updateHud();
    audio('coin');
  }

  function applyUpgrade(id) {
    var st = state;
    var ups = st.upgrades;
    var i;
    if (id === 'pierce') {
      ups.pierce = Math.min(3, ups.pierce + 1);
      for (i = 0; i < st.players.length; i++) st.players[i].power = Math.min(4, 1 + ups.pierce);
    } else if (id === 'rate') {
      ups.rate = Math.min(6, ups.rate + 1);
    } else if (id === 'shield') {
      for (i = 0; i < st.players.length; i++) if (st.players[i].alive) st.players[i].shield = Math.max(st.players[i].shield, 420);
    } else if (id === 'repair') {
      repairBaseWalls(st);
      if (st.lives < 5) st.lives++;
    } else if (id === 'speed') {
      ups.speed = Math.min(5, ups.speed + 1);
      for (i = 0; i < st.players.length; i++) st.players[i].speed = basePlayerSpeed(st);
    } else if (id === 'twin') {
      ups.twin = true;
    }
    addBurst(st, 6 * 32 + 16, 10 * 32 + 16, '#39ff14', 18);
  }

  upListEl.addEventListener('click', function (ev) {
    var n = ev.target;
    while (n && n !== upListEl) {
      if (n.getAttribute && n.getAttribute('data-u')) {
        var choices = state ? state.upgradeChoices : [];
        chooseUpgrade(choices.indexOf(n.getAttribute('data-u')));
        return;
      }
      n = n.parentNode;
    }
  });

  /* ---------- 主循环 ---------- */
  function update() {
    if (!state || state.over || paused || state.choosing) return;
    var st = state;
    if (st.enemyFreeze > 0) st.enemyFreeze--;
    updatePlayers();
    if (st.waveActive && st.spawnQueue.length) {
      if (st.spawnTimer > 0) st.spawnTimer--;
      else trySpawn();
    }
    updateEnemies();
    updateBullets();
    updateItems();
    updateParticles();
    if (st.guidesDirty) {
      st.guidesDirty = false;
      if (st.baseAlive) st.guides = T_buildGuides(st.grid);
    }
    if (!st.over && !st.choosing) {
      if (st.waveActive && st.spawnQueue.length === 0) {
        var aliveN = 0;
        for (var i = 0; i < st.enemies.length; i++) if (st.enemies[i].alive) aliveN++;
        if (aliveN === 0) {
          st.waveActive = false;
          st.score += 100;
          if (st.wave >= st.conf.waves) {
            st.score += 200;
            victory();
            return;
          }
          msgEl.textContent = T('gt.waveIncoming').replace('{n}', st.wave + 1);
          msgEl.style.color = 'var(--neon-yellow)';
          showWaveBanner(T('gs.tank.waveClear'), T('gs.tank.waveNext').replace('{n}', st.wave + 1), 'var(--neon-cyan)', 1800);
          if (Arcade.fx) Arcade.fx.centerBurst('var(--neon-cyan)', 14);
          openUpgrade(st.waveBoss);
        }
      }
      if (!st.waveActive && !st.choosing && st.interT > 0) {
        st.interT--;
        if (st.interT === 0 && !st.over) startWave(st.wave + 1);
      }
      if (st.lives <= 0 && !st.over) {
        st.over = true;
        endGame(false);
        return;
      }
    }
    updateHud();
  }

  function victory() {
    var st = state;
    st.over = true; st.won = true;
    endGame(true);
  }

  function endGame(win) {
    var st = state;
    if (!st) return;
    upgradeEl.classList.add('hidden');
    if (win) {
      ovTitle.textContent = T('gt.winT');
      ovTitle.className = 'win';
      ovText.innerHTML = T('gt.winD').replace('{w}', st.conf.waves).replace('{k}', st.kills).replace('{s}', st.score);
      audio('win');
      if (Arcade.juice) Arcade.juice.win();
    } else {
      ovTitle.textContent = st.baseAlive ? T('gt.loseAll') : T('gt.loseBase');
      ovTitle.className = '';
      ovText.innerHTML = st.baseAlive
        ? T('gt.loseAllD').replace('{s}', st.score)
        : T('gt.loseBaseD').replace('{s}', st.score);
      audio('lose');
      if (Arcade.juice) Arcade.juice.lose();
    }
    paused = false;
    fireHeld[0] = false; fireHeld[1] = false;
    if (loopApi && !loopApi.isRunning()) loopApi.resume();
    finalScoreEl.textContent = String(st.score);
    overlayEl.classList.remove('hidden');
    if (Arcade.shell) Arcade.shell.submitScore(st.score);
    bestEl.textContent = String(bestScore());
  }

  function updateHud() {
    if (!state) return;
    var st = state;
    var aliveN = 0;
    for (var i = 0; i < st.enemies.length; i++) if (st.enemies[i].alive) aliveN++;
    waveEl.textContent = T('gt.wave') + ' ' + Math.max(1, st.wave) + '/' + st.conf.waves;
    enemiesEl.textContent = T('gt.enemyLeft') + ' ' + (aliveN + st.spawnQueue.length);
    livesEl.textContent = T('gt.lives') + ' ' + Math.max(0, st.lives);
    scoreEl.textContent = st.score + ' ' + T('gt.score');
  }

  /* ---------- 绘制 ---------- */
  var TYPE_PALETTE = {
    normal: { main: '#ff2d95', dark: '#8a0d47' },
    fast: { main: '#ffe600', dark: '#8a7a00' },
    armor: { main: '#ff8c1a', dark: '#7a3a00' },
    sniper: { main: '#b46cff', dark: '#4b1a8a' },
    boss: { main: '#ff3b3b', dark: '#6b0000' }
  };

  function drawMap(st) {
    for (var r = 0; r < T_GRID; r++) {
      for (var c = 0; c < T_GRID; c++) {
        var ch = st.grid[r][c];
        var x = c * 32, y = r * 32;
        if (ch === 'B') {
          var bg = ctx.createLinearGradient(x, y, x, y + 32);
          bg.addColorStop(0, '#c9773a'); bg.addColorStop(1, '#6d3412');
          ctx.fillStyle = bg;
          ctx.fillRect(x, y, 32, 32);
          ctx.fillStyle = 'rgba(255,190,120,0.10)';
          ctx.fillRect(x + 1, y + 1, 30, 14);
          ctx.fillStyle = 'rgba(40,16,4,0.22)';
          ctx.fillRect(x + 1, y + 17, 30, 14);
          ctx.strokeStyle = 'rgba(255,214,170,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + 16.5); ctx.lineTo(x + 32, y + 16.5);
          ctx.moveTo(x + 16, y); ctx.lineTo(x + 16, y + 16);
          ctx.moveTo(x + 4, y + 16); ctx.lineTo(x + 4, y + 32);
          ctx.moveTo(x + 28, y + 16); ctx.lineTo(x + 28, y + 32);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(20,8,2,0.5)';
          ctx.strokeRect(x + 1, y + 1, 30, 30);
          ctx.fillStyle = 'rgba(30,12,4,0.28)';
          ctx.beginPath(); ctx.arc(x + 9, y + 8, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 24, y + 24, 1.8, 0, Math.PI * 2); ctx.fill();
        } else if (ch === 'S') {
          var sg = ctx.createLinearGradient(x, y, x + 32, y + 32);
          sg.addColorStop(0, '#eef6ff'); sg.addColorStop(0.45, '#b9c8da'); sg.addColorStop(1, '#5e7186');
          ctx.fillStyle = sg;
          ctx.fillRect(x, y, 32, 32);
          ctx.strokeStyle = 'rgba(30,44,60,0.85)';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(x + 1, y + 1, 30, 30);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3.5, y + 3.5, 25, 25);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 28); ctx.lineTo(x + 26, y + 6); ctx.lineTo(x + 30, y + 6); ctx.lineTo(x + 10, y + 28);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#dbe7f5';
          ctx.strokeStyle = 'rgba(40,56,74,0.8)';
          [[5, 5], [27, 5], [5, 27], [27, 27]].forEach(function (p) {
            ctx.beginPath(); ctx.arc(x + p[0], y + p[1], 2.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          });
        }
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (var sy = 0; sy < MAP; sy += 4) ctx.fillRect(0, sy, MAP, 1);
  }

  function drawBase(st) {
    var bx = 5 * 32, by = 12 * 32, bw = 96, bh = 32;
    if (!st.baseAlive) {
      ctx.fillStyle = '#2a2028';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(255,45,149,0.17)';
      for (var i = 0; i < 3; i++) {
        var px = bx + 14 + i * 30, ph = 7 + ((Date.now() / 300 + i) % 3) * 3;
        ctx.fillRect(px, by + (32 - ph) / 2, 20, ph);
      }
      return;
    }
    var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
    var g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, '#ff77bb'); g.addColorStop(1, '#8a0d47');
    ctx.save();
    ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 12 + pulse * 12;
    ctx.fillStyle = g;
    if (window.GK) GK.roundRect(ctx, bx + 1, by + 1, bw - 2, bh - 2, 6);
    else ctx.rect(bx + 1, by + 1, bw - 2, bh - 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + pulse * 0.3) + ')';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 5, by + 5, bw - 10, bh - 10);
    ctx.save();
    ctx.translate(bx + bw / 2, by + bh / 2);
    ctx.rotate(Math.sin(Date.now() / 900) * 0.06);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7);
    ctx.moveTo(-4.8, -4.8); ctx.lineTo(4.8, 4.8); ctx.moveTo(4.8, -4.8); ctx.lineTo(-4.8, 4.8);
    ctx.stroke();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(T('gs.tank.hq'), 0, 16.5);
    ctx.restore();
  }

  function drawItem(it) {
    var cx = it.x + 16, cy = it.y + 16;
    var col = { star: '#ffe600', shield: '#00f0ff', freeze: '#6fa8ff', repair: '#39ff14' }[it.type] || '#fff';
    var pulse = 1 + Math.sin(Date.now() / 220 + it.x) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    if (window.GK) GK.roundRect(ctx, -11, -11, 22, 22, 6); else ctx.rect(-11, -11, 22, 22);
    ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = col;
    if (it.type === 'star') {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rr = i % 2 === 0 ? 8 : 3.4;
        var px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    } else if (it.type === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(8, -5); ctx.lineTo(6.5, 4); ctx.lineTo(0, 9);
      ctx.lineTo(-6.5, 4); ctx.lineTo(-8, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-1.2, -5, 2.4, 10);
    } else if (it.type === 'freeze') {
      ctx.lineWidth = 1.8; ctx.strokeStyle = col;
      for (var k = 0; k < 3; k++) {
        var a2 = k * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a2) * -8, Math.sin(a2) * -8);
        ctx.lineTo(Math.cos(a2) * 8, Math.sin(a2) * 8);
        ctx.stroke();
      }
    } else {
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-8, -2, 16, 4);
    }
    ctx.restore();
  }

  function drawTank(t, isPlayer) {
    var cx = t.x + 16, cy = t.y + 16;
    var pal;
    if (isPlayer) pal = t.pidx === 1 ? { main: '#39ff14', dark: '#0a6b12' } : { main: '#00f0ff', dark: '#046f80' };
    else pal = TYPE_PALETTE[t.type] || TYPE_PALETTE.normal;
    var main = pal.main, dark = pal.dark;
    var scale = isPlayer ? 1 : (t.scale || 1);
    var anim = t.spawnAnim || 0;
    ctx.save();
    ctx.translate(cx, cy);
    if (anim > 0) {
      var prog = 1 - anim / 26;
      ctx.globalAlpha = Math.min(1, 0.35 + prog);
      var ea = window.GK ? GK.easeOutBack(prog) : prog;
      ctx.scale((0.55 + 0.45 * ea) * scale, (0.55 + 0.45 * ea) * scale);
      ctx.strokeStyle = 'rgba(0,240,255,' + (0.7 * (1 - prog)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 12 + prog * 16, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.scale(scale, scale);
    }
    ctx.rotate(t.dir * Math.PI / 2);
    // 车底阴影
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 12, 15, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    // 底盘光晕（BOSS）
    if (t.type === 'boss') {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(Date.now() / 160) * 0.12;
      ctx.strokeStyle = main;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 履带
    var tg = ctx.createLinearGradient(-16, 0, 16, 0);
    tg.addColorStop(0, '#4a5568'); tg.addColorStop(0.5, '#2b3342'); tg.addColorStop(1, '#4a5568');
    ctx.fillStyle = tg;
    if (window.GK) { GK.roundRect(ctx, -15, -13, 8, 26, 3); ctx.fill(); GK.roundRect(ctx, 7, -13, 8, 26, 3); ctx.fill(); }
    else { ctx.fillRect(-15, -13, 8, 26); ctx.fillRect(7, -13, 8, 26); }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    var treadOff = ((t.x + t.y) % 4 + 4) % 4;
    for (var sy = -10 + treadOff; sy <= 10; sy += 4) {
      ctx.beginPath(); ctx.moveTo(-15, sy); ctx.lineTo(-7, sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, sy); ctx.lineTo(15, sy); ctx.stroke();
    }
    // 车体
    var bg = ctx.createLinearGradient(-11, -11, 11, 11);
    bg.addColorStop(0, main); bg.addColorStop(0.55, dark); bg.addColorStop(1, main);
    ctx.fillStyle = bg;
    if (window.GK) { GK.roundRect(ctx, -11, -12, 22, 24, 5); ctx.fill(); }
    else ctx.fillRect(-11, -12, 22, 24);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 装甲板纹路
    if (t.type === 'armor' || t.type === 'boss') {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-7, -8, 14, 16);
      ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(7, -2); ctx.stroke();
    }
    // 车体高光
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    if (window.GK) { GK.roundRect(ctx, -8, -9, 16, 5, 2.5); ctx.fill(); }
    else ctx.fillRect(-8, -9, 16, 5);
    // 炮塔
    var tgr = ctx.createRadialGradient(-2, -2, 1, 0, 0, 10);
    tgr.addColorStop(0, '#ffffff'); tgr.addColorStop(0.35, main); tgr.addColorStop(1, dark);
    ctx.fillStyle = tgr;
    ctx.beginPath(); ctx.arc(0, 0, t.type === 'boss' ? 11 : 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // 炮管（狙击手更长、BOSS 双管）
    var barrel = t.type === 'sniper' ? 30 : (t.type === 'boss' ? 28 : 24);
    ctx.fillStyle = dark;
    if (t.type === 'boss') {
      if (window.GK) { GK.roundRect(ctx, -6.4, -barrel, 5.8, barrel - 6, 3); ctx.fill(); GK.roundRect(ctx, 0.6, -barrel, 5.8, barrel - 6, 3); ctx.fill(); }
      else { ctx.fillRect(-6.4, -barrel, 5.8, barrel - 6); ctx.fillRect(0.6, -barrel, 5.8, barrel - 6); }
    } else {
      if (window.GK) { GK.roundRect(ctx, -3.6, -barrel, 7.2, barrel - 8, 3); ctx.fill(); }
      else ctx.fillRect(-3.6, -barrel, 7.2, barrel - 8);
    }
    ctx.fillStyle = main;
    if (t.type === 'boss') {
      if (window.GK) { GK.roundRect(ctx, -4.6, -barrel + 1, 3, barrel - 10, 1.5); ctx.fill(); GK.roundRect(ctx, 1.6, -barrel + 1, 3, barrel - 10, 1.5); ctx.fill(); }
      else { ctx.fillRect(-4.6, -barrel + 1, 3, barrel - 10); ctx.fillRect(1.6, -barrel + 1, 3, barrel - 10); }
    } else {
      if (window.GK) { GK.roundRect(ctx, -2, -barrel + 1, 4, barrel - 10, 2); ctx.fill(); }
      else ctx.fillRect(-2, -barrel + 1, 4, barrel - 10);
    }
    // 受击闪白
    if (t.flash > 0) {
      ctx.globalAlpha = Math.min(0.85, t.flash / 10);
      ctx.fillStyle = '#ffffff';
      if (window.GK) { GK.roundRect(ctx, -12, -13, 24, 26, 6); ctx.fill(); }
      else ctx.fillRect(-12, -13, 24, 26);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // 护盾光环（不随方向旋转）
    if ((isPlayer && t.shield > 0) || (!isPlayer && t.slowT > 0)) {
      var sc = isPlayer ? (t.pidx === 1 ? '#39ff14' : '#00f0ff') : '#6fa8ff';
      ctx.save();
      ctx.translate(cx, cy);
      var pulse = 18 + Math.sin(Date.now() / 160) * 2;
      ctx.strokeStyle = sc;
      ctx.globalAlpha = 0.55 + Math.sin(Date.now() / 200) * 0.2;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = sc;
      ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 敌人血条（装甲/狙击/BOSS）
    if (!isPlayer && t.maxHp > 1) {
      var hpR = Math.max(0, t.hp / t.maxHp);
      var bw = t.type === 'boss' ? 34 : 24;
      var bx = cx - bw / 2, by = cy - 24 - (scale - 1) * 8;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, bw, 3.5);
      ctx.fillStyle = hpR > 0.5 ? '#39ff14' : (hpR > 0.22 ? '#ffe600' : '#ff3b3b');
      ctx.fillRect(bx, by, bw * hpR, 3.5);
    }
  }

  function drawBullet(b) {
    var dx = T_DIRS[b.dir][0], dy = T_DIRS[b.dir][1];
    var col = b.owner === 'player' ? (b.power >= 3 ? '#39ff14' : '#ffe600') : '#ff7a3c';
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    var tg = ctx.createLinearGradient(b.x - dx * 12, b.y - dy * 12, b.x, b.y);
    tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, col);
    ctx.strokeStyle = tg; ctx.lineWidth = b.power >= 2 ? 4 : 3;
    ctx.beginPath(); ctx.moveTo(b.x - dx * 13, b.y - dy * 13); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawMuzzle(m) {
    var col = m.owner === 'player' ? '#ffe600' : '#ff7a3c';
    var a = Math.max(0, m.life);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.dir * Math.PI / 2);
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    g.addColorStop(0, 'rgba(255,255,230,0.95)');
    g.addColorStop(0.35, col);
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,220,' + a + ')';
    for (var i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2 * 0.5);
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(2.2, 0); ctx.lineTo(0, 13); ctx.lineTo(-2.2, 0);
      ctx.closePath(); ctx.globalAlpha = a * 0.5; ctx.fill();
    }
    ctx.restore();
  }

  function drawShocks() {
    if (!state) return;
    state.shocks.forEach(function (s) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life) * 0.9;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (s.maxR / 34), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
  }

  function drawGuides(st) {
    if (!st.guides || !st.guides.length) return;
    var off = -(performance.now() / 70) % 14;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = off;
    st.guides.forEach(function (path) {
      if (!path || path.length < 2) return;
      ctx.beginPath();
      for (var i = 0; i < path.length; i++) {
        var x = path[i][0] * 32 + 16, y = path[i][1] * 32 + 16;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawSniperAims(st) {
    ctx.save();
    for (var i = 0; i < st.enemies.length; i++) {
      var e = st.enemies[i];
      if (!e.alive || e.type !== 'sniper') continue;
      var p = nearestPlayer(e);
      if (!p) continue;
      var d = alignedDir(e, p.gx, p.gy);
      if (d === null || !T_lineClear(st.grid, e.gx, e.gy, p.gx, p.gy)) continue;
      ctx.globalAlpha = 0.12 + (e.shootCd < 12 ? 0.1 : 0);
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(e.x + 16, e.y + 16);
      ctx.lineTo(p.x + 16, p.y + 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBossBar(st) {
    var boss = null;
    for (var i = 0; i < st.enemies.length; i++) {
      if (st.enemies[i].alive && st.enemies[i].type === 'boss') { boss = st.enemies[i]; break; }
    }
    if (!boss) return;
    var bx = 36, by = 9, bw = MAP - 72, bh = 12;
    var hpR = Math.max(0, boss.hp / boss.maxHp);
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,16,0.82)';
    if (window.GK) GK.roundRect(ctx, bx, by, bw, bh, 5); else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    var g = ctx.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, '#ff2d95'); g.addColorStop(0.5, '#ff8c1a'); g.addColorStop(1, '#ffe600');
    ctx.fillStyle = g;
    ctx.fillRect(bx + 2, by + 2, (bw - 4) * hpR, bh - 4);
    ctx.strokeStyle = 'rgba(255,59,59,0.85)';
    ctx.lineWidth = 1.2;
    if (window.GK) GK.roundRect(ctx, bx, by, bw, bh, 5); else ctx.rect(bx, by, bw, bh);
    ctx.stroke();
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(T('gs.tank.bossBar'), bx + 6, by + bh / 2 + 0.5);
    ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(hpR * 100) + '%', bx + bw - 6, by + bh / 2 + 0.5);
    ctx.restore();
  }

  function draw() {
    if (!state) {
      ctx.clearRect(0, 0, MAP, MAP);
      return;
    }
    var st = state;
    var bg = ctx.createLinearGradient(0, 0, 0, MAP);
    bg.addColorStop(0, '#0a1220'); bg.addColorStop(0.6, '#0b0e16'); bg.addColorStop(1, '#140d18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, MAP, MAP);
    ctx.strokeStyle = 'rgba(0,240,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= T_GRID; i++) {
      ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, MAP);
      ctx.moveTo(0, i * 32); ctx.lineTo(MAP, i * 32);
    }
    ctx.stroke();
    drawGuides(st);
    drawMap(st);
    drawSniperAims(st);
    drawBase(st);
    st.items.forEach(function (it) { if (it.alive) drawItem(it); });
    st.particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    st.bullets.forEach(drawBullet);
    st.enemies.forEach(function (e) { if (e.alive) drawTank(e, false); });
    for (var pi = 0; pi < st.players.length; pi++) {
      if (st.players[pi].alive) drawTank(st.players[pi], true);
    }
    st.muzzles.forEach(drawMuzzle);
    drawShocks();
    drawBossBar(st);
    if (st.enemyFreeze > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(110,168,255,0.10)';
      ctx.fillRect(0, 0, MAP, MAP);
      ctx.restore();
    }
  }

  /* ---------- 按钮绑定 ---------- */
  var pickBtns = pickEl.querySelectorAll('button[data-i]');
  for (var i = 0; i < pickBtns.length; i++) {
    (function (b) {
      b.addEventListener('click', function () {
        startGame(parseInt(b.getAttribute('data-i'), 10), pickCoop);
      });
    })(pickBtns[i]);
  }
  document.getElementById('tk-resume').addEventListener('click', togglePause);
  document.getElementById('tk-pause-restart').addEventListener('click', function () {
    startGame(state ? state.diff : 0, state ? state.coop : pickCoop);
  });
  document.getElementById('tk-again').addEventListener('click', function () {
    startGame(state ? state.diff : 0, state ? state.coop : pickCoop);
  });
  document.getElementById('tk-change').addEventListener('click', openPicker);

  /* helpText */
  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.tank.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    if (state) startGame(state.diff, state.coop);
    else openPicker();
  };

  window.GAME_TUTORIAL_STEPS = [
    { t: T('gt.tut1t'), d: T('gt.tut1') },
    { t: T('gt.tut2t'), d: T('gs.tank.tut2x') },
    { t: T('gs.tank.tut3t'), d: T('gs.tank.tut3x') },
    { t: T('gs.tank.tut4t'), d: T('gs.tank.tut4x') },
    { t: T('gt.tut4t'), d: T('gt.tut4') }
  ];

  openPicker();
})();
