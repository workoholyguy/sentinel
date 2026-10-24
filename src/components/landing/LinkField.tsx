"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Check, Globe, Laptop, Router, Wifi, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DevinMark, LogoMark } from "./brand";
import { cycleAt, FAULTS, type LinkState, linkState, type Phase } from "./linkCycle";

interface Node {
  id: string;
  label: string;
  /** position inside the field, 0..1 */
  x: number;
  y: number;
  icon?: LucideIcon;
  tile?: string;
}

// The path a packet takes, from your desk to Devin. UPLink sits in the middle, watching every hop.
const NODES: Node[] = [
  { id: "laptop", label: "Laptop", x: 0.075, y: 0.22, icon: Laptop, tile: "from-sky-400 to-sky-600" },
  { id: "wifi", label: "Wi-Fi", x: 0.125, y: 0.53, icon: Wifi, tile: "from-indigo-400 to-indigo-600" },
  { id: "router", label: "Router", x: 0.07, y: 0.83, icon: Router, tile: "from-blue-400 to-blue-600" },
  { id: "uplink", label: "UPLink", x: 0.5, y: 0.95 },
  { id: "isp", label: "ISP", x: 0.93, y: 0.83, icon: Building2, tile: "from-amber-400 to-orange-500" },
  { id: "internet", label: "Internet", x: 0.875, y: 0.53, icon: Globe, tile: "from-emerald-400 to-emerald-600" },
  { id: "devin", label: "Devin", x: 0.925, y: 0.22, tile: "from-violet-500 to-violet-700" },
];
const LINKS = NODES.length - 1;

/** Steps through the fault cycle while mounted (frozen on "all healthy" with reduced motion). */
export function useLinkCycle(): { k: number; phase: Phase } {
  const reduced = useReducedMotion();
  const [state, setState] = useState<{ k: number; phase: Phase }>({ k: 0, phase: "ok" });
  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    const id = setInterval(() => {
      const next = cycleAt(performance.now() - start);
      setState((s) => (s.k === next.k && s.phase === next.phase ? s : next));
    }, 120);
    return () => clearInterval(id);
  }, [reduced]);
  return reduced ? { k: 0, phase: "ok" } : state;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

type Pt = { x: number; y: number };
function curve(a: Pt, b: Pt): { d: string; mid: Pt } {
  const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
  const c1 = horizontal ? { x: (a.x + b.x) / 2, y: a.y } : { x: a.x, y: (a.y + b.y) / 2 };
  const c2 = horizontal ? { x: (a.x + b.x) / 2, y: b.y } : { x: b.x, y: (a.y + b.y) / 2 };
  const mid = { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 };
  return { d: `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`, mid };
}

const LINK_STROKE: Record<LinkState, { base: string; flow?: string; width: number; dash?: string }> = {
  ok: { base: "#c7d2fe", flow: "#6366f1", width: 1.5 },
  dead: { base: "#e5e5e5", width: 1.5 },
  broken: { base: "#fb7185", width: 1.75, dash: "5 6" },
  escalating: { base: "#ddd6fe", flow: "#8b5cf6", width: 1.5 },
  healed: { base: "", flow: "#ffffff", width: 3 },
};

function Tile({ node, alarm }: { node: Node; alarm: boolean }) {
  const Icon = node.icon;
  if (node.id === "uplink") {
    return (
      <div className="relative">
        <span className="halo absolute -inset-1 rounded-[22px] ring-2 ring-indigo-300" />
        <div className="relative rounded-[20px] bg-white p-2 shadow-[0_20px_50px_-18px_rgb(79_70_229/0.55)] ring-1 ring-indigo-200">
          <LogoMark className="h-14 w-14" />
        </div>
      </div>
    );
  }
  return (
    <div className="relative rounded-[18px] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgb(49_46_129/0.35)] ring-1 ring-neutral-200/80">
      <div className={`grid h-12 w-12 place-items-center rounded-[13px] bg-gradient-to-br ${node.tile} text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]`}>
        {Icon ? <Icon className="h-6 w-6" /> : <DevinMark className="h-6 w-6" color="#fff" />}
      </div>
      <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-white transition-colors duration-300 ${alarm ? "bg-rose-500" : "bg-emerald-500"}`}>
        {alarm && <span className="halo absolute inset-0 rounded-full bg-rose-400" />}
      </span>
    </div>
  );
}

function StatusChip({ k, phase }: { k: number; phase: Phase }) {
  const f = FAULTS[k];
  return (
    <AnimatePresence mode="wait">
      {phase !== "ok" && (
        <motion.span
          key={`${k}-${phase}`}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-neutral-800 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.25)] ring-1 ring-neutral-200"
        >
          {phase === "broken" ? (
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          ) : (
            <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: f.tone }}>
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
            </span>
          )}
          {phase === "broken" ? f.fault : f.fix}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export interface CycleState {
  k: number;
  phase: Phase;
}

/** Desktop: device tiles framing the headline, linked by flowing packets. */
export function LinkField({ k, phase, className = "" }: CycleState & { className?: string }) {
  const { ref, w, h } = useSize<HTMLDivElement>();
  const f = FAULTS[k];
  const pts = NODES.map((n) => ({ x: n.x * w, y: n.y * h }));
  const links = pts.slice(1).map((b, i) => ({ ...curve(pts[i], b), state: linkState(i, k, phase, LINKS) }));
  const alarmNode = phase === "broken" ? f.link + 1 : -1;

  return (
    <div ref={ref} className={`pointer-events-none ${className}`} aria-hidden="true">
      {w > 0 && (
        <svg width={w} height={h} className="absolute inset-0 overflow-visible">
          {links.map((l, i) => {
            const s = LINK_STROKE[l.state];
            const healedTone = l.state === "healed" ? (i === LINKS - 1 ? FAULTS[2].tone : f.tone) : undefined;
            return (
              <g key={i}>
                <path
                  d={l.d}
                  fill="none"
                  stroke={healedTone ?? s.base}
                  strokeWidth={s.width}
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                  style={healedTone ? { filter: `drop-shadow(0 0 6px ${healedTone})` } : undefined}
                  className="transition-[stroke] duration-300"
                />
                {s.flow && <path d={l.d} fill="none" stroke={s.flow} strokeWidth="3" strokeLinecap="round" className="flow" opacity={l.state === "healed" ? 0.9 : 0.75} />}
                {l.state === "broken" && (
                  <g transform={`translate(${l.mid.x} ${l.mid.y})`}>
                    <circle r="10" fill="#fff" stroke="#fb7185" strokeWidth="1.5" />
                    <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {NODES.map((n, i) => (
        <div key={n.id} className="absolute" style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}>
          <div className="-translate-x-1/2 -translate-y-1/2">
            <Tile node={n} alarm={i === alarmNode} />
          </div>
          {n.id !== "uplink" && (
            <div className="absolute left-0 top-[36px] -translate-x-1/2 whitespace-nowrap rounded bg-[#fafafa] px-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-neutral-500">
              {n.label}
            </div>
          )}
        </div>
      ))}

      {w > 0 && (
        <div className="absolute" style={{ left: links[f.link].mid.x, top: links[f.link].mid.y }}>
          <div className="-translate-x-1/2 -translate-y-[calc(100%+18px)]">
            <StatusChip k={k} phase={phase} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Smaller screens: the same chain as one row, with the status chip under it. */
export function LinkStrip({ k, phase, className = "" }: CycleState & { className?: string }) {
  const f = FAULTS[k];
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`} aria-hidden="true">
      <div className="flex items-center">
        {NODES.map((n, i) => {
          const state = i > 0 ? linkState(i - 1, k, phase, LINKS) : "ok";
          const Icon = n.icon;
          return (
            <div key={n.id} className="flex items-center">
              {i > 0 && (
                <span
                  className={`h-[2px] w-3 sm:w-6 ${state === "ok" || state === "escalating" || state === "healed" ? "flow-x" : ""}`}
                  style={{
                    color: state === "healed" ? (i === LINKS ? FAULTS[2].tone : f.tone) : state === "escalating" ? "#8b5cf6" : "#6366f1",
                    background: state === "broken" ? "#fb7185" : state === "dead" ? "#e5e5e5" : undefined,
                  }}
                />
              )}
              {n.id === "uplink" ? (
                <LogoMark className="h-9 w-9 sm:h-10 sm:w-10" />
              ) : (
                <span className={`relative grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br text-white shadow-sm sm:h-9 sm:w-9 ${n.tile}`}>
                  {Icon ? <Icon className="h-4 w-4" /> : <DevinMark className="h-4 w-4" color="#fff" />}
                  {phase === "broken" && i === f.link + 1 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="h-8">
        <StatusChip k={k} phase={phase} />
      </div>
    </div>
  );
}
