import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { loadCitizenships, type CitizenshipMap } from "../../../lib/data/demography/citizenship";
import { groupMigrationByCitizenship, loadCitizenshipGroups, type CitizenshipGroups } from "../../../lib/data/demography/citizenshipGroups";
import { readMigration } from "../../../lib/data/demography/readMigration";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation } from "../../../lib/data/demography/types";
import { cleanUpTempRoots, copyPreparationInputs, repositoryRoot } from "./helpers";

const FILE = "data/mappings/demography/citizenship-groups.csv";
const IMMIGRANTS = "demography.immigrants_by_citizenship_group";
const EMIGRANTS = "demography.emigrants_by_citizenship_group";
const REST = "citizenship.all_other_computed";
const NAMED = ["citizenship.georgia", "citizenship.russian_federation", "citizenship.turkey", "citizenship.azerbaijan", "citizenship.ukraine"];

let citizenships: CitizenshipMap;
let groups: CitizenshipGroups;
let published: DemographyObservation[];
let grouped: DemographyObservation[];
beforeAll(async () => {
  citizenships = await loadCitizenships(repositoryRoot);
  groups = await loadCitizenshipGroups(repositoryRoot, citizenships);
  published = readMigration(await loadDemographySources(repositoryRoot), citizenships);
  grouped = groupMigrationByCitizenship(published, groups);
});

const at = (seriesId: string, citizenshipId: string, sex: string, year: number) =>
  grouped.find((row) => row.seriesId === seriesId && row.citizenshipId === citizenshipId && row.sex === sex && row.year === year)!;
const condition = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};
async function loadEdited(edit: (lines: string[]) => string[]) {
  const root = await copyPreparationInputs();
  const file = path.join(root, FILE);
  await writeFile(file, edit((await readFile(file, "utf8")).split("\n")).join("\n"));
  return loadCitizenshipGroups(root, citizenships);
}

describe("citizenship groups: the reviewed mapping", () => {
  cleanUpTempRoots();

  test("names five countries Geostat lists in every year and one computed remainder", () => {
    expect(groups.named).toEqual(NAMED);
    expect(groups.remainder).toBe(REST);
    expect(groups.ids).toEqual([...NAMED, REST]);
  });

  test("puts every other listed citizenship, including Geostat's own Other, in the remainder", () => {
    for (const id of NAMED) expect(groups.groupOf(id), id).toBe(id);
    for (const id of ["citizenship.armenia", "citizenship.india", "citizenship.united_states", "citizenship.china", "citizenship.iran", "citizenship.other", "citizenship.stateless", "citizenship.not_stated"]) {
      expect(groups.groupOf(id), id).toBe(REST);
    }
    expect(() => groups.groupOf("citizenship.total")).toThrow(/total/);
  });

  test("assigns every one of the 21 listed citizenships exactly once", async () => {
    const everyId = citizenships.ids.filter((id) => id !== "citizenship.total");

    expect(everyId).toHaveLength(21);
    for (const id of everyId) expect(() => groups.groupOf(id), id).not.toThrow();
    await expect(loadEdited((lines) => lines.filter((line) => !line.startsWith("citizenship.iran,")))).rejects.toThrow(/citizenship\.iran/);
    await expect(loadEdited((lines) => [...lines.filter((line) => line !== ""), lines.find((line) => line.startsWith("citizenship.india,"))!, ""])).rejects.toThrow(/twice/);
  });

  test("refuses an id Geostat's table never listed, the total, and a remainder that collides with a country", async () => {
    await expect(loadEdited((lines) => [...lines.filter((line) => line !== ""), "citizenship.narnia,citizenship.all_other_computed,x,2026-10-03", ""])).rejects.toThrow(/citizenship\.narnia/);
    await expect(loadEdited((lines) => [...lines.filter((line) => line !== ""), "citizenship.total,citizenship.all_other_computed,x,2026-10-03", ""])).rejects.toThrow(/total/);
    await expect(loadEdited((lines) => lines.map((line) => (line.startsWith("citizenship.iran,") ? line.replace("citizenship.all_other_computed", "citizenship.ukraine") : line)))).rejects.toThrow(/remainder/);
  });
});

describe("citizenship groups: the derived rows", () => {
  test("carries immigrants and emigrants by sex for the six groups, 2012 to 2025, without a total row", () => {
    expect(grouped).toHaveLength(2 * 6 * 3 * 14);
    expect(new Set(grouped.map((row) => row.seriesId))).toEqual(new Set([IMMIGRANTS, EMIGRANTS]));
    expect(grouped.some((row) => row.citizenshipId === "citizenship.total")).toBe(false);
    expect(Math.min(...grouped.map((row) => row.year))).toBe(2012);
    expect(Math.max(...grouped.map((row) => row.year))).toBe(2025);
  });

  test("computes the remainder as the total minus the five named countries, which makes it comparable across years", () => {
    // 2012 immigrants: 69,063 - 29,173 Georgia - 7,475 Russia - 6,959 Turkey - 1,883 Azerbaijan - 1,853 Ukraine
    expect(at(IMMIGRANTS, REST, "total", 2012).value).toBe("21720");
    // 2025 immigrants: 131,501 - 62,073 - 20,139 - 5,341 - 5,574 - 6,937
    expect(at(IMMIGRANTS, REST, "total", 2025).value).toBe("31437");
    // 2023 emigrants: 245,064 - 163,480 - 35,344 - 7,049 - 1,946 - 7,675
    expect(at(EMIGRANTS, REST, "total", 2023).value).toBe("29570");
    expect(at(IMMIGRANTS, "citizenship.georgia", "total", 2012).value).toBe("29173");
  });

  test("adds the six groups up to Geostat's published total in every year, sex and direction", () => {
    for (const [groupSeries, publishedSeries] of [[IMMIGRANTS, "demography.immigrants"], [EMIGRANTS, "demography.emigrants"]] as const) {
      for (const sex of ["total", "male", "female"]) {
        for (let year = 2012; year <= 2025; year += 1) {
          const parts = groups.ids.reduce((total, id) => total + Number(at(groupSeries, id, sex, year).value), 0);
          const whole = published.find((row) => row.seriesId === publishedSeries && row.citizenshipId === "citizenship.total" && row.sex === sex && row.year === year)!;
          expect(parts, `${groupSeries} ${sex} ${year}`).toBe(Number(whole.value));
        }
      }
    }
  });

  test("labels each row like the published rows it comes from, with the cells it adds", () => {
    const rest = at(IMMIGRANTS, REST, "total", 2012);

    expect(rest).toMatchObject({ geographyId: "country.georgia", unit: "persons", estimateBasis: "border_police", status: "published", sourceId: "source.geostat_demography_migration_citizenship", lastReviewedAt: "2026-10-03" });
    expect(rest.sourceLocator).toMatch(/^1!B\d+(\+B\d+)+ \[2012\]$/);
    expect(at(IMMIGRANTS, "citizenship.georgia", "total", 2012).sourceLocator).toMatch(/^1!B\d+ \[2012\]$/);
  });

  test("stops rather than fold a named country into the remainder when a year no longer lists it", () => {
    const withoutUkraine = published.filter((row) => !(row.citizenshipId === "citizenship.ukraine" && row.year === 2020));

    expect(condition(() => groupMigrationByCitizenship(withoutUkraine, groups))).toBe("missing_served_cell");
  });

  test("stops on a citizenship no reviewed mapping assigns", () => {
    const unknown = [...published, { ...published.find((row) => row.citizenshipId === "citizenship.armenia")!, citizenshipId: "citizenship.narnia" }];

    expect(condition(() => groupMigrationByCitizenship(unknown, groups))).toBe("unreviewed_label");
  });
});
