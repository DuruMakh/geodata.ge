import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { readVerifiedPackageFile } from "../sourcePackage";
import {
  DEMOGRAPHY_SOURCE_ROLES,
  type DemographyManifestRow,
  type DemographySources,
  type VerifiedDemographySource,
} from "./types";

export const DEMOGRAPHY_RAW_ROOT = "docs/Raw Data/Demography/geostat-demography";
// Table 01 is the municipal package's own capture. It is reused byte for byte, not copied.
const MUNICIPAL_PACKAGE = "docs/Raw Data/Municipalities/geostat-population-regional-gdp";

const optionalYear = z
  .string()
  .regex(/^(\d{4})?$/)
  .transform((value) => (value === "" ? null : Number(value)));

const manifestRowSchema = z.object({
  source_id: z.string().regex(/^source\.[a-z0-9_]+$/),
  dataset_title: z.string().min(1),
  publisher: z.string().min(1),
  role: z.enum(DEMOGRAPHY_SOURCE_ROLES),
  family: z.string().min(1),
  source_page_url: z.url(),
  retrieved_file_url: z.url(),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  local_file: z.string().min(1),
  sha256: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .transform((value) => value.toLowerCase()),
  bytes: z.coerce.number().int().positive(),
  source_year_min: optionalYear,
  source_year_max: optionalYear,
  unit: z.string(),
  notes: z.string().min(1),
});

/** The newest vintage folder (named after the month it was captured). */
export async function latestDemographyVintage(packageRoot: string): Promise<string> {
  const entries = await fs.readdir(packageRoot, { withFileTypes: true });
  const latest = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-(0[1-9]|1[0-2])$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  if (!latest) throw new Error(`No Geostat demography vintage folder under ${DEMOGRAPHY_RAW_ROOT}`);
  return latest;
}

function locate(repositoryRoot: string, vintageDir: string, localFile: string) {
  if (localFile.startsWith("official/")) return { packageDir: vintageDir, file: localFile };
  const prefix = `${MUNICIPAL_PACKAGE}/`;
  if (localFile.startsWith(prefix)) {
    return { packageDir: path.join(repositoryRoot, MUNICIPAL_PACKAGE), file: localFile.slice(prefix.length) };
  }
  throw new Error(`Manifest file is not in a reviewed package: ${localFile}`);
}

function parseManifest(text: string): DemographyManifestRow[] {
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows = records.map((record, index) => {
    const result = manifestRowSchema.safeParse(record);
    if (!result.success) throw new Error(`Demography manifest row ${index + 2} is invalid: ${result.error.message}`);
    const row = result.data;
    return {
      sourceId: row.source_id,
      datasetTitle: row.dataset_title,
      publisher: row.publisher,
      role: row.role,
      family: row.family,
      sourcePageUrl: row.source_page_url,
      retrievedFileUrl: row.retrieved_file_url,
      retrievedAt: row.retrieved_at,
      localFile: row.local_file,
      sha256: row.sha256,
      bytes: row.bytes,
      sourceYearMin: row.source_year_min,
      sourceYearMax: row.source_year_max,
      unit: row.unit,
      notes: row.notes,
    } satisfies DemographyManifestRow;
  });
  for (const key of ["sourceId", "localFile"] as const) {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row[key])) {
        throw new Error(`Demography manifest lists a duplicate ${key === "sourceId" ? "source id" : "file"}: ${row[key]}`);
      }
      seen.add(row[key]);
    }
  }
  if (rows.length === 0) throw new Error("Demography manifest has no rows");
  return rows;
}

/**
 * Reads the newest archived Geostat demography package and checks every file against its
 * manifest bytes and SHA-256 before anything parses it. A file outside the vintage folder
 * is allowed only when it is the municipal package's table 01.
 */
export async function loadDemographySources(
  repositoryRoot = path.resolve(process.cwd(), "../.."),
): Promise<DemographySources> {
  const packageRoot = path.join(repositoryRoot, DEMOGRAPHY_RAW_ROOT);
  const vintage = await latestDemographyVintage(packageRoot);
  const vintageDir = path.join(packageRoot, vintage);
  const rows = parseManifest(await fs.readFile(path.join(vintageDir, "source-manifest.csv"), "utf8"));

  const verified = new Map<string, VerifiedDemographySource>();
  await Promise.all(
    rows.map(async (row) => {
      const { packageDir, file } = locate(repositoryRoot, vintageDir, row.localFile);
      const { bytes } = await readVerifiedPackageFile(
        packageDir,
        file,
        { sha256: row.sha256, bytes: row.bytes },
        `Demography source hash mismatch: ${row.localFile}`,
      );
      verified.set(row.sourceId, { row, bytes });
    }),
  );

  return {
    vintage,
    rows,
    get(sourceId) {
      const source = verified.get(sourceId);
      if (!source) throw new Error(`Unknown demography source: ${sourceId}`);
      return source;
    },
  };
}
