"use client";

import { motion, type MotionValue, useScroll, useTransform } from "framer-motion";
import { Clock3, RotateCcw, ThumbsDown, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import { Eyebrow, Section } from "./ui";

type Token = string | { icon: LucideIcon; tone: string };

// The outage runaround, word by word, with a little icon where it hurts.
const TOKENS: Token[] = [
  ..."The Wi-Fi drops. Someone restarts the router.".split(" "),
  { icon: RotateCcw, tone: "bg-sky-100 text-sky-600" },
  ..."Someone sits on hold for 47 minutes.".split(" "),
  { icon: Clock3, tone: "bg-amber-100 text-amber-600" },
  ..."Then the provider says it's on your end.".split(" "),
  { icon: ThumbsDown, tone: "bg-rose-100 text-rose-600" },
];

function Word({ token, i, progress }: { token: Token; i: number; progress: MotionValue<number> }) {
  const start = i / TOKENS.length;
  const opacity = useTransform(progress, [start, start + 1 / TOKENS.length], [0.14, 1]);
  if (typeof token === "string") {
    return (
      <motion.span style={{ opacity }} className="mr-[0.25em] inline-block">
        {token}
      </motion.span>
    );
  }
  const Icon = token.icon;
  return (
    <motion.span style={{ opacity }} className={`mr-[0.25em] inline-grid h-[1.05em] w-[1.6em] translate-y-[0.12em] place-items-center rounded-full align-baseline ${token.tone}`}>
      <Icon className="h-[0.55em] w-[0.55em]" strokeWidth={2.5} />
    </motion.span>
  );
}

export function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });

  return (
    <Section className="py-28 sm:py-36">
      <Eyebrow className="text-center">The problem</Eyebrow>
      <p ref={ref} className="mx-auto mt-8 max-w-4xl text-center text-[clamp(30px,4.4vw,54px)] font-semibold leading-[1.12] tracking-[-0.04em] text-neutral-950">
        {TOKENS.map((token, i) => (
          <Word key={i} token={token} i={i} progress={scrollYProgress} />
        ))}
      </p>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 1 }}
        transition={{ duration: 0.6 }}
        className="mt-8 text-center text-[clamp(30px,4.4vw,54px)] font-semibold tracking-[-0.04em]"
      >
        <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">UPLink does all of it for you.</span>
      </motion.p>
    </Section>
  );
}
