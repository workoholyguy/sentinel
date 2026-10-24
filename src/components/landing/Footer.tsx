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
  { start: "sin", end: "syd" },
];

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Why Uplink" },
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

const MIN_MAP_WIDTH = 480; // smaller than this and the labels crowd; scroll instead
const NAV_HEIGHT = 72; // the fixed header sits over the top of the screen

/**
 * The page lifts off this footer as you reach the end, which only works if the footer fits the screen.
 * So the map takes whatever height is left after the text and links, on any viewport. On screens too
 * short for a readable map, the map keeps its full size and the footer simply scrolls.
 */
function useFooterFit(aspect: number) {
  const ref = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapWidth, setMapWidth] = useState<number | null>(null);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const footer = ref.current;
    const mapEl = mapRef.current;
    if (!footer || !mapEl) return;
    const measure = () => {
      const rest = footer.offsetHeight - mapEl.offsetHeight;
      const full = mapEl.parentElement?.clientWidth ?? mapEl.offsetWidth;
      const room = window.innerHeight - NAV_HEIGHT;
      const width = Math.floor(Math.min(full, (room - rest) * aspect));
      const fit = width >= Math.min(MIN_MAP_WIDTH, full * 0.85);
      setMapWidth(fit ? width : null);
      setFits(fit);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(footer);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [aspect]);
  return { ref, mapRef, mapWidth, fits };
}

export function Footer({ map }: { map: MapData }) {
  const { ref, mapRef, mapWidth, fits } = useFooterFit(map.width / map.height);
  const [roomy, setRoomy] = useState(true); // city labels collide on phone-sized maps
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setRoomy(e.contentRect.width >= 420));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapRef]);
  return (
    <footer id="book" ref={ref} className={`${fits ? "sticky bottom-0" : "relative"} z-0 scroll-mt-20 bg-white`}>
      <div className="mx-auto max-w-[1160px] px-5 pb-6 pt-16 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow dot className="justify-center">
            Get started
          </Eyebrow>
          <h2 className="mt-4 text-[clamp(32px,4.2vw,52px)] font-semibold leading-[1.06] tracking-[-0.04em] text-neutral-950">
            Fixed at any hour.
            <br />
            <span className="text-neutral-400">At every location.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[16px] leading-[1.6] text-neutral-500">
            Put Uplink on every site in minutes. Available on Apple, Windows and the web.
          </p>
          <div className="mt-6 flex justify-center">
            <DemoForm />
          </div>
          <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 text-[14px] text-neutral-500 transition hover:text-neutral-950">
            Or open the live dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div ref={mapRef} className="mx-auto mt-6 max-w-full" style={{ width: mapWidth ?? "100%" }}>
          <WorldMap map={map} dots={ARCS} lineColor="#3b82f6" dotColor="#d4d4d4" showLabels={roomy} loop animationDuration={1.8} />
        </div>

        <div className="mt-6 flex flex-col gap-5 border-t border-neutral-200 pt-6 text-[13px] text-neutral-400 md:flex-row md:items-center md:justify-between">
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
