import type { ReactNode } from "react";
import type { Locale, Presentation } from "../i18n/types";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import { BudgetHub } from "../../components/hub/budget-hub";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { LegacyHashRedirect } from "../../components/shell/legacy-hash-redirect";
import { PageHeader } from "../../components/shell/page-header";
import type { HubCardModel } from "../explorer/hubCards";
import { fiscalMetadata } from "../seo/metadata";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "./topicHubs.server";

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
  const [presentation, hub] = await Promise.all([getPresentation(locale, ["main", "hub"], []), TOPIC_HUB_LOADERS.budget(locale)]);
  const { messages } = presentation;
  const { cards } = hub;
  const coverage = topicHubCoverage(messages, locale, hub);

  return (
    <ExplorerPage testId="explorer-shell" containerQueries={false}>
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) }]} />
      <LegacyHashRedirect />
      <PageHeader
        locale={locale}
        messages={messages}
        crumbs={[{ label: message(messages, "common.home"), href: pageHref("/", locale) }, { label: message(messages, "common.data") }, { label: message(messages, "common.budget") }]}
        coverage={coverage}
      />
      <ExplorerHeading>{message(messages, "hub.heading")}</ExplorerHeading>
      <p
        data-testid="explorer-hub-introduction"
        className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]"
      >
        {message(messages, "hub.introduction")}
      </p>
      <BudgetHub cards={cards} locale={locale} />
    </ExplorerPage>
  );
}

/**
 * A topic hub (Economy, Inflation, Trade, …): breadcrumb, heading, one summary line and
 * the hub cards. `crumbLabel` names the hub in the breadcrumbs when it differs from the
 * heading (Inflation's). The Budget hub above keeps its own heading.
 */
export function TopicHub({ locale, presentation, title, crumbLabel = title, summary, path, coverage, cards, testId, breadcrumb = true, after }: {
  locale: Locale; presentation: Presentation; title: string; crumbLabel?: string; summary: string; path: `/${string}`;
  coverage: string; cards: HubCardModel[]; testId: string; breadcrumb?: boolean; after?: ReactNode;
}) {
  const home = message(presentation.messages, "common.home");
  // Rendered on the server, with no client component that reads a page provider: the hub ships no messages (U28-02).
  return (
    <>
      {breadcrumb ? <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: crumbLabel, path: pageHref(path, locale) }]} /> : null}
      <ExplorerPage containerQueries={false}>
        <PageHeader locale={locale} messages={presentation.messages} crumbs={[{ label: home, href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: crumbLabel }]} coverage={coverage} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{summary}</p>
        <BudgetHub cards={cards} locale={locale} testId={testId} />
        {after}
      </ExplorerPage>
    </>
  );
}
