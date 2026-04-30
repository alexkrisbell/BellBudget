// Minimal service worker — satisfies Chrome's PWA requirements so the
// manifest icon is used when adding to the Android home screen.
// No offline caching: all requests go straight to the network.

const CACHE = 'bell-bucks-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
