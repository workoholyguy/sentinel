import { afterEach, describe, expect, it, vi } from "vitest";
import type { Diagnosis, Snapshot } from "../types";
import { buildRepairBrief, pluginIdFor } from "./brief";
import { createRepairSession, extractPrUrl, getRepairSession, mapStatus, type FetchLike } from "./client";
import { getRepairStatus, MOCK_TIMELINE, requestRepair, resetMockRepairs } from "./index";

const snapshot: Snapshot = {
  at: "2026-10-24T17:00:00.000Z",
  nodes: { device: "ok", wifi: "ok", router: "ok", dns: "down", isp: "ok", internet: "ok" },
  probes: [
    { id: "ping-gateway", node: "router", label: "Gateway ping 192.168.1.1", status: "ok", latencyMs: 3, lossPct: 0, at: "2026-10-24T17:00:00.000Z" },
    { id: "dns-system", node: "dns", label: "System resolver 10.255.255.1", status: "down", detail: "SERVFAIL example.com", at: "2026-10-24T17:00:00.000Z" },
  ],
};

const diagnosis: Diagnosis = {
  fault: "UNKNOWN",
  blame: "local",
  confidence: 0.87,
  summary: "Router DNS forwarder returns SERVFAIL while upstream 1.1.1.1 resolves",
  evidence: ["dig @192.168.1.1 example.com -> SERVFAIL", "dig @1.1.1.1 example.com -> NOERROR"],
  explanation: "The router's DNS proxy is wedged.",
};

const input = { fault: "dns_resolver_stuck", diagnosis, snapshot, platform: "linux" as const, repo: "workoholyguy/sentinel" };

interface Call { url: string; init?: RequestInit }

function fakeFetch(responses: Array<{ status?: number; body: unknown }>): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fetchImpl, calls };
}

const v3Session = (over: Record<string, unknown> = {}) => ({
  session_id: "devin-abc123",
  url: "https://app.devin.ai/sessions/abc123",
  status: "new",
  tags: [],
  org_id: "org-1",
  created_at: 1_761_325_200,
  updated_at: 1_761_325_260,
  acus_consumed: 0,
  pull_requests: [],
  ...over,
});

afterEach(() => resetMockRepairs());

describe("buildRepairBrief", () => {
  it("includes fault, evidence, probe data, plugin path and PR title", () => {
    const brief = buildRepairBrief(input);
    expect(brief).toContain("dns_resolver_stuck");
    expect(brief).toContain("dig @192.168.1.1 example.com -> SERVFAIL");
    expect(brief).toContain("Router DNS forwarder returns SERVFAIL");
    expect(brief).toContain("SERVFAIL example.com");
    expect(brief).toContain("src/lib/fixes/extra/fix-dns-resolver-stuck.plugin.ts");
    expect(brief).toContain("ctx.exec");
    expect(brief).toContain('"repair: ');
    expect(brief).toContain("workoholyguy/sentinel");
    expect(brief).toContain("linux");
    expect(brief).toContain("dns: down");
    expect(brief).toContain("latency 3 ms");
    expect(brief).toContain("blame: local");
    expect(brief).toContain("The router's DNS proxy is wedged.");
  });

  it("works without a diagnosis and slugs odd fault strings", () => {
    const brief = buildRepairBrief({ ...input, diagnosis: undefined, fault: "Weird Fault!!" });
    expect(pluginIdFor("Weird Fault!!")).toBe("fix-weird-fault");
    expect(brief).toContain("rely on the probe data");
  });
});

describe("createRepairSession", () => {
  it("POSTs to v3 with bearer auth, prompt and structured output schema", async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: v3Session() }]);
    const brief = buildRepairBrief(input);
    const s = await createRepairSession(brief, { apiKey: "cog_test", orgId: "org-1", fetchImpl, title: "T", tags: ["sentinel"] });

    expect(calls[0].url).toBe("https://api.devin.ai/v3/organizations/org-1/sessions");
    expect(calls[0].init?.method).toBe("POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer cog_test");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.prompt).toContain("dns_resolver_stuck");
    expect(body.prompt).toContain("dig @1.1.1.1 example.com -> NOERROR");
    expect(body.structured_output_schema.properties.pr_url).toBeDefined();
    expect(body.title).toBe("T");
    expect(body.tags).toEqual(["sentinel"]);
    expect(s).toEqual({
      id: "devin-abc123",
      url: "https://app.devin.ai/sessions/abc123",
      status: "starting",
      title: "T",
      updatedAt: new Date(1_761_325_260_000).toISOString(),
    });
  });

  it("uses v1 when no org id and honours a custom base URL", async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: { session_id: "devin-x", url: "https://app.devin.ai/sessions/x", is_new_session: true } }]);
    await createRepairSession("brief", { apiKey: "apk_1", baseUrl: "https://devin.example.com/", fetchImpl });
    expect(calls[0].url).toBe("https://devin.example.com/v1/sessions");
  });

  it("throws a DevinApiError with the API detail on failure", async () => {
    const { fetchImpl } = fakeFetch([{ status: 401, body: { detail: "bad token" } }]);
    await expect(createRepairSession("b", { apiKey: "k", orgId: "org-1", fetchImpl })).rejects.toThrow(/401 bad token/);
  });
});

describe("getRepairSession", () => {
  it("GETs v3 session, prefixing devin- and extracting the PR", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { body: v3Session({ status: "running", status_detail: "finished", title: "repair", pull_requests: [{ pr_url: "https://github.com/o/r/pull/7", pr_state: "open" }] }) },
    ]);
    const s = await getRepairSession("abc123", { apiKey: "k", orgId: "org-1", fetchImpl });
    expect(calls[0].url).toBe("https://api.devin.ai/v3/organizations/org-1/sessions/devin-abc123");
    expect(calls[0].init?.method).toBe("GET");
    expect(s.status).toBe("finished");
    expect(s.prUrl).toBe("https://github.com/o/r/pull/7");
    expect(s.title).toBe("repair");
  });

  it("reads v1 status_enum and pull_request", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { body: { session_id: "devin-x", status: "running", status_enum: "blocked", updated_at: "2026-10-24T17:05:00Z", pull_request: { url: "https://github.com/o/r/pull/9" } } },
    ]);
    const s = await getRepairSession("devin-x", { apiKey: "k", fetchImpl });
    expect(calls[0].url).toBe("https://api.devin.ai/v1/sessions/devin-x");
    expect(s.prUrl).toBe("https://github.com/o/r/pull/9");
    expect(s.status).toBe("finished");
    expect(s.updatedAt).toBe("2026-10-24T17:05:00.000Z");
  });
});

describe("mapStatus", () => {
  it.each([
    [{ status: "new" }, "starting"],
    [{ status: "claimed" }, "starting"],
    [{ status: "resuming" }, "starting"],
    [{ status: "running" }, "working"],
    [{ status: "running", status_detail: "working" }, "working"],
    [{ status: "running", status_detail: "waiting_for_user" }, "blocked"],
    [{ status: "running", status_detail: "waiting_for_approval" }, "blocked"],
    [{ status: "running", status_detail: "finished" }, "finished"],
    [{ status: "exit" }, "finished"],
    [{ status: "error" }, "failed"],
    [{ status: "suspended", status_detail: "out_of_credits" }, "failed"],
    [{ status: "suspended", status_detail: "inactivity" }, "blocked"],
    [{ status_enum: "working" }, "working"],
    [{ status_enum: "blocked" }, "blocked"],
    [{ status_enum: "finished" }, "finished"],
    [{ status_enum: "expired" }, "failed"],
    [{}, "starting"],
  ] as const)("%j -> %s", (raw, expected) => {
    expect(mapStatus(raw)).toBe(expected);
  });

  it("treats an idle session with a PR as finished", () => {
    expect(mapStatus({ status: "suspended", status_detail: "inactivity" }, true)).toBe("finished");
  });
});

describe("extractPrUrl", () => {
  it("prefers pull_requests, then pull_request, then structured_output", () => {
    expect(extractPrUrl({ pull_requests: [{ pr_url: "a" }, { pr_url: "b" }] })).toBe("b");
    expect(extractPrUrl({ pull_requests: [], pull_request: { url: "c" } })).toBe("c");
    expect(extractPrUrl({ structured_output: { pr_url: "d" } })).toBe("d");
    expect(extractPrUrl({ pull_requests: [], pull_request: null, structured_output: null })).toBeUndefined();
  });
});

describe("requestRepair", () => {
  it("returns null and logs when DEVIN_API_KEY is missing", async () => {
    const log = vi.fn();
    const fetchImpl = vi.fn();
    expect(await requestRepair(input, { env: {}, log, fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("DEVIN_API_KEY"));
  });

  it("creates a real session from env config", async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: v3Session() }]);
    const s = await requestRepair(input, {
      env: { DEVIN_API_KEY: "cog_x", DEVIN_ORG_ID: "org-9", DEVIN_API_BASE: "https://api.example.test" },
      fetchImpl,
      log: () => {},
    });
    expect(calls[0].url).toBe("https://api.example.test/v3/organizations/org-9/sessions");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer cog_x");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.tags).toEqual(["sentinel", "repair", "dns_resolver_stuck"]);
    expect(s?.status).toBe("starting");
  });

  it("returns null and logs when the API errors", async () => {
    const log = vi.fn();
    const { fetchImpl } = fakeFetch([{ status: 500, body: "boom" }]);
    expect(await requestRepair(input, { env: { DEVIN_API_KEY: "k" }, fetchImpl, log })).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("500"));
  });

  it("DEVIN_MOCK=1 simulates starting -> working -> finished with a fake PR over ~30s", async () => {
    let t = 1_000_000;
    const deps = { env: { DEVIN_MOCK: "1" }, now: () => t, log: () => {}, fetchImpl: vi.fn() };
    const s = await requestRepair(input, deps);
    expect(s?.status).toBe("starting");
    expect(s?.prUrl).toBeUndefined();

    t += MOCK_TIMELINE.workingAfterMs;
    expect((await getRepairStatus(s!.id, deps))?.status).toBe("working");

    t = 1_000_000 + MOCK_TIMELINE.finishedAfterMs - 1_000;
    expect((await getRepairStatus(s!.id, deps))?.status).toBe("working");

    t = 1_000_000 + MOCK_TIMELINE.finishedAfterMs;
    const done = await getRepairStatus(s!.id, deps);
    expect(done?.status).toBe("finished");
    expect(done?.prUrl).toMatch(/^https:\/\/github\.com\/.+\/pull\/\d+$/);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });
});
