// Sentinel shared contracts. Every slice builds against these types.
// Owned by the integrator (Claude Code). Devin slices must NOT edit this file;
// if a slice needs a change, note it in the PR description instead.

export type Health = "ok" | "degraded" | "down" | "unknown";

/** The chain a packet travels, left to right on the dashboard map. */
export type NodeId = "device" | "wifi" | "router" | "dns" | "isp" | "internet";
export const NODE_ORDER: NodeId[] = ["device", "wifi", "router", "dns", "isp", "internet"];

/** One measurement from the monitor. */
export interface Probe {
  id: string; // e.g. "ping-gateway", "dns-system", "http-cloudflare"
  node: NodeId;
  label: string; // human label, e.g. "Gateway ping 192.168.1.1"
  status: Health;
  latencyMs?: number;
  lossPct?: number;
  detail?: string;
  at: string; // ISO time
}

export interface Snapshot {
  at: string;
  probes: Probe[];
  nodes: Record<NodeId, Health>;
}

export type FaultCode =
  | "WIFI_DISCONNECTED"
  | "DHCP_NO_LEASE"
  | "GATEWAY_UNREACHABLE"
  | "DNS_RESOLVER_DOWN"
  | "ISP_UPSTREAM_LOSS"
  | "ISP_OUTAGE"
  | "SLOW_SPEED"
  | "UNKNOWN";

/** Who is responsible: decides fix-it-ourselves vs call the provider. */
export type Blame = "local" | "router" | "isp" | "unknown";

export interface Diagnosis {
  fault: FaultCode;
  blame: Blame;
  confidence: number; // 0..1
  summary: string; // one line, e.g. "DNS resolver 10.255.255.1 is not answering; internet path is fine"
  evidence: string[]; // short facts with numbers, used on screen and on the call
  explanation?: string; // plain-English explanation written by the LOCAL model (offline)
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface FixContext {
  platform: "darwin" | "linux";
  dryRun: boolean;
  /** Runs a command. In dryRun the implementation records it and returns code 0. */
  exec(cmd: string, args: string[]): Promise<ExecResult>;
}

export interface FixResult {
  pluginId: string;
  ok: boolean;
  actions: string[]; // commands / steps taken, human readable
  detail?: string;
}

export interface FixPlugin {
  id: string; // e.g. "dns-switch-resolver"
  title: string; // e.g. "Switch to a healthy DNS resolver"
  handles: FaultCode[];
  platforms: Array<"darwin" | "linux">;
  run(ctx: FixContext): Promise<FixResult>;
}

export type IncidentStatus =
  | "detected"
  | "diagnosing"
  | "fixing"
  | "resolved" // fixed locally
  | "escalating" // provider's fault, preparing the call
  | "calling"
  | "ticketed"; // call finished with an outcome

export interface TimelineEvent {
  at: string;
  kind: "probe" | "diagnosis" | "fix" | "call" | "notify" | "info";
  text: string;
}

export interface CallTurn {
  at: string;
  speaker: "agent" | "rep";
  text: string;
}

export interface CallOutcome {
  ticketNumber?: string;
  creditUsd?: number;
  technicianWindow?: string;
  summary: string;
}

export type CallStatus = "queued" | "ringing" | "in-progress" | "ended" | "failed";

export interface CallState {
  id: string;
  status: CallStatus;
  to: string; // E.164
  startedAt: string;
  endedAt?: string;
  transcript: CallTurn[];
  outcome?: CallOutcome;
}

export interface Incident {
  id: string;
  startedAt: string;
  status: IncidentStatus;
  simulated: boolean; // true when injected by demo mode (shown honestly on screen)
  diagnosis?: Diagnosis;
  fixes: FixResult[];
  call?: CallState;
  timeline: TimelineEvent[];
}

/** The customer's account with their internet provider (demo values in src/lib/profile.ts). */
export interface ProviderProfile {
  providerName: string; // e.g. "Peachtree Fiber"
  supportNumber: string; // E.164 — in the demo, Omar's phone plays the call center
  customerName: string;
  accountNumber: string;
  serviceAddress: string;
  planName: string;
  monthlyPriceUsd: number;
  callbackNumber: string;
}

/** GET /api/status response — the dashboard polls this every second. */
export interface StatusResponse {
  snapshot: Snapshot;
  incident: Incident | null;
  history: Incident[];
  profile: ProviderProfile;
}
