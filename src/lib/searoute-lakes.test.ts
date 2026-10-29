import { describe, expect, it } from "vitest";
import { LAKE_SEGMENTS, routeDistanceNm, seaRoute, shallowStretches } from "./searoute";

const lemmer = { lat: 52.842, lon: 5.709 };
const hoorn = { lat: 52.6352, lon: 5.0651 };
const enkhuizen = { lat: 52.7043, lon: 5.3008 };
const lelystadBatavia = { lat: 52.5176, lon: 5.4382 };
const lelystadHoutrib = { lat: 52.5316, lon: 5.4393 };

const near = (line: [number, number][], lat: number, lon: number, tol: number) =>
  line.some(([la, lo]) => Math.abs(la - lat) < tol && Math.abs(lo - lon) < tol);

describe("IJsselmeer / Markermeer routing", () => {
  it("routes through water, not as a straight line", () => {
    const line = seaRoute(lemmer, enkhuizen);
    expect(line.length).toBeGreaterThan(2);
    expect(routeDistanceNm([lemmer, enkhuizen])).toBeGreaterThan(17);
    expect(routeDistanceNm([lemmer, enkhuizen])).toBeLessThan(24);
  });

  it("crosses the Houtribdijk only through a lock", () => {
    // IJsselmeer → Markermeer: via the Krabbersgat naviduct at Enkhuizen
    expect(near(seaRoute(lemmer, hoorn), 52.69, 5.29, 0.02)).toBe(true);
    // Either side of the dike at Lelystad: through the Houtribsluizen, not over the dike
    const lock = seaRoute(lelystadHoutrib, lelystadBatavia);
    expect(routeDistanceNm([lelystadHoutrib, lelystadBatavia])).toBeLessThan(5);
    expect(near(lock, 52.5275, 5.4345, 0.01)).toBe(true);
  });

  it("never cuts a corner over land or shallows away from the harbours", () => {
    for (const [a, b] of [[lemmer, hoorn], [enkhuizen, lelystadBatavia]] as const) {
      const line = seaRoute(a, b).map(([lat, lon]) => ({ lat, lon }));
      expect(shallowStretches(line, 1.0, 0.05)).toEqual([]);
    }
  });

  it("treats the lakes as a lake segment", () => {
    expect(LAKE_SEGMENTS.has("ijsselmeer")).toBe(true);
  });
});
