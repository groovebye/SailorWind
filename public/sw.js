/* SailorWind service worker — offline support for use at sea (no signal).
 * Strategy (docs/spec-sailing-hub.md §3):
 *  - app shell (/, /map, /offline) and every static file of the current build
 *    (/sw-assets, incl. lazily loaded chunks): precached on install, topped up
 *    on each app load
 *  - navigations: network-first → cached page → same page without query → /offline
 *  - Next static assets: cache-first (content-hashed)
 *  - same-origin GET /api/*: stale-while-revalidate (forecast, tides, lore), except
 *    NETWORK_FIRST paths that must be current (catalog, leg route, GPX export,
 *    departure windows, weather grid) — those fall back to cache only offline
 *  - saved plans ("Save offline" on the map): pages + API GETs of one passage in
 *    PLANS, which is never trimmed and survives SW updates
 *  - map tiles: cached only as they are viewed (never prefetched), CORS mode so
 *    responses are real (non-opaque), capped, refreshed in the background
 *    after TILE_REFRESH_MS when online
 *  POSTs are never cached.
 */
const VERSION = "v5";
const SHELL = `sw-shell-${VERSION}`;
const RUNTIME = `sw-runtime-${VERSION}`;
const TILES = "sw-tiles-2"; // v1 held opaque responses; CORS tiles need a fresh cache
const PLANS = "sw-plans-1";
const KEEP = new Set([SHELL, RUNTIME, TILES, PLANS]);
const TILE_MAX = 3000;
const RUNTIME_MAX = 400;
const TILE_REFRESH_MS = 14 * 24 * 3600 * 1000;
const SHELL_PAGES = ["/", "/map", "/offline"];
const SHELL_FILES = ["/icon.svg", "/manifest.webmanifest", "/depth-contours.geojson"];
const NETWORK_FIRST = new Set([
  "/api/ports", "/api/port-areas", "/api/leg-route", "/api/export", "/api/departure-windows", "/api/weather-grid",
]);

const TILE_HOSTS = [
  "tile.openstreetmap.org", "openseamap.org",
  "tiles.emodnet-bathymetry.eu", "ows.emodnet-bathymetry.eu",
];
const isTile = (url) => TILE_HOSTS.some((h) => url.hostname.endsWith(h));
const isStatic = (url) =>
  url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon") || url.pathname.startsWith("/apple-icon") ||
  url.pathname.endsWith("manifest.webmanifest") || url.pathname === "/depth-contours.geojson";

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
}

const fromCache = (request, opts) => caches.match(request, { ignoreVary: true, ...opts });

/** Assets a page's HTML needs to boot: Next chunks, CSS, fonts, icons. */
function pageAssets(html) {
  const out = new Set();
  const re = /(?:src|href)="(\/(?:_next\/static\/[^"]+|apple-icon[^"]*|icon[^"]*|favicon[^"]*))"/g;
  for (let m; (m = re.exec(html)); ) out.add(m[1].replace(/&amp;/g, "&"));
  return [...out];
}

/** Fetch a page, store it and the assets its HTML references. */
async function cachePage(cache, url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  await cache.put(url, res.clone());
  const assets = pageAssets(await res.text());
  await Promise.allSettled(assets.map(async (a) => {
    if (await fromCache(a)) return;
    const r = await fetch(a);
    if (r.ok) await cache.put(a, r);
  }));
}

/**
 * Every static file of the current build (/sw-assets), so chunks that pages
 * load lazily (the maps) are there offline too. Files of older builds leave
 * the shell cache; saved plans keep the ones their pages reference.
 */
async function precacheStatic() {
  let list;
  try {
    const r = await fetch("/sw-assets", { cache: "no-store" });
    if (!r.ok) return;
    list = await r.json();
  } catch {
    return;
  }
  if (!list.files || !list.files.length) return;
  const c = await caches.open(SHELL);
  const want = new Set(list.files);
  for (const req of await c.keys()) {
    const p = new URL(req.url).pathname;
    if (p.startsWith("/_next/static/") && !want.has(p)) await c.delete(req);
  }
  const missing = [];
  for (const f of list.files) if (!(await c.match(f))) missing.push(f);
  await Promise.allSettled(missing.map(async (f) => {
    const r = await fetch(f);
    if (r.ok) await c.put(f, r);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.allSettled(SHELL_FILES.map((u) => c.add(u)));
    await Promise.allSettled(SHELL_PAGES.map((u) => cachePage(c, u)));
    await precacheStatic();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Saved plans: the page sends the passage's URLs (lib/offline-plan.ts).
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  const port = event.ports && event.ports[0];
  if (msg.type === "precache") {
    event.waitUntil(precacheStatic()); // sent on each app load: picks up a new deploy's files
  } else if (msg.type === "save-plan" && Array.isArray(msg.urls)) {
    event.waitUntil((async () => {
      const c = await caches.open(PLANS);
      let ok = 0;
      const failed = [];
      for (const u of msg.urls) {
        try {
          if (u.startsWith("/api/")) {
            const r = await fetch(u, { credentials: "same-origin" });
            if (!r.ok) throw new Error(String(r.status));
            await c.put(u, r);
          } else {
            await cachePage(c, u);
          }
          ok++;
        } catch {
          failed.push(u);
        }
      }
      if (port) port.postMessage({ savedAt: Date.now(), ok, failed });
    })());
  } else if (msg.type === "drop-plan" && Array.isArray(msg.urls)) {
    event.waitUntil((async () => {
      const c = await caches.open(PLANS);
      await Promise.all(msg.urls.map((u) => c.delete(u)));
      if (port) port.postMessage({ ok: true });
    })());
  }
});

let tilePuts = 0;
async function putTile(cache, request, res) {
  // Re-wrap with the time we stored it: CORS responses don't expose Date.
  const body = await res.blob();
  const headers = new Headers({ "Content-Type": res.headers.get("Content-Type") || "image/png", "sw-cached-at": String(Date.now()) });
  await cache.put(request, new Response(body, { status: 200, headers }));
  if (++tilePuts % 50 === 0) trim(TILES, TILE_MAX);
}

async function tile(request) {
  const c = await caches.open(TILES);
  const hit = await c.match(request);
  if (hit) {
    const at = Number(hit.headers.get("sw-cached-at") || 0);
    if (Date.now() - at > TILE_REFRESH_MS) {
      fetch(request).then((r) => (r.ok && r.type !== "opaque" ? putTile(c, request, r) : null)).catch(() => {});
    }
    return hit;
  }
  try {
    const res = await fetch(request);
    if (res.ok && res.type !== "opaque") putTile(c, request, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

async function navigate(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const c = await caches.open(RUNTIME);
      await c.put(request, res.clone());
      trim(RUNTIME, RUNTIME_MAX);
    }
    return res;
  } catch {
    return (await fromCache(request)) || (await fromCache(request, { ignoreSearch: true })) ||
      (await fromCache("/offline")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (isTile(url)) { event.respondWith(tile(request)); return; }
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") { event.respondWith(navigate(request)); return; }

  if (isStatic(url)) {
    event.respondWith((async () => {
      const hit = await fromCache(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) (await caches.open(SHELL)).put(request, res.clone());
      return res;
    })());
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const networkFirst = NETWORK_FIRST.has(url.pathname);
    event.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      if (networkFirst) {
        try {
          const res = await fetch(request);
          if (res.ok) { c.put(request, res.clone()); trim(RUNTIME, RUNTIME_MAX); }
          return res;
        } catch {
          return (await fromCache(request)) || Response.error();
        }
      }
      const hit = await fromCache(request);
      const network = fetch(request)
        .then((res) => { if (res.ok) c.put(request, res.clone()); return res; })
        .catch(() => hit || Response.error());
      return hit || network;
    })());
  }
});
