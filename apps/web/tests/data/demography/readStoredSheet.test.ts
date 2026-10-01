import { beforeAll, describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import {
  findYearBlocks,
  findYearColumns,
  findYearRows,
  NotWholePersonError,
  readStoredSheet,
  UnexpectedCellError,
} from "../../../lib/data/demography/readStoredSheet";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import type { DemographySources } from "../../../lib/data/demography/types";
import { repositoryRoot } from "./helpers";

let sources: DemographySources;
beforeAll(async () => {
  sources = await loadDemographySources(repositoryRoot);
});

const table = (sourceId: string) => readStoredSheet(sources.get(sourceId).bytes, "1");

function syntheticSheet(cells: Record<string, string | number>) {
  const sheet: XLSX.WorkSheet = { "!ref": "A1:H20" };
  for (const [ref, value] of Object.entries(cells)) {
    sheet[ref] = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "1");
  return readStoredSheet(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), "1");
}

describe("stored-value sheet reader", () => {
  test("reads the stored value, not the one-decimal text the workbook displays", () => {
    const population = table("source.geostat_municipal_population");
    const displayed = XLSX.read(sources.get("source.geostat_municipal_population").bytes, { type: "buffer" }).Sheets["1"]!;

    expect(displayed.AG6!.w).toBe("1,335.7");
    expect(population.persons("AG6")).toBe(1_335_671);
    expect(population.label("A6")).toBe("C. Tbilisi Municipality");
    expect(population.persons("AG5")).toBe(3_930_428);
    expect(population.label("A5")).toBe("Georgia");
  });

  test("returns a published rate at the decimals Geostat displays", () => {
    const lifeExpectancy = table("source.geostat_demography_life_expectancy");
    const fertility = table("source.geostat_demography_fertility");

    expect(lifeExpectancy.published("B5", 1)).toBe("70.1");
    expect(lifeExpectancy.published("C5", 1)).toBe("66.0");
    expect(lifeExpectancy.published("D5", 1)).toBe("74.1");
    expect(fertility.published("I35", 2)).toBe("1.70");
    expect(fertility.published("I37", 2)).toBe("1.53");
  });

  test("drops digits Geostat stores below the decimals it displays, rounding half up on the decimal digits", () => {
    const birthRate = table("source.geostat_demography_crude_birth_rate");
    const infantMortality = table("source.geostat_demography_infant_mortality");

    expect(birthRate.number("B36")).toBe(9.621254111811286);
    expect(birthRate.published("B36", 1)).toBe("9.6");
    expect(infantMortality.number("B26")).toBe(8.557106449053991);
    expect(infantMortality.published("B26", 1)).toBe("8.6");
    const ties = syntheticSheet({ B2: 0.25, B3: 2.675 });
    expect(ties.published("B2", 1)).toBe("0.3");
    expect(ties.published("B3", 2)).toBe("2.68");
    expect(ties.published("B4", 1)).toBeNull();
  });

  test("finds one column per year in the population table", () => {
    const columns = findYearColumns(table("source.geostat_municipal_population"), 4);

    expect([...columns.keys()]).toEqual(Array.from({ length: 33 }, (_, index) => 1994 + index));
    expect(columns.get(1994)).toEqual([1]);
    expect(columns.get(2026)).toEqual([33]);
  });

  test("finds the three sex columns under each year of the age table", () => {
    const columns = findYearColumns(table("source.geostat_demography_population_age_sex"), 4);

    expect(columns.get(1994)).toEqual([1, 2, 3]);
    expect(columns.get(2026)).toEqual([97, 98, 99]);
  });

  test("adds up the age rows of table 02 to its total in whole persons, every year", () => {
    const ages = table("source.geostat_demography_population_age_sex");
    const columns = findYearColumns(ages, 4);

    for (const [year, [both, males, females]] of columns) {
      const total = (column: number) => ages.persons(ages.ref(column, 6))!;
      const parts = (column: number) =>
        Array.from({ length: 19 }, (_, index) => ages.persons(ages.ref(column, 7 + index))!).reduce((a, b) => a + b, 0);

      expect(parts(both!), `${year} both sexes`).toBe(total(both!));
      expect(total(males!) + total(females!), `${year} sexes`).toBe(total(both!));
    }
  });

  test("accepts float noise but rejects a value that is not a whole number of persons", () => {
    const sheet = syntheticSheet({ B2: 3930.4279999999999, B3: 1.2340001 });

    expect(sheet.persons("B2")).toBe(3_930_428);
    expect(() => sheet.persons("B3")).toThrow(NotWholePersonError);
  });

  test("treats a blank cell and the reviewed marker as missing and refuses any other text", () => {
    const sheet = syntheticSheet({ B2: "-", B3: "…", B4: "n/a", B5: 12 });

    expect(sheet.persons("B1")).toBeNull();
    expect(sheet.number("B2")).toBeNull();
    expect(() => sheet.number("B3")).toThrow(UnexpectedCellError);
    expect(() => sheet.number("B4")).toThrow(/n\/a/);
    expect(sheet.count("B5")).toBe(12);
  });

  test("rejects a missing sheet, a second sheet and a moved header row", () => {
    const bytes = sources.get("source.geostat_municipal_population").bytes;

    expect(() => readStoredSheet(bytes, "Sheet1")).toThrow(/Missing sheet/);
    expect(() => findYearColumns(table("source.geostat_municipal_population"), 3)).toThrow(/year header/i);

    const workbook = XLSX.read(bytes, { type: "buffer" });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[1]]), "2");
    expect(() => readStoredSheet(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), "1")).toThrow(/exactly one sheet/);
  });

  test("finds one row per year in a table with years down column A, ending before the notes", () => {
    const rates = findYearRows(table("source.geostat_demography_crude_birth_rate"), 5);

    expect([...rates.keys()]).toEqual(Array.from({ length: 32 }, (_, index) => 1994 + index));
    expect(rates.get(1994)).toBe(5);
    expect(rates.get(2025)).toBe(36);
    expect(findYearRows(table("source.geostat_demography_fertility"), 6).get(2025)).toBe(37);
  });

  test("refuses years that skip a year and a table with no year rows", () => {
    expect(() => findYearRows(syntheticSheet({ A2: 2020, A3: 2022 }), 2)).toThrow(/consecutive/);
    expect(() => findYearRows(table("source.geostat_demography_crude_birth_rate"), 4)).toThrow(/No year rows/);
  });

  test("expects a header where the reviewed layout puts it", () => {
    const rates = table("source.geostat_demography_crude_birth_rate");

    expect(() => rates.expectLabel("B4", "Rate")).not.toThrow();
    expect(() => rates.expectLabel("B4", "Ratio")).toThrow(/B4 is "Rate", expected "Ratio"/);
    expect(() => rates.expectLabel("C4", "Rate")).toThrow(/C4 is blank/);
  });

  test("finds the year blocks of the stacked migration table", () => {
    const migration = table("source.geostat_demography_migration_citizenship");
    const blocks = findYearBlocks(migration);

    expect(blocks.map((block) => block.year)).toEqual(Array.from({ length: 14 }, (_, index) => 2012 + index));
    const first = blocks[0]!;
    expect(first.headerRow).toBe(6);
    const total = migration.findRow("Total", { fromRow: first.firstRow, toRow: first.lastRow });
    expect(migration.count(migration.ref("B", total))).toBe(69_063);
    expect(migration.count(migration.ref("E", total))).toBe(90_584);
  });

  test("finds a labelled row once and refuses a missing or repeated label", () => {
    const population = table("source.geostat_municipal_population");

    expect(population.findRow("Georgia")).toBe(5);
    expect(() => population.findRow("Atlantis")).toThrow(/not found/);
    const repeated = syntheticSheet({ A2: "Same", A3: "Same" });
    expect(() => repeated.findRow("Same")).toThrow(/more than once/);
  });
});
