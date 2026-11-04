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
};
