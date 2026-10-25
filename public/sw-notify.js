// 알림을 누르면 해당 행사 화면을 열기 (vite-plugin-pwa 서비스워커에서 importScripts 로 불러옴)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
