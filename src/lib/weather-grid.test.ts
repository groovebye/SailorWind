import { describe, expect, it } from "vitest";
import {
  GRID_MAX_PER_AXIS, barbParts, barbSvg, latticeFor, latticePoints, openMeteoGridUrls,
  parseOpenMeteoGrid, timeIndexNear, waveColor, weatherGridQuery,
} from "./weather-grid";

describe("latticeFor", () => {
  it("picks a fine step for a harbour-sized view and snaps outward", () => {
    const l = latticeFor({ south: 41.03, west: -9.07, north: 41.33, east: -8.62 });
    expect(l.step).toBe(0.1);
    expect(l.south).toBe(41);
    expect(l.north).toBe(41.4);
    expect(l.west).toBe(-9.1);
    expect(l.east).toBe(-8.6);
    expect(l.lats).toEqual([41, 41.1, 41.2, 41.3, 41.4]);
  });

  it("never exceeds the per-axis cap, whatever the view", () => {
    for (const span of [0.5, 1.3, 2.7, 5, 9, 17]) {
      const l = latticeFor({ south: 40 - span / 2, west: -9 - span, north: 40 + span / 2, east: -9 + span });
      expect(l.lats.length).toBeLessThanOrEqual(GRID_MAX_PER_AXIS);
      expect(l.lons.length).toBeLessThanOrEqual(GRID_MAX_PER_AXIS);
      expect(l.south).toBeLessThanOrEqual(40 - span / 2);
      expect(l.east).toBeGreaterThanOrEqual(-9 + span);
    }
  });

  it("samples the centre of a continent-sized view instead of failing", () => {
    const l = latticeFor({ south: 0, west: -60, north: 70, east: 40 });
    expect(l.lats.length).toBeLessThanOrEqual(GRID_MAX_PER_AXIS);
    expect(l.lons.length).toBeLessThanOrEqual(GRID_MAX_PER_AXIS);
  });

  it("gives the same key for small pans inside one lattice cell", () => {
    const a = weatherGridQuery(latticeFor({ south: 41.03, west: -9.07, north: 41.33, east: -8.62 }), "ecmwf_ifs025");
    const b = weatherGridQuery(latticeFor({ south: 41.04, west: -9.05, north: 41.31, east: -8.63 }), "ecmwf_ifs025");
    expect(a).toBe(b);
    expect(a).toBe("south=41&west=-9.1&north=41.4&east=-8.6&model=ecmwf_ifs025");
  });
});

describe("openMeteoGridUrls", () => {
  it("lists every node as a lat/lon pair, model only when chosen", () => {
    const l = latticeFor({ south: 41.03, west: -9.07, north: 41.13, east: -8.92 });
    const pts = latticePoints(l);
    const u = openMeteoGridUrls(l, "best_match");
    const lat = new URL(u.forecast).searchParams.get("latitude")!.split(",");
    const lon = new URL(u.forecast).searchParams.get("longitude")!.split(",");
    expect(lat.length).toBe(pts.length);
    expect(lon.length).toBe(pts.length);
    expect(u.forecast).toContain("wind_speed_unit=kn");
    expect(u.forecast).not.toContain("models=");
    expect(openMeteoGridUrls(l, "gfs_seamless").forecast).toContain("models=gfs_seamless");
    expect(u.marine).toContain("wave_height,wave_direction,wave_period");
  });
});

describe("parseOpenMeteoGrid", () => {
  const l = latticeFor({ south: 41.01, west: -9.09, north: 41.09, east: -9.01 }); // 2×2
  const times = ["2026-10-27T00:00", "2026-10-27T01:00", "2026-10-27T02:00"];
  const fc = latticePoints(l).map((_, i) => ({
    hourly: { time: times, wind_speed_10m: [10 + i, 11.6, 12], wind_direction_10m: [350, 355, 0], wind_gusts_10m: [15, 16, 17] },
  }));

  it("aligns marine data by time, not index, and keeps land as null", () => {
    const mar = latticePoints(l).map((_, i) => (i === 3
      ? { hourly: { time: times, wave_height: [null, null, null], wave_direction: [null, null, null], wave_period: [null, null, null] } }
      : { hourly: { time: times.slice(1), wave_height: [1.84, 2.01], wave_direction: [315, 320], wave_period: [9.04, 9.5] } }));
    const g = parseOpenMeteoGrid(l, fc, mar, "ecmwf_ifs025", new Date("2026-10-27T00:10:00Z"));
    expect(g.times[0]).toBe(Date.UTC(2026, 9, 27, 0));
    expect(g.points).toHaveLength(4);
    expect(g.points[1].ws).toEqual([11, 12, 12]);
    expect(g.points[0].hs).toEqual([null, 1.8, 2]);
    expect(g.points[0].tp).toEqual([null, 9, 9.5]);
    expect(g.points[3].hs).toEqual([null, null, null]);
  });

  it("copes with a single-location object and a failed marine call", () => {
    const one = latticeFor({ south: 41.0, west: -9.0, north: 41.0, east: -9.0 });
    const g = parseOpenMeteoGrid(one, fc[0], null, "best_match", new Date());
    expect(g.points).toHaveLength(1);
    expect(g.points[0].wd).toEqual([350, 355, 0]);
    expect(g.points[0].hs).toEqual([null, null, null]);
  });
});

describe("timeIndexNear", () => {
  it("finds the closest hour", () => {
    const t = [0, 3600e3, 7200e3];
    expect(timeIndexNear(t, 3000e3)).toBe(1);
    expect(timeIndexNear(t, 99e9)).toBe(2);
    expect(timeIndexNear([], 5)).toBe(0);
  });
});

describe("wind barbs", () => {
  it("rounds to 5 kn and splits into pennants, full and half barbs", () => {
    expect(barbParts(2)).toEqual({ calm: true, pennants: 0, full: 0, half: 0 });
    expect(barbParts(4)).toEqual({ calm: false, pennants: 0, full: 0, half: 1 });
    expect(barbParts(12)).toEqual({ calm: false, pennants: 0, full: 1, half: 0 });
    expect(barbParts(23)).toEqual({ calm: false, pennants: 0, full: 2, half: 1 });
    expect(barbParts(64)).toEqual({ calm: false, pennants: 1, full: 1, half: 1 });
  });

  it("draws the staff into the wind", () => {
    const svg = barbSvg(23, 315, "#fff");
    expect(svg).toContain("rotate(315 18 18)");
    expect(svg.match(/<line/g)).toHaveLength(4); // staff + 2 full + 1 half
    expect(barbSvg(1, 0, "#fff")).toContain("<circle");
  });
});

describe("waveColor", () => {
  it("changes band at the caution and no-go heights", () => {
    expect(waveColor(2.4)).not.toBe(waveColor(2.6));
    expect(waveColor(3.4)).not.toBe(waveColor(3.6));
  });
});
