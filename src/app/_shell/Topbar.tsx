"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navigation2, Compass, Route, Map, Sailboat, Settings, LogOut, Plus } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import type { ShellUser } from "./AppShell";

/**
 * Shared top navigation. Passage/Chart links resolve to the user's most-recent
 * passage (passed from the server layout); active state derives from the pathname.
 * Guests get only the brand and the sign-in / sign-up actions.
 */
export default function Topbar({ activeId, user }: { activeId?: string | null; user: ShellUser | null }) {
  const path = usePathname() || "/";
  const onHome = path === "/";
  const onChart = path.endsWith("/map");
  const onPassage = path.startsWith("/p/") && !onChart;

  const passageHref = activeId ? `/p/${activeId}` : "/new";
  const chartHref = activeId ? `/map?p=${activeId}` : "/map";

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

      {user && (
        <nav className="nav-links">
          <Link href="/" className={`nav-link${onHome ? " active" : ""}`}>
            <Compass /> Home
          </Link>
          <Link href={passageHref} className={`nav-link${onPassage ? " active" : ""}`}>
            <Route /> Passage
          </Link>
          <Link href={chartHref} className={`nav-link${onChart ? " active" : ""}`}>
            <Map /> Map
          </Link>
        </nav>
      )}

      <span className="topbar-spacer" />

      {user ? (
        <>
          {user.boat ? (
            <Link href="/settings#boats" className="boat-chip hide-mobile" style={{ textDecoration: "none", color: "inherit" }}>
              <Sailboat size={18} style={{ color: "var(--cyan)" }} />
              <span style={{ lineHeight: 1.15 }}>
                <span style={{ fontWeight: 600, fontSize: 13, display: "block" }}>{user.boat.name}</span>
                {user.boat.model && <span className="mono faint" style={{ fontSize: 10 }}>{user.boat.model}</span>}
              </span>
            </Link>
          ) : (
            <Link href="/settings#boats" className="btn btn-sm hide-mobile">
              <Plus /> Add your boat
            </Link>
          )}
          <Link href="/settings" className="btn btn-sm btn-ghost" aria-label="Settings" title={`Settings · ${user.name}`}>
            <Settings />
          </Link>
          <form action={logout}>
            <button type="submit" className="btn btn-sm btn-ghost" aria-label="Log out" title="Log out">
              <LogOut />
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="btn btn-sm btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-sm btn-primary" data-umami-event="cta-topbar-signup">Get started</Link>
        </>
      )}
    </header>
  );
}
