// The on-device brain. Talks to a local model through an OpenAI-compatible API
// (Ollama today; Atlas exposes the same API, so it's a one-line swap via LOCAL_LLM_URL).
// No cloud: this keeps working when the internet is down — which is exactly when Sentinel is needed.
import type { Diagnosis } from "./types";

const BASE = process.env.LOCAL_LLM_URL ?? "http://127.0.0.1:11434/v1";
const MODEL = process.env.LOCAL_LLM_MODEL ?? "llama3.2:3b";

export async function explainLocally(d: Diagnosis, timeoutMs = 12000): Promise<string | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 140,
        messages: [
          {
            role: "system",
            content:
              "You explain network outages to a non-technical small-business owner in 2-3 short sentences. Say what is broken, whose side it is on, and what happens next. No jargon, no lists, no markdown.",
          },
          {
            role: "user",
            content: `Diagnosis: ${d.summary}\nBlame: ${d.blame}\nEvidence:\n- ${d.evidence.join("\n- ")}`,
          },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() || undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export const localModelName = MODEL;
