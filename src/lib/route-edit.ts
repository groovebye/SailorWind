/**
 * Route editing on the hub map: pure operations on a leg's point list. The
 * first and last points are the ports and stay put; the map edits the rest.
 */

export type RoutePt = { lat: number; lon: number; label?: string; kind?: string };

const isEnd = (pts: RoutePt[], i: number) => i <= 0 || i >= pts.length - 1;

export function moveVertex(pts: RoutePt[], i: number, lat: number, lon: number): RoutePt[] {
  if (isEnd(pts, i)) return pts;
  return pts.map((p, k) => (k === i ? { ...p, lat, lon } : p));
}

/** Insert a new point halfway along segment i → i+1. */
export function insertMidpoint(pts: RoutePt[], i: number): RoutePt[] {
  if (i < 0 || i >= pts.length - 1) return pts;
  const a = pts[i], b = pts[i + 1];
  const mid: RoutePt = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2, kind: "manual" };
  return [...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)];
}

export function removeVertex(pts: RoutePt[], i: number): RoutePt[] {
  if (isEnd(pts, i)) return pts;
  return pts.filter((_, k) => k !== i);
}

/** Handles for "insert here", one per segment; `after` is the segment's start index. */
export function midpoints(pts: RoutePt[]): { lat: number; lon: number; after: number }[] {
  return pts.slice(0, -1).map((a, i) => ({ lat: (a.lat + pts[i + 1].lat) / 2, lon: (a.lon + pts[i + 1].lon) / 2, after: i }));
}

export function sameRoute(a: RoutePt[] | null, b: RoutePt[] | null): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((p, i) => p.lat === b[i].lat && p.lon === b[i].lon);
}
