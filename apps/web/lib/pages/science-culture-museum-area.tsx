import { MuseumAreaExplorer } from "../../components/science-culture/museum-area-explorer";
import { toClientScienceCultureFact } from "../data/scienceCulture/importScienceCulture";
import type { ScienceCultureFact } from "../data/scienceCulture/types";
import { museumAreaCoverage, museumAreaSeries } from "../explorer/scienceCultureMuseums";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, loadScienceCultureWorkbookSources, museumAreaForSlug, renderMuseumsFrame, scienceCultureLabels } from "./science-culture-shared";

/** A museum area's page: Georgia's or a region's visitors, group tours, exhibitions and museums (the frame is science-culture-shared.tsx's). */
export async function renderMuseumAreaPage(locale: Locale, slug: string) {
  const area = museumAreaForSlug(slug);
  const sources = await loadScienceCultureWorkbookSources();
  const series = museumAreaSeries(area);
  const ids = new Set<string>(series.map(item => item.id));
  const areaFacts = (facts: ScienceCultureFact[]) => facts.map(toClientScienceCultureFact).filter(f => ids.has(f.indicatorId));
  return renderMuseumsFrame(locale, area, facts => museumAreaCoverage(area, areaFacts(facts)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) =>
    <MuseumAreaExplorer key={area} area={area} facts={areaFacts(facts)} labels={scienceCultureLabels(presentation.messages, series)} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />);
}
