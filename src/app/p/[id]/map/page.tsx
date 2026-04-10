"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "@/lib/theme";
import type { ForecastEntry } from "@/lib/weather";

interface Port {
  id: string; name: string; slug: string; lat: number; lon: number; type: string;
  coastlineNm: number; fuel: boolean; water: boolean; electric: boolean;
  repairs: boolean; customs: boolean; shelter: string | null; maxDraft: number | null;
  vhfCh: string | null; website: string | null; notes: string | null;
  country: string; region: string | null;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface Passage {
  id: string; shortId: string; name: string | null;
  departure: string; speed: number; mode: string; model: string;
  waypoints: Waypoint[];
}

const PassageMap = dynamic(() => import("./PassageMap"), { ssr: false });

function tzForPort(lon: number): string {
  if (lon >= -10 && lon <= 3) return "Europe/Madrid";
  if (lon > 3 && lon <= 15) return "Europe/Rome";
  if (lon > 15 && lon <= 30) return "Europe/Athens";
  return "UTC";
}

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { theme } = useTheme();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry[]> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/passage?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPassage(data);
        // Fetch forecasts
        const wps = data.waypoints.map((w: Waypoint) => ({
          name: w.port.name, lat: w.port.lat, lon: w.port.lon, isCape: w.isCape,
        }));
        return fetch("/api/forecast/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waypoints: wps, model: data.model }),
        });
      })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setForecasts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (!passage) return (
    <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
      Loading...
    </div>
  );

  // Compute ETAs for each waypoint
  const stops = passage.waypoints.filter((w) => w.isStop);
  const depDate = new Date(passage.departure);
  let currentTime = depDate.getTime();
  const depHour = depDate.getUTCHours();

  interface Leg { from: Waypoint; to: Waypoint; nm: number; departTime: Date; arriveTime: Date; hours: number; }
  const legs: Leg[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const nm = stops[i + 1].port.coastlineNm - stops[i].port.coastlineNm;
    const hours = nm / passage.speed;
    const departTime = new Date(currentTime);
    const arriveTime = new Date(currentTime + hours * 3600000);
    legs.push({ from: stops[i], to: stops[i + 1], nm, departTime, arriveTime, hours });
    if (passage.mode === "daily" && i < stops.length - 2) {
      const nextDay = new Date(arriveTime);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(depHour, 0, 0, 0);
      if (nextDay.getTime() < arriveTime.getTime()) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      currentTime = nextDay.getTime();
    } else {
      currentTime = arriveTime.getTime();
    }
  }

  function getWaypointETA(wp: Waypoint): Date {
    for (const leg of legs) {
      if (wp.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
          wp.port.coastlineNm <= leg.to.port.coastlineNm + 0.1) {
        if (wp.port.name === leg.from.port.name) return leg.departTime;
        if (wp.port.name === leg.to.port.name) return leg.arriveTime;
        const legDist = leg.to.port.coastlineNm - leg.from.port.coastlineNm;
        const frac = (wp.port.coastlineNm - leg.from.port.coastlineNm) / legDist;
        return new Date(leg.departTime.getTime() + frac * (leg.arriveTime.getTime() - leg.departTime.getTime()));
      }
    }
    return legs.length ? legs[legs.length - 1].arriveTime : new Date();
  }

  function closestForecast(wpForecasts: ForecastEntry[], target: Date): ForecastEntry | null {
    let best: ForecastEntry | null = null;
    let bestDiff = Infinity;
    for (const f of wpForecasts) {
      const diff = Math.abs(new Date(f.time).getTime() - target.getTime());
      if (diff < bestDiff) { bestDiff = diff; best = f; }
    }
    return best;
  }

  // Build enriched waypoint data for the map
  const waypointsWithData = passage.waypoints.map((wp) => {
    const eta = getWaypointETA(wp);
    const tz = tzForPort(wp.port.lon);
    const wpForecasts = forecasts?.[wp.port.name] || [];
    const forecast = closestForecast(wpForecasts, eta);
    return { ...wp, eta, tz, forecast, allForecasts: wpForecasts };
  });

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <div className="px-4 py-2.5 flex items-center gap-4" style={{ background: "var(--bg-card)", borderBottom: `1px solid var(--border)` }}>
        <Link href={`/p/${id}`} className="text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
          &#8592; Back
        </Link>
        <h1 className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
          {passage.name || "Passage"} — Map
        </h1>
        {loading && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading forecasts...</span>}
        <div className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {passage.waypoints.length} waypoints &middot; {legs.length} legs
        </div>
      </div>
      <div className="flex-1">
        <PassageMap
          waypoints={waypointsWithData}
          legs={legs}
          theme={theme}
        />
      </div>
    </div>
  );
}
