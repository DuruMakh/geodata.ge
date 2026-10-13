import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { formatDisplayDate } from "./format";

/** A review date as every page prints it: `YYYY-MM-DD` in Georgian, `d Month yyyy` in English (DESIGN.md §6.2). */
export function updatedDate(isoDate: string, locale: Locale): string {
  return locale === "en" ? formatDisplayDate(isoDate, locale) : isoDate;
}

/**
 * The page-header coverage label (DESIGN.md §6.2), one format on every route:
 * `{first}–{last} · განახლდა {YYYY-MM-DD}` / `{first}–{last} · Updated {d Month yyyy}`.
 * The range dash is an unspaced en dash, also between month labels.
 */
export function coverageLabel(
  messages: Messages,
  locale: Locale,
  first: string | number | undefined,
  last: string | number | undefined,
  reviewedAt?: string,
): string {
  const range = first === undefined || last === undefined ? "" : first === last ? String(first) : `${first}–${last}`;
  const updated = reviewedAt
    ? message(messages, "common.updated", { date: updatedDate(reviewedAt, locale) })
    : "";
  return [range, updated].filter(Boolean).join(" · ");
}
