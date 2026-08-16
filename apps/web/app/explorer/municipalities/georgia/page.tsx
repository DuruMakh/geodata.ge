import type { Metadata } from "next";
import { MunicipalExplorer } from "../../../../components/municipalities/municipal-explorer";
import { PageHeader } from "../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../lib/data/servedData";
import { MUNICIPAL_COUNTRY_ID } from "../../../../lib/data/municipal/types";
import {
  buildCountryTotalByYear,
  buildPickerGroups,
  latestReviewedAtForMunicipalFacts,
} from "../../../../lib/explorer/municipalData";

const ROUTE = "/explorer/municipalities/georgia";

export async function generateMetadata(): Promise<Metadata> {
  const { countryTotalFacts } = await loadServedMunicipalData();
  const years = Array.from(new Set(countryTotalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const title = "საქართველოს მუნიციპალიტეტები — GeoData";
  const description = `საქართველოს 69 მუნიციპალური საბიუჯეტო ერთეულის ხარჯები ფუნქციების მიხედვით, ${years[0]}–${years.at(-1)}.`;

  return {
    title,
    description,
    alternates: { canonical: ROUTE },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: ROUTE,
      title,
      description,
    },
  };
}

export default async function GeorgiaMunicipalitiesPage() {
  const { municipalities, regions, functions, totalFacts, countryFunctionFacts, countryTotalFacts } =
    await loadServedMunicipalData();
  const { sourceDocuments } = await loadServedLandingData();

  const years = Array.from(new Set(countryTotalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const pickerGroups = buildPickerGroups({ municipalities, regionLabels, totalFacts, year: latestYear });
  const nationalTotalByYear = buildCountryTotalByYear(countryTotalFacts);
  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(sourceDocuments, countryFunctionFacts, countryTotalFacts);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
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
          metaLine={`69 მუნიციპალური საბიუჯეტო ერთეული · ${firstYear}–${latestYear}`}
          functions={functions}
          functionFacts={countryFunctionFacts}
          totalFacts={countryTotalFacts}
          sourceDocuments={sourceDocuments}
          metrics={{ kind: "country", budgetCount: 69 }}
          csvBasename="municipalities-georgia"
          pickerCountry={{
            id: MUNICIPAL_COUNTRY_ID,
            nameKa: "საქართველო",
            valueGel: nationalTotalByYear[latestYear] ?? 0,
            budgetCount: 69,
          }}
          pickerGroups={pickerGroups}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). საქართველოს ჯამი 69 ოფიციალურ მუნიციპალურ საბიუჯეტო ერთეულს აერთიანებს; ხუთი ოკუპირებულ ტერიტორიებთან დაკავშირებული ორგანო მხოლოდ ამ ჯამშია და მათი ხარჯი ტერიტორიულად მიკუთვნებულ ხარჯად არ არის წარმოდგენილი.${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        />
      </div>
    </main>
  );
}
