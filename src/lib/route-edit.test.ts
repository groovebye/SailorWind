import { describe, expect, it } from "vitest";
import { insertMidpoint, midpoints, moveVertex, removeVertex, sameRoute, type RoutePt } from "./route-edit";
import { routePolyline, shallowStretches } from "./searoute";

const route: RoutePt[] = [
  { lat: 41.1853, lon: -8.7036, label: "Leixoes", kind: "departure" },
  { lat: 40.5, lon: -9.0, label: "LEICAS01" },
  { lat: 38.6916, lon: -9.4173, label: "Cascais", kind: "arrival" },
];

describe("route editing", () => {
  it("moves inner points and keeps the ports fixed", () => {
    const moved = moveVertex(route, 1, 40.4, -9.1);
    expect(moved[1]).toEqual({ lat: 40.4, lon: -9.1, label: "LEICAS01" });
    expect(moveVertex(route, 0, 0, 0)).toBe(route);
    expect(moveVertex(route, 2, 0, 0)).toBe(route);
    expect(route[1].lat).toBe(40.5); // not mutated
  });

  it("inserts at a segment's midpoint", () => {
    const out = insertMidpoint(route, 0);
    expect(out).toHaveLength(4);
    expect(out[1]).toEqual({ lat: (41.1853 + 40.5) / 2, lon: (-8.7036 - 9.0) / 2, kind: "manual" });
    expect(insertMidpoint(route, 2)).toBe(route);
  });

  it("removes inner points only", () => {
    expect(removeVertex(route, 1)).toHaveLength(2);
    expect(removeVertex(route, 0)).toBe(route);
    expect(removeVertex(removeVertex(route, 1), 1)).toHaveLength(2);
  });

  it("offers one insert handle per segment", () => {
    expect(midpoints(route).map((m) => m.after)).toEqual([0, 1]);
  });

  it("compares geometry", () => {
    expect(sameRoute(route, route.map((p) => ({ ...p })))).toBe(true);
    expect(sameRoute(route, moveVertex(route, 1, 40, -9))).toBe(false);
    expect(sameRoute(null, null)).toBe(true);
  });
});

describe("shallowStretches", () => {
  const ll = (pts: [number, number][]) => pts.map(([lat, lon]) => ({ lat, lon }));

  it("finds nothing on the auto-routed Leixões → Cascais leg", () => {
    const line = ll(routePolyline([{ lat: 41.1853, lon: -8.7036 }, { lat: 38.6916, lon: -9.4173 }]));
    expect(shallowStretches(line)).toEqual([]);
  });

  it("flags a line drawn across the land", () => {
    const s = shallowStretches(ll([[41.2, -9.2], [40.0, -8.0], [38.6, -9.6]]));
    expect(s.length).toBeGreaterThan(0);
    expect(s.reduce((n, x) => n + x.nm, 0)).toBeGreaterThan(50);
  });

  it("ignores harbour approaches and anything outside the grid", () => {
    // Straight out of Leixões: shallow near the port, then open water.
    expect(shallowStretches(ll([[41.1853, -8.7036], [41.18, -8.9]]))).toEqual([]);
    // Bay of Biscay: no grid there.
    expect(shallowStretches(ll([[45.5, -4], [45.0, -2]]))).toEqual([]);
  });
});
