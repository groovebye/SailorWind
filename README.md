# SailorWind — Weather-Aware Passage Planner

Веб-приложение для планирования парусных переходов с прогнозом погоды и системой GO/CAUTION/NO-GO.

**Лодка:** Bossanova (Hallberg-Rassy Monsun 31)
**Маршрут:** Gijon (Испания) -> Греция, multi-year voyage

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4 |
| ORM | Prisma 7 with `@prisma/adapter-pg` driver adapter |
| Database | PostgreSQL 17 (Alpine) |
| Font | JetBrains Mono |
| Deploy | Docker multi-stage build, nginx reverse proxy |
| Server | Hetzner CX23 (x86, Nuremberg, Ubuntu) |
| Weather API | Open-Meteo (free, no API key required) |

---

## Project Structure

```
sailplanner-next/
├── prisma/
│   ├── schema.prisma          # DB schema (Port, Passage, PassageWaypoint, PassagePort)
│   ├── seed.ts                # Seed script (run via psql, not prisma)
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (dark theme, JetBrains Mono)
│   │   ├── globals.css        # Tailwind import only
│   │   ├── page.tsx           # Home — list recent passages
│   │   ├── new/page.tsx       # Passage wizard (2-step: route -> waypoints)
│   │   ├── p/[id]/page.tsx    # Passage dashboard (forecasts, verdicts, filters)
│   │   └── api/
│   │       ├── ports/route.ts          # GET /api/ports — list ports
│   │       ├── forecast/route.ts       # GET /api/forecast — single point
│   │       ├── forecast/batch/route.ts # POST /api/forecast/batch — multi-waypoint
│   │       └── passage/route.ts        # CRUD: GET/POST/PATCH/DELETE
│   ├── lib/
│   │   ├── db.ts              # Prisma client (singleton with pg adapter)
│   │   ├── weather.ts         # Open-Meteo client, cache, GO/NO-GO logic
│   │   └── nanoid.ts          # Short ID generator (8 chars)
│   └── generated/prisma/      # Generated Prisma client (gitignored)
├── Dockerfile                 # Multi-stage: deps -> build -> standalone
├── docker-compose.yml         # (on server only: /opt/sailorwind/)
├── next.config.ts             # output: "standalone"
└── .env                       # DATABASE_URL (gitignored)
```

---

## Business Logic

### Passage Creation Wizard (`/new`)

**Step 1 — Route:**
- User selects From/To ports (dropdowns, excludes capes)
- Sets departure datetime, speed (kt), mode (daily/nonstop), weather model
- Default departure: tomorrow 08:00

**Step 2 — Waypoints:**
- All ports between From and To are shown (ordered by `coastlineNm`)
- Auto-checked: start, end, capes, marinas
- User toggles intermediate stops via checkboxes
- Legs computed dynamically: distance (NM), time (hours), warnings for >50 NM or >10h legs
- On save: creates `Passage` + `PassageWaypoint[]` in DB, redirects to `/p/{shortId}`

### Passage Dashboard (`/p/[id]`)

**Header:**
- Passage name, boat name (Bossanova / HR Monsun 31), model, total sailing hours, speed
- Buttons: Home, Refresh, Force Refresh, Share Link, Delete

**Editable Filters:**
- Departure, Speed, Mode, Weather Model — all changes auto-save to DB (debounce 500ms)
- Changing model triggers automatic forecast re-fetch

**Schedule Computation:**
- `daily` mode: each leg starts at the same UTC hour as departure, on the next day after arrival
- `nonstop` mode: next leg starts immediately after arrival
- ETA for intermediate waypoints is interpolated linearly by `coastlineNm`

**Forecast Display:**
1. **Passage Summary** — table per leg: waypoint, ETA, weather icon, wind (arrow + kt + Beaufort), gusts, waves, swell, verdict
2. **Detailed Forecast by Waypoint** — expandable cards with 3-hour entries for ETA day (+/-12h window)

**Direction Arrows:**
- Wind: yellow arrow rotated by `windDirDeg` (meteorological: direction wind comes FROM)
- Waves/Swell: white arrow rotated by direction (oceanographic: direction waves travel TO)

### Weather Data (`src/lib/weather.ts`)

**APIs (no auth required):**
- Weather: `https://api.open-meteo.com/v1/forecast` — wind, gusts, precipitation, clouds, WMO codes
- Marine: `https://marine-api.open-meteo.com/v1/marine` — waves, swell (height, period, direction)

**Models:**

| ID | Name | Coverage |
|----|------|----------|
| `ecmwf_ifs025` | ECMWF IFS 0.25 deg | Global, 10 days |
| `icon_eu` | ICON-EU | Europe, 5 days |
| `gfs_seamless` | GFS | Global, 16 days |
| `arome_france` | AROME France | France/Spain coast, 2 days |

**Cache:**
- In-memory `Map`, keyed by `{model}_{lat}_{lon}` (4 decimal places)
- TTL: 3 hours
- Marine API has shorter forecast range (~8 days) — falls back to last known marine data for later hours

**Rate Limiting:**
- Requests are made sequentially (not parallel) to avoid 429
- Retry with backoff: up to 3 attempts, 1s/2s delays on 429

**GO/NO-GO Thresholds:**

| Parameter | Normal | Cape |
|-----------|--------|------|
| Wind CAUTION | >20 kt | >15 kt |
| Wind NO-GO | >30 kt | >25 kt |
| Gust NO-GO | >35 kt | >30 kt |
| Wave CAUTION | >2.5 m | >2.0 m |
| Wave NO-GO | >3.5 m | >3.0 m |

Cape waypoints have stricter thresholds due to wind acceleration zones.

### Port System

Ports are stored in PostgreSQL with:
- **coastSegment** — coast section identifier (e.g. `biscay-north`, `galicia-west`)
- **coastlineNm** — cumulative nautical miles along the coast from a reference point
- Used for: ordering waypoints, computing leg distances, finding ports between From/To
- **Types:** `marina`, `port`, `anchorage`, `cape`

Currently seeded: 14 ports from Gijon to La Coruna (Bay of Biscay / Galician coast).

---

## API Reference

### `GET /api/ports`
List all ports, ordered by `coastlineNm`.
- `?segment=biscay-north` — filter by coast segment

### `GET /api/forecast`
Single-point forecast.
- `?lat=43.54&lon=-5.66&model=ecmwf_ifs025&cape=0&force=0`

### `POST /api/forecast/batch`
Multi-waypoint forecast (sequential fetch).
```json
{
  "waypoints": [{"name": "Gijon", "lat": 43.54, "lon": -5.66, "isCape": false}],
  "model": "ecmwf_ifs025",
  "force": false
}
```
Returns: `{ "Gijon": [ForecastEntry, ...], ... }`

### `GET /api/passage`
- No params: list recent passages (20, desc by updatedAt)
- `?id={shortId}`: get single passage with waypoints and ports

### `POST /api/passage`
Create passage.
```json
{
  "name": "Gijon -> Cudillero",
  "departure": "2026-04-11T08:00",
  "speed": 5.0,
  "mode": "daily",
  "model": "ecmwf_ifs025",
  "waypoints": [{"portId": "cuid...", "isStop": true, "isCape": false}]
}
```

### `PATCH /api/passage`
Update passage filters.
```json
{ "id": "shortId", "departure": "...", "speed": 5, "mode": "daily", "model": "icon_eu" }
```

### `DELETE /api/passage?id={shortId}`
Delete passage and all its waypoints.

---

## Infrastructure

### Server: Hetzner CX23
- **IP:** `178.104.144.13`
- **OS:** Ubuntu
- **Cost:** ~4 EUR/mo
- **SSH:** `ssh root@178.104.144.13`

### Domain
- **sailorwind.com** — DNS A records (@ and www) -> `178.104.144.13`
- Registrar: Namecheap
- SSL: not yet configured (planned: Let's Encrypt via certbot)

### Nginx (`/etc/nginx/sites-available/sailorwind`)
- Reverse proxy: port 80 -> localhost:3000
- HTTP Basic Auth: `/etc/nginx/.htpasswd`
  - **User:** `sailor`
  - **Password:** `bossanova`

### Docker Compose (`/opt/sailorwind/docker-compose.yml`)

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: sailplanner
      POSTGRES_USER: sailor
      POSTGRES_PASSWORD: sw_db_2026!secure
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: ./app       # cloned from GitHub repo
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      DATABASE_URL: "postgresql://sailor:sw_db_2026!secure@db:5432/sailplanner"
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
```

### Deploy Workflow

```bash
# Local: commit & push
cd ~/Projects/sailplanner-next
git add . && git commit -m "..." && git push

# Server: pull & rebuild
ssh root@178.104.144.13
cd /opt/sailorwind/app && git pull origin main
cd /opt/sailorwind && docker compose up --build -d
```

### Database Access (from server)

```bash
# Enter psql
docker exec -it sailorwind-db-1 psql -U sailor -d sailplanner

# Common queries
SELECT id, name, "shortId", speed, mode, model FROM "Passage";
SELECT name, type, "coastlineNm" FROM "Port" ORDER BY "coastlineNm";
```

---

## Local Development

### Prerequisites
- Node.js 22+
- PostgreSQL 17 (or Docker)

### Setup

```bash
git clone git@github.com:groovebye/SailorWind.git
cd SailorWind

npm install

# Create .env
echo 'DATABASE_URL="postgresql://sailor:password@localhost:5432/sailplanner"' > .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed ports (via psql or seed script)
npx tsx prisma/seed.ts

# Start dev server
npm run dev  # -> http://localhost:3000
```

---

## Known Issues & Gotchas

- **Prisma 7** requires `@prisma/adapter-pg` — `new PrismaClient()` without adapter fails
- **Marine API** returns null beyond ~8 days — handled via `lastMarine` fallback
- **Nearby ports** (<20km) may share the same ECMWF grid cell and show identical forecasts
- **Open-Meteo rate limit** — sequential requests + retry to avoid 429; do not switch to parallel
- **`prisma/seed.ts`** is excluded from `tsconfig.json` to avoid build errors (uses `PrismaClient()` without adapter)
- **Docker cache invalidation** — if `package.json` hasn't changed, `npm ci` layer is cached; only `COPY . .` and build layers re-run

---

## Repository

- **GitHub:** https://github.com/groovebye/SailorWind
- **Branch:** `main`
