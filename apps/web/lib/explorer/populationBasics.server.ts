import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES } from "../data/demography/series";
import { loadServedMunicipalData } from "../data/servedData";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale } from "../i18n/types";
import { projectDemographyObservation } from "./clientData";
import { GEORGIA_PLACE_ID, buildDemographyPlaces } from "./demographyAreas";

// The Population pages' shared data, here rather than in their page module (lib/pages/demography-population.tsx), so the group
// pages and the place index, which name places as those pages do, do not take in the page's client components.

/** Everything the index and the place pages share: the served facts, the registries, the language and the place list. */
export async function loadPopulationBasics(locale: Locale) {
  const [{ facts: served }, municipal, georgian] = await Promise.all([
    loadServedDemographyData(),
    loadServedMunicipalData(),
    getMessages("ka", ["demography"]),
  ]);
  // The served rows include other demography pages' series; the Population pages carry only their own two.
  const facts = served.filter((fact) => fact.seriesId === SERIES.populationTotal || fact.seriesId === SERIES.populationDensity);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  // `municipal` is loaded for the map's legend text and the list's labels (tabs, search, boundaries).
  const presentation = await getPresentation(locale, ["demography", "format", "main", "workbook", "municipal"], ids, ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: message(georgian, "demography.georgia"),
  });
  return { facts, clientFacts: facts.map(projectDemographyObservation), municipal, presentation, places };
}
