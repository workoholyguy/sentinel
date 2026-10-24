// When to phone the provider: only once an outage has outlasted a blip.
type Env = Record<string, string | undefined>;

export const DEFAULT_CALL_AFTER_SECONDS = 180;

/** Seconds a provider outage must last before Sentinel calls. Simulated (demo) outages call at once. */
export function callDelaySeconds(simulated: boolean, env: Env = process.env): number {
  if (simulated) return 0;
  const n = Number(env.SENTINEL_CALL_AFTER_SECONDS);
  return env.SENTINEL_CALL_AFTER_SECONDS !== undefined && Number.isFinite(n) && n >= 0 ? n : DEFAULT_CALL_AFTER_SECONDS;
}
