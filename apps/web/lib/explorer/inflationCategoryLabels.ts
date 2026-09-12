import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { SERIES_COLORS } from "./colors";
import { formatShare } from "./format";
import { displayedValue } from "./inflationGrid";
import { RESIDUAL_ID, type CategoryTab } from "./inflationCategories";

// Labels and colours for the COICOP tree. Georgian and English wording is
// Geostat's own, carried in the message catalogue (spec §3.3).

/** Subgroups inherit their division's colour, so a stack reads as one family. */
export function categoryColor(categoryId: string): string {
  const divisionId = categoryId.split("_")[0]!;
  return SERIES_COLORS[categoryId] ?? SERIES_COLORS[divisionId] ?? SERIES_COLORS[RESIDUAL_ID]!;
}

export function categoryLabel(messages: Messages, categoryId: string): string {
  return message(messages, `inflation.category.${categoryId}`);
}

/** Percentage points, always signed, one decimal — the unit of a contribution. */
export function formatContribution(value: number): string {
  return formatShare(displayedValue(value) / 100, true);
}

export function formatCategoryValue(value: number, tab: CategoryTab): string {
  return formatShare(displayedValue(value) / 100, tab !== "yoy");
}

/** A basket share, right-aligned in mono on selector rows; absent weights show an em dash. */
export function formatWeight(weightPct: number | null): string {
  return weightPct === null ? "—" : `${weightPct.toFixed(1)}%`;
}
