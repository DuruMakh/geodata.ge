export const EXPLORER_SIDES = ["expenditure", "revenue"] as const;
export const CHART_MODES = ["line", "bar", "table"] as const;
export const MEASURE_MODES = ["nominal", "percent_change", "share_of_total", "share_of_gdp"] as const;

export type ExplorerSide = (typeof EXPLORER_SIDES)[number];
export type ChartMode = (typeof CHART_MODES)[number];
export type MeasureMode = (typeof MEASURE_MODES)[number];

export const MAX_CHART_SERIES = 8;

export type SourceMetadata = {
  sourceName: string;
  sourceUrlOrFile: string;
  lastReviewedAt: string;
};

export type ExplorerItem = {
  id: string;
  side: ExplorerSide;
  kaLabel: string;
  enLabel: string;
  color: string;
  sortOrder: number;
};

export type ExplorerPoint = {
  year: number;
  itemId: string;
  kaLabel: string;
  enLabel: string;
  amountGel: number;
  basis: "actual" | "planned";
  value: number | null;
  shareOfTotal: number | null;
  percentChange: number | null;
};

export type ExplorerTableRow = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  basisByYear: Record<number, "actual" | "planned">;
  sourceByYear: Record<number, SourceMetadata>;
  valuesByYear: Record<number, number | null>;
  change: number | null;
  shareEndYear: number | null;
};

export type PeriodSummary = {
  totalChange: number | null;
  largestGelIncrease: ExplorerTableRow | null;
  fastestGrowth: ExplorerTableRow | null;
  lowestGrowth: ExplorerTableRow | null;
  biggestShareChange: ExplorerTableRow | null;
};
