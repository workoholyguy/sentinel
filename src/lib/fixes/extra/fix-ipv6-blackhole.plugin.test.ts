import { describe, expect, it } from "vitest";
import type { ExecResult, FixContext } from "../../types";
import { isFixPlugin } from "../index";
import { formatCommand } from "../exec";
import { DARWIN_NET, LINUX_NET } from "../test-helpers";
import { fixIpv6Blackhole } from "./fix-ipv6-blackhole.plugin";

const CURL = 'curl -sS -o /dev/null -m 5 -w "%{http_code}" https://www.google.com';
const DARWIN_DISCOVERY = ["networksetup -listallnetworkservices", "route -n get default", "networksetup -listnetworkserviceorder"];
const V6_ON = { stdout: "DHCP Configuration\nIP address: 192.168.1.23\nIPv6: Automatic\n" };
const V6_OFF = { stdout: "DHCP Configuration\nIP address: 192.168.1.23\nIPv6: Off\n" };
const LINUX_KEY = "net.ipv6.conf.wlp2s0.disable_ipv6";

type Canned = Record<string, Partial<ExecResult>>;

/**
 * Fake exec: records every command; answers by longest matching prefix. Responses in `after`
 * take over once a command starting with `switchOn` has run, so state can change mid-repair.
 */
function fakeExec(platform: FixContext["platform"], before: Canned, after: Canned = {}, switchOn = "", dryRun = false) {
  const calls: string[] = [];
  let switched = false;
  const ctx: FixContext = {
    platform,
    dryRun,
    async exec(cmd, args) {
      const line = formatCommand(cmd, args);
      calls.push(line);
      const table = switched ? { ...before, ...after } : before;
      if (switchOn && line.startsWith(switchOn)) switched = true;
      if (dryRun) return { code: 0, stdout: "", stderr: "" };
      const key = Object.keys(table)
        .filter((k) => line.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      return { code: 0, stdout: "", stderr: "", ...(key ? table[key] : {}) };
    },
  };
  return { ctx, calls };
}

const darwin = (extra: Canned = {}, after: Canned = { "networksetup -getinfo": V6_OFF }) =>
  fakeExec("darwin", { ...DARWIN_NET, "networksetup -getinfo": V6_ON, curl: { stdout: "200" }, ...extra }, after, "networksetup -setv6off");
const linux = (extra: Canned = {}, after: Canned = { [`sysctl -n ${LINUX_KEY}`]: { stdout: "1\n" } }) =>
  fakeExec("linux", { ...LINUX_NET, [`sysctl -n ${LINUX_KEY}`]: { stdout: "0\n" }, curl: { stdout: "200" }, ...extra }, after, "sysctl -w");

describe("fix-ipv6-blackhole", () => {
  it("is a valid plugin for IPV6_BLACKHOLE on darwin and linux", () => {
    expect(isFixPlugin(fixIpv6Blackhole)).toBe(true);
    expect(fixIpv6Blackhole.id).toBe("fix-ipv6-blackhole");
    expect(fixIpv6Blackhole.handles).toEqual(["IPV6_BLACKHOLE"]);
    expect(fixIpv6Blackhole.platforms).toEqual(["darwin", "linux"]);
  });

  it("darwin: turns IPv6 off on the default-route service, checks it reads Off, then re-probes", async () => {
    const { ctx, calls } = darwin();
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r).toMatchObject({ pluginId: "fix-ipv6-blackhole", ok: true });
    expect(calls).toEqual([
      ...DARWIN_DISCOVERY,
      "networksetup -getinfo Wi-Fi",
      "networksetup -setv6off Wi-Fi",
      "networksetup -getinfo Wi-Fi",
      CURL,
    ]);
    expect(r.actions).toEqual(calls);
    expect(r.detail).toContain('IPv6 disabled on "Wi-Fi"');
  });

  it("darwin: is idempotent when IPv6 is already off", async () => {
    const { ctx, calls } = darwin({ "networksetup -getinfo": V6_OFF });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).not.toContain("networksetup -setv6off Wi-Fi");
    expect(r.detail).toContain("already off");
  });

  it("darwin: quotes multi-word services, skips disabled ones, falls back without a default route", async () => {
    const multi = darwin({
      "networksetup -listallnetworkservices": { stdout: "An asterisk (*) denotes that a network service is disabled.\nUSB 10/100/1000 LAN\n" },
      "route -n get default": { stdout: "interface: en5\n" },
      "networksetup -listnetworkserviceorder": { stdout: "(1) USB 10/100/1000 LAN\n(Hardware Port: USB 10/100/1000 LAN, Device: en5)\n" },
    });
    await fixIpv6Blackhole.run(multi.ctx);
    expect(multi.calls).toContain('networksetup -setv6off "USB 10/100/1000 LAN"');

    const disabled = darwin({
      "networksetup -listallnetworkservices": { stdout: "*Wi-Fi\nEthernet\n" },
    });
    await fixIpv6Blackhole.run(disabled.ctx);
    expect(disabled.calls).toContain("networksetup -setv6off Ethernet");

    const noRoute = darwin({ "networksetup -listallnetworkservices": { stdout: "" }, "route -n get default": { code: 1 } });
    await fixIpv6Blackhole.run(noRoute.ctx);
    expect(noRoute.calls).toContain("networksetup -setv6off Wi-Fi");
  });

  it("darwin: reports a failing command without throwing and skips the re-probe", async () => {
    const { ctx, calls } = darwin({ "networksetup -setv6off": { code: 14, stderr: "** Error: The parameters were not valid.\n" } });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("networksetup -setv6off Wi-Fi failed (14): ** Error: The parameters were not valid.");
    expect(r.actions.at(-1)).toBe("networksetup -setv6off Wi-Fi");
    expect(calls).not.toContain(CURL);
  });

  it("darwin: fails when IPv6 still reads on after setv6off", async () => {
    const { ctx, calls } = darwin({}, {});
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe('IPv6 still reported on for "Wi-Fi" after networksetup -setv6off Wi-Fi');
    expect(calls).not.toContain(CURL);
  });

  it("linux: disables IPv6 on the default-route interface, checks the sysctl, then re-probes", async () => {
    const { ctx, calls } = linux();
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([
      "ip route show default",
      `sysctl -n ${LINUX_KEY}`,
      `sysctl -w ${LINUX_KEY}=1`,
      `sysctl -n ${LINUX_KEY}`,
      CURL,
    ]);
    expect(r.actions).toEqual(calls);
  });

  it("linux: is idempotent when IPv6 is already disabled", async () => {
    const { ctx, calls } = linux({ [`sysctl -n ${LINUX_KEY}`]: { stdout: "1\n" } });
    expect((await fixIpv6Blackhole.run(ctx)).ok).toBe(true);
    expect(calls.some((c) => c.startsWith("sysctl -w"))).toBe(false);
  });

  it("linux: falls back to the first non-loopback link and handles VLAN names", async () => {
    const fallback = linux({
      "ip route show default": { stdout: "" },
      "ip -o link show": { stdout: "1: lo: <LOOPBACK> mtu 65536\n2: enp3s0: <BROADCAST> mtu 1500\n" },
    });
    await fixIpv6Blackhole.run(fallback.ctx);
    expect(fallback.calls).toContain("sysctl -w net.ipv6.conf.enp3s0.disable_ipv6=1");

    const vlan = linux({ "ip route show default": { stdout: "default via 10.0.0.1 dev eth0.100\n" } });
    await fixIpv6Blackhole.run(vlan.ctx);
    expect(vlan.calls).toContain("sysctl -w net.ipv6.conf.eth0/100.disable_ipv6=1");
  });

  it("linux: reports a permission failure from sysctl", async () => {
    const { ctx, calls } = linux({ "sysctl -w": { code: 255, stderr: "sysctl: permission denied on key" } });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("permission denied");
    expect(calls).not.toContain(CURL);
  });

  it("reports when the re-probe still fails after disabling IPv6", async () => {
    const { ctx } = linux({ curl: { code: 28, stderr: "curl: (28) Connection timed out" } });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.actions.at(-1)).toBe(CURL);
    expect(r.detail).toContain("re-probe still failed (28)");
  });

  it("dry run succeeds on both platforms with every command recorded", async () => {
    const d = fakeExec("darwin", {}, {}, "", true);
    expect((await fixIpv6Blackhole.run(d.ctx)).ok).toBe(true);
    expect(d.calls).toContain("networksetup -setv6off Wi-Fi");

    const l = fakeExec("linux", {}, {}, "", true);
    expect((await fixIpv6Blackhole.run(l.ctx)).ok).toBe(true);
    expect(l.calls).toContain("sysctl -w net.ipv6.conf.eth0.disable_ipv6=1");
  });

  it("rejects an unsupported platform", async () => {
    const { ctx, calls } = fakeExec("linux", {});
    const r = await fixIpv6Blackhole.run({ ...ctx, platform: "win32" } as unknown as FixContext);
    expect(r).toEqual({ pluginId: "fix-ipv6-blackhole", ok: false, actions: [], detail: "Unsupported platform: win32" });
    expect(calls).toEqual([]);
  });
});
