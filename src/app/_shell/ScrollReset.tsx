"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Scroll the shared view-scroll container back to top on route change. */
export default function ScrollReset() {
  const path = usePathname();
  useEffect(() => {
    document.querySelector(".view-scroll")?.scrollTo({ top: 0 });
  }, [path]);
  return null;
}
