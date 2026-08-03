import { z } from "zod";
import { readCsvRecords } from "../csv";
import type { Municipality } from "./types";

// municipality_code is text, never a number: the official codes carry leading
// zeros ("04") that an integer parse would destroy.
const municipalityRowSchema = z.object({
  municipality_code: z.string().min(1),
  municipality_sort_id: z.coerce.number().int().positive(),
  name_ka: z.string().min(1),
  display_name_ka: z.string().min(1),
  region_id: z.string().regex(/^region\.[a-z0-9_]+$/, "region IDs use region.*"),
  is_self_governing_city: z.enum(["true", "false"]),
});

export async function loadMunicipalitiesFile(relativePath: string): Promise<Municipality[]> {
  const records = await readCsvRecords(relativePath);
  const codes = new Set<string>();

  return records.map((record) => {
    const row = municipalityRowSchema.parse(record);

    if (codes.has(row.municipality_code)) {
      throw new Error(`Duplicate municipality code: ${row.municipality_code}`);
    }

    codes.add(row.municipality_code);

    return {
      code: row.municipality_code,
      sortId: row.municipality_sort_id,
      nameKa: row.name_ka,
      displayNameKa: row.display_name_ka,
      regionId: row.region_id,
      isSelfGoverningCity: row.is_self_governing_city === "true",
    };
  });
}
