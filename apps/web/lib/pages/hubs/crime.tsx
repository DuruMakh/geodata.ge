import { loadServedCrimeData, toClientCrimeFact } from "../../data/crime/importCrime";
import { CRIME_HUB_PATH } from "../../explorer/crime";
import { buildCrimeHubCards } from "../../explorer/crimeHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function crimeHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["crime"]);
  return fiscalMetadata({ locale, path: CRIME_HUB_PATH, title: message(messages, "crime.metaTitle"), description: message(messages, "crime.metaDescription") });
}

export async function renderCrimeHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedCrimeData(), getPresentation(locale, ["crime"], [])]);
  const title = message(presentation.messages, "crime.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "crime.hubSummary")} path={CRIME_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildCrimeHubCards(facts.map(toClientCrimeFact), presentation)} testId="crime-hub" />;
}
