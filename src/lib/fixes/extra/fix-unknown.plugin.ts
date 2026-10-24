import type { FixContext, FixPlugin, FixResult } from "../../types";

// Self-contained (type-only imports) so the runtime loader can import this file directly.

const id = "fix-unknown";

/** Same endpoint and "degraded" threshold the monitor uses for the http-cloudflare probe. */
const PRIMARY_URL = "https://1.1.1.1/cdn-cgi/trace";
/** Cloudflare's secondary anycast address: tells a sick 1.1.1.1 path apart from a sick uplink. */
const ALTERNATE_URL = "https://1.0.0.1/cdn-cgi/trace";
const SLOW_MS = 800;

const curlArgs = (url: string) => ["-sS", "-o", "/dev/null", "-m", "5", "-w", "%{time_total}", url];

function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

interface ProbeOutcome {
  healthy: boolean;
  summary: string;
}

/** HTTPS re-probe via curl; time_total is reported in seconds. Unparseable output (dry run) counts as reachable. */
async function probe(ctx: FixContext, url: string, actions: string[]): Promise<ProbeOutcome> {
  const args = curlArgs(url);
  actions.push(formatCommand("curl", args));
  const r = await ctx.exec("curl", args);
  const host = new URL(url).hostname;
  if (r.code !== 0) return { healthy: false, summary: `${host} unreachable (${r.code}): ${r.stderr.trim()}` };
  const seconds = Number.parseFloat(r.stdout.trim());
  if (!Number.isFinite(seconds)) return { healthy: true, summary: `${host} reachable` };
  const ms = Math.round(seconds * 1000);
  return ms < SLOW_MS ? { healthy: true, summary: `${host} ${ms} ms` } : { healthy: false, summary: `${host} slow (${ms} ms)` };
}

function flushSteps(platform: FixContext["platform"]): Array<[string, string[]]> {
  if (platform === "darwin") return [["dscacheutil", ["-flushcache"]], ["killall", ["-HUP", "mDNSResponder"]]];
  return [["resolvectl", ["flush-caches"]]];
}

/**
 * Unclassified fault where the local path (Wi-Fi, gateway, DNS) is healthy but HTTPS to 1.1.1.1
 * is slow or failing. Clears stale resolver/connection state, then re-probes 1.1.1.1 and, if that
 * is still bad, Cloudflare's secondary 1.0.0.1 to tell a transient edge blip from an upstream problem.
 */
export const fixUnknown: FixPlugin = {
  id,
  title: "Reset stale resolver state and re-verify the upstream HTTPS path",
  handles: ["UNKNOWN"],
  platforms: ["darwin", "linux"],
  async run(ctx): Promise<FixResult> {
    if (ctx.platform !== "darwin" && ctx.platform !== "linux") {
      return { pluginId: id, ok: false, actions: [], detail: `Unsupported platform: ${String(ctx.platform)}` };
    }

    const actions: string[] = [];
    const notes: string[] = [];
    for (const [cmd, args] of flushSteps(ctx.platform)) {
      const line = formatCommand(cmd, args);
      actions.push(line);
      const r = await ctx.exec(cmd, args);
      if (r.code !== 0) notes.push(`${line} failed (${r.code}): ${r.stderr.trim()}`);
    }
    const flushNote = notes.length ? `; cache flush incomplete: ${notes.join("; ")}` : "";

    const primary = await probe(ctx, PRIMARY_URL, actions);
    if (primary.healthy) {
      return { pluginId: id, ok: true, actions, detail: `HTTPS path recovered: ${primary.summary}${flushNote}` };
    }

    const alternate = await probe(ctx, ALTERNATE_URL, actions);
    if (alternate.healthy) {
      return {
        pluginId: id,
        ok: true,
        actions,
        detail: `Internet reachable via ${alternate.summary}; ${primary.summary} looks like a Cloudflare edge blip${flushNote}`,
      };
    }

    return {
      pluginId: id,
      ok: false,
      actions,
      detail: `Upstream still degraded after local reset: ${primary.summary}; ${alternate.summary}. Local path is healthy, so the provider is the likely cause${flushNote}`,
    };
  },
};

export default fixUnknown;
