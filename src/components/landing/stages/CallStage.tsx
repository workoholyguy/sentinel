"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, PhoneCall, PhoneOff } from "lucide-react";
import { useRef } from "react";
import { DevinMark, LogoMark } from "../brand";
import { type Beat, frameAt, markAt, schedule } from "../script";
import { Window } from "../ui";
import { usePlayhead } from "../usePlayhead";

const say = (who: "agent" | "rep", text: string, extra: Partial<Beat> = {}): Beat => ({
  kind: "print",
  who,
  text,
  lead: who === "rep" ? 900 : 650,
  hold: Math.min(1700, 500 + text.length * 14),
  ...extra,
});

const OPENING: Beat[] = [
  { kind: "print", text: "", mark: "ring", hold: 1800 },
  say("rep", "Peachtree Fiber support, this is Dana. How can I help?", { mark: "connected", lead: 200 }),
  say("agent", "Hi Dana, I'm UPLink, an AI assistant calling for Northside Dental, account 4471-2290."),
];

// The provider's fault: UPLink doesn't hang up without a ticket, a technician and a credit.
const THEIRS = [
  ...OPENING,
  say("agent", "We've had 38% packet loss starting at your node since 9:41. Every hop on our side is clean."),
  say("rep", "Have you tried restarting the modem?"),
  say("agent", "Yes, at 9:44. The loss persisted. I can send the trace."),
  say("rep", "I see it now. Ticket PF-88213, a technician comes today 3–5 PM."),
  say("agent", "Thanks. That's three hours down on a $129 plan. Can you credit the day?"),
  say("rep", "Done, a $4.30 credit is on this month's bill."),
  { kind: "print", text: "", mark: "outcome" } as Beat,
];

// Not the provider: UPLink logs the reference and hands the fault to Devin.
const CLEARED = [
  ...OPENING,
  say("agent", "Sites time out on every device and our local fixes didn't help. Is anything wrong on your side?"),
  say("rep", "Running a line test… Your line is clean and there's no outage in your area."),
  say("agent", "Understood. I'll log that with reference PF-88214. Thanks, Dana."),
  { kind: "print", text: "", mark: "outcome" } as Beat,
];

const A = schedule(THEIRS);
const B0 = schedule(CLEARED);
// pad the shorter call so both variants share one loop length
const B = schedule(CLEARED.map((b, i) => (i === CLEARED.length - 1 ? { ...b, hold: A.total - B0.total + (b.hold ?? 260) } : b)));
const TOTAL = Math.max(A.total, B.total);
const SPEEDUP = 16; // the real call takes minutes; the timer runs fast

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function CallStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { t, loop } = usePlayhead(ref, TOTAL, 3600);
  const cleared = loop % 2 === 1;
  const script = cleared ? B : A;
  const frames = frameAt(script.beats, t);
  const connectedAt = markAt(script.beats, "connected");
  const outcomeAt = markAt(script.beats, "outcome");
  const ringing = t < connectedAt;
  const ended = t >= outcomeAt;
  const talking = frames.find((f) => f.pending)?.beat.who as "agent" | "rep" | undefined;
  const lines = frames.filter((f) => f.beat.who);

  return (
    <div ref={ref}>
      <div className="mb-4 flex justify-end gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="py-1 pr-1 text-white/30">Outcome</span>
        {["Their fault", "Not their fault"].map((label, i) => (
          <span
            key={label}
            className={`rounded-full border px-2.5 py-1 transition-colors duration-500 ${
              (i === 1) === cleared ? "border-warn/40 bg-warn/10 text-warn" : "border-white/[0.07] text-white/30"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <Window
        title="uplink — outbound call"
        glow="251 191 36"
        right={<span className="font-mono text-[12px] tabular text-white/55">{ringing ? "--:--" : mmss(((Math.min(t, outcomeAt) - connectedAt) / 1000) * SPEEDUP)}</span>}
      >
        <div className="flex items-center gap-4 border-b border-white/[0.05] px-5 py-4">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warn/15 text-[13px] font-semibold text-warn">
            {ringing && (
              <>
                <span className="ring-wave absolute inset-0 rounded-full border border-warn/50" />
                <span className="ring-wave absolute inset-0 rounded-full border border-warn/50" style={{ animationDelay: "0.7s" }} />
              </>
            )}
            PF
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium text-white/90">Peachtree Fiber · Business support</div>
            <div className="font-mono text-[11px] text-white/40">+1 (800) 555-0199</div>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
              ended ? "bg-white/[0.06] text-white/50" : ringing ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok"
            }`}
          >
            {ended ? <PhoneOff className="h-3 w-3" /> : <PhoneCall className={`h-3 w-3 ${ringing ? "shake" : ""}`} />}
            {ended ? "Ended" : ringing ? "Ringing" : "Live"}
          </span>
        </div>

        <Waveform active={!ringing && !ended} who={talking} />

        <div className="relative h-[318px] overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 transition-[padding] duration-500 sm:px-5" style={{ paddingBottom: ended ? 104 : 16 }}>
            {lines.map(({ beat, pending }, i) => (
              <Bubble key={`${loop}-${i}`} who={beat.who as "agent" | "rep"} text={beat.text} pending={pending} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#070a11] to-transparent" />
          <AnimatePresence>{ended && <Outcome key={cleared ? "b" : "a"} cleared={cleared} />}</AnimatePresence>
        </div>
      </Window>
    </div>
  );
}

const BARS = Array.from({ length: 44 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));

function Waveform({ active, who }: { active: boolean; who?: "agent" | "rep" }) {
  const color = who === "agent" ? "#38e1ff" : "#fbbf24";
  return (
    <div className="flex h-12 items-center justify-center gap-[3px] border-b border-white/[0.05] px-5" aria-hidden="true">
      {BARS.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-colors duration-300 ${active && who ? "eq-bar" : ""}`}
          style={{
            height: `${Math.round(h * 26)}px`,
            background: active && who ? color : "rgb(255 255 255 / 0.12)",
            animationDelay: `${(i % 7) * 0.09}s`,
            animationDuration: `${0.6 + (i % 5) * 0.12}s`,
            transform: active && who ? undefined : "scaleY(0.18)",
          }}
        />
      ))}
    </div>
  );
}

function Bubble({ who, text, pending }: { who: "agent" | "rep"; text: string; pending: boolean }) {
  const agent = who === "agent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex items-end gap-2 ${agent ? "flex-row-reverse" : ""}`}
    >
      {agent ? (
        <LogoMark className="h-6 w-6 shrink-0" />
      ) : (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warn/20 text-[10px] font-semibold text-warn">D</span>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug ${
          agent ? "rounded-br-md bg-accent/[0.12] text-white/90" : "rounded-bl-md bg-white/[0.06] text-white/75"
        }`}
      >
        {pending ? (
          <span className="flex gap-1 py-1" aria-hidden="true">
            {[0, 1, 2].map((d) => (
              <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-white/60" style={{ animationDelay: `${d * 0.15}s` }} />
            ))}
          </span>
        ) : (
          text
        )}
      </div>
    </motion.div>
  );
}

function Outcome({ cleared }: { cleared: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-[#0b0f18]/95 p-4 shadow-2xl backdrop-blur"
    >
      {cleared ? (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Provider cleared · ref PF-88214</div>
            <div className="mt-1 text-[15px] text-white/85">Line test clean. The fault is local and new.</div>
          </div>
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-violet/40 bg-violet/10 px-3 py-1.5 text-[13px] text-violet">
            <DevinMark className="h-3.5 w-3.5" /> To Devin <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-white/[0.07] text-center">
          {[
            ["Ticket", "PF-88213", "text-white/90"],
            ["Technician", "Today 3–5 PM", "text-white/90"],
            ["Credit", "+$4.30", "text-ok"],
          ].map(([k, v, c]) => (
            <div key={k} className="px-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{k}</div>
              <div className={`mt-1 text-[14px] font-medium sm:text-[15px] ${c}`}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
