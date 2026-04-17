// =============================================================
// Service Worker — cachea la shell de la app para uso offline
// El modelo Whisper se cachea automáticamente por Transformers.js
// =============================================================

const CACHE_NAME = 'voz-v2';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './worker.js',
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
  // El resto (CDN de Transformers.js, modelos de HF) lo maneja el navegador
  // y Transformers.js ya cachea los modelos en IndexedDB.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cachear dinámicamente respuestas OK
        if (res.ok && req.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
