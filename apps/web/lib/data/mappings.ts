import { z } from "zod";
import { readCsvRecords } from "./csv";
import { requireNonEmpty, stableIdSchema } from "./validation";

const mappingConfidenceSchema = z.enum(["high", "medium", "low", "unclassified"]);

const mappingRowSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  official_institution: z.string().min(1),
  official_program: z.string(),
  official_subprogram: z.string(),
  public_spending_field_id: stableIdSchema.refine((value) => value.startsWith("spending."), {
    message: "Spending mappings must use spending.* IDs",
  }),
  mapping_confidence: mappingConfidenceSchema,
  mapping_notes: z.string(),
});

export type SpendingMapping = {
  year: number;
  officialInstitution: string;
  officialProgram: string | null;
  officialSubprogram: string | null;
  publicSpendingFieldId: string;
  mappingConfidence: z.infer<typeof mappingConfidenceSchema>;
  mappingNotes: string;
};

export async function loadSpendingMappings(relativePath: string): Promise<SpendingMapping[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = mappingRowSchema.parse(record);

    return {
      year: row.year,
      officialInstitution: requireNonEmpty(row.official_institution, "official_institution"),
      officialProgram: row.official_program.trim() || null,
      officialSubprogram: row.official_subprogram.trim() || null,
      publicSpendingFieldId: row.public_spending_field_id,
      mappingConfidence: row.mapping_confidence,
      mappingNotes: row.mapping_notes,
    };
  });
}
