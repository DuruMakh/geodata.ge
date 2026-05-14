import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { budgetFactsToCsv, type BudgetFactCsvRow } from "../lib/data/factCsv";
import { loadBudgetFactRows, type BudgetFactImportRow } from "../lib/data/importBudgetFacts";

export function budgetRowsToCsvRows(rows: BudgetFactImportRow[]): BudgetFactCsvRow[] {
  return rows
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.side !== b.side) return a.side.localeCompare(b.side);
      return a.itemId.localeCompare(b.itemId);
    })
    .map((row) => ({
      year: row.year,
      side: row.side,
      item_id: row.itemId,
      amount_gel: String(row.amountGel),
      basis: row.basis,
      source_id: row.sourceId,
      official_institution: row.officialInstitution ?? "",
      official_program: row.officialProgram ?? "",
      official_subprogram: row.officialSubprogram ?? "",
      public_spending_field_id: row.publicSpendingFieldId ?? "",
      mapping_confidence: row.mappingConfidence ?? "",
      mapping_notes: row.mappingNotes,
    }));
}

async function main() {
  const [expenditureRows, revenueRows] = await Promise.all([
    loadBudgetFactRows("../../data/imports/expenditure-facts-2023-2025.csv"),
    loadBudgetFactRows("../../data/imports/revenue-facts-2023-2025.csv"),
  ]);
  const rows = budgetRowsToCsvRows([...expenditureRows, ...revenueRows]);
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");
  const report = {
    importLabel: "budget-facts-2023-2025",
    expenditureRows: expenditureRows.length,
    revenueRows: revenueRows.length,
    totalRows: rows.length,
  };

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "budget-facts-2023-2025.csv"), budgetFactsToCsv(rows), "utf8");
  await writeFile(path.join(reportsDir, "budget-facts-2023-2025-compose-report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`Composed budget fact rows: ${rows.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
