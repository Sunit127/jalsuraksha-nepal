"use client";

import { useEffect } from "react";

// Must match the cache names in public/sw.js (VERSION = "js-v3").
const STATIC_CACHE = "js-v3-static";
const DATA_CACHE = "js-v3-data";

/**
 * The first page load happens before the worker controls the page, so its
 * scripts and the public snapshot never pass through the worker's fetch
 * handler. Cache them directly; otherwise a first-visit reload while offline
 * shows un-hydrated HTML (no buttons) and no alerts/shelters data.
 */
async function warmOfflineCache() {
  const assets = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => {
      const url = new URL(u);
      return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
    });
  await Promise.allSettled([
    caches.open(STATIC_CACHE).then((c) => c.addAll(assets)),
    caches.open(DATA_CACHE).then((c) => c.add("/api/public/snapshot")),
  ]);
}

/**
 * Registers the offline service worker in production builds and warms the
 * offline caches. Skipped in development so hot reload stays reliable.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(warmOfflineCache)
        .catch((error) => console.warn("[sw] registration failed", error));
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
