import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { FaultCode, FixContext, FixPlugin, FixResult } from "../types";
import type { Platform } from "./exec";
import type { FaultFixContext } from "./util";
import { dhcpRenew } from "./plugins/dhcp-renew";
import { dnsFlushCache } from "./plugins/dns-flush-cache";
import { dnsSwitchResolver } from "./plugins/dns-switch-resolver";
import { routerReboot } from "./plugins/router-reboot";
import { wifiReconnect } from "./plugins/wifi-reconnect";

export { createExecContext, getRecordedCommands, clearRecordedCommands } from "./exec";
export type { FaultFixContext } from "./util";
export { restoreDnsDefaults } from "./plugins/dns-switch-resolver";

/** Ordered cheapest/least disruptive first; runFixes walks them in this order. */
export const registry: FixPlugin[] = [dnsFlushCache, dnsSwitchResolver, dhcpRenew, wifiReconnect, routerReboot];

export function fixesFor(fault: FaultCode, platform: Platform, plugins: FixPlugin[] = registry): FixPlugin[] {
  return plugins.filter((p) => p.handles.includes(fault) && p.platforms.includes(platform));
}

/** Applies each applicable plugin in order, stopping as soon as verify() reports the fault is gone. */
export async function runFixes(
  fault: FaultCode,
  ctx: FixContext,
  verify: () => Promise<boolean>,
  plugins: FixPlugin[] = registry,
): Promise<FixResult[]> {
  const results: FixResult[] = [];
  const faultCtx: FaultFixContext = { ...ctx, fault };
  for (const plugin of fixesFor(fault, ctx.platform, plugins)) {
    let result: FixResult;
    try {
      result = await plugin.run(faultCtx);
    } catch (e) {
      result = { pluginId: plugin.id, ok: false, actions: [], detail: `threw: ${e instanceof Error ? e.message : String(e)}` };
    }
    let verified = false;
    try {
      verified = await verify();
    } catch {
      verified = false;
    }
    results.push(result.ok && !verified ? { ...result, ok: false, detail: [result.detail, "fault persisted"].filter(Boolean).join("; ") } : result);
    if (verified) break;
  }
  return results;
}

export function isFixPlugin(value: unknown): value is FixPlugin {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.title === "string" &&
    Array.isArray(p.handles) &&
    p.handles.every((h) => typeof h === "string") &&
    Array.isArray(p.platforms) &&
    p.platforms.every((x) => x === "darwin" || x === "linux") &&
    typeof p.run === "function"
  );
}

const PLUGIN_FILE = /\.plugin\.(ts|js)$/;

/**
 * Imports every *.plugin.ts|js in `dir` (runtime-authored plugins). A module may
 * export a plugin as `default`, as `plugin`, or as any named export. Invalid
 * modules/exports are skipped with a warning; a missing dir yields [].
 */
export async function loadExtraPlugins(dir: string): Promise<FixPlugin[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => PLUGIN_FILE.test(f)).sort();
  } catch {
    return [];
  }
  const out: FixPlugin[] = [];
  for (const file of files) {
    const full = path.resolve(dir, file);
    let mod: Record<string, unknown>;
    try {
      mod = await import(/* webpackIgnore: true */ pathToFileURL(full).href);
    } catch (e) {
      console.warn(`[fixes] skipping ${file}: failed to import (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    const found = [...new Set(Object.values(mod))].filter(isFixPlugin);
    if (found.length === 0) {
      console.warn(`[fixes] skipping ${file}: no valid FixPlugin export`);
      continue;
    }
    for (const p of found) {
      if (out.some((o) => o.id === p.id) || registry.some((r) => r.id === p.id)) {
        console.warn(`[fixes] skipping duplicate plugin id "${p.id}" in ${file}`);
        continue;
      }
      out.push(p);
    }
  }
  return out;
}
