import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { rank, type RankData } from "../../lib/factQuery/rank";
import { queryInflationProducts } from "../../lib/factQuery/queryInflationProducts";
import { queryInflationProductsInput, rankInput } from "../../lib/factQuery/schemas";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let real: FactQuerySnapshot;
beforeAll(async () => { real = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-10-01T00:00:00Z" }); });
const request = { datasetId: "inflation-products", dimension: "series", metric: "value", measure: "yoy_pct", period: "2026-02" };
const id = (n: number) => `cpi.product.p${String(n).padStart(4, "0")}`;
function fixture(): FactQuerySnapshot {
  const values = ["100", "98", "105", "105", null, "105.00001"];
  return { ...real, inflationProducts: { catalogue: values.map((_, n) => ({ productId: id(n + 1), labelKa: `პროდუქტი ${n + 1}`, labelEn: `Product ${n + 1}`, coicopCode: "0111", firstPeriod: "2026-01" })), historyNotes: [], facts: values.flatMap((value, n) => [
    { productId: id(n + 1), period: "2026-02", measure: "yoy_index_100" as const, index100: value, availability: value === null ? "not_published" as const : "published" as const, sourceId: "source.geostat_product_yoy" },
    { productId: id(n + 1), period: "2026-01", measure: "mom_index_100" as const, index100: n === 4 ? null : "100", availability: n === 4 ? "not_published" as const : "published" as const, sourceId: "source.geostat_product_mom" },
    { productId: id(n + 1), period: "2026-02", measure: "mom_index_100" as const, index100: value, availability: value === null ? "not_published" as const : "published" as const, sourceId: "source.geostat_product_mom" },
  ]) } };
}
const data = (response: FactQueryResponse): RankData => {
  if (response.kind !== "ranking") throw new Error(JSON.stringify(response));
  return response.data as RankData;
};
describe("product value ranking", () => {
  it("orders unrounded values, deterministic ties, zeros and negatives while excluding missing values", () => {
    const result = data(rank(fixture(), { ...request, limit: 2 }));
    expect(result.universe).toMatchObject({ candidateCount: 6, eligibleCount: 5, returnedCount: 2, cutoffSplitsTie: true });
    expect(result.entries).toMatchObject([{ seriesId: id(6), value: 5.00001, tied: false }, { seriesId: id(3), value: 5, tied: true }]);
    expect(result.exclusions).toMatchObject([{ ids: [id(5)], reasonEn: expect.stringContaining("2026-02") }]);
    const ascending = data(rank(fixture(), { ...request, order: "ascending", limit: 100 }));
    expect(ascending.entries.map(row => [row.seriesId, row.value])).toEqual([[id(2), -2], [id(1), 0], [id(3), 5], [id(4), 5], [id(6), 5.00001]]);
    expect(ascending.entries.every(row => !("calculationBasePeriod" in row))).toBe(true);
  });
  it("uses complete cumulative histories, baseline-aware entries and upstream evidence", () => {
    const snapshot = fixture();
    const originals = JSON.stringify(snapshot.sources);
    const response = rank(snapshot, { ...request, measure: "cumulative_pct", startYear: 2026, limit: 100 });
    const result = data(response);
    expect(result.universe).toMatchObject({ candidateCount: 6, eligibleCount: 5 });
    expect(result.entries[0]).toMatchObject({ value: 5.00001, calculationBasePeriod: "2025-12" });
    expect(result.exclusions[0]).toMatchObject({ ids: [id(5)], reasonEn: expect.stringContaining("2026-01") });
    expect(result.rankingDefinitionEn).toContain("2025-12");
    expect(response.meta.caveats).toContainEqual(expect.objectContaining({ code: "inflation_product_cumulative_derived", affects: expect.arrayContaining([`${id(5)}:2026-02`]) }));
    expect(response.meta.sources[0]).toMatchObject({ sourceId: "source.geostat_product_mom", derivationEn: expect.stringContaining("Fiscal.ge"), documentDefaults: { role: "derivation_upstream" } });
    expect(JSON.stringify(snapshot.sources)).toBe(originals);
  });
  it("ranks all 305 current products through bounded queries and merges evidence across batches", () => {
    const snapshot = fixture();
    const original = snapshot.inflationProducts;
    snapshot.inflationProducts = { catalogue: Array.from({ length: 305 }, (_, n) => ({ ...original.catalogue[0]!, productId: id(n + 1) })), facts: Array.from({ length: 305 }, (_, n) => ({ ...original.facts[0]!, productId: id(n + 1), index100: n === 304 ? "180" : "100" })), historyNotes: [{ productId: id(1), boundaryYear: 2026, noteKa: "ერთი", noteEn: "First batch" }, { productId: id(305), boundaryYear: 2026, noteKa: "ბოლო", noteEn: "Last batch" }] };
    const response = rank(snapshot, request);
    expect(data(response).universe).toMatchObject({ candidateCount: 305, eligibleCount: 305, returnedCount: 10 });
    expect(data(response).entries[0]).toMatchObject({ seriesId: id(305), value: 80 });
    expect(response.meta.caveats).toContainEqual(expect.objectContaining({ code: "inflation_product_history_limits", affects: expect.arrayContaining([`${id(1)}:2026-02`, `${id(305)}:2026-02`]) }));
    expect(queryInflationProductsInput.safeParse({ seriesIds: snapshot.inflationProducts.catalogue.map(row => row.productId), measure: "yoy_pct", fromPeriod: "2026-02", toPeriod: "2026-02" }).success).toBe(false);
  });
  it("keeps defaults, hard limits, illegal filter refusals and snapshot-version guards", () => {
    for (const extra of [{ dimension: "entities" }, { level: "division" }, { parentSeriesId: id(1) }, { entityType: "city" }, { seriesId: id(1) }, { withinRegionId: "region.kakheti" }, { year: 2026 }, { fromYear: 2025 }, { fromPeriod: "2026-01" }, { metric: "percentage_point_change", fromPeriod: "2026-01", toPeriod: "2026-02" }, { startYear: 2026 }, { measure: "mom_pct" }, { limit: 101 }, { limit: 0 }, { measure: "cumulative_pct" }, { measure: "cumulative_pct", startYear: 2027 }]) expect(rankInput.safeParse({ ...request, ...extra }).success).toBe(false);
    expect(rank(real, { ...request, expectedDataVersion: "f".repeat(64) })).toMatchObject({ kind: "error", error: { code: "data_version_changed" } });
    const unknown = queryInflationProducts(real, { seriesIds: ["cpi.product.p9999"], measure: "yoy_pct", fromPeriod: "2026-02", toPeriod: "2026-02" });
    expect(unknown.kind).toBe("error");
    if (unknown.kind === "error") { expect(unknown.error.validChoices?.length).toBeLessThanOrEqual(20); expect(unknown.error.validChoices?.every(choice => real.inflationProducts.catalogue.some(row => row.productId === choice))).toBe(true); }
  });
});
