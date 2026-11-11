import { MuseumAreaExplorer } from "../../components/science-culture/museum-area-explorer";
import { museumAreaCoverage, museumAreaSeries } from "../explorer/scienceCultureMuseums";
import { museumAreaFacts, scienceCultureLabels } from "../explorer/scienceCulturePageData";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, loadScienceCultureWorkbookSources, museumAreaForSlug, renderMuseumsFrame } from "./science-culture-shared";

/** A museum area's page: Georgia's or a region's visitors, group tours, exhibitions and museums (the frame is science-culture-shared.tsx's). */
export async function renderMuseumAreaPage(locale: Locale, slug: string) {
  const area = museumAreaForSlug(slug);
  const sources = await loadScienceCultureWorkbookSources(locale);
  const series = museumAreaSeries(area);
  return renderMuseumsFrame(locale, area, facts => museumAreaCoverage(area, museumAreaFacts(facts, area)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) =>
    <MuseumAreaExplorer key={area} area={area} facts={museumAreaFacts(facts, area)} labels={scienceCultureLabels(presentation.messages, series)} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />);
}
