import { authed } from "@/lib/auth/api";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeLegTimelineFromContext, resolveLegTimelineContext } from "@/lib/passage-computation";
import { loadTimelineInputs } from "@/lib/timeline-inputs";
import { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  try {
    const passageRef = req.nextUrl.searchParams.get("passageId") ?? req.nextUrl.searchParams.get("id");
    const legIndexRaw = req.nextUrl.searchParams.get("legIndex");
    const force = req.nextUrl.searchParams.get("force") === "1";

    if (!passageRef || legIndexRaw === null) {
      return NextResponse.json({ error: "passageId and legIndex are required" }, { status: 400 });
    }

    const legIndex = Number.parseInt(legIndexRaw, 10);
    if (Number.isNaN(legIndex)) {
      return NextResponse.json({ error: "legIndex must be a number" }, { status: 400 });
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

    const existing = await prisma.legComputation.findUnique({
      where: {
        passageId_legIndex_forecastSignature_routeSignature_vesselSignature: {
          passageId: passage.id,
          legIndex,
          forecastSignature: context.forecastSignature,
          routeSignature: context.routeSignature,
          vesselSignature: context.vesselSignature,
        },
      },
    });

    if (!force && existing && (!existing.validUntil || existing.validUntil.getTime() > Date.now())) {
      return NextResponse.json({
        source: "cache",
        computedAt: existing.computedAt,
        validUntil: existing.validUntil,
        summary: existing.summary,
        timeline: existing.timeline,
        warnings: existing.warnings,
      });
    }

    const computation = computeLegTimelineFromContext(context, passage, vessel);

    if (existing) {
      const updated = await prisma.legComputation.update({
        where: { id: existing.id },
        data: {
          summary: computation.summary as unknown as Prisma.InputJsonValue,
          timeline: computation.timeline as unknown as Prisma.InputJsonValue,
          warnings: computation.warnings as unknown as Prisma.InputJsonValue,
          computedAt: new Date(),
          validUntil: computation.validUntil,
          status: "ready",
        },
      });

      return NextResponse.json({
        source: "recomputed",
        computedAt: updated.computedAt,
        validUntil: updated.validUntil,
        summary: updated.summary,
        timeline: updated.timeline,
        warnings: updated.warnings,
      });
    }

    const created = await prisma.legComputation.create({
      data: {
        passageId: passage.id,
        legIndex,
        vesselProfileId: vessel.id,
        forecastSignature: computation.forecastSignature,
        routeSignature: computation.routeSignature,
        vesselSignature: computation.vesselSignature,
        summary: computation.summary as unknown as Prisma.InputJsonValue,
        timeline: computation.timeline as unknown as Prisma.InputJsonValue,
        warnings: computation.warnings as unknown as Prisma.InputJsonValue,
        validUntil: computation.validUntil,
        status: "ready",
      },
    });

    return NextResponse.json({
      source: "created",
      computedAt: created.computedAt,
      validUntil: created.validUntil,
      summary: created.summary,
      timeline: created.timeline,
      warnings: created.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
