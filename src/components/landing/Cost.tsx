"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { downtimeCost, formatMoney, type Period } from "./roi";
import { Card, Eyebrow, Section } from "./ui";

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
  const btn = "grid h-8 w-8 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3 rounded-full border border-neutral-200 bg-white py-1.5 pl-5 pr-1.5">
      <span className="text-[14px] text-neutral-500">{label}</span>
      <div className="flex items-center">
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Less ${label}`}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-14 text-center font-mono text-[14px] font-medium tabular text-neutral-900">{format(value)}</span>
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

  const cards = [
    { label: "Idle payroll", value: formatMoney(payroll), caption: unit, accent: false },
    { label: "Work hours lost", value: `${hours.toLocaleString("en-US")} h`, caption: unit, accent: false },
    { label: "Your time on hold", value: "0 min", caption: "Uplink makes the call", accent: true },
  ];

  return (
    <Section id="cost" className="py-28 sm:py-36">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
        <div>
          <Eyebrow dot>Downtime cost</Eyebrow>
          <h2 className="mt-5 text-[clamp(32px,3.6vw,44px)] font-semibold leading-[1.1] tracking-[-0.035em] text-neutral-950">
            Outages cost more
            <br />
            <span className="text-neutral-400">than you think.</span>
          </h2>
        </div>
        <p className="max-w-[440px] text-[16.5px] leading-[1.65] text-neutral-500 lg:justify-self-end">
          For offices, clinics, shops and IT teams. Set your team and see what a dead connection really burns.
        </p>
      </div>

      <div className="mt-12 grid gap-2.5 sm:grid-cols-3">
        <Stepper label="People" value={people} step={5} min={5} max={500} format={(n) => `${n}`} onChange={setPeople} />
        <Stepper label="Hours down / mo" value={outageHours} step={1} min={1} max={40} format={(n) => `${n} h`} onChange={setOutageHours} />
        <Stepper label="Cost / hour" value={hourlyCost} step={5} min={15} max={300} format={(n) => `$${n}`} onChange={setHourlyCost} />
      </div>

      <div className="mt-8 flex justify-end">
        <div className="flex rounded-full border border-neutral-200 bg-neutral-100/70 p-1" role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-[13.5px] transition sm:px-4 ${period === p.id ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="mt-4 grid overflow-hidden md:grid-cols-3 md:divide-x md:divide-neutral-100">
        {cards.map(({ label, value, caption, accent }) => (
          <div key={label} className="border-t border-neutral-100 p-7 first:border-t-0 md:border-t-0">
            <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">{label}</div>
            <motion.div
              key={value}
              initial={{ opacity: 0.4, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 text-[clamp(32px,3.6vw,42px)] font-semibold leading-none tracking-[-0.035em] tabular ${accent ? "text-blue-600" : "text-neutral-950"}`}
              data-testid={`cost-${label}`}
            >
              {value}
            </motion.div>
            <div className="mt-3 text-[13px] text-neutral-400">{caption}</div>
          </div>
        ))}
      </Card>
      <p className="mt-4 text-[13px] text-neutral-400">Idle payroll = people × cost per hour × hours offline. Lost sales and missed calls not included.</p>
    </Section>
  );
}
