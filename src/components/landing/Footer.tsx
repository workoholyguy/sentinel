"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DevinMark, Wordmark } from "./brand";
import { WordmarkCanvas } from "./WordmarkCanvas";

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "On-device", href: "#offline" },
      { label: "For teams", href: "#teams" },
      { label: "Live dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Platforms",
    links: [
      { label: "Apple", href: "#demo" },
      { label: "Windows", href: "#demo" },
      { label: "Web", href: "#demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Book a demo", href: "#demo" },
      { label: "The problem", href: "#problem" },
    ],
  },
];

function LiveStatus() {
  const [ms, setMs] = useState(18);
  useEffect(() => {
    const id = setInterval(() => setMs(15 + Math.round(Math.random() * 6)), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 font-mono text-[11px] text-white/55">
      <span className="relative grid h-2 w-2 place-items-center">
        <span className="halo absolute inset-0 rounded-full bg-ok/60" />
        <span className="h-2 w-2 rounded-full bg-ok" />
      </span>
      All systems normal · <span className="tabular text-white/80">{ms} ms</span>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t hairline">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(50%_60%_at_50%_100%,rgb(91_140_255/0.14),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-[1240px] grid-cols-3 gap-x-6 gap-y-12 px-4 pt-20 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-14">
        <div className="col-span-3 lg:col-span-1">
          <Wordmark />
          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/45">
            Your network&apos;s advocate. It diagnoses on-device, fixes what it can, and calls your provider when it can&apos;t.
          </p>
          <div className="mt-6">
            <LiveStatus />
          </div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="font-mono text-[11px] uppercase tracking-label text-white/35">{col.title}</div>
            <ul className="mt-5 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("/") ? (
                    <Link href={l.href} className="text-[15px] text-white/60 transition hover:text-white">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className="text-[15px] text-white/60 transition hover:text-white">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="relative mx-auto mt-16 max-w-[1400px] px-2 sm:px-6">
        <WordmarkCanvas />
      </div>

      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-3 border-t hairline px-4 py-6 text-[13px] text-white/35 sm:flex-row sm:px-8 lg:px-14">
        <span>© 2026 UPLink. Built at the Devin Hackathon, Atlanta.</span>
        <span className="inline-flex items-center gap-2">
          Repairs powered by <DevinMark className="h-3.5 w-3.5" color="#c4b5fd" /> Devin
        </span>
      </div>
    </footer>
  );
}
