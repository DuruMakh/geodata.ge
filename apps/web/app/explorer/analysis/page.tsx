import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../../components/seo/breadcrumb-json-ld";
import { loadServedExplorerData } from "../../../lib/data/servedData";
import { coverageFromYears, fiscalMetadata } from "../../../lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { facts } = await loadServedExplorerData();
  const { lastYear } = coverageFromYears(facts);
  return fiscalMetadata({
    title: `საქართველოს ბიუჯეტის ანალიზი — ${lastYear} ფაქტი | Fiscal.ge`,
    description: `${lastYear} წლის ბიუჯეტის ფაქტობრივი სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾.`,
    path: "/explorer/analysis",
  });
}

export default async function AnalysisPage() {
  const { facts, glossary, sourceDocuments, adminFacts, adminCategories } = await loadServedExplorerData();
  const referencedSourceIds = new Set(
    [...facts, ...adminFacts].flatMap((fact) => fact.sourceId.split(";").map((sourceId) => sourceId.trim())),
  );
  const lastUpdatedAt = sourceDocuments
    .filter((source) => referencedSourceIds.has(source.sourceId))
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1) ?? "";

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "ანალიზი", path: "/explorer/analysis" }]} />
      <MainExplorer
        nav="analysis"
        facts={facts}
        adminFacts={adminFacts}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values())}
        sourceDocuments={sourceDocuments}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
