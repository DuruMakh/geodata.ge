import type { Metadata } from "next";
import { MunicipalExplorer } from "../../../../components/municipalities/municipal-explorer";
import { BreadcrumbJsonLd } from "../../../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../lib/data/servedData";
import { sourceDocumentsFor } from "../../../../lib/data/sources";
import { MUNICIPAL_COUNTRY_ID } from "../../../../lib/data/municipal/types";
import {
  buildCountryTotalByYear,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
} from "../../../../lib/explorer/municipalData";
import { loadWorkbookSources, scopeMunicipalWorkbookSources } from "../../../../lib/methodology/workbookSources";
import { municipalitiesIntroduction } from "../../../../lib/seo/content";
import { coverageFromYears, fiscalMetadata } from "../../../../lib/seo/metadata";
import { resolveSiteUrl } from "../../../../lib/siteUrl";

const ROUTE = "/explorer/municipalities/georgia";

export async function generateMetadata(): Promise<Metadata> {
  const { countryTotalFacts } = await loadServedMunicipalData();
  const { firstYear, lastYear } = coverageFromYears(countryTotalFacts);
  return fiscalMetadata({
    title: `საქართველოს მუნიციპალური ბიუჯეტების ჯამი ${firstYear}–${lastYear} | Fiscal.ge`,
    description: `საქართველოს 69 მუნიციპალური საბიუჯეტო ერთეულის და აჭარის ა.რ. გაერთიანებული გადასახდელები, შიდა ტრანსფერების გამოკლებით, ${firstYear}–${lastYear}.`,
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
  const entityWorkbookSources = scopeMunicipalWorkbookSources(
    workbookSources,
    {
      municipalityCodes: municipalities.map((municipality) => municipality.code),
      includeAdjaraRepublic: true,
      includeAggregateOnlyCodes: true,
    },
  );

  const years = Array.from(new Set(countryTotalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const pickerGroups = buildPickerGroups({ municipalities, regionLabels, totalFacts, adjaraBudgetAdjustments, year: latestYear });
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);
  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(sourceDocuments, countryFunctionFacts, countryTotalFacts);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
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
          metaLine={`69 მუნიციპალური საბიუჯეტო ერთეული + აჭარის ა.რ. · ${firstYear}–${latestYear}`}
          functions={functions}
          functionFacts={countryFunctionFacts}
          totalFacts={countryTotalFacts}
          // Narrowed to the documents these rows cite: the full 104-row
          // registry is ~31 KB, embedded once per static page. lastUpdatedAt
          // above is computed from the unnarrowed registry, so the displayed
          // date is unchanged.
          sourceDocuments={sourceDocumentsFor(sourceDocuments, [...countryFunctionFacts, ...countryTotalFacts])}
          metrics={{ kind: "country", budgetCount: 69 }}
          workbookBasename="municipalities-georgia"
          workbookSources={entityWorkbookSources}
          functionalWorkbookSources={functionalWorkbookSources}
          supplementalWorkbookSources={adjustmentWorkbookSources}
          siteOrigin={resolveSiteUrl()}
          pickerCountry={{
            id: MUNICIPAL_COUNTRY_ID,
            nameKa: "საქართველო",
            valueGel: nationalTotalByYear[latestYear] ?? 0,
            budgetCount: 69,
          }}
          pickerGroups={pickerGroups}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). საქართველოს ჯამი 69 ოფიციალურ მუნიციპალურ საბიუჯეტო ერთეულს აერთიანებს და დამატებით მოიცავს აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივ გადასახდელებს, მუნიციპალიტეტებზე გადაცემული ტრანსფერების გამოკლებით. ფუნქციური სერიები მხოლოდ მუნიციპალურ კლასიფიკაციას ასახავს. ხუთი ოკუპირებულ ტერიტორიებთან დაკავშირებული ორგანო მხოლოდ ამ ჯამშია და მათი ხარჯი ტერიტორიულად მიკუთვნებულ ხარჯად არ არის წარმოდგენილი.${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
          introduction={municipalitiesIntroduction({ firstYear, lastYear: latestYear })}
        />
      </div>
    </main>
  );
}
