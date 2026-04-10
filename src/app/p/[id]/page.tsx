"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ForecastEntry } from "@/lib/weather";

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
  return d.toLocaleString("en-GB", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtTimeLocal(d: Date, tz: string) {
  return d.toLocaleString("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function verdictColor(v: string) {
  if (v === "GO") return "text-green-400 bg-green-400/10";
  if (v.startsWith("CAUTION")) return "text-yellow-400 bg-yellow-400/10";
  return "text-red-400 bg-red-400/10";
}

function verdictLabel(v: string) {
  if (v === "GO") return "GO";
  if (v.startsWith("CAUTION")) return "CAUTION";
  return "NO-GO";
}

function bftNum(b: string) { return b.replace("F", ""); }

// Column width classes for consistent alignment across all legs
const COL = {
  wp: "w-[18%]", eta: "w-[18%]", wx: "w-[4%]",
  wind: "w-[14%]", gust: "w-[8%]", wave: "w-[14%]", swell: "w-[14%]", verdict: "w-[10%]",
};

export default function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      });
  }, [id]);

  const loadForecasts = useCallback(async (force = false) => {
    if (!passage) return;
    setLoading(true);
    const wps = passage.waypoints.map((w) => ({
      name: w.port.name, lat: w.port.lat, lon: w.port.lon, isCape: w.isCape,
    }));
    const res = await fetch("/api/forecast/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints: wps, model, force }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setLoading(false); return; }
    setForecasts(data);
    setLoading(false);
  }, [passage, model]);

  useEffect(() => {
    if (passage) loadForecasts();
  }, [passage, loadForecasts]);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!passage || initialLoad.current) { initialLoad.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/passage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, departure, speed, mode, model }),
      });
    }, 500);
  }, [departure, speed, mode, model, id, passage]);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this passage?")) return;
    await fetch(`/api/passage?id=${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (error) return <div className="max-w-4xl mx-auto p-12 text-red-400">Error: {error}</div>;
  if (!passage) return <div className="max-w-4xl mx-auto p-12 text-slate-400">Loading...</div>;

  const stops = passage.waypoints.filter((w) => w.isStop);
  const legs: { from: Waypoint; to: Waypoint; nm: number; departTime: Date; arriveTime: Date; hours: number }[] = [];
  const depDate = new Date(departure || passage.departure);
  let currentTime = depDate.getTime();
  const depHour = depDate.getUTCHours();

  for (let i = 0; i < stops.length - 1; i++) {
    const nm = stops[i + 1].port.coastlineNm - stops[i].port.coastlineNm;
    const hours = nm / speed;
    const departTime = new Date(currentTime);
    const arriveTime = new Date(currentTime + hours * 3600000);
    legs.push({ from: stops[i], to: stops[i + 1], nm, departTime, arriveTime, hours });
    if (mode === "daily" && i < stops.length - 2) {
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

  const totalSailing = legs.reduce((s, l) => s + l.hours, 0);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-xl px-5 py-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-blue-400">
              &#9973; {passage.name || "Passage"}
            </h1>
            <div className="text-xs text-slate-400 mt-0.5 space-x-3">
              <span>{model.toUpperCase()}</span>
              <span>{totalSailing.toFixed(0)}h sailing</span>
              <span>{speed}kt</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-300">Bossanova</div>
            <div className="text-xs text-slate-500">Hallberg-Rassy Monsun 31</div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="group flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all" title="Home">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
              <span className="text-xs hidden sm:inline">Home</span>
            </Link>
            <Link href={`/p/${id}/map`} className="group flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all" title="Map">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>
              <span className="text-xs hidden sm:inline">Map</span>
            </Link>
            <button onClick={() => loadForecasts(true)} className="group flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all" title="Reload forecasts">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.984 4.356v4.993" /></svg>
              <span className="text-xs hidden sm:inline">Reload</span>
            </button>
            <div className="w-px h-5 bg-slate-700 mx-1" />
            <button onClick={handleDelete} className="group flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Delete passage">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-800 rounded-xl px-4 py-3 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Departure</label>
            <input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Speed (kt)</label>
            <input type="number" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value) || 5)}
              min={1} max={15} step={0.5}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none">
              <option value="daily">Daily stops</option>
              <option value="nonstop">Non-stop</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 h-9 text-sm focus:border-blue-500 focus:outline-none">
              <option value="ecmwf_ifs025">ECMWF IFS 0.25&deg;</option>
              <option value="icon_eu">ICON-EU</option>
              <option value="gfs_seamless">GFS</option>
              <option value="arome_france">AROME France</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legs overview */}
      <div className="flex gap-2 flex-wrap mb-4">
        {legs.map((l, i) => {
          const fromTz = tzForPort(l.from.port.lon);
          const toTz = tzForPort(l.to.port.lon);
          return (
            <div key={i} className="bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
              <div className="font-semibold text-blue-400 text-sm">{mode === "daily" ? `Day ${i + 1}: ` : ""}{l.from.port.name} &rarr; {l.to.port.name}</div>
              <div className="text-xs text-slate-500">{l.nm} NM, ~{l.hours.toFixed(1)}h</div>
              <div className="text-xs text-green-400 mt-0.5">{fmtLocal(l.departTime, fromTz)} &rarr; {fmtLocal(l.arriveTime, toTz)}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Fetching forecasts...</p>
        </div>
      ) : forecasts && (
        <>
          <h2 className="text-base font-semibold text-blue-400 mb-2">Passage Summary</h2>

          {/* Single shared header */}
          <table className="w-full text-xs border-collapse table-fixed">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase">
                <th className={`text-left px-2 py-1.5 bg-slate-800/50 ${COL.wp}`}>Waypoint</th>
                <th className={`text-left px-2 py-1.5 bg-slate-800/50 ${COL.eta}`}>ETA</th>
                <th className={`px-2 py-1.5 bg-slate-800/50 ${COL.wx}`}></th>
                <th className={`text-left px-2 py-1.5 bg-slate-800/50 ${COL.wind}`}>Wind (kt)</th>
                <th className={`text-center px-2 py-1.5 bg-slate-800/50 ${COL.gust}`}>Gusts</th>
                <th className={`text-left px-2 py-1.5 bg-slate-800/50 ${COL.wave}`}>Waves</th>
                <th className={`text-left px-2 py-1.5 bg-slate-800/50 ${COL.swell}`}>Swell</th>
                <th className={`text-center px-2 py-1.5 bg-slate-800/50 ${COL.verdict}`}>Verdict</th>
              </tr>
            </thead>
          </table>

          {legs.map((leg, li) => {
            const legWps = passage.waypoints.filter(
              (w) => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
                     w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
            );
            const fromTz = tzForPort(leg.from.port.lon);
            const toTz = tzForPort(leg.to.port.lon);

            return (
              <div key={li} className="mb-1">
                <div className="bg-slate-800 text-blue-400 text-xs font-semibold px-2 py-1.5 border-b border-slate-700/50">
                  {mode === "daily" ? `Day ${li + 1}: ` : `Leg ${li + 1}: `}{leg.from.port.name} &rarr; {leg.to.port.name} ({leg.nm} NM, ~{leg.hours.toFixed(1)}h) — {fmtLocal(leg.departTime, fromTz)} &rarr; {fmtLocal(leg.arriveTime, toTz)}
                </div>
                <table className="w-full text-xs border-collapse table-fixed">
                  <tbody>
                    {legWps.map((wp) => {
                      const eta = getWaypointETA(wp);
                      const tz = tzForPort(wp.port.lon);
                      const wpF = forecasts[wp.port.name] || [];
                      const f = closestForecast(wpF, eta);

                      return (
                        <tr key={wp.port.id} className="border-b border-slate-800/50 hover:bg-blue-500/5">
                          <td className={`px-2 py-1.5 font-semibold ${COL.wp} ${
                            wp.isCape ? "text-yellow-400" : wp.isStop ? "text-green-400" : "text-slate-400"
                          }`}>
                            {wp.port.name}
                            {wp.isStop && <span className="text-[9px] ml-1 border border-green-500 text-green-500 px-0.5 rounded">STOP</span>}
                            {wp.isCape && <span className="text-[9px] ml-1 text-yellow-400 font-bold">CAPE</span>}
                          </td>
                          <td className={`px-2 py-1.5 text-blue-300 text-[11px] ${COL.eta}`}>{fmtLocal(eta, tz)}</td>
                          {f ? (
                            <>
                              <td className={`px-2 py-1.5 text-center ${COL.wx}`}>{WEATHER_EMOJI[f.weather] || ""}</td>
                              <td className={`px-2 py-1.5 ${COL.wind}`}>
                                <span className="inline-block text-yellow-400" style={{ transform: `rotate(${f.windDirDeg}deg)` }}>&darr;</span>
                                {" "}{Math.round(f.windKt)} B{bftNum(f.beaufort)}
                              </td>
                              <td className={`px-2 py-1.5 text-center ${COL.gust}`}>{Math.round(f.gustKt)}</td>
                              <td className={`px-2 py-1.5 ${COL.wave}`}>
                                <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.waveM}m / {f.wavePeriodS}s
                              </td>
                              <td className={`px-2 py-1.5 ${COL.swell}`}>
                                <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.swellM}m / {f.swellPeriodS}s
                              </td>
                              <td className={`px-2 py-1.5 text-center ${COL.verdict}`}>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${verdictColor(f.verdict)}`}>
                                  {verdictLabel(f.verdict)}
                                </span>
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="px-2 py-1.5 text-slate-500">No data</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Detailed Forecast */}
          <h2 className="text-base font-semibold text-blue-400 mb-2 mt-6">Detailed Forecast by Waypoint</h2>
          {passage.waypoints.map((wp) => {
            const allF = forecasts[wp.port.name] || [];
            const eta = getWaypointETA(wp);
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

            return (
              <details key={wp.port.id} open={!isCollapsed} className={`group mb-2 rounded-lg border overflow-hidden ${
                wp.isCape ? "border-yellow-500/30" : wp.isStop ? "border-green-500/30" : "border-slate-800"
              }`}>
                <summary className="px-3 py-2 cursor-pointer bg-slate-800 hover:bg-slate-750 flex items-center gap-2 select-none">
                  <svg className="w-3.5 h-3.5 text-slate-500 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span className={`font-semibold text-sm ${
                    wp.isCape ? "text-yellow-400" : wp.isStop ? "text-green-400" : "text-slate-400"
                  }`}>
                    {wp.port.name}
                  </span>
                  <span className="text-[11px] text-slate-500">ETA: {fmtLocal(eta, tz)}</span>
                  <span className="text-[11px] text-slate-600 ml-auto">{dayF.length} entries</span>
                </summary>
                <div className="bg-slate-800">
                  {dayF.length > 0 ? (
                    <table className="w-full text-xs table-fixed">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase">
                          <th className="text-left px-2 py-1.5 w-[10%]">Time</th>
                          <th className="px-2 py-1.5 w-[4%]"></th>
                          <th className="text-left px-2 py-1.5 w-[16%]">Wind (kt)</th>
                          <th className="text-center px-2 py-1.5 w-[8%]">Gusts</th>
                          <th className="text-left px-2 py-1.5 w-[16%]">Waves</th>
                          <th className="text-left px-2 py-1.5 w-[16%]">Swell</th>
                          <th className="text-center px-2 py-1.5 w-[10%]">Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayF.map((f) => {
                          const dt = new Date(f.time);
                          const diffH = Math.abs(dt.getTime() - eta.getTime()) / 3600000;
                          return (
                            <tr key={f.time} className={`border-b border-slate-800/30 ${diffH < 2 ? "bg-blue-500/10" : ""}`}>
                              <td className="px-2 py-1">{fmtTimeLocal(dt, tz)}</td>
                              <td className="px-2 py-1 text-center">{WEATHER_EMOJI[f.weather] || ""}</td>
                              <td className="px-2 py-1">
                                <span className="inline-block text-yellow-400" style={{ transform: `rotate(${f.windDirDeg}deg)` }}>&darr;</span>
                                {" "}{Math.round(f.windKt)} B{bftNum(f.beaufort)}
                              </td>
                              <td className="px-2 py-1 text-center">{Math.round(f.gustKt)}</td>
                              <td className="px-2 py-1">
                                <span className="inline-block" style={{ transform: `rotate(${f.waveDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.waveM}m / {f.wavePeriodS}s
                              </td>
                              <td className="px-2 py-1">
                                <span className="inline-block" style={{ transform: `rotate(${f.swellDirDeg}deg)` }}>&darr;</span>
                                {" "}{f.swellM}m / {f.swellPeriodS}s
                              </td>
                              <td className="px-2 py-1 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${verdictColor(f.verdict)}`}>
                                  {verdictLabel(f.verdict)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-3 py-2 text-slate-500 text-xs">No forecast data</div>
                  )}
                </div>
              </details>
            );
          })}
        </>
      )}

      <div className="text-center text-[10px] text-slate-600 mt-6 pt-4 border-t border-slate-800">
        Planning aid only. Cross-check with AEMET, Meteogalicia, and real-time conditions before departure.
      </div>
    </div>
  );
}
