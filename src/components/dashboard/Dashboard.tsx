"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical } from "lucide-react";
import type { Incident, StatusResponse } from "../../lib/types";
import { CallPanel } from "./CallPanel";
import { DemoControls } from "./DemoControls";
import { DiagnosisCard, FixesList, Stepper } from "./Incident";
import { NetworkMap } from "./NetworkMap";
import { HistoryList, Timeline, UptimeStats } from "./Sidebar";
import { formatClock, formatDuration, incidentEnd, incidentTitle, isEscalated, isTerminal, probeFor } from "./format";
import { type Poll, useNow, useStatusPoll } from "./hooks";

const AMBIENT = { calm: "56 225 255", alert: "255 77 109", good: "52 211 153" };

export function Dashboard() {
  const poll = useStatusPoll();
  const { data, connected } = poll;
  const now = useNow();
  const incident = data?.incident ?? null;
  const mood = !incident ? "calm" : isTerminal(incident.status) ? "good" : "alert";

  return (
    <main className="relative h-screen w-screen overflow-hidden" style={{ ["--ambient" as string]: AMBIENT[mood] }}>
      <div className="ambient pointer-events-none absolute inset-0" />
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex h-full max-w-[1920px] flex-col gap-7 px-12 py-9">
        <Header data={data} connected={connected} now={now} />
        {!data ? (
          <Boot />
        ) : (
          <AnimatePresence mode="wait">
            {incident ? (
              <motion.div
                key="incident"
                className="min-h-0 flex-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
              >
                <IncidentView data={data} incident={incident} now={now} />
              </motion.div>
            ) : (
              <motion.div
                key="healthy"
                className="min-h-0 flex-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
              >
                <HealthyView data={data} poll={poll} now={now} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <DemoControls />
    </main>
  );
}

function Header({ data, connected, now }: { data: StatusResponse | null; connected: boolean; now: number }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative grid h-10 w-10 place-items-center">
          <span className="breathe absolute inset-0 rounded-full border border-accent/60" />
          <span className="h-3 w-3 rounded-full bg-accent shadow-[0_0_18px_#38e1ff]" />
        </div>
        <div>
          <div className="font-mono text-[15px] font-semibold tracking-[0.42em] text-white">SENTINEL</div>
          <div className="text-[13px] text-white/40">
            Network mission control{data ? ` · ${data.profile.planName} · ${data.profile.providerName}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {data?.incident?.simulated && <SimulatedTag />}
        <div className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-label">
          <span className={`h-2 w-2 rounded-full ${connected ? "alarm bg-ok" : "bg-warn"}`} />
          <span className={connected ? "text-white/55" : "text-warn"}>{connected ? "Live" : "Reconnecting"}</span>
        </div>
        <div className="font-mono text-[22px] font-light tabular text-white/80" suppressHydrationWarning>
          {formatClock(now)}
        </div>
      </div>
    </header>
  );
}

function SimulatedTag() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-warn"
      data-testid="simulated-tag"
      title="This outage was triggered for the demo"
    >
      <FlaskConical className="h-3.5 w-3.5" /> Simulated outage
    </span>
  );
}

function Boot() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex items-center gap-3 font-mono text-sm uppercase tracking-label text-white/40">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        Connecting to Sentinel
      </div>
    </div>
  );
}

function HealthyView({ data, poll, now }: { data: StatusResponse; poll: Poll; now: number }) {
  const nodes = Object.values(data.snapshot.nodes);
  const healthy = nodes.filter((h) => h === "ok").length;
  const rtt = probeFor(data.snapshot.probes, "internet")?.latencyMs;
  return (
    <div className="flex h-full flex-col gap-7" data-testid="healthy-view">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ok shadow-[0_0_14px_#34d399]" />
            <span className="label !text-ok/80">Status</span>
          </div>
          <h1 className="mt-3 text-[88px] font-semibold leading-[0.95] tracking-[-0.045em]">All systems normal</h1>
          <p className="mt-4 text-xl text-white/45">
            {healthy} of {nodes.length} hops healthy · checked every second · diagnosed on-device
          </p>
        </div>
        <div className="pb-3 text-right">
          <div className="label">Round trip to internet</div>
          <div className="mt-2 font-mono text-[56px] font-light leading-none tabular text-white">
            {rtt != null ? Math.round(rtt) : "—"}
            <span className="ml-1 text-2xl text-white/40">ms</span>
          </div>
        </div>
      </div>
      <div className="panel flex flex-1 items-center px-20 py-10">
        <NetworkMap snapshot={data.snapshot} />
      </div>
      <div className="grid grid-cols-[1fr_440px] gap-5">
        <UptimeStats history={data.history} uptimePct={poll.uptimePct} healthySince={poll.healthySince} now={now} />
        <HistoryList items={data.history.slice(0, 2)} now={now} className="!py-4" />
      </div>
    </div>
  );
}

function IncidentView({ data, incident, now }: { data: StatusResponse; incident: Incident; now: number }) {
  const t0 = Date.parse(incident.startedAt);
  const ended = incidentEnd(incident);
  const end = ended ?? now;
  const done = isTerminal(incident.status);
  const escalated = isEscalated(incident);
  const call = incident.call;

  return (
    <div className="grid h-full grid-cols-12 gap-6" data-testid="incident-view">
      <div className="col-span-8 flex min-h-0 flex-col gap-6">
        <section className="panel p-7">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${done ? "bg-ok" : "alarm bg-bad"}`} />
                <span className={`label ${done ? "!text-ok/80" : "!text-bad/90"}`}>
                  {done ? (incident.status === "ticketed" ? "Escalated · ticket open" : "Resolved") : "Active incident"}
                </span>
              </div>
              <h1 className="mt-2 text-[44px] font-semibold leading-none tracking-[-0.035em]">{incidentTitle(incident)}</h1>
            </div>
            <div className="text-right">
              <div className="label">{ended != null ? (incident.status === "resolved" ? "Resolved in" : "Handled in") : "Elapsed"}</div>
              <div className="mt-1 font-mono text-[40px] font-light leading-none tabular">{formatDuration(end - t0)}</div>
            </div>
          </div>
          <div className="mt-7">
            <Stepper status={incident.status} escalated={escalated} />
          </div>
        </section>

        <section className="panel flex items-center px-14 py-7">
          <NetworkMap snapshot={data.snapshot} compact />
        </section>

        <div className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-6">
          <DiagnosisCard diagnosis={incident.diagnosis} />
          <div className="flex min-h-0 flex-col gap-6">
            <FixesList fixes={incident.fixes} status={incident.status} />
            {call && <Timeline events={incident.timeline} startedAt={incident.startedAt} className="flex-1" />}
            {!call && <HistoryList items={data.history} now={now} className="flex-1" />}
          </div>
        </div>
      </div>

      <div className="col-span-4 min-h-0">
        {call ? (
          <CallPanel call={call} provider={data.profile.providerName} now={now} />
        ) : (
          <Timeline events={incident.timeline} startedAt={incident.startedAt} className="h-full" />
        )}
      </div>
    </div>
  );
}
