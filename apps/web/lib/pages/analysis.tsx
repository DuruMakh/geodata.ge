import type { Metadata } from "next";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { YearReviewPage } from "../../components/year-review/year-review-page";
import { coverageLabel } from "../explorer/coverageLabel";
import { message } from "../i18n/messages";
import { clientPresentation } from "../i18n/presentation.server";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { ALL_DATA_PATH, navGroup } from "../navigation/navTree";
import { fiscalMetadata } from "../seo/metadata";
import { loadYearReviewData } from "../yearReview/buildYearReviewData";

const PATH = "/explorer/analysis";

/** The title names the year the page opens on: the last year with actual spending, from the data. */
export async function analysisPageMetadata(locale: Locale): Promise<Metadata> {
  const { data, presentation: { messages } } = await loadYearReviewData(locale);
  return fiscalMetadata({ locale,
    title: message(messages, "yearReview.metaTitle", { y: data.budget.defaultYear }),
    description: message(messages, "yearReview.metaDescription"),
    path: PATH,
  });
}

/** /explorer/analysis, Year in review (spec 2026-10-30-year-in-review-design): one year of public finances from every angle. */
export async function renderAnalysisPage(locale: Locale) {
  const { data, presentation } = await loadYearReviewData(locale);
  const { messages } = presentation;
  const { years } = data.budget;
  const crumbs = [
    { label: message(messages, "common.home"), href: "/" },
    { label: message(messages, "common.data"), href: ALL_DATA_PATH },
    { label: message(messages, "common.budget"), href: navGroup("budget").href },
    { label: message(messages, "common.analysis") },
  ];
  return (
    <>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0]!.label, path: pageHref("/", locale) },
        { name: crumbs[1]!.label, path: pageHref(ALL_DATA_PATH, locale) },
        { name: crumbs[2]!.label, path: pageHref(navGroup("budget").href, locale) },
        { name: crumbs[3]!.label, path: pageHref(PATH, locale) },
      ]} />
      <ExplorerPage testId="explorer-shell" repeatDesktopBottomPadding>
        <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, years[0], years.at(-1), data.updatedAt || undefined)} />
        <ExplorerHeading>{message(messages, "yearReview.title")}</ExplorerHeading>
        <p data-testid="year-review-line" className="text-[15px] leading-[1.55] text-[var(--body)]">{message(messages, "yearReview.line")}</p>
        <YearReviewPage data={data} presentation={clientPresentation(presentation)} />
      </ExplorerPage>
    </>
  );
}
