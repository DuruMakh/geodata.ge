import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { latestDemographyVintage, loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { cleanUpTempRoots, copyDemographyPackage, repositoryRoot, VINTAGE_DIR } from "./helpers";

const MANIFEST = `${VINTAGE_DIR}/source-manifest.csv`;
const BIRTHS = `${VINTAGE_DIR}/official/09-number-of-live-births-by-self-governed-units.xlsx`;

async function editManifest(root: string, edit: (lines: string[]) => string[]) {
  const file = path.join(root, MANIFEST);
  const text = await readFile(file, "utf8");
  await writeFile(file, edit(text.split("\n")).join("\n"));
}

describe("demography source package", () => {
  cleanUpTempRoots();

  test("lists the 28 reviewed files with their roles", async () => {
    const sources = await loadDemographySources(repositoryRoot);

    expect(sources.vintage).toBe("2026-10");
    expect(sources.rows).toHaveLength(28);
    const count = (role: string) => sources.rows.filter((row) => row.role === role).length;
    expect([count("canonical_input"), count("validation_only"), count("archived_not_served"), count("definitions")]).toEqual([
      14, 9, 1, 4,
    ]);
  });

  test("archives Geostat's density table as a canonical input serving the March-2014 area basis", async () => {
    const sources = await loadDemographySources(repositoryRoot);
    const { row, bytes } = sources.get("source.geostat_demography_density");

    expect(row).toMatchObject({ role: "canonical_input", family: "E density", localFile: "official/03-density-by-regions.xlsx", bytes: 13_917, servedYearMin: 2014, servedYearMax: 2026, unit: "persons_per_km2" });
    expect(bytes.length).toBe(13_917);
  });

  test("archives the 2024 census age table under a short name and serves only the census date", async () => {
    const sources = await loadDemographySources(repositoryRoot);
    const { row, bytes } = sources.get("source.geostat_census2024_population_by_age_settlement");

    expect(row).toMatchObject({ role: "canonical_input", family: "F census", localFile: "official/census-2024/1.1-population-by-region-unit-age-settlement-sex.xlsx", bytes: 111_570, servedYearMin: 2024, servedYearMax: 2024, unit: "persons" });
    // Geostat's own file name is 100 characters and, in a long worktree path, passes Windows' 260-character limit.
    expect(row.retrievedFileUrl).toContain("1.1-Population-by-regions");
    expect(row.localFile.length).toBeLessThan(80);
    expect(bytes.length).toBe(111_570);
  });

  test("records the years each canonical input serves, and none for evidence files", async () => {
    const sources = await loadDemographySources(repositoryRoot);
    const served = (sourceId: string) => [sources.get(sourceId).row.servedYearMin, sources.get(sourceId).row.servedYearMax];

    expect(served("source.geostat_demography_births")).toEqual([2014, 2025]);
    expect(served("source.geostat_demography_net_migration")).toEqual([2012, 2025]);
    expect(served("source.geostat_demography_population_age_sex")).toEqual([2004, 2026]);
    expect(served("source.geostat_municipal_population")).toEqual([2004, 2026]);
    for (const row of sources.rows) {
      if (row.role !== "canonical_input") expect([row.servedYearMin, row.servedYearMax], row.sourceId).toEqual([null, null]);
    }
  });

  test("rejects half of a served-years pair and a canonical input with none", async () => {
    const halfPair = await copyDemographyPackage();
    await editManifest(halfPair, (lines) => lines.map((line) => (line.includes("09-number-of-live-births") ? line.replace(",2014,2025,persons,", ",2014,,persons,") : line)));
    const none = await copyDemographyPackage();
    await editManifest(none, (lines) => lines.map((line) => (line.includes("09-number-of-live-births") ? line.replace(",2014,2025,persons,", ",,,persons,") : line)));

    await expect(loadDemographySources(halfPair)).rejects.toThrow(/served years/);
    await expect(loadDemographySources(none)).rejects.toThrow(/served years/);
  });

  test("verifies every file against its manifest bytes and SHA-256", async () => {
    const sources = await loadDemographySources(repositoryRoot);

    for (const row of sources.rows) {
      const { bytes } = sources.get(row.sourceId);
      expect(bytes.length, row.sourceId).toBe(row.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), row.sourceId).toBe(row.sha256);
    }
  });

  test("reuses the municipal table 01 capture byte for byte", async () => {
    const table01 = (await loadDemographySources(repositoryRoot)).get("source.geostat_municipal_population");

    expect(table01.row.sha256).toBe("8bd7a1b56e756e8d6bc92192095795b204b23fd18274aaff39b78c0b0a487a57");
    expect(table01.bytes.length).toBe(34_994);
    expect(table01.row.localFile).toBe(
      "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx",
    );
  });

  test("refuses an unknown source id", async () => {
    const sources = await loadDemographySources(repositoryRoot);

    expect(() => sources.get("source.not_in_the_manifest")).toThrow(/Unknown demography source/);
  });

  test("rejects a file whose bytes changed", async () => {
    const root = await copyDemographyPackage();
    const file = path.join(root, BIRTHS);
    const bytes = await readFile(file);
    bytes[bytes.length - 1] ^= 0xff;
    await writeFile(file, bytes);

    await expect(loadDemographySources(root)).rejects.toThrow(/hash mismatch.*09-number-of-live-births/i);
  });

  test("rejects a duplicated source id", async () => {
    const root = await copyDemographyPackage();
    await editManifest(root, (lines) => [...lines.slice(0, 3), lines[2]!, ...lines.slice(3)]);

    await expect(loadDemographySources(root)).rejects.toThrow(/duplicate source id/i);
  });

  test("rejects a file that is missing", async () => {
    const root = await copyDemographyPackage();
    await rm(path.join(root, BIRTHS));

    await expect(loadDemographySources(root)).rejects.toThrow(/ENOENT/);
  });

  test("rejects a manifest path that escapes its package", async () => {
    const root = await copyDemographyPackage();
    await editManifest(root, (lines) =>
      lines.map((line) => line.replace("official/09-number-of-live-births-by-self-governed-units.xlsx", "official/../../../../outside.xlsx")),
    );

    await expect(loadDemographySources(root)).rejects.toThrow(/outside its package/);
  });

  test("rejects a manifest path outside the two reviewed packages", async () => {
    const root = await copyDemographyPackage();
    await editManifest(root, (lines) =>
      lines.map((line) =>
        line.replace("official/09-number-of-live-births-by-self-governed-units.xlsx", "docs/Raw Data/Inflation/other.xlsx"),
      ),
    );

    await expect(loadDemographySources(root)).rejects.toThrow(/not in a reviewed package/);
  });

  test("rejects a manifest with a role it does not know", async () => {
    const root = await copyDemographyPackage();
    await editManifest(root, (lines) => lines.map((line) => line.replace(",canonical_input,", ",canonical_inputs,")));

    await expect(loadDemographySources(root)).rejects.toThrow();
  });

  test("picks the newest vintage folder", async () => {
    const root = await copyDemographyPackage();
    await mkdir(path.join(root, "docs/Raw Data/Demography/geostat-demography/2026-11"));
    await mkdir(path.join(root, "docs/Raw Data/Demography/geostat-demography/notes"));

    await expect(latestDemographyVintage(path.join(root, "docs/Raw Data/Demography/geostat-demography"))).resolves.toBe("2026-11");
    await expect(latestDemographyVintage(path.join(repositoryRoot, "docs/Raw Data/Demography/geostat-demography"))).resolves.toBe("2026-10");
  });

  test("fails when there is no vintage folder", async () => {
    const root = await copyDemographyPackage();
    const packageRoot = path.join(root, "docs/Raw Data/Demography/geostat-demography");
    await rm(path.join(packageRoot, "2026-10"), { recursive: true });

    await expect(latestDemographyVintage(packageRoot)).rejects.toThrow(/No Geostat demography vintage folder/);
  });
});
