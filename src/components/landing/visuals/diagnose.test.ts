import { describe, expect, it } from "vitest";
import { FOUND_AT, HOPS, hopState, segmentProgress } from "./DiagnoseCard";

describe("diagnosis trace", () => {
  it("checks each hop in turn and stops at the ISP", () => {
    expect(HOPS.map((_, i) => hopState(i, 0))).toEqual(["waiting", "waiting", "waiting", "waiting"]);
    expect(hopState(0, 500)).toBe("checking");
    expect(hopState(1, 1600)).toBe("ok");
    expect(HOPS.map((_, i) => hopState(i, FOUND_AT))).toEqual(["ok", "ok", "issue", "reachable"]);
  });

  it("only names a root cause once every hop has reported", () => {
    expect(FOUND_AT).toBeGreaterThanOrEqual(Math.max(...HOPS.map((h) => h.check[1])));
  });

  it("moves the probe along each link between checks", () => {
    expect(segmentProgress(0, 0)).toBe(0);
    expect(segmentProgress(0, 950)).toBeCloseTo(0.5);
    expect(segmentProgress(0, 5000)).toBe(1);
  });
});
