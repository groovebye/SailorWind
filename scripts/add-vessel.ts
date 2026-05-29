/**
 * Add / update a vessel profile from a spec + polar file.
 *
 *   npx tsx scripts/add-vessel.ts <spec.json>
 *
 * spec.json:
 * {
 *   "slug": "my-boat", "name": "My Boat",
 *   "loaMeters": 11.2, "draftMeters": 1.9,
 *   "engineCruiseKt": 6.5, "engineMaxKt": 7.2,
 *   "fuelBurnLph": 3.0, "fuelTankLiters": 120, "usableFuelLiters": 110,
 *   "reserveFuelLiters": 15, "motorsailBurnLph": 2.0,
 *   "polarFile": "./my-boat.pol",
 *   "notes": "...",
 *   "performanceModel": { ...optional threshold overrides... }
 * }
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { parsePolarTable } from "../src/lib/polar-import.js";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

const DEFAULT_PERF = {
  lightAirMotorThresholdKt: 7,
  motorsailUpwindThresholdKt: 12,
  closeHauledMinAngleDeg: 38,
  efficientRunMinWindKt: 10,
  reef1AtWindKt: 18,
  reef2AtWindKt: 24,
  reef1AtGustKt: 22,
  reef2AtGustKt: 28,
  harborApproachMotorRadiusNm: 1.2,
  minimumSailingSpeedKt: 3.5,
  lowEfficiencyThresholdPct: 40,
  motorsailEfficiencyThresholdPct: 55,
};

async function main() {
  const specPath = process.argv[2];
  if (!specPath) throw new Error("usage: tsx scripts/add-vessel.ts <spec.json>");
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  if (!spec.slug || !spec.name || !spec.polarFile) throw new Error("spec needs slug, name, polarFile");

  const polarPath = resolve(dirname(specPath), spec.polarFile);
  const polarData = parsePolarTable(readFileSync(polarPath, "utf8"));

  const performanceModel = { ...DEFAULT_PERF, ...(spec.performanceModel ?? {}), polarData };

  const data = {
    name: spec.name,
    loaMeters: spec.loaMeters ?? 10,
    draftMeters: spec.draftMeters ?? 1.8,
    engineCruiseKt: spec.engineCruiseKt ?? 6.0,
    engineMaxKt: spec.engineMaxKt ?? null,
    fuelBurnLph: spec.fuelBurnLph ?? null,
    fuelTankLiters: spec.fuelTankLiters ?? null,
    usableFuelLiters: spec.usableFuelLiters ?? null,
    reserveFuelLiters: spec.reserveFuelLiters ?? null,
    motorsailBurnLph: spec.motorsailBurnLph ?? null,
    notes: spec.notes ?? null,
    performanceModel,
  };

  const v = await prisma.vesselProfile.upsert({
    where: { slug: spec.slug },
    update: data,
    create: { slug: spec.slug, ...data },
  });
  console.log(`Vessel "${v.name}" (${v.slug}) saved. Polar: ${polarData.twaDegrees.length} TWA x ${polarData.twsKnots.length} TWS, hull ${polarData.hullSpeedKt}kt.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
