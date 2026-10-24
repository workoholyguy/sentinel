import { motion } from "framer-motion";
import { Check, FileCode2, FlaskConical, GitPullRequest, Inbox, PenLine, Rocket, type LucideIcon } from "lucide-react";
import { DevinMark } from "../brand";
import { highlight } from "../highlight";
import { type Beat, frameAt, markAt, schedule } from "../script";

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
    ], "IPv6 off, sites back on IPv4");
  },
};`;

const BEATS: Beat[] = [
  { kind: "print", text: "", mark: "brief", hold: 1100 },
  { kind: "type", text: CODE, mark: "code", cps: 100, hold: 400 },
  { kind: "print", text: "", mark: "tests", hold: 1000 },
  { kind: "print", text: "", mark: "pr", hold: 1000 },
  { kind: "print", text: "", mark: "live", hold: 600 },
];
export const DEVIN_FIX = schedule(BEATS);

const STEPS: Array<{ mark: string; label: string; icon: LucideIcon }> = [
  { mark: "brief", label: "Brief from UPLink", icon: Inbox },
  { mark: "code", label: "Writing the plugin", icon: PenLine },
  { mark: "tests", label: "6 tests passed", icon: FlaskConical },
  { mark: "pr", label: "PR #128 opened", icon: GitPullRequest },
  { mark: "live", label: "Applied on site", icon: Rocket },
];

export function DevinFix({ t }: { t: number }) {
  const code = frameAt(DEVIN_FIX.beats, t).find((f) => f.beat.mark === "code");
  const lines = (code?.text ?? "").split("\n");
  const at = (mark: string) => t >= markAt(DEVIN_FIX.beats, mark);

  return (
    <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[1fr_230px]">
      <div className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 font-mono text-[11px] text-neutral-500">
          <FileCode2 className="h-3.5 w-3.5 text-violet-500" />
          plugins/fix-ipv6-blackhole.ts
          <span className="ml-auto text-emerald-600">+{lines.length > 1 ? lines.length : 0}</span>
        </div>
        <div className="flex-1 overflow-hidden px-2 py-3 font-mono text-[10.5px] leading-[19px] sm:text-[11.5px]">
          {lines.map((line, i) => (
            <div key={i} className="flex whitespace-pre">
              <span className="w-8 shrink-0 select-none pr-3 text-right text-neutral-300">{i + 1}</span>
              <span>
                {highlight(line).map((tok, j) => (
                  <span key={j} className={tok.cls}>
                    {tok.text}
                  </span>
                ))}
                {code?.typing && i === lines.length - 1 && <span className="caret ml-px inline-block h-[13px] w-[6px] translate-y-[2px] bg-violet-500" />}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-neutral-500">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-violet-600">
              <DevinMark className="h-3.5 w-3.5" color="#fff" />
            </span>
            Devin session
          </div>
          <ol className="space-y-2.5">
            {STEPS.map(({ mark, label, icon: Icon }, i) => {
              const done = i < STEPS.length - 1 ? at(STEPS[i + 1].mark) : at(mark);
              const current = at(mark) && !done;
              return (
                <li key={mark} className="flex items-center gap-2.5">
                  <span
                    className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-500 ${
                      done ? "bg-emerald-500 text-white" : current ? "bg-violet-100 text-violet-600" : "bg-neutral-100 text-neutral-300"
                    }`}
                  >
                    {current && <span className="halo absolute inset-0 rounded-full ring-2 ring-violet-300" />}
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Icon className="h-3 w-3" />}
                  </span>
                  <span className={`text-[13px] ${at(mark) ? "text-neutral-800" : "text-neutral-400"}`}>{label}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <motion.div
          initial={false}
          animate={at("live") ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="flex items-center gap-1.5 text-[14px] font-semibold text-emerald-700">
            <Check className="h-4 w-4" strokeWidth={3} /> All sites loading
          </div>
          <div className="mt-1 text-[12.5px] leading-snug text-emerald-800/70">Saved to the playbook. Next time it&apos;s fixed locally, in seconds.</div>
        </motion.div>
      </div>
    </div>
  );
}
