// The Sentinel loop: watch → diagnose (on-device) → fix → if it's the provider's fault, call them.
// One tick every ~1.5 s, started lazily by the first API request.
import type { Incident, Snapshot } from "./types";
import { state, now, log } from "./store";
import { demoProfile } from "./profile";
import { explainLocally } from "./llm";
import { ispOutageSnapshot } from "./mock";
import { askDevinForFix, diagnoseSnapshot as diagnoseReal, execContext, hasFixFor, pollDevinFix, pollProviderCall, runFixesFor, sampleNetwork, startProviderCall } from "./adapters";
import type { Diagnosis } from "./types";

const TICK_MS = 1500;
const DRY_RUN = process.env.SENTINEL_DRY_RUN !== "0"; // real system changes only when explicitly enabled

function injected(): Snapshot | null {
  const s = state();
  if (s.demo === "isp-outage") return { ...ispOutageSnapshot, at: now() };
  if (s.demo === "ipv6-blackhole") return { ...ipv6Snapshot(), at: now() };
  return null;
}

// A fault Sentinel has no repair plugin for — the trigger for asking Devin to write one.
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
  if (!inc || inc.status === "resolved" || inc.status === "ticketed") {
    const d = diagnoseSnapshot(s.snapshot);
    if (!d) {
      // Healthy again: archive a finished incident after it has been on screen for a while.
      if (inc && Date.now() - Date.parse(inc.timeline.at(-1)?.at ?? inc.startedAt) > 20000) {
        s.history.unshift(inc);
        s.incident = null;
      }
      return;
    }
    if (inc && (inc.status === "resolved" || inc.status === "ticketed")) return; // keep showing the result
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
    // 2. Diagnosed: try the fixes we have.
    if (inc.status === "diagnosing" && inc.diagnosis && !(await hasFixFor(inc.diagnosis.fault))) {
      inc.status = "fixing";
      log(inc, "fix", "No repair in the playbook for this fault — asking Devin to write one");
      const repair = await askDevinForFix(inc, s.snapshot);
      if (repair) {
        inc.repair = repair;
        log(inc, "fix", `Devin session started: ${repair.url}`);
      } else {
        log(inc, "info", "Devin not configured (DEVIN_API_KEY) — escalating to a human");
      }
      return;
    }

    // 2b. Devin is writing the fix: follow the session until it opens a PR.
    if (inc.status === "fixing" && inc.repair) {
      const r = await pollDevinFix(inc.repair.id);
      if (r) inc.repair = r;
      if (inc.repair.status === "finished") {
        inc.status = "resolved";
        log(inc, "fix", inc.repair.prUrl ? `Devin opened a fix: ${inc.repair.prUrl}` : "Devin finished the fix");
      } else if (inc.repair.status === "failed") {
        inc.status = "resolved";
        log(inc, "info", "Devin couldn't write a fix — a human will take it from here");
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
      }
      return;
    }

    // 3. Provider's fault: place the call.
    if (inc.status === "escalating") {
      inc.call = await startProviderCall(inc, demoProfile);
      inc.status = "calling";
      log(inc, "call", `Calling ${demoProfile.providerName} support`);
      return;
    }

    // 4. On the call: follow the transcript until it ends.
    if (inc.status === "calling" && inc.call) {
      inc.call = await pollProviderCall(inc.call.id);
      if (inc.call.status === "ended" || inc.call.status === "failed") {
        const o = inc.call.outcome;
        inc.status = "ticketed";
        log(inc, "call", o?.ticketNumber ? `Ticket ${o.ticketNumber}${o.creditUsd ? ` · $${o.creditUsd.toFixed(2)} credit` : ""}${o.technicianWindow ? ` · tech ${o.technicianWindow}` : ""}` : "Call ended");
      }
    }
  } finally {
    s.busy = false;
  }
}

export function ensureRunning() {
  const s = state();
  if (s.started) return;
  s.started = true;
  setInterval(() => {
    tick().catch((e) => console.error("[sentinel] tick failed", e));
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
