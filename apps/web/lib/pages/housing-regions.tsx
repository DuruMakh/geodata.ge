import { HousingIndex } from "../../components/housing/housing-index";
import { toClientHousingFact } from "../data/housing/importHousing";
import type { HousingFact } from "../data/housing/types";
import { buildHousingRegionMapModel } from "../explorer/housingRegionMap";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import type { Locale } from "../i18n/types";
import { renderHousingRegionsFrame } from "./housing-shared";

/** The Regions index: the map and list whose rows open the area pages. The map is built here; the page receives only Georgia's floor area. */
export function renderHousingRegionsPage(locale: Locale) {
  let map: RegionMapModel | undefined;
  const regionMap = (facts: HousingFact[]) => map ??= buildHousingRegionMapModel(facts.map(toClientHousingFact));
  return renderHousingRegionsFrame(locale, undefined, facts => { const model = regionMap(facts); return [model.firstYear, model.year]; }, ({ facts }) =>
    <HousingIndex facts={facts.map(toClientHousingFact).filter(f => f.indicatorId === "housing.permits_area.total")} regionMap={regionMap(facts)} />);
}
