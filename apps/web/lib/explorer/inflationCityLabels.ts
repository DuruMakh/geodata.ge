import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { INK, SERIES_COLORS } from "./colors";
import { formatShare } from "./format";
import { categoryLabel } from "./inflationCategoryLabels";
import { displayedValue } from "./inflationGrid";

// Labels and colours for the cities page. Georgia is the ink benchmark; each city
// keeps one colour across chart, panel, table and indicators (DESIGN.md §4.2).

export function cityLineColor(lineId: string): string {
  return SERIES_COLORS[lineId] ?? INK;
}

export function cityLineLabel(messages: Messages, lineId: string): string {
  return message(messages, `inflation.city.${lineId}`);
}

/** `cpi.headline` reads as სულ / Total; the divisions keep Geostat's own wording. */
export function cityCategoryLabel(messages: Messages, category: string): string {
  return category === "cpi.headline" ? message(messages, "inflation.cityCategoryTotal") : categoryLabel(messages, category);
}

/** Percentage points shown as percent; monthly change is signed. */
export function formatCityValue(value: number, tab: "yoy" | "mom"): string {
  return formatShare(displayedValue(value) / 100, tab === "mom");
}
