/**
 * Parse a polar table (ORC .pol or CSV) into the PolarData shape used by the
 * passage performance model.
 *
 * Accepted layout (whitespace-, comma- or semicolon-delimited):
 *
 *   twa\\tws   6     8    10    12    16    20    25
 *   40        2.1   2.8  3.4   3.9   4.4   4.6   4.2
 *   52        2.6   3.4  4.2   ...
 *   ...
 *
 * - First row = header: an optional label token then the TWS values (knots).
 * - Each following row = a TWA (degrees) then one boat-speed per TWS column.
 * - boatSpeeds is indexed [twaIndex][twsIndex] (matches estimatePolarPerformance).
 */

export type PolarData = {
  twsKnots: number[];
  twaDegrees: number[];
  boatSpeeds: number[][];
  hullSpeedKt?: number;
  targetUpwindTwaDeg?: number;
  targetDownwindTwaDeg?: number;
};

const splitRow = (line: string): string[] => line.trim().split(/[\s,;]+/).filter((s) => s.length > 0);
const isNum = (s: string) => s !== "" && Number.isFinite(Number(s));

export function parsePolarTable(text: string): PolarData {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  if (rows.length < 2) throw new Error("Polar table needs a header row + at least one TWA row");

  // Header: drop a leading non-numeric label (e.g. "twa/tws"), keep TWS numbers.
  const headerTokens = splitRow(rows[0]);
  const twsTokens = isNum(headerTokens[0]) ? headerTokens : headerTokens.slice(1);
  const twsKnots = twsTokens.map(Number);
  if (twsKnots.length === 0 || twsKnots.some((n) => !Number.isFinite(n))) {
    throw new Error("Could not parse TWS header row");
  }

  const twaDegrees: number[] = [];
  const boatSpeeds: number[][] = [];
  for (let i = 1; i < rows.length; i++) {
    const tok = splitRow(rows[i]);
    if (tok.length < 2 || !isNum(tok[0])) continue;
    const twa = Number(tok[0]);
    const speeds = tok.slice(1).map(Number);
    if (speeds.length !== twsKnots.length) {
      throw new Error(`Row TWA=${twa}: ${speeds.length} speeds but ${twsKnots.length} TWS columns`);
    }
    twaDegrees.push(twa);
    boatSpeeds.push(speeds);
  }
  if (twaDegrees.length === 0) throw new Error("No valid TWA rows found");

  const hullSpeedKt = Math.max(...boatSpeeds.flat());

  return {
    twsKnots,
    twaDegrees,
    boatSpeeds,
    hullSpeedKt: Math.round(hullSpeedKt * 10) / 10,
    ...computeTargets(twsKnots, twaDegrees, boatSpeeds),
  };
}

/** Best-VMG upwind/downwind target angles (at a mid TWS), for display/guidance. */
function computeTargets(tws: number[], twa: number[], speeds: number[][]) {
  const col = Math.min(tws.length - 1, Math.max(0, Math.round(tws.length / 2) - 1)); // ~mid wind
  let upAngle: number | undefined, downAngle: number | undefined;
  let upVmg = -Infinity, downVmg = -Infinity;
  for (let r = 0; r < twa.length; r++) {
    const v = speeds[r][col];
    const vmg = v * Math.cos((twa[r] * Math.PI) / 180);
    if (twa[r] < 90 && vmg > upVmg) { upVmg = vmg; upAngle = twa[r]; }
    if (twa[r] > 90 && -vmg > downVmg) { downVmg = -vmg; downAngle = twa[r]; }
  }
  return { targetUpwindTwaDeg: upAngle, targetDownwindTwaDeg: downAngle };
}
