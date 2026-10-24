"use client";

import { useRef } from "react";
import { type Beat, frameAt, markAt, schedule } from "../script";
import { Card } from "../ui";
import { useLoop } from "../useLoop";

// Real commands from Uplink's repair plugins (src/lib/fixes/plugins).
const SCRIPT = schedule([
  { kind: "type", text: "uplink diagnose", hold: 300 },
  { kind: "print", text: "dns resolver 10.0.0.1 not responding", tone: "warn", hold: 700 },
  { kind: "type", text: "dscacheutil -flushcache", cps: 44, hold: 250 },
  { kind: "print", text: "✓ cache flushed", tone: "ok", hold: 400 },
  { kind: "type", text: "networksetup -setdnsservers Wi-Fi 1.1.1.1", cps: 52, hold: 250 },
  { kind: "print", text: "✓ resolver switched", tone: "ok", hold: 400 },
  { kind: "type", text: "uplink verify", hold: 250 },
  { kind: "print", text: "✓ all locations healthy · resolved in 4.2s", tone: "ok", mark: "done" },
] satisfies Beat[]);
const LOOP_MS = SCRIPT.total + 3200;

const TONE: Record<string, string> = { ok: "text-emerald-600", warn: "text-orange-600", plain: "text-neutral-500" };

export function FixCard() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useLoop(ref, LOOP_MS);
  const frames = frameAt(SCRIPT.beats, t);
  const done = t >= markAt(SCRIPT.beats, "done");

  return (
    <div ref={ref}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
            <span className="ml-3 font-mono text-[12px] text-neutral-400">uplink · on-device</span>
          </div>
          <span className={`flex items-center gap-1.5 text-[12px] font-medium ${done ? "text-emerald-600" : "text-neutral-500"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-emerald-500" : "animate-pulse bg-orange-500"}`} />
            {done ? "Resolved" : "Fixing"}
          </span>
        </div>
        <div className="h-[268px] space-y-1.5 px-5 py-5 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
          {frames.map(({ beat, text, typing }, i) =>
            beat.kind === "type" ? (
              <div key={i} className="break-all text-neutral-900">
                <span className="select-none text-neutral-300">$ </span>
                {text}
                {typing && <span className="caret ml-px inline-block h-[1.05em] w-[7px] translate-y-[2px] bg-neutral-900" />}
              </div>
            ) : (
              <div key={i} className={`pl-4 ${TONE[beat.tone ?? "plain"]}`}>
                {text}
              </div>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}
