import { municipalIndexMetadata } from "./municipal-index";
import { municipalityMetadata } from "./municipality";
import { municipalRegionMetadata } from "./municipal-region";
import { municipalCountryMetadata } from "./municipal-country";
import type { Locale } from "../i18n/types";

export { renderMunicipalIndex } from "./municipal-index";
export { renderMunicipality, municipalityStaticParams } from "./municipality";
export { renderMunicipalRegion, municipalRegionStaticParams } from "./municipal-region";
export { renderMunicipalCountry } from "./municipal-country";

export function municipalPageMetadata(kind: "index" | "country" | "municipality" | "region", id: string | null, locale: Locale) {
  switch (kind) {
    case "index": return municipalIndexMetadata(locale);
    case "country": return municipalCountryMetadata(locale);
    case "municipality": return municipalityMetadata(id ?? "", locale);
    case "region": return municipalRegionMetadata(id ?? "", locale);
  }
}
