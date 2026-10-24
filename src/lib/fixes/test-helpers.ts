import type { ExecResult, FixContext } from "../types";
import { formatCommand, type Platform } from "./exec";

export type Responder = Record<string, Partial<ExecResult>>;

/** Fake exec: records formatted commands; responds by longest matching command prefix. */
export function fakeCtx(platform: Platform, responses: Responder = {}, dryRun = false) {
  const calls: string[] = [];
  const ctx: FixContext = {
    platform,
    dryRun,
    async exec(cmd, args) {
      const line = formatCommand(cmd, args);
      calls.push(line);
      const key = Object.keys(responses)
        .filter((k) => line.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      return { code: 0, stdout: "", stderr: "", ...(key ? responses[key] : {}) };
    },
  };
  return { ctx, calls };
}

export const DARWIN_NET = {
  "route -n get default": { stdout: "   route to: default\ndestination: default\n    gateway: 192.168.1.1\n  interface: en0\n" },
  "networksetup -listallnetworkservices": {
    stdout: "An asterisk (*) denotes that a network service is disabled.\nThunderbolt Bridge\nWi-Fi\n*Old VPN\n",
  },
  "networksetup -listnetworkserviceorder": {
    stdout:
      "An asterisk (*) denotes that a network service is disabled.\n(1) Thunderbolt Bridge\n(Hardware Port: Thunderbolt Bridge, Device: bridge0)\n\n(2) Wi-Fi\n(Hardware Port: Wi-Fi, Device: en0)\n",
  },
  "networksetup -listallhardwareports": {
    stdout: "\nHardware Port: Ethernet\nDevice: en7\nEthernet Address: aa\n\nHardware Port: Wi-Fi\nDevice: en1\nEthernet Address: bb\n",
  },
};

export const LINUX_NET = {
  "ip route show default": { stdout: "default via 192.168.1.1 dev wlp2s0 proto dhcp metric 600\n" },
};
