import { loadServedDemographyData } from "../data/demography/importDemography";
import { buildDemographyHubCards } from "../explorer/demographyHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { TopicHub } from "./hub";

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
  const [{ facts }, p] = await Promise.all([
    loadServedDemographyData(),
    getPresentation(locale, ["demography"], []),
  ]);
  const title = message(p.messages, "demography.title");
  const years = [...new Set(facts.map((f) => f.year))];
  // The header's coverage label spans the demography facts (U28-06).
  const coverage = coverageLabel(p.messages, locale, Math.min(...years), Math.max(...years), facts.reduce((latest, f) => (f.lastReviewedAt > latest ? f.lastReviewedAt : latest), ""));
  return (
    <TopicHub locale={locale} presentation={p} title={title} summary={message(p.messages, "demography.hubLead")} path={DEMOGRAPHY_HUB_PATH} coverage={coverage} cards={buildDemographyHubCards(facts, p)} testId="demography-hub" />
  );
}
