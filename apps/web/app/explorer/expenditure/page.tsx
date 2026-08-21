import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData, loadServedLandingData } from "../../../lib/data/servedData";
import { coverageFromYears, fiscalMetadata } from "../../../lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { facts } = await loadServedLandingData();
  const { firstYear, lastYear } = coverageFromYears(facts.filter((fact) => fact.side === "expenditure"));
  return fiscalMetadata({
    title: `საქართველოს ბიუჯეტის ხარჯები ${firstYear}–${lastYear} | Fiscal.ge`,
    description: `საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯები სფეროებისა და უწყებების მიხედვით, ${firstYear}–${lastYear}.`,
    path: "/explorer/expenditure",
  });
}

export default async function ExpenditurePage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories, gdpFacts } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      nav="expenditure"
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      gdpFacts={gdpFacts}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
