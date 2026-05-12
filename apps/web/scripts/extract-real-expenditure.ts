import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateCandidateMappings } from "../lib/data/realExpenditure/candidateMapping";
import { extractOfficialExpenditureRows } from "../lib/data/realExpenditure/extractWorkbooks";

function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, string | number | boolean | null>>): string {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? null)).join(",")),
  ].join("\n");
}

async function main() {
  const officialRows = extractOfficialExpenditureRows();
  const candidateMappings = generateCandidateMappings(officialRows);
  const stagingDir = path.resolve(process.cwd(), "../../data/staging");
  const reviewDir = path.resolve(process.cwd(), "../../data/mappings/review");

  await mkdir(stagingDir, { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  await writeFile(
    path.join(stagingDir, "expenditure-official-rows-2023-2025.csv"),
    rowsToCsv(
      [
        "year",
        "source_id",
        "workbook_path",
        "sheet_name",
        "row_number",
        "code",
        "parent_code",
        "depth",
        "institution_code",
        "institution_label_ka",
        "program_code",
        "program_label_ka",
        "subprogram_code",
        "subprogram_label_ka",
        "is_total",
        "is_coded_row",
        "is_leaf_code",
        "label_ka",
        "approved_plan_thousand_gel",
        "revised_plan_thousand_gel",
        "actual_thousand_gel",
        "execution_percent",
      ],
      officialRows.map((row) => ({
        year: row.year,
        source_id: row.sourceId,
        workbook_path: row.workbookPath,
        sheet_name: row.sheetName,
        row_number: row.rowNumber,
        code: row.code,
        parent_code: row.parentCode,
        depth: row.depth,
        institution_code: row.institutionCode,
        institution_label_ka: row.institutionLabelKa,
        program_code: row.programCode,
        program_label_ka: row.programLabelKa,
        subprogram_code: row.subprogramCode,
        subprogram_label_ka: row.subprogramLabelKa,
        is_total: row.isTotal,
        is_coded_row: row.isCodedRow,
        is_leaf_code: row.isLeafCode,
        label_ka: row.labelKa,
        approved_plan_thousand_gel: row.approvedPlanThousandGel,
        revised_plan_thousand_gel: row.revisedPlanThousandGel,
        actual_thousand_gel: row.actualThousandGel,
        execution_percent: row.executionPercent,
      })),
    ),
    "utf8",
  );

  await writeFile(
    path.join(reviewDir, "spending-field-mapping-review-2023-2025.csv"),
    rowsToCsv(
      [
        "year",
        "code",
        "parent_code",
        "depth",
        "institution_code",
        "institution_label_ka",
        "program_code",
        "program_label_ka",
        "subprogram_code",
        "subprogram_label_ka",
        "label_ka",
        "actual_gel",
        "suggested_public_spending_field_id",
        "mapping_confidence",
        "mapping_reason",
        "reviewed_public_spending_field_id",
        "review_notes",
      ],
      candidateMappings.map((mapping) => ({
        year: mapping.year,
        code: mapping.code,
        parent_code: mapping.parentCode,
        depth: mapping.depth,
        institution_code: mapping.institutionCode,
        institution_label_ka: mapping.institutionLabelKa,
        program_code: mapping.programCode,
        program_label_ka: mapping.programLabelKa,
        subprogram_code: mapping.subprogramCode,
        subprogram_label_ka: mapping.subprogramLabelKa,
        label_ka: mapping.labelKa,
        actual_gel: mapping.actualGel,
        suggested_public_spending_field_id: mapping.suggestedPublicSpendingFieldId,
        mapping_confidence: mapping.mappingConfidence,
        mapping_reason: mapping.mappingReason,
        reviewed_public_spending_field_id: mapping.reviewedPublicSpendingFieldId,
        review_notes: mapping.reviewNotes,
      })),
    ),
    "utf8",
  );

  console.log(`Extracted official rows: ${officialRows.length}`);
  console.log(`Candidate mapping rows: ${candidateMappings.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
