import { describe, expect, it } from "vitest";
import type { ExecResult, FixContext } from "../../types";
import { fixUnknown } from "./fix-unknown.plugin";

type Reply = Partial<ExecResult> | Array<Partial<ExecResult>>;

/** Fake exec: records "cmd args" lines; replies by longest matching prefix (arrays are consumed in order). */
function fake(platform: FixContext["platform"], replies: Record<string, Reply> = {}, dryRun = false) {
  const calls: string[] = [];
  const queues = new Map(Object.entries(replies).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  const ctx: FixContext = {
    platform,
    dryRun,
    async exec(cmd, args) {
      const line = [cmd, ...args].join(" ");
      calls.push(line);
      if (dryRun) return { code: 0, stdout: "", stderr: "" };
      const key = [...queues.keys()].filter((k) => line.startsWith(k)).sort((a, b) => b.length - a.length)[0];
      const v = key ? queues.get(key) : undefined;
      const r = Array.isArray(v) ? (v.length > 1 ? v.shift() : v[0]) : v;
      return { code: 0, stdout: "", stderr: "", ...(r ?? {}) };
    },
  };
  return { ctx, calls };
}

const CURL = "curl -sS -o /dev/null -m 10 -w %{time_total} https://1.1.1.1/cdn-cgi/trace";

const DARWIN = {
  "route -n get default": { stdout: "   route to: default\n    gateway: 172.20.10.1\n  interface: en0\n" },
  "ifconfig en0": { stdout: "en0: flags=8863<UP> mtu 1500\n\tinet 172.20.10.2\n" },
  "ping -D -c 1 -t 2 -s 1472": { code: 2, stderr: "ping: sendto: Message too long" },
  "ping -D -c 1 -t 2 -s 1372": { code: 0 },
  [CURL]: [{ stdout: "1.343" }, { stdout: "0.142" }],
};

const LINUX = {
  "ip route show default": { stdout: "default via 172.20.10.1 dev wlp2s0 proto dhcp metric 600\n" },
  "ip link show dev wlp2s0": { stdout: "3: wlp2s0: <BROADCAST,UP> mtu 1500 qdisc noqueue state UP\n" },
  "ping -M do -c 1 -W 2 -s 1472": { code: 1, stderr: "ping: local error: message too long, mtu=1400" },
  "ping -M do -c 1 -W 2 -s 1372": { code: 0 },
  [CURL]: [{ stdout: "1.343" }, { stdout: "0.142" }],
};

describe("fix-unknown plugin", () => {
  it("implements the FixPlugin contract", () => {
    expect(fixUnknown.id).toBe("fix-unknown");
    expect(fixUnknown.handles).toContain("UNKNOWN");
    expect(fixUnknown.platforms).toEqual(["darwin", "linux"]);
  });

  it("darwin: detects the MTU black hole, clamps en0 to 1400 and verifies HTTPS", async () => {
    const { ctx, calls } = fake("darwin", DARWIN);
    const r = await fixUnknown.run(ctx);
    expect(r).toMatchObject({ pluginId: "fix-unknown", ok: true });
    expect(r.detail).toContain("1343 ms → 142 ms");
    expect(calls).toEqual([
      CURL,
      "route -n get default",
      "ping -D -c 1 -t 2 -s 1472 1.1.1.1",
      "ping -D -c 1 -t 2 -s 1372 1.1.1.1",
      "ifconfig en0",
      "ifconfig en0 mtu 1400",
      CURL,
    ]);
    expect(r.actions).toHaveLength(calls.length);
  });

  it("linux: clamps the default-route interface with ip link", async () => {
    const { ctx, calls } = fake("linux", LINUX);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([
      CURL,
      "ip route show default",
      "ping -M do -c 1 -W 2 -s 1472 1.1.1.1",
      "ping -M do -c 1 -W 2 -s 1372 1.1.1.1",
      "ip link show dev wlp2s0",
      "ip link set dev wlp2s0 mtu 1400",
      CURL,
    ]);
  });

  it("falls back to 1280 when 1400 also fails", async () => {
    const { ctx, calls } = fake("darwin", { ...DARWIN, "ping -D -c 1 -t 2 -s 1372": { code: 2 } });
    expect((await fixUnknown.run(ctx)).ok).toBe(true);
    expect(calls).toContain("ifconfig en0 mtu 1280");
  });

  it("is idempotent: does not reset an MTU that is already low enough", async () => {
    const { ctx, calls } = fake("darwin", { ...DARWIN, "ifconfig en0": { stdout: "en0: flags=8863<UP> mtu 1400\n" } });
    expect((await fixUnknown.run(ctx)).ok).toBe(true);
    expect(calls.filter((c) => c.includes(" mtu "))).toEqual([]);
  });

  it("changes nothing when HTTPS is already healthy", async () => {
    const { ctx, calls } = fake("darwin", { ...DARWIN, [CURL]: { stdout: "0.120" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([CURL]);
  });

  it("does not touch the MTU when full-size packets pass (upstream problem)", async () => {
    const { ctx, calls } = fake("darwin", { ...DARWIN, "ping -D -c 1 -t 2 -s 1472": { code: 0 } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("escalate");
    expect(calls.some((c) => c.includes(" mtu "))).toBe(false);
  });

  it("gives up without changes when even 1280-byte packets fail", async () => {
    const { ctx, calls } = fake("linux", {
      ...LINUX,
      "ping -M do -c 1 -W 2 -s 1372": { code: 1 },
      "ping -M do -c 1 -W 2 -s 1252": { code: 1 },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("not an MTU problem");
    expect(calls.some((c) => c.includes("link set"))).toBe(false);
  });

  it("reports a failing MTU command without throwing", async () => {
    const { ctx, calls } = fake("darwin", {
      ...DARWIN,
      "ifconfig en0 mtu": { code: 1, stderr: "ifconfig: ioctl (SIOCSIFMTU): Operation not permitted" },
    });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("Operation not permitted");
    expect(calls[calls.length - 1]).toBe("ifconfig en0 mtu 1400");
  });

  it("fails when HTTPS is still slow after the clamp", async () => {
    const { ctx } = fake("linux", { ...LINUX, [CURL]: { stdout: "1.300" } });
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("still slow (1300 ms)");
  });

  it("dry run rehearses the clamp", async () => {
    const { ctx, calls } = fake("darwin", {}, true);
    const r = await fixUnknown.run(ctx);
    expect(r.ok).toBe(true);
    expect(r.detail).toContain("Dry run");
    expect(calls).toContain("ifconfig en0 mtu 1400");
  });
});
