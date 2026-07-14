import type { Metadata } from "next";
import { MainExplorer } from "../../components/main-explorer/main-explorer";
import { loadServedExplorerData } from "../../lib/data/servedData";

export const metadata: Metadata = {
  title: "ბიუჯეტის ექსპლორერი — GeoData",
  description: "საქართველოს ბიუჯეტის მრავალწლიანი დინამიკა და ერთი წლის ანალიზი — გადამოწმებული ოფიციალური მონაცემები და ღია CSV.",
};

export default async function ExplorerPage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } =
    await loadServedExplorerData();
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
