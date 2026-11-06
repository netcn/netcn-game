/* ============================================================
   绵羊三消 SHEEP MATCH · 草地三消（旗舰重制）
   交换相邻绵羊，横向/纵向凑 3 只同色消除 → 连锁下落 → 特殊羊（4 连直线 / 5 连彩虹）
   12 关草原委托（目标分 + 清除数量 + 收集指定颜色 + 限步）、星级与解锁进度；
   4 种道具（锤子 / 洗牌 / 加时 / 彩虹炮）；自由牧场与每日挑战完整保留。
   视觉：Canvas 手绘绵羊、星级 / 粒子 / 屏震 / 目标闪光；霓虹配色与全站一致。
   核心逻辑用 ==YANG-CORE-START== / ==YANG-CORE-END== 标记包裹，供 Node harness 提取。
   ============================================================ */

(function () {
  /* ==YANG-CORE-START== */
  var Y_uid = 1;

  function Y_mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function Y_pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function Y_shuffle(arr, rnd) {
    var rf = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rf() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function Y_newTile(type, rnd) {
    return {
      type: type,
      special: null,
      expr: Math.floor((rnd ? rnd() : Math.random()) * 4),
      id: Y_uid++,
      px: 0, py: 0, alpha: 1, scale: 1, clearing: false, pop: 0
    };
  }
  function Y_inGrid(g, r, c) {
    return !!(g && r >= 0 && c >= 0 && r < g.length && g[r] && c < g[r].length);
  }

  /** 生成棋盘：无初始三连，且至少存在一步可消 */
  function Y_genGrid(cols, rows, types, rnd) {
    var g, tries = 0;
    do {
      g = [];
      for (var r = 0; r < rows; r++) {
        var row = [];
        for (var c = 0; c < cols; c++) {
          var banned = {};
          if (c >= 2 && row[c - 1].type === row[c - 2].type) banned[row[c - 1].type] = 1;
          if (r >= 2 && g[r - 1][c].type === g[r - 2][c].type) banned[g[r - 1][c].type] = 1;
          var t = 0, guard = 0;
          do {
            t = Math.floor(rnd() * types);
            guard++;
          } while (banned[t] && guard < 40);
          row.push(Y_newTile(t, rnd));
        }
        g.push(row);
      }
      tries++;
    } while (!Y_findMove(g) && tries < 40);
    return g;
  }

  /** 扫描全部三连/四连/五连（横竖独立），返回 runs */
  function Y_findMatches(g) {
    var runs = [], rows = g.length, cols = g[0].length;
    function cellsH(r, c0, c1) {
      var arr = [];
      for (var c = c0; c <= c1; c++) arr.push({ r: r, c: c });
      return arr;
    }
    function cellsV(c, r0, r1) {
      var arr = [];
      for (var r = r0; r <= r1; r++) arr.push({ r: r, c: c });
      return arr;
    }
    for (var r = 0; r < rows; r++) {
      var c = 0;
      while (c < cols) {
        var t = g[r][c];
        if (!t || t.type < 0) { c++; continue; }
        var c2 = c;
        while (c2 + 1 < cols && g[r][c2 + 1] && g[r][c2 + 1].type === t.type) c2++;
        var len = c2 - c + 1;
        if (len >= 3) runs.push({ dir: 'h', r: r, c: c, len: len, type: t.type, cells: cellsH(r, c, c2) });
        c = c2 + 1;
      }
    }
    for (var c3 = 0; c3 < cols; c3++) {
      var r3 = 0;
      while (r3 < rows) {
        var t3 = g[r3][c3];
        if (!t3 || t3.type < 0) { r3++; continue; }
        var r4 = r3;
        while (r4 + 1 < rows && g[r4 + 1][c3] && g[r4 + 1][c3].type === t3.type) r4++;
        var len3 = r4 - r3 + 1;
        if (len3 >= 3) runs.push({ dir: 'v', r: r3, c: c3, len: len3, type: t3.type, cells: cellsV(c3, r3, r4) });
        r3 = r4 + 1;
      }
    }
    return runs;
  }

  /** 是否存在可行交换（含彩虹羊）；返回坐标或 null */
  function Y_findMove(g) {
    var rows = g.length, cols = g[0].length;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var a = g[r][c];
        if (!a) continue;
        var nb = [[r, c + 1], [r + 1, c]];
        for (var i = 0; i < nb.length; i++) {
          var nr = nb[i][0], nc = nb[i][1];
          if (!Y_inGrid(g, nr, nc)) continue;
          var b = g[nr][nc];
          if (!b) continue;
          var rainbow = a.special === 'rainbow' || b.special === 'rainbow';
          if (a.type === b.type && !rainbow) continue;
          g[r][c] = b; g[nr][nc] = a;
          var moves = Y_findMatches(g);
          g[r][c] = a; g[nr][nc] = b;
          if (rainbow || moves.length) return { r1: r, c1: c, r2: nr, c2: nc };
        }
      }
    }
    return null;
  }

  /** 展开消除集合中的特殊羊（直线 → 整行/列；彩虹 → 同色全部），返回触发数 */
  function Y_expand(g, clear) {
    var rows = g.length, cols = g[0].length;
    var activated = {}, changed = true, guard = 0;
    function add(r, c) {
      if (Y_inGrid(g, r, c) && g[r][c]) clear[r + ',' + c] = 1;
    }
    while (changed && guard++ < 8) {
      changed = false;
      for (var key in clear) {
        if (activated[key]) continue;
        var p = key.split(',');
        var r = parseInt(p[0], 10), c = parseInt(p[1], 10);
        var t = g[r] && g[r][c];
        if (!t || !t.special) continue;
        activated[key] = 1;
        if (t.special === 'row') {
          for (var cc = 0; cc < cols; cc++) add(r, cc);
          changed = true;
        } else if (t.special === 'col') {
          for (var rr = 0; rr < rows; rr++) add(rr, c);
          changed = true;
        } else if (t.special === 'rainbow') {
          var typ = t.type;
          if (typ >= 0) {
            for (var r2 = 0; r2 < rows; r2++) {
              for (var c2 = 0; c2 < cols; c2++) {
                if (g[r2][c2] && g[r2][c2].type === typ) add(r2, c2);
              }
            }
          }
          add(r, c);
          changed = true;
        }
      }
    }
    return Object.keys(activated).length;
  }

  /** 根据 runs 规划消除：4 连生成直线羊、5 连生成彩虹羊；并展开已有特殊效果 */
  function Y_plan(g, runs, swapCell) {
    var clear = {}, specials = {};
    function key(r, c) { return r + ',' + c; }
    function add(r, c) {
      if (Y_inGrid(g, r, c) && g[r][c]) clear[key(r, c)] = 1;
    }
    function pickAnchor(cells, run) {
      if (swapCell && g[swapCell.r] && g[swapCell.r][swapCell.c] &&
          cells.some(function (x) { return x.r === swapCell.r && x.c === swapCell.c; })) {
        if (!g[swapCell.r][swapCell.c].special) return { r: swapCell.r, c: swapCell.c };
      }
      var mid = cells[Math.floor(cells.length / 2)];
      if (g[mid.r][mid.c] && !g[mid.r][mid.c].special) return mid;
      for (var i = 0; i < cells.length; i++) {
        var x = cells[i];
        if (g[x.r][x.c] && !g[x.r][x.c].special) return x;
      }
      return null;
    }
    runs.forEach(function (run) {
      var cells = run.cells;
      if (!cells.length) return;
      var sp = run.len >= 5 ? 'rainbow' : (run.len === 4 ? (run.dir === 'h' ? 'row' : 'col') : null);
      var anchor = sp ? pickAnchor(cells, run) : null;
      if (sp && anchor) {
        specials[key(anchor.r, anchor.c)] = {
          r: anchor.r, c: anchor.c, special: sp,
          type: sp === 'rainbow' ? -1 : run.type
        };
      }
      for (var i = 0; i < cells.length; i++) {
        if (sp && anchor && cells[i].r === anchor.r && cells[i].c === anchor.c) continue;
        add(cells[i].r, cells[i].c);
      }
    });
    var triggered = Y_expand(g, clear);
    for (var sk in specials) delete clear[sk];
    var cells = [];
    for (var k in clear) {
      var pp = k.split(',');
      cells.push({ r: parseInt(pp[0], 10), c: parseInt(pp[1], 10) });
    }
    var list = [];
    for (var sk2 in specials) list.push(specials[sk2]);
    return { cells: cells, specials: list, triggered: triggered };
  }

  /** 重力下落 + 顶部补新羊；返回动画数据 */
  function Y_drop(g, types, rnd) {
    var rows = g.length, cols = g[0].length;
    var moves = [], spawns = [], maxDist = 0;
    for (var c = 0; c < cols; c++) {
      var write = rows - 1;
      for (var r = rows - 1; r >= 0; r--) {
        if (!g[r][c]) continue;
        if (write !== r) {
          moves.push({ tile: g[r][c], fromR: r, toR: write, c: c, dist: write - r });
          g[write][c] = g[r][c];
          g[r][c] = null;
          if (write - r > maxDist) maxDist = write - r;
        }
        write--;
      }
      var missing = write + 1;
      for (var r2 = write; r2 >= 0; r2--) {
        var from = r2 - missing;
        var t = Y_newTile(Math.floor(rnd() * types), rnd);
        t.px = c; t.py = from; t.fallFrom = from; t.spawn = true; t.alpha = 0;
        g[r2][c] = t;
        spawns.push({ tile: t, fromR: from, toR: r2, c: c, dist: r2 - from });
        if (r2 - from > maxDist) maxDist = r2 - from;
      }
    }
    for (var i = 0; i < moves.length; i++) {
      moves[i].tile.px = moves[i].c;
      moves[i].tile.py = moves[i].fromR;
    }
    return { moves: moves, spawns: spawns, maxDist: maxDist };
  }
  /* ==YANG-CORE-END== */

  var root = document.getElementById('game-root');
  if (!root) return;

  if (window.Arcade && Arcade.shell && Arcade.shell.setBestMode) {
    try { Arcade.shell.setBestMode('max'); } catch (e) {}
  }

  var BOX = 380, PAD = 12;
  var DIFF = [
    { cols: 8, rows: 8, types: 5, time: 120, target: 1200, name: 'gs.sheep.dEasy', desc: 'gs.sheep.dEasyD' },
    { cols: 8, rows: 8, types: 6, time: 90, target: 2000, name: 'gs.sheep.dNormal', desc: 'gs.sheep.dNormalD' },
    { cols: 9, rows: 9, types: 6, time: 75, target: 3000, name: 'gs.sheep.dHard', desc: 'gs.sheep.dHardD' }
  ];

  /* 12 关委托：目标分 + 清除数 + 指定颜色收集 + 可选的限步。
     数量均远低于连消/补羊可产生的上限，且洗牌保底保证棋盘始终有解。 */
  var LEVELS = [
    { cols: 8, rows: 8, types: 5, time: 120, target: 900, clear: 22, colors: [], moves: 0, grant: { hammer: 1, shuffle: 1, time: 1, rainbow: 1 } },
    { cols: 8, rows: 8, types: 5, time: 110, target: 1100, clear: 28, colors: [[0, 12]], moves: 0, grant: { hammer: 1, shuffle: 1, time: 1, rainbow: 0 } },
    { cols: 8, rows: 8, types: 6, time: 105, target: 1300, clear: 34, colors: [], moves: 0, grant: { hammer: 1, shuffle: 1, time: 1, rainbow: 1 } },
    { cols: 8, rows: 8, types: 6, time: 100, target: 1500, clear: 38, colors: [[2, 14]], moves: 0, grant: { hammer: 2, shuffle: 1, time: 1, rainbow: 1 } },
    { cols: 8, rows: 8, types: 6, time: 100, target: 1600, clear: 34, colors: [], moves: 45, grant: { hammer: 2, shuffle: 2, time: 1, rainbow: 1 } },
    { cols: 9, rows: 9, types: 6, time: 95, target: 1900, clear: 46, colors: [], moves: 0, grant: { hammer: 2, shuffle: 1, time: 2, rainbow: 1 } },
    { cols: 9, rows: 9, types: 6, time: 90, target: 2100, clear: 48, colors: [[1, 14], [5, 14]], moves: 0, grant: { hammer: 2, shuffle: 2, time: 1, rainbow: 1 } },
    { cols: 9, rows: 9, types: 6, time: 85, target: 2300, clear: 54, colors: [], moves: 0, grant: { hammer: 2, shuffle: 2, time: 2, rainbow: 1 } },
    { cols: 9, rows: 9, types: 6, time: 80, target: 2500, clear: 58, colors: [[0, 10], [2, 10], [4, 10]], moves: 0, grant: { hammer: 2, shuffle: 2, time: 2, rainbow: 2 } },
    { cols: 9, rows: 9, types: 6, time: 80, target: 2500, clear: 40, colors: [], moves: 52, grant: { hammer: 3, shuffle: 2, time: 2, rainbow: 1 } },
    { cols: 9, rows: 9, types: 6, time: 75, target: 2800, clear: 62, colors: [], moves: 0, grant: { hammer: 3, shuffle: 2, time: 2, rainbow: 2 } },
    { cols: 9, rows: 9, types: 6, time: 70, target: 3000, clear: 58, colors: [[1, 12], [3, 12], [5, 12]], moves: 0, grant: { hammer: 3, shuffle: 3, time: 2, rainbow: 2 } }
  ];

  var SHEEP_PALETTE = [
    { wool: '#f5f7fb', woolDark: '#c5cddd', face: '#ffe3d2', faceDark: '#e6b79e', accent: '#ffd166', line: '#2c2f3a' },
    { wool: '#ffd3e8', woolDark: '#e592bd', face: '#ffe7f2', faceDark: '#e8a9c8', accent: '#ff4fa3', line: '#4a1630' },
    { wool: '#c9f7d8', woolDark: '#82ce9e', face: '#e5fff0', faceDark: '#aad9bd', accent: '#22d67a', line: '#0d3320' },
    { wool: '#dccbff', woolDark: '#a98ce6', face: '#f1e8ff', faceDark: '#c6b3e8', accent: '#9b6bff', line: '#241542' },
    { wool: '#ffe8a6', woolDark: '#d9b84c', face: '#fff7d8', faceDark: '#e6cf8c', accent: '#ffb800', line: '#3a2c06' },
    { wool: '#c3e9ff', woolDark: '#72b7d9', face: '#e3f7ff', faceDark: '#a7d0e4', accent: '#3aa8ff', line: '#0c2740' }
  ];

  var TOOL_IDS = ['hammer', 'shuffle', 'time', 'rainbow'];
  var TOOL_DEFS = [
    { id: 'hammer', name: 'gs.sheep.toolHammer', tip: 'gs.sheep.toolHammerTip', color: '#ffb800',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20.5l6.6-6.6"/><path d="M8.6 8.3l4.2-4.2 7.1 7.1-4.2 4.2z"/><path d="M12.8 4.1l7.1 7.1"/></svg>' },
    { id: 'shuffle', name: 'gs.sheep.toolShuffle', tip: 'gs.sheep.toolShuffleTip', color: '#00f0ff',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h3.5l9 12h3.5"/><path d="M4 18h3.5l9-12h3.5"/><path d="M17 3l3 3-3 3"/><path d="M17 15l3 3-3 3"/></svg>' },
    { id: 'time', name: 'gs.sheep.toolTime', tip: 'gs.sheep.toolTimeTip', color: '#39ff14',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.2v5.2l3.5 2"/></svg>' },
    { id: 'rainbow', name: 'gs.sheep.toolRainbow', tip: 'gs.sheep.toolRainbowTip', color: '#9b6bff',
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 17a8.4 8.4 0 0 1 16.8 0"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M10.6 17a1.4 1.4 0 0 1 2.8 0"/><path d="M13.4 4.6l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9z"/></svg>' }
  ];

  var STYLE = [
    '.sh-wrap, .sh-wrap * { box-sizing: border-box; }',
    '.sh-wrap { padding: 12px 10px 24px; width: 100%; max-width: 520px; margin: 0 auto; text-align: center; overflow-x: hidden; }',
    '.sh-picker { background: linear-gradient(180deg, rgba(20,44,30,.82), rgba(8,18,13,.92)); border: 1px solid rgba(57,255,20,.32); border-radius: 16px; padding: 16px 13px 14px; margin: 6px 0 10px; box-shadow: 0 0 28px rgba(57,255,20,.10), inset 0 0 18px rgba(57,255,20,.05); }',
    '.sh-picker-t { font-family: var(--font-pixel); font-size: 13px; letter-spacing: 1px; color: var(--neon-green); text-shadow: 0 0 12px rgba(57,255,20,.45); margin-bottom: 7px; }',
    '.sh-picker-d { font-size: 11px; color: var(--text-dim); line-height: 1.7; margin: 0 auto 10px; max-width: 340px; }',
    '.sh-progress { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px 14px; font-size: 10px; color: var(--text-dim); margin: 0 0 4px; }',
    '.sh-progress b { color: var(--neon-yellow); font-family: var(--font-pixel); font-size: 9px; }',
    '.sh-sec { display: flex; align-items: center; gap: 8px; font-family: var(--font-pixel); font-size: 9px; letter-spacing: .4px; color: var(--neon-cyan); margin: 14px 0 8px; text-align: left; }',
    '.sh-sec::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(0,240,255,.4), rgba(0,240,255,0)); }',
    '.sh-levels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }',
    '.sh-lv { position: relative; display: flex; flex-direction: column; gap: 3px; min-height: 94px; padding: 7px 7px 6px; text-align: left; cursor: pointer; font-family: inherit; color: var(--text-main,#e8e8f0); background: linear-gradient(160deg, rgba(57,255,20,.07), rgba(185,103,255,.05)); border: 1px solid rgba(57,255,20,.26); border-radius: 10px; transition: transform .15s, border-color .15s, box-shadow .15s; }',
    '.sh-lv:hover { transform: translateY(-1px); border-color: rgba(57,255,20,.7); box-shadow: 0 0 14px rgba(57,255,20,.25); }',
    '.sh-lv.done { border-color: rgba(57,255,20,.62); box-shadow: 0 0 12px rgba(57,255,20,.18); }',
    '.sh-lv.locked { opacity: .46; cursor: not-allowed; filter: grayscale(.5); }',
    '.sh-lv.locked:hover { transform: none; border-color: rgba(57,255,20,.26); box-shadow: none; }',
    '.sh-lv-top { display: flex; justify-content: space-between; align-items: center; gap: 3px; font-family: var(--font-pixel); font-size: 8px; color: var(--neon-yellow); }',
    '.sh-lv-name { font-size: 10.5px; line-height: 1.3; color: #dfe8ff; min-height: 14px; }',
    '.sh-lv-mini { display: flex; flex-wrap: wrap; gap: 1px 5px; font-size: 9px; line-height: 1.5; color: var(--text-dim); }',
    '.sh-lv-best { font-size: 8px; color: rgba(255,230,0,.75); font-family: var(--font-pixel); margin-top: auto; }',
    '.sh-mini-colors { display: inline-flex; gap: 2px; align-items: center; }',
    '.sh-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 5px currentColor; }',
    '.sh-stars { display: flex; gap: 5px; justify-content: center; align-items: center; }',
    '.sh-stars svg { width: 13px; height: 13px; display: block; }',
    '.sh-star path { fill: rgba(255,255,255,.10); stroke: rgba(255,230,0,.45); stroke-width: 1.4; }',
    '.sh-star.on path { fill: #ffe600; stroke: #fff7c0; filter: drop-shadow(0 0 4px rgba(255,230,0,.85)); }',
    '.sh-diffs { display: grid; gap: 7px; margin: 0; }',
    '.sh-diff { display: flex; flex-direction: column; gap: 2px; width: 100%; min-height: 44px; padding: 8px 12px; text-align: left; cursor: pointer; font-family: inherit; background: linear-gradient(90deg, rgba(57,255,20,.06), rgba(185,103,255,.05)); border: 1px solid rgba(57,255,20,.28); border-radius: 10px; color: var(--text-main,#e8e8f0); transition: transform .15s, border-color .15s, box-shadow .15s; }',
    '.sh-diff b { font-family: var(--font-pixel); font-size: 10px; letter-spacing: .5px; color: var(--neon-yellow); }',
    '.sh-diff small { font-size: 10px; color: var(--text-dim); }',
    '.sh-diff:hover { transform: translateY(-1px); border-color: var(--neon-green); box-shadow: 0 0 16px rgba(57,255,20,.28); }',
    '.sh-diff:active { transform: translateY(0); }',
    '.sh-daily { margin-top: 8px; font-size: 11px; min-height: 44px; }',
    '.sh-hud { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px 9px; font-size: 10px; color: var(--text-dim); padding: 7px 9px; background: linear-gradient(90deg, rgba(57,255,20,.08), rgba(185,103,255,.06)); border: 1px solid rgba(57,255,20,.3); border-radius: 9px; }',
    '.sh-hud #sh-level { color: var(--neon-green); font-family: var(--font-pixel); font-size: 9px; flex-basis: 100%; text-align: left; }',
    '.sh-hud #sh-score, .sh-hud #sh-time, .sh-hud #sh-moves { color: var(--neon-yellow); font-family: var(--font-pixel); font-size: 9px; }',
    '.sh-hud #sh-time.sh-low { color: var(--neon-pink); animation: sh-pulse .9s ease-in-out infinite; }',
    '@keyframes sh-pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }',
    '.sh-goals { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; margin: 7px 0 0; }',
    '.sh-goal { display: inline-flex; align-items: center; gap: 4px; font-size: 9.5px; line-height: 1.4; padding: 3px 7px; border-radius: 7px; background: rgba(0,0,0,.34); border: 1px solid rgba(255,255,255,.10); color: var(--text-dim); }',
    '.sh-goal em { font-style: normal; }',
    '.sh-goal b { font-family: var(--font-pixel); font-size: 8.5px; color: var(--neon-yellow); }',
    '.sh-goal.done { border-color: rgba(57,255,20,.55); color: var(--neon-green); background: rgba(57,255,20,.09); }',
    '.sh-goal.done b { color: var(--neon-green); }',
    '.sh-tools { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 7px 0 0; }',
    '.sh-tool { position: relative; min-height: 50px; padding: 4px 2px 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; font-family: inherit; border-radius: 9px; border: 1px solid rgba(0,240,255,.28); background: linear-gradient(180deg, rgba(0,240,255,.07), rgba(0,0,0,.22)); color: var(--tool-c, #00f0ff); transition: transform .12s, border-color .15s, box-shadow .15s; }',
    '.sh-tool:hover { border-color: var(--tool-c, #00f0ff); box-shadow: 0 0 12px rgba(0,240,255,.25); }',
    '.sh-tool:active { transform: scale(.96); }',
    '.sh-tool.active { border-color: #ffe600; color: #ffe600; box-shadow: 0 0 16px rgba(255,230,0,.55); }',
    '.sh-tool.off { opacity: .4; }',
    '.sh-tool svg { width: 18px; height: 18px; display: block; }',
    '.sh-tool-name { font-size: 9px; color: var(--text-dim); line-height: 1.2; }',
    '.sh-tool-n { position: absolute; top: 2px; right: 4px; font-family: var(--font-pixel); font-size: 7.5px; color: var(--neon-yellow); }',
    '.sh-tool-tip { font-size: 9.5px; color: var(--text-dim); min-height: 15px; line-height: 1.5; margin: 3px 1px 0; text-align: left; }',
    '.sh-stage { position: relative; width: 100%; max-width: 380px; margin: 8px auto 5px; }',
    '.sh-cv { display: block; width: 100%; height: auto; max-width: 100%; border-radius: 16px; touch-action: none; user-select: none; -webkit-user-select: none; background: #08130d; box-shadow: 0 0 20px rgba(57,255,20,.16), 0 10px 26px rgba(0,0,0,.55); }',
    '.sh-hint { font-size: 10px; color: var(--text-dim); line-height: 1.6; margin: 5px 2px 0; }',
    '.sh-msg { font-size: 11px; color: var(--text-main); min-height: 18px; margin: 4px 0 0; padding: 6px 8px; text-align: left; border-radius: 8px; background: rgba(0,0,0,.32); border: 1px solid rgba(255,255,255,.08); }',
    '.sh-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 30%, rgba(57,255,20,.12), rgba(4,9,6,.96) 62%); padding: 12px; overflow-y: auto; }',
    '.sh-card { width: 100%; max-width: 330px; display: flex; flex-direction: column; gap: 9px; padding: 15px 13px; border-radius: 14px; background: linear-gradient(180deg, rgba(22,46,32,.98), rgba(7,16,12,.98)); border: 1px solid rgba(57,255,20,.45); box-shadow: 0 0 32px rgba(57,255,20,.22); }',
    '.sh-card h2 { font-family: var(--font-pixel); font-size: 13px; letter-spacing: 1px; color: var(--neon-yellow); margin: 0; }',
    '.sh-card p { font-size: 11px; line-height: 1.7; color: var(--text-dim); margin: 0; }',
    '.sh-card p b { color: var(--neon-yellow); }',
    '.sh-stars-big { gap: 7px; }',
    '.sh-stars-big svg { width: 28px; height: 28px; }',
    '.sh-stats { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; font-size: 10px; color: var(--text-dim); }',
    '.sh-stats b { display: inline-block; margin-left: 3px; font-family: var(--font-pixel); font-size: 11px; color: var(--neon-yellow); }',
    '.sh-ov-goals { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }',
    '.sh-newrec { font-family: var(--font-pixel); font-size: 9px; letter-spacing: .5px; color: var(--neon-yellow); text-shadow: 0 0 12px rgba(255,230,0,.7); }',
    '.sh-btns { display: flex; gap: 7px; justify-content: center; flex-wrap: wrap; }',
    '.sh-btns .btn { min-width: 92px; min-height: 44px; font-size: 11px; padding: 8px 12px; }',
    '.sh-week { margin: 10px 0 2px; padding: 10px 11px; border: 1px solid rgba(0,240,255,.34); border-radius: 12px; background: linear-gradient(160deg, rgba(0,240,255,.08), rgba(185,103,255,.06)); text-align: left; }',
    '.sh-week-top { display: flex; flex-wrap: wrap; gap: 4px 8px; justify-content: space-between; align-items: center; }',
    '.sh-week-tag { font-family: var(--font-pixel); font-size: 9px; letter-spacing: .3px; color: var(--neon-cyan); }',
    '.sh-week-status { font-size: 9.5px; color: var(--text-dim); }',
    '.sh-week-status.on { color: var(--neon-green); }',
    '.sh-week-best { font-size: 10px; color: var(--text-dim); margin-top: 5px; }',
    '.sh-week-best b { font-family: var(--font-pixel); font-size: 10px; color: var(--neon-yellow); }',
    '.sh-week-rules { font-size: 9.5px; color: var(--text-dim); line-height: 1.7; margin-top: 3px; overflow-wrap: anywhere; }',
    '.sh-week-note { font-size: 9px; color: rgba(0,240,255,.62); line-height: 1.5; margin-top: 2px; }',
    '.sh-week-go { width: 100%; min-height: 44px; margin-top: 8px; font-size: 11px; }',
    '.sh-extras { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }',
    '.sh-extras .btn { min-height: 44px; font-size: 11px; padding: 8px 10px; }',
    '.sh-panel { position: fixed; inset: 0; z-index: 9900; display: flex; align-items: center; justify-content: center; padding: 10px; background: rgba(4,9,6,.9); overflow: hidden; }',
    '.sh-panel-card { width: 100%; max-width: 400px; max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; background: linear-gradient(180deg, rgba(22,46,32,.99), rgba(7,16,12,.99)); border: 1px solid rgba(57,255,20,.45); box-shadow: 0 0 32px rgba(57,255,20,.22); overflow: hidden; }',
    '.sh-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 10px 6px 12px; }',
    '.sh-panel-head h2 { margin: 0; text-align: left; font-family: var(--font-pixel); font-size: 11px; letter-spacing: .6px; color: var(--neon-yellow); min-width: 0; overflow-wrap: anywhere; }',
    '.sh-panel-close { flex: 0 0 44px; width: 44px; height: 44px; padding: 0; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 14px; color: var(--neon-cyan); background: rgba(0,240,255,.08); border: 1px solid rgba(0,240,255,.35); }',
    '.sh-panel-close:hover { border-color: var(--neon-cyan); }',
    '.sh-panel-body { min-height: 0; padding: 0 10px 12px; overflow-y: auto; -webkit-overflow-scrolling: touch; overflow-x: hidden; }',
    '.sh-panel-sum { font-size: 10px; color: var(--text-dim); line-height: 1.6; margin: 0 2px 8px; text-align: left; }',
    '.sh-ach { display: flex; align-items: flex-start; gap: 8px; padding: 8px; margin-bottom: 7px; border-radius: 9px; border: 1px solid rgba(255,255,255,.09); background: rgba(0,0,0,.28); text-align: left; }',
    '.sh-ach.on { border-color: rgba(57,255,20,.5); background: rgba(57,255,20,.07); }',
    '.sh-ach-ico { flex: 0 0 26px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(255,230,0,.35); color: var(--neon-yellow); font-size: 12px; background: rgba(255,230,0,.06); }',
    '.sh-ach.on .sh-ach-ico { border-color: rgba(57,255,20,.65); color: var(--neon-green); }',
    '.sh-ach-main { flex: 1 1 auto; min-width: 0; }',
    '.sh-ach-name { font-size: 11px; line-height: 1.35; color: #e8e8f0; overflow-wrap: anywhere; }',
    '.sh-ach-desc { font-size: 9.5px; line-height: 1.5; color: var(--text-dim); margin-top: 1px; overflow-wrap: anywhere; }',
    '.sh-ach-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,.12); margin-top: 5px; overflow: hidden; }',
    '.sh-ach-bar i { display: block; height: 100%; background: linear-gradient(90deg, #39ff14, #ffe600); }',
    '.sh-ach-p { flex: 0 0 auto; align-self: center; font-family: var(--font-pixel); font-size: 8px; line-height: 1.5; color: var(--neon-yellow); text-align: right; max-width: 62px; }',
    '.sh-ach-p.on { color: var(--neon-green); }',
    '.sh-cx { display: flex; align-items: flex-start; gap: 9px; padding: 8px; margin-bottom: 7px; border-radius: 9px; border: 1px solid rgba(255,255,255,.09); background: rgba(0,0,0,.28); text-align: left; }',
    '.sh-cx.on { border-color: rgba(0,240,255,.45); background: rgba(0,240,255,.06); }',
    '.sh-cx-ico { flex: 0 0 32px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 9px; border: 1px solid rgba(0,240,255,.28); background: rgba(0,240,255,.06); color: var(--neon-cyan); overflow: hidden; }',
    '.sh-cx.locked .sh-cx-ico { opacity: .4; filter: grayscale(.7); }',
    '.sh-cx-mascot { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; background: currentColor; }',
    '.sh-cx-mascot span { color: #102015; }',
    '.sh-cx-ico svg { width: 18px; height: 18px; display: block; }',
    '.sh-cx-main { flex: 1 1 auto; min-width: 0; }',
    '.sh-cx-name { font-size: 11px; line-height: 1.35; color: #e8e8f0; overflow-wrap: anywhere; }',
    '.sh-cx.locked .sh-cx-name { color: var(--text-dim); }',
    '.sh-cx-desc { font-size: 9.5px; line-height: 1.5; color: var(--text-dim); margin-top: 1px; overflow-wrap: anywhere; }',
    '.sh-cx-cond { font-size: 9px; line-height: 1.5; color: rgba(0,240,255,.8); margin-top: 3px; overflow-wrap: anywhere; }',
    '@media (max-width: 480px) {',
    '  .sh-wrap { padding: 10px 8px 20px; }',
    '  .sh-picker { padding: 13px 10px 12px; }',
    '  .sh-picker-t { font-size: 12px; }',
    '  .sh-lv { min-height: 92px; padding: 6px 6px 5px; }',
    '  .sh-card { padding: 13px 10px; }',
    '  .sh-btns .btn { min-width: 84px; font-size: 10px; }',
    '}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  function starSvg(on, cls) {
    return '<svg class="sh-star' + (on ? ' on' : '') + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.95 6.05 6.7.95-4.85 4.7 1.15 6.65-5.95-3.15-5.95 3.15 1.15-6.65-4.85-4.7 6.7-.95z"/></svg>';
  }
  function starsHtml(n, extraCls) {
    var h = '';
    for (var i = 0; i < 3; i++) h += starSvg(i < n, extraCls);
    return h;
  }
  function toolBtnHtml(t) {
    return '<button type="button" class="sh-tool" data-tool="' + t.id + '" style="--tool-c:' + t.color + '" aria-label="' + T(t.name) + '">' +
      '<span class="sh-tool-ico">' + t.svg + '</span>' +
      '<span class="sh-tool-name">' + T(t.name) + '</span>' +
      '<span class="sh-tool-n" id="sh-tool-n-' + t.id + '">0</span></button>';
  }

  root.innerHTML =
    '<div class="sh-wrap">' +
    '  <div class="sh-picker" id="sh-picker">' +
    '    <div class="sh-picker-t">' + T('gs.sheep.pickT') + '</div>' +
    '    <div class="sh-picker-d">' + T('gs.sheep.pickD') + '</div>' +
    '    <div class="sh-progress" id="sh-progress"></div>' +
    '    <div class="sh-week" id="sh-week">' +
    '      <div class="sh-week-top"><span class="sh-week-tag" id="sh-week-tag"></span><span class="sh-week-status" id="sh-week-status"></span></div>' +
    '      <div class="sh-week-best" id="sh-week-best"></div>' +
    '      <div class="sh-week-rules" id="sh-week-rules"></div>' +
    '      <div class="sh-week-note">' + T('gs.sheep.weeklyNote') + '</div>' +
    '      <button type="button" class="btn green sh-week-go" id="sh-week-go">' + T('gs.sheep.weeklyStart') + '</button>' +
    '    </div>' +
    '    <div class="sh-sec">' + T('gs.sheep.levels') + '</div>' +
    '    <div class="sh-levels" id="sh-levels"></div>' +
    '    <div class="sh-sec">' + T('gs.sheep.freePlay') + '</div>' +
    '    <div class="sh-diffs" id="sh-diffs"></div>' +
    '    <button type="button" class="btn purple sh-daily" id="sh-daily">' + T('gs.sheep.daily') + '</button>' +
    '    <div class="sh-extras">' +
    '      <button type="button" class="btn cyan" id="sh-btn-achv">' + T('gs.sheep.achvBtn') + '</button>' +
    '      <button type="button" class="btn cyan" id="sh-btn-codex">' + T('gs.sheep.codexBtn') + '</button>' +
    '    </div>' +
    '  </div>' +
    '  <div class="sh-game hidden" id="sh-game">' +
    '    <div class="sh-hud">' +
    '      <span id="sh-level"></span>' +
    '      <span id="sh-score"></span><span id="sh-target"></span>' +
    '      <span id="sh-time"></span><span id="sh-moves" style="display:none"></span>' +
    '      <span id="sh-chain"></span><span id="sh-best"></span>' +
    '    </div>' +
    '    <div class="sh-goals" id="sh-goals"></div>' +
    '    <div class="sh-tools" id="sh-tools">' + TOOL_DEFS.map(toolBtnHtml).join('') + '</div>' +
    '    <div class="sh-tool-tip" id="sh-tool-tip"></div>' +
    '    <div class="sh-stage" id="sh-stage">' +
    '      <canvas id="sh-cv" class="sh-cv" width="' + BOX + '" height="' + BOX + '"></canvas>' +
    '      <div class="sh-overlay hidden" id="sh-overlay">' +
    '        <div class="sh-card">' +
    '          <h2 id="sh-ov-title"></h2>' +
    '          <div class="sh-stars sh-stars-big" id="sh-ov-stars"></div>' +
    '          <p id="sh-ov-text"></p>' +
    '          <div class="sh-ov-goals" id="sh-ov-goals"></div>' +
    '          <div class="sh-stats">' +
    '            <span>' + T('gs.sheep.score') + ' <b id="sh-final">0</b></span>' +
    '            <span>' + T('gs.sheep.chain') + ' <b id="sh-final-chain">0</b></span>' +
    '            <span>' + T('gs.sheep.best') + ' <b id="sh-final-best">0</b></span>' +
    '          </div>' +
    '          <div class="sh-newrec hidden" id="sh-newrec">' + T('gs.sheep.newRecord') + '</div>' +
    '          <div class="sh-btns" id="sh-ov-btns"></div>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="sh-hint">' + T('gs.sheep.hint') + '</div>' +
    '    <div class="sh-msg" id="sh-msg"></div>' +
    '  </div>' +
    '  <div class="sh-panel hidden" id="sh-panel" role="dialog" aria-modal="true">' +
    '    <div class="sh-panel-card">' +
    '      <div class="sh-panel-head"><h2 id="sh-panel-title"></h2><button type="button" class="sh-panel-close" id="sh-panel-close" aria-label="' + T('gs.sheep.close') + '">✕</button></div>' +
    '      <div class="sh-panel-body" id="sh-panel-body"></div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var pickEl = document.getElementById('sh-picker');
  var gameEl = document.getElementById('sh-game');
  var stageEl = document.getElementById('sh-stage');
  var msgEl = document.getElementById('sh-msg');
  var scoreEl = document.getElementById('sh-score');
  var targetEl = document.getElementById('sh-target');
  var timeEl = document.getElementById('sh-time');
  var movesEl = document.getElementById('sh-moves');
  var chainEl = document.getElementById('sh-chain');
  var hudBestEl = document.getElementById('sh-best');
  var levelEl = document.getElementById('sh-level');
  var goalsEl = document.getElementById('sh-goals');
  var toolsEl = document.getElementById('sh-tools');
  var tipEl = document.getElementById('sh-tool-tip');
  var overlayEl = document.getElementById('sh-overlay');
  var ovTitle = document.getElementById('sh-ov-title');
  var ovText = document.getElementById('sh-ov-text');
  var ovStars = document.getElementById('sh-ov-stars');
  var ovGoals = document.getElementById('sh-ov-goals');
  var ovBtns = document.getElementById('sh-ov-btns');
  var finalScoreEl = document.getElementById('sh-final');
  var finalChainEl = document.getElementById('sh-final-chain');
  var finalBestEl = document.getElementById('sh-final-best');
  var newRecEl = document.getElementById('sh-newrec');
  var levelsEl = document.getElementById('sh-levels');
  var progressEl = document.getElementById('sh-progress');
  var weekTagEl = document.getElementById('sh-week-tag');
  var weekStatusEl = document.getElementById('sh-week-status');
  var weekBestEl = document.getElementById('sh-week-best');
  var weekRulesEl = document.getElementById('sh-week-rules');
  var weekGoEl = document.getElementById('sh-week-go');
  var panelEl = document.getElementById('sh-panel');
  var panelTitleEl = document.getElementById('sh-panel-title');
  var panelBodyEl = document.getElementById('sh-panel-body');
  var panelCloseEl = document.getElementById('sh-panel-close');
  var panelKind = null;
  /* 面板挂到 body，避免被页面内层叠上下文压到共享顶栏下方 */
  if (panelEl && panelEl.parentNode !== document.body) document.body.appendChild(panelEl);
  var bestModeKey = (window.Arcade && Arcade.shell && Arcade.shell.gameId) || 'sheep';

  var canvas = document.getElementById('sh-cv');
  var ctx, cw = BOX, ch = BOX;
  if (window.GK) {
    var info = GK.setup(canvas, BOX, BOX);
    ctx = info.ctx; cw = info.w; ch = info.h;
  } else {
    ctx = canvas.getContext('2d');
    if (window.Arcade && Arcade.input && Arcade.input.hiDPI) Arcade.input.hiDPI(canvas);
  }
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxWidth = BOX + 'px';

  /* ---------- 进度存档（Arcade.savegame · id=sheep） ---------- */
  var LEVEL_MAX = LEVELS.length;
  function defaultTools() { return { hammer: 1, shuffle: 1, time: 1, rainbow: 1 }; }
  function defaultProfile() {
    return { v: 1, unlocked: 1, stars: {}, best: {}, tools: defaultTools(), starsTotal: 0 };
  }
  function clampInt(v, a, b) {
    v = parseInt(v, 10);
    if (isNaN(v)) return a;
    return v < a ? a : (v > b ? b : v);
  }
  function sanitizeProfile(p) {
    var d = defaultProfile();
    if (!p || typeof p !== 'object') return d;
    d.unlocked = clampInt(p.unlocked, 1, LEVEL_MAX);
    for (var i = 0; i < LEVEL_MAX; i++) {
      var s = clampInt(p.stars && p.stars[i], 0, 3);
      if (s > 0) d.stars[i] = s;
      var b = Number(p.best && p.best[i]);
      if (isFinite(b) && b > 0) d.best[i] = b;
      d.starsTotal += s;
    }
    var t = p.tools || {};
    for (var k = 0; k < TOOL_IDS.length; k++) {
      var id = TOOL_IDS[k];
      d.tools[id] = clampInt(t[id], 0, 3);
    }
    return d;
  }

  /* ---------- 长期目标存档：成就 / 图鉴 / 周挑战 ---------- */
  var ACHV_KEY = 'arcade_achv_sheep';
  var WEEKLY_KEY = 'arcade_weekly_sheep';
  function readStore(k) {
    try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeStore(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function defaultMeta() {
    return {
      v: 1, a: {}, c: {},
      stats: {
        levelWins: 0, streak: 0, bestStreak: 0, bestScore: 0, maxChain: 0,
        line: 0, rainbow: 0, noToolWins: 0, weeklyWins: 0,
        colors: {}, tools: { hammer: 0, shuffle: 0, time: 0, rainbow: 0 }
      }
    };
  }
  function sanitizeMeta(m) {
    var d = defaultMeta();
    if (!m || typeof m !== 'object') return d;
    if (m.a && typeof m.a === 'object') for (var k in m.a) if (m.a[k]) d.a[k] = 1;
    if (m.c && typeof m.c === 'object') for (var k2 in m.c) if (m.c[k2]) d.c[k2] = 1;
    var s = m.stats || {};
    d.stats.levelWins = clampInt(s.levelWins, 0, 99999);
    d.stats.streak = clampInt(s.streak, 0, 99999);
    d.stats.bestStreak = clampInt(s.bestStreak, 0, 99999);
    d.stats.bestScore = clampInt(s.bestScore, 0, 99999999);
    d.stats.maxChain = clampInt(s.maxChain, 0, 9999);
    d.stats.line = clampInt(s.line, 0, 99999);
    d.stats.rainbow = clampInt(s.rainbow, 0, 99999);
    d.stats.noToolWins = clampInt(s.noToolWins, 0, 99999);
    d.stats.weeklyWins = clampInt(s.weeklyWins, 0, 99999);
    if (s.colors && typeof s.colors === 'object') {
      for (var ck in s.colors) d.stats.colors[ck] = clampInt(s.colors[ck], 0, 99999);
    }
    if (s.tools && typeof s.tools === 'object') {
      for (var tk = 0; tk < TOOL_IDS.length; tk++) d.stats.tools[TOOL_IDS[tk]] = clampInt(s.tools[TOOL_IDS[tk]], 0, 99999);
    }
    return d;
  }
  var meta = sanitizeMeta(readStore(ACHV_KEY));

  function clearedLevelCount() {
    var n = 0;
    for (var i = 0; i < LEVEL_MAX; i++) if ((profile.stars[i] || 0) > 0) n++;
    return n;
  }

  /* 16 项成就：通关数 / 星数 / 单局高分 / 连锁 / 特殊羊 / 四种道具 / 无道具 / 连胜 */
  var ACH_DEFS = [
    { id: 'first_win', n: 'gs.sheep.a1n', d: 'gs.sheep.a1d', need: 1, get: function () { return Math.max(meta.stats.levelWins, clearedLevelCount()); } },
    { id: 'win6', n: 'gs.sheep.a2n', d: 'gs.sheep.a2d', need: 6, get: clearedLevelCount },
    { id: 'win12', n: 'gs.sheep.a3n', d: 'gs.sheep.a3d', need: 12, get: clearedLevelCount },
    { id: 'stars12', n: 'gs.sheep.a4n', d: 'gs.sheep.a4d', need: 12, get: function () { return profile.starsTotal; } },
    { id: 'stars24', n: 'gs.sheep.a5n', d: 'gs.sheep.a5d', need: 24, get: function () { return profile.starsTotal; } },
    { id: 'stars36', n: 'gs.sheep.a6n', d: 'gs.sheep.a6d', need: 36, get: function () { return profile.starsTotal; } },
    { id: 'score2400', n: 'gs.sheep.a7n', d: 'gs.sheep.a7d', need: 2400, get: function () { return meta.stats.bestScore; } },
    { id: 'score3500', n: 'gs.sheep.a8n', d: 'gs.sheep.a8d', need: 3500, get: function () { return meta.stats.bestScore; } },
    { id: 'chain5', n: 'gs.sheep.a9n', d: 'gs.sheep.a9d', need: 5, get: function () { return meta.stats.maxChain; } },
    { id: 'special', n: 'gs.sheep.a10n', d: 'gs.sheep.a10d', need: 1, get: function () { return meta.stats.line + meta.stats.rainbow; } },
    { id: 'tool_hammer', n: 'gs.sheep.a11n', d: 'gs.sheep.a11d', need: 1, get: function () { return meta.stats.tools.hammer; } },
    { id: 'tool_shuffle', n: 'gs.sheep.a12n', d: 'gs.sheep.a12d', need: 1, get: function () { return meta.stats.tools.shuffle; } },
    { id: 'tool_time', n: 'gs.sheep.a13n', d: 'gs.sheep.a13d', need: 1, get: function () { return meta.stats.tools.time; } },
    { id: 'tool_rainbow', n: 'gs.sheep.a14n', d: 'gs.sheep.a14d', need: 1, get: function () { return meta.stats.tools.rainbow; } },
    { id: 'no_tool', n: 'gs.sheep.a15n', d: 'gs.sheep.a15d', need: 1, get: function () { return meta.stats.noToolWins; } },
    { id: 'streak3', n: 'gs.sheep.a16n', d: 'gs.sheep.a16d', need: 3, get: function () { return meta.stats.bestStreak; } }
  ];
  /* 12 个图鉴：6 色羊 + 直线羊 + 彩虹羊 + 4 种道具 */
  var CODEX_DEFS = [
    { id: 'c0', type: 0, n: 'gs.sheep.c0n', d: 'gs.sheep.c0d', c: 'gs.sheep.c0c', need: 20, get: function () { return meta.stats.colors[0] || 0; } },
    { id: 'c1', type: 1, n: 'gs.sheep.c1n', d: 'gs.sheep.c1d', c: 'gs.sheep.c1c', need: 20, get: function () { return meta.stats.colors[1] || 0; } },
    { id: 'c2', type: 2, n: 'gs.sheep.c2n', d: 'gs.sheep.c2d', c: 'gs.sheep.c2c', need: 20, get: function () { return meta.stats.colors[2] || 0; } },
    { id: 'c3', type: 3, n: 'gs.sheep.c3n', d: 'gs.sheep.c3d', c: 'gs.sheep.c3c', need: 20, get: function () { return meta.stats.colors[3] || 0; } },
    { id: 'c4', type: 4, n: 'gs.sheep.c4n', d: 'gs.sheep.c4d', c: 'gs.sheep.c4c', need: 20, get: function () { return meta.stats.colors[4] || 0; } },
    { id: 'c5', type: 5, n: 'gs.sheep.c5n', d: 'gs.sheep.c5d', c: 'gs.sheep.c5c', need: 20, get: function () { return meta.stats.colors[5] || 0; } },
    { id: 'c6', icon: 'line', n: 'gs.sheep.c6n', d: 'gs.sheep.c6d', c: 'gs.sheep.c6c', need: 1, get: function () { return meta.stats.line; } },
    { id: 'c7', icon: 'rainbow', n: 'gs.sheep.c7n', d: 'gs.sheep.c7d', c: 'gs.sheep.c7c', need: 1, get: function () { return meta.stats.rainbow; } },
    { id: 'c8', icon: 'hammer', n: 'gs.sheep.c8n', d: 'gs.sheep.c8d', c: 'gs.sheep.c8c', need: 1, get: function () { return meta.stats.tools.hammer; } },
    { id: 'c9', icon: 'shuffle', n: 'gs.sheep.c9n', d: 'gs.sheep.c9d', c: 'gs.sheep.c9c', need: 1, get: function () { return meta.stats.tools.shuffle; } },
    { id: 'c10', icon: 'time', n: 'gs.sheep.c10n', d: 'gs.sheep.c10d', c: 'gs.sheep.c10c', need: 1, get: function () { return meta.stats.tools.time; } },
    { id: 'c11', icon: 'rainbow', n: 'gs.sheep.c11n', d: 'gs.sheep.c11d', c: 'gs.sheep.c11c', need: 1, get: function () { return meta.stats.tools.rainbow; } }
  ];

  function achvRows() {
    var out = [], i, def, raw, done;
    for (i = 0; i < ACH_DEFS.length; i++) {
      def = ACH_DEFS[i]; raw = def.get() || 0; done = !!meta.a[def.id] || raw >= def.need;
      out.push({ def: def, raw: raw, p: Math.min(raw, def.need), need: def.need, done: done });
    }
    return out;
  }
  function codexRows() {
    var out = [], i, def, raw, done;
    for (i = 0; i < CODEX_DEFS.length; i++) {
      def = CODEX_DEFS[i]; raw = def.get() || 0; done = !!meta.c[def.id] || raw >= def.need;
      out.push({ def: def, raw: raw, p: Math.min(raw, def.need), need: def.need, done: done });
    }
    return out;
  }
  function checkUnlocks(silent) {
    var freshA = [], freshC = [], i, rows, crows;
    rows = achvRows();
    for (i = 0; i < rows.length; i++) {
      if (!meta.a[rows[i].def.id] && rows[i].raw >= rows[i].need) { meta.a[rows[i].def.id] = 1; freshA.push(rows[i].def); }
    }
    crows = codexRows();
    for (i = 0; i < crows.length; i++) {
      if (!meta.c[crows[i].def.id] && crows[i].raw >= crows[i].need) { meta.c[crows[i].def.id] = 1; freshC.push(crows[i].def); }
    }
    if (freshA.length || freshC.length) writeStore(ACHV_KEY, meta);
    if (silent) return;
    if (freshA.length === 1) toast(T('gs.sheep.unlockAchv').replace('{n}', T(freshA[0].n)), 'win');
    else if (freshA.length > 1) toast(T('gs.sheep.unlockAchvMany').replace('{n}', freshA.length), 'win');
    if (freshC.length === 1) toast(T('gs.sheep.unlockCodex').replace('{n}', T(freshC[0].n)), 'win');
    else if (freshC.length > 1) toast(T('gs.sheep.unlockCodexMany').replace('{n}', freshC.length), 'win');
    if (freshA.length || freshC.length) {
      renderWeeklyCard();
      if (panelKind) renderPanel();
    }
  }
  function noteToolUse(id) {
    if (!id || !meta.stats.tools) return;
    meta.stats.tools[id] = clampInt(meta.stats.tools[id], 0, 99999) + 1;
    if (G) G.toolsUsed = true;
    writeStore(ACHV_KEY, meta);
    checkUnlocks(false);
  }
  function recordRunStats(win) {
    if (!G) return;
    var s = meta.stats;
    if (win) {
      s.streak = (s.streak || 0) + 1;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      if (G.mode === 'level') {
        s.levelWins++;
        if (!G.toolsUsed) s.noToolWins++;
      }
      if (G.mode === 'weekly') s.weeklyWins++;
    } else {
      s.streak = 0;
    }
    if (G.score > s.bestScore) s.bestScore = G.score;
    if (G.maxChain > s.maxChain) s.maxChain = G.maxChain;
    var cc = G.colorClears || {};
    for (var k in cc) s.colors[k] = (s.colors[k] || 0) + cc[k];
    s.line += G.specLine || 0;
    s.rainbow += G.specRainbow || 0;
    writeStore(ACHV_KEY, meta);
    checkUnlocks(false);
  }

  /* ---------- 周挑战：ISO 周作为种子，独立于 12 关 ---------- */
  function isoWeekInfo(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var week = Math.ceil((((d - ys) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: week };
  }
  function weeklyKeyNow() {
    var w = isoWeekInfo(new Date());
    return w.year + '-W' + (w.week < 10 ? '0' + w.week : w.week);
  }
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    return h % 2147483647 || 1;
  }
  function weeklyConf() {
    var key = weeklyKeyNow();
    var h = hashSeed('sheep-weekly-' + key);
    var cols = 8 + (h % 2);
    var types = 5 + (Math.floor(h / 2) % 2);
    var time = 80 + (Math.floor(h / 4) % 5) * 5;
    var target = 1800 + (Math.floor(h / 8) % 6) * 200;
    var clear = 34 + (Math.floor(h / 16) % 8) * 3;
    var colorType = (h + 3) % types;
    var colorNeed = 12 + (Math.floor(h / 128) % 3) * 2;
    return {
      cols: cols, rows: cols, types: types, time: time, target: target, clear: clear,
      colors: [[colorType, colorNeed]], moves: 0,
      grant: { hammer: 2, shuffle: 2, time: 2, rainbow: 1 },
      name: 'gs.sheep.weeklyTitle', seed: hashSeed('sheep-seed-' + key)
    };
  }
  function loadWeekly() {
    var d = readStore(WEEKLY_KEY);
    if (!d || typeof d !== 'object' || !d.weeks || typeof d.weeks !== 'object') d = { v: 1, weeks: {} };
    return d;
  }
  var weeklyState = loadWeekly();
  function weeklyInfo() {
    var w = isoWeekInfo(new Date());
    var key = weeklyKeyNow();
    var rec = weeklyState.weeks[key] || null;
    return {
      key: key, year: w.year, week: w.week, conf: weeklyConf(),
      best: rec ? clampInt(rec.best, 0, 9999999) : 0,
      tries: rec ? clampInt(rec.tries, 0, 9999) : 0,
      played: !!rec && clampInt(rec.tries, 0, 9999) > 0
    };
  }
  function recordWeekly(score) {
    var key = weeklyKeyNow();
    var rec = weeklyState.weeks[key] || { best: 0, tries: 0 };
    rec.tries = clampInt(rec.tries, 0, 9999) + 1;
    var n = Number(score) || 0;
    var isNew = n > rec.best;
    if (isNew) rec.best = Math.max(0, Math.floor(n));
    weeklyState.weeks[key] = rec;
    var keys = Object.keys(weeklyState.weeks);
    if (keys.length > 10) {
      keys.sort();
      while (keys.length > 10) delete weeklyState.weeks[keys.shift()];
    }
    writeStore(WEEKLY_KEY, weeklyState);
    return { isNew: isNew, best: rec.best, tries: rec.tries };
  }

  var profile = defaultProfile();
  function saveNow() {
    try { if (window.Arcade && Arcade.savegame) Arcade.savegame.write(); } catch (e) {}
  }
  if (window.Arcade && Arcade.savegame) {
    try {
      Arcade.savegame.setup({
        id: 'sheep',
        msg: 'gs.sheep.resumed',
        collect: function () { return { v: 1, profile: profile }; },
        apply: function (s) {
          if (!s || !s.profile) return false;
          profile = sanitizeProfile(s.profile);
          renderPicker();
          return true;
        }
      });
      Arcade.savegame.resume();
      checkUnlocks(true);
    } catch (e) {}
  }

  /* ---------- 运行时状态 ---------- */
  var cols = 8, rows = 8, S = 44, OX = 14, OY = 10;
  var grid = [], G = null, phase = 'idle';
  var selected = null, cursor = { r: 3, c: 3 };
  var clockTimer = null, clockRunning = false, lastTick = 0, msgTimer = null;
  var loopApi = null;
  var lastRun = null;
  var goalEls = [], toolBtns = {}, toolCountEls = {};
  var TOOL_NAMES = {};

  TOOL_DEFS.forEach(function (t) { TOOL_NAMES[t.id] = T(t.name); });

  function bestScore() {
    try {
      var v = window.Arcade && Arcade.storage ? Arcade.storage.getBest(bestModeKey) : null;
      return v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v);
    } catch (e) { return 0; }
  }
  function audio(name) { try { if (window.Arcade && Arcade.audio) Arcade.audio.play(name); } catch (e) {} }
  function toast(msg, type) { try { if (window.Arcade && Arcade.ui) Arcade.ui.toast(msg, type || 'ok'); } catch (e) {} }
  function easeCubic(t) { t = 1 - t; return 1 - t * t * t; }
  function easeInOut(t) { return window.GK ? GK.easeInOutCubic(t) : (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); }
  function easeBack(t) { return window.GK ? GK.easeOutBack(t) : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function roundRect(x, y, w, h, r) {
    if (window.GK) { GK.roundRect(ctx, x, y, w, h, r); return; }
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function layout() {
    S = Math.floor((BOX - PAD * 2) / Math.max(cols, rows));
    OX = (BOX - S * cols) / 2;
    OY = (BOX - S * rows) / 2;
  }
  function todaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function levelName(i) { return T('gs.sheep.lvName' + (i + 1)); }
  function dotHtml(type) {
    var pal = SHEEP_PALETTE[type >= 0 ? type : 4] || SHEEP_PALETTE[0];
    return '<i class="sh-dot" style="background:' + pal.accent + ';color:' + pal.accent + '"></i>';
  }

  /* ---------- 时钟（loop 与 setInterval 双保险；后台暂停） ---------- */
  function startClock() {
    stopClock();
    lastTick = (window.performance && performance.now) ? performance.now() : Date.now();
    clockRunning = !document.hidden;
    clockTimer = setInterval(clockTick, 100);
  }
  function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    clockRunning = false;
  }
  function clearTimers() {
    stopClock();
    if (msgTimer) { clearTimeout(msgTimer); msgTimer = null; }
  }
  function clockTick() {
    if (!G || G.over || G.targetReached) return;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (!clockRunning) { lastTick = now; return; }
    var d = now - lastTick;
    lastTick = now;
    if (d < 0) d = 0;
    if (d > 1000) d = 1000;
    G.elapsed += d;
    G.remaining -= d;
    if (G.remaining <= 0) {
      G.remaining = 0;
      updateHud();
      finish(false, 'time');
      return;
    }
    updateHud();
  }
  document.addEventListener('visibilitychange', function () {
    if (!G || G.over) return;
    if (document.hidden) {
      clockRunning = false;
    } else if (!G.targetReached) {
      lastTick = (window.performance && performance.now) ? performance.now() : Date.now();
      clockRunning = true;
    }
  });

  function showMsg(text, color) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = color || '';
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(function () {
      msgTimer = null;
      if (msgEl) msgEl.textContent = '';
    }, 2300);
  }

  /* ---------- 目标面板 ---------- */
  function buildGoals() {
    goalsEl.innerHTML = '';
    goalEls = [];
    if (!G) return;
    function push(label, swatch, curFn, doneFn) {
      var el = document.createElement('span');
      el.className = 'sh-goal';
      el.innerHTML = '<em>' + (swatch || '') + label + '</em><b></b>';
      var b = el.querySelector('b');
      goalsEl.appendChild(el);
      goalEls.push({ el: el, b: b, cur: curFn, done: doneFn });
    }
    var lv = (G.mode === 'level' || G.mode === 'weekly') ? G.conf : null;
    if (lv) {
      push(T('gs.sheep.goalScore'), '', function () { return G.score + '/' + G.target; },
        function () { return G.score >= G.target; });
      if (lv.clear) {
        push(T('gs.sheep.goalClear'), '', function () { return G.cleared + '/' + lv.clear; },
          function () { return G.cleared >= lv.clear; });
      }
      (lv.colors || []).forEach(function (pair) {
        var type = pair[0], need = pair[1];
        push(T('gs.sheep.goalColor'), dotHtml(type), function () {
          return (G.collected[type] || 0) + '/' + need;
        }, function () { return (G.collected[type] || 0) >= need; });
      });
      if (lv.moves) {
        push(T('gs.sheep.goalMoves'), '', function () { return Math.max(0, G.movesLeft) + '/' + lv.moves; },
          function () { return G.movesLeft > 0; });
      }
    } else {
      push(T('gs.sheep.target'), '', function () { return G.score + '/' + G.target; },
        function () { return G.score >= G.target; });
    }
    refreshGoals();
  }
  function refreshGoals() {
    for (var i = 0; i < goalEls.length; i++) {
      var it = goalEls[i];
      if (it.b) it.b.textContent = it.cur();
      it.el.classList.toggle('done', !!it.done());
    }
  }

  /* ---------- 道具面板 ---------- */
  function updateToolUI() {
    for (var i = 0; i < TOOL_IDS.length; i++) {
      var id = TOOL_IDS[i];
      var b = toolBtns[id];
      if (!b) continue;
      var n = G && G.tools ? (G.tools[id] || 0) : 0;
      if (toolCountEls[id]) toolCountEls[id].textContent = String(n);
      b.classList.toggle('off', n <= 0 && !(G && G.toolMode === id));
      b.classList.toggle('active', !!(G && G.toolMode === id));
      var label = TOOL_NAMES[id] + ' · ' + T('gs.sheep.toolLeft') + ' ' + n;
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
    }
    if (tipEl && G) {
      if (G.toolMode === 'hammer' || G.toolMode === 'rainbow') {
        tipEl.textContent = T(G.toolMode === 'hammer' ? 'gs.sheep.toolHammerOn' : 'gs.sheep.toolRainbowOn');
      }
    }
  }
  function showToolTip(id) {
    if (!tipEl) return;
    var def = null;
    for (var i = 0; i < TOOL_DEFS.length; i++) if (TOOL_DEFS[i].id === id) def = TOOL_DEFS[i];
    var n = G && G.tools ? (G.tools[id] || 0) : 0;
    tipEl.textContent = (def ? T(def.tip) : '') + ' · ' + T('gs.sheep.toolLeft') + ' ' + n;
  }
  function resetToolTip() {
    if (tipEl) tipEl.textContent = T('gs.sheep.toolTipDefault');
  }

  function updateHud() {
    if (!G) return;
    var conf = G.conf || DIFF[G.diff];
    if (G.mode === 'level') levelEl.textContent = T('gs.sheep.lvN').replace('{n}', G.level + 1) + ' · ' + levelName(G.level);
    else if (G.mode === 'weekly') {
      var wk = G.weeklyKey || weeklyKeyNow(), parts = wk.split('-W');
      levelEl.textContent = T('gs.sheep.weeklyHud').replace('{y}', parts[0]).replace('{w}', String(parseInt(parts[1], 10)));
    }
    else levelEl.textContent = T(conf.name);
    scoreEl.textContent = T('gs.sheep.score') + ' ' + G.score;
    targetEl.textContent = T('gs.sheep.target') + ' ' + G.target;
    timeEl.textContent = T('gs.sheep.time') + ' ' + Math.ceil(Math.max(0, G.remaining) / 1000) + 's';
    timeEl.classList.toggle('sh-low', G.remaining <= 10000 && !G.over);
    if (G.movesLimit) {
      movesEl.style.display = '';
      movesEl.textContent = T('gs.sheep.movesLeft') + ' ' + Math.max(0, G.movesLeft);
    } else {
      movesEl.style.display = 'none';
    }
    chainEl.textContent = T('gs.sheep.chain') + ' x' + G.maxChain;
    hudBestEl.textContent = T('gs.sheep.best') + ' ' + (G.mode === 'weekly' ? weeklyInfo().best : bestScore());
    refreshGoals();
    updateToolUI();
  }

  /* ---------- 关卡选择 ---------- */
  function levelMiniHtml(lv) {
    var h = '<span>' + T('gs.sheep.goalScore') + ' ' + lv.target + '</span>';
    if (lv.clear) h += '<span>' + T('gs.sheep.goalClear') + ' ' + lv.clear + '</span>';
    if (lv.moves) h += '<span>' + T('gs.sheep.goalMoves') + ' ' + lv.moves + '</span>';
    if (lv.colors && lv.colors.length) {
      h += '<span class="sh-mini-colors">';
      for (var i = 0; i < lv.colors.length; i++) h += dotHtml(lv.colors[i][0]);
      h += '</span>';
    }
    return h;
  }
  function renderPicker() {
    var html = '', i;
    for (i = 0; i < LEVELS.length; i++) {
      var lv = LEVELS[i];
      var unlocked = i < profile.unlocked;
      var stars = profile.stars[i] || 0;
      var best = profile.best[i] || 0;
      var cls = 'sh-lv' + (unlocked ? '' : ' locked') + (stars > 0 ? ' done' : '');
      html += '<button type="button" class="' + cls + '" data-lv="' + i + '"' +
        (unlocked ? '' : ' disabled aria-disabled="true"') +
        ' aria-label="' + T('gs.sheep.lvN').replace('{n}', i + 1) + ' · ' + levelName(i) + '">' +
        '<div class="sh-lv-top"><span>' + (i + 1) + '</span><div class="sh-stars">' + starsHtml(stars) + '</div></div>' +
        '<div class="sh-lv-name">' + levelName(i) + '</div>' +
        '<div class="sh-lv-mini">' + levelMiniHtml(lv) + '</div>' +
        '<div class="sh-lv-best">' + (unlocked ? (best ? T('gs.sheep.bestLevel').replace('{n}', best) : T('gs.sheep.noBest')) : T('gs.sheep.locked')) + '</div>' +
        '</button>';
    }
    levelsEl.innerHTML = html;

    var diffsEl = document.getElementById('sh-diffs');
    if (diffsEl) {
      var dh = '';
      for (i = 0; i < DIFF.length; i++) {
        dh += '<button type="button" class="sh-diff" data-diff="' + i + '"><b>' + T(DIFF[i].name) + '</b><small>' + T(DIFF[i].desc) + '</small></button>';
      }
      diffsEl.innerHTML = dh;
    }
    progressEl.innerHTML = '<span>' + T('gs.sheep.totalStars') + ' <b>' + profile.starsTotal + '/' + (LEVEL_MAX * 3) + '</b></span>' +
      '<span>' + T('gs.sheep.unlocked') + ' <b>' + profile.unlocked + '/' + LEVEL_MAX + '</b></span>' +
      '<span>' + T('gs.sheep.best') + ' <b>' + bestScore() + '</b></span>';
    renderWeeklyCard();
  }

  /* ---------- 周挑战卡片 ---------- */
  function renderWeeklyCard() {
    if (!weekTagEl) return;
    var w = weeklyInfo(), c = w.conf;
    weekTagEl.textContent = T('gs.sheep.weeklyTag').replace('{y}', w.year).replace('{w}', w.week);
    weekStatusEl.textContent = w.played ? T('gs.sheep.weeklyPlayed').replace('{n}', w.tries) : T('gs.sheep.weeklyNotPlayed');
    weekStatusEl.classList.toggle('on', w.played);
    weekBestEl.innerHTML = T('gs.sheep.weeklyBest').replace('{s}', w.best > 0 ? w.best : '--');
    weekRulesEl.innerHTML = T('gs.sheep.weeklyRules')
      .replace('{cols}', c.cols).replace('{rows}', c.rows).replace('{types}', c.types)
      .replace('{time}', c.time).replace('{target}', c.target).replace('{clear}', c.clear) +
      ' · ' + T('gs.sheep.goalColor') + ' ' + dotHtml(c.colors[0][0]) + c.colors[0][1];
    if (weekGoEl) weekGoEl.textContent = T('gs.sheep.weeklyStart');
  }

  /* ---------- 成就 / 图鉴面板 ---------- */
  function codexIcon(def) {
    if (def.type !== undefined) {
      var pal = SHEEP_PALETTE[def.type] || SHEEP_PALETTE[0];
      return '<span class="sh-cx-mascot" style="color:' + pal.accent + '"><span><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" fill-rule="evenodd"><circle cx="8" cy="11.4" r="3.1"/><circle cx="12.2" cy="10.2" r="3.3"/><circle cx="16.4" cy="11.6" r="2.9"/><ellipse cx="12.4" cy="14.6" rx="6.6" ry="3.6"/><circle cx="18.8" cy="12.2" r="2.4"/><rect x="7.6" y="17.4" width="1.5" height="3.1" rx=".75"/><rect x="11.4" y="17.8" width="1.5" height="2.7" rx=".75"/><rect x="14.8" y="17.4" width="1.5" height="3.1" rx=".75"/></svg></span></span>';
    }
    if (def.icon === 'line') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M15 6l6 6-6 6"/></svg>';
    }
    for (var i = 0; i < TOOL_DEFS.length; i++) {
      if (TOOL_DEFS[i].id === def.icon) return TOOL_DEFS[i].svg;
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 17a8.4 8.4 0 0 1 16.8 0"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M10.6 17a1.4 1.4 0 0 1 2.8 0"/></svg>';
  }
  function renderPanel() {
    if (!panelKind || !panelEl) return;
    var isA = panelKind === 'achv';
    panelTitleEl.textContent = T(isA ? 'gs.sheep.achvTitle' : 'gs.sheep.codexTitle');
    var rows = isA ? achvRows() : codexRows(), html = '', n = 0, i, r, pct;
    for (i = 0; i < rows.length; i++) if (rows[i].done) n++;
    html += '<div class="sh-panel-sum">' + (isA
      ? T('gs.sheep.achvSum').replace('{n}', n).replace('{m}', rows.length)
      : T('gs.sheep.codexSum').replace('{n}', n).replace('{m}', rows.length)) + '</div>';
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (isA) {
        pct = r.need > 0 ? Math.round(Math.min(1, r.p / r.need) * 100) : 100;
        html += '<div class="sh-ach' + (r.done ? ' on' : '') + '">' +
          '<span class="sh-ach-ico">' + (r.done ? '★' : '☆') + '</span>' +
          '<div class="sh-ach-main"><div class="sh-ach-name">' + T(r.def.n) + '</div>' +
          '<div class="sh-ach-desc">' + T(r.def.d) + '</div>' +
          '<div class="sh-ach-bar"><i style="width:' + pct + '%"></i></div></div>' +
          '<span class="sh-ach-p' + (r.done ? ' on' : '') + '">' +
          (r.done ? T('gs.sheep.achvDone') : T('gs.sheep.achvProgress').replace('{n}', r.p).replace('{m}', r.need)) +
          '</span></div>';
      } else {
        html += '<div class="sh-cx' + (r.done ? ' on' : ' locked') + '">' +
          '<span class="sh-cx-ico">' + codexIcon(r.def) + '</span>' +
          '<div class="sh-cx-main"><div class="sh-cx-name">' + T(r.def.n) +
          (r.done ? '' : ' · ' + T('gs.sheep.codexLocked')) + '</div>' +
          '<div class="sh-cx-desc">' + T(r.def.d) + '</div>' +
          '<div class="sh-cx-cond">' + T('gs.sheep.codexCond').replace('{c}', T(r.def.c)) + ' · ' + r.p + '/' + r.need + '</div></div></div>';
      }
    }
    panelBodyEl.innerHTML = html;
  }
  function openPanel(kind) {
    panelKind = kind === 'codex' ? 'codex' : 'achv';
    renderPanel();
    panelEl.classList.remove('hidden');
    audio('ui');
  }
  function closePanel() {
    panelKind = null;
    if (panelEl) panelEl.classList.add('hidden');
    audio('back');
  }

  /* ---------- 开局 / 选择 ---------- */
  function beginGame(o) {
    o = o || {};
    clearTimers();
    stopLoop();
    var mode = o.mode || 'free';
    var conf, diff = 0, level = -1, weeklyKey = null;
    if (mode === 'level') {
      level = clampInt(o.level, 0, LEVEL_MAX - 1);
      conf = LEVELS[level];
      diff = level < 5 ? 0 : (level < 9 ? 1 : 2);
    } else if (mode === 'weekly') {
      conf = weeklyConf();
      diff = 2;
      weeklyKey = o.weeklyKey || weeklyKeyNow();
    } else {
      diff = clampInt(o.diff, 0, 2);
      conf = DIFF[diff];
      if (mode === 'daily') { mode = 'daily'; conf = DIFF[2]; diff = 2; }
    }
    var seed = o.seed;
    if (seed === undefined || seed === null) {
      if (mode === 'daily') seed = todaySeed();
      else if (mode === 'weekly') seed = conf.seed;
      else seed = (((Date.now() ^ ((level + 1) * 7919) ^ (diff * 104729)) >>> 0) % 2147483647);
    }
    lastRun = { mode: mode, diff: diff, level: level, seed: o.seed, weeklyKey: weeklyKey };

    cols = conf.cols; rows = conf.rows;
    layout();
    var rnd = Y_mulberry32(seed);
    grid = Y_genGrid(cols, rows, conf.types, rnd);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        grid[r][c].px = c;
        grid[r][c].py = r;
        grid[r][c].alpha = 1;
        grid[r][c].scale = 1;
        grid[r][c].clearing = false;
      }
    }

    var tools = profile.tools;
    for (var ti = 0; ti < TOOL_IDS.length; ti++) {
      var tid = TOOL_IDS[ti];
      tools[tid] = clampInt(tools[tid], 0, 3);
      var grant = conf.grant && conf.grant[tid];
      if (!grant && mode !== 'level') grant = diff === 2 ? 2 : 1;
      if (grant) tools[tid] = Math.min(3, Math.max(tools[tid], grant));
    }

    var collected = {};
    (conf.colors || []).forEach(function (pair) { collected[pair[0]] = 0; });

    G = {
      mode: mode, level: level, diff: diff, conf: conf, cols: cols, rows: rows, types: conf.types,
      rnd: rnd, target: conf.target, timeLimit: conf.time * 1000,
      score: 0, chain: 0, maxChain: 0, elapsed: 0, remaining: conf.time * 1000,
      movesLimit: conf.moves || 0, movesLeft: conf.moves || 0,
      cleared: 0, collected: collected, tools: tools,
      colorClears: {}, specLine: 0, specRainbow: 0, toolsUsed: false, weeklyKey: weeklyKey,
      toolMode: null, chainAwarded: false, scoreNode: false, scoreDone: false,
      targetReached: false, over: false, win: false, submitted: false,
      particles: [], floats: [], rings: [], grass: [], swap: null, clear: null, fall: null,
      shake: 0, goalFlash: 0, shuffleSpin: 0
    };
    var grnd = Y_mulberry32(seed || (Date.now() % 2147483647));
    for (var gi = 0; gi < 46; gi++) {
      G.grass.push({
        x: OX + 10 + grnd() * Math.max(1, S * cols - 20),
        y: OY + 10 + grnd() * Math.max(1, S * rows - 20),
        len: 3 + grnd() * 6,
        a: grnd() * Math.PI,
        tone: grnd() > 0.6 ? 'rgba(190,255,190,0.20)' : 'rgba(90,190,120,0.16)'
      });
    }
    selected = null;
    phase = 'idle';
    cursor = { r: Math.floor(rows / 2), c: Math.floor(cols / 2) };
    pickEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    overlayEl.classList.add('hidden');
    newRecEl.classList.add('hidden');
    buildGoals();
    resetToolTip();
    updateHud();
    updateToolUI();
    showMsg(T(mode === 'level' || mode === 'weekly' ? 'gs.sheep.hintLevel' : 'gs.sheep.hint'), '');
    if (!Y_findMove(grid)) autoShuffle(true);
    startClock();
    loopApi = Arcade.loop.start(tick, draw, 16);
    draw();
    audio('ui');
    saveNow();
  }

  function openPicker() {
    clearTimers();
    stopLoop();
    G = null;
    phase = 'idle';
    selected = null;
    overlayEl.classList.add('hidden');
    gameEl.classList.add('hidden');
    pickEl.classList.remove('hidden');
    renderPicker();
    audio('back');
  }

  function stopLoop() {
    if (loopApi) {
      try { loopApi.stop(); } catch (e) {}
      loopApi = null;
    }
  }

  /* ---------- 交换 / 结算 ---------- */
  function attemptSwap(r1, c1, r2, c2) {
    if (!G || G.over || phase !== 'idle' || G.toolMode) return;
    if (G.movesLimit && G.movesLeft <= 0) return;
    if (!Y_inGrid(grid, r1, c1) || !Y_inGrid(grid, r2, c2)) return;
    var dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
    if (dr + dc !== 1) return;
    var a = grid[r1][c1], b = grid[r2][c2];
    if (!a || !b) return;
    selected = null;
    cursor = { r: r2, c: c2 };
    G.swap = { a: a, b: b, r1: r1, c1: c1, r2: r2, c2: c2, t: 0, dur: 170, back: false };
    phase = 'swap';
    audio('move');
  }

  function updateSwap(dt) {
    var sw = G.swap;
    if (!sw) { phase = 'idle'; return; }
    sw.t += dt;
    var p = Math.min(1, sw.t / sw.dur);
    var e = easeInOut(p);
    if (!sw.back) {
      sw.a.px = lerp(sw.c1, sw.c2, e); sw.a.py = lerp(sw.r1, sw.r2, e);
      sw.b.px = lerp(sw.c2, sw.c1, e); sw.b.py = lerp(sw.r2, sw.r1, e);
    } else {
      sw.a.px = lerp(sw.c2, sw.c1, e); sw.a.py = lerp(sw.r2, sw.r1, e);
      sw.b.px = lerp(sw.c1, sw.c2, e); sw.b.py = lerp(sw.r1, sw.r2, e);
    }
    if (p < 1) return;

    if (!sw.back) {
      grid[sw.r1][sw.c1] = sw.b;
      grid[sw.r2][sw.c2] = sw.a;
      sw.a.px = sw.c2; sw.a.py = sw.r2;
      sw.b.px = sw.c1; sw.b.py = sw.r1;
      var ra = sw.a.special === 'rainbow', rb = sw.b.special === 'rainbow';
      if (ra || rb) {
        activateRainbow(sw.a, sw.b, sw.r1, sw.c1, sw.r2, sw.c2);
        G.swap = null;
        return;
      }
      var runs = Y_findMatches(grid);
      if (runs.length) {
        G.chain = 1;
        if (G.movesLimit) G.movesLeft = Math.max(0, G.movesLeft - 1);
        G.swap = null;
        updateHud();
        startResolve(runs, { r: sw.r2, c: sw.c2 });
      } else {
        sw.back = true; sw.t = 0; sw.dur = 150;
        phase = 'swapback';
        showMsg(T('gs.sheep.noMatch'), 'var(--neon-pink)');
      }
    } else {
      grid[sw.r1][sw.c1] = sw.a;
      grid[sw.r2][sw.c2] = sw.b;
      sw.a.px = sw.c1; sw.a.py = sw.r1;
      sw.b.px = sw.c2; sw.b.py = sw.r2;
      G.swap = null;
      G.chain = 0;
      phase = 'idle';
      audio('back');
    }
  }

  function activateRainbow(a, b, r1, c1, r2, c2) {
    var clear = {};
    var rainbowCell, targetType;
    if (a.special === 'rainbow') { rainbowCell = { r: r2, c: c2 }; targetType = b.type; }
    else { rainbowCell = { r: r1, c: c1 }; targetType = a.type; }
    if (a.special === 'rainbow' && b.special === 'rainbow') targetType = -2;
    clear[rainbowCell.r + ',' + rainbowCell.c] = 1;
    if (targetType < 0) {
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) if (grid[r][c]) clear[r + ',' + c] = 1;
    } else {
      for (var r2b = 0; r2b < rows; r2b++) for (var c2b = 0; c2b < cols; c2b++) {
        if (grid[r2b][c2b] && grid[r2b][c2b].type === targetType) clear[r2b + ',' + c2b] = 1;
      }
    }
    Y_expand(grid, clear);
    var cells = [];
    for (var k in clear) {
      var p = k.split(',');
      cells.push({ r: parseInt(p[0], 10), c: parseInt(p[1], 10) });
    }
    showMsg(T('gs.sheep.specialRainbow'), 'var(--neon-purple)');
    if (Arcade.fx) { try { Arcade.fx.flash('var(--neon-purple)'); } catch (e) {} }
    if (G.movesLimit) G.movesLeft = Math.max(0, G.movesLeft - 1);
    startClear(cells, [], { chain: 1, rainbow: true });
  }

  function startResolve(runs, swapCell) {
    var plan = Y_plan(grid, runs, swapCell);
    if (!plan.cells.length) { phase = 'idle'; G.chain = 0; return; }
    if (plan.specials.length) {
      var hasRainbow = plan.specials.some(function (s) { return s.special === 'rainbow'; });
      showMsg(T(hasRainbow ? 'gs.sheep.specialRainbow' : 'gs.sheep.specialLine'), hasRainbow ? 'var(--neon-purple)' : 'var(--neon-yellow)');
    }
    startClear(plan.cells, plan.specials, { chain: G.chain || 1, triggered: plan.triggered });
  }

  function startClear(cells, specials, opts) {
    if (!G || G.over) return;
    opts = opts || {};
    var chain = Math.max(1, opts.chain || 1);
    var gain = cells.length * 10 * chain + specials.length * 40 + (opts.rainbow ? 120 : 0) + (opts.triggered ? opts.triggered * 30 : 0);
    G.score += gain;
    G.maxChain = Math.max(G.maxChain, chain);
    var ax = 0, ay = 0, n = 0, i, t;
    for (i = 0; i < cells.length; i++) {
      t = grid[cells[i].r] && grid[cells[i].r][cells[i].c];
      if (!t) continue;
      G.cleared++;
      if (t.type >= 0) {
        G.collected[t.type] = (G.collected[t.type] || 0) + 1;
        G.colorClears[t.type] = (G.colorClears[t.type] || 0) + 1;
      }
      ax += OX + (cells[i].c + 0.5) * S;
      ay += OY + (cells[i].r + 0.5) * S;
      n++;
      t.clearing = true;
      addBurst(OX + (cells[i].c + 0.5) * S, OY + (cells[i].r + 0.5) * S, SHEEP_PALETTE[t.type >= 0 ? t.type : 4], 6);
    }
    if (n) {
      ax /= n; ay /= n;
      addFloat(ax, ay, '+' + gain, '#ffe600');
      if (chain >= 2) addFloat(ax, ay - S * 0.52, T('gs.sheep.chainToast').replace('{n}', chain), '#39ff14');
    }
    for (i = 0; i < specials.length; i++) {
      var sp = specials[i];
      var st = grid[sp.r] && grid[sp.r][sp.c];
      if (sp.special === 'rainbow') G.specRainbow++;
      else G.specLine++;
      if (st) {
        st.special = sp.special;
        if (sp.special === 'rainbow') st.type = -1;
        st.pop = 1;
      }
    }
    if (opts.rainbow) G.specRainbow++;
    G.clear = { t: 0, dur: 240, cells: cells, specials: specials };
    phase = 'clear';
    if (opts.rainbow || specials.length || opts.triggered) audio('merge');
    else if (chain >= 2) audio('clear');
    else audio('match');
    if (opts.rainbow || specials.length) G.shake = 7;
    updateHud();
    if (objectivesMet() && !G.targetReached) {
      G.targetReached = true;
      stopClock();
      showMsg(T('gs.sheep.targetReached'), 'var(--neon-green)');
      toast(T('gs.sheep.targetReached'), 'win');
      audio('record');
    }
  }

  function updateClear(dt) {
    var cl = G.clear;
    if (!cl) { phase = 'idle'; return; }
    cl.t += dt;
    if (cl.t < cl.dur) return;
    for (var i = 0; i < cl.cells.length; i++) {
      var cell = cl.cells[i];
      var t = grid[cell.r] && grid[cell.r][cell.c];
      if (t && t.clearing) grid[cell.r][cell.c] = null;
    }
    G.clear = null;
    var drop = Y_drop(grid, G.types, G.rnd);
    G.fall = { t: 0, dur: 220 + Math.min(5, drop.maxDist) * 40, moves: drop.moves, spawns: drop.spawns };
    phase = 'fall';
    if (drop.moves.length || drop.spawns.length) audio('drop');
  }

  function updateFall(dt) {
    var f = G.fall;
    if (!f) { phase = 'idle'; return; }
    f.t += dt;
    var p = Math.min(1, f.t / f.dur);
    var e = easeCubic(p);
    var i, m;
    for (i = 0; i < f.moves.length; i++) {
      m = f.moves[i];
      m.tile.px = m.c; m.tile.py = lerp(m.fromR, m.toR, e); m.tile.alpha = 1;
    }
    for (i = 0; i < f.spawns.length; i++) {
      m = f.spawns[i];
      m.tile.px = m.c; m.tile.py = lerp(m.fromR, m.toR, e);
      m.tile.alpha = Math.min(1, p * 1.8);
      m.tile.scale = 0.72 + 0.28 * easeBack(Math.min(1, p * 1.15));
    }
    if (p < 1) return;
    for (i = 0; i < f.moves.length; i++) {
      m = f.moves[i]; m.tile.px = m.c; m.tile.py = m.toR; m.tile.alpha = 1; m.tile.scale = 1;
    }
    for (i = 0; i < f.spawns.length; i++) {
      m = f.spawns[i]; m.tile.px = m.c; m.tile.py = m.toR; m.tile.alpha = 1; m.tile.scale = 1; m.tile.spawn = false;
    }
    G.fall = null;
    afterFall();
  }

  function objectivesMet() {
    if (!G) return false;
    if (G.score < G.target) return false;
    var lv = (G.mode === 'level' || G.mode === 'weekly') ? G.conf : null;
    if (!lv) return true;
    if (lv.clear && G.cleared < lv.clear) return false;
    if (lv.colors) {
      for (var i = 0; i < lv.colors.length; i++) {
        if ((G.collected[lv.colors[i][0]] || 0) < lv.colors[i][1]) return false;
      }
    }
    return true;
  }

  function afterFall() {
    if (!G || G.over) return;
    var runs = Y_findMatches(grid);
    if (runs.length) {
      G.chain = Math.max(1, G.chain) + 1;
      startResolve(runs, null);
      return;
    }
    if (objectivesMet()) { finish(true); return; }
    if (G.movesLimit && G.movesLeft <= 0) { finish(false, 'moves'); return; }
    G.chain = 0;
    if (!Y_findMove(grid)) { autoShuffle(); return; }
    phase = 'idle';
    updateHud();
  }

  function autoShuffle(manual) {
    var normal = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var t = grid[r][c];
      if (t && t.type >= 0 && !t.special) normal.push(t);
    }
    var ok = false, tries = 0;
    while (!ok && tries++ < 40 && normal.length) {
      var types = normal.map(function (t) { return t.type; });
      Y_shuffle(types, G.rnd);
      for (var i = 0; i < normal.length; i++) normal[i].type = types[i];
      if (Y_findMatches(grid).length === 0 && Y_findMove(grid)) ok = true;
    }
    if (!ok) {
      var fresh = Y_genGrid(cols, rows, G.types, G.rnd);
      for (var r2 = 0; r2 < rows; r2++) for (var c2 = 0; c2 < cols; c2++) {
        if (grid[r2][c2] && !grid[r2][c2].special) grid[r2][c2].type = fresh[r2][c2].type;
      }
    }
    showMsg(T(manual ? 'gs.sheep.toolShuffleUsed' : 'gs.sheep.autoShuffle'), 'var(--neon-yellow)');
    audio('merge');
    G.shake = manual ? 7 : 4;
    G.shuffleSpin = manual ? 1 : 0;
    G.chain = 0;
    phase = 'idle';
    updateHud();
  }

  function finish(win, reason) {
    if (!G || G.over) return;
    G.over = true; G.win = !!win; phase = 'over'; selected = null; G.toolMode = null;
    clearTimers();
    stopLoop();
    var isNew = false, weeklyRes = null;
    if (!G.submitted) {
      G.submitted = true;
      try {
        if (G.mode === 'weekly') {
          weeklyRes = recordWeekly(G.score);
          isNew = !!(weeklyRes && weeklyRes.isNew);
        } else if (window.Arcade && Arcade.shell && Arcade.shell.submitScore) isNew = !!Arcade.shell.submitScore(G.score);
        else if (window.Arcade && Arcade.storage && Arcade.storage.submitBest) isNew = !!Arcade.storage.submitBest(bestModeKey, G.score, 'max');
      } catch (e) {}
    }
    var lv = G.mode === 'level' ? LEVELS[G.level] : null;
    var stars = 0;
    if (win) {
      if (lv) {
        var ratio = G.timeLimit ? G.remaining / G.timeLimit : 1;
        stars = 1;
        if (ratio >= 0.25) stars = 2;
        if (ratio >= 0.4 && G.maxChain >= 3) stars = 3;
        var i = G.level;
        profile.stars[i] = Math.max(profile.stars[i] || 0, stars);
        profile.best[i] = Math.max(profile.best[i] || 0, G.score);
        profile.unlocked = Math.min(LEVEL_MAX, Math.max(profile.unlocked, i + 2));
        profile.starsTotal = 0;
        for (var k = 0; k < LEVEL_MAX; k++) profile.starsTotal += profile.stars[k] || 0;
      }
      if (window.Arcade && Arcade.juice) Arcade.juice.win();
      else audio('win');
      if (G.mode === 'daily' && window.Arcade && Arcade.daily) {
        try { Arcade.daily.markSolved('sheep', Math.round(G.elapsed / 1000)); } catch (e) {}
      }
    } else {
      if (window.Arcade && Arcade.juice) Arcade.juice.lose();
      else audio('lose');
      if (Arcade.fx) { try { Arcade.fx.flash('var(--neon-pink)'); } catch (e) {} }
    }
    recordRunStats(win);
    var used = Math.max(0, Math.round(G.elapsed / 1000));
    ovTitle.textContent = win
      ? (G.mode === 'weekly' ? T('gs.sheep.weeklyWinT') : T('gs.sheep.winT'))
      : T('gs.sheep.loseT');
    ovTitle.className = win ? 'win' : '';
    var msg = (win ? T('gs.sheep.winD2') : T(reason === 'moves' ? 'gs.sheep.loseMoves' : 'gs.sheep.loseD2'))
      .replace('{s}', G.score).replace('{t}', G.target).replace('{time}', used).replace('{chain}', G.maxChain);
    ovText.innerHTML = msg;
    ovStars.innerHTML = lv ? starsHtml(stars, 'sh-stars-big') : '';
    ovStars.style.display = lv ? '' : 'none';
    ovGoals.innerHTML = goalsEl.innerHTML;
    finalScoreEl.textContent = String(G.score);
    finalChainEl.textContent = 'x' + G.maxChain;
    finalBestEl.textContent = String(lv ? Math.max(profile.best[G.level] || 0, G.score) : (G.mode === 'weekly' ? weeklyInfo().best : bestScore()));
    newRecEl.classList.toggle('hidden', !isNew);
    renderFinishButtons(win, lv, stars);
    overlayEl.classList.remove('hidden');
    updateHud();
    saveNow();
    renderPicker();
    draw();
  }

  function renderFinishButtons(win, lv, stars) {
    ovBtns.innerHTML = '';
    function add(label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + cls;
      b.textContent = label;
      b.addEventListener('click', fn);
      ovBtns.appendChild(b);
    }
    if (lv) {
      if (win && G.level + 1 < LEVEL_MAX) {
        add(T('gs.sheep.nextLevel'), 'green', function () { beginGame({ mode: 'level', level: G.level + 1 }); });
      }
      add(T(win ? 'gs.sheep.replay' : 'gs.sheep.retry'), win ? 'cyan' : 'green', function () { beginGame({ mode: 'level', level: G.level }); });
      add(T('gs.sheep.change'), 'purple', openPicker);
    } else if (G.mode === 'weekly') {
      add(T('gs.sheep.weeklyAgain'), 'green', function () { beginGame(lastRun || { mode: 'weekly', seed: weeklyConf().seed }); });
      add(T('gs.sheep.change'), 'purple', openPicker);
    } else {
      add(T('gs.sheep.again'), 'green', function () { beginGame(lastRun || { mode: 'free', diff: 0 }); });
      add(T('gs.sheep.change'), 'purple', openPicker);
    }
  }

  /* ---------- 道具 ---------- */
  function useTool(id) {
    if (!G || G.over || phase !== 'idle' || !canInput()) return;
    var n = G.tools[id] || 0;
    if (n <= 0) {
      toast(T('gs.sheep.noTool'), 'warn');
      audio('error');
      return;
    }
    if (id === 'hammer' || id === 'rainbow') {
      G.toolMode = G.toolMode === id ? null : id;
      updateToolUI(); resetToolTip();
      if (G.toolMode) showToolTip(id);
      audio('select');
      return;
    }
    if (id === 'shuffle') {
      G.tools[id] = Math.max(0, n - 1);
      noteToolUse(id);
      toolModeReset();
      autoShuffle(true);
      updateToolUI(); saveNow();
      addFloat(OX + S * cols / 2, OY + S * rows / 2, T('gs.sheep.toolShuffleToast'), '#00f0ff');
      audio('merge');
      return;
    }
    if (id === 'time') {
      G.tools[id] = Math.max(0, n - 1);
      noteToolUse(id);
      toolModeReset();
      G.remaining = Math.min(G.timeLimit + 30000, G.remaining + 10000);
      addFloat(OX + S * cols / 2, OY + S * rows / 2, '+10s', '#39ff14');
      if (Arcade.fx) { try { Arcade.fx.flash('var(--neon-green)'); } catch (e) {} }
      updateHud(); updateToolUI(); saveNow();
      audio('coin');
    }
  }
  function toolModeReset() { if (G) G.toolMode = null; updateToolUI(); resetToolTip(); }
  function applyToolAt(r, c) {
    if (!G || G.over || !G.toolMode) return false;
    var t = grid[r] && grid[r][c];
    if (!t) return false;
    var id = G.toolMode;
    if ((G.tools[id] || 0) <= 0) { toolModeReset(); return false; }
    G.tools[id] = Math.max(0, (G.tools[id] || 0) - 1);
    G.toolMode = null;
    noteToolUse(id);
    if (id === 'hammer') {
      addBurst(OX + (c + 0.5) * S, OY + (r + 0.5) * S, SHEEP_PALETTE[t.type >= 0 ? t.type : 4], 12);
      G.shake = 6;
      startClear([{ r: r, c: c }], [], { chain: 1 });
      showMsg(T('gs.sheep.toolHammerUsed'), 'var(--neon-yellow)');
      if (Arcade.fx) { try { Arcade.fx.flash('var(--neon-yellow)'); } catch (e) {} }
      audio('match');
    } else if (id === 'rainbow') {
      t.special = 'rainbow'; t.type = -1; t.pop = 1;
      G.specRainbow++;
      addBurst(OX + (c + 0.5) * S, OY + (r + 0.5) * S, SHEEP_PALETTE[4], 12);
      G.shake = 5;
      showMsg(T('gs.sheep.toolRainbowUsed'), 'var(--neon-purple)');
      audio('merge');
    }
    updateToolUI(); resetToolTip(); updateHud(); saveNow();
    return true;
  }

  /* ---------- 特效 ---------- */
  function addBurst(x, y, pal, count) {
    if (!G) return;
    for (var i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 0.8 + Math.random() * 2.8;
      G.particles.push({
        x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.8,
        life: 1, size: 1.6 + Math.random() * 2.4,
        color: Math.random() > 0.5 ? pal.accent : pal.wool
      });
    }
    if (G.particles.length > 220) G.particles.splice(0, G.particles.length - 220);
  }
  function addFloat(x, y, text, color) {
    if (!G) return;
    G.floats.push({ x: x, y: y, text: text, color: color, life: 1 });
    if (G.floats.length > 16) G.floats.shift();
  }
  function updateParticles(dt) {
    var f = dt / 16;
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      p.x += p.vx * f; p.y += p.vy * f; p.vy += 0.09 * f;
      p.vx *= 0.985; p.life -= 0.022 * f;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    for (var j = G.floats.length - 1; j >= 0; j--) {
      var fl = G.floats[j];
      fl.y -= 0.55 * f; fl.life -= 0.018 * f;
      if (fl.life <= 0) G.floats.splice(j, 1);
    }
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    if (!G) return;
    var sx = 0, sy = 0;
    if (G.shake > 0) { sx = (Math.random() - 0.5) * G.shake; sy = (Math.random() - 0.5) * G.shake; }
    ctx.save();
    ctx.translate(sx, sy);
    drawBoard();
    ctx.save();
    roundRect(OX - 7, OY - 7, S * cols + 14, S * rows + 14, 15);
    ctx.clip();
    drawTiles();
    drawParticles();
    drawFloats();
    ctx.restore();
    drawRings();
    ctx.restore();
  }

  function drawBoard() {
    var bg = ctx.createLinearGradient(0, 0, 0, BOX);
    bg.addColorStop(0, '#0a1710'); bg.addColorStop(0.45, '#12301f'); bg.addColorStop(1, '#06100a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, BOX, BOX);
    var glow = ctx.createRadialGradient(BOX / 2, BOX * 0.18, 8, BOX / 2, BOX * 0.3, BOX * 0.8);
    glow.addColorStop(0, 'rgba(120,255,170,0.14)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, BOX, BOX);

    var bw = S * cols, bh = S * rows;
    roundRect(OX - 8, OY - 8, bw + 16, bh + 16, 15);
    var bgb = ctx.createLinearGradient(OX, OY, OX, OY + bh);
    bgb.addColorStop(0, '#2f6b43'); bgb.addColorStop(0.35, '#245437'); bgb.addColorStop(1, '#12301f');
    ctx.fillStyle = bgb;
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = 'rgba(140,255,175,0.34)';
    ctx.lineWidth = 1.2;
    roundRect(OX - 8, OY - 8, bw + 16, bh + 16, 15);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 4;
    roundRect(OX - 3, OY - 3, bw + 6, bh + 6, 12);
    ctx.stroke();
    ctx.restore();

    var i;
    for (i = 0; i < G.grass.length; i++) {
      var mk = G.grass[i];
      ctx.save();
      ctx.translate(mk.x, mk.y);
      ctx.rotate(mk.a);
      ctx.strokeStyle = mk.tone;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -mk.len);
      ctx.moveTo(0, 0); ctx.lineTo(3, -mk.len * 0.7);
      ctx.stroke();
      ctx.restore();
    }

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = OX + c * S, y = OY + r * S;
        roundRect(x + 2, y + 2, S - 4, S - 4, Math.max(5, S * 0.18));
        ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.11)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.13)';
        ctx.lineWidth = 1;
        ctx.stroke();
        var n = (r * cols + c) % 5;
        ctx.strokeStyle = 'rgba(170,255,190,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 7 + n, y + S - 7);
        ctx.lineTo(x + 5 + n, y + S - 12 - (n % 3) * 2);
        ctx.moveTo(x + 7 + n, y + S - 7);
        ctx.lineTo(x + 10 + n, y + S - 11);
        ctx.stroke();
      }
    }
    drawDecor();
  }

  function drawDecor() {
    var bx = OX + S * cols - 6, by = OY + S * rows - 6;
    drawBush(bx, by, Math.max(5, S * 0.16));
    drawBush(OX + 4, OY + S * rows - 3, Math.max(4, S * 0.12));
    drawBell(OX + S * cols * 0.5, OY - 3, Math.max(4, S * 0.13));
  }
  function drawBush(x, y, r) {
    ctx.save();
    var g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.2, x, y, r * 1.8);
    g.addColorStop(0, '#7fe3a0'); g.addColorStop(0.5, '#3f9b63'); g.addColorStop(1, '#1c5134');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(10,40,24,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x - r * 0.8, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y + r * 0.2, r * 0.7, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawBell(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = '#6d4b00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, r * 0.35);
    ctx.quadraticCurveTo(-r * 0.8, -r * 0.35, 0, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.35, r * 0.72, r * 0.35);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.24, -r * 0.28, r * 0.14, r * 0.24, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6d4b00';
    ctx.beginPath(); ctx.arc(0, r * 0.5, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTiles() {
    var order = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) if (grid[r][c]) order.push(grid[r][c]);
    order.sort(function (a, b) { return a.py - b.py; });
    for (var i = 0; i < order.length; i++) drawTile(order[i]);
  }

  function drawTile(t) {
    var x = OX + (t.px + 0.5) * S;
    var y = OY + (t.py + 0.5) * S;
    var sc = t.scale || 1;
    var alpha = t.alpha === undefined ? 1 : t.alpha;
    var flash = 0;
    if (t.clearing && G.clear) {
      var p = Math.min(1, G.clear.t / G.clear.dur);
      sc *= 1 - 0.35 * p;
      alpha *= 1 - p;
      flash = p * 0.85;
    }
    if (t.pop > 0) { sc *= 1 + 0.22 * t.pop; t.pop = Math.max(0, t.pop - 0.035); }
    var isSel = selected && selected.r === Math.round(t.py) && selected.c === Math.round(t.px);
    if (isSel && phase === 'idle') sc *= 1 + 0.05 * Math.sin(Date.now() / 180);
    drawSheep(x, y, S * 0.44, t, { scale: sc, alpha: alpha, flash: flash });
  }

  function drawSheep(cx, cy, size, tile, opts) {
    var pal = SHEEP_PALETTE[tile.type >= 0 ? tile.type : 4] || SHEEP_PALETTE[0];
    var r = size;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
    ctx.scale(opts.scale || 1, opts.scale || 1);

    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.82, r * 0.78, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();

    var wg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.12, 0, 0, r * 1.02);
    wg.addColorStop(0, '#ffffff'); wg.addColorStop(0.4, pal.wool); wg.addColorStop(1, pal.woolDark);
    ctx.fillStyle = wg;
    var puffs = [
      [0, -0.18, 0.62], [-0.42, -0.14, 0.42], [0.42, -0.14, 0.42],
      [-0.33, 0.2, 0.4], [0.33, 0.2, 0.4], [0, 0.36, 0.38],
      [-0.54, 0.1, 0.28], [0.54, 0.1, 0.28]
    ];
    ctx.beginPath();
    for (var i = 0; i < puffs.length; i++) {
      var p = puffs[i];
      ctx.moveTo(p[0] * r + p[2] * r, p[1] * r);
      ctx.arc(p[0] * r, p[1] * r, p[2] * r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,34,48,0.18)';
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = pal.faceDark;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.translate(-r * 0.6, -r * 0.02);
    ctx.rotate(-0.55);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(r * 0.6, -r * 0.02);
    ctx.rotate(0.55);
    ctx.fillStyle = pal.faceDark;
    ctx.strokeStyle = pal.line;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    var fg = ctx.createRadialGradient(-r * 0.15, r * 0.02, r * 0.1, 0, r * 0.2, r * 0.65);
    fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.55, pal.face); fg.addColorStop(1, pal.faceDark);
    ctx.fillStyle = fg;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = Math.max(1, r * 0.055);
    ctx.beginPath(); ctx.ellipse(0, r * 0.18, r * 0.5, r * 0.43, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    drawHorns(r, pal);
    drawFace(r, tile.expr || 0, pal);

    ctx.fillStyle = '#ffcf4a';
    ctx.strokeStyle = '#6d4b00';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, r * 0.5);
    ctx.quadraticCurveTo(-r * 0.14, r * 0.68, 0, r * 0.7);
    ctx.quadraticCurveTo(r * 0.14, r * 0.68, r * 0.12, r * 0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(-r * 0.05, r * 0.58, r * 0.04, r * 0.07, -0.3, 0, Math.PI * 2); ctx.fill();

    if (tile.special) drawSpecial(r, tile.special);

    if (opts.flash > 0) {
      ctx.globalAlpha = opts.flash;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHorns(r, pal) {
    ctx.save();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = Math.max(1.4, r * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-r * 0.36, -r * 0.46, r * 0.2, Math.PI * 0.15, Math.PI * 1.0); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.36, -r * 0.46, r * 0.2, Math.PI * 1.0, Math.PI * 1.85); ctx.stroke();
    ctx.restore();
  }

  function drawFace(r, expr) {
    var pal = SHEEP_PALETTE[0];
    var ex = r * 0.18, ey = r * 0.08;
    ctx.fillStyle = '#1d2028';
    ctx.strokeStyle = '#1d2028';
    ctx.lineWidth = Math.max(1, r * 0.055);
    var i;
    if (expr === 0) {
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.arc(i * ex, ey + r * 0.03, r * 0.085, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      }
    } else if (expr === 1) {
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.arc(i * ex, ey, r * 0.085, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(i * ex - r * 0.025, ey - r * 0.03, r * 0.03, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1d2028';
      }
    } else if (expr === 2) {
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.moveTo(i * ex - r * 0.07, ey); ctx.lineTo(i * ex + r * 0.07, ey); ctx.stroke();
      }
    } else {
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.arc(i * ex, ey, r * 0.1, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(i * ex - r * 0.03, ey - r * 0.03, r * 0.026, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1d2028';
      }
    }
    ctx.fillStyle = '#ff8fb0';
    ctx.beginPath(); ctx.ellipse(0, r * 0.28, r * 0.075, r * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1d2028';
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.beginPath(); ctx.arc(-r * 0.06, r * 0.34, r * 0.09, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.06, r * 0.34, r * 0.09, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,150,0.22)';
    ctx.beginPath(); ctx.arc(-r * 0.32, r * 0.26, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.32, r * 0.26, r * 0.13, 0, Math.PI * 2); ctx.fill();
    void pal;
  }

  function drawSpecial(r, kind) {
    if (kind === 'row' || kind === 'col') {
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = kind === 'row' ? '#ffe600' : '#00f0ff';
      for (var i = -1; i <= 1; i++) {
        if (kind === 'row') ctx.fillRect(-r * 1.02, i * r * 0.2 - r * 0.045, r * 2.04, r * 0.09);
        else ctx.fillRect(i * r * 0.2 - r * 0.045, -r * 1.02, r * 0.09, r * 2.04);
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = kind === 'row' ? '#ffe600' : '#00f0ff';
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (kind === 'rainbow') {
      var rot = Date.now() / 460;
      var colors = ['#ff4fa3', '#ffb800', '#39ff14', '#00f0ff', '#9b6bff', '#ff6b6b'];
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 9;
      ctx.lineWidth = Math.max(1.6, r * 0.13);
      for (var c = 0; c < 6; c++) {
        ctx.strokeStyle = colors[c];
        ctx.beginPath(); ctx.arc(0, 0, r * 0.96, rot + c * Math.PI / 3, rot + (c + 1) * Math.PI / 3); ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      var s = r * 0.17;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.7); ctx.lineTo(s * 0.5, -s * 0.5); ctx.lineTo(s * 1.7, 0);
      ctx.lineTo(s * 0.5, s * 0.5); ctx.lineTo(0, s * 1.7); ctx.lineTo(-s * 0.5, s * 0.5);
      ctx.lineTo(-s * 1.7, 0); ctx.lineTo(-s * 0.5, -s * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawRings() {
    if (selected) {
      var sx = OX + (selected.c + 0.5) * S, sy = OY + (selected.r + 0.5) * S;
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffe600';
      roundRect(sx - S * 0.47, sy - S * 0.47, S * 0.94, S * 0.94, 10);
      ctx.fill();
      ctx.restore();
      ring(sx, sy, S * 0.46, '#ffe600', 2.6, 0);
    }
    if (cursor) {
      var cx = OX + (cursor.c + 0.5) * S, cy = OY + (cursor.r + 0.5) * S;
      ring(cx, cy, S * 0.45, 'rgba(0,240,255,0.9)', 1.6, 1);
    }
  }
  function ring(x, y, r, color, width, dashOffset) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashOffset) {
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -((Date.now() / 70 + dashOffset * 20) % 11);
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    for (var i = 0; i < G.floats.length; i++) {
      var f = G.floats[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = 'bold 12px "Press Start 2P", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function tick() {
    if (!G || G.over) return;
    updateParticles(16);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - 0.6);
    if (phase === 'swap' || phase === 'swapback') updateSwap(16);
    else if (phase === 'clear') updateClear(16);
    else if (phase === 'fall') updateFall(16);
  }

  /* ---------- 输入 ---------- */
  function cellFromEvent(ev) {
    if (!canvas) return null;
    var p;
    try {
      p = window.GK ? GK.pointer(canvas, ev) : (function () {
        var rc = canvas.getBoundingClientRect();
        var t = (ev.changedTouches && ev.changedTouches[0]) || ev;
        return { x: (t.clientX - rc.left) * (BOX / rc.width), y: (t.clientY - rc.top) * (BOX / rc.height) };
      })();
    } catch (e) { return null; }
    var c = Math.floor((p.x - OX) / S), r = Math.floor((p.y - OY) / S);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
    return { r: r, c: c, x: p.x, y: p.y };
  }
  function canInput() {
    return !!(G && !G.over && gameEl && !gameEl.classList.contains('hidden') && overlayEl && overlayEl.classList.contains('hidden'));
  }
  function clickCell(r, c) {
    if (!canInput()) return;
    if (G.toolMode) { applyToolAt(r, c); return; }
    if (phase !== 'idle') return;
    if (!selected) {
      selected = { r: r, c: c }; cursor = { r: r, c: c }; audio('ui'); return;
    }
    if (selected.r === r && selected.c === c) { selected = null; audio('back'); return; }
    if (Math.abs(selected.r - r) + Math.abs(selected.c - c) === 1) attemptSwap(selected.r, selected.c, r, c);
    else { selected = { r: r, c: c }; cursor = { r: r, c: c }; audio('ui'); }
  }

  var press = null;
  canvas.addEventListener('pointerdown', function (ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    if (!canInput()) return;
    var cell = cellFromEvent(ev);
    if (!cell) return;
    press = { r: cell.r, c: cell.c, x: cell.x, y: cell.y, id: ev.pointerId };
    try { ev.preventDefault(); } catch (e) {}
  });
  canvas.addEventListener('pointermove', function (ev) {
    if (!press || press.id !== ev.pointerId) return;
    try { ev.preventDefault(); } catch (e) {}
  });
  canvas.addEventListener('pointerup', function (ev) {
    if (!press || press.id !== ev.pointerId) { press = null; return; }
    var p = press; press = null;
    if (!canInput()) return;
    if (G.toolMode) { applyToolAt(p.r, p.c); return; }
    var up = cellFromEvent(ev);
    var px = up ? up.x : p.x, py = up ? up.y : p.y;
    var dx = px - p.x, dy = py - p.y;
    var th = Math.max(14, S * 0.34);
    if (Math.abs(dx) > th || Math.abs(dy) > th) {
      if (phase !== 'idle') return;
      var r2 = p.r, c2 = p.c;
      if (Math.abs(dx) > Math.abs(dy)) c2 += dx > 0 ? 1 : -1;
      else r2 += dy > 0 ? 1 : -1;
      if (r2 >= 0 && c2 >= 0 && r2 < rows && c2 < cols) attemptSwap(p.r, p.c, r2, c2);
      return;
    }
    clickCell(p.r, p.c);
  });
  canvas.addEventListener('pointercancel', function () { press = null; });
  canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  if (window.Arcade && Arcade.input && Arcade.input.onKeys) {
    Arcade.input.onKeys({
      up: function () { if (canInput()) { cursor.r = Math.max(0, cursor.r - 1); audio('ui'); } },
      down: function () { if (canInput()) { cursor.r = Math.min(rows - 1, cursor.r + 1); audio('ui'); } },
      left: function () { if (canInput()) { cursor.c = Math.max(0, cursor.c - 1); audio('ui'); } },
      right: function () { if (canInput()) { cursor.c = Math.min(cols - 1, cursor.c + 1); audio('ui'); } },
      action: function () {
        if (!canInput()) return;
        if (G.toolMode) { applyToolAt(cursor.r, cursor.c); return; }
        if (phase !== 'idle') return;
        if (!selected) { selected = { r: cursor.r, c: cursor.c }; audio('ui'); }
        else if (selected.r === cursor.r && selected.c === cursor.c) { selected = null; audio('back'); }
        else if (Math.abs(selected.r - cursor.r) + Math.abs(selected.c - cursor.c) === 1) {
          attemptSwap(selected.r, selected.c, cursor.r, cursor.c);
        } else { selected = { r: cursor.r, c: cursor.c }; audio('ui'); }
      }
    });
  }
  document.addEventListener('keydown', function (ev) {
    if (panelKind) {
      if (ev.key === 'Escape') closePanel();
      return;
    }
    if (!canInput()) return;
    if (ev.key >= '1' && ev.key <= '4') {
      useTool(TOOL_IDS[Number(ev.key) - 1]);
      ev.preventDefault();
    } else if (ev.key === 'h' || ev.key === 'H') {
      toolModeReset();
      ev.preventDefault();
    } else if (ev.key === 'Escape') {
      selected = null; toolModeReset();
    }
  });

  /* ---------- 按钮 / 生命周期 ---------- */
  TOOL_IDS.forEach(function (id) {
    toolBtns[id] = document.querySelector('[data-tool="' + id + '"]');
    toolCountEls[id] = document.getElementById('sh-tool-n-' + id);
    if (toolBtns[id]) toolBtns[id].addEventListener('click', function () { useTool(id); });
  });
  levelsEl.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-lv]') : null;
    if (!b || b.disabled) return;
    var i = parseInt(b.getAttribute('data-lv'), 10);
    if (i < profile.unlocked) beginGame({ mode: 'level', level: i });
  });
  document.getElementById('sh-diffs').addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-diff]') : null;
    if (!b) return;
    beginGame({ mode: 'free', diff: parseInt(b.getAttribute('data-diff'), 10) });
  });
  document.getElementById('sh-daily').addEventListener('click', function () {
    beginGame({ mode: 'daily', seed: todaySeed() });
  });
  if (weekGoEl) weekGoEl.addEventListener('click', function () {
    beginGame({ mode: 'weekly', seed: weeklyConf().seed, weeklyKey: weeklyKeyNow() });
  });
  var achvBtnEl = document.getElementById('sh-btn-achv');
  var codexBtnEl = document.getElementById('sh-btn-codex');
  if (achvBtnEl) achvBtnEl.addEventListener('click', function () { openPanel('achv'); });
  if (codexBtnEl) codexBtnEl.addEventListener('click', function () { openPanel('codex'); });
  if (panelCloseEl) panelCloseEl.addEventListener('click', closePanel);
  if (panelEl) panelEl.addEventListener('click', function (ev) { if (ev.target === panelEl) closePanel(); });

  var hd = document.createElement('div');
  hd.style.cssText = 'font-size:12px;color:var(--text-dim);line-height:1.8;margin-top:12px;text-align:left;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px';
  hd.innerHTML = T('gs.sheep.helpText');
  root.appendChild(hd);

  window.GAME_RESTART = function () {
    if (lastRun) beginGame(lastRun);
    else beginGame({ mode: 'level', level: 0 });
  };
  window.GAME_TUTORIAL_STEPS = [
    { t: T('gs.sheep.tut1t'), d: T('gs.sheep.tut1') },
    { t: T('gs.sheep.tut2t'), d: T('gs.sheep.tut2') },
    { t: T('gs.sheep.tut3t'), d: T('gs.sheep.tut3') },
    { t: T('gs.sheep.tut4t'), d: T('gs.sheep.tut4') }
  ];

  renderPicker();
  draw();

  if (/(?:^|[?&])qa=1(?:&|$)/.test(window.location.search)) {
    /* 自动化无真实用户手势，浏览器会拦截 vibrate 并在控制台报错；QA 模式下禁用 */
    try { if (navigator.vibrate) navigator.vibrate = function () { return false; }; } catch (e) {}
    window.__qa = {
      state: function () {
        return G ? {
          mode: G.mode, level: G.level, score: G.score, target: G.target,
          remaining: G.remaining, over: G.over, win: G.win, submitted: G.submitted,
          phase: phase, maxChain: G.maxChain, cleared: G.cleared, movesLeft: G.movesLeft,
          collected: G.collected, toolMode: G.toolMode, stars: (profile.stars[G.level] || 0)
        } : null;
      },
      startLevel: function (i) { beginGame({ mode: 'level', level: i }); return true; },
      startFree: function (d) { beginGame({ mode: 'free', diff: d }); return true; },
      setScore: function (n) { if (G) { G.score = n; updateHud(); } },
      setRemaining: function (ms) { if (G) G.remaining = ms; },
      setMoves: function (n) { if (G) { G.movesLeft = n; updateHud(); } },
      objectives: function () { return objectivesMet(); },
      findMove: function () { return G ? Y_findMove(grid) : null; },
      swap: function (r1, c1, r2, c2) { attemptSwap(r1, c1, r2, c2); },
      useTool: function (id) { useTool(id); return G ? (G.tools[id] || 0) : null; },
      applyToolAt: function (r, c) { return applyToolAt(r, c); },
      tools: function () { return G ? { hammer: G.tools.hammer, shuffle: G.tools.shuffle, time: G.tools.time, rainbow: G.tools.rainbow, mode: G.toolMode } : null; },
      finish: function (win) { finish(!!win, 'qa'); },
      starsTotal: function () { return profile.starsTotal; },
      startWeekly: function () { beginGame({ mode: 'weekly', seed: weeklyConf().seed, weeklyKey: weeklyKeyNow() }); return true; },
      weekly: function () {
        var w = weeklyInfo();
        return {
          key: w.key, year: w.year, week: w.week, best: w.best, tries: w.tries, played: w.played,
          cols: w.conf.cols, rows: w.conf.rows, types: w.conf.types, time: w.conf.time,
          target: w.conf.target, clear: w.conf.clear, colors: w.conf.colors
        };
      },
      achievements: function () {
        return achvRows().map(function (r) { return { id: r.def.id, done: r.done, progress: r.p, need: r.need }; });
      },
      codex: function () {
        return codexRows().map(function (r) { return { id: r.def.id, done: r.done, progress: r.p, need: r.need }; });
      },
      meta: function () { return { achv: meta.a, codex: meta.c, stats: meta.stats }; },
      panel: function () { return panelKind; },
      openPanel: function (kind) { openPanel(kind); return true; },
      closePanel: function () { closePanel(); return true; }
    };
  }
})();
