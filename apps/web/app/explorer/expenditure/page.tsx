import type { Metadata } from "next";
import { MainExplorer } from "../../../components/main-explorer/main-explorer";
import { BreadcrumbJsonLd } from "../../../components/seo/breadcrumb-json-ld";
import { loadServedExplorerData, loadServedLandingData } from "../../../lib/data/servedData";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../../../lib/methodology/workbookSources";
import { coverageFromYears, fiscalMetadata } from "../../../lib/seo/metadata";
import { resolveSiteUrl } from "../../../lib/siteUrl";

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

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "მთავარი", path: "/" }, { name: "ბიუჯეტი", path: "/explorer" }, { name: "ხარჯები", path: "/explorer/expenditure" }]} />
      <MainExplorer
        nav="expenditure"
        facts={ownFacts}
        adminFacts={adminFacts}
        adminCategories={adminCategories}
        glossaryEntries={Array.from(glossary.values())}
        gdpFacts={gdpFacts}
        workbookSources={workbookSources}
        adminWorkbookSources={adminWorkbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
