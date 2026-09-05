import type { Metadata } from "next";
import { MainExplorer } from "../../../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../../components/seo/json-ld";
import { loadServedExplorerData, loadServedLandingData } from "../../../../lib/data/servedData";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../../../../lib/methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../../../../lib/seo/metadata";
import { explorerDatasetJsonLd } from "../../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../../lib/siteUrl";
import { projectBudgetFact, projectGdpFact } from "../../../../lib/explorer/clientData";

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
  // `nav` fixes explorerSide to "revenue" here, so the 286 expenditure rows can
  // never be rendered on this route — 53 KB of dead payload, the same reasoning
  // the adminFacts note below already applies to the admin corpus.
  const ownFacts = facts.filter((fact) => fact.side === "revenue");
  // Computed from the full registry, before the narrowing below: this is the
  // displayed "განახლდა" date and narrowing it here would change what the page
  // shows, not just what it ships.
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const { firstYear, lastYear } = coverageFromYears(ownFacts);

  // No adminFacts/adminCategories: the ministries scope cannot be reached from
  // this route, so shipping the admin corpus here is dead payload.
  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: "/explorer/revenue",
          name: "საქართველოს სახელმწიფო ბიუჯეტის შემოსავლები",
          description: `საქართველოს ბიუჯეტის ფაქტობრივი შემოსავლები — გადასახადები, გრანტები და სხვა შემოსულობები, ${firstYear}–${lastYear}.`,
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: "საქართველო",
          downloadPath: "/downloads/data/national-revenue.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "შემოსავლები", path: "/explorer/revenue" }]} />
      <MainExplorer
        nav="revenue"
        facts={ownFacts.map(projectBudgetFact)}
        glossaryEntries={Array.from(glossary.values())}
        gdpFacts={gdpFacts.map(projectGdpFact)}
        workbookSources={workbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
