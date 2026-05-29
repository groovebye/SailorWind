"use client";

import { useEffect, useState } from "react";

/** Registers the service worker and shows an offline banner (for use at sea). */
export default function SwRegister() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
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
