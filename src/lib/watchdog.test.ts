import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./adapters", () => ({ pollProviderCall: vi.fn(async (id: string) => ({ id, status: "in-progress", startedAt: new Date().toISOString(), transcript: [] })) }));
vi.mock("./call", () => ({ isLiveCalling: () => true, customerNumber: () => "+18455550394" }));
vi.mock("./call/vapi", () => ({ buildCallRequest: () => ({ assistant: {} }) }));

import type { Incident } from "./types";
import { state } from "./store";
import { adoptCloudCall, cloudDebriefFor, cloudIsCalling, heartbeat } from "./watchdog";

process.env.WATCHDOG_URL = "https://watchdog.test";
process.env.WATCHDOG_TOKEN = "t";
process.env.WATCHDOG_QUIET_SECONDS = "20";
process.env.VAPI_PHONE_NUMBER_ID = "p";

const incident = (over: Partial<Incident> = {}): Incident => ({
  id: "inc_1",
  startedAt: new Date().toISOString(),
  status: "resolved",
  simulated: false,
  fixes: [],
  timeline: [],
  diagnosis: { fault: "ISP_OUTAGE", blame: "isp", confidence: 0.9, summary: "down", evidence: [] },
  ...over,
});

beforeEach(() => {
  const s = state();
  s.busy = false;
  s.incident = null;
  s.providerCalledAt = undefined;
  s.watchdog = { enabled: true, quietSeconds: 20 };
});

describe("following a call the cloud placed while the house was dark", () => {
  it("takes over an incident that already finished, so the customer still gets the debrief", async () => {
    const s = state();
    s.incident = incident({ status: "ticketed" });
    s.watchdog!.called = { id: "call_1", at: Date.now() - 5000, ok: true };
    expect(await adoptCloudCall()).toBe(true);
    expect(s.incident!.status).toBe("calling");
    expect(s.incident!.call?.id).toBe("call_1");
    expect(s.watchdog!.acked).toBe("call_1");
  });

  it("opens an incident when the laptop never saw the outage (lid shut)", async () => {
    const s = state();
    s.watchdog!.called = { id: "call_2", at: Date.now() - 5000, ok: true };
    expect(await adoptCloudCall()).toBe(true);
    expect(s.incident?.status).toBe("calling");
    expect(s.incident?.diagnosis?.blame).toBe("isp");
  });

  it("ignores an old cloud call whose update went out, and one Uplink already placed itself", async () => {
    const s = state();
    s.watchdog!.called = { id: "old", at: Date.now() - 11 * 60 * 1000, ok: true, debrief: { id: "deb", at: Date.now(), ok: true } };
    expect(await adoptCloudCall()).toBe(false);
    expect(s.incident).toBeNull();
    expect(s.providerCalledAt).toBeGreaterThan(0); // still counts as "the provider was told"
    s.incident = incident({ status: "calling", call: { id: "mine" } as Incident["call"] });
    s.watchdog!.called = { id: "dup", at: Date.now(), ok: true };
    expect(await adoptCloudCall()).toBe(false);
    expect(s.incident.call?.id).toBe("mine");
    expect(s.watchdog!.called).toBeNull();
  });

  it("follows an old cloud call that still owes the customer an update — not one with no news", async () => {
    const s = state();
    s.watchdog!.called = { id: "old", at: Date.now() - 11 * 60 * 1000, ok: true, debrief: { at: Date.now(), ok: false, skipped: true } };
    expect(await adoptCloudCall()).toBe(false);
    s.watchdog!.called = { id: "owed", at: Date.now() - 11 * 60 * 1000, ok: true };
    expect(await adoptCloudCall()).toBe(true);
    expect(s.incident?.call?.id).toBe("owed");
  });

  it("files a finished incident with its own call away, instead of letting it block the new cloud call", async () => {
    const s = state();
    const done = incident({ status: "ticketed", call: { id: "earlier" } as Incident["call"] });
    s.incident = done;
    s.watchdog!.called = { id: "prov_1", at: Date.now() - 5000, ok: true };
    expect(await adoptCloudCall()).toBe(true);
    expect(s.incident).not.toBe(done);
    expect(s.incident?.call?.id).toBe("prov_1");
    expect(s.history[0]).toBe(done);
  });

  it("holds the local call while dark past the quiet window, instead of calling twice", async () => {
    const s = state();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ called: null }))));
    await heartbeat(true); // armed: the cloud holds a call
    s.watchdog!.lastOk = Date.now() - 30_000;
    s.snapshot = { ...s.snapshot, nodes: { ...s.snapshot.nodes, internet: "down" } };
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const inc = incident({ status: "escalating" });
    expect(await cloudIsCalling(inc)).toBe(true);
    expect(inc.timeline.at(-1)?.text).toMatch(/^Offline for \d+ s — the cloud watchdog is calling/);
    s.snapshot = { ...s.snapshot, nodes: { ...s.snapshot.nodes, internet: "ok" } };
    expect(await cloudIsCalling(inc)).toBe(true); // back online but the check-in failed: the cloud may have dialed, so hold
    s.watchdog!.lastOk = Date.now() - 90_000;
    expect(await cloudIsCalling(inc)).toBe(false); // the watchdog unreachable a minute past the window: call locally
    vi.unstubAllGlobals();
  });
});

describe("the cloud phones the customer for a call it placed", () => {
  const beats: Record<string, unknown>[] = [];
  const reply = (called: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => (beats.push(JSON.parse(String(init.body))), new Response(JSON.stringify({ called })))));
  const ended = (id: string, agoMs: number) => ({ id, status: "ended", to: "", startedAt: "", endedAt: new Date(Date.now() - agoMs).toISOString(), transcript: [] }) as Incident["call"];

  beforeEach(() => {
    beats.length = 0;
    vi.unstubAllGlobals();
  });

  it("hands the cloud what it needs to phone the customer", async () => {
    reply(null);
    await heartbeat(true);
    expect(beats.at(-1)?.debrief).toMatchObject({ customerNumber: "+18455550394", phoneNumberId: "p", profile: { providerName: "Peachtree Fiber" } });
  });

  it("follows the cloud's customer call instead of placing a second one", async () => {
    const s = state();
    s.watchdog!.called = { id: "prov_1", at: Date.now() - 5000, ok: true };
    await adoptCloudCall();
    expect(s.watchdog!.owned).toBe("prov_1");
    const inc = s.incident!;
    inc.call = ended("prov_1", 2000);
    expect(await cloudDebriefFor(inc)).toBe("wait"); // the cloud hasn't reported yet

    reply({ id: "prov_1", at: Date.now(), ok: true, debrief: { id: "deb_1", at: Date.now(), ok: true } });
    await heartbeat(true);
    expect(beats.at(-1)?.ack).toBe("prov_1");
    expect(await cloudDebriefFor(inc)).toMatchObject({ id: "deb_1" });
  });

  it("takes over only once the cloud confirms it stood down — never on silence alone", async () => {
    const s = state();
    s.watchdog!.owned = s.watchdog!.ownedCloud = s.watchdog!.acked = "prov_1";
    const inc = incident({ status: "calling", call: ended("prov_1", 60_000) });
    expect(await cloudDebriefFor(inc)).toBe("wait"); // 45 s of silence: ask the cloud to stand down…
    expect(s.watchdog!.dismissed).toBe("prov_1");
    reply({ id: "prov_1", at: Date.now(), ok: true, ackedAt: Date.now(), debrief: { at: Date.now(), ok: false, skipped: true } });
    await heartbeat(true);
    expect(beats.at(-1)).toMatchObject({ dismiss: "prov_1" });
    expect(await cloudDebriefFor(inc)).toBeNull(); // …it did: Uplink phones the customer
  });

  it("keeps waiting if the cloud is already dialing when asked to stand down", async () => {
    const s = state();
    s.watchdog!.owned = s.watchdog!.ownedCloud = s.watchdog!.acked = s.watchdog!.dismissed = "prov_1";
    const inc = incident({ status: "calling", call: ended("prov_1", 60_000) });
    reply({ id: "prov_1", at: Date.now(), ok: true, debrief: { at: Date.now(), ok: false, pending: true } });
    await heartbeat(true);
    expect(await cloudDebriefFor(inc)).toBe("wait");
  });

  it("phones the customer itself when the cloud skipped or has been silent too long to dial", async () => {
    const s = state();
    s.watchdog!.owned = "prov_1";
    const inc = incident({ status: "calling", call: ended("prov_1", 200_000) });
    expect(await cloudDebriefFor(inc)).toBeNull(); // past the cloud's 2-minute limit
    s.watchdog!.cloudDebrief = { at: Date.now(), ok: false, skipped: true };
    inc.call = ended("prov_1", 1000);
    expect(await cloudDebriefFor(inc)).toBeNull();
    expect(await cloudDebriefFor(incident({ call: ended("mine", 1000) }))).toBeNull(); // Uplink's own call
  });

  it("when Uplink got through itself but the cloud already phoned the customer, that call is the update", async () => {
    const s = state();
    s.incident = incident({ status: "calling", call: ended("mine", 1000) });
    s.watchdog!.called = { id: "prov_1", at: Date.now() - 60_000, ok: true, debrief: { id: "deb_1", at: Date.now(), ok: true } };
    expect(await adoptCloudCall()).toBe(false);
    expect(s.watchdog!.dismissed).toBeUndefined();
    expect(await cloudDebriefFor(s.incident)).toMatchObject({ id: "deb_1" });
  });

  it("follows the cloud's customer call when the stand-down came too late", async () => {
    const s = state();
    s.incident = incident({ status: "calling", call: ended("mine", 1000) });
    s.watchdog!.called = { id: "prov_1", at: Date.now() - 30_000, ok: true };
    await adoptCloudCall(); // own call: asks the cloud to stand down
    reply({ id: "prov_1", at: Date.now(), ok: true, debrief: { at: Date.now(), ok: false, pending: true } });
    await heartbeat(true);
    expect(await cloudDebriefFor(s.incident)).toBe("wait");
  });

  it("never takes over a cloud call that was already picked up (after a restart)", async () => {
    const s = state();
    reply({ id: "prov_1", at: Date.now(), ok: true, ackedAt: Date.now() - 1000 });
    await heartbeat(true);
    expect(s.watchdog!.called ?? null).toBeNull();
    expect(s.watchdog!.acked).toBe("prov_1");
  });

  it("tells the cloud not to phone the customer about a call Uplink didn't follow", async () => {
    const s = state();
    s.incident = incident({ status: "calling", call: { id: "mine" } as Incident["call"] });
    s.watchdog!.called = { id: "dup", at: Date.now(), ok: true };
    await adoptCloudCall();
    reply(null);
    await heartbeat(true);
    expect(beats.at(-1)).toMatchObject({ ack: "dup", dismiss: "dup" });
  });
});
