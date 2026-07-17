/**
 * Sea routing — A* pathfinding over a navigable-water grid so a drawn route
 * follows real navigable water instead of a straight rhumb-line across land.
 *
 * The grid (src/lib/navgrid.data.ts, built by scripts/build-navgrid.py from
 * EMODnet bathymetry) marks every cell as navigable only where charted depth is
 * >= safeDepthM (20 m). A* therefore physically cannot cross land or shallows —
 * it threads the >= 20 m band around every headland and ría, for any start/end
 * on the covered coast (A Coruña → Gibraltar). Legs whose endpoints fall outside
 * the grid, or where no water path exists, fall back to a straight line.
 *
 * Runs identically on server and client (grid is bundled), so the chart, the
 * distance readout and the cockpit ETAs all use the same path.
 */
import { haversineNm, type LatLon } from "./geo";
import { NAVGRID_B64, NAVGRID_META } from "./navgrid.data";

export type LL = { lat: number; lon: number };

const { latMax, lonMin, res, rows, cols } = NAVGRID_META;

const BITS: Uint8Array = (() => {
  if (typeof atob === "function") {
    const bin = atob(NAVGRID_B64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  // Node fallback
  return Uint8Array.from(Buffer.from(NAVGRID_B64, "base64"));
})();

// np.packbits is MSB-first
function nav(r: number, c: number): boolean {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
  const i = r * cols + c;
  return (BITS[i >> 3] & (1 << (7 - (i & 7)))) !== 0;
}
const cellRow = (lat: number) => Math.round((latMax - lat) / res - 0.5);
const cellCol = (lon: number) => Math.round((lon - lonMin) / res - 0.5);
const cellLat = (r: number) => latMax - (r + 0.5) * res;
const cellLon = (c: number) => lonMin + (c + 0.5) * res;

/** Nearest navigable cell to (r,c) within `maxRad` cells, or null. */
function snap(r: number, c: number, maxRad = 90): [number, number] | null {
  if (nav(r, c)) return [r, c];
  for (let rad = 1; rad <= maxRad; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        if (nav(r + dr, c + dc)) return [r + dr, c + dc];
      }
    }
  }
  return null;
}

const NB = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
const PAD = Math.round(0.7 / res); // search-window padding around the leg, in cells

/** A* between two lat/lon points → list of cell-centre [lat,lon], or null. */
function aStar(a: LL, b: LL): LatLon[] | null {
  const s = snap(cellRow(a.lat), cellCol(a.lon));
  const g = snap(cellRow(b.lat), cellCol(b.lon));
  if (!s || !g) return null;

  // confine the search to a padded window around the endpoints (perf + memory)
  const r0 = Math.max(0, Math.min(s[0], g[0]) - PAD);
  const r1 = Math.min(rows - 1, Math.max(s[0], g[0]) + PAD);
  const c0 = Math.max(0, Math.min(s[1], g[1]) - PAD);
  const c1 = Math.min(cols - 1, Math.max(s[1], g[1]) + PAD);
  const W = c1 - c0 + 1, H = r1 - r0 + 1, N = W * H;
  const lid = (r: number, c: number) => (r - r0) * W + (c - c0);

  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);

  // binary min-heap over local ids, keyed by fScore
  const hF = new Float64Array(N + 1);
  const hId = new Int32Array(N + 1);
  let hn = 0;
  const push = (f: number, id: number) => {
    let i = ++hn; hF[i] = f; hId[i] = id;
    while (i > 1) { const p = i >> 1; if (hF[p] <= hF[i]) break; [hF[p], hF[i]] = [hF[i], hF[p]]; [hId[p], hId[i]] = [hId[i], hId[p]]; i = p; }
  };
  const pop = () => {
    const id = hId[1]; hF[1] = hF[hn]; hId[1] = hId[hn]; hn--;
    let i = 1;
    for (;;) { const l = i << 1, r = l + 1; let m = i;
      if (l <= hn && hF[l] < hF[m]) m = l; if (r <= hn && hF[r] < hF[m]) m = r;
      if (m === i) break; [hF[m], hF[i]] = [hF[i], hF[m]]; [hId[m], hId[i]] = [hId[i], hId[m]]; i = m; }
    return id;
  };

  const gll: LatLon = [cellLat(g[0]), cellLon(g[1])];
  const sId = lid(s[0], s[1]), gId = lid(g[0], g[1]);
  gScore[sId] = 0;
  push(haversineNm([cellLat(s[0]), cellLon(s[1])], gll), sId);

  while (hn > 0) {
    const cur = pop();
    if (cur === gId) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cr = r0 + Math.floor(cur / W), cc = c0 + (cur % W);
    const curLL: LatLon = [cellLat(cr), cellLon(cc)];
    for (const [dr, dc] of NB) {
      const nr = cr + dr, nc = cc + dc;
      if (nr < r0 || nr > r1 || nc < c0 || nc > c1 || !nav(nr, nc)) continue;
      const nid = lid(nr, nc);
      if (closed[nid]) continue;
      const t = gScore[cur] + haversineNm(curLL, [cellLat(nr), cellLon(nc)]);
      if (t < gScore[nid]) {
        gScore[nid] = t; came[nid] = cur;
        push(t + haversineNm([cellLat(nr), cellLon(nc)], gll), nid);
      }
    }
  }
  if (came[gId] === -1 && gId !== sId) return null;

  const path: LatLon[] = [];
  for (let id = gId; id !== -1; id = came[id]) {
    const r = r0 + Math.floor(id / W), c = c0 + (id % W);
    path.push([cellLat(r), cellLon(c)]);
    if (id === sId) break;
  }
  path.reverse();
  return path;
}

/** Perpendicular distance (nm) of p from segment a→b, local planar approx. */
function perpNm(p: LatLon, a: LatLon, b: LatLon): number {
  const k = Math.cos((a[0] * Math.PI) / 180);
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return haversineNm(p, a);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return haversineNm(p, [ay + dy * t, (ax + dx * t) / k]);
}

/** Douglas–Peucker simplification, epsilon in nm. */
function simplify(pts: LatLon[], epsNm: number): LatLon[] {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpNm(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= epsNm) return [pts[0], pts[pts.length - 1]];
  const left = simplify(pts.slice(0, idx + 1), epsNm);
  const right = simplify(pts.slice(idx), epsNm);
  return [...left.slice(0, -1), ...right];
}

const cache = new Map<string, LatLon[]>();
const key = (a: LL, b: LL) => `${a.lat.toFixed(3)},${a.lon.toFixed(3)}|${b.lat.toFixed(3)},${b.lon.toFixed(3)}`;

/** Navigable route between two points: [start, ...sea waypoints..., end]. */
export function seaRoute(a: LL, b: LL): LatLon[] {
  const k = key(a, b);
  const hit = cache.get(k);
  if (hit) return hit;
  const cells = aStar(a, b);
  const line: LatLon[] = cells && cells.length > 1
    ? [[a.lat, a.lon], ...simplify(cells, 0.15), [b.lat, b.lon]]
    : [[a.lat, a.lon], [b.lat, b.lon]]; // fallback: outside grid / no water path
  cache.set(k, line);
  return line;
}

/** Full route polyline through navigable water for an ordered waypoint list. */
export function routePolyline(wps: LL[]): LatLon[] {
  const out: LatLon[] = [];
  wps.forEach((w, i) => {
    if (i === 0) { out.push([w.lat, w.lon]); return; }
    const seg = seaRoute(wps[i - 1], w);
    out.push(...seg.slice(1)); // seg[0] === previous waypoint, already present
  });
  return out;
}

/** Navigable route distance (nm) for an ordered waypoint list. */
export function routeDistanceNm(wps: LL[]): number {
  const line = routePolyline(wps);
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversineNm(line[i - 1], line[i]);
  return total;
}

/**
 * Along-track distance (nm from `from`) of each point, projected onto the routed
 * from→to polyline. One A* run, then cheap projection per point. Useful for
 * "how far along the passage is this port" (bail-out ports, waypoint list).
 */
export function alongRouteNm(from: LL, to: LL, pts: LL[]): number[] {
  const line = routePolyline([from, to]);
  const cum: number[] = [0];
  for (let i = 1; i < line.length; i++) cum[i] = cum[i - 1] + haversineNm(line[i - 1], line[i]);
  return pts.map((p) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const k = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
      const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p.lon * k, py = p.lat;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = haversineNm([p.lat, p.lon], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      if (d < bestD) { bestD = d; best = cum[i] + t * (cum[i + 1] - cum[i]); }
    }
    return best;
  });
}
