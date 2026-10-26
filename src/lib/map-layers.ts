/**
 * Layer catalogue for the hub map (/map): every tile source with its licence
 * and attribution, plus Bossanova's home berth. Data only — the map renders it.
 *
 * Tile etiquette (OSM tile usage policy, OpenSeaMap): tiles load only as they
 * are viewed, and the service worker caches only what was viewed. Nothing in
 * the app prefetches an area. See docs/spec-sailing-hub.md §3.
 *
 * All hosts below answer with `Access-Control-Allow-Origin: *` (checked
 * 2026-10-26), so the map loads tiles in CORS mode and the service worker can
 * cache real (non-opaque) responses.
 */

export type TileSource = {
  id: string;
  label: string;
  /** XYZ template, or the WMS endpoint for kind "wms". */
  url: string;
  kind: "xyz" | "wms";
  attribution: string;
  licence: string;
  subdomains?: string;
  maxNativeZoom?: number;
  /** CSS class on the layer's container (e.g. the dark filter). */
  className?: string;
  wms?: { layers: string; styles: string; format: string; transparent: boolean; version: string };
  /** Shown under the toggle. */
  note?: string;
};

export const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
/** Dark look for the OSM tiles, done in CSS (globals.css) — no extra tile source. */
export const DARK_TILE_CLASS = "lf-dark-tiles";
export const EMODNET_ATTR =
  '© <a href="https://emodnet.ec.europa.eu/en/bathymetry">EMODnet Bathymetry Consortium</a> (DTM 2024, CC BY 4.0)';
export const OPEN_METEO_ATTR = 'Weather: <a href="https://open-meteo.com/">Open-Meteo.com</a> (CC BY 4.0)';

/**
 * Both bases are the standard OSM tiles; "Dark" inverts them in CSS. CARTO's
 * free basemaps (used before) now answer every request with an "API KEY
 * REQUIRED" watermark tile (checked 2026-10-26).
 */
export const BASE_LAYERS: TileSource[] = [
  {
    id: "dark",
    label: "Dark",
    kind: "xyz",
    url: OSM_TILE_URL,
    attribution: OSM_ATTR,
    licence: "OSM data ODbL; OSMF tile usage policy (no bulk download or prefetch)",
    maxNativeZoom: 19,
    className: DARK_TILE_CLASS,
  },
  {
    id: "osm",
    label: "OSM",
    kind: "xyz",
    url: OSM_TILE_URL,
    attribution: OSM_ATTR,
    licence: "OSM data ODbL; OSMF tile usage policy (no bulk download or prefetch)",
    maxNativeZoom: 19,
  },
];

export const SEAMARKS: TileSource = {
  id: "seamarks",
  label: "Seamarks",
  kind: "xyz",
  url: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
  attribution: '© <a href="https://www.openseamap.org">OpenSeaMap</a> contributors',
  licence: "CC BY-SA 2.0 tiles, ODbL data; light personal use, no prefetch",
  maxNativeZoom: 18,
};

export type DepthStyle = "mean_multicolour" | "mean_atlas_land";
export const DEPTH_STYLES: { id: DepthStyle; label: string }[] = [
  { id: "mean_multicolour", label: "Multicolour" },
  { id: "mean_atlas_land", label: "Atlas (with land)" },
];

/**
 * EMODnet `emodnet:mean`, served from the project's pre-rendered WMTS cache
 * (same layer and styles as the WMS). The WMS renders per request and was
 * slow and flaky when checked (5× 502, one 15 s answer); the tiles came back
 * in ~0.5 s.
 */
export function depthShaded(style: DepthStyle): TileSource {
  return {
    id: "depth",
    label: "Depth (EMODnet)",
    kind: "xyz",
    url: `https://tiles.emodnet-bathymetry.eu/latest/${style}/web_mercator/{z}/{x}/{y}.png`,
    attribution: EMODNET_ATTR,
    licence: "CC BY 4.0; no warranty, not for navigation",
    maxNativeZoom: 14,
    note: "~115 m grid, not for navigation",
  };
}

/** EMODnet isobaths — only published as WMS. */
export const DEPTH_CONTOURS: TileSource = {
  id: "contours",
  label: "Depth contours (EMODnet)",
  kind: "wms",
  url: "https://ows.emodnet-bathymetry.eu/wms",
  wms: { layers: "emodnet:contours", styles: "", format: "image/png", transparent: true, version: "1.1.1" },
  attribution: EMODNET_ATTR,
  licence: "CC BY 4.0; no warranty, not for navigation",
  note: "WMS, can be slow · not for navigation",
};

export const HOME_BERTH = {
  name: "Marina Porto Atlântico",
  alias: "Marina de Leça",
  vessel: "Bossanova",
  lat: 41.18619,
  lon: -8.70474,
  source: "OSM leisure=marina",
} as const;

/** Degrees and decimal minutes, the plotter's format: 41°11.171′N 008°42.284′W. */
export function formatDdm(lat: number, lon: number): string {
  const part = (v: number, pos: string, neg: string, degWidth: number) => {
    const abs = Math.abs(v);
    let deg = Math.floor(abs);
    let min = Math.round((abs - deg) * 60 * 1000) / 1000;
    if (min >= 60) { deg += 1; min = 0; }
    return `${String(deg).padStart(degWidth, "0")}°${min.toFixed(3).padStart(6, "0")}′${v < 0 ? neg : pos}`;
  };
  return `${part(lat, "N", "S", 2)} ${part(lon, "E", "W", 3)}`;
}

export type WindyOverlay = "wind" | "gust" | "waves" | "swell1";
export const WINDY_OVERLAYS: { id: WindyOverlay; label: string }[] = [
  { id: "wind", label: "Wind" },
  { id: "gust", label: "Gusts" },
  { id: "waves", label: "Waves" },
  { id: "swell1", label: "Swell" },
];

/**
 * Windy's free embed (no key), opened at the hub map's view. SailorWind's own
 * Windy integration is the Point Forecast API (server-side, one update per
 * 6 h), which can't paint a map layer; the embed is the animated view.
 */
export function windyEmbedUrl(view: { lat: number; lon: number; zoom: number }, overlay: WindyOverlay = "wind"): string {
  const q = new URLSearchParams({
    type: "map",
    location: "coordinates",
    metricWind: "kt",
    metricTemp: "°C",
    metricRain: "mm",
    zoom: String(Math.max(3, Math.min(11, Math.round(view.zoom)))),
    overlay,
    product: "ecmwf",
    level: "surface",
    lat: view.lat.toFixed(3),
    lon: view.lon.toFixed(3),
    message: "true",
  });
  return `https://embed.windy.com/embed.html?${q}`;
}
