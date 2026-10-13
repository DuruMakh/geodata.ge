import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A counter that records which keys it is asked about, in order, so the
// SEQUENCE of the limit checks becomes observable.
//
// The defect this pins was invisible from outside the endpoint: a refused
// caller saw 429 either way. What differed was that the refused request went
// on to charge the shared daily budget it never received an answer from - so
// one script could spend all 10,000 of a day's allowance on denials and take
// /mcp down for everybody until the next UTC day, with the per-key limit
// offering no protection at all, because the very requests it denied were the
// ones doing the spending.
type Verdict = "allow" | "deny" | "unavailable";
const state = vi.hoisted(() => ({ hits: [] as string[], perKeyVerdict: "allow" as Verdict, perKeyDailyVerdict: "allow" as Verdict, dailyVerdict: "allow" as Verdict }));

vi.mock("../../lib/mcp/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/mcp/limits")>();
  return {
    ...actual,
    createCounter: () => ({
      hit: (key: string) => {
        state.hits.push(key);
        if (key.startsWith("mcp:rate:")) return Promise.resolve(state.perKeyVerdict);
        return Promise.resolve(key.startsWith("mcp:keyday:") ? state.perKeyDailyVerdict : state.dailyVerdict);
      },
    }),
  };
});

import { POST } from "../../app/mcp/route";

const ENDPOINT = "https://fiscal.ge/mcp";
const original = { ...process.env };

beforeAll(() => {
  process.env.MCP_ENABLED = "true";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterAll(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

beforeEach(() => {
  state.hits.length = 0;
  state.perKeyVerdict = "allow";
  state.perKeyDailyVerdict = "allow";
  state.dailyVerdict = "allow";
});

describe.each(["legacy", "modern"])("%s rate-limit failures", era => {
  function request(): Request {
    const legacy = post();
    if (era === "legacy") return legacy;
    const headers = new Headers(legacy.headers);
    headers.set("mcp-protocol-version", "2026-07-28");
    headers.set("mcp-method", "server/discover");
    return new Request(legacy.url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 61, method: "server/discover", params: { _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "limit-test", version: "1" },
      "io.modelcontextprotocol/clientCapabilities": {},
    } } }) });
  }

  it("does not drain the daily allowance on minute denial", async () => {
    state.perKeyVerdict = "deny";
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(dailyHits()).toEqual([]);
  });
  it("refuses exhausted daily allowance after the minute check", async () => {
    state.dailyVerdict = "deny";
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(response.headers.get("retry-after"))).toBeLessThanOrEqual(86400);
    expect(await response.text()).toContain("/downloads/data/manifest.json");
    expect(state.hits).toHaveLength(3);
  });
  it("refuses a key's exhausted daily allowance without charging the shared one", async () => {
    state.perKeyDailyVerdict = "deny";
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(response.headers.get("retry-after"))).toBeLessThanOrEqual(86400);
    expect(await response.text()).toContain("/downloads/data/manifest.json");
    expect(dailyHits()).toEqual([]);
  });
  // A JSON-RPC client matches a reply to its request by id; with null it cannot
  // tell which call was refused, and a retry layer reads a transport fault (U30-05).
  it.each([["minute", "deny"], ["per-key daily", "deny"], ["daily", "deny"], ["minute", "unavailable"], ["daily", "unavailable"]] as const)("answers a %s %s with the request's own id", async (limit, verdict) => {
    if (limit === "minute") state.perKeyVerdict = verdict;
    else if (limit === "per-key daily") state.perKeyDailyVerdict = verdict;
    else state.dailyVerdict = verdict;
    const response = await POST(request());
    expect(response.status).toBe(verdict === "deny" ? 429 : 503);
    expect((await response.json()).id).toBe(era === "legacy" ? 1 : 61);
  });
  it.each([["minute", 1], ["per-key daily", 2], ["daily", 3]] as const)("fails closed if the %s limiter is unavailable", async (limit, hits) => {
    if (limit === "minute") state.perKeyVerdict = "unavailable";
    else if (limit === "per-key daily") state.perKeyDailyVerdict = "unavailable";
    else state.dailyVerdict = "unavailable";
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("service_unavailable");
    expect(state.hits).toHaveLength(hits);
  });
});

function post(headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      host: "fiscal.ge",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "1.0.0" } },
    }),
  });
}

const dailyHits = (): string[] => state.hits.filter((key) => key.startsWith("mcp:daily:"));

describe("the order the request limits are charged in", () => {
  it("does not charge the shared daily budget for a request it has already refused", async () => {
    state.perKeyVerdict = "deny";

    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(429);
    expect(dailyHits()).toEqual([]);
  });

  it("charges the daily budget once, and only once a request gets through", async () => {
    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(200);
    expect(dailyHits()).toHaveLength(1);
    // Per-key first: the cheaper, narrower limit decides before the shared one
    // is touched at all.
    expect(state.hits[0]!.startsWith("mcp:rate:")).toBe(true);
  });

  it("the per-key daily check runs before the global one", async () => {
    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(200);
    expect(state.hits.map((key) => key.split(":")[1])).toEqual(["rate", "keyday", "daily"]);
    // The same client key as the minute bucket, scoped to today's UTC date.
    const clientKey = state.hits[0]!.slice("mcp:rate:".length);
    expect(state.hits[1]).toBe(`mcp:keyday:${clientKey}:${new Date().toISOString().slice(0, 10)}`);

    state.hits.length = 0;
    state.perKeyDailyVerdict = "deny";
    const refused = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(refused.status).toBe(429);
    expect(dailyHits()).toEqual([]);
  });

  it("puts a caller it cannot identify in one shared bucket rather than exempting it", async () => {
    // No trusted platform header. Waving these past the per-key limit was the
    // one place this module failed open.
    await POST(post());

    expect(state.hits[0]).toBe("mcp:rate:unkeyed");
  });

  it("keys an identified caller by a hash, never by the address itself", async () => {
    await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(state.hits[0]).not.toContain("203.0.113.7");
    expect(state.hits[0]).toMatch(/^mcp:rate:[0-9a-f]{32}$/);
  });
});
