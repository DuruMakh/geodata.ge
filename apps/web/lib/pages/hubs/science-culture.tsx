import { SCIENCE_CULTURE_HUB_PATH } from "../../explorer/scienceCulture";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function scienceCultureHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["scienceCulture"]);
  return fiscalMetadata({ locale, path: SCIENCE_CULTURE_HUB_PATH, title: message(messages, "scienceCulture.metaTitle"), description: message(messages, "scienceCulture.metaDescription") });
}

/** The hub: one card per page, Research, Patents, Museums and Theatres, each from served facts. */
export async function renderScienceCultureHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS["science-culture"](locale), getPresentation(locale, ["scienceCulture"], [])]);
  const title = message(presentation.messages, "scienceCulture.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "scienceCulture.hubSummary")} path={SCIENCE_CULTURE_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="science-culture-hub" />;
}
