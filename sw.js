/* Caches the phone page only. The rain file is never cached here. */
const CACHE = "palmyra-rain-pwa-v1";
const SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.mjs",
  "./js/auth.mjs",
  "./js/config.mjs",
  "./js/graph.mjs",
  "./js/merge.mjs",
  "./js/past.mjs",
  "./js/path-guard.mjs",
  "./js/store.mjs",
  "./js/sync.mjs",
  "./js/time.mjs",
  "./vendor/msal-browser.min.js",
  "./icons/favicon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (path) => {
      const response = await fetch(new Request(path, { cache: "reload" }));
      if (!response.ok) throw new Error(path);
      await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cachedPage(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const url = new URL(request.url);
  if (request.mode === "navigate" || url.pathname.endsWith("/")) {
    return caches.match(new URL("./index.html", url.href.endsWith("/") ? url.href : `${url.href}/`));
  }
  return null;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;
  if (url.pathname.endsWith("/sw.js")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(event.request);
      if (fresh && fresh.ok) await cache.put(event.request, fresh.clone());
      return fresh;
    } catch {
      const hit = await cachedPage(event.request);
      if (hit) return hit;
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
