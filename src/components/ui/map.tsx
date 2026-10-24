"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useId } from "react";
import type { MapData } from "./dotted-map";

export type { MapData } from "./dotted-map";

interface MapProps {
  /** dot grid and pin positions from buildDottedMap() (computed on the server) */
  map: MapData;
  /** arcs between pin ids */
  dots?: Array<{ start: string; end: string }>;
  lineColor?: string;
  dotColor?: string;
  showLabels?: boolean;
  animationDuration?: number;
  /** redraw the arcs on a loop instead of drawing them once */
  loop?: boolean;
  /** pin whose arc is highlighted (an outage), and its colour */
  alert?: { pin: string; color: string } | null;
  className?: string;
  /** HTML overlays; position them with pinStyle() */
  children?: ReactNode;
}

/** Absolute position for an HTML overlay sitting on a pin (the map keeps its own aspect ratio). */
export function pinStyle(map: MapData, id: string): { left: string; top: string } {
  const p = map.pins[id];
  return { left: `${(p.x / map.width) * 100}%`, top: `${(p.y / map.height) * 100}%` };
}

function arcPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const lift = Math.hypot(b.x - a.x, b.y - a.y) * 0.28;
  return `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - lift} ${b.x} ${b.y}`;
}

/** Dotted world map with animated arcs between places (adapted from the WorldMap component). */
export function WorldMap({
  map,
  dots = [],
  lineColor = "#0ea5e9",
  dotColor = "#d4d4d4",
  showLabels = false,
  animationDuration = 2,
  loop = false,
  alert = null,
  className = "",
  children,
}: MapProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const unit = map.width / 100; // scale strokes and dots to the grid
  const stagger = 0.25;
  const cycle = dots.length * stagger + animationDuration + 2;

  return (
    <div className={`relative w-full select-none ${className}`} style={{ aspectRatio: `${map.width} / ${map.height}` }}>
      <svg viewBox={`0 0 ${map.width} ${map.height}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-line`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0" />
            <stop offset="12%" stopColor={lineColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={`${id}-fade`} cx="50%" cy="50%" r="60%">
            <stop offset="0.55" stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-mask`}>
            <rect width={map.width} height={map.height} fill={`url(#${id}-fade)`} />
          </mask>
        </defs>

        <path d={map.dots} stroke={dotColor} strokeWidth={unit * 0.5} strokeLinecap="round" fill="none" mask={`url(#${id}-mask)`} />

        {dots.map((arc, i) => {
          const a = map.pins[arc.start];
          const b = map.pins[arc.end];
          if (!a || !b) return null;
          const d = arcPath(a, b);
          const hot = alert?.pin === arc.end;
          const color = hot ? alert!.color : lineColor;
          const t0 = (i * stagger) / cycle;
          const t1 = (i * stagger + animationDuration) / cycle;
          return (
            <g key={`${arc.start}-${arc.end}`}>
              <motion.path
                d={d}
                fill="none"
                stroke={hot ? color : `url(#${id}-line)`}
                strokeWidth={unit * (hot ? 0.32 : 0.2)}
                strokeLinecap="round"
                initial={{ pathLength: reduced ? 1 : 0 }}
                animate={loop && !reduced ? { pathLength: [0, 0, 1, 1, 0] } : { pathLength: 1 }}
                transition={
                  loop && !reduced
                    ? { duration: cycle, times: [0, t0, t1, (cycle - 1) / cycle, 1], ease: "easeInOut", repeat: Infinity }
                    : { duration: animationDuration, delay: 0.3 + i * stagger, ease: "easeInOut" }
                }
                style={{ transition: "stroke 0.4s ease" }}
              />
              {!reduced && (
                <circle r={unit * 0.45} fill={color}>
                  <animateMotion dur={`${2.6 + (i % 3) * 0.5}s`} begin={`${animationDuration + i * stagger}s`} repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}

        {Object.entries(map.pins).map(([pid, p]) => {
          const hot = alert?.pin === pid;
          const color = hot ? alert!.color : lineColor;
          return (
            <g key={pid}>
              {(hot || !reduced) && (
                <circle cx={p.x} cy={p.y} r={unit * 0.6} fill={color} opacity="0.5">
                  <animate attributeName="r" from={unit * 0.6} to={unit * (hot ? 3.4 : 2)} dur={hot ? "1.4s" : "2.4s"} repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur={hot ? "1.4s" : "2.4s"} repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={p.x} cy={p.y} r={unit * (hot ? 0.95 : 0.7)} fill={color} stroke="#fff" strokeWidth={unit * 0.25} style={{ transition: "fill 0.4s ease" }} />
            </g>
          );
        })}
      </svg>

      {showLabels &&
        Object.entries(map.pins).map(([pid, p]) =>
          p.label ? (
            <span
              key={pid}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md border border-neutral-200 bg-white/95 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 shadow-sm"
              style={pinStyle(map, pid)}
            >
              {p.label}
            </span>
          ) : null,
        )}
      {children}
    </div>
  );
}
