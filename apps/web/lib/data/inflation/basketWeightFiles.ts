import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";

// Basket weights refresh once a year in January rather than monthly with the CPI,
// so they keep their own archive tree with the same manifest discipline.
export const BASKET_WEIGHTS_ROOT = path.resolve(process.cwd(), "../../docs/Raw Data/Inflation/geostat-basket-weights");

const rowSchema = z.object({
  file_role: z.literal("weights"),
  language: z.enum(["en", "ka"]),
  source_id: z.string().regex(/^source\.[a-z0-9_]+$/),
  title: z.string().min(1),
  source_page_url: z.string().url(),
  retrieved_file_url: z.string().url(),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  local_file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.coerce.number().int().positive(),
});

export type BasketWeightManifestRow = z.infer<typeof rowSchema>;
export type VerifiedBasketWeightFile = BasketWeightManifestRow & { content: Buffer };

/** The newest weights folder, named after the last year it covers. */
export async function latestBasketWeightVintage(root = BASKET_WEIGHTS_ROOT): Promise<string> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const vintages = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const latest = vintages.at(-1);
  if (!latest) throw new Error("No basket-weight vintage under docs/Raw Data/Inflation/geostat-basket-weights");
  return latest;
}

export async function readVerifiedBasketWeightFiles(vintageDir: string): Promise<VerifiedBasketWeightFile[]> {
  const text = await fs.readFile(path.join(vintageDir, "source-manifest.csv"), "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows = records.map((record) => rowSchema.parse(record));
  if (rows.filter((row) => row.language === "en").length !== 1) {
    throw new Error("Basket-weight manifest must list exactly one English file");
  }
  return Promise.all(
    rows.map(async (row) => {
      const content = await fs.readFile(path.join(vintageDir, row.local_file));
      const sha256 = createHash("sha256").update(content).digest("hex");
      if (content.length !== row.bytes || sha256 !== row.sha256) {
        throw new Error(`Basket-weight source hash mismatch: ${row.local_file}`);
      }
      return { ...row, content };
    }),
  );
}
