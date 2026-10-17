import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
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
import { inflationProductIndex, productQueryCoverage } from "../lib/factQuery/inflationProductData";
import { productCumulative } from "../lib/explorer/inflationProducts";
import type { QueryInflationProductsInput } from "../lib/factQuery/schemas";
import { queryInflationProducts } from "../lib/factQuery/queryInflationProducts";
import { periodFromKey, periodKey } from "../lib/data/inflation/periods";
import type { Observation } from "../lib/factQuery/observations";
import { SCHEMA_VERSION, type FactQueryResponse, type FactQuerySnapshot } from "../lib/factQuery/types";
import { LIMITS, boundedToolResult, toolResult } from "../lib/mcp/result";
import { loadPackagedSnapshot } from "../lib/mcp/snapshot";

const COLD_SAMPLES = 5;
const WARM_SAMPLES = 21;
const SNAPSHOT_PATH = path.join(process.cwd(), "lib/factQuery/generated/snapshot.json");
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
// Collect only at heap checkpoints, outside every timed phase. The same setting
// is used for before/after and in each fresh child process.
setFlagsFromString("--expose_gc");
const collectGarbage = runInNewContext("gc") as () => void;
const heap = (phase: string) => { collectGarbage(); return { phase, heapUsedBytes: process.memoryUsage().heapUsed }; };

function representativeInput(snapshot: FactQuerySnapshot): QueryInflationProductsInput {
  const index = inflationProductIndex(snapshot);
  const first = periodKey(Math.min(...[...index.annual.values(), ...index.monthly.values()].map(run => run.start)));
  const last = periodKey(index.latestPeriod);
  return {
    seriesIds: [...index.productById.keys()].sort().filter(id => index.productById.get(id)!.firstPeriod <= first).slice(0, LIMITS.series),
    measure: "cumulative_pct", startYear: Number(first.slice(0, 4)), fromPeriod: last, toPeriod: last,
  };
}

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    min: sorted[0], median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    max: sorted.at(-1), samples,
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
  const indexEnd = performance.now();
  const input = representativeInput(snapshot);
  const arithmeticStart = performance.now();
  for (const id of input.seriesIds) productCumulative(index, id, input.startYear!, index.latestPeriod);
  const arithmeticEnd = performance.now();
  productQueryCoverage(snapshot, input);
  const availabilityEnd = performance.now();
  const response = queryInflationProducts(snapshot, input);
  const queryEnd = performance.now();
  const result = boundedToolResult(snapshot, response);
  JSON.stringify(result);
  const end = performance.now();
  return {
    pid: process.pid, snapshotBytes: Buffer.byteLength(raw, "utf8"), dataVersion: snapshot.dataVersion,
    readMs: readEnd - start, parseMs: parseEnd - readEnd, validationMs: indexStart - parseEnd,
    indexMs: indexEnd - indexStart, firstArithmeticMs: arithmeticEnd - arithmeticStart,
    firstAvailabilityMs: availabilityEnd - arithmeticEnd, firstQueryMs: queryEnd - availabilityEnd,
    firstShapingMs: end - queryEnd, totalMs: end - start,
    firstQueryCells: input.seriesIds.length, firstResultBytes: bytes(result),
    productCount: index.productById.size, factCount: snapshot.inflationProducts.facts.length,
    annualRunCount: index.annual.size, monthlyRunCount: index.monthly.size,
  };
}

function measurementIdentity() {
  const stateIndex = process.argv.indexOf("--implementation-state");
  if (stateIndex < 0 || !process.argv[stateIndex + 1]) throw new Error("Unprimed measurement requires --implementation-state <label>");
  const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
  return {
    implementationState: process.argv[stateIndex + 1],
    implementationSha256: hash(path.join(process.cwd(), "lib/factQuery/inflationProductData.ts")),
    harnessSha256: hash(fileURLToPath(import.meta.url)),
    snapshotSha256: hash(SNAPSHOT_PATH),
    checkoutCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  };
}

// Select the same endpoint request from serialized facts alone. Calling the
// index or coverage helpers here would prime the query this mode must measure.
function unprimedSample() {
  const start = performance.now();
  const raw = readFileSync(SNAPSHOT_PATH, "utf8");
  const readEnd = performance.now();
  const snapshot = JSON.parse(raw) as FactQuerySnapshot;
  const parseEnd = performance.now();
  if (snapshot.schemaVersion !== SCHEMA_VERSION || !/^[0-9a-f]{64}$/.test(snapshot.dataVersion)) throw new Error("snapshot_incompatible");
  const validationEnd = performance.now();
  let first = "9999-12";
  let last = "0000-01";
  for (const fact of snapshot.inflationProducts.facts) {
    if (fact.period < first) first = fact.period;
    if (fact.period > last) last = fact.period;
  }
  const input: QueryInflationProductsInput = {
    seriesIds: snapshot.inflationProducts.catalogue.filter(product => product.firstPeriod <= first).map(product => product.productId).sort().slice(0, LIMITS.series),
    measure: "cumulative_pct", startYear: Number(first.slice(0, 4)), fromPeriod: last, toPeriod: last,
  };
  const queryStart = performance.now();
  // The first index build, lazy prefixes and availability fill occur only
  // inside this complete query. Nothing above calls product arithmetic.
  const response = queryInflationProducts(snapshot, input);
  const queryEnd = performance.now();
  const result = boundedToolResult(snapshot, response);
  const shapingEnd = performance.now();
  const serialized = JSON.stringify(result);
  const end = performance.now();
  if (response.kind !== "observations" || result.isError) throw new Error("Unprimed query must return observations within the result limit");
  return {
    ...measurementIdentity(), pid: process.pid, dataVersion: snapshot.dataVersion, schemaVersion: snapshot.schemaVersion,
    snapshotBytes: Buffer.byteLength(raw, "utf8"), input,
    readMs: readEnd - start, parseMs: parseEnd - readEnd, validationMs: validationEnd - parseEnd,
    inputPreparationMs: queryStart - validationEnd, firstQueryMs: queryEnd - queryStart,
    shapingMs: shapingEnd - queryEnd, serializationMs: end - shapingEnd,
    queryThroughShapingMs: end - queryStart, readThroughShapingMs: end - start,
    resultBytes: Buffer.byteLength(serialized, "utf8"), resultSha256: createHash("sha256").update(serialized).digest("hex"),
  };
}

async function unprimedMain() {
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error("Unprimed measurement requires --output <report.json>");
  const identity = measurementIdentity();
  const samples = Array.from({ length: COLD_SAMPLES }, () => {
    const start = performance.now();
    const sample = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", fileURLToPath(import.meta.url), "--unprimed-sample", "--implementation-state", identity.implementationState], {
      cwd: process.cwd(), encoding: "utf8", timeout: LIMITS.durationMs,
    })) as ReturnType<typeof unprimedSample>;
    if (sample.harnessSha256 !== identity.harnessSha256 || sample.implementationSha256 !== identity.implementationSha256 || sample.snapshotSha256 !== identity.snapshotSha256) throw new Error("Measurement files changed during the unprimed run");
    return { ...sample, processElapsedMs: performance.now() - start };
  });
  const phases = ["readMs", "parseMs", "validationMs", "inputPreparationMs", "firstQueryMs", "shapingMs", "serializationMs", "queryThroughShapingMs", "readThroughShapingMs", "processElapsedMs"] as const;
  const output = path.resolve(process.argv[outputIndex + 1]);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({
    mode: "unprimed-full-query", ...identity, measuredAt: new Date().toISOString(),
    dataVersion: samples[0].dataVersion, schemaVersion: samples[0].schemaVersion,
    environment: { node: process.version, platform: process.platform, arch: process.arch, osRelease: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem() },
    methodology: "Five fresh processes. Read/parse/validate snapshot, prepare input from plain facts, then run the first complete query once without index/arithmetic/availability priming. firstQueryMs includes initial index, lazy prefixes and availability fill. Shaping and JSON serialization are separate phases. Contiguous totals are directly timed, never sums of medians. processElapsedMs also includes Node/tsx/module startup and post-timing identity/result hashing. No HTTP/SDK/limiter or hosted latency claim; OS page cache/load uncontrolled.",
    sampleCount: COLD_SAMPLES, samples, timings: Object.fromEntries(phases.map(key => [key, summarize(samples.map(sample => sample[key]))])),
  }, null, 2)}\n`);
  console.log(`Measured ${COLD_SAMPLES} unprimed fresh processes; report: ${output}`);
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
  const memoryStages = [heap("loaded")];
  inflationProductIndex(snapshot);
  memoryStages.push(heap("indexed"));
  const representative = representativeInput(snapshot);
  queryInflationProducts(snapshot, representative);
  const availabilitySamples: number[] = [];
  const arithmeticSamples: number[] = [];
  const index = inflationProductIndex(snapshot);
  for (let sample = 0; sample < WARM_SAMPLES; sample++) {
    const arithmeticStart = performance.now();
    for (const id of representative.seriesIds) productCumulative(index, id, representative.startYear!, index.latestPeriod);
    arithmeticSamples.push(performance.now() - arithmeticStart);
    const start = performance.now();
    productQueryCoverage(snapshot, representative);
    availabilitySamples.push(performance.now() - start);
  }
  memoryStages.push(heap("representative-warm"));
  const supportedStartYears = Array.from({ length: Number(representative.toPeriod.slice(0, 4)) - index.earliestYear + 1 }, (_, offset) => index.earliestYear + offset);
  const productIdsForMemory = [...index.productById.keys()].sort();
  function exerciseKeys() {
    for (const id of productIdsForMemory) {
      productQueryCoverage(snapshot, { ...representative, seriesIds: [id], measure: "yoy_pct", startYear: undefined });
      for (const startYear of supportedStartYears) productQueryCoverage(snapshot, { ...representative, seriesIds: [id], startYear });
    }
  }
  exerciseKeys();
  memoryStages.push(heap("distinct-keys"));
  exerciseKeys();
  memoryStages.push(heap("repeat-keys"));
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
  run("product-search-milk", "describeCoverage", { datasetId: "inflation-products", search: "milk" });
  run("product-search-rice", "describeCoverage", { datasetId: "inflation-products", search: "rice" });
  run("city-discovery-batumi", "describeCoverage", { datasetId: "inflation", entityType: "city", search: "Batumi" });
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
  run("national-one-cell", "queryNational", { side: "expenditure", seriesIds: ["expenditure.total"], years: [2024], measure: "amount_gel" });
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
  // Real route/SDK envelopes, measured separately from pure query timings. This
  // local in-memory limiter makes no network calls; it is not hosted latency.
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  const { POST } = await import("../app/mcp/route");
  const wire = [];
  for (const name of ["national-one-cell", "product-search-milk", "product-search-rice", "city-discovery-batumi", "catalogue-inflation-products", "products-cumulative-endpoints", "products-cumulative-rank-100", "products-500-output-cells"]) {
    const scenario = measurements.find(sample => sample.name === name)!;
    const toolName = { queryNational: "query_national", queryInflationProducts: "query_inflation_products", describeCoverage: "describe_coverage", rank: "rank" }[scenario.tool as string]!;
    for (const protocol of ["2025-11-25", "2026-07-28"]) {
      const modern = protocol === "2026-07-28";
      const start = performance.now();
      const response = await POST(new Request("https://fiscal.ge/mcp", {
        method: "POST", headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": protocol, ...(modern ? { "mcp-method": "tools/call", "mcp-name": toolName } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", id: "measure", method: "tools/call", params: { name: toolName, arguments: scenario.input, ...(modern ? { _meta: { "io.modelcontextprotocol/protocolVersion": protocol, "io.modelcontextprotocol/clientInfo": { name: "measurement", version: "1" }, "io.modelcontextprotocol/clientCapabilities": {} } } : {}) } }),
      }));
      const text = await response.text();
      const body = JSON.parse(text);
      wire.push({ name, protocol, status: response.status, bytes: Buffer.byteLength(text, "utf8"), isError: body.result?.isError ?? true, localRouteElapsedMs: performance.now() - start });
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({
    measuredAt: new Date().toISOString(), dataVersion: snapshot.dataVersion, schemaVersion: snapshot.schemaVersion,
    releaseCommit: snapshot.releaseCommit, generatedAt: snapshot.generatedAt, snapshotBytes: statSync(SNAPSHOT_PATH).size,
    snapshotSha256: createHash("sha256").update(readFileSync(SNAPSHOT_PATH)).digest("hex"),
    checkoutCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    environment: { node: process.version, platform: process.platform, arch: process.arch, osRelease: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem() },
    methodology: {
      cold: "5 sequential fresh Node processes: read, parse, schema validation, index, first endpoint arithmetic (including lazy prefixes), initial availability fill, first full query (already primed arithmetic/availability), complete bounded shaping/serialization. totalMs is measured wall time, never a sum of medians; processElapsedMs adds Node/tsx/module startup. OS page cache uncontrolled.",
      warm: "21 sequential samples after 1 unmeasured query warmup; shared snapshot/index. Focused availability and endpoint arithmetic timed separately, before distinct-key exercise. General query timings follow distinct-key exercise. Retain outliers and report median/range, no local p95 claim.",
      bytes: "UTF-8 tool-result bytes plus real local POST route/SDK JSON-RPC envelopes for both protocol generations. Wire elapsed includes route/security/in-memory limiter/SDK validation/query/shaping/serialization, no network or hosted boot. A refusal replaces the entire result, never trims evidence.",
      memory: "Explicit GC at five untimed heap checkpoints; exercise each supported product x annual or cumulative start year, then repeat the same keys. Snapshot and prefix/index allocations included; allocator/GC noise prevents exact cache attribution. No arbitrary combination/window keys.",
      limits: "Local stage measurements, not a hosted latency guarantee. Request total excludes boot/HTTP/rate limiting. The unchanged ten-second platform ceiling is not a benchmark timeout promise.",
    },
    productScenarios: { firstProductPeriod, lastProductPeriod, startYear, historyMonthCount: periodFromKey(lastProductPeriod) - periodFromKey(firstProductPeriod) + 1, rosterCount: productIds.length, fullHistoryProductCount: fullHistoryIds.length, missingHeavyPeriod, missingHeavyAvailableCount: annualCounts.get(missingHeavyPeriod) },
    cold: { sampleCount: COLD_SAMPLES, samples: cold, timings: Object.fromEntries(["readMs", "parseMs", "indexMs", "firstArithmeticMs", "firstAvailabilityMs", "firstQueryMs", "firstShapingMs", "totalMs", "processElapsedMs"].map(key => [key, summarize(cold.map(sample => sample[key as keyof typeof sample] as number))])) },
    availability: { input: representative, requestedCells: representative.seriesIds.length, sampleCount: WARM_SAMPLES, timings: summarize(availabilitySamples), arithmeticTimings: summarize(arithmeticSamples) },
    memory: { distinctProductBaseKeys: productIdsForMemory.length * (supportedStartYears.length + 1), supportedStartYears, gcExposed: true, stages: memoryStages },
    limits: LIMITS, measurements, wire,
  }, null, 2)}\n`);
  console.log(`Measured ${measurements.length} scenarios; report: ${output}`);
}

if (process.argv.includes("--unprimed-sample")) console.log(JSON.stringify(unprimedSample()));
else if (process.argv.includes("--unprimed")) void unprimedMain();
else if (process.argv.includes("--cold-sample")) console.log(JSON.stringify(coldSample()));
else void main();
