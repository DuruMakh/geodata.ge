import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../../components/seo/breadcrumb-json-ld";
import { loadServedExplorerData } from "../../../lib/data/servedData";
import { referencedSourceIds, sourceDocumentsFor } from "../../../lib/data/sources";
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
  // buildSingleYearSnapshotModel keeps only admin_category rows (singleYear.ts),
  // and the route's other admin readers agree: totalsByScope filters to the same
  // level, and yearsByScope.ministries needs a year set the category rows already
  // cover in full (2004-2025 either way). So the 549 major_program rows were
  // 307 KB of payload this route has no way to render.
  const ownAdminFacts = adminFacts.filter((fact) => fact.level === "admin_category");
  // Date from the FULL corpus, so narrowing the payload cannot move the
  // displayed "განახლდა" date.
  const cited = referencedSourceIds([...facts, ...adminFacts]);
  const lastUpdatedAt = sourceDocuments
    .filter((source) => cited.has(source.sourceId))
    .map((source) => source.lastReviewedAt)
    .sort()
    .at(-1) ?? "";

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "ანალიზი", path: "/explorer/analysis" }]} />
      <MainExplorer
        nav="analysis"
        facts={facts}
        adminFacts={ownAdminFacts}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values())}
        sourceDocuments={sourceDocumentsFor(sourceDocuments, [...facts, ...ownAdminFacts])}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
