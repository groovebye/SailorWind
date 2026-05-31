/** Visual language for "how nasty" — shared color scales (from the design spec). */

export type VerdictV = "GO" | "CAUTION" | "NOGO";

export function windColor(kt: number): string {
  if (kt < 4) return "#7fe9c4";
  if (kt < 8) return "#34e0ff";
  if (kt < 12) return "#4fb0ff";
  if (kt < 17) return "#ffc24b";
  if (kt < 22) return "#ff9b5a";
  return "#ff6b8a";
}

const BF_STOPS = [
  "#7fe9c4", "#56e0b8", "#7fd9ff", "#34e0ff", "#4fb0ff", "#7c9cff",
  "#b794ff", "#ffc24b", "#ff9b5a", "#ff6b8a", "#ff4d6d", "#ff3355", "#ff2a48",
];
export function bfColor(bf: number): string {
  return BF_STOPS[Math.min(12, Math.max(0, Math.round(bf)))];
}

/** Power = comfort/exposure index 0..~14. */
export function powerColor(p: number): string {
  if (p < 5) return "var(--go)";
  if (p < 10) return "var(--cyan)";
  if (p < 13) return "var(--caution)";
  return "var(--nogo)";
}

/** Beaufort number from wind speed in knots. */
const BF_LOWER = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
export function beaufort(kt: number): number {
  let b = 0;
  for (const lo of BF_LOWER) if (kt >= lo) b++;
  return b;
}

/** Overall verdict from a set of per-waypoint verdicts. */
export function overallVerdict(verdicts: VerdictV[]): VerdictV {
  if (verdicts.some((v) => v === "NOGO")) return "NOGO";
  if (verdicts.some((v) => v === "CAUTION")) return "CAUTION";
  return "GO";
}
