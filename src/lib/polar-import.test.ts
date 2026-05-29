import { describe, it, expect } from "vitest";
import { parsePolarTable } from "@/lib/polar-import";

const CSV = `twa/tws,6,8,10,12,16,20,25
40,2.1,2.8,3.4,3.9,4.4,4.6,4.2
90,3.5,4.5,5.4,5.9,6.3,6.3,5.8
150,2.6,3.5,4.3,4.9,5.4,5.5,5.0`;

const POL_WHITESPACE = `twa\\tws   6    8    10   12   16   20   25
40        2.1  2.8  3.4  3.9  4.4  4.6  4.2
90        3.5  4.5  5.4  5.9  6.3  6.3  5.8
150       2.6  3.5  4.3  4.9  5.4  5.5  5.0`;

describe("parsePolarTable", () => {
  it("parses a CSV polar with a label header", () => {
    const p = parsePolarTable(CSV);
    expect(p.twsKnots).toEqual([6, 8, 10, 12, 16, 20, 25]);
    expect(p.twaDegrees).toEqual([40, 90, 150]);
    expect(p.boatSpeeds[1][4]).toBe(6.3); // TWA 90, TWS 16
    expect(p.hullSpeedKt).toBe(6.3);
  });

  it("parses whitespace/ORC-style .pol the same way", () => {
    const p = parsePolarTable(POL_WHITESPACE);
    expect(p.twsKnots).toEqual([6, 8, 10, 12, 16, 20, 25]);
    expect(p.boatSpeeds[2][0]).toBe(2.6); // TWA 150, TWS 6
  });

  it("computes target angles (upwind < 90 < downwind)", () => {
    const p = parsePolarTable(CSV);
    expect(p.targetUpwindTwaDeg).toBeLessThan(90);
    expect(p.targetDownwindTwaDeg).toBeGreaterThan(90);
  });

  it("rejects a ragged row", () => {
    expect(() => parsePolarTable("twa,6,8\n40,2.1")).toThrow();
  });
  it("rejects an empty table", () => {
    expect(() => parsePolarTable("")).toThrow();
  });
});
