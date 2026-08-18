import type { Metadata } from "next";
import { MunicipalitiesIndex } from "../../../components/municipalities/municipalities-index";
import { PageHeader } from "../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../lib/data/servedData";
import {
  buildIndexKpis,
  buildCountryListRow,
  buildMunicipalListRows,
  latestReviewedAtForMunicipalFacts,
  MUNICIPAL_PER_RESIDENT_YEAR,
} from "../../../lib/explorer/municipalData";
import { formatPerResidentGel } from "../../../lib/explorer/format";
import { buildMunicipalityMapModel } from "../../../lib/explorer/municipalityMapData";

const TITLE = "მუნიციპალიტეტები — GeoData";

export async function generateMetadata(): Promise<Metadata> {
  const { totalFacts } = await loadServedMunicipalData();
  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const description = `საქართველოს მუნიციპალიტეტების ბიუჯეტები ფუნქციების მიხედვით, ${years[0]} წლიდან დღემდე.`;

  return {
    title: TITLE,
    description,
    alternates: { canonical: "/explorer/municipalities" },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: "/explorer/municipalities",
      title: TITLE,
      description,
    },
  };
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
        <p className="mb-[26px] max-w-[560px] text-[13.5px] leading-relaxed text-[var(--body)]">
          აირჩიე მუნიციპალიტეტი რუკაზე ან სიაში — გაიხსნება შესაბამისი ბიუჯეტის სრული ისტორია ფუნქციების მიხედვით.
        </p>

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
          comparisonYear={comparisonYear}
        />
      </div>
    </main>
  );
}
