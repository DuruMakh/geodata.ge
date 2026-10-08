import { parse } from "csv-parse/sync";
import { z } from "zod";
import { ESTIMATE_BASES } from "./types";
import type { DemographyObservation } from "./types";

const rowSchema = z.object({
  series_id: z.string().min(1),
  geography_id: z.string().min(1),
  year: z.coerce.number().int(),
  value: z.string().min(1),
  unit: z.string().min(1),
  estimate_basis: z.enum(ESTIMATE_BASES),
  status: z.literal("published"),
  source_id: z.string().min(1),
  source_locator: z.string().min(1),
  last_reviewed_at: z.string().min(1),
  sex: z.enum(["total", "male", "female"]).optional(),
  age_group: z.string().optional(),
  citizenship_id: z.string().optional(),
  settlement: z.enum(["total", "urban", "rural"]).optional(),
});

/** Parses the text of one committed canonical demography file. `file` only names the file in an error. */
export function parseCanonicalDemographyRows(text: string, file: string): DemographyObservation[] {
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return records.map((record, index) => {
    const result = rowSchema.safeParse(record);
    if (!result.success) throw new Error(`${file} row ${index + 2} is invalid: ${result.error.message}`);
    const row = result.data;
    return {
      seriesId: row.series_id,
      geographyId: row.geography_id,
      year: row.year,
      value: row.value,
      unit: row.unit,
      estimateBasis: row.estimate_basis,
      status: row.status,
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
      ...(row.sex ? { sex: row.sex } : {}),
      ...(row.age_group ? { ageGroup: row.age_group } : {}),
      ...(row.citizenship_id ? { citizenshipId: row.citizenship_id } : {}),
      ...(row.settlement ? { settlement: row.settlement } : {}),
    };
  });
}
