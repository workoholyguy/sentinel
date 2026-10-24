"use client";

import { motion } from "framer-motion";
import { Check, FileCode2, GitPullRequest } from "lucide-react";
import { Fragment, type ReactNode, useRef } from "react";
import { DevinMark } from "../brand";
import { type Beat, frameAt, markAt, schedule } from "../script";
import { Window } from "../ui";
import { usePlayhead } from "../usePlayhead";

// Written against the real plugin contract (FixPlugin in src/lib/types.ts).
const CODE = `const id = "fix-ipv6-blackhole";

export const fixIpv6Blackhole: FixPlugin = {
  id,
  title: "Fall back to IPv4 when IPv6 is blackholed",
  handles: ["IPV6_BLACKHOLE"],
  platforms: ["darwin", "linux"],
  async run(ctx) {
    const service = await darwinActiveService(ctx);
    return runSteps(ctx, id, [
      ["networksetup", ["-setv6off", service]],
    ], "IPv6 off, traffic back on IPv4");
  },
};`;

const BEATS: Beat[] = [
  { kind: "print", text: "", mark: "brief", hold: 1400 },
  { kind: "type", text: CODE, mark: "code", cps: 95, hold: 500 },
  { kind: "print", text: "", mark: "tests", hold: 1300 },
  { kind: "print", text: "", mark: "pr", hold: 1300 },
  { kind: "print", text: "", mark: "loaded" },
];
const SCRIPT = schedule(BEATS);

const STEPS = [
  { mark: "brief", label: "Brief" },
  { mark: "code", label: "Code" },
  { mark: "tests", label: "Tests" },
  { mark: "pr", label: "PR" },
  { mark: "loaded", label: "Live" },
];

const PLAYBOOK = ["dns-flush-cache", "dns-switch-resolver", "dhcp-renew", "wifi-reconnect", "router-reboot"];

const TOKEN = /("[^"]*"?|`[^`]*`?)|\b(const|export|async|await|return)\b|\b([A-Z][A-Za-z0-9]*)\b|([a-zA-Z_][\w]*)(?=\()|([{}()[\],:;=.])/g;
const TOKEN_CLASS = ["text-[#86efac]", "text-[#c4b5fd]", "text-[#67e8f9]", "text-[#93c5fd]", "text-white/35"];

/** Minimal TypeScript colouring; unterminated strings (mid-typing) still colour correctly. */
export function highlight(line: string): Array<{ text: string; cls: string }> {
  const out: Array<{ text: string; cls: string }> = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), cls: "text-white/80" });
    const group = m.slice(1).findIndex((g) => g !== undefined);
    out.push({ text: m[0], cls: TOKEN_CLASS[group] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), cls: "text-white/80" });
  return out;
}

export function DevinStage() {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = usePlayhead(ref, SCRIPT.total, 3400);
  const frames = frameAt(SCRIPT.beats, t);
  const code = frames.find((f) => f.beat.mark === "code");
  const typed = code?.text ?? "";
  const at = (mark: string) => t >= markAt(SCRIPT.beats, mark);
  const lines = typed.split("\n");
  const seconds = Math.floor(t / 1000) * 37; // sped up: a real session takes minutes

  return (
    <div ref={ref}>
      <Window
        title={
          <span className="flex items-center gap-2">
            <DevinMark className="h-3 w-3" color="#c4b5fd" /> devin — repair session
          </span>
        }
        glow="167 139 250"
        right={<span className="font-mono text-[12px] tabular text-white/55">{`${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`}</span>}
      >
        <div className="flex items-center border-b border-white/[0.05] px-4 py-3.5 sm:px-5">
          {STEPS.map((s, i) => {
            const done = i < STEPS.length - 1 ? at(STEPS[i + 1].mark) : at(s.mark);
            const current = at(s.mark) && !done;
            return (
              <Fragment key={s.mark}>
                {i > 0 && <div className={`mx-1.5 h-px flex-1 transition-colors duration-500 sm:mx-2.5 ${at(s.mark) ? "bg-violet/60" : "bg-white/10"}`} />}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`relative grid h-5 w-5 place-items-center rounded-full border transition-colors duration-500 ${
                      done ? "border-ok bg-ok/15 text-ok" : current ? "border-violet text-violet" : "border-white/15 text-white/20"
                    }`}
                  >
                    {current && <span className="halo absolute inset-0 rounded-full border border-violet" />}
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-1 w-1 rounded-full bg-current" />}
                  </span>
                  <span className={`hidden font-mono text-[10px] uppercase tracking-[0.12em] sm:inline ${at(s.mark) ? "text-white/70" : "text-white/25"}`}>
                    {s.label}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: at("brief") ? 1 : 0 }}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.05] bg-violet/[0.04] px-4 py-2.5 font-mono text-[10.5px] text-white/50 sm:px-5"
        >
          <span className="text-violet">brief from uplink</span>
          <span>IPV6_BLACKHOLE</span>
          <span className="text-white/25">·</span>
          <span>playbook exhausted</span>
          <span className="text-white/25">·</span>
          <span>ISP cleared</span>
          <span className="text-white/25">·</span>
          <span>14 probes attached</span>
        </motion.div>

        <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2 font-mono text-[11px] text-white/45 sm:px-5">
          <FileCode2 className="h-3.5 w-3.5 text-violet" />
          fixes/plugins/fix-ipv6-blackhole.ts
          <span className="ml-auto text-ok">+{lines.length > 1 ? lines.length : 0}</span>
        </div>

        <div className="h-[300px] overflow-hidden px-2 py-3 font-mono text-[10.5px] leading-[19px] sm:text-[11.5px]">
          {lines.map((line, i) => (
            <div key={i} className="flex whitespace-pre">
              <span className="w-8 shrink-0 select-none pr-3 text-right text-white/20">{i + 1}</span>
              <span>
                {highlight(line).map((tok, j) => (
                  <span key={j} className={tok.cls}>
                    {tok.text}
                  </span>
                ))}
                {code?.typing && i === lines.length - 1 && <span className="caret ml-px inline-block h-[13px] w-[6px] translate-y-[2px] bg-violet" />}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2.5 border-t border-white/[0.05] px-4 py-3.5 sm:px-5">
          <Row show={at("tests")}>
            <Check className="h-3.5 w-3.5 text-ok" strokeWidth={3} />
            <span className="text-white/70">fix-ipv6-blackhole.test.ts</span>
            <span className="text-ok">6 passed</span>
          </Row>
          <Row show={at("pr")}>
            <GitPullRequest className="h-3.5 w-3.5 text-ok" />
            <span className="truncate text-white/70">#128 Add repair plugin for IPV6_BLACKHOLE</span>
            <span className="ml-auto shrink-0 rounded-full bg-ok/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ok">Open</span>
          </Row>
        </div>

        <div className="border-t border-white/[0.05] px-4 py-3.5 sm:px-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">Local playbook</div>
          <div className="flex flex-wrap gap-1.5">
            {PLAYBOOK.map((p) => (
              <span key={p} className="rounded-md border border-white/[0.07] px-2 py-0.5 font-mono text-[10.5px] text-white/40">
                {p}
              </span>
            ))}
            <motion.span
              initial={false}
              animate={at("loaded") ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
              className="rounded-md border border-violet/50 bg-violet/15 px-2 py-0.5 font-mono text-[10.5px] text-violet shadow-[0_0_18px_rgb(167_139_250/0.45)]"
            >
              + fix-ipv6-blackhole
            </motion.span>
          </div>
        </div>
      </Window>
    </div>
  );
}

function Row({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: show ? 1 : 0, x: show ? 0 : -8 }}
      className="flex items-center gap-2.5 font-mono text-[11.5px]"
    >
      {children}
    </motion.div>
  );
}
