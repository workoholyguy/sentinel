"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Bullets, Section, StepLabel } from "./ui";
import { CallCard } from "./visuals/CallCard";
import { DevinCard } from "./visuals/DevinCard";
import { DiagnoseCard } from "./visuals/DiagnoseCard";
import { FixCard } from "./visuals/FixCard";
import { StatusCard } from "./visuals/StatusCard";

const STEPS: Array<{ n: string; label: string; title: [string, string]; text: string; bullets: string[]; visual: ReactNode }> = [
  {
    n: "01",
    label: "Monitor",
    title: ["Always watching", "your network."],
    text: "Uplink checks your connection every second, across every location, service and critical system.",
    bullets: ["Real-time monitoring", "Multi-location support", "Detects issues before your team notices"],
    visual: <StatusCard />,
  },
  {
    n: "02",
    label: "Diagnose",
    title: ["Finds the problem.", "And who's responsible."],
    text: "When something breaks, Uplink isolates the fault and works out whether it's your network, your ISP, or further upstream.",
    bullets: ["Automatic root cause analysis", "Identifies the responsible party", "No manual troubleshooting"],
    visual: <DiagnoseCard />,
  },
  {
    n: "03",
    label: "Resolve",
    title: ["Fixes what it can.", "On its own."],
    text: "If the fault is local, Uplink runs the fix on the spot, with an AI model on your own machine that works even when the internet doesn't.",
    bullets: ["DNS, DHCP, Wi-Fi and router fixes", "Runs on-device, even offline", "Every command logged"],
    visual: <FixCard />,
  },
  {
    n: "04",
    label: "Escalate",
    title: ["Calls your ISP.", "So you don't have to."],
    text: "When it's the provider's fault, Uplink phones support with the evidence, gets a ticket opened, and asks for your downtime credit.",
    bullets: ["Skips the “have you restarted?” script", "Gets a ticket and a technician window", "Claims downtime credits"],
    visual: <CallCard />,
  },
  {
    n: "05",
    label: "Learn",
    title: ["New fault?", "Devin writes the fix."],
    text: "If Uplink has never seen a fault and your ISP says it isn't them, Devin writes, tests and ships a new repair. Next time, it's fixed locally.",
    bullets: ["New repair plugin, with tests", "Shipped as a pull request", "Every fault makes Uplink smarter"],
    visual: <DevinCard />,
  },
];

const enter = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const },
};

export function Steps() {
  return (
    <Section id="how" className="py-12 sm:py-20">
      <div className="space-y-28 sm:space-y-40">
        {STEPS.map((s, i) => {
          const flip = i % 2 === 1;
          return (
            <div key={s.n} className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
              <motion.div {...enter} className={flip ? "lg:order-2" : ""}>
                <StepLabel n={s.n}>{s.label}</StepLabel>
                <h2 className="mt-5 text-[clamp(32px,3.6vw,44px)] font-semibold leading-[1.1] tracking-[-0.035em] text-neutral-950">
                  {s.title[0]}
                  <br />
                  {s.title[1]}
                </h2>
                <p className="mt-5 max-w-[420px] text-[16.5px] leading-[1.65] text-neutral-500">{s.text}</p>
                <div className="mt-8">
                  <Bullets items={s.bullets} />
                </div>
              </motion.div>
              <motion.div {...enter} transition={{ ...enter.transition, delay: 0.1 }} className={flip ? "lg:order-1" : ""}>
                {s.visual}
              </motion.div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
