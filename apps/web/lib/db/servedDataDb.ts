import type { AdminSpendingCategory, AdminSpendingFact } from "../data/adminSpending/types";
import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { SourceDocumentRow } from "../data/sources";
import type { ExplorerData, LandingData } from "../data/servedData";
import { prisma } from "./prisma";

// Database-backed loaders for GEODATA_DATA_SOURCE=db. They return exactly the
// same shapes as the CSV loaders; the database itself is populated from the
// reviewed CSVs by `npm run data:import`, which enforces exact parity.

// DATE columns come back as JS Dates whose midnight may be UTC or local
// depending on the driver's DATE parsing; pick whichever components the
// midnight sits on so the calendar date survives on any machine timezone.
function isoDate(value: Date): string {
  if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0) {
    return value.toISOString().slice(0, 10);
  }

  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadBudgetFactsFromDb(): Promise<BudgetFactImportRow[]> {
  const facts = await prisma.budgetFact.findMany({
    orderBy: [{ year: "asc" }, { side: "asc" }, { itemId: "asc" }, { basis: "asc" }],
  });

  if (facts.length === 0) {
    throw new Error(
      "The database has no budget facts. Run `npm run data:import` first, " +
        "or build with GEODATA_DATA_SOURCE=csv.",
    );
  }

  return facts.map((fact) => ({
    year: fact.year,
    side: fact.side,
    itemId: fact.itemId,
    amountGel: Number(fact.amountGel),
    basis: fact.basis,
    sourceId: fact.sourceDocumentId,
    officialInstitution: fact.officialInstitution,
    officialProgram: fact.officialProgram,
    officialSubprogram: fact.officialSubprogram,
    publicSpendingFieldId: fact.publicSpendingFieldId,
    mappingConfidence: fact.mappingConfidence,
    mappingNotes: fact.mappingNotes,
  }));
}

async function loadGlossaryFromDb(): Promise<Map<string, GlossaryEntry>> {
  const items = await prisma.budgetItem.findMany({ orderBy: { sortOrder: "asc" } });
  const glossary = new Map<string, GlossaryEntry>();

  for (const item of items) {
    glossary.set(item.id, {
      id: item.id,
      kaLabel: item.kaLabel,
      enLabel: item.enLabel,
      description: item.description,
      notes: item.notes,
    });
  }

  return glossary;
}

async function loadSourceDocumentsFromDb(): Promise<SourceDocumentRow[]> {
  const sources = await prisma.sourceDocument.findMany({ orderBy: { id: "asc" } });

  return sources.map((source) => ({
    sourceId: source.id,
    sourceName: source.sourceName,
    sourceUrlOrFile: source.sourceUrlOrFile,
    lastReviewedAt: isoDate(source.lastReviewedAt),
  }));
}

async function loadAdminFactsFromDb(): Promise<AdminSpendingFact[]> {
  const facts = await prisma.adminSpendingFact.findMany({
    orderBy: [{ year: "asc" }, { itemId: "asc" }],
  });

  return facts.map((fact) => {
    if (fact.basis !== "actual") {
      throw new Error(`Admin spending fact ${fact.id} must have basis=actual, got ${fact.basis}`);
    }

    return {
      year: fact.year,
      itemId: fact.itemId,
      parentItemId: fact.parentItemId,
      level: fact.level,
      amountGel: Number(fact.amountGel),
      basis: "actual" as const,
      sourceId: fact.sourceId,
      officialCode: fact.officialCode,
      officialLabelKa: fact.officialLabelKa,
      officialInstitutionCode: fact.officialInstitutionCode,
      officialInstitutionLabelKa: fact.officialInstitutionLabelKa,
      mappingConfidence: fact.mappingConfidence,
      mappingNotes: fact.mappingNotes,
    };
  });
}

async function loadAdminCategoriesFromDb(): Promise<AdminSpendingCategory[]> {
  const categories = await prisma.adminSpendingCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return categories.map((category) => ({
    id: category.id,
    kaLabel: category.kaLabel,
    enLabel: category.enLabel,
    sortOrder: category.sortOrder,
  }));
}

export async function loadLandingDataFromDb(): Promise<LandingData> {
  const [facts, glossary, sourceDocuments] = await Promise.all([
    loadBudgetFactsFromDb(),
    loadGlossaryFromDb(),
    loadSourceDocumentsFromDb(),
  ]);

  return { facts, glossary, sourceDocuments };
}

export async function loadExplorerDataFromDb(): Promise<ExplorerData> {
  const [landing, adminFacts, adminCategories] = await Promise.all([
    loadLandingDataFromDb(),
    loadAdminFactsFromDb(),
    loadAdminCategoriesFromDb(),
  ]);

  return { ...landing, adminFacts, adminCategories };
}
