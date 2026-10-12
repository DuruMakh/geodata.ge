import { BudgetHub } from "../../components/hub/budget-hub";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { PageHeader } from "../../components/shell/page-header";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedHouseholdData, toClientHouseholdFact } from "../data/household/importHousehold";
import { loadServedPovertyData, toClientPovertyFact } from "../data/poverty/importPoverty";
import { buildHouseholdHubCards } from "../explorer/householdHubCards";
import { buildPovertyHubCards } from "../explorer/povertyHubCards";
import { LIVING_STANDARDS_HUB_PATH } from "../explorer/livingStandards";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";

export async function livingStandardsHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["household"]);
  return fiscalMetadata({ locale, path: LIVING_STANDARDS_HUB_PATH, title: message(messages, "household.hub.metaTitle"), description: message(messages, "household.hub.metaDescription") });
}

export async function renderLivingStandardsHub(locale: Locale) {
  const [household, poverty, presentation] = await Promise.all([loadServedHouseholdData(), loadServedPovertyData(), getPresentation(locale, ["household", "poverty", "common"], [])]);
  const title = message(presentation.messages, "household.hub.title");
  const years = [...household.facts, ...poverty.facts].map(f => f.year);
  const lastReviewedAt = [...household.facts, ...poverty.facts].map(f => f.lastReviewedAt).sort().at(-1);
  // Income and Spending come first, then Poverty and Inequality; the cards are numbered across the hub.
  const cards = [...buildHouseholdHubCards(household.facts.map(toClientHouseholdFact), presentation), ...buildPovertyHubCards(poverty.facts.map(toClientPovertyFact), presentation)]
    .map((card, index) => ({ ...card, index: String(index + 1).padStart(2, "0") }));
  return <I18nProvider {...presentation}>
    <BreadcrumbJsonLd items={[{ name: message(presentation.messages, "common.home"), path: pageHref("/", locale) }, { name: title, path: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={[{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: title }]} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), lastReviewedAt)} />
      <ExplorerHeading>{title}</ExplorerHeading>
      <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{message(presentation.messages, "household.hub.summary")}</p>
      <BudgetHub cards={cards} locale={locale} testId="living-standards-hub" />
    </ExplorerPage>
  </I18nProvider>;
}
