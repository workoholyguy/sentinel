// Scripted provider call for demos and tests: ringing → in-progress → ended over ~40 seconds.
import type { CallOutcome, CallState, CallTurn, Incident, ProviderProfile } from "../types";

export const MOCK_CALL_SECONDS = 40;
const RINGING_SECONDS = 4;

export const mockOutcome: CallOutcome = {
  ticketNumber: "PF-88213",
  technicianWindow: "today 3–5 PM",
  creditUsd: 4.3,
  summary: "Ticket PF-88213 opened, technician scheduled for today 3–5 PM, $4.30 downtime credit applied.",
};

export interface MockCall {
  id: string;
  /** Current state of the call; pass a time (ms) to look at a specific moment. */
  state(nowMs?: number): CallState;
}

let seq = 0;

function script(incident: Incident, profile: ProviderProfile): Array<[number, CallTurn["speaker"], string]> {
  const evidence = incident.diagnosis?.evidence ?? [];
  const problem = incident.diagnosis?.summary ?? "the internet connection is down";
  const localOk = evidence.find((e) => /router|local/i.test(e)) ?? "the local network tests healthy";
  const reboot = evidence.find((e) => /reboot|restart/i.test(e)) ?? "the router was already rebooted and it didn't help";
  return [
    [5, "rep", `Thank you for calling ${profile.providerName} support, this is Dana. How can I help?`],
    [
      9,
      "agent",
      `Hi Dana, I'm an AI assistant calling on behalf of ${profile.customerName}, account ${profile.accountNumber}. Their monitor shows ${problem}.`,
    ],
    [14, "rep", "Okay, I can look into that. First, have you tried restarting your modem?"],
    [18, "agent", `Yes. ${reboot}. And ${localOk}. So this is on your side. Can you open a ticket?`],
    [23, "rep", "You're right, I see a problem on the node serving that address. Your ticket number is P F 8 8 2 1 3."],
    [26, "agent", "That's P F, 8 8 2 1 3. Is a technician coming, and when?"],
    [29, "rep", "Yes, a technician is scheduled for today between 3 and 5 PM."],
    [32, "agent", `Thanks. Since the service was down, can you credit at least one day? On a $${profile.monthlyPriceUsd} plan that's $${(profile.monthlyPriceUsd / 30).toFixed(2)}.`],
    [35, "rep", "Sure, I've applied a $4.30 credit to this month's bill. Best callback number?"],
    [
      38,
      "agent",
      `${profile.callbackNumber}. So that's ticket PF-88213, a technician today 3 to 5 PM, and a $4.30 credit. Thanks Dana, goodbye.`,
    ],
  ];
}

export function createMockCall(incident: Incident, profile: ProviderProfile, startedMs: number = Date.now()): MockCall {
  const id = `mock_call_${startedMs}_${++seq}`;
  const lines = script(incident, profile);
  const iso = (s: number) => new Date(startedMs + s * 1000).toISOString();
  return {
    id,
    state(nowMs = Date.now()) {
      const elapsed = (nowMs - startedMs) / 1000;
      const ended = elapsed >= MOCK_CALL_SECONDS;
      return {
        id,
        status: ended ? "ended" : elapsed < RINGING_SECONDS ? "ringing" : "in-progress",
        to: profile.supportNumber,
        startedAt: iso(0),
        endedAt: ended ? iso(MOCK_CALL_SECONDS) : undefined,
        transcript: lines.filter(([t]) => elapsed >= t).map(([t, speaker, text]) => ({ at: iso(t), speaker, text })),
        outcome: ended ? { ...mockOutcome } : undefined,
      };
    },
  };
}
