import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { readVerifiedPackageFile } from "../sourcePackage";

export const PRODUCT_FILE_ROLES = ["mom", "yoy"] as const;
export type ProductFileRole = (typeof PRODUCT_FILE_ROLES)[number];
export type ProductLanguage = "en" | "ka";
export const INFLATION_PRODUCTS_RAW_ROOT = path.resolve(process.cwd(), "../../docs/Raw Data/Inflation/geostat-products");

const manifestRowSchema = z.object({
  file_role: z.enum(PRODUCT_FILE_ROLES),
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

export type ProductManifestRow = z.infer<typeof manifestRowSchema>;
export type VerifiedProductFile = ProductManifestRow & { content: Buffer };

export async function latestProductVintage(rawRoot = INFLATION_PRODUCTS_RAW_ROOT): Promise<string> {
  const entries = await fs.readdir(rawRoot, { withFileTypes: true });
  const latest = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-(0[1-9]|1[0-2])$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  if (!latest) throw new Error("No Geostat product vintage folder under docs/Raw Data/Inflation/geostat-products");
  return latest;
}

export async function readVerifiedProductFiles(vintageDir: string): Promise<VerifiedProductFile[]> {
  const manifest = await fs.readFile(path.join(vintageDir, "source-manifest.csv"), "utf8");
  const records = parse(manifest, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows = records.map((record) => manifestRowSchema.parse(record));
  for (const role of PRODUCT_FILE_ROLES) {
    for (const language of ["en", "ka"] as const) {
      const count = rows.filter((row) => row.file_role === role && row.language === language).length;
      if (count !== 1) throw new Error(`Product manifest must list exactly one ${language} ${role} file, found ${count}`);
    }
  }
  if (rows.length !== 4) throw new Error(`Product manifest lists ${rows.length} files, expected four`);
  if (new Set(rows.map((row) => row.source_id)).size !== rows.length) throw new Error("Product manifest has duplicate source IDs");
  return Promise.all(rows.map(async (row) => {
    const { bytes: content } = await readVerifiedPackageFile(vintageDir, row.local_file, row, `Product source hash mismatch: ${row.local_file}`);
    return { ...row, content };
  }));
}
