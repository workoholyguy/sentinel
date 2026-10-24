"use client";

import { motion, type MotionValue, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { DevinMark } from "./brand";
import { CloudBuddy, type Mood } from "./CloudBuddy";
import { ProductDemo } from "./ProductDemo";
import { Sky } from "./Sky";
import { Button } from "./ui";

/** A mascot that bobs on its own and drifts against the cursor, deeper ones more. */
function Floater({ x, y, depth, className, bob, tilt, children }: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  depth: number;
  className: string;
  bob: string;
  tilt: string;
  children: ReactNode;
}) {
  const tx = useTransform(x, (v) => v * depth * -26);
  const ty = useTransform(y, (v) => v * depth * -18);
  return (
    <motion.div style={{ x: tx, y: ty }} className={`pointer-events-none absolute ${className}`}>
      <div className="bob" style={{ ["--bob" as string]: bob, ["--tilt" as string]: tilt }}>
        {children}
      </div>
    </motion.div>
  );
}

/** The left cloud loses its connection every few seconds and UPLink fixes it. */
function useOutageLoop(): Mood {
  const reduced = useReducedMotion();
  const [mood, setMood] = useState<Mood>("worried");
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setMood((m) => (m === "worried" ? "happy" : "worried")), 3400);
    return () => clearInterval(id);
  }, [reduced]);
  return reduced ? "happy" : mood;
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { delay, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] as const },
});

export function Hero() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 60, damping: 20 });
  const y = useSpring(my, { stiffness: 60, damping: 20 });
  const mood = useOutageLoop();

  return (
    <section
      id="top"
      className="relative overflow-hidden pb-20 sm:pb-28"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
    >
      <Sky variant="top" />

      <Floater x={x} y={y} depth={1.2} bob="6.5s" tilt="-3deg" className="left-[2%] top-[150px] hidden w-[200px] md:block lg:left-[5%] lg:w-[240px]">
        <CloudBuddy mood={mood} className="w-full" />
      </Floater>
      <Floater x={x} y={y} depth={1} bob="7.5s" tilt="3deg" className="right-[2%] top-[110px] hidden w-[190px] md:block lg:right-[5%] lg:w-[220px]">
        <CloudBuddy mood="happy" className="w-full" />
      </Floater>
      <Floater x={x} y={y} depth={0.6} bob="5.5s" tilt="4deg" className="left-[22%] top-[470px] hidden w-[86px] lg:block">
        <CloudBuddy mood="happy" className="w-full opacity-90" />
      </Floater>
      <Floater x={x} y={y} depth={0.5} bob="6s" tilt="-4deg" className="right-[20%] top-[440px] hidden w-[72px] lg:block">
        <CloudBuddy mood="happy" className="w-full opacity-90" />
      </Floater>

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-32 text-center sm:pt-40">
        <motion.h1 {...rise(0.05)} className="text-[clamp(48px,8.6vw,112px)] font-semibold leading-[0.96] tracking-[-0.055em] text-white">
          Internet down?
          <br />
          <span className="text-white/75">Already handled.</span>
        </motion.h1>

        <motion.p {...rise(0.18)} className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-white/80 sm:text-[19px]">
          UPLink fixes your office network on its own, and calls your ISP when it can&apos;t.
        </motion.p>

        <motion.div {...rise(0.3)} className="mt-7 flex items-center gap-2.5 text-[15px] text-white/85 sm:text-[17px]">
          Repairs powered by
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25">
            <DevinMark className="h-4 w-4" color="#fff" />
          </span>
          <span className="font-semibold text-white">Devin</span>
        </motion.div>

        <motion.div {...rise(0.42)} className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button href="#get-started" tone="light" className="px-6 py-3.5 text-[16px]">
            Book a demo <ArrowRight className="h-4 w-4" />
          </Button>
          <Button href="#demo" tone="navy" className="px-6 py-3.5 text-[16px]">
            <Play className="h-3.5 w-3.5 fill-current" /> Watch it work
          </Button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 1, ease: [0.2, 0.7, 0.2, 1] }}
        className="relative mt-20 px-3 sm:mt-24 sm:px-6"
      >
        <ProductDemo />
      </motion.div>
    </section>
  );
}
