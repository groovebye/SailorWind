"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Navigation, Clock, MapPin, Triangle, Trash2 } from "lucide-react";

export type PassageCard = {
  id: string; from: string; to: string; date: string;
  nm: number; hours: number; capes: number; wp: number; mode: string;
};

export default function RecentPassages({ cards }: { cards: PassageCard[] }) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function del(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/passage?id=${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="passage-grid stagger">
      {cards.map((p, i) => (
        <div
          key={p.id}
          className="glass glass-hover passage-card"
          style={{ animationDelay: i * 0.05 + "s", padding: 20, position: "relative" }}
        >
          {/* full-card click target → open passage */}
          <Link href={`/p/${p.id}`} aria-label={`${p.from} to ${p.to}`} style={{ position: "absolute", inset: 0, zIndex: 1, borderRadius: "inherit" }} />

          <button
            type="button"
            className="passage-del"
            aria-label="Delete passage"
            onClick={() => setConfirmId(p.id)}
            style={{ position: "absolute", top: 10, right: 10, zIndex: 2 }}
          >
            <Trash2 size={15} />
          </button>

          <div className="between" style={{ marginBottom: 16 }}>
            <span className="mono faint" style={{ fontSize: 12 }}>{p.date}</span>
            <span className="pill" style={{ marginRight: 30 }}>{p.mode}</span>
          </div>
          <div className="route-line">
            <span className="route-port">{p.from}</span>
            <span className="route-arrow"><Navigation size={16} style={{ transform: "rotate(90deg)" }} /></span>
            <span className="route-port">{p.to}</span>
          </div>
          <div className="flex gap-16 wrap" style={{ marginTop: 16 }}>
            <Metric icon={<Navigation size={14} />} v={`${p.nm} NM`} />
            <Metric icon={<Clock size={14} />} v={`~${p.hours}h`} />
            <Metric icon={<MapPin size={14} />} v={`${p.wp} wp`} />
            {p.capes > 0 && <Metric icon={<Triangle size={14} />} v={`${p.capes} cape${p.capes > 1 ? "s" : ""}`} />}
          </div>
          <div className="passage-card-glow" />

          {confirmId === p.id && (
            <div className="passage-confirm">
              <div style={{ fontWeight: 600, fontSize: 15 }}>Delete this passage?</div>
              <div className="dim mono" style={{ fontSize: 12 }}>{p.from} → {p.to}</div>
              <div className="center gap-8" style={{ marginTop: 4 }}>
                <button type="button" className="btn btn-sm btn-danger" disabled={busyId === p.id} onClick={() => del(p.id)}>
                  {busyId === p.id ? "Deleting…" : "Delete"}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" disabled={busyId === p.id} onClick={() => setConfirmId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Metric({ icon, v }: { icon: React.ReactNode; v: string }) {
  return (
    <span className="center gap-6 dim" style={{ fontSize: 13 }}>
      <span style={{ opacity: 0.7, display: "flex" }}>{icon}</span> <span className="mono">{v}</span>
    </span>
  );
}
