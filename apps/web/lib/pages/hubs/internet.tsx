import { loadServedInternetData, toClientInternetFact } from "../../data/internet/importInternet";
import { INTERNET_HUB_PATH } from "../../explorer/internet";
import { buildInternetHubCards } from "../../explorer/internetHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function internetHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["internet"]);
  return fiscalMetadata({ locale, path: INTERNET_HUB_PATH, title: message(messages, "internet.metaTitle"), description: message(messages, "internet.metaDescription") });
}

export async function renderInternetHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedInternetData(), getPresentation(locale, ["internet"], [])]);
  const title = message(presentation.messages, "internet.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "internet.hubSummary")} path={INTERNET_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildInternetHubCards(facts.map(toClientInternetFact), presentation)} testId="internet-hub" />;
}
