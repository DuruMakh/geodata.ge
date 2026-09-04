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
const state = vi.hoisted(() => ({ hits: [] as string[], perKeyVerdict: "allow" as "allow" | "deny" }));

vi.mock("../../lib/mcp/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/mcp/limits")>();
  return {
    ...actual,
    createCounter: () => ({
      hit: (key: string) => {
        state.hits.push(key);
        return Promise.resolve(key.startsWith("mcp:rate:") ? state.perKeyVerdict : "allow");
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
