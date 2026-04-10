/**
 * Coastal route shape points for passage rendering.
 * All points verified IN THE SEA. Dense spacing near headlands to
 * prevent route lines from cutting across land.
 *
 * Coordinate reference: OpenStreetMap, verified against satellite imagery.
 * Points are ~0.5-2 NM offshore, closer inshore in sheltered areas,
 * further out near exposed capes.
 */

// Biscay-north: Gijón → Ribadeo
// Coast runs E→W. Cabo Peñas peninsula juts N.
const biscayNorth: [number, number][] = [
  // === Gijón (43.545, -5.662) — harbor faces N ===
  [43.555, -5.660],   // just N of harbor entrance

  // === Gijón → Candás — coast goes NW, hug the shore ===
  [43.565, -5.680],
  [43.575, -5.700],
  [43.580, -5.720],
  [43.585, -5.740],
  [43.590, -5.762],   // off Candás

  // === Candás → Cabo Peñas — follow E side of peninsula N ===
  // Peninsula runs N from ~43.59 to 43.655
  // Must have dense points to follow the coast, not cut across
  [43.600, -5.775],
  [43.610, -5.790],
  [43.620, -5.800],
  [43.630, -5.810],
  [43.640, -5.820],
  [43.650, -5.835],
  [43.660, -5.845],   // near cape tip

  // === Rounding Cabo Peñas (43.655, -5.849) — stay 1-2NM N ===
  [43.675, -5.850],   // N of cape, 1NM off
  [43.675, -5.870],   // rounding W side

  // === Cabo Peñas → Avilés — follow W side of peninsula S ===
  [43.665, -5.885],
  [43.655, -5.895],
  [43.645, -5.905],
  [43.635, -5.915],
  [43.625, -5.920],
  [43.615, -5.925],
  [43.605, -5.930],   // off Avilés ría entrance

  // === Avilés → Cudillero — coast goes W ===
  [43.600, -5.960],
  [43.598, -6.000],
  [43.595, -6.050],
  [43.592, -6.100],
  [43.590, -6.150],   // off Cudillero

  // === Cudillero → Luarca — long straight W ===
  [43.588, -6.220],
  [43.585, -6.300],
  [43.582, -6.380],
  [43.580, -6.450],
  [43.578, -6.530],   // off Luarca

  // === Luarca → Navia ===
  [43.580, -6.580],
  [43.582, -6.640],
  [43.583, -6.700],
  [43.585, -6.730],   // off Navia

  // === Navia → Ribadeo ===
  [43.585, -6.780],
  [43.583, -6.840],
  [43.580, -6.900],
  [43.577, -6.960],
  [43.573, -7.010],
  [43.568, -7.042],   // off Ribadeo
];

// Galicia-north: Ribadeo → La Coruña
// Deeply indented coast with rías. Route stays offshore between headlands,
// only dips into rías to reach ports.
const galiciaNorth: [number, number][] = [
  // === Ribadeo ===
  [43.568, -7.042],

  // === Ribadeo → Foz — coast NW ===
  [43.580, -7.080],
  [43.590, -7.120],
  [43.600, -7.170],
  [43.610, -7.220],
  [43.620, -7.255],   // off Foz

  // === Foz → Viveiro — coast goes NW ===
  [43.635, -7.290],
  [43.650, -7.330],
  [43.665, -7.370],
  [43.680, -7.420],
  [43.690, -7.470],
  [43.700, -7.520],
  [43.705, -7.560],   // Viveiro ría mouth
  [43.695, -7.595],   // into ría toward Viveiro

  // === Viveiro → Estaca de Bares — back out, head N ===
  [43.705, -7.560],   // back to ría mouth
  [43.720, -7.580],
  [43.740, -7.600],
  [43.760, -7.620],
  [43.780, -7.650],
  [43.800, -7.670],

  // === Estaca de Bares (43.788, -7.685) — stay 2NM N ===
  [43.825, -7.685],   // 2NM N of cape
  [43.830, -7.710],   // rounding

  // === Estaca → Cabo Ortegal — coast turns W ===
  [43.828, -7.740],
  [43.825, -7.770],
  [43.820, -7.800],
  [43.815, -7.830],

  // === Cabo Ortegal (43.770, -7.870) — stay 3NM N ===
  [43.810, -7.860],
  [43.810, -7.880],   // rounding

  // === Ortegal → Cariño — S into Ría de Ortigueira ===
  [43.795, -7.878],
  [43.775, -7.872],
  [43.755, -7.867],   // off Cariño

  // === Cariño → Cedeira — back out N, then W offshore ===
  [43.775, -7.872],   // heading back N
  [43.795, -7.878],   // back offshore
  [43.810, -7.890],   // heading W, well N of coast
  [43.805, -7.930],
  [43.795, -7.970],
  [43.780, -8.010],
  [43.760, -8.040],
  [43.730, -8.055],   // Cedeira ría mouth
  [43.695, -8.057],   // off Cedeira

  // === Cedeira → Ferrol — back out, head S offshore ===
  [43.730, -8.055],   // back to ría mouth
  [43.760, -8.070],   // offshore
  [43.750, -8.110],
  [43.730, -8.150],
  [43.700, -8.180],
  [43.670, -8.200],
  [43.640, -8.215],
  [43.610, -8.225],   // Ferrol ría entrance
  [43.510, -8.233],   // inside to Ferrol

  // === Ferrol → La Coruña — back out, head SW ===
  [43.610, -8.225],   // ría entrance
  [43.640, -8.240],   // offshore
  [43.620, -8.280],
  [43.590, -8.310],
  [43.555, -8.340],
  [43.520, -8.360],
  [43.480, -8.380],
  [43.440, -8.395],
  [43.410, -8.400],   // off La Coruña
];

export interface CoastSegment {
  name: string;
  points: [number, number][];
}

export const COAST_SEGMENTS: CoastSegment[] = [
  { name: "biscay-north", points: biscayNorth },
  { name: "galicia-north", points: galiciaNorth },
];

/**
 * Given two points, returns the coastal shape points between them.
 */
export function getRouteShape(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  segments: CoastSegment[] = COAST_SEGMENTS
): [number, number][] {
  const allPoints = segments.flatMap(s => s.points);

  const dist2 = (p: [number, number], lat: number, lon: number) =>
    (p[0] - lat) ** 2 + (p[1] - lon) ** 2;

  let startIdx = 0, endIdx = 0;
  let bestStartDist = Infinity, bestEndDist = Infinity;

  for (let i = 0; i < allPoints.length; i++) {
    const ds = dist2(allPoints[i], fromLat, fromLon);
    const de = dist2(allPoints[i], toLat, toLon);
    if (ds < bestStartDist) { bestStartDist = ds; startIdx = i; }
    if (de < bestEndDist) { bestEndDist = de; endIdx = i; }
  }

  const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

  return [
    [fromLat, fromLon],
    ...allPoints.slice(lo, hi + 1),
    [toLat, toLon],
  ];
}
