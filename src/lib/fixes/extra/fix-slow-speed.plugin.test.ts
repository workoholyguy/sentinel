import { describe, expect, it } from "vitest";
import type { FixContext } from "../../types";
import { isFixPlugin } from "../index";
import { DARWIN_NET, LINUX_NET, fakeCtx } from "../test-helpers";
import { fixSlowSpeed, parseAvgRtt } from "./fix-slow-speed.plugin";

const DARWIN_PING = "ping -q -c 3 -t 5 192.168.1.1";
const LINUX_PING = "ping -q -c 3 -w 5 192.168.1.1";
const darwinRtt = (avg: number) => ({ stdout: `round-trip min/avg/max/stddev = 1.000/${avg}/300.000/5.000 ms\n` });
const linuxRtt = (avg: number) => ({ stdout: `rtt min/avg/max/mdev = 1.000/${avg}/300.000/5.000 ms\n` });

/** Fake ping that answers slowly the first time and fast afterwards. */
function slowThenFast(ctx: FixContext, slow: { stdout: string }, fast: { stdout: string }): FixContext {
  let pings = 0;
  return {
    ...ctx,
    async exec(cmd, args) {
      const r = await ctx.exec(cmd, args);
      if (cmd !== "ping") return r;
      return { ...r, ...(pings++ === 0 ? slow : fast) };
    },
  };
}

// DARWIN_NET's Wi-Fi is en1; make it the default-route interface.
const DARWIN_WIFI = { ...DARWIN_NET, "route -n get default": { stdout: "    gateway: 192.168.1.1\n  interface: en1\n" } };

describe("fix-slow-speed", () => {
  it("is a valid plugin for SLOW_SPEED on darwin and linux", () => {
    expect(isFixPlugin(fixSlowSpeed)).toBe(true);
    expect(fixSlowSpeed.id).toBe("fix-slow-speed");
    expect(fixSlowSpeed.handles).toEqual(["SLOW_SPEED"]);
    expect(fixSlowSpeed.platforms).toEqual(["darwin", "linux"]);
  });

  it("parses darwin and linux ping summaries", () => {
    expect(parseAvgRtt(darwinRtt(221.6).stdout)).toBe(221.6);
    expect(parseAvgRtt(linuxRtt(4.2).stdout)).toBe(4.2);
    expect(parseAvgRtt("")).toBeUndefined();
  });

  it("darwin: cycles Wi-Fi, flushes DNS and verifies the gateway is fast again", async () => {
    const { ctx, calls } = fakeCtx("darwin", DARWIN_WIFI);
    const r = await fixSlowSpeed.run(slowThenFast(ctx, darwinRtt(221.6), darwinRtt(4.1)));
    const repair = [
      "networksetup -setairportpower en1 off",
      "networksetup -setairportpower en1 on",
      "ipconfig waitall",
      "dscacheutil -flushcache",
      "killall -HUP mDNSResponder",
    ];
    expect(r).toMatchObject({ pluginId: "fix-slow-speed", ok: true });
    expect(r.actions).toEqual([DARWIN_PING, ...repair, DARWIN_PING]);
    expect(calls).toEqual(["route -n get default", DARWIN_PING, "networksetup -listallhardwareports", ...repair, DARWIN_PING]);
    expect(r.detail).toContain("now 4.1 ms (was 221.6 ms)");
  });

  it("darwin: on wired ethernet only flushes DNS (no Wi-Fi toggle)", async () => {
    const { ctx } = fakeCtx("darwin", DARWIN_NET); // default route on en0, Wi-Fi is en1
    const r = await fixSlowSpeed.run(slowThenFast(ctx, darwinRtt(250), darwinRtt(3)));
    expect(r.ok).toBe(true);
    expect(r.actions).toEqual([DARWIN_PING, "dscacheutil -flushcache", "killall -HUP mDNSResponder", DARWIN_PING]);
  });

  it("linux: reconnects the interface via nmcli, flushes DNS and verifies", async () => {
    const { ctx, calls } = fakeCtx("linux", LINUX_NET);
    const r = await fixSlowSpeed.run(slowThenFast(ctx, linuxRtt(221.6), linuxRtt(2.5)));
    const repair = ["nmcli device disconnect wlp2s0", "nmcli --wait 20 device connect wlp2s0", "resolvectl flush-caches"];
    expect(r.ok).toBe(true);
    expect(r.actions).toEqual([LINUX_PING, ...repair, LINUX_PING]);
    expect(calls).toEqual(["ip route show default", LINUX_PING, ...repair, LINUX_PING]);
  });

  it("is idempotent: a fast gateway is left untouched", async () => {
    const { ctx, calls } = fakeCtx("darwin", { ...DARWIN_WIFI, ping: darwinRtt(3.2) });
    const r = await fixSlowSpeed.run(ctx);
    expect(r).toMatchObject({ ok: true, actions: [DARWIN_PING] });
    expect(calls).toEqual(["route -n get default", DARWIN_PING]);
  });

  it("reports a failing command without throwing and stops", async () => {
    const { ctx, calls } = fakeCtx("darwin", {
      ...DARWIN_WIFI,
      ping: darwinRtt(221.6),
      "networksetup -setairportpower en1 off": { code: 10, stderr: "Error: not permitted\n" },
    });
    const r = await fixSlowSpeed.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("networksetup -setairportpower en1 off failed (10): Error: not permitted");
    expect(r.actions).toEqual([DARWIN_PING, "networksetup -setairportpower en1 off"]);
    expect(calls).not.toContain("dscacheutil -flushcache");
  });

  it("linux: reports an nmcli failure", async () => {
    const { ctx } = fakeCtx("linux", { ...LINUX_NET, ping: linuxRtt(200), "nmcli --wait": { code: 4, stderr: "Error: timeout" } });
    const r = await fixSlowSpeed.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("nmcli --wait 20 device connect wlp2s0 failed (4): Error: timeout");
  });

  it("reports when the gateway is still slow after the repair", async () => {
    const { ctx } = fakeCtx("linux", { ...LINUX_NET, ping: linuxRtt(210) });
    const r = await fixSlowSpeed.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.actions.at(-1)).toBe(LINUX_PING);
    expect(r.detail).toContain("still slow: 210 ms before, 210 ms after");
  });

  it("reports a failing re-probe", async () => {
    const { ctx } = fakeCtx("linux", LINUX_NET);
    let pings = 0;
    const r = await fixSlowSpeed.run({
      ...ctx,
      async exec(cmd, args) {
        const res = await ctx.exec(cmd, args);
        if (cmd !== "ping") return res;
        return pings++ === 0 ? { ...res, ...linuxRtt(200) } : { code: 1, stdout: "", stderr: "100% packet loss" };
      },
    });
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("Gateway 192.168.1.1 re-probe failed (1): 100% packet loss");
  });

  it("fails without a default gateway and changes nothing", async () => {
    const { ctx, calls } = fakeCtx("darwin", { "route -n get default": { code: 1 } });
    const r = await fixSlowSpeed.run(ctx);
    expect(r).toMatchObject({ ok: false, actions: [] });
    expect(calls).toEqual(["route -n get default"]);
  });

  it("dry run succeeds with the repair commands recorded", async () => {
    const { ctx, calls } = fakeCtx("darwin", DARWIN_WIFI, true);
    const r = await fixSlowSpeed.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toContain("networksetup -setairportpower en1 off");
    expect(calls).toContain("killall -HUP mDNSResponder");
  });

  it("rejects an unsupported platform", async () => {
    const { ctx, calls } = fakeCtx("linux");
    const r = await fixSlowSpeed.run({ ...ctx, platform: "win32" } as unknown as FixContext);
    expect(r).toEqual({ pluginId: "fix-slow-speed", ok: false, actions: [], detail: "Unsupported platform: win32" });
    expect(calls).toEqual([]);
  });
});
