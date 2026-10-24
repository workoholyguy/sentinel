import { describe, expect, it } from "vitest";
import { callingIncident } from "../mock";
import { demoProfile } from "../profile";
import { createMockCall, MOCK_CALL_SECONDS } from "./mock";
import { customerNumber, getCall, isLiveCalling, startCall, startDebrief } from "./index";

const t0 = Date.parse("2026-10-24T13:00:00Z");
const at = (s: number) => t0 + s * 1000;

describe("createMockCall", () => {
  const call = createMockCall(callingIncident, demoProfile, t0);

  it("rings, then talks, then ends with the outcome", () => {
    expect(call.state(at(1))).toMatchObject({ status: "ringing", transcript: [], to: demoProfile.supportNumber });
    expect(call.state(at(20)).status).toBe("in-progress");
    expect(call.state(at(20)).outcome).toBeUndefined();
    const done = call.state(at(MOCK_CALL_SECONDS));
    expect(done.status).toBe("ended");
    expect(done.endedAt).toBe(new Date(at(MOCK_CALL_SECONDS)).toISOString());
    expect(done.outcome).toMatchObject({ ticketNumber: "PF-88213", technicianWindow: "today 3–5 PM", creditUsd: 4.3 });
  });

  it("scripts the restart push-back with evidence", () => {
    const turns = call.state(at(MOCK_CALL_SECONDS)).transcript;
    expect(turns[0].speaker).toBe("rep");
    expect(turns[1]).toMatchObject({ speaker: "agent" });
    expect(turns[1].text).toMatch(/AI assistant/);
    const restart = turns.findIndex((t) => t.speaker === "rep" && /restart/i.test(t.text));
    expect(restart).toBeGreaterThan(0);
    expect(turns[restart + 1].speaker).toBe("agent");
    expect(turns[restart + 1].text).toContain("Router rebooted at 12:58");
    expect(turns.some((t) => t.text.includes(demoProfile.callbackNumber))).toBe(true);
  });

  it("only reveals turns that have been spoken", () => {
    const ats = call.state(at(20)).transcript.map((t) => Date.parse(t.at));
    expect(ats.every((x) => x <= at(20))).toBe(true);
  });
});

describe("facade", () => {
  it("uses the mock without Vapi credentials", async () => {
    expect(isLiveCalling({})).toBe(false);
    expect(isLiveCalling({ VAPI_API_KEY: "k" })).toBe(false);
    expect(isLiveCalling({ VAPI_API_KEY: "k", VAPI_PHONE_NUMBER_ID: "p" })).toBe(false); // nobody to ring yet
    expect(isLiveCalling({ VAPI_API_KEY: "k", VAPI_PHONE_NUMBER_ID: "p", SENTINEL_SUPPORT_NUMBER: "" })).toBe(false);
    expect(isLiveCalling({ VAPI_API_KEY: "k", VAPI_PHONE_NUMBER_ID: "p", SENTINEL_SUPPORT_NUMBER: "+14045550123" })).toBe(true);
    const started = await startCall(callingIncident, demoProfile, {});
    expect(started.id).toMatch(/^mock_call_/);
    expect(started.status).toBe("ringing");
    expect((await getCall(started.id, {})).id).toBe(started.id);
  });

  it("rejects unknown ids when Vapi is not configured", async () => {
    await expect(getCall("nope", {})).rejects.toThrow(/Unknown call/);
  });
});

describe("customer update setup", () => {
  it("only calls the customer with live calling and a real number", async () => {
    expect(customerNumber({ SENTINEL_CUSTOMER_NUMBER: "+18455550123" })).toBe("+18455550123");
    expect(customerNumber({ SENTINEL_CUSTOMER_NUMBER: "845 555 0123" })).toBeNull();
    expect(await startDebrief(callingIncident, demoProfile, {})).toBeNull();
    expect(await startDebrief(callingIncident, demoProfile, { VAPI_API_KEY: "k", VAPI_PHONE_NUMBER_ID: "p", SENTINEL_SUPPORT_NUMBER: "+14045550123" })).toBeNull();
  });
});
