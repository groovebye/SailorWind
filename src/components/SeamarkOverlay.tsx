"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, Popup, Tooltip } from "react-leaflet";

interface SeamarkFeature {
  id: string;
  lat: number;
  lon: number;
  type: string;
  category: string | null;
  name: string | null;
  tags: Record<string, string>;
}

function buildBounds(points: [number, number][]) {
  if (points.length === 0) return null;
  let south = points[0][0];
  let north = points[0][0];
  let west = points[0][1];
  let east = points[0][1];

  for (const [lat, lon] of points) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }

  const padLat = Math.max(0.03, (north - south) * 0.25);
  const padLon = Math.max(0.03, (east - west) * 0.25);

  return {
    south: south - padLat,
    west: west - padLon,
    north: north + padLat,
    east: east + padLon,
  };
}

function seamarkStyle(type: string, category: string | null) {
  if (type.includes("cardinal")) {
    return { fill: "#facc15", stroke: "#111827", radius: 5, symbol: "◆" };
  }
  if (type.includes("lateral")) {
    if (category === "port") return { fill: "#ef4444", stroke: "#7f1d1d", radius: 5, symbol: "●" };
    if (category === "starboard") return { fill: "#22c55e", stroke: "#14532d", radius: 5, symbol: "●" };
    return { fill: "#60a5fa", stroke: "#1e3a8a", radius: 5, symbol: "●" };
  }
  if (type.includes("safe_water")) {
    return { fill: "#f8fafc", stroke: "#ef4444", radius: 5, symbol: "◎" };
  }
  if (type.includes("special_purpose")) {
    return { fill: "#f97316", stroke: "#9a3412", radius: 5, symbol: "■" };
  }
  if (type.includes("light")) {
    return { fill: "#93c5fd", stroke: "#1d4ed8", radius: 4, symbol: "✦" };
  }
  if (type.includes("beacon")) {
    return { fill: "#c084fc", stroke: "#6b21a8", radius: 4, symbol: "▲" };
  }
  return { fill: "#94a3b8", stroke: "#334155", radius: 4, symbol: "•" };
}

function prettyType(type: string) {
  return type.replaceAll("_", " ");
}

export default function SeamarkOverlay({ points, hidden = false }: { points: [number, number][]; hidden?: boolean }) {
  const [features, setFeatures] = useState<SeamarkFeature[]>([]);
  const bounds = useMemo(() => buildBounds(points), [points]);

  useEffect(() => {
    if (!bounds) {
      setFeatures([]);
      return;
    }

    const controller = new AbortController();
    fetch(
      `/api/seamarks?south=${bounds.south}&west=${bounds.west}&north=${bounds.north}&east=${bounds.east}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data.error && Array.isArray(data.features)) {
          setFeatures(data.features);
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [bounds?.south, bounds?.west, bounds?.north, bounds?.east]);

  if (hidden) return null;

  return (
    <>
      {features.map((feature) => {
        const style = seamarkStyle(feature.type, feature.category);
        return (
          <CircleMarker
            key={feature.id}
            center={[feature.lat, feature.lon]}
            radius={style.radius}
            pathOptions={{
              fillColor: style.fill,
              color: style.stroke,
              weight: 2,
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span style={{ fontWeight: 700 }}>{style.symbol} {feature.name || prettyType(feature.type)}</span>
              <br />
              <span style={{ fontSize: 10, color: "#94a3b8" }}>
                {prettyType(feature.type)}{feature.category ? ` · ${feature.category}` : ""}
              </span>
            </Tooltip>
            <Popup maxWidth={260}>
              <div style={{ fontFamily: "monospace", fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {style.symbol} {feature.name || prettyType(feature.type)}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>
                  {prettyType(feature.type)}{feature.category ? ` · ${feature.category}` : ""}
                </div>
                {feature.tags["seamark:light:character"] && (
                  <div>Light: {feature.tags["seamark:light:character"]}</div>
                )}
                {feature.tags["seamark:topmark:shape"] && (
                  <div>Topmark: {feature.tags["seamark:topmark:shape"]}</div>
                )}
                {feature.tags.ref && <div>Ref: {feature.tags.ref}</div>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
