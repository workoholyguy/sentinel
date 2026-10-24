"use client";

// Feature bento, adapted from the block-feature component: same card grid, grid cell highlight,
// orbit, code editor and moving belt, filled with what Uplink does.
import { animate, useInView, useReducedMotion } from "framer-motion";
import { Sparkle } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { DevinMark, LogoMark } from "../landing/brand";
import { PROVIDERS } from "../landing/Providers";
import { cn } from "./cn";

// ------------------------------ | PRIMITIVES | ------------------------------ //

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        "relative flex min-h-[288px] flex-col overflow-hidden rounded-[20px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {children}
    </article>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <h3 className="px-6 text-center text-[19px] font-medium leading-7 tracking-[-0.01em] text-neutral-900">{children}</h3>;
}

/** Ticks every `ms` while on screen (and never with reduced motion). */
function useTick(ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [inView, reduced, ms]);
  return { ref, n, inView };
}

// ------------------------------ | CARD 1 — EVERY SITE ON ONE GRID | ------------------------------ //

const COLS = 5;
const ROWS = 3;
const CENTRE = 1 * COLS + 2;
const SITES = [1, 3, 5, 6, 8, 9, 11, 13]; // cells with an office in them
const FLAKY = [6, 13, 3];

function SiteGrid() {
  const { ref, n } = useTick(1400);
  const flaky = FLAKY[Math.floor(n / 2) % FLAKY.length];
  const down = n % 2 === 1;
  return (
    <div ref={ref} className="relative flex-1">
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className="grid [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_35%,transparent_88%)]"
          style={{ gridTemplateColumns: `repeat(${COLS}, 72px)`, gridTemplateRows: `repeat(${ROWS}, 72px)` }}
        >
          {Array.from({ length: COLS * ROWS }).map((_, i) => {
            const bad = down && i === flaky;
            return (
              <div key={i} className={cn("flex size-[72px] items-center justify-center border border-black/[0.08]", i === CENTRE && "bg-blue-50")}>
                {i === CENTRE && <LogoMark className="size-8 text-neutral-950" />}
                {SITES.includes(i) && (
                  <span className="relative grid size-3 place-items-center">
                    {bad && <span className="halo absolute inset-0 rounded-full bg-orange-400" />}
                    <span className={cn("size-2 rounded-full transition-colors duration-500", bad ? "bg-orange-500" : "bg-emerald-500")} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ------------------------------ | CARD 2 — WORKS OFFLINE | ------------------------------ //

function Offline() {
  const { ref, n } = useTick(2600);
  const offline = n % 2 === 1;
  return (
    <div ref={ref} className="relative flex flex-1 items-center justify-center px-6 pb-8">
      <div className="flex w-full max-w-[420px] items-center">
        <div className="flex flex-col items-center gap-2">
          <span className={cn("grid size-14 place-items-center rounded-2xl border transition-colors duration-500", offline ? "border-orange-200 bg-orange-50 text-orange-500" : "border-black/[0.07] bg-neutral-50 text-neutral-500")}>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" />
              <circle cx="12" cy="19.5" r="1" fill="currentColor" />
              {offline && <path d="M4 3l16 18" />}
            </svg>
          </span>
          <span className="text-[12px] text-neutral-500">Internet</span>
        </div>

        <div className="relative mx-3 mb-6 h-px flex-1">
          <svg className="absolute inset-0 h-2 w-full -translate-y-1/2 overflow-visible" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="4" x2="100%" y2="4" stroke={offline ? "#fdba74" : "#93c5fd"} strokeWidth="1.5" strokeDasharray={offline ? "4 5" : "2 6"} strokeLinecap="round" className={offline ? undefined : "flow"} />
          </svg>
          {offline && <span className="absolute left-1/2 top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-orange-300 bg-white text-[11px] leading-none text-orange-500">×</span>}
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="relative grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white shadow-[0_12px_24px_-10px_rgb(0_0_0/0.5)]">
            {offline && <span className="halo absolute inset-0 rounded-2xl ring-2 ring-neutral-400" />}
            <LogoMark className="size-6" />
          </span>
          <span className="text-[12px] text-neutral-500">On-device AI</span>
        </div>

        <div className="ml-5 hidden w-[150px] rounded-xl border border-black/[0.07] bg-white p-3 shadow-sm sm:block">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-400">{offline ? "Diagnosed locally" : "Status"}</div>
          <div className={cn("mt-1 text-[13px] font-medium", offline ? "text-orange-600" : "text-emerald-600")}>{offline ? "ISP outage · 0.91" : "Healthy · 18 ms"}</div>
          <div className="mt-0.5 text-[11.5px] text-neutral-400">{offline ? "0 bytes sent" : "6 of 6 hops"}</div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------ | CARD 3 — DEVIN ORBIT | ------------------------------ //

const ORBIT = "M14 61a100 40 0 1 0 200 0a100 40 0 1 0 -200 0";

function DevinOrbit() {
  const reduced = useReducedMotion();
  return (
    <div className="relative flex-1">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-[122px] w-[229px] shrink-0">
          <svg viewBox="0 0 229 122" className="absolute inset-0 h-full w-full overflow-visible" fill="none" aria-hidden="true">
            <path d={ORBIT} stroke="rgb(0 0 0 / 0.16)" strokeDasharray="3 5" />
            {!reduced &&
              [0, 3.2].map((begin) => (
                <circle key={begin} r="3.5" fill="#3b82f6">
                  <animateMotion dur="6.4s" begin={`${begin}s`} repeatCount="indefinite" path={ORBIT} />
                </circle>
              ))}
          </svg>
          <span className="absolute left-1/2 top-[14px] grid size-[72px] -translate-x-1/2 place-items-center rounded-[20px] bg-neutral-950 shadow-[0_16px_32px_rgba(16,24,40,0.25)]">
            <DevinMark className="size-9" color="#fff" />
          </span>
          <Sparkle className="absolute left-[188px] top-[68px] size-[13px] fill-neutral-900 text-neutral-900" />
          <Sparkle className="absolute left-[32px] top-[100px] size-[11px] fill-neutral-900 text-neutral-900" />
        </div>
      </div>
    </div>
  );
}

// ------------------------------ | CARD 4 — CODE EDITOR | ------------------------------ //

function CodeEditor() {
  const kw = "text-violet-600";
  const fn = "text-blue-600";
  const str = "text-emerald-600";
  // dns-flush-cache, one of Uplink's real repair plugins
  const lines: ReactNode[] = [
    <>
      <span className={kw}>export const</span> <span className={fn}>dnsFlushCache</span>: FixPlugin = {"{"}
    </>,
    <>
      {"  "}handles: [<span className={str}>&quot;DNS_RESOLVER_DOWN&quot;</span>],
    </>,
    <>
      {"  "}
      <span className={kw}>async</span> <span className={fn}>run</span>(ctx) {"{"}
    </>,
    <>
      {"    "}
      <span className={kw}>return</span> <span className={fn}>runSteps</span>(ctx, id, [
    </>,
    <>
      {"      "}[<span className={str}>&quot;dscacheutil&quot;</span>, [<span className={str}>&quot;-flushcache&quot;</span>]],
    </>,
  ];

  return (
    <div className="relative flex-1">
      <div aria-hidden="true" className="absolute bottom-2 left-6 right-6 h-40 rounded-3xl bg-blue-200/30 blur-2xl" />
      <div className="absolute -bottom-6 left-[-14px] right-4 overflow-hidden rounded-2xl border border-b-0 border-black/[0.07] bg-white shadow-[0_-8px_30px_rgba(16,24,40,0.06)]">
        <div className="flex items-center justify-between px-4 py-3 pl-6">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-neutral-200" />
              <span className="size-2.5 rounded-full bg-neutral-200" />
              <span className="size-2.5 rounded-full bg-neutral-200" />
            </div>
            <span className="text-xs text-neutral-500">dns-flush-cache.ts</span>
          </div>
          <span className="text-xs text-neutral-400">Repair plugin</span>
        </div>
        <div className="border-t border-black/[0.06]" />
        <pre className="overflow-hidden px-5 py-4 font-mono text-[12.5px] leading-6 text-neutral-800">
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre">
              {line}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ------------------------------ | CARD 5 — PROVIDER BELT | ------------------------------ //

const BELT_PATH = "M-60 182C10 182 55 122 185.5 122C316 122 361 182 431 182";
const BELT_DURATION = 26;
const BELT_RIDERS = PROVIDERS.slice(0, 8); // the marquee's list, so both always match
const TILE = 60;

function ProviderBelt() {
  const step = BELT_DURATION / BELT_RIDERS.length;
  const id = useId();
  return (
    <div className="relative flex-1">
      <svg viewBox="0 0 371 258" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 h-full w-full motion-reduce:hidden">
        <defs>
          <clipPath id={`${id}-tile`} clipPathUnits="userSpaceOnUse">
            <rect x={-TILE / 2} y={-TILE / 2} width={TILE} height={TILE} rx="18" />
          </clipPath>
          <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#101828" floodOpacity="0.16" />
          </filter>
        </defs>
        <path d={BELT_PATH} stroke="rgb(0 0 0 / 0.07)" strokeDasharray="3 6" />
        {BELT_RIDERS.map((p, i) => {
          const pad = p.fill ? 0 : TILE * 0.2;
          return (
            <g key={p.name}>
              <animateMotion dur={`${BELT_DURATION}s`} begin={`${-i * step}s`} repeatCount="indefinite" calcMode="linear" path={BELT_PATH} />
              <rect x={-TILE / 2} y={-TILE / 2} width={TILE} height={TILE} rx="18" fill="#fff" stroke="rgb(0 0 0 / 0.07)" filter={`url(#${id}-shadow)`} />
              <image
                href={`/providers/${p.logo}`}
                x={-TILE / 2 + pad}
                y={-TILE / 2 + pad}
                width={TILE - pad * 2}
                height={TILE - pad * 2}
                preserveAspectRatio={p.fill ? "xMidYMid slice" : "xMidYMid meet"}
                clipPath={`url(#${id}-tile)`}
              />
            </g>
          );
        })}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 hidden flex-wrap content-center items-center justify-center gap-3 px-6 motion-reduce:flex">
        {BELT_RIDERS.slice(0, 6).map((p) => (
          <span key={p.name} className="grid size-[52px] place-items-center overflow-hidden rounded-[16px] border border-black/[0.07] bg-white shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/providers/${p.logo}`} alt="" className={p.fill ? "size-full object-cover" : "size-[60%] object-contain"} />
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------ | CARD 6 — CREDITS | ------------------------------ //

function CreditReceipt() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, 4.3, { duration: 1.6, ease: [0.2, 0.7, 0.2, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView]);
  return (
    <div ref={ref} className="relative flex flex-1 items-center justify-center px-6 pb-6">
      <div className="w-full max-w-[250px] rounded-2xl border border-dashed border-black/[0.12] bg-neutral-50/60 p-5 font-mono text-[12px]">
        <div className="flex justify-between text-neutral-400">
          <span>Peachtree Fiber</span>
          <span>PF-88213</span>
        </div>
        <div className="my-3 border-t border-dashed border-black/10" />
        {[
          ["Outage", "3 h 04 m"],
          ["Plan", "$129 / mo"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5">
            <span className="text-neutral-400">{k}</span>
            <span className="text-neutral-700">{v}</span>
          </div>
        ))}
        <div className="my-3 border-t border-dashed border-black/10" />
        <div className="flex items-baseline justify-between">
          <span className="text-neutral-500">Credit</span>
          <span className="text-[26px] font-medium tabular text-emerald-600">${value.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ------------------------------ | FEATURE | ------------------------------ //

export default function Feature() {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr_1fr]">
        <Card className="pt-8">
          <Title>One agent per site. One view of them all.</Title>
          <SiteGrid />
        </Card>

        <Card className="pt-8">
          <Title>Diagnoses on-device, even with the internet down</Title>
          <Offline />
        </Card>

        <Card className="pb-7">
          <DevinOrbit />
          <Title>Devin writes the fixes it hasn&apos;t seen before</Title>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="min-h-[264px] pt-6">
          <Title>Every fix is plain code. No black box.</Title>
          <CodeEditor />
        </Card>

        <Card className="min-h-[264px] pt-6">
          <Title>Calls any provider</Title>
          <ProviderBelt />
        </Card>

        <Card className="min-h-[264px] pt-6">
          <Title>Downtime credits, claimed for you</Title>
          <CreditReceipt />
        </Card>
      </div>
    </div>
  );
}
