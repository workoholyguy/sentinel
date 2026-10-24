"use client";

import { motion } from "framer-motion";
import { Hash, Headphones, Phone, Receipt, ScanSearch } from "lucide-react";
import { useRef } from "react";
import { type Beat, frameAt, markAt, schedule } from "./script";
import { Section, SectionHeading } from "./ui";
import { usePlayhead } from "./usePlayhead";

const PEOPLE: Record<string, { color: string; initials: string }> = {
  Priya: { color: "#f472b6", initials: "PR" },
  Marcus: { color: "#34d399", initials: "MA" },
  You: { color: "#5b8cff", initials: "YO" },
};

const MESSAGES: Array<{ who: string; time: string; text: string; mark?: string; bad?: boolean }> = [
  { who: "Priya", time: "9:41", text: "Is the Wi-Fi down for anyone else?" },
  { who: "Marcus", time: "9:42", text: "Card reader's offline. The line is getting long." },
  { who: "Priya", time: "9:44", text: "Restarted the router. Still nothing." },
  { who: "You", time: "9:52", text: "Calling the ISP…", mark: "call" },
  { who: "You", time: "10:39", text: "They say it's on our end. 🙃", bad: true },
];

const HOLD_MS = 3400;
const HOLD_SECONDS = 47 * 60 + 12;

const BEATS: Beat[] = [
  ...MESSAGES.slice(0, 4).map((m): Beat => ({ kind: "print", who: m.who, text: m.text, mark: m.mark, lead: 650, hold: 450 })),
  { kind: "print", text: "", mark: "hold", hold: HOLD_MS },
  { kind: "print", who: MESSAGES[4].who, text: MESSAGES[4].text, lead: 500, hold: 700 },
  { kind: "print", text: "", mark: "summary" },
];
const SCRIPT = schedule(BEATS);

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function OutageThread() {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = usePlayhead(ref, SCRIPT.total, 3200);
  const frames = frameAt(SCRIPT.beats, t);
  const holdAt = markAt(SCRIPT.beats, "hold");
  const holdProgress = Math.min(1, Math.max(0, (t - holdAt) / HOLD_MS));
  const holdDone = t >= holdAt + HOLD_MS;
  const showSummary = t >= markAt(SCRIPT.beats, "summary");

  return (
    <div ref={ref} className="relative">
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[60px] bg-[radial-gradient(50%_50%_at_50%_50%,rgb(255_77_109/0.14),transparent_70%)] blur-2xl" />
      <div className="glass overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2 text-[14px] font-medium text-white/85">
            <Hash className="h-4 w-4 text-white/40" /> front-desk
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bad">
            <span className="alarm h-1.5 w-1.5 rounded-full bg-bad" /> Internet down
          </span>
        </div>

        <div className="flex h-[440px] flex-col justify-end gap-4 overflow-hidden px-5 pb-5 pt-3 sm:h-[460px]">
          {frames.map(({ beat, pending }, i) => {
            if (beat.mark === "summary") return null;
            if (beat.mark === "hold") {
              return (
                <motion.div
                  key="hold"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="ml-11 flex items-center gap-4 rounded-2xl border border-warn/20 bg-warn/[0.06] px-4 py-3"
                >
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warn/15 text-warn">
                    {!holdDone && <span className="ring-wave absolute inset-0 rounded-full border border-warn/40" />}
                    <Headphones className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-white/80">{holdDone ? "Call ended" : "On hold with your ISP"}</div>
                    <div className="truncate text-[12px] italic text-white/40">“Your call is important to us…”</div>
                  </div>
                  <div className="flex items-end gap-[3px]" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((b) => (
                      <span
                        key={b}
                        className={`w-[3px] rounded-full bg-warn/70 ${holdDone ? "" : "eq-bar"}`}
                        style={{ height: 16, animationDelay: `${b * 0.13}s`, transform: holdDone ? "scaleY(0.25)" : undefined }}
                      />
                    ))}
                  </div>
                  <div className="font-mono text-[15px] tabular text-warn">{mmss(holdProgress * HOLD_SECONDS)}</div>
                </motion.div>
              );
            }
            const msg = MESSAGES.find((m) => m.text === beat.text)!;
            const person = PEOPLE[msg.who];
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold text-black"
                  style={{ background: person.color }}
                >
                  {person.initials}
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-white/85">{msg.who}</span>
                    <span className="font-mono text-[11px] text-white/30">{msg.time} AM</span>
                  </div>
                  {pending ? (
                    <div className="mt-2 flex gap-1" aria-hidden="true">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-white/50" style={{ animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </div>
                  ) : (
                    <p className={`mt-0.5 text-[15px] leading-snug ${msg.bad ? "text-bad" : "text-white/70"}`}>
                      {msg.mark === "call" && <Phone className="mr-1.5 inline h-3.5 w-3.5 text-white/40" />}
                      {beat.text}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}

          <motion.div
            initial={false}
            animate={{ opacity: showSummary ? 1 : 0, y: showSummary ? 0 : 8 }}
            className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4"
          >
            {[
              ["58 min", "offline"],
              ["24 people", "idle"],
              ["$0", "credit claimed"],
            ].map(([big, small]) => (
              <div key={small} className="rounded-xl bg-bad/[0.07] px-3 py-2 text-center">
                <div className="text-[17px] font-semibold tracking-tight text-bad">{big}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">{small}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const PAINS = [
  { icon: ScanSearch, title: "Guesswork", text: "Laptop, Wi-Fi, router or provider? Nobody can tell where it broke." },
  { icon: Headphones, title: "Hold music", text: "Support scripts are built to wear you down. “Have you tried restarting?”" },
  { icon: Receipt, title: "Unclaimed credits", text: "Providers owe you for downtime, but only if you ask with proof." },
];

function Compare() {
  return (
    <div className="mt-20 grid gap-6 rounded-3xl border hairline bg-white/[0.015] p-6 sm:p-8 lg:mt-28">
      <div className="font-mono text-[11px] uppercase tracking-label text-white/40">Time to back online</div>
      {[
        { who: "Your team, today", value: "58 min", width: "100%", bar: "linear-gradient(90deg, #ff4d6d, #fbbf24)", text: "text-white/85", dur: 2.2 },
        { who: "With UPLink", value: "4.2 s", width: "1.6%", bar: "#38e1ff", text: "text-accent", dur: 0.5 },
      ].map((row) => (
        <div key={row.who} className="grid items-center gap-3 sm:grid-cols-[150px_1fr_80px]">
          <div className="text-[14px] text-white/55">{row.who}</div>
          <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: row.bar, boxShadow: "0 0 18px rgb(56 225 255 / 0.4)", minWidth: 10 }}
              initial={{ width: 0 }}
              whileInView={{ width: row.width }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: row.dur, ease: [0.3, 0.7, 0.2, 1] }}
            />
          </div>
          <div className={`font-mono text-[18px] tabular sm:text-right ${row.text}`}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export function Problem() {
  return (
    <Section id="problem" className="py-24 sm:py-32">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_480px] lg:gap-20">
        <div>
          <SectionHeading eyebrow="The problem" color="#ff4d6d" title="Every outage starts" dim="a scavenger hunt.">
            When the connection drops, work stops. Then someone restarts the router, someone else sits on hold, and the
            provider says it&apos;s your fault.
          </SectionHeading>
          <ul className="mt-12 grid gap-6">
            {PAINS.map(({ icon: Icon, title, text }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/60">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <div className="text-[16px] font-medium text-white/90">{title}</div>
                  <div className="mt-0.5 text-[15px] text-white/50">{text}</div>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
        <OutageThread />
      </div>
      <Compare />
    </Section>
  );
}
