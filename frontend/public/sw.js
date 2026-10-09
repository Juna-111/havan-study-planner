self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { body: event.data?.text() } }
  const title = payload.title || 'Havan Study Planner'
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || 'You have a study reminder.',
    icon: '/brand/havan-logo.png',
    badge: '/brand/havan-logo.png',
    tag: payload.tag || 'havan-study-reminder',
    data: { url: payload.url || '/plan' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/plan'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target)
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
