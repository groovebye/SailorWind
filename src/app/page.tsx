import Link from "next/link";
import { Plus, Map as MapIcon, Route, Navigation, Clock, MapPin, Triangle, Anchor } from "lucide-react";
import { prisma } from "@/lib/db";
import { haversineNm } from "@/lib/geo";
import HeroStats from "./_dashboard/HeroStats";
import LiveConditions from "./_dashboard/LiveConditions";
import PortsExplorer from "./_dashboard/PortsExplorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const portAreas = await prisma.portArea.findMany({
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
    take: 6,
    include: { waypoints: { include: { port: true }, orderBy: { sortOrder: "asc" } } },
  });

  // Card stats from real geometry (nm from coords, hours from speed, capes flagged).
  const cards = passages.map((p) => {
    const wps = p.waypoints;
    const stops = wps.filter((w) => w.isStop);
    const from = (stops[0] ?? wps[0])?.port.name ?? "?";
    const to = (stops[stops.length - 1] ?? wps[wps.length - 1])?.port.name ?? "?";
    let nm = 0;
    for (let i = 1; i < wps.length; i++) {
      nm += haversineNm([wps[i - 1].port.lat, wps[i - 1].port.lon], [wps[i].port.lat, wps[i].port.lon]);
    }
    const hours = p.speed > 0 ? nm / p.speed : 0;
    return {
      id: p.shortId,
      from,
      to,
      date: new Date(p.departure).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      nm: Math.round(nm * 10) / 10,
      hours: Math.round(hours * 10) / 10,
      capes: wps.filter((w) => w.isCape).length,
      wp: wps.length,
      mode: p.mode === "nonstop" ? "Non-stop" : "Day-hops",
    };
  });

  const activeId = passages[0]?.shortId ?? null;
  const start = passages[0]?.waypoints.find((w) => w.isStop) ?? passages[0]?.waypoints[0];
  const livePoint = start
    ? { name: start.port.name, lat: start.port.lat, lon: start.port.lon }
    : { name: "La Coruña", lat: 43.371, lon: -8.396 };

  const totalNm = Math.round(cards.reduce((a, c) => a + c.nm, 0));

  const ports = portAreas.map((area, i) => {
    const prices = area.marinas.flatMap((m) => m.prices);
    const cheapest = prices.length ? Math.min(...prices.map((pr) => pr.price)) : null;
    const next = portAreas[i + 1];
    const toNextNm = next ? haversineNm([area.lat, area.lon], [next.lat, next.lon]) : null;
    return {
      id: area.id,
      name: area.name,
      slug: area.slug,
      lat: area.lat,
      lon: area.lon,
      region: area.region,
      type: area.type,
      marinaCount: area.marinas.length,
      berths: area.marinas.reduce((s, m) => s + (m.berthCount || 0), 0),
      cheapest,
      fuel: area.marinas.some((m) => m.fuel),
      repairs: area.marinas.some((m) => m.repairs),
      recommended: (area.nearbyPlaces || []).length,
      orcaRisk: area.orcaRisk,
      isMajor: area.isMajor,
      inReeds: area.inReeds,
      draftAccess: area.draftAccess,
      controllingDepthM: area.controllingDepthM,
      accessNote: area.accessNote,
      toNextNm,
    };
  });

  return (
    <div className="container fade-up" style={{ paddingBottom: 80 }}>
      {/* HERO */}
      <section style={{ paddingTop: 48 }}>
        <div className="hero-grid">
          <div>
            <div className="eyebrow" style={{ marginBottom: 18 }}>Bossanova · Hallberg-Rassy Monsun 31</div>
            <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 72px)", margin: "0 0 20px" }}>
              Plan the wind.<br />
              <span style={{ color: "var(--cyan)" }}>Sail the window.</span>
            </h1>
            <p className="dim" style={{ fontSize: 18, lineHeight: 1.55, maxWidth: 480, margin: "0 0 30px" }}>
              Cape-by-cape forecasts, a live GO/NO-GO departure timeline and my own
              co-skipper — tuned for the Atlantic coast from Biscay to Gibraltar.
            </p>
            <div className="flex gap-12 wrap">
              <Link href="/new" className="btn btn-primary btn-lg"><Plus size={18} /> New passage</Link>
              {activeId && (
                <Link href={`/p/${activeId}/map`} className="btn btn-lg"><MapIcon size={18} /> Open chart</Link>
              )}
            </div>
            <HeroStats passages={cards.length} nm={totalNm} ports={ports.length} />
          </div>

          <LiveConditions
            name={livePoint.name}
            lat={livePoint.lat}
            lon={livePoint.lon}
            passageHref={activeId ? `/p/${activeId}` : "/new"}
            to={cards[0]?.to ?? null}
          />
        </div>
      </section>

      {/* RECENT PASSAGES */}
      {cards.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <div className="between" style={{ marginBottom: 22, alignItems: "flex-end" }}>
            <div className="center gap-12">
              <div className="sec-icon"><Route size={18} /></div>
              <div>
                <h2 className="display" style={{ fontSize: 28, margin: 0 }}>Recent passages</h2>
                <div className="dim" style={{ fontSize: 14, marginTop: 3 }}>Pick up where you left off</div>
              </div>
            </div>
            <Link href="/new" className="btn btn-sm btn-ghost"><Plus size={15} /> New</Link>
          </div>
          <div className="passage-grid stagger">
            {cards.map((p, i) => (
              <Link
                key={p.id}
                href={`/p/${p.id}`}
                className="glass glass-hover passage-card"
                style={{ animationDelay: i * 0.05 + "s", padding: 20 }}
              >
                <div className="between" style={{ marginBottom: 16 }}>
                  <span className="mono faint" style={{ fontSize: 12 }}>{p.date}</span>
                  <span className="pill">{p.mode}</span>
                </div>
                <div className="route-line">
                  <span className="route-port">{p.from}</span>
                  <span className="route-arrow"><Navigation size={16} style={{ transform: "rotate(90deg)" }} /></span>
                  <span className="route-port">{p.to}</span>
                </div>
                <div className="flex gap-16 wrap" style={{ marginTop: 16 }}>
                  <Metric icon={<Navigation size={14} />} v={`${p.nm} NM`} />
                  <Metric icon={<Clock size={14} />} v={`~${p.hours}h`} />
                  <Metric icon={<MapPin size={14} />} v={`${p.wp} wp`} />
                  {p.capes > 0 && <Metric icon={<Triangle size={14} />} v={`${p.capes} cape${p.capes > 1 ? "s" : ""}`} />}
                </div>
                <div className="passage-card-glow" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* PORTS & MARINAS */}
      {ports.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <div className="center gap-12" style={{ marginBottom: 22 }}>
            <div className="sec-icon"><Anchor size={18} /></div>
            <div>
              <h2 className="display" style={{ fontSize: 28, margin: 0 }}>Ports &amp; marinas</h2>
              <div className="dim" style={{ fontSize: 14, marginTop: 3 }}>
                {ports.length} along the Atlantic route · Gijón → Gibraltar
              </div>
            </div>
          </div>
          <PortsExplorer ports={ports} />
        </section>
      )}
    </div>
  );
}

function Metric({ icon, v }: { icon: React.ReactNode; v: string }) {
  return (
    <span className="center gap-6 dim" style={{ fontSize: 13 }}>
      <span style={{ opacity: 0.7, display: "flex" }}>{icon}</span> <span className="mono">{v}</span>
    </span>
  );
}
