const CACHE_NAME = 'basma-hma-v621';
const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — smart caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // API calls — always network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // CDN resources (face-api.js models + Leaflet) — cache first, then network
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Static assets — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ═══ Push Notifications ═══
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) { data = { title: 'بصمة HMA', body: event.data ? event.data.text() : 'إشعار جديد' }; }
  var title = data.title || 'بصمة HMA';
  var options = {
    body: data.body || data.message || 'إشعار جديد',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'basma-notif',
    requireInteraction: data.requireInteraction || data.fakeCall || false,
    vibrate: data.fakeCall ? [600, 300, 600, 300, 600, 300, 600] : [200, 100, 200],
    data: data,
  };
  if (data.fakeCall) {
    options.actions = [
      { action: 'answer', title: '✓ رد' },
      { action: 'decline', title: '✗ رفض' },
    ];
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var data = event.notification.data || {};
  var targetUrl = '/';
  if (data.fakeCall || event.action === 'answer') {
    targetUrl = '/?action=fake_call_answer&type=' + (data.callType || 'checkin');
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.includes(self.location.origin)) {
          return clients[i].focus().then(function(client){
            if (data.fakeCall) client.postMessage({ type: 'fake_call', callType: data.callType || 'checkin' });
            return client;
          });
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
