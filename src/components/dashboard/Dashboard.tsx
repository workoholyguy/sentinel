"use client";

import { motion } from "framer-motion";
import { FlaskConical, PhoneOutgoing } from "lucide-react";
import type { CallState, Incident, StatusResponse } from "../../lib/types";
import { CallPanel } from "./CallPanel";
import { DemoControls } from "./DemoControls";
import { DevinPanel } from "./DevinPanel";
import { DiagnosisCard, FixesList, Stepper } from "./Incident";
import { NetworkMap } from "./NetworkMap";
import { HistoryList, UptimeStats } from "./Sidebar";
import { ActivityPanel, CallCountdown, ModelPill } from "./Console";
import { OutageButton } from "./OutageButton";
import { CallingButton } from "./CallingButton";
import { UplinkMark } from "./UplinkMark";
import { formatClock, formatDuration, incidentEnd, incidentTitle, isEscalated, isTerminal, probeFor } from "./format";
import { type Poll, useNow, useStatusPoll } from "./hooks";

export function Dashboard() {
  const poll = useStatusPoll();
  const { data, connected } = poll;
  const now = useNow();

  // One page that never rearranges: every section is always there; only what's inside changes.
  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-10 py-8">
        <Header data={data} connected={connected} now={now} />
        {!data ? <Boot /> : <Overview data={data} poll={poll} now={now} />}
      </div>
      <DemoControls />
    </main>
  );
}

function Header({ data, connected, now }: { data: StatusResponse | null; connected: boolean; now: number }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <UplinkMark className="h-10 w-10" />
        <div>
          <div className="text-[17px] font-semibold tracking-tight text-white">Uplink</div>
          <div className="text-[13px] text-white/40">
            Network mission control{data ? ` · ${data.profile.planName} · ${data.profile.providerName}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {data && <CallingButton on={data.calling !== false} />}
        {data && <OutageButton active={Boolean(data.outage)} />}
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

// An empty section keeps its place: it says what it will do, instead of disappearing.
function Idle({ label, children, testid }: { label: string; children: React.ReactNode; testid?: string }) {
  return (
    <section className="panel p-6" data-testid={testid}>
      <div className="label">{label}</div>
      <div className="mt-2 text-[15px] leading-snug text-white/40">{children}</div>
    </section>
  );
}

// When Devin was asked for a fix (the orchestrator logs it); falls back to the incident start.
function repairStart(incident: Incident): number {
  const ev = incident.timeline.find((e) => e.text.startsWith("Devin session started"));
  return Date.parse(ev?.at ?? incident.startedAt);
}

function Overview({ data, poll, now }: { data: StatusResponse; poll: Poll; now: number }) {
  const incident = data.incident;
  const provider = data.profile.providerName;
  const customer = data.profile.customerName.split(" ")[0];
  const call = incident?.call;
  return (
    <div className="flex flex-col gap-5" data-testid={incident ? "incident-view" : "healthy-view"}>
      <StatusSection data={data} incident={incident} now={now} />

      <section className="panel px-12 py-8">
        <NetworkMap snapshot={data.snapshot} compact />
      </section>

      {incident?.diagnosis ? (
        <div className="min-h-[220px]">
          <DiagnosisCard diagnosis={incident.diagnosis} />
        </div>
      ) : (
        <Idle label="On-device diagnosis" testid="diagnosis-idle">
          Nothing to diagnose. The local model sleeps until something breaks, then explains it right here — no cloud.
        </Idle>
      )}

      {incident && (incident.fixes.length > 0 || incident.status === "fixing" || incident.repair) ? (
        <FixesList fixes={incident.fixes} status={incident.status} devin={Boolean(incident.repair)} />
      ) : (
        <Idle label="Fixes tried">Nothing to fix. When something on your side breaks, Uplink runs its playbook here and re-checks after each step.</Idle>
      )}

      {call ? (
        <div className={call.outcome ? "h-[820px]" : "h-[480px]"}>
          <CallPanel call={call} provider={provider} now={now} />
        </div>
      ) : incident?.status === "escalating" && incident.callAt ? (
        <section className="panel p-6">
          <div className="label">Call to {provider}</div>
          <CallCountdown incident={incident} provider={provider} now={now} />
        </section>
      ) : (
        <Idle label={`Call to ${provider}`} testid="call-idle">
          Uplink only calls {provider} when the outage is on their side and lasts a few minutes — with the evidence ready.
        </Idle>
      )}

      {incident?.repair ? (
        <DevinPanel
          repair={incident.repair}
          startedAt={repairStart(incident)}
          now={now}
          lastRepair={data.lastRepair}
          hadPlaybook={incident.fixes.length > 0}
        />
      ) : (
        <Idle label="Devin · new repairs" testid="devin-idle">
          When a fault isn’t in the playbook, Devin writes a new repair with tests and opens a pull request.
          {data.lastRepair?.prUrl && (
            <>
              {" "}Last one:{" "}
              <a className="text-ok/80 underline-offset-2 hover:underline" href={data.lastRepair.prUrl} target="_blank" rel="noreferrer">
                {data.lastRepair.prUrl.replace(/^https:\/\/github\.com\//, "")}
              </a>
            </>
          )}
        </Idle>
      )}

      {incident?.debrief ? (
        <CustomerUpdate call={incident.debrief} name={data.profile.customerName} cause={call?.outcome?.cause} action={call?.outcome?.customerAction} />
      ) : (
        <Idle label="Customer update" testid="customer-idle">
          After the call with {provider}, Uplink phones {customer} with what’s wrong and what happens next.
        </Idle>
      )}

      <ActivityPanel events={incident?.timeline} startedAt={incident?.startedAt} terminal={data.terminal ?? []} className="h-[320px]" />

      <UptimeStats history={data.history} uptimePct={poll.uptimePct} healthySince={poll.healthySince} now={now} />
      <HistoryList items={data.history} now={now} />
    </div>
  );
}

function StatusSection({ data, incident, now }: { data: StatusResponse; incident: Incident | null; now: number }) {
  if (!incident) {
    const nodes = Object.values(data.snapshot.nodes);
    const healthy = nodes.filter((h) => h === "ok").length;
    const rtt = probeFor(data.snapshot.probes, "internet")?.latencyMs;
    return (
      <section className="panel p-7">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-ok" />
              <span className="label !text-ok/80">All clear</span>
            </div>
            <h1 className="mt-2 text-[36px] font-semibold leading-tight tracking-[-0.025em]">All systems normal</h1>
            <p className="mt-1 text-[15px] text-white/45">
              {healthy} of {nodes.length} hops healthy · checked every 1.5 s · diagnosed on-device
            </p>
          </div>
          <div className="text-right">
            <div className="label">Round trip to internet</div>
            <div className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular">
              {rtt != null ? Math.round(rtt) : "—"}
              <span className="ml-1 text-[18px] text-white/40">ms</span>
            </div>
          </div>
        </div>
        <div className="mt-7 opacity-40">
          <Stepper status="detected" escalated={false} idle />
        </div>
      </section>
    );
  }
  const t0 = Date.parse(incident.startedAt);
  const ended = incidentEnd(incident);
  const end = ended ?? now;
  const done = isTerminal(incident.status);
  const human = incident.status === "needs_human";
  const informing = incident.status === "informing";
  return (
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
          <p className="mt-1 text-[15px] text-white/45">{incident.simulated ? "Simulated for the demo · real pipeline" : "Detected on your network"}</p>
        </div>
        <div className="text-right">
          <div className="label">{ended != null ? (incident.status === "resolved" ? "Resolved in" : "Handled in") : "Elapsed"}</div>
          <div className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular">{formatDuration(end - t0)}</div>
        </div>
      </div>
      <div className="mt-7">
        <Stepper status={incident.status} escalated={isEscalated(incident)} />
      </div>
    </section>
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
