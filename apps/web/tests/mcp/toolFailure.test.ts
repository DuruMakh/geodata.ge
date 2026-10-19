import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpServer } from "../../lib/mcp/tools";
import type { ToolResult } from "../../lib/mcp/result";
import { httpBridge } from "./httpBridge";

const fault = vi.hoisted(() => ({
  mode: "none",
  marker: "C:\\private\\synthetic-token-task4-secret.json",
  started: false,
  formattingCalls: 0,
  stages: [] as string[],
}));

vi.mock("../../lib/factQuery/queryNational", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/factQuery/queryNational")>();
  return { ...actual, queryNational: (...args: Parameters<typeof actual.queryNational>) => {
    fault.started = true;
    fault.stages.push("query");
    if (fault.mode === "query-error") throw new Error(fault.marker);
    if (fault.mode === "query-non-error") throw fault.marker;
    return actual.queryNational(...args);
  } };
});

vi.mock("../../lib/factQuery/queryInflation", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/factQuery/queryInflation")>();
  return { ...actual, inflationCellCount: (...args: Parameters<typeof actual.inflationCellCount>) => {
    if (fault.mode === "cell-count") {
      fault.stages.push("cell-count");
      throw new Error(fault.marker);
    }
    return actual.inflationCellCount(...args);
  } };
});

vi.mock("../../lib/factQuery/localization", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/factQuery/localization")>();
  return { ...actual, serviceMessage: (...args: Parameters<typeof actual.serviceMessage>) => {
    if (fault.mode === "prepare" || (fault.mode === "localization" && fault.started)) {
      fault.formattingCalls++;
      throw new Error(fault.marker);
    }
    return actual.serviceMessage(...args);
  } };
});

vi.mock("../../lib/mcp/result", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/mcp/result")>();
  return { ...actual, tooLargeResponse: (...args: Parameters<typeof actual.tooLargeResponse>) => {
    if (fault.mode === "pre-limit") {
      fault.stages.push("pre-limit");
      throw new Error(fault.marker);
    }
    return actual.tooLargeResponse(...args);
  }, boundedToolResult: (...args: Parameters<typeof actual.boundedToolResult>) => {
    fault.stages.push("shape");
    if (fault.mode === "shaping") {
      fault.formattingCalls++;
      throw new Error(fault.marker);
    }
    const result = actual.boundedToolResult(...args);
    if (fault.mode === "missing-content") delete result.structuredContent;
    if (fault.mode === "invalid-output") result.structuredContent!.kind = fault.marker;
    return result;
  } };
});

vi.mock("../../lib/mcp/outputSchema", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/mcp/outputSchema")>();
  return { ...actual, outputSchemaFor: (name: string) => {
    const schema = actual.outputSchemaFor(name);
    // Replace only the underlying public Standard Schema validator. Registration,
    // callback execution and the SDK's subsequent validation remain real.
    return new Proxy(schema, { get(target, property, receiver) {
      if (property !== "~standard") return Reflect.get(target, property, receiver);
      const standard = target["~standard"];
      return { ...standard, validate: (value: unknown) => {
        fault.stages.push("validate");
        if (fault.mode === "validator-issues") return { issues: [{ message: fault.marker }] };
        if (fault.mode === "validator-throw") throw new Error(fault.marker);
        if (fault.mode === "validator-non-error") throw fault.marker;
        if (fault.mode === "validator-reject") return Promise.reject(new Error(fault.marker));
        if (fault.mode === "validator-async-issues") return Promise.resolve({ issues: [{ message: fault.marker }] });
        const result = standard.validate(value);
        return fault.mode === "validator-async-valid" ? Promise.resolve(result) : result;
      } };
    } });
  } };
});

import { POST } from "../../app/mcp/route";

const original = { ...process.env };
const logs: string[] = [];
let bridge: Awaited<ReturnType<typeof httpBridge>>;
let requestNumber = 0;

beforeAll(async () => {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  vi.spyOn(process.stdout, "write").mockImplementation(chunk => { logs.push(String(chunk)); return true; });
  bridge = await httpBridge(POST);
});
beforeEach(() => {
  fault.started = false;
  fault.formattingCalls = 0;
  fault.stages.length = 0;
  logs.length = 0;
});
afterEach(() => { fault.mode = "none"; });
afterAll(async () => {
  await bridge.close();
  process.env = { ...original };
  vi.restoreAllMocks();
});

const valid = { side: "expenditure", seriesIds: ["expenditure.total"], years: [2024], measure: "amount_gel" };

describe.each(["2025-11-25", "2026-07-28"])("%s transport failures", protocol => {
  async function call(args: unknown = valid) {
    const id = `task4-${++requestNumber}`;
    const modern = protocol === "2026-07-28";
    const name = fault.mode === "cell-count" ? "query_inflation" : "query_national";
    const response = await fetch(bridge.url, {
      method: "POST",
      headers: {
        "content-type": "application/json", accept: "application/json, text/event-stream",
        "mcp-protocol-version": protocol, "x-vercel-forwarded-for": id,
        ...(modern ? { "mcp-method": "tools/call", "mcp-name": name } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: {
        name, arguments: args,
        ...(modern ? { _meta: {
          "io.modelcontextprotocol/protocolVersion": protocol,
          "io.modelcontextprotocol/clientInfo": { name: "task4-faults", version: "1" },
          "io.modelcontextprotocol/clientCapabilities": {},
        } } : {}),
      } }),
    });
    const wireText = await response.text();
    const body = JSON.parse(wireText);
    expect(body.id).toBe(id);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    return { response, wireText, body };
  }

  describe.each([
    "cell-count", "pre-limit", "query-error", "query-non-error", "shaping", "localization", "missing-content", "invalid-output",
    "validator-issues", "validator-throw", "validator-non-error", "validator-reject", "validator-async-issues",
  ])("%s", mode => {
    it("sanitizes unexpected failure at the actual transport boundary", async () => {
      fault.mode = mode;
      const args = mode === "localization" ? { ...valid, seriesIds: ["unknown"] }
        : mode === "cell-count" ? { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }
        : mode === "pre-limit" ? { ...valid, seriesIds: Array.from({ length: 30 }, (_, i) => `series.${i}`), years: Array.from({ length: 20 }, (_, i) => i + 2004) }
        : valid;
      const { response, wireText, body } = await call(args);
      const result = body.result;
      const syntheticFaultMarker = fault.marker;
      expect(response.status).toBe(200);
      expect(result.isError).toBe(true);
      expect(wireText).not.toContain(syntheticFaultMarker);
      expect(wireText).not.toContain("synthetic-token-task4");
      expect(result.structuredContent).toBeUndefined();
      expect(result.content[0].text).toContain("error internal_error");
      expect(result.content[0].text).toContain("retryable: true");
      expect(result.content[0].text).toContain("Try again later");
      expect(result.content[0].text).toContain("https://fiscal.ge/downloads/data/manifest.json");
      expect(result.content[0].text).toMatch(/[Ⴀ-ჿ]/);
      expect(logs).toHaveLength(1);
      expect(JSON.parse(logs[0]!)).toMatchObject({ outcome: "error", errorCode: "internal_error", tool: mode === "cell-count" ? "query_inflation" : "query_national" });
      expect(logs.join("")).not.toContain("synthetic-token-task4");
      if (protocol === "2026-07-28") {
        expect(result.resultType).toBe("complete");
        expect(result._meta["io.modelcontextprotocol/serverInfo"].name).toBe("fiscal-ge");
      }
      if (mode === "shaping" || mode === "localization") expect(fault.formattingCalls).toBe(1);
      if (mode.startsWith("validator-") || mode === "invalid-output") expect(fault.stages).toEqual(["query", "shape", "validate"]);
      if (mode === "missing-content") expect(fault.stages).toEqual(["query", "shape"]);
      if (mode === "cell-count" || mode === "pre-limit") expect(fault.stages).toEqual([mode]);
    });
  });

  it("keeps safe-result preparation failure at the fixed outer HTTP-500 boundary", async () => {
    fault.mode = "prepare";
    const { response, wireText, body } = await call();
    expect(response.status).toBe(500);
    expect(body.error.data.code).toBe("internal_error");
    expect(wireText).toMatch(/[Ⴀ-ჿ]/);
    expect(wireText).toContain("The service failed to answer this request");
    expect(wireText).not.toContain("synthetic-token-task4");
    expect(fault.stages).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toMatchObject({ outcome: "error", errorCode: "internal_error" });
    expect(logs.join("")).not.toContain("synthetic-token-task4");
  });

  it.each(["none", "validator-async-valid"])("preserves valid output with %s validation", async mode => {
    fault.mode = mode;
    const { response, body } = await call();
    expect(response.status).toBe(200);
    expect(body.result.isError).toBe(false);
    expect(body.result.structuredContent).toMatchObject({ kind: "observations", data: { observations: [{ year: 2024 }] } });
    expect(fault.stages).toEqual(["query", "shape", "validate"]);
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toMatchObject({ outcome: "ok" });
  });

  it.each([
    [{ ...valid, years: "2024" }, "invalid_parameters", "Input validation error"],
    [{ ...valid, seriesIds: ["unknown"] }, "unknown_series", "error unknown_series"],
    [{ ...valid, years: [1900] }, "year_out_of_range", "error year_out_of_range"],
  ])("retains useful public argument errors %#", async (args, code, text) => {
    const { body } = await call(args);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain(text);
    if (code !== "invalid_parameters") expect(body.result.content[0].text).toMatch(/[Ⴀ-ჿ]/);
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toMatchObject({ outcome: "error", errorCode: code });
  });
});


it("returns fresh fallback content on repeated failures in the same registered callback", async () => {
  const registration = vi.spyOn(McpServer.prototype, "registerTool");
  const server = createMcpServer();
  try {
    const callback = registration.mock.calls.find(([name]) => name === "query_national")![2] as unknown as (args: unknown) => ToolResult;
    fault.mode = "query-error";
    const first = callback(valid);
    const originalText = first.content[0]!.text;
    first.content[0]!.text = "mutated first response";
    first.content.push({ type: "text", text: "extra" });
    const second = callback(valid);
    expect(second).not.toBe(first);
    expect(second.content).not.toBe(first.content);
    expect(second.content).toEqual([{ type: "text", text: originalText }]);
    expect(second.isError).toBe(true);
    expect(second.structuredContent).toBeUndefined();
  } finally {
    await server.close();
    registration.mockRestore();
  }
});
