// Run from apps/web after a production build and an owned local server start.
// Uses real SDK clients against Next's compiled route; no source HTTP bridge.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import path from "node:path";
import { outputSchemaFor } from "../../../apps/web/lib/mcp/outputSchema";
import { LIMITS } from "../../../apps/web/lib/mcp/result";

const root = path.resolve(process.cwd(), "../..");
const appRequire = createRequire(path.join(root, "apps/web/package.json"));
const { Client, StreamableHTTPClientTransport } = appRequire("@modelcontextprotocol/client");
const { Client: LegacyClient } = appRequire("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport: LegacyTransport } = appRequire("@modelcontextprotocol/sdk/client/streamableHttp.js");
const endpoint = new URL("http://localhost:3100/mcp");
const snapshot = JSON.parse(readFileSync(path.join(root, "apps/web/lib/factQuery/generated/snapshot.json"), "utf8"));
const reference = JSON.parse(readFileSync(path.join(root, "docs/superpowers/reviews/2026-10-01-mcp-independent-reference.json"), "utf8"));
const wires: Record<string, unknown>[] = [];
let requests = 0;

function observedFetch(era: string) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, endpoint.origin, "This audit only contacts the owned local server");
    assert(++requests < 60, "Audit must stay within the local rolling-minute allowance");
    const request = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    // Node's global fetch does not preserve the requested Host on this host.
    // The SDK's supported custom-fetch option uses ordinary bounded HTTP here,
    // preserving the production guard while connecting only to localhost.
    const headers = new Headers(init?.headers);
    headers.set("host", "fiscal.ge");
    const response = await new Promise<Response>((resolve, reject) => {
      const outgoing = httpRequest(url, { method: init?.method ?? "GET", headers: Object.fromEntries(headers), signal: init?.signal ?? undefined }, incoming => {
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > LIMITS.resultBytes) { outgoing.destroy(new Error("HTTP result exceeded its byte bound")); return; }
          chunks.push(chunk);
        });
        incoming.on("error", reject);
        incoming.on("end", () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
          resolve(new Response(size === 0 ? null : Buffer.concat(chunks), { status: incoming.statusCode!, statusText: incoming.statusMessage, headers: responseHeaders }));
        });
      });
      outgoing.on("error", reject);
      if (typeof init?.body === "string") outgoing.write(init.body);
      outgoing.end();
    });
    assert.equal(response.headers.get("mcp-session-id"), null);
    if (request && response.status === 200) {
      assert(response.headers.get("content-type")?.includes("application/json"));
      const text = await response.clone().text();
      const body = JSON.parse(text);
      assert.equal(body.id, request.id);
      if (era === "modern") assert.equal(body.result.resultType, "complete");
      if (request.method === "server/discover") {
        assert.deepEqual(body.result.supportedVersions, ["2026-07-28"]);
        assert.equal(body.result.capabilities.tools.listChanged, false);
      }
      const bytes = Buffer.byteLength(text, "utf8");
      assert(bytes < LIMITS.resultBytes);
      wires.push({ era, method: request.method, tool: request.params?.name ?? null, status: response.status, bytes, headroom: LIMITS.resultBytes - bytes, resultType: body.result?.resultType ?? null });
    }
    return response;
  };
}

async function main() {
  const modern = new Client({ name: "local-built-proof", version: "1" }, { versionNegotiation: { mode: { pin: "2026-07-28" } } });
  const legacy = new LegacyClient({ name: "legacy-local-built-proof", version: "1" });
  const summary: Record<string, unknown>[] = [];
  const calls = [
    { label: "catalogue", name: "describe_coverage", arguments: { datasetId: "inflation-products" } },
    { label: "annual", name: "query_inflation_products", arguments: { seriesIds: ["cpi.product.p0001"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" } },
    { label: "cumulative", name: "query_inflation_products", arguments: { seriesIds: ["cpi.product.p0001"], measure: "cumulative_pct", startYear: 2025, fromPeriod: "2025-12", toPeriod: "2025-12" } },
    { label: "annualRank100", name: "rank", arguments: { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "yoy_pct", period: "2026-08", limit: 100 } },
    { label: "cumulativeRank100", name: "rank", arguments: { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "cumulative_pct", startYear: 2015, period: "2026-08", limit: 100 } },
    { label: "sources", name: "get_sources", arguments: { sourceIds: ["source.geostat_product_yoy", "source.geostat_product_mom"], datasetId: "inflation-products" } },
  ];
  try {
    await modern.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { host: "fiscal.ge" } }, fetch: observedFetch("modern") }));
    await legacy.connect(new LegacyTransport(endpoint, { requestInit: { headers: { host: "fiscal.ge" } }, fetch: observedFetch("legacy") }));
    assert.equal(modern.getProtocolEra(), "modern");
    const modernTools = (await modern.listTools()).tools;
    const legacyTools = (await legacy.listTools()).tools;
    assert.equal(modernTools.length, 14);
    assert.deepEqual(modernTools, legacyTools);
    for (const tool of modernTools) assert.equal(tool.annotations.readOnlyHint, true);
    for (const call of calls) {
      const current = await modern.callTool({ name: call.name, arguments: call.arguments });
      const old = await legacy.callTool({ name: call.name, arguments: call.arguments });
      assert.equal(current.isError, false);
      assert.deepEqual(current.structuredContent, old.structuredContent);
      const content = current.structuredContent;
      assert.deepEqual(outputSchemaFor(call.name).parse(content), content);
      assert.equal(content.meta.schemaVersion, "1.5.0");
      assert.equal(content.meta.dataVersion, snapshot.dataVersion);
      assert.equal(content.meta.releaseCommit, snapshot.releaseCommit);
      assert(!/sourceLocator|decisionRef/.test(JSON.stringify(content)));
      if (call.label === "annual") {
        assert.equal(content.data.observations[0].value, Number(reference.annual.percent));
        assert.equal(content.data.observations[0].calculationBasePeriod, undefined);
        assert(content.meta.sources.some((source: { sourceId: string }) => source.sourceId === "source.geostat_product_yoy"));
      }
      if (call.label === "cumulative") {
        assert(Math.abs(content.data.observations[0].value - Number(reference.cumulative.percent)) < 1e-10);
        assert.equal(content.data.observations[0].calculationBasePeriod, "2024-12");
        assert(content.meta.caveats.some((caveat: { code: string }) => caveat.code === "inflation_product_cumulative_derived"));
        assert(content.meta.sources.some((source: { sourceId: string }) => source.sourceId === "source.geostat_product_mom"));
      }
      summary.push({ label: call.label, kind: content.kind, status: content.status, count: content.data.series?.length ?? content.data.entries?.length ?? content.data.observations?.length ?? content.data.sources?.length, value: content.data.observations?.[0]?.value ?? null, calculationBasePeriod: content.data.observations?.[0]?.calculationBasePeriod ?? null, universe: content.data.universe ?? null, sourceIds: content.meta.sources.map((source: { sourceId: string }) => source.sourceId) });
    }
  } finally { await modern.close(); await legacy.close(); }
  const manifestResponse = await fetch(new URL("/downloads/data/manifest.json", endpoint));
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.files.length, 22);
  const publications = [];
  for (const name of ["inflation-products.csv", "inflation-products.json"]) {
    const file = manifest.files.find((file: { fileName: string }) => file.fileName === name);
    assert(file, `Manifest must list ${name}`);
    const response = await fetch(new URL(file.url, endpoint));
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha256, file.sha256);
    assert.equal(bytes.length, file.byteSize);
    publications.push({ name, bytes: bytes.length, sha256 });
  }
  const evidence = { checkedAt: new Date().toISOString(), endpoint: endpoint.href, hostHeader: "fiscal.ge", releaseCommit: snapshot.releaseCommit, schemaVersion: snapshot.schemaVersion, dataVersion: snapshot.dataVersion, snapshotBytes: readFileSync(path.join(root, "apps/web/lib/factQuery/generated/snapshot.json")).byteLength, clients: { modern: "2.2.0 pinned 2026-07-28", legacy: "1.30.1" }, requests, tools: 14, resultLimit: LIMITS.resultBytes, summary, wires, publications, boundary: "Actual local next start compiled route with memory limiter; no human app, database mirror, production Upstash or live deployment proof." };
  writeFileSync(path.join(root, "docs/superpowers/reviews/2026-10-02-mcp-built-endpoint.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ requests, tools: 14, schema: snapshot.schemaVersion, dataVersion: snapshot.dataVersion, publications, summary }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
