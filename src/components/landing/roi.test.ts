import { describe, expect, it } from "vitest";
import { downtimeCost, formatMoney } from "./roi";

describe("downtimeCost", () => {
  it("multiplies people, hourly cost and hours down", () => {
    expect(downtimeCost({ people: 25, hourlyCost: 55, outageHours: 3 })).toEqual({ monthly: 4125, yearly: 49500 });
  });

  it("never goes negative", () => {
    expect(downtimeCost({ people: -3, hourlyCost: 55, outageHours: 3 }).monthly).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats whole dollars with separators", () => {
    expect(formatMoney(49500)).toBe("$49,500");
  });
});
