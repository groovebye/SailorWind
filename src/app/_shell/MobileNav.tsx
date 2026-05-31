"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Route, Map } from "lucide-react";

/** Bottom tab bar shown ≤860px (where the topbar nav links hide). */
export default function MobileNav({ activeId }: { activeId?: string | null }) {
  const path = usePathname() || "/";
  const onHome = path === "/";
  const onChart = path.endsWith("/map");
  const onPassage = path.startsWith("/p/") && !onChart;
  const items: [string, string, React.ReactNode, boolean][] = [
    ["/", "Home", <Compass key="h" size={19} />, onHome],
    [activeId ? `/p/${activeId}` : "/", "Passage", <Route key="p" size={19} />, onPassage],
    [activeId ? `/p/${activeId}/map` : "/", "Chart", <Map key="c" size={19} />, onChart],
  ];
  return (
    <nav className="mobile-nav">
      {items.map(([href, label, icon, active]) => (
        <Link key={label} href={href} className={`mobile-nav-item${active ? " active" : ""}`}>
          {icon}
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
