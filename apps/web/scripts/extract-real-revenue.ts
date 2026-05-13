import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractOfficialRevenueRows } from "../lib/data/realRevenue/extractWorkbooks";

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(rows: ReturnType<typeof extractOfficialRevenueRows>): string {
  const headers = [
    "year",
    "source_id",
    "workbook_path",
    "sheet_name",
    "row_number",
    "label_ka",
    "section",
    "approved_plan_thousand_gel",
    "revised_plan_thousand_gel",
    "actual_thousand_gel",
    "execution_percent",
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
        row.labelKa,
        row.section,
        row.approvedPlanThousandGel,
        row.revisedPlanThousandGel,
        row.actualThousandGel,
        row.executionPercent,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
}

async function main() {
  const rows = extractOfficialRevenueRows();
  const stagingDir = path.resolve(process.cwd(), "../../data/staging");

  await mkdir(stagingDir, { recursive: true });
  await writeFile(path.join(stagingDir, "revenue-official-rows-2023-2025.csv"), rowsToCsv(rows), "utf8");

  console.log(`Extracted official revenue rows: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
