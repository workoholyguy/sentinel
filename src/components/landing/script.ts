// A tiny timeline for the scripted demos (terminal, phone call, Devin session).
// Pure functions: given the script and a playhead in ms, say what is on screen.

export type Tone = "plain" | "muted" | "ok" | "bad" | "warn" | "accent" | "violet";

export interface Beat {
  /** "type" reveals the text one character at a time; "print" shows it all at once. */
  kind: "type" | "print";
  text: string;
  tone?: Tone;
  /** Who is speaking, for scripts that are conversations. */
  who?: string;
  /** Named moment other parts of the stage can react to. */
  mark?: string;
  /** ms of "…" before the beat appears (someone is typing / talking). */
  lead?: number;
  /** ms to hold after the beat finishes, before the next one starts. */
  hold?: number;
  /** characters per second for "type" beats. */
  cps?: number;
}

export interface TimedBeat extends Beat {
  /** when the lead starts */
  start: number;
  /** when the text starts appearing */
  show: number;
  /** when the text is complete */
  end: number;
}

export const DEFAULT_CPS = 38;
export const DEFAULT_HOLD = 260;

export function schedule(beats: Beat[]): { beats: TimedBeat[]; total: number } {
  let t = 0;
  const timed = beats.map((b) => {
    const start = t;
    const show = start + (b.lead ?? 0);
    const end = b.kind === "type" ? show + Math.round((b.text.length / (b.cps ?? DEFAULT_CPS)) * 1000) : show;
    t = end + (b.hold ?? DEFAULT_HOLD);
    return { ...b, start, show, end };
  });
  return { beats: timed, total: t };
}

export interface Frame {
  beat: TimedBeat;
  /** the part of the text visible right now */
  text: string;
  /** still in the lead: show a typing indicator instead of text */
  pending: boolean;
  /** text still being revealed: show a caret */
  typing: boolean;
}

export function frameAt(beats: TimedBeat[], t: number): Frame[] {
  return beats
    .filter((b) => t >= b.start)
    .map((b) => {
      const pending = t < b.show;
      const typing = !pending && t < b.end;
      const chars = typing ? Math.floor(((t - b.show) / 1000) * (b.cps ?? DEFAULT_CPS)) : b.text.length;
      return { beat: b, text: pending ? "" : b.text.slice(0, chars), pending, typing };
    });
}

/** When a named moment happens (Infinity if the script has no such mark). */
export function markAt(beats: TimedBeat[], mark: string): number {
  return beats.find((b) => b.mark === mark)?.show ?? Infinity;
}
