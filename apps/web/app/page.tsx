import { LandingPage } from "../components/landing/landing-page";
import { loadServedLandingData, loadServedMunicipalData } from "../lib/data/servedData";
import { buildLandingModel } from "../lib/landing/landingData";
import { fiscalMetadata } from "../lib/seo/metadata";

export const metadata = fiscalMetadata({
  title: "საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge",
  description:
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები — ხარჯები, შემოსავლები, მუნიციპალიტეტები, მეთოდოლოგია და ჩამოსატვირთი მონაცემები.",
  path: "/",
});

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

  return <LandingPage model={model} />;
}
