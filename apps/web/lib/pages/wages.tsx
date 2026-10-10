import path from "node:path";
import { notFound } from "next/navigation";
import { WagesExplorer, WagesRegionsIndex } from "../../components/wages/wages-explorer";
import { BudgetHub } from "../../components/hub/budget-hub";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedWagesData, toClientWagesFact } from "../data/wages/importWages";
import { WAGES_GROUPS, WAGES_REGIONS, WAGES_SECTORS, type ClientWagesFact } from "../data/wages/types";
import { ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { WAGES_SECTIONS, wagesCoverage, wagesRegionHref, wagesViews, type WagesSectionId } from "../explorer/wages";
import { buildWagesRegionMapModel } from "../explorer/wagesRegionMap";
import { buildWagesHubCards } from "../explorer/wagesHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";

const LABEL_IDS = [...WAGES_SECTORS, ...WAGES_REGIONS];

export async function wagesHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["wages"]);
  return fiscalMetadata({ locale, path: "/explorer/wages", title: message(messages, "wages.metaTitle"), description: message(messages, "wages.metaDescription") });
}

export async function renderWagesHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedWagesData(), getPresentation(locale, ["wages", "common"], [])]);
  const title = message(presentation.messages, "wages.title"), years = facts.map(f => f.year);
  return <I18nProvider {...presentation}>
    <BreadcrumbJsonLd items={[{ name: message(presentation.messages, "common.home"), path: pageHref("/", locale) }, { name: title, path: pageHref("/explorer/wages", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={[{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: title }]} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} />
      <ExplorerHeading>{title}</ExplorerHeading>
      <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{message(presentation.messages, "wages.hubSummary")}</p>
      <BudgetHub cards={buildWagesHubCards(facts.map(toClientWagesFact), presentation)} locale={locale} testId="wages-hub" />
    </ExplorerPage>
  </I18nProvider>;
}

export async function wagesPageMetadata(locale: Locale, section: WagesSectionId) {
  const messages = await getMessages(locale, ["wages"]);
  return fiscalMetadata({ locale, path: WAGES_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `wages.page.${section}.title`), description: message(messages, `wages.page.${section}.summary`) });
}

/** Display names for every series id a wages page can show, in the page's language. */
function wagesLabels(presentation: Presentation): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `wages.${key}`);
  const labels: Record<string, string> = { average: t("series.average"), median: t("series.median"), total: t("series.total") };
  for (const dimension of ["sex", "ownership", "business_sector"] as const) for (const id of WAGES_GROUPS[dimension]) labels[id] = t(`group.${id}`);
  for (const sector of ECONOMIC_SECTORS.filter(item => (WAGES_SECTORS as readonly string[]).includes(item.id))) labels[sector.id] = publicLabel(presentation.locale, sector.id, sector.labelKa, presentation.englishLabels);
  for (const region of REGIONAL_ECONOMY_REGIONS.filter(item => (WAGES_REGIONS as readonly string[]).includes(item.id))) labels[region.id] = publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels);
  return labels;
}

export const wagesRegionStaticParams = () => WAGES_REGIONS.map(id => ({ id: id.replace(/^region\./, "") }));
function regionForSlug(slug: string) {
  const id = `region.${slug}`;
  if (!(WAGES_REGIONS as readonly string[]).includes(id)) notFound();
  return REGIONAL_ECONOMY_REGIONS.find(region => region.id === id)!;
}
export async function wagesRegionPageMetadata(slug: string, locale: Locale) {
  const region = regionForSlug(slug), presentation = await getPresentation(locale, ["wages"], [region.id]);
  const name = publicLabel(locale, region.id, region.kaLabel, presentation.englishLabels);
  return fiscalMetadata({ locale, path: wagesRegionHref(region.id), title: message(presentation.messages, "wages.regionTitle", { region: name }), description: message(presentation.messages, "wages.regionSummary", { region: name }) });
}
export const renderWagesRegionPage = (slug: string, locale: Locale) => renderWagesPage(locale, "regions", regionForSlug(slug).id);

export async function renderWagesPage(locale: Locale, section: WagesSectionId, regionId?: string) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedWagesData(), getPresentation(locale, ["wages", "regionalEconomies", "common", "controls", "format", "main", "workbook"], LABEL_IDS),
    loadReviewedSourceManifest(root, "wages"), loadEnglishCatalogue(root),
  ]);
  const allFacts = data.facts.map(toClientWagesFact);
  // Each page receives only the observations its views can show.
  const dimensions = { overview: ["national", "ownership", "sex"], industries: ["national", "sex", "ownership", "business_sector"], regions: ["national", "region"] }[section];
  const facts = allFacts.filter(f => dimensions.includes(f.dimension) && (section === "industries" || f.sectorId === "total" && (section === "overview" || f.indicatorId === "average_monthly_nominal_earnings")));
  // The Regions index is the map and list; a region page serves its own region beside Georgia.
  if (section === "regions" && !regionId) return renderWagesRegionsIndex(locale, presentation, facts, data.facts.map(f => f.lastReviewedAt).sort().at(-1)!);
  if (regionId) facts.splice(0, facts.length, ...facts.filter(f => f.dimension !== "region" || f.groupId === regionId));
  const years = [...new Set(wagesViews(section).flatMap(view => wagesCoverage(section, view, facts).years))];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const href = regionId ? wagesRegionHref(regionId) : WAGES_SECTIONS.find(item => item.id === section)!.href;
  const labels = wagesLabels(presentation), regionName = regionId ? labels[regionId] : "";
  // Beside a region, the national line is named as Georgia's.
  if (regionId) labels.average = message(presentation.messages, "wages.series.georgiaAverage");
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  const sources = manifest.filter(source => source.media_type.includes("spreadsheet")).map(source => {
    const translated = publicSources.find(row => row.source_id === source.source_id)!;
    return { sourceId: source.source_id, years: source.years, title: translated.title, organization: translated.publisher, downloadHref: source.downloadHref, retrievedAt: source.retrieved_at };
  });
  const t = (key: string) => message(presentation.messages, `wages.${key}`);
  const title = regionId ? message(presentation.messages, "wages.regionTitle", { region: regionName }) : t(`page.${section}.title`);
  const description = regionId ? message(presentation.messages, "wages.regionSummary", { region: regionName }) : t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref("/explorer/wages", locale) }, ...(regionId ? [{ label: t("page.regions.title"), href: pageHref("/explorer/wages/regions", locale) }] : []), { label: regionId ? regionName : title }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}${href}#dataset`, name: title, description, url: `${origin}${pageHref(href, locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: regionId ? regionName : locale === "ka" ? "საქართველო" : "Georgia" },
      creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` },
      variableMeasured: [...new Set(facts.map(f => f.indicatorId))].map(id => t(id === "median_monthly_earnings" ? "series.median" : "series.average")),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref("/explorer/wages", locale) }, ...(regionId ? [{ name: t("page.regions.title"), path: pageHref("/explorer/wages/regions", locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <WagesExplorer key={regionId ?? section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} regionId={regionId} regions={regionId ? REGIONAL_ECONOMY_REGIONS : undefined} />
    </ExplorerPage>
  </I18nProvider>;
}

function renderWagesRegionsIndex(locale: Locale, presentation: Presentation, facts: readonly ClientWagesFact[], lastReviewedAt: string) {
  const t = (key: string) => message(presentation.messages, `wages.${key}`), title = t("page.regions.title");
  const regionMap = buildWagesRegionMapModel(facts);
  const national = facts.filter(f => f.dimension === "national" && f.value !== null).sort((a, b) => a.year - b.year).at(-1)!;
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref("/explorer/wages", locale) }, { label: title }];
  return <I18nProvider {...presentation}>
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref("/explorer/wages", locale) }, { name: title, path: pageHref("/explorer/wages/regions", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, regionMap.firstYear, regionMap.year, lastReviewedAt)} />
      <WagesRegionsIndex regionMap={regionMap} national={{ year: national.year, value: national.value! }} />
    </ExplorerPage>
  </I18nProvider>;
}
