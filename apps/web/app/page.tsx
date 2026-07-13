import type { Metadata } from "next";
import { LandingPage } from "../components/landing/landing-page";
import { loadServedLandingData } from "../lib/data/servedData";
import { buildLandingModel } from "../lib/landing/landingData";

export const metadata: Metadata = {
  title: "GeoData — საქართველოს ბიუჯეტის ექსპლორერი",
  description: "გადამოწმებული ოფიციალური საბიუჯეტო მონაცემები: მრავალწლიანი დინამიკა, ერთი წლის სურათი და ღია CSV.",
};

export default async function Home() {
  const { facts, glossary, sourceDocuments } = await loadServedLandingData();
  const model = buildLandingModel({ facts, glossary, sourceDocuments });

  return <LandingPage model={model} />;
}
