import { motion } from "framer-motion";
import { Building2, Globe, Laptop, Router, Server, Wifi, type LucideIcon } from "lucide-react";
import { type Beat, type Tone, frameAt, markAt, schedule } from "../script";

// The commands UPLink's real repair plugins run (src/lib/fixes/plugins).
const BEATS: Beat[] = [
  { kind: "type", text: "uplink diagnose", hold: 350 },
  { kind: "print", text: "✓ laptop   ✓ wi-fi   ✓ router 2 ms   ✓ dns 9 ms", tone: "ok", hold: 450 },
  { kind: "print", text: "✗ 6 of 9 sites time out", tone: "bad", mark: "down", hold: 800 },
  { kind: "type", text: "dscacheutil -flushcache && killall -HUP mDNSResponder", cps: 58 },
  { kind: "print", text: "✓ dns cache flushed", tone: "ok", hold: 350 },
  { kind: "type", text: "ipconfig set en0 DHCP", cps: 45 },
  { kind: "print", text: "✓ dhcp lease renewed", tone: "ok", hold: 350 },
  { kind: "type", text: "uplink verify" },
  { kind: "print", text: "✗ still failing · not in my playbook", tone: "bad", mark: "failed", hold: 450 },
  { kind: "print", text: "→ calling your ISP with the evidence", tone: "warn", mark: "escalate", hold: 600 },
];
export const LOCAL_FIX = schedule(BEATS);

const TERM_TONE: Record<Tone, string> = {
  plain: "text-white/85",
  muted: "text-white/40",
  ok: "text-emerald-400",
  bad: "text-rose-400",
  warn: "text-amber-300",
  accent: "text-sky-300",
  violet: "text-violet-300",
};

type HopState = "ok" | "bad" | "warn" | "idle";
const HOP_STYLE: Record<HopState, string> = {
  ok: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  bad: "bg-rose-50 text-rose-600 ring-rose-300",
  warn: "bg-amber-50 text-amber-600 ring-amber-300",
  idle: "bg-neutral-50 text-neutral-400 ring-neutral-200",
};

const HOPS: Array<{ id: string; label: string; icon: LucideIcon; value: string }> = [
  { id: "laptop", label: "Laptop", icon: Laptop, value: "en0" },
  { id: "wifi", label: "Wi-Fi", icon: Wifi, value: "−54 dBm" },
  { id: "router", label: "Router", icon: Router, value: "2 ms" },
  { id: "dns", label: "DNS", icon: Server, value: "9 ms" },
  { id: "isp", label: "ISP", icon: Building2, value: "?" },
  { id: "internet", label: "Sites", icon: Globe, value: "6/9 down" },
];

function hopState(id: string, t: number): HopState {
  const down = t >= markAt(LOCAL_FIX.beats, "down");
  if (id === "internet") return down ? "bad" : "ok";
  if (id === "isp") return t >= markAt(LOCAL_FIX.beats, "escalate") ? "warn" : down ? "idle" : "ok";
  return "ok";
}

export function LocalFix({ t }: { t: number }) {
  const frames = frameAt(LOCAL_FIX.beats, t);
  const failed = t >= markAt(LOCAL_FIX.beats, "failed");
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start rounded-xl border border-neutral-200 bg-white px-2 py-4 sm:px-5">
        {HOPS.map(({ id, label, icon: Icon, value }, i) => {
          const s = hopState(id, t);
          return (
            <div key={id} className={`flex items-start ${i ? "flex-1" : ""}`}>
              {i > 0 && (
                <div className="relative mx-0.5 mt-4 h-px flex-1 bg-neutral-200 sm:mx-2 sm:mt-5">
                  {s !== "idle" && s !== "bad" && (
                    <span className="packet h-1.5 w-1.5 rounded-full bg-indigo-400" style={{ ["--dur" as string]: "1.8s", ["--delay" as string]: `${i * 0.25}s` }} />
                  )}
                </div>
              )}
              <div className="flex w-10 flex-col items-center sm:w-14">
                <span className={`relative grid h-8 w-8 place-items-center rounded-full ring-1 transition-colors duration-500 sm:h-10 sm:w-10 ${HOP_STYLE[s]}`}>
                  {(s === "bad" || s === "warn") && <span className="halo absolute inset-0 rounded-full ring-2 ring-current" />}
                  <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </span>
                <span className="mt-1.5 text-[10px] font-medium text-neutral-600 sm:text-[11px]">{label}</span>
                <span className={`hidden font-mono text-[10px] sm:block ${s === "bad" ? "text-rose-500" : "text-neutral-400"}`}>{id === "internet" && s === "ok" ? "18 ms" : value}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-[230px] flex-1 flex-col overflow-hidden rounded-xl bg-[#0c0e14] shadow-inner">
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="ml-2 font-mono text-[10.5px] text-white/35">uplink · on-device agent</span>
        </div>
        <div className="flex flex-1 flex-col justify-end overflow-hidden px-4 py-3 font-mono text-[11px] leading-[1.75] sm:text-[12px]">
          {frames.map(({ beat, text, typing }, i) =>
            beat.kind === "type" ? (
              <div key={i} className="whitespace-pre-wrap break-all">
                <span className="text-indigo-300">❯ </span>
                <span className="text-white/90">{text}</span>
                {typing && <span className="caret ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[2px] bg-indigo-300" />}
              </div>
            ) : (
              <div key={i} className={`whitespace-pre-wrap pl-4 ${TERM_TONE[beat.tone ?? "plain"]}`}>
                {text}
              </div>
            ),
          )}
        </div>
      </div>

      <motion.p initial={false} animate={{ opacity: failed ? 1 : 0 }} className="text-center text-[12.5px] text-neutral-500">
        Most faults end right here, in seconds. This one didn&apos;t.
      </motion.p>
    </div>
  );
}
