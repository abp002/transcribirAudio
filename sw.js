// =============================================================
// Service Worker — cachea la shell de la app para uso offline
// El modelo Whisper se cachea automáticamente por Transformers.js
// =============================================================

const CACHE_NAME = 'voz-v5';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './worker.js',
  './pcm-recorder.js',
  './manifest.json',
  './icon.svg',
  './logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo gestionamos recursos del mismo origen (la shell).
  if (url.origin !== self.location.origin) return;

  // NUNCA cachear llamadas al backend (detección + transcripción).
  // Si el backend local está arrancado, la app debe poder detectarlo
  // siempre; si cachearámos /api/health=200 o /api/health=404 se
  // quedaría una respuesta pegada que rompería la UI.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && req.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
