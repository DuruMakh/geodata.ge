import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { publicLabel } from "../i18n/labels";
import type { Locale } from "../i18n/types";
import { EDITORIAL_PALETTE, INK } from "./colors";

export const GEORGIA_PLACE_ID = MUNICIPAL_COUNTRY_ID;
export const TBILISI_PLACE_ID = "region.tbilisi";
// Municipality 04 is the same place, with the same numbers, as the region of Tbilisi. The page
// keeps one place for it, so choosing it under either grouping draws one line.
const TBILISI_MUNICIPALITY_CODE = "04";

export type DemographyPlaceLevel = "country" | "region" | "municipality";

export type DemographyPlace = {
  /** `country.georgia`, a `region.*` id, or a two-digit municipality code; Tbilisi is always `region.tbilisi`. */
  id: string;
  level: DemographyPlaceLevel;
  nameKa: string;
  nameEn: string;
  /** Municipalities: the id of their region. */
  regionId: string | null;
  /** Georgia 0, regions by their registry order, municipalities by their sort id. */
  sortOrder: number;
  /** Regions and Georgia: how many municipalities they hold. */
  municipalityCount: number;
};

export function buildDemographyPlaces({
  regions,
  municipalities,
  englishLabels,
  georgiaNameKa,
}: {
  regions: readonly MunicipalRegion[];
  municipalities: readonly Municipality[];
  englishLabels: Readonly<Record<string, string>>;
  georgiaNameKa: string;
}): DemographyPlace[] {
  const english = (id: string, nameKa: string) => publicLabel("en", id, nameKa, englishLabels);
  const countByRegion = new Map<string, number>();
  for (const municipality of municipalities) {
    countByRegion.set(municipality.regionId, (countByRegion.get(municipality.regionId) ?? 0) + 1);
  }
  return [
    {
      id: GEORGIA_PLACE_ID,
      level: "country",
      nameKa: georgiaNameKa,
      nameEn: english(GEORGIA_PLACE_ID, georgiaNameKa),
      regionId: null,
      sortOrder: 0,
      municipalityCount: municipalities.length,
    },
    ...regions.map((region): DemographyPlace => ({
      id: region.id,
      level: "region",
      nameKa: region.kaLabel,
      nameEn: english(region.id, region.kaLabel),
      regionId: null,
      sortOrder: region.sortOrder,
      municipalityCount: countByRegion.get(region.id) ?? 0,
    })),
    ...municipalities
      .filter((municipality) => municipality.code !== TBILISI_MUNICIPALITY_CODE)
      .map((municipality): DemographyPlace => ({
        id: municipality.code,
        level: "municipality",
        nameKa: municipality.displayNameKa,
        nameEn: english(municipality.code, municipality.displayNameKa),
        regionId: municipality.regionId,
        sortOrder: municipality.sortId,
        municipalityCount: 0,
      })),
  ];
}

/** Rows keyed by municipality code (the facts, the municipal map) name Tbilisi `04`; the page names it `region.tbilisi`. */
export function placeIdForMunicipalityCode(code: string): string {
  return code === TBILISI_MUNICIPALITY_CODE ? TBILISI_PLACE_ID : code;
}

export function municipalityCodeForPlaceId(id: string): string {
  return id === TBILISI_PLACE_ID ? TBILISI_MUNICIPALITY_CODE : id;
}

/** Georgia, then the places of one level. Tbilisi is in both lists because it is both a region and a municipality. */
export function placesAtLevel(places: readonly DemographyPlace[], level: "regions" | "municipalities"): DemographyPlace[] {
  return places.filter(
    (place) =>
      place.id === GEORGIA_PLACE_ID ||
      (level === "regions" ? place.level === "region" : place.level === "municipality" || place.id === TBILISI_PLACE_ID),
  );
}

/** Georgia is ink; regions and municipalities cycle the editorial palette by their registry order, so a place keeps its colour on every page. */
export function placeColor(place: DemographyPlace): string {
  if (place.level === "country") return INK;
  const index = place.level === "region" ? place.sortOrder - 1 : place.sortOrder;
  return EDITORIAL_PALETTE[index % EDITORIAL_PALETTE.length]!;
}

export function placeLabel(place: DemographyPlace, locale: Locale): string {
  return locale === "en" ? place.nameEn : place.nameKa;
}
