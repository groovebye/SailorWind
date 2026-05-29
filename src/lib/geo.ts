/**
 * Geodesy — single source of truth for distance/bearing math.
 *
 * Previously haversine was duplicated across passage-computation.ts (km*0.54)
 * and leg-route.ts (NM radius), and angle helpers lived inline in the engine.
 * Everything routes through here now so distances stay consistent project-wide.
 *
 * All distances are nautical miles. Coordinates are [lat, lon] in degrees.
 */

export type LatLon = [number, number];

const EARTH_RADIUS_NM = 3440.065; // mean Earth radius in nautical miles

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Smallest unsigned difference between two bearings, 0..180. */
export function absoluteAngleDiff(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

/** Signed difference a-b in -180..180 (positive = a is clockwise of b). */
export function signedAngleDiff(a: number, b: number): number {
  const diff = normalizeAngle(a - b);
  return diff > 180 ? diff - 360 : diff;
}

/** Great-circle distance between two [lat, lon] points, in nautical miles. */
export function haversineNm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing (degrees true) from one point to another. */
export function bearing(from: LatLon, to: LatLon): number {
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLon = toRad(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeAngle(toDeg(Math.atan2(y, x)));
}

/** Total length of a polyline of [lat, lon] points, in nautical miles. */
export function polylineDistanceNm(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineNm(points[i - 1], points[i]);
  }
  return total;
}

/** Cumulative distance array along a route (cumulative[0] === 0). */
export function buildCumulativeRoute(route: LatLon[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < route.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineNm(route[i - 1], route[i]));
  }
  return cumulative;
}

/** Interpolate the [lat, lon] position at a given distance along a route. */
export function positionAtDistance(
  route: LatLon[],
  cumulativeNm: number[],
  targetNm: number,
): LatLon {
  if (route.length === 0) return [0, 0];
  if (targetNm <= 0) return route[0];
  const total = cumulativeNm[cumulativeNm.length - 1] ?? 0;
  if (targetNm >= total) return route[route.length - 1];

  for (let i = 1; i < cumulativeNm.length; i++) {
    if (cumulativeNm[i] >= targetNm) {
      const prev = cumulativeNm[i - 1];
      const next = cumulativeNm[i];
      const ratio = next === prev ? 0 : (targetNm - prev) / (next - prev);
      const [lat1, lon1] = route[i - 1];
      const [lat2, lon2] = route[i];
      return [lat1 + (lat2 - lat1) * ratio, lon1 + (lon2 - lon1) * ratio];
    }
  }
  return route[route.length - 1];
}
