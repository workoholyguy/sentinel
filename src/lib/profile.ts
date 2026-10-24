import type { ProviderProfile } from "./types";

// Demo customer + provider. The provider is fictional; in the demo, Omar's phone
// plays its support line (SENTINEL_SUPPORT_NUMBER in .env.local).
export const demoProfile: ProviderProfile = {
  providerName: "Peachtree Fiber",
  // Read at call time, so a number added to .env.local applies without a restart.
  get supportNumber() {
    return process.env.SENTINEL_SUPPORT_NUMBER || "+15555550100";
  },
  get customerName() {
    return process.env.SENTINEL_CUSTOMER_NAME || "Omar Madjitov";
  },
  accountNumber: "4471-2290",
  serviceAddress: "817 West Peachtree Street Northwest, Suite 100, Atlanta, Georgia 30308",
  planName: "Business Fiber 500",
  monthlyPriceUsd: 129,
  get callbackNumber() {
    return process.env.SENTINEL_CALLBACK_NUMBER || "+15555550101";
  },
};
