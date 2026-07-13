import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client";
import { loadAdminSpendingCategoriesFile } from "../lib/data/adminSpending/categoriesFile";
import { loadAdminSpendingFacts } from "../lib/data/adminSpending/importAdminSpendingFacts";
import { validateFoundationReferences } from "../lib/data/foundationValidation";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";
import { loadSpendingMappings } from "../lib/data/mappings";
import {
  buildParityReport,
  buildTotalsByKey,
  formatParityReport,
  type ParityReport,
} from "../lib/data/parityReport";
import { SERVED_DATA_FILES } from "../lib/data/servedData";
import { loadSourceDocuments } from "../lib/data/sources";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";

const IMPORT_LABEL = "real-budget-2004-2025";
const TAXONOMY_DIR = "../../data/taxonomy";
const MAPPINGS_FILE = "../../data/mappings/spending-field-mapping.csv";

class ParityFailedError extends Error {
  constructor(readonly parity: ParityReport) {
    super("Parity check FAILED: database would not match the reviewed CSVs.");
  }
}

function assertSubset(label: string, values: Iterable<string>, allowed: Set<string>): void {
  const missing = [...new Set(values)].filter((value) => !allowed.has(value));
  if (missing.length > 0) {
    throw new Error(`${label} not found in reference data: ${missing.join(", ")}`);
  }
}

function assertUnique(label: string, keys: string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(`Duplicate ${label}: ${key}`);
    }
    seen.add(key);
  }
}

// amountGel columns are Decimal(18, 2); anything with more precision would be
// silently rounded by Postgres, breaking the row-level CSV<->DB identity.
function assertAmountPrecision(label: string, rows: { amountGel: number }[]): void {
  for (const row of rows) {
    if (new Decimal(row.amountGel).decimalPlaces() > 2) {
      throw new Error(`${label} amount has more than 2 decimal places: ${row.amountGel}`);
    }
  }
}

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "No database configured. Create apps/web/.env with DATABASE_URL and DIRECT_URL " +
        "(see apps/web/.env.example) before running npm run data:import.",
    );
  }

  // Load every served dataset through the same validated loaders the site uses.
  const [taxonomy, glossary, adminCategories, sourceDocuments, mappings, budgetFacts, adminFacts] =
    await Promise.all([
      loadTaxonomyFiles(TAXONOMY_DIR),
      loadGlossary(SERVED_DATA_FILES.glossary),
      loadAdminSpendingCategoriesFile(SERVED_DATA_FILES.adminSpendingCategories),
      loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
      loadSpendingMappings(MAPPINGS_FILE),
      loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts),
      loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts),
    ]);

  // Same reference validation the site's data pipeline uses (allows explicit
  // revenue.total / expenditure.total fact rows), plus the checks specific to
  // the datasets this import adds on top.
  validateFoundationReferences({ taxonomy, sources: sourceDocuments, mappings, facts: budgetFacts });

  const taxonomyIds = new Set(taxonomy.map((item) => item.id));
  const glossaryIds = new Set(glossary.keys());
  const adminCategoryIds = new Set(adminCategories.map((category) => category.id));
  const sourceIds = new Set(sourceDocuments.map((source) => source.sourceId));

  assertSubset("Glossary IDs", glossaryIds, taxonomyIds);
  assertSubset("Taxonomy IDs missing glossary entries", taxonomyIds, glossaryIds);
  // Admin source IDs may be `;`-joined multi-source values (same contract as
  // scripts/validate-data-files.ts).
  assertSubset(
    "Admin fact source IDs",
    adminFacts.flatMap((fact) => fact.sourceId.split(";")),
    sourceIds,
  );
  assertSubset(
    "Admin category fact item IDs",
    adminFacts.filter((fact) => fact.level === "admin_category").map((fact) => fact.itemId),
    adminCategoryIds,
  );
  assertSubset(
    "Admin major program parent IDs",
    adminFacts.flatMap((fact) => (fact.parentItemId ? [fact.parentItemId] : [])),
    adminCategoryIds,
  );
  assertUnique(
    "budget fact natural key",
    budgetFacts.map((fact) => `${fact.year}:${fact.side}:${fact.itemId}:${fact.basis}`),
  );
  assertUnique("admin fact natural key", adminFacts.map((fact) => `${fact.year}:${fact.itemId}`));
  assertAmountPrecision("Budget fact", budgetFacts);
  assertAmountPrecision("Admin fact", adminFacts);

  const report = buildImportReport(IMPORT_LABEL, budgetFacts);

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const budgetTotalsCsv = buildTotalsByKey(
    budgetFacts.map((fact) => ({ key: `${fact.year}:${fact.side}`, amountGel: fact.amountGel })),
  );
  const adminTotalsCsv = buildTotalsByKey(
    adminFacts.map((fact) => ({ key: `${fact.year}:${fact.level}`, amountGel: fact.amountGel })),
  );

  try {
    // Wipe-and-reload in one transaction: the database is a mirror of the
    // reviewed CSVs, never an editing surface. Parity is verified INSIDE the
    // transaction — on any mismatch everything rolls back and the previous
    // mirror stays untouched. Re-running is always safe.
    const { importRunId, parity } = await prisma.$transaction(
      async (tx) => {
        await tx.budgetFact.deleteMany();
        await tx.adminSpendingFact.deleteMany();
        await tx.budgetMapping.deleteMany();
        await tx.budgetItem.deleteMany();
        await tx.adminSpendingCategory.deleteMany();
        await tx.sourceDocument.deleteMany();

        await tx.sourceDocument.createMany({
          data: sourceDocuments.map((source) => ({
            id: source.sourceId,
            sourceName: source.sourceName,
            sourceUrlOrFile: source.sourceUrlOrFile,
            lastReviewedAt: new Date(`${source.lastReviewedAt}T00:00:00.000Z`),
          })),
        });

        await tx.budgetItem.createMany({
          data: taxonomy.map((item) => {
            const glossaryEntry = glossary.get(item.id)!;
            return {
              id: item.id,
              side: item.side,
              level: item.level,
              kaLabel: item.kaLabel,
              enLabel: item.enLabel,
              sortOrder: item.sortOrder,
              description: glossaryEntry.description,
              notes: glossaryEntry.notes,
            };
          }),
        });

        await tx.adminSpendingCategory.createMany({
          data: adminCategories.map((category) => ({
            id: category.id,
            kaLabel: category.kaLabel,
            enLabel: category.enLabel,
            sortOrder: category.sortOrder,
          })),
        });

        const run = await tx.importRun.create({
          data: {
            importLabel: report.importLabel,
            rowsRead: report.rowsRead,
            rowsImported: report.rowsImported,
            totalRevenueGel: String(report.totalRevenueGel),
            totalExpenditureGel: String(report.totalExpenditureGel),
            unclassifiedAmountGel: String(report.unclassifiedAmountGel),
            unclassifiedShare: report.unclassifiedShare.toFixed(6),
            plannedRows: report.plannedRows,
            actualRows: report.actualRows,
            reconciliationStatus: report.reconciliationStatus,
            warningsJson: report.warnings,
            reportJson: {},
          },
        });

        await tx.budgetFact.createMany({
          data: budgetFacts.map((fact) => ({
            id: `${fact.year}:${fact.side}:${fact.itemId}:${fact.basis}`,
            year: fact.year,
            side: fact.side,
            itemId: fact.itemId,
            amountGel: String(fact.amountGel),
            basis: fact.basis,
            sourceDocumentId: fact.sourceId,
            importRunId: run.id,
            officialInstitution: fact.officialInstitution,
            officialProgram: fact.officialProgram,
            officialSubprogram: fact.officialSubprogram,
            publicSpendingFieldId: fact.publicSpendingFieldId,
            mappingConfidence: fact.mappingConfidence,
            mappingNotes: fact.mappingNotes,
          })),
        });

        await tx.adminSpendingFact.createMany({
          data: adminFacts.map((fact) => ({
            id: `${fact.year}:${fact.itemId}`,
            year: fact.year,
            itemId: fact.itemId,
            parentItemId: fact.parentItemId,
            level: fact.level,
            amountGel: String(fact.amountGel),
            basis: fact.basis,
            sourceId: fact.sourceId,
            importRunId: run.id,
            officialCode: fact.officialCode,
            officialLabelKa: fact.officialLabelKa,
            officialInstitutionCode: fact.officialInstitutionCode,
            officialInstitutionLabelKa: fact.officialInstitutionLabelKa,
            mappingConfidence: fact.mappingConfidence,
            mappingNotes: fact.mappingNotes,
          })),
        });

        await tx.budgetMapping.createMany({
          data: mappings.map((mapping) => ({
            year: mapping.year,
            officialInstitution: mapping.officialInstitution,
            officialProgram: mapping.officialProgram,
            officialSubprogram: mapping.officialSubprogram,
            publicSpendingFieldId: mapping.publicSpendingFieldId,
            confidence: mapping.mappingConfidence,
            notes: mapping.mappingNotes,
          })),
        });

        // Parity verification against what this transaction is about to commit.
        const [
          dbBudgetFacts,
          dbAdminFacts,
          dbItems,
          dbAdminCategories,
          dbSources,
          dbMappings,
          dbBudgetTotals,
          dbAdminTotals,
        ] = await Promise.all([
          tx.budgetFact.count(),
          tx.adminSpendingFact.count(),
          tx.budgetItem.count(),
          tx.adminSpendingCategory.count(),
          tx.sourceDocument.count(),
          tx.budgetMapping.count(),
          tx.budgetFact.groupBy({ by: ["year", "side"], _sum: { amountGel: true } }),
          tx.adminSpendingFact.groupBy({ by: ["year", "level"], _sum: { amountGel: true } }),
        ]);

        const parityInTx = buildParityReport({
          counts: [
            { table: "BudgetFact", csvRows: budgetFacts.length, dbRows: dbBudgetFacts },
            { table: "AdminSpendingFact", csvRows: adminFacts.length, dbRows: dbAdminFacts },
            { table: "BudgetItem", csvRows: taxonomy.length, dbRows: dbItems },
            {
              table: "AdminSpendingCategory",
              csvRows: adminCategories.length,
              dbRows: dbAdminCategories,
            },
            { table: "SourceDocument", csvRows: sourceDocuments.length, dbRows: dbSources },
            { table: "BudgetMapping", csvRows: mappings.length, dbRows: dbMappings },
          ],
          budgetTotalsCsv,
          budgetTotalsDb: buildTotalsByKey(
            dbBudgetTotals.map((group) => ({
              key: `${group.year}:${group.side}`,
              amountGel: group._sum.amountGel?.toFixed(2) ?? "0",
            })),
          ),
          adminTotalsCsv,
          adminTotalsDb: buildTotalsByKey(
            dbAdminTotals.map((group) => ({
              key: `${group.year}:${group.level}`,
              amountGel: group._sum.amountGel?.toFixed(2) ?? "0",
            })),
          ),
        });

        if (parityInTx.status !== "passed") {
          throw new ParityFailedError(parityInTx);
        }

        await tx.importRun.update({
          where: { id: run.id },
          data: { reportJson: parityInTx as unknown as Prisma.InputJsonValue },
        });

        return { importRunId: run.id, parity: parityInTx };
      },
      { timeout: 120_000 },
    );

    await writeParityReport(importRunId, report, parity);
    console.log(formatParityReport(parity));
    console.log("");
    console.log(`Import run: ${importRunId}`);
    console.log("Import complete. Database matches the reviewed CSVs exactly.");
  } catch (error) {
    if (error instanceof ParityFailedError) {
      await writeParityReport(null, report, error.parity);
      console.error(formatParityReport(error.parity));
      console.error("");
      console.error(
        "Parity check FAILED — the transaction was rolled back and the previous " +
          "database state is untouched.",
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function writeParityReport(
  importRunId: string | null,
  importReport: unknown,
  parity: ParityReport,
): Promise<void> {
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");
  await mkdir(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, "db-import-parity.json");
  await writeFile(
    reportPath,
    JSON.stringify({ importLabel: IMPORT_LABEL, importRunId, importReport, parity }, null, 2),
    "utf8",
  );
  console.log(`Full report written to ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
