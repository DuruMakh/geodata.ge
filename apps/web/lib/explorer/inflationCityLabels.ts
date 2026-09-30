import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { INK, SERIES_COLORS } from "./colors";
import { formatShare } from "./format";
import { categoryColor, categoryLabel } from "./inflationCategoryLabels";
import { GEORGIA_LINE_ID, HEADLINE_ID } from "./inflationCities";
import type { CityView } from "./inflationCityRoutes";
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

/** The picker's place name: საქართველო on the Georgia page, else the city. */
export function cityPlaceLabel(messages: Messages, view: CityView): string {
  return cityLineLabel(messages, view.kind === "georgia" ? GEORGIA_LINE_ID : view.cityId);
}

/** A line is a place on the Georgia page and a series on a city page. */
export function cityViewLineLabel(messages: Messages, view: CityView, lineId: string): string {
  return view.kind === "georgia" ? cityLineLabel(messages, lineId) : cityCategoryLabel(messages, lineId);
}

/** Cities keep their colours; on a city page the total is ink and divisions wear the Categories page's colours. */
export function cityViewLineColor(view: CityView, lineId: string): string {
  if (view.kind === "georgia") return cityLineColor(lineId);
  return lineId === HEADLINE_ID ? INK : categoryColor(lineId);
}
