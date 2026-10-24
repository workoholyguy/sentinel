import { afterEach, describe, expect, it, vi } from "vitest";
import { loadModel, unloadModel } from "./llm";

afterEach(() => vi.unstubAllGlobals());

describe("local model lifecycle", () => {
  it("loads the model on Ollama's own API with a keep-alive, and frees it with keep_alive 0", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{}", { status: 200 });
    });
    expect(await loadModel("15m")).toBe(true);
    expect(await unloadModel()).toBe(true);
    expect(calls[0].url).toBe("http://127.0.0.1:11434/api/generate");
    expect(calls[0].body).toMatchObject({ model: "llama3.2:3b", prompt: "", keep_alive: "15m" });
    expect(calls[1].body).toMatchObject({ keep_alive: 0 });
  });

  it("reports false instead of throwing when Ollama isn't running", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    expect(await loadModel()).toBe(false);
  });
});
