# SailorWind as Alex's sailing hub: spec

_2026-10-26 · branch `claude/planning-brain-0f56b4` · companions: [roadmap-planning-brain.md](roadmap-planning-brain.md), [product-strategy.md](product-strategy.md)_

## 0. Direction

SailorWind becomes Alex's personal all-in-one sailing web app.
- **Personal use only.** No App Store, no native app, no public release. It runs as a PWA on the iPad (Safari, in the cockpit and at the chart table) and on the Mac.
- **What it combines:**
  - charts and map layers;
  - weather layers;
  - route building;
  - passage tracking and the logbook;
  - interesting places around;
  - notes and stories;
  - advice on sails and course.
- **What stays the same:**
  - Navigation stays on the Raymarine Axiom with Navionics. SailorWind plans and records; every depth layer says "not for navigation".
  - The logic stays deterministic. No external LLM: explanations come from templates.
- **What changes for the constraints in [product-strategy.md](product-strategy.md):**
  - The App Store and EU product-liability items go dormant.
  - Data terms still apply. Personal use is non-commercial, which keeps the free tiers of OSM, OpenSeaMap, Open-Meteo and EMODnet usable. Their etiquette still applies: attribution, no bulk download, cache only what you view.

## 1. Screens and navigation

| Screen | URL | Phase | Purpose |
|---|---|---|---|
| Home | `/` | exists | Dashboard: recent passages, live conditions, ports. |
| **Map (hub)** | `/map?p=<passage>&leg=<i>` | **1 ✅** | The main screen on board: chart and weather layers, legs (editable), departure windows, GPX, home berth. |
| Passage | `/p/[id]` | exists | Cockpit: legs, conditions, verdicts. |
| Leg | `/p/[id]/leg/[i]` | exists | Deep planning: timeline, departure windows, tides, GPX import/export. |
| New passage | `/new` | exists | Pick ports and stops. |
| Port | `/port/[slug]` | exists | Marina detail. |
| Log | `/log` | 2 | Track recorder, logbook table, CSV/XLSX export. |
| Places | map layer, `/places/[id]` | 3 | POIs from OSM plus Alex's own. |
| Notes | `/notes`, `/notes/[id]` | 3 | Notes and stories with photos, linked to places and legs. |
| Advice | panel on Map and Leg | 4 | Sail plan and course advice per hour of a leg. |

- `/p/[id]/map` now redirects to `/map?p=[id]`.
- **Navigation:**
  - Top bar: Home · Passage · Map. Log is added in Phase 2 and Notes in Phase 3.
  - At 860 px or less the top-bar links collapse into the bottom tab bar.
  - The map hides the tab bar: it covers the chart, and the map has its own controls.
- **Map screen layout** (touch-first; every control at least 40 px tall):
  - Top left: buttons **Plan**, **Layers** and **Windy**.
  - **Plan** opens a side panel (380 px) with:
    - passage picker;
    - list of legs;
    - selected leg: distance, mode, departure, and **Edit route / Import GPX / GPX / Auto**;
    - **Departure windows**;
    - **whole-passage GPX** and **Save offline**;
    - the home berth.
  - **Layers** opens the layer panel.
  - **Windy** opens a slide-over with the Windy embed, synced to the map view.
  - Bottom centre: the forecast time bar, shown when wind or waves are on.
  - Top centre: the route-edit toolbar (points · NM · land/shallow warnings · Undo · Cancel · Save).
- **Sizes:**
  - **iPad landscape (≈1180×820):** panel left, route fitted to the right of it.
  - **iPad portrait (≈820×1180):** same, with the time bar full-width under the panel.
  - **Phone (≤720 px):** panels become bottom sheets.

## 2. Map layers and data sources

All tile hosts below answered with `Access-Control-Allow-Origin: *` on 2026-10-26. The map therefore loads tiles in CORS mode, and the service worker stores real responses instead of opaque ones. (Chrome counts each opaque response as several MB of quota.)

| Layer | Source | Licence / terms | Attribution shown | Notes |
|---|---|---|---|---|
| **Base: OSM** | `tile.openstreetmap.org/{z}/{x}/{y}.png` | ODbL data; [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/): no bulk download or prefetch, honour caching, valid Referer/UA. | © OpenStreetMap contributors | Default. Personal, light use fits the policy. |
| **Base: Dark** | the same OSM tiles, inverted in CSS (`.lf-dark-tiles`) | as OSM | as OSM | **CARTO's free basemaps (used before) now return an "API KEY REQUIRED" watermark tile for every style and zoom; `voyager/` returns 404 (checked 2026-10-26).** The leg map and the marina mini-map were showing that watermark too; both now use OSM. |
| **Seamarks** | `tiles.openseamap.org/seamark/{z}/{x}/{y}.png` (z ≤ 18) | CC BY-SA 2.0 tiles, ODbL data; no published usage policy, so treat as light use, no prefetch | © OpenSeaMap contributors | On by default. The mini-map previously had no attribution at all; fixed. |
| **Depth shading** | EMODnet Bathymetry `emodnet:mean`, styles `mean_multicolour` / `mean_atlas_land`, served from EMODnet's pre-rendered WMTS: `tiles.emodnet-bathymetry.eu/latest/<style>/web_mercator/{z}/{x}/{y}.png` (z ≤ 14) | CC BY 4.0; no warranty | © EMODnet Bathymetry Consortium (DTM 2024, CC BY 4.0) | Labelled "**~115 m grid, not for navigation**". The WMS (`ows.emodnet-bathymetry.eu/wms`) has the same layer, but it answered 5× 502 and once took 15 s during the check; the WMTS tiles took ~0.5 s. |
| **Depth contours** | EMODnet WMS `emodnet:contours` (default style `contours`) | CC BY 4.0 | as above | WMS only. Slow and flaky, so the toggle shows "tiles not loading" on tile errors. |
| **Isobaths 5–200 m (offline)** | `public/depth-contours.geojson`, self-built from EMODnet | CC BY 4.0 (derived) | as above | Part of the app shell, so it works with no signal. |
| **Wind** | Open-Meteo forecast API, gridded by `/api/weather-grid` | CC BY 4.0; free tier non-commercial | Weather: Open-Meteo.com (CC BY 4.0) | Barbs in kn, coloured by speed; time slider over 4 days; model picker (best match / ECMWF / GFS / ICON). |
| **Waves** | Open-Meteo Marine API (Hs, direction, period), same grid | as above | as above | Cells coloured at the go/no-go bands (2.5 m caution, 3.5 m no-go); Hs labels. No data next to the coast or on land. |
| **Windy** | `embed.windy.com/embed.html` iframe (wind / gusts / waves / swell), opened at the map's view | Windy's free embed widget (no key); Windy's logo and attribution are inside the widget | in the widget | See the note under this table. |
| **Legs** | SailorWind DB (`PassageLegRoute`), via `/api/leg-route` | own data | — | Editable on the map. |
| **Waypoints, approach WPTs, orca rings** | SailorWind DB (ports, `PortArea` approach points from Reeds, orca risk) | own / Reeds-derived (personal use) | — | Orca rings on by default (as the old chart view). |
| **Home berth** | Marina Porto Atlântico (Marina de Leça), **41.18619 N, 8.70474 W** (41°11.171′N 008°42.284′W), OSM `leisure=marina` | — | — | Fixed ⚓ marker. "show" in the Plan panel. |
| **POIs** (Phase 3) | OSM via Overpass API | ODbL | © OpenStreetMap contributors | See §5.3. |
| **Navionics** (optional, later) | Navionics Web API "Standard" | free key; separate embedded chart window; no overlays (per Alex's check, not re-verified here). "Enhanced" (overlays) is paid. | Navionics' own | Reference panel only; build once Alex has a key from garmin.com/forms/navionics-web-api. |

**Why Windy is an embed, not a layer.**
- SailorWind's Windy integration is the **Point Forecast API**. It runs server-side, is rate-limited to one update per 6 h, and the testing key returns shuffled data (product-strategy §4). It cannot paint a map layer, and gridding it would burn the quota at once.
- Windy's **Map Forecast API** is a separate keyed product. Its library brings its own Leaflet map, so it cannot sit under SailorWind's overlays.
- The free embed gives the animated Windy view next to SailorWind's own data layers. Those data layers come from the same Open-Meteo models the cockpit already uses.

**Open-Meteo budget.**
- The free tier allows 10,000 calls/day for non-commercial use.
- Planning assumption: each location in a multi-location request counts as a call.
- The grid is capped at 12×12 nodes per view (step 0.1°–4°, snapped so small pans reuse the same URL). The server caches each grid for an hour, and the service worker keeps the last copy for offline use.
- Typical iPad views are 40–100 nodes. A heavy panning session costs a few hundred calls per API.

## 3. Offline strategy

Rule: **cache what was used, never prefetch areas.** All of it lives in `public/sw.js` (cache version v5).

| What | Strategy | Cache | Limit |
|---|---|---|---|
| App shell: `/`, `/map`, `/offline`, icons, manifest, `depth-contours.geojson`, and **every static file of the build** (`/sw-assets`: JS chunks incl. lazily loaded ones, CSS, fonts) | Precached on install, topped up on each app load; old builds' files dropped | `sw-shell-v5` | ~2.5 MB per build |
| Next static assets (content-hashed) | Cache-first | shell | — |
| Page navigations | Network-first → cached page → same page without query → `/offline` | `sw-runtime-v5` | 400 entries (FIFO) |
| API GETs that must be current: ports, port areas, leg route, GPX export, departure windows, **weather grid** | Network-first, cache fallback offline | runtime | 400 |
| Other API GETs: forecast, tides, lore… | Stale-while-revalidate | runtime | 400 |
| **Saved plans** ("Save offline" in the Plan panel) | The page sends the passage's URLs, built by the same helpers the pages fetch with (`lib/offline-plan.ts`): passage page, map, every leg page and its JS/CSS, leg routes, GPX exports, default departure windows. | `sw-plans-1` | **never trimmed; survives SW updates**; "remove" per plan |
| Map tiles (OSM, OpenSeaMap, EMODnet) | **Only as viewed.** Cache-first. Refreshed in the background when older than 14 days and online. | `sw-tiles-2` | 3,000 tiles (FIFO), ~50–100 MB |
| POSTs (saves, forecast batch) | never cached | — | — |

**Gaps:**
- Pages lazy-load some JS chunks (Leaflet, the maps) that no page HTML lists. `/sw-assets` therefore gives the SW every static file of the build (~95 files, 2.4 MB). They are precached on install and topped up on each app load.
- After a deploy, press "Update offline copy" on saved plans: their pages reference the old build's chunks.
- The forecast offline is the last fetch; the map's weather grid shows "fetched …".
- The leg page's forecast panel loads by POST (`/api/forecast/batch`), so offline it shows "NO DATA". The route, map and tiles still work; checked with the server stopped.
- In dev the SW is off (dev chunk URLs aren't content-hashed, so a cache-first SW served stale code). Set `NEXT_PUBLIC_SW_DEV=1` to test it there.

**iOS / Safari:**
- Home-screen web apps keep their storage; the 7-day eviction applies to Safari tabs. "Save offline" also calls `navigator.storage.persist()`.
- No Background Sync or Periodic Sync, so data written offline (Phase 2+) goes to an IndexedDB outbox. The outbox is replayed on the `online` event and at app start.

**Offline area packs** (a bounding box downloaded for a passage) are **out**. OSM's and OpenSeaMap's policies forbid it from their servers. It would need a self-hosted tile set (e.g. OpenSeaMap's own downloads plus a self-rendered base) — a later, optional piece.

**Prod caveat (deploy, not done here):**
- Prod sits behind Caddy `basic_auth`.
- Chrome fetches the manifest without credentials, so on Chrome/Mac the app may not offer "Install".
- iOS home-screen apps ask for Basic Auth credentials on cold launches.
- Fix in the Caddy config (`groovebye/powerbuilder-systems`): exempt `/manifest.webmanifest`, `/icon.svg`, `/apple-icon.png` and `/sw.js` from `basic_auth`, or move to a cookie session login.
- HTTPS (required for a SW) is already there.

## 4. Data model additions

Already there and reused:
- `PassageExecution` with `…TrackPoint` (lat, lon, SOG, COG, heading, mode, engine, reef), `…Checkpoint` and `…Observation`;
- `execution-debrief.ts` (plan vs actual);
- `NearbyPlace` (curated shore services);
- `PortMemory` / `LegMemory` (short notes);
- `VesselProfile` thresholds: `reef1AtWindKt` 18, `reef2AtWindKt` 24, `reef1AtGustKt` 22, `reef2AtGustKt` 28, `lightAirMotorThresholdKt` 7, `motorsailUpwindThresholdKt` 12, efficiency thresholds.

**Phase 2:**
```prisma
model LogEntry {                       // one row of Alex's logbook
  id          String    @id @default(cuid())
  date        DateTime                 // departure date (local)
  fromName    String
  toName      String
  departureAt DateTime?
  arrivalAt   DateTime?
  distanceNm  Float
  tidalWaters Boolean   @default(false)
  overnight   Boolean   @default(false)
  role        String                   // "Skipper" | "Mate" | "Crew"
  boatName    String                   // section header in the sheet, e.g. "Bossanova"
  boatModel   String?                  // "HR Monsun 31"
  source      String    @default("manual") // "manual" | "track" | "import"
  executionId String?   @unique        // set when produced from a recorded track
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([date])
}
```
- `PassageExecution.passageId` becomes optional, so day sails without a plan can be recorded. Add `distanceNm Float?` and `trackSummary Json?` (simplified polyline for drawing).
- `PassageExecutionTrackPoint` gains `accuracyM Float?` and `source String?` (`"browser-gps"` | `"gpx-import"` | `"signalk"`).

**Phase 3:**
```prisma
model Place {                          // POI cache (OSM) + Alex's own places
  id        String    @id @default(cuid())
  osmType   String?                    // "node" | "way" | "relation"
  osmId     BigInt?
  kind      String                     // "marina" | "anchorage" | "chandlery" | "fuel" | "slipway" | "boatyard" | "water" | "custom"
  name      String?
  lat       Float
  lon       Float
  tags      Json?
  source    String                     // "osm" | "manual"
  fetchedAt DateTime?
  visited   Boolean   @default(false)
  @@unique([osmType, osmId])
  @@index([lat, lon])
}

model Note {                           // notes and stories
  id          String    @id @default(cuid())
  kind        String    @default("note") // "note" | "story"
  title       String?
  body        String                   // markdown
  occurredAt  DateTime?
  lat         Float?
  lon         Float?
  placeId     String?
  passageId   String?
  legIndex    Int?
  executionId String?
  tags        String[]
  photos      Photo[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Photo {
  id       String    @id @default(cuid())
  note     Note      @relation(fields: [noteId], references: [id], onDelete: Cascade)
  noteId   String
  path     String                      // file on the VM volume; thumbnails alongside
  width    Int
  height   Int
  takenAt  DateTime?                   // from EXIF
  lat      Float?                      // from EXIF GPS
  lon      Float?
  caption  String?
}
```
- **ODbL.** `Place` (OSM-derived) stays a separate table from curated data (`NearbyPlace`, marina content). Share-alike only matters if the DB is ever published, but keep the boundary anyway.
- **Photos** go on a Docker volume on the VM; the backup script must include it.

**Phase 4:** no new tables.
- `VesselProfile` gets `motorSogThresholdKt` (roadmap R6).
- Target angles are computed from the polar, not stored.

## 5. Phases

### 5.1 Phase 1 — Map hub ✅ (built on this branch)

**In:**
- `/map` with a layer switcher:
  - base OSM / Dark;
  - seamarks;
  - EMODnet depth shading (two styles) and contours;
  - offline isobaths;
  - orca rings;
  - wind barbs and wave cells with a time slider and model picker;
  - Windy panel.
- Legs of any passage drawn on the map; tap to select.
- **Route editing on the map:**
  - drag points (big touch handles);
  - tap ＋ to insert, tap a point → Delete;
  - Undo / Cancel / Save;
  - the ports stay fixed;
  - live warning where the line crosses land or < 20 m water, checked against the navgrid and ignoring the 3 NM around each port.
- **Leg actions:** Import GPX (OpenCPN / Axiom / Navionics, same fitting as the leg page) · plotter-safe GPX per leg / whole passage · back to the automatic route.
- **Departure windows** in the panel; "Use" sets the leg's departure.
- **Home berth** marker.
- **PWA:**
  - manifest (`id`, `scope`);
  - `viewport-fit=cover` with safe-area padding, so the status bar doesn't cover the top bar in the home-screen app;
  - `100dvh` (Safari toolbars);
  - SW v5 with app shell, saved plans and as-viewed tiles.
- **CARTO → OSM** everywhere (watermark, see §2); OpenSeaMap attribution on every map.

**Out (next, Phase 1.x):**
- A "locate me" button (lands with Phase 2's geolocation).
- Building a new passage from the map: tap ports to add stops; today that's `/new`.
- Moving a shared stop between two legs.
- Ruler / bearing tool.
- Tidal-stream and current layer (Open-Meteo marine `ocean_current_*` is available).
- AIS.
- Offline area packs.

### 5.2 Phase 2 — Passage tracking and logbook

**In:**
- **Recorder** on `/log`: Start / Pause / Stop, writing to a `PassageExecution` (linked to the planned leg if one is chosen).
  - `navigator.geolocation.watchPosition` with `enableHighAccuracy`.
  - A point kept every 30 s or 50 m (whichever first), plus every course change > 20°.
  - Points buffered in IndexedDB and flushed to the server in batches when online.
  - **Screen Wake Lock** keeps the screen on while recording; the iPad lives on a charger in the cockpit.
- **Safari limits, shown in the UI:**
  - Recording works **only while the page is open in the foreground and the screen is on**. A web app gets no background location, and iOS suspends it when locked or switched away. The UI shows a gap marker when points stop and resume.
  - Screen Wake Lock needs Safari 16.4+. In home-screen mode it was unreliable before iOS 18.4, so test on Alex's iPad.
  - **A Wi-Fi-only iPad has no GNSS receiver.** At sea it gets no fix, or a useless Wi-Fi/IP fix. Check which iPad model is on board; a cellular iPad (or iPhone) has GPS.
  - **Alternative source:** a Signal K server (e.g. on a Raspberry Pi with an NMEA 2000 gateway) streaming the Axiom's own GPS, SOG/COG and wind over WebSocket. Browsers can't read raw NMEA TCP/UDP; a Signal K WebSocket works. It is optional, and also feeds Phase 4 with real wind.
- **Plan vs actual:**
  - track over the planned route on the map;
  - cross-track error;
  - ETA delta per checkpoint;
  - motoring time from logged mode;
  - the existing `execution-debrief.ts` summary.
- **Logbook** in Alex's `Logbook.xlsx` format:

  | Column | Field | Notes |
  |---|---|---|
  | A | Date | Excel date |
  | B | From | |
  | C | To | |
  | D | Departure | time (fraction of a day in Excel) |
  | E | Arrival | time |
  | F | NM | |
  | G | Tidal Waters | Y/N |
  | H | Overnight | "Y" or blank |
  | I | Role | Skipper / Mate / Crew |

  - Rows sit under a boat header row such as "Bavaria 38, Noord" (15 boat sections in the current sheet). The sheet ends with a "Total:" row in E with the NM sum in F (6,299 NM, 255 rows).
  - **Auto-fill from a track:**
    - date and times;
    - From/To = nearest catalogued port to the first/last point;
    - NM = track length;
    - Overnight = Y if the track spans civil dusk-to-dawn;
    - Tidal Waters from the ports' tide data;
    - Role defaults to Skipper;
    - boat = Bossanova.
  - Manual entries too.
  - **Import** the existing `Logbook.xlsx` once (header rows → `boatName`).
  - **Export:**
    - **XLSX** in the same layout: boat header rows, Excel dates/times, "Total:".
    - **CSV**, flat with a Boat column.
  - Writer: ExcelJS (MIT). Avoid SheetJS from npm: that copy is stale, and newer versions are only on SheetJS's own CDN.

**Out:**
- Background recording. That is impossible for a web app on iOS; it would need a native app, which is out of scope.
- Live tracking for others to follow.
- Engine-hours log (the maintenance table exists; a later small item).

### 5.3 Phase 3 — Knowledge: places, notes, stories

**In:**
- **POIs via Overpass** (server-side proxy with a 30-day cache in `Place`; the existing `/api/seamarks` shows the pattern).
  - Fetched per bbox only on demand, when the map is zoomed in (z ≥ 10); never coast-wide sweeps.
  - Within the public instances' limits (about 10k queries/day; keep queries small and cached).
  - Tags to validate on the Portuguese coast:
    - marinas: `leisure=marina`, `seamark:type=harbour` + `seamark:harbour:category=marina`;
    - anchorages: `seamark:type=anchorage`;
    - chandleries: `shop=ship_chandler`, `shop=boat`, `seamark:small_craft_facility:category=chandler`;
    - fuel: `waterway=fuel`, `seamark:small_craft_facility:category=fuel_station`;
    - also `leisure=slipway`, `craft=boatbuilder` / `industrial=shipyard`, `amenity=drinking_water` near marinas.
  - Map layer "Places" with kind filters, and a place sheet: OSM tags, distance from the route, Alex's notes, visited.
- **Notes and stories:**
  - markdown text;
  - photos (upload from the iPad; EXIF time and GPS place them on the map, via exifr (MIT));
  - linked to a place, a leg or a recorded passage.
  - A story is a note with a cover photo and a date range, shown on a timeline.
- `PortMemory` / `LegMemory` stay as the short structured notes the planner reads; stories are the long form.

**Out:**
- Sharing or publishing stories.
- Social features.
- Reviews from third-party sites (terms).

### 5.4 Phase 4 — Advice (deterministic)

**In:**
- **Sail plan per hour of a leg.**
  - Inputs: the timeline engine's TWS, gust and TWA, plus the profile thresholds:
    - reef 1 at 18 kn (gust 22);
    - reef 2 at 24 kn (gust 28);
    - motor below 7 kn in light air;
    - motor-sail upwind at 12 kn and above;
    - efficiency thresholds 40 / 55 %.
  - Output: "full main + genoa / reef 1 / reef 2 + partly furled genoa / motor-sail / motor", with the rule that fired.
- **Course advice:**
  - **target TWA upwind and downwind** = max VMG from the polar at each TWS;
  - expected VMG versus motoring;
  - **tack/gybe timing:** favoured tack from forecast veers and backs along the leg, lay lines to the next waypoint, and how far before a shift to tack.
- **Explanations from templates:** "TWS 16 kn, gusts 21 → reef 1 (threshold 18/22). Close-hauled VMG 3.9 kn < motor-sail 5.2 kn → motor-sail."
- **Where it shows:** a panel on the Map (selected leg, at the time-slider hour) and a column in the leg timeline.
- **Later:** calibrate from Phase 2 tracks (roadmap R9/R10).

**Out:** any LLM, and any "autopilot" output.

### 5.5 Optional — Navionics reference panel

- **Navionics Web API "Standard":** free; an embedded Navionics chart in its own window; overlays not allowed. Alex requests a developer key via garmin.com/forms/navionics-web-api. Terms as Alex reported them; re-read when the key arrives.
- **Plan:** a "Navionics" slide-over like the Windy one, opened at the hub map's view. It is a reference for the same charts as on the Axiom, not a layer.
- **Paid "Enhanced" tier** (overlays): not planned.

## 6. Open questions for Alex

1. Which iPad is on board — Wi-Fi only or cellular (GPS)? This decides whether Phase 2 needs Signal K.
2. Logbook master: does SailorWind become the master, with the XLSX as export only, or stay a feeder into the sheet?
3. Engine threshold (roadmap R6): 4.5 kn SOG under sail or OpenCPN's 3.5 kn VMG?
4. Deploy: OK to change the Caddy config so the PWA installs cleanly (§3, prod caveat)?
