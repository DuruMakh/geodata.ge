import { loadServedScienceCultureData, toClientScienceCultureFact } from "../../data/scienceCulture/importScienceCulture";
import { coverageLabel } from "../../explorer/coverageLabel";
import { SCIENCE_CULTURE_HUB_PATH } from "../../explorer/scienceCulture";
import { buildScienceCultureHubCards } from "../../explorer/scienceCultureHubCards";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function scienceCultureHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["scienceCulture"]);
  return fiscalMetadata({ locale, path: SCIENCE_CULTURE_HUB_PATH, title: message(messages, "scienceCulture.metaTitle"), description: message(messages, "scienceCulture.metaDescription") });
}

/** The hub: one card per page, Research, Patents, Museums and Theatres, each from served facts. */
export async function renderScienceCultureHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedScienceCultureData(), getPresentation(locale, ["scienceCulture"], [])]);
  const title = message(presentation.messages, "scienceCulture.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "scienceCulture.hubSummary")} path={SCIENCE_CULTURE_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildScienceCultureHubCards(facts.map(toClientScienceCultureFact), presentation)} testId="science-culture-hub" />;
}
