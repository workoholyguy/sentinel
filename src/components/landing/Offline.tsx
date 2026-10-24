"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DotField } from "./DotField";
import { Section, SectionHeading } from "./ui";

const SPECS = [
  ["Model", "Llama 3.2 · 3B · on your machine"],
  ["Needs internet to diagnose", "No"],
  ["Network data sent to a cloud", "None"],
  ["Devin repairs while offline", "Queued until you're back"],
];

export function Offline() {
  const [offline, setOffline] = useState(false);
  const [auto, setAuto] = useState(true);
  const [diagnosed, setDiagnosed] = useState(false);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setOffline((o) => !o), 4600);
    return () => clearInterval(id);
  }, [auto]);

  useEffect(() => {
    setDiagnosed(false);
    if (!offline) return;
    const id = setTimeout(() => setDiagnosed(true), 1300);
    return () => clearTimeout(id);
  }, [offline]);

  return (
    <Section id="offline" className="py-24 sm:py-32">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <SectionHeading eyebrow="On-device" color="#34d399" title="Works when" dim="the internet doesn't.">
            Cloud monitoring goes blind the moment you need it. UPLink&apos;s brain runs on your own machine, so it keeps
            diagnosing with the line dead, and your network data never leaves the building.
          </SectionHeading>

          <button
            type="button"
            onClick={() => {
              setAuto(false);
              setOffline((o) => !o);
            }}
            className="mt-10 flex items-center gap-4 rounded-full border border-white/10 bg-white/[0.03] py-2 pl-2 pr-5 transition hover:border-white/20"
            aria-pressed={offline}
          >
            <span className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${offline ? "bg-bad/30" : "bg-ok/30"}`}>
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className={`absolute top-1 h-5 w-5 rounded-full ${offline ? "left-6 bg-bad" : "left-1 bg-ok"}`}
              />
            </span>
            <span className="text-left">
              <span className="block text-[14px] text-white/85">{offline ? "Internet: cut" : "Internet: online"}</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Tap to {offline ? "restore" : "pull the plug"}</span>
            </span>
          </button>

          <dl className="mt-10 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {SPECS.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6 py-3.5">
                <dt className="text-[14px] text-white/45">{k}</dt>
                <dd className="text-right font-mono text-[12.5px] text-white/80">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative aspect-[5/4] overflow-hidden rounded-3xl border hairline bg-[#05080d] sm:aspect-[4/3]">
          <DotField offline={offline} />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center">
              <span
                className={`relative grid h-16 w-16 place-items-center rounded-full border transition-colors duration-500 ${
                  offline ? "border-accent/70 bg-accent/10 text-accent" : "border-ok/60 bg-ok/10 text-ok"
                }`}
              >
                <span className="halo absolute inset-0 rounded-full border border-current" />
                <Building2 className="h-6 w-6" />
              </span>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-label text-white/50">Your office</div>
              <div className="glass mt-5 w-[min(320px,80vw)] rounded-2xl px-4 py-3 text-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={!offline ? "on" : diagnosed ? "dx" : "thinking"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {!offline ? (
                      <>
                        <div className="text-[14px] text-ok">Internet healthy · 18 ms</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">6 / 6 hops · checked every second</div>
                      </>
                    ) : diagnosed ? (
                      <>
                        <div className="text-[14px] text-white/90">ISP_OUTAGE · confidence 0.91</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">diagnosed on-device · 0 bytes sent</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[14px] text-bad">Internet down</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">local model diagnosing…</div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
