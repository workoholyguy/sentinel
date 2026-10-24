import { describe, expect, it } from "vitest";
import type { FixContext } from "../../types";
import { isFixPlugin } from "../index";
import { fakeCtx } from "../test-helpers";
import { fixUnknown } from "./fix-unknown.plugin";

const CURL = 'curl -sS -o /dev/null -m 5 -w "%{http_code} %{time_total}" https://1.1.1.1/cdn-cgi/trace';
const DARWIN_FLUSH = ["dscacheutil -flushcache", "killall -HUP mDNSResponder"];
const LINUX_FLUSH = ["resolvectl flush-caches"];

/** Fake exec whose curl answers come from a queue (slow first, then whatever follows). */
function sequencedCtx(platform: "darwin" | "linux", curlOut: string[], responses: Parameters<typeof fakeCtx>[1] = {}) {
  const { ctx, calls } = fakeCtx(platform, responses);
  const queue = [...curlOut];
  const exec: FixContext["exec"] = async (cmd, args) => {
    const r = await ctx.exec(cmd, args);
    if (cmd === "curl") return { ...r, stdout: queue.shift() ?? "200 0.979" };
    return r;
  };
  return { ctx: { ...ctx, exec }, calls };
}

describe("fix-unknown", () => {
  it("is a valid plugin for UNKNOWN/SLOW_SPEED on darwin and linux", () => {
    expect(isFixPlugin(fixUnknown)).toBe(true);
    expect(fixUnknown.id).toBe("fix-unknown");
    expect(fixUnknown.handles).toEqual(["UNKNOWN", "SLOW_SPEED"]);
    expect(fixUnknown.platforms).toEqual(["darwin", "linux"]);
  });

  it("darwin: flushes the resolver cache and verifies latency recovered", async () => {
    const { ctx, calls } = sequencedCtx("darwin", ["200 0.979", "200 0.120"]);
    const r = await fixUnknown.run(ctx);
    expect(r).toMatchObject({ pluginId: "fix-unknown", ok: true });
    expect(calls).toEqual([CURL, ...DARWIN_FLUSH, CURL]);
    expect(r.actions).toEqual([CURL, ...DARWIN_FLUSH, CURL]);
    expect(r.detail).toContain("120 ms, was 979 ms");
  });

  it("linux: flushes via resolvectl and retries the re-probe until healthy", async () => {
    const { ctx, calls } = sequencedCtx("linux", ["200 1.200", "200 0.900", "200 0.300"]);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([CURL, ...LINUX_FLUSH, CURL, CURL]);
  });

  it("does nothing when the path is already healthy", async () => {
    const { ctx, calls } = sequencedCtx("darwin", ["200 0.080"]);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([CURL]);
    expect(r.detail).toContain("already healthy");
  });

  it("reports a failing flush command without throwing and skips the re-probe", async () => {
    const { ctx, calls } = sequencedCtx("darwin", ["200 0.979"], {
      "killall -HUP mDNSResponder": { code: 1, stderr: "No matching processes belonging to you were found\n" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("killall -HUP mDNSResponder failed (1): No matching processes belonging to you were found");
    expect(calls).toEqual([CURL, ...DARWIN_FLUSH]);
  });

  it("linux: reports a missing resolvectl", async () => {
    const { ctx } = sequencedCtx("linux", ["200 0.979"], { resolvectl: { code: 127, stderr: "resolvectl: not found" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("resolvectl flush-caches failed (127)");
  });

  it("reports an upstream slowdown when latency stays high", async () => {
    const { ctx, calls } = sequencedCtx("linux", ["200 0.979", "200 0.950", "200 1.100", "200 0.990"]);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(calls.filter((c) => c === CURL)).toHaveLength(4);
    expect(r.detail).toContain("still slow after 3 re-probes (990 ms");
    expect(r.detail).toContain("upstream");
  });

  it("treats a failing curl as unhealthy", async () => {
    const { ctx } = fakeCtx("darwin", { curl: { code: 28, stderr: "curl: (28) Operation timed out" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("curl failed (28)");
  });

  it("dry run records the full repair", async () => {
    const { ctx, calls } = fakeCtx("darwin", {}, true);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([CURL, ...DARWIN_FLUSH, CURL]);
  });

  it("rejects an unsupported platform", async () => {
    const { ctx, calls } = fakeCtx("linux");
    const r = await fixUnknown.run({ ...ctx, platform: "win32" } as unknown as FixContext);
    expect(r).toEqual({ pluginId: "fix-unknown", ok: false, actions: [], detail: "Unsupported platform: win32" });
    expect(calls).toEqual([]);
  });
});
