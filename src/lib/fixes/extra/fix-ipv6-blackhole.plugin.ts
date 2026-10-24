import type { FixContext, FixPlugin, FixResult } from "../../types";

// Self-contained (type-only imports) so the runtime loader can import this file directly.

const id = "fix-ipv6-blackhole";
const PROBE_URL = "https://www.google.com";
const CURL_ARGS = ["-sS", "-o", "/dev/null", "-m", "5", "-w", "%{http_code}", PROBE_URL];

function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

async function darwinActiveService(ctx: FixContext): Promise<string> {
  const route = await ctx.exec("route", ["-n", "get", "default"]);
  const iface = route.code === 0 ? /interface:\s*(\S+)/.exec(route.stdout)?.[1] : undefined;
  if (iface) {
    const order = await ctx.exec("networksetup", ["-listnetworkserviceorder"]);
    const re = /^\(\d+\)\s*(.+)\n\(Hardware Port:[^,]*,\s*Device:\s*([^)\s]+)\)/gm;
    for (const m of order.stdout.matchAll(re)) {
      if (m[2] === iface) return m[1].trim();
    }
  }
  return "Wi-Fi";
}

async function linuxInterface(ctx: FixContext): Promise<string> {
  const route = await ctx.exec("ip", ["route", "show", "default"]);
  const viaRoute = route.code === 0 ? /\bdev\s+(\S+)/.exec(route.stdout)?.[1] : undefined;
  if (viaRoute) return viaRoute;
  const links = await ctx.exec("ip", ["-o", "link", "show"]);
  for (const line of links.stdout.split("\n")) {
    const m = /^\d+:\s*([^:@\s]+)/.exec(line);
    if (m && m[1] !== "lo") return m[1];
  }
  return "eth0";
}

/** Runs each step, stopping on the first failure; then re-probes HTTPS (now IPv4-only) to verify. */
async function apply(ctx: FixContext, steps: Array<[string, string[]]>, target: string): Promise<FixResult> {
  const actions: string[] = [];
  for (const [cmd, args] of steps) {
    const line = formatCommand(cmd, args);
    actions.push(line);
    const r = await ctx.exec(cmd, args);
    if (r.code !== 0) {
      return { pluginId: id, ok: false, actions, detail: `${line} failed (${r.code}): ${r.stderr.trim()}` };
    }
  }
  actions.push(formatCommand("curl", CURL_ARGS));
  const probe = await ctx.exec("curl", CURL_ARGS);
  if (probe.code !== 0) {
    return {
      pluginId: id,
      ok: false,
      actions,
      detail: `IPv6 disabled on ${target}, but HTTPS re-probe still failed (${probe.code}): ${probe.stderr.trim()}`,
    };
  }
  return {
    pluginId: id,
    ok: true,
    actions,
    detail: `IPv6 disabled on ${target}; traffic now uses IPv4. Re-enable IPv6 once the router's IPv6 upstream is fixed.`,
  };
}

/**
 * The router advertises IPv6 but drops it upstream, so clients try IPv6 first and hang.
 * Turning IPv6 off on the active interface makes every connection go straight to working IPv4.
 */
export const fixIpv6Blackhole: FixPlugin = {
  id,
  title: "Disable IPv6 on the active interface so traffic uses working IPv4",
  handles: ["IPV6_BLACKHOLE"],
  platforms: ["darwin", "linux"],
  async run(ctx) {
    if (ctx.platform === "darwin") {
      const service = await darwinActiveService(ctx);
      return apply(ctx, [["networksetup", ["-setv6off", service]]], `"${service}"`);
    }
    if (ctx.platform === "linux") {
      const iface = await linuxInterface(ctx);
      return apply(ctx, [["sysctl", ["-w", `net.ipv6.conf.${iface}.disable_ipv6=1`]]], iface);
    }
    return { pluginId: id, ok: false, actions: [], detail: `Unsupported platform: ${String(ctx.platform)}` };
  },
};

export default fixIpv6Blackhole;
