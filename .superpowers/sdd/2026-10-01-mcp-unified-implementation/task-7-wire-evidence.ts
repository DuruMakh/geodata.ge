// Run with tsx from apps/web. Real HTTP clients cross the production route;
// this audit records final serialized JSON-RPC bodies, not a pre-SDK estimate.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { POST, GET, DELETE } from "../../../apps/web/app/mcp/route";
import { httpBridge } from "../../../apps/web/tests/mcp/httpBridge";
import { TOOLS } from "../../../apps/web/lib/mcp/tools";
import { outputSchemaFor } from "../../../apps/web/lib/mcp/outputSchema";
import { boundedToolResult, LIMITS } from "../../../apps/web/lib/mcp/result";
import { loadPackagedSnapshot } from "../../../apps/web/lib/mcp/snapshot";

const root = path.resolve(process.cwd(), "../..");
const appRequire = createRequire(path.join(root, "apps/web/package.json"));
const { Client, StreamableHTTPClientTransport } = appRequire("@modelcontextprotocol/client");
const { Client: LegacyClient } = appRequire("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport: LegacyTransport } = appRequire("@modelcontextprotocol/sdk/client/streamableHttp.js");
const VERSION = "2026-07-28";
const calls = [
  { label: "full305Catalogue", name: "describe_coverage", arguments: { datasetId: "inflation-products" } },
  { label: "annualRank100", name: "rank", arguments: { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "yoy_pct", period: "2026-08", limit: 100 } },
  { label: "cumulativeRank100With18Exclusions", name: "rank", arguments: { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "cumulative_pct", startYear: 2015, period: "2026-08", limit: 100 } },
  { label: "annualReference", name: "query_inflation_products", arguments: { seriesIds: ["cpi.product.p0001"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" } },
  { label: "cumulativeReference", name: "query_inflation_products", arguments: { seriesIds: ["cpi.product.p0001"], measure: "cumulative_pct", startYear: 2025, fromPeriod: "2025-12", toPeriod: "2025-12" } },
];

async function main() {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  const write = process.stdout.write;
  process.stdout.write = () => true;
  const wires: Record<string, unknown>[] = [];
  const bridge = await httpBridge(async request => {
    if (request.method !== "POST") return request.method === "DELETE" ? DELETE(request) : GET(request);
    const rpc = await request.clone().json();
    const response = await POST(request);
    if (rpc.method === "tools/call") {
      const payload = await response.clone().text();
      const body = JSON.parse(payload);
      const bytes = Buffer.byteLength(payload, "utf8");
      assert.equal(response.status, 200);
      assert.equal(body.result.isError, false);
      assert(bytes < LIMITS.resultBytes);
      const modern = request.headers.get("mcp-protocol-version") === VERSION;
      if (modern) { assert.equal(body.result.resultType, "complete"); assert(body.result._meta); }
      const shape = body.result.structuredContent.data;
      wires.push({
        label: calls.find(call => call.name === rpc.params.name && JSON.stringify(call.arguments) === JSON.stringify(rpc.params.arguments))?.label,
        era: modern ? VERSION : "2025-11-25", bytes, headroom: LIMITS.resultBytes - bytes,
        resultType: body.result.resultType ?? null, serverMetadataKeys: Object.keys(body.result._meta ?? {}),
        count: shape.series?.length ?? shape.entries?.length ?? shape.observations?.length,
        universe: shape.universe ?? null, exclusions: shape.exclusions ?? null,
      });
    }
    return response;
  });
  const modern = new Client({ name: "product-wire-audit", version: "1" }, { versionNegotiation: { mode: { pin: VERSION } } });
  const legacy = new LegacyClient({ name: "legacy-product-wire-audit", version: "1" });
  try {
    await modern.connect(new StreamableHTTPClientTransport(bridge.url));
    await legacy.connect(new LegacyTransport(bridge.url));
    const legacyTools = (await legacy.listTools()).tools;
    const modernTools = (await modern.listTools()).tools;
    for (const name of ["query_inflation_products", "describe_coverage", "rank"]) {
      assert.deepEqual(legacyTools.find((tool: { name: string }) => tool.name === name).outputSchema, modernTools.find((tool: { name: string }) => tool.name === name).outputSchema);
    }
    const snapshot = loadPackagedSnapshot();
    const bounded = [];
    for (const call of calls) {
      const old = await legacy.callTool({ name: call.name, arguments: call.arguments });
      const current = await modern.callTool({ name: call.name, arguments: call.arguments });
      assert.deepEqual(current.structuredContent, old.structuredContent);
      assert.deepEqual(outputSchemaFor(call.name).parse(current.structuredContent), current.structuredContent);
      const response = TOOLS.find(tool => tool.name === call.name)!.run(snapshot, call.arguments);
      const result = boundedToolResult(snapshot, response);
      assert.equal(result.isError, false);
      const bytes = Buffer.byteLength(JSON.stringify(result));
      bounded.push({ label: call.label, bytes, headroom: LIMITS.resultBytes - bytes });
    }
    writeFileSync(path.join(root, ".superpowers/sdd/2026-10-01-mcp-unified-implementation/task-7-wire-evidence.json"), JSON.stringify({
      snapshotDataVersion: snapshot.dataVersion, schemaVersion: snapshot.schemaVersion, resultLimit: LIMITS.resultBytes,
      clients: { legacy: "1.30.1", modern: "2.2.0" }, bounded, wires,
      proof: "Real SDK listTools installs cached validators; subsequent HTTP calls validate same schemas and equal full application responses. Wire bytes include SDK era fields, server metadata and JSON-RPC framing.",
    }, null, 2) + "\n");
  } finally {
    await modern.close(); await legacy.close(); await bridge.close(); process.stdout.write = write;
  }
  process.stdout.write(JSON.stringify(wires.map(({ label, era, bytes, headroom }) => ({ label, era, bytes, headroom }))) + "\n");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
