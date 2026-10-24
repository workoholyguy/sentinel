"use client";

import { Building2, Globe, Laptop, Router, Server, Wifi, type LucideIcon } from "lucide-react";
import { useRef } from "react";
import { type Beat, frameAt, markAt, schedule } from "../script";
import { TONE_TEXT, Window } from "../ui";
import { usePlayhead } from "../usePlayhead";

// The commands are the ones UPLink's real repair plugins run (src/lib/fixes/plugins).
const BEATS: Beat[] = [
  { kind: "type", text: "uplink watch", hold: 380 },
  { kind: "print", text: "probing 6 hops every second…", tone: "muted", hold: 700 },
  { kind: "print", text: "✓ laptop   ✓ wi-fi -54 dBm   ✓ router 2 ms", tone: "ok", hold: 500 },
  { kind: "print", text: "✗ dns      10.255.255.1 timed out (3/3)", tone: "bad", mark: "down", hold: 900 },
  { kind: "type", text: "uplink diagnose", mark: "diagnose" },
  { kind: "print", text: "fault      DNS_RESOLVER_DOWN", tone: "plain", hold: 120 },
  { kind: "print", text: "blame      local · confidence 0.94", tone: "plain", hold: 120 },
  { kind: "print", text: "model      on-device · no internet needed", tone: "muted", hold: 800 },
  { kind: "type", text: "dscacheutil -flushcache && killall -HUP mDNSResponder", mark: "fix", cps: 52 },
  { kind: "print", text: "✓ dns cache flushed", tone: "ok", hold: 400 },
  { kind: "type", text: "networksetup -setdnsservers Wi-Fi 1.1.1.1 8.8.8.8", cps: 52 },
  { kind: "print", text: "✓ resolver switched to 1.1.1.1", tone: "ok", mark: "fixed", hold: 500 },
  { kind: "type", text: "uplink verify" },
  { kind: "print", text: "✓ 6/6 hops healthy · 18 ms to the internet", tone: "ok", hold: 200 },
  { kind: "print", text: "resolved in 4.2 s, before anyone noticed.", tone: "accent", mark: "done" },
];
const SCRIPT = schedule(BEATS);

const HOPS: Array<{ id: string; icon: LucideIcon }> = [
  { id: "laptop", icon: Laptop },
  { id: "wi-fi", icon: Wifi },
  { id: "router", icon: Router },
  { id: "dns", icon: Server },
  { id: "isp", icon: Building2 },
  { id: "internet", icon: Globe },
];

type HopState = "ok" | "bad" | "unknown";
const HOP_COLOR: Record<HopState, string> = { ok: "#34d399", bad: "#ff4d6d", unknown: "rgb(255 255 255 / 0.2)" };

function HopStrip({ broken }: { broken: boolean }) {
  return (
    <div className="flex items-center px-4 py-4 sm:px-6">
      {HOPS.map(({ id, icon: Icon }, i) => {
        const state: HopState = !broken ? "ok" : id === "dns" ? "bad" : i > 3 ? "unknown" : "ok";
        const color = HOP_COLOR[state];
        return (
          <div key={id} className={`flex items-center ${i ? "flex-1" : ""}`}>
            {i > 0 && (
              <div className="relative mx-1 h-px flex-1 sm:mx-2" style={{ background: i > 3 && broken ? "rgb(255 255 255 / 0.08)" : `${HOP_COLOR.ok}55` }}>
                {!(broken && i > 2) && <span className="packet h-1 w-1 rounded-full bg-ok" style={{ ["--dur" as string]: "1.6s", ["--delay" as string]: `${i * 0.2}s` }} />}
              </div>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="relative grid h-8 w-8 place-items-center rounded-full border transition-colors duration-500 sm:h-9 sm:w-9"
                style={{ borderColor: color, color, background: `${state === "unknown" ? "transparent" : color + "14"}` }}
              >
                {state === "bad" && <span className="halo absolute inset-0 rounded-full border border-bad" />}
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-white/35 sm:block">{id}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function status(t: number): { text: string; color: string } {
  if (t >= markAt(SCRIPT.beats, "fixed")) return { text: "Healthy", color: "#34d399" };
  if (t >= markAt(SCRIPT.beats, "fix")) return { text: "Fixing", color: "#38e1ff" };
  if (t >= markAt(SCRIPT.beats, "diagnose")) return { text: "Diagnosing", color: "#fbbf24" };
  if (t >= markAt(SCRIPT.beats, "down")) return { text: "Fault · DNS", color: "#ff4d6d" };
  return { text: "Watching", color: "#34d399" };
}

export function TerminalStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = usePlayhead(ref, SCRIPT.total);
  const frames = frameAt(SCRIPT.beats, t);
  const broken = t >= markAt(SCRIPT.beats, "down") && t < markAt(SCRIPT.beats, "fixed");
  const s = status(t);
  const finished = t >= markAt(SCRIPT.beats, "done");

  return (
    <div ref={ref}>
      <Window
        title="uplink — on-device agent"
        right={
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: s.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            {s.text}
          </span>
        }
      >
        <div className="border-b border-white/[0.05]">
          <HopStrip broken={broken} />
        </div>
        <div className="flex h-[340px] flex-col justify-end overflow-hidden px-4 py-4 font-mono text-[11.5px] leading-[1.75] sm:h-[384px] sm:px-6 sm:text-[12.5px]">
          {frames.map(({ beat, text, typing }, i) =>
            beat.kind === "type" ? (
              <div key={i} className="whitespace-pre-wrap break-all">
                <span className="text-accent">❯ </span>
                <span className="text-white/90">{text}</span>
                {typing && <span className="caret ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[2px] bg-accent/80" />}
              </div>
            ) : (
              <div key={i} className={`whitespace-pre-wrap pl-4 ${TONE_TEXT[beat.tone ?? "plain"]}`}>
                {text}
              </div>
            ),
          )}
          {(finished || frames.length === 0) && (
            <div>
              <span className="text-accent">❯ </span>
              <span className="caret inline-block h-[1.1em] w-[0.55em] translate-y-[2px] bg-accent/80" />
            </div>
          )}
        </div>
      </Window>
    </div>
  );
}
