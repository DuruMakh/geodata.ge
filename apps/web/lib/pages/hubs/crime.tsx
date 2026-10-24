import { CRIME_HUB_PATH } from "../../explorer/crime";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function crimeHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["crime"]);
  return fiscalMetadata({ locale, path: CRIME_HUB_PATH, title: message(messages, "crime.metaTitle"), description: message(messages, "crime.metaDescription") });
}

export async function renderCrimeHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.crime(locale), getPresentation(locale, ["crime"], [])]);
  const title = message(presentation.messages, "crime.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "crime.hubSummary")} path={CRIME_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="crime-hub" />;
}
