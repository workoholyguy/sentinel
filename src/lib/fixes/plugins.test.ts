import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearRecordedCommands, createExecContext, getRecordedCommands } from "./exec";
import { dhcpRenew } from "./plugins/dhcp-renew";
import { dnsFlushCache } from "./plugins/dns-flush-cache";
import { dnsSwitchResolver, restoreDnsDefaults } from "./plugins/dns-switch-resolver";
import { routerReboot } from "./plugins/router-reboot";
import { wifiReconnect } from "./plugins/wifi-reconnect";
import type { FaultFixContext } from "./util";
import { DARWIN_NET, LINUX_NET, fakeCtx } from "./test-helpers";

const mutating = (calls: string[]) => calls.filter((c) => !/^(route -n get|networksetup -list|ip (route|-o link)|nmcli -t)/.test(c));

describe("dns-flush-cache", () => {
  it("darwin", async () => {
    const { ctx, calls } = fakeCtx("darwin");
    expect((await dnsFlushCache.run(ctx)).ok).toBe(true);
    expect(calls).toEqual(["dscacheutil -flushcache", "killall -HUP mDNSResponder"]);
  });
  it("linux", async () => {
    const { ctx, calls } = fakeCtx("linux");
    expect((await dnsFlushCache.run(ctx)).ok).toBe(true);
    expect(calls).toEqual(["resolvectl flush-caches"]);
  });
  it("reports a failing step and stops", async () => {
    const { ctx, calls } = fakeCtx("darwin", { dscacheutil: { code: 1, stderr: "sudo: a password is required" } });
    const r = await dnsFlushCache.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("password is required");
    expect(calls).toEqual(["dscacheutil -flushcache"]);
  });
});

describe("dns-switch-resolver", () => {
  it("darwin maps the default-route interface to its service name", async () => {
    const { ctx, calls } = fakeCtx("darwin", DARWIN_NET);
    const r = await dnsSwitchResolver.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toContain("networksetup -listallnetworkservices");
    expect(calls).toContain("route -n get default");
    expect(mutating(calls)).toEqual(['networksetup -setdnsservers Wi-Fi 1.1.1.1 8.8.8.8']);
  });
  it("darwin quotes multi-word service names", async () => {
    const { ctx, calls } = fakeCtx("darwin", {
      ...DARWIN_NET,
      "route -n get default": { stdout: "interface: en5\n" },
      "networksetup -listallnetworkservices": { stdout: "USB 10/100/1000 LAN\nWi-Fi\n" },
      "networksetup -listnetworkserviceorder": {
        stdout: "(1) USB 10/100/1000 LAN\n(Hardware Port: USB 10/100/1000 LAN, Device: en5)\n\n(2) Wi-Fi\n(Hardware Port: Wi-Fi, Device: en0)\n",
      },
    });
    await dnsSwitchResolver.run(ctx);
    expect(mutating(calls)).toEqual(['networksetup -setdnsservers "USB 10/100/1000 LAN" 1.1.1.1 8.8.8.8']);
  });
  it("linux", async () => {
    const { ctx, calls } = fakeCtx("linux", LINUX_NET);
    await dnsSwitchResolver.run(ctx);
    expect(mutating(calls)).toEqual(["resolvectl dns wlp2s0 1.1.1.1 8.8.8.8"]);
  });
  it("restoreDnsDefaults darwin + linux", async () => {
    const d = fakeCtx("darwin", DARWIN_NET);
    expect((await restoreDnsDefaults(d.ctx)).ok).toBe(true);
    expect(mutating(d.calls)).toEqual(['networksetup -setdnsservers Wi-Fi empty']);
    const l = fakeCtx("linux", LINUX_NET);
    await restoreDnsDefaults(l.ctx);
    expect(mutating(l.calls)).toEqual(["resolvectl revert wlp2s0"]);
  });
});

describe("dhcp-renew", () => {
  it("darwin", async () => {
    const { ctx, calls } = fakeCtx("darwin", DARWIN_NET);
    await dhcpRenew.run(ctx);
    expect(mutating(calls)).toEqual(["ipconfig set en0 DHCP"]);
  });
  it("darwin falls back to the Wi-Fi device when there is no default route", async () => {
    const { ctx, calls } = fakeCtx("darwin", { ...DARWIN_NET, "route -n get default": { code: 1 } });
    await dhcpRenew.run(ctx);
    expect(mutating(calls)).toEqual(["ipconfig set en1 DHCP"]);
  });
  it("linux prefers nmcli con up", async () => {
    const { ctx, calls } = fakeCtx("linux", {
      ...LINUX_NET,
      "nmcli -t": { stdout: "Office: 5G:wlp2s0\nWired connection 1:eth0\n" },
    });
    const r = await dhcpRenew.run(ctx);
    expect(r.ok).toBe(true);
    expect(mutating(calls)).toEqual(['nmcli con up "Office: 5G"']);
  });
  it("linux falls back to dhclient without NetworkManager", async () => {
    const { ctx, calls } = fakeCtx("linux", { ...LINUX_NET, "nmcli -t": { code: 127 } });
    await dhcpRenew.run(ctx);
    expect(mutating(calls)).toEqual(["dhclient -r wlp2s0", "dhclient wlp2s0"]);
  });
});

describe("wifi-reconnect", () => {
  it("darwin", async () => {
    const { ctx, calls } = fakeCtx("darwin", DARWIN_NET);
    await wifiReconnect.run(ctx);
    expect(mutating(calls)).toEqual(["networksetup -setairportpower en1 off", "networksetup -setairportpower en1 on"]);
  });
  it("linux", async () => {
    const { ctx, calls } = fakeCtx("linux");
    await wifiReconnect.run(ctx);
    expect(calls).toEqual(["nmcli radio wifi off", "nmcli radio wifi on"]);
  });
});

describe("router-reboot", () => {
  const prev = process.env.SENTINEL_DEMO;
  beforeEach(() => clearRecordedCommands());
  afterEach(() => {
    if (prev === undefined) delete process.env.SENTINEL_DEMO;
    else process.env.SENTINEL_DEMO = prev;
  });

  it("dryRun: simulated reboot, ISP loss persists", async () => {
    const ctx = createExecContext({ platform: "darwin", dryRun: true });
    const r = await routerReboot.run({ ...ctx, fault: "ISP_UPSTREAM_LOSS" } as FaultFixContext);
    expect(r).toMatchObject({ ok: false, detail: "Loss persisted after reboot" });
    expect(getRecordedCommands()).toEqual(["Rebooted router (simulated)"]);
    expect((await routerReboot.run({ ...ctx, fault: "ISP_OUTAGE" } as FaultFixContext)).ok).toBe(false);
  });
  it("SENTINEL_DEMO=1: gateway fault is simulated as fixed", async () => {
    process.env.SENTINEL_DEMO = "1";
    const { ctx } = fakeCtx("linux");
    expect(await routerReboot.run({ ...ctx, fault: "GATEWAY_UNREACHABLE" } as FaultFixContext)).toMatchObject({ ok: true, actions: ["Rebooted router (simulated)"] });
  });
  it("outside demo/dryRun it does nothing and fails", async () => {
    delete process.env.SENTINEL_DEMO;
    const { ctx, calls } = fakeCtx("linux");
    expect((await routerReboot.run({ ...ctx, fault: "GATEWAY_UNREACHABLE" } as FaultFixContext)).ok).toBe(false);
    expect(calls).toEqual([]);
    expect(getRecordedCommands()).toEqual([]);
  });
});

describe("dryRun end-to-end", () => {
  beforeEach(() => clearRecordedCommands());
  it("records sudo -n prefixed commands", async () => {
    const ctx = createExecContext({ platform: "darwin", dryRun: true, sudo: true });
    await dnsFlushCache.run(ctx);
    expect(getRecordedCommands()).toEqual(["sudo -n dscacheutil -flushcache", "sudo -n killall -HUP mDNSResponder"]);
  });
});
