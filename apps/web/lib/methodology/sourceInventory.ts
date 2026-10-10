import path from "node:path";
import { lstat, readdir, realpath } from "node:fs/promises";
import type { MethodologyDatasetId } from "./types";

export type OriginalSourceInventoryRow = {
  path: string;
  byteSize: number;
};

type InventoryRule = {
  root: string;
  include: (path: string) => boolean;
  optionalRoot?: boolean;
};

const extension = (expectedExtension: string) => (candidatePath: string) =>
  path.posix.extname(candidatePath).toLowerCase() === expectedExtension;

const topLevelExtension = (expectedExtension: string) => (candidatePath: string) =>
  extension(expectedExtension)(candidatePath) && candidatePath.split("/").length === 3;

const inventoryRules = {
  expenditure: [{ root: "docs/Raw Data/Expenditure", include: () => true }],
  revenue: [
    { root: "docs/Raw Data/Revenue", include: (candidatePath: string) => extension(".pdf")(candidatePath) && dirname(candidatePath) === "Revenue" },
    {
      root: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports",
      include: (candidatePath: string) => path.posix.basename(candidatePath) === "2004-annual-execution-report.pdf",
      optionalRoot: true,
    },
  ],
  municipalities: [
    { root: "docs/Raw Data/Municipalities/adjara-republic-budget-2015-2025", include: (candidatePath: string) => [".pdf", ".xlsx"].includes(path.posix.extname(candidatePath).toLowerCase()) },
    { root: "docs/Raw Data/Municipalities/mof-functional-classification", include: extension(".xlsx") },
    { root: "docs/Raw Data/Municipalities/mof-municipality-budget-history-2016-2025", include: extension(".xlsx") },
    { root: "docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022", include: topLevelExtension(".zip") },
  ],
  gdp: [{ root: "docs/Raw Data/Economy/gdp-overview/sources", include: () => true }],
  "economic-sectors": [
    { root: "docs/Raw Data/Economy/economic-sectors/sources", include: extension(".xlsx") },
    { root: "docs/Raw Data/Economy/gdp-overview/sources", include: (candidatePath: string) => path.posix.basename(candidatePath) === "geostat_nominal_current.xlsx" },
  ],
  "regional-economies": [
    { root: "docs/Raw Data/Economy/regional-economies/sources", include: (candidatePath: string) => path.posix.basename(candidatePath) === "regional-GDP-by-activities-ENG.xlsx" },
    { root: "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official", include: (candidatePath: string) => path.posix.basename(candidatePath) === "regional-GDP-ENG.xlsx" },
  ],
  demography: [
    { root: "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official", include: (candidatePath: string) => path.posix.basename(candidatePath) === "01-population-by-self-governed-unit.xlsx" },
    { root: "docs/Raw Data/Demography/geostat-demography/2026-10/official", include: (candidatePath: string) => ["03-density-by-regions.xlsx", "09-number-of-live-births-by-self-governed-units.xlsx", "15-crude-birth-rate.xlsx", "16-age-specific-fertility-rates-and-total-fertility-rate.xlsx", "19-number-of-deaths-by-self-governed-units.xlsx", "24-crude-death-rate.xlsx", "25-infant-mortality-rate-by-sex.xlsx", "28-life-expectancy-at-births-by-sex.xlsx", "29-Natural-increase-by-regions-and-self-governed-units.xlsx", "31-net-migration.xlsx", "33-number-of-immigrants-and-emigrants-by-sex-and-citizenship.xlsx"].includes(path.posix.basename(candidatePath)) },
  ],
  inflation: [{ root: "docs/Raw Data/Inflation", include: (candidatePath: string) => [".xlsx", ".pdf"].includes(path.posix.extname(candidatePath).toLowerCase()) }],
  debt: [
    { root: "docs/Raw Data/Debt/government-debt-annual/official", include: () => true },
  ],
  unemployment: [{ root: "docs/Raw Data/Unemployment/geostat-labour-force-annual/official", include: () => true }],
  trade: [{ root: "docs/Raw Data/Trade/geostat-external-trade/2026-10-07/official", include: (candidatePath: string) => ["FTrade_1995-2026.xlsx", "Export-Product-by-4-digit-2015-2026.xlsx", "Export-Product-by-4-digit-2000-2014.xlsx", "Export-Product-by-4-digit-1995-1999.xlsx", "Import-Product-by-4-digit-2015-2026.xlsx", "Import-Product-by-4-digit-2000-2014.xlsx", "Import-products--1995-1999_eng.xlsx", "Export-Country_1995-2026.xlsx", "Import-Country-1995-2026.xlsx", "Export-_Country_Group-1995-2026.xlsx", "Import_Country_Group-1995-2026.xlsx", "external_trade_methodology.html", "metadata-en.html"].includes(path.posix.basename(candidatePath)) }],
  "external-flows": [
    { root: "docs/Raw Data/External/2026-10-10/official/nbg", include: (candidatePath: string) => ["REMC_money-transfers-by-countries-eng.xlsx", "BOP-6_bopbpm6eng.xlsx", "external-sector-methodology-eng-bpm6updated.pdf"].includes(path.posix.basename(candidatePath)) },
    { root: "docs/Raw Data/External/2026-10-10/official/geostat", include: (candidatePath: string) => ["FDI_Eng_by_Quarters.xlsx", "FDI_Eng-countries.xlsx", "FDI_Eng-sectors-NACE-2.xlsx", "FDI_Eng_regions.xlsx", "FDI_metadata_1002_090626_EN.pdf"].includes(path.posix.basename(candidatePath)) },
  ],
} satisfies Record<MethodologyDatasetId, readonly InventoryRule[]>;

function dirname(candidatePath: string) {
  return path.posix.dirname(candidatePath);
}

function repositoryPath(...segments: string[]) {
  return segments.join("/").replaceAll("\\", "/");
}

async function enumerateRule(repositoryRoot: string, rule: InventoryRule): Promise<OriginalSourceInventoryRow[]> {
  const rootPath = path.join(repositoryRoot, ...rule.root.split("/"));
  let rootStat;
  try {
    rootStat = await lstat(rootPath);
  } catch (error) {
    if (rule.optionalRoot && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (rootStat.isSymbolicLink()) {
    throw new Error(`Approved source inventory root cannot be a symlink: ${rule.root}`);
  }
  if (!rootStat.isDirectory()) throw new Error(`Approved source inventory root is not a directory: ${rule.root}`);
  const repositoryRealPath = await realpath(repositoryRoot);
  const rootRealPath = await realpath(rootPath);
  const rootRelativePath = path.relative(repositoryRealPath, rootRealPath);
  if (rootRelativePath.startsWith("..") || path.isAbsolute(rootRelativePath)) {
    throw new Error(`Approved source inventory root resolves outside repository: ${rule.root}`);
  }
  const rows: OriginalSourceInventoryRow[] = [];

  async function visit(directoryPath: string, relativeSegments: string[]): Promise<void> {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      const entrySegments = [...relativeSegments, entry.name];
      const candidatePath = repositoryPath(rule.root, ...entrySegments);
      if (entry.isSymbolicLink()) {
        throw new Error(`Approved source inventory cannot contain symlinks: ${candidatePath}`);
      }
      if (entry.isDirectory()) {
        await visit(entryPath, entrySegments);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!rule.include(candidatePath.replace(/^docs\/Raw Data\//, ""))) continue;
      const stat = await lstat(entryPath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Approved source inventory cannot contain symlinks: ${candidatePath}`);
      }
      rows.push({ path: candidatePath, byteSize: stat.size });
    }
  }

  await visit(rootPath, []);
  return rows;
}

export async function expectedOriginalSourcePaths(
  repositoryRoot: string,
): Promise<Record<MethodologyDatasetId, OriginalSourceInventoryRow[]>>;
export async function expectedOriginalSourcePaths(
  repositoryRoot: string,
  datasetId: MethodologyDatasetId,
): Promise<OriginalSourceInventoryRow[]>;
export async function expectedOriginalSourcePaths(
  repositoryRoot: string,
  datasetId?: MethodologyDatasetId,
): Promise<Record<MethodologyDatasetId, OriginalSourceInventoryRow[]> | OriginalSourceInventoryRow[]> {
  async function inventoryFor(id: MethodologyDatasetId) {
    const rows = (await Promise.all(inventoryRules[id].map((rule) => enumerateRule(repositoryRoot, rule)))).flat();
    return rows.toSorted((left, right) => left.path.localeCompare(right.path, "en"));
  }

  if (datasetId) return inventoryFor(datasetId);
  return Object.fromEntries(await Promise.all(
    (Object.keys(inventoryRules) as MethodologyDatasetId[]).map(async (id) => [id, await inventoryFor(id)]),
  )) as Record<MethodologyDatasetId, OriginalSourceInventoryRow[]>;
}
