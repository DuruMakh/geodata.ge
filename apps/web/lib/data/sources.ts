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

/**
 * The source ids a set of served rows actually cites, splitting the
 * `;`-joined multi-source form the admin CSV contract allows (see
 * scripts/validate-data-files.ts and the AdminSpendingFact schema comment).
 */
export function referencedSourceIds(rows: readonly { sourceId: string }[]): Set<string> {
  const referenced = new Set<string>();

  for (const row of rows) {
    for (const part of row.sourceId.split(";")) {
      const sourceId = part.trim();
      if (sourceId) referenced.add(sourceId);
    }
  }

  return referenced;
}

/**
 * Narrow the 104-row source registry to the documents the given rows cite.
 * Every route ships its source documents to a client component purely so
 * `sourceMetadataFor` can look them up by id, so the ones nothing cites are
 * dead payload — 22 of 104 are referenced by the national expenditure facts.
 * Server-side only: callers that need a "last reviewed" date across the whole
 * registry must compute it before narrowing.
 */
export function sourceDocumentsFor(
  sourceDocuments: readonly SourceDocumentRow[],
  rows: readonly { sourceId: string }[],
): SourceDocumentRow[] {
  const referenced = referencedSourceIds(rows);
  return sourceDocuments.filter((source) => referenced.has(source.sourceId));
}

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
