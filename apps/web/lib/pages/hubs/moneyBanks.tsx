import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function moneyBanksHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["moneyBanks"]);
  return fiscalMetadata({ locale, path: "/explorer/money", title: message(messages, "moneyBanks.metaTitle"), description: message(messages, "moneyBanks.metaDescription") });
}

export async function renderMoneyBanksHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.money(locale), getPresentation(locale, ["moneyBanks"], [])]);
  const title = message(presentation.messages, "moneyBanks.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "moneyBanks.hubSummary")} path={"/explorer/money"} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="money-hub" />;
}
