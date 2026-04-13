/**
 * Hand-authored coastal routing graph for North Spain.
 *
 * The model is intentionally simple:
 * - sparse offshore corridor nodes at headlands and major turns
 * - short branch nodes for ports and rías
 * - shortest-path routing across this graph
 *
 * This avoids the "cut across the cape / loop around twice" behavior that
 * appeared when we tried to over-simplify the geometry.
 */

export type LatLon = [number, number];

export interface RoutePort {
  name: string;
  lat: number;
  lon: number;
}

type ManualRouteKey = `${string}__${string}`;

const NAV_POINTS = {
  "Gijón": [43.5453, -5.6621],
  "Candás": [43.5883, -5.7617],
  "Cabo Peñas": [43.6553, -5.8492],
  "Luanco": [43.6117, -5.7917],
  "Avilés": [43.5917, -5.9250],
  "Cudillero": [43.5633, -6.1500],
  "Luarca": [43.5417, -6.5333],
  "Navia": [43.5500, -6.7283],
  "Ribadeo": [43.5350, -7.0417],
  "Foz": [43.5717, -7.2550],
  "Burela": [43.6617, -7.3583],
  "Viveiro": [43.6617, -7.5950],
  "Estaca de Bares": [43.7883, -7.6850],
  "Cabo Ortegal": [43.7700, -7.8700],
  "Cariño": [43.7367, -7.8667],
  "Cedeira": [43.6600, -8.0567],
  "Ferrol": [43.4833, -8.2333],
  "Sada": [43.3550, -8.2550],
  "La Coruña": [43.3700, -8.4000],
  "Cabo Peñas Rounding": [43.675, -5.850],
  "Estaca de Bares Rounding": [43.825, -7.685],
  "Cabo Ortegal Rounding": [43.810, -7.880],

  "gijon-exit-1": [43.547, -5.648],
  "gijon-exit-2": [43.555, -5.646],
  "gijon-offshore": [43.565, -5.660],
  "gijon-west": [43.585, -5.705],
  "candas-entry": [43.594, -5.756],
  "candas-offshore": [43.606, -5.780],
  "penas-east-1": [43.615, -5.790],
  "penas-east-2": [43.645, -5.820],
  "penas-tip-offshore": [43.660, -5.845],
  "penas-north": [43.675, -5.850],
  "penas-west": [43.676, -5.878],
  "penas-west-1": [43.645, -5.905],
  "aviles-offshore": [43.605, -5.930],
  "asturias-west-1": [43.598, -6.000],
  "cudillero-exit": [43.570, -6.165],
  "cudillero-offshore": [43.578, -6.185],
  "luarca-offshore": [43.578, -6.530],
  "navia-offshore": [43.585, -6.730],
  "ribadeo-offshore": [43.568, -7.042],
  "galicia-west-1": [43.590, -7.120],
  "foz-offshore": [43.620, -7.255],
  "burela-offshore": [43.680, -7.358],
  "galicia-west-2": [43.665, -7.370],
  "viveiro-mouth": [43.705, -7.560],
  "viveiro-inner": [43.695, -7.595],
  "estaca-north": [43.825, -7.685],
  "ortegal-west": [43.810, -7.880],
  "carino-inner-1": [43.795, -7.878],
  "carino-inner-2": [43.775, -7.872],
  "carino-inner-3": [43.755, -7.867],
  "galicia-west-3": [43.795, -7.970],
  "cedeira-mouth": [43.730, -8.055],
  "cedeira-inner": [43.695, -8.057],
  "ferrol-offshore": [43.640, -8.215],
  "ferrol-inner-1": [43.610, -8.225],
  "ferrol-inner-2": [43.560, -8.225],
  "ferrol-inner-3": [43.510, -8.233],
  "coruna-offshore": [43.620, -8.280],
  "sada-offshore": [43.370, -8.255],
  "coruna-approach": [43.410, -8.400],
} satisfies Record<string, LatLon>;

type PointId = keyof typeof NAV_POINTS;

const EDGE_LIST: readonly [PointId, PointId][] = [
  ["Gijón", "gijon-exit-1"],
  ["gijon-exit-1", "gijon-exit-2"],
  ["gijon-exit-2", "gijon-offshore"],
  ["gijon-offshore", "gijon-west"],
  ["gijon-west", "candas-offshore"],
  ["Candás", "candas-entry"],
  ["candas-entry", "candas-offshore"],
  ["candas-offshore", "penas-east-1"],
  ["penas-east-1", "penas-east-2"],
  ["Luanco", "penas-east-2"],
  ["candas-offshore", "penas-north"],
  ["penas-east-2", "penas-north"],
  ["penas-north", "penas-tip-offshore"],
  ["Cabo Peñas", "penas-tip-offshore"],
  ["Cabo Peñas Rounding", "penas-north"],
  ["penas-north", "penas-west"],
  ["penas-west", "penas-west-1"],
  ["penas-west-1", "aviles-offshore"],
  ["Avilés", "aviles-offshore"],
  ["aviles-offshore", "asturias-west-1"],
  ["asturias-west-1", "cudillero-offshore"],
  ["cudillero-exit", "cudillero-offshore"],
  ["Cudillero", "cudillero-exit"],
  ["cudillero-offshore", "penas-west-1"],
  ["cudillero-offshore", "luarca-offshore"],
  ["Luarca", "luarca-offshore"],
  ["luarca-offshore", "navia-offshore"],
  ["Navia", "navia-offshore"],
  ["navia-offshore", "ribadeo-offshore"],
  ["Ribadeo", "ribadeo-offshore"],
  ["ribadeo-offshore", "galicia-west-1"],
  ["galicia-west-1", "foz-offshore"],
  ["Foz", "foz-offshore"],
  ["foz-offshore", "burela-offshore"],
  ["Burela", "burela-offshore"],
  ["burela-offshore", "galicia-west-2"],
  ["galicia-west-2", "viveiro-mouth"],
  ["viveiro-mouth", "viveiro-inner"],
  ["viveiro-inner", "Viveiro"],
  ["viveiro-mouth", "estaca-north"],
  ["Estaca de Bares", "estaca-north"],
  ["Estaca de Bares Rounding", "estaca-north"],
  ["estaca-north", "ortegal-west"],
  ["Cabo Ortegal", "ortegal-west"],
  ["Cabo Ortegal Rounding", "ortegal-west"],
  ["ortegal-west", "carino-inner-1"],
  ["carino-inner-1", "carino-inner-2"],
  ["carino-inner-2", "carino-inner-3"],
  ["carino-inner-3", "Cariño"],
  ["ortegal-west", "galicia-west-3"],
  ["galicia-west-3", "cedeira-mouth"],
  ["cedeira-mouth", "cedeira-inner"],
  ["cedeira-inner", "Cedeira"],
  ["cedeira-mouth", "ferrol-offshore"],
  ["ferrol-offshore", "ferrol-inner-1"],
  ["ferrol-inner-1", "ferrol-inner-2"],
  ["ferrol-inner-2", "ferrol-inner-3"],
  ["ferrol-inner-3", "Ferrol"],
  ["ferrol-offshore", "coruna-offshore"],
  ["coruna-offshore", "sada-offshore"],
  ["Sada", "sada-offshore"],
  ["sada-offshore", "coruna-approach"],
  ["coruna-approach", "La Coruña"],
] as const;

function point(id: PointId): LatLon {
  return NAV_POINTS[id];
}

function distance(a: PointId, b: PointId): number {
  const [alat, alon] = point(a);
  const [blat, blon] = point(b);
  return Math.hypot(alat - blat, alon - blon);
}

function buildGraph(): Map<PointId, Array<{ to: PointId; cost: number }>> {
  const graph = new Map<PointId, Array<{ to: PointId; cost: number }>>();

  for (const id of Object.keys(NAV_POINTS) as PointId[]) {
    graph.set(id, []);
  }

  for (const [from, to] of EDGE_LIST) {
    const cost = distance(from, to);
    graph.get(from)!.push({ to, cost });
    graph.get(to)!.push({ to: from, cost });
  }

  return graph;
}

const ROUTING_GRAPH = buildGraph();

const MANUAL_ROUTE_OVERRIDES: Partial<Record<ManualRouteKey, LatLon[]>> = {
  "Cudillero__Cabo Peñas Rounding": [
    [43.5633, -6.1500],
    [43.5700, -6.1650],
    [43.5850, -6.1100],
    [43.6100, -6.0100],
    [43.6450, -5.9050],
    [43.6750, -5.8500],
  ],
  "Avilés__Cabo Peñas Rounding": [
    [43.5917, -5.9250],
    [43.6050, -5.9300],
    [43.6200, -5.9200],
    [43.6450, -5.9050],
    [43.6750, -5.8500],
  ],
  "Cabo Peñas Rounding__Candás": [
    [43.6750, -5.8500],
    [43.6500, -5.8100],
    [43.6200, -5.7500],
    [43.6000, -5.7480],
    [43.5940, -5.7560],
    [43.5883, -5.7617],
  ],
  "Cabo Peñas Rounding__Gijón": [
    [43.6750, -5.8500],
    [43.6500, -5.8100],
    [43.6200, -5.7500],
    [43.5850, -5.7050],
    [43.5650, -5.6600],
    [43.5550, -5.6460],
    [43.5470, -5.6480],
    [43.5453, -5.6621],
  ],
};

function manualRouteKey(from: string, to: string): ManualRouteKey {
  return `${from}__${to}`;
}

function reverseRoute(points: LatLon[]): LatLon[] {
  return [...points].reverse();
}

function manualRoute(from: string, to: string): LatLon[] | null {
  const forward = MANUAL_ROUTE_OVERRIDES[manualRouteKey(from, to)];
  if (forward) return forward;

  const backward = MANUAL_ROUTE_OVERRIDES[manualRouteKey(to, from)];
  if (backward) return reverseRoute(backward);

  return null;
}

function shortestPath(from: PointId, to: PointId): PointId[] | null {
  const queue = new Set<PointId>(Object.keys(NAV_POINTS) as PointId[]);
  const best = new Map<PointId, number>();
  const prev = new Map<PointId, PointId | null>();

  for (const node of queue) {
    best.set(node, Number.POSITIVE_INFINITY);
    prev.set(node, null);
  }
  best.set(from, 0);

  while (queue.size > 0) {
    let current: PointId | null = null;
    let currentCost = Number.POSITIVE_INFINITY;

    for (const node of queue) {
      const cost = best.get(node)!;
      if (cost < currentCost) {
        current = node;
        currentCost = cost;
      }
    }

    if (current === null || currentCost === Number.POSITIVE_INFINITY) {
      break;
    }

    queue.delete(current);

    if (current === to) {
      const path: PointId[] = [];
      let walk: PointId | null = current;
      while (walk) {
        path.push(walk);
        walk = prev.get(walk) ?? null;
      }
      return path.reverse();
    }

    for (const edge of ROUTING_GRAPH.get(current) ?? []) {
      if (!queue.has(edge.to)) continue;
      const nextCost = currentCost + edge.cost;
      if (nextCost < best.get(edge.to)!) {
        best.set(edge.to, nextCost);
        prev.set(edge.to, current);
      }
    }
  }

  return null;
}

function dedupe(points: LatLon[]): LatLon[] {
  const result: LatLon[] = [];
  for (const current of points) {
    const prev = result[result.length - 1];
    if (!prev || prev[0] !== current[0] || prev[1] !== current[1]) {
      result.push(current);
    }
  }
  return result;
}

export function buildSeaRoute(from: RoutePort, to: RoutePort): LatLon[] {
  const handcrafted = manualRoute(from.name, to.name);
  if (handcrafted) {
    return dedupe(handcrafted);
  }

  const fromId = from.name as PointId;
  const toId = to.name as PointId;

  if (!(fromId in NAV_POINTS) || !(toId in NAV_POINTS)) {
    return [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ];
  }

  const routeIds = shortestPath(fromId, toId);
  if (!routeIds || routeIds.length === 0) {
    return [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ];
  }

  return dedupe(routeIds.map(point));
}
