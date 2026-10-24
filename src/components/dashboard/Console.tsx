"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneOutgoing } from "lucide-react";
import type { Incident, LocalModelState, TerminalLine, TimelineEvent } from "../../lib/types";
import { Timeline } from "./Sidebar";

const PHASE: Record<LocalModelState["phase"], { label: string; dot: string; pulse: boolean }> = {
  asleep: { label: "Asleep", dot: "bg-white/25", pulse: false },
  waking: { label: "Waking up…", dot: "bg-warn", pulse: true },
  troubleshooting: { label: "Troubleshooting…", dot: "bg-accent", pulse: true },
  done: { label: "Done", dot: "bg-ok", pulse: false },
};

/** Header pill: the on-device model only runs while something is wrong. */
export function ModelPill({ llm }: { llm?: LocalModelState }) {
  if (!llm) return null;
  const p = PHASE[llm.phase];
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1 text-[12px] text-white/60" data-testid="model-pill" data-phase={llm.phase}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot} ${p.pulse ? "animate-pulse" : ""}`} />
      Local model · {llm.model} · {p.label}
    </div>
  );
}

const TONE: Record<TerminalLine["kind"], string> = {
  cmd: "text-white/85",
  out: "text-ok/80",
  err: "text-bad/85",
  model: "text-accent",
  info: "text-white/40",
};

/** What the agent actually runs, and what came back. */
export function Terminal({ lines, className = "" }: { lines: TerminalLine[]; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const last = lines.at(-1)?.at;
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight; // its own box only, never the page
  }, [last]);
  return (
    <div ref={box} className={`scroll-thin min-h-0 overflow-y-auto rounded-xl bg-black/50 p-4 font-mono text-[12px] leading-relaxed ${className}`} data-testid="terminal">
      {lines.length === 0 && <div className="text-white/35">Watching… the local model is asleep until something breaks.</div>}
      {lines.map((l, i) => (
        <div key={i} className="flex gap-3">
          <span className="shrink-0 text-white/20 tabular">{new Date(l.at).toLocaleTimeString("en-US", { hour12: false })}</span>
          <span className={`min-w-0 break-words ${TONE[l.kind]}`}>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Activity (human summary) and Terminal (raw commands) in one panel. */
export function ActivityPanel({
  events,
  startedAt,
  terminal,
  className = "",
}: {
  events?: TimelineEvent[];
  startedAt?: string;
  terminal: TerminalLine[];
  className?: string;
}) {
  const [tab, setTab] = useState<"terminal" | "activity">("terminal");
  return (
    <div className={`panel flex min-h-0 flex-col p-5 ${className}`}>
      <div className="flex gap-1 text-[13px]">
        {(["terminal", "activity"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-2.5 py-1 font-medium transition ${tab === t ? "bg-white/10 text-white" : "text-white/45 hover:text-white/75"}`}
          >
            {t === "terminal" ? "Terminal" : "Activity"}
          </button>
        ))}
      </div>
      {tab === "terminal" || !events ? (
        <Terminal lines={terminal} className="mt-3 flex-1" />
      ) : (
        <Timeline events={events} startedAt={startedAt!} className="mt-3 flex-1 !border-0 !bg-transparent !p-0" />
      )}
    </div>
  );
}

/** "Uplink calls Peachtree Fiber in 0:07" — so the customer knows when to expect it. */
export function CallCountdown({ incident, provider, now }: { incident: Incident; provider: string; now: number }) {
  if (incident.status !== "escalating" || !incident.callAt) return null;
  const left = Math.max(0, Date.parse(incident.callAt) - now);
  const total = Math.max(1, Date.parse(incident.callAt) - Date.parse(incident.startedAt));
  const waitingForWayOut = left === 0 && incident.timeline.some((e) => e.text.startsWith("No way out"));
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  return (
    <div className="mt-6 rounded-xl border border-accent/20 bg-accent/[0.06] px-5 py-4" data-testid="call-countdown">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PhoneOutgoing className="h-4 w-4 text-accent" />
          <span className="text-[15px] text-white/85">
            {waitingForWayOut
              ? `No connection to call ${provider} yet — it goes out the moment there is one`
              : left > 0
                ? `Uplink calls ${provider} unless it clears first`
                : `Calling ${provider}…`}
          </span>
        </div>
        {left > 0 && (
          <span className="text-[28px] font-semibold leading-none tabular text-white">
            {mm}:{String(ss).padStart(2, "0")}
          </span>
        )}
      </div>
      {left > 0 && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${100 - (left / total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
