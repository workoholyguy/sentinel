"use client";

import { useEffect, useRef, useState } from "react";
import type { StatusResponse } from "../../lib/types";

export interface Poll {
  data: StatusResponse | null;
  connected: boolean;
  /** Share of polls (since the dashboard opened) with no open incident. */
  uptimePct: number;
  /** When the network last became healthy (client ms), or null during an incident. */
  healthySince: number | null;
}

export function useStatusPoll(url = "/api/status", intervalMs = 1000): Poll {
  const [poll, setPoll] = useState<Poll>({ data: null, connected: true, uptimePct: 100, healthySince: null });
  const counts = useRef({ total: 0, healthy: 0, since: null as number | null });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let ctrl: AbortController | null = null;

    const tick = async () => {
      ctrl = new AbortController();
      try {
        const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as StatusResponse;
        if (!alive) return;
        const c = counts.current;
        const healthy = !data.incident;
        c.total += 1;
        if (healthy) c.healthy += 1;
        c.since = healthy ? (c.since ?? Date.now()) : null;
        setPoll({ data, connected: true, uptimePct: (c.healthy / c.total) * 100, healthySince: c.since });
      } catch {
        if (alive) setPoll((p) => ({ ...p, connected: false }));
      }
      if (alive) timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [url, intervalMs]);

  return poll;
}

export function useNow(everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
