// Realistic fixtures for building UI and tests before the live pieces exist.
import type { Incident, NodeId, Health, Snapshot, StatusResponse } from "./types";
import { NODE_ORDER } from "./types";
import { demoProfile } from "./profile";

const t = (secondsAgo: number) => new Date(Date.now() - secondsAgo * 1000).toISOString();

const nodes = (down: Partial<Record<NodeId, Health>> = {}): Record<NodeId, Health> =>
  Object.fromEntries(NODE_ORDER.map((n) => [n, down[n] ?? "ok"])) as Record<NodeId, Health>;

export const healthySnapshot: Snapshot = {
  at: t(0),
  nodes: nodes(),
  probes: [
    { id: "wifi-link", node: "wifi", label: "Wi-Fi link (HackerHouse HQ)", status: "ok", detail: "-54 dBm", at: t(0) },
    { id: "ping-gateway", node: "router", label: "Gateway ping 192.168.1.1", status: "ok", latencyMs: 3, lossPct: 0, at: t(0) },
    { id: "dns-system", node: "dns", label: "DNS lookup example.com", status: "ok", latencyMs: 18, at: t(0) },
    { id: "ping-isp", node: "isp", label: "ISP edge ping", status: "ok", latencyMs: 9, lossPct: 0, at: t(0) },
    { id: "http-cloudflare", node: "internet", label: "HTTPS 1.1.1.1", status: "ok", latencyMs: 24, at: t(0) },
  ],
};

export const ispOutageSnapshot: Snapshot = {
  at: t(0),
  nodes: nodes({ isp: "down", internet: "down" }),
  probes: [
    { id: "wifi-link", node: "wifi", label: "Wi-Fi link (HackerHouse HQ)", status: "ok", detail: "-54 dBm", at: t(0) },
    { id: "ping-gateway", node: "router", label: "Gateway ping 192.168.1.1", status: "ok", latencyMs: 3, lossPct: 0, at: t(0) },
    { id: "dns-system", node: "dns", label: "DNS lookup example.com", status: "degraded", latencyMs: 2100, detail: "timeouts upstream", at: t(0) },
    { id: "ping-isp", node: "isp", label: "ISP edge ping", status: "down", lossPct: 38, latencyMs: 412, at: t(0) },
    { id: "http-cloudflare", node: "internet", label: "HTTPS 1.1.1.1", status: "down", detail: "timeout after 5s", at: t(0) },
  ],
};

export const callingIncident: Incident = {
  id: "inc_2041",
  startedAt: t(95),
  status: "calling",
  simulated: true,
  diagnosis: {
    fault: "ISP_UPSTREAM_LOSS",
    blame: "isp",
    confidence: 0.93,
    summary: "38% packet loss starts beyond your router, at the provider's edge",
    evidence: [
      "Router answers in 3 ms with 0% loss — your local network is healthy",
      "Provider edge: 38% packet loss, 412 ms latency (normal: 0%, 9 ms)",
      "Router rebooted at 12:58 — loss persisted",
      "Outage started 12:56 and has lasted 95 seconds",
    ],
    explanation:
      "Everything inside the building works. Packets reach your router instantly, but more than a third of them die at your internet provider's equipment. Restarting your devices won't help — this has to be fixed on their side.",
  },
  fixes: [{ pluginId: "router-reboot", ok: false, actions: ["Rebooted router", "Re-tested provider edge: still 38% loss"] }],
  call: {
    id: "call_demo",
    status: "in-progress",
    to: demoProfile.supportNumber,
    startedAt: t(40),
    transcript: [
      { at: t(38), speaker: "rep", text: "Thank you for calling Peachtree Fiber support, this is Dana. How can I help?" },
      { at: t(33), speaker: "agent", text: "Hi Dana — I'm an AI assistant calling on behalf of Omar Madjitov, account 4471-2290. His service at 817 West Peachtree has 38 percent packet loss starting at your edge router, for the last minute and a half." },
      { at: t(24), speaker: "rep", text: "Okay. Have you tried restarting your modem?" },
      { at: t(17), speaker: "agent", text: "Yes — the router was rebooted at 12:58 and the loss persisted. Inside the network everything answers in 3 milliseconds with zero loss, so the problem is on your side. Can you open a ticket and check the node serving that address?" },
    ],
  },
  timeline: [
    { at: t(95), kind: "probe", text: "Provider edge: 38% packet loss" },
    { at: t(90), kind: "diagnosis", text: "Diagnosed ISP upstream loss (93% confidence)" },
    { at: t(70), kind: "fix", text: "Rebooted router — loss persisted" },
    { at: t(45), kind: "info", text: "Provider's fault — escalating" },
    { at: t(40), kind: "call", text: "Calling Peachtree Fiber support" },
  ],
};

export const mockStatus: StatusResponse = {
  snapshot: ispOutageSnapshot,
  incident: callingIncident,
  history: [],
  profile: demoProfile,
};
