"use client";

import L from "leaflet";
import { useMemo } from "react";
import { LayerGroup, Marker, Pane, Popup, Rectangle } from "react-leaflet";
import { windColor } from "@/components/design/helpers";
import { OPEN_METEO_ATTR } from "@/lib/map-layers";
import { WEATHER_MODELS, barbSvg, waveColor, type WeatherGrid } from "@/lib/weather-grid";

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg: number | null) => (deg == null ? "" : COMPASS[Math.round(deg / 22.5) % 16]);

/**
 * Wind barbs and wave-height cells for one forecast hour of a weather grid.
 * Own pane: above the route lines (400), below the route-edit handles (600).
 */
export default function WeatherLayer({ grid, timeIdx, wind, waves }: {
  grid: WeatherGrid; timeIdx: number; wind: boolean; waves: boolean;
}) {
  const cells = useMemo(() => grid.points.map((p) => {
    const ws = p.ws[timeIdx], wd = p.wd[timeIdx], hs = p.hs[timeIdx];
    const html =
      (wind && ws != null && wd != null ? barbSvg(ws, wd, windColor(ws)) : "") +
      (waves && hs != null ? `<span class="wx-hs">${hs.toFixed(1)}</span>` : "");
    return {
      p, ws, wd, hs, wg: p.wg[timeIdx], hd: p.hd[timeIdx], tp: p.tp[timeIdx],
      icon: html ? L.divIcon({ className: "wx-pt", iconSize: [36, 36], iconAnchor: [18, 18], html }) : null,
    };
  }), [grid, timeIdx, wind, waves]);

  const h = grid.step / 2;
  const when = new Date(grid.times[timeIdx]).toLocaleString("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });

  return (
    <Pane name="weather" style={{ zIndex: 450 }}>
      <LayerGroup attribution={OPEN_METEO_ATTR}>
        {waves && cells.map((c) => c.hs == null ? null : (
          <Rectangle key={`r${c.p.lat},${c.p.lon}`} bounds={[[c.p.lat - h, c.p.lon - h], [c.p.lat + h, c.p.lon + h]]} interactive={false}
            pathOptions={{ stroke: false, fillColor: waveColor(c.hs), fillOpacity: 0.3 }} />
        ))}
        {cells.map((c) => c.icon && (
          <Marker key={`m${c.p.lat},${c.p.lon}`} position={[c.p.lat, c.p.lon]} icon={c.icon} keyboard={false}>
            <Popup closeButton={false}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700 }}>{when} UTC</div>
                {c.ws != null && <div>Wind {c.ws} kn {compass(c.wd)}{c.wg != null ? `, gust ${c.wg}` : ""}</div>}
                {c.hs != null
                  ? <div>Waves {c.hs.toFixed(1)} m {compass(c.hd)}{c.tp != null ? `, ${c.tp} s` : ""}</div>
                  : <div style={{ opacity: 0.6 }}>no wave data here (land / coast)</div>}
                <div style={{ opacity: 0.6, fontSize: 10.5 }}>{c.p.lat.toFixed(2)}, {c.p.lon.toFixed(2)} · {WEATHER_MODELS[grid.model]}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </LayerGroup>
    </Pane>
  );
}
