import { describe, expect, it } from "vitest";
import { callDelaySeconds, confirmFault, CONFIRM_MS, DEFAULT_CALL_AFTER_SECONDS } from "./escalation";

describe("callDelaySeconds", () => {
  it("gives a simulated (demo) outage a short countdown of its own", () => {
    expect(callDelaySeconds(true, { SENTINEL_CALL_AFTER_SECONDS: "600" })).toBe(10);
    expect(callDelaySeconds(true, { SENTINEL_DEMO_CALL_AFTER_SECONDS: "0" })).toBe(0);
  });
  it("waits 3 minutes for a real outage by default", () => {
    expect(callDelaySeconds(false, {})).toBe(DEFAULT_CALL_AFTER_SECONDS);
    expect(DEFAULT_CALL_AFTER_SECONDS).toBe(180);
  });
  it("honours SENTINEL_CALL_AFTER_SECONDS and ignores junk", () => {
    expect(callDelaySeconds(false, { SENTINEL_CALL_AFTER_SECONDS: "60" })).toBe(60);
    expect(callDelaySeconds(false, { SENTINEL_CALL_AFTER_SECONDS: "0" })).toBe(0);
    expect(callDelaySeconds(false, { SENTINEL_CALL_AFTER_SECONDS: "soon" })).toBe(180);
  });
});

describe("confirmFault", () => {
  it("treats a single bad sample as a blip", () => {
    expect(confirmFault(undefined, "ISP_OUTAGE", 1000).confirmed).toBe(false);
  });
  it("confirms a fault that holds for the confirmation window", () => {
    const first = confirmFault(undefined, "ISP_OUTAGE", 1000);
    expect(confirmFault(first.suspect, "ISP_OUTAGE", 1000 + CONFIRM_MS).confirmed).toBe(true);
  });
  it("restarts the clock when the fault changes, and confirms demo faults at once", () => {
    const first = confirmFault(undefined, "ISP_OUTAGE", 1000);
    expect(confirmFault(first.suspect, "DNS_RESOLVER_DOWN", 1000 + CONFIRM_MS).confirmed).toBe(false);
    expect(confirmFault(undefined, "ISP_OUTAGE", 1000, true).confirmed).toBe(true);
  });
});
