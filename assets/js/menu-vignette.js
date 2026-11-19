/* Menu vignette scenes for the 7.x menu-only screens. Static decorative SVG only. */
(function () {
  var SCENES = {};

  SCENES.fourline = (function () {
    var cells = '';
    var i, r, c, x, y, fill, stroke;
    for (r = 0; r < 6; r++) {
      for (c = 0; c < 7; c++) {
        x = 24 + c * 52;
        y = 12 + r * 22;
        fill = '#0a1424';
        stroke = '#263754';
        if (r === 4 && c === 2) { fill = '#ff386f'; stroke = '#ff91ad'; }
        if (r === 4 && c === 3) { fill = '#b00036'; stroke = '#ff6b8f'; }
        if (r === 3 && c === 3) { fill = '#ffd24a'; stroke = '#fff0a3'; }
        if (r === 5 && c === 4) { fill = '#ffd24a'; stroke = '#fff0a3'; }
        cells += '<circle cx="' + x + '" cy="' + y + '" r="9" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="四子棋棋盘示意">' +
      '<defs><linearGradient id="mv-f4bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111d35"/><stop offset="1" stop-color="#050a13"/></linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-f4bg)"/>' +
      '<rect x="8" y="2" width="384" height="146" rx="12" fill="#07101e" stroke="#24385c"/>' +
      '<path d="M12 55h376M12 100h376" stroke="#17243a" stroke-width="1" opacity=".55"/>' +
      cells +
      '<rect x="12" y="12" width="376" height="126" rx="9" fill="none" stroke="#2d4e7a" stroke-width="1" opacity=".45"/>' +
      '</svg>';
  })();

  SCENES.snake = (function () {
    var grid = '';
    var i;
    for (i = 0; i < 20; i++) {
      grid += '<path d="M' + (i * 20) + ' 0v150" stroke="#1b2b45" stroke-width="1" opacity=".45"/>';
      if (i < 8) grid += '<path d="M0 ' + (i * 20) + 'h400" stroke="#1b2b45" stroke-width="1" opacity=".45"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="贪吃蛇棋盘示意">' +
      '<defs><radialGradient id="mv-snbg" cx=".5" cy=".5" r=".9"><stop offset="0" stop-color="#12213a"/><stop offset="1" stop-color="#060b14"/></radialGradient>' +
      '<filter id="mv-snglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-snbg)"/>' + grid +
      '<g fill="#5ef2a0" filter="url(#mv-snglow)">' +
      '<rect x="58" y="92" width="30" height="18" rx="8"/><rect x="80" y="92" width="30" height="18" rx="8"/><rect x="102" y="92" width="30" height="18" rx="8"/>' +
      '<rect x="124" y="92" width="18" height="30" rx="8"/><rect x="124" y="72" width="18" height="30" rx="8"/><rect x="124" y="52" width="30" height="18" rx="8"/>' +
      '<rect x="146" y="52" width="30" height="18" rx="8"/><rect x="168" y="52" width="18" height="30" rx="8"/><rect x="168" y="74" width="30" height="18" rx="8"/>' +
      '<rect x="190" y="74" width="30" height="18" rx="8"/><rect x="212" y="74" width="18" height="30" rx="8"/><rect x="212" y="96" width="30" height="18" rx="8"/>' +
      '</g>' +
      '<circle cx="300" cy="56" r="13" fill="#ff4d6d" filter="url(#mv-snglow)"/><path d="M300 42q7-9 14-7" fill="none" stroke="#8ee36b" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="300" cy="56" r="3.5" fill="#ffd8df"/><circle cx="66" cy="100" r="3" fill="#07111f"/>' +
      '<text x="20" y="22" fill="#8fa6c8" font-family="monospace" font-size="10" opacity=".85">SNAKE · 01</text>' +
      '</svg>';
  })();

  SCENES.tank = (function () {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="坦克战场示意">' +
      '<defs><linearGradient id="mv-tkbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111c25"/><stop offset=".7" stop-color="#0b131b"/><stop offset="1" stop-color="#1a242b"/></linearGradient>' +
      '<pattern id="mv-tkgrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#2a3b45" stroke-width="1" opacity=".3"/></pattern></defs>' +
      '<rect width="400" height="150" fill="url(#mv-tkbg)"/><rect width="400" height="150" fill="url(#mv-tkgrid)"/>' +
      '<path d="M0 118h400" stroke="#35454c" stroke-width="2" opacity=".7"/>' +
      '<g fill="#2f6b4b" stroke="#7ad6a6" stroke-width="1">' +
      '<rect x="46" y="92" width="52" height="16" rx="5"/><rect x="56" y="80" width="30" height="14" rx="4"/><rect x="82" y="86" width="22" height="5" rx="2"/>' +
      '<rect x="222" y="94" width="58" height="17" rx="5"/><rect x="234" y="80" width="33" height="15" rx="4"/><rect x="264" y="87" width="25" height="5" rx="2"/>' +
      '</g>' +
      '<g fill="#30424e" stroke="#8ba6b2" stroke-width="1">' +
      '<rect x="322" y="80" width="38" height="32" rx="4"/><rect x="330" y="70" width="22" height="12" rx="3"/><rect x="338" y="62" width="7" height="10" rx="2"/>' +
      '</g>' +
      '<g fill="#ffd45e"><circle cx="290" cy="82" r="3"/><circle cx="306" cy="100" r="2.2"/><circle cx="126" cy="74" r="2.5"/></g>' +
      '<path d="M150 70l28-8" stroke="#ff7a59" stroke-width="3" stroke-linecap="round"/><circle cx="180" cy="60" r="4" fill="#ffce76"/>' +
      '<text x="20" y="22" fill="#9fb6c7" font-family="monospace" font-size="10" opacity=".8">IRON LINE · WAVE 01</text>' +
      '</svg>';
  })();

  SCENES.ballpop = (function () {
    var chain = '';
    var pts = [
      [60, 100, '#ff5c8a'], [82, 93, '#ffd25e'], [104, 86, '#6fd3ff'], [126, 79, '#a986ff'], [148, 72, '#5ef2b0'],
      [170, 66, '#ff8fb2'], [192, 61, '#ffd25e'], [214, 58, '#6fd3ff'], [236, 58, '#a986ff'], [258, 61, '#5ef2b0'],
      [280, 66, '#ff5c8a'], [302, 73, '#ffd25e'], [324, 81, '#6fd3ff'], [346, 91, '#a986ff']
    ];
    pts.forEach(function (p) { chain += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="' + p[2] + '"/>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="弹珠消消球链示意">' +
      '<defs><radialGradient id="mv-bpbg" cx=".5" cy=".2" r="1"><stop offset="0" stop-color="#2b1650"/><stop offset="1" stop-color="#080610"/></radialGradient>' +
      '<filter id="mv-bpglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-bpbg)"/>' +
      '<path d="M18 125q80-70 170-67t194 25" fill="none" stroke="#7a5cff" stroke-width="2" stroke-dasharray="4 8" opacity=".5"/>' +
      '<g filter="url(#mv-bpglow)">' + chain + '</g>' +
      '<g transform="translate(200 128)"><circle r="14" fill="#140c28" stroke="#b9a8ff" stroke-width="2"/><circle r="7" fill="#ffd25e"/><path d="M0-20v-7" stroke="#b9a8ff" stroke-width="3" stroke-linecap="round"/></g>' +
      '<text x="20" y="23" fill="#b6a4e8" font-family="monospace" font-size="10" opacity=".8">BALL POP · CHAIN</text>' +
      '</svg>';
  })();

  SCENES.pixelbird = (function () {
    var city = '';
    var b = [[20, 90, 32, 50], [58, 75, 26, 65], [92, 96, 40, 44], [142, 80, 30, 60], [178, 100, 44, 40], [228, 86, 28, 54], [264, 72, 36, 68], [306, 96, 30, 44], [342, 84, 38, 56]];
    b.forEach(function (r) { city += '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" fill="#242036"/>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="像素飞鸟城市示意">' +
      '<defs><linearGradient id="mv-pbbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b4a78"/><stop offset=".55" stop-color="#d58a8e"/><stop offset="1" stop-color="#f3c58d"/></linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-pbbg)"/>' +
      '<g opacity=".75">' + city + '</g>' +
      '<g fill="#72dd9b">' +
      '<rect x="354" y="38" width="20" height="76"/><rect x="348" y="38" width="32" height="10"/><rect x="354" y="108" width="20" height="8"/>' +
      '<rect x="30" y="116" width="20" height="28"/><rect x="24" y="116" width="32" height="6"/>' +
      '</g>' +
      '<g fill="#fff8ee"><rect x="188" y="62" width="8" height="5"/><rect x="196" y="57" width="17" height="15"/><rect x="213" y="62" width="12" height="5"/><rect x="205" y="72" width="5" height="5"/></g>' +
      '<g fill="#ff6a6a"><rect x="211" y="62" width="7" height="5"/></g>' +
      '<g fill="#ffd45e"><circle cx="150" cy="52" r="3"/><circle cx="238" cy="38" r="2.5"/><circle cx="110" cy="96" r="2"/></g>' +
      '<text x="20" y="23" fill="#fff3dd" font-family="monospace" font-size="10" opacity=".9">PIXEL BIRD · NIGHT RUN</text>' +
      '</svg>';
  })();

  SCENES.rhythm = (function () {
    var lanes = '';
    var notes = '';
    var xs = [92, 164, 236, 308];
    xs.forEach(function (x) { lanes += '<rect x="' + (x - 26) + '" y="20" width="52" height="112" fill="#171126" opacity=".6"/><path d="M' + (x - 26) + ' 20v112M' + (x + 26) + ' 20v112" stroke="#423264" stroke-width="1"/>'; });
    var data = [[92, 42, '#ff5c8a'], [164, 64, '#6fd3ff'], [236, 86, '#ffd25e'], [308, 108, '#5ef2b0'], [92, 112, '#6fd3ff'], [164, 100, '#ff5c8a'], [236, 56, '#5ef2b0']];
    data.forEach(function (n) { notes += '<path d="M' + n[0] + ' ' + (n[1] - 9) + 'l10 9-10 9-10-9z" fill="' + n[2] + '" opacity=".95"/>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="节拍脉冲轨道示意">' +
      '<defs><radialGradient id="mv-rhbg" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#24133f"/><stop offset="1" stop-color="#080610"/></radialGradient>' +
      '<filter id="mv-rhglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-rhbg)"/>' + lanes +
      '<g filter="url(#mv-rhglow)">' + notes + '</g>' +
      '<path d="M24 132h352" stroke="#8a6cff" stroke-width="2" opacity=".55"/>' +
      '<g fill="#d6c9ff" font-family="monospace" font-size="10" opacity=".9"><text x="82" y="143">D</text><text x="154" y="143">F</text><text x="226" y="143">J</text><text x="298" y="143">K</text></g>' +
      '<text x="20" y="23" fill="#cdbaff" font-family="monospace" font-size="10" opacity=".8">RHYTHM PULSE · BPM 112</text>' +
      '</svg>';
  })();

  SCENES.railshooter = (function () {
    var ties = '';
    for (var i = 0; i < 7; i++) {
      var t = i / 6, y = 52 + t * t * 96, half = 14 + t * 172;
      ties += '<path d="M' + (200 - half) + ' ' + y + 'h' + (half * 2) + '" stroke="#1d4a66" stroke-width="' + (1 + t * 1.4) + '" opacity=".7"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="轨道射击霓虹轨道示意">' +
      '<defs><radialGradient id="mv-rsbg" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#122a44"/><stop offset=".6" stop-color="#07111f"/><stop offset="1" stop-color="#03050b"/></radialGradient>' +
      '<filter id="mv-rsglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-rsbg)"/>' +
      '<circle cx="70" cy="30" r="1.4" fill="#bfe8ff" opacity=".9"/><circle cx="320" cy="22" r="1.2" fill="#bfe8ff"/><circle cx="350" cy="48" r="1.8" fill="#ffe9b0"/><circle cx="120" cy="18" r="1" fill="#fff"/>' +
      '<path d="M0 52h400" stroke="#2b6a86" stroke-width="1" opacity=".55"/>' +
      '<path d="M200 48L18 150M200 48L382 150" stroke="#38d9ff" stroke-width="2" opacity=".8"/>' + ties +
      '<g filter="url(#mv-rsglow)"><path d="M200 64l12 20h-24z" fill="#ffe36a"/><path d="M200 84l9 16h-18z" fill="#ff9f43" opacity=".85"/></g>' +
      '<g fill="#ff4d6d" filter="url(#mv-rsglow)"><path d="M76 76l11 11-11 11-11-11z"/><path d="M318 66l10 10-10 10-10-10z"/><path d="M268 44l9 9-9 9-9-9z"/></g>' +
      '<g stroke="#ffe36a" stroke-width="2"><path d="M176 52l-6-20M224 52l6-20M196 34l-2-14M204 34l2-14"/></g>' +
      '<g stroke="#38d9ff" fill="none" opacity=".95"><circle cx="200" cy="92" r="19" stroke-width="1.3"/><path d="M200 68v10M200 114v10M176 92h10M224 92h10"/></g>' +
      '<text x="20" y="23" fill="#8fd8f0" font-family="monospace" font-size="10" opacity=".85">RAIL RUNNER · 6 WAVES</text>' +
      '</svg>';
  })();

  SCENES.spaceshooter = (function () {
    var stars = '';
    for (var i = 0; i < 26; i++) {
      var x = (i * 73) % 396 + 2, y = (i * 41) % 144 + 3, r = i % 5 === 0 ? 1.6 : 1;
      stars += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#dff3ff" opacity="' + (0.35 + (i % 4) * 0.16).toFixed(2) + '"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="太空射击星舰示意">' +
      '<defs><radialGradient id="mv-ssbg" cx=".5" cy=".1" r="1"><stop offset="0" stop-color="#282052"/><stop offset=".55" stop-color="#0b1026"/><stop offset="1" stop-color="#04050c"/></radialGradient>' +
      '<filter id="mv-ssglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-ssbg)"/>' + stars +
      '<circle cx="350" cy="128" r="46" fill="#6b4fa0" opacity=".28"/><circle cx="350" cy="128" r="30" fill="#a17ad6" opacity=".16"/>' +
      '<g opacity=".8"><path d="M28 118l12-9 13 7 8 12-20 8z" fill="#4b5568"/><path d="M58 132l9-6 9 5 2 8-14 4z" fill="#374151"/><path d="M332 34l10-7 11 6 5 10-16 5z" fill="#4b5568"/></g>' +
      '<g fill="#ff4d6d" opacity=".9" filter="url(#mv-ssglow)"><path d="M200 23l20 13-20 13-20-13z"/><circle cx="200" cy="30" r="4" fill="#ffe36a"/></g>' +
      '<g filter="url(#mv-ssglow)"><path d="M200 118l17-9 6-24h-46l6 24z" fill="#38d9ff"/><path d="M200 100l10 12-10 18-10-18z" fill="#e8fbff"/><path d="M182 112l-12 18 24-4zM218 112l12 18-24-4z" fill="#6b4fa0"/></g>' +
      '<g stroke="#ffe36a" stroke-width="2" opacity=".95"><path d="M191 80v-34M209 80v-34"/></g>' +
      '<g fill="#ff9f43"><circle cx="238" cy="86" r="2"/><circle cx="166" cy="96" r="1.6"/><circle cx="260" cy="60" r="1.2"/></g>' +
      '<text x="20" y="23" fill="#bfe8ff" font-family="monospace" font-size="10" opacity=".85">SPACE STRIKE · WAVE 01</text>' +
      '</svg>';
  })();

  SCENES.dungeon = (function () {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="地牢探险石室示意">' +
      '<defs><linearGradient id="mv-dgbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151b2b"/><stop offset="1" stop-color="#080b14"/></linearGradient>' +
      '<radialGradient id="mv-dgtorch" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".9"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-dgbg)"/>' +
      '<g stroke="#26324a" stroke-width="1" opacity=".8">' +
      '<path d="M40 30h320v100H40z"/><path d="M40 60h320M40 90h320M100 30v100M160 30v100M220 30v100M280 30v100M340 30v100"/></g>' +
      '<rect x="40" y="30" width="320" height="100" fill="none" stroke="#39496b" stroke-width="2"/>' +
      '<g><circle cx="80" cy="44" r="18" fill="url(#mv-dgtorch)" opacity=".8"/><circle cx="320" cy="44" r="18" fill="url(#mv-dgtorch)" opacity=".8"/>' +
      '<path d="M80 44v-12M80 44l5-8M80 44l-5-8" stroke="#ffd27a" stroke-width="2"/><path d="M320 44v-12M320 44l5-8M320 44l-5-8" stroke="#ffd27a" stroke-width="2"/></g>' +
      '<g><circle cx="200" cy="78" r="9" fill="#38d9ff"/><circle cx="200" cy="74" r="4" fill="#dff8ff"/><path d="M191 86h18l3 13H188z" fill="#2b7aff"/><path d="M200 68v-8" stroke="#ffe36a" stroke-width="2"/></g>' +
      '<g><circle cx="148" cy="108" r="10" fill="#5ee56b" opacity=".9"/><circle cx="144" cy="106" r="2" fill="#0a2a12"/><circle cx="152" cy="106" r="2" fill="#0a2a12"/><path d="M142 114q7 6 14 0" stroke="#0a2a12" stroke-width="1.5" fill="none"/></g>' +
      '<g><rect x="252" y="98" width="14" height="17" rx="3" fill="#ff4d6d"/><rect x="256" y="92" width="10" height="6" rx="2" fill="#ffe36a"/></g>' +
      '<g fill="#ffe36a"><circle cx="110" cy="100" r="7"/><circle cx="124" cy="104" r="5"/></g>' +
      '<text x="20" y="22" fill="#b7c7e8" font-family="monospace" font-size="10" opacity=".85">DUNGEON · FLOOR 01</text>' +
      '</svg>';
  })();

  SCENES.deckbuilder = (function () {
    var fan = [
      ['M132 108l22-58 30 10-22 62z', '#6b4fa0', '#c5a6ff'],
      ['M158 110l22-64 30 10-22 68z', '#2b7aff', '#9ed6ff'],
      ['M184 111l22-72 30 10-22 76z', '#ff4d6d', '#ffb4c4'],
      ['M210 110l22-64 30 10-22 68z', '#ffd25e', '#fff0aa'],
      ['M236 108l22-56 30 10-22 60z', '#5ee56b', '#c8ffd2']
    ];
    var cards = '';
    fan.forEach(function (c, i) {
      cards += '<path d="' + c[0] + '" fill="' + c[1] + '" opacity=".92" stroke="' + c[2] + '" stroke-width="1"/>' +
        '<circle cx="' + (160 + i * 26) + '" cy="' + (78 + i * 2) + '" r="4" fill="' + c[2] + '" opacity=".8"/>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="卡牌构筑牌桌示意">' +
      '<defs><radialGradient id="mv-dkbg" cx=".5" cy=".2" r="1"><stop offset="0" stop-color="#173a34"/><stop offset=".7" stop-color="#0a1a18"/><stop offset="1" stop-color="#050b0a"/></radialGradient>' +
      '<filter id="mv-dkglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-dkbg)"/>' +
      '<path d="M0 112h400" stroke="#2a5a50" stroke-width="1" opacity=".6"/>' + cards +
      '<g filter="url(#mv-dkglow)"><circle cx="92" cy="58" r="17" fill="#2b7aff" opacity=".75"/><circle cx="92" cy="58" r="9" fill="#bfe8ff"/><path d="M92 41v17M92 75v-17M75 58h17M109 58h-17" stroke="#dff8ff" stroke-width="1.5"/></g>' +
      '<g><path d="M322 52l8 30 8-30" stroke="#ffe36a" stroke-width="5" fill="none"/><path d="M322 52h16M330 82v28" stroke="#c9a227" stroke-width="3"/></g>' +
      '<g><path d="M54 118q-12-18 0-28 12 10 0 28z" fill="#9ed6ff" opacity=".8"/><path d="M54 96v22" stroke="#2b7aff" stroke-width="2"/></g>' +
      '<g fill="#ffe36a"><circle cx="352" cy="112" r="6"/><circle cx="366" cy="120" r="4"/><circle cx="338" cy="122" r="3"/></g>' +
      '<text x="20" y="23" fill="#c5e8dd" font-family="monospace" font-size="10" opacity=".85">DECKBUILDER · ACT I</text>' +
      '</svg>';
  })();

  SCENES.asteroidf = (function () {
    var stars = '';
    for (var i = 0; i < 28; i++) {
      var x = (i * 61) % 396 + 2, y = (i * 37) % 142 + 4;
      stars += '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 6 === 0 ? 1.7 : 1) + '" fill="#dff3ff" opacity="' + (0.3 + (i % 5) * 0.14).toFixed(2) + '"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="小行星飞船示意">' +
      '<defs><radialGradient id="mv-afbg" cx=".5" cy=".4" r=".9"><stop offset="0" stop-color="#151b38"/><stop offset=".6" stop-color="#080d19"/><stop offset="1" stop-color="#03050b"/></radialGradient>' +
      '<filter id="mv-afglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-afbg)"/>' + stars +
      '<g fill="#59647a" stroke="#8fa2b8" stroke-width="1" opacity=".85">' +
      '<path d="M58 66l22-13 26 6 17 23-20 19-28-4-17-16z"/><path d="M108 104l14-9 18 5 10 14-13 12-18-2-11-10z"/>' +
      '</g><g fill="#2e3948" opacity=".8"><path d="M310 38l15-9 18 4 12 15-14 13-20-2-11-11z"/></g>' +
      '<g filter="url(#mv-afglow)"><path d="M200 126l15-9 6-22h-42l6 22z" fill="#38d9ff"/><path d="M200 110l9 12-9 17-9-17z" fill="#e8fbff"/>' +
      '<path d="M182 120l-12 17 24-4zM218 120l12 17-24-4z" fill="#6b4fa0"/></g>' +
      '<g stroke="#ffe36a" stroke-width="2" opacity=".9"><path d="M191 94v-30M209 94v-30"/></g>' +
      '<g fill="#ff8a4c"><circle cx="138" cy="52" r="3"/><circle cx="268" cy="92" r="2.5"/><circle cx="330" cy="112" r="2"/></g>' +
      '<text x="20" y="23" fill="#bfe8ff" font-family="monospace" font-size="10" opacity=".85">ASTEROID FIELD · SECTOR 07</text>' +
      '</svg>';
  })();

  SCENES.bullethell = (function () {
    var bullets = '';
    for (var i = 0; i < 26; i++) {
      var a = i / 26 * Math.PI * 2, r = 34 + (i % 5) * 8;
      bullets += '<circle cx="' + (200 + Math.cos(a) * r).toFixed(1) + '" cy="' + (62 + Math.sin(a) * r).toFixed(1) + '" r="' + (2 + i % 3) + '" fill="' + (i % 3 ? '#b967ff' : '#ff4d6d') + '"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="弹幕射击示意">' +
      '<defs><radialGradient id="mv-bhbg" cx=".5" cy=".42" r=".95"><stop offset="0" stop-color="#241540"/><stop offset=".65" stop-color="#0a0918"/><stop offset="1" stop-color="#04040b"/></radialGradient>' +
      '<filter id="mv-bhglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-bhbg)"/>' + bullets +
      '<g filter="url(#mv-bhglow)"><path d="M200 34l22 15-10 20h-24l-10-20z" fill="#ff4d6d"/><circle cx="200" cy="48" r="8" fill="#ffe36a"/></g>' +
      '<g filter="url(#mv-bhglow)"><path d="M200 132l12-7 5-18h-34l5 18z" fill="#38d9ff"/><path d="M200 119l7 9-7 14-7-14z" fill="#e8fbff"/></g>' +
      '<path d="M200 57v58" stroke="#ffe36a" stroke-width="1.5" stroke-dasharray="4 5" opacity=".45"/>' +
      '<text x="20" y="23" fill="#dccaff" font-family="monospace" font-size="10" opacity=".85">BULLET HELL · 12 WAVES</text>' +
      '</svg>';
  })();

  SCENES.fruitmerge = (function () {
    var colors = ['#ff4d6d', '#ff8a4c', '#ffd25e', '#c9e66b', '#5ee56b', '#4fd1c5', '#6fd3ff', '#7a8bff', '#b967ff', '#ff6fae', '#5ee56b'];
    var fruit = '';
    colors.forEach(function (c, i) {
      var a = Math.PI * 0.12 + i / 10 * Math.PI * 0.76;
      var r = 122, cx = 200 - Math.cos(a) * r, cy = 128 - Math.sin(a) * 68;
      fruit += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (7 + i * 1.2) + '" fill="' + c + '" opacity=".9" stroke="#ffffff" stroke-opacity=".35"/>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="西瓜合成水果链示意">' +
      '<defs><linearGradient id="mv-fmbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17112d"/><stop offset=".7" stop-color="#0b1020"/><stop offset="1" stop-color="#070a14"/></linearGradient>' +
      '<pattern id="mv-fmgrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0v40" fill="none" stroke="#26304a" stroke-width="1" opacity=".35"/></pattern></defs>' +
      '<rect width="400" height="150" fill="url(#mv-fmbg)"/><rect width="400" height="150" fill="url(#mv-fmgrid)"/>' + fruit +
      '<path d="M200 12v46" stroke="#ff9f43" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>' +
      '<circle cx="200" cy="66" r="12" fill="#7a4dff" stroke="#dccaff"/><path d="M200 53q7-8 13-6" stroke="#5ee56b" stroke-width="3" fill="none"/>' +
      '<text x="20" y="23" fill="#ffd8ef" font-family="monospace" font-size="10" opacity=".85">WATERMELON MERGE · DROP 01</text>' +
      '</svg>';
  })();

  SCENES.hashi = (function () {
    var islands = [[80, 50, 3], [168, 44, 2], [286, 68, 3], [116, 98, 1], [210, 96, 2], [312, 114, 2], [56, 122, 2]];
    var dots = '';
    islands.forEach(function (p) {
      dots += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (10 + p[2]) + '" fill="#0b2532" stroke="#45e6ff" stroke-width="1.6"/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" text-anchor="middle" fill="#dffcff" font-family="monospace" font-size="11">' + p[2] + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="岛屿连线示意">' +
      '<defs><linearGradient id="mv-hsb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#071b2d"/><stop offset=".55" stop-color="#06111f"/><stop offset="1" stop-color="#03060d"/></linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-hsb)"/>' +
      '<g stroke="#2a8ca8" stroke-width="2" opacity=".65"><path d="M80 50H168"/><path d="M168 44H286"/><path d="M116 98H210"/><path d="M210 96H312"/><path d="M56 122H116"/></g>' +
      '<g stroke="#2a8ca8" stroke-width="1" opacity=".25"><path d="M80 50L116 98M168 44L210 96M286 68L312 114"/></g>' + dots +
      '<path d="M0 128q50-10 100 0t100 0 100 0 100 0" fill="none" stroke="#0f4a63" stroke-width="1" opacity=".6"/>' +
      '<text x="20" y="23" fill="#9feeff" font-family="monospace" font-size="10" opacity=".85">HASHI · ISLAND NETWORK</text>' +
      '</svg>';
  })();

  SCENES.roperescue = (function () {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="切绳救星示意">' +
      '<defs><linearGradient id="mv-rrb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101c2b"/><stop offset=".65" stop-color="#07111d"/><stop offset="1" stop-color="#03070d"/></linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-rrb)"/>' +
      '<path d="M0 30h88l30 20v70l-28 24H0zM400 22h-92l-26 18v76l28 24h90z" fill="#142434" stroke="#31506b"/>' +
      '<path d="M308 26l-42 44" stroke="#ffcf6a" stroke-width="3" stroke-linecap="round"/><circle cx="308" cy="26" r="5" fill="#ffe36a"/>' +
      '<g><path d="M266 70l14 26 18-8z" fill="#ff8a4c"/><rect x="260" y="96" width="38" height="20" rx="8" fill="#38d9ff"/><path d="M270 106h18" stroke="#dffcff" stroke-width="2"/></g>' +
      '<path d="M104 118h192" stroke="#5ee56b" stroke-width="2" stroke-dasharray="8 5" opacity=".55"/>' +
      '<path d="M0 132h400" stroke="#24445a" stroke-width="1"/>' +
      '<g fill="#ff4d6d"><circle cx="128" cy="78" r="3"/><circle cx="150" cy="112" r="2.5"/></g>' +
      '<text x="20" y="23" fill="#bfe8ff" font-family="monospace" font-size="10" opacity=".85">ROPE RESCUE · CUT &amp; FALL</text>' +
      '</svg>';
  })();

  SCENES.sheep = (function () {
    var tiles = '';
    var colors = ['#ff6fae', '#6fd3ff', '#ffe36a', '#b967ff', '#5ee56b'];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 5; c++) {
      tiles += '<rect x="' + (58 + c * 57) + '" y="' + (42 + r * 30) + '" width="48" height="24" rx="6" fill="#14381f" stroke="#2b6b3a"/>';
      if ((r * 5 + c) % 4 === 1) tiles += '<circle cx="' + (70 + c * 57) + '" cy="' + (54 + r * 30) + '" r="7" fill="#f4f1e6"/><circle cx="' + (67 + c * 57) + '" cy="' + (52 + r * 30) + '" r="1.5" fill="#0c2413"/><circle cx="' + (73 + c * 57) + '" cy="' + (52 + r * 30) + '" r="1.5" fill="#0c2413"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="绵羊三消牧场示意">' +
      '<defs><linearGradient id="mv-shbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#163f25"/><stop offset=".65" stop-color="#0c2416"/><stop offset="1" stop-color="#06130c"/></linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-shbg)"/>' + tiles +
      '<g><rect x="14" y="18" width="372" height="114" rx="10" fill="none" stroke="#3a7a4b" stroke-width="1" opacity=".5"/>' +
      '<path d="M14 32h372M14 118h372" stroke="#2e5c3a" stroke-width="2" opacity=".5"/></g>' +
      '<g fill="#ffe36a"><circle cx="336" cy="32" r="3"/><circle cx="348" cy="32" r="2.5"/></g>' +
      '<text x="20" y="23" fill="#d7ffdf" font-family="monospace" font-size="10" opacity=".85">SHEEP MATCH · PASTURE 01</text>' +
      '</svg>';
  })();

  SCENES.slitherlink = (function () {
    var dots = '';
    for (var r = 0; r < 5; r++) for (var c = 0; c < 7; c++) {
      dots += '<circle cx="' + (44 + c * 52) + '" cy="' + (26 + r * 26) + '" r="3" fill="#45e6ff" opacity=".9"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="数回闭合环示意">' +
      '<defs><linearGradient id="mv-slbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1c2d"/><stop offset="1" stop-color="#050a12"/></linearGradient>' +
      '<filter id="mv-slglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="400" height="150" fill="url(#mv-slbg)"/>' +
      '<g stroke="#123d51" stroke-width="1" opacity=".55"><path d="M44 26h312M44 52h312M44 78h312M44 104h312M44 130h312M44 26v104M96 26v104M148 26v104M200 26v104M252 26v104M304 26v104M356 26v104"/></g>' + dots +
      '<path d="M96 52H200V104H304V52H252V78H148V104" fill="none" stroke="#ffe36a" stroke-width="3" filter="url(#mv-slglow)" opacity=".95"/>' +
      '<g fill="#5ee56b" font-family="monospace" font-size="12"><text x="180" y="48">2</text><text x="252" y="76">1</text><text x="304" y="100">0</text></g>' +
      '<text x="20" y="23" fill="#bfe8ff" font-family="monospace" font-size="10" opacity=".85">SLITHERLINK · LOOP LOGIC</text>' +
      '</svg>';
  })();

  SCENES.bridge = (function () {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="桥梁搭建桁架示意">' +
      '<defs><linearGradient id="mv-brb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101b31"/><stop offset=".7" stop-color="#07101b"/><stop offset="1" stop-color="#03060c"/></linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-brb)"/>' +
      '<circle cx="334" cy="34" r="18" fill="#bfe8ff" opacity=".8"/><circle cx="334" cy="34" r="10" fill="#e8fbff" opacity=".3"/>' +
      '<path d="M0 96h92l40-30h136l40 30H400v54H0z" fill="#0b1723" stroke="#24445a"/>' +
      '<path d="M92 96l40-30h136l40 30" fill="none" stroke="#38d9ff" stroke-width="2"/>' +
      '<g stroke="#ffe36a" stroke-width="1.5" opacity=".9"><path d="M132 66h136M92 96l40-30M132 96l0-30M172 96l0-30M212 96l0-30M252 96l0-30M292 96l40-30M292 96l0-30"/></g>' +
      '<g fill="#ffe36a"><circle cx="132" cy="66" r="4"/><circle cx="268" cy="66" r="4"/><circle cx="200" cy="96" r="4"/></g>' +
      '<text x="20" y="23" fill="#bfe8ff" font-family="monospace" font-size="10" opacity=".85">BRIDGE BUILDER · SPAN 440</text>' +
      '</svg>';
  })();

  SCENES.blocks = (function () {
    var cells = '';
    var cols = ['#ffb340', '#ff6fae', '#6fd3ff', '#5ee56b', '#b967ff'];
    for (var i = 0; i < 9; i++) {
      var x = 132 + (i % 3) * 24, y = 96 - Math.floor(i / 3) * 20;
      cells += '<rect x="' + x + '" y="' + y + '" width="21" height="17" rx="3" fill="' + cols[i % 3] + '" opacity=".9"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 150" role="img" aria-label="俄罗斯方块堆叠示意">' +
      '<defs><linearGradient id="mv-blbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a33"/><stop offset="1" stop-color="#050811"/></linearGradient></defs>' +
      '<rect width="400" height="150" fill="url(#mv-blbg)"/>' +
      '<g stroke="#263252" stroke-width="1" opacity=".55"><path d="M56 15v120M80 15v120M104 15v120M128 15v120M152 15v120M176 15v120M200 15v120M224 15v120M248 15v120M272 15v120M296 15v120M320 15v120M344 15v120"/></g>' + cells +
      '<g stroke="#38d9ff" fill="none" opacity=".9"><path d="M104 15v120M320 15v120M104 135h216"/></g>' +
      '<g fill="#ffe36a" opacity=".9"><rect x="282" y="44" width="20" height="20" rx="3"/><rect x="302" y="44" width="20" height="20" rx="3"/></g>' +
      '<text x="20" y="23" fill="#bfe8ff" font-family="monospace" font-size="10" opacity=".85">BLOCKS · LEVEL 01</text>' +
      '</svg>';
  })();

  function fill() {
    var id = document.body && document.body.getAttribute('data-game-id');
    var svg = id && SCENES[id];
    if (!svg) return;
    var nodes = document.querySelectorAll('[data-nc-mv]');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].firstChild) nodes[i].innerHTML = svg;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
  else fill();
  window.addEventListener('load', fill);
})();
