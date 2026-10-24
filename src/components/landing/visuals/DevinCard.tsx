"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useRef } from "react";
import { DevinMark } from "../brand";
import { Card } from "../ui";
import { useLoop } from "../useLoop";

const STEP_MS = 1100;
const STEPS = [
  { label: "Brief sent with the evidence", detail: "fault · probes · fixes tried · ISP reference" },
  { label: "Repair plugin written", detail: "fix-ipv6-blackhole.ts  +14" },
  { label: "6 tests passed", detail: "fix-ipv6-blackhole.test.ts" },
  { label: "Pull request opened", detail: "#128 · Add IPv6 blackhole repair" },
  { label: "Deployed to every site", detail: "loaded into the local playbook" },
];
const LOOP_MS = STEP_MS * (STEPS.length + 1) + 3600;

export function DevinCard() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, LOOP_MS);
  const reached = Math.floor(t / STEP_MS); // steps < reached are done; step == reached is running
  const done = reached >= STEPS.length;

  return (
    <div ref={ref}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-neutral-950">
              <DevinMark className="h-[18px] w-[18px]" color="#fff" />
            </span>
            <div>
              <div className="text-[14px] font-medium text-neutral-900">Devin</div>
              <div className="text-[12px] text-neutral-400">Repair session · IPV6_BLACKHOLE</div>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${done ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
            {done ? "Shipped" : "Working"}
          </span>
        </div>

        <ol className="space-y-1 px-5 py-5">
          {STEPS.map((s, i) => {
            const state = i < reached ? "done" : i === reached ? "running" : "todo";
            return (
              <li key={s.label} className="flex items-start gap-3.5 py-2">
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
                    state === "done" ? "border-neutral-950 bg-neutral-950 text-white" : state === "running" ? "border-neutral-400" : "border-neutral-200"
                  }`}
                >
                  {state === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
                  {state === "running" && <span className="h-2 w-2 animate-spin rounded-full border border-neutral-500 border-t-transparent" />}
                </span>
                <div>
                  <div className={`text-[14px] transition-colors ${state === "todo" ? "text-neutral-300" : "text-neutral-900"}`}>{s.label}</div>
                  <div className={`font-mono text-[11.5px] ${state === "todo" ? "text-neutral-200" : "text-neutral-400"}`}>{s.detail}</div>
                </div>
              </li>
            );
          })}
        </ol>

        <motion.div initial={false} animate={{ opacity: done ? 1 : 0 }} className="border-t border-neutral-100 px-5 py-3.5 text-[13px] text-neutral-500">
          <span className="font-medium text-emerald-600">Learned.</span> Next time this fault is fixed on-device, in seconds.
        </motion.div>
      </Card>
    </div>
  );
}
