/**
 * Marina Recommendation Engine
 *
 * Scores marinas within a PortArea for different use cases.
 * Returns ranked recommendations with reasons.
 */

interface MarinaForScoring {
  name: string;
  slug: string;
  kind: string;
  shelter: string | null;
  maxDraft: number | null;
  berthCount: number | null;
  visitorBerths: number | null;
  fuel: boolean;
  water: boolean;
  electric: boolean;
  repairs: boolean;
  laundry: boolean;
  showers: boolean;
  wifi: boolean;
  customs: boolean;
  prices: { season: string; billingPeriod: string; price: number }[];
  bestFor: string | null;
  cityWalkMinutes: number | null;
}

export interface MarinaRecommendation {
  useCase: string;
  icon: string;
  marinaSlug: string;
  marinaName: string;
  reason: string;
  tradeoff: string;
}

function dailyPrice(marina: MarinaForScoring, season: "low" | "high"): number | null {
  const p = marina.prices.find(pr => pr.season === season && pr.billingPeriod === "daily");
  return p?.price ?? null;
}

function monthlyPrice(marina: MarinaForScoring, season: "low" | "high"): number | null {
  const p = marina.prices.find(pr => pr.season === season && pr.billingPeriod === "monthly");
  return p?.price ?? null;
}

export function generateRecommendations(marinas: MarinaForScoring[]): MarinaRecommendation[] {
  if (marinas.length === 0) return [];
  if (marinas.length === 1) {
    return [{ useCase: "Only option", icon: "⚓", marinaSlug: marinas[0].slug, marinaName: marinas[0].name, reason: "Single marina in this area", tradeoff: "No alternatives" }];
  }

  const recs: MarinaRecommendation[] = [];

  // Best transient (daily visitor)
  const byDailyPrice = [...marinas].filter(m => dailyPrice(m, "low") != null).sort((a, b) => (dailyPrice(a, "low") ?? 999) - (dailyPrice(b, "low") ?? 999));
  const byVisitorBerths = [...marinas].sort((a, b) => (b.visitorBerths ?? 0) - (a.visitorBerths ?? 0));
  const bestTransient = byVisitorBerths[0];
  if (bestTransient) {
    recs.push({
      useCase: "Best transient",
      icon: "🚢",
      marinaSlug: bestTransient.slug,
      marinaName: bestTransient.name,
      reason: `${bestTransient.visitorBerths ?? "?"} visitor berths${dailyPrice(bestTransient, "low") ? `, €${dailyPrice(bestTransient, "low")}/day` : ""}`,
      tradeoff: byDailyPrice[0] && byDailyPrice[0].slug !== bestTransient.slug ? `${byDailyPrice[0].name} is cheaper` : "Good value",
    });
  }

  // Best budget
  if (byDailyPrice.length > 0 && byDailyPrice[0].slug !== bestTransient?.slug) {
    recs.push({
      useCase: "Best budget",
      icon: "💰",
      marinaSlug: byDailyPrice[0].slug,
      marinaName: byDailyPrice[0].name,
      reason: `€${dailyPrice(byDailyPrice[0], "low")}/day — cheapest option`,
      tradeoff: `${byDailyPrice[0].visitorBerths ?? "Few"} visitor berths`,
    });
  }

  // Best monthly
  const byMonthly = [...marinas].filter(m => monthlyPrice(m, "low") != null).sort((a, b) => (monthlyPrice(a, "low") ?? 9999) - (monthlyPrice(b, "low") ?? 9999));
  if (byMonthly.length > 0) {
    recs.push({
      useCase: "Best monthly",
      icon: "📅",
      marinaSlug: byMonthly[0].slug,
      marinaName: byMonthly[0].name,
      reason: `€${monthlyPrice(byMonthly[0], "low")}/month low season`,
      tradeoff: byMonthly.length > 1 ? `vs €${monthlyPrice(byMonthly[1], "low")}/month at ${byMonthly[1].name}` : "Only monthly option",
    });
  }

  // Best repairs
  const withRepairs = marinas.filter(m => m.repairs);
  if (withRepairs.length > 0) {
    const best = withRepairs.sort((a, b) => (b.berthCount ?? 0) - (a.berthCount ?? 0))[0];
    recs.push({
      useCase: "Best repairs",
      icon: "🔧",
      marinaSlug: best.slug,
      marinaName: best.name,
      reason: `Repair facilities, ${best.berthCount ?? "?"} berths`,
      tradeoff: best.fuel ? "Also has fuel" : "No fuel dock",
    });
  }

  // Best provisioning (closest to town)
  const byCity = [...marinas].filter(m => m.cityWalkMinutes != null).sort((a, b) => (a.cityWalkMinutes ?? 99) - (b.cityWalkMinutes ?? 99));
  if (byCity.length > 0) {
    recs.push({
      useCase: "Best provisioning",
      icon: "🛒",
      marinaSlug: byCity[0].slug,
      marinaName: byCity[0].name,
      reason: `${byCity[0].cityWalkMinutes} min to town center`,
      tradeoff: byCity[0].shelter === "good" ? "Good shelter too" : "Shelter: " + (byCity[0].shelter ?? "unknown"),
    });
  }

  // Best weather wait
  const byShelter = [...marinas].filter(m => m.shelter === "good").sort((a, b) => (b.berthCount ?? 0) - (a.berthCount ?? 0));
  if (byShelter.length > 0 && !recs.some(r => r.marinaSlug === byShelter[0].slug && r.useCase === "Best transient")) {
    recs.push({
      useCase: "Best weather wait",
      icon: "⛈️",
      marinaSlug: byShelter[0].slug,
      marinaName: byShelter[0].name,
      reason: `Good shelter, ${byShelter[0].berthCount ?? "?"} berths${byShelter[0].laundry ? ", laundry" : ""}${byShelter[0].wifi ? ", wifi" : ""}`,
      tradeoff: monthlyPrice(byShelter[0], "low") ? `€${monthlyPrice(byShelter[0], "low")}/month if extended` : "Check monthly rates",
    });
  }

  return recs;
}

/**
 * Shore practicality scores by scenario.
 */
export interface ShorePracticality {
  scenario: string;
  icon: string;
  score: "excellent" | "good" | "adequate" | "limited";
  highlights: string[];
}

interface NearbyPlaceForScoring {
  name: string;
  category: string;
  distanceMeters: number | null;
  walkMinutes: number | null;
  rating: number | null;
  isRecommended: boolean;
  hours: string | null;
}

export function assessShorePracticality(
  places: NearbyPlaceForScoring[],
  marinas: MarinaForScoring[],
): ShorePracticality[] {
  const scenarios: ShorePracticality[] = [];
  const hasCategory = (cat: string) => places.some(p => p.category === cat);
  const bestOf = (cat: string) => places.filter(p => p.category === cat).sort((a, b) => (a.walkMinutes ?? 99) - (b.walkMinutes ?? 99))[0];

  // One night stopover
  const restaurant = bestOf("restaurant");
  const grocery = bestOf("grocery");
  scenarios.push({
    scenario: "One night",
    icon: "🌙",
    score: restaurant && grocery ? "excellent" : restaurant || grocery ? "good" : "limited",
    highlights: [
      restaurant ? `Dinner: ${restaurant.name} (${restaurant.walkMinutes ?? "?"}min)` : "No nearby restaurants",
      grocery ? `Provisions: ${grocery.name} (${grocery.walkMinutes ?? "?"}min)` : "No nearby grocery",
    ],
  });

  // Weather wait (2-3 days)
  const hasLaundry = hasCategory("laundry") || marinas.some(m => m.laundry);
  const hasWifi = marinas.some(m => m.wifi);
  scenarios.push({
    scenario: "Weather wait",
    icon: "⛈️",
    score: hasLaundry && hasWifi && restaurant ? "excellent" : restaurant ? "good" : "adequate",
    highlights: [
      hasWifi ? "Wi-Fi available" : "No Wi-Fi",
      hasLaundry ? "Laundry available" : "No laundry",
      restaurant ? `Food: ${restaurant.name}` : "Cook onboard",
    ],
  });

  // Repairs
  const chandlery = bestOf("chandlery");
  const hasRepairs = marinas.some(m => m.repairs);
  scenarios.push({
    scenario: "Repairs",
    icon: "🔧",
    score: hasRepairs && chandlery ? "excellent" : hasRepairs || chandlery ? "good" : "limited",
    highlights: [
      hasRepairs ? "Marina repair services" : "No repair facilities",
      chandlery ? `Chandlery: ${chandlery.name} (${chandlery.walkMinutes ?? "?"}min)` : "No chandlery nearby",
    ],
  });

  // Provisioning
  const market = bestOf("market");
  const pharmacy = bestOf("pharmacy");
  scenarios.push({
    scenario: "Provisioning",
    icon: "🛒",
    score: grocery && pharmacy ? "excellent" : grocery ? "good" : "limited",
    highlights: [
      grocery ? `Supermarket: ${grocery.name} (${grocery.walkMinutes ?? "?"}min)` : "No supermarket",
      market ? `Market: ${market.name}` : "",
      pharmacy ? `Pharmacy: ${pharmacy.walkMinutes ?? "?"}min` : "",
    ].filter(Boolean),
  });

  return scenarios;
}
