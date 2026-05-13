self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'SeriesTracker', {
      body: data.body ?? '',
      icon: '/next.svg',
      badge: '/next.svg',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const url = event.notification.data?.url ?? '/';
      const match = list.find(c => c.url.includes(url) && 'focus' in c);
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});
