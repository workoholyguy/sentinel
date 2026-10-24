// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { highlight } from "./highlight";
import { Landing } from "./Landing";
import { DEVIN_FIX, DevinFix } from "./stages/DevinFix";
import { ISP_CALL, IspCall } from "./stages/IspCall";
import { LOCAL_FIX, LocalFix } from "./stages/LocalFix";

beforeAll(() => {
  // jsdom has no layout observers or canvas; the page must still render without them
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(cleanup);

describe("Landing", () => {
  it("leads with the promise and the three-step demo", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Internet down?Already handled.");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["1. Fix it locally", "2. Call the ISP", "3. Devin writes a fix"]);
    expect(screen.getByText("Available on")).toBeTruthy();
    expect(screen.getByRole("img", { name: "UPLink" })).toBeTruthy(); // footer wordmark
  });

  it("switches the demo when a step is clicked", () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole("tab", { name: "2. Call the ISP" }));
    expect(screen.getByRole("tab", { name: "2. Call the ISP" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Peachtree Fiber")).toBeTruthy();
  });

  it("recomputes downtime cost per period", () => {
    render(<Landing />);
    expect(screen.getByTestId("cost-Idle payroll").textContent).toBe("$49,500");
    fireEvent.click(screen.getByRole("radio", { name: "Per hour down" }));
    expect(screen.getByTestId("cost-Idle payroll").textContent).toBe("$1,375");
  });

  it("links to the live dashboard", () => {
    render(<Landing />);
    const links = screen.getAllByRole("link", { name: /live dashboard/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((a) => a.getAttribute("href") === "/dashboard")).toBe(true);
  });
});

describe("demo stages", () => {
  it("end the local fix by escalating, the call by handing to Devin, and Devin by resolving", () => {
    render(<LocalFix t={LOCAL_FIX.total} />);
    expect(screen.getByText("→ calling your ISP with the evidence")).toBeTruthy();
    cleanup();
    render(<IspCall t={ISP_CALL.total} />);
    expect(screen.getByText("ISP cleared · ref PF-88214")).toBeTruthy();
    cleanup();
    render(<DevinFix t={DEVIN_FIX.total} />);
    expect(screen.getByText("All sites loading")).toBeTruthy();
  });
});

describe("highlight", () => {
  it("colours keywords, strings and types, and keeps every character", () => {
    const line = 'export const fixIpv6Blackhole: FixPlugin = { id: "fix-ipv6';
    const tokens = highlight(line);
    expect(tokens.map((t) => t.text).join("")).toBe(line);
    expect(tokens.find((t) => t.text === "export")?.cls).toBe("text-violet-600");
    expect(tokens.find((t) => t.text === "FixPlugin")?.cls).toBe("text-blue-600");
    expect(tokens.find((t) => t.text === '"fix-ipv6')?.cls).toBe("text-emerald-600"); // unterminated while typing
  });
});
