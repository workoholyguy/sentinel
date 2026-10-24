// Facade: real Vapi call when configured, otherwise the scripted mock.
import type { CallState, Incident, ProviderProfile } from "../types";
import { createMockCall, type MockCall } from "./mock";
import { getCallState, startDebriefCall, startProviderCall } from "./vapi";

type Env = Record<string, string | undefined>;

const mockCalls = new Map<string, MockCall>();

// Live calls need Vapi AND a real number to ring; without one, keep the scripted mock.
function vapiConfig(env: Env) {
  const apiKey = env.VAPI_API_KEY?.trim();
  const phoneNumberId = env.VAPI_PHONE_NUMBER_ID?.trim();
  const target = env.SENTINEL_SUPPORT_NUMBER?.trim() ?? "";
  return apiKey && phoneNumberId && /^\+\d{8,15}$/.test(target) ? { apiKey, phoneNumberId } : null;
}

export function isLiveCalling(env: Env = process.env): boolean {
  return vapiConfig(env) !== null;
}

export async function startCall(incident: Incident, profile: ProviderProfile, env: Env = process.env): Promise<CallState> {
  const cfg = vapiConfig(env);
  if (cfg) return startProviderCall({ incident, profile, ...cfg });
  const call = createMockCall(incident, profile);
  mockCalls.set(call.id, call);
  return call.state();
}

/** The customer's phone for the follow-up call, when one is set (E.164). */
export function customerNumber(env: Env = process.env): string | null {
  const n = env.SENTINEL_CUSTOMER_NUMBER?.trim() ?? "";
  return /^\+\d{8,15}$/.test(n) ? n : null;
}

/** Phone the customer with what the provider said. Null when there's no live calling or no customer number. */
export async function startDebrief(incident: Incident, profile: ProviderProfile, env: Env = process.env): Promise<CallState | null> {
  const cfg = vapiConfig(env);
  const to = customerNumber(env);
  if (!cfg || !to) return null;
  return startDebriefCall({ incident, profile, ...cfg, customerNumber: to });
}

export async function getCall(id: string, env: Env = process.env): Promise<CallState> {
  const mock = mockCalls.get(id);
  if (mock) return mock.state();
  // A scripted call lost on a server reload can't be asked about anywhere: treat it as over.
  if (id.startsWith("mock_call_")) {
    return { id, status: "failed", to: "", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), transcript: [] };
  }
  const cfg = vapiConfig(env);
  if (!cfg) throw new Error(`Unknown call ${id}`);
  return getCallState(id, { apiKey: cfg.apiKey });
}

export { buildAgentPrompt, computeCredit } from "./prompt";
export { createMockCall } from "./mock";
