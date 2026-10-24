// Uplink's cloud watchdog — the one part of Uplink that isn't on the laptop.
// The laptop checks in every few seconds with a ready-to-place call. Each check-in pushes an alarm back.
// If check-ins stop (the house's internet is completely down), the alarm fires and this places the call
// to the provider through Vapi, with the last evidence the laptop sent. When the laptop is back, it learns
// about the call from its next check-in and follows it instead of calling again.

export interface Env {
  WATCHDOG: DurableObjectNamespace;
  VAPI_API_KEY: string;
  WATCHDOG_TOKEN: string;
}

interface Beat {
  at: string;
  quietSeconds: number;
  callBody?: unknown; // the exact Vapi /call request, prepared by the laptop
  ack?: string; // a cloud call id the laptop has picked up
}

interface Called {
  id: string;
  at: number;
  ok: boolean;
  error?: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.headers.get("authorization") !== `Bearer ${env.WATCHDOG_TOKEN}`) return new Response("unauthorized", { status: 401 });
    const house = env.WATCHDOG.get(env.WATCHDOG.idFromName("home"));
    return house.fetch(req);
  },
};

export class Watchdog {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const store = this.state.storage;

    if (req.method === "POST" && pathname === "/beat") {
      const beat = (await req.json()) as Beat;
      const quiet = Math.min(Math.max(beat.quietSeconds || 60, 10), 3600);
      await store.put("beat", { ...beat, receivedAt: Date.now() });
      await store.setAlarm(Date.now() + quiet * 1000); // re-armed by every check-in
      const called = await store.get<Called>("called");
      if (called && beat.ack === called.id) await store.delete("called");
      return Response.json({ ok: true, quietSeconds: quiet, called: called && beat.ack !== called.id ? called : null });
    }

    if (req.method === "POST" && pathname === "/disarm") {
      await store.deleteAlarm();
      return Response.json({ ok: true, armed: false });
    }

    if (pathname === "/status") {
      const beat = await store.get<Beat & { receivedAt: number }>("beat");
      return Response.json({
        lastBeatAt: beat?.receivedAt ?? null,
        hasCallReady: Boolean(beat?.callBody),
        alarmAt: await store.getAlarm(),
        called: (await store.get<Called>("called")) ?? null,
      });
    }

    return new Response("not found", { status: 404 });
  }

  // No check-in for `quietSeconds`: the house is dark. Call the provider.
  async alarm(): Promise<void> {
    const store = this.state.storage;
    const beat = await store.get<Beat>("beat");
    if (!beat?.callBody || (await store.get<Called>("called"))) return;
    try {
      const res = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { authorization: `Bearer ${this.env.VAPI_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(beat.callBody),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: unknown };
      await store.put("called", { id: body.id ?? "", at: Date.now(), ok: res.ok, error: res.ok ? undefined : JSON.stringify(body.message ?? body).slice(0, 300) });
    } catch (e) {
      await store.put("called", { id: "", at: Date.now(), ok: false, error: String(e) });
    }
  }
}
