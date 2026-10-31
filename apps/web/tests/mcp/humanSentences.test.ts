import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../lib/mcp/tools";

// The sentences a client quotes to a reader must be words. Identity stays in
// the *Id fields, so those, the ids echoed back in error messages and the
// measureNotes calling hints (which name `municipal.total` on purpose) are not
// sentences and are not scanned.
const SNAKE = /\b[a-z0-9]+(_[a-z0-9]+)+\b/g;
const DOTTED = /\b[a-z]+\.[a-z0-9_.]+\b/g;
const SKIPPED_KEY = /(Ids?$|^measureNotes(Ka|En)?$)/;

async function connected(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([createMcpServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const MUNICIPAL_YEARS = [2015, 2023, 2024, 2025];
const RANK_MUNICIPAL = { datasetId: "municipal-expenditure", dimension: "entities", entityType: "municipality", seriesId: "municipal.total" };
// The request matrix of the audit's scan: Khulo 2024, Batumi 2015/2023/2025, amount_gel totals,
// value and change rankings, filtered and product rankings.
const MATRIX: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ["query_municipal", { entityIds: ["11", "04", "region.adjara", "country.georgia"], seriesIds: ["municipal.total"], years: MUNICIPAL_YEARS, measure: "amount_gel" }],
  ["query_municipal", { entityIds: ["country.georgia"], seriesIds: ["municipal.total"], years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], measure: "amount_gel" }],
  ["query_municipal", { entityIds: ["11"], seriesIds: ["municipal.total"], years: [2025], measure: "gel_per_resident" }],
  ["query_municipal", { entityIds: ["11"], seriesIds: ["municipal.total"], years: [2024], measure: "share_of_total_pct" }],
  ["compare", { target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] }, measure: "amount_gel", fromYear: 2023, toYear: 2024 }],
  ["compare", { target: { dataset: "national", side: "expenditure", seriesIds: ["spending.education"] }, measure: "amount_gel", fromYear: 2020, toYear: 2025 }],
  ["rank", { ...RANK_MUNICIPAL, measure: "gel_per_resident", metric: "value", year: 2025, limit: 3 }],
  ["rank", { ...RANK_MUNICIPAL, withinRegionId: "region.adjara", measure: "amount_gel", metric: "percentage_change", fromYear: 2023, toYear: 2024, limit: 3 }],
  ["rank", { datasetId: "ministries", dimension: "series", level: "admin_category", measure: "amount_gel", metric: "value", year: 2025, limit: 3 }],
  ["rank", { datasetId: "ministries", dimension: "series", level: "major_program", parentSeriesId: "admin_spending.economy_sustainable_development", measure: "amount_gel", metric: "value", year: 2025, limit: 3 }],
  ["rank", { datasetId: "national-expenditure", dimension: "series", measure: "share_of_total_pct", metric: "percentage_point_change", fromYear: 2020, toYear: 2025, limit: 3 }],
  ["rank", { datasetId: "inflation", dimension: "series", level: "subgroup", parentSeriesId: "cpi.cat.01", measure: "yoy_pct", metric: "value", period: "2026-09", limit: 3 }],
  ["rank", { datasetId: "inflation", dimension: "series", level: "division", measure: "yoy_pct", metric: "percentage_point_change", fromPeriod: "2026-08", toPeriod: "2026-09", limit: 3 }],
  ["rank", { datasetId: "inflation", dimension: "entities", entityType: "city", seriesId: "cpi.cat.01", measure: "yoy_pct", metric: "value", period: "2026-09" }],
  ["rank", { datasetId: "inflation-products", dimension: "series", measure: "cumulative_pct", metric: "value", startYear: 2020, period: "2026-09", limit: 3 }],
  ["rank", { datasetId: "inflation-products", dimension: "series", measure: "yoy_pct", metric: "value", period: "2026-09", limit: 3 }],
  ["describe_coverage", {}],
  ["describe_coverage", { datasetId: "municipal-expenditure" }],
  ["describe_coverage", { search: "Khulo" }],
  ["query_national", { side: "expenditure", seriesIds: ["spending.education", "spending.other_unclassified"], years: [2004, 2025, 2026], measure: "amount_gel" }],
  ["query_national", { side: "revenue", seriesIds: ["revenue.vat"], years: [2004, 2025], measure: "share_of_gdp_pct" }],
  ["query_ministries", { level: "admin_category", seriesIds: ["admin_spending.total"], years: [2010, 2025], measure: "amount_gel" }],
  ["query_debt", { seriesIds: ["debt.stock.total"], years: [2020, 2025], measure: "share_of_gdp_pct" }],
  ["query_deficit", { years: [2024, 2025, 2026], measure: "share_of_gdp_pct" }],
  ["query_gdp", { seriesIds: ["nominal_usd", "real_growth_percent", "per_capita_gel"], years: [2005, 2024, 2025] }],
  ["query_economic_sectors", { seriesIds: ["sector.c"], years: [2024], measure: "real_growth_pct" }],
  ["query_regional_economies", { regionIds: ["region.imereti"], seriesIds: ["sector.c"], years: [2024], measure: "share_of_region_gdp_pct" }],
  ["query_inflation", { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-09" }],
  ["query_inflation", { seriesIds: ["cpi.cat.01"], measure: "contribution_pp", fromPeriod: "2026-09", toPeriod: "2026-09" }],
  ["query_inflation", { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-09", toPeriod: "2026-09", entityIds: ["city.batumi"] }],
  ["query_inflation_products", { seriesIds: ["cpi.product.p0004"], measure: "cumulative_pct", startYear: 2020, fromPeriod: "2026-09", toPeriod: "2026-09" }],
  ["get_sources", { sourceIds: ["source.municipal_portal_archive"], datasetId: "municipal-expenditure", years: [2024], entityIds: ["11"] }],
  ["get_sources", { sourceIds: ["source.municipal_portal_archive"] }],
];

/** Every string in `value` that reads as a sentence (contains whitespace) and holds an internal code. */
function codeLeaks(value: unknown, path: string, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => codeLeaks(item, `${path}[]`, found));
  else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) if (!SKIPPED_KEY.test(key)) codeLeaks(item, `${path}.${key}`, found);
  } else if (typeof value === "string" && /\s/.test(value.trim())) {
    const prose = value.replace(/https?:\/\/\S+/g, "");
    for (const token of [...(prose.match(SNAKE) ?? []), ...(prose.match(DOTTED) ?? [])]) {
      // Abbreviations and file names are words, not codes.
      if (/^(n\.e\.c|e\.g|i\.e|fiscal\.ge|.*\.(ge|org|com|gov|xlsx|pdf|csv|json))$/.test(token)) continue;
      found.push(`${path} :: ${token} :: ${value.slice(0, 120)}`);
    }
  }
  return found;
}

describe("sentences a reader sees", () => {
  it("never contain an internal measure, metric or id code", async () => {
    const client = await connected();
    const leaks: string[] = [];
    for (const [name, args] of MATRIX) {
      const result = await client.callTool({ name, arguments: args });
      // An error message echoes the caller's own ids by design; the matrix must still succeed.
      expect(result.isError ?? false, `${name} ${JSON.stringify(args)}`).toBe(false);
      codeLeaks(result.structuredContent, name, leaks);
    }
    expect(leaks).toEqual([]);
  });

  it("keeps every machine field in its code form", async () => {
    const client = await connected();
    const total = await client.callTool({ name: "query_municipal", arguments: MATRIX[0]![1] });
    const observations = (total.structuredContent as { data: { observations: Record<string, unknown>[] } }).data.observations;
    expect(observations.every((row) => row.measure === "amount_gel")).toBe(true);
    const ids = observations.map((row) => String(row.valueDefinitionId));
    expect(ids).toContain("municipal:amount_gel:total:total_payments");
    expect(ids).toContain("municipal:amount_gel:total:portal_functional_total_fallback");
    expect(ids).toContain("municipal:amount_gel:total:functional_total_fallback_missing_payment_actual");
  });
});
