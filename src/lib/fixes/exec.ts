import { execFile } from "node:child_process";
import type { ExecResult, FixContext } from "../types";

export type Platform = FixContext["platform"];

export const EXEC_TIMEOUT_MS = 10_000;

export type ExecFileRunner = (
  file: string,
  args: string[],
  options: { timeout: number },
  callback: (error: (Error & { code?: unknown; killed?: boolean }) | null, stdout: string, stderr: string) => void,
) => unknown;

export interface ExecContextOptions {
  platform: Platform;
  dryRun: boolean;
  sudo?: boolean;
  /** Injectable for tests; defaults to node:child_process execFile. */
  runner?: ExecFileRunner;
}

const recorded: string[] = [];

/** Every command seen in dryRun (and simulated actions), in order. */
export function getRecordedCommands(): string[] {
  return [...recorded];
}

export function clearRecordedCommands(): void {
  recorded.length = 0;
}

export function recordCommand(line: string): void {
  recorded.push(line);
}

export function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a))).join(" ");
}

export function createExecContext(opts: ExecContextOptions): FixContext & { sudo: boolean } {
  const sudo = opts.sudo ?? false;
  const runner: ExecFileRunner = opts.runner ?? (execFile as unknown as ExecFileRunner);

  const exec = (cmd: string, args: string[]): Promise<ExecResult> => {
    const file = sudo ? "sudo" : cmd;
    const argv = sudo ? ["-n", cmd, ...args] : args;

    if (opts.dryRun) {
      recordCommand(formatCommand(file, argv));
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    }

    return new Promise<ExecResult>((resolve) => {
      try {
        runner(file, argv, { timeout: EXEC_TIMEOUT_MS }, (error, stdout, stderr) => {
          const out = String(stdout ?? "");
          const errOut = String(stderr ?? "");
          if (!error) return resolve({ code: 0, stdout: out, stderr: errOut });
          if (error.killed) {
            return resolve({ code: 124, stdout: out, stderr: errOut || `timed out after ${EXEC_TIMEOUT_MS}ms` });
          }
          if (error.code === "ENOENT") {
            return resolve({ code: 127, stdout: out, stderr: errOut || `${file}: command not found` });
          }
          const code = typeof error.code === "number" && error.code !== 0 ? error.code : 1;
          resolve({ code, stdout: out, stderr: errOut || error.message });
        });
      } catch (e) {
        resolve({ code: 1, stdout: "", stderr: e instanceof Error ? e.message : String(e) });
      }
    });
  };

  return { platform: opts.platform, dryRun: opts.dryRun, sudo, exec };
}
