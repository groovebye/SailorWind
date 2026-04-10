"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

interface Port {
  name: string; lat: number; lon: number; type: string; coastlineNm: number;
}
interface Waypoint { port: Port; isStop: boolean; isCape: boolean; sortOrder: number; }
interface Passage {
  id: string; shortId: string; name: string | null;
  waypoints: Waypoint[];
}

const PassageMap = dynamic(() => import("./PassageMap"), { ssr: false });

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [passage, setPassage] = useState<Passage | null>(null);

  useEffect(() => {
    fetch(`/api/passage?id=${id}`)
      .then((r) => r.json())
      .then(setPassage);
  }, [id]);

  if (!passage) return <div className="h-screen flex items-center justify-center text-slate-400">Loading...</div>;

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-4">
        <Link
          href={`/p/${id}`}
          className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
        >
          ← Back to Passage
        </Link>
        <h1 className="text-sm font-semibold text-blue-400">
          {passage.name || "Passage"} — Map
        </h1>
      </div>
      <div className="flex-1">
        <PassageMap waypoints={passage.waypoints} />
      </div>
    </div>
  );
}
