/// <reference lib="webworker" />

const CACHE_NAME = 'biozephyra-v1'
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.webmanifest',
]

// Install — precache core shell
self.addEventListener('install', (event) => {
  const e = event
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  const e = event
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// Fetch — network-first with offline fallback for navigations,
// stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  const e = event
  const { request } = e

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigation requests → network first, fallback to offline page
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_URL))
        .then((response) => response || new Response('Offline', { status: 503 }))
    )
    return
  }

  // Static assets → stale-while-revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return networkResponse
        })
        return cached || fetchPromise
      })
    )
    return
  }
})
