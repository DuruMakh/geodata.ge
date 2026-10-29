import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";
import { TOOLS } from "../../lib/mcp/tools";
import { outputSchemaFor, toolOutput } from "../../lib/mcp/outputSchema";
import { toolResult } from "../../lib/mcp/result";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { rank } from "../../lib/factQuery/rank";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-09-04T00:00:00.000Z" });
});

it("validates scoped city discovery without changing the catalogue contract", () => {
  const response = describeCoverage(snapshot, { datasetId: "inflation", entityType: "city" });
  expect(outputSchemaFor("describe_coverage").safeParse(response).success).toBe(true);
  expect(response).toMatchObject({ kind: "catalogue", data: { datasets: [{ entityTypes: ["city"], measures: ["yoy_pct", "mom_pct", "avg12_pct"] }] } });
  const result = toolResult(response);
  expect(result.isError).toBe(false);
  expect(result.structuredContent).toEqual(response);
});

it("retains two-element period/year ranges with exact element types", () => {
  const response = TOOLS.find(tool => tool.name === "describe_coverage")!.run(snapshot, { datasetId: "inflation" });
  if (response.kind !== "catalogue") throw new Error("Expected catalogue");
  const schema = outputSchemaFor("describe_coverage");
  expect(schema.safeParse(response).success).toBe(true);
  for (const years of [[2020], [2020, 2021, 2022], ["2020", 2021]]) {
    const invalid = structuredClone(response);
    (invalid.data as { datasets: { years: unknown[] }[] }).datasets[0]!.years = years;
    expect(schema.safeParse(invalid).success).toBe(false);
  }
  for (const periods of [["2020-01"], ["2020-01", "2021-01", "2022-01"], [2020, "2021-01"]]) {
    const invalid = structuredClone(response);
    (invalid.data as { datasets: { periods: unknown[] }[] }).datasets[0]!.periods = periods;
    expect(schema.safeParse(invalid).success).toBe(false);
  }
});

/**
 * One real, successful call per tool. The SDK validates structuredContent
 * against the declared output schema and fails the call on a mismatch, so a
 * schema that does not match reality would break every request rather than
 * merely mis-describe one.
 */
const CALLS: Record<string, unknown> = {
  query_inflation_products: { seriesIds: ["cpi.product.p0001"], measure: "cumulative_pct", startYear: 2025, fromPeriod: "2025-12", toPeriod: "2025-12" },
  query_economic_sectors: { seriesIds: ["sector.a", "economy.gdp_total"], years: [2011, 2025], measure: "real_growth_pct" },
  query_regional_economies: { regionIds: ["region.imereti"], seriesIds: ["sector.a", "economy.regional_gdp_total"], years: [2024], measure: "share_of_region_gdp_pct" },
  query_gdp: {seriesIds:["real_usd_2015","nominal_usd","real_growth_percent"],years:[2025]},
  query_inflation: { seriesIds: ["cpi.cat.07"], measure: "contribution_pp", fromPeriod: "2026-08", toPeriod: "2026-08" },
  describe_coverage: { datasetId: "municipal-expenditure" },
  query_national: { side: "revenue", seriesIds: ["revenue.total"], years: [2024], measure: "amount_gel" },
  query_ministries: {
    level: "admin_category",
    seriesIds: ["admin_spending.defence"],
    years: [2024],
    measure: "amount_gel",
  },
  query_municipal: { entityIds: ["11"], seriesIds: ["municipal.total"], years: [2024], measure: "amount_gel" },
  compare: {
    target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
    fromYear: 2023,
    toYear: 2024,
    measure: "amount_gel",
  },
  rank: {
    datasetId: "municipal-expenditure",
    dimension: "entities",
    entityType: "municipality",
    seriesId: "municipal.total",
    year: 2025,
    measure: "amount_gel",
    metric: "value",
    order: "descending",
    limit: 5,
  },
  get_sources: { sourceIds: ["source.municipal_mof_annual_and_history_workbooks"] },
  query_debt: { seriesIds: ["debt.stock.total"], years: [2024], measure: "amount_gel" },
  query_deficit: { years: [2020], measure: "share_of_gdp_pct" },
};

describe("every tool's structured output matches its declared schema", () => {
  it("validates all four outcomes emitted by the source lookup", () => {
    const getSourcesTool = TOOLS.find(tool => tool.name === "get_sources")!;
    for (const [input, outcome] of [
      [{ sourceIds: ["source.mof_2017_revenue_form1_pdf"] }, "not_requested"],
      [{ sourceIds: ["source.mof_2017_revenue_form1_pdf"], years: [2017] }, "applied"],
      [{ sourceIds: ["source.mof_2017_revenue_form1_pdf"], years: [2020] }, "dropped_no_match"],
      [{ sourceIds: ["source.adjara_consolidated_budget"], years: [2020] }, "preserved_derived"],
    ]) {
      const response = getSourcesTool.run(snapshot, input);
      expect(response).toMatchObject({ kind: "sources", data: { sources: [{ narrowingOutcome: outcome, narrowed: false }] } });
      expect(outputSchemaFor("get_sources").parse(response)).toEqual(response);
      expect(toolOutput.parse(response)).toEqual(response);
    }
  });

  it("accepts preserved derived evidence alongside every existing narrowing outcome", () => {
    const response = TOOLS.find(tool => tool.name === "get_sources")!.run(snapshot, CALLS.get_sources);
    if (response.kind !== "sources") throw new Error("Expected sources");
    const schema = outputSchemaFor("get_sources");
    for (const outcome of ["not_requested", "applied", "dropped_no_match", "preserved_derived"]) {
      const sample = structuredClone(response);
      (sample.data as { sources: { narrowingOutcome: string }[] }).sources[0]!.narrowingOutcome = outcome;
      expect(schema.safeParse(sample).success, outcome).toBe(true);
      expect(toolOutput.safeParse(sample).success, outcome).toBe(true);
    }
    const invalid = structuredClone(response);
    (invalid.data as { sources: { narrowingOutcome: string }[] }).sources[0]!.narrowingOutcome = "invented_outcome";
    expect(schema.safeParse(invalid).success).toBe(false);
  });
  it("declares and retains every public product catalogue field", () => {
    const response = describeCoverage(snapshot, { datasetId: "inflation-products" });
    if (response.kind !== "catalogue") throw new Error("Expected product catalogue");
    const schema = outputSchemaFor("describe_coverage");
    expect(schema.parse(response)).toEqual(response);
    for (const [field, value] of Object.entries({ coicopCode: 1, firstPeriod: "2019-13", measures: ["mom_pct"], historyNotes: [{ boundaryYear: "2019", noteKa: "note", noteEn: "note" }] })) {
      const invalid = structuredClone(response);
      (invalid.data as { series: Record<string, unknown>[] }).series[0]![field] = value;
      expect(schema.safeParse(invalid).success, field).toBe(false);
    }
  });

  it("declares and retains cumulative ranking bases, rejecting invalid bases", () => {
    const response = rank(snapshot, { datasetId: "inflation-products", dimension: "series", measure: "cumulative_pct", metric: "value", startYear: 2015, period: "2026-08" });
    if (response.kind !== "ranking") throw new Error("Expected product ranking");
    const schema = outputSchemaFor("rank");
    expect(schema.parse(response)).toEqual(response);
    const invalid = structuredClone(response);
    (invalid.data as { entries: { calculationBasePeriod: unknown }[] }).entries[0]!.calculationBasePeriod = 2014;
    expect(schema.safeParse(invalid).success).toBe(false);
  });
  for (const tool of TOOLS) {
    it(`${tool.name} returns structuredContent the schema accepts`, () => {
      const input = CALLS[tool.name];
      expect(input, `no probe call defined for ${tool.name}`).toBeDefined();

      const response = tool.run(snapshot, input);
      if (response.kind === "error") throw new Error(`${tool.name}: ${response.error.messageEn}`);

      const result = toolResult(response);
      expect(result.structuredContent).toBeDefined();
      expect(outputSchemaFor(tool.name).parse(result.structuredContent)).toEqual(result.structuredContent);

      const parsed = toolOutput.safeParse(result.structuredContent);
      if (!parsed.success) {
        throw new Error(`${tool.name} failed its own output schema: ${JSON.stringify(parsed.error.issues, null, 2)}`);
      }
    });
  }

  // Every probe above must exist, or a tool could be added without ever being
  // validated against the schema it now advertises.
  it("covers every tool", () => {
    expect(Object.keys(CALLS).sort()).toEqual(TOOLS.map((tool) => tool.name).sort());
  });

  it("accepts transported empty city coverage with no available period span", () => {
    const emptySnapshot = { ...snapshot, inflation: { ...snapshot.inflation, cities: [] } };
    const response = TOOLS.find((tool) => tool.name === "query_inflation")!.run(emptySnapshot, {
      entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2019-06", toPeriod: "2019-06",
    });
    const result = toolResult(response);
    expect(result.structuredContent).toMatchObject({ status: "empty", data: { observations: [{ value: null }], coverage: { availablePeriods: null, availableYears: [] } } });
    expect(outputSchemaFor("query_inflation").safeParse(result.structuredContent).success).toBe(true);
    expect(toolOutput.safeParse(result.structuredContent).success).toBe(true);
  });

  it("declares a null period span as valid for a transported no-data answer", () => {
    const emptySnapshot = { ...snapshot, inflation: { ...snapshot.inflation, cities: [] } };
    const response = TOOLS.find((tool) => tool.name === "query_inflation")!.run(emptySnapshot, {
      entityIds: ["city.batumi"], seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2019-06", toPeriod: "2019-06",
    });
    const result = toolResult(response);
    const structured = result.structuredContent as { data: { coverage: Record<string, unknown> } };
    structured.data.coverage.availablePeriods = null;
    structured.data.coverage.availableYears = [];
    expect(outputSchemaFor("query_inflation").safeParse(structured).success).toBe(true);
  });

  // A failed call carries no structured payload, which is why the schema
  // describes successes only.
  it("attaches no structuredContent to an error, so the schema is never applied to one", () => {
    const failed = TOOLS.find((tool) => tool.name === "query_municipal")!.run(snapshot, { entityIds: [] });
    expect(failed.kind).toBe("error");

    const result = toolResult(failed);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });
});

describe("ranking provenance fields", () => {
  const municipalTop5 = () => rank(snapshot, { datasetId: "municipal-expenditure", dimension: "entities", entityType: "municipality", seriesId: "municipal.total", measure: "gel_per_resident", metric: "value", year: 2025, limit: 5 });
  const productTop5 = () => rank(snapshot, { datasetId: "inflation-products", dimension: "series", measure: "cumulative_pct", metric: "value", period: "2026-09", startYear: 2020, limit: 5 });

  it("declares inputDocumentIds on a source and affectsOtherCount on a caveat, and accepts a real ranking carrying them", () => {
    const schema = outputSchemaFor("rank");
    const municipal = municipalTop5();
    const products = productTop5();
    expect(municipal.meta.sources.some((source) => (source.inputDocumentIds ?? []).length > 0)).toBe(true);
    expect(products.meta.caveats.some((caveat) => typeof caveat.affectsOtherCount === "number")).toBe(true);
    expect(schema.safeParse(municipal).success).toBe(true);
    expect(schema.safeParse(products).success).toBe(true);

    const bad = structuredClone(municipal);
    bad.meta.sources[0]!.inputDocumentIds = [1 as unknown as string];
    expect(schema.safeParse(bad).success).toBe(false);
  });

  it("says in the text twin which documents are ids only and that caveat lists were narrowed", () => {
    const municipalText = toolResult(municipalTop5()).content[0]!.text;
    expect(municipalText).toMatch(/^inputs \(ids only, used to establish the order; call get_sources with this sourceId, narrowed with years\/entityIds\): \S+/m);
    expect(toolResult(productTop5()).content[0]!.text).toMatch(/affects: \S+(,\S+)* \(\+\d+ not listed; only the returned rows are named\)/);
  });
});
