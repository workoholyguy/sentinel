"use client";

import { motion } from "framer-motion";
import { Bot, Check, ExternalLink, GitPullRequest, X } from "lucide-react";
import type { RepairState } from "../../lib/types";
import { formatDuration } from "./format";

type StepState = "done" | "current" | "todo" | "failed";

function repairSteps(r: RepairState): { label: string; detail: string; state: StepState }[] {
  if (r.status === "queued") {
    return [
      { label: "Queued offline", detail: "Saved with the evidence — no internet right now", state: "current" },
      { label: "Writing the repair", detail: "Starts the moment a connection is back", state: "todo" },
      { label: "Pull request opened", detail: "Uplink loads it on the next fault", state: "todo" },
    ];
  }
  const failed = r.status === "failed" || r.status === "blocked";
  const writing: StepState = r.status === "finished" ? "done" : failed ? "failed" : r.status === "working" ? "current" : "todo";
  return [
    { label: "Brief sent", detail: "Fault, live probe evidence and the plugin contract", state: "done" },
    { label: "Writing the repair", detail: "A new fix plugin plus tests, in a cloud session", state: writing },
    { label: "Pull request opened", detail: "Uplink loads it on the next fault", state: r.status === "finished" ? "done" : "todo" },
  ];
}

const TONE: Record<StepState, string> = {
  done: "#34d399",
  current: "#38e1ff",
  todo: "rgb(255 255 255 / 0.18)",
  failed: "#ff4d6d",
};

export function DevinPanel({
  repair,
  startedAt,
  now,
  lastRepair,
  hadPlaybook = false,
}: {
  repair: RepairState;
  startedAt: number;
  now: number;
  lastRepair?: RepairState | null;
  hadPlaybook?: boolean;
}) {
  const done = repair.status === "finished";
  const failed = repair.status === "failed";
  // While this session is still at work, show the last fix Devin actually shipped.
  const previous = !done && !failed && lastRepair?.prUrl && lastRepair.id !== repair.id ? lastRepair : null;
  const heading = done
    ? "Devin wrote the fix"
    : repair.status === "queued"
      ? "No internet — queued for Devin"
      : failed
      ? "Devin couldn't write a fix — needs a human"
      : hadPlaybook
        ? "The playbook didn't fix it — Devin is writing a better repair"
        : "No playbook for this fault — Devin is writing one";
  const end = done ? Date.parse(repair.updatedAt) : now;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-7"
      data-testid="devin-panel"
      data-status={repair.status}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bot className="h-4 w-4 text-accent" />
          <span className="label !text-accent/80">Devin · repair session</span>
        </div>
        <span className="font-mono text-[13px] tabular text-white/50">{formatDuration(Math.max(0, end - startedAt))}</span>
      </div>
      <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
        {heading}
      </h2>

      <ol className="mt-6 space-y-4">
        {repairSteps(repair).map((s) => (
          <li key={s.label} className="flex items-start gap-3.5" data-state={s.state}>
            <span className="relative mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border" style={{ borderColor: TONE[s.state] }}>
              {s.state === "current" && <span className="halo absolute inset-0 rounded-full border" style={{ borderColor: TONE[s.state] }} />}
              {s.state === "done" ? (
                <Check className="h-3.5 w-3.5" style={{ color: TONE.done }} strokeWidth={2.5} />
              ) : s.state === "failed" ? (
                <X className="h-3.5 w-3.5" style={{ color: TONE.failed }} strokeWidth={2.5} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[s.state] }} />
              )}
            </span>
            <div>
              <div className={`text-[16px] font-medium ${s.state === "todo" ? "text-white/35" : "text-white/90"}`}>{s.label}</div>
              <div className="text-[13px] text-white/40">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap gap-2.5">
        {repair.url && (
          <a
            href={repair.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-1.5 font-mono text-[12px] text-white/70 transition hover:border-accent/50 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Watch the session
          </a>
        )}
        {repair.prUrl && (
          <motion.a
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            href={repair.prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-3.5 py-1.5 font-mono text-[12px] text-ok transition hover:bg-ok/20"
            data-testid="devin-pr"
          >
            <GitPullRequest className="h-3.5 w-3.5" /> {repair.prUrl.replace(/^https:\/\/github\.com\//, "")}
          </motion.a>
        )}
      </div>
      {previous && (
        <a
          href={previous.prUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-ok/30"
          data-testid="devin-last-pr"
        >
          <GitPullRequest className="h-4 w-4 shrink-0 text-ok" />
          <div className="min-w-0">
            <div className="text-[13px] text-white/50">Devin’s last repair</div>
            <div className="truncate font-mono text-[12px] text-ok">{previous.prUrl!.replace(/^https:\/\/github\.com\//, "")}</div>
          </div>
        </a>
      )}
    </motion.section>
  );
}
