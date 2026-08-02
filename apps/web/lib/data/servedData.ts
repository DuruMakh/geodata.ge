import type { AdminSpendingCategory, AdminSpendingFact } from "./adminSpending/types";
import { loadAdminSpendingCategoriesFile } from "./adminSpending/categoriesFile";
import { loadAdminSpendingFacts } from "./adminSpending/importAdminSpendingFacts";
import { loadGlossary, type GlossaryEntry } from "./glossary";
import { loadBudgetFactRows, type BudgetFactImportRow } from "./importBudgetFacts";
import { loadSourceDocuments, type SourceDocumentRow } from "./sources";
import type { ServedAdminFact, ServedBudgetFact } from "../servedRows";
import {
  adminFactParityKey,
  assertSameServedRows,
  budgetFactParityKey,
} from "./servedDataParity";

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

// Full ingestion rows: what the loaders read and what the parity check compares.
// Exported only so the db loader can declare the same shape — no page or
// component should consume these; they stop at the narrowing below.
export type LoadedLandingData = {
  facts: BudgetFactImportRow[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
};

export type LoadedExplorerData = LoadedLandingData & {
  adminFacts: AdminSpendingFact[];
  adminCategories: AdminSpendingCategory[];
};

// What callers get: the same data with the ingestion-only columns projected
// away (lib/servedRows.ts). These rows are what reaches the browser.
export type LandingData = {
  facts: ServedBudgetFact[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
};

export type ExplorerData = LandingData & {
  adminFacts: ServedAdminFact[];
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

// The explorer model walks the facts and lets the last one win, so each series
// carries its most recent official name (lib/explorer/explorerData.ts). That
// needs year-ascending order.
//
// Only the admin facts need this. The public facts reach every model through
// chooseActivePublicFacts, which sorts by (year, itemId) itself, and no other
// consumer of `facts` depends on incoming order. Admin facts go straight into
// the model — `active = adminFacts.map(adminFactForModel)` — with no sort at
// all, so on the CSV path their order is whatever the generator last emitted.
// The db path gets it from its ORDER BY (lib/db/mirrorRows.ts).
//
// The sort is stable, so file order still decides within a year; exact
// cross-path row order is not claimed here, and parity compares by key.
function byYearAscending<T extends { year: number }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => left.year - right.year);
}

// Projection to the served rows. The return annotations are the drift guard:
// widen an ingestion union and assigning it here stops typechecking.
function toServedBudgetFact(fact: BudgetFactImportRow): ServedBudgetFact {
  return {
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    amountGel: fact.amountGel,
    basis: fact.basis,
    sourceId: fact.sourceId,
  };
}

function toServedAdminFact(fact: AdminSpendingFact): ServedAdminFact {
  return {
    year: fact.year,
    itemId: fact.itemId,
    parentItemId: fact.parentItemId,
    level: fact.level,
    amountGel: fact.amountGel,
    basis: fact.basis,
    sourceId: fact.sourceId,
    officialLabelKa: fact.officialLabelKa,
    officialInstitutionLabelKa: fact.officialInstitutionLabelKa,
  };
}

async function loadLandingDataFromCsv(): Promise<LoadedLandingData> {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts),
    loadGlossary(SERVED_DATA_FILES.glossary),
    loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
  ]);

  return { facts, glossary, sourceDocuments };
}

async function loadExplorerDataFromCsv(): Promise<LoadedExplorerData> {
  const [landing, adminFacts, adminCategories] = await Promise.all([
    loadLandingDataFromCsv(),
    loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts),
    loadAdminSpendingCategoriesFile(SERVED_DATA_FILES.adminSpendingCategories),
  ]);

  return { ...landing, adminFacts: byYearAscending(adminFacts), adminCategories };
}

// The database is only served after proving it still matches the reviewed
// CSVs in this checkout, row by row. This catches a stale mirror (CSVs merged
// without re-running `npm run data:import`), any direct database edit, and
// any import mapping bug — the build fails loudly instead of serving drifted
// data.
function assertLandingParity(db: LoadedLandingData, csv: LoadedLandingData): void {
  assertSameServedRows("budget facts", csv.facts, db.facts, budgetFactParityKey);
  assertSameServedRows(
    "glossary entries",
    [...csv.glossary.values()],
    [...db.glossary.values()],
    (row) => row.id,
  );
  assertSameServedRows("source documents", csv.sourceDocuments, db.sourceDocuments, (row) => row.sourceId);
}

async function loadServedLandingDataUncached(): Promise<LoadedLandingData> {
  if (resolveServedDataSource() === "db") {
    const { loadLandingDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadLandingDataFromDb(), loadLandingDataFromCsv()]);
    assertLandingParity(db, csv);
    return db;
  }

  return loadLandingDataFromCsv();
}

async function loadServedExplorerDataUncached(): Promise<LoadedExplorerData> {
  if (resolveServedDataSource() === "db") {
    const { loadExplorerDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadExplorerDataFromDb(), loadExplorerDataFromCsv()]);
    assertLandingParity(db, csv);
    assertSameServedRows("admin spending facts", csv.adminFacts, db.adminFacts, adminFactParityKey);
    assertSameServedRows("admin spending categories", csv.adminCategories, db.adminCategories, (row) => row.id);
    return db;
  }

  return loadExplorerDataFromCsv();
}

// Build-time memo. Every route calls one of these, and generateMetadata calls
// again alongside its own page, so a build made 8 separate loads — each one
// re-parsing the CSVs, and in db mode re-running the whole row-by-row parity
// check. Caching the promise rather than the value also collapses concurrent
// callers onto one load, and the explorer dataset satisfies landing callers
// too, so a route that needs both pays for one load instead of two.
//
// Not `use cache`: that directive requires cacheComponents (node_modules/next/
// dist/docs/01-app/03-api-reference/01-directives/use-cache.md), which turns on
// PPR and dynamic-by-default rendering — the opposite of this project's fully
// static contract. Next's own guidance for non-fetch data sources is React
// `cache()` (…/02-guides/caching-without-cache-components.md), but that is
// scoped to a single render pass, so it would dedupe generateMetadata against
// its page and nothing more. A module-level promise covers that case and the
// cross-route one, which is what a static build needs.
//
// Safe because the site is fully static: these run only under `next build` and
// the tsx data scripts, both short-lived processes over immutable inputs, so
// there is no long-running server for the cache to go stale under. A rejection
// is cached too, which is what we want — the first parity failure is the build
// failure, and repeating it would only reprint the same error.
let landingDataPromise: Promise<LandingData> | null = null;
let explorerDataPromise: Promise<ExplorerData> | null = null;

// The memo would otherwise freeze the resolved data source for the life of the
// process, which is right for a build but wrong for a test file that switches
// GEODATA_DATA_SOURCE between cases: the first load would decide the mode for
// every later one and the rest would silently assert against cached data.
export function resetServedDataCacheForTests(): void {
  landingDataPromise = null;
  explorerDataPromise = null;
}

export function loadServedLandingData(): Promise<LandingData> {
  // ExplorerData is a superset of LandingData, so if the explorer load is
  // already in flight, reuse it rather than re-parsing the same CSVs and, in
  // db mode, running a second full parity pass over the same rows.
  landingDataPromise ??=
    explorerDataPromise ??
    loadServedLandingDataUncached().then((loaded) => ({
      ...loaded,
      facts: loaded.facts.map(toServedBudgetFact),
    }));
  return landingDataPromise;
}

export function loadServedExplorerData(): Promise<ExplorerData> {
  explorerDataPromise ??= loadServedExplorerDataUncached().then((loaded) => ({
    ...loaded,
    facts: loaded.facts.map(toServedBudgetFact),
    adminFacts: loaded.adminFacts.map(toServedAdminFact),
  }));
  // Later landing callers in this process reuse the superset.
  landingDataPromise ??= explorerDataPromise;
  return explorerDataPromise;
}
