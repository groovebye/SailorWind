# Handoff: SailorWind — Personal Passage Planner

> Weather-aware sailing passage planner, tailored as a **single-user personal tool**
> for the yacht **Bossanova** (Hallberg-Rassy Monsun 31). Plans coastal passages along
> the Atlantic coast (Bay of Biscay → Galicia → Portugal → Gibraltar) with cape-by-cape
> weather forecasts, a live GO/NO-GO departure timeline, an AI "co-skipper", an
> interactive chart with animated wind/wave layers, and an orca-interaction risk watch.

---

## 0. How to read this package

This folder contains:

| Path | What it is |
|---|---|
| `README.md` | This file — start here. High-level overview, fidelity, tokens. |
| `01-views.md` | Screen-by-screen spec: layout, components, exact copy, measurements. |
| `02-interactions-state.md` | Interactions, animations, state model, the wind-field & AI algorithms. |
| `03-data-model.md` | Full data schema + the real seed data (88 ports, passage, forecasts). |
| `screenshots/` | Reference captures of the three views (+ a note: they're approximate — see below). |
| `reference/` | The working HTML/CSS/JSX prototype these specs describe. |

> **On the screenshots:** they're captured with a DOM-to-image tool that doesn't load the web
> fonts, so a few show font-fallback and text-wrap artifacts that **don't happen in a real
> browser**. The live DOM was verified correct. Open `reference/SailorWind.html` for the true
> rendering; see `screenshots/README.md`.

**The files in `reference/` are design references created in HTML** — a prototype that
shows the intended look, motion and behaviour. They are **not** production code to ship
verbatim. The task is to **recreate these designs in your target codebase's environment**
using its established patterns and libraries. If no environment exists yet, pick the most
appropriate stack (the prototype maps cleanly onto **React + TypeScript + Vite**, which is
the recommended target — see §7).

---

## 1. Fidelity

**High-fidelity.** Colors, typography, spacing, motion and interactions are final and
intended to be reproduced precisely. Every token is listed in §4; per-component values are
in `01-views.md`. Reproduce the glassmorphic "glass-over-dark-ocean" aesthetic faithfully —
it is the core of the product's identity.

The prototype is built with React 18 + Babel-in-browser purely so it runs from a single
folder with no build step. **Do not** copy the Babel-in-browser setup into production;
port the components to a real toolchain.

---

## 2. Product in one paragraph

A skipper opens the app to a **Dashboard**: a hero with their boat, a "live conditions"
card, their recent passages, and a searchable table of **88 ports & marinas**. They open a
passage to the **Passage Detail** view — the planning cockpit — where they set departure
time, boat speed, mode and weather model, then read a **passage summary table** (one row
per waypoint with wind/gust/waves/swell/power/verdict), drag a **48-hour GO/NO-GO departure
timeline** to find the cleanest window, ask the **AI co-skipper** questions, and inspect a
per-waypoint **detailed forecast chart**. The **Chart** view shows the route on a dark
Leaflet map with animated wind particles, a wave heatmap, and **orca risk zones**.

It is a **personal, single-user tool** — there is **no** sign-up, paywall, pricing, "Pro"
tier, or social/community layer. (An earlier draft had monetization; it was deliberately
removed. Do not reintroduce it.)

---

## 3. Information architecture & navigation

Three top-level views, switched by a persistent top navigation bar (no router/URL in the
prototype — use real routes in production: `/`, `/passage/:id`, `/passage/:id/chart`).

```
Dashboard ──"Open active passage" / click a passage card──▶ Passage Detail
    │                                                            │
    └──────────────"Open chart" ───────────────────────────────┤
                                                                 ▼
                                                            Chart (Map)
                                              (back button returns to Passage Detail)
```

- **Topbar** is shared across Dashboard & Passage Detail; on the Chart view the topbar is
  replaced by floating glass overlays on the full-bleed map.
- Nav items: **Home** (compass icon), **Passage** (route icon), **Chart** (map icon).
- Right side of topbar: a **boat chip** ("Bossanova / HR Monsun 31") + a settings icon
  button. No account/avatar/upgrade controls.

---

## 4. Design tokens

All tokens live as CSS custom properties in `reference/styles.css` (`:root`). Port them to
your theme system (CSS vars, Tailwind config, design-token JSON — whatever the codebase
uses). Values are authoritative.

### 4.1 Color — surfaces (deep ocean, dark theme)
| Token | Hex | Use |
|---|---|---|
| `--sea-950` | `#03080f` | App base / body background |
| `--sea-900` | `#050d18` | Backdrop gradient base, map container |
| `--sea-850` | `#071322` | Sticky table header bg (with blur) |
| `--sea-800` | `#0a1828` | Raised surfaces |
| `--sea-700` | `#0e2236` | — |
| `--sea-600` | `#143049` | Modal gradient top |

### 4.2 Color — accents (shared chroma, varied hue)
| Token | Hex | Use |
|---|---|---|
| `--cyan` | `#34e0ff` | Primary accent, links, active wind, brand |
| `--cyan-deep` | `#18b6e6` | Primary gradient end |
| `--sky` | `#4fb0ff` | Secondary accent |
| `--foam` | `#8ce8ff` | Light accent |

### 4.3 Color — status / domain
| Token | Hex | Meaning |
|---|---|---|
| `--go` | `#36d399` | Verdict GO; "live" dot |
| `--caution` | `#ffc24b` | Verdict CAUTION; capes; gust warnings; stars |
| `--nogo` | `#ff6b8a` | Verdict NO-GO; high orca risk |
| `--orca` | `#b794ff` | Orca-watch theme (violet) |

**Foreground:** `--fg #eef5fc`, `--fg-dim rgba(238,245,252,.66)`,
`--fg-faint rgba(238,245,252,.40)`, `--fg-ghost rgba(238,245,252,.16)`.

### 4.4 Glass system (the signature surface)
| Token | Value |
|---|---|
| `--glass` | `rgba(255,255,255,0.055)` |
| `--glass-2` | `rgba(255,255,255,0.085)` |
| `--glass-hi` | `rgba(255,255,255,0.13)` |
| `--glass-border` | `rgba(255,255,255,0.12)` |
| `--glass-border-hi` | `rgba(255,255,255,0.22)` |

A `.glass` surface = `background: var(--glass)` + `backdrop-filter: blur(20px) saturate(135%)`
+ `1px solid var(--glass-border)` + `border-radius: var(--r)` (16px) +
`box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,0.06)`.
**The `inset 0 1px 0` top highlight and the backdrop blur are essential** — without them the
glass reads as flat panels.

`.glass-hover` adds `translateY(-3px)` + brighter border/bg on hover (220ms cubic-bezier).

### 4.5 Typography
Three families (Google Fonts):
- **`--serif: "Spectral"`** — display/headings, route names, big numbers. Weights 400–700 + italic 400.
- **`--sans: "Hanken Grotesk"`** — UI & body. Weights 400–800.
- **`--mono: "IBM Plex Mono"`** — all data, labels, timestamps, eyebrows, chips. Weights 400–600.

Recurring text styles:
- `.display` — Spectral 600, `line-height 1.02`, `letter-spacing -0.5px`.
- `.eyebrow` — IBM Plex Mono 500, 12px, `letter-spacing 2.5px`, uppercase, `--cyan`.
- `.stat-num` — IBM Plex Mono 600, `font-variant-numeric: tabular-nums`.
- Hero H1: `clamp(40px, 6vw, 72px)`. Section H2: 28px. Card route names: 22–26px Spectral.

### 4.6 Radius / shadow / motion
| Token | Value |
|---|---|
| `--r-sm` | 10px |
| `--r` | 16px |
| `--r-lg` | 24px |
| `--r-xl` | 32px (modals) |
| `--shadow` | `0 24px 60px -20px rgba(0,0,0,.65)` |
| `--shadow-soft` | `0 12px 40px -16px rgba(0,0,0,.5)` |
| `--glow-cyan` | `0 0 0 1px rgba(52,224,255,.4), 0 0 28px -4px rgba(52,224,255,.5)` |

Standard easing for UI motion: `cubic-bezier(.2,.7,.2,1)`. Entrance animations:
`fadeUp` (translateY 16px→0, 0.55–0.6s) and `fadeIn` (0.5s). Lists use a `.stagger`
pattern with `animationDelay: i * 0.05s`.

### 4.7 Spacing
Loose 4px-ish rhythm. Common gaps: 6/8/10/12/16/20/24px (utility classes `.gap-*`).
Container: `width: min(1320px, 100% - 64px); margin-inline:auto`. Section vertical
rhythm: 64px between dashboard sections; cards pad 18–26px.

---

## 5. Iconography

Icons are **Lucide** (`https://unpkg.com/lucide`). The prototype renders them via a tiny
`<Icon name="..." size stroke/>` wrapper that reads `lucide.icons[PascalName]` and emits an
inline `<svg viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2 round>`.
In production use `lucide-react` (`<Anchor/>`, `<Wind/>`, …) — same icon set, kebab→Pascal
names. Icons used include: `navigation-2, compass, route, map, map-pin, anchor, sailboat,
wind, waves, ripple, fuel, wrench, star, search, plus, arrow-right, arrow-left,
chevron-right, calendar, clock, gauge, satellite, activity, table-2, line-chart, triangle,
alert-triangle, shield-alert, check, x, info, refresh-cw, external-link, settings, bell,
sparkles, radio, shield, sun, sunrise, sunset, moon, thermometer, eye, zap, trending-up,
git-commit-horizontal, chevrons-left-right`.

Do **not** hand-draw bespoke SVG illustrations; the only custom-drawn graphics are the
**data visualizations** (wind-particle canvas, sparkline, forecast bars, timeline bars,
power bars) — these are described in `02-interactions-state.md`.

---

## 6. Responsive behaviour (adaptive: desktop + mobile)

Desktop-first; collapses cleanly. Breakpoints in the prototype:
- **≤1080px**: Passage Detail goes single-column (AI sidebar drops below content, becomes
  non-sticky); config bar → 2 cols; stat row → 2 cols.
- **≤980px**: Dashboard hero → single column; passage grid → 1 col.
- **≤860px**: top nav links hide (replace with a mobile nav/hamburger in production);
  `.hide-mobile` elements hidden; container side padding → 16px.
- **≤720px**: map floating readout & legend hidden, layer panel docks bottom-right.
- **≤560px**: config bar & stat row → 1–2 cols.

The fixed-size assumption is **none** — this is a fluid responsive web app, not a slide
deck. Build it as a normal responsive SPA.

---

## 7. Recommended implementation stack

- **React 18 + TypeScript + Vite** (the components port almost 1:1).
- **lucide-react** for icons.
- **react-leaflet** (or Leaflet directly) for the Chart map. The prototype uses
  Leaflet 1.9.4 with **CARTO dark_all** tiles (`{s}.basemaps.cartocdn.com/dark_all/...`).
- Wind/wave particle layers: a `<canvas>` overlay sized to the map viewport (algorithm in
  `02-interactions-state.md`). No mapping library needed for the particles.
- State: local component state is sufficient for the prototype's scope; introduce a small
  store (Zustand/Context) for the shared "active passage + departure index + units" once
  real data/persistence is added.
- Styling: the prototype is plain CSS with custom properties + utility classes. Port to
  whatever the codebase uses; **keep the token values exact**.

### Real data sources (the prototype data is a faithful static snapshot)
The numbers are real-shaped sample data. In production, wire to:
- **Open-Meteo Marine + Forecast APIs** (free, no key) for wind/gust/wave/swell — supports
  selecting GFS / ECMWF IFS models, matching the model toggle.
- Compute **ETA per waypoint** from boat speed + leg distances; sample the forecast at each
  ETA to fill the summary table.
- **Beaufort** number from wind kt; **"power"** is a comfort/exposure index (see §3 of
  `02-interactions-state.md` for the intended formula).
- Orca zones: GT Orca Atlántica / community sightings feed (static seed for now).

---

## 8. File map (reference/)

| File | Role |
|---|---|
| `SailorWind.html` | Shell: loads fonts, Leaflet, Lucide, React/Babel, then all scripts; mounts `#root`. |
| `styles.css` | All design tokens + global + component CSS. **Source of truth for tokens.** |
| `data.js` | `window.SW` = ports, recent passages, active passage, forecasts, 48h timeline, orca zones. |
| `shared.jsx` | Primitives: `Icon, Glass, Verdict, Sparkline, Stars, Facilities, OrcaChip`, color helpers, `useCountUp`. |
| `WindCanvas.jsx` | `WindField` — full-screen animated flow-field particle background. |
| `AIAssistant.jsx` | `AIAssistant` + `bestWindow()` — co-skipper that computes answers from the timeline. |
| `Dashboard.jsx` | Dashboard view + `PortsExplorer`, `LiveConditions`, `PassageCard`. |
| `PassageDetail.jsx` | Planning view + `DepartureTimeline`, `ForecastChart`, summary table, `OrcaAlert`. |
| `MapView.jsx` | Leaflet chart + canvas wind/wave overlay + layer toggles + waypoint readout. |
| `app.jsx` | `App` shell, top nav, view routing. |

Continue with **`01-views.md`**.
