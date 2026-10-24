// The on-device brain. Talks to a local model through an OpenAI-compatible API
// (Ollama today; Atlas exposes the same API, so it's a one-line swap via LOCAL_LLM_URL).
// No cloud: this keeps working when the internet is down — which is exactly when Uplink is needed.
import type { Diagnosis } from "./types";

const BASE = process.env.LOCAL_LLM_URL ?? "http://127.0.0.1:11434/v1";
const MODEL = process.env.LOCAL_LLM_MODEL ?? "llama3.2:3b";
const NATIVE = BASE.replace(/\/v1\/?$/, ""); // Ollama's own API, for loading and unloading the model

async function ollama(body: Record<string, unknown>, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetch(`${NATIVE}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, stream: false, ...body }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Load the model into memory (an empty prompt only loads it). Resolves when it's ready to answer. */
export function loadModel(keepAlive = "15m"): Promise<boolean> {
  return ollama({ prompt: "", keep_alive: keepAlive }, 60_000);
}

/** Free the model's memory; the network is healthy again. */
export function unloadModel(): Promise<boolean> {
  return ollama({ prompt: "", keep_alive: 0 }, 10_000);
}

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
              "You are Uplink's on-device network troubleshooter, woken up because the internet just broke. In 2-3 short sentences for a non-technical small-business owner, say what is broken, whose side it is on, and what you'll do next. No jargon, no lists, no markdown.",
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
