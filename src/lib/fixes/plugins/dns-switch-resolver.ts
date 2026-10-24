import type { FixContext, FixPlugin, FixResult } from "../../types";
import { darwinActiveService, linuxInterface, runSteps, unsupported } from "../util";

const id = "dns-switch-resolver";
export const FALLBACK_RESOLVERS = ["1.1.1.1", "8.8.8.8"];

export const dnsSwitchResolver: FixPlugin = {
  id,
  title: "Point the active network service at 1.1.1.1 and 8.8.8.8",
  handles: ["DNS_RESOLVER_DOWN"],
  platforms: ["darwin", "linux"],
  async run(ctx) {
    if (ctx.platform === "darwin") {
      const service = await darwinActiveService(ctx);
      return runSteps(ctx, id, [["networksetup", ["-setdnsservers", service, ...FALLBACK_RESOLVERS]]], `DNS for "${service}" set to ${FALLBACK_RESOLVERS.join(", ")}`);
    }
    if (ctx.platform === "linux") {
      const iface = await linuxInterface(ctx);
      return runSteps(ctx, id, [["resolvectl", ["dns", iface, ...FALLBACK_RESOLVERS]]], `DNS for ${iface} set to ${FALLBACK_RESOLVERS.join(", ")}`);
    }
    return unsupported(id, ctx);
  },
};

/** Undo dns-switch-resolver (used by the demo reset). */
export async function restoreDnsDefaults(ctx: FixContext): Promise<FixResult> {
  const pluginId = "dns-restore-defaults";
  if (ctx.platform === "darwin") {
    const service = await darwinActiveService(ctx);
    return runSteps(ctx, pluginId, [["networksetup", ["-setdnsservers", service, "empty"]]], `DNS for "${service}" restored to DHCP defaults`);
  }
  if (ctx.platform === "linux") {
    const iface = await linuxInterface(ctx);
    return runSteps(ctx, pluginId, [["resolvectl", ["revert", iface]]], `DNS for ${iface} restored to defaults`);
  }
  return unsupported(pluginId, ctx);
}

export default dnsSwitchResolver;
