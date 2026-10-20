import { loadServedEnvironmentData, toClientEnvironmentFact } from "../../data/environment/importEnvironment";
import { ENVIRONMENT_HUB_PATH } from "../../explorer/environment";
import { buildEnvironmentHubCards } from "../../explorer/environmentHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function environmentHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["environment"]);
  return fiscalMetadata({ locale, path: ENVIRONMENT_HUB_PATH, title: message(messages, "environment.metaTitle"), description: message(messages, "environment.metaDescription") });
}

export async function renderEnvironmentHub(locale: Locale) {
  const [facts, presentation] = await Promise.all([loadServedEnvironmentData(), getPresentation(locale, ["environment"], [])]);
  const title = message(presentation.messages, "environment.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "environment.hubSummary")} path={ENVIRONMENT_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildEnvironmentHubCards(facts.map(toClientEnvironmentFact), presentation)} testId="environment-hub" />;
}
