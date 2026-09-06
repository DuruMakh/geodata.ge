import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactQuerySnapshot } from "../lib/factQuery/buildSnapshot";
import { describeCoverage, type CoverageData } from "../lib/factQuery/describeCoverage";
import { queryNational } from "../lib/factQuery/queryNational";
import { queryMinistries } from "../lib/factQuery/queryMinistries";
import { queryMunicipal } from "../lib/factQuery/queryMunicipal";
import { queryDebt } from "../lib/factQuery/queryDebt";
import { queryDeficit } from "../lib/factQuery/queryDeficit";
import { compare } from "../lib/factQuery/compare";
import { rank } from "../lib/factQuery/rank";
import { getSources } from "../lib/factQuery/getSources";
import type { Observation } from "../lib/factQuery/observations";
import type { FactQueryResponse } from "../lib/factQuery/types";
import { LIMITS, boundedToolResult, toolResult } from "../lib/mcp/result";

const outputIndex = process.argv.indexOf("--output");
if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error("Usage: tsx scripts/measure-bilingual-mcp.ts --output <report.json>");

async function main() {
  const snapshot = await buildFactQuerySnapshot({ releaseCommit: "bilingual-measurement", generatedAt: "2026-09-06T00:00:00Z" });
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
  const queries = { describeCoverage, queryNational, queryMinistries, queryMunicipal, queryDebt, queryDeficit, compare, rank, getSources };
  const measurements: Record<string, unknown>[] = [];
  function measure(name: string, tool: string, input: unknown, response: FactQueryResponse, elapsedMs: number, requestedCells: number | null = null) {
    const result = toolResult(response);
    const bounded = boundedToolResult(snapshot, response);
    const data = response.kind === "error" ? {} : response.data as Record<string, unknown>;
    const rows = data.observations ?? data.comparisons ?? data.entries ?? data.sources;
    const coverage = data.coverage as { expectedCount?: number; returnedCount?: number } | undefined;
    measurements.push({
      name, tool, input, status: response.status, kind: response.kind,
      errorCode: response.kind === "error" ? response.error.code : null,
      requestedCells: requestedCells ?? coverage?.expectedCount ?? null,
      returnedCount: coverage?.returnedCount ?? (Array.isArray(rows) ? rows.length : null),
      structuredBytes: bytes(result.structuredContent ?? null),
      textBytes: Buffer.byteLength(result.content.map(block => block.text).join("\n"), "utf8"),
      completeBytes: bytes(result), boundedBytes: bytes(bounded),
      isError: result.isError, boundedIsError: bounded.isError,
      limitOutcome: result.isError ? "input_or_query_error" : bounded.isError
        ? (Array.isArray(rows) && rows.length > (response.kind === "comparisons" ? LIMITS.comparisonPairs : LIMITS.cells) ? "cell_limit" : "byte_limit") : "accepted",
      elapsedMs,
    });
  }
  function run(name: string, tool: keyof typeof queries, input: unknown, requestedCells?: number) {
    const start = performance.now();
    const response = queries[tool](snapshot, input);
    measure(name, tool, input, response, performance.now() - start, requestedCells);
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
  measure("501-existing-cells-result-gate", "boundedToolResult fixture", [input500, extraInput], response501, 0, 501);
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
  const sourceIds = snapshot.sources.map(source => source.sourceId).sort();
  for (let index = 0; index < sourceIds.length; index += LIMITS.sourceIds) run(`sources-all-batch-${index / LIMITS.sourceIds + 1}`, "getSources", { sourceIds: sourceIds.slice(index, index + LIMITS.sourceIds) });
  const output = path.resolve(process.argv[outputIndex + 1]);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ dataVersion: snapshot.dataVersion, schemaVersion: snapshot.schemaVersion, limits: LIMITS, measurements }, null, 2)}\n`);
  console.log(`Measured ${measurements.length} scenarios; report: ${output}`);
}

void main();
