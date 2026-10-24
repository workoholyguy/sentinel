import { describe, expect, it, vi } from "vitest";
import type { ExecResult } from "../types";
import { createMonitor, FALLBACK_EDGE } from "./index";
import { darwin, linux } from "./fixtures";

const ok = (stdout: string): ExecResult => ({ code: 0, stdout, stderr: "" });
const fail = (stdout = "", code = 1): ExecResult => ({ code, stdout, stderr: "" });

type Table = Record<string, (args: string[]) => ExecResult>;
function fakeExec(table: Table) {
  return vi.fn(async (cmd: string, args: string[]) => (table[cmd] ? table[cmd](args) : fail("", 127)));
}

const darwinHealthy: Table = {
  networksetup: () => ok(darwin.airportConnected),
  route: () => ok(darwin.routeDefault),
  traceroute: () => ok(darwin.traceroute),
  ping: (args) => ok(args.at(-1) === "192.168.1.1" ? darwin.pingOk : darwin.pingOk.replaceAll("192.168.1.1", args.at(-1)!)),
};

describe("createMonitor", () => {
  it("samples a healthy macOS network", async () => {
    const exec = fakeExec(darwinHealthy);
    const m = createMonitor({ platform: "darwin", exec, dnsLookup: async () => 18, httpProbe: async () => 24 });
    const s = await m.sample();
    expect(s.nodes).toEqual({ device: "ok", wifi: "ok", router: "ok", dns: "ok", isp: "ok", internet: "ok" });
    const gw = s.probes.find((p) => p.id === "ping-gateway")!;
    expect(gw).toMatchObject({ node: "router", status: "ok", latencyMs: 3.4, lossPct: 0, label: "Gateway ping 192.168.1.1" });
    expect(s.probes.find((p) => p.id === "ping-isp")!.label).toContain("68.85.130.13");
    expect(s.probes.find((p) => p.id === "wifi-link")!.label).toBe("Wi-Fi link (HackerHouse HQ)");
    expect(exec).toHaveBeenCalledWith("ping", expect.arrayContaining(["-W", "1000", "192.168.1.1"]));
  });

  it("falls back to ipconfig getsummary when networksetup redacts the SSID", async () => {
    const exec = fakeExec({ ...darwinHealthy, networksetup: () => ok(darwin.airportDisconnected), ipconfig: () => ok(darwin.ipconfigSummaryConnected) });
    const s = await createMonitor({ platform: "darwin", exec, dnsLookup: async () => 18, httpProbe: async () => 24 }).sample();
    expect(s.nodes.wifi).toBe("ok");
  });

  it("caches the provider edge between samples", async () => {
    const exec = fakeExec(darwinHealthy);
    const m = createMonitor({ platform: "darwin", exec, dnsLookup: async () => 18, httpProbe: async () => 24 });
    await m.sample();
    await m.sample();
    expect(exec.mock.calls.filter(([c]) => c === "traceroute")).toHaveLength(1);
  });

  it("handles a wired Linux box with DNS and internet failures", async () => {
    const exec = fakeExec({
      ip: () => ok(linux.routeDefault),
      traceroute: () => ok(linux.tracerouteDark),
      ping: (args) => ok(args.at(-1) === FALLBACK_EDGE ? linux.pingDead.replaceAll("172.16.255.1", FALLBACK_EDGE) : linux.pingOk),
    });
    const s = await createMonitor({
      platform: "linux",
      exec,
      dnsLookup: async () => {
        throw new Error("queryA ETIMEOUT example.com");
      },
      httpProbe: async () => {
        throw new Error("timeout after 5s");
      },
    }).sample();
    expect(s.nodes).toEqual({ device: "ok", wifi: "unknown", router: "ok", dns: "down", isp: "down", internet: "down" });
    expect(s.probes.find((p) => p.id === "ping-isp")!.label).toContain("edge not found");
    expect(s.probes.find((p) => p.id === "dns-system")!.detail).toContain("ETIMEOUT");
    expect(exec).toHaveBeenCalledWith("ping", ["-n", "-c", "3", "-i", "0.2", "-W", "1", "172.16.255.1"]);
  });

  it("reports a missing default route and Linux Wi-Fi via nmcli", async () => {
    const exec = fakeExec({
      nmcli: () => ok(linux.nmcliConnected),
      ip: () => ok(linux.routeNone),
      traceroute: () => ok(""),
      ping: () => ok(linux.pingDead),
    });
    const s = await createMonitor({ platform: "linux", exec, dnsLookup: async () => 18, httpProbe: async () => 24 }).sample();
    expect(s.nodes.wifi).toBe("ok");
    expect(s.probes.find((p) => p.id === "gateway-route")).toMatchObject({ status: "down" });
    expect(s.probes.find((p) => p.id === "ping-gateway")).toBeUndefined();
    expect(s.nodes.router).toBe("down");
  });

  it("marks Wi-Fi down when iw shows an unassociated interface", async () => {
    const exec = fakeExec({ nmcli: () => fail("", 127), iw: () => ok(linux.iwDisconnected), ip: () => ok(linux.routeNone), ping: () => ok(linux.pingDead) });
    const s = await createMonitor({ platform: "linux", exec, dnsLookup: async () => 18, httpProbe: async () => 24 }).sample();
    expect(s.nodes.wifi).toBe("down");
  });

  it("flags slow or lossy pings as degraded", async () => {
    const exec = fakeExec({ ...darwinHealthy, ping: (args) => ok(args.at(-1) === "192.168.1.1" ? darwin.pingOk : darwin.pingPartial) });
    const s = await createMonitor({ platform: "darwin", exec, dnsLookup: async () => 18, httpProbe: async () => 24 }).sample();
    expect(s.probes.find((p) => p.id === "ping-isp")).toMatchObject({ status: "degraded", lossPct: 33.3, latencyMs: 412.1 });
  });
});
