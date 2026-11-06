/* ============================================================
   破译编年史 · 数据模块（P5 阶段 0 骨架）
   数据：STORIES（12 章）/ PEOPLE（48 人）/ ARTIFACTS（41 件）
   进度：localStorage（arcade_story_read / arcade_letters / arcade_artifacts / arcade_challenges）
   API：Arcade.stories —— 阅读 / 密信 / 密件 / 挑战 / 微型解算器
   依赖：core/storage.js（先加载）；正文文案经 i18n 字典（st.* / stp.* / sta.*）
   ============================================================ */

window.Arcade = window.Arcade || {};

/* 微型解算器：与全站游戏核心算法一致的轻量实现（供编年史密信使用） */
Arcade.stories = (function () {
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var idx = function (c) { return A.indexOf(c.toUpperCase()); };

  /* ---------- 算法（与 games/* 一致的可逆实现） ---------- */
  function caesarDec(s, k) {
    return s.split('').map(function (c) {
      var i = idx(c);
      return i < 0 ? c : A[(i - k % 26 + 26) % 26];
    }).join('');
  }
  function affineDec(s, a, b) {
    var ai = modInv(a);
    return s.split('').map(function (c) {
      var i = idx(c);
      return i < 0 ? c : A[(ai * (i - b) + 2600) % 26];
    }).join('');
  }
  function modInv(a) {
    for (var x = 1; x < 26; x++) if ((a * x) % 26 === 1) return x;
    return 1;
  }
  function railDec(s, rails) {
    if (rails <= 1) return s;
    var n = s.length, rows = [];
    for (var i = 0; i < rails; i++) rows.push([]);
    var r = 0, dir = 1, pos = [];
    for (var j = 0; j < n; j++) {
      pos.push(r);
      r += dir;
      if (r === rails - 1) dir = -1;
      if (r === 0) dir = 1;
    }
    var lens = [];
    for (var k = 0; k < rails; k++) lens.push(pos.filter(function (p) { return p === k; }).length);
    var cursor = 0, out = new Array(n);
    for (var ri = 0; ri < rails; ri++) {
      for (var ci = 0; ci < n; ci++) {
        if (pos[ci] === ri) out[ci] = s.charAt(cursor++);
      }
    }
    return out.join('');
  }
  function vigenereDec(s, key) {
    var kk = key.toUpperCase().replace(/[^A-Z]/g, '');
    var out = '', ki = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i), x = idx(c);
      if (x < 0) { out += c; continue; }
      var shift = idx(kk.charAt(ki % kk.length));
      out += A[(x - shift + 26) % 26];
      ki++;
    }
    return out;
  }
  /* 培根：5 位 A/B（A=普通 B=加粗），无效码返回 '?' */
  function baconDec(bitsStr) {
    var s = bitsStr.replace(/[^AB]/gi, '');
    var out = '';
    for (var i = 0; i + 5 <= s.length; i += 5) {
      var v = 0, sub = s.substring(i, i + 5);
      for (var j = 0; j < 5; j++) v = (v << 1) | (sub.charAt(j).toUpperCase() === 'B' ? 1 : 0);
      out += v < 26 ? A[v] : '?';
    }
    return out;
  }
  function xorDec(hexStr, key) {
    // 十六进制密文 XOR ASCII 密钥，逐字节
    var hex = hexStr.replace(/\s+/g, '');
    var out = '';
    for (var i = 0; i + 1 < hex.length; i += 2) {
      var b = parseInt(hex.substring(i, i + 2), 16);
      out += String.fromCharCode(b ^ key.charCodeAt((i / 2) % key.length));
    }
    return out;
  }
  /* Playfair：5×5 方格（I/J 合并），解密同行左移/同列上移/矩形对角 */
  function playfairKeyTable(key) {
    var seen = {}, t = [];
    (key.toUpperCase() + A).split('').forEach(function (c) {
      if (c === 'J') c = 'I';
      if (!seen[c]) { seen[c] = 1; t.push(c); }
    });
    return t;
  }
  function playfairDec(s, key) {
    var t = playfairKeyTable(key);
    var pos = {};
    for (var i = 0; i < 25; i++) pos[t[i]] = [Math.floor(i / 5), i % 5];
    var clean = s.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
    if (clean.length % 2) clean += 'X';
    var out = '';
    for (var k = 0; k < clean.length; k += 2) {
      var a = pos[clean.charAt(k)], b = pos[clean.charAt(k + 1)];
      if (!a || !b) continue;
      if (a[0] === b[0]) {
        out += t[a[0] * 5 + ((a[1] + 4) % 5)] + t[b[0] * 5 + ((b[1] + 4) % 5)];
      } else if (a[1] === b[1]) {
        out += t[((a[0] + 4) % 5) * 5 + a[1]] + t[((b[0] + 4) % 5) * 5 + b[1]];
      } else {
        out += t[a[0] * 5 + b[1]] + t[b[0] * 5 + a[1]];
      }
    }
    return out;
  }
  /* 希尔 2×2：C = K·P mod 26（列向量），已知 K 求 P */
  function hillDec(s, k11, k12, k21, k22) {
    var det = (k11 * k22 - k12 * k21 + 26) % 26;
    var di = modInv(det);
    var a = (k22 * di) % 26, b = ((-k12 * di) % 26 + 26) % 26;
    var c = ((-k21 * di) % 26 + 26) % 26, d = (k11 * di) % 26;
    var clean = s.toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length % 2) clean += 'X';
    var out = '';
    for (var i = 0; i < clean.length; i += 2) {
      var x = idx(clean.charAt(i)), y = idx(clean.charAt(i + 1));
      var p1 = (a * x + b * y) % 26, p2 = (c * x + d * y) % 26;
      out += A[p1] + A[p2];
    }
    return out;
  }

  /* ---------- 微型解算器入口：cipher 类型 + 参数 → 解密预览 ---------- */
  function solver(cipher, opts) {
    opts = opts || {};
    var s = opts.ciphertext || '';
    try {
      switch (cipher) {
        case 'caesar': return caesarDec(s, parseInt(opts.k, 10) || 0);
        case 'affine': return affineDec(s, parseInt(opts.a, 10) || 1, parseInt(opts.b, 10) || 0);
        case 'rail': return railDec(s, parseInt(opts.rails, 10) || 2);
        case 'vigenere': return vigenereDec(s, opts.key || '');
        case 'bacon': return baconDec(s);
        case 'xor': return xorDec(s, opts.key || '');
        case 'playfair': return playfairDec(s, opts.key || '');
        case 'hill': return hillDec(s, parseInt(opts.k11, 10) || 1, parseInt(opts.k12, 10) || 0, parseInt(opts.k21, 10) || 0, parseInt(opts.k22, 10) || 1);
        default: return '';
      }
    } catch (e) { return ''; }
  }

  /* ---------- 章节数据（正文/密信答案等文案在 i18n 字典；此处为结构与元数据） ----------
     11 章密钥字母按章节顺序拼成最终密语 CODEBREAKER（C-O-D-E-B-R-E-A-K-E-R） */
  window.STORIES = [
    { id: 'dawn', era: 'era0', titleKey: 'st.c0.t', bodyKey: 'st.c0.b', people: ['champollion'], games: ['freq', 'binary', 'snake', 'llk', 'mazedot', 'match3', 'g2048', 'scytale'], core: ['freq'], letter: { cipher: 'affine', keyLetter: 'C', answer: 'CHAMPOLLION WINS'}, artifact: 'rosetta', prev: null, next: 'caesar', funFacts: true, challenge: 'freq', demo: 'rosetta', concept: { ic: '🗿', zh: '符号解码：同一内容用不同符号系统编码，找到对应规则即破译', en: 'Symbol decoding: one message in different scripts; find the mapping rules' },
     sources: ['Lesley Adkins & Roy Adkins, The Keys of Egypt: The Race to Read the Hieroglyphs', 'Jean-François Champollion, Précis du système hiéroglyphique (1824)'], reads: ['Andrew Robinson, The Story of Writing', 'Simon Singh, The Code Book', 'Edward Dolnick, The Writing of the Gods: The Race to Decode the Rosetta Stone (2021)'] },
    { id: 'caesar', era: 'era1', titleKey: 'st.c1.t', bodyKey: 'st.c1.b', people: ['caesar'], games: ['caesar', 'substitution', 'affine', 'atbash', 'siege', 'bridge', 'sokoban', 'alberti-disc'], core: ['caesar', 'substitution', 'affine', 'atbash'], letter: { cipher: 'caesar', keyLetter: 'O', answer: 'ORDER THE LEGIONS'}, artifact: 'caesar-report', prev: 'dawn', next: 'arab', funFacts: true, challenge: 'caesar-manual', concept: { ic: '🔤', zh: '移位替换：字母表整体平移固定位数', en: 'Shift substitution: the alphabet slides by a fixed number' },
     demo: 'caesar', sources: ['Suetonius, The Twelve Caesars (Life of Julius Caesar, 56)', 'Julius Caesar, Commentarii de Bello Gallico'], reads: ['Suetonius, The Twelve Caesars', 'Simon Singh, The Code Book', 'Barry Strauss, Ten Caesars: Roman Emperors from Augustus to Constantine (2019)'] },
    { id: 'arab', era: 'era2', titleKey: 'st.c2.t', bodyKey: 'st.c2.b', people: ['kindi'], games: ['freq', 'substitution', 'codebreak', 'bifid', 'trifid', 'chess', 'checkers', 'sudoku', 'nonogram', 'game24', 'shikaku', 'fillomino', 'slitherlink', 'homophonic', 'book-cipher'], core: ['freq', 'substitution', 'codebreak'], letter: { cipher: 'substitution', keyLetter: 'D', answer: 'DECODE THE ARAB MESSAGE' }, artifact: 'kindi', prev: 'caesar', next: 'bacon', funFacts: true, challenge: 'freq-most', concept: { ic: '📊', zh: '频率分析：统计字母出现次数，对照语言自然规律', en: 'Frequency analysis: count letter occurrences, match language norms' }, demo: 'affine', sources: ['Al-Kindi, A Manuscript on Deciphering Cryptographic Messages (c. 850)', 'Ibrahim A. Al-Kadit, Origins of Cryptology: The Arab Contributions'], reads: ['Simon Singh, The Code Book', 'Ibrahim A. Al-Kadit, Origins of Cryptology: The Arab Contributions', 'Violet Moller, The Map of Knowledge: A Thousand-Year History of How Classical Ideas Were Lost and Found (2019)'] },
    { id: 'bacon', era: 'era3', titleKey: 'st.c3.t', bodyKey: 'st.c3.b', people: ['bacon', 'vigenere', 'trithemius', 'kasiski', 'babbage', 'kerckhoffs', 'bellaso', 'alberti', 'cardano'], games: ['bacon', 'vigenere', 'morse', 'starflag', 'fruitmerge', 'autokey', 'acrostic', 'stepping-switch', 'cardan-grille', 'fanqie'], core: ['bacon', 'vigenere', 'autokey', 'morse'], letter: { cipher: 'bacon', keyLetter: 'E', answer: 'ENGLISH HIDES SECRETS'}, artifact: 'bacon-book', prev: 'arab', next: 'ww1', funFacts: true, challenge: 'bacon-5bit', concept: { ic: '🖋️', zh: '双字体隐写：两种字形编码 5 位 A/B 二进制', en: 'Biliteral steganography: two typefaces encode 5-bit A/B binary' },
     demo: 'vigenere', sources: ['Francis Bacon, De Augmentis Scientiarum (1623)', 'Blaise de Vigenère, Traicté des chiffres (1586)'], reads: ['Simon Singh, The Code Book', 'Blaise de Vigenère, Traicté des chiffres (1586)', 'Sinclair McKay, The Hidden History of Code-Breaking: The Secret World of Cyphers, Uncrackable Codes, and Elusive Encryptions (2023)'] },
    { id: 'ww1', era: 'era4', titleKey: 'st.c4.t', bodyKey: 'st.c4.b', people: ['payne', 'vernam', 'jefferson', 'wheatstone', 'mauborgne', 'yardley', 'bazeries', 'morse', 'miller'], games: ['adfgvx', 'playfair', 'polybius', 'nihilist', 'railfence', 'morse', 'morselong', 'morsetap', 'spotdiff', 'typecode', 'tank', 'minesweeper', 'bullethell', 'railshooter', 'rhythm', 'spaceshooter', 'jefferson-disk', 'otp-telegraph'], core: ['adfgvx', 'playfair', 'polybius', 'nihilist', 'railfence', 'typecode'], letter: { cipher: 'rail', keyLetter: 'B', answer: 'BRITAIN DECODES ALL'}, artifact: 'zimmermann', prev: 'bacon', next: 'bletchley', funFacts: true, challenge: 'adfgvx-name', concept: { ic: '📡', zh: '替换+换位：方阵替换叠密钥列换位（ADFGVX）', en: 'Substitution + transposition: Polybius plus keyed columnar' },
     demo: 'rail', sources: ['Barbara Tuchman, The Zimmermann Telegram (1958)', 'David Kahn, The Codebreakers (1967)'], reads: ['Barbara Tuchman, The Zimmermann Telegram', 'David Kahn, The Codebreakers', 'Paul Gannon, Before Bletchley Park: The Codebreakers of the First World War (2020)'] },
    { id: 'bletchley', era: 'era5', titleKey: 'st.c5.t', bodyKey: 'st.c5.b', people: ['turing', 'welchman', 'rejewski', 'scherbius', 'knox', 'alexander', 'clarke', 'zygalski', 'rozycki'], games: ['enigma', 'bombe', 'plugboard', 'workshop', 'campaign', 'deckbuilder', 'tactics', 'towerdefense', 'poker', 'blackjack', 'klondike', 'typex'], core: ['enigma', 'bombe', 'plugboard', 'campaign'], letter: { cipher: 'vigenere', keyLetter: 'R', answer: 'ROTOR SECRETS FALL'}, artifact: 'ultra', prev: 'ww1', next: 'midway', funFacts: true, challenge: 'enigma60', concept: { ic: '⚙️', zh: '机器密码学：转子机 Enigma + 已知明文攻击（Bombe）', en: 'Machine ciphers: Enigma rotors + known-plaintext attack (Bombe)' },
     demo: 'enigma', sources: ['Andrew Hodges, Alan Turing: The Enigma (1983)', 'Gordon Welchman, The Hut Six Story (1982)', 'F.H. Hinsley, British Intelligence in the Second World War'], reads: ['Andrew Hodges, Alan Turing: The Enigma', 'Simon Singh, The Code Book', 'Dermot Turing, The Codebreakers of Bletchley Park (2020)'] },
    { id: 'midway', era: 'era6', titleKey: 'st.c6.t', bodyKey: 'st.c6.b', people: ['rochefort', 'driscoll', 'safford'], games: ['jn25', 'm209', 'morse', 'sectorsiege', 'frogcross', 'bowling', 'billiards', 'curling', 'navajo-talker'], core: ['jn25', 'm209'], letter: { cipher: 'playfair', keyLetter: 'E', answer: 'ENEMY FLEET AT MIDWAY'}, artifact: 'af', prev: 'bletchley', next: 'purple', funFacts: true, challenge: 'af-trap', concept: { ic: '🌊', zh: '深度破译：同日电文共享加表，相减抵消密钥', en: 'Depth: same-day messages share the additive; subtract to cancel' },
     demo: 'playfair', sources: ['Gordon W. Prange, Miracle at Midway (1982)', 'John Costello, The Pacific War (1981)'], reads: ['Gordon W. Prange, Miracle at Midway', 'John Costello, The Pacific War', 'Brendan Simms & Steven McGregor, The Silver Waterfall: How America Won the War in the Pacific at Midway (2022)'] },
    { id: 'purple', era: 'era7', titleKey: 'st.c7.t', bodyKey: 'st.c7.b', people: ['friedman', 'efriedman', 'rowlett'], games: ['purple', 'codebreak', 'morse', 'gomoku', 'reversi', 'fourline', 'intel-assess'], core: ['purple', 'codebreak'], letter: { cipher: 'affine', keyLetter: 'A', answer: 'ATTACK COMING EASTWARD'}, artifact: 'eastwind', prev: 'midway', next: 'lorenz', funFacts: true, challenge: 'purple-vowels', demo: 'purple', concept: { ic: '🇯🇵', zh: '步进开关机：无转子，开关矩阵做双路置换', en: 'Stepping-switch machine: no rotors, matrix twin-path permutation' },
     sources: ['Ronald W. Clark, The Man Who Broke Purple (1977)', 'David Kahn, The Codebreakers (1967)'], reads: ['Ronald W. Clark, The Man Who Broke Purple', 'David Kahn, The Codebreakers', 'John F. Dooley, The Gambler and the Scholars: Herbert Yardley, William & Elizebeth Friedman, and the Birth of Modern American Cryptology (2023)'] },
    { id: 'lorenz', era: 'era8', titleKey: 'st.c8.t', bodyKey: 'st.c8.b', people: ['flowers', 'turing', 'newman', 'tutte', 'roberts'], games: ['lorenz', 'dungeon-cipher', 'binary', 'dungeon', 'platformer', 'pixeldino', 'pixelbird', 'asteroidf', 'blocks', 'brickbash'], core: ['lorenz', 'dungeon-cipher', 'binary'], letter: { cipher: 'xor', keyLetter: 'K', answer: 'KNOWLEDGE FROM NOISE'}, artifact: 'colossus', prev: 'purple', next: 'venona', funFacts: true, challenge: 'delta', concept: { ic: '💾', zh: '异或密钥流：明文 ⊕ 密钥 = 密文，差分统计破译', en: 'XOR keystream: plaintext ⊕ key = ciphertext; delta statistics' },
     demo: 'xor', sources: ['Jack Copeland, Colossus: The Secrets of Bletchley Park\'s Codebreaking Computers (2006)', 'Anthony Sale, The Colossus Rebuild Project (TNMoC)'], reads: ['Jack Copeland, Colossus: The Secrets of Bletchley Park\'s Codebreaking Computers', 'David A. Price, Geniuses at War: Bletchley Park, Colossus, and the Dawn of the Digital Age (2021)', 'Dermot Turing, Reflections of Alan Turing: A Relative Story (2021)'] },
    { id: 'venona', era: 'era9', titleKey: 'st.c9.t', bodyKey: 'st.c9.b', people: ['rosenberg', 'gardner', 'tiltman'], games: ['venona', 'detective', 'freq', 'sheep', 'diceluck', 'catch', 'roperescue', 'ballpop'], core: ['venona', 'detective'], letter: { cipher: 'vigenere', kpa: true, keyLetter: 'E', answer: 'EAVESDROPPING ON THE EMPIRE'}, artifact: 'venona', prev: 'lorenz', next: 'modern', funFacts: true, challenge: 'otp-reuse', demo: 'venona', concept: { ic: '🕸️', zh: '密钥复用灾难：一次性密码本被重复使用即破', en: 'Key-reuse disaster: a one-time pad used twice is broken' },
     sources: ['Robert Louis Benson, The Venona Story (NSA, 2001)', 'John Earl Haynes & Harvey Klehr, Venona: Decoding Soviet Espionage in America (1999)'], reads: ['Robert Louis Benson, The Venona Story (NSA)', 'John Earl Haynes & Harvey Klehr, Venona: Decoding Soviet Espionage in America', 'Ben Macintyre, Agent Sonya: Moscow\'s Most Daring Wartime Spy (2020)'] },
    { id: 'modern', era: 'era10', titleKey: 'st.c10.t', bodyKey: 'st.c10.b', people: ['shannon', 'diffie', 'shamir', 'adleman', 'merkle', 'cocks', 'ellis', 'feistel', 'rivest', 'hellman', 'pzimmermann', 'schneier', 'daemen', 'wangxy', 'rijmen', 'elgamal', 'miller', 'back',
    'koblitz', 'goldwasser', 'micali', 'rackoff', 'gentry', 'chaum', 'bernstein', 'matsui', 'biham', 'regev', 'kocher', 'yao', 'rabin'], games: ['xor', 'hill', 'base64', 'binary', 'maker', 'codeguess', 'circuit', 'maze', 'pipe', 'hashi', 'hashlab', 'solitaire', 'rsa', 'shamir', 'sm4', 'phishhunt', 'aes-lab', 'password-vault', 'pgp-mail', 'blockchain-miner', 'totp-verify', 'side-channel-lab', 'homomorphic-lab', 'tor-onion', 'block-modes', 'dh-handshake', 'gm-gateway', 'millionaire', 'blind-sign'], core: ['xor', 'hill', 'base64', 'maker', 'hashlab'], letter: { cipher: 'hill', keyLetter: 'R', answer: 'RING THEORY WINS'}, artifact: 'shannon', prev: 'venona', next: 'quantum', funFacts: true, challenge: 'hill-mat', demo: 'entropy', concept: { ic: '🔐', zh: '信息论与公钥：熵、完美保密、异或原子与 RSA', en: 'Information theory & public key: entropy, secrecy, XOR, RSA' },
     lockedByRank: 4, sources: ['Claude Shannon, A Mathematical Theory of Communication (1948)', 'Claude Shannon, Communication Theory of Secrecy Systems (1949)', 'Lester S. Hill, Cryptography in an Algebraic Alphabet (1929)'], reads: ['Claude Shannon, A Mathematical Theory of Communication (1948)', 'Simon Singh, The Code Book', 'David Wong, Real-World Cryptography (2021)'] },
    /* 第 12 章 · 量子时代：无 letter 字段——最终密语 CODEBREAKER 属于前 11 章，
       finalUnlocked/renderFinal 按「有 letter 的章节」计数与渲染（见本文件与 story.html 守卫） */
    { id: 'quantum', era: 'era11', titleKey: 'st.c11.t', bodyKey: 'st.c11.b', people: ['wiesner', 'bennett', 'brassard', 'shor', 'grover', 'ekert'], games: ['bb84', 'qkd-sim', 'pqc-match', 'zkp-cave'], core: ['bb84'], artifact: 'qmoney', prev: 'modern', next: null, funFacts: true, challenge: 'qber', demo: 'bb84', concept: { ic: '⚛️', zh: '量子威胁与后量子：Shor 瓦解公钥，格密码与 QKD 重筑防线', en: 'Quantum threat & post-quantum: Shor breaks public key; lattices and QKD rebuild the walls' },
     lockedByRank: 5, sources: ['Stephen Wiesner, Conjugate Coding (written c. 1970; published in SIGACT News, 1983)', 'C.H. Bennett & G. Brassard, Quantum Cryptography: Public Key Distribution and Coin Tossing (IEEE ICCSSP, 1984)', 'NIST, FIPS 203/204/205: Post-Quantum Cryptography Standards (2024)'], reads: ['Simon Singh, The Code Book', 'Scott Aaronson, Quantum Computing Since Democritus (2013)', 'NIST IR 8547: Transition to Post-Quantum Cryptography Standards (2024)'] }
  ];

  /* 人物志（57 人；生平/金句文案在 stp.* 字典） */
  window.PEOPLE = [
    'champollion', 'caesar', 'kindi', 'bacon', 'vigenere', 'payne',
    'turing', 'welchman', 'rochefort', 'friedman', 'flowers', 'shannon', 'rosenberg',
    'trithemius', 'kasiski', 'vernam', 'rejewski', 'driscoll', 'diffie', 'shamir', 'adleman',
    'babbage', 'kerckhoffs', 'bellaso', 'scherbius', 'merkle', 'cocks', 'ellis', 'feistel', 'rivest',
    'knox', 'alexander', 'efriedman', 'hellman',
    'jefferson', 'wheatstone', 'mauborgne', 'yardley', 'pzimmermann', 'schneier', 'daemen', 'bazeries',
    'wiesner', 'bennett', 'brassard', 'shor', 'grover', 'wangxy',
    'gardner', 'clarke', 'alberti', 'cardano', 'rijmen', 'elgamal', 'miller', 'back',
    'koblitz',
    'goldwasser', 'micali', 'rackoff', 'gentry', 'chaum', 'bernstein', 'matsui', 'biham',
    'zygalski', 'rozycki', 'tiltman', 'ekert', 'regev', 'kocher', 'yao', 'rabin',
    'williamson', 'playfair', 'rowlett', 'safford', 'newman', 'tutte', 'roberts', 'davies', 'vonneumann', 'gauss', 'galois', 'heninger', 'morse',
    'zengxisheng'
  ];

  /* 密件（原文/描述文案在 sta.* 字典；unlockGameId=通关游戏解锁） */
  /* 密件（原文/描述文案在 sta.* 字典；unlockGameId=通关游戏解锁；nature=史料性质）
     nature: real=真实史料 / dramatized=史料化演绎 / reconstructed=依史料重构 */
  window.ARTIFACTS = [
    { id: 'rosetta', chapterId: 'dawn', unlockGameId: 'freq', nature: 'real' },
    { id: 'caesar-report', chapterId: 'caesar', unlockGameId: 'caesar', nature: 'reconstructed' },
    { id: 'kindi', chapterId: 'arab', unlockGameId: 'freq', nature: 'reconstructed' },
    { id: 'bacon-book', chapterId: 'bacon', unlockGameId: 'bacon', nature: 'reconstructed' },
    { id: 'zimmermann', chapterId: 'ww1', unlockGameId: 'adfgvx', nature: 'real' },
    { id: 'ultra', chapterId: 'bletchley', unlockGameId: 'enigma', nature: 'dramatized' },
    { id: 'af', chapterId: 'midway', unlockGameId: 'jn25', nature: 'dramatized' },
    { id: 'eastwind', chapterId: 'purple', unlockGameId: 'purple', nature: 'dramatized' },
    { id: 'colossus', chapterId: 'lorenz', unlockGameId: 'lorenz', nature: 'reconstructed' },
    { id: 'venona', chapterId: 'venona', unlockGameId: 'venona', nature: 'real' },
    { id: 'shannon', chapterId: 'modern', unlockGameId: 'xor', nature: 'real' },
    /* 传奇密件扩充（D3）：未解之谜/著名争议 */
    { id: 'voynich', chapterId: 'dawn', unlockGameId: 'llk', nature: 'real' },
    { id: 'maryqueen', chapterId: 'bacon', unlockGameId: 'substitution', nature: 'real' },
    { id: 'baconcase', chapterId: 'bacon', unlockGameId: 'llk', nature: 'dramatized' },
    { id: 'beale', chapterId: 'modern', unlockGameId: 'detective', nature: 'dramatized' },
    { id: 'kryptos', chapterId: 'modern', unlockGameId: 'maker', nature: 'real' },
    { id: 'dorabella', chapterId: 'bacon', unlockGameId: 'substitution', nature: 'real' },
    { id: 'shugborough', chapterId: 'caesar', unlockGameId: 'substitution', nature: 'real' },
    { id: 'zodiac', chapterId: 'modern', unlockGameId: 'detective', nature: 'real' },
    { id: 'tamamshud', chapterId: 'modern', unlockGameId: 'detective', nature: 'real' },
    { id: 'phaistos', chapterId: 'dawn', unlockGameId: 'llk', nature: 'real' },
    { id: 'lineara', chapterId: 'dawn', unlockGameId: 'llk', nature: 'real' },
    { id: 'rongorongo', chapterId: 'dawn', unlockGameId: 'llk', nature: 'real' },
    { id: 'chaocipher', chapterId: 'modern', unlockGameId: 'maker', nature: 'real' },
    { id: 'z340', chapterId: 'modern', unlockGameId: 'detective', nature: 'real' },
    { id: 'enigma-codebook', chapterId: 'bletchley', unlockGameId: 'enigma', nature: 'real' },
    { id: 'cillies', chapterId: 'bletchley', unlockGameId: 'bombe', nature: 'real' },
    { id: 'zodiac13', chapterId: 'modern', unlockGameId: 'detective', nature: 'real' },
    { id: 'enigma-m4', chapterId: 'bletchley', unlockGameId: 'enigma', nature: 'real' },
    /* 第五轮 E3：传奇密件扩充 */
    { id: 'culper-ring', chapterId: 'dawn', unlockGameId: 'codeguess', nature: 'real' },
    { id: 'bazeries-cylinder', chapterId: 'ww1', unlockGameId: 'bifid', nature: 'real' },
    { id: 'commercial-enigma', chapterId: 'bletchley', unlockGameId: 'enigma', nature: 'real' },
    { id: 'navajo-code', chapterId: 'midway', unlockGameId: 'navajo-talker', nature: 'real' },
      { id: 'rockex-msg', chapterId: 'lorenz', unlockGameId: 'typex', nature: 'real' },
      { id: 'turing1936', chapterId: 'bletchley', unlockGameId: 'bombe', nature: 'real' },
      { id: 'letsencrypt', chapterId: 'modern', unlockGameId: 'pgp-mail', nature: 'real' },
      { id: 'spectre-paper', chapterId: 'modern', unlockGameId: 'side-channel-lab', nature: 'real' },
      { id: 'cryptolaw', chapterId: 'modern', unlockGameId: 'sm4', nature: 'real' },
    { id: 'monastic-cipher', chapterId: 'dawn', unlockGameId: 'llk', nature: 'real' },
    { id: 'civilwar-disk', chapterId: 'ww1', unlockGameId: 'caesar', nature: 'real' },
    { id: 'adfgvx-break', chapterId: 'ww1', unlockGameId: 'adfgvx', nature: 'real' },
    /* 第四期 A3：量子时代密件 */
    { id: 'qmoney', chapterId: 'quantum', unlockGameId: 'binary', nature: 'real' },
    { id: 'bb84paper', chapterId: 'quantum', unlockGameId: 'bb84', nature: 'real' },
    { id: 'pqc2024', chapterId: 'quantum', unlockGameId: 'base64', nature: 'dramatized' },
    /* 第四期 B5：东方密码密件 */
    { id: 'ziyan', chapterId: 'arab', unlockGameId: 'substitution', nature: 'reconstructed' },
    { id: 'half-radio', chapterId: 'arab', unlockGameId: 'morse', nature: 'real' },
    { id: 'redarmy-cipher', chapterId: 'arab', unlockGameId: 'freq', nature: 'real' },
    { id: 'fanqie', chapterId: 'arab', unlockGameId: 'freq', nature: 'reconstructed' },
  ];

  /* ---------- 进度持久化 ---------- */
  var K_READ = 'arcade_story_read';
  var K_LETTERS = 'arcade_letters';
  var K_ART = 'arcade_artifacts';
  var K_CHAL = 'arcade_challenges';

  function readArr(key) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : []; }
    catch (e) { return []; }
  }
  function writeArr(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }

  /* ---------- 查询辅助 ---------- */
  function findChapter(id) {
    for (var i = 0; i < window.STORIES.length; i++) if (window.STORIES[i].id === id) return window.STORIES[i];
    return null;
  }
  function chapterIndex(id) {
    for (var i = 0; i < window.STORIES.length; i++) if (window.STORIES[i].id === id) return i;
    return -1;
  }
  function getAll() { return window.STORIES.slice(); }
  function get(id) { return findChapter(id); }

  /* ---------- 阅读 ---------- */
  function markRead(id) {
    var a = readArr(K_READ);
    if (a.indexOf(id) < 0) { a.push(id); writeArr(K_READ, a); }
    if (Arcade.rank) Arcade.rank.add(5); // 读章 +5 XP
    if (window.Arcade && Arcade.plot && readCount() >= window.STORIES.length) Arcade.plot.mark('chronicle');
  }
  function isRead(id) { return readArr(K_READ).indexOf(id) >= 0; }
  function readCount() { return readArr(K_READ).length; }

  /* ---------- 密信 ---------- */
  function submitLetter(chapterId, answer) {
    var ch = findChapter(chapterId);
    if (!ch || !ch.letter) return { ok: false };
    var real = (ch.letter.answer || '').toUpperCase().replace(/\s+/g, '');
    var given = String(answer || '').toUpperCase().replace(/\s+/g, '');
    if (!real || given !== real) return { ok: false };
    var a = readArr(K_LETTERS);
    if (a.indexOf(chapterId) < 0) { a.push(chapterId); writeArr(K_LETTERS, a); }
    return { ok: true, keyLetter: ch.letter.keyLetter || '' };
  }
  function letters() { return readArr(K_LETTERS); }
  function letterCount() { return readArr(K_LETTERS).length; }
  function letterChapters() {
    var out = [];
    for (var i = 0; i < window.STORIES.length; i++) if (window.STORIES[i].letter) out.push(window.STORIES[i]);
    return out;
  }
  function finalUnlocked() {
    return readArr(K_LETTERS).length >= letterChapters().length;
  }

  /* ---------- 密件 ---------- */
  function unlockArtifact(artifactId) {
    var a = readArr(K_ART);
    if (a.indexOf(artifactId) < 0) { a.push(artifactId); writeArr(K_ART, a); return true; }
    return false;
  }
  function isArtifactUnlocked(id) { return readArr(K_ART).indexOf(id) >= 0; }
  function artifactsCount() { return readArr(K_ART).length; }

  /* ---------- 挑战 ---------- */
  function markChallenge(chapterId) {
    var a = readArr(K_CHAL);
    if (a.indexOf(chapterId) < 0) { a.push(chapterId); writeArr(K_CHAL, a); }
  }
  function isChallengeDone(chapterId) { return readArr(K_CHAL).indexOf(chapterId) >= 0; }

  /* ---------- 反查 ---------- */
  function chaptersOf(gameId) {
    var out = [];
    window.STORIES.forEach(function (ch) {
      ch.games.forEach(function (g) { if (g === gameId || (g && g.id === gameId)) out.push(ch); });
    });
    return out;
  }
  function chapterPeople(chapterId) {
    var ch = findChapter(chapterId);
    return ch && ch.people ? ch.people : [];
  }

  return {
    getAll: getAll, get: get,
    markRead: markRead, isRead: isRead, readCount: readCount,
    submitLetter: submitLetter, letters: letters, letterCount: letterCount, letterTotal: function () { return letterChapters().length; }, finalUnlocked: finalUnlocked,
    unlockArtifact: unlockArtifact, isArtifactUnlocked: isArtifactUnlocked, artifactsCount: artifactsCount,
    markChallenge: markChallenge, isChallengeDone: isChallengeDone,
    chaptersOf: chaptersOf, chapterPeople: chapterPeople,
    solver: solver
  };
})();

/* 出处字段（自动生成，勿手改） */
window.PEOPLE_SRC = {"champollion":[{"label":"Jean-François Champollion"},{"label":"Lesley and Roy Adkins, The Keys of Egypt: The Obsession to Decipher Egyptian Hieroglyphs (2000)"}],"caesar":[{"label":"Julius Caesar"},{"label":"Gaius Julius Caesar, Commentarii de Bello Gallico (The Gallic Wars)"}],"kindi":[{"label":"al-Kindi (Alkindus)"},{"label":"al-Kindi, \"Manuscript on Deciphering Cryptographic Messages\" (Risala fi istikhraj al-mu'amma)"}],"bacon":[{"label":"Francis Bacon"}],"vigenere":[{"label":"Blaise de Vigenère"}],"payne":[{"label":"Georges Painvin"}],"turing":[{"label":"Alan Turing"},{"label":"Andrew Hodges, Alan Turing: The Enigma (1983)"}],"welchman":[{"label":"Gordon Welchman"},{"label":"Gordon Welchman, The Hut Six Story: Breaking the Enigma Codes (1982)"}],"friedman":[{"label":"William F. Friedman"}],"flowers":[{"label":"Tommy Flowers"}],"shannon":[{"label":"Claude Shannon"},{"label":"Claude E. Shannon, \"Communication Theory of Secrecy Systems\", Bell System Technical Journal (1949)"}],"rosenberg":[{"label":"Julius and Ethel Rosenberg"}],"rochefort":[{"label":"Joseph Rochefort"}],"vernam":[{"label":"Gilbert Vernam"}],"kasiski":[{"label":"Friedrich Kasiski"}],"rejewski":[{"label":"Marian Rejewski"}],"diffie":[{"label":"Whitfield Diffie"},{"label":"Whitfield Diffie and Martin E. Hellman, \"New Directions in Cryptography\", IEEE Transactions on Information Theory (1976)"}],"shamir":[{"label":"Adi Shamir"}],"adleman":[{"label":"Leonard Adleman"}],"driscoll":[{"label":"Agnes Meyer Driscoll"}],"trithemius":[{"label":"Johannes Trithemius"},{"label":"Johannes Trithemius, Steganographia (c. 1499)"}],"babbage":[{"label":"Charles Babbage"}],"kerckhoffs":[{"label":"Auguste Kerckhoffs"},{"label":"Auguste Kerckhoffs, \"La cryptographie militaire\", Journal des Sciences Militaires (1883)"}],"bellaso":[{"label":"Giovan Battista Bellaso"},{"label":"Giovan Battista Bellaso, La cifra del. Sig. Giovan Battista Bellaso (1553)"}],"scherbius":[{"label":"Arthur Scherbius"}],"merkle":[{"label":"Ralph Merkle"},{"label":"Ralph C. Merkle, \"Secure Communications over Insecure Channels\", Communications of the ACM (1978)"}],"cocks":[{"label":"Clifford Cocks"}],"ellis":[{"label":"James H. Ellis"}],"feistel":[{"label":"Horst Feistel"}],"rivest":[{"label":"Ronald L. Rivest - 维基百科"}],"knox":[{"label":"Dilly Knox - 维基百科"}],"alexander":[{"label":"Conel Hugh O'Donel Alexander - 维基百科"}],"efriedman":[{"label":"Elizebeth Smith Friedman - 维基百科"}],"hellman":[{"label":"Martin Hellman - 维基百科"}],"jefferson":[{"label":"Thomas Jefferson - 维基百科"}],"wheatstone":[{"label":"Charles Wheatstone - 维基百科"}],"mauborgne":[{"label":"Joseph O. Mauborgne - 维基百科"}],"yardley":[{"label":"Herbert O. Yardley - 维基百科"}],"pzimmermann":[{"label":"Phil Zimmermann - 维基百科"}],"schneier":[{"label":"Bruce Schneier - 维基百科"}],"daemen":[{"label":"Joan Daemen - 维基百科"}],"bazeries":[{"label":"Étienne Bazeries - 维基百科"}],"wiesner":[{"label":"Stephen Wiesner - 维基百科"}],"bennett":[{"label":"Charles H. Bennett (physicist) - 维基百科"}],"brassard":[{"label":"Gilles Brassard - 维基百科"}],"shor":[{"label":"Peter Shor - 维基百科"},{"label":"Shor (1997) 量子算法原始论文, SIAM J. Comput. - doi.org"}],"grover":[{"label":"Lov Grover - 维基百科"}],"wangxy":[{"label":"Wang Xiaoyun - 维基百科"}],"gardner":[{"label":"Meredith Gardner - 维基百科"}],"clarke":[{"label":"Joan Clarke - 维基百科"}],"alberti":[{"label":"Leon Battista Alberti - 维基百科"}],"cardano":[{"label":"Gerolamo Cardano - 维基百科"}],"rijmen":[{"label":"Vincent Rijmen - 维基百科"}],"elgamal":[{"label":"Taher Elgamal - 维基百科"}],"miller":[{"label":"Frank Miller (cryptographer) - 维基百科"}],"back":[{"label":"Adam Back - 维基百科"}],"koblitz":[{"label":"Neal Koblitz - 维基百科"}],"goldwasser":[{"label":"Wikipedia, 《Shafi Goldwasser》"},{"label":"Goldwasser, S., Micali, S., Rackoff, C. 《The Knowledge Complexity of Interactive Proof Systems》, SIAM Journal on Computing, 1989"},{"label":"Goldwasser, S., Micali, S. 《Probabilistic Encryption》, Journal of Computer and System Sciences, 1984"}],"micali":[{"label":"Wikipedia, 《Silvio Micali》"}],"rackoff":[{"label":"Wikipedia, 《Charles Rackoff》"}],"gentry":[{"label":"Wikipedia, 《Craig Gentry (computer scientist)》"},{"label":"Gentry, C. 《A Fully Homomorphic Encryption Scheme》(博士后论文), Stanford University, 2009"}],"chaum":[{"label":"Wikipedia, 《David Chaum》"}],"bernstein":[{"label":"Wikipedia, 《Daniel J. Bernstein》"}],"matsui":[{"label":"Wikipedia, 《Mitsuru Matsui》"}],"biham":[{"label":"Wikipedia, 《Eli Biham》"}],"zygalski":[{"label":"Wikipedia, 《Henryk Zygalski》"}],"rozycki":[{"label":"Wikipedia, 《Jerzy Różycki》"}],"tiltman":[{"label":"Wikipedia, 《John Tiltman》"}],"ekert":[{"label":"Wikipedia, 《Artur Ekert》"}],"regev":[{"label":"Wikipedia, 《Oded Regev (computer scientist)》"},{"label":"Regev, O. 《On Lattices, Learning with Errors, Random Linear Codes, and Cryptography》, STOC 2005"}],"kocher":[{"label":"Wikipedia, 《Paul Kocher》"},{"label":"Kocher, P. 《Timing Attacks on Implementations of Diffie-Hellman, RSA, DSS, and Other Systems》, CRYPTO 1996"}],"yao":[{"label":"Wikipedia, 《Andrew Yao》"}],"rabin":[{"label":"Wikipedia, 《Michael O. Rabin》"}],"williamson":[{"label":"Wikipedia, 《Malcolm J. Williamson》"}],"playfair":[{"label":"Wikipedia, 《Lyon Playfair》"}],"rowlett":[{"label":"Wikipedia, 《Frank Rowlett》"}],"safford":[{"label":"Wikipedia, 《Laurance Safford》"}],"newman":[{"label":"Wikipedia, 《Max Newman》"}],"tutte":[{"label":"Wikipedia, 《W. T. Tutte》"}],"roberts":[{"label":"Wikipedia, 《Jerry Roberts (cryptographer)》"}],"davies":[{"label":"Wikipedia, 《Donald Davies》"}],"vonneumann":[{"label":"Wikipedia, 《John von Neumann》"}],"gauss":[{"label":"Wikipedia, 《Carl Friedrich Gauss》"}],"galois":[{"label":"Wikipedia, 《Évariste Galois》"}],"heninger":[{"label":"Wikipedia, 《Nadia Heninger》"}],"morse":[{"label":"Wikipedia, 《Samuel Morse》"}],"zengxisheng":[{"label":"《红色密码：红军无线电侦察纪实》等党史文献"},{"label":"中国网络电视台/中央党史文献 红军无线电通信专题"}]};

/* 出处字段（自动生成，勿手改） */
window.ARTIFACT_SRC = {"rosetta":[{"label":"罗塞塔石碑（Rosetta Stone）— Wikipedia"},{"label":"大英博物馆藏罗塞塔石碑（馆藏编号 EA 24）；影本见 Wikimedia Commons"}],"caesar-report":[{"label":"凯撒《高卢战记》（Commentarii de Bello Gallico）— Wikipedia"},{"label":"《高卢战记》拉丁原文与英译（archive.org 影本）"}],"kindi":[{"label":"Al-Kindi（肯迪）与密码分析起源 — Wikipedia"},{"label":"肯迪《论破解加密信息》手稿（archive.org 影本）"}],"bacon-book":[{"label":"培根密码（Bacon's cipher）— Wikipedia"}],"zimmermann":[{"label":"齐默尔曼电报（Zimmermann Telegram）— Wikipedia"}],"ultra":[{"label":"Ultra（布莱切利园破译）— Wikipedia"},{"label":"Bletchley Park 官方博物馆（Ultra/Enigma 展览）"}],"af":[{"label":"中途岛海战与「AF」密语 — Wikipedia"},{"label":"Kahn《The Codebreakers》关于 JN-25 /「AF」的章节（专著）"}],"eastwind":[{"label":"「东风」暗号（Winds Code）— Wikipedia"},{"label":"Kahn《The Codebreakers》关于日本外交密码的章节（专著）"}],"colossus":[{"label":"Colossus（计算机）— Wikipedia"},{"label":"The National Museum of Computing（TNMOC）官方"}],"venona":[{"label":"VENONA 项目 — Wikipedia"},{"label":"NSA 官方（VENONA 解密档案）"}],"shannon":[{"label":"香农《A Mathematical Theory of Communication》— Wikipedia"},{"label":"论文原文 DOI（Bell System Technical Journal）"}],"voynich":[{"label":"伏尼契手稿（Voynich Manuscript）— Wikipedia"},{"label":"Beinecke 图书馆伏尼契手稿数位影本（archive.org 收藏）"}],"maryqueen":[{"label":"苏格兰玛丽女王密信与巴宾顿阴谋（Babington Plot）— Wikipedia"},{"label":"Mary, Queen of Scots — Wikipedia"}],"baconcase":[{"label":"培根-莎士比亚作者身份假说（Baconian theory）— Wikipedia"}],"beale":[{"label":"比尔密码（Beale ciphers）— Wikipedia"}],"kryptos":[{"label":"Kryptos（CIA 雕塑密码）— Wikipedia"},{"label":"CIA 官方 Kryptos 页面"}],"dorabella":[{"label":"多拉贝拉密信（Dorabella cipher）— Wikipedia"}],"shugborough":[{"label":"舒格伯勒碑文（Shugborough inscription）— Wikipedia"}],"zodiac":[{"label":"黄道十二宫杀手（Zodiac Killer）及其密文 — Wikipedia"}],"tamamshud":[{"label":"萨默顿人案（Taman Shud case）— Wikipedia"}],"phaistos":[{"label":"费斯托斯圆盘（Phaistos Disc）— Wikipedia"}],"lineara":[{"label":"线形文字 A（Linear A）— Wikipedia"}],"rongorongo":[{"label":"朗格朗格（Rongorongo）— Wikipedia"}],"chaocipher":[{"label":"混沌密码（Chaocipher）— Wikipedia"}],"z340":[{"label":"黄道杀手 340 密文的破译 — Wikipedia（Zodiac Killer）"}],"enigma-codebook":[{"label":"恩尼格玛密码机与密钥管理（Enigma machine）— Wikipedia"},{"label":"Bletchley Park 官方博物馆（Enigma 破译展览）"}],"cillies":[{"label":"Enigma「Cillies」操作员惰性密钥 — Wikipedia（Enigma machine 密码分析）"},{"label":"Bletchley Park 官方博物馆（Bombe/Enigma 破译）"}],"zodiac13":[{"label":"黄道十二宫杀手「我的名字是」13 字符密文 — Wikipedia（Zodiac Killer）"}],"enigma-m4":[{"label":"恩尼格玛 M4 海军四转子密码机 — Wikipedia（Enigma machine）"},{"label":"Bletchley Park 官方博物馆（海军 Enigma 破译）"}],"culper-ring":[{"label":"库尔珀间谍圈（Culper Ring）— Wikipedia"}],"bazeries-cylinder":[{"label":"巴泽里密码圆筒（Bazeries cylinder）— Wikipedia"},{"label":"轮式密码 / 杰斐逊圆盘（Wheel cipher / Jefferson disk）— Wikipedia"}],"commercial-enigma":[{"label":"恩尼格玛密码机（含商用 D 型）— Wikipedia"}],"navajo-code":[{"label":"纳瓦霍密码通讯员（Navajo Code Talkers / Code talker）— Wikipedia"}],"rockex-msg":[{"label":"Rockex 密码机（英国）— Wikipedia"},{"label":"Bletchley Park 官方博物馆（战后密码机）"}],"turing1936":[{"label":"图灵《On Computable Numbers, with an Application to the Entscheidungsproblem》— Wikipedia"}],"letsencrypt":[{"label":"Let's Encrypt — Wikipedia"}],"spectre-paper":[{"label":"Spectre 漏洞 — Wikipedia"},{"label":"Meltdown 漏洞 — Wikipedia"}],"cryptolaw":[{"label":"《中华人民共和国密码法》— 国家密码管理局（官方公布）"}],"monastic-cipher":[{"label":"修道士密码/中世纪数字记号「The Ciphers of the Monks」— Wikipedia"}],"civilwar-disk":[{"label":"密码圆盘（Cipher disk）— Wikipedia"},{"label":"Friedman《Codes and Ciphers of the Civil War》（专著）"}],"adfgvx-break":[{"label":"ADFGVX 密码与佩恩万（Painvin）的破译 — Wikipedia"}],"qmoney":[{"label":"量子货币（Quantum money）— Wikipedia"}],"bb84paper":[{"label":"BB84 量子密钥分发协议 — Wikipedia"}],"pqc2024":[{"label":"ML-KEM（FIPS 203）— Wikipedia"},{"label":"NIST FIPS 203 官方公告"}],"ziyan":[{"label":"《武经总要》与「字验」军符（Wujing Zongyao）— Wikipedia"}],"fanqie":[{"label":"反切（Fanqie）— Wikipedia"}],"half-radio":[{"label":"「半部电台起家」— 红军无线电通信发展史（回忆录与苏区档案史料）"},{"label":"王诤（吴人鉴）— 红军无线电通信与侦听创始人"},{"label":"1931 年红军无线电训练班 — 苏区报刊与电讯史料"}],"redarmy-cipher":[{"label":"红军无线电侦察（「千里眼」「顺风耳」）— 中央苏区通信史文献"},{"label":"军委二局与红军破译工作 — 相关回忆与组织史料"}]};

