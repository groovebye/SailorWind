"use client";

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { windColor, beaufort } from "@/components/design/helpers";

type Metar = {
  icao: string; name: string | null; rawMetar: string | null; rawTaf: string | null;
  wdir: number | null; wspd: number | null; wgst: number | null;
  temp: number | null; visibKm: number | null; obsTime: string | null;
};

/** Real airport observations (METAR) + terminal forecast (TAF) near the route — a
 *  ground-truth cross-check against the model. Source: aviationweather.gov (NOAA). */
export default function MetarCard({ icaos }: { icaos: string[] }) {
  const [data, setData] = useState<Metar[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (!icaos.length) return;
    fetch(`/api/metar?ids=${icaos.join(",")}`)
      .then((r) => r.json())
      .then((d) => { if (!ignore) { if (Array.isArray(d)) setData(d); else setErr(true); } })
      .catch(() => { if (!ignore) setErr(true); });
    return () => { ignore = true; };
  }, [icaos]);

  return (
    <div className="glass fade-up" style={{ padding: 22 }}>
      <div className="center gap-10" style={{ marginBottom: 4 }}>
        <Plane size={16} style={{ color: "var(--cyan)" }} />
        <span style={{ fontWeight: 600 }}>Airport observations</span>
        <span className="faint mono" style={{ fontSize: 11 }}>METAR · TAF · NOAA</span>
      </div>
      <div className="faint mono" style={{ fontSize: 11, marginBottom: 14 }}>nearest coastal stations — ground truth vs the model</div>

      {!data && !err && <div className="faint mono" style={{ fontSize: 12, padding: "8px 0" }}>loading…</div>}
      {err && <div className="faint mono" style={{ fontSize: 12, padding: "8px 0" }}>observations unavailable</div>}

      <div className="col gap-12">
        {data?.map((m) => (
          <div key={m.icao} style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 12 }}>
            <div className="between" style={{ marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>{m.name || m.icao} <span className="faint mono" style={{ fontSize: 11 }}>{m.icao}</span></span>
              {m.wspd != null && (
                <span className="center gap-8">
                  <span className="mono" style={{ fontWeight: 600, color: windColor(m.wspd) }}>
                    {m.wdir ?? "—"}° {m.wspd}kt{m.wgst ? ` G${m.wgst}` : ""}
                  </span>
                  <span className="bf-chip" style={{ background: "rgba(255,255,255,0.08)", color: "var(--fg-dim)" }}>B{beaufort(m.wspd)}</span>
                  {m.temp != null && <span className="faint mono" style={{ fontSize: 11 }}>{m.temp}°C</span>}
                </span>
              )}
            </div>
            {m.rawMetar && <div className="mono" style={{ fontSize: 11, color: "var(--fg-dim)", wordBreak: "break-word" }}>{m.rawMetar}</div>}
            {m.rawTaf && (
              <details style={{ marginTop: 6 }}>
                <summary className="mono faint" style={{ fontSize: 11, cursor: "pointer" }}>TAF →</summary>
                <div className="mono" style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.rawTaf}</div>
              </details>
            )}
            {!m.rawMetar && <div className="faint mono" style={{ fontSize: 11 }}>no recent report</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
