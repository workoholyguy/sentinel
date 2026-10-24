import { describe, expect, it } from "vitest";
import { callingIncident, healthySnapshot, ispOutageSnapshot } from "../../lib/mock";
import type { CallState } from "../../lib/types";
import {
  callElapsed,
  failingNode,
  formatDuration,
  formatPhone,
  formatSpan,
  formatUsd,
  historyStats,
  humanize,
  incidentTitle,
  linkLabel,
  probeFor,
  stepsFor,
} from "./format";

describe("format helpers", () => {
  it("formats durations as a clock", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(75_000)).toBe("01:15");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
    expect(formatDuration(-5)).toBe("00:00");
  });

  it("formats spans, dollars, phones and ids", () => {
    expect(formatSpan(42_000)).toBe("42s");
    expect(formatSpan(95_000)).toBe("1m 35s");
    expect(formatUsd(4.3)).toBe("$4.30");
    expect(formatPhone("+15555550100")).toBe("+1 (555) 555-0100");
    expect(formatPhone("+442071234567")).toBe("+442071234567");
    expect(humanize("router-reboot")).toBe("Router reboot");
  });

  it("labels links with latency, falling back to the probe detail", () => {
    expect(linkLabel(probeFor(healthySnapshot.probes, "router"))).toBe("3.0 ms");
    expect(linkLabel(probeFor(healthySnapshot.probes, "internet"))).toBe("24 ms");
    expect(linkLabel(probeFor(healthySnapshot.probes, "wifi"))).toBe("-54 dBm");
    expect(linkLabel(undefined)).toBe("—");
  });

  it("finds the first node that is down", () => {
    expect(failingNode(healthySnapshot.nodes)).toBe(-1);
    expect(failingNode(ispOutageSnapshot.nodes)).toBe(4); // isp
  });

  it("titles incidents from the diagnosis", () => {
    expect(incidentTitle(callingIncident)).toBe("Internet provider is dropping traffic");
    expect(incidentTitle({})).toBe("Investigating a network fault");
  });
});

describe("stepsFor", () => {
  it("uses the resolve path for local fixes", () => {
    const steps = stepsFor("fixing");
    expect(steps.map((s) => s.id)).toEqual(["detected", "diagnosing", "fixing", "resolved"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "todo"]);
  });

  it("switches to the escalation path once escalating", () => {
    const steps = stepsFor("calling");
    expect(steps.map((s) => s.id)).toEqual(["detected", "diagnosing", "fixing", "escalating", "calling", "informing", "ticketed"]);
    expect(steps.find((s) => s.state === "current")?.id).toBe("calling");
  });

  it("marks terminal steps done", () => {
    expect(stepsFor("resolved").every((s) => s.state === "done")).toBe(true);
    expect(stepsFor("ticketed").every((s) => s.state === "done")).toBe(true);
    const updating = stepsFor("informing");
    expect(updating.map((s) => s.id)).toContain("informing");
    expect(updating.find((s) => s.id === "calling")?.state).toBe("done");
    const human = stepsFor("needs_human");
    expect(human.map((s) => s.id)).toEqual(["detected", "diagnosing", "fixing", "needs_human"]);
    expect(human.every((s) => s.state === "done")).toBe(true);
  });
});

describe("callElapsed and history", () => {
  const call: CallState = {
    id: "c",
    status: "in-progress",
    to: "+15555550100",
    startedAt: "2026-01-01T00:00:00.000Z",
    transcript: [{ speaker: "rep", text: "hi", at: "2026-01-01T00:00:40.000Z" }],
  };

  it("ticks while live and freezes when ended", () => {
    const now = Date.parse("2026-01-01T00:01:10.000Z");
    expect(callElapsed(call, now)).toBe(70_000);
    expect(callElapsed({ ...call, status: "ended", endedAt: "2026-01-01T00:00:45.000Z" }, now)).toBe(45_000);
    expect(callElapsed({ ...call, status: "ended" }, now)).toBe(40_000);
  });

  it("summarises history", () => {
    const ticketed = { ...callingIncident, status: "ticketed" as const, call: { ...call, outcome: { summary: "", creditUsd: 4.3 } } };
    const fixed = { ...callingIncident, id: "b", status: "resolved" as const, call: undefined };
    expect(historyStats([ticketed, fixed])).toEqual({ handled: 2, autoFixed: 1, calls: 1, creditsUsd: 4.3 });
  });
});
