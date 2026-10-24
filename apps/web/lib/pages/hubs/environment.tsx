import { ENVIRONMENT_HUB_PATH } from "../../explorer/environment";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function environmentHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["environment"]);
  return fiscalMetadata({ locale, path: ENVIRONMENT_HUB_PATH, title: message(messages, "environment.metaTitle"), description: message(messages, "environment.metaDescription") });
}

export async function renderEnvironmentHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.environment(locale), getPresentation(locale, ["environment"], [])]);
  const title = message(presentation.messages, "environment.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "environment.hubSummary")} path={ENVIRONMENT_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="environment-hub" />;
}
