import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST, OPTIONS, GET, DELETE } from "../../app/mcp/route";
import { LIMITS } from "../../lib/mcp/limits";

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

  it("lists every tool", async () => {
    const body = await jsonOf(
      await POST(post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, { "mcp-protocol-version": PROTOCOL })),
    );
    const tools = (body as unknown as { result: { tools: { name: string }[] } }).result.tools;

    expect(tools).toHaveLength(11);
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
    const response = GET(new Request(ENDPOINT, { method: "GET" }));

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("content-type")).toContain("application/json");
    // Not a stream: the body is finite and readable in one go.
    expect(await response.text()).toContain("POST only");
  });

  it("refuses a session DELETE, having no sessions", () => {
    expect(DELETE(new Request(ENDPOINT, { method: "DELETE" })).status).toBe(405);
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

describe("what the log is allowed to say", () => {
  /** Re-spies the silenced writer so a test can read the records back. */
  function captureLogs(): string[] {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    return written;
  }

  it("names a real tool, and counts an unrecognised one without quoting it", async () => {
    const logs = captureLogs();
    // A caller controls this string completely, and may send 32 KiB of it
    // sixty times a minute. Section 11.5 permits a tool name and validated
    // stable IDs; it forbids invalid parameter strings.
    const injected = "totally-made-up-".repeat(40);
    await POST(
      post(
        { jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: injected, arguments: {} } },
        { "mcp-protocol-version": PROTOCOL },
      ),
    );

    expect(JSON.parse(logs.at(-1)!).tool).toBe("unknown_tool");
    expect(logs.join("")).not.toContain(injected);
  });

  it("names an unrecognised protocol method without quoting it either", async () => {
    const logs = captureLogs();
    await POST(post({ jsonrpc: "2.0", id: 21, method: "nonsense/method", params: {} }, { "mcp-protocol-version": PROTOCOL }));

    expect(JSON.parse(logs.at(-1)!).tool).toBe("unknown_method");
    expect(logs.join("")).not.toContain("nonsense/method");
  });

  it("records a genuine tool call under its own name", async () => {
    const logs = captureLogs();
    await POST(
      post(
        { jsonrpc: "2.0", id: 22, method: "tools/call", params: { name: "describe_coverage", arguments: {} } },
        { "mcp-protocol-version": PROTOCOL },
      ),
    );

    expect(JSON.parse(logs.at(-1)!).tool).toBe("describe_coverage");
  });

  it("measures the reply it actually returned, and omits a count it does not have", async () => {
    const logs = captureLogs();
    await POST(post(initialize));
    const record = JSON.parse(logs.at(-1)!);

    // The transport builds its reply with `new Response(string)`, which sets no
    // content-length; reading that header recorded a confident zero forever.
    expect(record.resultBytes).toBeGreaterThan(0);
    // Absent, rather than a placeholder that reads as "this answer had no rows".
    expect(record.resultCount).toBeUndefined();
  });
});

describe("cross-origin access", () => {
  const preflightRequest = (origin: string): Request =>
    new Request(ENDPOINT, { method: "OPTIONS", headers: { host: "fiscal.ge", origin } });

  it("answers the preflight a browser must send before it may POST at all", () => {
    process.env.MCP_ALLOWED_ORIGINS = "https://studio.example";
    try {
      const response = OPTIONS(preflightRequest("https://studio.example"));

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("https://studio.example");
      expect(response.headers.get("access-control-allow-methods")).toContain("POST");
      expect(response.headers.get("access-control-allow-headers")).toContain("content-type");
    } finally {
      delete process.env.MCP_ALLOWED_ORIGINS;
    }
  });

  it("refuses the preflight from an origin this deployment does not approve", () => {
    const response = OPTIONS(preflightRequest("https://evil.example"));

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("echoes an approved origin exactly, never a wildcard", async () => {
    process.env.MCP_ALLOWED_ORIGINS = "https://studio.example";
    try {
      const response = await POST(post(initialize, { origin: "https://studio.example" }));

      expect(response.headers.get("access-control-allow-origin")).toBe("https://studio.example");
    } finally {
      delete process.env.MCP_ALLOWED_ORIGINS;
    }
  });

  it("varies on origin even when none was sent, so no cache crosses the answers over", async () => {
    const response = await POST(post(initialize));

    expect(response.headers.get("vary")).toContain("origin");
  });
});

describe("refusing without leaking", () => {
  it("rejects an oversized request on its declared length, before reading the body", async () => {
    const response = await POST(
      new Request(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          host: "fiscal.ge",
          "content-length": String(LIMITS.bodyBytes + 1),
        },
        body: JSON.stringify(initialize),
      }),
    );

    expect(response.status).toBe(413);
    // Distinct from `result_too_large`: the remedies are opposite, so a client
    // branching on the code must be able to tell "your request was too big"
    // from "the answer was too big".
    expect(await response.text()).toContain("request_too_large");
  });

  it("names no environment value, absolute path or stack frame in any rejection", async () => {
    process.env.SECRET_TEST_VALUE = "super-secret-value";
    try {
      const rejections = [
        await POST(post(initialize, { host: "attacker.example" })),
        await POST(post(initialize, { origin: "https://evil.example" })),
        await POST(post("{not json", { "mcp-protocol-version": PROTOCOL })),
        await POST(post({ padding: "x".repeat(LIMITS.bodyBytes + 1) })),
        GET(new Request(ENDPOINT, { method: "GET" })),
        DELETE(new Request(ENDPOINT, { method: "DELETE" })),
      ];

      for (const response of rejections) {
        const body = await response.text();

        expect(body).not.toContain("super-secret-value");
        expect(body).not.toContain("SECRET_TEST_VALUE");
        expect(body).not.toMatch(/[A-Za-z]:\|\/home\/|\/var\/task|node_modules/);
        expect(body).not.toMatch(/\n\s+at /);
      }
    } finally {
      delete process.env.SECRET_TEST_VALUE;
    }
  });
});
