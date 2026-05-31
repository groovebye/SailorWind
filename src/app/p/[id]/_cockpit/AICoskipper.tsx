"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, AlertTriangle, Shield, Radio, Sunrise, Sun, Sunset, Moon, Wind, Waves, Clock, Gauge, TrendingUp } from "lucide-react";
import { Verdict } from "@/components/design/Primitives";
import type { VerdictV } from "@/components/design/helpers";
import { bestWindow, type TimelineHour, type WP } from "./forecast";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  "alert-triangle": AlertTriangle, shield: Shield, radio: Radio, sunrise: Sunrise,
  sun: Sun, sunset: Sunset, moon: Moon, wind: Wind, waves: Waves, clock: Clock,
  gauge: Gauge, "trending-up": TrendingUp,
};

type Ctx = {
  timeline: TimelineHour[];
  wps: WP[];
  capeEtas: { name: string; eta: string }[];
  arrival: string | null;
  modelShort: string;
};
type Answer = { verdict: VerdictV; title: string; body: string; chips: [string, string][] };

function answerFor(q: string, ctx: Ctx): Answer {
  const bw = bestWindow(ctx.timeline);
  const lower = q.toLowerCase();
  const orcaWps = ctx.wps.filter((w) => w.orcaRisk && w.orcaRisk !== "none" && w.orcaRisk !== "low");

  if (lower.includes("orca") || lower.includes("касат")) {
    if (!orcaWps.length) {
      return {
        verdict: "GO",
        title: "No elevated orca zones flagged on this route",
        body: "None of the waypoints on this passage carry a medium or high orca-interaction rating. Stay alert south of Estaca de Bares and along the Cádiz–Strait stretch generally, keep a sighting log, and have a response plan ready regardless.",
        chips: [["shield", "Plan ready"], ["radio", "Log sightings"]],
      };
    }
    return {
      verdict: "CAUTION",
      title: `${orcaWps.length} interaction zone${orcaWps.length > 1 ? "s" : ""} on route`,
      body: `Elevated orca-interaction ratings at ${orcaWps.map((w) => w.name).join(", ")}. Recommended: stay inside the 20 m contour where practical, keep engine noise low, slow or stop and disengage the autopilot if approached, and log any sighting.`,
      chips: [["alert-triangle", `${orcaWps[0].name} · ${orcaWps[0].orcaRisk}`], ["shield", "Stay < 20m contour"], ["radio", "Log any sighting"]],
    };
  }
  if (lower.includes("cape") || lower.includes("daylight") || lower.includes("мыс")) {
    if (!ctx.capeEtas.length) {
      return { verdict: "GO", title: "No capes on this leg", body: "This passage doesn't round any flagged headland — no daylight-rounding constraint to plan around.", chips: [["sun", "No capes"]] };
    }
    return {
      verdict: "GO",
      title: "Cape rounding times",
      body: `At your planned speed you round ${ctx.capeEtas.map((c) => `${c.name} ${c.eta}`).join(", ")}. Aim to be past every headland in daylight — rounding a cape after dark adds sea-state and orca risk for little gain.`,
      chips: ctx.capeEtas.slice(0, 3).map((c) => ["sun", `${c.name} ${c.eta}`] as [string, string]),
    };
  }
  if (lower.includes("overnight") || lower.includes("night") || lower.includes("ноч")) {
    return {
      verdict: ctx.arrival ? "GO" : "CAUTION",
      title: ctx.arrival ? `Arrival around ${ctx.arrival}` : "Check the arrival window",
      body: `Plan the arrival in daylight or into a well-lit, all-tide harbour. If slipping departure pushes a cape rounding or a tricky entrance past dusk, hold for the next morning window instead.`,
      chips: [["moon", ctx.arrival ? `Arrive ${ctx.arrival}` : "Arrival TBD"]],
    };
  }
  // default: best window
  if (!bw) {
    return { verdict: "NOGO", title: "No clean window in the next 48 h", body: "Every hour in the next two days scores NO-GO on the current model — too much wind/gust. Re-check after the next model run or widen the horizon.", chips: [["trending-up", "Re-check later"]] };
  }
  const maxGust = Math.round(Math.max(...ctx.timeline.slice(bw.start, bw.end + 1).map((t) => t.gust)));
  return {
    verdict: "GO",
    title: `Depart ${ctx.timeline[bw.start].label} for the cleanest run`,
    body: `I scanned the next 48 h on ${ctx.modelShort}. The strongest window opens ${ctx.timeline[bw.start].label} and holds ${bw.len} h at a mean confidence of ${bw.mean.toFixed(1)}/10, with gusts under ${maxGust} kt. Drag the timeline to line your departure up inside it.`,
    chips: [["clock", `Window ${bw.len}h`], ["gauge", `Conf ${bw.mean.toFixed(1)}/10`], ["trending-up", `Gust < ${maxGust} kt`]],
  };
}

const SUGGESTIONS = ["Best window to depart?", "Any orca risk on this route?", "Will I clear the capes in daylight?", "Is it safe overnight?"];

type Msg = { role: "user"; text: string } | ({ role: "ai" } & Answer);

function AiBubble({ a }: { a: Answer }) {
  return (
    <div className="ai-msg fade-up">
      <div className="center gap-8" style={{ marginBottom: 8 }}>
        <Verdict v={a.verdict} />
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.title}</span>
      </div>
      <p className="dim" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px" }}>{a.body}</p>
      {a.chips.length > 0 && (
        <div className="flex gap-6 wrap">
          {a.chips.map(([ic, t], k) => {
            const I = ICONS[ic] ?? Clock;
            return (
              <span key={k} className="pill" style={{ textTransform: "none", letterSpacing: 0 }}>
                <I size={12} /> {t}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AICoskipper({ ctx }: { ctx: Ctx }) {
  // Greeting is derived from live ctx each render, so it updates once the forecast loads.
  const greeting = answerFor("best window", ctx);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function ask(q: string) {
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setTyping(true);
    timer.current = setTimeout(() => {
      setMsgs((m) => [...m, { role: "ai", ...answerFor(q, ctx) }]);
      setTyping(false);
    }, 800);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, typing]);

  return (
    <div className="glass ai-panel">
      <div className="ai-head">
        <div className="center gap-10">
          <div className="ai-orb" style={{ flexShrink: 0 }}><Sparkles size={16} /></div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>Co-skipper</div>
            <div className="faint mono" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>analysing {ctx.modelShort}</div>
          </div>
        </div>
        <span className="ai-live"><span className="live-dot" /> live</span>
      </div>

      <div className="ai-body" ref={bodyRef}>
        <AiBubble a={greeting} />
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ai-msg-user fade-up">{m.text}</div>
          ) : (
            <AiBubble key={i} a={m} />
          ),
        )}
        {typing && <div className="ai-msg"><div className="ai-typing"><span /><span /><span /></div></div>}
      </div>

      <div className="ai-suggest">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="ai-chip" onClick={() => ask(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
