// A real ISP outage on demand, for the demo: block everything past the router while the router itself
// stays reachable (what a dead provider looks like from inside the house). macOS firewall (pf), so it
// needs root: a one-time sudoers rule lets the app run pfctl without a password prompt on stage.
// Same rules as scripts/outage.sh, which shares the state file.
import { execFile } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STATE = "/tmp/uplink-outage.state";
const PFCTL = "/sbin/pfctl";

export const SETUP_COMMAND = `echo "$(whoami) ALL=(root) NOPASSWD: ${PFCTL}" | sudo tee /etc/sudoers.d/uplink-outage >/dev/null && sudo chmod 440 /etc/sudoers.d/uplink-outage`;

function run(file: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) =>
    execFile(file, args, { timeout: 10_000 }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }),
    ),
  );
}

const sudoPf = (args: string[]) => run("sudo", ["-n", PFCTL, ...args]);

export function outageActive(): boolean {
  return existsSync(STATE);
}

export type OutageResult = { ok: true; active: boolean; gateway?: string } | { ok: false; needsSetup: boolean; error: string };

export async function startOutage(): Promise<OutageResult> {
  const route = await run("route", ["-n", "get", "default"]);
  const gw = route.out.match(/gateway:\s*(\S+)/)?.[1];
  if (!gw) return { ok: false, needsSetup: false, error: "No default gateway — connect to Wi-Fi first." };
  const info = await sudoPf(["-s", "info"]);
  if (!info.ok) return { ok: false, needsSetup: /password|sudo/i.test(info.out), error: info.out || "sudo pfctl failed" };
  const was = info.out.match(/Status:\s*(\w+)/)?.[1] ?? "Disabled";
  const rules = join(tmpdir(), `uplink-outage-${Date.now()}.pf`);
  writeFileSync(
    rules,
    [
      "set skip on lo0",
      `pass out quick inet from any to ${gw}`,
      `pass in quick inet from ${gw} to any`,
      "pass out quick inet proto udp from any port 68 to any port 67",
      "block drop out quick inet all",
      "block drop out quick inet6 all",
      "",
    ].join("\n"),
  );
  const load = await sudoPf(["-q", "-f", rules]);
  rmSync(rules, { force: true });
  if (!load.ok) return { ok: false, needsSetup: false, error: load.out };
  await sudoPf(["-q", "-e"]); // already enabled is fine
  writeFileSync(STATE, was);
  return { ok: true, active: true, gateway: gw };
}

export async function endOutage(): Promise<OutageResult> {
  if (!outageActive()) return { ok: true, active: false };
  const was = readFileSync(STATE, "utf8").trim();
  const restore = await sudoPf(["-q", "-f", "/etc/pf.conf"]);
  if (!restore.ok) return { ok: false, needsSetup: /password|sudo/i.test(restore.out), error: restore.out };
  if (was === "Disabled") await sudoPf(["-q", "-d"]);
  rmSync(STATE, { force: true });
  return { ok: true, active: false };
}
