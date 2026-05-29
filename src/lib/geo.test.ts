import { describe, it, expect } from "vitest";
import {
  haversineNm,
  bearing,
  absoluteAngleDiff,
  signedAngleDiff,
  normalizeAngle,
  polylineDistanceNm,
  buildCumulativeRoute,
  positionAtDistance,
  type LatLon,
} from "@/lib/geo";

describe("haversineNm", () => {
  it("1 degree of latitude ≈ 60 NM", () => {
    expect(haversineNm([0, 0], [1, 0])).toBeCloseTo(60.04, 1);
  });
  it("1 degree of longitude at equator ≈ 60 NM", () => {
    expect(haversineNm([0, 0], [0, 1])).toBeCloseTo(60.04, 1);
  });
  it("is symmetric", () => {
    const a: LatLon = [43.5453, -5.6621];
    const b: LatLon = [43.37, -8.4];
    expect(haversineNm(a, b)).toBeCloseTo(haversineNm(b, a), 6);
  });
  it("is zero for identical points", () => {
    expect(haversineNm([43.5, -5.6], [43.5, -5.6])).toBe(0);
  });
});

describe("bearing", () => {
  it("due north", () => expect(bearing([0, 0], [1, 0])).toBeCloseTo(0, 1));
  it("due east", () => expect(bearing([0, 0], [0, 1])).toBeCloseTo(90, 1));
  it("due south", () => expect(bearing([1, 0], [0, 0])).toBeCloseTo(180, 1));
  it("due west", () => expect(bearing([0, 1], [0, 0])).toBeCloseTo(270, 1));
});

describe("angle helpers", () => {
  it("normalizeAngle wraps into 0..360", () => {
    expect(normalizeAngle(-10)).toBe(350);
    expect(normalizeAngle(370)).toBe(10);
  });
  it("absoluteAngleDiff never exceeds 180", () => {
    expect(absoluteAngleDiff(10, 350)).toBe(20);
    expect(absoluteAngleDiff(0, 180)).toBe(180);
  });
  it("signedAngleDiff is signed in -180..180", () => {
    expect(signedAngleDiff(10, 350)).toBe(20);
    expect(signedAngleDiff(350, 10)).toBe(-20);
  });
});

describe("polyline + position", () => {
  const route: LatLon[] = [
    [0, 0],
    [1, 0],
    [2, 0],
  ];
  it("polylineDistanceNm sums segments", () => {
    expect(polylineDistanceNm(route)).toBeCloseTo(120.08, 1);
  });
  it("buildCumulativeRoute starts at 0 and grows", () => {
    const cum = buildCumulativeRoute(route);
    expect(cum[0]).toBe(0);
    expect(cum[2]).toBeCloseTo(120.08, 1);
  });
  it("positionAtDistance interpolates mid-route", () => {
    const cum = buildCumulativeRoute(route);
    const mid = positionAtDistance(route, cum, 60.04); // ~halfway to first vertex
    expect(mid[0]).toBeCloseTo(1, 1);
    expect(mid[1]).toBeCloseTo(0, 3);
  });
  it("positionAtDistance clamps to endpoints", () => {
    const cum = buildCumulativeRoute(route);
    expect(positionAtDistance(route, cum, -5)).toEqual([0, 0]);
    expect(positionAtDistance(route, cum, 9999)).toEqual([2, 0]);
  });
});
