"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

const TEXT = "UPLINK";
const SWEEP_MS = 5200;
const FAULT_EVERY_MS = 6500;
const FAULT_MS = 1300; // red, flickering, sagging
const HEAL_MS = 1000; // green ripple spreading out from the fault

// soft white → lavender → pink across the word, for the indigo footer sky
const STOPS: Array<[number, number, number]> = [
  [255, 255, 255],
  [221, 214, 254],
  [251, 207, 232],
  [255, 255, 255],
];

function aurora(f: number): [number, number, number] {
  const x = Math.min(0.999, Math.max(0, f)) * (STOPS.length - 1);
  const i = Math.floor(x);
  const k = x - i;
  const [a, b] = [STOPS[i], STOPS[i + 1]];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/**
 * The footer wordmark, drawn as a field of network "packets". A signal sweeps through the letters;
 * every few seconds a patch goes down (red) and is healed by a green ripple, the product in miniature.
 * Dots scatter away from the cursor and spring back.
 */
export function WordmarkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let gap = 8;
    // per dot: homeX, homeY, x, y, vx, vy, letter(0/1), seed
    let dots = new Float32Array(0);
    let raf = 0;
    let visible = true;
    let cancelled = false;
    const mouse = { x: -1e4, y: -1e4 };
    const fault = { x: 0, y: 0, at: -1e9 };
    let nextFault = performance.now() + 2500;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.parentElement?.clientWidth ?? 1200;
      gap = Math.max(4, Math.min(9, Math.round(w / 150)));
      const family = getComputedStyle(document.body).fontFamily || "sans-serif";

      // fit the word to the width
      const probe = document.createElement("canvas").getContext("2d")!;
      probe.font = `700 100px ${family}`;
      const m = probe.measureText(TEXT);
      const asc = m.actualBoundingBoxAscent || 72;
      const desc = m.actualBoundingBoxDescent || 0;
      const scale = (w * 0.96) / (m.actualBoundingBoxRight + m.actualBoundingBoxLeft || m.width);
      const fs = 100 * scale;
      const pad = gap * 3;
      h = Math.round((asc + desc) * scale + pad * 2);

      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // rasterise the word once and sample it on a grid
      const off = document.createElement("canvas");
      off.width = Math.ceil(w);
      off.height = h;
      const o = off.getContext("2d")!;
      o.fillStyle = "#fff";
      o.font = `700 ${fs}px ${family}`;
      o.textBaseline = "alphabetic";
      const textW = (m.actualBoundingBoxRight + m.actualBoundingBoxLeft || m.width) * scale;
      o.fillText(TEXT, (w - textW) / 2 + (m.actualBoundingBoxLeft || 0) * scale, pad + asc * scale);
      const px = o.getImageData(0, 0, off.width, off.height).data;

      const out: number[] = [];
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          const inside = px[(Math.floor(y) * off.width + Math.floor(x)) * 4 + 3] > 140;
          // keep every letter dot, and a sparse scatter of background dots for texture
          if (inside || Math.random() < 0.16) out.push(x, y, x, y, 0, 0, inside ? 1 : 0, Math.random());
        }
      }
      dots = new Float32Array(out);
    };

    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const sweepBand = w * 0.13;
      const sweepX = reduced ? -1e4 : ((now % SWEEP_MS) / SWEEP_MS) * (w + sweepBand * 4) - sweepBand * 2;
      const mouseR = Math.max(60, w * 0.07);
      const faultR = Math.max(50, w * 0.075);

      // schedule the next outage on a random letter dot
      if (!reduced && now > nextFault && dots.length) {
        const letterIdx: number[] = [];
        for (let i = 0; i < dots.length; i += 8) if (dots[i + 6]) letterIdx.push(i);
        const pick = letterIdx[Math.floor(Math.random() * letterIdx.length)];
        if (pick !== undefined) {
          fault.x = dots[pick];
          fault.y = dots[pick + 1];
          fault.at = now;
        }
        nextFault = now + FAULT_EVERY_MS;
      }
      const ft = now - fault.at;
      const faulting = ft >= 0 && ft < FAULT_MS;
      const healing = ft >= FAULT_MS && ft < FAULT_MS + HEAL_MS;
      const healR = healing ? ((ft - FAULT_MS) / HEAL_MS) * faultR * 2.2 : 0;

      for (let i = 0; i < dots.length; i += 8) {
        const hx = dots[i];
        const hy = dots[i + 1];
        let x = dots[i + 2];
        let y = dots[i + 3];
        let vx = dots[i + 4];
        let vy = dots[i + 5];
        const letter = dots[i + 6] === 1;
        const seed = dots[i + 7];

        let tx = hx;
        let ty = hy;
        let a = letter ? 0.3 : 0.06;
        let [r, g, b] = letter ? aurora(hx / w) : [255, 255, 255];

        // the signal sweep
        const s = Math.exp(-(((hx - sweepX) / sweepBand) ** 2));
        a += s * (letter ? 0.7 : 0.1);

        // outage: dots near the fault go red, flicker and sag
        const fd = Math.hypot(hx - fault.x, hy - fault.y);
        if (letter && faulting && fd < faultR) {
          const k = 1 - fd / faultR;
          [r, g, b] = [251, 113, 133];
          a = 0.35 + 0.5 * k * (Math.sin(now / 45 + seed * 40) > 0 ? 1 : 0.35);
          ty += k * gap * 1.6 * Math.min(1, ft / 400);
        } else if (letter && healing && fd < healR && fd > healR - faultR * 0.9) {
          // the healing ripple front flashes green as it passes
          [r, g, b] = [110, 231, 183];
          a = Math.max(a, 0.9);
        }

        // the cursor pushes dots away
        const mx = hx - mouse.x;
        const my = hy - mouse.y;
        const md = Math.hypot(mx, my);
        if (md < mouseR) {
          const k = (1 - md / mouseR) ** 2;
          tx += (mx / (md || 1)) * k * mouseR * 0.45;
          ty += (my / (md || 1)) * k * mouseR * 0.45;
          a += k * 0.6;
        }

        if (reduced) {
          x = tx;
          y = ty;
        } else {
          vx = (vx + (tx - x) * 0.09) * 0.8;
          vy = (vy + (ty - y) * 0.09) * 0.8;
          x += vx;
          y += vy;
        }
        dots[i + 2] = x;
        dots[i + 3] = y;
        dots[i + 4] = vx;
        dots[i + 5] = vy;

        const radius = letter ? gap * (0.2 + 0.2 * Math.min(1, a)) : 0.7;
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${Math.min(1, a).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible && !reduced && !cancelled) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      build();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    // wait for the bundled font so the letters are sampled in Geist, not a fallback
    (document.fonts?.ready ?? Promise.resolve()).then(() => !cancelled && start());

    const ro = new ResizeObserver(() => {
      if (Math.abs((canvas.parentElement?.clientWidth ?? w) - w) > 1) start();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !cancelled) raf = requestAnimationFrame(frame);
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
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="block w-full touch-pan-y" style={{ height: 220 }} role="img" aria-label="UPLink" />;
}
