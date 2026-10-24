"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CircleDollarSign, PartyPopper, Phone, Ticket } from "lucide-react";
import type { CallState } from "../../lib/types";
import { callElapsed, formatDuration, formatPhone, formatUsd, isCallLive, isCallPending } from "./format";

export function CallPanel({ call, provider, now }: { call: CallState; provider: string; now: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const count = call.transcript.length;

  const hasOutcome = Boolean(call.outcome);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // the outcome card animates in and shrinks the transcript; keep the newest line in view
    const id = setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 600);
    return () => clearTimeout(id);
  }, [count, hasOutcome]);

  const pending = isCallPending(call);
  const live = isCallLive(call);
  const last = call.transcript[count - 1];
  const stateLabel = live
    ? "Live call"
    : call.status === "ended"
      ? "Call complete"
      : call.status === "failed"
        ? "Call failed"
        : call.status === "ringing"
          ? "Ringing"
          : "Dialing";

  return (
    <div className="panel relative flex h-full min-h-0 flex-col overflow-hidden" data-testid="call-panel">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-accent/[0.08] to-transparent" />
      <header className="relative flex items-start justify-between gap-4 border-b border-white/[0.06] p-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${live ? "alarm bg-bad" : pending ? "alarm bg-accent" : call.status === "failed" ? "bg-warn" : "bg-ok"}`} />
            <span className="label !text-white/55">
              {stateLabel}
            </span>
          </div>
          <div className="mt-2 truncate text-[32px] font-semibold leading-none tracking-tight">{provider}</div>
          <div className="mt-2 font-mono text-[15px] tabular text-white/50">{formatPhone(call.to)}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[44px] font-light leading-none tabular text-white" data-testid="call-timer">
            {formatDuration(callElapsed(call, now))}
          </div>
          {live && (
            <div className="mt-3 flex h-5 items-end justify-end gap-[3px]" aria-hidden>
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className="eq-bar w-[3px] rounded-full"
                  style={{
                    height: "100%",
                    background: last?.speaker === "agent" ? "#38e1ff" : "#e6edf7",
                    animationDelay: `${(i * 0.13) % 0.9}s`,
                    animationDuration: `${0.6 + (i % 3) * 0.18}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      <AnimatePresence>{call.outcome && <OutcomeCard call={call} provider={provider} />}</AnimatePresence>

      {pending ? (
        <Ringing provider={provider} ringing={call.status === "ringing"} />
      ) : (
        <div ref={scroller} className="scroll-thin relative min-h-0 flex-1 space-y-3 overflow-y-auto p-7 pb-12" data-testid="transcript">
          <AnimatePresence initial={false}>
            {call.transcript.map((line, i) => {
              const agent = line.speaker === "agent";
              return (
                <motion.div
                  key={`${i}-${line.speaker}`}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className={`flex flex-col ${agent ? "items-end" : "items-start"}`}
                  data-speaker={line.speaker}
                >
                  <span className="mb-1 px-1 font-mono text-[10px] uppercase tracking-label text-white/35">
                    {agent ? "Sentinel" : "Support rep"}
                  </span>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[16px] leading-snug ${
                      agent
                        ? "rounded-br-md border border-accent/25 bg-accent/[0.12] text-white"
                        : "rounded-bl-md border border-white/[0.06] bg-white/[0.05] text-white/85"
                    }`}
                  >
                    {line.text}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {live && (
            <div className={`flex ${last?.speaker === "agent" ? "justify-start" : "justify-end"} pt-1`}>
              <div className="flex gap-1 rounded-full bg-white/[0.04] px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Ringing({ provider, ringing }: { provider: string; ringing: boolean }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-10" data-testid="ringing">
      <div className="relative grid h-40 w-40 place-items-center">
        {[0, 0.7, 1.4].map((d) => (
          <span key={d} className="ring-wave absolute inset-0 rounded-full border border-accent/50" style={{ animationDelay: `${d}s` }} />
        ))}
        <div className="relative grid h-28 w-28 place-items-center rounded-full bg-accent text-ink-950 shadow-[0_0_80px_-10px_#38e1ff]">
          <Phone className={`h-11 w-11 ${ringing ? "shake" : ""}`} strokeWidth={2} />
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-medium tracking-tight">{ringing ? `Ringing ${provider}…` : `Dialing ${provider}…`}</div>
        <div className="mt-2 text-[15px] text-white/45">Sentinel will speak to support on your behalf</div>
      </div>
    </div>
  );
}

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  x: Math.cos((i / 22) * Math.PI * 2) * (90 + (i % 4) * 30),
  y: Math.sin((i / 22) * Math.PI * 2) * (50 + (i % 3) * 26),
  c: ["#38e1ff", "#34d399", "#ffffff", "#fbbf24"][i % 4],
  r: (i * 47) % 360,
}));

function OutcomeCard({ call, provider }: { call: CallState; provider: string }) {
  const o = call.outcome!;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.3, 1] }}
      className="relative shrink-0 overflow-hidden"
      data-testid="outcome"
    >
      <div className="relative m-5 overflow-hidden rounded-3xl border border-ok/30 bg-linear-to-br from-ok/[0.16] via-ink-800 to-accent/[0.10] p-7">
        <div className="pointer-events-none absolute left-1/2 top-12">
          {CONFETTI.map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-1 rounded-sm"
              style={{ background: p.c }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: p.x * 1.6, y: p.y * 1.6 + 60, opacity: 0, rotate: p.r }}
              transition={{ duration: 1.8, ease: "easeOut", delay: 0.2 }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.15 }}
            className="grid h-11 w-11 place-items-center rounded-full bg-ok text-ink-950"
          >
            <PartyPopper className="h-5 w-5" />
          </motion.span>
          <div>
            <div className="text-xl font-semibold tracking-tight">Sorted with {provider}</div>
            <div className="text-[14px] text-white/55">{o.summary}</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-[1.1fr_1fr] gap-5">
          <div>
            <div className="label flex items-center gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5" /> Credit secured
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-1 text-[72px] font-semibold leading-none tracking-tighter text-ok tabular"
              data-testid="outcome-credit"
            >
              {formatUsd(o.creditUsd ?? 0)}
            </motion.div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="label flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" /> Ticket
              </div>
              <div className="mt-1 font-mono text-[26px] font-medium tracking-tight text-white" data-testid="outcome-ticket">
                {o.ticketNumber ?? "—"}
              </div>
            </div>
            <div>
              <div className="label flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Technician
              </div>
              <div className="mt-1 text-[18px] font-medium text-white/90">{o.technicianWindow ?? "Not needed"}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
