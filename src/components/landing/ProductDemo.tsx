"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Activity, CircleCheck, ChevronsUpDown, Home, PhoneCall, Settings, TriangleAlert, type LucideIcon } from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { DevinMark, LogoMark } from "./brand";
import { markAt, type TimedBeat } from "./script";
import { DEVIN_FIX, DevinFix } from "./stages/DevinFix";
import { ISP_CALL, IspCall } from "./stages/IspCall";
import { LOCAL_FIX, LocalFix } from "./stages/LocalFix";

const HOLD_MS = 2200; // pause on the last frame before moving to the next step

interface Step {
  tab: string;
  nav: string;
  status: (t: number) => { text: string; dot: string; resolved?: boolean };
  script: { beats: TimedBeat[]; total: number };
  Stage: ComponentType<{ t: number }>;
}

export const STEPS: Step[] = [
  {
    tab: "Fix it locally",
    nav: "Network",
    status: () => ({ text: "Fixing on-device", dot: "bg-indigo-500" }),
    script: LOCAL_FIX,
    Stage: LocalFix,
  },
  {
    tab: "Call the ISP",
    nav: "Calls",
    status: () => ({ text: "On a call with your ISP", dot: "bg-amber-500" }),
    script: ISP_CALL,
    Stage: IspCall,
  },
  {
    tab: "Devin writes a fix",
    nav: "Repairs",
    status: (t) =>
      t >= markAt(DEVIN_FIX.beats, "live") ? { text: "Resolved in 11 min", dot: "bg-emerald-500", resolved: true } : { text: "Devin is writing a fix", dot: "bg-violet-500" },
    script: DEVIN_FIX,
    Stage: DevinFix,
  },
];

const NAV: Array<{ label: string; icon: LucideIcon | "devin"; badge?: string }> = [
  { label: "Home", icon: Home },
  { label: "Network", icon: Activity },
  { label: "Incidents", icon: TriangleAlert, badge: "1" },
  { label: "Calls", icon: PhoneCall },
  { label: "Repairs", icon: "devin" },
  { label: "Settings", icon: Settings },
];

/** Plays the three steps one after another while on screen; tabs jump straight to a step. */
function useSequence(inView: boolean) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [t, setT] = useState(0);
  const [restart, setRestart] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    let raf = 0;
    const start = performance.now();
    let painted = -Infinity;
    const total = STEPS[step].script.total + HOLD_MS;
    const tick = (now: number) => {
      const el = now - start;
      if (el >= total) {
        setT(0);
        setStep((s) => (s + 1) % STEPS.length);
        return;
      }
      if (now - painted > 32) {
        painted = now;
        setT(el);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, step, restart]);

  const go = (i: number) => {
    setT(0);
    setStep(i);
    setRestart((r) => r + 1);
  };
  return { step, t: reduced ? STEPS[step].script.total : t, go };
}

export function ProductDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const { step, t, go } = useSequence(inView);
  const current = STEPS[step];
  const status = current.status(t);
  const progress = Math.min(1, t / current.script.total);

  return (
    <div ref={ref} id="demo" className="relative mx-auto w-full max-w-[1120px] scroll-mt-24">
      <div className="relative z-20 mx-auto -mb-5 flex w-fit items-center gap-3 rounded-full bg-[#1b1a3a]/90 py-2 pl-2 pr-5 text-[13.5px] text-white shadow-xl backdrop-blur sm:text-[15px]">
        <LogoMark className="h-7 w-7" />
        Watch UPLink handle a real outage.
      </div>

      <div className="rounded-[28px] bg-gradient-to-b from-white/70 to-white/40 p-2 shadow-[0_40px_100px_-30px_rgb(49_46_129/0.45)] ring-1 ring-white/80 backdrop-blur-sm sm:p-3">
        <div className="grid overflow-hidden rounded-[20px] bg-white ring-1 ring-neutral-200/70 md:grid-cols-[228px_1fr]">
          <aside className="hidden flex-col border-r border-neutral-200/80 bg-neutral-50/60 p-3 md:flex">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <LogoMark className="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-neutral-900">Northside Dental</div>
                <div className="text-[11px] text-neutral-400">3 sites</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-400" />
            </div>
            <nav className="mt-3 space-y-0.5">
              {NAV.map(({ label, icon: Icon, badge }) => {
                const active = label === current.nav;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors duration-300 ${
                      active ? "bg-indigo-50 font-medium text-indigo-700" : "text-neutral-500"
                    }`}
                  >
                    {Icon === "devin" ? <DevinMark className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    {label}
                    {badge && <span className="ml-auto rounded-full bg-rose-100 px-1.5 text-[10.5px] font-semibold text-rose-600">{badge}</span>}
                  </div>
                );
              })}
            </nav>
            <div className="mt-auto rounded-xl border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-neutral-700">
                <span className="relative grid h-2 w-2 place-items-center">
                  <span className="halo absolute inset-0 rounded-full bg-emerald-400" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Agent online
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-400">On-device · works offline</div>
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ring-1 transition-colors duration-500 ${
                    status.resolved ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-rose-50 text-rose-500 ring-rose-100"
                  }`}
                >
                  {status.resolved ? <CircleCheck className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
                </span>
                <div>
                  <div className="text-[12px] text-neutral-400">Incident · 9:41 AM · Front desk</div>
                  <div className="text-[17px] font-semibold tracking-[-0.01em] text-neutral-900 sm:text-[19px]">Sites are timing out</div>
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.span
                  key={status.text}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-neutral-700"
                >
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                  {status.text}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-1" role="tablist" aria-label="How UPLink escalates">
              {STEPS.map((s, i) => (
                <button
                  key={s.tab}
                  type="button"
                  role="tab"
                  aria-selected={i === step}
                  onClick={() => go(i)}
                  className={`relative flex-1 whitespace-nowrap rounded-lg px-3 py-2 font-mono text-[12px] transition sm:text-[13px] ${
                    i === step ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-400 hover:text-neutral-600"
                  }`}
                >
                  {i + 1}. {s.tab}
                  {i === step && (
                    <span className="absolute inset-x-3 bottom-0.5 h-[2px] overflow-hidden rounded-full bg-neutral-100">
                      <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${progress * 100}%` }} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4 md:h-[430px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
                  className="h-full"
                >
                  <current.Stage t={t} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
