import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData } from "../../../lib/data/servedData";

const DESCRIPTION = "საქართველოს ბიუჯეტის შემოსავლები — გადასახადები, გრანტები და სხვა შემოსულობები, 2005 წლიდან დღემდე.";

export const metadata: Metadata = {
  title: "შემოსავლები — GeoData",
  description: DESCRIPTION,
  alternates: { canonical: "/explorer/revenue" },
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
    url: "/explorer/revenue",
    title: "შემოსავლები — GeoData",
    description: DESCRIPTION,
  },
};

export default async function RevenuePage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      nav="revenue"
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
