"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { DevinMark } from "./brand";

// Concentric rings = hops outward from your desk: local network, then DNS, then the provider, then the internet.
const RINGS = [
  { r: 300, text: "YOUR LAPTOP · WI-FI −54 dBm · ROUTER 2 ms · LAN HEALTHY", spin: 160, reverse: false, dashed: false, tone: "rgb(56 225 255 / 0.55)" },
  { r: 470, text: "DNS 1.1.1.1 · DHCP LEASE OK · GATEWAY 192.168.1.1 · IPv6", spin: 220, reverse: true, dashed: true, tone: "rgb(255 255 255 / 0.32)" },
  { r: 650, text: "COMCAST · AT&T · VERIZON · SPECTRUM · COX · FRONTIER · ANY ISP", spin: 280, reverse: false, dashed: false, tone: "rgb(251 191 36 / 0.5)" },
  { r: 850, text: "THE INTERNET · 18 ms · 0% LOSS · 1 GBPS", spin: 360, reverse: true, dashed: true, tone: "rgb(255 255 255 / 0.22)" },
];
const CX = 800;
const CY = 1000;
const CHAR_W = 12.4; // monospace advance at 14px with the letter-spacing below

const circlePath = (r: number) => `M ${CX - r} ${CY} a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 ${-2 * r} 0`;

function Orbits() {
  const reduced = useReducedMotion();
  return (
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="orbit-fade" cx="50%" cy="100%" r="90%">
          <stop offset="0.35" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="orbit-mask">
          <rect width="1600" height="1000" fill="url(#orbit-fade)" />
        </mask>
      </defs>
      <g mask="url(#orbit-mask)">
        {RINGS.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const unit = `${ring.text} · `;
          const reps = Math.max(1, Math.round(circ / (unit.length * CHAR_W)));
          return (
            <g
              key={ring.r}
              className={reduced ? undefined : "spin-slow"}
              style={{
                transformOrigin: `${CX}px ${CY}px`,
                transformBox: "view-box",
                ["--spin" as string]: `${ring.spin}s`,
                animationDirection: ring.reverse ? "reverse" : "normal",
              }}
            >
              <path id={`ring-${i}`} d={circlePath(ring.r)} fill="none" stroke="rgb(255 255 255 / 0.13)" strokeDasharray={ring.dashed ? "3 7" : undefined} />
              <text
                fontFamily="var(--font-geist-mono), monospace"
                fontSize="14"
                letterSpacing="3.4"
                fill={ring.tone}
                stroke="#04060a"
                strokeWidth="10"
                paintOrder="stroke"
              >
                <textPath href={`#ring-${i}`} textLength={circ - 4} lengthAdjust="spacing">
                  {unit.repeat(reps)}
                </textPath>
              </text>
              {!reduced && (
                <circle r="3.5" fill={i === 2 ? "#fbbf24" : "#38e1ff"} style={{ filter: `drop-shadow(0 0 6px ${i === 2 ? "#fbbf24" : "#38e1ff"})` }}>
                  <animateMotion dur={`${14 + i * 5}s`} repeatCount="indefinite" path={circlePath(ring.r)} />
                </circle>
              )}
            </g>
          );
        })}
        {!reduced &&
          [0, 1.8, 3.6].map((delay) => (
            <circle key={delay} cx={CX} cy={CY} r="40" fill="none" stroke="#38e1ff" strokeWidth="1.2">
              <animate attributeName="r" from="60" to="980" dur="5.4s" begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" from="0.45" to="0" dur="5.4s" begin={`${delay}s`} repeatCount="indefinite" />
            </circle>
          ))}
      </g>
    </svg>
  );
}

const PILLS = [
  { tag: "DNS", fault: "Resolver down", time: "4.2 s", how: "Local fix", label: "Status", outcome: "Fixed", color: "#38e1ff" },
  { tag: "ISP", fault: "38% packet loss", time: "6 min", how: "Phone call", label: "Credit", outcome: "+$4.30", color: "#fbbf24" },
  { tag: "IPv6", fault: "Blackhole", time: "11 min", how: "Devin", label: "Plugin", outcome: "Shipped", color: "#a78bfa" },
];

function IncidentPills() {
  return (
    <div className="scroll-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:justify-center sm:px-0">
      {PILLS.map((p, i) => (
        <motion.div
          key={p.tag}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 + i * 0.12, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="glass grid min-w-[272px] snap-center grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl px-5 py-3.5"
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{p.tag}</div>
            <div className="mt-0.5 truncate text-[14px] text-white/90">{p.fault}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="font-mono text-[13px] tabular" style={{ color: p.color }}>
              {p.time}
            </div>
            <div className="relative my-1 h-px w-14 bg-white/15">
              <span className="packet h-1 w-1 rounded-full" style={{ background: p.color, boxShadow: `0 0 8px ${p.color}`, ["--dur" as string]: `${2 + i * 0.4}s` }} />
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">{p.how}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">{p.label}</div>
            <div className="mt-0.5 text-[14px] text-white/90">{p.outcome}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { delay, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] as const },
});

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <div className="absolute inset-0">
        <Orbits />
        <div
          className="breathe pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
          style={{
            background:
              "radial-gradient(38% 60% at 50% 100%, rgb(56 225 255 / 0.30), transparent 70%), radial-gradient(30% 50% at 26% 100%, rgb(52 211 153 / 0.20), transparent 70%), radial-gradient(32% 55% at 76% 100%, rgb(167 139 250 / 0.26), transparent 70%)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-ink-950 to-transparent" />
        {/* darken behind the copy so the ring labels never fight the headline */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(42%_34%_at_50%_42%,rgb(4_6_10/0.92),rgb(4_6_10/0.55)_55%,transparent_80%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1240px] flex-1 flex-col items-center px-4 pb-8 pt-32 text-center sm:px-8 sm:pt-40">
        <motion.a
          {...rise(0.05)}
          href="#how"
          className="glass group inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-[13px] text-white/70 transition hover:text-white"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-violet/15">
            <DevinMark className="h-3.5 w-3.5" color="#c4b5fd" />
          </span>
          <span className="sm:hidden">New: Devin-powered repairs</span>
          <span className="hidden sm:inline">New: Devin writes the fixes it doesn&apos;t know yet</span>
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </motion.a>

        <motion.h1
          {...rise(0.15)}
          className="mt-8 text-[clamp(46px,8.4vw,116px)] font-semibold leading-[0.95] tracking-[-0.055em] text-white"
        >
          The internet breaks.
          <br />
          <span className="text-aurora">UPLink fixes it.</span>
        </motion.h1>

        <motion.p {...rise(0.3)} className="mt-7 max-w-[620px] text-[17px] leading-relaxed text-white/60 sm:text-[19px]">
          An AI agent for your office network. It diagnoses outages on-device, fixes what it can, and calls your provider
          with proof when it can&apos;t.
        </motion.p>

        <motion.div {...rise(0.45)} className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a href="#demo" className="glow-btn inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium text-black">
            Book a demo <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#how"
            className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/30 px-6 py-3.5 text-[15px] text-white/85 backdrop-blur transition hover:border-white/30 hover:text-white"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Watch it work
          </a>
        </motion.div>

        <motion.p {...rise(0.6)} className="mt-6 font-mono text-[11px] uppercase tracking-label text-white/35">
          Available on Apple · Windows · Web
        </motion.p>

        <div className="mt-auto w-full pt-16">
          <IncidentPills />
        </div>
      </div>
    </section>
  );
}
