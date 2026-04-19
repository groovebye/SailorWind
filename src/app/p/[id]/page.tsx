"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ForecastEntry } from "@/lib/weather";
import { useTheme } from "@/lib/theme";
import { buildClientSchedule } from "@/lib/passage-schedule-client";

const WEATHER_EMOJI: Record<string, string> = {
  sun: "\u2600\uFE0F", partly: "\u26C5", cloudy: "\u2601\uFE0F",
  fog: "FOG", rain: "\uD83C\uDF27\uFE0F", heavy_rain: "\uD83C\uDF27\uFE0F\uD83C\uDF27\uFE0F", storm: "\u26C8\uFE0F",
};

function tzForPort(lon: number): string {
  if (lon >= -10 && lon <= 3) return "Europe/Madrid";
  if (lon > 3 && lon <= 15) return "Europe/Rome";
  if (lon > 15 && lon <= 30) return "Europe/Athens";
  return "UTC";
}

interface Port {
  id: string; name: string; slug: string; lat: number; lon: number;
  type: string; coastlineNm: number; notes: string | null;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface Passage {
  id: string; shortId: string; name: string | null;
  departure: string; speed: number; mode: string; model: string;
  waypoints: Waypoint[];
}

function fmtLocal(d: Date, tz: string) {
  const s = d.toLocaleString("en-GB", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return s.replace(" at ", " ");
}

function fmtTimeLocal(d: Date, tz: string) {
  return d.toLocaleString("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function verdictColor(v: string) {
  if (v === "GO") return "go";
  if (v.startsWith("CAUTION")) return "caution";
  return "nogo";
}

function verdictLabel(v: string) {
  if (v === "GO") return "GO";
  if (v.startsWith("CAUTION")) return "CAUTION";
  return "NO-GO";
}

function bftNum(b: string) { return b.replace("F", ""); }

/** Wave power in kW/m: P ≈ 0.5 × H² × T */
function wavePower(waveM: number | null, periodS: number | null): number | null {
  if (waveM == null || periodS == null || waveM === 0 || periodS === 0) return null;
  return Math.round(0.5 * waveM * waveM * periodS * 10) / 10;
}
function wavePowerLabel(kw: number | null): string {
  if (kw == null) return "";
  if (kw < 5) return "calm";
  if (kw < 15) return "moderate";
  if (kw < 30) return "rough";
  return "severe";
}

export default function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry[]> | null>(null);
  const [windyForecasts, setWindyForecasts] = useState<Record<string, ForecastEntry[]> | null>(null);
  const [weatherSource, setWeatherSource] = useState<"openmeteo" | "windy">("openmeteo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windyPopup, setWindyPopup] = useState(false);
  const [resolvedLegDistances, setResolvedLegDistances] = useState<Record<number, number>>({});
  const [legDepartureOverrides, setLegDepartureOverrides] = useState<Record<number, string>>({});

  const [departure, setDeparture] = useState("");
  const [speed, setSpeed] = useState(5.0);
  const [mode, setMode] = useState("daily");
  const [model, setModel] = useState("ecmwf_ifs025");

  useEffect(() => {
    fetch(`/api/passage?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setPassage(data);
        setDeparture(data.departure.slice(0, 16));
        setSpeed(data.speed);
        setMode(data.mode);
        setModel(data.model);
        if (data.source === "windy") setWeatherSource("windy");
      });
  }, [id]);

  useEffect(() => {
    if (!passage) return;
    const stops = passage.waypoints.filter((w) => w.isStop);
    if (stops.length < 2) return;
    let cancelled = false;

    Promise.all(stops.slice(0, -1).map(async (from, index) => {
      const to = stops[index + 1];
      const response = await fetch(
        `/api/leg-route?passageId=${id}&legIndex=${index}&fromName=${encodeURIComponent(from.port.name)}&fromLat=${from.port.lat}&fromLon=${from.port.lon}&toName=${encodeURIComponent(to.port.name)}&toLat=${to.port.lat}&toLon=${to.port.lon}`
      );
      const data = await response.json();
      return {
        index,
        distance: typeof data.distanceNm === "number" ? data.distanceNm : to.port.coastlineNm - from.port.coastlineNm,
        departureOverride: data.departureOverride as string | null | undefined,
      };
    })).then((entries) => {
      if (cancelled) return;
      const distances: Record<number, number> = {};
      const overrides: Record<number, string> = {};
      for (const e of entries) {
        distances[e.index] = e.distance;
        if (e.departureOverride) overrides[e.index] = e.departureOverride;
      }
      setResolvedLegDistances(distances);
      setLegDepartureOverrides(overrides);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [passage, id]);

  // Load forecasts: try cache first, then fetch from API
  const loadForecasts = useCallback(async (force = false) => {
    if (!passage) return;

    const src = weatherSource === "windy" ? "windy" : "openmeteo";
    const mdl = weatherSource === "windy" ? "gfs" : model;

    // Try DB cache first (unless force refresh)
    if (!force) {
      try {
        const cacheRes = await fetch(`/api/forecast/cache?passageId=${id}&source=${src}&model=${mdl}`);
        const cached = await cacheRes.json();
        if (cached.data) {
          if (weatherSource === "windy") setWindyForecasts(cached.data);
          else setForecasts(cached.data);
          setLoading(false);
          return;
        }
      } catch { /* no cache, proceed to fetch */ }
    }

    // Fetch fresh data
    setLoading(true);
    const wps = passage.waypoints.map((w) => ({
      name: w.port.name, lat: w.port.lat, lon: w.port.lon, isCape: w.isCape,
    }));

    let data;
    if (weatherSource === "windy") {
      const res = await fetch("/api/forecast/windy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints: wps, passageId: id, force: true }),
      });
      data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setWindyForecasts(data);
    } else {
      const res = await fetch("/api/forecast/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints: wps, model, force }),
      });
      data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      setForecasts(data);
    }

    // Save to DB cache
    try {
      await fetch("/api/forecast/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passageId: id, source: src, model: mdl, data }),
      });
    } catch { /* cache save failed, non-critical */ }

    setLoading(false);
  }, [passage, model, weatherSource, id]);

  useEffect(() => {
    if (passage) loadForecasts();
  }, [passage, loadForecasts]);

  function handleWindyClick() {
    setWeatherSource("windy");
  }

  function handleUpdateClick() {
    if (weatherSource === "windy") {
      setWindyPopup(true); // confirm before using Windy API tokens
    } else {
      loadForecasts(true); // force refresh Open-Meteo (free)
    }
  }

  async function confirmWindyFetch() {
    setWindyPopup(false);
    await loadForecasts(true);
  }

  const activeForecasts = weatherSource === "windy" && windyForecasts ? windyForecasts : forecasts;

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!passage || initialLoad.current) { initialLoad.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/passage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, departure, speed, mode, model, source: weatherSource }),
      });
    }, 500);
  }, [departure, speed, mode, model, weatherSource, id, passage]);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this passage?")) return;
    await fetch(`/api/passage?id=${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (error) return <div className="max-w-4xl mx-auto p-12" style={{ color: "var(--text-red)" }}>Error: {error}</div>;
  if (!passage) return <div className="max-w-4xl mx-auto p-12" style={{ color: "var(--text-secondary)" }}>Loading...</div>;

  const stops = passage.waypoints.filter((w) => w.isStop);
  const stopPorts = stops.map(s => ({
    name: s.port.name, slug: s.port.slug,
    lat: s.port.lat, lon: s.port.lon,
    coastlineNm: s.port.coastlineNm,
  }));
  const scheduledLegs = buildClientSchedule(
    departure || passage.departure, speed, mode as "daily" | "nonstop", stopPorts,
    resolvedLegDistances,
    legDepartureOverrides,
  );
  // Map schedule legs to passage waypoints for rendering
  const legs = scheduledLegs.map((sl, i) => ({
    from: stops[i], to: stops[i + 1],
    nm: sl.distanceNm, departTime: sl.departTime,
    arriveTime: sl.arriveTime, hours: sl.hours,
  }));
  const totalSailing = legs.reduce((s, l) => s + l.hours, 0);

  function getWaypointETA(wp: Waypoint, forLeg?: typeof legs[0]): Date {
    // If a specific leg is provided, use its times
    const searchLegs = forLeg ? [forLeg] : legs;
    for (const leg of searchLegs) {
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

  const vc = (v: string) => {
    const t = verdictColor(v);
    return { color: `var(--text-${t === "go" ? "green" : t === "caution" ? "yellow" : "red"})`, background: `var(--accent-${t})` };
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-4">
      {/* Header */}
      <header style={{ background: `linear-gradient(to right, var(--bg-header-from), var(--bg-header-to))`, border: `1px solid var(--border)` }} className="rounded-xl px-5 py-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-heading)" }}>
              &#9973; {passage.name || "Passage"}
            </h1>
            <div className="text-xs mt-0.5 space-x-3" style={{ color: "var(--text-secondary)" }}>
              <span>{model.toUpperCase()}</span>
              <span>{totalSailing.toFixed(0)}h sailing</span>
              <span>{speed}kt</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Bossanova</div>
            <div className="text-base" style={{ color: "var(--text-muted)" }}>Hallberg-Rassy Monsun 31</div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }} title="Home">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
              <span className="text-xs hidden sm:inline">Home</span>
            </Link>
            <Link href={`/p/${id}/map`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }} title="Map">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>
              <span className="text-xs hidden sm:inline">Map</span>
            </Link>
            {/* Weather source toggle */}
            <div className="flex items-center rounded-lg overflow-hidden text-[11px]" style={{ border: `1px solid var(--border)` }}>
              <button onClick={() => setWeatherSource("openmeteo")} className="px-2.5 py-1.5 transition-all" style={{ background: weatherSource === "openmeteo" ? "var(--accent-go)" : "transparent", color: weatherSource === "openmeteo" ? "var(--text-green)" : "var(--text-muted)" }}>
                Open-Meteo
              </button>
              <button onClick={handleWindyClick} className="px-2.5 py-1.5 transition-all" style={{ background: weatherSource === "windy" ? "var(--accent-go)" : "transparent", color: weatherSource === "windy" ? "var(--text-green)" : "var(--text-muted)" }}>
                Windy
              </button>
            </div>
            <button onClick={handleUpdateClick} className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }} title="Update forecasts">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.993" /></svg>
              <span className="text-xs hidden sm:inline">Update</span>
            </button>
            <button onClick={toggleTheme} className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }} title="Toggle theme">
              {theme === "dark" ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
              )}
            </button>
            <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:opacity-80" style={{ color: "var(--text-muted)" }} title="Delete">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div style={{ background: "var(--bg-card)", border: `1px solid var(--border-light)` }} className="rounded-xl px-4 py-3 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Departure</label>
            <input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)}
              style={{ background: "var(--bg-input)", border: `1px solid var(--border)`, color: "var(--text-primary)" }}
              className="rounded px-2.5 h-9 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Speed (kt)</label>
            <input type="number" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value) || 5)}
              min={1} max={15} step={0.5}
              style={{ background: "var(--bg-input)", border: `1px solid var(--border)`, color: "var(--text-primary)" }}
              className="w-20 rounded px-2.5 h-9 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}
              style={{ background: "var(--bg-input)", border: `1px solid var(--border)`, color: "var(--text-primary)" }}
              className="rounded px-2.5 h-9 text-sm focus:outline-none">
              <option value="daily">Daily stops</option>
              <option value="nonstop">Non-stop</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Model</label>
            {weatherSource === "windy" ? (
              <div style={{ background: "var(--bg-input)", border: `1px solid var(--border)`, color: "var(--text-muted)" }}
                className="rounded px-2.5 h-9 text-sm flex items-center">
                GFS + GFS Wave
              </div>
            ) : (
              <select value={model} onChange={(e) => setModel(e.target.value)}
                style={{ background: "var(--bg-input)", border: `1px solid var(--border)`, color: "var(--text-primary)" }}
                className="rounded px-2.5 h-9 text-sm focus:outline-none">
                <option value="ecmwf_ifs025">ECMWF IFS 0.25&deg;</option>
                <option value="icon_eu">ICON-EU</option>
                <option value="gfs_seamless">GFS</option>
                <option value="arome_france">AROME France</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Legs overview — clickable tiles */}
      <div className="flex gap-2 flex-wrap mb-4">
        {legs.map((l, i) => {
          const fromTz = tzForPort(l.from.port.lon);
          const toTz = tzForPort(l.to.port.lon);
          // Compute worst verdict for this leg from forecasts
          let legVerdict = "";
          let legVerdictColor = "";
          if (activeForecasts) {
            const legWps = passage.waypoints.filter(w =>
              w.port.coastlineNm >= l.from.port.coastlineNm - 0.1 &&
              w.port.coastlineNm <= l.to.port.coastlineNm + 0.1
            );
            let worst = 0;
            for (const w of legWps) {
              const wpF = activeForecasts[w.port.name] || [];
              const eta = new Date(l.departTime.getTime() + (w.port.coastlineNm - l.from.port.coastlineNm) / (l.to.port.coastlineNm - l.from.port.coastlineNm || 1) * (l.arriveTime.getTime() - l.departTime.getTime()));
              let bestF: ForecastEntry | null = null;
              let bestD = Infinity;
              for (const f of wpF) { const d = Math.abs(new Date(f.time).getTime() - eta.getTime()); if (d < bestD) { bestD = d; bestF = f; } }
              if (bestF) {
                if (bestF.verdict.startsWith("NO") && worst < 2) worst = 2;
                else if (bestF.verdict.startsWith("CAUTION") && worst < 1) worst = 1;
              }
            }
            legVerdict = worst === 2 ? "NO-GO" : worst === 1 ? "CAUTION" : "GO";
            legVerdictColor = worst === 2 ? "var(--text-red)" : worst === 1 ? "var(--text-yellow)" : "var(--text-green)";
          }
          const capes = passage.waypoints.filter(w => w.isCape && w.port.coastlineNm >= l.from.port.coastlineNm - 0.1 && w.port.coastlineNm <= l.to.port.coastlineNm + 0.1);
          return (
            <Link key={i} href={`/p/${id}/leg/${i}`} style={{ background: "var(--bg-card)", border: `1px solid var(--border-light)` }} className="rounded-lg px-3 py-2 flex-1 min-w-[180px] hover:opacity-80 transition-opacity cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{mode === "daily" ? `D${i + 1}: ` : ""}{l.from.port.name} &rarr; {l.to.port.name}</div>
                {legVerdict && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: legVerdictColor, background: legVerdict === "GO" ? "var(--accent-go)" : legVerdict === "CAUTION" ? "var(--accent-caution)" : "var(--accent-nogo)" }}>{legVerdict}</span>}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{l.nm} NM, ~{l.hours.toFixed(1)}h{capes.length > 0 ? ` · ${capes.length} cape${capes.length > 1 ? "s" : ""}` : ""}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-green)" }}>{fmtLocal(l.departTime, fromTz)} &rarr; {fmtTimeLocal(l.arriveTime, toTz)}</div>
            </Link>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "var(--border)", borderTopColor: "var(--text-heading)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Fetching forecasts...</p>
        </div>
      ) : activeForecasts && (
        <>
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-heading)" }}>Passage Summary</h2>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                <th className="text-left px-2 py-1.5" style={{ background: "var(--bg-card)" }}>Waypoint</th>
                <th className="text-left px-2 py-1.5" style={{ background: "var(--bg-card)" }}>ETA</th>
                <th className="px-1 py-1.5" style={{ background: "var(--bg-card)" }}></th>
                <th className="text-left px-2 py-1.5" style={{ background: "var(--bg-card)" }}>Wind (kt)</th>
                <th className="text-center px-2 py-1.5" style={{ background: "var(--bg-card)" }}>Gusts</th>
                <th className="text-left px-2 py-1.5" style={{ background: "var(--bg-card)" }}>Waves</th>
                <th className="text-left px-2 py-1.5" style={{ background: "var(--bg-card)" }}>Swell</th>
                <th className="text-center px-2 py-1.5" style={{ background: "var(--bg-card)" }}>Power</th>
                <th className="text-right px-2 py-1.5" style={{ background: "var(--bg-card)" }}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {legs.flatMap((leg, li) => {
                const legWps = passage.waypoints.filter(
                  (w) => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
                         w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
                );
                const fromTz = tzForPort(leg.from.port.lon);
                const toTz = tzForPort(leg.to.port.lon);

                return [
                  <tr key={`leg-${li}`}>
                    <td colSpan={9} className="text-xs font-semibold px-2 py-1.5" style={{ background: "var(--bg-card)", color: "var(--text-heading)", borderBottom: `1px solid var(--border-light)`, borderTop: li > 0 ? `1px solid var(--border-light)` : undefined }}>
                      {mode === "daily" ? `D${li + 1}: ` : `L${li + 1}: `}{leg.from.port.name} &rarr; {leg.to.port.name} ({leg.nm} NM, ~{leg.hours.toFixed(1)}h) — {fmtLocal(leg.departTime, fromTz)} &rarr; {fmtLocal(leg.arriveTime, toTz)}
                    </td>
                  </tr>,
                  ...legWps.map((wp) => {
                    const eta = getWaypointETA(wp, leg);
                    const tz = tzForPort(wp.port.lon);
                    const wpF = activeForecasts[wp.port.name] || [];
                    const f = closestForecast(wpF, eta);

                    return (
                      <tr key={wp.port.id} style={{ borderBottom: `1px solid var(--row-border)` }} className="hover:opacity-90">
                        <td className="px-2 py-1.5 font-semibold whitespace-nowrap" style={{ color: wp.isCape ? "var(--text-yellow)" : wp.isStop ? "var(--text-green)" : "var(--text-secondary)" }}>
                          {wp.port.name}
                          {wp.isStop && <span className="text-[9px] ml-1 px-0.5 rounded" style={{ border: `1px solid var(--text-green)`, color: "var(--text-green)" }}>STOP</span>}
                          {wp.isCape && <span className="text-[9px] ml-1 font-bold" style={{ color: "var(--text-yellow)" }}>CAPE</span>}
                        </td>
                        <td className="px-2 py-1.5 text-[11px] whitespace-nowrap" style={{ color: "var(--text-blue-light)" }}>{fmtLocal(eta, tz)}</td>
                        {f ? (
                          <>
                            <td className="px-1 py-1.5 text-center">{WEATHER_EMOJI[f.weather] || ""}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <span className="inline-block" style={{ color: "var(--text-yellow)", transform: `rotate(${f.windDirDeg}deg)` }}>&darr;</span>
                              {" "}{Math.round(f.windKt)} B{bftNum(f.beaufort)}
                            </td>
                            <td className="px-2 py-1.5 text-center">{Math.round(f.gustKt)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>&darr;</span>
                              {" "}{f.waveM != null ? `${f.waveM}m / ${f.wavePeriodS}s` : "—"}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>&darr;</span>
                              {" "}{f.swellM != null ? `${f.swellM}m / ${f.swellPeriodS}s` : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-center text-[10px]" style={{ color: (() => { const wp = wavePower(f.waveM, f.wavePeriodS); return wp == null ? "var(--text-muted)" : wp >= 30 ? "var(--text-red)" : wp >= 15 ? "var(--text-yellow)" : "var(--text-secondary)"; })() }}>
                              {(() => { const wp = wavePower(f.waveM, f.wavePeriodS); return wp != null ? `${wp}` : "—"; })()}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={vc(f.verdict)}>
                                {verdictLabel(f.verdict)}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td colSpan={7} className="px-2 py-1.5" style={{ color: "var(--text-muted)" }}>No data</td>
                        )}
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>

          {/* Detailed Forecast */}
          <h2 className="text-base font-semibold mb-2 mt-6" style={{ color: "var(--text-heading)" }}>Detailed Forecast by Waypoint</h2>
          {passage.waypoints.map((wp) => {
            const allF = activeForecasts[wp.port.name] || [];
            // Find the first leg where this waypoint is departure (not arrival from previous)
            const wpLeg = legs.find(l => l.from.port.name === wp.port.name) || legs.find(l => wp.port.coastlineNm >= l.from.port.coastlineNm - 0.1 && wp.port.coastlineNm <= l.to.port.coastlineNm + 0.1);
            const eta = getWaypointETA(wp, wpLeg);
            const tz = tzForPort(wp.port.lon);
            const etaDay = eta.toISOString().slice(0, 10);

            let dayF = allF.filter((f) => f.time.slice(0, 10) === etaDay);
            if (dayF.length < 4 && allF.length) {
              const windowMs = 12 * 3600000;
              const windowF = allF.filter((f) => {
                const diff = new Date(f.time).getTime() - eta.getTime();
                return diff >= -windowMs && diff <= windowMs;
              });
              if (windowF.length >= dayF.length) dayF = windowF;
              if (!dayF.length) {
                const closest = closestForecast(allF, eta);
                if (closest) {
                  const cDay = closest.time.slice(0, 10);
                  dayF = allF.filter((f) => f.time.slice(0, 10) === cDay);
                }
              }
            }

            const isCollapsed = !wp.isStop && !wp.isCape;
            const borderColor = wp.isCape ? "var(--text-yellow)" : wp.isStop ? "var(--text-green)" : "var(--border-light)";

            return (
              <details key={wp.port.id} open={!isCollapsed} className="group mb-2 rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}30` }}>
                <summary className="px-3 py-2 cursor-pointer flex items-center gap-2 select-none" style={{ background: "var(--bg-card)" }}>
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span className="font-semibold text-sm" style={{ color: wp.isCape ? "var(--text-yellow)" : wp.isStop ? "var(--text-green)" : "var(--text-secondary)" }}>
                    {wp.port.name}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>ETA: {fmtLocal(eta, tz)}</span>
                  <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>{dayF.length} entries</span>
                </summary>
                <div style={{ background: "var(--bg-card)" }}>
                  {dayF.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>
                          <th className="text-left px-1.5 py-1 w-16">Time</th>
                          <th className="px-1 py-1.5 w-8"></th>
                          <th className="text-left px-1.5 py-1">Wind (kt)</th>
                          <th className="text-center px-1.5 py-1 w-14">Gusts</th>
                          <th className="text-left px-1.5 py-1">Waves</th>
                          <th className="text-left px-1.5 py-1">Swell</th>
                          <th className="text-center px-1.5 py-1 w-16">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayF.map((f) => {
                          const dt = new Date(f.time);
                          const diffH = Math.abs(dt.getTime() - eta.getTime()) / 3600000;
                          return (
                            <tr key={f.time} style={{ borderBottom: `1px solid var(--row-border)`, background: diffH < 2 ? "var(--highlight-row)" : undefined }}>
                              <td className="px-2 py-1 w-16">{fmtTimeLocal(dt, tz)}</td>
                              <td className="px-1 py-1 text-center w-8">{WEATHER_EMOJI[f.weather] || ""}</td>
                              <td className="px-2 py-1">
                                <span className="inline-block" style={{ color: "var(--text-yellow)", transform: `rotate(${f.windDirDeg}deg)` }}>&darr;</span>
                                {" "}{Math.round(f.windKt)} B{bftNum(f.beaufort)}
                              </td>
                              <td className="px-2 py-1 text-center w-14">{Math.round(f.gustKt)}</td>
                              <td className="px-2 py-1">
                                <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.waveM != null ? `${f.waveM}m / ${f.wavePeriodS}s` : "—"}
                              </td>
                              <td className="px-2 py-1">
                                <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.swellM != null ? `${f.swellM}m / ${f.swellPeriodS}s` : "—"}
                              </td>
                              <td className="px-2 py-1 text-center w-16">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={vc(f.verdict)}>
                                  {verdictLabel(f.verdict)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>No forecast data</div>
                  )}
                </div>
              </details>
            );
          })}
        </>
      )}

      <div className="text-center text-[10px] mt-6 pt-4" style={{ color: "var(--text-muted)", borderTop: `1px solid var(--border-light)` }}>
        Planning aid only. Cross-check with AEMET, Meteogalicia, and real-time conditions before departure.
      </div>

      {/* Windy confirmation popup */}
      {windyPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-xl p-6 max-w-sm mx-4" style={{ background: "var(--bg-card)", border: `1px solid var(--border)` }}>
            <h3 className="text-base font-bold mb-2" style={{ color: "var(--text-heading)" }}>Fetch Windy Forecasts</h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              This will fetch wind (GFS) and wave (GFS Wave) data from Windy API
              for {passage.waypoints.length} waypoints — {passage.waypoints.length * 2} API calls total.
            </p>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Windy provides detailed wave, swell, and wind data from GFS model with 3-hour resolution.
              Data will be cached — you can switch between Open-Meteo and Windy views without re-fetching.
            </p>
            <div className="flex gap-2">
              <button onClick={confirmWindyFetch} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>
                Fetch from Windy
              </button>
              <button onClick={() => setWindyPopup(false)} className="flex-1 px-4 py-2 rounded-lg text-sm" style={{ background: "var(--bg-primary)", color: "var(--text-muted)", border: `1px solid var(--border)` }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
