import type { Metadata } from "next";
import { MunicipalitiesIndex } from "../../../../components/municipalities/municipalities-index";
import { BreadcrumbJsonLd } from "../../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../../components/seo/json-ld";
import { PageHeader } from "../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../lib/data/servedData";
import {
  buildIndexKpis,
  buildCountryListRow,
  buildMunicipalListRows,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_COUNTRY_BUDGET_COUNT,
  MUNICIPAL_PER_RESIDENT_YEAR,
} from "../../../../lib/explorer/municipalData";
import { formatPerResidentGel } from "../../../../lib/explorer/format";
import { buildMunicipalityMapModel } from "../../../../lib/explorer/municipalityMapData";
import { coverageFromYears, fiscalMetadata } from "../../../../lib/seo/metadata";
import { explorerDatasetJsonLd } from "../../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../../lib/siteUrl";

export async function generateMetadata(): Promise<Metadata> {
  const { totalFacts } = await loadServedMunicipalData();
  const { firstYear, lastYear } = coverageFromYears(totalFacts);
  return fiscalMetadata({
    title: `საქართველოს მუნიციპალიტეტების ბიუჯეტები ${firstYear}–${lastYear} | Fiscal.ge`,
    description: `საქართველოს მუნიციპალიტეტების ფაქტობრივი ბიუჯეტები ფუნქციების მიხედვით, ${firstYear}–${lastYear}.`,
    path: "/explorer/municipalities",
  });
}

export default async function MunicipalitiesIndexPage() {
  const { municipalities, regions, totalFacts, populationFacts, functionFacts, countryTotalFacts, countryFunctionFacts, functions, adjaraBudgetAdjustments } = await loadServedMunicipalData();
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

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: "/explorer/municipalities",
          name: "საქართველოს მუნიციპალიტეტების ბიუჯეტები",
          description: `საქართველოს მუნიციპალიტეტების ფაქტობრივი ბიუჯეტები ფუნქციების მიხედვით, ${firstYear}–${latestYear}.`,
          firstYear,
          lastYear: latestYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: "საქართველო",
          downloadPath: "/downloads/data/municipal-expenditure.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "მუნიციპალიტეტები", path: "/explorer/municipalities" }]} />
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები" },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />
        <h1 className="mt-[34px] mb-2.5 max-w-[640px] font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[36px]">
          რას ხარჯავენ საქართველოს მუნიციპალიტეტები
        </h1>
        <MunicipalitiesIndex
          viewBox={map.viewBox}
          shapes={map.shapes}
          markers={map.markers}
          occupiedAreas={map.occupiedAreas}
          legendMin={formatPerResidentGel(map.legendMinPerResidentGel)}
          legendMax={formatPerResidentGel(map.legendMaxPerResidentGel)}
          municipalities={list.municipalities}
          regions={list.regions}
          country={buildCountryListRow(countryTotalFacts, comparisonYear)}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). რუკა ბიუჯეტს ერთ მოსახლეზე ასახავს (${comparisonYear}). რუკა და მუნიციპალიტეტების სია ${municipalities.length} მუნიციპალიტეტს მოიცავს, „საქართველოს“ ჯამი კი ${MUNICIPAL_COUNTRY_BUDGET_COUNT} ოფიციალურ მუნიციპალურ საბიუჯეტო ერთეულს აერთიანებს და დამატებით მოიცავს აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივ გადასახდელებს — ამიტომ რეგიონების ჯამი ქვეყნის ჯამზე ნაკლებია.${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
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
          })}
        />
      </div>
    </main>
  );
}
