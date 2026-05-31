"use client";

import { usePathname } from "next/navigation";
import Topbar from "./Topbar";
import WindField from "./WindField";

/**
 * The persistent shell: dark-ocean backdrop + wind-field canvas + sticky topbar,
 * with the page rendered in the single scroll container. The Chart view is
 * full-bleed (its own map manages height) and suppresses the backdrop wind, since
 * the map has its own animated overlay.
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
    </div>
  );
}
