import type { MunicipalData } from "../data/servedData";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale, Messages } from "../i18n/types";
import { message } from "../i18n/messages";
import { updatedDate } from "../explorer/coverageLabel";

export function getMunicipalPresentation(data: MunicipalData, locale: Locale, officialCode?: string) {
  // The place, region and function searches match English names on the Georgian pages too.
  const searchIds = ["country.georgia", "municipal.total", ...data.functions.map(fn => fn.id), ...data.municipalities.map(entity => entity.code), ...data.regions.map(region => region.id)];
  return getPresentation(locale, ["format", "main", "municipal"], [
    ...searchIds, ...(officialCode ? [`${officialCode}.official-name`] : []),
  ], searchIds);
}

/** The "· updated {date}" suffix every municipal page adds to its source note; empty without a review date. */
export function municipalUpdatedNote(messages: Messages, locale: Locale, lastUpdatedAt: string | undefined): string {
  if (!lastUpdatedAt) return "";
  return message(messages, "municipal.updatedNote", { date: updatedDate(lastUpdatedAt, locale) });
}
