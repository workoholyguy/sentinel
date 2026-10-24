"use client";

import { useRef } from "react";
import { type Beat, frameAt, markAt, schedule } from "../script";
import { useLoop } from "../useLoop";

// Real commands from Uplink's repair plugins (src/lib/fixes/plugins).
const SCRIPT = schedule([
  { kind: "type", text: "uplink diagnose", hold: 300 },
  { kind: "print", text: "✗ dns resolver 10.0.0.1 not responding", tone: "warn", hold: 700 },
  { kind: "type", text: "dscacheutil -flushcache", cps: 44, hold: 250 },
  { kind: "print", text: "✓ cache flushed", tone: "ok", hold: 400 },
  { kind: "type", text: "networksetup -setdnsservers Wi-Fi 1.1.1.1", cps: 52, hold: 250 },
  { kind: "print", text: "✓ resolver switched to 1.1.1.1", tone: "ok", hold: 400 },
  { kind: "type", text: "uplink verify", hold: 250 },
  { kind: "print", text: "✓ all locations healthy · resolved in 4.2s", tone: "ok", mark: "done" },
] satisfies Beat[]);
const LOOP_MS = SCRIPT.total + 3200;

const TONE: Record<string, string> = { ok: "text-emerald-400", warn: "text-orange-400", plain: "text-white/55" };

function Prompt() {
  return (
    <span className="select-none">
      <span className="text-emerald-400">uplink@office</span>
      <span className="text-white/35"> ~ </span>
      <span className="text-white/60">%</span>{" "}
    </span>
  );
}

function Cursor() {
  return <span className="caret ml-px inline-block h-[1.05em] w-[0.6em] translate-y-[2px] bg-white/85" />;
}

export function FixCard() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, LOOP_MS);
  const frames = frameAt(SCRIPT.beats, t);
  const done = t >= markAt(SCRIPT.beats, "done");
  const idle = !frames.some((f) => f.typing);

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl bg-[#0c0d10] shadow-[0_30px_60px_-28px_rgb(0_0_0/0.7)] ring-1 ring-black">
      <div className="relative flex items-center border-b border-white/[0.06] bg-[#17181c] px-4 py-3">
        {/* window buttons */}
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.25)]" />
          <span className="h-3 w-3 rounded-full bg-[#4b4c50] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.25)]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.25)]" />
        </div>
        <span className="pointer-events-none absolute inset-x-0 hidden text-center font-mono text-[11.5px] text-white/40 sm:block">uplink — zsh — 80×24</span>
        <span className={`ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${done ? "bg-emerald-400/10 text-emerald-400" : "bg-orange-400/10 text-orange-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-400" : "animate-pulse bg-orange-400"}`} />
          {done ? "Resolved" : "Fixing"}
        </span>
      </div>

      <div className="h-[276px] space-y-1.5 overflow-hidden px-4 py-4 font-mono text-[12px] leading-relaxed sm:px-5 sm:text-[13px]">
        {frames.map(({ beat, text, typing }, i) =>
          beat.kind === "type" ? (
            <div key={i} className="break-all text-white">
              <Prompt />
              {text}
              {typing && <Cursor />}
            </div>
          ) : (
            <div key={i} className={TONE[beat.tone ?? "plain"]}>
              {text}
            </div>
          ),
        )}
        {idle && (
          <div className="text-white">
            <Prompt />
            <Cursor />
          </div>
        )}
      </div>
    </div>
  );
}
