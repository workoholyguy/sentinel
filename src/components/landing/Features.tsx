"use client";

import { animate, AnimatePresence, motion, useInView } from "framer-motion";
import { Cpu, ReceiptText, ScrollText, Wifi, WifiOff, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Eyebrow, Heading, Section } from "./ui";

/** Ticks a counter every `ms` while the element is on screen. */
function useTicker(ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [inView, ms]);
  return { ref, n, inView };
}

function Offline() {
  const { ref, n } = useTicker(2600);
  const down = n % 2 === 1;
  return (
    <div ref={ref} className="flex h-full flex-col items-center justify-center gap-4">
      <motion.span
        animate={{ scale: down ? [1, 1.08, 1] : 1 }}
        className={`grid h-16 w-16 place-items-center rounded-2xl transition-colors duration-500 ${down ? "bg-rose-100 text-rose-500" : "bg-emerald-100 text-emerald-600"}`}
      >
        {down ? <WifiOff className="h-7 w-7" /> : <Wifi className="h-7 w-7" />}
      </motion.span>
      <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 shadow-sm">
        <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-white">
          {down && <span className="halo absolute inset-0 rounded-lg ring-2 ring-indigo-400" />}
          <Cpu className="h-4 w-4" />
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={down ? "dx" : "ok"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="font-mono text-[12px] text-neutral-700"
          >
            {down ? "ISP_OUTAGE · on-device" : "Online · 18 ms"}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

const LOG = [
  ["09:41:07", "bg-rose-500", "DNS timeout, 3 of 3"],
  ["09:41:09", "bg-emerald-500", "dns-flush-cache ✓"],
  ["09:44:02", "bg-amber-500", "Called ISP · PF-88214"],
  ["09:52:30", "bg-violet-500", "Devin fix applied"],
];

function Evidence() {
  const { ref, n } = useTicker(750);
  const shown = n % (LOG.length + 3);
  return (
    <div ref={ref} className="flex h-full flex-col justify-center gap-2 px-1">
      {LOG.map(([time, dot, text], i) => (
        <motion.div
          key={time}
          initial={false}
          animate={{ opacity: i < shown ? 1 : 0, x: i < shown ? 0 : -8 }}
          className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-[11.5px]"
        >
          <span className="tabular text-neutral-400">{time}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span className="truncate text-neutral-700">{text}</span>
        </motion.div>
      ))}
    </div>
  );
}

function Credit() {
  const { ref, n, inView } = useTicker(5200);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, 4.3, { duration: 1.6, ease: [0.2, 0.7, 0.2, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, n]);
  return (
    <div ref={ref} className="flex h-full items-center justify-center">
      <div className="w-[210px] rounded-xl border border-dashed border-neutral-300 bg-white p-4 font-mono text-[11.5px] shadow-sm">
        <div className="flex justify-between text-neutral-400">
          <span>Peachtree Fiber</span>
          <span>PF-88213</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-neutral-200" />
        <div className="flex justify-between text-neutral-500">
          <span>Downtime</span>
          <span className="text-neutral-800">3 h 04 m</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-neutral-500">Credit</span>
          <span className="text-[24px] font-medium tabular text-emerald-600">${value.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

const CELLS: Array<{ icon: LucideIcon; title: string; text: string; art: ReactNode }> = [
  { icon: Cpu, title: "Works offline", text: "The AI runs on your own machine, so it keeps working with the line dead.", art: <Offline /> },
  { icon: ScrollText, title: "Proof on every call", text: "Every probe, fix and call is logged. Your ISP can't argue with it.", art: <Evidence /> },
  { icon: ReceiptText, title: "Credits, claimed", text: "Downtime is billed back to your provider. UPLink always asks.", art: <Credit /> },
];

export function Features() {
  return (
    <Section id="why" className="py-24 sm:py-32">
      <Eyebrow className="text-center">Why UPLink</Eyebrow>
      <div className="mt-5">
        <Heading>Your network, on autopilot.</Heading>
      </div>
      <div className="mt-14 grid overflow-hidden rounded-2xl border border-neutral-200 bg-white md:grid-cols-3 md:divide-x md:divide-neutral-200">
        {CELLS.map(({ icon: Icon, title, text, art }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="border-t border-neutral-200 p-6 first:border-t-0 md:border-t-0"
          >
            <div className="h-48 rounded-xl border border-neutral-100 bg-neutral-50 p-4">{art}</div>
            <div className="mt-5 flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.12em] text-indigo-600">
              <Icon className="h-4 w-4" /> {title}
            </div>
            <p className="mt-2 text-[15.5px] leading-relaxed text-neutral-600">{text}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
