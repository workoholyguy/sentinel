"use client";

import { useEffect } from "react";

export async function triggerDemo(path: string): Promise<void> {
  try {
    await fetch(path, { method: "POST" });
  } catch {
    // demo routes are optional; ignore failures and 404s
  }
}

// Demo triggers stay off screen: keys 1 / 2 / 0 here, or the Demo menu in the Mac app.
const KEYS: Record<string, string> = { "1": "/api/demo/isp-outage", "2": "/api/demo/unknown-fault", "0": "/api/demo/restore" };

export function DemoControls() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.("input, textarea")) return;
      const path = KEYS[e.key];
      if (path) void triggerDemo(path);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
