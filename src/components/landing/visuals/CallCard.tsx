"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { PhoneGlyph } from "../glyphs";
import { type Beat, frameAt, markAt, schedule } from "../script";
import { Card } from "../ui";
import { useLoop } from "../useLoop";

const line = (who: string, text: string, extra: Partial<Beat> = {}): Beat => ({ kind: "print", who, text, lead: 500, hold: 1100, ...extra });

const SCRIPT = schedule([
  { kind: "print", text: "", mark: "live", hold: 900 },
  line("Agent", "Have you tried restarting your modem?"),
  line("Uplink", "Yes, at 9:44. Loss starts at your node, 38%. I've sent you the trace."),
  line("Agent", "Confirmed, there's a fault on our side. Opening a ticket now."),
  line("Uplink", "Thanks. Please credit the downtime to account 4471-2290."),
  { kind: "print", text: "", mark: "outcome" },
]);
const LOOP_MS = SCRIPT.total + 3600;
const SPEEDUP = 12; // the real call takes minutes

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function CallCard() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, LOOP_MS);
  const lines = frameAt(SCRIPT.beats, t).filter((f) => f.beat.who && !f.pending);
  const outcomeAt = markAt(SCRIPT.beats, "outcome");
  const ended = t >= outcomeAt;

  return (
    <div ref={ref}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-600">
              <PhoneGlyph className="h-[18px] w-[18px]" />
            </span>
            <div>
              <div className="text-[14px] font-medium text-neutral-900">Calling Peachtree Fiber</div>
              <div className="text-[12px] text-neutral-400">Business support · +1 800 555 0199</div>
            </div>
          </div>
          <span className="flex items-center gap-2 font-mono text-[13px] tabular text-neutral-500">
            <span className={`h-1.5 w-1.5 rounded-full ${ended ? "bg-neutral-300" : "animate-pulse bg-emerald-500"}`} />
            {mmss((Math.min(t, outcomeAt) / 1000) * SPEEDUP)}
          </span>
        </div>

        <div className="flex h-[236px] flex-col justify-end gap-3.5 overflow-hidden px-5 py-5">
          {lines.map(({ beat }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid grid-cols-[62px_1fr] gap-3">
              <span className={`pt-px text-[11px] font-medium uppercase tracking-[0.1em] ${beat.who === "Uplink" ? "text-blue-600" : "text-neutral-400"}`}>{beat.who}</span>
              <span className="text-[14px] leading-snug text-neutral-700">{beat.text}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: ended ? 1 : 0.35 }}
          className="grid grid-cols-3 divide-x divide-neutral-100 border-t border-neutral-100"
        >
          {[
            ["Ticket", "PF-88213", "text-neutral-900"],
            ["Technician", "Today, 3–5 PM", "text-neutral-900"],
            ["Credit", "$4.30", "text-emerald-600"],
          ].map(([k, v, c]) => (
            <div key={k} className="px-4 py-3.5 sm:px-5">
              <div className="text-[11px] uppercase tracking-[0.1em] text-neutral-400">{k}</div>
              <div className={`mt-0.5 text-[14px] font-medium ${ended ? c : "text-neutral-300"}`}>{ended ? v : "—"}</div>
            </div>
          ))}
        </motion.div>
      </Card>
    </div>
  );
}
