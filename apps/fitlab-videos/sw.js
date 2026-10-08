/* ============================================================
   FitLab PWA 离线壳
   策略：
   - 核心静态资源：预缓存 + stale-while-revalidate
   - 页面导航 / 清单 videos.json：网络优先，失败回退缓存（弱网可打开）
   - 视频流（/media/*、.m3u8/.ts/.mp4 等）：完全不缓存，直连 R2
   升级：改 VERSION 即可整体换缓存
   ============================================================ */
'use strict';

const VERSION = 'fitlab-v0.2.3';

const CORE = [
  './',
  './index.html',
  './assets/css/style.css?v=0.2.3',
  './assets/js/app.js?v=0.2.3',
  './assets/js/player.js?v=0.2.3',
  './assets/vendor/hls.min.js',
  './assets/icons/icon.svg',
  './site.webmanifest'
];

const isMedia = (url) => url.pathname.startsWith('/media/')
  || /\.(m3u8|ts|m4s|mp4|webm|mov|jpg|jpeg|png|webp)$/i.test(url.pathname);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isMedia(url)) return; // 视频与封面直连，不占缓存

  // 清单：网络优先
  if (/videos\.json$/.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 页面导航：网络优先，离线回退首页
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：stale-while-revalidate
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; })
        .catch(() => hit);
      return hit || net;
    })
  );
});
