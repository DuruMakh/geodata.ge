import { describe, expect, it } from "vitest";
import {
  assertNoCategoryRevisions,
  validateBasketWeights,
  validateCategoryFacts,
} from "../../../lib/data/inflation/validateInflation";
import type { BasketWeightRow, CpiCategoryFact } from "../../../lib/data/inflation/types";

const fact = (over: Partial<CpiCategoryFact> = {}): CpiCategoryFact => ({
  categoryId: "cpi.cat.01",
  coicopCode: "1",
  level: 2,
  parentId: null,
  measure: "yoy_pct",
  period: "2026-08",
  value: "5.02",
  status: "published",
  sourceId: "source.geostat_cpi_yoy",
  sourceLocator: "Georgia!D7",
  lastReviewedAt: "2026-09-11",
  ...over,
});
const weight = (over: Partial<BasketWeightRow> = {}): BasketWeightRow => ({
  categoryId: "cpi.cat.01",
  year: 2026,
  weightPct: "100.000000",
  sourceId: "source.geostat_basket_weights",
  lastReviewedAt: "2026-09-12",
  ...over,
});

/** COICOP always has 12 divisions, so a fixture reaching the end of the validator needs all of them. */
const otherDivisions = Array.from({ length: 11 }, (_, index) =>
  fact({ categoryId: `cpi.cat.${String(index + 2).padStart(2, "0")}`, coicopCode: String(index + 2) }),
);

describe("validateCategoryFacts", () => {
  it("accepts a gap and reports it", () => {
    const result = validateCategoryFacts([fact({ period: "2026-06" }), fact({ period: "2026-08" }), ...otherDivisions]);
    expect(result.lastPeriod).toBe("2026-08");
    expect(result.gaps).toEqual(["cpi.cat.01:yoy_pct after 2026-06"]);
  });

  // A truncated CSV or mirror would otherwise reach the page silently.
  it("rejects a set that is missing a division", () => {
    expect(() => validateCategoryFacts([fact(), ...otherDivisions.slice(1)])).toThrow(/12 COICOP divisions, found 11/);
  });

  it("rejects a subgroup whose parent is absent", () => {
    expect(() =>
      validateCategoryFacts([fact({ categoryId: "cpi.cat.09_6", coicopCode: "96", level: 3, parentId: "cpi.cat.09" })]),
    ).toThrow(/parent/);
  });

  it("rejects a duplicate observation", () => {
    expect(() => validateCategoryFacts([fact(), fact()])).toThrow(/Duplicate/);
  });

  it("rejects an implausible rate", () => {
    expect(() => validateCategoryFacts([fact({ value: "412" })])).toThrow(/plausible/);
  });
});

describe("validateBasketWeights", () => {
  const ids = new Set(["cpi.cat.01"]);

  it("accepts a level that sums to 100", () => {
    expect(validateBasketWeights([weight()], ids).years).toEqual([2026]);
  });

  it("rejects a level that does not sum to 100", () => {
    expect(() => validateBasketWeights([weight({ weightPct: "94.000000" })], ids)).toThrow(/sum/);
  });

  it("rejects a weight for a category with no price data", () => {
    expect(() => validateBasketWeights([weight({ categoryId: "cpi.cat.04_2" })], ids)).toThrow(/no price data/);
  });
});

describe("assertNoCategoryRevisions", () => {
  it("throws when a published month changes", () => {
    expect(() => assertNoCategoryRevisions([fact()], [fact({ value: "5.03" })])).toThrow(/revised/);
  });

  it("passes when history is untouched and a month is added", () => {
    expect(() => assertNoCategoryRevisions([fact()], [fact(), fact({ period: "2026-09" })])).not.toThrow();
  });
});
