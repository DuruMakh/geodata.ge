import { getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { TopicHub } from "./hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "./topicHubs.server";
export async function economyPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["gdp"], []);
  return fiscalMetadata({
    locale,
    path: "/explorer/economy",
    title: message(p.messages, "gdp.economy"),
    description: message(p.messages, "gdp.hubMetaDescription"),
  });
}
export async function renderEconomyPage(locale: Locale) {
  const [hub, p] = await Promise.all([
    TOPIC_HUB_LOADERS.economy(locale),
    getPresentation(locale, ["gdp"], []),
  ]);
  const t = (k: string) => message(p.messages, `gdp.${k}`);
  return (
    <TopicHub locale={locale} presentation={p} title={t("economy")} summary={t("hubDescription")} path={"/explorer/economy"} coverage={topicHubCoverage(p.messages, locale, hub)} cards={hub.cards} testId="economy-hub" />
  );
}
