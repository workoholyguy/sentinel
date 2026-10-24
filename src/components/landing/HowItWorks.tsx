"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowDown, Building2, Laptop, Radar } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { DevinMark } from "./brand";
import { CallStage } from "./stages/CallStage";
import { DevinStage } from "./stages/DevinStage";
import { TerminalStage } from "./stages/TerminalStage";
import { Chip, Section, SectionHeading } from "./ui";

const STEPS: Array<{
  n: string;
  level: string;
  title: string;
  text: string;
  chips: string[];
  next?: string;
  color: string;
  stage: ReactNode;
}> = [
  {
    n: "01",
    level: "Level 1 · Your network",
    title: "Fixes it on the spot.",
    text: "UPLink checks every hop each second and diagnoses with a model on your own machine. If the fault is local, it opens a terminal and runs the fix itself.",
    chips: ["DNS", "DHCP", "Wi-Fi", "Router", "IPv6"],
    next: "Not local? It picks up the phone.",
    color: "#38e1ff",
    stage: <TerminalStage />,
  },
  {
    n: "02",
    level: "Level 2 · Your provider",
    title: "Calls your ISP.",
    text: "When the fault is upstream, UPLink phones support with timestamps and evidence, gets past “have you tried restarting?”, and doesn't hang up without a ticket and a credit.",
    chips: ["Comcast", "AT&T", "Verizon", "Spectrum", "Any ISP"],
    next: "Provider says it's not them? Devin takes over.",
    color: "#fbbf24",
    stage: <CallStage />,
  },
  {
    n: "03",
    level: "Level 3 · Devin",
    title: "Devin writes the fix.",
    text: "A fault nobody has seen before goes to Devin with the full evidence. Devin writes a new repair plugin, tests it and ships it, so next time UPLink fixes it locally.",
    chips: ["New plugin", "Tests", "Pull request", "Learns every fault"],
    color: "#a78bfa",
    stage: <DevinStage />,
  },
];

const LADDER = [
  { icon: Radar, label: "Detect", sub: "every second", color: "#34d399" },
  { icon: Laptop, label: "Fix locally", sub: "seconds", color: "#38e1ff" },
  { icon: Building2, label: "Call the ISP", sub: "minutes", color: "#fbbf24" },
  { icon: null, label: "Devin", sub: "new faults", color: "#a78bfa" },
];

function Ladder() {
  return (
    <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-0">
      {LADDER.map(({ icon: Icon, label, sub, color }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ delay: i * 0.15 }}
          className="relative flex flex-col items-center gap-2 text-center"
        >
          {i > 0 && (
            <div
              className="absolute top-6 hidden h-px sm:block"
              style={{ right: "calc(50% + 34px)", width: "calc(100% - 68px)", background: `linear-gradient(90deg, ${LADDER[i - 1].color}66, ${color}66)` }}
            >
              <span className="packet h-1 w-1 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}`, ["--dur" as string]: "2.4s", ["--delay" as string]: `${i * 0.4}s` }} />
            </div>
          )}
          <span className="relative grid h-12 w-12 place-items-center rounded-2xl border bg-ink-950" style={{ borderColor: `${color}55`, color }}>
            {Icon ? <Icon className="h-5 w-5" /> : <DevinMark className="h-5 w-5" />}
          </span>
          <div className="text-[14px] font-medium text-white/85">{label}</div>
          <div className="-mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">{sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

function Step({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  return (
    <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pl-16">
      <span
        className="absolute left-0 top-2 hidden h-[33px] w-[33px] -translate-x-1/2 place-items-center rounded-full border bg-ink-950 font-mono text-[11px] lg:grid"
        style={{ borderColor: step.color, color: step.color, boxShadow: `0 0 24px ${step.color}55` }}
      >
        {index + 1}
      </span>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
        className="lg:sticky lg:top-32 lg:self-start"
      >
        <div
          className="text-[88px] font-semibold leading-none tracking-[-0.06em] sm:text-[120px]"
          style={{ color: "transparent", WebkitTextStroke: `1px ${step.color}88`, backgroundImage: `linear-gradient(180deg, ${step.color}33, transparent 80%)`, WebkitBackgroundClip: "text", backgroundClip: "text" }}
        >
          {step.n}
        </div>
        <div className="mt-4 font-mono text-[11px] uppercase tracking-label" style={{ color: step.color }}>
          {step.level}
        </div>
        <h3 className="mt-3 text-[clamp(30px,3.3vw,42px)] font-semibold leading-[1.05] tracking-[-0.04em] text-white">{step.title}</h3>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/55">{step.text}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {step.chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        {step.next && (
          <div className="mt-8 inline-flex items-center gap-2 text-[14px] text-white/45">
            <ArrowDown className="h-4 w-4" style={{ color: STEPS[index + 1].color }} /> {step.next}
          </div>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {step.stage}
      </motion.div>
    </div>
  );
}

export function HowItWorks() {
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: railRef, offset: ["start 60%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <Section id="how" className="py-24 sm:py-32">
      <SectionHeading center eyebrow="How it works" title="Three levels of escalation." dim="Zero tickets filed by you.">
        UPLink starts at your desk and works outward, only as far as it has to.
      </SectionHeading>
      <Ladder />

      <div ref={railRef} className="relative mt-24 space-y-28 sm:mt-32 sm:space-y-40">
        <div className="absolute bottom-0 left-0 top-2 hidden w-px bg-white/[0.07] lg:block">
          <motion.div
            className="h-full w-full origin-top"
            style={{ scaleY: fill, background: "linear-gradient(180deg, #38e1ff, #fbbf24 50%, #a78bfa)" }}
          />
        </div>
        {STEPS.map((step, i) => (
          <Step key={step.n} step={step} index={i} />
        ))}
      </div>
    </Section>
  );
}
