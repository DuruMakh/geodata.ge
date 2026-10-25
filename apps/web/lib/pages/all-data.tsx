import { AllDataIndex } from "../../components/explorer-groups/all-data-index";
import { ExplorerSearch } from "../../components/explorer-groups/explorer-search";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { LegacyHashRedirect } from "../../components/shell/legacy-hash-redirect";
import { PageHeader } from "../../components/shell/page-header";
import { buildSearchPages, buildShortcuts, searchMessages } from "../explorer/allDataIndex";
import { updatedDate } from "../explorer/coverageLabel";
import { getCommonMessages } from "../i18n/common.server";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, Messages } from "../i18n/types";
import { ALL_DATA_PATH, NAV_TREE, PAGE_COUNT } from "../navigation/navTree";
import { fiscalMetadata } from "../seo/metadata";
import { loadCardSpreads } from "./group";
import { loadTopicHubs } from "./topicHubs.server";

/** `common` and `allData` in one language. */
async function allDataMessages(locale: Locale): Promise<Messages> {
  return { ...getCommonMessages(locale), ...await getMessages(locale, ["allData"]) };
}

export async function allDataPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["allData"]);
  return fiscalMetadata({ locale, path: ALL_DATA_PATH, title: message(messages, "allData.metaTitle"), description: message(messages, "allData.metaDescription") });
}

/**
 * All data (spec 2026-10-24-explorer-regroup §6): the search box over every page and place, and every page A to Z below it.
 * Each page's latest value and trend come from its topic hub's card, the figures its group page shows.
 */
export async function renderAllDataPage(locale: Locale) {
  const [hubs, messagesKa, messagesEn] = await Promise.all([loadTopicHubs(locale, NAV_TREE.map((hub) => hub.id)), allDataMessages("ka"), allDataMessages("en")]);
  const messages = locale === "en" ? messagesEn : messagesKa;
  const { spreadOf } = await loadCardSpreads(hubs.flatMap((hub) => hub.cards), locale);
  const pages = buildSearchPages(hubs, messagesKa, messagesEn, spreadOf);
  const shortcuts = buildShortcuts(messagesKa, messagesEn);
  const reviewed = hubs.map((hub) => hub.lastReviewedAt).reduce((latest, date) => (date > latest ? date : latest));
  const home = message(messages, "common.home");
  const data = message(messages, "common.data");

  return (
    <ExplorerPage testId="all-data-page" containerQueries={false}>
      <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: data, path: pageHref(ALL_DATA_PATH, locale) }]} />
      <LegacyHashRedirect />
      <PageHeader
        locale={locale}
        messages={messages}
        crumbs={[{ label: home, href: "/" }, { label: data }]}
        coverage={message(messages, "allData.meta", { pages: PAGE_COUNT, date: updatedDate(reviewed, locale) })}
      />
      <ExplorerHeading>{message(messages, "allData.title")}</ExplorerHeading>
      <p className="max-w-[760px] text-[15px] leading-[1.55] text-[var(--body)]">{message(messages, "allData.line")}</p>
      <I18nProvider locale={locale} messages={searchMessages(messages)}>
        <ExplorerSearch locale={locale} pages={pages} shortcuts={shortcuts}>
          <AllDataIndex locale={locale} messages={messages} pages={pages} />
        </ExplorerSearch>
      </I18nProvider>
    </ExplorerPage>
  );
}
