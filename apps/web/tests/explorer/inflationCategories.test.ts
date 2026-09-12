import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_STATE,
  buildCategoryIndex,
  buildStackModel,
  categoryCoverage,
  changeCategoryTab,
  parseCategoryHash,
  resolveCategoryRange,
  serializeCategoryHash,
  toggleCategory,
} from "../../lib/explorer/inflationCategories";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../../lib/data/inflation/types";

const fact = (
  categoryId: string,
  period: string,
  value: number,
  measure: "yoy_pct" | "mom_pct" = "yoy_pct",
  level: 2 | 3 = 2,
): ServedCpiCategoryFact => ({
  categoryId,
  coicopCode: "1",
  level,
  parentId: level === 2 ? null : "cpi.cat.01",
  measure,
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

const facts = [
  fact("cpi.cat.01", "2026-08", 5.02),
  fact("cpi.cat.07", "2026-08", 15.2),
  fact("cpi.cat.01", "2026-08", 0.4, "mom_pct"),
  fact("cpi.cat.07", "2026-08", 0.9, "mom_pct"),
  fact("cpi.cat.01", "2004-06", 3.1, "mom_pct"),
];
const weights = [weight("cpi.cat.01", 2026, 33.6), weight("cpi.cat.07", 2026, 11.4)];
const headline = new Map([[makePeriod(2026, 8), 5.65]]);

describe("buildStackModel", () => {
  it("closes on the published headline with everything selected", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = { ...DEFAULT_CATEGORY_STATE, selected: ["cpi.cat.01", "cpi.cat.07"] };
    const range = resolveCategoryRange(state, index);
    const model = buildStackModel(index, state, range, headline);
    const total = model.segments.reduce((sum, segment) => sum + (segment.values[0] ?? 0), 0) + model.residual[0]!;
    expect(total).toBeCloseTo(5.65, 10);
  });

  it("closes on the published headline with one category selected", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = { ...DEFAULT_CATEGORY_STATE, selected: ["cpi.cat.07"] };
    const range = resolveCategoryRange(state, index);
    const model = buildStackModel(index, state, range, headline);
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]!.values[0]! + model.residual[0]!).toBeCloseTo(5.65, 10);
  });

  it("makes the residual the whole headline when nothing is selected", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = { ...DEFAULT_CATEGORY_STATE, selected: [] };
    const model = buildStackModel(index, state, resolveCategoryRange(state, index), headline);
    expect(model.residual[0]).toBeCloseTo(5.65, 10);
  });
});

describe("coverage", () => {
  it("gives each tab its own span", () => {
    const index = buildCategoryIndex(facts, weights);
    expect(categoryCoverage(index, "mom").min).toBe(makePeriod(2004, 6));
    expect(categoryCoverage(index, "yoy").min).toBe(makePeriod(2026, 8));
  });

  it("clamps a manual range when the destination tab starts later", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = {
      ...DEFAULT_CATEGORY_STATE,
      tab: "mom" as const,
      range: { kind: "manual" as const, start: makePeriod(2004, 6), end: makePeriod(2026, 8) },
    };
    expect(changeCategoryTab(state, "contrib", index).range.kind).toBe("all");
  });
});

describe("selection and hash", () => {
  it("keeps selection in COICOP order", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = toggleCategory({ ...DEFAULT_CATEGORY_STATE, selected: ["cpi.cat.07"] }, "cpi.cat.01", index);
    expect(state.selected).toEqual(["cpi.cat.01", "cpi.cat.07"]);
  });

  it("round-trips through the hash", () => {
    const state = {
      ...DEFAULT_CATEGORY_STATE,
      tab: "mom" as const,
      mode: "table" as const,
      selected: ["cpi.cat.01", "cpi.cat.10_5"],
    };
    expect(parseCategoryHash(serializeCategoryHash(state))).toMatchObject({
      tab: "mom",
      mode: "table",
      selected: ["cpi.cat.01", "cpi.cat.10_5"],
    });
  });

  it("drops an unknown category from the hash", () => {
    expect(parseCategoryHash("i=contrib&sel=cpi.cat.01,nonsense").selected).toEqual(["cpi.cat.01"]);
  });
});
