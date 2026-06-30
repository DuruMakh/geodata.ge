import { z } from "zod";
import { readCsvRecords } from "../csv";
import type { AdminSpendingFact } from "./types";

const factLevelSchema = z.enum(["admin_category", "major_program"]);
const mappingConfidenceSchema = z.enum(["high", "medium", "low", "unclassified"]);
const amountGelSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim();

  if (!trimmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount_gel is required" });
    return z.NEVER;
  }

  const amount = Number(trimmed);

  if (!Number.isFinite(amount)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount_gel must be finite" });
    return z.NEVER;
  }

  if (amount < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount_gel must be nonnegative" });
    return z.NEVER;
  }

  return amount;
});

const adminSpendingFactRowSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  item_id: z.string().min(1),
  parent_item_id: z.string(),
  level: factLevelSchema,
  amount_gel: amountGelSchema,
  basis: z.literal("actual"),
  source_id: z.string().min(1),
  official_code: z.string(),
  official_label_ka: z.string(),
  official_institution_code: z.string(),
  official_institution_label_ka: z.string(),
  mapping_confidence: mappingConfidenceSchema,
  mapping_notes: z.string(),
});

function nullableText(value: string): string | null {
  return value.trim() || null;
}

export async function loadAdminSpendingFacts(relativePath: string): Promise<AdminSpendingFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = adminSpendingFactRowSchema.parse(record);

    return {
      year: row.year,
      itemId: row.item_id,
      parentItemId: nullableText(row.parent_item_id),
      level: row.level,
      amountGel: row.amount_gel,
      basis: row.basis,
      sourceId: row.source_id,
      officialCode: nullableText(row.official_code),
      officialLabelKa: nullableText(row.official_label_ka),
      officialInstitutionCode: nullableText(row.official_institution_code),
      officialInstitutionLabelKa: nullableText(row.official_institution_label_ka),
      mappingConfidence: row.mapping_confidence,
      mappingNotes: row.mapping_notes,
    };
  });
}
