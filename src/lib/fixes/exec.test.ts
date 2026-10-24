import { beforeEach, describe, expect, it } from "vitest";
import { clearRecordedCommands, createExecContext, getRecordedCommands, type ExecFileRunner } from "./exec";

function fakeRunner(behaviour: (file: string, args: string[]) => { err?: (Error & { code?: unknown; killed?: boolean }) | null; stdout?: string; stderr?: string }) {
  const calls: Array<{ file: string; args: string[]; timeout: number }> = [];
  const runner: ExecFileRunner = (file, args, opts, cb) => {
    calls.push({ file, args, timeout: opts.timeout });
    const b = behaviour(file, args);
    cb(b.err ?? null, b.stdout ?? "", b.stderr ?? "");
  };
  return { runner, calls };
}

describe("createExecContext", () => {
  beforeEach(() => clearRecordedCommands());

  it("runs via execFile with a 10s timeout", async () => {
    const { runner, calls } = fakeRunner(() => ({ stdout: "hi" }));
    const ctx = createExecContext({ platform: "linux", dryRun: false, runner });
    expect(await ctx.exec("resolvectl", ["flush-caches"])).toEqual({ code: 0, stdout: "hi", stderr: "" });
    expect(calls).toEqual([{ file: "resolvectl", args: ["flush-caches"], timeout: 10_000 }]);
  });

  it("prefixes sudo -n when sudo is true", async () => {
    const { runner, calls } = fakeRunner(() => ({}));
    const ctx = createExecContext({ platform: "darwin", dryRun: false, sudo: true, runner });
    await ctx.exec("killall", ["-HUP", "mDNSResponder"]);
    expect(calls[0]).toMatchObject({ file: "sudo", args: ["-n", "killall", "-HUP", "mDNSResponder"] });
  });

  it("reports a sudo password prompt failure instead of hanging", async () => {
    const err = Object.assign(new Error("Command failed"), { code: 1 });
    const { runner } = fakeRunner(() => ({ err, stderr: "sudo: a password is required\n" }));
    const ctx = createExecContext({ platform: "darwin", dryRun: false, sudo: true, runner });
    const r = await ctx.exec("dscacheutil", ["-flushcache"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("password is required");
  });

  it("maps timeouts and missing binaries to failures", async () => {
    const { runner } = fakeRunner((file) =>
      file === "slow"
        ? { err: Object.assign(new Error("killed"), { killed: true, code: null }) }
        : { err: Object.assign(new Error("spawn nope ENOENT"), { code: "ENOENT" }) },
    );
    const ctx = createExecContext({ platform: "linux", dryRun: false, runner });
    expect((await ctx.exec("slow", [])).code).toBe(124);
    expect((await ctx.exec("nope", [])).code).toBe(127);
  });

  it("really executes when no runner is injected", async () => {
    const ctx = createExecContext({ platform: "linux", dryRun: false });
    expect(await ctx.exec("node", ["-e", "process.stdout.write('ok')"])).toMatchObject({ code: 0, stdout: "ok" });
    expect((await ctx.exec("node", ["-e", "process.exit(3)"])).code).toBe(3);
  });

  it("records commands in dryRun and returns code 0 without executing", async () => {
    const { runner, calls } = fakeRunner(() => ({ err: new Error("should not run") }));
    const ctx = createExecContext({ platform: "darwin", dryRun: true, sudo: true, runner });
    expect((await ctx.exec("networksetup", ["-setdnsservers", "Wi-Fi", "1.1.1.1"])).code).toBe(0);
    expect(calls).toHaveLength(0);
    expect(getRecordedCommands()).toEqual(["sudo -n networksetup -setdnsservers Wi-Fi 1.1.1.1"]);
  });
});
