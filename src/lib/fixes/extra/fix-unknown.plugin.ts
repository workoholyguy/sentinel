import type { FixContext, FixPlugin, FixResult } from "../../types";

// Self-contained (type-only imports) so the runtime loader can import this file directly.

const id = "fix-unknown";
const PROBE_URL = "https://1.1.1.1";
const CURL_ARGS = ["-sS", "-o", "/dev/null", "-m", "5", "-w", "%{http_code}", PROBE_URL];

interface Route {
  gateway?: string;
  iface: string;
}

function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

function failure(r: { code: number; stderr: string }): string {
  const err = r.stderr.trim();
  return err ? `(${r.code}): ${err}` : `(${r.code})`;
}

async function darwinRoute(ctx: FixContext): Promise<Route> {
  const r = await ctx.exec("route", ["-n", "get", "default"]);
  const out = r.code === 0 ? r.stdout : "";
  return {
    gateway: /gateway:\s*(\S+)/.exec(out)?.[1],
    iface: /interface:\s*(\S+)/.exec(out)?.[1] ?? "en0",
  };
}

async function linuxRoute(ctx: FixContext): Promise<Route> {
  const r = await ctx.exec("ip", ["route", "show", "default"]);
  const out = r.code === 0 ? r.stdout : "";
  return {
    gateway: /\bvia\s+(\S+)/.exec(out)?.[1],
    iface: /\bdev\s+(\S+)/.exec(out)?.[1] ?? "eth0",
  };
}

/** Renews the lease on Linux: NetworkManager when it owns the interface, otherwise dhclient. */
async function linuxRenew(ctx: FixContext, iface: string, actions: string[]): Promise<FixResult | undefined> {
  const conArgs = ["-t", "-f", "NAME,DEVICE", "connection", "show", "--active"];
  const cons = await ctx.exec("nmcli", conArgs);
  if (cons.code === 0) {
    actions.push(formatCommand("nmcli", conArgs));
    const name = cons.stdout
      .split("\n")
      .map((l) => l.split(":"))
      .find((parts) => parts.length > 1 && parts[parts.length - 1] === iface)
      ?.slice(0, -1)
      .join(":");
    if (name) {
      const upArgs = ["con", "up", name];
      actions.push(formatCommand("nmcli", upArgs));
      const up = await ctx.exec("nmcli", upArgs);
      if (up.code === 0) return undefined;
    }
  }
  for (const args of [["-r", iface], [iface]]) {
    actions.push(formatCommand("dhclient", args));
    const r = await ctx.exec("dhclient", args);
    if (r.code !== 0) {
      return { pluginId: id, ok: false, actions, detail: `${formatCommand("dhclient", args)} failed ${failure(r)}` };
    }
  }
  return undefined;
}

/**
 * Wi-Fi is associated and a default route exists, but the gateway stops answering
 * (100% ping loss) and nothing past it is reachable. A stale ARP entry for the gateway
 * or a wedged DHCP lease is the usual local cause, so: drop the gateway's ARP entry,
 * renew the lease, then re-probe the gateway and HTTPS to verify.
 */
async function repair(ctx: FixContext): Promise<FixResult> {
  const actions: string[] = [];
  const darwin = ctx.platform === "darwin";
  const route = darwin ? await darwinRoute(ctx) : await linuxRoute(ctx);
  const notes: string[] = [];

  if (route.gateway) {
    const [cmd, args] = darwin
      ? ["arp", ["-d", route.gateway]]
      : ["ip", ["neigh", "flush", "to", route.gateway, "dev", route.iface]];
    actions.push(formatCommand(cmd, args));
    const r = await ctx.exec(cmd, args);
    // A missing ARP entry is fine (already clear); keep going with the lease renewal.
    if (r.code !== 0) notes.push(`ARP flush skipped ${failure(r)}`);
  }

  if (darwin) {
    const args = ["set", route.iface, "DHCP"];
    actions.push(formatCommand("ipconfig", args));
    const r = await ctx.exec("ipconfig", args);
    if (r.code !== 0) {
      return { pluginId: id, ok: false, actions, detail: `${formatCommand("ipconfig", args)} failed ${failure(r)}` };
    }
  } else {
    const failed = await linuxRenew(ctx, route.iface, actions);
    if (failed) return failed;
  }

  const after = darwin ? await darwinRoute(ctx) : await linuxRoute(ctx);
  const gateway = after.gateway ?? route.gateway;
  if (gateway) {
    const args = darwin ? ["-c", "3", "-t", "5", gateway] : ["-c", "3", "-W", "2", gateway];
    actions.push(formatCommand("ping", args));
    const ping = await ctx.exec("ping", args);
    notes.push(ping.code === 0 ? `gateway ${gateway} answers` : `gateway ${gateway} still not answering ping`);
  }

  actions.push(formatCommand("curl", CURL_ARGS));
  const probe = await ctx.exec("curl", CURL_ARGS);
  if (probe.code !== 0) {
    return {
      pluginId: id,
      ok: false,
      actions,
      detail: [`Renewed lease on ${after.iface}, but HTTPS ${PROBE_URL} still failed ${failure(probe)}`, ...notes].join("; "),
    };
  }
  return {
    pluginId: id,
    ok: true,
    actions,
    detail: [`Flushed gateway ARP and renewed DHCP lease on ${after.iface}; HTTPS ${PROBE_URL} reachable`, ...notes].join("; "),
  };
}

export const fixUnknown: FixPlugin = {
  id,
  title: "Reset the link to an unresponsive gateway (flush ARP, renew DHCP)",
  handles: ["UNKNOWN", "GATEWAY_UNREACHABLE"],
  platforms: ["darwin", "linux"],
  async run(ctx) {
    if (ctx.platform !== "darwin" && ctx.platform !== "linux") {
      return { pluginId: id, ok: false, actions: [], detail: `Unsupported platform: ${String(ctx.platform)}` };
    }
    return repair(ctx);
  },
};

export default fixUnknown;
