import { NextRequest, NextResponse } from "next/server";

interface SeamarkFeature {
  id: string;
  lat: number;
  lon: number;
  type: string;
  category: string | null;
  name: string | null;
  tags: Record<string, string>;
}

type CacheEntry = {
  expiresAt: number;
  data: SeamarkFeature[];
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 30 * 60 * 1000;
const seamarkCache = new Map<string, CacheEntry>();

function roundCoord(value: number) {
  return Math.round(value * 1000) / 1000;
}

function cacheKey(south: number, west: number, north: number, east: number) {
  return `${roundCoord(south)}:${roundCoord(west)}:${roundCoord(north)}:${roundCoord(east)}`;
}

function normalizeTags(tags: Record<string, string> | undefined) {
  return tags || {};
}

function extractFeature(element: Record<string, unknown>): SeamarkFeature | null {
  const tags = normalizeTags(element.tags as Record<string, string> | undefined);
  const type = tags["seamark:type"];
  if (!type) return null;

  const lat = typeof element.lat === "number"
    ? element.lat
    : typeof (element.center as { lat?: number } | undefined)?.lat === "number"
      ? (element.center as { lat: number }).lat
      : null;
  const lon = typeof element.lon === "number"
    ? element.lon
    : typeof (element.center as { lon?: number } | undefined)?.lon === "number"
      ? (element.center as { lon: number }).lon
      : null;

  if (lat === null || lon === null) return null;

  const category =
    tags["seamark:buoy_lateral:category"] ||
    tags["seamark:buoy_cardinal:category"] ||
    tags["seamark:beacon_lateral:category"] ||
    tags["seamark:beacon_cardinal:category"] ||
    tags["seamark:topmark:shape"] ||
    null;

  const name =
    tags["seamark:name"] ||
    tags.name ||
    tags["seamark:light:character"] ||
    null;

  return {
    id: `${element.type}-${String(element.id)}`,
    lat,
    lon,
    type,
    category,
    name,
    tags,
  };
}

export async function GET(req: NextRequest) {
  const south = parseFloat(req.nextUrl.searchParams.get("south") || "");
  const west = parseFloat(req.nextUrl.searchParams.get("west") || "");
  const north = parseFloat(req.nextUrl.searchParams.get("north") || "");
  const east = parseFloat(req.nextUrl.searchParams.get("east") || "");

  if ([south, west, north, east].some(Number.isNaN)) {
    return NextResponse.json({ error: "south, west, north, east required" }, { status: 400 });
  }

  const key = cacheKey(south, west, north, east);
  const now = Date.now();
  const cached = seamarkCache.get(key);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ features: cached.data, cached: true });
  }

  const query = `
[out:json][timeout:20];
(
  node["seamark:type"](${south},${west},${north},${east});
  way["seamark:type"](${south},${west},${north},${east});
  relation["seamark:type"](${south},${west},${north},${east});
);
out center tags;
`;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "SailPlanner/1.0 seamark overlay",
    },
    body: new URLSearchParams({ data: query }).toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ error: `Overpass ${response.status}` }, { status: 502 });
  }

  const json = await response.json() as { elements?: Record<string, unknown>[] };
  const features = (json.elements || [])
    .map(extractFeature)
    .filter((feature): feature is SeamarkFeature => Boolean(feature));

  seamarkCache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    data: features,
  });

  return NextResponse.json({ features, cached: false });
}
