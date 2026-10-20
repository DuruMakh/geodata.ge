import { TransportAreaExplorer } from "../../components/transport/transport-area-explorer";
import { toClientTransportFact } from "../data/transport/importTransport";
import type { TransportFact } from "../data/transport/types";
import { transportAreaCoverage, transportAreaSeries } from "../explorer/transportAreas";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadTransportWorkbookSources, renderTransportRegionsFrame } from "./transport-shared";

/** An area's page: Georgia's or a region's registered vehicles and roads (the frame is transport-shared.tsx's). */
export async function renderTransportAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadTransportWorkbookSources(locale);
  const series = transportAreaSeries(area);
  const ids = new Set<string>(series.map(item => item.id));
  const areaFacts = (facts: TransportFact[]) => facts.map(toClientTransportFact).filter(f => ids.has(f.indicatorId));
  return renderTransportRegionsFrame(locale, area, facts => transportAreaCoverage(area, areaFacts(facts)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // A row is named by its column alone (a vehicle type, fuel, age band, owner or road type); its heading names the measure and unit, and the area is the page's own.
    const prefix = area === "georgia" ? "total" : area;
    const labels = Object.fromEntries(series.map(({ id, heading }) => {
      const part = id.split(".")[2].slice(prefix.length + 1);
      const key = heading === "roads" ? `road.${part || "total"}` : !part ? "registered.total" : heading === "registered" ? `type.${part}`
        : heading === "fuel" ? `fuel.${part.slice("fuel_".length)}` : heading === "age" ? `areaAge.${part.slice("age_".length)}` : `owner.${part.slice("owner_".length)}`;
      return [id, message(presentation.messages, `transport.series.${key}`)];
    }));
    return <TransportAreaExplorer key={area} area={area} facts={areaFacts(facts)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
