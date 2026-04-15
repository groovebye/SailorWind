import { NextRequest, NextResponse } from "next/server";

const WINDY_WEBCAMS_URL = "https://api.windy.com/webcams/api/v3/webcams";

// Cache webcams for 1 hour
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 3600000;

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  const radius = req.nextUrl.searchParams.get("radius") || "30"; // km

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  const cacheKey = `${lat}_${lon}_${radius}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const apiKey = process.env.WINDY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "WINDY_API_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${WINDY_WEBCAMS_URL}?nearby=${lat},${lon},${radius}&include=images,location,urls&limit=10`,
      {
        headers: { "x-windy-api-key": apiKey },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      // Windy Webcams API requires separate API key from webcams.windy.com
    return NextResponse.json([]);  // Return empty instead of error
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webcams = (data.webcams || []).map((wc: any) => ({
      id: wc.webcamId,
      title: wc.title,
      lat: wc.location?.latitude,
      lon: wc.location?.longitude,
      city: wc.location?.city,
      preview: wc.images?.current?.preview,
      thumbnail: wc.images?.current?.thumbnail,
      playerUrl: wc.urls?.detail,
      status: wc.status,
    }));

    cache.set(cacheKey, { data: webcams, ts: Date.now() });
    return NextResponse.json(webcams);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
