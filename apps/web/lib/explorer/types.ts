export const EXPLORER_SIDES = ["expenditure", "revenue"] as const;
export const EXPLORER_NAVS = ["expenditure", "revenue", "analysis"] as const;
export const CHART_MODES = ["line", "table"] as const;
export const MEASURE_MODES = ["nominal", "share_of_total"] as const;

export type ExplorerSide = (typeof EXPLORER_SIDES)[number];
export type ExplorerNav = (typeof EXPLORER_NAVS)[number];
export type ChartMode = (typeof CHART_MODES)[number];
export type MeasureMode = (typeof MEASURE_MODES)[number];
export type ExpenditureGrouping = "fields" | "ministries";
export type ExplorerScope = "fields" | "ministries" | "revenue";
export type ExplorerItemLevel = "total" | "public_field" | "admin_category" | "major_program" | "municipal_function";

export const MAX_CHART_SERIES = 6;

export type SourceMetadata = {
  sourceName: string;
  sourceUrlOrFile: string;
  lastReviewedAt: string;
};

export type ExplorerItem = {
  id: string;
  side: ExplorerSide;
  parentItemId: string | null;
  level: ExplorerItemLevel;
  detailLabel: string | null;
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
  parentItemId: string | null;
  level: ExplorerItemLevel;
  detailLabel: string | null;
  officialInstitutionLabelByYear?: Record<number, string | null>;
  kaLabel: string;
  enLabel: string;
  color: string;
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
  unit: string;
  detail: string;
  negative: boolean;
};

export type SingleYearSnapshotModel = {
  side: ExplorerSide;
  grouping: ExpenditureGrouping;
  year: number;
  previousYear: number | null;
  totalGel: number;
  basis: "actual" | "planned";
  hasPlannedValues: boolean;
  source: SourceMetadata | null;
  headlineCards: SnapshotHeadline[];
  items: SnapshotItem[];
  every100: Every100Item[];
  radarItems: SnapshotItem[];
  rankingRows: SnapshotItem[];
  hasGrowthData: boolean;
  emptyReason: string | null;
};
