import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../components/seo/json-ld";
import { loadServedExplorerData, loadServedLandingData } from "../../../lib/data/servedData";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../../../lib/methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../../../lib/seo/metadata";
import { explorerDatasetJsonLd } from "../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../lib/siteUrl";
import { projectAdminFact, projectBudgetFact, projectGdpFact } from "../../../lib/explorer/clientData";

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
  const [{ facts, glossary, sourceDocuments, adminFacts, adminCategories, gdpFacts }, workbookSources, adminWorkbookSources, gdpWorkbookSources] =
    await Promise.all([
      loadServedExplorerData(),
      loadWorkbookSources("expenditure", "expenditure-fields"),
      loadWorkbookSources("expenditure", "expenditure-ministries"),
      loadGdpWorkbookSources(),
    ]);
  // Same reasoning the revenue route already applies to the admin corpus: this
  // route's explorerSide is fixed to "expenditure" by `nav`, so the 241 revenue
  // rows can never be rendered here and were 35 KB of dead RSC payload.
  const ownFacts = facts.filter((fact) => fact.side === "expenditure");
  // Computed from the full registry, before the narrowing below: this is the
  // displayed "განახლდა" date and narrowing it here would change what the page
  // shows, not just what it ships.
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const { firstYear, lastYear } = coverageFromYears(ownFacts);

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: "/explorer/expenditure",
          datasetId: "national-expenditure",
          sameAsPath: "/methodology/expenditure",
          name: "საქართველოს სახელმწიფო ბიუჯეტის ხარჯები",
          description: `საქართველოს სახელმწიფო ბიუჯეტის ფაქტობრივი ხარჯები სფეროებისა და უწყებების მიხედვით, ${firstYear}–${lastYear}.`,
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: "საქართველო",
          downloadPath: "/downloads/data/national-expenditure.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "ხარჯები", path: "/explorer/expenditure" }]} />
      <MainExplorer
        nav="expenditure"
        facts={ownFacts.map(projectBudgetFact)}
        adminFacts={adminFacts.map(projectAdminFact)}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values())}
        gdpFacts={gdpFacts.map(projectGdpFact)}
        workbookSources={workbookSources}
        adminWorkbookSources={adminWorkbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
