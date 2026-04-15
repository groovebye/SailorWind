import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/readiness — pre-departure readiness check
 *
 * Returns maintenance items, fuel status, safety reminders.
 */
export async function GET() {
  const items = await prisma.maintenanceItem.findMany({
    where: { vesselSlug: "bossanova" },
    orderBy: [{ status: "asc" }, { priority: "asc" }],
  });

  const vessel = await prisma.vesselProfile.findUnique({
    where: { slug: "bossanova" },
  });

  const overdue = items.filter(i => i.status === "overdue");
  const due = items.filter(i => i.status === "due");
  const ok = items.filter(i => i.status === "ok");

  // Standard pre-departure safety reminders
  const reminders = [
    "Check weather forecast (AEMET + Windy)",
    "VHF radio test",
    "Engine oil level",
    "Bilge pump test",
    "Navigation lights check",
    "Life jackets accessible",
    "EPIRB registered and charged",
    "Flares within expiry date",
    "Fire extinguisher inspection",
    "First aid kit complete",
  ];

  const readinessScore = overdue.length > 0 ? "not_ready" : due.length > 0 ? "check_needed" : "ready";

  return NextResponse.json({
    vessel: vessel ? { name: vessel.name, fuelTankLiters: vessel.fuelTankLiters } : null,
    readiness: readinessScore,
    overdue,
    due,
    ok,
    totalItems: items.length,
    reminders,
  });
}

// POST /api/readiness — add/update maintenance item
export async function POST(req: Request) {
  const body = await req.json();
  const { id, title, category, status, dueDate, note, priority } = body;

  if (id) {
    const updated = await prisma.maintenanceItem.update({
      where: { id },
      data: { status, note, lastDoneAt: status === "done" ? new Date() : undefined },
    });
    return NextResponse.json(updated);
  }

  const item = await prisma.maintenanceItem.create({
    data: { title, category, status: status || "ok", dueDate: dueDate ? new Date(dueDate) : undefined, note, priority },
  });
  return NextResponse.json(item);
}
