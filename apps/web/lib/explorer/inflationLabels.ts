import { periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { formatShare } from "./format";
import type { InflationSelectionKey, InflationTab } from "./inflationOverview";

export const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function periodLabel(messages: Messages, period: number, style: "long" | "short"): string {
  return `${message(messages, `inflation.${style === "long" ? "month" : "monthShort"}.${periodMonth(period)}`)} ${periodYear(period)}`;
}

export function seriesLabel(messages: Messages, key: InflationSelectionKey, tab: InflationTab): string {
  return message(messages, key === "cpi" && tab === "index" ? "inflation.series.cpiIndex" : `inflation.series.${key}`);
}

/** Percent tabs hold percentage points; monthly change is signed. The index is a level. */
export function formatInflationValue(value: number, tab: InflationTab): string {
  return tab === "index" ? value.toFixed(1) : formatShare(value / 100, tab === "mom");
}
