// The laptop half of the cloud watchdog (see watchdog/). Every few seconds Uplink checks in with a
// ready-to-place provider call. If the house's internet dies completely, the check-ins stop and the
// watchdog places that call from the cloud — the one case the laptop can't handle by itself.
import type { Incident, Snapshot } from "./types";
import { state, now, log, term } from "./store";
import { demoProfile } from "./profile";
import { buildCallRequest } from "./call/vapi";
import { isLiveCalling } from "./call";
import { pollProviderCall } from "./adapters";

type Env = Record<string, string | undefined>;

export interface CloudCall {
  id: string;
  at: number;
  ok: boolean;
  error?: string;
}

export function watchdogEnabled(env: Env = process.env): boolean {
  return Boolean(env.WATCHDOG_URL?.trim() && env.WATCHDOG_TOKEN?.trim());
}

/** How long the house may stay silent before the cloud calls (default 60 s). */
export function quietSeconds(env: Env = process.env): number {
  const n = Number(env.WATCHDOG_QUIET_SECONDS);
  return Number.isFinite(n) && n >= 10 ? n : 60;
}

/** The outage the cloud would report if the laptop went dark right now: built from the last good look at the network. */
export function darkIncident(snapshot: Snapshot, lastSeen: Date = new Date()): Incident {
  const at = lastSeen.toISOString();
  const router = snapshot.probes.find((p) => p.node === "router" && p.latencyMs != null);
  const clock = lastSeen.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return {
    id: `dark_${lastSeen.getTime().toString(36)}`,
    startedAt: at,
    status: "escalating",
    simulated: false,
    fixes: [],
    timeline: [],
    diagnosis: {
      fault: "ISP_OUTAGE",
      blame: "isp",
      confidence: 0.9,
      summary: "The customer's internet went completely dark; their network monitor lost every connection past the router",
      evidence: [
        `The monitor at the service address last reached the internet at ${clock}`,
        router ? `Their router was answering in ${Math.round(router.latencyMs!)} ms just before` : "Their router was answering normally just before",
        "Nothing has come back from the house since, so this call was placed automatically by their monitoring service",
      ],
    },
  };
}

export interface BeatPayload {
  at: string;
  quietSeconds: number;
  callBody?: unknown;
  ack?: string;
}

/** One check-in. Null when the watchdog can't be reached (e.g. the internet is down). */
export async function sendBeat(payload: BeatPayload, env: Env = process.env): Promise<{ called: CloudCall | null } | null> {
  try {
    const res = await fetch(`${env.WATCHDOG_URL!.replace(/\/$/, "")}/beat`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.WATCHDOG_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { called?: CloudCall | null };
    return { called: body.called ?? null };
  } catch {
    return null;
  }
}

// ---- wired into the Uplink loop (src/lib/sentinel.ts) ----------------------------------------
const BEAT_MS = 5000;
let lastBeatSent = 0;
let beatInFlight: Promise<unknown> | null = null;

/** Check in with the cloud (every 5 s, or now when `force`). Carries the call to place if we go dark. */
export async function heartbeat(force = false): Promise<unknown> {
  const s = state();
  if (!watchdogEnabled()) return null;
  if (beatInFlight) return force ? beatInFlight : null;
  if (!force && Date.now() - lastBeatSent < BEAT_MS) return null;
  lastBeatSent = Date.now();
  const w = (s.watchdog ??= { enabled: true, quietSeconds: quietSeconds() });
  w.enabled = true;
  w.quietSeconds = quietSeconds();
  const inc = s.incident;
  const basis = inc?.diagnosis?.blame === "isp" ? inc : darkIncident(s.snapshot);
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const callBody = isLiveCalling() && phoneNumberId ? buildCallRequest(basis, demoProfile, phoneNumberId) : undefined;
  beatInFlight = sendBeat({ at: now(), quietSeconds: w.quietSeconds, callBody, ack: w.acked }).then((r) => {
    beatInFlight = null;
    if (!r) return null;
    const wasOffline = w.lastOk != null && Date.now() - w.lastOk > w.quietSeconds * 1000;
    w.lastOk = Date.now();
    if (wasOffline) term("info", "back online — cloud watchdog reached");
    if (r.called && r.called.id !== w.acked) {
      if (!w.called) {
        term(
          r.called.ok ? "info" : "err",
          r.called.ok
            ? `the cloud watchdog called ${demoProfile.providerName} while the house was offline`
            : `the cloud watchdog couldn't place the call: ${r.called.error ?? "unknown error"}`,
        );
      }
      w.called = r.called;
    }
    return r;
  });
  return beatInFlight;
}

/** If the cloud already called the provider while we were dark, follow that call instead of placing another. */
export async function adoptCloudCall(inc: Incident): Promise<boolean> {
  if (!watchdogEnabled()) return false;
  await heartbeat(true); // back online? did the cloud call?
  const s = state();
  const c = s.watchdog?.called;
  if (!c?.ok || !c.id) return false;
  inc.call = await pollProviderCall(c.id);
  inc.status = "calling";
  s.providerCalledAt = c.at;
  s.watchdog!.acked = c.id;
  s.watchdog!.called = null;
  log(inc, "call", `The cloud watchdog called ${demoProfile.providerName} while the house was offline — following that call`);
  return true;
}
