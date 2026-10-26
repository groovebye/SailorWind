"use client";

import { useEffect, useState } from "react";

/** Registers the service worker and shows an offline banner (for use at sea). */
export default function SwRegister() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Dev chunk URLs aren't content-hashed, so a cache-first SW would serve
      // stale code after every edit. Off in dev unless NEXT_PUBLIC_SW_DEV=1.
      if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1") {
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
        // Top up the offline copy of this build's JS/CSS (new files after a deploy).
        navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "precache" })).catch(() => {});
      } else {
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      }
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
        textAlign: "center", padding: "5px 8px", fontSize: 12, fontWeight: 600,
        background: "#7c2d12", color: "#fed7aa", borderTop: "1px solid #9a3412",
      }}
    >
      ● Offline — showing last cached briefings, forecast &amp; charts
    </div>
  );
}
