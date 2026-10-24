import { describe, expect, it } from "vitest";
import { callingIncident } from "../mock";
import { demoProfile } from "../profile";
import type { Incident } from "../types";
import { buildAgentPrompt, computeCredit } from "./prompt";

const start = new Date("2026-10-24T12:56:00Z");
const incident: Incident = { ...callingIncident, startedAt: start.toISOString() };
const at = (hours: number) => new Date(start.getTime() + hours * 3_600_000);

describe("buildAgentPrompt", () => {
  const { systemPrompt, firstMessage } = buildAgentPrompt(incident, demoProfile, at(0.5));

  it("discloses it is an AI in the first sentence", () => {
    const firstSentence = firstMessage.split(/(?<=[.!?])\s/)[0];
    expect(firstSentence).toMatch(/\bAI\b/);
    expect(firstSentence).toContain(demoProfile.customerName);
    expect(systemPrompt).toMatch(/never pretend to be human/i);
  });

  it("includes the account details for verification", () => {
    expect(firstMessage).toContain(demoProfile.accountNumber);
    expect(systemPrompt).toContain(demoProfile.accountNumber);
    expect(systemPrompt).toContain(demoProfile.serviceAddress);
    expect(systemPrompt).toContain(demoProfile.callbackNumber);
  });

  it("includes every piece of diagnosis evidence and what was already tried", () => {
    for (const e of incident.diagnosis!.evidence) expect(systemPrompt).toContain(e);
    expect(systemPrompt).toContain("Rebooted router");
    expect(systemPrompt).toMatch(/do NOT agree to redo/);
    expect(systemPrompt).toMatch(/restarted your modem/);
  });

  it("asks for at least one day of credit when the outage is under a day", () => {
    expect(systemPrompt).toContain("$4.30");
    expect(systemPrompt).toMatch(/one full day/);
  });

  it("lists the goals and ends with the endCall tool", () => {
    expect(systemPrompt).toMatch(/ticket number/i);
    expect(systemPrompt).toMatch(/technician window/i);
    expect(systemPrompt).toMatch(/endCall/);
  });
});

describe("computeCredit", () => {
  it("prorates monthly price per day with a one-day minimum", () => {
    const c = computeCredit(incident, demoProfile, at(2));
    expect(c.dailyRateUsd).toBe(4.3);
    expect(c.proratedUsd).toBeCloseTo(0.36, 2);
    expect(c.requestUsd).toBe(4.3);
  });

  it("asks for the prorated amount beyond a day", () => {
    const c = computeCredit(incident, demoProfile, at(36));
    expect(c.outageHours).toBe(36);
    expect(c.requestUsd).toBe(6.45);
  });
});
