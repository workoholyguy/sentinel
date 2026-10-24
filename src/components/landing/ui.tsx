import Link from "next/link";
import type { ReactNode } from "react";

export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative scroll-mt-20 ${className}`}>
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-8">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, dot = false, className = "" }: { children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400 ${className}`}>
      {dot && <span className="h-2 w-2 rounded-full bg-blue-500" />}
      {children}
    </div>
  );
}

type Tone = "dark" | "light";
const TONES: Record<Tone, string> = {
  dark: "bg-neutral-950 text-white hover:bg-neutral-800",
  light: "border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300",
};

export function Button({ href, tone = "dark", children, className = "" }: { href: string; tone?: Tone; children: ReactNode; className?: string }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14.5px] font-medium transition ${TONES[tone]} ${className}`;
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

/** White card used by every product visual. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-neutral-200/80 bg-white shadow-[0_24px_60px_-30px_rgb(0_0_0/0.18)] ${className}`}>{children}</div>;
}
