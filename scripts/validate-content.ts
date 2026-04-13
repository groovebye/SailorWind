#!/usr/bin/env npx tsx
/**
 * Validate content completeness for SailorWind.
 * Run: npx tsx scripts/validate-content.ts
 */

import "dotenv/config";

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const prisma = new PrismaClient();

  console.log("=== SailorWind Content Validation ===\n");

  const ports = await prisma.port.count();
  const portAreas = await prisma.portArea.count();
  const marinas = await prisma.marinaOption.count();
  const prices = await prisma.marinaPrice.count();
  const mapFeatures = await prisma.marinaMapFeature.count();
  const nearbyPlaces = await prisma.nearbyPlace.count();
  const legGuides = await prisma.legGuide.count();

  const expected = {
    ports: { min: 19, label: "Ports (route waypoints)" },
    portAreas: { min: 8, label: "Port Areas (content)" },
    marinas: { min: 9, label: "Marina Options" },
    prices: { min: 20, label: "Marina Prices" },
    mapFeatures: { min: 18, label: "Marina Map Features" },
    nearbyPlaces: { min: 20, label: "Nearby Places" },
    legGuides: { min: 5, label: "Leg Guides" },
  };

  const counts: Record<string, number> = { ports, portAreas, marinas, prices, mapFeatures, nearbyPlaces, legGuides };
  let allOk = true;

  for (const [key, spec] of Object.entries(expected)) {
    const actual = counts[key];
    const ok = actual >= spec.min;
    if (!ok) allOk = false;
    console.log(`${ok ? "✓" : "✗"} ${spec.label}: ${actual} (min: ${spec.min})`);
  }

  // Check marinas without map features
  const marinasWithoutMaps = await prisma.marinaOption.count({
    where: { mapFeatures: { none: {} } },
  });
  if (marinasWithoutMaps > 0) {
    allOk = false;
    console.log(`✗ ${marinasWithoutMaps} marina(s) without map features`);
  } else {
    console.log("✓ All marinas have map features");
  }

  // Check marinas without prices
  const marinasWithoutPrices = await prisma.marinaOption.count({
    where: { prices: { none: {} } },
  });
  if (marinasWithoutPrices > 0) {
    console.log(`⚠ ${marinasWithoutPrices} marina(s) without pricing`);
  } else {
    console.log("✓ All marinas have pricing");
  }

  // Check port areas without nearby places
  const areasWithoutPlaces = await prisma.portArea.count({
    where: { nearbyPlaces: { none: {} } },
  });
  if (areasWithoutPlaces > 0) {
    console.log(`⚠ ${areasWithoutPlaces} port area(s) without nearby places`);
  } else {
    console.log("✓ All port areas have nearby places");
  }

  console.log(`\n${allOk ? "ALL CHECKS PASSED ✓" : "SOME CHECKS FAILED ✗"}`);

  await prisma.$disconnect();
  process.exit(allOk ? 0 : 1);
}

main();
