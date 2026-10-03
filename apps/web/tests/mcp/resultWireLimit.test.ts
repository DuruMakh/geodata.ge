import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { POST } from "../../app/mcp/route";
import { TOOLS } from "../../lib/mcp/tools";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { LIMITS, toolResult } from "../../lib/mcp/result";

const original = { ...process.env };
beforeAll(() => {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => { process.env = { ...original }; vi.restoreAllMocks(); });

it.each(["legacy", "modern"])("counts the final SDK bytes before returning a %s result", async era => {
  const tool = TOOLS.find(tool => tool.name === "query_national")!;
  const args = { side: "expenditure", seriesIds: ["expenditure.total"], years: [2024], measure: "amount_gel" };
  const response = tool.run(loadPackagedSnapshot(), args);
  if (response.kind !== "observations") throw new Error("Expected observations");
  // A valid metadata string whose final size is ten bytes below the tool cap.
  // The SDK adds its envelope/identity afterward, so the HTTP reply must refuse.
  const bytes = Buffer.byteLength(JSON.stringify(toolResult(response)), "utf8");
  response.meta.generatedAt += "x".repeat(LIMITS.resultBytes - bytes - 10);
  expect(Buffer.byteLength(JSON.stringify(toolResult(response)), "utf8")).toBe(LIMITS.resultBytes - 10);
  const run = vi.spyOn(tool, "run").mockReturnValue(response);
  const modern = era === "modern";
  try {
    const result = await POST(new Request("https://fiscal.ge/mcp", {
      method: "POST", headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": modern ? "2026-07-28" : "2025-11-25", ...(modern ? { "mcp-method": "tools/call", "mcp-name": tool.name } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: "cap-id", method: "tools/call", params: { name: tool.name, arguments: args, ...(modern ? { _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "wire-size-test", version: "1" },
        "io.modelcontextprotocol/clientCapabilities": {},
      } } : {}) } }),
    }));
    const text = await result.text();
    const body = JSON.parse(text);
    expect(result.status).toBe(200);
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(LIMITS.resultBytes);
    expect(body.id).toBe("cap-id");
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent).toBeUndefined();
    expect(body.result.content[0].text).toContain("result_too_large");
    expect(body.result.content[0].text).toContain("/downloads/data/manifest.json");
    if (modern) expect(body.result.resultType).toBe("complete");
  } finally { run.mockRestore(); }
});
