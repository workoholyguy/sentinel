"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { Fragment, useRef } from "react";
import { GlobeGlyph, OfficeGlyph, RouterGlyph, SearchGlyph, TowerGlyph } from "../glyphs";
import { Card } from "../ui";
import { useLoop } from "../useLoop";

export type HopState = "waiting" | "checking" | "ok" | "issue" | "reachable";

// A probe walks the path hop by hop; each hop is checked for a moment, then reports.
export const HOPS: Array<{ label: string; noun: string; icon: typeof OfficeGlyph; check: [number, number]; result: HopState; metric: string }> = [
  { label: "Your office", noun: "your office", icon: OfficeGlyph, check: [300, 750], result: "ok", metric: "1 ms" },
  { label: "Router", noun: "the router", icon: RouterGlyph, check: [1150, 1550], result: "ok", metric: "2 ms" },
  { label: "ISP", noun: "the ISP", icon: TowerGlyph, check: [1950, 2550], result: "issue", metric: "38% loss" },
  { label: "Internet", noun: "the internet", icon: GlobeGlyph, check: [2950, 3250], result: "reachable", metric: "Reachable" },
];
export const FOUND_AT = 3450;
const CONFIDENCE = 94;
const CONFIDENCE_MS = 900;
const NEXT_AT = 4700;
const LOOP_MS = 8400;

export function hopState(i: number, t: number): HopState {
  const [start, end] = HOPS[i].check;
  return t < start ? "waiting" : t < end ? "checking" : HOPS[i].result;
}

/** How far the probe has travelled along the link after hop `i` (0..1). */
export function segmentProgress(i: number, t: number): number {
  const from = HOPS[i].check[1];
  const to = HOPS[i + 1].check[0];
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

const NODE: Record<HopState, string> = {
  waiting: "border border-dashed border-neutral-300 bg-white text-neutral-300",
  checking: "bg-blue-50 text-blue-600",
  ok: "bg-emerald-50 text-emerald-600",
  issue: "bg-orange-500 text-white shadow-[0_10px_24px_-8px_rgb(249_115_22/0.8)]",
  reachable: "bg-neutral-100 text-neutral-500",
};
const STATUS: Record<HopState, string> = {
  waiting: "text-neutral-300",
  checking: "text-blue-600",
  ok: "text-emerald-600",
  issue: "text-orange-600",
  reachable: "text-neutral-400",
};

export function DiagnoseCard() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, LOOP_MS);
  const found = t >= FOUND_AT;
  const current = HOPS.reduce((at, hop, i) => (t >= hop.check[0] ? i : at), -1); // the hop the probe has reached
  const reported = t >= HOPS[HOPS.length - 1].check[1];
  const progressNote = current < 0 ? "Starting the trace…" : reported ? "Weighing the evidence…" : `Checking ${HOPS[current].noun} · hop ${current + 1} of ${HOPS.length}`;
  const confidence = Math.round(Math.min(1, Math.max(0, (t - FOUND_AT) / CONFIDENCE_MS)) * CONFIDENCE);

  return (
    <div ref={ref}>
      <Card className="overflow-hidden">
        {/* what the trace is doing right now */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5 whitespace-nowrap text-[13px] font-medium text-neutral-800 sm:text-[13.5px]">
            {found ? (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-orange-500 text-white">
                <span className="text-[11px] font-bold leading-none">!</span>
              </span>
            ) : (
              <span className="relative grid h-5 w-5 place-items-center text-blue-600">
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                <SearchGlyph className="h-2.5 w-2.5" />
              </span>
            )}
            {found ? "Root cause found" : "Tracing the path…"}
          </div>
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11.5px] tabular ${found ? "bg-orange-50 text-orange-600" : "bg-neutral-100 text-neutral-500"}`}>
            {found ? (
              <>
                <span className="hidden sm:inline">found in </span>
                {(FOUND_AT / 1000).toFixed(1)} s
              </>
            ) : (
              `${(t / 1000).toFixed(1)} s`
            )}
          </span>
        </div>

        {/* the path, hop by hop */}
        <div className="flex items-start px-3 pb-5 pt-6 sm:px-5">
          {HOPS.map((hop, i) => {
            const state = hopState(i, t);
            const Icon = hop.icon;
            return (
              <Fragment key={hop.label}>
                {i > 0 && <Link progress={segmentProgress(i - 1, t)} tone={i === 2 && hopState(2, t) === "issue" ? "issue" : i === 3 ? "bypass" : "ok"} />}
                <div className="relative flex w-[66px] flex-col items-center sm:w-[80px]">
                  <AnimatePresence>
                    {state === "issue" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute -inset-x-1 -bottom-2 -top-2 rounded-xl border border-dashed border-orange-400 bg-orange-50/50"
                      />
                    )}
                  </AnimatePresence>
                  <span className={`relative grid h-11 w-11 place-items-center rounded-full transition-colors duration-300 ${NODE[state]}`}>
                    {state === "checking" && <span className="absolute -inset-1 animate-spin rounded-full border-2 border-blue-500 border-r-transparent border-t-transparent" />}
                    {state === "issue" && <span className="halo absolute inset-0 rounded-full ring-2 ring-orange-400" />}
                    <Icon className="h-5 w-5" />
                    {state === "ok" && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                        <Check className="h-2.5 w-2.5" strokeWidth={4} />
                      </motion.span>
                    )}
                  </span>
                  <span className="relative mt-2.5 whitespace-nowrap text-[12px] font-medium text-neutral-800 sm:text-[13px]">{hop.label}</span>
                  <span className={`relative whitespace-nowrap font-mono text-[10.5px] sm:text-[11px] ${STATUS[state]}`}>
                    {state === "waiting" ? "waiting" : state === "checking" ? "checking…" : state === "ok" ? (
                      <>
                        <span className="hidden sm:inline">online · </span>
                        {hop.metric}
                      </>
                    ) : (
                      hop.metric
                    )}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>

        {/* the verdict: a skeleton while it works, then the root cause filling in (crossfaded, never blank) */}
        <div className="grid min-h-[136px] border-t border-neutral-100 bg-neutral-50/60 px-4 py-4 sm:px-5">
          <div className={`[grid-area:1/1] transition-opacity duration-300 ${found ? "pointer-events-none opacity-0" : "opacity-100"}`} aria-hidden={found}>
            <div className="flex gap-3">
              <span className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-neutral-200/70" />
              <div className="flex-1 space-y-2 pt-0.5">
                <div className="h-3 w-2/5 animate-pulse rounded bg-neutral-200/70" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-200/60" />
                <div className="h-1.5 w-full animate-pulse rounded-full bg-neutral-200/50" />
              </div>
            </div>
            <p className="mt-4 pl-12 text-[12px] text-neutral-400">{progressNote}</p>
          </div>

          <div className={`[grid-area:1/1] transition-[opacity,translate] duration-300 ${found ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`} aria-hidden={!found}>
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-500 text-white">
                <TowerGlyph className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-neutral-900">ISP network issue</span>
                  <span className="whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.12em] text-orange-600">Root cause</span>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-500">Office and router are healthy. Loss starts at your provider&apos;s node.</p>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200/70">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${confidence}%` }} />
                  </div>
                  <span className="w-[74px] text-right font-mono text-[11.5px] tabular text-neutral-600">{confidence}% sure</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 pl-12">
              <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11.5px] text-neutral-600">
                Responsible: <span className="font-medium text-neutral-900">Peachtree Fiber</span>
              </span>
              <span
                className={`rounded-full bg-neutral-950 px-2.5 py-1 text-[11.5px] font-medium text-white transition-[opacity,translate] duration-300 ${t >= NEXT_AT ? "translate-x-0 opacity-100" : "-translate-x-1.5 opacity-0"}`}
              >
                Next: calling the ISP →
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** The link between two hops: fills as the probe travels it, with the probe riding the front. */
function Link({ progress, tone }: { progress: number; tone: "ok" | "issue" | "bypass" }) {
  const fill = tone === "issue" ? "bg-orange-400" : tone === "bypass" ? "bg-neutral-300" : "bg-emerald-400";
  return (
    <div className="relative mx-0.5 mt-[22px] h-[2px] flex-1 rounded-full bg-neutral-100 sm:mx-1">
      <div className={`absolute inset-y-0 left-0 rounded-full transition-colors duration-300 ${fill}`} style={{ width: `${progress * 100}%` }} />
      {progress > 0 && progress < 1 && (
        <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgb(59_130_246/0.18)]" style={{ left: `${progress * 100}%` }} />
      )}
    </div>
  );
}
