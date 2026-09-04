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

  it("returns forward-slash paths in lexical order", async () => {
    const inventory = await expectedOriginalSourcePaths(REPOSITORY_ROOT);
    for (const rows of Object.values(inventory)) {
      expect(rows.map((row) => row.path)).toEqual(rows.map((row) => row.path).toSorted());
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
      expect(manifest.map((row) => row.repository_source_path).toSorted()).toEqual(expected.map((row) => row.path));
    }
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
