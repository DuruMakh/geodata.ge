import { describe, expect, it } from "vitest";
import {
  CONTRIBUTION_FIRST_YEAR,
  assertReconstruction,
  buildContributionIndex,
  contributionFor,
  reconstructionErrors,
} from "../../../lib/data/inflation/contributions";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../../../lib/data/inflation/types";

const fact = (categoryId: string, period: string, value: number, level: 2 | 3 = 2): ServedCpiCategoryFact => ({
  categoryId,
  coicopCode: "1",
  level,
  parentId: level === 2 ? null : "cpi.cat.01",
  measure: "yoy_pct",
  period,
  value,
  status: "published",
  sourceId: "source.geostat_cpi_yoy",
  sourceLocator: "Georgia!D7",
  lastReviewedAt: "2026-09-11",
});
const weight = (categoryId: string, year: number, weightPct: number): ServedBasketWeightRow => ({
  categoryId,
  year,
  weightPct,
  sourceId: "source.geostat_basket_weights",
  lastReviewedAt: "2026-09-12",
});

describe("contributionFor", () => {
  it("multiplies a percentage-point change by the weight as a fraction", () => {
    expect(contributionFor(15.2, 11.4)).toBeCloseTo(1.7328, 4);
  });
});

describe("buildContributionIndex", () => {
  it("starts in 2013 even when weights and prices reach further back", () => {
    const index = buildContributionIndex(
      [fact("cpi.cat.01", "2012-06", 5), fact("cpi.cat.01", "2013-06", 5)],
      [weight("cpi.cat.01", 2012, 30), weight("cpi.cat.01", 2013, 30)],
    );
    const periods = [...index.get("cpi.cat.01")!.keys()].map((period) => Math.floor(period / 12));
    expect(Math.min(...periods)).toBe(CONTRIBUTION_FIRST_YEAR);
  });

  it("uses the weight of the year the month falls in", () => {
    const index = buildContributionIndex(
      [fact("cpi.cat.01", "2025-06", 10), fact("cpi.cat.01", "2026-06", 10)],
      [weight("cpi.cat.01", 2025, 20), weight("cpi.cat.01", 2026, 40)],
    );
    const values = [...index.get("cpi.cat.01")!.values()];
    expect(values).toEqual([2, 4]);
  });

  it("omits a category with no weight for that year", () => {
    const index = buildContributionIndex([fact("cpi.cat.01", "2013-06", 5)], []);
    expect(index.size).toBe(0);
  });
});

describe("reconstructionErrors", () => {
  it("measures the gap between the summed parts and the published headline", () => {
    const contributions = new Map([["cpi.cat.01", new Map([[24157, 3.0]])]]);
    const headline = new Map([[24157, 3.4]]);
    const errors = reconstructionErrors(contributions, headline);
    expect(errors.months).toBe(1);
    expect(errors.maxPp).toBeCloseTo(0.4, 6);
    expect(errors.meanPp).toBeCloseTo(0.4, 6);
  });

  it("throws past the bound", () => {
    expect(() => assertReconstruction({ months: 1, maxPp: 1.4, meanPp: 0.1, worstPeriod: "2013-01" })).toThrow(/1.4/);
  });

  it("passes within the bound", () => {
    expect(() => assertReconstruction({ months: 160, maxPp: 0.59, meanPp: 0.09, worstPeriod: "2021-04" })).not.toThrow();
  });
});
