import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { RegionalEconomiesIndex } from "../../components/regional-economies/regional-economies-index";
import { loadServedMunicipalData } from "../data/servedData";
import {
  loadServedRegionalEconomyData,
  REGIONAL_ECONOMY_REGIONS,
  REGIONAL_ECONOMY_SECTORS,
} from "../data/regionalEconomies/importRegionalEconomies";
import { REGIONAL_GDP_TOTAL, type ServedRegionalEconomyObservation } from "../data/regionalEconomies/types";
import { buildRegionalEconomyMapModel } from "../explorer/regionalEconomyMap";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { coverageLabel, updatedDate } from "../explorer/coverageLabel";

/** The years, counts and review date the regional copy quotes, read from the loaded facts (AGENTS.md UI Contract). */
export function regionalCoverage(facts: readonly ServedRegionalEconomyObservation[], locale: Locale) {
  const years = facts.map((fact) => fact.year);
  const reviewedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1)!;
  return {
    reviewedAt,
    params: {
      firstYear: Math.min(...years),
      lastYear: Math.max(...years),
      regionCount: new Set(facts.map((fact) => fact.regionId)).size,
      sectorCount: new Set(facts.filter((fact) => fact.seriesId !== REGIONAL_GDP_TOTAL).map((fact) => fact.seriesId)).size,
      reviewedDate: updatedDate(reviewedAt, locale),
    },
  };
}

export async function regionalEconomiesPageMetadata(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([
    loadServedRegionalEconomyData(),
    getPresentation(locale, ["regionalEconomies"], []),
  ]);
  const { params } = regionalCoverage(facts, locale);
  return fiscalMetadata({
    locale,
    path: "/explorer/economy/regions",
    title: message(presentation.messages, "regionalEconomies.indexMetaTitle", params),
    description: message(presentation.messages, "regionalEconomies.description", params),
  });
}

export async function renderRegionalEconomiesPage(locale: Locale) {
  const [{ facts }, municipal, presentation] = await Promise.all([
    loadServedRegionalEconomyData(),
    loadServedMunicipalData(),
    getPresentation(
      locale,
      ["regionalEconomies", "format"],
      [...REGIONAL_ECONOMY_REGIONS.map((region) => region.id), ...REGIONAL_ECONOMY_SECTORS.map((sector) => sector.id)],
      REGIONAL_ECONOMY_REGIONS.map((region) => region.id),
    ),
  ]);
  const model = buildRegionalEconomyMapModel({
    facts,
    regions: municipal.regions,
  });
  const title = message(presentation.messages, "regionalEconomies.heading");
  const { reviewedAt, params } = regionalCoverage(facts, locale);
  const description = message(presentation.messages, "regionalEconomies.description", params);
  const crumbs = [
    { label: message(presentation.messages, "common.home"), href: pageHref("/", locale) },
    { label: message(presentation.messages, "common.data") },
    { label: message(presentation.messages, "common.economy"), href: pageHref("/explorer/economy", locale) },
    { label: title },
  ];
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <BreadcrumbJsonLd items={[
        { name: crumbs[0].label, path: pageHref("/", locale) },
        { name: crumbs[2].label, path: pageHref("/explorer/economy", locale) },
        { name: title, path: pageHref("/explorer/economy/regions", locale) },
      ]} />
      <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
        locale,
        datasetId: "regional-economies",
        origin: resolveSiteUrl(),
        path: "/explorer/economy/regions",
        name: title,
        description,
        firstYear: model.firstYear,
        lastYear: model.year,
        dateModified: reviewedAt,
        spatialCoverageName: message(presentation.messages, "regionalEconomies.spatialCoverage"),
        downloadPath: "/downloads/data/regional-economies.csv",
        sameAsPath: "/methodology/regional-economies",
        hasParts: REGIONAL_ECONOMY_REGIONS.map((region) => {
          const slug = region.id.replace(/^region\./, "");
          const name = publicLabel(locale, region.id, region.kaLabel, presentation.englishLabels);
          return {
            path: `/explorer/economy/regions/${slug}` as const,
            name,
            description: message(presentation.messages, "regionalEconomies.detailMetaDescription", {
              ...regionalCoverage(facts.filter((fact) => fact.regionId === region.id), locale).params,
              region: name,
            }),
          };
        }),
      })} />
      <ExplorerPage testId="explorer-shell">
        <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, model.firstYear, model.year, reviewedAt)} />
        <ExplorerHeading>{title}</ExplorerHeading>
        <p className="mb-[30px] max-w-[720px] text-[13px] leading-relaxed text-[var(--body)]">{message(presentation.messages, "regionalEconomies.lead")}</p>
        <RegionalEconomiesIndex model={model} sourceNote={message(presentation.messages, "regionalEconomies.sourceNote", params)} />
      </ExplorerPage>
    </I18nProvider>
  );
}
