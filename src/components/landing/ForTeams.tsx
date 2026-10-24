"use client";

import { animate, motion, useInView } from "framer-motion";
import { Briefcase, Network, Stethoscope, Store, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { downtimeCost, formatMoney } from "./roi";
import { Section, SectionHeading } from "./ui";

const INDUSTRIES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Briefcase, title: "Offices", text: "Calls drop, files stall and nobody knows who to call." },
  { icon: Store, title: "Retail & restaurants", text: "Card readers go dark and the line walks out the door." },
  { icon: Stethoscope, title: "Clinics", text: "Check-ins, e-prescriptions and telehealth all stop." },
  { icon: Network, title: "IT teams & MSPs", text: "Every client site, fewer truck rolls, proof on every ticket." },
];

function Tile({ title, text, children, className = "" }: { title: string; text: string; children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border hairline bg-white/[0.02] p-6 transition-colors hover:border-white/[0.12] sm:p-7 ${className}`}
    >
      <div className="min-h-0 flex-1">{children}</div>
      <div className="mt-6">
        <div className="text-[17px] font-medium tracking-[-0.01em] text-white/90">{title}</div>
        <div className="mt-1 text-[14.5px] text-white/45">{text}</div>
      </div>
    </motion.div>
  );
}

const HOP_MS = [
  ["laptop", 1],
  ["wi-fi", 3],
  ["router", 2],
  ["dns", 9],
  ["isp", 11],
  ["internet", 18],
] as const;

function LiveLatency() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const gid = useId();
  const [series, setSeries] = useState(() => Array.from({ length: 48 }, (_, i) => 17 + Math.sin(i / 3) * 2.5));
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setSeries((s) => [...s.slice(1), 15 + Math.random() * 6 + (Math.random() > 0.93 ? 14 : 0)]);
    }, 700);
    return () => clearInterval(id);
  }, [inView]);
  const max = 40;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * 100},${100 - (v / max) * 100}`).join(" ");
  const now = series[series.length - 1];
  return (
    <div ref={ref}>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Round trip · live</div>
          <div className="mt-1 font-mono text-[40px] font-light leading-none tabular text-white">
            {Math.round(now)}
            <span className="ml-1 text-[16px] text-white/35">ms</span>
          </div>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ok">
          <span className="alarm h-1.5 w-1.5 rounded-full bg-ok" /> 6/6 healthy
        </span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-24 w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#38e1ff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#38e1ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${pts} 100,100`} fill={`url(#${gid})`} />
        <polyline points={pts} fill="none" stroke="#38e1ff" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {HOP_MS.map(([hop, ms]) => (
          <div key={hop} className="rounded-xl border border-white/[0.06] px-2.5 py-2">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/35">{hop}</div>
            <div className="font-mono text-[13px] tabular text-white/80">{ms} ms</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditReceipt() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, 4.3, { duration: 1.6, ease: [0.2, 0.7, 0.2, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView]);
  return (
    <div ref={ref} className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] p-5 font-mono text-[12px]">
      <div className="flex justify-between text-white/40">
        <span>Peachtree Fiber</span>
        <span>PF-88213</span>
      </div>
      <div className="my-3 border-t border-dashed border-white/10" />
      {[
        ["Plan", "Business Fiber 500"],
        ["Downtime", "3 h 04 m"],
        ["Daily rate", "$4.30"],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between py-0.5">
          <span className="text-white/40">{k}</span>
          <span className="text-white/75">{v}</span>
        </div>
      ))}
      <div className="my-3 border-t border-dashed border-white/10" />
      <div className="flex items-baseline justify-between">
        <span className="text-white/50">Credit applied</span>
        <span className="text-[28px] font-light tabular text-ok">${value.toFixed(2)}</span>
      </div>
    </div>
  );
}

const LOG = [
  ["09:41:07", "probe", "dns timeout 3/3", "text-bad"],
  ["09:41:08", "diagnose", "DNS_RESOLVER_DOWN", "text-white/75"],
  ["09:41:09", "fix", "dns-flush-cache ✓", "text-ok"],
  ["09:41:11", "fix", "dns-switch-resolver ✓", "text-ok"],
  ["09:41:12", "verify", "6/6 healthy · 18 ms", "text-accent"],
];

function EvidenceLog() {
  return (
    <div className="space-y-2 font-mono text-[11.5px]">
      {LOG.map(([time, kind, text, cls], i) => (
        <motion.div
          key={time + text}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ delay: 0.15 + i * 0.18 }}
          className="grid grid-cols-[60px_60px_1fr] gap-2"
        >
          <span className="tabular text-white/30">{time}</span>
          <span className="text-white/40">{kind}</span>
          <span className={`truncate ${cls}`}>{text}</span>
        </motion.div>
      ))}
    </div>
  );
}

const SITES = [
  { name: "Atlanta HQ", state: "Healthy · 12 ms", color: "#34d399" },
  { name: "Midtown clinic", state: "DNS fixed locally · 2 min ago", color: "#38e1ff" },
  { name: "Decatur store", state: "", color: "" },
  { name: "Warehouse", state: "Healthy · 21 ms", color: "#34d399" },
];

function Sites() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [ticketed, setTicketed] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setTicketed((v) => !v), 3200);
    return () => clearInterval(id);
  }, [inView]);
  return (
    <div ref={ref} className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06]">
      {SITES.map((s) => {
        const live = s.name === "Decatur store";
        const color = live ? (ticketed ? "#34d399" : "#fbbf24") : s.color;
        const state = live ? (ticketed ? "Ticket PF-88213 · credit +$4.30" : "Calling the ISP…") : s.state;
        return (
          <div key={s.name} className="flex items-center gap-3 px-4 py-3">
            <span className="relative grid h-2.5 w-2.5 place-items-center">
              {live && !ticketed && <span className="halo absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 1.5px ${color}` }} />}
              <span className="h-2 w-2 rounded-full transition-colors duration-500" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
            </span>
            <span className="flex-1 text-[14px] text-white/80">{s.name}</span>
            <span className="truncate font-mono text-[11px] text-white/45">{state}</span>
          </div>
        );
      })}
    </div>
  );
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-[14px] text-white/55">{label}</span>
        <span className="font-mono text-[15px] tabular text-white">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[#38e1ff]"
      />
    </label>
  );
}

function RoiCalculator() {
  const [people, setPeople] = useState(25);
  const [hourlyCost, setHourlyCost] = useState(55);
  const [outageHours, setOutageHours] = useState(3);
  const { monthly, yearly } = downtimeCost({ people, hourlyCost, outageHours });
  return (
    <div className="relative mt-5 grid grid-cols-1 overflow-hidden rounded-3xl border hairline bg-white/[0.02] lg:grid-cols-2">
      <div className="space-y-7 p-6 sm:p-9">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-label text-white/40">Downtime calculator</div>
          <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">What does an hour offline cost you?</div>
        </div>
        <Slider label="People who stop working" value={people} min={1} max={250} step={1} format={(n) => `${n}`} onChange={setPeople} />
        <Slider label="Cost per person-hour" value={hourlyCost} min={15} max={200} step={5} format={(n) => `$${n}`} onChange={setHourlyCost} />
        <Slider label="Hours offline a month" value={outageHours} min={0.5} max={12} step={0.5} format={(n) => `${n} h`} onChange={setOutageHours} />
      </div>
      <div className="relative flex flex-col justify-center border-t hairline p-6 sm:p-9 lg:border-l lg:border-t-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_70%_50%,rgb(255_77_109/0.12),transparent_70%)]" />
        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-label text-white/40">Idle time, every year</div>
          <div className="mt-3 text-[clamp(44px,6vw,72px)] font-semibold leading-none tracking-[-0.05em] tabular text-white" data-testid="roi-yearly">
            {formatMoney(yearly)}
          </div>
          <div className="mt-3 text-[15px] text-white/50">
            {formatMoney(monthly)} a month, before lost sales, missed calls and the credits nobody claimed.
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.08] px-4 py-2 text-[14px] text-accent">
            UPLink fixes local faults in seconds and escalates the rest for you.
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForTeams() {
  return (
    <Section id="teams" className="py-24 sm:py-32">
      <SectionHeading eyebrow="For business" color="#5b8cff" title="Built for teams that" dim="can't afford to be offline.">
        One agent per site. It watches, fixes and escalates while your people keep working, and keeps the receipts.
      </SectionHeading>

      <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INDUSTRIES.map(({ icon: Icon, title, text }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border hairline bg-white/[0.015] p-5 transition hover:bg-white/[0.03]"
          >
            <Icon className="h-5 w-5 text-blue" />
            <div className="mt-4 text-[16px] font-medium text-white/90">{title}</div>
            <div className="mt-1 text-[14px] text-white/45">{text}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Tile className="lg:col-span-2" title="Every hop, every second" text="Laptop to internet, measured continuously, so the fault is pinned before anyone notices.">
          <LiveLatency />
        </Tile>
        <Tile title="Credits, claimed" text="Downtime is prorated from your plan and requested on the call. Every time.">
          <CreditReceipt />
        </Tile>
        <Tile title="Evidence-grade logs" text="Timestamped probes, diagnosis and every command run. Your provider can't argue with it.">
          <EvidenceLog />
        </Tile>
        <Tile className="lg:col-span-2" title="Every site, one view" text="Run UPLink at each location and watch them all from one dashboard.">
          <Sites />
        </Tile>
      </div>

      <RoiCalculator />
    </Section>
  );
}
