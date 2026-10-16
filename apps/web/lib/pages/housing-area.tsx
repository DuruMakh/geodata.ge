import { HousingAreaExplorer } from "../../components/housing/housing-area-explorer";
import { toClientHousingFact } from "../data/housing/importHousing";
import type { HousingFact } from "../data/housing/types";
import { housingAreaCoverage, housingAreaSeries } from "../explorer/housingAreas";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadHousingWorkbookSources, renderHousingRegionsFrame } from "./housing-shared";

/** An area's page: Georgia's or a region's permits and completed buildings (the frame is housing-shared.tsx's). */
export async function renderHousingAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadHousingWorkbookSources(locale);
  const series = housingAreaSeries(area);
  const ids = new Set<string>(series.map(item => item.id));
  const areaFacts = (facts: HousingFact[]) => facts.map(toClientHousingFact).filter(f => ids.has(f.indicatorId));
  return renderHousingRegionsFrame(locale, area, facts => housingAreaCoverage(area, areaFacts(facts)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // Every row names what it counts; the area is the page's own.
    // A row's name follows what it counts: permits or completed buildings, all buildings or homes.
    const labels = Object.fromEntries(series.map(item => {
      const [, measure, group] = item.id.split(".");
      const key = `${measure.startsWith("permits_") ? "permits" : "completed"}${group.endsWith("residential") ? "Homes" : ""}`;
      return [item.id, message(presentation.messages, `housing.series.area.${key}`)];
    }));
    return <HousingAreaExplorer key={area} area={area} facts={areaFacts(facts)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
