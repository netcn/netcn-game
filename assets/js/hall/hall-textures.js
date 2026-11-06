/* ============================================================
   hall-textures.js —— 街机厅 Canvas 程序化贴图（无外部图片）
   —— 机柜屏幕 / 灯箱招牌 / 辉光 / 地面光带 / 窗格 / 牌匾
   —— 全部由 Canvas2D 实时生成，按需缓存
   ============================================================ */
window.HallTextures = (function () {
  'use strict';

  var FONT_CN = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  var FONT_PIXEL = '"Press Start 2P","Fusion Pixel","Microsoft YaHei",monospace';
  var cache = {};

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w));
    c.height = Math.max(2, Math.round(h));
    return c;
  }
  function rgb(n) { return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(n, a) { var v = rgb(n); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
  function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }

  function fitFont(ctx, text, maxW, start, family, weight) {
    var size = start;
    while (size > 7) {
      ctx.font = (weight || '700') + ' ' + size + 'px ' + family;
      if (ctx.measureText(text).width <= maxW) return size;
      size--;
    }
    return size;
  }

  function toTexture(canvas, srgb) {
    var t = new THREE.CanvasTexture(canvas);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }

  /* ------------------------------------------------------------
     机柜屏幕：分类底色 + 游戏图标 + 名称 + 扫描线 + 最高分
     ------------------------------------------------------------ */
  function screen(game, color, best, low) {
    var key = 'sc' + game.id + '_' + color + '_' + best + '_' + (low ? 1 : 0);
    if (cache[key]) return cache[key];
    var W = low ? 160 : 256;
    var H = Math.round(W * 0.69);
    var c = cv(W, H), x = c.getContext('2d');
    var pad = Math.round(W * 0.06);

    /* 底色 */
    x.fillStyle = '#04060d'; x.fillRect(0, 0, W, H);
    var g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, rgba(color, 0.30));
    g.addColorStop(0.55, rgba(color, 0.09));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    /* 细网格 */
    x.strokeStyle = rgba(color, 0.10); x.lineWidth = 1;
    for (var gx = pad; gx < W; gx += Math.round(W / 12)) {
      x.beginPath(); x.moveTo(gx, pad); x.lineTo(gx, H - pad); x.stroke();
    }
    for (var gy = pad; gy < H; gy += Math.round(H / 8)) {
      x.beginPath(); x.moveTo(pad, gy); x.lineTo(W - pad, gy); x.stroke();
    }

    /* 图标 */
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = Math.round(H * 0.34) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    x.shadowColor = rgba(color, 0.9); x.shadowBlur = Math.round(W * 0.10);
    x.fillText(game.icon || '🎮', W / 2, H * 0.40);
    x.shadowBlur = 0;

    /* 名称 */
    var name = game.title || '';
    var fs = fitFont(x, name, W - pad * 2.2, Math.round(W * 0.115), FONT_CN, '700');
    x.font = '700 ' + fs + 'px ' + FONT_CN;
    x.fillStyle = '#f4fbff';
    x.shadowColor = rgba(color, 0.85); x.shadowBlur = Math.round(W * 0.07);
    x.fillText(name, W / 2, H * 0.73);
    x.shadowBlur = 0;

    /* 分类 */
    x.font = Math.round(W * 0.048) + 'px ' + FONT_CN;
    x.fillStyle = rgba(color, 0.95);
    x.fillText(game.category || '', W / 2, H * 0.875);

    /* 最高分 */
    x.textAlign = 'right';
    x.font = Math.round(W * 0.045) + 'px ' + FONT_PIXEL;
    x.fillStyle = best === null || best === undefined ? 'rgba(140,150,170,.55)' : 'rgba(255,230,0,.95)';
    x.fillText('BEST ' + (best === null || best === undefined ? '----' : best), W - pad, pad + Math.round(W * 0.035));

    /* 顶部状态灯 */
    x.textAlign = 'left';
    x.fillStyle = rgba(color, 0.9);
    x.fillRect(pad, pad + Math.round(W * 0.02), Math.round(W * 0.09), 3);

    /* CRT 扫描线 */
    x.fillStyle = 'rgba(0,0,0,.30)';
    for (var sy = 0; sy < H; sy += 3) x.fillRect(0, sy, W, 1);
    var rg = x.createRadialGradient(W / 2, H / 2, W * 0.12, W / 2, H / 2, W * 0.75);
    rg.addColorStop(0, 'rgba(255,255,255,.06)');
    rg.addColorStop(0.6, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = rg; x.fillRect(0, 0, W, H);

    /* 玻璃高光 */
    x.fillStyle = 'rgba(255,255,255,.05)';
    x.beginPath();
    x.moveTo(0, 0); x.lineTo(W * 0.55, 0); x.lineTo(0, H * 0.42); x.closePath(); x.fill();

    /* 边框 */
    x.strokeStyle = rgba(color, 0.55); x.lineWidth = 2;
    x.strokeRect(1, 1, W - 2, H - 2);
    return (cache[key] = toTexture(c, true));
  }

  /* ------------------------------------------------------------
     机柜灯箱：像素字标题 + 分类色描边
     ------------------------------------------------------------ */
  function marquee(game, color, low) {
    var key = 'mq' + game.id + '_' + color + '_' + (low ? 1 : 0);
    if (cache[key]) return cache[key];
    var W = low ? 256 : 384, H = Math.round(W * 0.25);
    var c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = '#07080f'; x.fillRect(0, 0, W, H);
    var g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, rgba(color, 0.02));
    g.addColorStop(0.5, rgba(color, 0.42));
    g.addColorStop(1, rgba(color, 0.02));
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    /* 斜纹装饰 */
    x.fillStyle = rgba(color, 0.16);
    for (var i = -H; i < W; i += 12) {
      x.beginPath();
      x.moveTo(i, H); x.lineTo(i + 5, H); x.lineTo(i + 5 + H, 0); x.lineTo(i + H, 0);
      x.closePath(); x.fill();
    }

    x.textAlign = 'center'; x.textBaseline = 'middle';
    var fs = fitFont(x, game.title, W * 0.80, Math.round(H * 0.46), FONT_PIXEL, '400');
    x.font = '400 ' + fs + 'px ' + FONT_PIXEL;
    x.fillStyle = '#ffffff';
    x.shadowColor = hex(color); x.shadowBlur = Math.round(H * 0.28);
    x.fillText(game.title, W / 2, H * 0.52);
    x.shadowBlur = 0;

    /* 上下霓虹条 */
    x.fillStyle = rgba(color, 0.95);
    x.fillRect(0, 0, W, 2); x.fillRect(0, H - 2, W, 2);
    /* 角标 */
    x.fillStyle = rgba(color, 0.8);
    x.fillRect(0, 0, 10, 10); x.fillRect(W - 10, 0, 10, 10);
    x.fillRect(0, H - 10, 10, 10); x.fillRect(W - 10, H - 10, 10, 10);
    return (cache[key] = toTexture(c, true));
  }

  /* ------------------------------------------------------------
     通用辉光 / 光带 / 阴影 / 光锥 / 星点（白色，靠 material.color 染色）
     ------------------------------------------------------------ */
  function glow() {
    if (cache.glow) return cache.glow;
    var S = 128, c = cv(S, S), x = c.getContext('2d');
    var g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,.72)');
    g.addColorStop(0.42, 'rgba(255,255,255,.22)');
    g.addColorStop(0.72, 'rgba(255,255,255,.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return (cache.glow = toTexture(c, false));
  }

  function streak() {
    if (cache.streak) return cache.streak;
    var W = 64, H = 256, c = cv(W, H), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, H); /* 顶端最亮，向远处衰减 */
    g.addColorStop(0, 'rgba(255,255,255,.95)');
    g.addColorStop(0.22, 'rgba(255,255,255,.42)');
    g.addColorStop(0.55, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* 横向羽化 */
    var h = x.createLinearGradient(0, 0, W, 0);
    h.addColorStop(0, 'rgba(0,0,0,0)');
    h.addColorStop(0.5, 'rgba(0,0,0,1)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = h; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    return (cache.streak = toTexture(c, false));
  }

  function shadow() {
    if (cache.shadow) return cache.shadow;
    var S = 128, c = cv(S, S), x = c.getContext('2d');
    var g = x.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(0,0,0,.92)');
    g.addColorStop(0.45, 'rgba(0,0,0,.55)');
    g.addColorStop(0.78, 'rgba(0,0,0,.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return (cache.shadow = toTexture(c, false));
  }

  function cone() {
    if (cache.cone) return cache.cone;
    var W = 64, H = 256, c = cv(W, H), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,.85)');
    g.addColorStop(0.35, 'rgba(255,255,255,.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var h = x.createLinearGradient(0, 0, W, 0);
    h.addColorStop(0, 'rgba(0,0,0,0)');
    h.addColorStop(0.5, 'rgba(0,0,0,1)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = h; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    return (cache.cone = toTexture(c, false));
  }

  function dot() {
    if (cache.dot) return cache.dot;
    var S = 64, c = cv(S, S), x = c.getContext('2d');
    var g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return (cache.dot = toTexture(c, false));
  }

  /* 霓虹灯管外发光用的横向渐变（贴在地面/招牌后） */
  function barGlow() {
    if (cache.bar) return cache.bar;
    var W = 256, H = 128, c = cv(W, H), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var v = x.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.5, 'rgba(0,0,0,1)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    return (cache.bar = toTexture(c, false));
  }

  /* ------------------------------------------------------------
     楼宇窗格（自发光贴图）
     ------------------------------------------------------------ */
  function windows() {
    if (cache.win) return cache.win;
    var W = 256, H = 512, c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = '#05060c'; x.fillRect(0, 0, W, H);
    /* 更细密的窗格：远看是成片灯窗，而不是巨大彩色方块 */
    var cols = 18, rows = 46;
    var cw = W / cols, ch = H / rows;
    var pal = ['#ffd98a', '#a9dcff', '#ffcfe6', '#d3c2ff', '#a8ffe4'];
    for (var r = 0; r < rows; r++) {
      for (var i = 0; i < cols; i++) {
        if (Math.random() < 0.44) continue;
        var col = pal[(Math.random() * pal.length) | 0];
        x.globalAlpha = 0.18 + Math.random() * 0.55;
        x.fillStyle = col;
        x.fillRect(i * cw + cw * 0.30, r * ch + ch * 0.34, cw * 0.42, ch * 0.34);
      }
    }
    x.globalAlpha = 1;
    /* 楼体横向暗带（楼层分隔） */
    x.fillStyle = 'rgba(0,0,0,.42)';
    for (var k = 0; k < rows; k += 6) x.fillRect(0, k * ch, W, 2);
    /* 竖向窗框 */
    x.fillStyle = 'rgba(0,0,0,.30)';
    for (var q = 0; q < cols; q += 3) x.fillRect(q * cw, 0, 1, H);
    return (cache.win = toTexture(c, true));
  }

  /* ------------------------------------------------------------
     地面网格线（叠加发光）
     ------------------------------------------------------------ */
  function grid() {
    if (cache.grid) return cache.grid;
    var S = 256, c = cv(S, S), x = c.getContext('2d');
    x.clearRect(0, 0, S, S);
    x.strokeStyle = 'rgba(120,220,255,.30)';
    x.lineWidth = 1;
    x.strokeRect(0.5, 0.5, S - 1, S - 1);
    x.strokeStyle = 'rgba(120,220,255,.12)';
    x.strokeRect(S / 2 - 0.5, 0.5, 0.5, S - 1);
    x.strokeRect(0.5, S / 2 - 0.5, S - 1, 0.5);
    return (cache.grid = toTexture(c, false));
  }

  /* ------------------------------------------------------------
     天空 / 环境球（PMREM 反射源）
     ------------------------------------------------------------ */
  function sky() {
    if (cache.sky) return cache.sky;
    var W = 512, H = 256, c = cv(W, H), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#02030a');
    g.addColorStop(0.34, '#080a1c');
    g.addColorStop(0.52, '#241238');
    g.addColorStop(0.62, '#3a1550');
    g.addColorStop(0.72, '#0b0a1c');
    g.addColorStop(1, '#04050b');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* 地平线霓虹雾 */
    var hz = x.createRadialGradient(W / 2, H * 0.62, 0, W / 2, H * 0.62, W * 0.42);
    hz.addColorStop(0, 'rgba(255,62,165,.30)');
    hz.addColorStop(0.5, 'rgba(0,240,255,.10)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = hz; x.fillRect(0, 0, W, H);
    return (cache.sky = toTexture(c, true));
  }

  /* ------------------------------------------------------------
     竖向霓虹招牌（分类名逐字竖排）
     ------------------------------------------------------------ */
  function signVertical(text, color) {
    var key = 'sv' + text + color;
    if (cache[key]) return cache[key];
    var W = 128, CH = 118;
    var H = Math.max(256, CH * text.length + 40);
    var c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = 'rgba(4,5,12,.92)'; x.fillRect(0, 0, W, H);
    x.strokeStyle = hex(color); x.lineWidth = 4; x.strokeRect(2, 2, W - 4, H - 4);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '400 56px ' + FONT_CN;
    for (var i = 0; i < text.length; i++) {
      x.fillStyle = '#f2fbff';
      x.shadowColor = hex(color); x.shadowBlur = 22;
      x.fillText(text.charAt(i), W / 2, 34 + CH * i + CH / 2);
    }
    x.shadowBlur = 0;
    x.strokeStyle = rgba(color, .6); x.lineWidth = 2;
    for (var j = 0; j < text.length; j++) {
      x.beginPath(); x.moveTo(16, 34 + CH * j + CH); x.lineTo(W - 16, 34 + CH * j + CH); x.stroke();
    }
    return (cache[key] = toTexture(c, true));
  }

  /* ------------------------------------------------------------
     横向牌匾（大门 / 街口 / 宣传语）
     ------------------------------------------------------------ */
  function signWide(title, sub, color) {
    var key = 'sw' + title + sub + color;
    if (cache[key]) return cache[key];
    var W = 1024, H = 256, c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = 'rgba(4,5,12,.94)'; x.fillRect(0, 0, W, H);
    x.strokeStyle = hex(color); x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
    x.strokeStyle = rgba(color, .35); x.lineWidth = 2; x.strokeRect(16, 16, W - 32, H - 32);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    var fs = fitFont(x, title, W * 0.82, 92, FONT_CN, '700');
    x.font = '700 ' + fs + 'px ' + FONT_CN;
    x.fillStyle = '#ffffff';
    x.shadowColor = hex(color); x.shadowBlur = 40;
    x.fillText(title, W / 2, H * 0.44);
    x.shadowBlur = 0;
    if (sub) {
      x.font = '400 34px ' + FONT_PIXEL;
      x.fillStyle = rgba(color, .95);
      x.fillText(sub, W / 2, H * 0.77);
    }
    return (cache[key] = toTexture(c, true));
  }

  /* 英文小招牌（街道氛围） */
  function signTag(text, color) {
    var key = 'st' + text + color;
    if (cache[key]) return cache[key];
    var W = 512, H = 128, c = cv(W, H), x = c.getContext('2d');
    x.fillStyle = 'rgba(4,5,12,.9)'; x.fillRect(0, 0, W, H);
    x.strokeStyle = hex(color); x.lineWidth = 3; x.strokeRect(2, 2, W - 4, H - 4);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    var fs = fitFont(x, text, W * 0.86, 44, FONT_PIXEL, '400');
    x.font = '400 ' + fs + 'px ' + FONT_PIXEL;
    x.fillStyle = '#fff';
    x.shadowColor = hex(color); x.shadowBlur = 22;
    x.fillText(text, W / 2, H / 2);
    return (cache[key] = toTexture(c, true));
  }

  return {
    screen: screen, marquee: marquee, glow: glow, streak: streak, shadow: shadow,
    cone: cone, dot: dot, barGlow: barGlow, windows: windows, grid: grid, sky: sky,
    signVertical: signVertical, signWide: signWide, signTag: signTag
  };
})();
