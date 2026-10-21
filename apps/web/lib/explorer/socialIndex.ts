import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { SOCIAL_GEORGIA, type ClientSocialFact } from "../data/social/types";
import { placeIdForMunicipalityCode } from "./demographyAreas";
import { placeIndexRows } from "./demographyPopulationIndex";
import { formatShare } from "./format";
import type { MunicipalListRow } from "./municipalData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";
import { sharePerHundred, type SocialPlaceSet, type SocialPopulation } from "./social";

// The index's map reads the boundary file from disk, so this module stays on the server: the place pages' client
// code (socialPlaces.ts) must not import it, as Education's index (educationIndex.ts) is kept apart.

/** What an index lists and draws, as on the Education index; the rows' money-named `valueGel` carries a share of residents in % here. */
export type SocialIndexModel = {
  /** The latest year any municipality has a share for; every place must have one then (the model throws otherwise). The map and the rows use it. */
  year: number;
  map: MunicipalityMapModel;
  /** The 64 registry municipalities ranked highest first; Tbilisi is code `04`, with its region's value. */
  municipalities: MunicipalListRow[];
  /** The 11 regions ranked highest first. */
  regions: MunicipalListRow[];
  /** Georgia, first and unranked. */
  country: MunicipalListRow;
};

/** The share an index is shaded by: pensioners, or people in receiving families, per 100 residents. */
const INDEX_SHARE: Record<SocialPlaceSet, string> = {
  "pensions": "social.pension.recipients#share",
  "subsistence-allowance": "social.subsistence.persons#share",
};

export function buildSocialIndexModel(set: SocialPlaceSet, facts: readonly ClientSocialFact[], population: SocialPopulation, regions: readonly MunicipalRegion[], municipalities: Municipality[]): SocialIndexModel {
  const places = [SOCIAL_GEORGIA, ...regions.map(region => region.id), ...municipalities.map(m => placeIdForMunicipalityCode(m.code))];
  const byPlace = new Map<string, ClientSocialFact[]>();
  for (const fact of facts) byPlace.set(fact.geographyId, byPlace.get(fact.geographyId) ?? []).get(fact.geographyId)!.push(fact);
  const shares = [...new Set(places)].flatMap(place => sharePerHundred(byPlace.get(place) ?? [], population, place)).filter(f => f.indicatorId === INDEX_SHARE[set]);
  const municipal = shares.filter(f => /^\d{2}$/.test(f.geographyId));
  if (!municipal.length) throw new Error(`No ${set} municipal shares for the index`);
  const year = Math.max(...municipal.map(f => f.year));
  const values = new Map(shares.filter(f => f.year === year).map(f => [f.geographyId, f.value]));
  // The facts name Tbilisi `region.tbilisi`; the registry, the map and the municipal list name it 04.
  const valueOf = (id: string): number => {
    const value = values.get(placeIdForMunicipalityCode(id));
    if (value === undefined) throw new Error(`No ${year} ${set} share for ${id}`);
    return value;
  };
  return {
    year,
    map: buildMunicipalityValueMapModel({ municipalities, values: new Map(municipalities.map(m => [m.code, valueOf(m.code)])), display: (_code, value) => formatShare(value / 100) }),
    ...placeIndexRows({ regions, municipalities, valueOf }),
  };
}
