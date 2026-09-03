import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST, GET, DELETE } from "../../app/mcp/route";

const ENDPOINT = "https://fiscal.ge/mcp";
const PROTOCOL = "2025-11-25";
const original = { ...process.env };

beforeAll(() => {
  // The endpoint ships paused and with no limiter, so a test has to turn both
  // on deliberately - which is itself the point of those defaults.
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  // The route logs one line per request; keep the suite output readable.
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterAll(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      host: "fiscal.ge",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "route-test", version: "1.0.0" },
  },
};

async function jsonOf(response: Response): Promise<Record<string, never>> {
  const text = await response.text();
  // enableJsonResponse returns plain JSON, but accept an SSE frame too so this
  // test pins behaviour rather than one transport setting.
  const payload = text.startsWith("event:") || text.startsWith("data:")
    ? text.split("\n").find((line) => line.startsWith("data:"))!.slice(5).trim()
    : text;
  return JSON.parse(payload);
}

describe("/mcp route", () => {
  it("initializes at the declared protocol revision", async () => {
    const response = await POST(post(initialize));
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect((body as unknown as { result: { protocolVersion: string } }).result.protocolVersion).toBe(PROTOCOL);
    // Stateless: no session to hand back, so no session header (spec 11.1).
    expect(response.headers.get("mcp-session-id")).toBeNull();
  });

  it("advertises the server instructions on initialize", async () => {
    const body = await jsonOf(await POST(post(initialize)));
    const result = (body as unknown as { result: { instructions?: string; serverInfo: { name: string } } }).result;

    expect(result.serverInfo.name).toBe("fiscal-ge");
    expect(result.instructions).toContain("CC BY 4.0");
  });

  it("lists the seven tools", async () => {
    const body = await jsonOf(
      await POST(post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, { "mcp-protocol-version": PROTOCOL })),
    );
    const tools = (body as unknown as { result: { tools: { name: string }[] } }).result.tools;

    expect(tools).toHaveLength(7);
    expect(tools.map((tool) => tool.name)).toContain("query_national");
  });

  it("answers a tool call with a figure", async () => {
    const body = await jsonOf(
      await POST(
        post(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
              name: "query_national",
              arguments: { side: "expenditure", seriesIds: ["expenditure.total"], years: [2024], measure: "amount_gel" },
            },
          },
          { "mcp-protocol-version": PROTOCOL },
        ),
      ),
    );
    const result = (body as unknown as { result: { isError?: boolean; content: { text: string }[] } }).result;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain("2024");
    expect(result.content[0]!.text).toContain("CC BY 4.0");
  });

  it("returns a JSON-RPC error for an unknown method", async () => {
    const body = await jsonOf(
      await POST(post({ jsonrpc: "2.0", id: 4, method: "nonsense/method", params: {} }, { "mcp-protocol-version": PROTOCOL })),
    );

    expect((body as unknown as { error: { code: number } }).error.code).toBe(-32601);
  });

  it("rejects malformed JSON without a 200", async () => {
    const response = await POST(post("{not json", { "mcp-protocol-version": PROTOCOL }));

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  // Spec 11.1: no long-lived background subscriptions. Passed straight to the
  // transport, a GET with this Accept header returns 200 and opens a
  // keep-alive SSE stream that this server has nothing to push to - an
  // unauthenticated way to pin a function instance for the full 10-second
  // ceiling. It is rejected before the transport sees it. An ordinary browser
  // GET returning 405 is not itself a failure.
  it("refuses to open a stream on GET", async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("content-type")).toContain("application/json");
    // Not a stream: the body is finite and readable in one go.
    expect(await response.text()).toContain("POST only");
  });

  it("refuses a session DELETE, having no sessions", () => {
    expect(DELETE().status).toBe(405);
  });

  it("declares the runtime and duration the deployment needs", async () => {
    const segment = await import("../../app/mcp/route");

    expect(segment.runtime).toBe("nodejs");
    expect(segment.dynamic).toBe("force-dynamic");
    expect(segment.maxDuration).toBe(10);
  });
});

describe("/mcp guards", () => {
  it("rejects a host this deployment does not answer on", async () => {
    const response = await POST(post(initialize, { host: "attacker.example" }));

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("forbidden_host");
  });

  it("rejects a present but unapproved origin", async () => {
    const response = await POST(post(initialize, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
  });

  // Measured on the real bytes, not on a Content-Length the caller controls.
  it("rejects an oversized body before parsing it", async () => {
    const huge = { jsonrpc: "2.0", id: 1, method: "tools/list", params: { padding: "x".repeat(40 * 1024) } };
    const response = await POST(post(huge));

    expect(response.status).toBe(413);
  });

  it("answers 503 while paused, and says where the data still is", async () => {
    process.env.MCP_ENABLED = "false";
    try {
      const response = await POST(post(initialize));
      const body = await response.text();

      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("3600");
      // Pausing the endpoint must not imply the data is gone: static pages and
      // published files are untouched, and the message says so in both languages.
      expect(body).toContain("/downloads/data/");
      expect(body).toMatch(/[Ⴀ-ჿ]/);
    } finally {
      process.env.MCP_ENABLED = "true";
    }
  });

  // Spec 11.3: a counter failure stops expensive processing with a retryable
  // service error. It must never quietly disable the limit and serve on.
  it("fails closed when no shared limiter is configured", async () => {
    // A fresh module instance, so its lazily built counter reads this config.
    process.env.MCP_RATE_LIMITER = "";
    vi.resetModules();
    try {
      const { POST: freshPost } = await import("../../app/mcp/route");
      const response = await freshPost(post(initialize));

      expect(response.status).toBe(503);
      expect(await response.text()).toContain("service_unavailable");
    } finally {
      process.env.MCP_RATE_LIMITER = "memory";
      vi.resetModules();
    }
  });

  it("denies once a client's rolling-minute allowance is spent", async () => {
    process.env.MCP_RATE_LIMITER = "memory";
    vi.resetModules();
    try {
      const { POST: freshPost } = await import("../../app/mcp/route");
      // A trusted platform header, so the request is keyed and the per-key
      // limit applies. A client-supplied X-Forwarded-For would not count.
      const keyed = () => post(initialize, { "x-vercel-forwarded-for": "203.0.113.7" });

      let last = await freshPost(keyed());
      for (let i = 0; i < 61 && last.status !== 429; i += 1) last = await freshPost(keyed());

      expect(last.status).toBe(429);
      expect(last.headers.get("retry-after")).toBe("60");
    } finally {
      vi.resetModules();
    }
  });
});
