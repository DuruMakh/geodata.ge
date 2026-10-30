import type { DemographyPlace } from "../explorer/demographyAreas";
import { REGION_GENITIVE_KA, REGION_LOCATIVE_KA } from "../explorer/municipalLabels";
import { municipalityOfficialNameGenitiveKa } from "./metadata";

// Georgian "of" and "-ში" ("in") forms of a place, for page titles worded the way people search
// ("ხაშურის მუნიციპალიტეტის მოსახლეობა", "მოსახლეობა ბათუმში").

export type TitlePlace = Pick<DemographyPlace, "id" | "level" | "nameKa" | "nameEn"> & {
  officialNameKa?: string;
  selfGoverningCity?: boolean;
};

const GEORGIA_OF_KA = "საქართველოს";
const GEORGIA_IN_KA = "საქართველოში";
const CITY_PREFIX = "ქალაქ ";
const MUNICIPALITY_SUFFIX = " მუნიციპალიტეტი";

function regionForm(forms: Record<string, string>, place: TitlePlace): string {
  const form = forms[place.id];
  if (form === undefined) throw new Error(`No Georgian title form for region ${place.id}`);
  return form;
}

function officialNameOf(place: TitlePlace): string {
  if (place.officialNameKa === undefined) throw new Error(`Municipality ${place.id} has no official name`);
  return place.officialNameKa;
}

/** The final ი of a nominative name becomes "ში": ბათუმი gives ბათუმში. */
function inFromNominative(name: string): string {
  if (!name.endsWith("ი")) throw new Error(`Cannot form -ში from a name that does not end in ი: ${name}`);
  return `${name.slice(0, -1)}ში`;
}

export function placeOfKa(place: TitlePlace): string {
  if (place.level === "country") return GEORGIA_OF_KA;
  if (place.level === "region") return regionForm(REGION_GENITIVE_KA, place);
  const genitive = municipalityOfficialNameGenitiveKa(officialNameOf(place));
  if (!place.selfGoverningCity) return genitive;
  // "ქალაქ ბათუმის მუნიციპალიტეტის" -> "ბათუმის"
  if (!genitive.startsWith(CITY_PREFIX)) {
    throw new Error(`Self-governing city official name must start with "ქალაქ": ${officialNameOf(place)}`);
  }
  const cityGenitive = genitive.slice(CITY_PREFIX.length, -(MUNICIPALITY_SUFFIX.length + "ს".length));
  return cityGenitive;
}

export function placeInKa(place: TitlePlace): string {
  if (place.level === "country") return GEORGIA_IN_KA;
  if (place.level === "region") return regionForm(REGION_LOCATIVE_KA, place);
  const officialName = officialNameOf(place);
  municipalityOfficialNameGenitiveKa(officialName);
  return inFromNominative(place.selfGoverningCity ? place.nameKa : officialName);
}

export function placeTitleNameEn(place: TitlePlace): string {
  if (place.level === "country") return "Georgia";
  if (place.level === "municipality" && !place.selfGoverningCity) return `${place.nameEn} Municipality`;
  return place.nameEn;
}

/** The latest year among the facts `keep` accepts; throws when it accepts none, so a title never carries a made-up year. */
export function latestYearOf<T extends { year: number }>(facts: readonly T[], keep: (fact: T) => boolean): number {
  const years = facts.filter(keep).map((fact) => fact.year);
  if (years.length === 0) throw new Error("No fact is kept, so there is no latest year");
  return Math.max(...years);
}
