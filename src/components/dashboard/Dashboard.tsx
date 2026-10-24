"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, PhoneOutgoing } from "lucide-react";
import type { CallState, Incident, StatusResponse } from "../../lib/types";
import { CallPanel } from "./CallPanel";
import { DemoControls } from "./DemoControls";
import { DevinPanel } from "./DevinPanel";
import { DiagnosisCard, FixesList, Stepper } from "./Incident";
import { NetworkMap } from "./NetworkMap";
import { HistoryList, UptimeStats } from "./Sidebar";
import { ActivityPanel, CallCountdown, ModelPill } from "./Console";
import { formatClock, formatDuration, incidentEnd, incidentTitle, isEscalated, isTerminal, probeFor } from "./format";
import { type Poll, useNow, useStatusPoll } from "./hooks";

const AMBIENT = { calm: "56 225 255", alert: "255 77 109", good: "52 211 153", warn: "251 191 36" };

export function Dashboard() {
  const poll = useStatusPoll();
  const { data, connected } = poll;
  const now = useNow();
  const incident = data?.incident ?? null;
  const mood = !incident
    ? "calm"
    : incident.status === "needs_human"
      ? "warn"
      : isTerminal(incident.status) || incident.status === "informing"
        ? "good"
        : "alert";

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
          <span className="h-3 w-3 rounded-full bg-accent " />
        </div>
        <div>
          <div className="text-[17px] font-semibold tracking-tight text-white">Uplink</div>
          <div className="text-[13px] text-white/40">
            Network mission control{data ? ` · ${data.profile.planName} · ${data.profile.providerName}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {data?.incident?.simulated && <SimulatedTag />}
        <div className="flex items-center gap-2 font-mono text-[12px]">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-ok" : "bg-warn"}`} />
          <span className={connected ? "text-white/55" : "text-warn"}>{connected ? "Live" : "Reconnecting"}</span>
        </div>
        <ModelPill llm={data?.llm} />
        <div className="text-[15px] font-medium tabular text-white/60" suppressHydrationWarning>
          {formatClock(now)}
        </div>
      </div>
    </header>
  );
}

function SimulatedTag() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-3 py-1 font-mono text-[11px] text-warn"
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
      <div className="flex items-center gap-3 font-mono text-sm text-white/40">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        Connecting to Uplink
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
            <span className="h-2.5 w-2.5 rounded-full bg-ok " />
            <span className="label !text-ok/80">Status</span>
          </div>
          <h1 className="mt-2 text-[48px] font-semibold leading-none tracking-[-0.03em]">All systems normal</h1>
          <p className="mt-3 text-[16px] text-white/45">
            {healthy} of {nodes.length} hops healthy · checked every 1.5 s · diagnosed on-device
          </p>
        </div>
        <div className="pb-3 text-right">
          <div className="label">Round trip to internet</div>
          <div className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular text-white">
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
        <ActivityPanel terminal={data.terminal ?? []} className="h-[200px]" />
      </div>
    </div>
  );
}

// When Devin was asked for a fix (the orchestrator logs it); falls back to the incident start.
function repairStart(incident: Incident): number {
  const ev = incident.timeline.find((e) => e.text.startsWith("Devin session started"));
  return Date.parse(ev?.at ?? incident.startedAt);
}

function IncidentView({ data, incident, now }: { data: StatusResponse; incident: Incident; now: number }) {
  const t0 = Date.parse(incident.startedAt);
  const ended = incidentEnd(incident);
  const end = ended ?? now;
  const done = isTerminal(incident.status);
  const human = incident.status === "needs_human";
  const informing = incident.status === "informing";
  const escalated = isEscalated(incident);
  const call = incident.call;

  return (
    <div className="grid h-full grid-cols-12 gap-6" data-testid="incident-view">
      <div className="col-span-8 flex min-h-0 flex-col gap-6">
        <section className="panel p-7">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${human ? "bg-warn" : done || informing ? "bg-ok" : "bg-bad"}`} />
                <span className={`label ${human ? "!text-warn/90" : done || informing ? "!text-ok/80" : "!text-bad/90"}`}>
                  {human
                    ? "Needs a human"
                    : informing
                      ? `Ticket open · updating ${data.profile.customerName.split(" ")[0]}`
                      : done
                        ? incident.status === "ticketed"
                          ? "Escalated · ticket open"
                          : "Resolved"
                        : "Active incident"}
                </span>
              </div>
              <h1 className="mt-2 text-[36px] font-semibold leading-tight tracking-[-0.025em]">{incidentTitle(incident)}</h1>
            </div>
            <div className="text-right">
              <div className="label">{ended != null ? (incident.status === "resolved" ? "Resolved in" : "Handled in") : "Elapsed"}</div>
              <div className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular">{formatDuration(end - t0)}</div>
            </div>
          </div>
          <div className="mt-7">
            <Stepper status={incident.status} escalated={escalated} />
            <CallCountdown incident={incident} provider={data.profile.providerName} now={now} />
          </div>
        </section>

        <section className="panel flex items-center px-14 py-7">
          <NetworkMap snapshot={data.snapshot} compact />
        </section>

        <div className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-6">
          <DiagnosisCard diagnosis={incident.diagnosis} />
          <div className="flex min-h-0 flex-col gap-6">
            <FixesList fixes={incident.fixes} status={incident.status} devin={Boolean(incident.repair)} />
            {incident.debrief && <CustomerUpdate call={incident.debrief} name={data.profile.customerName} cause={call?.outcome?.cause} action={call?.outcome?.customerAction} />}
            {call && <ActivityPanel events={incident.timeline} startedAt={incident.startedAt} terminal={data.terminal ?? []} className="flex-1" />}
            {!call && <HistoryList items={data.history} now={now} className="flex-1" />}
          </div>
        </div>
      </div>

      <div className="col-span-4 min-h-0">
        {call ? (
          <CallPanel call={call} provider={data.profile.providerName} now={now} />
        ) : incident.repair ? (
          <div className="flex h-full min-h-0 flex-col gap-6">
            <DevinPanel
              repair={incident.repair}
              startedAt={repairStart(incident)}
              now={now}
              lastRepair={data.lastRepair}
              hadPlaybook={incident.fixes.length > 0}
            />
            <ActivityPanel events={incident.timeline} startedAt={incident.startedAt} terminal={data.terminal ?? []} className="flex-1" />
          </div>
        ) : (
          <ActivityPanel events={incident.timeline} startedAt={incident.startedAt} terminal={data.terminal ?? []} className="h-full" />
        )}
      </div>
    </div>
  );
}

// The follow-up call that tells the customer what the provider said.
function CustomerUpdate({ call, name, cause, action }: { call: CallState; name: string; cause?: string; action?: string }) {
  const first = name.split(" ")[0];
  const done = call.status === "ended";
  const failed = call.status === "failed";
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-6" data-testid="customer-update">
      <div className="flex items-center gap-2.5">
        <PhoneOutgoing className={`h-4 w-4 ${failed ? "text-warn" : "text-accent"} ${done || failed ? "" : "animate-pulse"}`} />
        <span className="label">Customer update</span>
      </div>
      <div className="mt-2 text-[17px] font-medium text-white/90">
        {done ? `${first} is up to date` : failed ? `Couldn't reach ${first}` : `Calling ${first} with the update…`}
      </div>
      {(cause || action) && (
        <div className="mt-1 text-[13px] leading-snug text-white/50">
          {cause ? `Cause: ${cause}.` : ""} {action ? `Needs to: ${action}.` : ""}
        </div>
      )}
    </motion.section>
  );
}
