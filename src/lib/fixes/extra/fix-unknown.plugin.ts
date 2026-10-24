import type { ExecResult, FixContext, FixPlugin, FixResult } from "../../types";

// Self-contained on purpose: extra plugins are imported at runtime, so only type imports here.
// Fault pattern: ICMP to 1.1.1.1 is fine but HTTPS is slow — full-size TLS packets stall
// (path-MTU black hole, common on tethered/hotspot links). Fix: clamp the default
// interface's MTU to the largest size that passes unfragmented, then re-probe HTTPS.

const id = "fix-unknown";
const TARGET = "1.1.1.1";
const PROBE_URL = "https://1.1.1.1/cdn-cgi/trace";
const SLOW_MS = 800; // matches the monitor's "internet" degraded threshold
const FULL_MTU = 1500;
const CANDIDATE_MTUS = [1400, 1280];
const ICMP_IP_HEADERS = 28;

function fmt(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

async function step(ctx: FixContext, actions: string[], cmd: string, args: string[]): Promise<ExecResult> {
  actions.push(fmt(cmd, args));
  return ctx.exec(cmd, args);
}

async function defaultInterface(ctx: FixContext, actions: string[]): Promise<string> {
  if (ctx.platform === "darwin") {
    const r = await step(ctx, actions, "route", ["-n", "get", "default"]);
    return (r.code === 0 && /interface:\s*(\S+)/.exec(r.stdout)?.[1]) || "en0";
  }
  const r = await step(ctx, actions, "ip", ["route", "show", "default"]);
  return (r.code === 0 && /\bdev\s+(\S+)/.exec(r.stdout)?.[1]) || "eth0";
}

/** HTTPS time to 1.1.1.1 in ms, or undefined when curl failed / printed nothing (e.g. dry run). */
async function httpsMs(ctx: FixContext, actions: string[]): Promise<number | undefined> {
  const r = await step(ctx, actions, "curl", ["-sS", "-o", "/dev/null", "-m", "10", "-w", "%{time_total}", PROBE_URL]);
  const s = Number.parseFloat(r.stdout.trim());
  return r.code === 0 && Number.isFinite(s) ? Math.round(s * 1000) : undefined;
}

/** True when an unfragmentable packet of `mtu` bytes reaches the target. */
async function passesDf(ctx: FixContext, actions: string[], mtu: number): Promise<boolean> {
  const size = String(mtu - ICMP_IP_HEADERS);
  const args =
    ctx.platform === "darwin"
      ? ["-D", "-c", "1", "-t", "2", "-s", size, TARGET]
      : ["-M", "do", "-c", "1", "-W", "2", "-s", size, TARGET];
  return (await step(ctx, actions, "ping", args)).code === 0;
}

async function currentMtu(ctx: FixContext, actions: string[], iface: string): Promise<number | undefined> {
  const r =
    ctx.platform === "darwin"
      ? await step(ctx, actions, "ifconfig", [iface])
      : await step(ctx, actions, "ip", ["link", "show", "dev", iface]);
  const m = /\bmtu\s+(\d+)/.exec(r.stdout);
  return r.code === 0 && m ? Number(m[1]) : undefined;
}

export const fixUnknown: FixPlugin = {
  id,
  title: "Clamp the interface MTU when full-size HTTPS packets stall (slow HTTPS, healthy ping)",
  handles: ["UNKNOWN", "SLOW_SPEED"],
  platforms: ["darwin", "linux"],
  async run(ctx): Promise<FixResult> {
    if (ctx.platform !== "darwin" && ctx.platform !== "linux") {
      return { pluginId: id, ok: false, actions: [], detail: `Unsupported platform: ${ctx.platform}` };
    }
    const actions: string[] = [];
    const fail = (detail: string): FixResult => ({ pluginId: id, ok: false, actions, detail });

    const before = await httpsMs(ctx, actions);
    if (before !== undefined && before < SLOW_MS) {
      return { pluginId: id, ok: true, actions, detail: `HTTPS to ${TARGET} already healthy (${before} ms); nothing changed` };
    }

    const iface = await defaultInterface(ctx, actions);

    let target: number | undefined;
    if (ctx.dryRun) {
      target = CANDIDATE_MTUS[0]; // probes return no data in a dry run; rehearse the clamp
    } else {
      if (await passesDf(ctx, actions, FULL_MTU)) {
        return fail(`Full ${FULL_MTU}-byte packets reach ${TARGET}, so the path MTU is fine; HTTPS slowness (${before ?? "?"} ms) is upstream — escalate to the provider`);
      }
      for (const mtu of CANDIDATE_MTUS) {
        if (await passesDf(ctx, actions, mtu)) {
          target = mtu;
          break;
        }
      }
      if (target === undefined) {
        return fail(`Even ${CANDIDATE_MTUS[CANDIDATE_MTUS.length - 1]}-byte unfragmented packets fail to ${TARGET}; not an MTU problem — escalate to the provider`);
      }
    }

    const mtuNow = await currentMtu(ctx, actions, iface);
    if (mtuNow === undefined || mtuNow > target) {
      const set =
        ctx.platform === "darwin"
          ? await step(ctx, actions, "ifconfig", [iface, "mtu", String(target)])
          : await step(ctx, actions, "ip", ["link", "set", "dev", iface, "mtu", String(target)]);
      if (set.code !== 0) {
        return fail(`${actions[actions.length - 1]} failed (${set.code}): ${set.stderr.trim()}`);
      }
    }

    if (ctx.dryRun) {
      return { pluginId: id, ok: true, actions, detail: `Dry run: rehearsed clamping ${iface} MTU to ${target}` };
    }

    const after = await httpsMs(ctx, actions);
    if (after === undefined) return fail(`MTU on ${iface} set to ${target}, but the HTTPS re-probe to ${TARGET} failed`);
    if (after >= SLOW_MS) return fail(`MTU on ${iface} set to ${target}, but HTTPS to ${TARGET} is still slow (${after} ms)`);
    return {
      pluginId: id,
      ok: true,
      actions,
      detail: `Path MTU black hole: clamped ${iface} MTU to ${target}; HTTPS to ${TARGET} ${before ?? "?"} ms → ${after} ms`,
    };
  },
};

export default fixUnknown;
