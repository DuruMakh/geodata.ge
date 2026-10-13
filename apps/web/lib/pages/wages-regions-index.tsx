import { WagesRegionsIndex } from "../../components/wages/wages-regions-index";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { buildWagesRegionMapModel } from "../explorer/wagesRegionMap";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadWagesPage } from "./wages-shared";
import { clientPresentation } from "../i18n/presentation.server";

/** The Regions index: the map and ranked list; each region opens its own page (wages.tsx). */
export async function renderWagesRegionsIndexPage(locale: Locale) {
  const { data, presentation, facts } = await loadWagesPage(locale, "regions");
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!;
  const t = (key: string) => message(presentation.messages, `wages.${key}`), title = t("page.regions.title");
  const regionMap = buildWagesRegionMapModel(facts);
  const national = facts.filter(f => f.dimension === "national" && f.value !== null).sort((a, b) => a.year - b.year).at(-1)!;
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref("/explorer/wages", locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref("/explorer/wages", locale) }, { name: title, path: pageHref("/explorer/wages/regions", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, regionMap.firstYear, regionMap.year, lastReviewedAt)} />
      <WagesRegionsIndex regionMap={regionMap} national={{ year: national.year, value: national.value! }} />
    </ExplorerPage>
  </I18nProvider>;
}
