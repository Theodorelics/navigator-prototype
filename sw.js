// Сервис-воркер: мгновенный запуск с иконки и работа без интернета.
// Стратегия выбрана так, чтобы НЕ повторилась проблема «клиент видит старую версию»:
//   страница — всегда из сети (офлайн — из кеша), статика — из кеша с фоновым обновлением.
var V = 'navigator-v1';
var CORE = [
  './',
  './index.html',
  './support.js',
  './image-slot.js',
  './ios-frame.js',
  './manifest.webmanifest',
  './vendor/react.min.js',
  './vendor/react-dom.min.js',
  './assets/generated/f7-login.webp',
  './assets/generated/logo-mark-modern.webp',
  './assets/app-icon-180.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(V)
      .then(function(c){ return Promise.all(CORE.map(function(u){ return c.add(u).catch(function(){}); })); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.filter(function(k){ return k !== V; }).map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if (url.origin !== self.location.origin) return;      // внешние (шрифты) не трогаем

  var isDoc = req.mode === 'navigate' || url.pathname === '/' ||
              url.pathname.slice(-1) === '/' || url.pathname.slice(-5) === '.html';

  if (isDoc){                                            // страница: сеть вперёд
    e.respondWith(
      fetch(req).then(function(r){
        var copy = r.clone();
        caches.open(V).then(function(c){ c.put(req, copy); });
        return r;
      }).catch(function(){
        return caches.match(req).then(function(r){ return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  e.respondWith(                                         // статика: кеш вперёд, обновление в фоне
    caches.match(req).then(function(cached){
      var net = fetch(req).then(function(r){
        if (r && r.status === 200){
          var copy = r.clone();
          caches.open(V).then(function(c){ c.put(req, copy); });
        }
        return r;
      }).catch(function(){ return cached; });
      return cached || net;
    })
  );
});
