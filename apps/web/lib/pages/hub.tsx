import type { ReactNode } from "react";
import type { Locale, Presentation } from "../i18n/types";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { Message } from "../i18n/message";
import { pageHref } from "../i18n/routes";
import { formatDisplayDate } from "../explorer/format";
import { BudgetHub } from "../../components/hub/budget-hub";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { LegacyHashRedirect } from "../../components/shell/legacy-hash-redirect";
import { PageHeader } from "../../components/shell/page-header";
import { SourceNote } from "../../components/ui/editorial";
import { buildHubCards, type HubCardModel } from "../explorer/hubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import { loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { fiscalMetadata } from "../seo/metadata";

export async function hubPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["hub"]);
  return fiscalMetadata({ locale,
  title: message(messages, "hub.metaTitle"),
  description:
    message(messages, "hub.metaDescription"),
  path: "/explorer",
  });
}

export async function renderHubPage(locale: Locale) {
  const presentation = await getPresentation(locale, ["common", "main", "hub"], []);
  const { messages } = presentation;
  const [{ facts, sourceDocuments }, { countryTotalFacts }, { facts: debtFacts }, { facts: balanceFacts }] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadServedGeneralGovernmentBalanceData(),
  ]);
  const municipalTotals = new Map<number, number>();
  for (const row of countryTotalFacts) {
    municipalTotals.set(row.year, row.publicTotalGel);
  }
  const lastUpdatedAt = [
    ...sourceDocuments.map((source) => source.lastReviewedAt),
    ...debtFacts.map((fact) => fact.lastReviewedAt),
    ...balanceFacts.map((fact) => fact.lastReviewedAt),
  ].sort().at(-1) ?? "";
  const cards = buildHubCards(facts, municipalTotals, debtFacts, balanceFacts, presentation);
  const years = Array.from(new Set(facts.map((fact) => fact.year))).sort((a, b) => a - b);
  const coverage = coverageLabel(messages, locale, years[0], years.at(-1), lastUpdatedAt || undefined);

  return (
    <ExplorerPage testId="explorer-shell" containerQueries={false}>
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) }]} />
      <LegacyHashRedirect />
      <PageHeader
        crumbs={[{ label: message(messages, "common.home"), href: pageHref("/", locale) }, { label: message(messages, "common.data") }, { label: message(messages, "common.budget") }]}
        coverage={coverage}
      />
      <h1 className="mt-[22px] mb-2 font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.15] tracking-[-0.01em]">
        {message(messages, "hub.heading")}
      </h1>
      <p
        data-testid="explorer-hub-introduction"
        className="mb-[26px] max-w-[640px] text-[13px] text-[var(--body)]"
      >
        {message(messages, "hub.introduction")}
      </p>
      <BudgetHub cards={cards} locale={locale} />
      <div className="mt-[26px] max-w-[860px]">
        <SourceNote>
          {message(messages, "hub.source")}
          {lastUpdatedAt ? (
            <>
              {" "}<Message messages={messages} id="main.lastUpdated" values={{ date: <span className="font-[family-name:var(--font-numeric)]">{locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt}</span> }} />
            </>
          ) : null}
        </SourceNote>
      </div>
    </ExplorerPage>
  );
}

/**
 * A topic hub (Economy, Inflation, Trade, …): breadcrumb, heading, one summary line and
 * the hub cards. `crumbLabel` names the hub in the breadcrumbs when it differs from the
 * heading (Inflation's). The Budget hub above keeps its own heading and source note.
 */
export function TopicHub({ locale, presentation, title, crumbLabel = title, summary, path, coverage, cards, testId, breadcrumb = true, after }: {
  locale: Locale; presentation: Presentation; title: string; crumbLabel?: string; summary: string; path: `/${string}`;
  coverage: string; cards: HubCardModel[]; testId: string; breadcrumb?: boolean; after?: ReactNode;
}) {
  const home = message(presentation.messages, "common.home");
  return (
    <I18nProvider {...presentation}>
      {breadcrumb ? <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: crumbLabel, path: pageHref(path, locale) }]} /> : null}
      <ExplorerPage containerQueries={false}>
        <PageHeader crumbs={[{ label: home, href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: crumbLabel }]} coverage={coverage} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{summary}</p>
        <BudgetHub cards={cards} locale={locale} testId={testId} />
        {after}
      </ExplorerPage>
    </I18nProvider>
  );
}
