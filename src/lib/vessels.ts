import "server-only";
import { prisma } from "@/lib/db";
import { nanoid } from "@/lib/nanoid";
import type { BoatInput } from "@/lib/auth/schemas";

/**
 * Conservative cruising thresholds (wind kt) used by the leg-timeline engine.
 * Same defaults Bossanova was calibrated with; they don't depend much on size.
 */
export const DEFAULT_PERFORMANCE_MODEL = {
  lightAirMotorThresholdKt: 7,
  motorsailUpwindThresholdKt: 12,
  closeHauledMinAngleDeg: 38,
  efficientRunMinWindKt: 10,
  reef1AtWindKt: 18,
  reef2AtWindKt: 24,
  reef1AtGustKt: 22,
  reef2AtGustKt: 28,
  harborApproachMotorRadiusNm: 1.2,
};

function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "boat"
  );
}

function boatData(b: BoatInput) {
  return {
    name: b.name,
    model: b.model ?? null,
    loaMeters: b.loaMeters,
    draftMeters: b.draftMeters,
    engineCruiseKt: b.engineCruiseKt,
    engineMaxKt: b.engineMaxKt ?? null,
    fuelTankLiters: b.fuelTankLiters ?? null,
    fuelBurnLph: b.fuelBurnLph ?? null,
    notes: b.notes ?? null,
  };
}

/** Add a boat; the first one becomes the default. */
export async function createBoat(ownerId: string, b: BoatInput) {
  const count = await prisma.vesselProfile.count({ where: { ownerId } });
  return prisma.vesselProfile.create({
    data: {
      ...boatData(b),
      slug: `${slugify(b.name)}-${nanoid(6)}`,
      ownerId,
      isDefault: count === 0,
      performanceModel: DEFAULT_PERFORMANCE_MODEL,
    },
  });
}

/** Update a boat the user owns. Returns false if it isn't theirs. */
export async function updateBoat(ownerId: string, id: string, b: BoatInput): Promise<boolean> {
  const { count } = await prisma.vesselProfile.updateMany({ where: { id, ownerId }, data: boatData(b) });
  return count === 1;
}

export async function setDefaultBoat(ownerId: string, id: string): Promise<boolean> {
  const owned = await prisma.vesselProfile.findFirst({ where: { id, ownerId }, select: { id: true } });
  if (!owned) return false;
  await prisma.$transaction([
    prisma.vesselProfile.updateMany({ where: { ownerId }, data: { isDefault: false } }),
    prisma.vesselProfile.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return true;
}

/**
 * Delete a boat the user owns. Passages that used it fall back to the default
 * boat; cached leg computations for it are dropped (they FK the vessel).
 */
export async function deleteBoat(ownerId: string, id: string): Promise<boolean> {
  const boat = await prisma.vesselProfile.findFirst({ where: { id, ownerId }, select: { id: true, isDefault: true } });
  if (!boat) return false;
  await prisma.$transaction([
    prisma.legComputation.deleteMany({ where: { vesselProfileId: id } }),
    prisma.passage.updateMany({ where: { ownerId, vesselProfileId: id }, data: { vesselProfileId: null } }),
    prisma.vesselProfile.delete({ where: { id } }),
  ]);
  if (boat.isDefault) {
    const next = await prisma.vesselProfile.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.vesselProfile.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return true;
}
