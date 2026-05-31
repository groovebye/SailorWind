# 01 · Views — screen-by-screen specification

Three views: **Dashboard**, **Passage Detail**, **Chart**. Plus the shared **Topbar**.
All measurements are the prototype's intended values. Copy strings are exact.

---

## A. Shared shell & Topbar

**Shell (`app-shell`)** — `position:relative; height:100vh; overflow:hidden`.
Three stacked layers, bottom to top:
1. `.app-backdrop` (z0): layered radial glows + linear gradient + a masked dotted grid.
   - `radial-gradient(1200px 800px at 78% -10%, rgba(52,224,255,.10), transparent 60%)`
   - `radial-gradient(900px 700px at 8% 110%, rgba(79,176,255,.10), transparent 55%)`
   - `linear-gradient(160deg, #050d18, #03080f 70%)`
   - `::after` dotted grid: `radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px)` at
     `32px 32px`, masked by a soft radial so it fades at edges.
2. `WindField` canvas (z1, `opacity:.55`) — animated wind particles. **Hidden on Chart view**
   (the map has its own overlay). Density 1 on Dashboard, 0.7 on Passage Detail.
3. `.app-main` (z5): the actual UI, `display:flex; flex-direction:column; height:100vh`.

**Topbar** (`.topbar`) — sticky, `z-index:40`, `padding:14px 28px`, flex row, gap 22px.
Background `linear-gradient(180deg, rgba(5,13,24,.85), rgba(5,13,24,.35))` +
`backdrop-filter: blur(18px) saturate(140%)` + bottom `1px` glass border.

Contents left→right:
- **Brand** (clickable → Dashboard): a 34×34 rounded-10 mark with a `navigation-2` icon
  rotated 45° on a cyan radial gradient + cyan glow; wordmark "Sailor**Wind**" in Spectral
  600 21px, the "Wind" half colored `--cyan`.
- **Nav links** (`.nav-links`, hidden ≤860px): three `.nav-link` pills (icon + label).
  Active = `--glass-2` bg + glass border + full-opacity text; idle = `--fg-dim`, hover lifts
  to `--glass` bg.
- **Spacer** (flex:1).
- **Boat chip** (`.boat-chip`, hidden ≤860px): `sailboat` icon (cyan) + two lines
  "**Bossanova**" (600 13px) / "HR Monsun 31" (mono 10px faint). Glass pill, pad 7×14, r12.
- **Settings** icon button (`.btn .btn-sm .btn-ghost`, `settings` icon).

> There is intentionally **no** Upgrade button, account avatar, or PRO badge.

---

## B. Dashboard view

`.view-scroll` (the only scroll container; `flex:1; overflow-y:auto`). Inside, `.container`
with `padding-bottom:80px`. Sections stacked with 64px gaps. Whole view enters with
`fadeUp`.

### B1. Hero (`padding-top:48px`)
Two-column grid `.hero-grid` `1.05fr / 0.95fr`, gap 48px, vertically centered. Collapses to
one column ≤980px.

**Left column:**
- Eyebrow: `Bossanova · Hallberg-Rassy Monsun 31`
- H1 (`.display`, clamp 40–72px): "Plan the wind." / line break / "Sail the window."
  — second line colored `--cyan`.
- Paragraph (`--fg-dim`, 18px, max-width 480): "Cape-by-cape forecasts, a live GO/NO-GO
  departure timeline and my own co-skipper — tuned for the Atlantic coast from Biscay to
  Gibraltar."
- Button row: **"New passage"** (`.btn-primary .btn-lg`, `plus` icon) → opens Passage
  Detail; **"Open chart"** (`.btn .btn-lg`, `map` icon) → opens Chart.
- **Hero stats** (`.hero-stats`, flex, gap 26, 40px top margin): three `Stat` blocks
  separated by 1px×38 dividers. Each = a count-up number (Spectral-ish `.stat-num` 26px) +
  a mono faint 11px label. Values: **Passages planned** = `recent.length` (6),
  **Nautical miles** = sum of recent passage `nm` (~378, localized with commas),
  **Ports & marinas** = `ports.length` (88). Numbers **count up** on mount (`useCountUp`,
  ~1–1.2s, cubic ease-out).

**Right column — `LiveConditions` glass card** (`.live-card`, pad 26, enters fadeUp +0.15s):
- Header row: left a pulsing green `.live-dot` + mono "LIVE · VIVEIRO"; right a pill
  "ECMWF IFS" with `satellite` icon.
- Big readout: huge wind number (Spectral 64px, color = `windColor(wind)`) + " kt"; below,
  mono caption "gusting {gust} · B{beaufort}". To its right, a **Sparkline** (200×56) of the
  next 12h wind, colored to match.
- 3-up `.live-grid` of `LiveCell`s (icon + label + value + sub): **Swell** 1.1m / 8s,
  **Sea** 14° / rising, **Visibility** 9 NM / good.
- Full-width primary button: "Open active passage · Viveiro → La Coruña" (`compass` icon) →
  Passage Detail.

### B2. Recent passages
`SectionHead`: `route` icon in a 38px glass square + H2 "Recent passages" + sub "Pick up
where you left off"; right-aligned small ghost "New" button.

Grid `.passage-grid` = `repeat(3,1fr)`, gap 16 (→1 col ≤980px). Cards stagger in.

**`PassageCard`** (`.glass.glass-hover`, pad 20, `cursor:pointer` → Passage Detail):
- Top row: mono faint date (e.g. "23 Apr 2026") + a `Verdict` pill.
- Route line: `{from}` (Spectral 22px) + cyan `arrow-right` + `{to}`.
- Metric row (16px gap): `navigation` "{nm} NM", `clock` "~{hours}h", `map-pin` "{wp} wp",
  and if capes>0 `triangle` "{n} cape(s)". Each = small icon + mono value.
- A subtle radial glow pinned top-right inside the card.

Data: the 6 entries in `recent` (see `03-data-model.md`).

### B3. Ports & marinas — `PortsExplorer`
`SectionHead`: `anchor` icon + H2 "Ports & marinas" + sub "88 along the Atlantic route ·
Gijón → Gibraltar". Then a single `.glass` panel (pad 18) containing:

- **Controls row** (`.ports-controls`, flex, wrap): a search input (`search` icon inside,
  placeholder "Search ports — e.g. Vigo, Cascais, Cádiz, Algarve…", flex:1) + a segmented
  control `.seg` of filters: **All** (list), **Fuel** (fuel), **Repair** (wrench),
  **Anchorage** (anchor), **Orca risk** (alert-triangle). Labels hide ≤860px (icons only).
- **Scrollable table** (`.ports-table-wrap`, `max-height:460px; overflow-y:auto`, glass
  border, r12). `.data-table` columns:
  `# | Port | → Next | Region | Berths | €/day | Facilities | (chevron)`.
  - `#` mono faint id.
  - **Port**: name (600) + `Stars` (filled `star` icons in `--caution`) if `stars>0`.
  - **→ Next**: mono dim "{dist} nm" (distance to next port) or "—". Hidden ≤860px.
  - **Region**: dim 12.5px.
  - **Berths**: mono number, OR if anchorage a small pill "⚓ anchor".
  - **€/day**: cyan "€{price}" or faint "—". Hidden ≤860px.
  - **Facilities**: `fuel`/`wrench` icons (`Facilities`) + an `OrcaChip` if the port has an
    orca rating (a colored dot + "orca {level}", color by level: high→nogo, medium→orca,
    low→sky).
  - Sticky header (`--sea-850` blurred). Rows hover-highlight, `cursor:pointer`.
  - Empty state: centered dim "No ports match "{q}".".
- **Footer** (`.ports-foot`): left mono faint "Showing {n} of 88 ports · Gijón → Gibraltar";
  right mono faint "ⓘ tap a port for berths & facilities".

Filtering logic: case-insensitive match on name OR region for search; facility/anchorage/
orca filters narrow the list. (No pagination — it's a scroll list.)

> The "From the fleet" community section and any booking/upsell were **removed**. Don't add them.

---

## C. Passage Detail view (the planning cockpit)

`.view-scroll` → `.container` (`padding-top:24px; padding-bottom:80px`). Top-to-bottom:

### C1. Header row (`.between`, wrap)
- Left: a small ghost **"Home"** button (`arrow-left`) → Dashboard; then `.pd-title` =
  `{from}` (Spectral 26px) + cyan `arrow-right` + `{to}`.
- Right: a pill "{boat} · {boatModel}" (`sailboat` icon); **"Map"** button (`map`) → Chart;
  ghost **"Windy"** button (`external-link`, opens external in production); primary
  **"Update"** button (`refresh-cw`, re-fetches forecast in production).

### C2. Config bar (`.config-bar`, glass, grid `1.1fr 1.2fr 1fr 1.2fr`, gap 22, pad 18×22)
Four `ConfigField`s (mono uppercase label + control):
1. **Departure** (`calendar`): a `<select>` of the first 24 timeline hours (labels like
   "Thu 10:00"); changing it moves the timeline marker (shared `depIdx` state).
2. **Boat speed** (`gauge`): a styled range slider 3–9 kt step 0.5 (cyan gradient track,
   white thumb) + mono "{speed} kt" readout. Default 6.
3. **Mode** (`route`): segmented "Non-stop" / "Day-hops". Default "Non-stop".
4. **Weather model** (`satellite`): segmented "GFS" / "ECMWF" / "Ensemble". Default ECMWF.
   **All three are freely selectable** (no lock).

Collapses: 2 cols ≤1080px, 1 col ≤560px.

### C3. Summary stat row (`.pd-stats`, grid `repeat(4,1fr) 1.6fr`, gap 14)
Four `BigStat` glass cards (icon + big mono value + unit + mono label):
**Distance** 75.9 NM · **Duration** ~12.7 h · **Capes** 2 · **Waypoints** 8.
Fifth wide card = **Verdict** card, tinted by the overall verdict color (a CSS var `--vc`):
mono "Verdict" label, a large `Verdict` pill, and a mono caption with date + departure→arrival
times ("Thu 23 Apr · 10:00 → 22:39"). Overall verdict = GO if all waypoints GO, NO-GO if any
NO-GO, else CAUTION. Collapses to 2 cols ≤1080px.

### C4. Main grid (`.pd-grid`, `1fr / 380px`, gap 20, align-start)
**Left column** (stacked, gap 20):

**(a) Departure window** glass card (pad 22). Header: `activity` icon + "Departure window" /
mono "next 48h · drag to choose your start"; right pill "ⓘ aggregate GO/NO-GO score".
Then a readout row: left = chosen hour label (Spectral 22px) + "start of passage"; right =
mono "{wind} kt · gust {gust}" (colored) + "confidence {score}/10" + a large `Verdict` pill.
Then the **`DepartureTimeline`** (see `02-interactions-state.md` §1): 48 vertical bars whose
height encodes the per-hour score and whose color encodes verdict (GO green / CAUTION amber /
NO-GO rose); the selected bar is full opacity, others ~0.42. A white draggable marker with a
`chevrons-left-right` handle sits at `depIdx`. Axis labels below: Now / +12h / +24h / +36h /
+48h. The whole track is `cursor:ew-resize`; click or drag to pick departure.

**(b) Passage summary** glass card (pad 0, overflow hidden). Head bar: `table-2` icon +
"Passage summary" + mono "75.9 NM · 8 waypoints". Then a horizontally-scrollable
`.data-table`, columns:
`Waypoint | ETA | Wind | Gust | Waves | Swell | Power | Verdict` (Gust/Waves/Swell hide ≤860px).
- **Waypoint**: a `WpDot` (cyan circle for STOP, amber rotated-square for CAPE, faint dot for
  PORT) + name (600) + a tiny "cape" pill on capes.
- **ETA**: mono dim "HH:MM".
- **Wind**: `WindCell` = mono colored number + a "B{bf}" beaufort chip tinted by `bfColor`.
- **Gust**: mono, colored by `windColor`.
- **Waves / Swell**: mono dim "1.5m / 8s".
- **Power**: `PowerBar` = a 54px track with a fill scaled to `power/14`, colored green→cyan→
  amber→rose by value, + mono number.
- **Verdict**: `Verdict` pill.
Rows are `cursor:pointer`; clicking a row sets the detailed-forecast tab to that waypoint.

**(c) Detailed forecast by waypoint** glass card (pad 22). Head: `line-chart` icon +
"Detailed forecast by waypoint". A row of `.wp-tab` pills (one per waypoint; active =
brighter). Below, the **`ForecastChart`** (see `02-...md` §4): 8 columns (3-hour steps), each
a translucent **gust** bar behind a colored **wind** bar (height ∝ value, colored by
`windColor`), with the wind value above, the time label below, and a "B{bf}" chip. Legend
underneath: "Wind (kt)" / "Gust" / "· 3-hour steps · all GO".

**(d) Disclaimer** strip (`.disclaimer`, mono faint, `shield-alert` icon):
"Planning aid only. Cross-check with AEMET, MeteoGalicia and real-time conditions before
departure."

**Right column — `.pd-side`** (sticky `top:88px`, gap 16; un-sticks & moves below ≤1080px):
- **`AIAssistant`** (fills, min-height 360 — see `02-...md` §5).
- **`OrcaAlert`** glass card (pad 18, violet-tinted): header `alert-triangle` orb + "Orca
  watch" / "2 zones on route" + a small "ⓘ live" pill. Two rows: "Cabo Ortegal — medium · 3
  reports" (orca-violet dot) and "A Coruña approach — low · quiet" (sky dot). Footer button
  "View zones on chart" (`map-pin`) → Chart.

---

## D. Chart view (full-bleed map)

`.map-wrap` = `position:relative; height:calc(100vh - 63px); overflow:hidden`. Layers:

1. **`.map-el`** — the Leaflet map (`position:absolute; inset:0`), dark CARTO tiles, bg
   `--sea-900` so missing tiles still read as ocean. Setup (see `02-...md` §6):
   - Route drawn twice: a fat low-opacity cyan glow line (weight 7, opacity .18) under a thin
     dashed cyan line (weight 2.5, `dashArray "1 8"`, round caps).
   - Waypoint markers as `L.divIcon`s: STOP = 16px cyan circle with an expanding pulse ring;
     CAPE = 13px amber rotated square; PORT = 9px faint dot. White 2px border + colored glow.
     Click a marker → set active waypoint + pan. Tooltip "{name} · {eta} · {wind}kt".
   - **Orca zones** as dashed translucent `L.circle`s, color by level (high→nogo, medium→orca,
     low→sky), with tooltips. Toggleable layer group.
   - `fitBounds` to the route with padding; zoom control bottom-right.
2. **`.map-overlay`** canvas (`z-index:410`, `pointer-events:none`) — animated wind particles
   + optional wave-heat gradient, sized to the map (see `02-...md` §6).

Floating glass overlays (all `z-index:500`):
- **`.map-top`** (top-left): back button (`arrow-left`) → Passage Detail; route title
  "{from} → {to}" (Spectral 18px) + mono "8 waypoints · 75.9 NM · 1 leg".
- **`.map-layers`** (top-right, 230px): label "Chart layers" + three `LayerToggle` rows —
  **Wind flow** (cyan, on), **Wave heatmap** (amber, off), **Orca zones** (violet, on). Each
  = icon + label + an iOS-style toggle (`.toggle/.knob`, cyan when on). All are free toggles.
- **`.map-readout`** (bottom-left, 290px; hidden ≤720px): the active waypoint — `WpDot` +
  name + `Verdict`, then a 3-col grid of cells (`RO`): **ETA**, **Wind** (colored), **Gust**,
  **Waves**, **Swell**, **Power**. Re-enters with fadeUp on selection change.
- **`.map-legend`** (bottom-center; hidden ≤720px): "WIND KT" + a 140px gradient bar
  (`#7fe9c4 → #34e0ff → #4fb0ff → #ffc24b → #ff9b5a → #ff6b8a`) + scale 0 / 10 / 20+.

Leaflet's own CSS is themed dark (see `styles.css`: `.leaflet-container`, attribution,
zoom controls, `.lf-tip` tooltip).

Continue with **`02-interactions-state.md`**.
