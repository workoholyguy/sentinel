"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "./brand";

export const NAV_LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#how", label: "How it works" },
  { href: "#offline", label: "On-device" },
  { href: "#teams", label: "For teams" },
] as const;

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <div
        className={`mx-auto flex max-w-[1240px] items-center justify-between rounded-full py-2.5 pl-4 pr-2.5 transition-all duration-500 lg:pl-5 ${
          scrolled ? "glass" : "border border-transparent"
        }`}
      >
        <a href="#top" aria-label="UPLink home" className="shrink-0">
          <Wordmark />
        </a>

        <nav className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.02] p-1 md:flex" aria-label="Sections">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-1.5 text-[14px] text-white/60 transition hover:bg-white/[0.06] hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="hidden items-center gap-1 rounded-full px-3 py-2 text-[14px] text-white/60 transition hover:text-white sm:inline-flex"
          >
            Live dashboard <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <a href="#demo" className="glow-btn rounded-full px-4 py-2 text-[14px] font-medium text-black">
            Book a demo
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass mt-2 flex flex-col rounded-3xl p-2 md:hidden"
            aria-label="Sections"
          >
            {[...NAV_LINKS, { href: "/dashboard", label: "Live dashboard" }].map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-[15px] text-white/75 hover:bg-white/[0.05]">
                {l.label}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
