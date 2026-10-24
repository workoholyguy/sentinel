// Live network probes, walking the packet's path: wifi → router → dns → isp edge → internet.
// Every side effect (exec, DNS, HTTP) is injectable so tests never touch the network.
import { execFile } from "node:child_process";
import { Resolver } from "node:dns/promises";
import type { ExecResult, Health, NodeId, Probe, Snapshot } from "../types";
import { NODE_ORDER } from "../types";
import {
  firstPublicHop,
  parseAirportNetwork,
  parseDefaultGateway,
  parseIpconfigSummary,
  parseIwDev,
  parseNmcliWifi,
  parsePing,
  parseTraceroute,
  type Gateway,
  type WifiLink,
} from "./parse";

export type Platform = "darwin" | "linux";
export type Exec = (cmd: string, args: string[]) => Promise<ExecResult>;
export type DnsLookup = (host: string, server?: string) => Promise<number>;
export type HttpProbe = (url: string, timeoutMs: number) => Promise<number>;

export interface MonitorOptions {
  platform: Platform;
  exec?: Exec;
  dnsLookup?: DnsLookup;
  httpProbe?: HttpProbe;
}

export interface Monitor {
  sample(): Promise<Snapshot>;
}

export const DNS_HOST = "example.com";
export const INTERNET_URL = "https://1.1.1.1/cdn-cgi/trace";
export const FALLBACK_EDGE = "1.1.1.1";
const EDGE_CACHE_MS = 5 * 60_000;

// Thresholds a probe needs to cross to count as "degraded".
export const SLOW_MS: Record<"router" | "dns" | "isp" | "internet", number> = {
  router: 50,
  dns: 300,
  isp: 150,
  internet: 800,
};
export const LOSS_DEGRADED_PCT = 10;

// ---- real defaults -------------------------------------------------------------------

export const defaultExec: Exec = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: 8000 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === "number" ? err.code : err.code === "ENOENT" ? 127 : 1) : 0;
      resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? (err ? err.message : "")) });
    });
  });

export const defaultDnsLookup: DnsLookup = async (host, server) => {
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  if (server) resolver.setServers([server]);
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      resolver.resolve4(host),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          resolver.cancel();
          reject(new Error("timeout after 2s"));
        }, 2000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return Date.now() - started;
};

export const defaultHttpProbe: HttpProbe = async (url, timeoutMs) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Date.now() - started;
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`timeout after ${Math.round(timeoutMs / 1000)}s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

// ---- helpers -------------------------------------------------------------------------

const RANK: Record<Health, number> = { ok: 0, unknown: 1, degraded: 2, down: 3 };

export function worst(states: Health[]): Health {
  return states.reduce<Health>((w, s) => (RANK[s] > RANK[w] ? s : w), "ok");
}

export function nodesFromProbes(probes: Probe[]): Record<NodeId, Health> {
  const out = {} as Record<NodeId, Health>;
  for (const n of NODE_ORDER) {
    const mine = probes.filter((p) => p.node === n).map((p) => p.status);
    out[n] = n === "device" ? "ok" : mine.length ? worst(mine) : "unknown";
  }
  return out;
}

function pingHealth(lossPct: number, avgMs: number | undefined, slowMs: number): Health {
  if (lossPct >= 100) return "down";
  if (lossPct >= LOSS_DEGRADED_PCT || (avgMs ?? 0) >= slowMs) return "degraded";
  return "ok";
}

const round = (n: number) => Math.round(n * 10) / 10;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function pingArgs(platform: Platform, host: string): string[] {
  // macOS: -W is per-reply wait in ms, -t is the overall timeout in s. Linux: -W in s.
  return platform === "darwin" ? ["-n", "-c", "3", "-i", "0.2", "-W", "1000", "-t", "3", host] : ["-n", "-c", "3", "-i", "0.2", "-W", "1", host];
}

// ---- monitor -------------------------------------------------------------------------

export function createMonitor(opts: MonitorOptions): Monitor {
  const { platform } = opts;
  const exec = opts.exec ?? defaultExec;
  const dnsLookup = opts.dnsLookup ?? defaultDnsLookup;
  const httpProbe = opts.httpProbe ?? defaultHttpProbe;
  let edgeCache: { gateway: string; ip: string; at: number } | null = null;

  async function wifiLink(): Promise<WifiLink> {
    if (platform === "darwin") {
      const a = parseAirportNetwork((await exec("networksetup", ["-getairportnetwork", "en0"])).stdout);
      if (a.state === "connected") return { ...a, iface: "en0" };
      const s = parseIpconfigSummary((await exec("ipconfig", ["getsummary", "en0"])).stdout);
      return { ...(s.state === "unknown" ? a : s), iface: "en0" };
    }
    const nm = await exec("nmcli", ["-t", "-f", "active,ssid", "dev", "wifi"]);
    if (nm.code === 0) {
      const w = parseNmcliWifi(nm.stdout);
      if (w.state !== "unknown") return w;
    }
    const iw = await exec("iw", ["dev"]);
    return iw.code === 0 ? parseIwDev(iw.stdout) : { state: "unknown" };
  }

  async function gateway(): Promise<Gateway | null> {
    const r = platform === "darwin" ? await exec("route", ["-n", "get", "default"]) : await exec("ip", ["route", "show", "default"]);
    return parseDefaultGateway(platform, r.stdout);
  }

  async function ping(id: string, node: "router" | "isp", label: string, host: string, at: string): Promise<Probe> {
    const r = await exec("ping", pingArgs(platform, host));
    const stats = parsePing(r.stdout);
    if (!stats) {
      return { id, node, label, status: "down", lossPct: 100, detail: (r.stderr || r.stdout).trim().split("\n")[0] || "ping failed", at };
    }
    const latencyMs = stats.avgMs !== undefined ? round(stats.avgMs) : undefined;
    return {
      id,
      node,
      label,
      status: pingHealth(stats.lossPct, latencyMs, SLOW_MS[node]),
      latencyMs,
      lossPct: stats.lossPct,
      detail: `${stats.received}/${stats.sent} replies`,
      at,
    };
  }

  async function edgeIp(gw: Gateway | null): Promise<{ ip: string; found: boolean }> {
    const key = gw?.ip ?? "";
    if (edgeCache && edgeCache.gateway === key && Date.now() - edgeCache.at < EDGE_CACHE_MS) return { ip: edgeCache.ip, found: true };
    const r = await exec("traceroute", ["-n", "-m", "4", "-q", "1", "-w", "1", FALLBACK_EDGE]);
    const ip = firstPublicHop(parseTraceroute(r.stdout), gw?.ip);
    if (ip && ip !== FALLBACK_EDGE) {
      edgeCache = { gateway: key, ip, at: Date.now() };
      return { ip, found: true };
    }
    return { ip: FALLBACK_EDGE, found: false };
  }

  async function dnsProbe(at: string): Promise<Probe> {
    const base = { id: "dns-system", node: "dns" as const, label: `DNS lookup ${DNS_HOST}`, at };
    try {
      const ms = await dnsLookup(DNS_HOST);
      return { ...base, status: ms >= SLOW_MS.dns ? "degraded" : "ok", latencyMs: Math.round(ms) };
    } catch (e) {
      return { ...base, status: "down", detail: errText(e) };
    }
  }

  async function httpProbeOf(at: string): Promise<Probe> {
    const base = { id: "http-cloudflare", node: "internet" as const, label: "HTTPS 1.1.1.1", at };
    try {
      const ms = await httpProbe(INTERNET_URL, 5000);
      return { ...base, status: ms >= SLOW_MS.internet ? "degraded" : "ok", latencyMs: Math.round(ms) };
    } catch (e) {
      return { ...base, status: "down", detail: errText(e) };
    }
  }

  async function ispProbe(gw: Gateway | null, at: string): Promise<Probe> {
    const edge = await edgeIp(gw);
    const label = edge.found ? `ISP edge ping ${edge.ip}` : `ISP edge ping ${edge.ip} (edge not found, using Cloudflare)`;
    return ping("ping-isp", "isp", label, edge.ip, at);
  }

  return {
    async sample() {
      const at = new Date().toISOString();
      const [wifi, gw] = await Promise.all([wifiLink(), gateway()]);

      const wifiProbe: Probe = {
        id: "wifi-link",
        node: "wifi",
        label: wifi.ssid ? `Wi-Fi link (${wifi.ssid})` : "Wi-Fi link",
        status: wifi.state === "connected" ? "ok" : wifi.state === "disconnected" ? "down" : "unknown",
        detail:
          wifi.state === "connected"
            ? `associated${wifi.iface ? ` on ${wifi.iface}` : ""}`
            : wifi.state === "disconnected"
              ? "not associated with any network"
              : "no Wi-Fi interface (wired?)",
        at,
      };

      const routeProbe: Probe = gw
        ? { id: "gateway-route", node: "router", label: "Default gateway", status: "ok", detail: `${gw.ip}${gw.iface ? ` via ${gw.iface}` : ""}`, at }
        : { id: "gateway-route", node: "router", label: "Default gateway", status: "down", detail: "no default route (no DHCP lease?)", at };

      const [gwPing, dns, isp, internet] = await Promise.all([
        gw ? ping("ping-gateway", "router", `Gateway ping ${gw.ip}`, gw.ip, at) : Promise.resolve(null),
        dnsProbe(at),
        ispProbe(gw, at),
        httpProbeOf(at),
      ]);

      const probes = [wifiProbe, routeProbe, gwPing, dns, isp, internet].filter((p): p is Probe => p !== null);
      return { at, probes, nodes: nodesFromProbes(probes) };
    },
  };
}
