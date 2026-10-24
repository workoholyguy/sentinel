import { describe, expect, it } from "vitest";
import type { Probe, Snapshot } from "../types";
import { healthySnapshot, ispOutageSnapshot } from "../mock";
import { nodesFromProbes } from "../monitor";
import { diagnose } from "./index";

const AT = "2026-10-24T12:58:00.000Z";

/** Healthy baseline (as the live monitor emits it) with per-probe overrides. */
function snap(over: Record<string, Partial<Probe> | null> = {}, at = AT): Snapshot {
  const base: Probe[] = [
    { id: "wifi-link", node: "wifi", label: "Wi-Fi link (HackerHouse HQ)", status: "ok", at },
    { id: "gateway-route", node: "router", label: "Default gateway", status: "ok", detail: "192.168.1.1 via en0", at },
    { id: "ping-gateway", node: "router", label: "Gateway ping 192.168.1.1", status: "ok", latencyMs: 3, lossPct: 0, at },
    { id: "dns-system", node: "dns", label: "DNS lookup example.com", status: "ok", latencyMs: 18, at },
    { id: "ping-isp", node: "isp", label: "ISP edge ping 68.85.130.13", status: "ok", latencyMs: 9, lossPct: 0, at },
    { id: "http-cloudflare", node: "internet", label: "HTTPS 1.1.1.1", status: "ok", latencyMs: 24, at },
  ];
  const probes = base.flatMap((p) => (over[p.id] === null ? [] : [{ ...p, ...over[p.id] } as Probe]));
  return { at, probes, nodes: nodesFromProbes(probes) };
}

function expectWellFormed(d: ReturnType<typeof diagnose>) {
  expect(d).not.toBeNull();
  expect(d!.confidence).toBeGreaterThan(0);
  expect(d!.confidence).toBeLessThanOrEqual(1);
  expect(d!.summary).not.toMatch(/\n/);
  expect(d!.evidence.length).toBeGreaterThanOrEqual(2);
  expect(d!.evidence.length).toBeLessThanOrEqual(5);
}

describe("diagnose", () => {
  it("returns null for healthy snapshots", () => {
    expect(diagnose(healthySnapshot)).toBeNull();
    expect(diagnose(snap())).toBeNull();
  });

  it("mock ISP outage (38% loss at the edge) → ISP_UPSTREAM_LOSS", () => {
    const d = diagnose(ispOutageSnapshot);
    expectWellFormed(d);
    expect(d).toMatchObject({ fault: "ISP_UPSTREAM_LOSS", blame: "isp" });
    expect(d!.confidence).toBeGreaterThan(0.9);
    expect(d!.evidence[0]).toBe("Router answers in 3 ms with 0% loss — your local network is healthy");
    expect(d!.evidence[1]).toBe("Provider edge: 38% packet loss, 412 ms latency");
  });

  it("WIFI_DISCONNECTED", () => {
    const d = diagnose(
      snap({
        "wifi-link": { status: "down", detail: "not associated with any network" },
        "gateway-route": { status: "down" },
        "ping-gateway": null,
        "http-cloudflare": { status: "down", detail: "fetch failed" },
      }),
    );
    expectWellFormed(d);
    expect(d).toMatchObject({ fault: "WIFI_DISCONNECTED", blame: "local" });
  });

  it("DHCP_NO_LEASE", () => {
    const d = diagnose(snap({ "gateway-route": { status: "down", detail: "no default route (no DHCP lease?)" }, "ping-gateway": null, "http-cloudflare": { status: "down", detail: "fetch failed" } }));
    expectWellFormed(d);
    expect(d).toMatchObject({ fault: "DHCP_NO_LEASE", blame: "local" });
  });

  it("GATEWAY_UNREACHABLE", () => {
    const d = diagnose(snap({ "ping-gateway": { status: "down", lossPct: 100, latencyMs: undefined }, "ping-isp": { status: "down", lossPct: 100, latencyMs: undefined }, "http-cloudflare": { status: "down" } }));
    expectWellFormed(d);
    expect(d).toMatchObject({ fault: "GATEWAY_UNREACHABLE", blame: "router" });
    expect(d!.summary).toContain("192.168.1.1");
    expect(d!.evidence).toContain("Router 192.168.1.1: 100% packet loss");
  });

  it("GATEWAY_UNREACHABLE with partial loss is less confident", () => {
    const dead = diagnose(
      snap({ "ping-gateway": { status: "down", lossPct: 100, latencyMs: undefined }, "ping-isp": { status: "down", lossPct: 100, latencyMs: undefined }, "http-cloudflare": { status: "down" } }),
    )!;
    const lossy = diagnose(snap({ "ping-gateway": { status: "degraded", lossPct: 33.3, latencyMs: 4 } }))!;
    expect(lossy.fault).toBe("GATEWAY_UNREACHABLE");
    expect(lossy.confidence).toBeLessThan(dead.confidence);
  });

  it("DNS_RESOLVER_DOWN", () => {
    const d = diagnose(snap({ "dns-system": { status: "down", latencyMs: undefined, detail: "queryA ETIMEOUT example.com" } }));
    expectWellFormed(d);
    expect(d).toMatchObject({ fault: "DNS_RESOLVER_DOWN", blame: "local" });
    expect(d!.evidence).toContain("HTTPS to 1.1.1.1 by IP works (24 ms)");
  });

  it("ISP_UPSTREAM_LOSS from latency alone", () => {
    const d = diagnose(snap({ "ping-isp": { status: "degraded", latencyMs: 240, lossPct: 0 } }));
    expect(d).toMatchObject({ fault: "ISP_UPSTREAM_LOSS", blame: "isp" });
  });

  it("ISP_OUTAGE", () => {
    const d = diagnose(
      snap({
        "ping-isp": { status: "down", lossPct: 100, latencyMs: undefined },
        "http-cloudflare": { status: "down", detail: "timeout after 5s", latencyMs: undefined },
        "dns-system": { status: "down", latencyMs: undefined },
      }),
    );
    expectWellFormed(d);
    expect(d).toMatchObject({ fault: "ISP_OUTAGE", blame: "isp" });
    expect(d!.evidence).toContain("Provider edge 68.85.130.13: 100% packet loss, no replies");
  });

  it("SLOW_SPEED beyond the router blames the provider", () => {
    const d = diagnose(snap({ "dns-system": { latencyMs: 450, status: "degraded" }, "http-cloudflare": { latencyMs: 1600, status: "degraded" }, "ping-isp": { latencyMs: 120 } }));
    expect(d).toMatchObject({ fault: "SLOW_SPEED", blame: "isp" });
  });

  it("SLOW_SPEED starting at the router blames the local network", () => {
    const d = diagnose(snap({ "ping-gateway": { latencyMs: 180, status: "degraded" }, "ping-isp": { latencyMs: 190, status: "degraded" }, "http-cloudflare": { latencyMs: 900 } }));
    expectWellFormed(d);
    expect(d).toMatchObject({ fault: "SLOW_SPEED", blame: "local" });
  });

  it("treats a router or provider edge that ignores ping as filtered when traffic still flows", () => {
    expect(diagnose(snap({ "ping-gateway": { status: "down", lossPct: 100, latencyMs: undefined } }))).toBeNull();
    expect(diagnose(snap({ "ping-isp": { status: "down", lossPct: 100, latencyMs: undefined } }))).toBeNull();
    const d = diagnose(snap({ "ping-gateway": { status: "down", lossPct: 100, latencyMs: undefined }, "dns-system": { status: "down", latencyMs: undefined } }));
    expect(d).toMatchObject({ fault: "DNS_RESOLVER_DOWN" });
    expect(d!.evidence[0]).toBe("Router 192.168.1.1 ignores ping, but traffic passes through it");
  });

  it("UNKNOWN when something is off but no rule matches", () => {
    const d = diagnose(snap({ "http-cloudflare": { status: "down", detail: "HTTP 503" } }));
    expect(d).toMatchObject({ fault: "UNKNOWN", blame: "unknown" });
  });

  it("adds duration evidence from recent snapshots", () => {
    const t = (s: number) => new Date(Date.parse(AT) - s * 1000).toISOString();
    const lossy = { "ping-isp": { status: "degraded" as const, lossPct: 38, latencyMs: 412 } };
    const recent = [snap({}, t(120)), snap(lossy, t(95)), snap(lossy, t(50))];
    const d = diagnose(snap(lossy), recent);
    expectWellFormed(d);
    expect(d!.evidence.at(-1)).toBe("Problem has lasted 95 seconds");
    expect(diagnose(snap(lossy))!.evidence.some((e) => e.includes("lasted"))).toBe(false);
  });
});
