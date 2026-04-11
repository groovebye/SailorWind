"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/theme";

interface Port {
  id: string; name: string; slug: string; lat: number; lon: number; type: string;
  coastlineNm: number; fuel: boolean; water: boolean; electric: boolean;
  repairs: boolean; customs: boolean; shelter: string | null; maxDraft: number | null;
  vhfCh: string | null; website: string | null; phone: string | null; email: string | null;
  notes: string | null; country: string; region: string | null;
  marinaName: string | null; marinaHours: string | null;
  berthCount: number | null; visitorBerths: number | null; maxLength: number | null;
  accessCodes: string | null; approachNotes: string | null; approachDescription: string | null;
  restaurants: PlaceInfo[] | null; yachtShops: PlaceInfo[] | null; groceryStores: PlaceInfo[] | null;
  orcaRisk: string | null; orcaNotes: string | null;
  passageNotes: string | null;
}
interface PlaceInfo { name: string; rating?: number; cuisine?: string; phone?: string; hours?: string; address?: string; description?: string; }
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface Passage {
  id: string; shortId: string; name: string | null;
  departure: string; speed: number; mode: string; model: string;
  waypoints: Waypoint[];
}
interface Webcam { id: string; title: string; lat: number; lon: number; city: string; preview: string; thumbnail: string; playerUrl: string; }

function tzForPort(lon: number): string {
  if (lon >= -10 && lon <= 3) return "Europe/Madrid";
  if (lon > 3 && lon <= 15) return "Europe/Rome";
  return "UTC";
}
function fmtLocal(d: Date, tz: string) {
  const s = d.toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  return s.replace(" at ", " ");
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid var(--border-light)` }}>
      <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 select-none font-semibold text-sm" style={{ background: "var(--bg-card)", color: "var(--text-heading)" }}>
        <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        {title}
      </summary>
      <div className="px-4 py-3" style={{ background: "var(--bg-card)" }}>{children}</div>
    </details>
  );
}

function PlaceCard({ place, type }: { place: PlaceInfo; type: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5 mb-2" style={{ background: "var(--bg-primary)", border: `1px solid var(--border-light)` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm" style={{ color: "var(--text-heading)" }}>{place.name}</span>
        {place.rating && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>
            &#9733; {place.rating}
          </span>
        )}
      </div>
      {place.cuisine && <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{place.cuisine}</div>}
      {place.description && <div className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{place.description}</div>}
      <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {place.phone && <a href={`tel:${place.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>&#128222; {place.phone}</a>}
        {place.hours && <span>&#128339; {place.hours}</span>}
        {place.address && <span>&#128205; {place.address}</span>}
      </div>
    </div>
  );
}

export default function LegDetailPage({ params }: { params: Promise<{ id: string; legIndex: string }> }) {
  const { id, legIndex: legIndexStr } = use(params);
  const legIndex = parseInt(legIndexStr, 10);
  const { theme } = useTheme();
  const [passage, setPassage] = useState<Passage | null>(null);
  const [webcams, setWebcams] = useState<Webcam[]>([]);

  useEffect(() => {
    fetch(`/api/passage?id=${id}`).then(r => r.json()).then(setPassage);
  }, [id]);

  // Compute legs from passage data
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
        const nextDay = new Date(arriveTime);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        nextDay.setUTCHours(depHour, 0, 0, 0);
        if (nextDay.getTime() < arriveTime.getTime()) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        currentTime = nextDay.getTime();
      } else {
        currentTime = arriveTime.getTime();
      }
    }
  }

  const leg = legs[legIndex] || null;
  const dest = leg?.to.port || null;

  // Fetch webcams for destination — MUST be before any early return
  useEffect(() => {
    if (dest) {
      fetch(`/api/webcams?lat=${dest.lat}&lon=${dest.lon}&radius=25`)
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setWebcams(data); })
        .catch(() => {});
    }
  }, [dest?.lat, dest?.lon]);

  if (!passage) return <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Loading...</div>;
  if (!leg) return <div className="p-8" style={{ color: "var(--text-red)" }}>Leg {legIndex} not found</div>;

  const fromTz = tzForPort(leg.from.port.lon);
  const toTz = tzForPort(leg.to.port.lon);

  // Get all waypoints in this leg
  const legWps = passage.waypoints.filter(
    w => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
         w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
  );
  const capeWps = legWps.filter(w => w.isCape);

  // Parse JSON fields safely
  const parseJson = (val: unknown): PlaceInfo[] => {
    if (!val) return [];
    if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
    if (Array.isArray(val)) return val;
    return [];
  };

  const restaurants = parseJson(dest.restaurants);
  const yachtShops = parseJson(dest.yachtShops);
  const groceryStores = parseJson(dest.groceryStores);

  return (
    <div className="max-w-3xl mx-auto px-4 py-4" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Back */}
      <Link href={`/p/${id}`} className="text-sm mb-4 inline-block transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
        &#8592; Back to Passage
      </Link>

      {/* Section 1: Header */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ background: `linear-gradient(to right, var(--bg-header-from), var(--bg-header-to))`, border: `1px solid var(--border)` }}>
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--text-heading)" }}>
          &#9973; {passage.mode === "daily" ? `Day ${legIndex + 1}` : `Leg ${legIndex + 1}`}: {leg.from.port.name} &rarr; {leg.to.port.name}
        </h1>
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span>{leg.nm} NM</span>
          <span>~{leg.hours.toFixed(1)}h at {passage.speed}kt</span>
          <span>Depart: {fmtLocal(leg.departTime, fromTz)}</span>
          <span>Arrive: {fmtLocal(leg.arriveTime, toTz)}</span>
        </div>
        {capeWps.length > 0 && (
          <div className="mt-2 text-xs" style={{ color: "var(--text-yellow)" }}>
            &#9888; Capes on this leg: {capeWps.map(w => w.port.name).join(", ")}
          </div>
        )}
        {dest.orcaRisk && dest.orcaRisk !== "none" && (
          <div className="mt-1 text-xs" style={{ color: dest.orcaRisk === "high" ? "var(--text-red)" : "var(--text-yellow)" }}>
            &#128011; Orca risk: {dest.orcaRisk.toUpperCase()} {dest.orcaNotes && `— ${dest.orcaNotes}`}
          </div>
        )}
      </div>

      {/* Section 2: Passage Notes */}
      {(leg.from.port.passageNotes || leg.to.port.passageNotes || capeWps.some(w => w.port.passageNotes)) && (
        <Section title="Passage Notes &amp; Hazards">
          {leg.from.port.passageNotes && (
            <div className="mb-2">
              <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-green)" }}>{leg.from.port.name}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{leg.from.port.passageNotes}</div>
            </div>
          )}
          {capeWps.map(w => w.port.passageNotes && (
            <div key={w.port.id} className="mb-2">
              <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-yellow)" }}>&#9888; {w.port.name}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{w.port.passageNotes}</div>
            </div>
          ))}
          {leg.to.port.passageNotes && (
            <div className="mb-2">
              <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-green)" }}>{leg.to.port.name}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{leg.to.port.passageNotes}</div>
            </div>
          )}
          <div className="mt-3 p-2 rounded text-xs" style={{ background: "var(--accent-nogo)", color: "var(--text-red)" }}>
            &#128680; Emergency: Salvamento Mar&#237;timo 900 202 202 / VHF 16
          </div>
        </Section>
      )}

      {/* Section 3: Approach to Destination */}
      {(dest.approachDescription || dest.approachNotes) && (
        <Section title={`Approach: ${dest.name}`}>
          {dest.approachDescription && <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>{dest.approachDescription}</div>}
          {dest.approachNotes && <div className="text-xs p-2 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-blue-light)" }}>{dest.approachNotes}</div>}
        </Section>
      )}

      {/* Section 4: Marina Info */}
      {dest.type !== "cape" && (
        <Section title={dest.marinaName || `${dest.name} Marina`}>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            {dest.phone && <div><span style={{ color: "var(--text-muted)" }}>Phone:</span> <a href={`tel:${dest.phone.replace(/\s/g, "")}`} style={{ color: "var(--text-blue-light)" }}>{dest.phone}</a></div>}
            {dest.email && <div><span style={{ color: "var(--text-muted)" }}>Email:</span> <a href={`mailto:${dest.email}`} style={{ color: "var(--text-blue-light)" }}>{dest.email}</a></div>}
            {dest.vhfCh && <div><span style={{ color: "var(--text-muted)" }}>VHF:</span> Ch {dest.vhfCh}</div>}
            {dest.website && <div><span style={{ color: "var(--text-muted)" }}>Web:</span> <a href={dest.website} target="_blank" rel="noopener" style={{ color: "var(--text-blue-light)" }}>{dest.website.replace(/https?:\/\//, "")}</a></div>}
            {dest.marinaHours && <div><span style={{ color: "var(--text-muted)" }}>Hours:</span> {dest.marinaHours}</div>}
            {dest.berthCount && <div><span style={{ color: "var(--text-muted)" }}>Berths:</span> {dest.berthCount} ({dest.visitorBerths || "?"} visitor)</div>}
            {dest.maxLength && <div><span style={{ color: "var(--text-muted)" }}>Max LOA:</span> {dest.maxLength}m</div>}
            {dest.maxDraft && <div><span style={{ color: "var(--text-muted)" }}>Max draft:</span> {dest.maxDraft}m</div>}
            {dest.shelter && <div><span style={{ color: "var(--text-muted)" }}>Shelter:</span> <span style={{ color: dest.shelter === "good" ? "var(--text-green)" : "var(--text-yellow)" }}>{dest.shelter.toUpperCase()}</span></div>}
          </div>
          {/* Facilities */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {dest.fuel && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Fuel</span>}
            {dest.water && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Water</span>}
            {dest.electric && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Electric</span>}
            {dest.repairs && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-go)", color: "var(--text-green)" }}>Repairs</span>}
            {dest.customs && <span className="px-2 py-0.5 rounded" style={{ background: "var(--accent-caution)", color: "var(--text-yellow)" }}>Customs</span>}
          </div>
          {dest.accessCodes && <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>&#128273; Access: {dest.accessCodes}</div>}
        </Section>
      )}

      {/* Section 5: Restaurants */}
      {restaurants.length > 0 && (
        <Section title={`Restaurants near ${dest.name} (${restaurants.length})`}>
          {restaurants.map((r, i) => <PlaceCard key={i} place={r} type="restaurant" />)}
        </Section>
      )}

      {/* Section 6: Yacht Shops */}
      {yachtShops.length > 0 && (
        <Section title={`Yacht Shops (${yachtShops.length})`}>
          {yachtShops.map((s, i) => <PlaceCard key={i} place={s} type="yacht" />)}
        </Section>
      )}

      {/* Section 7: Grocery Stores */}
      {groceryStores.length > 0 && (
        <Section title={`Grocery & Provisioning (${groceryStores.length})`}>
          {groceryStores.map((s, i) => <PlaceCard key={i} place={s} type="grocery" />)}
        </Section>
      )}

      {/* Section 8: Webcams */}
      {webcams.length > 0 && (
        <Section title={`Live Webcams (${webcams.length})`} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            {webcams.map(wc => (
              <a key={wc.id} href={wc.playerUrl} target="_blank" rel="noopener" className="block rounded-lg overflow-hidden hover:opacity-80 transition-opacity" style={{ border: `1px solid var(--border-light)` }}>
                {wc.preview && <img src={wc.preview} alt={wc.title} className="w-full h-24 object-cover" />}
                <div className="px-2 py-1.5 text-[11px]" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                  {wc.title}
                  {wc.city && <span className="ml-1" style={{ color: "var(--text-muted)" }}>({wc.city})</span>}
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Section 9: Additional Info */}
      <Section title="Additional Information" defaultOpen={false}>
        <div className="text-xs space-y-1.5" style={{ color: "var(--text-secondary)" }}>
          <div>&#128205; <strong>Coordinates:</strong> {dest.lat.toFixed(4)}N {Math.abs(dest.lon).toFixed(4)}W</div>
          {dest.notes && <div>&#128221; <strong>Notes:</strong> {dest.notes}</div>}
          <div className="mt-3 pt-2" style={{ borderTop: `1px solid var(--border-light)` }}>
            <div className="font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Emergency Contacts</div>
            <div>&#128680; Salvamento Mar&#237;timo: <a href="tel:900202202" style={{ color: "var(--text-blue-light)" }}>900 202 202</a> / VHF 16</div>
            <div>&#127973; Cruz Roja (Red Cross): <a href="tel:112" style={{ color: "var(--text-blue-light)" }}>112</a></div>
            <div>&#9875; MRCC Gij&#243;n: VHF 16, 70 (DSC)</div>
          </div>
        </div>
      </Section>

      <div className="text-center text-[10px] mt-6 pt-4" style={{ color: "var(--text-muted)", borderTop: `1px solid var(--border-light)` }}>
        Planning aid only. Verify all information before departure.
      </div>
    </div>
  );
}
