import { TransportAreaExplorer } from "../../components/transport/transport-area-explorer";
import { transportAreaCoverage } from "../explorer/transportAreas";
import { transportAreaFacts, transportAreaSeriesLabels } from "../explorer/transportPageData";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadTransportWorkbookSources, renderTransportRegionsFrame } from "./transport-shared";

/** An area's page: Georgia's or a region's registered vehicles and roads (the frame is transport-shared.tsx's). */
export async function renderTransportAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadTransportWorkbookSources(locale);
  return renderTransportRegionsFrame(locale, area, facts => transportAreaCoverage(area, transportAreaFacts(facts, area)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // A row is named by its column alone (a vehicle type, fuel, age band, owner or road type); its heading names the measure and unit, and the area is the page's own.
    const labels = transportAreaSeriesLabels(presentation.messages, area);
    return <TransportAreaExplorer key={area} area={area} facts={transportAreaFacts(facts, area)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
