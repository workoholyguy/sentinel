"use client";

import { motion } from "framer-motion";
import { Clock3, Headphones, Minus, Plus, Wallet, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { downtimeCost, formatMoney, type Period } from "./roi";
import { Eyebrow, Heading, Section } from "./ui";

const PERIODS: Array<{ id: Period; label: string; unit: string }> = [
  { id: "hour", label: "Per hour down", unit: "for every hour offline" },
  { id: "month", label: "Per month", unit: "every month" },
  { id: "year", label: "Per year", unit: "every year" },
];

function Stepper({ label, value, step, min, max, format, onChange }: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  const btn = "grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2">
      <span className="text-[14px] text-neutral-500">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Less ${label}`}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-16 text-center font-mono text-[15px] font-medium tabular text-neutral-900">{format(value)}</span>
        <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`More ${label}`}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Cost() {
  const [people, setPeople] = useState(25);
  const [outageHours, setOutageHours] = useState(3);
  const [hourlyCost, setHourlyCost] = useState(55);
  const [period, setPeriod] = useState<Period>("year");
  const { payroll, hours } = downtimeCost({ people, hourlyCost, outageHours }, period);
  const unit = PERIODS.find((p) => p.id === period)!.unit;

  const cards: Array<{ icon: LucideIcon; label: string; value: string; caption: string; accent?: boolean }> = [
    { icon: Wallet, label: "Idle payroll", value: formatMoney(payroll), caption: unit },
    { icon: Clock3, label: "Work hours lost", value: `${hours.toLocaleString("en-US")} h`, caption: unit },
    { icon: Headphones, label: "Your time on hold", value: "0 min", caption: "UPLink makes the call", accent: true },
  ];

  return (
    <Section id="cost" className="py-24 sm:py-32">
      <Eyebrow className="text-center">The cost of downtime</Eyebrow>
      <div className="mt-5">
        <Heading sub="For offices, clinics, shops and MSPs. Set your team and see what a dead connection burns.">
          Outages cost more
          <br />
          than you think.
        </Heading>
      </div>

      <div className="mt-14 grid gap-2.5 sm:grid-cols-3">
        <Stepper label="People" value={people} step={5} min={5} max={500} format={(n) => `${n}`} onChange={setPeople} />
        <Stepper label="Hours down / mo" value={outageHours} step={1} min={1} max={40} format={(n) => `${n} h`} onChange={setOutageHours} />
        <Stepper label="Cost / hour" value={hourlyCost} step={5} min={15} max={300} format={(n) => `$${n}`} onChange={setHourlyCost} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Eyebrow>What it costs you</Eyebrow>
        <div className="flex rounded-xl border border-neutral-200 bg-neutral-100/70 p-1" role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-3.5 py-2 text-[14px] transition sm:px-4 ${period === p.id ? "bg-white text-neutral-950 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid overflow-hidden rounded-2xl border border-neutral-200 bg-white md:grid-cols-3 md:divide-x md:divide-neutral-200">
        {cards.map(({ icon: Icon, label, value, caption, accent }) => (
          <div key={label} className="border-t border-neutral-200 p-7 first:border-t-0 md:border-t-0">
            <div className={`flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.12em] ${accent ? "text-indigo-600" : "text-neutral-500"}`}>
              <Icon className="h-4 w-4" /> {label}
            </div>
            <motion.div
              key={value}
              initial={{ opacity: 0.4, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-5 font-mono text-[clamp(34px,4vw,46px)] font-semibold leading-none tracking-[-0.03em] tabular ${accent ? "text-indigo-600" : "text-neutral-950"}`}
              data-testid={`cost-${label}`}
            >
              {value}
            </motion.div>
            <div className="mt-3 font-mono text-[13px] text-neutral-400">{caption}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[14px] text-neutral-500">Idle payroll = people × cost per hour × hours offline. Lost sales and missed calls not included.</p>
    </Section>
  );
}
