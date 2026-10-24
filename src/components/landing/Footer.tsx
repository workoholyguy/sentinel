"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { type MapData, WorldMap } from "../ui/map";
import { DevinMark, LogoMark } from "./brand";
import { Eyebrow } from "./ui";

const ARCS = [
  { start: "sf", end: "ny" },
  { start: "ny", end: "lon" },
  { start: "ny", end: "sao" },
  { start: "lon", end: "sin" },
  { start: "sin", end: "tok" },
];

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#cost", label: "Downtime cost" },
  { href: "/dashboard", label: "Live dashboard" },
];

function DemoForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSent(true);
  };
  return (
    <form onSubmit={submit} className="w-full max-w-[420px]">
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.p key="sent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 py-3 text-[15px] text-emerald-700">
            <Check className="h-4 w-4" /> Thanks, we&apos;ll be in touch.
          </motion.p>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }} className="flex gap-2 rounded-full border border-neutral-200 bg-white p-1.5">
            <label htmlFor="demo-email" className="sr-only">
              Work email
            </label>
            <input
              id="demo-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
              className="min-w-0 flex-1 bg-transparent pl-4 text-[14.5px] text-neutral-900 outline-none placeholder:text-neutral-400"
            />
            <button type="submit" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-neutral-800">
              Book a demo <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

/**
 * The page lifts off this footer as you reach the end. That only works when the footer fits the
 * screen, so on short viewports (or tall footers, e.g. phones) it falls back to a normal footer.
 */
function useFitsViewport() {
  const ref = useRef<HTMLElement>(null);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setFits(el.offsetHeight <= window.innerHeight);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);
  return { ref, fits };
}

export function Footer({ map }: { map: MapData }) {
  const { ref, fits } = useFitsViewport();
  return (
    <footer id="book" ref={ref} className={`${fits ? "sticky bottom-0" : "relative"} z-0 scroll-mt-20 bg-white`}>
      <div className="mx-auto max-w-[1160px] px-5 pb-8 pt-20 sm:px-8 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow dot>Get started</Eyebrow>
            <h2 className="mt-5 text-[clamp(34px,4vw,50px)] font-semibold leading-[1.06] tracking-[-0.04em] text-neutral-950">
              Fixed at any hour.
              <br />
              <span className="text-neutral-400">At every location.</span>
            </h2>
            <p className="mt-5 max-w-[400px] text-[16.5px] leading-[1.65] text-neutral-500">
              Put Uplink on every site in minutes. Available on Apple, Windows and the web.
            </p>
            <div className="mt-8">
              <DemoForm />
            </div>
            <Link href="/dashboard" className="mt-4 inline-flex items-center gap-1 text-[14px] text-neutral-500 transition hover:text-neutral-950">
              Or open the live dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <WorldMap map={map} dots={ARCS} lineColor="#3b82f6" dotColor="#d4d4d4" showLabels animationDuration={1.6} />
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-neutral-200 pt-6 text-[13px] text-neutral-400 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-neutral-900">
            <LogoMark className="h-5 w-5" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Uplink</span>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-2" aria-label="Footer">
            {LINKS.map((l) =>
              l.href.startsWith("/") ? (
                <Link key={l.href} href={l.href} className="transition hover:text-neutral-900">
                  {l.label}
                </Link>
              ) : (
                <a key={l.href} href={l.href} className="transition hover:text-neutral-900">
                  {l.label}
                </a>
              ),
            )}
          </nav>
          <span className="flex flex-wrap items-center gap-x-1.5">
            © 2026 Uplink · Repairs powered by <DevinMark className="h-3.5 w-3.5 text-neutral-500" /> Devin
          </span>
        </div>
      </div>
    </footer>
  );
}
