import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractOfficialRevenueRows } from "../lib/data/realRevenue/extractWorkbooks";
import type { OfficialRevenueRow } from "../lib/data/realRevenue/types";

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(rows: OfficialRevenueRow[]): string {
  const headers = [
    "year",
    "source_id",
    "workbook_path",
    "sheet_name",
    "row_number",
    "source_code",
    "label_ka",
    "section",
    "approved_plan_thousand_gel",
    "revised_plan_thousand_gel",
    "actual_thousand_gel",
    "execution_percent",
    "state_budget_actual_gel",
    "territorial_budget_actual_gel",
    "consolidated_actual_gel",
  ] as const;

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.year,
        row.sourceId,
        row.workbookPath,
        row.sheetName,
        row.rowNumber,
        row.sourceCode ?? "",
        row.labelKa,
        row.section,
        row.approvedPlanThousandGel,
        row.revisedPlanThousandGel,
        row.actualThousandGel,
        row.executionPercent,
        row.stateBudgetActualGel ?? "",
        row.territorialBudgetActualGel ?? "",
        row.consolidatedActualGel ?? "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
}

async function main() {
  const rows = await extractOfficialRevenueRows();
  const stagingDir = path.resolve(process.cwd(), "../../data/staging");

  await mkdir(stagingDir, { recursive: true });
  await writeFile(path.join(stagingDir, "revenue-official-rows-2005-2025.csv"), rowsToCsv(rows), "utf8");

  console.log(`Extracted official revenue rows: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
