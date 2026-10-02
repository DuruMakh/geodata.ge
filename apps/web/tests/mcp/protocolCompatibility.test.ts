import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport as LegacyClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer as LegacyServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport as LegacyServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { POST, GET, DELETE, OPTIONS } from "../../app/mcp/route";
import { TOOLS } from "../../lib/mcp/tools";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { boundedToolResult, LIMITS } from "../../lib/mcp/result";
import { outputSchemaFor } from "../../lib/mcp/outputSchema";
import { httpBridge } from "./httpBridge";

const original = { ...process.env };
beforeAll(() => {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => { process.env = { ...original }; vi.restoreAllMocks(); });

const VERSION = "2026-07-28";
function modernRequest(method = "server/discover", params: Record<string, unknown> = {}, id: number | string = 41): Request {
  return new Request("https://fiscal.ge/mcp", {
    method: "POST",
    headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": VERSION, "mcp-method": method, ...(typeof params.name === "string" ? { "mcp-name": params.name } : {}), "x-vercel-forwarded-for": `test-${id}` },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params: { ...params, _meta: {
      "io.modelcontextprotocol/protocolVersion": VERSION,
      "io.modelcontextprotocol/clientInfo": { name: "compatibility-test", version: "1" },
      "io.modelcontextprotocol/clientCapabilities": {},
    } } }),
  });
}
const CITY = { name: "query_inflation", arguments: { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" } };

it("serves complete modern discovery without initialization", async () => {
  const response = await POST(modernRequest());
  const discovery = await response.json();
  expect(response.status).toBe(200);
  expect(discovery.result.resultType).toBe("complete");
  expect(discovery.result._meta["io.modelcontextprotocol/serverInfo"].name).toBe("fiscal-ge");
  expect(discovery.result.supportedVersions).toEqual([VERSION]);
  expect(discovery.result.instructions).toContain("CC BY 4.0");
  expect(Object.keys(discovery.result.capabilities)).toEqual(["tools"]);
  expect(discovery.result.capabilities.tools.listChanged).toBe(false);
  expect(response.headers.get("mcp-session-id")).toBeNull();
});

it("pinned and automatic v2 clients and a real v1 client complete the same sourced city calls", async () => {
  const bridge = await httpBridge(async request => request.method === "POST" ? POST(request) : request.method === "DELETE" ? DELETE(request) : GET(request));
  const pinned = new Client({ name: "modern-pinned", version: "1" }, { versionNegotiation: { mode: { pin: VERSION } } });
  const automatic = new Client({ name: "modern-auto", version: "1" }, { versionNegotiation: { mode: "auto" } });
  const legacy = new LegacyClient({ name: "legacy-v1", version: "1" });
  try {
    await pinned.connect(new StreamableHTTPClientTransport(bridge.url));
    await automatic.connect(new StreamableHTTPClientTransport(bridge.url));
    await legacy.connect(new LegacyClientTransport(bridge.url));
    expect(pinned.getProtocolEra()).toBe("modern");
    expect(automatic.getProtocolEra()).toBe("modern");
    const order = (await legacy.listTools()).tools.map(tool => tool.name);
    expect(order).toEqual(["query_regional_economies", "query_economic_sectors", "query_gdp", "query_inflation", "query_inflation_products", "describe_coverage", "query_national", "query_ministries", "query_municipal", "query_debt", "query_deficit", "compare", "rank", "get_sources"]);
    for (const client of [pinned, automatic]) expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(order);
    await legacy.ping();
    const coverage = await legacy.callTool({ name: "describe_coverage", arguments: { datasetId: "inflation" } });
    expect(coverage.isError).toBeFalsy();
    for (const client of [pinned, automatic]) {
      expect((await client.callTool({ name: "describe_coverage", arguments: { datasetId: "inflation" } })).structuredContent).toEqual(coverage.structuredContent);
    }
    const modernCall = { result: await pinned.callTool(CITY) };
    const legacyCall = { result: await legacy.callTool(CITY) };
    expect(modernCall.result.structuredContent).toEqual(legacyCall.result.structuredContent);
    expect(modernCall.result.structuredContent).toMatchObject({ data: { observations: [{ entityId: "city.batumi", value: 7.0857 }] } });
    for (const result of [modernCall.result, legacyCall.result]) {
      expect(result.content).toContainEqual({ type: "text", text: expect.stringContaining('availablePeriods ["2016-01","2026-08"]') });
      expect(result.content).toContainEqual({ type: "text", text: expect.stringContaining('availableYears [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]') });
    }
    expect((await automatic.callTool(CITY)).structuredContent).toEqual(legacyCall.result.structuredContent);
    const sourceIds = (modernCall.result.structuredContent as { meta: { sources: { sourceId: string }[] } }).meta.sources.map(source => source.sourceId);
    expect(sourceIds.length).toBeGreaterThan(0);
    const sources = { name: "get_sources", arguments: { sourceIds } };
    const legacySources = await legacy.callTool(sources);
    expect(legacySources.isError).toBeFalsy();
    expect((await pinned.callTool(sources)).structuredContent).toEqual(legacySources.structuredContent);
    expect((await automatic.callTool(sources)).structuredContent).toEqual(legacySources.structuredContent);
    const missing = await pinned.callTool({ name: "query_inflation", arguments: { entityIds: ["city.zugdidi"], seriesIds: ["cpi.headline"], measure: "avg12_pct", fromPeriod: "2016-06", toPeriod: "2016-06" } });
    expect(missing.structuredContent).toMatchObject({ data: { observations: [{ value: null }] } });
  } finally { await pinned.close(); await automatic.close(); await legacy.close(); await bridge.close(); }
});

it("real v1/v2 clients cache product schemas then accept equal values, complete catalogues and bounded rankings", async () => {
  const wires: { era: string; bytes: number; body: { result?: { resultType?: string; _meta?: unknown; isError?: boolean } } }[] = [];
  const bridge = await httpBridge(async request => {
    const parsed = await request.clone().json();
    const response = await POST(request);
    if (parsed.method === "tools/call") {
      const payload = await response.clone().text();
      wires.push({ era: request.headers.get("mcp-protocol-version") ?? "legacy", bytes: Buffer.byteLength(payload), body: JSON.parse(payload) });
    }
    return response;
  });
  const modern = new Client({ name: "product-modern", version: "1" }, { versionNegotiation: { mode: { pin: VERSION } } });
  const legacy = new LegacyClient({ name: "product-legacy", version: "1" });
  const calls = [
    { name: "query_inflation_products", arguments: { seriesIds: ["cpi.product.p0001"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" } },
    { name: "query_inflation_products", arguments: { seriesIds: ["cpi.product.p0001"], measure: "cumulative_pct", startYear: 2025, fromPeriod: "2025-12", toPeriod: "2025-12" } },
    { name: "describe_coverage", arguments: { datasetId: "inflation-products" } },
    { name: "rank", arguments: { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "yoy_pct", period: "2026-08", limit: 100 } },
    { name: "rank", arguments: { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "cumulative_pct", startYear: 2015, period: "2026-08", limit: 100 } },
    { name: "query_inflation_products", arguments: { seriesIds: ["cpi.product.p0089"], measure: "yoy_pct", fromPeriod: "2019-01", toPeriod: "2019-01" } },
  ];
  try {
    await modern.connect(new StreamableHTTPClientTransport(bridge.url));
    await legacy.connect(new LegacyClientTransport(bridge.url));
    const legacyTools = (await legacy.listTools()).tools;
    const modernTools = (await modern.listTools()).tools;
    const product = legacyTools.find(tool => tool.name === "query_inflation_products");
    expect(product).toBeDefined();
    expect(product!.inputSchema).toEqual(modernTools.find(tool => tool.name === product!.name)!.inputSchema);
    expect(product!.outputSchema).toEqual(modernTools.find(tool => tool.name === product!.name)!.outputSchema);
    // listTools installs each client's output validator; these calls exercise it.
    for (const [index, call] of calls.entries()) {
      const old = await legacy.callTool(call);
      const current = await modern.callTool(call);
      expect(old.isError).toBeFalsy();
      expect(current.isError).toBeFalsy();
      expect(current.structuredContent).toEqual(old.structuredContent);
      expect(outputSchemaFor(call.name).parse(current.structuredContent)).toEqual(current.structuredContent);
      if (index === 0) expect(current.structuredContent).toMatchObject({ data: { observations: [{ value: 1.8973 }] } });
      if (index === 1) expect(current.structuredContent).toMatchObject({ data: { observations: [{ calculationBasePeriod: "2024-12" }] } });
      if (index === 2) expect((current.structuredContent as { data: { series: unknown[] } }).data.series).toHaveLength(305);
      if (index === 4) expect(current.structuredContent).toMatchObject({ data: { universe: { candidateCount: 305, eligibleCount: 287, returnedCount: 100 } } });
      if (index === 5) expect(current.structuredContent).toMatchObject({ status: "empty", data: { observations: [{ value: null }] } });
    }
    expect(wires).toHaveLength(calls.length * 2);
    for (const wire of wires) {
      expect(wire.body.result?.isError).toBeFalsy();
      expect(LIMITS.resultBytes - wire.bytes).toBeGreaterThan(0);
      if (wire.era === VERSION) {
        expect(wire.body.result?.resultType).toBe("complete");
        expect(wire.body.result?._meta).toBeDefined();
      }
    }
  } finally { await modern.close(); await legacy.close(); await bridge.close(); }
});

it("a v2 automatic client genuinely falls back to a legacy-only v1 server", async () => {
  const methods: string[] = [];
  const bridge = await httpBridge(async request => {
    if (request.method !== "POST") return GET(request);
    const parsedBody = await request.clone().json();
    methods.push(parsedBody.method);
    const server = new LegacyServer({ name: "legacy-only-fixture", version: "1" });
    const snapshot = loadPackagedSnapshot();
    for (const name of ["query_inflation", "get_sources"]) {
      const tool = TOOLS.find(tool => tool.name === name)!;
      server.registerTool(name, { inputSchema: tool.schema }, args => boundedToolResult(snapshot, tool.run(snapshot, args)));
    }
    const transport = new LegacyServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try { await server.connect(transport); return await transport.handleRequest(request, { parsedBody }); }
    finally { await server.close(); }
  });
  const client = new Client({ name: "fallback-test", version: "1" }, { versionNegotiation: { mode: "auto" } });
  try {
    await client.connect(new StreamableHTTPClientTransport(bridge.url));
    expect(client.getProtocolEra()).toBe("legacy");
    expect(methods.slice(0, 2)).toEqual(["server/discover", "initialize"]);
    expect((await client.callTool(CITY)).structuredContent).toMatchObject({ data: { observations: [{ value: 7.0857 }] } });
  } finally { await client.close(); await bridge.close(); }
});

describe("wire validation and finite exchanges", () => {
  it("refuses modern subscriptions promptly without opening a stream", async () => {
    const request = modernRequest("subscriptions/listen", { notifications: { toolsListChanged: true } }, "no-subscriptions");
    const response = await POST(new Request(request, { signal: AbortSignal.timeout(250) }));
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(body.id).toBe("no-subscriptions");
    expect(body.error).toBeDefined();
  });
  it.each(["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"])("preserves legacy revision %s", async protocolVersion => {
    const request = new Request("https://fiscal.ge/mcp", {
      method: "POST", headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream", "x-vercel-forwarded-for": protocolVersion },
      body: JSON.stringify({ jsonrpc: "2.0", id: 52, method: "initialize", params: { protocolVersion, capabilities: {}, clientInfo: { name: "prior-legacy", version: "1" } } }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("mcp-session-id")).toBeNull();
    expect((await response.json()).result.protocolVersion).toBe(protocolVersion);
  });

  it.each(["2026-07-28", "2099-01-01"])("never counteroffers a modern revision through legacy initialize (%s)", async protocolVersion => {
    const response = await POST(new Request("https://fiscal.ge/mcp", {
      method: "POST", headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 53, method: "initialize", params: { protocolVersion, capabilities: {}, clientInfo: { name: "legacy-counteroffer", version: "1" } } }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).result.protocolVersion).toBe("2025-11-25");
  });

  it("acknowledges initialized notification without parsing an empty body, and refuses GET/DELETE", async () => {
    const response = await POST(new Request("https://fiscal.ge/mcp", {
      method: "POST", headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }));
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
    const getRequest = new Request("https://fiscal.ge/mcp", { headers: { accept: "text/event-stream" } });
    const deleteRequest = new Request("https://fiscal.ge/mcp", { method: "DELETE" });
    expect((await GET(getRequest)).status).toBe(405);
    expect((await DELETE(deleteRequest)).status).toBe(405);
  });

  it.each([
    ["missing protocol header", "mcp-protocol-version", null],
    ["missing method header", "mcp-method", null],
    ["mismatched protocol header", "mcp-protocol-version", "2025-11-25"],
    ["mismatched method header", "mcp-method", "tools/list"],
    ["missing tool name header", "mcp-name", null],
    ["mismatched tool name header", "mcp-name", "query_gdp"],
  ])("rejects %s with the original request ID", async (_label, header, value) => {
    const request = modernRequest("tools/call", CITY, "validation-id");
    if (value === null) request.headers.delete(header!); else request.headers.set(header!, value!);
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.id).toBe("validation-id");
    expect(body.error.code).toBe(-32020);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([undefined, {}, { "io.modelcontextprotocol/protocolVersion": 17 }])("rejects missing or invalid modern metadata (%#)", async meta => {
    const request = modernRequest("tools/list", {}, "meta-id");
    const body = await request.json();
    body.params._meta = meta;
    const response = await POST(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) }));
    expect(response.status).toBe(400);
    expect((await response.json()).id).toBe("meta-id");
  });

  it.each([
    ["io.modelcontextprotocol/clientCapabilities", undefined],
    ["io.modelcontextprotocol/clientCapabilities", false],
    ["io.modelcontextprotocol/clientInfo", false],
  ])("uses SDK validation for malformed %s (%#)", async (key, value) => {
    const request = modernRequest("tools/list", {}, "bad-meta-field");
    const body = await request.json();
    body.params._meta[key as string] = value;
    const response = await POST(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) }));
    expect(response.status).toBe(400);
    expect((await response.json()).id).toBe("bad-meta-field");
  });

  it("follows the SDK's optional client identity contract", async () => {
    const request = modernRequest("tools/list", {}, "optional-identity");
    const body = await request.json();
    delete body.params._meta["io.modelcontextprotocol/clientInfo"];
    const response = await POST(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) }));
    expect(response.status).toBe(200);
    expect((await response.json()).result.resultType).toBe("complete");
  });

  it("returns modern unsupported-version data and method-not-found status", async () => {
    const request = modernRequest("tools/list", {}, "version-id");
    const body = await request.json();
    body.params._meta["io.modelcontextprotocol/protocolVersion"] = "2026-12-31";
    request.headers.set("mcp-protocol-version", "2026-12-31");
    const response = await POST(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ id: "version-id", error: { code: -32022, data: { supported: [VERSION], requested: "2026-12-31" } } });
    const unknown = await POST(modernRequest("unknown/method", {}, "method-id"));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ id: "method-id", error: { code: -32601 } });
  });

  it("allows required modern browser headers only for an approved origin", () => {
    process.env.MCP_ALLOWED_ORIGINS = "https://approved.example";
    try {
      const response = OPTIONS(new Request("https://fiscal.ge/mcp", { method: "OPTIONS", headers: { host: "fiscal.ge", origin: "https://approved.example" } }));
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-headers")?.split(", ")).toEqual(["content-type", "accept", "mcp-protocol-version", "mcp-session-id", "mcp-method", "mcp-name"]);
    } finally { delete process.env.MCP_ALLOWED_ORIGINS; }
  });
});

describe("modern operational guards and private logs", () => {
  it.each(["host", "origin", "paused", "malformed", "oversized"])("preserves the %s guard for modern discovery", async guard => {
    let request = modernRequest("server/discover", {}, `guard-${guard}`);
    const expected = { host: 403, origin: 403, paused: 503, malformed: 400, oversized: 413 }[guard];
    if (guard === "host") request.headers.set("host", "evil.example");
    if (guard === "origin") request.headers.set("origin", "https://evil.example");
    if (guard === "paused") process.env.MCP_ENABLED = "false";
    if (guard === "malformed" || guard === "oversized") request = new Request(request.url, { method: "POST", headers: request.headers, body: guard === "malformed" ? "{" : "x".repeat(32 * 1024 + 1) });
    try {
      const response = await POST(request);
      expect(response.status).toBe(expected);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("mcp-session-id")).toBeNull();
      expect((await response.text()).length).toBeLessThan(2048);
    } finally { process.env.MCP_ENABLED = "true"; }
  });

  it("logs discovery and modern tool failures without client metadata or arguments", async () => {
    const logs: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation(chunk => { logs.push(String(chunk)); return true; });
    await POST(modernRequest());
    expect(JSON.parse(logs.at(-1)!).tool).toBe("server/discover");
    const request = modernRequest("tools/call", { name: "query_national", arguments: { side: "expenditure", years: [2025], seriesIds: ["private-invalid-series"], measure: "amount_gel" } });
    const response = await POST(request);
    const body = await response.json();
    expect(body.result.resultType).toBe("complete");
    expect(body.result.isError).toBe(true);
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({ tool: "query_national", outcome: "error", errorCode: "unknown_series" });
    expect(logs.join("")).not.toContain("compatibility-test");
    expect(logs.join("")).not.toContain("private-invalid-series");
    expect(logs.join("")).not.toContain("clientCapabilities");
  });
});
