import { LandingPage } from "../components/landing/landing-page";
import { loadServedLandingData } from "../lib/data/servedData";
import { buildLandingModel } from "../lib/landing/landingData";
import { fiscalMetadata } from "../lib/seo/metadata";

export const metadata = fiscalMetadata({
  title: "საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge",
  description:
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები: მრავალწლიანი დინამიკა, ერთი წლის ანალიზი და ღია CSV.",
  path: "/",
});

export default async function Home() {
  const { facts, glossary, sourceDocuments } = await loadServedLandingData();
  const model = buildLandingModel({ facts, glossary, sourceDocuments });

  return <LandingPage model={model} />;
}
