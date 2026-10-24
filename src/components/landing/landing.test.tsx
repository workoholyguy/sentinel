// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildDottedMap } from "../ui/dotted-map";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Landing } from "./Landing";
import { PROVIDERS } from "./Providers";

beforeAll(() => {
  // jsdom has no layout observers; the page must still render without them
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
});

afterEach(cleanup);

describe("Landing", () => {
  it("leads with the promise, then the five steps", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Internet down?Already handled.");
    for (const title of [/^Always watching\s*your network\.$/, /^Finds the problem\.\s*And who's responsible\.$/, /^Calls your ISP\.\s*So you don't have to\.$/, /^New fault\?\s*Devin writes the fix\.$/]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
    }
    expect(screen.getByText("Outage detected")).toBeTruthy(); // the hero map's incident card
  });

  it("recomputes downtime cost per period", () => {
    render(<Landing />);
    expect(screen.getByTestId("cost-Idle payroll").textContent).toBe("$49,500");
    fireEvent.click(screen.getByRole("radio", { name: "Per hour down" }));
    expect(screen.getByTestId("cost-Idle payroll").textContent).toBe("$1,375");
  });

  it("shows a real logo for every provider", () => {
    render(<Landing />);
    for (const p of PROVIDERS) {
      expect(existsSync(join(process.cwd(), "public/providers", p.logo))).toBe(true);
      expect(screen.getAllByText(p.name).length).toBeGreaterThan(0);
    }
  });

  it("links to the live dashboard", () => {
    render(<Landing />);
    const links = screen.getAllByRole("link", { name: /live dashboard/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((a) => a.getAttribute("href") === "/dashboard")).toBe(true);
  });
});

describe("buildDottedMap", () => {
  it("places pins inside the grid and draws every dot as one path", () => {
    const map = buildDottedMap({
      height: 30,
      region: { lat: { min: 22, max: 56 }, lng: { min: -128, max: -64 } },
      places: { sf: { lat: 37.77, lng: -122.42 }, ny: { lat: 40.71, lng: -74.0, label: "New York" } },
    });
    expect(map.height).toBe(30);
    expect(map.dots.startsWith("M")).toBe(true);
    expect(map.pins.sf.x).toBeLessThan(map.pins.ny.x); // west of New York
    expect(map.pins.ny).toMatchObject({ label: "New York" });
    for (const p of Object.values(map.pins)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(map.width);
    }
  });
});
