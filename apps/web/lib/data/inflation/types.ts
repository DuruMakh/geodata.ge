export const CPI_SERIES_IDS = ["cpi.headline", "cpi.core", "cpi.core_ex_tobacco"] as const;
export type CpiSeriesId = (typeof CPI_SERIES_IDS)[number];

export const CPI_MEASURES = ["index_2010", "yoy_pct", "mom_pct", "avg12_pct"] as const;
export type CpiMeasure = (typeof CPI_MEASURES)[number];

// What Geostat publishes for each series. Core has neither an index level nor a
// 12-month average, and none is derived here (spec §4.3).
export const CPI_SERIES_MEASURES: Readonly<Record<CpiSeriesId, readonly CpiMeasure[]>> = {
  "cpi.headline": ["index_2010", "yoy_pct", "mom_pct", "avg12_pct"],
  "cpi.core": ["yoy_pct", "mom_pct"],
  "cpi.core_ex_tobacco": ["yoy_pct", "mom_pct"],
};

/** One published monthly value. Percent measures hold percentage points (5.6 = 5.6%). */
export type CpiFact = {
  seriesId: CpiSeriesId;
  measure: CpiMeasure;
  period: string;
  value: string;
  status: "published";
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};

export type ServedCpiFact = Omit<CpiFact, "value"> & { value: number };

export type InflationTargetRow = {
  effectiveFrom: string;
  effectiveTo: string | null;
  targetPct: string;
  sourceId: string;
  lastReviewedAt: string;
};

export type ServedInflationTargetRow = Omit<InflationTargetRow, "targetPct"> & { targetPct: number };

export const CPI_CATEGORY_MEASURES = ["yoy_pct", "mom_pct"] as const;
export type CpiCategoryMeasure = (typeof CPI_CATEGORY_MEASURES)[number];

export type CpiCategoryFact = {
  categoryId: string;
  coicopCode: string;
  level: 2 | 3;
  parentId: string | null;
  measure: CpiCategoryMeasure;
  period: string;
  value: string;
  status: "published";
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};

export type ServedCpiCategoryFact = Omit<CpiCategoryFact, "value"> & { value: number };

/**
 * What the page actually needs from a category fact. 27,668 rows cross the
 * client boundary, so the provenance columns stay on the server and `level` and
 * `parentId` are re-derived from the ID rather than repeated on every row.
 */
export type CategoryFactInput = Pick<ServedCpiCategoryFact, "categoryId" | "measure" | "period" | "value">;

export function categoryFactInput(fact: ServedCpiCategoryFact): CategoryFactInput {
  return { categoryId: fact.categoryId, measure: fact.measure, period: fact.period, value: fact.value };
}

/** Weights are stored as percentages with six decimals; the arithmetic divides by 100. */
export type BasketWeightRow = { categoryId: string; year: number; weightPct: string; sourceId: string; lastReviewedAt: string };
export type ServedBasketWeightRow = Omit<BasketWeightRow, "weightPct"> & { weightPct: number };

// Geostat writes COICOP codes bare: division 11 and subgroup 11 (Food, under
// division 1) are both "11". Only the level tells them apart, so the ID carries
// the division padded to two digits and the subgroup after an underscore.
export function categoryIdFromCoicop(code: string, level: 2 | 3): { categoryId: string; parentId: string | null } {
  if (!/^\d{1,3}$/.test(code)) throw new Error(`Unexpected COICOP code ${code}`);
  const divisionDigits = level === 2 ? code : code.slice(0, -1);
  const division = Number(divisionDigits);
  if (!Number.isInteger(division) || division < 1 || division > 12) throw new Error(`COICOP division out of range: ${code}`);
  const parentId = `cpi.cat.${String(division).padStart(2, "0")}`;
  return level === 2 ? { categoryId: parentId, parentId: null } : { categoryId: `${parentId}_${code.slice(-1)}`, parentId };
}
