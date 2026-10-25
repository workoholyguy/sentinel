import { buildRepairBrief, pluginIdFor, type RepairBriefInput } from "./brief";
import {
  createRepairSession,
  DevinApiError,
  DEFAULT_DEVIN_API_BASE,
  getRepairSession,
  latestRepairWithPr,
  type DevinClientOptions,
  type FetchLike,
  type RepairSession,
  type RepairStatus,
} from "./client";

export { buildRepairBrief, pluginIdFor } from "./brief";
export type { RepairBriefInput } from "./brief";
export * from "./client";

export interface RequestRepairDeps {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  now?: () => number;
  log?: (msg: string) => void;
  /** Throw DevinUnreachableError (instead of returning null) when Devin can't be reached at all. */
  queueOffline?: boolean;
}

/** Devin couldn't be reached (no internet, DNS, timeout) — the caller can queue the repair for later. */
export class DevinUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevinUnreachableError";
  }
}

/** True when Uplink can ask Devin for repairs at all (a key, or the mock). */
export function devinConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return isMock(env) || Boolean(env.DEVIN_API_KEY?.trim());
}

/** Mock timeline (ms since creation) for DEVIN_MOCK=1 demos. */
export const MOCK_TIMELINE = { workingAfterMs: 6_000, finishedAfterMs: 30_000 } as const;

interface MockEntry {
  id: string;
  createdAt: number;
  title: string;
  pluginId: string;
}

const mockSessions = new Map<string, MockEntry>();
let mockSeq = 0;

const defaultLog = (msg: string) => console.warn(`[devin] ${msg}`);

function isMock(env: Record<string, string | undefined>): boolean {
  const v = (env.DEVIN_MOCK ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function clientOptions(env: Record<string, string | undefined>, fetchImpl?: FetchLike): DevinClientOptions | null {
  const apiKey = env.DEVIN_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: env.DEVIN_API_BASE?.trim() || DEFAULT_DEVIN_API_BASE,
    orgId: env.DEVIN_ORG_ID?.trim() || undefined,
    fetchImpl,
  };
}

function repairTitle(input: RepairBriefInput): string {
  return `Uplink repair: ${String(input.fault)} (${input.platform})`;
}

function mockStatus(entry: MockEntry, now: number): RepairSession {
  const elapsed = now - entry.createdAt;
  const status: RepairStatus =
    elapsed >= MOCK_TIMELINE.finishedAfterMs ? "finished" : elapsed >= MOCK_TIMELINE.workingAfterMs ? "working" : "starting";
  return {
    id: entry.id,
    url: `https://app.devin.ai/sessions/${entry.id.replace(/^devin-/, "")}`,
    status,
    title: entry.title,
    ...(status === "finished" ? { prUrl: `https://github.com/mock/uplink/pull/${1000 + Number(entry.id.split("-").pop())}` } : {}),
    updatedAt: new Date(now).toISOString(),
  };
}

/**
 * Asks Devin to write a repair plugin for a fault no existing plugin handles.
 * Returns null (and logs why) when Devin is not configured, so Uplink keeps running.
 */
export async function requestRepair(input: RepairBriefInput, deps: RequestRepairDeps = {}): Promise<RepairSession | null> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? defaultLog;
  const now = deps.now ?? Date.now;
  const title = repairTitle(input);

  if (isMock(env)) {
    const entry: MockEntry = { id: `devin-mock-${++mockSeq}`, createdAt: now(), title, pluginId: pluginIdFor(input.fault) };
    mockSessions.set(entry.id, entry);
    log(`DEVIN_MOCK=1: simulating repair session ${entry.id} for fault "${String(input.fault)}"`);
    return mockStatus(entry, entry.createdAt);
  }

  const opts = clientOptions(env, deps.fetchImpl);
  if (!opts) {
    log(`DEVIN_API_KEY is not set; skipping Devin repair request for fault "${String(input.fault)}"`);
    return null;
  }

  try {
    const brief = buildRepairBrief(input);
    const maxAcu = Number(env.DEVIN_MAX_ACU ?? 8) || undefined;
    return await createRepairSession(brief, { ...opts, title, maxAcu, tags: ["uplink", "repair", String(input.fault)] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (deps.queueOffline && !(err instanceof DevinApiError)) throw new DevinUnreachableError(msg);
    log(`Devin repair request failed for fault "${String(input.fault)}": ${msg}`);
    return null;
  }
}

/** Polls a session created by requestRepair (real or mock). Returns null when unavailable. */
export async function getRepairStatus(id: string, deps: RequestRepairDeps = {}): Promise<RepairSession | null> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? defaultLog;
  const now = deps.now ?? Date.now;

  const mock = mockSessions.get(id);
  if (mock) return mockStatus(mock, now());

  const opts = clientOptions(env, deps.fetchImpl);
  if (!opts) {
    log(`DEVIN_API_KEY is not set; cannot poll Devin session ${id}`);
    return null;
  }
  try {
    return await getRepairSession(id, opts);
  } catch (err) {
    log(`Polling Devin session ${id} failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

let remoteLast: { at: number; value: RepairSession | null } | null = null;
let remoteInflight: Promise<void> | null = null;

/**
 * The newest Devin repair that opened a PR, for showing next to a live session.
 * Never waits on the network: returns what is known now and refreshes from the API
 * in the background at most once a minute (a failed refresh keeps the last value).
 */
export function peekLastRepair(deps: RequestRepairDeps = {}): RepairSession | null {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const finishedMock = [...mockSessions.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => mockStatus(m, now()))
    .find((m) => m.prUrl);
  if (finishedMock) return finishedMock;
  if (isMock(env)) return null;
  const opts = clientOptions(env, deps.fetchImpl);
  if (!opts) return null;
  if ((!remoteLast || now() - remoteLast.at > 60_000) && !remoteInflight) {
    remoteInflight = latestRepairWithPr(opts)
      .then((value) => {
        remoteLast = { at: now(), value };
      })
      .catch((err) => {
        (deps.log ?? defaultLog)(`Listing Devin repairs failed: ${err instanceof Error ? err.message : String(err)}`);
        remoteLast = { at: now(), value: remoteLast?.value ?? null };
      })
      .finally(() => {
        remoteInflight = null;
      });
  }
  return remoteLast?.value ?? null;
}

/** Test helper: wait for a background refresh started by peekLastRepair. */
export async function settleLastRepair(): Promise<void> {
  await remoteInflight;
}

/** Test helper: forget simulated sessions. */
export function resetMockRepairs(): void {
  mockSessions.clear();
  remoteLast = null;
  remoteInflight = null;
  mockSeq = 0;
}
