import { HOUSING_HUB_PATH } from "../../explorer/housing";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function housingHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["housing"]);
  return fiscalMetadata({ locale, path: HOUSING_HUB_PATH, title: message(messages, "housing.metaTitle"), description: message(messages, "housing.metaDescription") });
}

export async function renderHousingHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.housing(locale), getPresentation(locale, ["housing"], [])]);
  const title = message(presentation.messages, "housing.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "housing.hubSummary")} path={HOUSING_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="housing-hub" />;
}
