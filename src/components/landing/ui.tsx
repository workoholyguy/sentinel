import Link from "next/link";
import type { ReactNode } from "react";

/** A page band with the thin double rails that frame the content (as on the reference sites). */
export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative scroll-mt-20 border-t border-neutral-200/80 ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[1264px] -translate-x-1/2 border-x border-neutral-200/80 lg:block" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[1200px] -translate-x-1/2 border-x border-neutral-200/80 lg:block" />
      <div className="relative mx-auto w-full max-w-[1200px] px-5 sm:px-10 lg:px-16">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[12px] uppercase tracking-[0.14em] text-neutral-500 ${className}`}>{children}</div>;
}

export function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-[clamp(34px,5vw,58px)] font-semibold leading-[1.04] tracking-[-0.045em] text-neutral-950">{children}</h2>
      {sub && <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-neutral-500">{sub}</p>}
    </div>
  );
}

type ButtonTone = "dark" | "light" | "outline" | "navy";
const TONES: Record<ButtonTone, string> = {
  dark: "bg-neutral-950 text-white hover:bg-neutral-800",
  light: "bg-white text-neutral-950 shadow-[0_8px_30px_-8px_rgb(30_27_75/0.45)] hover:bg-indigo-50",
  outline: "border border-neutral-200 bg-white text-neutral-950 hover:border-neutral-300",
  navy: "bg-[#1b1a4b] text-white hover:bg-[#24225e]",
};

export function Button({ href, tone = "dark", children, className = "" }: { href: string; tone?: ButtonTone; children: ReactNode; className?: string }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-medium transition ${TONES[tone]} ${className}`;
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}
