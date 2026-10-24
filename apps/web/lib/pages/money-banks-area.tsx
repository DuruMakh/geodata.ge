import { MoneyBanksAreaExplorer } from "../../components/money-banks/money-banks-area-explorer";
import { toClientMoneyBanksFact } from "../data/moneyBanks/importMoneyBanks";
import type { MoneyBanksFact } from "../data/moneyBanks/types";
import { moneyBanksAreaCoverage, moneyBanksAreaSeries } from "../explorer/moneyBanksAreas";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { AREA_PAGES, areaForSlug, loadMoneyBanksRegionsWorkbookSources, renderMoneyBanksRegionsFrame } from "./money-banks-regions-shared";

/** An area's page: Georgia's or a region's loans, in total, in lari and in foreign currency (the frame is money-banks-regions-shared.tsx's). */
export async function renderMoneyBanksAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  const sources = await loadMoneyBanksRegionsWorkbookSources(locale);
  const series = moneyBanksAreaSeries(area);
  const ids = new Set<string>(series.map(item => item.id));
  const areaFacts = (facts: MoneyBanksFact[]) => facts.filter(f => ids.has(f.indicatorId)).map(toClientMoneyBanksFact);
  return renderMoneyBanksRegionsFrame(locale, area, facts => moneyBanksAreaCoverage(area, areaFacts(facts)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // The rows are named without the area, which the heading names: `loans_region.<area>.<part>` reads `moneyBanks.series.loans_region.<part>`.
    const labels = Object.fromEntries(series.map(item => [item.id, message(presentation.messages, `moneyBanks.series.loans_region.${item.id.split(".")[2]}`)]));
    return <MoneyBanksAreaExplorer key={area} area={area} facts={areaFacts(facts)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
