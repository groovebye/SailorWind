/**
 * Coastal route shape points for accurate passage rendering.
 *
 * Each segment has an ordered array of [lat, lon] points tracing a safe
 * offshore passage track ~1-3 NM off the coast.
 *
 * IMPORTANT: All points MUST be in open water, never on land.
 * Points ordered along the coast from east to west / south to north.
 */

// Biscay-north: Gijón → Ribadeo (Asturias coast, heading west)
// The coast here runs roughly E-W with Cabo Peñas jutting north
const biscayNorth: [number, number][] = [
  // Gijón — port faces north, depart heading NW
  [43.560, -5.660],   // just off Gijón harbor
  [43.575, -5.680],   // heading NW offshore
  [43.595, -5.710],   // well offshore, passing Candás
  [43.620, -5.740],   // continuing NW toward Cabo Peñas
  // Rounding Cabo Peñas — stay 2+ NM off this exposed cape
  [43.650, -5.790],   // approaching cape from E, well offshore
  [43.680, -5.840],   // north of Cabo Peñas, ~2 NM off
  [43.685, -5.870],   // rounding the cape
  [43.675, -5.900],   // past cape heading SW
  // Cabo Peñas to Avilés — coast trends SW
  [43.650, -5.920],   // heading south toward Avilés
  [43.625, -5.930],   // approaching Avilés from N
  [43.610, -5.935],   // off Avilés ría entrance
  // Avilés to Cudillero — coast runs W
  [43.605, -5.960],   // west of Avilés
  [43.600, -6.000],   // offshore heading W
  [43.595, -6.050],   //
  [43.590, -6.100],   //
  [43.585, -6.150],   // off Cudillero
  // Cudillero to Luarca — long W stretch
  [43.585, -6.200],   //
  [43.580, -6.260],   //
  [43.578, -6.320],   //
  [43.575, -6.380],   //
  [43.573, -6.440],   //
  [43.572, -6.500],   //
  [43.570, -6.535],   // off Luarca
  // Luarca to Navia
  [43.572, -6.580],   //
  [43.575, -6.630],   //
  [43.577, -6.680],   //
  [43.580, -6.730],   // off Navia
  // Navia to Ribadeo
  [43.580, -6.780],   //
  [43.578, -6.830],   //
  [43.575, -6.880],   //
  [43.572, -6.930],   //
  [43.568, -6.980],   //
  [43.565, -7.020],   //
  [43.560, -7.042],   // off Ribadeo
];

// Galicia-north: Ribadeo → La Coruña
// Coast turns NW then W rounding the NW corner of Spain
const galiciaNorth: [number, number][] = [
  // Ribadeo → Foz — coast runs NW
  [43.560, -7.042],   // off Ribadeo
  [43.570, -7.080],   //
  [43.580, -7.120],   //
  [43.590, -7.160],   //
  [43.600, -7.200],   //
  [43.610, -7.255],   // off Foz
  // Foz → Viveiro — coast runs NW into large ría
  [43.625, -7.300],   //
  [43.640, -7.340],   //
  [43.660, -7.380],   //
  [43.675, -7.420],   //
  [43.690, -7.460],   //
  [43.700, -7.500],   //
  [43.705, -7.540],   //
  [43.700, -7.580],   //
  [43.695, -7.595],   // off Viveiro (ría entrance)
  // Viveiro → Estaca de Bares — coast goes N to northernmost point
  [43.710, -7.620],   //
  [43.730, -7.640],   //
  [43.750, -7.650],   //
  [43.770, -7.660],   //
  [43.790, -7.670],   //
  // Estaca de Bares — northernmost point of Spain, stay 3+ NM off
  [43.820, -7.680],   // well north of Estaca de Bares
  [43.825, -7.700],   //
  // Estaca de Bares → Cabo Ortegal — coast turns W
  [43.820, -7.730],   //
  [43.815, -7.760],   //
  [43.810, -7.790],   //
  [43.805, -7.820],   //
  // Cabo Ortegal — another major cape, stay well off
  [43.800, -7.860],   // north of Cabo Ortegal
  [43.795, -7.880],   // rounding
  // Cabo Ortegal → Cariño — head S into ría
  [43.780, -7.875],   //
  [43.765, -7.870],   //
  [43.750, -7.867],   // off Cariño
  // Cariño → Cedeira — coast goes SW
  [43.745, -7.890],   //
  [43.735, -7.920],   //
  [43.720, -7.950],   //
  [43.710, -7.980],   //
  [43.700, -8.010],   //
  [43.690, -8.040],   //
  [43.680, -8.057],   // off Cedeira
  // Cedeira → Ferrol — coast goes S along ría
  [43.670, -8.080],   //
  [43.650, -8.110],   //
  [43.620, -8.140],   //
  [43.590, -8.170],   //
  [43.560, -8.195],   //
  [43.530, -8.215],   //
  [43.505, -8.230],   // off Ferrol (ría entrance)
  // Ferrol → La Coruña — coast goes S then SW
  [43.490, -8.250],   //
  [43.470, -8.280],   //
  [43.450, -8.310],   //
  [43.430, -8.340],   //
  [43.410, -8.360],   //
  [43.395, -8.380],   //
  [43.385, -8.400],   // off La Coruña
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
 * Finds the nearest shape points and returns the sub-path.
 */
export function getRouteShape(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  segments: CoastSegment[] = COAST_SEGMENTS
): [number, number][] {
  // Collect all points from all segments in order
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
