import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { queryInflationProducts, productQueryCellCount } from "../../lib/factQuery/queryInflationProducts";
import { productQueryCoverage } from "../../lib/factQuery/inflationProductData";
import { observationSchema, queryInflationProductsInput, queryInflationInput } from "../../lib/factQuery/schemas";
import type { Observation } from "../../lib/factQuery/observations";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";
import type { ProductSnapshotFact } from "../../lib/factQuery/inflationProductSeries";

const id = "cpi.product.p0001";
let real: FactQuerySnapshot;
beforeAll(async () => { real = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-10-01T00:00:00Z" }); });
const fact = (period: string, index100: string | null, measure: ProductSnapshotFact["measure"] = "mom_index_100", productId = id): ProductSnapshotFact =>
  ({ productId, period, index100, measure, availability: index100 === null ? "not_published" : "published", sourceId: measure === "mom_index_100" ? "source.geostat_product_mom" : "source.geostat_product_yoy" });
function synthetic(facts = [fact("2026-01", "101"), fact("2026-02", "102"), fact("2026-01", "150", "yoy_index_100"), fact("2026-02", "160", "yoy_index_100")], firstPeriod = "2026-01"): FactQuerySnapshot {
  return { ...real, inflationProducts: { catalogue: [{ productId: id, labelKa: "პროდუქტი", labelEn: "Product", coicopCode: "0111", firstPeriod }], facts, historyNotes: [] } };
}
function rows(response: FactQueryResponse): Observation[] {
  if (response.kind !== "observations") throw new Error(JSON.stringify(response));
  return (response.data as { observations: Observation[] }).observations;
}
const input = (measure = "yoy_pct", fromPeriod = "2026-02", toPeriod = fromPeriod, startYear?: number) => ({ seriesIds: [id], measure, fromPeriod, toPeriod, ...(startYear === undefined ? {} : { startYear }) });
const errorCode = (response: FactQueryResponse) => response.kind === "error" ? response.error.code : response.status;

describe("queryInflationProducts", () => {
  it("names the first required January when compounding starts after the monthly run", () => {
    const snapshot = synthetic([
      fact("2025-01", "101"), fact("2025-02", "102"), fact("2026-01", "110", "yoy_index_100"),
    ], "2025-01");
    const row = rows(queryInflationProducts(snapshot, input("cumulative_pct", "2026-01", undefined, 2026)))[0]!;
    expect(row).toMatchObject({ value: null, availability: "missing", calculationBasePeriod: "2025-12" });
    expect(row.missingReasonEn).toContain("2026-01");
    expect(row.missingReasonEn).not.toContain("2025-03");
  });
  it("uses the published annual index rather than monthly compounding", () => {
    const [row] = rows(queryInflationProducts(synthetic(), input()));
    expect(row).toMatchObject({ value: 60, unit: "percent", basis: "published", sourceIds: ["source.geostat_product_yoy"] });
    expect(row).not.toHaveProperty("calculationBasePeriod");
    observationSchema.parse(row);
  });
  it("consumes January for a one-month February output and cites upstream inputs without changing originals", () => {
    const snapshot = synthetic();
    const originals = JSON.stringify(snapshot.sources);
    const response = queryInflationProducts(snapshot, input("cumulative_pct", "2026-02", undefined, 2026));
    const [row] = rows(response);
    expect(row).toMatchObject({ value: 3.02, calculationBasePeriod: "2025-12", sourceIds: ["source.geostat_product_mom"], caveatIds: ["inflation_product_cumulative_derived"] });
    expect(row!.valueDefinitionEn).toContain("Fiscal.ge");
    expect(row!.valueDefinitionEn).toContain("2025-12");
    observationSchema.parse(row);
    expect(response.meta.sources[0]!.derivationEn).toContain("Fiscal.ge");
    expect(response.meta.sources[0]!.documents.every(doc => (doc.role ?? response.meta.sources[0]!.documentDefaults?.role) === "derivation_upstream")).toBe(true);
    expect(JSON.stringify(snapshot.sources)).toBe(originals);
    expect(queryInflationProducts(snapshot, input()).meta.sources[0]!.derivation).toBeNull();
  });
  it("returns multiple endpoints with one base, and distinguishes identities across bases", () => {
    const facts = Array.from({ length: 14 }, (_, offset) => fact(`${offset < 12 ? 2025 : 2026}-${String(offset % 12 + 1).padStart(2, "0")}`, offset === 0 ? "110" : "100"));
    const snapshot = synthetic(facts, "2025-01");
    const old = rows(queryInflationProducts(snapshot, input("cumulative_pct", "2026-01", "2026-02", 2025)));
    const newer = rows(queryInflationProducts(snapshot, input("cumulative_pct", "2026-02", undefined, 2026)))[0]!;
    expect(old.map(row => row.value)).toEqual([10, 10]);
    expect(old.map(row => row.calculationBasePeriod)).toEqual(["2024-12", "2024-12"]);
    expect(newer.value).toBe(0);
    expect(old[1]!.observationId).not.toBe(newer.observationId);
    expect(old[1]!.valueDefinitionId).not.toBe(newer.valueDefinitionId);
  });
  it.each([["100", 0], ["98", -2]])("keeps genuine zero and negative change for index %s", (value, expected) => {
    const snapshot = synthetic([fact("2026-01", value), fact("2026-01", value, "yoy_index_100")]);
    for (const measure of ["yoy_pct", "cumulative_pct"]) expect(rows(queryInflationProducts(snapshot, input(measure, "2026-01", undefined, measure === "cumulative_pct" ? 2026 : undefined)))[0]).toMatchObject({ value: expected, availability: "available" });
  });
  it("handles first-year 2015 and completed December without needing a December source row", () => {
    const snapshot = synthetic(Array.from({ length: 12 }, (_, month) => fact(`2015-${String(month + 1).padStart(2, "0")}`, month === 0 ? "101" : "100")), "2015-01");
    expect(rows(queryInflationProducts(snapshot, input("cumulative_pct", "2015-12", undefined, 2015)))[0]).toMatchObject({ value: 1, calculationBasePeriod: "2014-12" });
  });
  it("reports a late start and the actual first missing input, while ignoring earlier gaps", () => {
    const late = synthetic([fact("2026-02", "102")], "2026-02");
    const lateRow = rows(queryInflationProducts(late, input("cumulative_pct", "2026-02", undefined, 2026)))[0]!;
    expect(lateRow.value).toBeNull();
    expect(lateRow.missingReasonEn).toContain("2026-02");
    const broken = synthetic([fact("2025-12", null), fact("2026-01", "101"), fact("2026-02", null), fact("2026-03", "102")], "2025-12");
    const early = rows(queryInflationProducts(broken, input("cumulative_pct", "2026-01", undefined, 2026)))[0]!;
    expect(early.value).toBe(1);
    const missing = rows(queryInflationProducts(broken, input("cumulative_pct", "2026-03", undefined, 2026)))[0]!;
    expect(missing).toMatchObject({ value: null, availability: "missing", basis: null });
    expect(missing.missingReasonEn).toContain("2026-02");
    expect(productQueryCoverage(broken, input("cumulative_pct", "2026-01", "2026-03", 2026) as never)).toEqual({ availablePeriods: ["2026-01", "2026-01"], availableYears: [2026] });
  });
  it("reports earlier missing inputs before an unavailable endpoint", () => {
    const snapshot = synthetic([fact("2026-01", null), fact("2026-02", "102"), fact("2026-03", "160", "yoy_index_100")]);
    expect(rows(queryInflationProducts(snapshot, input("cumulative_pct", "2026-03", undefined, 2026)))[0]!.missingReasonEn).toContain("2026-01");
  });
  it("keeps annual missing source values null and names their month", () => {
    const snapshot = synthetic([fact("2026-01", "100"), fact("2026-01", null, "yoy_index_100")]);
    const row = rows(queryInflationProducts(snapshot, input("yoy_pct", "2026-01")))[0]!;
    expect(row).toMatchObject({ value: null, availability: "missing" });
    expect(row.missingReasonEn).toContain("2026-01");
  });
  it("scopes history limits to the selected boundary span and the label discrepancy to its product", () => {
    const snapshot = synthetic([fact("2025-01", "100"), fact("2026-01", "100"), fact("2025-01", "110", "yoy_index_100"), fact("2026-01", "110", "yoy_index_100")], "2025-01");
    snapshot.inflationProducts.historyNotes = [{ productId: id, boundaryYear: 2025, noteKa: "კავშირი", noteEn: "Reviewed link" }, { productId: "cpi.product.p9999", boundaryYear: 2026, noteKa: "სხვა", noteEn: "Unrelated" }];
    expect(rows(queryInflationProducts(snapshot, input("yoy_pct", "2025-01")))[0]!.caveatIds).toContain("inflation_product_history_limits");
    expect(rows(queryInflationProducts(snapshot, input("yoy_pct", "2026-01")))[0]!.caveatIds).not.toContain("inflation_product_history_limits");
    const result = queryInflationProducts(real, { ...input("yoy_pct", "2026-08"), seriesIds: ["cpi.product.p0148", id] });
    expect(rows(result)[0]!.caveatIds).toContain("inflation_product_label_discrepancy");
    expect(rows(result)[1]!.caveatIds).not.toContain("inflation_product_label_discrepancy");
  });
  it("discloses retrospectively labelled older histories but excludes newer spans", () => {
    for (const [measure, period, startYear, expected] of [
      ["yoy_pct", "2016-01", undefined, true], ["yoy_pct", "2020-01", undefined, false],
      ["cumulative_pct", "2016-12", 2015, true], ["cumulative_pct", "2020-01", 2020, false],
      ["cumulative_pct", "2020-01", 2015, true],
    ] as const) {
      const response = queryInflationProducts(real, { ...input(measure, period, period, startYear), seriesIds: ["cpi.product.p0088"] });
      const row = rows(response)[0]!;
      expect(row.caveatIds.includes("inflation_product_history_limits")).toBe(expected);
      if (expected) expect(row.valueDefinitionEn).toContain("generic mineral water");
    }
    const discrepancy = rows(queryInflationProducts(real, { ...input("yoy_pct", "2016-01"), seriesIds: ["cpi.product.p0148"] }))[0]!;
    expect(discrepancy.caveatIds).toContain("inflation_product_label_discrepancy");
  });
  it("retains conservative splits as missing without bridging the earlier product", () => {
    const response = queryInflationProducts(real, { ...input("cumulative_pct", "2026-08", undefined, 2015), seriesIds: ["cpi.product.p0051"] });
    expect(rows(response)[0]).toMatchObject({ value: null, availability: "missing", calculationBasePeriod: "2014-12" });
    expect(rows(response)[0]!.missingReasonEn).toContain("2017-01");
    expect(rows(response)[0]!.caveatIds).toContain("inflation_product_history_limits");
    expect(rows(response)[0]!.caveatIds).toContain("inflation_product_cumulative_derived");
  });
  it.each([
    { fromPeriod: "2026-13" }, { toPeriod: "2026-01" }, { measure: "mom_pct" }, { startYear: 2026 }, { entityIds: ["country.georgia"] }, { currency: "GEL" }, { seriesIds: [] }, { seriesIds: [id, id] },
    { measure: "cumulative_pct" }, { measure: "cumulative_pct", startYear: 2027 }, { measure: "cumulative_pct", startYear: 2026.5 },
  ])("rejects invalid fields %j", fields => expect(errorCode(queryInflationProducts(synthetic(), { ...input(), ...fields }))).toBe("invalid_parameters"));
  it("rejects retired/unknown IDs, stale snapshots, output and calculation years outside coverage", () => {
    for (const unknown of ["cpi.product.p9999", "retired.product"]) expect(errorCode(queryInflationProducts(synthetic(), { ...input(), seriesIds: [unknown] }))).toBe("unknown_series");
    expect(errorCode(queryInflationProducts(synthetic(), { ...input(), expectedDataVersion: "0".repeat(64) }))).toBe("data_version_changed");
    expect(errorCode(queryInflationProducts(synthetic(), input("yoy_pct", "2025-12")))).toBe("year_out_of_range");
    expect(errorCode(queryInflationProducts(synthetic(), input("cumulative_pct", "2026-02", undefined, 2025)))).toBe("year_out_of_range");
    expect(productQueryCellCount(input("cumulative_pct", "2026-01", "2026-02", 2015))).toBe(2);
    expect(queryInflationProductsInput.safeParse(input()).success).toBe(true);
    expect(queryInflationInput.safeParse(input("cumulative_pct", "2026-02", undefined, 2026)).success).toBe(false);
  });
  it("agrees with independent reviewed annual and complete-year cumulative expectations", () => {
    expect(rows(queryInflationProducts(real, input("yoy_pct", "2026-08")))[0]!.value).toBe(1.8973);
    expect(rows(queryInflationProducts(real, input("cumulative_pct", "2025-12", undefined, 2025)))[0]!.value).toBeCloseTo(-13.7927891681444, 12);
  });
  it("reports mixed availability and coverage without treating a late-start product as zero", () => {
    const response = queryInflationProducts(real, { ...input("yoy_pct", "2015-01"), seriesIds: [id, "cpi.product.p0051"] });
    expect(response).toMatchObject({ status: "partial", data: { coverage: { expectedCount: 2, returnedCount: 1, missingCells: [{ seriesId: "cpi.product.p0051", period: "2015-01" }] } } });
    expect(rows(response)[1]!.missingReasonEn).toContain("2017-01");
    const unknown = queryInflationProducts(real, { ...input("yoy_pct", "2026-08"), seriesIds: ["cpi.product.p9999"] });
    if (unknown.kind !== "error") throw new Error("Expected unknown_series");
    expect(unknown.error.validChoices!.length).toBeLessThanOrEqual(20);
    expect(unknown.error.validChoices!.every(choice => real.inflationProducts.catalogue.some(product => product.productId === choice))).toBe(true);
  });
});
