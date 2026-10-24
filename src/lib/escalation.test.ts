import { describe, expect, it } from "vitest";
import { callDelaySeconds, DEFAULT_CALL_AFTER_SECONDS } from "./escalation";

describe("callDelaySeconds", () => {
  it("calls at once for a simulated (demo) outage", () => {
    expect(callDelaySeconds(true, { SENTINEL_CALL_AFTER_SECONDS: "600" })).toBe(0);
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
