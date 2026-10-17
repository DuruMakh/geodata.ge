import { writeFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport as LegacyTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const VERSION = "2026-07-28";
const REQUEST_LIMIT = 30;
const BYTE_LIMIT = 512 * 1024;
const REQUIRED = ["query_regional_economies", "query_economic_sectors", "query_gdp", "query_inflation", "query_inflation_products", "describe_coverage", "query_national", "query_ministries", "query_municipal", "query_debt", "query_deficit", "compare", "rank", "get_sources"] as const;
type Tool = typeof REQUIRED[number];
type Era = "pinned-modern" | "automatic-modern" | "legacy";
type Failure = "invalid_arguments" | "request_budget_exhausted" | "timeout" | "redirect" | "response_too_large" | "rate_limited" | "service_unavailable" | "http_error" | "protocol_error" | "inventory_mismatch" | "tool_error" | "malformed_output" | "schema_mismatch" | "data_version_mismatch" | "assertion_failed" | "parity_mismatch" | "stale_version_not_refused" | "output_write_failed";
class ProbeFailure extends Error { constructor(readonly code: Failure) { super(code); } }
type Options = { url: string; expectedSchema: string; expectedDataVersion: string };
type RequestCheck = { method: string; status?: number; bytes?: number; durationMs: number; retryAfterSeconds?: number };
export type SmokeReport = {
  ok: boolean;
  failure?: Failure;
  httpRequestCount: number;
  durationMs: number;
  identity?: { schemaVersion: string; dataVersion: string; releaseCommit: string };
  tools: { name: Tool; ok: boolean }[];
  clients: { era: Era; ok: boolean; staleVersionRefused: boolean }[];
  requests: RequestCheck[];
};
// Inject only the boundary/timing/output for tests; the CLI has no limit overrides.
type Dependencies = { fetch?: typeof fetch; paceMs?: number; timeoutMs?: number; write?: (text: string, output: string) => void };
const CITY = { entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" };
const SCENARIOS: Record<Tool, Record<string, unknown>> = {
  query_regional_economies: { regionIds: ["region.imereti"], seriesIds: ["sector.a", "economy.regional_gdp_total"], years: [2024], measure: "share_of_region_gdp_pct" },
  query_economic_sectors: { seriesIds: ["sector.a", "economy.gdp_total"], years: [2011, 2025], measure: "real_growth_pct" },
  query_gdp: { seriesIds: ["real_usd_2015", "nominal_usd", "real_growth_percent"], years: [2025] },
  query_inflation: CITY,
  query_inflation_products: { seriesIds: ["cpi.product.p0001"], measure: "cumulative_pct", startYear: 2025, fromPeriod: "2025-12", toPeriod: "2025-12" },
  describe_coverage: { datasetId: "municipal-expenditure" },
  query_national: { side: "revenue", seriesIds: ["revenue.total"], years: [2024], measure: "amount_gel" },
  query_ministries: { level: "admin_category", seriesIds: ["admin_spending.defence"], years: [2024], measure: "amount_gel" },
  query_municipal: { entityIds: ["11"], seriesIds: ["municipal.total"], years: [2024], measure: "amount_gel" },
  query_debt: { seriesIds: ["debt.stock.total"], years: [2024], measure: "amount_gel" },
  query_deficit: { years: [2020], measure: "share_of_gdp_pct" },
  compare: { target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] }, fromYear: 2023, toYear: 2024, measure: "amount_gel" },
  rank: { datasetId: "national-revenue", dimension: "series", fromYear: 2019, toYear: 2023, measure: "share_of_total_pct", metric: "percentage_point_change", limit: 5 },
  get_sources: {}, // Filled from the sourced city answer, then reused in each era.
};
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ProbeFailure("malformed_output");
  return value as Record<string, unknown>;
}
function nonempty(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new ProbeFailure("malformed_output");
  return value;
}
function assert(condition: unknown, code: Failure = "assertion_failed"): asserts condition {
  if (!condition) throw new ProbeFailure(code);
}

export async function runSmoke(options: Options, dependencies: Dependencies = {}): Promise<SmokeReport> {
  const started = performance.now();
  const report: SmokeReport = { ok: false, httpRequestCount: 0, durationMs: 0, tools: [], clients: [], requests: [] };
  const clients: (Client | LegacyClient)[] = [];
  const controllers = new Set<AbortController>();
  const networkFetch = dependencies.fetch ?? globalThis.fetch;
  let stopped: Failure | undefined;
  let queue = Promise.resolve();
  let lastStarted = -Infinity;
  const stop = (code: Failure) => { stopped ??= code; for (const controller of controllers) controller.abort(); };
  const countedFetch: typeof fetch = (input, init) => {
    const exchange = queue.then(async () => {
      if (stopped) throw new ProbeFailure(stopped);
      const wait = Math.max(0, lastStarted + (dependencies.paceMs ?? 1100) - performance.now());
      if (wait) await new Promise(resolve => setTimeout(resolve, Math.ceil(wait)));
      if (stopped) throw new ProbeFailure(stopped);
      if (init?.signal?.aborted) throw new ProbeFailure("protocol_error");
      if (report.httpRequestCount >= REQUEST_LIMIT) { stop("request_budget_exhausted"); throw new ProbeFailure(stopped!); }
      const controller = new AbortController();
      controllers.add(controller);
      const abort = () => controller.abort();
      init?.signal?.addEventListener("abort", abort, { once: true });
      const entry: RequestCheck = { method: init?.method === "GET" ? "GET" : init?.method === "DELETE" ? "DELETE" : "POST", durationMs: 0 };
      report.requests.push(entry);
      report.httpRequestCount++;
      lastStarted = performance.now();
      const begin = lastStarted;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const operation = async () => {
          const response = await networkFetch(input, { ...init, redirect: "error", signal: controller.signal });
          entry.status = response.status;
          if (response.status >= 300 && response.status < 400) {
            void response.body?.cancel().catch(() => {});
            throw new ProbeFailure("redirect");
          }
          if (response.status === 429 || response.status === 503) {
            const retry = response.headers.get("retry-after");
            if (retry && /^\d{1,5}$/.test(retry)) entry.retryAfterSeconds = Math.min(Number(retry), 86400);
            void response.body?.cancel().catch(() => {});
            throw new ProbeFailure(response.status === 429 ? "rate_limited" : "service_unavailable");
          }
          // The legacy SDK opens an optional GET after initialized; this stateless server refuses it.
          if (!response.ok && !(entry.method === "GET" && response.status === 405)) {
            void response.body?.cancel().catch(() => {});
            throw new ProbeFailure("http_error");
          }
          reader = response.body?.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          while (reader) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            entry.bytes = size;
            if (size > BYTE_LIMIT) throw new ProbeFailure("response_too_large");
            chunks.push(chunk.value);
          }
          const body = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
          entry.bytes = size;
          return new Response(size ? body : null, { status: response.status, headers: response.headers });
        };
        const deadline = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { stop("timeout"); reject(new ProbeFailure("timeout")); }, dependencies.timeoutMs ?? 10_000);
        });
        return await Promise.race([operation(), deadline]);
      } catch (error) {
        stop(error instanceof ProbeFailure ? error.code : "protocol_error");
        throw new ProbeFailure(stopped!);
      } finally {
        clearTimeout(timer);
        // Cancellation is deliberately not awaited: a broken peer cannot hold teardown open.
        void reader?.cancel().catch(() => {});
        controller.abort();
        controllers.delete(controller);
        init?.signal?.removeEventListener("abort", abort);
        entry.durationMs = Math.round(performance.now() - begin);
      }
    });
    queue = exchange.then(() => {}, () => {});
    return exchange;
  };
  try {
    let url: URL;
    try {
      url = new URL(options.url);
      assert(!url.username && !url.password && !url.search && !url.hash, "invalid_arguments");
      assert(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)), "invalid_arguments");
      assert(/^\d+\.\d+\.\d+$/.test(options.expectedSchema) && /^[a-f0-9]{64}$/.test(options.expectedDataVersion), "invalid_arguments");
    } catch { throw new ProbeFailure("invalid_arguments"); }
    let city: Record<string, unknown> | undefined;
    let sources: Record<string, unknown> | undefined;
    let sourceArguments: Record<string, unknown> = {};
    const validate = (result: unknown, name: Tool) => {
      const tool = object(result);
      assert(!tool.isError, "tool_error");
      const envelope = object(tool.structuredContent);
      const meta = object(envelope.meta);
      assert(meta.schemaVersion === options.expectedSchema, "schema_mismatch");
      assert(meta.dataVersion === options.expectedDataVersion, "data_version_mismatch");
      assert(typeof meta.releaseCommit === "string" && /^[a-f0-9]{40}$/.test(meta.releaseCommit), "malformed_output");
      assert(["ok", "partial", "empty"].includes(String(envelope.status)), "malformed_output");
      if (report.identity) assert(report.identity.releaseCommit === meta.releaseCommit);
      report.identity = { schemaVersion: options.expectedSchema, dataVersion: options.expectedDataVersion, releaseCommit: meta.releaseCommit };
      const data = object(envelope.data);
      if (name === "query_inflation") {
        const observation = object(nonempty(data.observations)[0]);
        assert(observation.entityId === "city.batumi" && observation.value === 7.0857 && observation.unit === "percent");
        const periods = object(data.coverage).availablePeriods;
        assert(Array.isArray(periods) && periods.length === 2 && periods.every(period => typeof period === "string" && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)));
        // Coverage belongs to the supplied release identity; later clean vintages need no probe edit.
        assert(periods[0] <= CITY.fromPeriod && periods[1] >= CITY.toPeriod);
      } else if (name === "rank") {
        assert(nonempty(data.entries).every(entry => object(entry).unit === "percentage_points"));
      } else if (name === "get_sources") {
        assert(isDeepStrictEqual(nonempty(data.sources).map(source => object(source).sourceId).sort(), [...sourceArguments.sourceIds as string[]].sort()));
        for (const source of nonempty(data.sources)) {
          const item = object(source);
          assert(item.narrowingOutcome === "applied");
          assert(nonempty(item.documents).every(document => /^[a-f0-9]{64}$/.test(String(object(document).sha256))));
        }
      } else if (name === "describe_coverage") {
        nonempty(data.datasets);
      } else if (name === "compare") {
        nonempty(data.comparisons);
      } else {
        nonempty(data.observations);
      }
      return envelope;
    };
    for (const era of ["pinned-modern", "automatic-modern", "legacy"] as const) {
      const check = { era, ok: false, staleVersionRefused: false };
      report.clients.push(check);
      const client = era === "legacy" ? new LegacyClient({ name: "fiscal-release-probe", version: "1" }) : new Client({ name: "fiscal-release-probe", version: "1" }, { versionNegotiation: { mode: era === "pinned-modern" ? { pin: VERSION } : "auto", probe: { timeoutMs: (dependencies.timeoutMs ?? 10_000) + 1000, maxRetries: 0 } } });
      clients.push(client);
      if (client instanceof LegacyClient) {
        const transport = new LegacyTransport(url, { fetch: countedFetch });
        await client.connect(transport);
        assert(transport.protocolVersion === "2025-11-25");
      } else {
        await client.connect(new StreamableHTTPClientTransport(url, { fetch: countedFetch }));
        assert(client.getProtocolEra() === "modern");
      }
      const advertised = (await client.listTools()).tools.map(tool => tool.name).sort();
      assert(isDeepStrictEqual(advertised, [...REQUIRED].sort()), "inventory_mismatch");
      const names: readonly Tool[] = era === "pinned-modern" ? REQUIRED : ["query_inflation", "get_sources"];
      for (const name of names) {
        const toolCheck = { name, ok: false };
        if (era === "pinned-modern") report.tools.push(toolCheck);
        const arguments_ = name === "get_sources" ? sourceArguments : SCENARIOS[name];
        const envelope = validate(await client.callTool({ name, arguments: arguments_ }), name);
        if (name === "query_inflation") {
          if (era === "pinned-modern") {
            city = envelope;
            const sourceIds = nonempty(object(envelope.meta).sources).map(source => object(source).sourceId);
            assert(sourceIds.every(id => typeof id === "string" && /^source\.[a-z0-9_.]+$/.test(id)));
            sourceArguments = { sourceIds, entityIds: ["city.batumi"], years: [2026] };
          } else assert(isDeepStrictEqual(envelope, city), "parity_mismatch");
        }
        if (name === "get_sources") {
          if (era === "pinned-modern") sources = envelope;
          else assert(isDeepStrictEqual(envelope, sources), "parity_mismatch");
        }
        toolCheck.ok = true;
      }
      const stale = options.expectedDataVersion === "0".repeat(64) ? "1".repeat(64) : "0".repeat(64);
      const refused = await client.callTool({ name: "query_inflation", arguments: { ...CITY, expectedDataVersion: stale } });
      assert(refused.isError && nonempty(refused.content).some(content => {
        const item = object(content);
        return item.type === "text" && typeof item.text === "string" && /^error data_version_changed \(retryable: false\)$/m.test(item.text);
      }), "stale_version_not_refused");
      check.staleVersionRefused = true;
      check.ok = true;
      await client.close();
    }
    if (stopped) throw new ProbeFailure(stopped);
    report.ok = true;
  } catch (error) {
    report.failure = stopped ?? (error instanceof ProbeFailure ? error.code : "protocol_error");
  } finally {
    stop(report.failure ?? "protocol_error");
    for (const client of clients) await client.close().catch(() => {});
    await queue;
    report.durationMs = Math.round(performance.now() - started);
  }
  return report;
}

export async function main(args = process.argv.slice(2), dependencies: Dependencies = {}): Promise<number> {
  let report: SmokeReport;
  let output = "";
  try {
    const parsed = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
      const flag = args[index]!;
      assert(["--url", "--expected-schema", "--expected-data-version", "--output"].includes(flag) && !parsed.has(flag) && !!args[index + 1], "invalid_arguments");
      parsed.set(flag, args[index + 1]!);
    }
    assert(parsed.size === 4, "invalid_arguments");
    output = parsed.get("--output")!;
    report = await runSmoke({ url: parsed.get("--url")!, expectedSchema: parsed.get("--expected-schema")!, expectedDataVersion: parsed.get("--expected-data-version")! }, dependencies);
  } catch { report = { ok: false, failure: "invalid_arguments", httpRequestCount: 0, durationMs: 0, tools: [], clients: [], requests: [] }; }
  const text = JSON.stringify(report);
  try {
    if (dependencies.write) dependencies.write(text, output);
    else if (output) writeFileSync(output, `${text}\n`, "utf8");
    else process.stdout.write(`${text}\n`);
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, failure: "output_write_failed", httpRequestCount: report.httpRequestCount })}\n`);
    return 1;
  }
  return report.ok ? 0 : 1;
}

if (path.basename(process.argv[1] ?? "") === "smoke-mcp.ts") void main().then(code => { process.exitCode = code; });
