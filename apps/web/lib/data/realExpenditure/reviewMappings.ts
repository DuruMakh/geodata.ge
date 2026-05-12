import { z } from "zod";
import { readCsvRecords } from "../csv";
import type { CandidateSpendingMapping, MappingConfidence } from "./types";

const reviewRowSchema = z.object({
  year: z.coerce.number().int(),
  code: z.string().min(1),
  parent_code: z.string(),
  depth: z.coerce.number().int(),
  institution_code: z.string(),
  institution_label_ka: z.string(),
  program_code: z.string(),
  program_label_ka: z.string(),
  subprogram_code: z.string(),
  subprogram_label_ka: z.string(),
  label_ka: z.string().min(1),
  actual_gel: z.coerce.number(),
  suggested_public_spending_field_id: z.string().min(1),
  mapping_confidence: z.enum(["high", "medium", "low", "unclassified"]),
  mapping_reason: z.string(),
  reviewed_public_spending_field_id: z.string(),
  review_notes: z.string(),
});

export async function loadCandidateMappingReviewRows(relativePath: string): Promise<CandidateSpendingMapping[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = reviewRowSchema.parse(record);

    return {
      year: row.year,
      code: row.code,
      parentCode: row.parent_code.trim() || null,
      depth: row.depth,
      institutionCode: row.institution_code.trim() || null,
      institutionLabelKa: row.institution_label_ka.trim() || null,
      programCode: row.program_code.trim() || null,
      programLabelKa: row.program_label_ka.trim() || null,
      subprogramCode: row.subprogram_code.trim() || null,
      subprogramLabelKa: row.subprogram_label_ka.trim() || null,
      labelKa: row.label_ka,
      actualGel: row.actual_gel,
      suggestedPublicSpendingFieldId: row.suggested_public_spending_field_id,
      mappingConfidence: row.mapping_confidence as MappingConfidence,
      mappingReason: row.mapping_reason,
      reviewedPublicSpendingFieldId: row.reviewed_public_spending_field_id.trim(),
      reviewNotes: row.review_notes,
    };
  });
}
