"use client";

import { useState } from "react";

const ACTIONS = [
  { label: "Simulate ISP outage", path: "/api/demo/isp-outage" },
  { label: "Unknown fault", path: "/api/demo/unknown-fault" },
  { label: "Restore", path: "/api/demo/restore" },
] as const;

export async function triggerDemo(path: string): Promise<void> {
  try {
    await fetch(path, { method: "POST" });
  } catch {
    // demo routes are optional; ignore failures and 404s
  }
}

export function DemoControls() {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="fixed left-1/2 top-8 z-50 flex -translate-x-1/2 gap-1.5 rounded-full border border-white/[0.06] bg-ink-900/80 p-1.5 opacity-30 backdrop-blur transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100">
      {ACTIONS.map((a) => (
        <button
          key={a.path}
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy(a.path);
            await triggerDemo(a.path);
            setBusy(null);
          }}
          className="rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
