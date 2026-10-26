# SailorWind as a passage-planning brain: audit and roadmap

_2026-10-26 · branch `claude/planning-brain-0f56b4` · companion: [product-strategy.md](product-strategy.md)_

**Principle.** SailorWind plans; it does not navigate. Charts stay Navionics on the Raymarine Axiom 9, and weather routing is done today in OpenCPN 5.14 + Weather Routing on the Mac. SailorWind's job is everything around the chart: weather and polars, scenarios, departure windows, day planning, fuel, and getting the chosen route onto the plotter.

The targets below come from how Alex plans:
- pessimistic, realistic and optimistic scenarios;
- relax stops, a ~9 h day and an 11 h maximum;
- 5–7 kn under sail, 4.5–5.5 kn when conservative;
- engine ~6 kn at 2.5 L/h from a 60 L tank;
- tides, swell and bar entrances matter.

---

## 1. Audit: what v1.5 did against the target

| Target | Status before this branch | Evidence |
|---|---|---|
| **Weather routing** over the forecast with the boat polar (isochrones) | ❌ **Absent.** The engine *evaluates* one fixed route. It never *searches* for a better one. | `src/lib/passage-computation.ts`. The route is A* over a ≥ 20 m EMODnet grid (`src/lib/searoute.ts`), or drawn by hand. |
| **Departure-window comparison** (several starts × pessimistic/realistic/optimistic) | ❌ **Absent.** There is a 48 h score at the departure point only: wind and gust there, with a night penalty. The passage is not simulated. "Plans A/B/C" is static text. | `src/app/p/[id]/_cockpit/forecast.ts` `buildTimeline`; leg page "Plans & Scenarios". |
| **Day length & arrival constraints** (~9 h/day, ≤ 11 h, arrive before sunset, relax/bail-out stops) | 🟡 **Partial.** | See the breakdown below. |
| **Motoring & fuel** | 🟢 **Mostly there.** | See the breakdown below. |
| **GPX export** that imports cleanly into the Axiom (LightHouse) and Navionics Boating | 🟡 **Present but not plotter-safe.** | `src/app/api/export/route.ts` (before). |
| **GPX import** | ❌ **Absent.** | — |

**Day length & arrival, in detail.**
- What works:
  - Daily mode re-departs at the same hour each day (`passage-schedule-client.ts`).
  - The wizard warns when a leg is over 50 NM or 10 h.
  - The cockpit shows daylight at each ETA, using the Open-Meteo sunrise/sunset.
  - A "Bail-out ports" block lists every shelter along the route.
- What is missing:
  - No 9 h / 11 h day planning.
  - No automatic split of a long leg at relax stops.
  - No arrive-before-sunset check in scheduling.
  - The engine's "night" is a fixed UTC 20:00–06:00 window.

**Motoring & fuel, in detail.**
- What works:
  - The engine picks a mode by rule: below 7 kn of wind, motor. A low polar-efficiency band gives motor or motor-sail. Under sail, if SOG would drop below 4.5 kn, it motors (the "Bossanova rule").
  - Fuel burn is 2.5 L/h at cruise and 1.75 L/h motor-sailing, with a cumulative total and a reserve status.
- What is missing:
  - The seed never set the 60 L tank, so the reserve status was always "unknown".
  - Fuel is per leg only: there is no passage total and no refuel stops.

**GPX export, before this branch.** Several things would trip up a plotter:
- Names like `WP1` repeated across legs.
- A `→` in the route name.
- A standalone `<wpt>` duplicated as an `<rtept>`. On LightHouse that creates duplicate waypoints or prompts.
- The full passage concatenated into one `<rte>`.
- No name-length or charset limits.

### Problems found along the way

These go beyond the five targets. Each one changes what the planner tells Alex.

1. **Forecast taken only at the ports.**
   - The engine fetched forecasts only at the leg's waypoints, i.e. its ports and capes. A non-stop Leixões → Cascais leg therefore had **two** samples, both in near-shore model cells. The middle 120 NM ran on harbour wind.
   - Against Alex's GFS table for 26 Oct, this gave a mean of 4–6 kn and ~100 % motoring. The table had 9–12 kn.
   - **Fixed on this branch** (§2.3).
2. **The leg page refetches forecasts in an endless loop.**
   - The effect depends on the `leg` object, which is rebuilt on every render, and `setForecasts` re-renders.
   - The dev server logged a continuous stream of `POST /api/forecast/batch`.
   - The code predates this branch and is **not fixed** here (R3).
3. **The marine-API offshore shift points north** (`weather.ts` `offshoreCoords`: +0.05° lat).
   - That is right for the north coast of Spain. On the west-facing Portuguese coast it moves a port's wave sample *along* the shore, often onto land, so the wave data comes back null.
   - Route sampling avoids this for the timeline. The cockpit and leg-page port forecasts are still affected.
4. **No tide model for Portugal.** `tides.ts` has 18 ports in North Spain only. Leixões, Aveiro, Figueira da Foz, Nazaré, Peniche and Cascais get no HW/LW and no streams, and bar entrances have no gate.
5. **The service worker served stale planning data.**
   - It used stale-while-revalidate for every `GET /api/*`.
   - After a route edit or GPX import, the next load showed the *old* route.
   - `<a download>` of the GPX also went through it, so an old route could reach the plotter.
   - **Fixed** for `/api/leg-route`, `/api/export` and `/api/departure-windows`: these are now network-first, still falling back to the cache offline.
6. **Windy Point Forecast tier.** On Windy's free *testing* tier, data is randomly shuffled. Check which key prod uses before trusting any Windy-sourced number (see the strategy doc).

---

## 2. Built on this branch

### 2.1 Departure-window comparison

**Where to find it**
- On the leg page, in the **Departure windows** section. It loads when opened.
- Through the API: `GET /api/departure-windows?passageId=&legIndex=&start=YYYY-MM-DDTHH:mm&count=13&stepHours=6`.

**How it works**
- Each candidate start time is simulated by the *existing* hourly engine, `retimeLegTimelineContext` + `computeLegTimelineFromContext`, under three scenarios.
- The route and forecasts are resolved once and reused. 13 starts × 3 scenarios take about 2 s, most of it fetching the forecast.

| Scenario | Sail speed | Engine | Reported max wind/gust/Hs |
|---|---|---|---|
| Pessimistic | polar × 0.85 | × 0.9 (6.2 → 5.6 kn) | × 1.15 forecast-error margin |
| Realistic | polar | profile (6.2 kn) | as forecast |
| Optimistic | polar × 1.1 (still capped at hull speed) | profile | as forecast |

The scaled polar goes through the engine's own rules, so a slower boat also motors more, via the SOG < 4.5 kn rule. **"Optimistic" means the boat sails better, not that it arrives first.** In marginal wind it keeps sailing at ~5 kn where the realistic boat motors at ~6 kn. The table therefore shows the arrival **range** across the three scenarios, not an optimistic/pessimistic pair. A test pins this behaviour.

**Each row shows**
- Departure, and the realistic arrival with ☀️/🌙. Sun times are computed for the destination with a NOAA-style sunrise equation, `astro.ts` `sunTimes`, accurate to ~2 min, with no network.
- Earliest–latest arrival across the three scenarios.
- Hours, flagged against the 9 h day target and the 11 h maximum.
- Engine share and fuel. The last partial hour is weighted by the fraction actually used.
- Mean wind as a speed-weighted resultant, max wind/gust, max Hs.
- Hours of darkness underway.

**Verdict**
- **NO-GO** only if the *realistic* run breaks the app's existing open-water NO-GO limits from `weather.ts` `goNogo`: wind > 30, gust > 35, Hs > 3.5.
- **CAUTION** if the realistic run breaks a CAUTION limit (wind > 20, Hs > 2.5), the pessimistic envelope breaks any limit, or the pessimistic fuel need eats into the tank or reserve.
- A margin on top of a margin is not allowed to veto: it would flag ordinary 3 m Atlantic swell as NO-GO.

**Tags and actions**
- The best row is tagged **★ best balance**. Its score is comfort − 0.3 × engine % − 15 for a night arrival − 10 for CAUTION − 100 for NO-GO − 20 past the forecast horizon. A daylight arrival is worth ~50 % less engine time.
- Other tags: *least engine*, *calmest sea*, *fastest*.
- Rows arriving after the last forecast hour are greyed out.
- **Use** on a row sets that start as the leg's departure override.

**Sanity check against Alex's hand-made table** (`Sailing/voyages/plans/2026-10-26_porto-lisboa-window.md`)
- Same leg (Leixões → Cascais, 165 NM auto route), same start grid (Tue 27 00:00, every 6 h, 13 starts), Open-Meteo `gfs_seamless` fetched at ~19:30 UTC on 26 Oct.
- Wind and sea now agree in magnitude:

  | | Mean wind | Max wind | Hs |
  |---|---|---|---|
  | SailorWind | 7–12 kn N–NNE | 11–19 kn | 1.3–3.4 m, easing late in the week |
  | Reference | 8–12 kn | 11–16 kn | 1.7–3.3 m |

- **Motoring differs by design:**
  - SailorWind, realistic run: **59–93 %** under engine.
  - Reference: 7–49 %.
  - Why: the reference switched to engine below 3.5 kn VMG, motoring at 5.5 kn. SailorWind uses the boat's own rule, motoring below 4.5 kn SOG. With 10–12 kn dead astern, the assumed polar gives 3.8–4.4 kn, so the engine runs.
  - Which is right for Bossanova is Alex's call, and R6 makes the threshold a setting.
- Pessimistic fuel is ~74 L against a 60 L tank, so every row carries a fuel CAUTION. That matches the reference's "top up first", but more strongly.

### 2.2 Plotter-safe GPX export and GPX import

Module: `src/lib/gpx.ts`, pure, runs in the browser and on the server.

**Export.** `GET /api/export?passageId=&legIndex=`; omit `legIndex` for the whole passage. The leg page has an **Export GPX** button next to **Modify Route**.

The rules follow from the LightHouse 4 manual and Raymarine support (sources in the strategy doc):
- `<rte>` only, one per leg, with no standalone `<wpt>`. LightHouse stores every `<rtept>` as a waypoint, so a matching `<wpt>` would duplicate it.
- Names are at most 16 characters of `[A-Za-z0-9 _-]`. LightHouse *rejects* longer names or symbols like `( ? *` rather than truncating them, and imports have stalled on them. Accents and arrows are stripped (Nazaré → Nazare).
- Names are unique per file. The ends take the port names; intermediate points take a leg code plus a number (`LEICAS03`), or their own label if imported. A port shared by two legs keeps one name.
- At most 100 points per route, a fifth of LightHouse's 500. Navionics publishes no limit. Longer routes split into consecutive parts that share the joining point, so the geometry is never altered.
- Coordinates have 6 decimals.

**Import.** On the leg page, **Import GPX** parses and fits the file in the browser, asks for confirmation with a summary, and saves it through the existing `POST /api/leg-route` as the leg's manual route. Point labels are kept.

What the parser accepts:
- OpenCPN, Raymarine, Navionics and generic files: `<rte>`, `<trk>`/`<trkseg>` and `<wpt>`.
- Namespace prefixes, either attribute order or quote style, self-closing points, CDATA and entities.
- `<extensions>`, which are ignored.

What it picks: the first route; failing that, the longest track; failing that, the waypoints in file order.

How it fits the line to the leg:
- Reverses it if it was drawn the other way.
- Rejects it if either end is more than 15 NM from the leg's port, since it is probably the wrong leg.
- Joins it to the port if it stops more than 0.3 NM short.
- Thins dense tracks to ≤ 300 points with Douglas–Peucker, raising ε from 0.02 NM and reporting the value used.

**Round trip from OpenCPN Weather Routing.**
1. In OpenCPN, export the chosen route as GPX.
2. Import it into SailorWind on the leg page. Departure windows, the timeline and fuel now use that route.
3. Export it again as plotter-safe GPX.
4. Copy it to microSD and load it on the Axiom: My data → Import/export → Import from card.

### 2.3 Forecast sampled along the route

`resolveLegTimelineContext` now fetches the forecast at evenly spaced points along the route geometry, ≤ 20 NM apart with both ends included (`buildForecastSamples`). Each simulated hour uses the sample nearest along-track.

This affects the leg timeline as well as the windows.
- **Cost:** a 165 NM leg makes 10 forecast + 10 marine calls. These are cached in memory for 3 h, and the free Open-Meteo tier allows 10k calls a day.
- **Fallback:** contexts without samples still use the old nearest-port behaviour.

### 2.4 Small supporting changes

- `src/lib/timeline-inputs.ts` loads the passage and vessel once for both `/api/leg-timeline` and `/api/departure-windows`. It used to be inlined, and duplicated twice, in the timeline route.
- Douglas–Peucker moved from `searoute.ts` to `geo.ts` (`simplifyPolyline`). Output is identical: Leixões → Cascais is still 13 points.
- The seed now sets Bossanova's `fuelTankLiters: 60`. **Prod needs this too.** It is a data change, and nothing was deployed.
- `.data-table.compact` gives one-line cells for dense numeric tables.

**Tests:** 84 vitest tests (39 before), covering:
- `astro.test.ts`: sun times against almanac values.
- `departure-windows.test.ts`: scenarios, verdicts, fuel, daylight, the forecast horizon and route sampling, all through the real engine.
- `gpx.test.ts`: names, limits, splitting, round trip, parser edge cases and import fitting.

---

## 3. Roadmap (prioritised)

| # | Item | Why | Size |
|---|---|---|---|
| **R1** ✅ | Departure-window comparison, P/R/O | Answers "when do we go?" with the passage simulated, not just the start point. | done |
| **R2** ✅ | Plotter-safe GPX export + GPX import | Gets the plan onto the Axiom/Navionics, and makes OpenCPN Weather Routing output usable in SailorWind. | done |
| **R0** ✅ | Forecast sampled along the route | Without it, long legs ran on harbour wind. | done |
| **R3** | Fix the leg-page forecast refetch loop: depend on primitives (`passage.id`, leg slugs, model), not the per-render `leg` object | Hammers `/api/forecast/batch`, and Open-Meteo behind it on cache misses. Burns quota for nothing. | S |
| **R4** | **Day planner.** Split a long leg into days of ≤ 9 h (hard cap 11 h) at relax/bail-out stops, arriving before sunset with a margin. Rank the split options with the window engine, P/R/O per day. | Alex's real constraint. The reference suggests Leixões → Figueira → Peniche/Nazaré → Cascais by hand. Builds on R1 plus the bail-out list (`alongRouteNm`). | M |
| **R5** | **Portugal coverage.** Tide constants for Leixões, Aveiro, Figueira, Nazaré, Peniche and Cascais/Lisboa. **Bar gates** for Figueira, Aveiro, Póvoa and Viana: closures by the Capitania, swell height × period, ebb. A coast-aware offshore shift for the marine API. | The next legs are Portuguese, and bars decide where you can stop. | M |
| **R6** | **Engine realism.** Tack/gybe at target TWA instead of motor-sailing at the actual TWA. Use real sun times for "night" (replace UTC 20–06). Make the sail/engine threshold a vessel setting (4.5 kn SOG now; OpenCPN uses 3.5 kn VMG). Engine speed ~6.0 kn. | Upwind legs look like motoring today. The threshold drives the motoring %. | M |
| **R7** | **Passage fuel.** Running total across legs, refuel stops (ports with `fuel`), a reserve; reserve status falls back to the tank size. | Fuel must be considered for the whole passage, not one leg. | S |
| **R8** | **In-app weather routing.** A deterministic isochrone router over gridded GFS/ECMWF (GRIB or a grid API; per-point calls do not scale), masked by the ≥ 20 m navgrid, with the polar plus an engine fallback. Output is a manual route and GPX. | Replaces the OpenCPN detour. Until then, OpenCPN → GPX import (R2) is the bridge. Permissively licensed code only. | L |
| **R9** | **Learn the polars from logs.** Import Axiom tracks (GPX, plus NMEA wind if logged) and execution observations to fit per-TWS/TWA performance factors. ML only as a helper; the core stays deterministic. | The polars are assumed. Real ones change every scenario. | M–L |
| **R10** | Calibrate ETA and comfort from debriefs, comparing plan with actual in the existing execution log. | Turns "assumed" into "measured". | M |
| **R11** | GPX extras: optional bail-out ports as waypoints, one route per day (after R4), and a desktop check of the import on a real Axiom card. | Plotter UX. The import path has not been tested on hardware yet. | S |

Release prerequisites (licences, data terms, liability) are in [product-strategy.md](product-strategy.md).
