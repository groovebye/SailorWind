# Screenshots

Three reference captures of the live prototype:

| File | View | Notes |
|---|---|---|
| `01-dashboard.png` | Dashboard | Hero, live-conditions card, hero stats, recent-passage cards. |
| `02-passage.png` | Passage Detail | Config bar, stat row + verdict, departure-window timeline, AI co-skipper, summary table. |
| `03-chart.png` | Chart | Leaflet route + waypoint markers (STOP circles / CAPE diamonds), dashed orca zones, layer toggles, waypoint readout, wind legend. |

## ⚠️ Read before trusting pixels

These were captured with a **DOM-to-image** tool that **does not load the web fonts**
(Spectral / Hanken Grotesk / IBM Plex Mono) and re-lays-out text with a generic fallback
serif. As a result some captures show **font substitution** and a few **text-wrap / overlap
artifacts** (e.g. the "Recent passages" heading, the AI panel, the timeline readout) that
**do not occur in a real browser** — the live DOM was verified correct (single-line headings,
proper Spectral/mono type, no overlaps).

Likewise the **Chart** map tiles are blank in the capture (no network during capture); in the
browser the dark **CARTO** basemap loads behind the route.

**The `reference/` prototype is the source of truth** for exact typography, spacing and
layout. Open `reference/SailorWind.html` in a browser to see the real rendering. Treat these
PNGs as a guide to overall composition, color, and component inventory — not pixel metrics.
