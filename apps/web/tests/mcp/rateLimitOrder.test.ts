import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
const state = vi.hoisted(() => ({
  hits: [] as string[],
  calls: [] as { key: string; windowSeconds: number; max: number }[],
  records: [] as { day: string; field: string }[],
  record: undefined as undefined | ((day: string, field: string) => Promise<void>),
  perKeyVerdict: "allow" as Verdict,
  perKeyDailyVerdict: "allow" as Verdict,
  dailyVerdict: "allow" as Verdict,
}));

// Route tests run outside a request scope, where the real `after` throws. Run
// the callback at once and do not wait for it, which is what a request does.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => { void callback(); },
}));

vi.mock("../../lib/mcp/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/mcp/limits")>();
  return {
    ...actual,
    createCounter: () => ({
      hit: (key: string, windowSeconds: number, max: number) => {
        state.hits.push(key);
        state.calls.push({ key, windowSeconds, max });
        if (key.startsWith("mcp:rate:")) return Promise.resolve(state.perKeyVerdict);
        return Promise.resolve(key.startsWith("mcp:keyday:") ? state.perKeyDailyVerdict : state.dailyVerdict);
      },
      record: (day: string, field: string) => {
        state.records.push({ day, field });
        return state.record?.(day, field) ?? Promise.resolve();
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
  state.calls.length = 0;
  state.records.length = 0;
  state.record = undefined;
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
  // The real per-key limit wired into the route (moved from route.test.ts, which spent 61 requests on it):
  // a keyed request charges a 60-second rolling window with an allowance of 60, and a denial says retry in 60.
  it("charges a keyed request's minute counter with a 60-second window and 60 requests", async () => {
    const allowed = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));
    expect(allowed.status).toBe(200);
    expect(state.calls.find((call) => call.key.startsWith("mcp:rate:"))).toEqual({ key: expect.stringMatching(/^mcp:rate:[0-9a-f]{32}$/), windowSeconds: 60, max: 60 });
  });

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

// The anonymous daily tally (F04 Stage 1). It only records after the response;
// it never decides admission, and nothing it writes identifies a caller.
describe("the daily usage tally", () => {
  const TODAY = new Date().toISOString().slice(0, 10);
  const tools = (name: string, args: unknown = {}): Record<string, unknown> => ({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name, arguments: args } });
  function callOf(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", host: "fiscal.ge", "mcp-protocol-version": "2025-11-25", ...headers },
      body: JSON.stringify(body),
    });
  }
  // vi.spyOn hands back the file's one stdout spy, so a capture would outlive its test and parse the
  // next test's output; each test ends on the file's silent default again.
  afterEach(() => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  function captureLogs(): Record<string, unknown>[] {
    const written: Record<string, unknown>[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      return true;
    });
    return written;
  }

  it("records one anonymous field per counted request, under today's UTC day", async () => {
    await POST(post({ "x-vercel-forwarded-for": "160.79.104.9" }));

    expect(state.records).toEqual([{ day: TODAY, field: "initialize|ok|-|-|anthropic" }]);
  });

  it.each([
    ["key_day", { perKeyDailyVerdict: "deny" }, "initialize|error|rate_limited|key_day|other"],
    ["global", { dailyVerdict: "deny" }, "initialize|error|rate_limited|global|other"],
  ] as const)("records which limit refused a request (%s) and logs it", async (limit, verdicts, field) => {
    Object.assign(state, verdicts);
    const logs = captureLogs();

    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(429);
    expect(state.records).toEqual([{ day: TODAY, field }]);
    expect(logs.at(-1)).toMatchObject({ errorCode: "rate_limited", limit, clientClass: "other" });
  });

  it("logs the minute limit but does not tally it, so a flood of retries costs no extra commands", async () => {
    state.perKeyVerdict = "deny";
    const logs = captureLogs();

    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(429);
    expect(logs.at(-1)).toMatchObject({ errorCode: "rate_limited", limit: "minute", clientClass: "other" });
    expect(state.records).toEqual([]);
  });

  it("tallies an unidentifiable caller as unkeyed", async () => {
    await POST(post());

    expect(state.records[0]!.field).toMatch(/\|unkeyed$/);
  });

  it("tallies nothing for a request refused before the limiter ran", async () => {
    await POST(callOf({ jsonrpc: "2.0", id: 1, method: "ping" }, { origin: "https://evil.example" }));
    await POST(new Request(ENDPOINT, { method: "POST", headers: { host: "fiscal.ge" }, body: "{not json" }));

    expect(state.records).toEqual([]);
  });

  it("maps a caller-supplied tool name to the fixed labels, never quoting it", async () => {
    const injected = "totally-made-up-".repeat(10);
    await POST(callOf(tools(injected, { secret: "khulo-budget" })));
    await POST(callOf({ jsonrpc: "2.0", id: 6, method: "nonsense/method", params: {} }));
    await POST(callOf(tools("describe_coverage")));

    const fields = state.records.map((record) => record.field);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toMatch(/^unknown_tool\|/);
    expect(fields[1]).toMatch(/^unknown_method\|/);
    expect(fields[2]).toMatch(/^describe_coverage\|ok\|-\|-\|unkeyed$/);
    for (const field of fields) expect(field).toMatch(/^[a-z_/]+\|(ok|error)\|[a-z_-]+\|[a-z_-]+\|(anthropic|other|unkeyed)$/);
    expect(JSON.stringify(state.records)).not.toMatch(/totally-made-up|khulo|nonsense/);
  });

  it("carries neither an address nor a hash in a log line or a tally field", async () => {
    const logs = captureLogs();
    state.perKeyDailyVerdict = "deny";

    await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    const key = state.hits[0]!.slice("mcp:rate:".length);
    const everything = JSON.stringify([logs, state.records]);
    expect(everything).not.toContain("203.0.113.7");
    expect(everything).not.toContain(key);
    expect(everything).not.toMatch(/[0-9a-f]{16}/);
  });

  it("leaves the response and its timing unchanged when the tally throws", async () => {
    state.record = () => { throw new Error("boom"); };

    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(200);
    expect(state.records).toHaveLength(1);
  });

  it("leaves the response and its timing unchanged when the tally rejects", async () => {
    state.record = () => Promise.reject(new Error("boom"));

    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(200);
  });

  it("does not wait for a tally that hangs for two seconds", async () => {
    state.record = () => new Promise<void>((resolve) => setTimeout(resolve, 2_000));
    const startedAt = Date.now();

    const response = await POST(post({ "x-vercel-forwarded-for": "203.0.113.7" }));

    expect(response.status).toBe(200);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(state.records).toHaveLength(1);
  });
});
