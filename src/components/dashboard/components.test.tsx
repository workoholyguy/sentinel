// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { callingIncident, healthySnapshot, ispOutageSnapshot } from "../../lib/mock";
import type { CallState } from "../../lib/types";
import { CallPanel } from "./CallPanel";
import { DiagnosisCard, FixesList, Stepper } from "./Incident";
import { NetworkMap } from "./NetworkMap";
import { HistoryList, Timeline } from "./Sidebar";

afterEach(cleanup);

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

describe("NetworkMap", () => {
  it("renders an all-green chain when healthy", () => {
    render(<NetworkMap snapshot={healthySnapshot} />);
    for (const id of ["device", "wifi", "router", "dns", "isp", "internet"]) {
      expect(screen.getByTestId(`node-${id}`).dataset.health).toBe("ok");
    }
    expect(document.querySelector("[data-failing]")).toBeNull();
    expect(screen.getByText("-54 dBm")).toBeTruthy();
  });

  it("flags the failing segment and greys out what lies beyond it", () => {
    render(<NetworkMap snapshot={ispOutageSnapshot} />);
    expect(screen.getByTestId("node-isp").dataset.health).toBe("down");
    expect(screen.getByText("2100 ms")).toBeTruthy(); // degraded DNS probe
    expect(screen.getByTestId("node-internet").dataset.health).toBe("unknown");
    expect(screen.getByTestId("link-isp").dataset.failing).toBe("true");
    expect(screen.getByTestId("link-dns").dataset.failing).toBeUndefined();
    expect(screen.getByText("38% loss")).toBeTruthy();
  });
});

describe("CallPanel", () => {
  const base: CallState = { id: "c", status: "ringing", to: "+15555550100", startedAt: new Date().toISOString(), transcript: [] };

  it("shows a ringing state with the provider and number", () => {
    render(<CallPanel call={base} provider="Peachtree Fiber" now={Date.now()} />);
    expect(screen.getByTestId("ringing")).toBeTruthy();
    expect(screen.getByText("Peachtree Fiber")).toBeTruthy();
    expect(screen.getByText("+1 (555) 555-0100")).toBeTruthy();
  });

  it("renders the live transcript as agent/rep bubbles", () => {
    render(<CallPanel call={callingIncident.call!} provider="Peachtree Fiber" now={Date.now()} />);
    expect(document.querySelectorAll('[data-speaker="agent"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-speaker="rep"]')).toHaveLength(2);
    expect(screen.queryByTestId("outcome")).toBeNull();
  });

  it("celebrates the outcome", () => {
    const ended: CallState = {
      ...callingIncident.call!,
      status: "ended",
      outcome: { ticketNumber: "PF-88213", technicianWindow: "Today 3–5 PM", creditUsd: 4.3, summary: "Ticket opened." },
    };
    render(<CallPanel call={ended} provider="Peachtree Fiber" now={Date.now()} />);
    expect(screen.getByTestId("outcome-ticket").textContent).toBe("PF-88213");
    expect(screen.getByTestId("outcome-credit").textContent).toBe("$4.30");
    expect(screen.getByText("Today 3–5 PM")).toBeTruthy();
  });
});

describe("Incident panel", () => {
  it("shows diagnosis, the on-device badge and fix results", () => {
    render(
      <>
        <DiagnosisCard diagnosis={callingIncident.diagnosis} />
        <FixesList status="escalating" fixes={[...callingIncident.fixes, { pluginId: "dns-switch", ok: true, actions: [] }]} />
      </>,
    );
    expect(screen.getByText(callingIncident.diagnosis!.summary)).toBeTruthy();
    expect(screen.getByText(/Explained on-device · no cloud/)).toBeTruthy();
    expect(screen.getByText("93%")).toBeTruthy();
    expect(screen.getByTestId("explanation")).toBeTruthy();
    expect(screen.getByLabelText("failed")).toBeTruthy();
    expect(screen.getByLabelText("succeeded")).toBeTruthy();
    expect(screen.getByText("Dns switch")).toBeTruthy();
  });

  it("waits for the local model when there is no explanation yet", () => {
    render(<DiagnosisCard diagnosis={{ ...callingIncident.diagnosis!, explanation: undefined }} />);
    expect(screen.queryByTestId("explanation")).toBeNull();
    expect(screen.getByText(/Local model is writing/)).toBeTruthy();
  });

  it("walks the escalation stepper", () => {
    render(<Stepper status="calling" escalated />);
    expect(document.querySelector('[data-step="calling"]')?.getAttribute("data-state")).toBe("current");
    expect(document.querySelector('[data-step="escalating"]')?.getAttribute("data-state")).toBe("done");
  });

  it("lists timeline events newest first and history", () => {
    render(
      <>
        <Timeline events={callingIncident.timeline} startedAt={callingIncident.startedAt} />
        <HistoryList items={[{ ...callingIncident, status: "ticketed" }]} now={Date.now()} />
      </>,
    );
    const items = screen.getByTestId("timeline").querySelectorAll("li");
    expect(items[0].textContent).toContain("Calling Peachtree Fiber support");
    expect(screen.getByTestId("history").textContent).toContain("Internet provider is dropping traffic");
  });
});
