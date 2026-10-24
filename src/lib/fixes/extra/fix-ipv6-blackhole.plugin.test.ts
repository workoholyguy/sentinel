import { describe, expect, it } from "vitest";
import type { FixContext } from "../../types";
import { isFixPlugin } from "../index";
import { DARWIN_NET, LINUX_NET, fakeCtx } from "../test-helpers";
import { fixIpv6Blackhole } from "./fix-ipv6-blackhole.plugin";

const CURL = 'curl -sS -o /dev/null -m 5 -w "%{http_code}" https://www.google.com';
const OK_PROBE = { [CURL]: { stdout: "200" } };

describe("fix-ipv6-blackhole", () => {
  it("is a valid plugin for IPV6_BLACKHOLE on darwin and linux", () => {
    expect(isFixPlugin(fixIpv6Blackhole)).toBe(true);
    expect(fixIpv6Blackhole.id).toBe("fix-ipv6-blackhole");
    expect(fixIpv6Blackhole.handles).toEqual(["IPV6_BLACKHOLE"]);
    expect(fixIpv6Blackhole.platforms).toEqual(["darwin", "linux"]);
  });

  it("darwin: turns IPv6 off on the default-route service and re-probes", async () => {
    const { ctx, calls } = fakeCtx("darwin", { ...DARWIN_NET, ...OK_PROBE });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r).toMatchObject({ pluginId: "fix-ipv6-blackhole", ok: true });
    expect(calls).toEqual(["route -n get default", "networksetup -listnetworkserviceorder", "networksetup -setv6off Wi-Fi", CURL]);
    expect(r.actions).toEqual(["networksetup -setv6off Wi-Fi", CURL]);
    expect(r.detail).toContain('"Wi-Fi"');
  });

  it("darwin: quotes multi-word services and falls back to Wi-Fi without a default route", async () => {
    const multi = fakeCtx("darwin", {
      ...OK_PROBE,
      "route -n get default": { stdout: "interface: en5\n" },
      "networksetup -listnetworkserviceorder": { stdout: "(1) USB 10/100/1000 LAN\n(Hardware Port: USB 10/100/1000 LAN, Device: en5)\n" },
    });
    expect((await fixIpv6Blackhole.run(multi.ctx)).actions[0]).toBe('networksetup -setv6off "USB 10/100/1000 LAN"');

    const noRoute = fakeCtx("darwin", { ...OK_PROBE, "route -n get default": { code: 1 } });
    await fixIpv6Blackhole.run(noRoute.ctx);
    expect(noRoute.calls).toContain("networksetup -setv6off Wi-Fi");
  });

  it("linux: disables IPv6 on the default-route interface and re-probes", async () => {
    const { ctx, calls } = fakeCtx("linux", { ...LINUX_NET, ...OK_PROBE });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual(["ip route show default", "sysctl -w net.ipv6.conf.wlp2s0.disable_ipv6=1", CURL]);
    expect(r.actions).toEqual(["sysctl -w net.ipv6.conf.wlp2s0.disable_ipv6=1", CURL]);
  });

  it("linux: falls back to the first non-loopback link", async () => {
    const { ctx, calls } = fakeCtx("linux", {
      ...OK_PROBE,
      "ip route show default": { stdout: "" },
      "ip -o link show": { stdout: "1: lo: <LOOPBACK> mtu 65536\n2: enp3s0: <BROADCAST> mtu 1500\n" },
    });
    expect((await fixIpv6Blackhole.run(ctx)).ok).toBe(true);
    expect(calls).toContain("sysctl -w net.ipv6.conf.enp3s0.disable_ipv6=1");
  });

  it("reports a failing command without throwing and skips the re-probe", async () => {
    const { ctx, calls } = fakeCtx("darwin", {
      ...DARWIN_NET,
      "networksetup -setv6off": { code: 14, stderr: "** Error: The parameters were not valid.\n" },
    });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("networksetup -setv6off Wi-Fi failed (14): ** Error: The parameters were not valid.");
    expect(r.actions).toEqual(["networksetup -setv6off Wi-Fi"]);
    expect(calls).not.toContain(CURL);
  });

  it("linux: reports a permission failure from sysctl", async () => {
    const { ctx } = fakeCtx("linux", { ...LINUX_NET, sysctl: { code: 255, stderr: "sysctl: permission denied on key" } });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("permission denied");
  });

  it("reports when the re-probe still fails after disabling IPv6", async () => {
    const { ctx } = fakeCtx("linux", { ...LINUX_NET, curl: { code: 28, stderr: "curl: (28) Connection timed out" } });
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.actions).toEqual(["sysctl -w net.ipv6.conf.wlp2s0.disable_ipv6=1", CURL]);
    expect(r.detail).toContain("re-probe still failed (28)");
  });

  it("dry run succeeds with every command recorded", async () => {
    const { ctx, calls } = fakeCtx("darwin", {}, true);
    const r = await fixIpv6Blackhole.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toContain("networksetup -setv6off Wi-Fi");
  });

  it("rejects an unsupported platform", async () => {
    const { ctx, calls } = fakeCtx("linux");
    const r = await fixIpv6Blackhole.run({ ...ctx, platform: "win32" } as unknown as FixContext);
    expect(r).toEqual({ pluginId: "fix-ipv6-blackhole", ok: false, actions: [], detail: "Unsupported platform: win32" });
    expect(calls).toEqual([]);
  });
});
