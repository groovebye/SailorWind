/**
 * Coastal route shape points for accurate passage rendering.
 *
 * Each segment has an ordered array of [lat, lon] points tracing the coastline
 * at ~1-2 NM offshore — the typical passage track for a sailing yacht.
 *
 * Points are ordered W→E / S→N along the coast.
 * Waypoints (ports/capes) snap to the nearest shape point, and the route
 * is drawn through the shape points between them.
 */

// Biscay-north: Gijón → Ribadeo (Asturias coast, heading west)
// Points traced ~1-2 NM offshore
const biscayNorth: [number, number][] = [
  // Gijón area
  [43.560, -5.660],   // off Gijón marina
  [43.575, -5.690],   // heading NW
  [43.590, -5.720],   // off Candás
  [43.610, -5.760],   // approach Cabo Peñas from E
  [43.640, -5.800],   // rounding Cabo Peñas — offshore
  [43.665, -5.850],   // Cabo Peñas — northernmost
  [43.655, -5.880],   // west of Cabo Peñas
  [43.630, -5.800],   // Luanco area (south of cape)
  [43.620, -5.850],   // heading to Avilés
  [43.610, -5.900],   // approach Avilés
  [43.605, -5.930],   // off Avilés entrance
  [43.600, -5.970],   // west of Avilés
  [43.590, -6.020],   // coast continues W
  [43.585, -6.070],   //
  [43.580, -6.120],   // approach Cudillero
  [43.575, -6.150],   // off Cudillero
  [43.570, -6.200],   // west of Cudillero
  [43.565, -6.260],   //
  [43.560, -6.320],   //
  [43.558, -6.380],   //
  [43.555, -6.440],   //
  [43.555, -6.500],   // approach Luarca
  [43.555, -6.535],   // off Luarca
  [43.558, -6.580],   // west of Luarca
  [43.560, -6.630],   //
  [43.562, -6.680],   //
  [43.565, -6.730],   // off Navia
  [43.565, -6.780],   //
  [43.568, -6.830],   //
  [43.570, -6.880],   //
  [43.568, -6.930],   //
  [43.565, -6.980],   //
  [43.560, -7.020],   // approach Ribadeo
  [43.555, -7.042],   // off Ribadeo
];

// Galicia-north: Ribadeo → La Coruña (rounding NW Spain)
const galiciaNorth: [number, number][] = [
  // Ribadeo → Foz
  [43.555, -7.042],   // off Ribadeo (overlap with biscay-north)
  [43.560, -7.080],   //
  [43.565, -7.120],   //
  [43.570, -7.160],   //
  [43.575, -7.200],   //
  [43.580, -7.255],   // off Foz
  // Foz → Viveiro
  [43.590, -7.300],   //
  [43.600, -7.340],   //
  [43.615, -7.380],   //
  [43.630, -7.420],   //
  [43.645, -7.460],   //
  [43.655, -7.500],   //
  [43.660, -7.540],   //
  [43.665, -7.580],   //
  [43.670, -7.595],   // off Viveiro
  // Viveiro → Estaca de Bares
  [43.680, -7.620],   //
  [43.700, -7.640],   //
  [43.720, -7.650],   //
  [43.740, -7.660],   //
  [43.760, -7.670],   //
  [43.780, -7.680],   //
  [43.800, -7.685],   // off Estaca de Bares — keep well offshore
  // Estaca de Bares → Cabo Ortegal
  [43.810, -7.710],   //
  [43.815, -7.740],   //
  [43.810, -7.770],   //
  [43.800, -7.800],   //
  [43.790, -7.830],   //
  [43.785, -7.870],   // off Cabo Ortegal
  // Cabo Ortegal → Cariño
  [43.775, -7.870],   // heading S to Cariño
  [43.755, -7.868],   //
  [43.745, -7.867],   // off Cariño
  // Cariño → Cedeira
  [43.740, -7.880],   //
  [43.730, -7.910],   //
  [43.720, -7.940],   //
  [43.710, -7.970],   //
  [43.700, -8.000],   //
  [43.690, -8.030],   //
  [43.675, -8.055],   // off Cedeira
  // Cedeira → Ferrol
  [43.660, -8.070],   //
  [43.640, -8.090],   //
  [43.620, -8.110],   //
  [43.600, -8.130],   //
  [43.580, -8.150],   //
  [43.560, -8.170],   //
  [43.540, -8.190],   //
  [43.520, -8.210],   //
  [43.500, -8.225],   // approach Ferrol ría
  [43.490, -8.233],   // off Ferrol
  // Ferrol → La Coruña
  [43.480, -8.250],   //
  [43.470, -8.270],   //
  [43.460, -8.290],   //
  [43.445, -8.310],   //
  [43.430, -8.330],   //
  [43.415, -8.350],   //
  [43.400, -8.370],   //
  [43.385, -8.390],   //
  [43.375, -8.400],   // off La Coruña
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
 * Given two waypoints ordered by coastlineNm, returns the shape points
 * between them (inclusive of closest points to start/end).
 */
export function getRouteShape(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  segments: CoastSegment[] = COAST_SEGMENTS
): [number, number][] {
  // Collect all points from all segments
  const allPoints = segments.flatMap(s => s.points);

  // Find nearest shape point to start and end
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

  // Ensure correct order
  const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

  // Build route: from → shape points → to
  const shape: [number, number][] = [
    [fromLat, fromLon],
    ...allPoints.slice(lo, hi + 1),
    [toLat, toLon],
  ];

  return shape;
}
