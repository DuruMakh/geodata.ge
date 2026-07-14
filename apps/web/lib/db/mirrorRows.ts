import type { Prisma } from "../generated/prisma/client";
import type {
  AdminSpendingCategory,
  AdminSpendingFact,
} from "../data/adminSpending/types";
import type { GlossaryEntry } from "../data/glossary";
import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import type { SourceDocumentRow } from "../data/sources";

// Client-parameterized readers of the database mirror. They return exactly the
// same shapes as the CSV loaders. Used with the pooled singleton by the
// db-mode serving path (lib/db/servedDataDb.ts) and with the import's
// transaction client so the import can verify, before committing, that the
// serving path reproduces the CSV loaders row for row.
//
// PrismaClient is structurally assignable to Prisma.TransactionClient, so both
// callers share this type.
export type MirrorClient = Prisma.TransactionClient;

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

export async function loadBudgetFactsFromMirror(db: MirrorClient): Promise<BudgetFactImportRow[]> {
  const facts = await db.budgetFact.findMany({
    orderBy: [{ year: "asc" }, { side: "asc" }, { itemId: "asc" }, { basis: "asc" }],
  });

  if (facts.length === 0) {
    throw new Error(
      "The database has no budget facts. Run `npm run data:import` first, " +
        "or build with GEODATA_DATA_SOURCE=csv. If the import has already " +
        "succeeded, check the role in DATABASE_URL: the mirror tables use " +
        "row level security, which hides all rows from non-owner roles.",
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

export async function loadGlossaryFromMirror(db: MirrorClient): Promise<Map<string, GlossaryEntry>> {
  // sortOrder values repeat across the revenue and spending taxonomy files, so
  // a deterministic id tie-break keeps db builds reproducible.
  const items = await db.budgetItem.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
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

export async function loadSourceDocumentsFromMirror(db: MirrorClient): Promise<SourceDocumentRow[]> {
  const sources = await db.sourceDocument.findMany({ orderBy: { id: "asc" } });

  return sources.map((source) => ({
    sourceId: source.id,
    sourceName: source.sourceName,
    sourceUrlOrFile: source.sourceUrlOrFile,
    lastReviewedAt: isoDate(source.lastReviewedAt),
  }));
}

export async function loadAdminFactsFromMirror(db: MirrorClient): Promise<AdminSpendingFact[]> {
  const facts = await db.adminSpendingFact.findMany({
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

export async function loadAdminCategoriesFromMirror(
  db: MirrorClient,
): Promise<AdminSpendingCategory[]> {
  const categories = await db.adminSpendingCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return categories.map((category) => ({
    id: category.id,
    kaLabel: category.kaLabel,
    enLabel: category.enLabel,
    sortOrder: category.sortOrder,
  }));
}
