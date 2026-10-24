import type { CallState, FaultCode, Health, Incident, IncidentStatus, NodeId, Probe, Snapshot } from "../../lib/types";
import { NODE_ORDER } from "../../lib/types";

export const HEALTH_HEX: Record<Health, string> = {
  ok: "#34d399",
  degraded: "#fbbf24",
  down: "#ff4d6d",
  unknown: "#5b6577",
};

export const HEALTH_LABEL: Record<Health, string> = {
  ok: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

export const NODE_LABEL: Record<NodeId, string> = {
  device: "This laptop",
  wifi: "Wi-Fi",
  router: "Router",
  dns: "DNS",
  isp: "ISP",
  internet: "Internet",
};

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** 75_000 -> "01:15", 3_725_000 -> "1:02:05" */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Human duration: "42s", "1m 35s", "1h 0m" */
export function formatSpan(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function formatUsd(usd: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd);
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** "+15555550100" -> "+1 (555) 555-0100"; anything else is returned as-is. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** Main label for a link: latency, else the probe's detail (e.g. "-54 dBm"). */
export function linkLabel(p: Probe | undefined): string {
  if (!p) return "—";
  if (p.latencyMs != null) return `${p.latencyMs < 10 ? p.latencyMs.toFixed(1) : Math.round(p.latencyMs)} ms`;
  // Interface chatter ("associated on en0", "172.20.10.1 via en0") isn't worth the space.
  if (p.status === "ok" && p.detail && /\b(en\d+|via|associated)\b/.test(p.detail)) return "";
  // Long probe details ("SYN sent, no reply after 10 s") don't fit between two nodes.
  if (p.detail && p.detail.length <= 14) return p.detail;
  return p.status === "down" ? "no reply" : p.status === "degraded" ? "slow" : (p.detail ?? "—");
}

export function formatLoss(lossPct: number): string {
  return `${Math.round(lossPct)}% loss`;
}

/** The probe that measures the link into `node` (the first one wins). */
export function probeFor(probes: Probe[], node: NodeId): Probe | undefined {
  return probes.find((p) => p.node === node);
}

/** Index in NODE_ORDER of the first node that is down, or -1 when the chain is up. */
export function failingNode(nodes: Snapshot["nodes"]): number {
  return NODE_ORDER.findIndex((n) => nodes[n] === "down");
}

export const RESOLVE_PATH: IncidentStatus[] = ["detected", "diagnosing", "fixing", "resolved"];
export const ESCALATE_PATH: IncidentStatus[] = ["detected", "diagnosing", "fixing", "escalating", "calling", "informing", "ticketed"];

export const STEP_LABEL: Record<IncidentStatus, string> = {
  detected: "Detected",
  diagnosing: "Diagnosing",
  fixing: "Fixing",
  resolved: "Resolved",
  escalating: "Escalating",
  calling: "Calling ISP",
  informing: "Updating you",
  ticketed: "Ticketed",
  needs_human: "Needs a human",
};

export type StepState = "done" | "current" | "todo";

export function isEscalated(incident: Pick<Incident, "status" | "call" | "diagnosis">): boolean {
  return Boolean(incident.call) || incident.diagnosis?.blame === "isp" || ESCALATE_PATH.slice(3).includes(incident.status);
}

/** The steps to render for a status, plus the state of each one. */
export function stepsFor(status: IncidentStatus, escalated = false): { id: IncidentStatus; state: StepState }[] {
  const path =
    status === "needs_human"
      ? [...RESOLVE_PATH.slice(0, 3), "needs_human" as const]
      : escalated || ESCALATE_PATH.slice(3).includes(status)
        ? ESCALATE_PATH
        : RESOLVE_PATH;
  const idx = path.indexOf(status);
  const terminal = isTerminal(status);
  return path.map((id, i) => ({
    id,
    state: i < idx || (terminal && i === idx) ? "done" : i === idx ? "current" : "todo",
  }));
}

export function isTerminal(status: IncidentStatus): boolean {
  return status === "resolved" || status === "ticketed" || status === "needs_human";
}

export function isCallLive(call: CallState): boolean {
  return call.status === "in-progress";
}

export function isCallPending(call: CallState): boolean {
  return call.status === "queued" || call.status === "ringing";
}

/** Elapsed call time; freezes once the call has ended. */
export function callElapsed(call: CallState, now: number): number {
  const start = Date.parse(call.startedAt);
  if (call.endedAt) return Date.parse(call.endedAt) - start;
  if (call.status === "ended" || call.status === "failed") {
    const last = call.transcript.at(-1);
    return (last ? Date.parse(last.at) : start) - start;
  }
  return now - start;
}

const FAULT_TITLE: Record<FaultCode, string> = {
  IPV6_BLACKHOLE: "IPv6 traffic is being dropped",
  WIFI_DISCONNECTED: "Wi-Fi is disconnected",
  DHCP_NO_LEASE: "No IP address from the router",
  GATEWAY_UNREACHABLE: "Router is unreachable",
  DNS_RESOLVER_DOWN: "DNS is not answering",
  ISP_UPSTREAM_LOSS: "Internet provider is dropping traffic",
  ISP_OUTAGE: "Internet provider outage",
  SLOW_SPEED: "Internet is slow",
  UNKNOWN: "Network fault",
};

export function incidentTitle(incident: Pick<Incident, "diagnosis">): string {
  return incident.diagnosis ? FAULT_TITLE[incident.diagnosis.fault] : "Investigating a network fault";
}

/** When the incident ended (last timeline event), or null while still open. */
export function incidentEnd(incident: Incident): number | null {
  if (!isTerminal(incident.status)) return null;
  const last = incident.timeline.at(-1);
  return last ? Date.parse(last.at) : null;
}

/** "router-reboot" -> "Router reboot" */
export function humanize(id: string): string {
  const s = id.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface HistoryStats {
  handled: number;
  autoFixed: number;
  calls: number;
  creditsUsd: number;
}

export function historyStats(history: Incident[]): HistoryStats {
  return {
    handled: history.length,
    autoFixed: history.filter((h) => h.status === "resolved").length,
    calls: history.filter((h) => h.call).length,
    creditsUsd: history.reduce((sum, h) => sum + (h.call?.outcome?.creditUsd ?? 0), 0),
  };
}
