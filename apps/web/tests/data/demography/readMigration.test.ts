import { beforeAll, describe, expect, test } from "vitest";
import { loadCitizenships, type CitizenshipMap } from "../../../lib/data/demography/citizenship";
import { readMigration } from "../../../lib/data/demography/readMigration";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation, DemographySources, Sex } from "../../../lib/data/demography/types";
import { editSource, repositoryRoot, setCell } from "./helpers";

let sources: DemographySources;
let citizenships: CitizenshipMap;
let migration: DemographyObservation[];
beforeAll(async () => {
  [sources, citizenships] = await Promise.all([loadDemographySources(repositoryRoot), loadCitizenships(repositoryRoot)]);
  migration = readMigration(sources, citizenships);
});

const GEORGIA = "country.georgia";
const IMMIGRANTS = "demography.immigrants";
const EMIGRANTS = "demography.emigrants";
const NET = "demography.net_migration";
const TABLE_33 = "source.geostat_demography_migration_citizenship";
const TABLE_31 = "source.geostat_demography_net_migration";
const find = (seriesId: string, year: number, citizenshipId = "citizenship.total", sex: Sex = "total") =>
  migration.find((row) => row.seriesId === seriesId && row.year === year && row.citizenshipId === citizenshipId && row.sex === sex);
const value = (seriesId: string, year: number, citizenshipId?: string, sex?: Sex) => Number(find(seriesId, year, citizenshipId, sex)!.value);
const condition = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};

describe("international migration", () => {
  test("carries 2012 and 2025 totals and net migration with the audit's values and exact cells", () => {
    expect(find(IMMIGRANTS, 2012)).toEqual({
      seriesId: IMMIGRANTS,
      geographyId: GEORGIA,
      year: 2012,
      value: "69063",
      unit: "persons",
      estimateBasis: "border_police",
      status: "published",
      sourceId: TABLE_33,
      sourceLocator: "1!B7 [2012]",
      lastReviewedAt: "2026-10-01",
      sex: "total",
      citizenshipId: "citizenship.total",
    });
    expect([value(IMMIGRANTS, 2012), value(EMIGRANTS, 2012), value(NET, 2012)]).toEqual([69_063, 90_584, -21_521]);
    expect([value(IMMIGRANTS, 2025), value(EMIGRANTS, 2025), value(NET, 2025)]).toEqual([131_501, 114_374, 17_127]);
    expect(find(NET, 2025)).toMatchObject({ sourceId: TABLE_31, sourceLocator: "1!B36 [2025]", sex: "total", citizenshipId: "citizenship.total" });
    expect(find(EMIGRANTS, 2012)!.sourceLocator).toBe("1!E7 [2012]");
  });

  test("carries each citizenship and sex with its own cell", () => {
    expect([value(IMMIGRANTS, 2012, "citizenship.georgia"), value(EMIGRANTS, 2012, "citizenship.georgia")]).toEqual([29_173, 60_307]);
    expect(find(IMMIGRANTS, 2012, "citizenship.georgia")!.sourceLocator).toBe("1!B8 [2012]");
    expect(value(IMMIGRANTS, 2012, "citizenship.total", "male")).toBe(42_754);
    expect(find(IMMIGRANTS, 2012, "citizenship.total", "female")!.sourceLocator).toBe("1!D7 [2012]");
    expect(find(EMIGRANTS, 2012, "citizenship.total", "male")!.sourceLocator).toBe("1!F7 [2012]");
  });

  test("starts in 2012, ends with the file, and uses border-police data throughout", () => {
    expect(Math.min(...migration.map((row) => row.year))).toBe(2012);
    expect(Math.max(...migration.map((row) => row.year))).toBe(2025);
    expect(new Set(migration.map((row) => row.estimateBasis))).toEqual(new Set(["border_police"]));
    expect(new Set(migration.map((row) => row.geographyId))).toEqual(new Set([GEORGIA]));
  });

  test("carries immigrants, emigrants and net migration, and no net migration rate", () => {
    expect([...new Set(migration.map((row) => row.seriesId))]).toEqual([IMMIGRANTS, EMIGRANTS, NET]);
    expect(migration.filter((row) => row.seriesId === NET)).toHaveLength(14);
  });

  test("makes immigrants minus emigrants equal net migration in every year", () => {
    for (let year = 2012; year <= 2025; year += 1) {
      expect(value(IMMIGRANTS, year) - value(EMIGRANTS, year), `${year}`).toBe(value(NET, year));
    }
  });

  test("makes the citizenship rows add up to the total, and the sexes to both sexes", () => {
    for (let year = 2012; year <= 2025; year += 1) {
      for (const seriesId of [IMMIGRANTS, EMIGRANTS]) {
        for (const sex of ["total", "male", "female"] as const) {
          const parts = migration.filter((row) => row.seriesId === seriesId && row.year === year && row.sex === sex && row.citizenshipId !== "citizenship.total");
          expect(parts.reduce((sum, row) => sum + Number(row.value), 0), `${seriesId} ${year} ${sex}`).toBe(value(seriesId, year, "citizenship.total", sex));
        }
        expect(value(seriesId, year, "citizenship.total", "male") + value(seriesId, year, "citizenship.total", "female"), `${seriesId} ${year}`).toBe(value(seriesId, year));
      }
    }
  });

  test("gives a country missing from a year's list no row, never a zero, and keeps Other as published", () => {
    expect(find(IMMIGRANTS, 2012, "citizenship.armenia")).toBeDefined();
    expect(find(IMMIGRANTS, 2025, "citizenship.armenia")).toBeUndefined();
    expect(find(EMIGRANTS, 2025, "citizenship.armenia")).toBeUndefined();
    expect(value(IMMIGRANTS, 2012, "citizenship.other")).toBe(6_521);
    expect(find(IMMIGRANTS, 2013, "citizenship.not_stated")).toMatchObject({ value: "0" });
    expect(new Set(migration.map((row) => row.citizenshipId)).size).toBe(22);
  });

  test("orders rows by series, then citizenship in the reviewed map's order, then sex, then year", () => {
    const immigrants = migration.filter((row) => row.seriesId === IMMIGRANTS);
    const ids = [...new Set(immigrants.map((row) => row.citizenshipId))];

    expect(migration[0]).toMatchObject({ seriesId: IMMIGRANTS, citizenshipId: "citizenship.total", sex: "total", year: 2012 });
    expect(ids).toEqual(citizenships.ids.filter((id) => ids.includes(id)));
    expect(immigrants.slice(0, 14).map((row) => row.year)).toEqual(Array.from({ length: 14 }, (_, index) => 2012 + index));
  });

  test("stops on an unreviewed country, a repeated country, a missing total row and a blank or fractional cell", () => {
    const unreviewed = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "A9", "Armenya"));
    const repeated = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "A10", "Armenia"));
    const noTotal = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "A7", "Kuwait"));
    const blank = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "C8", "-"));
    const fractional = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "B8", 29_173.5));

    expect(condition(() => readMigration(unreviewed, citizenships))).toBe("unreviewed_label");
    expect(condition(() => readMigration(repeated, citizenships))).toBe("layout_changed");
    expect(condition(() => readMigration(noTotal, citizenships))).toBe("layout_changed");
    expect(condition(() => readMigration(blank, citizenships))).toBe("missing_served_cell");
    expect(condition(() => readMigration(fractional, citizenships))).toBe("not_whole_person");
  });

  test("stops on moved headers, a duplicated or removed year block and a blank net migration year", () => {
    const direction = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "E4", "Leavers"));
    const sexes = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "C5", "Men"));
    const duplicated = editSource(sources, TABLE_33, (sheet) => setCell(sheet, "B38", 2016));
    const removed = editSource(sources, TABLE_33, (sheet) => {
      delete sheet["B38"];
    });
    const netHeader = editSource(sources, TABLE_31, (sheet) => setCell(sheet, "B4", "Balance"));
    const netBlank = editSource(sources, TABLE_31, (sheet) => setCell(sheet, "B30", "-"));

    expect(condition(() => readMigration(direction, citizenships))).toBe("layout_changed");
    expect(condition(() => readMigration(sexes, citizenships))).toBe("layout_changed");
    expect(condition(() => readMigration(duplicated, citizenships))).toBe("layout_changed");
    expect(condition(() => readMigration(removed, citizenships))).toBe("layout_changed");
    expect(condition(() => readMigration(netHeader, citizenships))).toBe("layout_changed");
    expect(condition(() => readMigration(netBlank, citizenships))).toBe("missing_served_cell");
  });
});
