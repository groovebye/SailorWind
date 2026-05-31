/**
 * Flag the principal harbour-city hubs along the route (La Coruña → Gibraltar).
 *
 * "Major" = a place a cruiser bases at for an overnight / 1–2 day rest: a real
 * town or city with a secure marina, supermarket & transport within reach, fuel,
 * and enough ashore to be worth a layover. These are the natural provisioning /
 * rest stops, well spaced along the 940 nm coast (~one every 50 nm).
 *
 * Curated (not derivable from data: `type` is inconsistent N vs S, and the
 * provisioning fields are unpopulated). Edit the list and re-run to adjust.
 * Idempotent. Run: npx tsx prisma/major-seed.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

const MAJOR_SLUGS = [
  // North coast (Cantabrian / Rías Altas)
  "gijon", "ribadeo", "viveiro", "ferrol", "la-coruna",
  // Rías Baixas
  "vigo", "baiona",
  // Portugal — Atlantic
  "marina-de-viana-do-castelo", "marina-porto-atlantico-leixoes",
  "marina-da-figueira-da-foz", "marina-de-cascais", "lisboa", "marina-de-sines",
  // Algarve
  "marina-de-lagos", "marina-de-portimao", "marina-de-vilamoura",
  // Gulf of Cádiz → Strait
  "cadiz", "el-puerto-de-santa-maria", "puerto-deportivo-de-barbate", "gibraltar",
];

async function main() {
  // Reset then set, so removing a slug from the list un-flags it on re-run.
  await prisma.portArea.updateMany({ data: { isMajor: false } });
  const res = await prisma.portArea.updateMany({
    where: { slug: { in: MAJOR_SLUGS } },
    data: { isMajor: true },
  });
  const flagged = await prisma.portArea.findMany({
    where: { isMajor: true },
    orderBy: { coastOrder: "asc" },
    select: { slug: true, name: true },
  });
  console.log(`Major seed: flagged ${res.count}/${MAJOR_SLUGS.length} hubs.`);
  console.log(flagged.map((p) => p.name).join(" · "));
  const missing = MAJOR_SLUGS.filter((s) => !flagged.some((f) => f.slug === s));
  if (missing.length) console.warn("WARNING — slugs not found:", missing.join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
