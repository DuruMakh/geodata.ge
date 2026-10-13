import { loadServedWagesData, toClientWagesFact } from "../../data/wages/importWages";
import { buildWagesHubCards } from "../../explorer/wagesHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function wagesHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["wages"]);
  return fiscalMetadata({ locale, path: "/explorer/wages", title: message(messages, "wages.metaTitle"), description: message(messages, "wages.metaDescription") });
}

export async function renderWagesHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedWagesData(), getPresentation(locale, ["wages", "common"], [])]);
  const title = message(presentation.messages, "wages.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "wages.hubSummary")} path={"/explorer/wages"} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildWagesHubCards(facts.map(toClientWagesFact), presentation)} testId="wages-hub" />;
}
