"use client";

import { MapContainer, TileLayer, CircleMarker, Polyline, Polygon, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// OpenSeaMap currently serves seamark tiles from the t1 host. The older
// tiles.openseamap.org endpoint returns 404s, which makes buoys/lights vanish.
const OPENSEAMAP_TILES = "https://t1.openseamap.org/seamark/{z}/{x}/{y}.png";

interface MapFeature {
  type: string;
  name: string;
  geometry: { type: string; coordinates: unknown };
  description: string | null;
}

const FEATURE_COLORS: Record<string, string> = {
  entrance: "#3b82f6",
  visitor_berth: "#4ade80",
  fuel_dock: "#f97316",
  office: "#a78bfa",
  showers: "#60a5fa",
  hazard: "#ef4444",
  waiting_area: "#94a3b8",
  route_hint: "#93c5fd",
  breakwater: "#64748b",
};

const FEATURE_LABELS: Record<string, string> = {
  entrance: "🚪",
  visitor_berth: "⚓",
  fuel_dock: "⛽",
  office: "🏢",
  showers: "🚿",
  hazard: "⚠️",
  waiting_area: "⏳",
  breakwater: "🧱",
};

function FitToFeatures({ features, center }: { features: MapFeature[]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length > 0) {
      const pts = features
        .filter(f => f.geometry?.coordinates && f.geometry.type === "Point")
        .map(f => { const c = f.geometry.coordinates as [number, number]; return L.latLng(c[1], c[0]); });
      if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 17 });
      } else if (pts.length === 1) {
        map.setView(pts[0], 16);
      }
    } else {
      map.setView(center, 15);
    }
  }, [map, features, center]);
  return null;
}

export default function MarinaMiniMap({ features, center, name }: {
  features: MapFeature[];
  center: [number, number];
  name: string;
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid var(--border-light)` }}>
      <MapContainer center={center} zoom={16} className="w-full" style={{ height: 240, background: "#0f172a" }}
        zoomControl={false} attributionControl={false}>
        <FitToFeatures features={features} center={center} />

        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <TileLayer url={OPENSEAMAP_TILES} opacity={0.8} />

        {features.map((f, i) => {
          if (!f.geometry?.coordinates) return null;
          const color = FEATURE_COLORS[f.type] || "#94a3b8";
          const tooltip = (
            <Tooltip direction="top" offset={[0, -8]} permanent={features.length <= 6}>
              <span style={{ fontSize: 11 }}>{FEATURE_LABELS[f.type] || "📍"} {f.name}</span>
              {f.description && <><br /><span style={{ fontSize: 10, color: "#94a3b8" }}>{f.description}</span></>}
            </Tooltip>
          );

          if (f.geometry.type === "LineString") {
            const positions = (f.geometry.coordinates as [number, number][]).map(([lon, lat]) => [lat, lon] as [number, number]);
            return <Polyline key={i} positions={positions} pathOptions={{ color, weight: 3, opacity: 0.8 }}>{tooltip}</Polyline>;
          }
          if (f.geometry.type === "Polygon") {
            const positions = ((f.geometry.coordinates as [number, number][][])[0] || []).map(([lon, lat]) => [lat, lon] as [number, number]);
            return <Polygon key={i} positions={positions} pathOptions={{ fillColor: color, color, weight: 2, fillOpacity: 0.2 }}>{tooltip}</Polygon>;
          }
          // Default: Point
          const [lon, lat] = f.geometry.coordinates as [number, number];
          return (
            <CircleMarker key={i} center={[lat, lon]} radius={7}
              pathOptions={{ fillColor: color, color, weight: 2, fillOpacity: 0.8 }}>
              {tooltip}
            </CircleMarker>
          );
        })}
      </MapContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-2 px-2 py-1.5 text-[9px]" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>
        {[...new Set(features.map(f => f.type))].map(t => (
          <span key={t} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: FEATURE_COLORS[t] || "#94a3b8" }} />
            {FEATURE_LABELS[t] || "📍"} {t.replace("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
