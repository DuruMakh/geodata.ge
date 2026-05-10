import { z } from "zod";
import { readCsvRecords } from "./csv";
import { stableIdSchema } from "./validation";

const glossaryRowSchema = z.object({
  id: stableIdSchema,
  ka_label: z.string().min(1),
  en_label: z.string().min(1),
  description: z.string().min(1),
  notes: z.string(),
});

export type GlossaryEntry = {
  id: string;
  kaLabel: string;
  enLabel: string;
  description: string;
  notes: string;
};

export async function loadGlossary(relativePath: string): Promise<Map<string, GlossaryEntry>> {
  const records = await readCsvRecords(relativePath);
  const glossary = new Map<string, GlossaryEntry>();

  for (const record of records) {
    const row = glossaryRowSchema.parse(record);

    if (glossary.has(row.id)) {
      throw new Error(`Duplicate glossary ID: ${row.id}`);
    }

    glossary.set(row.id, {
      id: row.id,
      kaLabel: row.ka_label,
      enLabel: row.en_label,
      description: row.description,
      notes: row.notes,
    });
  }

  return glossary;
}
