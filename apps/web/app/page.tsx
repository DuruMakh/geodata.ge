import { LandingPage } from "../components/landing/landing-page";
import { loadServedLandingData, loadServedMunicipalData } from "../lib/data/servedData";
import { buildLandingModel } from "../lib/landing/landingData";
import { fiscalMetadata } from "../lib/seo/metadata";
import { resolveSiteUrl } from "../lib/siteUrl";

const rootUrl = new URL("/", `${resolveSiteUrl()}/`).href;
const rootMetadata = fiscalMetadata({
  title: "საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge",
  description:
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები — ხარჯები, შემოსავლები, მუნიციპალიტეტები, მეთოდოლოგია და ჩამოსატვირთი მონაცემები.",
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
  const [landingData, municipalData] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
  ]);
  const model = buildLandingModel({
    ...landingData,
    municipalities: municipalData.municipalities,
    municipalTotalFacts: municipalData.totalFacts,
    municipalCountryTotalFacts: municipalData.countryTotalFacts,
  });

  return (
    <>
      <link rel="canonical" href={rootUrl} />
      <meta property="og:url" content={rootUrl} />
      <LandingPage model={model} />
    </>
  );
}
