import { UnemploymentLegacyLink } from "../../../components/unemployment/unemployment-legacy-link";
import { loadServedUnemploymentData } from "../../data/unemployment/importUnemployment";
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
  const [{ facts }, presentation] = await Promise.all([loadServedUnemploymentData(), getPresentation(locale, ["unemployment", "common"], [])]);
  const title = message(presentation.messages, "unemployment.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "unemployment.hubSummary")} path={"/explorer/unemployment"} coverage={coverageLabel(presentation.messages, locale, Math.min(...facts.map(f => f.year)), Math.max(...facts.map(f => f.year)), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildUnemploymentHubCards(facts, presentation)} testId="unemployment-hub" after={<UnemploymentLegacyLink locale={locale} />} />;
}
