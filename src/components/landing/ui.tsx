import type { ReactNode } from "react";
import type { Tone } from "./script";

export const TONE_TEXT: Record<Tone, string> = {
  plain: "text-white/85",
  muted: "text-white/40",
  ok: "text-ok",
  bad: "text-bad",
  warn: "text-warn",
  accent: "text-accent",
  violet: "text-violet",
};

export function Eyebrow({ children, color = "#38e1ff" }: { children: ReactNode; color?: string }) {
  return (
    <div className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-label text-white/50">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
      {children}
    </div>
  );
}

/** Section frame with the faint vertical rails and corner ticks that run down the page. */
export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative scroll-mt-24 ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[1240px] -translate-x-1/2 border-x hairline lg:block" />
      <Ticks />
      <div className="relative mx-auto w-full max-w-[1240px] px-4 sm:px-8 lg:px-14">{children}</div>
    </section>
  );
}

function Ticks() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 hidden w-full max-w-[1240px] -translate-x-1/2 lg:block">
      <span className="absolute -left-[5px] -top-[5px] h-[9px] w-[9px] text-white/25">
        <Plus />
      </span>
      <span className="absolute -right-[5px] -top-[5px] h-[9px] w-[9px] text-white/25">
        <Plus />
      </span>
      <div className="absolute inset-x-0 top-0 border-t hairline" />
    </div>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 9 9" className="h-full w-full" aria-hidden="true">
      <path d="M4.5 0v9M0 4.5h9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function SectionHeading({
  eyebrow,
  color,
  title,
  dim,
  children,
  center = false,
}: {
  eyebrow: string;
  color?: string;
  title: ReactNode;
  dim?: ReactNode;
  children?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Eyebrow color={color}>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-[clamp(34px,5.2vw,64px)] font-semibold leading-[1.02] tracking-[-0.045em] text-white">
        {title}
        {dim && (
          <>
            <br />
            <span className="text-white/40">{dim}</span>
          </>
        )}
      </h2>
      {children && <p className={`mt-6 text-[17px] leading-relaxed text-white/55 sm:text-lg ${center ? "mx-auto max-w-xl" : "max-w-xl"}`}>{children}</p>}
    </div>
  );
}

/** App window chrome used by the demo stages. */
export function Window({
  title,
  right,
  children,
  className = "",
  glow = "56 225 255",
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[48px] opacity-60 blur-3xl"
        style={{ background: `radial-gradient(60% 60% at 50% 40%, rgb(${glow} / 0.18), transparent 70%)` }}
      />
      <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#070a11]/95 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/45">{title}</div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-white/60 ${className}`}>
      {children}
    </span>
  );
}
