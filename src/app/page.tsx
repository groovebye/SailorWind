import Link from "next/link";
import { prisma } from "@/lib/db";
import { haversineNm } from "@/lib/geo";
import PortsCatalog from "./PortsCatalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const portAreas = await prisma.portArea.findMany({
    // Sort as you sail the route: Gijón (0) → N coast → La Coruña (160) → Gibraltar.
    orderBy: [{ coastOrder: "asc" }, { name: "asc" }],
    include: {
      marinas: {
        include: {
          prices: { where: { loaMeters: 9.5, billingPeriod: "daily", season: "low" }, take: 1 },
        },
      },
      nearbyPlaces: { where: { isRecommended: true }, take: 5 },
    },
  });

  const passages = await prisma.passage.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      waypoints: {
        include: { port: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-blue-400 mb-2">
          &#9973; SailorWind
        </h1>
        <p className="text-slate-400">
          Weather-aware passage planner for sailing
        </p>
      </header>

      <Link
        href="/new"
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors mb-12"
      >
        + New Passage
      </Link>

      {passages.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-300 mb-4">
            Recent Passages
          </h2>
          <div className="space-y-3">
            {passages.map((p) => {
              const stops = p.waypoints.filter((w) => w.isStop);
              const first = stops[0]?.port.name ?? "?";
              const last = stops[stops.length - 1]?.port.name ?? "?";
              const dep = new Date(p.departure).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <Link
                  key={p.id}
                  href={`/p/${p.shortId}`}
                  className="block bg-slate-800 border border-slate-800 rounded-lg p-4 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-blue-400">
                        {p.name || `${first} → ${last}`}
                      </span>
                      <span className="text-slate-500 ml-3 text-sm">{dep}</span>
                    </div>
                    <span className="text-slate-600 text-sm">
                      {p.waypoints.length} waypoints
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Ports & Marinas catalog — compact searchable grid, kept in coast order */}
      {portAreas.length > 0 && (
        <PortsCatalog
          areas={portAreas.map((area, i) => {
            const prices = area.marinas.flatMap((m) => m.prices);
            const cheapest = prices.length
              ? Math.min(...prices.map((p) => p.price))
              : null;
            // Approx straight-line hop to the next port down the coast (great-circle).
            const next = portAreas[i + 1];
            const toNextNm = next
              ? haversineNm([area.lat, area.lon], [next.lat, next.lon])
              : null;
            return {
              id: area.id,
              name: area.name,
              slug: area.slug,
              region: area.region,
              type: area.type,
              marinaCount: area.marinas.length,
              berths: area.marinas.reduce((s, m) => s + (m.berthCount || 0), 0),
              cheapest,
              fuel: area.marinas.some((m) => m.fuel),
              repairs: area.marinas.some((m) => m.repairs),
              recommended: (area.nearbyPlaces || []).length,
              orcaRisk: area.orcaRisk,
              toNextNm,
            };
          })}
        />
      )}
    </div>
  );
}
