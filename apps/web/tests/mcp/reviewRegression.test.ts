import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { POST } from "../../app/mcp/route";
import { createMcpServer, TOOLS } from "../../lib/mcp/tools";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { toolOutput } from "../../lib/mcp/outputSchema";
import { observationSchema } from "../../lib/factQuery/schemas";
import { queryDeficit } from "../../lib/factQuery/queryDeficit";

const original = { ...process.env };
const logs: string[] = [];
beforeEach(() => {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  process.env.MCP_ALLOWED_ORIGINS = "https://approved.example";
  logs.length = 0;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => { logs.push(String(chunk)); return true; });
});
afterEach(() => { process.env = { ...original }; vi.restoreAllMocks(); });
function post(body: unknown): Request {
  return new Request("https://fiscal.ge/mcp", {
    method: "POST", headers: { host: "fiscal.ge", origin: "https://approved.example", accept: "application/json, text/event-stream", "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("reviewed MCP runtime failures", () => {
  it.each(["{", "x".repeat(33_000)])("keeps errors readable to an approved browser (%#)", async (body) => {
    const response = await POST(post(body));
    expect(response.headers.get("access-control-allow-origin")).toBe("https://approved.example");
    expect(response.headers.get("vary")).toContain("origin");
  });
  it("uses the protocol parse-error code", async () => {
    expect((await (await POST(post("{"))).json()).error.code).toBe(-32700);
  });
  it("rejects a batch instead of charging one request for multiple tool calls", async () => {
    const message = { jsonrpc: "2.0", id: 1, method: "ping" };
    const response = await POST(post([message, { ...message, id: 2 }]));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32600);
  });
  it("points a paused caller at a real published file", async () => {
    process.env.MCP_ENABLED = "false";
    const response = await POST(post({}));
    expect(await response.text()).toContain("/downloads/data/manifest.json");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://approved.example");
  });
  it("logs an MCP tool error as a failure even though HTTP succeeds", async () => {
    const response = await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "query_national", arguments: { side: "expenditure", seriesIds: ["missing"], years: [2025], measure: "amount_gel" } } }));
    expect(response.status).toBe(200);
    expect(logs.map((entry) => JSON.parse(entry))).toContainEqual(expect.objectContaining({ outcome: "error", errorCode: "unknown_series" }));
  });
  it("rejects too many requested cells before running the query", async () => {
    const snapshot = loadPackagedSnapshot();
    const tool = TOOLS.find((t) => t.name === "query_municipal")!;
    const run = vi.spyOn(tool, "run");
    const server = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "bounds-test", version: "1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const result = await client.callTool({ name: tool.name, arguments: {
        entityIds: snapshot.municipal.municipalities.map((m) => m.code), seriesIds: ["municipal.total"],
        years: Array.from({ length: 11 }, (_, i) => 2015 + i), measure: "amount_gel",
      } });
      expect(result.isError).toBe(true);
      expect(run).not.toHaveBeenCalled();
    } finally { await client.close(); await server.close(); }
  });
  it("validates answer fields and projected observations", () => {
    const result = queryDeficit(loadPackagedSnapshot(), { years: [2026], measure: "share_of_gdp_pct" });
    if (result.kind === "error") throw new Error(result.error.messageEn);
    expect(observationSchema.safeParse((result.data as { observations: unknown[] }).observations[0]).success).toBe(true);
    expect(toolOutput.safeParse({ ...result, data: { arbitrary: "no observations" } }).success).toBe(false);
  });
});
