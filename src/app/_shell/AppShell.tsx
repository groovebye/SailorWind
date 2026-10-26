"use client";

import { usePathname } from "next/navigation";
import Topbar from "./Topbar";
import WindField from "./WindField";
import MobileNav from "./MobileNav";
import ScrollReset from "./ScrollReset";

/**
 * The persistent shell: dark-ocean backdrop + wind-field canvas + sticky topbar,
 * with the page rendered in the single scroll container. The map (/map) is
 * full-bleed (it manages its own height) and skips the backdrop wind and the
 * bottom tab bar, which would sit on top of the chart.
 */
export default function AppShell({
  children,
  activeId,
}: {
  children: React.ReactNode;
  activeId?: string | null;
}) {
  const path = usePathname() || "/";
  const isChart = path.endsWith("/map");

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      {!isChart && <WindField density={path === "/" ? 1 : 0.7} />}
      <div className="app-main">
        <Topbar activeId={activeId} />
        {isChart ? (
          <div className="chart-fill">{children}</div>
        ) : (
          <main className="view-scroll">{children}</main>
        )}
      </div>
      {!isChart && <MobileNav activeId={activeId} />}
      <ScrollReset />
    </div>
  );
}
