import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isStableId, stableIdSchema } from "./validation";

const taxonomyItemSchema = z.object({
  id: stableIdSchema,
  side: z.enum(["revenue", "expenditure"]),
  level: z.enum(["revenue_category", "public_spending_field"]),
  kaLabel: z.string().min(1),
  enLabel: z.string().min(1),
  sortOrder: z.number().int().positive(),
});

export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;

export function validateStableId(value: string): boolean {
  return isStableId(value);
}

async function readTaxonomyFile(filePath: string): Promise<TaxonomyItem[]> {
  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;

  return z.array(taxonomyItemSchema).parse(parsed);
}

export async function loadTaxonomyFiles(relativeDirectory: string): Promise<TaxonomyItem[]> {
  const directory = path.resolve(process.cwd(), relativeDirectory);
  const revenue = await readTaxonomyFile(path.join(directory, "revenue-categories.json"));
  const spending = await readTaxonomyFile(path.join(directory, "spending-fields.json"));
  const combined = [...revenue, ...spending];
  const ids = new Set<string>();

  for (const item of combined) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate taxonomy ID: ${item.id}`);
    }
    ids.add(item.id);
  }

  return combined.sort((a, b) => a.sortOrder - b.sortOrder);
}
