export const EXPLORER_SIDES = ["expenditure", "revenue"] as const;
export const EXPLORER_NAVS = ["expenditure", "revenue", "analysis"] as const;
export const CHART_MODES = ["line", "table"] as const;
import type { GdpAccountingStandard, GdpStatus } from "../data/nationalGdp/types";

export const MEASURE_MODES = ["nominal", "share_of_gdp"] as const;

export type ExplorerSide = (typeof EXPLORER_SIDES)[number];
export type ExplorerNav = (typeof EXPLORER_NAVS)[number];
export type ChartMode = (typeof CHART_MODES)[number];
export type MeasureMode = (typeof MEASURE_MODES)[number];
export type ExpenditureGrouping = "fields" | "ministries";
export type ExplorerScope = "fields" | "ministries" | "revenue";
export type ExplorerItemLevel = "total" | "public_field" | "admin_category" | "major_program" | "municipal_function";

export type GdpMetadata = {
  gdpCurrentPricesGel: number;
  accountingStandard: GdpAccountingStandard;
  status: GdpStatus;
};

export type ExplorerItem = {
  id: string;
  side: ExplorerSide;
  parentItemId: string | null;
  level: ExplorerItemLevel;
  kaLabel: string;
  enLabel: string;
  color: string;
  sortOrder: number;
};

// The chart reads value/basis per (item, year); nothing renders a point's own
// labels or its derived amount, share or percent change.
export type ExplorerPoint = {
  year: number;
  itemId: string;
  basis: "actual" | "planned";
  value: number | null;
};

export type ExplorerTableRow = {
  itemId: string;
  parentItemId: string | null;
  level: ExplorerItemLevel;
  kaLabel: string;
  enLabel: string;
  color: string;
  basisByYear: Record<number, "actual" | "planned">;
  valuesByYear: Record<number, number | null>;
  shareByYear?: Record<number, number | null>;
  change: number | null;
  shareEndYear: number | null;
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
  headlineCards: SnapshotHeadline[];
  items: SnapshotItem[];
  every100: Every100Item[];
  radarItems: SnapshotItem[];
  rankingRows: SnapshotItem[];
  hasGrowthData: boolean;
  emptyReason: string | null;
};
