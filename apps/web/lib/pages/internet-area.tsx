import { InternetAreaExplorer } from "../../components/internet/internet-area-explorer";
import { internetAreaCoverage } from "../explorer/internetAreas";
import { internetAreaFacts, internetAreaSeriesLabels } from "../explorer/internetPageData";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadInternetWorkbookSources, renderInternetHomesFrame } from "./internet-shared";

/** An area's page: Georgia's or a region's homes with internet and with a computer (the frame is internet-shared.tsx's). */
export async function renderInternetAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadInternetWorkbookSources(locale);
  return renderInternetHomesFrame(locale, area, facts => internetAreaCoverage(area, internetAreaFacts(facts, area)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // Georgia's rows are Georgia, towns and villages under its two headings; a region's are its homes with internet and with a computer.
    const labels = internetAreaSeriesLabels(presentation.messages, area);
    return <InternetAreaExplorer key={area} area={area} facts={internetAreaFacts(facts, area)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
