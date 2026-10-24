import type { Diagnosis, FaultCode, FixResult, Probe, Snapshot } from "../types";

export interface RepairBriefInput {
  fault: FaultCode | string;
  diagnosis?: Diagnosis;
  snapshot: Snapshot;
  platform: "darwin" | "linux";
  repo: string;
  /** Playbook fixes that already ran and did not heal the fault. */
  failedFixes?: FixResult[];
}

export function pluginIdFor(fault: FaultCode | string): string {
  const slug = String(fault)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `fix-${slug}` : "fix-unknown-fault";
}

function probeLine(p: Probe): string {
  const parts = [`[${p.status}]`, `${p.id} (${p.node}): ${p.label}`];
  if (p.latencyMs !== undefined) parts.push(`latency ${p.latencyMs} ms`);
  if (p.lossPct !== undefined) parts.push(`loss ${p.lossPct}%`);
  if (p.detail) parts.push(`— ${p.detail}`);
  parts.push(`@ ${p.at}`);
  return `- ${parts.join(" ")}`;
}

export function buildRepairBrief(input: RepairBriefInput): string {
  const { fault, diagnosis, snapshot, platform, repo, failedFixes = [] } = input;
  const id = pluginIdFor(fault);
  const faultText = String(fault);

  const lines: string[] = [
    "You are writing a repair plugin for Uplink, an AI that watches a small office network, diagnoses outages with an on-device model and fixes them with repair plugins.",
    failedFixes.length
      ? "Uplink's existing repair plugins ran for this fault and did not fix it. Write ONE new plugin that does."
      : "Uplink hit a fault that no existing repair plugin handles. Write ONE new plugin that fixes it.",
    "",
    "## Repository",
    `- Repo: ${repo} (branch off main)`,
    "- Read AGENTS.md and src/lib/types.ts first. src/lib/types.ts is a fixed contract: do NOT edit it.",
    "",
    "## What is broken",
    `- Fault code: ${faultText}`,
    `- Platform: ${platform}`,
  ];
  if (diagnosis) {
    lines.push(
      `- Diagnosis: ${diagnosis.summary}`,
      `- Diagnosed fault: ${diagnosis.fault} · blame: ${diagnosis.blame} · confidence: ${diagnosis.confidence}`,
    );
    if (diagnosis.explanation) lines.push(`- Explanation: ${diagnosis.explanation}`);
  }

  lines.push("", "### Evidence");
  if (diagnosis?.evidence.length) for (const e of diagnosis.evidence) lines.push(`- ${e}`);
  else lines.push("- (no diagnosis evidence supplied; rely on the probe data below)");

  if (failedFixes.length) {
    lines.push("", "### Fixes already tried (they did not help — do not repeat them)");
    for (const f of failedFixes) lines.push(`- ${f.pluginId}: ${f.actions.join(" · ") || "(no actions)"}${f.detail ? ` — ${f.detail}` : ""}`);
  }

  lines.push("", `### Probe data (snapshot at ${snapshot.at})`, "Node health:");
  lines.push(
    ...Object.entries(snapshot.nodes).map(([node, health]) => `- ${node}: ${health}`),
    "Probes:",
    ...(snapshot.probes.length ? snapshot.probes.map(probeLine) : ["- (no probes)"]),
  );

  lines.push(
    "",
    "## What to build",
    `1. Add exactly ONE new plugin file: src/lib/fixes/extra/${id}.plugin.ts`,
    "   - Export an object implementing the FixPlugin interface from src/lib/types.ts:",
    `     - id: "${id}"`,
    "     - title: a short human-readable description of what it fixes",
    `     - handles: [${JSON.stringify(faultText)}]${faultText === "UNKNOWN" ? " (plus a more specific FaultCode if the evidence clearly maps to one)" : ""}`,
    `     - platforms: include "${platform}" (add the other platform only if you implement it correctly)`,
    "     - run(ctx: FixContext): Promise<FixResult> — perform the repair using ONLY ctx.exec(cmd, args) for side effects (no child_process, fs, network or other side-effecting imports). Respect ctx.platform; ctx.dryRun is handled by the exec implementation.",
    `   - Return a FixResult with pluginId "${id}", ok, human-readable actions (the commands run) and detail on failure. Do not throw for expected command failures.`,
    "   - Commands must be safe and idempotent; re-probe via ctx.exec to verify the fix where possible.",
    `2. Add unit tests next to it (src/lib/fixes/extra/${id}.plugin.test.ts) using a fake exec that records calls and returns canned ExecResults. Cover the success path, a failing command, and both platforms you claim. No network calls in tests.`,
    "3. Do not modify other existing files except to register the plugin if src/lib/fixes has an explicit registry for extra plugins.",
    "4. pnpm typecheck and pnpm test must pass.",
    `5. Open a pull request to main titled "repair: <what it fixes>" (e.g. "repair: ${faultText.toLowerCase().replace(/[_-]+/g, " ")}"). In the PR description, summarise the fault, the evidence above and the commands the plugin runs.`,
    "",
    "When done, report the PR URL and plugin id in the structured output.",
  );
  return lines.join("\n");
}
