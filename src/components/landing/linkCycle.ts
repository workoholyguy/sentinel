// The hero's story loop: the link runs clean, one hop breaks, UPLink heals it. Three faults, one per escalation level.

export interface Fault {
  /** index of the broken link in the chain (link i joins node i and node i + 1) */
  link: number;
  fault: string;
  fix: string;
  /** colour of the level that fixed it: on-device, provider call, Devin */
  tone: string;
}

export const FAULTS: Fault[] = [
  { link: 1, fault: "DNS not answering", fix: "Fixed on-device · 4 s", tone: "#6366f1" },
  { link: 3, fault: "38% packet loss at the ISP", fix: "Ticket + $4.30 credit", tone: "#f59e0b" },
  { link: 4, fault: "A fault nobody's seen before", fix: "Devin shipped a fix", tone: "#8b5cf6" },
];

export type Phase = "ok" | "broken" | "healed";

const OK_MS = 2200;
const BROKEN_MS = 2200;
const HEALED_MS = 2300;
export const CYCLE_MS = OK_MS + BROKEN_MS + HEALED_MS;

export function cycleAt(ms: number): { k: number; phase: Phase } {
  const k = Math.floor(ms / CYCLE_MS) % FAULTS.length;
  const t = ms % CYCLE_MS;
  const phase: Phase = t < OK_MS ? "ok" : t < OK_MS + BROKEN_MS ? "broken" : "healed";
  return { k, phase };
}

export type LinkState = "ok" | "broken" | "dead" | "healed" | "escalating";

/** How link `i` looks right now. Past a break nothing gets through; Devin's link lights up when Devin is the fix. */
export function linkState(i: number, k: number, phase: Phase, links: number): LinkState {
  const f = FAULTS[k];
  const devinLink = links - 1;
  if (phase === "broken") {
    if (i === f.link) return "broken";
    if (i === devinLink && f.tone === FAULTS[2].tone) return "escalating";
    return i > f.link ? "dead" : "ok";
  }
  if (phase === "healed" && (i === f.link || (i === devinLink && f.tone === FAULTS[2].tone))) return "healed";
  return "ok";
}
