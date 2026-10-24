import { describe, expect, it } from "vitest";
import { CYCLE_MS, cycleAt, FAULTS, linkState } from "./linkCycle";

describe("cycleAt", () => {
  it("runs clean, breaks, then heals, and moves to the next fault each cycle", () => {
    expect(cycleAt(0)).toEqual({ k: 0, phase: "ok" });
    expect(cycleAt(3000)).toEqual({ k: 0, phase: "broken" });
    expect(cycleAt(5000)).toEqual({ k: 0, phase: "healed" });
    expect(cycleAt(CYCLE_MS + 10)).toEqual({ k: 1, phase: "ok" });
    expect(cycleAt(CYCLE_MS * FAULTS.length)).toEqual({ k: 0, phase: "ok" });
  });
});

describe("linkState", () => {
  const LINKS = 6;
  it("cuts everything past a broken link", () => {
    expect(linkState(0, 0, "broken", LINKS)).toBe("ok");
    expect(linkState(1, 0, "broken", LINKS)).toBe("broken");
    expect(linkState(2, 0, "broken", LINKS)).toBe("dead");
  });

  it("lights Devin's link only when Devin is the fix", () => {
    expect(linkState(5, 2, "broken", LINKS)).toBe("escalating");
    expect(linkState(5, 2, "healed", LINKS)).toBe("healed");
    expect(linkState(5, 1, "healed", LINKS)).toBe("ok");
  });
});
