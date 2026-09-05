import type { Metadata } from "next";
import { DeficitExplorer } from "../../../../components/deficit/deficit-explorer";
import { BreadcrumbJsonLd } from "../../../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../../../components/seo/json-ld";
import { loadServedGeneralGovernmentBalanceData } from "../../../../lib/data/servedData";
import type { WorkbookPublicSource } from "../../../../lib/explorer/workbookModel";
import { coverageFromYears, generalGovernmentDeficitMetadata } from "../../../../lib/seo/metadata";
import { DEFICIT_EXPLORER_PATH } from "../../../../lib/seo/internalLinks";
import { explorerDatasetJsonLd } from "../../../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../../../lib/siteUrl";

const workbookSources: WorkbookPublicSource[] = [{
  years: Array.from({ length: 37 }, (_, index) => 1995 + index),
  titleKa: "IMF World Economic Outlook — 2026 წლის აპრილი",
  organizationKa: "საერთაშორისო სავალუტო ფონდი (IMF)",
  downloadHref: "https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx",
  retrievedAt: "2026-09-04",
}];

export async function generateMetadata(): Promise<Metadata> {
  const { facts } = await loadServedGeneralGovernmentBalanceData();
  return generalGovernmentDeficitMetadata(facts);
}

export default async function DeficitPage() {
  const { facts } = await loadServedGeneralGovernmentBalanceData();
  const { firstYear, lastYear } = coverageFromYears(facts);
  const lastUpdatedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  const description = `საქართველოს ზოგადი მთავრობის დეფიციტი ან პროფიციტი, მშპ-ის პროცენტად და ნომინალურ ლარში, ${firstYear}–${lastYear}; 2026–2031 IMF-ის პროგნოზია.`;

  return (
    <>
      <JsonLd
        data={explorerDatasetJsonLd({
          origin: resolveSiteUrl(),
          path: DEFICIT_EXPLORER_PATH,
          name: "საქართველოს ზოგადი მთავრობის დეფიციტი",
          description,
          firstYear,
          lastYear,
          dateModified: lastUpdatedAt,
          spatialCoverageName: "საქართველო",
          downloadPath: "/downloads/data/general-government-balance.csv",
        })}
        testId="explorer-dataset-json-ld"
      />
      <BreadcrumbJsonLd items={[
        { name: "მთავარი", path: "/" },
        { name: "ბიუჯეტი", path: "/explorer" },
        { name: "დეფიციტი", path: DEFICIT_EXPLORER_PATH },
      ]} />
      <DeficitExplorer
        facts={facts}
        workbookSources={workbookSources}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
    </>
  );
}
