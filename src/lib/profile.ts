import type { ProviderProfile } from "./types";

// Demo customer + provider. The provider is fictional; in the demo, Omar's phone
// plays its support line (SENTINEL_SUPPORT_NUMBER in .env.local).
export const demoProfile: ProviderProfile = {
  providerName: "Peachtree Fiber",
  supportNumber: process.env.SENTINEL_SUPPORT_NUMBER || "+15555550100",
  customerName: "Omar Madjitov",
  accountNumber: "4471-2290",
  serviceAddress: "817 W Peachtree St NW, Suite E-100, Atlanta, GA 30308",
  planName: "Business Fiber 500",
  monthlyPriceUsd: 129,
  callbackNumber: process.env.SENTINEL_CALLBACK_NUMBER || "+15555550101",
};
