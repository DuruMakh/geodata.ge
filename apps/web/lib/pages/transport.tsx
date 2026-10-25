import { TransportExplorer } from "../../components/transport/transport-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedTransportData, toClientTransportFact } from "../data/transport/importTransport";
import { TRANSPORT_SECTIONS, transportCoverage, transportTopicSeries, type TransportTopicId } from "../explorer/transport";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { loadTransportWorkbookSources } from "./transport-shared";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

export async function transportPageMetadata(locale: Locale, section: TransportTopicId) {
  const messages = await getMessages(locale, ["transport"]);
  return fiscalMetadata({ locale, path: TRANSPORT_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `transport.page.${section}.metaTitle`), description: message(messages, `transport.page.${section}.summary`) });
}

/**
 * Display names for every series a topic page can show: vehicle types, fuels and age bands, transport modes, or what
 * carried passengers and goods. Names carry no prefix: the heading they sit under names their measure and unit.
 */
function transportLabels(presentation: Presentation, section: TransportTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `transport.${key}`);
  return Object.fromEntries(transportTopicSeries(section).map(({ id }) => {
    const [, measure, group] = id.split(".");
    if (measure === "fleet") {
      const [, kind, part] = /^[a-z]+_(fuel|age)_(.+)$/.exec(group) ?? [];
      return [id, kind ? t(`series.${kind}.${part}`) : t(`series.type.${group}`)];
    }
    if (measure === "passengers" || measure === "freight_tonnes") return [id, t(`series.carried.${measure === "freight_tonnes" && group === "airports" ? "airports_freight" : group}`)];
    return [id, t(`series.mode.${group}`)];
  }));
}

export async function renderTransportPage(locale: Locale, section: TransportTopicId) {
  const [data, presentation, sources] = await Promise.all([
    loadServedTransportData(), getPresentation(locale, ["transport", "format", "main", "workbook"], []), loadTransportWorkbookSources(locale),
  ]);
  // Each page receives only the observations its list can show.
  const ids = new Set<string>(transportTopicSeries(section).map(series => series.id));
  const facts = data.facts.map(toClientTransportFact).filter(f => ids.has(f.indicatorId));
  const { min: firstYear, max: lastYear } = transportCoverage(section, facts);
  const href = TRANSPORT_SECTIONS.find(item => item.id === section)!.href;
  const labels = transportLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `transport.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: t("title"), href: pageHref(topicSection("transport").href, locale) }, { label: title }];
  // The measures the page shows, by their headings.
  const measures = [...new Set(transportTopicSeries(section).map(({ heading }) => t(`heading.${heading}`)))];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({ locale, origin, path: href, datasetId: "transport", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(presentation.messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: t("title"), path: pageHref(topicSection("transport").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <TransportExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
