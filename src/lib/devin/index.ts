import { buildRepairBrief, pluginIdFor, type RepairBriefInput } from "./brief";
import {
  createRepairSession,
  DEFAULT_DEVIN_API_BASE,
  getRepairSession,
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
}

/** Mock timeline (ms since creation) for DEVIN_MOCK=1 demos. */
export const MOCK_TIMELINE = { workingAfterMs: 8_000, finishedAfterMs: 60_000 } as const;

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
  return `Sentinel repair: ${String(input.fault)} (${input.platform})`;
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
    ...(status === "finished" ? { prUrl: `https://github.com/mock/sentinel/pull/${1000 + Number(entry.id.split("-").pop())}` } : {}),
    updatedAt: new Date(now).toISOString(),
  };
}

/**
 * Asks Devin to write a repair plugin for a fault no existing plugin handles.
 * Returns null (and logs why) when Devin is not configured, so Sentinel keeps running.
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
    return await createRepairSession(brief, { ...opts, title, tags: ["sentinel", "repair", String(input.fault)] });
  } catch (err) {
    log(`Devin repair request failed for fault "${String(input.fault)}": ${err instanceof Error ? err.message : String(err)}`);
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

/** Test helper: forget simulated sessions. */
export function resetMockRepairs(): void {
  mockSessions.clear();
  mockSeq = 0;
}
