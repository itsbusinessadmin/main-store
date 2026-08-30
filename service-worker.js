/* Universal Store — service worker.
   App shell: cache-first (instant loads, works offline).
   API reads:  network-first with a cached fallback.
   Anything non-GET is never cached. */
const VERSION = "us-v2";
const SHELL = [
  "index.html", "css/app.css", "js/config.js", "js/ui.js", "js/api.js",
  "js/customer.js", "js/mock.js", "manifest.json", "icons/icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Public API reads + KV files: network-first, fall back to cache when offline.
  if (url.searchParams.has("action")) {
    e.respondWith(
      fetch(request)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(request, copy)); return res; })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell: cache-first, refresh in the background.
  e.respondWith(
    caches.match(request).then(hit => {
      const network = fetch(request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(request, copy)); }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
