import type { Metadata } from "next";
import { DebtExplorer } from "../../../components/debt/debt-explorer";
import { BreadcrumbJsonLd } from "../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../components/seo/json-ld";
import { loadServedExplorerData, loadServedGovernmentDebtData } from "../../../lib/data/servedData";
import { coverageFromYears, governmentDebtMetadata } from "../../../lib/seo/metadata";
import { DEBT_EXPLORER_PATH } from "../../../lib/seo/internalLinks";
import { explorerDatasetJsonLd } from "../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../lib/siteUrl";

export async function generateMetadata(): Promise<Metadata> {
  const { facts } = await loadServedGovernmentDebtData();
  return governmentDebtMetadata(facts);
}

export default async function DebtPage() {
  const [{ facts }, { gdpFacts }] = await Promise.all([
    loadServedGovernmentDebtData(),
    loadServedExplorerData(),
  ]);
  const stockFacts = facts.filter((fact) => fact.family === "stock" && fact.status === "actual");
  const { firstYear, lastYear } = coverageFromYears(stockFacts);
  const lastUpdatedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  const description = `საქართველოს მთავრობის ვალის მოცულობა, ვალის მომსახურება და საპროცენტო განაკვეთები, ${firstYear}–${lastYear}.`;

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: DEBT_EXPLORER_PATH,
          name: "საქართველოს მთავრობის ვალი",
          description,
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: "საქართველო",
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
        // Task 5 replaces this empty source set with the reviewed workbook
        // adapter and enables the already-rendered Excel action.
        workbookSources={[]}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
