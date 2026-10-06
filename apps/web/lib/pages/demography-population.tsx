import path from "node:path";
import { PopulationExplorer } from "../../components/demography/population-explorer";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadDensityRows } from "../data/demography/densityRows";
import { loadServedDemographyData } from "../data/demography/importDemography";
import { SERIES } from "../data/demography/series";
import { loadServedMunicipalData } from "../data/servedData";
import { projectDemographyObservation } from "../explorer/clientData";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, buildDemographyPlaces } from "../explorer/demographyAreas";
import { buildPopulationMapModels } from "../explorer/demographyPopulationMaps";
import { DEMOGRAPHY_HUB_PATH } from "../explorer/demographyRoutes";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale, TemplateValues } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";

const POPULATION_PATH = "/explorer/demography/population";

export async function demographyPopulationPageMetadata(locale: Locale) {
  const p = await getPresentation(locale, ["demography"], []);
  return fiscalMetadata({
    locale,
    path: POPULATION_PATH,
    title: `${message(p.messages, "demography.populationMetaTitle")} | Fiscal.ge`,
    description: message(p.messages, "demography.populationDescription"),
  });
}

export async function renderDemographyPopulationPage(locale: Locale) {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [{ facts }, municipal, manifest, catalogue, georgian] = await Promise.all([
    loadServedDemographyData(),
    loadServedMunicipalData(),
    loadReviewedSourceManifest(repositoryRoot, "demography"),
    loadEnglishCatalogue(repositoryRoot),
    getMessages("ka", ["demography"]),
  ]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  // `municipal` is for the municipality map's own legend line (`municipal.cities`).
  const presentation = await getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook", "municipal"], ids);
  const t = (key: string, values?: TemplateValues) => message(presentation.messages, `demography.${key}`, values);
  const places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: message(georgian, "demography.georgia"),
  });
  const maps = buildPopulationMapModels({
    facts,
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    densityUnit: t("densityUnit"),
  });
  // The density note names Tbilisi's area as the reviewed mapping records it, not as a typed number.
  const densityRows = await loadDensityRows(repositoryRoot, municipal.regions.map((region) => region.id));
  const tbilisiArea = densityRows.areaOf(TBILISI_PLACE_ID).toFixed(2);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  const sources = manifest.map((source) => {
    const translated = publicSources.find((candidate) => candidate.source_id === source.source_id)!;
    return {
      sourceId: source.source_id,
      years: source.years,
      title: translated.title,
      organization: translated.publisher,
      downloadHref: source.downloadHref,
      retrievedAt: source.retrieved_at,
    };
  });
  const years = facts.filter((fact) => fact.seriesId === SERIES.populationTotal).map((fact) => fact.year);
  const title = t("populationTitle");
  const crumbs = [
    { label: message(presentation.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(presentation.messages, "common.data") },
    { label: t("title"), href: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref(DEMOGRAPHY_HUB_PATH, locale) },
        { name: title, path: pageHref(POPULATION_PATH, locale) },
      ]} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader crumbs={crumbs} coverage={t("coverage", { first: Math.min(...years), last: Math.max(...years) })} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] text-[13px] text-[var(--body)]">{t("unitLine")}</p>
        <PopulationExplorer
          facts={facts.map(projectDemographyObservation)}
          places={places}
          maps={maps}
          tbilisiArea={tbilisiArea}
          sources={sources}
          siteOrigin={resolveSiteUrl()}
        />
      </ExplorerPage>
    </I18nProvider>
  );
}
