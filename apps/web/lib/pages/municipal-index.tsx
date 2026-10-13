import { ADJARA_REGION_ID } from "../data/municipal/types";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import type { Locale } from "../i18n/types";
import { getMunicipalPresentation, municipalUpdatedNote } from "./municipal-presentation.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Metadata } from "next";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import {
  buildIndexKpis,
  buildCountryListRow,
  buildMunicipalListRows,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
  MUNICIPAL_PER_RESIDENT_YEAR,
} from "../explorer/municipalData";
import { formatPerResidentGel } from "../explorer/format";
import { buildMunicipalityMapModel } from "../explorer/municipalityMapData";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";
import { MUNICIPALITY_ROUTES } from "../explorer/municipalityRoutes";
import { REGION_GENITIVE_KA } from "../explorer/municipalLabels";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { clientPresentation } from "../i18n/presentation.server";

export async function municipalIndexMetadata(locale: Locale): Promise<Metadata> {
  const data = await loadServedMunicipalData();
  const { totalFacts } = data;
  const presentation = await getMunicipalPresentation(data, locale);
  const { messages } = presentation;
  const { firstYear, lastYear } = coverageFromYears(totalFacts);
  return fiscalMetadata({ locale,
    title: message(messages, "municipal.metaIndexTitle", { first: firstYear, last: lastYear }),
    description: message(messages, "municipal.metaIndexDescription", { first: firstYear, last: lastYear }),
    path: "/explorer/municipalities",
  });
}

export async function renderMunicipalIndex(locale: Locale) {
  const data = await loadServedMunicipalData();
  const { municipalities, regions, totalFacts, populationFacts, functionFacts, countryTotalFacts, countryFunctionFacts, functions, adjaraBudgetAdjustments } = data;
  const presentation = await getMunicipalPresentation(data, locale);
  const { messages } = presentation;
  const { sourceDocuments } = await loadServedLandingData();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const comparisonYear = MUNICIPAL_PER_RESIDENT_YEAR;
  if (!years.includes(comparisonYear)) {
    throw new Error(`Municipal budget facts do not include comparison year ${comparisonYear}`);
  }
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));

  const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, populationFacts, adjaraBudgetAdjustments, year: comparisonYear });
  const map = buildMunicipalityMapModel({
    municipalities,
    municipalityRows: list.municipalities,
  });

  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(
    sourceDocuments,
    functionFacts,
    [...totalFacts, ...countryTotalFacts],
  );
  const subsetDescription = message(messages, "municipal.metaIndexDescription", { first: firstYear, last: latestYear });
  const subsets = [
    { path: "/explorer/municipalities/georgia" as const, name: message(messages, "municipal.countryDatasetName") },
    ...MUNICIPALITY_ROUTES.map(({ code, slug }) => ({
      path: `/explorer/municipalities/${slug}` as const,
      name: message(messages, "municipal.municipalityDatasetName", {
        name: publicLabel(locale, code, municipalities.find((row) => row.code === code)!.nameKa, presentation.englishLabels),
      }),
    })),
    ...regions.map((region) => ({
      path: `/explorer/municipalities/region/${region.id.replace("region.", "")}` as const,
      // Named as each region page names itself: Adjara's figure includes the republican budget.
      name: message(messages, region.id === ADJARA_REGION_ID ? "municipal.adjaraDatasetName" : "municipal.regionDatasetName", {
        name: publicLabel(locale, region.id, REGION_GENITIVE_KA[region.id] ?? region.kaLabel, presentation.englishLabels),
      }),
    })),
  ];

  return (
    <ExplorerPage testId="explorer-shell">
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          datasetId: "municipal-expenditure",
          sameAsPath: "/methodology/municipalities",
          // This page is the parent of every municipal entity dataset: the
          // closed set of 64 municipalities, 11 region roll-ups and the one
          // Georgia aggregate, each of which points back with isPartOf.
          hasParts: subsets.map((subset) => ({ ...subset, description: `${subset.name}. ${subsetDescription}` })),
          origin: resolveSiteUrl(),
          path: "/explorer/municipalities",
          name: message(messages, "municipal.indexDatasetName"),
          description: message(messages, "municipal.metaIndexDescription", { first: firstYear, last: latestYear }),
          firstYear,
          lastYear: latestYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: message(messages, "municipal.georgia"),
          downloadPath: "/downloads/data/municipal-expenditure.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) }, { name: message(messages, "common.municipalities"), path: pageHref("/explorer/municipalities", locale) }]} />
      <PageHeader
        locale={locale}
        messages={presentation.messages}
        crumbs={[
          { label: message(messages, "common.home"), href: pageHref("/", locale) },
          { label: message(messages, "common.data") },
          { label: message(messages, "common.budget"), href: pageHref("/explorer", locale) },
          { label: message(messages, "common.municipalities") },
        ]}
        coverage={coverageLabel(messages, locale, firstYear, latestYear, lastUpdatedAt || undefined)}
      />
      <h1 className="mt-[34px] mb-2.5 max-w-[640px] font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[36px]">
        {message(messages, "municipal.indexTitle")}
      </h1>
      <I18nProvider {...clientPresentation(presentation)}>
      <MunicipalitiesIndex
        viewBox={map.viewBox}
        shapes={map.shapes}
        markers={map.markers}
        occupiedAreas={map.occupiedAreas}
        touchTargets={map.touchTargets}
        legendMin={formatPerResidentGel(map.legendMinPerResidentGel, locale)}
        legendMax={formatPerResidentGel(map.legendMaxPerResidentGel, locale)}
        municipalities={list.municipalities}
        regions={list.regions}
        country={buildCountryListRow(countryTotalFacts, comparisonYear)}
        sourceNote={message(messages, "municipal.indexSource", { year: comparisonYear, municipalities: municipalities.length, budgets: MUNICIPAL_COUNTRY_BUDGET_COUNT }) + municipalUpdatedNote(messages, locale, lastUpdatedAt)}
        kpis={buildIndexKpis({
          municipalities,
          totalFacts,
          populationFacts,
          countryTotalFacts,
          countryFunctionFacts,
          functions,
          firstYear,
          comparisonYear,
          latestYear,
        }, presentation)}
      />
      </I18nProvider>
    </ExplorerPage>
  );
}
