import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, PhoneCall, PhoneOff } from "lucide-react";
import { DevinMark, LogoMark } from "../brand";
import { type Beat, frameAt, markAt, schedule } from "../script";

const say = (who: "agent" | "rep", text: string, extra: Partial<Beat> = {}): Beat => ({
  kind: "print",
  who,
  text,
  lead: who === "rep" ? 900 : 650,
  hold: Math.min(1600, 450 + text.length * 13),
  ...extra,
});

const BEATS: Beat[] = [
  { kind: "print", text: "", mark: "ring", hold: 1500 },
  say("rep", "Peachtree Fiber support, this is Dana.", { mark: "connected", lead: 200 }),
  say("agent", "Hi Dana, I'm UPLink, calling for Northside Dental. Sites are timing out and our local fixes didn't help."),
  say("rep", "Have you tried restarting the modem?"),
  say("agent", "Yes, at 9:44. I've sent you our probe log and timeline."),
  say("rep", "Line test is clean, and there's no outage in your area."),
  say("agent", "Thanks. I'll log that as reference PF-88214."),
  { kind: "print", text: "", mark: "outcome", hold: 400 },
];
export const ISP_CALL = schedule(BEATS);

const SPEEDUP = 14; // a real call takes minutes; the timer runs fast
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const BARS = Array.from({ length: 26 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
const EVIDENCE = ["Probe log", "Timeline", "Fixes tried"];

export function IspCall({ t }: { t: number }) {
  const frames = frameAt(ISP_CALL.beats, t);
  const connectedAt = markAt(ISP_CALL.beats, "connected");
  const outcomeAt = markAt(ISP_CALL.beats, "outcome");
  const ringing = t < connectedAt;
  const ended = t >= outcomeAt;
  const talking = frames.find((f) => f.pending)?.beat.who;
  const lines = frames.filter((f) => f.beat.who);
  const live = !ringing && !ended && Boolean(talking);

  return (
    <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
      <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-gradient-to-b from-amber-50/70 to-white px-4 py-5 text-center">
        <span className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-[17px] font-semibold text-white shadow-[0_10px_30px_-8px_rgb(251_146_60/0.7)]">
          {ringing && (
            <>
              <span className="ring-wave absolute inset-0 rounded-full border-2 border-amber-300" />
              <span className="ring-wave absolute inset-0 rounded-full border-2 border-amber-300" style={{ animationDelay: "0.7s" }} />
            </>
          )}
          PF
        </span>
        <div className="mt-3 text-[15px] font-semibold text-neutral-900">Peachtree Fiber</div>
        <div className="font-mono text-[11px] text-neutral-400">+1 (800) 555-0199</div>
        <div className="mt-3 font-mono text-[26px] font-light tabular text-neutral-800">
          {ringing ? "--:--" : mmss(((Math.min(t, outcomeAt) - connectedAt) / 1000) * SPEEDUP)}
        </div>
        <div className="mt-2 flex h-8 items-center gap-[3px]" aria-hidden="true">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full ${live ? "eq-bar" : ""}`}
              style={{
                height: `${Math.round(h * 26)}px`,
                background: live ? (talking === "agent" ? "#6366f1" : "#f59e0b") : "#e5e5e5",
                animationDelay: `${(i % 7) * 0.09}s`,
                animationDuration: `${0.6 + (i % 5) * 0.12}s`,
                transform: live ? undefined : "scaleY(0.2)",
              }}
            />
          ))}
        </div>
        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
            ended ? "bg-neutral-100 text-neutral-500" : ringing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {ended ? <PhoneOff className="h-3 w-3" /> : <PhoneCall className={`h-3 w-3 ${ringing ? "shake" : ""}`} />}
          {ended ? "Call ended" : ringing ? "Ringing" : "Live"}
        </span>
        <div className="mt-auto hidden w-full space-y-1.5 pt-4 md:block">
          {EVIDENCE.map((e, i) => (
            <motion.div
              key={e}
              initial={false}
              animate={{ opacity: t >= connectedAt + 1200 + i * 400 ? 1 : 0.25 }}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11.5px] text-neutral-600"
            >
              {e} <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="relative min-h-[300px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/70">
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 px-4 transition-[padding] duration-500" style={{ paddingBottom: ended ? 92 : 16 }}>
          {lines.map(({ beat, pending }, i) => (
            <Bubble key={i} who={beat.who as "agent" | "rep"} text={beat.text} pending={pending} />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-neutral-50 to-transparent" />
        <AnimatePresence>
          {ended && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
              className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">ISP cleared · ref PF-88214</div>
                <div className="mt-0.5 text-[14px] font-medium text-neutral-800">Not their fault, and not a known one.</div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[13px] font-medium text-white">
                <DevinMark className="h-3.5 w-3.5" color="#fff" /> To Devin <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700">D</span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
          agent ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-neutral-200 bg-white text-neutral-700"
        }`}
      >
        {pending ? (
          <span className="flex gap-1 py-1" aria-hidden="true">
            {[0, 1, 2].map((d) => (
              <span key={d} className={`typing-dot h-1.5 w-1.5 rounded-full ${agent ? "bg-white" : "bg-neutral-400"}`} style={{ animationDelay: `${d * 0.15}s` }} />
            ))}
          </span>
        ) : (
          text
        )}
      </div>
    </motion.div>
  );
}
