// When to phone the provider: only once an outage has outlasted a blip.
type Env = Record<string, string | undefined>;

export const DEFAULT_CALL_AFTER_SECONDS = 180;

/** Seconds a provider outage must last before Uplink calls. Simulated (demo) outages call at once. */
export function callDelaySeconds(simulated: boolean, env: Env = process.env): number {
  if (simulated) return 0;
  const n = Number(env.SENTINEL_CALL_AFTER_SECONDS);
  return env.SENTINEL_CALL_AFTER_SECONDS !== undefined && Number.isFinite(n) && n >= 0 ? n : DEFAULT_CALL_AFTER_SECONDS;
}

/** A fault must hold this long before it becomes an incident; one bad sample is a blip. */
export const CONFIRM_MS = 4000;

export interface Suspect {
  fault: string;
  since: number;
}

/**
 * Tracks a fault across samples. Returns the updated suspect and whether it's confirmed.
 * A different fault restarts the clock; simulated (demo) faults are confirmed at once.
 */
export function confirmFault(prev: Suspect | undefined, fault: string, now: number, simulated = false): { suspect: Suspect; confirmed: boolean } {
  const suspect = prev && prev.fault === fault ? prev : { fault, since: now };
  return { suspect, confirmed: simulated || now - suspect.since >= CONFIRM_MS };
}
