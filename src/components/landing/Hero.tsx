"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { DevinMark } from "./brand";
import { LinkField, LinkStrip, useLinkCycle } from "./LinkField";
import { ProductDemo } from "./ProductDemo";
import { Button } from "./ui";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { delay, duration: 0.8, ease: [0.2, 0.7, 0.2, 1] as const },
});

export function Hero() {
  const cycle = useLinkCycle(); // one clock for the desktop field and the mobile strip
  return (
    <section id="top" className="relative overflow-hidden pb-20 sm:pb-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(rgb(0_0_0/0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(70%_55%_at_50%_30%,black,transparent)]" />
        <div className="absolute left-1/2 top-[-12%] h-[640px] w-[1100px] max-w-[160vw] -translate-x-1/2 rounded-full bg-[conic-gradient(from_200deg_at_50%_50%,#c7d2fe,#ddd6fe,#bae6fd,#fbcfe8,#c7d2fe)] opacity-55 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="relative xl:h-[730px]">
          <LinkField {...cycle} className="absolute inset-0 hidden xl:block" />

          <div className="relative z-10 flex flex-col items-center pt-32 text-center sm:pt-40">
            <motion.a
              {...rise(0.05)}
              href="#demo"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 py-1.5 pl-1.5 pr-4 text-[14px] text-neutral-600 shadow-sm backdrop-blur transition hover:border-neutral-300"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-600">
                <DevinMark className="h-3.5 w-3.5" color="#fff" />
              </span>
              Repairs powered by <span className="font-semibold text-neutral-900">Devin</span>
            </motion.a>

            <motion.h1 {...rise(0.15)} className="mt-7 text-[clamp(46px,7.6vw,104px)] font-semibold leading-[0.96] tracking-[-0.055em] text-neutral-950">
              Internet down?
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">Already handled.</span>
            </motion.h1>

            <motion.p {...rise(0.28)} className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-neutral-500 sm:text-[19px]">
              UPLink fixes your office network on its own, and calls your ISP when it can&apos;t.
            </motion.p>

            <motion.div {...rise(0.4)} className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
              <Button href="#get-started" tone="dark" className="px-6 py-3.5 text-[16px]">
                Book a demo <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="#demo" tone="outline" className="px-6 py-3.5 text-[16px]">
                <Play className="h-3.5 w-3.5 fill-current" /> Watch it work
              </Button>
            </motion.div>

            <motion.div {...rise(0.6)} className="mt-12 xl:hidden">
              <LinkStrip {...cycle} />
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 1, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative mt-10 xl:mt-8"
        >
          <ProductDemo />
        </motion.div>
      </div>
    </section>
  );
}
