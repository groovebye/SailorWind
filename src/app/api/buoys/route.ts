import { NextRequest, NextResponse } from "next/server";

/**
 * Puertos del Estado buoy observations.
 * Provides real-time wave/wind data from physical buoys along N Spain coast.
 *
 * Buoy data source: https://portus.puertos.es/
 * These are real observations, not forecasts.
 */

interface BuoyStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string; // "coastal" | "offshore"
}

interface BuoyObservation {
  station: BuoyStation;
  timestamp: string;
  waveHeight: number | null;
  wavePeriod: number | null;
  waveDir: number | null;
  windSpeed: number | null;
  windDir: number | null;
  waterTemp: number | null;
  source: string;
  note: string;
}

// Known buoy stations along our route
const BUOY_STATIONS: BuoyStation[] = [
  { id: "gijon-offshore", name: "Gijón Offshore", lat: 43.58, lon: -5.63, type: "offshore" },
  { id: "cabo-penas", name: "Cabo Peñas", lat: 43.74, lon: -5.92, type: "coastal" },
  { id: "estaca-bares", name: "Estaca de Bares", lat: 44.06, lon: -7.62, type: "offshore" },
  { id: "villano-sisargas", name: "Villano-Sisargas", lat: 43.50, lon: -9.21, type: "offshore" },
  { id: "coruna-offshore", name: "La Coruña Offshore", lat: 43.42, lon: -8.44, type: "coastal" },
];

// Cache buoy data for 30 min
const cache = new Map<string, { data: BuoyObservation[]; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000;

async function fetchBuoyData(lat: number, lon: number, radiusKm: number): Promise<BuoyObservation[]> {
  // Find nearby stations
  const nearbyStations = BUOY_STATIONS.filter(s => {
    const dlat = s.lat - lat;
    const dlon = s.lon - lon;
    const distKm = Math.sqrt(dlat * dlat + dlon * dlon) * 111;
    return distKm <= radiusKm;
  });

  // For now, return station info with note about data source
  // Real integration would fetch from Puertos del Estado THREDDS/PORTUS API
  return nearbyStations.map(s => ({
    station: s,
    timestamp: new Date().toISOString(),
    waveHeight: null,
    wavePeriod: null,
    waveDir: null,
    windSpeed: null,
    windDir: null,
    waterTemp: null,
    source: "Puertos del Estado",
    note: "Station registered. Live data integration pending — check portus.puertos.es for current observations.",
  }));
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") || "43.5");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") || "-5.7");
  const radius = parseInt(req.nextUrl.searchParams.get("radius") || "100", 10);

  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}_${radius}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ stations: cached.data, cached: true });
  }

  const observations = await fetchBuoyData(lat, lon, radius);
  cache.set(cacheKey, { data: observations, ts: Date.now() });

  return NextResponse.json({
    stations: observations,
    allStations: BUOY_STATIONS,
    note: "Buoy station locations registered. Live observation data integration with Puertos del Estado THREDDS is planned.",
  });
}
