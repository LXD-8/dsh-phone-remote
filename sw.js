/* DSH phone remote — Web Push service worker. */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {}
    try {
      payload = event.data === null ? {} : event.data.json()
    } catch {
      payload = {}
    }
    if (payload.force !== true) {
      try {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        if (windows.some((client) => client.focused && client.visibilityState === 'visible')) return
      } catch {
        // If the client list is unavailable, still show the notification.
      }
    }
    const title = typeof payload.title === 'string' && payload.title !== ''
      ? payload.title
      : 'DeepSeek Harness'
    const body = typeof payload.body === 'string' ? payload.body : ''
    const icon = new URL('/_phone/icon-192.png', self.location.origin).href
    await self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag: typeof payload.tag === 'string' && payload.tag !== '' ? payload.tag : 'dsh-phone-remote',
      data: { url: typeof payload.url === 'string' && payload.url !== '' ? payload.url : '/' },
      timestamp: Date.now(),
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(
    typeof event.notification.data?.url === 'string' ? event.notification.data.url : '/',
    self.location.origin,
  ).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (typeof client.focus === 'function') {
        try {
          await client.focus()
          client.postMessage({ type: 'dsh-phone-remote-open', url: target })
          return
        } catch {
          // Fall through to opening a new window.
        }
      }
    }
    await self.clients.openWindow(target)
  })())
})
