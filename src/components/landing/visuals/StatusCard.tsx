"use client";

import { useRef } from "react";
import { OfficeGlyph } from "../glyphs";
import { Card } from "../ui";
import { useLoop } from "../useLoop";

const SITES = [
  { name: "San Francisco HQ", ms: 12, uptime: "99.99%" },
  { name: "New York Office", ms: 24, uptime: "99.94%", flaky: true },
  { name: "London", ms: 18, uptime: "99.98%" },
  { name: "Singapore", ms: 36, uptime: "99.97%" },
];

const STEP_MS = 900;
const POINTS = 18;
const LOOP_MS = STEP_MS * 16;

/** Deterministic wobble so server and client draw the same sparkline. */
function latency(base: number, step: number, seed: number, spike: boolean) {
  const wobble = Math.sin(step * 1.9 + seed) * 0.12 + Math.sin(step * 0.7 + seed * 2) * 0.08;
  return Math.round(base * (1 + wobble) + (spike ? 200 + Math.sin(step) * 30 : 0));
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 64},${20 - ((v - min) / (max - min || 1)) * 16}`).join(" ");
  return (
    <svg viewBox="0 0 64 22" className="h-5 w-16" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StatusCard() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, LOOP_MS);
  const step = Math.floor(t / STEP_MS);
  const degraded = step >= 6 && step < 12; // New York goes bad for a while, then recovers

  return (
    <div ref={ref}>
      <Card>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 sm:px-6">
          <span className="text-[15px] font-medium text-neutral-900">Network status</span>
          <span className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${degraded ? "text-orange-600" : "text-emerald-600"}`}>
            <span className={`h-2 w-2 rounded-full ${degraded ? "bg-orange-500" : "bg-emerald-500"}`} />
            {degraded ? "1 location degraded" : "All systems operational"}
          </span>
        </div>
        <ul className="divide-y divide-neutral-100">
          {SITES.map((s, si) => {
            const bad = Boolean(s.flaky) && degraded;
            const series = Array.from({ length: POINTS }, (_, k) => {
              const at = step - (POINTS - 1 - k);
              return latency(s.ms, at, si + 1, Boolean(s.flaky) && at >= 6 && at < 12);
            });
            return (
              <li key={s.name} className="grid grid-cols-[1fr_auto_56px] items-center gap-4 px-5 py-4 sm:grid-cols-[1fr_104px_64px_64px] sm:px-6">
                <span className="flex items-center gap-3 text-[14px] text-neutral-800">
                  <OfficeGlyph className="h-[18px] w-[18px] text-neutral-400" />
                  {s.name}
                </span>
                <span className={`flex items-center gap-2 text-[13px] ${bad ? "text-orange-600" : "text-emerald-600"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${bad ? "bg-orange-500" : "bg-emerald-500"}`} />
                  {bad ? "Degraded" : "Online"}
                </span>
                <span className="text-right font-mono text-[13px] tabular text-neutral-500">{series[POINTS - 1]}ms</span>
                <span className="hidden justify-end sm:flex">
                  <Sparkline values={series} color={bad ? "#f97316" : "#93c5fd"} />
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between px-5 py-3 text-[12px] text-neutral-400 sm:px-6">
          <span>Checked every second</span>
          <span className="font-mono">uptime 30d · {SITES[0].uptime}</span>
        </div>
      </Card>
    </div>
  );
}
