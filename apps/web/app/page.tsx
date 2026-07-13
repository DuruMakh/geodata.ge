import type { Metadata } from "next";
import { LandingPage } from "../components/landing/landing-page";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../lib/data/sources";
import { buildLandingModel } from "../lib/landing/landingData";

export const metadata: Metadata = {
  title: "GeoData — საქართველოს ბიუჯეტის ექსპლორერი",
  description: "გადამოწმებული ოფიციალური საბიუჯეტო მონაცემები: მრავალწლიანი დინამიკა, ერთი წლის სურათი და ღია CSV.",
};

export default async function Home() {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactRows("../../data/imports/budget-facts-2005-2025.csv"),
    loadGlossary("../../data/glossary/category-glossary.csv"),
    loadSourceDocuments("../../data/sources/source-documents.csv"),
  ]);
  const model = buildLandingModel({ facts, glossary, sourceDocuments });

  return <LandingPage model={model} />;
}
