import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { CPI_FILE_ROLES } from "./readGeostatCpi";
import { readVerifiedPackageFile } from "../sourcePackage";

export const INFLATION_RAW_ROOT = path.resolve(process.cwd(), "../../docs/Raw Data/Inflation");

const manifestRowSchema = z.object({
  file_role: z.enum(CPI_FILE_ROLES),
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

export type CpiManifestRow = z.infer<typeof manifestRowSchema>;
export type VerifiedCpiFile = CpiManifestRow & { content: Buffer };

/** The newest vintage folder (named after the last month it covers). */
export async function latestCpiVintage(rawRoot = INFLATION_RAW_ROOT): Promise<string> {
  const entries = await fs.readdir(path.join(rawRoot, "geostat-cpi"), { withFileTypes: true });
  const vintages = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-(0[1-9]|1[0-2])$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const latest = vintages.at(-1);
  if (!latest) throw new Error("No Geostat CPI vintage folder under docs/Raw Data/Inflation/geostat-cpi");
  return latest;
}

export async function readVerifiedCpiFiles(vintageDir: string): Promise<VerifiedCpiFile[]> {
  const text = await fs.readFile(path.join(vintageDir, "source-manifest.csv"), "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows = records.map((record) => manifestRowSchema.parse(record));
  for (const role of CPI_FILE_ROLES) {
    for (const language of ["en", "ka"] as const) {
      const count = rows.filter((row) => row.file_role === role && row.language === language).length;
      if (count !== 1) throw new Error(`CPI manifest must list exactly one ${language} ${role} file, found ${count}`);
    }
  }
  if (rows.length !== CPI_FILE_ROLES.length * 2) throw new Error(`CPI manifest lists ${rows.length} files, expected ${CPI_FILE_ROLES.length * 2}`);
  return Promise.all(
    rows.map(async (row) => {
      const { bytes: content } = await readVerifiedPackageFile(vintageDir, row.local_file, row, `CPI source hash mismatch: ${row.local_file}`);
      return { ...row, content };
    }),
  );
}
