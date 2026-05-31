# 02 · Interactions, animation & state

Exact behaviour of every interactive/animated piece. Source files in `reference/` are the
ground truth; this explains the intent so you can reimplement, not transliterate.

---

## 1. Departure timeline (drag-to-pick)  ·  `PassageDetail.jsx → DepartureTimeline`

**Data:** `SW.timeline` — 48 hourly objects `{ h, label, wind, gust, score, verdict, tod }`
starting at the planned 10:00 departure (see `03-data-model.md` for how they're generated).

**Render:** a flex row of 48 bars, `align-items:flex-end`, height 110px.
- Bar height = `18 + score * 6.4` px (so a 10/10 hour ≈ 82px, a 0.5 hour ≈ 21px).
- Bar color = verdict → `--go` / `--caution` / `--nogo`.
- Selected bar (`i === depIdx`) opacity 1; all others 0.42.
- A white vertical **marker** absolutely positioned at `left: depIdx/(N-1) * 100%`, with a
  26px white rounded handle (`chevrons-left-right` icon) on top, glow shadow.

**Interaction:** `onMouseDown` on the track starts a drag and immediately picks; a window
`mousemove` listener updates while dragging; `mouseup` ends it. `pick(clientX)` maps the
pointer x within the track's bounding rect to a fraction `p∈[0,1]` and sets
`depIdx = round(p * (N-1))`. The track is `cursor:ew-resize`.
- Changing `depIdx` updates the readout above (hour label, wind/gust, confidence, verdict)
  **and** is two-way bound with the Config bar's Departure `<select>`.
- Production: also touch events; consider snapping to whole hours (already integer) and
  showing a tooltip on hover.

---

## 2. Wind / power / beaufort color scales  ·  `shared.jsx`

```
windColor(kt):  <4 #7fe9c4 · <8 #34e0ff · <12 #4fb0ff · <17 #ffc24b · <22 #ff9b5a · else #ff6b8a
bfColor(bf):    12-stop ramp calm→storm (teal→cyan→blue→violet→amber→orange→rose), index by Beaufort 0–12
PowerBar color: <5 --go · <10 --cyan · <13 --caution · else --nogo;  fill width = min(100, power/14*100)%
```
Wind/gust numbers in tables are tinted with `windColor`. Beaufort chips use `bfColor(bf)` at
`+"22"` alpha for bg and full for text. These scales are the visual language for "how nasty"
— keep them.

---

## 3. The "power" index (domain note)

`power` (0–~14) is a **comfort/exposure score** shown per waypoint — higher = livelier/less
comfortable. In the seed data it's pre-baked. Intended production formula (tune to taste):
roughly a weighted blend of wind speed, gust spread, and wave height at the waypoint's ETA,
e.g. `power ≈ 0.5*wind + 0.25*gust + 2.5*waveHeight_m`, clamped. It drives the PowerBar color
thresholds in §2. It is **not** the GO/NO-GO verdict (that's a separate threshold call).

---

## 4. Forecast chart  ·  `PassageDetail.jsx → ForecastChart`

Input: `SW.fc[waypointName]` — 8 rows `[time, wind, bf, gust, wave, swell]` at 3h steps.
- `maxG` = max gust across the 8 rows; everything scales to `value/maxG * 130px`.
- Each column: an absolutely-positioned translucent **gust** bar (`rgba(255,255,255,.10)`,
  60% width, sits behind) + a colored **wind** bar (70% width, `windColor(wind)`), the wind
  value floating above (`.fc-val`), the time label below, and a "B{bf}" chip under that.
- Columns enter staggered (`animationDelay i*0.04s`, fadeUp).
- Switching `.wp-tab` (or clicking a summary-table row) swaps the dataset and re-animates.

Some waypoints' detailed forecasts are **synthesized** from neighbours in `data.js`
(`synth()` shifts wind by a delta and recomputes beaufort/gust) — in production every
waypoint gets its own sampled forecast, so drop the synth shim.

---

## 5. AI co-skipper  ·  `AIAssistant.jsx`

A chat-style panel that **computes real answers from the loaded timeline/route data** — no
network call in the prototype (deterministic, works offline). Replace with an LLM in
production if desired, but keep the computed fallbacks.

**`bestWindow(timeline)`** — scans for the contiguous run of non-NO-GO hours with the highest
`meanScore * min(len, 8)` (favours long *and* high-confidence windows). Returns
`{ start, end, len, mean }`.

**`answerFor(question, ctx)`** — keyword-routes the question to one of four computed answers,
each returning `{ verdict, title, body, chips:[ [icon,label], … ] }`:
- **orca / касат…** → CAUTION; summarizes the two `orcaZones`, advises staying inside the
  20 m contour past Estaca de Bares, low engine noise, response plan.
- **cape / daylight / мыс** → GO; states cape rounding times (Bares 12:31, Ortegal 15:03)
  vs dusk (~20:50), eased wind & the overnight swell max.
- **overnight / night / ноч** → GO; calm arrival 22:39, warns against departing past 16:00
  (capes after dark + orca).
- **default / "best window"** → GO; uses `bestWindow()` to recommend a departure label,
  window length, mean confidence, max gust, and notes a building NW front after Fri evening.

**UI/behaviour:**
- Header: violet `sparkles` orb + "Co-skipper" + mono "analysing ECMWF_IFS025" + a green
  "live" indicator.
- Body: message list. The first message is the computed best-window answer (greeting). AI
  messages render as a card: a `Verdict` pill + bold title, a dim body paragraph, and a wrap
  of mono "chips" (`pill`s with an icon). User messages are cyan right-aligned bubbles.
- Asking: clicking a suggestion chip appends the user message, shows a **typing indicator**
  (three bobbing violet dots) for ~900ms, then appends the computed answer. Body auto-scrolls
  to bottom on new messages.
- Suggestion chips (bottom, horizontally scrollable): "Best window to depart?", "Any orca
  risk on this route?", "Will I clear both capes in daylight?", "Is it safe overnight?".
- Production: add a free-text input; stream a real model with the route+forecast as context,
  but fall back to `answerFor` if offline.

---

## 6. Map: Leaflet + canvas overlays  ·  `MapView.jsx`

**Leaflet init** (once, on mount):
- `L.map(el, { zoomControl:false, center:[43.62,-8.0], zoom:9, scrollWheelZoom:true })`,
  zoom control added bottom-right, CARTO `dark_all` tiles (subdomains abcd, retina `{r}`).
- Route polylines (glow + dashed), waypoint `divIcon` markers (STOP/CAPE/PORT styles), orca
  `L.circle`s in a toggleable `layerGroup`. `fitBounds(route, pad .35)`.
- Cleanup removes the map on unmount.

**Orca layer toggle:** an effect adds/removes the orca layer group when `layers.orca` flips.

**Animated overlay canvas** (`.map-overlay`, sized to the map via a ResizeObserver + Leaflet
`resize/move/zoom` → `sizeOverlay()`):
- A `requestAnimationFrame` loop reads a `layersRef` (so toggles take effect without
  re-subscribing).
- If `waves` on: paint a soft diagonal heat gradient (cyan→amber→rose, very low alpha).
- If `wind` on: advect ~`(W*H)/9000` particles through a smooth sin/cos **flow field**
  `field(x,y) = sin(x·s + t·…) + cos(y·s·1.2 − t·…) + 0.6` (s≈0.004); draw short additive
  cyan line segments (`hsla(190,95%,70%, α)`), recycle particles past their lifetime/edges.
  Uses `globalCompositeOperation:"lighter"` for the glow.

**Active waypoint state** drives the bottom-left readout; clicking any marker updates it.

> The overlay is **screen-space** (not perfectly geo-locked to pan/zoom) — visually
> convincing and cheap. If you need true geo-accuracy, sample a real GRIB wind field and
> project particle positions through `map.latLngToContainerPoint`.

---

## 7. Full-screen wind background  ·  `WindCanvas.jsx → WindField`

The Dashboard/Passage backdrop particle field (behind the glass). Same idea as §6 but
full-viewport and with a twist: **mouse interaction**. Particles follow a layered flow field;
within ~135px of the cursor they get a tangential (swirl) push, so moving the mouse stirs the
"wind". Trails fade via a translucent dark fill each frame (`rgba(5,13,24,.10)`) +
additive blending; color hue shifts subtly with particle speed (`hsla(190+…, 95%, 68%)`).
Props: `intensity`, `density`, `hueShift`. Respect `prefers-reduced-motion` in production
(pause or drastically thin the field).

Performance: particle count derives from canvas area (`area/14000 * density`); a
ResizeObserver re-seeds on resize; DPR-capped at 2. Keep it on a single canvas; don't animate
DOM nodes.

---

## 8. Entrance & micro-animations

- Views/sections enter with `fadeUp` (16px rise, 0.55–0.6s, `cubic-bezier(.2,.7,.2,1)`).
- Lists (`.stagger`, passage cards, ports, AI chips) delay children by `i*0.05–0.06s`.
- `.glass-hover` cards lift `-3px` and brighten on hover (220ms).
- `--cyan` primary buttons lift `-1px` + intensify glow on hover.
- Pulsing dots: `.live-dot` (green, `pulseDot` ring), marker `pulseRing` on STOP waypoints.
- Count-up numbers on the hero stats (`useCountUp`, cubic ease-out, ~1–1.2s).
- Modal (none now) used `fadeIn` overlay + `fadeUp` panel — pattern retained in tokens for
  future dialogs.

---

## 9. State model

The prototype keeps state local to components. For a real build, model it as:

```ts
// Global-ish (shared across Passage Detail + Chart)
activePassageId: string
departureIndex: number            // 0..47 into the 48h timeline; bound to Config <select> + timeline drag
boatSpeedKt: number               // 3..9, step .5
mode: 'Non-stop' | 'Day-hops'
weatherModel: 'gfs' | 'ecmwf' | 'ens'
units: 'metric'                   // (prototype is metric/kt; add a setting if needed)

// Passage Detail local
openWaypoint: string              // which waypoint's detailed forecast is shown

// Chart local
layers: { wind: boolean; waves: boolean; orca: boolean }
activeWaypoint: Waypoint | null   // drives the readout

// AI panel local
messages: Array<UserMsg | AiMsg>
typing: boolean

// Dashboard local (PortsExplorer)
query: string
portFilter: 'all'|'fuel'|'repair'|'anchor'|'orca'
```

**Derived values** (compute, don't store): overall passage verdict (all-GO / any-NO-GO /
else CAUTION), hero stat totals, `bestWindow(timeline)`, filtered ports.

**Persistence (production):** persist `activePassageId`, `departureIndex`, `boatSpeed`,
`mode`, `weatherModel`, and the user's saved passages/boat profile. The prototype does not
persist (single session). Routes/URLs should encode the active passage + view.

**Recompute triggers:** changing `boatSpeed`/`mode`/`departureIndex`/`weatherModel` should,
in production, re-derive ETAs and re-sample the forecast → new summary table + verdicts +
timeline. In the prototype these controls are wired to state but the seed numbers are static;
implement the recompute when you connect real forecast data (see README §7).

Continue with **`03-data-model.md`**.
