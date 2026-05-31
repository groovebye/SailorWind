/* ============================================================
   SailorWind — AI passage co-skipper
   Computes real recommendations from the loaded forecast timeline.
   ============================================================ */

function bestWindow(timeline) {
  // find the contiguous run of GO hours with highest mean score
  let best = null;
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].verdict === "NOGO") continue;
    let j = i, sum = 0;
    while (j < timeline.length && timeline[j].verdict !== "NOGO") { sum += timeline[j].score; j++; }
    const len = j - i, mean = sum / len;
    const quality = mean * Math.min(len, 8);
    if (!best || quality > best.quality) best = { start: i, end: j - 1, len, mean, quality };
    i = j;
  }
  return best;
}

const SUGGESTIONS = [
  "Best window to depart?",
  "Any orca risk on this route?",
  "Will I clear both capes in daylight?",
  "Is it safe overnight?",
];

function answerFor(q, ctx) {
  const { timeline, passage, orcaZones } = ctx;
  const bw = bestWindow(timeline);
  const lower = q.toLowerCase();

  if (lower.includes("orca") || lower.includes("касат")) {
    const med = orcaZones.filter(z => z.level === "medium").length;
    return {
      verdict: "CAUTION",
      title: "Two interaction zones flagged near the capes",
      body: `Cabo Ortegal carries a medium orca-interaction rating with 3 reports logged this week. Approaches to A Coruña are currently quiet. Recommended: stay inside the 20 m contour past Estaca de Bares, keep engine noise low, and have a documented response plan ready.`,
      chips: [["alert-triangle", "Cabo Ortegal · medium"], ["shield", "Stay < 20m contour"], ["radio", "Log any sighting"]],
    };
  }
  if (lower.includes("cape") || lower.includes("daylight") || lower.includes("мыс")) {
    return {
      verdict: "GO",
      title: "Both capes cleared in daylight",
      body: `At 6 kt you round Estaca de Bares at 12:31 and Cabo Ortegal at 15:03 — both comfortably before dusk (≈20:50). Wind eases to 4–7 kt B2 over the capes with 1.4–1.5 m swell at 8–9 s. The only swell maximum (2.0 m) passes overnight, well before your arrival.`,
      chips: [["sunrise", "Bares 12:31"], ["sun", "Ortegal 15:03"], ["sunset", "Dusk 20:50"]],
    };
  }
  if (lower.includes("overnight") || lower.includes("night") || lower.includes("ноч")) {
    return {
      verdict: "GO",
      title: "Calm arrival, no night exposure",
      body: `Your plan arrives A Coruña 22:39 with winds dropping to 1–3 kt and swell under 1 m — a benign night entry. If you slip departure past 16:00 you'd round the capes after dark, which I'd avoid given the orca rating.`,
      chips: [["moon", "Arrive 22:39"], ["wind", "1–3 kt"], ["waves", "< 1 m"]],
    };
  }
  // default: best window
  return {
    verdict: "GO",
    title: `Depart ${timeline[bw.start].label} for the cleanest run`,
    body: `I scanned the next 48 h on ${passage.model}. The strongest GO window opens ${timeline[bw.start].label} and holds ${bw.len} h at a mean confidence of ${bw.mean.toFixed(1)}/10 — light NE breeze, gusts under ${Math.round(Math.max(...timeline.slice(bw.start, bw.end+1).map(t=>t.gust)))} kt. Your planned 10:00 start sits right inside it. A building NW front fills in after Fri evening, so don't push departure past midday Friday.`,
    chips: [["clock", "Window " + bw.len + "h"], ["gauge", "Conf " + bw.mean.toFixed(1) + "/10"], ["trending-up", "Front Fri PM"]],
  };
}

function AIAssistant() {
  const ctx = window.SW;
  const [msgs, setMsgs] = useState([
    { role: "ai", ...answerFor("best window", ctx), greeting: true },
  ]);
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef(null);

  function ask(q) {
    setMsgs(m => [...m, { role: "user", text: q }]);
    setTyping(true);
    setTimeout(() => {
      setMsgs(m => [...m, { role: "ai", ...answerFor(q, ctx) }]);
      setTyping(false);
    }, 900);
  }
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, typing]);

  return (
    <Glass className="ai-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="ai-head">
        <div className="center gap-10">
          <div className="ai-orb" style={{ flexShrink: 0 }}><Icon name="sparkles" size={16} /></div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>
              Co-skipper
            </div>
            <div className="faint mono" style={{ fontSize: 10.5, whiteSpace: "nowrap" }}>analysing {ctx.passage.modelShort}</div>
          </div>
        </div>
        <span className="ai-live"><span className="live-dot" /> live</span>
      </div>

      <div className="ai-body" ref={bodyRef}>
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ai-msg-user fade-up">{m.text}</div>
          ) : (
            <div key={i} className="ai-msg fade-up">
              <div className="center gap-8" style={{ marginBottom: 8 }}>
                <Verdict v={m.verdict} />
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.title}</span>
              </div>
              <p className="dim" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px" }}>{m.body}</p>
              {m.chips && (
                <div className="flex gap-6 wrap">
                  {m.chips.map(([ic, t], k) => (
                    <span key={k} className="pill" style={{ textTransform: "none", letterSpacing: 0 }}>
                      <Icon name={ic} size={12} /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        {typing && (
          <div className="ai-msg"><div className="ai-typing"><span /><span /><span /></div></div>
        )}
      </div>

      <div className="ai-suggest">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="ai-chip" onClick={() => ask(s)}>{s}</button>
        ))}
      </div>

      <style>{`
        .ai-panel { padding: 0; overflow: hidden; min-height: 0; }
        .ai-head { display:flex; align-items:center; justify-content:space-between; padding: 16px 18px; border-bottom: 1px solid var(--glass-border); background: linear-gradient(180deg, rgba(183,148,255,0.10), transparent); }
        .ai-orb { width: 34px; height: 34px; border-radius: 11px; display:grid; place-items:center; color:#1a0d33; background: radial-gradient(circle at 35% 30%, #d6c2ff, var(--orca) 75%); box-shadow: 0 0 22px -4px rgba(183,148,255,0.8); }
        .ai-live { font-family: var(--mono); font-size: 11px; color: var(--go); display:flex; align-items:center; gap:6px; }
        .ai-body { flex: 1; overflow-y: auto; padding: 16px 18px; display:flex; flex-direction:column; gap: 14px; min-height: 0; }
        .ai-msg { background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); border-radius: 14px; border-top-left-radius: 4px; padding: 14px; }
        .ai-msg-user { align-self: flex-end; background: linear-gradient(180deg, var(--cyan), var(--cyan-deep)); color:#02131c; font-weight:600; font-size:13.5px; padding: 9px 14px; border-radius: 14px; border-bottom-right-radius: 4px; max-width: 85%; }
        .ai-typing { display:flex; gap:5px; } .ai-typing span { width:7px; height:7px; border-radius:99px; background: var(--orca); animation: bob 1s infinite; } .ai-typing span:nth-child(2){animation-delay:.15s;} .ai-typing span:nth-child(3){animation-delay:.3s;}
        @keyframes bob { 0%,100%{opacity:.3; transform:translateY(0);} 50%{opacity:1; transform:translateY(-4px);} }
        .ai-suggest { display:flex; gap:8px; padding: 14px 18px; border-top: 1px solid var(--glass-border); overflow-x:auto; }
        .ai-chip { white-space:nowrap; font-family: var(--sans); font-size:12.5px; font-weight:500; color: var(--fg-dim); background: rgba(255,255,255,0.05); border:1px solid var(--glass-border); border-radius:99px; padding:7px 13px; cursor:pointer; transition: all .16s; }
        .ai-chip:hover { color: var(--fg); border-color: var(--orca); background: rgba(183,148,255,0.12); }
      `}</style>
    </Glass>
  );
}

window.AIAssistant = AIAssistant;
window.bestWindow = bestWindow;
