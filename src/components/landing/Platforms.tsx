"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Globe, Laptop, Monitor, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { LogoMark } from "./brand";
import { Section } from "./ui";

const PLATFORMS: Array<{ icon: LucideIcon; name: string; text: string }> = [
  { icon: Laptop, name: "Apple", text: "macOS menu-bar agent" },
  { icon: Monitor, name: "Windows", text: "System-tray agent" },
  { icon: Globe, name: "Web", text: "Dashboard for every site" },
];

export function Platforms() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSent(true);
  };

  return (
    <Section id="demo" className="overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 dot-grid [mask-image:radial-gradient(60%_60%_at_50%_45%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[820px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_90deg,#38e1ff33,#5b8cff33,#a78bfa40,#ff6b9a26,#38e1ff33)] blur-[90px]" />

      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
          className="float-y relative"
        >
          <div className="absolute -inset-6 rounded-[36px] bg-[conic-gradient(from_0deg,#38e1ff,#5b8cff,#a78bfa,#ff6b9a,#38e1ff)] opacity-50 blur-2xl" />
          <LogoMark className="relative h-24 w-24 sm:h-28 sm:w-28" />
        </motion.div>

        <h2 className="mt-12 text-[clamp(40px,6.4vw,84px)] font-semibold leading-[0.98] tracking-[-0.055em] text-white">
          Never sit on hold
          <br />
          <span className="text-fade">again.</span>
        </h2>
        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/55 sm:text-lg">
          Put UPLink on every site in minutes. Your network gets an advocate that never sleeps, never waits on hold, and never
          forgets to ask for the credit.
        </p>

        <form onSubmit={submit} className="mt-10 w-full max-w-md">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-6 py-4 text-[15px] text-ok"
              >
                <Check className="h-4 w-4" /> Thanks! We&apos;ll be in touch at {email}.
              </motion.div>
            ) : (
              <motion.div key="form" exit={{ opacity: 0, y: -8 }} className="glass flex flex-col gap-2 rounded-3xl p-1.5 sm:flex-row sm:rounded-full">
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
                  className="min-w-0 flex-1 rounded-full bg-transparent px-5 py-3 text-[15px] text-white outline-none placeholder:text-white/30"
                />
                <button type="submit" className="glow-btn inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium text-black">
                  Book a demo <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
        <Link href="/dashboard" className="mt-5 text-[14px] text-white/45 underline-offset-4 transition hover:text-white hover:underline">
          or open the live dashboard →
        </Link>

        <div className="mt-20 w-full max-w-3xl">
          <div className="font-mono text-[11px] uppercase tracking-label text-white/40">Available on Apple, Windows and the web</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PLATFORMS.map(({ icon: Icon, name, text }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: i * 0.1 }}
                className="glass flex items-center gap-4 rounded-2xl px-5 py-4 text-left"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <div className="text-[15px] font-medium text-white/90">{name}</div>
                  <div className="text-[13px] text-white/45">{text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
