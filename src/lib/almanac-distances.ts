/**
 * Reeds §9.23.2 (N & W Spain) distance table — route distances in nautical miles
 * "by the most direct route, whilst avoiding dangers and allowing for Traffic
 * Separation Schemes". These clear the capes (Finisterre/Villano TSS), so they're
 * longer than a straight great-circle line and are the figure to plan on.
 *
 * Sparse: only the principal-port legs transcribed/validated from the table.
 * Straight-line (great-circle) is used as the fallback elsewhere and is clearly
 * marked "≈" in the UI.
 */
const NM: Record<string, number> = {
  "gijon|ribadeo": 65,
  "ribadeo|viveiro": 33,
  "la coruna|viveiro": 56,
  "gijon|la coruna": 138,
  "la coruna|vigo": 137,       // ← the one you asked about (Navionics 110 cuts the corner)
  "la coruna|muros": 75,
  "muros|vilagarcia": 26,
  "baiona|vigo": 11,
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

/** Map our catalog names to the table's port tokens. */
function token(s: string): string {
  const n = norm(s);
  if (n.includes("coruna")) return "la coruna";
  if (n.includes("vigo")) return "vigo";
  if (n.includes("baiona") || n.includes("bayona")) return "baiona";
  if (n.includes("viveiro") || n.includes("vivero")) return "viveiro";
  if (n.includes("ribadeo")) return "ribadeo";
  if (n.includes("gijon")) return "gijon";
  if (n.includes("muros")) return "muros";
  if (n.includes("vilagarc")) return "vilagarcia";
  return n;
}

/** Almanac route distance (nm) between two ports, or null if not in the table. */
export function almanacDistanceNm(a: string, b: string): number | null {
  const key = [token(a), token(b)].sort().join("|");
  return NM[key] ?? null;
}
