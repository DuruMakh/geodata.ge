import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { POST, GET, DELETE } from "../../app/mcp/route";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { httpBridge } from "../mcp/httpBridge";
import type { SmokeReport } from "../../scripts/smoke-mcp";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const original = { ...process.env };
beforeAll(() => {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterAll(() => { process.env = { ...original }; vi.restoreAllMocks(); });

// Independent release inventory: removing execution while retaining discovery must fail.
const required = ["query_regional_economies", "query_economic_sectors", "query_gdp", "query_inflation", "query_inflation_products", "describe_coverage", "query_national", "query_ministries", "query_municipal", "query_debt", "query_deficit", "compare", "rank", "get_sources"];
const snapshot = loadPackagedSnapshot();
const identities = { expectedSchema: "1.7.0", expectedDataVersion: snapshot.dataVersion };
let key = 0;
async function route(request: Request) {
  const headers = new Headers(request.headers);
  headers.set("host", "fiscal.ge");
  headers.set("x-vercel-forwarded-for", `smoke-fixture-${key++}`);
  const input = new Request(request, { headers });
  return input.method === "POST" ? POST(input) : input.method === "DELETE" ? DELETE(input) : GET(input);
}
const localFetch: typeof fetch = async (input, init) => route(new Request(input, init));

it("executes every advertised required tool", async () => {
  const { main } = await import("../../scripts/smoke-mcp");
  const warning = console.warn;
  const exchanges: string[] = [];
  const bridge = await httpBridge(async request => {
    exchanges.push(request.method === "POST" ? (await request.clone().json()).method : request.method);
    return route(request);
  });
  try {
    const outputs: string[] = [];
    const signals: AbortSignal[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => { signals.push(init!.signal!); return globalThis.fetch(input, init); };
    const exit = await main(["--url", bridge.url.href, "--expected-schema", "1.7.0", "--expected-data-version", snapshot.dataVersion, "--output", "ignored.json"], { fetch, paceMs: 0, write: text => { outputs.push(text); } });
    const report = JSON.parse(outputs[0]!) as SmokeReport;
    expect(exit, JSON.stringify(report)).toBe(0);
    expect(report.ok, JSON.stringify(report)).toBe(true);
    expect(report.tools.filter(tool => tool.ok).map(tool => tool.name).sort()).toEqual([...required].sort());
    expect(report.clients).toEqual([
      { era: "pinned-modern", ok: true, staleVersionRefused: true },
      { era: "automatic-modern", ok: true, staleVersionRefused: true },
      { era: "legacy", ok: true, staleVersionRefused: true },
    ]);
    const httpRequestCount = exchanges.length;
    expect(httpRequestCount).toBeLessThanOrEqual(30);
    expect(httpRequestCount).toBe(29);
    expect(report.httpRequestCount).toBe(httpRequestCount);
    expect(exchanges.filter(method => method === "tools/call")).toHaveLength(21);
    expect(exchanges).toContain("notifications/initialized");
    expect(exchanges).toContain("GET");
    expect(exchanges).not.toContain("DELETE");
    expect(signals).toHaveLength(29);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(console.warn).toBe(warning);
  } finally { await bridge.close(); }
});

it("fails on an HTTP 200 tool error", async () => {
  const { main } = await import("../../scripts/smoke-mcp");
  const privateText = "synthetic-secret-provider-body";
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const body = await request.clone().json();
    if (body.method === "tools/call") {
      const payload = await (await route(request)).json();
      delete payload.result.structuredContent;
      payload.result.isError = true;
      payload.result.content = [{ type: "text", text: privateText }];
      return Response.json(payload);
    }
    return route(request);
  };
  const outputs: string[] = [];
  const code = await main(["--url", "https://fiscal.ge/mcp", "--expected-schema", "1.7.0", "--expected-data-version", snapshot.dataVersion, "--output", "ignored.json"], { fetch, paceMs: 0, write: text => { outputs.push(text); } });
  expect(code).toBe(1);
  const report = JSON.parse(outputs[0]!);
  expect(report.failure).toBe("tool_error");
  expect(report.tools[0]).toMatchObject({ ok: false });
  expect(outputs.join("")).not.toContain(privateText);
  expect(outputs.join("")).not.toContain("https://");
});

it("stops at the request ceiling", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  let httpRequestCount = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    httpRequestCount++;
    const request = new Request(input, init);
    const body = await request.clone().json();
    const response = await route(request);
    if (body.method !== "tools/list") return response;
    const payload = await response.json();
    payload.result.nextCursor = `page-${httpRequestCount}`;
    return Response.json(payload);
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.ok).toBe(false);
  expect(report.failure).toBe("request_budget_exhausted");
  expect(httpRequestCount).toBe(30);
  expect(httpRequestCount).toBeLessThanOrEqual(30);
  expect(report.httpRequestCount).toBe(httpRequestCount);
});

it.each([
  [{ ...identities, expectedSchema: "9.9.9" }, "schema_mismatch"],
  [{ ...identities, expectedDataVersion: "0".repeat(64) }, "data_version_mismatch"],
] as const)("rejects wrong release identity %#", async (expected, failure) => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...expected }, { fetch: localFetch, paceMs: 0 });
  expect(report.ok).toBe(false);
  expect(report.failure).toBe(failure);
});

it.each(["not-json", "missing-output", "wrong-unit", "wrong-city", "missing-tool", "wrong-source", "invalid-coverage"])("rejects malformed release evidence: %s", async mode => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const call = await request.clone().json();
    const response = await route(request);
    const payload = await response.json();
    if (mode === "missing-tool" && call.method === "tools/list") payload.result.tools.pop();
    if (call.method === "tools/call") {
      if (mode === "not-json") return new Response("secret-invalid-json");
      if (mode === "missing-output") delete payload.result.structuredContent;
      if (mode === "wrong-unit" && call.params.name === "rank") payload.result.structuredContent.data.entries[0].unit = "percent";
      if (mode === "wrong-city" && call.params.name === "query_inflation") payload.result.structuredContent.data.observations[0].value = 123;
      if (mode === "invalid-coverage" && call.params.name === "query_inflation") payload.result.structuredContent.data.coverage.availablePeriods[1] = "2026-07";
      if (mode === "wrong-source" && call.params.name === "get_sources") payload.result.structuredContent.data.sources[0].sourceId = "source.unrelated";
    }
    return Response.json(payload);
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.ok).toBe(false);
  expect(JSON.stringify(report)).not.toContain("secret-invalid-json");
  if (mode === "wrong-source") expect(report.tools.find(tool => tool.name === "get_sources")?.ok).toBe(false);
});

it.each([429, 503])("stops immediately on %s without leaking the body", async status => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  let calls = 0;
  const fetch: typeof globalThis.fetch = async () => { calls++; return new Response("synthetic-private-text", { status, headers: { "retry-after": "60" } }); };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.ok).toBe(false);
  expect(report.httpRequestCount).toBe(1);
  expect(calls).toBe(1);
  expect(report.requests[0]).toMatchObject({ status, retryAfterSeconds: 60 });
  expect(JSON.stringify(report)).not.toContain("synthetic-private-text");
});

it("preserves an early refusal when body cancellation stalls", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const fetch: typeof globalThis.fetch = async () => new Response(new ReadableStream({ cancel: () => new Promise(() => {}) }), { status: 429 });
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0, timeoutMs: 25 });
  expect(report.failure).toBe("rate_limited");
  expect(report.httpRequestCount).toBe(1);
});

it.each(["headers", "body"])("deadlines include stalled %s and cancel teardown", async mode => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  let aborted = false;
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    init!.signal!.addEventListener("abort", () => { aborted = true; });
    if (mode === "headers") return new Promise(() => {});
    return new Response(new ReadableStream({ start() {} }));
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0, timeoutMs: 25 });
  expect(report.failure).toBe("timeout");
  expect(report.httpRequestCount).toBe(1);
  expect(aborted).toBe(true);
});

it("refuses redirects without a second network request", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  let calls = 0;
  const fetch: typeof globalThis.fetch = async (_input, init) => { calls++; expect(init!.redirect).toBe("error"); return new Response(null, { status: 302, headers: { location: "https://secret.example/" } }); };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.failure).toBe("redirect");
  expect(calls).toBe(1);
});

it("rejects oversized response bodies and cancels the stream", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  let cancelled = false;
  const fetch: typeof globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(512 * 1024 + 1)); }, cancel() { cancelled = true; } }));
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.failure).toBe("response_too_large");
  expect(cancelled).toBe(true);
});

it("fails if a stale-version call unexpectedly succeeds", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const call = await request.clone().json();
    if (call.params?.arguments?.expectedDataVersion) delete call.params.arguments.expectedDataVersion;
    return route(new Request(request, { body: JSON.stringify(call) }));
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.failure).toBe("stale_version_not_refused");
});

it("fails on valid source-output differences between client eras", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  let sourceCalls = 0;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const call = await request.clone().json();
    const response = await route(request);
    if (call.params?.name !== "get_sources" || ++sourceCalls === 1) return response;
    const payload = await response.json();
    payload.result.structuredContent.data.sources[0].lastReviewedAt = "2000-01-01";
    return Response.json(payload);
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.failure).toBe("parity_mismatch");
});

it("paces every network request and releases client abort signals", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const starts: number[] = [];
  const signals: AbortSignal[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    starts.push(performance.now());
    signals.push(init!.signal!);
    if (starts.length === 3) return new Response(null, { status: 503 });
    return localFetch(input, init);
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 20 });
  expect(report.failure).toBe("service_unavailable");
  expect(starts).toHaveLength(3);
  for (let index = 1; index < starts.length; index++) expect(starts[index]! - starts[index - 1]!).toBeGreaterThanOrEqual(18);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});

it("stops queued legacy calls when its implicit GET is unavailable", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  let callsAfterGet = 0;
  let getFailed = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (getFailed) callsAfterGet++;
    if (init?.method === "GET") { getFailed = true; return new Response(null, { status: 503 }); }
    return localFetch(input, init);
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.failure).toBe("service_unavailable");
  expect(getFailed).toBe(true);
  expect(callsAfterGet).toBe(0);
});

it("does not expose a thrown fetch error", async () => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const fetch: typeof globalThis.fetch = async () => { throw new Error("synthetic-private-network-token"); };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.failure).toBe("protocol_error");
  expect(JSON.stringify(report)).not.toContain("synthetic-private");
});

it.each(["http://remote.example/mcp", "https://user:secret@fiscal.ge/mcp", "https://fiscal.ge/mcp?token=secret", "https://fiscal.ge/mcp#secret"])("rejects unsafe targets before fetching: %s", async url => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const fetch: typeof globalThis.fetch = async () => { throw new Error("should never fetch"); };
  const report = await runSmoke({ url, ...identities }, { fetch, paceMs: 0 });
  expect(report.failure).toBe("invalid_arguments");
  expect(report.httpRequestCount).toBe(0);
});

it("runs as an operator CLI and returns safe nonzero argument failure", () => {
  const cli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [cli, "scripts/smoke-mcp.ts"], { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 });
  expect(result.status).toBe(1);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, failure: "invalid_arguments", httpRequestCount: 0 });
});

it("contains untrusted SDK discovery warnings inside the operator process", async () => {
  const markers = ["synthetic-private-tool", "synthetic-private-field", "synthetic private header"];
  const directory = mkdtempSync(path.join(tmpdir(), "mcp-warning-"));
  const output = path.join(directory, "report.json");
  const bridge = await httpBridge(async request => {
    const call = request.method === "POST" ? await request.clone().json() : undefined;
    const response = await route(request);
    if (call?.method !== "tools/list") return response;
    const payload = await response.json();
    payload.result.tools[0].name = markers[0];
    payload.result.tools[0].inputSchema = { type: "object", properties: { [markers[1]!]: { type: "string", "x-mcp-header": markers[2] } } };
    return Response.json(payload);
  });
  try {
    const cli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const child = spawn(process.execPath, [cli, "scripts/smoke-mcp.ts", "--url", bridge.url.href, "--expected-schema", "1.7.0", "--expected-data-version", snapshot.dataVersion, "--output", output], { cwd: process.cwd(), timeout: 10_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    expect(code).toBe(1);
    const json = readFileSync(output, "utf8");
    for (const marker of markers) {
      expect(stderr).not.toContain(marker);
      expect(stdout).not.toContain(marker);
      expect(json).not.toContain(marker);
    }
    expect(stderr).toBe("");
    expect(stdout).toBe("");
    expect(JSON.parse(json)).toMatchObject({ ok: false, failure: "protocol_error", httpRequestCount: 2 });
  } finally {
    await bridge.close();
    if (existsSync(output)) unlinkSync(output);
    rmdirSync(directory);
  }
});

it.each(["invalid-json", "unsafe-schema"])("restores the warning handler after failed discovery: %s", async mode => {
  const { runSmoke } = await import("../../scripts/smoke-mcp");
  const warning = console.warn;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const call = await request.clone().json();
    if (call.method !== "tools/list") return route(request);
    if (mode === "invalid-json") return new Response("invalid-json");
    const payload = await (await route(request)).json();
    payload.result.tools[0].inputSchema = { type: "object", properties: { field: { type: "string", "x-mcp-header": "invalid header" } } };
    return Response.json(payload);
  };
  const report = await runSmoke({ url: "https://fiscal.ge/mcp", ...identities }, { fetch, paceMs: 0 });
  expect(report.ok).toBe(false);
  expect(console.warn).toBe(warning);
});
