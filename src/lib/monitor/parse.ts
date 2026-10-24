// Pure parsers for the command output the monitor collects. No I/O here, so every
// format (macOS + Linux) is covered by fixture tests in parse.test.ts.

export interface PingStats {
  sent: number;
  received: number;
  lossPct: number;
  avgMs?: number;
}

/** iputils (Linux), BusyBox and macOS/BSD ping summaries. */
export function parsePing(out: string): PingStats | null {
  const m = out.match(/(\d+) packets transmitted, (\d+) (?:packets )?received,.*?([\d.]+)% packet loss/);
  if (!m) return null;
  const sent = Number(m[1]);
  const received = Number(m[2]);
  // "rtt min/avg/max/mdev = 6.792/7.067/7.443/0.275 ms" (Linux)
  // "round-trip min/avg/max/stddev = 2.871/3.402/4.012/0.471 ms" (macOS)
  const rtt = out.match(/(?:rtt|round-trip) [\w/]+ = [\d.]+\/([\d.]+)\//);
  return {
    sent,
    received,
    lossPct: Number(m[3]),
    avgMs: rtt ? Number(rtt[1]) : undefined,
  };
}

export interface Gateway {
  ip: string;
  iface?: string;
}

/** darwin: `route -n get default`; linux: `ip route show default`. */
export function parseDefaultGateway(platform: "darwin" | "linux", out: string): Gateway | null {
  if (platform === "darwin") {
    const ip = out.match(/^\s*gateway:\s*(\S+)/m)?.[1];
    if (!ip) return null;
    const iface = out.match(/^\s*interface:\s*(\S+)/m)?.[1];
    return { ip, iface };
  }
  const m = out.match(/^default via (\S+)(?:.*?\bdev (\S+))?/m);
  return m ? { ip: m[1], iface: m[2] } : null;
}

export interface WifiLink {
  /** "unknown" when the machine has no Wi-Fi interface (e.g. wired). */
  state: "connected" | "disconnected" | "unknown";
  ssid?: string;
  iface?: string;
}

/** darwin: `networksetup -getairportnetwork en0`. */
export function parseAirportNetwork(out: string): WifiLink {
  const ssid = out.match(/Current Wi-Fi Network:\s*(.+)/)?.[1]?.trim();
  if (ssid) return { state: "connected", ssid };
  if (/not a Wi-Fi interface|Error obtaining/i.test(out)) return { state: "unknown" };
  return { state: "disconnected" };
}

/** darwin: `ipconfig getsummary en0` (newer macOS redacts the SSID from networksetup). */
export function parseIpconfigSummary(out: string): WifiLink {
  const ssid = out.match(/^\s*SSID\s*:\s*(.+)$/m)?.[1]?.trim();
  const active = out.match(/^\s*LinkStatusActive\s*:\s*(\w+)/m)?.[1];
  if (active === "TRUE" || (ssid && active !== "FALSE")) return { state: "connected", ssid };
  if (active === "FALSE") return { state: "disconnected" };
  return { state: "unknown" };
}

/** linux: `nmcli -t -f active,ssid dev wifi`. Empty output means no Wi-Fi scan results. */
export function parseNmcliWifi(out: string): WifiLink {
  const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { state: "unknown" };
  const active = lines.find((l) => /^yes:/.test(l));
  if (active) return { state: "connected", ssid: active.slice(4).replace(/\\:/g, ":") || undefined };
  return { state: "disconnected" };
}

/** linux: `iw dev`. A managed interface with an `ssid` line is associated. */
export function parseIwDev(out: string): WifiLink {
  const blocks = out.split(/^\s*Interface\s+/m).slice(1);
  if (blocks.length === 0) return { state: "unknown" };
  for (const b of blocks) {
    const ssid = b.match(/^\s*ssid\s+(.+)$/m)?.[1]?.trim();
    if (ssid) return { state: "connected", ssid, iface: b.split(/\s/)[0] };
  }
  return { state: "disconnected", iface: blocks[0].split(/\s/)[0] };
}

export interface Hop {
  hop: number;
  ip?: string;
  ms?: number;
}

/** `traceroute -n -q 1` output (same layout on macOS and Linux). */
export function parseTraceroute(out: string): Hop[] {
  const hops: Hop[] = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const rest = m[2].trim();
    const ip = rest.match(/^(\d{1,3}(?:\.\d{1,3}){3})/)?.[1];
    const ms = rest.match(/([\d.]+)\s*ms/)?.[1];
    hops.push({ hop: Number(m[1]), ip, ms: ms ? Number(ms) : undefined });
  }
  return hops;
}

/** RFC1918, CGNAT (100.64/10), loopback and link-local. */
export function isPrivateIp(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254)
  );
}

/** First responding hop beyond the gateway with a public address: the provider's edge. */
export function firstPublicHop(hops: Hop[], gateway?: string): string | null {
  for (const h of hops) {
    if (!h.ip || h.ip === gateway || isPrivateIp(h.ip)) continue;
    return h.ip;
  }
  return null;
}
