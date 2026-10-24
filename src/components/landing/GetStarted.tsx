"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Eyebrow } from "./ui";

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

/** The demo call-to-action; it sits in the sky of the mountain footer. */
export function GetStartedCta() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 text-center">
      <Eyebrow dot>Get started</Eyebrow>
      <h2 className="mt-4 text-[clamp(30px,4vw,50px)] font-semibold leading-[1.06] tracking-[-0.04em] text-[#14213a]">
        Fixed at any hour.
        <br />
        <span className="text-[#7b8aa3]">At every location.</span>
      </h2>
      <p className="mt-3 max-w-[460px] text-[15.5px] leading-[1.6] text-[#5b6b82]">Put Uplink on every site in minutes. Available on Apple, Windows and the web.</p>
      <div className="mt-6 flex w-full justify-center">
        <DemoForm />
      </div>
      <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 text-[14px] text-[#5b6b82] transition hover:text-[#14213a]">
        Or open the live dashboard <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
