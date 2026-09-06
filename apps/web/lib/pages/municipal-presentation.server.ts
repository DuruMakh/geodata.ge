import type { MunicipalData } from "../data/servedData";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale } from "../i18n/types";

export function getMunicipalPresentation(data: MunicipalData, locale: Locale, officialCode?: string) {
  return getPresentation(locale, ["common", "controls", "format", "main", "municipal"], [
    "country.georgia", "municipal.total", ...data.functions.map(fn => fn.id),
    ...data.municipalities.map(entity => entity.code), ...data.regions.map(region => region.id),
    ...(officialCode ? [`${officialCode}.official-name`] : []),
  ]);
}
