import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { TopicHub } from "./hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "./topicHubs.server";

export async function demographyPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: DEMOGRAPHY_HUB_PATH,
    title: message(p.messages, "demography.title"),
    description: message(p.messages, "demography.hubDescription"),
  });
}

export async function renderDemographyPage(locale: Locale) {
  const [hub, p] = await Promise.all([
    TOPIC_HUB_LOADERS.demography(locale),
    getPresentation(locale, ["demography"], []),
  ]);
  const title = message(p.messages, "demography.title");
  return (
    <TopicHub locale={locale} presentation={p} title={title} summary={message(p.messages, "demography.hubLead")} path={DEMOGRAPHY_HUB_PATH} coverage={topicHubCoverage(p.messages, locale, hub)} cards={hub.cards} testId="demography-hub" />
  );
}
