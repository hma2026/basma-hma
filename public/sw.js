const CACHE_NAME = 'basma-hma-v662';
const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/manifest.json',
  '/hma-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API — mutations go to network only (client queues offline)
  if (url.pathname.startsWith('/api/')) {
    if (event.request.method !== 'GET') {
      event.respondWith(
        fetch(event.request).catch(() => {
          return new Response(JSON.stringify({ error: 'offline', _offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }
    // GETs: network first, cache fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          var action = url.searchParams.get('action');
          var cacheable = ['employees', 'branches', 'tawasul-list', 'work_types', 'settings', 'banners', 'announcements', 'attendance', 'leaves', 'permissions'];
          if (response.ok && action && cacheable.indexOf(action) >= 0) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'offline', _offline: true }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // CDN — cache first
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

  // Static: network first, cache fallback, root as last resort for navigation
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      }))
  );
});

// Background sync — try resending queued items when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'basma-queue-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'sync-queue' }));
      })
    );
  }
});

// Push notifications
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
  if (data.type === 'tawasul_new_task' || (data.tag && data.tag.indexOf('tawasul-') === 0)) {
    targetUrl = '/?page=tawasul' + (data.taskId ? '&task=' + data.taskId : '');
  } else if (data.fakeCall || event.action === 'answer') {
    targetUrl = '/?action=fake_call_answer&type=' + (data.callType || 'checkin');
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.includes(self.location.origin)) {
          return clients[i].focus().then(function(client){
            if (data.fakeCall) client.postMessage({ type: 'fake_call', callType: data.callType || 'checkin' });
            else if (data.type === 'tawasul_new_task') client.postMessage({ type: 'tawasul_new_task', taskId: data.taskId });
            return client;
          });
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
