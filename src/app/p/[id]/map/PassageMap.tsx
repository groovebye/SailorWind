"use client";

import { MapContainer, TileLayer, WMSTileLayer, Polyline, CircleMarker, Popup, Tooltip, useMap, GeoJSON as GeoJSONLayer } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ForecastEntry } from "@/lib/weather";
import { buildSeaRoute } from "@/lib/coastline";
import type { FeatureCollection } from "geojson";

interface Port {
  id: string; name: string; slug: string; lat: number; lon: number; type: string;
  coastlineNm: number; fuel: boolean; water: boolean; electric: boolean;
  repairs: boolean; customs: boolean; shelter: string | null; maxDraft: number | null;
  vhfCh: string | null; website: string | null; notes: string | null;
  country: string; region: string | null; tier: string | null;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface WaypointWithData extends Waypoint {
  eta: Date; tz: string; forecast: ForecastEntry | null; allForecasts: ForecastEntry[];
}

const COLORS: Record<string, { fill: string; stroke: string }> = {
  cape:      { fill: "#facc15", stroke: "#a16207" },
  marina:    { fill: "#4ade80", stroke: "#166534" },
  port:      { fill: "#60a5fa", stroke: "#1e40af" },
  anchorage: { fill: "#c084fc", stroke: "#6b21a8" },
};

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png";
const OPENSEAMAP_TILES = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";

// Contour line colors by depth
const CONTOUR_STYLES: Record<number, { color: string; weight: number; dash?: string }> = {
  5:   { color: "#ef4444", weight: 1.5 },          // red — danger
  10:  { color: "#f97316", weight: 1.2 },           // orange — caution
  20:  { color: "#eab308", weight: 1, dash: "4 2" },
  50:  { color: "#94a3b8", weight: 0.8, dash: "4 2" },
  100: { color: "#64748b", weight: 0.6, dash: "6 3" },
  200: { color: "#475569", weight: 0.5, dash: "8 4" },
};

function bftNum(b: string) { return b.replace("F", ""); }

function fmtTime(d: Date, tz: string) {
  return d.toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDateTime(d: Date, tz: string) {
  const s = d.toLocaleString("en-GB", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return s.replace(" at ", " ");
}

function verdictStyle(v: string): { color: string; bg: string; label: string } {
  if (v === "GO") return { color: "#4ade80", bg: "rgba(74,222,128,0.15)", label: "GO" };
  if (v.startsWith("CAUTION")) return { color: "#facc15", bg: "rgba(250,204,21,0.15)", label: "CAUTION" };
  return { color: "#f87171", bg: "rgba(248,113,113,0.15)", label: "NO-GO" };
}

function windArrow(deg: number) {
  return `<span style="display:inline-block;transform:rotate(${deg}deg);color:#facc15">&#8595;</span>`;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40] });
    }
  }, [map, positions]);
  return null;
}

function buildFacilities(port: Port): string {
  const items: string[] = [];
  if (port.fuel) items.push("Fuel");
  if (port.water) items.push("Water");
  if (port.electric) items.push("Electric");
  if (port.repairs) items.push("Repairs");
  if (port.customs) items.push("Customs");
  return items.join(" &middot; ");
}

function extractPhone(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Tel:\s*([\+\d\s]+)/);
  return m ? m[1].trim() : null;
}

function buildPopupContent(wp: WaypointWithData): string {
  const p = wp.port;
  const c = COLORS[p.type] || COLORS.port;
  const phone = extractPhone(p.notes);
  const notesClean = p.notes?.replace(/\s*Tel:.*$/, "").trim();

  let html = `<div style="font-family:monospace;font-size:12px;min-width:260px;max-width:320px;line-height:1.5">`;
  html += `<div style="font-size:14px;font-weight:700;color:${c.fill};margin-bottom:4px">${p.name}</div>`;
  html += `<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px">${p.type}${p.region ? ` &middot; ${p.region}` : ""} &middot; ${p.country}</div>`;
  html += `<div style="font-size:11px;margin-bottom:6px"><span style="color:#93c5fd">ETA:</span> <strong>${fmtDateTime(wp.eta, wp.tz)}</strong></div>`;

  if (wp.forecast) {
    const f = wp.forecast;
    const vs = verdictStyle(f.verdict);
    html += `<div style="background:${vs.bg};border:1px solid ${vs.color}30;border-radius:6px;padding:6px 8px;margin-bottom:8px">`;
    html += `<div style="font-size:10px;color:#94a3b8;margin-bottom:2px">FORECAST AT ETA</div>`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
    html += `<div>${windArrow(f.windDirDeg)} ${Math.round(f.windKt)}kt B${bftNum(f.beaufort)} &middot; Gusts ${Math.round(f.gustKt)}kt</div>`;
    html += `<span style="color:${vs.color};font-weight:700;font-size:11px">${vs.label}</span>`;
    html += `</div>`;
    html += `<div style="font-size:11px;color:#94a3b8;margin-top:2px">Waves ${f.waveM}m/${f.wavePeriodS}s &middot; Swell ${f.swellM}m/${f.swellPeriodS}s</div>`;
    html += `</div>`;
  }

  if (wp.allForecasts.length > 0) {
    const etaMs = wp.eta.getTime();
    const window = wp.allForecasts.filter(f => {
      const t = new Date(f.time).getTime();
      return t >= etaMs - 6 * 3600000 && t <= etaMs + 18 * 3600000;
    }).slice(0, 8);
    if (window.length > 0) {
      html += `<div style="font-size:10px;color:#94a3b8;margin-bottom:3px">24H WINDOW</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(${Math.min(window.length, 4)},1fr);gap:3px;margin-bottom:8px">`;
      for (const f of window) {
        const vs = verdictStyle(f.verdict);
        const dt = new Date(f.time);
        html += `<div style="text-align:center;padding:3px;background:${vs.bg};border-radius:4px;font-size:10px">`;
        html += `<div style="font-weight:600">${fmtTime(dt, wp.tz)}</div>`;
        html += `<div>${Math.round(f.windKt)}kt</div>`;
        html += `<div>${f.waveM}m</div>`;
        html += `<div style="color:${vs.color};font-weight:700">${vs.label}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
  }

  if (p.type !== "cape") {
    const facilities = buildFacilities(p);
    if (facilities) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Facilities:</span> ${facilities}</div>`;
    if (p.shelter) {
      const sc = p.shelter === "good" ? "#4ade80" : p.shelter === "moderate" ? "#facc15" : "#f87171";
      html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Shelter:</span> <span style="color:${sc}">${p.shelter.toUpperCase()}</span></div>`;
    }
    if (p.maxDraft) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Max draft:</span> ${p.maxDraft}m</div>`;
    if (p.vhfCh) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">VHF:</span> Ch ${p.vhfCh}</div>`;
    if (phone) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Tel:</span> <a href="tel:${phone.replace(/\s/g, "")}" style="color:#93c5fd">${phone}</a></div>`;
    if (p.website) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Web:</span> <a href="${p.website}" target="_blank" rel="noopener" style="color:#93c5fd">${p.website.replace(/https?:\/\//, "")}</a></div>`;
  }

  if (notesClean) html += `<div style="font-size:11px;color:#94a3b8;margin-top:4px;border-top:1px solid #334155;padding-top:4px">${notesClean}</div>`;
  html += `<div style="font-size:10px;color:#64748b;margin-top:4px">${p.lat.toFixed(4)}N ${Math.abs(p.lon).toFixed(4)}${p.lon < 0 ? "W" : "E"} &middot; ${p.coastlineNm} NM</div>`;
  html += `</div>`;
  return html;
}

function routeAnchorForWaypoint(w: WaypointWithData): { name: string; lat: number; lon: number } {
  if (w.port.name === "Cabo Peñas") {
    return { name: "Cabo Peñas Rounding", lat: 43.675, lon: -5.850 };
  }
  if (w.port.name === "Estaca de Bares") {
    return { name: "Estaca de Bares Rounding", lat: 43.825, lon: -7.685 };
  }
  if (w.port.name === "Cabo Ortegal") {
    return { name: "Cabo Ortegal Rounding", lat: 43.810, lon: -7.880 };
  }
  return { name: w.port.name, lat: w.port.lat, lon: w.port.lon };
}

export default function PassageMap({ waypoints, theme }: { waypoints: WaypointWithData[]; theme: string }) {
  const [contours, setContours] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/data/contours.json").then(r => r.json()).then(setContours).catch(() => {});
  }, []);

  const positions = waypoints.map((w) => [w.port.lat, w.port.lon] as [number, number]);

  // Geometry is defined only by passage endpoints and capes. Intermediate
  // stopovers remain forecast markers, but they do not bend the route line.
  const routeAnchors = waypoints.filter((w, index) =>
    index === 0 || index === waypoints.length - 1 || w.isCape
  );

  const routeSegments: { positions: [number, number][]; color: string; label: string }[] = [];

  for (let i = 0; i < routeAnchors.length - 1; i++) {
    const from = routeAnchors[i];
    const to = routeAnchors[i + 1];
    const fromAnchor = routeAnchorForWaypoint(from);
    const toAnchor = routeAnchorForWaypoint(to);
    const segPositions = buildSeaRoute(
      fromAnchor,
      toAnchor
    );

    const minNm = Math.min(from.port.coastlineNm, to.port.coastlineNm) - 0.1;
    const maxNm = Math.max(from.port.coastlineNm, to.port.coastlineNm) + 0.1;
    const segmentWps = waypoints.filter(
      (w) => w.port.coastlineNm >= minNm && w.port.coastlineNm <= maxNm
    );

    let worst = "GO";
    for (const w of segmentWps) {
      if (!w.forecast) continue;
      if (w.forecast.verdict.startsWith("NO")) worst = "NO-GO";
      else if (w.forecast.verdict.startsWith("CAUTION") && worst !== "NO-GO") worst = "CAUTION";
    }

    const color = worst === "GO" ? "#4ade80" : worst === "CAUTION" ? "#facc15" : "#f87171";
    routeSegments.push({
      positions: segPositions,
      color,
      label: `${from.port.name} → ${to.port.name}: ${worst}`,
    });
  }

  const tileUrl = theme === "light" ? LIGHT_TILES : DARK_TILES;
  const bgColor = theme === "light" ? "#f8fafc" : "#0f172a";

  return (
    <MapContainer
      center={[43.6, -6.5]}
      zoom={9}
      className="h-full w-full"
      style={{ background: bgColor }}
    >
      <FitBounds positions={positions} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url={tileUrl}
      />

      {/* Depth contour lines from static GeoJSON — no flicker */}
      {contours && (
        <GeoJSONLayer
          data={contours}
          style={(feature) => {
            const depth = feature?.properties?.depth || 50;
            const style = CONTOUR_STYLES[depth] || CONTOUR_STYLES[50];
            return {
              color: style.color,
              weight: style.weight,
              opacity: 0.7,
              dashArray: style.dash,
            };
          }}
          onEachFeature={(feature, layer) => {
            const depth = feature.properties?.depth;
            if (depth) {
              layer.bindTooltip(`${depth}m`, {
                permanent: false,
                direction: "center",
                className: "depth-label",
              });
            }
          }}
        />
      )}

      {/* OpenSeaMap nautical overlay */}
      <TileLayer
        url={OPENSEAMAP_TILES}
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        opacity={0.8}
      />

      {/* Colored route segments — one continuous passage geometry split only at capes */}
      {routeSegments.map((seg, i) => seg.positions.length > 1 && (
        <Polyline
          key={`leg-${i}`}
          positions={seg.positions}
          pathOptions={{ color: seg.color, weight: 3, opacity: 0.8 }}
        >
          <Tooltip sticky>{seg.label}</Tooltip>
        </Polyline>
      ))}

      {/* Waypoints */}
      {waypoints.map((w) => {
        const c = COLORS[w.port.type] || COLORS.port;
        const isKey = w.isStop || w.isCape;
        let glowColor: string | undefined;
        if (w.forecast && isKey) {
          const v = w.forecast.verdict;
          glowColor = v === "GO" ? "#4ade80" : v.startsWith("CAUTION") ? "#facc15" : "#f87171";
        }

        return (
          <CircleMarker
            key={w.sortOrder}
            center={[w.port.lat, w.port.lon]}
            radius={w.isCape ? 6 : w.port.tier === "major" ? 11 : w.port.tier === "medium" ? 8 : 5}
            pathOptions={{
              fillColor: glowColor || c.fill,
              color: glowColor || c.stroke,
              weight: w.port.tier === "major" ? 3 : w.port.tier === "medium" ? 2 : 1.5,
              fillOpacity: w.port.tier === "major" ? 0.95 : w.port.tier === "medium" ? 0.8 : 0.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <span style={{ fontWeight: 600 }}>{w.port.name}</span>
              {w.forecast && (
                <span style={{ marginLeft: 6, color: verdictStyle(w.forecast.verdict).color, fontWeight: 700 }}>
                  {verdictStyle(w.forecast.verdict).label}
                </span>
              )}
              <br />
              <span style={{ fontSize: 10, color: "#94a3b8" }}>
                {w.port.type.toUpperCase()}
                {w.isStop ? " STOP" : ""}
                {w.forecast ? ` \u2014 ${Math.round(w.forecast.windKt)}kt B${bftNum(w.forecast.beaufort)}, ${w.forecast.waveM}m` : ""}
              </span>
            </Tooltip>
            <Popup maxWidth={340} minWidth={280}>
              <div dangerouslySetInnerHTML={{ __html: buildPopupContent(w) }} />
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
