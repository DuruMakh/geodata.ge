// apps/web/tests/factQuery/compareInflation.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare, type Comparison } from "../../lib/factQuery/compare";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function comparisons(response: FactQueryResponse): Comparison[] {
  if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
  return (response.data as { comparisons: Comparison[] }).comparisons;
}

const national = (seriesId: string, measure: string, period: string) =>
  snapshot.inflation.facts.find((f) => f.seriesId === seriesId && f.measure === measure && f.period === period)!.value;

describe("compare on inflation", () => {
  it("gives a percentage-point change between two months", () => {
    const [row] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" }));
    expect(row).toMatchObject({
      comparisonId: "inflation:country.georgia:cpi.headline:2025-08-2026-08:yoy_pct",
      comparability: "comparable",
      unit: "percent",
      absoluteChange: null,
      percentageChange: null,
    });
    expect(row!.from.period).toBe("2025-08");
    expect(row!.to.period).toBe("2026-08");
    expect(row!.percentagePointChange!).toBeCloseTo(national("cpi.headline", "yoy_pct", "2026-08") - national("cpi.headline", "yoy_pct", "2025-08"), 12);
  });

  it("gives absolute and percentage change for the index level", () => {
    const [row] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "index_2010" }));
    const from = national("cpi.headline", "index_2010", "2025-08");
    const to = national("cpi.headline", "index_2010", "2026-08");
    expect(row!.percentagePointChange).toBeNull();
    expect(row!.absoluteChange!).toBeCloseTo(to - from, 12);
    expect(row!.percentageChange!).toBeCloseTo(((to - from) / from) * 100, 9);
  });

  it("limits a contribution comparison across a January and says why", () => {
    const [across] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.cat.07"] }, fromPeriod: "2025-12", toPeriod: "2026-01", measure: "contribution_pp" }));
    expect(across!.comparability).toBe("limited");
    expect(across!.caveatIds).toContain("inflation_contribution_weights_differ");
    expect(across!.reasonsEn.join(" ")).toContain("re-weighted");
    const [within] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.cat.07"] }, fromPeriod: "2026-01", toPeriod: "2026-08", measure: "contribution_pp" }));
    expect(within!.comparability).toBe("comparable");
  });

  it("never compares the residual", () => {
    const divisions = snapshot.inflation.groups.filter((g) => g.level === "division").map((g) => g.id);
    const rows = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: divisions }, fromPeriod: "2026-01", toPeriod: "2026-08", measure: "contribution_pp" }));
    expect(rows).toHaveLength(12);
    expect(rows.some((row) => row.seriesId === "cpi.contribution_residual")).toBe(false);
  });

  it("compares basket weights between years", () => {
    const [row] = comparisons(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.cat.01"] }, fromYear: 2024, toYear: 2025, measure: "basket_weight_pct" }));
    const weight = (year: number) => snapshot.inflation.weights.find((w) => w.categoryId === "cpi.cat.01" && w.year === year)!.weightPct;
    expect(row!.from.period).toBeUndefined();
    expect(row!.percentagePointChange!).toBeCloseTo(weight(2025) - weight(2024), 12);
  });

  it("refuses years for a monthly measure and periods for a budget target", () => {
    expect(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromYear: 2025, toYear: 2026, measure: "yoy_pct" }).kind).toBe("error");
    expect(compare(snapshot, { target: { dataset: "national", side: "expenditure", seriesIds: ["spending.health"] }, fromPeriod: "2025-01", toPeriod: "2025-02", measure: "amount_gel" }).kind).toBe("error");
    expect(compare(snapshot, { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2026-08", toPeriod: "2026-01", measure: "yoy_pct" }).kind).toBe("error");
  });
});
