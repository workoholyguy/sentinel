"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { GetStartedCta } from "./GetStarted";
import { buildTerrain, elevationAt, formatMetres, PALETTE, renderIndices, ridgeNear, type Terrain } from "./mountains";

const CELL_WIDE = 3; // CSS px per dither pixel
const CELL_NARROW = 2; // finer on phones, so the range still has detail at 375px
const NAV_HEIGHT = 72; // the fixed header covers the top of the screen
const MOUNTAIN_ROOM = 300; // at least this much range below the text
const LOWEST_PEAK = 0.15; // the highest ridge sits this far down the footer
const SKY = PALETTE[0];

const RGB = PALETTE.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));

const cellFor = (width: number) => (width < 640 ? CELL_NARROW : CELL_WIDE);

interface Marker {
  x: number;
  y: number;
  metres: number;
}

/** Draws the range at the footer's current size, and keeps the terrain for the hover lookup. */
function useMountains() {
  const wrapRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const terrainRef = useRef<Terrain | null>(null);
  const keyRef = useRef("");
  const [size, setSize] = useState<{ gw: number; gh: number; height: number; cell: number; textBottom: number; fits: boolean } | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    const draw = () => {
      const width = wrap.clientWidth;
      // the credits and the call-to-action sit in the sky; the range starts below them
      const text = textRef.current;
      const textBottom = text ? text.offsetTop + text.offsetHeight + 40 : 0;
      // about half as tall as wide, at least room for the range, and within the screen below the header
      const room = window.innerHeight - NAV_HEIGHT;
      const wanted = Math.max(width * 0.5, textBottom + MOUNTAIN_ROOM);
      const fits = textBottom + MOUNTAIN_ROOM <= room;
      const height = Math.round(fits ? Math.min(wanted, room) : textBottom + MOUNTAIN_ROOM);
      const cell = cellFor(width);
      const gw = Math.ceil(width / cell);
      const gh = Math.ceil(height / cell);
      const inset = Math.round(Math.max(0, textBottom / height - LOWEST_PEAK) * 100) / 100;
      const key = `${gw}x${gh}@${inset}`;
      if (key === keyRef.current) return;
      keyRef.current = key;

      const terrain = buildTerrain(gw, gh, inset);
      terrainRef.current = terrain;
      const indices = renderIndices(terrain);
      const off = document.createElement("canvas");
      off.width = gw;
      off.height = gh;
      const octx = off.getContext("2d");
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!octx || !canvas || !ctx) return;
      const image = octx.createImageData(gw, gh);
      for (let i = 0; i < indices.length; i++) {
        const [r, g, b] = RGB[indices[i]];
        image.data[i * 4] = r;
        image.data[i * 4 + 1] = g;
        image.data[i * 4 + 2] = b;
        image.data[i * 4 + 3] = 255;
      }
      octx.putImageData(image, 0, 0);
      // whole device pixels per dither pixel, so the dots stay crisp
      const scale = Math.max(1, Math.round(cell * (window.devicePixelRatio || 1)));
      canvas.width = gw * scale;
      canvas.height = gh * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      setSize({ gw, gh, height, cell, textBottom, fits });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    draw();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return { wrapRef, canvasRef, textRef, terrainRef, size };
}

export function Footer() {
  const { wrapRef, canvasRef, textRef, terrainRef, size } = useMountains();
  const [marker, setMarker] = useState<Marker | null>(null);

  // Point (or tap) anywhere: the marker snaps to the nearest visible ridge and reads its elevation.
  const point = (e: PointerEvent<HTMLElement>) => {
    const terrain = terrainRef.current;
    if (!terrain || !size) return;
    const cell = size.cell;
    const rect = e.currentTarget.getBoundingClientRect();
    // over the text and the form, stay out of the way
    if (e.clientY - rect.top < size.textBottom) return setMarker(null);
    const gx = (e.clientX - rect.left) / cell;
    const gy = (e.clientY - rect.top) / cell;
    const hit = ridgeNear(terrain, gx, gy);
    if (!hit) return;
    const x = Math.round(Math.max(0, Math.min(terrain.gw - 1, gx))) * cell + cell / 2;
    setMarker({ x, y: hit.y * cell, metres: elevationAt(hit.y, terrain.gh) });
  };

  const height = size?.height ?? 760;
  const width = size ? size.gw * size.cell : undefined;
  // keep the label inside the footer near the edges
  const labelShift = marker && width ? Math.max(-marker.x + 8, Math.min(width - marker.x - 8, 0)) : 0;

  return (
    <footer
      ref={wrapRef}
      onPointerMove={point}
      onPointerDown={point}
      onPointerLeave={(e) => e.pointerType === "mouse" && setMarker(null)}
      id="book"
      className={`${size && !size.fits ? "relative" : "sticky bottom-0"} z-0 scroll-mt-20 overflow-hidden`}
      style={{ height, background: SKY }}
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0" style={{ width, height: size ? size.gh * size.cell : "100%", imageRendering: "pixelated" }} aria-hidden="true" />

      <div ref={textRef} className="relative">
        <div className="pointer-events-none flex flex-col gap-2 px-6 pt-6 text-[14px] text-[#5b6b82] sm:flex-row sm:items-center sm:justify-between sm:px-12 sm:pt-9 sm:text-[17px]">
          <span>© 2026 Uplink. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <span className="underline decoration-[#9aa9bf] decoration-1 underline-offset-[6px]">Made with</span>
            <svg viewBox="0 0 24 24" className="h-[1em] w-[1em] text-[#e5484d]" aria-label="love" role="img">
              <path fill="currentColor" d="M12 21s-7.5-4.6-10-9.3C.4 8.6 2.2 4.5 6.1 4.1 8.4 3.9 10.2 5 12 7.2 13.8 5 15.6 3.9 17.9 4.1c3.9.4 5.7 4.5 4.1 7.6C19.5 16.4 12 21 12 21Z" />
            </svg>
            <span className="underline decoration-[#9aa9bf] decoration-1 underline-offset-[6px]">at the Devin Hackathon</span>
          </span>
        </div>
        <div className="pt-10 sm:pt-12">
          <GetStartedCta />
        </div>
      </div>

      {marker && (
        <div className="pointer-events-none absolute" style={{ left: marker.x, top: marker.y }}>
          <span className="absolute bottom-[7px] left-0 h-16 w-px -translate-x-1/2 bg-[#1f2a3d]" />
          <span
            className="absolute bottom-[71px] left-0 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#dfe6f0] bg-[#f3f6fb] px-3 py-1.5 font-mono text-[15px] text-[#1f2a3d] shadow-[0_2px_8px_rgb(31_42_61/0.08)]"
            style={{ marginLeft: labelShift }}
          >
            {formatMetres(marker.metres)}
          </span>
          <span className="absolute left-0 top-0 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1f2a3d] bg-white" />
        </div>
      )}
    </footer>
  );
}
