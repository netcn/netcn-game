/* 解码引导（arcade enc v1）：读取 __DSH_C 编码载荷 → 分布式密钥 → 逆乱序 → 逆三轮 XOR → 执行
   注意：本文件无密钥——密钥由 nav.js / extras.js / shell.js 各注入一段
   注意：部分页面把本文件排在 nav.js / extras.js 之前（密钥尚未注入），
         故此处不能早退——等 DOM 就绪后再试一次。 */
(function () {
  var C = window.__DSH_C;
  if (!C) return;
  function decodeAll() {
    var SEED = window.__DSH_SEED, MASK = window.__DSH_MASK, SALT = window.__DSH_SALT;
    if (!SEED || !MASK || !SALT) return false;
    function prng(seedArr, salt) {
      var s0 = 0x9E3779B9 >>> 0, s1 = 0x85EBCA6B >>> 0, s2 = 0xC2B2AE35 >>> 0, s3 = 0x27D4EB2F >>> 0, i;
      for (i = 0; i < 8; i++) {
        s0 = (s0 ^ seedArr[i]) >>> 0;
        s1 = (s1 ^ ((s0 >>> 16) | (s0 << 16))) >>> 0;
      }
      var h = 0x811C9DC5 >>> 0;
      for (i = 0; i < salt.length; i++) { h = ((h ^ salt.charCodeAt(i)) * 0x01000193) >>> 0; }
      s0 = (s0 ^ h) >>> 0;
      return function () {
        var t = ((s1 << 9) | (s1 >>> 23)) >>> 0;
        s2 ^= s0; s3 ^= s1;
        s1 ^= t; s0 ^= ((t << 3) | (t >>> 29)) >>> 0;
        return s0 >>> 0;
      };
    }
    function deriveKey(id) {
      var salt = SALT + '::' + id;
      var k = [], i;
      for (i = 0; i < 8; i++) k.push((SEED[i] ^ MASK[i] ^ salt.charCodeAt(i % salt.length)) & 255);
      return k;
    }
    function xorRound(arr, key) {
      var mark = 'b' + ((arr.length * 31) >>> 0).toString(16);
      var rnd = prng(key, SALT + mark);
      var out = new Uint8Array(arr.length), i;
      for (i = 0; i < arr.length; i++) out[i] = arr[i] ^ (rnd() & 255);
      return out;
    }
    function unshuffle(arr, order, total) {
      var BS = 4096;
      var main = total - (total % BS);
      var back = new Uint8Array(total), k;
      for (k = 0; k < order.length; k++) {
        back.set(arr.subarray(k * BS, k * BS + BS), order[k] * BS);
      }
      back.set(arr.subarray(main, total), main);
      return back;
    }
    function dec(text) {
      var bin = atob(text);
      var out = new Uint8Array(bin.length), i;
      for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    var ROUNDS = 3;
    Object.keys(C).forEach(function (id) {
      try {
        var c = C[id];
        if (!c || c.v !== 1) return;
        var order = JSON.parse(decStr(c.o));
        var bytes = dec(c.b);
        var unsh = unshuffle(bytes, order, bytes.length);
        var key = deriveKey(id);
        var rnd = prng(key, SALT + id), ks = [], r;
        for (r = 0; r < ROUNDS; r++) ks.push(key.map(function (b) { return (b + r * 37 + (rnd() & 255)) & 255; }));
        var out = unsh;
        for (r = ROUNDS - 1; r >= 0; r--) out = xorRound(out, ks[r]);
        var src = new TextDecoder('utf-8').decode(out);
        /* 与原脚本相同执行语义：顶层代码在全局作用域运行 */
        new Function(src).call(window);
      } catch (e) { console.error('DSH decode fail ' + id + ': ' + e.message); }
    });
    function decStr(text) {
      /* 注意：String.fromCharCode.apply(null, <字符串>) 在 V8 会抛
         "CreateListFromArrayLike called on non-object"（apply 不接受原始值），
         故必须先转成真正的数组。 */
      var bin = atob(text), s = '';
      for (var i = 0; i < bin.length; i += 0x8000) {
        var chunk = bin.slice(i, i + 0x8000);
        var arr = new Array(chunk.length);
        for (var j = 0; j < chunk.length; j++) arr[j] = chunk.charCodeAt(j);
        s += String.fromCharCode.apply(null, arr);
      }
      return s;
    }
    return true;
  }
  if (decodeAll()) return;
  /* 密钥尚未注入（脚本顺序问题）→ 等 DOM 就绪后重试 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { decodeAll(); });
  } else {
    setTimeout(function () { decodeAll(); }, 0);
  }
})();
