const CACHE_NAME = 'palletflow-v3.0-stable';

const APP_SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './libs/three.min.js',
    './libs/tailwind.js',
    './libs/jspdf.umd.min.js',
    './libs/xlsx.full.min.js',
    './libs/OrbitControls.js',
    './assets/icon-192x192.png',
    './assets/icon-512x512.png'
];

// 1. INSTALACIÓN: PRE-CACHÉ Y ACTIVACIÓN INMEDIATA (skipWaiting)
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[PWA ServiceWorker] Pre-cacheando App Shell y dependencias en', CACHE_NAME);
                return cache.addAll(APP_SHELL_ASSETS);
            })
    );
});

// 2. ACTIVACIÓN: TOMA DE CONTROL INMEDIATA (clients.claim) Y PURGA DE CACHÉS OBSOLETAS
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[PWA ServiceWorker] Eliminando caché obsoleta:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. INTERCEPCIÓN FETCH:
// - Peticiones de Navegación / HTML: Network-First (Servidor fresco con fallback a Caché offline)
// - Assets estáticos y librerías /libs/: Cache-First (Máxima velocidad y offline garantizado)
self.addEventListener('fetch', event => {
    // REGLA DE SEGURIDAD CRÍTICA: Bloquear esquemas no HTTP/HTTPS (extensiones, chrome-extension://, etc.)
    if (!event.request.url.startsWith('http')) return;

    const isNavigation = event.request.mode === 'navigate' || 
                         event.request.destination === 'document' ||
                         event.request.url.endsWith('/') || 
                         event.request.url.includes('index.html');

    if (isNavigation) {
        // ESTRATEGIA NETWORK-FIRST PARA DOCUMENTOS / HTML
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request).then(cachedResponse => {
                        return cachedResponse || caches.match('./index.html') || caches.match('/');
                    });
                })
        );
    } else {
        // ESTRATEGIA CACHE-FIRST PARA ASSETS ESTÁTICOS Y LIBRERÍAS
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    }
                    return networkResponse;
                });
            })
        );
    }
});
