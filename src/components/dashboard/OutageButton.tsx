"use client";

import { useState } from "react";
import { Unplug, Wifi } from "lucide-react";

/** Demo: cut the internet for real (router stays up, nothing past it answers), or bring it back. */
export function OutageButton({ active }: { active: boolean }) {
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/outage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: !active }) });
      const body = (await res.json().catch(() => ({}))) as { setup?: string; error?: string };
      setSetup(res.status === 403 ? (body.setup ?? null) : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        data-testid="outage-button"
        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition disabled:opacity-50 ${
          active ? "border-bad/40 bg-bad/15 text-bad hover:bg-bad/25" : "border-white/10 text-white/70 hover:border-bad/40 hover:text-white"
        }`}
      >
        {active ? <Wifi className="h-3.5 w-3.5" /> : <Unplug className="h-3.5 w-3.5" />}
        {busy ? "…" : active ? "End outage" : "Imitate outage"}
      </button>
      {setup && (
        <div className="absolute right-0 top-11 z-50 w-[420px] rounded-xl border border-white/10 bg-ink-900 p-4 text-[13px] text-white/70 shadow-xl">
          One-time permission needed (it lets Uplink switch the firewall without a password prompt). Run in Terminal:
          <code className="mt-2 block break-all rounded-lg bg-black/60 p-2 font-mono text-[11px] text-white/85">{setup}</code>
          <button type="button" onClick={() => setSetup(null)} className="mt-2 text-white/50 hover:text-white">Dismiss</button>
        </div>
      )}
    </div>
  );
}
