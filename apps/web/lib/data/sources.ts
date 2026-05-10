import { z } from "zod";
import { readCsvRecords } from "./csv";
import { stableIdSchema } from "./validation";

const sourceDocumentRowSchema = z.object({
  source_id: stableIdSchema,
  source_name: z.string().min(1),
  source_url_or_file: z.string().min(1),
  last_reviewed_at: z.iso.date(),
});

export type SourceDocumentRow = {
  sourceId: string;
  sourceName: string;
  sourceUrlOrFile: string;
  lastReviewedAt: string;
};

export async function loadSourceDocuments(relativePath: string): Promise<SourceDocumentRow[]> {
  const records = await readCsvRecords(relativePath);
  const sourceIds = new Set<string>();

  return records.map((record) => {
    const row = sourceDocumentRowSchema.parse(record);

    if (sourceIds.has(row.source_id)) {
      throw new Error(`Duplicate source ID: ${row.source_id}`);
    }

    sourceIds.add(row.source_id);

    return {
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceUrlOrFile: row.source_url_or_file,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
}
