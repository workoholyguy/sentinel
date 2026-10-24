"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Eyebrow, Section } from "./ui";
import { CallCard } from "./visuals/CallCard";
import { DevinCard } from "./visuals/DevinCard";
import { DiagnoseCard } from "./visuals/DiagnoseCard";
import { FixCard } from "./visuals/FixCard";
import { StatusCard } from "./visuals/StatusCard";

// One line each: the cards' animations do the explaining.
const STEPS: Array<{ n: string; label: string; title: string; text: string; visual: ReactNode; tilt: string }> = [
  { n: "01", label: "Monitor", title: "Always watching.", text: "Every connection, every site, every second.", visual: <StatusCard />, tilt: "md:-rotate-[1.2deg]" },
  { n: "02", label: "Diagnose", title: "Finds who's at fault.", text: "Your network, your ISP, or further upstream.", visual: <DiagnoseCard />, tilt: "md:rotate-[1.4deg]" },
  { n: "03", label: "Resolve", title: "Fixes it on its own.", text: "Runs the repair on-device, even offline.", visual: <FixCard />, tilt: "md:rotate-[0.8deg]" },
  { n: "04", label: "Escalate", title: "Calls your ISP.", text: "Ticket, technician and credit. No hold music.", visual: <CallCard />, tilt: "md:-rotate-[1deg]" },
  { n: "05", label: "Learn", title: "New fault? Devin writes the fix.", text: "Tested, shipped, and fixed locally next time.", visual: <DevinCard />, tilt: "md:-rotate-[0.5deg]" },
];

function StepCard({ step, wide = false, className = "" }: { step: (typeof STEPS)[number]; wide?: boolean; className?: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
      className={`group relative rounded-[28px] border border-neutral-200/80 bg-white p-4 shadow-[0_30px_70px_-40px_rgb(0_0_0/0.3)] transition-[rotate,translate,box-shadow] duration-500 hover:shadow-[0_40px_80px_-40px_rgb(0_0_0/0.35)] sm:p-5 md:hover:-translate-y-1 md:hover:rotate-0 ${step.tilt} ${className}`}
    >
      <div className={wide ? "grid items-center gap-6 md:grid-cols-[0.8fr_1.2fr]" : ""}>
        <header className="relative px-2 pt-1">
          <span aria-hidden="true" className="pointer-events-none absolute -top-1 right-1 select-none text-[64px] font-semibold leading-none tracking-[-0.06em] text-neutral-100 sm:text-[80px]">
            {step.n}
          </span>
          <div className="relative text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            <span className="mr-2 font-mono text-neutral-900">{step.n}</span>
            {step.label}
          </div>
          <h3 className="relative mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em] text-neutral-950 sm:text-[25px]">{step.title}</h3>
          <p className="relative mt-1 text-[15px] text-neutral-500">{step.text}</p>
        </header>
        <div className={`rounded-[20px] bg-neutral-50 p-2.5 sm:p-4 ${wide ? "" : "mt-4"}`}>{step.visual}</div>
      </div>
    </motion.article>
  );
}

export function Steps() {
  const rest = STEPS.slice(0, 4);
  const devin = STEPS[4]; // the finale spans both columns
  return (
    <Section id="how" className="py-16 sm:py-24">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
        <div>
          <Eyebrow dot>How it works</Eyebrow>
          <h2 className="mt-5 text-[clamp(32px,3.6vw,44px)] font-semibold leading-[1.1] tracking-[-0.035em] text-neutral-950">
            Five steps.
            <br />
            <span className="text-neutral-400">None of them yours.</span>
          </h2>
        </div>
        <p className="max-w-[420px] text-[16.5px] leading-[1.65] text-neutral-500 lg:justify-self-end">From the first dropped packet to a fix that ships itself.</p>
      </div>

      {/* two by two, staggered and a little off-kilter; the cards straighten when you point at them */}
      <div className="mt-12 grid grid-cols-1 items-start gap-5 md:grid-cols-2 md:gap-x-7 md:gap-y-8">
        {rest.map((step, i) => (
          <StepCard key={step.n} step={step} className={i % 2 === 1 ? "md:mt-20" : ""} />
        ))}
        <StepCard step={devin} wide className="md:col-span-2 md:mx-auto md:mt-4 md:w-[88%]" />
      </div>
    </Section>
  );
}
