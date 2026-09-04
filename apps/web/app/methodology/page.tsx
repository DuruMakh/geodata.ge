import path from "node:path";
import { MethodologyHub } from "../../components/methodology/methodology-hub";
import { JsonLd } from "../../components/seo/json-ld";
import { SiteFooter } from "../../components/site/site-footer";
import { loadServedGovernmentDebtData, loadServedLandingData, loadServedMunicipalData } from "../../lib/data/servedData";
import { buildLandingContext } from "../../lib/landing/landingData";
import { buildMethodologyHubEntries } from "../../lib/methodology/catalog";
import { loadGeneratedArchiveSummaries } from "../../lib/methodology/prepareArchives";
import { fiscalMetadata } from "../../lib/seo/metadata";
import { dataCatalogJsonLd } from "../../lib/seo/structuredData";
import { resolveSiteUrl } from "../../lib/siteUrl";

const description = "Fiscal.ge-ს საჯარო მეთოდოლოგია, მონაცემთა დამუშავების გადაწყვეტილებები და უცვლელი ოფიციალური პირველწყაროები.";

export const metadata = fiscalMetadata({
  title: "ბიუჯეტის მონაცემთა მეთოდოლოგია და პირველწყაროები | Fiscal.ge",
  description,
  path: "/methodology",
});

export default async function MethodologyPage() {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [landingData, municipalData, debtData, archives] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadGeneratedArchiveSummaries(repositoryRoot),
  ]);
  const liveEntries = buildMethodologyHubEntries({
    budgetFacts: landingData.facts,
    municipalFacts: municipalData.totalFacts,
    debtFacts: debtData.facts,
    archives,
  });
  const landingModel = buildLandingContext(landingData);

  return (
    <>
      <JsonLd
        data={dataCatalogJsonLd(resolveSiteUrl(), [
          "/methodology/expenditure",
          "/methodology/revenue",
          "/methodology/municipalities",
          "/methodology/debt",
        ])}
        testId="catalog-json-ld"
      />
      <MethodologyHub
        liveEntries={liveEntries}
        breadcrumbItems={[{ name: "მთავარი", path: "/" }, { name: "მეთოდოლოგია", path: "/methodology" }]}
      />
      <div className="mx-auto w-full max-w-[1240px] px-5 min-[768px]:px-7">
        <SiteFooter updatedAt={landingModel.updatedAt} />
      </div>
    </>
  );
}
