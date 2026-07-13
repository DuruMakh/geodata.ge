import type { AdminSpendingCategory, AdminSpendingFact } from "./adminSpending/types";
import { loadAdminSpendingCategoriesFile } from "./adminSpending/categoriesFile";
import { loadAdminSpendingFacts } from "./adminSpending/importAdminSpendingFacts";
import { loadGlossary, type GlossaryEntry } from "./glossary";
import { loadBudgetFactRows, type BudgetFactImportRow } from "./importBudgetFacts";
import { loadSourceDocuments, type SourceDocumentRow } from "./sources";
import { assertSameServedRows } from "./servedDataParity";

// The one list of files the site serves. The database import mirrors exactly
// these files (scripts/import-budget-facts.ts imports this constant), so
// "what the site serves" and "what the import mirrors" cannot drift apart.
export const SERVED_DATA_FILES = {
  budgetFacts: "../../data/imports/budget-facts-2005-2025.csv",
  adminSpendingFacts: "../../data/imports/admin-spending-facts-2005-2025.csv",
  glossary: "../../data/glossary/category-glossary.csv",
  sourceDocuments: "../../data/sources/source-documents.csv",
  adminSpendingCategories: "../../data/taxonomy/admin-spending-categories.json",
} as const;

// Single switch for where the site reads its data while pages are built.
// "db" reads the Supabase mirror populated by `npm run data:import` (the
// canonical serving store) and verifies it row-by-row against the reviewed
// CSVs in the checkout; "csv" (default) reads the reviewed files directly.
export type ServedDataSource = "csv" | "db";

export type LandingData = {
  facts: BudgetFactImportRow[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
};

export type ExplorerData = LandingData & {
  adminFacts: AdminSpendingFact[];
  adminCategories: AdminSpendingCategory[];
};

export function resolveServedDataSource(): ServedDataSource {
  const raw = (process.env.GEODATA_DATA_SOURCE ?? "").trim().toLowerCase();

  if (raw === "" || raw === "csv") {
    return "csv";
  }

  if (raw === "db") {
    return "db";
  }

  throw new Error(`GEODATA_DATA_SOURCE must be "db" or "csv", got "${raw}"`);
}

async function loadLandingDataFromCsv(): Promise<LandingData> {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts),
    loadGlossary(SERVED_DATA_FILES.glossary),
    loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
  ]);

  return { facts, glossary, sourceDocuments };
}

async function loadExplorerDataFromCsv(): Promise<ExplorerData> {
  const [landing, adminFacts, adminCategories] = await Promise.all([
    loadLandingDataFromCsv(),
    loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts),
    loadAdminSpendingCategoriesFile(SERVED_DATA_FILES.adminSpendingCategories),
  ]);

  return { ...landing, adminFacts, adminCategories };
}

// The database is only served after proving it still matches the reviewed
// CSVs in this checkout, row by row. This catches a stale mirror (CSVs merged
// without re-running `npm run data:import`), any direct database edit, and
// any import mapping bug — the build fails loudly instead of serving drifted
// data.
function assertLandingParity(db: LandingData, csv: LandingData): void {
  assertSameServedRows("budget facts", csv.facts, db.facts, (row) =>
    [row.year, row.side, row.itemId, row.basis].join(":"),
  );
  assertSameServedRows(
    "glossary entries",
    [...csv.glossary.values()],
    [...db.glossary.values()],
    (row) => row.id,
  );
  assertSameServedRows("source documents", csv.sourceDocuments, db.sourceDocuments, (row) => row.sourceId);
}

export async function loadServedLandingData(): Promise<LandingData> {
  if (resolveServedDataSource() === "db") {
    const { loadLandingDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadLandingDataFromDb(), loadLandingDataFromCsv()]);
    assertLandingParity(db, csv);
    return db;
  }

  return loadLandingDataFromCsv();
}

export async function loadServedExplorerData(): Promise<ExplorerData> {
  if (resolveServedDataSource() === "db") {
    const { loadExplorerDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadExplorerDataFromDb(), loadExplorerDataFromCsv()]);
    assertLandingParity(db, csv);
    assertSameServedRows("admin spending facts", csv.adminFacts, db.adminFacts, (row) =>
      [row.year, row.itemId].join(":"),
    );
    assertSameServedRows("admin spending categories", csv.adminCategories, db.adminCategories, (row) => row.id);
    return db;
  }

  return loadExplorerDataFromCsv();
}
