# 03 · Data model & seed data

All seed data is in `reference/data.js` under the global `window.SW`. It is a faithful static
snapshot of one real passage (Viveiro → La Coruña) plus the full 88-port Atlantic database.
Below are the schemas (TypeScript) and the notable values. The **full 88-port list** is in
`data.js` — port it as-is; only the schema is reproduced here to keep this readable.

```ts
interface SW {
  ports: Port[];           // 88 ports, Gijón → Gibraltar (ordered by route)
  recent: RecentPassage[]; // 6 dashboard cards
  passage: Passage;        // the active passage (Viveiro → La Coruña)
  fc: Record<string, ForecastRow[]>;  // detailed 3h forecast by waypoint name
  timeline: TimelineHour[];           // 48 hourly departure-window scores
  orcaZones: OrcaZone[];
  // community: removed from UI — ignore if present
}
```

---

## 1. Port

```ts
interface Port {
  id: number;            // 1..88, also the along-route order
  name: string;          // "Gijón", "La Coruña", "Cascais", "Gibraltar", …
  dist: number;          // nautical miles to the NEXT port on the route (0 / 0.5 used for <1nm)
  region: string;        // "Asturias", "Galicia", "Costa da Morte", "Ría de Arousa",
                         //   "Portugal · Norte", "Spain · Cádiz", "Gibraltar", …
  berths: number;        // marina berths; 0 ⇒ anchorage-only
  price: number | null;  // €/day or null if unknown/—
  facilities: ('f'|'r')[]; // 'f' = fuel, 'r' = repair
  orca: 'low'|'medium'|'high' | null;  // orca-interaction risk rating
  stars: number;         // 0..3 editorial rating (0 = none)
  anchorage: boolean;    // derived: berths === 0
}
```

Notable anchors of the dataset (see `data.js` for all 88):
- **Asturias** (1–7): Gijón (728 berths, €28, fuel+repair, ★3) … Cudillero, Luarca.
- **Galicia** (8–43): Ribadeo, **Viveiro** (235, €22, ★1), Cariño, Cedeira, Ferrol (300,
  €25, ★1), Sada, **La Coruña** (1053, €25, fuel+repair, ★3), Costa da Morte (Camariñas,
  Muxía, Fisterra), the Rías (Arousa, Pontevedra, Vigo), Baiona, A Guarda.
- **Portugal** (44–73): Caminha, Viana do Castelo, Leixões/Porto, Aveiro, Nazaré, Peniche,
  **Cascais**, **Lisboa (Tejo)** (1386 berths), Sines, the **Algarve** (Lagos, Portimão,
  Vilamoura, Faro, Olhão …).
- **Spain Huelva/Cádiz** (74–87): Ayamonte … Cádiz (482), Barbate, Tarifa, La Línea.
- **Gibraltar** (88): 574 berths, fuel.

Orca ratings cluster **medium** along Galicia/Portugal and **high** around Fisterra, Cíes,
Baiona, Sagres and the whole **Cádiz/Strait** stretch (Rota → Gibraltar). `dist` is the hop
to the next port (used in the "→ Next" column).

---

## 2. RecentPassage (dashboard cards)

```ts
interface RecentPassage {
  id: string; from: string; to: string;
  date: string;            // "23 Apr 2026"
  wp: number;              // waypoint count
  nm: number;              // distance
  hours: number;           // estimate
  verdict: 'GO'|'CAUTION'|'NOGO';
  capes: number;
}
```
The six seeds:
| id | route | date | wp | nm | h | verdict | capes |
|---|---|---|---|---|---|---|---|
| p1 | Viveiro → La Coruña | 23 Apr 2026 | 8 | 75.9 | 12.7 | GO | 2 |
| p2 | Ribadeo → Viveiro | 21 Apr 2026 | 4 | 31.0 | 5.2 | GO | 0 |
| p3 | Gijón → Ribadeo | 20 Apr 2026 | 9 | 64.0 | 10.6 | CAUTION | 1 |
| p4 | Gijón → La Coruña | 20 Apr 2026 | 14 | 138.0 | 23.0 | CAUTION | 3 |
| p5 | Ribadeo → Cariño | 21 Apr 2026 | 7 | 49.0 | 8.1 | GO | 1 |
| p6 | Gijón → Cudillero | 19 Apr 2026 | 4 | 21.0 | 3.5 | GO | 0 |

Hero stats derive from these: count = 6, total nm ≈ 378.

---

## 3. Passage (active) + Waypoint

```ts
interface Passage {
  id: string; from: string; to: string;
  boat: string;            // "Bossanova"
  boatModel: string;       // "Hallberg-Rassy Monsun 31"
  model: string;           // "ECMWF IFS 0.25°"
  modelShort: string;      // "ECMWF_IFS025"
  speed: number;           // 6 (kt)
  mode: string;            // "Non-stop"
  departure: string;       // "Thu 23 Apr 2026, 10:00"
  arrival: string;         // "Thu 23 Apr, 22:39"
  nm: number;              // 75.9
  hours: number;           // 12.7
  capes: number;           // 2
  wp: Waypoint[];          // 8 waypoints, in order
}

interface Waypoint {
  name: string;
  type: 'STOP'|'CAPE'|'PORT';   // STOP = start/end, CAPE = headland, PORT = passed port
  lat: number; lng: number;     // real coordinates (for the map)
  eta: string;                  // "10:00"
  wind: number;                 // kt at ETA
  bf: number;                   // Beaufort 0..12
  gust: number;                 // kt
  wave: string;                 // "1.5m / 8s"  (height / period)
  swell: string;                // "1.1m / 8s"
  power: number;                // comfort/exposure index 0..~14
  verdict: 'GO'|'CAUTION'|'NOGO';
}
```

The 8 waypoints (Viveiro → La Coruña, departing Thu 23 Apr 10:00 @ 6 kt, all GO):
| # | name | type | lat,lng | ETA | wind | B | gust | waves | swell | power |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Viveiro | STOP | 43.659,−7.595 | 10:00 | 6 | 2 | 9 | 1.5m/8s | 1.1m/8s | 9.0 |
| 2 | Estaca de Bares | CAPE | 43.789,−7.688 | 12:31 | 6 | 2 | 9 | 1.4m/8s | 1.1m/8s | 7.8 |
| 3 | Cabo Ortegal | CAPE | 43.770,−7.862 | 15:03 | 7 | 2 | 10 | 1.5m/9s | 1.4m/8s | 10.1 |
| 4 | Cariño | PORT | 43.740,−7.870 | 15:49 | 7 | 2 | 10 | 1.5m/9s | 1.4m/8s | 10.1 |
| 5 | Cedeira | PORT | 43.661,−8.062 | 17:35 | 4 | 1 | 10 | 1.4m/9s | 1.3m/8s | 8.8 |
| 6 | Ferrol | PORT | 43.493,−8.234 | 20:07 | 2 | 1 | 5 | 1.0m/9s | 0.9m/8s | 4.5 |
| 7 | Sada | PORT | 43.357,−8.276 | 21:23 | 1 | 0 | 3 | 0.7m/9s | 0.7m/9s | 2.2 |
| 8 | La Coruña | STOP | 43.371,−8.396 | 22:39 | 3 | 1 | 9 | 1.0m/9s | 0.9m/8s | 4.5 |

---

## 4. ForecastRow (detailed, 3-hour)

```ts
type ForecastRow = [
  time: string,   // "00:00" … "21:00" (3h steps, 8 rows)
  wind: number,   // kt
  bf: number,     // Beaufort
  gust: number,   // kt
  wave: string,   // "1.7m / 8s"
  swell: string   // "1.1m / 9s"
];
// SW.fc[waypointName] = ForecastRow[8]
```
Real per-waypoint forecasts exist for **Viveiro, Estaca de Bares, Cabo Ortegal, La Coruña**.
The others (**Cariño, Cedeira, Ferrol, Sada**) are **synthesized** in `data.js` via `synth()`
(shift a neighbour's wind by a delta, recompute bf/gust). In production, sample each
waypoint's own forecast and delete the synth shim.

---

## 5. TimelineHour (48h departure window)

```ts
interface TimelineHour {
  h: number;        // 0..47 hours from planned 10:00 departure
  label: string;    // "Thu 10:00" (weekday + HH:00)
  wind: number;     // kt
  gust: number;     // kt
  score: number;    // 0.5..10 window-quality (10 = best)
  verdict: 'GO'|'CAUTION'|'NOGO';   // score≥7 GO · ≥4.5 CAUTION · else NO-GO
  tod: number;      // hour-of-day 0..23 (for the night penalty)
}
```
**Generation** (in `data.js`, deterministic — replace with real model output in production):
- `wind` = a base diurnal sine (`7 + 5·sin(h/24·2π + 1)`) + a rising trend after h>30 (a
  front filling in on day 2) + small jitter; floored at 2.
- `gust` = `wind + 4` (+ extra after h>30).
- `score` = `10 − max(0, wind−12)·0.9 − max(0, gust−22)·0.5`, minus 1.6 at night (tod≥22 or
  <5), clamped to [0.5, 10].
- `verdict` thresholds as above.

This produces the timeline's shape: good morning windows, livelier afternoons, a
deteriorating front late on day 2 — which the AI's `bestWindow()` and "front Fri PM" remark
key off. The planned 10:00 departure is `h=0`.

---

## 6. OrcaZone

```ts
interface OrcaZone {
  lat: number; lng: number;
  r: number;             // radius in metres
  level: 'low'|'medium'|'high';
  note: string;          // "Cabo Ortegal — 3 reports this week"
}
```
Two seeds on the active route:
- `43.74, −7.92`, r 9000, **medium** — "Cabo Ortegal — 3 reports this week".
- `43.62, −8.30`, r 7000, **low** — "Approaches to A Coruña — quiet".

Color by level on the map & chips: high → `--nogo`, medium → `--orca`, low → `--sky`.

---

## 7. Units & conventions

- Wind/gust: **knots**; also shown as **Beaufort** ("B2"). Waves/swell: **metres / seconds**
  ("1.5m / 8s" = significant height / period). Distance: **nautical miles (NM)**.
  Temperature (live card): **°C**. Currency: **EUR**.
- Times are local; the seed passage is a single day (Thu 23 Apr 2026). Dates formatted
  "DD Mon YYYY" / "Ddd DD Mon · HH:MM".
- Verdict vocabulary everywhere: **GO** (green/check), **CAUTION** (amber/alert-triangle),
  **NO-GO** (rose/x).
- Coordinates are decimal degrees (W = negative longitude).

---

## 8. What's stubbed vs real (so you know what to build)

| Area | Prototype | Production |
|---|---|---|
| Forecast numbers | static snapshot | fetch Open-Meteo (GFS/ECMWF) per waypoint ETA |
| 48h timeline | sine-generated | derive from model time series along the route |
| ETAs | precomputed | compute from speed + leg distances; recompute on speed/mode change |
| AI answers | computed from timeline (`answerFor`) | LLM with route+forecast context; keep computed fallback |
| Map wind layer | screen-space sin flow field | GRIB/Open-Meteo wind field projected to the map |
| Orca zones | 2 static seeds | live sightings feed |
| Ports | full 88-row static DB (real) | same DB + live berth/fuel where available |
| Persistence | none (single session) | save boat profile, passages, settings; route-based URLs |

That's the complete spec. The `reference/` prototype demonstrates all of it end-to-end.
