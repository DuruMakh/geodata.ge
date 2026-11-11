import { HousingAreaExplorer } from "../../components/housing/housing-area-explorer";
import { housingAreaCoverage } from "../explorer/housingAreas";
import { housingAreaFacts, housingAreaSeriesLabels } from "../explorer/housingPageData";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadHousingWorkbookSources, renderHousingRegionsFrame } from "./housing-shared";

/** An area's page: Georgia's or a region's permits and completed buildings (the frame is housing-shared.tsx's). */
export async function renderHousingAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadHousingWorkbookSources(locale);
  return renderHousingRegionsFrame(locale, area, facts => housingAreaCoverage(area, housingAreaFacts(facts, area)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // A row is all buildings or residential buildings; its heading says permits or completed and the unit, and the area is the page's own.
    const labels = housingAreaSeriesLabels(presentation.messages, area);
    return <HousingAreaExplorer key={area} area={area} facts={housingAreaFacts(facts, area)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
