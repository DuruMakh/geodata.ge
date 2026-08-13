import { config as loadEnv } from "dotenv";
import { mkdir, rm, writeFile } from "node:fs/promises";
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
import { loadNationalGdpFacts } from "../lib/data/nationalGdp/importNationalGdp";
import { loadMunicipalitiesFile } from "../lib/data/municipal/municipalitiesFile";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../lib/data/municipal/importMunicipalFacts";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "../lib/data/municipal/taxonomyFiles";
import {
  buildParityReport,
  buildTotalsByKey,
  formatParityReport,
  type ParityReport,
} from "../lib/data/parityReport";
import { SERVED_DATA_FILES } from "../lib/data/servedData";
import {
  adminFactParityKey,
  assertSameServedRows,
  budgetFactParityKey,
  municipalFunctionFactParityKey,
  municipalTotalFactParityKey,
  nationalGdpFactParityKey,
} from "../lib/data/servedDataParity";
import { loadSourceDocuments } from "../lib/data/sources";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";
import {
  loadAdminCategoriesFromMirror,
  loadAdminFactsFromMirror,
  loadBudgetFactsFromMirror,
  loadGlossaryFromMirror,
  loadMunicipalFunctionFactsFromMirror,
  loadMunicipalFunctionsFromMirror,
  loadMunicipalitiesFromMirror,
  loadMunicipalRegionsFromMirror,
  loadMunicipalTotalFactsFromMirror,
  loadNationalGdpFactsFromMirror,
  loadSourceDocumentsFromMirror,
} from "../lib/db/mirrorRows";

// Match Next.js env-file precedence for the variables this script needs:
// shell env wins, then .env.local, then .env (dotenv never overrides).
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const IMPORT_LABEL = "real-budget-2005-2025";
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

// Fixed audit columns must be exact 2-decimal values; float sums may carry
// stray precision that Decimal(18, 2) would otherwise round silently.
function gelColumn(value: number): string {
  return new Decimal(value).toFixed(2);
}

async function main() {
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    console.warn(
      "DIRECT_URL is not set — falling back to the pooled DATABASE_URL for the " +
        "import transaction. This is slower and exposed to pooler timeouts; " +
        "set DIRECT_URL (port 5432) as in apps/web/.env.example.",
    );
  }
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "No database configured. Create apps/web/.env with DATABASE_URL and DIRECT_URL " +
        "(see apps/web/.env.example) before running npm run data:import.",
    );
  }

  // A stale report from an earlier run must not outlive it: remove it now so a
  // run that dies mid-way leaves no report rather than the previous PASSED one.
  await rm(reportPath(), { force: true });

  // Load every served dataset through the same validated loaders the site uses.
  const [
    taxonomy,
    glossary,
    adminCategories,
    sourceDocuments,
    mappings,
    budgetFacts,
    adminFacts,
    municipalFunctions,
    municipalRegions,
    municipalities,
    municipalFunctionFacts,
    municipalTotalFacts,
    nationalGdpFacts,
  ] = await Promise.all([
    loadTaxonomyFiles(TAXONOMY_DIR),
    loadGlossary(SERVED_DATA_FILES.glossary),
    loadAdminSpendingCategoriesFile(SERVED_DATA_FILES.adminSpendingCategories),
    loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
    loadSpendingMappings(MAPPINGS_FILE),
    loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts),
    loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts),
    loadMunicipalFunctionsFile(SERVED_DATA_FILES.municipalFunctions),
    loadMunicipalRegionsFile(SERVED_DATA_FILES.municipalRegions),
    loadMunicipalitiesFile(SERVED_DATA_FILES.municipalities),
    loadMunicipalFunctionFacts(SERVED_DATA_FILES.municipalFunctionFacts),
    loadMunicipalTotalFacts(SERVED_DATA_FILES.municipalTotalFacts),
    loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts),
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
  // BudgetItem stores one label set serving both files, so taxonomy and
  // glossary labels must agree — otherwise the mirror can only ever match one
  // of the two and every db-mode build would fail with no import error.
  for (const item of taxonomy) {
    const glossaryEntry = glossary.get(item.id)!;
    if (glossaryEntry.kaLabel !== item.kaLabel || glossaryEntry.enLabel !== item.enLabel) {
      throw new Error(
        `Labels for ${item.id} differ between data/taxonomy (${item.kaLabel} / ${item.enLabel}) ` +
          `and data/glossary/category-glossary.csv (${glossaryEntry.kaLabel} / ${glossaryEntry.enLabel}). ` +
          "Align the two files before importing.",
      );
    }
  }
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
  assertUnique("budget fact natural key", budgetFacts.map(budgetFactParityKey));
  assertUnique("admin fact natural key", adminFacts.map(adminFactParityKey));
  assertSubset("National GDP fact source IDs", nationalGdpFacts.map((fact) => fact.sourceId), sourceIds);
  assertUnique("national GDP fact natural key", nationalGdpFacts.map(nationalGdpFactParityKey));
  assertAmountPrecision("Budget fact", budgetFacts);
  assertAmountPrecision("Admin fact", adminFacts);
  assertAmountPrecision(
    "National GDP fact",
    nationalGdpFacts.map((fact) => ({ amountGel: fact.gdpCurrentPricesGel })),
  );

  const municipalRegionIds = new Set(municipalRegions.map((region) => region.id));
  const municipalCategoryIds = new Set(municipalFunctions.map((entry) => entry.id));
  const municipalityCodes = new Set(municipalities.map((row) => row.code));

  assertSubset("Municipality region IDs", municipalities.map((row) => row.regionId), municipalRegionIds);
  assertSubset("Municipal fact category IDs", municipalFunctionFacts.map((fact) => fact.categoryId), municipalCategoryIds);
  assertSubset(
    "Municipal fact municipality codes",
    [...municipalFunctionFacts, ...municipalTotalFacts].map((fact) => fact.municipalityCode),
    municipalityCodes,
  );
  assertSubset(
    "Municipal fact source IDs",
    [...municipalFunctionFacts, ...municipalTotalFacts].map((fact) => fact.sourceId),
    sourceIds,
  );
  assertUnique("municipal function fact natural key", municipalFunctionFacts.map(municipalFunctionFactParityKey));
  assertUnique("municipal total fact natural key", municipalTotalFacts.map(municipalTotalFactParityKey));
  assertAmountPrecision("Municipal function fact", municipalFunctionFacts);

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
        await tx.nationalGdpFact.deleteMany();
        await tx.budgetMapping.deleteMany();
        await tx.budgetItem.deleteMany();
        await tx.adminSpendingCategory.deleteMany();
        await tx.municipalFunctionFact.deleteMany();
        await tx.municipalTotalFact.deleteMany();
        await tx.municipality.deleteMany();
        await tx.municipalRegion.deleteMany();
        await tx.municipalFunctionCategory.deleteMany();
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

        await tx.municipalRegion.createMany({
          data: municipalRegions.map((region) => ({
            id: region.id,
            kaLabel: region.kaLabel,
            sortOrder: region.sortOrder,
          })),
        });

        await tx.municipalFunctionCategory.createMany({
          data: municipalFunctions.map((entry) => ({
            id: entry.id,
            kaLabel: entry.kaLabel,
            functionalCode: entry.functionalCode,
            sortOrder: entry.sortOrder,
          })),
        });

        await tx.municipality.createMany({
          data: municipalities.map((row) => ({
            code: row.code,
            sortId: row.sortId,
            nameKa: row.nameKa,
            displayNameKa: row.displayNameKa,
            regionId: row.regionId,
            isSelfGoverningCity: row.isSelfGoverningCity,
          })),
        });

        await tx.municipalFunctionFact.createMany({
          data: municipalFunctionFacts.map((fact) => ({
            id: municipalFunctionFactParityKey(fact),
            year: fact.year,
            municipalityCode: fact.municipalityCode,
            categoryId: fact.categoryId,
            functionalCode: fact.functionalCode,
            amountGel: fact.amountGel,
            basis: fact.basis,
            sourceId: fact.sourceId,
          })),
        });

        await tx.municipalTotalFact.createMany({
          data: municipalTotalFacts.map((total) => ({
            id: municipalTotalFactParityKey(total),
            year: total.year,
            municipalityCode: total.municipalityCode,
            publicTotalGel: total.publicTotalGel,
            publicTotalMeasure: total.publicTotalMeasure,
            totalPaymentsGel: total.totalPaymentsGel,
            expensesGel: total.expensesGel,
            nonfinancialAssetGrowthGel: total.nonfinancialAssetGrowthGel,
            financialAssetGrowthGel: total.financialAssetGrowthGel,
            liabilityDecreaseGel: total.liabilityDecreaseGel,
            functionalSumGel: total.functionalSumGel,
            reconciliationDifferenceGel: total.reconciliationDifferenceGel,
            warningAmountGel: total.warningAmountGel,
            showWarning: total.showWarning,
            warningType: total.warningType,
            basis: total.basis,
            sourceId: total.sourceId,
          })),
        });

        const run = await tx.importRun.create({
          data: {
            importLabel: report.importLabel,
            rowsRead: report.rowsRead,
            rowsImported: report.rowsImported,
            totalRevenueGel: gelColumn(report.totalRevenueGel),
            totalExpenditureGel: gelColumn(report.totalExpenditureGel),
            unclassifiedAmountGel: gelColumn(report.unclassifiedAmountGel),
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
            id: budgetFactParityKey(fact),
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
            id: adminFactParityKey(fact),
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

        await tx.nationalGdpFact.createMany({
          data: nationalGdpFacts.map((fact) => ({
            year: fact.year,
            gdpCurrentPricesGel: String(fact.gdpCurrentPricesGel),
            accountingStandard: fact.accountingStandard,
            status: fact.status,
            sourceDocumentId: fact.sourceId,
            sourceSheet: fact.sourceSheet,
            sourceCell: fact.sourceCell,
            sourceUnit: fact.sourceUnit,
            transformation: fact.transformation,
            lastReviewedAt: new Date(`${fact.lastReviewedAt}T00:00:00.000Z`),
            importRunId: run.id,
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

        // Row-level verification INSIDE the transaction, through the exact
        // read path db-mode builds use: the import only commits if the serving
        // path reproduces every CSV loader row field for field. A mapping bug
        // in any column rolls the whole import back.
        const [
          mirrorFacts,
          mirrorGlossary,
          mirrorSources,
          mirrorAdminFacts,
          mirrorAdminCategories,
          mirrorNationalGdpFacts,
        ] =
          await Promise.all([
            loadBudgetFactsFromMirror(tx),
            loadGlossaryFromMirror(tx),
            loadSourceDocumentsFromMirror(tx),
            loadAdminFactsFromMirror(tx),
            loadAdminCategoriesFromMirror(tx),
            loadNationalGdpFactsFromMirror(tx),
          ]);

        const [
          mirrorMunicipalFunctions,
          mirrorMunicipalRegions,
          mirrorMunicipalities,
          mirrorMunicipalFunctionFacts,
          mirrorMunicipalTotalFacts,
        ] = await Promise.all([
          loadMunicipalFunctionsFromMirror(tx),
          loadMunicipalRegionsFromMirror(tx),
          loadMunicipalitiesFromMirror(tx),
          loadMunicipalFunctionFactsFromMirror(tx),
          loadMunicipalTotalFactsFromMirror(tx),
        ]);

        assertSameServedRows("budget facts", budgetFacts, mirrorFacts, budgetFactParityKey);
        assertSameServedRows(
          "glossary entries",
          [...glossary.values()],
          [...mirrorGlossary.values()],
          (row) => row.id,
        );
        assertSameServedRows("source documents", sourceDocuments, mirrorSources, (row) => row.sourceId);
        assertSameServedRows("admin spending facts", adminFacts, mirrorAdminFacts, adminFactParityKey);
        assertSameServedRows(
          "national GDP facts",
          nationalGdpFacts,
          mirrorNationalGdpFacts,
          nationalGdpFactParityKey,
        );
        assertSameServedRows(
          "admin spending categories",
          adminCategories,
          mirrorAdminCategories,
          (row) => row.id,
        );
        assertSameServedRows(
          "municipal functions",
          municipalFunctions,
          mirrorMunicipalFunctions,
          (row) => row.id,
        );
        assertSameServedRows(
          "municipal regions",
          municipalRegions,
          mirrorMunicipalRegions,
          (row) => row.id,
        );
        assertSameServedRows(
          "municipalities",
          municipalities,
          mirrorMunicipalities,
          (row) => row.code,
        );
        assertSameServedRows(
          "municipal function facts",
          municipalFunctionFacts,
          mirrorMunicipalFunctionFacts,
          municipalFunctionFactParityKey,
        );
        assertSameServedRows(
          "municipal total facts",
          municipalTotalFacts,
          mirrorMunicipalTotalFacts,
          municipalTotalFactParityKey,
        );

        // Totals parity for the human-readable report; counts come from the
        // row-level readback above, GEL sums from the database's own Decimal
        // aggregation to prove storage fidelity.
        const [dbBudgetTotals, dbAdminTotals, dbMappings] = await Promise.all([
          tx.budgetFact.groupBy({ by: ["year", "side"], _sum: { amountGel: true } }),
          tx.adminSpendingFact.groupBy({ by: ["year", "level"], _sum: { amountGel: true } }),
          tx.budgetMapping.count(),
        ]);

        const parityInTx = buildParityReport({
          counts: [
            { table: "BudgetFact", csvRows: budgetFacts.length, dbRows: mirrorFacts.length },
            { table: "AdminSpendingFact", csvRows: adminFacts.length, dbRows: mirrorAdminFacts.length },
            {
              table: "NationalGdpFact",
              csvRows: nationalGdpFacts.length,
              dbRows: mirrorNationalGdpFacts.length,
            },
            { table: "BudgetItem", csvRows: taxonomy.length, dbRows: mirrorGlossary.size },
            {
              table: "AdminSpendingCategory",
              csvRows: adminCategories.length,
              dbRows: mirrorAdminCategories.length,
            },
            { table: "SourceDocument", csvRows: sourceDocuments.length, dbRows: mirrorSources.length },
            { table: "BudgetMapping", csvRows: mappings.length, dbRows: dbMappings },
            {
              table: "MunicipalFunctionCategory",
              csvRows: municipalFunctions.length,
              dbRows: mirrorMunicipalFunctions.length,
            },
            {
              table: "MunicipalRegion",
              csvRows: municipalRegions.length,
              dbRows: mirrorMunicipalRegions.length,
            },
            { table: "Municipality", csvRows: municipalities.length, dbRows: mirrorMunicipalities.length },
            {
              table: "MunicipalFunctionFact",
              csvRows: municipalFunctionFacts.length,
              dbRows: mirrorMunicipalFunctionFacts.length,
            },
            {
              table: "MunicipalTotalFact",
              csvRows: municipalTotalFacts.length,
              dbRows: mirrorMunicipalTotalFacts.length,
            },
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
      // maxWait: opening the transaction needs a round-trip to the pooler,
      // which can take several seconds from far-away regions.
      { maxWait: 30_000, timeout: 120_000 },
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

function reportPath(): string {
  return path.resolve(process.cwd(), "../../data/reports/db-import-parity.json");
}

async function writeParityReport(
  importRunId: string | null,
  importReport: unknown,
  parity: ParityReport,
): Promise<void> {
  await mkdir(path.dirname(reportPath()), { recursive: true });
  await writeFile(
    reportPath(),
    JSON.stringify({ importLabel: IMPORT_LABEL, importRunId, importReport, parity }, null, 2),
    "utf8",
  );
  console.log(`Full report written to ${reportPath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
