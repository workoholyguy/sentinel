"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "./brand";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Why Uplink" },
  { href: "#cost", label: "Downtime cost" },
  { href: "/dashboard", label: "Live dashboard" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 24));

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${solid || open ? "border-b border-neutral-200/70 bg-[#fafafa]/85 backdrop-blur-xl" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-[72px] max-w-[1160px] items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5 text-neutral-950" aria-label="Uplink home">
          <LogoMark className="h-6 w-6" />
          <span className="text-[18px] font-semibold tracking-[-0.02em]">Uplink</span>
        </a>

        <nav className="hidden items-center gap-10 md:flex" aria-label="Sections">
          {LINKS.map((l) =>
            l.href.startsWith("/") ? (
              <Link key={l.href} href={l.href} className="text-[14px] text-neutral-500 transition-colors hover:text-neutral-950">
                {l.label}
              </Link>
            ) : (
              <a key={l.href} href={l.href} className="text-[14px] text-neutral-500 transition-colors hover:text-neutral-950">
                {l.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-1">
          <a href="#book" className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-neutral-800">
            Book a demo <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-full text-neutral-700 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden md:hidden" aria-label="Sections">
            <div className="flex flex-col px-3 pb-3">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-[15px] text-neutral-700 hover:bg-neutral-100">
                  {l.label}
                </a>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
