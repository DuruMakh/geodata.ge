import { MuseumsIndex } from "../../components/science-culture/museums-index";
import { toClientScienceCultureFact } from "../data/scienceCulture/importScienceCulture";
import type { ScienceCultureFact } from "../data/scienceCulture/types";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import { buildMuseumRegionMapModel } from "../explorer/scienceCultureMuseumsRegionMap";
import type { Locale } from "../i18n/types";
import { renderMuseumsFrame } from "./science-culture-shared";

/** The Museums index: the map and list whose rows open the area pages. The map is built here; the page receives only Georgia's visitors. */
export function renderMuseumsIndexPage(locale: Locale) {
  let map: RegionMapModel | undefined;
  const regionMap = (facts: ScienceCultureFact[]) => map ??= buildMuseumRegionMapModel(facts.map(toClientScienceCultureFact));
  return renderMuseumsFrame(locale, undefined, facts => { const model = regionMap(facts); return [model.firstYear, model.year]; }, ({ facts }) =>
    <MuseumsIndex facts={facts.map(toClientScienceCultureFact).filter(f => f.indicatorId === "science_culture.museum_visitors.total")} regionMap={regionMap(facts)} />);
}
