import { describe, expect, it } from "vitest";
import { state, term } from "./store";

describe("agent console", () => {
  it("keeps only the last 300 lines", () => {
    for (let i = 0; i < 320; i++) term("cmd", `$ line ${i}`);
    const lines = state().terminal;
    expect(lines).toHaveLength(300);
    expect(lines.at(-1)?.text).toBe("$ line 319");
  });
});
