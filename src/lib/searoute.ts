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
import { distanceToSegmentNm, haversineNm, type LatLon } from "./geo";
import { NAVGRID_B64, NAVGRID_META } from "./navgrid.data";
import { NAVGRID_NL_B64, NAVGRID_NL_META } from "./navgrid-nl.data";

export type LL = { lat: number; lon: number };

/** One regional navigable-water bitmask (np.packbits, MSB-first, row-major from latMax/lonMin). */
type Grid = {
  name: string;
  latMax: number; lonMin: number; res: number; rows: number; cols: number;
  bits: Uint8Array;
  /** Search-window padding around a leg's endpoints, in cells. */
  pad: number;
  /** Forbid diagonal steps between two blocked orthogonal cells (thin dikes). */
  noCornerCut: boolean;
};

function decode(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  // Node fallback
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

function makeGrid(
  name: string,
  meta: { latMax: number; lonMin: number; res: number; rows: number; cols: number },
  b64: string,
  padDeg: number,
  noCornerCut: boolean,
): Grid {
  const { latMax, lonMin, res, rows, cols } = meta;
  return { name, latMax, lonMin, res, rows, cols, bits: decode(b64), pad: Math.round(padDeg / res), noCornerCut };
}

/**
 * Covered regions, most specific first:
 * - IJsselmeer + Markermeer (Rijkswaterstaat 2022 bathymetry, >= 2.2 m at winter level;
 *   the lakes connect only through the Houtribdijk locks)
 * - Atlantic Iberia, A Coruña → Gibraltar (EMODnet, >= 20 m)
 */
const GRIDS: Grid[] = [
  makeGrid("ijsselmeer", NAVGRID_NL_META, NAVGRID_NL_B64, 0.25, true),
  makeGrid("iberia", NAVGRID_META, NAVGRID_B64, 0.7, true),
];

const cellRow = (g: Grid, lat: number) => Math.round((g.latMax - lat) / g.res - 0.5);
const cellCol = (g: Grid, lon: number) => Math.round((lon - g.lonMin) / g.res - 0.5);
const cellLat = (g: Grid, r: number) => g.latMax - (r + 0.5) * g.res;
const cellLon = (g: Grid, c: number) => g.lonMin + (c + 0.5) * g.res;

function nav(g: Grid, r: number, c: number): boolean {
  if (r < 0 || r >= g.rows || c < 0 || c >= g.cols) return false;
  const i = r * g.cols + c;
  return (g.bits[i >> 3] & (1 << (7 - (i & 7)))) !== 0;
}

const inGrid = (g: Grid, lat: number, lon: number) => {
  const r = cellRow(g, lat), c = cellCol(g, lon);
  return r >= 0 && r < g.rows && c >= 0 && c < g.cols;
};

/** The grid covering both points (null → straight-line fallback). */
const gridFor = (a: LL, b: LL) => GRIDS.find((g) => inGrid(g, a.lat, a.lon) && inGrid(g, b.lat, b.lon)) ?? null;

/** Nearest navigable cell to (r,c) within `maxRad` cells, or null. */
function snap(g: Grid, r: number, c: number, maxRad = 90): [number, number] | null {
  if (nav(g, r, c)) return [r, c];
  for (let rad = 1; rad <= maxRad; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        if (nav(g, r + dr, c + dc)) return [r + dr, c + dc];
      }
    }
  }
  return null;
}

const NB = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

/** A* between two lat/lon points → list of cell-centre [lat,lon], or null. */
function aStar(G: Grid, a: LL, b: LL): LatLon[] | null {
  const s = snap(G, cellRow(G, a.lat), cellCol(G, a.lon));
  const g = snap(G, cellRow(G, b.lat), cellCol(G, b.lon));
  if (!s || !g) return null;

  // confine the search to a padded window around the endpoints (perf + memory)
  const r0 = Math.max(0, Math.min(s[0], g[0]) - G.pad);
  const r1 = Math.min(G.rows - 1, Math.max(s[0], g[0]) + G.pad);
  const c0 = Math.max(0, Math.min(s[1], g[1]) - G.pad);
  const c1 = Math.min(G.cols - 1, Math.max(s[1], g[1]) + G.pad);
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

  const gll: LatLon = [cellLat(G, g[0]), cellLon(G, g[1])];
  const sId = lid(s[0], s[1]), gId = lid(g[0], g[1]);
  gScore[sId] = 0;
  push(haversineNm([cellLat(G, s[0]), cellLon(G, s[1])], gll), sId);

  while (hn > 0) {
    const cur = pop();
    if (cur === gId) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cr = r0 + Math.floor(cur / W), cc = c0 + (cur % W);
    const curLL: LatLon = [cellLat(G, cr), cellLon(G, cc)];
    for (const [dr, dc] of NB) {
      const nr = cr + dr, nc = cc + dc;
      if (nr < r0 || nr > r1 || nc < c0 || nc > c1 || !nav(G, nr, nc)) continue;
      // no squeezing diagonally between two blocked cells (e.g. through a one-cell dike)
      if (G.noCornerCut && dr !== 0 && dc !== 0 && !nav(G, cr + dr, cc) && !nav(G, cr, cc + dc)) continue;
      const nid = lid(nr, nc);
      if (closed[nid]) continue;
      const t = gScore[cur] + haversineNm(curLL, [cellLat(G, nr), cellLon(G, nc)]);
      if (t < gScore[nid]) {
        gScore[nid] = t; came[nid] = cur;
        push(t + haversineNm([cellLat(G, nr), cellLon(G, nc)], gll), nid);
      }
    }
  }
  if (came[gId] === -1 && gId !== sId) return null;

  const path: LatLon[] = [];
  for (let id = gId; id !== -1; id = came[id]) {
    const r = r0 + Math.floor(id / W), c = c0 + (id % W);
    path.push([cellLat(G, r), cellLon(G, c)]);
    if (id === sId) break;
  }
  path.reverse();
  return path;
}

/** True if the straight segment p→q stays on navigable cells (sampled every half cell). */
function clearLine(G: Grid, p: LatLon, q: LatLon): boolean {
  const steps = Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / (G.res / 2)) + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!nav(G, cellRow(G, p[0] + (q[0] - p[0]) * t), cellCol(G, p[1] + (q[1] - p[1]) * t))) return false;
  }
  return true;
}

/**
 * Douglas–Peucker that only keeps a shortcut when it stays in navigable water,
 * so simplifying the A* staircase never cuts a corner across land, a dike or
 * the shallows.
 */
function simplifyClear(G: Grid, pts: LatLon[], epsNm: number): LatLon[] {
  if (pts.length <= 2) return pts;
  const first = pts[0], last = pts[pts.length - 1];
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distanceToSegmentNm(pts[i], first, last);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= epsNm && clearLine(G, first, last)) return [first, last];
  if (idx === 0) idx = pts.length >> 1;
  const left = simplifyClear(G, pts.slice(0, idx + 1), epsNm);
  const right = simplifyClear(G, pts.slice(idx), epsNm);
  return [...left.slice(0, -1), ...right];
}

const cache = new Map<string, LatLon[]>();
const key = (a: LL, b: LL) => `${a.lat.toFixed(3)},${a.lon.toFixed(3)}|${b.lat.toFixed(3)},${b.lon.toFixed(3)}`;

/** Navigable route between two points: [start, ...sea waypoints..., end]. */
export function seaRoute(a: LL, b: LL): LatLon[] {
  const k = key(a, b);
  const hit = cache.get(k);
  if (hit) return hit;
  const grid = gridFor(a, b);
  const cells = grid ? aStar(grid, a, b) : null;
  const line: LatLon[] = cells && cells.length > 1
    ? [[a.lat, a.lon], ...simplifyClear(grid!, cells, 0.15), [b.lat, b.lon]]
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

export type ShallowStretch = { start: LL; end: LL; nm: number };

/**
 * Stretches of a hand-drawn route that cross land or water shallower than the
 * grid's safe depth (20 m Iberia, 2.2 m IJsselmeer). The first and last `endClearNm` are ignored —
 * harbour approaches are always shallow — and so is anything outside the
 * grid. Sampled every ~0.1 NM; stretches shorter than `minNm` are dropped
 * (corner-cutting noise). A warning aid for editing, not a safety check.
 */
export function shallowStretches(points: LL[], endClearNm = 3, minNm = 0.2): ShallowStretch[] {
  const out: ShallowStretch[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineNm([points[i - 1].lat, points[i - 1].lon], [points[i].lat, points[i].lon]);

  let open: { start: LL; startNm: number; end: LL; endNm: number } | null = null;
  const close = () => {
    if (open && open.endNm - open.startNm >= minNm) {
      out.push({ start: open.start, end: open.end, nm: Math.round((open.endNm - open.startNm) * 10) / 10 });
    }
    open = null;
  };

  let along = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const seg = haversineNm([a.lat, a.lon], [b.lat, b.lon]);
    const n = Math.max(1, Math.ceil(seg / 0.1));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      const p = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
      const d = along + seg * t;
      const g = d >= endClearNm && d <= total - endClearNm ? GRIDS.find((gr) => inGrid(gr, p.lat, p.lon)) : undefined;
      const shallow = !!g && !nav(g, cellRow(g, p.lat), cellCol(g, p.lon));
      if (shallow) {
        if (!open) open = { start: p, startNm: d, end: p, endNm: d };
        else { open.end = p; open.endNm = d; }
      } else {
        close();
      }
    }
    along += seg;
  }
  close();
  return out;
}

/**
 * Coast segments that are enclosed waters (lakes), where the linear
 * coastlineNm ordering means nothing: stops and bail-outs are picked by their
 * distance from the routed line instead.
 */
export const LAKE_SEGMENTS: ReadonlySet<string> = new Set(["ijsselmeer"]);

/** Max off-track distance (nm) for a lake port to count as "along the way". */
export const lakeCorridorNm = (routeNm: number) => Math.max(3, Math.min(8, routeNm * 0.3));

/** Cumulative distance (nm) at each vertex of a polyline. */
export function cumulativeNm(line: LatLon[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < line.length; i++) cum[i] = cum[i - 1] + haversineNm(line[i - 1], line[i]);
  return cum;
}

/** A point's along-track (nm from the start) and off-track (nm) position on a routed polyline. */
export function projectOnRoute(p: LL, line: LatLon[], cum: number[]): { along: number; off: number } {
  let along = 0, off = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const k = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
    const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p.lon * k, py = p.lat;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = haversineNm([p.lat, p.lon], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    if (d < off) { off = d; along = cum[i] + t * (cum[i + 1] - cum[i]); }
  }
  return { along, off };
}

/**
 * Along-track distance (nm from `from`) of each point, projected onto the routed
 * from→to polyline. One A* run, then cheap projection per point. Useful for
 * "how far along the passage is this port" (bail-out ports, waypoint list).
 */
export function alongRouteNm(from: LL, to: LL, pts: LL[]): number[] {
  return projectAlongRoute(from, to, pts).map((p) => p.along);
}

/** Like alongRouteNm, plus each point's off-track distance and the route total. */
export function projectAlongRoute(from: LL, to: LL, pts: LL[]): { along: number; off: number; total: number }[] {
  const line = routePolyline([from, to]);
  const cum = cumulativeNm(line);
  const total = cum[cum.length - 1] ?? 0;
  return pts.map((p) => ({ ...projectOnRoute(p, line, cum), total }));
}
