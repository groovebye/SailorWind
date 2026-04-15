"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTheme } from "@/lib/theme";
import type { ForecastEntry } from "@/lib/weather";

const LegMap = dynamic(() => import("./LegMap"), { ssr: false });
const MarinaMiniMap = dynamic(() => import("@/components/MarinaMiniMap"), { ssr: false });

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
  waitingArea: string | null; swellSensitivity: string | null; entranceNotes: string | null; bestTideEntry: string | null;
}
interface PlaceInfo { name: string; rating?: number; cuisine?: string; phone?: string; hours?: string; address?: string; description?: string; category?: string; }
interface TimelineEntry {
  hourIndex: number; time: string; lat: number; lon: number; distanceFromStartNm: number; distanceToGoNm: number;
  segmentName: string; courseTrue: number; boatHeading: number; windDir: string; windDirDeg: number; windKt: number; gustKt: number;
  waveM: number | null; wavePeriodS: number | null; swellM: number | null; swellPeriodS: number | null; currentDir: string | null; currentDirDeg: number | null; currentKt: number; twa: number;
  pointOfSail: string; mode: "sail" | "motor" | "motorsail"; tack: "port" | "starboard" | "none"; sailConfig: string; reefLevel: 0 | 1 | 2;
  expectedBoatSpeedKt: number; expectedSogKt: number; comfortScore: number; comfort: string; warnings: string[]; notes: string;
}
interface TimelineSummaryData {
  routeDistanceNm: number; computedDurationHours: number; estimatedArrival: string; dominantMode: string;
  sailHours: number; motorHours: number; motorsailHours: number; averageSogKt: number;
  maxWindKt: number; maxGustKt: number; maxWaveM: number; maxCurrentKt: number;
  overallComfortScore: number; overallComfort: string; worstSegment: string; hardestHour: string | null;
  comfortBySegment: { segment: string; comfort: string; reason: string }[];
  forecastSource: string; forecastModel: string;
}
interface TimelineResponse {
  source: string; computedAt: string; validUntil: string | null;
  summary: TimelineSummaryData; timeline: TimelineEntry[]; warnings: string[] | null;
}
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

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineDistanceNm(points: { lat: number; lon: number }[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineNm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  return Math.round(total * 10) / 10;
}

function projectWaypointFraction(points: { lat: number; lon: number }[], lat: number, lon: number) {
  if (points.length < 2) return null;

  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] + haversineNm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  const total = cumulative[cumulative.length - 1] || 0;
  if (total <= 0) return 0;

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestAlongTrack = 0;

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    const scale = Math.cos(((start.lat + end.lat) / 2) * Math.PI / 180);

    const ax = start.lon * scale;
    const ay = start.lat;
    const bx = end.lon * scale;
    const by = end.lat;
    const px = lon * scale;
    const py = lat;

    const abx = bx - ax;
    const aby = by - ay;
    const ab2 = abx * abx + aby * aby;
    const t = ab2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ab2)) : 0;
    const projX = ax + abx * t;
    const projY = ay + aby * t;
    const dist2 = (px - projX) ** 2 + (py - projY) ** 2;

    if (dist2 < bestDistance) {
      bestDistance = dist2;
      bestAlongTrack = cumulative[i - 1] + (cumulative[i] - cumulative[i - 1]) * t;
    }
  }

  return bestAlongTrack / total;
}

const DIFF_COLORS: Record<string, string> = { easy: "var(--text-green)", moderate: "var(--text-yellow)", challenging: "var(--text-red)", dangerous: "var(--text-red)" };
const MILESTONE_ICONS: Record<string, string> = { departure: "🚀", clear_breakwater: "⚓", course_change: "🧭", round_cape: "⚠️", approach: "🔭", berth: "🏁" };
const HAZARD_ICONS: Record<string, string> = { wind_acceleration: "💨", rock: "🪨", shoal: "⚠️", current: "🌊", traffic: "🚢", military: "🎖️", orca: "🐋" };

function comfortToken(label: string) {
  if (label === "Comfortable") return { fg: "var(--text-green)", bg: "var(--accent-go)" };
  if (label === "Moderate") return { fg: "var(--text-blue-light)", bg: "rgba(96,165,250,0.15)" };
  if (label === "Bumpy") return { fg: "var(--text-yellow)", bg: "var(--accent-caution)" };
  return { fg: "var(--text-red)", bg: "var(--accent-nogo)" };
}

function modeToken(mode: "sail" | "motor" | "motorsail") {
  if (mode === "sail") return { fg: "#86efac", bg: "rgba(34,197,94,0.12)", label: "⛵ Sail" };
  if (mode === "motorsail") return { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)", label: "⚙️ Motor-sail" };
  return { fg: "#93c5fd", bg: "rgba(59,130,246,0.14)", label: "🚢 Motor" };
}

function segmentAccent(name: string) {
  if (name.includes("rounding")) return { border: "#f97316", bg: "linear-gradient(90deg, rgba(249,115,22,0.10), rgba(15,23,42,0) 38%)" };
  if (name.startsWith("Departure")) return { border: "#38bdf8", bg: "linear-gradient(90deg, rgba(56,189,248,0.10), rgba(15,23,42,0) 38%)" };
  if (name.startsWith("Arrival")) return { border: "#4ade80", bg: "linear-gradient(90deg, rgba(74,222,128,0.10), rgba(15,23,42,0) 38%)" };
  return { border: "#64748b", bg: "linear-gradient(90deg, rgba(100,116,139,0.10), rgba(15,23,42,0) 38%)" };
}

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
  const [viewMode, setViewMode] = useState<"quick" | "full">("full");

  // Route editing state
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [routeDraft, setRouteDraft] = useState<{ lat: number; lon: number; label?: string }[]>([]);
  const [routeMode, setRouteMode] = useState<"auto" | "manual">("auto");
  const [resolvedRoutePoints, setResolvedRoutePoints] = useState<{ lat: number; lon: number }[] | null>(null);
  const [routeLoaded, setRouteLoaded] = useState(false);
  const [resolvedRouteDistanceNm, setResolvedRouteDistanceNm] = useState<number | null>(null);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);

  // Execution state
  interface ExecutionData { id: string; status: string; startedAt: string | null; endedAt: string | null; checkpoints: { type: string; title: string; recordedAt: string; note: string | null }[]; observations: { recordedAt: string; observedWindKt: number | null; observedWaveM: number | null; comfort: string | null; note: string | null }[]; }
  const [execution, setExecution] = useState<ExecutionData | null>(null);
  interface TideData { port: string; isSpring: boolean; range: number; stateAtDate: { rising: boolean; hoursToHW: number; hoursToLW: number; approxHeight: number; description: string }; extremes: { time: string; type: string; height: number }[]; stream: { area: string; floodDir: string; ebbDir: string; springRate: number; notes: string } | null; }
  const [depTide, setDepTide] = useState<TideData | null>(null);
  const [arrTide, setArrTide] = useState<TideData | null>(null);
  interface MarinaPrice { season: string; billingPeriod: string; price: number; currency: string; sourceName: string | null; confidence: string | null; }
  interface MapFeatureData { type: string; name: string; geometry: { type: string; coordinates: unknown }; description: string | null; }
  interface MarinaOptionData { id: string; name: string; slug: string; kind: string; lat: number; lon: number; phone: string | null; vhfCh: string | null; website: string | null; shelter: string | null; maxDraft: number | null; maxLength: number | null; berthCount: number | null; visitorBerths: number | null; fuel: boolean; water: boolean; electric: boolean; repairs: boolean; laundry: boolean; showers: boolean; toilets: boolean; wifi: boolean; customs: boolean; securityGate: boolean; pumpOut: boolean; approachDescription: string | null; notes: string | null; prices: MarinaPrice[]; mapFeatures: MapFeatureData[]; officialLayoutImageUrl: string | null; officialLayoutPdfUrl: string | null; }
  interface NearbyPlaceData { id: string; name: string; category: string; description: string | null; phone: string | null; hours: string | null; address: string | null; distanceMeters: number | null; walkMinutes: number | null; rating: number | null; reviewCount: number | null; priceLevel: string | null; isRecommended: boolean; bestFor: string | null; marinaOptionId: string | null; }
  interface PortAreaData { name: string; slug: string; marinas: MarinaOptionData[]; nearbyPlaces: NearbyPlaceData[]; }
  const [portArea, setPortArea] = useState<PortAreaData | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);

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
  const activeRoutePoints = resolvedRoutePoints && resolvedRoutePoints.length >= 2 ? resolvedRoutePoints : null;
  const resolvedLegDistanceNm = leg ? (resolvedRouteDistanceNm ?? leg.nm) : 0;
  const resolvedLegHours = passage && leg ? resolvedLegDistanceNm / passage.speed : 0;
  const resolvedDepartTime = leg?.departTime ?? null;
  const resolvedArriveTime = resolvedDepartTime
    ? new Date(resolvedDepartTime.getTime() + resolvedLegHours * 3600000)
    : null;

  // Fetch leg guide
  useEffect(() => {
    if (fromPort && dest) {
      fetch(`/api/leg?from=${fromPort.slug}&to=${dest.slug}`).then(r => r.json()).then(d => setGuide(d.guide)).catch(() => {});
    }
  }, [fromPort, dest]);

  // Fetch port area (marina options for arrival)
  useEffect(() => {
    if (dest) {
      fetch(`/api/port-areas?slug=${dest.slug}`).then(r => r.json()).then(d => { if (!d.error) setPortArea(d); }).catch(() => {});
    }
  }, [dest]);

  // Fetch forecasts
  useEffect(() => {
    if (!passage || !leg) return;
    const legWps = passage.waypoints.filter(w => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 && w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1);
    const wps = legWps.map(w => ({ name: w.port.name, lat: w.port.lat, lon: w.port.lon, isCape: w.isCape }));
    fetch("/api/forecast/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waypoints: wps, model: passage.model }) })
      .then(r => r.json()).then(data => { if (!data.error) setForecasts(data); }).catch(() => {});
  }, [passage, leg, dest, fromPort]);

  // Fetch tides — primitive deps only
  // Primitive deps for useEffects (prevent infinite re-runs from object refs)
  const fromSlug = fromPort?.slug || fromPort?.name || "";
  const destSlug = dest?.slug || dest?.name || "";
  const depTimeIso = leg?.departTime?.toISOString() || "";
  const arrTimeIso = leg?.arriveTime?.toISOString() || "";
  const passageDbId = passage?.id || "";
  useEffect(() => {
    if (!fromSlug || !destSlug || !depTimeIso || !arrTimeIso) return;
    const c = new AbortController();
    fetch(`/api/tides?port=${fromSlug}&date=${depTimeIso}`, { signal: c.signal }).then(r => r.json()).then(d => { if (!d.error) setDepTide(d); }).catch(() => {});
    fetch(`/api/tides?port=${destSlug}&date=${arrTimeIso}`, { signal: c.signal }).then(r => r.json()).then(d => { if (!d.error) setArrTide(d); }).catch(() => {});
    return () => c.abort();
  }, [fromSlug, destSlug, depTimeIso, arrTimeIso]);



  // Fetch route mode
  useEffect(() => {
    if (!fromSlug || !destSlug || !passage) return;
    const fp = fromPort!;
    const dp = dest!;
    const c = new AbortController();
    fetch(`/api/leg-route?passageId=${id}&legIndex=${legIndex}&fromName=${encodeURIComponent(fp.name)}&fromLat=${fp.lat}&fromLon=${fp.lon}&toName=${encodeURIComponent(dp.name)}&toLat=${dp.lat}&toLon=${dp.lon}`, { signal: c.signal })
      .then(r => r.json()).then(d => {
        if (d.mode) setRouteMode(d.mode);
        if (d.points?.length >= 2) {
          setResolvedRoutePoints(d.points);
          setResolvedRouteDistanceNm(d.distanceNm);
        } else {
          setResolvedRoutePoints(null);
          setResolvedRouteDistanceNm(null);
        }
        setRouteLoaded(true);
      }).catch(() => { setRouteLoaded(true); });
    return () => c.abort();
  }, [id, legIndex, fromSlug, destSlug]);

  // Fetch execution
  useEffect(() => {
    if (!passageDbId) return;
    const c = new AbortController();
    fetch(`/api/execution?passageId=${id}&legIndex=${legIndex}`, { signal: c.signal })
      .then(r => r.json()).then(d => { if (d.execution) setExecution(d.execution); }).catch(() => {});
    return () => c.abort();
  }, [passageDbId, id, legIndex]);

  // Route editing handlers
  function startRouteEditing() {
    setRouteDraft([]);
    setIsEditingRoute(true);
  }

  function addDraftPoint(lat: number, lon: number) {
    setRouteDraft((prev) => [...prev, { lat, lon }]);
  }

  function removeDraftPoint(index: number) {
    setRouteDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function undoDraftPoint() {
    setRouteDraft((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }

  async function handleSaveRoute() {
    if (routeDraft.length < 2) return;
    setIsSavingRoute(true);
    try {
      const response = await fetch("/api/leg-route", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passageId: id, legIndex, points: routeDraft }),
      });
      if (!response.ok) {
        throw new Error("Failed to save route");
      }

      const points = routeDraft.map(p => ({ lat: p.lat, lon: p.lon }));
      setResolvedRoutePoints(points);
      setResolvedRouteDistanceNm(polylineDistanceNm(points));
      setRouteMode("manual");
      setTimelineData(null);
      setIsEditingRoute(false);
      setRouteRefreshKey((prev) => prev + 1);
    } finally {
      setIsSavingRoute(false);
    }
  }

  async function handleResetRoute() {
    const response = await fetch(`/api/leg-route?passageId=${id}&legIndex=${legIndex}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Failed to reset route");
    }
    setRouteMode("auto");
    setResolvedRoutePoints(null);
    setResolvedRouteDistanceNm(null);
    setRouteDraft([]);
    setTimelineData(null);
    setIsEditingRoute(false);
    setRouteRefreshKey((prev) => prev + 1);
  }

  // Execution handlers
  async function handleStartExecution() {
    const res = await fetch("/api/execution", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", passageId: id, legIndex }),
    });
    const d = await res.json();
    if (d.execution) setExecution(d.execution);
  }

  async function handleStopExecution(status: string) {
    if (!execution) return;
    const res = await fetch("/api/execution", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", executionId: execution.id, status }),
    });
    const d = await res.json();
    if (d.execution) setExecution({ ...execution, ...d.execution });
  }

  async function handleAddCheckpoint(type: string, title: string) {
    if (!execution) return;
    await fetch("/api/execution", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkpoint", executionId: execution.id, type, title }),
    });
    // Refresh execution
    const res = await fetch(`/api/execution?passageId=${id}&legIndex=${legIndex}`);
    const d = await res.json();
    if (d.execution) setExecution(d.execution);
  }

  async function handleAddObservation(data: Record<string, unknown>) {
    if (!execution) return;
    await fetch("/api/execution", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "observation", executionId: execution.id, ...data }),
    });
    const res = await fetch(`/api/execution?passageId=${id}&legIndex=${legIndex}`);
    const d = await res.json();
    if (d.execution) setExecution(d.execution);
  }

  // Fetch webcams (with timeout + abort on unmount)
  useEffect(() => {
    if (!dest) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s max
    fetch(`/api/webcams?lat=${dest.lat}&lon=${dest.lon}&radius=25`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setWebcams(data); })
      .catch(() => {});
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [dest?.lat, dest?.lon]);

  // Fetch computed passage timeline
  useEffect(() => {
    if (!passage || !leg) return;
    fetch(`/api/leg-timeline?passageId=${passage.id}&legIndex=${legIndex}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setTimelineData(data); })
      .catch(() => {});
  }, [passage?.id, legIndex, leg?.from.port.slug, leg?.to.port.slug, routeMode, resolvedRouteDistanceNm, routeRefreshKey]);

  if (!passage) return <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  if (!leg || !dest || !fromPort) return <div className="p-8" style={{ color: "var(--text-red)" }}>Leg not found</div>;

  const fromTz = tzForPort(leg.from.port.lon);
  const toTz = tzForPort(leg.to.port.lon);
  const legWps = passage.waypoints.filter(w => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 && w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1);
  const capeWps = legWps.filter(w => w.isCape);

  // Decision
  function getETA(wp: Waypoint): Date {
    const manualFraction = activeRoutePoints
      ? projectWaypointFraction(activeRoutePoints, wp.port.lat, wp.port.lon)
      : null;
    const frac = manualFraction ?? ((wp.port.coastlineNm - leg.from.port.coastlineNm) / (leg.to.port.coastlineNm - leg.from.port.coastlineNm || 1));
    return new Date(leg.departTime.getTime() + frac * resolvedLegHours * 3600000);
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
  if (resolvedLegHours > 10) { legScore -= 10; penalties.push(`Long leg ${resolvedLegHours.toFixed(0)}h (-10)`); }
  if (resolvedLegHours > 14) { legScore -= 10; penalties.push(`Night sailing (-10)`); }
  if (guide?.difficulty === "challenging") { legScore -= 15; penalties.push("Challenging difficulty (-15)"); }
  else if (guide?.difficulty === "dangerous") { legScore -= 30; penalties.push("Dangerous difficulty (-30)"); }
  legScore = Math.max(0, Math.min(100, legScore));
  const scoreColor = legScore >= 80 ? "var(--text-green)" : legScore >= 50 ? "var(--text-yellow)" : "var(--text-red)";

  // ── Comfort scoring (separate from safety verdict) ──
  // GO doesn't mean comfortable. Comfortable doesn't mean GO.
  let comfortScore = 100;
  const comfortReasons: string[] = [];

  // Wave comfort
  if (maxWave > 2.5) { comfortScore -= 30; comfortReasons.push(`Waves ${maxWave.toFixed(1)}m — rough ride`); }
  else if (maxWave > 2.0) { comfortScore -= 20; comfortReasons.push(`Waves ${maxWave.toFixed(1)}m — bumpy`); }
  else if (maxWave > 1.5) { comfortScore -= 10; comfortReasons.push(`Waves ${maxWave.toFixed(1)}m — moderate motion`); }

  // Swell comfort
  if (maxSwell > 2.5) { comfortScore -= 15; comfortReasons.push(`Swell ${maxSwell.toFixed(1)}m — rolling motion`); }
  else if (maxSwell > 1.5) { comfortScore -= 5; comfortReasons.push(`Swell ${maxSwell.toFixed(1)}m — gentle roll`); }

  // Gustiness (spread between sustained and gusts)
  const gustSpread = maxGust - maxWind;
  if (gustSpread > 15) { comfortScore -= 15; comfortReasons.push(`Gusty (+${Math.round(gustSpread)}kt spread) — unpredictable`); }
  else if (gustSpread > 10) { comfortScore -= 8; comfortReasons.push(`Moderate gusts (+${Math.round(gustSpread)}kt)`); }

  // Cape rounding discomfort
  if (capeWps.length > 0) {
    comfortScore -= capeWps.length * 8;
    comfortReasons.push(`${capeWps.length} cape(s) — wind acceleration, confused seas`);
  }

  // Duration fatigue
  if (resolvedLegHours > 10) { comfortScore -= 12; comfortReasons.push(`Long leg (${resolvedLegHours.toFixed(0)}h) — crew fatigue`); }
  else if (resolvedLegHours > 7) { comfortScore -= 5; comfortReasons.push(`${resolvedLegHours.toFixed(0)}h passage`); }

  // Night sailing discomfort
  const arrHour = resolvedArriveTime?.getUTCHours() ?? leg.arriveTime.getUTCHours();
  if (arrHour >= 21 || arrHour <= 6) { comfortScore -= 15; comfortReasons.push("Night arrival — reduced visibility, cold"); }
  else if (arrHour >= 20) { comfortScore -= 5; comfortReasons.push("Dusk arrival"); }

  // Harbor entry complexity
  if (guide?.difficulty === "challenging") { comfortScore -= 10; comfortReasons.push("Complex passage — demanding navigation"); }
  if (dest.swellSensitivity?.toLowerCase().includes("medium") || dest.swellSensitivity?.toLowerCase().includes("high")) {
    comfortScore -= 5; comfortReasons.push("Swell-sensitive arrival entrance");
  }

  comfortScore = Math.max(0, Math.min(100, comfortScore));
  const comfortLabel = comfortScore >= 85 ? "Comfortable" : comfortScore >= 70 ? "Moderate" : comfortScore >= 55 ? "Bumpy" : comfortScore >= 40 ? "Demanding" : "Uncomfortable";
  const comfortColor = comfortScore >= 85 ? "var(--text-green)" : comfortScore >= 70 ? "var(--text-blue-light)" : comfortScore >= 55 ? "var(--text-yellow)" : "var(--text-red)";

  // Segment comfort (departure, offshore, cape, arrival)
  type SegComfort = { segment: string; comfort: string; color: string; reason: string };
  const segmentComfort: SegComfort[] = [];

  // Departure
  segmentComfort.push({ segment: "Departure", comfort: maxWind > 15 ? "Moderate" : "Comfortable", color: maxWind > 15 ? "var(--text-blue-light)" : "var(--text-green)", reason: maxWind > 15 ? "Motoring out in wind" : "Calm exit expected" });

  // Cape rounding
  for (const cape of capeWps) {
    const capeF = forecasts ? closestForecast(forecasts[cape.port.name] || [], getETA(cape)) : null;
    const capeWind = capeF?.windKt || 0;
    const capeWave = capeF?.waveM || 0;
    let cc = "Comfortable", cr = "Light conditions", ccol = "var(--text-green)";
    if (capeWind > 20 || capeWave > 2.5) { cc = "Demanding"; cr = `Wind ${Math.round(capeWind)}kt, waves ${capeWave.toFixed(1)}m + acceleration`; ccol = "var(--text-red)"; }
    else if (capeWind > 12 || capeWave > 1.5) { cc = "Bumpy"; cr = `Wind ${Math.round(capeWind)}kt + cape acceleration`; ccol = "var(--text-yellow)"; }
    segmentComfort.push({ segment: `${cape.port.name} rounding`, comfort: cc, color: ccol, reason: cr });
  }

  // Arrival
  const arrivalComfort = maxWave > 2 ? "Bumpy" : maxWave > 1 ? "Moderate" : "Comfortable";
  segmentComfort.push({ segment: `Arrival ${dest.name}`, comfort: arrivalComfort, color: maxWave > 2 ? "var(--text-yellow)" : maxWave > 1 ? "var(--text-blue-light)" : "var(--text-green)", reason: maxWave > 2 ? "Choppy approach" : maxWave > 1 ? "Some swell at entrance" : "Calm approach expected" });

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
          <span style={{ color: "var(--text-muted)" }}>{resolvedLegDistanceNm.toFixed(1)}NM · {Math.round(maxWind)}kt · {maxWave.toFixed(1)}m</span>
          <div className="flex rounded overflow-hidden text-[10px] no-print" style={{ border: `1px solid var(--border)` }}>
            <button onClick={() => setViewMode("quick")} className="px-2 py-0.5" style={{ background: viewMode === "quick" ? "var(--accent-go)" : "transparent", color: viewMode === "quick" ? "var(--text-green)" : "var(--text-muted)" }}>Quick</button>
            <button onClick={() => setViewMode("full")} className="px-2 py-0.5" style={{ background: viewMode === "full" ? "var(--accent-go)" : "transparent", color: viewMode === "full" ? "var(--text-green)" : "var(--text-muted)" }}>Full</button>
          </div>
          <button onClick={() => window.print()} className="px-2 py-0.5 rounded text-[10px] no-print" style={{ color: "var(--text-muted)", border: `1px solid var(--border)` }}>🖨️</button>
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
              <div>{resolvedLegDistanceNm.toFixed(1)} NM · ~{resolvedLegHours.toFixed(1)}h · {passage.speed}kt</div>
              <div>{fmtLocal(leg.departTime, fromTz)} → {resolvedArriveTime ? fmtLocal(resolvedArriveTime, toTz) : "—"}</div>
            </div>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <div><span style={{ color: "var(--text-muted)" }}>Wind</span> <strong>{Math.round(maxWind)}kt</strong></div>
            <div><span style={{ color: "var(--text-muted)" }}>Gusts</span> <strong>{Math.round(maxGust)}kt</strong></div>
            <div><span style={{ color: "var(--text-muted)" }}>Waves</span> <strong>{maxWave.toFixed(1)}m</strong></div>
            <div><span style={{ color: "var(--text-muted)" }}>Swell</span> <strong>{maxSwell.toFixed(1)}m</strong></div>
            <div className="flex items-center gap-1">
              <span style={{ color: "var(--text-muted)" }}>Comfort</span>
              <strong style={{ color: comfortColor }}>{comfortLabel}</strong>
            </div>
          </div>
        </div>

        {/* Decision details */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
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
            <div>🚢 Motor exit ~{Math.min(0.5, resolvedLegHours * 0.1).toFixed(1)}h</div>
            <div>⛵ Sailing ~{Math.max(0, resolvedLegHours - 1).toFixed(1)}h</div>
            <div>🚢 Motor entry ~{Math.min(0.5, resolvedLegHours * 0.1).toFixed(1)}h</div>
            {resolvedLegHours > 8 && <div style={{ color: "var(--text-yellow)" }}>🌙 Long day — {resolvedLegHours > 12 ? "night sailing likely" : "arrive before dark"}</div>}
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

          {/* Comfort & Crew */}
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)" }}>
            <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Comfort</div>
            <div className="font-semibold" style={{ color: comfortColor }}>{comfortLabel}</div>
            {segmentComfort.map((s, i) => (
              <div key={i} className="text-[10px] mt-0.5" style={{ color: s.color }}>{s.segment}: {s.comfort}</div>
            ))}
            {comfortReasons.length > 0 && (
              <details className="mt-1 text-[10px]">
                <summary className="cursor-pointer" style={{ color: "var(--text-muted)" }}>Why {comfortReasons.length} factor{comfortReasons.length > 1 ? "s" : ""} ▸</summary>
                <div className="mt-0.5 space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                  {comfortReasons.map((r, i) => <div key={i}>• {r}</div>)}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* Score breakdown (expandable) */}
        {penalties.length > 0 && (
          <details className="mt-2 text-[11px]">
            <summary className="cursor-pointer" style={{ color: "var(--text-muted)" }}>Score {legScore}/100 — tap for breakdown ▸</summary>
            <div className="mt-1 pl-3 space-y-0.5" style={{ color: "var(--text-secondary)" }}>
              {penalties.map((p, i) => <div key={i}>• {p}</div>)}
            </div>
          </details>
        )}

        {/* Last safe departure */}
        {resolvedLegHours > 5 && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            ⏰ <strong>Last safe departure:</strong>{" "}
            {fmtLocal(new Date(new Date(leg.departTime).setUTCHours(20, 0, 0, 0) - resolvedLegHours * 3600000), fromTz)} (arrive before sunset)
          </div>
        )}

        {/* What invalidates GO */}
        {verdict === "GO" && viewMode === "full" && (
          <div className="mt-2 text-[11px] rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>
            <strong>Plan invalidated if:</strong>{" "}
            wind &gt;{Math.round(maxWind) + 10}kt
            {capeWps.length > 0 && " · cape wind >15kt"}
            {" · waves >"}{(maxWave + 1).toFixed(0)}m
            {" · visibility <2NM"}
          </div>
        )}

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

      {/* ══════ MAP + ROUTE EDITING ══════ */}
      <div className="mb-3">
        {/* Route controls */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-t-xl text-xs" style={{ background: "var(--bg-card)", borderBottom: `1px solid var(--border-light)` }}>
          <div className="flex items-center gap-2">
            <span style={{ color: routeMode === "manual" ? "var(--text-yellow)" : "var(--text-muted)" }}>
              {routeMode === "manual"
                ? `🖊 Manual route${resolvedRouteDistanceNm ? ` (${resolvedRouteDistanceNm.toFixed(1)} NM)` : ""}`
                : `🤖 Auto route${resolvedRouteDistanceNm ? ` (${resolvedRouteDistanceNm.toFixed(1)} NM)` : ""}`}
            </span>
          </div>
          <div className="flex items-center gap-1 no-print">
            {!isEditingRoute ? (
              <>
                <button onClick={startRouteEditing} className="px-2 py-1 rounded" style={{ color: "var(--text-blue-light)", border: `1px solid var(--border)` }}>
                  Modify Route
                </button>
                {routeMode === "manual" && (
                  <button onClick={handleResetRoute} className="px-2 py-1 rounded" style={{ color: "var(--text-muted)", border: `1px solid var(--border)` }}>
                    Reset to Auto
                  </button>
                )}
              </>
            ) : (
              <>
                <span style={{ color: "var(--text-muted)" }}>{routeDraft.length} pts</span>
                <button onClick={undoDraftPoint} disabled={routeDraft.length === 0} className="px-2 py-1 rounded" style={{ color: "var(--text-muted)", border: `1px solid var(--border)` }}>Undo</button>
                <button onClick={() => setRouteDraft([])} disabled={routeDraft.length === 0} className="px-2 py-1 rounded" style={{ color: "var(--text-red)", border: `1px solid var(--border)` }}>Erase</button>
                <button onClick={() => { setIsEditingRoute(false); setRouteDraft([]); }} className="px-2 py-1 rounded" style={{ color: "var(--text-muted)", border: `1px solid var(--border)` }}>Cancel</button>
                <button onClick={handleSaveRoute} disabled={isSavingRoute || routeDraft.length < 2} className="px-2 py-1 rounded font-semibold" style={{ color: routeDraft.length < 2 ? "var(--text-muted)" : "var(--text-green)", background: routeDraft.length < 2 ? "transparent" : "var(--accent-go)", border: `1px solid ${routeDraft.length < 2 ? "var(--border)" : "var(--text-green)30"}` }}>
                  {isSavingRoute ? "Saving..." : `Save (${routeDraft.length} pts)`}
                </button>
              </>
            )}
          </div>
        </div>
        {isEditingRoute && (
          <div className="px-3 py-1.5 text-[11px]" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>
            Click on the map to add route points in order. Click any existing point to remove it.
          </div>
        )}
        <div className="rounded-b-xl overflow-hidden" style={{ border: `1px solid var(--border-light)`, borderTop: "none", height: 400 }}>
          <LegMap
            waypoints={legWps} fromPort={fromPort} toPort={dest} theme={theme}
            hazards={hazards} milestones={milestones}
            isEditing={isEditingRoute}
            routeDraft={routeDraft}
            onMapClick={isEditingRoute ? addDraftPoint : undefined}
            onRemovePoint={isEditingRoute ? removeDraftPoint : undefined}
            manualRoutePoints={!isEditingRoute ? resolvedRoutePoints : null}
            hideRoute={!routeLoaded && !isEditingRoute}
          />
        </div>
      </div>

      {/* ══════ WINDY FORECAST MAP ══════ */}
      <Section title="Live Wind & Waves" icon="💨" defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Wind</div>
            <iframe
              src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricWind=kt&zoom=8&overlay=wind&product=gfs&level=surface&lat=${((fromPort.lat + dest.lat) / 2).toFixed(2)}&lon=${((fromPort.lon + dest.lon) / 2).toFixed(2)}&message=true`}
              className="w-full rounded-lg" style={{ height: 280, border: "none" }}
              loading="lazy"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Waves</div>
            <iframe
              src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricWind=kt&zoom=8&overlay=waves&product=gfs&level=surface&lat=${((fromPort.lat + dest.lat) / 2).toFixed(2)}&lon=${((fromPort.lon + dest.lon) / 2).toFixed(2)}&message=true`}
              className="w-full rounded-lg" style={{ height: 280, border: "none" }}
              loading="lazy"
            />
          </div>
        </div>
        <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Powered by Windy.com — interactive forecast. Scroll/zoom to explore.</div>
      </Section>

      {/* ══════ PASSAGE TIMELINE ══════ */}
      {timelineData?.summary && timelineData.timeline?.length > 0 && (
        <Section title={`Passage Timeline (${timelineData.timeline.length}h)`} icon="⏱️">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 text-xs">
            <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
              <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Mode</div>
              <div className="font-semibold" style={{ color: "var(--text-heading)" }}>{timelineData.summary.dominantMode}</div>
              <div style={{ color: "var(--text-secondary)" }}>⛵ {timelineData.summary.sailHours}h · 🚢 {timelineData.summary.motorHours}h · ⚙️ {timelineData.summary.motorsailHours}h</div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
              <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Performance</div>
              <div className="font-semibold" style={{ color: "var(--text-heading)" }}>{timelineData.summary.averageSogKt.toFixed(1)}kt avg SOG</div>
              <div style={{ color: "var(--text-secondary)" }}>ETA {fmtLocal(new Date(timelineData.summary.estimatedArrival), toTz)}</div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
              <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Comfort</div>
              <div className="font-semibold" style={{ color: comfortColor }}>{timelineData.summary.overallComfort}</div>
              <div style={{ color: "var(--text-secondary)" }}>Worst: {timelineData.summary.worstSegment}</div>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
              <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Forecast basis</div>
              <div className="font-semibold" style={{ color: "var(--text-heading)" }}>{timelineData.summary.forecastModel}</div>
              <div style={{ color: "var(--text-secondary)" }}>Updated {fmtLocal(new Date(timelineData.computedAt), toTz)}</div>
            </div>
          </div>

          {timelineData.summary.comfortBySegment?.length > 0 && (
            <div className="rounded-lg px-3 py-2 mb-3" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
              <div className="text-[10px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>Segment comfort</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {timelineData.summary.comfortBySegment.map((segment, index) => (
                  <div key={index} className="rounded-md px-2 py-1.5" style={{ background: "var(--bg-card)" }}>
                    <div className="font-semibold" style={{ color: "var(--text-heading)" }}>{segment.segment}</div>
                    <div style={{ color: segment.comfort === "Comfortable" ? "var(--text-green)" : segment.comfort === "Moderate" ? "var(--text-blue-light)" : segment.comfort === "Bumpy" ? "var(--text-yellow)" : "var(--text-red)" }}>
                      {segment.comfort}
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>{segment.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {timelineData.warnings && timelineData.warnings.length > 0 && (
            <div className="rounded-lg px-3 py-2 mb-3 text-xs" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>
              <strong>Likely complications:</strong> {timelineData.warnings.join(" · ")}
            </div>
          )}

          <div className="space-y-2">
            {timelineData.timeline.map((entry) => (
              <div
                key={entry.hourIndex}
                className="rounded-lg px-3 py-2"
                style={{
                  background: segmentAccent(entry.segmentName).bg,
                  border: `1px solid var(--border-light)`,
                  boxShadow: `inset 3px 0 0 ${segmentAccent(entry.segmentName).border}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-xs" style={{ color: "var(--text-heading)" }}>
                      {fmtLocal(new Date(entry.time), toTz)} · {entry.segmentName}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {entry.distanceFromStartNm.toFixed(1)}NM run · {entry.distanceToGoNm.toFixed(1)}NM to go
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: modeToken(entry.mode).bg, color: modeToken(entry.mode).fg }}>
                      {modeToken(entry.mode).label}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: comfortToken(entry.comfort).bg, color: comfortToken(entry.comfort).fg }}>
                      {entry.comfort}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2 text-[11px]">
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Weather</div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {Math.round(entry.windKt)}kt {entry.windDir}, gust {Math.round(entry.gustKt)}kt
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      Waves {entry.waveM?.toFixed(1) ?? "—"}m / {entry.wavePeriodS?.toFixed(1) ?? "—"}s
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      Swell {entry.swellM?.toFixed(1) ?? "—"}m / {entry.swellPeriodS?.toFixed(1) ?? "—"}s
                    </div>
                    {(() => {
                      const wp = entry.waveM != null && entry.wavePeriodS != null ? Math.round(0.5 * entry.waveM * entry.waveM * entry.wavePeriodS * 10) / 10 : null;
                      return wp != null ? (
                        <div style={{ color: wp >= 30 ? "var(--text-red)" : wp >= 15 ? "var(--text-yellow)" : wp >= 5 ? "var(--text-blue-light)" : "var(--text-green)", fontWeight: wp >= 15 ? 700 : 400 }}>
                          ⚡ {wp} kW/m {wp >= 30 ? "SEVERE" : wp >= 15 ? "ROUGH" : wp >= 5 ? "moderate" : "calm"}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Boat mode</div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {entry.mode === "motor" ? "Motor" : entry.mode === "motorsail" ? "Motor-sail" : "Sail"} · {entry.pointOfSail}
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {entry.tack !== "none" ? `${entry.tack} tack` : "No tack"} · COG {entry.courseTrue}°
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Sails & speed</div>
                    <div style={{ color: "var(--text-secondary)" }}>{entry.sailConfig}</div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      BSP {entry.expectedBoatSpeedKt.toFixed(1)}kt · SOG {entry.expectedSogKt.toFixed(1)}kt
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)" }}>Current & angle</div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {entry.currentDir ? `${entry.currentDir} ${entry.currentKt.toFixed(1)}kt` : "Current negligible"}
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>TWA {entry.twa}°</div>
                  </div>
                </div>

                <div className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>{entry.notes}</div>
                {entry.warnings.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.warnings.map((warning, index) => (
                      <span key={index} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(234,179,8,0.10)", color: "var(--text-yellow)", border: `1px solid rgba(234,179,8,0.18)` }}>
                        {warning}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
            Computed using Bossanova heuristics: engine cruise 6.2kt, rule-based sail plan, cached until {timelineData.validUntil ? fmtLocal(new Date(timelineData.validUntil), toTz) : "forecast refresh"}.
          </div>
        </Section>
      )}

      {/* ══════ PILOTAGE ══════ (Full mode only) */}
      {viewMode === "full" && guide?.pilotageText && (
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
                    return Math.abs(t.getTime() - (resolvedArriveTime?.getTime() ?? leg.arriveTime.getTime())) < 12 * 3600000;
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

          {/* Arrival intelligence */}
          {(dest.entranceNotes || dest.waitingArea || dest.bestTideEntry || dest.swellSensitivity) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs">
              {dest.entranceNotes && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}><div className="text-[10px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Entrance</div><div style={{ color: "var(--text-secondary)" }}>{dest.entranceNotes}</div></div>}
              {dest.waitingArea && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}><div className="text-[10px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Waiting area</div><div style={{ color: "var(--text-secondary)" }}>{dest.waitingArea}</div></div>}
              {dest.bestTideEntry && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}><div className="text-[10px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Best tide to enter</div><div style={{ color: "var(--text-secondary)" }}>{dest.bestTideEntry}</div></div>}
              {dest.swellSensitivity && <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}><div className="text-[10px] uppercase mb-0.5" style={{ color: "var(--text-muted)" }}>Swell sensitivity</div><div style={{ color: "var(--text-secondary)" }}>{dest.swellSensitivity}</div></div>}
            </div>
          )}

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

      {/* ══════ MARINA OPTIONS ══════ */}
      {portArea && portArea.marinas.length > 0 && (
        <Section title={`Marina Options at ${portArea.name} (${portArea.marinas.length})`} icon="⚓" defaultOpen={portArea.marinas.length > 1}>
          {/* Comparison table if >1 marina */}
          {portArea.marinas.length > 1 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="text-left px-2 py-1.5">Marina</th>
                    <th className="text-center px-2 py-1.5">Berths</th>
                    <th className="text-center px-2 py-1.5">Visitor</th>
                    <th className="text-center px-2 py-1.5">Draft</th>
                    <th className="text-center px-2 py-1.5">Fuel</th>
                    <th className="text-center px-2 py-1.5">Repairs</th>
                    <th className="text-center px-2 py-1.5">Daily €</th>
                    <th className="text-center px-2 py-1.5">Monthly €</th>
                  </tr>
                </thead>
                <tbody>
                  {portArea.marinas.map(m => {
                    const dayLow = m.prices.find(p => p.season === "low" && p.billingPeriod === "daily");
                    const monthLow = m.prices.find(p => p.season === "low" && p.billingPeriod === "monthly");
                    return (
                      <tr key={m.id} style={{ borderBottom: `1px solid var(--border-light)` }}>
                        <td className="px-2 py-1.5 font-semibold" style={{ color: "var(--text-heading)" }}>{m.name}</td>
                        <td className="text-center px-2 py-1.5">{m.berthCount || "?"}</td>
                        <td className="text-center px-2 py-1.5">{m.visitorBerths || "?"}</td>
                        <td className="text-center px-2 py-1.5">{m.maxDraft ? `${m.maxDraft}m` : "?"}</td>
                        <td className="text-center px-2 py-1.5">{m.fuel ? "✓" : "—"}</td>
                        <td className="text-center px-2 py-1.5">{m.repairs ? "✓" : "—"}</td>
                        <td className="text-center px-2 py-1.5" style={{ color: "var(--text-green)" }}>{dayLow ? `€${dayLow.price}` : "—"}</td>
                        <td className="text-center px-2 py-1.5">{monthLow ? `€${monthLow.price}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Marina cards */}
          {portArea.marinas.map(m => (
            <div key={m.id} className="rounded-lg px-3 py-2.5 mb-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs" style={{ color: "var(--text-heading)" }}>{m.name}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.kind.replace("_", " ")} · {m.berthCount || "?"} berths</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] mb-1" style={{ color: "var(--text-secondary)" }}>
                {m.phone && <a href={`tel:${m.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>📞 {m.phone}</a>}
                {m.vhfCh && <span>📻 VHF {m.vhfCh}</span>}
                {m.shelter && <span>🛡️ <span style={{ color: m.shelter === "good" ? "var(--text-green)" : "var(--text-yellow)" }}>{m.shelter.toUpperCase()}</span></span>}
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] mb-1">
                {m.fuel && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Fuel</span>}
                {m.water && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Water</span>}
                {m.electric && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Electric</span>}
                {m.repairs && <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Repairs</span>}
                {m.showers && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Showers</span>}
                {m.laundry && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Laundry</span>}
                {m.wifi && <span className="px-1.5 py-0.5 rounded" style={{ border: `1px solid var(--border-light)` }}>Wi-Fi</span>}
              </div>
              {m.prices.length > 0 ? (
                <div className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  💰 {m.prices.filter(p => p.billingPeriod === "daily").map(p => `€${p.price}/${p.season}`).join(", ")}
                  {m.prices.some(p => p.billingPeriod === "monthly") && ` · Monthly: ${m.prices.filter(p => p.billingPeriod === "monthly").map(p => `€${p.price}/${p.season}`).join(", ")}`}
                </div>
              ) : (
                <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>No verified tariff yet</div>
              )}
              {m.notes && <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{m.notes}</div>}
              {/* Mini-map */}
              {m.mapFeatures && m.mapFeatures.length > 0 && (
                <div className="mt-2">
                  <MarinaMiniMap features={m.mapFeatures} center={[m.lat, m.lon]} name={m.name} />
                </div>
              )}
              {/* Official layout */}
              {m.officialLayoutImageUrl && (
                <div className="mt-2">
                  <a href={m.officialLayoutImageUrl} target="_blank" rel="noopener">
                    <img src={m.officialLayoutImageUrl} alt={`${m.name} layout`} className="w-full rounded" style={{ maxHeight: 200, objectFit: "contain", border: `1px solid var(--border-light)` }} />
                  </a>
                </div>
              )}
            </div>
          ))}

          <Link href={`/port/${portArea.slug}`} className="text-xs hover:opacity-80 mt-1 inline-block" style={{ color: "var(--text-blue-light)" }}>
            View full port details →
          </Link>
        </Section>
      )}

      {/* ══════ SHORE SERVICES (NearbyPlace) ══════ (Full mode only) */}
      {viewMode === "full" && portArea?.nearbyPlaces && portArea.nearbyPlaces.length > 0 && (() => {
        const CATS: Record<string, { icon: string; label: string }> = {
          restaurant: { icon: "🍽️", label: "Restaurants" }, chandlery: { icon: "⛵", label: "Chandlery" },
          grocery: { icon: "🛒", label: "Grocery" }, market: { icon: "🏪", label: "Markets" },
          pharmacy: { icon: "💊", label: "Pharmacy" }, laundry: { icon: "👕", label: "Laundry" },
          atm: { icon: "🏧", label: "ATM" }, hospital: { icon: "🏥", label: "Hospital" },
        };
        return [...new Set(portArea.nearbyPlaces.map(p => p.category))].map(cat => {
          const places = portArea.nearbyPlaces.filter(p => p.category === cat);
          const m = CATS[cat] || { icon: "📍", label: cat };
          return (
            <Section key={cat} title={`${m.label} (${places.length})`} icon={m.icon} defaultOpen={cat === "restaurant"}>
              {places.map(p => (
                <div key={p.id} className="rounded-lg px-3 py-2 mb-1.5" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs" style={{ color: "var(--text-heading)" }}>{p.name}</span>
                      {p.isRecommended && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Recommended</span>}
                    </div>
                    {p.rating && <span className="text-[11px]" style={{ color: "var(--text-yellow)" }}>★ {p.rating}{p.reviewCount ? ` (${p.reviewCount})` : ""}</span>}
                  </div>
                  {p.description && <div className="text-[11px] mb-0.5" style={{ color: "var(--text-muted)" }}>{p.description}</div>}
                  <div className="flex flex-wrap gap-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {(p.distanceMeters || p.walkMinutes) && <span>🚶 {p.distanceMeters ? `${p.distanceMeters}m` : ""}{p.distanceMeters && p.walkMinutes ? " · " : ""}{p.walkMinutes ? `${p.walkMinutes} min` : ""}</span>}
                    {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>📞 {p.phone}</a>}
                    {p.hours && <span>🕐 {p.hours}</span>}
                  </div>
                </div>
              ))}
            </Section>
          );
        });
      })()}

      {/* Fallback: old JSON data if no NearbyPlace */}
      {viewMode === "full" && (!portArea?.nearbyPlaces?.length) && restaurants.length > 0 && (
        <Section title={`Restaurants (${restaurants.length})`} icon="🍽️">{restaurants.map((r, i) => <PlaceCard key={i} place={r} />)}</Section>
      )}
      {viewMode === "full" && (!portArea?.nearbyPlaces?.length) && yachtShops.length > 0 && (
        <Section title={`Yacht & Marine (${yachtShops.length})`} icon="⛵">{yachtShops.map((s, i) => <PlaceCard key={i} place={s} />)}</Section>
      )}
      {viewMode === "full" && (!portArea?.nearbyPlaces?.length) && groceryStores.length > 0 && (
        <Section title={`Provisioning (${groceryStores.length})`} icon="🛒">{groceryStores.map((s, i) => <PlaceCard key={i} place={s} />)}</Section>
      )}

      {/* ══════ WEBCAMS ══════ (Full mode only) */}
      {viewMode === "full" && webcams.length > 0 && (
        <Section title={`Live Webcams (${webcams.length})`} icon="📹">
          <div className="grid grid-cols-2 gap-2">
            {webcams.map(wc => (
              <a key={wc.id} href={wc.playerUrl} target="_blank" rel="noopener" className="block rounded-lg overflow-hidden hover:opacity-80" style={{ border: `1px solid var(--border-light)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {wc.preview && <img src={wc.preview} alt={wc.title} className="w-full object-cover" style={{ height: 180 }} />}
                <div className="px-2 py-1.5 text-[11px]" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>{wc.title}</div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* ══════ EXECUTION & LOGBOOK ══════ */}
      <Section title="Live Passage" icon="🚢">
        {!execution || execution.status === "planned" ? (
          <div className="text-center py-4">
            <button onClick={handleStartExecution} className="px-4 py-2 rounded-lg font-semibold text-sm" style={{ background: "var(--accent-go)", color: "var(--text-green)", border: `1px solid var(--text-green)30` }}>
              ▶ Start Passage
            </button>
            <div className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Begin live tracking for this leg</div>
          </div>
        ) : execution.status === "active" ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>ACTIVE</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Started: {execution.startedAt ? new Date(execution.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "?"}</span>
              </div>
              <button onClick={() => handleStopExecution("completed")} className="px-3 py-1 rounded text-xs font-semibold" style={{ color: "var(--text-red)", border: `1px solid var(--text-red)30` }}>
                ⏹ End Passage
              </button>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <button onClick={() => handleAddCheckpoint("departure", "Departed")} className="px-3 py-2.5 rounded-lg text-xs touch-manipulation" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🚀 Departure</button>
              <button onClick={() => handleAddCheckpoint("cape", "Cape rounded")} className="px-3 py-2.5 rounded-lg text-xs touch-manipulation" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>⚡ Cape</button>
              <button onClick={() => handleAddCheckpoint("reef_in", "Reefed")} className="px-3 py-2.5 rounded-lg text-xs touch-manipulation" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🪢 Reef In</button>
              <button onClick={() => handleAddCheckpoint("arrival", "Arrived")} className="px-3 py-2.5 rounded-lg text-xs touch-manipulation" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🏁 Arrival</button>
            </div>

            {/* Add observation form */}
            <details className="mb-3">
              <summary className="text-xs cursor-pointer" style={{ color: "var(--text-blue-light)" }}>+ Add Observation</summary>
              <div className="mt-2 space-y-2">
                <div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Comfort level</div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { val: "comfortable", color: "var(--text-green)" },
                    { val: "moderate", color: "var(--text-blue-light)" },
                    { val: "bumpy", color: "var(--text-yellow)" },
                    { val: "demanding", color: "var(--text-red)" },
                    { val: "hard_work", color: "var(--text-red)" },
                  ].map(c => (
                    <button key={c.val} onClick={() => handleAddObservation({ comfort: c.val })} className="px-2 py-1 rounded text-[11px] capitalize" style={{ color: c.color, border: `1px solid ${c.color}30` }}>
                      {c.val.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] uppercase mt-2" style={{ color: "var(--text-muted)" }}>Quick conditions</div>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => handleAddObservation({ note: "Calm, flat seas" })} className="px-2 py-1 rounded text-[11px]" style={{ border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🌊 Calm</button>
                  <button onClick={() => handleAddObservation({ note: "Choppy" })} className="px-2 py-1 rounded text-[11px]" style={{ border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🌊 Choppy</button>
                  <button onClick={() => handleAddObservation({ note: "Rough seas" })} className="px-2 py-1 rounded text-[11px]" style={{ border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🌊 Rough</button>
                  <button onClick={() => handleAddObservation({ note: "Motoring" })} className="px-2 py-1 rounded text-[11px]" style={{ border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🚢 Motor</button>
                  <button onClick={() => handleAddObservation({ note: "Sailing well" })} className="px-2 py-1 rounded text-[11px]" style={{ border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>⛵ Sailing</button>
                  <button onClick={() => handleAddObservation({ note: "Reefed" })} className="px-2 py-1 rounded text-[11px]" style={{ border: `1px solid var(--border-light)`, color: "var(--text-secondary)" }}>🪢 Reefed</button>
                </div>
              </div>
            </details>

            {/* Recent events */}
            {execution.checkpoints.length > 0 && (
              <div className="text-xs space-y-1 mb-2" style={{ color: "var(--text-secondary)" }}>
                <div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Checkpoints</div>
                {execution.checkpoints.slice(-5).map((cp, i) => (
                  <div key={i}>{new Date(cp.recordedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — {cp.title}</div>
                ))}
              </div>
            )}
            {execution.observations.length > 0 && (
              <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                <div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Observations</div>
                {execution.observations.slice(-3).map((ob, i) => (
                  <div key={i}>{new Date(ob.recordedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — {ob.comfort ? `Comfort: ${ob.comfort}` : ""}{ob.observedWindKt ? ` Wind: ${ob.observedWindKt}kt` : ""}{ob.note ? ` — ${ob.note}` : ""}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Completed/aborted */
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: execution.status === "completed" ? "var(--accent-go)" : "var(--accent-nogo)", color: execution.status === "completed" ? "var(--text-green)" : "var(--text-red)" }}>{execution.status.toUpperCase()}</span>
              {execution.startedAt && execution.endedAt && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(execution.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} → {new Date(execution.endedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            {/* Log summary */}
            {execution.checkpoints.length > 0 && (
              <div className="text-xs space-y-1 mb-2" style={{ color: "var(--text-secondary)" }}>
                <div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Passage Log</div>
                {execution.checkpoints.map((cp, i) => (
                  <div key={i}>{new Date(cp.recordedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — <strong>{cp.title}</strong>{cp.note ? ` — ${cp.note}` : ""}</div>
                ))}
              </div>
            )}
            {execution.observations.length > 0 && (
              <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                <div className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>Observations</div>
                {execution.observations.map((ob, i) => (
                  <div key={i}>{new Date(ob.recordedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — {ob.comfort ? `${ob.comfort}` : ""}{ob.observedWindKt ? ` · ${ob.observedWindKt}kt` : ""}{ob.observedWaveM ? ` · ${ob.observedWaveM}m` : ""}{ob.note ? ` — ${ob.note}` : ""}</div>
                ))}
              </div>
            )}
            {/* Planned vs Actual comparison */}
            {execution.startedAt && (
              <div className="mt-3 rounded-lg p-3" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
                <div className="text-[10px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>Planned vs Actual</div>
                <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <div></div>
                  <div className="text-center font-semibold" style={{ color: "var(--text-muted)" }}>Planned</div>
                  <div className="text-center font-semibold" style={{ color: "var(--text-muted)" }}>Actual</div>

                  <div style={{ color: "var(--text-muted)" }}>Departure</div>
                  <div className="text-center">{fmtLocal(leg.departTime, fromTz)}</div>
                  <div className="text-center" style={{ color: "var(--text-blue-light)" }}>{new Date(execution.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: fromTz })}</div>

                  <div style={{ color: "var(--text-muted)" }}>Arrival</div>
                  <div className="text-center">{resolvedArriveTime ? fmtLocal(resolvedArriveTime, toTz) : "—"}</div>
                  <div className="text-center" style={{ color: execution.endedAt ? "var(--text-blue-light)" : "var(--text-muted)" }}>
                    {execution.endedAt ? new Date(execution.endedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: toTz }) : "—"}
                  </div>

                  <div style={{ color: "var(--text-muted)" }}>Duration</div>
                  <div className="text-center">{resolvedLegHours.toFixed(1)}h</div>
                  <div className="text-center" style={{ color: "var(--text-blue-light)" }}>
                    {execution.endedAt ? ((new Date(execution.endedAt).getTime() - new Date(execution.startedAt).getTime()) / 3600000).toFixed(1) + "h" : "ongoing"}
                  </div>

                  <div style={{ color: "var(--text-muted)" }}>Comfort</div>
                  <div className="text-center" style={{ color: comfortColor }}>{comfortLabel}</div>
                  <div className="text-center" style={{ color: "var(--text-blue-light)" }}>
                    {execution.observations.filter(o => o.comfort).length > 0
                      ? execution.observations.filter(o => o.comfort).slice(-1)[0]?.comfort?.replace("_", " ") || "—"
                      : "—"}
                  </div>

                  <div style={{ color: "var(--text-muted)" }}>Wind (max)</div>
                  <div className="text-center">{Math.round(maxWind)}kt</div>
                  <div className="text-center" style={{ color: "var(--text-blue-light)" }}>
                    {execution.observations.filter(o => o.observedWindKt).length > 0
                      ? Math.round(Math.max(...execution.observations.filter(o => o.observedWindKt).map(o => o.observedWindKt!))) + "kt"
                      : "—"}
                  </div>

                  <div style={{ color: "var(--text-muted)" }}>Waves (max)</div>
                  <div className="text-center">{maxWave.toFixed(1)}m</div>
                  <div className="text-center" style={{ color: "var(--text-blue-light)" }}>
                    {execution.observations.filter(o => o.observedWaveM).length > 0
                      ? Math.max(...execution.observations.filter(o => o.observedWaveM).map(o => o.observedWaveM!)).toFixed(1) + "m"
                      : "—"}
                  </div>
                </div>

                {/* Delta highlights */}
                {execution.endedAt && (() => {
                  const actualH = (new Date(execution.endedAt).getTime() - new Date(execution.startedAt).getTime()) / 3600000;
                  const delta = actualH - resolvedLegHours;
                  return Math.abs(delta) > 0.5 ? (
                    <div className="mt-2 text-[11px]" style={{ color: delta > 0 ? "var(--text-yellow)" : "var(--text-green)" }}>
                      {delta > 0 ? `⏰ +${delta.toFixed(1)}h slower than planned` : `⚡ ${Math.abs(delta).toFixed(1)}h faster than planned`}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <button onClick={handleStartExecution} className="mt-2 px-3 py-1 rounded text-xs" style={{ color: "var(--text-blue-light)", border: `1px solid var(--border)` }}>▶ Start New Passage</button>
          </div>
        )}
      </Section>

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
