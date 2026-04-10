"use client";

import { MapContainer, TileLayer, WMSTileLayer, Polyline, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ForecastEntry } from "@/lib/weather";
import { getRouteShape } from "@/lib/coastline";

interface Port {
  id: string; name: string; slug: string; lat: number; lon: number; type: string;
  coastlineNm: number; fuel: boolean; water: boolean; electric: boolean;
  repairs: boolean; customs: boolean; shelter: string | null; maxDraft: number | null;
  vhfCh: string | null; website: string | null; notes: string | null;
  country: string; region: string | null;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface WaypointWithData extends Waypoint {
  eta: Date; tz: string; forecast: ForecastEntry | null; allForecasts: ForecastEntry[];
}
interface Leg { from: Waypoint; to: Waypoint; nm: number; departTime: Date; arriveTime: Date; hours: number; }

const COLORS: Record<string, { fill: string; stroke: string }> = {
  cape:      { fill: "#facc15", stroke: "#a16207" },
  marina:    { fill: "#4ade80", stroke: "#166534" },
  port:      { fill: "#60a5fa", stroke: "#1e40af" },
  anchorage: { fill: "#c084fc", stroke: "#6b21a8" },
};

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png";
const OPENSEAMAP_TILES = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";

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

  // Header
  html += `<div style="font-size:14px;font-weight:700;color:${c.fill};margin-bottom:4px">${p.name}</div>`;
  html += `<div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px">${p.type}${p.region ? ` &middot; ${p.region}` : ""} &middot; ${p.country}</div>`;

  // ETA
  html += `<div style="font-size:11px;margin-bottom:6px"><span style="color:#93c5fd">ETA:</span> <strong>${fmtDateTime(wp.eta, wp.tz)}</strong></div>`;

  // Forecast at ETA
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

  // 24h mini-forecast
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

  // Port info
  if (p.type !== "cape") {
    const facilities = buildFacilities(p);
    if (facilities) {
      html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Facilities:</span> ${facilities}</div>`;
    }
    if (p.shelter) {
      const shelterColor = p.shelter === "good" ? "#4ade80" : p.shelter === "moderate" ? "#facc15" : "#f87171";
      html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Shelter:</span> <span style="color:${shelterColor}">${p.shelter.toUpperCase()}</span></div>`;
    }
    if (p.maxDraft) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Max draft:</span> ${p.maxDraft}m</div>`;
    if (p.vhfCh) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">VHF:</span> Ch ${p.vhfCh}</div>`;
    if (phone) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Tel:</span> <a href="tel:${phone.replace(/\s/g, "")}" style="color:#93c5fd">${phone}</a></div>`;
    if (p.website) html += `<div style="font-size:11px;margin-bottom:4px"><span style="color:#94a3b8">Web:</span> <a href="${p.website}" target="_blank" rel="noopener" style="color:#93c5fd">${p.website.replace(/https?:\/\//, "")}</a></div>`;
  }

  // Notes
  if (notesClean) {
    html += `<div style="font-size:11px;color:#94a3b8;margin-top:4px;border-top:1px solid #334155;padding-top:4px">${notesClean}</div>`;
  }

  // Coordinates
  html += `<div style="font-size:10px;color:#64748b;margin-top:4px">${p.lat.toFixed(4)}N ${Math.abs(p.lon).toFixed(4)}${p.lon < 0 ? "W" : "E"} &middot; ${p.coastlineNm} NM</div>`;

  html += `</div>`;
  return html;
}

export default function PassageMap({ waypoints, legs, theme }: { waypoints: WaypointWithData[]; legs: Leg[]; theme: string }) {
  const positions = waypoints.map((w) => [w.port.lat, w.port.lon] as [number, number]);

  // Build route shape using coastline points for each leg
  const legSegments: { positions: [number, number][]; color: string; label: string }[] = [];
  const allRoutePositions: [number, number][] = [];

  for (let li = 0; li < legs.length; li++) {
    const leg = legs[li];
    // Get all waypoints in this leg, build shape through them
    const legWps = waypoints.filter(
      (w) => (w.isStop || w.isCape) &&
             w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
             w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
    ).sort((a, b) => a.port.coastlineNm - b.port.coastlineNm);

    // Build detailed shape through consecutive waypoints
    const segPositions: [number, number][] = [];
    for (let i = 0; i < legWps.length - 1; i++) {
      const shape = getRouteShape(
        legWps[i].port.lat, legWps[i].port.lon,
        legWps[i + 1].port.lat, legWps[i + 1].port.lon,
      );
      // Avoid duplicating the join point
      if (i > 0) shape.shift();
      segPositions.push(...shape);
    }
    if (segPositions.length === 0 && legWps.length >= 2) {
      segPositions.push(
        [legWps[0].port.lat, legWps[0].port.lon],
        [legWps[legWps.length - 1].port.lat, legWps[legWps.length - 1].port.lon],
      );
    }

    // Determine worst verdict on this leg
    const allLegWps = waypoints.filter(
      (w) => w.port.coastlineNm >= leg.from.port.coastlineNm - 0.1 &&
             w.port.coastlineNm <= leg.to.port.coastlineNm + 0.1
    );
    let worst = "GO";
    for (const w of allLegWps) {
      if (w.forecast) {
        if (w.forecast.verdict.startsWith("NO")) worst = "NO-GO";
        else if (w.forecast.verdict.startsWith("CAUTION") && worst !== "NO-GO") worst = "CAUTION";
      }
    }
    const color = worst === "GO" ? "#4ade80" : worst === "CAUTION" ? "#facc15" : "#f87171";
    legSegments.push({ positions: segPositions, color, label: `Leg ${li + 1}: ${worst}` });
    allRoutePositions.push(...segPositions);
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

      {/* EMODnet Bathymetry — colored depth raster (shows shallow areas) */}
      <WMSTileLayer
        url="https://ows.emodnet-bathymetry.eu/wms"
        params={{
          layers: "emodnet:mean_multicolour",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
        }}
        attribution='&copy; <a href="https://emodnet.ec.europa.eu">EMODnet</a>'
        opacity={theme === "dark" ? 0.35 : 0.25}
      />

      {/* EMODnet depth contour lines */}
      <WMSTileLayer
        url="https://ows.emodnet-bathymetry.eu/wms"
        params={{
          layers: "emodnet:contours",
          format: "image/png",
          transparent: true,
          version: "1.3.0",
        }}
        attribution=''
        opacity={0.7}
      />

      {/* OpenSeaMap nautical overlay — buoys, lights, marks */}
      <TileLayer
        url={OPENSEAMAP_TILES}
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        opacity={0.8}
      />

      {/* Full route — faint dashed line */}
      {allRoutePositions.length > 1 && (
        <Polyline
          positions={allRoutePositions}
          pathOptions={{ color: "#3b82f6", weight: 1.5, opacity: 0.2, dashArray: "4 4" }}
        />
      )}

      {/* Colored leg segments following coastline */}
      {legSegments.map((seg, i) => seg.positions.length > 1 && (
        <Polyline
          key={`leg-${i}`}
          positions={seg.positions}
          pathOptions={{ color: seg.color, weight: 3, opacity: 0.7 }}
        >
          <Tooltip sticky>{seg.label}</Tooltip>
        </Polyline>
      ))}

      {/* Waypoints */}
      {waypoints.map((w) => {
        const c = COLORS[w.port.type] || COLORS.port;
        const isKey = w.isStop || w.isCape;

        // Verdict-based glow for stops
        let glowColor: string | undefined;
        if (w.forecast && isKey) {
          const v = w.forecast.verdict;
          glowColor = v === "GO" ? "#4ade80" : v.startsWith("CAUTION") ? "#facc15" : "#f87171";
        }

        return (
          <CircleMarker
            key={w.sortOrder}
            center={[w.port.lat, w.port.lon]}
            radius={w.isCape ? 7 : isKey ? 9 : 5}
            pathOptions={{
              fillColor: glowColor || c.fill,
              color: glowColor || c.stroke,
              weight: isKey ? 2.5 : 1.5,
              fillOpacity: isKey ? 0.9 : 0.5,
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
                {w.forecast ? ` — ${Math.round(w.forecast.windKt)}kt B${bftNum(w.forecast.beaufort)}, ${w.forecast.waveM}m` : ""}
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
