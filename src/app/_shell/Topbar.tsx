"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navigation2, Compass, Route, Map, Sailboat, Settings } from "lucide-react";

/**
 * Shared top navigation. Passage/Chart links resolve to the most-recent passage
 * (passed from the server layout); active state derives from the pathname.
 */
export default function Topbar({ activeId }: { activeId?: string | null }) {
  const path = usePathname() || "/";
  const onHome = path === "/";
  const onChart = path.endsWith("/map");
  const onPassage = path.startsWith("/p/") && !onChart;

  const passageHref = activeId ? `/p/${activeId}` : "/";
  const chartHref = activeId ? `/p/${activeId}/map` : "/";

  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="SailorWind — home">
        <span className="brand-mark">
          <Navigation2 size={19} style={{ transform: "rotate(45deg)" }} fill="currentColor" />
        </span>
        <span className="brand-name">
          Sailor<b>Wind</b>
        </span>
      </Link>

      <nav className="nav-links">
        <Link href="/" className={`nav-link${onHome ? " active" : ""}`}>
          <Compass /> Home
        </Link>
        <Link href={passageHref} className={`nav-link${onPassage ? " active" : ""}`}>
          <Route /> Passage
        </Link>
        <Link href={chartHref} className={`nav-link${onChart ? " active" : ""}`}>
          <Map /> Chart
        </Link>
      </nav>

      <span className="topbar-spacer" />

      <span className="boat-chip hide-mobile">
        <Sailboat size={18} style={{ color: "var(--cyan)" }} />
        <span style={{ lineHeight: 1.15 }}>
          <span style={{ fontWeight: 600, fontSize: 13, display: "block" }}>Bossanova</span>
          <span className="mono faint" style={{ fontSize: 10 }}>HR Monsun 31</span>
        </span>
      </span>

      <button className="btn btn-sm btn-ghost" aria-label="Settings" title="Settings">
        <Settings />
      </button>
    </header>
  );
}
