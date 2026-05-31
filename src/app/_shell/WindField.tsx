"use client";

import { useEffect, useRef } from "react";

/**
 * Animated wind/current flow-field behind the glass. Layered sin-field advects
 * particles; within ~135px of the cursor they get a tangential swirl push. Trails
 * fade via a translucent dark fill each frame + additive blending. Single canvas,
 * DPR-capped at 2, re-seeds on resize. Ported from the design prototype.
 */
export default function WindField({
  intensity = 1,
  hueShift = 0,
  density = 1,
  className = "wind-canvas",
}: {
  intensity?: number;
  hueShift?: number;
  density?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return; // honour reduced-motion: leave the canvas blank
    }
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    if (!ctx || !parent) return;

    let W = 0, H = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    type P = { x: number; y: number; life: number; age: number; spd: number; w: number };
    let particles: P[] = [];
    let t = 0;

    const spawn = (): P => ({
      x: Math.random() * W,
      y: Math.random() * H,
      life: Math.random() * 120 + 40,
      age: 0,
      spd: Math.random() * 0.6 + 0.5,
      w: Math.random() * 1.1 + 0.4,
    });

    function resize() {
      const r = parent!.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas!.width = W * dpr; canvas!.height = H * dpr;
      canvas!.style.width = W + "px"; canvas!.style.height = H + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(((W * H) / 14000) * density);
      particles = Array.from({ length: count }, spawn);
    }

    function field(x: number, y: number) {
      const s = 0.0016;
      const a =
        Math.sin(x * s + t * 0.0006) * 1.2 +
        Math.cos(y * s * 1.3 - t * 0.0004) * 1.0 +
        Math.sin((x + y) * s * 0.6 + t * 0.0003) * 0.8;
      return a * 0.9 + 0.5;
    }

    function step() {
      t += 16;
      ctx!.fillStyle = "rgba(5,13,24,0.10)";
      ctx!.fillRect(0, 0, W, H);
      ctx!.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const ang = field(p.x, p.y);
        let vx = Math.cos(ang) * p.spd * intensity;
        let vy = Math.sin(ang) * p.spd * intensity;
        const dx = p.x - mouse.current.x, dy = p.y - mouse.current.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 18000) {
          const f = (18000 - d2) / 18000;
          vx += -dy * 0.0009 * f * 60;
          vy += dx * 0.0009 * f * 60;
        }
        const px = p.x, py = p.y;
        p.x += vx; p.y += vy; p.age++;
        const spd = Math.hypot(vx, vy);
        const hue = 190 + spd * 14 + hueShift;
        const alpha =
          Math.min(0.5, 0.12 + spd * 0.18) *
          Math.min(1, p.age / 14) *
          Math.min(1, (p.life - p.age) / 20);
        ctx!.strokeStyle = `hsla(${hue}, 95%, 68%, ${alpha})`;
        ctx!.lineWidth = p.w;
        ctx!.beginPath();
        ctx!.moveTo(px, py);
        ctx!.lineTo(p.x, p.y);
        ctx!.stroke();
        if (p.age > p.life || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) {
          Object.assign(p, spawn(), { age: 0 });
        }
      }
      ctx!.globalCompositeOperation = "source-over";
      raf.current = requestAnimationFrame(step);
    }

    resize();
    ctx.fillStyle = "#050d18"; ctx.fillRect(0, 0, W, H);
    raf.current = requestAnimationFrame(step);
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => (mouse.current = { x: -9999, y: -9999 });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [intensity, hueShift, density]);

  return <canvas ref={ref} className={className} />;
}
