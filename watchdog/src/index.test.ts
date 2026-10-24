import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Watchdog } from "./index";

// An in-memory Durable Object: storage plus one alarm.
function house() {
  const data = new Map<string, unknown>();
  let alarm: number | null = null;
  const storage = {
    get: async (k: string) => structuredClone(data.get(k)),
    put: async (k: string, v: unknown) => void data.set(k, structuredClone(v)),
    delete: async (k: string) => data.delete(k),
    setAlarm: async (t: number) => void (alarm = t),
    getAlarm: async () => alarm,
    deleteAlarm: async () => void (alarm = null),
  };
  const dog = new Watchdog({ storage } as never, { VAPI_API_KEY: "k", WATCHDOG_TOKEN: "t" } as never);
  const beat = async (extra: Record<string, unknown> = {}) =>
    (await (await dog.fetch(new Request("https://w/beat", { method: "POST", body: JSON.stringify({ at: "", quietSeconds: 20, ...extra }) }))).json()) as {
      called: { id: string; debrief?: { id?: string; skipped?: boolean } } | null;
    };
  return { dog, data, beat, alarm: () => alarm };
}

const debriefWith = {
  incident: { id: "inc_1", startedAt: "2026-10-24T21:00:00.000Z", diagnosis: { summary: "nothing past the router answers" } },
  profile: { providerName: "Peachtree Fiber", customerName: "Hussain" },
  phoneNumberId: "pn_1",
  customerNumber: "+18455550394",
};
const armed = { callBody: { assistant: {} }, debrief: debriefWith };

// Vapi: POST /call places a call; GET /call/:id answers from `provider`. `hold` keeps the next POST open.
let provider: Record<string, unknown>;
let posted: { body: Record<string, unknown> }[];
let hold: Promise<void> | null;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T21:30:00.000Z"));
  provider = { id: "prov_1", status: "in-progress" };
  posted = [];
  hold = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (init.method === "POST") {
        posted.push({ body: JSON.parse(String(init.body)) });
        const id = posted.length === 1 ? "prov_1" : `deb_${posted.length - 1}`;
        if (hold) await hold;
        return Response.json({ id });
      }
      expect(url).toBe("https://api.vapi.ai/call/prov_1");
      return Response.json(provider);
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const later = (ms: number) => vi.setSystemTime(Date.now() + ms);
const ended = (structuredData: Record<string, unknown>) => {
  provider = { id: "prov_1", status: "ended", endedReason: "customer-ended-call", endedAt: new Date().toISOString(), analysis: { structuredData } };
};

describe("cloud watchdog: the customer hears back while the house is still dark", () => {
  it("calls the provider when the house goes dark, then phones the customer when that call ends with news", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm(); // dark: provider call
    expect(posted).toHaveLength(1);
    expect(h.alarm()).toBe(Date.now() + 5000); // now following it

    later(5000);
    await h.dog.alarm(); // still on the call
    expect(posted).toHaveLength(1);

    ended({ summary: "Line card replaced by 7 PM", ticketNumber: "PF-48213" });
    later(5000);
    await h.dog.alarm();
    expect(posted).toHaveLength(2);
    expect(posted[1].body).toMatchObject({ phoneNumberId: "pn_1", customer: { number: "+18455550394", name: "Hussain" }, metadata: { kind: "debrief" } });
    expect(JSON.stringify(posted[1].body)).toContain("PF-48213");
    expect((h.data.get("called") as { debrief: { id: string } }).debrief.id).toBe("deb_1");

    // Back online: the laptop hears about both calls, and keeps hearing for a minute after its ack.
    const first = await h.beat({ ...armed, ack: "prov_1" });
    expect(first.called).toMatchObject({ id: "prov_1", debrief: { id: "deb_1" } });
    expect(first.called).not.toHaveProperty("debriefWith");
    later(61_000);
    await h.beat({ ...armed, ack: "prov_1" });
    expect(h.data.has("called")).toBe(false);
  });

  it("waits for the call's outcome, and doesn't phone the customer when there's no news", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    ended({ summary: "" });
    later(5000);
    await h.dog.alarm(); // ended but no outcome yet: give the analysis time
    expect(posted).toHaveLength(1);
    expect((h.data.get("called") as { debrief?: unknown }).debrief).toBeUndefined();
    later(21_000);
    await h.dog.alarm();
    expect(posted).toHaveLength(1);
    expect((h.data.get("called") as { debrief: { skipped: boolean } }).debrief.skipped).toBe(true);
  });

  it("keeps a 5 s look at the call even while check-ins keep coming", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    const due = h.alarm()!;
    later(3000);
    await h.beat({ ...armed, ack: "prov_1" }); // the laptop is back and following too
    expect(h.alarm()).toBe(due);
    expect(h.data.has("called")).toBe(true); // still following: not forgotten on ack
  });

  it("never phones the customer about a call the laptop dismissed", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    const r = await h.beat({ ...armed, ack: "prov_1", dismiss: "prov_1" });
    expect(r.called?.debrief?.skipped).toBe(true);
    ended({ summary: "fixed", ticketNumber: "PF-1" });
    later(5000);
    await h.dog.alarm();
    expect(posted).toHaveLength(1);
  });

  it("claims the customer call before dialing: a dismiss mid-dial loses, and the reply says the cloud is dialing", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    ended({ summary: "fixed", ticketNumber: "PF-1" });
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    later(5000);
    const dialing = h.dog.alarm(); // claims, then waits on Vapi
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    const r = await h.beat({ ...armed, ack: "prov_1", dismiss: "prov_1" });
    expect(r.called?.debrief).toMatchObject({ pending: true });
    release();
    await dialing;
    expect((h.data.get("called") as { debrief: { id: string } }).debrief.id).toBe("deb_1");
  });

  it("never dials twice when the alarm runs again after the claim", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    const c = h.data.get("called") as Record<string, unknown>;
    h.data.set("called", { ...c, debrief: { at: Date.now(), ok: false, pending: true } }); // a crash right after the claim
    ended({ summary: "fixed", ticketNumber: "PF-1" });
    later(5000);
    await h.dog.alarm();
    expect(posted).toHaveLength(1);
  });

  it("doesn't dial the customer more than 2 minutes after the call: the laptop has it by then", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    ended({ summary: "fixed", ticketNumber: "PF-1" });
    later(130_000); // e.g. Vapi unreachable for two minutes
    await h.dog.alarm();
    expect(posted).toHaveLength(1);
    expect((h.data.get("called") as { debrief: { skipped: boolean } }).debrief.skipped).toBe(true);
  });

  it("phones the customer when the call was cut off after the rep gave a ticket", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    provider = { id: "prov_1", status: "ended", endedReason: "pipeline-error-openai", endedAt: new Date().toISOString(), analysis: { structuredData: { summary: "", ticketNumber: "PF-9" } } };
    later(5000);
    await h.dog.alarm();
    expect(posted).toHaveLength(2);
  });

  it("remembers the laptop picked the call up, so a restarted laptop doesn't take it over again", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    await h.beat({ ...armed, ack: "prov_1" });
    const r = await h.beat(armed); // a fresh laptop process: no ack
    expect(r.called).toHaveProperty("ackedAt");
  });

  it("calling switched off: cancels the customer update for a call it's following, and calls no one", async () => {
    const h = house();
    await h.beat(armed);
    later(21_000);
    await h.dog.alarm();
    await h.dog.fetch(new Request("https://w/disarm", { method: "POST", body: JSON.stringify({ all: true }) }));
    expect(h.alarm()).toBeNull();
    ended({ summary: "fixed", ticketNumber: "PF-1" });
    later(5000);
    await h.dog.alarm(); // even if an alarm still fired
    expect(posted).toHaveLength(1);
    expect((h.data.get("called") as { debrief: { error: string } }).debrief.error).toBe("calling switched off");
  });

  it("without a customer number, places the provider call only and forgets it on ack", async () => {
    const h = house();
    await h.beat({ callBody: { assistant: {} } });
    later(21_000);
    await h.dog.alarm();
    expect(posted).toHaveLength(1);
    await h.beat({ ack: "prov_1" });
    expect(h.data.has("called")).toBe(false);
  });
});
