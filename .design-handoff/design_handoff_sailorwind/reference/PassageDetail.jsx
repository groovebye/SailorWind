/* ============================================================
   SailorWind — Passage Detail (planning) view
   ============================================================ */

function PassageDetail({ onBack, onOpenMap }) {
  const { passage, fc, timeline } = window.SW;
  const [depIdx, setDepIdx] = useState(0); // index into timeline (planned 10:00 = 0)
  const [speed, setSpeed] = useState(passage.speed);
  const [mode, setMode] = useState(passage.mode);
  const [model, setModel] = useState("ecmwf");
  const [openWp, setOpenWp] = useState(passage.wp[0].name);

  const overall = passage.wp.every(w => w.verdict === "GO") ? "GO"
    : passage.wp.some(w => w.verdict === "NOGO") ? "NOGO" : "CAUTION";

  return (
    <div className="view-scroll" key="passage">
      <div className="container" style={{ paddingTop: 24, paddingBottom: 80 }}>

        {/* breadcrumb + title */}
        <div className="between fade-up" style={{ marginBottom: 18, flexWrap: "wrap", gap: 14 }}>
          <div className="center gap-12">
            <button className="btn btn-sm btn-ghost" onClick={onBack}><Icon name="arrow-left" size={16} /> Home</button>
            <div className="pd-title">
              <span className="route-port">{passage.from}</span>
              <Icon name="arrow-right" size={18} style={{ color: "var(--cyan)" }} />
              <span className="route-port">{passage.to}</span>
            </div>
          </div>
          <div className="flex gap-8">
            <span className="pill"><Icon name="sailboat" size={13} /> {passage.boat} · {passage.boatModel}</span>
            <button className="btn btn-sm" onClick={onOpenMap}><Icon name="map" size={15} /> Map</button>
            <button className="btn btn-sm btn-ghost"><Icon name="external-link" size={15} /> Windy</button>
            <button className="btn btn-sm btn-primary"><Icon name="refresh-cw" size={15} /> Update</button>
          </div>
        </div>

        {/* config bar */}
        <Glass className="config-bar fade-up" style={{ animationDelay: ".05s" }}>
          <ConfigField label="Departure" icon="calendar">
            <select className="select" value={depIdx} onChange={e => setDepIdx(+e.target.value)}>
              {timeline.slice(0, 24).map((t, i) => (
                <option key={i} value={i}>{t.label}</option>
              ))}
            </select>
          </ConfigField>
          <ConfigField label="Boat speed" icon="gauge">
            <div className="center gap-10">
              <input type="range" min="3" max="9" step="0.5" value={speed} onChange={e => setSpeed(+e.target.value)} className="range" />
              <span className="mono" style={{ fontSize: 16, fontWeight: 600, minWidth: 52 }}>{speed} kt</span>
            </div>
          </ConfigField>
          <ConfigField label="Mode" icon="route">
            <div className="seg">
              {["Non-stop", "Day-hops"].map(m => (
                <div key={m} className={"seg-opt " + (mode === m ? "active" : "")} onClick={() => setMode(m)}>{m}</div>
              ))}
            </div>
          </ConfigField>
          <ConfigField label="Weather model" icon="satellite">
            <div className="seg">
              <div className={"seg-opt " + (model === "gfs" ? "active" : "")} onClick={() => setModel("gfs")}>GFS</div>
              <div className={"seg-opt " + (model === "ecmwf" ? "active" : "")} onClick={() => setModel("ecmwf")}>ECMWF</div>
              <div className={"seg-opt " + (model === "ens" ? "active" : "")} onClick={() => setModel("ens")}>Ensemble</div>
            </div>
          </ConfigField>
        </Glass>

        {/* summary stats row */}
        <div className="pd-stats fade-up" style={{ animationDelay: ".1s" }}>
          <BigStat icon="navigation" value={passage.nm} unit="NM" label="Distance" />
          <BigStat icon="clock" value={"~" + passage.hours} unit="h" label="Duration" />
          <BigStat icon="triangle" value={passage.capes} unit="" label="Capes" />
          <BigStat icon="anchor" value={passage.wp.length} unit="" label="Waypoints" />
          <Glass className="big-stat verdict-stat" style={{ ["--vc"]: overall === "GO" ? "var(--go)" : overall === "NOGO" ? "var(--nogo)" : "var(--caution)" }}>
            <div className="faint mono" style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase" }}>Verdict</div>
            <Verdict v={overall} size="lg" />
            <div className="faint mono" style={{ fontSize: 11, marginTop: 4 }}>{passage.departure.split(",")[0]} · {passage.departure.split(", ")[1]} → {passage.arrival.split(", ")[1]}</div>
          </Glass>
        </div>

        {/* main grid: timeline+tables | AI sidebar */}
        <div className="pd-grid">
          <div className="col gap-20">
            {/* departure window timeline */}
            <Glass className="fade-up" style={{ padding: 22, animationDelay: ".15s" }}>
              <div className="between" style={{ marginBottom: 6 }}>
                <div className="center gap-10">
                  <div className="sec-icon" style={{ width: 32, height: 32 }}><Icon name="activity" size={16} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>Departure window</div>
                    <div className="faint mono" style={{ fontSize: 11 }}>next 48h · drag to choose your start</div>
                  </div>
                </div>
                <span className="pill"><Icon name="info" size={12} /> aggregate GO/NO-GO score</span>
              </div>
              <DepartureTimeline timeline={timeline} depIdx={depIdx} setDepIdx={setDepIdx} />
            </Glass>

            {/* passage summary */}
            <Glass className="fade-up" style={{ padding: 0, animationDelay: ".2s", overflow: "hidden" }}>
              <div className="pd-table-head">
                <div className="center gap-10">
                  <Icon name="table-2" size={16} style={{ color: "var(--cyan)" }} />
                  <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>Passage summary</span>
                </div>
                <span className="faint mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{passage.nm} NM · {passage.wp.length} waypoints</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Waypoint</th><th>ETA</th><th>Wind</th>
                      <th className="hide-mobile">Gust</th><th className="hide-mobile">Waves</th>
                      <th className="hide-mobile">Swell</th><th>Power</th><th>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passage.wp.map((w) => (
                      <tr key={w.name} onClick={() => setOpenWp(w.name)}>
                        <td>
                          <div className="center gap-8">
                            <WpDot type={w.type} />
                            <span style={{ fontWeight: 600 }}>{w.name}</span>
                            {w.type === "CAPE" && <span className="pill" style={{ fontSize: 9.5, color: "var(--caution)" }}>cape</span>}
                          </div>
                        </td>
                        <td className="num dim">{w.eta}</td>
                        <td><WindCell kt={w.wind} bf={w.bf} /></td>
                        <td className="num hide-mobile" style={{ color: windColor(w.gust) }}>{w.gust}</td>
                        <td className="num dim hide-mobile">{w.wave}</td>
                        <td className="num dim hide-mobile">{w.swell}</td>
                        <td><PowerBar v={w.power} /></td>
                        <td><Verdict v={w.verdict} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Glass>

            {/* detailed forecast */}
            <Glass className="fade-up" style={{ padding: 22, animationDelay: ".25s" }}>
              <div className="center gap-10" style={{ marginBottom: 16 }}>
                <Icon name="line-chart" size={16} style={{ color: "var(--cyan)" }} />
                <span style={{ fontWeight: 600 }}>Detailed forecast by waypoint</span>
              </div>
              <div className="flex gap-8 wrap" style={{ marginBottom: 18 }}>
                {passage.wp.map(w => (
                  <button key={w.name} className={"wp-tab " + (openWp === w.name ? "active" : "")} onClick={() => setOpenWp(w.name)}>
                    {w.name}
                  </button>
                ))}
              </div>
              <ForecastChart rows={fc[openWp] || fc["Viveiro"]} />
            </Glass>

            <div className="disclaimer">
              <Icon name="shield-alert" size={14} />
              Planning aid only. Cross-check with AEMET, MeteoGalicia and real-time conditions before departure.
            </div>
          </div>

          {/* sidebar */}
          <div className="pd-side">
            <AIAssistant />
            <OrcaAlert onOpenMap={onOpenMap} />
          </div>
        </div>
      </div>
      <style>{passageStyles}</style>
    </div>
  );
}

function ConfigField({ label, icon, children }) {
  return (
    <div className="config-field">
      <div className="field-label center gap-6"><Icon name={icon} size={12} /> {label}</div>
      {children}
    </div>
  );
}

function BigStat({ icon, value, unit, label }) {
  return (
    <Glass className="big-stat">
      <Icon name={icon} size={17} style={{ color: "var(--cyan)", opacity: 0.8 }} />
      <div className="stat-num" style={{ fontSize: 30, marginTop: 8 }}>{value}<span style={{ fontSize: 15, color: "var(--fg-dim)" }}>{unit}</span></div>
      <div className="faint mono" style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
    </Glass>
  );
}

function WpDot({ type }) {
  const c = type === "STOP" ? "var(--cyan)" : type === "CAPE" ? "var(--caution)" : "var(--fg-faint)";
  return <span style={{ width: 9, height: 9, borderRadius: type === "CAPE" ? 2 : 99, background: c, boxShadow: `0 0 8px ${c}`, transform: type === "CAPE" ? "rotate(45deg)" : "none", flexShrink: 0 }} />;
}

function WindCell({ kt, bf }) {
  return (
    <span className="center gap-8">
      <span className="mono" style={{ fontWeight: 600, color: windColor(kt) }}>{kt}</span>
      <span className="bf-chip" style={{ background: bfColor(bf) + "22", color: bfColor(bf) }}>B{bf}</span>
    </span>
  );
}

function PowerBar({ v }) {
  const pct = Math.min(100, (v / 14) * 100);
  const c = v < 5 ? "var(--go)" : v < 10 ? "var(--cyan)" : v < 13 ? "var(--caution)" : "var(--nogo)";
  return (
    <span className="center gap-8">
      <span className="power-track"><span className="power-fill" style={{ width: pct + "%", background: c }} /></span>
      <span className="mono" style={{ fontSize: 12, minWidth: 26 }}>{v}</span>
    </span>
  );
}

/* ---- Interactive departure timeline ---- */
function DepartureTimeline({ timeline, depIdx, setDepIdx }) {
  const trackRef = useRef(null);
  const drag = useRef(false);
  const cur = timeline[depIdx];

  function pick(clientX) {
    const r = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setDepIdx(Math.round(p * (timeline.length - 1)));
  }
  useEffect(() => {
    const move = (e) => { if (drag.current) pick(e.clientX); };
    const up = () => (drag.current = false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [timeline]);

  return (
    <div>
      <div className="between" style={{ margin: "14px 0 10px" }}>
        <div>
          <div className="display" style={{ fontSize: 22, whiteSpace: "nowrap" }}>{cur.label}</div>
          <div className="faint mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>start of passage</div>
        </div>
        <div className="center gap-16">
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 13, color: windColor(cur.wind), whiteSpace: "nowrap" }}>{cur.wind} kt · gust {cur.gust}</div>
            <div className="faint mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>confidence {cur.score}/10</div>
          </div>
          <Verdict v={cur.verdict} size="lg" />
        </div>
      </div>
      <div className="tl-track" ref={trackRef}
        onMouseDown={(e) => { drag.current = true; pick(e.clientX); }}>
        {timeline.map((t, i) => {
          const c = t.verdict === "GO" ? "var(--go)" : t.verdict === "CAUTION" ? "var(--caution)" : "var(--nogo)";
          return <div key={i} className="tl-bar" style={{ height: (18 + t.score * 6.4) + "px", background: c, opacity: i === depIdx ? 1 : 0.42 }} title={t.label + " · " + t.verdict} />;
        })}
        <div className="tl-marker" style={{ left: (depIdx / (timeline.length - 1)) * 100 + "%" }}>
          <div className="tl-handle"><Icon name="chevrons-left-right" size={13} /></div>
        </div>
      </div>
      <div className="tl-axis">
        <span>Now</span><span>+12h</span><span>+24h</span><span>+36h</span><span>+48h</span>
      </div>
    </div>
  );
}

/* ---- Forecast bar chart (3h) ---- */
function ForecastChart({ rows }) {
  const maxG = Math.max(...rows.map(r => r[3]));
  return (
    <div>
      <div className="fc-chart">
        {rows.map((r, i) => {
          const [time, wind, bf, gust] = r;
          return (
            <div key={i} className="fc-col" style={{ animationDelay: i * 0.04 + "s" }}>
              <div className="fc-gust" style={{ height: (gust / maxG * 130) + "px" }} />
              <div className="fc-wind" style={{ height: (wind / maxG * 130) + "px", background: windColor(wind) }}>
                <span className="fc-val mono">{wind}</span>
              </div>
              <div className="fc-time mono">{time}</div>
              <div className="bf-chip" style={{ background: bfColor(bf) + "22", color: bfColor(bf), marginTop: 4 }}>B{bf}</div>
            </div>
          );
        })}
      </div>
      <div className="center gap-16" style={{ marginTop: 16, justifyContent: "center" }}>
        <Legend c="var(--cyan)" label="Wind (kt)" />
        <Legend c="rgba(255,255,255,0.18)" label="Gust" />
        <span className="faint mono" style={{ fontSize: 11 }}>· 3-hour steps · all GO</span>
      </div>
    </div>
  );
}
function Legend({ c, label }) {
  return <span className="center gap-6 faint mono" style={{ fontSize: 11 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: c }} /> {label}</span>;
}

/* ---- Orca alert sidebar card ---- */
function OrcaAlert({ onOpenMap }) {
  return (
    <Glass className="orca-card" style={{ padding: 18 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <div className="center gap-10">
          <div className="orca-orb"><Icon name="alert-triangle" size={15} /></div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Orca watch</div>
            <div className="faint mono" style={{ fontSize: 10.5 }}>2 zones on route</div>
          </div>
        </div>
        <span className="pill"><Icon name="radio" size={12} /> live</span>
      </div>
      <div className="orca-row">
        <span className="center gap-8"><span className="orca-lvl" style={{ background: "var(--orca)" }} /> Cabo Ortegal</span>
        <span className="mono faint" style={{ fontSize: 11 }}>medium · 3 reports</span>
      </div>
      <div className="orca-row">
        <span className="center gap-8"><span className="orca-lvl" style={{ background: "var(--sky)" }} /> A Coruña approach</span>
        <span className="mono faint" style={{ fontSize: 11 }}>low · quiet</span>
      </div>
      <button className="btn btn-sm" style={{ width: "100%", marginTop: 12 }} onClick={onOpenMap}>
        <Icon name="map-pin" size={14} /> View zones on chart
      </button>
    </Glass>
  );
}

const passageStyles = `
.pd-title { display:flex; align-items:center; gap:12px; }
.pd-title .route-port { font-size: 26px; }
.config-bar { display:grid; grid-template-columns: 1.1fr 1.2fr 1fr 1.2fr; gap: 22px; padding: 18px 22px; margin-bottom: 18px; }
.config-field { display:flex; flex-direction:column; }
.range { -webkit-appearance:none; appearance:none; height: 5px; border-radius:99px; background: linear-gradient(90deg, var(--cyan), var(--cyan-deep)); flex:1; cursor:pointer; }
.range::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:99px; background:#fff; box-shadow: 0 2px 10px rgba(0,0,0,.4); cursor:pointer; }
.pd-stats { display:grid; grid-template-columns: repeat(4, 1fr) 1.6fr; gap: 14px; margin-bottom: 22px; }
.big-stat { padding: 18px; display:flex; flex-direction:column; }
.verdict-stat { background: linear-gradient(180deg, color-mix(in srgb, var(--vc) 14%, transparent), transparent); border-color: color-mix(in srgb, var(--vc) 40%, var(--glass-border)); gap: 8px; }
.pd-grid { display:grid; grid-template-columns: 1fr 380px; gap: 20px; align-items:start; }
.pd-side { position: sticky; top: 88px; display:flex; flex-direction:column; gap: 16px; max-height: calc(100vh - 110px); }
.pd-side .ai-panel { flex: 1; min-height: 360px; }
.pd-table-head { display:flex; align-items:center; justify-content:space-between; padding: 16px 18px; border-bottom: 1px solid var(--glass-border); }
.bf-chip { font-family: var(--mono); font-size: 10px; font-weight:600; padding: 2px 6px; border-radius: 5px; }
.power-track { width: 54px; height: 6px; border-radius:99px; background: rgba(255,255,255,0.08); overflow:hidden; }
.power-fill { display:block; height:100%; border-radius:99px; transition: width .6s cubic-bezier(.2,.7,.2,1); }
.wp-tab { font-family: var(--sans); font-size: 13px; font-weight:500; color: var(--fg-dim); background: rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:99px; padding:7px 14px; cursor:pointer; transition: all .16s; }
.wp-tab:hover { color: var(--fg); } .wp-tab.active { background: var(--glass-hi); color: var(--fg); border-color: var(--glass-border-hi); }
.tl-track { position:relative; display:flex; align-items:flex-end; gap: 2px; height: 110px; padding: 0 2px; cursor: ew-resize; border-radius: 10px; }
.tl-bar { flex:1; border-radius: 3px 3px 0 0; transition: opacity .15s; }
.tl-marker { position:absolute; top:-6px; bottom:-6px; width:2px; background: #fff; box-shadow: 0 0 12px rgba(255,255,255,0.8); pointer-events:none; }
.tl-handle { position:absolute; top:-12px; left:50%; transform: translateX(-50%); width:26px; height:26px; border-radius:8px; background:#fff; color:#02131c; display:grid; place-items:center; box-shadow: 0 4px 14px rgba(0,0,0,.5); }
.tl-axis { display:flex; justify-content:space-between; margin-top:10px; font-family: var(--mono); font-size:10.5px; color: var(--fg-faint); }
.fc-chart { display:flex; align-items:flex-end; gap: 6px; height: 200px; padding-top: 10px; }
.fc-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; position:relative; animation: fadeUp .5s both; }
.fc-gust { position:absolute; bottom: 44px; width: 60%; background: rgba(255,255,255,0.10); border-radius: 4px 4px 0 0; }
.fc-wind { width: 70%; border-radius: 4px 4px 0 0; position:relative; display:flex; justify-content:center; min-height: 6px; }
.fc-val { position:absolute; top:-18px; font-size: 11px; font-weight:600; }
.fc-time { font-size: 10px; color: var(--fg-faint); margin-top: 6px; }
.disclaimer { display:flex; align-items:center; gap:10px; font-size:12.5px; color: var(--fg-faint); font-family: var(--mono); padding: 14px 16px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid var(--glass-border); }
.orca-card { background: linear-gradient(180deg, rgba(183,148,255,0.08), transparent); }
.orca-orb { width:32px; height:32px; border-radius:10px; display:grid; place-items:center; color: var(--orca); background: rgba(183,148,255,0.14); }
.orca-row { display:flex; align-items:center; justify-content:space-between; padding: 9px 0; border-top: 1px solid var(--glass-border); font-size: 13px; }
.orca-lvl { width:8px; height:8px; border-radius:99px; }
@media (max-width: 1080px) {
  .pd-grid { grid-template-columns: 1fr; }
  .pd-side { position: static; max-height: none; }
  .pd-side .ai-panel { min-height: 420px; }
  .config-bar { grid-template-columns: 1fr 1fr; }
  .pd-stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) { .config-bar { grid-template-columns: 1fr; } .pd-stats { grid-template-columns: 1fr 1fr; } }
`;

window.PassageDetail = PassageDetail;
