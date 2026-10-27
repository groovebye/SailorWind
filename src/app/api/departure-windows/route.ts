import { authed } from "@/lib/auth/api";
import { NextRequest, NextResponse } from "next/server";
import { resolveLegTimelineContext } from "@/lib/passage-computation";
import { loadTimelineInputs } from "@/lib/timeline-inputs";
import { computeDepartureWindows, departureCandidates, nextAlignedSlot } from "@/lib/departure-windows";
import { normalizeDeparture } from "@/lib/passage-schedule-client";

const MAX_RUNS = 40; // departures per request (× 3 scenarios)

/**
 * Departure-window comparison for one leg.
 * GET /api/departure-windows?passageId=&legIndex=&start=YYYY-MM-DDTHH:mm&count=13&stepHours=6
 *
 * `start` is a UTC wall-clock (same convention as departure overrides);
 * default is the next whole `stepHours` slot from now. Each departure is
 * simulated under pessimistic / realistic / optimistic scenarios.
 */
export async function GET(req: NextRequest) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  try {
    const params = req.nextUrl.searchParams;
    const passageRef = params.get("passageId") ?? params.get("id");
    const legIndex = Number.parseInt(params.get("legIndex") ?? "", 10);
    if (!passageRef || Number.isNaN(legIndex)) {
      return NextResponse.json({ error: "passageId and legIndex are required" }, { status: 400 });
    }

    const stepHours = Number(params.get("stepHours") ?? 6);
    const count = Number(params.get("count") ?? 13);
    if (!Number.isFinite(stepHours) || stepHours < 1 || stepHours > 24) {
      return NextResponse.json({ error: "stepHours must be 1–24" }, { status: 400 });
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_RUNS) {
      return NextResponse.json({ error: `count must be 1–${MAX_RUNS}` }, { status: 400 });
    }

    const startParam = params.get("start");
    const start = startParam ? normalizeDeparture(startParam) : nextAlignedSlot(new Date(), stepHours);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "start must be YYYY-MM-DDTHH:mm" }, { status: 400 });
    }

    const inputs = await loadTimelineInputs(passageRef, user.id);
    if (inputs === "NO_BOAT") {
      return NextResponse.json({ error: "Add your boat in Settings to compute the timeline.", code: "NO_BOAT" }, { status: 409 });
    }
    if (!inputs) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }
    const { passage, vessel } = inputs;

    const context = await resolveLegTimelineContext(passage, legIndex, vessel);
    const result = computeDepartureWindows({
      context,
      passage,
      vessel,
      departures: departureCandidates(start, count, stepHours),
    });

    return NextResponse.json({
      leg: {
        from: context.leg.from.port.name,
        to: context.leg.to.port.name,
        distanceNm: Math.round(context.routeDistanceNm * 10) / 10,
      },
      vessel: { name: vessel.name, engineCruiseKt: vessel.engineCruiseKt },
      forecastModel: passage.model,
      stepHours,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
