import type { MunicipalData } from "../data/servedData";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale, Messages } from "../i18n/types";
import { message } from "../i18n/messages";
import { formatDisplayDate } from "../explorer/format";

export function getMunicipalPresentation(data: MunicipalData, locale: Locale, officialCode?: string) {
  return getPresentation(locale, ["common", "controls", "format", "main", "municipal"], [
    "country.georgia", "municipal.total", ...data.functions.map(fn => fn.id),
    ...data.municipalities.map(entity => entity.code), ...data.regions.map(region => region.id),
    ...(officialCode ? [`${officialCode}.official-name`] : []),
  ]);
}

/** The "· updated {date}" suffix every municipal page adds to its source note; empty without a review date. */
export function municipalUpdatedNote(messages: Messages, locale: Locale, lastUpdatedAt: string | undefined): string {
  if (!lastUpdatedAt) return "";
  return message(messages, "municipal.updatedNote", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt });
}
