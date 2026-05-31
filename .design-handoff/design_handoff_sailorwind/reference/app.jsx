/* ============================================================
   SailorWind — App shell + routing (personal build · Bossanova)
   ============================================================ */

function App() {
  const [view, setView] = useState("dashboard"); // dashboard | passage | map

  const go = (v) => { window.scrollTo(0, 0); setView(v); };
  const openPassage = () => go("passage");
  const openMap = () => go("map");

  const nav = [
    ["dashboard", "Home", "compass"],
    ["passage", "Passage", "route"],
    ["map", "Chart", "map"],
  ];

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      {view !== "map" && <WindField intensity={1} density={view === "dashboard" ? 1 : 0.7} />}

      <div className="app-main">
        {/* top nav */}
        <div className="topbar">
          <div className="brand" onClick={() => go("dashboard")}>
            <div className="brand-mark"><Icon name="navigation-2" size={18} style={{ transform: "rotate(45deg)" }} /></div>
            <div className="brand-name">Sailor<b>Wind</b></div>
          </div>
          <div className="nav-links">
            {nav.map(([k, l, ic]) => (
              <div key={k} className={"nav-link " + (view === k ? "active" : "")} onClick={() => go(k)}>
                <Icon name={ic} size={16} /> {l}
              </div>
            ))}
          </div>
          <div className="topbar-spacer" />
          <div className="boat-chip hide-mobile">
            <Icon name="sailboat" size={14} style={{ color: "var(--cyan)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.1 }}>Bossanova</div>
              <div className="faint mono" style={{ fontSize: 10 }}>HR Monsun 31</div>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost"><Icon name="settings" size={16} /></button>
        </div>

        {/* views */}
        {view === "dashboard" && (
          <Dashboard onOpenPassage={openPassage} onNewPassage={openPassage} onOpenMap={openMap} />
        )}
        {view === "passage" && (
          <PassageDetail onBack={() => go("dashboard")} onOpenMap={openMap} />
        )}
        {view === "map" && (
          <MapView onBack={() => go("passage")} />
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
