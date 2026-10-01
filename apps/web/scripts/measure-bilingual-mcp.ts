import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeCoverage, type CoverageData } from "../lib/factQuery/describeCoverage";
import { queryNational } from "../lib/factQuery/queryNational";
import { queryMinistries } from "../lib/factQuery/queryMinistries";
import { queryMunicipal } from "../lib/factQuery/queryMunicipal";
import { queryDebt } from "../lib/factQuery/queryDebt";
import { queryDeficit } from "../lib/factQuery/queryDeficit";
import { compare } from "../lib/factQuery/compare";
import { rank } from "../lib/factQuery/rank";
import { getSources } from "../lib/factQuery/getSources";
import { inflationProductIndex } from "../lib/factQuery/inflationProductData";
import { queryInflationProducts } from "../lib/factQuery/queryInflationProducts";
import { periodFromKey, periodKey } from "../lib/data/inflation/periods";
import type { Observation } from "../lib/factQuery/observations";
import { SCHEMA_VERSION, type FactQueryResponse, type FactQuerySnapshot } from "../lib/factQuery/types";
import { LIMITS, boundedToolResult, toolResult } from "../lib/mcp/result";
import { loadPackagedSnapshot } from "../lib/mcp/snapshot";

const COLD_SAMPLES = 5;
const WARM_SAMPLES = 10;
const SNAPSHOT_PATH = path.join(process.cwd(), "lib/factQuery/generated/snapshot.json");
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    min: sorted[0], median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1), samples,
  };
}

// Every invocation is a fresh Node process: neither the loader nor WeakMap index
// cache can carry over. OS file caching is deliberately not called disk-cold.
function coldSample() {
  const start = performance.now();
  const raw = readFileSync(SNAPSHOT_PATH, "utf8");
  const readEnd = performance.now();
  const snapshot = JSON.parse(raw) as FactQuerySnapshot;
  const parseEnd = performance.now();
  if (snapshot.schemaVersion !== SCHEMA_VERSION || !/^[0-9a-f]{64}$/.test(snapshot.dataVersion)) throw new Error("snapshot_incompatible");
  const indexStart = performance.now();
  const index = inflationProductIndex(snapshot);
  const end = performance.now();
  return {
    pid: process.pid, snapshotBytes: Buffer.byteLength(raw, "utf8"), dataVersion: snapshot.dataVersion,
    readMs: readEnd - start, parseMs: parseEnd - readEnd, validationMs: indexStart - parseEnd,
    indexMs: end - indexStart, totalMs: end - start,
    productCount: index.productById.size, factCount: snapshot.inflationProducts.facts.length,
    annualRunCount: index.annual.size, monthlyRunCount: index.monthly.size,
  };
}

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error("Usage: tsx scripts/measure-bilingual-mcp.ts --output <report.json>");
  const cold = Array.from({ length: COLD_SAMPLES }, () => {
    const start = performance.now();
    const sample = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", fileURLToPath(import.meta.url), "--cold-sample"], {
      cwd: process.cwd(), encoding: "utf8", timeout: LIMITS.durationMs,
    })) as ReturnType<typeof coldSample>;
    return { ...sample, processElapsedMs: performance.now() - start };
  });
  const snapshot = loadPackagedSnapshot();
  inflationProductIndex(snapshot);
  const queries = { describeCoverage, queryNational, queryMinistries, queryMunicipal, queryDebt, queryDeficit, queryInflationProducts, compare, rank, getSources };
  const measurements: Record<string, unknown>[] = [];
  function measure(name: string, tool: string, input: unknown, response: FactQueryResponse, requestedCells: number | null = null, runQuery?: () => FactQueryResponse) {
    const timingSamples = { queryMs: [] as number[], renderMs: [] as number[], completeSerializationMs: [] as number[], boundedResultMs: [] as number[], boundedSerializationMs: [] as number[], totalMs: [] as number[] };
    let result = toolResult(response);
    let bounded = result;
    for (let sample = 0; sample < WARM_SAMPLES; sample++) {
      const queryStart = performance.now();
      if (runQuery) response = runQuery();
      const queryMs = runQuery ? performance.now() - queryStart : 0;
      const renderStart = performance.now();
      result = toolResult(response);
      const renderEnd = performance.now();
      JSON.stringify(result);
      const completeSerializationEnd = performance.now();
      bounded = boundedToolResult(snapshot, response);
      const boundedEnd = performance.now();
      JSON.stringify(bounded);
      const serializationEnd = performance.now();
      timingSamples.queryMs.push(queryMs);
      timingSamples.renderMs.push(renderEnd - renderStart);
      timingSamples.completeSerializationMs.push(completeSerializationEnd - renderEnd);
      timingSamples.boundedResultMs.push(boundedEnd - completeSerializationEnd);
      timingSamples.boundedSerializationMs.push(serializationEnd - boundedEnd);
      // The request path calls boundedToolResult, then serializes. Unbounded
      // diagnostic rendering above is excluded from this request-cost sum.
      timingSamples.totalMs.push(queryMs + serializationEnd - completeSerializationEnd);
    }
    const data = response.kind === "error" ? {} : response.data as Record<string, unknown>;
    const rows = data.observations ?? data.comparisons ?? data.entries ?? data.sources ?? data.series ?? data.datasets;
    const coverage = data.coverage as { expectedCount?: number; returnedCount?: number; missingCells?: unknown[] } | undefined;
    const universe = data.universe as { candidateCount: number; eligibleCount: number; returnedCount: number } | undefined;
    const exclusions = response.kind === "ranking" ? data.exclusions as { ids: string[]; reason: string; reasonEn: string }[] : undefined;
    const cellRows = response.kind === "observations" || response.kind === "comparisons" || response.kind === "ranking";
    const timings = Object.fromEntries(Object.entries(timingSamples).map(([key, samples]) => [key, summarize(samples)]));
    measurements.push({
      name, tool, input, status: response.status, kind: response.kind,
      errorCode: response.kind === "error" ? response.error.code : null,
      requestedCells: requestedCells ?? coverage?.expectedCount ?? null,
      returnedCount: coverage?.returnedCount ?? (Array.isArray(rows) ? rows.length : null),
      rowCount: Array.isArray(rows) ? rows.length : null, missingCellCount: coverage?.missingCells?.length ?? 0,
      universe: universe ?? null, exclusions: exclusions ?? null,
      excludedCount: exclusions?.reduce((sum, group) => sum + group.ids.length, 0) ?? 0,
      sourceCount: response.meta.sources.length, caveatCount: response.meta.caveats.length,
      structuredBytes: bytes(result.structuredContent ?? null),
      textBytes: Buffer.byteLength(result.content.map(block => block.text).join("\n"), "utf8"),
      completeBytes: bytes(result), boundedBytes: bytes(bounded),
      boundedHeadroomBytes: LIMITS.resultBytes - bytes(bounded),
      isError: result.isError, boundedIsError: bounded.isError,
      limitOutcome: result.isError ? "input_or_query_error" : bounded.isError
        ? (cellRows && Array.isArray(rows) && rows.length > (response.kind === "comparisons" ? LIMITS.comparisonPairs : LIMITS.cells) ? "cell_limit" : "byte_limit") : "accepted",
      refusalText: bounded.isError ? bounded.content.map(block => block.text).join("\n") : null,
      sampleCount: WARM_SAMPLES, warmupCount: runQuery ? 1 : 0,
      timingScope: runQuery ? "warm query + boundedToolResult + bounded JSON serialization; no SDK/HTTP/boot" : "fixed response shaping only; no query execution",
      elapsedMs: timings.queryMs.median, timings,
    });
  }
  function run(name: string, tool: keyof typeof queries, input: unknown, requestedCells?: number) {
    const response = queries[tool](snapshot, input);
    measure(name, tool, input, response, requestedCells, () => queries[tool](snapshot, input));
    return response;
  }
  const catalogue = run("catalogue-default", "describeCoverage", {});
  if (catalogue.kind !== "catalogue") throw new Error("Default catalogue failed");
  const datasets = (catalogue.data as CoverageData).datasets;
  const catalogues = new Map<string, CoverageData>();
  for (const dataset of datasets) {
    const response = run(`catalogue-${dataset.datasetId}`, "describeCoverage", { datasetId: dataset.datasetId });
    if (response.kind !== "catalogue") throw new Error(`Catalogue failed: ${dataset.datasetId}`);
    catalogues.set(dataset.datasetId, response.data as CoverageData);
  }
  const getCatalogue = (id: string) => {
    const value = catalogues.get(id);
    if (!value?.series?.length) throw new Error(`No served series: ${id}`);
    return value;
  };
  for (const side of ["expenditure", "revenue"] as const) {
    const total = getCatalogue(`national-${side}`).series!.find(series => series.level === "total")!;
    run(`national-${side}-total-all-years`, "queryNational", { side, seriesIds: [total.seriesId], years: total.years, measure: "amount_gel" });
  }
  const ministries = getCatalogue("ministries").series!;
  const parent = ministries.find(series => series.level === "admin_category" && ministries.some(programme => programme.parentSeriesId === series.seriesId))!;
  run("ministry-parent", "queryMinistries", { level: "admin_category", seriesIds: [parent.seriesId], years: parent.years, measure: "amount_gel" });
  const programmes = ministries.filter(series => series.level === "major_program" && series.parentSeriesId === parent.seriesId);
  run("ministry-programmes", "queryMinistries", { level: "major_program", seriesIds: programmes.map(series => series.seriesId), years: [...new Set(programmes.flatMap(series => series.years))].sort((a, b) => a - b), measure: "amount_gel" });
  const municipal = getCatalogue("municipal-expenditure");
  const total = municipal.series!.find(series => series.level === "total")!;
  const entityIds = municipal.entities!.filter(entity => entity.entityType === "municipality").map(entity => entity.entityId).sort();
  const years = [...total.years].sort((a, b) => a - b);
  const latestYear = years.at(-1)!;
  run("municipal-one-all-years", "queryMunicipal", { entityIds: entityIds.slice(0, 1), seriesIds: [total.seriesId], years, measure: "amount_gel" });
  run("municipal-all-latest-year", "queryMunicipal", { entityIds, seriesIds: [total.seriesId], years: [latestYear], measure: "amount_gel" });
  for (const entity of [municipal.entities!.find(entity => entity.entityType === "region" && entity.entityId !== "region.adjara")!, municipal.entities!.find(entity => entity.entityId === "region.adjara")!]) {
    run(`region-${entity.entityId}`, "queryMunicipal", { entityIds: [entity.entityId], seriesIds: [total.seriesId], years, measure: "amount_gel" });
  }
  function grid(cells: number) {
    for (let count = years.length; count >= 1; count--) {
      if (cells % count === 0 && cells / count <= entityIds.length) return { entityIds: entityIds.slice(0, cells / count), seriesIds: [total.seriesId], years: years.slice(-count), measure: "amount_gel" };
    }
    throw new Error(`Cannot form ${cells} cells from the served municipal total grid`);
  }
  run("municipal-495", "queryMunicipal", grid(495), 495);
  const input500 = grid(500);
  const response500 = run("municipal-500", "queryMunicipal", input500, 500);
  // 501 = 3 × 167. The current 64-entity / 11-year total grid cannot express
  // exactly 501 cells in one valid rectangular request. Probe the exact result
  // gate with 501 DISTINCT existing cells, and separately send a real 506-cell request.
  const extraInput = { entityIds: [entityIds.find(id => !input500.entityIds.includes(id))!], seriesIds: [total.seriesId], years: [latestYear], measure: "amount_gel" };
  const extra = queryMunicipal(snapshot, extraInput);
  if (response500.kind !== "observations" || extra.kind !== "observations") throw new Error("500-cell boundary fixture failed");
  const baseData = response500.data as { observations: Observation[]; coverage: Record<string, unknown> };
  const extraData = extra.data as { observations: Observation[] };
  const response501 = { ...response500, data: { ...baseData, observations: [...baseData.observations, ...extraData.observations], coverage: { ...baseData.coverage, returnedCount: 501, expectedCount: 501 } } };
  measure("501-existing-cells-result-gate", "boundedToolResult fixture", [input500, extraInput], response501, 501);
  run("municipal-506-valid-request", "queryMunicipal", grid(506), 506);
  run("municipal-input-year-limit", "queryMunicipal", { ...extraInput, years: Array.from({ length: LIMITS.years + 1 }, (_, index) => latestYear - index) });
  const expenditure = getCatalogue("national-expenditure").series!.find(series => series.level === "public_field" && series.years.length > 1)!;
  run("comparison-national", "compare", { target: { dataset: "national", side: "expenditure", seriesIds: [expenditure.seriesId] }, fromYear: expenditure.years[0], toYear: expenditure.years.at(-1), measure: "amount_gel" });
  for (const datasetId of ["national-expenditure", "national-revenue", "ministries"]) {
    for (const level of datasetId === "ministries" ? ["admin_category", "major_program"] : [null]) {
      run(`rank-${datasetId}-${level ?? "series"}`, "rank", { datasetId, dimension: "series", ...(level ? { level } : {}), year: getCatalogue(datasetId).datasets[0].years[1], measure: "amount_gel", metric: "value", limit: 100 });
    }
  }
  for (const entityType of ["municipality", "region"]) run(`rank-${entityType}`, "rank", { datasetId: "municipal-expenditure", dimension: "entities", entityType, seriesId: total.seriesId, year: latestYear, measure: "amount_gel", metric: "value", limit: 100 });
  const debt = getCatalogue("government-debt").series!;
  for (const family of ["stock", "service", "rate"]) {
    const series = debt.filter(series => series.seriesId.startsWith(`debt.${family}.`));
    run(`debt-${family}`, "queryDebt", { seriesIds: series.map(series => series.seriesId), years: [...new Set(series.flatMap(series => series.years))].sort((a, b) => a - b), measure: family === "rate" ? "rate_percent" : "amount_gel" });
  }
  run("deficit-actual-and-projection", "queryDeficit", { years: getCatalogue("general-government-balance").series![0].years, measure: "share_of_gdp_pct" });
  const productIndex = inflationProductIndex(snapshot);
  const productIds = [...productIndex.productById.keys()].sort();
  const firstProductPeriod = periodKey(Math.min(...[...productIndex.annual.values(), ...productIndex.monthly.values()].map(run => run.start)));
  const lastProductPeriod = periodKey(productIndex.latestPeriod);
  const startYear = Number(firstProductPeriod.slice(0, 4));
  const fullHistoryIds = productIds.filter(id => productIndex.productById.get(id)!.firstPeriod <= firstProductPeriod);
  const productRange = { fromPeriod: firstProductPeriod, toPeriod: lastProductPeriod };
  run("products-single-history", "queryInflationProducts", { seriesIds: fullHistoryIds.slice(0, 1), measure: "yoy_pct", ...productRange });
  run("products-annual-endpoints", "queryInflationProducts", { seriesIds: productIds.slice(0, LIMITS.series), measure: "yoy_pct", fromPeriod: lastProductPeriod, toPeriod: lastProductPeriod });
  run("products-cumulative-endpoints", "queryInflationProducts", { seriesIds: fullHistoryIds.slice(0, LIMITS.series), measure: "cumulative_pct", startYear, fromPeriod: lastProductPeriod, toPeriod: lastProductPeriod });
  run("products-500-output-cells", "queryInflationProducts", { seriesIds: fullHistoryIds.slice(0, 100), measure: "cumulative_pct", startYear, fromPeriod: periodKey(productIndex.latestPeriod - 4), toPeriod: lastProductPeriod }, 500);
  for (const measure of ["yoy_pct", "cumulative_pct"] as const) run(`products-${measure === "yoy_pct" ? "annual" : "cumulative"}-rank-100`, "rank", {
    datasetId: "inflation-products", dimension: "series", metric: "value", measure, period: lastProductPeriod, limit: LIMITS.rankMax,
    ...(measure === "cumulative_pct" ? { startYear } : {}),
  });
  // Pick the real annual month with the fewest available current-roster rows.
  // This includes late starts and published annual gaps, without inventing holes.
  const annualCounts = new Map<string, number>();
  for (const fact of snapshot.inflationProducts.facts) if (fact.measure === "yoy_index_100") annualCounts.set(fact.period, (annualCounts.get(fact.period) ?? 0) + Number(fact.index100 !== null));
  const missingHeavyPeriod = [...annualCounts].sort(([periodA, countA], [periodB, countB]) => countA - countB || periodA.localeCompare(periodB))[0][0];
  run("products-missing-history-rank-100", "rank", { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "yoy_pct", period: missingHeavyPeriod, limit: LIMITS.rankMax });
  const sourceIds = snapshot.sources.map(source => source.sourceId).sort();
  for (let index = 0; index < sourceIds.length; index += LIMITS.sourceIds) run(`sources-all-batch-${index / LIMITS.sourceIds + 1}`, "getSources", { sourceIds: sourceIds.slice(index, index + LIMITS.sourceIds) });
  const output = path.resolve(process.argv[outputIndex + 1]);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({
    measuredAt: new Date().toISOString(), dataVersion: snapshot.dataVersion, schemaVersion: snapshot.schemaVersion,
    releaseCommit: snapshot.releaseCommit, generatedAt: snapshot.generatedAt, snapshotBytes: statSync(SNAPSHOT_PATH).size,
    environment: { node: process.version, platform: process.platform, arch: process.arch, osRelease: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem() },
    methodology: {
      cold: "5 sequential fresh Node processes; sync read/JSON parse/schema-version validation/product index measured separately; processElapsedMs includes Node/tsx/module startup. OS page cache is uncontrolled.",
      warm: "10 sequential samples after 1 unmeasured warmup per query; shared parsed snapshot and product WeakMap index. Samples retain outliers; p95 is nearest-rank.",
      bytes: "UTF-8 complete unbounded and bounded tool results, including both languages, source documents and caveats. No HTTP/JSON-RPC/SDK framing; actual era wire evidence is Task 7. A refusal replaces the entire result, never trims evidence.",
      limits: "Local stage measurements, not a hosted latency guarantee. Request total excludes boot/HTTP/rate limiting. The unchanged ten-second platform ceiling is not a benchmark timeout promise.",
    },
    productScenarios: { firstProductPeriod, lastProductPeriod, startYear, historyMonthCount: periodFromKey(lastProductPeriod) - periodFromKey(firstProductPeriod) + 1, rosterCount: productIds.length, fullHistoryProductCount: fullHistoryIds.length, missingHeavyPeriod, missingHeavyAvailableCount: annualCounts.get(missingHeavyPeriod) },
    cold: { sampleCount: COLD_SAMPLES, samples: cold, timings: Object.fromEntries(["readMs", "parseMs", "indexMs", "totalMs", "processElapsedMs"].map(key => [key, summarize(cold.map(sample => sample[key as keyof typeof sample] as number))])) },
    limits: LIMITS, measurements,
  }, null, 2)}\n`);
  console.log(`Measured ${measurements.length} scenarios; report: ${output}`);
}

if (process.argv.includes("--cold-sample")) console.log(JSON.stringify(coldSample()));
else void main();
