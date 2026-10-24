import { TaxBreaksRefundsExplorer, type TaxBreaksRefundsExplorerProps } from "../../components/tax-breaks-refunds/tax-breaks-refunds-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedTaxBreaksRefundsData, toClientTaxBreaksRefundsFact } from "../data/taxBreaksRefunds/importTaxBreaksRefunds";
import { TAX_BREAKS_REFUNDS_INDICATORS } from "../data/taxBreaksRefunds/types";
import { loadServedExplorerData } from "../data/servedData";
import { projectGdpFact } from "../explorer/clientData";
import { TAX_BREAKS_REFUNDS_PATH, type TaxBreaksRefundsHeading } from "../explorer/taxBreaksRefunds";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadGdpWorkbookSources, loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

const HEADINGS: readonly TaxBreaksRefundsHeading[] = ["breaks", "vat", "income", "refunds"];

export async function taxBreaksRefundsPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["taxBreaksRefunds"]);
  return fiscalMetadata({ locale, path: TAX_BREAKS_REFUNDS_PATH, title: message(messages, "taxBreaksRefunds.metaTitle"), description: message(messages, "taxBreaksRefunds.metaDescription") });
}

/** The archived Ministry workbook and Treasury chart data (data/methodology/source-archives/tax-breaks-refunds.csv) with their public links, for the Excel Sources sheet. */
export function loadTaxBreaksRefundsWorkbookSources(locale: Locale): Promise<TaxBreaksRefundsExplorerProps["sources"]> {
  return loadSourcedWorkbookSources("tax-breaks-refunds", locale, row => row.media_type.includes("spreadsheet") || row.media_type === "application/xml");
}

export async function renderTaxBreaksRefundsPage(locale: Locale) {
  // The % of GDP view divides by the national GDP the Revenue, Debt and Money pages use, and its Excel cites the same Geostat files.
  const [data, presentation, sources, gdpFacts, gdpSources] = await Promise.all([
    loadServedTaxBreaksRefundsData(), getPresentation(locale, ["taxBreaksRefunds", "format", "main", "workbook"], []), loadTaxBreaksRefundsWorkbookSources(locale),
    loadServedExplorerData().then(explorer => explorer.gdpFacts.map(projectGdpFact)), loadGdpWorkbookSources(locale),
  ]);
  const facts = data.facts.map(toClientTaxBreaksRefundsFact);
  // The workbook cites only the files the observations come from.
  const sourceIds = new Set(facts.map(f => f.sourceId));
  const years = facts.map(f => f.year), firstYear = Math.min(...years), lastYear = Math.max(...years);
  const t = (key: string) => message(presentation.messages, `taxBreaksRefunds.${key}`);
  const labels = Object.fromEntries(TAX_BREAKS_REFUNDS_INDICATORS.map(id => [id, t(`label.${id}`)]));
  const headings = Object.fromEntries(HEADINGS.map(heading => [heading, t(`heading.${heading}`)])) as Record<TaxBreaksRefundsHeading, string>;
  const title = t("title"), description = t("metaDescription");
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const budget = message(presentation.messages, "common.budget");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: budget, href: pageHref("/explorer", locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: TAX_BREAKS_REFUNDS_PATH, datasetId: "tax-breaks-refunds", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      variableMeasured: TAX_BREAKS_REFUNDS_INDICATORS.map(id => labels[id]),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: budget, path: pageHref("/explorer", locale) }, { name: title, path: pageHref(TAX_BREAKS_REFUNDS_PATH, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <TaxBreaksRefundsExplorer facts={facts} labels={labels} headings={headings} sources={sources.filter(source => sourceIds.has(source.sourceId))} gdpFacts={gdpFacts} gdpSources={gdpSources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
