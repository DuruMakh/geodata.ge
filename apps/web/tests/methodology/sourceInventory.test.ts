import path from "node:path";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { expectedOriginalSourcePaths } from "../../lib/methodology/sourceInventory";

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
    expect(inventory.expenditure).toHaveLength(77);
    expect(inventory.revenue).toHaveLength(21);
    expect(inventory.municipalities).toHaveLength(77);
    expect(inventory.expenditure.reduce(sumBytes, 0)).toBe(53_661_484);
    expect(inventory.revenue.reduce(sumBytes, 0)).toBe(4_667_365);
    expect(inventory.municipalities.reduce(sumBytes, 0)).toBe(3_091_526);
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
