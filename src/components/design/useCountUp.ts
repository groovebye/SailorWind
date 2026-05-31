"use client";

import { useEffect, useRef, useState } from "react";

/** Count up from 0 to target on mount, cubic ease-out. Respects reduced-motion. */
export function useCountUp(target: number, dur = 1100): number {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      raf.current = requestAnimationFrame(() => setVal(target));
      return () => cancelAnimationFrame(raf.current);
    }
    let start: number | undefined;
    const step = (t: number) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(target * e);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, dur]);
  return val;
}
