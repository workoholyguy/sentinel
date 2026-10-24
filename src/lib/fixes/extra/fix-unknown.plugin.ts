import type { FixContext, FixPlugin, FixResult } from "../../types";

// Self-contained (type-only imports) so the runtime loader can import this file directly.

const id = "fix-unknown";
/** Same endpoint and "degraded" threshold the monitor's http-cloudflare probe uses. */
const PROBE_URL = "https://1.1.1.1/cdn-cgi/trace";
const SLOW_MS = 800;
const REPROBES = 3;
const CURL_ARGS = ["-sS", "-o", "/dev/null", "-m", "5", "-w", "%{http_code} %{time_total}", PROBE_URL];

type Step = [string, string[]];

const FLUSH_STEPS: Record<"darwin" | "linux", Step[]> = {
  darwin: [
    ["dscacheutil", ["-flushcache"]],
    ["killall", ["-HUP", "mDNSResponder"]],
  ],
  linux: [["resolvectl", ["flush-caches"]]],
};

function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

interface ProbeResult {
  healthy: boolean;
  ms?: number;
  why: string;
}

/** HTTPS probe to 1.1.1.1; healthy when it answers with HTTP < 400 under the monitor's slow threshold. */
async function probe(ctx: FixContext, actions: string[]): Promise<ProbeResult> {
  actions.push(formatCommand("curl", CURL_ARGS));
  const r = await ctx.exec("curl", CURL_ARGS);
  if (r.code !== 0) return { healthy: false, why: `curl failed (${r.code}): ${r.stderr.trim()}` };
  const [status, secs] = r.stdout.trim().split(/\s+/);
  const ms = Math.round(Number(secs) * 1000);
  if (!Number.isFinite(ms) || !/^\d{3}$/.test(status ?? "")) {
    // Dry run returns empty output; anything else unparseable is not proof of health.
    return ctx.dryRun ? { healthy: true, why: "dry run" } : { healthy: false, why: `unexpected curl output "${r.stdout.trim()}"` };
  }
  if (Number(status) >= 400) return { healthy: false, ms, why: `HTTP ${status}` };
  if (ms >= SLOW_MS) return { healthy: false, ms, why: `${ms} ms (threshold ${SLOW_MS} ms)` };
  return { healthy: true, ms, why: `${ms} ms` };
}

/**
 * The internet hop is slow (HTTPS to 1.1.1.1 ~1 s) while Wi-Fi, gateway, DNS and ISP pings are fine.
 * Measure first and do nothing if it already recovered; otherwise flush the local resolver cache
 * (safe, idempotent, drops stale/slow answers) and re-probe a few times to confirm latency is back
 * under the monitor's threshold. If it stays slow the problem is upstream, which is reported as such.
 */
export const fixUnknown: FixPlugin = {
  id,
  title: "Recover from slow HTTPS on an otherwise healthy path: flush resolver cache and verify latency",
  handles: ["UNKNOWN", "SLOW_SPEED"],
  platforms: ["darwin", "linux"],
  async run(ctx): Promise<FixResult> {
    if (ctx.platform !== "darwin" && ctx.platform !== "linux") {
      return { pluginId: id, ok: false, actions: [], detail: `Unsupported platform: ${String(ctx.platform)}` };
    }
    const actions: string[] = [];

    const baseline = await probe(ctx, actions);
    if (baseline.healthy && !ctx.dryRun) {
      return { pluginId: id, ok: true, actions, detail: `HTTPS 1.1.1.1 already healthy (${baseline.why}); nothing changed.` };
    }

    for (const [cmd, args] of FLUSH_STEPS[ctx.platform]) {
      const line = formatCommand(cmd, args);
      actions.push(line);
      const r = await ctx.exec(cmd, args);
      if (r.code !== 0) {
        return { pluginId: id, ok: false, actions, detail: `${line} failed (${r.code}): ${r.stderr.trim()}` };
      }
    }

    let last: ProbeResult = baseline;
    for (let i = 0; i < REPROBES; i++) {
      last = await probe(ctx, actions);
      if (last.healthy) {
        return {
          pluginId: id,
          ok: true,
          actions,
          detail: `Flushed DNS cache; HTTPS 1.1.1.1 back to normal (${last.why}, was ${baseline.why}).`,
        };
      }
    }
    return {
      pluginId: id,
      ok: false,
      actions,
      detail: `Flushed DNS cache, but HTTPS 1.1.1.1 is still slow after ${REPROBES} re-probes (${last.why}); local hops are fine, so the slowdown is likely upstream.`,
    };
  },
};

export default fixUnknown;
