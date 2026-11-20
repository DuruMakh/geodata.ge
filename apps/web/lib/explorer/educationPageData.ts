import { loadServedEducationData, shownEducationFacts, toClientEducationFact } from "../data/education/importEducation";
import { EDUCATION_GEORGIA, type ClientEducationFact } from "../data/education/types";
import { loadServedMunicipalData } from "../data/servedData";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale, Messages } from "../i18n/types";
import { GEORGIA_PLACE_ID, buildDemographyPlaces } from "./demographyAreas";
import { educationSeriesLabel, educationTopicSeries, type EducationSeriesDefinition, type EducationTopicId } from "./education";
import { educationPlaceSeries, type EducationPlaceSet } from "./educationPlaces";

/*
 * What the Education pages hand their explorers: the series they list, the shown facts, the names and the places. Shared by
 * the pages (lib/pages/education.tsx, education-places.tsx) and the MCP snapshot build (lib/factQuery/topics/education.ts),
 * which cannot import the pages (they pull in `server-only` and React).
 */

/** A list's names: each series' own and each heading's (measure's), as the explorers and their workbooks print them. */
export function educationListLabels(messages: Messages, series: readonly EducationSeriesDefinition[]) {
  return {
    labels: Object.fromEntries(series.map(({ id }) => [id, educationSeriesLabel(messages, id)])),
    headingLabels: Object.fromEntries(series.map(({ heading }) => [heading, message(messages, `education.heading.${heading}`)])),
  };
}

/** Universities or Vocational colleges: the page's language, its series, Georgia's shown facts of them and their names. */
export async function educationTopicPageData(locale: Locale, section: EducationTopicId) {
  const [{ facts: served }, presentation] = await Promise.all([loadServedEducationData(), getPresentation(locale, ["education", "format", "main", "workbook"], [])]);
  const series = educationTopicSeries(section);
  // The page receives only the observations its list can show (never the old vocational fields).
  const ids = new Set<string>(series.map(({ id }) => id));
  const shown = shownEducationFacts(served).filter(f => ids.has(f.indicatorId) && f.geographyId === EDUCATION_GEORGIA);
  return { presentation, series, shown, facts: shown.map(toClientEducationFact), ...educationListLabels(presentation.messages, series) };
}

/** What the Schools and Kindergartens index and place pages share: the shown facts, the registries, the language and the place list. */
export async function educationPlacePageData(locale: Locale) {
  const [{ facts: served }, municipal, georgian] = await Promise.all([loadServedEducationData(), loadServedMunicipalData(), getMessages("ka", ["municipal"])]);
  const shown = shownEducationFacts(served);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map(region => region.id), ...municipal.municipalities.map(m => m.code)];
  // `municipal` is loaded for the map's and the picker's words (tabs, search, boundaries, member counts).
  const presentation = await getPresentation(locale, ["education", "format", "main", "workbook", "municipal"], ids, ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions, municipalities: municipal.municipalities, englishLabels: presentation.englishLabels, georgiaNameKa: message(georgian, "municipal.georgia"),
  });
  const lastReviewedAt = shown.map(f => f.lastReviewedAt).sort().at(-1)!;
  return { shown, facts: shown.map(toClientEducationFact), municipal, presentation, places, lastReviewedAt };
}

/** One place page's list: the series it lists, the place's own facts of them and their names. */
export function educationPlaceListData(messages: Messages, set: EducationPlaceSet, placeId: string, facts: readonly ClientEducationFact[]) {
  const series = educationPlaceSeries(set, placeId);
  return { series, facts: facts.filter(f => f.geographyId === placeId && series.some(({ id }) => id === f.indicatorId)), ...educationListLabels(messages, series) };
}
