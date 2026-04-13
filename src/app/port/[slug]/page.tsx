"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "@/lib/theme";

const MarinaMiniMap = dynamic(() => import("@/components/MarinaMiniMap"), { ssr: false });

interface MarinaPrice { season: string; billingPeriod: string; price: number; currency: string; sourceName: string | null; confidence: string | null; checkedAt: string | null; }
interface MarinaOption {
  id: string; name: string; slug: string; kind: string; lat: number; lon: number;
  phone: string | null; email: string | null; website: string | null; vhfCh: string | null;
  shelter: string | null; maxDraft: number | null; maxLength: number | null;
  berthCount: number | null; visitorBerths: number | null;
  fuel: boolean; water: boolean; electric: boolean; repairs: boolean;
  laundry: boolean; showers: boolean; toilets: boolean; wifi: boolean;
  customs: boolean; securityGate: boolean; pumpOut: boolean;
  marinaHours: string | null; approachDescription: string | null;
  entranceNotes: string | null; waitingArea: string | null;
  bestTideEntry: string | null; swellSensitivity: string | null;
  notes: string | null; prices: MarinaPrice[];
  mapFeatures: { type: string; name: string; geometry: { type: string; coordinates: [number, number] }; description: string | null }[];
}
interface NearbyPlace {
  id: string; name: string; category: string; subcategory: string | null;
  description: string | null; address: string | null; phone: string | null;
  hours: string | null; distanceMeters: number | null; walkMinutes: number | null;
  rating: number | null; reviewCount: number | null; priceLevel: string | null;
  isRecommended: boolean; bestFor: string | null; marinaOptionId: string | null;
  sourceName: string | null; confidence: string | null;
}

interface PortArea {
  name: string; slug: string; country: string; region: string | null;
  lat: number; lon: number; type: string;
  description: string | null; arrivalSummary: string | null;
  shoreSummary: string | null; repairSummary: string | null;
  provisioningSummary: string | null;
  restaurants: unknown; yachtShops: unknown; groceryStores: unknown; extras: unknown;
  orcaRisk: string | null; orcaNotes: string | null;
  marinas: MarinaOption[];
  nearbyPlaces: NearbyPlace[];
}

const CATEGORY_LABELS: Record<string, { icon: string; label: string }> = {
  restaurant: { icon: "🍽️", label: "Restaurants" },
  cafe: { icon: "☕", label: "Cafés" },
  bar: { icon: "🍺", label: "Bars" },
  chandlery: { icon: "⛵", label: "Chandlery & Marine" },
  marine_service: { icon: "🔧", label: "Marine Services" },
  grocery: { icon: "🛒", label: "Grocery" },
  market: { icon: "🏪", label: "Markets" },
  bakery: { icon: "🍞", label: "Bakery" },
  pharmacy: { icon: "💊", label: "Pharmacy" },
  laundry: { icon: "👕", label: "Laundry" },
  atm: { icon: "🏧", label: "ATM" },
  hospital: { icon: "🏥", label: "Hospital" },
  taxi: { icon: "🚕", label: "Taxi" },
};

function NearbyPlaceCard({ place }: { place: NearbyPlace }) {
  return (
    <div className="rounded-lg px-3 py-2 mb-1.5" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs" style={{ color: "var(--text-heading)" }}>{place.name}</span>
          {place.isRecommended && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Recommended</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {place.rating && (
            <span style={{ color: "var(--text-yellow)" }}>★ {place.rating}{place.reviewCount ? ` (${place.reviewCount})` : ""}</span>
          )}
          {place.priceLevel && <span style={{ color: "var(--text-muted)" }}>{place.priceLevel}</span>}
        </div>
      </div>
      {place.description && <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{place.description}</div>}
      <div className="flex flex-wrap gap-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
        {(place.distanceMeters || place.walkMinutes) && (
          <span>🚶 {place.distanceMeters ? `${place.distanceMeters}m` : ""}{place.distanceMeters && place.walkMinutes ? " · " : ""}{place.walkMinutes ? `${place.walkMinutes} min` : ""}</span>
        )}
        {place.phone && <a href={`tel:${place.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>📞 {place.phone}</a>}
        {place.hours && <span>🕐 {place.hours}</span>}
        {place.address && <span>📍 {place.address}</span>}
      </div>
    </div>
  );
}

function marinaSize(berths: number | null): string {
  if (!berths) return "Unknown";
  if (berths > 500) return "Major";
  if (berths > 250) return "Large";
  if (berths > 80) return "Medium";
  return "Small";
}

function priceDisplay(prices: MarinaPrice[], season: string, period: string): string {
  const p = prices.find(pr => pr.season === season && pr.billingPeriod === period);
  if (!p) return "—";
  return `€${p.price}`;
}

export default function PortAreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  useTheme();
  const [area, setArea] = useState<PortArea | null>(null);

  useEffect(() => {
    fetch(`/api/port-areas?slug=${slug}`).then(r => r.json()).then(d => { if (!d.error) setArea(d); });
  }, [slug]);

  if (!area) return <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-4" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <Link href="/" className="text-sm mb-3 inline-block hover:opacity-80" style={{ color: "var(--text-secondary)" }}>← Home</Link>

      {/* Header */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ background: `linear-gradient(to right, var(--bg-header-from), var(--bg-header-to))`, border: `1px solid var(--border)` }}>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-heading)" }}>⚓ {area.name}</h1>
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{area.region}, {area.country} · {area.type.replace("_", " ")}</div>
        {area.description && <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{area.description}</p>}
        {area.orcaRisk && area.orcaRisk !== "none" && (
          <div className="text-xs mt-2" style={{ color: "var(--text-yellow)" }}>🐋 Orca risk: {area.orcaRisk.toUpperCase()}</div>
        )}
      </div>

      {/* Summaries */}
      {(area.arrivalSummary || area.shoreSummary || area.repairSummary) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-xs">
          {area.arrivalSummary && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: `1px solid var(--border-light)` }}><div className="text-[10px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Arrival</div>{area.arrivalSummary}</div>}
          {area.shoreSummary && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: `1px solid var(--border-light)` }}><div className="text-[10px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Shore</div>{area.shoreSummary}</div>}
          {area.repairSummary && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: `1px solid var(--border-light)` }}><div className="text-[10px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Repairs</div>{area.repairSummary}</div>}
        </div>
      )}

      {/* Marina Options */}
      <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-heading)" }}>Marina Options ({area.marinas.length})</h2>

      {/* Comparison table */}
      {area.marinas.length > 1 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse" style={{ background: "var(--bg-card)" }}>
            <thead>
              <tr className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                <th className="text-left px-3 py-2">Marina</th>
                <th className="text-center px-2 py-2">Size</th>
                <th className="text-center px-2 py-2">Visitor</th>
                <th className="text-center px-2 py-2">Draft</th>
                <th className="text-center px-2 py-2">Shelter</th>
                <th className="text-center px-2 py-2">Fuel</th>
                <th className="text-center px-2 py-2">Repairs</th>
                <th className="text-center px-2 py-2">Daily (low)</th>
                <th className="text-center px-2 py-2">Daily (high)</th>
                <th className="text-center px-2 py-2">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {area.marinas.map(m => (
                <tr key={m.id} style={{ borderBottom: `1px solid var(--border-light)` }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: "var(--text-heading)" }}>{m.name}</td>
                  <td className="text-center px-2 py-2">{marinaSize(m.berthCount)}</td>
                  <td className="text-center px-2 py-2">{m.visitorBerths || "?"}</td>
                  <td className="text-center px-2 py-2">{m.maxDraft ? `${m.maxDraft}m` : "?"}</td>
                  <td className="text-center px-2 py-2" style={{ color: m.shelter === "good" ? "var(--text-green)" : "var(--text-yellow)" }}>{m.shelter?.toUpperCase() || "?"}</td>
                  <td className="text-center px-2 py-2">{m.fuel ? "✓" : "—"}</td>
                  <td className="text-center px-2 py-2">{m.repairs ? "✓" : "—"}</td>
                  <td className="text-center px-2 py-2">{priceDisplay(m.prices, "low", "daily")}</td>
                  <td className="text-center px-2 py-2">{priceDisplay(m.prices, "high", "daily")}</td>
                  <td className="text-center px-2 py-2">{priceDisplay(m.prices, "low", "monthly")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Marina detail cards */}
      {area.marinas.map(m => (
        <div key={m.id} className="rounded-xl mb-3 overflow-hidden" style={{ border: `1px solid var(--border-light)` }}>
          <div className="px-4 py-3" style={{ background: "var(--bg-card)" }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{m.name}</h3>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.kind.replace("_", " ")} · {marinaSize(m.berthCount)} ({m.berthCount} berths, {m.visitorBerths || "?"} visitor)</div>
              </div>
              <div className="text-right text-xs">
                {m.prices.length > 0 && (
                  <div style={{ color: "var(--text-green)" }}>
                    from €{Math.min(...m.prices.map(p => p.price))}/day
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-wrap gap-3 text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
              {m.phone && <a href={`tel:${m.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>📞 {m.phone}</a>}
              {m.vhfCh && <span>📻 VHF {m.vhfCh}</span>}
              {m.website && <a href={m.website} target="_blank" rel="noopener" style={{ color: "var(--text-blue-light)" }}>🌐 Website</a>}
              {m.marinaHours && <span>🕐 {m.marinaHours}</span>}
            </div>

            {/* Specs */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-[11px] mb-2" style={{ color: "var(--text-secondary)" }}>
              {m.maxDraft && <div>📐 Draft: {m.maxDraft}m</div>}
              {m.maxLength && <div>📏 LOA: {m.maxLength}m</div>}
              {m.shelter && <div>🛡️ <span style={{ color: m.shelter === "good" ? "var(--text-green)" : "var(--text-yellow)" }}>{m.shelter.toUpperCase()}</span></div>}
            </div>

            {/* Facilities */}
            <div className="flex flex-wrap gap-1 text-[10px] mb-2">
              {m.fuel && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Fuel</span>}
              {m.water && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Water</span>}
              {m.electric && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Electric</span>}
              {m.repairs && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Repairs</span>}
              {m.showers && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Showers</span>}
              {m.laundry && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Laundry</span>}
              {m.wifi && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Wi-Fi</span>}
              {m.securityGate && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Gate</span>}
              {m.pumpOut && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Pump-out</span>}
              {m.customs && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>Customs</span>}
            </div>

            {/* Pricing */}
            {m.prices.length > 0 && (
              <div className="rounded-lg px-3 py-2 mb-2 text-xs" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
                <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Pricing (LOA 9.5m)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div><span style={{ color: "var(--text-muted)" }}>Daily (low):</span> {priceDisplay(m.prices, "low", "daily")}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>Daily (high):</span> {priceDisplay(m.prices, "high", "daily")}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>Monthly (low):</span> {priceDisplay(m.prices, "low", "monthly")}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>Monthly (high):</span> {priceDisplay(m.prices, "high", "monthly")}</div>
                </div>
                {m.prices[0]?.sourceName && (
                  <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Source: {m.prices[0].sourceName} · {m.prices[0].confidence || "unverified"}
                    {m.prices[0].checkedAt && ` · checked ${new Date(m.prices[0].checkedAt).toISOString().slice(0, 10)}`}
                  </div>
                )}
              </div>
            )}
            {m.prices.length === 0 && (
              <div className="text-xs px-3 py-2 rounded-lg mb-2" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>No verified tariff yet</div>
            )}

            {/* Approach */}
            {m.approachDescription && <div className="text-xs p-2 rounded mb-2" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>{m.approachDescription}</div>}

            {/* Marina mini-map */}
            {m.mapFeatures && m.mapFeatures.length > 0 && (
              <div className="mb-2">
                <MarinaMiniMap
                  features={m.mapFeatures}
                  center={[m.lat, m.lon]}
                  name={m.name}
                />
              </div>
            )}
            {m.mapFeatures && m.mapFeatures.length === 0 && (
              <div className="text-[10px] mb-2 px-2 py-1 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>Map not curated yet</div>
            )}

            {m.notes && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{m.notes}</div>}
          </div>
        </div>
      ))}

      {/* Nearby Places by category */}
      {area.nearbyPlaces && area.nearbyPlaces.length > 0 && (() => {
        const cats = [...new Set(area.nearbyPlaces.map(p => p.category))];
        return cats.map(cat => {
          const places = area.nearbyPlaces.filter(p => p.category === cat);
          const meta = CATEGORY_LABELS[cat] || { icon: "📍", label: cat };
          return (
            <div key={cat} className="mb-4">
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-heading)" }}>{meta.icon} {meta.label} ({places.length})</h3>
              {places.map(p => <NearbyPlaceCard key={p.id} place={p} />)}
            </div>
          );
        });
      })()}

      <div className="text-center text-[10px] mt-6 pt-4" style={{ color: "var(--text-muted)", borderTop: `1px solid var(--border-light)` }}>
        Data verified where indicated. Cross-check critical info before arrival.
      </div>
    </div>
  );
}
