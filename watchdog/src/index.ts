// Uplink's cloud watchdog — the one part of Uplink that isn't on the laptop.
// The laptop checks in every few seconds with a ready-to-place call. Each check-in pushes an alarm back.
// If check-ins stop (the house's internet is completely down), the alarm fires and this places the call
// to the provider through Vapi, with the last evidence the laptop sent. It then follows that call, and when
// it ends with news it phones the customer with the update — the house may still be offline. When the
// laptop is back, it learns about both calls from its next check-in and follows them instead of calling again.
import type { Incident, ProviderProfile } from "../../src/lib/types";
import { buildDebriefRequest, hasNews, toCallState, type VapiCall } from "../../src/lib/call/vapi";

export interface Env {
  WATCHDOG: DurableObjectNamespace;
  VAPI_API_KEY: string;
  WATCHDOG_TOKEN: string;
}

interface DebriefWith {
  incident: Incident;
  profile: ProviderProfile;
  phoneNumberId: string;
  customerNumber: string;
}

interface Beat {
  at: string;
  quietSeconds: number;
  callBody?: unknown; // the exact Vapi /call request, prepared by the laptop
  debrief?: DebriefWith; // what's needed to phone the customer once that call ends
  ack?: string; // a cloud call id the laptop has picked up
  dismiss?: string; // a cloud call the laptop won't follow: don't phone the customer about it
}

interface Debrief {
  id?: string;
  at: number;
  ok: boolean;
  pending?: boolean; // claimed: the customer call is being dialed right now
  skipped?: boolean;
  error?: string;
}

interface Called {
  id: string;
  at: number;
  ok: boolean;
  error?: string;
  ackedAt?: number; // when the laptop picked it up: it is never taken over twice
  debrief?: Debrief;
  debriefWith?: DebriefWith;
}

const FOLLOW_MS = 5000; // how often to check on the provider call
const ANALYSIS_WAIT_MS = 20_000; // Vapi fills in the call's outcome shortly after it ends
const LATE_MS = 120_000; // never dial the customer later than this after the call: the laptop takes over at 3 min
const FOLLOW_LIMIT_MS = 30 * 60 * 1000;
const KEEP_MS = 60_000; // keep reporting the customer call for a minute, so the laptop can't miss it
const VERSION = "2026-10-24.5-calling-switch"; // shown on /status: tells when the object runs new code after a deploy

// Still on the provider call, with the customer to phone when it ends.
const following = (c?: Called | null): c is Called => Boolean(c?.ok && c.id && c.debriefWith && !c.debrief);
const publicView = ({ debriefWith: _, ...c }: Called) => c;

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
      let called = await store.get<Called>("called");
      // A dismiss only wins before the customer call is claimed; after that the reply says the cloud is dialing.
      if (called && beat.dismiss === called.id && !called.debrief) {
        called = { ...called, debrief: { at: Date.now(), ok: false, skipped: true, error: "Uplink handled this call itself" } };
        await store.put("called", called);
      }
      if (called && beat.ack === called.id && !called.ackedAt) {
        called = { ...called, ackedAt: Date.now() };
        await store.put("called", called);
      }
      const reply = called ? publicView(called) : null;
      // Picked up, and nothing left to report: forget it, so a later outage can be called in again.
      const settled = !called?.debrief || (!called.debrief.pending && Date.now() - called.debrief.at > KEEP_MS);
      if (called && beat.ack === called.id && !following(called) && settled) {
        await store.delete("called");
      }
      if (!following(called)) await store.setAlarm(Date.now() + quiet * 1000); // re-armed by every check-in
      else {
        // Following a call: keep the 5 s cadence — a check-in mustn't push the next look further out.
        const due = await store.getAlarm();
        if (!due || due > Date.now() + FOLLOW_MS) await store.setAlarm(Date.now() + FOLLOW_MS);
      }
      return Response.json({ ok: true, quietSeconds: quiet, called: reply });
    }

    if (req.method === "POST" && pathname === "/disarm") {
      // A clean stop: don't call anyone later. A call already under way still gets its customer update —
      // unless calling was switched off (`all`), when no phone may ring at all.
      const { all } = (await req.json().catch(() => ({}))) as { all?: boolean };
      const called = await store.get<Called>("called");
      if (all && following(called)) {
        await store.put("called", { ...called, debrief: { at: Date.now(), ok: false, skipped: true, error: "calling switched off" } });
      }
      if (all || !following(called)) await store.deleteAlarm();
      return Response.json({ ok: true, armed: false });
    }

    if (pathname === "/status") {
      const beat = await store.get<Beat & { receivedAt: number }>("beat");
      const called = await store.get<Called>("called");
      return Response.json({
        version: VERSION,
        lastBeatAt: beat?.receivedAt ?? null,
        hasCallReady: Boolean(beat?.callBody),
        canDebrief: Boolean(beat?.debrief),
        alarmAt: await store.getAlarm(),
        called: called ? { ...publicView(called), following: following(called) } : null,
      });
    }

    return new Response("not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const store = this.state.storage;
    const called = await store.get<Called>("called");
    if (following(called)) await this.follow(called);
    else if (!called) await this.callProvider(); // no check-in for `quietSeconds`: the house is dark
    if (following(await store.get<Called>("called"))) await store.setAlarm(Date.now() + FOLLOW_MS);
  }

  private vapi(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`https://api.vapi.ai${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.env.VAPI_API_KEY}`, "content-type": "application/json" },
    });
  }

  private async callProvider(): Promise<void> {
    const store = this.state.storage;
    const beat = await store.get<Beat>("beat");
    if (!beat?.callBody) return;
    try {
      const res = await this.vapi("/call", { method: "POST", body: JSON.stringify(beat.callBody) });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: unknown };
      await store.put("called", {
        id: body.id ?? "",
        at: Date.now(),
        ok: res.ok,
        error: res.ok ? undefined : JSON.stringify(body.message ?? body).slice(0, 300),
        debriefWith: beat.debrief,
      } satisfies Called);
    } catch (e) {
      await store.put("called", { id: "", at: Date.now(), ok: false, error: String(e) } satisfies Called);
    }
  }

  // The provider call is under way: once it ends with news, phone the customer — same rule as the laptop.
  private async follow(called: Called): Promise<void> {
    const store = this.state.storage;
    const settle = async (debrief: Debrief) => {
      const latest = await store.get<Called>("called");
      // Replaces only our own claim (or nothing); a customer call that went out is always recorded.
      if (latest?.id === called.id && (!latest.debrief || latest.debrief.pending || debrief.id)) await store.put("called", { ...latest, debrief });
    };
    if (Date.now() - called.at > FOLLOW_LIMIT_MS) return settle({ at: Date.now(), ok: false, error: "gave up following the call" });
    const res = await this.vapi(`/call/${encodeURIComponent(called.id)}`).catch(() => null);
    if (!res?.ok) return; // try again on the next alarm
    const call = toCallState((await res.json()) as VapiCall);
    if (call.status !== "ended" && call.status !== "failed") return;
    const news = hasNews(call.outcome); // a call cut off after the rep gave a ticket still has news
    const endedAt = Date.parse(call.endedAt ?? "") || called.at;
    if (!news && Date.now() - endedAt < ANALYSIS_WAIT_MS) return; // the outcome may still be coming
    if (!news) return settle({ at: Date.now(), ok: false, skipped: true, error: "no news from the provider" });
    if (Date.now() - endedAt > LATE_MS) return settle({ at: Date.now(), ok: false, skipped: true, error: "too late: Uplink phones the customer" });
    // Claim it before dialing: a dismiss that lands mid-dial loses, and an alarm retry can't dial twice.
    const latest = await store.get<Called>("called");
    if (!following(latest)) return; // the laptop dismissed it meanwhile
    await store.put("called", { ...latest, debrief: { at: Date.now(), ok: false, pending: true } });
    const w = called.debriefWith!;
    try {
      const sent = await this.vapi("/call", {
        method: "POST",
        body: JSON.stringify(buildDebriefRequest({ ...w.incident, call }, w.profile, w.phoneNumberId, w.customerNumber)),
      });
      const body = (await sent.json().catch(() => ({}))) as { id?: string; message?: unknown };
      await settle({ id: body.id, at: Date.now(), ok: sent.ok && Boolean(body.id), error: sent.ok ? undefined : JSON.stringify(body.message ?? body).slice(0, 300) });
    } catch (e) {
      await settle({ at: Date.now(), ok: false, error: String(e) });
    }
  }
}
