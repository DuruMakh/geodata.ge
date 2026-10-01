import { expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport as LegacyTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMcpHandler, isLegacyRequest, McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { TOOLS } from "../../lib/mcp/tools";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { boundedToolResult } from "../../lib/mcp/result";
import { outputSchemaFor } from "../../lib/mcp/outputSchema";
import { httpBridge } from "./httpBridge";

it("independently serves pinned modern and legacy clients with identical city/source results and plain JSON", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const closed: string[] = [];
  const created: string[] = [];
  const factory = (era: string) => {
    const server = new McpServer({ name: "fiscal-ge-proof", version: "1" });
    created.push(era);
    server.server.onclose = () => { closed.push(era); };
    const snapshot = loadPackagedSnapshot();
    for (const name of ["query_inflation", "get_sources"]) {
      const tool = TOOLS.find(tool => tool.name === name)!;
      server.registerTool(name, { inputSchema: tool.schema, outputSchema: outputSchemaFor(name) }, args => boundedToolResult(snapshot, tool.run(snapshot, args)));
    }
    return server;
  };
  const handler = createMcpHandler(({ era }) => factory(era), { legacy: "reject", responseMode: "json" });
  const responseTypes: string[] = [];
  const bridge = await httpBridge(async request => {
    let response: Response;
    if (await isLegacyRequest(request.clone())) {
      const server = factory("legacy");
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      try { await server.connect(transport); response = await transport.handleRequest(request); }
      finally { await server.close(); }
    } else response = await handler.fetch(request);
    if (request.method === "POST" && response.status === 200) responseTypes.push(response.headers.get("content-type")!);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    return response;
  });
  const modern = new Client({ name: "pinned-modern", version: "1" }, { versionNegotiation: { mode: { pin: "2026-07-28" } } });
  const legacy = new LegacyClient({ name: "legacy-v1", version: "1" });
  try {
    await modern.connect(new StreamableHTTPClientTransport(bridge.url));
    await legacy.connect(new LegacyTransport(bridge.url));
    expect(modern.getProtocolEra()).toBe("modern");
    for (const params of [
      { name: "query_inflation", arguments: { entityIds: ["city.tbilisi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" } },
      { name: "get_sources", arguments: { sourceIds: ["source.municipal_mof_annual_and_history_workbooks"] } },
    ]) {
      const modernCall = await modern.callTool(params);
      const legacyCall = await legacy.callTool(params);
      expect(modernCall.structuredContent).toEqual(legacyCall.structuredContent);
      expect(modernCall.isError, JSON.stringify(modernCall)).toBeFalsy();
    }
    expect(responseTypes.every(type => type.startsWith("application/json"))).toBe(true);
  } finally {
    await modern.close(); await legacy.close(); await handler.close(); await bridge.close(); warning.mockRestore();
  }
  expect(closed).toContain("modern");
  expect(closed).toContain("legacy");
  expect(closed.sort()).toEqual(created.sort());
});
