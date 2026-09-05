import type { Metadata } from "next";
import { DebtExplorer } from "../../../../components/debt/debt-explorer";
import { BreadcrumbJsonLd } from "../../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../../components/seo/json-ld";
import { loadServedExplorerData, loadServedGovernmentDebtData } from "../../../../lib/data/servedData";
import { coverageFromYears, governmentDebtMetadata } from "../../../../lib/seo/metadata";
import { DEBT_EXPLORER_PATH } from "../../../../lib/seo/internalLinks";
import { explorerDatasetJsonLd } from "../../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../../lib/siteUrl";
import { loadGdpWorkbookSources, loadWorkbookSources } from "../../../../lib/methodology/workbookSources";

export async function generateMetadata(): Promise<Metadata> {
  const { facts } = await loadServedGovernmentDebtData();
  return governmentDebtMetadata(facts);
}

export default async function DebtPage() {
  const [{ facts }, { gdpFacts }, workbookSources, gdpWorkbookSources] = await Promise.all([
    loadServedGovernmentDebtData(),
    loadServedExplorerData(),
    loadWorkbookSources("debt"),
    loadGdpWorkbookSources(),
  ]);
  const stockFacts = facts.filter((fact) => fact.family === "stock" && fact.status === "actual");
  const { firstYear, lastYear } = coverageFromYears(stockFacts);
  const { firstYear: datasetFirstYear, lastYear: datasetLastYear } = coverageFromYears(facts);
  const lastUpdatedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  const description = `საქართველოს მთავრობის ვალის მოცულობა, ვალის მომსახურება და საპროცენტო განაკვეთები, ${firstYear}–${lastYear}.`;
  const datasetDescription = `${description} 2026–2030 წლების ვალის გადახდა არის 2025-12-31 მდგომარეობით არსებული პორტფელის პროგნოზი.`;

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: DEBT_EXPLORER_PATH,
          name: "საქართველოს მთავრობის ვალი",
          description: datasetDescription,
          firstYear: datasetFirstYear,
          lastYear: datasetLastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: "საქართველო",
          downloadPath: "/downloads/data/government-debt.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[
        { name: "მთავარი", path: "/" },
        { name: "ბიუჯეტი", path: "/explorer" },
        { name: "ვალი", path: DEBT_EXPLORER_PATH },
      ]} />
      <DebtExplorer
        facts={facts}
        gdpFacts={gdpFacts}
        workbookSources={workbookSources}
        gdpWorkbookSources={gdpWorkbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
