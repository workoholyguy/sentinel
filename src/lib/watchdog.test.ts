import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./adapters", () => ({ pollProviderCall: vi.fn(async (id: string) => ({ id, status: "in-progress", startedAt: new Date().toISOString(), transcript: [] })) }));
vi.mock("./call", () => ({ isLiveCalling: () => true }));
vi.mock("./call/vapi", () => ({ buildCallRequest: () => ({ assistant: {} }) }));

import type { Incident } from "./types";
import { state } from "./store";
import { adoptCloudCall, cloudIsCalling, heartbeat } from "./watchdog";

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

  it("ignores a stale cloud call, and one Uplink already placed itself", async () => {
    const s = state();
    s.watchdog!.called = { id: "old", at: Date.now() - 11 * 60 * 1000, ok: true };
    expect(await adoptCloudCall()).toBe(false);
    expect(s.incident).toBeNull();
    s.incident = incident({ status: "calling", call: { id: "mine" } as Incident["call"] });
    s.watchdog!.called = { id: "dup", at: Date.now(), ok: true };
    expect(await adoptCloudCall()).toBe(false);
    expect(s.incident.call?.id).toBe("mine");
    expect(s.watchdog!.called).toBeNull();
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
    s.snapshot = { ...s.snapshot, nodes: { ...s.snapshot.nodes, internet: "ok" } }; // online but watchdog unreachable: call locally
    expect(await cloudIsCalling(inc)).toBe(false);
    vi.unstubAllGlobals();
  });
});
