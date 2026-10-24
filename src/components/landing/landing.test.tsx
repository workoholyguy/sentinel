// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Landing } from "./Landing";
import { highlight } from "./stages/DevinStage";

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
  it("tells the story: problem, three escalation levels, platforms", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("The internet breaks.UPLink fixes it.");
    for (const title of ["Fixes it on the spot.", "Calls your ISP.", "Devin writes the fix."]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeTruthy();
    }
    expect(screen.getByText("Available on Apple, Windows and the web")).toBeTruthy();
    expect(screen.getByRole("img", { name: "UPLink" })).toBeTruthy(); // footer wordmark
  });

  it("links to the live dashboard", () => {
    render(<Landing />);
    const links = screen.getAllByRole("link", { name: /live dashboard/i });
    expect(links.every((a) => a.getAttribute("href") === "/dashboard")).toBe(true);
  });
});

describe("highlight", () => {
  it("colours keywords, strings and types, and keeps every character", () => {
    const line = 'export const fixIpv6Blackhole: FixPlugin = { id: "fix-ipv6';
    const tokens = highlight(line);
    expect(tokens.map((t) => t.text).join("")).toBe(line);
    expect(tokens.find((t) => t.text === "export")?.cls).toContain("c4b5fd");
    expect(tokens.find((t) => t.text === "FixPlugin")?.cls).toContain("67e8f9");
    expect(tokens.find((t) => t.text === '"fix-ipv6')?.cls).toContain("86efac"); // unterminated while typing
  });
});
