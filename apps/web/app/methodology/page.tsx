import type { Metadata } from "next";
import path from "node:path";
import { MethodologyHub } from "../../components/methodology/methodology-hub";
import { SiteFooter } from "../../components/site/site-footer";
import { loadServedLandingData, loadServedMunicipalData } from "../../lib/data/servedData";
import { buildLandingModel } from "../../lib/landing/landingData";
import { buildMethodologyHubEntries } from "../../lib/methodology/catalog";
import { loadGeneratedArchiveSummaries } from "../../lib/methodology/prepareArchives";

const title = "მეთოდოლოგია და პირველწყაროები — Fiscal.ge";
const description = "Fiscal.ge-ს საჯარო მეთოდოლოგია, მონაცემთა დამუშავების გადაწყვეტილებები და უცვლელი ოფიციალური პირველწყაროები.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/methodology" },
  openGraph: {
    type: "website",
    siteName: "Fiscal.ge",
    locale: "ka_GE",
    url: "/methodology",
    title,
    description,
  },
};

export default async function MethodologyPage() {
  const repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [landingData, municipalData, archives] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadGeneratedArchiveSummaries(repositoryRoot),
  ]);
  const liveEntries = buildMethodologyHubEntries({
    budgetFacts: landingData.facts,
    municipalFacts: municipalData.totalFacts,
    archives,
  });
  const landingModel = buildLandingModel(landingData);

  return (
    <>
      <MethodologyHub liveEntries={liveEntries} />
      <div className="mx-auto w-full max-w-[1240px] px-5 min-[768px]:px-7">
        <SiteFooter updatedAt={landingModel.updatedAt} />
      </div>
    </>
  );
}
