"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Eyebrow, Section } from "./ui";

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
          <motion.p key="sent" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 py-3 text-[15px] text-emerald-700">
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

export function GetStarted() {
  return (
    <Section id="book" className="pb-28 pt-8 sm:pb-36">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Eyebrow dot>Get started</Eyebrow>
        <h2 className="mt-5 text-[clamp(32px,4.2vw,52px)] font-semibold leading-[1.06] tracking-[-0.04em] text-neutral-950">
          Fixed at any hour.
          <br />
          <span className="text-neutral-400">At every location.</span>
        </h2>
        <p className="mt-4 max-w-[460px] text-[16px] leading-[1.6] text-neutral-500">Put Uplink on every site in minutes. Available on Apple, Windows and the web.</p>
        <div className="mt-7 flex w-full justify-center">
          <DemoForm />
        </div>
        <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 text-[14px] text-neutral-500 transition hover:text-neutral-950">
          Or open the live dashboard <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Section>
  );
}
