import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare, type Comparison } from "../../lib/factQuery/compare";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let real: FactQuerySnapshot;
beforeAll(async () => { real = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-10-01T00:00:00Z" }); });
const id = "cpi.product.p0001";
const request = { target: { dataset: "inflation-products", seriesIds: [id] }, measure: "yoy_pct", fromPeriod: "2025-01", toPeriod: "2026-02" };
function fixture(missing = false): FactQuerySnapshot {
  return { ...real, inflationProducts: { catalogue: [{ productId: id, labelKa: "პური", labelEn: "Bread", coicopCode: "0111", firstPeriod: "2025-01" }], historyNotes: [], facts: [
    { productId: id, period: "2025-01", measure: "yoy_index_100", index100: "105", availability: "published", sourceId: "source.geostat_product_yoy" },
    { productId: id, period: "2026-02", measure: "yoy_index_100", index100: missing ? null : "108", availability: missing ? "not_published" : "published", sourceId: "source.geostat_product_yoy" },
  ] } };
}
function rows(snapshot = fixture()): Comparison[] {
  const response = compare(snapshot, request);
  if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
  return (response.data as { comparisons: Comparison[] }).comparisons;
}
describe("product annual comparison", () => {
  it("compares only endpoints and returns 3 percentage points for rates 5 and 8", () => {
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ from: { value: 5, period: "2025-01" }, to: { value: 8, period: "2026-02" }, percentagePointChange: 3, absoluteChange: null, percentageChange: null, comparability: "comparable" });
    const response = compare(fixture(), request);
    expect(response.kind === "comparisons" && (response.data as { coverage: { requestedPairs: number } }).coverage.requestedPairs).toBe(1);
  });
  it("keeps a missing endpoint and its reason without calculating a change", () => {
    expect(rows(fixture(true))[0]).toMatchObject({ from: { value: 5 }, to: { value: null, missingReasonEn: expect.stringContaining("2026-02") }, comparability: "not_comparable", percentagePointChange: null, absoluteChange: null, percentageChange: null });
  });
  it("preserves relevant reviewed history notes and caveats at both endpoints", () => {
    const snapshot = fixture();
    snapshot.inflationProducts.historyNotes = [{ productId: id, boundaryYear: 2026, noteKa: "ისტორია", noteEn: "Reviewed older identity" }];
    expect(rows(snapshot)[0]).toMatchObject({ comparability: "limited", from: { valueDefinitionEn: expect.stringContaining("Reviewed older identity") }, to: { valueDefinitionEn: expect.stringContaining("Reviewed older identity") }, caveatIds: expect.arrayContaining(["inflation_product_history_limits"]) });
  });
  it("refuses cumulative comparisons with direct-query and startYear guidance", () => {
    expect(compare(real, { ...request, measure: "cumulative_pct" })).toMatchObject({ kind: "error", error: { code: "unsupported_comparison", messageEn: expect.stringMatching(/query_inflation_products.*startYear/), messageKa: expect.stringContaining("startYear") } });
  });
  it("preserves strict input validation and snapshot consistency", () => {
    for (const extra of [{ fromYear: 2025 }, { toPeriod: "2025-01" }, { target: { ...request.target, entityIds: ["country.georgia"] } }]) expect(compare(real, { ...request, ...extra }).kind).toBe("error");
    expect(compare(real, { ...request, expectedDataVersion: "f".repeat(64) })).toMatchObject({ kind: "error", error: { code: "data_version_changed" } });
    expect(compare(real, { ...request, measure: "mom_pct" })).toMatchObject({ kind: "error", error: { code: "unsupported_measure" } });
  });
});
