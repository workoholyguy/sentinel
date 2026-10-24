// In-memory state for the single Uplink process (one laptop, one network).
import type { Incident, Snapshot } from "./types";
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
    };
  }
  return g.__sentinel;
}

export const now = () => new Date().toISOString();

export function log(incident: Incident, kind: Incident["timeline"][number]["kind"], text: string) {
  incident.timeline.push({ at: now(), kind, text });
}
