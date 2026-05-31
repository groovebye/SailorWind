/**
 * Deep-water passage corridor — keeps a drawn route in navigable water instead
 * of letting straight rhumb-lines cut across land (the "line through Santiago"
 * problem).
 *
 * Each node is an offshore clearance point taken from the Reeds Almanac light
 * list ("Lights, etc – Special notes: Cabo Villano to the Portuguese border"),
 * pushed seaward of its light/danger into the 20 m+ band so the track rounds
 * every headland and clears the inshore 5–10 m shallows and the rocks guarding
 * each ría. Ordered N→S along the coast.
 *
 * Routing model: for a leg between two waypoints we project each onto this
 * polyline and splice in the nodes that lie between the two projections. A short
 * leg whose endpoints project to ~the same place (two berths inside one ría)
 * gets no detour; a long offshore leg (La Coruña → Vigo) picks up the whole
 * arc. Endpoints far from the corridor (mid-ocean, other coasts) fall back to a
 * straight line until the corridor is extended to cover them.
 *
 * Coverage today: Galicia W coast, A Coruña → Ría de Vigo. Extend southward as
 * further Reeds light/distance pages are imported.
 */
import { haversineNm, type LatLon } from "./geo";

export type LL = { lat: number; lon: number };

export const CORRIDOR: { name: string; lat: number; lon: number }[] = [
  { name: "A Coruña offing", lat: 43.43, lon: -8.41 },
  { name: "Costa da Morte (N)", lat: 43.38, lon: -8.85 },
  { name: "W of Punta Nariga", lat: 43.3, lon: -9.05 },
  { name: "W of Cabo Villano", lat: 43.16, lon: -9.25 },
  { name: "W of Cabo Toriñán", lat: 43.05, lon: -9.34 },
  { name: "W of Cabo Finisterre", lat: 42.86, lon: -9.34 },
  { name: "W of Ría de Muros", lat: 42.68, lon: -9.15 },
  { name: "W of Cabo Corrubedo", lat: 42.55, lon: -9.13 },
  { name: "W of Isla Sálvora", lat: 42.43, lon: -9.07 },
  { name: "W of Illa de Ons", lat: 42.33, lon: -8.98 },
  { name: "W of Islas Cíes", lat: 42.24, lon: -8.95 },
  { name: "Ría de Vigo — N Chan", lat: 42.255, lon: -8.9 },
];

const PTS: LatLon[] = CORRIDOR.map((n) => [n.lat, n.lon]);

// cumulative arc-length (nm) at each node
const CUM: number[] = (() => {
  const c = [0];
  for (let i = 1; i < PTS.length; i++) c.push(c[i - 1] + haversineNm(PTS[i - 1], PTS[i]));
  return c;
})();

const MAX_OFFSHORE_NM = 15; // endpoint farther than this from the track (e.g. deep
// inside a ría) → keep it local, don't drag the leg out to the offshore corridor
const MIN_SPAN_NM = 4; // projections closer than this → local leg, no detour

/** Nearest point on segment p0→p1 to q, using a local equirectangular frame. */
function projectOnSegment(q: LL, p0: LatLon, p1: LatLon): { pt: LatLon; t: number; dist: number } {
  const lat0 = (p0[0] + p1[0]) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const ax = (p0[1] - q.lon) * k, ay = p0[0] - q.lat;
  const bx = (p1[1] - q.lon) * k, by = p1[0] - q.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const pt: LatLon = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
  return { pt, t, dist: haversineNm([q.lat, q.lon], pt) };
}

/** Project a point onto the whole corridor → {pt, s (nm along), dist}. */
function project(q: LL): { pt: LatLon; s: number; dist: number } {
  let best = { pt: PTS[0], s: 0, dist: Infinity };
  for (let i = 0; i < PTS.length - 1; i++) {
    const r = projectOnSegment(q, PTS[i], PTS[i + 1]);
    if (r.dist < best.dist) {
      const segLen = CUM[i + 1] - CUM[i];
      best = { pt: r.pt, s: CUM[i] + r.t * segLen, dist: r.dist };
    }
  }
  return best;
}

/**
 * Intermediate routing points to splice between waypoints `a` and `b`
 * (exclusive of a and b). Empty when the leg isn't a covered offshore hop.
 */
export function corridorBetween(a: LL, b: LL): LatLon[] {
  const pa = project(a), pb = project(b);
  if (pa.dist > MAX_OFFSHORE_NM || pb.dist > MAX_OFFSHORE_NM) return [];
  if (Math.abs(pa.s - pb.s) < MIN_SPAN_NM) return [];

  const lo = Math.min(pa.s, pb.s), hi = Math.max(pa.s, pb.s);
  const mids: LatLon[] = [];
  for (let i = 0; i < PTS.length; i++) {
    if (CUM[i] > lo + 0.1 && CUM[i] < hi - 0.1) mids.push(PTS[i]);
  }
  // order entry → nodes → exit, in the a→b direction
  const seq = pa.s <= pb.s ? [pa.pt, ...mids, pb.pt] : [pa.pt, ...mids.reverse(), pb.pt];

  // drop near-duplicate consecutive points
  const out: LatLon[] = [];
  for (const p of seq) {
    const last = out[out.length - 1];
    if (!last || haversineNm(last, p) > 0.3) out.push(p);
  }
  return out;
}

/** Full route polyline through the corridor for an ordered waypoint list. */
export function routePolyline(wps: LL[]): LatLon[] {
  const out: LatLon[] = [];
  wps.forEach((w, i) => {
    if (i > 0) out.push(...corridorBetween(wps[i - 1], w));
    out.push([w.lat, w.lon]);
  });
  return out;
}

/** Corridor-aware route distance (nm) for an ordered waypoint list. */
export function routeDistanceNm(wps: LL[]): number {
  const line = routePolyline(wps);
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversineNm(line[i - 1], line[i]);
  return total;
}

/** Corridor nodes that the given route actually rounds (for faint chart marks). */
export function corridorNodesForRoute(wps: LL[]): { name: string; lat: number; lon: number }[] {
  if (wps.length < 2) return [];
  let lo = Infinity, hi = -Infinity, near = false;
  for (const w of wps) {
    const p = project(w);
    if (p.dist <= MAX_OFFSHORE_NM) { near = true; lo = Math.min(lo, p.s); hi = Math.max(hi, p.s); }
  }
  if (!near || hi - lo < MIN_SPAN_NM) return [];
  return CORRIDOR.filter((_, i) => CUM[i] > lo + 0.1 && CUM[i] < hi - 0.1);
}
