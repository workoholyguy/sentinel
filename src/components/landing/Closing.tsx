"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Globe, Laptop, Monitor, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { DevinMark, LogoMark } from "./brand";
import { CloudBuddy } from "./CloudBuddy";
import { Sky } from "./Sky";
import { WordmarkCanvas } from "./WordmarkCanvas";

const PLATFORMS: Array<{ icon: LucideIcon; name: string }> = [
  { icon: Laptop, name: "Apple" },
  { icon: Monitor, name: "Windows" },
  { icon: Globe, name: "Web" },
];

const LINKS = [
  { href: "#demo", label: "How it works" },
  { href: "#why", label: "Why UPLink" },
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
    <form onSubmit={submit} className="w-full max-w-md">
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-6 py-4 text-[15px] text-white ring-1 ring-white/25 backdrop-blur"
          >
            <Check className="h-4 w-4" /> Thanks! We&apos;ll be in touch.
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-2 rounded-2xl bg-white/12 p-1.5 ring-1 ring-white/25 backdrop-blur sm:flex-row">
            <label htmlFor="demo-email" className="sr-only">
              Work email
            </label>
            <input
              id="demo-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/50"
            />
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-medium text-neutral-950 transition hover:bg-indigo-50">
              Book a demo <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function LiveStatus() {
  const [ms, setMs] = useState(18);
  useEffect(() => {
    const id = setInterval(() => setMs(15 + Math.round(Math.random() * 6)), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[12px] text-white/60">
      <span className="relative grid h-2 w-2 place-items-center">
        <span className="halo absolute inset-0 rounded-full bg-emerald-300/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
      </span>
      All systems normal · <span className="tabular text-white/85">{ms} ms</span>
    </span>
  );
}

export function Closing() {
  return (
    <section id="get-started" className="relative scroll-mt-0 overflow-hidden pt-52 sm:pt-60">
      <Sky variant="bottom" />

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-5 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <div className="bob" style={{ ["--bob" as string]: "6s" }}>
            <CloudBuddy mood="happy" className="w-32 sm:w-40" />
          </div>
        </motion.div>
        <h2 className="mt-4 text-[clamp(42px,7vw,92px)] font-semibold leading-[0.98] tracking-[-0.055em] text-white">
          Never sit on hold
          <br />
          again.
        </h2>
        <p className="mt-5 text-[17px] text-white/80 sm:text-[19px]">Put UPLink on every site in minutes.</p>
        <div className="mt-9 flex w-full justify-center">
          <DemoForm />
        </div>
        <Link href="/dashboard" className="mt-4 text-[14px] text-white/70 underline-offset-4 transition hover:text-white hover:underline">
          or open the live dashboard →
        </Link>

        <div className="mt-14 flex flex-col items-center gap-3">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-white/60">Available on</span>
          <div className="flex flex-wrap justify-center gap-2">
            {PLATFORMS.map(({ icon: Icon, name }) => (
              <span key={name} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-[15px] font-medium text-white ring-1 ring-white/20 backdrop-blur">
                <Icon className="h-4 w-4" /> {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <footer className="relative mt-28">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 border-t border-white/10 px-5 pt-8 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-[17px] font-semibold tracking-[-0.03em] text-white">UPLink</span>
            <span className="ml-3 hidden sm:inline">
              <LiveStatus />
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-2" aria-label="Footer">
            {LINKS.map((l) =>
              l.href.startsWith("/") ? (
                <Link key={l.href} href={l.href} className="text-[14px] text-white/65 transition hover:text-white">
                  {l.label}
                </Link>
              ) : (
                <a key={l.href} href={l.href} className="text-[14px] text-white/65 transition hover:text-white">
                  {l.label}
                </a>
              ),
            )}
          </nav>
        </div>

        <div className="relative mx-auto mt-10 max-w-[1400px] px-2 sm:px-6">
          <WordmarkCanvas />
        </div>

        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-2 px-5 pb-8 pt-4 text-[13px] text-white/45 sm:flex-row sm:px-10 lg:px-16">
          <span>© 2026 UPLink. Built at the Devin Hackathon, Atlanta.</span>
          <span className="inline-flex items-center gap-1.5">
            Repairs powered by <DevinMark className="h-3.5 w-3.5" color="#fff" /> Devin
          </span>
        </div>
      </footer>
    </section>
  );
}
