import type { ExecResult, FixContext, FixPlugin, FixResult } from "../../types";

// Self-contained (type-only imports) so the runtime loader can import this file directly.

const id = "fix-slow-speed";
/** Gateway round-trip above this is "slow" (a healthy LAN hop is well under 50 ms). */
export const SLOW_GATEWAY_MS = 100;

type Step = [string, string[]];

function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

/** Average RTT from a darwin ("round-trip min/avg/max/stddev = …") or linux ("rtt min/avg/max/mdev = …") ping summary. */
export function parseAvgRtt(stdout: string): number | undefined {
  const m = /min\/avg\/max\/(?:stddev|mdev)\s*=\s*[\d.]+\/([\d.]+)\//.exec(stdout);
  return m ? Number(m[1]) : undefined;
}

interface Route {
  gateway?: string;
  iface?: string;
}

async function defaultRoute(ctx: FixContext): Promise<Route> {
  if (ctx.platform === "darwin") {
    const r = await ctx.exec("route", ["-n", "get", "default"]);
    if (r.code !== 0) return {};
    return { gateway: /gateway:\s*(\S+)/.exec(r.stdout)?.[1], iface: /interface:\s*(\S+)/.exec(r.stdout)?.[1] };
  }
  const r = await ctx.exec("ip", ["route", "show", "default"]);
  if (r.code !== 0) return {};
  return { gateway: /\bvia\s+(\S+)/.exec(r.stdout)?.[1], iface: /\bdev\s+(\S+)/.exec(r.stdout)?.[1] };
}

async function darwinWifiDevice(ctx: FixContext): Promise<string | undefined> {
  const r = await ctx.exec("networksetup", ["-listallhardwareports"]);
  return /Hardware Port:\s*(?:Wi-Fi|AirPort)\s*\nDevice:\s*(\S+)/.exec(r.stdout)?.[1];
}

function pingArgs(ctx: FixContext, host: string): string[] {
  // darwin: -t is the overall timeout; linux: -w is the deadline (-t there is TTL).
  return ["-q", "-c", "3", ctx.platform === "darwin" ? "-t" : "-w", "5", host];
}

interface Measured {
  line: string;
  result: ExecResult;
  avg?: number;
}

async function pingGateway(ctx: FixContext, gateway: string): Promise<Measured> {
  const args = pingArgs(ctx, gateway);
  const result = await ctx.exec("ping", args);
  return { line: formatCommand("ping", args), result, avg: parseAvgRtt(result.stdout) };
}

const describeRtt = (avg?: number) => (avg === undefined ? "latency unknown" : `${avg} ms`);

/** Repair steps: re-associate the link (drops a stuck/congested session and re-picks channel/band), then flush DNS. */
function repairSteps(ctx: FixContext, iface: string, wifiDevice?: string): Step[] {
  if (ctx.platform === "darwin") {
    const relink: Step[] =
      wifiDevice && wifiDevice === iface
        ? [
            ["networksetup", ["-setairportpower", wifiDevice, "off"]],
            ["networksetup", ["-setairportpower", wifiDevice, "on"]],
            ["ipconfig", ["waitall"]],
          ]
        : [];
    return [...relink, ["dscacheutil", ["-flushcache"]], ["killall", ["-HUP", "mDNSResponder"]]];
  }
  return [
    ["nmcli", ["device", "disconnect", iface]],
    ["nmcli", ["--wait", "20", "device", "connect", iface]],
    ["resolvectl", ["flush-caches"]],
  ];
}

/**
 * The first hop (the router) answers slowly, so everything behind it is slow too.
 * Measures gateway RTT; if slow, re-associates the active link and flushes the DNS
 * cache, then re-pings the gateway to verify. A healthy gateway is left untouched.
 */
export const fixSlowSpeed: FixPlugin = {
  id,
  title: "Re-establish a slow link to the router and flush DNS, then re-check latency",
  handles: ["SLOW_SPEED"],
  platforms: ["darwin", "linux"],
  async run(ctx): Promise<FixResult> {
    if (ctx.platform !== "darwin" && ctx.platform !== "linux") {
      return { pluginId: id, ok: false, actions: [], detail: `Unsupported platform: ${String(ctx.platform)}` };
    }
    const actions: string[] = [];
    const { gateway, iface } = await defaultRoute(ctx);
    if (!gateway || !iface) {
      return { pluginId: id, ok: false, actions, detail: "No default gateway found; cannot measure or repair the router link" };
    }

    const before = await pingGateway(ctx, gateway);
    actions.push(before.line);
    if (before.result.code === 0 && before.avg !== undefined && before.avg <= SLOW_GATEWAY_MS) {
      return { pluginId: id, ok: true, actions, detail: `Gateway ${gateway} already answers in ${before.avg} ms; nothing to change` };
    }

    const wifiDevice = ctx.platform === "darwin" ? await darwinWifiDevice(ctx) : undefined;
    for (const [cmd, args] of repairSteps(ctx, iface, wifiDevice)) {
      const line = formatCommand(cmd, args);
      actions.push(line);
      const r = await ctx.exec(cmd, args);
      if (r.code !== 0) {
        return { pluginId: id, ok: false, actions, detail: `${line} failed (${r.code}): ${r.stderr.trim()}` };
      }
    }

    const after = await pingGateway(ctx, gateway);
    actions.push(after.line);
    if (after.result.code !== 0) {
      return {
        pluginId: id,
        ok: false,
        actions,
        detail: `Gateway ${gateway} re-probe failed (${after.result.code}): ${after.result.stderr.trim()}`,
      };
    }
    if (after.avg !== undefined && after.avg > SLOW_GATEWAY_MS) {
      return {
        pluginId: id,
        ok: false,
        actions,
        detail: `Gateway ${gateway} still slow: ${describeRtt(before.avg)} before, ${after.avg} ms after; the router itself likely needs a reboot or is overloaded`,
      };
    }
    return {
      pluginId: id,
      ok: true,
      actions,
      detail: `Re-established ${iface} and flushed DNS; gateway ${gateway} now ${describeRtt(after.avg)} (was ${describeRtt(before.avg)})`,
    };
  },
};

export default fixSlowSpeed;
