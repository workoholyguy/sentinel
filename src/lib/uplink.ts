// The Uplink loop: watch → diagnose (on-device) → fix → if it's the provider's fault, call them.
// One tick every ~1.5 s, started lazily by the first API request.
import type { Incident, Snapshot } from "./types";
import { state, now, log, term } from "./store";
import { demoProfile } from "./profile";
import { callDelaySeconds, confirmFault } from "./escalation";
import { adoptCloudCall, cloudDebriefFor, cloudIsCalling, heartbeat } from "./watchdog";
import { hasNews } from "./call/vapi";
import { explainLocally, loadModel, localModelName, unloadModel } from "./llm";
import { ispOutageSnapshot } from "./mock";
import { askDevinForFix, startCustomerUpdate, diagnoseSnapshot as diagnoseReal, execContext, hasFixFor, pollDevinFix, pollProviderCall, runFixesFor, sampleNetwork, startProviderCall } from "./adapters";
import type { Diagnosis } from "./types";

const TICK_MS = 1500;
const DONE: Incident["status"][] = ["resolved", "ticketed", "needs_human"];
const QUEUE_RETRY_MS = 10_000;
const ANALYSIS_WAIT_MS = 20_000; // the call's outcome (ticket, cause…) lands a few seconds after it ends
const PROBE_LOG_MS = 10_000;

// ---- the agent console: what Uplink actually runs, and what came back ----------------------
const PROBE_CMD: Record<string, (label: string) => string> = {
  "wifi-link": () => "$ networksetup -getairportnetwork en0",
  "gateway-route": () => "$ route -n get default",
  "dns-system": (l) => `> dns lookup ${l.replace(/^DNS lookup /, "")}`,
  "http-cloudflare": () => "> https GET 1.1.1.1",
};

function probeLines(snap: Snapshot) {
  for (const p of snap.probes) {
    const host = `${p.label} ${p.detail ?? ""}`.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0] ?? (p.node === "isp" ? "<provider edge>" : p.label);
    const cmd = PROBE_CMD[p.id]?.(p.label) ?? (p.id.startsWith("ping") ? `$ ping -c 3 ${host}` : `> ${p.label}`);
    term("cmd", cmd);
    const stats = [p.latencyMs != null ? `${Math.round(p.latencyMs * 10) / 10} ms` : "", p.lossPct != null ? `${p.lossPct}% loss` : "", p.detail ?? ""].filter(Boolean).join(" · ");
    term(p.status === "ok" ? "out" : "err", `${p.status === "ok" ? "ok" : p.status === "down" ? "✕ failed" : "! degraded"}${stats ? ` · ${stats}` : ""}`);
  }
}

// ---- the local model only runs while something is wrong -----------------------------------
let loading: Promise<boolean> | null = null;

function setModel(phase: "asleep" | "waking" | "troubleshooting" | "done") {
  state().llm = { phase, model: localModelName, since: now() };
}

function wakeModel(reason: string): Promise<boolean> {
  const s = state();
  if (s.llm.phase !== "asleep" && loading) return loading;
  if (s.llm.phase !== "asleep") return Promise.resolve(true);
  setModel("waking");
  term("model", `$ ollama run ${localModelName}   # ${reason}`);
  const t0 = Date.now();
  loading = loadModel().then((ok) => {
    if (state().llm.phase === "asleep") {
      // the blip cleared while it loaded: put it straight back to sleep
      void unloadModel();
      loading = null;
      return ok;
    }
    term(ok ? "out" : "err", ok ? `model loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s` : "couldn't load the local model (is Ollama running?)");
    loading = null;
    return ok;
  });
  return loading;
}

const CALL_COOLDOWN_MS = 15 * 60 * 1000;


/** The provider is to blame: start the countdown to the call, from now. */
function escalate(inc: Incident) {
  inc.status = "escalating";
  inc.callAt = new Date(Date.now() + callDelaySeconds(inc.simulated) * 1000).toISOString();
  log(inc, "info", `It's ${demoProfile.providerName}'s fault — calling them`);
  term("info", `calling ${demoProfile.providerName} at ${new Date(inc.callAt).toLocaleTimeString("en-US", { hour12: false })} unless it clears first`);
}

function sleepModel() {
  if (state().llm.phase === "asleep") return;
  setModel("asleep");
  term("model", `$ ollama stop ${localModelName}   # network healthy — model back to sleep`);
  void unloadModel();
}
// The evidence each Devin request was made with, so a queued one goes out with the fault, not today's healthy network.
const evidence = new Map<string, Snapshot>();
const probeShownAt = new Map<string, number>();
const DRY_RUN = process.env.UPLINK_DRY_RUN !== "0"; // real system changes only when explicitly enabled

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
  void heartbeat();
  if (await adoptCloudCall()) return; // the cloud called the provider while we were dark: follow that call
  let inc = s.incident;

  // 0. A different, confirmed fault replaces what's on screen: a finished incident, or one that's
  //    only waiting on Devin (which keeps writing its fix in the background). Otherwise a stale
  //    incident would hide a new outage.
  const parked = inc && inc.diagnosis && (DONE.includes(inc.status) || (inc.status === "fixing" && inc.repair && inc.repair.status !== "queued"));
  if (inc && parked) {
    const d = diagnoseSnapshot(s.snapshot);
    const was = inc.diagnosis!;
    const sameOutage = Boolean(d) && (d!.fault === was.fault || (d!.blame === "isp" && was.blame === "isp"));
    const cleared = DONE.includes(inc.status) && Boolean(inc.clearedAt);
    if (!d) {
      s.suspect = undefined;
      if (!DONE.includes(inc.status)) sleepModel(); // only waiting on Devin; nothing local to think about
    } else if (sameOutage && !cleared) {
      s.suspect = undefined; // still the same outage: keep it on screen
    } else {
      const firstSighting = !s.suspect || s.suspect.fault !== d.fault;
      const check = confirmFault(s.suspect, d.fault, Date.now(), s.demo !== "none");
      s.suspect = check.suspect;
      if (firstSighting) {
        term("info", `something new looks wrong (${d.fault.replaceAll("_", " ").toLowerCase()}) — checking it isn't a blip`);
        probeLines(s.snapshot);
        void wakeModel("new fault suspected — waking the local model");
      }
      if (check.confirmed) {
        if (!DONE.includes(inc.status)) {
          inc.status = "needs_human";
          log(inc, "info", "A new fault took over — Devin keeps writing this repair in the background");
        }
        s.history.unshift(inc);
        s.incident = null;
        inc = null;
      }
    }
  }

  // 1. Nothing open: look for a fault.
  if (!inc || DONE.includes(inc.status)) {
    const d = diagnoseSnapshot(s.snapshot);
    if (!d) {
      s.suspect = undefined;
      if (inc && DONE.includes(inc.status) && !inc.clearedAt) inc.clearedAt = now();
      if (!inc || DONE.includes(inc.status)) sleepModel();
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
    const firstSighting = !s.suspect;
    s.suspect = check.suspect;
    if (firstSighting) {
      term("info", `something looks wrong (${d.fault.replaceAll("_", " ").toLowerCase()}) — checking it isn't a blip`);
      probeLines(s.snapshot);
      void wakeModel("fault suspected — waking the local model");
    }
    if (!check.confirmed) return;
    s.suspect = undefined;
    const fresh = newIncident(s.demo !== "none");
    s.incident = fresh;
    const worst = s.snapshot.probes.find((p) => p.status !== "ok");
    log(fresh, "probe", worst ? `${worst.label}: ${worst.detail ?? worst.status}${worst.lossPct ? ` · ${worst.lossPct}% loss` : ""}` : "Fault detected");
    fresh.status = "diagnosing";
    fresh.diagnosis = d;
    log(fresh, "diagnosis", `Diagnosed ${d.fault.replaceAll("_", " ").toLowerCase()} (${Math.round(d.confidence * 100)}% confidence)`);
    term("info", `incident confirmed: ${d.summary}`);
    void (async () => {
      await wakeModel("outage confirmed — waking the local model");
      setModel("troubleshooting");
      term("model", `> ${localModelName} troubleshoot "${d.fault.toLowerCase()}" (${d.evidence.length} pieces of evidence)`);
      const text = await explainLocally(d);
      if (fresh.diagnosis && text) {
        fresh.diagnosis.explanation = text.replace(/^here'?s[^:\n]*:\s*/i, "");
        log(fresh, "info", "Explained on-device by the local model");
        term("out", fresh.diagnosis.explanation);
      } else {
        term("err", "the local model didn't answer");
      }
      if (state().llm.phase === "troubleshooting") setModel("done");
    })();
    return;
  }

  if (s.busy) return;
  s.busy = true;
  try {
    // 2. Diagnosed, but nothing in the playbook handles it.
    if (inc.status === "diagnosing" && inc.diagnosis && !(await hasFixFor(inc.diagnosis.fault))) {
      if (inc.diagnosis.blame === "isp") {
        escalate(inc);
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
      term("info", `trying the playbook${DRY_RUN ? " (rehearsal: commands are recorded, not run)" : ""}`);
      for (const f of fixes) {
        // Plugins report the commands they ran; simulated steps come back as plain notes.
        for (const a of f.actions) term(/^[A-Z]/.test(a) ? "info" : "cmd", /^[A-Z]/.test(a) ? `# ${a}` : `$ ${a}`);
        term(f.ok ? "out" : "err", `${f.pluginId}: ${f.ok ? "fixed" : `✕ ${f.detail ?? "didn't help"}`}`);
      }
      term("info", "re-probing the network…");
      probeLines(s.snapshot);
      const healed = fixes.some((f) => f.ok) || !diagnoseSnapshot(await sample());
      if (healed) {
        inc.status = "resolved";
        log(inc, "info", "Network healthy again — no human needed");
      } else if (inc.diagnosis.blame === "isp") {
        escalate(inc);
      } else if (DRY_RUN && !inc.simulated) {
        // Dry-run fixes were only rehearsed, so "they failed" isn't true — don't send Devin after them.
        inc.status = "needs_human";
        log(inc, "info", "Dry run: the playbook was rehearsed, not applied — needs a human (UPLINK_DRY_RUN=0 lets Uplink act)");
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
      inc.callAt ??= now();
      const waiting = Date.now() < Date.parse(inc.callAt);
      const lastShown = Date.parse(inc.timeline.findLast?.((e) => e.kind === "probe")?.at ?? inc.startedAt);
      if (waiting && Date.now() - Math.max(lastShown, probeShownAt.get(inc.id) ?? 0) > PROBE_LOG_MS) {
        probeShownAt.set(inc.id, Date.now());
        term("info", "still down? re-checking…");
        probeLines(s.snapshot);
      }
      if (waiting) {
        if (!diagnoseSnapshot(s.snapshot)) {
          inc.status = "resolved";
          log(inc, "info", `Cleared on its own — no need to call ${demoProfile.providerName}`);
        } else if (!inc.timeline.some((e) => e.text.startsWith("Waiting"))) {
          const span = wait >= 120 ? `${Math.round(wait / 60)} min` : `${wait} s`;
          log(inc, "info", `Waiting ${span} to rule out a blip before calling ${demoProfile.providerName}`);
        }
        return;
      }
      if (await cloudIsCalling(inc)) return; // the cloud watchdog called (or is calling) while we were dark
      if (s.providerCalledAt && Date.now() - s.providerCalledAt < CALL_COOLDOWN_MS) {
        inc.status = "ticketed";
        log(inc, "call", `Already reported to ${demoProfile.providerName}${s.lastTicket ? ` (ticket ${s.lastTicket})` : ""} — not calling again`);
        return;
      }
      try {
        inc.call = await startProviderCall(inc, demoProfile);
        s.providerCalledAt = Date.now();
      } catch (e) {
        // No way out yet (the ISP is down): keep retrying every tick; it goes out the moment there's a path.
        if (!inc.timeline.some((ev) => ev.text.startsWith("No way out"))) {
          log(inc, "info", `No way out to call ${demoProfile.providerName} yet — calling the moment there's a connection (e.g. your phone's hotspot)`);
        }
        console.warn("[uplink] provider call not placed yet:", e instanceof Error ? e.message : e);
        return;
      }
      inc.status = "calling";
      log(inc, "call", `Calling ${demoProfile.providerName} support`);
      term("cmd", `> vapi call ${demoProfile.providerName} support (${demoProfile.supportNumber.replace(/\d(?=\d{4})/g, "•")})`);
      return;
    }

    // 4. On the call: follow the transcript until it ends, then tell the customer.
    if (inc.status === "calling" && inc.call) {
      inc.call = await pollProviderCall(inc.call.id);
      if (inc.call.status === "ended" || inc.call.status === "failed") {
        const cloud = await cloudDebriefFor(inc);
        if (cloud === "wait") return; // the cloud placed this call, so it phones the customer too: never twice
        const o = inc.call.outcome;
        const endedAt = Date.parse(inc.call.endedAt ?? "") || Date.now();
        if (!cloud && !hasNews(o) && Date.now() - endedAt < ANALYSIS_WAIT_MS) return; // Vapi fills in the outcome shortly after
        log(inc, "call", o?.ticketNumber ? `Ticket ${o.ticketNumber}${o.creditUsd ? ` · $${o.creditUsd.toFixed(2)} credit` : ""}${o.technicianWindow ? ` · tech ${o.technicianWindow}` : ""}` : "Call ended");
        if (o?.cause) log(inc, "info", `Cause per ${demoProfile.providerName}: ${o.cause}`);
        if (o?.ticketNumber) s.lastTicket = o.ticketNumber;
        // Only phone the customer when there's news: a ticket, a cause, an ETA, a credit, or something to do —
        // even if the call was cut off after the rep gave it.
        const news = hasNews(o);
        const debrief = cloud ?? (news ? await startCustomerUpdate(inc, demoProfile).catch((e) => {
          console.error("[uplink] customer update call failed", e);
          return null;
        }) : null);
        if (debrief) {
          inc.debrief = debrief;
          inc.status = "informing";
          log(inc, "call", cloud ? `The cloud watchdog phoned ${demoProfile.customerName} with the update` : `Calling ${demoProfile.customerName} with the update`);
        } else if (!news) {
          inc.status = "needs_human";
          log(inc, "info", `The call with ${demoProfile.providerName} didn't get anywhere — needs a human (not bothering ${demoProfile.customerName} with no news)`);
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
const loop = globalThis as unknown as { __uplinkTick?: unknown; __uplinkTimer?: ReturnType<typeof setInterval> };

export function ensureRunning() {
  if (loop.__uplinkTick === tick) return;
  if (loop.__uplinkTimer) clearInterval(loop.__uplinkTimer);
  const firstStart = !loop.__uplinkTick;
  loop.__uplinkTick = tick;
  state().started = true;
  if (firstStart) {
    term("info", "Uplink is watching your network · local model asleep until something breaks");
    void unloadModel();
  }
  // A slow sample (traceroute can take ~4 s) must not overlap the next one,
  // but a tick stuck for 15 s+ must not stop monitoring either.
  let tickStarted = 0;
  loop.__uplinkTimer = setInterval(() => {
    if (tickStarted && Date.now() - tickStarted < 15_000) return;
    const started = (tickStarted = Date.now());
    tick()
      .catch((e) => console.error("[uplink] tick failed", e))
      .finally(() => {
        if (tickStarted === started) tickStarted = 0;
      });
  }, TICK_MS);
}

export function setDemo(mode: "none" | "isp-outage" | "ipv6-blackhole") {
  const s = state();
  s.demo = mode;
  const inc = s.incident;
  if (mode === "none") {
    s.providerCalledAt = undefined; // a fresh demo run may call again
    s.lastTicket = undefined;
    s.suspect = undefined;
  }
  if (!inc) return;
  // Don't drop a live call — but a call stuck for 10+ minutes isn't live.
  const callStarted = Date.parse((inc.status === "informing" ? inc.debrief : inc.call)?.startedAt ?? "") || 0;
  const onThePhone = (inc.status === "calling" || inc.status === "informing") && Date.now() - callStarted < 10 * 60 * 1000;
  if ((mode === "none" && !onThePhone) || (mode !== "none" && DONE.includes(inc.status))) {
    s.history.unshift(inc);
    s.incident = null;
  }
}
