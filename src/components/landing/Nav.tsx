"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "./brand";

const LINKS = [
  { href: "#demo", label: "How it works" },
  { href: "#why", label: "Why UPLink" },
  { href: "#cost", label: "Downtime cost" },
  { href: "/dashboard", label: "Live dashboard" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 40));
  const bar = solid || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        bar ? "border-b border-neutral-200/80 bg-white/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-10 lg:px-16">
        <a href="#top" className="flex items-center gap-2.5" aria-label="UPLink home">
          <LogoMark className="h-8 w-8" />
          <span className="text-[19px] font-semibold tracking-[-0.03em] text-neutral-950">UPLink</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Sections">
          {LINKS.map((l) =>
            l.href.startsWith("/") ? (
              <Link key={l.href} href={l.href} className="text-[15px] text-neutral-500 transition-colors hover:text-neutral-950">
                {l.label}
              </Link>
            ) : (
              <a key={l.href} href={l.href} className="text-[15px] text-neutral-500 transition-colors hover:text-neutral-950">
                {l.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#get-started"
            className="rounded-xl bg-neutral-950 px-4 py-2.5 text-[14.5px] font-medium text-white transition hover:bg-neutral-800"
          >
            Book a demo
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-xl text-neutral-700 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-neutral-200 bg-white md:hidden"
            aria-label="Sections"
          >
            <div className="flex flex-col px-3 py-2">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-[15px] text-neutral-700 hover:bg-neutral-50">
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
