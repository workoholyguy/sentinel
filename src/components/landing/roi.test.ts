import { describe, expect, it } from "vitest";
import { downtimeCost, formatMoney } from "./roi";

const team = { people: 25, hourlyCost: 55, outageHours: 3 };

describe("downtimeCost", () => {
  it("costs one hour offline", () => {
    expect(downtimeCost(team, "hour")).toEqual({ payroll: 1375, hours: 25 });
  });

  it("scales by hours down a month, and by twelve for a year", () => {
    expect(downtimeCost(team, "month")).toEqual({ payroll: 4125, hours: 75 });
    expect(downtimeCost(team, "year")).toEqual({ payroll: 49500, hours: 900 });
  });

  it("never goes negative", () => {
    expect(downtimeCost({ ...team, people: -3 }, "year").payroll).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats whole dollars with separators", () => {
    expect(formatMoney(49500)).toBe("$49,500");
  });
});
