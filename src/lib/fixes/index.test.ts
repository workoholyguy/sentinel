import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FixPlugin } from "../types";
import { clearRecordedCommands, fixesFor, loadExtraPlugins, registry, runFixes } from "./index";
import { DARWIN_NET, fakeCtx } from "./test-helpers";

describe("registry / fixesFor", () => {
  it("contains all five plugins", () => {
    expect(registry.map((p) => p.id)).toEqual(["dns-flush-cache", "dns-switch-resolver", "dhcp-renew", "wifi-reconnect", "router-reboot"]);
  });
  it("maps faults to plugins in order", () => {
    expect(fixesFor("DNS_RESOLVER_DOWN", "darwin").map((p) => p.id)).toEqual(["dns-flush-cache", "dns-switch-resolver"]);
    expect(fixesFor("DHCP_NO_LEASE", "linux").map((p) => p.id)).toEqual(["dhcp-renew"]);
    expect(fixesFor("WIFI_DISCONNECTED", "linux").map((p) => p.id)).toEqual(["wifi-reconnect"]);
    for (const f of ["GATEWAY_UNREACHABLE", "ISP_UPSTREAM_LOSS", "ISP_OUTAGE"] as const) {
      expect(fixesFor(f, "darwin").map((p) => p.id)).toEqual(["router-reboot"]);
    }
  });
});

describe("runFixes", () => {
  beforeEach(() => clearRecordedCommands());

  it("stops as soon as verify() returns true", async () => {
    const { ctx, calls } = fakeCtx("darwin", DARWIN_NET);
    const verify = vi.fn().mockResolvedValueOnce(true);
    const results = await runFixes("DNS_RESOLVER_DOWN", ctx, verify);
    expect(results.map((r) => [r.pluginId, r.ok])).toEqual([["dns-flush-cache", true]]);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(calls.some((c) => c.includes("-setdnsservers"))).toBe(false);
  });

  it("continues to the next plugin when verify() is false", async () => {
    const { ctx } = fakeCtx("darwin", DARWIN_NET);
    const verify = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const results = await runFixes("DNS_RESOLVER_DOWN", ctx, verify);
    expect(results.map((r) => [r.pluginId, r.ok])).toEqual([
      ["dns-flush-cache", false],
      ["dns-switch-resolver", true],
    ]);
    expect(results[0].detail).toContain("fault persisted");
  });

  it("catches plugin exceptions and keeps going", async () => {
    const boom: FixPlugin = {
      id: "boom",
      title: "",
      handles: ["DHCP_NO_LEASE"],
      platforms: ["linux"],
      run: async () => {
        throw new Error("kaboom");
      },
    };
    const { ctx } = fakeCtx("linux");
    const results = await runFixes("DHCP_NO_LEASE", ctx, async () => false, [boom, ...registry]);
    expect(results.map((r) => r.pluginId)).toEqual(["boom", "dhcp-renew"]);
    expect(results[0]).toMatchObject({ ok: false, detail: "threw: kaboom" });
  });

  it("ISP fault in dryRun: router reboot runs, loss persists", async () => {
    const { ctx } = fakeCtx("linux", {}, true);
    const results = await runFixes("ISP_OUTAGE", ctx, async () => false);
    expect(results).toEqual([{ pluginId: "router-reboot", ok: false, actions: ["Rebooted router (simulated)"], detail: "Loss persisted after reboot" }]);
  });
});

describe("loadExtraPlugins", () => {
  it("imports valid *.plugin.ts|js files and skips invalid ones with a warning", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "uplink-plugins-"));
    await writeFile(
      path.join(dir, "arp-flush.plugin.ts"),
      `export default { id: "arp-flush", title: "x", handles: ["GATEWAY_UNREACHABLE"], platforms: ["darwin"],
        run: async () => ({ pluginId: "arp-flush", ok: true, actions: [] }) };`,
    );
    await writeFile(
      path.join(dir, "named.plugin.js"),
      `export const plugin = { id: "named", title: "y", handles: ["ISP_OUTAGE"], platforms: ["linux"], run: async () => ({}) };`,
    );
    await writeFile(path.join(dir, "bad-shape.plugin.ts"), `export default { id: "bad" };`);
    await writeFile(path.join(dir, "broken.plugin.js"), `this is not javascript`);
    await writeFile(path.join(dir, "dup.plugin.ts"), `export default { id: "dns-flush-cache", title: "", handles: [], platforms: [], run() {} };`);
    await writeFile(path.join(dir, "ignored.ts"), `throw new Error("should not be imported")`);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugins = await loadExtraPlugins(dir);
    expect(plugins.map((p) => p.id).sort()).toEqual(["arp-flush", "named"]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();

    expect(fixesFor("GATEWAY_UNREACHABLE", "darwin", [...registry, ...plugins]).map((p) => p.id)).toEqual(["router-reboot", "arp-flush"]);
  });

  it("returns [] for a missing directory", async () => {
    expect(await loadExtraPlugins("/nonexistent/uplink/plugins")).toEqual([]);
  });
});
