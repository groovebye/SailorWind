/**
 * GPX 1.1 — plotter-safe export and tolerant import.
 *
 * Export targets the chart plotter on board (Raymarine Axiom / LightHouse,
 * via microSD) and the Navionics Boating app. The safe common denominator:
 * - routes only (<rte>), one per leg — no standalone <wpt> duplicating the
 *   route points, which plotters would import as a second copy;
 * - names ≤ 16 chars of [A-Za-z0-9 _-], unique per file (accents and arrows
 *   stripped). LightHouse rejects — not truncates — longer names or symbols
 *   like ( ? *, and an import can stall on them;
 * - a per-route point cap; longer routes are split into consecutive parts
 *   that share their joining point, so geometry is never altered.
 *
 * Limits (checked 2026-10): LightHouse 4 holds 250 routes × 500 points and
 * 10,000 waypoints, and stores every <rtept> as a waypoint. Navionics Boating
 * imports GPX routes/tracks/markers but publishes no limits.
 *
 * Import accepts what OpenCPN, Raymarine, Navionics and most apps write:
 * <rte>/<rtept>, <trk>/<trkseg>/<trkpt> and <wpt>, namespace prefixes,
 * either attribute order or quote style, CDATA and XML entities.
 *
 * Pure string code — runs in the browser (import preview) and on the server.
 */

import { haversineNm, simplifyPolyline, type LatLon } from "@/lib/geo";

export interface GpxPoint {
  lat: number;
  lon: number;
  name?: string;
}

export interface GpxRoute {
  name?: string;
  points: GpxPoint[];
}

export interface GpxFile {
  name?: string;
  waypoints: GpxPoint[];
  routes: GpxRoute[];
  tracks: GpxRoute[];
  /** Points dropped for missing/out-of-range coordinates. */
  skippedPoints: number;
}

/** Waypoint and route name length every target accepts. */
export const PLOTTER_NAME_MAX = 16;
/** Route points per <rte>: a fifth of LightHouse's 500, room for a full OpenCPN weather route. */
export const PLOTTER_ROUTE_POINTS_MAX = 100;

// ── Names ───────────────────────────────────────────────────────

/** Plotter-safe name: ASCII letters, digits, space, - and _ only, ≤ max chars. */
export function asciiName(raw: string, max = PLOTTER_NAME_MAX): string {
  const s = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[→⇒➔>]+/g, "-")
    .replace(/[^A-Za-z0-9 _-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, max).trim() || "WPT";
}

/** Short leg code from the port names, e.g. Leixoes → Cascais = "LEICAS". */
function legCode(from: string, to: string): string {
  const abbr = (s: string) => asciiName(s).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return abbr(from) + abbr(to);
}

/**
 * Hands out names that are unique across the whole file. The same name may be
 * reused only for the same position (a leg's arrival port is the next leg's
 * departure — one waypoint, not two).
 */
function nameRegistry() {
  const used = new Map<string, LatLon>();
  const samePlace = (a: LatLon, b: LatLon) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  return (wanted: string, at: LatLon): string => {
    let name = wanted;
    for (let n = 2; used.has(name) && !samePlace(used.get(name)!, at); n++) {
      const suffix = String(n);
      name = wanted.slice(0, PLOTTER_NAME_MAX - suffix.length) + suffix;
    }
    used.set(name, at);
    return name;
  };
}

// ── Export ──────────────────────────────────────────────────────

export interface ExportLeg {
  from: string;
  to: string;
  /** Route geometry in order; `label` (e.g. from a GPX import) becomes the point name. */
  points: { lat: number; lon: number; label?: string }[];
}

/**
 * Legs → plotter-safe routes: one route per leg (split into parts above
 * `maxPoints`), departure/arrival named after the ports, intermediate points
 * named by leg code + number (or their own label when they have one).
 */
export function plotterRoutes(legs: ExportLeg[], maxPoints = PLOTTER_ROUTE_POINTS_MAX): GpxRoute[] {
  const uniqueName = nameRegistry();
  const routes: GpxRoute[] = [];
  for (const leg of legs) {
    if (leg.points.length < 2) continue;
    const code = legCode(leg.from, leg.to);
    const last = leg.points.length - 1;
    const points: GpxPoint[] = leg.points.map((p, i) => {
      const wanted =
        i === 0 ? asciiName(leg.from) :
        i === last ? asciiName(leg.to) :
        p.label ? asciiName(p.label) :
        `${code}${String(i).padStart(2, "0")}`;
      return { lat: p.lat, lon: p.lon, name: uniqueName(wanted, [p.lat, p.lon]) };
    });

    const baseName = asciiName(`${leg.from}-${leg.to}`);
    const step = Math.max(2, maxPoints) - 1;
    const parts = Math.ceil((points.length - 1) / step);
    for (let k = 0; k < parts; k++) {
      const chunk = points.slice(k * step, k * step + step + 1);
      const suffix = parts > 1 ? ` ${k + 1}-${parts}` : "";
      routes.push({ name: baseName.slice(0, PLOTTER_NAME_MAX - suffix.length).trim() + suffix, points: chunk });
    }
  }
  return routes;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const coord = (v: number) => v.toFixed(6);

/** Serialize to GPX 1.1. Names are written as given — pass them through plotterRoutes first. */
export function buildGpx(input: { name: string; routes: GpxRoute[]; waypoints?: GpxPoint[]; time?: Date }): string {
  const time = (input.time ?? new Date()).toISOString();
  const wpts = (input.waypoints ?? []).map((p) =>
    `  <wpt lat="${coord(p.lat)}" lon="${coord(p.lon)}">${p.name ? `<name>${escXml(p.name)}</name>` : ""}</wpt>`,
  );
  const rtes = input.routes.map((r) => [
    "  <rte>",
    ...(r.name ? [`    <name>${escXml(r.name)}</name>`] : []),
    ...r.points.map((p) =>
      `    <rtept lat="${coord(p.lat)}" lon="${coord(p.lon)}">${p.name ? `<name>${escXml(p.name)}</name>` : ""}</rtept>`,
    ),
    "  </rte>",
  ].join("\n"));

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="SailorWind" xmlns="http://www.topografix.com/GPX/1/1">`,
    `  <metadata>`,
    `    <name>${escXml(input.name)}</name>`,
    `    <time>${time}</time>`,
    `  </metadata>`,
    ...wpts,
    ...rtes,
    `</gpx>`,
    "",
  ].join("\n");
}

// ── Import ──────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeText(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return raw
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .trim();
}

/** Every <tag …>…</tag> or <tag …/> (optional namespace prefix), non-nested. */
function elements(xml: string, tag: string): { attrs: string; body: string }[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}\\s*>)`, "gi");
  return [...xml.matchAll(re)].map((m) => ({ attrs: m[1] ?? "", body: m[2] ?? "" }));
}

function childText(body: string, tag: string): string | undefined {
  const m = body.match(new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}\\s*>`, "i"));
  if (!m) return undefined;
  const text = decodeText(m[1]);
  return text || undefined;
}

function attr(attrs: string, name: string): number {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']\\s*([^"']+?)\\s*["']`, "i"));
  return m ? Number(m[1]) : NaN;
}

export function parseGpx(xml: string): GpxFile {
  if (!/<(?:[\w-]+:)?gpx\b/i.test(xml)) throw new Error("Not a GPX file");
  let doc = xml.replace(/<!--[\s\S]*?-->/g, "");
  let skippedPoints = 0;

  const points = (body: string, tag: string): GpxPoint[] =>
    elements(body, tag).flatMap(({ attrs, body: inner }) => {
      const lat = attr(attrs, "lat");
      const lon = attr(attrs, "lon");
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        skippedPoints++;
        return [];
      }
      // A point's own <name>, ignoring anything inside its <extensions>.
      const name = childText(inner.replace(/<(?:[\w-]+:)?extensions\b[\s\S]*?<\/(?:[\w-]+:)?extensions\s*>/gi, ""), "name");
      return [{ lat, lon, ...(name ? { name } : {}) }];
    });

  // The route/track's own <name> sits outside its points.
  const ownName = (body: string, pointTag: string) =>
    childText(body.replace(new RegExp(`<(?:[\\w-]+:)?${pointTag}\\b[^>]*?(?:\\/>|>[\\s\\S]*?<\\/(?:[\\w-]+:)?${pointTag}\\s*>)`, "gi"), "")
      .replace(/<(?:[\w-]+:)?extensions\b[\s\S]*?<\/(?:[\w-]+:)?extensions\s*>/gi, ""), "name");

  const routes = elements(doc, "rte").map(({ body }) => ({ name: ownName(body, "rtept"), points: points(body, "rtept") }));
  const tracks = elements(doc, "trk").map(({ body }) => ({ name: ownName(body, "trkpt"), points: points(body, "trkpt") }));
  doc = doc.replace(/<(?:[\w-]+:)?(rte|trk)\b[\s\S]*?<\/(?:[\w-]+:)?\1\s*>/gi, "");
  const waypoints = points(doc, "wpt");
  const metadata = elements(doc, "metadata")[0];
  const name = metadata ? childText(metadata.body, "name") : undefined;

  return { name, waypoints, routes, tracks, skippedPoints };
}

export type ImportSource = "route" | "track" | "waypoints";

/**
 * What to treat as "the route" in an imported file: the first route with ≥ 2
 * points, else the longest track, else the waypoints in file order.
 */
export function pickImportRoute(file: GpxFile): { name?: string; points: GpxPoint[]; source: ImportSource } | null {
  const route = file.routes.find((r) => r.points.length >= 2);
  if (route) return { name: route.name ?? file.name, points: route.points, source: "route" };
  const track = [...file.tracks].sort((a, b) => b.points.length - a.points.length)[0];
  if (track && track.points.length >= 2) return { name: track.name ?? file.name, points: track.points, source: "track" };
  if (file.waypoints.length >= 2) return { name: file.name, points: file.waypoints, source: "waypoints" };
  return null;
}

/** Most points we keep for a leg route; dense tracks are thinned to this. */
export const IMPORT_POINTS_MAX = 300;

type Place = { lat: number; lon: number; name: string };
const dist = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => haversineNm([a.lat, a.lon], [b.lat, b.lon]);

/**
 * Fit an imported line to a leg: orient it from → to (reversing if it was
 * drawn the other way), reject it if an end is nowhere near the leg's port,
 * join it to the ports when it stops short, and thin dense tracks.
 */
export function fitImportedRoute(
  points: GpxPoint[],
  from: Place,
  to: Place,
  opts: { maxEndpointGapNm?: number; joinGapNm?: number } = {},
): { points: { lat: number; lon: number; label?: string }[]; reversed: boolean; warnings: string[] } | { error: string } {
  const maxGap = opts.maxEndpointGapNm ?? 15;
  const joinGap = opts.joinGapNm ?? 0.3;
  if (points.length < 2) return { error: "Need at least 2 points" };

  const warnings: string[] = [];
  let pts = points;
  const first = pts[0], last = pts[pts.length - 1];
  const reversed = dist(first, to) + dist(last, from) < dist(first, from) + dist(last, to);
  if (reversed) {
    pts = [...pts].reverse();
    warnings.push(`Reversed to run ${from.name} → ${to.name}`);
  }

  const startGap = dist(pts[0], from);
  const endGap = dist(pts[pts.length - 1], to);
  if (startGap > maxGap) return { error: `Starts ${startGap.toFixed(1)} NM from ${from.name} — is this the right leg?` };
  if (endGap > maxGap) return { error: `Ends ${endGap.toFixed(1)} NM from ${to.name} — is this the right leg?` };

  if (pts.length > IMPORT_POINTS_MAX) {
    const before = pts.length;
    let eps = 0.02;
    let thinned = pts.map((p) => [p.lat, p.lon] as LatLon);
    while (thinned.length > IMPORT_POINTS_MAX) {
      thinned = simplifyPolyline(pts.map((p) => [p.lat, p.lon] as LatLon), eps);
      eps *= 2;
    }
    const kept = new Set(thinned.map(([lat, lon]) => `${lat},${lon}`));
    pts = pts.filter((p) => kept.has(`${p.lat},${p.lon}`));
    warnings.push(`Thinned ${before} → ${pts.length} points (within ${(eps / 2).toFixed(2)} NM of the original)`);
  }

  const out: { lat: number; lon: number; label?: string }[] = pts.map((p) => ({ lat: p.lat, lon: p.lon, ...(p.name ? { label: p.name } : {}) }));
  if (startGap > joinGap) {
    out.unshift({ lat: from.lat, lon: from.lon, label: from.name });
    warnings.push(`Joined to ${from.name} (${startGap.toFixed(1)} NM)`);
  }
  if (endGap > joinGap) {
    out.push({ lat: to.lat, lon: to.lon, label: to.name });
    warnings.push(`Joined to ${to.name} (${endGap.toFixed(1)} NM)`);
  }
  return { points: out, reversed, warnings };
}
