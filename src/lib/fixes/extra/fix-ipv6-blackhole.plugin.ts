import type { ExecResult, FixContext, FixPlugin, FixResult } from "../../types";

// Self-contained (type-only imports) so the runtime loader can import this file directly.

const id = "fix-ipv6-blackhole";
const PROBE_URL = "https://www.google.com";
const CURL_ARGS = ["-sS", "-o", "/dev/null", "-m", "5", "-w", "%{http_code}", PROBE_URL];

function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

/** Runs a command and records it in `actions`. */
async function run(ctx: FixContext, actions: string[], cmd: string, args: string[]): Promise<ExecResult & { line: string }> {
  const line = formatCommand(cmd, args);
  actions.push(line);
  return { ...(await ctx.exec(cmd, args)), line };
}

function fail(actions: string[], detail: string): FixResult {
  return { pluginId: id, ok: false, actions, detail };
}

function failed(r: ExecResult & { line: string }): string {
  return `${r.line} failed (${r.code}): ${r.stderr.trim() || r.stdout.trim()}`;
}

/** Enabled darwin service carrying the default route (via `-listnetworkserviceorder`), else the first enabled one, else Wi-Fi. */
async function darwinActiveService(ctx: FixContext, actions: string[]): Promise<string> {
  const all = await run(ctx, actions, "networksetup", ["-listallnetworkservices"]);
  const enabled = all.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("*") && !l.startsWith("An asterisk"));
  const route = await run(ctx, actions, "route", ["-n", "get", "default"]);
  const iface = route.code === 0 ? /interface:\s*(\S+)/.exec(route.stdout)?.[1] : undefined;
  if (iface) {
    const order = await run(ctx, actions, "networksetup", ["-listnetworkserviceorder"]);
    const re = /^\(\d+\)\s*(.+)\n\(Hardware Port:[^,]*,\s*Device:\s*([^)\s]+)\)/gm;
    for (const m of order.stdout.matchAll(re)) {
      const name = m[1].trim();
      if (m[2] === iface && (enabled.length === 0 || enabled.includes(name))) return name;
    }
  }
  return enabled[0] ?? "Wi-Fi";
}

async function linuxInterface(ctx: FixContext, actions: string[]): Promise<string> {
  const route = await run(ctx, actions, "ip", ["route", "show", "default"]);
  const viaRoute = route.code === 0 ? /\bdev\s+(\S+)/.exec(route.stdout)?.[1] : undefined;
  if (viaRoute) return viaRoute;
  const links = await run(ctx, actions, "ip", ["-o", "link", "show"]);
  for (const line of links.stdout.split("\n")) {
    const m = /^\d+:\s*([^:@\s]+)/.exec(line);
    if (m && m[1] !== "lo") return m[1];
  }
  return "eth0";
}

interface Steps {
  target: string;
  read: [string, string[]];
  isOff: (stdout: string) => boolean;
  disable: [string, string[]];
}

/**
 * Idempotent: reads the IPv6 state first and only disables it when it's still on. Then verifies the
 * state really reads "off" and re-probes HTTPS, which now goes straight over the working IPv4 path.
 */
async function apply(ctx: FixContext, actions: string[], s: Steps): Promise<FixResult> {
  const before = await run(ctx, actions, ...s.read);
  const alreadyOff = before.code === 0 && s.isOff(before.stdout);
  if (!alreadyOff) {
    const r = await run(ctx, actions, ...s.disable);
    if (r.code !== 0) return fail(actions, failed(r));
    const after = await run(ctx, actions, ...s.read);
    // In dryRun exec returns empty output, so the state can only be checked for real runs.
    if (!ctx.dryRun && (after.code !== 0 || !s.isOff(after.stdout))) {
      return fail(actions, `IPv6 still reported on for ${s.target} after ${r.line}`);
    }
  }
  const probe = await run(ctx, actions, "curl", CURL_ARGS);
  if (probe.code !== 0) {
    return fail(actions, `IPv6 is off on ${s.target}, but the HTTPS re-probe still failed (${probe.code}): ${probe.stderr.trim()}`);
  }
  return {
    pluginId: id,
    ok: true,
    actions,
    detail: `${alreadyOff ? "IPv6 was already off" : "IPv6 disabled"} on ${s.target}; traffic now uses IPv4. Re-enable IPv6 once the router's IPv6 upstream is fixed.`,
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
    const actions: string[] = [];
    if (ctx.platform === "darwin") {
      const service = await darwinActiveService(ctx, actions);
      return apply(ctx, actions, {
        target: `"${service}"`,
        read: ["networksetup", ["-getinfo", service]],
        isOff: (out) => /^IPv6:\s*Off\b/im.test(out),
        disable: ["networksetup", ["-setv6off", service]],
      });
    }
    if (ctx.platform === "linux") {
      const iface = await linuxInterface(ctx, actions);
      // sysctl uses "." as separator, so VLAN names like eth0.100 are written eth0/100.
      const key = `net.ipv6.conf.${iface.replaceAll(".", "/")}.disable_ipv6`;
      return apply(ctx, actions, {
        target: iface,
        read: ["sysctl", ["-n", key]],
        isOff: (out) => out.trim() === "1",
        disable: ["sysctl", ["-w", `${key}=1`]],
      });
    }
    return { pluginId: id, ok: false, actions, detail: `Unsupported platform: ${String(ctx.platform)}` };
  },
};

export default fixIpv6Blackhole;
