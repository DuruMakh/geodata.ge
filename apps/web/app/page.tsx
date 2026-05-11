import { MainExplorer } from "../components/main-explorer/main-explorer";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../lib/data/sources";

export default async function Home() {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactRows("../../data/imports/sample-budget-facts.csv"),
    loadGlossary("../../data/glossary/category-glossary.csv"),
    loadSourceDocuments("../../data/sources/source-documents.csv"),
  ]);
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      facts={facts}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
