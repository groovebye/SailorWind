"use client";

import "leaflet/dist/leaflet.css";
import type * as LType from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Wind, Waves, AlertTriangle, Clock, Gauge, Zap } from "lucide-react";
import { Verdict } from "@/components/design/Primitives";
import { windColor, beaufort, type VerdictV } from "@/components/design/helpers";
import {
  buildLegs, fetchSeries, nearestIdx, fmtMS, verdictFor, powerFor, type WP, type LocSeries,
} from "../_cockpit/forecast";

type Cond = { wind: number; gust: number; wave: string; swell: string; power: number; verdict: VerdictV; eta: string; current: string };

export default function ChartView(props: {
  passageId: string; from: string; to: string; nm: number; wps: WP[];
}) {
  const { wps } = props;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapObj = useRef<LType.Map | null>(null);
  const orcaGroup = useRef<LType.LayerGroup | null>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState({ wind: true, waves: false, orca: true });
  const [activeIdx, setActiveIdx] = useState(0);
  const [series, setSeries] = useState<LocSeries[] | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const base = useMemo(() => (typeof window === "undefined" ? 0 : Math.floor(Date.now() / 3600_000) * 3600_000), []);
  const legs = useMemo(() => buildLegs(wps), [wps]);

  // per-waypoint conditions sampled at ETA (departing now @ 6 kt baseline)
  const conds = useMemo<Cond[]>(() => {
    if (!series) return [];
    const speed = 6;
    return wps.map((w, i) => {
      const eta = base + (legs.cum[i] / speed) * 3600_000;
      const s = series[i] ?? series[0];
      const idx = nearestIdx(s.time, eta);
      const wind = idx >= 0 ? s.wind[idx] ?? 0 : 0;
      const gust = idx >= 0 ? s.gust[idx] ?? wind + 4 : wind + 4;
      const wave = idx >= 0 ? s.wave[idx] : null;
      const cur = idx >= 0 ? s.current[idx] : null;
      const curDir = idx >= 0 ? s.currentDir[idx] : null;
      return {
        wind, gust, power: powerFor(wind, gust, wave), verdict: verdictFor(wind, gust, wave),
        wave: fmtMS(wave, idx >= 0 ? s.period[idx] : null),
        swell: fmtMS(idx >= 0 ? s.swell[idx] : null, idx >= 0 ? s.swellPeriod[idx] : null),
        current: cur != null && cur >= 0.2 ? `${cur}kn${curDir != null ? ` ${Math.round(curDir)}°` : ""}` : "slack",
        eta: new Date(eta).toLocaleString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }),
      };
    });
  }, [series, wps, legs, base]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try { const s = await fetchSeries(wps, "ecmwf"); if (!ignore) setSeries(s); } catch { /* offline */ }
    })();
    return () => { ignore = true; };
  }, [wps]);

  // init Leaflet
  useEffect(() => {
    let map: LType.Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current) return;
      const pts = wps.map((w) => [w.lat, w.lon] as [number, number]);
      map = L.map(mapEl.current, { zoomControl: false, center: [43.62, -8.0], zoom: 9, scrollWheelZoom: true });
      mapObj.current = map;
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OSM © CARTO", maxZoom: 19, subdomains: "abcd",
      }).addTo(map);

      L.polyline(pts, { color: "#34e0ff", weight: 7, opacity: 0.18 }).addTo(map);
      L.polyline(pts, { color: "#34e0ff", weight: 2.5, opacity: 0.95, dashArray: "1 8", lineCap: "round" }).addTo(map);

      wps.forEach((w, i) => {
        const isStop = w.isStop, isCape = !isStop && w.isCape;
        const color = isStop ? "#34e0ff" : isCape ? "#ffc24b" : "#9fb6cc";
        const size = isStop ? 16 : isCape ? 13 : 9;
        const icon = L.divIcon({
          className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          html: `<div class="lf-wp ${isCape ? "lf-cape" : ""}" style="width:${size}px;height:${size}px;background:${color};box-shadow:0 0 14px ${color}">${isStop ? `<span class="lf-ping" style="border-color:${color}"></span>` : ""}</div>`,
        });
        L.marker([w.lat, w.lon], { icon })
          .addTo(map!)
          .on("click", () => { setActiveIdx(i); map!.panTo([w.lat, w.lon]); })
          .bindTooltip(w.name, { direction: "top", className: "lf-tip", offset: [0, -8] });
      });

      const og = L.layerGroup();
      wps.filter((w) => w.orcaRisk && w.orcaRisk !== "none").forEach((w) => {
        const c = w.orcaRisk === "high" ? "#ff6b8a" : w.orcaRisk === "medium" ? "#b794ff" : "#4fb0ff";
        L.circle([w.lat, w.lon], { radius: 8000, color: c, weight: 1.5, fillColor: c, fillOpacity: 0.12, dashArray: "4 6" })
          .bindTooltip(`Orca ${w.orcaRisk} — ${w.name}`, { className: "lf-tip" })
          .addTo(og);
      });
      orcaGroup.current = og;
      if (layersRef.current.orca) og.addTo(map);

      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.35));
      setTimeout(() => { map?.invalidateSize(); sizeOverlay(); }, 80);
      map.on("resize move zoom", sizeOverlay);
    })();
    return () => { cancelled = true; if (map) map.remove(); mapObj.current = null; };
  }, [wps]);

  // orca layer toggle
  useEffect(() => {
    const m = mapObj.current, og = orcaGroup.current;
    if (!m || !og) return;
    if (layers.orca) og.addTo(m); else m.removeLayer(og);
  }, [layers.orca]);

  function sizeOverlay() {
    const c = overlay.current;
    if (!c) return;
    const r = c.parentElement?.getBoundingClientRect();
    if (r) { c.width = r.width; c.height = r.height; }
  }

  // animated wind/wave overlay
  useEffect(() => {
    const c = overlay.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let parts: { x: number; y: number; a: number; life: number }[] = [];
    let raf = 0, t = 0;
    const spawn = () => ({ x: Math.random() * c.width, y: Math.random() * c.height, a: 0, life: Math.random() * 90 + 30 });
    const reset = () => { parts = Array.from({ length: Math.round((c.width * c.height) / 9000) }, spawn); };
    const field = (x: number, y: number) => {
      const s = 0.004;
      return Math.sin(x * s + t * 0.0007) * 1.1 + Math.cos(y * s * 1.2 - t * 0.0005) + 0.6;
    };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    function loop() {
      t += 16;
      ctx!.clearRect(0, 0, c!.width, c!.height);
      const ly = layersRef.current;
      if (ly.waves) {
        const g = ctx!.createLinearGradient(0, 0, c!.width, c!.height);
        g.addColorStop(0, "rgba(52,224,255,0.05)");
        g.addColorStop(0.5, "rgba(255,194,75,0.06)");
        g.addColorStop(1, "rgba(255,107,138,0.05)");
        ctx!.fillStyle = g; ctx!.fillRect(0, 0, c!.width, c!.height);
      }
      if (ly.wind && !reduced) {
        ctx!.globalCompositeOperation = "lighter";
        for (const p of parts) {
          const ang = field(p.x, p.y);
          const px = p.x, py = p.y;
          p.x += Math.cos(ang) * 1.5; p.y += Math.sin(ang) * 1.5; p.a++;
          const al = 0.12 * Math.min(1, p.a / 10) * Math.min(1, (p.life - p.a) / 16);
          ctx!.strokeStyle = `hsla(190,95%,70%,${al})`;
          ctx!.lineWidth = 1.1;
          ctx!.beginPath(); ctx!.moveTo(px, py); ctx!.lineTo(p.x, p.y); ctx!.stroke();
          if (p.a > p.life || p.x < 0 || p.x > c!.width || p.y < 0 || p.y > c!.height) Object.assign(p, spawn());
        }
        ctx!.globalCompositeOperation = "source-over";
      }
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => { sizeOverlay(); reset(); });
    if (mapEl.current) ro.observe(mapEl.current);
    const tm = setTimeout(() => { sizeOverlay(); reset(); }, 120);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(tm); };
  }, []);

  const active = conds[activeIdx];
  const activeWp = wps[activeIdx];

  return (
    <div className="map-wrap">
      <div ref={mapEl} className="map-el" />
      <canvas ref={overlay} className="map-overlay" />

      <div className="map-top glass">
        <Link href={`/p/${props.passageId}`} className="btn btn-sm btn-ghost"><ArrowLeft size={16} /></Link>
        <div>
          <div className="center gap-8">
            <span className="route-port" style={{ fontSize: 18 }}>{props.from}</span>
            <ArrowRight size={14} style={{ color: "var(--cyan)" }} />
            <span className="route-port" style={{ fontSize: 18 }}>{props.to}</span>
          </div>
          <div className="faint mono" style={{ fontSize: 11 }}>{wps.length} waypoints · {props.nm.toFixed(1)} NM</div>
        </div>
      </div>

      <div className="map-layers glass">
        <div className="field-label" style={{ marginBottom: 4 }}>Chart layers</div>
        <LayerToggle on={layers.wind} onClick={() => setLayers((s) => ({ ...s, wind: !s.wind }))} icon={<Wind size={15} />} label="Wind flow" c="var(--cyan)" />
        <LayerToggle on={layers.waves} onClick={() => setLayers((s) => ({ ...s, waves: !s.waves }))} icon={<Waves size={15} />} label="Wave heatmap" c="var(--caution)" />
        <LayerToggle on={layers.orca} onClick={() => setLayers((s) => ({ ...s, orca: !s.orca }))} icon={<AlertTriangle size={15} />} label="Orca zones" c="var(--orca)" />
      </div>

      {activeWp && (
        <div className="map-readout glass fade-up" key={activeWp.name}>
          <div className="between" style={{ marginBottom: 10 }}>
            <div className="center gap-8">
              <WpDot wp={activeWp} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{activeWp.name}</span>
            </div>
            {active && <Verdict v={active.verdict} />}
          </div>
          <div className="map-readout-grid">
            <RO icon={<Clock size={11} />} label="ETA" v={active?.eta ?? "—"} />
            <RO icon={<Wind size={11} />} label="Wind" v={active ? `${active.wind} kt` : "—"} c={active ? windColor(active.wind) : undefined} />
            <RO icon={<Gauge size={11} />} label="Gust" v={active ? `${active.gust} kt` : "—"} />
            <RO icon={<Waves size={11} />} label="Waves" v={active?.wave ?? "—"} />
            <RO icon={<Waves size={11} />} label="Swell" v={active?.swell ?? "—"} />
            <RO icon={<Waves size={11} />} label="Current" v={active?.current ?? "—"} />
            <RO icon={<Zap size={11} />} label="Power" v={active ? String(active.power) : "—"} />
          </div>
          {active && <div className="faint mono" style={{ fontSize: 9.5, marginTop: 8 }}>B{beaufort(active.wind)} · sampled at ETA</div>}
        </div>
      )}

      <div className="map-legend glass">
        <span className="faint mono" style={{ fontSize: 10 }}>WIND KT</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="legend-bar" />
          <div className="legend-scale mono"><span>0</span><span>10</span><span>20+</span></div>
        </div>
      </div>
    </div>
  );
}

function LayerToggle({ on, onClick, icon, label, c }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; c: string }) {
  return (
    <button className="layer-row" onClick={onClick} aria-pressed={on}>
      <span className="center gap-8" style={{ fontSize: 13 }}>
        <span style={{ color: c, display: "flex" }}>{icon}</span> {label}
      </span>
      <span className={`toggle${on ? " on" : ""}`}><span className="knob" /></span>
    </button>
  );
}
function RO({ icon, label, v, c }: { icon: React.ReactNode; label: string; v: string; c?: string }) {
  return (
    <div className="ro-cell">
      <span className="faint mono" style={{ fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
        {icon} {label}
      </span>
      <span className="mono" style={{ fontWeight: 600, fontSize: 14, color: c || "var(--fg)" }}>{v}</span>
    </div>
  );
}
function WpDot({ wp }: { wp: WP }) {
  const type = wp.isStop ? "STOP" : wp.isCape ? "CAPE" : "PORT";
  const c = type === "STOP" ? "var(--cyan)" : type === "CAPE" ? "var(--caution)" : "var(--fg-faint)";
  return <span style={{ width: 9, height: 9, borderRadius: type === "CAPE" ? 2 : 99, background: c, boxShadow: `0 0 8px ${c}`, transform: type === "CAPE" ? "rotate(45deg)" : "none", flexShrink: 0 }} />;
}
