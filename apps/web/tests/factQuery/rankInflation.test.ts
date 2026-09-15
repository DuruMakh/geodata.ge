// apps/web/tests/factQuery/rankInflation.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare, type Comparison } from "../../lib/factQuery/compare";
import { rank, type RankData } from "../../lib/factQuery/rank";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function ranking(response: FactQueryResponse): RankData {
  if (response.kind !== "ranking") throw new Error(JSON.stringify(response));
  return response.data as RankData;
}

describe("rank on inflation", () => {
  it("orders divisions by annual price change in one month", () => {
    const data = ranking(rank(snapshot, { datasetId: "inflation", dimension: "series", level: "division", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 3 }));
    expect(data.entries.map((entry) => entry.seriesId)).toEqual(["cpi.cat.07", "cpi.cat.04", "cpi.cat.12"]);
    expect(data.entries.map((entry) => entry.value)).toEqual([15.1989, 8.4682, 7.1272]);
    expect(data.entries.every((entry) => entry.unit === "percent" && entry.period === "2026-08")).toBe(true);
    expect(data.universe).toMatchObject({ candidateCount: 12, eligibleCount: 12 });
    expect(data.rankingDefinitionEn).toContain("2026-08");
  });

  it("ranks only the subgroups of the requested division", () => {
    const data = ranking(rank(snapshot, { datasetId: "inflation", dimension: "series", level: "subgroup", parentSeriesId: "cpi.cat.01", period: "2026-08", measure: "yoy_pct", metric: "value", limit: 100 }));
    const expected = snapshot.inflation.groups.filter((g) => g.parentId === "cpi.cat.01").length;
    expect(data.universe.candidateCount).toBe(expected);
    expect(data.entries.every((entry) => entry.seriesId.startsWith("cpi.cat.01_"))).toBe(true);
  });

  it("ranks percentage-point change in the same figures compare returns", () => {
    const data = ranking(rank(snapshot, { datasetId: "inflation", dimension: "series", level: "division", fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct", metric: "percentage_point_change", limit: 12 }));
    const response = compare(snapshot, { target: { dataset: "inflation", seriesIds: [data.entries[0]!.seriesId] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    const [comparison] = (response.data as { comparisons: Comparison[] }).comparisons;
    expect(data.entries[0]!.value).toBe(comparison!.percentagePointChange);
    expect(data.entries.every((entry) => entry.unit === "percentage_points")).toBe(true);
  });

  it("refuses rankings that do not fit inflation", () => {
    const base = { datasetId: "inflation", dimension: "series", period: "2026-08", measure: "yoy_pct", metric: "value" };
    expect(rank(snapshot, base).kind).toBe("error");
    expect(rank(snapshot, { ...base, level: "admin_category" }).kind).toBe("error");
    expect(rank(snapshot, { ...base, level: "division", year: 2026 }).kind).toBe("error");
    expect(rank(snapshot, { ...base, level: "division", period: undefined, fromPeriod: "2025-08", toPeriod: "2026-08", metric: "absolute_change" }).kind).toBe("error");
    // Stray month fields are refused, not ignored.
    expect(rank(snapshot, { ...base, level: "division", fromPeriod: "2025-08" }).kind).toBe("error");
    expect(rank(snapshot, { ...base, level: "division", fromPeriod: "2025-08", toPeriod: "2026-08", metric: "percentage_point_change" }).kind).toBe("error");
    expect(rank(snapshot, { datasetId: "national-expenditure", dimension: "series", period: "2026-08", measure: "amount_gel", metric: "value" }).kind).toBe("error");
  });
});
