// Fault diagnosis: walk the packet's path left to right (wifi → router → dns → isp → internet)
// and stop at the first link that explains the symptoms. Pure function, no I/O.
import type { Blame, Diagnosis, FaultCode, Probe, Snapshot } from "../types";

const SLOW = { router: 50, dns: 300, isp: 150, internet: 800 } as const;
const EDGE_LOSS_PCT = 10;
const GATEWAY_LOSS_PCT = 10;

interface View {
  wifi?: Probe;
  route?: Probe;
  gw?: Probe;
  dns?: Probe;
  isp?: Probe;
  net?: Probe;
}

function view(s: Snapshot): View {
  const byId = (id: string) => s.probes.find((p) => p.id === id);
  const byNode = (node: Probe["node"]) => s.probes.find((p) => p.node === node);
  return {
    wifi: byId("wifi-link") ?? byNode("wifi"),
    route: byId("gateway-route"),
    gw: byId("ping-gateway") ?? s.probes.find((p) => p.node === "router" && p.id !== "gateway-route"),
    dns: byId("dns-system") ?? byNode("dns"),
    isp: byId("ping-isp") ?? byNode("isp"),
    net: byId("http-cloudflare") ?? byNode("internet"),
  };
}

const ms = (n?: number) => (n === undefined ? "?" : `${Math.round(n)} ms`);
const pct = (n?: number) => `${n ?? 0}%`;
const host = (p?: Probe) => p?.label.match(/(\d{1,3}(?:\.\d{1,3}){3})/)?.[1];
const clamp = (n: number) => Math.max(0.05, Math.min(0.99, Math.round(n * 100) / 100));

function gatewayFine(gw?: Probe): boolean {
  return !!gw && gw.status !== "down" && (gw.lossPct ?? 0) < GATEWAY_LOSS_PCT;
}

function gwEvidence(gw?: Probe): string {
  if (!gw) return "Router was not measured";
  if (gw.status === "down" || (gw.lossPct ?? 0) >= 100) return `Router${host(gw) ? ` ${host(gw)}` : ""} ignores ping, but traffic passes through it`;
  if (gatewayFine(gw) && (gw.latencyMs ?? 0) < SLOW.router)
    return `Router answers in ${ms(gw.latencyMs)} with ${pct(gw.lossPct)} loss — your local network is healthy`;
  return `Router answers in ${ms(gw.latencyMs)} with ${pct(gw.lossPct)} loss`;
}

function netEvidence(net?: Probe): string {
  if (!net) return "Internet check was not run";
  return net.status === "down"
    ? `HTTPS to 1.1.1.1 failed${net.detail ? ` (${net.detail})` : ""}`
    : `HTTPS to 1.1.1.1 by IP works (${ms(net.latencyMs)})`;
}

function ispEvidence(isp?: Probe): string {
  if (!isp) return "Provider edge was not measured";
  const where = host(isp) ? ` ${host(isp)}` : "";
  if ((isp.lossPct ?? 0) >= 100 || isp.latencyMs === undefined) return `Provider edge${where}: ${pct(isp.lossPct ?? 100)} packet loss, no replies`;
  return `Provider edge${where}: ${pct(isp.lossPct)} packet loss, ${ms(isp.latencyMs)} latency`;
}

/** Latency probes that crossed their "slow" threshold. */
function slowProbes(v: View): Probe[] {
  const out: Probe[] = [];
  if (v.gw && (v.gw.latencyMs ?? 0) >= SLOW.router) out.push(v.gw);
  if (v.dns && (v.dns.latencyMs ?? 0) >= SLOW.dns) out.push(v.dns);
  if (v.isp && (v.isp.latencyMs ?? 0) >= SLOW.isp) out.push(v.isp);
  if (v.net && v.net.status !== "down" && (v.net.latencyMs ?? 0) >= SLOW.internet) out.push(v.net);
  return out;
}

type Finding = Omit<Diagnosis, "explanation">;

function make(fault: FaultCode, blame: Blame, confidence: number, summary: string, evidence: string[]): Finding {
  return { fault, blame, confidence: clamp(confidence), summary, evidence };
}

function classify(s: Snapshot): Finding | null {
  const v = view(s);
  const missing = [v.gw, v.dns, v.isp, v.net].filter((p) => !p).length;
  const clean = 1 - 0.08 * missing;

  // 1. Wi-Fi link.
  if (v.wifi?.status === "down") {
    return make("WIFI_DISCONNECTED", "local", (v.gw?.status === "down" || !v.gw ? 0.97 : 0.8) * clean, "This computer is not connected to Wi-Fi", [
      `Wi-Fi: ${v.wifi.detail ?? "not associated"}`,
      v.gw ? gwEvidence(v.gw) : "Router cannot be reached without a link",
      netEvidence(v.net),
    ]);
  }

  // 2. No default route → no DHCP lease.
  if (v.route?.status === "down" || (!v.route && !v.gw && s.nodes.router === "down")) {
    return make("DHCP_NO_LEASE", "local", 0.9 * clean, "Connected to Wi-Fi but the router never handed out an address", [
      v.wifi?.status === "ok" ? `Wi-Fi link is up${v.wifi.label.includes("(") ? ` ${v.wifi.label.slice(v.wifi.label.indexOf("("))}` : ""}` : "Wi-Fi link state unknown",
      `No default gateway: ${v.route?.detail ?? "no route"}`,
      netEvidence(v.net),
    ]);
  }

  // Many routers and provider edges drop ICMP. A silent hop that traffic still flows through is filtered, not down.
  const netUp = !!v.net && v.net.status !== "down";
  const ispAnswers = !!v.isp && (v.isp.lossPct ?? 100) < 100;
  const gwSilent = !v.gw || v.gw.status === "down" || (v.gw.lossPct ?? 0) >= 100;
  const gwFiltered = gwSilent && (netUp || ispAnswers);
  const ispFiltered = !!v.isp && !ispAnswers && netUp;

  // 3. Gateway unreachable / dropping packets.
  if (!gatewayFine(v.gw) && !gwFiltered) {
    const dead = !v.gw || v.gw.status === "down" || (v.gw.lossPct ?? 0) >= 100;
    const where = host(v.gw) ? ` ${host(v.gw)}` : "";
    return make(
      "GATEWAY_UNREACHABLE",
      "router",
      (dead ? 0.92 : 0.6 + Math.min(v.gw?.lossPct ?? 0, 50) / 200) * clean,
      dead ? `Your router${where} is not answering` : `Your router${where} is dropping ${pct(v.gw?.lossPct)} of packets`,
      [
        v.wifi?.status === "ok" ? "Wi-Fi link is up" : "Wi-Fi link state unknown",
        v.gw ? `Router${where}: ${pct(v.gw.lossPct ?? 100)} packet loss${v.gw.latencyMs !== undefined ? `, ${ms(v.gw.latencyMs)}` : ""}` : "Router was not measured",
        netEvidence(v.net),
      ],
    );
  }

  const ispDead = !!v.isp && (v.isp.lossPct ?? 0) >= 100;
  const ispBad = !!v.isp && !ispFiltered && ((v.isp.lossPct ?? 0) >= EDGE_LOSS_PCT || (v.isp.latencyMs ?? 0) >= SLOW.isp);

  // 4. DNS failing while the internet answers by IP.
  // A slow (not dead) resolver only counts when the internet itself is fast; otherwise it's general slowness.
  const netFast = netUp && (v.net?.latencyMs ?? 0) < SLOW.internet;
  if (v.dns && (v.dns.status === "down" ? netUp : v.dns.status === "degraded" && netFast)) {
    const down = v.dns.status === "down";
    return make("DNS_RESOLVER_DOWN", "local", (down ? 0.92 : 0.7) * clean, "Your DNS resolver isn't answering; the internet itself is reachable", [
      gwEvidence(v.gw),
      down ? `DNS lookup of example.com failed${v.dns.detail ? ` (${v.dns.detail})` : ""}` : `DNS lookup of example.com took ${ms(v.dns.latencyMs)}`,
      netEvidence(v.net),
    ]);
  }

  // 5. Provider edge and internet both dead.
  if (!netUp && (ispDead || (!v.isp && v.dns?.status !== "ok"))) {
    return make("ISP_OUTAGE", "isp", (v.isp ? 0.95 : 0.75) * clean, "Your internet provider is down: nothing past your router answers", [
      gwEvidence(v.gw),
      ispEvidence(v.isp),
      netEvidence(v.net),
    ]);
  }

  const slow = slowProbes(v);
  const routerSlow = (v.gw?.latencyMs ?? 0) >= SLOW.router;

  // 6. Latency that starts at the router is a local problem (congested Wi-Fi / LAN).
  if (routerSlow && slow.length >= 2) {
    return make("SLOW_SPEED", "local", 0.55 + 0.1 * slow.length, "Everything is slow, starting at your own router", [
      `Router answers in ${ms(v.gw?.latencyMs)} (normally under ${SLOW.router} ms)`,
      ...slow.filter((p) => p !== v.gw).map((p) => `${p.label}: ${ms(p.latencyMs)}`),
    ].slice(0, 4));
  }

  // 7. Loss / latency appearing at the provider's edge.
  if (ispBad && v.isp) {
    const loss = v.isp.lossPct ?? 0;
    const conf = loss >= EDGE_LOSS_PCT ? 0.75 + Math.min(loss, 50) / 200 : 0.7;
    return make(
      "ISP_UPSTREAM_LOSS",
      "isp",
      conf * clean,
      loss >= EDGE_LOSS_PCT ? `${pct(loss)} packet loss starts beyond your router, at the provider's edge` : `Latency jumps to ${ms(v.isp.latencyMs)} at the provider's edge`,
      [gwEvidence(v.gw), ispEvidence(v.isp), netEvidence(v.net)],
    );
  }

  // 8. Slow everywhere past the router.
  if (slow.length >= 2) {
    return make("SLOW_SPEED", "isp", 0.5 + 0.1 * slow.length, "The connection is up but slow beyond your router", [
      gwEvidence(v.gw),
      ...slow.map((p) => `${p.label}: ${ms(p.latencyMs)}`),
    ].slice(0, 4));
  }

  // 9. Something is off but no rule explains it.
  const ignored = new Set<Probe | undefined>([gwFiltered ? v.gw : undefined, ispFiltered ? v.isp : undefined]);
  const bad = s.probes.filter((p) => (p.status === "down" || p.status === "degraded") && !ignored.has(p));
  if (bad.length) {
    return make(
      "UNKNOWN",
      "unknown",
      0.3,
      "Something on the network is misbehaving but the pattern doesn't match a known fault",
      bad.slice(0, 4).map((p) => `${p.label}: ${p.status}${p.lossPct ? `, ${p.lossPct}% loss` : ""}${p.latencyMs !== undefined ? `, ${ms(p.latencyMs)}` : ""}`),
    );
  }
  return null;
}

/** How long the same fault has been present, counting back through contiguous recent snapshots. */
function lastedSeconds(current: Snapshot, fault: FaultCode, recent: Snapshot[]): number {
  const now = Date.parse(current.at);
  const older = recent.filter((r) => Date.parse(r.at) < now).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  let start = now;
  for (const r of older) {
    if (classify(r)?.fault !== fault) break;
    start = Date.parse(r.at);
  }
  return Math.round((now - start) / 1000);
}

export function diagnose(snapshot: Snapshot, recent: Snapshot[] = []): Diagnosis | null {
  const d = classify(snapshot);
  if (!d) return null;
  const secs = recent.length ? lastedSeconds(snapshot, d.fault, recent) : 0;
  if (secs > 0) {
    d.evidence = [...d.evidence.slice(0, 4), `Problem has lasted ${secs} seconds`];
    d.confidence = clamp(d.confidence + 0.03);
  }
  return d;
}
