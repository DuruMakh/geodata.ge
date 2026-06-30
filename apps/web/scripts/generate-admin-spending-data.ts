import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ADMIN_SPENDING_CATEGORIES } from "../lib/data/adminSpending/categories";
import { extractAdminSpendingOfficialRows } from "../lib/data/adminSpending/extractWorkbooks";
import {
  buildAdminSpendingReport,
  generateAdminSpendingFacts,
  MAJOR_PROGRAM_THRESHOLD_GEL,
} from "../lib/data/adminSpending/generateAdminSpendingFacts";
import type { AdminSpendingFact } from "../lib/data/adminSpending/types";
import type { OfficialExpenditureRow } from "../lib/data/realExpenditure/types";

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

function officialRowsToCsv(rows: OfficialExpenditureRow[]): string {
  const headers = [
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
  ];

  return rowsToCsv(
    headers,
    rows.map((row) => ({
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
  );
}

function factsToCsv(facts: AdminSpendingFact[]): string {
  const headers = [
    "year",
    "item_id",
    "parent_item_id",
    "level",
    "amount_gel",
    "basis",
    "source_id",
    "official_code",
    "official_label_ka",
    "official_institution_code",
    "official_institution_label_ka",
    "mapping_confidence",
    "mapping_notes",
  ];

  return rowsToCsv(
    headers,
    facts.map((fact) => ({
      year: fact.year,
      item_id: fact.itemId,
      parent_item_id: fact.parentItemId,
      level: fact.level,
      amount_gel: fact.amountGel,
      basis: fact.basis,
      source_id: fact.sourceId,
      official_code: fact.officialCode,
      official_label_ka: fact.officialLabelKa,
      official_institution_code: fact.officialInstitutionCode,
      official_institution_label_ka: fact.officialInstitutionLabelKa,
      mapping_confidence: fact.mappingConfidence,
      mapping_notes: fact.mappingNotes,
    })),
  );
}

function programReviewCsv(facts: AdminSpendingFact[]): string {
  const byItemId = new Map<
    string,
    {
      itemId: string;
      parentItemId: string | null;
      officialCode: string | null;
      officialLabelKa: string | null;
      officialInstitutionLabelKa: string | null;
      years: Set<number>;
      maxAmountGel: number;
    }
  >();

  for (const fact of facts.filter((row) => row.level === "major_program")) {
    const existing = byItemId.get(fact.itemId) ?? {
      itemId: fact.itemId,
      parentItemId: fact.parentItemId,
      officialCode: fact.officialCode,
      officialLabelKa: fact.officialLabelKa,
      officialInstitutionLabelKa: fact.officialInstitutionLabelKa,
      years: new Set<number>(),
      maxAmountGel: 0,
    };

    existing.years.add(fact.year);
    existing.maxAmountGel = Math.max(existing.maxAmountGel, fact.amountGel);
    byItemId.set(fact.itemId, existing);
  }

  const rows = Array.from(byItemId.values()).sort((a, b) => b.maxAmountGel - a.maxAmountGel);

  return rowsToCsv(
    [
      "item_id",
      "parent_item_id",
      "official_code",
      "official_label_ka",
      "official_institution_label_ka",
      "years",
      "max_amount_gel",
      "threshold_gel",
      "reviewed_stable_item_id",
      "review_notes",
    ],
    rows.map((row) => ({
      item_id: row.itemId,
      parent_item_id: row.parentItemId,
      official_code: row.officialCode,
      official_label_ka: row.officialLabelKa,
      official_institution_label_ka: row.officialInstitutionLabelKa,
      years: Array.from(row.years).sort((a, b) => a - b).join(";"),
      max_amount_gel: row.maxAmountGel,
      threshold_gel: MAJOR_PROGRAM_THRESHOLD_GEL,
      reviewed_stable_item_id: row.itemId,
      review_notes: "Reviewed semantic identity based on official code, administrative parent, and documented code-reuse eras.",
    })),
  );
}

async function main() {
  const officialRows = extractAdminSpendingOfficialRows();
  const facts = generateAdminSpendingFacts(officialRows);
  const report = buildAdminSpendingReport(officialRows, facts);

  const stagingDir = path.resolve(process.cwd(), "../../data/staging");
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");
  const taxonomyDir = path.resolve(process.cwd(), "../../data/taxonomy");
  const reviewDir = path.resolve(process.cwd(), "../../data/mappings/review");

  await Promise.all([stagingDir, importsDir, reportsDir, taxonomyDir, reviewDir].map((dir) => mkdir(dir, { recursive: true })));

  await writeFile(
    path.join(stagingDir, "admin-spending-official-rows-2004-2025.csv"),
    officialRowsToCsv(officialRows),
    "utf8",
  );
  await writeFile(path.join(importsDir, "admin-spending-facts-2004-2025.csv"), factsToCsv(facts), "utf8");
  await writeFile(
    path.join(reviewDir, "admin-spending-major-program-review-2004-2025.csv"),
    programReviewCsv(facts),
    "utf8",
  );
  await writeFile(
    path.join(taxonomyDir, "admin-spending-categories.json"),
    JSON.stringify(ADMIN_SPENDING_CATEGORIES, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(reportsDir, "admin-spending-2004-2025-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  if (Object.values(report.reconciliationStatusByYear).some((status) => status === "failed")) {
    throw new Error("Admin spending reconciliation failed. See data/reports/admin-spending-2004-2025-report.json");
  }

  console.log(`Official rows: ${officialRows.length}`);
  console.log(`Fact rows: ${facts.length}`);
  console.log(`Major program fact rows: ${report.majorProgramFactRows}`);
  console.log(`Major program unique items: ${report.majorProgramUniqueItems}`);
  console.log("Report written: data/reports/admin-spending-2004-2025-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
