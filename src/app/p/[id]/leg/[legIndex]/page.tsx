"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTheme } from "@/lib/theme";
import type { ForecastEntry } from "@/lib/weather";

const LegMap = dynamic(() => import("./LegMap"), { ssr: false });

// ── Types ──

interface Port {
  id: string; name: string; slug: string; lat: number; lon: number; type: string;
  coastlineNm: number; fuel: boolean; water: boolean; electric: boolean;
  repairs: boolean; customs: boolean; shelter: string | null; maxDraft: number | null;
  vhfCh: string | null; website: string | null; phone: string | null; email: string | null;
  notes: string | null; country: string; region: string | null;
  marinaName: string | null; marinaHours: string | null;
  berthCount: number | null; visitorBerths: number | null; maxLength: number | null;
  accessCodes: string | null; approachNotes: string | null; approachDescription: string | null;
  restaurants: unknown; yachtShops: unknown; groceryStores: unknown; extras: unknown;
  marinaFacilities: unknown; sourceVerification: unknown;
  orcaRisk: string | null; orcaNotes: string | null; passageNotes: string | null;
}
interface PlaceInfo { name: string; rating?: number; cuisine?: string; phone?: string; hours?: string; address?: string; description?: string; category?: string; }
interface MarinaFacilities {
  showers?: boolean; toilets?: boolean; laundry?: boolean; wifi?: boolean; fuelDock?: boolean;
  slipway?: boolean; travelLift?: boolean; repairs?: boolean; chandlery?: boolean;
  pumpOut?: boolean; securityGate?: boolean;
}
interface VerificationItem { source?: string; url?: string; checkedAt?: string; notes?: string; }
interface SourceVerification {
  phone?: VerificationItem;
  hours?: VerificationItem;
  approach?: VerificationItem;
  poi?: VerificationItem;
  facilities?: VerificationItem;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface Passage {
  id: string; shortId: string; name: string | null;
  departure: string; speed: number; mode: string; model: string;
  waypoints: Waypoint[];
}
interface Milestone { name: string; eta_offset_hours: number; lat: number; lon: number; bearing: string | null; visual_ref: string; type: string; notes?: string; }
interface Hazard { name: string; lat: number; lon: number; type: string; severity: string; description: string; }
interface FallbackPort { name: string; slug: string; distance_nm: number; time_hours: number; conditions: string; }
interface LegGuide {
  difficulty: string | null; description: string | null; pilotageText: string | null;
  milestones: Milestone[] | null; hazards: Hazard[] | null; fallbackPorts: FallbackPort[] | null;
  tidalNotes: string | null; tidalGate: string | null; currentNotes: string | null;
  bestWindow: string | null; nightNotes: string | null;
}
interface Webcam { id: string; title: string; lat: number; lon: number; city: string; preview: string; thumbnail: string; playerUrl: string; }

// ── Helpers ──

function tzForPort(lon: number) { return lon >= -10 && lon <= 3 ? "Europe/Madrid" : lon > 3 && lon <= 15 ? "Europe/Rome" : "UTC"; }
function fmtLocal(d: Date, tz: string) { return d.toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(" at ", " "); }
function parseJson(val: unknown): PlaceInfo[] { if (!val) return []; if (typeof val === "string") try { return JSON.parse(val); } catch { return []; } if (Array.isArray(val)) return val; return []; }
function parseJsonTyped<T>(val: unknown): T[] { if (!val) return []; if (typeof val === "string") try { return JSON.parse(val); } catch { return []; } if (Array.isArray(val)) return val; return []; }
function parseJsonObject<T>(val: unknown): T | null { if (!val) return null; if (typeof val === "string") try { return JSON.parse(val); } catch { return null; } if (typeof val === "object") return val as T; return null; }

const DIFF_COLORS: Record<string, string> = { easy: "var(--text-green)", moderate: "var(--text-yellow)", challenging: "var(--text-red)", dangerous: "var(--text-red)" };
const MILESTONE_ICONS: Record<string, string> = { departure: "🚀", clear_breakwater: "⚓", course_change: "🧭", round_cape: "⚠️", approach: "🔭", berth: "🏁" };
const HAZARD_ICONS: Record<string, string> = { wind_acceleration: "💨", rock: "🪨", shoal: "⚠️", current: "🌊", traffic: "🚢", military: "🎖️", orca: "🐋" };

// ── Components ──

function Section({ title, children, icon, defaultOpen = true }: { title: string; children: React.ReactNode; icon?: string; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid var(--border-light)` }}>
      <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 select-none font-semibold text-sm" style={{ background: "var(--bg-card)", color: "var(--text-heading)" }}>
        <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        {icon && <span>{icon}</span>} {title}
      </summary>
      <div className="px-4 py-3 text-sm" style={{ background: "var(--bg-card)" }}>{children}</div>
    </details>
  );
}

function PlaceCard({ place }: { place: PlaceInfo }) {
  return (
    <div className="rounded-lg px-3 py-2.5 mb-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{place.name}</span>
        {place.rating && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>★ {place.rating}</span>}
      </div>
      {place.cuisine && <div className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>{place.cuisine}</div>}
      {place.description && <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{place.description}</div>}
      <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {place.phone && <a href={`tel:${place.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>📞 {place.phone}</a>}
        {place.hours && <span>🕐 {place.hours}</span>}
        {place.address && <span>📍 {place.address}</span>}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function LegDetailPage({ params }: { params: Promise<{ id: string; legIndex: string }> }) {
  const { id, legIndex: legIndexStr } = use(params);
  const legIndex = parseInt(legIndexStr, 10);
  const router = useRouter();
  const { theme } = useTheme();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry[]> | null>(null);
  const [guide, setGuide] = useState<LegGuide | null>(null);
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  interface TideData { port: string; isSpring: boolean; range: number; stateAtDate: { rising: boolean; hoursToHW: number; hoursToLW: number; approxHeight: number; description: string }; extremes: { time: string; type: string; height: number }[]; stream: { area: string; floodDir: string; ebbDir: string; springRate: number; notes: string } | null; }
  const [depTide, setDepTide] = useState<TideData | null>(null);
  const [arrTide, setArrTide] = useState<TideData | null>(null);

  useEffect(() => { fetch(`/api/passage?id=${id}`).then(r => r.json()).then(setPassage); }, [id]);

  // Compute legs
  const stops = passage?.waypoints.filter(w => w.isStop) || [];
  const legs: { from: Waypoint; to: Waypoint; nm: number; departTime: Date; arriveTime: Date; hours: number }[] = [];
  if (passage) {
    const depDate = new Date(passage.departure);
    let currentTime = depDate.getTime();
    const depHour = depDate.getUTCHours();
    for (let i = 0; i < stops.length - 1; i++) {
      const nm = stops[i + 1].port.coastlineNm - stops[i].port.coastlineNm;
      const hours = nm / passage.speed;
      const departTime = new Date(currentTime);
      const arriveTime = new Date(currentTime + hours * 3600000);
      legs.push({ from: stops[i], to: stops[i + 1], nm, departTime, arriveTime, hours });
      if (passage.mode === "daily" && i < stops.length - 2) {
        const nextDay = new Date(arriveTime); nextDay.setUTCDate(nextDay.getUTCDate() + 1); nextDay.setUTCHours(depHour, 0, 0, 0);
        if (nextDay.getTime() < arriveTime.getTime()) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        currentTime = nextDay.getTime();
      } else { currentTime = arriveTime.getTime(); }
    }
  }

  const leg = legs[legIndex] || null;
  const dest = leg?.to.port || null;
  const fromPort = leg?.from.port || null;

  // Fetch leg guide
  useEffect(() => {
    if (fromPort && dest) {
      fetch(`/api/leg?from=${fromPort.slug}&to=${dest.slug}`).then(r => r.json()).then(d => setGuide(d.guide)).catch(() => {});
    }
  }, [fromPort, dest]);

  // Fetch forecasts
  useEffect(() => {
    if (!passage || !leg) return;
    const legWps = passage.waypoints.filter(w => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 && w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1);
    const wps = legWps.map(w => ({ name: w.port.name, lat: w.port.lat, lon: w.port.lon, isCape: w.isCape }));
    fetch("/api/forecast/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waypoints: wps, model: passage.model }) })
      .then(r => r.json()).then(data => { if (!data.error) setForecasts(data); }).catch(() => {});
  }, [passage, leg, dest, fromPort]);

  // Fetch tides for departure and arrival ports
  useEffect(() => {
    if (!leg || !fromPort || !dest) return;
    const depTime = leg.departTime.toISOString();
    const arrTime = leg.arriveTime.toISOString();
    fetch(`/api/tides?port=${fromPort.slug}&date=${depTime}`).then(r => r.json()).then(d => { if (!d.error) setDepTide(d); }).catch(() => {});
    fetch(`/api/tides?port=${dest.slug}&date=${arrTime}`).then(r => r.json()).then(d => { if (!d.error) setArrTide(d); }).catch(() => {});
  }, [leg, fromPort?.slug, dest?.slug]);

  // Fetch webcams
  useEffect(() => { if (dest) { fetch(`/api/webcams?lat=${dest.lat}&lon=${dest.lon}&radius=25`).then(r => r.json()).then(data => { if (Array.isArray(data)) setWebcams(data); }).catch(() => {}); } }, [dest]);

  if (!passage) return <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  if (!leg || !dest || !fromPort) return <div className="p-8" style={{ color: "var(--text-red)" }}>Leg not found</div>;

  const fromTz = tzForPort(leg.from.port.lon);
  const toTz = tzForPort(leg.to.port.lon);
  const legWps = passage.waypoints.filter(w => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 && w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1);
  const capeWps = legWps.filter(w => w.isCape);

  // Decision
  function getETA(wp: Waypoint): Date {
    const frac = (wp.port.coastlineNm - leg.from.port.coastlineNm) / (leg.to.port.coastlineNm - leg.from.port.coastlineNm || 1);
    return new Date(leg.departTime.getTime() + frac * (leg.arriveTime.getTime() - leg.departTime.getTime()));
  }
  function closestForecast(wpF: ForecastEntry[], eta: Date): ForecastEntry | null {
    let best: ForecastEntry | null = null, bestD = Infinity;
    for (const f of wpF) { const d = Math.abs(new Date(f.time).getTime() - eta.getTime()); if (d < bestD) { bestD = d; best = f; } }
    return best;
  }

  let verdict = "NO DATA", verdictColor = "var(--text-muted)", maxWind = 0, maxGust = 0, maxWave = 0, maxSwell = 0, worstWp = "";
  if (forecasts) {
    let worstLevel = 0;
    for (const wp of legWps) {
      const wpF = forecasts[wp.port.name] || [];
      const f = closestForecast(wpF, getETA(wp));
      if (!f) continue;
      if (f.windKt > maxWind) maxWind = f.windKt;
      if (f.gustKt > maxGust) maxGust = f.gustKt;
      if (f.waveM != null && f.waveM > maxWave) maxWave = f.waveM;
      if (f.swellM != null && f.swellM > maxSwell) maxSwell = f.swellM;
      const lv = f.verdict.startsWith("NO") ? 2 : f.verdict.startsWith("CAUTION") ? 1 : 0;
      if (lv > worstLevel) { worstLevel = lv; worstWp = wp.port.name; }
    }
    verdict = worstLevel === 2 ? "NO-GO" : worstLevel === 1 ? "CAUTION" : "GO";
    verdictColor = worstLevel === 2 ? "var(--text-red)" : worstLevel === 1 ? "var(--text-yellow)" : "var(--text-green)";
  }

  // Leg scoring engine (0-100, higher = safer)
  let legScore = 100;
  const penalties: string[] = [];
  if (maxWind > 25) { legScore -= 30; penalties.push(`Wind ${Math.round(maxWind)}kt (-30)`); }
  else if (maxWind > 15) { legScore -= 10; penalties.push(`Wind ${Math.round(maxWind)}kt (-10)`); }
  if (maxGust > 30) { legScore -= 20; penalties.push(`Gusts ${Math.round(maxGust)}kt (-20)`); }
  if (maxWave > 3) { legScore -= 25; penalties.push(`Waves ${maxWave.toFixed(1)}m (-25)`); }
  else if (maxWave > 2) { legScore -= 10; penalties.push(`Waves ${maxWave.toFixed(1)}m (-10)`); }
  if (capeWps.length > 0) { legScore -= capeWps.length * 10; penalties.push(`${capeWps.length} cape(s) (-${capeWps.length * 10})`); }
  if (leg.hours > 10) { legScore -= 10; penalties.push(`Long leg ${leg.hours.toFixed(0)}h (-10)`); }
  if (leg.hours > 14) { legScore -= 10; penalties.push(`Night sailing (-10)`); }
  if (guide?.difficulty === "challenging") { legScore -= 15; penalties.push("Challenging difficulty (-15)"); }
  else if (guide?.difficulty === "dangerous") { legScore -= 30; penalties.push("Dangerous difficulty (-30)"); }
  legScore = Math.max(0, Math.min(100, legScore));
  const scoreColor = legScore >= 80 ? "var(--text-green)" : legScore >= 50 ? "var(--text-yellow)" : "var(--text-red)";

  const milestones = parseJsonTyped<Milestone>(guide?.milestones);
  const hazards = parseJsonTyped<Hazard>(guide?.hazards);
  const fallbacks = parseJsonTyped<FallbackPort>(guide?.fallbackPorts);
  const restaurants = parseJson(dest.restaurants);
  const yachtShops = parseJson(dest.yachtShops);
  const groceryStores = parseJson(dest.groceryStores);
  const extras = parseJson(dest.extras);
  const facilities = parseJsonObject<MarinaFacilities>(dest.marinaFacilities);
  const verification = parseJsonObject<SourceVerification>(dest.sourceVerification);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-4" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Sticky compact bar */}
      <div className="sticky top-0 z-40 -mx-6 px-6 py-2 flex items-center justify-between text-xs backdrop-blur-md" style={{ background: "var(--bg-primary)ee", borderBottom: `1px solid var(--border-light)` }}>
        <button onClick={() => router.back()} className="hover:opacity-80" style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", font: "inherit" }}>← Back</button>
        <div className="flex items-center gap-3">
          <span className="font-bold" style={{ color: "var(--text-heading)" }}>{fromPort?.name} → {dest?.name}</span>
          <span className="font-black px-2 py-0.5 rounded" style={{ color: verdictColor, background: verdict === "GO" ? "var(--accent-go)" : verdict === "CAUTION" ? "var(--accent-caution)" : "var(--accent-nogo)" }}>{verdict}</span>
          <span style={{ color: "var(--text-muted)" }}>{leg?.nm}NM · {Math.round(maxWind)}kt · {maxWave.toFixed(1)}m</span>
        </div>
      </div>

      {/* ══════ HEADER ══════ */}
      <div className="rounded-xl px-5 py-4 mb-3" style={{ background: `linear-gradient(to right, var(--bg-header-from), var(--bg-header-to))`, border: `1px solid var(--border)` }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-heading)" }}>
              ⛵ {passage.mode === "daily" ? `Day ${legIndex + 1}` : `Leg ${legIndex + 1}`}: {fromPort.name} → {dest.name}
            </h1>
            {guide?.description && <p className="text-xs mt-1 max-w-2xl" style={{ color: "var(--text-secondary)" }}>{guide.description}</p>}
          </div>
          {guide?.difficulty && <span className="text-xs font-bold px-2 py-1 rounded" style={{ color: DIFF_COLORS[guide.difficulty] || "var(--text-muted)", border: `1px solid ${DIFF_COLORS[guide.difficulty] || "var(--border)"}` }}>{guide.difficulty.toUpperCase()}</span>}
        </div>
      </div>

      {/* ══════ DECISION SUMMARY ══════ */}
      <div className="rounded-xl px-5 py-4 mb-3" style={{ background: "var(--bg-card)", border: `1px solid var(--border-light)` }}>
        {/* Verdict + metrics row */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black px-3 py-1 rounded-lg" style={{ color: verdictColor, background: verdict === "GO" ? "var(--accent-go)" : verdict === "CAUTION" ? "var(--accent-caution)" : "var(--accent-nogo)" }}>{verdict}</span>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <div>{leg.nm} NM · ~{leg.hours.toFixed(1)}h · {passage.speed}kt</div>
              <div>{fmtLocal(leg.departTime, fromTz)} → {fmtLocal(leg.arriveTime, toTz)}</div>
            </div>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <div><span style={{ color: "var(--text-muted)" }}>Wind</span> <strong>{Math.round(maxWind)}kt</strong></div>
            <div><span style={{ color: "var(--text-muted)" }}>Gusts</span> <strong>{Math.round(maxGust)}kt</strong></div>
            <div><span style={{ color: "var(--text-muted)" }}>Waves</span> <strong>{maxWave.toFixed(1)}m</strong></div>
            <div><span style={{ color: "var(--text-muted)" }}>Swell</span> <strong>{maxSwell.toFixed(1)}m</strong></div>
          </div>
        </div>

        {/* Decision details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {/* What to monitor */}
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)" }}>
            <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Monitor</div>
            {worstWp && verdict !== "GO" && <div style={{ color: verdictColor }}>⚠ Worst: <strong>{worstWp}</strong></div>}
            {capeWps.length > 0 && <div style={{ color: "var(--text-yellow)" }}>⚡ {capeWps.map(w => w.port.name).join(", ")}</div>}
            {maxWave > 2.0 && <div style={{ color: "var(--text-yellow)" }}>🌊 Waves {maxWave.toFixed(1)}m — reef early</div>}
            {maxGust > 25 && <div style={{ color: "var(--text-red)" }}>💨 Gusts {Math.round(maxGust)}kt — expect reefing</div>}
            {!worstWp && capeWps.length === 0 && maxWave <= 2 && <div style={{ color: "var(--text-green)" }}>✓ No special concerns</div>}
          </div>

          {/* Sailing expectation */}
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)" }}>
            <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Sailing</div>
            <div>🚢 Motor exit ~{Math.min(0.5, leg.hours * 0.1).toFixed(1)}h</div>
            <div>⛵ Sailing ~{Math.max(0, leg.hours - 1).toFixed(1)}h</div>
            <div>🚢 Motor entry ~{Math.min(0.5, leg.hours * 0.1).toFixed(1)}h</div>
            {leg.hours > 8 && <div style={{ color: "var(--text-yellow)" }}>🌙 Long day — {leg.hours > 12 ? "night sailing likely" : "arrive before dark"}</div>}
          </div>

          {/* Fallback */}
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)" }}>
            <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Fallback</div>
            {fallbacks.length > 0
              ? fallbacks.slice(0, 2).map((f, i) => <div key={i}>🆘 {f.name} ({f.distance_nm}NM, ~{f.time_hours}h)</div>)
              : <div style={{ color: "var(--text-muted)" }}>No intermediate ports</div>
            }
            {verdict !== "GO" && <div className="mt-1 font-semibold" style={{ color: "var(--text-yellow)" }}>⚠ Consider postponing if conditions worsen</div>}
          </div>
        </div>

        {/* Tide at departure/arrival */}
        {(depTide || arrTide) && (
          <div className="flex gap-2 mt-2 text-[11px] flex-wrap" style={{ color: "var(--text-secondary)" }}>
            {depTide && <div>🏗️ Departure tide: <strong>{depTide.stateAtDate.description}</strong> ({depTide.isSpring ? "Springs" : "Neaps"}, range {depTide.range}m)</div>}
            {arrTide && <div>⚓ Arrival tide: <strong>{arrTide.stateAtDate.description}</strong></div>}
          </div>
        )}
      </div>

      {/* Best window + orca */}
      {(guide?.bestWindow || (dest.orcaRisk && dest.orcaRisk !== "none")) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {guide?.bestWindow && (
            <div className="flex-1 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--accent-go)", color: "var(--text-green)", border: `1px solid var(--text-green)30` }}>
              <strong>Best departure:</strong> {guide.bestWindow}
            </div>
          )}
          {dest.orcaRisk && dest.orcaRisk !== "none" && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>
              🐋 Orca risk: {dest.orcaRisk.toUpperCase()} {dest.orcaNotes && `— ${dest.orcaNotes}`}
            </div>
          )}
        </div>
      )}

      {/* ══════ MAP ══════ */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid var(--border-light)`, height: 400 }}>
        <LegMap waypoints={legWps} fromPort={fromPort} toPort={dest} theme={theme} hazards={hazards} milestones={milestones} />
      </div>

      {/* ══════ PILOTAGE ══════ */}
      {guide?.pilotageText && (
        <Section title="Pilotage Notes" icon="🗺️">
          <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
            {guide.pilotageText.split(/^## /m).filter(Boolean).map((section, i) => {
              const [title, ...body] = section.split("\n");
              return (
                <div key={i} className="mb-3">
                  <div className="font-bold text-sm mb-1" style={{ color: "var(--text-heading)" }}>{title}</div>
                  <div>{body.join("\n").trim()}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ══════ MILESTONES ══════ */}
      {milestones.length > 0 && (
        <Section title={`Passage Plan (${milestones.length})`} icon="📍">
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-3 items-start rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
                <span className="text-lg">{MILESTONE_ICONS[m.type] || "📌"}</span>
                <div className="flex-1">
                  <div className="font-semibold text-xs" style={{ color: "var(--text-heading)" }}>{m.name}</div>
                  <div className="text-[11px] flex gap-3 mt-0.5" style={{ color: "var(--text-muted)" }}>
                    <span>ETA +{m.eta_offset_hours.toFixed(1)}h</span>
                    {m.bearing && <span>BRG {m.bearing}</span>}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{m.visual_ref}</div>
                  {m.notes && <div className="text-[11px] mt-0.5 font-semibold" style={{ color: "var(--text-yellow)" }}>{m.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ══════ HAZARDS ══════ */}
      {hazards.length > 0 && (
        <Section title={`Hazards (${hazards.length})`} icon="⚠️">
          {hazards.map((h, i) => (
            <div key={i} className="rounded-lg px-3 py-2 mb-2" style={{ background: h.severity === "critical" ? "var(--accent-nogo)" : "var(--bg-primary)", border: `1px solid ${h.severity === "critical" ? "var(--text-red)30" : "var(--border-light)"}` }}>
              <div className="flex items-center gap-2">
                <span>{HAZARD_ICONS[h.type] || "⚠️"}</span>
                <span className="font-semibold text-xs" style={{ color: h.severity === "critical" ? "var(--text-red)" : "var(--text-heading)" }}>{h.name}</span>
                <span className="text-[10px] px-1 rounded" style={{ color: "var(--text-muted)", border: `1px solid var(--border)` }}>{h.severity}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{h.description}</div>
            </div>
          ))}
        </Section>
      )}

      {/* ══════ TIDES & CURRENTS — LIVE ══════ */}
      <Section title="Tides & Currents" icon="🌊">
        {/* Live tide predictions */}
        {(depTide || arrTide) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {depTide && (
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
                <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Departure: {fromPort.name}</div>
                <div className="text-xs font-semibold mb-1" style={{ color: depTide.stateAtDate.rising ? "var(--text-green)" : "var(--text-blue-light)" }}>
                  {depTide.stateAtDate.description}
                </div>
                <div className="text-[11px] space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                  <div>Range: {depTide.range}m ({depTide.isSpring ? "Springs" : "Neaps"})</div>
                  {depTide.extremes.filter(e => {
                    const t = new Date(e.time);
                    return Math.abs(t.getTime() - leg.departTime.getTime()) < 12 * 3600000;
                  }).slice(0, 4).map((e, i) => (
                    <div key={i}>
                      <span style={{ color: e.type === "HW" ? "var(--text-green)" : "var(--text-blue-light)" }}>{e.type}</span>
                      {" "}{new Date(e.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tzForPort(fromPort.lon) })}
                      {" "}<span style={{ color: "var(--text-muted)" }}>({e.height > 0 ? "+" : ""}{e.height}m)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {arrTide && (
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
                <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Arrival: {dest.name}</div>
                <div className="text-xs font-semibold mb-1" style={{ color: arrTide.stateAtDate.rising ? "var(--text-green)" : "var(--text-blue-light)" }}>
                  {arrTide.stateAtDate.description}
                </div>
                <div className="text-[11px] space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                  <div>Range: {arrTide.range}m ({arrTide.isSpring ? "Springs" : "Neaps"})</div>
                  {arrTide.extremes.filter(e => {
                    const t = new Date(e.time);
                    return Math.abs(t.getTime() - leg.arriveTime.getTime()) < 12 * 3600000;
                  }).slice(0, 4).map((e, i) => (
                    <div key={i}>
                      <span style={{ color: e.type === "HW" ? "var(--text-green)" : "var(--text-blue-light)" }}>{e.type}</span>
                      {" "}{new Date(e.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tzForPort(dest.lon) })}
                      {" "}<span style={{ color: "var(--text-muted)" }}>({e.height > 0 ? "+" : ""}{e.height}m)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Wind-against-tide warning */}
        {depTide?.stream && (
          <div className="rounded-lg px-3 py-2 mb-2 text-xs" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>
            ⚠️ <strong>{depTide.stream.area}:</strong> {depTide.stream.notes} (Springs: {depTide.stream.springRate}kt {depTide.stream.floodDir}/{depTide.stream.ebbDir})
          </div>
        )}
        {/* Tidal gate from curated data */}
        {guide?.tidalGate && <div className="rounded-lg px-3 py-2 mb-2 text-xs font-semibold" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>⏰ Tidal gate: {guide.tidalGate}</div>}
        {guide?.currentNotes && <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}><strong>Currents:</strong> {guide.currentNotes}</div>}
        <div className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>⚠ Approximate predictions (~15-30 min accuracy). Cross-check with Admiralty EasyTide.</div>
      </Section>

      {/* ══════ FALLBACK ══════ */}
      {fallbacks.length > 0 && (
        <Section title="Fallback Plan" icon="🆘">
          {fallbacks.map((f, i) => (
            <div key={i} className="rounded-lg px-3 py-2 mb-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
              <div className="flex justify-between">
                <span className="font-semibold text-xs" style={{ color: "var(--text-heading)" }}>{f.name}</span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{f.distance_nm} NM · ~{f.time_hours}h</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{f.conditions}</div>
            </div>
          ))}
        </Section>
      )}

      {/* ══════ ARRIVAL: MARINA ══════ */}
      {dest.type !== "cape" && (
        <Section title={`Arrival: ${dest.marinaName || dest.name}`} icon="🏗️">
          {dest.approachDescription && <div className="text-xs mb-3 p-2 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>{dest.approachDescription}</div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            {dest.phone && <div>📞 <a href={`tel:${dest.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>{dest.phone}</a></div>}
            {dest.vhfCh && <div>📻 VHF Ch {dest.vhfCh}</div>}
            {dest.email && <div>✉️ <a href={`mailto:${dest.email}`} style={{ color: "var(--text-blue-light)" }}>{dest.email}</a></div>}
            {dest.website && <div>🌐 <a href={dest.website} target="_blank" rel="noopener" style={{ color: "var(--text-blue-light)" }}>{dest.website.replace(/https?:\/\//, "")}</a></div>}
            {dest.marinaHours && <div>🕐 {dest.marinaHours}</div>}
            {dest.berthCount && <div>⚓ {dest.berthCount} berths ({dest.visitorBerths || "?"} visitor)</div>}
            {dest.maxLength && <div>📏 Max LOA: {dest.maxLength}m</div>}
            {dest.maxDraft && <div>📐 Max draft: {dest.maxDraft}m</div>}
            {dest.shelter && <div>🛡️ Shelter: <span style={{ color: dest.shelter === "good" ? "var(--text-green)" : "var(--text-yellow)" }}>{dest.shelter.toUpperCase()}</span></div>}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {dest.fuel && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Fuel</span>}
            {dest.water && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Water</span>}
            {dest.electric && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Electric</span>}
            {dest.repairs && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Repairs</span>}
            {dest.customs && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>Customs</span>}
          </div>
          {facilities && (
            <div className="flex flex-wrap gap-1.5 text-[11px] mt-2">
              {facilities.showers && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Showers</span>}
              {facilities.toilets && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Toilets</span>}
              {facilities.laundry && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Laundry</span>}
              {facilities.wifi && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Wi-Fi</span>}
              {facilities.fuelDock && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Fuel dock</span>}
              {facilities.chandlery && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Chandlery nearby</span>}
              {facilities.securityGate && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Secure gate</span>}
              {facilities.pumpOut && <span className="px-2 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: `1px solid var(--border-light)` }}>Pump-out</span>}
            </div>
          )}
          {dest.accessCodes && <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>🔑 {dest.accessCodes}</div>}
          {dest.approachNotes && <div className="mt-2 text-xs p-2 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-blue-light)" }}>{dest.approachNotes}</div>}
          {verification?.phone?.checkedAt && (
            <div className="mt-2 text-[10px] inline-block px-2 py-0.5 rounded" style={{ color: "var(--text-muted)", border: `1px solid var(--border-light)` }}>
              ✓ Data verified {verification.phone.checkedAt.slice(0, 10)}
            </div>
          )}
        </Section>
      )}

      {/* ══════ RESTAURANTS ══════ */}
      {restaurants.length > 0 && (
        <Section title={`Restaurants (${restaurants.length})`} icon="🍽️">
          {restaurants.map((r, i) => <PlaceCard key={i} place={r} />)}
        </Section>
      )}

      {/* ══════ YACHT SHOPS ══════ */}
      {yachtShops.length > 0 && (
        <Section title={`Yacht & Marine (${yachtShops.length})`} icon="⛵">
          {yachtShops.map((s, i) => <PlaceCard key={i} place={s} />)}
        </Section>
      )}

      {/* ══════ GROCERY ══════ */}
      {groceryStores.length > 0 && (
        <Section title={`Provisioning (${groceryStores.length})`} icon="🛒">
          {groceryStores.map((s, i) => <PlaceCard key={i} place={s} />)}
        </Section>
      )}

      {/* ══════ EXTRAS ══════ */}
      {extras.length > 0 && (
        <Section title="Services & Extras" icon="📋">
          {extras.map((e, i) => <PlaceCard key={i} place={e} />)}
        </Section>
      )}

      {/* ══════ WEBCAMS ══════ */}
      {webcams.length > 0 && (
        <Section title={`Live Webcams (${webcams.length})`} icon="📹">
          <div className="grid grid-cols-2 gap-2">
            {webcams.map(wc => (
              <a key={wc.id} href={wc.playerUrl} target="_blank" rel="noopener" className="block rounded-lg overflow-hidden hover:opacity-80" style={{ border: `1px solid var(--border-light)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {wc.preview && <img src={wc.preview} alt={wc.title} className="w-full h-24 object-cover" />}
                <div className="px-2 py-1.5 text-[11px]" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>{wc.title}</div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ══════ EMERGENCY ══════ */}
      <Section title="Emergency Contacts" icon="🚨">
        <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
          <div>🚨 <strong>Salvamento Marítimo:</strong> <a href="tel:900202202" style={{ color: "var(--text-blue-light)" }}>900 202 202</a> / VHF 16</div>
          <div>🏥 <strong>Emergencias:</strong> <a href="tel:112" style={{ color: "var(--text-blue-light)" }}>112</a></div>
          <div>⚓ <strong>MRCC Gijón:</strong> VHF 16, 70 (DSC)</div>
          <div>
            🐋 <strong>Orca advisory:</strong> Monitor GT Orcas app onboard and cross-check recent{" "}
            <a href="https://www.orcaiberica.org/en/recomendaciones" target="_blank" rel="noopener" style={{ color: "var(--text-blue-light)" }}>Orca Ibérica recommendations</a>
            {" "} / {" "}
            <a href="https://www.orcaiberica.org/interacciones-registradas" target="_blank" rel="noopener" style={{ color: "var(--text-blue-light)" }}>interaction reports</a>.
          </div>
          {guide?.nightNotes && <div className="mt-2 p-2 rounded" style={{ background: "var(--bg-primary)" }}>🌙 <strong>Night sailing:</strong> {guide.nightNotes}</div>}
        </div>
      </Section>

      <div className="text-center text-[10px] mt-6 pt-4" style={{ color: "var(--text-muted)", borderTop: `1px solid var(--border-light)` }}>
        Planning aid only. Verify all information with official sources before departure.
      </div>
    </div>
  );
}
