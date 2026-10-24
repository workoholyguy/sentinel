"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, PhoneCall } from "lucide-react";
import type { Incident, TimelineEvent } from "../../lib/types";
import { formatAgo, formatDuration, formatSpan, formatUsd, historyStats, incidentEnd, incidentTitle } from "./format";

export function Timeline({ events, startedAt, className = "" }: { events: TimelineEvent[]; startedAt: string; className?: string }) {
  const t0 = Date.parse(startedAt);
  // newest first; keep the original index as a stable key (events are append-only)
  const sorted = events.map((e, i) => ({ e, i })).reverse();
  return (
    <div className={`panel flex min-h-0 flex-col p-6 ${className}`} data-testid="timeline">
      <div className="label">Timeline</div>
      <ol className="scroll-thin relative mt-4 min-h-0 flex-1 space-y-3.5 overflow-y-auto">
        <AnimatePresence initial={false}>
          {sorted.map(({ e, i }, pos) => (
            <motion.li
              key={i}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-[64px_12px_1fr] items-start gap-3"
              data-kind={e.kind}
            >
              <span className="pt-px font-mono text-[12px] tabular text-white/40">T+{formatDuration(Date.parse(e.at) - t0)}</span>
              <span className={`mt-[6px] h-2 w-2 rounded-full ${pos === 0 ? "bg-accent shadow-[0_0_10px_#38e1ff]" : "bg-white/20"}`} />
              <span className={`text-[14px] leading-snug ${pos === 0 ? "text-white/90" : "text-white/55"}`}>{e.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {events.length === 0 && <li className="text-[14px] text-white/35">Waiting for the first probe…</li>}
      </ol>
    </div>
  );
}

export function HistoryList({ items, now, className = "" }: { items: Incident[]; now: number; className?: string }) {
  return (
    <div className={`panel p-6 ${className}`} data-testid="history">
      <div className="label">Recent incidents</div>
      <ul className="mt-3 divide-y divide-white/[0.05]">
        {items.slice(0, 4).map((h) => {
          const end = incidentEnd(h);
          const called = Boolean(h.call);
          return (
            <li key={h.id} className="flex items-center gap-3 py-3">
              {called ? <PhoneCall className="h-4 w-4 shrink-0 text-accent" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] text-white/85">{incidentTitle(h)}</div>
                <div className="font-mono text-[11px] text-white/35">
                  {formatAgo(now - Date.parse(h.startedAt))}
                  {end != null && ` · ${formatSpan(end - Date.parse(h.startedAt))}`}
                  {h.simulated && " · simulated"}
                </div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-label text-white/40">
                {called
                  ? (h.call?.outcome?.ticketNumber ?? "ISP called")
                  : h.repair?.status === "finished"
                    ? "Devin fixed"
                    : h.status === "resolved"
                      ? "Auto-fixed"
                      : "Closed"}
              </span>
            </li>
          );
        })}
        {items.length === 0 && <li className="py-3 text-[15px] text-white/35">No incidents yet — quiet network.</li>}
      </ul>
    </div>
  );
}

export function UptimeStats({
  history,
  uptimePct,
  healthySince,
  now,
}: {
  history: Incident[];
  uptimePct: number;
  healthySince: number | null;
  now: number;
}) {
  const h = historyStats(history);
  const stats = [
    { label: "Uptime · this session", value: `${uptimePct.toFixed(uptimePct === 100 ? 0 : 1)}%` },
    { label: "Healthy for", value: healthySince == null ? "—" : formatSpan(now - healthySince) },
    { label: "Fixed automatically", value: `${h.autoFixed}/${h.handled}` },
    { label: "Credits recovered", value: formatUsd(h.creditsUsd) },
  ];
  return (
    <div className="grid grid-cols-4 gap-5" data-testid="uptime">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.06 }}
          className="panel p-6"
        >
          <div className="label">{s.label}</div>
          <div className="mt-3 text-[44px] font-semibold leading-none tracking-tighter tabular">{s.value}</div>
        </motion.div>
      ))}
    </div>
  );
}
