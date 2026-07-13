import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AdminSpendingCategory } from "./types";

const adminCategorySchema = z.object({
  id: z.string().min(1),
  kaLabel: z.string().min(1),
  enLabel: z.string().min(1),
  sortOrder: z.number().int().positive(),
});

export async function loadAdminSpendingCategoriesFile(
  relativePath: string,
): Promise<AdminSpendingCategory[]> {
  const filePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  return z.array(adminCategorySchema).parse(parsed);
}
