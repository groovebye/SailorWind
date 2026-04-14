# SailorWind — Weather-Aware Passage Planner

Веб-приложение для планирования парусных переходов с прогнозом погоды и системой GO/CAUTION/NO-GO.

**Лодка:** Bossanova (Hallberg-Rassy Monsun 31, осадка 1.5м)
**Маршрут:** Gijon (Испания) -> Греция, multi-year voyage

### Current Status (v1.2)

| Component | Coverage | Details |
|-----------|----------|---------|
| **Route waypoints** | 19 ports + 3 capes | Gijón→La Coruña, 160 NM |
| **Port areas** | 8 PortAreas | Multi-marina content layer |
| **Marinas** | 10 MarinaOptions | La Coruña has 2 (Marina Coruña + RCN) |
| **Marina pricing** | 27 prices | LOA 9.5m, daily/monthly, low/high season |
| **Marina maps** | 25 GeoJSON features | Point/LineString/Polygon support |
| **Nearby places** | 23 NearbyPlaces | Restaurants, chandlery, grocery, pharmacy, ATM |
| **Weather** | Open-Meteo + Windy | ECMWF/GFS/ICON/AROME + gfsWave, cached in DB |
| **Tides** | 18 ports | Semi-diurnal harmonic model, ~15-30 min accuracy |
| **Leg guides** | 5 legs | Pilotage, milestones, hazards, fallbacks, tidal gates |
| **Route geometry** | Graph (64 nodes, 61 edges) + manual overrides | Dijkstra + per-leg manual route editing |
| **Orca zones** | 2 zones | Galicia coast (medium), Finisterre (high) |
| **Comfort scoring** | Per-leg + per-segment | Waves/swell/gusts/capes/duration/night penalties |
| **Execution** | Start/stop/checkpoints/observations | Live passage tracking + logbook |
| **Vessel profile** | Bossanova (HR Monsun 31) | Performance model for timeline computation |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4 |
| ORM | Prisma 7 with `@prisma/adapter-pg` driver adapter |
| Database | PostgreSQL 17 (Alpine) |
| Map | Leaflet + react-leaflet (dynamic import, no SSR) |
| Font | JetBrains Mono |
| Theme | Dark/Light toggle (CSS variables + ThemeProvider context) |
| Deploy | Docker multi-stage build, nginx reverse proxy |
| Server | Hetzner CX23 (x86, Nuremberg, Ubuntu) |
| Weather API | Open-Meteo (free) + Windy Point Forecast (GFS + gfsWave) |
| Tides | Semi-diurnal harmonic model (HW Dover + port offsets) |
| Bathymetry | EMODnet (free GeoTIFF via WCS) |
| Chart overlay | OpenSeaMap tiles + local GeoJSON contours (5-200m) |
| Webcams | Windy Webcams API v3 |
| Routing | Coastal graph (64 nodes, 61 edges, Dijkstra) + manual overrides |
| Vessel model | VesselProfile with performance heuristics |
| Execution | Live passage tracking with checkpoints + observations |

---

## Project Structure

```
sailplanner-next/
├── prisma/
│   ├── schema.prisma          # DB schema (Port, Passage, PassageWaypoint, LegGuide)
│   ├── seed.ts                # Curated ports + arrival / shore-service enrichment
│   ├── leg-guides.ts          # Curated passage plans / hazards / fallback content
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (ThemeProvider, JetBrains Mono)
│   │   ├── globals.css        # CSS variables for dark/light themes
│   │   ├── page.tsx           # Home — list recent passages
│   │   ├── new/page.tsx       # Passage wizard (2-step: route -> waypoints)
│   │   ├── p/[id]/
│   │   │   ├── page.tsx       # Passage dashboard (forecasts, verdicts, filters, day/leg tiles)
│   │   │   ├── leg/[legIndex]/
│   │   │   │   ├── page.tsx   # Detailed leg brief page
│   │   │   │   └── LegMap.tsx # Leg map with route geometry + contours + OpenSeaMap
│   │   │   └── map/
│   │   │       ├── page.tsx   # Map page (fetches passage + forecasts, computes ETAs)
│   │   │       └── PassageMap.tsx  # Leaflet map component
│   │   └── api/
│   │       ├── ports/route.ts          # GET /api/ports
│   │       ├── forecast/route.ts       # GET /api/forecast
│   │       ├── forecast/batch/route.ts # POST /api/forecast/batch
│   │       ├── leg/route.ts            # GET /api/leg (curated leg guide)
│   │       └── passage/route.ts        # CRUD: GET/POST/PATCH/DELETE
│   ├── lib/
│   │   ├── db.ts              # Prisma client (singleton with pg adapter)
│   │   ├── weather.ts         # Open-Meteo client, cache, GO/NO-GO logic
│   │   ├── theme.tsx          # ThemeProvider context (dark/light, localStorage)
│   │   ├── coastline.ts       # Simplified offshore corridor + port/ría approaches
│   │   └── nanoid.ts          # Short ID generator (8 chars)
│   └── generated/prisma/      # Generated Prisma client (gitignored)
├── public/data/
│   ├── routes.json            # Legacy pre-computed pair routes (kept for reference)
│   └── contours.json          # Depth contour GeoJSON (5/10/20/50/100/200m)
├── scripts/
│   └── gen-route-data.py      # Route + contour generator from EMODnet bathymetry
├── Dockerfile                 # Multi-stage: deps -> build -> standalone
└── next.config.ts             # output: "standalone"
```

---

## Map System — Route Generation

### Overview

The map displays sailing routes between ports with weather data overlays. Route geometry is built at runtime from a hand-authored coastal routing graph in `src/lib/coastline.ts`, while EMODnet data is still used for contour overlays.

### Architecture

```
EMODnet GeoTIFF (WCS download)
        ↓
 scripts/gen-route-data.py     ← offline contour generator
        ↓
 public/data/contours.json     ← depth contour lines

src/lib/coastline.ts           ← routing graph (headlands, offshore legs, port/ría branches)
        ↓
 PassageMap.tsx                ← builds leg geometry at runtime
```

### Data Source: EMODnet Bathymetry

Downloaded via WCS (Web Coverage Service):
```bash
curl -o /tmp/emodnet.tiff "https://ows.emodnet-bathymetry.eu/wcs?\
service=WCS&version=1.0.0&request=GetCoverage&coverage=emodnet:mean&\
crs=EPSG:4326&BBOX=-8.5,43.3,-5.5,43.9&format=image/tiff&\
interpolation=nearest&resx=0.002&resy=0.002"
```

- **Grid:** 300 rows x 1500 cols
- **Resolution:** ~0.002 deg = ~200m per pixel
- **Values:** negative = depth below sea (e.g. -15.0 = 15m deep), 0 or positive = land
- **Coverage:** lat 43.3-43.9, lon -8.5 to -5.5 (N Spain coast)

### CRITICAL ISSUE: Ports Are On Land

At ~200m resolution, **all ports resolve to land pixels** (depth=0) in the EMODnet grid. This is because harbors, marinas, and pier areas are within 200m of shore. This breaks any routing algorithm that starts from port coordinates.

**Current workaround:** `find_sea_point()` projects each port to the nearest "deep sea" pixel (depth < -12m, with 8m+ depth in all neighboring cells). This typically places the sea point 0.5-1.5 NM offshore from the port.

### Legacy Route Generator (`scripts/gen-route-data.py`)

This script describes the old experimental pair-by-pair route generation based directly on bathymetry. It is still useful context for why the original routes produced zigzags, but the live map now uses the hand-authored routing graph in `src/lib/coastline.ts`.

**Class: `DepthGrid`** — loads the GeoTIFF and provides:
- `depth_at(lat, lon)` → float (negative = depth, 0 = land)
- `is_sea(lat, lon)` → True if depth < -3m
- `is_deep_sea(lat, lon)` → True if depth < -8m AND all 8 neighbors are sea
- `find_sea_point(lat, lon)` → nearest (lat, lon) with depth < -12m
- `line_hits_land(lat1, lon1, lat2, lon2)` → None if clear, or (lat, lon, fraction) of first land obstacle midpoint
- `find_bypass(land_lat, land_lon, ...)` → (lat, lon) of a safe waypoint to go around the obstacle

**Function: `build_route(grid, port_start, port_end)`**

```
1. Project ports to sea points: find_sea_point(port) → sea_point
2. Start with path = [sea_start, sea_end]
3. Loop up to 15 iterations:
   a. For each segment in path:
      - Check if segment crosses land (line_hits_land)
      - If clear: keep segment
      - If land hit: find bypass waypoint, insert into path
   b. If no changes: converged, break
4. Prepend port_start, append port_end
5. Deduplicate close points
```

**Known problems with current algorithm:**

1. **`find_bypass` picks shortest-to-deep-water direction** — this often means the bypass point is just barely past the coast edge. When the route has multiple land crossings (e.g. a peninsula), each gets a separate bypass, creating zigzag patterns instead of a clean arc around the whole peninsula.

2. **`line_hits_land` returns the MIDDLE of the first land block** — if a line crosses multiple separate land masses, only the first one is found per iteration. Subsequent crossings are resolved in later iterations, but each new bypass may create new crossings.

3. **No concept of "headland rounding"** — the algorithm doesn't understand that Cabo Peñas is a single headland that should be rounded with ONE clean arc. Instead it treats each land pixel intersection independently.

4. **No awareness of route direction** — bypass doesn't know if we're going E→W or W→E, so it may place waypoints on the wrong side of a headland (the side we came from, not the side we're going to).

5. **Deep rías (fjords) break the algorithm** — Ferrol, La Coruña, Viveiro are deep inside rías. The algorithm can't find a connected sea path because the ría entrance is narrow and gets lost in iterative bypassing. These use hardcoded manual routes.

**Manual routes** are defined in `MANUAL_ROUTES` dict for:
- Cedeira → Ferrol (deep ría)
- Ferrol → La Coruña (deep ría + complex coastline)
- Ribadeo → Foz (ría entrance issue)
- Foz → Viveiro (deep ría)

### Contour Generation

Depth contours are generated via GDAL:
```bash
gdal_contour -a depth -fl -200 -100 -50 -20 -10 -5 emodnet.tiff contours.geojson -f GeoJSON
```

Produces GeoJSON with LineString features, each with `depth` property (made positive for display: 5, 10, 20, 50, 100, 200).

### Map Client: PassageMap.tsx

**Tile layers (bottom to top):**
1. CartoDB Dark/Voyager base map (theme-aware)
2. EMODnet mean_multicolour WMS (colored depth shading, 20-35% opacity)
3. EMODnet contours WMS (50m+ interval lines from WMS)
4. Local contour GeoJSON overlay (5/10/20m lines from `contours.json`)
5. OpenSeaMap tiles (buoys, lights, marks)
6. Route polylines
7. Waypoint CircleMarkers with Popups

**Contour line colors:**
| Depth | Color | Weight |
|-------|-------|--------|
| 5m | Red (#ef4444) | 1.5px solid |
| 10m | Orange (#f97316) | 1.2px solid |
| 20m | Yellow (#eab308) | 1px dashed |
| 50m | Gray (#94a3b8) | 0.8px dashed |
| 100m | Dark gray (#64748b) | 0.6px dashed |
| 200m | Darker (#475569) | 0.5px dashed |

**Route rendering:**

The visible route line is built as a master route for the whole passage. Geometry uses:
- first passage point
- cape waypoints
- final passage point

The model is intentionally explicit:
- nodes are placed at headlands, offshore turning points, and port/ría entry points
- edges define the allowed safe connections between those nodes
- `buildSeaRoute()` runs shortest-path routing on that graph
- for especially tricky headland corridors, `buildSeaRoute()` can override the graph with a handcrafted passage geometry
- intermediate marinas and ports remain ETA/weather markers, but they do not bend the route line
- this keeps each cape rounded once on the correct side instead of chaining many pairwise stop-to-stop sub-routes

### Handcrafted Headland Corridors

Some coastal sections are too nuanced for a sparse generic graph. In those places the live map uses manually authored passage geometry with a few deliberate turning points:

- harbor exit / entry points stay aligned with the breakwater or channel
- the cape is rounded at one dedicated offshore point, not at the lighthouse tip itself
- long legs are kept as single straight offshore segments where practical

The first explicit corridor of this kind is `Cudillero/Avilés -> Cabo Peñas -> Candás/Gijón`. It is drawn from fixed safe-looking passage points instead of a raw shortest-path across the graph.

### Leg Brief Pages

Day/leg tiles on the passage dashboard open a dedicated leg brief page. That page currently provides:

- route header with difficulty and summary
- operational verdict (`GO / CAUTION / NO-GO`) using sampled forecast along the leg
- detailed `Passage Plan` points (departure, observation points, capes, approach, berth)
- hazards and fallback ports
- a leg map using the same runtime routing graph as the main map
- arrival block with marina contacts, facilities and verification metadata
- shore-side enrichment: restaurants, provisioning, yacht shops, practical services

### Tidal Data

All N Spain ports are **semi-diurnal** (2 HW / 2 LW per day). Curated tidal reference data per port:

| Port | Spring Range | Neap Range | HW ref (vs Dover) | Stream notes |
|------|-------------|-----------|-------------------|-------------|
| Gijón | ~4.9m | ~2.5m | +5h30m | <0.5kt coast, 1kt at Cabo Peñas |
| Avilés | ~4.9m | ~2.5m | +5h35m | Ría ebb 1-2kt in channel |
| Luarca | ~4.5m | ~2.3m | +5h40m | Negligible |
| Ribadeo | ~3.7m | ~1.9m | +5h50m | Ría entrance 1-2kt springs |
| Viveiro | ~3.5m | ~1.8m | +5h55m | Ría mouth 0.5-1kt springs |
| Cedeira | ~4.4m | ~2.2m | +6h00m | Negligible |
| Ferrol | ~4.4m | ~2.2m | +5h45m | Ría entrance 0.5-1kt |
| La Coruña | ~5.0m | ~2.5m | +5h40m | Harbor <0.3kt |

**Critical tidal streams:**
- **Estaca de Bares**: up to 2kt on springs. E-going flood HW Dover -5h to +1h.
- **Cabo Ortegal**: up to 2kt on springs. Complex seabed = unpredictable.
- **Wind against tide at capes = DANGEROUS breaking seas.**

**Future integration:** WorldTides API (worldtides.info) for live HW/LW predictions. Currently curated text only.

### Weather Sources

| Source | Data | Model | Cost |
|--------|------|-------|------|
| Open-Meteo Weather | Wind, gusts, precip, clouds | ECMWF, GFS, ICON, AROME | Free |
| Open-Meteo Marine | Waves, swell (height/period/dir) | ERA5 marine | Free, ~9 day range |
| Windy GFS | Wind, gusts, precip, clouds, temp | GFS | Free (API key required) |
| Windy gfsWave | Waves, swell 1+2 | GFS Wave | Free (same key), full 10-day |

**Windy API key:** stored in `WINDY_API_KEY` env var. Free tier = GFS + gfsWave only (no ECMWF).

**Marine data gap:** Open-Meteo marine forecast is ~9 days. Beyond that, wave/swell columns show "—" with "(no wave data)" in verdict. Windy gfsWave covers full 10 days.

**Offshore coordinate shift:** Ports inside rías return null from marine APIs (resolved as land in ~5km grid). Fix: marine API calls shift lat +0.05° (~3NM north) into open water.

### Orca Information

Orca interaction zones are curated from Orca Ibérica / GTOA advisory data:
- **Galicia coast** (42.5-43.5°N, 7.5-9.5°W): medium risk
- **Cape Finisterre** (42.5-43.0°N, 8.8-9.5°W): high risk
- Displayed as semi-transparent rectangles on leg maps
- GT Orcas app recommended for real-time tracking

Important current limitations:

- Tides are curated reference text, not yet live HW/LW for the selected departure date
- Orca data is advisory; no public live API integration yet
- Shore-service enrichment is curated for Gijón → La Coruña and should be rechecked in season

**Leg rendering:**
- The master route is split visually only at route-defining anchors (typically capes)
- Segment color = worst verdict among all waypoints in that coastline interval:
  - Green (#4ade80) = all GO
  - Yellow (#facc15) = any CAUTION
  - Red (#f87171) = any NO-GO

**Waypoint popups contain:**
- Port name, type, region, country
- ETA with local timezone
- Forecast at ETA: wind, gusts, waves, swell, verdict
- 24h mini-forecast grid (up to 8 time slots)
- Facilities: fuel, water, electric, repairs, customs
- Shelter quality (color-coded: good/moderate/poor)
- Max draft, VHF channel
- Phone (clickable tel: link), website
- Notes, coordinates

### Ideal Routing Algorithm (Not Yet Implemented)

The current visibility-graph bypass approach produces zigzag routes around headlands. An ideal algorithm would:

1. **Detect headlands** from coastline geometry (prominence analysis):
   - Walk along depth=0 contour
   - For each point, measure perpendicular distance to baseline between neighbors
   - Local maxima = headland tips

2. **Place rounding waypoints** at each headland:
   - From headland tip, push outward along normal vector
   - Find point at ~10m depth with safety clearance
   - This gives ONE clean rounding point per headland

3. **Route as straight lines between rounding points:**
   - Port → nearest headland WP → next headland WP → ... → destination port
   - Each segment is a straight line verified clear of land
   - Result: minimal waypoints, clean courses, like real sailing navigation

4. **Handle rías** separately:
   - Detect narrow ría entrances
   - Route in/out of rías with entrance/exit waypoints
   - Main route stays offshore between ría entrances

---

## Business Logic

### Passage Creation Wizard (`/new`)

**Step 1 — Route:**
- User selects From/To ports (dropdowns, excludes capes)
- Sets departure datetime, speed (kt), mode (daily/nonstop), weather model
- Default departure: tomorrow 08:00

**Step 2 — Waypoints:**
- All ports between From and To shown (ordered by `coastlineNm`)
- Auto-checked: start, end, capes, marinas
- User toggles intermediate stops
- Legs computed dynamically: distance (NM), time (hours), warnings for >50 NM or >10h legs

### Passage Dashboard (`/p/[id]`)

**Editable Filters (auto-save with 500ms debounce):**
- Departure datetime, Speed (kt), Mode (daily/nonstop), Weather Model

**Schedule Computation:**
- `daily` mode: each leg starts at departure hour, next day after arrival
- `nonstop` mode: next leg starts immediately after arrival
- ETA for intermediate waypoints: linear interpolation by `coastlineNm`

**Timezone:** computed from port longitude:
- lon -10..3 → Europe/Madrid
- lon 3..15 → Europe/Rome
- lon 15..30 → Europe/Athens

**Time format:** `en-GB` locale, "at" removed (e.g. "Sun 12 Apr 11:00")

### Weather Data (`src/lib/weather.ts`)

**APIs (no auth):**
- Weather: `api.open-meteo.com/v1/forecast` — wind, gusts, precip, clouds, WMO codes
- Marine: `marine-api.open-meteo.com/v1/marine` — waves, swell

**Sequential requests** with retry/backoff (avoid 429 rate limiting).

**GO/NO-GO Thresholds:**

| Parameter | Normal | Cape |
|-----------|--------|------|
| Wind CAUTION | >20 kt | >15 kt |
| Wind NO-GO | >30 kt | >25 kt |
| Gust NO-GO | >35 kt | >30 kt |
| Wave CAUTION | >2.5 m | >2.0 m |
| Wave NO-GO | >3.5 m | >3.0 m |

### Port Data

17 ports seeded from Gijón to La Coruña. Each port has:
- Position (lat/lon), type (marina/port/anchorage/cape)
- `coastSegment` + `coastlineNm` — for ordering and distance calculation
- Facilities: fuel, water, electric, repairs, customs (boolean flags)
- Metadata: shelter (good/moderate/poor), maxDraft (m), vhfCh, website
- Notes with phone numbers (e.g. "Tel: +34 985 344 543")

### Theme System

`ThemeProvider` in `src/lib/theme.tsx`:
- Stores preference in localStorage
- Toggles `dark` class on `<html>`
- CSS variables in `globals.css` for all colors
- Map tiles switch between CartoDB Dark and Voyager

---

## Infrastructure

### Server: Hetzner CX23
- **IP:** `178.104.144.13`
- **Domain:** `sailorwind.com` (Namecheap, A records → server IP)
- **SSL:** Let's Encrypt via certbot, auto-renewal
- **SSH:** `ssh root@sailorwind.com`

### Nginx
- Reverse proxy: HTTPS → localhost:3000
- HTTP Basic Auth: user `sailor`, password `bossanova`

### Docker Compose (`/opt/sailorwind/docker-compose.yml`)

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: sailplanner
      POSTGRES_USER: sailor
      POSTGRES_PASSWORD: sw_db_2026!secure

  app:
    build: ./app
    ports: ["127.0.0.1:3000:3000"]
    environment:
      DATABASE_URL: "postgresql://sailor:sw_db_2026!secure@db:5432/sailplanner"
```

### Deploy Workflow

```bash
# Local
cd ~/Projects/sailplanner-next
git add . && git commit -m "..." && git push

# Server
ssh root@sailorwind.com
cd /opt/sailorwind/app && git pull origin main
cd /opt/sailorwind && docker compose up --build -d
```

### Regenerate Route Data

Requires: Python 3, GDAL, numpy, shapely, rasterio

```bash
# 1. Download bathymetry (one-time, cached in /tmp)
curl -o /tmp/emodnet.tiff "https://ows.emodnet-bathymetry.eu/wcs?..."

# 2. Generate routes + contours
cd sailplanner-next
python3 scripts/gen-route-data.py

# 3. Commit and deploy
git add public/data/ && git commit -m "update routes" && git push
# then deploy on server
```

---

---

## Data Architecture

### Two-Layer Model

**Route Layer** (`Port` model) — operational waypoints for passage engine:
- 19 ports + 3 capes along the coast
- `coastlineNm` for ordering and distance computation
- Weather forecast points
- **Do not use for content display** — use PortArea instead

**Content Layer** (`PortArea` → `MarinaOption` → `NearbyPlace`) — rich marina/shore data:
- `PortArea` = geographic stopover (city/harbor area)
- `MarinaOption` = specific marina within area (facilities, pricing, approach)
- `MarinaPrice` = per-LOA/season/period pricing with source verification
- `MarinaMapFeature` = GeoJSON features for marina mini-maps
- `NearbyPlace` = restaurants, chandlery, grocery, pharmacy, ATM with distances/ratings

### Prisma Models Summary

| Model | Purpose | Count |
|-------|---------|-------|
| `Port` | Route waypoints | 22 |
| `Passage` | Planned passages | dynamic |
| `PassageWaypoint` | Stops/capes in passage | dynamic |
| `LegGuide` | Curated pilotage knowledge per leg | 5 |
| `VesselProfile` | Boat performance model | 1 (Bossanova) |
| `LegComputation` | Cached timeline computation | dynamic |
| `PortArea` | Stopover area (content) | 8 |
| `MarinaOption` | Specific marina | 10 |
| `MarinaPrice` | Pricing per LOA/season | 27 |
| `MarinaMapFeature` | Mini-map GeoJSON | 25 |
| `NearbyPlace` | Shore services with distances | 23 |
| `PassageLegRoute` | Manual route overrides | dynamic |
| `PassageLegRoutePoint` | Manual route waypoints | dynamic |
| `PassageExecution` | Live passage tracking | dynamic |
| `PassageExecutionTrackPoint` | GPS track | dynamic |
| `PassageExecutionCheckpoint` | Events (departure/cape/reef/arrival) | dynamic |
| `PassageExecutionObservation` | Observed conditions + comfort | dynamic |

---

## Leg Page Architecture

The leg detail page (`/p/[id]/leg/[legIndex]`) is the primary operational interface.

### Sections (top to bottom)

1. **Sticky Bar** — route name, verdict badge, wind/waves, Quick/Full toggle, print button
2. **Header** — leg name, difficulty badge, description
3. **Decision Summary** — GO/CAUTION/NO-GO, 4-column grid (Monitor/Sailing/Fallback/Comfort), score breakdown, last safe departure, plan invalidation triggers
4. **Best Window + Orca Alert**
5. **Map** — Leaflet with route (auto or manual), contours, OpenSeaMap, hazard markers, milestone markers, orca zones. Edit mode for manual routing.
6. **Passage Timeline** — hourly breakdown from `passage-computation.ts`
7. **Pilotage Notes** — markdown sections (Full mode only)
8. **Passage Plan** — milestones with ETA, bearing, visual references
9. **Hazards** — severity-colored cards
10. **Tides & Currents** — live HW/LW predictions + streams + tidal gates
11. **Fallback Plan** — bail-out ports
12. **Arrival** — marina details + entrance/waiting/tide/swell intelligence
13. **Marina Options** — comparison table + cards with pricing
14. **Shore Services** — NearbyPlace cards by category (restaurants, chandlery, grocery, etc.)
15. **Webcams** — Windy API (Full mode only)
16. **Execution & Logbook** — start/stop passage, checkpoints, observations, planned vs actual
17. **Emergency Contacts**

### View Modes

- **Quick** — Decision, Map, Hazards, Tides, Fallback, Arrival, Execution, Emergency
- **Full** — all sections including Pilotage, Shore Services, Webcams

### Route Editing

- **Modify Route** → edit mode: click map to add points, click points to remove
- **Save** → stores in DB (`PassageLegRoute`), invalidates timeline cache
- **Reset to Auto** → removes manual override, reverts to routing graph
- Manual route shows as "🖊 Manual route (43.6 NM)" badge

### Comfort Scoring

Separate from safety verdict (GO ≠ Comfortable):
- **Score 0-100** → Comfortable / Moderate / Bumpy / Demanding / Uncomfortable
- **Factors**: waves, swell, gustiness, cape acceleration, duration, night arrival, harbor entry
- **Segment comfort**: departure, each cape rounding, arrival
- **Expandable reasons list**

### Execution & Logbook

- **Start Passage** → active tracking
- **Quick checkpoints**: Departure, Cape, Reef In, Arrival
- **Observations**: comfort rating + condition notes (Calm/Choppy/Rough/Motor/Sailing/Reefed)
- **End Passage** → completed log
- **Planned vs Actual**: departure/arrival times, duration delta, comfort, wind/waves comparison

---

## API Reference

### Weather
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forecast/batch` | POST | Multi-waypoint forecast (Open-Meteo) |
| `/api/forecast/windy` | POST | Windy GFS + gfsWave forecast |
| `/api/forecast/cache` | GET/POST | DB-cached forecast per source/model |

### Tides
| `/api/tides` | GET | HW/LW predictions + tide state at time |

### Leg Intelligence
| `/api/leg` | GET | Curated leg guide (pilotage, milestones, hazards) |
| `/api/leg-timeline` | GET | Computed hourly passage timeline |
| `/api/leg-route` | GET/POST/DELETE | Manual route override CRUD |

### Execution
| `/api/execution` | GET | Active/latest execution for leg |
| `/api/execution` | POST | Actions: start, stop, track-point, checkpoint, observation |

### Content
| `/api/port-areas` | GET | Port areas + marinas + prices + nearby places |
| `/api/ports` | GET | Route waypoints |
| `/api/webcams` | GET | Windy webcams nearby |
| `/api/passage` | GET/POST/PATCH/DELETE | Passage CRUD |

---

## Key Business Logic

### Passage Computation (`src/lib/passage-computation.ts`)

807-line module computing hourly passage timeline:
- **VesselPerformanceModel** for Bossanova (reef thresholds, motor thresholds, close-hauled angle)
- **Route geometry**: uses manual route if saved, otherwise auto from routing graph
- **Weather interpolation**: per-waypoint forecast matched to hourly positions
- **Mode determination**: motor/sail/motorsail based on wind angle + speed
- **Current/tide effects** from tidal stream data
- **Sea state assessment**: wave height + period + direction
- **Cache**: results stored in `LegComputation` table, invalidated on route/forecast/vessel changes
- **Route signature**: hash includes manual geometry → automatic cache invalidation

### Route Resolution (`src/lib/leg-route.ts`)

- `getLegRoute()` — returns manual override if exists, else auto-route from `buildSeaRoute()`
- `saveManualRoute()` — upsert route + replace points + invalidate timeline cache
- `resetToAutoRoute()` — delete manual override + invalidate cache
- Distance computed via haversine along polyline

### Tidal Predictions (`src/lib/tides.ts`)

- Semi-diurnal model based on lunar cycle + HW Dover reference
- 18 port-specific offsets (from Admiralty data)
- Spring/neap factor from lunar phase angle
- Tidal streams for 4 critical areas (Peñas 1kt, Estaca/Ortegal 2kt, Ribadeo ría 2kt)
- ~15-30 min accuracy (sufficient for passage planning)

### Coastal Routing (`src/lib/coastline.ts`)

- Hand-authored graph: 64 navigation points + 61 bidirectional edges
- Sparse offshore corridor with branch nodes for ports and rías
- Dijkstra shortest-path with Euclidean distance cost
- Manual route overrides per-leg (stored in DB, not graph)
- Fallback: straight line for unknown endpoints

### Weather Sources (`src/lib/weather.ts`, `src/lib/windy.ts`)

- **Open-Meteo**: ECMWF/GFS/ICON/AROME (10-14 day wind/precip) + Marine (9-day waves/swell)
- **Windy**: GFS (wind) + gfsWave (waves/swell, full 10-day)
- **Offshore shift**: marine API coords +0.05° N for rías (ports on land in grid)
- **Cache**: 3h in-memory TTL + DB `forecastCache` per source/model

---

## Repository

- **GitHub:** https://github.com/groovebye/SailorWind
- **Branch:** `main`
