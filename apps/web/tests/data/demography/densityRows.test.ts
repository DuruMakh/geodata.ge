import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { beforeAll, describe, expect, test } from "vitest";
import { loadDensityRows, type DensityRows } from "../../../lib/data/demography/densityRows";
import { loadDemographyGeography, type DemographyGeography } from "../../../lib/data/demography/geography";
import { readPopulation } from "../../../lib/data/demography/readPopulation";
import { readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import { cleanUpTempRoots, copyPreparationInputs, repositoryRoot } from "./helpers";

const FILE = "data/mappings/demography/density-rows.csv";
const GEORGIA = "country.georgia";

let geography: DemographyGeography;
let regionIds: string[];
let rows: DensityRows;
beforeAll(async () => {
  geography = await loadDemographyGeography(repositoryRoot);
  regionIds = geography.regions.map((region) => region.id);
  rows = await loadDensityRows(repositoryRoot, regionIds);
});

/** A throwaway copy of the preparation inputs whose density mapping is edited line by line. */
async function loadEdited(edit: (lines: string[]) => string[]) {
  const root = await copyPreparationInputs();
  const file = path.join(root, FILE);
  await writeFile(file, edit((await readFile(file, "utf8")).split("\n")).join("\n"));
  return loadDensityRows(root, regionIds);
}

describe("density table row mapping", () => {
  cleanUpTempRoots();

  test("maps the thirteen rows Geostat prints: Georgia, the 11 regions and the empty Abkhazia row", () => {
    expect(rows.labels).toHaveLength(13);
    expect(rows.resolve("Georgia")).toEqual({ geographyId: GEORGIA, areaKm2: 57_178.6706 });
    expect(rows.resolve("C. Tbilisi")).toEqual({ geographyId: "region.tbilisi", areaKm2: 504.2406 });
    expect(rows.resolve("Kvemo kartli")).toEqual({ geographyId: "region.kvemo_kartli", areaKm2: 6436.2 });
    expect(rows.resolve("Shida kartli")).toEqual({ geographyId: "region.shida_kartli", areaKm2: 3428.3 });
    expect(rows.resolve("Abkhazia A.R.")).toEqual({ geographyId: null, areaKm2: null });
  });

  test("covers every one of the 11 reviewed regions exactly once", () => {
    const mapped = rows.labels.map((label) => rows.resolve(label).geographyId).filter((id): id is string => id !== null && id !== GEORGIA);

    expect([...mapped].sort()).toEqual([...regionIds].sort());
    expect(rows.areaOf("region.adjara")).toBe(2900);
    expect(rows.areaOf("region.samtskhe_javakheti")).toBe(6412.83);
  });

  test("adds the 11 region areas up to Georgia's area exactly", () => {
    const parts = regionIds.reduce((total, id) => total.plus(rows.areaOf(id)), new Decimal(0));

    expect(parts.toString()).toBe(rows.areaOf(GEORGIA).toString());
  });

  test("refuses a label nobody reviewed", () => {
    try {
      rows.resolve("Atlantis");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DemographyStopError);
      expect((error as DemographyStopError).condition).toBe("unreviewed_label");
    }
  });

  test("refuses a mapping whose region areas no longer add up to Georgia", async () => {
    await expect(loadEdited((lines) => lines.map((line) => (line.startsWith("Guria,") ? line.replace(",2033.2,", ",2034.2,") : line)))).rejects.toThrow(/add up to Georgia/);
  });

  test("refuses a missing region, a duplicated label and a malformed area", async () => {
    await expect(loadEdited((lines) => lines.filter((line) => !line.startsWith("Guria,")))).rejects.toThrow(/region\.guria/);
    await expect(loadEdited((lines) => [...lines.filter((line) => line !== ""), lines.find((line) => line.startsWith("Imereti,"))!, ""])).rejects.toThrow(/twice/);
    await expect(loadEdited((lines) => lines.map((line) => (line.startsWith("Kakheti,") ? line.replace(",11375,", ",-5,") : line)))).rejects.toThrow(/invalid/);
  });

  test("reproduces Geostat's own unrounded 2022 densities from the 1 January 2022 population", async () => {
    // 2022 is the one column Geostat stores unrounded, so it proves the areas were derived, not guessed.
    const sources = await loadDemographySources(repositoryRoot);
    const population = readPopulation(sources, geography);
    const sheet = readStoredSheet(sources.get("source.geostat_demography_density").bytes, "1");
    const column = "AD"; // 2022 under the reviewed header: B is 1994

    expect(sheet.yearAt(`${column}4`)).toBe(2022);
    for (const label of rows.labels) {
      const { geographyId, areaKm2 } = rows.resolve(label);
      if (geographyId === null) continue;
      const stored = sheet.number(`${column}${sheet.findRow(label)}`)!;
      const people = Number(population.find((row) => row.geographyId === geographyId && row.year === 2022)!.value);
      expect(Math.abs(people / areaKm2! - stored) / stored, label).toBeLessThan(1e-7);
    }
  });
});
