import { makePeriod } from "../../../lib/data/inflation/periods";
import { buildCategoryIndex, DEFAULT_CATEGORY_STATE, type CategoryState } from "../../../lib/explorer/inflationCategories";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../../../lib/data/inflation/types";

const fact = (
  categoryId: string,
  level: 2 | 3,
  parentId: string | null,
  measure: "yoy_pct" | "mom_pct",
  period: string,
  value: number,
): ServedCpiCategoryFact => ({
  categoryId,
  coicopCode: categoryId.replace("cpi.cat.", "").replace(/^0|_/g, ""),
  level,
  parentId,
  measure,
  period,
  value,
  status: "published",
  sourceId: measure === "yoy_pct" ? "source.geostat_cpi_yoy" : "source.geostat_cpi_mom",
  sourceLocator: "Georgia!D7",
  lastReviewedAt: "2026-09-11",
});

/** Three divisions, two subgroups and 2026 weights — enough to render every surface. */
export const fixtureFacts: ServedCpiCategoryFact[] = [
  fact("cpi.cat.01", 2, null, "yoy_pct", "2026-08", 5.02),
  fact("cpi.cat.04", 2, null, "yoy_pct", "2026-08", 8.47),
  fact("cpi.cat.07", 2, null, "yoy_pct", "2026-08", 15.2),
  fact("cpi.cat.01_1", 3, "cpi.cat.01", "yoy_pct", "2026-08", 4.8),
  fact("cpi.cat.01", 2, null, "mom_pct", "2026-08", 0.4),
  fact("cpi.cat.07", 2, null, "mom_pct", "2026-08", 0.9),
  // 04.2 ended in 2011 and has no weight, so it must render as "—" on the contribution tab.
  fact("cpi.cat.04_2", 3, "cpi.cat.04", "yoy_pct", "2011-12", 2.2),
];

export const fixtureWeights: ServedBasketWeightRow[] = (
  [
    ["cpi.cat.01", 33.6],
    ["cpi.cat.04", 9.7],
    ["cpi.cat.07", 11.4],
    ["cpi.cat.01_1", 27.5],
  ] as const
).map(([categoryId, weightPct]) => ({
  categoryId,
  year: 2026,
  weightPct,
  sourceId: "source.geostat_basket_weights",
  lastReviewedAt: "2026-09-12",
}));

export const fixtureHeadline = new Map([[makePeriod(2026, 8), 5.65]]);
export const fixtureIndex = () => buildCategoryIndex(fixtureFacts, fixtureWeights);
export const fixtureState = (over: Partial<CategoryState> = {}): CategoryState => ({
  ...DEFAULT_CATEGORY_STATE,
  selected: ["cpi.cat.01", "cpi.cat.04", "cpi.cat.07"],
  ...over,
});
