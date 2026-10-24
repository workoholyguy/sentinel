import { describe, expect, it } from "vitest";
import { frameAt, markAt, schedule } from "./script";

const { beats, total } = schedule([
  { kind: "type", text: "uplink watch", cps: 10, hold: 100 },
  { kind: "print", text: "✗ dns timed out", mark: "down", lead: 500, hold: 0 },
]);

describe("schedule", () => {
  it("lays beats end to end, typing at the given speed", () => {
    expect(beats[0]).toMatchObject({ start: 0, show: 0, end: 1200 });
    expect(beats[1]).toMatchObject({ start: 1300, show: 1800, end: 1800 });
    expect(total).toBe(1800);
  });
});

describe("frameAt", () => {
  it("reveals typed text character by character", () => {
    const [f] = frameAt(beats, 450);
    expect(f.text).toBe("upli");
    expect(f.typing).toBe(true);
  });

  it("shows a pending beat during its lead, then the whole line", () => {
    expect(frameAt(beats, 1000)).toHaveLength(1);
    const pending = frameAt(beats, 1500)[1];
    expect(pending).toMatchObject({ pending: true, text: "" });
    const shown = frameAt(beats, 1800)[1];
    expect(shown).toMatchObject({ pending: false, typing: false, text: "✗ dns timed out" });
  });

  it("finds named moments", () => {
    expect(markAt(beats, "down")).toBe(1800);
    expect(markAt(beats, "nope")).toBe(Infinity);
  });
});
