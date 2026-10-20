import { UnemploymentLegacyLink } from "../../../components/unemployment/unemployment-legacy-link";
import { loadServedUnemploymentData } from "../../data/unemployment/importUnemployment";
import { loadServedLabourData, toClientLabourFact } from "../../data/labour/importLabour";
import { buildLabourHubCards } from "../../explorer/labourHubCards";
import { buildUnemploymentHubCards } from "../../explorer/unemploymentHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function unemploymentHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["unemployment"]);
  return fiscalMetadata({ locale, path: "/explorer/unemployment", title: message(messages, "unemployment.metaTitle"), description: message(messages, "unemployment.metaDescription") });
}

export async function renderUnemploymentHub(locale: Locale) {
  const [{ facts }, { facts: labourFacts }, presentation] = await Promise.all([loadServedUnemploymentData(), loadServedLabourData(), getPresentation(locale, ["unemployment", "labour"], [])]);
  const title = message(presentation.messages, "unemployment.title");
  const years = [...facts, ...labourFacts].map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "unemployment.hubSummary")} path={"/explorer/unemployment"} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), [...facts, ...labourFacts].map(f => f.lastReviewedAt).sort().at(-1))} cards={[...buildUnemploymentHubCards(facts, presentation), ...buildLabourHubCards(labourFacts.map(toClientLabourFact), presentation, 5)]} testId="unemployment-hub" after={<UnemploymentLegacyLink locale={locale} />} />;
}
