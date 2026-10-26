# SailorWind product strategy

_Decisions recorded 2026-10-26, from the Sailing knowledge-base session with Alex. Licence and terms checks were done the same day. Companion: [roadmap-planning-brain.md](roadmap-planning-brain.md)._

## 1. Positioning

- **SailorWind is a passage-planning tool, not a chartplotter.** It does not compete with Navionics on charts.
  - Charts on board stay Navionics on the Raymarine Axiom 9.
  - SailorWind never offers "navigate by this".
- **Value:** planning.
  - Weather plus the boat's polar.
  - Pessimistic / realistic / optimistic scenarios.
  - Departure windows and day planning (relax and bail-out stops, daylight arrival).
  - Motoring and fuel.
  - **Route export to the plotter.**
- **Weather routing today** runs in OpenCPN 5.14.2 + Weather Routing on the Mac.
  - Its boat polar is a copy of SailorWind's seed (`Sailing/boat/polar/bossanova.pol`).
  - SailorWind takes OpenCPN's route in by GPX import and sends the final route to the Axiom by GPX export.
  - An in-app router is roadmap item R8.
- **"AI" is internal only:**
  - No external LLM.
  - The routing core stays deterministic: isochrones, depth- and coast-aware search.
  - ML is only a helper: learning real polars from logs, ETA, comfort and sea-state scoring.
  - *Status:* compliant today.
    - No LLM or external AI calls anywhere in `src/`.
    - The cockpit "AI Co-skipper" is rule-based (`AICoskipper.tsx`).
- **Alex's planning style**, which the product encodes:
  - ~9 h days, 11 h at most.
  - 5–7 kn under sail; 4.5–5.5 kn when conservative.
  - Engine ~6 kn at 2.5 L/h (2500 rpm) from a 60 L tank.
  - Tides, swell and bar entrances matter.
  - Boat: Bossanova, HR Monsun 31, draft ~1.45 m, currently in Leixões.
  - Next leg: Porto → Lisboa, ~163–172 NM. Optional stops at Figueira da Foz, Peniche, Nazaré or Cascais.

## 2. Constraints for any App Store or public release

1. **OSM/OpenSeaMap data is ODbL.**
   - It needs the visible attribution "© OpenStreetMap contributors, OpenSeaMap".
   - Share-alike applies if a *derived database* is distributed, so keep proprietary data (curated marinas, prices, lore) in a separate database from anything derived from OSM.
   - Today `/api/seamarks` queries Overpass (OSM data) live.
2. **No bulk or offline tile downloads from the public OSM/OpenSeaMap servers.** Offline maps need our own tile hosting, or a provider that allows offline use.
3. **No GPL code in an App Store app.**
   - OpenCPN is GPLv2: use it alongside, never embed it.
   - Prefer permissive libraries: Leaflet (BSD-2), MapLibre (BSD-3).
4. **Apple** requires:
   - rights to all content;
   - a privacy policy;
   - a justification for background location.
5. **EU Product Liability Directive (EU) 2024/2853** ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402853)):
   - Software is a "product" (Art. 4(1)).
   - Strict liability applies to products placed on the market after **9 Dec 2026** (Art. 2(1), 22).
   - Free/open-source software is excluded only outside commercial activity. A price, or personal data used beyond security, counts as commercial (Art. 2(2), Recital 14).
   - Therefore:
     - Position the product as a **planning tool**, with "not for navigation" next to every route and export.
     - Consider a company plus product-liability insurance before charging anyone.
6. **The data sources themselves say "not for navigation".**
   - EMODnet Bathymetry metadata: "DO NOT USE FOR NAVIGATION".
   - Open-Meteo Marine docs: not suitable for coastal navigation.
   - This supports the planning-tool position; the UI must say it too.

## 3. Dependency licence audit

Run over `package-lock.json` (666 packages, 2026-10-26).

**Summary**
- MIT 536 · Apache-2.0 54 · ISC 26 · MPL-2.0 13 · LGPL-3.0+ 10 (+4 mixed) · BSD-2 10 · BSD-3 4 · Hippocratic-2.1 2 · one each of BlueOak, Python-2.0, CC-BY-4.0, CC0, Unlicense and 0BSD.
- One package (`seq-queue`) has no `license` field in its manifest, but its LICENSE file is MIT.

**No GPL or AGPL anywhere in the tree.**

| Flag | Packages | Runtime? | Assessment |
|---|---|---|---|
| ⚠️ **Hippocratic License 2.1** (not OSI-approved, an "ethical source" licence) | `react-leaflet` 5.0.0, `@react-leaflet/core` 3.0.0 (direct dependency) | **Yes**, shipped in the client bundle | Usage restrictions (human-rights laws and principles), mandatory public arbitration, an indemnity clause, and termination on breach. Not GPL, but **get legal review before any commercial or App Store release**. Easy exit: use Leaflet (BSD-2) directly, which the chart view already half does (`ChartView.tsx` uses raw `L`), or MapLibre GL (BSD-3) with `react-map-gl` (MIT). |
| LGPL-3.0-or-later | `@img/sharp-libvips-*`, `@img/sharp-win32-*`, `@img/sharp-wasm32` (optional, via `next` → `sharp`) | Server only, for image optimisation | Dynamically linked and not distributed to users from a server, so no obligation in practice. If a native app ever bundled `sharp`, LGPL relinking terms would apply; it should not need to. |
| MPL-2.0 | `lightningcss*`, `axe-core` | Build and dev only | File-level copyleft, applying only if those files are modified and distributed. No issue. |
| CC-BY-4.0 | `caniuse-lite` | Build only (browserslist data) | Attribution in licence notices. No issue. |
| BlueOak-1.0.0, Python-2.0, CC0, Unlicense, 0BSD | `minimatch` (dev), `argparse` (dev), `language-subtag-registry` (dev), `postgres`, `tslib` | Mixed | Permissive. No issue. |

**Not in npm, but in the stack:**
- OpenCPN and its Weather Routing plugin are GPL. That is fine as a separate desktop tool; never vendor its code.
- The Python build scripts use GDAL (MIT/X) and are not shipped.

## 4. External data and API terms

Checked 2026-10-26; URLs are the sources. Quotes are kept to the strings the terms require.

### Windy ([terms](https://account.windy.com/agreements/windy-api-map-and-point-forecast-terms-of-use), [pricing](https://api.windy.com/point-forecast/pricing))

SailorWind uses three Windy services today:
- the **Point Forecast API**, server-side (`/api/forecast/windy`, key `WINDY_API_KEY`);
- **embed.windy.com** iframes on the leg page;
- the **Webcams API**.

| | Free / testing | Paid |
|---|---|---|
| Point Forecast | 500 calls/day; **"randomly shuffled and slightly modified data"**, development only, not for production | Professional **990 €/yr**, 10k calls/day, no ECMWF |
| Map Forecast | 500 sessions/day, GFS only | Professional 990 €/yr; ECMWF add-on 1,000 € (internal use only) |
| Webcams | Image URLs expire after 15 min, must link to windy.com, ads | Professional 9,990 €/yr |

Terms that matter:
- **The trial key may not be used in production.** **Action now:** check which key prod uses. If it is the testing key, the Windy numbers in SailorWind are deliberately scrambled. Disable the Windy source, or buy Professional.
- **Commercial use is not banned, but the Windy service may not sit only behind a paywall.** A Windy-powered feature available only in a paid tier breaks the terms. The same rule applies to the Webcams free tier.
- **Public applications** are keyed to user domains and designed for browsers. That fits a native App Store app poorly; this is our inference, so ask Windy before building on it.
- **Attribution and use:**
  - The Windy logo must be unscaled, clickable and fully opaque.
  - The required text is "Contains data from the Windy database" (in mobile apps, in the About section).
  - Webcams require "Webcams provided by windy.com - add new webcam" with links.
- **No storing or extracting data, no databases built from it, no redistribution.**
  - **Conflict:** SailorWind caches Windy forecasts in `Passage.forecastCache` and through the service worker.
  - That is acceptable for a private tool; a public release must drop it.
- **Direct competitors are barred.** A public SailorWind with weather maps may count as one; ask Windy before relying on Windy.

**Recommendation:** treat Windy as optional. Open-Meteo plus an own GRIB pipeline covers the planning core. Keep the embed widgets only with the logo and branding intact.

### Open-Meteo ([terms](https://open-meteo.com/en/terms), [pricing](https://open-meteo.com/en/pricing), [licence](https://open-meteo.com/en/licence))

- **The free API is non-commercial only.** Subscriptions or ads make an app commercial.
- Free limits: 600 calls/min, 5,000/h, 10,000/day, 300k/month.
- **Commercial plans** use `customer-api.open-meteo.com` with an API key:
  - Standard: €29/mo for 1M calls.
  - Professional: €99/mo for 5M calls.
  - The Marine API is included.
- **Data licence: CC BY 4.0.** Put "Weather data by Open-Meteo.com", linked, next to wherever the data is shown. The Marine API also asks for DWD attribution for ICON Wave.
- **Impact:**
  - Today's private use is fine.
  - A public release needs the paid plan.
  - It also needs the API key moved server-side: the cockpit currently calls Open-Meteo directly from the browser (`_cockpit/forecast.ts`).
  - Route sampling (roadmap §2.3) raises the call count per leg. It is still well inside the limits with the 3 h cache.

### Maps, tiles, bathymetry

| Source | Licence and policy | SailorWind today | Release action |
|---|---|---|---|
| **OSM tiles** ([policy](https://operations.osmfoundation.org/policies/tiles/)) | No bulk "scraping", no prefetch, no .mbtiles, **no "download for offline"**. Attribution, a unique User-Agent and honouring cache headers are required. No SLA. | `sw.js` caches `tile.openstreetmap.org` tiles cache-first (LRU 800). Only viewed tiles, but an offline cache is exactly the grey zone. | Self-host or use a provider that permits offline use. Drop OSM hosts from the tile cache. |
| **OpenSeaMap** ([FAQ](https://www.openseamap.org/index.php?id=faq&L=1)) | Tiles CC BY-SA 2.0, data ODbL. Commercial use is OK with attribution and share-alike. **No published tile-usage policy found.** | Seamark overlay from `tiles.openseamap.org`, also in the SW tile cache. **No "OpenSeaMap" attribution on the layer.** `MarinaMiniMap` sets `attributionControl={false}`, so there is **no attribution at all** there. | Add "© OpenStreetMap contributors, OpenSeaMap" on every map. Ask the project before any offline use. |
| **CARTO basemaps** | Free tier is commonly described as non-commercial with a mapview cap. **Unverified here; check CARTO's terms.** | Default dark/voyager basemap. | Verify; budget for a commercial basemap or self-host. |
| **Esri / ArcGIS Online** | Requires an ArcGIS account for commercial use. **Unverified.** | Host listed in the SW tile cache. | Verify or remove. |
| **EMODnet Bathymetry** ([terms](https://emodnet.ec.europa.eu/en/terms-use-emodnet-online-services-data-and-data-products)) | **CC BY 4.0.** Credit "EMODnet Bathymetry Consortium, EMODnet Digital Bathymetry (DTM 2024)", [doi](https://doi.org/10.12770/cf51df64-56f9-4a99-b1aa-36b8d7b743a1). No liability; **not for navigation.** | Navgrid, contours and the depth overlay ("© EMODnet Bathymetry" on the chart view only). | Full credit line on every depth display and in the About screen. |

### Plotter interop: why the export looks the way it does

- **Raymarine LightHouse 4** ([capacity](https://docs.raymarine.com/81406/en-US/latest/WaypointAndRouteCapacity-41A776EB.html), [import](https://docs.raymarine.com/81406/en-US/latest/ImportingUserData-2C52381B.html)):
  - Limits: 10,000 waypoints, and 250 routes × 500 points.
  - Every route point is stored as a waypoint.
  - Imports `.gpx` from microSD: My data → Import/export → Import from card.
- **Name limits:**
  - Raymarine's own pages say 16 characters, letters, digits, `_`, `-` and space. A 2019 moderator post says LH3 raised waypoint names to 32; that is unverified for LH4.
  - Over-long or symbol-laden names are rejected rather than truncated, and imports have stalled on them. Hence the 16-character ASCII rule.
- **Navionics Boating** imports and exports GPX tracks, routes and markers with an active subscription. Plotter Sync moves routes to compatible Raymarine MFDs on LH3 3.10+. **Navionics publishes no point or name limits** (unverified), so we keep 100 points per route.

## 5. Before any public release: checklist

- [ ] Legal review of the `react-leaflet` Hippocratic licence, or migrate to plain Leaflet or MapLibre.
- [ ] Open-Meteo commercial plan; move the browser calls server-side; attribution next to the data.
- [ ] Windy: confirm the key tier now. Otherwise drop Windy, or get Professional plus written OK for app use, with no paywall-only Windy features and no caching.
- [ ] Map attribution everywhere, including the marina mini-map: OSM, OpenSeaMap, CARTO, EMODnet.
- [ ] Own tile hosting, or an offline-permitting provider, before any offline-maps feature. Remove OSM and OpenSeaMap from the SW tile cache.
- [ ] Verify the CARTO and Esri terms.
- [ ] Keep proprietary data (curated marinas, prices, lore) in a separate DB from ODbL-derived data.
- [ ] "Planning tool — not for navigation" on routes, exports and windows. Privacy policy. Background-location justification if location is ever tracked.
- [ ] Company plus product-liability insurance before charging, given the PLD from 9 Dec 2026.
