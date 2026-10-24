// Integration seam between the orchestrator and the slices Devin built.
import path from "node:path";
import type { CallState, Diagnosis, FaultCode, FixContext, FixResult, Incident, ProviderProfile, RepairState, Snapshot } from "./types";
import { createMonitor } from "./monitor";
import { diagnose } from "./diagnose";
import { fixesFor, loadExtraPlugins, registry, runFixes } from "./fixes";
import { createExecContext } from "./fixes/exec";
import { getCall, startCall } from "./call";
import { DevinUnreachableError, devinConfigured, getRepairStatus, peekLastRepair, requestRepair } from "./devin";

const platform: "darwin" | "linux" = process.platform === "darwin" ? "darwin" : "linux";

// ---- Slice A: monitor + diagnose -------------------------------------------------------
const monitor = createMonitor({ platform });
const recent: Snapshot[] = [];

export async function sampleNetwork(): Promise<Snapshot> {
  const s = await monitor.sample();
  recent.push(s);
  if (recent.length > 40) recent.shift();
  return s;
}

export function diagnoseSnapshot(s: Snapshot): Diagnosis | null {
  return diagnose(s, recent.filter((r) => r !== s));
}

// ---- Slice B: fixes ---------------------------------------------------------------------
export function execContext(dryRun: boolean): FixContext {
  return createExecContext({ platform, dryRun, sudo: process.env.SENTINEL_SUDO === "1" });
}

// Plugins Devin writes at runtime land in src/lib/fixes/extra and are picked up on the next fault.
const EXTRA_DIR = path.join(process.cwd(), "src", "lib", "fixes", "extra");

async function allPlugins() {
  const extra = await loadExtraPlugins(EXTRA_DIR).catch(() => []);
  return [...registry, ...extra];
}

export async function hasFixFor(fault: FaultCode): Promise<boolean> {
  return fixesFor(fault, platform, await allPlugins()).length > 0;
}

export async function runFixesFor(fault: FaultCode, ctx: FixContext, verify: () => Promise<boolean>): Promise<FixResult[]> {
  return runFixes(fault, ctx, verify, await allPlugins());
}

// ---- Slice C: call agent (Vapi when VAPI_* env is set, otherwise the scripted mock) -----
export async function startProviderCall(incident: Incident, profile: ProviderProfile): Promise<CallState> {
  return startCall(incident, profile);
}

export async function pollProviderCall(id: string): Promise<CallState> {
  return getCall(id);
}

// ---- Slice E: Devin at runtime ----------------------------------------------------------
const REPO = process.env.SENTINEL_REPO ?? "https://github.com/workoholyguy/sentinel";

/**
 * Asks Devin to write a repair. With no internet the request is queued (status "queued")
 * and the orchestrator re-sends it once a connection is back. Null = Devin not set up.
 */
export async function askDevinForFix(incident: Incident, snapshot: Snapshot): Promise<RepairState | null> {
  if (!incident.diagnosis || !devinConfigured()) return null;
  const failedFixes = incident.fixes.filter((f) => !f.ok);
  try {
    const session = await requestRepair(
      { fault: incident.diagnosis.fault, diagnosis: incident.diagnosis, snapshot, platform, repo: REPO, failedFixes },
      { queueOffline: true },
    );
    return session ? { ...session } : null;
  } catch (err) {
    if (!(err instanceof DevinUnreachableError)) throw err;
    return { id: `queued-${incident.id}`, url: "", status: "queued", updatedAt: new Date().toISOString() };
  }
}

export async function pollDevinFix(id: string): Promise<RepairState | null> {
  const session = await getRepairStatus(id);
  return session ? { ...session } : null;
}

export function lastDevinRepair(): RepairState | null {
  const session = peekLastRepair();
  return session ? { ...session } : null;
}
