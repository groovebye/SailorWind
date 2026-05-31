/* SailorWind service worker — offline support for use at sea (no signal).
 * Strategy:
 *  - app shell + Next static assets: cache-first
 *  - navigations: network-first, fall back to cached page, then /offline
 *  - same-origin GET /api/*: stale-while-revalidate (briefings/forecast/tides work offline)
 *  - map tiles (Carto/OSM/OpenSeaMap/EMODnet): cache-first, capped LRU
 *  POSTs are never cached — live-fetch features degrade; cached GETs + the
 *  forecast pre-warm cron are the offline data path.
 */
const VERSION = "v4";
const SHELL = `sw-shell-${VERSION}`;
const RUNTIME = `sw-runtime-${VERSION}`;
const TILES = `sw-tiles-${VERSION}`;
const TILE_MAX = 800;
const PRECACHE = ["/", "/offline", "/icon.svg"];

const TILE_HOSTS = [
  "basemaps.cartocdn.com", "cartodb-basemaps", "tile.openstreetmap.org",
  "openseamap.org", "ows.emodnet-bathymetry.eu", "server.arcgisonline.com",
];
const isTile = (url) => TILE_HOSTS.some((h) => url.hostname.includes(h));

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Map tiles (cross-origin, opaque): cache-first with cap
  if (isTile(url)) {
    event.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        c.put(request, res.clone());
        trim(TILES, TILE_MAX);
        return res;
      } catch {
        return hit || Response.error();
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations: network-first -> cached page -> offline fallback
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        const c = await caches.open(RUNTIME);
        c.put(request, res.clone());
        return res;
      } catch {
        return (await caches.match(request)) || (await caches.match("/offline")) || Response.error();
      }
    })());
    return;
  }

  // Next static + icon + manifest: cache-first
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon") || url.pathname.endsWith("manifest.webmanifest")) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      (await caches.open(SHELL)).put(request, res.clone());
      return res;
    })());
    return;
  }

  // Same-origin API GETs. Catalog lists must be current → network-first (fall back
  // to cache offline). Heavy/derived data (forecast, tides, lore) → stale-while-revalidate.
  if (url.pathname.startsWith("/api/")) {
    const networkFirst = url.pathname === "/api/ports" || url.pathname === "/api/port-areas";
    event.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      if (networkFirst) {
        try {
          const res = await fetch(request);
          if (res.ok) c.put(request, res.clone());
          return res;
        } catch {
          return (await c.match(request)) || Response.error();
        }
      }
      const hit = await c.match(request);
      const network = fetch(request)
        .then((res) => { if (res.ok) c.put(request, res.clone()); return res; })
        .catch(() => hit);
      return hit || network;
    })());
  }
});
