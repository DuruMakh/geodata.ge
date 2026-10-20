import path from "node:path";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { expectedOriginalSourcePaths } from "../../lib/methodology/sourceInventory";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { LIVE_METHODOLOGY_IDS } from "../../lib/methodology/types";

const REPOSITORY_ROOT = path.resolve(process.cwd(), "../..");
const tempDirectories: string[] = [];

function sumBytes(total: number, row: { byteSize: number }) {
  return total + row.byteSize;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("original-source inventory", () => {
  it("already contains every 2015–2025 transfer original and all 69 municipal history books", async () => {
    const inventory = await expectedOriginalSourcePaths(REPOSITORY_ROOT);
    expect(inventory.revenue.filter(row => /\/(201[5-9]|202[0-5])-jan-dec-consolidated-revenue\.pdf$/.test(row.path)).map(row => row.path)).toEqual(
      Array.from({ length: 11 }, (_, index) => `docs/Raw Data/Revenue/${2015 + index}-jan-dec-consolidated-revenue.pdf`),
    );
    const history = inventory.municipalities.filter(row => row.path.includes("/mof-municipality-budget-history-2016-2025/"));
    const reviewed = (await loadReviewedSourceManifest(REPOSITORY_ROOT, "municipalities")).filter(row => /budget_history_\d{2}$/.test(row.source_id));
    expect(history).toHaveLength(69);
    expect(history.map(row => [row.path, row.byteSize])).toEqual(reviewed.map(row => [row.repository_source_path, row.byte_size]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  });

  it("includes every approved original and no prepared derivative", async () => {
    const inventory = await expectedOriginalSourcePaths(REPOSITORY_ROOT);
    expect(inventory.expenditure).toHaveLength(79);
    expect(inventory.revenue).toHaveLength(22);
    expect(inventory.municipalities).toHaveLength(79);
    expect(inventory.debt).toHaveLength(10);
    expect(inventory.expenditure.reduce(sumBytes, 0)).toBe(58_628_862);
    expect(inventory.revenue.reduce(sumBytes, 0)).toBe(5_465_153);
    expect(inventory.municipalities.reduce(sumBytes, 0)).toBe(3_571_415);
    expect(inventory.debt.reduce(sumBytes, 0)).toBe(16_250_452);
    expect(inventory.revenue.some((row) => row.path.includes("/text/"))).toBe(false);
    expect(inventory.municipalities.some((row) => row.path.includes("combined-annual"))).toBe(false);
    expect(inventory.municipalities.some((row) => row.path.includes("geostat-population"))).toBe(false);
    expect(inventory.municipalities.some((row) => row.path.includes("municipality-map-geometry"))).toBe(false);
  });

  it("inventories the 21 household originals and leaves out the Georgian label copies", async () => {
    const rows = await expectedOriginalSourcePaths(REPOSITORY_ROOT, "household-income");
    expect(rows).toHaveLength(21);
    expect(rows.every((row) => row.path.startsWith("docs/Raw Data/Households/geostat-household-income-spending-annual/official/"))).toBe(true);
    expect(rows.some((row) => row.path.includes("/official/ka/"))).toBe(false);
  });

  it("inventories the 36 health and causes-of-death originals, the served and the archived-only alike", async () => {
    const rows = await expectedOriginalSourcePaths(REPOSITORY_ROOT, "health");
    expect(rows).toHaveLength(36);
    expect(rows.every((row) => row.path.startsWith("docs/Raw Data/Health/geostat-health-annual/official/"))).toBe(true);
    expect(rows.filter((row) => row.path.includes("/official/deaths/"))).toHaveLength(13);
    expect(rows.map((row) => row.path)).toEqual(expect.arrayContaining([
      "docs/Raw Data/Health/geostat-health-annual/official/health-page.html",
      "docs/Raw Data/Health/geostat-health-annual/official/deaths-page.html",
    ]));
  });

  it("inventories the 25 transport originals: 20 workbooks and 5 page captures", async () => {
    const rows = await expectedOriginalSourcePaths(REPOSITORY_ROOT, "transport");
    expect(rows).toHaveLength(25);
    expect(rows.every((row) => row.path.startsWith("docs/Raw Data/Transport/geostat-transport-annual/official/"))).toBe(true);
    expect(rows.map((row) => row.path)).toEqual(expect.arrayContaining([
      "docs/Raw Data/Transport/geostat-transport-annual/official/H-1-Passenger-transport-demand_ENG.XLSX",
      "docs/Raw Data/Transport/geostat-transport-annual/official/Length-of-road-Eng-2024.xls",
      "docs/Raw Data/Transport/geostat-transport-annual/official/geostat-category-565-2026-10-20.html",
    ]));
  });

  it("inventories the 21 housing originals, the zips with their members and the page captures alike", async () => {
    const rows = await expectedOriginalSourcePaths(REPOSITORY_ROOT, "housing");
    expect(rows).toHaveLength(21);
    expect(rows.every((row) => row.path.startsWith("docs/Raw Data/Housing/geostat-housing-annual/official/"))).toBe(true);
    expect(rows.map((row) => row.path)).toEqual(expect.arrayContaining([
      "docs/Raw Data/Housing/geostat-housing-annual/official/Permissions_ENG.zip",
      "docs/Raw Data/Housing/geostat-housing-annual/official/Permissions_ENG/0503EN020102c_Permissions by type_ 2006-2025 ENG.xls",
      "docs/Raw Data/Housing/geostat-housing-annual/official/geostat-category-698-2026-10-16.html",
    ]));
  });

  it("inventories the 45 education originals: 41 workbooks and the four category page captures", async () => {
    const rows = await expectedOriginalSourcePaths(REPOSITORY_ROOT, "education");
    expect(rows).toHaveLength(45);
    expect(rows.every((row) => row.path.startsWith("docs/Raw Data/Education/geostat-education-annual/official/"))).toBe(true);
    expect(rows.filter((row) => row.path.endsWith(".html")).map((row) => path.posix.basename(row.path))).toEqual([58, 59, 60, 61].map((category) => `geostat-category-${category}-2026-10-16.html`));
  });

  it("inventories the 26 business originals", async () => {
    const rows = await expectedOriginalSourcePaths(REPOSITORY_ROOT, "business");
    expect(rows).toHaveLength(26);
    expect(rows.every((row) => row.path.startsWith("docs/Raw Data/Business/geostat-business-annual/official/"))).toBe(true);
  });

  it("inventories the 22 crime and justice originals: the English and Georgian workbooks and both page captures", async () => {
    const rows = await expectedOriginalSourcePaths(REPOSITORY_ROOT, "crime");
    expect(rows).toHaveLength(22);
    expect(rows.every((row) => row.path.startsWith("docs/Raw Data/Crime/geostat-crime-annual/official/"))).toBe(true);
    expect(rows.map((row) => row.path)).toEqual(expect.arrayContaining([
      "docs/Raw Data/Crime/geostat-crime-annual/official/Number-of-Recorded-Crimes.xlsx",
      "docs/Raw Data/Crime/geostat-crime-annual/official/registrirebuli-danaSaulis-raodenoba.xlsx",
      "docs/Raw Data/Crime/geostat-crime-annual/official/crime-page.html",
      "docs/Raw Data/Crime/geostat-crime-annual/official/crime-page-ka.html",
    ]));
  });

  it("returns forward-slash paths in lexical order", async () => {
    const inventory = await expectedOriginalSourcePaths(REPOSITORY_ROOT);
    for (const rows of Object.values(inventory)) {
      expect(rows.map((row) => row.path)).toEqual(rows.map((row) => row.path).toSorted((a,b)=>a.localeCompare(b)));
      expect(rows.every((row) => !row.path.includes("\\"))).toBe(true);
    }
  });

  it("includes only top-level revenue PDFs regardless of extension case", async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "methodology-revenue-inventory-"));
    tempDirectories.push(repositoryRoot);
    const revenueRoot = path.join(repositoryRoot, "docs/Raw Data/Revenue");
    await mkdir(path.join(revenueRoot, "ArchivedRevenue"), { recursive: true });
    await writeFile(path.join(revenueRoot, "published.PDF"), "top-level");
    await writeFile(path.join(revenueRoot, "notes.txt"), "not a PDF");
    await writeFile(path.join(revenueRoot, "ArchivedRevenue", "nested.pdf"), "nested");

    await expect(expectedOriginalSourcePaths(repositoryRoot, "revenue")).resolves.toEqual([
      { path: "docs/Raw Data/Revenue/published.PDF", byteSize: 9 },
    ]);
  });

  it("has one reviewed manifest row for every approved original", async () => {
    for (const datasetId of LIVE_METHODOLOGY_IDS) {
      const expected = await expectedOriginalSourcePaths(REPOSITORY_ROOT, datasetId);
      const manifest = await loadReviewedSourceManifest(REPOSITORY_ROOT, datasetId);
      expect(manifest.map((row) => row.repository_source_path).toSorted((a,b)=>a.localeCompare(b))).toEqual(expected.map((row) => row.path));
    }
  });

  it("registers all four original bilingual product-index workbooks for public download", async () => {
    const manifest = await loadReviewedSourceManifest(REPOSITORY_ROOT, "inflation");
    const productRows = manifest.filter((row) => row.source_id.startsWith("source.geostat_product_"));
    expect(productRows.map((row) => row.source_id).sort()).toEqual([
      "source.geostat_product_mom", "source.geostat_product_mom_ka", "source.geostat_product_yoy", "source.geostat_product_yoy_ka",
    ]);
    expect(productRows.every((row) => row.repository_source_path.includes("geostat-products/2026-09/") &&
      row.downloadHref.startsWith("/downloads/methodology/inflation/files/"))).toBe(true);
  });

  it("publishes the complete 2004 execution-report downloads", async () => {
    const manifest = await loadReviewedSourceManifest(REPOSITORY_ROOT, "expenditure");

    expect(
      manifest
        .filter((row) => row.year === "2004" && row.repository_source_path.includes("annual-execution-reports/2004-annual-execution"))
        .map((row) => ({ sourceId: row.source_id, downloadHref: row.downloadHref, byteSize: row.byte_size, sha256: row.sha256 })),
    ).toEqual([
      {
        sourceId: "source.mof.expenditure.2004.mof_annual_execution_annex",
        downloadHref: "/downloads/methodology/expenditure/files/2004/mof-annual-execution-annex.pdf",
        byteSize: 4_169_590,
        sha256: "c999654e8c2a430778e48fe67c1bfc7d15dc30f76a60ceef4477614a31849889",
      },
      {
        sourceId: "source.mof.expenditure.2004.mof_annual_execution_overview",
        downloadHref: "/downloads/methodology/expenditure/files/2004/mof-annual-execution-report.pdf",
        byteSize: 797_788,
        sha256: "9e368ddd2e873aa020c552a1e8a2d26115cd8e2dd39e97fe5eb7a384d5b5d52e",
      },
    ]);
  });

  it("rejects symlinks inside an approved inventory root", async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "methodology-inventory-"));
    tempDirectories.push(repositoryRoot);
    const expenditureRoot = path.join(repositoryRoot, "docs/Raw Data/Expenditure");
    const outsideRoot = path.join(repositoryRoot, "outside");
    await mkdir(expenditureRoot, { recursive: true });
    await mkdir(outsideRoot, { recursive: true });
    await writeFile(path.join(outsideRoot, "source.pdf"), "source");
    await symlink(outsideRoot, path.join(expenditureRoot, "linked"), process.platform === "win32" ? "junction" : "dir");

    await expect(expectedOriginalSourcePaths(repositoryRoot, "expenditure")).rejects.toThrow(/symlink/i);
  });

  it("rejects an approved inventory root that is itself a symlink outside the repository", async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "methodology-inventory-root-"));
    const outsideRoot = await mkdtemp(path.join(tmpdir(), "methodology-inventory-outside-"));
    tempDirectories.push(repositoryRoot, outsideRoot);
    await mkdir(path.join(repositoryRoot, "docs/Raw Data"), { recursive: true });
    await writeFile(path.join(outsideRoot, "source.pdf"), "source");
    await symlink(
      outsideRoot,
      path.join(repositoryRoot, "docs/Raw Data/Expenditure"),
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(expectedOriginalSourcePaths(repositoryRoot, "expenditure")).rejects.toThrow(/symlink|outside repository/i);
  });
});
