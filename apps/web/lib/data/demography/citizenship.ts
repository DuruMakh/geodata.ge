import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { DemographyStopError } from "./stops";

const citizenshipSchema = z.object({
  table_label: z.string().min(1),
  citizenship_id: z.string().regex(/^citizenship\.[a-z_]+$/),
  mapping_note: z.string().min(1),
  reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CitizenshipMap = {
  /** The stable id of a label Geostat prints. A label nobody reviewed stops preparation. */
  resolve(label: string): string;
  readonly ids: readonly string[];
};

/**
 * The migration table lists only the countries large enough in each year, so a label means the
 * same country in every year but `Other` changes meaning, and a country absent from a year is
 * inside `Other`. This map fixes the ids; the readers decide what an absent country means.
 */
export async function loadCitizenships(repositoryRoot = path.resolve(process.cwd(), "../..")): Promise<CitizenshipMap> {
  const text = await fs.readFile(path.join(repositoryRoot, "data/mappings/demography/citizenship.csv"), "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const byLabel = new Map<string, string>();
  const ids = new Set<string>();
  records.forEach((record, index) => {
    const result = citizenshipSchema.safeParse(record);
    if (!result.success) throw new Error(`Demography citizenship row ${index + 2} is invalid: ${result.error.message}`);
    const { table_label: label, citizenship_id: id } = result.data;
    if (byLabel.has(label)) throw new Error(`Demography citizenship map lists the label twice: ${label}`);
    if (ids.has(id)) throw new Error(`Demography citizenship map lists the id twice: ${id}`);
    byLabel.set(label, id);
    ids.add(id);
  });
  return {
    resolve(label) {
      const id = byLabel.get(label.trim());
      if (!id) throw new DemographyStopError("unreviewed_label", `Unreviewed citizenship label: ${label}`);
      return id;
    },
    ids: [...ids],
  };
}
