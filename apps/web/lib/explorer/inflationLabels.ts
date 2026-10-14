import { periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { formatShare, type ValueUnit } from "./format";
import { displayedValue } from "./inflationGrid";
import type { InflationSelectionKey, InflationTab } from "./inflationOverview";

export const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** The monthly inflation charts' unit: percentages with one decimal and no suffix. */
export const PCT_UNIT: ValueUnit = { divisor: 1, label: "", decimals: 1 };

/** A monthly line chart's period: the year under January and short months on the axis, the long month in the readout. */
export function monthlyChartPeriod(messages: Messages, period: number, kind: "axis" | "tooltip"): string {
  return kind === "axis" && periodMonth(period) === 1 ? String(periodYear(period)) : periodLabel(messages, period, kind === "axis" ? "short" : "long");
}

export function periodLabel(messages: Messages, period: number, style: "long" | "short"): string {
  return `${message(messages, `inflation.${style === "long" ? "month" : "monthShort"}.${periodMonth(period)}`)} ${periodYear(period)}`;
}

export function seriesLabel(messages: Messages, key: InflationSelectionKey, tab: InflationTab): string {
  return message(messages, key === "cpi" && tab === "index" ? "inflation.series.cpiIndex" : `inflation.series.${key}`);
}

/** Percent tabs hold percentage points; monthly change is signed. The index is a level. */
export function formatInflationValue(value: number, tab: InflationTab): string {
  const shown = displayedValue(value);
  return tab === "index" ? shown.toFixed(1) : formatShare(shown / 100, tab === "mom");
}
