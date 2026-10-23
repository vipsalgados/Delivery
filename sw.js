// ==============================================================================
// SERVICE WORKER - SALGADOS VIP PWA (DELIVERY & COZINHA)
// ==============================================================================
const CACHE_NAME = 'salgados-vip-cache-v2';

const STATIC_PRECACHE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './admin.css',
  './app.js',
  './admin.js',
  './shared-data.js',
  './supabase.min.js',
  './manifest.json',
  './manifest-cliente.json',
  './manifest-admin.json',
  './pwa.css',
  './pwa.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// Instalação do Service Worker & Pré-cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pré-carregando arquivos essenciais da aplicação...');
      return cache.addAll(STATIC_PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Aviso no pré-cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removendo cache legado:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de requisições:
// 1. Supabase API, Fila WhatsApp e Spooler Local: SEMPRE NETWORK ONLY
// 2. HTML de navegação: Network First com fallback para cache offline
// 3. Imagens, CSS, JS e Fontes: Stale-While-Revalidate / Cache First com atualização em 2º plano
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Não interceptar requisições não-GET
  if (req.method !== 'GET') return;

  // Bypasses essenciais: Supabase, Spooler Local, WhatsApp Bot, esquemas não-http
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname === '127.0.0.1' ||
    url.hostname === 'localhost' ||
    url.protocol.startsWith('chrome-extension') ||
    url.protocol.startsWith('salgadosvip-wa')
  ) {
    return; // Deixa o navegador/fetch lidar nativamente
  }

  // Requisições de Navegação HTML (index.html, admin.html) -> Network First com fallback de cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            // Se for admin e estiver offline
            if (url.pathname.includes('admin')) {
              return caches.match('./admin.html');
            }
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Recursos estáticos locais (CSS, JS, Imagens, Fontes) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => cachedRes); // Fallback silencioso se offline

      return cachedRes || fetchPromise;
    })
  );
});

// Mensagem para forçar atualização imediata
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
