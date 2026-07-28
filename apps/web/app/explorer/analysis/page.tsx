import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData } from "../../../lib/data/servedData";

const DESCRIPTION = "ერთი წლის ბიუჯეტის სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾.";

export const metadata: Metadata = {
  title: "ანალიზი — GeoData",
  description: DESCRIPTION,
  alternates: { canonical: "/explorer/analysis" },
  openGraph: {
    type: "website",
    siteName: "GeoData.ge",
    locale: "ka_GE",
    url: "/explorer/analysis",
    title: "ანალიზი — GeoData",
    description: DESCRIPTION,
  },
};

export default async function AnalysisPage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      nav="analysis"
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
