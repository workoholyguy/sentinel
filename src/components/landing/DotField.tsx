"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * A field of dots around your office. Online, signal ripples outward to the edges.
 * Offline, everything past the building goes dark, but the local core keeps glowing:
 * the on-device model is still diagnosing.
 */
export function DotField({ offline, className = "" }: { offline: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offlineRef = useRef(offline);
  const reduced = useReducedMotion();

  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let dots: Float32Array = new Float32Array(0); // x, y, dist, seed
    let raf = 0;
    let visible = true;
    let mix = offlineRef.current ? 1 : 0; // 0 online → 1 offline, eased
    const mouse = { x: -1e4, y: -1e4 };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gap = w < 500 ? 13 : 16;
      const cols = Math.ceil(w / gap);
      const rows = Math.ceil(h / gap);
      const cx = w / 2;
      const cy = h / 2;
      const out: number[] = [];
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const x = c * gap + (r % 2 ? gap / 2 : 0);
          const y = r * gap;
          out.push(x, y, Math.hypot(x - cx, y - cy), Math.random());
        }
      }
      dots = new Float32Array(out);
    };

    const draw = (now: number) => {
      const t = now / 1000;
      const target = offlineRef.current ? 1 : 0;
      mix += (target - mix) * 0.06;
      const maxD = Math.hypot(w, h) / 2;
      const core = Math.min(w, h) * 0.24;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i += 4) {
        const x = dots[i];
        const y = dots[i + 1];
        const d = dots[i + 2];
        const seed = dots[i + 3];
        const nd = d / maxD;
        const edgeFade = Math.max(0, 1 - nd * 0.9);
        // online: rings of signal travelling outward
        const wave = Math.pow(0.5 + 0.5 * Math.sin(d * 0.04 - t * 2.6), 3);
        const online = (0.16 + wave * 0.84) * edgeFade;
        // offline: the core breathes, the world beyond is dark with the odd dead flicker
        const inCore = d < core;
        const breathe = 0.55 + 0.35 * Math.sin(t * 2 - d * 0.03);
        const flicker = seed > 0.97 && Math.sin(t * 9 + seed * 100) > 0.6 ? 0.5 : 0;
        const off = inCore ? breathe * (1 - d / core) + 0.12 : 0.05 * edgeFade + flicker * edgeFade;
        let a = online * (1 - mix) + off * mix;
        const md = Math.hypot(x - mouse.x, y - mouse.y);
        if (md < 90) a += (1 - md / 90) * 0.5;
        if (a < 0.03) continue;
        // colour: cyan near the core shading to violet at the edge; dead dots go red when offline
        const deadRed = !inCore && mix > 0.5 && flicker > 0;
        const r = deadRed ? 255 : Math.round(56 + (167 - 56) * nd);
        const g = deadRed ? 77 : Math.round(225 + (139 - 225) * nd);
        const b = deadRed ? 109 : Math.round(255 + (250 - 255) * nd);
        const size = 0.9 + a * 1.9;
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, a)})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible && !reduced) raf = requestAnimationFrame(draw);
    };

    build();
    draw(performance.now());

    const ro = new ResizeObserver(() => {
      build();
      if (reduced) draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduced) raf = requestAnimationFrame(draw);
    });
    io.observe(canvas);
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -1e4;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className={`block h-full w-full ${className}`} aria-hidden="true" />;
}
