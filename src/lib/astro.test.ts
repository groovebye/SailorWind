import { describe, it, expect } from "vitest";
import { sunTimes, isDaylight } from "@/lib/astro";

const at = (iso: string) => Date.parse(iso);
const minutesBetween = (a: number, b: number) => Math.abs(a - b) / 60_000;

describe("sunTimes", () => {
  it("Cascais, late October (WET = UTC): sunrise ~07:00, sunset ~17:40", () => {
    const { sunrise, sunset } = sunTimes(38.6958, -9.418, at("2026-10-28T12:00:00Z"));
    // Reference almanac values for Lisbon area, 28 Oct: ~07:03 / ~17:38 UTC.
    expect(minutesBetween(sunrise!, at("2026-10-28T07:03:00Z"))).toBeLessThan(5);
    expect(minutesBetween(sunset!, at("2026-10-28T17:38:00Z"))).toBeLessThan(5);
  });

  it("Greenwich, June solstice: sunrise ~03:43, sunset ~20:21 UTC", () => {
    const { sunrise, sunset } = sunTimes(51.4769, 0, at("2026-06-21T00:30:00Z"));
    expect(minutesBetween(sunrise!, at("2026-06-21T03:43:00Z"))).toBeLessThan(4);
    expect(minutesBetween(sunset!, at("2026-06-21T20:21:00Z"))).toBeLessThan(4);
  });

  it("uses the UTC day that contains the instant", () => {
    const morning = sunTimes(41.17, -8.7, at("2026-10-28T00:10:00Z"));
    const evening = sunTimes(41.17, -8.7, at("2026-10-28T23:50:00Z"));
    expect(morning).toEqual(evening);
  });

  it("returns nulls during polar night", () => {
    expect(sunTimes(80, 15, at("2026-12-21T12:00:00Z"))).toEqual({ sunrise: null, sunset: null });
  });

  it("feeds isDaylight", () => {
    const { sunrise, sunset } = sunTimes(38.6958, -9.418, at("2026-10-28T12:00:00Z"));
    expect(isDaylight(at("2026-10-28T14:00:00Z"), sunrise, sunset)).toBe(true);
    expect(isDaylight(at("2026-10-28T22:00:00Z"), sunrise, sunset)).toBe(false);
  });
});
