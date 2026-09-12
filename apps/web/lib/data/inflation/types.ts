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
