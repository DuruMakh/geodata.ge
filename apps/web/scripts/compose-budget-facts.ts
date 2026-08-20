import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { budgetFactsToCsv, type BudgetFactCsvRow } from "../lib/data/factCsv";
import { TOTAL_ONLY_BUDGET_FACTS, TOTAL_ONLY_BUDGET_FACT_REPORT } from "../lib/data/totalOnlyBudgetFacts";
import { EXPENDITURE_DETAILED_YEARS, EXPENDITURE_YEARS, REVENUE_TOTAL_ONLY_YEARS, REVENUE_YEARS } from "../lib/data/coverage";
import { loadBudgetFactRows, type BudgetFactImportRow } from "../lib/data/importBudgetFacts";

const expenditureYears = EXPENDITURE_YEARS;
const detailedExpenditureYears = EXPENDITURE_DETAILED_YEARS;
const revenueYears = REVENUE_YEARS;


function csvRowsToBudgetRows(rows: BudgetFactCsvRow[]): BudgetFactImportRow[] {
  return rows.map((row) => ({
    year: row.year,
    side: row.side,
    itemId: row.item_id,
    amountGel: Number(row.amount_gel),
    basis: row.basis,
    sourceId: row.source_id,
    officialInstitution: row.official_institution || null,
    officialProgram: row.official_program || null,
    officialSubprogram: row.official_subprogram || null,
    publicSpendingFieldId: row.public_spending_field_id || null,
    mappingConfidence: row.mapping_confidence === "" ? null : (row.mapping_confidence as BudgetFactImportRow["mappingConfidence"]),
    mappingNotes: row.mapping_notes,
  }));
}
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
      detailedExpenditureYears.map((year) =>
        loadBudgetFactRows(`../../data/imports/expenditure-facts-${year}-final.csv`),
      ),
    ),
    loadBudgetFactRows("../../data/imports/revenue-facts-2004-2025.csv"),
  ]);
  const expenditureRows = [
    ...csvRowsToBudgetRows(TOTAL_ONLY_BUDGET_FACTS.filter((row) => row.side === "expenditure")),
    ...expenditureRowsByYear.flat(),
  ];
  const rows = budgetRowsToCsvRows([...expenditureRows, ...revenueRows]);
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");
  const report = {
    importLabel: "budget-facts-2004-2025",
    expenditureYears,
    detailedExpenditureYears,
    revenueYears,
    expenditureRows: expenditureRows.length,
    revenueRows: revenueRows.length,
    totalRows: rows.length,
    totalOnlyRows: TOTAL_ONLY_BUDGET_FACT_REPORT.rows.filter((row) => row.side !== "revenue" || REVENUE_TOTAL_ONLY_YEARS.includes(row.year)),
  };

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(importsDir, "expenditure-facts-2004-2025.csv"),
    budgetFactsToCsv(budgetRowsToCsvRows(expenditureRows)),
    "utf8",
  );
  await writeFile(path.join(importsDir, "budget-facts-2004-2025.csv"), budgetFactsToCsv(rows), "utf8");
  await writeFile(path.join(reportsDir, "budget-facts-2004-2025-compose-report.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(`Composed budget fact rows: ${rows.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
