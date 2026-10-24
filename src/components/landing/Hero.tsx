"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { type MapData, pinStyle, WorldMap } from "../ui/map";
import { Button, Eyebrow } from "./ui";

const ARCS = ["sea", "den", "chi", "aus", "atl", "ny"].map((end) => ({ start: "sf", end }));

// One office at a time has an outage; Uplink resolves it with whichever level fits.
const INCIDENTS = [
  { pin: "ny", place: "New York, US", time: "10:24 AM", cause: "ISP network issue", fixed: "Resolved in 6 min", how: "Ticket opened with your ISP" },
  { pin: "chi", place: "Chicago, US", time: "11:02 AM", cause: "DNS resolver down", fixed: "Resolved in 4 s", how: "Fixed on-device" },
  { pin: "atl", place: "Atlanta, US", time: "1:47 PM", cause: "Unknown fault", fixed: "Resolved in 11 min", how: "Devin wrote the fix" },
];
const DETECTED_MS = 3400;
const RESOLVED_MS = 2400;

const ORANGE = "#f05a28";
const GREEN = "#16a34a";
const BLUE = "#3b82f6";

function useIncidents() {
  const reduced = useReducedMotion();
  const [state, setState] = useState({ i: 0, resolved: false });
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => setState((s) => (s.resolved ? { i: (s.i + 1) % INCIDENTS.length, resolved: false } : { ...s, resolved: true })),
      state.resolved ? RESOLVED_MS : DETECTED_MS,
    );
    return () => clearTimeout(t);
  }, [state, reduced]);
  return state;
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const },
});

export function Hero({ map }: { map: MapData }) {
  const { i, resolved } = useIncidents();
  const inc = INCIDENTS[i];
  const color = resolved ? GREEN : ORANGE;

  return (
    <section id="top" className="relative overflow-hidden pt-[72px]">
      <div className="mx-auto grid max-w-[1160px] items-center gap-12 px-5 py-14 sm:px-8 lg:min-h-[620px] lg:grid-cols-[1fr_1.15fr] lg:gap-6 lg:py-8">
        <div>
          <motion.div {...rise(0)}>
            <Eyebrow dot>Autonomous network operations</Eyebrow>
          </motion.div>
          <motion.h1 {...rise(0.08)} className="mt-6 text-[clamp(42px,4.4vw,62px)] font-semibold leading-[1.04] tracking-[-0.045em] text-neutral-950">
            Internet down?
            <br />
            <span className="text-neutral-400">Already handled.</span>
          </motion.h1>
          <motion.p {...rise(0.16)} className="mt-6 max-w-[440px] text-[17px] leading-[1.65] text-neutral-500">
            Uplink monitors your business network, finds the source of outages, and handles your internet provider so your team
            doesn&apos;t have to.
          </motion.p>
          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap gap-3">
            <Button href="#book">
              Book a demo <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href="#how" tone="light">
              See how it works
            </Button>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 1 }} className="relative lg:-mr-10">
          <WorldMap map={map} dots={ARCS} lineColor={BLUE} dotColor="#cfcfcf" alert={{ pin: inc.pin, color }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${i}-${resolved}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="pointer-events-none absolute"
                style={pinStyle(map, inc.pin)}
              >
                <span className="absolute bottom-2 left-0 h-9 w-px -translate-x-1/2" style={{ background: color }} />
                <div className="absolute bottom-11 left-0 w-[184px] -translate-x-[82%] rounded-xl bg-neutral-950 px-3 py-2.5 shadow-[0_20px_40px_-12px_rgb(0_0_0/0.45)] sm:w-[240px] sm:px-4 sm:py-3">
                  <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {resolved ? inc.fixed : "Outage detected"}
                  </div>
                  <div className="mt-1.5 text-[12.5px] font-medium text-white sm:text-[14px]">
                    {inc.place} · {inc.time}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-neutral-500 sm:text-[12.5px]">{resolved ? inc.how : inc.cause}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          </WorldMap>
        </motion.div>
      </div>
    </section>
  );
}
