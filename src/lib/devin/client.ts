export type RepairStatus = "starting" | "working" | "blocked" | "finished" | "failed";

export interface RepairSession {
  id: string;
  url: string;
  status: RepairStatus;
  prUrl?: string;
  title?: string;
  updatedAt: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface DevinClientOptions {
  apiKey: string;
  /** Defaults to https://api.devin.ai (per docs.devin.ai). */
  baseUrl?: string;
  /** When set, uses the v3 organization API; otherwise the v1 API. */
  orgId?: string;
  fetchImpl?: FetchLike;
  /** Per-request timeout; a lossy network must not hang Sentinel. Default 10 s. */
  timeoutMs?: number;
}

export interface CreateRepairOptions extends DevinClientOptions {
  title?: string;
  tags?: string[];
  /** Spend cap for the session (Devin ACUs). */
  maxAcu?: number;
}

export const DEFAULT_DEVIN_API_BASE = "https://api.devin.ai";

export const REPAIR_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    pr_url: { type: "string", description: "URL of the pull request adding the repair plugin" },
    plugin_id: { type: "string" },
    summary: { type: "string" },
  },
  required: ["pr_url"],
} as const;

export class DevinApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "DevinApiError";
  }
}

type Json = Record<string, unknown>;

function base(opts: DevinClientOptions): string {
  return (opts.baseUrl || DEFAULT_DEVIN_API_BASE).replace(/\/+$/, "");
}

function sessionsPath(opts: DevinClientOptions): string {
  return opts.orgId ? `/v3/organizations/${encodeURIComponent(opts.orgId)}/sessions` : `/v1/sessions`;
}

async function call(opts: DevinClientOptions, method: "GET" | "POST", path: string, body?: unknown): Promise<Json> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike);
  const res = await fetchImpl(`${base(opts)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as Json;
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      /* keep raw text */
    }
    throw new DevinApiError(`Devin API ${method} ${path} failed: ${res.status} ${detail}`.trim(), res.status, text);
  }
  return text ? (JSON.parse(text) as Json) : {};
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

const FAILED_SUSPEND_DETAILS = new Set([
  "error",
  "usage_limit_exceeded",
  "out_of_credits",
  "out_of_quota",
  "no_quota_allocation",
  "payment_declined",
  "org_usage_limit_exceeded",
  "user_usage_limit_exceeded",
  "total_session_limit_exceeded",
  "contract_expired",
]);

/**
 * Maps v3 `status` + `status_detail`, or v1 `status_enum`, onto RepairStatus.
 * v1's `status_enum` wins over its free-form `status` when present.
 * A suspended/expired session that already opened a PR counts as finished.
 */
export function mapStatus(raw: { status?: unknown; status_detail?: unknown; status_enum?: unknown }, hasPr = false): RepairStatus {
  const status = str(raw.status);
  const detail = str(raw.status_detail);
  const legacy = str(raw.status_enum);

  if (legacy) {
    switch (legacy) {
      case "working":
      case "resumed":
      case "resume_requested":
      case "resume_requested_frontend":
        return "working";
      case "blocked":
      case "suspend_requested":
      case "suspend_requested_frontend":
        return hasPr ? "finished" : "blocked";
      case "finished":
        return "finished";
      case "expired":
        return hasPr ? "finished" : "failed";
    }
  }

  switch (status) {
    case "new":
    case "claimed":
    case "resuming":
      return "starting";
    case "running":
      if (detail === "finished") return "finished";
      if (detail === "waiting_for_user" || detail === "waiting_for_approval") return "blocked";
      return "working";
    case "exit":
      return "finished";
    case "error":
      return "failed";
    case "suspended":
      // A session that opened its PR and then hit its ACU cap still delivered the fix.
      if (hasPr) return "finished";
      if (detail && FAILED_SUSPEND_DETAILS.has(detail)) return "failed";
      return "blocked";
  }

  return "starting";
}

/** Finds the PR URL in v3 `pull_requests`, v1 `pull_request`, or structured output. */
export function extractPrUrl(data: Json): string | undefined {
  const prs = data.pull_requests;
  if (Array.isArray(prs)) {
    const urls = prs.map((p) => str((p as Json | null)?.pr_url) ?? str((p as Json | null)?.url)).filter(Boolean) as string[];
    if (urls.length) return urls[urls.length - 1];
  }
  const pr = data.pull_request as Json | null | undefined;
  const legacy = str(pr?.url) ?? str(pr?.pr_url);
  if (legacy) return legacy;
  const out = data.structured_output as Json | null | undefined;
  return str(out?.pr_url) ?? str(out?.prUrl);
}

function toIso(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export function toRepairSession(data: Json): RepairSession {
  const id = str(data.session_id) ?? str(data.id) ?? "";
  const prUrl = extractPrUrl(data);
  return {
    id,
    url: str(data.url) ?? (id ? `https://app.devin.ai/sessions/${id.replace(/^devin-/, "")}` : ""),
    status: mapStatus(data, Boolean(prUrl)),
    ...(prUrl ? { prUrl } : {}),
    ...(str(data.title) ? { title: str(data.title) } : {}),
    updatedAt: toIso(data.updated_at ?? data.created_at),
  };
}

export async function createRepairSession(brief: string, opts: CreateRepairOptions): Promise<RepairSession> {
  const body: Json = {
    prompt: brief,
    structured_output_schema: REPAIR_OUTPUT_SCHEMA,
    ...(opts.title ? { title: opts.title } : {}),
    ...(opts.tags?.length ? { tags: opts.tags } : {}),
    ...(opts.maxAcu ? { max_acu_limit: opts.maxAcu } : {}),
  };
  const data = await call(opts, "POST", sessionsPath(opts), body);
  const session = toRepairSession(data);
  if (!session.title && opts.title) session.title = opts.title;
  return session;
}

export async function getRepairSession(id: string, opts: DevinClientOptions): Promise<RepairSession> {
  const sid = opts.orgId && !id.startsWith("devin-") ? `devin-${id}` : id;
  const data = await call(opts, "GET", `${sessionsPath(opts)}/${encodeURIComponent(sid)}`);
  return toRepairSession({ session_id: sid, ...data });
}

/** Newest session tagged `tag` that opened a PR (v3 org API only; v1 has no tag filter). */
export async function latestRepairWithPr(opts: DevinClientOptions, tag = "repair"): Promise<RepairSession | null> {
  if (!opts.orgId) return null;
  const data = await call(opts, "GET", `${sessionsPath(opts)}?first=50&tags=${encodeURIComponent(tag)}`);
  const items = Array.isArray(data.items) ? (data.items as Json[]) : [];
  const withPr = items.map(toRepairSession).filter((s) => s.prUrl);
  withPr.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return withPr[0] ?? null;
}
