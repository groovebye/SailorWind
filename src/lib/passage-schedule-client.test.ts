import { describe, it, expect } from "vitest";
import {
  buildClientSchedule,
  normalizeDeparture,
  toLocalInputValue,
} from "@/lib/passage-schedule-client";

// Canonical schedule engine. The server wrapper (passage-schedule.ts) and the
// timeline engine (passage-computation buildLegs) both delegate here, so these
// fixed-instant assertions also lock their behavior. All expectations are exact
// UTC instants — they must hold identically under ANY host TZ (run the suite
// with TZ=America/New_York etc. to confirm timezone-independence).

const stops = [
  { name: "A", slug: "a", lat: 43.5, lon: -5.6, coastlineNm: 0 },
  { name: "B", slug: "b", lat: 43.6, lon: -6.5, coastlineNm: 30 },
  { name: "C", slug: "c", lat: 43.4, lon: -8.4, coastlineNm: 50 },
];

describe("normalizeDeparture", () => {
  it("anchors naive wall-clock to UTC", () => {
    expect(normalizeDeparture("2026-06-15T08:00").toISOString()).toBe("2026-06-15T08:00:00.000Z");
  });
  it("ignores an explicit Z (same wall-clock)", () => {
    expect(normalizeDeparture("2026-06-15T08:00Z").toISOString()).toBe("2026-06-15T08:00:00.000Z");
  });
  it("ignores an explicit offset (treats wall-clock as-is)", () => {
    expect(normalizeDeparture("2026-06-15T08:00+05:00").toISOString()).toBe("2026-06-15T08:00:00.000Z");
  });
});

describe("toLocalInputValue", () => {
  it("round-trips with normalizeDeparture", () => {
    const v = "2026-06-15T08:00";
    expect(toLocalInputValue(normalizeDeparture(v))).toBe(v);
  });
});

describe("buildClientSchedule — daily mode", () => {
  const legs = buildClientSchedule("2026-06-15T08:00", 5, "daily", stops);

  it("produces one leg per stop pair", () => {
    expect(legs).toHaveLength(2);
  });
  it("leg 0 departs at the entered wall-clock, arrives after dist/speed hours", () => {
    expect(legs[0].departTime.toISOString()).toBe("2026-06-15T08:00:00.000Z");
    expect(legs[0].arriveTime.toISOString()).toBe("2026-06-15T14:00:00.000Z"); // 30nm / 5kt = 6h
    expect(legs[0].distanceNm).toBe(30);
    expect(legs[0].hours).toBe(6);
  });
  it("leg 1 departs next calendar day at the departure hour", () => {
    expect(legs[1].departTime.toISOString()).toBe("2026-06-16T08:00:00.000Z");
    expect(legs[1].arriveTime.toISOString()).toBe("2026-06-16T12:00:00.000Z"); // 20nm / 5kt = 4h
  });
  it("every leg start lands on the departure hour (UTC)", () => {
    for (const leg of legs) expect(leg.departTime.getUTCHours()).toBe(8);
  });
});

describe("buildClientSchedule — nonstop mode", () => {
  it("chains the next leg immediately after arrival", () => {
    const legs = buildClientSchedule("2026-06-15T08:00", 5, "nonstop", stops);
    expect(legs[1].departTime.toISOString()).toBe("2026-06-15T14:00:00.000Z");
  });
});

describe("buildClientSchedule — per-leg override", () => {
  it("override sets that leg's departure exactly", () => {
    const legs = buildClientSchedule("2026-06-15T08:00", 5, "daily", stops, undefined, {
      1: "2026-06-20T06:30",
    });
    expect(legs[1].departTime.toISOString()).toBe("2026-06-20T06:30:00.000Z");
  });
});

describe("buildClientSchedule — resolved (route geometry) distances win over coastlineNm", () => {
  it("uses resolvedDistances when provided", () => {
    const legs = buildClientSchedule("2026-06-15T08:00", 5, "daily", stops, { 0: 45 });
    expect(legs[0].distanceNm).toBe(45);
    expect(legs[0].hours).toBe(9); // 45 / 5
  });

  it("invariant: arriveTime === departTime + distance/speed (geometry distances)", () => {
    const speed = 6;
    const legs = buildClientSchedule("2026-06-15T08:00", speed, "nonstop", stops, { 0: 48, 1: 30 });
    for (const leg of legs) {
      const deltaH = (leg.arriveTime.getTime() - leg.departTime.getTime()) / 3600000;
      expect(deltaH).toBeCloseTo(leg.distanceNm / speed, 6);
    }
  });
});
