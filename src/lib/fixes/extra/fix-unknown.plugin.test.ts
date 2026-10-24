import { describe, expect, it } from "vitest";
import type { FixContext } from "../../types";
import { isFixPlugin, loadExtraPlugins } from "../index";
import { fakeCtx } from "../test-helpers";
import { fixUnknown } from "./fix-unknown.plugin";

const PRIMARY = 'curl -sS -o /dev/null -m 5 -w "%{time_total}" https://1.1.1.1/cdn-cgi/trace';
const ALTERNATE = 'curl -sS -o /dev/null -m 5 -w "%{time_total}" https://1.0.0.1/cdn-cgi/trace';
const DARWIN_FLUSH = ["dscacheutil -flushcache", "killall -HUP mDNSResponder"];
const LINUX_FLUSH = ["resolvectl flush-caches"];

describe("fix-unknown", () => {
  it("is a valid plugin for UNKNOWN on darwin and linux", () => {
    expect(isFixPlugin(fixUnknown)).toBe(true);
    expect(fixUnknown.id).toBe("fix-unknown");
    expect(fixUnknown.handles).toEqual(["UNKNOWN"]);
    expect(fixUnknown.platforms).toEqual(["darwin", "linux"]);
  });

  it("is picked up by the extra-plugin loader", async () => {
    const plugins = await loadExtraPlugins(__dirname);
    expect(plugins.map((p) => p.id)).toContain("fix-unknown");
  });

  it("darwin: flushes the resolver cache and verifies 1.1.1.1 recovered", async () => {
    const { ctx, calls } = fakeCtx("darwin", { [PRIMARY]: { stdout: "0.142" } });
    const r = await fixUnknown.run(ctx);
    expect(r).toMatchObject({ pluginId: "fix-unknown", ok: true });
    expect(calls).toEqual([...DARWIN_FLUSH, PRIMARY]);
    expect(r.actions).toEqual([...DARWIN_FLUSH, PRIMARY]);
    expect(r.detail).toBe("HTTPS path recovered: 1.1.1.1 142 ms");
  });

  it("linux: flushes systemd-resolved and verifies 1.1.1.1 recovered", async () => {
    const { ctx, calls } = fakeCtx("linux", { [PRIMARY]: { stdout: "0.2" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([...LINUX_FLUSH, PRIMARY]);
  });

  it("succeeds via 1.0.0.1 when only the 1.1.1.1 path is slow", async () => {
    const { ctx, calls } = fakeCtx("darwin", { [PRIMARY]: { stdout: "4.768" }, [ALTERNATE]: { stdout: "0.09" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([...DARWIN_FLUSH, PRIMARY, ALTERNATE]);
    expect(r.detail).toContain("1.0.0.1 90 ms");
    expect(r.detail).toContain("1.1.1.1 slow (4768 ms)");
  });

  it("fails without throwing when the upstream is still degraded", async () => {
    const { ctx } = fakeCtx("linux", {
      [PRIMARY]: { stdout: "4.9" },
      [ALTERNATE]: { code: 28, stderr: "curl: (28) Operation timed out after 5001 milliseconds\n" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.actions).toEqual([...LINUX_FLUSH, PRIMARY, ALTERNATE]);
    expect(r.detail).toContain("1.1.1.1 slow (4900 ms)");
    expect(r.detail).toContain("1.0.0.1 unreachable (28): curl: (28) Operation timed out");
    expect(r.detail).toContain("provider is the likely cause");
  });

  it("reports a failing flush command but still re-probes", async () => {
    const { ctx, calls } = fakeCtx("darwin", {
      killall: { code: 1, stderr: "No matching processes belonging to you were found\n" },
      [PRIMARY]: { stdout: "0.3" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([...DARWIN_FLUSH, PRIMARY]);
    expect(r.detail).toContain("cache flush incomplete: killall -HUP mDNSResponder failed (1): No matching processes");
  });

  it("linux: a missing resolvectl is reported, failing probes make the result not ok", async () => {
    const { ctx } = fakeCtx("linux", {
      resolvectl: { code: 127, stderr: "resolvectl: not found" },
      curl: { code: 7, stderr: "curl: (7) Failed to connect" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("resolvectl flush-caches failed (127)");
    expect(r.detail).toContain("1.1.1.1 unreachable (7)");
  });

  it("dry run succeeds with every command recorded", async () => {
    const { ctx, calls } = fakeCtx("darwin", {}, true);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([...DARWIN_FLUSH, PRIMARY]);
  });

  it("rejects an unsupported platform", async () => {
    const { ctx, calls } = fakeCtx("linux");
    const r = await fixUnknown.run({ ...ctx, platform: "win32" } as unknown as FixContext);
    expect(r).toEqual({ pluginId: "fix-unknown", ok: false, actions: [], detail: "Unsupported platform: win32" });
    expect(calls).toEqual([]);
  });
});
