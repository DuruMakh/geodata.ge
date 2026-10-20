import { InternetIndex } from "../../components/internet/internet-index";
import { toClientInternetFact } from "../data/internet/importInternet";
import type { InternetFact } from "../data/internet/types";
import { buildInternetRegionMapModel } from "../explorer/internetRegionMap";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import type { Locale } from "../i18n/types";
import { renderInternetHomesFrame } from "./internet-shared";

/** The Internet at home index: the map and list whose rows open the area pages. The map is built here; the page receives only Georgia's homes with internet. */
export function renderInternetHomesPage(locale: Locale) {
  let map: RegionMapModel | undefined;
  const regionMap = (facts: InternetFact[]) => map ??= buildInternetRegionMapModel(facts.map(toClientInternetFact));
  return renderInternetHomesFrame(locale, undefined, facts => { const model = regionMap(facts); return [model.firstYear, model.year]; }, ({ facts }) =>
    <InternetIndex facts={facts.map(toClientInternetFact).filter(f => f.indicatorId === "internet.homes_internet.total")} regionMap={regionMap(facts)} />);
}
