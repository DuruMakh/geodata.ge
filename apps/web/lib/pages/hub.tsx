import type { Locale } from "../i18n/types";
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
