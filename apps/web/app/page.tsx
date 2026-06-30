import { MainExplorer } from "../components/main-explorer/main-explorer";
import type { AdminSpendingCategory } from "../lib/data/adminSpending/types";
import { loadAdminSpendingFacts } from "../lib/data/adminSpending/importAdminSpendingFacts";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../lib/data/sources";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function loadAdminCategories(relativePath: string): Promise<AdminSpendingCategory[]> {
  const filePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
  return JSON.parse(await readFile(filePath, "utf8")) as AdminSpendingCategory[];
}

export default async function Home() {
  const [facts, glossary, sourceDocuments, adminFacts, adminCategories] = await Promise.all([
    loadBudgetFactRows("../../data/imports/budget-facts-2004-2025.csv"),
    loadGlossary("../../data/glossary/category-glossary.csv"),
    loadSourceDocuments("../../data/sources/source-documents.csv"),
    loadAdminSpendingFacts("../../data/imports/admin-spending-facts-2004-2025.csv"),
    loadAdminCategories("../../data/taxonomy/admin-spending-categories.json"),
  ]);
  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <MainExplorer
      facts={facts}
      adminFacts={adminFacts}
      adminCategories={adminCategories}
      glossaryEntries={Array.from(glossary.values())}
      sourceDocuments={sourceDocuments}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
