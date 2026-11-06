/* ============================================================
   游戏街机厅 Service Worker（game/ 子站）
   —— 缓存版本：arcade-hall-v8（2026-11-06 首页由 3D 大厅改为 2D 游戏目录）
   —— 策略：HTML 导航 network-first（离线回退缓存）；
           静态资源（JS/CSS/字体/图片）cache-first
   —— 预缓存：2D 首页 + 档案页 + 53 款游戏页 + 子站 assets 核心
   ============================================================ */
var CACHE = 'arcade-hall-v8';
/* 与 53 个游戏页内脚本引用保持一致，预缓存带版本号的 URL，
   避免离线打开时因 ?v= 未命中缓存而加载失败 */
var ASSET_VER = '20261105i';

/* 各游戏目录内的额外脚本（非 <id>.js / <id>-i18n.js），
   需与 index.html 中同版本号一起预缓存 */
var EXTRA_SCRIPTS = {
  nonogram: ['nonogram-core.js', 'nonogram-puzzles.js'],
  bridge: ['bridge-physics.js'],
  roperescue: ['roperescue-levels.js', 'roperescue-physics.js']
};

/* 核心资源（相对子站根） */
var CORE = [
  './',
  './index.html',
  './story.html',
  './people.html',
  './artifacts.html',
  './assets/js/archive.js',
  './games.js',
  './manifest.webmanifest',
  './assets/css/theme.css',
  './assets/css/shell.css',
  './assets/fonts/fusion-pixel-site.woff2',
  './assets/fonts/press-start-2p.woff2',
  './assets/js/core/storage.js',
  './assets/js/core/input.js',
  './assets/js/core/loop.js',
  './assets/js/core/i18n.js',
  './assets/js/core/i18n-dict.js',
  './assets/js/core/extras.js',
  './assets/js/core/music.js',
  './assets/js/rank.js',
  './assets/js/plot.js',
  './assets/js/stories.js',
  './assets/js/shell.js',
  './assets/js/pwa.js',
  './assets/js/secure.js',
  './assets/js/enc/i18n-archive.enc.js',
  './assets/js/enc/i18n-story.enc.js',
  /* 首页 2026-11-06 起不再使用 three.js / hall-*，旧 3D 资源只留在磁盘上 */
  /* 32 款游戏共用的画布工具库（未带版本号，游戏页按原路径引用） */
  './games/_shared/kit.js',
  './games/_shared/pipegen.js',
  /* 2026-11-06 蘑菇品牌资产 + 家族壳层，离线也要完整 */
  './favicon.ico',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/og-share.png',
  './shell/mk-game.png',
  './shell/netcn-shell.css',
  './shell/shell.js',
];

/* 53 款游戏页 + 各自三件套（注册表在 sw.js 同级：./games.js）
   Service Worker 不允许同步 XHR，改为安装期 fetch 注册表后解析。
   （旧实现用 sync XHR 会抛异常，导致游戏页从未进入预缓存。） */
function buildGamePages() {
  return fetch('./games.js').then(function (res) {
    if (!res || !res.ok) return [];
    return res.text();
  }).then(function (text) {
    var list = [];
    var re = /\bid:\s*'([^']+)'/g, m;
    while ((m = re.exec(text)) !== null) {
      var id = m[1];
      list.push('./games/' + id + '/');
      /* 首页/2D 回退实际跳转的是 id/index.html，必须缓存该精确 URL */
      list.push('./games/' + id + '/index.html');
      list.push('./games/' + id + '/' + id + '.js?v=' + ASSET_VER);
      list.push('./games/' + id + '/' + id + '-i18n.js?v=' + ASSET_VER);
      var extras = EXTRA_SCRIPTS[id];
      if (extras) {
        for (var j = 0; j < extras.length; j++) {
          list.push('./games/' + id + '/' + extras[j] + '?v=' + ASSET_VER);
        }
      }
    }
    return list;
  }).catch(function () { return []; });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return cache.addAll(CORE).then(function () {
          return buildGamePages().then(function (list) {
            if (!list.length) return;
            /* 分块写入：个别资源失败不拖垮全部游戏页预缓存 */
            var chunks = [];
            for (var i = 0; i < list.length; i += 24) chunks.push(list.slice(i, i + 24));
            return chunks.reduce(function (p, chunk) {
              return p.then(function () {
                return cache.addAll(chunk).catch(function () { /* 单块失败不阻断安装 */ });
              });
            }, Promise.resolve());
          });
        });
      })
      .then(function () { if (self.skipWaiting) self.skipWaiting(); })
      .catch(function (err) { console.warn('[SW] 预缓存失败：', err); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING' && self.skipWaiting) self.skipWaiting();
});

function putInCache(request, response) {
  if (request.method !== 'GET' || !response || response.status !== 200) return;
  var copy = response.clone();
  caches.open(CACHE).then(function (c) { c.put(request, copy); }).catch(function () {});
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 导航请求：network-first，离线回退缓存 */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        putInCache(req, res);
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* 静态资源：cache-first + 后台更新 */
  event.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { putInCache(req, res); return res; }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
