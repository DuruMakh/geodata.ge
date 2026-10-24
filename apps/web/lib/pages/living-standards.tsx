import { LIVING_STANDARDS_HUB_PATH } from "../explorer/livingStandards";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { TopicHub } from "./hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "./topicHubs.server";

export async function livingStandardsHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["household"]);
  return fiscalMetadata({ locale, path: LIVING_STANDARDS_HUB_PATH, title: message(messages, "household.hub.metaTitle"), description: message(messages, "household.hub.metaDescription") });
}

export async function renderLivingStandardsHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS["living-standards"](locale), getPresentation(locale, ["household", "poverty"], [])]);
  const title = message(presentation.messages, "household.hub.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "household.hub.summary")} path={LIVING_STANDARDS_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="living-standards-hub" />;
}
