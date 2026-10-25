import { WagesRegionsIndex } from "../../components/wages/wages-regions-index";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { buildWagesRegionMapModel } from "../explorer/wagesRegionMap";
import { wagesPlaceLatest } from "../explorer/wages";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadWagesPage, wagesRegionsDataset } from "./wages-shared";
import { clientPresentation } from "../i18n/presentation.server";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

/** The Regions index: the map and ranked list; each region opens its own page (wages.tsx). */
export async function renderWagesRegionsIndexPage(locale: Locale) {
  const { data, presentation, facts } = await loadWagesPage(locale, "regions");
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!;
  const t = (key: string) => message(presentation.messages, `wages.${key}`), title = t("page.regions.title");
  const regionMap = buildWagesRegionMapModel(facts);
  const national = wagesPlaceLatest(facts);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: t("title"), href: pageHref(topicSection("wages").href, locale) }, { label: title }];
  const parent = wagesRegionsDataset(presentation.messages);
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin: resolveSiteUrl(), path: parent.path, datasetId: "wages", name: parent.name, description: parent.description,
      firstYear: regionMap.firstYear, lastYear: regionMap.year, dateModified: lastReviewedAt, variableMeasured: [t("series.average")],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(presentation.messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: t("title"), path: pageHref(topicSection("wages").path, locale) }, { name: title, path: pageHref("/explorer/wages/regions", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, regionMap.firstYear, regionMap.year, lastReviewedAt)} />
      <WagesRegionsIndex regionMap={regionMap} national={{ year: national.year, value: national.value! }} />
    </ExplorerPage>
  </I18nProvider>;
}
