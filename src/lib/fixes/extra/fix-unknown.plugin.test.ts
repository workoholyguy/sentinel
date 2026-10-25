import { describe, expect, it } from "vitest";
import type { FixContext } from "../../types";
import { isFixPlugin } from "../index";
import { fakeCtx } from "../test-helpers";
import { fixUnknown } from "./fix-unknown.plugin";

const CURL = 'curl -sS -o /dev/null -m 5 -w "%{http_code}" https://1.1.1.1';
const DARWIN_ROUTE = {
  "route -n get default": { stdout: "   route to: default\ndestination: default\n    gateway: 10.0.2.1\n  interface: en0\n" },
};
const LINUX_ROUTE = { "ip route show default": { stdout: "default via 10.0.2.1 dev wlp2s0 proto dhcp metric 600\n" } };
const OK = { [CURL]: { stdout: "200" } };

describe("fix-unknown", () => {
  it("is a valid plugin for UNKNOWN / GATEWAY_UNREACHABLE on darwin and linux", () => {
    expect(isFixPlugin(fixUnknown)).toBe(true);
    expect(fixUnknown.id).toBe("fix-unknown");
    expect(fixUnknown.handles).toEqual(["UNKNOWN", "GATEWAY_UNREACHABLE"]);
    expect(fixUnknown.platforms).toEqual(["darwin", "linux"]);
  });

  it("darwin: flushes the gateway ARP entry, renews DHCP and re-probes", async () => {
    const { ctx, calls } = fakeCtx("darwin", { ...DARWIN_ROUTE, ...OK });
    const r = await fixUnknown.run(ctx);
    expect(r).toMatchObject({ pluginId: "fix-unknown", ok: true });
    expect(calls).toEqual([
      "route -n get default",
      "arp -d 10.0.2.1",
      "ipconfig set en0 DHCP",
      "route -n get default",
      "ping -c 3 -t 5 10.0.2.1",
      CURL,
    ]);
    expect(r.actions).toEqual(["arp -d 10.0.2.1", "ipconfig set en0 DHCP", "ping -c 3 -t 5 10.0.2.1", CURL]);
    expect(r.detail).toContain("gateway 10.0.2.1 answers");
  });

  it("darwin: a missing ARP entry is not fatal", async () => {
    const { ctx, calls } = fakeCtx("darwin", {
      ...DARWIN_ROUTE,
      ...OK,
      arp: { code: 1, stderr: "arp: 10.0.2.1: cannot locate 10.0.2.1" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toContain("ipconfig set en0 DHCP");
    expect(r.detail).toContain("ARP flush skipped (1)");
  });

  it("darwin: reports a failing DHCP renewal without throwing and skips the re-probe", async () => {
    const { ctx, calls } = fakeCtx("darwin", {
      ...DARWIN_ROUTE,
      ipconfig: { code: 1, stderr: "ipconfig: setting DHCP failed: Operation not permitted\n" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r).toEqual({
      pluginId: "fix-unknown",
      ok: false,
      actions: ["arp -d 10.0.2.1", "ipconfig set en0 DHCP"],
      detail: "ipconfig set en0 DHCP failed (1): ipconfig: setting DHCP failed: Operation not permitted",
    });
    expect(calls).not.toContain(CURL);
  });

  it("darwin: without a default route, skips ARP/ping and renews en0", async () => {
    const { ctx, calls } = fakeCtx("darwin", { ...OK, "route -n get default": { code: 1, stderr: "not in table" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual(["route -n get default", "ipconfig set en0 DHCP", "route -n get default", CURL]);
  });

  it("reports when HTTPS still fails after the repair", async () => {
    const { ctx } = fakeCtx("darwin", {
      ...DARWIN_ROUTE,
      ping: { code: 2 },
      curl: { code: 28, stderr: "curl: (28) Connection timed out after 5001 milliseconds" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.actions.at(-1)).toBe(CURL);
    expect(r.detail).toContain("still failed (28)");
    expect(r.detail).toContain("gateway 10.0.2.1 still not answering ping");
  });

  it("linux: flushes the neighbour entry, renews via NetworkManager and re-probes", async () => {
    const { ctx, calls } = fakeCtx("linux", {
      ...LINUX_ROUTE,
      ...OK,
      "nmcli -t -f NAME,DEVICE connection show --active": { stdout: "Office Wi-Fi:wlp2s0\nlo:lo\n" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([
      "ip route show default",
      "ip neigh flush to 10.0.2.1 dev wlp2s0",
      "nmcli -t -f NAME,DEVICE connection show --active",
      'nmcli con up "Office Wi-Fi"',
      "ip route show default",
      "ping -c 3 -W 2 10.0.2.1",
      CURL,
    ]);
  });

  it("linux: falls back to dhclient when nmcli is unavailable", async () => {
    const { ctx, calls } = fakeCtx("linux", { ...LINUX_ROUTE, ...OK, nmcli: { code: 127, stderr: "nmcli: not found" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toContain("dhclient -r wlp2s0");
    expect(calls).toContain("dhclient wlp2s0");
    expect(r.actions).not.toContain("nmcli -t -f NAME,DEVICE connection show --active");
  });

  it("linux: reports a failing dhclient", async () => {
    const { ctx, calls } = fakeCtx("linux", {
      ...LINUX_ROUTE,
      nmcli: { code: 127 },
      "dhclient -r": { code: 1, stderr: "dhclient: permission denied" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("dhclient -r wlp2s0 failed (1): dhclient: permission denied");
    expect(calls).not.toContain(CURL);
  });

  it("dry run succeeds with every command recorded", async () => {
    const { ctx, calls } = fakeCtx("darwin", {}, true);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toContain("ipconfig set en0 DHCP");
    expect(calls).toContain(CURL);
  });

  it("rejects an unsupported platform", async () => {
    const { ctx, calls } = fakeCtx("linux");
    const r = await fixUnknown.run({ ...ctx, platform: "win32" } as unknown as FixContext);
    expect(r).toEqual({ pluginId: "fix-unknown", ok: false, actions: [], detail: "Unsupported platform: win32" });
    expect(calls).toEqual([]);
  });
});
