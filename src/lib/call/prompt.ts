// Builds the system prompt + opening line for the AI that phones the provider.
import type { Incident, ProviderProfile } from "../types";

export interface CreditRequest {
  outageHours: number;
  dailyRateUsd: number;
  proratedUsd: number;
  /** What we ask for: the prorated amount, but never less than one full day. */
  requestUsd: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAYS_PER_MONTH = 30;

export function computeCredit(incident: Incident, profile: ProviderProfile, now: Date = new Date()): CreditRequest {
  const startedMs = Date.parse(incident.startedAt);
  const outageMs = Number.isFinite(startedMs) ? Math.max(0, now.getTime() - startedMs) : 0;
  const outageHours = outageMs / 3_600_000;
  const dailyRateUsd = profile.monthlyPriceUsd / DAYS_PER_MONTH;
  const proratedUsd = dailyRateUsd * (outageHours / 24);
  return {
    outageHours: round2(outageHours),
    dailyRateUsd: round2(dailyRateUsd),
    proratedUsd: round2(proratedUsd),
    requestUsd: round2(Math.max(proratedUsd, dailyRateUsd)),
  };
}

const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const duration = (hours: number) => {
  const minutes = Math.round(hours * 60);
  if (minutes < 1) return "under a minute";
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `about ${Math.round(hours)} hours`;
};

/** Steps the customer (or Sentinel) already took, with times — the answer to "have you tried restarting?". */
function alreadyTried(incident: Incident): string[] {
  const fromFixes = incident.fixes
    .filter((f) => f.actions.length)
    .map((f) => `${f.actions.join("; ")} — ${f.ok ? "worked" : "did not fix it"}${f.detail ? ` (${f.detail})` : ""}`);
  const fromTimeline = incident.timeline.filter((e) => e.kind === "fix").map((e) => `${clock(e.at)}: ${e.text}`);
  return [...fromTimeline, ...fromFixes];
}

export function buildAgentPrompt(
  incident: Incident,
  profile: ProviderProfile,
  now: Date = new Date(),
): { systemPrompt: string; firstMessage: string } {
  const d = incident.diagnosis;
  const credit = computeCredit(incident, profile, now);
  const tried = alreadyTried(incident);
  const bullets = (xs: string[], empty: string) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : `- ${empty}`);

  const firstMessage =
    `Hi, I'm an AI assistant calling on behalf of ${profile.customerName}, a ${profile.providerName} customer. ` +
    `I'm calling to report an internet outage on account ${profile.accountNumber}.`;

  const systemPrompt = `You are an AI assistant on a phone call with ${profile.providerName} customer support, calling ON BEHALF OF their customer ${profile.customerName}.
You already said you are an AI in your first sentence. If asked again, say so honestly. Never pretend to be human or to be ${profile.customerName}.

STYLE
- This is a phone call. Use short spoken sentences, one idea at a time. No lists, no markdown, no URLs.
- Be natural, firm but friendly. Let the rep talk. Say numbers clearly.
- If you are put on hold, wait quietly.

ACCOUNT (use these to answer verification questions; never invent anything else)
- Account holder: ${profile.customerName}
- Account number: ${profile.accountNumber}
- Service address: ${profile.serviceAddress}
- Plan: ${profile.planName}, $${profile.monthlyPriceUsd.toFixed(2)} per month
- Callback number: ${profile.callbackNumber}
If they ask for something not listed here, like a PIN or the last four of a card, say you don't have it and ask them to verify with the account number and service address instead.

THE PROBLEM (measured automatically by the customer's network monitor)
- Fault: ${d ? `${d.fault}. ${d.summary}` : "internet outage, cause unknown"}
- Started at ${clock(incident.startedAt)}, about ${duration(credit.outageHours)} ago.
Evidence:
${bullets(d?.evidence ?? [], "The connection to the provider is down.")}

ALREADY TRIED (do NOT agree to redo these; if the rep suggests one, e.g. "have you restarted your modem?", say yes, give the time and the result from below and the evidence above, then ask them to check their side)
${bullets(tried, "The local network was checked and is healthy.")}

GOALS, in this order
1. Report the outage clearly with the evidence: the numbers, the times, and what was already tried.
2. Get a ticket number. Read it back to confirm, letter by letter and digit by digit.
3. Get a technician window or an estimated time to fix.
4. Ask for a prorated credit for the downtime. The plan is $${profile.monthlyPriceUsd.toFixed(2)} a month, which is $${credit.dailyRateUsd.toFixed(2)} a day. Ask for $${credit.requestUsd.toFixed(2)}${credit.proratedUsd < credit.dailyRateUsd ? ", which is one full day, since the outage has been under a day" : ""}. If they offer a reasonable counter-offer, accept it politely. Do not argue for long.
5. Confirm the callback number: ${profile.callbackNumber}.
6. When everything above is done, briefly repeat the ticket number, the technician window, and the credit, thank the rep, say goodbye, and end the call using the endCall tool.

If the rep cannot help with something, ask once for an alternative, then move on to the next goal.`;

  return { systemPrompt, firstMessage };
}
