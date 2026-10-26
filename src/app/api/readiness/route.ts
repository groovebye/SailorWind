import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authed } from "@/lib/auth/api";
import { defaultVessel } from "@/lib/auth/dal";

/**
 * GET /api/readiness — pre-departure readiness check for the user's default boat
 *
 * Returns maintenance items, fuel status, safety reminders.
 */
export async function GET(req: Request) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const vessel = await defaultVessel(user.id);

  const items = vessel
    ? await prisma.maintenanceItem.findMany({
        where: { vesselSlug: vessel.slug },
        orderBy: [{ status: "asc" }, { priority: "asc" }],
      })
    : [];

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

// POST /api/readiness — add/update a maintenance item on the user's default boat
export async function POST(req: Request) {
  const user = await authed(req);
  if (user instanceof Response) return user;
  const vessel = await defaultVessel(user.id);
  if (!vessel) return NextResponse.json({ error: "Add a boat first" }, { status: 409 });

  const body = await req.json();
  const { id, title, category, status, dueDate, note, priority } = body;

  if (id) {
    const mine = await prisma.vesselProfile.findMany({ where: { ownerId: user.id }, select: { slug: true } });
    const { count } = await prisma.maintenanceItem.updateMany({
      where: { id, vesselSlug: { in: mine.map((v) => v.slug) } },
      data: { status, note, lastDoneAt: status === "done" ? new Date() : undefined },
    });
    if (!count) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json(await prisma.maintenanceItem.findUnique({ where: { id } }));
  }

  const item = await prisma.maintenanceItem.create({
    data: {
      vesselSlug: vessel.slug,
      title,
      category,
      status: status || "ok",
      dueDate: dueDate ? new Date(dueDate) : undefined,
      note,
      priority,
    },
  });
  return NextResponse.json(item);
}
