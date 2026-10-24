import type { FaultCode, FixContext, FixResult } from "../types";
import { formatCommand } from "./exec";

/** FixContext as passed by runFixes: also carries the fault being fixed (FixPlugin.run has no fault arg). */
export interface FaultFixContext extends FixContext {
  fault?: FaultCode;
}

/** Runs commands in sequence, stopping on the first failure. */
export async function runSteps(
  ctx: FixContext,
  pluginId: string,
  steps: Array<[string, string[]]>,
  successDetail: string,
  actions: string[] = [],
): Promise<FixResult> {
  for (const [cmd, args] of steps) {
    actions.push(formatCommand(cmd, args));
    const r = await ctx.exec(cmd, args);
    if (r.code !== 0) {
      return { pluginId, ok: false, actions, detail: `${formatCommand(cmd, args)} failed (${r.code}): ${r.stderr.trim()}` };
    }
  }
  return { pluginId, ok: true, actions, detail: successDetail };
}

export function unsupported(pluginId: string, ctx: FixContext): FixResult {
  return { pluginId, ok: false, actions: [], detail: `Unsupported platform: ${ctx.platform}` };
}

/** Interface carrying the default route (darwin: `route -n get default`, linux: `ip route show default`). */
export async function defaultInterface(ctx: FixContext): Promise<string | undefined> {
  if (ctx.platform === "darwin") {
    const r = await ctx.exec("route", ["-n", "get", "default"]);
    return r.code === 0 ? /interface:\s*(\S+)/.exec(r.stdout)?.[1] : undefined;
  }
  const r = await ctx.exec("ip", ["route", "show", "default"]);
  return r.code === 0 ? /\bdev\s+(\S+)/.exec(r.stdout)?.[1] : undefined;
}

/** Wi-Fi device on darwin from `networksetup -listallhardwareports`. */
export async function darwinWifiDevice(ctx: FixContext): Promise<string> {
  const r = await ctx.exec("networksetup", ["-listallhardwareports"]);
  const m = /Hardware Port:\s*(?:Wi-Fi|AirPort)\s*\nDevice:\s*(\S+)/.exec(r.stdout);
  return m?.[1] ?? "en0";
}

export async function linuxInterface(ctx: FixContext): Promise<string> {
  const viaRoute = await defaultInterface(ctx);
  if (viaRoute) return viaRoute;
  const r = await ctx.exec("ip", ["-o", "link", "show"]);
  for (const line of r.stdout.split("\n")) {
    const m = /^\d+:\s*([^:@\s]+)/.exec(line);
    if (m && m[1] !== "lo") return m[1];
  }
  return "eth0";
}

/**
 * Active darwin network service: default-route interface mapped to its service
 * name via `-listnetworkserviceorder`, restricted to enabled services from
 * `-listallnetworkservices`. Falls back to the first enabled service, then "Wi-Fi".
 */
export async function darwinActiveService(ctx: FixContext): Promise<string> {
  const all = await ctx.exec("networksetup", ["-listallnetworkservices"]);
  const enabled = all.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("*") && !l.startsWith("An asterisk"));

  const iface = await defaultInterface(ctx);
  if (iface) {
    const order = await ctx.exec("networksetup", ["-listnetworkserviceorder"]);
    const re = /^\(\d+\)\s*(.+)\n\(Hardware Port:[^,]*,\s*Device:\s*([^)\s]+)\)/gm;
    for (const m of order.stdout.matchAll(re)) {
      const name = m[1].trim();
      if (m[2] === iface && (enabled.length === 0 || enabled.includes(name))) return name;
    }
  }
  return enabled[0] ?? "Wi-Fi";
}
