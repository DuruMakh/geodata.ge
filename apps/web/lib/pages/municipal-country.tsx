import { formatDisplayDate } from "../explorer/format";
import type { Locale } from "../i18n/types";
import { getMunicipalPresentation } from "./municipal-presentation.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Metadata } from "next";
import { MunicipalExplorer } from "../../components/municipalities/municipal-explorer";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../data/servedData";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import {
  buildCountryTotalByYear,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
} from "../explorer/municipalData";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../seo/metadata";
import { georgiaDescription } from "../seo/municipalMetadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

const ROUTE = "/explorer/municipalities/georgia";

function buildGeorgiaPageFacts(
  servedMunicipalData: Awaited<ReturnType<typeof loadServedMunicipalData>>,
) {
  const { firstYear, lastYear: latestYear } = coverageFromYears(
    servedMunicipalData.countryTotalFacts,
  );
  return {
    firstYear,
    latestYear,
    latestTotal: servedMunicipalData.countryTotalFacts.find((row) => row.year === latestYear)!,
  };
}

export async function municipalCountryMetadata(locale: Locale): Promise<Metadata> {
  const data = await loadServedMunicipalData();
  const { firstYear, latestYear, latestTotal } = buildGeorgiaPageFacts(data);
  const presentation = await getMunicipalPresentation(data, locale);
  const { messages } = presentation;
  return fiscalMetadata({ locale,
    title: message(messages, "municipal.metaCountryTitle", { first: firstYear, last: latestYear }),
    description: georgiaDescription({
      firstYear,
      latestYear,
      latestTotalGel: latestTotal.publicTotalGel,
      budgetUnitCount: MUNICIPAL_COUNTRY_BUDGET_COUNT,
    }, presentation),
    path: ROUTE,
  });
}

export async function renderMunicipalCountry(locale: Locale) {
  const [servedMunicipalData, landingData, functionalWorkbookSources, workbookSources, adjustmentWorkbookSources] = await Promise.all([
    loadServedMunicipalData(),
    loadServedLandingData(),
    loadWorkbookSources("municipalities", "municipal-functional", locale),
    loadWorkbookSources("municipalities", "municipal-total", locale),
    loadWorkbookSources("revenue", "revenue", locale),
  ]);
  const presentation = await getMunicipalPresentation(servedMunicipalData, locale);
  const { messages } = presentation;
  const { municipalities, regions, functions, totalFacts, countryFunctionFacts, countryTotalFacts, adjaraBudgetAdjustments } =
    servedMunicipalData;
  const { sourceDocuments } = landingData;
  const { firstYear, latestYear, latestTotal } = buildGeorgiaPageFacts(servedMunicipalData);
  const entityWorkbookSources = scopeMunicipalWorkbookSources(
    workbookSources,
    {
      municipalityCodes: municipalities.map((municipality) => municipality.code),
      includeAdjaraRepublic: true,
      includeAggregateOnlyCodes: true,
    },
  );

  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const pickerGroups = buildPickerGroups({ municipalities, regionLabels, totalFacts, adjaraBudgetAdjustments, year: latestYear });
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);
  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(sourceDocuments, countryFunctionFacts, countryTotalFacts);
  const description = georgiaDescription({
    firstYear,
    latestYear,
    latestTotalGel: latestTotal.publicTotalGel,
    budgetUnitCount: MUNICIPAL_COUNTRY_BUDGET_COUNT,
  }, presentation);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <JsonLd
        data={explorerDatasetJsonLd({ locale,
          origin: resolveSiteUrl(),
          path: ROUTE,
          name: message(messages, "municipal.countryDatasetName"),
          description,
          firstYear,
          lastYear: latestYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: message(messages, "municipal.georgia"),
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: message(messages, "common.home"), path: pageHref("/", locale) }, { name: message(messages, "common.budget"), path: pageHref("/explorer", locale) }, { name: message(messages, "common.municipalities"), path: pageHref("/explorer/municipalities", locale) }, { name: message(messages, "municipal.georgia"), path: pageHref(ROUTE, locale) }]} />
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: message(messages, "common.home"), href: pageHref("/", locale) },
            { label: message(messages, "common.data") },
            { label: message(messages, "common.budget"), href: pageHref("/explorer", locale) },
            { label: message(messages, "common.municipalities"), href: pageHref("/explorer/municipalities", locale) },
            { label: message(messages, "municipal.georgia") },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? message(messages, "municipal.updated", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt }) : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          presentation={presentation}
          title={message(messages, "municipal.howCountrySpent")}
          triggerLabel={message(messages, "municipal.countryTrigger")}
          entityId={MUNICIPAL_COUNTRY_ID}
          metaLine={message(messages, "municipal.countryMeta", { count: MUNICIPAL_COUNTRY_BUDGET_COUNT, first: firstYear, last: latestYear })}
          functions={functions}
          functionFacts={countryFunctionFacts}
          totalFacts={countryTotalFacts}
          metrics={{ kind: "country", budgetCount: MUNICIPAL_COUNTRY_BUDGET_COUNT }}
          workbookBasename="municipalities-georgia"
          workbookSources={entityWorkbookSources}
          functionalWorkbookSources={functionalWorkbookSources}
          supplementalWorkbookSources={adjustmentWorkbookSources}
          siteOrigin={resolveSiteUrl()}
          pickerCountry={{
            id: MUNICIPAL_COUNTRY_ID,
            nameKa: "საქართველო",
            valueGel: nationalTotalByYear[latestYear] ?? 0,
            budgetCount: MUNICIPAL_COUNTRY_BUDGET_COUNT,
          }}
          pickerGroups={pickerGroups}
          sourceNote={message(messages, "municipal.countrySource", { count: MUNICIPAL_COUNTRY_BUDGET_COUNT }) + (lastUpdatedAt ? message(messages, "municipal.updatedNote", { date: locale === "en" ? formatDisplayDate(lastUpdatedAt, locale) : lastUpdatedAt }) : "")}
        />
      </div>
    </main>
  );
}
