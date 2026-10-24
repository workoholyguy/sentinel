// The laptop half of the cloud watchdog (see watchdog/). Every few seconds Uplink checks in with a
// ready-to-place provider call. If the house's internet dies completely, the check-ins stop and the
// watchdog places that call from the cloud — the one case the laptop can't handle by itself. When that
// call ends, the cloud also phones the customer with the update, so nobody waits for the internet to return.
import type { CallState, CloudCall, Incident, Snapshot } from "./types";
import { state, now, log, term } from "./store";
import { demoProfile } from "./profile";
import { buildCallRequest } from "./call/vapi";
import { customerNumber, isLiveCalling } from "./call";
import { pollProviderCall } from "./adapters";

type Env = Record<string, string | undefined>;

export type { CloudCall };

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
  // What the cloud needs to phone the customer once its provider call ends (the prompt needs that call's outcome).
  debrief?: { incident: Pick<Incident, "id" | "startedAt" | "diagnosis">; profile: unknown; phoneNumberId: string; customerNumber: string };
  ack?: string;
  dismiss?: string; // a cloud call Uplink won't follow: don't phone the customer about it
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
const CLOUD_CALL_FRESH_MS = 10 * 60 * 1000; // an older cloud call is history, not something to follow now
const DONE: Incident["status"][] = ["resolved", "ticketed", "needs_human"];
let lastBeatSent = 0;
let lastBeatArmed = false; // the last check-in the cloud got carried a call to place
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
  const to = customerNumber();
  const debrief =
    callBody && phoneNumberId && to
      ? { incident: { id: basis.id, startedAt: basis.startedAt, diagnosis: basis.diagnosis }, profile: { ...demoProfile }, phoneNumberId, customerNumber: to }
      : undefined;
  beatInFlight = sendBeat({ at: now(), quietSeconds: w.quietSeconds, callBody, debrief, ack: w.acked, dismiss: w.dismissed }).then((r) => {
    beatInFlight = null;
    if (!r) return null;
    const wasOffline = w.lastOk != null && Date.now() - w.lastOk > w.quietSeconds * 1000;
    w.lastOk = Date.now();
    lastBeatArmed = Boolean(callBody);
    if (wasOffline) term("info", "back online — cloud watchdog reached");
    const rc = r.called;
    if (rc && rc.id !== w.acked) {
      if (rc.ackedAt) {
        w.acked = rc.id; // picked up already (before a restart): history, never taken over twice
      } else {
        if (!w.called) {
          term(
            rc.ok ? "info" : "err",
            rc.ok
              ? `the cloud watchdog called ${demoProfile.providerName} while the house was offline`
              : `the cloud watchdog couldn't place the call: ${rc.error ?? "unknown error"}`,
          );
        }
        w.called = rc;
      }
    } else if (rc?.debrief && rc.id === w.ownedCloud) {
      w.cloudDebrief = rc.debrief; // news on the customer call for the cloud call we're following
    } else if (rc?.debrief && rc.id === w.dismissed && (rc.debrief.pending || rc.debrief.ok) && s.incident?.call) {
      // Too late to stand it down: the cloud is phoning the customer. That is the update for Uplink's own call too.
      w.owned = s.incident.call.id;
      w.ownedCloud = rc.id;
      w.cloudDebrief = rc.debrief;
    }
    return r;
  });
  return beatInFlight;
}

/**
 * The cloud called the provider while we were dark: follow that call — whatever state the incident on
 * screen is in, or on a new one if the laptop never saw the outage (lid shut) — so the customer still
 * gets the debrief. True when it took over the incident; the loop's next tick follows the call.
 */
export async function adoptCloudCall(): Promise<boolean> {
  const s = state();
  const w = s.watchdog;
  const c = w?.called;
  if (!w || !c || s.busy) return false;
  w.acked = c.id;
  w.called = null;
  if (c.ok) s.providerCalledAt = Math.max(s.providerCalledAt ?? 0, c.at); // the provider has been told: no second call
  // An old call whose customer update already went out is history; one still owed an update is followed, however old.
  const owed = !c.debrief || c.debrief.pending || (!c.debrief.ok && !c.debrief.skipped);
  const live = c.ok && (Date.now() - c.at < CLOUD_CALL_FRESH_MS || owed);
  if (!live) return false;
  let inc = s.incident;
  if (inc?.call && !DONE.includes(inc.status)) {
    // Uplink got through itself. If the cloud already phoned (or is phoning) the customer, that is the update
    // for this call too; otherwise ask the cloud to stand down, and Uplink phones the customer.
    if (c.debrief?.pending || c.debrief?.ok) {
      w.owned = inc.call.id;
      w.ownedCloud = c.id;
      w.cloudDebrief = c.debrief;
    } else if (!c.debrief) {
      w.dismissed = c.id;
    }
    return false;
  }
  const call = await pollProviderCall(c.id);
  if (inc?.call) {
    s.history.unshift(inc); // a finished incident with its own call: this outage is a new one
    inc = null;
  }
  if (!inc) {
    inc = { ...darkIncident(s.snapshot, new Date(c.at - quietSeconds() * 1000)), id: `inc_${Date.now().toString(36)}` };
    s.incident = inc;
  }
  inc.call = call;
  inc.status = "calling";
  w.owned = c.id;
  w.ownedCloud = c.id;
  w.cloudDebrief = c.debrief ?? null;
  log(inc, "call", `The cloud watchdog called ${demoProfile.providerName} while the house was offline — following that call`);
  return true;
}

const CLOUD_TAKEOVER_MS = 45_000; // no word from the cloud this long after the call: ask it to stand down
const CLOUD_GIVES_UP_MS = 180_000; // the cloud never dials later than 2 min after the call (watchdog/src/index.ts)

/**
 * The provider call ended. If the cloud phones the customer about it, follow that call ("wait" until the
 * cloud reports it). Null when Uplink should phone the customer itself: its own call, or the cloud skipped
 * (no news), stood down, failed, or has been silent too long to dial anymore. Uplink never takes over on
 * silence alone: it asks the cloud to stand down and waits for the answer, so only one side ever dials.
 */
export async function cloudDebriefFor(inc: Incident): Promise<CallState | "wait" | null> {
  const w = state().watchdog;
  if (!inc.call || !w?.owned || w.owned !== inc.call.id) return null;
  const d = w.cloudDebrief;
  if (d?.ok && d.id) return pollProviderCall(d.id);
  if (d?.pending) return "wait"; // dialing right now
  if (d) return null;
  const since = Date.now() - (Date.parse(inc.call.endedAt ?? "") || Date.parse(inc.call.startedAt) || Date.now());
  if (since > CLOUD_GIVES_UP_MS) return null;
  if (since > CLOUD_TAKEOVER_MS) w.dismissed = w.ownedCloud; // the next check-in's reply says who dials
  return "wait";
}

/**
 * About to call the provider ourselves: not when the cloud already has, or is about to because the
 * house has been dark past the quiet window (Uplink follows that call once it's back online).
 */
export async function cloudIsCalling(inc: Incident): Promise<boolean> {
  if (!watchdogEnabled()) return false;
  await heartbeat(true); // back online? did the cloud call?
  const s = state();
  const w = s.watchdog;
  if (w?.called) return true; // the top of the next tick follows it
  const silentMs = w?.lastOk == null ? 0 : Date.now() - w.lastOk;
  const quiet = quietSeconds() * 1000;
  // Dark past the quiet window, the cloud has (or is placing) the call. The internet sampling as up again isn't
  // enough to dial locally: one failed check-in would mean two calls. Hold until a check-in gets through, and
  // only after a minute more of an unreachable watchdog call from here.
  const dark = lastBeatArmed && silentMs > quiet && (s.snapshot.nodes.internet !== "ok" || silentMs < quiet + 60_000);
  if (dark && !inc.timeline.some((e) => e.text.startsWith("Offline"))) {
    log(inc, "call", `Offline for ${Math.round(silentMs / 1000)} s — the cloud watchdog is calling ${demoProfile.providerName}; Uplink follows that call once it's back online`);
  }
  return dark;
}

/** Stop the cloud from calling (we're shutting down on purpose, not going dark). */
export async function disarm(env: Env = process.env): Promise<boolean> {
  if (!watchdogEnabled(env)) return false;
  try {
    const res = await fetch(`${env.WATCHDOG_URL!.replace(/\/$/, "")}/disarm`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.WATCHDOG_TOKEN}` },
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// A clean stop (Ctrl-C, quitting the app, a server restart) must not look like the house going dark.
const flag = globalThis as unknown as { __uplinkDisarmHooked?: boolean };
if (!flag.__uplinkDisarmHooked && typeof process !== "undefined") {
  flag.__uplinkDisarmHooked = true;
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      void disarm().finally(() => process.exit(0));
    });
  }
}
