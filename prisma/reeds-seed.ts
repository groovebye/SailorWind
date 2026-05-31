/**
 * Import Reeds Almanac data from prisma/reeds-data/*.json.
 * - "update" entries patch an existing PortArea (coords, approach WPT) + its marina
 *   (name, LOA, berths, contacts, notes) and add a Reeds-sourced price.
 * - "create" entries add a new PortArea (refuge/anchorage) with its approach WPT.
 * Idempotent. Run: npx tsx prisma/reeds-seed.ts
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "reeds-data");
const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

/* eslint-disable @typescript-eslint/no-explicit-any */
type Area = any;

async function applyMarina(portAreaId: string, areaSlug: string, m: Area) {
  const marina = await prisma.marinaOption.findFirst({ where: { portAreaId } });
  if (!marina) { console.warn(`  no marina to update for ${areaSlug}`); return; }
  await prisma.marinaOption.update({
    where: { id: marina.id },
    data: {
      name: m.name ?? undefined,
      maxLength: m.maxLength ?? undefined,
      berthCount: m.berthCount ?? undefined,
      vhfCh: m.vhfCh ?? undefined,
      website: m.website ?? undefined,
      email: m.email ?? undefined,
      phone: m.phone ?? undefined,
      notes: m.notes ?? undefined,
    },
  });
  if (m.daily9_5 != null) {
    await prisma.marinaPrice.deleteMany({ where: { marinaOptionId: marina.id, sourceName: "Reeds Almanac" } });
    await prisma.marinaPrice.create({
      data: {
        marinaOptionId: marina.id, loaMeters: 9.5, season: "low", billingPeriod: "daily",
        price: m.daily9_5, currency: "EUR", taxIncluded: true,
        pricingNote: `Reeds €${m.perMeter?.toFixed(2)}/m (estimated daily for ~9.5 m LOA)`,
        sourceName: "Reeds Almanac", confidence: "estimated",
      },
    });
  }
}

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  let updated = 0, created = 0;
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    for (const a of doc.areas as Area[]) {
      if (a.match === "create") {
        await prisma.portArea.upsert({
          where: { slug: a.slug },
          create: {
            slug: a.slug, name: a.name, country: a.country, region: a.region, type: a.type,
            lat: a.lat, lon: a.lon, coastOrder: a.coastOrder,
            description: a.description ?? null, accessNote: a.accessNote ?? null,
            draftAccess: a.draftAccess ?? null, controllingDepthM: a.controllingDepthM ?? null,
            approachLat: a.approachLat ?? null, approachLon: a.approachLon ?? null, approachNote: a.approachNote ?? null,
            orcaRisk: a.orcaRisk ?? null,
          },
          update: {
            name: a.name, lat: a.lat, lon: a.lon, coastOrder: a.coastOrder, type: a.type,
            description: a.description ?? undefined, accessNote: a.accessNote ?? undefined,
            draftAccess: a.draftAccess ?? undefined, controllingDepthM: a.controllingDepthM ?? undefined,
            approachLat: a.approachLat ?? undefined, approachLon: a.approachLon ?? undefined, approachNote: a.approachNote ?? undefined,
            orcaRisk: a.orcaRisk ?? undefined,
          },
        });
        created++;
        console.log(`  + ${a.name} (${a.slug})`);
      } else {
        const existing = await prisma.portArea.findUnique({ where: { slug: a.slug } });
        if (!existing) { console.warn(`  ~ ${a.slug} not in this DB — skipping`); continue; }
        const area = await prisma.portArea.update({
          where: { slug: a.slug },
          data: {
            lat: a.lat ?? undefined, lon: a.lon ?? undefined,
            accessNote: a.accessNote ?? undefined,
            approachLat: a.approachLat ?? undefined, approachLon: a.approachLon ?? undefined, approachNote: a.approachNote ?? undefined,
          },
        });
        if (a.marina) await applyMarina(area.id, a.slug, a.marina);
        updated++;
        console.log(`  ~ ${a.slug} updated`);
      }
    }
  }
  console.log(`Reeds seed: ${updated} updated, ${created} created.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
