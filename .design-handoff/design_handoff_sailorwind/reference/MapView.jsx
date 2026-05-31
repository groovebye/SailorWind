/* ============================================================
   SailorWind — Map view (Leaflet + glass overlays + wind layer)
   ============================================================ */

function MapView({ onBack }) {
  const { passage, orcaZones } = window.SW;
  const mapEl = useRef(null);
  const mapObj = useRef(null);
  const overlayCanvas = useRef(null);
  const [layers, setLayers] = useState({ wind: true, waves: false, orca: true });
  const [active, setActive] = useState(passage.wp[0]);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // init leaflet
  useEffect(() => {
    if (typeof L === "undefined" || !mapEl.current) return;
    const pts = passage.wp.map(w => [w.lat, w.lng]);
    const map = L.map(mapEl.current, {
      zoomControl: false, attributionControl: true,
      center: [43.62, -8.0], zoom: 9, scrollWheelZoom: true,
    });
    mapObj.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© OSM © CARTO', maxZoom: 19, subdomains: "abcd",
    }).addTo(map);

    // route line (glow + main)
    L.polyline(pts, { color: "#34e0ff", weight: 7, opacity: 0.18 }).addTo(map);
    const main = L.polyline(pts, { color: "#34e0ff", weight: 2.5, opacity: 0.95, dashArray: "1 8", lineCap: "round" }).addTo(map);

    // waypoint markers
    passage.wp.forEach((w, i) => {
      const isStop = w.type === "STOP", isCape = w.type === "CAPE";
      const color = isStop ? "#34e0ff" : isCape ? "#ffc24b" : "#9fb6cc";
      const size = isStop ? 16 : isCape ? 13 : 9;
      const icon = L.divIcon({
        className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        html: `<div class="lf-wp ${isCape ? "lf-cape" : ""}" style="width:${size}px;height:${size}px;background:${color};box-shadow:0 0 14px ${color}">${isStop ? '<span class="lf-ping" style="border-color:' + color + '"></span>' : ""}</div>`,
      });
      const m = L.marker([w.lat, w.lng], { icon }).addTo(map);
      m.on("click", () => { setActive(w); map.panTo([w.lat, w.lng]); });
      m.bindTooltip(`${w.name} · ${w.eta} · ${w.wind}kt`, { direction: "top", className: "lf-tip", offset: [0, -8] });
    });

    // orca zones
    const orcaGroup = L.layerGroup();
    orcaZones.forEach(z => {
      const c = z.level === "high" ? "#ff6b8a" : z.level === "medium" ? "#b794ff" : "#4fb0ff";
      L.circle([z.lat, z.lng], { radius: z.r, color: c, weight: 1.5, fillColor: c, fillOpacity: 0.12, dashArray: "4 6" })
        .bindTooltip(`Orca ${z.level} — ${z.note}`, { className: "lf-tip" })
        .addTo(orcaGroup);
    });
    if (layersRef.current.orca) orcaGroup.addTo(map);
    map._orcaGroup = orcaGroup;

    map.fitBounds(L.latLngBounds(pts).pad(0.35));

    // wind overlay canvas sized to map
    setTimeout(() => sizeOverlay(), 60);
    map.on("resize move zoom", sizeOverlay);

    return () => { map.remove(); };
  }, []);

  function sizeOverlay() {
    const c = overlayCanvas.current, m = mapObj.current;
    if (!c || !m) return;
    const s = m.getSize();
    c.width = s.x; c.height = s.y;
  }

  // toggle orca layer
  useEffect(() => {
    const m = mapObj.current; if (!m || !m._orcaGroup) return;
    if (layers.orca) m._orcaGroup.addTo(m); else m.removeLayer(m._orcaGroup);
  }, [layers.orca]);

  // animated wind/wave overlay on canvas (screen-space flow)
  useEffect(() => {
    const c = overlayCanvas.current; if (!c) return;
    const ctx = c.getContext("2d");
    let parts = [], raf, t = 0;
    function reset() {
      const n = Math.round((c.width * c.height) / 9000);
      parts = Array.from({ length: n }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, a: 0, life: Math.random() * 90 + 30 }));
    }
    function field(x, y) {
      const s = 0.004;
      return Math.sin(x * s + t * 0.0007) * 1.1 + Math.cos(y * s * 1.2 - t * 0.0005) + 0.6;
    }
    function loop() {
      t += 16;
      ctx.clearRect(0, 0, c.width, c.height);
      const ly = layersRef.current;
      if (ly.waves) {
        // wave heat overlay: soft radial bands
        const g = ctx.createLinearGradient(0, 0, c.width, c.height);
        g.addColorStop(0, "rgba(52,224,255,0.05)");
        g.addColorStop(0.5, "rgba(255,194,75,0.06)");
        g.addColorStop(1, "rgba(255,107,138,0.05)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
      }
      if (ly.wind) {
        ctx.globalCompositeOperation = "lighter";
        for (const p of parts) {
          const ang = field(p.x, p.y);
          const vx = Math.cos(ang) * 1.5, vy = Math.sin(ang) * 1.5;
          const px = p.x, py = p.y;
          p.x += vx; p.y += vy; p.a++;
          const al = Math.min(0.4, 0.12) * Math.min(1, p.a / 10) * Math.min(1, (p.life - p.a) / 16);
          ctx.strokeStyle = `hsla(190,95%,70%,${al})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(p.x, p.y); ctx.stroke();
          if (p.a > p.life || p.x < 0 || p.x > c.width || p.y < 0 || p.y > c.height)
            Object.assign(p, { x: Math.random() * c.width, y: Math.random() * c.height, a: 0, life: Math.random() * 90 + 30 });
        }
        ctx.globalCompositeOperation = "source-over";
      }
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => { sizeOverlay(); reset(); });
    if (mapEl.current) ro.observe(mapEl.current);
    setTimeout(() => { sizeOverlay(); reset(); }, 120);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  function toggle(k) { setLayers(s => ({ ...s, [k]: !s[k] })); }

  return (
    <div className="map-wrap" key="map">
      <div ref={mapEl} className="map-el" />
      <canvas ref={overlayCanvas} className="map-overlay" />

      {/* top-left: back + title */}
      <div className="map-top glass">
        <button className="btn btn-sm btn-ghost" onClick={onBack}><Icon name="arrow-left" size={16} /></button>
        <div>
          <div className="center gap-8"><span className="route-port" style={{ fontSize: 18 }}>{passage.from}</span>
            <Icon name="arrow-right" size={14} style={{ color: "var(--cyan)" }} />
            <span className="route-port" style={{ fontSize: 18 }}>{passage.to}</span></div>
          <div className="faint mono" style={{ fontSize: 11 }}>{passage.wp.length} waypoints · {passage.nm} NM · 1 leg</div>
        </div>
      </div>

      {/* layer panel */}
      <div className="map-layers glass">
        <div className="field-label" style={{ marginBottom: 4 }}>Chart layers</div>
        <LayerToggle on={layers.wind} onClick={() => toggle("wind")} icon="wind" label="Wind flow" c="var(--cyan)" />
        <LayerToggle on={layers.waves} onClick={() => toggle("waves")} icon="waves" label="Wave heatmap" c="var(--caution)" />
        <LayerToggle on={layers.orca} onClick={() => toggle("orca")} icon="alert-triangle" label="Orca zones" c="var(--orca)" />
      </div>

      {/* active waypoint readout */}
      {active && (
        <div className="map-readout glass fade-up" key={active.name}>
          <div className="between" style={{ marginBottom: 10 }}>
            <div className="center gap-8"><WpDot type={active.type} /><span style={{ fontWeight: 600, fontSize: 15 }}>{active.name}</span></div>
            <Verdict v={active.verdict} />
          </div>
          <div className="map-readout-grid">
            <RO icon="clock" label="ETA" v={active.eta} />
            <RO icon="wind" label="Wind" v={active.wind + " kt"} c={windColor(active.wind)} />
            <RO icon="git-commit-horizontal" label="Gust" v={active.gust + " kt"} />
            <RO icon="waves" label="Waves" v={active.wave} />
            <RO icon="ripple" label="Swell" v={active.swell} />
            <RO icon="zap" label="Power" v={active.power} />
          </div>
        </div>
      )}

      {/* wind legend */}
      <div className="map-legend glass">
        <span className="faint mono" style={{ fontSize: 10 }}>WIND KT</span>
        <div className="legend-bar" />
        <div className="legend-scale mono"><span>0</span><span>10</span><span>20+</span></div>
      </div>

      <style>{mapStyles}</style>
    </div>
  );
}

function LayerToggle({ on, onClick, icon, label, c }) {
  return (
    <div className="layer-row" onClick={onClick}>
      <span className="center gap-8" style={{ fontSize: 13 }}>
        <Icon name={icon} size={15} style={{ color: c }} /> {label}
      </span>
      <span className="center gap-6">
        <span className={"toggle " + (on ? "on" : "")}><span className="knob" /></span>
      </span>
    </div>
  );
}
function RO({ icon, label, v, c }) {
  return (
    <div className="ro-cell">
      <span className="faint mono" style={{ fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
        <Icon name={icon} size={11} /> {label}
      </span>
      <span className="mono" style={{ fontWeight: 600, fontSize: 14, color: c || "var(--fg)" }}>{v}</span>
    </div>
  );
}

const mapStyles = `
.map-wrap { position: relative; height: calc(100vh - 63px); width: 100%; overflow: hidden; background: var(--sea-900); }
.map-el { position:absolute; inset:0; background: var(--sea-900); }
.map-overlay { position:absolute; inset:0; pointer-events:none; z-index: 410; }
.leaflet-container { background: #07121f !important; font-family: var(--sans) !important; }
.leaflet-control-attribution { background: rgba(5,13,24,0.6) !important; color: var(--fg-faint) !important; font-size: 10px !important; }
.leaflet-control-attribution a { color: var(--fg-dim) !important; }
.leaflet-control-zoom a { background: rgba(10,24,40,0.85) !important; color: var(--fg) !important; border-color: var(--glass-border) !important; backdrop-filter: blur(8px); }
.lf-wp { border-radius: 99px; border: 2px solid rgba(255,255,255,0.85); position: relative; }
.lf-cape { border-radius: 3px; transform: rotate(45deg); }
.lf-ping { position:absolute; inset:-2px; border-radius:99px; border:2px solid; animation: pulseRing 2.4s infinite; }
.lf-tip { background: rgba(7,19,34,0.92) !important; border: 1px solid var(--glass-border) !important; color: var(--fg) !important; font-family: var(--mono) !important; font-size: 11px !important; border-radius: 8px !important; box-shadow: var(--shadow-soft) !important; }
.lf-tip::before { display:none !important; }
.map-top { position:absolute; top:18px; left:18px; z-index:500; display:flex; align-items:center; gap:12px; padding: 12px 16px; }
.map-layers { position:absolute; top:18px; right:18px; z-index:500; padding: 14px; width: 230px; }
.layer-row { display:flex; align-items:center; justify-content:space-between; padding: 8px 6px; border-radius: 9px; cursor:pointer; transition: background .15s; }
.layer-row:hover { background: var(--glass); }
.toggle { width: 34px; height: 19px; border-radius: 99px; background: rgba(255,255,255,0.12); position: relative; transition: background .2s; }
.toggle.on { background: var(--cyan); }
.knob { position:absolute; top:2px; left:2px; width:15px; height:15px; border-radius:99px; background:#fff; transition: transform .2s; }
.toggle.on .knob { transform: translateX(15px); }
.map-readout { position:absolute; bottom:24px; left:18px; z-index:500; padding: 16px; width: 290px; }
.map-readout-grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.ro-cell { display:flex; flex-direction:column; gap: 3px; }
.map-legend { position:absolute; bottom:24px; left:50%; transform:translateX(-50%); z-index:500; padding: 8px 14px; display:flex; align-items:center; gap:10px; }
.legend-bar { width: 140px; height: 8px; border-radius: 99px; background: linear-gradient(90deg, #7fe9c4, #34e0ff, #4fb0ff, #ffc24b, #ff9b5a, #ff6b8a); }
.legend-scale { display:flex; justify-content:space-between; width: 140px; font-size: 9px; color: var(--fg-faint); position: absolute; bottom: 2px; left: 56px; }
@media (max-width: 720px) {
  .map-layers { width: 200px; top: auto; bottom: 24px; right: 12px; }
  .map-readout { display:none; }
  .map-legend { display:none; }
}
`;

window.MapView = MapView;
