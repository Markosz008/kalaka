const CACHE_NAME = 'kalaka-szentendre-v2026-11-20-b';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Kaláka Szentendre', body: 'Új szentendrei értesítés érkezett' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    try {
      const txt = event.data ? event.data.text() : '';
      if (txt) data.body = txt;
    } catch {}
  }

  const options = {
    body: data.body || 'Új értesítés a szomszédságból',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'kalaka-notif',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: data.url || '/' }
  };

  const badgeCount = Number(data.badge || 1);
  const tasks = [
    self.registration.showNotification(data.title || 'Kaláka Szentendre', options)
  ];

  if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
    tasks.push(
      self.navigator.setAppBadge(badgeCount > 0 ? badgeCount : 1).catch(() => {})
    );
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  const tasks = [];

  if (self.navigator && typeof self.navigator.clearAppBadge === 'function') {
    tasks.push(self.navigator.clearAppBadge().catch(() => {}));
  }

  tasks.push(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'KALAKA_NOTIF_CLICK', url: targetUrl });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/realtime/')
  ) {
    return;
  }

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
