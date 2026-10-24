export type Period = "hour" | "month" | "year";

export interface RoiInput {
  /** people who stop working when the internet drops */
  people: number;
  /** loaded cost of one person-hour, USD */
  hourlyCost: number;
  /** hours offline in a typical month */
  outageHours: number;
}

/** Idle payroll and work hours lost to outages, per hour offline, per month or per year. */
export function downtimeCost({ people, hourlyCost, outageHours }: RoiInput, period: Period): { payroll: number; hours: number } {
  const hoursDown = period === "hour" ? 1 : period === "month" ? Math.max(0, outageHours) : Math.max(0, outageHours) * 12;
  const hours = Math.max(0, people) * hoursDown;
  return { payroll: hours * Math.max(0, hourlyCost), hours };
}

export function formatMoney(usd: number): string {
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
