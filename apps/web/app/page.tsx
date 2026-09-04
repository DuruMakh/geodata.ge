import { LandingPage } from "../components/landing/landing-page";
import {
  loadServedGeneralGovernmentBalanceData,
  loadServedGovernmentDebtData,
  loadServedLandingData,
  loadServedMunicipalData,
} from "../lib/data/servedData";
import { buildLandingModel } from "../lib/landing/landingData";
import { fiscalMetadata } from "../lib/seo/metadata";
import { resolveSiteUrl } from "../lib/siteUrl";

const rootUrl = new URL("/", `${resolveSiteUrl()}/`).href;
const rootMetadata = fiscalMetadata({
  title: "საქართველოს ბიუჯეტი, ვალი და დეფიციტი | Fiscal.ge",
  description:
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების, მთავრობის ვალისა და დეფიციტის გადამოწმებული მონაცემები, მეთოდოლოგია და ჩამოსატვირთი Excel ფაილები.",
  path: "/",
});

// Next 16 deliberately serializes an origin-only URL without its root slash.
// Keep the shared helper's absolute contract, but render these two root tags
// directly so crawlers receive the exact canonical URL the public site owns.
export const metadata = {
  ...rootMetadata,
  alternates: undefined,
  openGraph: rootMetadata.openGraph ? { ...rootMetadata.openGraph, url: undefined } : undefined,
};

export default async function Home() {
  const [landingData, municipalData, debtData, balanceData] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadServedGeneralGovernmentBalanceData(),
  ]);
  const model = buildLandingModel({
    ...landingData,
    municipalities: municipalData.municipalities,
    municipalTotalFacts: municipalData.totalFacts,
    municipalCountryTotalFacts: municipalData.countryTotalFacts,
    debtFacts: debtData.facts,
    balanceFacts: balanceData.facts,
  });

  return (
    <>
      <link rel="canonical" href={rootUrl} />
      <meta property="og:url" content={rootUrl} />
      <LandingPage model={model} />
    </>
  );
}
