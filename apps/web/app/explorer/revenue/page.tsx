import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../../components/seo/breadcrumb-json-ld";
import { loadServedExplorerData, loadServedLandingData } from "../../../lib/data/servedData";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../../../lib/methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../../../lib/seo/metadata";
import { resolveSiteUrl } from "../../../lib/siteUrl";

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
  const [{ facts, glossary, sourceDocuments, gdpFacts }, workbookSources, gdpWorkbookSources] = await Promise.all([
    loadServedExplorerData(),
    loadWorkbookSources("revenue", "revenue"),
    loadGdpWorkbookSources(),
  ]);
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  // No adminFacts/adminCategories: the ministries scope cannot be reached from
  // this route, so shipping the admin corpus here is dead payload.
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "შემოსავლები", path: "/explorer/revenue" }]} />
      <MainExplorer
        nav="revenue"
        facts={facts}
        glossaryEntries={Array.from(glossary.values())}
        sourceDocuments={sourceDocuments}
        gdpFacts={gdpFacts}
        workbookSources={workbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
