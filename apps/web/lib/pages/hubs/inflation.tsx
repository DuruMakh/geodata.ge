import { loadServedInflationData } from "../../data/inflation/importInflation";
import { loadServedProductData } from "../../data/inflation/importProducts";
import { periodFromKey } from "../../data/inflation/periods";
import { cityFactInput } from "../../data/inflation/types";
import { buildInflationHubCards, buildLatestProductHubSummary } from "../../explorer/inflationHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { periodLabel } from "../../explorer/inflationLabels";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { INFLATION_HUB_PATH } from "../inflation-shared";

export async function inflationHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["inflation"]);
  return fiscalMetadata({ locale, path: INFLATION_HUB_PATH, title: message(messages, "inflation.hubMetaTitle"), description: message(messages, "inflation.hubDescription") });
}

export async function renderInflationHub(locale: Locale) {
  const [{ facts, categories, weights, cities }, productData, presentation] = await Promise.all([
    loadServedInflationData(), loadServedProductData(), getPresentation(locale, ["inflation"], []),
  ]);
  const t = (key: string) => message(presentation.messages, key);
  const periods = facts.map((fact) => fact.period).sort();
  const coverage = coverageLabel(
    presentation.messages, locale,
    periodLabel(presentation.messages, periodFromKey(periods[0]), "short"),
    periodLabel(presentation.messages, periodFromKey(periods.at(-1)!), "short"),
    facts.map((fact) => fact.lastReviewedAt).sort().at(-1),
  );
  return (
    <TopicHub locale={locale} presentation={presentation} title={t("inflation.hubHeading")} crumbLabel={t("common.inflation")} summary={t("inflation.hubLead")} path={INFLATION_HUB_PATH} coverage={coverage} cards={buildInflationHubCards(facts, presentation, categories, weights, buildLatestProductHubSummary(productData), cities.map(cityFactInput))} testId="inflation-hub" />
  );
}
