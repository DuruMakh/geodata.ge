import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { loadServedExplorerData, loadServedLandingData } from "../../../lib/data/servedData";
import { firstServedYear } from "../../../lib/explorer/coverage";

const TITLE = "შემოსავლები — GeoData";
const DESCRIPTION_STEM = "საქართველოს ბიუჯეტის შემოსავლები — გადასახადები, გრანტები და სხვა შემოსულობები";

// The coverage start is read from the served facts, not written into the string:
// a hardcoded year keeps asserting itself in search results and link previews
// after the data moves (AGENTS.md, "UX and Visual Guardrails").
export async function generateMetadata(): Promise<Metadata> {
  const { facts } = await loadServedLandingData();
  const firstYear = firstServedYear(facts, "revenue");
  const description =
    firstYear === null ? `${DESCRIPTION_STEM}.` : `${DESCRIPTION_STEM}, ${firstYear} წლიდან დღემდე.`;

  return {
    title: TITLE,
    description,
    alternates: { canonical: "/explorer/revenue" },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: "/explorer/revenue",
      title: TITLE,
      description,
    },
  };
}

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
