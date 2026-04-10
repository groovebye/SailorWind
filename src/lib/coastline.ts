/**
 * Coastal route shape points for accurate passage rendering.
 *
 * All points are verified to be IN THE SEA, ~2-4 NM offshore.
 * The Galician coast is deeply indented with rías — route stays
 * well outside the rías, only entering to reach ports.
 */

// Biscay-north: Gijón → Ribadeo (Asturias coast, heading west)
const biscayNorth: [number, number][] = [
  // Gijón — depart N then NW
  [43.570, -5.660],   // 1.5NM N of Gijón harbor
  [43.590, -5.700],   // offshore heading NW
  [43.610, -5.740],   // well offshore, N of Candás
  // Rounding Cabo Peñas — exposed cape, stay 3NM off
  [43.640, -5.800],   // approaching from E
  [43.690, -5.850],   // N of Cabo Peñas, 3NM off (cape at 43.655)
  [43.690, -5.900],   // past cape heading W
  [43.670, -5.930],   // heading SW toward Avilés
  // Avilés approach
  [43.640, -5.940],   // off Avilés ría entrance
  // Avilés → Cudillero → Luarca — straight W coast
  [43.630, -5.980],   //
  [43.620, -6.050],   //
  [43.610, -6.100],   //
  [43.605, -6.150],   // off Cudillero
  [43.600, -6.250],   //
  [43.595, -6.350],   //
  [43.590, -6.440],   //
  [43.588, -6.530],   // off Luarca
  // Luarca → Navia → Ribadeo
  [43.590, -6.600],   //
  [43.592, -6.680],   //
  [43.595, -6.730],   // off Navia
  [43.595, -6.800],   //
  [43.592, -6.880],   //
  [43.588, -6.950],   //
  [43.582, -7.020],   //
  [43.575, -7.042],   // off Ribadeo ría entrance
];

// Galicia-north: Ribadeo → La Coruña
// KEY: The coast has deep rías. Route stays OUTSIDE them.
// Ports inside rías get a short spur in/out.
const galiciaNorth: [number, number][] = [
  // Ribadeo → Foz — coast runs NNW
  [43.575, -7.042],   // off Ribadeo
  [43.590, -7.100],   //
  [43.605, -7.160],   //
  [43.615, -7.220],   //
  [43.625, -7.255],   // off Foz

  // Foz → Viveiro — coast goes NW, Viveiro is inside a deep ría
  [43.640, -7.300],   //
  [43.660, -7.350],   //
  [43.680, -7.400],   //
  [43.700, -7.450],   //
  [43.710, -7.500],   //
  // Viveiro ría entrance — stay outside, port is deep inside
  [43.720, -7.560],   // off Ría de Viveiro mouth
  [43.710, -7.595],   // brief entry toward Viveiro

  // Viveiro → Estaca de Bares — head N along exposed coast
  // CRITICAL: coast juts far north here, stay well offshore
  [43.720, -7.580],   // back out of ría
  [43.740, -7.600],   //
  [43.760, -7.620],   //
  [43.780, -7.640],   //
  [43.800, -7.660],   //
  // Estaca de Bares — 43.788N is the point, stay 3NM N
  [43.840, -7.680],   // well N of Estaca, 3NM off
  [43.845, -7.710],   // rounding

  // Estaca → Cabo Ortegal — coast turns W
  [43.840, -7.740],   //
  [43.835, -7.770],   //
  [43.830, -7.800],   //
  [43.825, -7.830],   //
  // Cabo Ortegal — 43.770N is the cape, stay 4NM N
  [43.820, -7.870],   // N of Cabo Ortegal

  // Ortegal → Cariño — short run S into Ría de Ortigueira
  [43.800, -7.875],   //
  [43.780, -7.870],   //
  [43.755, -7.867],   // off Cariño

  // Cariño → Cedeira — back out to sea, then W
  // Must go NORTH first to exit ría, then west OFFSHORE
  [43.780, -7.870],   // back out of ría
  [43.810, -7.880],   // well offshore heading W
  [43.800, -7.930],   //
  [43.790, -7.980],   //
  [43.780, -8.020],   //
  // Cedeira is inside Ría de Cedeira
  [43.720, -8.050],   // ría mouth
  [43.695, -8.057],   // off Cedeira

  // Cedeira → Ferrol — back out, head S offshore
  [43.720, -8.050],   // back out of ría
  [43.750, -8.080],   // well offshore
  [43.730, -8.120],   //
  [43.700, -8.160],   //
  [43.670, -8.190],   //
  [43.640, -8.210],   //
  // Ferrol — inside Ría de Ferrol (narrow entrance)
  [43.620, -8.220],   // ría entrance
  [43.510, -8.233],   // off Ferrol (deep inside ría)

  // Ferrol → La Coruña — back out to open sea, then S
  [43.620, -8.220],   // back out of ría
  [43.640, -8.250],   // offshore
  [43.610, -8.290],   //
  [43.570, -8.330],   //
  [43.530, -8.360],   //
  [43.490, -8.380],   //
  [43.450, -8.395],   //
  [43.410, -8.400],   // off La Coruña (outer harbor)
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
