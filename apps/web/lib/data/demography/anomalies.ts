import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";

const anomalySchema = z.object({
  source_id: z.string().regex(/^source\.[a-z0-9_]+$/),
  cell: z.string().regex(/^[A-Z]{1,3}\d+$/),
  observed_value: z.coerce.number(),
  decision: z.enum(["ignore", "unallocated", "blank"]),
  mapping_note: z.string().min(1),
  reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ReviewedAnomalies = {
  /** True only for a cell a reviewer already saw, holding exactly the value they saw. */
  accepts(sourceId: string, cell: string, value: number): boolean;
  /** The reviewed amount by which a published whole at `cell` exceeds its printed parts; 0 where none was reviewed. */
  unallocated(sourceId: string, cell: string): number;
  /** True for a cell a reviewer saw blank where a value is expected, and found that no total needs. */
  blank(sourceId: string, cell: string): boolean;
};

/**
 * Reviewed cells: `ignore` marks a value Geostat prints that no total may use, with the exact value it holds;
 * `unallocated` records by how much a published whole exceeds the parts Geostat prints under it; `blank` marks a
 * cell Geostat leaves empty where one is expected, which no total needs.
 */
export async function loadReviewedAnomalies(
  repositoryRoot = path.resolve(process.cwd(), "../.."),
): Promise<ReviewedAnomalies> {
  const text = await fs.readFile(path.join(repositoryRoot, "data/mappings/demography/source-anomalies.csv"), "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows = records.map((record, index) => {
    const result = anomalySchema.safeParse(record);
    if (!result.success) throw new Error(`Demography source-anomalies row ${index + 2} is invalid: ${result.error.message}`);
    return result.data;
  });
  const keys = new Set<string>();
  for (const row of rows) {
    const key = `${row.source_id}!${row.cell}`;
    if (keys.has(key)) throw new Error(`Demography source-anomalies lists ${key} twice`);
    keys.add(key);
  }
  return {
    accepts: (sourceId, cell, value) =>
      rows.some((row) => row.decision === "ignore" && row.source_id === sourceId && row.cell === cell && row.observed_value === value),
    unallocated: (sourceId, cell) =>
      rows.find((row) => row.decision === "unallocated" && row.source_id === sourceId && row.cell === cell)?.observed_value ?? 0,
    blank: (sourceId, cell) => rows.some((row) => row.decision === "blank" && row.source_id === sourceId && row.cell === cell),
  };
}
