import { createHash } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { zipSync, type Zippable } from "fflate";
import { expectedOriginalSourcePaths } from "./sourceInventory";
import {
  loadReviewedSourceManifest,
  type ReviewedSourceManifestRow,
  type ValidatedSourceManifestRow,
} from "./sourceManifest";
import {
  LIVE_METHODOLOGY_IDS,
  type MethodologyArchiveSummary,
  type MethodologyDatasetId,
} from "./types";

// ZIP stores a timezone-free DOS timestamp; local midnight encodes the same fixed fields in every timezone.
const FIXED_ZIP_MTIME = new Date(1980, 0, 1, 0, 0, 0);
const ZIP_COMPRESSION_LEVEL = 6 as const;
const GENERATED_REPORT_PATH = "data/reports/methodology-archive-validation.json";
const manifestColumns = [
  "source_id",
  "dataset_id",
  "year",
  "source_organization",
  "display_title_ka",
  "official_filename",
  "official_url_or_archive_url",
  "repository_source_path",
  "public_download_path",
  "media_type",
  "byte_size",
  "sha256",
  "retrieved_at",
  "retrieved_at_basis",
  "license_id",
  "attribution_text",
  "redistribution_status",
  "notes",
  "years",
  "download_href",
] as const;

type GeneratedArchiveSummary = MethodologyArchiveSummary & {
  status: "PASS";
  generatedBytes: number;
  formats: readonly string[];
  minYear: number;
  maxYear: number;
  proxyDateCount: number;
  licenseCounts: Readonly<Record<string, number>>;
  redistributionStatusCounts: Readonly<Record<string, number>>;
  outputHashes: Readonly<Record<string, string>>;
  outputByteSizes: Readonly<Record<string, number>>;
};

type GeneratedArchiveSummaries = Record<MethodologyDatasetId, GeneratedArchiveSummary>;

type GeneratedOutput = {
  relativePath: string;
  byteSize: number;
  sha256: string;
};

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function csvCell(value: unknown) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function publicManifestCsv(rows: readonly ValidatedSourceManifestRow[]) {
  const lines = [manifestColumns.join(",")];
  for (const row of rows) {
    const values: Record<(typeof manifestColumns)[number], unknown> = {
      ...row,
      years: row.years.join("|"),
      download_href: row.downloadHref,
    };
    lines.push(manifestColumns.map((column) => csvCell(values[column])).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function publicManifestJson(rows: readonly ValidatedSourceManifestRow[]) {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

function pathFromRepository(repositoryRoot: string, repositoryPath: string) {
  return path.join(repositoryRoot, ...repositoryPath.split("/"));
}

function pathFromPublicRoot(publicRoot: string, publicPath: string) {
  return path.join(publicRoot, ...publicPath.split("/"));
}

function countBy(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts].toSorted(([left], [right]) => left.localeCompare(right, "en")));
}

function assertManifestCoverage(
  datasetId: MethodologyDatasetId,
  expectedPaths: readonly string[],
  rows: readonly ReviewedSourceManifestRow[],
) {
  const manifestPaths = rows.map((row) => row.repository_source_path).toSorted();
  const expected = [...expectedPaths].toSorted();
  if (JSON.stringify(manifestPaths) !== JSON.stringify(expected)) {
    const manifestSet = new Set(manifestPaths);
    const expectedSet = new Set(expected);
    const missing = expected.filter((candidate) => !manifestSet.has(candidate));
    const unexpected = manifestPaths.filter((candidate) => !expectedSet.has(candidate));
    throw new Error(
      `Reviewed ${datasetId} manifest does not equal the approved original inventory; missing=${missing.join("|") || "none"}; unexpected=${unexpected.join("|") || "none"}`,
    );
  }
}

async function outputFor(filePath: string, relativePath: string): Promise<GeneratedOutput> {
  const bytes = await readFile(filePath);
  return { relativePath, byteSize: bytes.byteLength, sha256: sha256(bytes) };
}

async function generateDatasetArchive(
  repositoryRoot: string,
  publicRoot: string,
  datasetId: MethodologyDatasetId,
): Promise<GeneratedArchiveSummary> {
  const inventory = await expectedOriginalSourcePaths(repositoryRoot, datasetId);
  const rows = await loadReviewedSourceManifest(repositoryRoot, datasetId);
  assertManifestCoverage(datasetId, inventory.map((row) => row.path), rows);

  const datasetPublicRoot = path.join(publicRoot, "downloads", "methodology", datasetId);
  await mkdir(datasetPublicRoot, { recursive: true });
  const outputs: GeneratedOutput[] = [];
  const zipEntries: Zippable = {};

  for (const row of rows.toSorted((left, right) => left.public_download_path.localeCompare(right.public_download_path, "en"))) {
    const sourcePath = pathFromRepository(repositoryRoot, row.repository_source_path);
    const publishedPath = pathFromPublicRoot(publicRoot, row.public_download_path);
    await mkdir(path.dirname(publishedPath), { recursive: true });
    const sourceBytes = await readFile(sourcePath);
    if (sha256(sourceBytes) !== row.sha256) throw new Error(`Source changed after manifest validation: ${row.source_id}`);
    await copyFile(sourcePath, publishedPath);
    const publishedBytes = await readFile(publishedPath);
    if (sha256(publishedBytes) !== row.sha256) throw new Error(`Published copy hash mismatch: ${row.source_id}`);
    const relativePath = path.posix.relative(`downloads/methodology/${datasetId}`, row.public_download_path);
    outputs.push({ relativePath, byteSize: publishedBytes.byteLength, sha256: row.sha256 });
    zipEntries[relativePath] = publishedBytes;
  }

  const manifestJsonPath = path.join(datasetPublicRoot, "manifest.json");
  const manifestCsvPath = path.join(datasetPublicRoot, "manifest.csv");
  await writeFile(manifestJsonPath, publicManifestJson(rows), "utf8");
  await writeFile(manifestCsvPath, publicManifestCsv(rows), "utf8");
  const manifestCsvBytes = await readFile(manifestCsvPath);
  const manifestJsonBytes = await readFile(manifestJsonPath);
  zipEntries["manifest.csv"] = manifestCsvBytes;
  zipEntries["manifest.json"] = manifestJsonBytes;
  outputs.push(await outputFor(manifestCsvPath, "manifest.csv"));
  outputs.push(await outputFor(manifestJsonPath, "manifest.json"));

  const archiveName = `${datasetId}-original-sources.zip`;
  const archivePath = path.join(datasetPublicRoot, archiveName);
  const archiveBytes = zipSync(zipEntries, { level: ZIP_COMPRESSION_LEVEL, mtime: FIXED_ZIP_MTIME });
  await writeFile(archivePath, archiveBytes);
  outputs.push({ relativePath: archiveName, byteSize: archiveBytes.byteLength, sha256: sha256(archiveBytes) });

  const sortedOutputs = outputs.toSorted((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
  const years = rows.flatMap((row) => row.years);
  return {
    status: "PASS",
    fileCount: rows.length,
    totalBytes: rows.reduce((total, row) => total + row.byte_size, 0),
    generatedBytes: sortedOutputs.reduce((total, output) => total + output.byteSize, 0),
    formats: [...new Set(rows.map((row) => row.media_type))].toSorted(),
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
    latestRetrievedAt: rows.map((row) => row.retrieved_at).toSorted().at(-1) ?? "",
    proxyDateCount: rows.filter((row) => row.retrieved_at_basis === "repository_first_commit_proxy").length,
    licenseCounts: countBy(rows.map((row) => row.license_id)),
    redistributionStatusCounts: countBy(rows.map((row) => row.redistribution_status)),
    outputHashes: Object.fromEntries(sortedOutputs.map((output) => [output.relativePath, output.sha256])),
    outputByteSizes: Object.fromEntries(sortedOutputs.map((output) => [output.relativePath, output.byteSize])),
    validated: true,
  };
}

async function generateAll(repositoryRoot: string, publicRoot: string): Promise<GeneratedArchiveSummaries> {
  const [expenditure, revenue, municipalities] = await Promise.all(
    LIVE_METHODOLOGY_IDS.map((datasetId) => generateDatasetArchive(repositoryRoot, publicRoot, datasetId)),
  );
  return { expenditure, revenue, municipalities };
}

async function writeReport(reportPath: string, summaries: GeneratedArchiveSummaries) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify({ status: "PASS", datasets: summaries }, null, 2)}\n`, "utf8");
}

function assertFixedPoint(first: GeneratedArchiveSummaries, second: GeneratedArchiveSummaries) {
  for (const datasetId of LIVE_METHODOLOGY_IDS) {
    if (JSON.stringify(first[datasetId].outputHashes) !== JSON.stringify(second[datasetId].outputHashes)) {
      throw new Error(`Deterministic archive hash check failed for ${datasetId}`);
    }
    if (JSON.stringify(first[datasetId].outputByteSizes) !== JSON.stringify(second[datasetId].outputByteSizes)) {
      throw new Error(`Deterministic archive byte-size check failed for ${datasetId}`);
    }
  }
}

export async function prepareMethodologyArchives(options: {
  repositoryRoot: string;
  publicRoot: string;
  reportPath: string;
  mode: "write" | "check";
}): Promise<Record<MethodologyDatasetId, MethodologyArchiveSummary>> {
  if (options.mode === "write") {
    const generatedRoot = path.join(options.publicRoot, "downloads", "methodology");
    await rm(generatedRoot, { recursive: true, force: true });
    const summaries = await generateAll(options.repositoryRoot, options.publicRoot);
    await writeReport(options.reportPath, summaries);
    return summaries;
  }

  const firstTempRoot = await mkdtemp(path.join(tmpdir(), "methodology-archives-check-a-"));
  const secondTempRoot = await mkdtemp(path.join(tmpdir(), "methodology-archives-check-b-"));
  try {
    const first = await generateAll(options.repositoryRoot, path.join(firstTempRoot, "public"));
    const second = await generateAll(options.repositoryRoot, path.join(secondTempRoot, "public"));
    assertFixedPoint(first, second);
    return first;
  } finally {
    await Promise.all([
      rm(firstTempRoot, { recursive: true, force: true }),
      rm(secondTempRoot, { recursive: true, force: true }),
    ]);
  }
}

export async function loadGeneratedArchiveSummaries(
  repositoryRoot: string,
): Promise<Record<MethodologyDatasetId, MethodologyArchiveSummary>> {
  const report = JSON.parse(await readFile(path.join(repositoryRoot, ...GENERATED_REPORT_PATH.split("/")), "utf8")) as {
    status?: unknown;
    datasets?: Partial<Record<MethodologyDatasetId, MethodologyArchiveSummary>>;
  };
  if (report.status !== "PASS" || !report.datasets) throw new Error("Methodology archive report is not PASS");
  for (const datasetId of LIVE_METHODOLOGY_IDS) {
    const summary = report.datasets[datasetId];
    if (!summary?.validated || summary.status !== "PASS") {
      throw new Error(`Methodology archive report is missing a validated ${datasetId} summary`);
    }
  }
  return report.datasets as Record<MethodologyDatasetId, MethodologyArchiveSummary>;
}
