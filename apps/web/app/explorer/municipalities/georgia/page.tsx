import type { Metadata } from "next";
import { MunicipalExplorer } from "../../../../components/municipalities/municipal-explorer";
import { BreadcrumbJsonLd } from "../../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../../components/seo/json-ld";
import { PageHeader } from "../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../lib/data/servedData";
import { MUNICIPAL_COUNTRY_ID } from "../../../../lib/data/municipal/types";
import {
  buildCountryTotalByYear,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
} from "../../../../lib/explorer/municipalData";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../../../../lib/methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../../../../lib/seo/metadata";
import { georgiaDescriptionKa } from "../../../../lib/seo/municipalMetadata";
import { explorerDatasetJsonLd } from "../../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../../lib/siteUrl";

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

export async function generateMetadata(): Promise<Metadata> {
  const { firstYear, latestYear, latestTotal } = buildGeorgiaPageFacts(
    await loadServedMunicipalData(),
  );
  return fiscalMetadata({
    title: `საქართველოს მუნიციპალური ბიუჯეტების ჯამი ${firstYear}–${latestYear} | Fiscal.ge`,
    description: georgiaDescriptionKa({
      firstYear,
      latestYear,
      latestTotalGel: latestTotal.publicTotalGel,
      budgetUnitCount: MUNICIPAL_COUNTRY_BUDGET_COUNT,
    }),
    path: ROUTE,
  });
}

export default async function GeorgiaMunicipalitiesPage() {
  const [servedMunicipalData, landingData, functionalWorkbookSources, workbookSources, adjustmentWorkbookSources] = await Promise.all([
    loadServedMunicipalData(),
    loadServedLandingData(),
    loadWorkbookSources("municipalities", "municipal-functional"),
    loadWorkbookSources("municipalities", "municipal-total"),
    loadWorkbookSources("revenue", "revenue"),
  ]);
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
  const description = georgiaDescriptionKa({
    firstYear,
    latestYear,
    latestTotalGel: latestTotal.publicTotalGel,
    budgetUnitCount: MUNICIPAL_COUNTRY_BUDGET_COUNT,
  });

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: ROUTE,
          datasetId: "municipal-expenditure",
          partOfPath: "/explorer/municipalities",
          // catalogue.json qualifies gel_per_resident: it exists for municipality
          // and region totals, "not for the country aggregate". This page is that
          // aggregate, so claiming the measure here would be a false claim.
          omitMeasures: ["gel_per_resident"],
          name: "საქართველოს მუნიციპალური ბიუჯეტების ჯამი",
          description,
          firstYear,
          lastYear: latestYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: "საქართველო",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "მუნიციპალიტეტები", path: "/explorer/municipalities" }, { name: "საქართველო", path: ROUTE }]} />
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
            { label: "საქართველო" },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          title="როგორ ხარჯავენ ბიუჯეტს"
          triggerLabel="საქართველოს მუნიციპალიტეტები"
          entityId={MUNICIPAL_COUNTRY_ID}
          metaLine={`${MUNICIPAL_COUNTRY_BUDGET_COUNT} მუნიციპალური საბიუჯეტო ერთეული + აჭარის ა.რ. · ${firstYear}–${latestYear}`}
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
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). საქართველოს ჯამი ${MUNICIPAL_COUNTRY_BUDGET_COUNT} ოფიციალურ მუნიციპალურ საბიუჯეტო ერთეულს აერთიანებს და დამატებით მოიცავს აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივ გადასახდელებს, მუნიციპალიტეტებზე გადაცემული ტრანსფერების გამოკლებით. ფუნქციური სერიები მხოლოდ მუნიციპალურ კლასიფიკაციას ასახავს. ხუთი ოკუპირებულ ტერიტორიებთან დაკავშირებული ორგანო მხოლოდ ამ ჯამშია და მათი ხარჯი ტერიტორიულად მიკუთვნებულ ხარჯად არ არის წარმოდგენილი.${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        />
      </div>
    </main>
  );
}
