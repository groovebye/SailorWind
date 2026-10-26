import Link from "next/link";
import {
  Wind,
  Gauge,
  Route,
  Anchor,
  LifeBuoy,
  Compass,
  Sailboat,
  MapPin,
  CloudSun,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/db";

const FEATURES = [
  {
    icon: CloudSun,
    title: "Cape-by-cape forecasts",
    text: "Wind, gusts, swell and sea state at every headland on your route — the places that actually decide a passage — from ECMWF, ICON and GFS.",
  },
  {
    icon: Gauge,
    title: "GO / NO-GO window",
    text: "A departure timeline that scores each hour against your boat's limits, so you can see when to slip lines — not just whether it's windy.",
  },
  {
    icon: Route,
    title: "Depth-aware routes",
    text: "Routes are computed through navigable water from EMODnet bathymetry, rounding capes and keeping off the shallows instead of cutting across land.",
  },
  {
    icon: Anchor,
    title: "Marinas & harbour intel",
    text: "Berths, fuel, showers, draft access and approach notes for the harbours along the coast — the bigger, better-equipped marinas starred.",
  },
  {
    icon: LifeBuoy,
    title: "Bail-out ports",
    text: "Every shelter between departure and destination with its distance along your track, so plan B is ready before you need it.",
  },
  {
    icon: Compass,
    title: "Co-skipper on passage",
    text: "Log your track, reefs and observations underway, get leg briefs, and compare the forecast with what you actually saw.",
  },
];

const STEPS = [
  { title: "Add your boat", text: "Length, draft and motoring speed — that's enough to tailor depths, timings and fuel." },
  { title: "Pick your ports", text: "Choose where you leave from and where you're heading. Stops and capes are worked out for you." },
  { title: "Sail the window", text: "Get the best departure, the conditions at each cape and your bail-out options, hour by hour." },
];

async function coverage() {
  try {
    const [areas, marinas, sights, hubs] = await Promise.all([
      prisma.portArea.count(),
      prisma.marinaOption.count(),
      prisma.pointOfInterest.count(),
      prisma.portArea.findMany({
        where: { isMajor: true },
        orderBy: [{ coastOrder: "asc" }, { name: "asc" }],
        select: { name: true },
      }),
    ]);
    return { areas, marinas, sights, hubs: hubs.map((h) => h.name) };
  } catch {
    return { areas: 0, marinas: 0, sights: 0, hubs: [] as string[] };
  }
}

/** Public marketing page shown at / to signed-out visitors. */
export default async function Landing() {
  const c = await coverage();

  return (
    <div className="container fade-up" style={{ paddingBottom: 40 }}>
      {/* HERO */}
      <section style={{ paddingTop: 56 }}>
        <div className="hero-grid">
          <div>
            <div className="eyebrow" style={{ marginBottom: 18 }}>Passage planning for coastal cruisers</div>
            <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 72px)", margin: "0 0 20px" }}>
              Plan the wind.<br />
              <span style={{ color: "var(--cyan)" }}>Sail the window.</span>
            </h1>
            <p className="dim" style={{ fontSize: 18, lineHeight: 1.55, maxWidth: 500, margin: "0 0 30px" }}>
              SailorWind turns forecasts into a departure decision: conditions at every cape, a GO/NO-GO timeline for
              your boat, depth-aware routes and the harbours along the way — from Biscay to Gibraltar.
            </p>
            <div className="flex gap-12 wrap">
              <Link href="/signup" className="btn btn-primary btn-lg" data-umami-event="cta-hero-signup">
                Create a free account <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn btn-lg">Sign in</Link>
            </div>
            <div className="lp-stats">
              <div className="lp-stat"><span className="stat-num">{c.areas}</span><span>Harbours & anchorages</span></div>
              <div className="lp-stat"><span className="stat-num">{c.marinas}</span><span>Marinas</span></div>
              <div className="lp-stat"><span className="stat-num">{c.sights}</span><span>Sights & stories en route</span></div>
            </div>
          </div>

          {/* Illustrative sample — clearly labelled, not live data */}
          <div className="glass" style={{ padding: 24, alignSelf: "center" }} aria-label="Example passage window">
            <div className="between" style={{ marginBottom: 16 }}>
              <span className="pill">Example</span>
              <span className="mono faint" style={{ fontSize: 12 }}>A Coruña → Muxía · ≈50 nm</span>
            </div>
            {[
              ["Depart A Coruña", "08:00", "NE 12 kn · swell 1.2 m", "go"],
              ["Islas Sisargas", "12:00", "NE 16 kn G21 · 1.8 m", "go"],
              ["Punta Nariga", "13:10", "NE 18 kn G24 · 2.1 m", "caution"],
              ["Cabo Vilán", "15:30", "NE 17 kn G22 · 1.9 m", "caution"],
              ["Arrive Muxía", "17:10", "NE 11 kn · sheltered", "go"],
            ].map(([place, time, cond, v]) => (
              <div key={place} className="between" style={{ padding: "11px 0", borderTop: "1px solid rgba(255,255,255,0.06)", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{place}</div>
                  <div className="mono faint" style={{ fontSize: 11.5, marginTop: 3 }}>{time} · {cond}</div>
                </div>
                <span className={`verdict verdict-${v}`}>{v === "go" ? "GO" : "CAUTION"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section">
        <div className="eyebrow" style={{ marginBottom: 12 }}>What you get</div>
        <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 42px)", margin: "0 0 28px" }}>
          Everything a skipper checks before leaving harbour
        </h2>
        <div className="lp-features stagger">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="glass glass-hover lp-feature">
              <div className="sec-icon"><Icon size={18} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-section">
        <div className="eyebrow" style={{ marginBottom: 12 }}>How it works</div>
        <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 42px)", margin: "0 0 28px" }}>
          From idea to departure in three steps
        </h2>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div key={s.title} className="glass lp-step">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COVERAGE */}
      <section className="lp-section">
        <div className="glass lp-coast">
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Coverage</div>
            <h2 className="display" style={{ fontSize: 34, margin: "0 0 12px" }}>Biscay to Gibraltar</h2>
            <p className="dim" style={{ fontSize: 15.5, lineHeight: 1.6, margin: 0 }}>
              The Atlantic coast of northern Spain, Galicia and Portugal to the Strait — curated harbour data, capes and
              routes. More cruising grounds are on the way.
            </p>
          </div>
          {c.hubs.length > 0 && (
            <ul aria-label="Main harbours covered">
              {c.hubs.map((h) => (
                <li key={h} className="pill"><MapPin size={12} /> {h}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-section">
        <div className="glass lp-cta">
          <Wind size={28} style={{ color: "var(--cyan)" }} />
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 40px)", margin: "14px 0 10px" }}>
            Your next weather window is out there
          </h2>
          <p className="dim" style={{ fontSize: 16, margin: "0 auto 26px", maxWidth: 520, lineHeight: 1.55 }}>
            Free while in beta. Add your boat and plan your first passage in a couple of minutes.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg" data-umami-event="cta-bottom-signup">
            <Sailboat size={18} /> Start planning
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} SailorWind · A planning aid — always check official charts, notices and forecasts.</span>
        <span className="flex gap-16">
          <Link href="/terms">Terms</Link>
          <Link href="/login">Sign in</Link>
        </span>
      </footer>
    </div>
  );
}
