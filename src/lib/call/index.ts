// Facade: real Vapi call when configured, otherwise the scripted mock.
import type { CallState, Incident, ProviderProfile } from "../types";
import { createMockCall, type MockCall } from "./mock";
import { getCallState, startProviderCall } from "./vapi";

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

export async function getCall(id: string, env: Env = process.env): Promise<CallState> {
  const mock = mockCalls.get(id);
  if (mock) return mock.state();
  const cfg = vapiConfig(env);
  if (!cfg) throw new Error(`Unknown call ${id}`);
  return getCallState(id, { apiKey: cfg.apiKey });
}

export { buildAgentPrompt, computeCredit } from "./prompt";
export { createMockCall } from "./mock";
