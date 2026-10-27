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

const DEG = Math.PI / 180;
const J1970 = 2440587.5; // Julian date of the Unix epoch
const J2000 = 2451545.0;

/**
 * Sunrise/sunset (epoch ms) for the UTC calendar day containing `epochMs`, at
 * lat/lon (degrees, east positive). Standard sunrise equation (upper limb,
 * −0.833° for refraction) — good to ~1–2 min, no network. Used where the
 * Open-Meteo daily block isn't at hand (server-side planning). Null on polar
 * day/night.
 */
export function sunTimes(lat: number, lon: number, epochMs: number): { sunrise: number | null; sunset: number | null } {
  const dayStart = Math.floor(epochMs / 86_400_000) * 86_400_000;
  const n = Math.round(dayStart / 86_400_000 + J1970 + 0.5 - J2000 + 0.0008);
  const jStar = n - lon / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c = 1.9148 * Math.sin(m * DEG) + 0.02 * Math.sin(2 * m * DEG) + 0.0003 * Math.sin(3 * m * DEG);
  const lambda = (m + c + 180 + 102.9372) % 360;
  const jTransit = J2000 + jStar + 0.0053 * Math.sin(m * DEG) - 0.0069 * Math.sin(2 * lambda * DEG);
  const sinDecl = Math.sin(lambda * DEG) * Math.sin(23.4397 * DEG);
  const cosDecl = Math.cos(Math.asin(sinDecl));
  const cosHour = (Math.sin(-0.833 * DEG) - Math.sin(lat * DEG) * sinDecl) / (Math.cos(lat * DEG) * cosDecl);
  if (cosHour < -1 || cosHour > 1) return { sunrise: null, sunset: null };
  const halfDay = Math.acos(cosHour) / DEG / 360;
  const toEpoch = (j: number) => Math.round((j - J1970) * 86_400_000);
  return { sunrise: toEpoch(jTransit - halfDay), sunset: toEpoch(jTransit + halfDay) };
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
