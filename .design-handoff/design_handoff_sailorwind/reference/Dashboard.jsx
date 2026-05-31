/* ============================================================
   SailorWind — Dashboard view
   ============================================================ */

function Dashboard({ onOpenPassage, onNewPassage, onOpenMap }) {
  const { recent, ports } = window.SW;
  const totalNm = recent.reduce((a, p) => a + p.nm, 0);
  const nmCount = useCountUp(totalNm, 1200);
  const portCount = useCountUp(ports.length, 1000);
  const passCount = useCountUp(recent.length, 900);

  return (
    <div className="view-scroll" key="dash">
      <div className="container" style={{ paddingBottom: 80 }}>

        {/* HERO */}
        <section className="hero fade-up" style={{ paddingTop: 48 }}>
          <div className="hero-grid">
            <div>
              <div className="eyebrow" style={{ marginBottom: 18 }}>Bossanova · Hallberg-Rassy Monsun 31</div>
              <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 72px)", margin: "0 0 20px" }}>
                Plan the wind.<br />
                <span style={{ color: "var(--cyan)" }}>Sail the window.</span>
              </h1>
              <p className="dim" style={{ fontSize: 18, lineHeight: 1.55, maxWidth: 480, margin: "0 0 30px" }}>
                Cape-by-cape forecasts, a live GO/NO-GO departure timeline and my own
                co-skipper — tuned for the Atlantic coast from Biscay to Gibraltar.
              </p>
              <div className="flex gap-12 wrap">
                <button className="btn btn-primary btn-lg" onClick={onNewPassage}>
                  <Icon name="plus" size={18} /> New passage
                </button>
                <button className="btn btn-lg" onClick={onOpenMap}>
                  <Icon name="map" size={18} /> Open chart
                </button>
              </div>
              <div className="hero-stats">
                <Stat label="Passages planned" value={Math.round(passCount)} />
                <div className="stat-div" />
                <Stat label="Nautical miles" value={Math.round(nmCount).toLocaleString()} />
                <div className="stat-div" />
                <Stat label="Ports & marinas" value={Math.round(portCount)} />
              </div>
            </div>

            {/* live conditions glass card */}
            <LiveConditions onOpenPassage={onOpenPassage} />
          </div>
        </section>

        {/* RECENT PASSAGES */}
        <section style={{ marginTop: 64 }}>
          <SectionHead icon="route" title="Recent passages" sub="Pick up where you left off">
            <button className="btn btn-sm btn-ghost" onClick={onNewPassage}><Icon name="plus" size={15} /> New</button>
          </SectionHead>
          <div className="passage-grid stagger">
            {recent.map((p, i) => (
              <PassageCard key={p.id} p={p} i={i} onClick={() => onOpenPassage(p.id)} />
            ))}
          </div>
        </section>

        {/* PORTS & MARINAS */}
        <section style={{ marginTop: 64 }}>
          <PortsExplorer ports={ports} />
        </section>
      </div>

      <style>{dashStyles}</style>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="stat-num" style={{ fontSize: 26 }}>{value}</div>
      <div className="faint mono" style={{ fontSize: 11, letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionHead({ icon, title, sub, children }) {
  return (
    <div className="between" style={{ marginBottom: 22, alignItems: "flex-end" }}>
      <div className="center gap-12">
        <div className="sec-icon"><Icon name={icon} size={18} /></div>
        <div>
          <h2 className="display" style={{ fontSize: 28, margin: 0, whiteSpace: "nowrap" }}>{title}</h2>
          {sub && <div className="dim" style={{ fontSize: 14, marginTop: 3, whiteSpace: "nowrap" }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function PassageCard({ p, i, onClick }) {
  return (
    <Glass hover className="passage-card" style={{ animationDelay: i * 0.05 + "s", padding: 20 }} onClick={onClick}>
      <div className="between" style={{ marginBottom: 16 }}>
        <span className="mono faint" style={{ fontSize: 12 }}>{p.date}</span>
        <Verdict v={p.verdict} />
      </div>
      <div className="route-line">
        <span className="route-port">{p.from}</span>
        <span className="route-arrow"><Icon name="arrow-right" size={16} /></span>
        <span className="route-port">{p.to}</span>
      </div>
      <div className="flex gap-16" style={{ marginTop: 16 }}>
        <Metric icon="navigation" v={p.nm + " NM"} />
        <Metric icon="clock" v={"~" + p.hours + "h"} />
        <Metric icon="map-pin" v={p.wp + " wp"} />
        {p.capes > 0 && <Metric icon="triangle" v={p.capes + " cape" + (p.capes > 1 ? "s" : "")} />}
      </div>
      <div className="passage-card-glow" />
    </Glass>
  );
}

function Metric({ icon, v }) {
  return (
    <span className="center gap-6 dim" style={{ fontSize: 13 }}>
      <Icon name={icon} size={14} style={{ opacity: 0.7 }} /> <span className="mono">{v}</span>
    </span>
  );
}

/* ---- Live conditions hero card ---- */
function LiveConditions({ onOpenPassage }) {
  const tl = window.SW.timeline.slice(0, 12);
  const winds = tl.map(t => t.wind);
  const now = tl[0];
  return (
    <Glass className="live-card fade-up" style={{ animationDelay: ".15s" }}>
      <div className="between" style={{ marginBottom: 18 }}>
        <div className="center gap-8">
          <span className="live-dot" /> <span className="mono" style={{ fontSize: 12, letterSpacing: 1 }}>LIVE · VIVEIRO</span>
        </div>
        <span className="pill"><Icon name="satellite" size={12} /> ECMWF IFS</span>
      </div>
      <div className="flex" style={{ alignItems: "flex-end", gap: 18, marginBottom: 20 }}>
        <div>
          <div className="display" style={{ fontSize: 64, lineHeight: 1, color: windColor(now.wind) }}>
            {now.wind}<span style={{ fontSize: 22, color: "var(--fg-dim)" }}> kt</span>
          </div>
          <div className="dim mono" style={{ fontSize: 12, marginTop: 6 }}>gusting {now.gust} · B{Math.min(6, Math.round(now.wind/3.5))}</div>
        </div>
        <div style={{ flex: 1 }}><Sparkline data={winds} w={200} h={56} color={windColor(now.wind)} /></div>
      </div>
      <div className="live-grid">
        <LiveCell icon="waves" label="Swell" v="1.1m" sub="8s" />
        <LiveCell icon="thermometer" label="Sea" v="14°" sub="rising" />
        <LiveCell icon="eye" label="Visibility" v="9 NM" sub="good" />
      </div>
      <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={() => onOpenPassage("p1")}>
        <Icon name="compass" size={16} /> Open active passage · Viveiro → La Coruña
      </button>
    </Glass>
  );
}
function LiveCell({ icon, label, v, sub }) {
  return (
    <div className="live-cell">
      <Icon name={icon} size={16} style={{ color: "var(--cyan)", opacity: 0.85 }} />
      <div>
        <div className="faint mono" style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{v} <span className="faint" style={{ fontSize: 11 }}>{sub}</span></div>
      </div>
    </div>
  );
}

/* ---- Ports explorer ---- */
function PortsExplorer({ ports }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    let r = ports;
    if (filter === "fuel") r = r.filter(p => p.facilities.includes("f"));
    if (filter === "repair") r = r.filter(p => p.facilities.includes("r"));
    if (filter === "orca") r = r.filter(p => p.orca);
    if (filter === "anchor") r = r.filter(p => p.anchorage);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(p => p.name.toLowerCase().includes(s) || p.region.toLowerCase().includes(s));
    }
    return r;
  }, [q, filter, ports]);

  const filters = [
    ["all", "All", "list"], ["fuel", "Fuel", "fuel"], ["repair", "Repair", "wrench"],
    ["anchor", "Anchorage", "anchor"], ["orca", "Orca risk", "alert-triangle"],
  ];

  return (
    <div>
      <SectionHead icon="anchor" title="Ports & marinas" sub={`${ports.length} along the Atlantic route · Gijón → Gibraltar`} />
      <Glass style={{ padding: 18 }}>
        <div className="ports-controls">
          <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
            <Icon name="search" size={17} />
            <input className="input" placeholder="Search ports — e.g. Vigo, Cascais, Cádiz, Algarve…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="seg">
            {filters.map(([k, l, ic]) => (
              <div key={k} className={"seg-opt " + (filter === k ? "active" : "")} onClick={() => setFilter(k)}>
                <Icon name={ic} size={14} /> <span className="hide-mobile">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ports-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Port</th>
                <th className="hide-mobile">→ Next</th>
                <th>Region</th>
                <th className="num">Berths</th>
                <th className="num hide-mobile">€/day</th>
                <th>Facilities</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="num faint">{p.id}</td>
                  <td>
                    <div className="center gap-8">
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      {p.stars > 0 && <Stars n={p.stars} />}
                    </div>
                  </td>
                  <td className="num dim hide-mobile">{p.dist ? p.dist + " nm" : "—"}</td>
                  <td className="dim" style={{ fontSize: 12.5 }}>{p.region}</td>
                  <td className="num">{p.anchorage ? <span className="pill" style={{ fontSize: 10 }}><Icon name="anchor" size={11} /> anchor</span> : p.berths}</td>
                  <td className="num hide-mobile">{p.price ? <span style={{ color: "var(--cyan)" }}>€{p.price}</span> : <span className="faint">—</span>}</td>
                  <td><div className="center gap-8"><Facilities list={p.facilities} />{p.orca && <OrcaChip level={p.orca} />}</div></td>
                  <td style={{ textAlign: "right" }}><Icon name="chevron-right" size={16} style={{ color: "var(--fg-faint)" }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="dim" style={{ textAlign: "center", padding: 40 }}>No ports match “{q}”.</div>}
        </div>

        <div className="ports-foot">
          <span className="faint mono" style={{ fontSize: 12 }}>Showing {filtered.length} of {ports.length} ports · Gijón → Gibraltar</span>
          <span className="faint mono center gap-6" style={{ fontSize: 11 }}><Icon name="info" size={12} /> tap a port for berths & facilities</span>
        </div>
      </Glass>
    </div>
  );
}

const dashStyles = `
.hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: center; }
.hero-stats { display: flex; align-items: center; gap: 26px; margin-top: 40px; }
.stat-div { width: 1px; height: 38px; background: var(--glass-border); }
.sec-icon { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: var(--glass-2); border: 1px solid var(--glass-border); color: var(--cyan); }
.passage-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.passage-card { position: relative; overflow: hidden; }
.passage-card-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(400px 120px at 80% -20%, rgba(52,224,255,0.10), transparent 70%); }
.route-line { display: flex; align-items: center; gap: 12px; }
.route-port { font-family: var(--serif); font-size: 22px; font-weight: 600; }
.route-arrow { color: var(--cyan); display: flex; }
.live-card { padding: 26px; }
.live-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--go); box-shadow: 0 0 0 0 rgba(54,211,153,0.6); animation: pulseDot 2s infinite; }
@keyframes pulseDot { 0% { box-shadow: 0 0 0 0 rgba(54,211,153,0.5);} 70%{ box-shadow: 0 0 0 8px rgba(54,211,153,0);} 100%{ box-shadow:0 0 0 0 rgba(54,211,153,0);} }
.live-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
.live-cell { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); }
.ports-controls { display: flex; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.ports-table-wrap { max-height: 460px; overflow-y: auto; border-radius: 12px; border: 1px solid var(--glass-border); }
.ports-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; gap: 12px; flex-wrap: wrap; }
.community-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
.avatar { width: 34px; height: 34px; border-radius: 99px; display: grid; place-items: center; font-size: 12px; font-weight: 700; font-family: var(--mono); background: linear-gradient(135deg, var(--sky), var(--cyan-deep)); color: #02131c; }
@media (max-width: 980px) {
  .hero-grid { grid-template-columns: 1fr; gap: 32px; }
  .passage-grid, .community-grid { grid-template-columns: 1fr; }
}
`;

window.Dashboard = Dashboard;
