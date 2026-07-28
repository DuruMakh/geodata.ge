import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData } from "../../../lib/data/servedData";

export const metadata: Metadata = {
  title: "ხარჯები — GeoData",
  description: "საქართველოს ბიუჯეტის ხარჯები სფეროებისა და უწყებების ჭრილში, 2005 წლიდან დღემდე.",
  alternates: { canonical: "/explorer/expenditure" },
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
    url: "/explorer/expenditure",
    title: "ხარჯები — GeoData",
    description: "საქართველოს ბიუჯეტის ხარჯები სფეროებისა და უწყებების ჭრილში, 2005 წლიდან დღემდე.",
  },
};

export default async function ExpenditurePage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      nav="expenditure"
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
