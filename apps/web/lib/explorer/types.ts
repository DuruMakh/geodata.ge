export const EXPLORER_SIDES = ["expenditure", "revenue"] as const;
export const VIEW_MODES = ["multi_year", "single_year"] as const;
export const CHART_MODES = ["line", "bar", "table"] as const;
export const MEASURE_MODES = ["nominal", "percent_change", "share_of_total", "share_of_gdp"] as const;

export type ExplorerSide = (typeof EXPLORER_SIDES)[number];
export type ViewMode = (typeof VIEW_MODES)[number];
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

export type SnapshotItem = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  color: string;
  amountGel: number;
  shareOfTotal: number;
  previousAmountGel: number | null;
  changeFromPreviousYear: number | null;
  amountChangeFromPreviousYear: number | null;
  basis: "actual" | "planned";
  source: SourceMetadata;
};

export type Every100Item = {
  itemId: string;
  kaLabel: string;
  enLabel: string;
  color: string;
  gelFrom100: number;
  exactShare: number;
};

export type SnapshotHeadline = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type SingleYearSnapshotModel = {
  side: ExplorerSide;
  year: number;
  previousYear: number | null;
  totalGel: number;
  basis: "actual" | "planned";
  hasPlannedValues: boolean;
  source: SourceMetadata;
  headlineCards: SnapshotHeadline[];
  items: SnapshotItem[];
  every100: Every100Item[];
  petals: SnapshotItem[];
  rankingRows: SnapshotItem[];
  hasGrowthData: boolean;
  emptyReason: string | null;
};
