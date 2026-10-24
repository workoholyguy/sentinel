"use client";

import { useState } from "react";
import { PhoneCall, PhoneOff } from "lucide-react";

/** The calling switch: on, Uplink really phones the provider and the customer; off, no phone rings. */
export function CallingButton({ on }: { on: boolean }) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch("/api/demo/calling", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: !on }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      data-testid="calling-button"
      data-on={on}
      title={on ? "Uplink places real calls. Click to stop all calling." : "No phone rings: calls are simulated. Click to turn real calls on."}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition disabled:opacity-50 ${
        on ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20" : "border-white/10 text-white/55 hover:border-ok/40 hover:text-white"
      }`}
    >
      {on ? <PhoneCall className="h-3.5 w-3.5" /> : <PhoneOff className="h-3.5 w-3.5" />}
      {busy ? "…" : on ? "Calling on" : "Calling off"}
    </button>
  );
}
