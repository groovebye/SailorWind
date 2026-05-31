import { haversineNm } from "@/lib/geo";

/** Coastal airports along the Biscay → Gibraltar route for METAR/TAF cross-checks. */
export const AIRPORTS: { icao: string; name: string; lat: number; lon: number }[] = [
  { icao: "LEXJ", name: "Santander", lat: 43.43, lon: -3.82 },
  { icao: "LEAS", name: "Asturias", lat: 43.56, lon: -6.03 },
  { icao: "LECO", name: "A Coruña", lat: 43.30, lon: -8.38 },
  { icao: "LEST", name: "Santiago", lat: 42.90, lon: -8.42 },
  { icao: "LEVX", name: "Vigo", lat: 42.23, lon: -8.63 },
  { icao: "LPPR", name: "Porto", lat: 41.24, lon: -8.68 },
  { icao: "LPPT", name: "Lisbon", lat: 38.77, lon: -9.13 },
  { icao: "LPFR", name: "Faro", lat: 37.01, lon: -7.97 },
  { icao: "LEJR", name: "Jerez", lat: 36.74, lon: -6.06 },
  { icao: "LXGB", name: "Gibraltar", lat: 36.15, lon: -5.35 },
  { icao: "LEMG", name: "Málaga", lat: 36.67, lon: -4.49 },
];

export function nearestAirport(lat: number, lon: number) {
  return AIRPORTS.reduce((best, a) =>
    haversineNm([lat, lon], [a.lat, a.lon]) < haversineNm([lat, lon], [best.lat, best.lon]) ? a : best,
  );
}
