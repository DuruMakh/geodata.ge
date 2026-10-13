import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { loadServedEconomicSectorsData } from "../data/economicSectors/importEconomicSectors";
import { loadServedRegionalEconomyData, REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { buildEconomyHubCards } from "../explorer/economyHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import { TopicHub } from "./hub";
export async function economyPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["gdp"], []);
  return fiscalMetadata({
    locale,
    path: "/explorer/economy",
    title: `${message(p.messages, "gdp.economy")} | Fiscal.ge`,
    description: message(p.messages, "gdp.hubDescription"),
  });
}
export async function renderEconomyPage(locale: Locale) {
  const [{ facts }, p, sectors, regional] = await Promise.all([
    loadServedGdpOverviewData(),
    getPresentation(locale, ["gdp", "sectors", "regionalEconomies"], REGIONAL_ECONOMY_REGIONS.map((region) => region.id)),
    loadServedEconomicSectorsData(),
    loadServedRegionalEconomyData(),
  ]);
  const t = (k: string) => message(p.messages, `gdp.${k}`);
  return (
    <TopicHub locale={locale} presentation={p} title={t("economy")} summary={t("hubDescription")} path={"/explorer/economy"} coverage={coverageLabel(
              p.messages,
              locale,
              Math.min(...facts.map((f) => f.year)),
              Math.max(...facts.map((f) => f.year)),
              [...facts, ...sectors.facts, ...regional.facts].map((f) => f.lastReviewedAt).sort().at(-1),
            )} cards={buildEconomyHubCards(facts, p, sectors.facts, regional.facts)} testId="economy-hub" />
  );
}
