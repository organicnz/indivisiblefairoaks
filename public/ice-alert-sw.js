/* ICE Alert surge notifications. Written as plain JS so it can be served
   without a build step and updated independently of the app bundle. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'ICE surge watch';
  const body =
    typeof payload.body === 'string'
      ? payload.body
      : 'A cluster of community reports was published. Open the map for details.';
  const url =
    typeof payload.url === 'string' && payload.url.startsWith('/')
      ? payload.url
      : '/ice-alerts';
  const tag = typeof payload.tag === 'string' ? payload.tag : 'ice-surge';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: false,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/ice-alerts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
