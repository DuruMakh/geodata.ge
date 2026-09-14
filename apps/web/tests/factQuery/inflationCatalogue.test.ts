// apps/web/tests/factQuery/inflationCatalogue.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage, type CoverageData } from "../../lib/factQuery/describeCoverage";
import { getSources } from "../../lib/factQuery/getSources";
import { serviceLabelEn } from "../../lib/factQuery/localization";
import { SCHEMA_VERSION, type FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

function catalogue(input: unknown): CoverageData {
  const response = describeCoverage(snapshot, input);
  if (response.kind !== "catalogue") throw new Error(JSON.stringify(response));
  return response.data as CoverageData;
}

describe("inflation snapshot and catalogue", () => {
  it("is schema 1.2.0", () => {
    expect(SCHEMA_VERSION).toBe("1.2.0");
  });

  it("carries every served inflation row", async () => {
    const served = await loadServedInflationData();
    expect(snapshot.inflation.facts).toHaveLength(served.facts.length);
    expect(snapshot.inflation.categories).toHaveLength(served.categories.length);
    expect(snapshot.inflation.weights).toHaveLength(served.weights.length);
    expect(snapshot.inflation.targets).toHaveLength(served.targets.length);
  });

  it("names 12 divisions and 43 subgroups in both languages", () => {
    const { groups } = snapshot.inflation;
    expect(groups.filter((g) => g.level === "division")).toHaveLength(12);
    expect(groups.filter((g) => g.level === "subgroup")).toHaveLength(43);
    expect(groups.find((g) => g.id === "cpi.cat.01_1")).toMatchObject({ parentId: "cpi.cat.01", labelKa: "სურსათი", labelEn: "Food" });
    for (const group of groups) expect(group.labelKa).toMatch(/\p{Script=Georgian}/u);
    for (const id of ["inflation", "cpi.headline", "cpi.core", "cpi.core_ex_tobacco", "cpi.target", "cpi.contribution_residual", "cpi.cat.07"]) {
      expect(serviceLabelEn(snapshot, id).trim()).not.toBe("");
    }
  });

  it("lists inflation with its month span read from the data", () => {
    const dataset = catalogue({}).datasets.find((d) => d.datasetId === "inflation") as CoverageData["datasets"][number] & { periods: [string, string] };
    const periods = [...snapshot.inflation.facts, ...snapshot.inflation.categories].map((f) => f.period).sort();
    expect(dataset.periods).toEqual([periods[0], periods.at(-1)]);
    expect(dataset.budgetScope).toBe("consumer_prices");
    expect(dataset.measures).toContain("contribution_pp");
    expect(dataset.labelEn).toBe("Consumer price inflation");
  });

  it("describes each series' measures and months, and never offers the residual", () => {
    type Entry = { seriesId: string; level: string; parentSeriesId: string | null; periodsByMeasure: Record<string, [string, string]>; yearsByMeasure?: Record<string, number[]> };
    const series = catalogue({ datasetId: "inflation" }).series as unknown as Entry[];
    const byId = new Map(series.map((s) => [s.seriesId, s]));
    expect(byId.has("cpi.contribution_residual")).toBe(false);
    expect(byId.get("cpi.cat.07")).toMatchObject({ level: "division", parentSeriesId: null });
    expect(byId.get("cpi.cat.07_1")).toMatchObject({ level: "subgroup", parentSeriesId: "cpi.cat.07" });
    expect(byId.get("cpi.core")!.periodsByMeasure.index_2010).toBeUndefined();
    expect(byId.get("cpi.target")!.periodsByMeasure.target_pct[0]).toBe(snapshot.inflation.targets.map((t) => t.effectiveFrom).sort()[0]);
    expect(byId.get("cpi.cat.01")!.periodsByMeasure.contribution_pp[0]).toBe("2013-01");
    expect(byId.get("cpi.cat.01")!.yearsByMeasure!.basket_weight_pct[0]).toBe(Math.min(...snapshot.inflation.weights.map((w) => w.year)));
  });

  it("finds groups by label and narrows by level", () => {
    const found = catalogue({ search: "Food" }).series!;
    expect(found.some((s) => (s as { datasetId?: string }).datasetId === "inflation" && s.seriesId === "cpi.cat.01_1")).toBe(true);
    expect(catalogue({ datasetId: "inflation", level: "subgroup" }).series!).toHaveLength(43);
  });

  it("narrows source evidence to the inflation dataset", () => {
    const response = getSources(snapshot, { sourceIds: ["source.nbg_inflation_target"], datasetId: "inflation" });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    expect(JSON.stringify(response.data)).not.toContain('"narrowingOutcome":"dropped_no_match"');
  });
});
