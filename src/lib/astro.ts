/**
 * Lightweight celestial helpers. Sunrise/sunset come from Open-Meteo's daily
 * block (reliable, per-location); the moon phase/illumination is computed here
 * from the synodic cycle (good to ~1% — fine for "how lit is the night").
 */

const SYNODIC = 29.53058867; // days
// Reference new moon: 2000-01-06 18:14 UTC, in days since epoch.
const REF_NEW_MOON_DAYS = Date.UTC(2000, 0, 6, 18, 14) / 86_400_000;

export type Moon = { phase: number; illum: number; name: string; emoji: string };

/** Moon phase (0..1, 0=new), illuminated fraction (0..1), and a label. */
export function moon(epochMs: number): Moon {
  const days = epochMs / 86_400_000 - REF_NEW_MOON_DAYS;
  const phase = ((days % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC; // 0..1
  const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2; // 0 new → 1 full
  const waxing = phase < 0.5;
  let name: string, emoji: string;
  if (phase < 0.03 || phase > 0.97) { name = "New moon"; emoji = "🌑"; }
  else if (phase < 0.22) { name = "Waxing crescent"; emoji = "🌒"; }
  else if (phase < 0.28) { name = "First quarter"; emoji = "🌓"; }
  else if (phase < 0.47) { name = "Waxing gibbous"; emoji = "🌔"; }
  else if (phase < 0.53) { name = "Full moon"; emoji = "🌕"; }
  else if (phase < 0.72) { name = "Waning gibbous"; emoji = "🌖"; }
  else if (phase < 0.78) { name = "Last quarter"; emoji = "🌗"; }
  else { name = "Waning crescent"; emoji = "🌘"; }
  void waxing;
  return { phase, illum, name, emoji };
}

/** True if epoch falls between that day's sunrise and sunset (both epoch ms). */
export function isDaylight(epoch: number, sunrise: number | null, sunset: number | null): boolean {
  if (sunrise == null || sunset == null) {
    // Fallback: rough 06–21 local-UTC window.
    const h = new Date(epoch).getUTCHours();
    return h >= 6 && h < 21;
  }
  return epoch >= sunrise && epoch <= sunset;
}
