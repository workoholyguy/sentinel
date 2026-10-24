// Places and follows the provider call through Vapi (https://docs.vapi.ai).
import type { CallOutcome, CallState, CallStatus, CallTurn, Incident, ProviderProfile } from "../types";
import { buildAgentPrompt } from "./prompt";

export const VAPI_BASE_URL = "https://api.vapi.ai";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface StartProviderCallOptions {
  incident: Incident;
  profile: ProviderProfile;
  apiKey: string;
  phoneNumberId: string;
  fetchImpl?: FetchLike;
}

export interface GetCallOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
}

/** JSON schema Vapi uses after the call to extract our CallOutcome into `call.analysis.structuredData`. */
export const outcomeSchema = {
  type: "object",
  properties: {
    ticketNumber: { type: "string", description: "Ticket / case / reference number the rep gave, exactly as read back" },
    creditUsd: { type: "number", description: "Credit in US dollars the rep agreed to apply; omit if none" },
    technicianWindow: { type: "string", description: "Technician visit window or ETA for the fix, e.g. 'today 3–5 PM'" },
    summary: { type: "string", description: "One or two sentences: what the provider agreed to do" },
  },
  required: ["summary"],
} as const;

export function buildCallRequest(incident: Incident, profile: ProviderProfile, phoneNumberId: string) {
  const { systemPrompt, firstMessage } = buildAgentPrompt(incident, profile);
  return {
    phoneNumberId,
    customer: { number: profile.supportNumber, name: `${profile.providerName} support` },
    metadata: { incidentId: incident.id },
    assistant: {
      name: "Sentinel provider call",
      firstMessage,
      firstMessageMode: "assistant-speaks-first",
      model: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.3,
        messages: [{ role: "system", content: systemPrompt }],
        tools: [{ type: "endCall" }],
      },
      voice: { provider: "vapi", voiceId: "Elliot" },
      endCallMessage: "Thanks for your help. Goodbye.",
      // Support lines put callers on hold; don't hang up on silence too early.
      silenceTimeoutSeconds: 120,
      maxDurationSeconds: 1200,
      analysisPlan: {
        summaryPrompt: "Summarize in 1-2 sentences what the internet provider agreed to do on this support call.",
        structuredDataPrompt:
          "Extract the outcome of this support call: the ticket number, any credit in USD the rep agreed to, and the technician window or ETA. Only include values the rep actually stated.",
        structuredDataSchema: outcomeSchema,
      },
    },
  };
}

// ---- Vapi response shapes (only what we read) --------------------------------------------
interface VapiMessage {
  role?: string;
  message?: string;
  time?: number;
  secondsFromStart?: number;
}

export interface VapiCall {
  id: string;
  status?: string;
  endedReason?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  customer?: { number?: string };
  messages?: VapiMessage[];
  artifact?: { messages?: VapiMessage[] };
  analysis?: { summary?: string; structuredData?: Record<string, unknown> };
}

const FAILED_REASON = /error|fail|did-not-answer|busy|rejected|unavailable|invalid/i;

export function mapStatus(status: string | undefined, endedReason?: string): CallStatus {
  switch (status) {
    case "scheduled":
    case "queued":
      return "queued";
    case "ringing":
      return "ringing";
    case "in-progress":
    case "forwarding":
      return "in-progress";
    case "ended":
      return endedReason && FAILED_REASON.test(endedReason) ? "failed" : "ended";
    default:
      return "queued";
  }
}

export function mapTranscript(call: VapiCall): CallTurn[] {
  const messages = call.messages?.length ? call.messages : (call.artifact?.messages ?? []);
  const startMs = Date.parse(call.startedAt ?? call.createdAt ?? "");
  const turns: CallTurn[] = [];
  for (const m of messages) {
    const speaker = m.role === "bot" || m.role === "assistant" ? "agent" : m.role === "user" ? "rep" : null;
    const text = m.message?.trim();
    if (!speaker || !text) continue;
    const ms =
      typeof m.time === "number"
        ? m.time
        : typeof m.secondsFromStart === "number" && Number.isFinite(startMs)
          ? startMs + m.secondsFromStart * 1000
          : NaN;
    turns.push({ at: Number.isFinite(ms) ? new Date(ms).toISOString() : (call.startedAt ?? new Date().toISOString()), speaker, text });
  }
  return turns;
}

/** Reps read tickets out loud ("a r 5 3 7…"); show them the way they're written ("AR537…"). */
export function normalizeTicket(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const spelled = /^([a-z0-9][\s.-]+)+[a-z0-9]$/i.test(raw);
  return spelled ? raw.replace(/[\s.-]+/g, "").toUpperCase() : raw.toUpperCase();
}

export function mapOutcome(call: VapiCall): CallOutcome | undefined {
  const data = call.analysis?.structuredData ?? {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const summary = str(data.summary) ?? str(call.analysis?.summary);
  const outcome: CallOutcome = {
    ticketNumber: normalizeTicket(str(data.ticketNumber)),
    creditUsd: num(data.creditUsd),
    technicianWindow: str(data.technicianWindow),
    summary: summary ?? "",
  };
  if (!outcome.ticketNumber && !outcome.creditUsd && !outcome.technicianWindow && !summary) return undefined;
  return outcome;
}

export function toCallState(call: VapiCall): CallState {
  const status = mapStatus(call.status, call.endedReason);
  const done = status === "ended" || status === "failed";
  const outcome = done ? mapOutcome(call) : undefined;
  return {
    id: call.id,
    status,
    to: call.customer?.number ?? "",
    startedAt: call.startedAt ?? call.createdAt ?? new Date().toISOString(),
    endedAt: call.endedAt,
    transcript: mapTranscript(call),
    outcome: outcome ?? (status === "failed" ? { summary: `Call failed: ${call.endedReason}` } : undefined),
  };
}

async function vapi(path: string, apiKey: string, fetchImpl: FetchLike, init: RequestInit = {}): Promise<VapiCall> {
  const res = await fetchImpl(`${VAPI_BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vapi ${init.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return (await res.json()) as VapiCall;
}

export async function startProviderCall({
  incident,
  profile,
  apiKey,
  phoneNumberId,
  fetchImpl = fetch,
}: StartProviderCallOptions): Promise<CallState> {
  const body = buildCallRequest(incident, profile, phoneNumberId);
  const call = await vapi("/call", apiKey, fetchImpl, { method: "POST", body: JSON.stringify(body) });
  const state = toCallState(call);
  return { ...state, to: state.to || profile.supportNumber };
}

export async function getCallState(id: string, { apiKey, fetchImpl = fetch }: GetCallOptions): Promise<CallState> {
  return toCallState(await vapi(`/call/${encodeURIComponent(id)}`, apiKey, fetchImpl));
}
