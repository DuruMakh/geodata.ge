import { loadServedDemographyData } from "../data/demography/importDemography";
import { buildDemographyHubCards } from "../explorer/demographyHubCards";
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
    title: `${message(p.messages, "demography.title")} | Fiscal.ge`,
    description: message(p.messages, "demography.hubDescription"),
  });
}

export async function renderDemographyPage(locale: Locale) {
  const [{ facts }, p] = await Promise.all([
    loadServedDemographyData(),
    getPresentation(locale, ["demography", "common"], []),
  ]);
  const title = message(p.messages, "demography.title");
  return (
    <TopicHub locale={locale} presentation={p} title={title} summary={message(p.messages, "demography.hubLead")} path={DEMOGRAPHY_HUB_PATH} coverage="" cards={buildDemographyHubCards(facts, p)} testId="demography-hub" />
  );
}
