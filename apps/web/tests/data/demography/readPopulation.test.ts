import { beforeAll, describe, expect, test } from "vitest";
import { loadDemographyGeography, type DemographyGeography } from "../../../lib/data/demography/geography";
import { readAgeStructure, readPopulation } from "../../../lib/data/demography/readPopulation";
import { findYearColumns, readStoredSheet } from "../../../lib/data/demography/readStoredSheet";
import { loadDemographySources } from "../../../lib/data/demography/sourceFiles";
import { DemographyStopError } from "../../../lib/data/demography/stops";
import type { DemographyObservation, DemographySources } from "../../../lib/data/demography/types";
import { editSource, repositoryRoot, setCell, unitCell } from "./helpers";

let sources: DemographySources;
let geography: DemographyGeography;
let population: DemographyObservation[];
let structure: DemographyObservation[];
beforeAll(async () => {
  [sources, geography] = await Promise.all([loadDemographySources(repositoryRoot), loadDemographyGeography(repositoryRoot)]);
  population = readPopulation(sources, geography);
  structure = readAgeStructure(sources);
});

const POPULATION = "source.geostat_municipal_population";
const AGE_TABLE = "source.geostat_demography_population_age_sex";
const GEORGIA = "country.georgia";
const at = (rows: DemographyObservation[], geographyId: string, year: number) =>
  rows.find((row) => row.geographyId === geographyId && row.year === year)!;
const condition = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof DemographyStopError ? error.condition : `not a stop: ${String(error)}`;
  }
  return "no error";
};

describe("population on 1 January", () => {
  test("carries Georgia from 2004 with its lineage and exact locator", () => {
    expect(at(population, GEORGIA, 2004)).toEqual({
      seriesId: "demography.population_total",
      geographyId: GEORGIA,
      year: 2004,
      value: "3937716",
      unit: "persons",
      estimateBasis: "retro_projection",
      status: "published",
      sourceId: POPULATION,
      sourceLocator: "1!L5 [2004-01-01]",
      lastReviewedAt: "2026-10-01",
    });
    expect(at(population, GEORGIA, 2014)).toMatchObject({ value: "3716911", estimateBasis: "retro_projection" });
    expect(at(population, GEORGIA, 2015)).toMatchObject({ value: "3721916", estimateBasis: "pre_census" });
    expect(at(population, GEORGIA, 2024)).toMatchObject({ value: "3694608", estimateBasis: "pre_census" });
    expect(at(population, GEORGIA, 2025)).toMatchObject({ value: "3930428", estimateBasis: "census_based", sourceLocator: "1!AG5 [2025-01-01]" });
    expect(at(population, GEORGIA, 2026)).toMatchObject({ value: "3941103", estimateBasis: "census_based" });
  });

  test("starts Georgia in 2004 and every region and municipality in 2015", () => {
    const georgia = population.filter((row) => row.geographyId === GEORGIA).map((row) => row.year);
    const units = population.filter((row) => row.geographyId !== GEORGIA);

    expect(georgia).toEqual(Array.from({ length: 23 }, (_, index) => 2004 + index));
    expect(Math.min(...units.map((row) => row.year))).toBe(2015);
    expect(units).toHaveLength((11 + 64) * 12);
    expect(population).toHaveLength(923);
  });

  test("lists Georgia, then the regions in taxonomy order, then the municipalities in file order", () => {
    const order = [...new Set(population.map((row) => row.geographyId))];

    expect(order[0]).toBe(GEORGIA);
    expect(order.slice(1, 12)).toEqual(geography.regions.map((region) => region.id));
    expect(order.slice(12)).toEqual(geography.municipalities.map((row) => row.code));
  });

  test("gives a region its published row, and Tbilisi's region the municipality's row", () => {
    expect(at(population, "region.adjara", 2025).sourceLocator).toBe("1!AG9 [2025-01-01]");
    expect(at(population, "04", 2025)).toMatchObject({ value: "1335671", sourceLocator: "1!AG6 [2025-01-01]" });
    expect(at(population, "region.tbilisi", 2025)).toMatchObject({ value: "1335671", sourceLocator: "1!AG6 [2025-01-01]" });
  });

  test("adds a starred city to its municipality only in the years it is published", () => {
    const sheet = readStoredSheet(sources.get(POPULATION).bytes, "1");
    const columns = findYearColumns(sheet, 4);
    const refOf = (label: string, year: number) => sheet.ref(columns.get(year)![0]!, sheet.findRow(label));
    const telavi2016 = sheet.persons(refOf("Telavi Municipality", 2016))! + sheet.persons(refOf("C. Telavi*", 2016))!;

    expect(at(population, "15", 2016)).toMatchObject({
      value: String(telavi2016),
      sourceLocator: `1!${refOf("Telavi Municipality", 2016)}+${refOf("C. Telavi*", 2016)} [2016-01-01]`,
    });
    expect(at(population, "15", 2018).sourceLocator).toBe(`1!${refOf("Telavi Municipality", 2018)} [2018-01-01]`);
  });

  test("makes Georgia the sum of the 64 municipalities and each region the sum of its members, every year", () => {
    for (let year = 2015; year <= 2026; year += 1) {
      const municipalities = geography.municipalities.map((row) => ({ ...row, value: Number(at(population, row.code, year).value) }));
      expect(municipalities.reduce((sum, row) => sum + row.value, 0), `Georgia ${year}`).toBe(Number(at(population, GEORGIA, year).value));
      for (const region of geography.regions) {
        const members = municipalities.filter((row) => row.regionId === region.id);
        expect(members.reduce((sum, row) => sum + row.value, 0), `${region.id} ${year}`).toBe(Number(at(population, region.id, year).value));
      }
    }
  });

  test("stops when an excluded unit holds a value", () => {
    const edited = editSource(sources, POPULATION, (sheet) => setCell(sheet, unitCell(sheet, "Abkhazia A.R.", 2020), 5));

    expect(condition(() => readPopulation(edited, geography))).toBe("unexpected_value");
  });

  test("stops when a served value is missing", () => {
    const edited = editSource(sources, POPULATION, (sheet) => setCell(sheet, unitCell(sheet, "C. Batumi Municipality", 2020), "-"));

    expect(condition(() => readPopulation(edited, geography))).toBe("missing_served_cell");
  });

  test("stops when a starred city holds a value outside its years or lacks one inside", () => {
    const outside = editSource(sources, POPULATION, (sheet) => setCell(sheet, unitCell(sheet, "C. Telavi*", 2020), 100));
    const inside = editSource(sources, POPULATION, (sheet) => setCell(sheet, unitCell(sheet, "C. Telavi*", 2016), "-"));

    expect(condition(() => readPopulation(outside, geography))).toBe("unexpected_value");
    expect(condition(() => readPopulation(inside, geography))).toBe("missing_served_cell");
  });

  test("stops on an unreviewed label and on a value that is not a whole number of persons", () => {
    const renamed = editSource(sources, POPULATION, (sheet) => setCell(sheet, "A92", "Khashuri Municipalty"));
    const fractional = editSource(sources, POPULATION, (sheet) => setCell(sheet, unitCell(sheet, "Guria", 2020), 101.5640001));

    expect(condition(() => readPopulation(renamed, geography))).toBe("unreviewed_label");
    expect(condition(() => readPopulation(fractional, geography))).toBe("not_whole_person");
  });

  test("stops when a unit appears twice or a municipality goes missing", () => {
    const twice = editSource(sources, POPULATION, (sheet) => setCell(sheet, "A92", "Kareli Municipality"));
    const gone = editSource(sources, POPULATION, (sheet) => {
      delete sheet["A92"];
    });

    expect(condition(() => readPopulation(twice, geography))).toBe("layout_changed");
    expect(condition(() => readPopulation(gone, geography))).toBe("layout_changed");
  });
});

describe("age structure", () => {
  test("carries 23 years of 3 sexes with the total, 19 age groups and 3 derived bands", () => {
    expect(structure).toHaveLength(23 * 3 * 23);
    expect(Math.min(...structure.map((row) => row.year))).toBe(2004);
    expect(Math.max(...structure.map((row) => row.year))).toBe(2026);
    expect(structure.every((row) => row.geographyId === GEORGIA && row.unit === "persons")).toBe(true);
  });

  test("reads Georgia's 2025 total by sex and exact locators", () => {
    const row = (sex: string, ageGroup: string, year = 2025) =>
      structure.find((item) => item.year === year && item.sex === sex && item.ageGroup === ageGroup)!;

    expect(row("total", "total")).toMatchObject({
      seriesId: "demography.population_by_age_sex",
      value: "3930428",
      estimateBasis: "census_based",
      sourceId: AGE_TABLE,
      sourceLocator: "1!CQ6 [2025-01-01]",
    });
    expect(Number(row("male", "total").value) + Number(row("female", "total").value)).toBe(3_930_428);
    expect(row("total", "age_0").value).toBe("40242");
  });

  test("derives the three bands exactly, and they add up to the total for every year and sex", () => {
    const band = (year: number, id: string, sex = "total") =>
      Number(structure.find((row) => row.year === year && row.sex === sex && row.ageGroup === id)!.value);
    const expected: Record<number, [number, number, number]> = {
      2004: [774_246, 2_609_421, 554_049],
      2014: [685_299, 2_504_647, 526_965],
      2024: [721_620, 2_376_293, 596_695],
      2025: [773_322, 2_466_699, 690_407],
    };

    for (const [year, values] of Object.entries(expected)) {
      expect([band(+year, "band_0_14"), band(+year, "band_15_64"), band(+year, "band_65_plus")]).toEqual(values);
    }
    for (let year = 2004; year <= 2026; year += 1) {
      for (const sex of ["total", "male", "female"]) {
        const total = band(year, "total", sex);
        expect(band(year, "band_0_14", sex) + band(year, "band_15_64", sex) + band(year, "band_65_plus", sex), `${year} ${sex}`).toBe(total);
      }
    }
    expect(structure.find((row) => row.ageGroup === "band_65_plus")).toMatchObject({
      seriesId: "demography.population_age_band",
      sourceLocator: expect.stringMatching(/^1![A-Z]+21:[A-Z]+25 \(sum\) \[2004-01-01\]$/),
    });
  });

  test("flags the lineage of each year", () => {
    const basis = (year: number) => structure.find((row) => row.year === year)!.estimateBasis;

    expect([basis(2014), basis(2015), basis(2024), basis(2025)]).toEqual(["retro_projection", "pre_census", "pre_census", "census_based"]);
  });

  test("stops when the sex columns or the age rows move", () => {
    const sexes = editSource(sources, AGE_TABLE, (sheet) => setCell(sheet, "CR5", "Men"));
    const ages = editSource(sources, AGE_TABLE, (sheet) => {
      setCell(sheet, "A8", "5-9");
      setCell(sheet, "A9", "1-4");
    });
    const missing = editSource(sources, AGE_TABLE, (sheet) => setCell(sheet, "AQ12", "-"));

    expect(condition(() => readAgeStructure(sexes))).toBe("layout_changed");
    expect(condition(() => readAgeStructure(ages))).toBe("layout_changed");
    expect(condition(() => readAgeStructure(missing))).toBe("missing_served_cell");
  });
});
