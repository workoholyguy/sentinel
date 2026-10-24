// In-memory state for the single Uplink process (one laptop, one network).
import type { Incident, LocalModelState, Snapshot, TerminalLine } from "./types";
import { healthySnapshot } from "./mock";

export type DemoMode = "none" | "isp-outage" | "ipv6-blackhole";

export interface SentinelState {
  snapshot: Snapshot;
  incident: Incident | null;
  history: Incident[];
  demo: DemoMode;
  busy: boolean; // a step (fix / call start) is in flight
  started: boolean;
  suspect?: { fault: string; since: number }; // a fault seen but not yet held long enough to count
  devinAsked: Record<string, number>; // fault → when Devin was last asked to write a repair for it
  llm: LocalModelState;
  terminal: TerminalLine[];
}

const g = globalThis as unknown as { __sentinel?: SentinelState };

export function state(): SentinelState {
  if (!g.__sentinel) {
    g.__sentinel = {
      snapshot: { ...healthySnapshot, at: new Date().toISOString() },
      incident: null,
      history: [],
      demo: "none",
      busy: false,
      started: false,
      devinAsked: {},
      llm: { phase: "asleep", model: process.env.LOCAL_LLM_MODEL ?? "llama3.2:3b", since: new Date().toISOString() },
      terminal: [],
    };
  }
  // State survives hot reloads; fields added later need a value.
  g.__sentinel.devinAsked ??= {};
  g.__sentinel.terminal ??= [];
  g.__sentinel.llm ??= { phase: "asleep", model: process.env.LOCAL_LLM_MODEL ?? "llama3.2:3b", since: new Date().toISOString() };
  return g.__sentinel;
}

export const now = () => new Date().toISOString();

export function log(incident: Incident, kind: Incident["timeline"][number]["kind"], text: string) {
  incident.timeline.push({ at: now(), kind, text });
}

/** Append to the agent console (kept to the last 300 lines). */
export function term(kind: TerminalLine["kind"], text: string) {
  const s = state();
  s.terminal ??= [];
  s.terminal.push({ at: now(), kind, text });
  if (s.terminal.length > 300) s.terminal.splice(0, s.terminal.length - 300);
}
