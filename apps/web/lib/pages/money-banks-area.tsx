import { MoneyBanksAreaExplorer } from "../../components/money-banks/money-banks-area-explorer";
import { moneyBanksAreaCoverage } from "../explorer/moneyBanksAreas";
import { moneyBanksAreaFacts, moneyBanksAreaSeriesLabels } from "../explorer/moneyBanksPageData";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadMoneyBanksRegionsWorkbookSources, renderMoneyBanksRegionsFrame } from "./money-banks-regions-shared";

/** An area's page: Georgia's or a region's loans, in total, in lari and in foreign currency (the frame is money-banks-regions-shared.tsx's). */
export async function renderMoneyBanksAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadMoneyBanksRegionsWorkbookSources(locale);
  return renderMoneyBanksRegionsFrame(locale, area, facts => moneyBanksAreaCoverage(area, moneyBanksAreaFacts(facts, area)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) =>
    <MoneyBanksAreaExplorer key={area} area={area} facts={moneyBanksAreaFacts(facts, area)} labels={moneyBanksAreaSeriesLabels(presentation.messages, area)} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />);
}
