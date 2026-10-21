import { InternetAreaExplorer } from "../../components/internet/internet-area-explorer";
import { toClientInternetFact } from "../data/internet/importInternet";
import type { InternetFact } from "../data/internet/types";
import { internetAreaCoverage, internetAreaSeries } from "../explorer/internetAreas";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadInternetWorkbookSources, renderInternetHomesFrame } from "./internet-shared";

/** An area's page: Georgia's or a region's homes with internet and with a computer (the frame is internet-shared.tsx's). */
export async function renderInternetAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadInternetWorkbookSources(locale);
  const series = internetAreaSeries(area);
  const ids = new Set<string>(series.map(item => item.id));
  const areaFacts = (facts: InternetFact[]) => facts.map(toClientInternetFact).filter(f => ids.has(f.indicatorId));
  return renderInternetHomesFrame(locale, area, facts => internetAreaCoverage(area, areaFacts(facts)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // Georgia's rows are Georgia, towns and villages under its two headings; a region's are its homes with internet and with a computer.
    const label = (id: string) => {
      const [, measure, group] = id.split(".");
      if (area !== "georgia") return message(presentation.messages, `internet.series.area.${measure === "homes_internet" ? "internet" : "computer"}`);
      return message(presentation.messages, group === "total" ? "internet.series.area.georgia" : `internet.series.group.${group}`);
    };
    const labels = Object.fromEntries(series.map(item => [item.id, label(item.id)]));
    return <InternetAreaExplorer key={area} area={area} facts={areaFacts(facts)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
