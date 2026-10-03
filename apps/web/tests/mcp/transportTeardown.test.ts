import { afterAll, beforeAll, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ open: new Set<number>(), created: 0 }));
vi.mock("../../lib/mcp/tools", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/mcp/tools")>();
  return { ...actual, createMcpServer: () => {
    const server = actual.createMcpServer();
    const id = ++state.created;
    state.open.add(id);
    server.server.onclose = () => { state.open.delete(id); };
    return server;
  } };
});
import { POST } from "../../app/mcp/route";

const original = { ...process.env };
beforeAll(() => {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => { process.env = { ...original }; vi.restoreAllMocks(); });

it.each(["legacy", "modern"])("closes every %s server after completed and failed exchanges", async era => {
  const initial = state.created;
  for (const tool of ["query_inflation", "unknown_tool"]) {
    const modern = era === "modern";
    const response = await POST(new Request("https://fiscal.ge/mcp", {
      method: "POST", headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": modern ? "2026-07-28" : "2025-11-25", ...(modern ? { "mcp-method": "tools/call", "mcp-name": tool } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 73, method: "tools/call", params: { name: tool, arguments: { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" }, ...(modern ? { _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "teardown-test", version: "1" },
        "io.modelcontextprotocol/clientCapabilities": {},
      } } : {}) } }),
    }));
    expect(response.headers.get("mcp-session-id")).toBeNull();
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    if (tool === "query_inflation") expect(body.result.isError).toBeFalsy();
    else expect(body.result?.isError === true || body.error !== undefined).toBe(true);
    expect(state.open.size).toBe(0);
  }
  expect(state.created - initial).toBe(2);
});
