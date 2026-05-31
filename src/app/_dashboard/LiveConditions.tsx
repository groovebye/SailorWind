"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Satellite, Waves, Thermometer, Eye, Compass } from "lucide-react";
import { Sparkline } from "@/components/design/Primitives";
import { windColor, beaufort } from "@/components/design/helpers";

type Live = {
  wind: number; gust: number; winds: number[];
  wave: number | null; period: number | null; sst: number | null; visNm: number | null;
};

export default function LiveConditions({
  name, lat, lon, passageHref, to,
}: { name: string; lat: number; lon: number; passageHref: string; to: string | null }) {
  const [live, setLive] = useState<Live | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const fc = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_gusts_10m&hourly=wind_speed_10m,visibility&wind_speed_unit=kn&forecast_days=2`;
        const mar = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_period,sea_surface_temperature`;
        const [f, m] = await Promise.allSettled([
          fetch(fc).then((r) => r.json()),
          fetch(mar).then((r) => r.json()),
        ]);
        if (!ok) return;
        if (f.status !== "fulfilled" || !f.value?.current) { setErr(true); return; }
        const fv = f.value, mv = m.status === "fulfilled" ? m.value : null;
        const winds: number[] = (fv.hourly?.wind_speed_10m ?? []).slice(0, 12).map((x: number) => Math.round(x));
        const visM: number | null = fv.hourly?.visibility?.[0] ?? null;
        setLive({
          wind: Math.round(fv.current.wind_speed_10m),
          gust: Math.round(fv.current.wind_gusts_10m ?? fv.current.wind_speed_10m),
          winds: winds.length ? winds : [Math.round(fv.current.wind_speed_10m)],
          wave: mv?.current?.wave_height ?? null,
          period: mv?.current?.wave_period ?? null,
          sst: mv?.current?.sea_surface_temperature ?? null,
          visNm: visM != null ? Math.round(visM / 1852) : null,
        });
      } catch {
        if (ok) setErr(true);
      }
    })();
    return () => { ok = false; };
  }, [lat, lon]);

  const wind = live?.wind ?? null;
  const color = wind != null ? windColor(wind) : "var(--fg-dim)";

  return (
    <div className="glass live-card fade-up" style={{ animationDelay: ".15s" }}>
      <div className="between" style={{ marginBottom: 18 }}>
        <div className="center gap-8">
          <span className="live-dot" />
          <span className="mono" style={{ fontSize: 12, letterSpacing: 1 }}>
            LIVE · {name.toUpperCase()}
          </span>
        </div>
        <span className="pill"><Satellite size={12} /> Open-Meteo</span>
      </div>

      <div className="flex" style={{ alignItems: "flex-end", gap: 18, marginBottom: 20 }}>
        <div>
          <div className="display" style={{ fontSize: 64, lineHeight: 1, color }}>
            {wind ?? "—"}
            <span style={{ fontSize: 22, color: "var(--fg-dim)" }}> kt</span>
          </div>
          <div className="dim mono" style={{ fontSize: 12, marginTop: 6 }}>
            {live ? `gusting ${live.gust} · B${beaufort(live.wind)}` : err ? "offline — no live data" : "loading…"}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {live && <Sparkline data={live.winds} w={200} h={56} color={color} />}
        </div>
      </div>

      <div className="live-grid">
        <LiveCell icon={<Waves size={16} />} label="Swell"
          v={live?.wave != null ? `${live.wave.toFixed(1)}m` : "—"}
          sub={live?.period != null ? `${Math.round(live.period)}s` : ""} />
        <LiveCell icon={<Thermometer size={16} />} label="Sea"
          v={live?.sst != null ? `${Math.round(live.sst)}°` : "—"} sub="" />
        <LiveCell icon={<Eye size={16} />} label="Visibility"
          v={live?.visNm != null ? `${live.visNm} NM` : "—"}
          sub={live?.visNm != null ? (live.visNm >= 5 ? "good" : "poor") : ""} />
      </div>

      <Link href={passageHref} className="btn btn-primary" style={{ width: "100%", marginTop: 18 }}>
        <Compass size={16} /> Open active passage{to ? ` · ${name} → ${to}` : ""}
      </Link>
    </div>
  );
}

function LiveCell({ icon, label, v, sub }: { icon: React.ReactNode; label: string; v: string; sub: string }) {
  return (
    <div className="live-cell">
      <span style={{ color: "var(--cyan)", opacity: 0.85, display: "flex" }}>{icon}</span>
      <div>
        <div className="faint mono" style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {v} {sub && <span className="faint" style={{ fontSize: 11 }}>{sub}</span>}
        </div>
      </div>
    </div>
  );
}
