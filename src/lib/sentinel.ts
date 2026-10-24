// The Uplink loop: watch → diagnose (on-device) → fix → if it's the provider's fault, call them.
// One tick every ~1.5 s, started lazily by the first API request.
import type { Incident, Snapshot } from "./types";
import { state, now, log } from "./store";
import { demoProfile } from "./profile";
import { callDelaySeconds, confirmFault } from "./escalation";
import { explainLocally } from "./llm";
import { ispOutageSnapshot } from "./mock";
import { askDevinForFix, startCustomerUpdate, diagnoseSnapshot as diagnoseReal, execContext, hasFixFor, pollDevinFix, pollProviderCall, runFixesFor, sampleNetwork, startProviderCall } from "./adapters";
import type { Diagnosis } from "./types";

const TICK_MS = 1500;
const DONE: Incident["status"][] = ["resolved", "ticketed", "needs_human"];
const QUEUE_RETRY_MS = 10_000;
// The evidence each Devin request was made with, so a queued one goes out with the fault, not today's healthy network.
const evidence = new Map<string, Snapshot>();
const DRY_RUN = process.env.SENTINEL_DRY_RUN !== "0"; // real system changes only when explicitly enabled

function injected(): Snapshot | null {
  const s = state();
  if (s.demo === "isp-outage") return { ...ispOutageSnapshot, at: now() };
  if (s.demo === "ipv6-blackhole") return { ...ipv6Snapshot(), at: now() };
  return null;
}

// A fault Uplink has no repair plugin for — the trigger for asking Devin to write one.
function ipv6Snapshot(): Snapshot {
  const base = ispOutageSnapshot;
  return {
    at: now(),
    nodes: { ...base.nodes, isp: "ok", dns: "ok", internet: "degraded" },
    probes: [
      ...base.probes.filter((p) => p.node === "wifi" || p.node === "router"),
      { id: "dns-system", node: "dns", label: "DNS lookup example.com", status: "ok", latencyMs: 21, at: now() },
      { id: "ping-isp", node: "isp", label: "ISP edge ping", status: "ok", latencyMs: 10, lossPct: 0, at: now() },
      { id: "http-ipv6", node: "internet", label: "HTTPS over IPv6 (google.com)", status: "down", detail: "SYN sent, no reply after 10 s", at: now() },
      { id: "http-ipv4", node: "internet", label: "HTTPS over IPv4 (google.com)", status: "ok", latencyMs: 31, at: now() },
    ],
  };
}

const ipv6Diagnosis: Diagnosis = {
  fault: "IPV6_BLACKHOLE",
  blame: "router",
  confidence: 0.86,
  summary: "IPv6 traffic disappears after the router while IPv4 works, so many sites hang for 10+ seconds",
  evidence: [
    "HTTPS over IPv4 answers in 31 ms; the same site over IPv6 never answers",
    "Router hands out IPv6 addresses but drops IPv6 traffic upstream",
    "Browsers try IPv6 first, so pages hang before falling back",
  ],
};

function diagnoseSnapshot(snap: Snapshot): Diagnosis | null {
  if (state().demo === "ipv6-blackhole") return ipv6Diagnosis;
  return diagnoseReal(snap);
}

async function sample(): Promise<Snapshot> {
  return injected() ?? (await sampleNetwork());
}

function newIncident(simulated: boolean): Incident {
  return { id: `inc_${Date.now().toString(36)}`, startedAt: now(), status: "detected", simulated, fixes: [], timeline: [] };
}

async function tick() {
  const s = state();
  s.snapshot = await sample();
  const inc = s.incident;

  // 1. Nothing open: look for a fault.
  if (!inc || DONE.includes(inc.status)) {
    const d = diagnoseSnapshot(s.snapshot);
    if (!d) {
      s.suspect = undefined;
      // Healthy again: archive a finished incident after it has been on screen for a while.
      if (inc && Date.now() - Date.parse(inc.timeline.at(-1)?.at ?? inc.startedAt) > 20000) {
        s.history.unshift(inc);
        s.incident = null;
      }
      return;
    }
    if (inc && DONE.includes(inc.status)) return; // keep showing the result
    // One bad sample is a blip: only a fault that holds for a few seconds becomes an incident.
    const check = confirmFault(s.suspect, d.fault, Date.now(), s.demo !== "none");
    s.suspect = check.suspect;
    if (!check.confirmed) return;
    s.suspect = undefined;
    const fresh = newIncident(s.demo !== "none");
    s.incident = fresh;
    const worst = s.snapshot.probes.find((p) => p.status !== "ok");
    log(fresh, "probe", worst ? `${worst.label}: ${worst.detail ?? worst.status}${worst.lossPct ? ` · ${worst.lossPct}% loss` : ""}` : "Fault detected");
    fresh.status = "diagnosing";
    fresh.diagnosis = d;
    log(fresh, "diagnosis", `Diagnosed ${d.fault.replaceAll("_", " ").toLowerCase()} (${Math.round(d.confidence * 100)}% confidence)`);
    explainLocally(d).then((text) => {
      if (fresh.diagnosis && text) {
        fresh.diagnosis.explanation = text.replace(/^here'?s[^:\n]*:\s*/i, "");
        log(fresh, "info", "Explained on-device by the local model");
      }
    });
    return;
  }

  if (s.busy) return;
  s.busy = true;
  try {
    // 2. Diagnosed, but nothing in the playbook handles it.
    if (inc.status === "diagnosing" && inc.diagnosis && !(await hasFixFor(inc.diagnosis.fault))) {
      if (inc.diagnosis.blame === "isp") {
        inc.status = "escalating";
        log(inc, "info", `It's ${demoProfile.providerName}'s fault — calling them`);
        return;
      }
      // Only spend a Devin session on a fault that is still there.
      if (!diagnoseSnapshot(await sample())) {
        inc.status = "resolved";
        log(inc, "info", "Cleared on its own before any fix was needed");
        return;
      }
      inc.status = "fixing";
      log(inc, "fix", "No repair in the playbook for this fault — asking Devin to write one");
      await handOffToDevin(inc, s.snapshot);
      return;
    }

    // 2b. Queued with no internet: re-send to Devin once a connection is back.
    if (inc.status === "fixing" && inc.repair?.status === "queued") {
      if (Date.now() - Date.parse(inc.repair.updatedAt) < QUEUE_RETRY_MS) return;
      const r = await askDevinForFix(inc, evidence.get(inc.id) ?? s.snapshot);
      if (!r) {
        inc.status = "needs_human";
        log(inc, "info", "Devin couldn't take it — needs a human");
      } else {
        inc.repair = r;
        if (r.status !== "queued") log(inc, "fix", `Back online — sent to Devin: ${r.url}`);
      }
      return;
    }

    // 2c. Devin is writing the fix: follow the session until it opens a PR.
    if (inc.status === "fixing" && inc.repair) {
      const r = await pollDevinFix(inc.repair.id);
      if (r) inc.repair = r;
      if (inc.repair.status === "finished") {
        inc.status = "resolved";
        log(inc, "fix", inc.repair.prUrl ? `Devin opened a fix: ${inc.repair.prUrl}` : "Devin finished the fix");
      } else if (inc.repair.status === "failed") {
        inc.status = "needs_human";
        log(inc, "info", "Devin couldn't write a fix — needs a human");
      }
      return;
    }

    if (inc.status === "diagnosing" && inc.diagnosis) {
      inc.status = "fixing";
      const fixes = await runFixesFor(inc.diagnosis.fault, execContext(DRY_RUN), async () => !diagnoseSnapshot(await sample()));
      inc.fixes.push(...fixes);
      for (const f of fixes) log(inc, "fix", `${f.actions.join(" · ") || f.pluginId}${f.ok ? " — fixed" : f.detail ? ` — ${f.detail}` : ""}`);
      const healed = fixes.some((f) => f.ok) || !diagnoseSnapshot(await sample());
      if (healed) {
        inc.status = "resolved";
        log(inc, "info", "Network healthy again — no human needed");
      } else if (inc.diagnosis.blame === "isp") {
        inc.status = "escalating";
        log(inc, "info", `It's ${demoProfile.providerName}'s fault — calling them`);
      } else if (DRY_RUN && !inc.simulated) {
        // Dry-run fixes were only rehearsed, so "they failed" isn't true — don't send Devin after them.
        inc.status = "needs_human";
        log(inc, "info", "Dry run: the playbook was rehearsed, not applied — needs a human (SENTINEL_DRY_RUN=0 lets Uplink act)");
      } else {
        // The playbook really ran and didn't fix a fault that's ours: Devin writes a better repair.
        log(inc, "fix", "The playbook didn't fix it — asking Devin to write a better repair");
        await handOffToDevin(inc, s.snapshot);
      }
      return;
    }

    // 3. Provider's fault: place the call — once the outage has outlasted a blip.
    if (inc.status === "escalating") {
      const wait = callDelaySeconds(inc.simulated);
      const lasted = (Date.now() - Date.parse(inc.startedAt)) / 1000;
      if (lasted < wait) {
        if (!diagnoseSnapshot(s.snapshot)) {
          inc.status = "resolved";
          log(inc, "info", `Cleared on its own — no need to call ${demoProfile.providerName}`);
        } else if (!inc.timeline.some((e) => e.text.startsWith("Waiting"))) {
          const span = wait >= 120 ? `${Math.round(wait / 60)} min` : `${wait} s`;
          log(inc, "info", `Waiting ${span} to rule out a blip before calling ${demoProfile.providerName}`);
        }
        return;
      }
      try {
        inc.call = await startProviderCall(inc, demoProfile);
      } catch (e) {
        // No way out yet (the ISP is down): keep retrying every tick; it goes out the moment there's a path.
        if (!inc.timeline.some((ev) => ev.text.startsWith("No way out"))) {
          log(inc, "info", `No way out to call ${demoProfile.providerName} yet — calling the moment there's a connection (e.g. your phone's hotspot)`);
        }
        console.warn("[sentinel] provider call not placed yet:", e instanceof Error ? e.message : e);
        return;
      }
      inc.status = "calling";
      log(inc, "call", `Calling ${demoProfile.providerName} support`);
      return;
    }

    // 4. On the call: follow the transcript until it ends, then tell the customer.
    if (inc.status === "calling" && inc.call) {
      inc.call = await pollProviderCall(inc.call.id);
      if (inc.call.status === "ended" || inc.call.status === "failed") {
        const o = inc.call.outcome;
        log(inc, "call", o?.ticketNumber ? `Ticket ${o.ticketNumber}${o.creditUsd ? ` · $${o.creditUsd.toFixed(2)} credit` : ""}${o.technicianWindow ? ` · tech ${o.technicianWindow}` : ""}` : "Call ended");
        if (o?.cause) log(inc, "info", `Cause per ${demoProfile.providerName}: ${o.cause}`);
        const debrief = inc.call.status === "ended" && o?.summary ? await startCustomerUpdate(inc, demoProfile).catch((e) => {
          console.error("[sentinel] customer update call failed", e);
          return null;
        }) : null;
        if (debrief) {
          inc.debrief = debrief;
          inc.status = "informing";
          log(inc, "call", `Calling ${demoProfile.customerName} with the update`);
        } else {
          inc.status = "ticketed";
        }
      }
      return;
    }

    // 5. Telling the customer: follow that call until it ends.
    if (inc.status === "informing" && inc.debrief) {
      inc.debrief = await pollProviderCall(inc.debrief.id);
      if (inc.debrief.status === "ended" || inc.debrief.status === "failed") {
        inc.status = "ticketed";
        log(inc, "call", inc.debrief.status === "ended" ? `${demoProfile.customerName} is up to date` : `Couldn't reach ${demoProfile.customerName}`);
      }
    }
  } finally {
    s.busy = false;
  }
}

const DEVIN_REPEAT_MS = 6 * 60 * 60 * 1000;

async function handOffToDevin(inc: Incident, snapshot: Snapshot) {
  const s = state();
  const fault = inc.diagnosis?.fault ?? "UNKNOWN";
  s.devinAsked ??= {};
  // A chronic fault would otherwise start a paid Devin session after every incident.
  if (Date.now() - (s.devinAsked[fault] ?? 0) < DEVIN_REPEAT_MS) {
    inc.status = "needs_human";
    log(inc, "info", "Devin is already writing a repair for this kind of fault — not asking again");
    return;
  }
  s.devinAsked[fault] = Date.now();
  evidence.set(inc.id, snapshot);
  const repair = await askDevinForFix(inc, snapshot);
  if (repair?.status === "queued") {
    inc.repair = repair;
    log(inc, "fix", "No internet — queued for Devin with the evidence; it goes out the moment a connection is back");
  } else if (repair) {
    inc.repair = repair;
    log(inc, "fix", `Devin session started: ${repair.url}`);
  } else {
    inc.status = "needs_human";
    log(inc, "info", "Devin couldn't take it (no DEVIN_API_KEY, or the request failed) — needs a human");
  }
}

// The loop lives on globalThis so one process runs one loop. Keyed by this module's `tick`, so a
// hot reload swaps in the new code instead of leaving the old loop running stale code.
const loop = globalThis as unknown as { __sentinelTick?: unknown; __sentinelTimer?: ReturnType<typeof setInterval> };

export function ensureRunning() {
  if (loop.__sentinelTick === tick) return;
  if (loop.__sentinelTimer) clearInterval(loop.__sentinelTimer);
  loop.__sentinelTick = tick;
  state().started = true;
  // A slow sample (traceroute can take ~4 s) must not overlap the next one,
  // but a tick stuck for 15 s+ must not stop monitoring either.
  let tickStarted = 0;
  loop.__sentinelTimer = setInterval(() => {
    if (tickStarted && Date.now() - tickStarted < 15_000) return;
    const started = (tickStarted = Date.now());
    tick()
      .catch((e) => console.error("[sentinel] tick failed", e))
      .finally(() => {
        if (tickStarted === started) tickStarted = 0;
      });
  }, TICK_MS);
}

export function setDemo(mode: "none" | "isp-outage" | "ipv6-blackhole") {
  const s = state();
  s.demo = mode;
  if (mode === "none" && s.incident) {
    s.history.unshift(s.incident);
    s.incident = null;
  }
}
