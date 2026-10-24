export interface RoiInput {
  /** people who stop working when the internet drops */
  people: number;
  /** loaded cost of one person-hour, USD */
  hourlyCost: number;
  /** hours offline in a typical month */
  outageHours: number;
}

/** What outages cost in idle time: people × hourly cost × hours down. */
export function downtimeCost({ people, hourlyCost, outageHours }: RoiInput): { monthly: number; yearly: number } {
  const monthly = Math.max(0, people) * Math.max(0, hourlyCost) * Math.max(0, outageHours);
  return { monthly, yearly: monthly * 12 };
}

export function formatMoney(usd: number): string {
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
