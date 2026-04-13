import { NextRequest, NextResponse } from "next/server";
import { getTidePrediction, tideStateAt } from "@/lib/tides";

/**
 * GET /api/tides?port=gijon&date=2026-04-19T11:00&days=2
 *
 * Returns HW/LW predictions + tide state at the given time.
 */
export async function GET(req: NextRequest) {
  const portSlug = req.nextUrl.searchParams.get("port");
  const dateStr = req.nextUrl.searchParams.get("date");
  const daysStr = req.nextUrl.searchParams.get("days") || "2";

  if (!portSlug) {
    return NextResponse.json({ error: "port slug required" }, { status: 400 });
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  const days = parseInt(daysStr, 10) || 2;

  const prediction = getTidePrediction(portSlug, date, days);
  if (!prediction) {
    return NextResponse.json({ error: `No tide data for port: ${portSlug}` }, { status: 404 });
  }

  const stateAtDate = tideStateAt(prediction, date);

  return NextResponse.json({
    port: portSlug,
    date: date.toISOString(),
    isSpring: prediction.isSpring,
    range: prediction.range,
    stateAtDate,
    extremes: prediction.extremes.map(e => ({
      time: e.time.toISOString(),
      type: e.type,
      height: e.height,
    })),
    stream: prediction.nearestStream,
    disclaimer: "Approximate tidal predictions based on harmonic constants. For precision, cross-check with Admiralty EasyTide or Puertos del Estado.",
  });
}
