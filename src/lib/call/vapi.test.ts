import { describe, expect, it, vi } from "vitest";
import { callingIncident } from "../mock";
import { demoProfile } from "../profile";
import { buildCallRequest, buildDebriefRequest, getCallState, mapOutcome, mapStatus, normalizeTicket, startProviderCall } from "./vapi";

function fakeFetch(body: unknown, status = 200) {
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(body), { status }));
}

const created = { id: "vapi_123", status: "queued", createdAt: "2026-10-24T13:00:00.000Z", customer: { number: demoProfile.supportNumber } };

describe("startProviderCall", () => {
  it("POSTs a transient assistant to /call with auth, phone number and customer", async () => {
    const fetchImpl = fakeFetch(created, 201);
    const state = await startProviderCall({ incident: callingIncident, profile: demoProfile, apiKey: "key_abc", phoneNumberId: "pn_1", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.vapi.ai/call");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer key_abc");

    const body = JSON.parse(String(init?.body));
    expect(body.phoneNumberId).toBe("pn_1");
    expect(body.customer.number).toBe(demoProfile.supportNumber);
    expect(body.assistant.firstMessageMode).toBe("assistant-waits-for-user"); // the rep says hello first
    expect(body.assistant.firstMessage).toBeUndefined();
    expect(body.assistant.model.messages[0].content).toMatch(/open with exactly this: "Hi, I'm an AI assistant/);
    expect(body.assistant.model.messages[0].role).toBe("system");
    expect(body.assistant.model.messages[0].content).toContain(demoProfile.accountNumber);
    expect(body.assistant.model.tools).toContainEqual({ type: "endCall" });
    expect(body.assistant.voice.provider).toBeTruthy();
    expect(Object.keys(body.assistant.analysisPlan.structuredDataSchema.properties)).toEqual(
      expect.arrayContaining(["ticketNumber", "creditUsd", "technicianWindow", "summary"]),
    );

    expect(state).toMatchObject({ id: "vapi_123", status: "queued", to: demoProfile.supportNumber, transcript: [] });
    expect(state.outcome).toBeUndefined();
  });

  it("throws with the Vapi error body on failure", async () => {
    const fetchImpl = fakeFetch({ message: "phoneNumberId invalid" }, 400);
    await expect(
      startProviderCall({ incident: callingIncident, profile: demoProfile, apiKey: "k", phoneNumberId: "bad", fetchImpl }),
    ).rejects.toThrow(/400.*phoneNumberId invalid/);
  });
});

describe("mapStatus", () => {
  it.each([
    ["scheduled", undefined, "queued"],
    ["queued", undefined, "queued"],
    ["ringing", undefined, "ringing"],
    ["in-progress", undefined, "in-progress"],
    ["forwarding", undefined, "in-progress"],
    ["ended", "assistant-ended-call", "ended"],
    ["ended", "customer-ended-call", "ended"],
    ["ended", "customer-did-not-answer", "failed"],
    ["ended", "pipeline-error-openai-llm-failed", "failed"],
  ] as const)("%s (%s) → %s", (status, reason, expected) => {
    expect(mapStatus(status, reason)).toBe(expected);
  });
});

describe("getCallState", () => {
  const ended = {
    id: "vapi_123",
    status: "ended",
    endedReason: "assistant-ended-call",
    startedAt: "2026-10-24T13:00:00.000Z",
    endedAt: "2026-10-24T13:04:00.000Z",
    customer: { number: "+15555550100" },
    messages: [
      { role: "system", message: "You are an AI assistant...", time: 1, secondsFromStart: 0 },
      { role: "bot", message: "Hi, I'm an AI assistant calling on behalf of Omar.", secondsFromStart: 1 },
      { role: "user", message: "Have you tried restarting your modem?", time: Date.parse("2026-10-24T13:00:10.000Z"), secondsFromStart: 10 },
      { role: "tool_calls", message: "" },
      { role: "bot", message: "Yes, at 12:58. Loss persisted.", secondsFromStart: 14 },
    ],
    analysis: {
      summary: "Provider opened a ticket.",
      structuredData: { ticketNumber: "PF-88213", creditUsd: 4.3, technicianWindow: "today 3–5 PM", summary: "Ticket, tech and credit." },
    },
  };

  it("GETs /call/{id} and maps transcript and outcome", async () => {
    const fetchImpl = fakeFetch(ended);
    const state = await getCallState("vapi_123", { apiKey: "key_abc", fetchImpl });

    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.vapi.ai/call/vapi_123");
    expect(state.status).toBe("ended");
    expect(state.endedAt).toBe(ended.endedAt);
    expect(state.transcript).toEqual([
      { at: "2026-10-24T13:00:01.000Z", speaker: "agent", text: "Hi, I'm an AI assistant calling on behalf of Omar." },
      { at: "2026-10-24T13:00:10.000Z", speaker: "rep", text: "Have you tried restarting your modem?" },
      { at: "2026-10-24T13:00:14.000Z", speaker: "agent", text: "Yes, at 12:58. Loss persisted." },
    ]);
    expect(state.outcome).toEqual({ ticketNumber: "PF-88213", creditUsd: 4.3, technicianWindow: "today 3–5 PM", summary: "Ticket, tech and credit." });
  });

  it("falls back to artifact.messages and analysis.summary, and parses '$4.30'", async () => {
    const { messages, ...rest } = ended;
    const fetchImpl = fakeFetch({
      ...rest,
      artifact: { messages },
      analysis: { summary: "Provider opened a ticket.", structuredData: { ticketNumber: "PF-1", creditUsd: "$4.30" } },
    });
    const state = await getCallState("vapi_123", { apiKey: "k", fetchImpl });
    expect(state.transcript).toHaveLength(3);
    expect(state.outcome).toEqual({ ticketNumber: "PF-1", creditUsd: 4.3, technicianWindow: undefined, summary: "Provider opened a ticket." });
  });

  it("has no outcome while the call is in progress", async () => {
    const fetchImpl = fakeFetch({ ...ended, status: "in-progress", endedAt: undefined });
    const state = await getCallState("vapi_123", { apiKey: "k", fetchImpl });
    expect(state.status).toBe("in-progress");
    expect(state.outcome).toBeUndefined();
  });

  it("reports why a call failed", async () => {
    const fetchImpl = fakeFetch({ ...ended, endedReason: "customer-busy", messages: [], analysis: undefined });
    const state = await getCallState("vapi_123", { apiKey: "k", fetchImpl });
    expect(state.status).toBe("failed");
    expect(state.outcome?.summary).toMatch(/customer-busy/);
  });
});


describe("normalizeTicket", () => {
  it("joins a ticket number the rep spelled out", () => {
    expect(normalizeTicket("a r 5 3 7 8 4 3 7")).toBe("AR5378437");
    expect(normalizeTicket("P F - 8 8 2 1 3")).toBe("PF88213");
  });
  it("keeps a ticket that was already written normally", () => {
    expect(normalizeTicket("PF-88213")).toBe("PF-88213");
    expect(normalizeTicket(undefined)).toBeUndefined();
  });
});

describe("customer update call", () => {
  const ended = {
    ...callingIncident,
    status: "calling" as const,
    call: {
      ...callingIncident.call!,
      status: "ended" as const,
      outcome: {
        summary: "Line card replaced tonight.",
        ticketNumber: "PF-48213",
        technicianWindow: "by 7 PM",
        creditUsd: 4.3,
        cause: "a failing line card at the neighborhood fiber node",
      },
    },
  };

  it("calls the customer with only the facts the provider gave", () => {
    const req = buildDebriefRequest(ended, demoProfile, "pn_1", "+18455550123");
    expect(req.customer.number).toBe("+18455550123");
    expect(req.assistant.firstMessageMode).toBe("assistant-waits-for-user");
    const prompt = req.assistant.model.messages[0].content;
    expect(prompt).toMatch(new RegExp(`open with exactly this: "Hi .*${demoProfile.providerName}`));
    expect(prompt).toContain("PF-48213");
    expect(prompt).toContain("a failing line card at the neighborhood fiber node");
    expect(prompt).toContain("doesn't need to do anything");
    expect(req.assistant.model.tools).toEqual([{ type: "endCall" }]);
  });

  it("tells the customer what to do when the cause is on the account", () => {
    const billing = { ...ended, call: { ...ended.call, outcome: { summary: "Restores on payment.", cause: "account suspended for an unpaid bill", customerAction: "pay the overdue $129 bill" } } };
    const prompt = buildDebriefRequest(billing, demoProfile, "pn_1", "+18455550123").assistant.model.messages[0].content;
    expect(prompt).toContain("pay the overdue $129 bill");
  });

  it("extracts the cause and the customer's action from the support call", () => {
    const o = mapOutcome({ id: "c", analysis: { structuredData: { summary: "s", cause: "unpaid bill", customerAction: "pay $129" } } } as never);
    expect(o?.cause).toBe("unpaid bill");
    expect(o?.customerAction).toBe("pay $129");
  });
});

describe("no dead air", () => {
  it("checks in after a quiet stretch on both calls", () => {
    const provider = buildCallRequest(callingIncident, demoProfile, "pn_1");
    expect(provider.assistant.messagePlan.idleTimeoutSeconds).toBe(10);
    const debrief = buildDebriefRequest(callingIncident, demoProfile, "pn_1", "+18455550123");
    expect(debrief.assistant.messagePlan.idleMessages.length).toBeGreaterThan(0);
  });
});
