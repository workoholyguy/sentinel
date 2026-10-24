"use client";

import { motion } from "framer-motion";
import { Fragment, useRef } from "react";
import { GlobeGlyph, OfficeGlyph, RouterGlyph, SearchGlyph, TowerGlyph } from "../glyphs";
import { Card } from "../ui";
import { useLoop } from "../useLoop";

const LOOP_MS = 7600;
type State = "checking" | "ok" | "issue" | "reachable";

// Uplink walks the chain hop by hop and stops at the one that's broken.
const HOPS = [
  { label: "Your office", icon: OfficeGlyph, at: 500, result: "ok" as State },
  { label: "Router", icon: RouterGlyph, at: 1100, result: "ok" as State },
  { label: "ISP", icon: TowerGlyph, at: 1800, result: "issue" as State },
  { label: "Internet", icon: GlobeGlyph, at: 2400, result: "reachable" as State },
];
const CAUSE_AT = 2900;

const STYLE: Record<State, { ring: string; text: string; label: string }> = {
  checking: { ring: "bg-neutral-100 text-neutral-400", text: "text-neutral-400", label: "Checking…" },
  ok: { ring: "bg-emerald-100/70 text-emerald-600", text: "text-emerald-600", label: "Online" },
  issue: { ring: "bg-orange-500 text-white shadow-[0_8px_20px_-6px_rgb(249_115_22/0.7)]", text: "text-orange-600", label: "Issue detected" },
  reachable: { ring: "bg-neutral-100 text-neutral-500", text: "text-neutral-400", label: "Reachable" },
};

export function DiagnoseCard() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, LOOP_MS);
  const found = t >= CAUSE_AT;

  return (
    <div ref={ref} className="relative pb-36">
      <Card className="px-4 py-8 sm:px-8">
        <div className="flex items-start">
          {HOPS.map((hop, i) => {
            const state: State = t >= hop.at ? hop.result : "checking";
            const s = STYLE[state];
            const Icon = hop.icon;
            return (
              <Fragment key={hop.label}>
                {i > 0 && (
                  <div className="relative mt-6 h-px flex-1 bg-neutral-200">
                    <motion.div
                      className={`absolute inset-y-0 left-0 ${hop.result === "issue" && state === "issue" ? "bg-orange-300" : "bg-emerald-300"}`}
                      initial={false}
                      animate={{ width: t >= hop.at ? "100%" : "0%" }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                )}
                <div className="relative flex w-[72px] flex-col items-center sm:w-[88px]">
                  {state === "issue" && <div className="absolute -inset-x-1 -bottom-3 -top-3 rounded-xl border border-dashed border-orange-400/80 bg-orange-50/40 sm:-inset-x-2" />}
                  <span className={`relative grid h-12 w-12 place-items-center rounded-full transition-colors duration-300 ${s.ring}`}>
                    {state === "checking" && t > 0 ? <SearchGlyph className="h-5 w-5 animate-pulse" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span className="relative mt-3 text-[13px] font-medium text-neutral-800">{hop.label}</span>
                  <span className={`relative whitespace-nowrap text-[11px] sm:text-[12px] ${s.text}`}>{s.label}</span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </Card>

      <motion.div
        initial={false}
        animate={{ opacity: found ? 1 : 0, y: found ? 0 : 10 }}
        transition={{ duration: 0.4 }}
        className="absolute bottom-0 left-[62%]"
      >
        <div className="absolute -top-[56px] left-0 h-[56px] border-l border-dashed border-orange-400 sm:-top-[76px] sm:h-[76px]">
          <span className="absolute -bottom-1 -left-[3.5px] h-1.5 w-1.5 rounded-full bg-orange-500" />
        </div>
        <div className="w-[min(300px,78vw)] -translate-x-[60%]">
          <Card className="flex gap-3.5 p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500 text-white">
              <TowerGlyph className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[14px] font-semibold leading-tight text-neutral-900">Root cause identified</div>
              <div className="text-[14px] font-semibold leading-tight text-neutral-900">ISP network issue</div>
              <p className="mt-2 text-[12.5px] leading-snug text-neutral-500">The fault is on your provider&apos;s network. Your internal systems are healthy.</p>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
