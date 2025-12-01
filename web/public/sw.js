/* eslint-disable @typescript-eslint/no-unused-vars */
self.addEventListener('install', (event) => {
  // Service Worker installing
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Service Worker activating
});

self.addEventListener('fetch', (event) => {
  // Add caching logic here if needed for offline support
  // event.respondWith() can be used to cache responses
});
