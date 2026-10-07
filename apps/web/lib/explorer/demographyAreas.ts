import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { publicLabel } from "../i18n/labels";
import type { Locale } from "../i18n/types";
import { EDITORIAL_PALETTE, INK, OTHER_COLOR, colorForItem } from "./colors";

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
  /** The place's one colour, the same on every page: Georgia is ink and no region shares a colour with a municipality of its own. */
  color: string;
};

/**
 * A municipality wears the palette colour its registry position gives it, unless that is its region's colour. It then takes the
 * next palette colour, walking on from its own position, that neither the region nor a sibling wears and no moved sibling has
 * been given, so a region's page never draws two series in one colour and a municipality that did not clash never changes.
 * The walk also skips the grey "other" wears: it sits a hair from the palette's #8A7B65 and would read as a repeat of it.
 */
function municipalityColours(
  municipalities: readonly Municipality[],
  regionColours: ReadonlyMap<string, string>,
): Map<string, string> {
  const colours = new Map(municipalities.map((municipality) => [municipality.code, colorForItem(municipality.code, municipality.sortId)]));
  for (const [regionId, regionColour] of regionColours) {
    const siblings = municipalities
      .filter((municipality) => municipality.regionId === regionId)
      .sort((left, right) => left.sortId - right.sortId || left.code.localeCompare(right.code));
    const worn = new Set([regionColour, ...siblings.map((sibling) => colours.get(sibling.code)!)]);
    for (const sibling of siblings.filter((candidate) => colours.get(candidate.code) === regionColour)) {
      const own = sibling.sortId % EDITORIAL_PALETTE.length;
      const free = EDITORIAL_PALETTE.map((_, step) => EDITORIAL_PALETTE[(own + step + 1) % EDITORIAL_PALETTE.length]!).find(
        (colour) => colour !== OTHER_COLOR && !worn.has(colour),
      );
      if (free === undefined) throw new Error(`No palette colour is free for municipality ${sibling.code} of ${regionId}`);
      colours.set(sibling.code, free);
      worn.add(free);
    }
  }
  return colours;
}

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
  const members = municipalities.filter((municipality) => municipality.code !== TBILISI_MUNICIPALITY_CODE);
  const regionColours = new Map(regions.map((region) => [region.id, colorForItem(region.id, region.sortOrder - 1)]));
  const memberColours = municipalityColours(members, regionColours);
  return [
    {
      id: GEORGIA_PLACE_ID,
      level: "country",
      nameKa: georgiaNameKa,
      nameEn: english(GEORGIA_PLACE_ID, georgiaNameKa),
      regionId: null,
      sortOrder: 0,
      municipalityCount: municipalities.length,
      color: INK,
    },
    ...regions.map((region): DemographyPlace => ({
      id: region.id,
      level: "region",
      nameKa: region.kaLabel,
      nameEn: english(region.id, region.kaLabel),
      regionId: null,
      sortOrder: region.sortOrder,
      municipalityCount: countByRegion.get(region.id) ?? 0,
      color: regionColours.get(region.id)!,
    })),
    ...members.map((municipality): DemographyPlace => ({
      id: municipality.code,
      level: "municipality",
      nameKa: municipality.displayNameKa,
      nameEn: english(municipality.code, municipality.displayNameKa),
      regionId: municipality.regionId,
      sortOrder: municipality.sortId,
      municipalityCount: 0,
      color: memberColours.get(municipality.code)!,
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

/** What a place is made of, for the tick-list: Georgia has its regions, a region its municipalities, a municipality nothing. Tbilisi is a region whose one municipality is itself, so it has none. */
export function partsOf(place: DemographyPlace, places: readonly DemographyPlace[]): DemographyPlace[] {
  if (place.level === "country") return places.filter((candidate) => candidate.level === "region");
  if (place.level === "region") {
    return places.filter((candidate) => candidate.level === "municipality" && candidate.regionId === place.id);
  }
  return [];
}

/** The place's own colour, so it keeps it on every page: Georgia is ink; regions and municipalities cycle the editorial palette by their registry order. */
export function placeColor(place: DemographyPlace): string {
  return place.color;
}

export function placeLabel(place: DemographyPlace, locale: Locale): string {
  return locale === "en" ? place.nameEn : place.nameKa;
}
