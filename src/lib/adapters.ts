// Integration seam between the orchestrator and the slices Devin is building.
// Until a slice's PR merges, its stand-in lives here; after the merge, swap in the real import.
import type { CallState, Diagnosis, FaultCode, FixContext, FixResult, Incident, ProviderProfile, Snapshot } from "./types";
import { healthySnapshot } from "./mock";

// ---- Slice A: monitor + diagnose -------------------------------------------------------
export async function sampleNetwork(): Promise<Snapshot> {
  return { ...healthySnapshot, at: new Date().toISOString() };
}

export function diagnoseSnapshot(s: Snapshot): Diagnosis | null {
  const bad = (n: keyof Snapshot["nodes"]) => s.nodes[n] === "down" || s.nodes[n] === "degraded";
  if (bad("isp") && !bad("router")) {
    const isp = s.probes.find((p) => p.node === "isp");
    const gw = s.probes.find((p) => p.node === "router");
    return {
      fault: s.nodes.isp === "down" && bad("internet") ? "ISP_UPSTREAM_LOSS" : "ISP_UPSTREAM_LOSS",
      blame: "isp",
      confidence: 0.93,
      summary: "Packet loss starts beyond your router, at the provider's edge",
      evidence: [
        `Router answers in ${gw?.latencyMs ?? 3} ms with ${gw?.lossPct ?? 0}% loss — your local network is healthy`,
        `Provider edge: ${isp?.lossPct ?? "?"}% packet loss, ${isp?.latencyMs ?? "?"} ms latency (normal: 0%, 9 ms)`,
      ],
    };
  }
  if (bad("dns") && !bad("router")) {
    return {
      fault: "DNS_RESOLVER_DOWN",
      blame: "local",
      confidence: 0.9,
      summary: "Your DNS resolver isn't answering; the internet itself is reachable",
      evidence: ["Router answers normally", "DNS lookups time out after 2 s", "HTTPS to 1.1.1.1 by IP succeeds"],
    };
  }
  return null;
}

// ---- Slice B: fixes ---------------------------------------------------------------------
export function execContext(dryRun: boolean): FixContext {
  return {
    platform: process.platform === "darwin" ? "darwin" : "linux",
    dryRun,
    exec: async () => ({ code: 0, stdout: "", stderr: "" }),
  };
}

export async function runFixesFor(fault: FaultCode, _ctx: FixContext, _verify: () => Promise<boolean>): Promise<FixResult[]> {
  if (fault === "ISP_UPSTREAM_LOSS" || fault === "ISP_OUTAGE") {
    return [{ pluginId: "router-reboot", ok: false, actions: ["Rebooted router (simulated)"], detail: "Loss persisted after reboot" }];
  }
  return [{ pluginId: "noop", ok: false, actions: [], detail: "Fix plugins not merged yet" }];
}

// ---- Slice C: call agent ----------------------------------------------------------------
const calls = new Map<string, { started: number; incident: Incident; profile: ProviderProfile }>();

export async function startProviderCall(incident: Incident, profile: ProviderProfile): Promise<CallState> {
  const id = `call_${Date.now()}`;
  calls.set(id, { started: Date.now(), incident, profile });
  return { id, status: "ringing", to: profile.supportNumber, startedAt: new Date().toISOString(), transcript: [] };
}

export async function pollProviderCall(id: string): Promise<CallState> {
  const c = calls.get(id);
  const elapsed = c ? (Date.now() - c.started) / 1000 : 999;
  const at = new Date().toISOString();
  const script: Array<[number, "agent" | "rep", string]> = [
    [4, "rep", `Thank you for calling ${c?.profile.providerName ?? "support"}, this is Dana. How can I help?`],
    [8, "agent", `Hi Dana, I'm an AI assistant calling on behalf of ${c?.profile.customerName}, account ${c?.profile.accountNumber}. Their service has heavy packet loss starting at your edge router.`],
    [14, "rep", "Okay. Have you tried restarting your modem?"],
    [19, "agent", "Yes, it was rebooted and the loss persisted. Inside the network everything answers in 3 milliseconds with zero loss, so this is on your side. Can you open a ticket?"],
    [26, "rep", "I see an issue on the node serving that address. Ticket PF-88213, a technician between 3 and 5 today."],
    [31, "agent", "Thank you. Since the service was down during business hours, can you apply a credit for the downtime?"],
    [36, "rep", "I can apply a $4.30 credit to this month's bill."],
  ];
  const transcript = script.filter(([t]) => elapsed >= t).map(([, speaker, text]) => ({ at, speaker, text }));
  const ended = elapsed >= 40;
  return {
    id,
    status: elapsed < 4 ? "ringing" : ended ? "ended" : "in-progress",
    to: c?.profile.supportNumber ?? "",
    startedAt: new Date(c?.started ?? Date.now()).toISOString(),
    endedAt: ended ? at : undefined,
    transcript,
    outcome: ended
      ? { ticketNumber: "PF-88213", technicianWindow: "Today 3–5 PM", creditUsd: 4.3, summary: "Ticket opened, technician dispatched, downtime credit applied." }
      : undefined,
  };
}
