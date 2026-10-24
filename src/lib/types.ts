// Uplink shared contracts. Every slice builds against these types.
// Owned by the integrator. Devin slices must NOT edit this file;
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
  | "IPV6_BLACKHOLE"
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
  | "informing" // support call done; phoning the customer with the update
  | "ticketed" // call finished with an outcome
  | "needs_human"; // fixes only rehearsed (dry run), or Devin unavailable / couldn't fix it

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
  cause?: string; // what the provider says is wrong, e.g. "area outage" or "unpaid bill"
  customerAction?: string; // what the customer has to do, if anything, e.g. "pay the overdue $129 bill"
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

/** A Devin session Uplink started to write a repair plugin for a fault it couldn't fix. */
export interface RepairState {
  id: string;
  url: string; // the live Devin session
  status: "queued" | "starting" | "working" | "blocked" | "finished" | "failed"; // queued = no internet yet
  prUrl?: string;
  title?: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  startedAt: string;
  status: IncidentStatus;
  simulated: boolean; // true when injected by demo mode (shown honestly on screen)
  diagnosis?: Diagnosis;
  fixes: FixResult[];
  call?: CallState;
  debrief?: CallState; // the follow-up call that tells the customer what the provider said
  callAt?: string; // when Uplink will phone the provider if the outage hasn't cleared
  clearedAt?: string; // a finished incident whose network has since been healthy
  repair?: RepairState; // set when Uplink asked Devin to write a new fix
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
  lastRepair?: RepairState | null; // newest Devin repair that opened a PR (from the Devin API)
  llm?: LocalModelState;
  terminal?: TerminalLine[];
  outage?: boolean; // the demo's real outage switch is on
  calling?: boolean; // the calling switch: off means no phone rings
  watchdog?: WatchdogState;
}

/** The cloud watchdog: places the provider call if the house goes completely dark. */
export interface WatchdogState {
  enabled: boolean;
  quietSeconds: number;
  lastOk?: number; // last check-in the cloud acknowledged
  called?: CloudCall | null; // a call the cloud placed while we were offline
  acked?: string;
  owned?: string; // the provider call on screen whose customer update the cloud makes, not Uplink
  ownedCloud?: string; // the cloud call that update belongs to (news on it arrives with each check-in)
  dismissed?: string; // a cloud call Uplink asked to stand down: the cloud mustn't phone the customer about it
  cloudDebrief?: CloudDebrief | null; // what the cloud did about that customer call
}

/** A provider call the cloud placed while the house was dark. */
export interface CloudCall {
  id: string;
  at: number;
  ok: boolean;
  error?: string;
  ackedAt?: number; // Uplink already picked it up (e.g. before a restart): never taken over twice
  debrief?: CloudDebrief;
}

/** The customer update the cloud placed (or skipped, with no news) after its provider call ended. */
export interface CloudDebrief {
  id?: string;
  at: number;
  ok: boolean;
  pending?: boolean; // the cloud is dialing the customer right now
  skipped?: boolean;
  error?: string;
}

/** The on-device model only runs during an incident: asleep → waking → troubleshooting → done → asleep. */
export interface LocalModelState {
  phase: "asleep" | "waking" | "troubleshooting" | "done";
  model: string;
  since: string;
}

/** One line of the agent console: the commands Uplink runs and what came back. */
export interface TerminalLine {
  at: string;
  kind: "cmd" | "out" | "err" | "model" | "info";
  text: string;
}
