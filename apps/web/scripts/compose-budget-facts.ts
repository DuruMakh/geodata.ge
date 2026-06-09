import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { budgetFactsToCsv, type BudgetFactCsvRow } from "../lib/data/factCsv";
import { loadBudgetFactRows, type BudgetFactImportRow } from "../lib/data/importBudgetFacts";

const expenditureYears = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const revenueYears = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

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
  const [expenditureRowsByYear, revenueRows] = await Promise.all([
    Promise.all(
      expenditureYears.map((year) =>
        loadBudgetFactRows(`../../data/imports/expenditure-facts-${year}-final.csv`),
      ),
    ),
    loadBudgetFactRows("../../data/imports/revenue-facts-2017-2025.csv"),
  ]);
  const expenditureRows = expenditureRowsByYear.flat();
  const rows = budgetRowsToCsvRows([...expenditureRows, ...revenueRows]);
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");
  const report = {
    importLabel: "budget-facts-2017-2025",
    expenditureYears,
    revenueYears,
    expenditureRows: expenditureRows.length,
    revenueRows: revenueRows.length,
    totalRows: rows.length,
  };

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(importsDir, "expenditure-facts-2017-2025.csv"),
    budgetFactsToCsv(budgetRowsToCsvRows(expenditureRows)),
    "utf8",
  );
  await writeFile(path.join(importsDir, "budget-facts-2017-2025.csv"), budgetFactsToCsv(rows), "utf8");
  await writeFile(path.join(reportsDir, "budget-facts-2017-2025-compose-report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`Composed budget fact rows: ${rows.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
