import { createHash } from "node:crypto";
import path from "node:path";
import { lstat, readFile, realpath } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { expectedOriginalSourcePaths } from "./sourceInventory";
import { LIVE_METHODOLOGY_IDS, type MethodologyDatasetId } from "./types";

export type ReviewedSourceManifestRow = {
  source_id: string;
  dataset_id: MethodologyDatasetId;
  year: string;
  source_organization: string;
  display_title_ka: string;
  official_filename: string;
  official_url_or_archive_url: string;
  repository_source_path: string;
  public_download_path: string;
  media_type: string;
  byte_size: number;
  sha256: string;
  retrieved_at: string;
  retrieved_at_basis: "exact" | "source_manifest" | "repository_first_commit_proxy";
  license_id: string;
  attribution_text: string;
  redistribution_status: "repository_owner_approved" | "approved_with_attribution" | "public_domain";
  notes: string;
};

export type ValidatedSourceManifestRow = ReviewedSourceManifestRow & {
  years: number[];
  downloadHref: `/downloads/methodology/${MethodologyDatasetId}/files/${string}`;
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "retrieved_at must be YYYY-MM-DD").refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
  "retrieved_at must be a valid date",
);

const reviewedSourceManifestRowSchema = z.object({
  source_id: z.string().trim().min(1),
  dataset_id: z.enum(LIVE_METHODOLOGY_IDS),
  year: z.string().trim().min(1),
  source_organization: z.string().trim().min(1),
  display_title_ka: z.string().trim().min(1),
  official_filename: z.string().trim().min(1),
  official_url_or_archive_url: z.string().trim().min(1),
  repository_source_path: z.string().trim().min(1),
  public_download_path: z.string().trim().min(1),
  media_type: z.string().trim().min(1),
  byte_size: z.coerce.number().int().nonnegative(),
  sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, "sha256 must be a 64-character SHA-256").transform((value) => value.toLowerCase()),
  retrieved_at: dateSchema,
  retrieved_at_basis: z.enum(["exact", "source_manifest", "repository_first_commit_proxy"], {
    error: "retrieved_at_basis must identify the date basis",
  }),
  license_id: z.string().trim().min(1),
  attribution_text: z.string().trim().min(1, "attribution_text cannot be blank"),
  redistribution_status: z.enum(["repository_owner_approved", "approved_with_attribution", "public_domain"], {
    error: "redistribution_status is not approved",
  }),
  notes: z.string(),
}).strict();

function parseYears(value: string): number[] {
  const years = new Set<number>();
  for (const part of value.split(",").map((item) => item.trim())) {
    const match = /^(\d{4})(?:[-–](\d{4}))?$/.exec(part);
    if (!match) throw new Error(`Invalid manifest year or range: ${value}`);
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (last < first) throw new Error(`Invalid descending manifest year range: ${value}`);
    for (let year = first; year <= last; year += 1) years.add(year);
  }
  return [...years].toSorted((left, right) => left - right);
}

function assertRelativeForwardSlashPath(value: string, label: string) {
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error(`${label} must be a relative path: ${value}`);
  }
  if (value.includes("\\")) throw new Error(`${label} must use forward slashes: ${value}`);
  const segments = value.split("/");
  if (segments.some((segment) => segment === ".." || segment === "." || segment === "")) {
    throw new Error(`${label} contains traversal or invalid segments: ${value}`);
  }
}

async function resolveRegularFile(repositoryRoot: string, repositorySourcePath: string) {
  const rootRealPath = await realpath(repositoryRoot);
  let currentPath = repositoryRoot;
  for (const segment of repositorySourcePath.split("/")) {
    currentPath = path.join(currentPath, segment);
    let stat;
    try {
      stat = await lstat(currentPath);
    } catch {
      throw new Error(`Manifest source file does not exist: ${repositorySourcePath}`);
    }
    if (stat.isSymbolicLink()) throw new Error(`Manifest source path cannot contain a symlink: ${repositorySourcePath}`);
  }
  const sourceRealPath = await realpath(currentPath);
  const relative = path.relative(rootRealPath, sourceRealPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Manifest source resolves outside repository: ${repositorySourcePath}`);
  }
  const stat = await lstat(sourceRealPath);
  if (!stat.isFile()) throw new Error(`Manifest source is not a regular file: ${repositorySourcePath}`);
  return { sourceRealPath, stat };
}

function manifestError(error: z.ZodError, index: number) {
  const details = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return new Error(`Invalid source manifest row ${index + 1}: ${details}`);
}

export async function validateSourceManifest(
  repositoryRoot: string,
  datasetId: MethodologyDatasetId,
  inputRows: readonly unknown[],
): Promise<ValidatedSourceManifestRow[]> {
  const rows = inputRows.map((inputRow, index) => {
    const parsed = reviewedSourceManifestRowSchema.safeParse(inputRow);
    if (!parsed.success) throw manifestError(parsed.error, index);
    if (parsed.data.dataset_id !== datasetId) {
      throw new Error(`Manifest dataset mismatch: expected ${datasetId}, received ${parsed.data.dataset_id}`);
    }
    return parsed.data;
  });

  const sourceIds = new Set<string>();
  const publicPaths = new Set<string>();
  for (const row of rows) {
    if (sourceIds.has(row.source_id)) throw new Error(`Duplicate source ID: ${row.source_id}`);
    sourceIds.add(row.source_id);
    if (publicPaths.has(row.public_download_path)) throw new Error(`Duplicate public path: ${row.public_download_path}`);
    publicPaths.add(row.public_download_path);
  }

  const approvedPaths = new Set((await expectedOriginalSourcePaths(repositoryRoot, datasetId)).map((row) => row.path));
  const validatedRows: ValidatedSourceManifestRow[] = [];
  for (const row of rows) {
    assertRelativeForwardSlashPath(row.repository_source_path, "repository_source_path");
    assertRelativeForwardSlashPath(row.public_download_path, "public_download_path");
    const publicPrefix = `downloads/methodology/${datasetId}/files/`;
    if (!row.public_download_path.startsWith(publicPrefix) || row.public_download_path === publicPrefix) {
      throw new Error(`Invalid public download path for ${datasetId}: ${row.public_download_path}`);
    }
    const { sourceRealPath, stat } = await resolveRegularFile(repositoryRoot, row.repository_source_path);
    if (!approvedPaths.has(row.repository_source_path)) {
      throw new Error(`Manifest source is outside the approved original inventory: ${row.repository_source_path}`);
    }
    if (stat.size !== row.byte_size) {
      throw new Error(`Manifest byte size mismatch for ${row.source_id}: expected ${row.byte_size}, received ${stat.size}`);
    }
    const bytes = await readFile(sourceRealPath);
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (actualSha256 !== row.sha256) {
      throw new Error(`Manifest SHA-256 mismatch for ${row.source_id}: expected ${row.sha256}, received ${actualSha256}`);
    }
    validatedRows.push({
      ...row,
      years: parseYears(row.year),
      downloadHref: `/${row.public_download_path}` as ValidatedSourceManifestRow["downloadHref"],
    });
  }

  return validatedRows.toSorted((left, right) => {
    const yearDifference = Math.max(...right.years) - Math.max(...left.years);
    return yearDifference || left.source_id.localeCompare(right.source_id, "en");
  });
}

export async function loadReviewedSourceManifest(
  repositoryRoot: string,
  datasetId: MethodologyDatasetId,
): Promise<ValidatedSourceManifestRow[]> {
  const manifestPath = path.join(repositoryRoot, "data", "methodology", "source-archives", `${datasetId}.csv`);
  const csv = await readFile(manifestPath, "utf8");
  const rows = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as unknown[];
  return validateSourceManifest(repositoryRoot, datasetId, rows);
}
