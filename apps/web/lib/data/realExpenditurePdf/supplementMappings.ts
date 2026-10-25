import type { parseAdminWorkbookRows } from "../adminSpending/extractWorkbooks";
import { generateCandidateMappings } from "../realExpenditure/candidateMapping";
import type { SupplementMapping, WorkbookStagingRow } from "./final2025Data";

export type ReviewMappingCsvRow = {
  year: string;
  code: string;
  label_ka: string;
  actual_gel: string;
  mapping_confidence: "high" | "medium" | "low" | "unclassified";
  reviewed_public_spending_field_id: string;
  review_notes: string;
};

type WorkbookRows = ReturnType<typeof parseAdminWorkbookRows>;

export function workbookRowsToSupplementRows(rows: WorkbookRows): WorkbookStagingRow[] {
  return rows.map((row) => ({
    year: row.year,
    sourceId: row.sourceId,
    code: row.code,
    isCodedRow: row.isCodedRow,
    isLeafCode: row.isLeafCode,
    labelKa: row.labelKa,
    actualGel: Math.round(row.actualThousandGel * 1000),
  }));
}

function mappingsByCode(rows: ReviewMappingCsvRow[], year: number): Map<string, SupplementMapping> {
  return new Map(
    rows
      .filter((row) => row.year === String(year) && row.reviewed_public_spending_field_id)
      .map((row) => [
        row.code,
        {
          publicSpendingFieldId: row.reviewed_public_spending_field_id,
          mappingConfidence: row.mapping_confidence,
          labelKa: row.label_ka,
          mappingNotes: row.review_notes,
        },
      ]),
  );
}

function reviewedMappingsByLabel(rows: ReviewMappingCsvRow[]): Map<string, SupplementMapping> {
  const mappings = new Map<string, SupplementMapping>();

  for (const row of rows.filter(
    (candidate) =>
      candidate.reviewed_public_spending_field_id &&
      candidate.reviewed_public_spending_field_id !== "spending.other_unclassified",
  )) {
    if (mappings.has(row.label_ka)) continue;
    mappings.set(row.label_ka, {
      publicSpendingFieldId: row.reviewed_public_spending_field_id,
      mappingConfidence: row.mapping_confidence,
      labelKa: row.label_ka,
      mappingNotes: `Propagated from reviewed 2023-2025 row by exact Georgian label match: ${row.review_notes}`,
    });
  }

  return mappings;
}

/**
 * Supplement mappings for one year's Tavi VI rows: the reviewed 2023-2025 mapping for the same
 * year and code first, then a reviewed mapping with the exact same Georgian label, then the
 * generated keyword candidate.
 */
export function supplementMappingsByCode(input: {
  year: number;
  reviewRows: ReviewMappingCsvRow[];
  workbookRows: WorkbookRows;
}): Map<string, SupplementMapping> {
  const mappings = mappingsByCode(input.reviewRows, input.year);
  const mappingsByLabel = reviewedMappingsByLabel(input.reviewRows);

  for (const row of generateCandidateMappings(input.workbookRows)) {
    if (mappings.has(row.code)) continue;
    const reviewedMapping = mappingsByLabel.get(row.labelKa);
    if (reviewedMapping) {
      mappings.set(row.code, reviewedMapping);
      continue;
    }
    mappings.set(row.code, {
      publicSpendingFieldId: row.suggestedPublicSpendingFieldId,
      mappingConfidence: row.mappingConfidence,
      labelKa: row.labelKa,
      mappingNotes: `Generated older-year supplement mapping candidate: ${row.mappingReason}`,
    });
  }

  return mappings;
}
