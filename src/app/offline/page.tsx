import { Anchor } from "lucide-react";

export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="glass fade-up" style={{ maxWidth: 520, margin: "0 auto", padding: 32, textAlign: "center" }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 16 }}>
          <span className="sec-icon" style={{ width: 56, height: 56 }}><Anchor size={26} /></span>
        </div>
        <h1 className="display" style={{ fontSize: 28, margin: "0 0 10px" }}>You&apos;re offline</h1>
        <p className="dim" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          No connection right now. Pages, briefings, forecasts and charts you&apos;ve already
          opened are cached and still available — head back and pick a leg you viewed earlier.
          Live forecast refresh resumes automatically when you regain signal.
        </p>
      </div>
    </div>
  );
}
