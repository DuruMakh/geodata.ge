import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData, loadServedLandingData } from "../../../lib/data/servedData";
import { coverageFromYears, fiscalMetadata } from "../../../lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { facts } = await loadServedLandingData();
  const { firstYear, lastYear } = coverageFromYears(facts.filter((fact) => fact.side === "revenue"));
  return fiscalMetadata({
    title: `საქართველოს ბიუჯეტის შემოსავლები ${firstYear}–${lastYear} | Fiscal.ge`,
    description: `საქართველოს ბიუჯეტის ფაქტობრივი შემოსავლები — გადასახადები, გრანტები და სხვა შემოსულობები, ${firstYear}–${lastYear}.`,
    path: "/explorer/revenue",
  });
}

export default async function RevenuePage() {
  const { facts, glossary, sourceDocuments, gdpFacts } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  // No adminFacts/adminCategories: the ministries scope cannot be reached from
  // this route, so shipping the admin corpus here is dead payload.
  return (
    <MainExplorer
      nav="revenue"
      facts={facts}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      gdpFacts={gdpFacts}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
