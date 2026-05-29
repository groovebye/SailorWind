import { describe, it, expect } from "vitest";
import { getTidePrediction, tideStateAt } from "@/lib/tides";

const HW = (p: ReturnType<typeof getTidePrediction>) => p!.extremes.filter((e) => e.type === "HW");

/** Median spacing (hours) between consecutive HW. */
function hwSpacingH(pred: ReturnType<typeof getTidePrediction>): number {
  const hw = HW(pred).map((e) => e.time.getTime()).sort((a, b) => a - b);
  const diffs = hw.slice(1).map((t, i) => (t - hw[i]) / 3600000).sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

describe("getTidePrediction", () => {
  it("returns null for an unknown port", () => {
    expect(getTidePrediction("atlantis", new Date("2026-07-01T00:00:00Z"))).toBeNull();
  });

  it("produces a semidiurnal tide (~12.42 h between HW)", () => {
    const p = getTidePrediction("gijon", new Date("2026-07-01T00:00:00Z"), 4);
    const spacing = hwSpacingH(p);
    expect(spacing).toBeGreaterThan(12.0);
    expect(spacing).toBeLessThan(12.9);
  });

  it("alternates HW and LW", () => {
    const p = getTidePrediction("la-coruna", new Date("2026-07-01T00:00:00Z"), 3)!;
    const types = p.extremes.map((e) => e.type);
    for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1]);
  });

  it("spring range exceeds neap range over a lunar cycle", () => {
    const ranges: number[] = [];
    for (let d = 0; d < 30; d++) {
      const day = new Date(Date.UTC(2026, 6, 1) + d * 86400000);
      ranges.push(getTidePrediction("gijon", day, 1)!.range);
    }
    const max = Math.max(...ranges), min = Math.min(...ranges);
    expect(max).toBeGreaterThan(min * 1.5);        // clear spring/neap variation
    expect(max).toBeGreaterThan(4.3);              // near published spring ~4.9
    expect(min).toBeLessThan(3.2);                 // near published neap ~2.5
    expect(max).toBeLessThan(6.5);                 // not absurd (perigean spring ok)
  });

  it("flags springs near a known full moon (2026-07-29) and neaps at quadrature", () => {
    const springish = getTidePrediction("gijon", new Date("2026-07-29T12:00:00Z"), 1)!;
    const neapish = getTidePrediction("gijon", new Date("2026-08-05T12:00:00Z"), 1)!;
    expect(springish.range).toBeGreaterThan(neapish.range);
  });
});

describe("epoch independence (no fixed-epoch drift)", () => {
  it("gives a sane semidiurnal tide in 2031 too", () => {
    const p = getTidePrediction("gijon", new Date("2031-03-15T00:00:00Z"), 4)!;
    expect(p.extremes.length).toBeGreaterThan(8);
    expect(p.range).toBeGreaterThan(2);
    const spacing = hwSpacingH(p);
    expect(spacing).toBeGreaterThan(12.0);
    expect(spacing).toBeLessThan(12.9);
    expect(p.extremes.every((e) => Number.isFinite(e.height))).toBe(true);
  });
});

describe("tideStateAt", () => {
  it("reports rising/falling with finite hours to HW/LW", () => {
    const p = getTidePrediction("la-coruna", new Date("2026-07-01T00:00:00Z"), 2)!;
    const st = tideStateAt(p, new Date("2026-07-01T09:00:00Z"));
    expect(typeof st.rising).toBe("boolean");
    expect(Number.isFinite(st.hoursToHW)).toBe(true);
    expect(Number.isFinite(st.hoursToLW)).toBe(true);
    expect(st.description).toMatch(/tide/i);
  });
});
