import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy to aviationweather.gov (NOAA) for METAR observations + TAF forecasts.
 * Server-side to avoid CORS. GET /api/metar?ids=LECO,LPPT
 * Returns compact decoded fields + the raw strings (the source of truth).
 */
export const revalidate = 1800; // METAR refreshes ~hourly; cache 30 min

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") || "").replace(/[^A-Za-z0-9,]/g, "").toUpperCase();
  if (!ids) return NextResponse.json({ error: "ids required" }, { status: 400 });

  const base = "https://aviationweather.gov/api/data";
  try {
    const [metarRes, tafRes] = await Promise.allSettled([
      fetch(`${base}/metar?ids=${ids}&format=json`, { next: { revalidate: 1800 } }).then((r) => r.json()),
      fetch(`${base}/taf?ids=${ids}&format=json`, { next: { revalidate: 1800 } }).then((r) => r.json()),
    ]);
    const metars: Record<string, unknown>[] = metarRes.status === "fulfilled" && Array.isArray(metarRes.value) ? metarRes.value : [];
    const tafs: Record<string, unknown>[] = tafRes.status === "fulfilled" && Array.isArray(tafRes.value) ? tafRes.value : [];
    const tafBy = new Map(tafs.map((t) => [(t.icaoId as string) || "", t.rawTAF as string]));

    const out = ids.split(",").map((icao) => {
      const m = metars.find((x) => (x.icaoId as string) === icao);
      return {
        icao,
        name: (m?.name as string) ?? null,
        rawMetar: (m?.rawOb as string) ?? null,
        rawTaf: tafBy.get(icao) ?? null,
        wdir: (m?.wdir as number) ?? null,
        wspd: (m?.wspd as number) ?? null, // knots
        wgst: (m?.wgst as number) ?? null,
        temp: (m?.temp as number) ?? null,
        visibKm: m?.visib != null ? Number(String(m.visib).replace("+", "")) : null,
        obsTime: (m?.reportTime as string) ?? null,
      };
    });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }
}
