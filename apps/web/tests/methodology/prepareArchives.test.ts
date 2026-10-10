import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadGeneratedArchiveSummaries,
  prepareMethodologyArchives,
} from "../../lib/methodology/prepareArchives";
import type { MethodologyDatasetId } from "../../lib/methodology/types";
import type { ReviewedSourceManifestRow } from "../../lib/methodology/sourceManifest";

const tempDirectories: string[] = [];
const manifestColumns = [
  "source_id", "dataset_id", "year", "source_organization", "display_title_ka", "official_filename",
  "official_url_or_archive_url", "repository_source_path", "public_download_path", "media_type", "byte_size",
  "sha256", "retrieved_at", "retrieved_at_basis", "license_id", "attribution_text", "redistribution_status", "notes",
] as const;

function sha256Bytes(bytes: Uint8Array | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256(filePath: string) {
  return sha256Bytes(await readFile(filePath));
}

function localZipTimestamps(bytes: Buffer) {
  const timestamps: Array<{ dosTime: number; dosDate: number }> = [];
  let offset = 0;
  while (offset + 30 <= bytes.byteLength && bytes.readUInt32LE(offset) === 0x04034b50) {
    timestamps.push({ dosTime: bytes.readUInt16LE(offset + 10), dosDate: bytes.readUInt16LE(offset + 12) });
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const filenameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    offset += 30 + filenameLength + extraLength + compressedSize;
  }
  return timestamps;
}

function csvCell(value: unknown) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function manifestCsv(rows: readonly ReviewedSourceManifestRow[]) {
  return [manifestColumns.join(","), ...rows.map((row) => manifestColumns.map((column) => csvCell(row[column])).join(","))].join("\n");
}

async function writeReviewedSource(
  repositoryRoot: string,
  datasetId: MethodologyDatasetId,
  year: string,
  repositoryPath: string,
  publicPath: string,
  contents: string,
): Promise<ReviewedSourceManifestRow> {
  const sourcePath = path.join(repositoryRoot, ...repositoryPath.split("/"));
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, contents);
  return {
    source_id: `source.${datasetId}.${year}.${path.basename(repositoryPath).replaceAll(/[^a-z0-9]+/gi, "_")}`,
    dataset_id: datasetId,
    year,
    source_organization: "Official source",
    display_title_ka: path.basename(repositoryPath),
    official_filename: path.basename(repositoryPath),
    official_url_or_archive_url: `https://example.gov/${path.basename(repositoryPath)}`,
    repository_source_path: repositoryPath,
    public_download_path: publicPath,
    media_type: repositoryPath.endsWith(".pdf") ? "application/pdf" : repositoryPath.endsWith(".zip") ? "application/zip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    byte_size: Buffer.byteLength(contents),
    sha256: sha256Bytes(Buffer.from(contents)),
    retrieved_at: "2026-08-11",
    retrieved_at_basis: "repository_first_commit_proxy",
    license_id: "official-public-document-no-explicit-license",
    attribution_text: "Official source",
    redistribution_status: "repository_owner_approved",
    notes: "Retrieval date is the repository capture proxy.",
  };
}

async function createFixtureRepository() {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), "methodology-archives-repository-"));
  tempDirectories.push(repositoryRoot);
  const rows: Record<MethodologyDatasetId, ReviewedSourceManifestRow[]> = {
    trade: [await writeReviewedSource(repositoryRoot, "trade", "1995-2025", "docs/Raw Data/Trade/geostat-external-trade/2026-10-07/official/FTrade_1995-2026.xlsx", "downloads/methodology/trade/files/ftrade_1995-2026.xlsx", "trade-total")],
    "external-flows": [await writeReviewedSource(repositoryRoot, "external-flows", "2000-2025", "docs/Raw Data/External/2026-10-10/official/nbg/REMC_money-transfers-by-countries-eng.xlsx", "downloads/methodology/external-flows/files/remc_money-transfers-by-countries-eng.xlsx", "external-remc")],
    unemployment: [await writeReviewedSource(repositoryRoot, "unemployment", "2010-2025", "docs/Raw Data/Unemployment/geostat-labour-force-annual/official/lfs.xlsx", "downloads/methodology/unemployment/files/lfs.xlsx", "lfs")],
    "economic-sectors": [await writeReviewedSource(repositoryRoot,"economic-sectors","2011-2025","docs/Raw Data/Economy/economic-sectors/sources/growth.xlsx","downloads/methodology/economic-sectors/files/growth.xlsx","sector-growth")],
    "regional-economies": [
      await writeReviewedSource(repositoryRoot, "regional-economies", "2010-2024", "docs/Raw Data/Economy/regional-economies/sources/regional-GDP-by-activities-ENG.xlsx", "downloads/methodology/regional-economies/files/regional-gdp-by-activities-eng.xlsx", "regional-activities"),
      await writeReviewedSource(repositoryRoot, "regional-economies", "2010-2024", "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/regional-GDP-ENG.xlsx", "downloads/methodology/regional-economies/files/regional-gdp-eng.xlsx", "regional-totals"),
    ],
    demography: [
      await writeReviewedSource(repositoryRoot, "demography", "2004-2026", "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx", "downloads/methodology/demography/files/01-population-by-self-governed-unit.xlsx", "demography-population"),
      await writeReviewedSource(repositoryRoot, "demography", "2014-2026", "docs/Raw Data/Demography/geostat-demography/2026-10/official/03-density-by-regions.xlsx", "downloads/methodology/demography/files/03-density-by-regions.xlsx", "demography-density"),
    ],
    expenditure: [
      await writeReviewedSource(repositoryRoot, "expenditure", "2005", "docs/Raw Data/Expenditure/2005/source-a.pdf", "downloads/methodology/expenditure/files/2005/source-a.pdf", "source-a"),
      await writeReviewedSource(repositoryRoot, "expenditure", "2006", "docs/Raw Data/Expenditure/2006/source-b.xlsx", "downloads/methodology/expenditure/files/2006/source-b.xlsx", "source-b"),
    ],
    revenue: [
      await writeReviewedSource(repositoryRoot, "revenue", "2025", "docs/Raw Data/Revenue/source-c.pdf", "downloads/methodology/revenue/files/2025/source-c.pdf", "source-c"),
    ],
    municipalities: [
      await writeReviewedSource(repositoryRoot, "municipalities", "2015", "docs/Raw Data/Municipalities/adjara-republic-budget-2015-2025/adjara-2015.pdf", "downloads/methodology/municipalities/files/2015/adjara-2015.pdf", "adjara-2015"),
      await writeReviewedSource(repositoryRoot, "municipalities", "2016-2025", "docs/Raw Data/Municipalities/adjara-republic-budget-2015-2025/adjara-2016-2025.xlsx", "downloads/methodology/municipalities/files/2016-2025/adjara-2016-2025.xlsx", "adjara-2016-2025"),
      await writeReviewedSource(repositoryRoot, "municipalities", "2015", "docs/Raw Data/Municipalities/mof-functional-classification/source-d.xlsx", "downloads/methodology/municipalities/files/2015/source-d.xlsx", "source-d"),
      await writeReviewedSource(repositoryRoot, "municipalities", "2016-2025", "docs/Raw Data/Municipalities/mof-municipality-budget-history-2016-2025/source-e.xlsx", "downloads/methodology/municipalities/files/2016-2025/source-e.xlsx", "source-e"),
      await writeReviewedSource(repositoryRoot, "municipalities", "2022", "docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022/source-f.zip", "downloads/methodology/municipalities/files/2022/source-f.zip", "source-f"),
    ],
    gdp: [await writeReviewedSource(repositoryRoot,"gdp","1960-2025","docs/Raw Data/Economy/gdp-overview/sources/real.json","downloads/methodology/gdp/files/real.json","gdp-real")],
    inflation: [await writeReviewedSource(repositoryRoot, "inflation", "2000-2026", "docs/Raw Data/Inflation/geostat-cpi/2026-08/en/cpi-index-2010.xlsx", "downloads/methodology/inflation/files/en/cpi-index-2010.xlsx", "inflation-index")],
    debt: [
      await writeReviewedSource(repositoryRoot, "debt", "2013-2030", "docs/Raw Data/Debt/government-debt-annual/official/source-g.pdf", "downloads/methodology/debt/files/2013-2030/source-g.pdf", "source-g"),
    ],
  };
  for (const datasetId of Object.keys(rows) as MethodologyDatasetId[]) {
    const manifestPath = path.join(repositoryRoot, `data/methodology/source-archives/${datasetId}.csv`);
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, manifestCsv(rows[datasetId]));
  }
  return { repositoryRoot, rows };
}

async function listFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) paths.push(...await listFiles(path.join(root, entry.name), relativePath));
    else paths.push(relativePath);
  }
  return paths.toSorted();
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("methodology archive preparation", () => {
  it("publishes unchanged originals, BOM CSV, and an exact sorted ZIP membership", async () => {
    const { repositoryRoot, rows } = await createFixtureRepository();
    const publicRoot = path.join(repositoryRoot, "apps/web/public");
    const reportPath = path.join(repositoryRoot, "data/reports/methodology-archive-validation.json");

    await prepareMethodologyArchives({ repositoryRoot, publicRoot, reportPath, mode: "write" });

    const sourceFile = path.join(repositoryRoot, ...rows.expenditure[0].repository_source_path.split("/"));
    const publishedFile = path.join(publicRoot, ...rows.expenditure[0].public_download_path.split("/"));
    expect(await sha256(publishedFile)).toBe(await sha256(sourceFile));
    const manifestCsvPath = path.join(publicRoot, "downloads/methodology/expenditure/manifest.csv");
    expect(readFileSync(manifestCsvPath).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));

    const zipPath = path.join(publicRoot, "downloads/methodology/expenditure/expenditure-original-sources.zip");
    const zipBytes = await readFile(zipPath);
    const zipEntries = Object.keys(unzipSync(zipBytes));
    expect(zipEntries).toEqual([
      "files/2005/source-a.pdf",
      "files/2006/source-b.xlsx",
      "manifest.csv",
      "manifest.json",
    ]);
    expect(localZipTimestamps(zipBytes)).toEqual(zipEntries.map(() => ({ dosTime: 0, dosDate: 0x21 })));
  });

  it("keeps each ZIP original set equal to the individually published original set", async () => {
    const { repositoryRoot } = await createFixtureRepository();
    const publicRoot = path.join(repositoryRoot, "apps/web/public");
    const reportPath = path.join(repositoryRoot, "data/reports/methodology-archive-validation.json");
    await prepareMethodologyArchives({ repositoryRoot, publicRoot, reportPath, mode: "write" });

    for (const datasetId of ["expenditure", "revenue", "municipalities", "debt"] as const) {
      const datasetRoot = path.join(publicRoot, `downloads/methodology/${datasetId}`);
      const publishedOriginals = (await listFiles(path.join(datasetRoot, "files"))).map((file) => `files/${file}`);
      const zipEntries = Object.keys(unzipSync(await readFile(path.join(datasetRoot, `${datasetId}-original-sources.zip`))));
      const zipOriginals = zipEntries.filter((entry) => entry !== "manifest.csv" && entry !== "manifest.json");
      expect(zipOriginals).toEqual(publishedOriginals);
      expect(zipEntries.some((entry) => entry.includes("validation") || entry.endsWith("-original-sources.zip"))).toBe(false);
      expect(zipOriginals.filter((entry) => entry.endsWith(".zip"))).toEqual(datasetId === "municipalities" ? ["files/2022/source-f.zip"] : []);
    }
  });

  it("produces a byte-for-byte fixed point and loads the generated report", async () => {
    const { repositoryRoot } = await createFixtureRepository();
    const firstPublicRoot = path.join(repositoryRoot, "generated-first");
    const secondPublicRoot = path.join(repositoryRoot, "generated-second");
    const reportPath = path.join(repositoryRoot, "data/reports/methodology-archive-validation.json");
    const firstRun = await prepareMethodologyArchives({ repositoryRoot, publicRoot: firstPublicRoot, reportPath, mode: "write" });
    const secondRun = await prepareMethodologyArchives({ repositoryRoot, publicRoot: secondPublicRoot, reportPath, mode: "write" });

    for (const datasetId of ["expenditure", "revenue", "municipalities", "debt"] as const) {
      expect(firstRun[datasetId].outputHashes).toEqual(secondRun[datasetId].outputHashes);
      expect(firstRun[datasetId].outputByteSizes).toEqual(secondRun[datasetId].outputByteSizes);
    }
    expect(firstRun.expenditure).toMatchObject({
      status: "PASS",
      fileCount: 2,
      totalBytes: 16,
      generatedBytes: expect.any(Number),
      formats: ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      minYear: 2005,
      maxYear: 2006,
      latestRetrievedAt: "2026-08-11",
      proxyDateCount: 2,
      licenseCounts: { "official-public-document-no-explicit-license": 2 },
      redistributionStatusCounts: { repository_owner_approved: 2 },
      validated: true,
    });
    expect(firstRun.expenditure.generatedBytes).toBeGreaterThan(firstRun.expenditure.totalBytes);
    expect(await loadGeneratedArchiveSummaries(repositoryRoot)).toEqual(secondRun);
  });

  it("rejects a reviewed manifest that does not cover the exact original inventory", async () => {
    const { repositoryRoot } = await createFixtureRepository();
    await writeFile(
      path.join(repositoryRoot, "data/methodology/source-archives/revenue.csv"),
      `${manifestColumns.join(",")}\n`,
    );

    await expect(prepareMethodologyArchives({
      repositoryRoot,
      publicRoot: path.join(repositoryRoot, "apps/web/public"),
      reportPath: path.join(repositoryRoot, "data/reports/methodology-archive-validation.json"),
      mode: "write",
    })).rejects.toThrow(/does not equal the approved original inventory/i);
  });

  it("checks two fresh generations without mutating the public tree", async () => {
    const { repositoryRoot } = await createFixtureRepository();
    const publicRoot = path.join(repositoryRoot, "apps/web/public");
    const sentinelPath = path.join(publicRoot, "downloads/methodology/sentinel.txt");
    await mkdir(path.dirname(sentinelPath), { recursive: true });
    await writeFile(sentinelPath, "keep");

    await expect(prepareMethodologyArchives({
      repositoryRoot,
      publicRoot,
      reportPath: path.join(repositoryRoot, "data/reports/methodology-archive-validation.json"),
      mode: "check",
    })).resolves.toMatchObject({
      expenditure: { status: "PASS" },
      revenue: { status: "PASS" },
      municipalities: { status: "PASS" },
      debt: { status: "PASS" },
    });
    expect(await readFile(sentinelPath, "utf8")).toBe("keep");
    expect(await listFiles(publicRoot)).toEqual(["downloads/methodology/sentinel.txt"]);
  });

  it("does not rewrite an existing repository report in check mode", async () => {
    const { repositoryRoot } = await createFixtureRepository();
    const reportPath = path.join(repositoryRoot, "data/reports/methodology-archive-validation.json");
    const existingReport = '{"status":"prior-evidence"}\n';
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, existingReport);

    await prepareMethodologyArchives({
      repositoryRoot,
      publicRoot: path.join(repositoryRoot, "apps/web/public"),
      reportPath,
      mode: "check",
    });

    expect(await readFile(reportPath, "utf8")).toBe(existingReport);
  });
});
