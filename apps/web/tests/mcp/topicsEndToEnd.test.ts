import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport as LegacyClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { POST, GET, DELETE } from "../../lib/mcp/handler";
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

it("answers the school-pupils ranking over HTTP: the five municipalities that lost most pupils 2015/16 to 2025/26", async () => {
  const bridge = await httpBridge(async request => request.method === "POST" ? POST(request) : request.method === "DELETE" ? DELETE(request) : GET(request));
  const client = new LegacyClient({ name: "topics-end-to-end", version: "1" });
  try {
    await client.connect(new LegacyClientTransport(bridge.url));
    const result = await client.callTool({
      name: "rank",
      arguments: { datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", measure: "value", metric: "percentage_change", fromYear: 2015, toYear: 2025, order: "ascending", limit: 5 },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { kind: string; data: { entries: { entityLabelEn: string; value: number }[]; rankingDefinitionEn: string } };
    expect(structured.kind).toBe("ranking");
    expect(structured.data.entries.map(entry => [entry.entityLabelEn, Math.round(entry.value * 10) / 10])).toEqual([
      ["Shuakhevi", -52.8], ["Khulo", -47.3], ["Lentekhi", -27.0], ["Tsalka", -22.7], ["Tsageri", -19.6],
    ]);
    expect(structured.data.rankingDefinitionEn).toContain("2015/16→2025/26");
    expect((result.content as { type: string; text: string }[])[0]!.text).toContain("2015/16→2025/26");
  } finally { await client.close(); await bridge.close(); }
});
