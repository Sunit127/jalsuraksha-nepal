/*
 * JalSuraksha service worker — offline-first basics for an emergency app.
 *
 *  - App shell + key citizen pages: network-first, fall back to cache, then
 *    to /offline.
 *  - Next.js static assets: cache-first (content-hashed).
 *  - /api/public/snapshot (alerts, shelters, contacts, safety tips):
 *    network-first with cached fallback.
 *  - OpenStreetMap tiles: cache-first with a size cap, so recently viewed
 *    map areas still render offline.
 * Supabase API/realtime and all POST requests are never cached.
 */
const VERSION = "js-v3";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const DATA = `${VERSION}-data`;
const TILES = `${VERSION}-tiles`;
const MAX_TILES = 400;

const PRECACHE = [
  "/offline",
  "/citizen",
  "/citizen/sos",
  "/citizen/shelters",
  "/citizen/map",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
];

/** Scripts/styles a cached page needs, so it can also hydrate offline. */
async function precacheAssetsOf(pages) {
  const shell = await caches.open(SHELL);
  const assets = new Set();
  for (const url of pages) {
    const res = await shell.match(url);
    if (!res) continue;
    const html = await res.text();
    for (const m of html.matchAll(/\/_next\/static\/[^"'\s)<>\\]+/g)) assets.add(m[0]);
  }
  const cache = await caches.open(STATIC);
  await Promise.allSettled([...assets].map((a) => cache.add(a)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))))
      .then(() => precacheAssetsOf(PRECACHE.filter((u) => !u.includes("."))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    if (fallbackUrl) return offlineFallback(request, fallbackUrl);
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

/**
 * Navigate to the offline page rather than serving its HTML at another URL:
 * the app router hydrates against the address bar, so /offline markup shown
 * at /dashboard crashes into the error screen.
 */
async function offlineFallback(request, fallbackUrl) {
  const fallback = await caches.match(fallbackUrl);
  if (!fallback) return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  if (request.mode === "navigate" && new URL(request.url).pathname !== fallbackUrl) {
    return Response.redirect(fallbackUrl, 302);
  }
  return fallback;
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      cache.put(request, response.clone());
      if (maxEntries) trimCache(cacheName, maxEntries);
    }
    return response;
  } catch {
    return new Response("", { status: 504 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirst(request, TILES, MAX_TILES));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase etc.: never cached

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  if (url.pathname === "/api/public/snapshot") {
    event.respondWith(networkFirst(request, DATA));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Only public citizen pages are cached; staff pages always hit the network.
    const cacheable = url.pathname === "/" || url.pathname.startsWith("/citizen") || url.pathname === "/offline";
    event.respondWith(cacheable ? networkFirst(request, SHELL, "/offline") : fetch(request).catch(() => offlineFallback(request, "/offline")));
  }
});

/*
 * Lock-screen flood alerts (Web Push). The server sends
 * { title, body, tag, url, urgent } — see lib/services/push.ts. The
 * notification stays until dismissed, uses the device's notification sound
 * and a long vibration; opening it shows the in-app siren.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "JalSuraksha flood alert";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Open JalSuraksha for details.",
      tag: data.tag || "jalsuraksha-alert",
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: data.urgent
        ? [800, 200, 800, 200, 800, 200, 800, 200, 800]
        : [500, 200, 500, 200, 500],
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/citizen/alerts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/citizen/alerts", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : w));
      return self.clients.openWindow(url);
    }),
  );
});
