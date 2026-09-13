/* Universal Store — service worker.
   App shell: cache-first (instant loads, works offline).
   API reads:  network-first with a cached fallback.
   Anything non-GET is never cached. */
const VERSION = "us-v8";
const SHELL = [
  "index.html", "css/app.css", "js/config.js", "js/icons.js", "js/ui.js", "js/api.js",
  "js/customer.js", "manifest.json", "icons/icon.svg"
];

self.addEventListener("install", e => {
  /* addAll() is all-or-nothing: one 404 rejects the whole install, so
     skipWaiting() never runs and every visitor stays on the previous worker
     indefinitely. Adding each file on its own degrades to "that one file isn't
     precached" instead of "the update never ships". */
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(SHELL.map(url => c.add(url).catch(() => {}))))
    .then(() => self.skipWaiting()));
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
