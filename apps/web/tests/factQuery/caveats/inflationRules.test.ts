// apps/web/tests/factQuery/caveats/inflationRules.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import { CAVEAT_RULES, evaluateCaveats, type CaveatContext } from "../../../lib/factQuery/caveats";
import { caveatIdsForObservation } from "../../../lib/factQuery/observations";
import type { FactQuerySnapshot, Measure } from "../../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-14T00:00:00Z" });
});

type Cell = { seriesId: string; period: string; value: number | null };

function context(measure: Measure, cells: Cell[], comparison: CaveatContext["comparison"] = null): CaveatContext {
  return {
    datasetId: "inflation",
    measure,
    years: [...new Set(cells.map((cell) => Number(cell.period.slice(0, 4))))],
    seriesIds: [...new Set(cells.map((cell) => cell.seriesId))],
    entityIds: ["country.georgia"],
    observations: cells.map((cell) => ({
      entityId: "country.georgia",
      seriesId: cell.seriesId,
      level: "division",
      parentSeriesId: null,
      year: Number(cell.period.slice(0, 4)),
      period: cell.period,
      value: cell.value,
      basis: cell.value === null ? null : "published",
      valueDefinitionId: `inflation:${measure}`,
    })),
    municipalTotalInputs: [],
    municipalInputServedBy: {},
    gdpInputs: [],
    comparison,
    historicalJoinSeriesYears: [],
    adminCategoryYears: [],
  };
}

const codes = (c: CaveatContext) => evaluateCaveats(snapshot, c, CAVEAT_RULES).map((caveat) => caveat.code);

describe("inflation caveat rules", () => {
  it("marks each contribution as derived and the residual as a residual, per month", () => {
    const caveats = evaluateCaveats(
      snapshot,
      context("contribution_pp", [
        { seriesId: "cpi.cat.07", period: "2026-08", value: 1.7 },
        { seriesId: "cpi.contribution_residual", period: "2026-08", value: 0.1 },
      ]),
      CAVEAT_RULES,
    );
    expect(caveats.map((caveat) => caveat.code)).toEqual(["inflation_contribution_derived", "inflation_contribution_residual"]);
    expect(caveats[0]!.severity).toBe("severe");
    expect(caveats[0]!.affects).toEqual(["cpi.cat.07:2026-08"]);
    expect(caveatIdsForObservation(caveats, { entityId: "country.georgia", seriesId: "cpi.cat.07", year: 2026, period: "2026-08", measure: "contribution_pp" })).toEqual(["inflation_contribution_derived"]);
    expect(caveatIdsForObservation(caveats, { entityId: "country.georgia", seriesId: "cpi.cat.07", year: 2026, period: "2026-07", measure: "contribution_pp" })).toEqual([]);
  });

  it("says nothing about a published price change", () => {
    expect(codes(context("yoy_pct", [{ seriesId: "cpi.cat.07", period: "2026-08", value: 15.1989 }]))).toEqual([]);
  });

  it("limits a contribution comparison only across calendar years", () => {
    const cells = [
      { seriesId: "cpi.cat.07", period: "2025-12", value: 1.2 },
      { seriesId: "cpi.cat.07", period: "2026-01", value: 1.3 },
    ];
    expect(codes(context("contribution_pp", cells, { fromYear: 2025, toYear: 2026 }))).toContain("inflation_contribution_weights_differ");
    expect(codes(context("contribution_pp", cells, { fromYear: 2026, toYear: 2026 }))).not.toContain("inflation_contribution_weights_differ");
  });

  it("calls a missing early target unverified, and says nothing once a target is in force", () => {
    expect(codes(context("target_pct", [{ seriesId: "cpi.target", period: "2014-06", value: null }]))).toEqual(["inflation_target_unverified_before_2015"]);
    expect(codes(context("target_pct", [{ seriesId: "cpi.target", period: "2026-08", value: 3 }]))).toEqual([]);
  });
});
