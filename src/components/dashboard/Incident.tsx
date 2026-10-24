"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Cpu, ShieldCheck, X } from "lucide-react";
import type { Diagnosis, FixResult, IncidentStatus } from "../../lib/types";
import { STEP_LABEL, humanize, stepsFor } from "./format";

export function Stepper({ status, escalated }: { status: IncidentStatus; escalated: boolean }) {
  const steps = stepsFor(status, escalated);
  return (
    <ol className="flex items-center" data-testid="stepper">
      {steps.map((s, i) => {
        const terminal = s.id === "resolved" || s.id === "ticketed";
        const tone = s.state === "done" && terminal ? "#34d399" : s.state === "todo" ? "rgb(255 255 255 / 0.18)" : "#38e1ff";
        return (
          <li key={s.id} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`} data-state={s.state} data-step={s.id}>
            <div className="flex items-center gap-3">
              <span className="relative grid h-8 w-8 place-items-center rounded-full border" style={{ borderColor: tone }}>
                {s.state === "current" && <span className="halo absolute inset-0 rounded-full border" style={{ borderColor: tone }} />}
                {s.state === "done" ? (
                  <Check className="h-4 w-4" style={{ color: tone }} strokeWidth={2.5} />
                ) : (
                  <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
                )}
              </span>
              <span
                className={`text-[15px] font-medium tracking-tight ${s.state === "todo" ? "text-white/30" : "text-white/90"}`}
              >
                {STEP_LABEL[s.id]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-4 h-px flex-1 overflow-hidden bg-white/10">
                <motion.div
                  className="h-full bg-accent"
                  initial={false}
                  animate={{ width: s.state === "done" ? "100%" : "0%" }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function DiagnosisCard({ diagnosis }: { diagnosis?: Diagnosis }) {
  if (!diagnosis) {
    return (
      <div className="panel flex h-full flex-col justify-center p-7">
        <div className="label">Diagnosis</div>
        <div className="mt-4 flex items-center gap-3 text-xl text-white/60">
          <Cpu className="h-5 w-5 animate-pulse text-accent" />
          Analysing probes on-device…
        </div>
        <div className="mt-5 space-y-2.5">
          {[80, 64, 72].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded-full bg-white/[0.06]" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }
  const pct = Math.round(diagnosis.confidence * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel flex h-full min-h-0 flex-col p-7"
      data-testid="diagnosis"
    >
      <div className="flex items-center justify-between">
        <div className="label">Diagnosis</div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-label text-white/40">Confidence</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }} />
          </div>
          <span className="font-mono text-sm tabular text-accent">{pct}%</span>
        </div>
      </div>
      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto pr-1 [overflow-anchor:none]">
        <h3 className="text-[24px] font-semibold leading-tight tracking-tight">{diagnosis.summary}</h3>
        <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/[0.06] p-5">
          {diagnosis.explanation ? (
            <p className="text-[16px] leading-relaxed text-white/85" data-testid="explanation">
              {diagnosis.explanation}
            </p>
          ) : (
            <div className="flex items-center gap-3 text-[16px] text-white/50">
              <Cpu className="h-4 w-4 animate-pulse text-accent" />
              Local model is writing a plain-English explanation…
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
              <ShieldCheck className="h-3.5 w-3.5" />
              Explained on-device · no cloud
            </span>
            <span className="font-mono text-[11px] text-white/35">{BLAME[diagnosis.blame]}</span>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {diagnosis.evidence.map((e, i) => (
            <motion.li
              key={e}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex gap-3 text-[15px] leading-snug text-white/65"
            >
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
              {e}
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

const BLAME: Record<Diagnosis["blame"], string> = {
  local: "Fault: this computer",
  router: "Fault: office router",
  isp: "Fault: internet provider",
  unknown: "Fault: unclear",
};

export function FixesList({ fixes, status, devin = false }: { fixes: FixResult[]; status: IncidentStatus; devin?: boolean }) {
  return (
    <div className="panel p-6" data-testid="fixes">
      <div className="label">Fixes tried</div>
      <ul className="mt-4 space-y-3">
        <AnimatePresence initial={false}>
          {fixes.map((f, i) => (
            <motion.li
              key={`${f.pluginId}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
              data-ok={f.ok}
            >
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  f.ok ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"
                }`}
                aria-label={f.ok ? "succeeded" : "failed"}
              >
                {f.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-white/90">{f.actions[0] ?? humanize(f.pluginId)}</div>
                <div className="text-[13px] text-white/45">
                  {[...f.actions.slice(1), f.detail].filter(Boolean).join(" · ") || (f.ok ? "Fixed" : "Didn't help")}
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {devin && fixes.length === 0 && (
          <li className="text-[15px] leading-snug text-white/55">Nothing in the playbook fits this fault — handed to Devin.</li>
        )}
        {status === "fixing" && !devin && (
          <li className="flex items-center gap-3 text-[15px] text-white/45">
            <span className="grid h-6 w-6 place-items-center">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            </span>
            Trying next fix…
          </li>
        )}
        {fixes.length === 0 && status !== "fixing" && !devin && <li className="text-[15px] text-white/35">None yet</li>}
      </ul>
    </div>
  );
}
