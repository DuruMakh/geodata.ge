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
    wages: [await writeReviewedSource(repositoryRoot, "wages", "1995-2025", "docs/Raw Data/Wages/geostat-earnings-annual/official/01-earnings-annual.xlsx", "downloads/methodology/wages/files/01-earnings-annual.xlsx", "wages-headline")],
    money: [await writeReviewedSource(repositoryRoot, "money", "1995-2025", "docs/Raw Data/Money/nbg-money-banks-annual/official/money-aggregates-and-monetary-ratioseng.xlsx", "downloads/methodology/money/files/money-aggregates-and-monetary-ratioseng.xlsx", "money-aggregates")],
    housing: [await writeReviewedSource(repositoryRoot, "housing", "2006-2025", "docs/Raw Data/Housing/geostat-housing-annual/official/0503EN020101_Permissions.xls", "downloads/methodology/housing/files/0503en020101_permissions.xls", "housing-permits-regions")],
    business: [await writeReviewedSource(repositoryRoot, "business", "1999-2025", "docs/Raw Data/Business/geostat-business-annual/official/0502EN0101_Turnover.xlsx", "downloads/methodology/business/files/0502en0101_turnover.xlsx", "business-turnover")],
    poverty: [await writeReviewedSource(repositoryRoot, "poverty", "2004-2025", "docs/Raw Data/Poverty/geostat-poverty-annual/official/302-absolute-poverty.xlsx", "downloads/methodology/poverty/files/302-absolute-poverty.xlsx", "poverty-absolute")],
    "household-income": [await writeReviewedSource(repositoryRoot, "household-income", "2002-2025", "docs/Raw Data/Households/geostat-household-income-spending-annual/official/104-income-per-household.xlsx", "downloads/methodology/household-income/files/104-income-per-household.xlsx", "household-income-household")],
    health: [await writeReviewedSource(repositoryRoot, "health", "2014-2025", "docs/Raw Data/Health/geostat-health-annual/official/deaths/23-2-deaths-by-chapters-regions.xlsx", "downloads/methodology/health/files/23-2-deaths-by-chapters-regions.xlsx", "health-deaths-by-cause-region")],
    crime: [await writeReviewedSource(repositoryRoot, "crime", "2015-2025", "docs/Raw Data/Crime/geostat-crime-annual/official/Number-of-Recorded-Crimes.xlsx", "downloads/methodology/crime/files/number-of-recorded-crimes.xlsx", "crime-recorded")],
    internet: [await writeReviewedSource(repositoryRoot, "internet", "2016-2026", "docs/Raw Data/Internet/geostat-ict-households-annual/official/01_Share_of_households_with_internet_access.xlsx", "downloads/methodology/internet/files/01_share_of_households_with_internet_access.xlsx", "internet-homes")],
    education: [await writeReviewedSource(repositoryRoot, "education", "2010-2025", "docs/Raw Data/Education/geostat-education-annual/official/01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx", "downloads/methodology/education/files/01number-of-students-admission-graduates-by-programmes-and-sex.xlsx", "education-higher")],
    // SSA's topic page capture, and the population table Demography archives too (the same bytes, so the same contents here).
    "social-protection": [
      await writeReviewedSource(repositoryRoot, "social-protection", "2013-2025", "docs/Raw Data/Social/ssa-statistics/official/pages/ssa-page-pension.html", "downloads/methodology/social-protection/files/ssa-page-pension.html.txt", "ssa-pension-page"),
      await writeReviewedSource(repositoryRoot, "social-protection", "2014-2025", "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx", "downloads/methodology/social-protection/files/01-population-by-self-governed-unit.xlsx", "demography-population"),
    ],
    "science-culture": [await writeReviewedSource(repositoryRoot, "science-culture", "2019-2024", "docs/Raw Data/ScienceCulture/geostat-science-culture-annual/official/Researchers.xlsx", "downloads/methodology/science-culture/files/researchers.xlsx", "science-culture-researchers")],
    transport: [await writeReviewedSource(repositoryRoot, "transport", "2000-2025", "docs/Raw Data/Transport/geostat-transport-annual/official/H-1-Passenger-transport-demand_ENG.XLSX", "downloads/methodology/transport/files/h-1-passenger-transport-demand_eng.xlsx", "transport-passenger-demand")],
    "energy-food": [await writeReviewedSource(repositoryRoot, "energy-food", "2013-2024", "docs/Raw Data/EnergyFood/geostat-energy-food-annual/official/energy-balance-2024-aggregated.xlsx", "downloads/methodology/energy-food/files/energy-balance-2024-aggregated.xlsx", "energy-balance-2024-aggregated")],
    environment: [await writeReviewedSource(repositoryRoot, "environment", "2000-2022", "docs/Raw Data/Environment/geostat-environment-annual/official/B-3.-Greenhouse-gas-emissions-ENG.XLSX", "downloads/methodology/environment/files/b-3.-greenhouse-gas-emissions-eng.xlsx", "environment-ghg")],
    trade: [await writeReviewedSource(repositoryRoot, "trade", "1995-2025", "docs/Raw Data/Trade/geostat-external-trade/2026-10-07/official/FTrade_1995-2026.xlsx", "downloads/methodology/trade/files/ftrade_1995-2026.xlsx", "trade-total")],
    "external-flows": [
      await writeReviewedSource(repositoryRoot, "external-flows", "2000-2025", "docs/Raw Data/External/2026-10-10/official/nbg/REMC_money-transfers-by-countries-eng.xlsx", "downloads/methodology/external-flows/files/remc_money-transfers-by-countries-eng.xlsx", "external-remc"),
      await writeReviewedSource(repositoryRoot, "external-flows", "1996-2025", "docs/Raw Data/External/2026-10-10/official/geostat/FDI_Eng-countries.xlsx", "downloads/methodology/external-flows/files/fdi_eng-countries.xlsx", "external-fdi-countries"),
      await writeReviewedSource(repositoryRoot, "external-flows", "2006-2026", "docs/Raw Data/External/nbg-external-position/official/edbpm6eng.xlsx", "downloads/methodology/external-flows/files/edbpm6eng.xlsx", "external-debt"),
    ],
    unemployment: [
      await writeReviewedSource(repositoryRoot, "unemployment", "2010-2025", "docs/Raw Data/Unemployment/geostat-labour-force-annual/official/lfs.xlsx", "downloads/methodology/unemployment/files/lfs.xlsx", "lfs"),
      await writeReviewedSource(repositoryRoot, "unemployment", "2017-2025", "docs/Raw Data/Unemployment/geostat-labour-force-detail/official/07-employment-by-branch-nace_eng.xlsx", "downloads/methodology/unemployment/files/07-employment-by-branch-nace_eng.xlsx", "lfs-jobs-industry"),
    ],
    "economic-sectors": [await writeReviewedSource(repositoryRoot,"economic-sectors","2011-2025","docs/Raw Data/Economy/economic-sectors/sources/growth.xlsx","downloads/methodology/economic-sectors/files/growth.xlsx","sector-growth")],
    "gdp-expenditure": [await writeReviewedSource(repositoryRoot,"gdp-expenditure","2010-2025","docs/Raw Data/Economy/gdp-expenditure/sources/08_GDP-by-use-categories.xlsx","downloads/methodology/gdp-expenditure/files/08_gdp-by-use-categories.xlsx","gdp-use-current")],
    "expenditure-types": [await writeReviewedSource(repositoryRoot,"expenditure-types","2002-2025","docs/Raw Data/Budget/expenditure-types/sources/general20022025.xlsx","downloads/methodology/expenditure-types/files/general20022025.xlsx","mof-general-government")],
    "tax-breaks-refunds": [await writeReviewedSource(repositoryRoot,"tax-breaks-refunds","2018-2024","docs/Raw Data/Revenue/tax-breaks-refunds/sources/TER graphs GEO 2024.xlsx","downloads/methodology/tax-breaks-refunds/files/ter-graphs-geo-2024.xlsx","ter-graphs-geo")],
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
  it("publishes every annual transfer original unchanged with complete manifest and ZIP evidence", async () => {
    const { repositoryRoot, rows } = await createFixtureRepository();
    rows.revenue = await Promise.all(Array.from({ length: 11 }, (_, index) => {
      const year = String(2015 + index);
      return writeReviewedSource(repositoryRoot, "revenue", year, `docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`, `downloads/methodology/revenue/files/${year}/mof-revenue-form-1.pdf`, `transfer-${year}`);
    }));
    // Remove only this test fixture's old synthetic revenue original.
    await rm(path.join(repositoryRoot, "docs/Raw Data/Revenue/source-c.pdf"));
    await writeFile(path.join(repositoryRoot, "data/methodology/source-archives/revenue.csv"), manifestCsv(rows.revenue));
    const publicRoot = path.join(repositoryRoot, "apps/web/public");
    await prepareMethodologyArchives({ repositoryRoot, publicRoot, reportPath: path.join(repositoryRoot, "report.json"), mode: "write" });
    const archiveRoot = path.join(publicRoot, "downloads/methodology/revenue");
    const entries = unzipSync(await readFile(path.join(archiveRoot, "revenue-original-sources.zip")));
    expect(Object.keys(entries)).toEqual([...rows.revenue.map(row => row.public_download_path.replace("downloads/methodology/revenue/", "")), "manifest.csv", "manifest.json"]);
    for (const row of rows.revenue) {
      expect(await sha256(path.join(publicRoot, row.public_download_path))).toBe(row.sha256);
      expect(sha256Bytes(entries[row.public_download_path.replace("downloads/methodology/revenue/", "")]!)).toBe(row.sha256);
    }
  });

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

  it.each([
    ["a text/html archive row whose public path does not end in .txt", "text/html", "downloads/methodology/wages/files/x.html"],
    ["an .htm public path whatever its media type", "application/pdf", "downloads/methodology/wages/files/x.htm"],
  ])("rejects %s", async (_case, mediaType, publicPath) => {
    const { repositoryRoot, rows } = await createFixtureRepository();
    const htmlRow = { ...rows.wages[0], media_type: mediaType, public_download_path: publicPath };
    await writeFile(path.join(repositoryRoot, "data/methodology/source-archives/wages.csv"), manifestCsv([htmlRow]));

    const preparation = prepareMethodologyArchives({
      repositoryRoot,
      publicRoot: path.join(repositoryRoot, "apps/web/public"),
      reportPath: path.join(repositoryRoot, "data/reports/methodology-archive-validation.json"),
      mode: "write",
    });
    await expect(preparation).rejects.toThrow(htmlRow.source_id);
    await expect(preparation).rejects.toThrow(/must be published as \.html\.txt/);
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
